export function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function percentValue(value, { clamp = true } = {}) {
  const parsed = numberOrZero(value);
  const normalized = clamp ? Math.max(0, Math.min(100, parsed)) : Math.max(0, parsed);
  return Math.round(normalized);
}

export function formatPercent(value, options = {}) {
  return `${percentValue(value, options)}%`;
}

export function formatPercentDecimal(value, { clamp = true } = {}) {
  const parsed = numberOrZero(value);
  const normalized = clamp ? Math.max(0, Math.min(100, parsed)) : Math.max(0, parsed);
  return `${normalized.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;
}

export function formatHours(value) {
  const parsed = numberOrZero(value);
  const display = parsed.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: parsed % 1 === 0 ? 0 : 1 });
  return `${display} h`;
}

export function latestVersion(submission) {
  const versions = Array.isArray(submission?.versions) ? submission.versions : [];
  return versions[versions.length - 1] || null;
}

export function formatDate(value) {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('pt-BR');
}

export function maskIsoDate(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export function isValidIsoDate(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const date = new Date(`${raw}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === raw;
}

export function maskBrazilianDate(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

export function brazilianDateToIso(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function isValidBrazilianDate(value) {
  return isValidIsoDate(brazilianDateToIso(value));
}

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function statusLabel(value) {
  const normalized = String(value || '').toLowerCase();
  const map = {
    aprovado: 'Aprovado',
    rejeitado: 'Rejeitado',
    em_analise: 'Em análise',
    pendente: 'Pendente',
    nao_processado: 'Não processado',
    analise_manual: 'Análise manual',
    aprovado_automatico: 'Aprovado automático',
  };
  return map[normalized] || String(value || 'Sem status').replaceAll('_', ' ');
}
