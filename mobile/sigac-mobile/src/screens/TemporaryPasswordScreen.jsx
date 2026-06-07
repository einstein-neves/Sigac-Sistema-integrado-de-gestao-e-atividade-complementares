import React, { useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { radii, spacing } from '../styles/theme';
import { useThemeColors } from '../hooks/useTheme';

function validate({ senhaAtual, novaSenha, confirmarSenha }) {
  if (!senhaAtual.trim()) return 'Informe a senha temporaria recebida no cadastro.';
  if (!novaSenha) return 'Informe a nova senha.';
  if (novaSenha.length < 8) return 'A nova senha deve ter pelo menos 8 caracteres.';
  if (novaSenha !== confirmarSenha) return 'A confirmacao precisa ser igual a nova senha.';
  if (senhaAtual === novaSenha) return 'Escolha uma senha diferente da temporaria.';
  return '';
}

export default function TemporaryPasswordScreen() {
  const { temporaryPasswordSession, changeTemporaryPassword, cancelTemporaryPassword } = useAuth();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function submit() {
    const message = validate({ senhaAtual, novaSenha, confirmarSenha });
    setError(message);
    if (message) return;

    try {
      setSending(true);
      await changeTemporaryPassword({ senhaAtual, novaSenha, confirmarSenha });
      Alert.alert('Senha alterada', 'Entre novamente usando sua senha definitiva.');
    } catch (err) {
      setError(err.message || 'Nao foi possivel alterar a senha temporaria.');
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            <View style={styles.card}>
          <Text selectable style={styles.eyebrow}>Primeiro acesso</Text>
          <Text selectable style={styles.title}>Troque sua senha temporaria</Text>
          <Text selectable style={styles.subtitle}>
            {temporaryPasswordSession?.user?.nome || temporaryPasswordSession?.email || 'Aluno SIGAC'}, cadastre uma senha definitiva para continuar no app.
          </Text>

          <View style={styles.field}>
            <Text selectable style={styles.label}>Senha temporaria</Text>
            <TextInput
              style={[styles.input, error && !senhaAtual.trim() && styles.inputError]}
              value={senhaAtual}
              onChangeText={setSenhaAtual}
              placeholder="Digite a senha recebida"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          <View style={styles.field}>
            <Text selectable style={styles.label}>Nova senha</Text>
            <TextInput
              style={[styles.input, error && novaSenha.length < 8 && styles.inputError]}
              value={novaSenha}
              onChangeText={setNovaSenha}
              placeholder="Minimo de 8 caracteres"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          <View style={styles.field}>
            <Text selectable style={styles.label}>Confirmar nova senha</Text>
            <TextInput
              style={[styles.input, error && novaSenha !== confirmarSenha && styles.inputError]}
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
              placeholder="Repita a nova senha"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          {!!error && <Text selectable style={styles.error}>{error}</Text>}
          <PrimaryButton title="Salvar nova senha" onPress={submit} loading={sending} />
          <PrimaryButton title="Voltar ao login" onPress={cancelTemporaryPassword} variant="ghost" disabled={sending} />
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  card: {
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.glass,
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 4,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.heading,
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.mutedStrong,
    lineHeight: 21,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.heading,
    fontWeight: '800',
  },
  input: {
    minHeight: 50,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.glassStrong,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    lineHeight: 20,
  },
  });
}
