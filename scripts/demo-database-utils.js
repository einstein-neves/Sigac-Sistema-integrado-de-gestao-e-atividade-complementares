require('dotenv').config({ quiet: true });

const crypto = require('node:crypto');
const { Client } = require('pg');

function getSslConfig(databaseUrl) {
  const mode = /(?:^|[?&])sslmode=([^&]+)/i.exec(databaseUrl)?.[1]?.toLowerCase()
    || /(?:^|[?&])ssl=(true|1)/i.exec(databaseUrl)?.[1]?.toLowerCase();
  if (['false', '0', 'disable', 'off'].includes(mode || '')) return false;
  if (['true', '1', 'require', 'on', 'verify-full', 'verify-ca', 'prefer'].includes(mode || '')) {
    return { rejectUnauthorized: true };
  }
  return undefined;
}

function databaseTarget() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL nao definido.');
  const parsed = new URL(databaseUrl);
  return {
    databaseUrl,
    host: parsed.hostname,
    database: parsed.pathname.replace(/^\/+/, ''),
    username: decodeURIComponent(parsed.username || ''),
  };
}

function createClient() {
  const target = databaseTarget();
  return new Client({
    connectionString: target.databaseUrl,
    ssl: getSslConfig(target.databaseUrl),
  });
}

function assertResetAllowed() {
  const target = databaseTarget();
  console.warn('ATENCAO: este comando vai apagar dados de teste do banco configurado em DATABASE_URL.');
  console.warn(`Destino: ${target.host}/${target.database}`);
  if (process.env.RESET_CONFIRM !== 'SIM') {
    throw new Error('Reset abortado. Defina RESET_CONFIRM=SIM para confirmar.');
  }
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production' && process.env.RESET_PRODUCTION_CONFIRM !== 'SIM') {
    throw new Error('Reset bloqueado em producao. Alem de RESET_CONFIRM=SIM, defina RESET_PRODUCTION_CONFIRM=SIM.');
  }
  return target;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function textDataUrl(text) {
  return `data:text/plain;base64,${Buffer.from(String(text || ''), 'utf8').toString('base64')}`;
}

function nowIso() {
  return new Date().toISOString();
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function listPublicTables(client) {
  const result = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return result.rows.map((row) => row.table_name);
}

async function withTransaction(client, callback) {
  await client.query('BEGIN');
  try {
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

module.exports = {
  assertResetAllowed,
  createClient,
  databaseTarget,
  hashPassword,
  listPublicTables,
  nowIso,
  quoteIdentifier,
  textDataUrl,
  withTransaction,
};
