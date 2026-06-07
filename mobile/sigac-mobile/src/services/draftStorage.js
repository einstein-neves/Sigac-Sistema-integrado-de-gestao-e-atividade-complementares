import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_KEY = 'sigac.draft.activity';
const CERTIFICATE_DRAFT_KEY = 'sigac.draft.certificate';
const MAX_DRAFT_FILE_BYTES = 2 * 1024 * 1024;

function trimLargeFile(draft) {
  const safeDraft = { ...(draft || {}), updatedAt: Date.now() };
  if (safeDraft.file?.size > MAX_DRAFT_FILE_BYTES) {
    safeDraft.file = {
      name: safeDraft.file.name,
      mimeType: safeDraft.file.mimeType,
      size: safeDraft.file.size,
      kind: safeDraft.file.kind,
      dataUrl: '',
      previewUri: '',
      uri: '',
      needsReattach: true,
    };
  }
  return safeDraft;
}

export async function saveActivityDraft(draft) {
  const safeDraft = trimLargeFile(draft);
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(safeDraft));
}

export async function loadActivityDraft() {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export async function clearActivityDraft() {
  await AsyncStorage.removeItem(DRAFT_KEY);
}

export async function saveCertificateDraft(draft) {
  const safeDraft = trimLargeFile(draft);
  await AsyncStorage.setItem(CERTIFICATE_DRAFT_KEY, JSON.stringify(safeDraft));
}

export async function loadCertificateDraft() {
  try {
    const raw = await AsyncStorage.getItem(CERTIFICATE_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export async function clearCertificateDraft() {
  await AsyncStorage.removeItem(CERTIFICATE_DRAFT_KEY);
}
