// SIGAC Faculdade - recursos visuais e academicos sem alterar endpoints.
(function () {
  'use strict';

  // Presentation mode: keep academic chat fully disabled and invisible.
  const ACADEMIC_CHAT_ENABLED = false;

  const SENAC_COURSES = [
    'Analise e Desenvolvimento de Sistemas',
    'Ciencia de Dados e Inteligencia Artificial',
    'Gestao da Tecnologia da Informacao',
    'Redes de Computadores',
    'Sistemas para Internet',
    'Design Grafico',
    'Marketing',
    'Administracao',
    'Gestao Comercial',
    'Logistica',
    'Recursos Humanos',
    'Gastronomia',
    'Hotelaria',
    'Estetica e Cosmetica',
    'Enfermagem'
  ];

  const CHAT_KEY = 'sigac_coordination_chat';
  const STUDENT_PROFILE_KEY = 'sigac_student_profile_draft';

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function populateSenacCourseSelect() {
    ['studentDesiredCourseInput', 'userDesiredCourseInput'].forEach((id) => {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = '<option value="">Selecione uma opcao...</option>' + SENAC_COURSES
        .map((course) => `<option value="${escapeHtml(course)}">${escapeHtml(course)}</option>`)
        .join('');
    });
  }

  function saveStudentProfileDraft() {
    const form = document.getElementById('studentForm');
    if (!form) return;
    form.addEventListener('submit', () => {
      const draft = {
        nome: document.getElementById('studentNameInput')?.value || '',
        cpf: document.getElementById('studentCpfInput')?.value || '',
        telefone: document.getElementById('studentPhoneInput')?.value || '',
        email: document.getElementById('studentEmailInput')?.value || '',
        endereco: document.getElementById('studentAddressInput')?.value || '',
        nascimento: document.getElementById('studentBirthInput')?.value || '',
        cursoInteresse: document.getElementById('studentDesiredCourseInput')?.value || '',
        atualizadoEm: new Date().toISOString()
      };
      writeJson(STUDENT_PROFILE_KEY, draft);
    });
  }

  function addAcademicInsights() {
    const dashboard = document.querySelector('#dashboard');
    if (!dashboard || dashboard.querySelector('.academic-insight-grid')) return;
    const isAdmin = !!document.getElementById('dashboardCourseFilter');
    const isCoordinator = !!document.getElementById('coordinatorMlDashboardCard');
    if (!isAdmin && !isCoordinator) return;

    const grid = document.createElement('div');
    grid.className = 'academic-insight-grid';
    grid.innerHTML = [
      ['OCR', 'Triagem de certificados com pre-analise e revisao humana'],
      ['ML', 'Risco academico por progresso, rejeicoes e pendencias'],
      ['Feedback', 'Retorno claro em atividades e certificados'],
      ['Cursos', 'Gestao por curso, regras, vinculos e indicadores']
    ].map(([title, text]) => `
      <div class="academic-insight-card">
        <strong>${title}</strong>
        <span>${text}</span>
      </div>
    `).join('');
    dashboard.insertBefore(grid, dashboard.firstElementChild);
  }

  function getLocalChatMessages() {
    const messages = readJson(CHAT_KEY, []);
    if (messages.length) return messages;
    return [{
      author: 'coord',
      text: 'Ola! Envie sua duvida sobre atividades, certificados, cursos ou feedback. A coordenacao acompanha por aqui.',
      createdAt: new Date().toISOString()
    }];
  }

  async function fetchChatMessages(mode) {
    try {
      if (mode === 'coordinator' && window.SIGACStore?.getCoordinatorChatMessages) {
        const response = await window.SIGACStore.getCoordinatorChatMessages();
        return Array.isArray(response.messages) ? response.messages : [];
      }
      if (mode === 'student' && window.SIGACStore?.getStudentChatMessages) {
        const response = await window.SIGACStore.getStudentChatMessages();
        return Array.isArray(response.messages) ? response.messages : [];
      }
    } catch (_) {
      return getLocalChatMessages();
    }
    return getLocalChatMessages();
  }

  function getMessageAuthor(message, mode) {
    if (message.author) return message.author;
    if (mode === 'student') return message.sender?.tipo === 'aluno' ? 'student' : 'coord';
    return message.sender?.tipo === 'coordenador' ? 'coord' : 'student';
  }

  async function renderChatMessages(container, mode, studentSelect) {
    const messages = await fetchChatMessages(mode);
    const students = new Map();
    messages.forEach((message) => {
      if (message.student?.id) students.set(message.student.id, message.student);
    });

    if (studentSelect) {
      const current = studentSelect.value;
      studentSelect.innerHTML = '<option value="">Responder aluno...</option>' + [...students.values()]
        .map((student) => `<option value="${escapeHtml(student.id)}">${escapeHtml(student.nome)} - ${escapeHtml(student.matricula || student.email || '')}</option>`)
        .join('');
      if (students.has(current)) studentSelect.value = current;
    }

    container.innerHTML = messages.map((message) => `
      <div class="sigac-chat-message ${getMessageAuthor(message, mode) === 'student' ? 'is-student' : ''}">
        ${escapeHtml(message.message || message.text)}
        <small>${escapeHtml(message.student?.nome || (getMessageAuthor(message, mode) === 'student' ? 'Aluno' : 'Coordenacao'))} - ${new Date(message.createdAt).toLocaleString('pt-BR')}</small>
      </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
  }

  function createAcademicChat() {
    if (!ACADEMIC_CHAT_ENABLED) return;
    const context = document.querySelector('.console-context strong')?.textContent || '';
    const mode = context.includes('Aluno') ? 'student' : context.includes('Coord') ? 'coordinator' : '';
    if (!document.querySelector('body') || !mode) return;
    if (document.querySelector('.sigac-chat-launcher')) return;

    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'sigac-chat-launcher';
    launcher.innerHTML = `<span aria-hidden="true">?</span><strong>${mode === 'student' ? 'Chat com coordenacao' : 'Chat dos alunos'}</strong>`;

    const panel = document.createElement('section');
    panel.className = 'sigac-chat-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="sigac-chat-head">
        <div>
          <h2>Atendimento academico</h2>
          <p>Converse com a coordenacao sobre certificados, atividades, cursos e feedback.</p>
        </div>
        <button type="button" class="sigac-chat-close" aria-label="Fechar chat">x</button>
      </div>
      <div class="sigac-chat-messages" aria-live="polite"></div>
      <form class="sigac-chat-form">
        ${mode === 'coordinator' ? '<select name="studentId" class="sigac-chat-student-select" required><option value="">Responder aluno...</option></select>' : ''}
        <textarea name="message" required placeholder="Digite sua mensagem..."></textarea>
        <button type="submit">Enviar</button>
      </form>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    const messagesBox = panel.querySelector('.sigac-chat-messages');
    const studentSelect = panel.querySelector('.sigac-chat-student-select');
    renderChatMessages(messagesBox, mode, studentSelect);

    launcher.addEventListener('click', async () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        await renderChatMessages(messagesBox, mode, studentSelect);
        panel.querySelector('textarea').focus();
      }
    });

    panel.querySelector('.sigac-chat-close').addEventListener('click', () => {
      panel.hidden = true;
    });

    panel.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const textarea = event.currentTarget.elements.message;
      const text = textarea.value.trim();
      if (!text) return;
      try {
        if (mode === 'coordinator' && window.SIGACStore?.sendCoordinatorChatMessage) {
          await window.SIGACStore.sendCoordinatorChatMessage(event.currentTarget.elements.studentId.value, text);
        } else if (mode === 'student' && window.SIGACStore?.sendStudentChatMessage) {
          await window.SIGACStore.sendStudentChatMessage(text);
        } else {
          const messages = getLocalChatMessages();
          messages.push({ author: mode === 'student' ? 'student' : 'coord', text, createdAt: new Date().toISOString() });
          writeJson(CHAT_KEY, messages.slice(-30));
        }
      } catch (error) {
        const messages = getLocalChatMessages();
        messages.push({ author: mode === 'student' ? 'student' : 'coord', text: `${text} (pendente de sincronizacao)`, createdAt: new Date().toISOString() });
        writeJson(CHAT_KEY, messages.slice(-30));
      }
      textarea.value = '';
      await renderChatMessages(messagesBox, mode, studentSelect);
    });
  }

  function init() {
    populateSenacCourseSelect();
    saveStudentProfileDraft();
    addAcademicInsights();
    createAcademicChat();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
