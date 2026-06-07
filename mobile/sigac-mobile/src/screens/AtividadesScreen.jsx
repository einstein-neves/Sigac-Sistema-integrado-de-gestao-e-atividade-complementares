import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Card, EmptyState, ErrorState, FilterChips, LargeTitle, LoadingState, PrimaryButton, StatusBadge } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useCachedResource } from '../hooks/useCachedResource';
import { api, ApiError } from '../services/api';
import { radii, spacing } from '../styles/theme';
import { useThemeColors } from '../hooks/useTheme';
import { formatDate, formatHours, latestVersion, normalizeText } from '../utils/format';

const FILTERS = [
  ['todos', 'Todas'],
  ['sem_envio', 'Sem envio'],
  ['em_analise', 'Em análise'],
  ['aprovado', 'Aprovadas'],
  ['rejeitado', 'Reprovadas'],
  ['vencidas', 'Prazo vencido'],
];

function isExpired(activity) {
  if (!activity?.prazo) return false;
  const limit = new Date(`${String(activity.prazo).slice(0, 10)}T23:59:59`);
  return !Number.isNaN(limit.getTime()) && limit < new Date();
}

export default function AtividadesScreen({ navigation }) {
  const { token, expireSession } = useAuth();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [openingId, setOpeningId] = useState('');

  const loader = useCallback(() => api.atividadesAluno(token), [token]);
  const { data, loading, refreshing, error, load } = useCachedResource({
    cacheKey: token ? 'student.activities' : '',
    loader,
    expireSession,
    enabled: !!token,
  });
  const activities = data?.activities || [];
  const categories = [...new Set(activities.map((item) => item.categoria || item.category || item.ruleCategory).filter(Boolean))];
  const categoryOptions = [['todas', 'Todas'], ...categories.map((item) => [item, item])];

  if (loading) return <LoadingState label="Carregando atividades..." />;
  if (error) return <ErrorState message={error} onRetry={() => load()} />;

  const visible = activities.filter((activity) => {
    const current = activity.submission;
    const latest = latestVersion(current);
    const status = current?.currentStatus || latest?.status || 'sem_envio';
    const expired = isExpired(activity);
    const activityCategory = activity.categoria || activity.category || activity.ruleCategory || '';
    const matchesStatus = filter === 'todos' || (filter === 'vencidas' ? expired : status === filter);
    const matchesCategory = categoryFilter === 'todas' || activityCategory === categoryFilter;
    const matchesSearch = !search || normalizeText(`${activity.titulo} ${activity.descricao} ${activityCategory}`).includes(normalizeText(search));
    return matchesStatus && matchesCategory && matchesSearch;
  });

  async function openMaterial(activity) {
    try {
      setOpeningId(activity.id);
      const uri = await api.baixarMaterialAtividade(token, activity.id, activity.materialNome || 'material');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Material baixado', `Arquivo salvo temporariamente em: ${uri}`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await expireSession();
      Alert.alert('Erro ao abrir material', err.message);
    } finally {
      setOpeningId('');
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.root}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
    >
      <LargeTitle title="Atividades complementares" subtitle="Conclua a atividade e envie o certificado ou comprovante para validar as horas." />

      <Card accent={colors.primary}>
        <Text selectable style={styles.cardTitle}>Enviar certificado de atividade complementar</Text>
        <Text selectable style={styles.description}>Use esta opcao quando voce ja concluiu uma atividade complementar e precisa anexar o certificado para analise.</Text>
        <PrimaryButton
          title="Enviar certificado"
          onPress={() => navigation.navigate('EnviarCertificado')}
        />
        <PrimaryButton
          title="Historico de envios"
          onPress={() => navigation.navigate('HistoricoEnvios')}
          variant="ghost"
        />
      </Card>

      <Card accent={colors.primary}>
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar atividade..."
          placeholderTextColor={colors.muted}
        />
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        {!!categories.length && (
          <View style={styles.filterGroup}>
            <Text selectable style={styles.filterTitle}>Categoria</Text>
            <FilterChips options={categoryOptions} value={categoryFilter} onChange={setCategoryFilter} />
          </View>
        )}
        <Text selectable style={styles.muted}>{visible.length} de {activities.length} atividades exibidas</Text>
      </Card>

      {!activities.length ? (
        <EmptyState title="Nenhuma atividade disponível" message="As atividades publicadas para seu curso aparecem aqui." />
      ) : !visible.length ? (
        <EmptyState title="Nenhuma atividade encontrada" message="Ajuste os filtros ou limpe a busca." />
      ) : visible.map((activity) => {
        const current = activity.submission;
        const latest = latestVersion(current);
        const expired = isExpired(activity);
        const currentStatus = current?.currentStatus || latest?.status || 'sem_envio';
        const canSubmit = !expired && (!current || currentStatus === 'rejeitado');
        const activityCategory = activity.categoria || activity.category || activity.ruleCategory || '';
        return (
          <Card key={activity.id} accent={expired ? colors.danger : current ? colors.secondary : colors.primary}>
            <View style={styles.cardHeader}>
              <View style={styles.activityIcon}>
                <View style={styles.activityIconLine} />
                <View style={styles.activityIconLineShort} />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text selectable style={styles.cardTitle}>{activity.titulo}</Text>
                <Text selectable style={styles.muted}>{formatHours(activity.horas)} - prazo {formatDate(activity.prazo)}</Text>
              </View>
              {expired ? <Text selectable style={styles.expiredPill}>Vencida</Text> : current && <StatusBadge status={currentStatus} />}
            </View>
            <Text selectable style={styles.description}>{activity.descricao}</Text>
            {!!activityCategory && <Text selectable style={styles.muted}>Categoria: {activityCategory}</Text>}
            {!!activity.regra && <Text selectable style={styles.muted}>Regra: {activity.regra}</Text>}
            {!!activity.observacoes && <Text selectable style={styles.muted}>Observações: {activity.observacoes}</Text>}
            {!!latest?.feedback && <Text selectable style={styles.feedback}>Feedback: {latest.feedback}</Text>}
            {expired && <Text selectable style={styles.feedback}>Prazo encerrado. O envio fica bloqueado no app para evitar rejeição automática.</Text>}
            {!!activity.materialNome && (
              <PrimaryButton
                title={`Abrir material: ${activity.materialNome}`}
                onPress={() => openMaterial(activity)}
                loading={openingId === activity.id}
                variant="ghost"
              />
            )}
            <PrimaryButton
              title={expired ? 'Prazo encerrado' : currentStatus === 'aprovado' ? 'Já aprovado' : currentStatus === 'rejeitado' ? 'Enviar nova versão' : currentStatus === 'em_analise' ? 'Aguardando análise' : 'Enviar comprovante'}
              disabled={!canSubmit}
              onPress={() => navigation.navigate('EnviarAtividade', { activity })}
            />
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
  input: {
    minHeight: 46,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.glassStrong,
    color: colors.heading,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterGroup: {
    gap: spacing.xs,
  },
  filterTitle: {
    color: colors.heading,
    fontWeight: '800',
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
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.glassStrong,
  },
  activityIconLine: {
    width: 20,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  activityIconLineShort: {
    width: 13,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  cardTitle: {
    color: colors.heading,
    fontSize: 17,
    fontWeight: '900',
  },
  description: {
    color: colors.text,
    lineHeight: 21,
  },
  muted: {
    color: colors.muted,
    lineHeight: 20,
  },
  feedback: {
    color: colors.warning,
    lineHeight: 20,
    fontWeight: '700',
  },
  expiredPill: {
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${colors.danger}55`,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  });
}
