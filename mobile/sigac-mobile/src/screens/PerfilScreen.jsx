import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, ErrorState, LargeTitle, LoadingState, PrimaryButton } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useCachedResource } from '../hooks/useCachedResource';
import { api, ApiError } from '../services/api';
import { invalidateCachedResource } from '../services/resourceCache';
import { spacing } from '../styles/theme';
import { useTheme } from '../hooks/useTheme';
import { formatHours } from '../utils/format';

export default function PerfilScreen() {
  const { token, user, signOut, expireSession, switchActiveCourse, setTwoFactorEnabled } = useAuth();
  const { colors, mode, toggleMode } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [switchingId, setSwitchingId] = useState('');
  const [updating2fa, setUpdating2fa] = useState(false);
  const loader = useCallback(() => api.cursos(token), [token]);
  const { data, loading, error, load } = useCachedResource({
    cacheKey: token ? 'student.profile' : '',
    loader,
    expireSession,
    enabled: !!token,
  });

  const courses = data?.courses || [];
  const profileUser = user || data?.user || {};
  const activeCourseId = data?.course?.id || profileUser.courseId || '';
  const twoFactorEnabled = !!profileUser.twoFactorEnabled;
  const twoFactorAvailable = !!profileUser.twoFactorAvailable;

  async function useCourse(course) {
    if (!course?.id || course.id === activeCourseId) return;
    try {
      setSwitchingId(course.id);
      await switchActiveCourse(course.id);
      invalidateCachedResource();
      await load(true);
      Alert.alert('Curso selecionado', `Agora o app esta usando ${course.sigla || course.nome || 'o curso selecionado'}.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await expireSession();
      Alert.alert('Nao foi possivel trocar o curso', err.message || 'Tente novamente em instantes.');
    } finally {
      setSwitchingId('');
    }
  }

  async function toggleTwoFactor() {
    const nextValue = !twoFactorEnabled;
    try {
      setUpdating2fa(true);
      await setTwoFactorEnabled(nextValue);
      await load(true);
      Alert.alert(
        nextValue ? '2FA ativado' : '2FA desativado',
        nextValue
          ? 'No proximo login, voce tambem precisara informar o codigo enviado por e-mail.'
          : 'O proximo login usara apenas e-mail e senha.'
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await expireSession();
      Alert.alert('Nao foi possivel alterar o 2FA', err.message || 'Tente novamente em instantes.');
    } finally {
      setUpdating2fa(false);
    }
  }

  if (loading) return <LoadingState label="Carregando perfil..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.root} contentContainerStyle={styles.container}>
      <LargeTitle title="Perfil" subtitle="Conta, curso ativo e acesso do aluno." />

      <Card accent={colors.primary} style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text selectable style={styles.avatarText}>{String(profileUser.nome || 'S').charAt(0).toUpperCase()}</Text>
        </View>
        <Text selectable style={styles.name}>{profileUser.nome || 'Aluno SIGAC'}</Text>
        <Text selectable style={styles.muted}>{profileUser.email}</Text>
        <Text selectable style={styles.muted}>Perfil: {profileUser.tipo || 'aluno'}</Text>
        {!!profileUser.matricula && <Text selectable style={styles.muted}>Matricula: {profileUser.matricula}</Text>}
      </Card>

      <Card accent={twoFactorEnabled ? colors.success : colors.primary}>
        <View style={styles.preferenceHeader}>
          <View style={[styles.themeMark, twoFactorEnabled && styles.securityMarkActive]}>
            <Text selectable style={styles.themeMarkText}>2F</Text>
          </View>
          <View style={styles.preferenceText}>
            <Text selectable style={styles.name}>Autenticacao em duas etapas</Text>
            <Text selectable style={styles.muted}>
              {twoFactorEnabled
                ? 'Ativa. O proximo login exigira codigo enviado por e-mail.'
                : 'Desativada. Ative para exigir codigo por e-mail no login.'}
            </Text>
            {!twoFactorAvailable && (
              <Text selectable style={styles.warningText}>Disponivel somente com SMTP real e TWO_FACTOR_AUTH_ENABLED=true no backend.</Text>
            )}
          </View>
        </View>
        <PrimaryButton
          title={twoFactorEnabled ? 'Desativar 2FA' : 'Ativar 2FA'}
          onPress={toggleTwoFactor}
          loading={updating2fa}
          variant={twoFactorEnabled ? 'danger' : 'ghost'}
        />
      </Card>

      <Card accent={colors.primary}>
        <View style={styles.preferenceHeader}>
          <View style={styles.themeMark}>
            <Text selectable style={styles.themeMarkText}>{mode === 'dark' ? 'E' : 'B'}</Text>
          </View>
          <View style={styles.preferenceText}>
            <Text selectable style={styles.name}>Aparencia</Text>
            <Text selectable style={styles.muted}>
              {mode === 'dark' ? 'Modo escuro ativo. Toque para voltar ao branco.' : 'Modo branco ativo. O escuro continua disponivel.'}
            </Text>
          </View>
        </View>
        <PrimaryButton
          title={mode === 'dark' ? 'Usar modo branco' : 'Usar modo escuro'}
          onPress={toggleMode}
          variant="ghost"
        />
      </Card>

      <View>
        <Text selectable style={styles.sectionTitle}>Cursos vinculados</Text>
        <Text selectable style={styles.helper}>
          {courses.length <= 1 ? 'Seu app esta usando o unico curso vinculado ao seu cadastro.' : 'Selecione o curso utilizado no painel, nas atividades e nas regras de horas.'}
        </Text>
      </View>

      {!courses.length ? (
        <Card>
          <Text selectable style={styles.muted}>Nenhum curso vinculado foi encontrado para este aluno.</Text>
        </Card>
      ) : courses.map((course) => {
        const active = course.id === activeCourseId;
        const semesterTarget = Number(course.horasMeta || course.horas_meta || data?.progress?.target || 0);
        return (
          <Card key={course.id} accent={active ? colors.success : colors.primary}>
            <View style={styles.courseHeader}>
              <View style={styles.courseIcon}>
                <Text selectable style={styles.courseInitial}>{String(course.sigla || course.nome || 'C').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.courseText}>
                <Text selectable style={styles.name}>{course.sigla} - {course.nome}</Text>
                {!!course.matricula && <Text selectable style={styles.muted}>Matricula: {course.matricula}</Text>}
                <Text selectable style={styles.muted}>Meta do semestre: {semesterTarget ? `${formatHours(semesterTarget)}` : 'não informada'}</Text>
              </View>
              {active && <Text selectable style={styles.activePill}>Ativo</Text>}
            </View>
            <PrimaryButton
              title={active ? 'Curso ativo' : 'Usar este curso'}
              onPress={() => useCourse(course)}
              loading={switchingId === course.id}
              disabled={active || courses.length <= 1}
              variant={active ? 'ghost' : 'primary'}
            />
          </Card>
        );
      })}

      <PrimaryButton title="Sair" onPress={signOut} variant="danger" />
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    root: {
      backgroundColor: colors.background,
    },
    container: {
      padding: spacing.lg,
      paddingBottom: 104,
      gap: spacing.lg,
    },
    profileCard: {
      alignItems: 'center',
    },
    sectionTitle: {
      color: colors.heading,
      fontSize: 18,
      fontWeight: '900',
    },
    helper: {
      color: colors.muted,
      marginTop: 4,
      lineHeight: 20,
    },
    avatar: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.glassStrong,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 14,
    },
    avatarText: {
      color: colors.primary,
      fontSize: 26,
      fontWeight: '900',
    },
    name: {
      color: colors.heading,
      fontSize: 17,
      fontWeight: '900',
    },
    muted: {
      color: colors.muted,
      lineHeight: 20,
    },
    warningText: {
      color: colors.warning,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 4,
      fontWeight: '700',
    },
    courseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    courseIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.glassStrong,
    },
    courseInitial: {
      color: colors.accent,
      fontWeight: '900',
      fontSize: 18,
    },
    courseText: {
      flex: 1,
      minWidth: 0,
    },
    preferenceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    preferenceText: {
      flex: 1,
      minWidth: 0,
    },
    themeMark: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.primarySoft,
    },
    securityMarkActive: {
      backgroundColor: colors.successSoft,
    },
    themeMarkText: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: '900',
    },
    activePill: {
      overflow: 'hidden',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: `${colors.success}55`,
      color: colors.success,
      backgroundColor: 'rgba(22, 163, 74, 0.08)',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
  });
}
