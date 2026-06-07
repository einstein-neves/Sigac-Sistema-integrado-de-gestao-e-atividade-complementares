require('dotenv').config({ quiet: true });

const nodemailer = require('nodemailer');

function isPlaceholder(value) {
  return /^<[^>]+>$/.test(String(value || '').trim());
}

function readConfig() {
  const mode = String(process.env.EMAIL_MODE || 'mock').toLowerCase();
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 0);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const from = String(process.env.SMTP_FROM || '').trim();
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';

  return {
    mode,
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    from,
    enabled: mode === 'smtp'
      && host
      && port
      && from
      && user
      && pass
      && !isPlaceholder(user)
      && !isPlaceholder(pass)
      && !String(from).includes('<MEU_EMAIL_GMAIL>'),
  };
}

async function main() {
  const to = String(process.argv[2] || '').trim();
  if (!to) {
    throw new Error('Informe o destinatario: npm run smtp:test -- seuemail@exemplo.com');
  }

  const config = readConfig();
  if (!config.enabled) {
    throw new Error('SMTP nao configurado. Defina EMAIL_MODE=smtp, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e SMTP_FROM no .env.');
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  await transporter.verify();
  const result = await transporter.sendMail({
    from: config.from,
    to,
    subject: 'SIGAC - teste de SMTP',
    text: [
      'Este e um e-mail de teste do SIGAC.',
      '',
      'Se voce recebeu esta mensagem, o SMTP real esta configurado corretamente.',
    ].join('\n'),
  });

  console.log(`SMTP OK. Mensagem enviada para ${to}. ID: ${result.messageId || 'sem-id'}`);
}

main().catch((error) => {
  console.error(`Falha no teste SMTP: ${error.message}`);
  process.exit(1);
});
