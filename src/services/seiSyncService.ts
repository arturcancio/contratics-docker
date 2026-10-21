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
  tipo: string; // Ex: "Estudo Técnico Preliminar", "Termo de Referência", "Nota Técnica", "Despacho", "Parecer"
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
    [/Dilig\uFFFD+ncia(s?)/gi, 'Diligência$1'],
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
    [/Altera\uFFFD+es/gi, 'Alterações'],
    [/Recomenda\uFFFD+o/gi, 'Recomendação'],
    [/Recomenda\uFFFD+es/gi, 'Recomendações'],
    [/Revis\uFFFD+o/gi, 'Revisão'],
    [/Revis\uFFFD+es/gi, 'Revisões'],
    [/Vers\uFFFD+o/gi, 'Versão'],
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
    [/Decis\uFFFD+ri([oa]s?)/gi, 'Decisóri$1'],
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
    // Sufixos morfológicos gerais da língua portuguesa
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
// MOTOR CRONOLÓGICO EQUILIBRADO ("MEIO TERMO") — MARCOS IN 94/2022, PESQUISA DE PREÇOS,
// NOTAS TÉCNICAS, DESPACHOS RELEVANTES E CICLOS DE REVISÃO / ALTERAÇÃO DE ARTEFATOS
// ============================================================================

export type SeiStepCategory =
  | 'DFD'
  | 'PORTARIA_EPC'
  | 'ETP'
  | 'MAPA_RISCOS'
  | 'PESQUISA_PRECOS'
  | 'TR'
  | 'NOTA_TECNICA'
  | 'DESPACHO'
  | 'CDO_ORCAMENTO'
  | 'MINUTA_EDITAL'
  | 'PARECER_JURIDICO'
  | 'EDITAL_PREGAO'
  | 'HOMOLOGACAO'
  | 'EMPENHO_CONTRATO'
  | 'PORTARIA_FISCALIZACAO'
  | 'NOISE';

interface ClassifiedDocInfo {
  category: SeiStepCategory;
  isCoreEditableArtifact: boolean; // DFD, ETP, MAPA_RISCOS, PESQUISA_PRECOS, TR, MINUTA_EDITAL
  isAnalysisOrRecommendation: boolean; // NOTA_TECNICA, PARECER_JURIDICO, DESPACHO
  defaultUnitHint: string;
  prazoPadraoDias: number;
}

/**
 * Classifica cada documento da árvore do SEI separando individualmente:
 * - DFD
 * - Portaria da EPC
 * - ETP (Estudo Técnico Preliminar)
 * - Mapa de Gerenciamento de Riscos (MGR)
 * - Pesquisa de Preços / Estimativa de Preços / Mapa Comparativo (tarefa própria do planejamento!)
 * - Termo de Referência (TR) / Projeto Básico
 * - Nota Técnica / Parecer Técnico / Informação Técnica (análise e solicitação de ajustes nos artefatos)
 * - Despacho / Ofício (avaliado contextualmente para manter despachos decisórios/diligências/mudanças de área)
 * - Certificação de Disponibilidade Orçamentária (CDO / DDO)
 * - Minuta de Edital / Check-list / Contratação Direta
 * - Parecer Jurídico / Cota CONJUR-AGU
 * - Edital / Pregão / Julgamento / Homologação / Empenho / Contrato
 */
export function classifySeiDocumentCategory(doc: RawSeiDocumento, docIndex: number, totalDocs: number): ClassifiedDocInfo {
  const tipo = repairMojibakeAndBrokenChars(doc.tipo || '').trim();
  const upper = tipo.toUpperCase();

  // 1. Ruído burocrático puro (E-mail automático, Recibo, Termo de Encerramento de Trâmite, Capa, Boletim, Anexo avulso)
  if (
    /^(E-?MAIL|CORRESPOND[EÊ]NCIA|RECIBO|TERMO DE ENCERRAMENTO|COMUNICADO|EXTRATO SIASG|BOLETIM|CAPA DE PROCESSO|TERMO DE ABERTURA|TERMO DE JUNTADA|^ANEXO\b)/i.test(
      tipo
    )
  ) {
    return {
      category: 'NOISE',
      isCoreEditableArtifact: false,
      isAnalysisOrRecommendation: false,
      defaultUnitHint: 'GECTI',
      prazoPadraoDias: 3,
    };
  }

  // 2. DFD / Formalização da Demanda
  if (/\bDFD\b|FORMALIZA[CÇ][AÃ]O\s+DA\s+DEMANDA|DOCUMENTO\s+DE\s+FORMALIZA|REQUISI[CÇ][AÃ]O/i.test(upper)) {
    return {
      category: 'DFD',
      isCoreEditableArtifact: true,
      isAnalysisOrRecommendation: false,
      defaultUnitHint: 'DEMANDANTE',
      prazoPadraoDias: 7,
    };
  }

  // 3. Instituição da Equipe de Planejamento da Contratação (Portaria EPC / Designação de Integrantes)
  if (
    /INSTITU[IÍ][CÇ][AÃ]O\s+DA\s+EQUIPE|INDICA[CÇ][AÃ]O.*INTEGRANTES|DESIGNA[CÇ][AÃ]O.*(?:EQUIPE|EPC|PLANEJAMENTO)/i.test(upper) ||
    (/PORTARIA/i.test(upper) && !/FISCALIZA/i.test(upper) && docIndex <= Math.max(5, Math.floor(totalDocs * 0.5)))
  ) {
    return {
      category: 'PORTARIA_EPC',
      isCoreEditableArtifact: false,
      isAnalysisOrRecommendation: false,
      defaultUnitHint: 'GECTI',
      prazoPadraoDias: 5,
    };
  }

  // 4. Estudo Técnico Preliminar (ETP) — separado como artefato próprio!
  if (/\bETP\b|ESTUDO\s+T[EÉ]CNICO\s+PRELIMINAR/i.test(upper)) {
    return {
      category: 'ETP',
      isCoreEditableArtifact: true,
      isAnalysisOrRecommendation: false,
      defaultUnitHint: 'GECTI',
      prazoPadraoDias: 15,
    };
  }

  // 5. Mapa / Matriz de Gerenciamento de Riscos (MGR) — separado como artefato próprio!
  if (/MAPA\s+DE\s+(?:GERENCIAMENTO\s+DE\s+)?RISCO|MATRIZ\s+DE\s+(?:GERENCIAMENTO\s+DE\s+)?RISCO|\bMGR\b|GERENCIAMENTO\s+DE\s+RISCO|AN[AÁ]LISE\s+DE\s+RISCO/i.test(upper)) {
    return {
      category: 'MAPA_RISCOS',
      isCoreEditableArtifact: true,
      isAnalysisOrRecommendation: false,
      defaultUnitHint: 'GECTI',
      prazoPadraoDias: 7,
    };
  }

  // 6. Pesquisa de Preços / Mapa Comparativo / Estimativa de Custos — tarefa própria do planejamento!
  if (
    /PESQUISA\s+DE\s+PRE[CÇ]O|MAPA\s+COMPARATIVO|ESTIMATIVA\s+DE\s+PRE[CÇ]O|COTA[CÇ][AÃ]O\s+DE\s+PRE[CÇ]O|PAINEL\s+DE\s+PRE[CÇ]O|RELAT[OÓ]RIO\s+DE\s+PRE[CÇ]O|MEM[OÓ]RIA\s+DE\s+C[AÁ]LCULO|PLANILHA\s+DE\s+(?:CUSTO|PRE[CÇ]O)|OR[CÇ]AMENTO\s+ESTIMAD|PROPOSTA\s+COMERCIAL/i.test(
      upper
    )
  ) {
    return {
      category: 'PESQUISA_PRECOS',
      isCoreEditableArtifact: true,
      isAnalysisOrRecommendation: false,
      defaultUnitHint: 'GECTI',
      prazoPadraoDias: 12,
    };
  }

  // 7. Termo de Referência (TR) / Projeto Básico — separado como artefato próprio!
  if (/\bTR\b|TERMO\s+DE\s+REFER[EÊ]NCIA|PROJETO\s+B[AÁ]SICO/i.test(upper)) {
    return {
      category: 'TR',
      isCoreEditableArtifact: true,
      isAnalysisOrRecommendation: false,
      defaultUnitHint: 'GECTI',
      prazoPadraoDias: 15,
    };
  }

  // 8. Nota Técnica / Parecer Técnico / Informação Técnica — sempre relevante (frequentemente solicita alterações no TR/ETP/Pesquisa/Riscos ou aprova alçada)
  if (/NOTA\s+T[EÉ]CNICA|PARECER\s+T[EÉ]CNICO|INFORMA[CÇ][AÃ]O\s+T[EÉ]CNICA|MANIFESTA[CÇ][AÃ]O\s+T[EÉ]CNICA|RELAT[OÓ]RIO\s+T[EÉ]CNICO/i.test(upper)) {
    return {
      category: 'NOTA_TECNICA',
      isCoreEditableArtifact: false,
      isAnalysisOrRecommendation: true,
      defaultUnitHint: doc.unidade || 'GECTI',
      prazoPadraoDias: 10,
    };
  }

  // 9. Disponibilidade / Adequação Orçamentária (CDO / DDO)
  if (
    /DISPONIBILIDADE\s+OR[CÇ]AMENT[AÁ]RIA|CERTIFICA[CÇ][AÃ]O\s+DE\s+DISPONIBILIDADE|\bCDO\b|\bDDO\b|ADEQUA[CÇ][AÃ]O\s+OR[CÇ]AMENT|DECLARA[CÇ][AÃ]O\s+DE\s+DISPONIBILIDADE|RESERVA\s+OR[CÇ]AMENT/i.test(
      upper
    )
  ) {
    return {
      category: 'CDO_ORCAMENTO',
      isCoreEditableArtifact: true,
      isAnalysisOrRecommendation: false,
      defaultUnitHint: 'COFAC',
      prazoPadraoDias: 8,
    };
  }

  // 10. Minuta de Edital / Minuta de Contrato / Lista de Verificação AGU / Contratação Direta
  if (
    /MINUTA\s+DE\s+(?:EDITAL|CONTRATO|ATA)|LISTA\s+DE\s+VERIFICA[CÇ][AÃ]O|CHECK-?LIST|TERMO\s+DE\s+(?:DISPENSA|INEXIGIBILIDADE|ADES[AÃ]O)|AUTORIZA[CÇ][AÃ]O\s+PARA\s+ABERTURA/i.test(
      upper
    )
  ) {
    return {
      category: 'MINUTA_EDITAL',
      isCoreEditableArtifact: true,
      isAnalysisOrRecommendation: false,
      defaultUnitHint: 'CGLIC',
      prazoPadraoDias: 10,
    };
  }

  // 11. Parecer Jurídico / Nota Jurídica / Cota CONJUR / AGU
  if (/PARECER\s+JUR[IÍ]DICO|PARECER\s+REFERENCIAL|NOTA\s+JUR[IÍ]DICA|\bCONJUR\b|\bAGU\b|^PARECER\b|^COTA\b/i.test(upper)) {
    return {
      category: 'PARECER_JURIDICO',
      isCoreEditableArtifact: false,
      isAnalysisOrRecommendation: true,
      defaultUnitHint: 'CONJUR',
      prazoPadraoDias: 15,
    };
  }

  // 12. Publicação do Edital e Sessão Pública (Pregão)
  if (/^EDITAL\b|AVISO\s+DE\s+LICITA[CÇ][AÃ]O|PUBLICA[CÇ][AÃ]O|ATA\s+DE\s+REALIZA[CÇ][AÃ]O|PREG[AÃ]O|SESS[AÃ]O\s+P[UÚ]BLICA/i.test(upper)) {
    return {
      category: 'EDITAL_PREGAO',
      isCoreEditableArtifact: false,
      isAnalysisOrRecommendation: false,
      defaultUnitHint: 'CGLIC',
      prazoPadraoDias: 12,
    };
  }

  // 13. Julgamento, Habilitação, Adjudicação e Homologação
  if (/JULGAMENTO|HABILITA[CÇ][AÃ]O|ADJUDICA[CÇ][AÃ]O|HOMOLOGA[CÇ][AÃ]O|RESULTADO\s+DA\s+LICITA/i.test(upper)) {
    return {
      category: 'HOMOLOGACAO',
      isCoreEditableArtifact: false,
      isAnalysisOrRecommendation: false,
      defaultUnitHint: 'CGLIC',
      prazoPadraoDias: 10,
    };
  }

  // 14. Nota de Empenho e Assinatura do Contrato / ARP
  if (/NOTA\s+DE\s+EMPENHO|\bNE\b|^CONTRATO\b|TERMO\s+DE\s+CONTRATO|ATA\s+DE\s+REGISTRO\s+DE\s+PRE[CÇ]O|\bARP\b|EXTRATO\s+DE\s+CONTRATO/i.test(upper)) {
    return {
      category: 'EMPENHO_CONTRATO',
      isCoreEditableArtifact: false,
      isAnalysisOrRecommendation: false,
      defaultUnitHint: 'CGLIC',
      prazoPadraoDias: 10,
    };
  }

  // 15. Portaria de Fiscalização / Ordem de Serviço / Execução
  if (/PORTARIA|FISCALIZA[CÇ][AÃ]O|ORDEM\s+DE\s+SERVI[CÇ]O|\bO\.?S\.?\b|RECEBIMENTO\s+PROVIS[OÓ]RIO|\bTRP\b|RECEBIMENTO\s+DEFINITIVO|\bTRD\b|REUNI[AÃ]O\s+INICIAL/i.test(upper)) {
    return {
      category: 'PORTARIA_FISCALIZACAO',
      isCoreEditableArtifact: false,
      isAnalysisOrRecommendation: false,
      defaultUnitHint: 'GECTI',
      prazoPadraoDias: 10,
    };
  }

  // 16. Despachos e Ofícios (avaliados contextualmente para manter aqueles que deliberam, mudam de área ou solicitam ajustes)
  if (/^DESPACHO|DESPACHO\s+DECIS[OÓ]RIO|DILIG[EÊ]NCIA|^OF[IÍ]CIO|^MEMORANDO/i.test(upper)) {
    return {
      category: 'DESPACHO',
      isCoreEditableArtifact: false,
      isAnalysisOrRecommendation: true,
      defaultUnitHint: doc.unidade || 'GECTI',
      prazoPadraoDias: 7,
    };
  }

  return {
    category: 'NOISE',
    isCoreEditableArtifact: false,
    isAnalysisOrRecommendation: false,
    defaultUnitHint: doc.unidade || 'GECTI',
    prazoPadraoDias: 5,
  };
}

interface ChronologicalStepGroup {
  category: SeiStepCategory;
  isCoreEditableArtifact: boolean;
  isAnalysisOrRecommendation: boolean;
  unidade: string;
  lane: BpmnLane;
  dataInicioIso: string;
  dataFimIso: string;
  documentos: RawSeiDocumento[];
  prazoPadraoDias: number;
  versionNumber: number; // 1 = elaboração inicial; 2+ = revisão/alteração pós-recomendações
  triggersArtifactRevisionNext: boolean; // true se logo após esta análise/despacho/NT houver revisão de ETP/TR/Pesquisa/Riscos
  isCurrentOpenStep: boolean;
}

/**
 * Formata o título claro e objetivo de cada etapa cronológica, destacando:
 * - Elaboração inicial vs. Alteração/Revisão (2ª, 3ª versão) de ETP, TR, Pesquisa de Preços e Mapa de Riscos;
 * - Notas Técnicas e Despachos que solicitam alterações nos artefatos ou deliberam entre áreas.
 */
function buildStepTitle(step: ChronologicalStepGroup): string {
  const mainDoc = step.documentos[step.documentos.length - 1];
  const docNumSuffix = mainDoc?.numero ? ` ${mainDoc.numero}` : '';
  const v = step.versionNumber;

  switch (step.category) {
    case 'DFD':
      return v === 1
        ? `Formalização da Demanda (DFD${docNumSuffix})`
        : `Revisão / Alteração do DFD (${v}ª Versão${docNumSuffix})`;

    case 'PORTARIA_EPC':
      return v === 1
        ? `Instituição da Equipe de Planejamento (Portaria${docNumSuffix})`
        : `Atualização da Equipe de Planejamento (Portaria${docNumSuffix})`;

    case 'ETP':
      return v === 1
        ? `Elaboração do Estudo Técnico Preliminar (ETP${docNumSuffix})`
        : `Alteração / Revisão do ETP (${v}ª Versão${docNumSuffix})`;

    case 'MAPA_RISCOS':
      return v === 1
        ? `Mapa de Gerenciamento de Riscos (MGR${docNumSuffix})`
        : `Alteração / Revisão do Mapa de Riscos (${v}ª Versão)`;

    case 'PESQUISA_PRECOS':
      return v === 1
        ? `Pesquisa de Preços e Estimativa de Custos`
        : `Atualização / Revisão da Pesquisa de Preços (${v}ª Versão)`;

    case 'TR':
      return v === 1
        ? `Elaboração do Termo de Referência (TR${docNumSuffix})`
        : `Alteração / Revisão do Termo de Referência (TR — ${v}ª Versão)`;

    case 'NOTA_TECNICA':
      return step.triggersArtifactRevisionNext
        ? `Nota Técnica${docNumSuffix} — Recomendações de Ajustes nos Artefatos`
        : `Nota Técnica${docNumSuffix} — Análise e Manifestação Técnica`;

    case 'DESPACHO':
      if (step.triggersArtifactRevisionNext) {
        return `Despacho${docNumSuffix} — Solicitação de Ajustes / Diligência (${step.unidade})`;
      }
      return `Despacho${docNumSuffix} — Análise e Deliberação (${step.unidade})`;

    case 'CDO_ORCAMENTO':
      return v === 1
        ? `Certificação de Disponibilidade Orçamentária (CDO${docNumSuffix})`
        : `Atualização da Disponibilidade Orçamentária (CDO — ${v}ª Versão)`;

    case 'MINUTA_EDITAL':
      return v === 1
        ? `Instrução Licitatória e Minuta de Edital / Check-list`
        : `Adequação da Minuta de Edital / Contrato (${v}ª Versão)`;

    case 'PARECER_JURIDICO':
      return step.triggersArtifactRevisionNext
        ? `Parecer Jurídico CONJUR${docNumSuffix} (Com Recomendações de Ajuste)`
        : `Parecer Jurídico CONJUR / AGU${docNumSuffix}`;

    case 'EDITAL_PREGAO':
      return `Publicação do Edital e Sessão Pública (Pregão${docNumSuffix})`;

    case 'HOMOLOGACAO':
      return `Julgamento, Habilitação e Homologação`;

    case 'EMPENHO_CONTRATO':
      return `Emissão de Empenho e Assinatura do Contrato`;

    case 'PORTARIA_FISCALIZACAO':
      return `Designação de Fiscalização e Início da Execução`;

    default:
      return `Análise e Instrução Processual (${step.unidade})`;
  }
}

/**
 * Motor "Estúdio de Fluxo SEI (Meio Termo Equilibrado — IN 94/2022 + Ciclos de Revisão)"
 *
 * - Mantém separados os artefatos essenciais: DFD, Portaria EPC, ETP, Mapa de Riscos, Pesquisa de Preços, TR, CDO, Minuta de Edital, Parecer Jurídico, Edital/Pregão, Homologação e Contrato;
 * - Preserva Notas Técnicas e Despachos relevantes (aqueles que solicitam mudanças nos artefatos, deliberam ou tramitam entre áreas);
 * - Preserva na ordem cronológica todas as Revisões / Alterações de ETP, TR, Pesquisa de Preços e Mapa de Riscos (2ª versão, 3ª versão...), mostrando quantos dias cada ciclo consumiu;
 * - Insere Gateways BPMN 2.0 Exclusivos (`✕`) nos pontos de decisão e de retorno para ajustes, sem colar linhas nas divisórias das raias.
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
  // 1. Sanitiza todos os textos contra qualquer falha de encoding
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

  // 2. Classifica os documentos da árvore do SEI na ordem cronológica exata em que foram inseridos
  const docs = scrape.documentos || [];
  const rawClassified = docs.map((docItem, idx) => {
    const info = classifySeiDocumentCategory(docItem, idx, docs.length);
    // Se o documento não trouxe sigla de unidade no título da árvore, procura no histórico ou usa o hint da categoria
    let resolvedUnit = docItem.unidade || '';
    let resolvedDate = docItem.data || '';

    if ((!resolvedUnit || !resolvedDate) && sortedAndamentos.length > 0) {
      const exactAnd = sortedAndamentos.find(a => docItem.idSei && a.descricao.includes(docItem.idSei));
      if (exactAnd) {
        if (!resolvedUnit) resolvedUnit = exactAnd.unidade;
        if (!resolvedDate) resolvedDate = exactAnd.dataHora;
      } else {
        const ratio = docs.length > 1 ? idx / (docs.length - 1) : 0;
        const approxAnd = sortedAndamentos[Math.min(sortedAndamentos.length - 1, Math.round(ratio * (sortedAndamentos.length - 1)))];
        if (approxAnd) {
          if (!resolvedUnit) resolvedUnit = approxAnd.unidade;
          if (!resolvedDate) resolvedDate = approxAnd.dataHora;
        }
      }
    }

    if (!resolvedUnit) {
      resolvedUnit = info.defaultUnitHint || primaryCurrentUnit;
    }

    return {
      doc: { ...docItem, unidade: resolvedUnit, data: resolvedDate || docItem.data },
      info,
      index: idx,
    };
  });

  // 3. Agrupa documentos consecutivos da MESMA categoria na MESMA unidade (ex: 3 planilhas de Pesquisa de Preços seguidas viram 1 etapa de Pesquisa de Preços),
  // mas NUNCA agrupa se houver outro documento/análise no meio (preservando os ciclos de revisão/retrabalho de TR, ETP, Pesquisa de Preços e Mapa de Riscos!)
  const candidateGroups: ChronologicalStepGroup[] = [];

  for (const item of rawClassified) {
    if (item.info.category === 'NOISE') {
      continue;
    }

    const lane = registerUnitLane(item.doc.unidade || item.info.defaultUnitHint);
    const docIso = parseSeiDateToIso(item.doc.data);
    const prevGroup = candidateGroups[candidateGroups.length - 1];

    if (
      prevGroup &&
      prevGroup.category === item.info.category &&
      (prevGroup.lane.id === lane.id || prevGroup.unidade.toUpperCase() === (item.doc.unidade || '').toUpperCase())
    ) {
      if (!prevGroup.documentos.some(d => d.idSei === item.doc.idSei)) {
        prevGroup.documentos.push(item.doc);
      }
      prevGroup.dataFimIso = docIso;
    } else {
      candidateGroups.push({
        category: item.info.category,
        isCoreEditableArtifact: item.info.isCoreEditableArtifact,
        isAnalysisOrRecommendation: item.info.isAnalysisOrRecommendation,
        unidade: item.doc.unidade || item.info.defaultUnitHint,
        lane,
        dataInicioIso: docIso,
        dataFimIso: docIso,
        documentos: [item.doc],
        prazoPadraoDias: item.info.prazoPadraoDias,
        versionNumber: 1,
        triggersArtifactRevisionNext: false,
        isCurrentOpenStep: false,
      });
    }
  }

  // 4. Filtro Inteligente ("Meio Termo") para DESPACHOS:
  // Mantém o Despacho como etapa própria sempre que:
  // (a) O passo seguinte for uma revisão/alteração de artefato (ETP, TR, Mapa de Riscos, Pesquisa de Preços, Minuta); OU
  // (b) Houver mudança de unidade/raia antes ou depois do Despacho (deliberação/encaminhamento de uma área para outra); OU
  // (c) For o último passo do processo (posição atual no SEI) ou único pronunciamento daquela unidade;
  // Caso seja apenas um despacho interno intermediário dentro da mesma unidade entre dois artefatos da própria unidade (ex: entre ETP e Mapa de Riscos na GECTI),
  // anexa o despacho como subtarefa do artefato adjacente para não poluir!
  const seenEditableCategories = new Set<SeiStepCategory>();
  const preliminaryVersionCheck = candidateGroups.map(g => {
    const isRepeatArtifact = g.isCoreEditableArtifact && seenEditableCategories.has(g.category);
    if (g.isCoreEditableArtifact) {
      seenEditableCategories.add(g.category);
    }
    return isRepeatArtifact;
  });

  const filteredSteps: ChronologicalStepGroup[] = [];
  for (let i = 0; i < candidateGroups.length; i++) {
    const curr = candidateGroups[i];
    const prev = filteredSteps[filteredSteps.length - 1];
    const next = candidateGroups[i + 1];
    const nextIsRepeatArtifact = i + 1 < preliminaryVersionCheck.length ? preliminaryVersionCheck[i + 1] : false;

    if (curr.category === 'DESPACHO') {
      const isCrossUnitFromPrev = !prev || prev.unidade.toUpperCase() !== curr.unidade.toUpperCase() || prev.lane.id !== curr.lane.id;
      const isCrossUnitToNext = !next || next.unidade.toUpperCase() !== curr.unidade.toUpperCase() || next.lane.id !== curr.lane.id;
      const isLastInFlow = i === candidateGroups.length - 1;
      const hasDeliberativeKeyword = curr.documentos.some(d =>
        /DECIS[OÓ]RIO|APROVA[CÇ][AÃ]O|AUTORIZA[CÇ][AÃ]O|DILIG[EÊ]NCIA|RECOMENDA|DEVOLU[CÇ][AÃ]O/i.test(d.tipo)
      );

      const keepAsStandaloneStep =
        nextIsRepeatArtifact || isCrossUnitFromPrev || isCrossUnitToNext || isLastInFlow || hasDeliberativeKeyword;

      if (!keepAsStandaloneStep && prev) {
        // Incorpora como subtarefa na etapa anterior da mesma unidade para evitar ruído
        curr.documentos.forEach(d => {
          if (!prev.documentos.some(pd => pd.idSei === d.idSei)) {
            prev.documentos.push(d);
          }
        });
        prev.dataFimIso = curr.dataFimIso;
        continue;
      }
    }

    filteredSteps.push(curr);
  }

  // Fallback caso o processo seja recém-autuado
  if (filteredSteps.length === 0) {
    const firstLane = registerUnitLane(primaryCurrentUnit);
    filteredSteps.push({
      category: 'DFD',
      isCoreEditableArtifact: true,
      isAnalysisOrRecommendation: false,
      unidade: primaryCurrentUnit,
      lane: firstLane,
      dataInicioIso: sortedAndamentos[0] ? parseSeiDateToIso(sortedAndamentos[0].dataHora) : new Date().toISOString(),
      dataFimIso: new Date().toISOString(),
      documentos: docs.slice(0, 3),
      prazoPadraoDias: 10,
      versionNumber: 1,
      triggersArtifactRevisionNext: false,
      isCurrentOpenStep: true,
    });
  }

  // 5. Numera as versões de cada artefato (1ª versão = Elaboração, 2ª+ versão = Revisão/Alteração pós-recomendações)
  // e identifica quais Notas Técnicas / Despachos / Pareceres desencadearam alterações nos artefatos!
  const categoryVersionCounter: Partial<Record<SeiStepCategory, number>> = {};
  for (let i = 0; i < filteredSteps.length; i++) {
    const step = filteredSteps[i];
    const count = (categoryVersionCounter[step.category] || 0) + 1;
    categoryVersionCounter[step.category] = count;
    step.versionNumber = count;
  }

  for (let i = 0; i < filteredSteps.length; i++) {
    const step = filteredSteps[i];
    const nextStep = filteredSteps[i + 1];
    if (
      nextStep &&
      (step.isAnalysisOrRecommendation || step.lane.id !== nextStep.lane.id) &&
      nextStep.isCoreEditableArtifact &&
      nextStep.versionNumber >= 2
    ) {
      step.triggersArtifactRevisionNext = true;
    }
  }

  // 6. Verifica a unidade onde o processo está aberto AGORA no SEI (`primaryCurrentUnit`):
  // Se o último passo já estiver na unidade atual, marca-o como posição atual;
  // caso o processo tenha acabado de ser enviado para outra unidade (onde ainda está em análise sem documento novo assinado),
  // acrescenta o cartão de análise em andamento naquela unidade!
  const activeLaneObj = registerUnitLane(primaryCurrentUnit);
  const lastStep = filteredSteps[filteredSteps.length - 1];
  if (
    lastStep.lane.id === activeLaneObj.id ||
    lastStep.unidade.toUpperCase() === primaryCurrentUnit.toUpperCase()
  ) {
    lastStep.isCurrentOpenStep = true;
    lastStep.unidade = primaryCurrentUnit;
  } else {
    const isConjur = /CONJUR|JURIDIC|AGU/i.test(primaryCurrentUnit);
    const isOrcamento = /COFAC|CGOF|ORCAMENT|SPOA/i.test(primaryCurrentUnit);
    const isCompras = /CGLIC|COLIC|DLC|CENTRAL|COMPRAS|LICIT|DCD/i.test(primaryCurrentUnit);
    const inferredCat: SeiStepCategory = isConjur
      ? 'PARECER_JURIDICO'
      : isOrcamento
        ? 'CDO_ORCAMENTO'
        : isCompras
          ? 'MINUTA_EDITAL'
          : 'DESPACHO';

    filteredSteps.push({
      category: inferredCat,
      isCoreEditableArtifact: false,
      isAnalysisOrRecommendation: true,
      unidade: primaryCurrentUnit,
      lane: activeLaneObj,
      dataInicioIso:
        sortedAndamentos.length > 0
          ? parseSeiDateToIso(sortedAndamentos[sortedAndamentos.length - 1].dataHora)
          : new Date().toISOString(),
      dataFimIso: new Date().toISOString(),
      documentos: [],
      prazoPadraoDias: 10,
      versionNumber: (categoryVersionCounter[inferredCat] || 0) + 1,
      triggersArtifactRevisionNext: false,
      isCurrentOpenStep: true,
    });
  }

  // Se a lista de etapas for muito extensa (> 18 etapas), preserva integralmente o início e as 14 etapas mais recentes
  const effectiveSteps =
    filteredSteps.length > 18
      ? [...filteredSteps.slice(0, 4), ...filteredSteps.slice(filteredSteps.length - 14)]
      : filteredSteps;

  const finalLanes = Array.from(lanesMap.values())
    .sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
    .map((l, idx) => ({ ...l, ordem: idx + 1 }));

  // 7. Constrói os Nós BPMN (Start + Tarefas de Marcos/Artefatos/Revisões + Gateways Exclusivos ✕ + End)
  let stepOrder = 1;
  const protoSuffix = normalizeSeiProtocol(planejamento.SEI_Processo).slice(-6) || '1';
  const firstStep = effectiveSteps[0];
  const startNodeId = `node-sei-start-${protoSuffix}`;

  const startNode: BpmnNode = {
    id: startNodeId,
    type: 'start',
    label: 'Autuação no SEI',
    laneId: firstStep.lane.id,
    ordemFluxo: stepOrder++,
    seiUnidade: firstStep.unidade,
    descricao: `Processo autuado no SEI (${planejamento.SEI_Processo})`,
  };

  const generatedNodes: BpmnNode[] = [startNode];
  const generatedTasks: TarefaPlanejamento[] = [];
  const generatedConnections: BpmnConnection[] = [];

  let previousElementId = startNodeId;
  let previousBranchLabel = '';
  let activeNodeId = startNodeId;

  effectiveSteps.forEach((step, idx) => {
    const isLastStep = idx === effectiveSteps.length - 1;
    const nextStep = !isLastStep ? effectiveSteps[idx + 1] : null;
    const isActiveStep = step.isCurrentOpenStep;

    const mainDoc = step.documentos[step.documentos.length - 1];
    const docSeiRef = mainDoc?.idSei || '';
    let allSigned = true;
    const signersList: string[] = [];

    step.documentos.forEach(d => {
      if (!d.assinado) allSigned = false;
      if (d.assinantes) signersList.push(...d.assinantes);
    });

    // Calcula a duração real (em dias) que o processo permaneceu nesta etapa até a etapa seguinte (para evidenciar gargalos!)
    const startMs = new Date(step.dataInicioIso).getTime();
    const nextStartMs = nextStep ? new Date(nextStep.dataInicioIso).getTime() : Date.now();
    const endMs = Math.max(startMs, nextStartMs > startMs ? nextStartMs : new Date(step.dataFimIso).getTime());
    const realElapsedDays = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));

    let statusTarefa: StatusTarefa = 'Concluído';
    if (isActiveStep && planejamento.Status_Planejamento !== 'Gerou Contrato' && planejamento.Status_Planejamento !== 'Arquivado') {
      if (step.documentos.length > 0 && !allSigned) {
        statusTarefa = 'Aguardando Assinatura';
      } else {
        statusTarefa = 'Em Elaboração';
      }
    }

    const taskOrder = stepOrder++;
    const taskId = `tar-in94v2-${protoSuffix}-${idx + 1}-${step.category.toLowerCase()}`;
    const prevTask = existingTarefas.find(t => t.id === taskId);
    const taskTitle = buildStepTitle(step);

    const newTask: TarefaPlanejamento = {
      id: taskId,
      ProcessoPlanejamento: planejamento.SEI_Processo,
      Tarefa: taskTitle,
      Inicio: step.dataInicioIso,
      Prazo_Dias: prevTask?.Prazo_Dias || realElapsedDays || step.prazoPadraoDias,
      Status_Tarefa: statusTarefa,
      areaResponsavel: step.lane.nome,
      ordemFluxo: taskOrder,
      bpmnType: 'task',
      descricao: [
        `Unidade SEI: ${step.unidade}`,
        step.versionNumber > 1 ? `Ciclo de Revisão/Alteração (${step.versionNumber}ª Versão)` : 'Elaboração / Análise',
        `Tempo na etapa: ${realElapsedDays} dia(s)`,
        docSeiRef ? `Doc SEI nº ${docSeiRef}` : 'Em andamento na unidade',
      ].join(' • '),
      dataConclusao: statusTarefa === 'Concluído' ? (nextStep?.dataInicioIso || step.dataFimIso || new Date().toISOString()) : undefined,
      MovidoPor: 'Estúdio de Fluxo SEI (IN 94/2022)',
      MovidoEm: new Date().toISOString(),
      subTarefas:
        step.documentos.length > 0
          ? step.documentos.map((d, dIdx) => ({
              id: `sub-${taskId}-${dIdx}`,
              titulo: repairMojibakeAndBrokenChars(`${d.tipo}${d.numero ? ` ${d.numero}` : ''} (SEI ${d.idSei})`),
              concluida: d.assinado,
            }))
          : prevTask?.subTarefas || [],
      seiDocNumber: docSeiRef || undefined,
      seiUnidade: step.unidade,
      isCurrentSeiPosition: isActiveStep,
      seiAssinado: step.documentos.length > 0 ? allSigned : undefined,
      seiAssinantes: signersList.length > 0 ? Array.from(new Set(signersList)) : undefined,
    };

    generatedTasks.push(newTask);

    generatedConnections.push({
      id: `conn-in94v2-${idx + 1}`,
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

    // 8. INSERÇÃO DE GATEWAYS BPMN 2.0 EXCLUSIVOS (✕) NOS PONTOS DE DECISÃO, RECOMENDAÇÃO DE AJUSTES E TRANSIÇÃO ENTRE ÁREAS
    if (nextStep) {
      const isCrossLane = nextStep.lane.id !== step.lane.id;
      const isTriggeringRevision = step.triggersArtifactRevisionNext || (nextStep.isCoreEditableArtifact && nextStep.versionNumber >= 2 && step.isAnalysisOrRecommendation);
      const isKeyDecisionMilestone =
        step.category === 'DFD' ||
        step.category === 'TR' ||
        step.category === 'NOTA_TECNICA' ||
        step.category === 'CDO_ORCAMENTO' ||
        step.category === 'PARECER_JURIDICO' ||
        step.category === 'HOMOLOGACAO';

      if (isTriggeringRevision || isCrossLane || isKeyDecisionMilestone) {
        let gwLabel = 'Etapa Concluída?';
        let branchLabel = 'Prosseguir';

        if (isTriggeringRevision) {
          gwLabel = 'Solicita Ajustes nos Artefatos?';
          branchLabel = 'Sim (Revisar Artefatos)';
        } else if (step.category === 'DFD') {
          gwLabel = 'Demanda Aprovada?';
          branchLabel = 'Aprovada';
        } else if (step.category === 'TR') {
          gwLabel = step.versionNumber > 1 ? 'TR Revisado Aprovado?' : 'TR Aprovado?';
          branchLabel = 'Aprovado';
        } else if (step.category === 'NOTA_TECNICA') {
          gwLabel = 'Parecer Técnico Favorável?';
          branchLabel = 'Aprovado';
        } else if (step.category === 'CDO_ORCAMENTO') {
          gwLabel = 'Orçamento Certificado?';
          branchLabel = 'CDO Emitida';
        } else if (step.category === 'PARECER_JURIDICO') {
          gwLabel = 'Parecer Jurídico Favorável?';
          branchLabel = nextStep.versionNumber >= 2 ? 'Atender Recomendações' : 'Favorável';
        } else if (step.category === 'HOMOLOGACAO') {
          gwLabel = 'Certame Homologado?';
          branchLabel = 'Homologado';
        } else if (isCrossLane) {
          gwLabel = 'Encaminhar para Próxima Área?';
          branchLabel = nextStep.unidade;
        }

        const gwId = `node-gw-in94v2-${protoSuffix}-${idx + 1}`;
        const gwNode: BpmnNode = {
          id: gwId,
          type: 'gateway_exclusive',
          label: gwLabel,
          laneId: step.lane.id,
          ordemFluxo: stepOrder++,
          seiUnidade: step.unidade,
          descricao: `Ponto de decisão BPMN após ${taskTitle}`,
        };

        generatedNodes.push(gwNode);

        generatedConnections.push({
          id: `conn-gw-in94v2-${idx + 1}`,
          fromId: taskId,
          toId: gwId,
          label: '',
          tipo: 'sequence',
          cor: '#0ea5e9',
          isSeiExecuted: true,
        });

        previousElementId = gwId;
        previousBranchLabel = branchLabel;
      }
    }
  });

  // Se o planejamento já gerou contrato ou está concluído/arquivado, adiciona o nó de Fim
  if (planejamento.Status_Planejamento === 'Gerou Contrato' || planejamento.Status_Planejamento === 'Arquivado') {
    const lastStep = effectiveSteps[effectiveSteps.length - 1];
    const endNodeId = `node-sei-end-${protoSuffix}`;
    generatedNodes.push({
      id: endNodeId,
      type: 'end',
      label: planejamento.Status_Planejamento === 'Gerou Contrato' ? 'Contrato Assinado' : 'Processo Concluído',
      laneId: lastStep.lane.id,
      ordemFluxo: stepOrder++,
      seiUnidade: lastStep.unidade,
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

  // Preserva TODOS os documentos da árvore no metadado (sem truncar o início do processo!)
  const seiSyncMetadata: SeiProcessSyncMetadata = {
    lastSyncAt: scrape.scrapedAt || new Date().toISOString(),
    unidadesAbertas: openUnits,
    unidadeAtual: primaryCurrentUnit,
    ultimoAndamento: repairMojibakeAndBrokenChars(
      latestAndamento?.descricao || activeTask?.Tarefa || 'Sincronizado via SEI (IN 94/2022)'
    ),
    ultimaDataAndamento: latestAndamento?.dataHora || new Date().toLocaleDateString('pt-BR'),
    activeNodeId,
    activeLaneId: activeLaneObj.id,
    activeLaneNome: activeLaneObj.nome,
    diasNaUnidadeAtual,
    processosRelacionados: relatedClassified,
    documentosArvore: docs,
    etapasMapeadasCount: generatedTasks.length,
  };

  // 9. Alimenta o Histórico Processual (`HistoricoPlanejamento`) com todas as etapas relevantes:
  // Artefatos (DFD, ETP, Mapa de Riscos, Pesquisa de Preços, TR, CDO, Minuta, Parecer, Edital, Contrato),
  // todas as suas revisões/alterações (2ª, 3ª versão...), Notas Técnicas e Despachos relevantes!
  const existingHistKeys = new Set(
    existingHistorico
      .filter(h => h.Processo_SEI === planejamento.SEI_Processo)
      .map(h => `${h.Num_SEI || ''}-${(h.Descricao || '').slice(0, 35)}`)
  );

  const newHistoricoEntries: HistoricoPlanejamento[] = [];
  for (const step of effectiveSteps) {
    const stepLabel = buildStepTitle(step);
    for (const d of step.documentos) {
      const desc = repairMojibakeAndBrokenChars(
        `[${stepLabel}] ${d.tipo}${d.numero ? ` nº ${d.numero}` : ''}${d.assinado ? ' (Assinado)' : ' (Minuta)'}`
      );
      const key = `${d.idSei}-${desc.slice(0, 35)}`;
      if (!existingHistKeys.has(key)) {
        existingHistKeys.add(key);
        newHistoricoEntries.push({
          id: `hist-sei-${normalizeSeiProtocol(planejamento.SEI_Processo).slice(-5)}-${d.idSei}`,
          Processo_SEI: planejamento.SEI_Processo,
          Data: parseSeiDateToIso(d.data).slice(0, 10),
          Descricao: desc,
          Num_SEI: d.idSei,
          Coordenacao: d.unidade || step.unidade || primaryCurrentUnit,
        });
      }
    }
  }

  // Extrai automaticamente Portaria da EPC caso detectada na árvore do SEI
  const portariaDoc = docs.find(d => /PORTARIA/i.test(d.tipo) && !/FISCALIZA/i.test(d.tipo));
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
 * Atualiza um Contrato vigente com os dados lidos do SEI (incluindo Notas Técnicas, Despachos Relevantes, Aditivos, Apostilamentos e Processos Associados)
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

  const seiSyncMetadata: SeiProcessSyncMetadata = {
    lastSyncAt: scrape.scrapedAt || new Date().toISOString(),
    unidadesAbertas: openUnits,
    unidadeAtual: openUnits[0] || 'GECTI',
    ultimoAndamento: repairMojibakeAndBrokenChars(latestAndamento?.descricao || 'Processo monitorado no SEI'),
    ultimaDataAndamento: latestAndamento?.dataHora || new Date().toLocaleDateString('pt-BR'),
    processosRelacionados: relatedClassified,
    documentosArvore: docs,
  };

  const existingHistKeys = new Set(
    existingHistoricoContratual
      .filter(h => h.ContratoRelacionado === contrato.id)
      .map(h => `${h.Numero_SEI || ''}-${(h.Descricao || '').slice(0, 35)}`)
  );

  const newHistoricoContratual: HistoricoContratual[] = [];
  docs.forEach((d, idx) => {
    const info = classifySeiDocumentCategory(d, idx, docs.length);
    if (info.category === 'NOISE') return;

    const desc = repairMojibakeAndBrokenChars(
      `[SEI] ${d.tipo}${d.numero ? ` nº ${d.numero}` : ''}${d.assinado ? ' (Assinado)' : ' (Em elaboração)'}`
    );
    const key = `${d.idSei}-${desc.slice(0, 35)}`;
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
