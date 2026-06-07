import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, ApiError } from '../services/api';
import { registerPushToken } from '../services/notificationService';
import { syncQueuedSubmissions } from '../services/offlineQueue';
import { invalidateCachedResource } from '../services/resourceCache';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const TOKEN_KEY = 'sigac_mobile_token';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [temporaryPasswordSession, setTemporaryPasswordSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const isOnline = useNetworkStatus();

  const clearSession = useCallback(async () => {
    setToken(null);
    setUser(null);
    setTemporaryPasswordSession(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }, []);

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!savedToken) return;
      const payload = await api.me(savedToken);
      setToken(savedToken);
      setUser(payload?.user || null);
      registerPushToken(savedToken).catch(() => {});
    } catch (error) {
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const completeSignIn = useCallback(async (payload, email = '') => {
    if (!payload?.token) throw new Error('A API nao retornou token de acesso.');
    if (payload?.user?.tipo && payload.user.tipo !== 'aluno') {
      api.logout(payload.token).catch(() => {});
      throw new Error('Este aplicativo mobile e exclusivo para alunos. Use o SIGAC web para coordenador ou administrador.');
    }
    if (payload?.mustChangePassword || payload?.user?.mustChangePassword) {
      setTemporaryPasswordSession({
        token: payload.token,
        email,
        user: payload.user || null,
      });
      setToken(null);
      setUser(null);
      return payload;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, payload.token);
    setToken(payload.token);
    setUser(payload.user || null);
    registerPushToken(payload.token).catch(() => {});
    return payload;
  }, []);

  const signIn = useCallback(async (email, senha) => {
    const payload = await api.login(email, senha);
    if (payload?.requiresTwoFactor) return payload;
    return completeSignIn(payload, email);
  }, [completeSignIn]);

  const verifyTwoFactor = useCallback(async ({ challengeToken, code, email }) => {
    const payload = await api.verifyTwoFactor(challengeToken, code);
    return completeSignIn(payload, email);
  }, [completeSignIn]);

  const changeTemporaryPassword = useCallback(async ({ senhaAtual, novaSenha, confirmarSenha }) => {
    if (!temporaryPasswordSession?.token) {
      throw new Error('Sessao de primeiro acesso expirada. Entre novamente com a senha temporaria.');
    }
    await api.changeTemporaryPassword(temporaryPasswordSession.token, {
      senhaAtual,
      senha: novaSenha,
      confirmar: confirmarSenha,
    });
    api.logout(temporaryPasswordSession.token).catch(() => {});
    setTemporaryPasswordSession(null);
  }, [temporaryPasswordSession]);

  const cancelTemporaryPassword = useCallback(() => {
    const currentToken = temporaryPasswordSession?.token;
    setTemporaryPasswordSession(null);
    if (currentToken) api.logout(currentToken).catch(() => {});
  }, [temporaryPasswordSession]);

  const signOut = useCallback(async () => {
    const currentToken = token;
    await clearSession();
    if (currentToken) {
      api.logout(currentToken).catch(() => {});
    }
  }, [clearSession, token]);

  const expireSession = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const switchActiveCourse = useCallback(async (courseId) => {
    if (!token) throw new Error('Sessao expirada. Entre novamente.');
    const payload = await api.alternarCursoAtivo(token, courseId);
    setUser(payload?.user || null);
    invalidateCachedResource();
    return payload;
  }, [token]);

  const setTwoFactorEnabled = useCallback(async (enabled) => {
    if (!token) throw new Error('Sessao expirada. Entre novamente.');
    const payload = await api.atualizarTwoFactor(token, enabled);
    setUser(payload?.user || null);
    return payload;
  }, [token]);

  useEffect(() => {
    if (!token || !isOnline) return;
    syncQueuedSubmissions(token).catch(() => {});
  }, [isOnline, token]);

  const value = useMemo(() => ({
    token,
    user,
    loading,
    signedIn: !!token,
    temporaryPasswordSession,
    isOnline,
    signIn,
    verifyTwoFactor,
    changeTemporaryPassword,
    cancelTemporaryPassword,
    signOut,
    expireSession,
    reloadSession: loadSession,
    switchActiveCourse,
    setTwoFactorEnabled,
  }), [cancelTemporaryPassword, changeTemporaryPassword, expireSession, isOnline, loadSession, loading, signIn, signOut, switchActiveCourse, temporaryPasswordSession, token, user, verifyTwoFactor, setTwoFactorEnabled]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
