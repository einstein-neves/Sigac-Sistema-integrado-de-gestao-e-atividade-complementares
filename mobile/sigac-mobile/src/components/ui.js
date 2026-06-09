import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography } from '../styles/theme';
import { useThemeColors } from '../hooks/useTheme';
import { statusLabel } from '../utils/format';

export function Screen({ children, style }) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({ children, style, accent }) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.card, !!accent && { borderLeftColor: `${accent}66` }, style]}>
      {children}
    </View>
  );
}

export function LargeTitle({ title, subtitle, eyebrow, style }) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.largeTitleWrap, style]}>
      {!!eyebrow && <Text selectable style={styles.eyebrow}>{eyebrow}</Text>}
      <Text selectable style={styles.largeTitle}>{title}</Text>
      {!!subtitle && <Text selectable style={styles.largeSubtitle}>{subtitle}</Text>}
    </View>
  );
}

export function PrimaryButton({ title, onPress, disabled, variant = 'primary', loading = false, compact = false }) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const isGhost = variant === 'ghost';
  const isBlue = variant === 'blue';
  const isDanger = variant === 'danger';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        compact && styles.compactButton,
        isGhost ? styles.ghostButton : styles.primaryButton,
        isBlue && styles.blueButton,
        isDanger && styles.dangerButton,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={isGhost || isDanger ? colors.primary : '#ffffff'} />
      ) : (
        <Text style={[styles.buttonText, compact && styles.compactButtonText, isGhost && styles.ghostButtonText, isDanger && styles.dangerButtonText]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function FilterChips({ options, value, onChange }) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipWrap}
    >
      {options.map(([id, label]) => {
        const active = id === value;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.chipPressed,
            ]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function LoadingState({ label = 'Carregando...' }) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <Card style={styles.centerCard}>
      <ActivityIndicator color={colors.primary} />
      <Text selectable style={styles.muted}>{label}</Text>
    </Card>
  );
}

export function EmptyState({ title, message }) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <Card style={styles.centerCard}>
      <View style={styles.emptyIcon}>
        <View style={styles.emptyIconLine} />
      </View>
      <Text selectable style={styles.emptyTitle}>{title}</Text>
      {!!message && <Text selectable style={styles.muted}>{message}</Text>}
    </Card>
  );
}

export function ErrorState({ message, onRetry }) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <Card style={styles.centerCard}>
      <Text selectable style={styles.errorText}>{message}</Text>
      {!!onRetry && <PrimaryButton title="Tentar novamente" onPress={onRetry} variant="ghost" />}
    </Card>
  );
}

export function StatusBadge({ status }) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const normalized = String(status || '').toLowerCase();
  const map = {
    aprovado: [statusLabel(normalized), colors.success],
    rejeitado: [statusLabel(normalized), colors.danger],
    em_analise: [statusLabel(normalized), colors.warning],
    pendente: [statusLabel(normalized), colors.warning],
    nao_processado: [statusLabel(normalized), colors.muted],
    analise_manual: [statusLabel(normalized), colors.warning],
    aprovado_automatico: [statusLabel(normalized), colors.success],
  };
  const [label, color] = map[normalized] || [statusLabel(status), colors.muted];

  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}12` }]}>
      <Text selectable style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  largeTitleWrap: {
    gap: 6,
    paddingTop: 4,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  largeTitle: {
    ...typography.largeTitle,
    color: colors.heading,
  },
  largeSubtitle: {
    color: colors.mutedStrong,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  card: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 1,
    borderLeftColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 1,
  },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 132,
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  ghostButton: {
    backgroundColor: colors.glassSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  blueButton: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dangerButton: {
    backgroundColor: colors.glassSoft,
    borderColor: `${colors.danger}55`,
  },
  button: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  compactButton: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  compactButtonText: {
    fontSize: 13,
  },
  ghostButtonText: {
    color: colors.primary,
  },
  dangerButtonText: {
    color: colors.danger,
  },
  muted: {
    color: colors.muted,
    textAlign: 'center',
  },
  emptyTitle: {
    color: colors.heading,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.glassSoft,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
  emptyIconLine: {
    width: 20,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: colors.glassStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  chipWrap: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: 2,
  },
  chip: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.glassSoft,
  },
  chipActive: {
    borderColor: `${colors.accent}66`,
    backgroundColor: colors.primarySoft,
  },
  chipPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  chipText: {
    color: colors.mutedStrong,
    fontSize: 12,
    fontWeight: '800',
  },
  chipTextActive: {
    color: colors.accent,
  },
  });
}
