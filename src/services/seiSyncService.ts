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
  Contrato,
  HistoricoContratual,
  Pagamento,
  StatusTarefa,
} from '../types';

export interface RawSeiAndamento {
  dataHora: string; // Ex: "18/10/2026 14:32" ou ISO
  unidade: string; // Ex: "SOF/GECTI", "MPO-CONJUR", "MGI-CGLIC"
  usuario?: string;
  descricao: string; // Ex: "Processo recebido na unidade", "Documento 45129834 assinado"
}

export interface RawSeiDocumento {
  idSei: string; // Ex: "45129834"
  tipo: string; // Ex: "Estudo Técnico Preliminar", "Termo de Referência", "Nota Técnica", "Parecer"
  numero?: string; // Ex: "14/2026"
  data?: string; // Ex: "15/10/2026"
  unidade?: string; // Ex: "GECTI"
  assinado: boolean;
  assinantes?: string[];
}

export interface RawSeiProcessoRelacionado {
  protocolo: string; // Ex: "19975.102345/2026-11"
  tipo: string;
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
  andamentos: RawSeiAndamento[];
  documentos: RawSeiDocumento[];
  processosRelacionados: RawSeiProcessoRelacionado[];
  scrapedAt: string;
}

export interface UnitLaneMappingRule {
  pattern: string;
  laneId: string;
  laneNome: string;
  cor: string;
  ordem: number;
}

/**
 * Regras padrão de Raias alinhadas aos Atores Oficiais do Fluxo da IN SGD/ME nº 94/2022
 * (gov.br/governodigital/pt-br/contratacoes-de-tic/.../fluxo-in-94-22)
 */
export const DEFAULT_SEI_UNIT_LANE_RULES: UnitLaneMappingRule[] = [
  {
    pattern: 'DEMANDANTE|SOF-GAB|SEAFI|SEORC|SEPLAN|DEST|SUB|CGPLAN|REQUISIT',
    laneId: 'lane-demandante',
    laneNome: 'Área Requisitante / Demandante',
    cor: '#0ea5e9',
    ordem: 1,
  },
  {
    pattern: 'GECTI|CGTI|DTI|STI|TIC|EQUIPE|CPCTI|EPCON|SGD|CGOV|COTEC|COORD',
    laneId: 'lane-gecti',
    laneNome: 'Equipe de Planejamento / TIC (GECTI)',
    cor: '#10b981',
    ordem: 2,
  },
  {
    pattern: 'COFAC|CGOF|ORCAMENT|FINANC|SPOA|DIORF|CGO|FNC',
    laneId: 'lane-orcamento',
    laneNome: 'Orçamento e Finanças (COFAC / SPOA)',
    cor: '#06b6d4',
    ordem: 3,
  },
  {
    pattern: 'CGLIC|COLIC|DLC|CENTRAL|COMPRAS|LICIT|PREGAO|SSC|CSC|DCD|DELIC|CPL',
    laneId: 'lane-compras',
    laneNome: 'Compras e Licitações (CGLIC)',
    cor: '#f59e0b',
    ordem: 4,
  },
  {
    pattern: 'CONJUR|JURIDIC|AGU|PGFN|CJ|CONSULTORIA',
    laneId: 'lane-conjur',
    laneNome: 'Assessoria Jurídica (CONJUR / AGU)',
    cor: '#8b5cf6',
    ordem: 5,
  },
  {
    pattern: 'SAA|AUTORIDADE|MINISTRO|SECRETARIO|DIRETOR|DGI|ORDENADOR|GAB',
    laneId: 'lane-autoridade',
    laneNome: 'Autoridade Competente',
    cor: '#ec4899',
    ordem: 6,
  },
];

const LANE_PALETTE_COLORS = ['#0ea5e9', '#10b981', '#06b6d4', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

/**
 * Repara textos corrompidos por falha de encoding ISO-8859-1 / UTF-8 (ex: "Certificao de Disponibilidade Oramentria" -> "Certificação de Disponibilidade Orçamentária")
 */
export function repairMojibakeAndBrokenChars(input?: string | null): string {
  if (!input) return '';
  let s = String(input);

  // 1. Caso haja Mojibake clássico de UTF-8 lido como Latin-1 (ex: "Ã§Ã£o" -> "ção")
  if (/Ã[§£¡©ªº³µ¢ê]|Âº|Âª/.test(s)) {
    try {
      const bytes = new Uint8Array([...s].map(ch => ch.charCodeAt(0) & 0xff));
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (decoded && !decoded.includes('\uFFFD')) {
        s = decoded;
      }
    } catch {
      // Continua para as regras de substituição direta
    }
  }

  if (!s.includes('\uFFFD')) {
    return s;
  }

  // 2. Dicionário de palavras frequentes do SEI / Contratações Públicas com caracteres de substituição (\uFFFD / )
  const replacements: Array<[RegExp, string]> = [
    [/Certifica\uFFFD+o/gi, 'Certificação'],
    [/Or\uFFFD+ament\uFFFD+ri([oa]s?)/gi, 'Orçamentári$1'],
    [/Or\uFFFD+amento(s?)/gi, 'Orçamento$1'],
    [/Contrata\uFFFD+o/gi, 'Contratação'],
    [/Contrata\uFFFD+es/gi, 'Contratações'],
    [/Licita\uFFFD+o/gi, 'Licitação'],
    [/Licita\uFFFD+es/gi, 'Licitações'],
    [/Preg\uFFFD+o/gi, 'Pregão'],
    [/Preg\uFFFD+es/gi, 'Pregões'],
    [/Eletr\uFFFD+nic([oa]s?)/gi, 'Eletrônic$1'],
    [/T\uFFFD+cnic([oa]s?)/gi, 'Técnic$1'],
    [/Jur\uFFFD+dic([oa]s?)/gi, 'Jurídic$1'],
    [/An\uFFFD+lise(s?)/gi, 'Análise$1'],
    [/Refer\uFFFD+ncia(s?)/gi, 'Referência$1'],
    [/Ci\uFFFD+ncia/gi, 'Ciência'],
    [/Experi\uFFFD+ncia/gi, 'Experiência'],
    [/Exig\uFFFD+ncia(s?)/gi, 'Exigência$1'],
    [/Vig\uFFFD+ncia(s?)/gi, 'Vigência$1'],
    [/Ocorr\uFFFD+ncia(s?)/gi, 'Ocorrência$1'],
    [/Provid\uFFFD+ncia(s?)/gi, 'Providência$1'],
    [/Pend\uFFFD+ncia(s?)/gi, 'Pendência$1'],
    [/Urg\uFFFD+ncia/gi, 'Urgência'],
    [/Ger\uFFFD+ncia/gi, 'Gerência'],
    [/Concorr\uFFFD+ncia/gi, 'Concorrência'],
    [/Transpar\uFFFD+ncia/gi, 'Transparência'],
    [/Efici\uFFFD+ncia/gi, 'Eficiência'],
    [/Informa\uFFFD+o/gi, 'Informação'],
    [/Informa\uFFFD+es/gi, 'Informações'],
    [/Declara\uFFFD+o/gi, 'Declaração'],
    [/Instru\uFFFD+o/gi, 'Instrução'],
    [/Solu\uFFFD+o/gi, 'Solução'],
    [/Solu\uFFFD+es/gi, 'Soluções'],
    [/Servi\uFFFD+o(s?)/gi, 'Serviço$1'],
    [/Pre\uFFFD+o(s?)/gi, 'Preço$1'],
    [/Prorroga\uFFFD+o/gi, 'Prorrogação'],
    [/Altera\uFFFD+o/gi, 'Alteração'],
    [/Fiscaliza\uFFFD+o/gi, 'Fiscalização'],
    [/Execu\uFFFD+o/gi, 'Execução'],
    [/Designa\uFFFD+o/gi, 'Designação'],
    [/Institui\uFFFD+o/gi, 'Instituição'],
    [/Formaliza\uFFFD+o/gi, 'Formalização'],
    [/Publica\uFFFD+o/gi, 'Publicação'],
    [/Homologa\uFFFD+o/gi, 'Homologação'],
    [/Adjudica\uFFFD+o/gi, 'Adjudicação'],
    [/Aprova\uFFFD+o/gi, 'Aprovação'],
    [/Delibera\uFFFD+o/gi, 'Deliberação'],
    [/Tramita\uFFFD+o/gi, 'Tramitação'],
    [/Elabora\uFFFD+o/gi, 'Elaboração'],
    [/Aquisi\uFFFD+o/gi, 'Aquisição'],
    [/Renova\uFFFD+o/gi, 'Renovação'],
    [/Ades\uFFFD+o/gi, 'Adesão'],
    [/Decis\uFFFD+o/gi, 'Decisão'],
    [/Comiss\uFFFD+o/gi, 'Comissão'],
    [/Coordena\uFFFD+o/gi, 'Coordenação'],
    [/Dire\uFFFD+o/gi, 'Direção'],
    [/Administra\uFFFD+o/gi, 'Administração'],
    [/Gest\uFFFD+o/gi, 'Gestão'],
    [/Dotac?\uFFFD+o/gi, 'Dotação'],
    [/Dota\uFFFD+o/gi, 'Dotação'],
    [/Liquida\uFFFD+o/gi, 'Liquidação'],
    [/Retifica\uFFFD+o/gi, 'Retificação'],
    [/Ratifica\uFFFD+o/gi, 'Ratificação'],
    [/Notifica\uFFFD+o/gi, 'Notificação'],
    [/Qualifica\uFFFD+o/gi, 'Qualificação'],
    [/Habilita\uFFFD+o/gi, 'Habilitação'],
    [/Classifica\uFFFD+o/gi, 'Classificação'],
    [/Especifica\uFFFD+o/gi, 'Especificação'],
    [/Manifesta\uFFFD+o/gi, 'Manifestação'],
    [/Justifica\uFFFD+o/gi, 'Justificação'],
    [/Repactua\uFFFD+o/gi, 'Repactuação'],
    [/Supress\uFFFD+o/gi, 'Supressão'],
    [/Acr\uFFFD+scimo(s?)/gi, 'Acréscimo$1'],
    [/Reequil\uFFFD+brio/gi, 'Reequilíbrio'],
    [/Econ\uFFFD+mic([oa]s?)/gi, 'Econômic$1'],
    [/Conclu\uFFFD+d([oa]s?)/gi, 'Concluíd$1'],
    [/Inclu\uFFFD+d([oa]s?)/gi, 'Incluíd$1'],
    [/Atribu\uFFFD+d([oa]s?)/gi, 'Atribuíd$1'],
    [/N\uFFFD+mero(s?)/gi, 'Número$1'],
    [/Of\uFFFD+cio(s?)/gi, 'Ofício$1'],
    [/Relat\uFFFD+rio(s?)/gi, 'Relatório$1'],
    [/Provis\uFFFD+ri([oa]s?)/gi, 'Provisóri$1'],
    [/Usu\uFFFD+rio(s?)/gi, 'Usuário$1'],
    [/Necess\uFFFD+ri([oa]s?)/gi, 'Necessári$1'],
    [/Ordin\uFFFD+ri([oa]s?)/gi, 'Ordinári$1'],
    [/Extraordin\uFFFD+ri([oa]s?)/gi, 'Extraordinári$1'],
    [/Banc\uFFFD+ri([oa]s?)/gi, 'Bancári$1'],
    [/Tribut\uFFFD+ri([oa]s?)/gi, 'Tributári$1'],
    [/Unit\uFFFD+ri([oa]s?)/gi, 'Unitári$1'],
    [/P\uFFFD+blic([oa]s?)/gi, 'Públic$1'],
    [/M\uFFFD+nim([oa]s?)/gi, 'Mínim$1'],
    [/M\uFFFD+xim([oa]s?)/gi, 'Máxim$1'],
    [/\uFFFD+ltim([oa]s?)/gi, 'Últim$1'],
    [/\uFFFD+nic([oa]s?)/gi, 'Únic$1'],
    [/\uFFFD+rg\uFFFD+o(s?)/gi, 'Órgão$1'],
    [/B\uFFFD+sic([oa]s?)/gi, 'Básic$1'],
    [/Pr\uFFFD+vi([oa]s?)/gi, 'Prévi$1'],
    [/M\uFFFD+dio(s?)/gi, 'Médio$1'],
    [/In\uFFFD+cio/gi, 'Início'],
    [/Tr\uFFFD+mite(s?)/gi, 'Trâmite$1'],
    [/N\uFFFD+vel/gi, 'Nível'],
    [/Respons\uFFFD+vel/gi, 'Responsável'],
    [/Vi\uFFFD+vel/gi, 'Viável'],
    [/Favor\uFFFD+vel/gi, 'Favorável'],
    [/Aplic\uFFFD+vel/gi, 'Aplicável'],
    [/ N\uFFFD+o\b/gi, ' Não'],
    [/^N\uFFFD+o\b/gi, 'Não'],
    [/\bS\uFFFD+o\b/g, 'São'],
    [/\bEst\uFFFD+o\b/gi, 'Estão'],
    [/\bEst\uFFFD+\b/gi, 'Está'],
    [/\bJ\uFFFD+\b/gi, 'Já'],
    [/\bH\uFFFD+\b/gi, 'Há'],
    [/\bM\uFFFD+s\b/gi, 'Mês'],
    [/\bn\uFFFD+\s*(\d)/gi, 'nº $1'],
    // Sufixos morfológicos gerais da língua portuguesa para capturar qualquer outra palavra
    [/([a-zA-Z])\uFFFD\uFFFDo\b/g, '$1ção'],
    [/([a-zA-Z])\uFFFD\uFFFDes\b/g, '$1ções'],
    [/([a-zA-Z])c\uFFFDo\b/g, '$1ção'],
    [/([a-zA-Z])a\uFFFDo\b/g, '$1ação'],
    [/([a-zA-Z])\uFFFDria\b/g, '$1ária'],
    [/([a-zA-Z])\uFFFDrio\b/g, '$1ário'],
    [/([a-zA-Z])\uFFFDncia\b/g, '$1ência'],
    [/\uFFFD+/g, ''],
  ];

  for (const [regex, rep] of replacements) {
    s = s.replace(regex, rep);
  }

  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Sanitiza todos os campos textuais de um pacote lido do SEI
 */
export function sanitizeScrapeResult(raw: RawSeiProcessScrapeResult): RawSeiProcessScrapeResult {
  return {
    ...raw,
    protocolo: repairMojibakeAndBrokenChars(raw.protocolo),
    tipoProcessoSei: repairMojibakeAndBrokenChars(raw.tipoProcessoSei),
    especificacao: repairMojibakeAndBrokenChars(raw.especificacao),
    unidadesAbertas: (raw.unidadesAbertas || []).map(u => repairMojibakeAndBrokenChars(u)),
    andamentos: (raw.andamentos || []).map(a => ({
      ...a,
      dataHora: repairMojibakeAndBrokenChars(a.dataHora),
      unidade: repairMojibakeAndBrokenChars(a.unidade),
      usuario: repairMojibakeAndBrokenChars(a.usuario),
      descricao: repairMojibakeAndBrokenChars(a.descricao),
    })),
    documentos: (raw.documentos || []).map(d => ({
      ...d,
      idSei: repairMojibakeAndBrokenChars(d.idSei),
      tipo: repairMojibakeAndBrokenChars(d.tipo),
      numero: d.numero ? repairMojibakeAndBrokenChars(d.numero) : undefined,
      data: d.data ? repairMojibakeAndBrokenChars(d.data) : undefined,
      unidade: d.unidade ? repairMojibakeAndBrokenChars(d.unidade) : undefined,
      assinantes: d.assinantes ? d.assinantes.map(s => repairMojibakeAndBrokenChars(s)) : undefined,
    })),
    processosRelacionados: (raw.processosRelacionados || []).map(r => ({
      ...r,
      protocolo: repairMojibakeAndBrokenChars(r.protocolo),
      tipo: repairMojibakeAndBrokenChars(r.tipo),
      descricao: r.descricao ? repairMojibakeAndBrokenChars(r.descricao) : undefined,
      ultimoAndamento: r.ultimoAndamento ? repairMojibakeAndBrokenChars(r.ultimoAndamento) : undefined,
      unidadeAtual: r.unidadeAtual ? repairMojibakeAndBrokenChars(r.unidadeAtual) : undefined,
      documentosDetectados: r.documentosDetectados
        ? r.documentosDetectados.map(dd => ({
            ...dd,
            tipo: repairMojibakeAndBrokenChars(dd.tipo),
            numero: dd.numero ? repairMojibakeAndBrokenChars(dd.numero) : undefined,
          }))
        : undefined,
    })),
  };
}

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
 * Resolve uma sigla de unidade do SEI (ex: "SOF/GECTI", "MGI-DCD-CGLIC", "MPO-SOF-COFAC") para uma Raia BPMN
 */
export function resolveSeiUnitToLane(
  unidadeSei: string,
  existingLanes: BpmnLane[],
  customRules: UnitLaneMappingRule[] = DEFAULT_SEI_UNIT_LANE_RULES
): { lane: BpmnLane; isNew: boolean } {
  const cleanUnit = repairMojibakeAndBrokenChars(unidadeSei || 'Unidade SEI').trim();
  const upperUnit = cleanUnit.toUpperCase();

  // 1. Verifica pelas regras de mapeamento do Estúdio de Fluxo (IN 94/2022)
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

  // 2. Verifica se já existe uma raia com o exato nome
  const exactExisting = existingLanes.find(
    l => l.nome.toUpperCase() === upperUnit || l.id === `lane-sei-${cleanUnit.toLowerCase().replace(/[^a-z0-9]/g, '')}`
  );
  if (exactExisting) {
    return { lane: exactExisting, isNew: false };
  }

  // 3. Caso seja uma unidade específica não coberta pelas regras, cria raia dedicada
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

// ============================================================================
// CATÁLOGO OFICIAL DE MARCOS DA IN SGD/ME Nº 94/2022 (GOV.BR / GOVERNO DIGITAL)
// https://www.gov.br/governodigital/pt-br/contratacoes-de-tic/orientacoes-e-apoio-especializado/fluxo-do-processo-de-contratacao-de-tic/fluxo-in-94-22
// ============================================================================

export interface In94MilestoneDefinition {
  code: string;
  ordemMacro: number;
  faseIn94: 'Planejamento da Contratação (PCTIC)' | 'Seleção do Fornecedor (SFTI)' | 'Gestão do Contrato (GCTI)';
  tituloMarco: string;
  prazoPadraoDias: number;
  defaultUnitHint: string;
  /** Pergunta do Gateway BPMN Exclusivo (✕) após este marco, quando aplicável no fluxo da IN 94/2022 */
  gatewayAfter?: {
    label: string;
    yesBranchLabel: string;
    descricao: string;
  };
}

export const IN94_OFFICIAL_MILESTONES: In94MilestoneDefinition[] = [
  {
    code: 'M1_DFD',
    ordemMacro: 1,
    faseIn94: 'Planejamento da Contratação (PCTIC)',
    tituloMarco: '1. Formalização da Demanda (DFD e PCA)',
    prazoPadraoDias: 10,
    defaultUnitHint: 'DEMANDANTE',
    gatewayAfter: {
      label: 'Demanda Aprovada (PCA/PDTIC)?',
      yesBranchLabel: 'Aprovada',
      descricao: 'Avaliação de alinhamento ao PDTIC/PCA e encaminhamento para instituir a EPC (Art. 10, IN 94/2022).',
    },
  },
  {
    code: 'M2_EPC',
    ordemMacro: 2,
    faseIn94: 'Planejamento da Contratação (PCTIC)',
    tituloMarco: '2. Instituição da Equipe de Planejamento (EPC)',
    prazoPadraoDias: 7,
    defaultUnitHint: 'GECTI',
  },
  {
    code: 'M3_ETP_RISCOS',
    ordemMacro: 3,
    faseIn94: 'Planejamento da Contratação (PCTIC)',
    tituloMarco: '3. Estudo Técnico Preliminar (ETP) e Mapa de Riscos',
    prazoPadraoDias: 20,
    defaultUnitHint: 'GECTI',
    gatewayAfter: {
      label: 'Solução Viável (ETP Aprovado)?',
      yesBranchLabel: 'Viável',
      descricao: 'Aprovação da viabilidade técnica/econômica do ETP e Matriz de Gerenciamento de Riscos (Art. 11, IN 94/2022).',
    },
  },
  {
    code: 'M4_TR',
    ordemMacro: 4,
    faseIn94: 'Planejamento da Contratação (PCTIC)',
    tituloMarco: '4. Termo de Referência (TR) e Pesquisa de Preços',
    prazoPadraoDias: 20,
    defaultUnitHint: 'GECTI',
    gatewayAfter: {
      label: 'TR e Alçada Aprovados?',
      yesBranchLabel: 'Aprovado',
      descricao: 'Aprovação do Termo de Referência assinado pela EPC e Autoridade Competente (Art. 12 a 23, IN 94/2022).',
    },
  },
  {
    code: 'M5_ORCAMENTO_CDO',
    ordemMacro: 5,
    faseIn94: 'Planejamento da Contratação (PCTIC)',
    tituloMarco: '5. Disponibilidade Orçamentária (CDO / DDO)',
    prazoPadraoDias: 10,
    defaultUnitHint: 'COFAC',
    gatewayAfter: {
      label: 'Recursos Certificados?',
      yesBranchLabel: 'CDO Emitida',
      descricao: 'Certificação de Disponibilidade Orçamentária emitida para cobertura da despesa.',
    },
  },
  {
    code: 'M6_INSTRUCAO_EDITAL',
    ordemMacro: 6,
    faseIn94: 'Seleção do Fornecedor (SFTI)',
    tituloMarco: '6. Instrução Licitatória e Minuta de Edital',
    prazoPadraoDias: 12,
    defaultUnitHint: 'CGLIC',
  },
  {
    code: 'M7_PARECER_JURIDICO',
    ordemMacro: 7,
    faseIn94: 'Seleção do Fornecedor (SFTI)',
    tituloMarco: '7. Análise Jurídica (Parecer CONJUR / AGU)',
    prazoPadraoDias: 15,
    defaultUnitHint: 'CONJUR',
    gatewayAfter: {
      label: 'Parecer Jurídico Favorável?',
      yesBranchLabel: 'Aprovado',
      descricao: 'Controle prévio de legalidade pela Consultoria Jurídica (Art. 53, Lei 14.133/2021 e Art. 25, IN 94/2022).',
    },
  },
  {
    code: 'M8_CERTAME_HOMOLOGACAO',
    ordemMacro: 8,
    faseIn94: 'Seleção do Fornecedor (SFTI)',
    tituloMarco: '8. Publicação do Edital, Pregão e Homologação',
    prazoPadraoDias: 15,
    defaultUnitHint: 'CGLIC',
    gatewayAfter: {
      label: 'Certame Homologado?',
      yesBranchLabel: 'Homologado',
      descricao: 'Julgamento da proposta, habilitação técnica, adjudicação e homologação do certame (Art. 26-28, IN 94/2022).',
    },
  },
  {
    code: 'M9_EMPENHO_CONTRATO',
    ordemMacro: 9,
    faseIn94: 'Seleção do Fornecedor (SFTI)',
    tituloMarco: '9. Emissão de Empenho e Assinatura do Contrato',
    prazoPadraoDias: 10,
    defaultUnitHint: 'CGLIC',
  },
  {
    code: 'M10_GESTAO_FISCALIZACAO',
    ordemMacro: 10,
    faseIn94: 'Gestão do Contrato (GCTI)',
    tituloMarco: '10. Designação de Fiscais e Início da Execução',
    prazoPadraoDias: 10,
    defaultUnitHint: 'GECTI',
  },
];

/**
 * Identifica se um documento da árvore do SEI representa um Marco Oficial da IN 94/2022.
 * Retorna `null` para documentos de mero expediente / movimentações simples (Despacho, Ofício simples, E-mail, Anexo, etc.),
 * evitando poluir o Fluxo BPMN e o Quadro Kanban!
 */
export function matchSeiDocumentToIn94Milestone(doc: RawSeiDocumento, docIndex: number, totalDocs: number): In94MilestoneDefinition | null {
  const tipo = repairMojibakeAndBrokenChars(doc.tipo || '').trim();
  const upper = tipo.toUpperCase();

  // Ignora explicitamente movimentações e documentos de mero expediente administrativo
  if (
    /^(DESPACHO|OF[IÍ]CIO|MEMORANDO|E-?MAIL|CORRESPOND[EÊ]NCIA|ANEXO|RECIBO|TERMO DE ENCERRAMENTO|ENCAMINHAMENTO|COMUNICADO|EXTRATO SIASG|PLANILHA|COTA\b|BOLETIM)/i.test(
      tipo
    )
  ) {
    return null;
  }

  // Marco 1: DFD / Formalização da Demanda
  if (/\bDFD\b|FORMALIZA[CÇ][AÃ]O\s+DA\s+DEMANDA|DOCUMENTO\s+DE\s+FORMALIZA|REQUISI[CÇ][AÃ]O/i.test(upper)) {
    return IN94_OFFICIAL_MILESTONES[0];
  }

  // Marco 2: Instituição da EPC / Designação de Equipe de Planejamento
  if (
    /INSTITU[IÍ][CÇ][AÃ]O\s+DA\s+EQUIPE|INDICA[CÇ][AÃ]O.*INTEGRANTES|DESIGNA[CÇ][AÃ]O.*(?:EQUIPE|EPC|PLANEJAMENTO)/i.test(upper) ||
    (/PORTARIA/i.test(upper) && !/FISCALIZA/i.test(upper) && docIndex <= Math.max(4, Math.floor(totalDocs * 0.45)))
  ) {
    return IN94_OFFICIAL_MILESTONES[1];
  }

  // Marco 3: ETP e Mapa/Matriz de Gerenciamento de Riscos (MGR)
  if (
    /\bETP\b|ESTUDO\s+T[EÉ]CNICO\s+PRELIMINAR|MAPA\s+DE\s+(?:GERENCIAMENTO\s+DE\s+)?RISCO|MATRIZ\s+DE\s+(?:GERENCIAMENTO\s+DE\s+)?RISCO|\bMGR\b|AN[AÁ]LISE\s+DE\s+RISCO/i.test(
      upper
    )
  ) {
    return IN94_OFFICIAL_MILESTONES[2];
  }

  // Marco 4: Termo de Referência (TR), Projeto Básico, Pesquisa de Preços ou Nota/Parecer Técnico de Planejamento
  if (
    /\bTR\b|TERMO\s+DE\s+REFER[EÊ]NCIA|PROJETO\s+B[AÁ]SICO|PESQUISA\s+DE\s+PRE[CÇ]O|MAPA\s+COMPARATIVO|NOTA\s+T[EÉ]CNICA|PARECER\s+T[EÉ]CNICO/i.test(
      upper
    )
  ) {
    return IN94_OFFICIAL_MILESTONES[3];
  }

  // Marco 5: Disponibilidade / Adequação Orçamentária (CDO / DDO)
  if (
    /DISPONIBILIDADE\s+OR[CÇ]AMENT[AÁ]RIA|CERTIFICA[CÇ][AÃ]O\s+DE\s+DISPONIBILIDADE|\bCDO\b|\bDDO\b|ADEQUA[CÇ][AÃ]O\s+OR[CÇ]AMENT|DECLARA[CÇ][AÃ]O\s+DE\s+DISPONIBILIDADE|RESERVA\s+OR[CÇ]AMENT/i.test(
      upper
    )
  ) {
    return IN94_OFFICIAL_MILESTONES[4];
  }

  // Marco 6: Instrução Licitatória / Minuta de Edital / Check-list / Contratação Direta
  if (
    /MINUTA\s+DE\s+(?:EDITAL|CONTRATO|ATA)|LISTA\s+DE\s+VERIFICA[CÇ][AÃ]O|CHECK-?LIST|TERMO\s+DE\s+(?:DISPENSA|INEXIGIBILIDADE|ADES[AÃ]O)|AUTORIZA[CÇ][AÃ]O\s+PARA\s+ABERTURA/i.test(
      upper
    )
  ) {
    return IN94_OFFICIAL_MILESTONES[5];
  }

  // Marco 7: Análise Jurídica (Parecer CONJUR / AGU / Nota Jurídica)
  if (/PARECER\s+JUR[IÍ]DICO|PARECER\s+REFERENCIAL|NOTA\s+JUR[IÍ]DICA|\bCONJUR\b|\bAGU\b|^PARECER\b/i.test(upper)) {
    return IN94_OFFICIAL_MILESTONES[6];
  }

  // Marco 8: Publicação do Edital, Pregão, Julgamento, Adjudicação e Homologação
  if (
    /^EDITAL\b|AVISO\s+DE\s+LICITA[CÇ][AÃ]O|PUBLICA[CÇ][AÃ]O|ATA\s+DE\s+REALIZA[CÇ][AÃ]O|PREG[AÃ]O|JULGAMENTO|HABILITA[CÇ][AÃ]O|ADJUDICA[CÇ][AÃ]O|HOMOLOGA[CÇ][AÃ]O/i.test(
      upper
    )
  ) {
    return IN94_OFFICIAL_MILESTONES[7];
  }

  // Marco 9: Nota de Empenho e Assinatura do Contrato / Ata de Registro de Preços
  if (
    /NOTA\s+DE\s+EMPENHO|\bNE\b|^CONTRATO\b|TERMO\s+DE\s+CONTRATO|ATA\s+DE\s+REGISTRO\s+DE\s+PRE[CÇ]O|\bARP\b|EXTRATO\s+DE\s+CONTRATO/i.test(
      upper
    )
  ) {
    return IN94_OFFICIAL_MILESTONES[8];
  }

  // Marco 10: Portaria de Fiscalização / Ordem de Serviço / Execução Contratual
  if (
    /PORTARIA|FISCALIZA[CÇ][AÃ]O|ORDEM\s+DE\s+SERVI[CÇ]O|\bO\.?S\.?\b|RECEBIMENTO\s+PROVIS[OÓ]RIO|\bTRP\b|RECEBIMENTO\s+DEFINITIVO|\bTRD\b|REUNI[AÃ]O\s+INICIAL/i.test(
      upper
    )
  ) {
    return IN94_OFFICIAL_MILESTONES[9];
  }

  return null;
}

/**
 * Infere qual Marco da IN 94/2022 corresponde à unidade onde o processo está aberto atualmente no SEI,
 * caso a unidade aberta esteja trabalhando no próximo marco que ainda não teve seu documento final inserido.
 */
function inferMilestoneForOpenUnit(unidadeAberta: string, highestReachedOrdem: number): In94MilestoneDefinition {
  const upper = (unidadeAberta || '').toUpperCase();

  if (/CONJUR|JURIDIC|AGU/.test(upper)) {
    return IN94_OFFICIAL_MILESTONES[6]; // 7. Análise Jurídica
  }
  if (/COFAC|CGOF|ORCAMENT|FINANC|SPOA|DIORF/.test(upper)) {
    return IN94_OFFICIAL_MILESTONES[4]; // 5. Disponibilidade Orçamentária (CDO)
  }
  if (/CGLIC|COLIC|DLC|CENTRAL|COMPRAS|LICIT|PREGAO|DCD/.test(upper)) {
    if (highestReachedOrdem >= 7) {
      return IN94_OFFICIAL_MILESTONES[7]; // 8. Publicação do Edital, Pregão e Homologação
    }
    return IN94_OFFICIAL_MILESTONES[5]; // 6. Instrução Licitatória e Minuta de Edital
  }
  if (/GECTI|CGTI|DTI|STI|TIC|CPCTI|EPCON/.test(upper)) {
    if (highestReachedOrdem <= 1) return IN94_OFFICIAL_MILESTONES[1]; // 2. Instituição da EPC
    if (highestReachedOrdem === 2) return IN94_OFFICIAL_MILESTONES[2]; // 3. ETP e Riscos
    if (highestReachedOrdem <= 4) return IN94_OFFICIAL_MILESTONES[3]; // 4. Termo de Referência (TR)
    return IN94_OFFICIAL_MILESTONES[Math.min(9, highestReachedOrdem)];
  }
  if (highestReachedOrdem === 0) {
    return IN94_OFFICIAL_MILESTONES[0]; // 1. Formalização da Demanda (DFD)
  }
  return IN94_OFFICIAL_MILESTONES[Math.min(9, Math.max(0, highestReachedOrdem - 1))];
}

interface MilestoneBucket {
  definition: In94MilestoneDefinition;
  unidade: string;
  lane: BpmnLane;
  dataInicioIso: string;
  dataFimIso?: string;
  documentos: RawSeiDocumento[];
  isCurrentOpenMilestone: boolean;
}

/**
 * Motor "Estúdio de Fluxo SEI (IN SGD/ME nº 94/2022)"
 *
 * - Filtra movimentações irrelevantes (despachos simples, ofícios de encaminhamento, e-mails, etc.);
 * - Agrupa os documentos reais da árvore do SEI exclusivamente nos **Marcos Oficiais da IN 94/2022**;
 * - Insere **Gateways BPMN 2.0 Exclusivos (`gateway_exclusive` ✕)** entre os marcos decisórios e mudanças de raia,
 *   evitando linhas coladas e espelhando a notação oficial do Governo Digital;
 * - Destaca exatamente o Marco e a Raia onde o processo se encontra aberto atualmente no SEI (`isCurrentSeiPosition`).
 */
export function buildBpmnFlowFromSeiScrape(
  planejamento: Planejamento,
  existingTarefas: TarefaPlanejamento[],
  existingHistorico: HistoricoPlanejamento[],
  rawScrape: RawSeiProcessScrapeResult,
  customRules: UnitLaneMappingRule[] = DEFAULT_SEI_UNIT_LANE_RULES
): {
  updatedPlanejamento: Planejamento;
  updatedTarefasForProcess: TarefaPlanejamento[];
  newHistoricoEntries: HistoricoPlanejamento[];
} {
  // 1. Sanitiza todos os textos contra qualquer problema de encoding (ex: "")
  const scrape = sanitizeScrapeResult(rawScrape);

  const sortedAndamentos = [...(scrape.andamentos || [])].sort((a, b) => {
    return new Date(parseSeiDateToIso(a.dataHora)).getTime() - new Date(parseSeiDateToIso(b.dataHora)).getTime();
  });

  const openUnits =
    scrape.unidadesAbertas && scrape.unidadesAbertas.length > 0
      ? scrape.unidadesAbertas
      : sortedAndamentos.length > 0
        ? [sortedAndamentos[sortedAndamentos.length - 1].unidade]
        : ['GECTI'];

  const primaryCurrentUnit = openUnits[0] || 'GECTI';

  const lanesMap = new Map<string, BpmnLane>();

  const registerUnitLane = (unitName: string): BpmnLane => {
    const { lane } = resolveSeiUnitToLane(unitName, Array.from(lanesMap.values()), customRules);
    if (!lanesMap.has(lane.id)) {
      lanesMap.set(lane.id, { ...lane });
    }
    return lanesMap.get(lane.id)!;
  };

  // 2. Agrupa os documentos reais do SEI nos Marcos Oficiais da IN 94/2022 (ignorando despachos/movimentações simples)
  const docs = scrape.documentos || [];
  const bucketsByCode = new Map<string, MilestoneBucket>();

  docs.forEach((docItem, idx) => {
    const matchedMilestone = matchSeiDocumentToIn94Milestone(docItem, idx, docs.length);
    if (!matchedMilestone) return; // Ignora despachos simples, ofícios de remessa, e-mails, etc.

    const unitForMilestone = docItem.unidade || matchedMilestone.defaultUnitHint || primaryCurrentUnit;
    const resolvedLane = registerUnitLane(unitForMilestone);
    const docIso = parseSeiDateToIso(docItem.data);

    const existingBucket = bucketsByCode.get(matchedMilestone.code);
    if (!existingBucket) {
      bucketsByCode.set(matchedMilestone.code, {
        definition: matchedMilestone,
        unidade: docItem.unidade || primaryCurrentUnit,
        lane: resolvedLane,
        dataInicioIso: docIso,
        dataFimIso: docIso,
        documentos: [docItem],
        isCurrentOpenMilestone: false,
      });
    } else {
      if (!existingBucket.documentos.some(d => d.idSei === docItem.idSei)) {
        existingBucket.documentos.push(docItem);
      }
      if (docItem.unidade) {
        existingBucket.unidade = docItem.unidade;
        existingBucket.lane = registerUnitLane(docItem.unidade);
      }
      existingBucket.dataFimIso = docIso;
    }
  });

  // Se o processo ainda está no início e não teve nenhum documento com nome padronizado de marco,
  // garante pelo menos o Marco 1 (Formalização da Demanda - DFD)
  if (bucketsByCode.size === 0) {
    const firstUnit = sortedAndamentos[0]?.unidade || primaryCurrentUnit;
    const firstLane = registerUnitLane(firstUnit);
    const m1 = IN94_OFFICIAL_MILESTONES[0];
    bucketsByCode.set(m1.code, {
      definition: m1,
      unidade: firstUnit,
      lane: firstLane,
      dataInicioIso: sortedAndamentos[0] ? parseSeiDateToIso(sortedAndamentos[0].dataHora) : new Date().toISOString(),
      documentos: docs.slice(0, 3),
      isCurrentOpenMilestone: false,
    });
  }

  // Ordena os marcos atingidos segundo a sequência oficial da IN 94/2022 (1 a 10)
  const orderedBuckets = Array.from(bucketsByCode.values()).sort(
    (a, b) => a.definition.ordemMacro - b.definition.ordemMacro
  );

  // 3. Verifica a posição atual do processo no SEI (`primaryCurrentUnit`):
  // Se o processo estiver aberto em uma unidade cujo marco seguinte está em andamento (ex: aberto na CONJUR, COFAC ou CGLIC),
  // garante que esse marco ativo apareça no fluxo e receba o destaque "ONDE ESTÁ NO SEI"
  const activeUnitLane = registerUnitLane(primaryCurrentUnit);
  const highestOrdem = orderedBuckets[orderedBuckets.length - 1]?.definition.ordemMacro || 1;
  const inferredActiveDef = inferMilestoneForOpenUnit(primaryCurrentUnit, highestOrdem);

  const existingActiveBucket = orderedBuckets.find(b => b.definition.code === inferredActiveDef.code);
  if (existingActiveBucket) {
    existingActiveBucket.isCurrentOpenMilestone = true;
    existingActiveBucket.unidade = primaryCurrentUnit;
    existingActiveBucket.lane = activeUnitLane;
  } else {
    // Se a última etapa já era da mesma raia ativa, marca a última etapa daquela raia;
    // caso contrário, adiciona o marco em andamento na unidade atual do SEI
    const lastInActiveLane = [...orderedBuckets].reverse().find(b => b.lane.id === activeUnitLane.id);
    if (lastInActiveLane && lastInActiveLane.definition.ordemMacro >= inferredActiveDef.ordemMacro) {
      lastInActiveLane.isCurrentOpenMilestone = true;
      lastInActiveLane.unidade = primaryCurrentUnit;
    } else {
      orderedBuckets.push({
        definition: inferredActiveDef,
        unidade: primaryCurrentUnit,
        lane: activeUnitLane,
        dataInicioIso: sortedAndamentos.length > 0
          ? parseSeiDateToIso(sortedAndamentos[sortedAndamentos.length - 1].dataHora)
          : new Date().toISOString(),
        documentos: [],
        isCurrentOpenMilestone: true,
      });
      orderedBuckets.sort((a, b) => a.definition.ordemMacro - b.definition.ordemMacro);
    }
  }

  // Garante que exatamente um marco seja o ativo (`isCurrentOpenMilestone = true`)
  if (!orderedBuckets.some(b => b.isCurrentOpenMilestone)) {
    orderedBuckets[orderedBuckets.length - 1].isCurrentOpenMilestone = true;
  }

  // Ordena as raias conforme a ordem canônica da IN 94/2022
  const finalLanes = Array.from(lanesMap.values())
    .sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
    .map((l, idx) => ({ ...l, ordem: idx + 1 }));

  // 4. Constrói os Nós BPMN (Start + Tarefas de Marcos + Gateways Exclusivos ✕ + End) e Conexões Ortogonais
  let stepOrder = 1;
  const protoSuffix = normalizeSeiProtocol(planejamento.SEI_Processo).slice(-6) || '1';
  const firstBucket = orderedBuckets[0];
  const startNodeId = `node-sei-start-${protoSuffix}`;

  const startNode: BpmnNode = {
    id: startNodeId,
    type: 'start',
    label: 'Autuação no SEI',
    laneId: firstBucket.lane.id,
    ordemFluxo: stepOrder++,
    seiUnidade: firstBucket.unidade,
    descricao: `Processo autuado no SEI (${planejamento.SEI_Processo})`,
  };

  const generatedNodes: BpmnNode[] = [startNode];
  const generatedTasks: TarefaPlanejamento[] = [];
  const generatedConnections: BpmnConnection[] = [];

  let previousElementId = startNodeId;
  let previousBranchLabel = '';
  let activeNodeId = startNodeId;

  orderedBuckets.forEach((bucket, idx) => {
    const isLastBucket = idx === orderedBuckets.length - 1;
    const nextBucket = !isLastBucket ? orderedBuckets[idx + 1] : null;
    const isActiveStep = bucket.isCurrentOpenMilestone;

    const mainDoc = bucket.documentos[bucket.documentos.length - 1];
    const docSeiRef = mainDoc?.idSei || '';
    let allSigned = true;
    const signersList: string[] = [];

    bucket.documentos.forEach(d => {
      if (!d.assinado) allSigned = false;
      if (d.assinantes) signersList.push(...d.assinantes);
    });

    // Calcula dias na etapa
    const startMs = new Date(bucket.dataInicioIso).getTime();
    const endMs = !isActiveStep && bucket.dataFimIso ? new Date(bucket.dataFimIso).getTime() : Date.now();
    const elapsedDays = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));

    let statusTarefa: StatusTarefa = 'Concluído';
    if (isActiveStep && planejamento.Status_Planejamento !== 'Gerou Contrato' && planejamento.Status_Planejamento !== 'Arquivado') {
      if (bucket.documentos.length > 0 && !allSigned) {
        statusTarefa = 'Aguardando Assinatura';
      } else {
        statusTarefa = 'Em Elaboração';
      }
    }

    const taskOrder = stepOrder++;
    const taskId = `tar-in94-${protoSuffix}-${bucket.definition.code.toLowerCase()}`;
    const prevTask = existingTarefas.find(t => t.id === taskId);

    const newTask: TarefaPlanejamento = {
      id: taskId,
      ProcessoPlanejamento: planejamento.SEI_Processo,
      Tarefa: bucket.definition.tituloMarco,
      Inicio: bucket.dataInicioIso,
      Prazo_Dias: prevTask?.Prazo_Dias || bucket.definition.prazoPadraoDias || Math.max(5, elapsedDays),
      Status_Tarefa: statusTarefa,
      areaResponsavel: bucket.lane.nome,
      ordemFluxo: taskOrder,
      bpmnType: 'task',
      descricao: [
        `Fase IN 94/2022: ${bucket.definition.faseIn94}`,
        `Unidade SEI: ${bucket.unidade}`,
        docSeiRef ? `Documento Principal SEI nº ${docSeiRef}` : 'Etapa em instrução na unidade',
      ].join(' • '),
      dataConclusao: statusTarefa === 'Concluído' ? (bucket.dataFimIso || new Date().toISOString()) : undefined,
      MovidoPor: 'Estúdio de Fluxo SEI (IN 94/2022)',
      MovidoEm: new Date().toISOString(),
      subTarefas:
        bucket.documentos.length > 0
          ? bucket.documentos.map((d, dIdx) => ({
              id: `sub-${taskId}-${dIdx}`,
              titulo: repairMojibakeAndBrokenChars(`${d.tipo}${d.numero ? ` ${d.numero}` : ''} (SEI ${d.idSei})`),
              concluida: d.assinado,
            }))
          : prevTask?.subTarefas || [],
      seiDocNumber: docSeiRef || undefined,
      seiUnidade: bucket.unidade,
      isCurrentSeiPosition: isActiveStep,
      seiAssinado: bucket.documentos.length > 0 ? allSigned : undefined,
      seiAssinantes: signersList.length > 0 ? Array.from(new Set(signersList)) : undefined,
    };

    generatedTasks.push(newTask);

    // Conecta o elemento anterior (Start, Tarefa anterior ou Gateway anterior) a este Marco
    generatedConnections.push({
      id: `conn-in94-to-${bucket.definition.code.toLowerCase()}`,
      fromId: previousElementId,
      toId: taskId,
      label: previousBranchLabel,
      tipo: 'sequence',
      cor: isActiveStep ? '#10b981' : '#0ea5e9',
      isSeiExecuted: true,
    });

    previousElementId = taskId;
    previousBranchLabel = '';

    if (isActiveStep) {
      activeNodeId = taskId;
    }

    // 5. INSERÇÃO DE GATEWAY BPMN 2.0 EXCLUSIVO (✕) ENTRE MARCOS (Padrão IN 94/2022)
    // Insere um Gateway de decisão sempre que o marco possuir ponto de controle na IN 94/2022
    // ou quando houver mudança de raia para o próximo marco!
    if (nextBucket) {
      const isCrossLaneToNext = nextBucket.lane.id !== bucket.lane.id;
      const gwConfig = bucket.definition.gatewayAfter || (isCrossLaneToNext
        ? {
            label: 'Etapa Concluída?',
            yesBranchLabel: 'Encaminhar',
            descricao: `Transição formal da raia ${bucket.lane.nome} para ${nextBucket.lane.nome}`,
          }
        : undefined);

      if (gwConfig) {
        const gwId = `node-gw-in94-${protoSuffix}-${bucket.definition.code.toLowerCase()}`;
        const gwNode: BpmnNode = {
          id: gwId,
          type: 'gateway_exclusive',
          label: gwConfig.label,
          laneId: bucket.lane.id,
          ordemFluxo: stepOrder++,
          seiUnidade: bucket.unidade,
          descricao: gwConfig.descricao,
        };

        generatedNodes.push(gwNode);

        // Conecta a Tarefa do Marco ao Gateway na mesma raia
        generatedConnections.push({
          id: `conn-in94-gw-${bucket.definition.code.toLowerCase()}`,
          fromId: taskId,
          toId: gwId,
          label: '',
          tipo: 'sequence',
          cor: '#0ea5e9',
          isSeiExecuted: true,
        });

        previousElementId = gwId;
        previousBranchLabel = gwConfig.yesBranchLabel;
      }
    }
  });

  // Se o planejamento já gerou contrato ou está concluído/arquivado, adiciona o nó de Fim
  if (planejamento.Status_Planejamento === 'Gerou Contrato' || planejamento.Status_Planejamento === 'Arquivado') {
    const lastBucket = orderedBuckets[orderedBuckets.length - 1];
    const endNodeId = `node-sei-end-${protoSuffix}`;
    generatedNodes.push({
      id: endNodeId,
      type: 'end',
      label: planejamento.Status_Planejamento === 'Gerou Contrato' ? 'Contrato Assinado' : 'Processo Concluído',
      laneId: lastBucket.lane.id,
      ordemFluxo: stepOrder++,
      seiUnidade: lastBucket.unidade,
    });
    generatedConnections.push({
      id: `conn-sei-end-${protoSuffix}`,
      fromId: previousElementId,
      toId: endNodeId,
      label: previousBranchLabel || 'Finalizado',
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

  // Filtra a árvore de documentos exibida no metadado para priorizar documentos relevantes
  const milestoneDocsOnly = docs.filter((d, idx) => matchSeiDocumentToIn94Milestone(d, idx, docs.length) !== null);

  const seiSyncMetadata: SeiProcessSyncMetadata = {
    lastSyncAt: scrape.scrapedAt || new Date().toISOString(),
    unidadesAbertas: openUnits,
    unidadeAtual: primaryCurrentUnit,
    ultimoAndamento: repairMojibakeAndBrokenChars(
      latestAndamento?.descricao || activeTask?.Tarefa || 'Sincronizado via SEI (Marcos IN 94/2022)'
    ),
    ultimaDataAndamento: latestAndamento?.dataHora || new Date().toLocaleDateString('pt-BR'),
    activeNodeId,
    activeLaneId: activeUnitLane.id,
    activeLaneNome: activeUnitLane.nome,
    diasNaUnidadeAtual,
    processosRelacionados: relatedClassified,
    documentosArvore: (milestoneDocsOnly.length > 0 ? milestoneDocsOnly : docs).slice(-25),
    etapasMapeadasCount: generatedTasks.length,
  };

  // Gera novos registros de HistoricoPlanejamento APENAS para documentos de Marcos Oficiais da IN 94/2022
  // (evitando poluir o histórico com despachos simples ou movimentações corriqueiras)
  const existingHistKeys = new Set(
    existingHistorico
      .filter(h => h.Processo_SEI === planejamento.SEI_Processo)
      .map(h => `${h.Num_SEI || ''}-${(h.Descricao || '').slice(0, 40)}`)
  );

  const newHistoricoEntries: HistoricoPlanejamento[] = [];
  docs.forEach((d, idx) => {
    const milestoneDef = matchSeiDocumentToIn94Milestone(d, idx, docs.length);
    if (!milestoneDef) return; // Ignora despachos simples no histórico também

    const desc = repairMojibakeAndBrokenChars(
      `[${milestoneDef.tituloMarco}] ${d.tipo}${d.numero ? ` nº ${d.numero}` : ''}${d.assinado ? ' (Assinado)' : ' (Minuta)'}`
    );
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
  });

  // Extrai automaticamente Portaria da EPC caso detectada na árvore do SEI
  const portariaDoc = docs.find(d => /PORTARIA/i.test(d.tipo));
  const autoPortariaSei = planejamento.Portaria_Equipe_PC_SEI || (portariaDoc ? portariaDoc.idSei : '');
  const autoPortariaNum =
    planejamento.Portaria_Equipe_PC_Numero ||
    (portariaDoc && portariaDoc.numero ? `Portaria nº ${portariaDoc.numero}` : planejamento.Portaria_Equipe_PC_Numero);

  const updatedPlanejamento: Planejamento = {
    ...planejamento,
    Objeto: repairMojibakeAndBrokenChars(planejamento.Objeto),
    Portaria_Equipe_PC_SEI: autoPortariaSei,
    Portaria_Equipe_PC_Numero: repairMojibakeAndBrokenChars(autoPortariaNum),
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
 * Atualiza um Contrato vigente com os dados lidos do SEI (filtrando apenas documentos de marcos contratuais relevantes)
 */
export function applySeiScrapeToContrato(
  contrato: Contrato,
  existingHistoricoContratual: HistoricoContratual[],
  existingPagamentos: Pagamento[],
  rawScrape: RawSeiProcessScrapeResult
): {
  updatedContrato: Contrato;
  newHistoricoContratual: HistoricoContratual[];
  updatedPagamentos: Pagamento[];
} {
  const scrape = sanitizeScrapeResult(rawScrape);

  const sortedAndamentos = [...(scrape.andamentos || [])].sort((a, b) => {
    return new Date(parseSeiDateToIso(a.dataHora)).getTime() - new Date(parseSeiDateToIso(b.dataHora)).getTime();
  });
  const latestAndamento = sortedAndamentos[sortedAndamentos.length - 1];
  const openUnits =
    scrape.unidadesAbertas && scrape.unidadesAbertas.length > 0
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

  const docs = scrape.documentos || [];
  const milestoneDocsOnly = docs.filter((d, idx) => matchSeiDocumentToIn94Milestone(d, idx, docs.length) !== null);

  const seiSyncMetadata: SeiProcessSyncMetadata = {
    lastSyncAt: scrape.scrapedAt || new Date().toISOString(),
    unidadesAbertas: openUnits,
    unidadeAtual: openUnits[0] || 'GECTI',
    ultimoAndamento: repairMojibakeAndBrokenChars(latestAndamento?.descricao || 'Processo monitorado no SEI'),
    ultimaDataAndamento: latestAndamento?.dataHora || new Date().toLocaleDateString('pt-BR'),
    processosRelacionados: relatedClassified,
    documentosArvore: (milestoneDocsOnly.length > 0 ? milestoneDocsOnly : docs).slice(-25),
  };

  const existingHistKeys = new Set(
    existingHistoricoContratual
      .filter(h => h.ContratoRelacionado === contrato.id)
      .map(h => `${h.Numero_SEI || ''}-${(h.Descricao || '').slice(0, 40)}`)
  );

  const newHistoricoContratual: HistoricoContratual[] = [];
  docs.forEach((d, idx) => {
    const milestoneDef = matchSeiDocumentToIn94Milestone(d, idx, docs.length);
    if (!milestoneDef) return; // Ignora despachos simples

    const desc = repairMojibakeAndBrokenChars(
      `[SEI • ${milestoneDef.tituloMarco}] ${d.tipo}${d.numero ? ` nº ${d.numero}` : ''}${d.assinado ? ' (Assinado)' : ' (Em elaboração)'}`
    );
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
  });

  const portariaFiscDoc = docs.find(d => /PORTARIA/i.test(d.tipo));
  const autoPortariaFiscSei = contrato.Portaria_Fiscalizacao_SEI || (portariaFiscDoc ? portariaFiscDoc.idSei : '');
  const autoPortariaFiscNum =
    contrato.Portaria_Fiscalizacao_Numero ||
    (portariaFiscDoc && portariaFiscDoc.numero
      ? `Portaria nº ${portariaFiscDoc.numero}`
      : contrato.Portaria_Fiscalizacao_Numero);

  return {
    updatedContrato: {
      ...contrato,
      Objeto: repairMojibakeAndBrokenChars(contrato.Objeto),
      Portaria_Fiscalizacao_SEI: autoPortariaFiscSei,
      Portaria_Fiscalizacao_Numero: repairMojibakeAndBrokenChars(autoPortariaFiscNum),
      seiSyncMetadata,
      Data_Ultima_Atualizacao: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
    },
    newHistoricoContratual,
    updatedPagamentos: existingPagamentos,
  };
}
