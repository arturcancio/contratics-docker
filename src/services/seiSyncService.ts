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
  BpmnFlowTemplateType,
  SeiProcessSyncMetadata,
  SeiRelatedProcessInfo,
  SeiArtifactVersionStat,
  SeiBottleneckInfo,
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
  resumoConteudo?: string;
  textoExtraido?: string;
  solicitaAjustes?: boolean;
  artefatosCitados?: string[];
  isPdfOuExterno?: boolean;
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
  novosDocumentosLidosCount?: number;
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
      resumoConteudo: d.resumoConteudo ? repairMojibakeAndBrokenChars(d.resumoConteudo) : undefined,
      textoExtraido: d.textoExtraido ? repairMojibakeAndBrokenChars(d.textoExtraido) : undefined,
      artefatosCitados: d.artefatosCitados ? d.artefatosCitados.map(a => repairMojibakeAndBrokenChars(a)) : undefined,
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

// ============================================================================
// OS 4 MODELOS DE ESPINHA DORSAL DE FLUXO BPMN ("BACKBONE MODELS")
// 1. Contratação SOF (Pregão SOF)
// 2. Contratação Colaboragov (Pregão do ColaboraGov)
// 3. Contratação Direta - Inexigibilidade
// 4. Contratação Direta - Dispensa
// ============================================================================

export interface FlowBackboneMilestone {
  category: SeiStepCategory;
  titulo: string;
  unidadePadrao: string;
  prazoDias: number;
  gatewayQuestionAfter?: string;
  gatewayYesLabel?: string;
  gatewayNoRevisionLabel?: string;
  descricaoPadrao: string;
}

export interface FlowBackboneTemplateDef {
  id: BpmnFlowTemplateType;
  nomeExibicao: string;
  tipoProcessoMatch: string[];
  descricao: string;
  milestones: FlowBackboneMilestone[];
}

export const FLOW_BACKBONE_TEMPLATES: Record<BpmnFlowTemplateType, FlowBackboneTemplateDef> = {
  Contratacao_SOF: {
    id: 'Contratacao_SOF',
    nomeExibicao: 'Contratação SOF (Pregão Eletrônico)',
    tipoProcessoMatch: ['Pregão SOF', 'Contratação SOF'],
    descricao: 'Fluxo padrão IN SGD/ME nº 94/2022 e Lei nº 14.133/2021 conduzido no âmbito da SOF/MPO.',
    milestones: [
      {
        category: 'DFD',
        titulo: 'Formalização da Demanda (DFD / PCA)',
        unidadePadrao: 'DEMANDANTE',
        prazoDias: 7,
        gatewayQuestionAfter: 'Demanda Aprovada?',
        gatewayYesLabel: 'Sim (Instituir EPC)',
        descricaoPadrao: 'Elaboração e aprovação do Documento de Formalização da Demanda no PCA.',
      },
      {
        category: 'PORTARIA_EPC',
        titulo: 'Instituição da Equipe de Planejamento (Portaria EPC)',
        unidadePadrao: 'GECTI',
        prazoDias: 5,
        descricaoPadrao: 'Designação formal dos integrantes Requisitante, Técnico e Administrativo.',
      },
      {
        category: 'ETP',
        titulo: 'Elaboração do Estudo Técnico Preliminar (ETP)',
        unidadePadrao: 'GECTI',
        prazoDias: 15,
        descricaoPadrao: 'Estudo de viabilidade técnica, análise de soluções de mercado e parcelamento.',
      },
      {
        category: 'MAPA_RISCOS',
        titulo: 'Mapa de Gerenciamento de Riscos (MGR)',
        unidadePadrao: 'GECTI',
        prazoDias: 7,
        descricaoPadrao: 'Identificação de riscos da fase de planejamento, seleção do fornecedor e gestão contratual.',
      },
      {
        category: 'PESQUISA_PRECOS',
        titulo: 'Pesquisa de Preços e Estimativa de Custos',
        unidadePadrao: 'GECTI',
        prazoDias: 12,
        descricaoPadrao: 'Levantamento de preços públicos (Painel de Preços, contratações similares e cotações) conforme IN 65/2021.',
      },
      {
        category: 'TR',
        titulo: 'Elaboração do Termo de Referência (TR)',
        unidadePadrao: 'GECTI',
        prazoDias: 15,
        gatewayQuestionAfter: 'Artefatos Técnicos Aprovados?',
        gatewayYesLabel: 'Aprovados',
        gatewayNoRevisionLabel: 'Solicitar Ajustes (ETP/TR/Riscos)',
        descricaoPadrao: 'Consolidação das especificações técnicas, níveis mínimos de serviço (ANS) e critérios de medição.',
      },
      {
        category: 'CDO_ORCAMENTO',
        titulo: 'Certificação de Disponibilidade Orçamentária (CDO)',
        unidadePadrao: 'COFAC',
        prazoDias: 7,
        gatewayQuestionAfter: 'Orçamento Certificado?',
        gatewayYesLabel: 'CDO Emitida',
        descricaoPadrao: 'Declaração de adequação orçamentária e reserva de dotação na Ação/PO correspondente.',
      },
      {
        category: 'MINUTA_EDITAL',
        titulo: 'Instrução Licitatória e Minuta de Edital / Contrato',
        unidadePadrao: 'CGLIC',
        prazoDias: 10,
        descricaoPadrao: 'Elaboração da Minuta de Edital de Pregão Eletrônico, Minuta de Contrato e Check-list AGU.',
      },
      {
        category: 'PARECER_JURIDICO',
        titulo: 'Análise e Parecer Jurídico (CONJUR / AGU)',
        unidadePadrao: 'CONJUR',
        prazoDias: 15,
        gatewayQuestionAfter: 'Parecer Jurídico Favorável sem Ressalvas?',
        gatewayYesLabel: 'Saneado / Favorável',
        gatewayNoRevisionLabel: 'Atender Recomendações nos Artefatos',
        descricaoPadrao: 'Controle prévio de legalidade pela Consultoria Jurídica (art. 53 da Lei nº 14.133/2021).',
      },
      {
        category: 'EDITAL_PREGAO',
        titulo: 'Publicação do Edital e Sessão Pública (Pregão)',
        unidadePadrao: 'CGLIC',
        prazoDias: 12,
        descricaoPadrao: 'Divulgação do Edital no PNCP/Compras.gov.br e condução da fase de lances e julgamento.',
      },
      {
        category: 'HOMOLOGACAO',
        titulo: 'Adjudicação e Homologação do Certame',
        unidadePadrao: 'AUTORIDADE',
        prazoDias: 7,
        gatewayQuestionAfter: 'Certame Homologado?',
        gatewayYesLabel: 'Homologado',
        descricaoPadrao: 'Habilitação da licitante vencedora, adjudicação do objeto e homologação pela Autoridade Competente.',
      },
      {
        category: 'EMPENHO_CONTRATO',
        titulo: 'Emissão de Empenho e Assinatura do Contrato',
        unidadePadrao: 'CGLIC',
        prazoDias: 10,
        descricaoPadrao: 'Emissão da Nota de Empenho, convocação para assinatura do Contrato e publicação no PNCP/DOU.',
      },
      {
        category: 'PORTARIA_FISCALIZACAO',
        titulo: 'Designação da Equipe de Fiscalização e Início da Execução',
        unidadePadrao: 'GECTI',
        prazoDias: 5,
        descricaoPadrao: 'Publicação da Portaria de Gestor e Fiscais do Contrato e realização da Reunião Inicial.',
      },
    ],
  },

  Contratacao_Colaboragov: {
    id: 'Contratacao_Colaboragov',
    nomeExibicao: 'Contratação Colaboragov (Central de Compras / MGI)',
    tipoProcessoMatch: ['Pregão do ColaboraGov', 'Pregão Colaboragov', 'Contratação Colaboragov'],
    descricao: 'Fluxo padrão para contratações compartilhadas / centralizadas conduzidas via ColaboraGov / DCD / Central de Compras (MGI).',
    milestones: [
      {
        category: 'DFD',
        titulo: 'Formalização da Demanda (DFD / Intenção de Registro)',
        unidadePadrao: 'DEMANDANTE',
        prazoDias: 7,
        gatewayQuestionAfter: 'Demanda Validada?',
        gatewayYesLabel: 'Sim (Prosseguir)',
        descricaoPadrao: 'Registro da demanda setorial SOF e alinhamento ao calendário de contratações ColaboraGov.',
      },
      {
        category: 'PORTARIA_EPC',
        titulo: 'Designação da Equipe de Planejamento (Portaria EPC)',
        unidadePadrao: 'GECTI',
        prazoDias: 5,
        descricaoPadrao: 'Instituição formal dos representantes técnicos e requisitantes no processo.',
      },
      {
        category: 'ETP',
        titulo: 'Estudo Técnico Preliminar (ETP) e Dimensionamento',
        unidadePadrao: 'GECTI',
        prazoDias: 15,
        descricaoPadrao: 'Demonstração da necessidade, quantitativos da SOF e aderência ao modelo compartilhado.',
      },
      {
        category: 'MAPA_RISCOS',
        titulo: 'Mapa de Gerenciamento de Riscos (MGR)',
        unidadePadrao: 'GECTI',
        prazoDias: 7,
        descricaoPadrao: 'Avaliação dos riscos de adesão/contratação compartilhada e transição contratual.',
      },
      {
        category: 'PESQUISA_PRECOS',
        titulo: 'Pesquisa de Preços e Validação de Custos',
        unidadePadrao: 'GECTI',
        prazoDias: 10,
        descricaoPadrao: 'Comprovação da vantajosidade econômica e memória de cálculo da estimativa.',
      },
      {
        category: 'TR',
        titulo: 'Termo de Referência (TR) / Encarte do Órgão',
        unidadePadrao: 'GECTI',
        prazoDias: 15,
        gatewayQuestionAfter: 'Artefatos Aprovados pela Área Técnica?',
        gatewayYesLabel: 'Sim',
        gatewayNoRevisionLabel: 'Revisar Artefatos (ETP/TR/Riscos)',
        descricaoPadrao: 'Consolidação do Termo de Referência e requisitos específicos de entrega na SOF.',
      },
      {
        category: 'NOTA_TECNICA',
        titulo: 'Análise Técnica e Validação de Governança (CGTI / DCD-MGI)',
        unidadePadrao: 'CGLIC',
        prazoDias: 10,
        gatewayQuestionAfter: 'Solicita Ajustes nos Artefatos?',
        gatewayYesLabel: 'Não (Aprovado)',
        gatewayNoRevisionLabel: 'Sim (Devolver para Ajustes)',
        descricaoPadrao: 'Exame de conformidade técnica e normativa pela unidade centralizadora do ColaboraGov.',
      },
      {
        category: 'CDO_ORCAMENTO',
        titulo: 'Certificação de Disponibilidade Orçamentária (CDO / Descentralização)',
        unidadePadrao: 'COFAC',
        prazoDias: 8,
        gatewayQuestionAfter: 'Orçamento Certificado?',
        gatewayYesLabel: 'CDO Emitida',
        descricaoPadrao: 'Ateste de disponibilidade orçamentária na SOF para cobertura da despesa ou destaque/TED.',
      },
      {
        category: 'MINUTA_EDITAL',
        titulo: 'Instrução no ColaboraGov (Minuta de Edital / Ata / Contrato)',
        unidadePadrao: 'CGLIC',
        prazoDias: 10,
        descricaoPadrao: 'Preparação dos instrumentos convocatórios e listas de verificação pela equipe de licitações MGI.',
      },
      {
        category: 'PARECER_JURIDICO',
        titulo: 'Parecer Jurídico (CONJUR / AGU)',
        unidadePadrao: 'CONJUR',
        prazoDias: 15,
        gatewayQuestionAfter: 'Parecer Jurídico Favorável?',
        gatewayYesLabel: 'Favorável',
        gatewayNoRevisionLabel: 'Saneamento de Recomendações',
        descricaoPadrao: 'Manifestação jurídica conclusiva ou aplicação de Parecer Referencial.',
      },
      {
        category: 'EDITAL_PREGAO',
        titulo: 'Sessão Pública do Pregão ColaboraGov',
        unidadePadrao: 'CGLIC',
        prazoDias: 15,
        descricaoPadrao: 'Publicação do Edital, disputa de lances, análise técnica de propostas e habilitação.',
      },
      {
        category: 'HOMOLOGACAO',
        titulo: 'Adjudicação e Homologação no ColaboraGov',
        unidadePadrao: 'AUTORIDADE',
        prazoDias: 7,
        descricaoPadrao: 'Homologação do resultado final e disponibilização para contratação.',
      },
      {
        category: 'EMPENHO_CONTRATO',
        titulo: 'Emissão de Nota de Empenho e Assinatura do Contrato',
        unidadePadrao: 'CGLIC',
        prazoDias: 10,
        descricaoPadrao: 'Emissão do empenho, formalização do Contrato derivado e publicação no PNCP.',
      },
      {
        category: 'PORTARIA_FISCALIZACAO',
        titulo: 'Designação da Fiscalização na SOF (Portaria)',
        unidadePadrao: 'GECTI',
        prazoDias: 5,
        descricaoPadrao: 'Designação de Gestor e Fiscais do Contrato e início da execução contratual.',
      },
    ],
  },

  Contratacao_Direta_Inexigibilidade: {
    id: 'Contratacao_Direta_Inexigibilidade',
    nomeExibicao: 'Contratação Direta - Inexigibilidade',
    tipoProcessoMatch: ['Contratação Direta - Inexigibilidade', 'Contratação Direta por Inexigibilidade'],
    descricao: 'Fluxo padrão de Inexigibilidade de Licitação (art. 74 da Lei nº 14.133/2021 e IN SGD/ME nº 94/2022) — sem fase de disputa pública de edital.',
    milestones: [
      {
        category: 'DFD',
        titulo: 'Formalização da Demanda (DFD / PCA)',
        unidadePadrao: 'DEMANDANTE',
        prazoDias: 5,
        gatewayQuestionAfter: 'Demanda Aprovada?',
        gatewayYesLabel: 'Sim',
        descricaoPadrao: 'Oficialização da necessidade e previsão da contratação direta no PCA.',
      },
      {
        category: 'PORTARIA_EPC',
        titulo: 'Instituição da Equipe de Planejamento (Portaria EPC)',
        unidadePadrao: 'GECTI',
        prazoDias: 5,
        descricaoPadrao: 'Designação formal da Equipe de Planejamento da Contratação.',
      },
      {
        category: 'ETP',
        titulo: 'Estudo Técnico Preliminar (ETP) e Inviabilidade de Competição',
        unidadePadrao: 'GECTI',
        prazoDias: 12,
        descricaoPadrao: 'Demonstração técnica da singularidade/exclusividade do fornecedor (art. 74 da Lei 14.133/2021).',
      },
      {
        category: 'MAPA_RISCOS',
        titulo: 'Mapa de Gerenciamento de Riscos (MGR)',
        unidadePadrao: 'GECTI',
        prazoDias: 5,
        descricaoPadrao: 'Análise de riscos da contratação direta e controles mitigatórios.',
      },
      {
        category: 'PESQUISA_PRECOS',
        titulo: 'Justificativa de Preços, Exclusividade e Habilitação',
        unidadePadrao: 'GECTI',
        prazoDias: 10,
        descricaoPadrao: 'Comprovação de preços praticados pelo fornecedor junto a outros entes públicos/privados (IN 65/2021, art. 7º) e Atestado de Exclusividade.',
      },
      {
        category: 'TR',
        titulo: 'Elaboração do Termo de Referência (TR)',
        unidadePadrao: 'GECTI',
        prazoDias: 10,
        gatewayQuestionAfter: 'Instrução Técnica Concluída?',
        gatewayYesLabel: 'Aprovada',
        gatewayNoRevisionLabel: 'Revisar Artefatos (ETP/TR/Preços)',
        descricaoPadrao: 'Definição do objeto, obrigações, níveis de serviço e condições de recebimento.',
      },
      {
        category: 'CDO_ORCAMENTO',
        titulo: 'Certificação de Disponibilidade Orçamentária (CDO)',
        unidadePadrao: 'COFAC',
        prazoDias: 5,
        gatewayQuestionAfter: 'Orçamento Certificado?',
        gatewayYesLabel: 'CDO Emitida',
        descricaoPadrao: 'Declaração de disponibilidade orçamentária para a contratação direta.',
      },
      {
        category: 'MINUTA_EDITAL',
        titulo: 'Termo de Inexigibilidade, Minuta de Contrato e Check-list AGU',
        unidadePadrao: 'CGLIC',
        prazoDias: 8,
        descricaoPadrao: 'Instrução do Termo de Reconhecimento de Inexigibilidade e verificação de regularidade fiscal/trabalhista.',
      },
      {
        category: 'PARECER_JURIDICO',
        titulo: 'Parecer Jurídico (CONJUR / AGU)',
        unidadePadrao: 'CONJUR',
        prazoDias: 12,
        gatewayQuestionAfter: 'Parecer Jurídico Favorável?',
        gatewayYesLabel: 'Favorável',
        gatewayNoRevisionLabel: 'Atender Recomendações Jurídicas',
        descricaoPadrao: 'Análise jurídica da caracterização da inexigibilidade e da minuta contratual.',
      },
      {
        category: 'HOMOLOGACAO',
        titulo: 'Autorização da Inexigibilidade pela Autoridade Competente',
        unidadePadrao: 'AUTORIDADE',
        prazoDias: 5,
        gatewayQuestionAfter: 'Contratação Direta Autorizada?',
        gatewayYesLabel: 'Autorizada',
        descricaoPadrao: 'Ato de autorização da contratação direta por Inexigibilidade (art. 72, VIII, da Lei 14.133/2021).',
      },
      {
        category: 'EMPENHO_CONTRATO',
        titulo: 'Emissão de Empenho, Assinatura do Contrato e Divulgação no PNCP',
        unidadePadrao: 'CGLIC',
        prazoDias: 8,
        descricaoPadrao: 'Emissão da Nota de Empenho, assinatura do Contrato e publicação obrigatória no PNCP em até 10 dias úteis.',
      },
      {
        category: 'PORTARIA_FISCALIZACAO',
        titulo: 'Designação de Fiscalização e Início da Execução',
        unidadePadrao: 'GECTI',
        prazoDias: 5,
        descricaoPadrao: 'Designação formal da equipe de fiscalização do contrato.',
      },
    ],
  },

  Contratacao_Direta_Dispensa: {
    id: 'Contratacao_Direta_Dispensa',
    nomeExibicao: 'Contratação Direta - Dispensa de Licitação',
    tipoProcessoMatch: ['Contratação Direta - Dispensa', 'Contratação Direta por Dispensa'],
    descricao: 'Fluxo padrão de Dispensa de Licitação / Dispensa Eletrônica (art. 75 da Lei nº 14.133/2021 e IN SEGES/ME nº 67/2021).',
    milestones: [
      {
        category: 'DFD',
        titulo: 'Formalização da Demanda (DFD / PCA)',
        unidadePadrao: 'DEMANDANTE',
        prazoDias: 5,
        gatewayQuestionAfter: 'Demanda Aprovada?',
        gatewayYesLabel: 'Sim',
        descricaoPadrao: 'Documento de Formalização da Demanda com justificativa da necessidade.',
      },
      {
        category: 'PORTARIA_EPC',
        titulo: 'Designação da Equipe de Planejamento (Quando Aplicável)',
        unidadePadrao: 'GECTI',
        prazoDias: 4,
        descricaoPadrao: 'Indicação dos responsáveis técnicos e requisitantes pela instrução da dispensa.',
      },
      {
        category: 'ETP',
        titulo: 'Estudo Técnico Preliminar (ETP)',
        unidadePadrao: 'GECTI',
        prazoDias: 10,
        descricaoPadrao: 'Análise de viabilidade técnica e enquadramento nos requisitos da Dispensa.',
      },
      {
        category: 'MAPA_RISCOS',
        titulo: 'Mapa de Gerenciamento de Riscos (MGR)',
        unidadePadrao: 'GECTI',
        prazoDias: 5,
        descricaoPadrao: 'Mapeamento dos principais riscos da contratação e ações preventivas.',
      },
      {
        category: 'PESQUISA_PRECOS',
        titulo: 'Pesquisa de Preços e Estimativa da Despesa',
        unidadePadrao: 'GECTI',
        prazoDias: 8,
        descricaoPadrao: 'Estimativa de preços conforme IN SEGES/ME nº 65/2021 (concomitante ou prévia à disputa).',
      },
      {
        category: 'TR',
        titulo: 'Elaboração do Termo de Referência (TR)',
        unidadePadrao: 'GECTI',
        prazoDias: 10,
        gatewayQuestionAfter: 'TR Aprovado?',
        gatewayYesLabel: 'Aprovado',
        gatewayNoRevisionLabel: 'Revisar TR / Pesquisa de Preços',
        descricaoPadrao: 'Especificação do objeto, critérios de aceitação e condições da dispensa.',
      },
      {
        category: 'CDO_ORCAMENTO',
        titulo: 'Certificação de Disponibilidade Orçamentária (CDO)',
        unidadePadrao: 'COFAC',
        prazoDias: 5,
        gatewayQuestionAfter: 'Orçamento Certificado?',
        gatewayYesLabel: 'CDO Emitida',
        descricaoPadrao: 'Comprovação de previsão de recursos orçamentários para o exercício.',
      },
      {
        category: 'MINUTA_EDITAL',
        titulo: 'Aviso de Dispensa Eletrônica / Termo de Dispensa',
        unidadePadrao: 'CGLIC',
        prazoDias: 6,
        descricaoPadrao: 'Elaboração do Aviso de Contratação Direta e Check-list de conformidade.',
      },
      {
        category: 'PARECER_JURIDICO',
        titulo: 'Análise Jurídica / Parecer Referencial (CONJUR / AGU)',
        unidadePadrao: 'CONJUR',
        prazoDias: 10,
        gatewayQuestionAfter: 'Conformidade Jurídica Atestada?',
        gatewayYesLabel: 'Favorável',
        gatewayNoRevisionLabel: 'Adequar Artefatos',
        descricaoPadrao: 'Parecer jurídico ou ateste de conformidade com Parecer Referencial AGU.',
      },
      {
        category: 'EDITAL_PREGAO',
        titulo: 'Publicação do Aviso e Disputa da Dispensa Eletrônica (3 dias úteis)',
        unidadePadrao: 'CGLIC',
        prazoDias: 5,
        descricaoPadrao: 'Divulgação no Compras.gov.br/PNCP e recebimento de lances de fornecedores.',
      },
      {
        category: 'HOMOLOGACAO',
        titulo: 'Julgamento, Habilitação e Autorização da Dispensa',
        unidadePadrao: 'AUTORIDADE',
        prazoDias: 5,
        gatewayQuestionAfter: 'Dispensa Autorizada?',
        gatewayYesLabel: 'Autorizada',
        descricaoPadrao: 'Adjudicação da proposta vencedora e autorização pela Autoridade Competente.',
      },
      {
        category: 'EMPENHO_CONTRATO',
        titulo: 'Emissão de Nota de Empenho e Assinatura do Contrato',
        unidadePadrao: 'CGLIC',
        prazoDias: 7,
        descricaoPadrao: 'Emissão do Empenho, assinatura do instrumento contratual e divulgação no PNCP.',
      },
      {
        category: 'PORTARIA_FISCALIZACAO',
        titulo: 'Designação de Fiscalização e Execução',
        unidadePadrao: 'GECTI',
        prazoDias: 5,
        descricaoPadrao: 'Designação dos responsáveis pelo acompanhamento e recebimento do objeto.',
      },
    ],
  },
};

/**
 * Detecta automaticamente qual dos 4 Modelos de Espinha Dorsal se aplica a um processo de Planejamento
 */
export function detectFlowTemplateFromPlanejamento(
  planejamento: Planejamento,
  scrape?: RawSeiProcessScrapeResult
): BpmnFlowTemplateType {
  if (planejamento.seiSyncMetadata?.modeloFluxoPadrao) {
    return planejamento.seiSyncMetadata.modeloFluxoPadrao;
  }

  const combinedText = `${planejamento.Tipo_Processo || ''} ${planejamento.Modalidade_Contratacao || ''} ${scrape?.tipoProcessoSei || ''} ${scrape?.especificacao || ''}`.toUpperCase();

  if (/INEXIGIBILIDADE/i.test(combinedText)) {
    return 'Contratacao_Direta_Inexigibilidade';
  }
  if (/DISPENSA/i.test(combinedText)) {
    return 'Contratacao_Direta_Dispensa';
  }
  if (/COLABORAGOV|CENTRAL DE COMPRAS|\bDCD\b|COMPARTILHAD/i.test(combinedText)) {
    return 'Contratacao_Colaboragov';
  }
  return 'Contratacao_SOF';
}

/**
 * Gera a estrutura BPMN completa (Raias + Tarefas + Gateways + Setas) a partir de um dos 4 Modelos Padrão
 * (usado quando o usuário seleciona/aplica um modelo manualmente no quadro BPMN ou cria um novo planejamento)
 */
export function generateStandardTemplateBpmn(
  planejamento: Planejamento,
  templateType?: BpmnFlowTemplateType,
  customRules: UnitLaneMappingRule[] = DEFAULT_SEI_UNIT_LANE_RULES
): {
  lanes: BpmnLane[];
  nodes: BpmnNode[];
  connections: BpmnConnection[];
  tarefas: TarefaPlanejamento[];
  templateDef: FlowBackboneTemplateDef;
} {
  const chosenType = templateType || detectFlowTemplateFromPlanejamento(planejamento);
  const templateDef = FLOW_BACKBONE_TEMPLATES[chosenType] || FLOW_BACKBONE_TEMPLATES.Contratacao_SOF;
  const protoSuffix = normalizeSeiProtocol(planejamento.SEI_Processo).slice(-6) || '1';

  const lanesMap = new Map<string, BpmnLane>();
  const registerLane = (unitHint: string): BpmnLane => {
    const { lane } = resolveSeiUnitToLane(unitHint, Array.from(lanesMap.values()), customRules);
    if (!lanesMap.has(lane.id)) {
      lanesMap.set(lane.id, { ...lane });
    }
    return lanesMap.get(lane.id)!;
  };

  let stepOrder = 1;
  const firstLane = registerLane(templateDef.milestones[0]?.unidadePadrao || 'DEMANDANTE');
  const startNodeId = `node-tpl-start-${protoSuffix}`;

  const nodes: BpmnNode[] = [
    {
      id: startNodeId,
      type: 'start',
      label: 'Início do Processo',
      laneId: firstLane.id,
      ordemFluxo: stepOrder++,
      descricao: `Espinha dorsal padrão: ${templateDef.nomeExibicao}`,
    },
  ];
  const tarefas: TarefaPlanejamento[] = [];
  const connections: BpmnConnection[] = [];

  let prevElementId = startNodeId;
  let prevBranchLabel = '';

  templateDef.milestones.forEach((m, idx) => {
    const lane = registerLane(m.unidadePadrao);
    const taskId = `tar-tpl-${protoSuffix}-${idx + 1}-${m.category.toLowerCase()}`;
    const taskOrder = stepOrder++;

    const status: StatusTarefa =
      planejamento.Status_Planejamento === 'Gerou Contrato'
        ? 'Concluído'
        : idx === 0
          ? 'Em Elaboração'
          : 'Pendente';

    tarefas.push({
      id: taskId,
      ProcessoPlanejamento: planejamento.SEI_Processo,
      Tarefa: m.titulo,
      Inicio: new Date(Date.now() + idx * 86400000).toISOString(),
      Prazo_Dias: m.prazoDias,
      Status_Tarefa: status,
      areaResponsavel: lane.nome,
      ordemFluxo: taskOrder,
      bpmnType: 'task',
      descricao: `${m.descricaoPadrao} • Modelo: ${templateDef.nomeExibicao}`,
      seiUnidade: m.unidadePadrao,
      isTemplateFutureMilestone: status === 'Pendente',
      subTarefas: [],
    });

    connections.push({
      id: `conn-tpl-${protoSuffix}-${idx + 1}`,
      fromId: prevElementId,
      toId: taskId,
      label: prevBranchLabel,
      tipo: 'sequence',
      cor: status === 'Concluído' ? '#0ea5e9' : '#64748b',
    });

    prevElementId = taskId;
    prevBranchLabel = '';

    if (m.gatewayQuestionAfter && idx < templateDef.milestones.length - 1) {
      const gwId = `node-tpl-gw-${protoSuffix}-${idx + 1}`;
      nodes.push({
        id: gwId,
        type: 'gateway_exclusive',
        label: m.gatewayQuestionAfter,
        laneId: lane.id,
        ordemFluxo: stepOrder++,
        seiUnidade: m.unidadePadrao,
        descricao: `Decisão de marco do modelo ${templateDef.nomeExibicao}`,
      });
      connections.push({
        id: `conn-tpl-gw-${protoSuffix}-${idx + 1}`,
        fromId: taskId,
        toId: gwId,
        label: '',
        tipo: 'sequence',
        cor: '#0ea5e9',
      });
      prevElementId = gwId;
      prevBranchLabel = m.gatewayYesLabel || 'Aprovado';
    }
  });

  const lastLane = registerLane(templateDef.milestones[templateDef.milestones.length - 1]?.unidadePadrao || 'GECTI');
  const endNodeId = `node-tpl-end-${protoSuffix}`;
  nodes.push({
    id: endNodeId,
    type: 'end',
    label: 'Contratação Concluída',
    laneId: lastLane.id,
    ordemFluxo: stepOrder++,
  });
  connections.push({
    id: `conn-tpl-end-${protoSuffix}`,
    fromId: prevElementId,
    toId: endNodeId,
    label: prevBranchLabel || 'Concluído',
    tipo: 'sequence',
    cor: '#10b981',
  });

  const finalLanes = Array.from(lanesMap.values())
    .sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
    .map((l, idx) => ({ ...l, ordem: idx + 1 }));

  return { lanes: finalLanes, nodes, connections, tarefas, templateDef };
}

/**
 * Integração opcional com IA (Google Gemini API) para enriquecer os resumos dos documentos novos lidos pela extensão.
 * Se não houver chave configurada, utiliza imediatamente o resumo heurístico extraído pela extensão (zero dependência obrigatória!).
 */
export async function enrichNewDocumentsWithGeminiAi(
  rawScrape: RawSeiProcessScrapeResult,
  geminiApiKey?: string | null
): Promise<RawSeiProcessScrapeResult> {
  const apiKey = (geminiApiKey || localStorage.getItem('contratics_gemini_api_key') || '').trim();
  if (!apiKey || !rawScrape.documentos || rawScrape.documentos.length === 0) {
    return rawScrape;
  }

  // Seleciona até 6 documentos que possuem textoExtraido e ainda não foram refinados por IA
  const docsToRefine = rawScrape.documentos
    .filter(d => d.textoExtraido && d.textoExtraido.length > 60 && !d.resumoConteudo?.startsWith('✨ [IA]'))
    .slice(-6);

  if (docsToRefine.length === 0) {
    return rawScrape;
  }

  try {
    const promptPayload = docsToRefine.map(d => ({
      idSei: d.idSei,
      tipo: d.tipo,
      numero: d.numero || '',
      unidade: d.unidade || '',
      trechoTexto: (d.textoExtraido || '').slice(0, 1400),
    }));

    const systemInstruction = `Você é um especialista em contratações públicas de TIC (Lei 14.133/2021 e IN SGD/ME 94/2022).
Para cada documento do SEI abaixo, retorne um JSON array com objetos contendo:
- "idSei": string (exatamente igual ao enviado)
- "resumoExecutivo": string (resumo objetivo em 1 ou 2 frases de até 280 caracteres explicando o que o documento trata, decide ou encaminha)
- "solicitaAjustes": boolean (true se o despacho/nota técnica/parecer solicitar correções, alterações ou revisões em ETP, TR, Mapa de Riscos ou Pesquisa de Preços)
- "artefatosAfetados": string[] (lista de artefatos cuja alteração foi solicitada, ex: ["ETP", "TR"])
Responda APENAS com o JSON puro.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemInstruction}\n\nDocumentos:\n${JSON.stringify(promptPayload)}` }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      return rawScrape;
    }

    const data = await response.json();
    const rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!rawJsonText) return rawScrape;

    const parsedAi = JSON.parse(rawJsonText.replace(/```json|```/g, '').trim());
    if (!Array.isArray(parsedAi)) return rawScrape;

    const aiMap = new Map<string, any>();
    parsedAi.forEach(item => {
      if (item && item.idSei) aiMap.set(String(item.idSei), item);
    });

    const updatedDocs = rawScrape.documentos.map(d => {
      const aiItem = aiMap.get(String(d.idSei));
      if (!aiItem || !aiItem.resumoExecutivo) return d;
      return {
        ...d,
        resumoConteudo: `✨ [IA] ${String(aiItem.resumoExecutivo).trim()}`,
        solicitaAjustes: Boolean(aiItem.solicitaAjustes ?? d.solicitaAjustes),
        artefatosCitados:
          Array.isArray(aiItem.artefatosAfetados) && aiItem.artefatosAfetados.length > 0
            ? aiItem.artefatosAfetados
            : d.artefatosCitados,
      };
    });

    return {
      ...rawScrape,
      documentos: updatedDocs,
    };
  } catch {
    return rawScrape;
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
  // e computa as estatísticas detalhadas de quantas vezes cada artefato foi alterado e quanto tempo cada alteração levou!
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
    const hasDocRequestingAdjustments = step.documentos.some(d => d.solicitaAjustes);
    if (
      hasDocRequestingAdjustments ||
      (nextStep &&
        (step.isAnalysisOrRecommendation || step.lane.id !== nextStep.lane.id) &&
        nextStep.isCoreEditableArtifact &&
        nextStep.versionNumber >= 2)
    ) {
      step.triggersArtifactRevisionNext = true;
    }
  }

  // Calcula Estatísticas de Versões e Tempo de Alteração por Artefato (DFD, ETP, Mapa de Riscos, Pesquisa de Preços, TR, Minuta)
  const ARTIFACT_LABELS: Partial<Record<SeiStepCategory, string>> = {
    DFD: 'DFD (Formalização da Demanda)',
    ETP: 'ETP (Estudo Técnico Preliminar)',
    MAPA_RISCOS: 'Mapa de Gerenciamento de Riscos (MGR)',
    PESQUISA_PRECOS: 'Pesquisa de Preços / Estimativa',
    TR: 'Termo de Referência (TR)',
    MINUTA_EDITAL: 'Minuta de Edital / Contrato',
    CDO_ORCAMENTO: 'Certificação Orçamentária (CDO)',
  };

  const artifactStatsMap = new Map<SeiStepCategory, SeiArtifactVersionStat>();
  for (let i = 0; i < filteredSteps.length; i++) {
    const step = filteredSteps[i];
    const artName = ARTIFACT_LABELS[step.category];
    if (!artName) continue;

    // Procura a análise/despacho/NT imediatamente anterior que motivou esta alteração (se versao >= 2)
    let motivatorStep: ChronologicalStepGroup | undefined;
    if (step.versionNumber >= 2) {
      for (let j = i - 1; j >= 0; j--) {
        if (filteredSteps[j].category === step.category) break;
        if (filteredSteps[j].isAnalysisOrRecommendation || filteredSteps[j].lane.id !== step.lane.id) {
          motivatorStep = filteredSteps[j];
          break;
        }
      }
    }

    const prevSameCategoryStep = filteredSteps
      .slice(0, i)
      .reverse()
      .find(s => s.category === step.category);

    const refStartMs = motivatorStep
      ? new Date(motivatorStep.dataInicioIso).getTime()
      : prevSameCategoryStep
        ? new Date(prevSameCategoryStep.dataFimIso).getTime()
        : new Date(step.dataInicioIso).getTime();

    const stepEndMs = new Date(step.dataFimIso).getTime();
    const diasElapsed = Math.max(1, Math.ceil(Math.abs(stepEndMs - refStartMs) / (1000 * 60 * 60 * 24)));

    const mainDoc = step.documentos[step.documentos.length - 1];
    const motivatorDoc = motivatorStep?.documentos[motivatorStep.documentos.length - 1];

    if (!artifactStatsMap.has(step.category)) {
      artifactStatsMap.set(step.category, {
        categoria: step.category,
        nomeArtefato: artName,
        totalVersoes: 0,
        totalAlteracoes: 0,
        diasTotaisRetrabalho: 0,
        diasPrimeiraElaboracao: diasElapsed,
        versoes: [],
      });
    }

    const stat = artifactStatsMap.get(step.category)!;
    stat.totalVersoes = step.versionNumber;
    stat.totalAlteracoes = Math.max(0, step.versionNumber - 1);
    if (step.versionNumber >= 2) {
      stat.diasTotaisRetrabalho += diasElapsed;
    } else {
      stat.diasPrimeiraElaboracao = diasElapsed;
    }

    stat.versoes.push({
      versao: step.versionNumber,
      idSei: mainDoc?.idSei || '',
      numeroDoc: mainDoc?.numero,
      data: mainDoc?.data || new Date(step.dataFimIso).toLocaleDateString('pt-BR'),
      unidade: step.unidade,
      diasDesdeAnterior: step.versionNumber >= 2 ? diasElapsed : stat.diasPrimeiraElaboracao,
      motivadoPorDocSei: motivatorDoc?.idSei,
      motivadoPorTipo: motivatorDoc?.tipo,
      motivadoPorUnidade: motivatorStep?.unidade,
      resumoMudanca: mainDoc?.resumoConteudo || motivatorDoc?.resumoConteudo,
    });
  }

  const estatisticasVersoesArtefatos = Array.from(artifactStatsMap.values());

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

  // Detecta o Modelo de Espinha Dorsal ("Backbone") aplicável ao processo
  const templateType = detectFlowTemplateFromPlanejamento(planejamento, scrape);
  const backboneTemplate = FLOW_BACKBONE_TEMPLATES[templateType] || FLOW_BACKBONE_TEMPLATES.Contratacao_SOF;

  // Se a lista de etapas executadas for muito extensa (> 16 etapas), preserva o início e as 12 etapas mais recentes
  const effectiveSteps =
    filteredSteps.length > 16
      ? [...filteredSteps.slice(0, 4), ...filteredSteps.slice(filteredSteps.length - 12)]
      : filteredSteps;

  // Identifica quais marcos da Espinha Dorsal ("Backbone") ainda NÃO foram alcançados pelo processo em curso
  const executedCategories = new Set<SeiStepCategory>(filteredSteps.map(s => s.category));
  let highestReachedMilestoneIdx = -1;
  backboneTemplate.milestones.forEach((m, mIdx) => {
    if (executedCategories.has(m.category)) {
      highestReachedMilestoneIdx = mIdx;
    }
  });

  const isProcessAlreadyFinished =
    planejamento.Status_Planejamento === 'Gerou Contrato' || planejamento.Status_Planejamento === 'Arquivado';

  const pendingBackboneMilestones: FlowBackboneMilestone[] = isProcessAlreadyFinished
    ? []
    : backboneTemplate.milestones.filter((m, mIdx) => {
        if (executedCategories.has(m.category)) return false;
        // Inclui marcos posteriores ao último marco atingido (ou marcos essenciais de seleção/contratação ainda pendentes)
        return mIdx > highestReachedMilestoneIdx || ['CDO_ORCAMENTO', 'PARECER_JURIDICO', 'EDITAL_PREGAO', 'HOMOLOGACAO', 'EMPENHO_CONTRATO'].includes(m.category);
      });

  // Garante que as raias dos marcos futuros da espinha dorsal também estejam registradas no diagrama
  pendingBackboneMilestones.forEach(pm => {
    registerUnitLane(pm.unidadePadrao);
  });

  const finalLanes = Array.from(lanesMap.values())
    .sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
    .map((l, idx) => ({ ...l, ordem: idx + 1 }));

  // 7. Constrói os Nós BPMN (Start + Tarefas Executadas no SEI + Gateways de Decisão/Alteração + Marcos Futuros da Espinha Dorsal + End)
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
    descricao: `Processo autuado no SEI (${planejamento.SEI_Processo}) • Modelo: ${backboneTemplate.nomeExibicao}`,
  };

  const generatedNodes: BpmnNode[] = [startNode];
  const generatedTasks: TarefaPlanejamento[] = [];
  const generatedConnections: BpmnConnection[] = [];
  const gargalosDetectados: SeiBottleneckInfo[] = [];

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
    if (isActiveStep && !isProcessAlreadyFinished) {
      if (step.documentos.length > 0 && !allSigned) {
        statusTarefa = 'Aguardando Assinatura';
      } else {
        statusTarefa = 'Em Elaboração';
      }
    }

    const totalVersionsOfThisCat = categoryVersionCounter[step.category] || 1;
    const isBottleneckStep = realElapsedDays > Math.max(15, step.prazoPadraoDias * 1.4) || step.versionNumber >= 2;

    if (realElapsedDays >= 10 || step.versionNumber >= 2) {
      gargalosDetectados.push({
        etapa: buildStepTitle(step),
        unidade: step.unidade,
        dias: realElapsedDays,
        seiDocNumber: docSeiRef || undefined,
        motivo:
          step.versionNumber >= 2
            ? `Retrabalho / ${step.versionNumber}ª versão do artefato (${realElapsedDays} dias)`
            : mainDoc?.resumoConteudo || `Permanência de ${realElapsedDays} dias na unidade ${step.unidade}`,
        isRetrabalho: step.versionNumber >= 2,
      });
    }

    const taskOrder = stepOrder++;
    const taskId = `tar-in94v2-${protoSuffix}-${idx + 1}-${step.category.toLowerCase()}`;
    const prevTask = existingTarefas.find(t => t.id === taskId);
    const taskTitle = buildStepTitle(step);
    const resumoDocPrincipal = mainDoc?.resumoConteudo || step.documentos.find(d => d.resumoConteudo)?.resumoConteudo;

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
        step.versionNumber > 1
          ? `Alterado ${step.versionNumber - 1}x (${step.versionNumber}ª Versão de ${totalVersionsOfThisCat})`
          : totalVersionsOfThisCat > 1
            ? `1ª Versão (Teve ${totalVersionsOfThisCat - 1} alteração(ões) posterior(es))`
            : 'Elaboração / Análise',
        `Duração: ${realElapsedDays} dia(s)`,
        docSeiRef ? `Doc SEI nº ${docSeiRef}` : 'Em andamento na unidade',
        resumoDocPrincipal ? `Resumo: ${resumoDocPrincipal}` : '',
      ]
        .filter(Boolean)
        .join(' • '),
      dataConclusao: statusTarefa === 'Concluído' ? (nextStep?.dataInicioIso || step.dataFimIso || new Date().toISOString()) : undefined,
      MovidoPor: `Estúdio de Fluxo SEI (${backboneTemplate.nomeExibicao})`,
      MovidoEm: new Date().toISOString(),
      subTarefas:
        step.documentos.length > 0
          ? step.documentos.map((d, dIdx) => ({
              id: `sub-${taskId}-${dIdx}`,
              titulo: repairMojibakeAndBrokenChars(`${d.tipo}${d.numero ? ` ${d.numero}` : ''} (SEI ${d.idSei})`),
              concluida: d.assinado,
              seiDocNumber: d.idSei,
              resumoConteudo: d.resumoConteudo,
            }))
          : prevTask?.subTarefas || [],
      seiDocNumber: docSeiRef || undefined,
      seiUnidade: step.unidade,
      isCurrentSeiPosition: isActiveStep,
      seiAssinado: step.documentos.length > 0 ? allSigned : undefined,
      seiAssinantes: signersList.length > 0 ? Array.from(new Set(signersList)) : undefined,
      versaoArtefato: step.isCoreEditableArtifact ? step.versionNumber : undefined,
      totalVersoesArtefato: step.isCoreEditableArtifact ? totalVersionsOfThisCat : undefined,
      diasRetrabalho: step.versionNumber >= 2 ? realElapsedDays : undefined,
      resumoDocumento: resumoDocPrincipal,
      isBottleneck: isBottleneckStep,
      allSeiDocs: step.documentos.map(d => ({
        idSei: d.idSei,
        tipo: d.tipo,
        numero: d.numero,
        versao: step.versionNumber,
        resumo: d.resumoConteudo,
      })),
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
      const isTriggeringRevision =
        step.triggersArtifactRevisionNext ||
        (nextStep.isCoreEditableArtifact && nextStep.versionNumber >= 2 && (step.isAnalysisOrRecommendation || isCrossLane));
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
          const targetArtName = ARTIFACT_LABELS[nextStep.category]?.split(' (')[0] || 'Artefatos';
          gwLabel = `Solicita Alteração em ${targetArtName}?`;
          branchLabel = `Sim (${nextStep.versionNumber}ª Versão)`;
        } else if (step.category === 'DFD') {
          gwLabel = 'Demanda Aprovada?';
          branchLabel = 'Aprovada';
        } else if (step.category === 'TR') {
          gwLabel = step.versionNumber > 1 ? `TR (${step.versionNumber}ª Versão) Aprovado?` : 'TR Aprovado?';
          branchLabel = 'Sim (Prosseguir)';
        } else if (step.category === 'NOTA_TECNICA') {
          gwLabel = 'Haverá Mudança nos Documentos?';
          branchLabel = 'Não (Aprovado)';
        } else if (step.category === 'CDO_ORCAMENTO') {
          gwLabel = 'Orçamento Certificado?';
          branchLabel = 'CDO Emitida';
        } else if (step.category === 'PARECER_JURIDICO') {
          gwLabel = 'Parecer Jurídico Favorável?';
          branchLabel = nextStep.versionNumber >= 2 ? 'Atender Recomendações' : 'Favorável';
        } else if (step.category === 'HOMOLOGACAO') {
          gwLabel = 'Contratação Autorizada / Homologada?';
          branchLabel = 'Sim';
        } else if (isCrossLane) {
          gwLabel = `Haverá Ajustes (${step.unidade})?`;
          branchLabel = `Seguir → ${nextStep.unidade}`;
        }

        const gwId = `node-gw-in94v2-${protoSuffix}-${idx + 1}`;
        const gwNode: BpmnNode = {
          id: gwId,
          type: 'gateway_exclusive',
          label: gwLabel,
          laneId: step.lane.id,
          ordemFluxo: stepOrder++,
          seiUnidade: step.unidade,
          descricao: `Decisão BPMN sobre alterações em documentos / encaminhamento após ${taskTitle}`,
        };

        generatedNodes.push(gwNode);

        generatedConnections.push({
          id: `conn-gw-in94v2-${idx + 1}`,
          fromId: taskId,
          toId: gwId,
          label: '',
          tipo: 'sequence',
          cor: isTriggeringRevision ? '#f59e0b' : '#0ea5e9',
          isSeiExecuted: true,
        });

        previousElementId = gwId;
        previousBranchLabel = branchLabel;
      }
    }
  });

  // 8.5. ENCAIXE DOS MARCOS FUTUROS DA ESPINHA DORSAL ("BACKBONE") PARA PROCESSOS EM CURSO
  // Deixa claro para o gestor tudo o que já ocorreu no SEI (colorido/executado) e o que ainda falta percorrer segundo o modelo!
  if (pendingBackboneMilestones.length > 0) {
    pendingBackboneMilestones.forEach((futureMilestone, fIdx) => {
      const targetLane = registerUnitLane(futureMilestone.unidadePadrao);
      const futureTaskOrder = stepOrder++;
      const futureTaskId = `tar-backbone-future-${protoSuffix}-${fIdx + 1}-${futureMilestone.category.toLowerCase()}`;

      const futureTask: TarefaPlanejamento = {
        id: futureTaskId,
        ProcessoPlanejamento: planejamento.SEI_Processo,
        Tarefa: futureMilestone.titulo,
        Inicio: new Date(Date.now() + (fIdx + 1) * 86400000).toISOString(),
        Prazo_Dias: futureMilestone.prazoDias,
        Status_Tarefa: 'Pendente',
        areaResponsavel: targetLane.nome,
        ordemFluxo: futureTaskOrder,
        bpmnType: 'task',
        descricao: `[Marco Previsto no Modelo ${backboneTemplate.nomeExibicao}] ${futureMilestone.descricaoPadrao}`,
        seiUnidade: futureMilestone.unidadePadrao,
        isTemplateFutureMilestone: true,
        subTarefas: [],
      };

      generatedTasks.push(futureTask);

      generatedConnections.push({
        id: `conn-backbone-future-${protoSuffix}-${fIdx + 1}`,
        fromId: previousElementId,
        toId: futureTaskId,
        label: previousBranchLabel || (fIdx === 0 ? 'Próximo Marco' : ''),
        tipo: 'sequence',
        cor: '#64748b',
        isSeiExecuted: false,
      });

      previousElementId = futureTaskId;
      previousBranchLabel = '';

      if (futureMilestone.gatewayQuestionAfter && fIdx < pendingBackboneMilestones.length - 1) {
        const futureGwId = `node-gw-future-${protoSuffix}-${fIdx + 1}`;
        generatedNodes.push({
          id: futureGwId,
          type: 'gateway_exclusive',
          label: futureMilestone.gatewayQuestionAfter,
          laneId: targetLane.id,
          ordemFluxo: stepOrder++,
          seiUnidade: futureMilestone.unidadePadrao,
          descricao: `Decisão prevista no modelo ${backboneTemplate.nomeExibicao}`,
        });

        generatedConnections.push({
          id: `conn-gw-future-${protoSuffix}-${fIdx + 1}`,
          fromId: futureTaskId,
          toId: futureGwId,
          label: '',
          tipo: 'sequence',
          cor: '#64748b',
          isSeiExecuted: false,
        });

        previousElementId = futureGwId;
        previousBranchLabel = futureMilestone.gatewayYesLabel || 'Sim';
      }
    });
  }

  // Nó de Fim da Espinha Dorsal (sempre presente ao final do fluxo para fechar o modelo BPMN)
  const endLane =
    pendingBackboneMilestones.length > 0
      ? registerUnitLane(pendingBackboneMilestones[pendingBackboneMilestones.length - 1].unidadePadrao)
      : effectiveSteps[effectiveSteps.length - 1].lane;
  const endNodeId = `node-sei-end-${protoSuffix}`;
  generatedNodes.push({
    id: endNodeId,
    type: 'end',
    label:
      planejamento.Status_Planejamento === 'Gerou Contrato'
        ? 'Contrato Assinado'
        : isProcessAlreadyFinished
          ? 'Processo Concluído'
          : 'Fim Previsto (Contrato)',
    laneId: endLane.id,
    ordemFluxo: stepOrder++,
  });
  generatedConnections.push({
    id: `conn-sei-end-${protoSuffix}`,
    fromId: previousElementId,
    toId: endNodeId,
    label: previousBranchLabel || (isProcessAlreadyFinished ? 'Finalizado' : 'Conclusão'),
    tipo: 'sequence',
    cor: isProcessAlreadyFinished ? '#10b981' : '#64748b',
    isSeiExecuted: isProcessAlreadyFinished,
  });

  // Ordena gargalos do maior tempo para o menor
  gargalosDetectados.sort((a, b) => b.dias - a.dias);
  const gargaloPrincipal = gargalosDetectados[0];

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

  // Preserva TODOS os documentos da árvore no metadado (com seus resumos e versões!)
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
    etapasMapeadasCount: generatedTasks.filter(t => !t.isTemplateFutureMilestone).length,
    modeloFluxoPadrao: templateType,
    modeloFluxoNome: backboneTemplate.nomeExibicao,
    estatisticasVersoesArtefatos,
    gargalosDetectados: gargalosDetectados.slice(0, 6),
    gargaloPrincipal,
    novosDocumentosLidosCount: scrape.novosDocumentosLidosCount,
  };

  // 9. Alimenta o Histórico Processual (`HistoricoPlanejamento`) com todas as etapas relevantes,
  // incluindo o RESUMO DO CONTEÚDO lido do documento, o número de versões/alterações e o tempo gasto!
  const existingHistBySei = new Map<string, HistoricoPlanejamento>();
  existingHistorico
    .filter(h => h.Processo_SEI === planejamento.SEI_Processo)
    .forEach(h => {
      if (h.Num_SEI) existingHistBySei.set(String(h.Num_SEI), h);
    });

  const newHistoricoEntries: HistoricoPlanejamento[] = [];
  for (const step of filteredSteps) {
    const stepLabel = buildStepTitle(step);
    const totalVersoesCat = categoryVersionCounter[step.category] || 1;
    const statForCat = artifactStatsMap.get(step.category);
    const verInfo = statForCat?.versoes.find(v => v.versao === step.versionNumber);

    for (const d of step.documentos) {
      const versionBadgeText =
        step.isCoreEditableArtifact && totalVersoesCat > 1
          ? ` • ${step.versionNumber}ª de ${totalVersoesCat} versões (${totalVersoesCat - 1} alteração(ões)${
              verInfo && step.versionNumber >= 2 ? `, levou ${verInfo.diasDesdeAnterior}d` : ''
            })`
          : '';

      const summarySuffix = d.resumoConteudo ? ` — Resumo: ${d.resumoConteudo}` : '';

      const desc = repairMojibakeAndBrokenChars(
        `[${stepLabel}${versionBadgeText}] ${d.tipo}${d.numero ? ` nº ${d.numero}` : ''}${
          d.assinado ? ' (Assinado)' : ' (Minuta)'
        }${summarySuffix}`
      );

      const prevHist = existingHistBySei.get(String(d.idSei));
      if (!prevHist || (d.resumoConteudo && !prevHist.Resumo_Documento)) {
        newHistoricoEntries.push({
          id: prevHist?.id || `hist-sei-${normalizeSeiProtocol(planejamento.SEI_Processo).slice(-5)}-${d.idSei}`,
          Processo_SEI: planejamento.SEI_Processo,
          Data: parseSeiDateToIso(d.data).slice(0, 10),
          Descricao: desc,
          Num_SEI: d.idSei,
          Coordenacao: d.unidade || step.unidade || primaryCurrentUnit,
          Resumo_Documento: d.resumoConteudo,
          Tipo_Documento: d.tipo,
          Versao_Artefato: step.isCoreEditableArtifact ? step.versionNumber : undefined,
          Total_Versoes_Artefato: step.isCoreEditableArtifact ? totalVersoesCat : undefined,
          Dias_Elaboracao: verInfo?.diasDesdeAnterior,
          Solicita_Alteracao: d.solicitaAjustes || step.triggersArtifactRevisionNext,
          Artefatos_Afetados: d.artefatosCitados,
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
