// =========================================================
// SIGAC - JS comentado: db.js
// Objetivo: orientar a equipe sobre a função deste arquivo.
// Comentários não aparecem para o usuário final.
// =========================================================

require('dotenv').config({ quiet: true });

// BANCO - Configuração da conexão com o PostgreSQL usando DATABASE_URL do .env.
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || '';

if (!DATABASE_URL) {
  throw new Error('Defina a variavel de ambiente DATABASE_URL para conectar ao PostgreSQL.');
}

function getSslConfig() {
  const explicitValue = String(process.env.DATABASE_SSL || process.env.PGSSLMODE || '').toLowerCase();
  const urlValue = /(?:^|[?&])sslmode=([^&]+)/i.exec(DATABASE_URL)?.[1]?.toLowerCase()
    || /(?:^|[?&])ssl=(true|1)/i.exec(DATABASE_URL)?.[1]?.toLowerCase();
  const value = explicitValue || urlValue || '';
  if (['false', '0', 'disable', 'off'].includes(value)) return false;
  if (['verify-full', 'verify-ca', 'true', '1', 'require', 'on', 'prefer'].includes(value)) {
    return { rejectUnauthorized: true };
  }
  return undefined;
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: getSslConfig(),
  max: Number(process.env.PG_POOL_MAX || 5),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10000)
});

function toPgPlaceholders(text) {
  let index = 0;
  return String(text).replace(/\?/g, () => `$${++index}`);
}

async function withClient(callback) {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

function splitStatements(sql) {
  return String(sql)
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

class Statement {
  constructor(executor, text) {
    this.executor = executor;
    this.text = toPgPlaceholders(text);
  }

  async get(...params) {
    const result = await this.executor.query(this.text, params);
    return result.rows[0];
  }

  async all(...params) {
    const result = await this.executor.query(this.text, params);
    return result.rows;
  }

  async run(...params) {
    const result = await this.executor.query(this.text, params);
    return { changes: result.rowCount || 0 };
  }
}

function createExecutor(executor) {
  return {
    prepare(text) {
      return new Statement(executor, text);
    },
    async exec(sql) {
      for (const statement of splitStatements(sql)) {
        await executor.query(statement);
      }
    }
  };
}

const db = createExecutor(pool);

async function transaction(callback) {
  return withClient(async (client) => {
    const tx = createExecutor(client);
    await client.query('BEGIN');
    try {
      const result = await callback(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

async function initDatabase() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      sigla TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      area TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'Graduação',
      turno TEXT NOT NULL,
      carga_horaria_total INTEGER NOT NULL DEFAULT 0,
      horas_meta INTEGER NOT NULL DEFAULT 120,
      ativo INTEGER NOT NULL DEFAULT 1
    );

    ALTER TABLE courses ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'Graduação';
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS carga_horaria_total INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS ativo INTEGER NOT NULL DEFAULT 1;

    UPDATE courses
    SET sigla = CASE id
      WHEN 'dataset_v2_course_1' THEN 'ADS2'
      WHEN 'dataset_v2_course_2' THEN 'CC'
      WHEN 'dataset_v2_course_3' THEN 'SIWEB2'
      WHEN 'dataset_v2_course_4' THEN 'GTI'
      WHEN 'dataset_v2_course_5' THEN 'BD2'
      WHEN 'dataset_v2_course_6' THEN 'RC2'
      WHEN 'dataset_v2_course_7' THEN 'SI2'
      WHEN 'dataset_v2_course_8' THEN 'ES'
      WHEN 'dataset_v2_course_9' THEN 'JD2'
      WHEN 'dataset_v2_course_10' THEN 'CN'
      WHEN 'dataset_v2_course_11' THEN 'IA'
      WHEN 'dataset_v2_course_12' THEN 'CD'
      WHEN 'dataset_v2_course_13' THEN 'UXUI'
      WHEN 'dataset_v2_course_14' THEN 'MD'
      WHEN 'dataset_v2_course_15' THEN 'ADM2'
      WHEN 'dataset_v2_course_16' THEN 'GC2'
      WHEN 'dataset_v2_course_17' THEN 'PG'
      WHEN 'dataset_v2_course_18' THEN 'LOG2'
      WHEN 'dataset_v2_course_19' THEN 'RH2'
      WHEN 'dataset_v2_course_20' THEN 'FIN'
      WHEN 'dataset_v2_course_21' THEN 'CONT2'
      WHEN 'dataset_v2_course_22' THEN 'PED'
      WHEN 'dataset_v2_course_23' THEN 'PSI'
      WHEN 'dataset_v2_course_24' THEN 'ENF2'
      WHEN 'dataset_v2_course_25' THEN 'FISIO'
      WHEN 'dataset_v2_course_26' THEN 'NUT'
      WHEN 'dataset_v2_course_27' THEN 'ARQ'
      WHEN 'dataset_v2_course_28' THEN 'EC'
      WHEN 'dataset_v2_course_29' THEN 'DIR'
      WHEN 'dataset_v2_course_30' THEN 'PP'
      WHEN 'dataset_v2_course_31' THEN 'BIO'
      WHEN 'dataset_v2_course_32' THEN 'FARM'
      WHEN 'dataset_v2_course_33' THEN 'EF'
      WHEN 'dataset_v2_course_34' THEN 'RAD'
      WHEN 'dataset_v2_course_35' THEN 'TUR2'
      WHEN 'dataset_v2_course_36' THEN 'HOT'
      WHEN 'dataset_v2_course_37' THEN 'EVT'
      WHEN 'dataset_v2_course_38' THEN 'MODA'
      WHEN 'dataset_v2_course_39' THEN 'GAST2'
      WHEN 'dataset_v2_course_40' THEN 'CA'
      ELSE sigla
    END
    WHERE id LIKE 'dataset_v2_course_%'
      AND sigla ~ '^D[0-9]{3}$';

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('superadmin', 'coordenador', 'aluno')),
      ativo INTEGER NOT NULL DEFAULT 1,
      course_id TEXT REFERENCES courses(id),
      matricula TEXT UNIQUE,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      password_updated_at TEXT,
      temporary_password_issued_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coordinator_courses (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS student_courses (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      matricula TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS activity_rules (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      categoria TEXT NOT NULL,
      limite_maximo INTEGER NOT NULL DEFAULT 0,
      carga_minima INTEGER NOT NULL DEFAULT 0,
      exige_certificado INTEGER NOT NULL DEFAULT 1,
      exige_aprovacao INTEGER NOT NULL DEFAULT 1,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      course_id TEXT,
      horas INTEGER NOT NULL,
      criado_por TEXT NOT NULL REFERENCES users(id),
      criado_em TEXT NOT NULL
    );

    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS course_id TEXT;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'Curso livre';
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Aberta';

    CREATE TABLE IF NOT EXISTS opportunity_registrations (
      opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (opportunity_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      course_id TEXT NOT NULL REFERENCES courses(id),
      horas INTEGER NOT NULL,
      prazo TEXT,
      material_nome TEXT,
      material_arquivo TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      current_status TEXT NOT NULL DEFAULT 'em_analise'
    );

    CREATE TABLE IF NOT EXISTS submission_versions (
      id BIGSERIAL PRIMARY KEY,
      submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      arquivo_nome TEXT NOT NULL,
      arquivo_data TEXT NOT NULL,
      observacao TEXT,
      status TEXT NOT NULL,
      feedback TEXT,
      enviada_em TEXT NOT NULL,
      avaliada_em TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mensagem TEXT NOT NULL,
      tipo TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_data TEXT NOT NULL,
      observation TEXT,
      declared_hours INTEGER NOT NULL DEFAULT 0,
      extracted_text TEXT NOT NULL DEFAULT '',
      detected_hours INTEGER NOT NULL DEFAULT 0,
      detected_name TEXT NOT NULL DEFAULT '',
      detected_institution TEXT NOT NULL DEFAULT '',
      detected_date TEXT NOT NULL DEFAULT '',
      detected_title TEXT NOT NULL DEFAULT '',
      detected_course_name TEXT NOT NULL DEFAULT '',
      found_fields TEXT NOT NULL DEFAULT '[]',
      missing_fields TEXT NOT NULL DEFAULT '[]',
      confidence_score INTEGER NOT NULL DEFAULT 0,
      human_summary TEXT NOT NULL DEFAULT '',
      ocr_status TEXT NOT NULL DEFAULT 'nao_processado',
      ocr_reason TEXT NOT NULL DEFAULT 'Aguardando análise do admin.',
      admin_status TEXT NOT NULL DEFAULT 'pendente',
      admin_feedback TEXT NOT NULL DEFAULT '',
      approved_hours INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT REFERENCES users(id),
      ocr_processed_at TEXT
    );


    -- ===== INÍCIO ADIÇÃO ML SIGAC: tabelas que guardam execuções e riscos gerados pelo ML =====
    CREATE TABLE IF NOT EXISTS ml_execucoes (
      id TEXT PRIMARY KEY,
      started_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL,
      total_registros INTEGER DEFAULT 0,
      total_aprovados INTEGER DEFAULT 0,
      total_rejeitados INTEGER DEFAULT 0,
      total_em_analise INTEGER DEFAULT 0,
      taxa_aprovacao REAL DEFAULT 0,
      dataset_path TEXT,
      risk_file_path TEXT,
      modelo_path TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS ml_risco_alunos (
      id TEXT PRIMARY KEY,
      execucao_id TEXT NOT NULL REFERENCES ml_execucoes(id) ON DELETE CASCADE,
      aluno_id TEXT NOT NULL,
      aluno_nome TEXT DEFAULT '',
      aluno_email TEXT DEFAULT '',
      aluno_matricula TEXT DEFAULT '',
      curso TEXT,
      meta_horas REAL DEFAULT 0,
      horas_aprovadas REAL DEFAULT 0,
      percentual_concluido REAL DEFAULT 0,
      qtd_aprovadas INTEGER DEFAULT 0,
      qtd_rejeitadas INTEGER DEFAULT 0,
      qtd_pendentes INTEGER DEFAULT 0,
      classificacao_risco TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- ===== FIM ADIÇÃO ML SIGAC: tabelas do módulo ML =====

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS coordination_messages (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      coordinator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_by_student INTEGER NOT NULL DEFAULT 0,
      read_by_coord INTEGER NOT NULL DEFAULT 0
    );

    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TEXT;

    ALTER TABLE users ADD COLUMN IF NOT EXISTS matricula TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_updated_at TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS temporary_password_issued_at TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS telefone TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS endereco TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS data_nascimento TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS curso_interesse TEXT NOT NULL DEFAULT '';
    ALTER TABLE student_courses ADD COLUMN IF NOT EXISTS matricula TEXT;
    ALTER TABLE student_courses ADD COLUMN IF NOT EXISTS ativo INTEGER NOT NULL DEFAULT 1;

    UPDATE users
    SET matricula = 'SIGAC-' || EXTRACT(YEAR FROM NOW())::INT || '-' || UPPER(SUBSTRING(MD5(id), 1, 8))
    WHERE matricula IS NULL OR matricula = '';

    UPDATE student_courses sc
    SET matricula = u.matricula
    FROM users u
    WHERE u.id = sc.user_id
      AND (sc.matricula IS NULL OR sc.matricula = '');

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_matricula_unique ON users(matricula) WHERE matricula IS NOT NULL AND matricula <> '';

    ALTER TABLE submission_versions ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT '';
    ALTER TABLE submission_versions ADD COLUMN IF NOT EXISTS horas_declaradas INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE submission_versions ADD COLUMN IF NOT EXISTS descricao TEXT NOT NULL DEFAULT '';

    ALTER TABLE certificates ADD COLUMN IF NOT EXISTS course_id TEXT;
    ALTER TABLE certificates ADD COLUMN IF NOT EXISTS vinculo_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE certificates ADD COLUMN IF NOT EXISTS matricula TEXT NOT NULL DEFAULT '';
    ALTER TABLE certificates ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';

    UPDATE certificates cert
    SET course_id = u.course_id,
        vinculo_id = CASE WHEN u.course_id IS NOT NULL AND u.course_id <> '' THEN cert.sender_id || ':' || u.course_id ELSE '' END,
        matricula = COALESCE(NULLIF(u.matricula, ''), cert.matricula, '')
    FROM users u
    WHERE u.id = cert.sender_id
      AND cert.sender_type = 'aluno'
      AND (cert.course_id IS NULL OR cert.course_id = '');

    ALTER TABLE ml_risco_alunos ADD COLUMN IF NOT EXISTS aluno_nome TEXT DEFAULT '';
    ALTER TABLE ml_risco_alunos ADD COLUMN IF NOT EXISTS aluno_email TEXT DEFAULT '';
    ALTER TABLE ml_risco_alunos ADD COLUMN IF NOT EXISTS aluno_matricula TEXT DEFAULT '';

    CREATE INDEX IF NOT EXISTS idx_users_tipo_ativo ON users(tipo, ativo);
    CREATE INDEX IF NOT EXISTS idx_users_course_id ON users(course_id);

    CREATE INDEX IF NOT EXISTS idx_coordinator_courses_user_id ON coordinator_courses(user_id);
    CREATE INDEX IF NOT EXISTS idx_coordinator_courses_course_id ON coordinator_courses(course_id);

    CREATE INDEX IF NOT EXISTS idx_student_courses_user_id ON student_courses(user_id);
    CREATE INDEX IF NOT EXISTS idx_student_courses_course_id ON student_courses(course_id);

    CREATE INDEX IF NOT EXISTS idx_activity_rules_course_id ON activity_rules(course_id);

    CREATE INDEX IF NOT EXISTS idx_opportunity_registrations_opportunity_id ON opportunity_registrations(opportunity_id);
    CREATE INDEX IF NOT EXISTS idx_opportunity_registrations_user_id ON opportunity_registrations(user_id);

    CREATE INDEX IF NOT EXISTS idx_activities_course_id ON activities(course_id);
    CREATE INDEX IF NOT EXISTS idx_activities_created_by ON activities(created_by);
    CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);

    CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_activity_id ON submissions(activity_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_current_status ON submissions(current_status);

    CREATE INDEX IF NOT EXISTS idx_submission_versions_submission_id ON submission_versions(submission_id);
    CREATE INDEX IF NOT EXISTS idx_submission_versions_status ON submission_versions(status);
    CREATE INDEX IF NOT EXISTS idx_submission_versions_enviada_em ON submission_versions(enviada_em);

    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

    CREATE INDEX IF NOT EXISTS idx_certificates_sender_id ON certificates(sender_id);
    CREATE INDEX IF NOT EXISTS idx_certificates_sender_status ON certificates(sender_id, admin_status);
    CREATE INDEX IF NOT EXISTS idx_certificates_sender_course ON certificates(sender_id, course_id);
    CREATE INDEX IF NOT EXISTS idx_certificates_course_id ON certificates(course_id);
    CREATE INDEX IF NOT EXISTS idx_certificates_admin_status ON certificates(admin_status);
    CREATE INDEX IF NOT EXISTS idx_certificates_created_at ON certificates(created_at);

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_password_reset_expires_at ON password_reset_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_coordination_messages_student_id ON coordination_messages(student_id);
    CREATE INDEX IF NOT EXISTS idx_coordination_messages_course_id ON coordination_messages(course_id);
    CREATE INDEX IF NOT EXISTS idx_coordination_messages_created_at ON coordination_messages(created_at);


    -- ===== INÍCIO ADIÇÃO ML SIGAC: índices para acelerar consultas das tabelas de ML =====
    CREATE INDEX IF NOT EXISTS idx_ml_execucoes_started_at ON ml_execucoes(started_at);
    CREATE INDEX IF NOT EXISTS idx_ml_execucoes_status ON ml_execucoes(status);
    CREATE INDEX IF NOT EXISTS idx_ml_risco_alunos_execucao_id ON ml_risco_alunos(execucao_id);
    CREATE INDEX IF NOT EXISTS idx_ml_risco_alunos_classificacao ON ml_risco_alunos(classificacao_risco);

    -- ===== FIM ADIÇÃO ML SIGAC: índices do módulo ML =====

    CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

    INSERT INTO student_courses (user_id, course_id)
    SELECT id, course_id
    FROM users
    WHERE tipo = 'aluno' AND course_id IS NOT NULL
    ON CONFLICT DO NOTHING;

    UPDATE emails SET status = 'simulado (fila local)' WHERE status = 'simulado';

    INSERT INTO activity_rules
      (id, course_id, categoria, limite_maximo, carga_minima, exige_certificado, exige_aprovacao, created_by, created_at)
    SELECT 'rule_' || id || '_eventos', id, 'Eventos', 30, 4, 1, 1, NULL, NOW()::TEXT
    FROM courses
    ON CONFLICT DO NOTHING;

    INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details, created_at)
    VALUES ('audit_migration_requirements_2_7', NULL, 'migrou_requisitos_2_7', 'sistema', 'requirements-2-7',
            'Migração criou vínculos múltiplos de alunos, regras persistidas e logs de auditoria.', NOW()::TEXT)
    ON CONFLICT DO NOTHING;
  `);
}

module.exports = {
  db,
  initDatabase,
  pool,
  transaction
};
