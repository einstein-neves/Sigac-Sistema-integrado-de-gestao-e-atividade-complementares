import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../services/api';
import { getCachedResource, getPersistedResource, invalidateCachedResource, setCachedResource } from '../services/resourceCache';

export function useCachedResource({ cacheKey, loader, expireSession, enabled = true }) {
  const cached = cacheKey ? getCachedResource(cacheKey) : null;
  const [data, setDataState] = useState(cached?.value ?? null);
  const [loading, setLoading] = useState(enabled && !cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);

  const setData = useCallback((value) => {
    setDataState(value);
    if (cacheKey) setCachedResource(cacheKey, value);
  }, [cacheKey]);

  const load = useCallback(async (isRefresh = false) => {
    if (!enabled) return null;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const payload = await loader();
      setData(payload);
      setStale(false);
      return payload;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && expireSession) {
        await expireSession();
      }
      const persisted = cacheKey ? await getPersistedResource(cacheKey) : null;
      if (persisted?.value) {
        setDataState(persisted.value);
        setStale(true);
        setError(err.status === 0 ? 'Você está offline. Algumas informações podem estar desatualizadas.' : '');
      } else {
        setError(err.message || 'Não foi possível carregar os dados.');
      }
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enabled, expireSession, loader, setData]);

  const invalidate = useCallback(() => {
    if (cacheKey) invalidateCachedResource(cacheKey);
  }, [cacheKey]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    async function hydrate() {
      const persisted = cacheKey ? await getPersistedResource(cacheKey) : null;
      if (!alive) return;
      if (persisted?.value && !cached) {
        setDataState(persisted.value);
        setLoading(false);
        setStale(true);
      }
      if (!cached) load();
    }
    hydrate();
    return () => {
      alive = false;
    };
  }, [cacheKey, cached, enabled, load]);

  return {
    data,
    setData,
    loading,
    refreshing,
    error,
    stale,
    load,
    invalidate,
  };
}
