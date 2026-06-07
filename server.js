// =========================================================
// SIGAC - JS comentado: server.js
// Objetivo: orientar a equipe sobre a função deste arquivo.
// Comentários não aparecem para o usuário final.
// =========================================================


const http = require('node:http'); 
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
// ===== INÍCIO ADIÇÃO ML SIGAC: import para permitir que a API execute scripts Python =====
const { execFile } = require('node:child_process');
// ===== FIM ADIÇÃO ML SIGAC: import para executar Python =====
const { URL } = require('node:url');
const nodemailer = require('nodemailer');
const { db, initDatabase, transaction } = require('./db');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const HOST = process.env.HOST || '127.0.0.1';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MINUTES || 480) * 60 * 1000;
const PASSWORD_RESET_TTL_MS = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 30) * 60 * 1000;
const SHOULD_SEED_DEMO_USERS = process.env.SEED_DEMO_USERS === 'true' || process.env.NODE_ENV !== 'production';
const DEFAULT_ALLOWED_ORIGINS = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`, 'null'];
const ALLOWED_ORIGINS = String(process.env.CORS_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const PUBLIC_ROOT_FILES = new Set([
  'adminsigac.html',
  'coordenador.html',
  'esqueci-senha.html',
  'index.html',
  'loginsigac.html',
  'reset.html',
  'resetarsenha.html',
  'manifest.json',
  'service-worker.js',
  'sigac.css',
  'student-polish.css',
  'Logo SIGAC.png',
  'Logo SIGAC-otimizada.png'
]);
const PUBLIC_DIRECTORIES = new Set(['js', 'fonts', 'icons', 'vendor']);
const PUBLIC_CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2'
};
const ALLOWED_UPLOAD_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);
const ALLOWED_CERTIFICATE_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg'
]);
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024;
const MAX_CERTIFICATES_PER_BATCH = 10;
const MAX_JSON_BODY_BYTES = Math.max(
  15 * 1024 * 1024,
  Math.ceil(MAX_UPLOAD_BYTES * MAX_CERTIFICATES_PER_BATCH * 1.45)
);

const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();
const textDataUrl = (text) => `data:text/plain;base64,${Buffer.from(String(text || ''), 'utf8').toString('base64')}`;
const addMs = (ms) => new Date(Date.now() + ms).toISOString();
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const PERF_LOGS_ENABLED = process.env.SIGAC_PERF_LOGS !== 'false';
const EMAIL_MODE = String(process.env.EMAIL_MODE || 'mock').toLowerCase();
// ===== INÍCIO ADIÇÃO ML SIGAC: caminhos do módulo ML e Python configurável pelo .env =====
const ML_DIR = path.join(ROOT, 'ml');
const ML_REPORTS_DIR = path.join(ML_DIR, 'reports');
const ML_MODELS_DIR = path.join(ML_DIR, 'models');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python';
// ===== FIM ADIÇÃO ML SIGAC: constantes do módulo ML =====
const READ_CACHE_TTL_MS = 60 * 1000;
const readCache = new Map();
const USER_COLUMNS = [
  'id',
  'nome',
  'email',
  'senha_hash',
  'tipo',
  'ativo',
  'course_id',
  'matricula',
  'must_change_password',
  'password_updated_at',
  'temporary_password_issued_at',
  'created_at',
  'telefone',
  'cpf',
  'endereco',
  'data_nascimento',
  'curso_interesse'
].join(', ');
const COURSE_COLUMNS = 'id, sigla, nome, area, tipo, turno, carga_horaria_total, horas_meta, ativo';
const ACTIVITY_COLUMNS = 'id, titulo, descricao, course_id, horas, prazo, material_nome, material_arquivo, created_by, created_at';
const SUBMISSION_COLUMNS = 'id, activity_id, student_id, current_status';
const SUBMISSION_VERSION_COLUMNS = 'id, submission_id, version, arquivo_nome, arquivo_data, observacao, categoria, horas_declaradas, descricao, status, feedback, enviada_em, avaliada_em';
const CERTIFICATE_COLUMNS = [
  'id',
  'sender_id',
  'sender_type',
  'course_id',
  'vinculo_id',
  'matricula',
  'category',
  'file_name',
  'file_data',
  'observation',
  'declared_hours',
  'extracted_text',
  'detected_hours',
  'detected_name',
  'detected_institution',
  'detected_date',
  'detected_title',
  'detected_course_name',
  'found_fields',
  'missing_fields',
  'confidence_score',
  'human_summary',
  'ocr_status',
  'ocr_reason',
  'admin_status',
  'admin_feedback',
  'approved_hours',
  'created_at',
  'reviewed_at',
  'reviewed_by',
  'ocr_processed_at'
].join(', ');
const EMAIL_COLUMNS = 'id, to_email, subject, body, kind, status, created_at';
const AUDIT_LOG_COLUMNS = 'id, actor_id, action, entity_type, entity_id, details, created_at';
const ML_EXECUCAO_COLUMNS = 'id, started_by, status, total_registros, total_aprovados, total_rejeitados, total_em_analise, taxa_aprovacao, dataset_path, risk_file_path, modelo_path, started_at, finished_at, error_message';
const ML_RISCO_ALUNOS_COLUMNS = 'id, execucao_id, aluno_id, aluno_nome, aluno_email, aluno_matricula, curso, meta_horas, horas_aprovadas, percentual_concluido, qtd_aprovadas, qtd_rejeitadas, qtd_pendentes, classificacao_risco, created_at';

function startPerf(label) {
  if (!PERF_LOGS_ENABLED) return null;
  console.time(label);
  return label;
}

function endPerf(label) {
  if (!label) return;
  console.timeEnd(label);
}

function validateDataUrl(dataUrl, allowedTypes = ALLOWED_UPLOAD_TYPES) {
  const match = String(dataUrl || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return { ok: false, error: 'Arquivo inválido.' };
  const mimeType = String(match[1] || '').toLowerCase();
  if (!allowedTypes.has(mimeType)) return { ok: false, error: 'Tipo de arquivo não permitido.' };
  const bytes = match[2]
    ? Buffer.byteLength(match[3] || '', 'base64')
    : Buffer.byteLength(decodeURIComponent(match[3] || ''), 'utf8');
  if (bytes > MAX_UPLOAD_BYTES) return { ok: false, error: `Arquivo acima do limite de ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` };
  return { ok: true, mimeType, bytes };
}

function sendDataUrlFile(req, res, dataUrl, fileName) {
  const match = String(dataUrl || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) {
    send(res, 400, { error: 'Arquivo inválido.' });
    return false;
  }
  const raw = match[2]
    ? Buffer.from(match[3], 'base64')
    : Buffer.from(decodeURIComponent(match[3] || ''), 'utf8');
  res.writeHead(200, {
    'Content-Type': match[1] || 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName || 'arquivo')}"`,
    'Cache-Control': 'private, max-age=300',
    ...getCorsHeaders(req)
  });
  res.end(raw);
  return true;
}

function runCommand(cmd, args = []) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve(String(stdout || '').trim());
    });
  });
}

async function findListeningProcessOnPort(port) {
  if (process.platform !== 'win32') return null;
  const output = await runCommand('netstat', ['-ano']);
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 5) {
      const [, localAddr, , state, pid] = parts;
      if (typeof localAddr === 'string' && localAddr.endsWith(`:${port}`) && state.toUpperCase() === 'LISTENING') {
        const candidate = Number(pid);
        if (Number.isInteger(candidate) && candidate > 0) return candidate;
      }
    }
  }
  return null;
}

async function getProcessImageName(pid) {
  if (process.platform !== 'win32') return null;
  const output = await runCommand('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']);
  const match = String(output || '').match(/^"([^"]+)"/);
  return match ? match[1].toLowerCase() : null;
}

async function killWinProcess(pid) {
  if (process.platform !== 'win32') return null;
  return runCommand('taskkill', ['/PID', String(pid), '/F']);
}

function listenOnPort(server, port, host) {
  return new Promise((resolve, reject) => {
    function cleanListeners() {
      server.removeListener('error', onError);
      server.removeListener('listening', onListening);
    }
    function onError(err) {
      cleanListeners();
      reject(err);
    }
    function onListening() {
      cleanListeners();
      resolve();
    }
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

function parsePagination(urlObj, defaultLimit = 50) {
  const hasPagination = urlObj.searchParams.has('page') || urlObj.searchParams.has('limit');
  if (!hasPagination) return null;
  const page = Math.max(1, Number.parseInt(urlObj.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(urlObj.searchParams.get('limit') || String(defaultLimit), 10) || defaultLimit));
  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
}

function defaultPagination(defaultLimit = 50) {
  return {
    page: 1,
    limit: defaultLimit,
    offset: 0
  };
}

function buildPagination(total, pagination) {
  if (!pagination) return null;
  return {
    page: pagination.page,
    limit: pagination.limit,
    total: Number(total || 0),
    totalPages: Math.max(1, Math.ceil(Number(total || 0) / pagination.limit))
  };
}

function withPagination(sql, pagination) {
  return pagination ? `${sql}\nLIMIT ? OFFSET ?` : sql;
}

async function cachedRead(key, loader, ttlMs = READ_CACHE_TTL_MS) {
  const now = Date.now();
  const cached = readCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;
  const value = await loader();
  readCache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

function clearReadCache() {
  readCache.clear();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

function generateTemporaryPassword() {
  const numberPart = crypto.randomInt(10000, 99999);
  const letterPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `Sigac@${numberPart}${letterPart}`;
}

function normalizeMatriculaPrefix(value, fallback = 'SIGAC') {
  const cleaned = String(value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  return cleaned || fallback;
}

const SENAC_COURSE_CATALOG = [
  ['course_ads', 'ADS', 'Análise e Desenvolvimento de Sistemas', 'Tecnologia', 'Noite', 120],
  ['course_jogos_digitais', 'JD', 'Jogos Digitais', 'Tecnologia', 'Noite', 120],
  ['course_gastronomia', 'GAST', 'Gastronomia', 'Hospitalidade', 'Noite', 100],
  ['course_logistica', 'LOG', 'Logística', 'Gestão', 'Tarde', 100],
  ['course_recursos_humanos', 'RH', 'Recursos Humanos', 'Gestão', 'Noite', 90],
  ['course_administracao', 'ADM', 'Administração', 'Gestão', 'Noite', 100],
  ['course_enfermagem', 'ENF', 'Enfermagem', 'Saúde', 'Manhã', 120],
  ['course_estetica_cosmetica', 'EST', 'Estética e Cosmética', 'Saúde', 'Noite', 100],
  ['course_design_grafico', 'DG', 'Design Gráfico', 'Comunicação', 'Noite', 100],
  ['course_marketing', 'MKT', 'Marketing', 'Gestão', 'Noite', 100],
  ['course_gestao_comercial', 'GC', 'Gestão Comercial', 'Gestão', 'Noite', 100],
  ['course_seguranca_informacao', 'SI', 'Segurança da Informação', 'Tecnologia', 'Noite', 120],
  ['course_redes_computadores', 'RC', 'Redes de Computadores', 'Tecnologia', 'Noite', 120],
  ['course_banco_dados', 'BD', 'Banco de Dados', 'Tecnologia', 'Noite', 120],
  ['course_sistemas_internet', 'SIWEB', 'Sistemas para Internet', 'Tecnologia', 'Noite', 120],
  ['course_analise_dados', 'DADOS', 'Análise de Dados', 'Tecnologia', 'Noite', 120],
  ['course_desenvolvimento_sistemas', 'DS', 'Desenvolvimento de Sistemas', 'Tecnologia', 'Noite', 120],
  ['course_comercio', 'COM', 'Comércio', 'Gestão', 'Noite', 90],
  ['course_contabilidade', 'CONT', 'Contabilidade', 'Gestão', 'Noite', 100],
  ['course_informatica', 'INFO', 'Informática', 'Tecnologia', 'Noite', 100],
  ['course_turismo', 'TUR', 'Turismo', 'Hospitalidade', 'Noite', 90],
  ['course_producao_multimidia', 'PM', 'Produção Multimídia', 'Comunicação', 'Noite', 100]
];

const OPPORTUNITY_CATEGORIES_WITH_20H_LIMIT = new Set(['estagio', 'representante de sala']);

function normalizePlain(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function isTechnicalStudentLabel(value) {
  const text = String(value || '').trim();
  const plain = normalizePlain(text);
  if (!text) return true;
  if (/^\d+$/.test(text)) return true;
  if (/^user[_-]/i.test(text)) return true;
  if (/^user[a-z0-9_-]{6,}$/i.test(text)) return true;
  if (/^aluno\s+\d+$/i.test(plain)) return true;
  if (/^(course|mlrisk|mlrun|sub|cert|activity)[_-]/i.test(text)) return true;
  return false;
}

function pickHumanStudentName(...values) {
  return values.map((value) => String(value || '').trim()).find((value) => value && !isTechnicalStudentLabel(value)) || '';
}

async function ensureSenacCourseCatalog() {
  if (String(process.env.SIGAC_AUTO_COURSE_CATALOG || '').toLowerCase() === 'false') return;
  if (await getSetting('presentationBase', '') === 'senac-demo') return;

  const insert = db.prepare(`
    INSERT INTO courses (id, sigla, nome, area, tipo, turno, carga_horaria_total, horas_meta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (sigla) DO NOTHING
  `);
  for (const course of SENAC_COURSE_CATALOG) {
    const [id, sigla, nome, area, turno, horasMeta] = course;
    await insert.run(id, sigla, nome, area, 'Graduação', turno, 0, horasMeta);
  }
}

async function generateMatricula(tipo, courseId = '') {
  const year = new Date().getFullYear();
  let prefix = 'SIGAC';
  if (tipo === 'aluno' && courseId) {
    const course = await getCourseById(courseId);
    prefix = normalizeMatriculaPrefix(course?.sigla || 'ALU', 'ALU');
  } else if (tipo === 'coordenador') {
    prefix = 'COORD';
  } else if (tipo === 'superadmin') {
    prefix = 'ADM';
  }

  const base = `${prefix}${year}`;
  const row = await db.prepare('SELECT COUNT(*) AS total FROM users WHERE matricula LIKE ?').get(`${base}%`);
  let next = Number(row?.total || 0) + 1;
  while (next < 10000) {
    const matricula = `${base}${String(next).padStart(4, '0')}`;
    const exists = await db.prepare('SELECT 1 FROM users WHERE matricula = ?').get(matricula);
    if (!exists) return matricula;
    next += 1;
  }
  return `SIGAC-${year}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

async function seedIfEmpty() {
  const countRow = await db.prepare('SELECT COUNT(*) AS total FROM users').get();
  if (Number(countRow?.total || 0) > 0) return;
  if (!SHOULD_SEED_DEMO_USERS) {
    console.warn('[SIGAC] Banco vazio e seed demo desativado. Crie o primeiro usuário administrativo manualmente.');
    return;
  }

  const ads = 'course_ads';
  const log = 'course_log';
  const rh = 'course_rh';

  const adminId = 'user_admin';
  const coordAds = 'user_coord_ads';
  const coordLog = 'user_coord_log';
  const alunoAds = 'user_aluno_ads';
  const alunoAds2 = 'user_aluno_ads_2';
  const alunoLog = 'user_aluno_log';

  await transaction(async (tx) => {
    await tx.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('horasMetaPadrao', '120');
    await tx.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('emailNotificationsEnabled', 'true');
    await tx.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('ocrDisponivel', 'false');
    await tx.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('updatedAt', nowIso());

    const insertCourse = tx.prepare('INSERT INTO courses (id, sigla, nome, area, tipo, turno, carga_horaria_total, horas_meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    await insertCourse.run(ads, 'ADS', 'Análise e Desenvolvimento de Sistemas', 'Tecnologia', 'Graduação', 'Noite', 0, 120);
    await insertCourse.run(log, 'LOG', 'Logística', 'Gestão', 'Graduação', 'Tarde', 0, 100);
    await insertCourse.run(rh, 'RH', 'Recursos Humanos', 'Gestão', 'Graduação', 'Noite', 0, 90);

    const insertUser = tx.prepare('INSERT INTO users (id, nome, email, senha_hash, tipo, ativo, course_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    await insertUser.run(adminId, 'Einstein', 'einstein@sigac.com', hashPassword('123456789'), 'superadmin', 1, null, nowIso());
    await insertUser.run(coordAds, 'Marina Costa', 'coord.ads@sigac.com', hashPassword('123456'), 'coordenador', 1, null, nowIso());
    await insertUser.run(coordLog, 'Paulo Nobre', 'coord.log@sigac.com', hashPassword('123456'), 'coordenador', 1, null, nowIso());
    await insertUser.run(alunoAds, 'Ana Clara', 'aluno.ads@sigac.com', hashPassword('123456'), 'aluno', 1, ads, nowIso());
    await insertUser.run(alunoAds2, 'João Pedro', 'aluno.ads2@sigac.com', hashPassword('123456'), 'aluno', 1, ads, nowIso());
    await insertUser.run(alunoLog, 'Lívia Souza', 'aluno.log@sigac.com', hashPassword('123456'), 'aluno', 1, log, nowIso());

    const insertCoordCourse = tx.prepare('INSERT INTO coordinator_courses (user_id, course_id) VALUES (?, ?)');
    await insertCoordCourse.run(coordAds, ads);
    await insertCoordCourse.run(coordLog, log);

    const insertStudentCourse = tx.prepare('INSERT INTO student_courses (user_id, course_id) VALUES (?, ?)');
    await insertStudentCourse.run(alunoAds, ads);
    await insertStudentCourse.run(alunoAds2, ads);
    await insertStudentCourse.run(alunoLog, log);

    const insertRule = tx.prepare(`INSERT INTO activity_rules
      (id, course_id, categoria, limite_maximo, carga_minima, exige_certificado, exige_aprovacao, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    await insertRule.run('rule_ads_eventos', ads, 'Eventos', 30, 4, 1, 1, adminId, nowIso());
    await insertRule.run('rule_ads_cursos', ads, 'Cursos livres', 40, 8, 1, 1, adminId, nowIso());
    await insertRule.run('rule_log_visitas', log, 'Visitas técnicas', 25, 4, 1, 1, adminId, nowIso());

    const insertOpp = tx.prepare('INSERT INTO opportunities (id, titulo, descricao, course_id, horas, criado_por, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)');
    await insertOpp.run('opp_1', 'Minicurso de Git e GitHub', 'Oficina prática com certificado institucional.', ads, 8, adminId, nowIso());
    await insertOpp.run('opp_2', 'Feira de Empregabilidade SENAC', 'Participação com horas complementares para alunos.', log, 6, adminId, nowIso());
    await tx.prepare('INSERT INTO opportunity_registrations (opportunity_id, user_id) VALUES (?, ?)').run('opp_1', alunoAds);
    await tx.prepare('INSERT INTO opportunity_registrations (opportunity_id, user_id) VALUES (?, ?)').run('opp_2', alunoLog);

    const insertActivity = tx.prepare('INSERT INTO activities (id, titulo, descricao, course_id, horas, prazo, material_nome, material_arquivo, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    await insertActivity.run('activity_ads_1', 'Seminário sobre Arquitetura de Software', 'Preparar um resumo crítico e enviar o comprovante de participação.', ads, 12, '', 'roteiro-seminario.txt', textDataUrl('Roteiro do seminário de Arquitetura de Software.\n\n1. Leia o material base.\n2. Participe do encontro.\n3. Envie o comprovante.'), coordAds, nowIso());
    await insertActivity.run('activity_log_1', 'Relatório de Visita Técnica', 'Enviar relatório da visita técnica com no mínimo duas páginas.', log, 10, '', 'modelo-relatorio.txt', textDataUrl('Modelo de relatório da visita técnica de Logística.'), coordLog, nowIso());

    await tx.prepare('INSERT INTO submissions (id, activity_id, student_id, current_status) VALUES (?, ?, ?, ?)').run('sub_1', 'activity_ads_1', alunoAds2, 'em_analise');
    await tx.prepare(`INSERT INTO submission_versions (submission_id, version, arquivo_nome, arquivo_data, observacao, status, feedback, enviada_em, avaliada_em)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('sub_1', 1, 'comprovante-joao.txt', textDataUrl('Comprovante de participação do João Pedro.'), 'Segue meu comprovante.', 'em_analise', '', nowIso(), '');
  });

  await addNotification(alunoAds, 'Você já está inscrita no minicurso de Git e GitHub.', 'info');
  await addNotification(coordAds, 'Há um envio pendente para análise em ADS.', 'warning');
  await logAudit(adminId, 'seed_demo', 'sistema', 'demo', 'Base de demonstração inicial criada');
}

async function ensureDemoAccessAccounts() {
  if (!SHOULD_SEED_DEMO_USERS) return;
  await db.prepare(`UPDATE users
                   SET ativo = 1
                   WHERE email IN (?, ?, ?, ?, ?)`)
    .run(
      'einstein@sigac.com',
      'coord.ads@sigac.com',
      'coord.log@sigac.com',
      'aluno.ads@sigac.com',
      'aluno.ads2@sigac.com'
    );
}

async function ensureMatriculas() {
  await db.exec(`
    UPDATE users
    SET matricula = 'SIGAC-' || EXTRACT(YEAR FROM NOW())::INT || '-' || UPPER(SUBSTRING(MD5(id), 1, 8))
    WHERE matricula IS NULL OR matricula = '';

    UPDATE student_courses sc
    SET matricula = u.matricula
    FROM users u
    WHERE u.id = sc.user_id
      AND (sc.matricula IS NULL OR sc.matricula = '');
  `);
}

async function getSetting(key, fallback = '') {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

async function setSetting(key, value) {
  await db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
                    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value`).run(key, String(value));
}

async function addNotification(userId, mensagem, tipo = 'info') {
  await db.prepare('INSERT INTO notifications (id, user_id, mensagem, tipo, created_at, read) VALUES (?, ?, ?, ?, ?, 0)')
    .run(uid('ntf'), userId, mensagem, tipo, nowIso());
}

async function logAudit(actorId, action, entityType, entityId = '', details = '') {
  await db.prepare('INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uid('audit'), actorId || null, action, entityType, entityId || '', String(details || ''), nowIso());
}

async function queueEmail(to, subject, body, kind = 'geral') {
  if (await getSetting('emailNotificationsEnabled', 'true') !== 'true') return null;
  const email = {
    id: uid('mail'),
    to,
    subject,
    body,
    kind,
    status: getSmtpConfig().enabled ? 'pendente SMTP' : 'simulado (fila local)',
    createdAt: nowIso()
  };
  await db.prepare('INSERT INTO emails (id, to_email, subject, body, kind, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(email.id, email.to, email.subject, email.body, email.kind, email.status, email.createdAt);

  setImmediate(async () => {
    let finalStatus = email.status;
    try {
      const smtpResult = await trySendSmtpEmail(email);
      if (smtpResult.status !== finalStatus) {
        finalStatus = smtpResult.status;
        await db.prepare('UPDATE emails SET status = ? WHERE id = ?').run(finalStatus, email.id);
      }
      await logAudit(null, 'email_enfileirado', 'email', email.id, `${subject} para ${to} | ${finalStatus}`);
    } catch (error) {
      console.warn('[SIGAC EMAIL] Falha no processamento assíncrono de e-mail.', error.message);
    }
  });
  return email;
}

function getSmtpConfig() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 0);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const from = String(process.env.SMTP_FROM || '').trim();
  const enabled = EMAIL_MODE === 'smtp' && host && port && from;
  return {
    enabled,
    host,
    port,
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: user && pass ? { user, pass } : undefined,
    from
  };
}

async function trySendSmtpEmail(email) {
  const config = getSmtpConfig();
  if (!config.enabled) return { status: 'simulado (fila local)' };

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth
    });

    await transporter.sendMail({
      from: config.from,
      to: email.to,
      subject: email.subject,
      text: email.body
    });
    return { status: 'enviado via SMTP' };
  } catch (error) {
    console.warn('[SIGAC EMAIL] Falha SMTP; e-mail mantido na fila local.', error.message);
    return { status: `erro SMTP: ${String(error.message || 'falha no envio').slice(0, 120)}` };
  }
}

async function notifySuperAdmins(message, type = 'info', subject = '', body = '', exceptUserId = '') {
  const admins = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE tipo = 'superadmin' AND ativo = 1 ORDER BY nome`).all();
  for (const admin of admins) {
    if (exceptUserId && admin.id === exceptUserId) continue;
    await addNotification(admin.id, message, type);
    if (subject && admin.email) await queueEmail(admin.email, subject, body || message, 'admin-alerta');
  }
}

async function getCoordinatorCourseIds(userId) {
  const rows = await db.prepare('SELECT course_id FROM coordinator_courses WHERE user_id = ? ORDER BY course_id').all(userId);
  return rows.map((row) => row.course_id);
}

async function getStudentCourseIds(userId) {
  const rows = await db.prepare('SELECT course_id FROM student_courses WHERE user_id = ? AND ativo = 1 ORDER BY course_id').all(userId);
  return rows.map((row) => row.course_id);
}

async function getStudentCourseLinks(userId) {
  const rows = await db.prepare(`
    SELECT
      sc.user_id,
      sc.course_id,
      COALESCE(NULLIF(sc.matricula, ''), NULLIF(u.matricula, ''), '') AS matricula,
      sc.ativo,
      c.sigla,
      c.nome,
      c.area,
      c.tipo,
      c.turno,
      c.carga_horaria_total,
      c.horas_meta
    FROM student_courses sc
    JOIN users u ON u.id = sc.user_id
    LEFT JOIN courses c ON c.id = sc.course_id
    WHERE sc.user_id = ?
      AND sc.ativo = 1
    ORDER BY c.sigla, sc.course_id
  `).all(userId);
  return rows.map((row) => ({
    id: `${row.user_id}:${row.course_id}`,
    userId: row.user_id,
    courseId: row.course_id,
    courseName: row.nome || '',
    courseSigla: row.sigla || '',
    matricula: row.matricula || '',
    ativo: row.ativo !== 0,
    course: {
      id: row.course_id,
      sigla: row.sigla || '',
      nome: row.nome || '',
      area: row.area || '',
      tipo: row.tipo || 'Graduação',
      turno: row.turno || '',
      cargaHorariaTotal: Number(row.carga_horaria_total || 0),
      horasMeta: Number(row.horas_meta || 0)
    }
  }));
}

function pickActiveStudentLink(row, links) {
  if (!Array.isArray(links) || !links.length) return null;
  const activeCourseId = row.course_id || links[0].courseId;
  return links.find((link) => link.courseId === activeCourseId) || links[0];
}

async function listActivityRules() {
  const rows = await db.prepare('SELECT id, course_id, categoria, limite_maximo, carga_minima, exige_certificado, exige_aprovacao, created_by, created_at FROM activity_rules ORDER BY course_id, categoria').all();
  return rows.map((row) => ({
    id: row.id,
    courseId: row.course_id,
    categoria: row.categoria,
    limiteMaximo: Number(row.limite_maximo || 0),
    cargaMinima: Number(row.carga_minima || 0),
    exigeCertificado: !!row.exige_certificado,
    exigeAprovacao: !!row.exige_aprovacao,
    createdBy: row.created_by || '',
    createdAt: row.created_at
  }));
}

async function listActivityRulesForCourses(courseIds) {
  const allowed = new Set(courseIds || []);
  return (await listActivityRules()).filter((rule) => allowed.has(rule.courseId));
}

async function listAuditLogs(limit = 50) {
  const rows = await db.prepare(`SELECT audit_logs.id, audit_logs.actor_id, audit_logs.action, audit_logs.entity_type, audit_logs.entity_id, audit_logs.details, audit_logs.created_at, users.nome AS actor_name
                                FROM audit_logs
                                LEFT JOIN users ON users.id = audit_logs.actor_id
                                ORDER BY audit_logs.created_at DESC
                                LIMIT ?`).all(limit);
  return rows.map((row) => ({
    id: row.id,
    actorId: row.actor_id || '',
    actorName: row.actor_name || 'Sistema',
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id || '',
    details: row.details || '',
    createdAt: row.created_at
  }));
}

async function serializeUser(row, courseIdsByUser = null) {
  const mappedCourseIds = courseIdsByUser?.get(row.id);
  const studentLinks = row.tipo === 'aluno' ? await getStudentCourseLinks(row.id) : [];
  const studentCourseIds = row.tipo === 'aluno'
    ? (studentLinks.length ? studentLinks.map((link) => link.courseId) : (mappedCourseIds || await getStudentCourseIds(row.id)))
    : [];
  const activeLink = row.tipo === 'aluno' ? pickActiveStudentLink(row, studentLinks) : null;
  const activeCourseId = activeLink?.courseId || row.course_id || '';
  const activeMatricula = activeLink?.matricula || row.matricula || '';
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    tipo: row.tipo,
    ativo: !!row.ativo,
    matricula: activeMatricula,
    matriculaAtiva: activeMatricula,
    vinculoAtivoId: activeLink?.id || (activeCourseId ? `${row.id}:${activeCourseId}` : ''),
    activeCourse: activeLink?.course || null,
    activeLink,
    courseLinks: studentLinks,
    telefone: row.telefone || '',
    cpf: row.cpf || '',
    endereco: row.endereco || '',
    dataNascimento: row.data_nascimento || '',
    cursoInteresse: row.curso_interesse || '',
    mustChangePassword: !!Number(row.must_change_password || 0),
    passwordUpdatedAt: row.password_updated_at || '',
    courseId: activeCourseId,
    cursoAtivoId: activeCourseId,
    cursoAtivoNome: activeLink?.courseName || '',
    courseIds: row.tipo === 'coordenador'
      ? (mappedCourseIds || await getCoordinatorCourseIds(row.id))
      : studentCourseIds,
    createdAt: row.created_at
  };
}

async function getUserById(userId) {
  const row = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(userId);
  return row ? serializeUser(row) : null;
}

async function getCourseById(courseId) {
  const row = await db.prepare(`SELECT ${COURSE_COLUMNS} FROM courses WHERE id = ?`).get(courseId);
  if (!row) return null;
  return {
    id: row.id,
    sigla: row.sigla,
    nome: row.nome,
    area: row.area,
    tipo: row.tipo || 'Graduação',
    turno: row.turno,
    cargaHorariaTotal: Number(row.carga_horaria_total || 0),
    horasMeta: Number(row.horas_meta || 0),
    ativo: row.ativo === 0 ? false : true
  };
}

async function listCourses() {
  const rows = await db.prepare(`SELECT ${COURSE_COLUMNS} FROM courses ORDER BY sigla`).all();
  return rows.map((row) => ({
    id: row.id,
    sigla: row.sigla,
    nome: row.nome,
    area: row.area,
    tipo: row.tipo || 'Graduação',
    turno: row.turno,
    cargaHorariaTotal: Number(row.carga_horaria_total || 0),
    horasMeta: Number(row.horas_meta || 0),
    ativo: row.ativo === 0 ? false : true
  }));
}

async function listUsers(pagination = null) {
  await ensureMatriculas();
  const countRow = pagination
    ? await db.prepare('SELECT COUNT(*) AS total FROM users').get()
    : null;
  const baseSql = `SELECT ${USER_COLUMNS} FROM users ORDER BY nome`;
  const queryParams = pagination ? [pagination.limit, pagination.offset] : [];
  const rows = await db.prepare(withPagination(baseSql, pagination)).all(...queryParams);
  const userIds = rows.map((row) => row.id);
  const courseIdsByUser = new Map();
  const addCourseId = (userId, courseId) => {
    if (!courseIdsByUser.has(userId)) courseIdsByUser.set(userId, []);
    courseIdsByUser.get(userId).push(courseId);
  };

  const coordinatorRows = userIds.length
    ? await db.prepare('SELECT user_id, course_id FROM coordinator_courses WHERE user_id = ANY(?::text[]) ORDER BY user_id, course_id').all(userIds)
    : [];
  for (const row of coordinatorRows) addCourseId(row.user_id, row.course_id);

  const studentRows = userIds.length
    ? await db.prepare('SELECT user_id, course_id FROM student_courses WHERE user_id = ANY(?::text[]) ORDER BY user_id, course_id').all(userIds)
    : [];
  for (const row of studentRows) addCourseId(row.user_id, row.course_id);

  const result = [];
  for (const row of rows) result.push(await serializeUser(row, courseIdsByUser));
  return pagination
    ? { items: result, pagination: buildPagination(countRow?.total || 0, pagination) }
    : result;
}

function normalizeStudentProfilePayload(body) {
  return {
    telefone: String(body.telefone || body.phone || '').trim(),
    cpf: String(body.cpf || '').trim(),
    endereco: String(body.endereco || body.address || '').trim(),
    dataNascimento: String(body.dataNascimento || body.data_nascimento || body.birthDate || '').trim(),
    cursoInteresse: String(body.cursoInteresse || body.curso_interesse || body.desiredCourse || '').trim()
  };
}

async function serializeCoordinationMessage(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    coordinatorId: row.coordinator_id || '',
    courseId: row.course_id || '',
    senderId: row.sender_id,
    message: row.message,
    createdAt: row.created_at,
    readByStudent: !!Number(row.read_by_student || 0),
    readByCoord: !!Number(row.read_by_coord || 0),
    student: row.student_nome ? {
      id: row.student_id,
      nome: row.student_nome,
      email: row.student_email || '',
      matricula: row.student_matricula || ''
    } : null,
    sender: row.sender_nome ? {
      id: row.sender_id,
      nome: row.sender_nome,
      tipo: row.sender_tipo || ''
    } : null,
    course: row.course_sigla ? {
      id: row.course_id || '',
      sigla: row.course_sigla || '',
      nome: row.course_nome || ''
    } : null
  };
}

async function listStudentChatMessages(studentId) {
  const rows = await db.prepare(`
    SELECT m.id, m.student_id, m.coordinator_id, m.course_id, m.sender_id, m.message, m.created_at, m.read_by_student, m.read_by_coord,
           student.nome AS student_nome, student.email AS student_email, student.matricula AS student_matricula,
           sender.nome AS sender_nome, sender.tipo AS sender_tipo,
           c.sigla AS course_sigla, c.nome AS course_nome
    FROM coordination_messages m
    JOIN users student ON student.id = m.student_id
    JOIN users sender ON sender.id = m.sender_id
    LEFT JOIN courses c ON c.id = m.course_id
    WHERE m.student_id = ?
    ORDER BY m.created_at ASC
  `).all(studentId);
  return Promise.all(rows.map(serializeCoordinationMessage));
}

async function listCoordinatorChatMessages(coordinatorId) {
  const rows = await db.prepare(`
    SELECT m.id, m.student_id, m.coordinator_id, m.course_id, m.sender_id, m.message, m.created_at, m.read_by_student, m.read_by_coord,
           student.nome AS student_nome, student.email AS student_email, student.matricula AS student_matricula,
           sender.nome AS sender_nome, sender.tipo AS sender_tipo,
           c.sigla AS course_sigla, c.nome AS course_nome
    FROM coordination_messages m
    JOIN users student ON student.id = m.student_id
    JOIN users sender ON sender.id = m.sender_id
    LEFT JOIN courses c ON c.id = m.course_id
    JOIN coordinator_courses cc ON cc.course_id = m.course_id AND cc.user_id = ?
    ORDER BY m.created_at ASC
  `).all(coordinatorId);
  return Promise.all(rows.map(serializeCoordinationMessage));
}

async function listOpportunities() {
  const rows = await db.prepare(`
    SELECT
      o.id, o.titulo, o.descricao, o.course_id, o.horas, o.criado_por, o.criado_em, o.categoria, o.status,
      c.sigla AS course_sigla, c.nome AS course_nome,
      COALESCE(array_agg(orx.user_id ORDER BY orx.user_id) FILTER (WHERE orx.user_id IS NOT NULL), ARRAY[]::text[]) AS inscritos
    FROM opportunities o
    LEFT JOIN courses c ON c.id = o.course_id
    LEFT JOIN opportunity_registrations orx ON orx.opportunity_id = o.id
    GROUP BY o.id, c.sigla, c.nome
    ORDER BY o.criado_em DESC
  `).all();
  return rows.map((row) => ({
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    courseId: row.course_id || '',
    course: row.course_id ? {
      id: row.course_id,
      sigla: row.course_sigla || '',
      nome: row.course_nome || ''
    } : null,
    categoria: row.categoria || 'Curso livre',
    status: row.status || 'Aberta',
    horas: Number(row.horas || 0),
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
    inscritos: Array.isArray(row.inscritos) ? row.inscritos.filter(Boolean) : []
  }));
}

function serializeActivity(row, options = {}) {
  const includeMaterialData = options.includeMaterialData === true;
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    courseId: row.course_id,
    horas: Number(row.horas || 0),
    prazo: row.prazo || '',
    materialNome: row.material_nome || '',
    materialArquivo: includeMaterialData ? row.material_arquivo || '' : '',
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

async function getActivityById(id, options = {}) {
  const row = await db.prepare(`SELECT ${ACTIVITY_COLUMNS} FROM activities WHERE id = ?`).get(id);
  return row ? serializeActivity(row, options) : null;
}

async function listActivitiesForCourse(courseId, options = {}) {
  const rows = await db.prepare(`SELECT ${ACTIVITY_COLUMNS} FROM activities WHERE course_id = ? ORDER BY created_at DESC`).all(courseId);
  return rows.map((row) => serializeActivity(row, options));
}

async function listActivitiesForCoordinator(coordinatorId, options = {}) {
  const rows = await db.prepare(`
    SELECT DISTINCT a.id, a.titulo, a.descricao, a.course_id, a.horas, a.prazo, a.material_nome, a.material_arquivo, a.created_by, a.created_at
    FROM activities a
    JOIN coordinator_courses cc ON cc.course_id = a.course_id
    WHERE cc.user_id = ?
    ORDER BY a.created_at DESC
  `).all(coordinatorId);
  return rows.map((row) => serializeActivity(row, options));
}

async function getSubmissionVersions(submissionId, options = {}) {
  const includeFileData = options.includeFileData !== false;
  const rows = await db.prepare(`SELECT ${SUBMISSION_VERSION_COLUMNS} FROM submission_versions WHERE submission_id = ? ORDER BY version ASC`).all(submissionId);
  return rows.map((row) => ({
    id: Number(row.id),
    version: Number(row.version),
    arquivoNome: row.arquivo_nome,
    arquivoData: includeFileData ? row.arquivo_data : '',
    observacao: row.observacao || '',
    categoria: row.categoria || '',
    horasDeclaradas: Number(row.horas_declaradas || 0),
    descricao: row.descricao || '',
    status: row.status,
    feedback: row.feedback || '',
    enviadaEm: row.enviada_em,
    avaliadaEm: row.avaliada_em || ''
  }));
}

async function serializeSubmission(row, options = {}) {
  return {
    id: row.id,
    activityId: row.activity_id,
    studentId: row.student_id,
    currentStatus: row.current_status,
    activity: options.includeActivity ? await getActivityById(row.activity_id, { includeMaterialData: false }) : null,
    versions: await getSubmissionVersions(row.id, options)
  };
}

async function getSubmissionById(id) {
  const row = await db.prepare(`SELECT ${SUBMISSION_COLUMNS} FROM submissions WHERE id = ?`).get(id);
  return row ? serializeSubmission(row) : null;
}

async function getStudentSubmissionForActivity(studentId, activityId, options = {}) {
  const row = await db.prepare(`SELECT ${SUBMISSION_COLUMNS} FROM submissions WHERE student_id = ? AND activity_id = ?`).get(studentId, activityId);
  return row ? serializeSubmission(row, options) : null;
}

async function listSubmissionsForStudent(studentId, options = {}) {
  const courseId = String(options.courseId || '').trim();
  const rows = await db.prepare(`
    SELECT s.id, s.activity_id, s.student_id, s.current_status
    FROM submissions s
    JOIN activities a ON a.id = s.activity_id
    WHERE s.student_id = ?
      AND (? = '' OR a.course_id = ?)
    ORDER BY s.id DESC
  `).all(studentId, courseId, courseId);
  const result = [];
  for (const row of rows) result.push(await serializeSubmission(row, options));
  return result;
}

async function listActivitiesWithStudentSubmissions(studentId, courseId, options = {}) {
  const includeFileData = options.includeFileData !== false;
  const rows = await db.prepare(`
    SELECT
      a.id AS activity_id,
      a.titulo AS activity_titulo,
      a.descricao AS activity_descricao,
      a.course_id AS activity_course_id,
      a.horas AS activity_horas,
      a.prazo AS activity_prazo,
      a.material_nome AS activity_material_nome,
      a.material_arquivo AS activity_material_arquivo,
      a.created_by AS activity_created_by,
      a.created_at AS activity_created_at,
      s.id AS submission_id,
      s.current_status AS submission_current_status,
      v.id AS version_id,
      v.version,
      v.arquivo_nome,
      v.arquivo_data,
      v.observacao,
      v.categoria,
      v.horas_declaradas,
      v.descricao AS version_descricao,
      v.status,
      v.feedback,
      v.enviada_em,
      v.avaliada_em
    FROM activities a
    LEFT JOIN submissions s ON s.activity_id = a.id AND s.student_id = ?
    LEFT JOIN submission_versions v ON v.submission_id = s.id
    WHERE a.course_id = ?
    ORDER BY a.created_at DESC, v.version ASC
  `).all(studentId, courseId);

  const activitiesById = new Map();
  const orderedActivities = [];
  for (const row of rows) {
    let activity = activitiesById.get(row.activity_id);
    if (!activity) {
      activity = {
        id: row.activity_id,
        titulo: row.activity_titulo,
        descricao: row.activity_descricao,
        courseId: row.activity_course_id,
        horas: Number(row.activity_horas || 0),
        prazo: row.activity_prazo || '',
        materialNome: row.activity_material_nome || '',
        materialArquivo: '',
        createdBy: row.activity_created_by,
        createdAt: row.activity_created_at,
        submission: null
      };
      if (row.submission_id) {
        activity.submission = {
          id: row.submission_id,
          activityId: row.activity_id,
          studentId,
          currentStatus: row.submission_current_status,
          versions: []
        };
      }
      activitiesById.set(row.activity_id, activity);
      orderedActivities.push(activity);
    }

    if (row.submission_id && !activity.submission) {
      activity.submission = {
        id: row.submission_id,
        activityId: row.activity_id,
        studentId,
        currentStatus: row.submission_current_status,
        versions: []
      };
    }

    if (row.version_id && activity.submission) {
      activity.submission.versions.push({
        id: Number(row.version_id),
        version: Number(row.version),
        arquivoNome: row.arquivo_nome,
        arquivoData: includeFileData ? row.arquivo_data : '',
        observacao: row.observacao || '',
        categoria: row.categoria || '',
        horasDeclaradas: Number(row.horas_declaradas || 0),
        descricao: row.version_descricao || '',
        status: row.status,
        feedback: row.feedback || '',
        enviadaEm: row.enviada_em,
        avaliadaEm: row.avaliada_em || ''
      });
    }
  }
  return orderedActivities;
}

function getLatestVersion(submission) {
  return submission?.versions?.[submission.versions.length - 1] || null;
}

function parseJsonList(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

async function serializeCertificate(row, options = {}) {
  const includeFileData = options.includeFileData !== false;
  const includeExtractedText = options.includeExtractedText !== false;
  const sender = await getUserById(row.sender_id);
  const reviewedByUser = row.reviewed_by ? await getUserById(row.reviewed_by) : null;
  const hourBreakdown = options.includeHourBreakdown === false ? null : await calculateCertificateHourBreakdown(row);
  return {
    id: row.id,
    senderId: row.sender_id,
    senderType: row.sender_type,
    courseId: row.course_id || '',
    vinculoId: row.vinculo_id || (row.course_id ? `${row.sender_id}:${row.course_id}` : ''),
    matricula: row.matricula || '',
    category: row.category || '',
    fileName: row.file_name,
    fileData: includeFileData ? row.file_data : '',
    observation: row.observation || '',
    declaredHours: Number(row.declared_hours || 0),
    extractedText: includeExtractedText ? row.extracted_text || '' : '',
    detectedHours: Number(row.detected_hours || 0),
    detectedName: row.detected_name || '',
    detectedInstitution: row.detected_institution || '',
    detectedDate: row.detected_date || '',
    detectedTitle: row.detected_title || '',
    detectedCourseName: row.detected_course_name || '',
    foundFields: parseJsonList(row.found_fields),
    missingFields: parseJsonList(row.missing_fields),
    confidenceScore: Number(row.confidence_score || 0),
    humanSummary: row.human_summary || '',
    ocrStatus: row.ocr_status || 'nao_processado',
    ocrReason: row.ocr_reason || 'Aguardando an\u00e1lise do administrador.',
    adminStatus: row.admin_status || 'pendente',
    adminFeedback: row.admin_feedback || '',
    approvedHours: Number(row.approved_hours || 0),
    hourBreakdown,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at || '',
    reviewedBy: row.reviewed_by || '',
    ocrProcessedAt: row.ocr_processed_at || '',
    sender,
    reviewedByUser
  };
}

async function getCertificateById(certificateId) {
  const row = await db.prepare(`SELECT ${CERTIFICATE_COLUMNS} FROM certificates WHERE id = ?`).get(certificateId);
  return row ? serializeCertificate(row) : null;
}

function serializeCertificateListRow(row) {
  const sender = row.sender_user_id ? {
    id: row.sender_user_id,
    nome: row.sender_nome || '',
    email: row.sender_email || '',
    tipo: row.sender_tipo || row.sender_type || '',
    ativo: row.sender_ativo !== 0,
    courseId: row.course_id || row.sender_course_id || '',
    matricula: row.matricula || '',
    vinculoId: row.vinculo_id || (row.course_id ? `${row.sender_user_id}:${row.course_id}` : ''),
    courseIds: [],
    createdAt: row.sender_created_at || ''
  } : null;

  const reviewedByUser = row.reviewer_user_id ? {
    id: row.reviewer_user_id,
    nome: row.reviewer_nome || '',
    email: row.reviewer_email || '',
    tipo: row.reviewer_tipo || '',
    ativo: row.reviewer_ativo !== 0,
    courseId: row.reviewer_course_id || '',
    courseIds: [],
    createdAt: row.reviewer_created_at || ''
  } : null;

  return {
    id: row.id,
    senderId: row.sender_id,
    senderType: row.sender_type,
    courseId: row.course_id || '',
    vinculoId: row.vinculo_id || (row.course_id ? `${row.sender_id}:${row.course_id}` : ''),
    matricula: row.matricula || '',
    category: row.category || '',
    fileName: row.file_name,
    fileData: '',
    observation: row.observation || '',
    declaredHours: Number(row.declared_hours || 0),
    extractedText: '',
    detectedHours: Number(row.detected_hours || 0),
    detectedName: row.detected_name || '',
    detectedInstitution: row.detected_institution || '',
    detectedDate: row.detected_date || '',
    detectedTitle: row.detected_title || '',
    detectedCourseName: row.detected_course_name || '',
    foundFields: parseJsonList(row.found_fields),
    missingFields: parseJsonList(row.missing_fields),
    confidenceScore: Number(row.confidence_score || 0),
    humanSummary: row.human_summary || '',
    ocrStatus: row.ocr_status || 'nao_processado',
    ocrReason: row.ocr_reason || 'Aguardando análise do administrador.',
    adminStatus: row.admin_status || 'pendente',
    adminFeedback: row.admin_feedback || '',
    approvedHours: Number(row.approved_hours || 0),
    hourBreakdown: {
      declaredHours: Number(row.declared_hours || 0),
      detectedHours: Number(row.detected_hours || 0),
      approvedHours: Number(row.approved_hours || 0),
      excessHours: Math.max(0, Math.max(Number(row.detected_hours || 0), Number(row.declared_hours || 0)) - Number(row.approved_hours || 0)),
      category: row.category || row.detected_title || row.detected_course_name || 'Certificados'
    },
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at || '',
    reviewedBy: row.reviewed_by || '',
    ocrProcessedAt: row.ocr_processed_at || '',
    sender,
    reviewedByUser
  };
}

async function listCertificatesForDashboard(whereSql = '', params = [], pagination = null) {
  const countRow = pagination
    ? await db.prepare(`SELECT COUNT(*) AS total FROM certificates cert ${whereSql}`).get(...params)
    : null;
  const baseSql = `
    SELECT
      cert.id,
      cert.sender_id,
      cert.sender_type,
      cert.course_id,
      cert.vinculo_id,
      cert.matricula,
      cert.category,
      cert.file_name,
      cert.observation,
      cert.declared_hours,
      cert.detected_hours,
      cert.detected_name,
      cert.detected_institution,
      cert.detected_date,
      cert.detected_title,
      cert.detected_course_name,
      cert.found_fields,
      cert.missing_fields,
      cert.confidence_score,
      cert.human_summary,
      cert.ocr_status,
      cert.ocr_reason,
      cert.admin_status,
      cert.admin_feedback,
      cert.approved_hours,
      cert.created_at,
      cert.reviewed_at,
      cert.reviewed_by,
      cert.ocr_processed_at,
      sender.id AS sender_user_id,
      sender.nome AS sender_nome,
      sender.email AS sender_email,
      sender.tipo AS sender_tipo,
      sender.ativo AS sender_ativo,
      sender.course_id AS sender_course_id,
      sender.created_at AS sender_created_at,
      reviewer.id AS reviewer_user_id,
      reviewer.nome AS reviewer_nome,
      reviewer.email AS reviewer_email,
      reviewer.tipo AS reviewer_tipo,
      reviewer.ativo AS reviewer_ativo,
      reviewer.course_id AS reviewer_course_id,
      reviewer.created_at AS reviewer_created_at
    FROM certificates cert
    LEFT JOIN users sender ON sender.id = cert.sender_id
    LEFT JOIN users reviewer ON reviewer.id = cert.reviewed_by
    ${whereSql}
    ORDER BY cert.created_at DESC
  `;
  const queryParams = pagination ? [...params, pagination.limit, pagination.offset] : params;
  const rows = await db.prepare(withPagination(baseSql, pagination)).all(...queryParams);
  const items = rows.map(serializeCertificateListRow);
  return pagination
    ? { items, pagination: buildPagination(countRow?.total || 0, pagination) }
    : items;
}

async function listCertificatesForUser(userId, courseId = '') {
  return listCertificatesForDashboard(
    `WHERE cert.sender_id = ?
       AND (? = '' OR cert.course_id = ?)`,
    [userId, courseId, courseId]
  );
}

async function listCertificatesForAdmin(pagination = null) {
  return listCertificatesForDashboard('', [], pagination);
}

async function listCertificatesForCoordinator(coordinatorId) {
  const label = startPerf(`perf:listCertificatesForCoordinator:${coordinatorId}`);
  try {
    return await listCertificatesForDashboard(`
      WHERE cert.sender_type = 'aluno'
        AND EXISTS (
          SELECT 1
          FROM student_courses sc
          JOIN coordinator_courses cc ON cc.course_id = sc.course_id
          WHERE sc.user_id = cert.sender_id
            AND cc.user_id = ?
            AND (cert.course_id = cc.course_id OR cert.course_id IS NULL OR cert.course_id = '')
        )
    `, [coordinatorId]);
  } finally {
    endPerf(label);
  }
}

async function coordinatorCanAccessCertificate(coordinatorId, certificate) {
  if (!certificate || certificate.senderType !== 'aluno' || !certificate.senderId) return false;
  const row = await db.prepare(`
    SELECT 1
    FROM student_courses sc
    JOIN coordinator_courses cc ON cc.course_id = sc.course_id
    WHERE sc.user_id = ?
      AND cc.user_id = ?
      AND (? = '' OR ? = cc.course_id)
    LIMIT 1
  `).get(certificate.senderId, coordinatorId, certificate.courseId || '', certificate.courseId || '');
  return !!row;
}

async function getApprovedCertificateHours(studentId, courseId = '') {
  const row = await db.prepare(`SELECT COALESCE(SUM(approved_hours), 0) AS total
                                FROM certificates
                                WHERE sender_id = ? AND sender_type = 'aluno'
                                  AND (? = '' OR course_id = ?)
                                  AND admin_status = 'aprovado'`).get(studentId, courseId, courseId);
  return Number(row?.total || 0);
}

async function getStudentProgress(studentId, activeCourseId = '') {
  const label = startPerf(`perf:getStudentProgress:${studentId}`);
  try {
    const defaultTarget = Number(await getSetting('horasMetaPadrao', '0') || 0);
    const row = await db.prepare(`
      SELECT
        u.id,
        COALESCE(c.horas_meta, ?) AS target,
        COALESCE(sub.approved_hours, 0) AS approved_hours,
        COALESCE(opp.opportunity_hours, 0) AS opportunity_hours,
        COALESCE(cert.certificate_hours, 0) AS certificate_hours
      FROM users u
      LEFT JOIN courses c ON c.id = COALESCE(NULLIF(?, ''), u.course_id)
      LEFT JOIN (
        SELECT s.student_id, SUM(a.horas) AS approved_hours
        FROM submissions s
        JOIN activities a ON a.id = s.activity_id
        WHERE s.current_status = 'aprovado'
          AND (? = '' OR a.course_id = ?)
        GROUP BY s.student_id
      ) sub ON sub.student_id = u.id
      LEFT JOIN (
        SELECT orx.user_id, SUM(o.horas) AS opportunity_hours
        FROM opportunity_registrations orx
        JOIN opportunities o ON o.id = orx.opportunity_id
        WHERE (? = '' OR o.course_id = ?)
        GROUP BY orx.user_id
      ) opp ON opp.user_id = u.id
      LEFT JOIN (
        SELECT sender_id, SUM(approved_hours) AS certificate_hours
        FROM certificates
        WHERE sender_type = 'aluno'
          AND (? = '' OR course_id = ?)
          AND admin_status = 'aprovado'
        GROUP BY sender_id
      ) cert ON cert.sender_id = u.id
      WHERE u.id = ?
      LIMIT 1
    `).get(defaultTarget, activeCourseId, activeCourseId, activeCourseId, activeCourseId, activeCourseId, activeCourseId, activeCourseId, studentId);

    if (!row) return { total: 0, target: 0, percent: 0, approvedHours: 0, opportunityHours: 0, certificateHours: 0 };
    const approvedHours = Number(row.approved_hours || 0);
    const opportunityHours = Number(row.opportunity_hours || 0);
    const certificateHours = Number(row.certificate_hours || 0);
    const target = Number(row.target || defaultTarget || 0);
    const identifiedHours = approvedHours + opportunityHours + certificateHours;
    const total = target > 0 ? Math.min(identifiedHours, target) : identifiedHours;
    const percent = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
    return { total, target, percent, identifiedHours, approvedHours, opportunityHours, certificateHours };
  } finally {
    endPerf(label);
  }
}

async function getStudentCategoryProgress(studentId, activeCourseId = '') {
  if (!activeCourseId) return [];
  const rules = await listActivityRulesForCourses([activeCourseId]);
  const byCategory = new Map();

  const ensureCategory = (categoria, rule = null) => {
    const name = String(categoria || 'Outras atividades').trim() || 'Outras atividades';
    if (!byCategory.has(name)) {
      byCategory.set(name, {
        id: rule?.id || `category-${normalizePlain(name).replace(/[^a-z0-9]+/g, '-')}`,
        courseId: activeCourseId,
        categoria: name,
        limiteMaximo: Number(rule?.limiteMaximo || 0),
        cargaMinima: Number(rule?.cargaMinima || 0),
        approvedHours: 0,
        pendingHours: 0,
        rejectedHours: 0,
        percent: 0,
        completed: false
      });
    } else if (rule) {
      const current = byCategory.get(name);
      current.limiteMaximo = Number(rule.limiteMaximo || current.limiteMaximo || 0);
      current.cargaMinima = Number(rule.cargaMinima || current.cargaMinima || 0);
    }
    return byCategory.get(name);
  };

  for (const rule of rules) ensureCategory(rule.categoria, rule);

  const submissions = await listSubmissionsForStudent(studentId, { includeFileData: false, includeActivity: true, courseId: activeCourseId });
  for (const submission of submissions) {
    const latest = getLatestVersion(submission);
    if (!latest) continue;
    const category = ensureCategory(latest.categoria || 'Atividades');
    const hours = Math.max(0, Number(latest.horasDeclaradas || submission.activity?.horas || 0));
    const status = latest.status || submission.currentStatus;
    if (status === 'aprovado') category.approvedHours += hours;
    else if (status === 'rejeitado') category.rejectedHours += hours;
    else category.pendingHours += hours;
  }

  const certificates = await listCertificatesForUser(studentId, activeCourseId);
  for (const certificate of certificates) {
    const category = ensureCategory(certificate.category || 'Certificados');
    const status = certificate.adminStatus || '';
    const hours = Math.max(0, Number(status === 'aprovado' ? certificate.approvedHours : certificate.declaredHours || certificate.detectedHours || 0));
    if (status === 'aprovado') category.approvedHours += hours;
    else if (status === 'rejeitado' || status === 'removido' || status === 'removido_da_contagem') category.rejectedHours += hours;
    else category.pendingHours += hours;
  }

  return Array.from(byCategory.values()).map((item) => {
    const limit = Number(item.limiteMaximo || 0);
    const cappedApproved = limit > 0 ? Math.min(item.approvedHours, limit) : item.approvedHours;
    const percent = limit > 0 ? Math.min(100, Math.round((cappedApproved / limit) * 100)) : 0;
    return {
      ...item,
      approvedHours: cappedApproved,
      percent,
      completed: limit > 0 && cappedApproved >= limit
    };
  }).sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR'));
}

function getCertificateNumber(certificate, camelKey, snakeKey = '') {
  return Math.max(0, Number(certificate?.[camelKey] ?? certificate?.[snakeKey] ?? 0) || 0);
}

function getCertificateText(certificate, camelKey, snakeKey = '') {
  return String(certificate?.[camelKey] ?? certificate?.[snakeKey] ?? '').trim();
}

function getCertificateCategoryName(certificate) {
  return getCertificateText(certificate, 'category', 'category')
    || getCertificateText(certificate, 'detectedTitle', 'detected_title')
    || getCertificateText(certificate, 'detectedCourseName', 'detected_course_name')
    || 'Certificados';
}

async function getCertificateCategoryLimit(courseId, categoryName) {
  if (!courseId) return 0;
  const normalizedCategory = normalizePlain(categoryName);
  const rules = await listActivityRulesForCourses([courseId]);
  const exact = rules.find((rule) => normalizePlain(rule.categoria) === normalizedCategory);
  const fallback = rules.find((rule) => normalizePlain(rule.categoria) === 'certificados');
  return Math.max(0, Number((exact || fallback)?.limiteMaximo || 0));
}

async function calculateCertificateHourBreakdown(certificate) {
  const senderId = getCertificateText(certificate, 'senderId', 'sender_id');
  const courseId = getCertificateText(certificate, 'courseId', 'course_id');
  const category = getCertificateCategoryName(certificate);
  const declaredHours = getCertificateNumber(certificate, 'declaredHours', 'declared_hours');
  const detectedHours = getCertificateNumber(certificate, 'detectedHours', 'detected_hours');
  const existingApprovedHours = getCertificateNumber(certificate, 'approvedHours', 'approved_hours');
  const adminStatus = getCertificateText(certificate, 'adminStatus', 'admin_status');
  const categoryLimit = await getCertificateCategoryLimit(courseId, category);
  const progress = senderId ? await getStudentProgress(senderId, courseId) : null;
  const target = Number(progress?.target || 0);
  const alreadyCounted = adminStatus === 'aprovado' ? existingApprovedHours : 0;
  const countedWithoutThis = Math.max(0, Number(progress?.identifiedHours ?? progress?.total ?? 0) - alreadyCounted);
  const remainingToSemester = target > 0 ? Math.max(0, target - countedWithoutThis) : 0;
  const detectedOrDeclared = detectedHours > 0 && declaredHours > 0
    ? Math.min(detectedHours, declaredHours)
    : Math.max(detectedHours, declaredHours, existingApprovedHours);
  const caps = [detectedOrDeclared];
  if (categoryLimit > 0) caps.push(categoryLimit);
  if (target > 0) caps.push(remainingToSemester);
  const approvedHours = Math.max(0, Math.min(...caps));
  const rawDetectedOrDeclared = Math.max(detectedHours, declaredHours, existingApprovedHours);

  return {
    declaredHours,
    detectedHours,
    activityMaxHours: categoryLimit,
    categoryLimitHours: categoryLimit,
    remainingToSemesterHours: remainingToSemester,
    approvedHours,
    excessHours: Math.max(0, rawDetectedOrDeclared - approvedHours),
    category
  };
}

async function listCoordinatorStudents(coordinatorId) {
  const label = startPerf(`perf:listCoordinatorStudents:${coordinatorId}`);
  try {
    const defaultTarget = Number(await getSetting('horasMetaPadrao', '0') || 0);
    const rows = await db.prepare(`
      WITH coordinator_students AS (
        SELECT DISTINCT u.id, u.nome, u.email, COALESCE(NULLIF(sc.matricula, ''), u.matricula) AS matricula,
               u.tipo, u.ativo, sc.course_id, u.created_at
        FROM users u
        JOIN student_courses sc ON sc.user_id = u.id
        JOIN coordinator_courses cc ON cc.course_id = sc.course_id
        WHERE u.tipo = 'aluno'
          AND u.ativo = 1
          AND cc.user_id = ?
      ),
      approved_submissions AS (
        SELECT s.student_id, a.course_id, SUM(a.horas) AS approved_hours
        FROM submissions s
        JOIN activities a ON a.id = s.activity_id
        JOIN coordinator_students cs ON cs.id = s.student_id AND cs.course_id = a.course_id
        WHERE s.current_status = 'aprovado'
        GROUP BY s.student_id, a.course_id
      ),
      opportunity_hours AS (
        SELECT orx.user_id, o.course_id, SUM(o.horas) AS opportunity_hours
        FROM opportunity_registrations orx
        JOIN opportunities o ON o.id = orx.opportunity_id
        JOIN coordinator_students cs ON cs.id = orx.user_id AND cs.course_id = o.course_id
        GROUP BY orx.user_id, o.course_id
      ),
      certificate_hours AS (
        SELECT sender_id, course_id, SUM(approved_hours) AS certificate_hours
        FROM certificates
        WHERE sender_type = 'aluno'
          AND admin_status = 'aprovado'
          AND sender_id IN (SELECT id FROM coordinator_students)
        GROUP BY sender_id, course_id
      ),
      student_course_ids AS (
        SELECT sc.user_id, array_agg(sc.course_id ORDER BY sc.course_id) AS course_ids
        FROM student_courses sc
        JOIN coordinator_students cs ON cs.id = sc.user_id
        GROUP BY sc.user_id
      )
      SELECT
        cs.id,
        cs.nome,
        cs.email,
        cs.matricula,
        cs.tipo,
        cs.ativo,
        cs.course_id,
        cs.created_at,
        c.sigla AS course_sigla,
        c.nome AS course_nome,
        c.area AS course_area,
        c.tipo AS course_tipo,
        c.turno AS course_turno,
        c.carga_horaria_total AS course_carga_horaria_total,
        c.horas_meta AS course_horas_meta,
        sci.course_ids,
        COALESCE(ap.approved_hours, 0) AS approved_hours,
        COALESCE(opp.opportunity_hours, 0) AS opportunity_hours,
        COALESCE(cert.certificate_hours, 0) AS certificate_hours,
        COALESCE(c.horas_meta, ?) AS progress_target
      FROM coordinator_students cs
      LEFT JOIN courses c ON c.id = cs.course_id
      LEFT JOIN student_course_ids sci ON sci.user_id = cs.id
      LEFT JOIN approved_submissions ap ON ap.student_id = cs.id AND ap.course_id = cs.course_id
      LEFT JOIN opportunity_hours opp ON opp.user_id = cs.id AND opp.course_id = cs.course_id
      LEFT JOIN certificate_hours cert ON cert.sender_id = cs.id AND cert.course_id = cs.course_id
      ORDER BY cs.nome
    `).all(coordinatorId, defaultTarget);

    return rows.map((row) => {
      const approvedHours = Number(row.approved_hours || 0);
      const opportunityHours = Number(row.opportunity_hours || 0);
      const certificateHours = Number(row.certificate_hours || 0);
      const target = Number(row.progress_target || defaultTarget || 0);
      const identifiedHours = approvedHours + opportunityHours + certificateHours;
      const total = target > 0 ? Math.min(identifiedHours, target) : identifiedHours;
      const percent = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
      return {
        id: row.id,
        nome: row.nome,
        email: row.email,
        matricula: row.matricula || '',
        tipo: row.tipo,
        ativo: !!row.ativo,
        courseId: row.course_id || '',
        courseIds: Array.isArray(row.course_ids) ? row.course_ids.filter(Boolean) : [],
        createdAt: row.created_at,
        course: row.course_id ? {
          id: row.course_id,
          sigla: row.course_sigla || '',
          nome: row.course_nome || '',
          area: row.course_area || '',
          tipo: row.course_tipo || 'Graduação',
          turno: row.course_turno || '',
          cargaHorariaTotal: Number(row.course_carga_horaria_total || 0),
          horasMeta: Number(row.course_horas_meta || 0)
        } : null,
        progress: {
          total,
          target,
          percent,
          identifiedHours,
          approvedHours,
          opportunityHours,
          certificateHours
        }
      };
    });
  } finally {
    endPerf(label);
  }
}

async function listSubmissionsForCoordinator(coordinatorId) {
  const label = startPerf(`perf:listSubmissionsForCoordinator:${coordinatorId}`);
  try {
    const rows = await db.prepare(`
      SELECT
        s.id AS submission_id,
        s.activity_id,
        s.student_id,
        s.current_status,
        v.id AS version_id,
        v.version,
        v.arquivo_nome,
        v.observacao,
        v.categoria,
        v.horas_declaradas,
        v.descricao,
        v.status,
        v.feedback,
        v.enviada_em,
        v.avaliada_em,
        a.titulo AS activity_titulo,
        a.descricao AS activity_descricao,
        a.horas AS activity_horas,
        a.prazo AS activity_prazo,
        a.material_nome,
        a.created_by AS activity_created_by,
        a.created_at AS activity_created_at,
        u.nome AS student_nome,
        u.email AS student_email,
        u.ativo AS student_ativo,
        u.course_id AS student_course_id,
        u.created_at AS student_created_at,
        sc.course_ids AS student_course_ids,
        c.id AS course_id,
        c.sigla AS course_sigla,
        c.nome AS course_nome,
        c.area AS course_area,
        c.tipo AS course_tipo,
        c.turno AS course_turno,
        c.carga_horaria_total AS course_carga_horaria_total,
        c.horas_meta AS course_horas_meta
      FROM submissions s
      JOIN activities a ON a.id = s.activity_id
      JOIN coordinator_courses cc ON cc.course_id = a.course_id AND cc.user_id = ?
      LEFT JOIN LATERAL (
        SELECT id, version, arquivo_nome, observacao, categoria, horas_declaradas, descricao, status, feedback, enviada_em, avaliada_em
        FROM submission_versions
        WHERE submission_id = s.id
        ORDER BY version DESC
        LIMIT 1
      ) v ON TRUE
      LEFT JOIN users u ON u.id = s.student_id
      LEFT JOIN LATERAL (
        SELECT array_agg(course_id ORDER BY course_id) AS course_ids
        FROM student_courses
        WHERE user_id = u.id
      ) sc ON TRUE
      LEFT JOIN courses c ON c.id = a.course_id
      ORDER BY v.enviada_em DESC NULLS LAST, s.id DESC
    `).all(coordinatorId);
    return rows.map(serializeJoinedSubmission);
  } finally {
    endPerf(label);
  }
}

function serializeJoinedSubmission(row) {
  const latest = row.version_id ? {
    id: Number(row.version_id),
    version: Number(row.version || 0),
    arquivoNome: row.arquivo_nome || '',
    arquivoData: '',
    observacao: row.observacao || '',
    categoria: row.categoria || '',
    horasDeclaradas: Number(row.horas_declaradas || 0),
    descricao: row.descricao || '',
    status: row.status || 'em_analise',
    feedback: row.feedback || '',
    enviadaEm: row.enviada_em || '',
    avaliadaEm: row.avaliada_em || ''
  } : null;

  const activity = row.activity_id ? {
    id: row.activity_id,
    titulo: row.activity_titulo || '',
    descricao: row.activity_descricao || '',
    courseId: row.course_id || '',
    horas: Number(row.activity_horas || 0),
    prazo: row.activity_prazo || '',
    materialNome: row.material_nome || '',
    materialArquivo: '',
    createdBy: row.activity_created_by || '',
    createdAt: row.activity_created_at || ''
  } : null;

  const student = row.student_id ? {
    id: row.student_id,
    nome: row.student_nome || '',
    email: row.student_email || '',
    tipo: 'aluno',
    ativo: row.student_ativo !== 0,
    courseId: row.student_course_id || '',
    courseIds: row.student_course_ids ? String(row.student_course_ids).split(',').filter(Boolean) : [],
    createdAt: row.student_created_at || ''
  } : null;

  const course = row.course_id ? {
    id: row.course_id,
    sigla: row.course_sigla || '',
    nome: row.course_nome || '',
    area: row.course_area || '',
    tipo: row.course_tipo || 'Graduação',
    turno: row.course_turno || '',
    cargaHorariaTotal: Number(row.course_carga_horaria_total || 0),
    horasMeta: Number(row.course_horas_meta || 0)
  } : null;

  return {
    id: row.submission_id,
    activityId: row.activity_id,
    studentId: row.student_id,
    currentStatus: row.current_status,
    versions: latest ? [latest] : [],
    activity,
    student,
    course,
    latest
  };
}

function normalizeCollectionPayload(value) {
  if (Array.isArray(value)) {
    return { items: value, pagination: null };
  }
  if (value && typeof value === 'object') {
    const items = Array.isArray(value.items)
      ? value.items
      : Array.isArray(value.data)
        ? value.data
        : [];
    const total = Number(value.total);
    const limit = Number(value.limit);
    const offset = Number(value.offset);
    const pagination = [total, limit, offset].some((item) => Number.isFinite(item))
      ? {
          total: Number.isFinite(total) ? total : items.length,
          limit: Number.isFinite(limit) ? limit : items.length,
          offset: Number.isFinite(offset) ? offset : 0
        }
      : null;
    return { items, pagination };
  }
  return { items: [], pagination: null };
}

function ensureApiArray(value) {
  return normalizeCollectionPayload(value).items;
}

function normalizeAdminDashboardPayload(dashboard) {
  const base = dashboard && typeof dashboard === 'object' ? dashboard : {};
  return {
    ...base,
    totals: base.totals || {
      totalCursos: 0,
      totalUsuarios: 0,
      totalOportunidades: 0,
      pendentes: 0,
      aprovados: 0,
      rejeitados: 0,
      certificadosPendentes: 0
    },
    users: ensureApiArray(base.users),
    courses: ensureApiArray(base.courses),
    submissions: ensureApiArray(base.submissions),
    certificates: ensureApiArray(base.certificates),
    opportunities: ensureApiArray(base.opportunities),
    notifications: ensureApiArray(base.notifications),
    auditLogs: ensureApiArray(base.auditLogs),
    emails: ensureApiArray(base.emails),
    rules: ensureApiArray(base.rules),
    students: ensureApiArray(base.students),
    activities: ensureApiArray(base.activities)
  };
}

async function listAdminSubmissions(pagination = null) {
  const countRow = pagination
    ? await db.prepare('SELECT COUNT(*) AS total FROM submissions').get()
    : null;
  const baseSql = `
    SELECT
      s.id AS submission_id,
      s.activity_id,
      s.student_id,
      s.current_status,
      v.id AS version_id,
      v.version,
      v.arquivo_nome,
      v.observacao,
      v.categoria,
      v.horas_declaradas,
      v.descricao,
      v.status,
      v.feedback,
      v.enviada_em,
      v.avaliada_em,
      a.titulo AS activity_titulo,
      a.descricao AS activity_descricao,
      a.horas AS activity_horas,
      a.prazo AS activity_prazo,
      a.material_nome,
      a.created_by AS activity_created_by,
      a.created_at AS activity_created_at,
      u.nome AS student_nome,
      u.email AS student_email,
      u.ativo AS student_ativo,
      u.course_id AS student_course_id,
      u.created_at AS student_created_at,
      sc.course_ids AS student_course_ids,
      c.id AS course_id,
      c.sigla AS course_sigla,
      c.nome AS course_nome,
      c.area AS course_area,
      c.tipo AS course_tipo,
      c.turno AS course_turno,
      c.carga_horaria_total AS course_carga_horaria_total,
      c.horas_meta AS course_horas_meta
    FROM submissions s
    LEFT JOIN LATERAL (
      SELECT id, version, arquivo_nome, observacao, categoria, horas_declaradas, descricao, status, feedback, enviada_em, avaliada_em
      FROM submission_versions
      WHERE submission_id = s.id
      ORDER BY version DESC
      LIMIT 1
    ) v ON TRUE
    LEFT JOIN activities a ON a.id = s.activity_id
    LEFT JOIN users u ON u.id = s.student_id
    LEFT JOIN LATERAL (
      SELECT string_agg(course_id, ',' ORDER BY course_id) AS course_ids
      FROM student_courses
      WHERE user_id = u.id
    ) sc ON TRUE
    LEFT JOIN courses c ON c.id = a.course_id
    ORDER BY v.enviada_em DESC NULLS LAST, s.id DESC
  `;
  const queryParams = pagination ? [pagination.limit, pagination.offset] : [];
  const rows = await db.prepare(withPagination(baseSql, pagination)).all(...queryParams);

  const items = rows.map(serializeJoinedSubmission);
  return pagination
    ? { items, pagination: buildPagination(countRow?.total || 0, pagination) }
    : items;
}

async function getNotificationsForUser(userId) {
  const rows = await db.prepare('SELECT id, user_id, mensagem, tipo, created_at, read FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    mensagem: row.mensagem,
    tipo: row.tipo,
    createdAt: row.created_at,
    read: !!row.read
  }));
}

async function markNotificationsRead(userId) {
  await db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId);
}

function mapEmails(emailRows) {
  return emailRows.map((row) => ({
    id: row.id,
    to: row.to_email,
    subject: row.subject,
    body: row.body,
    kind: row.kind,
    status: row.status,
    createdAt: row.created_at
  }));
}

async function listEmails(pagination = null) {
  const countRow = pagination
    ? await db.prepare('SELECT COUNT(*) AS total FROM emails').get()
    : null;
  const baseSql = `SELECT ${EMAIL_COLUMNS} FROM emails ORDER BY created_at DESC`;
  const queryParams = pagination ? [pagination.limit, pagination.offset] : [];
  const rows = await db.prepare(withPagination(baseSql, pagination)).all(...queryParams);
  const items = mapEmails(rows);
  return pagination
    ? { items, pagination: buildPagination(countRow?.total || 0, pagination) }
    : items;
}

async function getAdminSettings() {
  return {
    horasMetaPadrao: Number(await getSetting('horasMetaPadrao', '0')),
    emailNotificationsEnabled: await getSetting('emailNotificationsEnabled', 'true') === 'true',
    ocrDisponivel: await getSetting('ocrDisponivel', 'false') === 'true'
  };
}

function normalizeDashboardStatus(value) {
  const status = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s-]+/g, '_');
  if (['aprovado', 'aprovada', 'aprovado_automatico'].includes(status)) return 'aprovado';
  if (['removido', 'removido_da_contagem'].includes(status)) return 'removido';
  if (['rejeitado', 'rejeitada', 'rejeitado_automatico', 'reprovado', 'reprovada'].includes(status)) return 'rejeitado';
  return 'em_analise';
}

function createDashboardStatusSummary() {
  return { pendentes: 0, aprovados: 0, rejeitados: 0, removidos: 0, total: 0 };
}

function addDashboardStatus(summary, status) {
  const bucket = normalizeDashboardStatus(status);
  if (bucket === 'aprovado') summary.aprovados += 1;
  else if (bucket === 'rejeitado') summary.rejeitados += 1;
  else if (bucket === 'removido') summary.removidos += 1;
  else summary.pendentes += 1;
  summary.total += 1;
  return summary;
}

function countDashboardStatuses(items, getStatus) {
  const summary = createDashboardStatusSummary();
  for (const item of ensureApiArray(items)) addDashboardStatus(summary, getStatus(item));
  return summary;
}

function mergeDashboardStatuses(...summaries) {
  return summaries.reduce((acc, summary) => {
    acc.pendentes += Number(summary?.pendentes || 0);
    acc.aprovados += Number(summary?.aprovados || 0);
    acc.rejeitados += Number(summary?.rejeitados || 0);
    acc.removidos += Number(summary?.removidos || 0);
    acc.total += Number(summary?.total || 0);
    return acc;
  }, createDashboardStatusSummary());
}

function getSubmissionDashboardStatus(submission) {
  return normalizeDashboardStatus(submission?.latest?.status || submission?.currentStatus || submission?.current_status);
}

function getCertificateDashboardStatus(certificate) {
  return normalizeDashboardStatus(certificate?.adminStatus || certificate?.admin_status || 'pendente');
}

function isCertificateValidForProgress(certificate) {
  const adminStatus = normalizeDashboardStatus(certificate?.adminStatus || certificate?.admin_status);
  if (adminStatus === 'rejeitado' || adminStatus === 'removido') return false;
  return adminStatus === 'aprovado';
}

function getCertificateDashboardHours(certificate) {
  return Math.max(0, Number(certificate?.approvedHours ?? certificate?.approved_hours ?? 0));
}

function buildAcademicMlRowsFromDashboard(dashboard) {
  const rowsByKey = new Map();
  const addStudent = (student, course = student?.course) => {
    const courseId = course?.id || student?.courseId || '';
    if (!student?.id || !courseId) return;
    const key = `${student.id}:${courseId}`;
    if (rowsByKey.has(key)) return;
    const progress = student.progress || {};
    const target = Number(progress.target || course?.horasMeta || 0);
    const identifiedHours = Math.max(0, Number(progress.identifiedHours ?? progress.total ?? 0));
    const approvedHours = target > 0 ? Math.min(identifiedHours, target) : identifiedHours;
    rowsByKey.set(key, {
      aluno_id: student.id,
      aluno_nome: student.nome || '',
      aluno_email: student.email || '',
      aluno_matricula: student.matricula || '',
      curso_id: courseId,
      curso: course?.sigla || courseId,
      curso_nome: course?.nome || course?.sigla || '',
      meta_horas: target,
      horas_identificadas: identifiedHours,
      horas_aprovadas: approvedHours,
      percentual_concluido: target > 0 ? Math.min(100, Math.round((approvedHours / target) * 100)) : 0,
      qtd_aprovadas: 0,
      qtd_rejeitadas: 0,
      qtd_pendentes: 0
    });
  };

  for (const course of ensureApiArray(dashboard?.courses)) {
    for (const student of ensureApiArray(course?.students)) addStudent(student, course);
  }
  for (const student of ensureApiArray(dashboard?.students)) addStudent(student, student.course);

  const countStatus = (row, status) => {
    const bucket = normalizeDashboardStatus(status);
    if (bucket === 'aprovado') row.qtd_aprovadas += 1;
    else if (bucket === 'rejeitado' || bucket === 'removido') row.qtd_rejeitadas += 1;
    else row.qtd_pendentes += 1;
  };
  for (const submission of ensureApiArray(dashboard?.submissions)) {
    const key = `${submission.studentId || submission.student?.id}:${submission.activity?.courseId || submission.course?.id || ''}`;
    if (rowsByKey.has(key)) countStatus(rowsByKey.get(key), getSubmissionDashboardStatus(submission));
  }
  for (const certificate of ensureApiArray(dashboard?.certificates || dashboard?.certificatesToReview)) {
    const key = `${certificate.senderId}:${certificate.courseId || ''}`;
    if (rowsByKey.has(key)) countStatus(rowsByKey.get(key), getCertificateDashboardStatus(certificate));
  }

  return [...rowsByKey.values()].map((row) => ({
    ...row,
    classificacao_risco: row.percentual_concluido >= 100 ? 'baixo' : row.percentual_concluido < 60 ? 'alto' : 'medio'
  })).sort((a, b) => {
    const riskOrder = { alto: 1, medio: 2, baixo: 3 };
    return riskOrder[a.classificacao_risco] - riskOrder[b.classificacao_risco]
      || a.percentual_concluido - b.percentual_concluido
      || a.aluno_nome.localeCompare(b.aluno_nome, 'pt-BR');
  });
}

function getUserCourseIdsForDashboard(user) {
  const ids = Array.isArray(user?.courseIds) ? user.courseIds.filter(Boolean) : [];
  if (ids.length) return ids;
  return user?.courseId ? [user.courseId] : [];
}

function getAdminTotals({ courses, users, opportunities, submissions, certificates }) {
  const statusSummary = mergeDashboardStatuses(
    countDashboardStatuses(submissions, getSubmissionDashboardStatus),
    countDashboardStatuses(certificates, getCertificateDashboardStatus)
  );
  return {
    totalCursos: courses.length,
    totalUsuarios: users.filter((item) => item.ativo).length,
    totalOportunidades: opportunities.length,
    pendentes: statusSummary.pendentes,
    aprovados: statusSummary.aprovados,
    rejeitados: statusSummary.rejeitados,
    removidos: statusSummary.removidos,
    certificadosPendentes: certificates.filter((item) => normalizeDashboardStatus(item.adminStatus) === 'em_analise').length,
    certificadosAprovados: certificates.filter((item) => normalizeDashboardStatus(item.adminStatus) === 'aprovado').length,
    certificadosRejeitados: certificates.filter((item) => normalizeDashboardStatus(item.adminStatus) === 'rejeitado').length,
    certificadosRemovidos: certificates.filter((item) => normalizeDashboardStatus(item.adminStatus) === 'removido').length,
    statusSummary
  };
}

function buildAdminCourses({ courseRows, users, submissions, opportunities, certificates }) {
  courseRows = ensureApiArray(courseRows);
  users = ensureApiArray(users);
  submissions = ensureApiArray(submissions);
  opportunities = ensureApiArray(opportunities);
  certificates = ensureApiArray(certificates);

  const submissionsByCourseId = new Map();
  const dashboardStatusByCourseId = new Map();
  const approvedHoursByStudentCourse = new Map();
  const studentsByCourse = new Map();
  const courseIdsByStudent = new Map();

  const addCourseStatus = (courseId, status) => {
    if (!courseId) return;
    if (!dashboardStatusByCourseId.has(courseId)) dashboardStatusByCourseId.set(courseId, createDashboardStatusSummary());
    addDashboardStatus(dashboardStatusByCourseId.get(courseId), status);
  };

  for (const student of users) {
    if (student.tipo !== 'aluno' || !student.ativo) continue;
    const ids = getUserCourseIdsForDashboard(student);
    courseIdsByStudent.set(student.id, ids);
    for (const courseId of ids) {
      if (!studentsByCourse.has(courseId)) studentsByCourse.set(courseId, []);
      studentsByCourse.get(courseId).push(student);
    }
  }

  for (const submission of submissions) {
    const courseId = submission.activity?.courseId;
    if (!courseId) continue;
    if (!submissionsByCourseId.has(courseId)) submissionsByCourseId.set(courseId, []);
    submissionsByCourseId.get(courseId).push(submission);
    addCourseStatus(courseId, getSubmissionDashboardStatus(submission));

    if (getSubmissionDashboardStatus(submission) === 'aprovado') {
      const key = `${submission.studentId}:${courseId}`;
      approvedHoursByStudentCourse.set(key, (approvedHoursByStudentCourse.get(key) || 0) + Number(submission.activity?.horas || 0));
    }
  }

  const opportunityHoursByStudentCourse = new Map();
  for (const item of opportunities) {
    if (!item.courseId) continue;
    for (const studentId of item.inscritos || []) {
      const key = `${studentId}:${item.courseId}`;
      opportunityHoursByStudentCourse.set(key, (opportunityHoursByStudentCourse.get(key) || 0) + Number(item.horas || 0));
    }
  }

  const certificateHoursByStudent = new Map();
  for (const item of certificates) {
    if (item.senderType !== 'aluno') continue;
    const linkedCourseIds = item.courseId ? [item.courseId] : (courseIdsByStudent.get(item.senderId) || []);
    for (const courseId of linkedCourseIds) addCourseStatus(courseId, getCertificateDashboardStatus(item));
    if (!isCertificateValidForProgress(item)) continue;
    certificateHoursByStudent.set(`${item.senderId}:${linkedCourseIds[0] || ''}`, (certificateHoursByStudent.get(`${item.senderId}:${linkedCourseIds[0] || ''}`) || 0) + getCertificateDashboardHours(item));
  }

  const courses = [];
  for (const course of courseRows) {
    const students = (studentsByCourse.get(course.id) || []).map((student) => {
      const approvedHours = approvedHoursByStudentCourse.get(`${student.id}:${course.id}`) || 0;
      const opportunityHours = opportunityHoursByStudentCourse.get(`${student.id}:${course.id}`) || 0;
      const certificateHours = certificateHoursByStudent.get(`${student.id}:${course.id}`) || 0;
      const target = Number(course?.horasMeta || 0);
      const identifiedHours = approvedHours + opportunityHours + certificateHours;
      const total = target > 0 ? Math.min(identifiedHours, target) : identifiedHours;
      return {
        ...student,
        progress: {
          total,
          target,
          percent: target ? Math.min(100, Math.round((total / target) * 100)) : 0,
          identifiedHours,
          approvedHours,
          opportunityHours,
          certificateHours
        }
      };
    });

    const statusSummary = dashboardStatusByCourseId.get(course.id) || createDashboardStatusSummary();
    const completedStudents = students.filter((student) => Number(student.progress?.total || 0) >= Number(student.progress?.target || 0)).length;
    const taxaAprovacao = students.length ? Math.round((completedStudents / students.length) * 100) : 0;
    courses.push({ ...course, students, totalAlunos: students.length, taxaAprovacao, statusSummary });
  }

  return courses;
}

async function getAdminDashboardData() {
  const lightweightPagination = defaultPagination(50);
  const [
    users,
    submissions,
    opportunities,
    emailRows,
    certificates,
    rules,
    auditLogs,
    courseRows,
    settings
  ] = await Promise.all([
    listUsers(defaultPagination(100)),
    listAdminSubmissions(lightweightPagination),
    listOpportunities(),
    db.prepare(`SELECT ${EMAIL_COLUMNS} FROM emails ORDER BY created_at DESC LIMIT 50`).all(),
    listCertificatesForAdmin(lightweightPagination),
    listActivityRules(),
    listAuditLogs(60),
    listCourses(),
    getAdminSettings()
  ]);

  const userItems = normalizeCollectionPayload(users).items;
  const submissionItems = normalizeCollectionPayload(submissions).items;
  const certificateItems = normalizeCollectionPayload(certificates).items;
  const courses = buildAdminCourses({ courseRows, users: userItems, submissions: submissionItems, opportunities, certificates: certificateItems });

  return normalizeAdminDashboardPayload({
    totals: getAdminTotals({ courses, users: userItems, opportunities, submissions: submissionItems, certificates: certificateItems }),
    courses,
    users: userItems,
    submissions: submissionItems,
    opportunities,
    rules,
    auditLogs,
    emails: mapEmails(emailRows),
    settings,
    certificates: certificateItems
  });
}

async function getAdminDashboardSummary() {
  const [courseCount, activeUserCount, opportunityCount, submissionStatusRows, certificateStatusRows, settings] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS total FROM courses').get(),
    db.prepare('SELECT COUNT(*) AS total FROM users WHERE ativo = 1').get(),
    db.prepare('SELECT COUNT(*) AS total FROM opportunities').get(),
    db.prepare(`
      SELECT COALESCE(v.status, s.current_status) AS status, COUNT(*) AS total
      FROM submissions s
      LEFT JOIN LATERAL (
        SELECT status
        FROM submission_versions
        WHERE submission_id = s.id
        ORDER BY version DESC
        LIMIT 1
      ) v ON TRUE
      GROUP BY COALESCE(v.status, s.current_status)
    `).all(),
    db.prepare(`
      SELECT
        CASE
          WHEN admin_status IN ('removido', 'removido_da_contagem') THEN 'removido'
          WHEN admin_status = 'aprovado' THEN 'aprovado'
          WHEN admin_status = 'rejeitado' THEN 'rejeitado'
          ELSE 'em_analise'
        END AS status,
        COUNT(*) AS total
      FROM certificates
      GROUP BY 1
    `).all(),
    getAdminSettings()
  ]);

  const summaryFromGroupedRows = (rows) => rows.reduce((summary, row) => {
    const bucket = normalizeDashboardStatus(row.status);
    const total = Number(row.total || 0);
    if (bucket === 'aprovado') summary.aprovados += total;
    else if (bucket === 'rejeitado') summary.rejeitados += total;
    else if (bucket === 'removido') summary.removidos += total;
    else summary.pendentes += total;
    summary.total += total;
    return summary;
  }, createDashboardStatusSummary());
  const statusSummary = mergeDashboardStatuses(
    summaryFromGroupedRows(submissionStatusRows),
    summaryFromGroupedRows(certificateStatusRows)
  );

  return {
    totals: {
      totalCursos: Number(courseCount?.total || 0),
      totalUsuarios: Number(activeUserCount?.total || 0),
      totalOportunidades: Number(opportunityCount?.total || 0),
      pendentes: statusSummary.pendentes,
      aprovados: statusSummary.aprovados,
      rejeitados: statusSummary.rejeitados,
      removidos: statusSummary.removidos,
      certificadosPendentes: certificateStatusRows
        .filter((row) => normalizeDashboardStatus(row.status) === 'em_analise')
        .reduce((sum, row) => sum + Number(row.total || 0), 0),
      statusSummary
    },
    settings
  };
}

async function getAdminDashboardOverview() {
  const lightweightPagination = defaultPagination(50);
  const [users, submissions, opportunities, certificates, rules, courseRows, settings, totals] = await Promise.all([
    listUsers(defaultPagination(100)),
    listAdminSubmissions(lightweightPagination),
    listOpportunities(),
    listCertificatesForAdmin(lightweightPagination),
    listActivityRules(),
    listCourses(),
    getAdminSettings(),
    getAdminDashboardSummary()
  ]);
  const userItems = normalizeCollectionPayload(users).items;
  const submissionItems = normalizeCollectionPayload(submissions).items;
  const certificateItems = normalizeCollectionPayload(certificates).items;

  return normalizeAdminDashboardPayload({
    totals: totals.totals,
    courses: buildAdminCourses({ courseRows, users: userItems, submissions: submissionItems, opportunities, certificates: certificateItems }),
    submissions: submissionItems,
    opportunities,
    rules,
    settings,
    certificates: certificateItems
  });
}

async function getCoordinatorDashboardData(coordinatorId) {
  const label = startPerf(`perf:getCoordinatorDashboardData:${coordinatorId}`);
  try {
    const courseIds = await getCoordinatorCourseIds(coordinatorId);
    const [submissionsRaw, studentsRaw, activitiesRaw, certificatesRaw, settings, opportunitiesRaw, coursesRaw, rulesRaw] = await Promise.all([
      listSubmissionsForCoordinator(coordinatorId),
      listCoordinatorStudents(coordinatorId),
      listActivitiesForCoordinator(coordinatorId),
      listCertificatesForCoordinator(coordinatorId),
      getAdminSettings(),
      listOpportunities(),
      Promise.all(courseIds.map((courseId) => getCourseById(courseId))),
      listActivityRulesForCourses(courseIds)
    ]);
    const { items: submissions, pagination: submissionsPagination } = normalizeCollectionPayload(submissionsRaw);
    const { items: students } = normalizeCollectionPayload(studentsRaw);
    const { items: activities } = normalizeCollectionPayload(activitiesRaw);
    const { items: certificatesToReview } = normalizeCollectionPayload(certificatesRaw);
    const { items: allOpportunities } = normalizeCollectionPayload(opportunitiesRaw);
    const allowedOpportunityCourses = new Set(courseIds);
    const opportunities = allOpportunities.filter((item) => allowedOpportunityCourses.has(item.courseId));
    const { items: courses } = normalizeCollectionPayload(coursesRaw);
    const { items: rules } = normalizeCollectionPayload(rulesRaw);
    const statusSummary = mergeDashboardStatuses(
      countDashboardStatuses(submissions, getSubmissionDashboardStatus),
      countDashboardStatuses(certificatesToReview, getCertificateDashboardStatus)
    );
    const totalEvaluated = statusSummary.aprovados + statusSummary.rejeitados;
    const approvalRate = totalEvaluated ? Math.round((statusSummary.aprovados / totalEvaluated) * 100) : 0;
    const alunosComEnvio = students.filter((student) => {
      const bySubmission = submissions.some((submission) => submission.student?.id === student.id || submission.studentId === student.id);
      const byCertificate = certificatesToReview.some((certificate) => certificate.senderId === student.id);
      return bySubmission || byCertificate;
    }).length;
    return {
      pendentes: statusSummary.pendentes,
      aprovados: statusSummary.aprovados,
      rejeitados: statusSummary.rejeitados,
      taxaAprovacao: approvalRate,
      certificadosPendentes: certificatesToReview.filter((item) => normalizeDashboardStatus(item.adminStatus) === 'em_analise').length,
      certificadosAprovados: certificatesToReview.filter((item) => normalizeDashboardStatus(item.adminStatus) === 'aprovado').length,
      certificadosRejeitados: certificatesToReview.filter((item) => normalizeDashboardStatus(item.adminStatus) === 'rejeitado').length,
      statusSummary,
      alunosComEnvio,
      alunosSemEnvio: Math.max(0, students.length - alunosComEnvio),
      totalAlunos: students.length,
      totalAtividades: activities.length,
      students,
      submissions,
      submissionsPagination,
      certificatesToReview,
      settings,
      rules,
      opportunities,
      activities,
      courses: courses.filter(Boolean)
    };
  } finally {
    endPerf(label);
  }
}

async function getCoordinatorDashboardSummary(coordinatorId) {
  const label = startPerf(`perf:getCoordinatorDashboardSummary:${coordinatorId}`);
  try {
    const courseIds = await getCoordinatorCourseIds(coordinatorId);
    const [submissionsRaw, studentsRaw, coursesRaw, settings, certificatesRaw] = await Promise.all([
      listSubmissionsForCoordinator(coordinatorId),
      listCoordinatorStudents(coordinatorId),
      Promise.all(courseIds.map((courseId) => getCourseById(courseId))),
      getAdminSettings(),
      listCertificatesForCoordinator(coordinatorId)
    ]);
    const { items: submissions, pagination: submissionsPagination } = normalizeCollectionPayload(submissionsRaw);
    const { items: students } = normalizeCollectionPayload(studentsRaw);
    const { items: courses } = normalizeCollectionPayload(coursesRaw);
    const { items: certificatesToReview } = normalizeCollectionPayload(certificatesRaw);
    const statusSummary = mergeDashboardStatuses(
      countDashboardStatuses(submissions, getSubmissionDashboardStatus),
      countDashboardStatuses(certificatesToReview, getCertificateDashboardStatus)
    );
    const totalEvaluated = statusSummary.aprovados + statusSummary.rejeitados;
    const approvalRate = totalEvaluated ? Math.round((statusSummary.aprovados / totalEvaluated) * 100) : 0;
    const alunosComEnvio = students.filter((student) => {
      const bySubmission = submissions.some((submission) => submission.student?.id === student.id || submission.studentId === student.id);
      const byCertificate = certificatesToReview.some((certificate) => certificate.senderId === student.id);
      return bySubmission || byCertificate;
    }).length;
    return {
      pendentes: statusSummary.pendentes,
      aprovados: statusSummary.aprovados,
      rejeitados: statusSummary.rejeitados,
      taxaAprovacao: approvalRate,
      certificadosPendentes: certificatesToReview.filter((item) => normalizeDashboardStatus(item.adminStatus) === 'em_analise').length,
      certificadosAprovados: certificatesToReview.filter((item) => normalizeDashboardStatus(item.adminStatus) === 'aprovado').length,
      certificadosRejeitados: certificatesToReview.filter((item) => normalizeDashboardStatus(item.adminStatus) === 'rejeitado').length,
      statusSummary,
      alunosComEnvio,
      alunosSemEnvio: Math.max(0, students.length - alunosComEnvio),
      totalAlunos: students.length,
      totalAtividades: 0,
      students,
      submissions,
      submissionsPagination,
      certificatesToReview,
      settings,
      courses: courses.filter(Boolean)
    };
  } finally {
    endPerf(label);
  }
}

async function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  await db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, userId, nowIso(), addMs(SESSION_TTL_MS));
  return token;
}

async function getSessionUser(token) {
  const row = await db.prepare(`SELECT
                                  users.id, users.nome, users.email, users.senha_hash, users.tipo, users.ativo,
                                  users.course_id, users.matricula, users.must_change_password,
                                  users.password_updated_at, users.temporary_password_issued_at,
                                  users.created_at, users.telefone, users.cpf, users.endereco,
                                  users.data_nascimento, users.curso_interesse,
                                  sessions.expires_at AS session_expires_at
                                FROM sessions
                                JOIN users ON users.id = sessions.user_id
                                WHERE sessions.token = ? AND users.ativo = 1`).get(token);
  if (row && (!row.session_expires_at || Date.parse(row.session_expires_at) <= Date.now())) {
    await deleteSession(token);
    return null;
  }
  return row ? serializeUser(row) : null;
}

async function deleteSession(token) {
  await db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

async function deleteUserSessions(userId) {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

async function deleteExpiredSecurityRows() {
  const now = nowIso();
  await db.prepare('DELETE FROM sessions WHERE expires_at IS NULL OR expires_at <= ?').run(now);
  await db.prepare('DELETE FROM password_reset_tokens WHERE expires_at <= ? OR used_at IS NOT NULL').run(now);
}

async function createPasswordResetToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(userId);
  await db.prepare(`INSERT INTO password_reset_tokens (token_hash, user_id, created_at, expires_at, used_at)
                    VALUES (?, ?, ?, ?, NULL)`)
    .run(sha256(token), userId, nowIso(), addMs(PASSWORD_RESET_TTL_MS));
  return token;
}

async function consumePasswordResetToken(token) {
  const tokenHash = sha256(token);
  const row = await db.prepare(`SELECT password_reset_tokens.token_hash, password_reset_tokens.user_id, password_reset_tokens.created_at,
                                       password_reset_tokens.expires_at, password_reset_tokens.used_at, users.email, users.ativo
                                FROM password_reset_tokens
                                JOIN users ON users.id = password_reset_tokens.user_id
                                WHERE token_hash = ?`).get(tokenHash);
  if (!row || row.used_at || !row.ativo || Date.parse(row.expires_at) <= Date.now()) {
    return null;
  }
  await db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?').run(nowIso(), tokenHash);
  return row;
}

function getCorsHeaders(req) {
  const origin = req?.headers?.origin;
  if (!origin) return {};
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Vary': 'Origin'
  };
}

function gzipBody(body) {
  return new Promise((resolve, reject) => {
    zlib.gzip(body, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

async function send(res, status, payload, headers = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const contentType = typeof payload === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8';
  const acceptsGzip = String(res.req?.headers?.['accept-encoding'] || '').includes('gzip');
  const shouldGzip = acceptsGzip && Buffer.byteLength(body) > 1024;
  const responseBody = shouldGzip ? await gzipBody(body) : body;
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    ...getCorsHeaders(res.req),
    ...(shouldGzip ? { 'Content-Encoding': 'gzip' } : {}),
    ...headers
  });
  res.end(responseBody);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > MAX_JSON_BODY_BYTES) {
        const error = new Error('Corpo da requisição muito grande.');
        error.statusCode = 413;
        reject(error);
      }
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        const parseError = new Error('JSON inválido.');
        parseError.statusCode = 400;
        reject(parseError);
      }
    });
    req.on('error', reject);
  });
}


// ===== INÍCIO ADIÇÃO ML SIGAC: helpers para rodar Python e ler os arquivos CSV/TXT do ML =====
function runPythonScript(scriptName, extraEnv = {}) {
  const scriptPath = path.join(ML_DIR, 'scripts', scriptName);
  return new Promise((resolve, reject) => {
    execFile(
      PYTHON_BIN,
      [scriptPath],
      {
        cwd: ML_DIR,
        timeout: 120000,
        env: { ...process.env, ...extraEnv }
      },
      (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      }
    );
  });
}

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  const text = String(line || '');
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseSimpleCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines.shift()).map((header) => header.trim());
  return lines.map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, String(values[index] || '').trim()]));
  });
}

function readMlResumo() {
  const file = path.join(ML_REPORTS_DIR, 'resumo_executivo.txt');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const getNumber = (label) => {
    const regex = new RegExp(`${label}:\\s*([0-9.,]+)`, 'i');
    const match = text.match(regex);
    return match ? Number(String(match[1]).replace(',', '.')) : 0;
  };
  return {
    totalRegistros: getNumber('Total de registros'),
    aprovados: getNumber('Aprovados'),
    rejeitados: getNumber('Rejeitados'),
    emAnalise: getNumber('Em análise'),
    taxaAprovacao: toPercentInteger(getNumber('Taxa de aprovação'))
  };
}

function readMlRiscoAlunos() {
  const file = path.join(ML_REPORTS_DIR, 'risco_alunos.csv');
  if (!fs.existsSync(file)) return [];
  return parseSimpleCsv(fs.readFileSync(file, 'utf8'));
}

function toMlNumber(value) {
  const number = Number(String(value ?? 0).replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

function toPercentInteger(value) {
  return Math.max(0, Math.min(100, Math.round(toMlNumber(value))));
}

function normalizeMlRisk(value) {
  const risco = String(value || 'medio')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (risco === 'alto' || risco === 'medio' || risco === 'baixo') return risco;
  return 'medio';
}

// ===== FIM ADIÇÃO ML SIGAC: helpers de execução/leitura do ML =====

function getToken(req) {
  const auth = req.headers.authorization || '';
  const [scheme, token] = auth.split(' ');
  if (scheme === 'Bearer' && token) return token;
  return '';
}

async function requireAuth(req, res, urlObj, roles = null, options = {}) {
  const token = getToken(req, urlObj);
  const user = token ? await getSessionUser(token) : null;
  if (!user) {
    send(res, 401, { error: 'Sessão inválida ou expirada.' });
    return null;
  }
  if (user.mustChangePassword && !options.allowPasswordChange) {
    send(res, 403, { error: 'Troque sua senha temporária antes de continuar.', mustChangePassword: true });
    return null;
  }
  if (roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(user.tipo)) {
      send(res, 403, { error: 'Acesso negado.' });
      return null;
    }
  }
  return { token, user };
}

function notFound(res) {
  send(res, 404, { error: 'Rota não encontrada.' });
}

function getPublicFile(pathname) {
  const requestPath = pathname === '/' ? '/loginsigac.html' : pathname;
  const cleanPath = requestPath.replace(/^\/+/, '');
  const parts = cleanPath.split(/[\\/]+/).filter(Boolean);
  if (!parts.length || parts.some((part) => part === '..' || part.startsWith('.'))) return null;

  const ext = path.extname(parts[parts.length - 1]).toLowerCase();
  const contentType = PUBLIC_CONTENT_TYPES[ext];
  if (!contentType) return null;

  if (parts.length === 1 && !PUBLIC_ROOT_FILES.has(parts[0])) return null;
  if (parts.length > 1 && !PUBLIC_DIRECTORIES.has(parts[0])) return null;

  const filePath = path.resolve(ROOT, ...parts);
  if (!filePath.startsWith(ROOT + path.sep)) return null;
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return null;

  return { filePath, ext, contentType };
}

const server = http.createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const requestedPathname = decodeURIComponent(urlObj.pathname);
    const mobileAliases = {
      '/api/mobile/student/profile': '/api/student/dashboard',
      '/api/mobile/student/content': '/api/student/dashboard',
      '/api/mobile/student/dashboard': '/api/student/dashboard',
      '/api/mobile/student/active-course': '/api/student/active-course',
      '/api/mobile/student/activities': '/api/student/activities',
      '/api/mobile/student/submissions': '/api/student/submissions',
      '/api/mobile/student/certificates': req.method === 'GET' ? '/api/certificates/mine' : '/api/certificates',
      '/api/mobile/student/opportunities': '/api/opportunities'
    };
    let pathname = mobileAliases[requestedPathname] || requestedPathname;
    pathname = pathname.replace(/^\/api\/mobile\/student\/opportunities\/([^/]+)\/toggle$/, '/api/opportunities/$1/toggle');

    if (req.method === 'OPTIONS') {
      return send(res, 204, '');
    }

    if (pathname === '/api/public/courses' && req.method === 'GET') {
      return send(res, 200, { courses: await listCourses() });
    }

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      return send(res, 403, { error: 'Cadastro público desativado. Alunos são cadastrados pelo Coordenador, e coordenadores, pelo Super Administrador.' });
    }



    if (pathname === '/api/auth/verify-2fa' && req.method === 'POST') {
      return send(res, 400, { error: 'Verificação em duas etapas não está habilitada nesta versão local do SIGAC.' });
    }

    if (pathname === '/api/me/two-factor' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, ['superadmin', 'coordenador', 'aluno']);
      if (!auth) return;
      return send(res, 200, {
        ok: true,
        user: auth.user,
        message: 'Configuração de verificação em duas etapas mantida como recurso demonstrativo nesta versão.'
      });
    }

    if ((requestedPathname === '/api/mobile/student/push-token' || pathname === '/api/mobile/student/push-token') && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, ['aluno']);
      if (!auth) return;
      return send(res, 200, { ok: true, message: 'Token mobile recebido para demonstração local.' });
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await parseBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const senha = String(body.senha || '');
      const row = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ? AND ativo = 1`).get(email);
      if (!row || !verifyPassword(senha, row.senha_hash)) {
        return send(res, 401, { error: 'E-mail ou senha incorretos.' });
      }
      const user = await serializeUser(row);
      const token = await createSession(user.id);
      return send(res, 200, { token, user, mustChangePassword: !!user.mustChangePassword });
    }

    if (pathname === '/api/auth/change-temporary-password' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, ['superadmin', 'coordenador', 'aluno'], { allowPasswordChange: true });
      if (!auth) return;
      const body = await parseBody(req);
      const senha = String(body.senha || '');
      const confirmar = String(body.confirmar || body.confirmarSenha || '');
      if (!senha) return send(res, 400, { error: 'Informe a nova senha.' });
      if (senha.length < 8) return send(res, 400, { error: 'A senha deve ter ao menos 8 caracteres.' });
      if (confirmar && senha !== confirmar) return send(res, 400, { error: 'As senhas não coincidem.' });
      await db.prepare('UPDATE users SET senha_hash = ?, must_change_password = 0, password_updated_at = ? WHERE id = ?')
        .run(hashPassword(senha), nowIso(), auth.user.id);
      await deleteUserSessions(auth.user.id);
      await addNotification(auth.user.id, 'Sua senha definitiva foi cadastrada com sucesso.', 'success');
      await logAudit(auth.user.id, 'alterou_senha_temporaria', 'user', auth.user.id, 'Primeiro acesso finalizado');
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = getToken(req, urlObj);
      if (token) await deleteSession(token);
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/auth/request-password-reset' && req.method === 'POST') {
      const body = await parseBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) {
        return send(res, 400, { error: 'Informe o e-mail para solicitar a senha temporária.' });
      }
      const row = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ? AND ativo = 1`).get(email);
      if (!row) {
        return send(res, 404, { error: 'E-mail não encontrado ou usuário inativo.' });
      }
      const temporaryPassword = generateTemporaryPassword();
      await db.prepare('UPDATE users SET senha_hash = ?, must_change_password = 1, password_updated_at = ?, temporary_password_issued_at = ? WHERE id = ?')
        .run(hashPassword(temporaryPassword), nowIso(), nowIso(), row.id);
      await deleteUserSessions(row.id);
      await addNotification(row.id, 'Uma senha temporária foi gerada. Use-a no login e cadastre uma nova senha no primeiro acesso.', 'warning');
      await logAudit(row.id, 'solicitou_senha_temporaria', 'user', row.id, 'Usuário solicitou senha temporária via esqueci senha');
      return send(res, 200, {
        ok: true,
        temporaryPassword,
        matricula: row.matricula || '',
        message: 'Senha temporária gerada com sucesso. Use-a no login e depois cadastre sua senha definitiva.'
      });
    }

    if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
      return send(res, 403, {
        error: 'Redefinição por token foi desativada. Use o fluxo de senha temporária gerada pelo administrador/coordenador.'
      });
    }

    if (pathname === '/api/me' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, ['superadmin', 'coordenador', 'aluno'], { allowPasswordChange: true });
      if (!auth) return;
      return send(res, 200, { user: auth.user });
    }

    if (pathname === '/api/courses' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, ['superadmin', 'coordenador', 'aluno']);
      if (!auth) return;
      if (auth.user.tipo === 'superadmin') return send(res, 200, { courses: await listCourses() });
      const courseIds = auth.user.tipo === 'coordenador'
        ? await getCoordinatorCourseIds(auth.user.id)
        : await getStudentCourseIds(auth.user.id);
      const courses = [];
      for (const courseId of courseIds) {
        const course = await getCourseById(courseId);
        if (course) courses.push(course);
      }
      return send(res, 200, { courses });
    }

    if (pathname === '/api/opportunities' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, ['superadmin', 'coordenador', 'aluno']);
      if (!auth) return;
      let opportunities = await listOpportunities();
      if (auth.user.tipo === 'aluno') {
        opportunities = opportunities.filter((item) => item.courseId === auth.user.courseId);
      } else if (auth.user.tipo === 'coordenador') {
        const allowed = new Set(await getCoordinatorCourseIds(auth.user.id));
        opportunities = opportunities.filter((item) => allowed.has(item.courseId));
      }
      return send(res, 200, { opportunities });
    }

    if (pathname === '/api/notifications/read' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, ['superadmin', 'coordenador', 'aluno']);
      if (!auth) return;
      await markNotificationsRead(auth.user.id);
      return send(res, 200, { ok: true });
    }

    if (pathname.match(/^\/api\/opportunities\/[^/]+\/toggle$/) && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, ['coordenador', 'aluno']);
      if (!auth) return;
      const opportunityId = pathname.split('/')[3];
      const current = (await listOpportunities()).find((item) => item.id === opportunityId);
      if (!current) return send(res, 404, { error: 'Oportunidade não encontrada.' });
      if (auth.user.tipo === 'aluno' && current.courseId !== auth.user.courseId) {
        return send(res, 403, { error: 'Esta oportunidade pertence a outro curso.' });
      }
      if (auth.user.tipo === 'coordenador' && !(await getCoordinatorCourseIds(auth.user.id)).includes(current.courseId)) {
        return send(res, 403, { error: 'Esta oportunidade está fora dos seus cursos vinculados.' });
      }
      const exists = await db.prepare('SELECT 1 FROM opportunity_registrations WHERE opportunity_id = ? AND user_id = ?').get(opportunityId, auth.user.id);
      if (exists) {
        await db.prepare('DELETE FROM opportunity_registrations WHERE opportunity_id = ? AND user_id = ?').run(opportunityId, auth.user.id);
        await addNotification(auth.user.id, `Você saiu da oportunidade ${current.titulo}.`, 'info');
      } else {
        await db.prepare('INSERT INTO opportunity_registrations (opportunity_id, user_id) VALUES (?, ?)').run(opportunityId, auth.user.id);
        await addNotification(auth.user.id, `Você se inscreveu na oportunidade ${current.titulo}.`, 'info');
      }
      return send(res, 200, { opportunity: (await listOpportunities()).find((item) => item.id === opportunityId) });
    }

    if (pathname.match(/^\/api\/activities\/[^/]+\/material$/) && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, ['superadmin', 'coordenador', 'aluno']);
      if (!auth) return;
      const activityId = pathname.split('/')[3];
      const activity = await getActivityById(activityId, { includeMaterialData: true });
      if (!activity) return send(res, 404, { error: 'Atividade não encontrada.' });
      if (!activity.materialArquivo) return send(res, 404, { error: 'Esta atividade não possui material anexado.' });

      let allowed = auth.user.tipo === 'superadmin';
      if (!allowed && auth.user.tipo === 'coordenador') {
        allowed = (await getCoordinatorCourseIds(auth.user.id)).includes(activity.courseId);
      }
      if (!allowed && auth.user.tipo === 'aluno') {
        allowed = [auth.user.courseId, ...(auth.user.courseIds || [])].filter(Boolean).includes(activity.courseId);
      }
      if (!allowed) return send(res, 403, { error: 'Você não pode acessar este material.' });

      sendDataUrlFile(req, res, activity.materialArquivo, activity.materialNome || 'material');
      return;
    }

    if (pathname === '/api/student/dashboard' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'aluno');
      if (!auth) return;
      const course = await getCourseById(auth.user.courseId);
      const studentCourses = [];
      for (const link of auth.user.courseLinks || []) {
        if (link.course) studentCourses.push({ ...link.course, matricula: link.matricula, vinculoId: link.id });
      }
      const progress = await getStudentProgress(auth.user.id, auth.user.courseId);
      const categoryProgress = await getStudentCategoryProgress(auth.user.id, auth.user.courseId);
      const submissions = await listSubmissionsForStudent(auth.user.id, { includeFileData: false, includeActivity: true, courseId: auth.user.courseId });
      const certificates = await listCertificatesForUser(auth.user.id, auth.user.courseId);
      const opportunities = (await listOpportunities()).filter((item) => item.courseId === auth.user.courseId);
      const notifications = await getNotificationsForUser(auth.user.id);
      await markNotificationsRead(auth.user.id);
      return send(res, 200, { user: auth.user, course, courses: studentCourses, progress, categoryProgress, submissions, certificates, opportunities, notifications });
    }

    if (pathname === '/api/student/active-course' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'aluno');
      if (!auth) return;
      const body = await parseBody(req);
      const courseId = String(body.courseId || '').trim();
      const link = (auth.user.courseLinks || []).find((item) => item.courseId === courseId);
      if (!link) return send(res, 403, { error: 'Curso não vinculado a este aluno.' });
      await db.prepare('UPDATE users SET course_id = ? WHERE id = ?').run(courseId, auth.user.id);
      await logAudit(auth.user.id, 'alternou_curso_ativo', 'student_course', courseId, `Aluno alterou curso ativo para ${courseId}`);
      return send(res, 200, { user: await getUserById(auth.user.id), course: await getCourseById(courseId), activeLink: link });
    }

    if (pathname === '/api/student/chat' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'aluno');
      if (!auth) return;
      await db.prepare('UPDATE coordination_messages SET read_by_student = 1 WHERE student_id = ? AND sender_id <> ?')
        .run(auth.user.id, auth.user.id);
      return send(res, 200, { messages: await listStudentChatMessages(auth.user.id) });
    }

    if (pathname === '/api/student/chat' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'aluno');
      if (!auth) return;
      const body = await parseBody(req);
      const message = String(body.message || '').trim();
      if (!message) return send(res, 400, { error: 'Digite uma mensagem para a coordenação.' });
      if (message.length > 2000) return send(res, 400, { error: 'A mensagem deve ter até 2000 caracteres.' });
      const courseId = auth.user.courseId || (auth.user.courseIds || [])[0] || null;
      const id = uid('chat');
      await db.prepare(`INSERT INTO coordination_messages
        (id, student_id, coordinator_id, course_id, sender_id, message, created_at, read_by_student, read_by_coord)
        VALUES (?, ?, NULL, ?, ?, ?, ?, 1, 0)`)
        .run(id, auth.user.id, courseId, auth.user.id, message, nowIso());
      if (courseId) {
        const coordinators = await db.prepare(`SELECT users.id, users.nome, users.email, users.senha_hash, users.tipo, users.ativo,
                                                      users.course_id, users.matricula, users.must_change_password,
                                                      users.password_updated_at, users.temporary_password_issued_at,
                                                      users.created_at, users.telefone, users.cpf, users.endereco,
                                                      users.data_nascimento, users.curso_interesse FROM users
                                               JOIN coordinator_courses cc ON cc.user_id = users.id
                                               WHERE users.tipo = 'coordenador' AND users.ativo = 1 AND cc.course_id = ?`).all(courseId);
        for (const coordinator of coordinators) {
          await addNotification(coordinator.id, `Nova mensagem de ${auth.user.nome} no chat da coordenação.`, 'info');
        }
      }
      await logAudit(auth.user.id, 'enviou_chat_coordenacao', 'coordination_message', id, message.slice(0, 160));
      return send(res, 201, { messages: await listStudentChatMessages(auth.user.id) });
    }

    if (pathname === '/api/certificates/mine' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, ['coordenador', 'aluno']);
      if (!auth) return;
      return send(res, 200, { certificates: await listCertificatesForUser(auth.user.id, auth.user.tipo === 'aluno' ? auth.user.courseId : '') });
    }

    if (pathname === '/api/certificates' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, ['coordenador', 'aluno']);
      if (!auth) return;
      const body = await parseBody(req);
      const batchFiles = Array.isArray(body.files)
        ? body.files
        : [{ fileName: body.fileName, fileData: body.fileData, observation: body.observation, declaredHours: body.declaredHours, category: body.category }];
      {
        const baseObservation = String(body.observation || '').trim();
        const baseCategory = String(body.category || '').trim();
        const baseDeclaredHours = Number(body.declaredHours || 0) || 0;
        if (!batchFiles.length || batchFiles.length > MAX_CERTIFICATES_PER_BATCH) {
          return send(res, 400, { error: `Voce pode enviar no maximo ${MAX_CERTIFICATES_PER_BATCH} certificados por vez.` });
        }

        const normalizedFiles = batchFiles.map((item) => ({
          fileName: String(item?.fileName || '').trim(),
          fileData: String(item?.fileData || '').trim(),
          category: String(item?.category ?? baseCategory).trim(),
          observation: String(item?.observation ?? baseObservation).trim(),
          declaredHours: Number(item?.declaredHours ?? baseDeclaredHours) || 0
        }));

        if (normalizedFiles.some((item) => !item.fileName || !item.fileData)) {
          return send(res, 400, { error: 'Selecione um certificado antes de enviar.' });
        }

        for (const item of normalizedFiles) {
          const certificateFile = validateDataUrl(item.fileData, ALLOWED_CERTIFICATE_TYPES);
          if (!certificateFile.ok) return send(res, 400, { error: `${certificateFile.error} Envie certificado em PDF, PNG, JPG ou JPEG.` });
        }

        const createdCertificates = [];
        const batchCreatedAt = nowIso();
        const activeLink = auth.user.tipo === 'aluno'
          ? (auth.user.courseLinks || []).find((link) => link.courseId === auth.user.courseId)
          : null;
        const certificateCourseId = activeLink?.courseId || '';
        const certificateVinculoId = activeLink?.id || '';
        const certificateMatricula = activeLink?.matricula || '';
        for (const item of normalizedFiles) {
          const certificateId = uid('cert');
          await db.prepare(`INSERT INTO certificates (
                              id, sender_id, sender_type, course_id, vinculo_id, matricula, category, file_name, file_data, observation, declared_hours,
                              extracted_text, detected_hours, detected_name, detected_institution, detected_date,
                              detected_title, detected_course_name, found_fields, missing_fields, confidence_score,
                              human_summary, ocr_status, ocr_reason, admin_status, admin_feedback, approved_hours,
                              created_at, reviewed_at, reviewed_by, ocr_processed_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 0, '', '', '', '', '', '[]', '[]', 0, '', 'nao_processado',
                                      'Aguardando analise do admin.', 'pendente', '', 0, ?, '', NULL, '')`)
            .run(
              certificateId,
              auth.user.id,
              auth.user.tipo,
              certificateCourseId,
              certificateVinculoId,
              certificateMatricula,
              item.category,
              item.fileName,
              item.fileData,
              item.observation,
              item.declaredHours,
              batchCreatedAt
            );
          createdCertificates.push(await getCertificateById(certificateId));
        }

        const admins = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE tipo = 'superadmin' AND ativo = 1 ORDER BY nome`).all();
        const total = createdCertificates.length;
        const firstFileName = createdCertificates[0]?.fileName || 'certificado';
        for (const adminRow of admins) {
          await addNotification(adminRow.id, `${auth.user.nome} enviou ${total} certificado(s) para validacao.`, 'warning');
          await queueEmail(adminRow.email, 'SIGAC - novo certificado enviado', `${auth.user.nome} enviou ${total} certificado(s) para analise. Primeiro arquivo: ${firstFileName}.`, 'certificado');
        }
        await addNotification(auth.user.id, `${total} certificado(s) foram enviados e aguardam analise.`, 'info');
        return send(res, 201, { certificate: createdCertificates[0], certificates: createdCertificates });
      }
    }

    if (pathname === '/api/student/activities' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'aluno');
      if (!auth) return;
      const activities = await listActivitiesWithStudentSubmissions(auth.user.id, auth.user.courseId, { includeFileData: false });
      return send(res, 200, { activities });
    }

    if (pathname === '/api/student/submissions' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'aluno');
      if (!auth) return;
      const body = await parseBody(req);
      const activityId = String(body.activityId || '').trim();
      const arquivoNome = String(body.arquivoNome || '').trim();
      const arquivoData = String(body.arquivoData || '').trim();
      const observacao = String(body.observacao || '').trim();
      const categoria = String(body.categoria || '').trim();
      const descricao = String(body.descricao || '').trim();
      const horasDeclaradas = Number(body.horasDeclaradas || 0) || 0;
      if (!activityId || !categoria || !descricao || !horasDeclaradas) {
        return send(res, 400, { error: 'Preencha categoria, carga horária e descrição antes do envio.' });
      }
      if (!arquivoNome || !arquivoData) return send(res, 400, { error: 'Selecione um arquivo antes de enviar.' });
      const proofFile = validateDataUrl(arquivoData);
      if (!proofFile.ok) return send(res, 400, { error: proofFile.error });
      const activity = await getActivityById(activityId);
      if (!activity || activity.courseId !== auth.user.courseId) return send(res, 400, { error: 'Atividade inválida para este aluno.' });
      let submission = await getStudentSubmissionForActivity(auth.user.id, activityId);
      const latest = getLatestVersion(submission);
      if (latest && latest.status === 'em_analise') return send(res, 400, { error: 'Seu último envio ainda está em análise.' });
      if (latest && latest.status === 'aprovado') return send(res, 400, { error: 'Esta atividade já foi aprovada.' });
      const versionNumber = latest ? latest.version + 1 : 1;
      if (!submission) {
        const submissionId = uid('sub');
        await db.prepare('INSERT INTO submissions (id, activity_id, student_id, current_status) VALUES (?, ?, ?, ?)').run(submissionId, activityId, auth.user.id, 'em_analise');
        submission = { id: submissionId };
      }
      await db.prepare(`INSERT INTO submission_versions
                          (submission_id, version, arquivo_nome, arquivo_data, observacao, categoria, horas_declaradas, descricao, status, feedback, enviada_em, avaliada_em)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'em_analise', '', ?, '')`)
        .run(submission.id, versionNumber, arquivoNome, arquivoData, observacao, categoria, horasDeclaradas, descricao, nowIso());
      await db.prepare('UPDATE submissions SET current_status = ? WHERE id = ?').run('em_analise', submission.id);
      await logAudit(auth.user.id, 'enviou_solicitacao', 'submission', submission.id, `${categoria} - ${horasDeclaradas} h declaradas`);
      const coordinators = await db.prepare(`SELECT users.id, users.nome, users.email, users.senha_hash, users.tipo, users.ativo,
                                                    users.course_id, users.matricula, users.must_change_password,
                                                    users.password_updated_at, users.temporary_password_issued_at,
                                                    users.created_at, users.telefone, users.cpf, users.endereco,
                                                    users.data_nascimento, users.curso_interesse FROM users
                                             JOIN coordinator_courses cc ON cc.user_id = users.id
                                             WHERE users.tipo = 'coordenador' AND users.ativo = 1 AND cc.course_id = ?`).all(activity.courseId);
      for (const coordRow of coordinators) {
        await addNotification(coordRow.id, `${auth.user.nome} enviou um arquivo para a atividade ${activity.titulo}.`, 'warning');
        await queueEmail(coordRow.email, 'SIGAC - novo envio para análise', `${auth.user.nome} enviou um novo arquivo na atividade ${activity.titulo}.`, 'envio');
      }
      await addNotification(auth.user.id, `Seu arquivo da atividade ${activity.titulo} foi enviado para análise.`, 'info');
      await queueEmail(auth.user.email, 'SIGAC - envio recebido', `Recebemos seu envio da atividade ${activity.titulo}. A coordenação fará a análise e você será avisado pelo SIGAC.`, 'confirmacao-envio-aluno');
      return send(res, 200, { submission: await getSubmissionById(submission.id) });
    }

    if (requestedPathname.match(/^\/api\/mobile\/student\/submissions\/[^/]+\/file$/) && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'aluno');
      if (!auth) return;
      const submissionId = requestedPathname.split('/')[5];
      const row = await db.prepare(`
        SELECT v.arquivo_nome, v.arquivo_data
        FROM submissions s
        JOIN LATERAL (
          SELECT arquivo_nome, arquivo_data
          FROM submission_versions
          WHERE submission_id = s.id
          ORDER BY version DESC
          LIMIT 1
        ) v ON TRUE
        WHERE s.id = ? AND s.student_id = ?
        LIMIT 1
      `).get(submissionId, auth.user.id);
      if (!row) return send(res, 404, { error: 'Envio não encontrado.' });
      if (!row.arquivo_data) return send(res, 404, { error: 'Arquivo do envio não encontrado.' });
      sendDataUrlFile(req, res, row.arquivo_data, row.arquivo_nome || 'comprovante');
      return;
    }

    if (pathname.match(/^\/api\/certificates\/[^/]+\/file$/) && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, ['coordenador', 'aluno']);
      if (!auth) return;
      const certificateId = pathname.split('/')[3];
      const certificate = await getCertificateById(certificateId);
      if (!certificate) return send(res, 404, { error: 'Certificado não encontrado.' });
      if (certificate.senderId !== auth.user.id) return send(res, 403, { error: 'Você não pode acessar este certificado.' });
      sendDataUrlFile(req, res, certificate.fileData, certificate.fileName || 'certificado');
      return;
    }

    if (pathname === '/api/coordinator/dashboard' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const dashboard = await cachedRead(`coordinator-dashboard:${auth.user.id}:${urlObj.search}`, () => getCoordinatorDashboardData(auth.user.id));
      return send(res, 200, { user: auth.user, dashboard, courses: dashboard.courses || [] });
    }

    if (pathname === '/api/coordinator/dashboard/summary' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const dashboard = await cachedRead(`coordinator-dashboard-summary:${auth.user.id}:${urlObj.search}`, () => getCoordinatorDashboardSummary(auth.user.id));
      return send(res, 200, { user: auth.user, dashboard, courses: dashboard.courses || [] });
    }

    if (pathname === '/api/coordinator/students' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      return send(res, 200, { students: await listCoordinatorStudents(auth.user.id) });
    }

    if (pathname === '/api/coordinator/chat' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const coordinatorCourseIds = await getCoordinatorCourseIds(auth.user.id);
      if (coordinatorCourseIds.length) {
        await db.prepare(`UPDATE coordination_messages
                          SET read_by_coord = 1
                          WHERE sender_id <> ? AND course_id = ANY(?::text[])`)
          .run(auth.user.id, coordinatorCourseIds);
      }
      return send(res, 200, { messages: await listCoordinatorChatMessages(auth.user.id) });
    }

    if (pathname === '/api/coordinator/chat' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const body = await parseBody(req);
      const studentId = String(body.studentId || '').trim();
      const message = String(body.message || '').trim();
      if (!studentId || !message) return send(res, 400, { error: 'Selecione o aluno e digite uma mensagem.' });
      if (message.length > 2000) return send(res, 400, { error: 'A mensagem deve ter até 2000 caracteres.' });

      const coordinatorCourseIds = await getCoordinatorCourseIds(auth.user.id);
      const studentCourseIds = await getStudentCourseIds(studentId);
      const courseId = studentCourseIds.find((id) => coordinatorCourseIds.includes(id));
      if (!courseId) return send(res, 403, { error: 'Aluno não vinculado aos seus cursos.' });
      const student = await getUserById(studentId);
      if (!student || student.tipo !== 'aluno') return send(res, 404, { error: 'Aluno não encontrado.' });

      const id = uid('chat');
      await db.prepare(`INSERT INTO coordination_messages
        (id, student_id, coordinator_id, course_id, sender_id, message, created_at, read_by_student, read_by_coord)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)`)
        .run(id, studentId, auth.user.id, courseId, auth.user.id, message, nowIso());
      await addNotification(studentId, `Nova mensagem da coordenação: ${message.slice(0, 120)}`, 'info');
      await logAudit(auth.user.id, 'respondeu_chat_aluno', 'coordination_message', id, `${student.nome}: ${message.slice(0, 160)}`);
      return send(res, 201, { messages: await listCoordinatorChatMessages(auth.user.id) });
    }

    if (pathname === '/api/coordinator/submissions' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      return send(res, 200, { submissions: await listSubmissionsForCoordinator(auth.user.id) });
    }

    if (pathname === '/api/coordinator/activities' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      return send(res, 200, { activities: await listActivitiesForCoordinator(auth.user.id) });
    }

    if (pathname === '/api/coordinator/rules' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      return send(res, 200, { rules: await listActivityRulesForCourses(await getCoordinatorCourseIds(auth.user.id)) });
    }

    if (pathname === '/api/coordinator/certificates' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      return send(res, 200, { certificates: await listCertificatesForCoordinator(auth.user.id) });
    }

    if (pathname === '/api/coordinator/activities' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const body = await parseBody(req);
      const courseId = String(body.courseId || '').trim();
      if (!(await getCoordinatorCourseIds(auth.user.id)).includes(courseId)) return send(res, 400, { error: 'Você só pode publicar para seus cursos.' });
      if (!body.titulo || !body.descricao || !courseId || !body.horas) return send(res, 400, { error: 'Preencha título, descrição, curso e horas.' });
      const activity = {
        id: uid('activity'),
        titulo: String(body.titulo).trim(),
        descricao: String(body.descricao).trim(),
        courseId,
        horas: Number(body.horas || 0),
        prazo: String(body.prazo || '').trim(),
        materialNome: String(body.materialNome || '').trim(),
        materialArquivo: String(body.materialArquivo || '').trim(),
        createdBy: auth.user.id,
        createdAt: nowIso()
      };
      if (activity.materialArquivo) {
        const materialFile = validateDataUrl(activity.materialArquivo);
        if (!materialFile.ok) return send(res, 400, { error: materialFile.error });
      }
      await db.prepare(`INSERT INTO activities (id, titulo, descricao, course_id, horas, prazo, material_nome, material_arquivo, created_by, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(activity.id, activity.titulo, activity.descricao, activity.courseId, activity.horas, activity.prazo, activity.materialNome, activity.materialArquivo, activity.createdBy, activity.createdAt);
      const students = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE tipo = ? AND ativo = 1 AND course_id = ?`).all('aluno', courseId);
      for (const row of students) {
        await addNotification(row.id, `Nova atividade publicada: ${activity.titulo}.`, 'info');
        await queueEmail(row.email, 'SIGAC - nova atividade', `Foi publicada uma nova atividade para o seu curso: ${activity.titulo}.`, 'atividade');
      }
      return send(res, 200, { activity });
    }

    if (pathname === '/api/coordinator/rules' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const body = await parseBody(req);
      const courseId = String(body.courseId || '').trim();
      const categoria = String(body.categoria || '').trim();
      const limiteMaximo = Number(body.limiteMaximo || 0) || 0;
      const cargaMinima = Number(body.cargaMinima || 0) || 0;
      const exigeCertificado = body.exigeCertificado ? 1 : 0;
      const exigeAprovacao = body.exigeAprovacao ? 1 : 0;
      const coordinatorCourses = await getCoordinatorCourseIds(auth.user.id);
      if (!coordinatorCourses.includes(courseId)) {
        return send(res, 403, { error: 'Você só pode configurar regras dos seus cursos.' });
      }
      if (!categoria || !limiteMaximo) {
        return send(res, 400, { error: 'Informe categoria e limite máximo.' });
      }
      const id = uid('rule');
      await db.prepare(`INSERT INTO activity_rules
                          (id, course_id, categoria, limite_maximo, carga_minima, exige_certificado, exige_aprovacao, created_by, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, courseId, categoria, limiteMaximo, cargaMinima, exigeCertificado, exigeAprovacao, auth.user.id, nowIso());
      await logAudit(auth.user.id, 'criou_regra_coordenador', 'activity_rule', id, `${categoria} - ${limiteMaximo} h`);
      return send(res, 200, { rules: await listActivityRulesForCourses(coordinatorCourses) });
    }

    if (pathname === '/api/coordinator/students' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const body = await parseBody(req);
      const nome = String(body.nome || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const senhaInformada = String(body.senha || '').trim();
      const courseId = String(body.courseId || '').trim();
      const profile = normalizeStudentProfilePayload(body);
      const coordinatorCourses = await getCoordinatorCourseIds(auth.user.id);

      if (!nome || !email || !courseId) {
        return send(res, 400, { error: 'Preencha nome, e-mail e curso.' });
      }
      if (senhaInformada && senhaInformada.length < 8) {
        return send(res, 400, { error: 'A senha deve ter ao menos 8 caracteres.' });
      }
      if (!coordinatorCourses.includes(courseId)) {
        return send(res, 403, { error: 'Você só pode cadastrar alunos nos seus cursos.' });
      }
      const exists = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`).get(email);
      if (exists) {
        if (exists.tipo !== 'aluno') return send(res, 409, { error: 'Este e-mail ja esta cadastrado para outro perfil.' });
        const currentLinks = await getStudentCourseLinks(exists.id);
        if (currentLinks.some((link) => link.courseId === courseId)) return send(res, 409, { error: 'Este aluno ja esta vinculado a este curso.' });
        if (currentLinks.length >= 2) return send(res, 400, { error: 'Este aluno ja possui o limite de 2 cursos vinculados.' });
        const linkMatricula = await generateMatricula('aluno', courseId);
        await db.prepare('INSERT INTO student_courses (user_id, course_id, matricula) VALUES (?, ?, ?) ON CONFLICT (user_id, course_id) DO UPDATE SET matricula = EXCLUDED.matricula, ativo = 1')
          .run(exists.id, courseId, linkMatricula);
        if (!exists.course_id) await db.prepare('UPDATE users SET course_id = ? WHERE id = ?').run(courseId, exists.id);
        const course = await getCourseById(courseId);
        await addNotification(exists.id, `Voce foi vinculado ao curso ${course?.sigla || courseId}.`, 'info');
        await queueEmail(email, 'SIGAC - novo vinculo de curso', `Ola, ${exists.nome}. Voce foi vinculado ao curso ${course?.sigla || courseId} no SIGAC.`, 'vinculo-curso');
        await logAudit(auth.user.id, 'vinculou_aluno_existente', 'student_course', exists.id, `${exists.nome} em ${course?.sigla || courseId}`);
        return send(res, 200, { user: await getUserById(exists.id), matricula: linkMatricula });
      }
      const id = uid('user');
      const temporaryPassword = senhaInformada || generateTemporaryPassword();
      const matricula = await generateMatricula('aluno', courseId);
      const isActive = body.ativo === false || body.ativo === '0' || body.ativo === 0 ? 0 : 1;
      await db.prepare(`INSERT INTO users
        (id, nome, email, senha_hash, tipo, ativo, course_id, matricula, must_change_password,
         password_updated_at, temporary_password_issued_at, created_at, telefone, cpf, endereco, data_nascimento, curso_interesse)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          id, nome, email, hashPassword(temporaryPassword), 'aluno', isActive, courseId, matricula,
          nowIso(), nowIso(), nowIso(), profile.telefone, profile.cpf, profile.endereco,
          profile.dataNascimento, profile.cursoInteresse
        );
      await db.prepare('INSERT INTO student_courses (user_id, course_id, matricula) VALUES (?, ?, ?) ON CONFLICT (user_id, course_id) DO UPDATE SET matricula = EXCLUDED.matricula, ativo = 1')
        .run(id, courseId, matricula);
      const course = await getCourseById(courseId);
      await addNotification(id, `Seu acesso ao SIGAC foi criado e vinculado ao curso ${course?.sigla || courseId}.`, 'info');
      await queueEmail(email, 'SIGAC - acesso de Aluno criado', `Olá, ${nome}. Seu acesso ao SIGAC foi criado pelo coordenador ${auth.user.nome}.`, 'boas-vindas');
      await logAudit(auth.user.id, 'criou_aluno', 'user', id, `${nome} em ${course?.sigla || courseId}`);
      return send(res, 201, { user: await getUserById(id), temporaryPassword, matricula });
    }

    if (pathname.match(/^\/api\/coordinator\/submissions\/[^/]+\/evaluate$/) && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const submissionId = pathname.split('/')[4];
      const body = await parseBody(req);
      const status = body.status === 'aprovado' ? 'aprovado' : 'rejeitado';
      const feedback = String(body.feedback || '').trim();
      const submission = await getSubmissionById(submissionId);
      if (!submission) return send(res, 404, { error: 'Envio não encontrado.' });
      const activity = await getActivityById(submission.activityId);
      if (!activity || !(await getCoordinatorCourseIds(auth.user.id)).includes(activity.courseId)) {
        return send(res, 403, { error: 'Você não pode avaliar este envio.' });
      }
      const latest = getLatestVersion(submission);
      if (!latest || latest.status !== 'em_analise') return send(res, 400, { error: 'Este envio não está pendente.' });
      await db.prepare('UPDATE submission_versions SET status = ?, feedback = ?, avaliada_em = ? WHERE id = ?')
        .run(status, feedback, nowIso(), latest.id);
      await db.prepare('UPDATE submissions SET current_status = ? WHERE id = ?').run(status, submissionId);
      await logAudit(auth.user.id, status === 'aprovado' ? 'aprovou_envio' : 'rejeitou_envio', 'submission', submissionId, feedback);
      const student = await getUserById(submission.studentId);
      const human = status === 'aprovado' ? 'aprovado' : 'rejeitado';
      await addNotification(student.id, `Seu envio da atividade ${activity.titulo} foi ${human}.`, status === 'aprovado' ? 'success' : 'warning');
      await queueEmail(student.email, `SIGAC - envio ${human}`, `Sua atividade ${activity.titulo} foi ${human}. Feedback: ${feedback || 'Sem observações.'}`, 'avaliação');
      return send(res, 200, { submission: await getSubmissionById(submissionId) });
    }

    if (pathname.match(/^\/api\/coordinator\/submissions\/[^/]+\/file$/) && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const submissionId = pathname.split('/')[4];
      const row = await db.prepare(`
        SELECT
          v.arquivo_nome,
          v.arquivo_data
        FROM submissions s
        JOIN activities a ON a.id = s.activity_id
        JOIN coordinator_courses cc ON cc.course_id = a.course_id AND cc.user_id = ?
        LEFT JOIN LATERAL (
          SELECT arquivo_nome, arquivo_data
          FROM submission_versions
          WHERE submission_id = s.id
          ORDER BY version DESC
          LIMIT 1
        ) v ON TRUE
        WHERE s.id = ?
        LIMIT 1
      `).get(auth.user.id, submissionId);
      if (!row) return send(res, 404, { error: 'Envio não encontrado.' });
      if (!row.arquivo_data) return send(res, 404, { error: 'Arquivo do envio não encontrado.' });
      sendDataUrlFile(req, res, row.arquivo_data, row.arquivo_nome || 'comprovante');
      return;
    }

    if (pathname.match(/^\/api\/coordinator\/certificates\/[^/]+\/file$/) && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const certificateId = pathname.split('/')[4];
      const certificate = await getCertificateById(certificateId);
      if (!certificate) return send(res, 404, { error: 'Certificado não encontrado.' });
      if (!(await coordinatorCanAccessCertificate(auth.user.id, certificate))) {
        return send(res, 403, { error: 'Você não pode acessar este certificado.' });
      }

      const match = String(certificate.fileData || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/);
      if (!match) return send(res, 400, { error: 'Arquivo inválido.' });
      const isBase64 = !!match[2];
      const raw = isBase64 ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'utf8');
      res.writeHead(200, {
        'Content-Type': match[1] || 'application/octet-stream',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(certificate.fileName || 'certificado')}`, 
        'Cache-Control': 'private, max-age=300',
        ...getCorsHeaders(req)
      });
      return res.end(raw);
    }

    if (pathname.match(/^\/api\/coordinator\/certificates\/[^/]+\/data$/) && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const certificateId = pathname.split('/')[4];
      const certificate = await getCertificateById(certificateId);
      if (!certificate) return send(res, 404, { error: 'Certificado não encontrado.' });
      if (!(await coordinatorCanAccessCertificate(auth.user.id, certificate))) {
        return send(res, 403, { error: 'Você não pode acessar este certificado.' });
      }
      return send(res, 200, {
        id: certificate.id,
        fileName: certificate.fileName,
        fileData: certificate.fileData
      });
    }

    if (pathname.match(/^\/api\/coordinator\/certificates\/[^/]+$/) && req.method === 'DELETE') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const certificateId = pathname.split('/')[4];
      const certificate = await getCertificateById(certificateId);
      if (!certificate) return send(res, 404, { error: 'Certificado não encontrado.' });
      if (!(await coordinatorCanAccessCertificate(auth.user.id, certificate))) {
        return send(res, 403, { error: 'Certificado fora dos cursos vinculados a este coordenador.' });
      }
      await db.prepare(`UPDATE certificates
                        SET admin_status = 'removido', admin_feedback = ?, reviewed_at = ?, reviewed_by = ?, approved_hours = 0
                        WHERE id = ?`)
        .run('Certificado removido da contagem do lote. O arquivo permanece no histórico para rastreabilidade.', nowIso(), auth.user.id, certificateId);
      await logAudit(auth.user.id, 'removeu_certificado_contagem_coordenador', 'certificate', certificateId, certificate.fileName);
      if (certificate.senderId) {
        await addNotification(certificate.senderId, `Seu certificado ${certificate.fileName} foi removido da contagem do lote e mantido no histórico.`, 'warning');
      }
      return send(res, 200, { ok: true });
    }

    if (pathname.match(/^\/api\/coordinator\/certificates\/[^/]+\/review$/) && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const certificateId = pathname.split('/')[4];
      const body = await parseBody(req);
      const certificate = await getCertificateById(certificateId);
      if (!certificate) return send(res, 404, { error: 'Certificado não encontrado.' });
      if (!(await coordinatorCanAccessCertificate(auth.user.id, certificate))) {
        return send(res, 403, { error: 'Você não pode avaliar este certificado.' });
      }

      const finalStatus = body.status === 'aprovado' ? 'aprovado' : 'rejeitado';
      const feedback = String(body.feedback || '').trim()
        || (finalStatus === 'rejeitado'
          ? `Seu certificado '${certificate.fileName}' não foi aceito por não atender aos critérios de validação estabelecidos.`
          : '');
      const hourBreakdown = finalStatus === 'aprovado' ? await calculateCertificateHourBreakdown(certificate) : null;
      const approvedHours = finalStatus === 'aprovado' ? hourBreakdown.approvedHours : 0;
      await db.prepare(`UPDATE certificates
                        SET admin_status = ?, admin_feedback = ?, reviewed_at = ?, reviewed_by = ?, approved_hours = ?
                        WHERE id = ?`)
        .run(finalStatus, feedback, nowIso(), auth.user.id, approvedHours, certificateId);
      await logAudit(auth.user.id, finalStatus === 'aprovado' ? 'aprovou_certificado_coordenador' : 'rejeitou_certificado_coordenador', 'certificate', certificateId, feedback);

      const updated = await getCertificateById(certificateId);
      const human = finalStatus === 'aprovado' ? 'aprovado' : 'rejeitado';
      if (updated.sender?.id) {
        await addNotification(updated.sender.id, `Seu certificado ${updated.fileName} foi ${human} pelo coordenador ${auth.user.nome}.`, finalStatus === 'aprovado' ? 'success' : 'warning');
      }
      if (updated.sender?.email) {
        await queueEmail(updated.sender.email, `SIGAC - certificado ${human}`, `O certificado ${updated.fileName} foi ${human}. Feedback: ${feedback || 'Sem observações.'}`, 'certificado-avaliação');
      }
      return send(res, 200, { certificate: updated });
    }

    if (pathname.match(/^\/api\/coordinator\/certificates\/[^/]+\/ocr$/) && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const certificateId = pathname.split('/')[4];
      const body = await parseBody(req);
      const current = await getCertificateById(certificateId);
      if (!current) return send(res, 404, { error: 'Certificado não encontrado.' });
      if (!(await coordinatorCanAccessCertificate(auth.user.id, current))) {
        return send(res, 403, { error: 'Você não pode processar este certificado.' });
      }

      const result = body && typeof body === 'object' ? body : {};
      const detectedHours = Number(result.detectedHours || 0) || 0;
      const foundFields = Array.isArray(result.foundFields) ? result.foundFields.filter(Boolean) : [];
      const missingFields = Array.isArray(result.missingFields) ? result.missingFields.filter(Boolean) : [];
      const ocrStatus = String(result.ocrStatus || 'analise_manual').trim() || 'analise_manual';
      const updatedForCalculation = {
        ...current,
        detectedHours,
        detectedTitle: String(result.detectedTitle || '').trim(),
        detectedCourseName: String(result.detectedCourseName || '').trim(),
        ocrStatus
      };
      const approvedHours = current.adminStatus === 'aprovado'
        ? (await calculateCertificateHourBreakdown(updatedForCalculation)).approvedHours
        : 0;

      await db.prepare(`UPDATE certificates
                        SET extracted_text = ?, detected_hours = ?, detected_name = ?, detected_institution = ?,
                            detected_date = ?, detected_title = ?, detected_course_name = ?, found_fields = ?,
                            missing_fields = ?, confidence_score = ?, human_summary = ?, ocr_status = ?,
                            ocr_reason = ?, approved_hours = ?, ocr_processed_at = ?
                        WHERE id = ?`)
        .run(
          String(result.extractedText || '').trim(),
          detectedHours,
          String(result.detectedName || '').trim(),
          String(result.detectedInstitution || '').trim(),
          String(result.detectedDate || '').trim(),
          String(result.detectedTitle || '').trim(),
          String(result.detectedCourseName || '').trim(),
          JSON.stringify(foundFields),
          JSON.stringify(missingFields),
          Number(result.confidenceScore || 0) || 0,
          String(result.humanSummary || '').trim(),
          ocrStatus,
          String(result.ocrReason || 'Pr\u00e9-an\u00e1lise conclu\u00edda.').trim(),
          approvedHours,
          nowIso(),
          certificateId
        );

      if (current.senderId) {
        await addNotification(current.senderId, 'O OCR concluiu a pré-análise do seu certificado.', 'info');
      }
      await logAudit(auth.user.id, 'processou_ocr_certificado_coordenador', 'certificate', certificateId, ocrStatus);
      return send(res, 200, { certificate: await getCertificateById(certificateId) });
    }


    // ===== INÍCIO ADIÇÃO ML SIGAC: rotas da API para executar e consultar Machine Learning =====
    // ML - dataset real usado pelo pipeline Python.
    // Esta rota exporta todos os vínculos e suas fontes acadêmicas para o módulo de Machine Learning.
    if (pathname === '/api/ml/dataset' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, ['superadmin', 'coordenador']);
      if (!auth) return;

      const coordinatorFilter = auth.user.tipo === 'coordenador'
        ? `AND EXISTS (
            SELECT 1
            FROM coordinator_courses cc
            WHERE cc.user_id = $1
              AND cc.course_id = sc.course_id
          )`
        : '';
      const params = auth.user.tipo === 'coordenador' ? [auth.user.id] : [];
      const defaultTarget = Number(await getSetting('horasMetaPadrao', '0') || 0);

      const rows = await db.prepare(`
        WITH academic_sources AS (
          SELECT
            cert.sender_id AS aluno_id,
            cert.course_id,
            COALESCE(NULLIF(cert.detected_title, ''), NULLIF(cert.detected_course_name, ''), 'Certificado') AS categoria,
            CASE
              WHEN cert.admin_status = 'aprovado' THEN GREATEST(COALESCE(cert.approved_hours, 0), 0)
              ELSE 0
            END AS carga_horaria,
            CASE
              WHEN cert.admin_status IN ('removido', 'removido_da_contagem') THEN 'removido'
              WHEN cert.admin_status = 'aprovado' THEN 'aprovado'
              WHEN cert.admin_status = 'rejeitado' THEN 'rejeitado'
              ELSE 'em_analise'
            END AS status,
            cert.created_at AS data_envio,
            COALESCE(NULLIF(cert.admin_feedback, ''), NULLIF(cert.ocr_reason, ''), '') AS feedback
          FROM certificates cert
          WHERE cert.sender_type = 'aluno'

          UNION ALL

          SELECT
            s.student_id AS aluno_id,
            a.course_id,
            COALESCE(NULLIF(v.categoria, ''), NULLIF(a.titulo, ''), 'Atividade') AS categoria,
            CASE WHEN COALESCE(v.status, s.current_status) = 'aprovado' THEN GREATEST(COALESCE(a.horas, 0), 0) ELSE 0 END AS carga_horaria,
            COALESCE(v.status, s.current_status, 'em_analise') AS status,
            v.enviada_em AS data_envio,
            COALESCE(v.feedback, '') AS feedback
          FROM submissions s
          JOIN activities a ON a.id = s.activity_id
          LEFT JOIN LATERAL (
            SELECT categoria, status, enviada_em, feedback
            FROM submission_versions
            WHERE submission_id = s.id
            ORDER BY version DESC
            LIMIT 1
          ) v ON TRUE

          UNION ALL

          SELECT
            registration.user_id AS aluno_id,
            opportunity.course_id,
            COALESCE(NULLIF(opportunity.categoria, ''), 'Oportunidade') AS categoria,
            GREATEST(COALESCE(opportunity.horas, 0), 0) AS carga_horaria,
            'aprovado' AS status,
            opportunity.criado_em AS data_envio,
            'Inscrição confirmada em oportunidade' AS feedback
          FROM opportunity_registrations registration
          JOIN opportunities opportunity ON opportunity.id = registration.opportunity_id
          JOIN student_courses sc ON sc.user_id = registration.user_id AND sc.ativo = 1 AND sc.course_id = opportunity.course_id
        )
        SELECT
          u.id AS aluno_id,
          u.nome AS aluno_nome,
          u.email AS aluno_email,
          COALESCE(NULLIF(sc.matricula, ''), NULLIF(u.matricula, ''), 'Matrícula não gerada') AS matricula,
          c.id AS curso_id,
          COALESCE(NULLIF(c.sigla, ''), u.course_id, 'SEM_CURSO') AS curso,
          COALESCE(NULLIF(c.nome, ''), c.sigla, 'Curso não informado') AS curso_nome,
          COALESCE(source.categoria, 'Sem envio') AS categoria,
          COALESCE(source.carga_horaria, 0) AS carga_horaria,
          COALESCE(source.status, 'sem_envio') AS status,
          COALESCE(SUBSTRING(source.data_envio FROM 1 FOR 10), '') AS data_envio,
          COALESCE(source.feedback, '') AS feedback,
          COALESCE(c.horas_meta, ${defaultTarget}) AS meta_horas
        FROM users u
        JOIN student_courses sc ON sc.user_id = u.id
        LEFT JOIN courses c ON c.id = sc.course_id
        LEFT JOIN academic_sources source
          ON source.aluno_id = u.id
         AND (
           source.course_id = sc.course_id
           OR (COALESCE(source.course_id, '') = '' AND sc.course_id = u.course_id)
         )
        WHERE u.tipo = 'aluno'
          AND u.ativo = 1
          ${coordinatorFilter}
        ORDER BY u.nome, c.sigla, source.data_envio DESC NULLS LAST
      `).all(...params);

      return send(res, 200, { items: rows });
    }

    if (pathname === '/api/ml/executar' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, ['superadmin', 'coordenador']);
      if (!auth) return;

      const execucaoId = uid('mlrun');
      await db.prepare(`
        INSERT INTO ml_execucoes (id, started_by, status, started_at)
        VALUES (?, ?, ?, ?)
      `).run(execucaoId, auth.user.id, 'executando', nowIso());

      try {
        const mlEnv = {
          SIGAC_API_URL: `http://${HOST}:${PORT}/api/ml/dataset`,
          SIGAC_API_TOKEN: getToken(req)
        };

        await runPythonScript('exportar_dados_api.py', mlEnv);
        await runPythonScript('limpar_dados.py', mlEnv);
        await runPythonScript('gerar_relatorio_ml.py', mlEnv);
        await runPythonScript('treinar_modelo.py', mlEnv);

        const resumo = readMlResumo();
        const riscos = readMlRiscoAlunos();

        await db.prepare(`
          UPDATE ml_execucoes
          SET status = ?, total_registros = ?, total_aprovados = ?, total_rejeitados = ?,
              total_em_analise = ?, taxa_aprovacao = ?, dataset_path = ?, risk_file_path = ?,
              modelo_path = ?, finished_at = ?
          WHERE id = ?
        `).run(
          'concluido',
          resumo.totalRegistros,
          resumo.aprovados,
          resumo.rejeitados,
          resumo.emAnalise,
          toPercentInteger(resumo.taxaAprovacao),
          'ml/data/processed/dataset_limpo.csv',
          'ml/reports/risco_alunos.csv',
          'ml/models/modelo_risco_aluno.json',
          nowIso(),
          execucaoId
        );

        for (const row of riscos) {
          const alunoId = String(row.aluno_id || row.aluno || '').trim();
          const userRow = alunoId ? await getUserById(alunoId) : null;
          const alunoNome = pickHumanStudentName(row.aluno_nome, row.nome_aluno, row.nome, row.aluno, userRow?.nome);
          await db.prepare(`
            INSERT INTO ml_risco_alunos
              (id, execucao_id, aluno_id, aluno_nome, aluno_email, aluno_matricula, curso, meta_horas, horas_aprovadas,
               percentual_concluido, qtd_aprovadas, qtd_rejeitadas, qtd_pendentes,
               classificacao_risco, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            uid('mlrisk'),
            execucaoId,
            alunoId,
            alunoNome,
            String(row.aluno_email || row.email || userRow?.email || '').trim(),
            String(row.aluno_matricula || row.matricula || userRow?.matricula || '').trim(),
            String(row.curso || '').trim(),
            toMlNumber(row.meta_horas),
            toMlNumber(row.horas_aprovadas),
            toPercentInteger(row.percentual_concluido),
            toMlNumber(row.qtd_aprovadas),
            toMlNumber(row.qtd_rejeitadas),
            toMlNumber(row.qtd_pendentes),
            normalizeMlRisk(row.risco || row.classificacao_risco),
            nowIso()
          );
        }

        await logAudit(auth.user.id, 'executou_ml', 'ml_execucao', execucaoId, `ML concluiu ${resumo.totalRegistros} registros`);
        return send(res, 200, { execucaoId, resumo, riscos });
      } catch (error) {
        await db.prepare(`
          UPDATE ml_execucoes SET status = ?, finished_at = ?, error_message = ? WHERE id = ?
        `).run('erro', nowIso(), String(error.stderr || error.message || error).slice(0, 2000), execucaoId);
        return send(res, 500, {
          error: 'Falha ao executar ML.',
          details: String(error.message || error),
          stderr: String(error.stderr || '').slice(0, 2000)
        });
      }
    }

    if (pathname === '/api/ml/ultima-execucao' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, ['superadmin', 'coordenador']);
      if (!auth) return;
      const execucao = await db.prepare(`SELECT ${ML_EXECUCAO_COLUMNS} FROM ml_execucoes ORDER BY started_at DESC LIMIT 1`).get();
      return send(res, 200, { execucao });
    }

    if (pathname === '/api/ml/risco-alunos' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, ['superadmin', 'coordenador']);
      if (!auth) return;
      const execucao = await db.prepare(`SELECT ${ML_EXECUCAO_COLUMNS} FROM ml_execucoes WHERE status = ? ORDER BY started_at DESC LIMIT 1`).get('concluido');
      const dashboard = auth.user.tipo === 'coordenador'
        ? await getCoordinatorDashboardData(auth.user.id)
        : await getAdminDashboardData();
      const riscos = buildAcademicMlRowsFromDashboard(dashboard);
      return send(res, 200, { execucao, riscos });
    }

    if (pathname === '/api/ml/historico' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, ['superadmin', 'coordenador']);
      if (!auth) return;
      const historico = await db.prepare(`SELECT ${ML_EXECUCAO_COLUMNS} FROM ml_execucoes ORDER BY started_at DESC LIMIT 20`).all();
      return send(res, 200, { historico });
    }

    // ===== FIM ADIÇÃO ML SIGAC: rotas /api/ml =====

    if (pathname === '/api/admin/dashboard' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const dashboard = await cachedRead(`admin-dashboard:${auth.user.id}:${urlObj.search}`, () => getAdminDashboardData());
      return send(res, 200, { user: auth.user, dashboard });
    }

    if (pathname === '/api/admin/dashboard/overview' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const dashboard = await cachedRead(`admin-dashboard-overview:${auth.user.id}:${urlObj.search}`, () => getAdminDashboardOverview());
      return send(res, 200, { user: auth.user, dashboard });
    }

    if (pathname === '/api/admin/dashboard/summary' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const dashboard = await cachedRead(`admin-dashboard-summary:${auth.user.id}:${urlObj.search}`, () => getAdminDashboardSummary());
      return send(res, 200, { user: auth.user, dashboard });
    }

    if (pathname === '/api/admin/users' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const pagination = parsePagination(urlObj) || defaultPagination(100);
      const result = await cachedRead(`admin-users:${auth.user.id}:${urlObj.search}`, () => listUsers(pagination));
      return send(res, 200, { users: result.items, pagination: result.pagination });
    }

    if (pathname === '/api/admin/submissions' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const pagination = parsePagination(urlObj) || defaultPagination(50);
      const result = await cachedRead(`admin-submissions:${auth.user.id}:${urlObj.search}`, () => listAdminSubmissions(pagination));
      return send(res, 200, { submissions: result.items, pagination: result.pagination });
    }

    if (pathname === '/api/admin/certificates' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const pagination = parsePagination(urlObj) || defaultPagination(50);
      const result = await cachedRead(`admin-certificates:${auth.user.id}:${urlObj.search}`, () => listCertificatesForAdmin(pagination));
      return send(res, 200, { certificates: result.items, pagination: result.pagination });
    }

    if (pathname.match(/^\/api\/admin\/certificates\/[^/]+$/) && req.method === 'DELETE') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const certificateId = pathname.split('/')[4];
      const certificate = await getCertificateById(certificateId);
      if (!certificate) return send(res, 404, { error: 'Certificado não encontrado.' });
      await db.prepare(`UPDATE certificates
                        SET admin_status = 'removido', admin_feedback = ?, reviewed_at = ?, reviewed_by = ?, approved_hours = 0
                        WHERE id = ?`)
        .run('Certificado removido da contagem do lote. O arquivo permanece no histórico para rastreabilidade.', nowIso(), auth.user.id, certificateId);
      await logAudit(auth.user.id, 'removeu_certificado_contagem', 'certificate', certificateId, certificate.fileName);
      if (certificate.senderId) {
        await addNotification(certificate.senderId, `Seu certificado ${certificate.fileName} foi removido da contagem do lote e mantido no histórico.`, 'warning');
      }
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/admin/activity-rules' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      return send(res, 200, { rules: await listActivityRules() });
    }

    if (pathname === '/api/admin/audit-logs' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      return send(res, 200, { auditLogs: await listAuditLogs(60) });
    }

    if (pathname === '/api/admin/emails' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const pagination = parsePagination(urlObj) || defaultPagination(50);
      const result = await cachedRead(`admin-emails:${auth.user.id}:${urlObj.search}`, () => listEmails(pagination));
      return send(res, 200, { emails: result.items, pagination: result.pagination });
    }

    if (pathname.match(/^\/api\/admin\/certificates\/[^/]+\/file$/) && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const certificateId = pathname.split('/')[4];
      const certificate = await getCertificateById(certificateId);
      if (!certificate) return send(res, 404, { error: 'Certificado não encontrado.' });

      if (urlObj.searchParams.get('download') === '1') {
        const match = String(certificate.fileData || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/);
        if (!match) return send(res, 400, { error: 'Arquivo inválido.' });
        const isBase64 = !!match[2];
        const raw = isBase64 ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'utf8');
        res.writeHead(200, {
          'Content-Type': match[1] || 'application/octet-stream',
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(certificate.fileName || 'certificado')}`, 
          'Cache-Control': 'private, max-age=300',
          ...getCorsHeaders(req)
        });
        return res.end(raw);
      }

      return send(res, 200, {
        id: certificate.id,
        fileName: certificate.fileName,
        fileData: certificate.fileData
      });
    }

    if (pathname.match(/^\/api\/certificates\/[^/]+\/file$/) && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, ['coordenador', 'aluno']);
      if (!auth) return;
      const certificateId = pathname.split('/')[3];
      const certificate = await getCertificateById(certificateId);
      if (!certificate) return send(res, 404, { error: 'Certificado não encontrado.' });
      if (certificate.senderId !== auth.user.id) return send(res, 403, { error: 'Você não pode acessar este arquivo.' });

      const match = String(certificate.fileData || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/);
      if (!match) return send(res, 400, { error: 'Arquivo inválido.' });
      const isBase64 = !!match[2];
      const raw = isBase64 ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'utf8');
      res.writeHead(200, {
        'Content-Type': match[1] || 'application/octet-stream',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(certificate.fileName || 'certificado')}`, 
        'Cache-Control': 'private, max-age=300',
        ...getCorsHeaders(req)
      });
      return res.end(raw);
    }

    if (pathname === '/api/admin/users' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const body = await parseBody(req);
      const nome = String(body.nome || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const senhaInformada = String(body.senha || '').trim();
      const tipo = String(body.tipo || '').trim();
      const courseId = String(body.courseId || '').trim();
      const courseIds = Array.isArray(body.courseIds) ? [...new Set(body.courseIds.filter(Boolean))] : [];
      const profile = normalizeStudentProfilePayload(body);
      const studentCourseIds = tipo === 'aluno'
        ? (courseIds.length ? courseIds : [courseId].filter(Boolean))
        : [];
      const ativo = body.ativo === false || body.ativo === 0 || body.ativo === '0' ? 0 : 1;
      if (!nome || !email || !['aluno', 'coordenador'].includes(tipo)) {
        return send(res, 400, { error: 'Preencha nome, e-mail e função corretamente.' });
      }
      if (senhaInformada && senhaInformada.length < 8) {
        return send(res, 400, { error: 'A senha deve ter ao menos 8 caracteres.' });
      }
      if (tipo === 'aluno') {
        if (!studentCourseIds.length || studentCourseIds.length > 2) {
          return send(res, 400, { error: 'Selecione de 1 a 2 cursos para o aluno.' });
        }
        for (const cId of studentCourseIds) {
          if (!(await getCourseById(cId))) return send(res, 400, { error: 'Um dos cursos selecionados é inválido.' });
        }
      }
      if (tipo === 'coordenador') {
        if (!courseIds.length || courseIds.length > 10) return send(res, 400, { error: 'Selecione de 1 a 10 cursos para o coordenador.' });
        for (const cId of courseIds) {
          if (!(await getCourseById(cId))) return send(res, 400, { error: 'Um dos cursos selecionados e inválido.' });
        }
      }
      const exists = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`).get(email);
      if (exists) {
        if (tipo !== 'aluno' || exists.tipo !== 'aluno') return send(res, 400, { error: 'Este e-mail ja esta cadastrado.' });
        const currentLinks = await getStudentCourseLinks(exists.id);
        const nextCourseIds = studentCourseIds.filter((cId) => !currentLinks.some((link) => link.courseId === cId));
        if (!nextCourseIds.length) return send(res, 409, { error: 'Este aluno ja esta vinculado aos cursos selecionados.' });
        if (currentLinks.length + nextCourseIds.length > 2) return send(res, 400, { error: 'Este aluno ja possui ou excederia o limite de 2 cursos vinculados.' });
        const insertStudentCourse = db.prepare('INSERT INTO student_courses (user_id, course_id, matricula) VALUES (?, ?, ?) ON CONFLICT (user_id, course_id) DO UPDATE SET matricula = EXCLUDED.matricula, ativo = 1');
        let firstMatricula = '';
        for (const cId of nextCourseIds) {
          const linkMatricula = await generateMatricula('aluno', cId);
          if (!firstMatricula) firstMatricula = linkMatricula;
          await insertStudentCourse.run(exists.id, cId, linkMatricula);
        }
        if (!exists.course_id) await db.prepare('UPDATE users SET course_id = ? WHERE id = ?').run(nextCourseIds[0], exists.id);
        await logAudit(auth.user.id, 'vinculou_aluno_existente', 'student_course', exists.id, nextCourseIds.join(', '));
        return send(res, 200, { user: await getUserById(exists.id), matricula: firstMatricula });
      }
      const id = uid('user');
      const temporaryPassword = senhaInformada || generateTemporaryPassword();
      const primaryCourseId = tipo === 'aluno' ? studentCourseIds[0] : '';
      const matricula = await generateMatricula(tipo, primaryCourseId);
      await db.prepare(`INSERT INTO users
        (id, nome, email, senha_hash, tipo, ativo, course_id, matricula, must_change_password,
         password_updated_at, temporary_password_issued_at, created_at, telefone, cpf, endereco, data_nascimento, curso_interesse)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          id, nome, email, hashPassword(temporaryPassword), tipo, ativo,
          tipo === 'aluno' ? primaryCourseId : null, matricula, nowIso(), nowIso(), nowIso(),
          profile.telefone, profile.cpf, profile.endereco, profile.dataNascimento, profile.cursoInteresse
        );
      if (tipo === 'aluno') {
        const insertStudentCourse = db.prepare('INSERT INTO student_courses (user_id, course_id, matricula) VALUES (?, ?, ?) ON CONFLICT (user_id, course_id) DO UPDATE SET matricula = EXCLUDED.matricula, ativo = 1');
        for (const cId of studentCourseIds) {
          const linkMatricula = cId === primaryCourseId ? matricula : await generateMatricula('aluno', cId);
          await insertStudentCourse.run(id, cId, linkMatricula);
        }
      }
      if (tipo === 'coordenador') {
        const insert = db.prepare('INSERT INTO coordinator_courses (user_id, course_id) VALUES (?, ?)');
        for (const cId of courseIds) {
          await insert.run(id, cId);
        }
      }
      await addNotification(id, 'Seu acesso ao SIGAC foi criado.', 'info');
      await queueEmail(email, 'SIGAC - acesso criado', `Olá, ${nome}. Seu acesso ao SIGAC foi criado com sucesso.`, 'boas-vindas');
      await logAudit(auth.user.id, 'criou_usuario', 'user', id, `${tipo}: ${nome}`);
      await notifySuperAdmins(
        `Super Admin ${auth.user.nome} criou o usuário ${nome}.`,
        'info',
        'SIGAC - usuário criado',
        `O usuário ${nome} (${tipo}) foi criado por ${auth.user.nome}.`,
        auth.user.id
      );
      return send(res, 200, { user: await getUserById(id), temporaryPassword, matricula });
    }

    if (pathname.match(/^\/api\/admin\/users\/[^/]+\/reset-password$/) && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const userId = pathname.split('/')[4];
      const row = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(userId);
      if (!row || row.tipo === 'superadmin') return send(res, 400, { error: 'Usuário inválido para redefinição.' });
      const temporaryPassword = generateTemporaryPassword();
      await db.prepare('UPDATE users SET senha_hash = ?, must_change_password = 1, password_updated_at = ?, temporary_password_issued_at = ? WHERE id = ?')
        .run(hashPassword(temporaryPassword), nowIso(), nowIso(), userId);
      await deleteUserSessions(userId);
      await addNotification(userId, 'Sua senha foi redefinida pelo administrador. Use a senha temporária e cadastre uma nova senha no primeiro acesso.', 'warning');
      await logAudit(auth.user.id, 'redefiniu_senha_usuario', 'user', userId, row.email);
      return send(res, 200, { ok: true, temporaryPassword, matricula: row.matricula || '', user: await getUserById(userId) });
    }

    if (pathname.match(/^\/api\/admin\/users\/[^/]+\/status$/) && req.method === 'PATCH') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const userId = pathname.split('/')[4];
      const body = await parseBody(req);
      const row = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(userId);
      if (!row || row.tipo === 'superadmin') return send(res, 400, { error: 'Usuário inválido.' });
      await db.prepare('UPDATE users SET ativo = ? WHERE id = ?').run(body.ativo ? 1 : 0, userId);
      await logAudit(auth.user.id, body.ativo ? 'ativou_usuario' : 'desativou_usuario', 'user', userId, row.email);
      await notifySuperAdmins(
        `Super Admin ${auth.user.nome} ${body.ativo ? 'ativou' : 'desativou'} o usuário ${row.nome}.`,
        'warning',
        'SIGAC - status de usuário alterado',
        `O status do usuário ${row.nome} (${row.email}) foi alterado por ${auth.user.nome}.`,
        auth.user.id
      );
      return send(res, 200, { user: await getUserById(userId) });
    }


    if (pathname.match(/^\/api\/admin\/users\/[^/]+$/) && req.method === 'DELETE') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const userId = pathname.split('/')[4];
      const row = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(userId);
      if (!row || row.tipo === 'superadmin') return send(res, 400, { error: 'Usuário inválido ou protegido.' });
      if (row.id === auth.user.id) return send(res, 400, { error: 'Você não pode excluir o próprio usuário logado.' });

      try {
        await db.exec('BEGIN');
        await db.prepare('UPDATE activity_rules SET created_by = NULL WHERE created_by = ?').run(userId);
        await db.prepare('UPDATE certificates SET reviewed_by = NULL WHERE reviewed_by = ?').run(userId);
        await db.prepare('UPDATE opportunities SET criado_por = ? WHERE criado_por = ?').run(auth.user.id, userId);
        await db.prepare('UPDATE activities SET created_by = ? WHERE created_by = ?').run(auth.user.id, userId);
        await db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        await db.prepare('INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(uid('log'), auth.user.id, 'excluiu_usuario', 'user', userId, `${row.tipo}: ${row.nome} (${row.email})`, nowIso());
        await db.exec('COMMIT');
      } catch (error) {
        await db.exec('ROLLBACK').catch(() => {});
        return send(res, 500, { error: 'Não foi possível excluir o usuário com segurança.' });
      }

      await notifySuperAdmins(
        `Super Admin ${auth.user.nome} excluiu o usuário ${row.nome}.`,
        'warning',
        'SIGAC - usuário excluído',
        `O usuário ${row.nome} (${row.email}) foi removido por ${auth.user.nome}.`,
        auth.user.id
      );
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/admin/courses' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const body = await parseBody(req);
      const sigla = String(body.sigla || '').trim().toUpperCase();
      const nome = String(body.nome || '').trim();
      const area = String(body.area || '').trim() || 'Geral';
      const tipo = String(body.tipo || body.tipoCurso || '').trim() || 'Graduação';
      const turno = String(body.turno || '').trim() || 'Noite';
      const cargaHorariaTotal = Math.max(0, Number(body.cargaHorariaTotal || body.cargaHorariaTotalCurso || 0) || 0);
      const defaultHorasMeta = await getSetting('horasMetaPadrao', '0');
      const horasMeta = Number(body.horasMeta || defaultHorasMeta || 0);
      if (!sigla || !nome) return send(res, 400, { error: 'Informe sigla e nome do curso.' });
      const exists = await db.prepare('SELECT 1 FROM courses WHERE UPPER(sigla) = ?').get(sigla);
      if (exists) return send(res, 400, { error: 'Já existe um curso com esta sigla.' });
      const id = uid('course');
      await db.prepare('INSERT INTO courses (id, sigla, nome, area, tipo, turno, carga_horaria_total, horas_meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, sigla, nome, area, tipo, turno, cargaHorariaTotal, horasMeta);
      await logAudit(auth.user.id, 'criou_curso', 'course', id, `${sigla} - ${nome}`);
      clearReadCache();
      await notifySuperAdmins(
        `Super Admin ${auth.user.nome} criou o curso ${sigla}.`,
        'info',
        'SIGAC - curso criado',
        `O curso ${sigla} - ${nome} foi criado por ${auth.user.nome}.`,
        auth.user.id
      );
      return send(res, 200, { course: await getCourseById(id) });
    }

    if (pathname.match(/^\/api\/admin\/courses\/[^/]+\/status$/) && req.method === 'PATCH') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const courseId = pathname.split('/')[4];
      const body = await parseBody(req);
      const course = await getCourseById(courseId);
      if (!course) return send(res, 404, { error: 'Curso não encontrado.' });
      const ativo = body.ativo === false || body.ativo === 'false' || body.ativo === 0 || body.ativo === '0' ? 0 : 1;
      await db.prepare('UPDATE courses SET ativo = ? WHERE id = ?').run(ativo, courseId);
      await logAudit(auth.user.id, ativo ? 'ativou_curso' : 'desativou_curso', 'course', courseId, `${course.sigla} - ${course.nome}`);
      clearReadCache();
      return send(res, 200, { course: await getCourseById(courseId) });
    }

    if (pathname.match(/^\/api\/admin\/students\/[^/]+\/course$/) && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const studentId = pathname.split('/')[4];
      const body = await parseBody(req);
      const row = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(studentId);
      const courseIds = Array.isArray(body.courseIds)
        ? [...new Set(body.courseIds.map((id) => String(id || '').trim()).filter(Boolean))]
        : [String(body.courseId || '').trim()].filter(Boolean);
      if (!row || row.tipo !== 'aluno') return send(res, 400, { error: 'Selecione um aluno válido.' });
      if (!courseIds.length || courseIds.length > 2) return send(res, 400, { error: 'Selecione de 1 a 2 cursos para o aluno.' });
      const courses = [];
      for (const courseId of courseIds) {
        const course = await getCourseById(courseId);
        if (!course) return send(res, 400, { error: 'Um dos cursos selecionados é inválido.' });
        courses.push(course);
      }
      await db.prepare('DELETE FROM student_courses WHERE user_id = ?').run(studentId);
      const insertStudentCourse = db.prepare('INSERT INTO student_courses (user_id, course_id, matricula) VALUES (?, ?, ?) ON CONFLICT (user_id, course_id) DO UPDATE SET matricula = EXCLUDED.matricula, ativo = 1');
      for (const course of courses) {
        const existingMatricula = course.id === row.course_id ? row.matricula : '';
        await insertStudentCourse.run(studentId, course.id, existingMatricula || await generateMatricula('aluno', course.id));
      }
      await db.prepare('UPDATE users SET course_id = ? WHERE id = ?').run(courses[0].id, studentId);
      const siglas = courses.map((course) => course.sigla).join(', ');
      await addNotification(studentId, `Você foi vinculado aos cursos ${siglas}.`, 'info');
      await queueEmail(row.email, 'SIGAC - vínculos de curso atualizados', `Você foi vinculado aos cursos ${siglas} no SIGAC.`, 'vinculo-curso');
      await logAudit(auth.user.id, 'atualizou_vinculos_aluno', 'student_course', studentId, siglas);
      await notifySuperAdmins(
        `Super Admin ${auth.user.nome} atualizou os vínculos de ${row.nome}.`,
        'info',
        'SIGAC - vínculos de aluno atualizados',
        `${row.nome} foi vinculado aos cursos ${siglas} por ${auth.user.nome}.`,
        auth.user.id
      );
      return send(res, 200, { user: await getUserById(studentId) });
    }

    if (pathname.match(/^\/api\/admin\/coordinators\/[^/]+\/courses$/) && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const coordinatorId = pathname.split('/')[4];
      const body = await parseBody(req);
      const row = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(coordinatorId);
      const courseIds = Array.isArray(body.courseIds) ? [...new Set(body.courseIds.filter(Boolean))] : [];
      if (!row || row.tipo !== 'coordenador') return send(res, 400, { error: 'Selecione um coordenador válido.' });
      if (!courseIds.length || courseIds.length > 10) return send(res, 400, { error: 'Selecione de 1 a 10 cursos para o coordenador.' });
      for (const courseId of courseIds) {
        if (!(await getCourseById(courseId))) return send(res, 400, { error: 'Um dos cursos selecionados é inválido.' });
      }
      await db.prepare('DELETE FROM coordinator_courses WHERE user_id = ?').run(coordinatorId);
      const insert = db.prepare('INSERT INTO coordinator_courses (user_id, course_id) VALUES (?, ?)');
      for (const courseId of courseIds) await insert.run(coordinatorId, courseId);
      await addNotification(coordinatorId, 'Seus vínculos de coordenação foram atualizados.', 'info');
      await queueEmail(row.email, 'SIGAC - vínculos de coordenação atualizados', 'Seus vínculos de coordenação foram atualizados no SIGAC.', 'vinculo-coordenacao');
      await logAudit(auth.user.id, 'atualizou_vinculos_coordenador', 'coordinator_courses', coordinatorId, courseIds.join(', '));
      await notifySuperAdmins(
        `Super Admin ${auth.user.nome} atualizou os vínculos do coordenador ${row.nome}.`,
        'info',
        'SIGAC - vínculos de coordenador atualizados',
        `Os vínculos do coordenador ${row.nome} foram atualizados por ${auth.user.nome}.`,
        auth.user.id
      );
      return send(res, 200, { user: await getUserById(coordinatorId) });
    }

    if (pathname === '/api/admin/opportunities' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const body = await parseBody(req);
      const titulo = String(body.titulo || '').trim();
      const descricao = String(body.descricao || '').trim();
      const courseId = String(body.courseId || '').trim();
      const categoria = String(body.categoria || body.category || 'Curso livre').trim() || 'Curso livre';
      const status = ['Aberta', 'Encerrada', 'Cancelada'].includes(String(body.status || '').trim())
        ? String(body.status).trim()
        : 'Aberta';
      const horasSolicitadas = Number(body.horas || 0);
      if (!(await getCourseById(courseId))) return send(res, 400, { error: 'Selecione um curso válido para a oportunidade.' });
      if (!titulo || !descricao || !horasSolicitadas) return send(res, 400, { error: 'Preencha título, descrição e horas da oportunidade.' });
      const horas = OPPORTUNITY_CATEGORIES_WITH_20H_LIMIT.has(normalizePlain(categoria))
        ? Math.min(horasSolicitadas, 20)
        : horasSolicitadas;
      const id = uid('opp');
      await db.prepare('INSERT INTO opportunities (id, titulo, descricao, course_id, horas, criado_por, criado_em, categoria, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, titulo, descricao, courseId, horas, auth.user.id, nowIso(), categoria, status);
      await logAudit(auth.user.id, 'criou_oportunidade', 'opportunity', id, `${titulo} - ${categoria} - ${horas} h`);
      await notifySuperAdmins(
        `Super Admin ${auth.user.nome} criou a oportunidade ${titulo}.`,
        'info',
        'SIGAC - oportunidade criada',
        `A oportunidade ${titulo} foi criada por ${auth.user.nome}.`,
        auth.user.id
      );
      return send(res, 200, { opportunity: (await listOpportunities()).find((item) => item.id === id) });
    }

    if (pathname === '/api/admin/rules' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const body = await parseBody(req);
      const courseId = String(body.courseId || '').trim();
      const categoria = String(body.categoria || '').trim();
      const limiteMaximo = Number(body.limiteMaximo || 0) || 0;
      const cargaMinima = Number(body.cargaMinima || 0) || 0;
      const exigeCertificado = body.exigeCertificado ? 1 : 0;
      const exigeAprovacao = body.exigeAprovacao ? 1 : 0;
      if (!(await getCourseById(courseId)) || !categoria || !limiteMaximo) {
        return send(res, 400, { error: 'Informe curso, categoria e limite máximo.' });
      }
      const id = uid('rule');
      await db.prepare(`INSERT INTO activity_rules
                          (id, course_id, categoria, limite_maximo, carga_minima, exige_certificado, exige_aprovacao, created_by, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, courseId, categoria, limiteMaximo, cargaMinima, exigeCertificado, exigeAprovacao, auth.user.id, nowIso());
      await logAudit(auth.user.id, 'criou_regra', 'activity_rule', id, `${categoria} - ${limiteMaximo} h`);
      await notifySuperAdmins(
        `Super Admin ${auth.user.nome} criou uma regra de atividade complementar.`,
        'info',
        'SIGAC - regra criada',
        `Regra criada por ${auth.user.nome}: ${categoria} - limite ${limiteMaximo} h.`,
        auth.user.id
      );
      return send(res, 200, { rules: await listActivityRules() });
    }

    if (pathname === '/api/admin/settings' && req.method === 'PUT') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const body = await parseBody(req);
      const horasMetaPadrao = Number(body.horasMetaPadrao || await getSetting('horasMetaPadrao', '0'));
      await setSetting('horasMetaPadrao', horasMetaPadrao);
      await setSetting('emailNotificationsEnabled', body.emailNotificationsEnabled ? 'true' : 'false');
      await setSetting('ocrDisponivel', body.ocrDisponivel ? 'true' : 'false');
      await setSetting('updatedAt', nowIso());
      await db.prepare('UPDATE courses SET horas_meta = ?').run(horasMetaPadrao);
      if (body.courseTargets && typeof body.courseTargets === 'object') {
        const updateCourse = db.prepare('UPDATE courses SET horas_meta = ? WHERE id = ?');
        for (const [courseId, value] of Object.entries(body.courseTargets)) {
          await updateCourse.run(Number(value || horasMetaPadrao), courseId);
        }
      }
      clearReadCache();
      await logAudit(auth.user.id, 'atualizou_configuracoes', 'settings', 'global', 'Parâmetros do sistema atualizados');
      await notifySuperAdmins(
        `Super Admin ${auth.user.nome} atualizou configurações globais do SIGAC.`,
        'warning',
        'SIGAC - configurações atualizadas',
        `Parâmetros globais do SIGAC foram atualizados por ${auth.user.nome}.`,
        auth.user.id
      );
      return send(res, 200, { settings: (await getAdminDashboardData()).settings });
    }

    if (pathname.match(/^\/api\/admin\/certificates\/[^/]+\/ocr$/) && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const certificateId = pathname.split('/')[4];
      const body = await parseBody(req);
      const current = await getCertificateById(certificateId);
      if (!current) return send(res, 404, { error: 'Certificado não encontrado.' });

      const result = body && typeof body === 'object' ? body : {};
      const detectedHours = Number(result.detectedHours || 0) || 0;
      const foundFields = Array.isArray(result.foundFields) ? result.foundFields.filter(Boolean) : [];
      const missingFields = Array.isArray(result.missingFields) ? result.missingFields.filter(Boolean) : [];
      const ocrStatus = String(result.ocrStatus || 'analise_manual').trim() || 'analise_manual';
      const updatedForCalculation = {
        ...current,
        detectedHours,
        detectedTitle: String(result.detectedTitle || '').trim(),
        detectedCourseName: String(result.detectedCourseName || '').trim(),
        ocrStatus
      };
      const approvedHours = current.adminStatus === 'aprovado'
        ? (await calculateCertificateHourBreakdown(updatedForCalculation)).approvedHours
        : 0;

      await db.prepare(`UPDATE certificates
                        SET extracted_text = ?, detected_hours = ?, detected_name = ?, detected_institution = ?,
                            detected_date = ?, detected_title = ?, detected_course_name = ?, found_fields = ?,
                            missing_fields = ?, confidence_score = ?, human_summary = ?, ocr_status = ?,
                            ocr_reason = ?, approved_hours = ?, ocr_processed_at = ?
                        WHERE id = ?`)
        .run(
          String(result.extractedText || '').trim(),
          detectedHours,
          String(result.detectedName || '').trim(),
          String(result.detectedInstitution || '').trim(),
          String(result.detectedDate || '').trim(),
          String(result.detectedTitle || '').trim(),
          String(result.detectedCourseName || '').trim(),
          JSON.stringify(foundFields),
          JSON.stringify(missingFields),
          Number(result.confidenceScore || 0) || 0,
          String(result.humanSummary || '').trim(),
          ocrStatus,
          String(result.ocrReason || 'Pr\u00e9-an\u00e1lise conclu\u00edda.').trim(),
          approvedHours,
          nowIso(),
          certificateId
        );

      if (current.senderId) {
        await addNotification(current.senderId, 'O OCR concluiu a pré-análise do seu certificado.', 'info');
      }
      return send(res, 200, { certificate: await getCertificateById(certificateId) });
    }

    if (pathname.match(/^\/api\/admin\/certificates\/[^/]+\/review$/) && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const certificateId = pathname.split('/')[4];
      const body = await parseBody(req);
      const certificate = await getCertificateById(certificateId);
      if (!certificate) return send(res, 404, { error: 'Certificado não encontrado.' });

      const finalStatus = body.status === 'aprovado' ? 'aprovado' : 'rejeitado';
      const feedback = String(body.feedback || '').trim()
        || (finalStatus === 'rejeitado'
          ? `Seu certificado '${certificate.fileName}' não foi aceito por não atender aos critérios de validação estabelecidos.`
          : '');
      const hourBreakdown = finalStatus === 'aprovado' ? await calculateCertificateHourBreakdown(certificate) : null;
      const approvedHours = finalStatus === 'aprovado' ? hourBreakdown.approvedHours : 0;

      await db.prepare(`UPDATE certificates
                        SET admin_status = ?, admin_feedback = ?, reviewed_at = ?, reviewed_by = ?, approved_hours = ?
                        WHERE id = ?`)
        .run(finalStatus, feedback, nowIso(), auth.user.id, approvedHours, certificateId);
      await logAudit(auth.user.id, finalStatus === 'aprovado' ? 'aprovou_certificado' : 'rejeitou_certificado', 'certificate', certificateId, feedback);

      const updated = await getCertificateById(certificateId);
      const human = finalStatus === 'aprovado' ? 'aprovado' : 'rejeitado';
      if (updated.sender?.id) {
        await addNotification(updated.sender.id, `Seu certificado ${updated.fileName} foi ${human} pelo administrador.`, finalStatus === 'aprovado' ? 'success' : 'warning');
      }
      if (updated.sender?.email) {
        await queueEmail(updated.sender.email, `SIGAC - certificado ${human}`, `O certificado ${updated.fileName} foi ${human}. Feedback: ${feedback || 'Sem observações.'}`, 'certificado-avaliação');
      }
      return send(res, 200, { certificate: updated });
    }

    if (pathname === '/api/admin/reset-demo' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      await transaction(async (tx) => {
        await tx.exec(`
          DELETE FROM sessions;
          DELETE FROM emails;
          DELETE FROM notifications;
          DELETE FROM submission_versions;
          DELETE FROM submissions;
          DELETE FROM activities;
          DELETE FROM certificates;
          DELETE FROM opportunity_registrations;
          DELETE FROM opportunities;
          DELETE FROM activity_rules;
          DELETE FROM audit_logs;
          DELETE FROM student_courses;
          DELETE FROM coordinator_courses;
          DELETE FROM users;
          DELETE FROM courses;
          DELETE FROM settings;
        `);
      });
      await seedIfEmpty();
      await ensureDemoAccessAccounts();
      await ensureMatriculas();
      const adminRow = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = 'einstein@sigac.com'`).get();
      const user = adminRow ? await serializeUser(adminRow) : null;
      const token = user ? await createSession(user.id) : '';
      return send(res, 200, { ok: true, token, user });
    }

    if (pathname === '/api/admin/email-log' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const lines = (await db.prepare(`SELECT ${EMAIL_COLUMNS} FROM emails ORDER BY created_at DESC`).all())
        .map((mail) => `${mail.created_at} | ${mail.to_email} | ${mail.subject} | ${mail.status}`);
      return send(res, 200, lines.join('\n') || 'Nenhum e-mail foi registrado na fila do SIGAC.', {
        'Content-Disposition': 'attachment; filename="sigac-email-log.txt"'
      });
    }

    const publicFile = getPublicFile(pathname);
    if (!publicFile) return notFound(res);
    const cacheControl = ['.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.ttf', '.woff2'].includes(publicFile.ext)
      ? 'public, max-age=604800'
      : 'no-store';
    const headers = {
      'Content-Type': publicFile.contentType,
      'Cache-Control': cacheControl,
      ...getCorsHeaders(req)
    };
    if (cacheControl === 'no-store') {
      headers.Pragma = 'no-cache';
      headers.Expires = '0';
    }
    res.writeHead(200, headers);
    fs.createReadStream(publicFile.filePath).pipe(res);
  } catch (error) {
    console.error('[SIGAC ERROR]', error);
    const status = Number(error.statusCode || error.status || 500);
    const safeStatus = status >= 400 && status < 500 ? status : 500;
    const message = safeStatus === 500
      ? 'Erro interno no servidor. Verifique os logs da API SIGAC.'
      : error.message || 'Não foi possível concluir a solicitação.';
    send(res, safeStatus, { error: message });
  }
});

async function bootstrap() {
  await initDatabase();
  await deleteExpiredSecurityRows();
  if (process.env.NODE_ENV !== 'production') {
    await seedIfEmpty();
    await ensureDemoAccessAccounts();
  }
  await ensureSenacCourseCatalog();
  await ensureMatriculas();

  try {
    await listenOnPort(server, PORT, HOST);
    console.log(`SIGAC rodando em http://${HOST}:${PORT}`);
  } catch (error) {
    if (error && error.code === 'EADDRINUSE' && process.platform === 'win32') {
      try {
        const occupiedPid = await findListeningProcessOnPort(PORT);
        const processName = occupiedPid ? await getProcessImageName(occupiedPid) : null;
        if (occupiedPid && processName === 'node.exe' && occupiedPid !== process.pid) {
          console.log(`[SIGAC] Porta ${PORT} ocupada por node.exe (PID ${occupiedPid}). Tentando encerrar o processo...`);
          await killWinProcess(occupiedPid);
          await listenOnPort(server, PORT, HOST);
          console.log(`SIGAC rodando em http://${HOST}:${PORT}`);
          return;
        }
      } catch (cleanupError) {
        console.error('[SIGAC BOOT ERROR] Falha ao liberar porta 3000:', cleanupError.message || cleanupError);
      }
    }
    if (error && error.code === 'EADDRINUSE') {
      console.error(`[SIGAC BOOT ERROR] Porta ${PORT} já está em uso. Feche o processo que está usando a porta 3000 ou defina PORT=3001 para usar outra porta.`);
    } else {
      console.error('[SIGAC BOOT ERROR]', error.message || error);
    }
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('[SIGAC BOOT ERROR]', error);
  process.exit(1);
});
