import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Picker } from '@react-native-picker/picker';
import { Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, EmptyState, ErrorState, FilterChips, LargeTitle as BaseLargeTitle, LoadingState, PrimaryButton, StatusBadge } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useCachedResource } from '../hooks/useCachedResource';
import { api, ApiError } from '../services/api';
import { clearCertificateDraft, loadCertificateDraft, saveCertificateDraft } from '../services/draftStorage';
import { invalidateCachedResource } from '../services/resourceCache';
import { radii, spacing } from '../styles/theme';
import { useThemeColors } from '../hooks/useTheme';
import {
  formatFileSize,
  pickDocumentsAsDataUrls,
  pickImageFromCameraAsDataUrl,
  pickImageFromLibraryAsDataUrl,
} from '../utils/files';
import { formatDate, formatHours, isValidBrazilianDate, maskBrazilianDate, normalizeText, statusLabel } from '../utils/format';

const FILTERS = [
  ['todos', 'Todos'],
  ['pendente', 'Pendentes'],
  ['aprovado', 'Aprovados'],
  ['rejeitado', 'Rejeitados'],
];

const CERTIFICATE_LOG_PREFIX = '[SIGAC certificate upload]';
const MAX_CERTIFICATE_FILES = 10;

function LargeTitle(props) {
  if (props.title === 'Certificados') {
    return (
      <BaseLargeTitle
        {...props}
        title="Atividades complementares"
        subtitle="Envie o certificado da atividade concluida e acompanhe a validacao das horas."
      />
    );
  }
  return <BaseLargeTitle {...props} />;
}

function logCertificateUpload(step, payload = {}) {
  try {
    console.log(CERTIFICATE_LOG_PREFIX, step, payload);
  } catch (_) {}
}

function validateCertificateForm({ title, institution, participant, date, declaredHours, category, rule, files }) {
  if (!title.trim()) return 'Informe o titulo do certificado.';
  if (!institution.trim()) return 'Informe a instituicao emissora.';
  if (!participant.trim()) return 'Informe o nome do participante.';
  if (!date.trim()) return 'Informe a data do certificado.';
  if (!isValidBrazilianDate(date)) return 'Use uma data valida no formato DD-MM-AAAA.';
  if (!category.trim()) return 'Selecione a categoria do curso para este certificado.';
  const hours = Number(String(declaredHours || '').replace(',', '.'));
  if (!Number.isFinite(hours) || hours <= 0) return 'Informe uma carga horaria maior que zero.';
  if (rule?.cargaMinima && hours < Number(rule.cargaMinima)) {
    return `A categoria ${rule.categoria} exige pelo menos ${formatHours(rule.cargaMinima)}.`;
  }
  if (rule?.limiteMaximo && rule?.remainingHours >= 0 && hours > rule.remainingHours) {
    return `A categoria ${rule.categoria} permite no maximo mais ${formatHours(rule.remainingHours)}.`;
  }
  const selectedFiles = Array.isArray(files) ? files : [];
  if (!selectedFiles.length) return 'Selecione ao menos um arquivo por camera, galeria ou PDF/documento.';
  if (selectedFiles.length > MAX_CERTIFICATE_FILES) return `Selecione no maximo ${MAX_CERTIFICATE_FILES} arquivos por certificado.`;
  const incompleteFile = selectedFiles.find((file) => !file?.dataUrl || !file?.name || !file?.mimeType);
  if (incompleteFile?.needsReattach) return 'Reanexe os arquivos do certificado antes de enviar este rascunho.';
  if (incompleteFile) return 'Um dos arquivos selecionados esta incompleto. Remova e selecione novamente.';
  if (selectedFiles.some((file) => !String(file.dataUrl).startsWith('data:') || !String(file.dataUrl).includes(';base64,'))) {
    return 'Um dos arquivos selecionados nao esta pronto para envio. Remova e selecione novamente.';
  }
  return '';
}

function hasCertificateDraftContent(draft) {
  return !!(
    String(draft?.declaredHours || '').trim()
    || String(draft?.title || '').trim()
    || String(draft?.institution || '').trim()
    || String(draft?.participant || '').trim()
    || String(draft?.date || '').trim()
    || String(draft?.category || '').trim()
    || String(draft?.observation || '').trim()
    || draft?.file
    || (Array.isArray(draft?.files) && draft.files.length)
  );
}

export default function CertificadosScreen({ route, navigation }) {
  const { token, expireSession, isOnline } = useAuth();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const historyOnly = route?.name === 'HistoricoEnvios' || route?.params?.view === 'history';
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [declaredHours, setDeclaredHours] = useState('');
  const [title, setTitle] = useState('');
  const [institution, setInstitution] = useState('');
  const [participant, setParticipant] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [observation, setObservation] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const loader = useCallback(() => api.certificadosMeus(token), [token]);
  const { data, loading, refreshing, error, load } = useCachedResource({
    cacheKey: token ? 'student.certificates' : '',
    loader,
    expireSession,
    enabled: !!token,
  });

  const certificates = data?.certificates || [];
  const rules = data?.rules || [];
  const categoryProgress = data?.categoryProgress || [];

  const categoryOptions = useMemo(() => {
    if (rules.length) return rules;
    return [{ id: 'categoria-geral', categoria: 'Categoria geral', limiteMaximo: 0, cargaMinima: 0 }];
  }, [rules]);

  const selectedRule = useMemo(() => {
    const rule = rules.find((item) => item.categoria === category);
    const progress = categoryProgress.find((item) => item.categoria === category);
    if (!rule && !progress) return null;
    const limit = Number(rule?.limiteMaximo || progress?.limiteMaximo || 0);
    const approved = Number(progress?.approvedHours || 0);
    return {
      ...(rule || progress),
      remainingHours: limit > 0 ? Math.max(0, limit - approved) : Number.POSITIVE_INFINITY,
    };
  }, [category, categoryProgress, rules]);

  useEffect(() => {
    if (historyOnly) return;
    if (draftLoaded) return;
    setDraftLoaded(true);
    loadCertificateDraft().then((draft) => {
      if (!draft?.updatedAt || !hasCertificateDraftContent(draft)) return;
      Alert.alert('Rascunho encontrado', 'Deseja continuar o certificado anterior?', [
        { text: 'Descartar', style: 'destructive', onPress: () => clearCertificateDraft().catch(() => {}) },
        {
          text: 'Continuar',
          onPress: () => {
            setDeclaredHours(draft.declaredHours || '');
            setTitle(draft.title || '');
            setInstitution(draft.institution || '');
            setParticipant(draft.participant || '');
            setDate(draft.date || '');
            setCategory(draft.category || '');
            setObservation(draft.observation || '');
            setFiles(Array.isArray(draft.files) ? draft.files : (draft.file ? [draft.file] : []));
          },
        },
      ]);
    });
  }, [draftLoaded, historyOnly]);

  useEffect(() => {
    if (historyOnly) return;
    if (!draftLoaded) return;
    const timer = setTimeout(() => {
      const draft = {
        declaredHours,
        title,
        institution,
        participant,
        date,
        category,
        observation,
        files,
      };
      if (hasCertificateDraftContent(draft)) {
        saveCertificateDraft(draft).catch(() => {});
      } else {
        clearCertificateDraft().catch(() => {});
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [category, date, declaredHours, draftLoaded, files, historyOnly, institution, observation, participant, title]);

  const summary = useMemo(() => {
    const declaredHoursByRequest = new Map();
    certificates.forEach((item) => {
      const key = item.batchId || item.id;
      declaredHoursByRequest.set(key, Math.max(declaredHoursByRequest.get(key) || 0, Number(item.declaredHours || 0)));
    });

    return {
      total: certificates.length,
      approved: certificates.filter((item) => item.adminStatus === 'aprovado').length,
      pending: certificates.filter((item) => item.adminStatus === 'pendente').length,
      rejected: certificates.filter((item) => item.adminStatus === 'rejeitado').length,
      hours: [...declaredHoursByRequest.values()].reduce((sum, hours) => sum + hours, 0),
    };
  }, [certificates]);

  const visible = useMemo(() => {
    const needle = normalizeText(search);
    return certificates
      .filter((item) => filter === 'todos' || item.adminStatus === filter)
      .filter((item) => {
        if (!needle) return true;
        return normalizeText(`${item.fileName} ${item.observation || ''} ${item.adminFeedback || ''}`).includes(needle);
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [certificates, filter, search]);

  function appendFiles(nextFiles) {
    const incoming = (Array.isArray(nextFiles) ? nextFiles : [nextFiles]).filter(Boolean);
    if (!incoming.length) return;

    setFiles((current) => {
      const availableSlots = Math.max(0, MAX_CERTIFICATE_FILES - current.length);
      if (!availableSlots) {
        Alert.alert('Limite de arquivos', `Voce pode anexar no maximo ${MAX_CERTIFICATE_FILES} arquivos por certificado.`);
        return current;
      }

      const accepted = incoming.slice(0, availableSlots);
      if (accepted.length < incoming.length) {
        Alert.alert('Limite de arquivos', `Foram adicionados ${accepted.length} arquivo(s). O limite e ${MAX_CERTIFICATE_FILES} por certificado.`);
      }

      return [...current, ...accepted];
    });
  }

  async function pickFile(source) {
    try {
      logCertificateUpload('pick:start', { source });
      setPicking(true);
      const selected = source === 'camera'
        ? await pickImageFromCameraAsDataUrl()
        : source === 'gallery'
          ? await pickImageFromLibraryAsDataUrl()
          : await pickDocumentsAsDataUrls(MAX_CERTIFICATE_FILES);
      const selectedFiles = Array.isArray(selected) ? selected : (selected ? [selected] : []);
      logCertificateUpload('pick:result', selectedFiles.length
        ? {
          source,
          count: selectedFiles.length,
          names: selectedFiles.map((item) => item.name),
        }
        : { source, canceled: true });
      appendFiles(selectedFiles);
    } catch (err) {
      logCertificateUpload('pick:error', { source, message: err?.message, stack: err?.stack });
      Alert.alert('Arquivo invalido', err.message || 'Nao foi possivel anexar o certificado.');
    } finally {
      setPicking(false);
    }
  }

  function removeFile(index) {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submit() {
    logCertificateUpload('submit:start', {
      fileCount: files.length,
      fileNames: files.map((item) => item?.name).filter(Boolean),
      isOnline,
    });
    const validation = validateCertificateForm({ title, institution, participant, date, declaredHours, category, rule: selectedRule, files });
    if (validation) {
      logCertificateUpload('submit:validation-error', { validation });
      Alert.alert('Revise os dados', validation);
      return;
    }
    if (!isOnline) {
      Alert.alert('Sem conexão', 'Certificados precisam de conexão para envio. Os dados preenchidos continuarão na tela.');
      return;
    }

    try {
      setSending(true);
      const details = [
        title.trim() ? `Título: ${title.trim()}` : '',
        institution.trim() ? `Instituição: ${institution.trim()}` : '',
        participant.trim() ? `Participante: ${participant.trim()}` : '',
        date.trim() ? `Data: ${date.trim()}` : '',
        category.trim() ? `Categoria: ${category.trim()}` : '',
        observation.trim(),
        'O OCR é apenas apoio. Os dados informados pelo aluno devem ser conferidos na validação.',
      ].filter(Boolean).join('\n');
      const declaredHoursNumber = Number(String(declaredHours || '').replace(',', '.'));
      await api.enviarCertificado(token, {
        fileName: files[0].name,
        fileData: files[0].dataUrl,
        category: category.trim(),
        observation: details,
        declaredHours: declaredHoursNumber,
        files: files.map((item) => ({
          fileName: item.name,
          fileData: item.dataUrl,
          category: category.trim(),
          observation: details,
          declaredHours: declaredHoursNumber,
        })),
      });
      logCertificateUpload('submit:success', { fileCount: files.length, fileNames: files.map((item) => item.name) });
      setDeclaredHours('');
      setTitle('');
      setInstitution('');
      setParticipant('');
      setDate('');
      setCategory('');
      setObservation('');
      setFiles([]);
      await clearCertificateDraft();
      invalidateCachedResource('student.certificates');
      invalidateCachedResource('student.dashboard');
      await load(true);
      Alert.alert('Certificado enviado', 'Seu certificado foi enviado. Confira os dados detectados pelo OCR quando o processamento estiver disponível.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await expireSession();
      logCertificateUpload('submit:error', { message: err?.message, status: err?.status, payload: err?.payload });
      Alert.alert('Erro no envio', err.message || 'Nao foi possivel enviar o certificado.');
    } finally {
      setSending(false);
    }
  }

  async function openCertificate(certificate) {
    navigation.navigate('VisualizarCertificado', { certificate });
  }

  if (loading) return <LoadingState label="Carregando certificados..." />;
  if (error) return <ErrorState message={error} onRetry={() => load()} />;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.root}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
    >
      {!historyOnly && !isOnline && (
        <Card accent={colors.warning}>
          <Text selectable style={styles.feedback}>Você está offline. O envio de certificados exige conexão ativa.</Text>
        </Card>
      )}

      <LargeTitle
        title={historyOnly ? 'Historico de envios' : 'Certificados'}
        subtitle={historyOnly ? 'Acompanhe os certificados enviados e baixe os arquivos quando precisar.' : 'Envie certificados externos e acompanhe a validacao das horas.'}
      />

      <View style={styles.grid}>
        <Metric label="Enviados" value={summary.total} accent={colors.primary} />
        <Metric label="Pendentes" value={summary.pending} accent={colors.warning} />
        <Metric label="Aprovados" value={summary.approved} accent={colors.success} />
        <Metric label="Horas" value={formatHours(summary.hours)} accent={colors.secondary} />
      </View>

      {!historyOnly && <Card accent={colors.primary}>
        <Text selectable style={styles.sectionTitle}>Enviar certificado</Text>
        <Text selectable style={styles.muted}>Revise os dados antes do envio. O OCR, quando disponível, serve apenas como apoio.</Text>

        <Text selectable style={styles.label}>Título do certificado</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex.: Curso de extensão" placeholderTextColor={colors.muted} />

        <Text selectable style={styles.label}>Instituição</Text>
        <TextInput style={styles.input} value={institution} onChangeText={setInstitution} placeholder="Ex.: Faculdade ou empresa" placeholderTextColor={colors.muted} />

        <Text selectable style={styles.label}>Nome do participante</Text>
        <TextInput style={styles.input} value={participant} onChangeText={setParticipant} placeholder="Como aparece no certificado" placeholderTextColor={colors.muted} />

        <Text selectable style={styles.label}>Data</Text>
        <TextInput style={styles.input} value={date} onChangeText={(value) => setDate(maskBrazilianDate(value))} keyboardType="number-pad" placeholder="DD-MM-AAAA" placeholderTextColor={colors.muted} />

        <Text selectable style={styles.label}>Categoria do curso</Text>
        <Text selectable style={styles.muted}>Selecione a regra que limita quantas horas deste certificado podem ser validadas.</Text>
        <View style={styles.pickerShell}>
          <Picker
            selectedValue={category}
            onValueChange={(value) => setCategory(value)}
            dropdownIconColor={colors.primary}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            <Picker.Item label="Selecione uma categoria" value="" color={colors.mutedStrong} />
            {categoryOptions.map((rule) => {
              const progress = categoryProgress.find((item) => item.categoria === rule.categoria);
              const limit = Number(rule.limiteMaximo || progress?.limiteMaximo || 0);
              const suffix = [
                limit > 0 ? `limite ${formatHours(limit)}` : '',
                progress?.completed ? 'completa' : '',
              ].filter(Boolean).join(' - ');
              return (
                <Picker.Item
                  key={rule.id || rule.categoria}
                  label={`${rule.categoria}${suffix ? ` - ${suffix}` : ''}`}
                  value={rule.categoria}
                  color={colors.heading}
                />
              );
            })}
          </Picker>
        </View>
        {!!selectedRule && (
          <View style={styles.ruleBox}>
            <Text selectable style={styles.ruleText}>Limite: {selectedRule.limiteMaximo ? formatHours(selectedRule.limiteMaximo) : 'nao informado'}</Text>
            <Text selectable style={styles.ruleText}>Disponivel: {Number.isFinite(selectedRule.remainingHours) ? formatHours(selectedRule.remainingHours) : 'nao informado'}</Text>
            {!!selectedRule.cargaMinima && <Text selectable style={styles.ruleText}>Carga minima: {formatHours(selectedRule.cargaMinima)}</Text>}
          </View>
        )}

        <Text selectable style={styles.label}>Horas declaradas</Text>
        <TextInput
          style={styles.input}
          value={declaredHours}
          onChangeText={setDeclaredHours}
          keyboardType="decimal-pad"
          placeholder="Ex.: 20"
          placeholderTextColor={colors.muted}
        />

        <Text selectable style={styles.label}>Observação</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={observation}
          onChangeText={setObservation}
          multiline
          placeholder="Descreva o contexto do certificado."
          placeholderTextColor={colors.muted}
        />

        <View style={styles.uploadBox}>
          <View style={styles.uploadIcon}>
            <View style={styles.uploadIconLine} />
          </View>
          {!!files[0]?.previewUri && <Image source={{ uri: files[0].previewUri }} style={styles.previewImage} resizeMode="cover" />}
          <Text selectable style={styles.uploadTitle}>{files.length ? `${files.length} arquivo(s) selecionado(s)` : 'Nenhum arquivo selecionado'}</Text>
          <Text selectable style={styles.uploadText}>{files.length ? `Limite: ${MAX_CERTIFICATE_FILES} arquivos por certificado.` : 'Use camera, galeria ou PDF/documento para anexar ate 10 arquivos do certificado.'}</Text>
          {files.map((item, index) => (
            <View key={`${item.name}-${index}`} style={styles.fileRow}>
              <View style={styles.fileRowText}>
                <Text selectable style={styles.fileName}>{item.name}</Text>
                <Text selectable style={styles.uploadText}>{item.mimeType} - {formatFileSize(item.size)}</Text>
              </View>
              <PrimaryButton title="Remover" onPress={() => removeFile(index)} variant="ghost" compact />
            </View>
          ))}
        </View>

        <View style={styles.attachmentActions}>
          <PrimaryButton title="Tirar foto com a câmera" onPress={() => pickFile('camera')} variant="ghost" loading={picking} />
          <PrimaryButton title="Selecionar da galeria" onPress={() => pickFile('gallery')} variant="ghost" loading={picking} />
          <PrimaryButton title="Selecionar PDF/documento" onPress={() => pickFile('document')} variant="ghost" loading={picking} />
        </View>
        <PrimaryButton title="Enviar certificado" onPress={submit} loading={sending} />
        <PrimaryButton title="Limpar rascunho" onPress={() => {
          setDeclaredHours('');
          setTitle('');
          setInstitution('');
          setParticipant('');
          setDate('');
          setCategory('');
          setObservation('');
          setFiles([]);
          clearCertificateDraft().catch(() => {});
        }} variant="ghost" disabled={sending} />
      </Card>}

      <Card accent={colors.primary}>
        <Text selectable style={styles.sectionTitle}>Histórico</Text>
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar certificado..."
          placeholderTextColor={colors.muted}
        />
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        <Text selectable style={styles.muted}>{visible.length} de {certificates.length} certificados exibidos</Text>
      </Card>

      {!visible.length ? (
        <EmptyState title="Nenhum certificado encontrado" message="Envie um novo certificado ou ajuste os filtros." />
      ) : visible.map((certificate) => {
        const requestHours = certificates
          .filter((item) => (item.batchId || item.id) === (certificate.batchId || certificate.id))
          .reduce((max, item) => Math.max(max, Number(item.declaredHours || 0)), 0);

        return (
        <Card key={certificate.id} accent={colors.primary}>
          <View style={styles.cardHeader}>
            <View style={styles.documentIcon}>
              <View style={styles.documentLine} />
              <View style={styles.documentLineShort} />
            </View>
            <View style={styles.cardTitleWrap}>
              <Text selectable style={styles.cardTitle}>{certificate.fileName}</Text>
              <Text selectable style={styles.muted}>Enviado em {formatDate(certificate.createdAt)}</Text>
            </View>
            <StatusBadge status={certificate.adminStatus} />
          </View>
          <Text selectable style={styles.text}>Horas da solicitação: {formatHours(requestHours)}</Text>
          <Text selectable style={styles.text}>Administrador: {statusLabel(certificate.adminStatus)}</Text>
          <Text selectable style={styles.text}>OCR: {statusLabel(certificate.ocrStatus)}</Text>
          {!!certificate.humanSummary && <Text selectable style={styles.ocrBox}>{certificate.humanSummary}</Text>}
          {!!certificate.detectedTitle && <Text selectable style={styles.text}>Título detectado: {certificate.detectedTitle}</Text>}
          {!!certificate.detectedInstitution && <Text selectable style={styles.text}>Instituição detectada: {certificate.detectedInstitution}</Text>}
          {!!certificate.detectedName && <Text selectable style={styles.text}>Participante detectado: {certificate.detectedName}</Text>}
          {!!certificate.detectedDate && <Text selectable style={styles.text}>Data detectada: {certificate.detectedDate}</Text>}
          {!!certificate.detectedHours && <Text selectable style={styles.text}>Carga detectada: {formatHours(certificate.detectedHours)}</Text>}
          {!!certificate.observation && <Text selectable style={styles.muted}>Observação: {certificate.observation}</Text>}
          {!!certificate.adminFeedback && <Text selectable style={styles.feedback}>Feedback: {certificate.adminFeedback}</Text>}
          <PrimaryButton
            title="Abrir certificado"
            onPress={() => openCertificate(certificate)}
            variant="ghost"
          />
        </Card>
        );
      })}
    </ScrollView>
  );
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
  sectionTitle: {
    color: colors.heading,
    fontSize: 18,
    fontWeight: '900',
  },
  label: {
    color: colors.heading,
    fontWeight: '800',
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
  textArea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  pickerShell: {
    minHeight: 50,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.glassStrong,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  picker: {
    minHeight: 50,
    color: colors.heading,
    backgroundColor: 'transparent',
  },
  pickerItem: {
    color: colors.heading,
    fontSize: 15,
  },
  ruleBox: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.glassSoft,
  },
  ruleText: {
    color: colors.mutedStrong,
    fontWeight: '700',
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
  cardTitle: {
    color: colors.heading,
    fontSize: 17,
    fontWeight: '900',
  },
  uploadBox: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderSubtle,
    backgroundColor: colors.glassSoft,
  },
  uploadIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.glassStrong,
  },
  uploadIconLine: {
    width: 24,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  uploadTitle: {
    color: colors.heading,
    fontWeight: '900',
    textAlign: 'center',
  },
  uploadText: {
    color: colors.muted,
    lineHeight: 20,
    textAlign: 'center',
  },
  fileRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.glassStrong,
  },
  fileRowText: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    color: colors.heading,
    fontWeight: '700',
  },
  previewImage: {
    width: '100%',
    height: 190,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSoft,
  },
  attachmentActions: {
    gap: spacing.sm,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.glassStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  documentLine: {
    width: 19,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  documentLineShort: {
    width: 12,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  text: {
    color: colors.text,
    lineHeight: 21,
  },
  feedback: {
    color: colors.warning,
    lineHeight: 20,
    fontWeight: '700',
  },
  ocrBox: {
    color: colors.text,
    lineHeight: 20,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.glassStrong,
  },
  muted: {
    color: colors.muted,
    lineHeight: 20,
  },
  });
}
