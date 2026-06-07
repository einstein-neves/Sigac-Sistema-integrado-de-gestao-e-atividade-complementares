import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, ErrorState, LargeTitle, LoadingState, PrimaryButton } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useCachedResource } from '../hooks/useCachedResource';
import { api, ApiError } from '../services/api';
import { clearActivityDraft, loadActivityDraft, saveActivityDraft } from '../services/draftStorage';
import { enqueueSubmission } from '../services/offlineQueue';
import { invalidateCachedResource } from '../services/resourceCache';
import { radii, spacing } from '../styles/theme';
import { useThemeColors } from '../hooks/useTheme';
import {
  formatFileSize,
  pickDocumentAsDataUrl,
  pickImageFromCameraAsDataUrl,
  pickImageFromLibraryAsDataUrl,
} from '../utils/files';
import { formatHours, isValidIsoDate, latestVersion, maskIsoDate } from '../utils/format';

function fieldFromDescription(description, label) {
  const line = String(description || '').split('\n').find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return line ? line.slice(label.length + 1).trim() : '';
}

function validateForm(fields) {
  const required = [
    ['titulo', 'Informe o título da atividade ou certificado.'],
    ['instituicao', 'Informe a instituição emissora ou organizadora.'],
    ['cursoEvento', 'Informe o curso ou evento relacionado.'],
    ['participante', 'Informe o nome do participante.'],
    ['dataRealizacao', 'Informe a data de realização ou emissão.'],
    ['categoria', 'Selecione uma categoria válida do curso.'],
    ['descricao', 'Descreva a atividade antes de enviar.'],
  ];

  for (const [key, message] of required) {
    if (!String(fields[key] || '').trim()) return message;
  }

  if (!isValidIsoDate(fields.dataRealizacao)) return 'Use uma data válida no formato AAAA-MM-DD.';

  const hours = Number(String(fields.horas || '').replace(',', '.'));
  if (!Number.isFinite(hours) || hours <= 0) return 'Informe uma carga horária maior que zero.';

  if (!fields.file?.dataUrl) return 'Anexe um comprovante em foto, imagem da galeria ou PDF.';
  if (fields.file?.needsReattach) return 'Reanexe o comprovante antes de enviar este rascunho.';
  if (!fields.course?.id) return 'Selecione um curso ativo antes de enviar.';
  if (fields.rule?.cargaMinima && hours < Number(fields.rule.cargaMinima)) {
    return `A categoria ${fields.rule.categoria} exige pelo menos ${formatHours(fields.rule.cargaMinima)}.`;
  }
  if (fields.rule?.limiteMaximo && fields.rule?.remainingHours >= 0 && hours > fields.rule.remainingHours) {
    return `A categoria ${fields.rule.categoria} permite no máximo mais ${formatHours(fields.rule.remainingHours)}.`;
  }
  return '';
}

export default function NovaAtividadeScreen({ route, navigation }) {
  const { token, expireSession, isOnline } = useAuth();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const initialActivity = route?.params?.activity || null;
  const correctionSubmission = route?.params?.submission || null;
  const correctionLatest = latestVersion(correctionSubmission);
  const [selectedId, setSelectedId] = useState(initialActivity?.id || correctionSubmission?.activityId || '');
  const [titulo, setTitulo] = useState(fieldFromDescription(correctionLatest?.descricao, 'Titulo') || initialActivity?.titulo || '');
  const [instituicao, setInstituicao] = useState(fieldFromDescription(correctionLatest?.descricao, 'Instituicao'));
  const [cursoEvento, setCursoEvento] = useState(fieldFromDescription(correctionLatest?.descricao, 'Curso/evento') || initialActivity?.titulo || '');
  const [participante, setParticipante] = useState(fieldFromDescription(correctionLatest?.descricao, 'Participante'));
  const [dataRealizacao, setDataRealizacao] = useState(fieldFromDescription(correctionLatest?.descricao, 'Data'));
  const [categoria, setCategoria] = useState(correctionLatest?.categoria || '');
  const [descricao, setDescricao] = useState(fieldFromDescription(correctionLatest?.descricao, 'Descricao') || initialActivity?.descricao || '');
  const [horas, setHoras] = useState(correctionLatest?.horasDeclaradas ? String(correctionLatest.horasDeclaradas) : initialActivity?.horas ? String(initialActivity.horas) : '');
  const [observacao, setObservacao] = useState(correctionLatest?.observacao || '');
  const [file, setFile] = useState(null);
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const loader = useCallback(() => api.atividadesAluno(token), [token]);
  const { data, loading, error, load } = useCachedResource({
    cacheKey: token ? 'student.activities' : '',
    loader,
    expireSession,
    enabled: !!token,
  });

  const activities = useMemo(() => {
    const fromApi = data?.activities || [];
    if (initialActivity && !fromApi.some((item) => item.id === initialActivity.id)) return [initialActivity, ...fromApi];
    return fromApi;
  }, [data, initialActivity]);

  const categoryProgress = data?.categoryProgress || [];
  const rules = data?.rules || [];
  const selectedActivity = useMemo(
    () => activities.find((item) => item.id === selectedId) || null,
    [activities, selectedId]
  );
  const selectedActivityExpired = useMemo(() => {
    if (!selectedActivity?.prazo) return false;
    const limit = new Date(`${String(selectedActivity.prazo).slice(0, 10)}T23:59:59`);
    return !Number.isNaN(limit.getTime()) && limit < new Date();
  }, [selectedActivity]);
  const selectedRule = useMemo(() => {
    const rule = rules.find((item) => item.categoria === categoria);
    const progress = categoryProgress.find((item) => item.categoria === categoria);
    if (!rule && !progress) return null;
    const limit = Number(rule?.limiteMaximo || progress?.limiteMaximo || 0);
    const approved = Number(progress?.approvedHours || 0);
    return {
      ...(rule || progress),
      remainingHours: limit > 0 ? Math.max(0, limit - approved) : Number.POSITIVE_INFINITY,
    };
  }, [categoria, categoryProgress, rules]);

  const categoryOptions = useMemo(() => {
    if (rules.length) return rules;
    const names = [...new Set(activities.map((item) => item.categoria || item.category || item.ruleCategory).filter(Boolean))];
    if (names.length) return names.map((name) => ({ id: name, categoria: name, limiteMaximo: 0, cargaMinima: 0 }));
    return [{ id: 'categoria-geral', categoria: 'Categoria geral', limiteMaximo: 0, cargaMinima: 0, descricao: 'Fallback usado somente quando a API nao retorna regras para o curso.' }];
  }, [activities, rules]);

  useEffect(() => {
    if (draftLoaded || correctionSubmission) return;
    setDraftLoaded(true);
    loadActivityDraft().then((draft) => {
      if (!draft?.activityId) return;
      Alert.alert('Rascunho encontrado', 'Deseja continuar o preenchimento anterior?', [
        { text: 'Descartar', style: 'destructive', onPress: () => clearActivityDraft().catch(() => {}) },
        {
          text: 'Continuar',
          onPress: () => {
            setSelectedId(draft.activityId || '');
            setTitulo(draft.titulo || '');
            setInstituicao(draft.instituicao || '');
            setCursoEvento(draft.cursoEvento || '');
            setParticipante(draft.participante || '');
            setDataRealizacao(draft.dataRealizacao || '');
            setCategoria(draft.categoria || '');
            setDescricao(draft.descricao || '');
            setHoras(draft.horas || '');
            setObservacao(draft.observacao || '');
            setFile(draft.file || null);
          },
        },
      ]);
    });
  }, [correctionSubmission, draftLoaded]);

  useEffect(() => {
    if (!draftLoaded || correctionSubmission) return;
    const timer = setTimeout(() => {
      saveActivityDraft({
        activityId: selectedId,
        titulo,
        instituicao,
        cursoEvento,
        participante,
        dataRealizacao,
        categoria,
        descricao,
        horas,
        observacao,
        file,
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [categoria, correctionSubmission, cursoEvento, dataRealizacao, descricao, draftLoaded, file, horas, instituicao, observacao, participante, selectedId, titulo]);

  function selectActivity(activity) {
    setSelectedId(activity.id);
    setTitulo(activity.titulo || '');
    setCursoEvento(activity.titulo || '');
    setDescricao(activity.descricao || '');
    setHoras(String(activity.horas || ''));
    const realCategory = activity.categoria || activity.category || activity.ruleCategory || '';
    if (realCategory && categoryOptions.some((rule) => rule.categoria === realCategory)) {
      setCategoria(realCategory);
    }
  }

  function selectCategory(rule) {
    setCategoria(rule.categoria);
    const progress = categoryProgress.find((item) => item.categoria === rule.categoria);
    if (progress?.completed) {
      Alert.alert('Categoria completa', `A categoria ${rule.categoria} já atingiu o limite permitido.`);
    }
  }

  async function selectFile(source) {
    try {
      setPicking(true);
      const selected = source === 'camera'
        ? await pickImageFromCameraAsDataUrl()
        : source === 'gallery'
          ? await pickImageFromLibraryAsDataUrl()
          : await pickDocumentAsDataUrl();
      if (selected) setFile(selected);
    } catch (err) {
      Alert.alert('Comprovante não selecionado', err.message || 'Não foi possível anexar o comprovante.');
    } finally {
      setPicking(false);
    }
  }

  async function submit() {
    const course = data?.course
      || selectedActivity?.course
      || initialActivity?.course
      || (selectedActivity?.courseId ? { id: selectedActivity.courseId } : null);
    const validation = validateForm({
      titulo,
      instituicao,
      cursoEvento,
      participante,
      dataRealizacao,
      categoria,
      descricao,
      horas,
      file,
      course,
      rule: selectedRule,
    });

    if (!selectedActivity?.id) {
      Alert.alert('Atividade obrigatória', 'Selecione a atividade publicada para seu curso antes de enviar.');
      return;
    }
    if (selectedActivityExpired) {
      Alert.alert('Prazo encerrado', 'Esta atividade esta com prazo vencido. Escolha outra atividade ou fale com a coordenacao.');
      return;
    }

    if (validation) {
      Alert.alert('Revise os dados', validation);
      return;
    }

    const declaredHours = Number(String(horas || '').replace(',', '.'));
    const descricaoCompleta = [
      `Titulo: ${titulo.trim()}`,
      `Instituicao: ${instituicao.trim()}`,
      `Curso/evento: ${cursoEvento.trim()}`,
      `Participante: ${participante.trim()}`,
      `Data: ${dataRealizacao.trim()}`,
      `Descricao: ${descricao.trim()}`,
    ].join('\n');
    const observacaoCompleta = [
      observacao.trim(),
      correctionSubmission ? `Correção da solicitação: ${correctionSubmission.id}` : '',
      `Curso ativo: ${course?.sigla || ''} - ${course?.nome || course?.id || ''}`.trim(),
    ].filter(Boolean).join('\n');
    const payload = {
      activityId: selectedActivity.id,
      arquivoNome: file.name,
      arquivoData: file.dataUrl,
      observacao: observacaoCompleta,
      categoria: categoria.trim(),
      descricao: descricaoCompleta,
      horasDeclaradas: declaredHours,
    };

    try {
      setSending(true);
      if (!isOnline) {
        await enqueueSubmission(payload);
        await clearActivityDraft();
        Alert.alert('Envio salvo offline', 'A solicitação será sincronizada automaticamente quando a conexão voltar.');
        navigation.navigate('AtividadesLista');
        return;
      }
      await api.enviarAtividade(token, payload);
      await clearActivityDraft();
      invalidateCachedResource('student.activities');
      invalidateCachedResource('student.dashboard');
      invalidateCachedResource('student.status');
      Alert.alert('Envio realizado', correctionSubmission ? 'Sua correção foi enviada para análise.' : 'Sua solicitação foi registrada e enviada para análise da coordenação.');
      navigation.navigate('AtividadesLista');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await expireSession();
      if (err instanceof ApiError && err.status === 0) {
        await enqueueSubmission(payload);
        Alert.alert('Envio salvo offline', 'A conexão caiu. O envio foi salvo e será sincronizado quando a internet voltar.');
        navigation.navigate('AtividadesLista');
        return;
      }
      Alert.alert('Erro no envio', err.message || 'Não foi possível enviar a solicitação.');
    } finally {
      setSending(false);
    }
  }

  if (loading && !activities.length) return <LoadingState label="Preparando formulário..." />;
  if (error && !activities.length) return <ErrorState message={error} onRetry={load} />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.root} contentContainerStyle={styles.container}>
      {!isOnline && (
        <Card accent={colors.warning}>
          <Text selectable style={styles.warningText}>Você está offline. O formulário será salvo como rascunho e o envio pode entrar na fila de sincronização.</Text>
        </Card>
      )}

      <LargeTitle
        title={correctionSubmission ? 'Corrigir envio' : 'Enviar atividade'}
        subtitle="Preencha os dados principais, selecione a categoria do curso e anexe um comprovante legível."
      />

      {!!correctionLatest?.feedback && (
        <Card accent={colors.danger}>
          <Text selectable style={styles.feedbackTitle}>Feedback da coordenação</Text>
          <Text selectable style={styles.feedbackText}>{correctionLatest.feedback}</Text>
        </Card>
      )}

      <Text selectable style={styles.label}>Atividade</Text>
      <View style={styles.activityList}>
        {activities.map((activity) => (
          <PrimaryButton
            key={activity.id}
            title={`${activity.titulo} - ${formatHours(activity.horas)}`}
            onPress={() => selectActivity(activity)}
            variant={activity.id === selectedId ? 'primary' : 'ghost'}
            disabled={!correctionSubmission && (activity.submission?.currentStatus === 'aprovado' || activity.submission?.currentStatus === 'em_analise')}
          />
        ))}
      </View>

      <Card accent={colors.primary}>
        <Text selectable style={styles.sectionTitle}>Categoria do curso</Text>
        <Text selectable style={styles.muted}>Selecione a regra cadastrada para o curso ativo.</Text>
        {!categoryOptions.length ? (
          <Text selectable style={styles.warningText}>Nenhuma regra retornada pela API. O envio usará a categoria da atividade selecionada como fallback.</Text>
        ) : categoryOptions.map((rule) => {
          const progress = categoryProgress.find((item) => item.categoria === rule.categoria);
          const active = categoria === rule.categoria;
          return (
            <PrimaryButton
              key={rule.id || rule.categoria}
              title={`${rule.categoria}${rule.limiteMaximo ? ` - limite ${formatHours(rule.limiteMaximo)}` : ''}${progress?.completed ? ' - completa' : ''}`}
              onPress={() => selectCategory(rule)}
              variant={active ? 'primary' : 'ghost'}
            />
          );
        })}
        {!!selectedRule && (
          <View style={styles.ruleBox}>
            <Text selectable style={styles.ruleText}>Limite: {selectedRule.limiteMaximo ? formatHours(selectedRule.limiteMaximo) : 'não informado'}</Text>
            <Text selectable style={styles.ruleText}>Disponível: {Number.isFinite(selectedRule.remainingHours) ? formatHours(selectedRule.remainingHours) : 'não informado'}</Text>
            {!!selectedRule.cargaMinima && <Text selectable style={styles.ruleText}>Carga mínima: {formatHours(selectedRule.cargaMinima)}</Text>}
          </View>
        )}
      </Card>

      <Card accent={colors.primary}>
        <Text selectable style={styles.sectionTitle}>Dados do comprovante</Text>
        <Text selectable style={styles.label}>Título da atividade/certificado</Text>
        <TextInput style={styles.input} value={titulo} onChangeText={setTitulo} placeholder="Ex.: Oficina de Git" placeholderTextColor={colors.muted} />

        <Text selectable style={styles.label}>Instituição emissora ou organizadora</Text>
        <TextInput style={styles.input} value={instituicao} onChangeText={setInstituicao} placeholder="Ex.: Faculdade, empresa ou organização" placeholderTextColor={colors.muted} />

        <Text selectable style={styles.label}>Curso ou evento</Text>
        <TextInput style={styles.input} value={cursoEvento} onChangeText={setCursoEvento} placeholder="Ex.: Curso livre, palestra, seminário" placeholderTextColor={colors.muted} />

        <Text selectable style={styles.label}>Nome do participante</Text>
        <TextInput style={styles.input} value={participante} onChangeText={setParticipante} placeholder="Nome como aparece no comprovante" placeholderTextColor={colors.muted} />

        <Text selectable style={styles.label}>Data de realização ou emissão</Text>
        <TextInput style={styles.input} value={dataRealizacao} onChangeText={(value) => setDataRealizacao(maskIsoDate(value))} keyboardType="number-pad" placeholder="AAAA-MM-DD" placeholderTextColor={colors.muted} />

        <Text selectable style={styles.label}>Descrição/observação da atividade</Text>
        <TextInput style={[styles.input, styles.textArea]} value={descricao} onChangeText={setDescricao} multiline placeholderTextColor={colors.muted} />

        <Text selectable style={styles.label}>Carga horária declarada</Text>
        <TextInput style={styles.input} value={horas} onChangeText={setHoras} keyboardType="decimal-pad" placeholder="Ex.: 12" placeholderTextColor={colors.muted} />

        <Text selectable style={styles.label}>Observação adicional</Text>
        <TextInput style={[styles.input, styles.textArea]} value={observacao} onChangeText={setObservacao} multiline placeholder="Opcional" placeholderTextColor={colors.muted} />

        <View style={styles.uploadBox}>
          {!!file?.previewUri && <Image source={{ uri: file.previewUri }} style={styles.previewImage} resizeMode="cover" />}
          <Text selectable style={styles.fileName}>{file ? file.name : 'Nenhum comprovante selecionado'}</Text>
          <Text selectable style={styles.fileMeta}>
            {file ? `${file.mimeType} - ${formatFileSize(file.size)}${file.needsReattach ? ' - reanexe antes do envio' : ''}` : 'Use câmera, galeria ou PDF/arquivo para anexar o comprovante.'}
          </Text>
          {file && <PrimaryButton title="Remover arquivo" onPress={() => setFile(null)} variant="ghost" compact />}
        </View>

        <View style={styles.attachmentActions}>
          <PrimaryButton title="Tirar foto com a câmera" onPress={() => selectFile('camera')} variant="ghost" loading={picking} />
          <PrimaryButton title="Selecionar da galeria" onPress={() => selectFile('gallery')} variant="ghost" loading={picking} />
          <PrimaryButton title="Selecionar PDF/arquivo" onPress={() => selectFile('document')} variant="ghost" loading={picking} />
        </View>
        <PrimaryButton title={correctionSubmission ? 'Corrigir e reenviar' : 'Enviar para análise'} onPress={submit} loading={sending} />
      </Card>
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
  sectionTitle: {
    color: colors.heading,
    fontSize: 18,
    fontWeight: '900',
  },
  label: {
    color: colors.heading,
    fontWeight: '800',
  },
  activityList: {
    gap: spacing.sm,
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
  fileName: {
    color: colors.heading,
    fontWeight: '900',
    textAlign: 'center',
  },
  fileMeta: {
    color: colors.muted,
    lineHeight: 20,
    textAlign: 'center',
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
  ruleBox: {
    gap: 4,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.glassStrong,
  },
  ruleText: {
    color: colors.mutedStrong,
    lineHeight: 20,
  },
  warningText: {
    color: colors.warning,
    fontWeight: '800',
    lineHeight: 20,
  },
  feedbackTitle: {
    color: colors.danger,
    fontWeight: '900',
  },
  feedbackText: {
    color: colors.text,
    lineHeight: 20,
  },
  muted: {
    color: colors.muted,
    lineHeight: 20,
  },
  });
}
