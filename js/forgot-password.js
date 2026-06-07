document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgotForm');
  const message = document.getElementById('forgotMessage');

  function getApiBase() {
    const isSameBackend = window.location.protocol.startsWith('http')
      && ['localhost', '127.0.0.1'].includes(window.location.hostname)
      && window.location.port === '3000';

    if (isSameBackend) return '';

    const host = ['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? window.location.hostname
      : 'localhost';

    return `http://${host}:3000`;
  }

  function show(text, type) {
    if (!message) return;
    message.textContent = text;
    message.className = `message ${type}`;
    message.classList.remove('hidden');
  }

  async function requestJson(url, options = {}) {
    let response;
    try {
      response = await fetch(`${getApiBase()}${url}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        ...options
      });
    } catch (_) {
      throw new Error('Não foi possível conectar ao servidor. Verifique se o SIGAC está rodando.');
    }

    let payload = {};
    try {
      payload = await response.json();
    } catch (_) {
      payload = {};
    }

    if (!response.ok) {
      throw new Error(payload.error || 'Não foi possível enviar a solicitação.');
    }

    return payload;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!message) return;
    message.className = 'message info hidden';
    message.textContent = '';

    const email = document.getElementById('email').value.trim();
    if (!email) {
      show('Informe o e-mail cadastrado.', 'error');
      return;
    }

    try {
      const data = await requestJson('/api/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email })
      });

      show(`Senha temporária: ${data.temporaryPassword}. Faça login e cadastre sua senha definitiva.`, 'success');
      form.reset();
    } catch (error) {
      show(error.message, 'error');
    }
  });
});
