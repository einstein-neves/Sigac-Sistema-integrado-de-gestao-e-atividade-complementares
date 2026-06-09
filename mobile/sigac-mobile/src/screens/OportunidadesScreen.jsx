import React, { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, EmptyState, ErrorState, FilterChips, LargeTitle, LoadingState, PrimaryButton } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useCachedResource } from '../hooks/useCachedResource';
import { api, ApiError } from '../services/api';
import { radii, spacing } from '../styles/theme';
import { useThemeColors } from '../hooks/useTheme';
import { formatDate, formatHours, normalizeText } from '../utils/format';

const FILTERS = [
  ['todas', 'Todas'],
  ['inscritas', 'Inscritas'],
  ['disponiveis', 'Disponíveis'],
];

const SORTS = [
  ['recentes', 'Recentes'],
  ['maior_horas', 'Mais horas'],
  ['menor_horas', 'Menos horas'],
];

export default function OportunidadesScreen() {
  const { token, user, expireSession } = useAuth();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [filter, setFilter] = useState('todas');
  const [sort, setSort] = useState('recentes');
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState('');
  const [requestingId, setRequestingId] = useState('');
  const [requestForm, setRequestForm] = useState({ phone: '', availability: '', reason: '' });

  const loader = useCallback(() => api.oportunidades(token), [token]);
  const { data, setData, loading, refreshing, error, load } = useCachedResource({
    cacheKey: token ? 'student.opportunities' : '',
    loader,
    expireSession,
    enabled: !!token,
  });
  const opportunities = data?.opportunities || [];

  const summary = useMemo(() => {
    const enrolled = opportunities.filter((item) => isEnrolled(item, user?.id));
    return {
      total: opportunities.length,
      enrolled: enrolled.length,
      hours: opportunities.reduce((sum, item) => sum + Number(item.horas || 0), 0),
      enrolledHours: enrolled.reduce((sum, item) => sum + Number(item.horas || 0), 0),
    };
  }, [opportunities, user?.id]);

  const visible = useMemo(() => {
    const needle = normalizeText(search);
    return opportunities
      .filter((item) => {
        const enrolled = isEnrolled(item, user?.id);
        if (filter === 'inscritas') return enrolled;
        if (filter === 'disponiveis') return !enrolled;
        return true;
      })
      .filter((item) => !needle || normalizeText(`${item.titulo} ${item.descricao}`).includes(needle))
      .sort((a, b) => {
        if (sort === 'maior_horas') return Number(b.horas || 0) - Number(a.horas || 0);
        if (sort === 'menor_horas') return Number(a.horas || 0) - Number(b.horas || 0);
        return new Date(b.criadoEm || b.createdAt || 0) - new Date(a.criadoEm || a.createdAt || 0);
      });
  }, [filter, opportunities, search, sort, user?.id]);

  function openRequestForm(opportunity) {
    setRequestingId((current) => current === opportunity.id ? '' : opportunity.id);
    setRequestForm({ phone: '', availability: '', reason: '' });
  }

  function validateRequestForm() {
    const phone = requestForm.phone.trim();
    const availability = requestForm.availability.trim();
    const reason = requestForm.reason.trim();
    if (phone.length < 8) return 'Informe um telefone de contato valido.';
    if (availability.length < 4) return 'Informe sua disponibilidade para participar.';
    if (reason.length < 12) return 'Explique brevemente por que deseja participar.';
    return '';
  }

  async function toggle(opportunity, requestPayload = null) {
    try {
      setTogglingId(opportunity.id);
      const payload = await api.alternarOportunidade(token, opportunity.id, requestPayload);
      const updated = payload?.opportunity;
      setData({
        opportunities: opportunities.map((item) => item.id === opportunity.id ? (updated || item) : item),
      });
      setRequestingId('');
      setRequestForm({ phone: '', availability: '', reason: '' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await expireSession();
      Alert.alert('Erro na oportunidade', err.message);
    } finally {
      setTogglingId('');
    }
  }

  async function submitRequest(opportunity) {
    const message = validateRequestForm();
    if (message) {
      Alert.alert('Revise a solicitacao', message);
      return;
    }

    await toggle(opportunity, {
      phone: requestForm.phone.trim(),
      availability: requestForm.availability.trim(),
      reason: requestForm.reason.trim(),
    });
  }

  if (loading) return <LoadingState label="Carregando oportunidades..." />;
  if (error) return <ErrorState message={error} onRetry={() => load()} />;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.root}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
    >
      <LargeTitle title="Oportunidades" subtitle="Eventos e ações que podem contar como horas complementares." />

      <View style={styles.grid}>
        <Metric label="Disponíveis" value={summary.total} accent={colors.primary} />
        <Metric label="Inscritas" value={summary.enrolled} accent={colors.success} />
        <Metric label="Horas possíveis" value={formatHours(summary.hours)} accent={colors.secondary} />
        <Metric label="Horas inscritas" value={formatHours(summary.enrolledHours)} accent={colors.primary} />
      </View>

      <Card accent={colors.warning}>
        <Text selectable style={styles.warningText}>Inscrição em oportunidade não aprova horas automaticamente. As horas só contam no progresso depois de validação do SIGAC.</Text>
      </Card>

      <Card accent={colors.primary}>
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar oportunidade..."
          placeholderTextColor={colors.muted}
        />
        <Text selectable style={styles.filterTitle}>Status</Text>
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        <Text selectable style={styles.filterTitle}>Ordenação</Text>
        <FilterChips options={SORTS} value={sort} onChange={setSort} />
        <Text selectable style={styles.muted}>{visible.length} de {opportunities.length} oportunidades exibidas</Text>
      </Card>

      {!visible.length ? (
        <EmptyState title="Nenhuma oportunidade encontrada" message="Ajuste os filtros ou volte mais tarde." />
      ) : visible.map((opportunity) => {
        const enrolled = isEnrolled(opportunity, user?.id);
        return (
          <Card key={opportunity.id} accent={enrolled ? colors.success : colors.primary}>
            <View style={styles.cardHeader}>
              <View style={styles.opportunityIcon}>
                <View style={styles.handle} />
                <View style={styles.caseLine} />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text selectable style={styles.cardTitle}>{opportunity.titulo}</Text>
                <Text selectable style={styles.hours}>{formatHours(opportunity.horas)} complementares</Text>
              </View>
              <Text selectable style={[styles.status, enrolled && styles.statusActive]}>
                {enrolled ? 'Inscrito' : 'Disponível'}
              </Text>
            </View>
            <Text selectable style={styles.description}>{opportunity.descricao}</Text>
            <Text selectable style={styles.muted}>Publicado em {formatDate(opportunity.criadoEm || opportunity.createdAt)}</Text>
            <PrimaryButton
              title={enrolled ? 'Desinscrever' : requestingId === opportunity.id ? 'Fechar solicitacao' : 'Solicitar inscricao'}
              onPress={() => enrolled ? toggle(opportunity) : openRequestForm(opportunity)}
              loading={togglingId === opportunity.id}
              variant={enrolled ? 'ghost' : 'primary'}
            />
            {!enrolled && requestingId === opportunity.id && (
              <View style={styles.requestForm}>
                <Text selectable style={styles.formTitle}>Solicitacao de inscricao</Text>
                <Text selectable style={styles.muted}>Preencha os dados para enviar sua solicitacao. A inscricao so sera registrada apos o envio.</Text>
                <Text selectable style={styles.fieldLabel}>Telefone de contato</Text>
                <TextInput
                  style={styles.input}
                  value={requestForm.phone}
                  onChangeText={(phone) => setRequestForm((current) => ({ ...current, phone }))}
                  keyboardType="phone-pad"
                  placeholder="Ex.: (11) 99999-9999"
                  placeholderTextColor={colors.muted}
                />
                <Text selectable style={styles.fieldLabel}>Disponibilidade</Text>
                <TextInput
                  style={styles.input}
                  value={requestForm.availability}
                  onChangeText={(availability) => setRequestForm((current) => ({ ...current, availability }))}
                  placeholder="Ex.: Noite, finais de semana"
                  placeholderTextColor={colors.muted}
                />
                <Text selectable style={styles.fieldLabel}>Justificativa</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={requestForm.reason}
                  onChangeText={(reason) => setRequestForm((current) => ({ ...current, reason }))}
                  multiline
                  placeholder="Explique seu interesse na oportunidade"
                  placeholderTextColor={colors.muted}
                />
                <PrimaryButton
                  title="Enviar solicitacao"
                  onPress={() => submitRequest(opportunity)}
                  loading={togglingId === opportunity.id}
                />
              </View>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}

function isEnrolled(opportunity, userId) {
  return (opportunity?.inscritos || []).includes(userId);
}

function Metric({ label, value, accent }) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <Card style={styles.metric} accent={accent}>
      <Text selectable style={[styles.metricValue, { color: accent || colors.heading }]}>{value}</Text>
      <Text selectable style={styles.muted}>{label}</Text>
    </Card>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metric: {
    flexGrow: 1,
    flexBasis: '42%',
    minWidth: 135,
    paddingVertical: spacing.md,
  },
  metricValue: {
    color: colors.heading,
    fontSize: 21,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
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
  opportunityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.glassStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 14,
    height: 7,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: colors.accent,
  },
  caseLine: {
    width: 24,
    height: 17,
    borderRadius: 5,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  hours: {
    color: colors.primary,
    fontWeight: '900',
  },
  status: {
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${colors.warning}55`,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  statusActive: {
    borderColor: `${colors.success}55`,
    color: colors.success,
    backgroundColor: colors.successSoft,
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
  warningText: {
    color: colors.warning,
    lineHeight: 20,
    fontWeight: '800',
  },
  requestForm: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.md,
  },
  formTitle: {
    color: colors.heading,
    fontSize: 16,
    fontWeight: '900',
  },
  fieldLabel: {
    color: colors.heading,
    fontWeight: '800',
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  });
}
