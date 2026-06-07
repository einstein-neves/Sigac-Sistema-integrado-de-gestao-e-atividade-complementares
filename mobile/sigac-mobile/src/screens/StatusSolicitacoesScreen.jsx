import React, { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Card, EmptyState, ErrorState, LargeTitle, LoadingState, PrimaryButton, StatusBadge } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useCachedResource } from '../hooks/useCachedResource';
import { api, ApiError } from '../services/api';
import { spacing } from '../styles/theme';
import { useThemeColors } from '../hooks/useTheme';
import { formatDate, formatHours, latestVersion } from '../utils/format';

export default function StatusSolicitacoesScreen({ navigation }) {
  const { token, expireSession, isOnline } = useAuth();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [openingId, setOpeningId] = useState('');
  const loader = useCallback(() => api.dashboardAluno(token), [token]);
  const { data, loading, refreshing, error, load } = useCachedResource({
    cacheKey: token ? 'student.status' : '',
    loader,
    expireSession,
    enabled: !!token,
  });

  const submissions = useMemo(() => {
    return (data?.submissions || []).slice().sort((a, b) => {
      const latestA = latestVersion(a);
      const latestB = latestVersion(b);
      return new Date(latestB?.enviadaEm || 0) - new Date(latestA?.enviadaEm || 0);
    });
  }, [data?.submissions]);

  async function openProof(submission) {
    const latest = latestVersion(submission);
    if (!latest?.arquivoNome) {
      Alert.alert('Comprovante indisponível', 'Esta solicitação não possui arquivo associado.');
      return;
    }

    try {
      setOpeningId(submission.id);
      const uri = await api.baixarComprovante(token, submission.id, latest.arquivoNome);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Comprovante baixado', `Arquivo salvo temporariamente em: ${uri}`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await expireSession();
      Alert.alert('Erro ao abrir comprovante', err.message);
    } finally {
      setOpeningId('');
    }
  }

  if (loading) return <LoadingState label="Carregando solicitações..." />;
  if (error) return <ErrorState message={error} onRetry={() => load()} />;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.root}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
    >
      {!isOnline && (
        <Card accent={colors.warning}>
          <Text selectable style={styles.feedback}>Você está offline. Os dados exibidos podem estar desatualizados.</Text>
        </Card>
      )}

      <LargeTitle title="Status" subtitle={data?.course?.nome || 'Curso ativo não informado'} />

      {!submissions.length ? (
        <EmptyState title="Nenhuma solicitação encontrada" message="Envie uma atividade ou certificado para acompanhar a análise por aqui." />
      ) : submissions.map((submission) => {
        const latest = latestVersion(submission);
        const currentStatus = submission.currentStatus || latest?.status;
        const title = submission.activity?.titulo || latest?.descricao || submission.activityId;
        const canEdit = ['pendente', 'rejeitado'].includes(currentStatus);
        return (
          <Card key={submission.id} accent={currentStatus === 'rejeitado' ? colors.danger : colors.primary}>
            <View style={styles.cardHeader}>
              <View style={styles.statusIcon}>
                <View style={styles.statusIconDot} />
                <View style={styles.statusIconLine} />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text selectable style={styles.cardTitle}>{title}</Text>
                <Text selectable style={styles.muted}>Enviado em {formatDate(latest?.enviadaEm)}</Text>
              </View>
              <StatusBadge status={currentStatus} />
            </View>
            <Text selectable style={styles.text}>Categoria: {latest?.categoria || 'Não informada'}</Text>
            <Text selectable style={styles.text}>Carga horária: {formatHours(latest?.horasDeclaradas)}</Text>
            {!!latest?.descricao && <Text selectable style={styles.description}>{latest.descricao}</Text>}
            {!!latest?.observacao && <Text selectable style={styles.muted}>Observação: {latest.observacao}</Text>}
            {!!latest?.feedback && <Text selectable style={styles.feedback}>Feedback da coordenação: {latest.feedback}</Text>}

            <PrimaryButton
              title="Ver detalhes"
              onPress={() => Alert.alert(title, [
                `Categoria: ${latest?.categoria || 'Não informada'}`,
                `Carga horária: ${formatHours(latest?.horasDeclaradas)}`,
                `Status: ${currentStatus || 'não informado'}`,
                latest?.feedback ? `Feedback: ${latest.feedback}` : '',
              ].filter(Boolean).join('\n'))}
              variant="ghost"
            />
            {canEdit ? (
              <PrimaryButton
                title={currentStatus === 'rejeitado' ? 'Corrigir e reenviar' : 'Editar envio'}
                onPress={() => navigation.navigate('Atividades', {
                  screen: 'EnviarAtividade',
                  params: { activity: submission.activity, submission },
                })}
              />
            ) : (
              <Text selectable style={styles.muted}>Edição disponível apenas para solicitações pendentes ou rejeitadas.</Text>
            )}
            {!!latest?.arquivoNome && (
              <PrimaryButton
                title={`Abrir comprovante: ${latest.arquivoNome}`}
                onPress={() => openProof(submission)}
                loading={openingId === submission.id}
                variant="ghost"
              />
            )}
          </Card>
        );
      })}
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.glassStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statusIconDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  statusIconLine: {
    width: 18,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  cardTitle: {
    color: colors.heading,
    fontSize: 17,
    fontWeight: '900',
  },
  text: {
    color: colors.text,
    lineHeight: 21,
  },
  description: {
    color: colors.text,
    lineHeight: 21,
  },
  feedback: {
    color: colors.warning,
    lineHeight: 20,
    fontWeight: '700',
  },
  muted: {
    color: colors.muted,
    lineHeight: 20,
  },
  });
}
