import * as FileSystem from 'expo-file-system/legacy';

const rawBaseUrl = process.env.EXPO_PUBLIC_API_URL || '';
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function ensureBaseUrl() {
  if (!API_BASE_URL) {
    throw new ApiError(
      'Configure EXPO_PUBLIC_API_URL com o endereço da API. No celular físico, use o IP da máquina ou uma API publicada.',
      0
    );
  }
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (_) {
    return { message: text };
  }
}

function errorMessageForStatus(status, data) {
  const backendMessage = data?.error || data?.message || data?.erro;
  if (backendMessage) return backendMessage;
  if (status === 401) return 'Sessão expirada. Entre novamente.';
  if (status === 403) return 'Você não tem permissão para executar esta ação.';
  if (status === 404) return 'Recurso não encontrado na API do SIGAC.';
  return 'Erro ao comunicar com a API do SIGAC.';
}

async function request(path, options = {}) {
  ensureBaseUrl();

  const { token, headers, body, ...rest } = options;
  const finalHeaders = {
    Accept: 'application/json',
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers || {}),
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body && typeof body !== 'string' ? JSON.stringify(body) : body,
    });
  } catch (_) {
    throw new ApiError('Falha de conexão com a API. Verifique a URL, rede e backend ligado.', 0);
  }

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new ApiError(errorMessageForStatus(response.status, data), response.status, data);
  }

  return data;
}

function sanitizeFileName(fileName) {
  const clean = String(fileName || 'arquivo').replace(/[\\/:*?"<>|]+/g, '-').trim();
  return clean || 'arquivo';
}

function extensionForMime(mimeType) {
  const type = String(mimeType || '').toLowerCase();
  if (type === 'application/pdf') return '.pdf';
  if (type === 'image/png') return '.png';
  if (type === 'image/jpeg') return '.jpg';
  if (type === 'image/webp') return '.webp';
  return '';
}

function inferMimeFromFileName(fileName) {
  const name = String(fileName || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function ensureFileExtension(fileName, mimeType) {
  const safeName = sanitizeFileName(fileName);
  if (/\.[a-z0-9]{2,5}$/i.test(safeName)) return safeName;
  return `${safeName}${extensionForMime(mimeType)}`;
}

async function downloadFile(path, token, fileName, options = {}) {
  ensureBaseUrl();
  const safeName = ensureFileExtension(fileName, options.mimeType || inferMimeFromFileName(fileName));
  const fileUri = `${FileSystem.cacheDirectory}${Date.now()}-${safeName}`;

  let result;
  try {
    result = await FileSystem.downloadAsync(`${API_BASE_URL}${path}`, fileUri, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (_) {
    throw new ApiError('Falha ao baixar o arquivo. Verifique a conexão e tente novamente.', 0);
  }

  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(errorMessageForStatus(result.status, null), result.status);
  }

  return result.uri;
}

async function downloadFileWithMeta(path, token, fileName) {
  const mimeType = inferMimeFromFileName(fileName);
  const uri = await downloadFile(path, token, fileName, { mimeType });
  return {
    uri,
    previewUri: '',
    fileName: ensureFileExtension(fileName, mimeType),
    mimeType,
  };
}

async function dataUrlToLocalFile(path, token, fileName) {
  const data = await request(path, { token });
  const match = String(data?.fileData || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match || !match[2]) {
    throw new ApiError('Arquivo do certificado invalido ou indisponivel.', 400, data);
  }

  const mimeType = String(match[1] || 'application/octet-stream').toLowerCase();
  const safeName = ensureFileExtension(data?.fileName || fileName, mimeType);
  const fileUri = `${FileSystem.cacheDirectory}${Date.now()}-${safeName}`;
  await FileSystem.writeAsStringAsync(fileUri, match[3] || '', {
    encoding: FileSystem.EncodingType.Base64,
  });
  return {
    uri: fileUri,
    previewUri: mimeType.startsWith('image/') ? data.fileData : '',
    fileName: safeName,
    mimeType,
  };
}

async function dataUrlToFile(path, token, fileName) {
  const file = await dataUrlToLocalFile(path, token, fileName);
  return file.uri;
}

export const api = {
  baseUrl: API_BASE_URL,

  login(email, senha) {
    return request('/api/auth/login', {
      method: 'POST',
      body: { email, senha },
    });
  },

  verifyTwoFactor(challengeToken, code) {
    return request('/api/auth/verify-2fa', {
      method: 'POST',
      body: { challengeToken, code },
    });
  },

  changeTemporaryPassword(token, payload) {
    return request('/api/auth/change-temporary-password', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  requestPasswordReset(email) {
    return request('/api/auth/request-password-reset', {
      method: 'POST',
      body: { email },
    });
  },

  logout(token) {
    return request('/api/auth/logout', {
      method: 'POST',
      token,
    });
  },

  me(token) {
    return request('/api/me', { token });
  },

  atualizarTwoFactor(token, enabled) {
    return request('/api/me/two-factor', {
      method: 'PATCH',
      token,
      body: { enabled },
    });
  },

  cursos(token) {
    return request('/api/mobile/student/profile', { token });
  },

  alternarCursoAtivo(token, courseId) {
    return request('/api/student/active-course', {
      method: 'POST',
      token,
      body: { courseId },
    });
  },

  conteudoAluno(token) {
    return request('/api/mobile/student/content', { token });
  },

  dashboardAluno(token) {
    return request('/api/mobile/student/dashboard', { token });
  },

  atividadesAluno(token) {
    return request('/api/mobile/student/activities', { token });
  },

  enviarAtividade(token, payload) {
    return request('/api/mobile/student/submissions', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  baixarComprovante(token, submissionId, fileName) {
    return downloadFile(`/api/mobile/student/submissions/${encodeURIComponent(submissionId)}/file`, token, fileName);
  },

  baixarMaterialAtividade(token, activityId, fileName) {
    return downloadFile(`/api/activities/${encodeURIComponent(activityId)}/material`, token, fileName);
  },

  certificadosMeus(token) {
    return request('/api/mobile/student/certificates', { token });
  },

  enviarCertificado(token, payload) {
    return request('/api/mobile/student/certificates', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  baixarCertificado(token, certificateId, fileName) {
    const encodedId = encodeURIComponent(certificateId);
    return downloadFile(`/api/certificates/${encodedId}/file`, token, fileName)
      .catch(() => dataUrlToFile(`/api/certificates/${encodedId}/data`, token, fileName));
  },

  prepararCertificado(token, certificateId, fileName) {
    const encodedId = encodeURIComponent(certificateId);
    return downloadFileWithMeta(`/api/certificates/${encodedId}/file`, token, fileName)
      .catch(() => dataUrlToLocalFile(`/api/certificates/${encodedId}/data`, token, fileName));
  },

  oportunidades(token) {
    return request('/api/mobile/student/opportunities', { token });
  },

  alternarOportunidade(token, opportunityId, payload = null) {
    return request(`/api/mobile/student/opportunities/${encodeURIComponent(opportunityId)}/toggle`, {
      method: 'POST',
      token,
      body: payload,
    });
  },

  registrarPushToken(token, payload) {
    return request('/api/mobile/student/push-token', {
      method: 'POST',
      token,
      body: payload,
    });
  },
};
