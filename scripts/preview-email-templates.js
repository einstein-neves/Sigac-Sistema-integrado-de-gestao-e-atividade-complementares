const fs = require('fs');
const path = require('path');

const { emailTemplates } = require('../server');

const OUT_DIR = path.join(__dirname, '..', 'exports', 'email-previews');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writePreview(name, email) {
  const html = [
    '<!doctype html>',
    '<html lang="pt-BR">',
    '<head><meta charset="utf-8"><title>',
    email.subject,
    '</title></head>',
    '<body>',
    email.html,
    '</body></html>',
  ].join('');
  fs.writeFileSync(path.join(OUT_DIR, `${name}.html`), html, 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, `${name}.txt`), `Assunto: ${email.subject}\n\n${email.text}`, 'utf8');
  console.log(`${name}: ${email.subject}`);
}

function main() {
  ensureDir(OUT_DIR);
  const base = {
    requestId: 'sub_123456789',
    studentName: 'Arthur Cunha',
    course: 'ADS - Análise e Desenvolvimento de Sistemas',
    title: 'Participação em palestra sobre tecnologia',
    proofName: 'comprovante-palestra.pdf',
    category: 'palestra',
    hours: 8,
    sentAt: '2026-05-26T23:05:00.000Z',
    reviewedAt: '2026-05-27T10:15:00.000Z',
  };

  writePreview('01-solicitacao-registrada', emailTemplates.submissionRegistered(base));
  writePreview('02-nova-solicitacao-coordenador', emailTemplates.coordinatorNewSubmission(base));
  writePreview('03-solicitacao-aprovada', emailTemplates.submissionApproved(base));
  writePreview('04-solicitacao-recusada', emailTemplates.submissionRejected({
    ...base,
    feedback: 'O comprovante enviado não apresenta a carga horária do evento. Envie um documento atualizado com essa informação.'
  }));
  writePreview('05-solicitacao-ajustes', emailTemplates.correctionRequested({
    ...base,
    feedback: 'Corrija a instituição organizadora e anexe o comprovante completo para nova análise.'
  }));

  console.log(`Previews gerados em: ${OUT_DIR}`);
}

main();
