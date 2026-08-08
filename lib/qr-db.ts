import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { randomBytes, randomUUID } from "node:crypto";
import { AuthError, requireRole, type CampusActor } from "./server-auth";

type SqlClient = NeonQueryFunction<false, false>;
type QrActionBody = Record<string, unknown> & { action?: string };

const DEFAULT_PERIOD_ID = "period-2026-2027-guz";
const PERIOD_TERMS = ["guz", "bahar", "yaz"] as const;
const TERM_LABELS: Record<(typeof PERIOD_TERMS)[number], string> = {
  guz: "Güz",
  bahar: "Bahar",
  yaz: "Yaz",
};

let schemaPromise: Promise<void> | null = null;

function databaseUrl() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_MISSING");
  return url;
}

async function initializeSchema(sql: SqlClient) {
  await sql`
    CREATE TABLE IF NOT EXISTS campuso_academic_periods (
      id TEXT PRIMARY KEY,
      academic_year TEXT NOT NULL,
      term TEXT NOT NULL,
      label TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      is_open BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (academic_year, term)
    )
  `;
  await sql`
    INSERT INTO campuso_academic_periods (
      id, academic_year, term, label, start_date, end_date, is_active, is_open
    )
    VALUES (
      ${DEFAULT_PERIOD_ID}, '2026-2027', 'guz', '2026-2027 Güz', '2026-09-01', '2027-01-31', TRUE, TRUE
    )
    ON CONFLICT (academic_year, term) DO NOTHING
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS campuso_one_active_period_idx
    ON campuso_academic_periods (is_active)
    WHERE is_active = TRUE
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS campuso_qr_settings (
      id TEXT PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      active_period_id TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE campuso_qr_settings ADD COLUMN IF NOT EXISTS active_period_id TEXT`;
  await sql`
    INSERT INTO campuso_qr_settings (id, enabled, active_period_id)
    VALUES ('main', TRUE, ${DEFAULT_PERIOD_ID})
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    UPDATE campuso_qr_settings
    SET active_period_id = COALESCE(
      active_period_id,
      (SELECT id FROM campuso_academic_periods WHERE is_active = TRUE LIMIT 1),
      ${DEFAULT_PERIOD_ID}
    )
    WHERE id = 'main'
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS campuso_courses (
      id TEXT PRIMARY KEY,
      period_id TEXT NOT NULL,
      owner_user_id TEXT,
      name TEXT NOT NULL,
      course_code TEXT NOT NULL,
      section TEXT NOT NULL,
      join_code TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE campuso_courses ADD COLUMN IF NOT EXISTS period_id TEXT`;
  await sql`ALTER TABLE campuso_courses ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;
  await sql`
    UPDATE campuso_courses
    SET period_id = COALESCE(
      period_id,
      (SELECT active_period_id FROM campuso_qr_settings WHERE id = 'main'),
      ${DEFAULT_PERIOD_ID}
    )
    WHERE period_id IS NULL
  `;
  await sql`ALTER TABLE campuso_courses ALTER COLUMN period_id SET NOT NULL`;
  await sql`
    CREATE TABLE IF NOT EXISTS campuso_attendance_sessions (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES campuso_courses(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      closed_at TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS campuso_course_memberships (
      course_id TEXT NOT NULL REFERENCES campuso_courses(id) ON DELETE CASCADE,
      student_user_id TEXT,
      student_name TEXT NOT NULL,
      student_number TEXT NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (course_id, student_number)
    )
  `;
  await sql`ALTER TABLE campuso_course_memberships ADD COLUMN IF NOT EXISTS student_user_id TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS campuso_attendance_records (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES campuso_attendance_sessions(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES campuso_courses(id) ON DELETE CASCADE,
      student_user_id TEXT,
      student_name TEXT NOT NULL,
      student_number TEXT NOT NULL,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (session_id, student_number)
    )
  `;
  await sql`ALTER TABLE campuso_attendance_records ADD COLUMN IF NOT EXISTS student_user_id TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS campuso_qr_rate_limits (
      rate_key TEXT PRIMARY KEY,
      window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      request_count INTEGER NOT NULL DEFAULT 1
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS campuso_audit_events (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS campuso_courses_period_idx ON campuso_courses(period_id)`;
  await sql`CREATE INDEX IF NOT EXISTS campuso_courses_owner_idx ON campuso_courses(owner_user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS campuso_sessions_course_idx ON campuso_attendance_sessions(course_id)`;
  await sql`CREATE INDEX IF NOT EXISTS campuso_memberships_user_idx ON campuso_course_memberships(student_user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS campuso_records_session_idx ON campuso_attendance_records(session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS campuso_records_student_idx ON campuso_attendance_records(student_number)`;
  await sql`CREATE INDEX IF NOT EXISTS campuso_records_user_idx ON campuso_attendance_records(student_user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS campuso_audit_created_idx ON campuso_audit_events(created_at DESC)`;
}

async function getDatabase() {
  const sql = neon(databaseUrl());
  if (!schemaPromise) {
    schemaPromise = initializeSchema(sql).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
  return sql;
}

function asText(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function asMillis(value: unknown) {
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function asDateText(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function createCode(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function studentNumber(value: unknown) {
  const normalized = asText(value, 40).toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9-]{4,40}$/.test(normalized) ? normalized : "";
}

async function enforceRateLimit(
  sql: SqlClient,
  actor: CampusActor,
  action: string,
  maximum = 20,
) {
  const key = `${actor.id}:${action}`;
  const rows = await sql`
    INSERT INTO campuso_qr_rate_limits (rate_key, window_start, request_count)
    VALUES (${key}, NOW(), 1)
    ON CONFLICT (rate_key) DO UPDATE SET
      window_start = CASE
        WHEN campuso_qr_rate_limits.window_start < NOW() - INTERVAL '1 minute' THEN NOW()
        ELSE campuso_qr_rate_limits.window_start
      END,
      request_count = CASE
        WHEN campuso_qr_rate_limits.window_start < NOW() - INTERVAL '1 minute' THEN 1
        ELSE campuso_qr_rate_limits.request_count + 1
      END
    RETURNING request_count
  `;
  if (Number(rows[0]?.request_count ?? 0) > maximum) {
    throw new AuthError("Çok fazla işlem yapıldı. Bir dakika bekleyip tekrar deneyin.", 429);
  }
}

async function audit(
  sql: SqlClient,
  actor: CampusActor,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, string | number | boolean> = {},
) {
  await sql`
    INSERT INTO campuso_audit_events (
      id, actor_user_id, actor_role, action, entity_type, entity_id, metadata
    )
    VALUES (
      ${randomUUID()}, ${actor.id}, ${actor.role}, ${action}, ${entityType}, ${entityId},
      ${JSON.stringify(metadata)}::jsonb
    )
  `;
}

async function getActivePeriod(sql: SqlClient) {
  const rows = await sql`
    SELECT period.id, period.academic_year, period.term, period.label,
           period.start_date, period.end_date, period.is_active, period.is_open
    FROM campuso_qr_settings AS settings
    JOIN campuso_academic_periods AS period ON period.id = settings.active_period_id
    WHERE settings.id = 'main'
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function loadQrStore(actor: CampusActor) {
  const sql = await getDatabase();
  const [settings, periods] = await Promise.all([
    sql`SELECT enabled, active_period_id FROM campuso_qr_settings WHERE id = 'main'`,
    sql`
      SELECT id, academic_year, term, label, start_date, end_date, is_active, is_open, created_at
      FROM campuso_academic_periods
      ORDER BY start_date DESC, created_at DESC
    `,
  ]);

  let courses;
  let sessions;
  let memberships;
  let records;

  if (actor.role === "admin") {
    [courses, sessions, memberships, records] = await Promise.all([
      sql`SELECT id, period_id, name, course_code, section, join_code, created_at FROM campuso_courses ORDER BY created_at DESC`,
      sql`SELECT id, course_id, token, created_at, expires_at, closed_at FROM campuso_attendance_sessions ORDER BY created_at DESC`,
      sql`SELECT course_id, student_name, student_number, joined_at FROM campuso_course_memberships ORDER BY joined_at DESC`,
      sql`SELECT id, session_id, course_id, student_name, student_number, checked_at FROM campuso_attendance_records ORDER BY checked_at DESC`,
    ]);
  } else if (actor.role === "academician") {
    [courses, sessions, memberships, records] = await Promise.all([
      sql`
        SELECT id, period_id, name, course_code, section, join_code, created_at
        FROM campuso_courses
        WHERE owner_user_id = ${actor.id} OR owner_user_id IS NULL
        ORDER BY created_at DESC
      `,
      sql`
        SELECT session.id, session.course_id, session.token, session.created_at, session.expires_at, session.closed_at
        FROM campuso_attendance_sessions AS session
        JOIN campuso_courses AS course ON course.id = session.course_id
        WHERE course.owner_user_id = ${actor.id} OR course.owner_user_id IS NULL
        ORDER BY session.created_at DESC
      `,
      sql`
        SELECT membership.course_id, membership.student_name, membership.student_number, membership.joined_at
        FROM campuso_course_memberships AS membership
        JOIN campuso_courses AS course ON course.id = membership.course_id
        WHERE course.owner_user_id = ${actor.id} OR course.owner_user_id IS NULL
        ORDER BY membership.joined_at DESC
      `,
      sql`
        SELECT record.id, record.session_id, record.course_id, record.student_name, record.student_number, record.checked_at
        FROM campuso_attendance_records AS record
        JOIN campuso_courses AS course ON course.id = record.course_id
        WHERE course.owner_user_id = ${actor.id} OR course.owner_user_id IS NULL
        ORDER BY record.checked_at DESC
      `,
    ]);
  } else {
    [courses, sessions, memberships, records] = await Promise.all([
      sql`
        SELECT DISTINCT course.id, course.period_id, course.name, course.course_code,
               course.section, course.join_code, course.created_at
        FROM campuso_courses AS course
        JOIN campuso_course_memberships AS membership ON membership.course_id = course.id
        WHERE membership.student_user_id = ${actor.id}
        ORDER BY course.created_at DESC
      `,
      sql`
        SELECT DISTINCT session.id, session.course_id, session.token,
               session.created_at, session.expires_at, session.closed_at
        FROM campuso_attendance_sessions AS session
        JOIN campuso_course_memberships AS membership ON membership.course_id = session.course_id
        WHERE membership.student_user_id = ${actor.id}
        ORDER BY session.created_at DESC
      `,
      sql`
        SELECT course_id, student_name, student_number, joined_at
        FROM campuso_course_memberships
        WHERE student_user_id = ${actor.id}
        ORDER BY joined_at DESC
      `,
      sql`
        SELECT id, session_id, course_id, student_name, student_number, checked_at
        FROM campuso_attendance_records
        WHERE student_user_id = ${actor.id}
        ORDER BY checked_at DESC
      `,
    ]);
  }

  return {
    enabled: Boolean(settings[0]?.enabled ?? true),
    activePeriodId: String(settings[0]?.active_period_id ?? ""),
    periods: periods.map((row) => ({
      id: String(row.id),
      academicYear: String(row.academic_year),
      term: String(row.term),
      label: String(row.label),
      startDate: asDateText(row.start_date),
      endDate: asDateText(row.end_date),
      isActive: Boolean(row.is_active),
      isOpen: Boolean(row.is_open),
      createdAt: asMillis(row.created_at),
    })),
    courses: courses.map((row) => ({
      id: String(row.id),
      periodId: String(row.period_id),
      name: String(row.name),
      courseCode: String(row.course_code),
      section: String(row.section),
      joinCode: String(row.join_code),
      createdAt: asMillis(row.created_at),
    })),
    sessions: sessions.map((row) => ({
      id: String(row.id),
      courseId: String(row.course_id),
      token: String(row.token),
      createdAt: asMillis(row.created_at),
      expiresAt: asMillis(row.expires_at),
      ...(row.closed_at ? { closedAt: asMillis(row.closed_at) } : {}),
    })),
    memberships: memberships.map((row) => ({
      courseId: String(row.course_id),
      studentName: String(row.student_name),
      studentNumber: String(row.student_number),
      joinedAt: asMillis(row.joined_at),
    })),
    records: records.map((row) => ({
      id: String(row.id),
      sessionId: String(row.session_id),
      courseId: String(row.course_id),
      studentName: String(row.student_name),
      studentNumber: String(row.student_number),
      checkedAt: asMillis(row.checked_at),
    })),
  };
}

export async function performQrAction(body: QrActionBody, actor: CampusActor) {
  const sql = await getDatabase();
  const action = asText(body.action, 40);
  const moduleIndependentActions = new Set([
    "toggle-enabled",
    "create-period",
    "set-active-period",
    "toggle-period-open",
    "close-session",
  ]);

  const actionRoles = {
    "toggle-enabled": ["admin"],
    "create-period": ["admin"],
    "set-active-period": ["admin"],
    "toggle-period-open": ["admin"],
    "create-course": ["academician", "admin"],
    "start-session": ["academician", "admin"],
    "close-session": ["academician", "admin"],
    "join-course": ["student"],
    "record-attendance": ["student"],
  } as const;

  const allowedRoles = actionRoles[action as keyof typeof actionRoles];
  if (!allowedRoles) return { ok: false, message: "Geçersiz QR işlemi." };
  requireRole(actor, [...allowedRoles]);
  await enforceRateLimit(sql, actor, action, actor.role === "student" ? 12 : 30);

  if (!moduleIndependentActions.has(action)) {
    const settings = await sql`SELECT enabled FROM campuso_qr_settings WHERE id = 'main'`;
    if (!settings[0]?.enabled) return { ok: false, message: "QR Yoklama modülü şu anda kapalı." };
  }

  if (action === "create-period") {
    const academicYear = asText(body.academicYear, 9);
    const term = asText(body.term, 12).toLowerCase() as (typeof PERIOD_TERMS)[number];
    const startDate = asText(body.startDate, 10);
    const endDate = asText(body.endDate, 10);
    const yearMatch = /^(\d{4})-(\d{4})$/.exec(academicYear);
    if (!yearMatch || Number(yearMatch[2]) !== Number(yearMatch[1]) + 1) {
      return { ok: false, message: "Akademik yıl 2026-2027 biçiminde ve ardışık olmalıdır." };
    }
    if (!PERIOD_TERMS.includes(term)) return { ok: false, message: "Geçerli bir dönem seçmelisin." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
      return { ok: false, message: "Dönem başlangıç ve bitiş tarihlerini kontrol et." };
    }

    const inserted = await sql`
      INSERT INTO campuso_academic_periods (
        id, academic_year, term, label, start_date, end_date, is_active, is_open
      )
      VALUES (
        ${randomUUID()}, ${academicYear}, ${term}, ${`${academicYear} ${TERM_LABELS[term]}`},
        ${startDate}, ${endDate}, FALSE, TRUE
      )
      ON CONFLICT (academic_year, term) DO NOTHING
      RETURNING id
    `;
    if (!inserted.length) return { ok: false, message: "Bu akademik yıl ve dönem zaten mevcut." };
    await audit(sql, actor, action, "academic_period", String(inserted[0].id), { academicYear, term });
    return { ok: true, message: `${academicYear} ${TERM_LABELS[term]} dönemi oluşturuldu.` };
  }

  if (action === "set-active-period") {
    const periodId = asText(body.periodId, 80);
    const periods = await sql`SELECT id, label, is_open FROM campuso_academic_periods WHERE id = ${periodId}`;
    if (!periods.length) return { ok: false, message: "Dönem bulunamadı." };
    if (!periods[0].is_open) return { ok: false, message: "Kapalı bir dönem aktif dönem yapılamaz. Önce dönemi aç." };

    await sql`UPDATE campuso_academic_periods SET is_active = FALSE WHERE is_active = TRUE`;
    await sql`UPDATE campuso_academic_periods SET is_active = TRUE WHERE id = ${periodId}`;
    await sql`
      UPDATE campuso_qr_settings
      SET active_period_id = ${periodId}, updated_at = NOW()
      WHERE id = 'main'
    `;
    await audit(sql, actor, action, "academic_period", periodId);
    return { ok: true, message: `${String(periods[0].label)} aktif dönem yapıldı.` };
  }

  if (action === "toggle-period-open") {
    const periodId = asText(body.periodId, 80);
    const open = body.open === true;
    const periods = await sql`SELECT id, label, is_active FROM campuso_academic_periods WHERE id = ${periodId}`;
    if (!periods.length) return { ok: false, message: "Dönem bulunamadı." };
    await sql`UPDATE campuso_academic_periods SET is_open = ${open} WHERE id = ${periodId}`;
    if (!open) {
      await sql`
        UPDATE campuso_attendance_sessions AS session
        SET closed_at = COALESCE(session.closed_at, NOW())
        FROM campuso_courses AS course
        WHERE session.course_id = course.id
          AND course.period_id = ${periodId}
          AND session.closed_at IS NULL
      `;
    }
    await audit(sql, actor, action, "academic_period", periodId, { open });
    return {
      ok: true,
      message: open
        ? `${String(periods[0].label)} işlemlere açıldı.`
        : `${String(periods[0].label)} kapatıldı; kayıtlar arşivde korunuyor.`,
    };
  }

  if (action === "create-course") {
    const name = asText(body.name, 100);
    const courseCode = asText(body.courseCode, 30).toUpperCase();
    const section = asText(body.section, 20) || "1";
    if (!name || !courseCode) return { ok: false, message: "Ders adı ve ders kodu zorunludur." };

    const activePeriod = await getActivePeriod(sql);
    if (!activePeriod) return { ok: false, message: "Önce yönetici panelinden aktif dönem seçilmelidir." };
    if (!activePeriod.is_open) return { ok: false, message: "Aktif dönem kapalı; yeni ders grubu oluşturulamaz." };

    const id = randomUUID();
    const joinCode = createCode(6);
    await sql`
      INSERT INTO campuso_courses (
        id, period_id, owner_user_id, name, course_code, section, join_code
      )
      VALUES (
        ${id}, ${String(activePeriod.id)}, ${actor.id}, ${name}, ${courseCode}, ${section}, ${joinCode}
      )
    `;
    await audit(sql, actor, action, "course", id, { courseCode, periodId: String(activePeriod.id) });
    return { ok: true, message: `${courseCode} grubu ${String(activePeriod.label)} dönemine oluşturuldu.` };
  }

  if (action === "start-session") {
    const courseId = asText(body.courseId, 80);
    const duration = Math.min(10, Math.max(1, Number(body.duration) || 3));
    const courses = await sql`
      SELECT course.id, course.period_id, course.owner_user_id,
             period.label, period.is_active, period.is_open
      FROM campuso_courses AS course
      JOIN campuso_academic_periods AS period ON period.id = course.period_id
      WHERE course.id = ${courseId}
    `;
    if (!courses.length) return { ok: false, message: "Ders grubu bulunamadı." };
    const course = courses[0];
    if (
      actor.role !== "admin"
      && course.owner_user_id !== null
      && String(course.owner_user_id) !== actor.id
    ) {
      throw new AuthError("Bu ders grubu üzerinde işlem yetkiniz bulunmuyor.", 403);
    }
    if (!course.is_active) return { ok: false, message: "Geçmiş döneme ait bir ders için yeni yoklama başlatılamaz." };
    if (!course.is_open) return { ok: false, message: `${String(course.label)} dönemi kapalı.` };

    await sql`
      UPDATE campuso_attendance_sessions
      SET closed_at = NOW()
      WHERE course_id = ${courseId} AND closed_at IS NULL
    `;
    const sessionId = randomUUID();
    await sql`
      INSERT INTO campuso_attendance_sessions (id, course_id, token, expires_at)
      VALUES (${sessionId}, ${courseId}, ${createCode(8)}, NOW() + (${duration} * INTERVAL '1 minute'))
    `;
    await audit(sql, actor, action, "attendance_session", sessionId, { courseId, duration });
    return { ok: true, message: "Yoklama başlatıldı. QR artık gerçek CampusO bağlantısını taşıyor." };
  }

  if (action === "close-session") {
    const sessionId = asText(body.sessionId, 80);
    const sessions = await sql`
      SELECT session.id, course.owner_user_id
      FROM campuso_attendance_sessions AS session
      JOIN campuso_courses AS course ON course.id = session.course_id
      WHERE session.id = ${sessionId}
      LIMIT 1
    `;
    if (!sessions.length) return { ok: false, message: "Yoklama bulunamadı." };
    if (
      actor.role !== "admin"
      && sessions[0].owner_user_id !== null
      && String(sessions[0].owner_user_id) !== actor.id
    ) {
      throw new AuthError("Bu yoklamayı kapatma yetkiniz bulunmuyor.", 403);
    }
    await sql`
      UPDATE campuso_attendance_sessions
      SET closed_at = COALESCE(closed_at, NOW())
      WHERE id = ${sessionId}
    `;
    await audit(sql, actor, action, "attendance_session", sessionId);
    return { ok: true, message: "Yoklama kapatıldı." };
  }

  if (action === "join-course") {
    const joinCode = asText(body.joinCode, 12).toUpperCase();
    const normalizedStudentNumber = studentNumber(body.studentNumber);
    if (!normalizedStudentNumber) {
      return { ok: false, message: "Öğrenci numarası en az 4 karakter olmalı ve yalnız harf, rakam veya tire içermelidir." };
    }

    const courses = await sql`
      SELECT course.id, course.course_code, period.label, period.is_active, period.is_open
      FROM campuso_courses AS course
      JOIN campuso_academic_periods AS period ON period.id = course.period_id
      WHERE course.join_code = ${joinCode}
    `;
    if (!courses.length) return { ok: false, message: "Katılım kodu geçersiz." };
    const course = courses[0];
    if (!course.is_active || !course.is_open) {
      return { ok: false, message: `${String(course.label)} dönemi kapalı veya arşivde; bu gruba yeni katılım alınmıyor.` };
    }
    const numberOwners = await sql`
      SELECT student_user_id
      FROM campuso_course_memberships
      WHERE course_id = ${String(course.id)} AND student_number = ${normalizedStudentNumber}
      LIMIT 1
    `;
    if (
      numberOwners[0]?.student_user_id
      && String(numberOwners[0].student_user_id) !== actor.id
    ) {
      return { ok: false, message: "Bu öğrenci numarası başka bir hesaba bağlı. Öğrenci işleriyle iletişime geçin." };
    }
    await sql`
      DELETE FROM campuso_course_memberships
      WHERE course_id = ${String(course.id)}
        AND student_user_id = ${actor.id}
        AND student_number <> ${normalizedStudentNumber}
    `;
    await sql`
      INSERT INTO campuso_course_memberships (
        course_id, student_user_id, student_name, student_number
      )
      VALUES (${String(course.id)}, ${actor.id}, ${actor.displayName}, ${normalizedStudentNumber})
      ON CONFLICT (course_id, student_number)
      DO UPDATE SET
        student_user_id = EXCLUDED.student_user_id,
        student_name = EXCLUDED.student_name
    `;
    await audit(sql, actor, action, "course", String(course.id));
    return { ok: true, message: `${String(course.course_code)} ders grubuna katıldın.` };
  }

  if (action === "record-attendance") {
    const token = asText(body.token, 16).toUpperCase();
    const normalizedStudentNumber = studentNumber(body.studentNumber);
    if (!normalizedStudentNumber) {
      return { ok: false, message: "Öğrenci numaranı kontrol edip tekrar dene." };
    }

    const sessions = await sql`
      SELECT session.id, session.course_id, course.course_code, period.label
      FROM campuso_attendance_sessions AS session
      JOIN campuso_courses AS course ON course.id = session.course_id
      JOIN campuso_academic_periods AS period ON period.id = course.period_id
      WHERE session.token = ${token}
        AND session.closed_at IS NULL
        AND session.expires_at > NOW()
        AND period.is_active = TRUE
        AND period.is_open = TRUE
      LIMIT 1
    `;
    if (!sessions.length) return { ok: false, message: "Bu QR yoklaması kapalı, süresi dolmuş veya geçmiş döneme ait." };

    const session = sessions[0];
    const numberOwners = await sql`
      SELECT student_user_id
      FROM campuso_course_memberships
      WHERE course_id = ${String(session.course_id)} AND student_number = ${normalizedStudentNumber}
      LIMIT 1
    `;
    if (
      numberOwners[0]?.student_user_id
      && String(numberOwners[0].student_user_id) !== actor.id
    ) {
      return { ok: false, message: "Bu öğrenci numarası başka bir hesaba bağlı. Yoklama kaydı oluşturulmadı." };
    }
    await sql`
      DELETE FROM campuso_course_memberships
      WHERE course_id = ${String(session.course_id)}
        AND student_user_id = ${actor.id}
        AND student_number <> ${normalizedStudentNumber}
    `;
    await sql`
      INSERT INTO campuso_course_memberships (
        course_id, student_user_id, student_name, student_number
      )
      VALUES (${String(session.course_id)}, ${actor.id}, ${actor.displayName}, ${normalizedStudentNumber})
      ON CONFLICT (course_id, student_number)
      DO UPDATE SET
        student_user_id = EXCLUDED.student_user_id,
        student_name = EXCLUDED.student_name
    `;
    const existing = await sql`
      SELECT id
      FROM campuso_attendance_records
      WHERE session_id = ${String(session.id)} AND student_user_id = ${actor.id}
      LIMIT 1
    `;
    if (existing.length) return { ok: true, message: "Bu yoklamaya daha önce katıldın; kaydın zaten mevcut." };
    const conflictingRecord = await sql`
      SELECT student_user_id
      FROM campuso_attendance_records
      WHERE session_id = ${String(session.id)} AND student_number = ${normalizedStudentNumber}
      LIMIT 1
    `;
    if (
      conflictingRecord[0]?.student_user_id
      && String(conflictingRecord[0].student_user_id) !== actor.id
    ) {
      return { ok: false, message: "Bu öğrenci numarasıyla yoklama kaydı zaten bulunuyor." };
    }
    const recordId = randomUUID();
    const inserted = await sql`
      INSERT INTO campuso_attendance_records (
        id, session_id, course_id, student_user_id, student_name, student_number
      )
      VALUES (
        ${recordId}, ${String(session.id)}, ${String(session.course_id)},
        ${actor.id}, ${actor.displayName}, ${normalizedStudentNumber}
      )
      ON CONFLICT (session_id, student_number) DO NOTHING
      RETURNING id
    `;
    if (!inserted.length) return { ok: true, message: "Bu yoklamaya daha önce katıldın; kaydın zaten mevcut." };
    await audit(sql, actor, action, "attendance_record", recordId, { courseId: String(session.course_id) });
    return { ok: true, message: `${String(session.course_code)} dersine ve yoklamaya otomatik katıldın.` };
  }

  if (action === "toggle-enabled") {
    const enabled = body.enabled === true;
    await sql`
      UPDATE campuso_qr_settings
      SET enabled = ${enabled}, updated_at = NOW()
      WHERE id = 'main'
    `;
    await audit(sql, actor, action, "qr_settings", "main", { enabled });
    return { ok: true, message: enabled ? "QR modülü açıldı." : "QR modülü kapatıldı." };
  }

  return { ok: false, message: "Geçersiz QR işlemi." };
}
