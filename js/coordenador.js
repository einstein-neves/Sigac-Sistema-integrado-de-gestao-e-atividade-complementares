// =========================================================
// SIGAC - JS comentado: coordenador.js
// Objetivo: orientar a equipe sobre a função deste arquivo.
// Comentários não aparecem para o usuário final.
// =========================================================

(function () {
  'use strict';

  let chartStatus = null;
  let chartEngajamento = null;
  let coordinatorStudentSearchTerm = '';
  let coordinatorStudentCourseFilter = 'todos';
  let submissionStudentSearchTerm = '';
  let submissionCourseFilter = 'todos';
  let submissionActivityFilter = 'todos';
  let submissionStatusFilter = 'todos';
  let coordinatorActivitySearchTerm = '';
  let coordinatorActivityCourseFilter = 'todos';
  let coordinatorActivityStatusFilter = 'todos';
  let coordinatorOpportunitySearchTerm = '';
  let coordinatorOpportunityStatusFilter = 'todos';
  let certificateStudentSearchTerm = '';
  let certificateStatusFilter = 'pendente';
  let certificateCourseFilter = 'todos';
  let lastCoordinatorMlData = null;
  const PERF_LOGS_ENABLED = true;
  const coordinatorSectionTitles = {
    dashboard: 'Dashboard',
    alunos: 'Alunos',
    atividades: 'Atividades',
    regras: 'Regras',
    envios: 'Avaliar envios',
    certificados: 'Certificados',
    oportunidades: 'Oportunidades'
  };

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const formatDate = (value) => value ? new Date(value).toLocaleString('pt-BR') : 'Sem data';
  const percent = (value, options) => window.SIGACFormat?.percentValue(value, options) ?? Math.max(0, Math.min(100, Math.round(Number(value || 0))));
  const formatPercent = (value, options) => window.SIGACFormat?.formatPercent(value, options) ?? `${percent(value, options)}%`;
  const formatHours = (value) => window.SIGACFormat?.formatHours(value) ?? `${Number(value || 0).toLocaleString('pt-BR')} h`;

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.data)) return value.data;
    return [];
  }

  function logPerf(label, startedAt) {
    if (!PERF_LOGS_ENABLED) return;
    const duration = Math.round(performance.now() - startedAt);
    console.log(`[SIGAC PERF] ${label}: ${duration}ms`);
  }

  function setUserIdentity(user, roleLabel) {
    document.getElementById('userName').textContent = user.nome;
    document.getElementById('userRole').textContent = roleLabel;
    const initial = document.getElementById('userInitial');
    if (initial) {
      const firstLetter = String(user.nome || '?').trim().charAt(0).toUpperCase() || '?';
      initial.textContent = firstLetter;
    }
  }

  // FUNÇÕES ASSÍNCRONAS - Chamadas de API e carregamento dinâmico de dados.
async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function showMessage(id, text, type) {
    const box = document.getElementById(id);
    box.textContent = text;
    box.className = `message ${type}`;
    box.classList.remove('hidden');
  }

  function renderChartUnavailable(message = 'Grafico indisponivel no momento.') {
    document.querySelectorAll('.chart-box').forEach((box) => {
      box.innerHTML = `<div class="chart-fallback">${escapeHtml(message)}</div>`;
    });
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
        <p class="small">Verifique se a API está em execução e recarregue a página.</p>
      </div>
    `;
  }

  function badgeClass(status) {
    return {
      aprovado: 'aprovado',
      rejeitado: 'rejeitado',
      pendente: 'em_analise',
      em_analise: 'em_analise',
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

  function applyAccentClass(element, tone = 'orange') {
    if (!element) return;
    element.classList.add('accent-card');
    ['accent-card--orange', 'accent-card--green', 'accent-card--warning', 'accent-card--danger', 'accent-card--info']
      .forEach((className) => element.classList.remove(className));
    const toneClass = {
      orange: 'accent-card--orange',
      green: 'accent-card--green',
      warning: 'accent-card--warning',
      danger: 'accent-card--danger',
      info: 'accent-card--info'
    }[tone] || 'accent-card--orange';
    element.classList.add(toneClass);
  }

  function decorateCoordinatorAccents() {
    document.querySelectorAll('.coordinator-activity-form-card, #regras .dual-grid > .card:first-child, #oportunidades > .card').forEach((element) => applyAccentClass(element, 'orange'));
    document.querySelectorAll('.coordinator-flow-card, .coordinator-activity-list-card, #alunos .coordinator-students-shell > .card, #regras .dual-grid > .card:last-child').forEach((element) => applyAccentClass(element, 'info'));
    document.querySelectorAll('#envios > .card, #certificados > .card').forEach((element) => applyAccentClass(element, 'warning'));
    document.querySelectorAll('#metricsGrid .metric-card').forEach((element, index) => {
      const tones = ['warning', 'info', 'orange', 'green', 'info', 'warning'];
      applyAccentClass(element, tones[index] || 'orange');
    });
    document.querySelectorAll('#coordinatorCertificateStats .card').forEach((element, index) => {
      const tones = ['warning', 'info', 'green', 'danger'];
      applyAccentClass(element, tones[index] || 'orange');
    });
  }

  function buildCertificateSummary(certificate) {
    if (certificate.humanSummary) return certificate.humanSummary;
    const missingFields = formatOcrFieldList(certificate.missingFields);
    if (missingFields.length) return `Campos n\u00e3o identificados: ${missingFields.join(', ')}.`;
    return certificate.ocrReason || 'Aguardando pr\u00e9-an\u00e1lise do OCR.';
  }

  function getDefaultCoordinatorFeedback(certificate, decision) {
    if (decision === 'aprovado') {
      return 'Certificado aprovado pela coordena\u00e7\u00e3o. Os dados principais foram conferidos e a carga hor\u00e1ria foi considerada v\u00e1lida.';
    }
    return `Certificado retirado/rejeitado pela coordena\u00e7\u00e3o. ${buildCertificateSummary(certificate)} Envie um novo comprovante leg\u00edvel contendo nome, atividade, carga hor\u00e1ria, data e institui\u00e7\u00e3o.`;
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

  function getActivityLifecycleStatus(activity) {
    if (!activity?.prazo) return 'aberta';
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const deadline = new Date(activity.prazo);
    deadline.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / 86400000);
    if (diffDays < 0) return 'encerrada';
    if (diffDays <= 7) return 'vence_em_breve';
    return 'aberta';
  }

  function getActivityLifecycleLabel(status) {
    return {
      aberta: 'Aberta',
      vence_em_breve: 'Vence em breve',
      encerrada: 'Encerrada'
    }[status] || 'Aberta';
  }

  function getCourseLabel(courseId) {
    const course = SIGACStore.getCourseById(courseId);
    if (!course) return 'Curso não identificado';
    return `${course.sigla} - ${course.nome}`;
  }

  function compareCertificatesByPriority(left, right) {
    const leftPending = left.adminStatus === 'pendente' ? 0 : 1;
    const rightPending = right.adminStatus === 'pendente' ? 0 : 1;
    if (leftPending !== rightPending) return leftPending - rightPending;

    const leftOcrAttention = ['analise_manual', 'rejeitado_automatico', 'nao_processado'].includes(left.ocrStatus) ? 0 : 1;
    const rightOcrAttention = ['analise_manual', 'rejeitado_automatico', 'nao_processado'].includes(right.ocrStatus) ? 0 : 1;
    if (leftOcrAttention !== rightOcrAttention) return leftOcrAttention - rightOcrAttention;

    return new Date(left.createdAt || 0) - new Date(right.createdAt || 0);
  }

  function setActiveSection(sectionId) {
    document.querySelectorAll('.panel-section').forEach((section) => section.classList.add('hidden'));
    document.querySelectorAll('[data-section]').forEach((button) => button.classList.remove('active'));
    document.getElementById(sectionId).classList.remove('hidden');
    document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');
    const title = document.getElementById('coordinatorPageTitle');
    if (title) title.textContent = coordinatorSectionTitles[sectionId] || 'Dashboard';
  }

  function getSectionHeaderText(sectionId) {
    return {
      dashboard: 'Painel do Coordenador',
      alunos: 'Alunos',
      atividades: 'Atividades',
      regras: 'Regras de atividade',
      envios: 'Envios de atividades',
      certificados: 'Certificados',
      oportunidades: 'Oportunidades'
    }[sectionId] || 'Painel do Coordenador';
  }

  function getSectionHeaderSubtitle(sectionId) {
    return {
      dashboard: 'Gerencie atividades, alunos e avaliações do seu curso.',
      alunos: 'Acompanhe o quadro de estudantes e progresso.',
      atividades: 'Visualize e gerencie atividades complementares.',
      regras: 'Defina limites e requisitos por categoria.',
      envios: 'Avalie solicitações pendentes e retornos.',
      certificados: 'Confira o status de OCR e aprovação.',
      oportunidades: 'Publique e acompanhe oportunidades de horas complementares.'
    }[sectionId] || 'Gerencie atividades, alunos e avaliações do seu curso.';
  }

  function updateSectionHeader(sectionId) {
    const title = getSectionHeaderText(sectionId);
    const subtitle = getSectionHeaderSubtitle(sectionId);
    const topbarTitle = document.querySelector('.topbar h1');
    const topbarSubtitle = document.querySelector('.topbar p');
    if (topbarTitle) topbarTitle.textContent = title;
    if (topbarSubtitle) topbarSubtitle.textContent = subtitle;
  }

  function getCurrentSectionId() {
    return document.querySelector('[data-section].active')?.dataset.section || 'dashboard';
  }

  function getSectionLoadingTarget(sectionId) {
    return {
      dashboard: 'studentsByCourse',
      alunos: 'coordinatorStudentsList',
      atividades: 'activitiesList',
      regras: 'rulesList',
      envios: 'pendingSubmissionsList',
      certificados: 'studentCertificatesList',
      oportunidades: 'opportunitiesList'
    }[sectionId] || '';
  }

  function showSectionLoading(sectionId, text = 'Carregando...') {
    const targetId = getSectionLoadingTarget(sectionId);
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return;
    target.innerHTML = `<div class="item small">${escapeHtml(text)}</div>`;
  }

  async function ensureSectionData(sectionId, options = {}) {
    if (sectionId === 'alunos') return SIGACStore.ensureCoordinatorTabData('students', options);
    if (sectionId === 'atividades') return SIGACStore.ensureCoordinatorTabData('activities', options);
    if (sectionId === 'regras') return SIGACStore.ensureCoordinatorTabData('rules', options);
    if (sectionId === 'envios') return SIGACStore.ensureCoordinatorTabData('submissions', options);
    if (sectionId === 'certificados') return SIGACStore.ensureCoordinatorTabData('certificates', options);
    if (sectionId === 'oportunidades') return SIGACStore.ensureCoordinatorTabData('opportunities', options);
    return null;
  }

  async function openSection(sectionId, options = {}) {
    const force = !!options.force;
    setActiveSection(sectionId);
    updateSectionHeader(sectionId);
    if (sectionId !== 'dashboard') showSectionLoading(sectionId, 'Carregando dados da aba...');
    await ensureSectionData(sectionId, { force });
    renderCoordinatorSummary(SIGACStore.getCurrentUser());
    renderCoordinatorSection(sectionId, SIGACStore.getCurrentUser());
    decorateCoordinatorAccents();
  }

  function renderCharts(data) {
    if (!window.Chart) {
      renderChartUnavailable('Nao foi possivel carregar a biblioteca de graficos. Recarregue a pagina ou verifique os arquivos do pacote.');
      return;
    }
    window.SIGACCharts?.ensureDefaults();
    const statusCtx = document.getElementById('chartStatus').getContext('2d');
    const engagementCtx = document.getElementById('chartEngajamento').getContext('2d');
    const charts = window.SIGACCharts;
    const chartTheme = charts?.getTheme?.() || { text: '#111827', muted: '#374151', grid: '#e5e7eb', surface: '#ffffff' };

    if (chartStatus) chartStatus.destroy();
    if (chartEngajamento) chartEngajamento.destroy();

    const statusData = [data.aprovados, data.rejeitados, data.pendentes];

    chartStatus = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['Aprovados', 'Rejeitados', 'Em análise'],
        datasets: [{
          data: statusData,
          backgroundColor: ['#2dd4a2', '#ff6f86', '#f4bf52'],
          borderColor: chartTheme.surface,
          borderWidth: 4,
          spacing: 3,
          borderRadius: 10,
          hoverOffset: 2
        }]
      },
      options: charts.createOptions({
        cutout: '72%',
        layout: { padding: { top: 8, right: 8, bottom: 8, left: 8 } },
        plugins: {
          legend: charts.createLegend(),
          tooltip: charts.createTooltip({
            borderColor: 'rgba(255, 138, 31, 0.24)'
          })
        }
      })
    });

    const engData = [data.alunosComEnvio, data.alunosSemEnvio];

    chartEngajamento = new Chart(engagementCtx, {
      type: 'bar',
      data: {
        labels: ['Alunos com envio', 'Alunos sem envio'],
        datasets: [{
          label: 'Quantidade',
          data: engData,
          backgroundColor: ['#68b8ff', '#ff9b54'],
          borderColor: ['#9dd2ff', '#ffc38f'],
          borderWidth: 1,
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 56,
          barPercentage: 0.74,
          categoryPercentage: 0.7
        }]
      },
      options: charts.createOptions({
        layout: { padding: { top: 8, right: 8, bottom: 0, left: 0 } },
        scales: {
          y: charts.createScale({
            beginAtZero: true,
            grid: {
              color: chartTheme.grid,
              drawTicks: false
            },
            ticks: {
              precision: 0,
              stepSize: 1,
              color: chartTheme.muted
            }
          }),
          x: charts.createScale({
            grid: { display: false },
            ticks: {
              color: chartTheme.text,
              font: { size: 12, weight: '600' }
            }
          })
        },
        plugins: {
          legend: { display: false },
          tooltip: charts.createTooltip({
            displayColors: false,
            borderColor: 'rgba(255, 138, 31, 0.24)'
          })
        }
      })
    });
  }

  function renderDashboard(user) {
    const startedAt = performance.now();
    const data = SIGACStore.getCoordinatorDashboardData(user.id);
    setUserIdentity(user, 'Coordenador');
    document.getElementById('coordinatorCoursesInfo').textContent = `Cursos vinculados: ${user.courseIds.map((id) => SIGACStore.getCourseById(id)?.sigla || id).join(', ') || 'Nenhum curso'}.`;
    const pendentes = data.pendentes;
    const aprovados = data.aprovados;
    const taxaAprovacao = percent(data.taxaAprovacao || 0);

    document.getElementById('metricsGrid').innerHTML = `
      <div class="card metric-card"><h3>Pendentes</h3><div class="metric-value">${pendentes}</div><p class="small">Envios aguardando decisão</p></div>
      <div class="card metric-card"><h3>Total de alunos</h3><div class="metric-value">${data.totalAlunos}</div><p class="small">Sob sua coordenação</p></div>
      <div class="card metric-card"><h3>Atividades lançadas</h3><div class="metric-value">${data.totalAtividades}</div><p class="small">Disponíveis nos cursos vinculados</p></div>
      <div class="card metric-card"><h3>Aprovados</h3><div class="metric-value">${aprovados}</div><p class="small">Envios já validados</p></div>
      <div class="card metric-card"><h3>Taxa de aprovação</h3><div class="metric-value">${formatPercent(taxaAprovacao)}</div><p class="small">Sobre envios avaliados</p></div>
      <div class="card metric-card"><h3>Certificados</h3><div class="metric-value">${data.certificadosPendentes || 0}</div><p class="small">Aguardando revisão</p></div>
    `;

    renderCharts(data);
    document.getElementById('studentsByCourse').innerHTML = data.students.length
      ? `<div class="table-wrap sigac-table-wrap sigac-scroll-table">
          <table class="data-table sigac-data-table sigac-compact-table coordinator-course-students-table">
            <thead><tr><th>Aluno</th><th>Curso</th><th>Horas concluídas</th><th>Meta do semestre</th><th>Progresso</th></tr></thead>
            <tbody>${data.students.map((student) => `
              <tr>
                <td><strong>${escapeHtml(student.nome)}</strong><span class="table-subtext">${escapeHtml(student.email || '')}</span></td>
                <td>${escapeHtml(student.course?.sigla || '-')}</td>
                <td>${Number(student.progress?.total || 0)} h</td>
                <td>${Number(student.progress?.target || 0)} h</td>
                <td><strong>${formatPercent(student.progress?.percent)}</strong><div class="mini-progress"><span style="width:${percent(student.progress?.percent)}%"></span></div></td>
              </tr>
            `).join('')}</tbody>
          </table>
        </div>`
      : '<div class="item">Nenhum aluno vinculado aos seus cursos.</div>';
    renderCoordinatorMlDashboard(lastCoordinatorMlData || buildCoordinatorMlFallbackPayload(user));
    logPerf('renderDashboard', startedAt);
  }

  function renderActivities(user) {
    const activities = SIGACStore.listActivitiesForCoordinator(user.id);
    const submissions = ensureArray(SIGACStore.getCoordinatorDashboardData(user.id).submissions);
    const courseFilter = document.getElementById('coordinatorActivityCourseFilter');
    const statusFilter = document.getElementById('coordinatorActivityStatusFilter');
    const courses = Array.from(new Map(activities
      .map((activity) => [activity.courseId, SIGACStore.getCourseById(activity.courseId)])
      .filter(([, course]) => course?.id)).values());
    const activitiesWithMeta = activities.map((activity) => {
      const course = SIGACStore.getCourseById(activity.courseId);
      const status = getActivityLifecycleStatus(activity);
      const relatedSubmissions = submissions.filter((submission) => submission.activity?.id === activity.id);
      return {
        ...activity,
        course,
        status,
        submissionCount: relatedSubmissions.length
      };
    });

    if (courseFilter) {
      courseFilter.innerHTML = '<option value="todos">Todos os cursos</option>' + courses
        .map((course) => `<option value="${course.id}" ${course.id === coordinatorActivityCourseFilter ? 'selected' : ''}>${escapeHtml(course.sigla)} - ${escapeHtml(course.nome || '')}</option>`).join('');
    }
    if (statusFilter) statusFilter.value = coordinatorActivityStatusFilter;
    if (window.SIGACCustomSelect) window.SIGACCustomSelect.refreshAll();

    const visibleActivities = activitiesWithMeta.filter((activity) => {
      const searchableText = normalize(`${activity.titulo} ${activity.descricao} ${activity.materialNome || ''} ${activity.course?.sigla || ''} ${activity.course?.nome || ''}`);
      const matchesSearch = !coordinatorActivitySearchTerm || searchableText.includes(normalize(coordinatorActivitySearchTerm));
      const matchesCourse = coordinatorActivityCourseFilter === 'todos' || activity.courseId === coordinatorActivityCourseFilter;
      const matchesStatus = coordinatorActivityStatusFilter === 'todos' || activity.status === coordinatorActivityStatusFilter;
      return matchesSearch && matchesCourse && matchesStatus;
    });

    document.getElementById('coordinatorActivitiesHighlights').innerHTML = `
      <span class="summary-chip">Atividades <strong>${activitiesWithMeta.length}</strong></span>
      <span class="summary-chip">Abertas <strong>${activitiesWithMeta.filter((activity) => activity.status === 'aberta').length}</strong></span>
      <span class="summary-chip">Vencem em breve <strong>${activitiesWithMeta.filter((activity) => activity.status === 'vence_em_breve').length}</strong></span>
      <span class="summary-chip">Com envios <strong>${activitiesWithMeta.filter((activity) => activity.submissionCount > 0).length}</strong></span>
    `;
    document.getElementById('coordinatorActivityFilterResult').textContent = `${visibleActivities.length} de ${activitiesWithMeta.length} atividades exibidas`;

    document.getElementById('activitiesList').innerHTML = visibleActivities.length
      ? `
        <div class="table-wrap sigac-table-wrap sigac-scroll-table coordinator-compact-table-wrap coordinator-activities-table-wrap">
          <table class="data-table sigac-data-table sigac-compact-table coordinator-activities-table">
            <thead><tr><th>Titulo</th><th>Curso</th><th>Horas</th><th>Prazo</th><th>Status</th><th>Envios</th><th>Material</th><th>Acao</th></tr></thead>
            <tbody>
              ${visibleActivities.map((activity) => `
                <tr>
                  <td><strong title="${escapeHtml(activity.titulo)}">${escapeHtml(activity.titulo)}</strong><span class="table-subtext is-clamped">${escapeHtml(activity.descricao || '')}</span></td>
                  <td><span class="badge coordinator-activity-course-badge">${escapeHtml(activity.course?.sigla || '-')}</span><span class="table-subtext">${escapeHtml(activity.course?.nome || 'Curso nao identificado')}</span></td>
                  <td>${Number(activity.horas || 0)} h</td>
                  <td>${activity.prazo ? escapeHtml(new Date(activity.prazo).toLocaleDateString('pt-BR')) : 'Sem prazo'}</td>
                  <td><span class="badge ${activity.status === 'encerrada' ? 'rejeitado' : activity.status === 'vence_em_breve' ? 'em_analise' : 'aprovado'}">${escapeHtml(getActivityLifecycleLabel(activity.status))}</span></td>
                  <td>${activity.submissionCount}</td>
                  <td><span class="table-subtext is-clamped" title="${escapeHtml(activity.materialNome || 'Sem material')}">${escapeHtml(activity.materialNome || 'Sem material')}</span></td>
                  <td>${activity.materialNome ? `<button type="button" class="button secondary compact-button activity-material-btn" data-activity-id="${activity.id}">Baixar</button>` : '<span class="activity-material-empty">-</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
      : `
        <div class="activity-empty-state">
          <h3>Nenhuma atividade encontrada</h3>
          <p>Ajuste a busca ou os filtros para localizar outra atividade publicada nos seus cursos.</p>
        </div>
      `;

    document.querySelectorAll('.activity-material-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await SIGACStore.openActivityMaterial(button.dataset.activityId);
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function renderRules(user) {
    const rules = SIGACStore.listCoordinatorRules();
    document.getElementById('rulesList').innerHTML = rules.length
      ? `
        <div class="table-wrap sigac-table-wrap sigac-scroll-table coordinator-compact-table-wrap coordinator-rules-table-wrap">
          <table class="data-table sigac-data-table sigac-compact-table coordinator-rules-table">
            <thead><tr><th>Curso</th><th>Categoria</th><th>Carga minima</th><th>Limite maximo</th><th>Exige certificado</th><th>Aprovacao do coordenador</th><th>Status</th></tr></thead>
            <tbody>
              ${rules.map((rule) => {
                const course = SIGACStore.getCourseById(rule.courseId);
                return `
                  <tr>
                    <td><strong>${escapeHtml(course?.sigla || rule.courseId)}</strong><span class="table-subtext">${escapeHtml(course?.nome || 'Curso nao identificado')}</span></td>
                    <td>${escapeHtml(rule.categoria)}</td>
                    <td>${Number(rule.cargaMinima || 0)} h</td>
                    <td>${Number(rule.limiteMaximo || 0)} h</td>
                    <td><span class="badge ${rule.exigeCertificado ? 'em_analise' : 'aprovado'}">${rule.exigeCertificado ? 'Sim' : 'Nao'}</span></td>
                    <td><span class="badge ${rule.exigeAprovacao ? 'em_analise' : 'aprovado'}">${rule.exigeAprovacao ? 'Manual' : 'Direta'}</span></td>
                    <td><span class="badge aprovado">Ativa</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `
      : `
        <div class="coordinator-rule-empty">
          <h3>Nenhuma regra cadastrada</h3>
          <p>Crie a primeira regra para orientar como as horas e comprovacoes devem ser avaliadas em cada curso.</p>
        </div>
      `;
  }

  function renderStudentsPanel(user) {
    const startedAt = performance.now();
    const data = SIGACStore.getCoordinatorDashboardData(user.id);
    const submissions = ensureArray(data.submissions);
    const students = ensureArray(data.students).map((student) => {
      const studentSubmissions = submissions
        .filter((submission) => submission.student?.id === student.id)
        .sort((a, b) => new Date(b.latest?.enviadaEm || 0) - new Date(a.latest?.enviadaEm || 0));
      const latestSubmission = studentSubmissions[0] || null;
      const pendingCount = studentSubmissions.filter((submission) => ['em_analise', 'rejeitado'].includes(submission.latest?.status)).length;
      return {
        ...student,
        latestSubmission,
        pendingCount,
        totalSubmissions: studentSubmissions.length
      };
    });

    const visible = students.filter((student) => {
      const text = normalize(`${student.nome} ${student.email} ${student.course?.sigla || ''} ${student.course?.nome || ''}`);
      const matchesSearch = !coordinatorStudentSearchTerm || text.includes(normalize(coordinatorStudentSearchTerm));
      const matchesCourse = coordinatorStudentCourseFilter === 'todos' || student.course?.id === coordinatorStudentCourseFilter;
      return matchesSearch && matchesCourse;
    });

    document.getElementById('coordinatorStudentsHighlights').innerHTML = `
      <span class="summary-chip">Alunos <strong>${students.length}</strong></span>
      <span class="summary-chip">Com pendências <strong>${students.filter((student) => student.pendingCount > 0).length}</strong></span>
      <span class="summary-chip">Sem envio <strong>${students.filter((student) => !student.totalSubmissions).length}</strong></span>
    `;

    document.getElementById('coordinatorStudentFilterResult').textContent = `${visible.length} de ${students.length} alunos exibidos`;

    document.getElementById('coordinatorStudentsList').innerHTML = visible.length
      ? `
        <div class="table-wrap sigac-table-wrap sigac-scroll-table coordinator-student-table-wrap">
          <table class="data-table sigac-data-table sigac-compact-table coordinator-student-table">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Curso</th>
                <th>Matrícula</th>
                <th>Meta do semestre</th>
                <th>Horas concluídas</th>
                <th>% concluído</th>
                <th>Status</th>
                <th>Último envio</th>
              </tr>
            </thead>
            <tbody>
              ${visible.map((student) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(student.nome)}</strong>
                    <span>${escapeHtml(student.email)}</span>
                  </td>
                  <td>${escapeHtml(student.course?.sigla || '-')}</td>
                  <td>${escapeHtml(student.matricula || '-')}</td>
                  <td>${student.progress?.target || 0} h</td>
                  <td>
                    <strong>${student.progress?.total || 0} h</strong>
                    <span>${formatPercent(student.progress?.percent)} da meta</span>
                  </td>
                  <td><span class="badge ${percent(student.progress?.percent) >= 60 ? 'aprovado' : 'em_analise'}">${formatPercent(student.progress?.percent)}</span></td>
                  <td><span class="badge ${student.pendingCount ? 'em_analise' : 'aprovado'}">${student.pendingCount ? `${student.pendingCount} pendência(s)` : 'Em dia'}</span></td>
                  <td>${student.latestSubmission ? `${escapeHtml(student.latestSubmission.activity?.titulo || 'Atividade')}<span>${formatDate(student.latestSubmission.latest?.enviadaEm)}</span>` : '<span>Nenhum envio</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
      : `
        <div class="coordinator-student-empty">
          <h3>Nenhum aluno encontrado</h3>
          <p>Ajuste a busca ou o filtro por curso para visualizar outros alunos vinculados.</p>
        </div>
      `;
    logPerf('renderStudentsPanel', startedAt);
  }

  function renderSubmissions(user) {
    const submissions = ensureArray(SIGACStore.getCoordinatorDashboardData(user.id).submissions);
    const container = document.getElementById('pendingSubmissionsList');
    container.innerHTML = submissions.length
      ? submissions.map((submission) => `
          <div class="item">
            <h4>${escapeHtml(submission.student?.nome || 'Aluno')}</h4>
            <p><strong>Atividade:</strong> ${escapeHtml(submission.activity?.titulo || '-')}</p>
            <p class="meta">Curso: ${escapeHtml(submission.course?.sigla || '-')} | Versão ${submission.latest?.version || 1} | Enviado em ${formatDate(submission.latest?.enviadaEm)}</p>
            <p><strong>Status atual:</strong> <span class="badge ${submission.latest?.status || 'em_analise'}">${escapeHtml((submission.latest?.status || 'em_analise').replace('_', ' '))}</span></p>
            ${submission.latest?.observacao ? `<p><strong>Observação do aluno:</strong> ${escapeHtml(submission.latest.observacao)}</p>` : ''}
            <div class="actions-row">
              <a class="button secondary" href="${submission.latest?.arquivoData || '#'}" download="${escapeHtml(submission.latest?.arquivoNome || 'arquivo.txt')}">Abrir arquivo enviado</a>
            </div>
            ${submission.latest?.status === 'em_analise'
              ? `<form class="evaluation-form" data-submission-id="${submission.id}" style="margin-top:12px;">
                   <div class="field"><label>Feedback</label><textarea name="feedback" placeholder="Comentário para o aluno"></textarea></div>
                   <div class="actions-row">
                     <button type="button" class="approve-btn success">Aprovar</button>
                     <button type="button" class="reject-btn danger">Rejeitar</button>
                   </div>
                 </form>`
              : `<p class="small"><strong>Feedback:</strong> ${escapeHtml(submission.latest?.feedback || 'Sem observações.')}</p>`}
          </div>
        `).join('')
      : '<div class="item">Nenhum envio encontrado.</div>';

    container.querySelectorAll('.evaluation-form').forEach((form) => {
      const feedback = () => form.querySelector('textarea').value;
      form.querySelector('.approve-btn').addEventListener('click', async () => {
        const button = form.querySelector('.approve-btn');
        if (button.disabled) return;
        button.disabled = true;
        try {
          await SIGACStore.evaluateSubmission(user.id, form.dataset.submissionId, 'aprovado', feedback());
          renderAll(SIGACStore.getCurrentUser());
        } catch (error) {
          alert(error.message);
        } finally {
          button.disabled = false;
        }
      });
      form.querySelector('.reject-btn').addEventListener('click', async () => {
        const button = form.querySelector('.reject-btn');
        if (button.disabled) return;
        button.disabled = true;
        try {
          await SIGACStore.evaluateSubmission(user.id, form.dataset.submissionId, 'rejeitado', feedback());
          renderAll(SIGACStore.getCurrentUser());
        } catch (error) {
          alert(error.message);
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  function renderCertificates(user) {
    const list = SIGACStore.listCertificatesForUser(user.id);
    document.getElementById('certificatesList').innerHTML = list.length
      ? list.map((certificate) => `
          <div class="item">
            <h4>${escapeHtml(certificate.fileName)}</h4>
            <p class="meta">Enviado em ${formatDate(certificate.createdAt)} | Horas declaradas: ${certificate.declaredHours || 0} h</p>
            <p><strong>OCR:</strong> <span class="badge ${badgeClass(certificate.ocrStatus)}">${escapeHtml(statusLabel(certificate.ocrStatus))}</span></p>
            <p><strong>Admin:</strong> <span class="badge ${badgeClass(certificate.adminStatus)}">${escapeHtml(certificate.adminStatus.replaceAll('_', ' '))}</span></p>
            <p class="small">${escapeHtml(buildCertificateSummary(certificate))}</p>
            ${certificate.adminFeedback ? `<p class="small"><strong>Feedback:</strong> ${escapeHtml(certificate.adminFeedback)}</p>` : ''}
            <div class="actions-row"><button type="button" class="secondary open-own-cert-btn" data-certificate-id="${certificate.id}">Abrir certificado</button></div>
          </div>
        `).join('')
      : '<div class="item">Você ainda não enviou certificados para o administrador.</div>';
    document.querySelectorAll('.open-own-cert-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await SIGACStore.openCertificateFile(button.dataset.certificateId);
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function renderStudentCertificates(user) {
    const allCertificates = SIGACStore.listCertificatesForCoordinatorReview();
    const certificates = allCertificates.filter((certificate) => certificate.adminStatus === 'pendente');
    const container = document.getElementById('studentCertificatesList');
    document.getElementById('coordinatorCertificateStats').innerHTML = `
      <div class="card"><h3>Pendentes</h3><div class="metric-value">${allCertificates.filter((item) => item.adminStatus === 'pendente').length}</div></div>
      <div class="card"><h3>OCR aprovado automaticamente</h3><div class="metric-value">${allCertificates.filter((item) => item.ocrStatus === 'aprovado_automatico').length}</div></div>
      <div class="card"><h3>OCR em revisão manual</h3><div class="metric-value">${allCertificates.filter((item) => item.ocrStatus === 'analise_manual').length}</div></div>
      <div class="card"><h3>Rejeitados</h3><div class="metric-value">${allCertificates.filter((item) => item.adminStatus === 'rejeitado').length}</div></div>
    `;

    container.innerHTML = certificates.length
      ? certificates.map((certificate) => `
          <div class="item" data-certificate-id="${certificate.id}">
            <h4>${escapeHtml(certificate.fileName)}</h4>
            <p><strong>Enviado por:</strong> ${escapeHtml(certificate.sender?.nome || 'Aluno removido')} (${escapeHtml(certificate.senderType || 'aluno')})</p>
            <p class="meta">Enviado em ${formatDate(certificate.createdAt)} | Horas declaradas: ${certificate.declaredHours || 0} h</p>
            <p><strong>OCR:</strong> <span class="badge ${badgeClass(certificate.ocrStatus)}">${escapeHtml(statusLabel(certificate.ocrStatus))}</span></p>
            <p><strong>Admin:</strong> <span class="badge ${badgeClass(certificate.adminStatus)}">${escapeHtml(statusLabel(certificate.adminStatus))}</span></p>
            <p class="small"><strong>Resumo:</strong> ${escapeHtml(buildCertificateSummary(certificate))}</p>
            <div class="ocr-compare">
              <div><strong>Campo</strong><strong>Informado</strong><strong>Detectado pelo OCR</strong></div>
              <div><span>Nome da atividade</span><span>${escapeHtml(certificate.observation || 'Não informado')}</span><span>${escapeHtml(certificate.detectedTitle || 'Não identificado')}</span></div>
              <div><span>Carga horária</span><span>${certificate.declaredHours || 0} h</span><span>${certificate.detectedHours || 0} h</span></div>
              <div><span>Institui\u00e7\u00e3o</span><span>N\u00e3o informado</span><span>${escapeHtml(certificate.detectedInstitution || 'N\u00e3o identificada')}</span></div>
              <div><span>Data</span><span>${formatDate(certificate.createdAt)}</span><span>${escapeHtml(certificate.detectedDate || 'Não identificada')}</span></div>
            </div>
            ${certificate.adminFeedback ? `<p class="small"><strong>Feedback:</strong> ${escapeHtml(certificate.adminFeedback)}</p>` : ''}
            <div class="actions-row">
              <button type="button" class="secondary open-student-cert-btn">Abrir arquivo</button>
              <button type="button" class="success approve-student-cert-btn">Aprovar</button>
              <button type="button" class="danger reject-student-cert-btn">Rejeitar</button>
            </div>
            <div class="field" style="margin-top:12px;"><label>Feedback</label><textarea class="student-certificate-feedback" placeholder="Comentário para o aluno">${escapeHtml(certificate.adminFeedback || '')}</textarea></div>
          </div>
        `).join('')
      : '<div class="item">Nenhum certificado pendente no momento.</div>';

    container.querySelectorAll('.open-student-cert-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const certificateId = window.SIGACOCR.getSelectedCertificateId(button);
        try {
          await SIGACStore.openCoordinatorCertificateFile(certificateId);
        } catch (error) {
          alert(error.message);
        }
      });
    });

    container.querySelectorAll('.approve-student-cert-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const card = button.closest('.sigac-ocr-batch-card') || button.closest('[data-certificate-id]');
        const certificateId = window.SIGACOCR.getSelectedCertificateId(button);
        try {
          await SIGACStore.reviewCoordinatorCertificate(user.id, certificateId, 'aprovado', card.querySelector('.student-certificate-feedback').value);
          renderAll(SIGACStore.getCurrentUser());
          setActiveSection('certificados');
        } catch (error) {
          alert(error.message);
        }
      });
    });

    container.querySelectorAll('.reject-student-cert-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const card = button.closest('.sigac-ocr-batch-card') || button.closest('[data-certificate-id]');
        const certificateId = window.SIGACOCR.getSelectedCertificateId(button);
        try {
          await SIGACStore.reviewCoordinatorCertificate(user.id, certificateId, 'rejeitado', card.querySelector('.student-certificate-feedback').value);
          renderAll(SIGACStore.getCurrentUser());
          setActiveSection('certificados');
        } catch (error) {
          alert(error.message);
        }
      });
    });
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
        const request = { id: key, first: certificate, certificates: [], createdAt: certificate.createdAt };
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
        ocrAttention: certificates.some((item) => ['analise_manual', 'rejeitado_automatico', 'nao_processado'].includes(item.ocrStatus))
      };
    });
  }

  function renderCoordinatorCertificateRequestItem(certificate) {
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
          <div class="ocr-compare">
            <div><strong>Campo</strong><strong>Informado</strong><strong>Detectado pelo OCR</strong></div>
            <div><span>Nome da atividade</span><span>${escapeHtml(certificate.observation || 'Não informado')}</span><span>${escapeHtml(certificate.detectedTitle || certificate.detectedCourseName || 'Não identificado')}</span></div>
            <div><span>Carga horária</span><span>${certificate.declaredHours || 0} h</span><span>${certificate.detectedHours || 0} h</span></div>
            <div><span>Horas aproveitadas</span><span>${Number(certificate.hourBreakdown?.approvedHours ?? certificate.approvedHours ?? 0)} h</span><span>Excedente: ${Number(certificate.hourBreakdown?.excessHours ?? 0)} h</span></div>
            <div><span>Limite/restante</span><span>Categoria: ${Number(certificate.hourBreakdown?.categoryLimitHours ?? 0)} h</span><span>Semestre: ${Number(certificate.hourBreakdown?.remainingToSemesterHours ?? 0)} h</span></div>
            <div><span>Instituição</span><span>Não informado</span><span>${escapeHtml(certificate.detectedInstitution || 'Não identificada')}</span></div>
            <div><span>Data</span><span>${formatDate(certificate.createdAt)}</span><span>${escapeHtml(certificate.detectedDate || 'Não identificada')}</span></div>
          </div>
        </details>
        <div class="actions-row coordinator-certificate-actions">
          <button type="button" class="secondary open-student-cert-btn">Abrir arquivo</button>
          <button type="button" class="secondary run-ocr-btn">Processar OCR</button>
          <button type="button" class="success approve-student-cert-btn">Aprovar</button><button type="button" class="danger reject-student-cert-btn">Rejeitar</button>
        </div>
        <div class="field coordinator-certificate-feedback-field">
          <label>Feedback</label>
          <textarea class="student-certificate-feedback" placeholder="Comentário para o aluno">${escapeHtml(certificate.adminFeedback || '')}</textarea>
        </div>
      </div>
    `;
  }

  function setupCertificateForm(user) {
    const form = document.getElementById('certificateForm');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const file = document.getElementById('certificateFile').files[0];
      if (!file) {
        showMessage('certificateMessage', 'Selecione um arquivo antes de enviar.', 'error');
        return;
      }
      try {
        const fileData = await fileToDataUrl(file);
        await SIGACStore.submitCertificate(user.id, {
          fileName: file.name,
          fileData,
          observation: document.getElementById('certificateObservation').value,
          declaredHours: document.getElementById('certificateHours').value
        });
        form.reset();
        showMessage('certificateMessage', 'Certificado enviado ao administrador com sucesso.', 'success');
        renderAll(SIGACStore.getCurrentUser());
      } catch (error) {
        showMessage('certificateMessage', error.message, 'error');
      }
    });
  }

  function renderStudentCertificates(user) {
    const allCertificates = SIGACStore.listCertificatesForCoordinatorReview();
    const sortedCertificates = [...allCertificates].sort(compareCertificatesByPriority);
    const container = document.getElementById('studentCertificatesList');
    const courseSelect = document.getElementById('coordinatorCertificateCourseFilter');
    const uniqueCourseIds = [...new Set(sortedCertificates.map((certificate) => certificate.sender?.courseId).filter(Boolean))];

    if (courseSelect) {
      const previousValue = courseSelect.value || certificateCourseFilter;
      courseSelect.innerHTML = `
        <option value="todos">Todos os cursos</option>
        ${uniqueCourseIds.map((courseId) => `<option value="${courseId}">${escapeHtml(getCourseLabel(courseId))}</option>`).join('')}
      `;
      const hasPrevious = previousValue === 'todos' || uniqueCourseIds.includes(previousValue);
      courseSelect.value = hasPrevious ? previousValue : 'todos';
      certificateCourseFilter = courseSelect.value;
      if (window.SIGACCustomSelect) window.SIGACCustomSelect.refreshAll();
    }

    const visibleCertificates = sortedCertificates.filter((certificate) => {
      const searchableText = normalize([
        certificate.sender?.nome,
        certificate.sender?.email,
        certificate.fileName,
        certificate.observation,
        certificate.detectedTitle,
        certificate.detectedInstitution
      ].join(' '));
      const matchesStudent = !certificateStudentSearchTerm || searchableText.includes(normalize(certificateStudentSearchTerm));
      const matchesStatus = certificateStatusFilter === 'todos' || certificate.adminStatus === certificateStatusFilter;
      const matchesCourse = certificateCourseFilter === 'todos' || certificate.sender?.courseId === certificateCourseFilter;
      return matchesStudent && matchesStatus && matchesCourse;
    });
    const visibleRequests = groupCertificatesIntoRequests(visibleCertificates);

    const pendingCertificates = sortedCertificates.filter((item) => item.adminStatus === 'pendente');
    const approvedByCoordinator = sortedCertificates.filter((item) => item.adminStatus === 'aprovado').length;
    const rejectedByCoordinator = sortedCertificates.filter((item) => ['rejeitado', 'removido', 'removido_da_contagem'].includes(item.adminStatus)).length;
    const ocrAttentionCount = sortedCertificates.filter((item) => ['analise_manual', 'rejeitado_automatico', 'nao_processado'].includes(item.ocrStatus)).length;

    document.getElementById('coordinatorCertificateStats').innerHTML = `
      <div class="card metric-card accent-card accent-card--warning"><h3>Pendentes</h3><div class="metric-value">${pendingCertificates.length}</div><p class="small">Aguardando sua decisão</p></div>
      <div class="card metric-card accent-card accent-card--info"><h3>OCR pede revisão</h3><div class="metric-value">${ocrAttentionCount}</div><p class="small">Analise manual ou alerta</p></div>
      <div class="card metric-card accent-card accent-card--green"><h3>Aprovados</h3><div class="metric-value">${approvedByCoordinator}</div><p class="small">Ja liberados pelo coordenador</p></div>
      <div class="card metric-card accent-card accent-card--danger"><h3>Rejeitados</h3><div class="metric-value">${rejectedByCoordinator}</div><p class="small">Com retorno ao aluno</p></div>
    `;

    document.getElementById('coordinatorCertificateHighlights').innerHTML = '';
    document.getElementById('coordinatorCertificateFilterResult').textContent = `${visibleRequests.length} solicitação(ões) OCR | ${visibleCertificates.length} de ${sortedCertificates.length} certificados exibidos`;
    container.innerHTML = visibleRequests.length
      ? visibleRequests.map((request) => window.SIGACOCR.renderCertificateBatchCard({
          request,
          courseLabel: getCourseLabel(request.first?.sender?.courseId)
        })).join('')
      : `
        <div class="coordinator-certificate-empty">
          <h3>Nenhum certificado encontrado</h3>
          <p>Ajuste os filtros de status, aluno ou curso para localizar outro certificado na fila.</p>
        </div>
      `;
    window.SIGACOCR.bindCertificateBatchSelection(container);

    const processCoordinatorCertificateOcr = async (certificate) => {
      const file = await SIGACStore.getCoordinatorCertificateFile(certificate.id);
      const result = await window.SIGACOCR.analyzeCertificateData(file.fileData, { expectedName: certificate.sender?.nome || '' });
      await SIGACStore.saveCoordinatorCertificateOcrResult(user.id, certificate.id, result);
    };

    const bulkOcrButton = document.getElementById('coordinatorProcessVisibleOcrBtn');
    if (bulkOcrButton && bulkOcrButton.dataset.bound !== 'true') {
      bulkOcrButton.dataset.bound = 'true';
      bulkOcrButton.addEventListener('click', async () => {
        const dashboard = SIGACStore.getCoordinatorDashboardData();
        if (!dashboard.settings?.ocrDisponivel) {
          showMessage('certificateMessage', 'Ative o OCR nas configurações antes de processar certificados.', 'error');
          return;
        }
        const ids = [...container.querySelectorAll('.sigac-ocr-cert-chip[data-certificate-id]')]
          .map((card) => card.dataset.certificateId)
          .filter(Boolean);
        const certificates = ids
          .map((id) => (dashboard.certificatesToReview || []).find((item) => item.id === id))
          .filter(Boolean);
        if (!certificates.length) {
          showMessage('certificateMessage', 'Nenhum certificado visível para processar.', 'error');
          return;
        }

        bulkOcrButton.disabled = true;
        const originalLabel = bulkOcrButton.textContent;
        try {
          let failed = 0;
          for (let index = 0; index < certificates.length; index += 1) {
            bulkOcrButton.textContent = `Processando ${index + 1}/${certificates.length}...`;
            try {
              await processCoordinatorCertificateOcr(certificates[index]);
            } catch (_) {
              failed += 1;
            }
          }
          const processed = certificates.length - failed;
          showMessage('certificateMessage', failed
            ? `${processed} certificado(s) processados pelo OCR; ${failed} exigem validação manual.`
            : `${processed} certificado(s) processados pelo OCR.`, failed ? 'error' : 'success');
          renderCoordinatorSummary(SIGACStore.getCurrentUser());
          renderStudentCertificates(SIGACStore.getCurrentUser());
        } catch (error) {
          showMessage('certificateMessage', `Falha no OCR: ${error.message}`, 'error');
        } finally {
          bulkOcrButton.disabled = false;
          bulkOcrButton.textContent = originalLabel;
        }
      });
    }

    container.querySelectorAll('.open-student-cert-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const certificateId = window.SIGACOCR.getSelectedCertificateId(button);
        try {
          await SIGACStore.openCoordinatorCertificateFile(certificateId);
        } catch (error) {
          alert(error.message);
        }
      });
    });

    container.querySelectorAll('.coordinator-remove-rejected-approve-rest-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        if (button.disabled) return;
        const dashboard = SIGACStore.getCoordinatorDashboardData();
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
            await SIGACStore.deleteCoordinatorCertificate(certificateId);
          }
          for (const certificateId of approveIds) {
            const certificate = (dashboard.certificatesToReview || []).find((item) => item.id === certificateId);
            if (!certificate) continue;
            await SIGACStore.reviewCoordinatorCertificate(user.id, certificateId, 'aprovado', getDefaultCoordinatorFeedback(certificate, 'aprovado'));
          }
          showMessage('certificateMessage', 'Rejeitados retirados e certificados restantes aprovados.', 'success');
          renderCoordinatorSummary(SIGACStore.getCurrentUser());
          renderStudentCertificates(SIGACStore.getCurrentUser());
        } catch (error) {
          showMessage('certificateMessage', error.message, 'error');
          button.disabled = false;
          button.textContent = originalLabel;
        }
      });
    });

    container.querySelectorAll('.remove-rejected-cert-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        if (button.disabled) return;
        const card = button.closest('[data-certificate-id]');
        const dashboard = SIGACStore.getCoordinatorDashboardData();
        const current = (dashboard.certificatesToReview || []).find((item) => item.id === card?.dataset.certificateId);
        if (!current) return;
        const confirmed = window.confirm(`Retirar "${current.fileName}" da contagem do lote?`);
        if (!confirmed) return;
        button.disabled = true;
        try {
          await SIGACStore.deleteCoordinatorCertificate(current.id);
          showMessage('certificateMessage', 'Certificado retirado da contagem.', 'success');
          renderCoordinatorSummary(SIGACStore.getCurrentUser());
          renderStudentCertificates(SIGACStore.getCurrentUser());
        } catch (error) {
          showMessage('certificateMessage', error.message, 'error');
          button.disabled = false;
        }
      });
    });

    container.querySelectorAll('.run-ocr-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const dashboard = SIGACStore.getCoordinatorDashboardData();
        const certificateId = window.SIGACOCR.getSelectedCertificateId(button);
        const current = (dashboard.certificatesToReview || []).find((item) => item.id === certificateId);
        if (!current) return;
        if (!dashboard.settings?.ocrDisponivel) {
          showMessage('certificateMessage', 'Ative o OCR nas configurações antes de processar certificados.', 'error');
          return;
        }

        button.disabled = true;
        button.textContent = 'Processando...';
        try {
          await processCoordinatorCertificateOcr(current);
          renderCoordinatorSummary(SIGACStore.getCurrentUser());
          renderStudentCertificates(SIGACStore.getCurrentUser());
        } catch (error) {
          showMessage('certificateMessage', `Falha no OCR: ${error.message}`, 'error');
        } finally {
          button.disabled = false;
          button.textContent = 'Processar OCR';
        }
      });
    });

    container.querySelectorAll('.approve-student-cert-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        if (button.disabled) return;
        const card = button.closest('.sigac-ocr-batch-card') || button.closest('[data-certificate-id]');
        const certificateId = window.SIGACOCR.getSelectedCertificateId(button);
        const dashboard = SIGACStore.getCoordinatorDashboardData();
        const current = (dashboard.certificatesToReview || []).find((item) => item.id === certificateId);
        if (!current) return;
        if (['removido', 'removido_da_contagem'].includes(String(current.adminStatus || '').toLowerCase())) {
          alert('Este certificado foi removido da contagem e não pode ser aprovado.');
          return;
        }
        if (current.ocrStatus !== 'aprovado_automatico' && current.adminStatus !== 'aprovado') {
          const confirmed = window.confirm('Este certificado não está verde/aprovado pelo OCR. Deseja aprovar manualmente mesmo assim?');
          if (!confirmed) return;
        }
        button.disabled = true;
        try {
          await SIGACStore.reviewCoordinatorCertificate(user.id, certificateId, 'aprovado', card.querySelector('.student-certificate-feedback').value);
          renderCoordinatorSummary(SIGACStore.getCurrentUser());
          renderStudentCertificates(SIGACStore.getCurrentUser());
        } catch (error) {
          alert(error.message);
        } finally {
          button.disabled = false;
        }
      });
    });

    container.querySelectorAll('.reject-student-cert-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        if (button.disabled) return;
        const card = button.closest('.sigac-ocr-batch-card') || button.closest('[data-certificate-id]');
        const certificateId = window.SIGACOCR.getSelectedCertificateId(button);
        button.disabled = true;
        try {
          await SIGACStore.reviewCoordinatorCertificate(user.id, certificateId, 'rejeitado', card.querySelector('.student-certificate-feedback').value);
          renderCoordinatorSummary(SIGACStore.getCurrentUser());
          renderStudentCertificates(SIGACStore.getCurrentUser());
        } catch (error) {
          alert(error.message);
        } finally {
          button.disabled = false;
        }
      });
    });


  }

  function setupCertificateReviewControls() {
    const refresh = () => renderStudentCertificates(SIGACStore.getCurrentUser());
    document.getElementById('coordinatorCertificateStudentSearch')?.addEventListener('input', (event) => {
      certificateStudentSearchTerm = event.target.value;
      refresh();
    });
    document.getElementById('coordinatorCertificateStatusFilter')?.addEventListener('change', (event) => {
      certificateStatusFilter = event.target.value;
      refresh();
    });
    document.getElementById('coordinatorCertificateCourseFilter')?.addEventListener('change', (event) => {
      certificateCourseFilter = event.target.value;
      refresh();
    });
  }

  function renderOpportunities(user) {
    const container = document.getElementById('opportunitiesList');
    const statusFilter = document.getElementById('coordinatorOpportunityStatusFilter');
    const opportunities = SIGACStore.listOpportunities().map((opportunity) => {
      const totalInscritos = Array.isArray(opportunity.inscritos) ? opportunity.inscritos.length : 0;
      const status = String(opportunity.status || '').toLowerCase();
      return {
        ...opportunity,
        totalInscritos,
        status,
        isOpen: status === 'aberta'
      };
    });

    if (statusFilter) statusFilter.value = coordinatorOpportunityStatusFilter;
    if (window.SIGACCustomSelect) window.SIGACCustomSelect.refreshAll();

    const visibleOpportunities = opportunities.filter((opportunity) => {
      const searchableText = normalize(`${opportunity.titulo} ${opportunity.descricao}`);
      const matchesSearch = !coordinatorOpportunitySearchTerm || searchableText.includes(normalize(coordinatorOpportunitySearchTerm));
      const matchesStatus = coordinatorOpportunityStatusFilter === 'todos'
        || (coordinatorOpportunityStatusFilter === 'disponiveis' && opportunity.isOpen)
        || (coordinatorOpportunityStatusFilter === 'com_inscritos' && opportunity.totalInscritos > 0)
        || (coordinatorOpportunityStatusFilter === 'sem_inscritos' && opportunity.totalInscritos === 0)
        || (coordinatorOpportunityStatusFilter === 'encerradas' && !opportunity.isOpen);
      return matchesSearch && matchesStatus;
    });

    document.getElementById('coordinatorOpportunityHighlights').innerHTML = `
      <span class="summary-chip">Oportunidades <strong>${opportunities.length}</strong></span>
      <span class="summary-chip">Disponíveis <strong>${opportunities.filter((item) => item.isOpen).length}</strong></span>
      <span class="summary-chip">Com inscritos <strong>${opportunities.filter((item) => item.totalInscritos > 0).length}</strong></span>
      <span class="summary-chip">Sem inscritos <strong>${opportunities.filter((item) => item.totalInscritos === 0).length}</strong></span>
      <span class="summary-chip">Encerradas <strong>${opportunities.filter((item) => !item.isOpen).length}</strong></span>
    `;
    document.getElementById('coordinatorOpportunityFilterResult').textContent = `${visibleOpportunities.length} de ${opportunities.length} oportunidades exibidas`;

    container.innerHTML = visibleOpportunities.length
      ? `
          <div class="table-wrap sigac-table-wrap coordinator-opportunities-table-wrap">
            <table class="data-table sigac-data-table coordinator-opportunities-table">
              <colgroup>
                <col class="opportunity-col-title">
                <col class="opportunity-col-hours">
                <col class="opportunity-col-status">
                <col class="opportunity-col-enrolled">
                <col class="opportunity-col-updated">
                <col class="opportunity-col-actions">
              </colgroup>
              <thead>
                <tr>
                  <th>Oportunidade</th>
                  <th>Horas</th>
                  <th>Status</th>
                  <th>Inscritos</th>
                  <th>Atualizado</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${visibleOpportunities.map((opportunity) => {
                  const badgeClass = opportunity.isOpen ? 'em_analise' : (opportunity.totalInscritos ? 'aprovado' : 'rejeitado');
                  const badgeLabel = escapeHtml(opportunity.status || (opportunity.isOpen ? 'Aberta' : 'Encerrada'));
                  return `
                    <tr>
                      <td>
                        <strong>${escapeHtml(opportunity.titulo)}</strong>
                        <div class="small">${escapeHtml(opportunity.descricao)}</div>
                      </td>
                      <td>${escapeHtml(String(opportunity.horas || 0))} h</td>
                      <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
                      <td>${opportunity.totalInscritos}</td>
                      <td>${escapeHtml(formatDate(opportunity.updatedAt || opportunity.createdAt || ''))}</td>
                      <td>
                        <div class="opportunity-table-actions">
                          <button type="button" class="view-enrolled secondary compact-button" data-id="${opportunity.id}">Inscritos</button>
                          <button type="button" class="view-submissions secondary compact-button" data-id="${opportunity.id}">Envios</button>
                          <button type="button" class="follow secondary compact-button" data-id="${opportunity.id}">Acompanhar</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `
      : `
          <div class="opportunity-empty coordinator-opportunity-empty">
            <div class="opportunity-empty-icon" aria-hidden="true">/</div>
            <h3>Nenhuma oportunidade encontrada</h3>
            <p>Ajuste a busca ou o filtro para visualizar outras oportunidades publicadas no sistema.</p>
          </div>
        `;

    container.querySelectorAll('.view-enrolled').forEach((button) => {
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

    container.querySelectorAll('.view-submissions').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', async () => {
        try {
          await openSection('envios');
        } catch (error) {
          alert(error.message);
        }
      });
    });

    container.querySelectorAll('.follow').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', () => {
        try {
          showMessage('coordinatorOpportunityMessage', 'Acompanhamento ativado para esta oportunidade.', 'success');
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function setupOpportunityControls() {
    const refresh = () => renderOpportunities(SIGACStore.getCurrentUser());
    document.getElementById('coordinatorOpportunitySearchInput')?.addEventListener('input', (event) => {
      coordinatorOpportunitySearchTerm = event.target.value;
      refresh();
    });
    document.getElementById('coordinatorOpportunityStatusFilter')?.addEventListener('change', (event) => {
      coordinatorOpportunityStatusFilter = event.target.value;
      refresh();
    });
  }

  function populateCourseSelects(user) {
    const courses = user.courseIds.map((courseId) => SIGACStore.getCourseById(courseId)).filter(Boolean);
    const options = '<option value="">Selecione um curso...</option>' + courses.map((course) => `<option value="${course.id}">${escapeHtml(course.sigla)} - ${escapeHtml(course.nome)}</option>`).join('');
    const filterOptions = '<option value="todos">Todos os cursos</option>' + courses.map((course) => `<option value="${course.id}">${escapeHtml(course.sigla)} - ${escapeHtml(course.nome)}</option>`).join('');
    document.getElementById('courseId').innerHTML = options;
    document.getElementById('studentCourseInput').innerHTML = options;
    document.getElementById('ruleCourseInput').innerHTML = options;
    const studentFilter = document.getElementById('coordinatorStudentCourseFilter');
    if (studentFilter) studentFilter.innerHTML = filterOptions;
    if (window.SIGACCustomSelect) window.SIGACCustomSelect.refreshAll();
  }

  function setupStudentPanelControls() {
    const refresh = () => renderStudentsPanel(SIGACStore.getCurrentUser());
    document.getElementById('coordinatorStudentSearchInput')?.addEventListener('input', (event) => {
      coordinatorStudentSearchTerm = event.target.value;
      refresh();
    });
    document.getElementById('coordinatorStudentCourseFilter')?.addEventListener('change', (event) => {
      coordinatorStudentCourseFilter = event.target.value;
      refresh();
    });
  }

  function setupStudentForm(user) {
    const form = document.getElementById('studentForm');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const response = await SIGACStore.createCoordinatorStudent({
          nome: document.getElementById('studentNameInput').value,
          email: document.getElementById('studentEmailInput').value,
          senha: document.getElementById('studentPasswordInput').value,
          courseId: document.getElementById('studentCourseInput').value,
          ativo: document.getElementById('studentStatusInput').value === '1',
          cpf: document.getElementById('studentCpfInput')?.value || '',
          telefone: document.getElementById('studentPhoneInput')?.value || '',
          endereco: document.getElementById('studentAddressInput')?.value || '',
          dataNascimento: document.getElementById('studentBirthInput')?.value || '',
          cursoInteresse: document.getElementById('studentDesiredCourseInput')?.value || ''
        });
        form.reset();
        const temp = response.temporaryPassword ? ` Matrícula: ${response.matricula}. Senha temporária: ${response.temporaryPassword}.` : '';
        showMessage('studentFormMessage', `Aluno cadastrado e vinculado ao curso com sucesso.${temp} O primeiro login exigirá troca de senha.`, 'success');
        const freshUser = SIGACStore.getCurrentUser();
        populateCourseSelects(freshUser);
        renderCoordinatorSummary(freshUser);
        renderStudentsPanel(freshUser);
      } catch (error) {
        showMessage('studentFormMessage', error.message, 'error');
      }
    });
  }

  function setupActivityForm(user) {
    const form = document.getElementById('activityForm');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const materialFile = document.getElementById('material').files[0];
      let materialArquivo = '';
      let materialNome = '';
      if (materialFile) {
        materialArquivo = await fileToDataUrl(materialFile);
        materialNome = materialFile.name;
      }

      try {
        await SIGACStore.createActivity(user.id, {
          titulo: document.getElementById('titulo').value,
          descricao: document.getElementById('descricao').value,
          courseId: document.getElementById('courseId').value,
          horas: document.getElementById('horas').value,
          prazo: document.getElementById('prazo').value,
          materialNome,
          materialArquivo
        });
        form.reset();
        showMessage('activityMessage', 'Atividade publicada com sucesso.', 'success');
        const freshUser = SIGACStore.getCurrentUser();
        populateCourseSelects(freshUser);
        renderCoordinatorSummary(freshUser);
        renderActivities(freshUser);
      } catch (error) {
        showMessage('activityMessage', error.message, 'error');
      }
    });
  }

  function setupRuleForm(user) {
    const form = document.getElementById('ruleForm');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await SIGACStore.createCoordinatorRule({
          courseId: document.getElementById('ruleCourseInput').value,
          categoria: document.getElementById('ruleCategoryInput').value,
          cargaMinima: document.getElementById('ruleMinHours').value,
          limiteMaximo: document.getElementById('ruleMaxHours').value,
          exigeCertificado: document.getElementById('ruleRequiresCertificate').checked,
          exigeAprovacao: document.getElementById('ruleRequiresApproval').checked
        });
        form.reset();
        document.getElementById('ruleRequiresCertificate').checked = true;
        document.getElementById('ruleRequiresApproval').checked = true;
        showMessage('ruleMessage', 'Regra cadastrada com sucesso.', 'success');
        const freshUser = SIGACStore.getCurrentUser();
        populateCourseSelects(freshUser);
        renderCoordinatorSummary(freshUser);
        renderRules(freshUser);
      } catch (error) {
        showMessage('ruleMessage', error.message, 'error');
      }
    });
  }

  function renderSubmissions(user) {
    const startedAt = performance.now();
    const submissions = ensureArray(SIGACStore.getCoordinatorDashboardData(user.id).submissions);
    const container = document.getElementById('pendingSubmissionsList');
    const courses = Array.from(new Map(submissions
      .filter((submission) => submission.course?.id)
      .map((submission) => [submission.course.id, submission.course])).values());
    const activities = Array.from(new Map(submissions
      .filter((submission) => submission.activity?.id)
      .map((submission) => [submission.activity.id, submission.activity])).values());
    const courseFilter = document.getElementById('submissionCourseFilter');
    const activityFilter = document.getElementById('submissionActivityFilter');
    const statusFilter = document.getElementById('submissionStatusFilter');

    if (courseFilter) {
      courseFilter.innerHTML = '<option value="todos">Todos os cursos</option>' + courses
        .map((course) => `<option value="${course.id}" ${course.id === submissionCourseFilter ? 'selected' : ''}>${escapeHtml(course.sigla)} - ${escapeHtml(course.nome || '')}</option>`).join('');
    }
    if (activityFilter) {
      activityFilter.innerHTML = '<option value="todos">Todas as atividades</option>' + activities
        .map((activity) => `<option value="${activity.id}" ${activity.id === submissionActivityFilter ? 'selected' : ''}>${escapeHtml(activity.titulo)}</option>`).join('');
    }
    if (statusFilter) statusFilter.value = submissionStatusFilter;
    if (window.SIGACCustomSelect) window.SIGACCustomSelect.refreshAll();

    const visible = submissions.filter((submission) => {
      const text = normalize(`${submission.student?.nome || ''} ${submission.student?.email || ''} ${submission.activity?.titulo || ''} ${submission.course?.sigla || ''}`);
      const status = submission.latest?.status || 'em_analise';
      const matchesSearch = !submissionStudentSearchTerm || text.includes(normalize(submissionStudentSearchTerm));
      const matchesCourse = submissionCourseFilter === 'todos' || submission.course?.id === submissionCourseFilter;
      const matchesActivity = submissionActivityFilter === 'todos' || submission.activity?.id === submissionActivityFilter;
      const matchesStatus = submissionStatusFilter === 'todos' || status === submissionStatusFilter;
      return matchesSearch && matchesCourse && matchesActivity && matchesStatus;
    });

    document.getElementById('submissionFilterResult').textContent = `${visible.length} de ${submissions.length} envios exibidos`;

    container.innerHTML = visible.length
      ? visible.map((submission) => `
          <article class="coordinator-submission-card item accent-card ${submission.latest?.status === 'aprovado' ? 'accent-card--green' : submission.latest?.status === 'rejeitado' ? 'accent-card--danger' : 'accent-card--warning'}">
            <div class="coordinator-submission-top">
              <div>
                <h4>${escapeHtml(submission.student?.nome || 'Aluno')}</h4>
                <p>${escapeHtml(submission.student?.email || 'Sem e-mail')}</p>
              </div>
              <span class="badge ${submission.latest?.status || 'em_analise'}">${escapeHtml((submission.latest?.status || 'em_analise').replace('_', ' '))}</span>
            </div>
            <div class="coordinator-submission-meta">
              <div class="coordinator-submission-meta-card accent-card accent-card--info">
                <span>Atividade</span>
                <strong>${escapeHtml(submission.activity?.titulo || '-')}</strong>
              </div>
              <div class="coordinator-submission-meta-card accent-card">
                <span>Curso</span>
                <strong>${escapeHtml(submission.course?.sigla || '-')}</strong>
              </div>
              <div class="coordinator-submission-meta-card accent-card accent-card--warning">
                <span>Horas declaradas</span>
                <strong>${Number(submission.latest?.horasDeclaradas || submission.activity?.horas || 0)} h</strong>
              </div>
              <div class="coordinator-submission-meta-card accent-card accent-card--info">
                <span>Data do envio</span>
                <strong>${formatDate(submission.latest?.enviadaEm)}</strong>
              </div>
            </div>
            ${submission.latest?.observacao ? `<p class="coordinator-submission-note"><strong>Observação do aluno:</strong> ${escapeHtml(submission.latest.observacao)}</p>` : ''}
            ${submission.latest?.status === 'em_analise'
              ? `<form class="evaluation-form coordinator-submission-form" data-submission-id="${submission.id}">
                   <div class="field"><label>Feedback</label><textarea name="feedback" placeholder="Comentário para o aluno"></textarea></div>
                   <div class="actions-row coordinator-submission-actions">
                     <button type="button" class="button secondary submission-file-btn" data-submission-id="${submission.id}">Abrir comprovante</button>
                     <button type="button" class="approve-btn success">Aprovar</button>
                     <button type="button" class="reject-btn danger">Rejeitar</button>
                     <button type="button" class="correction-btn secondary">Solicitar correção</button>
                   </div>
                 </form>`
              : `
                 <div class="actions-row coordinator-submission-actions coordinator-submission-actions-readonly">
                   <button type="button" class="button secondary submission-file-btn" data-submission-id="${submission.id}">Abrir comprovante</button>
                 </div>
                 <p class="small"><strong>Feedback:</strong> ${escapeHtml(submission.latest?.feedback || 'Sem observações.')}</p>
               `}
          </article>
        `).join('')
      : '<div class="coordinator-submission-empty item">Nenhum envio encontrado para os filtros atuais.</div>';

    container.querySelectorAll('.submission-file-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await SIGACStore.openCoordinatorSubmissionFile(button.dataset.submissionId);
        } catch (error) {
          alert(error.message);
        }
      });
    });

    container.querySelectorAll('.evaluation-form').forEach((form) => {
      const feedback = () => form.querySelector('textarea').value;
      form.querySelector('.approve-btn').addEventListener('click', async () => {
        const button = form.querySelector('.approve-btn');
        if (button.disabled) return;
        button.disabled = true;
        try {
          await SIGACStore.evaluateSubmission(user.id, form.dataset.submissionId, 'aprovado', feedback());
          renderCoordinatorSummary(SIGACStore.getCurrentUser());
          renderSubmissions(SIGACStore.getCurrentUser());
        } catch (error) {
          alert(error.message);
        } finally {
          button.disabled = false;
        }
      });
      form.querySelector('.reject-btn').addEventListener('click', async () => {
        const button = form.querySelector('.reject-btn');
        if (button.disabled) return;
        button.disabled = true;
        try {
          await SIGACStore.evaluateSubmission(user.id, form.dataset.submissionId, 'rejeitado', feedback());
          renderCoordinatorSummary(SIGACStore.getCurrentUser());
          renderSubmissions(SIGACStore.getCurrentUser());
        } catch (error) {
          alert(error.message);
        } finally {
          button.disabled = false;
        }
      });
      form.querySelector('.correction-btn').addEventListener('click', async () => {
        const button = form.querySelector('.correction-btn');
        if (button.disabled) return;
        button.disabled = true;
        try {
          const textarea = form.querySelector('textarea');
          if (textarea && !textarea.value.trim()) {
            textarea.value = 'Solicitar correção: ajuste o comprovante e envie uma nova versao.';
          }
          await SIGACStore.evaluateSubmission(user.id, form.dataset.submissionId, 'rejeitado', feedback());
          renderCoordinatorSummary(SIGACStore.getCurrentUser());
          renderSubmissions(SIGACStore.getCurrentUser());
        } catch (error) {
          alert(error.message);
        } finally {
          button.disabled = false;
        }
      });
    });
    logPerf('renderSubmissions', startedAt);
  }

  function setupSubmissionControls() {
    const refresh = () => renderSubmissions(SIGACStore.getCurrentUser());
    document.getElementById('submissionStudentSearchInput')?.addEventListener('input', (event) => {
      submissionStudentSearchTerm = event.target.value;
      refresh();
    });
    document.getElementById('submissionCourseFilter')?.addEventListener('change', (event) => {
      submissionCourseFilter = event.target.value;
      refresh();
    });
    document.getElementById('submissionActivityFilter')?.addEventListener('change', (event) => {
      submissionActivityFilter = event.target.value;
      refresh();
    });
    document.getElementById('submissionStatusFilter')?.addEventListener('change', (event) => {
      submissionStatusFilter = event.target.value;
      refresh();
    });
  }

  function setupActivityControls() {
    const refresh = () => renderActivities(SIGACStore.getCurrentUser());
    document.getElementById('coordinatorActivitySearchInput')?.addEventListener('input', (event) => {
      coordinatorActivitySearchTerm = event.target.value;
      refresh();
    });
    document.getElementById('coordinatorActivityCourseFilter')?.addEventListener('change', (event) => {
      coordinatorActivityCourseFilter = event.target.value;
      refresh();
    });
    document.getElementById('coordinatorActivityStatusFilter')?.addEventListener('change', (event) => {
      coordinatorActivityStatusFilter = event.target.value;
      refresh();
    });
  }

  function renderCoordinatorSummary(user) {
    renderDashboard(user);
  }

  function renderCoordinatorSection(sectionId, user) {
    if (sectionId === 'dashboard') return renderDashboard(user);
    if (sectionId === 'alunos') return renderStudentsPanel(user);
    if (sectionId === 'atividades') return renderActivities(user);
    if (sectionId === 'regras') return renderRules(user);
    if (sectionId === 'envios') return renderSubmissions(user);
    if (sectionId === 'certificados') {
      renderCertificates(user);
      renderStudentCertificates(user);
      return;
    }
    if (sectionId === 'oportunidades') return renderOpportunities(user);
  }

  function renderCoordinatorCurrentSection(user) {
    renderCoordinatorSection(getCurrentSectionId(), user);
  }

  function renderAll(user) {
    const startedAt = performance.now();
    renderDashboard(user);
    renderStudentsPanel(user);
    renderActivities(user);
    renderRules(user);
    renderSubmissions(user);
    renderCertificates(user);
    renderStudentCertificates(user);
    renderOpportunities(user);
    decorateCoordinatorAccents();
    logPerf('renderAll', startedAt);
  }


  // ===== INÍCIO ALTERAÇÃO ML SIGAC: integração do dashboard Coordenador com as rotas /api/ml =====
  // ML - Configura o card do coordenador para consultar a última classificação salva no banco.
  async function coordinatorMlApiJson(url, options = {}) {
    const token = sessionStorage.getItem('sigac_auth_token');
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.details || 'Erro ao carregar ML.');
    return data;
  }

  function coordinatorMlRiskClass(value) {
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

  function coordinatorMlStudentName(item) {
    return [item.aluno_nome, item.nome_aluno, item.nome, item.aluno]
      .map((value) => String(value || '').trim())
      .find((value) => value && !isTechnicalStudentLabel(value)) || 'Aluno não identificado';
  }

  function setCoordinatorMlMetric(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value ?? 0);
  }

  function coordinatorMlTotalsFromRows(riscos = [], execucao = {}) {
    const total = riscos.length;
    const aprovados = riscos.reduce((acc, item) => acc + Number(item.qtd_aprovadas || 0), 0);
    const rejeitados = riscos.reduce((acc, item) => acc + Number(item.qtd_rejeitadas || 0), 0);
    const emAnalise = riscos.reduce((acc, item) => acc + Number(item.qtd_pendentes || 0), 0);
    return { total, aprovados, rejeitados, emAnalise };
  }

  function getSubmissionStatus(submission) {
    return submission?.latest?.status || submission?.currentStatus || 'em_analise';
  }

  function buildCoordinatorMlFallbackPayload(user, reason = '') {
    const data = SIGACStore.getCoordinatorDashboardData(user?.id);
    const submissions = ensureArray(data.submissions);
    const certificates = ensureArray(data.certificatesToReview);
    const riscos = ensureArray(data.students).map((student) => {
      const courseId = student.course?.id || student.courseId || '';
      const relatedSubmissions = submissions.filter((submission) => {
        const submissionCourseId = submission.activity?.courseId || submission.courseId || '';
        return submission.student?.id === student.id && (!courseId || submissionCourseId === courseId);
      });
      const relatedCertificates = certificates.filter((certificate) => {
        const certificateCourseId = certificate.courseId || certificate.sender?.courseId || '';
        return certificate.senderId === student.id && (!courseId || certificateCourseId === courseId);
      });
      const approvedSubmissions = relatedSubmissions.filter((submission) => getSubmissionStatus(submission) === 'aprovado').length;
      const rejectedSubmissions = relatedSubmissions.filter((submission) => getSubmissionStatus(submission) === 'rejeitado').length;
      const pendingSubmissions = relatedSubmissions.filter((submission) => !['aprovado', 'rejeitado'].includes(getSubmissionStatus(submission))).length;
      const approvedCertificates = relatedCertificates.filter((certificate) => certificate.adminStatus === 'aprovado').length;
      const rejectedCertificates = relatedCertificates.filter((certificate) => certificate.adminStatus === 'rejeitado').length;
      const pendingCertificates = relatedCertificates.filter((certificate) => !['aprovado', 'rejeitado', 'removido', 'removido_da_contagem'].includes(certificate.adminStatus)).length;
      const percentual = percent(student.progress?.percent);
      const risco = percentual >= 100 ? 'baixo' : percentual < 50 ? 'alto' : 'medio';

      return {
        aluno_id: student.id,
        aluno_nome: student.nome,
        aluno_email: student.email,
        aluno_matricula: student.matricula,
        curso_id: courseId,
        curso: student.course?.sigla || courseId || '-',
        curso_nome: student.course?.nome || '',
        meta_horas: Number(student.progress?.target || student.course?.horasMeta || 0),
        horas_identificadas: Number(student.progress?.identifiedHours ?? student.progress?.total ?? 0),
        horas_aprovadas: Number(student.progress?.total || 0),
        percentual_concluido: percentual,
        qtd_aprovadas: approvedSubmissions + approvedCertificates,
        qtd_rejeitadas: rejectedSubmissions + rejectedCertificates,
        qtd_pendentes: pendingSubmissions + pendingCertificates,
        classificacao_risco: risco
      };
    });

    return {
      execucao: {
        fallback: true,
        started_at: 'dados academicos atuais',
        status: 'dashboard',
        error_message: reason
      },
      riscos
    };
  }

  function renderCoordinatorMlDashboard(payload = {}) {
    const execucao = payload.execucao || payload.resumo || {};
    const riscos = ensureArray(payload.riscos);
    const statusBox = document.getElementById('coordinatorMlStatusBox');
    const ultimaExecucao = document.getElementById('coordinatorMlUltimaExecucao');
    const tbody = document.getElementById('coordinatorMlRiskTableBody');
    const totals = coordinatorMlTotalsFromRows(riscos, execucao);

    setCoordinatorMlMetric('coordinatorMlTotalRegistros', totals.total);
    setCoordinatorMlMetric('coordinatorMlTotalAprovados', totals.aprovados);
    setCoordinatorMlMetric('coordinatorMlTotalRejeitados', totals.rejeitados);
    setCoordinatorMlMetric('coordinatorMlTotalAnalise', totals.emAnalise);

    if (ultimaExecucao) ultimaExecucao.textContent = execucao.finished_at || execucao.started_at || 'Sem execução registrada';
    if (statusBox) {
      if (execucao.fallback) {
        statusBox.innerHTML = '<strong>Fonte:</strong> dados acadêmicos atuais do dashboard.';
      } else {
        statusBox.innerHTML = execucao.finished_at || execucao.started_at
          ? `<strong>Última execução:</strong> ${escapeHtml(execucao.finished_at || execucao.started_at)}`
          : '<strong>Última execução:</strong> nenhuma execução concluída.';
      }
    }

    if (!tbody) return;
    tbody.innerHTML = riscos.length ? riscos.map((item) => {
      const meta = Number(item.meta_horas || 0);
      const horas = Number(item.horas_aprovadas ?? item.horas_identificadas ?? 0);
      const percentual = Math.max(0, Math.min(100, meta ? (horas / meta) * 100 : Number(item.percentual_concluido || item.percentual_conclusao || 0)));
      const risco = percentual >= 100 ? 'baixo' : coordinatorMlRiskClass(item.classificacao_risco || item.risco);
      return `
        <tr>
          <td>${escapeHtml(coordinatorMlStudentName(item))}</td>
          <td>${escapeHtml(item.curso || item.curso_id || '-')}</td>
          <td>${formatHours(horas)}</td>
          <td>${formatHours(meta)}</td>
          <td>${formatPercent(percentual)}</td>
          <td>${Number(item.qtd_rejeitadas || item.submissoes_rejeitadas || 0)}</td>
          <td>${Number(item.qtd_pendentes || item.submissoes_pendentes || 0)}</td>
          <td><span class="badge ${risco}">${escapeHtml(risco)}</span></td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="8">Nenhum aluno vinculado aos seus cursos.</td></tr>';
  }

  async function carregarMlCoordenador() {
    const statusBox = document.getElementById('coordinatorMlStatusBox');

    try {
      if (statusBox) statusBox.innerHTML = '<strong>Status:</strong> consultando última análise de ML...';
      const data = await coordinatorMlApiJson('/api/ml/risco-alunos');
      lastCoordinatorMlData = ensureArray(data.riscos).length
        ? data
        : buildCoordinatorMlFallbackPayload(SIGACStore.getCurrentUser(), 'Retorno ML sem linhas de risco.');
      renderCoordinatorMlDashboard(lastCoordinatorMlData);
      // Atualiza o dashboard do coordenador com os dados do ML quando disponíveis
      try { renderDashboard(SIGACStore.getCurrentUser()); } catch (e) { /* silencioso */ }
    } catch (error) {
      lastCoordinatorMlData = buildCoordinatorMlFallbackPayload(SIGACStore.getCurrentUser(), error.message);
      if (statusBox) statusBox.innerHTML = `<strong>Erro:</strong> ${escapeHtml(error.message)}. Exibindo dados acadêmicos atuais.`;
      renderCoordinatorMlDashboard(lastCoordinatorMlData);
    }
  }

  function setupCoordinatorMlDashboard() {
    const button = document.getElementById('btnCarregarMLCoordenador');
    if (button && button.dataset.bound !== 'true') {
      button.dataset.bound = 'true';
      button.addEventListener('click', carregarMlCoordenador);
    }
    carregarMlCoordenador();
  }

  // ===== FIM ALTERAÇÃO ML SIGAC: integração do dashboard Coordenador com Machine Learning =====

  async function init() {
    const startedAt = performance.now();
    try {
      const user = await SIGACStore.bootstrap('coordenador');
      setUserIdentity(user, 'Coordenador');
      populateCourseSelects(user);
      setupStudentForm(user);
      setupStudentPanelControls();
      setupActivityForm(user);
      setupActivityControls();
      setupRuleForm(user);
      setupSubmissionControls();
      setupCertificateReviewControls();
      setupOpportunityControls();
      setupCertificateForm(user);
      // ===== INÍCIO CHAMADA ML SIGAC: ativa consulta do card ML do Coordenador =====
      setupCoordinatorMlDashboard();
      // ===== FIM CHAMADA ML SIGAC: ativa consulta do card ML do Coordenador =====
      updateSectionHeader('dashboard');
      document.querySelectorAll('[data-section]').forEach((button) => {
        button.addEventListener('click', async () => {
          await openSection(button.dataset.section);
        });
      });
      document.querySelectorAll('[data-section-jump]').forEach((button) => {
        button.addEventListener('click', async () => {
          await openSection(button.dataset.sectionJump);
        });
      });
      document.getElementById('logoutBtn').addEventListener('click', () => {
        SIGACStore.logout();
        window.location.replace('loginsigac.html');
      });
      renderCoordinatorSummary(user);
      renderCoordinatorSection('dashboard', user);
      window.addEventListener('sigac:themechange', () => {
        window.SIGACCharts?.ensureDefaults?.();
        renderDashboard(user);
      });
      decorateCoordinatorAccents();
      logPerf('initCoordenador', startedAt);
    } catch (error) {
      if (isAuthError(error)) {
        SIGACStore.logout();
        window.location.replace('loginsigac.html');
        return;
      }
      renderBootstrapError(error.message || 'Não foi possível carregar o painel do coordenador no momento.');
    }
  }

  // INICIALIZAÇÃO - Registra eventos quando a página termina de carregar.
document.addEventListener('DOMContentLoaded', init);
})();
