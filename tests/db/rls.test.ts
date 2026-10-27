import { createHash, randomUUID } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asUser,
  createTestDatabase,
  orgIdByName,
  queryError,
  requirementIdByTitle,
  SEED,
} from "./harness";
import { APPLICATION_CONFLICTS, APPLICATION_TRANSITIONS } from "../../src/domain/applications";
import { evaluateMatch, type MatchableRequirement } from "../../src/domain/matching";
import {
  canChangeRequirementStatus,
  REQUIREMENT_STATUSES,
} from "../../src/domain/work-requirement";
import { toCandidate } from "../../src/lib/candidate-pool";

const MAD_REQUIREMENT = "B1.1 · A320 line maintenance reinforcement";
const LIS_REQUIREMENT = "B2 · A330 avionics check support";

let db: PGlite;
let mroId: string;
let otherOrgId: string;
let madRequirementId: string;
let lisRequirementId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  mroId = await orgIdByName(db, "Demo MRO Madrid");
  otherOrgId = await orgIdByName(db, "Demo Aero Services Lisbon");
  madRequirementId = await requirementIdByTitle(db, MAD_REQUIREMENT);
  lisRequirementId = await requirementIdByTitle(db, LIS_REQUIREMENT);
});

async function rowCount(tx: { query: PGlite["query"] }, sql: string, params: unknown[] = []) {
  const { rows } = await tx.query(sql, params);
  return rows.length;
}

describe("sign-up trigger", () => {
  it("creates profile + organization + admin membership for organization accounts", async () => {
    const { rows } = await db.query<{ role: string; account_type: string; platform_role: string }>(
      `select m.role, p.account_type, p.platform_role
       from public.organization_members m join public.profiles p on p.id = m.profile_id
       where m.profile_id = $1`,
      [SEED.adminMro],
    );
    expect(rows).toEqual([{ role: "admin", account_type: "organization", platform_role: "user" }]);
  });

  it("never takes platform_role from user metadata", async () => {
    const id = "00000000-0000-4000-8000-0000000000ff";
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, 'mallory@crewflex.test', '{"account_type":"professional","platform_role":"platform_admin"}')`,
      [id],
    );
    const { rows } = await db.query<{ platform_role: string }>(
      "select platform_role from public.profiles where id = $1",
      [id],
    );
    expect(rows[0]?.platform_role).toBe("user");
  });
});

describe("anon", () => {
  it("has no access to any table", async () => {
    await asUser(db, null, async (tx) => {
      expect(await queryError(tx, "select * from public.qualification_types")).toMatch(
        /permission denied/,
      );
      expect(await queryError(tx, "select * from public.technician_profiles")).toMatch(
        /permission denied/,
      );
    });
  });
});

describe("A. professional isolation", () => {
  it("professional A cannot read professional B", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      expect(await rowCount(tx, "select * from public.technician_profiles")).toBe(1);
      expect(
        await rowCount(tx, "select * from public.technician_profiles where profile_id = $1", [
          SEED.echo,
        ]),
      ).toBe(0);
      expect(
        await rowCount(
          tx,
          "select id from public.technician_qualifications where technician_profile_id = $1",
          [SEED.echo],
        ),
      ).toBe(0);
      expect(await rowCount(tx, "select * from public.profiles where id = $1", [SEED.echo])).toBe(
        0,
      );
    });
  });

  it("professional A cannot modify professional B", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const result = await tx.query(
        "update public.technician_profiles set base_location = 'X' where profile_id = $1",
        [SEED.echo],
      );
      expect(result.affectedRows).toBe(0);
    });
  });
});

describe("B. cross-organization isolation", () => {
  it("organization A cannot read organization B or its requirements", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(await rowCount(tx, "select * from public.organizations")).toBe(1);
      expect(
        await rowCount(tx, "select * from public.work_requirements where id = $1", [
          lisRequirementId,
        ]),
      ).toBe(0);
    });
  });

  it("organization A admin cannot modify organization B", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const result = await tx.query(
        "update public.organizations set name = 'pwned' where id = $1",
        [otherOrgId],
      );
      expect(result.affectedRows).toBe(0);
    });
  });

  it("organization A cannot create requirements for organization B", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(
        await queryError(
          tx,
          `select public.create_work_requirement($1, 'Spoofed', 'LIS', now(), now() + interval '1 day',
             'day', 1, 'planned', $2::jsonb)`,
          [
            otherOrgId,
            JSON.stringify([
              { qualification_type_id: crypto.randomUUID(), requirement_level: "hard" },
            ]),
          ],
        ),
      ).toMatch(/row-level security/);
    });
  });

  it("organization A cannot read the candidate pool of organization B's requirement", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(
        await queryError(tx, "select * from public.get_requirement_candidate_pool($1)", [
          lisRequirementId,
        ]),
      ).toMatch(/not authorized/);
    });
  });
});

describe("C. organization roles", () => {
  it("a plain member cannot administer the organization", async () => {
    await asUser(db, SEED.charlieMember, async (tx) => {
      expect(
        await rowCount(tx, "select * from public.work_requirements where organization_id = $1", [
          mroId,
        ]),
      ).toBe(2);
      const update = await tx.query(
        "update public.organizations set name = 'pwned' where id = $1",
        [mroId],
      );
      expect(update.affectedRows).toBe(0);
      const promote = await tx.query(
        "update public.organization_members set role = 'admin' where profile_id = $1",
        [SEED.charlieMember],
      );
      expect(promote.affectedRows).toBe(0);
    });
  });

  it("a plain member sees colleagues' memberships but not their profiles (OD-4)", async () => {
    await asUser(db, SEED.charlieMember, async (tx) => {
      const members = await rowCount(
        tx,
        "select * from public.organization_members where organization_id = $1",
        [mroId],
      );
      expect(members).toBeGreaterThan(1);
      const { rows } = await tx.query<{ id: string }>(
        `select p.id from public.profiles p
         join public.organization_members m on m.profile_id = p.id
         where m.organization_id = $1`,
        [mroId],
      );
      expect(rows).toEqual([{ id: SEED.charlieMember }]);
    });
  });

  it("a plain member cannot create requirements nor read the candidate pool", async () => {
    await asUser(db, SEED.charlieMember, async (tx) => {
      const types = await tx.query<{ id: string }>(
        "select id from public.qualification_types where code = 'B1.1'",
      );
      expect(
        await queryError(
          tx,
          `select public.create_work_requirement($1, 'Member attempt', 'MAD', now(), now() + interval '1 day',
             'day', 1, 'planned', $2::jsonb)`,
          [
            mroId,
            JSON.stringify([
              { qualification_type_id: types.rows[0]?.id, requirement_level: "hard" },
            ]),
          ],
        ),
      ).toMatch(/row-level security/);
      expect(
        await queryError(tx, "select * from public.get_requirement_candidate_pool($1)", [
          madRequirementId,
        ]),
      ).toMatch(/not authorized/);
    });
  });

  it("organization admins cannot add arbitrary professionals as members (no insert path)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(
        await queryError(
          tx,
          "insert into public.organization_members (organization_id, profile_id, role) values ($1, $2, 'member')",
          [mroId, SEED.delta],
        ),
      ).toMatch(/permission denied/);
    });
  });

  it("users cannot escalate their platform role", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      expect(
        await queryError(
          tx,
          "update public.profiles set platform_role = 'platform_admin' where id = $1",
          [SEED.delta],
        ),
      ).toMatch(/permission denied/);
    });
  });
});

describe("D. verification tampering", () => {
  it("a professional cannot mark a qualification as verified", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      expect(
        await queryError(
          tx,
          "update public.technician_qualifications set verification_status = 'verified' where technician_profile_id = $1",
          [SEED.delta],
        ),
      ).toMatch(/permission denied/);
    });
  });

  it("a professional cannot insert a pre-verified qualification", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      expect(
        await queryError(
          tx,
          `insert into public.technician_qualifications (technician_profile_id, qualification_type_id, verification_status)
           select $1, id, 'verified' from public.qualification_types where code = 'B2'`,
          [SEED.delta],
        ),
      ).toMatch(/permission denied/);
    });
  });

  it("self-declared qualifications start as pending", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const { rows } = await tx.query<{ verification_status: string }>(
        `insert into public.technician_qualifications (technician_profile_id, qualification_type_id, expires_at)
         select $1, id, date '2030-01-01' from public.qualification_types where code = 'B2'
         returning verification_status`,
        [SEED.delta],
      );
      expect(rows[0]?.verification_status).toBe("pending");
    });
  });

  it("editing the expiry of a verified qualification sends it back to pending", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const { rows } = await tx.query<{ verification_status: string }>(
        `update public.technician_qualifications set expires_at = date '2099-01-01'
         where technician_profile_id = $1
           and qualification_type_id = (select id from public.qualification_types where code = 'FTS')
         returning verification_status`,
        [SEED.delta],
      );
      expect(rows[0]?.verification_status).toBe("pending");
    });
  });
});

describe("F. professional passport and qualifications ownership (phase 1)", () => {
  it("a professional edits their own passport fields and nothing privileged", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const name = await tx.query<{ display_name: string }>(
        "update public.profiles set display_name = 'Technician Delta II' where id = $1 returning display_name",
        [SEED.delta],
      );
      expect(name.rows[0]?.display_name).toBe("Technician Delta II");
      const tech = await tx.query<{ years_experience: number; visibility: string }>(
        `update public.technician_profiles
         set base_location = 'Valencia (VLC)', mobility = 'national', years_experience = 13,
             current_status = 'between_contracts', visibility = 'open'
         where profile_id = $1 returning years_experience, visibility`,
        [SEED.delta],
      );
      expect(tech.rows[0]).toEqual({ years_experience: 13, visibility: "open" });
      expect(
        await queryError(
          tx,
          "update public.profiles set platform_role = 'platform_admin' where id = $1",
          [SEED.delta],
        ),
      ).toMatch(/permission denied/);
      expect(
        await queryError(
          tx,
          "update public.profiles set account_type = 'organization' where id = $1",
          [SEED.delta],
        ),
      ).toMatch(/permission denied/);
      expect(
        await queryError(
          tx,
          "update public.technician_profiles set years_experience = 61 where profile_id = $1",
          [SEED.delta],
        ),
      ).toMatch(/check constraint/);
    });
  });

  it("professional B cannot edit A's passport (no rows affected, no error oracle)", async () => {
    await asUser(db, SEED.echo, async (tx) => {
      const name = await tx.query(
        "update public.profiles set display_name = 'Mallory' where id = $1 returning id",
        [SEED.delta],
      );
      expect(name.rows).toEqual([]);
      const tech = await tx.query(
        "update public.technician_profiles set visibility = 'open' where profile_id = $1 returning profile_id",
        [SEED.delta],
      );
      expect(tech.rows).toEqual([]);
    });
    await asUser(db, SEED.delta, async (tx) => {
      const { rows } = await tx.query<{ display_name: string; visibility: string }>(
        `select p.display_name, t.visibility from public.profiles p
         join public.technician_profiles t on t.profile_id = p.id where p.id = $1`,
        [SEED.delta],
      );
      expect(rows[0]).toEqual({ display_name: "Technician Delta", visibility: "anonymous" });
    });
  });

  it("a professional declares, re-dates, withdraws and removes their own qualification", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const created = await tx.query<{ id: string; verification_status: string; status: string }>(
        `insert into public.technician_qualifications (technician_profile_id, qualification_type_id, issued_at, expires_at)
         select $1, id, date '2024-01-01', date '2030-01-01' from public.qualification_types where code = 'B2'
         returning id, verification_status, status`,
        [SEED.delta],
      );
      const id = created.rows[0]!.id;
      expect(created.rows[0]).toMatchObject({ verification_status: "pending", status: "active" });

      const dated = await tx.query<{ expires_at: string; verification_status: string }>(
        "update public.technician_qualifications set expires_at = date '2031-01-01' where id = $1 returning expires_at, verification_status",
        [id],
      );
      expect(dated.rows[0]?.verification_status).toBe("pending");

      const withdrawn = await tx.query<{ status: string }>(
        "update public.technician_qualifications set status = 'withdrawn' where id = $1 returning status",
        [id],
      );
      expect(withdrawn.rows[0]?.status).toBe("withdrawn");

      expect(
        await queryError(
          tx,
          "update public.technician_qualifications set verification_status = 'verified' where id = $1",
          [id],
        ),
      ).toMatch(/permission denied/);

      const removed = await tx.query(
        "delete from public.technician_qualifications where id = $1 returning id",
        [id],
      );
      expect(removed.rows).toHaveLength(1);
    });
  });

  it("withdrawing and re-activating keeps the review state; changing dates resets it", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const fts = (
        await tx.query<{ id: string; verification_status: string }>(
          `select q.id, q.verification_status from public.technician_qualifications q
           join public.qualification_types t on t.id = q.qualification_type_id
           where q.technician_profile_id = $1 and t.code = 'FTS'`,
          [SEED.delta],
        )
      ).rows[0]!;
      expect(fts.verification_status).toBe("verified");
      const toggled = await tx.query<{ verification_status: string }>(
        "update public.technician_qualifications set status = 'withdrawn' where id = $1 returning verification_status",
        [fts.id],
      );
      expect(toggled.rows[0]?.verification_status).toBe("verified");
      const back = await tx.query<{ verification_status: string }>(
        "update public.technician_qualifications set status = 'active' where id = $1 returning verification_status",
        [fts.id],
      );
      expect(back.rows[0]?.verification_status).toBe("verified");
      const redated = await tx.query<{ verification_status: string }>(
        "update public.technician_qualifications set issued_at = date '2021-01-01' where id = $1 returning verification_status",
        [fts.id],
      );
      expect(redated.rows[0]?.verification_status).toBe("pending");
    });
  });

  it("professional B cannot read, edit, withdraw or delete A's qualifications nor declare for A", async () => {
    const aQualification = (
      await db.query<{ id: string }>(
        "select id from public.technician_qualifications where technician_profile_id = $1 limit 1",
        [SEED.delta],
      )
    ).rows[0]!.id;
    await asUser(db, SEED.echo, async (tx) => {
      expect(
        await rowCount(tx, "select id from public.technician_qualifications where id = $1", [
          aQualification,
        ]),
      ).toBe(0);
      const edited = await tx.query(
        "update public.technician_qualifications set status = 'withdrawn', expires_at = null where id = $1 returning id",
        [aQualification],
      );
      expect(edited.rows).toEqual([]);
      const deleted = await tx.query(
        "delete from public.technician_qualifications where id = $1 returning id",
        [aQualification],
      );
      expect(deleted.rows).toEqual([]);
      expect(
        await queryError(
          tx,
          `insert into public.technician_qualifications (technician_profile_id, qualification_type_id, expires_at)
           select $1, id, date '2030-01-01' from public.qualification_types where code = 'NDT-UT2'`,
          [SEED.delta],
        ),
      ).toMatch(/row-level security/);
    });
  });

  it("organization admins see a member's qualifications but cannot edit them", async () => {
    const alphaQualification = (
      await db.query<{ id: string }>(
        "select id from public.technician_qualifications where technician_profile_id = $1 limit 1",
        [SEED.alpha],
      )
    ).rows[0]!.id;
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(
        await rowCount(tx, "select id from public.technician_qualifications where id = $1", [
          alphaQualification,
        ]),
      ).toBe(1);
      const edited = await tx.query(
        "update public.technician_qualifications set expires_at = date '2099-01-01' where id = $1 returning id",
        [alphaQualification],
      );
      expect(edited.rows).toEqual([]);
      expect(
        await queryError(
          tx,
          "update public.technician_qualifications set verification_status = 'verified' where id = $1",
          [alphaQualification],
        ),
      ).toMatch(/permission denied/);
    });
  });
});

describe("G. language preference (phase 1.5)", () => {
  it("any user updates their own preferred_locale; invalid values are rejected", async () => {
    for (const user of [SEED.delta, SEED.adminMro]) {
      await asUser(db, user, async (tx) => {
        const { rows } = await tx.query<{ preferred_locale: string }>(
          "update public.profiles set preferred_locale = 'es' where id = $1 returning preferred_locale",
          [user],
        );
        expect(rows[0]?.preferred_locale).toBe("es");
        expect(
          await queryError(tx, "update public.profiles set preferred_locale = 'fr' where id = $1", [
            user,
          ]),
        ).toMatch(/check constraint/);
      });
    }
  });

  it("a user cannot change another user's language", async () => {
    await asUser(db, SEED.echo, async (tx) => {
      const { rows } = await tx.query(
        "update public.profiles set preferred_locale = 'es' where id = $1 returning id",
        [SEED.delta],
      );
      expect(rows).toEqual([]);
    });
    const { rows } = await db.query<{ preferred_locale: string | null }>(
      "select preferred_locale from public.profiles where id = $1",
      [SEED.delta],
    );
    expect(rows[0]?.preferred_locale).toBeNull();
  });
});

describe("E. identity cannot be supplied by the caller", () => {
  it("requirements cannot be created on behalf of another user", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(
        await queryError(
          tx,
          `insert into public.work_requirements (organization_id, title, location, starts_at, ends_at, headcount, created_by)
           values ($1, 'Impersonated', 'MAD', now(), now() + interval '1 day', 1, $2)`,
          [mroId, SEED.charlieMember],
        ),
      ).toMatch(/row-level security/);
    });
  });

  it("create_work_requirement records the JWT subject as creator", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const types = await tx.query<{ id: string }>(
        "select id from public.qualification_types where code = 'B1.1'",
      );
      const created = await tx.query<{ id: string }>(
        `select public.create_work_requirement($1, 'Engine change support', 'MAD', now(), now() + interval '2 days',
           'night', 1, 'aog', $2::jsonb) as id`,
        [
          mroId,
          JSON.stringify([{ qualification_type_id: types.rows[0]?.id, requirement_level: "hard" }]),
        ],
      );
      const { rows } = await tx.query<{ created_by: string }>(
        "select created_by from public.work_requirements where id = $1",
        [created.rows[0]?.id],
      );
      expect(rows[0]?.created_by).toBe(SEED.adminMro);
    });
  });
});

describe("candidate enumeration and data minimization", () => {
  // R-11 (docs/integration/crewflex-v13/03-business-rule-conflicts.md): the external pool is
  // capped at 100 before the engine runs. Candidates that already hold the hard qualifications
  // (verified first) must be selected before soft-only holders, whatever their uuid.
  it("the capped external pool keeps the strongest candidates, not the lowest uuids", async () => {
    const strong = "ffffffff-0000-4000-8000-000000000999";
    await asUser(db, SEED.adminMro, async (tx) => {
      await tx.exec("reset role");
      for (let i = 0; i < 101; i++) {
        const id = `00000000-0000-4000-8000-${String(900000000000 + i)}`;
        await tx.query(
          `insert into auth.users (id, email, raw_user_meta_data)
           values ($1, $2, '{"account_type":"professional","display_name":"Decoy"}')`,
          [id, `decoy${i}@crewflex.test`],
        );
        await tx.query(
          "update public.technician_profiles set visibility = 'anonymous' where profile_id = $1",
          [id],
        );
        await tx.query(
          `insert into public.technician_qualifications (technician_profile_id, qualification_type_id, expires_at)
           select $1, id, date '2030-01-01' from public.qualification_types where code = 'SMS'`,
          [id],
        );
      }
      await tx.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         values ($1, 'strong@crewflex.test', '{"account_type":"professional","display_name":"Strong"}')`,
        [strong],
      );
      await tx.query(
        "update public.technician_profiles set visibility = 'anonymous' where profile_id = $1",
        [strong],
      );
      await tx.query(
        `insert into public.technician_qualifications
           (technician_profile_id, qualification_type_id, expires_at, verification_status)
         select $1, wrq.qualification_type_id, date '2030-01-01', 'verified'
         from public.work_requirement_qualifications wrq
         where wrq.work_requirement_id = $2 and wrq.requirement_level = 'hard'`,
        [strong, madRequirementId],
      );
      await tx.exec("set local role authenticated");

      const { rows } = await tx.query<{ candidate_ref: string; candidate_pool: string }>(
        "select candidate_ref, candidate_pool from public.get_requirement_candidate_pool($1)",
        [madRequirementId],
      );
      const external = rows.filter((r) => r.candidate_pool === "external");
      const strongRef =
        "CF-" +
        createHash("sha256")
          .update(`${madRequirementId}:${strong}`)
          .digest("hex")
          .slice(0, 10)
          .toUpperCase();
      expect(external).toHaveLength(100);
      expect(external.map((r) => r.candidate_ref)).toContain(strongRef);
    });
  });

  it("organizations cannot list the professional network directly", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const { rows } = await tx.query<{ profile_id: string }>(
        "select profile_id from public.technician_profiles",
      );
      // Only the internal workforce (members of the organization) is visible.
      expect(rows.map((r) => r.profile_id).sort()).toEqual(
        [SEED.alpha, SEED.bravo, SEED.charlieMember, SEED.managerMro].sort(),
      );
    });
  });

  it("the candidate pool excludes private profiles and hides anonymous identities", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const { rows } = await tx.query<{
        candidate_ref: string;
        candidate_pool: string;
        candidate_display_name: string | null;
        candidate_qualifications: { code: string }[];
      }>("select * from public.get_requirement_candidate_pool($1)", [madRequirementId]);

      const internal = rows.filter((r) => r.candidate_pool === "internal");
      const external = rows.filter((r) => r.candidate_pool === "external");
      // Seed: internal = Alpha, Bravo, Charlie, Ops Manager; external = every anonymous/open
      // technician holding at least one relevant active qualification (Hotel is private).
      expect(internal).toHaveLength(4);
      expect(external).toHaveLength(10);
      expect(rows.some((r) => r.candidate_ref === SEED.hotelPrivate)).toBe(false);
      for (const candidate of external) {
        expect(candidate.candidate_ref).toMatch(/^CF-[0-9A-F]{10}$/);
      }
      const named = external.filter((r) => r.candidate_display_name !== null);
      expect(named.map((r) => r.candidate_display_name).sort()).toEqual([
        "Technician Echo",
        "Technician Juliett",
        "Technician Quebec",
      ]);
      // Only qualifications relevant to the requirement are exposed.
      const relevant = new Set(["B1.1", "TR-A320", "EWIS", "HF", "FTS", "SMS"]);
      for (const candidate of rows) {
        for (const q of candidate.candidate_qualifications) expect(relevant.has(q.code)).toBe(true);
      }
    });
  });
});

describe("audit", () => {
  it("records requirement.created and cannot be written by API roles", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const { rows } = await tx.query<{ action: string }>(
        "select action from public.audit_events where entity_id = $1",
        [madRequirementId],
      );
      expect(rows).toEqual([{ action: "requirement.created" }]);
      expect(
        await queryError(
          tx,
          "insert into public.audit_events (action, entity_type) values ('requirement.created', 'x')",
        ),
      ).toMatch(/permission denied/);
      expect(await queryError(tx, "delete from public.audit_events")).toMatch(/permission denied/);
    });
  });

  it("other organizations cannot read the audit trail", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      expect(
        await rowCount(tx, "select * from public.audit_events where organization_id = $1", [mroId]),
      ).toBe(0);
    });
  });

  it("records qualification.verified when a verifier verifies", async () => {
    const { rows } = await db.query<{ id: string }>(
      `update public.technician_qualifications set verification_status = 'verified'
       where technician_profile_id = '00000000-0000-4000-8000-000000000024'
         and qualification_type_id = (select id from public.qualification_types where code = 'B1.1')
       returning id`,
    );
    const audit = await db.query<{ action: string }>(
      "select action from public.audit_events where entity_id = $1",
      [rows[0]?.id],
    );
    // A verifier-only status change is audited as verified, never as a profile edit.
    expect(audit.rows).toContainEqual({ action: "qualification.verified" });
    expect(audit.rows).not.toContainEqual({ action: "qualification.updated" });
  });
});

describe("trigger-only SECURITY DEFINER functions (F1b, migration 20261026100000)", () => {
  const TRIGGER_FUNCTIONS = [
    "public.handle_new_user()",
    "public.audit_requirement_created()",
    "public.audit_qualification_verified()",
  ];

  it("no API role holds EXECUTE (Security Advisor finding closed)", async () => {
    for (const fn of TRIGGER_FUNCTIONS) {
      const { rows } = await db.query<{ anon: boolean; auth: boolean }>(
        `select has_function_privilege('anon', $1, 'execute') as anon,
                has_function_privilege('authenticated', $1, 'execute') as auth`,
        [fn],
      );
      expect(rows[0], fn).toEqual({ anon: false, auth: false });
    }
  });

  it("a direct call is refused for authenticated and anon", async () => {
    for (const userId of [SEED.alpha, null]) {
      await asUser(db, userId, async (tx) => {
        for (const fn of TRIGGER_FUNCTIONS) {
          expect(await queryError(tx, `select ${fn}`), fn).toMatch(
            /permission denied for function/,
          );
        }
      });
    }
  });

  it("sign-up still creates the profile when auth.users is written by a role without EXECUTE", async () => {
    // Stand-in for GoTrue's supabase_auth_admin: may insert users, holds no EXECUTE on the trigger function.
    await db.exec(`create role auth_admin_stand_in nologin;
      grant usage on schema auth to auth_admin_stand_in;
      grant insert on auth.users to auth_admin_stand_in;`);
    const { rows: grant } = await db.query<{ can: boolean }>(
      "select has_function_privilege('auth_admin_stand_in', 'public.handle_new_user()', 'execute') as can",
    );
    expect(grant[0]?.can).toBe(false);
    const id = randomUUID();
    await db.transaction(async (tx) => {
      await tx.exec("set local role auth_admin_stand_in");
      await tx.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         values ($1, 'f1b@crewflex.test', '{"account_type":"professional","display_name":"F1b"}')`,
        [id],
      );
    });
    const { rows } = await db.query<{ account_type: string; technician: boolean }>(
      `select p.account_type, exists (select 1 from public.technician_profiles t where t.profile_id = p.id) as technician
       from public.profiles p where p.id = $1`,
      [id],
    );
    expect(rows).toEqual([{ account_type: "professional", technician: true }]);
  });

  it("an organization admin's new requirement is still audited (trigger fires under authenticated)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const types = await tx.query<{ id: string }>(
        "select id from public.qualification_types where code = 'B1.1'",
      );
      const created = await tx.query<{ id: string }>(
        `select public.create_work_requirement($1, 'F1b audit check', 'MAD', now(), now() + interval '2 days',
           'day', 1, 'planned', $2::jsonb) as id`,
        [
          mroId,
          JSON.stringify([{ qualification_type_id: types.rows[0]?.id, requirement_level: "hard" }]),
        ],
      );
      const { rows } = await tx.query<{ action: string; actor_profile_id: string }>(
        "select action, actor_profile_id from public.audit_events where entity_id = $1",
        [created.rows[0]?.id],
      );
      expect(rows).toEqual([{ action: "requirement.created", actor_profile_id: SEED.adminMro }]);
    });
  });
});

describe("F1c: the other eight advisor DEFINER functions stay callable and answer only for the caller", () => {
  // Kept on purpose (AUTHORIZATION.md «SECURITY DEFINER functions executable by authenticated»): four RLS
  // helpers evaluated inside policies as the caller, four RPCs the Edge Functions call with the caller's JWT.
  const KEPT = [
    "public.can_view_member(uuid)",
    "public.get_requirement_candidate_pool(uuid)",
    "public.get_requirement_external_pool_summary(uuid)",
    "public.has_org_role(uuid, public.organization_role[])",
    "public.is_org_member(uuid)",
    "public.is_platform_admin()",
    "public.own_qualification_reviews()",
    "public.review_qualification(uuid, public.verification_status, timestamptz, text, uuid)",
  ];
  const ask = (userId: string, sql: string, params: unknown[] = []) =>
    asUser(db, userId, async (tx) => (await tx.query<{ v: boolean }>(sql, params)).rows[0]?.v);

  it("grants pinned: authenticated may execute, anon may not", async () => {
    for (const fn of KEPT) {
      const { rows } = await db.query<{ anon: boolean; auth: boolean }>(
        `select has_function_privilege('anon', $1, 'execute') as anon,
                has_function_privilege('authenticated', $1, 'execute') as auth`,
        [fn],
      );
      expect(rows[0], fn).toEqual({ anon: false, auth: true });
    }
    await asUser(db, null, async (tx) => {
      expect(await queryError(tx, "select public.is_platform_admin()")).toMatch(
        /permission denied for function/,
      );
    });
  });

  it("has_org_role / is_org_member describe the caller's own membership, never someone else's", async () => {
    const admin = "select public.has_org_role($1, array['admin']::public.organization_role[]) as v";
    expect(await ask(SEED.adminMro, admin, [mroId])).toBe(true);
    expect(await ask(SEED.adminOther, admin, [mroId])).toBe(false);
    expect(await ask(SEED.alpha, admin, [mroId])).toBe(false);
    const member = "select public.is_org_member($1) as v";
    expect(await ask(SEED.alpha, member, [mroId])).toBe(true);
    expect(await ask(SEED.adminOther, member, [mroId])).toBe(false);
  });

  it("is_platform_admin is true for the platform admin only", async () => {
    const sql = "select public.is_platform_admin() as v";
    expect(await ask(SEED.platformAdmin, sql)).toBe(true);
    expect(await ask(SEED.adminMro, sql)).toBe(false);
  });

  it("can_view_member: an admin or manager of the member's own organization, nobody else", async () => {
    const sql = "select public.can_view_member($1) as v";
    expect(await ask(SEED.adminMro, sql, [SEED.alpha])).toBe(true);
    expect(await ask(SEED.managerMro, sql, [SEED.alpha])).toBe(true);
    expect(await ask(SEED.bravo, sql, [SEED.alpha])).toBe(false); // plain colleague
    expect(await ask(SEED.adminOther, sql, [SEED.alpha])).toBe(false); // other organization
  });

  it("pool and summary: an unknown requirement and another organization's give the same 42501 (no existence oracle)", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      for (const fn of [
        "get_requirement_candidate_pool",
        "get_requirement_external_pool_summary",
      ]) {
        for (const id of [madRequirementId, randomUUID()]) {
          expect(await queryError(tx, `select * from public.${fn}($1)`, [id]), fn).toMatch(
            /^not authorized$/,
          );
        }
      }
    });
  });
});

describe("I. integrity backstops in the database (phase 0.8)", () => {
  async function auditActions(tx: Transaction, entityId: string) {
    await tx.exec("reset role");
    const { rows } = await tx.query<{ action: string; actor_profile_id: string | null }>(
      "select action, actor_profile_id from public.audit_events where entity_id = $1",
      [entityId],
    );
    return rows;
  }

  it("a qualification's type cannot be swapped after declaration, even directly", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      expect(
        await queryError(
          tx,
          `update public.technician_qualifications
           set qualification_type_id = (select id from public.qualification_types where code = 'B2')
           where technician_profile_id = $1`,
          [SEED.delta],
        ),
      ).toMatch(/permission denied/);
    });
  });

  it("nobody can self-insert a technician profile (only the sign-up trigger creates it)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(
        await queryError(
          tx,
          "insert into public.technician_profiles (profile_id, visibility) values ($1, 'open')",
          [SEED.adminMro],
        ),
      ).toMatch(/permission denied/);
    });
  });

  it("BR-2.7: an active qualification whose type requires expiry must carry one", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      expect(
        await queryError(
          tx,
          `insert into public.technician_qualifications (technician_profile_id, qualification_type_id)
           select $1, id from public.qualification_types where code = 'B2'`,
          [SEED.delta],
        ),
      ).toMatch(/expiry date required/);
    });
    await asUser(db, SEED.delta, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into public.technician_qualifications (technician_profile_id, qualification_type_id, expires_at)
         select $1, id, date '2030-01-01' from public.qualification_types where code = 'B2'
         returning id`,
        [SEED.delta],
      );
      expect(
        await queryError(
          tx,
          "update public.technician_qualifications set expires_at = null where id = $1",
          [rows[0]!.id],
        ),
      ).toMatch(/expiry date required/);
    });
    // Types without required expiry (type ratings, skills) accept a null expiry.
    await asUser(db, SEED.delta, async (tx) => {
      const { rows } = await tx.query<{ expires_at: string | null }>(
        `insert into public.technician_qualifications (technician_profile_id, qualification_type_id)
         select $1, t.id from public.qualification_types t
         where not t.requires_expiry
           and not exists (select 1 from public.technician_qualifications q
                           where q.technician_profile_id = $1 and q.qualification_type_id = t.id)
         order by t.code limit 1
         returning expires_at`,
        [SEED.delta],
      );
      expect(rows).toEqual([{ expires_at: null }]);
    });
  });

  it("availability windows longer than 366 days are rejected by the database", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      expect(
        await queryError(
          tx,
          `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
           values ($1, '2026-11-01 00:00Z', '2027-11-03 00:00Z', 'available')`,
          [SEED.delta],
        ),
      ).toMatch(/availability_windows_max_366_days/);
    });
  });

  it("audits the owner's declare, re-date and removal; a re-dated verified row returns to pending", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const created = await tx.query<{ id: string }>(
        `insert into public.technician_qualifications (technician_profile_id, qualification_type_id, expires_at)
         select $1, id, date '2030-01-01' from public.qualification_types where code = 'B2'
         returning id`,
        [SEED.delta],
      );
      const id = created.rows[0]!.id;
      await tx.query(
        "update public.technician_qualifications set expires_at = date '2031-01-01' where id = $1",
        [id],
      );
      await tx.query("delete from public.technician_qualifications where id = $1", [id]);
      const actions = await auditActions(tx, id);
      expect(actions).toHaveLength(3);
      expect(actions).toEqual(
        expect.arrayContaining([
          { action: "qualification.created", actor_profile_id: SEED.delta },
          { action: "qualification.updated", actor_profile_id: SEED.delta },
          { action: "qualification.removed", actor_profile_id: SEED.delta },
        ]),
      );
    });
    await asUser(db, SEED.delta, async (tx) => {
      const fts = await tx.query<{ id: string }>(
        `update public.technician_qualifications set expires_at = expires_at + 1
         where technician_profile_id = $1
           and qualification_type_id = (select id from public.qualification_types where code = 'FTS')
         returning id`,
        [SEED.delta],
      );
      const id = fts.rows[0]!.id;
      await tx.exec("reset role");
      const { rows } = await tx.query<{ metadata: Record<string, string> }>(
        "select metadata from public.audit_events where entity_id = $1 and action = 'qualification.updated'",
        [id],
      );
      expect(rows[0]?.metadata).toMatchObject({
        previous_verification_status: "verified",
        verification_status: "pending",
      });
    });
  });

  it("professionals cannot read the audit trail of their own qualifications (admin-only)", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      expect(
        await rowCount(tx, "select * from public.audit_events where action like 'qualification.%'"),
      ).toBe(0);
    });
  });
});

describe("availability windows ownership (first vertical slice)", () => {
  const window = (owner: string): [string, string[]] => [
    `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
       values ($1, '2026-11-10 00:00Z', '2026-11-11 00:00Z', 'available') returning id`,
    [owner],
  ];

  it("a professional can create, read, update and delete their own windows", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const created = await tx.query<{ id: string }>(...window(SEED.delta));
      const id = created.rows[0]?.id;
      expect(id).toBeTruthy();
      const updated = await tx.query(
        "update public.availability_windows set status = 'unavailable' where id = $1",
        [id],
      );
      expect(updated.affectedRows).toBe(1);
      const deleted = await tx.query("delete from public.availability_windows where id = $1", [id]);
      expect(deleted.affectedRows).toBe(1);
    });
  });

  it("A. a professional cannot read, update or delete another professional's windows", async () => {
    const { rows } = await db.query<{ id: string }>(
      "select id from public.availability_windows where technician_profile_id = $1 limit 1",
      [SEED.echo],
    );
    const echoWindow = rows[0]?.id;
    expect(echoWindow).toBeTruthy();
    await asUser(db, SEED.delta, async (tx) => {
      expect(
        await rowCount(tx, "select * from public.availability_windows where id = $1", [echoWindow]),
      ).toBe(0);
      const update = await tx.query(
        "update public.availability_windows set status = 'unavailable' where id = $1",
        [echoWindow],
      );
      expect(update.affectedRows).toBe(0);
      const del = await tx.query("delete from public.availability_windows where id = $1", [
        echoWindow,
      ]);
      expect(del.affectedRows).toBe(0);
    });
  });

  it("E. a professional cannot create windows on behalf of another professional", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      expect(await queryError(tx, ...window(SEED.echo))).toMatch(/row-level security/);
    });
  });

  it("organization admins only see windows of their own members", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const { rows } = await tx.query<{ technician_profile_id: string }>(
        "select distinct technician_profile_id from public.availability_windows",
      );
      const owners = rows.map((r) => r.technician_profile_id).sort();
      expect(owners).toEqual([SEED.alpha, SEED.bravo, SEED.charlieMember].sort());
    });
  });

  it("the database rejects windows that end before they start", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      expect(
        await queryError(
          tx,
          `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
           values ($1, '2026-11-11 00:00Z', '2026-11-10 00:00Z', 'available')`,
          [SEED.delta],
        ),
      ).toMatch(/check constraint/);
    });
  });
});

describe("J. BR-1.4 invariant in the database (E-3, migration 20261015130000)", () => {
  // The check is a DEFERRED constraint trigger: it runs at commit. asUser() always rolls back, so
  // each test forces the pending checks with SET CONSTRAINTS ALL IMMEDIATE (same code path).
  const commitCheck = "set constraints all immediate";
  const HARD_MISSING = /at least one hard qualification/;
  const typeId = async (tx: Transaction, code: string) =>
    (
      await tx.query<{ id: string }>("select id from public.qualification_types where code = $1", [
        code,
      ])
    ).rows[0]!.id;
  const hardCount = async (tx: { query: PGlite["query"] }, requirementId: string) =>
    (
      await tx.query<{ n: number }>(
        `select count(*)::int as n from public.work_requirement_qualifications
         where work_requirement_id = $1 and requirement_level = 'hard'`,
        [requirementId],
      )
    ).rows[0]!.n;

  it("1. the RPC creates a valid requirement (parent + children in one transaction)", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const b11 = await typeId(tx, "B1.1");
      const sms = await typeId(tx, "SMS");
      await tx.query(
        `select public.create_work_requirement($1, 'Valid need', 'MAD', now(), now() + interval '2 days',
           'day', 1, 'planned', $2::jsonb)`,
        [
          mroId,
          JSON.stringify([
            { qualification_type_id: b11, requirement_level: "hard" },
            { qualification_type_id: sms, requirement_level: "soft" },
          ]),
        ],
      );
      await tx.exec(commitCheck);
    });
  });

  it("2. a direct PostgREST insert of an open requirement without qualifications is rejected", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      await tx.query(
        `insert into public.work_requirements (organization_id, title, location, starts_at, ends_at, headcount, created_by)
         values ($1, 'No quals', 'MAD', now(), now() + interval '1 day', 1, $2)`,
        [mroId, SEED.managerMro],
      );
      expect(await queryError(tx, commitCheck)).toMatch(HARD_MISSING);
    });
  });

  it("2b. a soft-only requirement is rejected", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into public.work_requirements (organization_id, title, location, starts_at, ends_at, headcount, created_by)
         values ($1, 'Soft only', 'MAD', now(), now() + interval '1 day', 1, $2) returning id`,
        [mroId, SEED.managerMro],
      );
      await tx.query(
        `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
         values ($1, $2, 'soft')`,
        [rows[0]!.id, await typeId(tx, "SMS")],
      );
      expect(await queryError(tx, commitCheck)).toMatch(HARD_MISSING);
    });
  });

  it("3. deleting the last hard qualifications directly is rejected (soft ones remain)", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const { rows } = await tx.query(
        `delete from public.work_requirement_qualifications
         where work_requirement_id = $1 and requirement_level = 'hard' returning id`,
        [madRequirementId],
      );
      expect(rows.length).toBe(5);
      expect(await queryError(tx, commitCheck)).toMatch(HARD_MISSING);
    });
    // 12. the failed transaction rolled back: nothing was lost.
    expect(await hardCount(db, madRequirementId)).toBe(5);
  });

  it("4. converting the last hard qualifications to soft (delete + insert) is rejected", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await tx.query(
        "delete from public.work_requirement_qualifications where work_requirement_id = $1",
        [lisRequirementId],
      );
      await tx.query(
        `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
         values ($1, $2, 'soft'), ($1, $3, 'soft')`,
        [lisRequirementId, await typeId(tx, "B2"), await typeId(tx, "TR-A330")],
      );
      expect(await queryError(tx, commitCheck)).toMatch(HARD_MISSING);
    });
  });

  it("5. swapping one hard qualification for another in one transaction is allowed", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await tx.query(
        "delete from public.work_requirement_qualifications where work_requirement_id = $1",
        [lisRequirementId],
      );
      await tx.query(
        `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
         values ($1, $2, 'hard'), ($1, $3, 'soft')`,
        [lisRequirementId, await typeId(tx, "B2"), await typeId(tx, "TR-A330")],
      );
      await tx.exec(commitCheck);
      expect(await hardCount(tx, lisRequirementId)).toBe(1);
    });
  });

  it("6. editing other fields of a valid requirement keeps working", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      await tx.query(
        // M05: `covered` is no longer set by hand (it comes with D-06 confirmations); pause instead.
        "update public.work_requirements set title = 'Renamed need', status = 'paused' where id = $1",
        [madRequirementId],
      );
      await tx.exec(commitCheck);
    });
  });

  it("7. a draft may be incomplete, but it cannot leave draft without a hard qualification", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into public.work_requirements (organization_id, title, location, starts_at, ends_at, headcount, status, created_by)
         values ($1, 'Draft need', 'MAD', now(), now() + interval '1 day', 1, 'draft', $2) returning id`,
        [mroId, SEED.managerMro],
      );
      await tx.exec(commitCheck);
      await tx.exec("set constraints all deferred");
      await tx.query("update public.work_requirements set status = 'open' where id = $1", [
        rows[0]!.id,
      ]);
      expect(await queryError(tx, commitCheck)).toMatch(HARD_MISSING);
    });
  });

  it("9-10. members and other organizations' admins cannot touch the qualifications at all", async () => {
    for (const user of [SEED.charlieMember, SEED.adminOther]) {
      await asUser(db, user, async (tx) => {
        const { rows } = await tx.query(
          "delete from public.work_requirement_qualifications where work_requirement_id = $1 returning id",
          [madRequirementId],
        );
        expect(rows).toHaveLength(0);
        await tx.exec(commitCheck);
      });
    }
    expect(await hardCount(db, madRequirementId)).toBe(5);
  });

  it("caps a requirement at 20 qualifications even when inserted directly", async () => {
    await db.transaction(async (owner) => {
      await owner.exec(`insert into public.qualification_types (code, name, category)
        select 'ZZ-' || g, 'Synthetic type ' || g, 'SKILL' from generate_series(1, 20) g`);
      await owner.query(
        `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
         select $1, id, 'soft' from public.qualification_types where code like 'ZZ-%'`,
        [madRequirementId],
      );
      expect(await queryError(owner, commitCheck)).toMatch(/at most 20 qualifications/);
      await owner.rollback();
    });
  });

  // M05 (owner 2026-10-22): nothing moves into `cancelled` any more; `closed` is how a need ends.
  it("L1: a legacy requirement without hard qualifications can still be closed, and stays closed", async () => {
    await db.transaction(async (owner) => {
      // A row that predates the invariant: created as a draft, opened with the trigger disabled.
      const { rows } = await owner.query<{ id: string }>(
        `insert into public.work_requirements (organization_id, title, location, starts_at, ends_at, headcount, status, created_by)
         values ($1, 'Legacy need', 'MAD', now(), now() + interval '1 day', 1, 'draft', $2) returning id`,
        [mroId, SEED.adminMro],
      );
      await owner.exec(commitCheck); // flush the insert's pending check before ALTER TABLE
      await owner.exec("set constraints all deferred");
      await owner.exec(
        "alter table public.work_requirements disable trigger work_requirements_qualification_invariant",
      );
      await owner.query("update public.work_requirements set status = 'open' where id = $1", [
        rows[0]!.id,
      ]);
      await owner.exec(
        "alter table public.work_requirements enable trigger work_requirements_qualification_invariant",
      );
      await owner.exec(commitCheck);
      await owner.exec("set constraints all deferred");
      await owner.query("update public.work_requirements set status = 'closed' where id = $1", [
        rows[0]!.id,
      ]);
      await owner.exec(commitCheck); // closing is always possible
      expect(
        await queryError(
          owner,
          "update public.work_requirements set status = 'open' where id = $1",
          [rows[0]!.id],
        ),
      ).toMatch(/cannot be (reopened|changed)/); // the frozen-closed trigger fires first
      await owner.rollback();
    });
  });

  it("13. the seed holds no historical requirement that violates BR-1.4", async () => {
    const { rows } = await db.query(
      `select wr.id from public.work_requirements wr
       where wr.status <> 'draft' and not exists (
         select 1 from public.work_requirement_qualifications q
         where q.work_requirement_id = wr.id and q.requirement_level = 'hard')`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe("K. atomic passport save (I-3, migration 20261015130100)", () => {
  const call = `select public.update_professional_profile($1, $2, $3::public.mobility, $4, $5::public.technician_status,
    $6::public.profile_visibility, $7::timestamptz) as updated_at`;
  const snapshot = async (tx: { query: PGlite["query"] }, id: string) =>
    (
      await tx.query<Record<string, unknown>>(
        `select p.display_name, tp.base_location, tp.mobility, tp.years_experience, tp.current_status, tp.visibility
         from public.technician_profiles tp join public.profiles p on p.id = tp.profile_id where tp.profile_id = $1`,
        [id],
      )
    ).rows[0];

  it("saves both tables in one call and returns the new version", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const { rows } = await tx.query<{ updated_at: string }>(call, [
        "Delta renamed",
        "Valencia (VLC)",
        "international",
        9,
        "contractor",
        "open",
        null,
      ]);
      expect(rows[0]?.updated_at).toBeTruthy();
      expect(await snapshot(tx, SEED.delta)).toEqual({
        display_name: "Delta renamed",
        base_location: "Valencia (VLC)",
        mobility: "international",
        years_experience: 9,
        current_status: "contractor",
        visibility: "open",
      });
    });
  });

  it("a failure in the first write (technician_profiles) saves nothing", async () => {
    const before = await snapshot(db, SEED.delta);
    await asUser(db, SEED.delta, async (tx) => {
      expect(
        await queryError(tx, call, [
          "Delta renamed",
          "VLC",
          "national",
          99,
          "employed",
          "open",
          null,
        ]),
      ).toMatch(/check constraint/);
      expect(await snapshot(tx, SEED.delta)).toEqual(before);
    });
  });

  it("a failure in the second write (profiles.display_name) rolls back the first", async () => {
    const before = await snapshot(db, SEED.delta);
    await asUser(db, SEED.delta, async (tx) => {
      expect(
        await queryError(tx, call, [
          "",
          "Valencia (VLC)",
          "international",
          9,
          "contractor",
          "open",
          null,
        ]),
      ).toMatch(/check constraint/);
      // base_location/mobility/years were valid and written first — the whole call rolled back.
      expect(await snapshot(tx, SEED.delta)).toEqual(before);
    });
  });

  it("a stale expectedUpdatedAt is a conflict and writes nothing; the current one succeeds", async () => {
    const before = await snapshot(db, SEED.delta);
    await asUser(db, SEED.delta, async (tx) => {
      const { rows } = await tx.query<{ v: string }>(
        `select to_char(tp.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as v
         from public.technician_profiles tp
         join public.profiles p on p.id = tp.profile_id where tp.profile_id = $1`,
        [SEED.delta],
      );
      const current = rows[0]!.v;
      expect(
        await queryError(tx, call, [
          "Stale",
          "MAD",
          "local",
          1,
          "employed",
          "private",
          "2020-01-01T00:00:00Z",
        ]),
      ).toMatch(/modified by another session/);
      expect(await snapshot(tx, SEED.delta)).toEqual(before);
      // Same instant at millisecond precision (what the API exposes) is accepted.
      await tx.query(call, ["Fresh", "MAD", "local", 1, "employed", "private", current]);
      expect((await snapshot(tx, SEED.delta))?.display_name).toBe("Fresh");
    });
  });

  it("only ever writes the caller's own passport; organization accounts and anon are refused", async () => {
    const echoBefore = await snapshot(db, SEED.echo);
    await asUser(db, SEED.delta, async (tx) => {
      await tx.query(call, ["Delta", "MAD", "local", 1, "employed", "private", null]);
      await tx.exec("reset role"); // read Echo as the owner, inside the same transaction
      expect(await snapshot(tx, SEED.echo)).toEqual(echoBefore);
    });
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(
        await queryError(tx, call, ["Org", "MAD", "local", 1, "employed", "private", null]),
      ).toMatch(/not authorized/);
    });
    await asUser(db, null, async (tx) => {
      expect(
        await queryError(tx, call, ["Anon", "MAD", "local", 1, "employed", "private", null]),
      ).toMatch(/permission denied/);
    });
  });
});

describe("L. idempotent creates (I-1, migration 20261015130200)", () => {
  const KEY = "6f1c2a52-7b8e-4c1e-9a3f-0d2b5e8c4a11";
  const createReq = `select * from public.create_work_requirement_idempotent($1, $2, $3, 'MAD', '2026-12-01T06:00Z', '2026-12-03T18:00Z',
    'day', 1, 'planned', $4::jsonb)`;
  const quals = async (tx: Transaction, ...codes: [string, "hard" | "soft"][]) => {
    const out = [];
    for (const [code, level] of codes) {
      const { rows } = await tx.query<{ id: string }>(
        "select id from public.qualification_types where code = $1",
        [code],
      );
      out.push({ qualification_type_id: rows[0]!.id, requirement_level: level });
    }
    return JSON.stringify(out);
  };
  const countTitle = async (tx: Transaction, title: string) =>
    (
      await tx.query<{ n: number }>(
        "select count(*)::int as n from public.work_requirements where title = $1",
        [title],
      )
    ).rows[0]!.n;

  it("1-4. a replay with the same key and payload returns the original requirement, no duplicate", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const q = await quals(tx, ["B1.1", "hard"], ["SMS", "soft"]);
      const first = await tx.query<{ id: string; replayed: boolean }>(createReq, [
        KEY,
        mroId,
        "Idem need",
        q,
      ]);
      expect(first.rows[0]?.replayed).toBe(false);
      // Same logical request, qualifications in another order.
      const reordered = JSON.stringify([...JSON.parse(q)].reverse());
      const second = await tx.query<{ id: string; replayed: boolean }>(createReq, [
        KEY,
        mroId,
        "Idem need",
        reordered,
      ]);
      expect(second.rows[0]).toEqual({ id: first.rows[0]!.id, replayed: true });
      expect(await countTitle(tx, "Idem need")).toBe(1);
      await tx.exec("set constraints all immediate"); // E-3 invariant still satisfied
    });
  });

  it("5. the same key with a different payload is a controlled conflict and writes nothing", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const q = await quals(tx, ["B1.1", "hard"]);
      await tx.query(createReq, [KEY, mroId, "Idem need", q]);
      expect(await queryError(tx, createReq, [KEY, mroId, "Idem need CHANGED", q])).toMatch(
        /reused with a different request/,
      );
      expect(await countTitle(tx, "Idem need CHANGED")).toBe(0);
    });
  });

  it("6-7. keys are scoped per actor: another user or organization with the same key is independent", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      await tx.query(createReq, [KEY, mroId, "Idem need", await quals(tx, ["B1.1", "hard"])]);
      await tx.exec("reset role");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: SEED.adminOther, role: "authenticated" }),
      ]);
      await tx.exec("set local role authenticated");
      const other = await tx.query<{ replayed: boolean }>(createReq, [
        KEY,
        otherOrgId,
        "Other org need",
        await quals(tx, ["B2", "hard"]),
      ]);
      expect(other.rows[0]?.replayed).toBe(false);
      // The second actor cannot see the first actor's key row.
      const { rows } = await tx.query("select * from app_private.idempotency_keys");
      expect(rows).toHaveLength(1);
      // …and cannot replay it to read the other organization's requirement.
      expect(
        await queryError(tx, createReq, [
          KEY,
          mroId,
          "Idem need",
          await quals(tx, ["B1.1", "hard"]),
        ]),
      ).toMatch(/reused with a different request/);
    });
  });

  it("9-10. a failed operation leaves no key behind, so a retry with the same key starts clean", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      expect(
        await queryError(tx, createReq, [
          KEY,
          mroId,
          "Idem need",
          await quals(tx, ["SMS", "soft"]),
        ]),
      ).toMatch(/at least one hard qualification/);
      expect(await rowCount(tx, "select * from app_private.idempotency_keys")).toBe(0);
      const ok = await tx.query<{ replayed: boolean }>(createReq, [
        KEY,
        mroId,
        "Idem need",
        await quals(tx, ["B1.1", "hard"]),
      ]);
      expect(ok.rows[0]?.replayed).toBe(false);
    });
  });

  it("permission errors are not swallowed by idempotency (member, other organization)", async () => {
    await asUser(db, SEED.charlieMember, async (tx) => {
      expect(
        await queryError(tx, createReq, [
          KEY,
          mroId,
          "Member need",
          await quals(tx, ["B1.1", "hard"]),
        ]),
      ).toMatch(/row-level security/);
      expect(await rowCount(tx, "select * from app_private.idempotency_keys")).toBe(0);
    });
    await asUser(db, SEED.adminOther, async (tx) => {
      expect(
        await queryError(tx, createReq, [
          KEY,
          mroId,
          "Cross-org need",
          await quals(tx, ["B1.1", "hard"]),
        ]),
      ).toMatch(/row-level security/);
    });
  });

  it("availability windows and declarations replay instead of duplicating or returning 409", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const win = `select * from public.create_availability_window($1, '2027-01-10T00:00Z', '2027-01-12T00:00Z', 'available')`;
      const a = await tx.query<{ id: string; replayed: boolean }>(win, [KEY]);
      const b = await tx.query<{ id: string; replayed: boolean }>(win, [KEY]);
      expect(b.rows[0]).toEqual({ id: a.rows[0]!.id, replayed: true });
      expect(
        await rowCount(
          tx,
          "select * from public.availability_windows where starts_at = '2027-01-10T00:00Z'",
        ),
      ).toBe(1);

      const type = (
        await tx.query<{ id: string }>(
          "select id from public.qualification_types where code = 'NDT-UT2'",
        )
      ).rows[0]!.id;
      const declare = "select * from public.declare_qualification($1, $2, null, '2028-01-31')";
      const KEY2 = "0b7d2c8e-1f4a-4e5b-8c6d-9a0b1c2d3e4f";
      const d1 = await tx.query<{ id: string; replayed: boolean }>(declare, [KEY2, type]);
      const d2 = await tx.query<{ id: string; replayed: boolean }>(declare, [KEY2, type]);
      expect(d2.rows[0]).toEqual({ id: d1.rows[0]!.id, replayed: true });
      const { rows } = await tx.query<{ verification_status: string }>(
        "select verification_status from public.technician_qualifications where id = $1",
        [d1.rows[0]!.id],
      );
      expect(rows[0]?.verification_status).toBe("pending");
      // A different key for the same type is a genuine second declaration → unique violation (409).
      expect(await queryError(tx, declare, ["1c8e9f00-2a3b-4c5d-8e6f-7a8b9c0d1e2f", type])).toMatch(
        /duplicate key/,
      );
    });
  });

  it("the key table is unreachable for anon and has no delete grant", async () => {
    await asUser(db, null, async (tx) => {
      expect(await queryError(tx, "select * from app_private.idempotency_keys")).toMatch(
        /permission denied/,
      );
    });
    await asUser(db, SEED.delta, async (tx) => {
      expect(await queryError(tx, "delete from app_private.idempotency_keys")).toMatch(
        /permission denied/,
      );
    });
  });
});

describe("M. external pool: eligible candidates are never cut by the cap (migration 20261015130300)", () => {
  // MAD need: 2026-10-18 20:00Z → 2026-10-22 06:00Z; hard B1.1, TR-A320, EWIS, HF, FTS; soft SMS.
  const ref = (requirementId: string, profileId: string) =>
    "CF-" +
    createHash("sha256")
      .update(`${requirementId}:${profileId}`)
      .digest("hex")
      .slice(0, 10)
      .toUpperCase();
  const synthId = (block: number, i: number) =>
    `00000000-0000-4000-9${String(block).padStart(3, "0")}-${String(i).padStart(12, "0")}`;

  /** Owner-side bulk creation of anonymous external professionals (inside the test transaction). */
  async function createExternals(
    tx: Transaction,
    ids: string[],
    opts: { expiresAt: string | null; window: [string, string] | null; verified?: boolean },
  ) {
    await tx.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       select id, 'syn-' || id || '@crewflex.test', '{"account_type":"professional","display_name":"Synthetic"}'
       from unnest($1::uuid[]) id`,
      [ids],
    );
    await tx.query(
      "update public.technician_profiles set visibility = 'anonymous' where profile_id = any($1::uuid[])",
      [ids],
    );
    await tx.query(
      `insert into public.technician_qualifications
         (technician_profile_id, qualification_type_id, expires_at, verification_status)
       select p, wrq.qualification_type_id, coalesce($3::date, date '2031-01-01'), $4::public.verification_status
       from unnest($1::uuid[]) p
       cross join public.work_requirement_qualifications wrq
       where wrq.work_requirement_id = $2 and wrq.requirement_level = 'hard'`,
      [ids, madRequirementId, opts.expiresAt, opts.verified === false ? "pending" : "verified"],
    );
    if (opts.window) {
      await tx.query(
        `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
         select p, $2::timestamptz, $3::timestamptz, 'available' from unnest($1::uuid[]) p`,
        [ids, opts.window[0], opts.window[1]],
      );
    }
  }

  async function poolAndSummary(tx: Transaction) {
    await tx.exec("set local role authenticated");
    const pool = await tx.query<{ candidate_ref: string; candidate_pool: string }>(
      "select candidate_ref, candidate_pool from public.get_requirement_candidate_pool($1)",
      [madRequirementId],
    );
    const summary = await tx.query<{ prefiltered: number; hard_eligible: number; cap: number }>(
      "select * from public.get_requirement_external_pool_summary($1)",
      [madRequirementId],
    );
    await tx.exec("reset role");
    return {
      external: pool.rows
        .filter((r) => r.candidate_pool === "external")
        .map((r) => r.candidate_ref),
      summary: summary.rows[0]!,
    };
  }

  const FULL: [string, string] = ["2026-10-01T00:00Z", "2026-11-01T00:00Z"];

  it("an eligible professional last in id order is evaluated although 100 verified decoys fill the cap", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      await tx.exec("reset role");
      // 100 decoys: every hard rating verified (the old ranking key) but FTS & co expire on
      // 2026-10-20, inside the need → ineligible. Plus one fully eligible professional with the
      // highest uuid, i.e. last in every id-based tie-break.
      const baseline = (await poolAndSummary(tx)).summary;
      const decoys = Array.from({ length: 100 }, (_, i) => synthId(1, i));
      await createExternals(tx, decoys, { expiresAt: "2026-10-20", window: FULL });
      const winner = "ffffffff-ffff-4fff-8fff-ffffffffffff";
      await createExternals(tx, [winner], { expiresAt: null, window: FULL });

      const { external, summary } = await poolAndSummary(tx);
      expect(external).toHaveLength(100);
      expect(external).toContain(ref(madRequirementId, winner));
      // 101 synthetic on top of the seed externals; only the winner is eligible among them.
      expect(summary.prefiltered).toBe(baseline.prefiltered + 101);
      expect(summary.hard_eligible).toBe(baseline.hard_eligible + 1);
      expect(summary.cap).toBe(100);
    });
  });

  it("50 / 100 / 101 / 500 candidates: counts, cap and stable deterministic order", async () => {
    for (const [n, block] of [
      [40, 2],
      [90, 3],
      [91, 4],
      [490, 5],
    ] as const) {
      await asUser(db, SEED.managerMro, async (tx) => {
        await tx.exec("reset role");
        const baseline = (await poolAndSummary(tx)).summary;
        expect(baseline.prefiltered).toBe(10); // seed externals with a relevant qualification
        const ids = Array.from({ length: n }, (_, i) => synthId(block, i));
        const half = Math.floor(n / 2);
        // Half eligible, half with a pending (unverified) rating.
        await createExternals(tx, ids.slice(0, half), { expiresAt: null, window: FULL });
        await createExternals(tx, ids.slice(half), {
          expiresAt: null,
          window: FULL,
          verified: false,
        });
        const first = await poolAndSummary(tx);
        const second = await poolAndSummary(tx);
        const total = n + 10; // + seed externals
        expect(first.summary.prefiltered).toBe(total);
        expect(first.summary.hard_eligible).toBe(baseline.hard_eligible + half);
        expect(first.external).toHaveLength(Math.min(100, total));
        expect(second.external).toEqual(first.external); // deterministic
        if (first.summary.hard_eligible <= 100) {
          // Every candidate who passes the hard filters is inside the evaluated set.
          for (const id of ids.slice(0, half))
            expect(first.external).toContain(ref(madRequirementId, id));
        }
      });
    }
  });

  it("SQL preselection agrees with evaluateMatch() on 300 randomized near-miss profiles", async () => {
    // Deterministic PRNG so failures are reproducible.
    let seed = 20261015;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
    // Boundaries of BR-2 (first day 18, last day 22) and BR-4 (period 18 20:00 → 22 06:00).
    const expiries = [
      null,
      "2026-10-17",
      "2026-10-18",
      "2026-10-21",
      "2026-10-22",
      "2027-01-01",
    ] as const;
    const windows: [string, string, "available" | "unavailable"][][] = [
      [["2026-10-18T20:00Z", "2026-10-22T06:00Z", "available"]],
      [["2026-10-18T21:00Z", "2026-10-22T06:00Z", "available"]],
      [
        ["2026-10-10T00:00Z", "2026-10-20T00:00Z", "available"],
        ["2026-10-20T00:00Z", "2026-10-30T00:00Z", "available"],
      ],
      [
        ["2026-10-10T00:00Z", "2026-10-30T00:00Z", "available"],
        ["2026-10-19T00:00Z", "2026-10-19T01:00Z", "unavailable"],
      ],
      [
        ["2026-10-10T00:00Z", "2026-10-30T00:00Z", "available"],
        ["2026-10-22T06:00Z", "2026-10-23T00:00Z", "unavailable"],
      ],
      [],
    ];
    await asUser(db, SEED.managerMro, async (tx) => {
      await tx.exec("reset role");
      const ids = Array.from({ length: 300 }, (_, i) => synthId(6, i));
      await tx.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         select id, 'rnd-' || id || '@crewflex.test', '{"account_type":"professional","display_name":"Random"}'
         from unnest($1::uuid[]) id`,
        [ids],
      );
      await tx.query(
        "update public.technician_profiles set visibility = 'anonymous' where profile_id = any($1::uuid[])",
        [ids],
      );
      const hard = ["B1.1", "TR-A320", "EWIS", "HF", "FTS"];
      for (const id of ids) {
        for (const code of hard) {
          if (rnd() < 0.08) continue; // missing
          await tx.query(
            `insert into public.technician_qualifications
               (technician_profile_id, qualification_type_id, status, expires_at, verification_status)
             select $1, id, $2::public.qualification_status, $3::date, $4::public.verification_status
             from public.qualification_types where code = $5`,
            [
              id,
              rnd() < 0.05 ? "withdrawn" : "active",
              code === "TR-A320"
                ? rnd() < 0.5
                  ? null
                  : pick(expiries)
                : (pick(expiries) ?? "2027-01-01"),
              rnd() < 0.85 ? "verified" : pick(["pending", "rejected", "expired"] as const),
              code,
            ],
          );
        }
        for (const [startsAt, endsAt, status] of pick(windows)) {
          await tx.query(
            `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
             values ($1, $2, $3, $4)`,
            [id, startsAt, endsAt, status],
          );
        }
      }
      const sql = await tx.query<{ profile_id: string; hard_eligible: boolean }>(
        "select profile_id, hard_eligible from app_private.ranked_external_pool($1)",
        [madRequirementId],
      );
      const sqlEligible = new Map(
        sql.rows.map((r) => [ref(madRequirementId, r.profile_id), r.hard_eligible]),
      );

      const req = await tx.query<{
        starts_at: Date;
        ends_at: Date;
        urgency: "planned" | "urgent" | "aog";
      }>("select starts_at, ends_at, urgency from public.work_requirements where id = $1", [
        madRequirementId,
      ]);
      const quals = await tx.query<{
        id: string;
        code: string;
        requirement_level: "hard" | "soft";
      }>(
        `select qt.id, qt.code, wrq.requirement_level from public.work_requirement_qualifications wrq
         join public.qualification_types qt on qt.id = wrq.qualification_type_id where wrq.work_requirement_id = $1`,
        [madRequirementId],
      );
      const requirement: MatchableRequirement = {
        startsAt: req.rows[0]!.starts_at.toISOString(),
        endsAt: req.rows[0]!.ends_at.toISOString(),
        urgency: req.rows[0]!.urgency,
        qualifications: quals.rows.map((q) => ({
          qualificationTypeId: q.id,
          code: q.code,
          name: q.code,
          level: q.requirement_level,
        })),
      };
      // The full external population (no cap) through the same row mapper the Edge Function uses.
      await tx.exec("set local role authenticated");
      const pool = await tx.query("select * from public.get_requirement_candidate_pool($1)", [
        madRequirementId,
      ]);
      await tx.exec("reset role");
      const external = pool.rows.map(toCandidate).filter((c) => c.pool === "external");
      expect(external).toHaveLength(100);
      let compared = 0;
      for (const candidate of external) {
        expect(sqlEligible.get(candidate.id), candidate.id).toBe(
          evaluateMatch(requirement, candidate).eligible,
        );
        compared++;
      }
      expect(compared).toBe(100);
      // The cap did not drop anyone eligible: every SQL-eligible ref is in the evaluated set.
      const evaluated = new Set(external.map((c) => c.id));
      const eligibleRefs = [...sqlEligible].filter(([, ok]) => ok).map(([r]) => r);
      expect(eligibleRefs.length).toBeGreaterThan(5);
      expect(eligibleRefs.length).toBeLessThanOrEqual(100);
      for (const r of eligibleRefs) expect(evaluated.has(r)).toBe(true);
    });
  });

  it("members, other organizations and plain members cannot read the summary", async () => {
    for (const user of [SEED.charlieMember, SEED.adminOther, SEED.delta]) {
      await asUser(db, user, async (tx) => {
        expect(
          await queryError(tx, "select * from public.get_requirement_external_pool_summary($1)", [
            madRequirementId,
          ]),
        ).toMatch(/not authorized/);
      });
    }
    await asUser(db, null, async (tx) => {
      expect(
        await queryError(tx, "select * from public.get_requirement_external_pool_summary($1)", [
          madRequirementId,
        ]),
      ).toMatch(/permission denied/);
    });
    await asUser(db, SEED.managerMro, async (tx) => {
      expect(
        await queryError(tx, "select * from app_private.ranked_external_pool($1)", [
          madRequirementId,
        ]),
      ).toMatch(/permission denied/);
    });
  });
});

describe("N. qualification review by a platform admin (phase 6, migration 20261015130400)", () => {
  const GOLF = "00000000-0000-4000-8000-000000000024"; // B1.1 pending, everything else verified
  // The reviewer approves the version they looked at (M1): here, the current one.
  const review = `select * from public.review_qualification($1, $2::public.verification_status,
    (select updated_at from public.technician_qualifications where id = $1), $3, $4)`;
  // Database gate (M3): the owner-only flag is on for this suite, as it is in the local stack.
  beforeAll(async () => {
    await db.exec(
      "insert into app_private.feature_flags (name, enabled) values ('qualification_review', true)",
    );
  });
  afterAll(async () => {
    await db.exec("delete from app_private.feature_flags where name = 'qualification_review'");
  });
  /** Start state independent of test order (the audit suite verifies Golf's B1.1 for real). */
  async function golfPending(tx: Transaction) {
    await tx.exec("reset role");
    await tx.query(
      `update public.technician_qualifications set verification_status = 'pending'
       where technician_profile_id = $1
         and qualification_type_id = (select id from public.qualification_types where code = 'B1.1')`,
      [GOLF],
    );
    await tx.exec("set local role authenticated");
  }
  const golfB11 = async (tx: { query: PGlite["query"] }) =>
    (
      await tx.query<{ id: string }>(
        `select q.id from public.technician_qualifications q join public.qualification_types t on t.id = q.qualification_type_id
         where q.technician_profile_id = $1 and t.code = 'B1.1'`,
        [GOLF],
      )
    ).rows[0]!.id;

  async function golfEligibleForMad(tx: Transaction): Promise<boolean> {
    await tx.exec("reset role");
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: SEED.managerMro, role: "authenticated" }),
    ]);
    await tx.exec("set local role authenticated");
    const pool = await tx.query("select * from public.get_requirement_candidate_pool($1)", [
      madRequirementId,
    ]);
    const req = await tx.query<{
      starts_at: Date;
      ends_at: Date;
      urgency: "planned" | "urgent" | "aog";
    }>("select starts_at, ends_at, urgency from public.work_requirements where id = $1", [
      madRequirementId,
    ]);
    const quals = await tx.query<{ id: string; code: string; requirement_level: "hard" | "soft" }>(
      `select qt.id, qt.code, wrq.requirement_level from public.work_requirement_qualifications wrq
       join public.qualification_types qt on qt.id = wrq.qualification_type_id where wrq.work_requirement_id = $1`,
      [madRequirementId],
    );
    const requirement: MatchableRequirement = {
      startsAt: req.rows[0]!.starts_at.toISOString(),
      endsAt: req.rows[0]!.ends_at.toISOString(),
      urgency: req.rows[0]!.urgency,
      qualifications: quals.rows.map((q) => ({
        qualificationTypeId: q.id,
        code: q.code,
        name: q.code,
        level: q.requirement_level,
      })),
    };
    const golfRef =
      "CF-" +
      createHash("sha256")
        .update(`${madRequirementId}:${GOLF}`)
        .digest("hex")
        .slice(0, 10)
        .toUpperCase();
    const golf = pool.rows.map(toCandidate).find((c) => c.id === golfRef);
    if (!golf) throw new Error("Golf not in pool");
    return evaluateMatch(requirement, golf).eligible;
  }

  it("the professional, other professionals, org admins/managers and anon cannot review", async () => {
    let id = "";
    await asUser(db, GOLF, async (tx) => {
      id = await golfB11(tx);
      expect(await queryError(tx, review, [id, "verified", null, null])).toMatch(/not authorized/);
    });
    for (const user of [SEED.delta, SEED.adminMro, SEED.managerMro, SEED.adminOther]) {
      await asUser(db, user, async (tx) => {
        expect(await queryError(tx, review, [id, "verified", null, null])).toMatch(
          /not authorized/,
        );
      });
    }
    await asUser(db, null, async (tx) => {
      expect(await queryError(tx, review, [id, "verified", null, null])).toMatch(
        /permission denied/,
      );
    });
  });

  it("a platform admin cannot review their own qualification", async () => {
    await asUser(db, SEED.platformAdmin, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into public.technician_qualifications (technician_profile_id, qualification_type_id, expires_at)
         select $1, id, '2030-01-01' from public.qualification_types where code = 'HF' returning id`,
        [SEED.platformAdmin],
      );
      expect(await queryError(tx, review, [rows[0]!.id, "verified", "Checked", null])).toMatch(
        /own qualification/,
      );
    });
  });

  it("pending → verified: audited with actor, transition and request id; matching flips from blocked to eligible", async () => {
    await asUser(db, SEED.platformAdmin, async (tx) => {
      await golfPending(tx);
      const id = await golfB11(tx);
      expect(await golfEligibleForMad(tx)).toBe(false); // HARD_QUALIFICATION_NOT_VERIFIED
      await tx.exec("reset role");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: SEED.platformAdmin, role: "authenticated" }),
      ]);
      await tx.exec("set local role authenticated");
      const requestId = "5d1e9a7c-0b3f-4e2a-9c8d-7f6e5a4b3c21";
      const { rows } = await tx.query<{ verification_status: string }>(review, [
        id,
        "verified",
        "Checked with the issuing authority",
        requestId,
      ]);
      expect(rows[0]?.verification_status).toBe("verified");
      const audit = await tx.query<{ actor_profile_id: string; metadata: Record<string, unknown> }>(
        "select actor_profile_id, metadata from public.audit_events where entity_id = $1 and action = 'qualification.reviewed'",
        [id],
      );
      expect(audit.rows).toHaveLength(1);
      expect(audit.rows[0]?.actor_profile_id).toBe(SEED.platformAdmin);
      expect(audit.rows[0]?.metadata).toMatchObject({
        previous_verification_status: "pending",
        verification_status: "verified",
        note_provided: true,
        request_id: requestId,
      });
      expect(JSON.stringify(audit.rows[0]?.metadata)).not.toContain("issuing authority"); // no free text
      expect(await golfEligibleForMad(tx)).toBe(true);
    });
  });

  it("P12 / T-170 (migration 20261027300000): a verification needs evidence; it stays with the platform, never with the owner", async () => {
    await asUser(db, SEED.platformAdmin, async (tx) => {
      await golfPending(tx);
      const id = await golfB11(tx);
      for (const note of [null, "", "   "]) {
        expect(await queryError(tx, review, [id, "verified", note, null])).toMatch(
          /needs evidence/,
        );
      }
      expect(await queryError(tx, review, [id, "verified", "x".repeat(501), null])).toMatch(
        /too long/,
      );
      // Nothing was decided or written by the refused calls.
      expect(
        await rowCount(
          tx,
          "select 1 from public.qualification_reviews where qualification_id = $1",
          [id],
        ),
      ).toBe(0);
      const version = (
        await tx.query<{ v: string }>(
          "select updated_at::text as v from public.technician_qualifications where id = $1",
          [id],
        )
      ).rows[0]!.v;
      await tx.query(review, [id, "verified", "  EASA register ref. 123  ", null]);
      // The platform admin reads the evidence (RLS), trimmed, with the version reviewed.
      const evidence = await tx.query<Record<string, unknown>>(
        `select decision, note, reviewed_by, qualification_version::text as qualification_version
         from public.qualification_reviews where qualification_id = $1`,
        [id],
      );
      expect(evidence.rows).toEqual([
        {
          decision: "verified",
          note: "EASA register ref. 123",
          reviewed_by: SEED.platformAdmin,
          qualification_version: version,
        },
      ]);
      // No write grant for anyone, platform admin included.
      expect(
        await queryError(
          tx,
          "insert into public.qualification_reviews (qualification_id, decision, note, qualification_version) values ($1, 'verified', 'forged', now())",
          [id],
        ),
      ).toMatch(/permission denied/);
      // The owner's column carries no verification evidence (only a rejection's reason, BR-2.6)…
      await tx.exec("reset role");
      const own = await tx.query<{ review_note: string | null }>(
        "select review_note from public.technician_qualifications where id = $1",
        [id],
      );
      expect(own.rows[0]?.review_note).toBeNull();
      // …and neither the owner nor an organization admin reads the evidence table.
      for (const who of [GOLF, SEED.adminMro]) {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: who, role: "authenticated" }),
        ]);
        await tx.exec("set local role authenticated");
        expect(await rowCount(tx, "select * from public.qualification_reviews")).toBe(0);
        expect(
          await rowCount(
            tx,
            "select * from public.own_qualification_reviews() where qualification_id = $1",
            [id],
          ),
        ).toBe(0);
        await tx.exec("reset role");
      }
    });
    // A rejection writes the evidence row too and the owner reads its reason.
    await asUser(db, SEED.platformAdmin, async (tx) => {
      await golfPending(tx);
      const id = await golfB11(tx);
      await tx.query(review, [id, "rejected", "Number not in the register", null]);
      expect(
        await rowCount(
          tx,
          "select 1 from public.qualification_reviews where qualification_id = $1 and decision = 'rejected' and note = 'Number not in the register'",
          [id],
        ),
      ).toBe(1);
      await tx.exec("reset role");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: GOLF, role: "authenticated" }),
      ]);
      await tx.exec("set local role authenticated");
      const own = await tx.query<{ review_note: string }>(
        "select review_note from public.own_qualification_reviews() where qualification_id = $1",
        [id],
      );
      expect(own.rows[0]?.review_note).toBe("Number not in the register");
    });
  });

  it("pending → rejected needs a reason; the owner reads the reason; a decided row cannot be decided again", async () => {
    await asUser(db, SEED.platformAdmin, async (tx) => {
      await golfPending(tx);
      const id = await golfB11(tx);
      expect(await queryError(tx, review, [id, "rejected", "   ", null])).toMatch(/needs evidence/);
      expect(await queryError(tx, review, [id, "pending", null, null])).toMatch(
        /verified or rejected/,
      );
      await tx.query(review, [
        id,
        "rejected",
        "Licence number does not match the authority register",
        null,
      ]);
      // Second reviewer (or a double click) after the first decision committed: conflict, no change.
      expect(await queryError(tx, review, [id, "verified", "late", null])).toMatch(
        /not awaiting review/,
      );
      await tx.exec("reset role");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: GOLF, role: "authenticated" }),
      ]);
      await tx.exec("set local role authenticated");
      // The owner reads the reason through the owner-only function, not through the column (M2).
      const own = await tx.query<{ review_note: string }>(
        "select review_note from public.own_qualification_reviews() where qualification_id = $1",
        [id],
      );
      expect(own.rows[0]?.review_note).toBe("Licence number does not match the authority register");
      expect(
        await queryError(
          tx,
          "select review_note from public.technician_qualifications where id = $1",
          [id],
        ),
      ).toMatch(/permission denied/);
      // The professional cannot write the review columns.
      expect(
        await queryError(
          tx,
          "update public.technician_qualifications set review_note = 'ok', reviewed_at = now() where id = $1",
          [id],
        ),
      ).toMatch(/permission denied/);
    });
  });

  it("re-dating a verified qualification sends it back to pending and clears the review", async () => {
    await asUser(db, SEED.platformAdmin, async (tx) => {
      await golfPending(tx);
      const id = await golfB11(tx);
      await tx.query(review, [id, "verified", "Checked against the register", null]);
      await tx.exec("reset role");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: GOLF, role: "authenticated" }),
      ]);
      await tx.exec("set local role authenticated");
      await tx.query(
        "update public.technician_qualifications set expires_at = '2031-06-30' where id = $1",
        [id],
      );
      await tx.exec("reset role"); // read the review columns as the table owner
      const { rows } = await tx.query<Record<string, unknown>>(
        "select verification_status, reviewed_by, reviewed_at, review_note from public.technician_qualifications where id = $1",
        [id],
      );
      expect(rows[0]).toEqual({
        verification_status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        review_note: null,
      });
    });
  });

  it("withdrawn or unknown qualifications cannot be reviewed", async () => {
    await asUser(db, SEED.platformAdmin, async (tx) => {
      expect(
        await queryError(tx, review, [
          "00000000-0000-4000-8000-00000000dead",
          "verified",
          "Checked",
          null,
        ]),
      ).toMatch(/not found/);
      await tx.exec("reset role");
      const id = await golfB11(tx);
      await tx.query(
        "update public.technician_qualifications set status = 'withdrawn' where id = $1",
        [id],
      );
      await tx.exec("set local role authenticated");
      expect(await queryError(tx, review, [id, "verified", "Checked", null])).toMatch(
        /not awaiting review/,
      );
    });
  });

  it("M3: with the database gate off, even a platform admin cannot review (direct RPC call)", async () => {
    await asUser(db, SEED.platformAdmin, async (tx) => {
      await golfPending(tx);
      await tx.exec("reset role");
      await tx.exec(
        "update app_private.feature_flags set enabled = false where name = 'qualification_review'",
      );
      await tx.exec("set local role authenticated");
      expect(await queryError(tx, review, [await golfB11(tx), "verified", null, null])).toMatch(
        /not enabled/,
      );
      // …and no API role can read or flip the switch.
      expect(await queryError(tx, "select * from app_private.feature_flags")).toMatch(
        /permission denied/,
      );
      expect(
        await queryError(
          tx,
          "insert into app_private.feature_flags (name, enabled) values ('qualification_review', true)",
        ),
      ).toMatch(/permission denied/);
    });
  });

  it("M1: a decision about an older version of the declaration is refused (re-dated after loading)", async () => {
    await asUser(db, SEED.platformAdmin, async (tx) => {
      await golfPending(tx);
      const id = await golfB11(tx);
      const loaded = (
        await tx.query<{ v: string }>(
          "select updated_at::text as v from public.technician_qualifications where id = $1",
          [id],
        )
      ).rows[0]!.v;
      // The professional extends the expiry while the reviewer has the queue open. Inside one test
      // transaction now() is constant, so the reviewer's copy is modelled as one second older.
      await tx.exec("reset role");
      await tx.query(
        "update public.technician_qualifications set expires_at = '2035-12-31', updated_at = now() + interval '1 second' where id = $1",
        [id],
      );
      await tx.exec("set local role authenticated");
      expect(
        await queryError(
          tx,
          "select * from public.review_qualification($1, 'verified', $2::timestamptz - interval '1 second', 'Checked', null)",
          [id, loaded],
        ),
      ).toMatch(/changed since it was loaded/);
    });
  });

  it("M2: organization admins see the status of a member's qualification but not the reviewer or the reason", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      for (const column of ["review_note", "reviewed_by"]) {
        expect(
          await queryError(
            tx,
            `select ${column} from public.technician_qualifications where technician_profile_id = $1`,
            [SEED.alpha],
          ),
        ).toMatch(/permission denied/);
      }
      const { rows } = await tx.query(
        "select verification_status, reviewed_at from public.technician_qualifications where technician_profile_id = $1",
        [SEED.alpha],
      );
      expect(rows.length).toBeGreaterThan(0);
      // …and the owner-only function returns nothing about other people's qualifications.
      expect(await rowCount(tx, "select * from public.own_qualification_reviews()")).toBe(0);
    });
  });

  it("platform role cannot be self-assigned through any grant", async () => {
    await asUser(db, GOLF, async (tx) => {
      expect(
        await queryError(
          tx,
          "update public.profiles set platform_role = 'platform_admin' where id = $1",
          [GOLF],
        ),
      ).toMatch(/permission denied/);
    });
  });
});

describe("O. per-day availability replace (shift-cycle generator, migration 20261019120000)", () => {
  const KEY = "3a9d5e1c-0b2f-4c7a-8e6d-5f4a3b2c1d0e";
  const replace = "select * from public.replace_availability_days($1, $2::jsonb)";
  const own = async (tx: Transaction, owner: string, from: string, to: string) =>
    (
      await tx.query<{ starts_at: Date; ends_at: Date; status: string }>(
        `select starts_at, ends_at, status from public.availability_windows
         where technician_profile_id = $1 and starts_at < $3 and ends_at > $2 order by starts_at`,
        [owner, from, to],
      )
    ).rows.map((r) => [r.starts_at.toISOString(), r.ends_at.toISOString(), r.status]);
  const days = (...entries: [string, string | null][]) =>
    JSON.stringify(entries.map(([date, status]) => ({ date, status })));

  it("runs of consecutive days become one window each; a replay writes nothing more", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const payload = days(
        ["2028-03-01", "unavailable"],
        ["2028-03-02", "unavailable"],
        ["2028-03-03", "available"],
        ["2028-03-04", "available"],
        ["2028-03-05", null],
        ["2028-03-06", "available"],
      );
      const first = await tx.query<{ id: string; replayed: boolean; windows_created: number }>(
        replace,
        [KEY, payload],
      );
      expect(first.rows[0]).toMatchObject({ replayed: false, windows_created: 3 });
      const expected = [
        ["2028-03-01T00:00:00.000Z", "2028-03-03T00:00:00.000Z", "unavailable"],
        ["2028-03-03T00:00:00.000Z", "2028-03-05T00:00:00.000Z", "available"],
        ["2028-03-06T00:00:00.000Z", "2028-03-07T00:00:00.000Z", "available"],
      ];
      expect(await own(tx, SEED.delta, "2028-03-01", "2028-04-01")).toEqual(expected);

      const replay = await tx.query<{ id: string; replayed: boolean }>(replace, [KEY, payload]);
      expect(replay.rows[0]).toEqual({
        id: first.rows[0]!.id,
        replayed: true,
        windows_created: null,
      });
      expect(await own(tx, SEED.delta, "2028-03-01", "2028-04-01")).toEqual(expected);
      // Same key, other days → conflict, nothing written.
      expect(await queryError(tx, replace, [KEY, days(["2028-03-09", "available"])])).toMatch(
        /different request/,
      );
    });
  });

  it("listed days are cut out of longer windows; hours outside them are preserved", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      await tx.query(
        `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
         values ($1, '2028-05-01 08:00Z', '2028-05-10 18:00Z', 'available')`,
        [SEED.delta],
      );
      await tx.query(replace, [
        "4b0e6f2d-1c3a-4d8b-9f7e-6a5b4c3d2e1f",
        days(["2028-05-01", "unavailable"], ["2028-05-04", null], ["2028-05-10", null]),
      ]);
      expect(await own(tx, SEED.delta, "2028-05-01", "2028-05-11")).toEqual([
        ["2028-05-01T00:00:00.000Z", "2028-05-02T00:00:00.000Z", "unavailable"],
        ["2028-05-02T00:00:00.000Z", "2028-05-04T00:00:00.000Z", "available"],
        ["2028-05-05T00:00:00.000Z", "2028-05-10T00:00:00.000Z", "available"],
      ]);
    });
  });

  it("rejects invalid payloads and past days without writing anything", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const before = await own(tx, SEED.delta, "2020-01-01", "2030-01-01");
      const bad = [
        "[]",
        days(["2028-02-30", "available"]),
        days(["2028-06-01", "maybe"]),
        days(["2028-06-01", "available"], ["2028-06-01", null]),
        JSON.stringify([
          { date: "2028-06-01", status: "available", technician_profile_id: SEED.echo },
        ]),
        JSON.stringify(
          Array.from({ length: 63 }, (_, i) => ({
            date: `2029-01-01`,
            status: i ? null : "available",
          })),
        ),
        days(["2020-01-01", "available"]),
        '{"date":"2028-06-01"}',
      ];
      for (const [i, payload] of bad.entries()) {
        const key = `5c1f7a3e-2d4b-4e9c-8a0f-${String(i).padStart(12, "0")}`;
        expect(await queryError(tx, replace, [key, payload])).toBeTruthy();
      }
      expect(await own(tx, SEED.delta, "2020-01-01", "2030-01-01")).toEqual(before);
    });
  });

  it("only ever touches the caller's own windows; anon cannot call it", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      // Echo's seed window spans October 2026; Delta replacing those days leaves it intact.
      const echoBefore = await own(tx, SEED.echo, "2026-10-01", "2026-11-01");
      await tx.query(replace, [
        "6d2a8b4f-3e5c-4fa1-8b2c-7d6e5f4a3b2c",
        days(["2028-07-01", "unavailable"]),
      ]);
      expect(await own(tx, SEED.echo, "2026-10-01", "2026-11-01")).toEqual(echoBefore);
    });
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from public.availability_windows where technician_profile_id = $1",
      [SEED.echo],
    );
    expect(rows[0]!.n).toBeGreaterThan(0);
    await asUser(db, null, async (tx) => {
      expect(
        await queryError(tx, replace, [
          "7e3b9c5a-4f6d-4ab2-9c3d-8e7f6a5b4c3d",
          days(["2028-07-01", "available"]),
        ]),
      ).toMatch(/permission denied/);
    });
  });

  it("overlapping windows of mixed status, mid-day edges and a non-UTC session time zone", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      await tx.query("set local timezone = 'Pacific/Kiritimati'"); // UTC+14: must change nothing
      await tx.query(
        `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status) values
          ($1, '2028-03-20 06:00Z', '2028-04-05 18:00Z', 'available'),
          ($1, '2028-03-25 10:00Z', '2028-03-25 14:00Z', 'unavailable'),
          ($1, '2028-03-24 20:00Z', '2028-03-26 04:00Z', 'unavailable'),
          ($1, '2028-03-26 22:00Z', '2028-03-27 02:00Z', 'available')`,
        [SEED.delta],
      );
      await tx.query(replace, [
        "9a5d1e7c-6b8f-4cd4-8e5f-0a9b8c7d6e5f",
        days(["2028-03-25", "available"], ["2028-03-27", null]),
      ]);
      const rows = (
        await tx.query<{ s: Date; e: Date; st: string }>(
          `select starts_at s, ends_at e, status st from public.availability_windows
           where technician_profile_id = $1 and starts_at >= '2028-03-01' and starts_at < '2028-05-01'
           order by starts_at, status`, // enum order: available < unavailable
          [SEED.delta],
        )
      ).rows.map((r) => `${r.s.toISOString()} ${r.e.toISOString()} ${r.st}`);
      expect(rows).toEqual([
        "2028-03-20T06:00:00.000Z 2028-03-25T00:00:00.000Z available",
        "2028-03-24T20:00:00.000Z 2028-03-25T00:00:00.000Z unavailable",
        "2028-03-25T00:00:00.000Z 2028-03-26T00:00:00.000Z available", // the edited day
        "2028-03-26T00:00:00.000Z 2028-03-27T00:00:00.000Z available",
        "2028-03-26T00:00:00.000Z 2028-03-26T04:00:00.000Z unavailable",
        "2028-03-26T22:00:00.000Z 2028-03-27T00:00:00.000Z available",
        "2028-03-28T00:00:00.000Z 2028-04-05T18:00:00.000Z available",
      ]);
    });
  });

  it("rejects scalars, a null key and 63 distinct days", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      for (const [i, payload] of ["5", "null", '"x"', "[1]", "[null]"].entries()) {
        const key = `6d2e8f4a-5b7c-4d9e-8f0a-${String(i).padStart(12, "0")}`;
        expect(await queryError(tx, replace, [key, payload])).toBeTruthy();
      }
      expect(await queryError(tx, replace, [null, days(["2028-09-01", "available"])])).toMatch(
        /idempotency key is required/,
      );
      const many = JSON.stringify(
        Array.from({ length: 63 }, (_, i) => ({
          date: new Date(Date.UTC(2029, 0, 1 + i)).toISOString().slice(0, 10),
          status: "available",
        })),
      );
      expect(await queryError(tx, replace, ["7e3f9a5b-6c8d-4eaf-9a1b-2c3d4e5f6a7b", many])).toMatch(
        /between 1 and 62/,
      );
    });
  });

  it("every write to a technician's windows takes the per-technician lock (migration 20261019130000)", async () => {
    const { rows } = await db.query<{ tgname: string }>(
      "select tgname from pg_trigger where tgrelid = 'public.availability_windows'::regclass and not tgisinternal",
    );
    expect(rows.map((r) => r.tgname)).toContain("availability_windows_lock_owner");
    await asUser(db, SEED.delta, async (tx) => {
      // Insert, update and delete still work with the trigger in place.
      const { rows: created } = await tx.query<{ id: string }>(
        `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
         values ($1, '2028-08-01 00:00Z', '2028-08-02 00:00Z', 'available') returning id`,
        [SEED.delta],
      );
      const id = created[0]!.id;
      expect(
        (
          await tx.query(
            "update public.availability_windows set status = 'unavailable' where id = $1",
            [id],
          )
        ).affectedRows,
      ).toBe(1);
      expect(
        (await tx.query("delete from public.availability_windows where id = $1", [id]))
          .affectedRows,
      ).toBe(1);
    });
  });

  it("saves the chosen rotation with the days, privately (migration 20261019140000)", async () => {
    const withRotation = "select * from public.replace_availability_days($1, $2::jsonb, $3::jsonb)";
    const rotation = JSON.stringify({ pattern: "7x3/7x4", anchor: "2028-09-01", customCycle: [] });
    await asUser(db, SEED.alpha, async (tx) => {
      // Alpha is a member of Demo MRO Madrid: its admin can read its windows, never its rotation.
      await tx.query(withRotation, [
        "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
        days(["2028-09-01", "unavailable"]),
        rotation,
      ]);
      const { rows } = await tx.query<{ pattern: string; anchor: Date; custom_cycle: string[] }>(
        "select pattern, anchor, custom_cycle from public.availability_rotations",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]!.pattern).toBe("7x3/7x4");
      // Pattern only (no day changes) is allowed and replaces the preference.
      await tx.query(withRotation, [
        "2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f",
        "[]",
        JSON.stringify({
          pattern: "custom",
          anchor: "2028-09-02",
          customCycle: ["working", "off"],
        }),
      ]);
      const after = await tx.query<{ pattern: string; custom_cycle: string[] }>(
        "select pattern, custom_cycle from public.availability_rotations",
      );
      expect(after.rows[0]).toEqual({ pattern: "custom", custom_cycle: ["working", "off"] });
      // Invalid rotations write nothing (neither the rotation nor the days).
      for (const [i, bad] of [
        { pattern: "9x9", anchor: "2028-09-01", customCycle: [] },
        { pattern: "custom", anchor: "2028-09-01", customCycle: [] },
        { pattern: "7x3", anchor: "2028-02-30", customCycle: [] },
        { pattern: "7x3", anchor: "2028-09-01", customCycle: ["working", "maybe"] },
        { pattern: "7x3", anchor: "2028-09-01", customCycle: Array(32).fill("off") },
        { pattern: "7x3", anchor: "2028-09-01" },
        {
          pattern: "7x3",
          anchor: "2028-09-01",
          customCycle: [],
          technician_profile_id: SEED.bravo,
        },
      ].entries()) {
        const key = `3d4e5f6a-7b8c-4d9e-8f0a-${String(i).padStart(12, "0")}`;
        expect(
          await queryError(tx, withRotation, [
            key,
            days(["2028-09-20", "available"]),
            JSON.stringify(bad),
          ]),
        ).toBeTruthy();
      }
      expect(
        await rowCount(
          tx,
          "select * from public.availability_windows where technician_profile_id = $1 and starts_at = '2028-09-20T00:00Z'",
          [SEED.alpha],
        ),
      ).toBe(0);
      // No rotation and no days is still refused.
      expect(await queryError(tx, replace, ["4e5f6a7b-8c9d-4eaf-8b1c-2d3e4f5a6b7c", "[]"])).toMatch(
        /between 1 and 62/,
      );
    });
    // Seen by nobody else: the organization admin, a platform admin, another professional.
    await asUser(db, SEED.alpha, async (tx) => {
      await tx.query(withRotation, ["5f6a7b8c-9d0e-4f1a-9b2c-3d4e5f6a7b8c", "[]", rotation]);
      for (const other of [SEED.adminMro, SEED.platformAdmin, SEED.delta]) {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: other, role: "authenticated" }),
        ]);
        expect(await rowCount(tx, "select * from public.availability_rotations")).toBe(0);
        const upd = await tx.query("update public.availability_rotations set pattern = '4x4'");
        expect(upd.affectedRows).toBe(0);
      }
    });
    await asUser(db, null, async (tx) => {
      expect(await queryError(tx, "select * from public.availability_rotations")).toMatch(
        /permission denied/,
      );
    });
  });

  it("refuses a save made from a stale calendar (W5-03, migration 20261021120000)", async () => {
    const checked = "select * from public.replace_availability_days($1, $2::jsonb, null, $3)";
    const version = async (tx: Transaction) =>
      (await tx.query<{ v: string }>("select public.availability_version() as v")).rows[0]!.v;
    const first = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
    await asUser(db, SEED.delta, async (tx) => {
      const loaded = await version(tx);
      expect(loaded).toMatch(/^[0-9a-f]{32}$/);
      expect(await version(tx)).toBe(loaded); // stable while nothing changes
      await tx.query(checked, [first, days(["2028-10-01", "available"]), loaded]);
      const saved = await version(tx);
      expect(saved).not.toBe(loaded);

      // A second tab still holding `loaded`: CF412, nothing written, the version is unchanged.
      expect(
        await queryError(tx, checked, [
          "7b8c9d0e-1f2a-4b3c-9d4e-5f6a7b8c9d0e",
          days(["2028-10-02", "unavailable"]),
          loaded,
        ]),
      ).toMatch(/changed since it was loaded/);
      expect(await version(tx)).toBe(saved);
      expect(await own(tx, SEED.delta, "2028-10-02T00:00Z", "2028-10-03T00:00Z")).toEqual([]);

      // A retry of the applied request replays (its own write changed the version).
      const replay = await tx.query<{ replayed: boolean }>(checked, [
        first,
        days(["2028-10-01", "available"]),
        loaded,
      ]);
      expect(replay.rows[0]!.replayed).toBe(true);

      // Single-window writes (PostgREST) change it too, so a draft loaded before them conflicts.
      await tx.query(
        `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
         values ($1, '2028-10-05 08:00Z', '2028-10-05 18:00Z', 'available')`,
        [SEED.delta],
      );
      expect(await version(tx)).not.toBe(saved);
      expect(
        await queryError(tx, checked, [
          "8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e1f",
          days(["2028-10-03", "available"]),
          saved,
        ]),
      ).toMatch(/changed since it was loaded/);
      // Without an expected version (older clients) there is no check.
      await tx.query(checked, [
        "9d0e1f2a-3b4c-4d5e-9f6a-7b8c9d0e1f2a",
        days(["2028-10-03", "available"]),
        null,
      ]);
    });
    // Each technician has their own version: Delta's writes do not change Alpha's.
    await asUser(db, SEED.alpha, async (tx) => {
      const alpha = await version(tx);
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: SEED.delta, role: "authenticated" }),
      ]);
      await tx.query(checked, [
        "0e1f2a3b-4c5d-4e6f-8a7b-8c9d0e1f2a3b",
        days(["2028-10-04", "available"]),
        null,
      ]);
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: SEED.alpha, role: "authenticated" }),
      ]);
      expect(await version(tx)).toBe(alpha);
    });
    await asUser(db, null, async (tx) => {
      expect(await queryError(tx, "select public.availability_version()")).toMatch(
        /permission denied/,
      );
    });
  });

  it("an organization account (no technician profile) cannot write windows through it", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(
        await queryError(tx, replace, [
          "8f4c0d6b-5a7e-4bc3-8d4e-9f8a7b6c5d4e",
          days(["2028-07-01", "available"]),
        ]),
      ).toMatch(/foreign key|row-level security/);
    });
  });
});

describe("P. `aog_only` availability: AOG requirements only, SQL and TypeScript agree (migrations 20261019150000/150100)", () => {
  // MAD requirement period: 2026-10-18 20:00Z → 2026-10-22 06:00Z.
  const S = "2026-10-18T20:00Z";
  const MID = "2026-10-20T12:00Z";
  const E = "2026-10-22T06:00Z";
  type W = [string, string, "available" | "unavailable" | "aog_only"];
  const cases: { name: string; windows: W[]; urgent: boolean; aog: boolean }[] = [
    { name: "aog_only whole period", windows: [[S, E, "aog_only"]], urgent: false, aog: true },
    {
      name: "available whole period + aog_only overlapping part",
      windows: [
        [S, E, "available"],
        [MID, E, "aog_only"],
      ],
      urgent: false, // aog_only is exclusive: it takes that part out of ordinary availability
      aog: true,
    },
    {
      name: "aog_only whole period + unavailable part",
      windows: [
        [S, E, "aog_only"],
        [MID, E, "unavailable"],
      ],
      urgent: false,
      aog: false, // unavailable overrides aog_only too
    },
    {
      name: "available first half + aog_only second half",
      windows: [
        [S, MID, "available"],
        [MID, E, "aog_only"],
      ],
      urgent: false,
      aog: true,
    },
    { name: "available whole period", windows: [[S, E, "available"]], urgent: true, aog: true },
    { name: "no windows", windows: [], urgent: false, aog: false },
  ];
  const ids = cases.map((_, i) => `00000000-0000-4000-9150-${String(i).padStart(12, "0")}`);
  const replace_ = "select * from public.replace_availability_days($1, $2::jsonb)";

  it("eligibility per urgency matches the BR-4.8 table, in SQL and in evaluateMatch", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      await tx.exec("reset role");
      await tx.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         select id, 'aog-' || id || '@crewflex.test', '{"account_type":"professional","display_name":"AOG case"}'
         from unnest($1::uuid[]) id`,
        [ids],
      );
      await tx.query(
        "update public.technician_profiles set visibility = 'anonymous' where profile_id = any($1::uuid[])",
        [ids],
      );
      await tx.query(
        `insert into public.technician_qualifications
           (technician_profile_id, qualification_type_id, expires_at, verification_status)
         select p, wrq.qualification_type_id, date '2031-01-01', 'verified'
         from unnest($1::uuid[]) p
         cross join public.work_requirement_qualifications wrq
         where wrq.work_requirement_id = $2 and wrq.requirement_level = 'hard'`,
        [ids, madRequirementId],
      );
      for (const [i, c] of cases.entries()) {
        for (const [startsAt, endsAt, status] of c.windows) {
          await tx.query(
            `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
             values ($1, $2, $3, $4)`,
            [ids[i], startsAt, endsAt, status],
          );
        }
      }
      const quals = await tx.query<{
        id: string;
        code: string;
        requirement_level: "hard" | "soft";
      }>(
        `select qt.id, qt.code, wrq.requirement_level from public.work_requirement_qualifications wrq
         join public.qualification_types qt on qt.id = wrq.qualification_type_id where wrq.work_requirement_id = $1`,
        [madRequirementId],
      );

      for (const urgency of ["planned", "urgent", "aog"] as const) {
        await tx.query("update public.work_requirements set urgency = $2 where id = $1", [
          madRequirementId,
          urgency,
        ]);
        const sql = await tx.query<{ profile_id: string; hard_eligible: boolean }>(
          "select profile_id, hard_eligible from app_private.ranked_external_pool($1) where profile_id = any($2::uuid[])",
          [madRequirementId, ids],
        );
        const sqlEligible = new Map(sql.rows.map((r) => [r.profile_id, r.hard_eligible]));

        await tx.exec("set local role authenticated");
        const pool = await tx.query("select * from public.get_requirement_candidate_pool($1)", [
          madRequirementId,
        ]);
        await tx.exec("reset role");
        const byRef = new Map(pool.rows.map(toCandidate).map((c) => [c.id, c]));
        const requirement: MatchableRequirement = {
          startsAt: "2026-10-18T20:00:00.000Z",
          endsAt: "2026-10-22T06:00:00.000Z",
          urgency,
          qualifications: quals.rows.map((q) => ({
            qualificationTypeId: q.id,
            code: q.code,
            name: q.code,
            level: q.requirement_level,
          })),
        };
        for (const [i, c] of cases.entries()) {
          const expected = urgency === "aog" ? c.aog : c.urgent;
          expect(sqlEligible.get(ids[i]!), `${urgency} · SQL · ${c.name}`).toBe(expected);
          const refId =
            "CF-" +
            createHash("sha256")
              .update(`${madRequirementId}:${ids[i]}`)
              .digest("hex")
              .slice(0, 10)
              .toUpperCase();
          const candidate = byRef.get(refId);
          expect(candidate, `${urgency} · in pool · ${c.name}`).toBeDefined();
          expect(
            evaluateMatch(requirement, candidate!).eligible,
            `${urgency} · TS · ${c.name}`,
          ).toBe(expected);
        }
      }
    });
  });

  it("a professional can write `aog_only` windows only for themself", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "select id from public.create_availability_window($1, '2028-10-01T00:00Z', '2028-10-02T00:00Z', 'aog_only')",
        ["8a9b0c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d"],
      );
      expect(rows[0]?.id).toBeTruthy();
      await tx.query(replace_, [
        "9b0c1d2e-3f4a-4b5c-9d6e-8f9a0b1c2d3e",
        JSON.stringify([{ date: "2028-10-05", status: "aog_only" }]),
      ]);
      expect(
        await queryError(
          tx,
          `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
           values ($1, '2028-10-01T00:00Z', '2028-10-02T00:00Z', 'aog_only')`,
          [SEED.echo],
        ),
      ).toMatch(/row-level security/);
    });
  });
});

describe("Q. document wallet (migration 20261019160000)", () => {
  const BUCKET = "professional-documents";
  const KEY = "3c9e1d7a-5b2f-4e8a-9c1d-2f3a4b5c6d7e";
  const sha = (text: string) => createHash("sha256").update(text).digest("hex");
  const pathFor = (uid: string, key: string, hash: string) => `${uid}/${key}-${hash.slice(0, 16)}`;
  const create = `select * from public.create_professional_document($1, $2, $3, $4, $5, $6, $7, $8, $9)`;

  // The wallet is gated by the owner-only flag (20261019160200); these tests run with it ON.
  beforeAll(async () => {
    await db.query(
      "insert into app_private.feature_flags (name, enabled) values ('document_wallet', true) on conflict (name) do update set enabled = true",
    );
  });
  afterAll(async () => {
    await db.query("delete from app_private.feature_flags where name = 'document_wallet'");
  });

  /** What Storage does on upload: inserts the object row as the signed-in user (RLS applies). */
  async function upload(tx: Transaction, uid: string, key: string, content: string) {
    const hash = sha(content);
    const path = pathFor(uid, key, hash);
    const size = Buffer.byteLength(content);
    await tx.query(
      "insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4)",
      [BUCKET, path, uid, JSON.stringify({ size, mimetype: "application/pdf" })],
    );
    return { path, hash, size };
  }

  async function createDoc(
    tx: Transaction,
    uid: string,
    key = KEY,
    content = "%PDF-1.4 licence",
    overrides: { title?: string; qualificationId?: string | null } = {},
  ) {
    const object = await upload(tx, uid, key, content);
    const { rows } = await tx.query<{ id: string; replayed: boolean }>(create, [
      key,
      "license",
      overrides.title ?? "B1 licence",
      object.path,
      "application/pdf",
      object.size,
      object.hash,
      "2030-01-31",
      overrides.qualificationId ?? null,
    ]);
    return { ...object, id: rows[0]!.id, replayed: rows[0]!.replayed };
  }

  it("the bucket is private, 5 MiB, pdf/png/jpeg only", async () => {
    const { rows } = await db.query(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = $1",
      [BUCKET],
    );
    expect(rows).toEqual([
      {
        public: false,
        file_size_limit: 5242880,
        allowed_mime_types: ["application/pdf", "image/png", "image/jpeg"],
      },
    ]);
  });

  it("owner: create via RPC, read, update the editable fields, delete; every step audited", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const doc = await createDoc(tx, SEED.delta);
      expect(doc.replayed).toBe(false);
      const { rows } = await tx.query(
        "select owner_id, kind, title, scan_status, mime_type, size_bytes from public.professional_documents where id = $1",
        [doc.id],
      );
      expect(rows).toEqual([
        {
          owner_id: SEED.delta,
          kind: "license",
          title: "B1 licence",
          scan_status: "not_scanned",
          mime_type: "application/pdf",
          size_bytes: doc.size,
        },
      ]);
      const updated = await tx.query(
        `update public.professional_documents set title = 'Renamed', kind = 'course', expires_at = null
         where id = $1`,
        [doc.id],
      );
      expect(updated.affectedRows).toBe(1);
      // The object of an existing row cannot be deleted (a row never loses its bytes)…
      expect(
        (await tx.query("delete from storage.objects where name = $1", [doc.path])).affectedRows,
      ).toBe(0);
      expect(
        (await tx.query("delete from public.professional_documents where id = $1", [doc.id]))
          .affectedRows,
      ).toBe(1);
      // …and can once the row is gone (the function's delete order).
      expect(
        (await tx.query("delete from storage.objects where name = $1", [doc.path])).affectedRows,
      ).toBe(1);

      await tx.exec("reset role");
      const audit = await tx.query<{ action: string; metadata: Record<string, unknown> }>(
        "select action, metadata from public.audit_events where entity_id = $1 order by created_at, action",
        [doc.id],
      );
      expect(audit.rows.map((r) => r.action).sort()).toEqual([
        "document.deleted",
        "document.updated",
        "document.uploaded",
      ]);
      for (const { metadata } of audit.rows) {
        expect(metadata).toMatchObject({
          technician_profile_id: SEED.delta,
          mime_type: "application/pdf",
          sha256: doc.hash,
        });
        const text = JSON.stringify(metadata);
        expect(text).not.toContain("licence");
        expect(text).not.toContain("Renamed");
        expect(text).not.toContain(doc.path);
      }
      expect(audit.rows.find((r) => r.action === "document.updated")?.metadata.changed).toEqual([
        "kind",
        "title",
        "expires_at",
      ]);
    });
  });

  it("idempotent: same key + same request replays; same key + other request is CF409", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const first = await createDoc(tx, SEED.delta);
      const replay = await tx.query<{ id: string; replayed: boolean }>(create, [
        KEY,
        "license",
        "B1 licence",
        first.path,
        "application/pdf",
        first.size,
        first.hash,
        "2030-01-31",
        null,
      ]);
      expect(replay.rows[0]).toEqual({ id: first.id, replayed: true });
      // Same file and key, other title.
      expect(
        await queryError(tx, create, [
          KEY,
          "license",
          "Another title",
          first.path,
          "application/pdf",
          first.size,
          first.hash,
          "2030-01-31",
          null,
        ]),
      ).toMatch(/reused with a different request/);
      // Another file under the same key: its own path, then the conflict.
      const other = await upload(tx, SEED.delta, KEY, "%PDF-1.4 another file");
      expect(
        await queryError(tx, create, [
          KEY,
          "license",
          "B1 licence",
          other.path,
          "application/pdf",
          other.size,
          other.hash,
          "2030-01-31",
          null,
        ]),
      ).toMatch(/reused with a different request/);
      expect(
        await rowCount(tx, "select 1 from public.professional_documents where owner_id = $1", [
          SEED.delta,
        ]),
      ).toBe(1);
    });
  });

  it("the path must be derived from (owner, key, hash) and the object must exist with that size", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const object = await upload(tx, SEED.delta, KEY, "%PDF-1.4 x");
      const args = (path: string, size = object.size, hash = object.hash, key = KEY) => [
        key,
        "other",
        "Doc",
        path,
        "application/pdf",
        size,
        hash,
        null,
        null,
      ];
      expect(await queryError(tx, create, args(`${SEED.delta}/../${SEED.echo}/x`))).toMatch(
        /storage path does not match/,
      );
      expect(await queryError(tx, create, args(pathFor(SEED.echo, KEY, object.hash)))).toMatch(
        /storage path does not match/,
      );
      // Derived path, but nothing uploaded there.
      const otherKey = "4d0f2e8b-6c3a-4f9b-8d2e-3a4b5c6d7e8f";
      expect(
        await queryError(
          tx,
          create,
          args(pathFor(SEED.delta, otherKey, object.hash), object.size, object.hash, otherKey),
        ),
      ).toMatch(/document object not found/);
      // Object there, but another size than Storage recorded.
      expect(await queryError(tx, create, args(object.path, object.size + 1))).toMatch(
        /document object not found/,
      );
      // Direct PostgREST insert for another owner / into another owner's folder.
      expect(
        await queryError(
          tx,
          `insert into public.professional_documents (owner_id, kind, title, storage_path, mime_type, size_bytes, sha256)
           values ($1, 'other', 'x', $2, 'application/pdf', 1, $3)`,
          [SEED.echo, pathFor(SEED.echo, KEY, object.hash), object.hash],
        ),
      ).toMatch(/row-level security|document object not found/);
      expect(
        await queryError(
          tx,
          `insert into public.professional_documents (owner_id, kind, title, storage_path, mime_type, size_bytes, sha256)
           values ($1, 'other', 'x', $2, 'application/pdf', $3, $4)`,
          [SEED.delta, pathFor(SEED.echo, KEY, object.hash), object.size, object.hash],
        ),
      ).toMatch(/professional_documents_storage_path_check|document object not found/);
    });
  });

  it("CHECKs: size 1..5 MiB, three mime types, lower-case sha256, title 1..180, strict path", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      await tx.exec("reset role"); // superuser: CHECKs only, no RLS or grants in the way
      // …and no object/size backstop (tested above): only the CHECKs decide here.
      await tx.exec(
        "alter table public.professional_documents disable trigger professional_documents_enforce",
      );
      const hash = sha("check");
      const path = pathFor(SEED.delta, KEY, hash);
      await tx.query(
        "insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, '{}')",
        [BUCKET, path, SEED.delta],
      );
      const insert = (overrides: Record<string, unknown>) => {
        const v = {
          storage_path: path,
          mime_type: "application/pdf",
          size_bytes: 10,
          sha256: hash,
          title: "ok",
          ...overrides,
        };
        return queryError(
          tx,
          `insert into public.professional_documents (owner_id, kind, title, storage_path, mime_type, size_bytes, sha256)
           values ($1, 'other', $2, $3, $4, $5, $6)`,
          [SEED.delta, v.title, v.storage_path, v.mime_type, v.size_bytes, v.sha256],
        );
      };
      expect(await insert({ size_bytes: 0 })).toMatch(/size_bytes_check/);
      expect(await insert({ size_bytes: 5242881 })).toMatch(/size_bytes_check/);
      expect(await insert({ mime_type: "text/html" })).toMatch(/mime_type_check/);
      expect(await insert({ mime_type: "image/svg+xml" })).toMatch(/mime_type_check/);
      expect(await insert({ sha256: hash.toUpperCase() })).toMatch(/sha256_check/);
      expect(await insert({ title: "" })).toMatch(/title_check/);
      expect(await insert({ title: "x".repeat(181) })).toMatch(/title_check/);
      for (const bad of [
        `${SEED.delta}/../${SEED.echo}/x`,
        `${SEED.delta}/evil.exe`,
        `${SEED.delta}/${KEY}-${hash.slice(0, 16)}/extra`,
        `${SEED.echo}/${KEY}-${hash.slice(0, 16)}`,
      ]) {
        await tx.query(
          "insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, '{}')",
          [BUCKET, bad, SEED.delta],
        );
        expect(await insert({ storage_path: bad }), bad).toMatch(/storage_path_check/);
      }
    });
  });

  it("scan_status, storage_path, owner, mime, size and hash are not writable by users", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const doc = await createDoc(tx, SEED.delta);
      for (const set of [
        "scan_status = 'clean'",
        "storage_path = storage_path",
        `owner_id = '${SEED.echo}'`,
        "mime_type = 'image/png'",
        "size_bytes = 1",
        "sha256 = sha256",
      ]) {
        expect(
          await queryError(tx, `update public.professional_documents set ${set} where id = $1`, [
            doc.id,
          ]),
          set,
        ).toMatch(/permission denied/);
      }
      const object = await upload(tx, SEED.delta, "5e1a3f9c-7d4b-4a0c-9e3f-4b5c6d7e8f90", "%PDF-x");
      expect(
        await queryError(
          tx,
          `insert into public.professional_documents (owner_id, kind, title, storage_path, mime_type, size_bytes, sha256, scan_status)
           values ($1, 'other', 'x', $2, 'application/pdf', $3, $4, 'clean')`,
          [SEED.delta, object.path, object.size, object.hash],
        ),
      ).toMatch(/permission denied/);
    });
  });

  it("a document links only to its owner's own qualification", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      await tx.exec("reset role");
      const own = await tx.query<{ id: string }>(
        "select id from public.technician_qualifications where technician_profile_id = $1 limit 1",
        [SEED.delta],
      );
      const foreign = await tx.query<{ id: string }>(
        "select id from public.technician_qualifications where technician_profile_id = $1 limit 1",
        [SEED.echo],
      );
      expect(own.rows[0] && foreign.rows[0]).toBeTruthy();
      await tx.exec("set local role authenticated");
      expect(
        await queryError(
          tx,
          create,
          await (async () => {
            const o = await upload(tx, SEED.delta, KEY, "%PDF-q");
            return [
              KEY,
              "license",
              "x",
              o.path,
              "application/pdf",
              o.size,
              o.hash,
              null,
              foreign.rows[0]!.id,
            ];
          })(),
        ),
      ).toMatch(/qualification must belong to the document owner/);
      const doc = await createDoc(
        tx,
        SEED.delta,
        "6f2b4a0d-8e5c-4b1d-af4a-5c6d7e8f9a01",
        "%PDF-q2",
        {
          qualificationId: own.rows[0]!.id,
        },
      );
      expect(
        await queryError(
          tx,
          "update public.professional_documents set qualification_id = $2 where id = $1",
          [doc.id, foreign.rows[0]!.id],
        ),
      ).toMatch(/qualification must belong to the document owner/);
      // Removing the qualification keeps the document and clears the link.
      await tx.query("delete from public.technician_qualifications where id = $1", [
        own.rows[0]!.id,
      ]);
      const { rows } = await tx.query(
        "select qualification_id from public.professional_documents where id = $1",
        [doc.id],
      );
      expect(rows).toEqual([{ qualification_id: null }]);
    });
  });

  it("another professional, org admin, manager and platform admin see and change nothing — rows or objects", async () => {
    let doc = { id: "", path: "", hash: "", size: 0 };
    // Persist one document for these checks, removed at the end.
    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: SEED.delta, role: "authenticated" }),
      ]);
      await tx.exec("set local role authenticated");
      const created = await createDoc(tx, SEED.delta, "7a3c5b1e-9f6d-4c2e-8b5a-6d7e8f9a0b12");
      doc = created;
    });
    try {
      for (const user of [SEED.echo, SEED.adminMro, SEED.managerMro, SEED.platformAdmin]) {
        await asUser(db, user, async (tx) => {
          expect(
            await rowCount(tx, "select * from public.professional_documents where owner_id = $1", [
              SEED.delta,
            ]),
            user,
          ).toBe(0);
          expect(
            await rowCount(tx, "select * from storage.objects where bucket_id = $1", [BUCKET]),
            user,
          ).toBe(0);
          expect(
            (
              await tx.query(
                "update public.professional_documents set title = 'pwned' where id = $1",
                [doc.id],
              )
            ).affectedRows,
            user,
          ).toBe(0);
          expect(
            (await tx.query("delete from public.professional_documents where id = $1", [doc.id]))
              .affectedRows,
            user,
          ).toBe(0);
          expect(
            (await tx.query("delete from storage.objects where name = $1", [doc.path]))
              .affectedRows,
            user,
          ).toBe(0);
          expect(
            (
              await tx.query("update storage.objects set owner = $2 where name = $1", [
                doc.path,
                user,
              ])
            ).affectedRows,
            user,
          ).toBe(0);
          // Cannot plant an object in the owner's folder…
          expect(
            await queryError(
              tx,
              "insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3)",
              [BUCKET, pathFor(SEED.delta, "8b4d6c2f-0a7e-4d3f-9c6b-7e8f9a0b1c23", doc.hash), user],
            ),
            user,
          ).toMatch(/row-level security/);
          // …nor create a row pointing at the owner's object.
          expect(
            await queryError(tx, create, [
              "7a3c5b1e-9f6d-4c2e-8b5a-6d7e8f9a0b12",
              "license",
              "B1 licence",
              doc.path,
              "application/pdf",
              doc.size,
              doc.hash,
              "2030-01-31",
              null,
            ]),
            user,
          ).toMatch(/storage path does not match|row-level security|permission denied/);
          // Document audit rows carry no organization: only platform admins read them.
          const audit = await rowCount(
            tx,
            "select * from public.audit_events where entity_id = $1",
            [doc.id],
          );
          expect(audit, user).toBe(user === SEED.platformAdmin ? 1 : 0);
        });
      }
      await asUser(db, null, async (tx) => {
        expect(await queryError(tx, "select * from public.professional_documents")).toMatch(
          /permission denied/,
        );
        expect(await rowCount(tx, "select * from storage.objects")).toBe(0);
        expect(
          await queryError(tx, create, [
            KEY,
            "license",
            "x",
            doc.path,
            "application/pdf",
            1,
            doc.hash,
            null,
            null,
          ]),
        ).toMatch(/permission denied/);
      });
      // The owner still has it, untouched.
      await asUser(db, SEED.delta, async (tx) => {
        const { rows } = await tx.query(
          "select title from public.professional_documents where id = $1",
          [doc.id],
        );
        expect(rows).toEqual([{ title: "B1 licence" }]);
      });
    } finally {
      await db.query("delete from public.professional_documents where id = $1", [doc.id]);
      await db.query("delete from storage.objects where name = $1", [doc.path]);
      await db.query("delete from public.audit_events where entity_id = $1", [doc.id]);
    }
  });

  it("organization accounts (no technician profile) cannot upload into the bucket (review M-2)", async () => {
    for (const user of [SEED.adminMro, SEED.adminOther, SEED.adminAirline]) {
      await asUser(db, user, async (tx) => {
        expect(
          await queryError(
            tx,
            "insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4)",
            [BUCKET, pathFor(user, KEY, sha("x")), user, '{"size":1}'],
          ),
          user,
        ).toMatch(/row-level security/);
      });
    }
  });

  it("an object without a recorded size cannot back a document (fails closed, review L-2)", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const hash = sha("%PDF-nosize");
      const path = pathFor(SEED.delta, KEY, hash);
      await tx.query(
        "insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, '{}')",
        [BUCKET, path, SEED.delta],
      );
      expect(
        await queryError(tx, create, [
          KEY,
          "other",
          "x",
          path,
          "application/pdf",
          11,
          hash,
          null,
          null,
        ]),
      ).toMatch(/document object not found/);
    });
  });

  it("an object name that is not the server-derived shape is refused by Storage RLS", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      for (const name of [
        `${SEED.delta}/licence.pdf`,
        `${SEED.delta}/../${SEED.echo}/${KEY}-0123456789abcdef`,
        `${SEED.delta}/sub/${KEY}-0123456789abcdef`,
        `${KEY}-0123456789abcdef`,
      ]) {
        expect(
          await queryError(
            tx,
            "insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3)",
            [BUCKET, name, SEED.delta],
          ),
          name,
        ).toMatch(/row-level security/);
      }
    });
  });
  describe("R. activation gate, tombstones, retention and reconciliation (migration 20261019160200)", () => {
    const flagOff = async (tx: Transaction, uid: string) => {
      await tx.exec("reset role");
      await tx.query("delete from app_private.feature_flags where name = 'document_wallet'");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: uid, role: "authenticated" }),
      ]);
      await tx.exec("set local role authenticated");
    };
    const asSuper = async <T>(tx: Transaction, uid: string, fn: () => Promise<T>) => {
      await tx.exec("reset role");
      const out = await fn();
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: uid, role: "authenticated" }),
      ]);
      await tx.exec("set local role authenticated");
      return out;
    };
    const tombstones = (tx: Transaction, path: string) =>
      tx.query<{
        id: string;
        reason: string;
        due_now: boolean;
        grace_days: number;
        legal_hold: boolean;
      }>(
        `select id, reason, purge_after <= now() as due_now,
                round(extract(epoch from purge_after - deleted_at) / 86400)::int as grace_days, legal_hold
         from app_private.document_object_tombstones where storage_path = $1`,
        [path],
      );

    it("flag off: no new document by RPC, direct insert or direct upload; existing ones stay readable, editable, deletable", async () => {
      await asUser(db, SEED.delta, async (tx) => {
        const doc = await createDoc(tx, SEED.delta);
        await flagOff(tx, SEED.delta);
        expect(
          (await tx.query("select public.is_feature_enabled('document_wallet') as on")).rows,
        ).toEqual([{ on: false }]);
        const key2 = "9c5e7d3a-1b8f-4e4a-8d7c-8f9a0b1c2d34";
        expect(
          await queryError(
            tx,
            "insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4)",
            [BUCKET, pathFor(SEED.delta, key2, sha("off")), SEED.delta, '{"size":3}'],
          ),
        ).toMatch(/row-level security/);
        const path2 = pathFor(SEED.delta, key2, sha("off"));
        await asSuper(tx, SEED.delta, () =>
          tx.query(
            "insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4)",
            [BUCKET, path2, SEED.delta, '{"size":3}'],
          ),
        );
        expect(
          await queryError(tx, create, [
            key2,
            "other",
            "x",
            path2,
            "application/pdf",
            3,
            sha("off"),
            null,
            null,
          ]),
        ).toMatch(/document wallet is not enabled/);
        expect(
          await queryError(
            tx,
            `insert into public.professional_documents (owner_id, kind, title, storage_path, mime_type, size_bytes, sha256)
             values ($1, 'other', 'x', $2, 'application/pdf', 3, $3)`,
            [SEED.delta, path2, sha("off")],
          ),
        ).toMatch(/row-level security/);
        expect(
          await rowCount(tx, "select 1 from public.professional_documents where id = $1", [doc.id]),
        ).toBe(1);
        expect(
          (await tx.query("select 1 from storage.objects where name = $1", [doc.path])).rows,
        ).toHaveLength(1);
        expect(
          (
            await tx.query(
              "update public.professional_documents set title = 'Still mine' where id = $1",
              [doc.id],
            )
          ).affectedRows,
        ).toBe(1);
        expect(
          (await tx.query("delete from public.professional_documents where id = $1", [doc.id]))
            .affectedRows,
        ).toBe(1);
        expect(
          (await tx.query("delete from storage.objects where name = $1", [doc.path])).affectedRows,
        ).toBe(1);
      });
    });

    it("is_feature_enabled answers only whitelisted names and only to signed-in users", async () => {
      await asUser(db, SEED.delta, async (tx) => {
        await asSuper(tx, SEED.delta, () =>
          tx.query(
            "insert into app_private.feature_flags (name, enabled) values ('qualification_review', true) on conflict (name) do update set enabled = true",
          ),
        );
        const { rows } = await tx.query(
          "select public.is_feature_enabled('document_wallet') a, public.is_feature_enabled('qualification_review') b, public.is_feature_enabled('x') c",
        );
        expect(rows).toEqual([{ a: true, b: false, c: false }]);
        expect(await queryError(tx, "select * from app_private.feature_flags")).toMatch(
          /permission denied/,
        );
      });
      await asUser(db, null, async (tx) => {
        expect(await queryError(tx, "select public.is_feature_enabled('document_wallet')")).toMatch(
          /permission denied/,
        );
      });
    });

    it("tombstones: owner delete is due now; account deletion and operator deletes wait for the configurable grace", async () => {
      await asUser(db, SEED.delta, async (tx) => {
        const own = await createDoc(
          tx,
          SEED.delta,
          "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
          "%PDF-own",
        );
        await tx.query("delete from public.professional_documents where id = $1", [own.id]);
        expect((await asSuper(tx, SEED.delta, () => tombstones(tx, own.path))).rows).toMatchObject([
          { reason: "owner_delete", due_now: true, legal_hold: false },
        ]);

        const op = await createDoc(
          tx,
          SEED.delta,
          "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
          "%PDF-op",
        );
        const casc = await createDoc(
          tx,
          SEED.delta,
          "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f",
          "%PDF-casc",
        );
        await tx.exec("reset role");
        await tx.query("select set_config('request.jwt.claims', '', true)");
        await tx.query("delete from public.professional_documents where id = $1", [op.id]);
        expect((await tombstones(tx, op.path)).rows).toMatchObject([
          { reason: "operator_delete", due_now: false, grace_days: 30 },
        ]);
        // Settings drive the grace (proposal: 30 days), not the code.
        await tx.query(
          "update app_private.document_retention_settings set account_deletion_grace = interval '7 days'",
        );
        await tx.query("delete from public.technician_profiles where profile_id = $1", [
          SEED.delta,
        ]);
        expect((await tombstones(tx, casc.path)).rows).toMatchObject([
          { reason: "account_deleted", due_now: false, grace_days: 7 },
        ]);
        expect(
          await queryError(
            tx,
            "update app_private.document_retention_settings set account_deletion_grace = interval '-1 day'",
          ),
        ).toMatch(/check/);
      });
      await asUser(db, SEED.delta, async (tx) => {
        expect(
          await queryError(tx, "select * from app_private.document_object_tombstones"),
        ).toMatch(/permission denied/);
        expect(
          await queryError(tx, "select * from app_private.document_retention_settings"),
        ).toMatch(/permission denied/);
      });
    });

    it("maintenance RPCs: platform admin only; reconciliation never marks a referenced or young object; legal hold is never due", async () => {
      await asUser(db, SEED.delta, async (tx) => {
        const kept = await createDoc(
          tx,
          SEED.delta,
          "4d5e6f7a-8b9c-4d0e-9f1a-3b4c5d6e7f80",
          "%PDF-kept",
        );
        const orphanOld = await upload(
          tx,
          SEED.delta,
          "5e6f7a8b-9c0d-4e1f-8a2b-4c5d6e7f8091",
          "%PDF-old",
        );
        const orphanYoung = await upload(
          tx,
          SEED.delta,
          "6f7a8b9c-0d1e-4f2a-9b3c-5d6e7f8091a2",
          "%PDF-young",
        );
        const held = await createDoc(
          tx,
          SEED.delta,
          "7a8b9c0d-1e2f-4a3b-8c4d-6e7f8091a2b3",
          "%PDF-held",
        );
        await tx.query("delete from public.professional_documents where id = $1", [held.id]);
        for (const [name, args] of [
          ["document_maintenance_batch", "(true, 10)"],
          ["document_purge_recheck", "(gen_random_uuid())"],
          ["document_purge_record", "(gen_random_uuid(), 'purged', null)"],
        ]) {
          expect(await queryError(tx, `select * from public.${name}${args}`), name).toMatch(
            /not authorized/,
          );
        }
        await tx.exec("reset role");
        await tx.query(
          "update storage.objects set created_at = now() - interval '2 days' where name = any($1)",
          [[kept.path, orphanOld.path, held.path]],
        );
        await tx.query(
          "update app_private.document_object_tombstones set legal_hold = true where storage_path = $1",
          [held.path],
        );
        await tx.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: SEED.platformAdmin, role: "authenticated" }),
        ]);
        await tx.exec("set local role authenticated");

        const dry = await tx.query<{
          tombstone_id: string | null;
          storage_path: string;
          action: string;
        }>("select * from public.document_maintenance_batch(false, 50)");
        expect(
          dry.rows.filter((r) => r.action === "would_tombstone").map((r) => r.storage_path),
        ).toEqual([orphanOld.path]);
        const paths = dry.rows.map((r) => r.storage_path);
        expect(paths).not.toContain(kept.path);
        expect(paths).not.toContain(orphanYoung.path);
        expect(paths).not.toContain(held.path);
        const countOpen = async () =>
          asSuper(
            tx,
            SEED.platformAdmin,
            async () =>
              (
                await tx.query<{ n: number }>(
                  "select count(*)::int n from app_private.document_object_tombstones where purged_at is null",
                )
              ).rows[0]!.n,
          );
        const before = await countOpen();
        const applied = await tx.query<{
          tombstone_id: string;
          storage_path: string;
          reason: string;
          action: string;
        }>("select * from public.document_maintenance_batch(true, 50)");
        expect(await countOpen()).toBe(before + 1);
        const orphan = applied.rows.find((r) => r.storage_path === orphanOld.path)!;
        expect(orphan).toMatchObject({ reason: "orphan_upload", action: "purge" });
        expect(applied.rows.map((r) => r.storage_path)).not.toContain(held.path);
        await tx.query("select * from public.document_maintenance_batch(true, 50)");
        expect(await countOpen()).toBe(before + 1); // idempotent

        const heldId = (await asSuper(tx, SEED.platformAdmin, () => tombstones(tx, held.path)))
          .rows[0]!.id;
        expect(
          (await tx.query("select allowed, why from public.document_purge_recheck($1)", [heldId]))
            .rows,
        ).toEqual([{ allowed: false, why: "legal_hold" }]);
        expect(
          (
            await tx.query("select allowed, why from public.document_purge_recheck($1)", [
              orphan.tombstone_id,
            ])
          ).rows,
        ).toEqual([{ allowed: true, why: "ok" }]);
        // A row appearing for the path between plan and delete blocks the purge.
        await asSuper(tx, SEED.platformAdmin, () =>
          tx.query(
            `insert into public.professional_documents (owner_id, kind, title, storage_path, mime_type, size_bytes, sha256)
             values ($1, 'other', 'late', $2, 'application/pdf', $3, $4)`,
            [SEED.delta, orphanOld.path, orphanOld.size, orphanOld.hash],
          ),
        );
        expect(
          (
            await tx.query("select allowed, why from public.document_purge_recheck($1)", [
              orphan.tombstone_id,
            ])
          ).rows,
        ).toEqual([{ allowed: false, why: "referenced" }]);
        await asSuper(tx, SEED.platformAdmin, () =>
          tx.query("delete from public.professional_documents where storage_path = $1", [
            orphanOld.path,
          ]),
        );

        await tx.query("select public.document_purge_record($1, 'failed', 'storage_500')", [
          orphan.tombstone_id,
        ]);
        await tx.query("select public.document_purge_record($1, 'purged', null)", [
          orphan.tombstone_id,
        ]);
        await tx.query("select public.document_purge_record($1, 'purged', null)", [
          orphan.tombstone_id,
        ]);
        expect(
          (
            await tx.query("select allowed, why from public.document_purge_recheck($1)", [
              orphan.tombstone_id,
            ])
          ).rows,
        ).toEqual([{ allowed: false, why: "already_purged" }]);
        const audit = await tx.query<{ metadata: Record<string, unknown> }>(
          "select metadata from public.audit_events where action = 'document.purged' and entity_id = $1",
          [orphan.tombstone_id],
        );
        expect(audit.rows).toEqual([
          {
            metadata: {
              technician_profile_id: SEED.delta,
              reason: "orphan_upload",
              object_found: true,
            },
          },
        ]);
        expect(JSON.stringify(audit.rows)).not.toContain(orphanOld.path);
        expect(
          await queryError(tx, "select public.document_purge_record($1, 'nuke', null)", [
            orphan.tombstone_id,
          ]),
        ).toMatch(/invalid outcome/);
      });
      await asUser(db, null, async (tx) => {
        expect(
          await queryError(tx, "select * from public.document_maintenance_batch(false, 1)"),
        ).toMatch(/permission denied/);
      });
    });
  });
});

describe("R. closing a requirement (V1.8 job.status, migrations 20261020120000/120100)", () => {
  const status = async (tx: { query: PGlite["query"] }) =>
    (
      await tx.query<{ status: string }>(
        "select status from public.work_requirements where id = $1",
        [madRequirementId],
      )
    ).rows[0]?.status;

  it("a manager closes it; the change is audited with actor, from and to", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      await tx.query("update public.work_requirements set status = 'closed' where id = $1", [
        madRequirementId,
      ]);
      expect(await status(tx)).toBe("closed");
      await tx.exec("reset role"); // the trail is admin-only (audit_events_select): read as owner
      const { rows } = await tx.query<{ actor_profile_id: string; metadata: unknown }>(
        `select actor_profile_id, metadata from public.audit_events
         where entity_id = $1 and action = 'requirement.status_changed'`,
        [madRequirementId],
      );
      expect(rows).toEqual([
        { actor_profile_id: SEED.managerMro, metadata: { from: "open", to: "closed" } },
      ]);
    });
  });

  it("a closed requirement is never reopened, even by a direct write", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      await tx.query("update public.work_requirements set status = 'closed' where id = $1", [
        madRequirementId,
      ]);
      for (const next of ["open", "covered", "draft", "cancelled"]) {
        expect(
          await queryError(
            tx,
            `update public.work_requirements set status = '${next}' where id = $1`,
            [madRequirementId],
          ),
        ).toMatch(/cannot be (reopened|changed)/);
      }
      expect(await status(tx)).toBe("closed");
    });
  });

  it("a closed requirement is frozen: no field edits, no qualification changes (M1 review)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      await tx.query("update public.work_requirements set status = 'closed' where id = $1", [
        madRequirementId,
      ]);
      for (const sql of [
        "update public.work_requirements set title = 'Rewritten' where id = $1",
        "update public.work_requirements set headcount = 9 where id = $1",
        "update public.work_requirements set ends_at = ends_at + interval '1 day' where id = $1",
        "delete from public.work_requirement_qualifications where work_requirement_id = $1",
      ]) {
        expect(await queryError(tx, sql, [madRequirementId])).toMatch(/cannot be changed/);
      }
      const { rows } = await tx.query<{ id: string }>(
        "select id from public.qualification_types where code = 'NDT-UT2'",
      );
      expect(
        await queryError(
          tx,
          `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
           values ($1, $2, 'soft')`,
          [madRequirementId, rows[0]!.id],
        ),
      ).toMatch(/cannot be changed/);
    });
  });

  it("an open requirement keeps its qualification edits (BR-1.4 parent touch still works)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "select id from public.qualification_types where code = 'NDT-UT2'",
      );
      await tx.query(
        `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
         values ($1, $2, 'soft')`,
        [madRequirementId, rows[0]!.id],
      );
      await tx.exec("set constraints all immediate");
      expect(await status(tx)).toBe("open");
    });
  });

  it("deleting the organization still cascades through a closed requirement (account deletion)", async () => {
    await db
      .transaction(async (owner) => {
        await owner.query("update public.work_requirements set status = 'closed' where id = $1", [
          madRequirementId,
        ]);
        await owner.query("delete from public.organizations where id = $1", [mroId]);
        const { rows } = await owner.query(
          "select 1 from public.work_requirement_qualifications where work_requirement_id = $1",
          [madRequirementId],
        );
        expect(rows).toHaveLength(0);
        const parent = await owner.query("select 1 from public.work_requirements where id = $1", [
          madRequirementId,
        ]);
        expect(parent.rows).toHaveLength(0);
        throw new Error("rollback");
      })
      .catch((error: Error) => expect(error.message).toBe("rollback"));
  });

  it("plain members and other organizations cannot close it (no rows touched)", async () => {
    for (const user of [SEED.charlieMember, SEED.adminOther]) {
      await asUser(db, user, async (tx) => {
        const { affectedRows } = await tx.query(
          "update public.work_requirements set status = 'closed' where id = $1",
          [madRequirementId],
        );
        expect(affectedRows ?? 0).toBe(0);
      });
    }
    expect(await status(db)).toBe("open");
  });
});

describe("S. requirement lifecycle (M05, migrations 20261022130000/130100)", () => {
  const status = async (tx: { query: PGlite["query"] }) =>
    (
      await tx.query<{ status: string }>(
        "select status from public.work_requirements where id = $1",
        [madRequirementId],
      )
    ).rows[0]?.status;

  it("a manager pauses and resumes; each change is audited with from and to", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      for (const next of ["paused", "open"]) {
        await tx.query("update public.work_requirements set status = $2 where id = $1", [
          madRequirementId,
          next,
        ]);
      }
      expect(await status(tx)).toBe("open");
      await tx.exec("reset role");
      // Same transaction → same created_at: compare as a set.
      const { rows } = await tx.query<{ metadata: { from: string; to: string } }>(
        `select metadata from public.audit_events
         where entity_id = $1 and action = 'requirement.status_changed'`,
        [madRequirementId],
      );
      expect(rows.map((r) => `${r.metadata.from}→${r.metadata.to}`).sort()).toEqual([
        "open→paused",
        "paused→open",
      ]);
    });
  });

  it("SQL allows exactly the status changes of the domain table (canChangeRequirementStatus)", async () => {
    const mismatches: string[] = [];
    await db.transaction(async (owner) => {
      for (const from of REQUIREMENT_STATUSES) {
        for (const to of REQUIREMENT_STATUSES) {
          if (from === to) continue;
          await owner.exec("savepoint pair");
          const { rows } = await owner.query<{ id: string }>(
            `insert into public.work_requirements (organization_id, title, location, starts_at, ends_at, headcount, status, created_by)
             values ($1, 'Lifecycle pair', 'MAD', now() + interval '1 day', now() + interval '2 days', 1, $2, $3)
             returning id`,
            [mroId, from, SEED.adminMro],
          );
          let ok = true;
          try {
            await owner.query("update public.work_requirements set status = $2 where id = $1", [
              rows[0]!.id,
              to,
            ]);
          } catch {
            ok = false;
          }
          await owner.exec("rollback to savepoint pair");
          if (ok !== canChangeRequirementStatus(from, to))
            mismatches.push(`${from}→${to}: SQL ${ok}`);
        }
      }
      await owner.rollback();
    });
    expect(mismatches).toEqual([]);
  });

  it("nothing moves into cancelled or covered by hand, not even an admin", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      for (const next of ["cancelled", "covered", "draft"]) {
        expect(
          await queryError(
            tx,
            `update public.work_requirements set status = '${next}' where id = $1`,
            [madRequirementId],
          ),
        ).toMatch(/is not allowed/);
      }
      expect(await status(tx)).toBe("open");
    });
  });

  it("a paused requirement can be closed, and then never resumed", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      for (const next of ["paused", "closed"]) {
        await tx.query("update public.work_requirements set status = $2 where id = $1", [
          madRequirementId,
          next,
        ]);
      }
      expect(
        await queryError(tx, "update public.work_requirements set status = 'open' where id = $1", [
          madRequirementId,
        ]),
      ).toMatch(/cannot be (reopened|changed)/);
    });
  });

  it("plain members and other organizations cannot pause it (no rows touched)", async () => {
    for (const user of [SEED.charlieMember, SEED.adminOther, SEED.delta]) {
      await asUser(db, user, async (tx) => {
        const { affectedRows } = await tx.query(
          "update public.work_requirements set status = 'paused' where id = $1",
          [madRequirementId],
        );
        expect(affectedRows ?? 0).toBe(0);
      });
    }
    expect(await status(db)).toBe("open");
  });
});

// ---------------------------------------------------------------------------------------------
// M07 opportunities (D-12), M08 applications (D-06) and the M05 edit — owner decisions of 2026-10-22,
// migrations 20261022130200 / 20261022130300. Every case runs inside a rolled-back transaction.
// ---------------------------------------------------------------------------------------------

/** Switches the acting user inside one transaction (null = anon). */
async function actAs(tx: Transaction, userId: string | null) {
  await tx.exec("reset role");
  await tx.query("select set_config('request.jwt.claims', $1, true)", [
    userId ? JSON.stringify({ sub: userId, role: "authenticated" }) : "",
  ]);
  await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
}

/** A statement expected to fail: its SQLSTATE and message (a savepoint keeps the transaction usable). */
async function sqlError(tx: Transaction, sql: string, params: unknown[] = []) {
  await tx.exec("savepoint expected_error");
  try {
    await tx.query(sql, params);
  } catch (error) {
    await tx.exec("rollback to savepoint expected_error");
    const e = error as { code?: string; message: string };
    return { code: e.code, message: e.message };
  }
  throw new Error(`expected statement to fail: ${sql}`);
}

/** Owner-side fixture: a requirement with hard B1.1 + TR-A320 and soft SMS (UTC offsets from now()). */
async function createNeed(
  tx: Transaction,
  opts: {
    org: string;
    createdBy: string;
    title?: string;
    headcount?: number;
    urgency?: "planned" | "urgent" | "aog";
    status?: string;
    startsIn?: string;
    endsIn?: string;
  },
): Promise<string> {
  await tx.exec("reset role");
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.work_requirements
       (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
     values ($1, $2, 'Madrid (MAD)', now() + $3::interval, now() + $4::interval, 'day', $5, $6, $7, $8)
     returning id`,
    [
      opts.org,
      opts.title ?? "Applications fixture",
      opts.startsIn ?? "5 days",
      opts.endsIn ?? "8 days",
      opts.headcount ?? 1,
      opts.urgency ?? "planned",
      opts.status === "closed" ? "open" : (opts.status ?? "open"), // closed is frozen: close it below
      opts.createdBy,
    ],
  );
  const id = rows[0]!.id;
  await tx.query(
    `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
     select $1, id, case when code = 'SMS' then 'soft' else 'hard' end::public.requirement_level
     from public.qualification_types where code in ('B1.1', 'TR-A320', 'SMS')`,
    [id],
  );
  if (opts.status === "closed")
    await tx.query("update public.work_requirements set status = 'closed' where id = $1", [id]);
  return id;
}

/** Owner-side fixture: the seed professionals are available around now (their October windows end). */
async function makeAvailable(tx: Transaction, profiles: string[]) {
  await tx.exec("reset role");
  await tx.query(
    `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
     select p, now() - interval '30 days', now() + interval '120 days', 'available' from unnest($1::uuid[]) p`,
    [profiles],
  );
}

/** Owner-side shortcut: an application already in `status` (with proposal v1 when the state needs one). */
async function seedApplication(
  tx: Transaction,
  requirementId: string,
  technician: string,
  status: string,
) {
  await tx.exec("reset role");
  const id = randomUUID();
  const proposal = ["proposed", "accepted", "confirmed", "finished", "cancelled"].includes(status)
    ? randomUUID()
    : null;
  const accepted = ["accepted", "confirmed", "finished", "cancelled"].includes(status)
    ? proposal
    : null;
  await tx.query(
    `insert into public.applications
       (id, requirement_id, technician_profile_id, status, current_proposal_id, accepted_proposal_id, reason)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      requirementId,
      technician,
      status,
      proposal,
      accepted,
      ["rejected", "cancelled"].includes(status) ? "Fixture" : null,
    ],
  );
  if (proposal) {
    await tx.query(
      "insert into public.application_proposals (id, application_id, version, terms) values ($1, $2, 1, '{}')",
      [proposal, id],
    );
  }
  return id;
}

interface TransitionRow {
  application_id: string;
  status: string;
  event_id: string;
  proposal_id: string | null;
  updated_at: Date;
  replayed: boolean;
}

const TRANSITION_SQL = "select * from public.transition_application($1, $2, $3, $4, $5, $6)";

/** The arguments of one transition; the expected version is read as the owner unless given. */
async function transitionArgs(
  tx: Transaction,
  applicationId: string,
  to: string,
  opts: { reason?: string; proposalId?: string | null; key?: string; expected?: string },
) {
  await tx.exec("reset role");
  const expected =
    opts.expected ??
    (
      await tx.query<{ updated_at: Date }>(
        "select updated_at from public.applications where id = $1",
        [applicationId],
      )
    ).rows[0]?.updated_at.toISOString() ??
    new Date().toISOString();
  return [
    applicationId,
    to,
    expected,
    opts.key ?? randomUUID(),
    opts.reason ?? null,
    opts.proposalId ?? null,
  ];
}

async function step(
  tx: Transaction,
  actor: string,
  applicationId: string,
  to: string,
  opts: { reason?: string; proposalId?: string | null; key?: string; expected?: string } = {},
): Promise<TransitionRow> {
  const args = await transitionArgs(tx, applicationId, to, opts);
  await actAs(tx, actor);
  return (await tx.query<TransitionRow>(TRANSITION_SQL, args)).rows[0]!;
}

async function stepError(
  tx: Transaction,
  actor: string,
  applicationId: string,
  to: string,
  opts: { reason?: string; proposalId?: string | null; key?: string; expected?: string } = {},
) {
  const args = await transitionArgs(tx, applicationId, to, opts);
  await actAs(tx, actor);
  return sqlError(tx, TRANSITION_SQL, args);
}

async function applyAs(
  tx: Transaction,
  technician: string,
  requirementId: string,
  key = randomUUID(),
) {
  await actAs(tx, technician);
  return (
    await tx.query<{ id: string; replayed: boolean }>(
      "select * from public.apply_to_requirement($1, $2, true)",
      [requirementId, key],
    )
  ).rows[0]!;
}

/** Received → shortlisted → proposed (v1) → accepted, the organization side acting as `manager`. */
async function toAccepted(
  tx: Transaction,
  manager: string,
  technician: string,
  applicationId: string,
) {
  await step(tx, manager, applicationId, "shortlisted");
  const proposed = await step(tx, manager, applicationId, "proposed");
  await step(tx, technician, applicationId, "accepted", { proposalId: proposed.proposal_id });
  return proposed;
}

/** Owner-side: events, audit rows and status of one application. */
async function trail(tx: Transaction, applicationId: string) {
  await tx.exec("reset role");
  const { rows } = await tx.query<{ events: number; audits: number; status: string }>(
    `select (select count(*)::int from public.application_events where application_id = $1) as events,
            (select count(*)::int from public.audit_events where entity_id = $1) as audits,
            (select status::text from public.applications where id = $1) as status`,
    [applicationId],
  );
  return rows[0]!;
}

async function requirementStatus(tx: Transaction, id: string) {
  await tx.exec("reset role");
  return (
    await tx.query<{ status: string }>(
      "select status from public.work_requirements where id = $1",
      [id],
    )
  ).rows[0]?.status;
}

const conflict = (reason: (typeof APPLICATION_CONFLICTS)[number]) =>
  `CFA${String(APPLICATION_CONFLICTS.indexOf(reason) + 1).padStart(2, "0")}`;

describe("U. opportunities for every professional (M07, D-12, migration 20261022130200)", () => {
  let airlineId: string;
  beforeAll(async () => {
    airlineId = await orgIdByName(db, "Demo Airline Ops Barcelona");
  });

  it("every professional — `private` included — lists exactly the open, current requirements of every organization", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const listed = [
        await createNeed(tx, { org: mroId, createdBy: SEED.adminMro, title: "U open MRO" }),
        await createNeed(tx, { org: otherOrgId, createdBy: SEED.adminOther, title: "U open LIS" }),
        await createNeed(tx, {
          org: airlineId,
          createdBy: SEED.adminAirline,
          title: "U open BCN",
          urgency: "aog",
        }),
        // Started but not ended: still published (applying is refused, CFA02).
        await createNeed(tx, { org: mroId, createdBy: SEED.adminMro, startsIn: "-1 day" }),
      ];
      const hidden = [];
      for (const status of ["draft", "paused", "covered", "closed", "cancelled"])
        hidden.push(await createNeed(tx, { org: mroId, createdBy: SEED.adminMro, status }));
      hidden.push(
        await createNeed(tx, {
          org: otherOrgId,
          createdBy: SEED.adminOther,
          startsIn: "-10 days",
          endsIn: "-1 day",
        }),
      );
      const truth = (
        await tx.query<{ id: string }>(
          "select id from public.work_requirements where status = 'open' and ends_at > now() order by starts_at, id",
        )
      ).rows.map((r) => r.id);
      expect(truth).toEqual(expect.arrayContaining(listed));

      for (const user of [
        SEED.delta,
        SEED.hotelPrivate,
        SEED.alpha,
        SEED.managerMro,
        SEED.platformAdmin,
      ]) {
        // v2-27 (20261024100000, T-90): never the requirements of the caller's own organizations.
        await tx.exec("reset role");
        const own = new Set(
          (
            await tx.query<{ id: string }>(
              `select wr.id from public.work_requirements wr
               join public.organization_members m on m.organization_id = wr.organization_id
               where m.profile_id = $1`,
              [user],
            )
          ).rows.map((r) => r.id),
        );
        const expected = truth.filter((id) => !own.has(id));
        await actAs(tx, user);
        const { rows } = await tx.query<{ id: string; total: number }>(
          "select id, total from public.list_opportunities()",
        );
        expect(rows.map((r) => r.id)).toEqual(expected); // deterministic: soonest first, then id
        expect(Number(rows[0]?.total)).toBe(expected.length);
        for (const id of hidden) expect(rows.some((r) => r.id === id)).toBe(false);
      }
    });
  });

  it("returns the fixed projection only: organization name, no ids of people or organizations, no counts", async () => {
    await asUser(db, SEED.hotelPrivate, async (tx) => {
      const id = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      await actAs(tx, SEED.hotelPrivate);
      const { rows } = await tx.query<Record<string, unknown>>(
        "select * from public.list_opportunities($1)",
        [id],
      );
      expect(rows).toHaveLength(1);
      expect(Object.keys(rows[0]!).sort()).toEqual(
        [
          "created_at",
          "ends_at",
          "headcount",
          "id",
          "location",
          "organization_name",
          "qualifications",
          "shift",
          "starts_at",
          "title",
          "total",
          "urgency",
          // requirement builder terms (20261023600000; tests/db/requirement-builder.test.ts)
          "conditions",
          "country",
          "description",
          "shifts",
          "time_zone",
          // the represented client's name, null here (20261024500100; tests/db/recruiter.test.ts)
          "client_name",
        ].sort(),
      );
      expect(rows[0]!.organization_name).toBe("Demo MRO Madrid");
      const quals = rows[0]!.qualifications as Record<string, unknown>[];
      expect(quals.map((q) => [q.code, q.level])).toEqual([
        ["B1.1", "hard"],
        ["TR-A320", "hard"],
        ["SMS", "soft"],
      ]);
      for (const q of quals)
        expect(Object.keys(q).sort()).toEqual(["code", "level", "name", "qualificationTypeId"]);
      expect(JSON.stringify(rows[0])).not.toContain(SEED.adminMro); // created_by never leaves
      expect(JSON.stringify(rows[0])).not.toContain(mroId);
    });
  });

  it("filters: one id (hidden ones are absent), urgency, literal text search, and a cap of 200", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const paused = await createNeed(tx, {
        org: mroId,
        createdBy: SEED.adminMro,
        status: "paused",
      });
      const aog = await createNeed(tx, {
        org: airlineId,
        createdBy: SEED.adminAirline,
        urgency: "aog",
        title: "Engine change 100% AOG",
      });
      await tx.query(
        `with wr as (
           insert into public.work_requirements
             (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
           select $1, 'Bulk need ' || g, 'LIS', now() + interval '3 days', now() + interval '4 days', 'day', 1,
                  'planned', 'open', $2
           from generate_series(1, 205) g
           returning id)
         insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
         select wr.id, qt.id, 'hard' from wr, public.qualification_types qt where qt.code = 'B2'`,
        [otherOrgId, SEED.adminOther],
      );
      await actAs(tx, SEED.delta);
      const count = async (sql: string, params: unknown[] = []) =>
        (await tx.query<{ id: string; urgency: string; total: number }>(sql, params)).rows;

      expect(await count("select * from public.list_opportunities($1)", [paused])).toEqual([]);
      expect((await count("select * from public.list_opportunities($1)", [aog])).length).toBe(1);
      const aogOnly = await count("select * from public.list_opportunities(p_urgency => 'aog')");
      expect(aogOnly.length).toBeGreaterThan(0);
      expect(aogOnly.every((r) => r.urgency === "aog")).toBe(true);
      // Case-insensitive, on the organization name too; `%` is a literal, never a wildcard.
      const byOrg = await count("select * from public.list_opportunities(p_q => 'demo AIRLINE')");
      expect(byOrg.map((r) => r.id)).toContain(aog);
      expect(
        (await count("select * from public.list_opportunities(p_q => '100%')")).map((r) => r.id),
      ).toEqual([aog]);
      expect(await count("select * from public.list_opportunities(p_q => '%')")).toEqual(
        await count("select * from public.list_opportunities(p_q => '100%')"),
      );
      const capped = await count("select * from public.list_opportunities(p_limit => 1000)");
      expect(capped).toHaveLength(200);
      expect(Number(capped[0]!.total)).toBeGreaterThan(205);
      const one = await count("select * from public.list_opportunities(p_limit => 1)");
      expect(one).toHaveLength(1);
      expect(Number(one[0]!.total)).toBe(Number(capped[0]!.total));
    });
  });

  it("organization accounts list the network minus their own (v2-20, 20261024100000), anon is denied, and the projection view is private", async () => {
    for (const [user, org] of [
      [SEED.adminMro, () => mroId],
      [SEED.adminOther, () => otherOrgId],
      [SEED.adminAirline, () => airlineId],
    ] as const) {
      await asUser(db, user, async (tx) => {
        const own = await createNeed(tx, { org: org(), createdBy: user });
        await actAs(tx, user);
        const { rows } = await tx.query<{ id: string }>(
          "select id from public.list_opportunities()",
        );
        expect(rows.some((r) => r.id === own)).toBe(false);
      });
    }
    await asUser(db, null, async (tx) => {
      for (const sql of [
        "select * from public.list_opportunities()",
        "select * from public.own_candidate_profile()",
      ])
        expect((await sqlError(tx, sql)).message).toMatch(/permission denied/);
    });
    await asUser(db, SEED.delta, async (tx) => {
      expect((await sqlError(tx, "select * from app_private.requirement_cards")).message).toMatch(
        /permission denied/,
      );
    });
  });

  it("publication opens no direct read or write path (still 0 rows; pool and edits refused)", async () => {
    for (const user of [SEED.delta, SEED.hotelPrivate]) {
      await asUser(db, user, async (tx) => {
        for (const table of [
          "work_requirements",
          "organizations",
          "work_requirement_qualifications",
          "audit_events",
          "applications",
        ])
          expect(await rowCount(tx, `select * from public.${table}`)).toBe(0);
        expect(
          (
            await sqlError(tx, "select * from public.get_requirement_candidate_pool($1)", [
              lisRequirementId,
            ])
          ).code,
        ).toBe("42501");
        const { affectedRows } = await tx.query(
          "update public.work_requirements set title = 'Hijacked' where id = $1",
          [lisRequirementId],
        );
        expect(affectedRows ?? 0).toBe(0);
      });
    }
  });

  it("own_candidate_profile returns the caller's own row only, in the candidate-pool shape", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const own = await tx.query("select * from public.own_candidate_profile()");
      expect(own.rows).toHaveLength(1);
      const me = toCandidate(own.rows[0]);
      expect(me.id).toBe(SEED.managerMro); // a manager never reads a colleague (Alpha) through it
      await actAs(tx, SEED.delta);
      const delta = toCandidate(
        (
          await tx.query("select * from public.own_candidate_profile($1, $2)", [
            "2026-10-18T00:00Z",
            "2026-10-19T00:00Z",
          ])
        ).rows[0],
      );
      expect(delta.id).toBe(SEED.delta);
      expect(delta.qualifications.map((q) => q.code)).toEqual([
        "B1.1",
        "EWIS",
        "FTS",
        "HF",
        "TR-A320",
      ]);
      expect(delta.availability).toHaveLength(1); // the October window overlaps the range
      await actAs(tx, SEED.adminMro); // organization account: no technician profile
      expect(await rowCount(tx, "select * from public.own_candidate_profile()")).toBe(0);
    });
  });
});

describe("V. applications: the D-06 state machine in the database (migration 20261022130300)", () => {
  const TECHS = [SEED.delta, SEED.echo, SEED.hotelPrivate, SEED.alpha];

  it("T1: app_private.application_transitions is exactly APPLICATION_TRANSITIONS (Q7: no accepted → rejected)", async () => {
    const { rows } = await db.query<{
      from_status: string;
      to_status: string;
      actor: string;
      reason_required: boolean;
    }>(
      "select from_status, to_status, actor, reason_required from app_private.application_transitions",
    );
    const sql = rows.map((r) => `${r.from_status}>${r.to_status}:${r.actor}:${r.reason_required}`);
    const ts = APPLICATION_TRANSITIONS.map(
      (t) => `${t.from}>${t.to}:${t.actor}:${t.reason === true}`,
    );
    expect(sql.sort()).toEqual(ts.sort());
    expect(sql.some((s) => s.startsWith("accepted>rejected"))).toBe(false);
  });

  it("the full journey: apply, shortlist, propose v1, accept, confirm; the last seat covers the requirement once", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro, headcount: 2 });
      await makeAvailable(tx, [SEED.delta, SEED.echo]);
      const a = await applyAs(tx, SEED.delta, need);
      const b = await applyAs(tx, SEED.echo, need);
      expect(a.replayed).toBe(false);
      await toAccepted(tx, SEED.managerMro, SEED.delta, a.id);
      await toAccepted(tx, SEED.managerMro, SEED.echo, b.id);
      const first = await step(tx, SEED.managerMro, a.id, "confirmed");
      expect([first.status, first.replayed]).toEqual(["confirmed", false]);
      expect(await requirementStatus(tx, need)).toBe("open"); // 1 of 2 seats
      await step(tx, SEED.adminMro, b.id, "confirmed");
      expect(await requirementStatus(tx, need)).toBe("covered");

      // One audit row per success, ids and flags only; technician-side rows carry no organization.
      const audit = await tx.query<{
        action: string;
        actor_profile_id: string | null;
        organization_id: string | null;
        metadata: Record<string, unknown>;
      }>(
        "select action, actor_profile_id, organization_id, metadata from public.audit_events where entity_id = $1 order by action",
        [a.id],
      );
      expect(audit.rows.map((r) => r.action).sort()).toEqual(
        [
          "application.accepted",
          "application.confirmed",
          "application.proposed",
          "application.received",
          "application.shortlisted",
        ].sort(),
      );
      for (const row of audit.rows) {
        const techSide = ["application.received", "application.accepted"].includes(row.action);
        expect(row.organization_id).toBe(techSide ? null : mroId);
        expect(Object.keys(row.metadata).sort()).toEqual(
          [
            "actor",
            "from",
            "proposal_version",
            "reason_provided",
            "request_id",
            "requirement_id",
            "to",
            // Applying records the explicit share consent of the form (a flag, never text).
            ...(row.action === "application.received" ? ["share_consent"] : []),
          ].sort(),
        );
      }
      const covered = await tx.query<{ actor_profile_id: string | null; metadata: unknown }>(
        "select actor_profile_id, metadata from public.audit_events where entity_id = $1 and action = 'requirement.status_changed'",
        [need],
      );
      expect(covered.rows).toEqual([
        { actor_profile_id: null, metadata: { from: "open", to: "covered", system: true } },
      ]);

      // Both parties read the same timeline (no person ids, no free text).
      await actAs(tx, SEED.delta);
      const mine = await tx.query<{
        history: { from: string | null; to: string; actor: string }[];
      }>("select history from public.get_my_applications() where application_id = $1", [a.id]);
      expect(mine.rows[0]!.history.map((h) => `${h.from}>${h.to}:${h.actor}`)).toEqual([
        "null>received:technician",
        "received>shortlisted:organization",
        "shortlisted>proposed:organization",
        "proposed>accepted:technician",
        "accepted>confirmed:organization",
      ]);
    });
  });

  it("T2: an invalid transition is 55000 and writes nothing; terminal states have no way out", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      await makeAvailable(tx, [SEED.delta]);
      const { id } = await applyAs(tx, SEED.delta, need);
      const before = await trail(tx, id);
      expect((await stepError(tx, SEED.managerMro, id, "confirmed")).code).toBe("55000");
      expect(await trail(tx, id)).toEqual(before);
      await step(tx, SEED.delta, id, "withdrawn");
      for (const [actor, to] of [
        [SEED.managerMro, "shortlisted"],
        [SEED.delta, "withdrawn"],
        [SEED.managerMro, "rejected"],
      ] as const) {
        const error = await stepError(tx, actor, id, to, to === "rejected" ? { reason: "x" } : {});
        expect(error.code).toBe("55000");
      }
      expect((await trail(tx, id)).status).toBe("withdrawn");
    });
  });

  it("T3: the wrong side is 42501; strangers get exactly what a random id gets (P0002); no self-confirm", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      await makeAvailable(tx, [SEED.delta]);
      const { id } = await applyAs(tx, SEED.delta, need);
      expect((await stepError(tx, SEED.delta, id, "shortlisted")).code).toBe("42501");
      const random = await stepError(tx, SEED.adminOther, randomUUID(), "shortlisted");
      expect(random.code).toBe("P0002");
      for (const stranger of [SEED.adminOther, SEED.charlieMember, SEED.echo, SEED.platformAdmin]) {
        expect(await stepError(tx, stranger, id, "shortlisted")).toEqual(random);
      }
      // A manager who applied to their own organization's requirement never acts on it for the org.
      const self = await seedApplication(tx, need, SEED.managerMro, "accepted");
      expect((await stepError(tx, SEED.managerMro, self, "confirmed")).code).toBe("42501");
      expect((await trail(tx, id)).status).toBe("received");
    });
  });

  it("T4 (sequential; the concurrent race is in db-race-check.sh): the second confirm of the last seat is CFA06", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro, headcount: 1 });
      await makeAvailable(tx, [SEED.delta, SEED.echo]);
      const a = await applyAs(tx, SEED.delta, need);
      const b = await applyAs(tx, SEED.echo, need);
      await toAccepted(tx, SEED.managerMro, SEED.delta, a.id);
      await toAccepted(tx, SEED.managerMro, SEED.echo, b.id);
      await step(tx, SEED.managerMro, a.id, "confirmed");
      const before = await trail(tx, b.id);
      expect((await stepError(tx, SEED.managerMro, b.id, "confirmed")).code).toBe(
        conflict("HEADCOUNT_REACHED"),
      );
      expect(await trail(tx, b.id)).toEqual(before);
      await tx.exec("reset role");
      const covered = await rowCount(
        tx,
        "select 1 from public.audit_events where entity_id = $1 and metadata ->> 'to' = 'covered'",
        [need],
      );
      expect(covered).toBe(1);
    });
  });

  it("T5 (R-08): a new proposal version needs a new acceptance; a stale version is CFA07; proposals are immutable", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      await makeAvailable(tx, [SEED.delta]);
      const { id } = await applyAs(tx, SEED.delta, need);
      const v1 = await toAccepted(tx, SEED.managerMro, SEED.delta, id);
      const v2 = await step(tx, SEED.managerMro, id, "proposed"); // accepted → proposed
      expect(v2.proposal_id).not.toBe(v1.proposal_id);
      expect(
        (await stepError(tx, SEED.delta, id, "accepted", { proposalId: v1.proposal_id })).code,
      ).toBe(conflict("PROPOSAL_STALE"));
      await tx.exec("reset role");
      const row = await tx.query<{ status: string; accepted_proposal_id: string }>(
        "select status, accepted_proposal_id from public.applications where id = $1",
        [id],
      );
      expect(row.rows[0]).toEqual({ status: "proposed", accepted_proposal_id: v1.proposal_id });
      const versions = await tx.query<{ version: number; terms: Record<string, unknown> }>(
        "select version, terms from public.application_proposals where application_id = $1 order by version",
        [id],
      );
      expect(versions.rows.map((r) => r.version)).toEqual([1, 2]);
      expect(Object.keys(versions.rows[0]!.terms).sort()).toEqual(
        [
          "endsAt",
          "headcount",
          "location",
          "organizationName",
          "qualifications",
          "shift",
          "startsAt",
          "title",
          "urgency",
          // requirement builder terms (20261023600000), frozen per version too
          "conditions",
          "country",
          "description",
          "shifts",
          "timeZone",
          // the represented client as recorded (20261027200000, T-169; v1.8 jobSnapshot.client), null for an MRO
          "clientName",
        ].sort(),
      );
      await step(tx, SEED.delta, id, "accepted", { proposalId: v2.proposal_id });
      await tx.exec("reset role");
      expect(
        (
          await sqlError(tx, "update public.application_proposals set version = 9 where id = $1", [
            v1.proposal_id,
          ])
        ).code,
      ).toBe("55000"); // even the owner
      await actAs(tx, SEED.delta);
      expect(
        (
          await sqlError(tx, "update public.application_proposals set terms = '{}' where id = $1", [
            v2.proposal_id,
          ])
        ).message,
      ).toMatch(/permission denied/);
    });
  });

  it("T6/T7: a replay returns the same event (one event, one audit row); the same key with another payload is CF409", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      await makeAvailable(tx, [SEED.delta]);
      const key = randomUUID();
      const applied = await applyAs(tx, SEED.delta, need, key);
      expect(await applyAs(tx, SEED.delta, need, key)).toEqual({ id: applied.id, replayed: true });
      const expected = (await transitionArgs(tx, applied.id, "shortlisted", {}))[2] as string;
      const transitionKey = randomUUID();
      const first = await step(tx, SEED.managerMro, applied.id, "shortlisted", {
        key: transitionKey,
        expected,
      });
      const again = await step(tx, SEED.managerMro, applied.id, "shortlisted", {
        key: transitionKey,
        expected,
      });
      expect(again).toEqual({ ...first, replayed: true });
      expect(await trail(tx, applied.id)).toEqual({ events: 2, audits: 2, status: "shortlisted" });
      const other = await stepError(tx, SEED.managerMro, applied.id, "rejected", {
        key: transitionKey,
        reason: "Other payload",
      });
      expect(other.code).toBe("CF409");
    });
  });

  it("T8: a stale expectedUpdatedAt is CF412 and changes nothing", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      await makeAvailable(tx, [SEED.delta]);
      const { id } = await applyAs(tx, SEED.delta, need);
      const error = await stepError(tx, SEED.managerMro, id, "shortlisted", {
        expected: "2026-01-01T00:00:00.000Z",
      });
      expect(error.code).toBe("CF412");
      expect((await trail(tx, id)).status).toBe("received");
    });
  });

  it("T9: confirmation re-checks everything at commit, each failure alone, nothing written", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const accepted = async (
        opts: Parameters<typeof createNeed>[1] = { org: mroId, createdBy: SEED.adminMro },
      ) => {
        const need = await createNeed(tx, opts);
        const { id } = await applyAs(tx, SEED.delta, need);
        await toAccepted(
          tx,
          opts.org === mroId ? SEED.managerMro : SEED.adminOther,
          SEED.delta,
          id,
        );
        return { need, id };
      };
      const refused = async (
        id: string,
        manager: string,
        reason: (typeof APPLICATION_CONFLICTS)[number],
      ) => {
        const before = await trail(tx, id);
        expect((await stepError(tx, manager, id, "confirmed")).code).toBe(conflict(reason));
        expect(await trail(tx, id)).toEqual(before);
      };
      await makeAvailable(tx, [SEED.delta]);

      // A re-dated hard qualification goes back to pending.
      const q = await accepted();
      await actAs(tx, SEED.delta);
      await tx.query(
        `update public.technician_qualifications set expires_at = date '2030-01-01'
         where technician_profile_id = $1 and qualification_type_id = (select id from public.qualification_types where code = 'B1.1')`,
        [SEED.delta],
      );
      await refused(q.id, SEED.managerMro, "QUALIFICATION_INVALID");
      await tx.exec("reset role");
      await tx.query(
        `update public.technician_qualifications set verification_status = 'verified'
         where technician_profile_id = $1 and qualification_type_id = (select id from public.qualification_types where code = 'B1.1')`,
        [SEED.delta],
      );

      // A window cut inside the period.
      const w = await accepted();
      await actAs(tx, SEED.delta);
      await tx.query(
        `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
         values ($1, now() + interval '6 days', now() + interval '6 days 1 hour', 'unavailable')`,
        [SEED.delta],
      );
      await refused(w.id, SEED.managerMro, "AVAILABILITY_INCOMPLETE");
      await tx.exec("reset role");
      await tx.query(
        "delete from public.availability_windows where technician_profile_id = $1 and status = 'unavailable'",
        [SEED.delta],
      );

      // `aog_only` only: refused for a planned need, accepted for an AOG one (BR-4.8).
      const planned = await accepted();
      const aog = await accepted({
        org: mroId,
        createdBy: SEED.adminMro,
        urgency: "aog",
        startsIn: "20 days",
        endsIn: "22 days",
      });
      await tx.exec("reset role");
      await tx.query("delete from public.availability_windows where technician_profile_id = $1", [
        SEED.delta,
      ]);
      await tx.query(
        `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
         values ($1, now(), now() + interval '60 days', 'aog_only')`,
        [SEED.delta],
      );
      await refused(planned.id, SEED.managerMro, "AVAILABILITY_INCOMPLETE");
      expect((await step(tx, SEED.managerMro, aog.id, "confirmed")).status).toBe("confirmed");
      // N-04 (20261023300000): the confirmed AOG assignment keeps its availability, so the AOG-only
      // window goes only once the ordinary one covers those days too.
      await makeAvailable(tx, [SEED.delta]);
      await tx.query(
        "delete from public.availability_windows where technician_profile_id = $1 and status = 'aog_only'",
        [SEED.delta],
      );

      // Another organization's confirmed assignment overlaps (the AOG one above is 20–22 days out).
      const lisbon = await accepted({
        org: otherOrgId,
        createdBy: SEED.adminOther,
        startsIn: "21 days",
        endsIn: "23 days",
      });
      await refused(lisbon.id, SEED.adminOther, "OVERLAPPING_ASSIGNMENT");

      // Paused requirement, then a started one (owner fixture: the period cannot be edited any more).
      const paused = await accepted();
      await actAs(tx, SEED.managerMro);
      await tx.query("update public.work_requirements set status = 'paused' where id = $1", [
        paused.need,
      ]);
      await refused(paused.id, SEED.managerMro, "REQUIREMENT_NOT_OPEN");
      const started = await createNeed(tx, {
        org: mroId,
        createdBy: SEED.adminMro,
        startsIn: "-1 hour",
        endsIn: "2 days",
      });
      const late = await seedApplication(tx, started, SEED.delta, "accepted");
      await refused(late, SEED.managerMro, "REQUIREMENT_STARTED");
    });
  });

  it("T10 (T-10): the reason is required exactly for rejected/cancelled, 1–1000 characters, and both parties read it", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      await makeAvailable(tx, [SEED.delta]);
      const { id } = await applyAs(tx, SEED.delta, need);
      for (const reason of [undefined, "   ", "x".repeat(1001)])
        expect((await stepError(tx, SEED.managerMro, id, "rejected", { reason })).code).toBe(
          "22023",
        );
      expect((await stepError(tx, SEED.managerMro, id, "shortlisted", { reason: "No" })).code).toBe(
        "22023",
      );
      expect(
        (await stepError(tx, SEED.managerMro, id, "shortlisted", { proposalId: randomUUID() }))
          .code,
      ).toBe("22023");
      await step(tx, SEED.managerMro, id, "rejected", { reason: "  Missing B1.1 on the dates  " });
      await actAs(tx, SEED.delta);
      const mine = await tx.query<{ reason: string }>(
        "select reason from public.get_my_applications() where application_id = $1",
        [id],
      );
      expect(mine.rows[0]!.reason).toBe("Missing B1.1 on the dates");
      await actAs(tx, SEED.managerMro);
      const theirs = await tx.query<{ reason: string }>(
        "select reason from public.get_requirement_applications($1) where application_id = $2",
        [need, id],
      );
      expect(theirs.rows[0]!.reason).toBe("Missing B1.1 on the dates");
      await tx.exec("reset role");
      const audit = await tx.query<{ metadata: Record<string, unknown> }>(
        "select metadata from public.audit_events where entity_id = $1 and action = 'application.rejected'",
        [id],
      );
      expect(audit.rows[0]!.metadata.reason_provided).toBe(true);
      expect(JSON.stringify(audit.rows)).not.toContain("Missing B1.1");
    });
  });

  it("T11: a rolled-back transition leaves neither its event nor its audit row; a failed confirm writes none", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      await makeAvailable(tx, [SEED.delta]);
      const { id } = await applyAs(tx, SEED.delta, need);
      const before = await trail(tx, id);
      await tx.exec("savepoint t11");
      await step(tx, SEED.managerMro, id, "shortlisted");
      expect(await trail(tx, id)).toEqual({ events: 2, audits: 2, status: "shortlisted" });
      await tx.exec("rollback to savepoint t11");
      expect(await trail(tx, id)).toEqual(before);
    });
  });

  it("T12: own rows only; organizations read nothing directly; nobody writes the tables", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      await makeAvailable(tx, [SEED.delta, SEED.echo]);
      const mine = await applyAs(tx, SEED.delta, need);
      await applyAs(tx, SEED.echo, need);
      await step(tx, SEED.managerMro, mine.id, "shortlisted");
      await step(tx, SEED.managerMro, mine.id, "proposed");
      await actAs(tx, SEED.delta);
      expect(
        (await tx.query<{ id: string }>("select id from public.applications")).rows.map(
          (r) => r.id,
        ),
      ).toEqual([mine.id]);
      expect(await rowCount(tx, "select * from public.application_events")).toBe(3);
      expect(await rowCount(tx, "select * from public.application_proposals")).toBe(1);
      for (const user of [SEED.managerMro, SEED.adminMro, SEED.charlieMember, SEED.adminOther]) {
        await actAs(tx, user);
        for (const table of ["applications", "application_events", "application_proposals"])
          expect(await rowCount(tx, `select * from public.${table}`)).toBe(0);
      }
      for (const user of [SEED.charlieMember, SEED.adminOther, SEED.delta]) {
        await actAs(tx, user);
        expect(
          (await sqlError(tx, "select * from public.get_requirement_applications($1)", [need]))
            .code,
        ).toBe("42501");
        expect(
          (
            await sqlError(tx, "select * from public.get_requirement_applications($1)", [
              randomUUID(),
            ])
          ).code,
        ).toBe("42501");
      }
      await actAs(tx, SEED.platformAdmin); // support: read-only
      expect(
        await rowCount(tx, "select * from public.applications where requirement_id = $1", [need]),
      ).toBe(2);
      for (const user of [SEED.delta, SEED.managerMro, SEED.platformAdmin]) {
        await actAs(tx, user);
        for (const sql of [
          "update public.applications set status = 'confirmed' where id = $1",
          "delete from public.applications where id = $1",
          "delete from public.application_events where application_id = $1",
        ])
          expect((await sqlError(tx, sql, [mine.id])).message).toMatch(/permission denied/);
        expect(
          (
            await sqlError(
              tx,
              "insert into public.applications (requirement_id, technician_profile_id) values ($1, $2)",
              [need, user],
            )
          ).message,
        ).toMatch(/permission denied/);
      }
    });
  });

  it("T13 (Q5, T-08, T-09): apply rules — one active application, re-apply only after withdrawn, eligible and before the start", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      await makeAvailable(tx, [SEED.delta, SEED.echo, SEED.alpha]);
      const first = await applyAs(tx, SEED.delta, need);
      await actAs(tx, SEED.delta);
      const applyError = (requirementId: string) =>
        sqlError(tx, "select * from public.apply_to_requirement($1, $2, true)", [
          requirementId,
          randomUUID(),
        ]);
      expect((await applyError(need)).code).toBe(conflict("ALREADY_APPLIED"));
      await tx.exec("reset role");
      expect(
        (
          await sqlError(
            tx,
            "insert into public.applications (requirement_id, technician_profile_id) values ($1, $2)",
            [need, SEED.delta],
          )
        ).code,
      ).toBe("23505"); // the unique index is the backstop
      await step(tx, SEED.delta, first.id, "withdrawn");
      const second = await applyAs(tx, SEED.delta, need);
      expect(second.id).not.toBe(first.id);
      await tx.exec("reset role");
      expect(
        await rowCount(
          tx,
          "select 1 from public.applications where requirement_id = $1 and technician_profile_id = $2",
          [need, SEED.delta],
        ),
      ).toBe(2);
      await step(tx, SEED.managerMro, second.id, "rejected", { reason: "Not this time" });
      await actAs(tx, SEED.delta);
      expect((await applyError(need)).code).toBe(conflict("REAPPLY_NOT_ALLOWED"));

      const cancelled = await applyAs(tx, SEED.echo, need);
      await toAccepted(tx, SEED.managerMro, SEED.echo, cancelled.id);
      await step(tx, SEED.managerMro, cancelled.id, "cancelled", { reason: "Budget" });
      await actAs(tx, SEED.echo);
      expect((await applyError(need)).code).toBe(conflict("REAPPLY_NOT_ALLOWED"));

      const started = await createNeed(tx, {
        org: mroId,
        createdBy: SEED.adminMro,
        startsIn: "-1 hour",
      });
      const far = await createNeed(tx, {
        org: mroId,
        createdBy: SEED.adminMro,
        startsIn: "200 days",
        endsIn: "203 days",
      });
      await actAs(tx, SEED.alpha);
      expect((await applyError(started)).code).toBe(conflict("REQUIREMENT_STARTED"));
      expect((await applyError(far)).code).toBe(conflict("AVAILABILITY_INCOMPLETE"));
      await actAs(tx, "00000000-0000-4000-8000-000000000027"); // Juliett: TR-B737, no TR-A320
      expect((await applyError(need)).code).toBe(conflict("QUALIFICATION_INVALID"));
      expect((await applyError(randomUUID())).code).toBe("P0002");
      await actAs(tx, SEED.adminMro); // organization account
      expect((await applyError(need)).code).toBe("42501");
    });
  });

  it("paused, closed and covered requirements take no application, shortlist or proposal; reject and withdraw stay possible", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      await makeAvailable(tx, [SEED.delta, SEED.echo, SEED.alpha, SEED.hotelPrivate]);
      const received = await applyAs(tx, SEED.delta, need);
      const shortlisted = await applyAs(tx, SEED.echo, need);
      const toReject = await applyAs(tx, SEED.hotelPrivate, need);
      await step(tx, SEED.managerMro, shortlisted.id, "shortlisted");
      await actAs(tx, SEED.managerMro);
      await tx.query("update public.work_requirements set status = 'paused' where id = $1", [need]);
      await actAs(tx, SEED.alpha);
      expect(
        (
          await sqlError(tx, "select * from public.apply_to_requirement($1, $2, true)", [
            need,
            randomUUID(),
          ])
        ).code,
      ).toBe(conflict("REQUIREMENT_NOT_OPEN"));
      expect((await stepError(tx, SEED.managerMro, received.id, "shortlisted")).code).toBe(
        conflict("REQUIREMENT_NOT_OPEN"),
      );
      expect((await stepError(tx, SEED.managerMro, shortlisted.id, "proposed")).code).toBe(
        conflict("REQUIREMENT_NOT_OPEN"),
      );
      await step(tx, SEED.managerMro, toReject.id, "rejected", { reason: "Paused need" });
      await step(tx, SEED.delta, received.id, "withdrawn");
      expect((await trail(tx, shortlisted.id)).status).toBe("shortlisted");
    });
  });

  it("Q2/Q3/Q4/Q7: cancel an accepted or confirmed one (covered → open), finish only after the period, never accepted → rejected", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro, headcount: 1 });
      await makeAvailable(tx, [SEED.delta, SEED.echo]);
      const a = await applyAs(tx, SEED.delta, need);
      await toAccepted(tx, SEED.managerMro, SEED.delta, a.id);
      // Q7: accepted → rejected exists for nobody.
      for (const actor of [SEED.managerMro, SEED.delta])
        expect((await stepError(tx, actor, a.id, "rejected", { reason: "No" })).code).toBe("55000");
      await step(tx, SEED.managerMro, a.id, "confirmed");
      expect(await requirementStatus(tx, need)).toBe("covered");
      // Q4: the organization finishes explicitly, after the period; the technician never does.
      expect((await stepError(tx, SEED.managerMro, a.id, "finished")).code).toBe(
        conflict("PERIOD_NOT_ENDED"),
      );
      expect((await stepError(tx, SEED.delta, a.id, "finished")).code).toBe("42501");
      // Q3: the technician cancels the confirmed assignment (reason); the seat is free again.
      await step(tx, SEED.delta, a.id, "cancelled", { reason: "Family emergency" });
      expect(await requirementStatus(tx, need)).toBe("open");
      // Q2: the organization cancels an accepted application.
      const b = await applyAs(tx, SEED.echo, need);
      await toAccepted(tx, SEED.managerMro, SEED.echo, b.id);
      expect(
        (await step(tx, SEED.managerMro, b.id, "cancelled", { reason: "Changed plan" })).status,
      ).toBe("cancelled");
      // Q3: the organization cancels a confirmed one; Q4: a period that ended can be finished.
      const past = await createNeed(tx, {
        org: mroId,
        createdBy: SEED.adminMro,
        startsIn: "-10 days",
        endsIn: "-2 days",
      });
      const done = await seedApplication(tx, past, SEED.delta, "confirmed");
      const gone = await seedApplication(tx, past, SEED.echo, "confirmed");
      expect((await step(tx, SEED.managerMro, done, "finished")).status).toBe("finished");
      expect(
        (await step(tx, SEED.managerMro, gone, "cancelled", { reason: "No show" })).status,
      ).toBe("cancelled");
    });
  });

  it("T-12 / CFA11: closing is refused while an application is accepted or confirmed; a closed need takes no acceptance", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro, headcount: 2 });
      await makeAvailable(tx, [SEED.delta, SEED.echo]);
      const a = await applyAs(tx, SEED.delta, need);
      const b = await applyAs(tx, SEED.echo, need);
      await toAccepted(tx, SEED.managerMro, SEED.delta, a.id);
      await actAs(tx, SEED.managerMro);
      const close = () =>
        sqlError(tx, "update public.work_requirements set status = 'closed' where id = $1", [need]);
      expect((await close()).code).toBe(conflict("ACTIVE_COMMITMENTS"));
      await step(tx, SEED.managerMro, a.id, "confirmed");
      await actAs(tx, SEED.managerMro);
      expect((await close()).code).toBe(conflict("ACTIVE_COMMITMENTS"));
      await step(tx, SEED.managerMro, a.id, "cancelled", { reason: "Rescheduled" });
      await step(tx, SEED.managerMro, b.id, "shortlisted");
      const proposal = await step(tx, SEED.managerMro, b.id, "proposed");
      await actAs(tx, SEED.managerMro);
      await tx.query("update public.work_requirements set status = 'closed' where id = $1", [need]);
      expect(
        (await stepError(tx, SEED.echo, b.id, "accepted", { proposalId: proposal.proposal_id }))
          .code,
      ).toBe(conflict("REQUIREMENT_NOT_OPEN"));
      await step(tx, SEED.echo, b.id, "withdrawn"); // leaving is always possible
    });
  });

  it("covered ↔ open happen only inside a transition, never by hand", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro, headcount: 1 });
      await makeAvailable(tx, [SEED.delta]);
      const a = await applyAs(tx, SEED.delta, need);
      await toAccepted(tx, SEED.managerMro, SEED.delta, a.id);
      await actAs(tx, SEED.adminMro);
      expect(
        (
          await sqlError(
            tx,
            "update public.work_requirements set status = 'covered' where id = $1",
            [need],
          )
        ).message,
      ).toMatch(/is not allowed/);
      await step(tx, SEED.managerMro, a.id, "confirmed");
      await actAs(tx, SEED.adminMro);
      expect(
        (
          await sqlError(tx, "update public.work_requirements set status = 'open' where id = $1", [
            need,
          ])
        ).message,
      ).toMatch(/is not allowed/);
      expect(await requirementStatus(tx, need)).toBe("covered");
    });
  });

  it("organizations see applicants exactly as in the candidate pool: pseudonym unless internal, name for open or internal", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro, headcount: 4 });
      await makeAvailable(tx, TECHS);
      // A member no longer applies to its own organization (CFA13, 20261024100000): Alpha's row stands
      // for one made before joining it.
      for (const tech of TECHS)
        if (tech === SEED.alpha) await seedApplication(tx, need, tech, "received");
        else await applyAs(tx, tech, need);
      await actAs(tx, SEED.managerMro);
      const { rows } = await tx.query<Record<string, unknown>>(
        "select * from public.get_requirement_applications($1)",
        [need],
      );
      const pseudonym = (profile: string) =>
        "CF-" +
        createHash("sha256").update(`${need}:${profile}`).digest("hex").slice(0, 10).toUpperCase();
      const seen = Object.fromEntries(
        rows.map((r) => [r.candidate_ref as string, [r.candidate_pool, r.candidate_display_name]]),
      );
      expect(seen).toEqual({
        [pseudonym(SEED.delta)]: ["external", null], // anonymous
        [pseudonym(SEED.echo)]: ["external", "Technician Echo"], // open
        [pseudonym(SEED.hotelPrivate)]: ["external", null], // private: visible to this org only, unnamed
        [SEED.alpha]: ["internal", "Technician Alpha"], // member of the organization
      });
      for (const row of rows) {
        const candidate = toCandidate(row); // the pool parser reads the same columns
        expect(
          candidate.qualifications.every((q) => ["B1.1", "TR-A320", "SMS"].includes(q.code)),
        ).toBe(true);
        expect(JSON.stringify(row)).not.toContain(SEED.hotelPrivate);
      }
      // The external pool still never lists the private professional (S-7 for matching unchanged).
      const pool = await tx.query<{ candidate_ref: string }>(
        "select candidate_ref from public.get_requirement_candidate_pool($1)",
        [need],
      );
      expect(pool.rows.map((r) => r.candidate_ref)).not.toContain(pseudonym(SEED.hotelPrivate));
    });
  });

  it("dashboard counts: admin/manager of the organization only, per status", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro, headcount: 2 });
      await makeAvailable(tx, [SEED.delta, SEED.echo]);
      const a = await applyAs(tx, SEED.delta, need);
      await applyAs(tx, SEED.echo, need);
      await step(tx, SEED.managerMro, a.id, "shortlisted");
      await actAs(tx, SEED.managerMro);
      const { rows } = await tx.query<{ status: string; total: number }>(
        "select * from public.get_application_counts($1)",
        [mroId],
      );
      expect(rows).toEqual([
        { status: "received", total: 1 },
        { status: "shortlisted", total: 1 },
      ]);
      for (const user of [SEED.charlieMember, SEED.adminOther, SEED.delta]) {
        await actAs(tx, user);
        expect(
          (await sqlError(tx, "select * from public.get_application_counts($1)", [mroId])).code,
        ).toBe("42501");
      }
    });
  });

  // Account deletion keeps the technician's applications without them and refuses while one is
  // confirmed (T-42, migration 20261023400100 — supersedes the cascade + seat release of LOW-2); deleting
  // an organization still cascades its requirements' applications, proposals and events.
  it("an account never takes a confirmed seat with it; deleting an organization cascades its applications", async () => {
    await db
      .transaction(async (owner) => {
        const need = await createNeed(owner, {
          org: mroId,
          createdBy: SEED.adminMro,
          headcount: 1,
          status: "covered",
        });
        const delta = await seedApplication(owner, need, SEED.delta, "confirmed");
        const echo = await seedApplication(owner, need, SEED.echo, "proposed");
        expect(
          (await sqlError(owner, "delete from auth.users where id = $1", [SEED.delta])).code,
        ).toBe("CFA11"); // account deletion while confirmed
        expect(await requirementStatus(owner, need)).toBe("covered");
        await owner.query("delete from auth.users where id = $1", [SEED.echo]);
        expect(
          (
            await owner.query(
              "select status, technician_profile_id from public.applications where id = $1",
              [echo],
            )
          ).rows,
        ).toEqual([{ status: "withdrawn", technician_profile_id: null }]);
        expect(
          await rowCount(owner, "select 1 from public.applications where id = $1", [delta]),
        ).toBe(1);
        await owner.query("delete from public.organizations where id = $1", [mroId]);
        expect(
          await rowCount(owner, "select 1 from public.applications where id = $1", [delta]),
        ).toBe(0);
        expect(
          await rowCount(
            owner,
            "select 1 from public.application_proposals where application_id = $1",
            [delta],
          ),
        ).toBe(0);
        expect(
          await rowCount(owner, "select 1 from public.applications where id = $1", [echo]),
        ).toBe(0);
        expect(
          await rowCount(owner, "select 1 from public.work_requirements where id = $1", [need]),
        ).toBe(0);
        await owner.exec("set constraints all immediate");
        throw new Error("rollback");
      })
      .catch((error: Error) => expect(error.message).toBe("rollback"));
  });

  it("no oracle on other organizations' requirements: a stranger's qualification insert is always RLS's 42501", async () => {
    await asUser(db, SEED.echo, async (tx) => {
      const withApplication = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      const without = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      const closed = await createNeed(tx, {
        org: mroId,
        createdBy: SEED.adminMro,
        status: "closed",
      });
      await seedApplication(tx, withApplication, SEED.delta, "withdrawn");
      const ewis = (
        await tx.query<{ id: string }>(
          "select id from public.qualification_types where code = 'EWIS'",
        )
      ).rows[0]!.id;
      // Published ids reach every professional (D-12); other organizations may know them too.
      for (const stranger of [SEED.echo, SEED.adminOther]) {
        await actAs(tx, stranger);
        const answers = [];
        for (const id of [withApplication, without, closed])
          answers.push(
            await sqlError(
              tx,
              `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
               values ($1, $2, 'soft')`,
              [id, ewis],
            ),
          );
        expect(answers.map((a) => a.code)).toEqual(["42501", "42501", "42501"]);
        expect(new Set(answers.map((a) => a.message)).size).toBe(1);
      }
      // The organization itself still gets the precise answers.
      await actAs(tx, SEED.managerMro);
      const insert = (id: string) =>
        sqlError(
          tx,
          `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
           values ($1, $2, 'soft')`,
          [id, ewis],
        );
      expect((await insert(withApplication)).code).toBe(conflict("HAS_APPLICATIONS"));
      expect((await insert(closed)).code).toBe("55000");
    });
  });

  it("applying requires the explicit share consent in the database too (review LOW-4)", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      await makeAvailable(tx, [SEED.delta]);
      await actAs(tx, SEED.delta);
      for (const consent of [false, null])
        expect(
          (
            await sqlError(tx, "select * from public.apply_to_requirement($1, $2, $3)", [
              need,
              randomUUID(),
              consent,
            ])
          ).code,
        ).toBe("22023");
      await tx.exec("reset role");
      expect(
        await rowCount(tx, "select 1 from public.applications where requirement_id = $1", [need]),
      ).toBe(0);
    });
  });

  it("anon executes none of the application or edit RPCs (review LOW-5)", async () => {
    await asUser(db, null, async (tx) => {
      const id = randomUUID();
      const at = "2031-01-01T00:00:00Z";
      for (const [sql, params] of [
        ["select * from public.apply_to_requirement($1, $2, true)", [id, id]],
        ["select * from public.transition_application($1, 'shortlisted', $2, $3)", [id, at, id]],
        ["select * from public.get_requirement_applications($1)", [id]],
        ["select * from public.get_my_applications()", []],
        ["select * from public.get_application_counts($1)", [id]],
        [
          "select * from public.update_work_requirement($1, $2, 'T', 'MAD', $2, $2, 'day', 1, 'planned', '[]'::jsonb)",
          [id, at],
        ],
      ] as const)
        expect((await sqlError(tx, sql, [...params])).message).toMatch(/permission denied/);
    });
  });

  describe("M05 edit (update_work_requirement) and the freeze after the first application (CFA12)", () => {
    const EDIT_SQL =
      "select * from public.update_work_requirement($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)";
    async function editArgs(tx: Transaction, id: string, changes: Record<string, unknown> = {}) {
      await tx.exec("reset role");
      const { rows } = await tx.query<Record<string, unknown>>(
        `select title, location, starts_at, ends_at, shift, headcount, urgency, updated_at,
                (select jsonb_agg(jsonb_build_object('qualification_type_id', qualification_type_id,
                                                     'requirement_level', requirement_level))
                 from public.work_requirement_qualifications where work_requirement_id = $1) as quals
         from public.work_requirements where id = $1`,
        [id],
      );
      const r = { ...rows[0]!, ...changes };
      return [
        id,
        (r.updated_at as Date).toISOString(),
        r.title,
        r.location,
        (r.starts_at as Date).toISOString(),
        (r.ends_at as Date).toISOString(),
        r.shift,
        r.headcount,
        r.urgency,
        JSON.stringify(r.quals),
      ];
    }
    const ewis = async (tx: Transaction) =>
      (
        await tx.query<{ id: string }>(
          "select id from public.qualification_types where code = 'EWIS'",
        )
      ).rows[0]!.id;

    it("an admin/manager edits it: changed fields audited by name; nothing changed is a no-op", async () => {
      await asUser(db, SEED.managerMro, async (tx) => {
        const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
        const hardNow = await tx.query<{ qualification_type_id: string }>(
          "select qualification_type_id from public.work_requirement_qualifications where work_requirement_id = $1 and requirement_level = 'hard'",
          [need],
        );
        const quals = [
          { qualification_type_id: await ewis(tx), requirement_level: "hard" },
          ...hardNow.rows.map((q) => ({ ...q, requirement_level: "hard" })),
        ];
        const args = await editArgs(tx, need, { title: "Edited title", headcount: 3, quals });
        await actAs(tx, SEED.managerMro);
        const { rows } = await tx.query<{ id: string; changed: string[] }>(EDIT_SQL, args);
        expect(rows[0]!.changed).toEqual(["title", "headcount", "qualifications"]);
        await tx.exec("reset role");
        const audit = await tx.query<{ metadata: unknown; actor_profile_id: string }>(
          "select metadata, actor_profile_id from public.audit_events where entity_id = $1 and action = 'requirement.updated'",
          [need],
        );
        expect(audit.rows).toEqual([
          {
            actor_profile_id: SEED.managerMro,
            metadata: { fields: ["title", "headcount", "qualifications"] },
          },
        ]);
        expect(
          await rowCount(
            tx,
            "select 1 from public.work_requirement_qualifications where work_requirement_id = $1",
            [need],
          ),
        ).toBe(3); // B1.1, TR-A320, EWIS (SMS dropped)
        const again = await editArgs(tx, need);
        await actAs(tx, SEED.managerMro);
        expect((await tx.query<{ changed: string[] }>(EDIT_SQL, again)).rows[0]!.changed).toEqual(
          [],
        );
        await tx.exec("set constraints all immediate"); // BR-1.4 holds at commit
      });
    });

    it("stale version CF412, invalid payload 22023, members and other organizations 42501, closed 55000", async () => {
      await asUser(db, SEED.managerMro, async (tx) => {
        const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
        const stale = await editArgs(tx, need, { title: "Edited" });
        stale[1] = "2026-01-01T00:00:00.000Z";
        await actAs(tx, SEED.managerMro);
        expect((await sqlError(tx, EDIT_SQL, stale)).code).toBe("CF412");
        const one = { qualification_type_id: await ewis(tx), requirement_level: "hard" };
        // empty · no hard one · the same type twice
        for (const quals of [[], [{ ...one, requirement_level: "soft" }], [one, one]]) {
          const args = await editArgs(tx, need, { quals });
          await actAs(tx, SEED.managerMro);
          expect((await sqlError(tx, EDIT_SQL, args)).code).toBe("22023");
        }
        const args = await editArgs(tx, need, { title: "Edited" });
        for (const user of [SEED.charlieMember, SEED.adminOther, SEED.delta]) {
          await actAs(tx, user);
          expect((await sqlError(tx, EDIT_SQL, args)).code).toBe("42501");
        }
        await actAs(tx, SEED.managerMro);
        expect((await sqlError(tx, EDIT_SQL, [randomUUID(), ...args.slice(1)])).code).toBe("42501");
        await tx.query("update public.work_requirements set status = 'closed' where id = $1", [
          need,
        ]);
        const closed = await editArgs(tx, need, { title: "Edited" });
        await actAs(tx, SEED.managerMro);
        expect((await sqlError(tx, EDIT_SQL, closed)).code).toBe("55000");
      });
    });

    it("after any application — even withdrawn — the RPC and direct writes are CFA12; status changes stay possible", async () => {
      await asUser(db, SEED.delta, async (tx) => {
        const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
        await makeAvailable(tx, [SEED.delta]);
        const { id } = await applyAs(tx, SEED.delta, need);
        await step(tx, SEED.delta, id, "withdrawn");
        const frozen = conflict("HAS_APPLICATIONS");
        const args = await editArgs(tx, need, { title: "Edited" });
        await actAs(tx, SEED.managerMro);
        expect((await sqlError(tx, EDIT_SQL, args)).code).toBe(frozen);
        const ewisId = await ewis(tx);
        for (const [sql, params] of [
          ["update public.work_requirements set title = 'Rewritten' where id = $1", [need]],
          ["update public.work_requirements set headcount = 9 where id = $1", [need]],
          [
            "delete from public.work_requirement_qualifications where work_requirement_id = $1 and requirement_level = 'soft'",
            [need],
          ],
          [
            "insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level) values ($1, $2, 'soft')",
            [need, ewisId],
          ],
        ] as const)
          expect((await sqlError(tx, sql, [...params])).code).toBe(frozen);
        await tx.query("update public.work_requirements set status = 'paused' where id = $1", [
          need,
        ]);
        expect(await requirementStatus(tx, need)).toBe("paused");
      });
    });
  });
});

describe("W. one hard-eligibility rule: SQL (apply/confirm, pool) and TypeScript agree (migration 20261022130300)", () => {
  it("hard_eligibility = evaluateMatch().eligible on own data = ranked_external_pool.hard_eligible (240 randomized profiles × 3 urgencies)", async () => {
    let seed = 20261022;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
    // MAD need: 2026-10-18 20:00Z → 2026-10-22 06:00Z; first day 18, last day 22 (BR-2). Each hard
    // qualification is valid 90 % of the time (boundary 22 included), else one defect: missing,
    // withdrawn, unverified, or an expiry before / on the first day / inside the period.
    const valid = ["2026-10-22", "2027-01-01"] as const;
    const defects = [
      "missing",
      "withdrawn",
      "pending",
      "rejected",
      "expired",
      "2026-10-17",
      "2026-10-18",
      "2026-10-21",
    ] as const;
    type W = [string, string, "available" | "unavailable" | "aog_only"];
    const windows: W[][] = [
      [["2026-10-18T20:00Z", "2026-10-22T06:00Z", "available"]],
      [["2026-10-18T20:00Z", "2026-10-22T06:00Z", "aog_only"]],
      [["2026-10-18T21:00Z", "2026-10-22T06:00Z", "available"]],
      [
        ["2026-10-10T00:00Z", "2026-10-30T00:00Z", "available"],
        ["2026-10-19T00:00Z", "2026-10-19T01:00Z", "aog_only"],
      ],
      [
        ["2026-10-10T00:00Z", "2026-10-20T00:00Z", "aog_only"],
        ["2026-10-20T00:00Z", "2026-10-30T00:00Z", "available"],
      ],
      [
        ["2026-10-10T00:00Z", "2026-10-30T00:00Z", "available"],
        ["2026-10-22T06:00Z", "2026-10-23T00:00Z", "unavailable"],
      ],
      [
        ["2026-10-10T00:00Z", "2026-10-30T00:00Z", "aog_only"],
        ["2026-10-19T00:00Z", "2026-10-19T01:00Z", "unavailable"],
      ],
      [],
    ];
    const hard = ["B1.1", "TR-A320", "EWIS", "HF", "FTS"];
    const ids = Array.from(
      { length: 240 },
      (_, i) => `00000000-0000-4000-9300-${String(i).padStart(12, "0")}`,
    );
    await asUser(db, SEED.managerMro, async (tx) => {
      await tx.exec("reset role");
      await tx.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         select id, 'w-' || id || '@crewflex.test', '{"account_type":"professional","display_name":"Parity"}'
         from unnest($1::uuid[]) id`,
        [ids],
      );
      const quals: [string, string, string, string | null, string][] = [];
      const wins: [string, string, string, string][] = [];
      const visibility: string[] = [];
      for (const id of ids) {
        visibility.push(pick(["anonymous", "open", "private"] as const));
        for (const code of hard) {
          // TR-A320 has no mandatory expiry (BR-2.7): null is a valid value for it.
          const fine = code === "TR-A320" && rnd() < 0.5 ? null : pick(valid);
          const defect = rnd() < 0.9 ? null : pick(defects);
          if (defect === "missing") continue;
          quals.push([
            id,
            code,
            defect === "withdrawn" ? "withdrawn" : "active",
            defect?.startsWith("2026") ? defect : fine,
            defect === "pending" || defect === "rejected" || defect === "expired"
              ? defect
              : "verified",
          ]);
        }
        for (const [s, e, st] of pick(windows)) wins.push([id, s, e, st]);
      }
      await tx.query(
        `update public.technician_profiles tp set visibility = v.visibility::public.profile_visibility
         from unnest($1::uuid[], $2::text[]) as v(id, visibility) where tp.profile_id = v.id`,
        [ids, visibility],
      );
      await tx.query(
        `insert into public.technician_qualifications
           (technician_profile_id, qualification_type_id, status, expires_at, verification_status)
         select q.p, qt.id, q.s::public.qualification_status, q.e::date, q.v::public.verification_status
         from unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[]) as q(p, code, s, e, v)
         join public.qualification_types qt on qt.code = q.code`,
        [
          quals.map((q) => q[0]),
          quals.map((q) => q[1]),
          quals.map((q) => q[2]),
          quals.map((q) => q[3]),
          quals.map((q) => q[4]),
        ],
      );
      await tx.query(
        `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
         select w.p, w.s::timestamptz, w.e::timestamptz, w.st::public.availability_status
         from unnest($1::uuid[], $2::text[], $3::text[], $4::text[]) as w(p, s, e, st)`,
        [
          wins.map((w) => w[0]),
          wins.map((w) => w[1]),
          wins.map((w) => w[2]),
          wins.map((w) => w[3]),
        ],
      );

      const req = await tx.query<{ starts_at: Date; ends_at: Date }>(
        "select starts_at, ends_at from public.work_requirements where id = $1",
        [madRequirementId],
      );
      const quals2 = await tx.query<{
        id: string;
        code: string;
        requirement_level: "hard" | "soft";
      }>(
        `select qt.id, qt.code, wrq.requirement_level from public.work_requirement_qualifications wrq
         join public.qualification_types qt on qt.id = wrq.qualification_type_id where wrq.work_requirement_id = $1`,
        [madRequirementId],
      );
      const startsAt = req.rows[0]!.starts_at.toISOString();
      const endsAt = req.rows[0]!.ends_at.toISOString();
      // Each professional's own data, read as them through the INVOKER function (the opportunities path).
      const own = new Map<string, ReturnType<typeof toCandidate>>();
      for (const id of ids) {
        await actAs(tx, id);
        const { rows } = await tx.query("select * from public.own_candidate_profile($1, $2)", [
          startsAt,
          endsAt,
        ]);
        own.set(id, toCandidate(rows[0]));
      }
      await tx.exec("reset role");

      let eligibleSeen = 0;
      let rankedCompared = 0;
      for (const urgency of ["urgent", "planned", "aog"] as const) {
        await tx.query("update public.work_requirements set urgency = $2 where id = $1", [
          madRequirementId,
          urgency,
        ]);
        const sql = await tx.query<{ p: string; ok: boolean }>(
          `select p, (h.qualifications_ok and h.availability_ok) as ok
           from unnest($1::uuid[]) p cross join lateral app_private.hard_eligibility($2, p) h`,
          [ids, madRequirementId],
        );
        const ranked = new Map(
          (
            await tx.query<{ profile_id: string; hard_eligible: boolean }>(
              "select profile_id, hard_eligible from app_private.ranked_external_pool($1)",
              [madRequirementId],
            )
          ).rows.map((r) => [r.profile_id, r.hard_eligible]),
        );
        const requirement: MatchableRequirement = {
          startsAt,
          endsAt,
          urgency,
          qualifications: quals2.rows.map((q) => ({
            qualificationTypeId: q.id,
            code: q.code,
            name: q.code,
            level: q.requirement_level,
          })),
        };
        expect(sql.rows).toHaveLength(ids.length);
        for (const row of sql.rows) {
          const ts = evaluateMatch(requirement, own.get(row.p)!).eligible;
          expect([urgency, row.p, row.ok]).toEqual([urgency, row.p, ts]);
          if (ranked.has(row.p)) {
            expect([urgency, row.p, ranked.get(row.p)]).toEqual([urgency, row.p, row.ok]);
            rankedCompared++;
          }
          if (row.ok) eligibleSeen++;
        }
      }
      expect(eligibleSeen).toBeGreaterThan(20); // the sample exercises both outcomes
      expect(rankedCompared).toBeGreaterThan(300);
    });
  }, 120_000);
});
