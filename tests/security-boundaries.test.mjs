import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [qrRoute, qrDatabase, homePage, securityMigration] = await Promise.all([
  readFile(new URL("../app/api/qr/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/qr-db.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260808_secure_roles_and_staj_workflow.sql", import.meta.url), "utf8"),
]);

test("requires authenticated QR requests and role-scoped actions", () => {
  assert.match(qrRoute, /authenticateRequest\(request\)/);
  assert.match(qrDatabase, /"create-period": \["admin"\]/);
  assert.match(qrDatabase, /"start-session": \["academician", "admin"\]/);
  assert.match(qrDatabase, /"record-attendance": \["student"\]/);
});

test("keeps student attendance reads bound to the authenticated user", () => {
  assert.match(qrDatabase, /WHERE membership\.student_user_id = \$\{actor\.id\}/);
  assert.match(qrDatabase, /WHERE student_user_id = \$\{actor\.id\}/);
  assert.doesNotMatch(homePage, /roleParam === "admin"/);
});

test("ships database guards for profiles, invitations and internship approvals", () => {
  assert.match(securityMigration, /alter table public\.stajlar enable row level security/i);
  assert.match(securityMigration, /campuso_handle_new_user/i);
  assert.match(securityMigration, /campuso_staj_transition_guard/i);
  assert.match(securityMigration, /student_id = auth\.uid\(\)/i);
});
