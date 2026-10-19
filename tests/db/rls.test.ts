import { createHash } from "node:crypto";
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
import { evaluateMatch, type MatchableRequirement } from "../../src/domain/matching";
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
        "update public.work_requirements set title = 'Renamed need', status = 'covered' where id = $1",
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

  it("L1: a legacy requirement without hard qualifications can still be cancelled, but not reopened", async () => {
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
      await owner.query("update public.work_requirements set status = 'cancelled' where id = $1", [
        rows[0]!.id,
      ]);
      await owner.exec(commitCheck); // cancelling is always possible
      await owner.exec("set constraints all deferred");
      await owner.query("update public.work_requirements set status = 'open' where id = $1", [
        rows[0]!.id,
      ]);
      expect(await queryError(owner, commitCheck)).toMatch(HARD_MISSING);
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

      const req = await tx.query<{ starts_at: Date; ends_at: Date }>(
        "select starts_at, ends_at from public.work_requirements where id = $1",
        [madRequirementId],
      );
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
    const req = await tx.query<{ starts_at: Date; ends_at: Date }>(
      "select starts_at, ends_at from public.work_requirements where id = $1",
      [madRequirementId],
    );
    const quals = await tx.query<{ id: string; code: string; requirement_level: "hard" | "soft" }>(
      `select qt.id, qt.code, wrq.requirement_level from public.work_requirement_qualifications wrq
       join public.qualification_types qt on qt.id = wrq.qualification_type_id where wrq.work_requirement_id = $1`,
      [madRequirementId],
    );
    const requirement: MatchableRequirement = {
      startsAt: req.rows[0]!.starts_at.toISOString(),
      endsAt: req.rows[0]!.ends_at.toISOString(),
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
      expect(await queryError(tx, review, [rows[0]!.id, "verified", null, null])).toMatch(
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

  it("pending → rejected needs a reason; the owner reads the reason; a decided row cannot be decided again", async () => {
    await asUser(db, SEED.platformAdmin, async (tx) => {
      await golfPending(tx);
      const id = await golfB11(tx);
      expect(await queryError(tx, review, [id, "rejected", "   ", null])).toMatch(/needs a reason/);
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
      expect(await queryError(tx, review, [id, "verified", null, null])).toMatch(
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
      await tx.query(review, [id, "verified", null, null]);
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
          null,
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
      expect(await queryError(tx, review, [id, "verified", null, null])).toMatch(
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
          "select * from public.review_qualification($1, 'verified', $2::timestamptz - interval '1 second', null, null)",
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
