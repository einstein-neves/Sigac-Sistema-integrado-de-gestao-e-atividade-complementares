const {
  assertResetAllowed,
  createClient,
  listPublicTables,
  quoteIdentifier,
  withTransaction,
} = require('./demo-database-utils');

const RESET_TABLES = [
  'certificate_review_items',
  'two_factor_challenges',
  'password_reset_tokens',
  'push_tokens',
  'sessions',
  'emails',
  'notifications',
  'coordination_messages',
  'submission_versions',
  'submissions',
  'activities',
  'certificates',
  'opportunity_registrations',
  'opportunities',
  'activity_rules',
  'audit_logs',
  'ml_risco_alunos',
  'ml_execucoes',
  'student_courses',
  'coordinator_courses',
  'users',
  'courses',
  'settings',
];

async function main() {
  assertResetAllowed();
  const client = createClient();
  await client.connect();
  try {
    const existing = new Set(await listPublicTables(client));
    const tables = RESET_TABLES.filter((table) => existing.has(table));
    await withTransaction(client, async () => {
      await client.query(`TRUNCATE TABLE ${tables.map(quoteIdentifier).join(', ')} RESTART IDENTITY CASCADE`);
    });
    console.log(`Reset concluido. ${tables.length} tabelas de dados foram limpas sem remover estrutura.`);
    console.log('Execute npm run seed:senac para criar a base profissional de demonstracao.');
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[SIGAC reset] ${error.message || error}`);
    process.exit(1);
  });
}

module.exports = { RESET_TABLES };
