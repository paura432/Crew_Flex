import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  asUser,
  createTestDatabase,
  orgIdByName,
  queryError,
  requirementIdByTitle,
  SEED,
} from "./harness";

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
          "select * from public.technician_qualifications where technician_profile_id = $1",
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
        `insert into public.technician_qualifications (technician_profile_id, qualification_type_id)
         select $1, id from public.qualification_types where code = 'B2'
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
        await rowCount(tx, "select * from public.technician_qualifications where id = $1", [
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
          `insert into public.technician_qualifications (technician_profile_id, qualification_type_id)
           select $1, id from public.qualification_types where code = 'NDT-UT2'`,
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
        await rowCount(tx, "select * from public.technician_qualifications where id = $1", [
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
    expect(audit.rows).toEqual([{ action: "qualification.verified" }]);
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
