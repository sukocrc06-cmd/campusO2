import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { randomBytes, randomUUID } from "node:crypto";

type SqlClient = NeonQueryFunction<false, false>;

type QrActionBody = Record<string, unknown> & { action?: string };

let schemaPromise: Promise<void> | null = null;

function databaseUrl() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_MISSING");
  return url;
}

async function initializeSchema(sql: SqlClient) {
  await sql`
    CREATE TABLE IF NOT EXISTS campuso_qr_settings (
      id TEXT PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    INSERT INTO campuso_qr_settings (id, enabled)
    VALUES ('main', TRUE)
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS campuso_courses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      course_code TEXT NOT NULL,
      section TEXT NOT NULL,
      join_code TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
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
      student_name TEXT NOT NULL,
      student_number TEXT NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (course_id, student_number)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS campuso_attendance_records (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES campuso_attendance_sessions(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES campuso_courses(id) ON DELETE CASCADE,
      student_name TEXT NOT NULL,
      student_number TEXT NOT NULL,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (session_id, student_number)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS campuso_sessions_course_idx ON campuso_attendance_sessions(course_id)`;
  await sql`CREATE INDEX IF NOT EXISTS campuso_records_session_idx ON campuso_attendance_records(session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS campuso_records_student_idx ON campuso_attendance_records(student_number)`;
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

function createCode(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export async function loadQrStore() {
  const sql = await getDatabase();
  const [settings, courses, sessions, memberships, records] = await Promise.all([
    sql`SELECT enabled FROM campuso_qr_settings WHERE id = 'main'`,
    sql`SELECT id, name, course_code, section, join_code, created_at FROM campuso_courses ORDER BY created_at DESC`,
    sql`SELECT id, course_id, token, created_at, expires_at, closed_at FROM campuso_attendance_sessions ORDER BY created_at DESC`,
    sql`SELECT course_id, student_name, student_number, joined_at FROM campuso_course_memberships ORDER BY joined_at DESC`,
    sql`SELECT id, session_id, course_id, student_name, student_number, checked_at FROM campuso_attendance_records ORDER BY checked_at DESC`,
  ]);

  return {
    enabled: Boolean(settings[0]?.enabled ?? true),
    courses: courses.map((row) => ({
      id: String(row.id),
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

export async function performQrAction(body: QrActionBody) {
  const sql = await getDatabase();
  const action = asText(body.action, 40);

  if (action !== "toggle-enabled") {
    const settings = await sql`SELECT enabled FROM campuso_qr_settings WHERE id = 'main'`;
    if (!settings[0]?.enabled) return { ok: false, message: "QR Yoklama modülü şu anda kapalı." };
  }

  if (action === "create-course") {
    const name = asText(body.name, 100);
    const courseCode = asText(body.courseCode, 30).toUpperCase();
    const section = asText(body.section, 20) || "1";
    if (!name || !courseCode) return { ok: false, message: "Ders adı ve ders kodu zorunludur." };

    const id = randomUUID();
    const joinCode = createCode(6);
    await sql`
      INSERT INTO campuso_courses (id, name, course_code, section, join_code)
      VALUES (${id}, ${name}, ${courseCode}, ${section}, ${joinCode})
    `;
    return { ok: true, message: `${courseCode} ders grubu oluşturuldu.` };
  }

  if (action === "start-session") {
    const courseId = asText(body.courseId, 80);
    const duration = Math.min(10, Math.max(1, Number(body.duration) || 3));
    const course = await sql`SELECT id FROM campuso_courses WHERE id = ${courseId}`;
    if (!course.length) return { ok: false, message: "Ders grubu bulunamadı." };

    await sql`
      UPDATE campuso_attendance_sessions
      SET closed_at = NOW()
      WHERE closed_at IS NULL AND expires_at > NOW()
    `;
    await sql`
      INSERT INTO campuso_attendance_sessions (id, course_id, token, expires_at)
      VALUES (${randomUUID()}, ${courseId}, ${createCode(8)}, NOW() + (${duration} * INTERVAL '1 minute'))
    `;
    return { ok: true, message: "Yoklama başlatıldı. QR artık gerçek CampusO bağlantısını taşıyor." };
  }

  if (action === "close-session") {
    const sessionId = asText(body.sessionId, 80);
    await sql`
      UPDATE campuso_attendance_sessions
      SET closed_at = COALESCE(closed_at, NOW())
      WHERE id = ${sessionId}
    `;
    return { ok: true, message: "Yoklama kapatıldı." };
  }

  if (action === "join-course") {
    const joinCode = asText(body.joinCode, 12).toUpperCase();
    const studentName = asText(body.studentName, 100);
    const studentNumber = asText(body.studentNumber, 40);
    if (!studentName || !studentNumber) return { ok: false, message: "Önce öğrenci profilini kaydetmelisin." };

    const courses = await sql`SELECT id, course_code FROM campuso_courses WHERE join_code = ${joinCode}`;
    if (!courses.length) return { ok: false, message: "Katılım kodu geçersiz." };
    const course = courses[0];
    await sql`
      INSERT INTO campuso_course_memberships (course_id, student_name, student_number)
      VALUES (${String(course.id)}, ${studentName}, ${studentNumber})
      ON CONFLICT (course_id, student_number)
      DO UPDATE SET student_name = EXCLUDED.student_name
    `;
    return { ok: true, message: `${String(course.course_code)} ders grubuna katıldın.` };
  }

  if (action === "record-attendance") {
    const token = asText(body.token, 16).toUpperCase();
    const studentName = asText(body.studentName, 100);
    const studentNumber = asText(body.studentNumber, 40);
    if (!studentName || !studentNumber) return { ok: false, message: "Önce öğrenci profilini kaydetmelisin." };

    const sessions = await sql`
      SELECT session.id, session.course_id, course.course_code
      FROM campuso_attendance_sessions AS session
      JOIN campuso_courses AS course ON course.id = session.course_id
      WHERE session.token = ${token}
        AND session.closed_at IS NULL
        AND session.expires_at > NOW()
      LIMIT 1
    `;
    if (!sessions.length) return { ok: false, message: "Bu QR yoklaması kapalı, süresi dolmuş veya geçersiz." };

    const session = sessions[0];
    await sql`
      INSERT INTO campuso_course_memberships (course_id, student_name, student_number)
      VALUES (${String(session.course_id)}, ${studentName}, ${studentNumber})
      ON CONFLICT (course_id, student_number)
      DO UPDATE SET student_name = EXCLUDED.student_name
    `;
    const inserted = await sql`
      INSERT INTO campuso_attendance_records (id, session_id, course_id, student_name, student_number)
      VALUES (${randomUUID()}, ${String(session.id)}, ${String(session.course_id)}, ${studentName}, ${studentNumber})
      ON CONFLICT (session_id, student_number) DO NOTHING
      RETURNING id
    `;
    if (!inserted.length) return { ok: true, message: "Bu yoklamaya daha önce katıldın; kaydın zaten mevcut." };
    return { ok: true, message: `${String(session.course_code)} dersine ve yoklamaya otomatik katıldın.` };
  }

  if (action === "toggle-enabled") {
    const enabled = body.enabled === true;
    await sql`
      UPDATE campuso_qr_settings
      SET enabled = ${enabled}, updated_at = NOW()
      WHERE id = 'main'
    `;
    return { ok: true, message: enabled ? "QR modülü açıldı." : "QR modülü kapatıldı." };
  }

  return { ok: false, message: "Geçersiz QR işlemi." };
}
