import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { Card, ErrorState, LargeTitle, LoadingState, PrimaryButton } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { api, ApiError } from '../services/api';
import { spacing } from '../styles/theme';
import { useThemeColors } from '../hooks/useTheme';
import { formatDate, formatHours, statusLabel } from '../utils/format';

export default function CertificadoPreviewScreen({ route }) {
  const certificate = route?.params?.certificate || {};
  const { token, expireSession } = useAuth();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [sharing, setSharing] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadFile = useCallback(async (isRefresh = false) => {
    if (!token || !certificate.id) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      setFile(await api.prepararCertificado(token, certificate.id, certificate.fileName));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await expireSession();
      setError(err.message || 'Nao foi possivel preparar o certificado.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [certificate.fileName, certificate.id, expireSession, token]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  async function shareFile() {
    if (!file?.uri) return;
    try {
      setSharing(true);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: file.mimeType,
          dialogTitle: file.fileName || certificate.fileName || 'Certificado',
        });
      } else {
        Alert.alert('Arquivo disponivel', `Arquivo salvo temporariamente em: ${file.uri}`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await expireSession();
      Alert.alert('Erro ao abrir', err.message || 'Nao foi possivel abrir o arquivo.');
    } finally {
      setSharing(false);
    }
  }

  if (!certificate.id) {
    return <ErrorState message="Certificado nao informado." />;
  }
  if (loading) return <LoadingState label="Preparando certificado..." />;
  if (error) return <ErrorState message={error} onRetry={() => loadFile(true)} />;

  const isImage = String(file?.mimeType || '').startsWith('image/');
  const isPdf = String(file?.mimeType || '').includes('pdf');

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.root}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFile(true)} tintColor={colors.primary} />}
    >
      <LargeTitle
        title="Visualizar certificado"
        subtitle={certificate.fileName || file?.fileName || 'Arquivo enviado'}
      />

      <Card accent={colors.primary}>
        <Text selectable style={styles.cardTitle}>{certificate.fileName || file?.fileName}</Text>
        <Text selectable style={styles.muted}>Enviado em {formatDate(certificate.createdAt)}</Text>
        <Text selectable style={styles.muted}>Status: {statusLabel(certificate.adminStatus)}</Text>
        <Text selectable style={styles.muted}>Horas declaradas: {formatHours(certificate.declaredHours)}</Text>
      </Card>

      {isImage ? (
        <View style={styles.previewFrame}>
          <Image
            source={file.previewUri || file.uri}
            style={styles.previewImage}
            contentFit="contain"
            transition={120}
          />
        </View>
      ) : (
        <Card accent={colors.warning}>
          <Text selectable style={styles.cardTitle}>{isPdf ? 'PDF pronto para abrir' : 'Arquivo pronto para abrir'}</Text>
          <Text selectable style={styles.muted}>
            A visualizacao interna atual exibe certificados em imagem. Para PDF, use o botao abaixo para abrir o arquivo no visualizador do aparelho.
          </Text>
        </Card>
      )}

      <PrimaryButton
        title={isImage ? 'Compartilhar ou salvar' : 'Abrir arquivo'}
        onPress={shareFile}
        loading={sharing}
        variant={isImage ? 'ghost' : 'primary'}
      />
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
      paddingBottom: 112,
      gap: spacing.lg,
    },
    cardTitle: {
      color: colors.heading,
      fontSize: 17,
      fontWeight: '900',
    },
    muted: {
      color: colors.muted,
      lineHeight: 20,
    },
    previewFrame: {
      minHeight: 520,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    previewImage: {
      width: '100%',
      height: 520,
      backgroundColor: colors.surface,
    },
  });
}
