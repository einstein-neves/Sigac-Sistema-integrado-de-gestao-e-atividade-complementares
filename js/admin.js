// =========================================================
// SIGAC - JS comentado: admin.js
// Objetivo: orientar a equipe sobre a função deste arquivo.
// Comentários não aparecem para o usuário final.
// =========================================================

(function () {
  'use strict';

  let chartApproval = null;
  let chartStatus = null;
  let globalSearchTerm = '';
  let lastMlData = null;

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const formatDate = (value) => value ? new Date(value).toLocaleString('pt-BR') : 'Sem data';
  const percent = (value, options) => window.SIGACFormat?.percentValue(value, options) ?? Math.max(0, Math.min(100, Math.round(Number(value || 0))));
  const formatPercent = (value, options) => window.SIGACFormat?.formatPercent(value, options) ?? `${percent(value, options)}%`;
  const formatPercentDecimal = (value, options) => window.SIGACFormat?.formatPercentDecimal(value, options) ?? `${percent(value, options)}%`;
  const formatHours = (value) => window.SIGACFormat?.formatHours(value) ?? `${Number(value || 0).toLocaleString('pt-BR')} h`;
  const getInitial = (value) => (String(value || '?').trim().charAt(0).toUpperCase() || '?');
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const matchesSearch = (value) => !globalSearchTerm || normalize(value).includes(globalSearchTerm);
  const ensureArray = (value) => Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : Array.isArray(value?.data) ? value.data : [];
  const fixMojibake = (value) => String(value || '');
  function repairVisibleText(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return /Ã|Â|â/.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      node.nodeValue = fixMojibake(node.nodeValue);
    });
    root.querySelectorAll?.('[placeholder], [title], [aria-label], option').forEach((element) => {
      ['placeholder', 'title', 'aria-label'].forEach((attribute) => {
        if (element.hasAttribute(attribute)) element.setAttribute(attribute, fixMojibake(element.getAttribute(attribute)));
      });
      if (element.tagName === 'OPTION') element.textContent = fixMojibake(element.textContent);
    });
  }
  const sectionTitles = {
    dashboard: 'Dashboard',
    usuarios: 'Usuários',
    cursos: 'Cursos',
    vinculos: 'Vínculos',
    regras: 'Regras',
    oportunidades: 'Oportunidades',
    envios: 'Envios de atividades',
    certificados: 'Certificados',
    relatorios: 'Relatórios',
    notificacoes: 'Notificações',
    logs: 'Logs e auditoria',
    configuracoes: 'Configurações'
  };
  const opportunityCategories = [
    'Estágio',
    'Representante de sala',
    'Monitoria',
    'Evento',
    'Seminário',
    'Feira',
    'Visita técnica',
    'Minicurso',
    'Palestra',
    'Curso livre',
    'Workshop',
    'Projeto de extensão',
    'Hackathon'
  ];
  const ruleCategories = [
    'Ensino',
    'Pesquisa',
    'Extensão',
    'Eventos',
    'Cursos livres',
    'Monitoria',
    'Projetos',
    'Estágio',
    'Representante de sala',
    'Visita técnica',
    'Seminário',
    'Palestra',
    'Workshop'
  ];

  function setUserIdentity(user, roleLabel) {
    document.getElementById('userName').textContent = user.nome;
    document.getElementById('userRole').textContent = roleLabel;
    const initial = document.getElementById('userInitial');
    if (initial) {
      const firstLetter = String(user.nome || '?').trim().charAt(0).toUpperCase() || '?';
      initial.textContent = firstLetter;
    }
  }

  const notificationTemplates = [
    {
      id: 'solicitação-recebida',
      label: 'Solicitação recebida',
      subject: 'SIGAC - Solicitação recebida',
      body: 'Olá,\n\nregistramos sua solicitação no SIGAC e ela já está na fila de acompanhamento.\n\nRevise os detalhes no painel e mantenha a documentação atualizada.\n\nEquipe SIGAC.'
    },
    {
      id: 'atividade-aprovada',
      label: 'Atividade aprovada',
      subject: 'SIGAC - Atividade aprovada',
      body: 'Olá,\n\numa atividade complementar foi aprovada no SIGAC.\n\nConfira a carga horaria contabilizada e acompanhe seu progresso atualizado no painel.\n\nEquipe SIGAC.'
    },
    {
      id: 'correcao-solicitada',
      label: 'Correção solicitada',
      subject: 'SIGAC - Correção solicitada',
      body: 'Olá,\n\nidentificamos a necessidade de ajustar um envio recente.\n\nAcesse o SIGAC, leia o feedback registrado e reenvie a documentação solicitada.\n\nEquipe SIGAC.'
    },
    {
      id: 'prazo-proximo',
      label: 'Prazo se aproximando',
      subject: 'SIGAC - Prazo se aproximando',
      body: 'Olá,\n\nalguns prazos importantes estão próximos no SIGAC.\n\nRevise suas pendências, atividades abertas e certificados para evitar atrasos.\n\nEquipe SIGAC.'
    }
  ];
  const notificationKindLabels = {
    geral: 'Comunicado geral',
    'solicitação-recebida': 'Solicitação recebida',
    'atividade-aprovada': 'Atividade aprovada',
    'correcao-solicitada': 'Correção solicitada',
    'prazo-proximo': 'Prazo se aproximando',
    'certificado-avaliação': 'Certificado avaliado'
  };
  const notificationDraft = {
    templateId: notificationTemplates[0].id,
    audienceId: 'students-all',
    subject: notificationTemplates[0].subject,
    message: notificationTemplates[0].body
  };
  const auditFilters = {
    query: '',
    action: '',
    actor: '',
    period: 'all'
  };

  function showMessage(id, text, type) {
    const box = document.getElementById(id);
    if (!box) return;
    box.textContent = fixMojibake(text);
    box.className = `message ${type}`;
    box.classList.remove('hidden');
  }

  function isAuthError(error) {
    return [401, 403].includes(Number(error?.status || 0));

  }


  function renderBootstrapError(message) {
    const dashboard = document.getElementById('dashboard');
    if (!dashboard) return;
    dashboard.innerHTML = `
      <div class="card">
        <div class="section-title">
          <h2>Painel temporariamente indisponível</h2>
          <span class="small">A sessão foi mantida</span>
        </div>
        <p>${escapeHtml(message)}</p>
        <p class="small">Tente recarregar a página. Se o erro persistir, verifique o console e o backend.</p>
      </div>
    `;
  }

  function badgeClass(status) {
    return {
      aprovado: 'aprovado',
      aprovada: 'aprovado',
      rejeitado: 'rejeitado',
      rejeitada: 'rejeitado',
      removido: 'rejeitado',
      removido_da_contagem: 'rejeitado',
      pendente: 'em_analise',
      em_analise: 'em_analise',
      correcao: 'correcao',
      aprovado_automatico: 'aprovado',
      rejeitado_automatico: 'rejeitado',
      analise_manual: 'em_analise',
      nao_processado: 'em_analise'
    }[status] || 'em_analise';
  }

  function statusLabel(status) {
    const labels = {
      nao_processado: 'Aguardando pr\u00e9-an\u00e1lise do OCR',
      analise_manual: 'Pr\u00e9-an\u00e1lise com revis\u00e3o manual',
      aprovado_automatico: 'Pr\u00e9-an\u00e1lise aprovada',
      rejeitado_automatico: 'Pr\u00e9-an\u00e1lise inconclusiva',
      pendente: 'Pendente',
      aprovado: 'Aprovado',
      rejeitado: 'Rejeitado',
      removido: 'Removido da contagem',
      removido_da_contagem: 'Removido da contagem'
    };
    return labels[String(status || 'pendente')] || String(status || 'pendente').replaceAll('_', ' ');
  }

  function formatOcrFieldLabel(field) {
    const labels = {
      'titulo do certificado': 't\u00edtulo do certificado',
      't\u00edtulo do certificado': 't\u00edtulo do certificado',
      'nome do participante': 'nome do participante',
      'carga horaria': 'carga hor\u00e1ria',
      'carga hor\u00e1ria': 'carga hor\u00e1ria',
      data: 'data',
      instituicao: 'institui\u00e7\u00e3o',
      institui\u00e7\u00e3o: 'institui\u00e7\u00e3o',
      'curso/evento': 'curso/evento'
    };
    const key = String(field || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    return labels[key] || String(field || '').trim();
  }

  function formatOcrFieldList(fields) {
    const seen = new Set();
    return (Array.isArray(fields) ? fields : [])
      .map((field) => formatOcrFieldLabel(field))
      .filter(Boolean)
      .filter((field) => {
        const key = String(field).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function notificationKindLabel(kind) {
    if (notificationKindLabels[kind]) return notificationKindLabels[kind];
    return String(kind || 'geral')
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Comunicado';
  }

  function titleCase(value) {
    return String(value || '')
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function auditActionLabel(action) {
    return titleCase(String(action || 'ação').replaceAll('_', ' '));
  }

  function auditEntityLabel(entityType) {
    const map = {
      user: 'Usuário',
      users: 'Usuários',
      student: 'Aluno',
      coordinator: 'Coordenação',
      course: 'Curso',
      rule: 'Regra',
      opportunity: 'Oportunidade',
      submission: 'Envio',
      certificate: 'Certificado',
      email: 'Comunicação',
      settings: 'Configuração',
      auth: 'Autenticação'
    };
    return map[String(entityType || '').toLowerCase()] || titleCase(String(entityType || 'operacao').replaceAll('_', ' '));
  }

  function auditSeverity(log) {
    const action = String(log.action || '').toLowerCase();
    const details = String(log.details || '').toLowerCase();
    if (/(reset|rejeit|erro|falha|delete|remove|desativ|inativ|negad|unauthor)/.test(action) || /(reset|rejeit|erro|falha|desativ|inativ)/.test(details)) return 'critical';
    if (/(review|ocr|status|vincul|assign|update|avali)/.test(action) || /(pendente|correção|análise)/.test(details)) return 'attention';
    if (/(create|email|login|upload|export|approve|aprov)/.test(action)) return 'positive';
    return 'neutral';
  }

  function auditSeverityLabel(severity) {
    return {
      critical: 'Crítico',
      attention: 'Atenção',
      positive: 'Operacional',
      neutral: 'Rastreio'
    }[severity] || 'Rastreio';
  }

  function auditPeriodMatch(log, period) {
    if (!period || period === 'all') return true;
    const createdAt = new Date(log.createdAt || 0).getTime();
    if (!createdAt) return false;
    const now = Date.now();
    const ranges = {
      today: 1,
      '7d': 7,
      '30d': 30
    };
    const days = ranges[period];
    return days ? (now - createdAt) <= days * 86400000 : true;
  }

  function buildAuditSummary(logs) {
    return {
      total: logs.length,
      critical: logs.filter((log) => auditSeverity(log) === 'critical').length,
      actors: new Set(logs.map((log) => log.actorName || 'Sistema')).size,
      actions: new Set(logs.map((log) => log.action || '')).size
    };
  }

  function ensureLogsLayout() {
    const section = document.getElementById('logs');
    const card = section?.querySelector('.card');
    if (!card || card.dataset.enhanced === 'true') return;
    card.dataset.enhanced = 'true';
    card.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Logs e auditoria</h2>
          <span id="auditLogMeta" class="small">Rastreabilidade de aprovações, vínculos, regras e comunicações</span>
        </div>
      </div>
      <div class="audit-shell">
        <div class="audit-toolbar">
          <div class="field audit-search-field">
            <label for="auditSearchInput">Busca</label>
            <input id="auditSearchInput" type="search" placeholder="Buscar por ação, usuário, detalhe ou entidade">
          </div>
          <div class="field">
            <label for="auditActionFilter">Tipo de ação</label>
            <select id="auditActionFilter"></select>
          </div>
          <div class="field">
            <label for="auditActorFilter">Usuário</label>
            <select id="auditActorFilter"></select>
          </div>
          <div class="field">
            <label for="auditPeriodFilter">Periodo</label>
            <select id="auditPeriodFilter">
              <option value="all">Todo o histórico</option>
              <option value="today">Último dia</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>
          </div>
        </div>
        <div id="auditSummary" class="audit-summary-grid"></div>
        <div id="auditLogList" class="audit-timeline"></div>
      </div>
    `;
    window.SIGACCustomSelect?.refreshAll?.();
  }

  function ensureSettingsLayout() {
    const section = document.getElementById('configuracoes');
    const grid = section?.querySelector('.dual-grid');
    if (!grid || grid.dataset.enhanced === 'true') return;
    grid.dataset.enhanced = 'true';
    grid.innerHTML = `
      <div class="card settings-card">
        <div class="section-title">
          <div>
            <h2>Configurações do Administrador</h2>
            <span id="settingsMeta" class="small">Parâmetros operacionais, automações e manutenção segura</span>
          </div>
        </div>
        <form id="settingsForm" class="settings-form">
          <section class="settings-block">
            <div class="settings-block-head">
              <div>
                <span class="eyebrow">Parâmetros acadêmicos</span>
                <h3>Regras base do ambiente</h3>
              </div>
              <span class="settings-pill">Acadêmico</span>
            </div>
            <div class="settings-grid">
              <div class="field">
                <label for="horasMeta">Meta padrão do semestre</label>
                <input id="horasMeta" type="number" min="1" required>
                <span class="small">Valor usado como referência padrão da meta semestral dos cursos monitorados.</span>
              </div>
              <div class="settings-callout">
                <strong id="settingsHoursPreview">0 h</strong>
                <span>Meta padrão do semestre aplicada na operação atual</span>
              </div>
            </div>
          </section>

          <section class="settings-block">
            <div class="settings-block-head">
              <div>
                <span class="eyebrow">Automações</span>
                <h3>Fluxos assistidos e notificações</h3>
              </div>
              <span id="settingsAutomationSummary" class="settings-pill">2 recursos</span>
            </div>
            <div class="rule-options settings-rule-options">
              <label class="toggle-card settings-toggle-card" id="emailToggleCard">
                <input id="emailToggle" type="checkbox">
                <span class="toggle-copy">
                  <strong>Notificações por e-mail simuladas</strong>
                  <small>Registra envios na fila local para auditoria operacional.</small>
                </span>
                <span class="toggle-switch" aria-hidden="true"></span>
              </label>
              <label class="toggle-card settings-toggle-card" id="ocrToggleCard">
                <input id="ocrToggle" type="checkbox">
                <span class="toggle-copy">
                  <strong>Pré-validação OCR de certificados</strong>
                  <small>Permite processar certificados antes da revisão final do administrador.</small>
                </span>
                <span class="toggle-switch" aria-hidden="true"></span>
              </label>
            </div>
            <div class="notice small settings-inline-notice">As automações continuam respeitando o fluxo atual do SIGAC. Esta área apenas organiza e evidencia o estado operacional.</div>
          </section>

          <section class="settings-block settings-block-danger">
            <div class="settings-block-head">
              <div>
                <span class="eyebrow">Manutenção</span>
                <h3>Ações sensíveis do ambiente</h3>
              </div>
              <span class="settings-pill danger">Cautela</span>
            </div>
            <div class="settings-maintenance-grid">
              <button id="downloadEmailLog" type="button" class="secondary">Baixar log de e-mails simulados</button>
              <label class="toggle-card settings-toggle-card settings-danger-toggle" id="resetDemoToggleCard">
                <input id="resetDemoConfirm" type="checkbox">
                <span class="toggle-copy">
                  <strong>Confirmação de manutenção</strong>
                  <small>Entendo que resetar restaurará os dados de demonstração e deve ser usado apenas em manutenção.</small>
                </span>
                <span class="toggle-switch" aria-hidden="true"></span>
              </label>
              <button id="resetDemoBtn" type="button" class="danger" disabled>Resetar dados de demonstração</button>
            </div>
            <div class="settings-danger-note">
              <strong>Alerta</strong>
              <span>O reset continua exigindo confirmação explícita antes de executar a rotina já existente.</span>
            </div>
          </section>

          <div class="settings-actions">
            <button type="submit">Salvar configurações</button>
          </div>
        </form>
        <div id="settingsMessage" class="message info hidden"></div>
      </div>
      <div class="card settings-side-card">
        <div class="section-title">
          <div>
            <h2>Últimos e-mails simulados</h2>
            <span id="emailListMeta" class="small">Fila local usada para auditoria de comunicação</span>
          </div>
        </div>
        <div id="emailList" class="list"></div>
      </div>
    `;
  }

  function syncSettingsVisualState() {
    const horasMeta = document.getElementById('horasMeta');
    const emailToggle = document.getElementById('emailToggle');
    const ocrToggle = document.getElementById('ocrToggle');
    const resetConfirm = document.getElementById('resetDemoConfirm');
    const resetButton = document.getElementById('resetDemoBtn');

    const hoursPreview = document.getElementById('settingsHoursPreview');
    if (hoursPreview) hoursPreview.textContent = `${Number(horasMeta?.value || 0)} h`;

    const emailCard = document.getElementById('emailToggleCard');
    if (emailCard) emailCard.classList.toggle('is-active', !!emailToggle?.checked);

    const ocrCard = document.getElementById('ocrToggleCard');
    if (ocrCard) ocrCard.classList.toggle('is-active', !!ocrToggle?.checked);

    const resetCard = document.getElementById('resetDemoToggleCard');
    if (resetCard) resetCard.classList.toggle('is-active', !!resetConfirm?.checked);

    const automationSummary = document.getElementById('settingsAutomationSummary');
    if (automationSummary) {
      const activeCount = [emailToggle?.checked, ocrToggle?.checked].filter(Boolean).length;
      automationSummary.textContent = `${activeCount} recurso(s) ativo(s)`;
    }

    if (resetButton) resetButton.disabled = !resetConfirm?.checked;
  }

  function setupSettingsEnhancements() {
    ensureSettingsLayout();
    const form = document.getElementById('settingsForm');
    if (!form || form.dataset.enhanced === 'true') return;
    form.dataset.enhanced = 'true';

    ['horasMeta', 'emailToggle', 'ocrToggle', 'resetDemoConfirm'].forEach((id) => {
      const element = document.getElementById(id);
      const eventName = element?.type === 'number' ? 'input' : 'change';
      element?.addEventListener(eventName, syncSettingsVisualState);
    });
  }

  function setupLogsFilters() {
    ensureLogsLayout();
    const search = document.getElementById('auditSearchInput');
    const action = document.getElementById('auditActionFilter');
    const actor = document.getElementById('auditActorFilter');
    const period = document.getElementById('auditPeriodFilter');
    if (!search || search.dataset.bound === 'true') return;
    search.dataset.bound = 'true';

    search.addEventListener('input', () => {
      auditFilters.query = search.value.trim();
      renderLogs();
    });
    action?.addEventListener('change', () => {
      auditFilters.action = action.value;
      renderLogs();
    });
    actor?.addEventListener('change', () => {
      auditFilters.actor = actor.value;
      renderLogs();
    });
    period?.addEventListener('change', () => {
      auditFilters.period = period.value;
      renderLogs();
    });
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
  }

  function nl2br(value) {
    return escapeHtml(value || '').replace(/\n/g, '<br>');
  }

  function getNotificationAudiencePresets(data) {
    const users = SIGACStore.listUsers().filter((user) => user.ativo);
    const students = users.filter((user) => user.tipo === 'aluno');
    const coordinators = users.filter((user) => user.tipo === 'coordenador');
    const riskIds = new Set(getRiskStudents(data).map((student) => student.id));
    const pendingSubmissionIds = new Set(
      getSubmissions(data)
        .filter((submission) => ['pendente', 'em_analise', 'correcao'].includes(submission.latest?.status))
        .map((submission) => submission.studentId)
    );

    return [
      {
        id: 'students-all',
        label: 'Todos os alunos',
        description: 'Abrange todos os alunos ativos vinculados aos cursos.',
        recipients: students
      },
      {
        id: 'students-risk',
        label: 'Alunos em risco',
        description: 'Segmento com progresso abaixo de 60% da meta complementar.',
        recipients: students.filter((user) => riskIds.has(user.id))
      },
      {
        id: 'students-pending',
        label: 'Alunos com pendências',
        description: 'Inclui alunos com envios aguardando avaliação ou correção.',
        recipients: students.filter((user) => pendingSubmissionIds.has(user.id))
      },
      {
        id: 'coordinators-all',
        label: 'Coordenadores',
        description: 'Canal voltado para coordenadores ativos e vinculados.',
        recipients: coordinators
      }
    ];
  }

  function ensureNotificationDraftDefaults(data) {
    const templates = notificationTemplates;
    const audiences = getNotificationAudiencePresets(data);
    if (!templates.some((template) => template.id === notificationDraft.templateId)) {
      notificationDraft.templateId = templates[0].id;
    }
    if (!audiences.some((audience) => audience.id === notificationDraft.audienceId)) {
      notificationDraft.audienceId = audiences[0]?.id || 'students-all';
    }
    if (!notificationDraft.subject) {
      notificationDraft.subject = templates.find((template) => template.id === notificationDraft.templateId)?.subject || 'SIGAC - Comunicado';
    }
    if (!notificationDraft.message) {
      notificationDraft.message = templates.find((template) => template.id === notificationDraft.templateId)?.body || '';
    }
  }

  function summarizeRecipients(recipients) {
    if (!recipients.length) return 'Nenhum destinatário encontrado para o segmento atual.';
    const labels = recipients.slice(0, 3).map((user) => user.nome || user.email || 'Usuário');
    const summary = labels.join(', ');
    return recipients.length > 3 ? `${summary} e mais ${recipients.length - 3}.` : summary;
  }

  function splitRecipients(value) {
    return String(value || '')
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function getNotificationRecipientMeta(mail) {
    const recipients = splitRecipients(mail.to);
    const users = SIGACStore.listUsers();
    const details = recipients.map((email) => {
      const match = users.find((user) => String(user.email || '').toLowerCase() === email.toLowerCase());
      if (!match) return { email, label: email, role: '' };
      const role = match.tipo === 'aluno' ? 'Aluno' : match.tipo === 'coordenador' ? 'Coordenador' : 'Admin';
      return { email, label: match.nome || email, role };
    });

    return {
      count: details.length,
      summary: details.length ? details.map((item) => item.label).slice(0, 2).join(', ') : 'Sem destinatário',
      details
    };
  }

  function ensureNotificationsLayout() {
    const section = document.getElementById('notificacoes');
    const grid = section?.querySelector('.dual-grid');
    if (!grid || grid.dataset.enhanced === 'true') return;
    grid.dataset.enhanced = 'true';
    grid.classList.add('notification-management-stack');
    grid.innerHTML = `
      <div class="card notification-composer-card">
        <div class="section-title">
          <div>
            <h2>Novo comunicado</h2>
            <span id="notificationAudienceHint" class="small">Selecione um modelo e revise a mensagem antes de disparar.</span>
          </div>
          <span id="notificationDraftStats" class="badge">0 destinatários</span>
        </div>
        <form id="notificationComposerForm" class="notification-composer">
          <div class="notification-composer-grid">
            <div class="field">
              <label for="notificationTemplateSelect">Modelo</label>
              <select id="notificationTemplateSelect"></select>
            </div>
            <div class="field">
              <label for="notificationAudienceSelect">Destinatarios</label>
              <select id="notificationAudienceSelect"></select>
            </div>
          </div>
          <div class="field">
            <label for="notificationSubjectInput">Assunto</label>
            <input id="notificationSubjectInput" type="text" maxlength="120" placeholder="Assunto do comunicado">
          </div>
          <div class="field">
            <label for="notificationMessageInput">Mensagem</label>
            <textarea id="notificationMessageInput" rows="8" placeholder="Escreva a mensagem que sera enviada."></textarea>
          </div>
          <div class="notification-preview">
            <div class="notification-preview-head">
              <div>
                <span class="eyebrow">Preview</span>
                <h3 id="notificationPreviewSubject">SIGAC - Comunicado</h3>
              </div>
              <span id="notificationPreviewMeta" class="small">Sem modelo selecionado</span>
            </div>
            <div class="notification-preview-audience">
              <strong>Para</strong>
              <span id="notificationPreviewAudience">Selecione um segmento para revisar os destinatários.</span>
            </div>
            <div id="notificationPreviewBody" class="notification-preview-body"></div>
          </div>
          <div id="notificationComposerMessage" class="message info hidden"></div>
          <button type="submit">Enviar comunicado</button>
        </form>
      </div>
      <div class="card notification-history-panel">
        <div class="section-title">
          <div>
            <h2>Historico de comunicação</h2>
            <span id="notificationsHistoryMeta" class="small">Linha do tempo dos comunicados registrados</span>
          </div>
        </div>
        <div id="notificationsList" class="notifications-timeline"></div>
      </div>
    `;
  }

  function renderNotificationComposer() {
    ensureNotificationsLayout();
    const data = SIGACStore.getAdminDashboardData();
    ensureNotificationDraftDefaults(data);

    const templateSelect = document.getElementById('notificationTemplateSelect');
    const audienceSelect = document.getElementById('notificationAudienceSelect');
    const subjectInput = document.getElementById('notificationSubjectInput');
    const messageInput = document.getElementById('notificationMessageInput');
    if (!templateSelect || !audienceSelect || !subjectInput || !messageInput) return;

    const audiences = getNotificationAudiencePresets(data);
    templateSelect.innerHTML = notificationTemplates
      .map((template) => `<option value="${template.id}">${escapeHtml(template.label)}</option>`)
      .join('');
    audienceSelect.innerHTML = audiences
      .map((audience) => `<option value="${audience.id}">${escapeHtml(audience.label)} (${audience.recipients.length})</option>`)
      .join('');

    templateSelect.value = notificationDraft.templateId;
    audienceSelect.value = audiences.some((audience) => audience.id === notificationDraft.audienceId)
      ? notificationDraft.audienceId
      : audiences[0]?.id || '';
    subjectInput.value = notificationDraft.subject;
    messageInput.value = notificationDraft.message;

    updateNotificationComposerPreview(data);
  }

  function updateNotificationComposerPreview(data = SIGACStore.getAdminDashboardData()) {
    const audiences = getNotificationAudiencePresets(data);
    const audienceSelect = document.getElementById('notificationAudienceSelect');
    const subjectInput = document.getElementById('notificationSubjectInput');
    const messageInput = document.getElementById('notificationMessageInput');
    if (!audienceSelect) return;
    const audience = audiences.find((item) => item.id === audienceSelect.value) || audiences[0] || { label: 'Destinatarios', description: '', recipients: [] };
    const previewSubject = document.getElementById('notificationPreviewSubject');
    const previewMeta = document.getElementById('notificationPreviewMeta');
    const previewAudience = document.getElementById('notificationPreviewAudience');
    const previewBody = document.getElementById('notificationPreviewBody');
    const draftStats = document.getElementById('notificationDraftStats');
    const hint = document.getElementById('notificationAudienceHint');
    const subject = subjectInput?.value || notificationDraft.subject || 'SIGAC - Comunicado';
    const message = messageInput?.value || notificationDraft.message || '';

    notificationDraft.audienceId = audience.id || notificationDraft.audienceId;
    notificationDraft.subject = subject;
    notificationDraft.message = message;

    if (previewSubject) previewSubject.textContent = subject;
    if (previewMeta) previewMeta.textContent = `${notificationKindLabel(notificationDraft.templateId)} | ${audience.recipients.length} destinatário(s)`;
    if (previewAudience) previewAudience.textContent = summarizeRecipients(audience.recipients);
    if (previewBody) previewBody.innerHTML = message.trim()
      ? `<p>${nl2br(message).replace(/<br><br>/g, '</p><p>')}</p>`
      : '<p class="small">A mensagem aparecerá aqui conforme voce edita o conteúdo.</p>';
    if (draftStats) draftStats.textContent = `${audience.recipients.length} destinatário(s)`;
    if (hint) hint.textContent = audience.description || 'Selecione um segmento para revisar o publico.';
  }

  function setupNotificationComposerBindings() {
    ensureNotificationsLayout();
    const form = document.getElementById('notificationComposerForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    const templateSelect = document.getElementById('notificationTemplateSelect');
    const audienceSelect = document.getElementById('notificationAudienceSelect');
    const subjectInput = document.getElementById('notificationSubjectInput');
    const messageInput = document.getElementById('notificationMessageInput');

    templateSelect?.addEventListener('change', () => {
      const template = notificationTemplates.find((item) => item.id === templateSelect.value) || notificationTemplates[0];
      notificationDraft.templateId = template.id;
      notificationDraft.subject = template.subject;
      notificationDraft.message = template.body;
      if (subjectInput) subjectInput.value = notificationDraft.subject;
      if (messageInput) messageInput.value = notificationDraft.message;
      updateNotificationComposerPreview();
    });

    audienceSelect?.addEventListener('change', () => {
      notificationDraft.audienceId = audienceSelect.value;
      updateNotificationComposerPreview();
    });

    subjectInput?.addEventListener('input', () => {
      notificationDraft.subject = subjectInput.value;
      updateNotificationComposerPreview();
    });

    messageInput?.addEventListener('input', () => {
      notificationDraft.message = messageInput.value;
      updateNotificationComposerPreview();
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      showMessage('notificationComposerMessage', 'O envio manual continua seguindo o fluxo atual do SIGAC. Esta aba agora organiza o rascunho e a leitura do histórico sem alterar API, banco ou regras.', 'info');
    });
  }

  function buildAdminFriendlyMessage(certificate) {
    if (certificate.humanSummary) return certificate.humanSummary;
    const missingFields = formatOcrFieldList(certificate.missingFields);
    if (missingFields.length) return `Campos n\u00e3o identificados: ${missingFields.join(', ')}.`;
    return certificate.ocrReason || 'Aguardando pr\u00e9-an\u00e1lise do OCR.';
  }

  function getOcrMatchRows(certificate) {
    const expectedName = certificate.sender?.nome || '';
    const detectedName = certificate.detectedName || '';
    const detectedActivity = certificate.detectedTitle || certificate.detectedCourseName || '';
    const breakdown = certificate.hourBreakdown || {};
    const approvedHours = Number(breakdown.approvedHours ?? certificate.approvedHours ?? 0);
    const excessHours = Number(breakdown.excessHours ?? Math.max(0, Math.max(Number(certificate.detectedHours || 0), Number(certificate.declaredHours || 0)) - approvedHours));
    const nameOk = detectedName
      ? normalize(detectedName).includes(normalize(expectedName)) || normalize(expectedName).includes(normalize(detectedName))
      : certificate.ocrStatus === 'aprovado_automatico';
    return [
      { label: 'Aluno', value: detectedName || expectedName || 'Nao identificado', ok: Boolean(nameOk) },
      { label: 'Atividade', value: detectedActivity || 'Nao identificada', ok: Boolean(detectedActivity) },
      { label: 'Detectadas', value: `${Number(certificate.detectedHours || 0)} h`, ok: Number(certificate.detectedHours || 0) > 0 },
      { label: 'Aproveitadas', value: `${approvedHours} h`, ok: certificate.adminStatus === 'aprovado' },
      { label: 'Excedente', value: `${excessHours} h`, ok: excessHours === 0 }
    ];
  }

  function renderOcrMatchSummary(certificate) {
    const rows = getOcrMatchRows(certificate);
    const approved = certificate.ocrStatus === 'aprovado_automatico';
    const rejected = certificate.ocrStatus === 'rejeitado_automatico' || certificate.adminStatus === 'rejeitado';
    const statusText = approved ? 'Aprovado pelo OCR' : rejected ? 'Rejeitado pelo OCR' : 'Revisao manual';
    return `
      <div class="ocr-fit-panel ${approved ? 'is-approved' : rejected ? 'is-rejected' : 'is-review'}">
        <strong>${statusText}</strong>
        <div class="ocr-fit-grid">
          ${rows.map((row) => `
            <span class="${row.ok ? 'is-ok' : 'is-fail'}">
              <b>${escapeHtml(row.label)}</b>
              <em>${row.ok ? 'Bateu' : 'Nao bateu'}</em>
              <small>${escapeHtml(row.value)}</small>
            </span>
          `).join('')}
        </div>
      </div>
    `;
  }

  function buildOcrDecisionReport(certificate) {
    const ocrStatus = certificate.ocrStatus || 'nao_processado';
    const missingFields = formatOcrFieldList(certificate.missingFields);
    const foundFields = formatOcrFieldList(certificate.foundFields);

    const expectedName = certificate.sender?.nome || '';
    const detectedName = certificate.detectedName || '';
    const detectedCourse = certificate.detectedCourseName || certificate.detectedTitle || '';
    const detectedHours = Number(certificate.detectedHours || 0);
    const declaredHours = Number(certificate.declaredHours || 0);

    const issues = [];
    const positives = [];

    if (ocrStatus === 'nao_processado') {
      return {
        tone: 'info',
        title: 'OCR ainda não processado',
        summary: 'Clique em "Processar OCR" para iniciar a pré-análise automática do certificado.',
        issues: [],
        positives: [],
        missingFields,
        foundFields
      };
    }

    if (foundFields.length) {
      positives.push(`Campos identificados: ${foundFields.join(', ')}.`);
    }

    if (detectedCourse) positives.push(`Curso/evento detectado: ${detectedCourse}.`);
    if (detectedHours > 0) positives.push(`Carga horária detectada: ${detectedHours} h.`);
    if (certificate.detectedDate) positives.push(`Data detectada: ${certificate.detectedDate}.`);
    if (certificate.detectedInstitution) positives.push(`Instituição detectada: ${certificate.detectedInstitution}.`);
    if (certificate.detectedCnpj) positives.push(`CNPJ detectado: ${certificate.detectedCnpj}.`);
    if (certificate.detectedCode) positives.push(`Código do certificado detectado: ${certificate.detectedCode}.`);

    if (missingFields.length) {
      issues.push(`Campos faltando ou não confirmados: ${missingFields.join(', ')}.`);
    }

    if (expectedName && !detectedName) {
      issues.push(`Nome do aluno não confirmado pelo OCR. Esperado no sistema: ${expectedName}.`);
    }

    if (declaredHours > 0 && detectedHours > 0 && declaredHours !== detectedHours) {
      issues.push(`Carga horária divergente: o aluno informou ${declaredHours} h, mas o OCR detectou ${detectedHours} h.`);
    }

    if (!detectedCourse) issues.push('Nome do curso/evento não identificado com segurança.');
    if (!detectedHours) issues.push('Carga horária não identificada.');
    if (!certificate.detectedDate) issues.push('Data do certificado não identificada.');
    if (!certificate.detectedInstitution && !certificate.detectedCnpj) issues.push('Instituição ou CNPJ não identificado.');

    if (ocrStatus === 'aprovado_automatico' && !issues.length) {
      return {
        tone: 'approved',
        title: 'OCR aprovado',
        summary: 'O OCR encontrou os principais dados necessários para apoiar a aprovação.',
        issues,
        positives: positives.length ? positives : ['Os dados principais foram encontrados com boa consistência.'],
        missingFields,
        foundFields
      };
    }

    if (ocrStatus === 'rejeitado_automatico') {
      return {
        tone: 'rejected',
        title: 'OCR rejeitado',
        summary: 'O OCR não encontrou informações suficientes ou encontrou divergências importantes.',
        issues: issues.length ? issues : ['Texto insuficiente para validar o certificado automaticamente.'],
        positives,
        missingFields,
        foundFields
      };
    }

    return {
      tone: issues.length ? 'manual' : 'approved',
      title: issues.length ? 'OCR em revisão manual' : 'OCR aprovado para conferência',
      summary: issues.length
        ? 'O OCR encontrou alguns dados, mas ainda existem pontos que precisam de conferência do administrador.'
        : 'O OCR encontrou os dados principais, mas a validação final continua sendo do administrador.',
      issues,
      positives,
      missingFields,
      foundFields
    };
  }

  function renderOcrDecisionPanel(certificate) {
    const report = buildOcrDecisionReport(certificate);

    const positivesHtml = report.positives.length
      ? `<ul>${report.positives.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '<p>Nenhum dado positivo encontrado pelo OCR.</p>';

    const issuesHtml = report.issues.length
      ? `<ul>${report.issues.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '<p>Nenhuma pendência crítica identificada pelo OCR.</p>';

    return `
      <div class="ocr-decision-panel is-${report.tone}">
        <div class="ocr-decision-head">
          <strong>${escapeHtml(report.title)}</strong>
          <span>${escapeHtml(statusLabel(certificate.ocrStatus))}</span>
        </div>
        <p>${escapeHtml(report.summary)}</p>

        <div class="ocr-decision-grid">
          <div>
            <strong>O que o OCR encontrou</strong>
            ${positivesHtml}
          </div>
          <div>
            <strong>O que falta corrigir/conferir</strong>
            ${issuesHtml}
          </div>
        </div>
      </div>
    `;
  }

  function getDefaultAdminFeedback(certificate, decision) {
    const report = buildOcrDecisionReport(certificate);

    if (decision === 'aprovado') {
      return 'Certificado aprovado. Os dados principais foram conferidos e a carga horária foi considerada válida para registro no SIGAC.';
    }

    const issues = report.issues.length
      ? report.issues.join(' ')
      : 'O certificado não possui informações suficientes para validação.';

    return `Certificado rejeitado. ${issues} Por favor, envie um novo comprovante legível contendo nome do participante, curso/evento, carga horária, data e instituição/CNPJ.`;
  }

  function getFeedbackTemplates(certificate) {
    const report = buildOcrDecisionReport(certificate);
    const missing = report.missingFields || [];

    const templates = [
      {
        label: 'Aprovar certificado',
        tone: 'success',
        text: getDefaultAdminFeedback(certificate, 'aprovado')
      },
      {
        label: 'Rejeição pelo OCR',
        tone: 'danger',
        text: getDefaultAdminFeedback(certificate, 'rejeitado')
      },
      {
        label: 'Nome divergente',
        tone: 'danger',
        text: 'Certificado rejeitado. O nome do participante no certificado não foi confirmado como o mesmo aluno do sistema. Envie um certificado emitido no nome correto.'
      },
      {
        label: 'Carga horária divergente',
        tone: 'danger',
        text: 'Certificado rejeitado. A carga horária informada não corresponde à carga horária detectada no certificado. Revise os dados e envie novamente.'
      },
      {
        label: 'Instituição ausente',
        tone: 'warning',
        text: 'Correção necessária. O OCR não identificou instituição, empresa responsável ou CNPJ no certificado. Envie um comprovante que contenha a instituição emissora.'
      },
      {
        label: 'Documento ilegível',
        tone: 'danger',
        text: 'Certificado rejeitado. O documento está ilegível ou não possui texto suficiente para validação. Envie uma imagem/PDF com melhor qualidade.'
      }
    ];

    if (missing.includes('data')) {
      templates.push({
        label: 'Data ausente',
        tone: 'warning',
        text: 'Correção necessária. O OCR não identificou a data de conclusão ou emissão do certificado. Envie um comprovante com data visível.'
      });
    }

    return templates;
  }

  function renderFeedbackQuickActions(certificate, canReview) {
    if (!canReview) return '';

    const templates = getFeedbackTemplates(certificate);

    return `
      <div class="ocr-feedback-quick-actions">
        <strong>Feedback rápido</strong>
        <div>
          ${templates.map((template) => `
            <button
              type="button"
              class="feedback-template-btn ${template.tone || ''}"
              data-feedback="${escapeAttribute(template.text)}">
              ${escapeHtml(template.label)}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  function setActiveSection(sectionId) {
    document.querySelectorAll('.panel-section').forEach((section) => section.classList.add('hidden'));
    document.querySelectorAll('[data-section]').forEach((button) => button.classList.remove('active'));
    document.getElementById(sectionId)?.classList.remove('hidden');
    document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');
    const title = sectionTitles[sectionId] || 'Dashboard';
    const titleNode = document.getElementById('pageTitle');
    const subtitleNode = document.getElementById('pageSubtitle');
    if (titleNode) titleNode.textContent = title;
    if (subtitleNode) {
      subtitleNode.textContent = sectionId === 'dashboard'
        ? 'Resumo operacional, progresso e próximas ações da plataforma.'
        : `Gerencie ${title.toLowerCase()} do SIGAC com filtros e listas compactas.`;
    }
    repairVisibleText();
  }

  function getSectionHeaderText(sectionId) {
    return {
      dashboard: 'Painel Administrativo',
      usuarios: 'Gestão de usuários',
      cursos: 'Cursos',
      vinculos: 'Vínculos',
      regras: 'Regras de atividade',
      oportunidades: 'Oportunidades',
      envios: 'Envios de atividades',
      certificados: 'Certificados',
      relatorios: 'Relatórios e auditoria',
      notificacoes: 'Notificações',
      logs: 'Auditoria',
      configuracoes: 'Configurações'
    }[sectionId] || 'Painel Administrativo';
  }

  function getSectionHeaderSubtitle(sectionId) {
    return {
      dashboard: 'Resumo operacional da plataforma.',
      usuarios: 'Gerencie usuários, perfis e acessos.',
      cursos: 'Verifique e cadastre os cursos disponíveis.',
      vinculos: 'Associe alunos e coordenadores aos cursos.',
      regras: 'Defina limites, cargas e requisitos por categoria.',
      oportunidades: 'Publique e acompanhe oportunidades de horas complementares.',
      envios: 'Acompanhe e avalie os envios de atividades.',
      certificados: 'Valide certificados e status de OCR.',
      relatorios: 'Veja métricas, risco e histórico do sistema.',
      notificacoes: 'Gerencie comunicados e mensagens do SIGAC.',
      logs: 'Revise ações recentes e eventos do sistema.',
      configuracoes: 'Ajuste preferências e integrações.'
    }[sectionId] || 'Resumo operacional da plataforma.';
  }

  function updateSectionHeader(sectionId) {
    const title = getSectionHeaderText(sectionId);
    const subtitle = getSectionHeaderSubtitle(sectionId);
    const contextSpan = document.querySelector('.console-context span');
    const topbarTitle = document.querySelector('.topbar h1');
    const topbarSubtitle = document.querySelector('.topbar p');
    if (contextSpan) contextSpan.textContent = title;
    if (topbarTitle) topbarTitle.textContent = title;
    if (topbarSubtitle) topbarSubtitle.textContent = subtitle;
  }

  function showSectionLoading(sectionId, text = 'Carregando...') {
    const targetId = {
      dashboard: 'latestSubmissionsList',
      usuarios: 'usersTableBody',
      cursos: 'coursesTableBody',
      vinculos: 'studentLinkSummary',
      regras: 'rulesGrid',
      oportunidades: 'opportunitiesAdminGrid',
      envios: 'submissionsQueueList',
      certificados: 'certificatesAdminList',
      relatorios: 'riskReportList',
      notificacoes: 'notificationsList',
      logs: 'auditLogList',
      configuracoes: 'emailList'
    }[sectionId];
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return;
    target.innerHTML = `<div class="item small">${escapeHtml(text)}</div>`;
  }

  // FUNÇÕES ASSÍNCRONAS - Chamadas de API e carregamento dinâmico de dados.
async function ensureSectionData(sectionId, options = {}) {
    if (sectionId === 'usuarios') return SIGACStore.ensureAdminTabData('users', options);
    if (sectionId === 'vinculos') return SIGACStore.ensureAdminTabData('links', options);
    if (sectionId === 'envios') return SIGACStore.ensureAdminTabData('submissions', options);
    if (sectionId === 'certificados') return SIGACStore.ensureAdminTabData('certificates', options);
    if (sectionId === 'notificacoes') return SIGACStore.ensureAdminTabData('notifications', options);
    if (sectionId === 'logs') return SIGACStore.ensureAdminTabData('logs', options);
    if (sectionId === 'configuracoes') return SIGACStore.ensureAdminTabData('notifications', options);
    return null;
  }

  function renderSection(sectionId, user) {
    if (sectionId === 'dashboard') return renderDashboard();
    if (sectionId === 'usuarios') {
      populateSharedSelects();
      return renderUsers();
    }
    if (sectionId === 'cursos') return renderCourses();
    if (sectionId === 'vinculos') {
      populateSharedSelects();
      return renderLinks();
    }
    if (sectionId === 'regras') {
      populateSharedSelects();
      return renderRules();
    }
    if (sectionId === 'oportunidades') return renderOpportunities();
    if (sectionId === 'envios') return renderSubmissions();
    if (sectionId === 'certificados') return renderCertificates();
    if (sectionId === 'relatorios') return renderReports();
    if (sectionId === 'notificacoes') return renderNotifications();
    if (sectionId === 'logs') return renderLogs();
    if (sectionId === 'configuracoes') return renderSettings();
  }

  async function openSection(sectionId, options = {}) {
    clearGlobalSearch();
    setActiveSection(sectionId);
    updateSectionHeader(sectionId);
    if (sectionId !== 'dashboard') showSectionLoading(sectionId, 'Carregando dados da aba...');
    await ensureSectionData(sectionId, options);
    renderSection(sectionId, SIGACStore.getCurrentUser());
    if (['certificados', 'envios', 'dashboard', 'relatorios'].includes(sectionId)) bindDynamicActions(SIGACStore.getCurrentUser());
  }

  function clearGlobalSearch() {
    if (!globalSearchTerm) return false;
    globalSearchTerm = '';
    const input = document.getElementById('globalSearchInput');
    if (input) input.value = '';
    return true;
  }

  function renderFilteredLists() {
    const activeSection = getActiveSectionId();
    renderSection(activeSection, SIGACStore.getCurrentUser());
    if (['certificados', 'envios', 'dashboard', 'relatorios'].includes(activeSection)) bindDynamicActions(SIGACStore.getCurrentUser());
  }

  function getActiveSectionId() {
    return document.querySelector('.panel-section:not(.hidden)')?.id || 'dashboard';
  }

  function getStudents(data) {
    return ensureArray(data.courses).flatMap((course) => ensureArray(course.students).map((student) => ({ ...student, course })));
  }

  function getRiskStudents(data) {
    return buildAcademicMlRows(data)
      .filter((student) => student.risk === 'alto')
      .sort((a, b) => a.progress.percent - b.progress.percent);
  }

  function getSubmissions(data) {
    return ensureArray(data.submissions).map((submission) => ({
      ...submission,
      latest: submission.latest || (submission.versions || []).slice(-1)[0] || {}
    }));
  }

  function buildAcademicMlRows(data) {
    const mlRows = Array.isArray(lastMlData?.riscos) ? lastMlData.riscos : [];
    const realCourses = ensureArray(data.courses);
    const courseByKey = new Map();
    realCourses.forEach((course) => {
      [course.id, course.sigla, course.nome].filter(Boolean).forEach((key) => courseByKey.set(normalize(key), course));
    });
    const validMlRows = mlRows.filter((item) => courseByKey.has(normalize(item.curso_id || item.curso || item.curso_nome || '')));
    if (validMlRows.length) {
      return validMlRows.map((item) => {
        const realCourse = courseByKey.get(normalize(item.curso_id || item.curso || item.curso_nome || ''));
        const total = Number(item.horas_aprovadas || 0);
        const target = Number(item.meta_horas || 0);
        const progressPercent = target ? percent((total / target) * 100) : percent(item.percentual_concluido || item.percentual_conclusao || 0);
        return {
          id: item.aluno_id || '',
          nome: mlStudentName(item),
          email: item.aluno_email || item.email || '',
          course: { id: realCourse?.id || '', sigla: realCourse?.sigla || '', nome: realCourse?.nome || '' },
          progress: { total, target, percent: progressPercent },
          risk: progressPercent >= 100 ? 'baixo' : mlRiskClass(item.classificacao_risco || item.risco)
        };
      });
    }
    return getStudents(data).map((student) => {
      const progressPercent = percent(student.progress?.percent);
      return {
        ...student,
        progress: { ...student.progress, percent: progressPercent },
        risk: progressPercent >= 100 ? 'baixo' : progressPercent < 60 ? 'alto' : 'medio'
      };
    });
  }

  function buildAcademicMlSummary(data) {
    const rows = buildAcademicMlRows(data);
    const courses = ensureArray(data.courses).filter((course) => course.ativo !== false && course.sigla).map((course) => {
      const courseRows = rows.filter((row) => row.course?.id === course.id || row.course?.sigla === course.sigla);
      const total = courseRows.length;
      const completed = courseRows.filter((row) => row.progress.percent >= 100).length;
      return {
        ...course,
        total,
        completed,
        taxaAprovacao: total ? Math.round((completed / total) * 100) : Number(course.taxaAprovacao || 0),
        progressoMedio: total ? Math.round(courseRows.reduce((sum, row) => sum + row.progress.percent, 0) / total) : 0
      };
    });
    return { rows, courses };
  }

  function searchTargetFor(term, preferredSection = '') {
    if (!term) return '';
    const data = SIGACStore.getAdminDashboardData();
    const users = SIGACStore.listUsers();
    const courses = SIGACStore.listCourses();
    const submissions = getSubmissions(data);
    const certificates = data.certificates || [];
    const matchers = {
      usuarios: () => users.some((user) => matchesSearch(`${user.nome} ${user.email} ${user.tipo}`)),
      cursos: () => courses.some((course) => matchesSearch(`${course.sigla} ${course.nome} ${course.area} ${course.turno}`)),
      envios: () => submissions.some((submission) => matchesSearch(`${submission.student?.nome || ''} ${submission.activity?.titulo || ''} ${submission.course?.sigla || ''} ${statusLabel(submission.latest?.status)}`)),
      certificados: () => certificates.some((certificate) => matchesSearch(`${certificate.fileName} ${certificate.sender?.nome || ''} ${certificate.senderType} ${statusLabel(certificate.adminStatus)}`))
    };

    if (matchers[preferredSection]) return preferredSection;
    if (matchers.usuarios()) return 'usuarios';
    if (matchers.cursos()) return 'cursos';
    if (matchers.envios()) return 'envios';
    if (matchers.certificados()) return 'certificados';
    return '';
  }

  function setMenuBadge(id, value) {
    const badge = document.getElementById(id);
    if (!badge) return;
    const total = Number(value || 0);
    badge.textContent = total > 99 ? '99+' : String(total);
    badge.classList.toggle('hidden', total <= 0);
  }

  function updateSidebarStats(data) {
    const users = SIGACStore.listUsers().filter((user) => user.tipo !== 'superadmin');
    const unread = (data.notifications || []).filter((item) => !item.read).length;
    setMenuBadge('menuBadgeUsers', users.length);
    setMenuBadge('menuBadgeCourses', data.totals.totalCursos);
    setMenuBadge('menuBadgeSubmissions', data.totals.pendentes);
    setMenuBadge('menuBadgeCertificates', data.totals.certificadosPendentes);
    setMenuBadge('menuBadgeNotifications', unread);
  }

  function renderRecentActivityRows(data) {
    const recentItems = [
      ...getSubmissions(data).map((submission) => ({
        student: submission.student?.nome || 'Aluno removido',
        course: submission.course?.sigla || '-',
        status: submission.latest?.status,
        date: submission.latest?.enviadaEm,
        section: 'envios'
      })),
      ...ensureArray(data.certificates).map((certificate) => ({
        student: certificate.sender?.nome || 'Aluno removido',
        course: certificate.course?.sigla || certificate.courseId || '-',
        status: certificate.adminStatus || certificate.ocrStatus,
        date: certificate.createdAt,
        section: 'certificados'
      }))
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 6);
    const rows = recentItems.map((item) => {
        const status = statusLabel(item.status);
        return `
          <tr>
            <td>${escapeHtml(item.student)}</td>
            <td>${escapeHtml(item.course)}</td>
            <td><span class="badge ${badgeClass(item.status)}">${escapeHtml(status)}</span></td>
            <td>${formatDate(item.date)}</td>
            <td><button type="button" class="text-button" data-section-jump="${item.section}">Avaliar</button></td>
          </tr>
        `;
      });

    document.getElementById('recentActivityTable').innerHTML = rows.join('')
      || '<tr><td colspan="5">Ainda não há atividades recentes para acompanhar.</td></tr>';
  }

  function sumValues(values) {
    return values.reduce((sum, value) => sum + Number(value || 0), 0);
  }

  function createVerticalGradient(ctx, area, colors) {
    const gradient = ctx.createLinearGradient(0, area.bottom, 0, area.top);
    colors.forEach(([offset, color]) => gradient.addColorStop(offset, color));
    return gradient;
  }

  function renderChartUnavailable(message = 'Grafico indisponivel no momento.') {
    document.querySelectorAll('.chart-box').forEach((box) => {
      box.innerHTML = `<div class="chart-fallback">${escapeHtml(message)}</div>`;
    });
  }

  function renderCharts(data, academicSummary = buildAcademicMlSummary(data)) {
    if (!window.Chart) {
      renderChartUnavailable('Nao foi possivel carregar a biblioteca de graficos. Recarregue a pagina ou verifique os arquivos do pacote.');
      return;
    }
    window.SIGACCharts?.ensureDefaults();
    const charts = window.SIGACCharts;
    const chartTheme = charts?.getTheme?.() || { text: '#111827', muted: '#374151', grid: '#e5e7eb', surface: '#ffffff' };
    const approvalCanvas = document.getElementById('chartAprovacaoCursos');
    const statusCanvas = document.getElementById('chartPendencias');
    if (!approvalCanvas) return;
    const approvalStage = document.getElementById('approvalChartStage');
    if (approvalStage) {
      approvalStage.style.width = `${Math.max(760, academicSummary.courses.length * 72)}px`;
    }

    const approvalCtx = approvalCanvas.getContext('2d');
    const statusCtx = statusCanvas?.getContext('2d');
    if (chartApproval) chartApproval.destroy();
    if (chartStatus) chartStatus.destroy();

    const approvalValues = academicSummary.courses.map((course) => percent(course.taxaAprovacao || 0));
    const statusSummary = data.totals.statusSummary || data.statusSummary || {};
    const statusValues = [
      Number(statusSummary.aprovados ?? data.totals.aprovados ?? 0),
      Number(statusSummary.pendentes ?? data.totals.pendentes ?? 0),
      Number(statusSummary.rejeitados ?? data.totals.rejeitados ?? 0),
      Number(statusSummary.removidos ?? data.totals.removidos ?? 0)
    ];
    const statusTotal = sumValues(statusValues);

    const approvalLabelPlugin = {
      id: 'sigacApprovalLabels',
      afterDatasetsDraw(chart) {
        const dataset = chart.data.datasets[0];
        const meta = chart.getDatasetMeta(0);
        const { ctx } = chart;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = chartTheme.text;
        ctx.font = '600 11px Inter, system-ui, sans-serif';
        meta.data.forEach((bar, index) => {
          const value = Number(dataset.data[index] || 0);
          ctx.fillText(formatPercent(value), bar.x, bar.y - 8);
        });
        ctx.restore();
      }
    };

    chartApproval = new Chart(approvalCtx, {
      type: 'bar',
      plugins: [approvalLabelPlugin],
      data: {
        labels: academicSummary.courses.map((course) => course.sigla),
        datasets: [{
          label: 'Taxa de aprovação',
          data: approvalValues,
          backgroundColor: (context) => {
            const { chart } = context;
            if (!chart.chartArea) return '#ff8a1f';
            return createVerticalGradient(chart.ctx, chart.chartArea, [
              [0, '#ffba73'],
              [0.42, '#ff9342'],
              [1, '#d96a14']
            ]);
          },
          borderColor: '#ffb56b',
          borderWidth: 1,
          borderRadius: 10,
          borderSkipped: false,
          minBarLength: 3,
          maxBarThickness: 58,
          barPercentage: 0.82,
          categoryPercentage: 0.78
        }]
      },
      options: charts.createOptions({
        layout: { padding: { top: 20, right: 10, bottom: 0, left: 0 } },
        scales: {
          y: charts.createScale({
            beginAtZero: true,
            max: 100,
            grid: {
              color: chartTheme.grid,
              drawTicks: false,
              borderDash: [4, 4]
            },
            ticks: {
              stepSize: 25,
              padding: 8,
              color: chartTheme.muted,
              font: { size: 12, weight: '500' },
              callback: (value) => formatPercent(value)
            }
          }),
          x: charts.createScale({
            grid: { display: false },
            ticks: {
              padding: 10,
              color: chartTheme.text,
              font: { size: 12, weight: '600' }
            }
          })
        },
        plugins: {
          legend: { display: false },
          tooltip: charts.createTooltip({
            displayColors: false,
            backgroundColor: '#181a1d',
            borderColor: 'rgba(255, 138, 31, 0.28)',
            callbacks: {
              title: (items) => {
                const course = academicSummary.courses[items[0]?.dataIndex];
                return course ? `${course.sigla} - ${course.nome}` : '';
              },
              label: (context) => `${formatPercentDecimal(context.parsed.y)} de aprovação`
            }
          })
        }
      })
    });

    if (statusCtx) {
      chartStatus = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
          labels: ['Aprovados', 'Em análise', 'Rejeitados', 'Removidos'],
          datasets: [{
            data: statusValues,
            backgroundColor: ['#34d399', '#f4bf52', '#ff6f86', '#94a3b8'],
            borderColor: chartTheme.surface,
            borderWidth: 3,
            spacing: 2,
            hoverOffset: 3
          }]
        },
        options: charts.createOptions({
          cutout: '68%',
          plugins: {
            legend: charts.createLegend({
              position: 'right',
              labels: {
                color: chartTheme.text,
                generateLabels: (chart) => chart.data.labels.map((label, index) => {
                  const value = Number(chart.data.datasets[0].data[index] || 0);
                  const share = statusTotal ? (value / statusTotal) * 100 : 0;
                  const color = chart.data.datasets[0].backgroundColor[index];
                  return {
                    text: `${label}: ${value} (${formatPercent(share)})`,
                    fillStyle: color,
                    strokeStyle: color,
                    fontColor: chartTheme.text,
                    hidden: !chart.getDataVisibility(index),
                    index
                  };
                })
              }
            }),
            tooltip: charts.createTooltip({
              callbacks: {
                label: (context) => {
                  const value = Number(context.parsed || 0);
                  const share = statusTotal ? (value / statusTotal) * 100 : 0;
                  return `${context.label}: ${value} envios (${formatPercent(share)})`;
                }
              }
            })
          }
        })
      });
    }

  }

  function refreshLinkPersonSelects() {
    const users = SIGACStore.listUsers();
    const configs = [
      { selectId: 'studentSelect', searchId: 'studentLinkSearch', type: 'aluno', empty: 'Nenhum aluno encontrado' },
      { selectId: 'coordinatorSelect', searchId: 'coordinatorLinkSearch', type: 'coordenador', empty: 'Nenhum coordenador encontrado' }
    ];
    configs.forEach((config) => {
      const select = document.getElementById(config.selectId);
      if (!select) return;
      const current = select.value;
      const query = normalize(document.getElementById(config.searchId)?.value || '');
      const visible = users.filter((user) => user.tipo === config.type)
        .filter((user) => !query || normalize(`${user.nome} ${user.email} ${user.matricula || ''}`).includes(query));
      select.innerHTML = `<option value="">${visible.length ? 'Selecione...' : config.empty}</option>${visible.map((user) => `
        <option value="${user.id}">${escapeHtml(user.nome)} - ${escapeHtml(user.email || user.matricula || '')}</option>
      `).join('')}`;
      if (visible.some((user) => user.id === current)) {
        select.value = current;
      } else if (current) {
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    window.SIGACCustomSelect?.refreshAll?.();
  }

  function populateSharedSelects() {
    const users = SIGACStore.listUsers();
    const courses = SIGACStore.listCourses();
    const students = users.filter((user) => user.tipo === 'aluno');
    const coordinators = users.filter((user) => user.tipo === 'coordenador');

    const courseOptions = courses.map((course) => `<option value="${course.id}">${escapeHtml(course.sigla)} - ${escapeHtml(course.nome)}</option>`).join('');
    const studentSearch = normalize(document.getElementById('studentLinkSearch')?.value || '');
    const coordinatorSearch = normalize(document.getElementById('coordinatorLinkSearch')?.value || '');
    const visibleStudents = students.filter((student) => !studentSearch || normalize(`${student.nome} ${student.email} ${student.matricula || ''}`).includes(studentSearch));
    const visibleCoordinators = coordinators.filter((coord) => !coordinatorSearch || normalize(`${coord.nome} ${coord.email} ${coord.matricula || ''}`).includes(coordinatorSearch));
    const studentOptions = visibleStudents.map((student) => `<option value="${student.id}">${escapeHtml(student.nome)} - ${escapeHtml(student.email || student.matricula || '')}</option>`).join('');
    const coordinatorOptions = visibleCoordinators.map((coord) => `<option value="${coord.id}">${escapeHtml(coord.nome)} - ${escapeHtml(coord.email || coord.matricula || '')}</option>`).join('');
    const ruleCategoryOptions = ruleCategories.map((category) => `<option>${escapeHtml(category)}</option>`).join('');
    const opportunityCategoryOptions = opportunityCategories.map((category) => `<option>${escapeHtml(category)}</option>`).join('');

    ['studentCourseSelect'].forEach((id) => {
      const select = document.getElementById(id);
      if (select) select.innerHTML = courseOptions;
    });
    ['userCoursesInput', 'coordinatorCoursesSelect', 'ruleCourseSelect', 'oppCourseSelect'].forEach((id) => {
      const select = document.getElementById(id);
      if (select) select.innerHTML = id === 'userCoursesInput' ? `<option value="">Selecione...</option>${courseOptions}` : courseOptions;
    });
    ['dashboardCourseFilter', 'usersCourseFilter', 'rulesCourseFilter'].forEach((id) => {
      const select = document.getElementById(id);
      if (select) select.innerHTML = `<option value="">Todos os cursos</option>${courseOptions}`;
    });
    const ruleCategoryInput = document.getElementById('ruleCategoryInput');
    if (ruleCategoryInput) ruleCategoryInput.innerHTML = ruleCategoryOptions;
    const oppCategory = document.getElementById('oppCategory');
    if (oppCategory) oppCategory.innerHTML = opportunityCategoryOptions;
    const oppCategoryFilter = document.getElementById('opportunityCategoryFilter');
    if (oppCategoryFilter) oppCategoryFilter.innerHTML = `<option value="">Todas as categorias</option>${opportunityCategoryOptions}`;

    const currentStudent = document.getElementById('studentSelect')?.value || '';
    const currentCoordinator = document.getElementById('coordinatorSelect')?.value || '';
    document.getElementById('studentSelect').innerHTML = `<option value="">${visibleStudents.length ? 'Selecione...' : 'Nenhum aluno encontrado'}</option>${studentOptions}`;
    document.getElementById('coordinatorSelect').innerHTML = `<option value="">${visibleCoordinators.length ? 'Selecione...' : 'Nenhum coordenador encontrado'}</option>${coordinatorOptions}`;
    if (visibleStudents.some((student) => student.id === currentStudent)) document.getElementById('studentSelect').value = currentStudent;
    if (visibleCoordinators.some((coord) => coord.id === currentCoordinator)) document.getElementById('coordinatorSelect').value = currentCoordinator;

    const syncStudentCourses = () => {
      const student = students.find((item) => item.id === document.getElementById('studentSelect')?.value);
      const selectedIds = student ? (student.courseIds?.length ? student.courseIds : [student.courseId].filter(Boolean)) : [];
      const select = document.getElementById('studentCourseSelect');
      if (!select) return;
      Array.from(select.options).forEach((option) => {
        option.selected = selectedIds.includes(option.value);
      });
      window.SIGACCustomSelect?.refreshAll?.();
    };
    const syncCoordinatorCourses = () => {
      const coordinator = coordinators.find((item) => item.id === document.getElementById('coordinatorSelect')?.value);
      const selectedIds = coordinator?.courseIds || [];
      const select = document.getElementById('coordinatorCoursesSelect');
      if (!select) return;
      Array.from(select.options).forEach((option) => {
        option.selected = selectedIds.includes(option.value);
      });
      window.SIGACCustomSelect?.refreshAll?.();
    };
    document.getElementById('studentSelect').onchange = syncStudentCourses;
    document.getElementById('coordinatorSelect').onchange = syncCoordinatorCourses;
    syncStudentCourses();
    syncCoordinatorCourses();

    const syncUserForm = () => {
      const type = document.getElementById('userTypeInput').value;
      const isStudent = type === 'aluno';
      const coursesInput = document.getElementById('userCoursesInput');
      document.getElementById('userFormTitle').textContent = isStudent ? 'Novo aluno' : 'Novo coordenador';
      document.getElementById('userSubmitButton').textContent = isStudent ? 'Cadastrar aluno' : 'Cadastrar coordenador';
      document.getElementById('userCoursesLabel').textContent = isStudent ? 'Cursos do aluno' : 'Cursos do coordenador';
      document.getElementById('userCoursesHelp').textContent = isStudent
        ? 'Selecione de 1 a 2 cursos para vincular ao aluno.'
        : 'Selecione de 1 a 10 cursos para o coordenador.';
      if (coursesInput) {
        coursesInput.multiple = true;
        coursesInput.size = isStudent ? 4 : 6;
        window.SIGACCustomSelect?.refreshAll?.();
      }
    };
    document.getElementById('userTypeInput').onchange = syncUserForm;
    syncUserForm();
    window.SIGACCustomSelect?.refreshAll?.();
  }

  function renderDashboard() {
    const data = SIGACStore.getAdminDashboardData();
    const academicSummary = buildAcademicMlSummary(data);
    const riskStudents = academicSummary.rows.filter((student) => student.risk === 'alto');
    const certificates = data.certificates || [];
    const approvedCertificates = certificates.filter((item) => item.adminStatus === 'aprovado');
    const submissions = getSubmissions(data);
    const pendingSubmissions = submissions.filter((item) => ['pendente', 'em_analise', 'correcao'].includes(item.latest?.status)).length;
    updateSidebarStats(data);
    const avgApproval = academicSummary.courses.length
      ? Math.round(academicSummary.courses.reduce((sum, course) => sum + Number(course.taxaAprovacao || 0), 0) / academicSummary.courses.length)
      : 0;

    const metrics = [
      { title: 'Cursos ativos', value: data.courses.filter((course) => course.ativo !== false).length, meta: 'Cursos cadastrados e ativos', trend: `${data.courses.length} cadastrados`, icon: 'CU' },
      { title: 'Usu\u00e1rios ativos', value: data.totals.totalUsuarios, meta: 'Alunos e coordenadores', trend: 'Dados atuais do sistema', icon: 'US' },
      { title: 'Envios pendentes', value: data.totals.pendentes, meta: 'Aguardando avaliação', trend: `${pendingSubmissions} na fila`, icon: 'EV', tone: data.totals.pendentes ? 'attention' : '' },
      { title: 'Certificados pendentes', value: data.totals.certificadosPendentes, meta: 'Com OCR ou análise manual', trend: `${approvedCertificates.length} aprovados`, icon: 'CE', tone: data.totals.certificadosPendentes ? 'attention' : '' },
      { title: 'Taxa média', value: formatPercent(avgApproval), meta: 'Aprovação por curso', trend: avgApproval >= 70 ? 'Operação saudável' : 'Requer acompanhamento', icon: 'TX' },
      { title: 'Alunos em risco', value: riskStudents.length, meta: 'Abaixo de 60% da meta', trend: 'Prioridade de acompanhamento', icon: 'AR', tone: riskStudents.length ? 'danger' : '' }
    ];

    document.getElementById('metricsGrid').innerHTML = metrics.map((metric) => `
      <div class="card metric-card ${metric.tone || ''}">
        <div class="metric-head">
          <span class="metric-icon">${metric.icon}</span>
          <h3>${escapeHtml(metric.title)}</h3>
        </div>
        <div class="metric-value">${escapeHtml(metric.value)}</div>
        <p class="small">${escapeHtml(metric.meta)}</p>
        <span class="metric-trend">${escapeHtml(metric.trend)}</span>
      </div>
    `).join('');

    const approvedHoursByCategory = new Map();
    submissions
      .filter((submission) => submission.latest?.status === 'aprovado')
      .forEach((submission) => {
        const category = submission.activity?.categoria || submission.activity?.tipo || submission.activity?.category || 'Sem categoria';
        approvedHoursByCategory.set(category, (approvedHoursByCategory.get(category) || 0) + Number(submission.activity?.horas || 0));
      });
    approvedCertificates.forEach((certificate) => {
      const category = certificate.detectedTitle || certificate.detectedCourseName || 'Certificados';
      approvedHoursByCategory.set(category, (approvedHoursByCategory.get(category) || 0) + Number(certificate.approvedHours || 0));
    });
    ensureArray(data.opportunities).forEach((opportunity) => {
      const category = opportunity.categoria || 'Oportunidades';
      const confirmedHours = Number(opportunity.horas || 0) * ensureArray(opportunity.inscritos).length;
      approvedHoursByCategory.set(category, (approvedHoursByCategory.get(category) || 0) + confirmedHours);
    });
    const limitsByCategory = new Map();
    (data.rules || []).forEach((rule) => {
      const category = rule.categoria || 'Sem categoria';
      limitsByCategory.set(category, (limitsByCategory.get(category) || 0) + Number(rule.limiteMaximo || rule.cargaMinima || 0));
    });
    const rankedRules = [...new Set([...approvedHoursByCategory.keys(), ...limitsByCategory.keys()])]
      .map((name) => ({
        name,
        used: approvedHoursByCategory.get(name) || 0,
        max: limitsByCategory.get(name) || 0
      }))
      .filter((rule) => rule.used > 0 || rule.max > 0)
      .sort((a, b) => b.used - a.used);
    document.getElementById('categoryHoursTableBody').innerHTML = rankedRules.map((rule) => {
      const hasReference = rule.max > 0;
      const fill = hasReference ? percent((rule.used / rule.max) * 100) : 0;
      return `
        <tr>
          <td><strong>${escapeHtml(rule.name)}</strong></td>
          <td>${rule.used} h</td>
          <td>${hasReference ? `${rule.max} h` : '<span class="table-subtext">Sem limite configurado</span>'}</td>
          <td>${hasReference
            ? `<strong>${formatPercent(fill)}</strong><div class="mini-progress"><span style="width:${percent(fill)}%"></span></div>`
            : '<span class="badge">Não aplicável</span>'}</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="4">Ainda não há horas aprovadas por categoria.</td></tr>';

    const latestSubmissions = getSubmissions(data).slice(0, 5);
    document.getElementById('latestSubmissionsList').innerHTML = latestSubmissions.length
      ? renderSubmissionShowcase(latestSubmissions)
      : certificates.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5).map((certificate) => `
          <div class="item">
            <strong>${escapeHtml(certificate.fileName || 'Certificado')}</strong>
            <span>${escapeHtml(certificate.sender?.nome || 'Aluno')} - ${escapeHtml(statusLabel(certificate.adminStatus))}</span>
          </div>
        `).join('') || '<div class="item">Nenhuma solicitação recente.</div>';

    document.getElementById('riskStudentsList').innerHTML = riskStudents.slice(0, 5).map((student) => `
      <div class="risk-row">
        <span class="avatar-mini">${getInitial(student.nome)}</span>
        <div class="risk-copy">
          <div class="risk-head">
            <strong>${escapeHtml(student.nome)}</strong>
            <span class="risk-score">${formatPercent(student.progress?.percent)}</span>
          </div>
          <span class="risk-meta">${escapeHtml(student.course?.sigla || 'Sem curso')} - abaixo da meta complementar</span>
        </div>
        <div class="mini-progress"><span class="risk" style="width:${percent(student.progress?.percent)}%"></span></div>
      </div>
    `).join('') || '<div class="item">Nenhum aluno em risco no momento.</div>';

    document.getElementById('dashboardQuickActions').innerHTML = `
      <button type="button" class="quick-card" data-section-jump="certificados"><strong>Validar pendências</strong><span>${data.totals.certificadosPendentes} certificados</span></button>
      <button type="button" class="quick-card" data-section-jump="cursos"><strong>Cadastrar curso</strong><span>Novo curso</span></button>
      <button type="button" class="quick-card" data-section-jump="regras"><strong>Criar regra</strong><span>Nova categoria</span></button>
      <button type="button" class="quick-card" data-section-jump="notificacoes"><strong>Enviar comunicado</strong><span>Por e-mail</span></button>
      <button type="button" class="quick-card" data-section-jump="relatorios"><strong>Exportar relatório</strong><span>PDF ou CSV</span></button>
      <button type="button" class="quick-card" data-section-jump="logs"><strong>Ver logs</strong><span>Últimas ações</span></button>
    `;

    const dashboardActions = [
      { jump: 'certificados', label: 'Validar pendências', meta: `${data.totals.certificadosPendentes} certificados aguardando triagem`, eyebrow: 'Operação' },
      { jump: 'cursos', label: 'Cadastrar curso', meta: 'Estruture um novo eixo acadêmico', eyebrow: 'Cadastro' },
      { jump: 'regras', label: 'Criar regra', meta: 'Defina uma nova categoria de horas', eyebrow: 'Política' },
      { jump: 'notificacoes', label: 'Enviar comunicado', meta: 'Dispare um aviso segmentado por perfil', eyebrow: 'Comunicação' },
      { jump: 'relatorios', label: 'Exportar relatório', meta: 'Gere saídas em PDF ou CSV', eyebrow: 'Análise' },
      { jump: 'logs', label: 'Ver logs', meta: 'Revise o histórico operacional recente', eyebrow: 'Auditoria' }
    ];
    document.getElementById('dashboardQuickActions').innerHTML = dashboardActions.map((action) => `
      <button type="button" class="quick-card" data-section-jump="${action.jump}">
        <em>${action.eyebrow}</em>
        <strong>${action.label}</strong>
        <span>${action.meta}</span>
      </button>
    `).join('');

    document.getElementById('alertsList').innerHTML = `
      <div class="${riskStudents.length ? 'alert-critical' : ''}"><strong>${riskStudents.length} alunos em risco</strong><span>Exigem acompanhamento abaixo de 60% da meta</span></div>
      <div><strong>${data.totals.pendentes} submissões pendentes</strong><span>Aguardando avaliação de coordenadores</span></div>
      <div><strong>${data.totals.certificadosPendentes} certificados pendentes</strong><span>Triagem manual ou OCR em revisão</span></div>
      <div><strong>${data.courses.filter((course) => !(data.rules || []).some((rule) => rule.courseId === course.id)).length} cursos sem regra ativa</strong><span>Revise a configuração acadêmica</span></div>
    `;

    renderRecentActivityRows(data);
    renderCharts(data, academicSummary);
  }

  function renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    const profileFilter = document.getElementById('usersProfileFilter')?.value || '';
    const courseFilter = document.getElementById('usersCourseFilter')?.value || '';
    const statusFilter = document.getElementById('usersStatusFilter')?.value || '';
    const usersSearchTerm = normalize(document.getElementById('usersSearchInput')?.value || '');
    const users = SIGACStore.listUsers()
      .flatMap((user) => {
        if (user.tipo !== 'aluno' || !Array.isArray(user.courseLinks) || user.courseLinks.length <= 1) return [user];
        return user.courseLinks.map((link) => ({
          ...user,
          courseId: link.courseId,
          matricula: link.matricula || user.matricula,
          vinculoAtivoId: link.id,
          cursoAtivoNome: link.courseName,
          activeLink: link
        }));
      })
      .filter((user) => globalSearchTerm || user.tipo !== 'superadmin')
      .filter((user) => matchesSearch(`${user.nome} ${user.email} ${user.matricula || ''} ${user.tipo} ${user.courseId || ''} ${(user.courseIds || []).join(' ')}`))
      .filter((user) => !usersSearchTerm || normalize(`${user.nome} ${user.email} ${user.matricula || ''}`).includes(usersSearchTerm))
      .filter((user) => !profileFilter || user.tipo === profileFilter)
      .filter((user) => {
        if (!courseFilter) return true;
        if (user.tipo === 'aluno') return user.courseId === courseFilter;
        return (user.courseIds || []).includes(courseFilter);
      })
      .filter((user) => {
        if (!statusFilter) return true;
        return statusFilter === 'ativo' ? !!user.ativo : !user.ativo;
      });
    const usersListMeta = document.getElementById('usersListMeta');
    if (usersListMeta) {
      const total = users.length;
      const active = users.filter((user) => user.ativo).length;
      const inactive = total - active;
      usersListMeta.textContent = `${total} usuário(s) encontrados | ${active} ativo(s) | ${inactive} inativo(s)`;
    }
    tbody.innerHTML = users.map((user) => {
      const link = user.tipo === 'aluno'
        ? escapeHtml(SIGACStore.getCourseById(user.courseId)?.sigla || user.cursoAtivoNome || 'Sem curso')
        : (user.courseIds || []).map((id) => SIGACStore.getCourseById(id)?.sigla || id).join(', ') || 'Sem cursos';
      const roleLabel = user.tipo === 'superadmin' ? 'Super admin' : user.tipo === 'coordenador' ? 'Coordenador' : 'Aluno';
      const action = user.tipo === 'superadmin'
        ? '<span class="small admin-user-protected">Protegido</span>'
        : `<button class="toggle-status secondary admin-user-action-button" data-id="${user.id}" data-active="${user.ativo}">${user.ativo ? 'Desativar' : 'Ativar'}</button>
           <button class="reset-user-password secondary admin-user-action-button" data-id="${user.id}" data-name="${escapeHtml(user.nome)}" type="button">Redefinir senha</button>`;
      return `
        <tr class="admin-user-row ${user.ativo ? 'is-active' : 'is-inactive'}">
          <td data-label="Nome"><strong class="admin-user-name">${escapeHtml(user.nome)}</strong></td>
          <td data-label="Matrícula"><span class="admin-user-email">${escapeHtml(user.matricula || 'Matrícula não gerada')}</span></td>
          <td data-label="E-mail"><span class="admin-user-email">${escapeHtml(user.email)}</span></td>
          <td data-label="Perfil"><span class="admin-user-role">${escapeHtml(roleLabel)}</span></td>
          <td data-label="Vinculo"><span class="admin-user-link">${escapeHtml(link)}</span></td>
          <td data-label="Status"><span class="badge ${user.ativo ? 'aprovado' : 'rejeitado'} admin-user-status">${user.ativo ? 'Ativo' : 'Inativo'}</span></td>
          <td data-label="Último acesso">${formatDate(user.createdAt)}</td>
          <td data-label="Ação"><div class="admin-user-actions">${action}</div></td>
        </tr>
      `;
    }).join('') || `<tr class="admin-users-empty-row"><td colspan="8">${globalSearchTerm || usersSearchTerm ? 'Nenhum usuário encontrado para a busca.' : 'Nenhum usuário encontrado para os filtros selecionados.'}</td></tr>`;

    bindUserTableActions();
  }

  function bindUserTableActions() {
    document.querySelectorAll('.toggle-status').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', async () => {
        try {
          await SIGACStore.updateUserStatus(button.dataset.id, button.dataset.active !== 'true');
          renderAll(SIGACStore.getCurrentUser());
        } catch (error) {
          showMessage('userFormMessage', error.message, 'error');
        }
      });
    });
    document.querySelectorAll('.reset-user-password').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', async () => {
        const userName = button.dataset.name || 'este usuário';
        if (!window.confirm(`Redefinir a senha de ${userName}? O usuário terá que criar uma senha definitiva no primeiro login.`)) return;
        try {
          const response = await SIGACStore.resetUserPassword(button.dataset.id);
          const temp = response.temporaryPassword || 'não informada';
          const matricula = response.matricula || response.user?.matricula || 'sem matrícula';
          showMessage('userFormMessage', `Senha temporária gerada para ${userName}. Matrícula: ${matricula}. Senha temporária: ${temp}. Mostre essa senha apenas ao usuário.`, 'success');
          renderAll(SIGACStore.getCurrentUser());
        } catch (error) {
          showMessage('userFormMessage', error.message, 'error');
        }
      });
    });
  }

  function renderCourses() {
    const data = SIGACStore.getAdminDashboardData();
    const courses = data.courses || [];
    const users = SIGACStore.listUsers();
    const rules = data.rules || [];
    const localSearchTerm = normalize(document.getElementById('courseSearchInput')?.value || '');
    const courseStats = courses.map((course) => {
      const coordinatorCount = users.filter((user) => user.tipo === 'coordenador' && ([...(user.courseIds || []), user.courseId].filter(Boolean)).includes(course.id)).length;
      const ruleCount = rules.filter((rule) => rule.courseId === course.id).length;
      return {
        ...course,
        coordinatorCount,
        ruleCount,
        approval: percent(course.taxaAprovacao || 0)
      };
    });
    const filteredCourses = courseStats
      .filter((course) => matchesSearch(`${course.sigla} ${course.nome} ${course.area} ${course.tipo} ${course.turno}`))
      .filter((course) => !localSearchTerm || normalize(`${course.sigla} ${course.nome} ${course.area} ${course.tipo} ${course.turno}`).includes(localSearchTerm));
    const meta = document.getElementById('coursesListMeta');
    if (meta) {
      meta.textContent = `${filteredCourses.length} curso(s) encontrados | ${filteredCourses.reduce((sum, course) => sum + Number(course.totalAlunos || 0), 0)} aluno(s)`;
    }
    const emptyState = `
      <div class="admin-courses-empty">
        <strong>Nenhum curso encontrado</strong>
        <span>Ajuste a busca ou cadastre um novo curso no formulario ao lado.</span>
      </div>
    `;
    document.getElementById('coursesList').innerHTML = filteredCourses.length ? `
      <div class="table-wrap sigac-table-wrap sigac-scroll-table admin-compact-table-wrap admin-courses-active-table-wrap">
        <table class="data-table sigac-data-table sigac-compact-table admin-compact-table admin-courses-active-table">
          <thead><tr><th>Sigla</th><th>Nome do curso</th><th>Área</th><th>Tipo</th><th>Turno</th><th>Carga total</th><th>Meta do semestre</th><th>Alunos</th><th>Coordenadores</th><th>Regras</th><th>Aprovação</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>
            ${filteredCourses.map((course) => `
              <tr>
                <td><span class="admin-course-sigla compact">${escapeHtml(course.sigla)}</span></td>
                <td><strong title="${escapeHtml(course.nome)}">${escapeHtml(course.nome)}</strong></td>
                <td>${escapeHtml(course.area || 'Área não informada')}</td>
                <td>${escapeHtml(course.tipo || 'Graduação')}</td>
                <td>${escapeHtml(course.turno || 'Turno não informado')}</td>
                <td>${Number(course.cargaHorariaTotal || 0)} h</td>
                <td>${Number(course.horasMeta || 0)} h</td>
                <td>${Number(course.totalAlunos || 0)}</td>
                <td>${course.coordinatorCount}</td>
                <td>${course.ruleCount}</td>
                <td><span class="badge ${course.approval >= 70 ? 'aprovado' : course.approval >= 40 ? 'em_analise' : 'rejeitado'}">${formatPercent(course.approval)}</span></td>
                <td><span class="badge ${course.ativo ? 'aprovado' : 'rejeitado'}">${course.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td><button type="button" class="text-button toggle-course-status" data-course-id="${course.id}" data-active="${course.ativo ? '1' : '0'}">${course.ativo ? 'Desativar' : 'Ativar'}</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : emptyState;

    document.getElementById('courseDeepDiveList').innerHTML = filteredCourses.length ? `
      <div class="table-wrap sigac-table-wrap sigac-scroll-table admin-courses-table-wrap">
        <table class="data-table sigac-data-table sigac-compact-table admin-courses-table">
          <thead><tr><th>Curso</th><th>Sigla</th><th>Alunos</th><th>Coordenadores</th><th>Regras</th><th>Aprovação</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>
            ${filteredCourses.map((course) => `
              <tr>
                <td><strong>${escapeHtml(course.nome)}</strong><span>${escapeHtml(course.area || 'Area não informada')} | ${escapeHtml(course.turno || 'Turno não informado')}</span></td>
                <td><span class="admin-course-sigla compact">${escapeHtml(course.sigla)}</span></td>
                <td>${Number(course.totalAlunos || 0)}</td>
                <td>${course.coordinatorCount}</td>
                <td>${course.ruleCount}</td>
                <td><span class="badge ${course.approval >= 70 ? 'aprovado' : course.approval >= 40 ? 'em_analise' : 'rejeitado'}">${formatPercent(course.approval)}</span></td>
                <td><span class="badge ${course.ativo ? 'aprovado' : 'rejeitado'}">${course.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td><button type="button" class="text-button toggle-course-status" data-course-id="${course.id}" data-active="${course.ativo ? '1' : '0'}">${course.ativo ? 'Desativar' : 'Ativar'}</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : emptyState;

    document.querySelectorAll('.toggle-course-status').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', async () => {
        const courseId = button.dataset.courseId;
        const active = button.dataset.active === '1';
        const action = active ? 'desativar' : 'ativar';
        if (!window.confirm(`Tem certeza que deseja ${action} este curso?`)) return;
        button.disabled = true;
        try {
          await SIGACStore.updateCourseStatus(courseId, !active);
          renderAll(SIGACStore.getCurrentUser());
        } catch (error) {
          console.error('Falha ao atualizar status do curso', error);
          alert(error.message || `Não foi possível ${action} o curso.`);
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  function renderLinks() {
    const users = SIGACStore.listUsers();
    const linkRows = users
      .filter((user) => user.tipo !== 'superadmin')
      .filter((user) => matchesSearch(`${user.nome} ${user.email} ${user.matricula || ''} ${user.tipo} ${user.courseId || ''} ${(user.courseIds || []).join(' ')}`))
      .slice(0, 80);
    document.getElementById('linksHistoryList').innerHTML = linkRows.length ? `
      <div class="table-wrap sigac-table-wrap admin-links-history-table-wrap">
        <table class="data-table sigac-data-table sigac-compact-table admin-links-history-table">
          <thead>
            <tr><th>Usuário</th><th>E-mail</th><th>Perfil</th><th>Cursos</th><th>Status</th><th>Resumo</th></tr>
          </thead>
          <tbody>
            ${linkRows.map((user) => {
        const courseIds = user.tipo === 'aluno'
          ? [user.courseId].filter(Boolean)
          : (user.courseIds || []);
        const courses = courseIds
          .map((id) => SIGACStore.getCourseById(id))
          .filter(Boolean);
        const courseChips = courses.length
          ? courses.map((course) => `<span title="${escapeHtml(course.nome)}">${escapeHtml(course.sigla)}</span>`).join('')
          : '<span>Sem vínculo</span>';
        const roleLabel = user.tipo === 'coordenador' ? 'Coordenador' : 'Aluno';
        const detail = user.tipo === 'coordenador'
          ? `${courses.length} curso(s) sob acompanhamento`
          : (courses.length ? `${courses.length} curso(s) vinculados: ${courses.map((course) => course.nome).join(', ')}` : 'Aluno ainda sem curso vinculado');
        return `
          <tr class="${user.ativo ? 'is-active' : 'is-inactive'}">
            <td>
              <div class="admin-link-table-user">
                <span class="avatar-mini">${escapeHtml(getInitial(user.nome))}</span>
                <div>
                  <strong>${escapeHtml(user.nome)}</strong>
                  <span class="table-subtext">${escapeHtml(user.matricula || 'Matrícula não gerada')}</span>
                </div>
              </div>
            </td>
            <td>${escapeHtml(user.email)}</td>
            <td><span class="admin-user-role">${escapeHtml(roleLabel)}</span></td>
            <td><div class="admin-link-course-chips">${courseChips}</div></td>
            <td><span class="badge ${user.ativo ? 'aprovado' : 'rejeitado'}">${user.ativo ? 'Ativo' : 'Inativo'}</span></td>
            <td><span class="table-subtext">${escapeHtml(detail)}</span></td>
          </tr>
        `;
      }).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="item">Nenhum vínculo encontrado para a busca.</div>';
  }

  function renderRules() {
    const data = SIGACStore.getAdminDashboardData();
    const courses = SIGACStore.listCourses();
    const rules = data.rules || [];
    const courseFilter = document.getElementById('rulesCourseFilter')?.value || '';
    const categoryFilter = document.getElementById('rulesCategoryFilter')?.value || '';
    const categories = [...new Set([
      ...Array.from(document.getElementById('ruleCategoryInput')?.options || []).map((option) => option.value || option.textContent),
      ...rules.map((rule) => rule.categoria)
    ].filter(Boolean))];
    const categorySelect = document.getElementById('rulesCategoryFilter');
    if (categorySelect) {
      const current = categorySelect.value;
      categorySelect.innerHTML = `<option value="">Todas as categorias</option>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')}`;
      categorySelect.value = categories.includes(current) ? current : '';
      window.SIGACCustomSelect?.refreshAll?.();
    }
    const filteredRules = rules
      .map((rule) => ({
        ...rule,
        course: courses.find((course) => course.id === rule.courseId)
      }))
      .filter((rule) => matchesSearch(`${rule.categoria} ${rule.course?.sigla || ''} ${rule.course?.nome || ''}`))
      .filter((rule) => !courseFilter || rule.courseId === courseFilter)
      .filter((rule) => !categoryFilter || rule.categoria === categoryFilter);
    const meta = document.getElementById('rulesListMeta');
    if (meta) {
      meta.textContent = `${filteredRules.length} regra(s) encontradas | ${courses.length} curso(s) ativos`;
    }
    document.getElementById('rulesList').innerHTML = filteredRules.length ? `
      <div class="table-wrap sigac-table-wrap sigac-scroll-table admin-compact-table-wrap">
        <table class="data-table sigac-data-table sigac-compact-table admin-compact-table admin-rules-table">
          <thead><tr><th>Curso</th><th>Categoria</th><th>Carga minima</th><th>Limite maximo</th><th>Exige certificado</th><th>Aprovacao do coordenador</th><th>Status</th></tr></thead>
          <tbody>
            ${filteredRules.map((rule) => `
              <tr>
                <td><strong>${escapeHtml(rule.course?.sigla || 'Curso')}</strong><span class="table-subtext">${escapeHtml(rule.course?.nome || 'Curso nao encontrado')}</span></td>
                <td>${escapeHtml(rule.categoria)}</td>
                <td>${Number(rule.cargaMinima || 0)} h</td>
                <td>${Number(rule.limiteMaximo || 0)} h</td>
                <td><span class="badge ${rule.exigeCertificado ? 'em_analise' : 'aprovado'}">${rule.exigeCertificado ? 'Sim' : 'Nao'}</span></td>
                <td><span class="badge ${rule.exigeAprovacao ? 'em_analise' : 'aprovado'}">${rule.exigeAprovacao ? 'Manual' : 'Direta'}</span></td>
                <td><span class="badge aprovado">Ativa</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <div class="admin-rules-empty">
        <strong>Nenhuma regra encontrada</strong>
        <span>Ajuste os filtros ou cadastre uma nova regra no formulario.</span>
      </div>
    `;
  }

  function renderOpportunities() {
    const users = SIGACStore.listUsers();
    const opportunities = SIGACStore.listOpportunities();
    const searchTerm = normalize(document.getElementById('opportunitySearchInput')?.value || '');
    const statusFilter = document.getElementById('opportunityStatusFilter')?.value || '';
    const categoryFilter = document.getElementById('opportunityCategoryFilter')?.value || '';
    const enriched = opportunities.map((opportunity) => ({
      ...opportunity,
      categoria: opportunity.categoria || opportunity.category || 'Curso livre',
      status: opportunity.status || 'Aberta',
      inscritos: Array.isArray(opportunity.inscritos) ? opportunity.inscritos : []
    }));
    const filtered = enriched
      .filter((opportunity) => !searchTerm || normalize(`${opportunity.titulo} ${opportunity.descricao} ${opportunity.course?.sigla || ''} ${opportunity.course?.nome || ''}`).includes(searchTerm))
      .filter((opportunity) => !statusFilter || opportunity.status === statusFilter)
      .filter((opportunity) => !categoryFilter || opportunity.categoria === categoryFilter);
    const meta = document.getElementById('opportunitiesListMeta');
    if (meta) {
      const totalInscritos = filtered.reduce((sum, opportunity) => sum + opportunity.inscritos.length, 0);
      meta.textContent = `${filtered.length} oportunidade(s) encontradas | ${totalInscritos} inscrito(s)`;
    }
    document.getElementById('opportunitiesAdminList').innerHTML = filtered.length
      ? `<div class="table-wrap sigac-table-wrap sigac-scroll-table admin-compact-table-wrap">
          <table class="data-table sigac-data-table sigac-compact-table admin-compact-table admin-opportunities-table">
            <thead><tr><th>Título</th><th>Curso</th><th>Categoria</th><th>Horas</th><th>Status</th><th>Inscritos</th><th>Ação</th></tr></thead>
            <tbody>
              ${filtered.map((opportunity) => {
          const inscritos = opportunity.inscritos
            .map((id) => users.find((user) => user.id === id)?.nome || id)
            .filter(Boolean);
          return `
            <tr>
              <td><strong title="${escapeHtml(opportunity.titulo)}">${escapeHtml(opportunity.titulo)}</strong><span class="table-subtext">${escapeHtml(opportunity.descricao)}</span></td>
              <td><strong>${escapeHtml(opportunity.course?.sigla || 'Curso')}</strong><span class="table-subtext">${escapeHtml(opportunity.course?.nome || 'Curso não informado')}</span></td>
              <td>${escapeHtml(opportunity.categoria)}</td>
              <td>${Number(opportunity.horas || 0)} h</td>
              <td><span class="badge ${opportunity.status === 'Aberta' ? 'aprovado' : opportunity.status === 'Cancelada' ? 'rejeitado' : 'em_analise'}">${escapeHtml(opportunity.status)}</span></td>
              <td title="${escapeHtml(inscritos.join(', ') || 'Nenhum inscrito')}">${inscritos.length}</td>
              <td><button type="button" class="secondary compact-button view-enrolled" data-id="${opportunity.id}">Ver inscritos</button></td>
            </tr>
          `;
        }).join('')}
            </tbody>
          </table>
        </div>`
      : `
        <div class="admin-opportunities-empty">
          <strong>Nenhuma oportunidade encontrada</strong>
          <span>Ajuste a busca ou os filtros, ou lance uma nova oportunidade.</span>
        </div>
      `;
    // Bind actions for admin opportunity buttons
    document.querySelectorAll('.view-enrolled').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', () => {
        try {
          const opp = SIGACStore.listOpportunities().find((o) => o.id === button.dataset.id) || {};
          const names = (opp.inscritos || []).map((id) => SIGACStore.listUsers().find((u) => u.id === id)?.nome || id).filter(Boolean);
          alert(names.length ? `Inscritos:\n${names.join('\n')}` : 'Nenhum inscrito nesta oportunidade.');
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function renderSubmissionsTable(submissions) {
    if (!submissions.length) return '<div class="item">Nenhum envio encontrado.</div>';
    return `
      <div class="table-wrap sigac-table-wrap sigac-scroll-table admin-compact-table-wrap">
      <table class="data-table sigac-data-table sigac-compact-table admin-compact-table">
        <thead><tr><th>Aluno</th><th>Atividade</th><th>Curso</th><th>Horas</th><th>Status</th><th>Enviado em</th></tr></thead>
        <tbody>
          ${submissions.map((submission) => `
            <tr>
              <td>${escapeHtml(submission.student?.nome || 'Aluno removido')}</td>
              <td>${escapeHtml(submission.activity?.titulo || submission.activityId)}</td>
              <td>${escapeHtml(submission.course?.sigla || '-')}</td>
              <td>${submission.activity?.horas || 0} h</td>
              <td><span class="badge ${badgeClass(submission.latest?.status)}">${escapeHtml(statusLabel(submission.latest?.status))}</span></td>
              <td>${formatDate(submission.latest?.enviadaEm)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
    `;
  }

  function renderSubmissionShowcase(submissions) {
    if (!submissions.length) return '<div class="item">Nenhum envio encontrado.</div>';
    return submissions.map((submission) => {
      const studentName = escapeHtml(submission.student?.nome || 'Aluno removido');
      const activityTitle = escapeHtml(submission.activity?.titulo || submission.activityId);
      const courseCode = escapeHtml(submission.course?.sigla || '-');
      const hours = submission.activity?.horas || 0;
      const status = escapeHtml(statusLabel(submission.latest?.status));
      const badge = badgeClass(submission.latest?.status);
      return `
        <article class="submission-card">
          <div class="submission-card-head">
            <div class="submission-person">
              <span class="avatar-mini submission-avatar">${getInitial(submission.student?.nome)}</span>
              <div class="submission-copy">
                <strong>${studentName}</strong>
                <span>${courseCode} - ${formatDate(submission.latest?.enviadaEm)}</span>
              </div>
            </div>
            <span class="badge ${badge}">${status}</span>
          </div>
          <div class="submission-title">${activityTitle}</div>
          <div class="submission-card-foot">
            <span class="submission-chip">${courseCode}</span>
            <span class="submission-stat">${hours} h</span>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderSubmissions() {
    const data = SIGACStore.getAdminDashboardData();
    const allSubmissions = getSubmissions(data);
    const currentStatusFilter = document.getElementById('submissionStatusFilter')?.value || '';
    const currentCourseFilter = document.getElementById('submissionCourseFilter')?.value || '';
    const currentStudentFilter = document.getElementById('submissionStudentFilter')?.value || '';
    const currentTypeFilter = document.getElementById('submissionTypeFilter')?.value || '';
    const submissionType = (submission) => submission.activity?.categoria || submission.activity?.tipo || submission.activity?.category || 'Atividade';
    const ageDays = (submission) => {
      const sent = new Date(submission.latest?.enviadaEm || 0).getTime();
      return sent ? Math.floor((Date.now() - sent) / 86400000) : 0;
    };
    const hasOcrDivergence = (submission) => {
      const ocrStatus = String(submission.latest?.ocrStatus || submission.ocrStatus || '').toLowerCase();
      const ocrReason = String(submission.latest?.ocrReason || submission.ocrReason || '').toLowerCase();
      return ['analise_manual', 'rejeitado_automatico', 'divergente'].includes(ocrStatus) || ocrReason.includes('diverg');
    };
    const uniqueOptions = (items, valueFn, labelFn) => [...new Map(items.map((item) => [valueFn(item), labelFn(item)]).filter(([value]) => value)).entries()];
    const syncFilter = (id, placeholder, options, currentValue) => {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = `<option value="">${placeholder}</option>${options.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('')}`;
      select.value = options.some(([value]) => value === currentValue) ? currentValue : '';
    };
    syncFilter('submissionCourseFilter', 'Todos os cursos', uniqueOptions(allSubmissions, (item) => item.course?.id || item.activity?.courseId || item.course?.sigla, (item) => item.course?.sigla ? `${item.course.sigla} - ${item.course.nome || 'Curso'}` : item.course?.nome || 'Curso'), currentCourseFilter);
    syncFilter('submissionStudentFilter', 'Todos os alunos', uniqueOptions(allSubmissions, (item) => item.student?.id || item.studentId, (item) => item.student?.nome || 'Aluno removido'), currentStudentFilter);
    syncFilter('submissionTypeFilter', 'Todos os tipos', uniqueOptions(allSubmissions, submissionType, submissionType), currentTypeFilter);
    const filters = {
      status: document.getElementById('submissionStatusFilter')?.value || '',
      course: document.getElementById('submissionCourseFilter')?.value || '',
      student: document.getElementById('submissionStudentFilter')?.value || '',
      type: document.getElementById('submissionTypeFilter')?.value || ''
    };
    const submissions = allSubmissions
      .filter((submission) => matchesSearch(`${submission.student?.nome || ''} ${submission.activity?.titulo || ''} ${submission.course?.sigla || ''} ${statusLabel(submission.latest?.status)} ${submissionType(submission)}`))
      .filter((submission) => !filters.status || submission.latest?.status === filters.status)
      .filter((submission) => !filters.course || [submission.course?.id, submission.activity?.courseId, submission.course?.sigla].includes(filters.course))
      .filter((submission) => !filters.student || [submission.student?.id, submission.studentId].includes(filters.student))
      .filter((submission) => !filters.type || submissionType(submission) === filters.type)
      .sort((a, b) => {
        const score = (item) => (['pendente', 'em_analise', 'correcao'].includes(item.latest?.status) ? 40 : 0) + (hasOcrDivergence(item) ? 30 : 0) + (ageDays(item) >= 7 ? 20 : 0) + ageDays(item);
        return score(b) - score(a);
      });
    const meta = document.getElementById('submissionsQueueMeta') || document.querySelector('#envios .section-title .small');
    if (meta) {
      meta.textContent = `${submissions.length} envio(s) | ${submissions.filter((item) => ['pendente', 'em_analise', 'correcao'].includes(item.latest?.status)).length} pendente(s) | ${submissions.filter(hasOcrDivergence).length} OCR divergente(s)`;
    }
    document.getElementById('submissionsQueueList').innerHTML = submissions.length ? submissions.map((submission) => {
      const pending = ['pendente', 'em_analise', 'correcao'].includes(submission.latest?.status);
      const divergent = hasOcrDivergence(submission);
      const old = ageDays(submission) >= 7;
      const priorityClass = pending ? 'priority-pending' : divergent ? 'priority-ocr' : old ? 'priority-old' : '';
      const priorityLabel = pending ? 'Prioridade' : divergent ? 'OCR divergente' : old ? 'Antigo' : 'Monitorado';
      return `
        <article class="admin-submission-card ${priorityClass}">
          <div class="admin-submission-card-head">
            <div class="submission-person">
              <span class="avatar-mini submission-avatar">${escapeHtml(getInitial(submission.student?.nome))}</span>
              <div class="submission-copy">
                <strong>${escapeHtml(submission.student?.nome || 'Aluno removido')}</strong>
                <span>${escapeHtml(submission.course?.sigla || '-')} - ${formatDate(submission.latest?.enviadaEm)}</span>
              </div>
            </div>
            <span class="badge ${badgeClass(submission.latest?.status)}">${escapeHtml(statusLabel(submission.latest?.status))}</span>
          </div>
          <h3 title="${escapeHtml(submission.activity?.titulo || submission.activityId)}">${escapeHtml(submission.activity?.titulo || submission.activityId)}</h3>
          <div class="admin-submission-priority">
            <span>${priorityLabel}</span>
            ${divergent ? '<span>OCR divergente</span>' : ''}
            ${old ? `<span>${ageDays(submission)} dias</span>` : ''}
          </div>
          <div class="admin-submission-meta-grid">
            <div><span>Curso</span><strong>${escapeHtml(submission.course?.sigla || '-')}</strong></div>
            <div><span>Tipo</span><strong>${escapeHtml(submissionType(submission))}</strong></div>
            <div><span>Horas</span><strong>${Number(submission.activity?.horas || 0)} h</strong></div>
            <div><span>Versoes</span><strong>${(submission.versions || []).length || 1}</strong></div>
          </div>
        </article>
      `;
    }).join('') : '<div class="admin-submissions-empty"><strong>Nenhum envio encontrado</strong><span>Ajuste os filtros ou a busca global para revisar a fila.</span></div>';
    const first = submissions[0];
    document.getElementById('submissionTimelineList').innerHTML = first ? `
      <div class="timeline-item"><strong>Aluno</strong><span>${escapeHtml(first.student?.nome || 'Aluno removido')} | ${escapeHtml(first.course?.sigla || '-')}</span></div>
      <div class="timeline-item"><strong>Enviado</strong><span>${formatDate(first.latest?.enviadaEm)}${ageDays(first) >= 7 ? ` | ${ageDays(first)} dias na fila` : ''}</span></div>
      <div class="timeline-item"><strong>Validação operacional</strong><span>${hasOcrDivergence(first) ? 'OCR divergente ou revisão manual indicada' : 'Sem divergência OCR registrada'}</span></div>
      <div class="timeline-item"><strong>Status atual</strong><span>${escapeHtml(statusLabel(first.latest?.status))}</span></div>
    ` : '<div class="item">Sem submissão para exibir.</div>';
    document.getElementById('correctionsList').innerHTML = submissions
      .filter((submission) => ['rejeitado', 'correcao'].includes(submission.latest?.status))
      .map((submission) => `<article class="admin-correction-card"><div><h4>${escapeHtml(submission.activity?.titulo || 'Atividade')}</h4><p>${escapeHtml(submission.student?.nome || 'Aluno')} precisa reenviar a documentação.</p></div><span class="badge ${badgeClass(submission.latest?.status)}">${escapeHtml(statusLabel(submission.latest?.status))}</span></article>`)
      .join('') || '<div class="admin-submissions-empty"><strong>Nenhuma correção pendente</strong><span>Os envios filtrados não exigem reenvio neste momento.</span></div>';
  }

  function getCertificateRequestKey(certificate, previous) {
    const senderId = certificate.sender?.id || certificate.senderId || certificate.senderType || 'sem-remetente';
    const observation = normalize(certificate.observation || '');
    const createdAt = new Date(certificate.createdAt || 0).getTime();
    const previousAt = previous ? new Date(previous.createdAt || 0).getTime() : 0;
    const sameBatchWindow = previous
      && (previous.sender?.id || previous.senderId || previous.senderType || 'sem-remetente') === senderId
      && normalize(previous.observation || '') === observation
      && Math.abs(createdAt - previousAt) <= 10000;

    if (sameBatchWindow) return getCertificateRequestKey(previous);
    return [senderId, observation, Number.isFinite(createdAt) ? Math.floor(createdAt / 10000) : certificate.createdAt || certificate.id].join('|');
  }

  function groupCertificatesIntoRequests(certificates) {
    const ordered = [...certificates].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const groups = [];
    const byKey = new Map();

    ordered.forEach((certificate, index) => {
      const key = getCertificateRequestKey(certificate, ordered[index - 1]);
      if (!byKey.has(key)) {
        const request = {
          id: key,
          first: certificate,
          certificates: [],
          createdAt: certificate.createdAt
        };
        byKey.set(key, request);
        groups.push(request);
      }
      byKey.get(key).certificates.push(certificate);
    });

    return groups.map((request) => {
      const certificates = request.certificates;
      return {
        ...request,
        totalDetectedHours: certificates.reduce((sum, item) => sum + Number(item.detectedHours || 0), 0),
        totalApprovedHours: certificates.reduce((sum, item) => sum + Number(item.approvedHours || 0), 0),
        pendingCount: certificates.filter((item) => item.adminStatus === 'pendente').length,
        rejectedCount: certificates.filter((item) => item.adminStatus === 'rejeitado').length,
        ocrRejectedCount: certificates.filter((item) => item.ocrStatus === 'rejeitado_automatico' || item.adminStatus === 'rejeitado').length,
        ocrDivergent: certificates.some((item) => ['analise_manual', 'rejeitado_automatico'].includes(item.ocrStatus) || (item.missingFields || []).length)
      };
    });
  }

  function renderCertificateRequestItem(certificate) {
    const detectedActivityName = certificate.detectedCourseName || certificate.detectedTitle || '';
    const canReview = true;
    const isOcrRejected = certificate.ocrStatus === 'rejeitado_automatico' || certificate.adminStatus === 'rejeitado';
    return `
      <div class="sigac-certificate-request-file ${isOcrRejected ? 'is-ocr-rejected' : ''}" data-certificate-id="${certificate.id}">
        <div class="admin-certificate-status-row sigac-certificate-status-row">
          <span><strong>${escapeHtml(certificate.fileName)}</strong><em class="badge ${badgeClass(certificate.adminStatus)}">${escapeHtml(statusLabel(certificate.adminStatus))}</em></span>
          <span>
            <strong>OCR</strong><em class="badge ${badgeClass(certificate.ocrStatus)}">${escapeHtml(statusLabel(certificate.ocrStatus))}</em>
            ${isOcrRejected ? '<button type="button" class="ocr-remove-x remove-rejected-cert-btn" title="Retirar da contagem">X</button>' : ''}
          </span>
        </div>
        ${renderOcrMatchSummary(certificate)}
        <details class="sigac-ocr-details">
          <summary>Ver detalhes</summary>
          ${renderOcrDecisionPanel(certificate)}
          <div class="ocr-compare">
            <div><strong>Campo</strong><strong>Informado</strong><strong>Detectado pelo OCR</strong></div>
            <div><span>Nome da atividade</span><span>${escapeHtml(certificate.observation || 'Não informado')}</span><span>${escapeHtml(detectedActivityName || 'Não identificado')}</span></div>
            <div><span>Carga horária</span><span>${certificate.declaredHours || 0} h</span><span>${certificate.detectedHours || 0} h</span></div>
            <div><span>Horas aproveitadas</span><span>${Number(certificate.hourBreakdown?.approvedHours ?? certificate.approvedHours ?? 0)} h</span><span>Excedente: ${Number(certificate.hourBreakdown?.excessHours ?? 0)} h</span></div>
            <div><span>Limite/restante</span><span>Categoria: ${Number(certificate.hourBreakdown?.categoryLimitHours ?? 0)} h</span><span>Semestre: ${Number(certificate.hourBreakdown?.remainingToSemesterHours ?? 0)} h</span></div>
            <div><span>Instituição</span><span>Não informado</span><span>${escapeHtml(certificate.detectedInstitution || 'Não identificada')}</span></div>
            <div><span>Data</span><span>${formatDate(certificate.createdAt)}</span><span>${escapeHtml(certificate.detectedDate || 'Não identificada')}</span></div>
          </div>
        </details>
        <div class="actions-row admin-certificate-actions">
          <button type="button" class="secondary download-cert-btn">Abrir arquivo</button>
          <button type="button" class="secondary run-ocr-btn">Processar OCR</button>
          ${canReview ? '<button type="button" class="success approve-cert-btn">Aprovar</button><button type="button" class="danger reject-cert-btn">Rejeitar</button>' : ''}
        </div>
        <div class="field admin-certificate-feedback">
          <label>Feedback do admin</label>
          ${renderFeedbackQuickActions(certificate, canReview)}
          <textarea class="certificate-feedback" placeholder="Comentário final para o remetente" ${canReview ? '' : 'disabled'}>${escapeHtml(certificate.adminFeedback || '')}</textarea>
        </div>
      </div>
    `;
  }

  function renderCertificates() {
    const data = SIGACStore.getAdminDashboardData();
    const allCertificates = data.certificates || [];

    const adminSelect = document.getElementById('certificateAdminStatusFilter');
    const ocrFilter = document.getElementById('certificateOcrStatusFilter')?.value || '';

    if (adminSelect && !adminSelect.value) {
      adminSelect.value = 'pendente';
    }

    const adminFilter = adminSelect?.value || 'pendente';

    const certificates = allCertificates
      .filter((certificate) => !adminFilter || certificate.adminStatus === adminFilter)
      .filter((certificate) => !ocrFilter || certificate.ocrStatus === ocrFilter)
      .filter((certificate) => matchesSearch(`${certificate.fileName} ${certificate.sender?.nome || ''} ${certificate.senderType} ${statusLabel(certificate.adminStatus)} ${statusLabel(certificate.ocrStatus)}`));
    const certificateRequests = groupCertificatesIntoRequests(certificates);

    document.getElementById('certificateAdminStats').innerHTML = `
      <div class="card"><h3>Pendentes</h3><div class="metric-value">${allCertificates.filter((item) => item.adminStatus === 'pendente').length}</div></div>
      <div class="card"><h3>OCR aprovado automaticamente</h3><div class="metric-value">${allCertificates.filter((item) => item.ocrStatus === 'aprovado_automatico').length}</div></div>
      <div class="card"><h3>OCR em revisão manual</h3><div class="metric-value">${allCertificates.filter((item) => item.ocrStatus === 'analise_manual').length}</div></div>
      <div class="card"><h3>Rejeitados</h3><div class="metric-value">${allCertificates.filter((item) => ['rejeitado', 'removido', 'removido_da_contagem'].includes(item.adminStatus)).length}</div></div>
    `;

    const meta = document.getElementById('certificatesQueueMeta');
    if (meta) {
      const pending = certificates.filter((item) => item.adminStatus === 'pendente').length;
      const divergent = certificates.filter((item) => ['analise_manual', 'rejeitado_automatico'].includes(item.ocrStatus)).length;
      meta.textContent = `${certificateRequests.length} solicitação(ões) OCR | ${certificates.length} certificado(s) | ${pending} pendente(s) | ${divergent} divergência(s) OCR`;
    }

    const container = document.getElementById('certificatesAdminList');

    if (!certificateRequests.length) {
      container.innerHTML = `
        <div class="admin-certificates-empty">
          <strong>Nenhum certificado encontrado</strong>
          <span>${globalSearchTerm ? 'Nenhum resultado para a busca atual.' : 'Os certificados aprovados ou rejeitados ficam ocultos da fila principal. Use os filtros para consultar outros status.'}</span>
        </div>
      `;
      return;
    }

    container.innerHTML = certificateRequests.map((request) => {
      const certificate = request.first;
      const senderCourse = certificate.sender?.courseId ? SIGACStore.getCourseById(certificate.sender.courseId) : null;
      return window.SIGACOCR.renderCertificateBatchCard({
        request,
        courseLabel: senderCourse?.sigla || certificate.senderType || '-'
      });
    }).join('');
    window.SIGACOCR.bindCertificateBatchSelection(container);
  }

  function downloadCsv(fileName, headers, rows) {
    const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const content = [headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
    const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function exportAdminReport(reportType) {
    const data = SIGACStore.getAdminDashboardData();
    const students = getStudents(data);
    const submissions = getSubmissions(data);
    const mlRows = Array.isArray(lastMlData?.riscos) ? lastMlData.riscos : [];
    const studentReportRows = mlRows.length
      ? mlRows.map((item) => ({
          nome: mlStudentName(item),
          email: item.email || '',
          course: { sigla: item.curso || item.curso_id || '' },
          progress: {
            total: Number(item.horas_aprovadas || 0),
            target: Number(item.meta_horas || 0),
            percent: percent(item.percentual_concluido || item.percentual_conclusao || 0)
          }
        }))
      : students;
    const date = new Date().toISOString().slice(0, 10);
    const exports = {
      completed: {
        file: `sigac-alunos-concluidos-${date}.csv`,
        headers: ['Aluno', 'E-mail', 'Curso', 'Horas', 'Meta do semestre', 'Percentual'],
        rows: studentReportRows.filter((student) => percent(student.progress?.percent) >= 100).map((student) => [
          student.nome, student.email, student.course?.sigla, student.progress?.total, student.progress?.target, formatPercent(student.progress?.percent)
        ])
      },
      risk: {
        file: `sigac-alunos-em-risco-${date}.csv`,
        headers: ['Aluno', 'E-mail', 'Curso', 'Horas', 'Meta do semestre', 'Percentual'],
        rows: studentReportRows.filter((student) => percent(student.progress?.percent) < 60).sort((a, b) => percent(a.progress?.percent) - percent(b.progress?.percent)).map((student) => [
          student.nome, student.email, student.course?.sigla, student.progress?.total, student.progress?.target, formatPercent(student.progress?.percent)
        ])
      },
      submissions: {
        file: `sigac-envios-${date}.csv`,
        headers: ['Aluno', 'Curso', 'Atividade', 'Status', 'Horas declaradas', 'Enviado em'],
        rows: submissions.map((submission) => [
          submission.student?.nome, submission.course?.sigla, submission.activity?.titulo, statusLabel(submission.latest?.status),
          submission.latest?.horasDeclaradas, formatDate(submission.latest?.enviadaEm)
        ])
      },
      rejections: {
        file: `sigac-rejeicoes-correcoes-${date}.csv`,
        headers: ['Aluno', 'Curso', 'Atividade', 'Status', 'Feedback', 'Enviado em'],
        rows: submissions.filter((submission) => ['rejeitado', 'correcao'].includes(submission.latest?.status)).map((submission) => [
          submission.student?.nome, submission.course?.sigla, submission.activity?.titulo, statusLabel(submission.latest?.status),
          submission.latest?.feedback, formatDate(submission.latest?.enviadaEm)
        ])
      },
      coordinators: {
        file: `sigac-coordenadores-${date}.csv`,
        headers: ['Coordenador', 'E-mail', 'Cursos vinculados', 'Quantidade de cursos'],
        rows: SIGACStore.listUsers().filter((item) => item.tipo === 'coordenador').map((coordinator) => [
          coordinator.nome, coordinator.email,
          (coordinator.courseIds || []).map((id) => SIGACStore.getCourseById(id)?.sigla || id).join(', '),
          (coordinator.courseIds || []).length
        ])
      },
      courses: {
        file: `sigac-desempenho-cursos-${date}.csv`,
        headers: ['Curso', 'Nome', 'Alunos', 'Taxa de aprovação', 'Meta do semestre'],
        rows: (data.courses || []).map((course) => [
          course.sigla, course.nome, course.totalAlunos, formatPercent(course.taxaAprovacao || 0), course.horasMeta
        ])
      }
    };
    const report = exports[reportType];
    if (!report) return;
    downloadCsv(report.file, report.headers, report.rows);
  }

  function renderReports() {
    const data = SIGACStore.getAdminDashboardData();
    const academicRows = buildAcademicMlRows(data);
    let riskStudents = academicRows.filter((student) => student.risk === 'alto');
    let done = academicRows.filter((student) => student.progress.percent >= 100);
    let rejectedCount = data.totals.rejeitados;
    if (lastMlData && Array.isArray(lastMlData.riscos) && lastMlData.riscos.length) {
      rejectedCount = Number(lastMlData.execucao?.total_rejeitados ?? lastMlData.execucao?.rejeitados ?? rejectedCount);
    }
    document.getElementById('reportDoneCount').textContent = done.length;
    document.getElementById('reportRiskCount').textContent = riskStudents.length;
    document.getElementById('reportRejectedCount').textContent = rejectedCount;
    document.getElementById('riskReportList').innerHTML = riskStudents.length ? `
      <div class="table-wrap sigac-table-wrap sigac-scroll-table admin-compact-table-wrap admin-risk-table-wrap">
        <table class="data-table sigac-data-table sigac-compact-table admin-compact-table admin-risk-table">
          <thead><tr><th>Aluno</th><th>Curso</th><th>E-mail</th><th>Horas registradas</th><th>Meta do semestre</th><th>% concluído</th><th>Status/Risco</th></tr></thead>
          <tbody>
            ${riskStudents.map((student) => {
              const donePercent = percent(student.progress?.percent);
              const target = Number(student.progress?.goal || student.progress?.target || student.course?.horasMeta || 0);
              return `
                <tr>
                  <td><strong>${escapeHtml(student.nome)}</strong></td>
                  <td>${escapeHtml(student.course?.sigla || student.course?.nome || 'Curso')}</td>
                  <td>${escapeHtml(student.email || 'sem e-mail')}</td>
                  <td>${Number(student.progress?.total || 0)} h</td>
                  <td>${target} h</td>
                  <td>${formatPercent(donePercent)}</td>
                  <td><span class="badge ${donePercent < 40 ? 'rejeitado' : 'em_analise'}">${donePercent < 40 ? 'Alto risco' : 'Atenção'}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="admin-reports-empty"><strong>Nenhum aluno em risco</strong><span>Todos os alunos monitorados estão acima do limite crítico.</span></div>';
    document.getElementById('reportsList').innerHTML = `
      <section class="admin-report-category">
        <h3>Alunos</h3>
        <button type="button" class="admin-export-button" data-report="completed"><strong>Alunos que concluíram</strong><span>Exportar CSV</span></button>
        <button type="button" class="admin-export-button" data-report="risk"><strong>Risco de não conclusão</strong><span>Exportar lista prioritária</span></button>
      </section>
      <section class="admin-report-category">
        <h3>Envios</h3>
        <button type="button" class="admin-export-button" data-report="submissions"><strong>Submissões por período</strong><span>Exportar CSV analítico</span></button>
        <button type="button" class="admin-export-button" data-report="rejections"><strong>Rejeições e correções</strong><span>Exportar CSV de pendências</span></button>
      </section>
      <section class="admin-report-category">
        <h3>Coordenação</h3>
        <button type="button" class="admin-export-button" data-report="coordinators"><strong>Coordenadores e cursos vinculados</strong><span>Exportar CSV gerencial</span></button>
        <button type="button" class="admin-export-button" data-report="courses"><strong>Desempenho por curso</strong><span>Exportar CSV</span></button>
      </section>
    `;
  }

  function renderNotifications() {
    ensureNotificationsLayout();
    renderNotificationComposer();
    const data = SIGACStore.getAdminDashboardData();
    const historyMeta = document.getElementById('notificationsHistoryMeta');
    if (historyMeta) {
      historyMeta.textContent = data.emails.length
        ? `${data.emails.length} comunicado(s) registrados na fila de e-mail simulada`
        : 'Linha do tempo dos comunicados registrados';
    }

    const container = document.getElementById('notificationsList');
    if (!container) return;
    container.innerHTML = data.emails.length
      ? data.emails.slice(0, 12).map((mail) => {
        const recipients = getNotificationRecipientMeta(mail);
        return `
          <article class="notification-history-card">
            <div class="notification-history-line" aria-hidden="true"></div>
            <div class="notification-history-dot" aria-hidden="true"></div>
            <div class="notification-history-body">
              <div class="notification-history-head">
                <span class="notification-history-kind">${escapeHtml(notificationKindLabel(mail.kind))}</span>
                <span class="badge">${escapeHtml(mail.status || 'Registrado')}</span>
              </div>
              <h3 title="${escapeAttribute(mail.subject)}">${escapeHtml(mail.subject || 'Comunicado')}</h3>
              <div class="notification-history-meta">
                <span>${formatDate(mail.createdAt)}</span>
                <span>${recipients.count} destinatário(s)</span>
                <span>Modelo ${escapeHtml(notificationKindLabel(mail.kind))}</span>
              </div>
              <p class="notification-history-summary">${escapeHtml(mail.body || 'Sem mensagem registrada.')}</p>
              <div class="notification-history-recipients">
                ${recipients.details.map((item) => `
                  <span class="summary-chip" title="${escapeAttribute(item.email)}">
                    <strong>${escapeHtml(item.label)}</strong>${item.role ? ` ${escapeHtml(item.role)}` : ''}
                  </span>
                `).join('')}
              </div>
            </div>
          </article>
        `;
      }).join('')
      : '<div class="admin-notifications-empty"><strong>Nenhum comunicado enviado</strong><span>Os registros de e-mail simulados aparecerão aqui conforme os fluxos atuais do sistema forem executados.</span></div>';
  }

  function renderLogs() {
    ensureLogsLayout();
    const data = SIGACStore.getAdminDashboardData();
    const allLogs = data.auditLogs || [];
    const query = normalize(auditFilters.query);
    const actionFilter = document.getElementById('auditActionFilter');
    const actorFilter = document.getElementById('auditActorFilter');
    const periodFilter = document.getElementById('auditPeriodFilter');
    const actions = [...new Map(allLogs.map((log) => [log.action, auditActionLabel(log.action)])).entries()].filter(([value]) => value);
    const actors = [...new Map(allLogs.map((log) => [log.actorName || 'Sistema', log.actorName || 'Sistema'])).entries()];

    if (actionFilter) {
      actionFilter.innerHTML = `<option value="">Todas as acoes</option>${actions.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('')}`;
      actionFilter.value = actions.some(([value]) => value === auditFilters.action) ? auditFilters.action : '';
      auditFilters.action = actionFilter.value;
    }
    if (actorFilter) {
      actorFilter.innerHTML = `<option value="">Todos os usuarios</option>${actors.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('')}`;
      actorFilter.value = actors.some(([value]) => value === auditFilters.actor) ? auditFilters.actor : '';
      auditFilters.actor = actorFilter.value;
    }
    if (periodFilter) periodFilter.value = auditFilters.period;
    window.SIGACCustomSelect?.refreshAll?.();

    const logs = allLogs.filter((log) => {
      const haystack = normalize(`${log.action} ${log.actorName} ${log.details} ${log.entityType} ${log.entityId}`);
      return (!query || haystack.includes(query))
        && (!auditFilters.action || log.action === auditFilters.action)
        && (!auditFilters.actor || (log.actorName || 'Sistema') === auditFilters.actor)
        && auditPeriodMatch(log, auditFilters.period);
    });

    const summary = buildAuditSummary(logs);
    const meta = document.getElementById('auditLogMeta');
    if (meta) {
      meta.textContent = `${summary.total} registro(s) filtrado(s) | ${summary.critical} ação(ões) crítica(s) | ${summary.actors} ator(es)`;
    }

    const summaryBox = document.getElementById('auditSummary');
    if (summaryBox) {
      summaryBox.innerHTML = `
        <div class="summary-stat ${summary.critical ? 'rejected' : ''}"><span>Ações críticas</span><strong>${summary.critical}</strong></div>
        <div class="summary-stat"><span>Eventos exibidos</span><strong>${summary.total}</strong></div>
        <div class="summary-stat ${summary.actions > 6 ? 'pending' : ''}"><span>Tipos de ação</span><strong>${summary.actions}</strong></div>
        <div class="summary-stat ${summary.actors > 4 ? 'approved' : ''}"><span>Usuários distintos</span><strong>${summary.actors}</strong></div>
      `;
    }

    const container = document.getElementById('auditLogList');
    if (!container) return;
    container.innerHTML = logs.length
      ? `<div class="table-wrap sigac-table-wrap sigac-scroll-table admin-compact-table-wrap admin-audit-table-wrap">
          <table class="data-table sigac-data-table sigac-compact-table admin-compact-table admin-audit-table">
            <thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Status</th><th>Detalhe</th></tr></thead>
            <tbody>
              ${logs.map((log) => {
        const severity = auditSeverity(log);
        return `
          <tr class="tone-${severity}">
            <td>${formatDate(log.createdAt)}</td>
            <td>${escapeHtml(log.actorName || 'Sistema')}</td>
            <td>${escapeHtml(auditActionLabel(log.action))}</td>
            <td>${escapeHtml(auditEntityLabel(log.entityType))}${log.entityId ? `<span class="table-subtext">ID ${escapeHtml(log.entityId)}</span>` : ''}</td>
            <td><span class="badge ${severity === 'critical' ? 'rejeitado' : severity === 'attention' ? 'em_analise' : 'aprovado'}">${escapeHtml(auditSeverityLabel(severity))}</span></td>
            <td><span class="table-subtext is-clamped">${escapeHtml(log.details || 'Sem detalhe adicional registrado para esta operacao.')}</span></td>
          </tr>
        `;
      }).join('')}
            </tbody>
          </table>
        </div>`
      : '<div class="admin-notifications-empty"><strong>Nenhum registro encontrado</strong><span>Ajuste a busca ou os filtros para ampliar a visualização da auditoria.</span></div>';
  }

  function renderSettings() {
    ensureSettingsLayout();
    const data = SIGACStore.getAdminDashboardData();
    document.getElementById('horasMeta').value = data.settings.horasMetaPadrao;
    document.getElementById('emailToggle').checked = !!data.settings.emailNotificationsEnabled;
    document.getElementById('ocrToggle').checked = !!data.settings.ocrDisponivel;
    const emailMeta = document.getElementById('emailListMeta');
    if (emailMeta) {
      emailMeta.textContent = data.emails.length
        ? `${data.emails.length} registro(s) de comunicação simulada`
        : 'Fila local usada para auditoria de comunicação';
    }
    document.getElementById('emailList').innerHTML = data.emails.length
      ? data.emails.slice(0, 10).map((mail) => `
          <div class="item">
            <h4>${escapeHtml(mail.subject)}</h4>
            <p><strong>Para:</strong> ${escapeHtml(mail.to)}</p>
            <p class="meta">${formatDate(mail.createdAt)} | ${escapeHtml(mail.status)}</p>
          </div>
        `).join('')
      : '<div class="item">Nenhum e-mail simulado registrado.</div>';
    syncSettingsVisualState();
  }

  function bindDynamicActions(user) {
    document.querySelectorAll('[data-section-jump]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';

      button.addEventListener('click', async () => {
        await openSection(button.dataset.sectionJump);
      });
    });

    document.querySelectorAll('.admin-export-button[data-report]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', () => exportAdminReport(button.dataset.report));
    });

    document.querySelectorAll('.feedback-template-btn').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';

      button.addEventListener('click', () => {
        const card = button.closest('.sigac-ocr-batch-card') || button.closest('[data-certificate-id]');
        const textarea = card?.querySelector('.certificate-feedback');
        if (!textarea) return;

        textarea.value = button.dataset.feedback || '';
        textarea.focus();
      });
    });

    const processAdminCertificateOcr = async (certificate, expectedName = '') => {
      const file = await SIGACStore.getAdminCertificateFile(certificate.id);
      const result = await window.SIGACOCR.analyzeCertificateData(file.fileData, { expectedName });
      await SIGACStore.saveCertificateOcrResult(user.id, certificate.id, result);
    };

    const bulkOcrButton = document.getElementById('processVisibleOcrBtn');
    if (bulkOcrButton && bulkOcrButton.dataset.bound !== 'true') {
      bulkOcrButton.dataset.bound = 'true';
      bulkOcrButton.addEventListener('click', async () => {
        const data = SIGACStore.getAdminDashboardData();
        if (!data.settings.ocrDisponivel) {
          showMessage('settingsMessage', 'Ative o OCR nas configurações antes de processar certificados.', 'error');
          setActiveSection('configuracoes');
          return;
        }
        const ids = [...document.querySelectorAll('#certificatesAdminList .sigac-ocr-cert-chip[data-certificate-id]')]
          .map((card) => card.dataset.certificateId)
          .filter(Boolean);
        const certificates = ids
          .map((id) => data.certificates.find((item) => item.id === id))
          .filter(Boolean);
        if (!certificates.length) {
          showMessage('settingsMessage', 'Nenhum certificado visível para processar.', 'error');
          return;
        }

        bulkOcrButton.disabled = true;
        const originalLabel = bulkOcrButton.textContent;
        try {
          let failed = 0;
          for (let index = 0; index < certificates.length; index += 1) {
            bulkOcrButton.textContent = `Processando ${index + 1}/${certificates.length}...`;
            try {
              await processAdminCertificateOcr(certificates[index], certificates[index].sender?.nome || '');
            } catch (_) {
              failed += 1;
            }
          }
          const processed = certificates.length - failed;
          showMessage('settingsMessage', failed
            ? `${processed} certificado(s) processados pelo OCR; ${failed} exigem validação manual.`
            : `${processed} certificado(s) processados pelo OCR.`, failed ? 'error' : 'success');
          renderAll(user);
          setActiveSection('certificados');
        } catch (error) {
          showMessage('settingsMessage', `Falha no OCR: ${error.message}`, 'error');
        } finally {
          bulkOcrButton.disabled = false;
          bulkOcrButton.textContent = originalLabel;
        }
      });
    }

    document.querySelectorAll('.run-ocr-btn').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';

      button.addEventListener('click', async () => {
        const data = SIGACStore.getAdminDashboardData();
        const certificateId = window.SIGACOCR.getSelectedCertificateId(button);
        const current = data.certificates.find((item) => item.id === certificateId);

        if (!current) return;

        if (!data.settings.ocrDisponivel) {
          showMessage('settingsMessage', 'Ative o OCR nas configurações antes de processar certificados.', 'error');
          setActiveSection('configuracoes');
          return;
        }

        button.disabled = true;
        button.textContent = 'Processando...';

        try {
          await processAdminCertificateOcr(current, current.sender?.nome || '');

          renderAll(user);
          setActiveSection('certificados');
        } catch (error) {
          showMessage('settingsMessage', `Falha no OCR: ${error.message}`, 'error');
        } finally {
          button.disabled = false;
          button.textContent = 'Processar OCR';
        }
      });
    });

    document.querySelectorAll('.download-cert-btn').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';

      button.addEventListener('click', async () => {
        const data = SIGACStore.getAdminDashboardData();
        const certificateId = window.SIGACOCR.getSelectedCertificateId(button);
        const current = data.certificates.find((item) => item.id === certificateId);

        if (!current) return;

        button.disabled = true;

        try {
          await SIGACStore.openAdminCertificateFile(current.id);
        } catch (error) {
          showMessage('settingsMessage', error.message, 'error');
        } finally {
          button.disabled = false;
        }
      });
    });

    document.querySelectorAll('.remove-rejected-approve-rest-btn').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';

      button.addEventListener('click', async () => {
        if (button.disabled) return;
        const data = SIGACStore.getAdminDashboardData();
        const rejectedIds = String(button.dataset.rejectedIds || '').split(',').filter(Boolean);
        const approveIds = String(button.dataset.approveIds || '').split(',').filter(Boolean);
        if (!approveIds.length) return;

        const confirmed = window.confirm(rejectedIds.length
          ? `Retirar ${rejectedIds.length} certificado(s) rejeitado(s) e aprovar ${approveIds.length} aprovado(s) pelo OCR?`
          : `Aprovar ${approveIds.length} certificado(s) aprovado(s) pelo OCR?`);
        if (!confirmed) return;

        button.disabled = true;
        const originalLabel = button.textContent;
        button.textContent = 'Aplicando...';

        try {
          for (const certificateId of rejectedIds) {
            await SIGACStore.deleteAdminCertificate(certificateId);
          }
          for (const certificateId of approveIds) {
            const certificate = data.certificates.find((item) => item.id === certificateId);
            if (!certificate) continue;
            await SIGACStore.reviewCertificate(user.id, certificateId, 'aprovado', getDefaultAdminFeedback(certificate, 'aprovado'));
          }
          showMessage('settingsMessage', 'Rejeitados retirados e certificados restantes aprovados.', 'success');
          renderAll(user);
          setActiveSection('certificados');
        } catch (error) {
          showMessage('settingsMessage', error.message, 'error');
          button.disabled = false;
          button.textContent = originalLabel;
        }
      });
    });

    document.querySelectorAll('.remove-rejected-cert-btn').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';

      button.addEventListener('click', async () => {
        if (button.disabled) return;
        const card = button.closest('[data-certificate-id]');
        const data = SIGACStore.getAdminDashboardData();
        const current = data.certificates.find((item) => item.id === card?.dataset.certificateId);
        if (!current) return;
        const confirmed = window.confirm(`Retirar "${current.fileName}" da contagem do lote?`);
        if (!confirmed) return;
        button.disabled = true;
        try {
          await SIGACStore.deleteAdminCertificate(current.id);
          showMessage('settingsMessage', 'Certificado retirado da contagem.', 'success');
          renderAll(user);
          setActiveSection('certificados');
        } catch (error) {
          showMessage('settingsMessage', error.message, 'error');
          button.disabled = false;
        }
      });
    });

    document.querySelectorAll('.approve-cert-btn').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';

      button.addEventListener('click', async () => {
        if (button.disabled) return;

        const card = button.closest('.sigac-ocr-batch-card') || button.closest('[data-certificate-id]');
        const data = SIGACStore.getAdminDashboardData();
        const certificateId = window.SIGACOCR.getSelectedCertificateId(button);
        const current = data.certificates.find((item) => item.id === certificateId);
        const textarea = card.querySelector('.certificate-feedback');

        if (!current) return;
        if (['removido', 'removido_da_contagem'].includes(String(current.adminStatus || '').toLowerCase())) {
          showMessage('settingsMessage', 'Este certificado foi removido da contagem e não pode ser aprovado.', 'error');
          return;
        }
        if (current.ocrStatus !== 'aprovado_automatico' && current.adminStatus !== 'aprovado') {
          const confirmed = window.confirm('Este certificado não está verde/aprovado pelo OCR. Deseja aprovar manualmente mesmo assim?');
          if (!confirmed) return;
        }

        button.disabled = true;

        try {
          const feedback = textarea.value.trim() || getDefaultAdminFeedback(current, 'aprovado');

          await SIGACStore.reviewCertificate(user.id, certificateId, 'aprovado', feedback);

          card.classList.add('admin-certificate-card-hiding');

          setTimeout(() => {
            renderAll(user);
            setActiveSection('certificados');
          }, 220);
        } catch (error) {
          showMessage('settingsMessage', error.message, 'error');
          button.disabled = false;
        }
      });
    });

    document.querySelectorAll('.reject-cert-btn').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';

      button.addEventListener('click', async () => {
        if (button.disabled) return;

        const card = button.closest('.sigac-ocr-batch-card') || button.closest('[data-certificate-id]');
        const data = SIGACStore.getAdminDashboardData();
        const certificateId = window.SIGACOCR.getSelectedCertificateId(button);
        const current = data.certificates.find((item) => item.id === certificateId);
        const textarea = card.querySelector('.certificate-feedback');

        if (!current) return;

        button.disabled = true;

        try {
          const feedback = textarea.value.trim() || getDefaultAdminFeedback(current, 'rejeitado');

          await SIGACStore.reviewCertificate(user.id, certificateId, 'rejeitado', feedback);

          card.classList.add('admin-certificate-card-hiding');

          setTimeout(() => {
            renderAll(user);
            setActiveSection('certificados');
          }, 220);
        } catch (error) {
          showMessage('settingsMessage', error.message, 'error');
          button.disabled = false;
        }
      });
    });

  }

  function renderAll(user) {
    populateSharedSelects();
    renderDashboard();
    renderUsers();
    renderCourses();
    renderLinks();
    renderRules();
    renderOpportunities();
    renderSubmissions();
    renderCertificates();
    renderReports();
    renderNotifications();
    renderLogs();
    renderSettings();
    bindDynamicActions(user);
    repairVisibleText();
  }

  function setupForms(user) {
    ensureNotificationsLayout();
    setupNotificationComposerBindings();
    ensureLogsLayout();
    setupLogsFilters();
    ensureSettingsLayout();
    setupSettingsEnhancements();
    ['usersProfileFilter', 'usersCourseFilter', 'usersStatusFilter'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', renderUsers);
    });
    document.getElementById('usersSearchInput')?.addEventListener('input', renderUsers);
    document.getElementById('courseSearchInput')?.addEventListener('input', renderCourses);
    document.getElementById('studentLinkSearch')?.addEventListener('input', refreshLinkPersonSelects);
    document.getElementById('coordinatorLinkSearch')?.addEventListener('input', refreshLinkPersonSelects);
    ['rulesCourseFilter', 'rulesCategoryFilter'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', renderRules);
    });
    ['opportunitySearchInput', 'opportunityStatusFilter', 'opportunityCategoryFilter'].forEach((id) => {
      const eventName = id === 'opportunitySearchInput' ? 'input' : 'change';
      document.getElementById(id)?.addEventListener(eventName, renderOpportunities);
    });
    ['submissionStatusFilter', 'submissionCourseFilter', 'submissionStudentFilter', 'submissionTypeFilter'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', renderSubmissions);
    });
    ['certificateAdminStatusFilter', 'certificateOcrStatusFilter'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', renderCertificates);
    });

    document.getElementById('userForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const type = document.getElementById('userTypeInput').value;
        const selectedCourses = [...document.getElementById('userCoursesInput').selectedOptions].map((option) => option.value);
        const courseId = selectedCourses[0] || '';
        if (!selectedCourses.length) {
          showMessage('userFormMessage', 'Selecione ao menos um curso.', 'error');
          return;
        }
        if (type === 'aluno' && (!selectedCourses.length || selectedCourses.length > 2)) {
          showMessage('userFormMessage', 'Selecione de 1 a 2 cursos para o aluno.', 'error');
          return;
        }
        if (type === 'coordenador' && (!selectedCourses.length || selectedCourses.length > 10)) {
          showMessage('userFormMessage', 'Selecione de 1 a 10 cursos para o coordenador.', 'error');
          return;
        }
        const response = await SIGACStore.createUser({
          nome: document.getElementById('userNameInput').value,
          email: document.getElementById('userEmailInput').value,
          senha: document.getElementById('userPasswordInput').value,
          tipo: type,
          ativo: document.getElementById('userStatusInput').value === '1',
          courseId,
          courseIds: selectedCourses,
          cpf: document.getElementById('userCpfInput')?.value || '',
          telefone: document.getElementById('userPhoneInput')?.value || '',
          endereco: document.getElementById('userAddressInput')?.value || '',
          dataNascimento: document.getElementById('userBirthInput')?.value || '',
          cursoInteresse: document.getElementById('userDesiredCourseInput')?.value || ''
        });
        document.getElementById('userForm').reset();
        populateSharedSelects();
        const temp = response.temporaryPassword ? ` Matrícula: ${response.matricula}. Senha temporária: ${response.temporaryPassword}.` : '';
        showMessage('userFormMessage', `Usuário cadastrado com sucesso.${temp} O primeiro login exigirá troca de senha.`, 'success');
        renderAll(user);
      } catch (error) {
        showMessage('userFormMessage', error.message, 'error');
      }
    });

    document.getElementById('courseForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await SIGACStore.createCourse({
          sigla: document.getElementById('sigla').value,
          nome: document.getElementById('nomeCurso').value,
          area: document.getElementById('areaCurso').value,
          tipo: document.getElementById('tipoCurso').value,
          turno: document.getElementById('turnoCurso').value,
          cargaHorariaTotal: document.getElementById('cargaHorariaTotalCurso').value,
          horasMeta: document.getElementById('horasMetaCurso').value
        });
        document.getElementById('courseForm').reset();
        showMessage('courseFormMessage', 'Curso cadastrado com sucesso.', 'success');
        renderAll(user);
      } catch (error) {
        showMessage('courseFormMessage', error.message, 'error');
      }
    });

    document.getElementById('ruleForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await SIGACStore.createActivityRule({
          courseId: document.getElementById('ruleCourseSelect').value,
          categoria: document.getElementById('ruleCategoryInput').value,
          limiteMaximo: document.getElementById('ruleLimitInput').value,
          cargaMinima: document.getElementById('ruleMinInput').value,
          exigeCertificado: document.getElementById('ruleCertificateInput').checked,
          exigeAprovacao: document.getElementById('ruleApprovalInput').checked
        });
        document.getElementById('ruleForm').reset();
        showMessage('ruleFormMessage', 'Regra cadastrada com sucesso.', 'success');
        renderAll(user);
      } catch (error) {
        showMessage('ruleFormMessage', error.message, 'error');
      }
    });

    document.getElementById('studentLinkForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const selected = [...document.getElementById('studentCourseSelect').selectedOptions].map((option) => option.value);
        if (!selected.length || selected.length > 2) throw new Error('Selecione de 1 a 2 cursos para o aluno.');
        await SIGACStore.assignStudentToCourse(document.getElementById('studentSelect').value, selected);
        showMessage('studentLinkMessage', 'Vínculos do aluno salvos com sucesso.', 'success');
        renderAll(user);
      } catch (error) {
        showMessage('studentLinkMessage', error.message, 'error');
      }
    });

    document.getElementById('coordinatorLinkForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const selected = [...document.getElementById('coordinatorCoursesSelect').selectedOptions].map((option) => option.value);
        if (selected.length > 10) throw new Error('Selecione no máximo 10 cursos para o coordenador.');
        await SIGACStore.assignCoordinatorCourses(document.getElementById('coordinatorSelect').value, selected);
        showMessage('coordinatorLinkMessage', 'Vínculos do coordenador atualizados.', 'success');
        renderAll(user);
      } catch (error) {
        showMessage('coordinatorLinkMessage', error.message, 'error');
      }
    });

    document.getElementById('opportunityForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await SIGACStore.createOpportunity(user.id, {
          titulo: document.getElementById('oppTitle').value,
          descricao: document.getElementById('oppDesc').value,
          courseId: document.getElementById('oppCourseSelect').value,
          horas: document.getElementById('oppHours').value,
          categoria: document.getElementById('oppCategory')?.value || 'Curso livre',
          status: document.getElementById('oppStatus')?.value || 'Aberta'
        });
        document.getElementById('opportunityForm').reset();
        showMessage('opportunityFormMessage', 'Oportunidade lançada com sucesso.', 'success');
        renderAll(user);
      } catch (error) {
        showMessage('opportunityFormMessage', error.message, 'error');
      }
    });

    document.getElementById('settingsForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await SIGACStore.updateSettings({
          horasMetaPadrao: document.getElementById('horasMeta').value,
          emailNotificationsEnabled: document.getElementById('emailToggle').checked,
          ocrDisponivel: document.getElementById('ocrToggle').checked
        });
        showMessage('settingsMessage', 'Configurações salvas com sucesso.', 'success');
        renderAll(user);
      } catch (error) {
        showMessage('settingsMessage', error.message, 'error');
      }
    });

    document.getElementById('downloadEmailLog').addEventListener('click', async () => {
      try {
        await SIGACStore.exportEmailLog();
      } catch (error) {
        showMessage('settingsMessage', error.message, 'error');
      }
    });

    document.getElementById('resetDemoBtn').addEventListener('click', async () => {
      if (!document.getElementById('resetDemoConfirm')?.checked) {
        showMessage('settingsMessage', 'Confirme a ação de manutenção antes de resetar os dados de demonstração.', 'error');
        return;
      }
      if (!confirm('Deseja resetar os dados de demonstração?')) return;
      try {
        await SIGACStore.resetDemo();
        const resetConfirm = document.getElementById('resetDemoConfirm');
        if (resetConfirm) resetConfirm.checked = false;
        const freshUser = SIGACStore.getCurrentUser();
        renderAll(freshUser);
        showMessage('settingsMessage', 'Base de demonstração restaurada.', 'success');
      } catch (error) {
        showMessage('settingsMessage', error.message, 'error');
      }
    });
  }

  function setupGlobalSearch() {
    const input = document.getElementById('globalSearchInput');
    if (!input || input.dataset.bound === 'true') return;
    input.dataset.bound = 'true';

    input.addEventListener('input', async () => {
      globalSearchTerm = normalize(input.value.trim());
      const activeSection = getActiveSectionId();
      const target = activeSection === 'dashboard'
        ? searchTargetFor(globalSearchTerm)
        : searchTargetFor(globalSearchTerm, activeSection);
      if (target && target !== activeSection) {
        await openSection(target);
        return;
      }
      renderFilteredLists();
    });

    input.addEventListener('search', async () => {
      globalSearchTerm = normalize(input.value.trim());
      if (!globalSearchTerm) {
        renderFilteredLists();
      }
    });
  }


  // ===== INÍCIO ALTERAÇÃO ML SIGAC: integração do dashboard Admin com as rotas /api/ml =====
  // ML - Configura o card do dashboard administrativo para executar e consultar o Machine Learning.
  async function adminMlApiJson(url, options = {}) {
    const token = sessionStorage.getItem('sigac_auth_token');
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.details || 'Erro ao consultar API de ML.');
    return data;
  }

  function mlRiskClass(value) {
    const risco = String(value || 'medio').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return ['baixo', 'medio', 'alto'].includes(risco) ? risco : 'medio';
  }

  function isTechnicalStudentLabel(value) {
    const text = String(value || '').trim();
    const plain = normalize(text);
    return !text
      || /^\d+$/.test(text)
      || /^user[_-]/i.test(text)
      || /^user[a-z0-9_-]{6,}$/i.test(text)
      || /^aluno\s+\d+$/i.test(plain);
  }

  function mlStudentName(item) {
    return [item.aluno_nome, item.nome_aluno, item.nome, item.aluno]
      .map((value) => String(value || '').trim())
      .find((value) => value && !isTechnicalStudentLabel(value)) || 'Aluno não identificado';
  }

  function renderMlDashboard(payload = {}) {
    const execucao = payload.execucao || payload.resumo || {};
    const riscos = payload.riscos || [];

    const ultimaExecucao = document.getElementById('mlUltimaExecucao');
    const totalRegistros = document.getElementById('mlTotalRegistros');
    const totalAprovados = document.getElementById('mlTotalAprovados');
    const totalRejeitados = document.getElementById('mlTotalRejeitados');
    const totalAnalise = document.getElementById('mlTotalAnalise');
    const tbody = document.getElementById('mlRiskTableBody');

    if (ultimaExecucao) ultimaExecucao.textContent = execucao.finished_at || execucao.started_at || 'Sem execução registrada';
    if (totalRegistros) totalRegistros.textContent = riscos.length;
    if (totalAprovados) totalAprovados.textContent = riscos.reduce((sum, item) => sum + Number(item.qtd_aprovadas || 0), 0);
    if (totalRejeitados) totalRejeitados.textContent = riscos.reduce((sum, item) => sum + Number(item.qtd_rejeitadas || 0), 0);
    if (totalAnalise) totalAnalise.textContent = riscos.reduce((sum, item) => sum + Number(item.qtd_pendentes || 0), 0);

    if (!tbody) return;
    tbody.innerHTML = riscos.length ? riscos.map((item) => {
      const progressPercent = percent(Number(item.meta_horas || 0) ? (Number(item.horas_aprovadas || 0) / Number(item.meta_horas || 0)) * 100 : Number(item.percentual_concluido || item.percentual_conclusao || 0));
      const risco = progressPercent >= 100 ? 'baixo' : mlRiskClass(item.classificacao_risco || item.risco);
      return `
        <tr>
          <td>${escapeHtml(mlStudentName(item))}</td>
          <td>${escapeHtml(item.curso || item.curso_id || '-')}</td>
          <td>${formatHours(item.horas_aprovadas || 0)}</td>
          <td>${formatHours(item.meta_horas || 0)}</td>
          <td>${formatPercent(progressPercent)}</td>
          <td>${Number(item.qtd_rejeitadas || item.submissoes_rejeitadas || 0)}</td>
          <td>${Number(item.qtd_pendentes || item.submissoes_pendentes || 0)}</td>
          <td><span class="badge ${risco}">${escapeHtml(risco)}</span></td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="8">Nenhum resultado de ML encontrado.</td></tr>';
  }

  async function carregarMlDashboard() {
    const statusBox = document.getElementById('mlStatusBox');
    try {
      if (statusBox) statusBox.innerHTML = '<strong>Status:</strong> consultando última análise de ML...';
      const data = await adminMlApiJson('/api/ml/risco-alunos');
      lastMlData = data;
      renderMlDashboard(data);
      // atualiza dashboards/relatórios após carregar dados do ML
      try { renderDashboard(); } catch (e) { /* silencioso */ }
      if (statusBox) {
        statusBox.innerHTML = data.execucao
          ? `<strong>Última execução:</strong> ${escapeHtml(data.execucao.finished_at || data.execucao.started_at || 'sem data')}`
          : '<strong>Última execução:</strong> nenhuma execução concluída.';
      }
    } catch (error) {
      if (statusBox) statusBox.innerHTML = `<strong>Erro:</strong> ${escapeHtml(error.message)}`;
      renderMlDashboard({ riscos: [] });
    }
  }

  async function executarMlDashboard() {
    const button = document.getElementById('btnAtualizarML');
    const statusBox = document.getElementById('mlStatusBox');
    try {
      if (button) {
        button.disabled = true;
        button.textContent = 'Executando ML...';
      }
      if (statusBox) statusBox.innerHTML = '<strong>Status:</strong> executando scripts Python e salvando resultado no banco...';
      const data = await adminMlApiJson('/api/ml/executar', { method: 'POST', body: '{}' });
      lastMlData = data;
      renderMlDashboard(data);
      if (statusBox) statusBox.innerHTML = '<strong>ML atualizado:</strong> resultado salvo no banco.';
      try { renderDashboard(); } catch (e) { /* silencioso */ }
      await carregarMlDashboard();
    } catch (error) {
      if (statusBox) statusBox.innerHTML = `<strong>Erro ao executar ML:</strong> ${escapeHtml(error.message)}`;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Atualizar análise ML';
      }
    }
  }

  function setupMlDashboard() {
    const button = document.getElementById('btnAtualizarML');
    if (!button || button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';
    button.addEventListener('click', executarMlDashboard);
    carregarMlDashboard();
  }

  // ===== FIM ALTERAÇÃO ML SIGAC: integração do dashboard Admin com Machine Learning =====

  async function init() {
    try {
      console.log('[SIGAC Admin] Admin bootstrap iniciado');
      repairVisibleText();
      const user = await SIGACStore.bootstrap('superadmin');
      setUserIdentity(user, 'Administração Global');
      document.querySelectorAll('[data-section]').forEach((button) => {
        button.addEventListener('click', async () => {
          await openSection(button.dataset.section);
        });
      });
      document.getElementById('logoutBtn').addEventListener('click', () => {
        SIGACStore.logout();
        window.location.replace('loginsigac.html');
      });
      setupForms(user);
      setupGlobalSearch();
      // ===== INÍCIO CHAMADA ML SIGAC: ativa botão e carregamento do card ML do Admin =====
      setupMlDashboard();
      // ===== FIM CHAMADA ML SIGAC: ativa botão e carregamento do card ML do Admin =====
      updateSectionHeader(getActiveSectionId());
      renderSection('dashboard', user);
      repairVisibleText();
      window.addEventListener('sigac:themechange', () => {
        window.SIGACCharts?.ensureDefaults?.();
        renderDashboard();
        repairVisibleText();
      });
      bindDynamicActions(user);
    } catch (error) {
      console.error('[SIGAC Admin] Erro recebido', error);
      if (isAuthError(error)) {
        console.warn('[SIGAC Admin] Motivo do redirecionamento para login', error.message || `HTTP ${error.status}`);
        SIGACStore.logout();
        window.location.replace('loginsigac.html');
        return;
      }
      renderBootstrapError(error.message || 'Não foi possível carregar o painel administrativo no momento.');
    }
  }

  // INICIALIZAÇÃO - Registra eventos quando a página termina de carregar.
document.addEventListener('DOMContentLoaded', init);
})();
