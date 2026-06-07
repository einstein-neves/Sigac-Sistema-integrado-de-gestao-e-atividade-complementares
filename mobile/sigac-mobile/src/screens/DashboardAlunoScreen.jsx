import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ErrorState, LoadingState, PrimaryButton, StatusBadge } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useCachedResource } from '../hooks/useCachedResource';
import { api } from '../services/api';
import { spacing } from '../styles/theme';
import { useThemeColors } from '../hooks/useTheme';
import { formatDate, formatHours, formatPercent, latestVersion, percentValue } from '../utils/format';

function getLiquid(colors) {
  return {
    blue: colors.primary,
    green: colors.success,
    orange: colors.warning,
    red: colors.danger,
    ink: colors.heading,
  };
}

export default function DashboardAlunoScreen({ navigation }) {
  const { token, expireSession, isOnline } = useAuth();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const liquid = React.useMemo(() => getLiquid(colors), [colors]);
  const loader = useCallback(() => api.dashboardAluno(token), [token]);
  const { data, loading, refreshing, error, load } = useCachedResource({
    cacheKey: token ? 'student.dashboard' : '',
    loader,
    expireSession,
    enabled: !!token,
  });

  const counters = useMemo(() => {
    const submissions = data?.submissions || [];
    const certificates = data?.certificates || [];
    const base = submissions.reduce((acc, item) => {
      const latest = latestVersion(item);
      const status = item.currentStatus || latest?.status;
      const hours = Number(latest?.horasDeclaradas || 0);
      if (status === 'aprovado') {
        acc.aprovadas += 1;
        acc.approvedHours += hours;
      }
      else if (status === 'rejeitado') {
        acc.rejeitadas += 1;
        acc.rejectedHours += hours;
      } else {
        acc.pendentes += 1;
        acc.pendingHours += hours;
      }
      return acc;
    }, { pendentes: 0, aprovadas: 0, rejeitadas: 0, pendingHours: 0, approvedHours: 0, rejectedHours: 0 });

    const certificateHoursByRequest = new Map();
    certificates.forEach((item) => {
      const key = item.batchId || item.id;
      const current = certificateHoursByRequest.get(key) || { status: item.adminStatus, hours: 0 };
      current.status = current.status === 'aprovado' ? current.status : item.adminStatus;
      current.hours = Math.max(current.hours, Number(item.approvedHours || item.declaredHours || 0));
      certificateHoursByRequest.set(key, current);
    });

    certificateHoursByRequest.forEach(({ status, hours }) => {
      if (status === 'aprovado') {
        base.aprovadas += 1;
        base.approvedHours += hours;
      } else if (status === 'rejeitado') {
        base.rejeitadas += 1;
        base.rejectedHours += hours;
      } else {
        base.pendentes += 1;
        base.pendingHours += hours;
      }
    });

    return base;
  }, [data]);

  if (loading) return <LoadingState label="Carregando resumo do aluno..." />;
  if (error) return <ErrorState message={error} onRetry={() => load()} />;

  const progress = data?.progress || {};
  const categoryProgress = data?.categoryProgress || [];
  const submissions = data?.submissions || [];
  const certificates = data?.certificates || [];
  const recentComplementary = [
    ...submissions.map((item) => {
      const latest = latestVersion(item);
      return {
        key: `submission-${item.id}`,
        status: item.currentStatus || latest?.status,
        title: latest?.descricao || item.activity?.titulo || item.activityId || 'Atividade complementar',
        detail: `${formatHours(latest?.horasDeclaradas)} - comprovante enviado em ${formatDate(latest?.enviadaEm)}`,
        date: latest?.enviadaEm || '',
        accent: liquid.blue,
      };
    }),
    ...certificates.map((item) => ({
      key: `certificate-${item.id}`,
      status: item.adminStatus,
      title: item.detectedTitle || item.fileName || 'Atividade complementar certificada',
      detail: `${formatHours(item.declaredHours || item.approvedHours)} - certificado enviado em ${formatDate(item.createdAt)}`,
      date: item.createdAt || '',
      accent: liquid.orange,
    })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 5);
  const percent = percentValue(progress.percent);
  const remainingHours = Math.max(0, Number(progress.target || 0) - Number(progress.total || 0));
  const complementaryApprovedHours = Number(progress.approvedHours || 0) + Number(progress.certificateHours || 0);

  return (
    <View style={styles.root}>
      <LiquidBackdrop />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={liquid.blue} />}
      >
        {!isOnline && (
          <LiquidCard accent={liquid.orange}>
            <Text selectable style={styles.warningText}>Você está offline. Algumas informações podem estar desatualizadas.</Text>
          </LiquidCard>
        )}

        <CourseHero
          user={data?.user}
          course={data?.course}
          courses={data?.courses}
          onPress={() => navigation.navigate('Perfil')}
        />

        <LiquidCard style={styles.progressCard} accent={liquid.blue}>
          <View style={styles.progressLayout}>
            <ProgressRing percent={percent} />
            <View style={styles.progressInfo}>
              <Text selectable style={styles.progressLabel}>Progresso geral</Text>
              <Text selectable style={styles.progressHours}>{formatHours(progress.total)} de {formatHours(progress.target)} concluidas</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, styles.progressFillMain, { width: `${Math.min(100, percent)}%` }]} />
              </View>
              <View style={styles.remainingInline}>
                <MetricGlyph name="target" color={liquid.blue} compact />
                <Text selectable style={styles.remainingText}>{formatHours(remainingHours)} restantes</Text>
              </View>
            </View>
          </View>
        </LiquidCard>

        <View style={styles.grid}>
          <Metric icon="flag" label="Meta do semestre" value={formatHours(progress.target)} accent={liquid.blue} />
          <Metric icon="clock" label="Total concluídas" value={formatHours(progress.total)} accent={liquid.green} />
          <Metric icon="check" label="Validadas" value={formatHours(complementaryApprovedHours)} accent={liquid.green} />
          <Metric icon="pending" label="Pendentes" value={formatHours(counters.pendingHours)} accent={liquid.orange} />
          <Metric icon="x" label="Rejeitadas" value={formatHours(counters.rejectedHours)} accent={liquid.red} />
          <Metric icon="briefcase" label="Oportunidades" value={formatHours(progress.opportunityHours)} accent={liquid.blue} />
        </View>

        <Text selectable style={styles.sectionTitle}>Atividades complementares</Text>
        <View style={styles.pathGrid}>
          <LiquidCard style={styles.pathCard} accent={liquid.blue}>
            <MetricGlyph name="checklist" color={liquid.blue} />
            <Text selectable style={styles.cardTitle}>Atividades do curso</Text>
            <Text selectable style={styles.muted}>Consulte atividades complementares publicadas e envie o comprovante ou certificado correspondente.</Text>
            <PrimaryButton title="Ver atividades complementares" onPress={() => navigation.navigate('Atividades', { screen: 'AtividadesLista' })} compact />
          </LiquidCard>
          <LiquidCard style={styles.pathCard} accent={liquid.orange}>
            <MetricGlyph name="certificate" color={liquid.orange} />
            <Text selectable style={styles.cardTitle}>Enviar certificado</Text>
            <Text selectable style={styles.muted}>Use quando a atividade complementar ja foi concluida e voce precisa anexar o certificado para validar horas.</Text>
            <PrimaryButton title="Enviar certificado" onPress={() => navigation.navigate('Atividades', { screen: 'EnviarCertificado' })} compact />
          </LiquidCard>
        </View>

        <Text selectable style={styles.sectionTitle}>Progresso por categoria</Text>
        {categoryProgress.length ? categoryProgress.map((item) => (
          <CategoryCard key={item.id || item.categoria} item={item} />
        )) : (
          <DashboardEmpty
            title="Categorias ainda nao configuradas"
            message="Quando o curso possuir regras de horas por categoria, o acompanhamento detalhado aparecera aqui."
          />
        )}

        <Text selectable style={styles.sectionTitle}>Envios recentes</Text>
        {recentComplementary.length ? recentComplementary.map((item) => (
          <LiquidCard key={item.key} accent={item.accent}>
            <StatusBadge status={item.status} />
            <Text selectable style={styles.cardTitle}>{item.title}</Text>
            <Text selectable style={styles.muted}>{item.detail}</Text>
          </LiquidCard>
        )) : (
          <DashboardEmpty title="Nenhuma atividade complementar enviada" message="Envie um comprovante ou certificado em Atividades Complementares para acompanhar a analise por aqui." />
        )}
      </ScrollView>
    </View>
  );
}

function CourseHero({ user, course, courses, onPress }) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const firstName = String(user?.nome || 'Aluno').trim().split(/\s+/)[0];
  const matricula = user?.matriculaAtiva || user?.matricula || course?.matricula || '';
  const canSwitch = Array.isArray(courses) && courses.length > 1;

  return (
    <View style={styles.courseHero}>
      <Text selectable style={styles.courseGreeting}>Olá, {firstName}</Text>
      {!!matricula && <Text selectable style={styles.courseMatricula}>Matrícula: {matricula}</Text>}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={canSwitch ? 'Trocar curso ativo' : 'Ver curso ativo'}
        style={({ pressed }) => [styles.courseSelector, pressed && styles.courseSelectorPressed]}
      >
        <View style={styles.courseSelectorCopy}>
          <Text selectable style={styles.courseSelectorLabel}>Curso ativo</Text>
          <Text selectable numberOfLines={2} style={styles.courseSelectorName}>{course?.nome || course?.sigla || 'Curso não informado'}</Text>
        </View>
        <Text style={styles.courseSelectorAction}>{canSwitch ? 'Trocar' : 'Ver'}</Text>
      </Pressable>
    </View>
  );
}

function LiquidBackdrop() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.bgBase} />
    </View>
  );
}

function LiquidCard({ children, style, accent }) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const activeAccent = accent || colors.primary;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 360,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <Animated.View
      style={[
        styles.liquidCard,
        { borderColor: colors.borderSubtle, borderLeftColor: `${activeAccent}66`, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

function ProgressRing({ percent }) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const liquid = React.useMemo(() => getLiquid(colors), [colors]);
  const fade = useRef(new Animated.Value(0)).current;
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const segments = 48;
  const activeSegments = Math.round((clamped / 100) * segments);
  const ringSegments = useMemo(() => {
    const center = 52;
    const radius = 45;
    const width = 3;
    const height = 10;
    return Array.from({ length: segments }, (_, index) => {
      const angle = -90 + (index * 360) / segments;
      const radians = (angle * Math.PI) / 180;
      return {
        angle,
        left: center + radius * Math.cos(radians) - width / 2,
        top: center + radius * Math.sin(radians) - height / 2,
      };
    });
  }, []);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <Animated.View style={[styles.progressRing, { opacity: fade }]}>
      {ringSegments.map((segment, index) => {
        const active = index < activeSegments;
        return (
          <View
            key={index}
            style={[
              styles.ringSegment,
              {
                left: segment.left,
                top: segment.top,
                backgroundColor: active ? liquid.orange : colors.borderSubtle,
                opacity: active ? 1 : 0.55,
                transform: [{ rotate: `${segment.angle + 90}deg` }],
              },
            ]}
          />
        );
      })}
      <View style={styles.progressRingInner}>
        <Text selectable style={styles.progressValue}>{formatPercent(clamped)}</Text>
      </View>
    </Animated.View>
  );
}

function Metric({ icon, label, value, accent, compact }) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const liquid = React.useMemo(() => getLiquid(colors), [colors]);
  return (
    <LiquidCard style={[styles.metric, compact && styles.metricCompact]} accent={accent}>
      <MetricGlyph name={icon} color={accent || liquid.blue} />
      <View style={styles.metricCopy}>
        <Text selectable style={[styles.metricValue, compact && styles.metricValueCompact, { color: accent || liquid.ink }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        <Text selectable style={styles.metricLabel} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
      </View>
    </LiquidCard>
  );
}

function DashboardEmpty({ title, message }) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const liquid = React.useMemo(() => getLiquid(colors), [colors]);
  return (
    <LiquidCard accent={liquid.blue} style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <View style={styles.emptyIconLine} />
      </View>
      <Text selectable style={styles.emptyTitle}>{title}</Text>
      {!!message && <Text selectable style={styles.emptyMessage}>{message}</Text>}
    </LiquidCard>
  );
}

function MetricGlyph({ name, color, compact }) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.iconOrb, compact && styles.iconOrbCompact, { borderColor: `${color}35`, backgroundColor: `${color}12` }]}>
      {name === 'check' && <View style={styles.checkIcon}><View style={[styles.checkShort, { backgroundColor: color }]} /><View style={[styles.checkLong, { backgroundColor: color }]} /></View>}
      {name === 'x' && <View style={styles.xIcon}><View style={[styles.xLine, { backgroundColor: color }]} /><View style={[styles.xLine, styles.xLineAlt, { backgroundColor: color }]} /></View>}
      {(name === 'clock' || name === 'pending') && <View style={[styles.outlineCircle, { borderColor: color }]}><View style={[styles.clockHandTall, { backgroundColor: color }]} /><View style={[styles.clockHandShort, { backgroundColor: color }]} /></View>}
      {name === 'flag' && <View style={styles.flagIcon}><View style={[styles.flagPole, { backgroundColor: color }]} /><View style={[styles.flagSheet, { borderColor: color }]} /></View>}
      {name === 'briefcase' && <View style={[styles.briefcase, { borderColor: color }]}><View style={[styles.briefcaseHandle, { borderColor: color }]} /></View>}
      {name === 'document' && <View style={[styles.document, { borderColor: color }]}><View style={[styles.documentLine, { backgroundColor: color }]} /><View style={[styles.documentLineShort, { backgroundColor: color }]} /></View>}
      {name === 'hourglass' && <View style={[styles.hourglass, { borderColor: color }]}><View style={[styles.hourglassLine, { backgroundColor: color }]} /></View>}
      {name === 'award' && <View style={[styles.awardMedal, { borderColor: color }]}><View style={[styles.awardCore, { backgroundColor: color }]} /></View>}
      {name === 'target' && <View style={[styles.targetOuter, { borderColor: color }]}><View style={[styles.targetInner, { borderColor: color }]} /></View>}
      {name === 'checklist' && <View style={[styles.document, { borderColor: color }]}><View style={[styles.documentLine, { backgroundColor: color }]} /><View style={[styles.documentLine, { backgroundColor: color }]} /><View style={[styles.documentLineShort, { backgroundColor: color }]} /></View>}
      {name === 'certificate' && <View style={[styles.certificateIcon, { borderColor: color }]}><View style={[styles.certificateSeal, { backgroundColor: color }]} /></View>}
    </View>
  );
}

function CategoryCard({ item }) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const liquid = React.useMemo(() => getLiquid(colors), [colors]);
  const limit = Number(item.limiteMaximo || 0);
  const approved = Number(item.approvedHours || 0);
  const percent = limit > 0 ? percentValue(item.percent || ((approved / limit) * 100)) : 0;

  return (
    <LiquidCard accent={item.completed ? liquid.green : liquid.blue}>
      <View style={styles.categoryHeader}>
        <View style={styles.categoryTitleWrap}>
          <Text selectable style={styles.cardTitle}>{item.categoria}</Text>
          <Text selectable style={styles.muted}>
            {formatHours(approved)} aprovadas{limit ? ` de ${formatHours(limit)}` : ''}
          </Text>
        </View>
        <Text selectable style={[styles.categoryPercent, item.completed && styles.categoryPercentDone]}>{formatPercent(percent)}</Text>
      </View>
      {!!item.descricao && <Text selectable style={styles.muted}>{item.descricao}</Text>}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, item.completed && styles.progressFillDone, { width: `${percent}%` }]} />
      </View>
      <View style={styles.categoryMeta}>
        <Text selectable style={styles.muted}>Pendentes: {formatHours(item.pendingHours)}</Text>
        <Text selectable style={styles.muted}>Rejeitadas: {formatHours(item.rejectedHours)}</Text>
      </View>
      {item.completed && <Text selectable style={styles.successText}>Limite da categoria atingido.</Text>}
    </LiquidCard>
  );
}

function createStyles(colors) {
  const liquid = getLiquid(colors);
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: 126,
    gap: 14,
  },
  warningText: {
    color: liquid.orange,
    fontWeight: '800',
    lineHeight: 20,
  },
  courseHero: {
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.lg,
    marginBottom: 2,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: 4,
    backgroundColor: colors.primaryDark,
  },
  courseGreeting: {
    color: colors.white,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
  },
  courseMatricula: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
  },
  courseSelector: {
    marginTop: spacing.sm,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  courseSelectorPressed: {
    opacity: 0.86,
  },
  courseSelectorCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  courseSelectorLabel: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  courseSelectorName: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  courseSelectorAction: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  liquidCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 1,
    backgroundColor: colors.surfaceSoft,
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 1,
  },
  progressCard: {
    padding: 15,
  },
  progressLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  progressRing: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSegment: {
    position: 'absolute',
    width: 3,
    height: 10,
    borderRadius: 999,
  },
  progressRingInner: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  progressValue: {
    color: liquid.blue,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  progressInfo: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  progressLabel: {
    color: liquid.ink,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  progressHours: {
    color: colors.mutedStrong,
    lineHeight: 19,
    fontWeight: '700',
  },
  remainingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  remainingText: {
    color: liquid.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.08)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: liquid.blue,
  },
  progressFillMain: {
    backgroundColor: liquid.orange,
  },
  progressFillDone: {
    backgroundColor: liquid.green,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pathGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pathCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 142,
  },
  metric: {
    minHeight: 96,
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 134,
    paddingVertical: 13,
    alignItems: 'flex-start',
  },
  metricCompact: {
    flexGrow: 1,
    flexBasis: '31%',
    minWidth: 0,
    minHeight: 88,
  },
  metricCopy: {
    width: '100%',
    minWidth: 0,
    gap: 2,
  },
  metricValue: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  metricValueCompact: {
    fontSize: 20,
  },
  metricLabel: {
    color: colors.mutedStrong,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  emptyCard: {
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.glassSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconLine: {
    width: 20,
    height: 3,
    borderRadius: 999,
    backgroundColor: liquid.blue,
  },
  emptyTitle: {
    color: liquid.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyMessage: {
    color: colors.mutedStrong,
    lineHeight: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    color: liquid.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    marginTop: 2,
  },
  cardTitle: {
    color: liquid.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  categoryTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  categoryPercent: {
    color: liquid.blue,
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  categoryPercentDone: {
    color: liquid.green,
  },
  categoryMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  successText: {
    color: liquid.green,
    fontWeight: '800',
  },
  muted: {
    color: colors.mutedStrong,
    lineHeight: 20,
  },
  iconOrb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 5,
  },
  iconOrbCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: 0,
  },
  outlineCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockHandTall: {
    position: 'absolute',
    width: 2,
    height: 7,
    borderRadius: 2,
    top: 5,
  },
  clockHandShort: {
    position: 'absolute',
    width: 7,
    height: 2,
    borderRadius: 2,
    right: 5,
    top: 10,
  },
  checkIcon: {
    width: 22,
    height: 18,
  },
  checkShort: {
    position: 'absolute',
    width: 8,
    height: 3,
    borderRadius: 2,
    left: 2,
    top: 10,
    transform: [{ rotate: '42deg' }],
  },
  checkLong: {
    position: 'absolute',
    width: 16,
    height: 3,
    borderRadius: 2,
    right: 0,
    top: 8,
    transform: [{ rotate: '-45deg' }],
  },
  xIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xLine: {
    position: 'absolute',
    width: 19,
    height: 3,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  xLineAlt: {
    transform: [{ rotate: '-45deg' }],
  },
  flagIcon: {
    width: 22,
    height: 25,
  },
  flagPole: {
    position: 'absolute',
    left: 3,
    top: 2,
    width: 3,
    height: 22,
    borderRadius: 2,
  },
  flagSheet: {
    position: 'absolute',
    left: 6,
    top: 3,
    width: 15,
    height: 11,
    borderWidth: 2,
    borderLeftWidth: 0,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
  },
  briefcase: {
    width: 24,
    height: 18,
    borderRadius: 6,
    borderWidth: 2,
  },
  briefcaseHandle: {
    position: 'absolute',
    top: -7,
    alignSelf: 'center',
    width: 12,
    height: 7,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderWidth: 2,
    borderBottomWidth: 0,
  },
  document: {
    width: 21,
    height: 26,
    borderRadius: 5,
    borderWidth: 2,
    paddingTop: 8,
    paddingHorizontal: 4,
    gap: 4,
  },
  documentLine: {
    height: 2,
    borderRadius: 2,
  },
  documentLineShort: {
    width: 8,
    height: 2,
    borderRadius: 2,
  },
  certificateIcon: {
    width: 23,
    height: 26,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certificateSeal: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hourglass: {
    width: 19,
    height: 23,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourglassLine: {
    width: 12,
    height: 2,
    borderRadius: 2,
    transform: [{ rotate: '-35deg' }],
  },
  awardMedal: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  awardCore: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  targetOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
  });
}
