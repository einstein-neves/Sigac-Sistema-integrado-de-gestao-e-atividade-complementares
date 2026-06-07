import React, { useState } from 'react';
import { Alert, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { radii, spacing } from '../styles/theme';
import { useThemeColors } from '../hooks/useTheme';

const logo = require('../../assets/logo-sigac.png');

export default function LoginScreen() {
  const { signIn, verifyTwoFactor } = useAuth();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo2fa, setCodigo2fa] = useState('');
  const [desafio2fa, setDesafio2fa] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [enviandoReset, setEnviandoReset] = useState(false);

  async function entrar() {
    if (desafio2fa) {
      await confirmar2fa();
      return;
    }

    if (!email.trim() || !senha) {
      Alert.alert('Atencao', 'Informe e-mail e senha.');
      return;
    }

    try {
      setCarregando(true);
      const payload = await signIn(email.trim(), senha);
      if (payload?.requiresTwoFactor) {
        setDesafio2fa(payload);
        setCodigo2fa('');
        setSenha('');
        Alert.alert('Codigo enviado', `Enviamos um codigo de verificacao para ${payload.emailHint || 'seu e-mail'}.`);
      }
    } catch (error) {
      Alert.alert('Nao foi possivel entrar', error.message);
    } finally {
      setCarregando(false);
    }
  }

  async function confirmar2fa() {
    if (!codigo2fa.trim()) {
      Alert.alert('Codigo obrigatorio', 'Informe o codigo de verificacao enviado ao seu e-mail.');
      return;
    }

    try {
      setCarregando(true);
      await verifyTwoFactor({
        challengeToken: desafio2fa.challengeToken,
        code: codigo2fa,
        email: email.trim(),
      });
    } catch (error) {
      Alert.alert('Codigo invalido', error.message);
    } finally {
      setCarregando(false);
    }
  }

  function cancelar2fa() {
    setDesafio2fa(null);
    setCodigo2fa('');
  }

  async function esqueceuSenha() {
    const resetEmail = email.trim();
    if (!resetEmail) {
      Alert.alert('Redefinir senha', 'Digite seu e-mail no campo acima e toque em "Esqueceu a senha?" novamente.');
      return;
    }

    try {
      setEnviandoReset(true);
      await api.requestPasswordReset(resetEmail);
      Alert.alert(
        'Verifique seu e-mail',
        'Se houver uma conta ativa com este e-mail, enviaremos um link seguro para redefinir a senha. O link expira em poucos minutos e funciona uma unica vez.'
      );
    } catch (error) {
      Alert.alert('Nao foi possivel solicitar', error.message);
    } finally {
      setEnviandoReset(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.loginCard}>
          <View style={styles.hero}>
            <View style={styles.brandRow}>
              <Image source={logo} style={styles.logo} resizeMode="contain" />
              <View style={styles.brandText}>
                <Text selectable style={styles.title}>SIGAC</Text>
                <Text selectable style={styles.brandSubtitle}>Atividades Complementares</Text>
              </View>
            </View>
            <View style={styles.kicker}>
              <Text selectable style={styles.kickerText}>Aplicativo do aluno</Text>
            </View>
            <Text selectable style={styles.headline}>Acompanhe progresso, envios e certificados.</Text>
            <Text selectable style={styles.subtitle}>Acesso mobile conectado ao fluxo academico do SIGAC.</Text>
          </View>

          <View style={styles.authPanel}>
            <View>
              <Text selectable style={styles.cardTitle}>{desafio2fa ? 'Verificar codigo' : 'Entrar'}</Text>
              <Text selectable style={styles.cardSubtitle}>
                {desafio2fa ? `Digite o codigo enviado para ${desafio2fa.emailHint || 'seu e-mail'}.` : 'Use o mesmo e-mail e senha do SIGAC.'}
              </Text>
            </View>

            {!desafio2fa && (
              <View style={styles.field}>
                <Text selectable style={styles.label}>E-mail</Text>
                <TextInput
                  style={styles.input}
                  placeholder="seu.email@dominio.com"
                  placeholderTextColor={colors.muted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  inputMode="email"
                  autoComplete="email"
                  returnKeyType="next"
                />
              </View>
            )}

            {desafio2fa ? (
              <View style={styles.field}>
                <Text selectable style={styles.label}>Codigo de verificacao</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Digite os 6 digitos"
                  placeholderTextColor={colors.muted}
                  value={codigo2fa}
                  onChangeText={setCodigo2fa}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                />
                <Text selectable style={styles.securityHint}>O codigo expira em poucos minutos e funciona uma unica vez.</Text>
              </View>
            ) : (
              <View style={styles.field}>
                <View style={styles.passwordHeader}>
                  <Text selectable style={styles.label}>Senha</Text>
                  <Pressable
                    onPress={esqueceuSenha}
                    disabled={enviandoReset}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Orientacoes para recuperar senha"
                  >
                    <Text style={[styles.forgotText, enviandoReset && styles.forgotTextDisabled]}>
                      {enviandoReset ? 'Enviando...' : 'Esqueceu a senha?'}
                    </Text>
                  </Pressable>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Digite sua senha"
                  placeholderTextColor={colors.muted}
                  value={senha}
                  onChangeText={setSenha}
                  secureTextEntry
                  autoComplete="password"
                  returnKeyType="go"
                  onSubmitEditing={entrar}
                />
                <Text selectable style={styles.securityHint}>Enviaremos um link de uso unico apenas para contas ativas.</Text>
              </View>
            )}

            <PrimaryButton title={desafio2fa ? 'Verificar codigo' : 'Entrar'} onPress={entrar} loading={carregando} />
            {!!desafio2fa && <PrimaryButton title="Voltar ao login" onPress={cancelar2fa} variant="ghost" disabled={carregando} />}
          </View>
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
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.lg,
      gap: spacing.lg,
    },
    logo: {
      width: 70,
      height: 70,
    },
    loginCard: {
      overflow: 'hidden',
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surface,
      shadowColor: colors.shadowStrong,
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 3,
    },
    hero: {
      gap: spacing.md,
      padding: spacing.xl,
      backgroundColor: colors.primaryDark,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    brandText: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: colors.white,
      fontSize: 32,
      lineHeight: 36,
      fontWeight: '900',
    },
    brandSubtitle: {
      color: 'rgba(255,255,255,0.84)',
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    kicker: {
      alignSelf: 'flex-start',
      minHeight: 28,
      justifyContent: 'center',
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.32)',
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    kickerText: {
      color: colors.white,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    headline: {
      maxWidth: 320,
      color: colors.white,
      fontSize: 28,
      lineHeight: 33,
      fontWeight: '900',
    },
    subtitle: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 15,
      lineHeight: 22,
    },
    authPanel: {
      gap: spacing.md,
      padding: spacing.xl,
      backgroundColor: colors.surface,
    },
    cardTitle: {
      color: colors.heading,
      fontSize: 22,
      fontWeight: '900',
    },
    cardSubtitle: {
      marginTop: 5,
      color: colors.muted,
      lineHeight: 20,
    },
    field: {
      gap: spacing.xs,
    },
    label: {
      color: colors.heading,
      fontWeight: '800',
    },
    passwordHeader: {
      minHeight: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    forgotText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '900',
    },
    forgotTextDisabled: {
      opacity: 0.6,
    },
    securityHint: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    input: {
      minHeight: 50,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingHorizontal: spacing.md,
      color: colors.text,
      backgroundColor: colors.glassStrong,
    },
  });
}
