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
      ).toBe(1);
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
        [SEED.alpha, SEED.bravo, SEED.charlieMember].sort(),
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
      expect(internal).toHaveLength(3);
      expect(external).toHaveLength(6);
      expect(rows.some((r) => r.candidate_ref === SEED.hotelPrivate)).toBe(false);
      for (const candidate of external) {
        expect(candidate.candidate_ref).toMatch(/^CF-[0-9A-F]{10}$/);
      }
      const named = external.filter((r) => r.candidate_display_name !== null);
      expect(named.map((r) => r.candidate_display_name).sort()).toEqual([
        "Technician Echo",
        "Technician Juliett",
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
