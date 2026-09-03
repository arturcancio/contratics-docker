/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'GECTI' | 'Fiscal' | 'Auditor' | 'Visualizador';
  passwordSimulated: string;
  needsPasswordReset: boolean;
}

export interface Fornecedor {
  id: string;
  Nome_Fornecedor: string;
  CNPJ: string;
  EmailContato: string;
  TelefoneContato: string;
  Situacao: 'Ativo' | 'Inativo';
}

export type StatusDFD = 'Concluído' | 'Iniciado' | 'Não iniciado';
export type PeriodicidadePagamento = 'Mensal' | 'Anual' | 'Total';

export interface DFD {
  id: string;
  Num_DFD: string;
  Ano_PCA: string;
  Descricao_Objeto: string;
  Valor_Estimado: number;
  Status_DFD: StatusDFD;
  UASG: string;
  Planejamento_Vinculado?: string; // ID of Planejamento (SEI_Processo as lookup)
  Data_conclusao_estimada: string;
  Periodicidade_Pagamento: PeriodicidadePagamento;
  Valor_Anual_Proporcional: number;
  Anexo_PDF?: string; // simulated base64 or file name
  Anexo_PDF_Nome?: string; // file name of the attachment
  Contabilizar_Orcamento: boolean; // toggle to include/exclude from budget
  updatedAt: string; // ISO String to trace last changes
  Valor_Custeio?: number;
  Valor_Investimento?: number;
  Valor_Customizado?: number | null;
  Orcamento_Exercicios?: string[];
  Contabilizar_Orcamento_Anual?: { [year: string]: boolean };
  Valor_Customizado_Anual?: { [year: string]: number | null };
  isBudgetOnlyItem?: boolean;
}

export type StatusPlanejamento = 'Em Elaboração' | 'Seleção Fornecedor' | 'Gerou Contrato' | 'Arquivado';
export type PCAType = 'MPO' | 'MGI';

export interface Planejamento {
  id: string;
  DFD_PNCP: string; // lookup or free text linked to DFD
  Data_Inicio_Processo_SEI: string;
  Objeto: string;
  SEI_Processo: string; // primary key-like string for identification
  Portaria_Equipe_PC_Numero: string;
  Portaria_Equipe_PC_SEI: string;
  Int_Requisitante: string;
  Int_Requisitante_Subst: string;
  Int_Tecnico: string;
  Int_Tecnico_Subst: string;
  Int_Administrativo: string;
  Int_Administrativo_Subst: string;
  Estimativa_Custo: number;
  Status_Planejamento: StatusPlanejamento;
  Contrato_Originado?: string; // ID of Contrato
  Data_Sessao_Publica: string;
  Link_Sessao: string;
  PCA: PCAType;
  Ano_PCA_Vinculado: string;
  Tipo_Processo: string; // 'Pregão SOF' | 'Contratação Direta - Inexigibilidade' | 'Contratação Direta - Dispensa' | 'Pregão do ColaboraGov'
  Acao_Orcamentaria?: string;
  Plano_Orcamentario?: string;
  GND?: '3 - Custeio' | '4 - Investimento';
  Natureza_Objeto?: 'Bem' | 'Serviço';
  Periodicidade_Pagamento?: 'Mensal' | 'Total';
  Modalidade_Contratacao?: string;
  updatedAt: string;
  Contabilizar_Orcamento?: boolean;
  Valor_Customizado?: number | null;
  Orcamento_Exercicios?: string[];
  Contabilizar_Orcamento_Anual?: { [year: string]: boolean };
  Valor_Customizado_Anual?: { [year: string]: number | null };
  isBudgetOnlyItem?: boolean;
}

export interface HistoricoPlanejamento {
  id: string;
  Processo_SEI: string; // ID of Planejamento
  Data: string;
  Descricao: string;
  Num_SEI: string;
  Coordenacao: string;
}

export type StatusTarefa = 'Pendente' | 'Em Elaboração' | 'Aguardando Assinatura' | 'Concluído';

export interface SubTarefa {
  id: string;
  titulo: string;
  concluida: boolean;
}

export interface TarefaPlanejamento {
  id: string;
  ProcessoPlanejamento: string; // ID/Process of Planejamento
  Tarefa: string;
  Inicio: string; // ISO date
  Prazo_Dias: number;
  Status_Tarefa: StatusTarefa;
  MovidoPor?: string; // registry of user action
  MovidoEm?: string; // timestamp of movement
  DuracaoColunas?: Record<string, number>; // records in seconds in each column
  subTarefas?: SubTarefa[];
}

export type StatusContrato = 'Vigente' | 'A Vencer' | 'Encerrado';

export interface DescentralizacaoItem {
  id: string;
  processoSei: string; // Nº SEI do Processo de Descentralização
  valor: number; // Valor Descentralizado / Repassado (R$)
  descricao?: string; // Descrição / Memorial de Cálculo
  data?: string; // Data da descentralização
  empenhoIds?: string[]; // IDs ou números das Notas de Empenho vinculadas
  empenhosNumeros?: string[]; // Códigos/números legíveis das NEs vinculadas (ex: ["2026NE000142"])
}

export interface NotaEmpenhoItem {
  id: string;
  numero: string; // Ex: 2026NE000142
  sei?: string; // Ex: 19975.000145/2026-33
  valor?: number;
  dataEmissao?: string;
  observacao?: string;
}

export interface OrdemServico {
  id: string;
  numeroOS: string;
  dataEmissao: string;
  valor: number;
  prazoEntrega?: string; // date or days limit
  statusOS: 'Pendente' | 'Executada' | 'Em Execução' | 'Cancelada' | 'Empenhado' | 'Liquidado' | 'Pago';
  observacao?: string;
  
  // Novo detalhamento por OS
  dataInicioPeriodo?: string; // Intervalo de tempo a que a OS se refere (Início)
  dataFimPeriodo?: string;   // Intervalo de tempo a que a OS se refere (Fim)

  // Nota de Empenho (CSC - MGI)
  numeroEmpenho?: string;
  seiEmpenho?: string;
  valorEmpenho?: number;
  empenhos?: NotaEmpenhoItem[];

  // Termo de Recebimento Provisório (TRP)
  trpElaborado?: boolean;
  trpAprovado?: boolean;
  trpNumeroDocumento?: string;
  trpSei?: string;
  trpData?: string;
  trpObservacao?: string;

  // Termo de Recebimento Definitivo (TRD) & Glosas
  trdElaborado?: boolean;
  trdAprovado?: boolean;
  trdNumeroDocumento?: string;
  trdSei?: string;
  trdData?: string;
  trdGlosa?: number; // Aplicado sobre o valor da OS
  trdObservacao?: string;

  // Descentralização Orçamentária (MPO/SOF para MGI)
  descentralizacaoSei?: string;
  descentralizacaoValor?: number;
  descentralizacaoDescricao?: string;
  descentralizacoes?: DescentralizacaoItem[];

  // Processo SEI específico de Pagamento
  processoSeiPagamento?: string;
}

export interface Contrato {
  id: string;
  Num_Contrato: string;
  Objeto: string;
  SEI_Processo: string;
  Vigencia_Inicio: string;
  Vigencia_Inicial_Meses: number;
  Tempo_Possivel_Prorrogacao_Meses: number;
  Numero_Renovacoes: number;
  Valor_Contrato: number;
  Valor_Atualizado: number;
  Gestor_Contrato: string;
  Gestor_Substituto: string;
  Fiscal_Administrativo: string;
  Fiscal_Administrativo_Substituto: string;
  Fiscal_Tecnico: string;
  Fiscal_Tecnico_Substituto: string;
  Fiscal_Requisitante: string;
  Fiscal_Requisitante_Substituto: string;
  Preposto: string;
  EmailPreposto: string;
  Portaria_Fiscalizacao_Numero: string;
  Portaria_Fiscalizacao_SEI: string;
  LinkContrato?: string; // custom upload
  LinkContratoNome?: string; // nome do arquivo do anexo
  Status_Contrato?: StatusContrato;
  Data_Orcamento_Estimado: string;
  Fornecedor: string; // ID Fornecedor
  Periodicidade_Pagamento: PeriodicidadePagamento;
  Data_Ultima_Atualizacao: string;
  DFD_Vinculado?: string; // ID of DFD
  Valor_Anual_SOF: number; // computed or explicit
  Vigencia_Final?: Date;
  Modalidade_Contratacao?: 'Pregão SOF' | 'Pregão Colaboragov' | 'Contratação Direta por Dispensa' | 'Contratação Direta por Inexigibilidade' | 'Adesão à SRP';
  Perspectiva_Renovacao?: boolean;
  Indice_Reajuste?: string;
  Mes_Reajuste?: string;
  Acao_Orcamentaria?: string;
  Plano_Orcamentario?: string;
  GND?: '3 - Custeio' | '4 - Investimento';
  updatedAt: string;
  
  // TRP/TRD cadastros
  trpElaborado?: boolean;
  trpAprovado?: boolean;
  trpObservacao?: string;
  trdElaborado?: boolean;
  trdAprovado?: boolean;
  trdObservacao?: string;

  // Ordens de Serviço
  ordensServico?: OrdemServico[];
}

export interface ItemContratoSOF {
  id: string;
  Num_Contrato: string; // ID of Contrato
  Numero_Item: string;
  Grupo_Lote: string;
  Descricao_Item: string;
  Unidade_Medida: string;
  Quantidade: number;
  Valor_Unitario: number;
  Status_Item: 'Ativo' | 'Cancelado' | 'Totalmente Entregue';
  Natureza_Despesa?: 'Custeio' | 'Investimento';
  Natureza_Objeto?: 'Bem' | 'Serviço';
  GND?: '3 - Custeio' | '4 - Investimento';
}

export interface ItemPlanejamentoSOF {
  id: string;
  Processo_SEI: string; // links to Planejamento.SEI_Processo
  Numero_Item: string;
  Grupo_Lote: string;
  Descricao_Item: string;
  Unidade_Medida: string;
  Quantidade: number;
  Valor_Unitario: number;
  Status_Item: 'Ativo' | 'Cancelado';
  Natureza_Despesa?: 'Custeio' | 'Investimento';
  Natureza_Objeto?: 'Bem' | 'Serviço';
  GND?: '3 - Custeio' | '4 - Investimento';
}

export type TipoAditivo = 'Prorrogação' | 'Acréscimo' | 'Supressão' | 'Reequilíbrio Econômico_Financeiro' | 'Alteração de Garantia' | 'Sub-rogação';

export interface TermoAditivo {
  id: string;
  Data_Aditivo: string;
  Tipo_Aditivo: TipoAditivo;
  Porcentagem_Aditivo: number;
  Valor_Aditivado: number;
  Meses_Renovacoes: number;
  Documento_SEI: string;
  Observacoes: string;
  Num_Contrato: string; // ID of Contrato
  Processo_SEI: string;
  Tipo_Operacao: string;
  Valor_Final_Apos_Ajuste: number;
}

export interface HistoricoContratual {
  id: string;
  Data: string;
  ContratoRelacionado: string; // ID of Contrato
  Descricao: string;
  Numero_SEI: string;
  Coordenacao: string;
}

export type TipoApostilamento = 'Reajuste' | 'Sub-rogação';

export interface TermoApostilamento {
  id: string;
  Data_Apostilamento: string;
  Tipo_Apostilamento: TipoApostilamento;
  Porcentagem_Reajuste: number;
  Valor_do_Ajuste: number;
  Observacoes: string;
  Documento_SEI: string;
  Num_Contrato: string; // ID of Contrato
  Processo_SEI: string;
  Tipo_Operacao: string;
  Valor_Final_Apos_Ajuste: number;
}

export interface BaseDeConhecimento {
  id: string;
  Dispositivo_Legal: string;
  Descricao: string;
  Acesso: string; // URL
  Categoria: 'Interno' | 'Geral';
}

export interface FAQItem {
  id: string;
  Pergunta: string;
  Resposta: string;
}

export type StatusPagamento = 'Empenhado' | 'Liquidado' | 'Pago';

export interface Pagamento {
  id: string;
  Num_Contrato: string; // ID of Contrato
  Descricao: string;
  Data: string;
  Valor: number;
  Status: StatusPagamento;
  Documento_SEI: string;
  Observacoes?: string;
  Ano_Orcamento?: number;
  idOSVinculada?: string; // ID of OS related
  processoSeiPagamento?: string; // Processo SEI of individual payment
}

export interface ProcessTemplate {
  tipo: string; // e.g. "Pregão SOF", "Contratação Direta - Inexigibilidade", "Contratação Direta - Dispensa", "Pregão do ColaboraGov"
  tasks: Array<{ tarefa: string; prazo_dias: number; subtasks?: string[] }>;
}

export interface PresencialGECTI {
  id: string;
  userId: string;
  userName: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  diasUteisSeguidos: number; // total count of consecutive business days
}

export interface SIOPData8861 {
  id: string;
  dotacaoInicial: number;
  dotacaoAtual: number;
  empenhado: number;
  liquidado: number;
  pago: number;
  updatedAt: string;
  manualUpdatedAt?: string;
  // Segregação Custeio (GND 3)
  dotacaoInicialCusteio?: number;
  dotacaoAtualCusteio?: number;
  empenhadoCusteio?: number;
  liquidadoCusteio?: number;
  pagoCusteio?: number;
  // Segregação Investimento (GND 4)
  dotacaoInicialInvestimento?: number;
  dotacaoAtualInvestimento?: number;
  empenhadoInvestimento?: number;
  liquidadoInvestimento?: number;
  pagoInvestimento?: number;
}

export interface SIOPHistory8861 {
  id: string;
  dotacaoInicial: number;
  dotacaoAtual: number;
  empenhado: number;
  liquidado: number;
  pago: number;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
  // Segregação Custeio (GND 3)
  dotacaoInicialCusteio?: number;
  dotacaoAtualCusteio?: number;
  empenhadoCusteio?: number;
  liquidadoCusteio?: number;
  pagoCusteio?: number;
  // Segregação Investimento (GND 4)
  dotacaoInicialInvestimento?: number;
  dotacaoAtualInvestimento?: number;
  empenhadoInvestimento?: number;
  liquidadoInvestimento?: number;
  pagoInvestimento?: number;
}

export interface LoginLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: 'GECTI' | 'Fiscal' | 'Auditor' | 'Visualizador';
  timestamp: string;
  status: string;
  ipSimulated?: string;
  userAgent?: string;
}
