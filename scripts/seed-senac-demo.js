const {
  createClient,
  databaseTarget,
  hashPassword,
  listPublicTables,
  nowIso,
  quoteIdentifier,
  textDataUrl,
  withTransaction,
} = require('./demo-database-utils');
const { RESET_TABLES } = require('./reset-demo-database');

const PASSWORD = '123456';
const COURSES = [
  ['course_ads', 'ADS', 'Analise e Desenvolvimento de Sistemas', 'Tecnologia da Informacao | Tecnologo | 2100h | 5 semestres', 'Manha, Tarde e Noite', 120],
  ['course_jogos_digitais', 'JD', 'Jogos Digitais', 'Tecnologia da Informacao / Jogos | Tecnologo | 2100h | 5 semestres', 'Manha, Tarde e Noite', 120],
  ['course_tds', 'TDS', 'Tecnico em Desenvolvimento de Sistemas', 'Tecnologia da Informacao | Tecnico | 1200h | 18 meses', 'Manha, Tarde e Noite', 100],
  ['course_tii', 'TII', 'Tecnico em Informatica para Internet', 'Tecnologia da Informacao | Tecnico | 1000h | 15 a 18 meses', 'Manha, Tarde e Noite', 100],
  ['course_administracao', 'ADM', 'Tecnico em Administracao', 'Administracao e Gestao | Tecnico | 1000h | 17 meses', 'Manha, Tarde e Noite', 100],
  ['course_rh', 'RH', 'Tecnico em Recursos Humanos', 'Recursos Humanos | Tecnico | 800h | 12 a 18 meses', 'Manha, Tarde e Noite', 80],
  ['course_log', 'LOG', 'Tecnico em Logistica', 'Logistica | Tecnico | 800h | oferta presencial ou EAD', 'Manha, Tarde e Noite', 80],
  ['course_st', 'ST', 'Tecnico em Seguranca do Trabalho', 'Seguranca do Trabalho | Tecnico | 1200h', 'Manha, Tarde e Noite', 100],
  ['course_enfermagem', 'ENF', 'Tecnico em Enfermagem', 'Saude | Tecnico | 1700h | aproximadamente 2,5 anos', 'Manha, Tarde e Noite', 120],
  ['course_di', 'DI', 'Tecnico em Design de Interiores', 'Design | Tecnico | 1200h', 'Manha, Tarde e Noite', 100],
  ['course_rtv', 'RTV', 'Tecnico em Radio e Televisao', 'Comunicacao | Tecnico | 1028h', 'Manha, Tarde e Noite', 100],
  ['course_gt', 'GT', 'Tecnico em Guia de Turismo', 'Turismo | Tecnico | 800h', 'Manha, Tarde e Noite', 80],
  ['course_dje', 'DJE', 'Desenvolvedor de Jogos Eletronicos', 'Jogos | Curso livre | 240h', 'Manha, Tarde e Noite', 40],
];

const USERS = [
  ['demo_admin', 'Einstein', 'admin@sigac.local', 'superadmin', null, 'ADM/0000000001'],
  ['demo_coordinator', 'Coordenador SIGAC', 'coordenador@sigac.local', 'coordenador', null, 'COORD/0000000001'],
  ['demo_einstein', 'Einstein IB Neves', 'einsteinbritoneves@gmail.com', 'aluno', 'course_ads', 'ADS/0020015914'],
  ['demo_hilccer', 'Hilccer Rocha Araujo Melo', 'hilccer@sigac.local', 'aluno', 'course_ads', 'ADS/0020015916'],
  ['demo_izabel', 'Izabel Santos', 'izabel@sigac.local', 'aluno', 'course_jogos_digitais', 'JD/0020015917'],
];

const STUDENT_LINKS = [
  ['link_einstein_ads', 'demo_einstein', 'course_ads', 'ADS/0020015914'],
  ['link_einstein_jd', 'demo_einstein', 'course_jogos_digitais', 'JD/0020015915'],
  ['link_hilccer_ads', 'demo_hilccer', 'course_ads', 'ADS/0020015916'],
  ['link_izabel_jd', 'demo_izabel', 'course_jogos_digitais', 'JD/0020015917'],
];

const RULES = [
  ['Cursos livres', 40, 4],
  ['Eventos', 30, 2],
  ['Projetos', 50, 4],
  ['Monitoria', 30, 4],
  ['Extensao', 40, 4],
  ['Estagio', 40, 10],
  ['Representante de turma', 20, 10],
];

const ACTIVITIES = [
  ['demo_activity_ads_project', 'Projeto Integrador de Software', 'Apresente o projeto e envie o comprovante de participacao.', 'course_ads', 20, 'Projetos'],
  ['demo_activity_ads_event', 'Semana de Tecnologia SENAC', 'Participe das palestras e envie o certificado do evento.', 'course_ads', 10, 'Eventos'],
  ['demo_activity_jd_gamejam', 'Game Jam SENAC', 'Desenvolva um prototipo jogavel em equipe.', 'course_jogos_digitais', 20, 'Projetos'],
  ['demo_activity_tds_workshop', 'Workshop de APIs REST', 'Atividade pratica sobre integracao de sistemas.', 'course_tds', 8, 'Cursos livres'],
];

const SUBMISSIONS = [
  ['demo_submission_einstein_approved', 'demo_activity_ads_project', 'demo_einstein', 'aprovado', 'Projetos', 20, 'Projeto aprovado pela coordenacao.'],
  ['demo_submission_einstein_pending', 'demo_activity_ads_event', 'demo_einstein', 'em_analise', 'Eventos', 10, 'Aguardando analise da coordenacao.'],
  ['demo_submission_izabel_approved', 'demo_activity_jd_gamejam', 'demo_izabel', 'aprovado', 'Projetos', 20, 'Entrega aprovada.'],
];

const CERTIFICATES = [
  ['demo_cert_einstein_ads_approved', 'demo_einstein', 'course_ads', 'link_einstein_ads', 'ADS/0020015914', 'Curso de React Completo', 'Cursos livres', 30, 'aprovado', 'aprovado_automatico', 30, 'Certificado aprovado para demonstracao.'],
  ['demo_cert_einstein_ads_pending', 'demo_einstein', 'course_ads', 'link_einstein_ads', 'ADS/0020015914', 'Workshop de IA Aplicada', 'Eventos', 8, 'pendente', 'analise_manual', 0, 'Aguardando validacao.'],
  ['demo_cert_einstein_ads_rejected', 'demo_einstein', 'course_ads', 'link_einstein_ads', 'ADS/0020015914', 'Certificado sem carga horaria', 'Cursos livres', 10, 'rejeitado', 'analise_manual', 0, 'Documento sem informacoes suficientes.'],
  ['demo_cert_einstein_ads_removed', 'demo_einstein', 'course_ads', 'link_einstein_ads', 'ADS/0020015914', 'Certificado removido da contagem', 'Eventos', 6, 'removido_da_contagem', 'analise_manual', 0, 'Mantido no historico, fora da contagem.'],
  ['demo_cert_einstein_ads_duplicate', 'demo_einstein', 'course_ads', 'link_einstein_ads', 'ADS/0020015914', 'Certificado duplicado', 'Cursos livres', 30, 'rejeitado', 'analise_manual', 0, 'Duplicado de um certificado ja aprovado.'],
  ['demo_cert_einstein_jd_approved', 'demo_einstein', 'course_jogos_digitais', 'link_einstein_jd', 'JD/0020015915', 'Fundamentos de Game Design', 'Cursos livres', 20, 'aprovado', 'aprovado_automatico', 20, 'Certificado aprovado no segundo vinculo.'],
  ['demo_cert_izabel_jd_courses', 'demo_izabel', 'course_jogos_digitais', 'link_izabel_jd', 'JD/0020015917', 'Desenvolvimento de Jogos 2D', 'Cursos livres', 40, 'aprovado', 'aprovado_automatico', 40, 'Certificado aprovado.'],
  ['demo_cert_izabel_jd_extension', 'demo_izabel', 'course_jogos_digitais', 'link_izabel_jd', 'JD/0020015917', 'Projeto de Extensao em Jogos', 'Extensao', 40, 'aprovado', 'aprovado_automatico', 40, 'Certificado aprovado.'],
  ['demo_cert_izabel_jd_monitoring', 'demo_izabel', 'course_jogos_digitais', 'link_izabel_jd', 'JD/0020015917', 'Monitoria de Programacao de Jogos', 'Monitoria', 20, 'aprovado', 'aprovado_automatico', 20, 'Certificado aprovado.'],
];

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlDataUrl(html) {
  return `data:text/html;charset=utf-8;base64,${Buffer.from(String(html || ''), 'utf8').toString('base64')}`;
}

function certificateFile(title, hours) {
  const safeTitle = escapeHtml(title);
  const safeHours = Number(hours || 0);
  return htmlDataUrl(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #0d2b5c; background: #f4f6f9; }
    .page { max-width: 900px; margin: 40px auto; padding: 56px; background: #fff; border: 10px solid #0d2b5c; box-shadow: 0 16px 40px rgba(13,43,92,.18); }
    .brand { color: #ff7a00; font-size: 18px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 34px 0 12px; font-size: 42px; letter-spacing: .04em; text-align: center; }
    .subtitle { text-align: center; font-size: 18px; color: #64748b; }
    .course { margin: 40px 0; padding: 28px; border: 1px solid #d9e2ef; border-radius: 18px; text-align: center; }
    .course strong { display: block; margin-top: 10px; font-size: 28px; color: #0d2b5c; }
    .footer { display: flex; justify-content: space-between; margin-top: 56px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <main class="page">
    <div class="brand">SIGAC | SENAC</div>
    <h1>Certificado</h1>
    <p class="subtitle">Documento controlado para demonstracao do fluxo de validacao.</p>
    <section class="course">
      Certificamos a participacao na atividade
      <strong>${safeTitle}</strong>
      <p>Carga horaria declarada: ${safeHours}h</p>
    </section>
    <div class="footer">
      <span>Emitido para a base de apresentacao SIGAC</span>
      <span>05/06/2026</span>
    </div>
  </main>
</body>
</html>`);
}

async function verifySeed(client) {
  const expectedSiglas = COURSES.map((course) => course[1]);
  const courseResult = await client.query('SELECT sigla FROM courses WHERE ativo = 1 AND sigla = ANY($1::text[])', [expectedSiglas]);
  if (courseResult.rowCount !== expectedSiglas.length) throw new Error('Validacao falhou: catalogo Senac incompleto.');

  const activeCourseResult = await client.query('SELECT COUNT(*)::int AS total FROM courses WHERE ativo = 1');
  if (Number(activeCourseResult.rows[0]?.total || 0) !== expectedSiglas.length) {
    throw new Error(`Validacao falhou: base de demonstracao deveria ter ${expectedSiglas.length} cursos ativos, recebeu ${activeCourseResult.rows[0]?.total || 0}.`);
  }

  const fakeResult = await client.query(`
    SELECT sigla FROM courses
    WHERE ativo = 1 AND (sigla ~ '^D[0-9]{3}$' OR sigla = ANY($1::text[]))
  `, [['ADS2', 'BD2', 'ADM2', 'LOG2']]);
  if (fakeResult.rowCount) throw new Error(`Validacao falhou: cursos ficticios ativos: ${fakeResult.rows.map((row) => row.sigla).join(', ')}`);

  const linkResult = await client.query(`
    SELECT user_id, COUNT(*)::int AS total
    FROM student_courses
    WHERE ativo = 1
    GROUP BY user_id
    HAVING COUNT(*) > 2
  `);
  if (linkResult.rowCount) throw new Error('Validacao falhou: existe aluno com mais de dois vinculos ativos.');

  const progressResult = await client.query(`
    WITH submission_hours AS (
      SELECT s.student_id, a.course_id, SUM(a.horas)::int AS hours
      FROM submissions s
      JOIN activities a ON a.id = s.activity_id
      WHERE s.current_status = 'aprovado'
      GROUP BY s.student_id, a.course_id
    ), certificate_hours AS (
      SELECT sender_id AS student_id, course_id, SUM(approved_hours)::int AS hours
      FROM certificates
      WHERE admin_status = 'aprovado'
      GROUP BY sender_id, course_id
    )
    SELECT sc.user_id, sc.course_id,
      COALESCE(sh.hours, 0) + COALESCE(ch.hours, 0) AS approved_hours
    FROM student_courses sc
    LEFT JOIN submission_hours sh ON sh.student_id = sc.user_id AND sh.course_id = sc.course_id
    LEFT JOIN certificate_hours ch ON ch.student_id = sc.user_id AND ch.course_id = sc.course_id
    WHERE sc.user_id IN ('demo_einstein', 'demo_hilccer', 'demo_izabel')
  `);
  const progress = new Map(progressResult.rows.map((row) => [`${row.user_id}:${row.course_id}`, Number(row.approved_hours)]));
  const expected = new Map([
    ['demo_einstein:course_ads', 50],
    ['demo_einstein:course_jogos_digitais', 20],
    ['demo_hilccer:course_ads', 0],
    ['demo_izabel:course_jogos_digitais', 120],
  ]);
  for (const [key, hours] of expected) {
    if (progress.get(key) !== hours) throw new Error(`Validacao falhou: ${key} deveria possuir ${hours}h, recebeu ${progress.get(key)}h.`);
  }
}

async function seed(client) {
  const createdAt = nowIso();
  const passwordHash = hashPassword(PASSWORD);

  await client.query(`
    INSERT INTO settings (key, value) VALUES
      ('horasMetaPadrao', '120'),
      ('emailNotificationsEnabled', 'true'),
      ('ocrDisponivel', 'true'),
      ('presentationBase', 'senac-demo'),
      ('updatedAt', $1)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `, [createdAt]);

  for (const course of COURSES) {
    await client.query(`
      INSERT INTO courses (id, sigla, nome, area, turno, horas_meta, ativo)
      VALUES ($1, $2, $3, $4, $5, $6, 1)
      ON CONFLICT (id) DO UPDATE SET sigla = EXCLUDED.sigla, nome = EXCLUDED.nome, area = EXCLUDED.area,
        turno = EXCLUDED.turno, horas_meta = EXCLUDED.horas_meta, ativo = 1
    `, course);
  }

  for (const [id, nome, email, tipo, courseId, matricula] of USERS) {
    await client.query(`
      INSERT INTO users (id, nome, email, senha_hash, tipo, ativo, course_id, matricula, must_change_password, password_updated_at, created_at)
      VALUES ($1, $2, $3, $4, $5, 1, $6, $7, 0, $8, $8)
      ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, email = EXCLUDED.email, senha_hash = EXCLUDED.senha_hash,
        tipo = EXCLUDED.tipo, ativo = 1, course_id = EXCLUDED.course_id, matricula = EXCLUDED.matricula,
        must_change_password = 0, password_updated_at = EXCLUDED.password_updated_at
    `, [id, nome, email, passwordHash, tipo, courseId, matricula, createdAt]);
  }

  for (const courseId of ['course_ads', 'course_jogos_digitais', 'course_tds']) {
    await client.query('INSERT INTO coordinator_courses (user_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', ['demo_coordinator', courseId]);
  }
  for (const [id, userId, courseId, matricula] of STUDENT_LINKS) {
    await client.query(`
      INSERT INTO student_courses (id, user_id, course_id, matricula, ativo, created_at)
      VALUES ($1, $2, $3, $4, 1, $5)
      ON CONFLICT (user_id, course_id) DO UPDATE SET id = EXCLUDED.id, matricula = EXCLUDED.matricula, ativo = 1
    `, [id, userId, courseId, matricula, createdAt]);
  }

  for (const [courseId] of COURSES) {
    for (const [category, limit, minimum] of RULES) {
      const slug = category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\W+/g, '_').toLowerCase();
      await client.query(`
        INSERT INTO activity_rules
          (id, course_id, categoria, limite_maximo, carga_minima, exige_certificado, exige_aprovacao, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, 1, 1, 'demo_admin', $6)
        ON CONFLICT (id) DO UPDATE SET limite_maximo = EXCLUDED.limite_maximo, carga_minima = EXCLUDED.carga_minima
      `, [`demo_rule_${courseId}_${slug}`, courseId, category, limit, minimum, createdAt]);
    }
  }

  for (const [id, title, description, courseId, hours, category] of ACTIVITIES) {
    await client.query(`
      INSERT INTO activities (id, titulo, descricao, course_id, horas, prazo, material_nome, material_arquivo, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, '', $6, $7, 'demo_coordinator', $8)
      ON CONFLICT (id) DO UPDATE SET titulo = EXCLUDED.titulo, descricao = EXCLUDED.descricao, horas = EXCLUDED.horas
    `, [id, title, description, courseId, hours, `${category.toLowerCase().replace(/\W+/g, '-')}.txt`, textDataUrl(description), createdAt]);
  }

  for (const [id, activityId, studentId, status, category, hours, feedback] of SUBMISSIONS) {
    await client.query(`
      INSERT INTO submissions (id, activity_id, student_id, current_status)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET current_status = EXCLUDED.current_status
    `, [id, activityId, studentId, status]);
    await client.query('DELETE FROM submission_versions WHERE submission_id = $1', [id]);
    await client.query(`
      INSERT INTO submission_versions
        (submission_id, version, arquivo_nome, arquivo_data, observacao, status, feedback, enviada_em, avaliada_em, categoria, horas_declaradas, descricao)
      VALUES ($1, 1, $2, $3, 'Dado controlado de demonstracao.', $4, $5, $6, $6, $7, $8, $9)
    `, [id, `${id}.txt`, textDataUrl(feedback), status, feedback, createdAt, category, hours, feedback]);
  }

  for (const [id, senderId, courseId, linkId, matricula, title, category, hours, adminStatus, ocrStatus, approvedHours, feedback] of CERTIFICATES) {
    await client.query(`
      INSERT INTO certificates (
        id, sender_id, sender_type, course_id, vinculo_id, student_course_id, matricula, category,
        file_name, file_data, observation, declared_hours, extracted_text, detected_hours, detected_name,
        detected_institution, detected_date, detected_title, detected_course_name, found_fields, missing_fields,
        confidence_score, human_summary, ocr_status, ocr_reason, admin_status, admin_feedback, approved_hours,
        created_at, reviewed_at, reviewed_by, ocr_processed_at, batch_id, batch_observation
      ) VALUES (
        $1, $2, 'aluno', $3, $4, $4, $5, $6, $7, $8, $9, $10, $9, $10, '', 'Senac',
        '05/06/2026', $9, $11, '["titulo","instituicao","carga_horaria"]', '[]', 95, $12, $13,
        $12, $14, $12, $15, $16, $16, 'demo_admin', $16, $17, 'Lote controlado de demonstracao.'
      )
      ON CONFLICT (id) DO UPDATE SET admin_status = EXCLUDED.admin_status, ocr_status = EXCLUDED.ocr_status,
        approved_hours = EXCLUDED.approved_hours, admin_feedback = EXCLUDED.admin_feedback
    `, [
      id, senderId, courseId, linkId, matricula, category, `${title}.html`, certificateFile(title, hours), title,
      hours, courseId === 'course_ads' ? 'Analise e Desenvolvimento de Sistemas' : 'Jogos Digitais',
      feedback, ocrStatus, adminStatus, approvedHours, createdAt, `batch_${id}`,
    ]);
  }

  const opportunities = [
    ['demo_opp_monitoria', 'Monitoria de Programacao', 'Apoio aos laboratorios de programacao do Senac.', 20, 'Monitoria'],
    ['demo_opp_hackathon', 'Hackathon de Inovacao', 'Desafio interdisciplinar com mentoria e apresentacao final.', 16, 'Projetos'],
    ['demo_opp_volunteer', 'Voluntariado em Inclusao Digital', 'Acao de extensao para a comunidade.', 12, 'Extensao'],
  ];
  for (const [id, title, description, hours, category] of opportunities) {
    await client.query(`
      INSERT INTO opportunities (id, titulo, descricao, horas, criado_por, criado_em, categoria, status)
      VALUES ($1, $2, $3, $4, 'demo_admin', $5, $6, 'Aberta')
      ON CONFLICT (id) DO UPDATE SET titulo = EXCLUDED.titulo, descricao = EXCLUDED.descricao, horas = EXCLUDED.horas
    `, [id, title, description, hours, createdAt, category]);
  }

  await client.query(`
    INSERT INTO ml_execucoes
      (id, started_by, status, total_registros, total_aprovados, total_rejeitados, total_em_analise, taxa_aprovacao, started_at, finished_at)
    VALUES ('demo_ml_run', 'demo_admin', 'concluido', 4, 3, 1, 1, 75, $1, $1)
    ON CONFLICT (id) DO UPDATE SET finished_at = EXCLUDED.finished_at
  `, [createdAt]);
  const risks = [
    ['demo_risk_einstein_ads', 'demo_einstein', 'Einstein IB Neves', 'einsteinbritoneves@gmail.com', 'ADS/0020015914', 'ADS', 120, 50, 42, 2, 2, 2, 'medio'],
    ['demo_risk_einstein_jd', 'demo_einstein', 'Einstein IB Neves', 'einsteinbritoneves@gmail.com', 'JD/0020015915', 'JD', 120, 20, 17, 1, 0, 0, 'medio'],
    ['demo_risk_hilccer_ads', 'demo_hilccer', 'Hilccer Rocha Araujo Melo', 'hilccer@sigac.local', 'ADS/0020015916', 'ADS', 120, 0, 0, 0, 0, 0, 'alto'],
    ['demo_risk_izabel_jd', 'demo_izabel', 'Izabel Santos', 'izabel@sigac.local', 'JD/0020015917', 'JD', 120, 120, 100, 4, 0, 0, 'baixo'],
  ];
  for (const risk of risks) {
    await client.query(`
      INSERT INTO ml_risco_alunos
        (id, execucao_id, aluno_id, aluno_nome, aluno_email, aluno_matricula, curso, meta_horas, horas_aprovadas,
         percentual_concluido, qtd_aprovadas, qtd_rejeitadas, qtd_pendentes, classificacao_risco, created_at)
      VALUES ($1, 'demo_ml_run', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET horas_aprovadas = EXCLUDED.horas_aprovadas, percentual_concluido = EXCLUDED.percentual_concluido,
        classificacao_risco = EXCLUDED.classificacao_risco, created_at = EXCLUDED.created_at
    `, [...risk, createdAt]);
  }

  await client.query(`
    INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details, created_at)
    VALUES ('demo_audit_seed', 'demo_admin', 'seed_demo_senac', 'sistema', 'base-demonstracao', 'Base profissional Senac criada.', $1)
    ON CONFLICT (id) DO UPDATE SET created_at = EXCLUDED.created_at
  `, [createdAt]);
}

async function main() {
  const target = databaseTarget();
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production' && process.env.SEED_PRODUCTION_CONFIRM !== 'SIM') {
    throw new Error('Seed bloqueado em producao. Defina SEED_PRODUCTION_CONFIRM=SIM somente apos backup.');
  }
  console.log(`Criando base Senac em ${target.host}/${target.database}...`);
  const client = createClient();
  await client.connect();
  try {
    if (process.env.SEED_DRY_RUN === 'SIM') {
      await client.query('BEGIN');
      try {
        const existing = new Set(await listPublicTables(client));
        const tables = RESET_TABLES.filter((table) => existing.has(table));
        await client.query(`TRUNCATE TABLE ${tables.map(quoteIdentifier).join(', ')} RESTART IDENTITY CASCADE`);
        await seed(client);
        await verifySeed(client);
      } finally {
        await client.query('ROLLBACK');
      }
      console.log('Seed Senac validado em dry-run; todas as alteracoes foram revertidas.');
      return;
    }
    await withTransaction(client, async () => {
      await seed(client);
      await verifySeed(client);
    });
    console.log('Seed Senac concluido.');
    console.log('Acessos de demonstracao usam a senha 123456.');
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[SIGAC seed] ${error.message || error}`);
    process.exit(1);
  });
}

module.exports = { seed, verifySeed };
