const fs = require('node:fs/promises');
const path = require('node:path');
const {
  createClient,
  databaseTarget,
  listPublicTables,
  quoteIdentifier,
} = require('./demo-database-utils');

const ROOT = path.resolve(__dirname, '..');
const EXPORTS_DIR = path.join(ROOT, 'exports');
const SECRET_FIELDS = new Set([
  'senha_hash',
  'token',
  'token_hash',
  'challenge_token_hash',
  'code_hash',
]);
const LARGE_FIELDS = new Set(['file_data', 'arquivo_data', 'material_arquivo']);

function stamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

function summarizeValue(field, value) {
  if (value == null) return value;
  if (SECRET_FIELDS.has(field)) return '[REDACTED]';
  if (LARGE_FIELDS.has(field)) {
    return {
      redacted: true,
      characters: String(value).length,
      dataUrlType: /^data:([^;,]+)/.exec(String(value))?.[1] || '',
    };
  }
  return value;
}

function sanitizeRow(row) {
  return Object.fromEntries(Object.entries(row).map(([field, value]) => [field, summarizeValue(field, value)]));
}

async function main() {
  const target = databaseTarget();
  const client = createClient();
  await client.connect();
  try {
    const tables = await listPublicTables(client);
    const counts = {};
    const data = {};
    for (const table of tables) {
      const result = await client.query(`SELECT * FROM ${quoteIdentifier(table)}`);
      counts[table] = result.rowCount;
      data[table] = result.rows.map(sanitizeRow);
    }

    const payload = {
      format: 'sigac-sanitized-backup-v1',
      exportedAt: new Date().toISOString(),
      database: { host: target.host, database: target.database },
      notice: 'Senhas, tokens e conteudos binarios foram removidos deste backup sanitizado.',
      counts,
      data,
    };
    await fs.mkdir(EXPORTS_DIR, { recursive: true });
    const output = path.join(EXPORTS_DIR, `backup-sigac-${stamp()}.json`);
    await fs.writeFile(output, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Backup sanitizado salvo em: ${output}`);
    console.log(JSON.stringify(counts, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`[SIGAC backup] ${error.message || error}`);
  process.exit(1);
});
