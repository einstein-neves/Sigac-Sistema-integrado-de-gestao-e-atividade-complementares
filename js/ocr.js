// =========================================================
// SIGAC - JS comentado: ocr.js
// Objetivo: orientar a equipe sobre a função deste arquivo.
// Comentários não aparecem para o usuário final.
// =========================================================

(function () {
  'use strict';

  const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  const PDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDF_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  function ensureScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(
        new Error('Nao foi possivel carregar as bibliotecas externas do OCR. Verifique a conexao com a internet ou faca a validacao manual do certificado.')
      );
      document.head.appendChild(script);
    });
  }

  async function ensureDependencies() {
    await ensureScript(PDF_CDN);
    await ensureScript(TESSERACT_CDN);

    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    if (pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_CDN;

    if (!pdfjsLib || !window.Tesseract) {
      throw new Error('Nao foi possivel inicializar as bibliotecas externas do OCR. Continue o envio manualmente e use os dados preenchidos no formulario como fonte final.');
    }

    return { pdfjsLib, Tesseract: window.Tesseract };
  }

  function dataUrlToBlob(dataUrl) {
    const [meta, base64] = String(dataUrl || '').split(',');
    if (!base64) throw new Error('Arquivo inválido para OCR.');

    const mime = (meta.match(/data:(.*?);base64/) || [])[1] || 'application/octet-stream';
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

    return new Blob([bytes], { type: mime });
  }

  function normalizeForMatching(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findFirstMatch(text, patterns) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match;
    }
    return null;
  }
  function normalizeNameValue(value) {
    return normalizeForMatching(value)
      .toLowerCase()
      .replace(/[._,;:()\[\]{}]/g, ' ')
      .replace(/\b(de|da|do|das|dos|e)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function nameTokens(value) {
    return normalizeNameValue(value)
      .split(' ')
      .map((token) => token.trim())
      .filter(Boolean);
  }

  function levenshteinDistance(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    if (left === right) return 0;
    if (!left) return right.length;
    if (!right) return left.length;

    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    const current = Array.from({ length: right.length + 1 }, () => 0);

    for (let i = 1; i <= left.length; i += 1) {
      current[0] = i;
      for (let j = 1; j <= right.length; j += 1) {
        const cost = left[i - 1] === right[j - 1] ? 0 : 1;
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + cost
        );
      }
      for (let j = 0; j <= right.length; j += 1) previous[j] = current[j];
    }

    return previous[right.length];
  }

  function tokensLookAlike(expectedToken, foundToken) {
    const expected = String(expectedToken || '').trim();
    const found = String(foundToken || '').trim();
    if (!expected || !found) return false;
    if (expected === found) return true;
    if (expected.length === 1) return found[0] === expected;
    if (found.length === 1) return expected[0] === found;
    if (expected.length >= 4 && found.length >= 4 && (expected.startsWith(found) || found.startsWith(expected))) return true;

    const distance = levenshteinDistance(expected, found);
    const maxLength = Math.max(expected.length, found.length);
    if (maxLength >= 5 && distance <= 1) return true;
    if (maxLength >= 8 && distance <= 2) return true;

    return false;
  }

  function isNameCompatible(expectedName, extractedText) {
    const expectedTokens = nameTokens(expectedName)
      .filter((token) => token.length === 1 || token.length >= 2);
    const textTokens = nameTokens(extractedText);

    if (!expectedTokens.length || !textTokens.length) return false;

    const firstToken = expectedTokens[0];
    const lastToken = expectedTokens[expectedTokens.length - 1];
    const firstMatches = textTokens.some((token) => tokensLookAlike(firstToken, token));
    const lastMatches = textTokens.some((token) => tokensLookAlike(lastToken, token));
    const matched = expectedTokens.filter((expectedToken) => textTokens.some((token) => tokensLookAlike(expectedToken, token)));
    const significantExpected = expectedTokens.filter((token) => token.length > 1);
    const minMatches = Math.min(3, Math.max(2, significantExpected.length - 1));

    return (firstMatches && lastMatches && matched.length >= 2) || matched.length >= minMatches;
  }


  function cleanupDetectedValue(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s:;,-]+|[\s:;,-]+$/g, '')
      .trim();
  }

  function cleanupCourseName(value) {
    return cleanupDetectedValue(value)
      .replace(/\s+com\s+dura(?:c|ç)[aã]o.*$/i, '')
      .replace(/\s+realizando\s+todas.*$/i, '')
      .replace(/\s+e\s+avalia(?:c|ç)[oõ]es.*$/i, '')
      .replace(/\s*\[\s*(\d{1,3})\s*horas?\s*\]\s*/i, ' [$1 HORAS]')
      .trim();
  }

  function formatCnpj(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length !== 14) return cleanupDetectedValue(value);

    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }

  function detectCnpj(asciiText) {
    const match = asciiText.match(/\bCNPJ\s*[:\-]?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}\-?\d{2})\b/i);
    return match ? formatCnpj(match[1]) : '';
  }

  function normalizeNumericDate(value) {
    const match = String(value || '').match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
    if (!match) return '';

    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];

    return `${day}/${month}/${year}`;
  }

  function detectWrittenDate(asciiText) {
    const monthMap = {
      janeiro: '01',
      fevereiro: '02',
      marco: '03',
      março: '03',
      abril: '04',
      maio: '05',
      junho: '06',
      julho: '07',
      agosto: '08',
      setembro: '09',
      outubro: '10',
      novembro: '11',
      dezembro: '12'
    };

    const months = Object.keys(monthMap).join('|');
    const match = asciiText.match(new RegExp('\\b(\\d{1,2})\\s+de\\s+(' + months + ')\\s+de\\s+(\\d{4})\\b', 'i'));

    if (!match) return '';

    const day = match[1].padStart(2, '0');
    const month = monthMap[String(match[2]).toLowerCase()] || '';

    return month ? `${day}/${month}/${match[3]}` : '';
  }

  function detectInstitution(asciiText) {
    const detectedCnpj = detectCnpj(asciiText);

    const companyWithCnpj = asciiText.match(/\b([A-Za-z0-9À-ÿ &.,'’\-–—]{3,120}?(?:LTDA|EIRELI|S\.?A\.?|ME|EPP))\s*[–—-]?\s*CNPJ\s*[:\-]?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}\-?\d{2})\b/i);
    if (companyWithCnpj) {
      const companyName = cleanupDetectedValue(companyWithCnpj[1]);
      return `${companyName} - CNPJ: ${formatCnpj(companyWithCnpj[2])}`;
    }

    const companyOnly = asciiText.match(/\b([A-Za-z0-9À-ÿ &.,'’\-–—]{3,120}?(?:LTDA|EIRELI|S\.?A\.?|ME|EPP))\b/i);
    if (companyOnly) return cleanupDetectedValue(companyOnly[1]);

    const knownInstitution = asciiText.match(/\b(CURSO\s+EM\s+VIDEO|CURSOEMVIDEO|DIGIRATI\s+INFORMATICA|DIGIRATI|GLOBANT|DIO|DEV\s+EM\s+DOBRO|SENAC|SENAI|SEBRAE|UNINASSAU|UNICAP|UNINTER|IFPE|UFPE|UFRPE|UNIVERSIDADE|FACULDADE|ESCOLA\s+TECNICA|INSTITUTO\s+FEDERAL|CENTRO\s+UNIVERSITARIO|ALURA|UDEMY|FUNDA[CC]AO\s+BRADESCO|FGV)\b/i);
    if (knownInstitution) return cleanupDetectedValue(knownInstitution[1]);

    return detectedCnpj ? `CNPJ: ${detectedCnpj}` : '';
  }

  function detectCertificateCode(asciiText) {
    const match = findFirstMatch(asciiText, [
      /\b(?:codigo\s+do\s+certificado|codigo\s+certificado|codigo|code|certificado\s+n[ºo])\s*[:\-]?\s*([A-Z0-9]{3,}(?:[-\/][A-Z0-9]{1,})+)\b/i,
      /\b([A-Z0-9]{5,}(?:-[A-Z0-9]{2,}){1,})\b/i
    ]);

    return match?.[1] ? cleanupDetectedValue(match[1]) : '';
  }

  function detectCourseOrEventName(asciiText, detectedTitle, originalText = '') {
    const originalLines = String(originalText || '')
      .split(/\r?\n+/)
      .map((line) => cleanupCourseName(normalizeForMatching(line)))
      .filter(Boolean);

    const patterns = [
      /\bJAVA\s+BASICO\s*\[\s*\d{1,3}\s*HORAS?\s*\]/i,
      /\bcurso\s+em\s+videoaula\s+([A-Z0-9][A-Za-z0-9 #+.'’&\/\-\[\]]{3,100}?)(?=\s+com\s+duracao|\s+com\s+duração|\s+realizando|\s+e\s+avaliacoes|\s+e\s+avaliações|$)/i,
      /\b(?:curso|oficina|minicurso|workshop|palestra|seminario|evento|feira|jornada|congresso)\s+(?:de|sobre|em)?\s*[:\-]?\s*([A-Z0-9][A-Za-z0-9 #+.'’&\/\-\[\]]{5,100})/i,
      /\btema\s*[:\-]\s*([A-Z0-9][A-Za-z0-9 #+.'’&\/\-\[\]]{5,100})/i,
      /\breferente\s+a[oa]?\s*[:\-]?\s*([A-Z0-9][A-Za-z0-9 #+.'’&\/\-\[\]]{5,100})/i
    ];

    for (const pattern of patterns) {
      const match = asciiText.match(pattern);
      if (match) return cleanupCourseName(match[1] || match[0]);
    }

    const titleLine = originalLines.find((line) => {
      if (/\b(?:certificado|certificamos|declaramos|codigo|cnpj|powered|lei)\b/i.test(line)) return false;
      return /\b(?:JAVA|BASICO|HTML|CSS|PYTHON|JAVASCRIPT|EXCEL|LOGICA|BANCO\s+DE\s+DADOS|HORAS?)\b/i.test(line);
    });

    if (titleLine) return cleanupCourseName(titleLine);

    const lines = asciiText
      .split(/(?<=\.)\s+|\n/)
      .map((line) => cleanupCourseName(line))
      .filter(Boolean);

    const blacklist = new Set([
      String(detectedTitle || '').toLowerCase(),
      'certificado',
      'declaracao',
      'certificamos que',
      'declaramos que'
    ]);

    const fallback = lines.find((line) => {
      const lower = line.toLowerCase();

      if (blacklist.has(lower)) return false;
      if (/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/.test(line)) return false;
      if (/\bcodigo\b|\bcnpj\b|\bpowered\b/i.test(line)) return false;

      return /\b(?:curso|oficina|minicurso|workshop|palestra|seminario|evento|feira|jornada|congresso|java|python|javascript|html|css|excel)\b/i.test(line);
    });

    return fallback || '';
  }

  function joinHumanList(items) {
    if (!items.length) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} e ${items[1]}`;

    return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
  }

  function normalizeFieldKey(field) {
    return normalizeForMatching(field).toLowerCase();
  }

  function formatOcrFieldLabel(field) {
    const labels = {
      titulo: 'título do certificado',
      'titulo do certificado': 'título do certificado',
      'título do certificado': 'título do certificado',
      'nome do participante': 'nome do participante',
      'carga horaria': 'carga horária',
      'carga horária': 'carga horária',
      data: 'data',
      instituicao: 'instituição',
      instituição: 'instituição',
      'curso/evento': 'curso/evento'
    };

    return labels[normalizeFieldKey(field)] || String(field || '').trim();
  }

  function dedupeOcrFields(fields) {
    const seen = new Set();

    return (Array.isArray(fields) ? fields : [])
      .map((field) => formatOcrFieldLabel(field))
      .filter(Boolean)
      .filter((field) => {
        const key = normalizeFieldKey(field);
        if (!key || seen.has(key)) return false;

        seen.add(key);
        return true;
      });
  }

  function buildHumanSummary(foundFields, missingFields, detectedCourseName, detectedHours) {
    const uniqueFoundFields = dedupeOcrFields(foundFields);
    const uniqueMissingFields = dedupeOcrFields(missingFields)
      .filter((field) => !uniqueFoundFields.some((foundField) => normalizeFieldKey(foundField) === normalizeFieldKey(field)));

    if (uniqueFoundFields.length <= 1 && uniqueMissingFields.length >= 4) {
      return 'OCR de apoio concluído: o texto extraído não trouxe informações suficientes para uma pré-análise confiável. Revise o certificado manualmente; a decisão final deve considerar os dados preenchidos no formulário.';
    }

    const parts = [];

    if (uniqueFoundFields.length) {
      const intro = uniqueMissingFields.length
        ? 'OCR de apoio concluído com pendências.'
        : 'OCR de apoio concluído.';

      parts.push(`${intro} Foram identificados ${joinHumanList(uniqueFoundFields)}.`);
    } else {
      parts.push('OCR de apoio concluído sem dados suficientes para pré-análise automática.');
    }

    if (uniqueMissingFields.length) {
      parts.push(`Campos que exigem conferência manual: ${joinHumanList(uniqueMissingFields)}.`);
    }

    if (detectedHours > 0) parts.push(`Carga horária detectada: ${detectedHours} h.`);
    if (detectedCourseName) parts.push(`Curso/evento detectado: ${detectedCourseName}.`);

    parts.push('O OCR é apenas apoio e não substitui a validação humana nem os dados obrigatórios informados no formulário.');

    return parts.join(' ');
  }

  function buildOcrReason(ocrStatus, missingFields) {
    const uniqueMissingFields = dedupeOcrFields(missingFields);

    let reason = 'O OCR identificou informações parciais. Confirme manualmente antes da decisão final.';

    if (ocrStatus === 'aprovado_automatico') {
      reason = 'Os principais dados foram encontrados com boa consistência, mas a validação humana continua obrigatória.';
    } else if (ocrStatus === 'rejeitado_automatico') {
      reason = 'O texto extraído não contém informações suficientes para apoiar a aprovação automática.';
    }

    if (uniqueMissingFields.length) {
      reason += ` Campos não identificados: ${joinHumanList(uniqueMissingFields)}.`;
    }

    return reason;
  }

  function buildRejectedOcrMissingReport({
    ocrStatus,
    missingFields,
    foundFields,
    detectedHours,
    detectedDate,
    detectedInstitution,
    detectedCnpj,
    detectedCourseName,
    detectedTitle,
    detectedName,
    expectedName
  }) {
    if (ocrStatus !== 'rejeitado_automatico') {
      return {
        shouldShow: false,
        title: '',
        message: '',
        missingFields: [],
        foundFields: dedupeOcrFields(foundFields),
        tips: []
      };
    }

    const uniqueMissingFields = dedupeOcrFields(missingFields);
    const uniqueFoundFields = dedupeOcrFields(foundFields);

    const tipsByField = {
      'título do certificado': 'Não foi identificado que o arquivo é um certificado ou declaração válida.',
      'nome do participante': expectedName
        ? `O nome esperado "${expectedName}" não foi encontrado no texto extraído.`
        : 'O nome do participante não foi encontrado no certificado.',
      'carga horária': 'Não foi encontrada uma carga horária válida, como "40 horas", "40 h" ou "40 hrs".',
      data: 'Não foi encontrada uma data válida, como "25/10/2025" ou "25 de outubro de 2025".',
      instituição: 'Não foi encontrada uma instituição válida. O sistema aceita nome da instituição, empresa LTDA ou CNPJ.',
      'curso/evento': 'Não foi identificado o nome do curso, evento, oficina, palestra ou atividade.'
    };

    const tips = uniqueMissingFields.map((field) => tipsByField[field] || `Campo não identificado: ${field}.`);

    const detectedParts = [];

    if (detectedTitle) detectedParts.push(`título: ${detectedTitle}`);
    if (detectedName) detectedParts.push(`nome: ${detectedName}`);
    if (detectedCourseName) detectedParts.push(`curso/evento: ${detectedCourseName}`);
    if (detectedHours > 0) detectedParts.push(`carga horária: ${detectedHours} h`);
    if (detectedDate) detectedParts.push(`data: ${detectedDate}`);
    if (detectedInstitution) detectedParts.push(`instituição: ${detectedInstitution}`);
    if (detectedCnpj) detectedParts.push(`CNPJ: ${detectedCnpj}`);

    const missingText = uniqueMissingFields.length
      ? `Campos faltando: ${joinHumanList(uniqueMissingFields)}.`
      : 'Nenhum campo faltante foi listado, mas a confiança do OCR foi baixa.';

    const foundText = detectedParts.length
      ? `Dados encontrados: ${detectedParts.join('; ')}.`
      : 'Nenhum dado confiável foi encontrado no certificado.';

    return {
      shouldShow: true,
      title: 'OCR rejeitado: informações obrigatórias não encontradas',
      message: `${missingText} ${foundText}`,
      missingFields: uniqueMissingFields,
      foundFields: uniqueFoundFields,
      tips
    };
  }

  function detectTextPatterns(text, expectedName = '') {
    const originalText = String(text || '');
    const normalized = originalText
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const asciiText = normalizeForMatching(normalized);
    const lowerAscii = asciiText.toLowerCase();
    const expectedAscii = normalizeForMatching(expectedName).toLowerCase();

    const hourMatch = findFirstMatch(asciiText, [
      /\b(?:carga\s*horaria|carga|duracao|duracao\s+total|dura(?:c|ç)[aã]o(?:\s+total)?)\s*[:\-]?\s*(?:de\s+)?(\d{1,3})\s*(?:horas?|hrs?|hs?|h)\b/i,
      /\[\s*(\d{1,3})\s*HORAS?\s*\]/i,
      /\b(\d{1,3})\s*(?:horas?|hrs?|hs?|h)\b/i,
      /\b(\d{1,3})\s*horas?\s*complementares\b/i
    ]);

    const dateMatch = asciiText.match(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/);
    const writtenDate = detectWrittenDate(asciiText);
    const detectedDate = dateMatch ? normalizeNumericDate(dateMatch[0]) : writtenDate;

    const detectedCnpj = detectCnpj(asciiText);
    const detectedInstitution = detectInstitution(asciiText);
    const detectedCode = detectCertificateCode(asciiText);

    const titleMatch = findFirstMatch(asciiText, [
      /\bcertificado\s+de\s+(participacao|conclusao|aprovacao|presenca)\b/i,
      /\bcertificado\b/i,
      /\bdeclaracao\b/i,
      /\bdeclaramos\s+que\b/i,
      /\bcertificamos\s+que\b/i
    ]);

    const titleLabelMap = {
      participacao: 'Certificado de Participação',
      conclusao: 'Certificado de Conclusão',
      aprovacao: 'Certificado de Aprovação',
      presenca: 'Certificado de Presença'
    };

    const detectedTitle = titleMatch
      ? (titleMatch[1] ? (titleLabelMap[titleMatch[1].toLowerCase()] || titleMatch[0]) : titleMatch[0])
      : '';

    const detectedName = expectedAscii && (lowerAscii.includes(expectedAscii) || isNameCompatible(expectedName, asciiText)) ? expectedName : '';
    const detectedHours = hourMatch ? Number(hourMatch[1]) : 0;
    const detectedCourseName = detectCourseOrEventName(asciiText, detectedTitle, normalized);

    const foundFields = [];
    const missingFields = [];

    let score = 0;

    if (detectedTitle) {
      foundFields.push('título do certificado');
      score += 2;
    } else {
      missingFields.push('título do certificado');
    }

    if (detectedName) {
      foundFields.push('nome do participante');
      score += 2;
    } else if (expectedName) {
      missingFields.push('nome do participante');
    }

    if (detectedHours > 0) {
      foundFields.push('carga horaria');
      score += 3;
    } else {
      missingFields.push('carga horaria');
    }

    if (detectedDate) {
      foundFields.push('data');
      score += 1;
    } else {
      missingFields.push('data');
    }

    if (detectedInstitution) {
      foundFields.push('instituicao');
      score += detectedCnpj ? 2 : 1;
    } else {
      missingFields.push('instituicao');
    }

    if (detectedCourseName) {
      foundFields.push('curso/evento');
      score += 2;
    } else {
      missingFields.push('curso/evento');
    }

    if (detectedTitle || /\b(curso|oficina|evento|seminario|declaracao)\b/i.test(lowerAscii)) {
      score += 1;
    }

    let ocrStatus = 'analise_manual';

    const hasCoreValidation = detectedHours > 0 && (detectedCourseName || detectedTitle) && (!expectedName || detectedName);
    const hasAnyUsefulData = detectedTitle || detectedHours > 0 || detectedInstitution || detectedDate || detectedCourseName || detectedName;

    if (!normalized || normalized.length < 20) {
      ocrStatus = 'rejeitado_automatico';
    } else if (hasCoreValidation && score >= 6) {
      ocrStatus = 'aprovado_automatico';
    } else if (!hasAnyUsefulData) {
      ocrStatus = 'rejeitado_automatico';
    }

    const normalizedFoundFields = dedupeOcrFields(foundFields);
    const normalizedMissingFields = dedupeOcrFields(missingFields)
      .filter((field) => !normalizedFoundFields.some((foundField) => normalizeFieldKey(foundField) === normalizeFieldKey(field)));

    let humanSummary = buildHumanSummary(normalizedFoundFields, normalizedMissingFields, detectedCourseName, detectedHours);

    if (detectedCode) humanSummary += ` Código do certificado detectado: ${detectedCode}.`;
    if (detectedCnpj) humanSummary += ` CNPJ detectado: ${detectedCnpj}.`;

    const ocrReason = buildOcrReason(ocrStatus, normalizedMissingFields);

    const rejectedMissingReport = buildRejectedOcrMissingReport({
      ocrStatus,
      missingFields: normalizedMissingFields,
      foundFields: normalizedFoundFields,
      detectedHours,
      detectedDate,
      detectedInstitution,
      detectedCnpj,
      detectedCourseName,
      detectedTitle,
      detectedName,
      expectedName
    });

    if (rejectedMissingReport.shouldShow) {
      humanSummary += ` ${rejectedMissingReport.message}`;

      if (rejectedMissingReport.tips.length) {
        humanSummary += ` Motivos: ${rejectedMissingReport.tips.join(' ')}`;
      }
    }

    return {
      extractedText: normalized,
      detectedHours,
      detectedName,
      detectedInstitution,
      detectedCnpj,
      detectedDate,
      detectedCode,
      detectedTitle,
      detectedCourseName,
      foundFields: normalizedFoundFields,
      missingFields: normalizedMissingFields,
      confidenceScore: score,
      humanSummary,
      ocrStatus,
      ocrReason,
      rejectedMissingReport
    };
  }

  async function extractPdfText(blob, pdfjsLib) {
    const arrayBuffer = await blob.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const textParts = [];
    const canvases = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ').trim();

      if (pageText.length > 20) {
        textParts.push(pageText);
        continue;
      }

      const viewport = page.getViewport({ scale: 2.25 });
      const canvas = document.createElement('canvas');

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.imageSmoothingEnabled = true;

      await page.render({ canvasContext: context, viewport }).promise;
      canvases.push(canvas);
    }

    const rawText = textParts.join('\n').trim();

    if (rawText.length > 30) return rawText;

    return { canvases };
  }

  async function runOcr(source, Tesseract) {
    const worker = await Tesseract.createWorker('por');

    try {
      const sources = Array.isArray(source) ? source : [source];
      const texts = [];

      for (const item of sources.filter(Boolean)) {
        const { data } = await worker.recognize(item);
        texts.push(data.text || '');
      }

      return texts.join('\n').trim();
    } finally {
      await worker.terminate();
    }
  }

  async function analyzeCertificateData(fileData, options = {}) {
    const { pdfjsLib, Tesseract } = await ensureDependencies();
    const blob = dataUrlToBlob(fileData);
    let extractedText = '';

    if (blob.type === 'application/pdf') {
      const pdfResult = await extractPdfText(blob, pdfjsLib);

      if (typeof pdfResult === 'string') {
        extractedText = pdfResult;
      } else {
        extractedText = await runOcr(pdfResult.canvases || pdfResult.canvas, Tesseract);
      }
    } else {
      extractedText = await runOcr(blob, Tesseract);
    }

    return detectTextPatterns(extractedText, options.expectedName || '');
  }


  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function formatDatePt(value) {
    if (!value) return 'Não informada';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('pt-BR');
  }

  function statusText(status) {
    const labels = {
      pendente: 'Em análise',
      em_analise: 'Em análise',
      aprovado: 'Aprovado',
      rejeitado: 'Rejeitado',
      removido: 'Removido da contagem',
      removido_da_contagem: 'Removido da contagem',
      aprovado_automatico: 'Aprovado',
      analise_manual: 'Em análise',
      nao_processado: 'Em análise',
      rejeitado_automatico: 'Rejeitado'
    };
    return labels[String(status || '').toLowerCase()] || 'Em análise';
  }

  function isRemovedFromCount(certificate) {
    const adminStatus = String(certificate?.adminStatus || '').toLowerCase();
    return adminStatus === 'removido' || adminStatus === 'removido_da_contagem';
  }

  function statusTone(certificate) {
    const adminStatus = String(certificate?.adminStatus || '').toLowerCase();
    const ocrStatus = String(certificate?.ocrStatus || '').toLowerCase();

    if (isRemovedFromCount(certificate)) return 'removed';
    if (adminStatus === 'rejeitado' || ocrStatus === 'rejeitado_automatico') return 'rejected';
    if (adminStatus === 'aprovado' || ocrStatus === 'aprovado_automatico') return 'approved';
    return 'review';
  }

  function batchStatus(certificates) {
    const list = Array.isArray(certificates) ? certificates : [];
    if (list.length && list.every((item) => statusTone(item) === 'approved')) return 'aprovado';
    if (list.length && list.every((item) => statusTone(item) === 'rejected')) return 'rejeitado';
    return 'em_analise';
  }

  function uniqueValues(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : [])
      .map((value) => cleanupDetectedValue(value))
      .filter(Boolean)
      .filter((value) => {
        const key = normalizeForMatching(value).toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function joinValues(values, fallback = 'Não identificado') {
    const unique = uniqueValues(values);
    if (!unique.length) return fallback;
    if (unique.length <= 3) return unique.join(' | ');
    return `${unique.slice(0, 3).join(' | ')} +${unique.length - 3}`;
  }

  function renderCertificateChip(certificate, index) {
    const tone = statusTone(certificate);
    const removed = isRemovedFromCount(certificate);
    const selected = index === 0 ? ' is-selected' : '';
    const detectedHours = removed ? 0 : (Number(certificate.detectedHours || certificate.approvedHours || certificate.declaredHours || 0) || 0);
    const labelStatus = removed ? 'removido' : (certificate.adminStatus === 'rejeitado' ? 'rejeitado' : certificate.ocrStatus);

    return `
      <div class="sigac-ocr-cert-chip is-${tone}${selected}" data-certificate-id="${escapeAttribute(certificate.id)}" tabindex="0" role="button" aria-label="Selecionar certificado ${index + 1}">
        <button type="button" class="ocr-remove-x remove-rejected-cert-btn" title="Retirar este certificado da contagem" aria-label="Retirar certificado ${index + 1} da contagem">X</button>
        <span>Certificado ${index + 1}</span>
        <strong title="${escapeAttribute(certificate.fileName || '')}">${escapeHtml(certificate.fileName || `certificado_${index + 1}`)}</strong>
        <em>${escapeHtml(statusText(labelStatus))}${detectedHours ? ` • ${detectedHours} h` : ''}</em>
      </div>
    `;
  }

  function renderCertificateDetailRows(certificates) {
    return certificates.map((certificate, index) => {
      const tone = statusTone(certificate);
      const detectedActivity = certificate.detectedCourseName || certificate.detectedTitle || 'Não identificado';
      const reason = certificate.ocrReason || certificate.humanSummary || 'Aguardando processamento do OCR.';
      return `
        <div class="sigac-ocr-detail-row is-${tone}" data-certificate-id="${escapeAttribute(certificate.id)}">
          <strong>Certificado ${index + 1}</strong>
          <span>${escapeHtml(certificate.fileName || '-')}</span>
          <span>${escapeHtml(statusText(isRemovedFromCount(certificate) ? 'removido' : (certificate.adminStatus === 'rejeitado' ? 'rejeitado' : certificate.ocrStatus)))}</span>
          <span>${escapeHtml(certificate.detectedName || 'Nome não identificado')}</span>
          <span>${escapeHtml(detectedActivity)}</span>
          <span>${Number(certificate.detectedHours || 0) || 0} h</span>
          <small>${escapeHtml(reason)}</small>
        </div>
      `;
    }).join('');
  }

  function renderCertificateBatchCard(payload = {}) {
    const request = payload.request || payload;
    const certificates = (Array.isArray(request.certificates) ? request.certificates : [])
      .slice(0, 10);
    const first = request.first || certificates[0] || {};
    const courseLabel = payload.courseLabel || request.courseLabel || first.sender?.course?.sigla || first.senderType || '-';
    const status = batchStatus(certificates);
    const countedCertificates = certificates.filter((item) => !isRemovedFromCount(item));
    const totalDetected = countedCertificates.reduce((sum, item) => sum + (Number(item.detectedHours || 0) || 0), 0);
    const totalApproved = countedCertificates.reduce((sum, item) => sum + (Number(item.approvedHours || 0) || 0), 0);
    const totalDeclared = countedCertificates.reduce((sum, item) => sum + (Number(item.declaredHours || 0) || 0), 0);
    const detectedActivity = joinValues(countedCertificates.map((item) => item.detectedCourseName || item.detectedTitle));
    const detectedInstitution = joinValues(countedCertificates.map((item) => item.detectedInstitution));
    const detectedDate = joinValues(countedCertificates.map((item) => item.detectedDate));
    const allRemoved = certificates.filter((item) => statusTone(item) === 'removed').length;
    const allRejected = certificates.filter((item) => statusTone(item) === 'rejected').length;
    const allApproved = certificates.filter((item) => statusTone(item) === 'approved').length;
    const allReview = Math.max(0, certificates.length - allRemoved - allRejected - allApproved);
    const defaultCertificateId = first.id || certificates[0]?.id || '';
    const feedback = first.adminFeedback || '';

    return `
      <article class="sigac-ocr-batch-card sigac-certificate-card is-${statusTone({ adminStatus: status, ocrStatus: status })}" data-default-certificate-id="${escapeAttribute(defaultCertificateId)}">
        <div class="sigac-ocr-batch-head">
          <div>
            <div class="eyebrow">Revisão de certificado</div>
            <h3>Aluno: ${escapeHtml(first.sender?.nome || 'Aluno removido')} <span class="sigac-ocr-status-pill is-${statusTone({ adminStatus: status, ocrStatus: status })}">${escapeHtml(statusText(status))}</span></h3>
            <p>${escapeHtml(first.sender?.email || 'Sem e-mail')} | ${escapeHtml(courseLabel)}</p>
          </div>
          <div class="sigac-ocr-batch-counters" aria-label="Resumo do lote">
            <span><strong>${certificates.length}</strong> enviados</span>
            <span class="is-approved"><strong>${allApproved}</strong> aprovados</span>
            <span class="is-review"><strong>${allReview}</strong> análise</span>
            <span class="is-rejected"><strong>${allRejected}</strong> rejeitados</span>
            ${allRemoved ? `<span class="is-removed"><strong>${allRemoved}</strong> removidos</span>` : ''}
          </div>
        </div>

        <div class="sigac-ocr-file-grid" aria-label="Certificados da solicitação">
          ${certificates.map(renderCertificateChip).join('')}
        </div>

        <section class="sigac-ocr-batch-summary" aria-label="Resumo do OCR">
          <h4>Resumo do OCR</h4>
          <div class="sigac-ocr-summary-table">
            <div class="sigac-ocr-summary-row sigac-ocr-summary-row--head"><strong>Campo</strong><strong>Informado</strong><strong>Detectado pelo OCR</strong></div>
            <div class="sigac-ocr-summary-row"><span>Nome da atividade</span><span>${escapeHtml(first.observation || 'Não informado')}</span><span>${escapeHtml(detectedActivity)}</span></div>
            <div class="sigac-ocr-summary-row"><span>Carga horária</span><span>${totalDeclared || Number(first.declaredHours || 0) || 0} h / total</span><span>${totalDetected} h / total</span></div>
            <div class="sigac-ocr-summary-row"><span>Horas aproveitadas</span><span>Limite aplicado na aprovação</span><span>${totalApproved} h</span></div>
            <div class="sigac-ocr-summary-row"><span>Instituição</span><span>Não informado</span><span>${escapeHtml(detectedInstitution)}</span></div>
            <div class="sigac-ocr-summary-row"><span>Data</span><span>${escapeHtml(formatDatePt(first.createdAt))}</span><span>${escapeHtml(detectedDate)}</span></div>
          </div>
        </section>

        <div class="actions-row sigac-ocr-actions admin-certificate-actions coordinator-certificate-actions">
          <button type="button" class="success approve-cert-btn approve-student-cert-btn ocr-approve-cert-btn">Aprovar</button>
          <button type="button" class="danger reject-cert-btn reject-student-cert-btn ocr-reject-cert-btn">Rejeitar</button>
          <button type="button" class="secondary run-ocr-btn ocr-process-cert-btn">Processar OCR</button>
          <button type="button" class="secondary download-cert-btn open-student-cert-btn ocr-open-file-btn">Abrir arquivo</button>
        </div>

        <div class="field admin-certificate-feedback coordinator-certificate-feedback-field sigac-ocr-feedback-box">
          <label>Feedback</label>
          <textarea class="certificate-feedback student-certificate-feedback ocr-feedback-text" placeholder="Comentário para o aluno">${escapeHtml(feedback)}</textarea>
        </div>

        <details class="sigac-ocr-details sigac-ocr-batch-details">
          <summary>Ver detalhes de cada certificado</summary>
          <div class="sigac-ocr-detail-grid">
            <div class="sigac-ocr-detail-row sigac-ocr-detail-head"><strong>#</strong><span>Arquivo</span><span>Status</span><span>Nome</span><span>Curso/evento</span><span>Horas</span><small>Motivo</small></div>
            ${renderCertificateDetailRows(certificates)}
          </div>
        </details>
      </article>
    `;
  }



  function getSelectedCertificateId(source) {
    const element = source && source.nodeType === 1 ? source : null;
    const direct = element?.closest?.('[data-certificate-id]')?.dataset?.certificateId;
    const batch = element?.closest?.('.sigac-ocr-batch-card');
    const selected = batch?.querySelector?.('.sigac-ocr-cert-chip.is-selected')?.dataset?.certificateId;
    return selected || direct || batch?.dataset?.defaultCertificateId || '';
  }

  function bindCertificateBatchSelection(root = document) {
    const scope = root || document;
    scope.querySelectorAll?.('.sigac-ocr-cert-chip')?.forEach((chip) => {
      if (chip.dataset.selectionBound === 'true') return;
      chip.dataset.selectionBound = 'true';

      const selectChip = () => {
        const batch = chip.closest('.sigac-ocr-batch-card');
        if (!batch) return;
        batch.querySelectorAll('.sigac-ocr-cert-chip.is-selected').forEach((item) => item.classList.remove('is-selected'));
        chip.classList.add('is-selected');
        batch.dataset.defaultCertificateId = chip.dataset.certificateId || batch.dataset.defaultCertificateId || '';
      };

      chip.addEventListener('click', (event) => {
        if (event.target?.closest?.('.ocr-remove-x')) return;
        selectChip();
      });
      chip.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectChip();
      });
    });
  }

  window.SIGACOCR = { analyzeCertificateData, renderCertificateBatchCard, getSelectedCertificateId, bindCertificateBatchSelection };
})();