/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Planejamento,
  TarefaPlanejamento,
  HistoricoPlanejamento,
  BpmnLane,
  BpmnNode,
  BpmnConnection,
  SeiProcessSyncMetadata,
  SeiRelatedProcessInfo,
  SeiDocumentInfo,
  Contrato,
  HistoricoContratual,
  Pagamento,
  StatusTarefa,
} from '../types';

export interface RawSeiAndamento {
  dataHora: string; // Ex: "18/10/2026 14:32" ou ISO
  unidade: string; // Ex: "SOF/GECTI", "MPO-CONJUR", "MGI-CGLIC"
  usuario?: string;
  descricao: string; // Ex: "Processo recebido na unidade", "Documento 45129834 assinado", "Processo remetido pela unidade..."
}

export interface RawSeiDocumento {
  idSei: string; // Ex: "45129834"
  tipo: string; // Ex: "Estudo Técnico Preliminar", "Termo de Referência", "Nota Técnica", "Despacho", "Parecer"
  numero?: string; // Ex: "14/2026"
  data?: string; // Ex: "15/10/2026"
  unidade?: string; // Ex: "GECTI"
  assinado: boolean;
  assinantes?: string[];
}

export interface RawSeiProcessoRelacionado {
  protocolo: string; // Ex: "19975.102345/2026-11"
  tipo: string; // Ex: " Financeiro: Pagamento / Liquidação", "Contratação: Aditivo Contratual"
  descricao?: string;
  ultimoAndamento?: string;
  dataUltimoAndamento?: string;
  unidadeAtual?: string;
  documentosDetectados?: RawSeiDocumento[];
}

export interface RawSeiProcessScrapeResult {
  protocolo: string; // Número do processo SEI (ex: "19975.000123/2026-99")
  tipoProcessoSei?: string;
  especificacao?: string;
  unidadesAbertas: string[]; // Unidades onde o processo está aberto neste exato momento no SEI
  andamentos: RawSeiAndamento[]; // Do mais recente para o mais antigo ou vice-versa
  documentos: RawSeiDocumento[];
  processosRelacionados: RawSeiProcessoRelacionado[];
  scrapedAt: string;
}

export interface UnitLaneMappingRule {
  pattern: string; // Ex: "GECTI", "CGTI", "DTI"
  laneId: string;
  laneNome: string;
  cor: string;
  ordem: number;
}

export const DEFAULT_SEI_UNIT_LANE_RULES: UnitLaneMappingRule[] = [
  {
    pattern: 'DEMANDANTE|SOF-GAB|SEAFI|SEORC|SEPLAN|DEST|SUB',
    laneId: 'lane-demandante',
    laneNome: 'Área Demandante',
    cor: '#0ea5e9',
    ordem: 1,
  },
  {
    pattern: 'GECTI|CGTI|DTI|STI|TIC|EQUIPE',
    laneId: 'lane-gecti',
    laneNome: 'Equipe de Planejamento (GECTI)',
    cor: '#10b981',
    ordem: 2,
  },
  {
    pattern: 'CONJUR|JURIDIC|AGU|PGFN',
    laneId: 'lane-conjur',
    laneNome: 'Assessoria Jurídica (CONJUR)',
    cor: '#8b5cf6',
    ordem: 3,
  },
  {
    pattern: 'CGLIC|COLIC|DLC|CENTRAL|COMPRAS|LICIT|PREGAO|SSC|CSC|MGI-D',
    laneId: 'lane-compras',
    laneNome: 'Compras e Licitações (CGLIC)',
    cor: '#f59e0b',
    ordem: 4,
  },
  {
    pattern: 'SAA|SPOA|AUTORIDADE|MINISTRO|SECRETARIO|DIRETOR|DGI|ordenador',
    laneId: 'lane-autoridade',
    laneNome: 'Autoridade Competente',
    cor: '#ec4899',
    ordem: 5,
  },
];

const LANE_PALETTE_COLORS = ['#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'];

/**
 * Normaliza número de processo SEI para comparação (apenas dígitos)
 */
export function normalizeSeiProtocol(proto?: string | null): string {
  if (!proto) return '';
  return String(proto).replace(/\D/g, '');
}

/**
 * Converte data pt-BR ("DD/MM/YYYY HH:mm" ou "DD/MM/YYYY") para ISO String
 */
export function parseSeiDateToIso(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString();
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const [, dd, mm, yyyy, hh = '12', min = '00', ss = '00'] = match;
    const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}-03:00`);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) return fallback.toISOString();
  return new Date().toISOString();
}

/**
 * Classifica um Processo Relacionado do SEI por categoria de interesse do Contratics
 */
export function classifyRelatedSeiProcess(
  tipo: string,
  descricao?: string,
  docs?: RawSeiDocumento[]
): SeiRelatedProcessInfo['categoria'] {
  const text = `${tipo || ''} ${descricao || ''} ${(docs || []).map(d => d.tipo).join(' ')}`.toUpperCase();
  if (/PAGAMENTO|LIQUIDA|FATURA|NOTA FISCAL|ATESTE|FINANCEIR|OB\b|ORDEM BANC/.test(text)) {
    return 'pagamento';
  }
  if (/ADITIV|PRORROGA|ACRESCIMO|SUPRESSAO|REEQUILIBR/.test(text)) {
    return 'aditivo';
  }
  if (/APOSTILA|REAJUSTE|REPACTUA/.test(text)) {
    return 'apostilamento';
  }
  if (/DESCENTRALIZA|TED\b|DESTAQUE|REPASSE|NC\b|NOTA DE CREDITO/.test(text)) {
    return 'descentralizacao';
  }
  if (/EMPENHO|NE\b/.test(text)) {
    return 'empenho';
  }
  if (/ORDEM DE SERVICO|O\.S\.|EXECUCAO|FISCALIZA/.test(text)) {
    return 'os';
  }
  return 'outro';
}

/**
 * Resolve uma sigla de unidade do SEI (ex: "SOF/GECTI", "MGI-CGLIC") para uma Raia BPMN
 */
export function resolveSeiUnitToLane(
  unidadeSei: string,
  existingLanes: BpmnLane[],
  customRules: UnitLaneMappingRule[] = DEFAULT_SEI_UNIT_LANE_RULES
): { lane: BpmnLane; isNew: boolean } {
  const cleanUnit = (unidadeSei || 'Unidade SEI').trim();
  const upperUnit = cleanUnit.toUpperCase();

  // 1. Verifica se já existe uma raia com o exato nome ou contendo a unidade
  const exactExisting = existingLanes.find(
    l => l.nome.toUpperCase() === upperUnit || l.id === `lane-sei-${cleanUnit.toLowerCase().replace(/[^a-z0-9]/g, '')}`
  );
  if (exactExisting) {
    return { lane: exactExisting, isNew: false };
  }

  // 2. Verifica pelas regras de mapeamento (Estúdio de Fluxo)
  for (const rule of customRules) {
    const regex = new RegExp(rule.pattern, 'i');
    if (regex.test(upperUnit)) {
      const matchedExisting = existingLanes.find(
        l => l.id === rule.laneId || l.nome.toLowerCase() === rule.laneNome.toLowerCase()
      );
      if (matchedExisting) {
        return { lane: matchedExisting, isNew: false };
      }
      return {
        lane: {
          id: rule.laneId,
          nome: rule.laneNome,
          cor: rule.cor,
          ordem: rule.ordem,
        },
        isNew: true,
      };
    }
  }

  // 3. Caso seja uma unidade específica ainda não mapeada, cria uma raia dedicada para ela
  const safeId = `lane-sei-${cleanUnit.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const colorIdx = existingLanes.length % LANE_PALETTE_COLORS.length;
  return {
    lane: {
      id: safeId,
      nome: cleanUnit,
      cor: LANE_PALETTE_COLORS[colorIdx],
      ordem: existingLanes.length + 1,
    },
    isNew: true,
  };
}

interface FlowStepSegment {
  unidade: string;
  lane: BpmnLane;
  dataEntradaIso: string;
  dataSaidaIso?: string;
  documentos: RawSeiDocumento[];
  andamentosResumo: string[];
  isCurrentOpenUnit: boolean;
}

/**
 * Motor "Estúdio de Fluxo SEI" -> Constrói e espelha o Fluxo BPMN 2.0 Oficial completo
 * para um processo de Planejamento a partir da leitura real do SEI.
 *
 * - Agrupa cronologicamente as passagens do processo pelas unidades (Raias/Swimlanes);
 * - Identifica os artefatos/documentos produzidos em cada passagem (DFD, ETP, TR, Parecer, Despacho, Edital...);
 * - Gera os nós de Início, Tarefas BPMN ordenadas por `ordemFluxo`, e Setas Ortogonais (`BpmnConnection`)
 *   conectando a sequência exata do fluxo entre as raias;
 * - Destaca exatamente o nó e a raia onde o processo se encontra aberto atualmente no SEI (`isCurrentSeiPosition`).
 */
export function buildBpmnFlowFromSeiScrape(
  planejamento: Planejamento,
  existingTarefas: TarefaPlanejamento[],
  existingHistorico: HistoricoPlanejamento[],
  scrape: RawSeiProcessScrapeResult,
  customRules: UnitLaneMappingRule[] = DEFAULT_SEI_UNIT_LANE_RULES
): {
  updatedPlanejamento: Planejamento;
  updatedTarefasForProcess: TarefaPlanejamento[];
  newHistoricoEntries: HistoricoPlanejamento[];
} {
  // Ordena andamentos do mais antigo para o mais recente para construir o fluxo da esquerda para a direita
  const sortedAndamentos = [...(scrape.andamentos || [])].sort((a, b) => {
    return new Date(parseSeiDateToIso(a.dataHora)).getTime() - new Date(parseSeiDateToIso(b.dataHora)).getTime();
  });

  const lanesMap = new Map<string, BpmnLane>();
  const initialLanes = planejamento.bpmnLanes && planejamento.bpmnLanes.length > 0 ? [...planejamento.bpmnLanes] : [];
  initialLanes.forEach(l => lanesMap.set(l.id, l));

  // Agrupa a trajetória do processo em segmentos por passagem em cada Unidade/Raia
  const segments: FlowStepSegment[] = [];

  for (const and of sortedAndamentos) {
    if (!and.unidade) continue;
    const { lane } = resolveSeiUnitToLane(and.unidade, Array.from(lanesMap.values()), customRules);
    if (!lanesMap.has(lane.id)) {
      lanesMap.set(lane.id, { ...lane, ordem: lanesMap.size + 1 });
    }
    const resolvedLane = lanesMap.get(lane.id)!;
    const isoDate = parseSeiDateToIso(and.dataHora);

    const lastSeg = segments[segments.length - 1];
    if (!lastSeg || lastSeg.lane.id !== resolvedLane.id) {
      if (lastSeg && !lastSeg.dataSaidaIso) {
        lastSeg.dataSaidaIso = isoDate;
      }
      segments.push({
        unidade: and.unidade,
        lane: resolvedLane,
        dataEntradaIso: isoDate,
        documentos: [],
        andamentosResumo: [and.descricao],
        isCurrentOpenUnit: false,
      });
    } else {
      lastSeg.andamentosResumo.push(and.descricao);
    }
  }

  // Caso a árvore de documentos tenha sido lida mas a tabela de andamentos estava resumida,
  // garante que cada documento também gere/alimente seu segmento na respectiva unidade
  const docs = scrape.documentos || [];
  for (const docItem of docs) {
    const docUnit = docItem.unidade || scrape.unidadesAbertas?.[0] || 'GECTI';
    const { lane } = resolveSeiUnitToLane(docUnit, Array.from(lanesMap.values()), customRules);
    if (!lanesMap.has(lane.id)) {
      lanesMap.set(lane.id, { ...lane, ordem: lanesMap.size + 1 });
    }
    const resolvedLane = lanesMap.get(lane.id)!;

    // Procura segmento compatível dessa mesma raia ou cria um
    let targetSeg = [...segments].reverse().find(s => s.lane.id === resolvedLane.id);
    if (!targetSeg) {
      targetSeg = {
        unidade: docUnit,
        lane: resolvedLane,
        dataEntradaIso: parseSeiDateToIso(docItem.data),
        documentos: [],
        andamentosResumo: [],
        isCurrentOpenUnit: false,
      };
      segments.push(targetSeg);
    }
    if (!targetSeg.documentos.some(d => d.idSei === docItem.idSei)) {
      targetSeg.documentos.push(docItem);
    }
  }

  // Garante que a unidade aberta atual do SEI esteja representada no final do fluxo
  const openUnits = scrape.unidadesAbertas && scrape.unidadesAbertas.length > 0
    ? scrape.unidadesAbertas
    : segments.length > 0
      ? [segments[segments.length - 1].unidade]
      : ['GECTI'];

  const primaryCurrentUnit = openUnits[0];
  const { lane: currentActiveLane } = resolveSeiUnitToLane(primaryCurrentUnit, Array.from(lanesMap.values()), customRules);
  if (!lanesMap.has(currentActiveLane.id)) {
    lanesMap.set(currentActiveLane.id, { ...currentActiveLane, ordem: lanesMap.size + 1 });
  }
  const activeLaneObj = lanesMap.get(currentActiveLane.id)!;

  if (segments.length === 0) {
    segments.push({
      unidade: primaryCurrentUnit,
      lane: activeLaneObj,
      dataEntradaIso: new Date().toISOString(),
      documentos: docs,
      andamentosResumo: ['Processo monitorado no SEI'],
      isCurrentOpenUnit: true,
    });
  } else {
    // Marca o último segmento correspondente à unidade aberta atual como posição ativa no SEI
    let markedActive = false;
    for (let i = segments.length - 1; i >= 0; i--) {
      if (
        segments[i].lane.id === activeLaneObj.id ||
        openUnits.some(u => u.toUpperCase() === segments[i].unidade.toUpperCase())
      ) {
        segments[i].isCurrentOpenUnit = true;
        markedActive = true;
        break;
      }
    }
    if (!markedActive) {
      segments.push({
        unidade: primaryCurrentUnit,
        lane: activeLaneObj,
        dataEntradaIso: new Date().toISOString(),
        documentos: [],
        andamentosResumo: [`Processo aberto na unidade ${primaryCurrentUnit}`],
        isCurrentOpenUnit: true,
      });
    }
  }

  // Limita a quantidade de segmentos se o histórico for muito longo (condensa repetições antigas mantendo a clareza visual do BPMN)
  const effectiveSegments = segments.length > 10
    ? [...segments.slice(0, 3), ...segments.slice(segments.length - 7)]
    : segments;

  const finalLanes = Array.from(lanesMap.values()).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  // Constrói Nós BPMN + Tarefas de cada etapa com `ordemFluxo` sequencial (1, 2, 3...)
  let stepOrder = 1;
  const firstSegment = effectiveSegments[0];
  const startNodeId = `node-sei-start-${normalizeSeiProtocol(planejamento.SEI_Processo).slice(-6) || '1'}`;

  const startNode: BpmnNode = {
    id: startNodeId,
    type: 'start',
    label: 'Autuação no SEI',
    laneId: firstSegment.lane.id,
    ordemFluxo: stepOrder++,
    seiUnidade: firstSegment.unidade,
    descricao: `Processo autuado em ${firstSegment.unidade}`,
  };

  const generatedNodes: BpmnNode[] = [startNode];
  const generatedTasks: TarefaPlanejamento[] = [];
  const generatedConnections: BpmnConnection[] = [];

  let previousElementId = startNodeId;
  let activeNodeId = startNodeId;

  effectiveSegments.forEach((seg, idx) => {
    const isLastSegment = idx === effectiveSegments.length - 1;
    const isActiveStep = seg.isCurrentOpenUnit && (isLastSegment || !effectiveSegments.slice(idx + 1).some(s => s.isCurrentOpenUnit));

    // Define título claro da atividade na raia com base nos documentos gerados naquela passagem ou andamento
    const relevantDocs = seg.documentos.filter(d => !/ANDAMENTO|REMESSA/i.test(d.tipo));
    let taskTitle = '';
    let docSeiRef = '';
    let allSigned = true;
    const signersList: string[] = [];

    if (relevantDocs.length > 0) {
      const mainDoc = relevantDocs[relevantDocs.length - 1];
      docSeiRef = mainDoc.idSei;
      const docTypeClean = mainDoc.tipo.trim();
      if (relevantDocs.length === 1) {
        taskTitle = `${docTypeClean}${mainDoc.numero ? ` ${mainDoc.numero}` : ''} (${seg.unidade})`;
      } else {
        taskTitle = `${docTypeClean} + ${relevantDocs.length - 1} doc(s) (${seg.unidade})`;
      }
      relevantDocs.forEach(d => {
        if (!d.assinado) allSigned = false;
        if (d.assinantes) signersList.push(...d.assinantes);
      });
    } else {
      const lastSummary = seg.andamentosResumo[seg.andamentosResumo.length - 1] || '';
      if (/ASSINAD/i.test(lastSummary)) {
        taskTitle = `Assinatura / Deliberação (${seg.unidade})`;
      } else if (/PARECER|JURIDIC/i.test(lastSummary)) {
        taskTitle = `Análise Jurídica (${seg.unidade})`;
      } else if (/EDITAL|PREGAO|LICITA/i.test(lastSummary)) {
        taskTitle = `Fase Externa / Licitação (${seg.unidade})`;
      } else if (idx === 0) {
        taskTitle = `Instrução Inicial da Demanda (${seg.unidade})`;
      } else {
        taskTitle = `Análise e Tramitação (${seg.unidade})`;
      }
    }

    // Calcula dias que permaneceu ou está na etapa
    const startMs = new Date(seg.dataEntradaIso).getTime();
    const endMs = seg.dataSaidaIso ? new Date(seg.dataSaidaIso).getTime() : Date.now();
    const elapsedDays = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));

    // Define Status_Tarefa coerente com a situação no SEI
    let statusTarefa: StatusTarefa = 'Concluído';
    if (isActiveStep) {
      if (relevantDocs.length > 0 && !allSigned) {
        statusTarefa = 'Aguardando Assinatura';
      } else {
        statusTarefa = 'Em Elaboração';
      }
    }

    const currentOrder = stepOrder++;
    const taskId = `tar-sei-${normalizeSeiProtocol(planejamento.SEI_Processo).slice(-6) || 'p'}-${idx + 1}`;

    // Verifica se já existia tarefa com este ID para preservar subtarefas ou prazos customizados
    const prevTask = existingTarefas.find(t => t.id === taskId);

    const newTask: TarefaPlanejamento = {
      id: taskId,
      ProcessoPlanejamento: planejamento.SEI_Processo,
      Tarefa: taskTitle,
      Inicio: seg.dataEntradaIso,
      Prazo_Dias: prevTask?.Prazo_Dias || Math.max(5, elapsedDays),
      Status_Tarefa: statusTarefa,
      areaResponsavel: seg.lane.nome,
      ordemFluxo: currentOrder,
      bpmnType: 'task',
      descricao: [
        `Unidade SEI: ${seg.unidade}`,
        docSeiRef ? `Documento SEI nº ${docSeiRef}` : '',
        seg.andamentosResumo.slice(-2).join(' | '),
      ]
        .filter(Boolean)
        .join(' • '),
      dataConclusao: statusTarefa === 'Concluído' ? (seg.dataSaidaIso || new Date().toISOString()) : undefined,
      MovidoPor: 'Sincronização SEI Pro Studio',
      MovidoEm: new Date().toISOString(),
      subTarefas: prevTask?.subTarefas || relevantDocs.map((d, dIdx) => ({
        id: `sub-${taskId}-${dIdx}`,
        titulo: `${d.tipo}${d.numero ? ` ${d.numero}` : ''} (SEI ${d.idSei})`,
        concluida: d.assinado,
      })),
      seiDocNumber: docSeiRef || undefined,
      seiUnidade: seg.unidade,
      isCurrentSeiPosition: isActiveStep,
      seiAssinado: relevantDocs.length > 0 ? allSigned : undefined,
      seiAssinantes: signersList.length > 0 ? Array.from(new Set(signersList)) : undefined,
    };

    generatedTasks.push(newTask);

    // Cria conexão ortogonal do elemento anterior para esta tarefa
    generatedConnections.push({
      id: `conn-sei-${idx + 1}`,
      fromId: previousElementId,
      toId: taskId,
      label: idx > 0 && effectiveSegments[idx - 1].lane.id !== seg.lane.id ? seg.unidade : '',
      tipo: 'sequence',
      cor: isActiveStep ? '#10b981' : '#0ea5e9',
      isSeiExecuted: true,
    });

    previousElementId = taskId;
    if (isActiveStep) {
      activeNodeId = taskId;
    }
  });

  // Se o planejamento já gerou contrato ou está concluído/arquivado, adiciona o nó de Fim
  if (planejamento.Status_Planejamento === 'Gerou Contrato' || planejamento.Status_Planejamento === 'Arquivado') {
    const lastSeg = effectiveSegments[effectiveSegments.length - 1];
    const endNodeId = `node-sei-end-${normalizeSeiProtocol(planejamento.SEI_Processo).slice(-6) || '1'}`;
    generatedNodes.push({
      id: endNodeId,
      type: 'end',
      label: planejamento.Status_Planejamento === 'Gerou Contrato' ? 'Contrato Assinado' : 'Processo Concluído',
      laneId: lastSeg.lane.id,
      ordemFluxo: stepOrder++,
      seiUnidade: lastSeg.unidade,
    });
    generatedConnections.push({
      id: `conn-sei-end`,
      fromId: previousElementId,
      toId: endNodeId,
      label: '',
      tipo: 'sequence',
      cor: '#10b981',
      isSeiExecuted: true,
    });
  }

  // Classifica processos relacionados
  const relatedClassified: SeiRelatedProcessInfo[] = (scrape.processosRelacionados || []).map(rel => ({
    protocolo: rel.protocolo,
    tipo: rel.tipo,
    categoria: classifyRelatedSeiProcess(rel.tipo, rel.descricao, rel.documentosDetectados),
    descricao: rel.descricao,
    ultimoAndamento: rel.ultimoAndamento,
    dataUltimoAndamento: rel.dataUltimoAndamento,
    unidadeAtual: rel.unidadeAtual,
    documentosDetectados: rel.documentosDetectados,
  }));

  const latestAndamento = sortedAndamentos[sortedAndamentos.length - 1];
  const activeTask = generatedTasks.find(t => t.isCurrentSeiPosition) || generatedTasks[generatedTasks.length - 1];
  const diasNaUnidadeAtual = activeTask
    ? Math.max(0, Math.floor((Date.now() - new Date(activeTask.Inicio).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const seiSyncMetadata: SeiProcessSyncMetadata = {
    lastSyncAt: scrape.scrapedAt || new Date().toISOString(),
    unidadesAbertas: openUnits,
    unidadeAtual: primaryCurrentUnit,
    ultimoAndamento: latestAndamento?.descricao || activeTask?.Tarefa || 'Sincronizado via SEI',
    ultimaDataAndamento: latestAndamento?.dataHora || new Date().toLocaleDateString('pt-BR'),
    activeNodeId,
    activeLaneId: activeLaneObj.id,
    activeLaneNome: activeLaneObj.nome,
    diasNaUnidadeAtual,
    processosRelacionados: relatedClassified,
    documentosArvore: (scrape.documentos || []).slice(-30),
    etapasMapeadasCount: generatedTasks.length,
  };

  // Gera novos registros de HistoricoPlanejamento para documentos/andamentos ainda não registrados
  const existingHistKeys = new Set(
    existingHistorico
      .filter(h => h.Processo_SEI === planejamento.SEI_Processo)
      .map(h => `${h.Num_SEI || ''}-${(h.Descricao || '').slice(0, 40)}`)
  );

  const newHistoricoEntries: HistoricoPlanejamento[] = [];
  for (const d of (scrape.documentos || []).slice(-15)) {
    const desc = `${d.tipo}${d.numero ? ` nº ${d.numero}` : ''}${d.assinado ? ' (Assinado)' : ' (Minuta/Pendente)'}`;
    const key = `${d.idSei}-${desc.slice(0, 40)}`;
    if (!existingHistKeys.has(key)) {
      existingHistKeys.add(key);
      newHistoricoEntries.push({
        id: `hist-sei-${normalizeSeiProtocol(planejamento.SEI_Processo).slice(-5)}-${d.idSei}`,
        Processo_SEI: planejamento.SEI_Processo,
        Data: parseSeiDateToIso(d.data).slice(0, 10),
        Descricao: desc,
        Num_SEI: d.idSei,
        Coordenacao: d.unidade || primaryCurrentUnit,
      });
    }
  }

  const updatedPlanejamento: Planejamento = {
    ...planejamento,
    bpmnLanes: finalLanes,
    bpmnNodes: generatedNodes,
    bpmnConnections: generatedConnections,
    seiSyncMetadata,
    updatedAt: new Date().toISOString(),
  };

  return {
    updatedPlanejamento,
    updatedTarefasForProcess: generatedTasks,
    newHistoricoEntries,
  };
}

/**
 * Atualiza um Contrato vigente com os dados lidos do SEI (incluindo Processos Relacionados de Pagamento, Aditivos, Apostilamentos, Descentralizações e Ocorrências)
 */
export function applySeiScrapeToContrato(
  contrato: Contrato,
  existingHistoricoContratual: HistoricoContratual[],
  existingPagamentos: Pagamento[],
  scrape: RawSeiProcessScrapeResult
): {
  updatedContrato: Contrato;
  newHistoricoContratual: HistoricoContratual[];
  updatedPagamentos: Pagamento[];
} {
  const sortedAndamentos = [...(scrape.andamentos || [])].sort((a, b) => {
    return new Date(parseSeiDateToIso(a.dataHora)).getTime() - new Date(parseSeiDateToIso(b.dataHora)).getTime();
  });
  const latestAndamento = sortedAndamentos[sortedAndamentos.length - 1];
  const openUnits = scrape.unidadesAbertas && scrape.unidadesAbertas.length > 0
    ? scrape.unidadesAbertas
    : [latestAndamento?.unidade || 'GECTI'];

  const relatedClassified: SeiRelatedProcessInfo[] = (scrape.processosRelacionados || []).map(rel => ({
    protocolo: rel.protocolo,
    tipo: rel.tipo,
    categoria: classifyRelatedSeiProcess(rel.tipo, rel.descricao, rel.documentosDetectados),
    descricao: rel.descricao,
    ultimoAndamento: rel.ultimoAndamento,
    dataUltimoAndamento: rel.dataUltimoAndamento,
    unidadeAtual: rel.unidadeAtual,
    documentosDetectados: rel.documentosDetectados,
  }));

  const seiSyncMetadata: SeiProcessSyncMetadata = {
    lastSyncAt: scrape.scrapedAt || new Date().toISOString(),
    unidadesAbertas: openUnits,
    unidadeAtual: openUnits[0] || 'GECTI',
    ultimoAndamento: latestAndamento?.descricao || 'Processo monitorado no SEI',
    ultimaDataAndamento: latestAndamento?.dataHora || new Date().toLocaleDateString('pt-BR'),
    processosRelacionados: relatedClassified,
    documentosArvore: (scrape.documentos || []).slice(-30),
  };

  const existingHistKeys = new Set(
    existingHistoricoContratual
      .filter(h => h.ContratoRelacionado === contrato.id)
      .map(h => `${h.Numero_SEI || ''}-${(h.Descricao || '').slice(0, 40)}`)
  );

  const newHistoricoContratual: HistoricoContratual[] = [];
  for (const d of (scrape.documentos || []).slice(-15)) {
    const desc = `[SEI] ${d.tipo}${d.numero ? ` nº ${d.numero}` : ''}${d.assinado ? ' (Assinado)' : ' (Em elaboração)'}`;
    const key = `${d.idSei}-${desc.slice(0, 40)}`;
    if (!existingHistKeys.has(key)) {
      existingHistKeys.add(key);
      newHistoricoContratual.push({
        id: `hcont-sei-${contrato.id}-${d.idSei}`,
        Data: parseSeiDateToIso(d.data).slice(0, 10),
        ContratoRelacionado: contrato.id,
        Descricao: desc,
        Numero_SEI: d.idSei,
        Coordenacao: d.unidade || openUnits[0] || 'GECTI',
      });
    }
  }

  return {
    updatedContrato: {
      ...contrato,
      seiSyncMetadata,
      Data_Ultima_Atualizacao: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
    },
    newHistoricoContratual,
    updatedPagamentos: existingPagamentos,
  };
}
