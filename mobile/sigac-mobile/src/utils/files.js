import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

export const ALLOWED_UPLOAD_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const LOG_PREFIX = '[SIGAC upload]';

function logUpload(step, payload = {}) {
  try {
    console.log(LOG_PREFIX, step, payload);
  } catch (_) {}
}

function pickerErrorMessage(error, fallback) {
  const message = String(error?.message || error || '');
  if (message.includes('Base64') || message.includes('readAsStringAsync')) {
    return 'Nao foi possivel converter o arquivo para envio. Tente selecionar o arquivo novamente.';
  }
  return message || fallback;
}

export function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (!value) return 'Tamanho nao informado';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function inferMimeType(asset, fallback = 'application/octet-stream') {
  const direct = asset?.mimeType || asset?.mime || '';
  if (direct) return String(direct).toLowerCase();

  const name = String(asset?.name || asset?.fileName || asset?.uri || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  return fallback;
}

function fileNameFromUri(uri, fallback) {
  const clean = String(uri || '').split('?')[0];
  const last = clean.split('/').filter(Boolean).pop();
  return last || fallback;
}

async function fileInfo(uri, knownSize = 0) {
  if (knownSize) return { size: knownSize };
  if (!uri) return { size: 0 };

  try {
    const info = await FileSystem.getInfoAsync(uri);
    logUpload('fileInfo', { uri, exists: info?.exists, size: info?.size });
    return { size: info?.size || 0 };
  } catch (error) {
    logUpload('fileInfo:error', { uri, message: error?.message });
    return { size: 0 };
  }
}

async function readAssetBase64(asset) {
  if (typeof asset?.base64 === 'string' && asset.base64.length > 0) {
    logUpload('base64:from-picker', {
      name: asset.name || asset.fileName,
      length: asset.base64.length,
    });
    return asset.base64;
  }

  if (!asset?.uri) {
    throw new Error('Arquivo invalido: o seletor nao retornou o endereco local do arquivo.');
  }

  logUpload('base64:read-file:start', {
    uri: asset.uri,
    hasReadAsStringAsync: typeof FileSystem.readAsStringAsync === 'function',
    hasEncodingType: !!FileSystem.EncodingType,
  });

  const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
  if (!base64) {
    throw new Error('Arquivo invalido: nao foi possivel ler o conteudo em Base64.');
  }

  logUpload('base64:read-file:success', { length: base64.length });
  return base64;
}

async function assetToDataUrl(asset, fallbackName, fallbackMimeType) {
  logUpload('assetToDataUrl:start', {
    fallbackName,
    fallbackMimeType,
    hasAsset: !!asset,
    uri: asset?.uri,
    name: asset?.name || asset?.fileName,
    mimeType: asset?.mimeType || asset?.mime,
    size: asset?.size || asset?.fileSize,
    hasBase64: !!asset?.base64,
  });

  if (!asset || typeof asset !== 'object') {
    throw new Error('Arquivo invalido: nenhum arquivo foi retornado pelo seletor.');
  }
  if (!asset.uri && !asset.base64) {
    throw new Error('Arquivo invalido: selecione novamente o comprovante.');
  }

  const info = await fileInfo(asset.uri, asset.size || asset.fileSize || 0);
  if (info.size && info.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Arquivo muito grande. O limite atual e ${formatFileSize(MAX_UPLOAD_BYTES)}.`);
  }

  const mimeType = inferMimeType(asset, fallbackMimeType);
  if (!ALLOWED_UPLOAD_TYPES.includes(mimeType)) {
    throw new Error('Formato nao suportado. Envie PDF, PNG, JPG ou WEBP.');
  }

  const base64 = await readAssetBase64(asset);
  const payload = {
    name: asset.name || asset.fileName || fileNameFromUri(asset.uri, fallbackName),
    mimeType,
    size: info.size || 0,
    uri: asset.uri || '',
    previewUri: mimeType.startsWith('image/') ? asset.uri || '' : '',
    kind: mimeType === 'application/pdf' ? 'document' : 'image',
    dataUrl: `data:${mimeType};base64,${base64}`,
  };

  logUpload('assetToDataUrl:success', {
    name: payload.name,
    mimeType: payload.mimeType,
    size: payload.size,
    kind: payload.kind,
    dataUrlLength: payload.dataUrl.length,
  });

  return payload;
}

export async function pickDocumentAsDataUrl() {
  try {
    logUpload('document:open');
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ALLOWED_UPLOAD_TYPES,
    });

    logUpload('document:result', {
      canceled: result?.canceled,
      assetCount: result?.assets?.length || 0,
      first: result?.assets?.[0]
        ? {
          name: result.assets[0].name,
          mimeType: result.assets[0].mimeType,
          size: result.assets[0].size,
          uri: result.assets[0].uri,
        }
        : null,
    });

    if (result?.canceled) return null;
    const asset = result?.assets?.[0];
    if (!asset?.uri) {
      throw new Error('Nenhum documento valido foi retornado pelo seletor.');
    }

    return assetToDataUrl(asset, 'comprovante', 'application/octet-stream');
  } catch (error) {
    logUpload('document:error', { message: error?.message, stack: error?.stack });
    throw new Error(pickerErrorMessage(error, 'Nao foi possivel anexar o documento. Tente novamente.'));
  }
}

export async function pickDocumentsAsDataUrls(limit = 10) {
  try {
    logUpload('documents:open', { limit });
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: true,
      type: ALLOWED_UPLOAD_TYPES,
    });

    logUpload('documents:result', {
      canceled: result?.canceled,
      assetCount: result?.assets?.length || 0,
    });

    if (result?.canceled) return [];
    const assets = (result?.assets || []).slice(0, limit);
    if (!assets.length) {
      throw new Error('Nenhum documento valido foi retornado pelo seletor.');
    }

    const files = [];
    for (const asset of assets) {
      files.push(await assetToDataUrl(asset, 'comprovante', 'application/octet-stream'));
    }
    return files;
  } catch (error) {
    logUpload('documents:error', { message: error?.message, stack: error?.stack });
    throw new Error(pickerErrorMessage(error, 'Nao foi possivel anexar os documentos. Tente novamente.'));
  }
}

export async function pickImageFromCameraAsDataUrl() {
  try {
    logUpload('camera:permission:start');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    logUpload('camera:permission:result', { granted: permission?.granted, status: permission?.status });

    if (!permission?.granted) {
      throw new Error('Permissao da camera negada. Autorize o acesso nas configuracoes do aparelho para tirar a foto.');
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.65,
      base64: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    logUpload('camera:result', {
      canceled: result?.canceled,
      assetCount: result?.assets?.length || 0,
      first: result?.assets?.[0]
        ? {
          uri: result.assets[0].uri,
          mimeType: result.assets[0].mimeType,
          fileName: result.assets[0].fileName,
          fileSize: result.assets[0].fileSize,
          hasBase64: !!result.assets[0].base64,
        }
        : null,
    });

    if (result?.canceled) return null;
    return assetToDataUrl(result?.assets?.[0], `foto-${Date.now()}.jpg`, 'image/jpeg');
  } catch (error) {
    logUpload('camera:error', { message: error?.message, stack: error?.stack });
    throw new Error(pickerErrorMessage(error, 'Nao foi possivel tirar a foto. Verifique a permissao da camera.'));
  }
}

export async function pickImageFromLibraryAsDataUrl() {
  try {
    logUpload('gallery:permission:start');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    logUpload('gallery:permission:result', { granted: permission?.granted, status: permission?.status });

    if (!permission?.granted) {
      throw new Error('Permissao da galeria negada. Autorize o acesso nas configuracoes do aparelho para selecionar a imagem.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.7,
      base64: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    logUpload('gallery:result', {
      canceled: result?.canceled,
      assetCount: result?.assets?.length || 0,
      first: result?.assets?.[0]
        ? {
          uri: result.assets[0].uri,
          mimeType: result.assets[0].mimeType,
          fileName: result.assets[0].fileName,
          fileSize: result.assets[0].fileSize,
          hasBase64: !!result.assets[0].base64,
        }
        : null,
    });

    if (result?.canceled) return null;
    return assetToDataUrl(result?.assets?.[0], `imagem-${Date.now()}.jpg`, 'image/jpeg');
  } catch (error) {
    logUpload('gallery:error', { message: error?.message, stack: error?.stack });
    throw new Error(pickerErrorMessage(error, 'Nao foi possivel selecionar a imagem. Verifique a permissao da galeria.'));
  }
}
