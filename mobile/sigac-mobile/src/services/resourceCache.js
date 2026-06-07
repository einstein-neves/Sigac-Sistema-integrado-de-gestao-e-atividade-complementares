import AsyncStorage from '@react-native-async-storage/async-storage';

const cache = new Map();
const STORAGE_PREFIX = 'sigac.resource.';

export function getCachedResource(key) {
  return cache.get(key);
}

export function setCachedResource(key, value) {
  const entry = {
    value,
    updatedAt: Date.now(),
  };
  cache.set(key, entry);
  AsyncStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry)).catch(() => {});
  return entry;
}

export async function getPersistedResource(key) {
  if (!key) return null;
  const memory = getCachedResource(key);
  if (memory) return memory;

  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('value' in parsed)) return null;
    cache.set(key, parsed);
    return parsed;
  } catch (_) {
    return null;
  }
}

export function invalidateCachedResource(key) {
  if (!key) {
    cache.clear();
    AsyncStorage.getAllKeys()
      .then((keys) => AsyncStorage.multiRemove(keys.filter((item) => item.startsWith(STORAGE_PREFIX))))
      .catch(() => {});
    return;
  }
  cache.delete(key);
  AsyncStorage.removeItem(`${STORAGE_PREFIX}${key}`).catch(() => {});
}
