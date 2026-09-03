/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  User, 
  Fornecedor, 
  DFD, 
  Planejamento, 
  Contrato, 
  ItemContratoSOF, 
  ItemPlanejamentoSOF,
  TarefaPlanejamento, 
  HistoricoPlanejamento, 
  HistoricoContratual, 
  TermoAditivo, 
  TermoApostilamento, 
  Pagamento, 
  BaseDeConhecimento, 
  FAQItem, 
  ProcessTemplate,
  LoginLog
} from './types';

// Default templates for Process Kanban tasks
export const DEFAULT_PROCESS_TEMPLATES: ProcessTemplate[] = [
  {
    tipo: "Pregão SOF",
    tasks: [
      { 
        tarefa: "Elaborar DFD (Documento de Formalização da Demanda)", 
        prazo_dias: 15,
        subtasks: [
          "Identificar a necessidade e objeto da contratação",
          "Descrever o objeto simplificado e justificativa",
          "Estimar quantidade necessária e valor preliminar",
          "Vincular ao Planejamento do PCA correspondente"
        ]
      },
      { 
        tarefa: "Elaborar ETP (Estudo Técnico Preliminar)", 
        prazo_dias: 30,
        subtasks: [
          "Definir e Especificar Necessidades de Negócio e Tecnológicas",
          "Identificar soluções de mercado e realizar análise comparativa",
          "Realizar análise comparativa de custos (TCO e memória de cálculo)",
          "Estimar o custo total da contratação por soluções tecnicamente viáveis",
          "Declarar Viabilidade da Contratação com devida justificativa",
          "Aprovar e Assinar ETP (Integrantes Requisitante e Técnico)",
          "Aprovar e Assinar ETP (Autoridade Máxima da Área de TIC)"
        ]
      },
      { 
        tarefa: "Mapeamento de Riscos", 
        prazo_dias: 10,
        subtasks: [
          "Identificar ou atualizar principais riscos (Atividades e Processos)",
          "Definir Probabilidade e Impacto do Risco",
          "Calcular Nível do Risco (probabilidade x impacto)",
          "Registrar Ações de Tratamento dos Riscos (apetite a riscos)",
          "Assinar Mapa de Gerenciamento de Riscos e juntar ao processo"
        ]
      },
      { 
        tarefa: "Elaborar Termo de Referência (TR)", 
        prazo_dias: 20,
        subtasks: [
          "Definir Objeto de contratação e identificar códigos CATMAT/CATSER",
          "Descrever a Solução de TIC e Requisitos",
          "Justificar a Contratação da Solução",
          "Definir Responsabilidades (Contratada, Contratante e Órgão Gerenciador)",
          "Elaborar Modelo de Execução e Gestão do Contrato",
          "Elaborar Estimativa de Preços (de acordo com a IN SEGES/ME nº 65/2022)",
          "Elaborar Adequação Orçamentária e Cronograma Físico-Financeiro",
          "Definir Regime de Execução e Critérios Técnicos de Seleção",
          "Avaliar Viabilidade de Parcelamento da Solução (itens separados)",
          "Avaliar Viabilidade de Permitir Consórcio ou Subcontratação",
          "Avaliar Necessidade de Separar Licitações e de Audiência Pública",
          "Aprovar e Assinar TR (Equipe de Planejamento da Contratação)",
          "Aprovar e Assinar TR (Autoridade Máxima de TIC)",
          "Aprovar Termo de Referência (Autoridade Competente)",
          "Solicitação de Aprovação à SGD/MGI se global > R$ 20.000.000,00"
        ]
      },
      { tarefa: "Pesquisa de Preços de Mercado", prazo_dias: 15, subtasks: ["Coletar orçamentos de fornecedores", "Buscar preços no Painel de Preços governamental", "Elaborar mapa comparativo de preços", "Ajustar valores estimados"] },
      { tarefa: "Aprovação pela Autoridade Competente", prazo_dias: 5, subtasks: ["Submeter TR e ETP para anuência", "Obter assinatura da autoridade administrativa"] },
      { tarefa: "Análise Jurídica - Parecer CONJUR", prazo_dias: 25, subtasks: ["Autuar processo para a Procuradoria", "Análise de conformidade legal de editais", "Emissão do parecer jurídico formal"] },
      { tarefa: "Saneamento de Pendências Jurídicas", prazo_dias: 10, subtasks: ["Revisar e Ajustar Artefatos se houver recomendações", "Atender apontamentos do parecer jurídico"] },
      { tarefa: "Publicação do Edital do Pregão", prazo_dias: 8, subtasks: ["Publicar Instrumento Convocatório no Diário Oficial e PNCP", "Disponibilizar edital no portal de compras governamentais"] },
      { 
        tarefa: "Sessão Pública e Julgamento das Propostas", 
        prazo_dias: 12,
        subtasks: [
          "Apoiar nas Respostas aos Questionamentos ou às Impugnações",
          "Realizar Sessão Pública do certame",
          "Apoiar na Análise e Julgamento das Propostas comerciais",
          "Realizar Habilidade e Declarar Vencedor oficial",
          "Apoiar na Análise e Julgamento dos Recursos se houver",
          "Examinar e Decidir Recursos das licitantes",
          "Adjudicar e Homologar o objeto",
          "Assinar Contrato (Autoridade e Contratada)",
          "Nomear Gestor do Contrato e fiscais",
          "Publicar Contrato em sítio eletrônico (até 30 dias após assinatura)"
        ]
      },
      { tarefa: "Adjudicação e Homologação", prazo_dias: 7, subtasks: ["Ato de adjucação formal", "Homologação do resultado da licitação pela autoridade"] },
    ]
  },
  {
    tipo: "Contratação Direta - Inexigibilidade",
    tasks: [
      { tarefa: "Solicitação e Justificativa da Inexigibilidade", prazo_dias: 10, subtasks: ["Documentar a inviabilidade de competição", "Justificar a escolha do fornecedor exclusivo"] },
      { tarefa: "Elaborar Documento de Oficialização da Demanda", prazo_dias: 8, subtasks: ["Preencher DDF simplificado", "Definir requisitos mínimos da contratação"] },
      { tarefa: "Comprovação de Exclusividade do Fornecedor", prazo_dias: 20, subtasks: ["Obter atestado de exclusividade válido", "Validar legitimidade do emissor do atestado"] },
      { tarefa: "Justificativa de Preço (Orçamentos anteriores)", prazo_dias: 15, subtasks: ["Analisar contratações similares anteriores", "Demonstrar compatibilidade de preços praticados"] },
      { tarefa: "Análise Jurídica da CONJUR", prazo_dias: 15, subtasks: ["Consultar conformidade legal da contratação direta", "Aguardar parecer definitivo"] },
      { tarefa: "Ratificação pela Autoridade", prazo_dias: 4, subtasks: ["Ratificar dispensa/inexigibilidade pela autoridade máxima"] },
      { tarefa: "Publicação no PNCP", prazo_dias: 5, subtasks: ["Inserir dados da inexigibilidade no PNCP", "Publicar extrato na imprensa oficial"] },
      { tarefa: "Assinatura do Contrato", prazo_dias: 10, subtasks: ["Emitir portaria fiscalização", "Assinar termo de contrato ou instrumento equivalente"] }
    ]
  },
  {
    tipo: "Contratação Direta - Dispensa",
    tasks: [
      { tarefa: "Formalização do DFD", prazo_dias: 7, subtasks: ["Registrar necessidade no sistema de demandas", "Justificar enquadramento no limite legal"] },
      { tarefa: "Elaborar Termo de Referência Simplificado", prazo_dias: 10, subtasks: ["Definir requisitos e cronograma físico-financeiro"] },
      { tarefa: "Cotações Eletrônicas via Portal de Compras", prazo_dias: 5, subtasks: ["Registrar dispensa eletrônica de compras", "Abrir prazo para lances/cotações"] },
      { tarefa: "Seleção da Proposta Mais Vantajosa", prazo_dias: 5, subtasks: ["Julgar menor preço oferecido", "Validar documentos de regularidade fiscal"] },
      { tarefa: "Parecer Técnico e Autorização", prazo_dias: 6, subtasks: ["Emitir manifestação de aprovação da proposta", "Autorizar despesa"] },
      { tarefa: "Publicação no PNCP e Empenho", prazo_dias: 3, subtasks: ["Emitir nota de empenho", "Publicar contratação no PNCP"] }
    ]
  },
  {
    tipo: "Pregão do ColaboraGov",
    tasks: [
      { tarefa: "Adesão ou Manifestação de Interesse no ColaboraGov", prazo_dias: 12, subtasks: ["Selecionar intenção de registro de preço em andamento", "Peticionar adesão junto ao órgão gerenciador"] },
      { tarefa: "Alinhamento com a Líder do Grupo de Contratação", prazo_dias: 10, subtasks: ["Alinhar cronograma conjunto com o grupo da IRP"] },
      { tarefa: "Consolidação das Quantidades Internas da SOF", prazo_dias: 14, subtasks: ["Verificar estoque de licenças e demandas vigentes", "Estimar volumetria anual"] },
      { tarefa: "Análise do ETP e TR Compartilhado", prazo_dias: 15, subtasks: ["Avaliar viabilidade jurídica e técnica dos artefatos compartilhados"] },
      { tarefa: "Aprovação Jurídica do Órgão Gestor", prazo_dias: 10, subtasks: ["Submeter adesão para validação legal própria"] },
      { tarefa: "Empenho das Cotas Destinadas", prazo_dias: 8, subtasks: ["Empenhar fração orçamentária respectiva na UASG"] }
    ]
  }
];

export const INITIAL_USERS: User[] = [
  {
    id: "user-1",
    name: "Artur Câncio",
    email: "artur.cancio@planejamento.gov.br",
    role: "GECTI",
    passwordSimulated: "sof123",
    needsPasswordReset: false
  },
  {
    id: "user-1b",
    name: "Artur Câncio (Gmail)",
    email: "arturcancio@gmail.com",
    role: "GECTI",
    passwordSimulated: "sof123",
    needsPasswordReset: false
  }
];

export const INITIAL_FORNECEDORES: Fornecedor[] = [
  {
    id: "forn-its",
    Nome_Fornecedor: "ITS – The IT Solution Center (ITS Soluções)",
    CNPJ: "12.720.847/0001-20",
    EmailContato: "comercial@its.com.br",
    TelefoneContato: "",
    Situacao: "Ativo"
  }
];

export const INITIAL_DFDS: DFD[] = [
  {
    id: "dfd-centreon",
    Num_DFD: "DFD 125/2025",
    Ano_PCA: "2026",
    Descricao_Objeto: "Contratação de ferramenta de monitoramento de infraestrutura de TI (ITIM) — Centreon Business Edition",
    Valor_Estimado: 343900,
    Status_DFD: "Iniciado",
    UASG: "201130 (MPO/SOF)",
    Planejamento_Vinculado: "10080.000833/2025-48",
    Data_conclusao_estimada: "2026-09-30T18:00:00Z",
    Periodicidade_Pagamento: "Anual",
    Valor_Anual_Proporcional: 171950,
    Contabilizar_Orcamento: true,
    updatedAt: "2026-08-13T12:29:00-03:00"
  },
  {
    id: "dfd-workstations",
    Num_DFD: "DFD 68/2026",
    Ano_PCA: "2026",
    Descricao_Objeto: "Aquisição de estações de trabalho de alto desempenho para produção audiovisual — SOF/MPO (Item PCA 201007-54/2026)",
    Valor_Estimado: 80000,
    Status_DFD: "Iniciado",
    UASG: "201130 (MPO/SOF)",
    Planejamento_Vinculado: "10080.001061/2026-42",
    Data_conclusao_estimada: "2026-05-31T18:00:00Z",
    Periodicidade_Pagamento: "Total",
    Valor_Anual_Proporcional: 80000,
    Contabilizar_Orcamento: true,
    updatedAt: "2026-08-14T10:00:00-03:00"
  }
];

export const INITIAL_PLANEJAMENTOS: Planejamento[] = [
  {
    id: "plan-5",
    DFD_PNCP: "DFD 125/2025",
    Data_Inicio_Processo_SEI: "2025-09-17T15:57:00-03:00",
    Objeto: "Contratação de ferramenta de monitoramento de infraestrutura de TI (ITIM) — Centreon Business Edition",
    SEI_Processo: "10080.000833/2025-48",
    Portaria_Equipe_PC_Numero: "Portaria MPO-SE-SAGE-CGLCD-COSCO/MPO nº 353",
    Portaria_Equipe_PC_SEI: "63608534",
    Int_Requisitante: "Monade Rassa Souza Costa",
    Int_Requisitante_Subst: "Nelson Sattler da Fonseca",
    Int_Tecnico: "Jorge da Silva Leal",
    Int_Tecnico_Subst: "Artur Bruno da Silva Câncio",
    Int_Administrativo: "Andrine Gonçalves Soares",
    Int_Administrativo_Subst: "Flávia Oliveira Serpa Gonçalves",
    Estimativa_Custo: 343900,
    Status_Planejamento: "Em Elaboração",
    Data_Sessao_Publica: "",
    Link_Sessao: "",
    PCA: "MPO",
    Ano_PCA_Vinculado: "2026",
    Tipo_Processo: "Contratação Direta - Inexigibilidade",
    Natureza_Objeto: "Serviço",
    GND: "3 - Custeio",
    updatedAt: "2026-08-13T12:29:00-03:00"
  },
  {
    id: "plan-6",
    DFD_PNCP: "DFD 68/2026",
    Data_Inicio_Processo_SEI: "2026-07-02T16:01:00-03:00",
    Objeto: "Contratação de estações de trabalho de alto desempenho para produção audiovisual — SOF/MPO",
    SEI_Processo: "10080.001061/2026-42",
    Portaria_Equipe_PC_Numero: "Portaria 362",
    Portaria_Equipe_PC_SEI: "63683443",
    Int_Requisitante: "Monade Rassa Souza Costa",
    Int_Requisitante_Subst: "Nelson Sattler da Fonseca",
    Int_Tecnico: "Jorge da Silva Leal",
    Int_Tecnico_Subst: "Thiago Fernandes Neves",
    Int_Administrativo: "Maria Eduarda Kanzler Caselli",
    Int_Administrativo_Subst: "Flávia Oliveira Serpa Gonçalves",
    Estimativa_Custo: 80000,
    Status_Planejamento: "Em Elaboração",
    Data_Sessao_Publica: "",
    Link_Sessao: "",
    PCA: "MPO",
    Ano_PCA_Vinculado: "2026",
    Tipo_Processo: "Pregão Eletrônico",
    Natureza_Objeto: "Bem",
    GND: "4 - Investimento",
    updatedAt: "2026-08-14T10:00:00-03:00"
  }
];

export const INITIAL_CONTRATOS: Contrato[] = [];

export const INITIAL_ITENS_CONTRATO_SOF: ItemContratoSOF[] = [];

export const INITIAL_ITENS_PLANEJAMENTO_SOF: ItemPlanejamentoSOF[] = [
  {
    id: "plan-item-centreon-1",
    Processo_SEI: "10080.000833/2025-48",
    Numero_Item: "01",
    Grupo_Lote: "Lote Único",
    Descricao_Item: "Subscrição e Suporte Oficial Centreon Business Edition (24 meses)",
    Unidade_Medida: "Subscrição / 24 Meses",
    Quantidade: 1,
    Valor_Unitario: 322400,
    Status_Item: "Ativo"
  },
  {
    id: "plan-item-centreon-2",
    Processo_SEI: "10080.000833/2025-48",
    Numero_Item: "02",
    Grupo_Lote: "Lote Único",
    Descricao_Item: "Serviço Especializado de Implementação e Parametrização ITIM",
    Unidade_Medida: "Serviço",
    Quantidade: 1,
    Valor_Unitario: 21500,
    Status_Item: "Ativo"
  },
  {
    id: "plan-item-ws-1",
    Processo_SEI: "10080.001061/2026-42",
    Numero_Item: "01",
    Grupo_Lote: "Lote 1",
    Descricao_Item: "Estação de trabalho de alto desempenho (COINF - Administração de ambientes, virtualização e infraestrutura)",
    Unidade_Medida: "Unidade",
    Quantidade: 1,
    Valor_Unitario: 40000,
    Status_Item: "Ativo"
  },
  {
    id: "plan-item-ws-2",
    Processo_SEI: "10080.001061/2026-42",
    Numero_Item: "02",
    Grupo_Lote: "Lote 1",
    Descricao_Item: "Estação de trabalho de alto desempenho (SEGOR - Edição e Produção Audiovisual com Adobe Premiere)",
    Unidade_Medida: "Unidade",
    Quantidade: 1,
    Valor_Unitario: 40000,
    Status_Item: "Ativo"
  }
];

export const INITIAL_TAREFAS_PLANEJAMENTO: TarefaPlanejamento[] = [];

export const INITIAL_HISTORICO_PLANEJAMENTO: HistoricoPlanejamento[] = [
  {
    id: "histp-centreon-1",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2025-09-17T15:57:00-03:00",
    Descricao: "Abertura do processo para registro dos atos das fases de planejamento da contratação e seleção do fornecedor, com vistas à futura aquisição de ferramenta de monitoramento de infraestrutura de TI (autodescoberta de ativos, monitoramento de disponibilidade e desempenho, alertas em tempo real, dashboards e relatórios históricos), nos termos do art. 8º da IN SGD/ME nº 94/2022.",
    Num_SEI: "Termo de Abertura (51582583)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-2",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2025-09-16T11:34:00-03:00",
    Descricao: "Pesquisa de preços simplificada (art. 8º, IV, do Decreto nº 10.947/2022) para estimativa preliminar do valor da contratação no PCA, com preço mediano de R$ 24.600,00/mês e valor total de referência de R$ 590.400,00 para 24 meses. Relatório emitido no Compras.gov.br.",
    Num_SEI: "Pesquisa de Preço Simplificada nº 4/2025 – Monitoramento TI (52979931)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-3",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2025-09-18T11:11:00-03:00",
    Descricao: "Elaboração do DFD 125/2025 no ComprasNet, com justificativa da necessidade, quantitativo (24 meses de licenciamento), estimativa preliminar de R$ 576.000,00, grau de urgência médio e alinhamento ao PDTIC (revisão nº 03101.001610/2025-47). Encaminhamento ao Setor de Contratações para consolidação do DFD no PCA 2026 e à autoridade competente da área administrativa para indicação do Integrante Administrativo e instituição da Equipe de Planejamento da Contratação (art. 10 da IN SGD/ME nº 94/2022).",
    Num_SEI: "DFD 125/2025 (53929729) / Despacho (53930556)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-4",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2025-09-29T12:08:00-03:00",
    Descricao: "Indicação e ciência dos integrantes administrativos da Equipe de Planejamento da Contratação: Andrine Gonçalves Soares (titular) e Hilquias Rosa de Oliveira (substituto), ambos da COSCO.",
    Num_SEI: "Formulário de EPC (54264731)",
    Coordenacao: "COSCO/CGLCD/SAGE/SE/MPO"
  },
  {
    id: "histp-centreon-5",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2025-09-29T16:23:00-03:00",
    Descricao: "Designação da EPC pela Subsecretária de Administração e Gestão Estratégica: integrantes requisitantes (Monade Rassa Souza Costa / Nelson Sattler da Fonseca), técnicos (Jorge da Silva Leal / Artur Bruno da Silva Câncio) e administrativos (Andrine Gonçalves Soares / Hilquias Rosa de Oliveira), com vigência até a celebração do contrato ou emissão da nota de empenho.",
    Num_SEI: "Portaria MPO-SE-SAGE-CGLCD-COSCO/MPO nº 351 (54272934)",
    Coordenacao: "COSCO/CGLCD/SAGE/SE/MPO"
  },
  {
    id: "histp-centreon-6",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2025-09-30T10:24:00-03:00",
    Descricao: "Em resposta ao Despacho 53930556, a COSCO informa a edição da Portaria 351 e restitui o processo à COINF para providências posteriores.",
    Num_SEI: "Despacho (54291610)",
    Coordenacao: "COSCO/CGLCD/SAGE/SE/MPO"
  },
  {
    id: "histp-centreon-7",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-03-11T17:03:00-03:00",
    Descricao: "Solicitação de cotação à ITS Soluções (identificada como única representante do Centreon no Brasil) para 1 licença/subscrição Centreon Business Edition com capacidade para 1 poller, 500 hosts e 5.000 serviços/métricas, mais serviço de implementação, com vigência de 2 anos. No mesmo pedido solicitou-se documento comprobatório de exclusividade (atestado, contrato ou declaração do fabricante), registrando a intenção de contratação por inexigibilidade. A cadeia de e-mails registra as tratativas até 10/04/2026.",
    Num_SEI: "E-mail Comercial (60742509)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-8",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-03-20T09:55:00-03:00",
    Descricao: "Juntada do Certificate of Authorized Partnership emitido pela Centreon Software Systems France SAS, atestando que a ITS – The IT Solution Center é parceira oficial autorizada e a única parceira Centreon estabelecida e em operação no Brasil, documento que fundamenta a inviabilidade de competição prevista no art. 74, I, da Lei nº 14.133/2021.",
    Num_SEI: "Carta de Exclusividade (60743431)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-9",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-03-25T10:00:00-03:00",
    Descricao: "Recebimento da proposta da ITS Soluções (CNPJ 12.720.847/0001-20): licença Centreon Business Edition para até 500 hosts a R$ 161.200,00/ano, totalizando R$ 322.400,00 para 24 meses, acrescida de R$ 21.500,00 de serviço de implantação — total de R$ 343.900,00. Validade da proposta até 17/04/2026.",
    Num_SEI: "Proposta Comercial Centreon (60742645)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-10",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-05-15T14:00:00-03:00",
    Descricao: "Juntada da planilha de comparação de preços entre soluções de monitoramento de infraestrutura de TI, utilizada como memória de cálculo da análise de vantajosidade consolidada na Nota Técnica 297.",
    Num_SEI: "Planilha Comparativa – ITIM (60909529)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-11",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-07-07T15:18:00-03:00",
    Descricao: "Consolidação da pesquisa de preços da contratação direta por inexigibilidade, com fundamento no art. 23 da Lei nº 14.133/2021 e nos arts. 5º e 7º da IN SEGES/ME nº 65/2021. Documenta a exclusividade comercial do fornecedor, a metodologia adotada, o tratamento motivado do valor discrepante (outlier) e a análise de Custo Total de Propriedade em 10 anos, certificando que o valor estimado de R$ 343.900,00 é compatível com os preços de mercado.",
    Num_SEI: "Nota Técnica SEI nº 297/2026/MPO (58813652)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-12",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-06-26T16:30:00-03:00",
    Descricao: "Elaboração do ETP com descrição da necessidade, alinhamento ao PEI/Mapa Estratégico 2024-2027, levantamento e comparação de alternativas de mercado, dimensionamento da demanda (crescimento projetado de 323 para cerca de 422 hosts) e análise de TCO, concluindo pela solução Centreon Business Edition. Aprovado pelos integrantes técnicos e requisitantes e pela autoridade competente (Felipe Cesar Araujo da Silva).",
    Num_SEI: "ETP nº 17/2026 – ITIM (62022770)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF (EPC)"
  },
  {
    id: "histp-centreon-13",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-07-07T15:20:00-03:00",
    Descricao: "Elaboração do TR (contratação nº 58/2026) para contratação de solução de monitoramento de infraestrutura de TI, compreendendo licenciamento, suporte técnico oficial e serviços de implementação, com vigência de 24 meses prorrogável na forma dos arts. 106 e 107 da Lei nº 14.133/2021. Itens: subscrição + suporte (24 meses, R$ 322.400,00) e implementação (R$ 21.500,00), totalizando R$ 343.900,00. Status \"ASSINADO\" na versão 0.6.",
    Num_SEI: "TR nº 4/2026 – Compras (62259529)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF (EPC)"
  },
  {
    id: "histp-centreon-14",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-06-18T16:03:00-03:00",
    Descricao: "Identificação e tratamento de 6 riscos da fase de planejamento (R-01 a R-06), com destaque para os riscos de nível extremo: perda do prazo de contratação previsto no PCA, questionamento da justificativa de inexigibilidade pela Conjur e questionamento da vantajosidade econômica do preço estimado. Registra ações preventivas e de contingência e respectivos responsáveis. Status: concluído (planejamento).",
    Num_SEI: "Mapa de Riscos nº 6/2026 (62665422)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF (EPC)"
  },
  {
    id: "histp-centreon-15",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-07-07T18:30:00-03:00",
    Descricao: "Encaminhamento à COFAC para emissão da Certificação de Disponibilidade Orçamentária na Ação 8861, no valor de R$ 343.900,00 (R$ 182.700,00 em 2026 — ND 3.3.90.40.06 e 3.3.90.36.57 — e R$ 161.200,00 em 2027). Solicita também, após a análise de regularidade, o encaminhamento dos artefatos (NT 297, e-mail de proposta, carta de exclusividade, planilha comparativa, ETP, TR e Mapa de Riscos) para assinatura pelo Subsecretário de Tecnologia e Desenvolvimento Institucional, autoridade máxima da área de TIC, e a restituição dos autos à unidade.",
    Num_SEI: "Despacho à COFAC (62665522)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-16",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-07-15T14:00:00-03:00",
    Descricao: "Documentos gerados na COFAC ainda não assinados e com acesso restrito (não constam do PDF do processo). A certificação de disponibilidade orçamentária permanecia pendente na data do despacho seguinte.",
    Num_SEI: "Despacho / CDO (62955320 / 62955352)",
    Coordenacao: "COFAC/SETEC/SOF"
  },
  {
    id: "histp-centreon-17",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-08-11T10:14:00-03:00",
    Descricao: "Encaminhamento dos autos à CGLCD para análise antecipada dos artefatos (ETP, TR e NT 297), com vistas a dar celeridade ao processo, registrando que a instrução ainda não está integralmente concluída em razão da pendência da CDO. Informa que, após a certificação, a COINF adotará as providências remanescentes, incluindo a solicitação de renovação da proposta comercial (validade expirada) e a coleta das assinaturas do ETP e do TR.",
    Num_SEI: "Despacho à CGLCD (63445647)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-18",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-08-12T08:47:00-03:00",
    Descricao: "A CGLCD encaminha o processo à COSCO para conhecimento e providências relativas à contratação direta, em conformidade com os artefatos constantes dos autos.",
    Num_SEI: "Despacho (63562265)",
    Coordenacao: "CGLCD/SAGE/SE/MPO"
  },
  {
    id: "histp-centreon-19",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-08-13T09:55:00-03:00",
    Descricao: "Ciência da designação de Flávia Oliveira Serpa Gonçalves como integrante administrativa substituta da Equipe de Planejamento da Contratação, em substituição a Hilquias Rosa de Oliveira.",
    Num_SEI: "Formulário de EPC (atualização) (63606097)",
    Coordenacao: "COSCO/CGLCD/SAGE/SE/MPO"
  },
  {
    id: "histp-centreon-20",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-08-13T12:29:00-03:00",
    Descricao: "Nova portaria de designação da EPC, com a substituição do integrante administrativo substituto, revogando expressamente a Portaria nº 351 (54272934). Publicada no Boletim de Serviço Eletrônico de 13/08/2026.",
    Num_SEI: "Portaria MPO nº 353 (63608534)",
    Coordenacao: "COSCO/CGLCD/SAGE/SE/MPO"
  },
  {
    id: "histp-workstations-1",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-02T16:01:00-03:00",
    Descricao: "Abertura do processo para tratar da futura aquisição de estações de trabalho de alto desempenho para a Secretaria de Orçamento Federal (SOF). É registrado o e-mail de demanda encaminhado por Beatriz Leão Yamada, Coordenadora de Apoio ao Gabinete/SOF, em 07/07/2026, solicitando a aquisição de 4 (quatro) computadores de alto desempenho para a equipe de comunicação da SOF. A justificativa aponta a necessidade de equipamentos compatíveis com o uso de softwares profissionais de edição audiovisual e gráfica (Adobe Premiere Pro, Photoshop, Illustrator, InDesign e After Effects), recomendando-se processador multicore, sistema operacional de 64 bits, 32 GB ou mais de memória RAM, placa gráfica com aceleração por GPU (preferencialmente dedicada) e armazenamento em SSD de alta velocidade, com base nos requisitos técnicos divulgados pela Adobe.",
    Num_SEI: "E-mail Demanda Desktops - Comunicação SOF (62919828)",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-workstations-2",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-16T11:59:00-03:00",
    Descricao: "Registrado o Relatório de Pesquisa de Preço nº 19/2025 (Compras.gov.br), elaborado por Jorge da Silva Leal, referente a \"Estações de trabalho de alto desempenho com acelerador de IA\", nos termos do inciso IV do art. 8º do Decreto nº 10.947/2022. Foram cotados 8 preços de referência (CREA-RS, TJ-RO, Prefeitura de Nova Fátima/PR e Portal Nacional de Contratações Públicas - PNCP), resultando em preço mediano de R$ 27.880,00 por unidade e valor total estimado de R$ 55.760,00 para 2 unidades. A pesquisa destina-se a subsidiar o Plano de Contratações Anual (PCA 2026), conforme a Orientação nº 35, que disciplina o procedimento simplificado para estimativa preliminar do valor da contratação.",
    Num_SEI: "Pesquisa Simplificada - Desktops Produção Audiovisual (62921120)",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-workstations-3",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-16T12:17:00-03:00",
    Descricao: "Registrado o Documento de Formalização da Demanda (DFD) nº 68/2026, elaborado por Jorge da Silva Leal, tendo como responsável Monade Rassa Souza Costa, Coordenador da COINF/SOF. O objeto consiste na aquisição de 2 (duas) estações de trabalho de alto desempenho: uma destinada à Coordenação de Infraestrutura de Tecnologia da Informação (COINF), para atividades de administração de ambientes, virtualização, análise de desempenho e suporte a soluções corporativas; e outra destinada à Assessoria de Comunicação da Subsecretaria de Gestão Orçamentária (SEGOR), para edição e produção audiovisual com uso do Adobe Premiere. O valor unitário estimado é de R$ 40.000,00, totalizando R$ 80.000,00, com conclusão da contratação prevista para 31/05/2026. O documento classifica a demanda como contratação correlata, nos termos do art. 3º, inciso III, da IN SEGES/ME nº 58/2022, por guardar relação com futuras iniciativas de ampliação de capacidade de processamento de IA e com a contratação de outras estações de trabalho em 2027 (DFD nº 93/2026). É assinado por Felipe Cesar Araujo da Silva (autoridade competente) e Monade Rassa Souza Costa (Coordenador da COINF).",
    Num_SEI: "Documento de Formalização de Demanda 68 de 2026 (62921847)",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-workstations-4",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-22T14:48:00-03:00",
    Descricao: "Em obediência à IN SGD/ME nº 94/2022, é indicada a Equipe de Planejamento da Contratação (EPC), composta por: integrante requisitante — Monade Rassa Souza Costa (titular) e Nelson Sattler da Fonseca (substituto); e integrante técnico — Jorge da Silva Leal (titular) e Thiago Fernandes Neves (substituto), todos lotados na Coordenação de Infraestrutura de Tecnologia da Informação (COINF/CGTEC/SETEC/SOF/MPO). O documento foi assinado eletronicamente por Thiago Fernandes Neves, Jorge da Silva Leal, Nelson Sattler da Fonseca e Monade Rassa Souza Costa, que declararam ciência da designação e das competências correspondentes.",
    Num_SEI: "Formulário Indicação EPC (62974762)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF/MPO"
  },
  {
    id: "histp-workstations-5",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-22T14:49:00-03:00",
    Descricao: "Despacho assinado por Monade Rassa Souza Costa, Coordenador da COINF, encaminhando o processo à Coordenação de Serviços e Contratações (COSCO), relativo à futura contratação de estações de trabalho para produção audiovisual, conforme o e-mail de demanda (62919828) e o DFD 68/2026 (62921847). Em conformidade com o art. 10, inciso III, da IN SGD/ME nº 94/2022, solicita-se à autoridade competente da área administrativa a publicação do ato de instituição da Equipe de Planejamento da Contratação, indicando o Formulário de EPC (62922081) — documento posteriormente corrigido pelo Despacho Retificativo (Registro 7).",
    Num_SEI: "Despacho (62974763)",
    Coordenacao: "MPO-SOF-COINF → MPO-SE-SAGE-CGLCD-COSCO"
  },
  {
    id: "histp-workstations-6",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-23T09:17:00-03:00",
    Descricao: "Em obediência ao art. 21, inciso III, da IN nº 5/2017, é designado o integrante administrativo da Equipe de Planejamento da Contratação para a contratação das 2 (duas) estações de trabalho de que trata o DFD 68/2026: Maria Eduarda Kanzler Caselli (titular) e Flávia Oliveira Serpa Gonçalves (substituta), ambas lotadas na COSCO/CGLCD/SAGE/SE/MPO. As integrantes declaram ciência prévia da designação e das competências previstas na legislação.",
    Num_SEI: "Formulário de Equipe de Planejamento da Contratação (63070258)",
    Coordenacao: "MPO-SE-SAGE-CGLCD-COSCO"
  },
  {
    id: "histp-workstations-7",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-22T17:21:00-03:00",
    Descricao: "Despacho de Jorge da Silva Leal retificando o Despacho 62974763 (Registro 5): onde se lia \"Formulário de EPC (62922081)\", leia-se \"Formulário Indicação EPC (62974762)\", corrigindo a referência ao documento correto de indicação da EPC.",
    Num_SEI: "Despacho Retificativo (63071705)",
    Coordenacao: "MPO-SOF-COINF → MPO-SE-SAGE-CGLCD-COSCO"
  },
  {
    id: "histp-workstations-8",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-23T09:47:00-03:00",
    Descricao: "Registrada consulta ao módulo de Formação do PCA no sistema Compras.gov.br, confirmando a contratação \"Estações de trabalho de alto desempenho\" (item 201007-54/2026) aprovada no PCA 2026, com valor de R$ 80.000,00, vinculada ao DFD 68/2026, com início previsto em 08/05/2026, conclusão em 29/05/2026 e situação \"Preparação\".",
    Num_SEI: "Consulta PCA (63080229)",
    Coordenacao: "MPO-SE-SAGE-CGLCD-COSCO"
  },
  {
    id: "histp-workstations-9",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-23T15:26:00-03:00",
    Descricao: "Despacho assinado por Alisson Rafael Rodrigues Alves, Coordenador de Serviços e Contratações, informando tratar-se de demanda de contratação de 2 (duas) estações de trabalho de alto desempenho, no valor estimado de R$ 80.000,00, conforme o DFD 68/2026 (62921847) e o Formulário Indicação EPC (62974762). Com base no Termo de Compartilhamento de Serviços MGI nº 13/2024, no âmbito do ColaboraGov, instituído pelo Decreto nº 11.837/2023, sugere-se o encaminhamento da demanda para instrução da fase de planejamento e para a condução da fase de seleção (publicação e condução do pregão eletrônico) pela Diretoria de Contratações e Unidades Descentralizadas (DCD/SSC/MGI).",
    Num_SEI: "Despacho 63091164",
    Coordenacao: "MPO-SE-SAGE-CGLCD-COSCO → MGI-DCD-CGLIC"
  },
  {
    id: "histp-workstations-10",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-24T14:51:00-03:00",
    Descricao: "Despacho assinado por Mateus Gomes dos Santos, Coordenador-Geral de Planejamento e Monitoramento de Contratações, encaminhando os autos à Coordenação de Gestão de Demandas de Contratações (CODEM) para verificação de existência de demanda similar em andamento ou, se for o caso, indicação de Ponto Focal, com vistas ao apoio à instrução processual da contratação das 2 (duas) estações de trabalho, no valor de R$ 80.000,00.",
    Num_SEI: "Despacho à CODEM (63113773)",
    Coordenacao: "MGI-DCD-CGPLAN → MGI-DCD-CGPLAN-CODEM"
  },
  {
    id: "histp-workstations-11",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-28T17:07:00-03:00",
    Descricao: "Despacho assinado por Mariana Almeida Machado, Coordenadora de Gestão de Demandas de Contratações, informando que, em consulta à base de Documentos de Formalização de Demanda (DFDs) do ColaboraGov referente ao exercício de 2026, foi identificada demanda congênere registrada pela Secretaria de Gestão e Inovação (SEGES), por meio do DFD nº 371/2025, que prevê a aquisição de 250 unidades de notebook de alto desempenho com docking station. Com fundamento no Decreto nº 11.837/2023, que estabelece o formato de atendimento compartilhado de demandas, os autos são encaminhados à DTI para manifestação sobre: (a) se a presente contratação será tratada como compartilhada ou exclusiva; e (b) em caso de compartilhamento, se há interesse em consulta de demanda junto aos demais órgãos do ColaboraGov.",
    Num_SEI: "Despacho (63160467)",
    Coordenacao: "MGI-DCD-CGPLAN-CODEM → MGI-DTI"
  },
  {
    id: "histp-workstations-12",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-08-12T10:16:00-03:00",
    Descricao: "Despacho assinado por Maurício Lima Ferreira, Coordenador Substituto da CPCTI/DTI/SSC/MGI, em resposta ao Despacho 63160467, informando que: (i) as demandas em questão são de competência da Diretoria de Tecnologia da Informação (DTI); (ii) os itens do DFD 68/2026 (62921847) não possuem processo de contratação formalizado ou em andamento na Coordenação de Planejamento de Contratações de Tecnologia da Informação (CPCTI); e (iii) a demanda possui caráter compartilhado. A CPCTI permanece à disposição para dar início a novo planejamento de contratação, condicionado à definição prévia das prioridades das contratações a serem realizadas no exercício de 2026.",
    Num_SEI: "Despacho (63556768)",
    Coordenacao: "MGI-DTI-CPCTI → MGI-DCD-CGPLAN-CODEM"
  },
  {
    id: "histp-workstations-13",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-08-12T16:11:00-03:00",
    Descricao: "Despacho assinado por Mariana Almeida Machado, Coordenadora de Gestão de Demandas de Contratações, registrando que, embora a DTI tenha informado o caráter compartilhado da demanda (Despacho 63556768), não há previsão para o início do planejamento compartilhado, tampouco data compatível com a necessidade de atendimento tempestivo indicada no DFD 68/2026. Diante disso, e com base no Decreto nº 12.904/2026 (estrutura regimental do MGI) e no Decreto nº 11.837/2023 (ColaboraGov), decide-se pelo prosseguimento da contratação pelo rito aplicável às Contratações Exclusivas, ficando a cargo do órgão demandante (MPO) as decisões quanto à designação da EPC, autorização de prosseguimento da licitação, homologação do resultado e assinatura do contrato. É designado como ponto focal o servidor Guilherme Souto da Cunha Araújo, para auxiliar na elaboração dos artefatos de contratação. A decisão não afasta a possibilidade de futura avaliação quanto à conveniência de contratação compartilhada.",
    Num_SEI: "Despacho (63588706)",
    Coordenacao: "MGI-DCD-CGPLAN-CODEM → MPO-SOF-COINF"
  },
  {
    id: "histp-workstations-14",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-08-12T17:59:00-03:00",
    Descricao: "Despacho assinado por Jorge da Silva Leal, Analista de Planejamento e Orçamento, encaminhando os autos à Coordenação de Serviços e Contratações (COSCO) para ciência do Despacho 63588706 — que definiu o prosseguimento da contratação pelo rito das Contratações Exclusivas — e para as providências necessárias à designação da Equipe de Planejamento da Contratação (EPC), conforme o Formulário Indicação EPC (62974762) e o Formulário de Equipe de Planejamento da Contratação (63070258). Solicita-se o retorno dos autos a essa unidade após a designação da EPC, para continuidade da instrução e prosseguimento da contratação. O processo foi recebido na unidade MPO-SE-SAGE-CGLCD-COSCO em 13/08/2026, às 09:24, encontrando-se nessa unidade para as providências solicitadas.",
    Num_SEI: "Despacho (63595086)",
    Coordenacao: "MPO-SOF-COINF → MPO-SE-SAGE-CGLCD-COSCO"
  },
  {
    id: "histp-workstations-15",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-08-14T10:00:00-03:00",
    Descricao: "Consta na árvore do processo o documento \"Portaria 362\" (SEI nº 63683443), o mais recente incluído nos autos. Trata-se, presumivelmente, do ato formal de designação/instituição da Equipe de Planejamento da Contratação (EPC), em atendimento ao solicitado no Despacho 63595086 (Registro 14) e ao rito de instituição de EPC previsto no art. 10, III, da IN SGD/ME nº 94/2022. O conteúdo integral deste documento não estava disponível para leitura no material fornecido, razão pela qual esta descrição deve ser confirmada diretamente no processo SEI.",
    Num_SEI: "Portaria 362 (63683443)",
    Coordenacao: "MPO-SE-SAGE-CGLCD-COSCO"
  }
];

export const INITIAL_HISTORICO_CONTRATUAL: HistoricoContratual[] = [];

export const INITIAL_ADITIVOS: TermoAditivo[] = [];

export const INITIAL_APOSTILAMENTOS: TermoApostilamento[] = [];

export const INITIAL_PAGAMENTOS: Pagamento[] = [];

export const INITIAL_BASE_CONHECIMENTO: BaseDeConhecimento[] = [
  {
    id: "base-1",
    Dispositivo_Legal: "Lei Nº 14.133, de 1º de Abril de 2021",
    Descricao: "Nova Lei de Licitações e Contratos Administrativos. Altera regras de vigência contratual e contratação direta para serviços contínuos de TIC.",
    Acesso: "http://www.planalto.gov.br/ccivil_03/_ato2021-2024/2021/lei/l14133.htm",
    Categoria: "Geral"
  },
  {
    id: "base-2",
    Dispositivo_Legal: "Instrução Normativa SGD/ME Nº 94, de 23 de Dezembro de 2022",
    Descricao: "Dispõe sobre o processo de contratação de soluções de Tecnologia da Informação e Comunicação (TIC) pelos órgãos e entidades integrantes do SISP.",
    Acesso: "https://www.gov.br/governodigital/pt-br/contratacoes-de-tic/legislacao/processo-de-contratacao-de-solucoes-de-tic-regido-pela-lei-ndeg-14-133-de-2021",
    Categoria: "Geral"
  },
  {
    id: "base-3",
    Dispositivo_Legal: "Portaria SGD/MGI Nº 5.950, de 26 de Outubro de 2023 - Modelo Nuvem",
    Descricao: "Estabelece o Modelo de Contratação e Gestão de Software e Serviços de Computação em Nuvem no âmbito dos órgãos do SISP.",
    Acesso: "https://www.gov.br/governodigital/pt-br/contratacoes-de-tic/legislacao/modelo-de-contratacao-de-software-e-servicos-em-nuvem/vigentes/modelo-de-contratacao-de-software-e-nuvem/portaria-sgd-mgi-no-5-950-de-26-de-outubro-de-2023",
    Categoria: "Geral"
  },
  {
    id: "base-4",
    Dispositivo_Legal: "Portaria SGD/MGI Nº 2.715, de 21 de Junho de 2023 - Modelo Estações de Trabalho",
    Descricao: "Institui o Modelo de Contratação e Gestão de Estações de Trabalho (PCaaS, Virtualização de Desktop e Aquisição de Hardware) no SISP.",
    Acesso: "https://www.gov.br/governodigital/pt-br/contratacoes-de-tic/legislacao/modelo-de-contratacao-e-gestao-de-estacoes-de-trabalho/vigente/portaria-sgd-mgi-no-2-715-de-21-de-junho-de-2023",
    Categoria: "Geral"
  },
  {
    id: "base-5",
    Dispositivo_Legal: "Portaria SGD/MGI Nº 1.070, de 1º de Junho de 2023 - Operação de Infraestrutura & Service Desk",
    Descricao: "Estabelece o Modelo de Contratação de Serviços de Operação de Infraestrutura e Atendimento a Usuários de TIC (Sustentação e Service Desk).",
    Acesso: "https://www.gov.br/governodigital/pt-br/contratacoes-de-tic/legislacao/modelo-de-contracao-de-servicos-de-operacao-de-infraestrutura-e-de-atendimento-a-usuarios-de-tic/copy_of_portaria-sgd-mgi-no-1-070-de-1o-de-junho-de-2023",
    Categoria: "Geral"
  },
  {
    id: "base-6",
    Dispositivo_Legal: "Portaria SGD/MGI Nº 750, de 20 de Março de 2023 - Fábrica de Software",
    Descricao: "Estabelece o Modelo de Contratação de Serviços de Desenvolvimento, Sustentação e Manutenção de Software no SISP.",
    Acesso: "https://www.gov.br/governodigital/pt-br/contratacoes-de-tic/legislacao/modelo-de-contratacao-de-servicos-de-desenvolvimento-manutencao-e-sustentacao-de-software/portaria-sgd-mgi-no-750-de-20-de-marco-de-2023",
    Categoria: "Geral"
  },
  {
    id: "base-7",
    Dispositivo_Legal: "Instrução Normativa SEGES/MGI Nº 58, de 21 de Agosto de 2023 - ETP",
    Descricao: "Dispõe sobre a elaboração dos Estudos Técnicos Preliminares (ETP) para a aquisição de bens e contratação de serviços e obras.",
    Acesso: "https://www.in.gov.br/en/web/dou/-/instrucao-normativa-seges/mgi-n-58-de-21-de-agosto-de-2023-504381802",
    Categoria: "Geral"
  },
  {
    id: "base-8",
    Dispositivo_Legal: "Decreto Nº 10.947, de 25 de Janeiro de 2022",
    Descricao: "Dispõe sobre o plano de contratações anual (PCA) e a formalização do documento de formalização da demanda (DFD) no âmbito federal.",
    Acesso: "http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/d10947.htm",
    Categoria: "Geral"
  },
  {
    id: "base-9",
    Dispositivo_Legal: "Portaria de Governança Interna SOF Nº 15/2023",
    Descricao: "Define limites e fluxos de alçada interna da Secretaria de Orçamento Federal para dispensa de licitação e adesão a atas de registro de preços de TIC.",
    Acesso: "https://www.gov.br/sof/pt-br/portaria-15-2023-interna",
    Categoria: "Interno"
  }
];

export const INITIAL_FAQS: FAQItem[] = [
  {
    id: "faq-1",
    Pergunta: "Quem pode ser designado fiscal técnico de um contrato de TIC na SOF?",
    Resposta: "Conforme a IN 94/2022, o fiscal técnico deve pertencer à equipe de TIC (geralmente GECTI) e possuir capacitação compatível com o objeto do contrato."
  },
  {
    id: "faq-2",
    Pergunta: "Qual é o limite máximo de vigência de um contrato de serviços contínuos de TIC segundo a Lei 14.133?",
    Resposta: "Nos termos do artigo 107 da Lei 14.133/2021, os contratos de serviços contínuos podem ser sucessivamente prorrogados por até 10 (dez) anos."
  },
  {
    id: "faq-3",
    Pergunta: "Como proceder em caso de atraso na entrega de lctps ou licenças?",
    Resposta: "O fiscal do contrato deve oficiar o preposto solicitando esclarecimentos em até 5 dias úteis e registrar a ocorrência no histórico de gestão do painel para subsidiar possíveis advertências ou sanções administrativas."
  },
  {
    id: "faq-4",
    Pergunta: "O que é o ColaboraGov?",
    Resposta: "É uma iniciativa para compartilhamento de licitações e contratações de TIC comuns da Esplanada, coordenada pelo MGI, que otimiza preços e reduz o trabalho de elaboração individual de editais."
  }
];

export const IMPORTED_SHAREPOINT_PLANEJAMENTO_HISTORY: HistoricoPlanejamento[] = [
  {
    id: "histp-sh-1",
    Processo_SEI: "12804.100169/2023-97",
    Data: "2023-02-23T03:00:00Z",
    Descricao: "Abertura do processo no SEI",
    Num_SEI: "31736435",
    Coordenacao: "MGI-DTI-CPCTI"
  },
  {
    id: "histp-sh-2",
    Processo_SEI: "12804.100169/2023-97",
    Data: "2023-03-22T03:00:00Z",
    Descricao: "Designação da Equipe de Planejamento de Contratação",
    Num_SEI: "32577731",
    Coordenacao: "MGI-DAL-CGLIC-COLIC"
  },
  {
    id: "histp-sh-3",
    Processo_SEI: "12804.100169/2023-97",
    Data: "2023-03-24T03:00:00Z",
    Descricao: "Retificação da Portaria de designação da Equipe de Planejamento da Contratação",
    Num_SEI: "32649052",
    Coordenacao: "MGI-DAL-CGLIC-COLIC"
  },
  {
    id: "histp-centreon-1",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2025-09-17T15:57:00-03:00",
    Descricao: "Abertura do processo para registro dos atos das fases de planejamento da contratação e seleção do fornecedor, com vistas à futura aquisição de ferramenta de monitoramento de infraestrutura de TI (autodescoberta de ativos, monitoramento de disponibilidade e desempenho, alertas em tempo real, dashboards e relatórios históricos), nos termos do art. 8º da IN SGD/ME nº 94/2022.",
    Num_SEI: "Termo de Abertura (51582583)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-2",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2025-09-16T11:34:00-03:00",
    Descricao: "Pesquisa de preços simplificada (art. 8º, IV, do Decreto nº 10.947/2022) para estimativa preliminar do valor da contratação no PCA, com preço mediano de R$ 24.600,00/mês e valor total de referência de R$ 590.400,00 para 24 meses. Relatório emitido no Compras.gov.br.",
    Num_SEI: "Pesquisa de Preço Simplificada nº 4/2025 – Monitoramento TI (52979931)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-3",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2025-09-18T11:11:00-03:00",
    Descricao: "Elaboração do DFD 125/2025 no ComprasNet, com justificativa da necessidade, quantitativo (24 meses de licenciamento), estimativa preliminar de R$ 576.000,00, grau de urgência médio e alinhamento ao PDTIC (revisão nº 03101.001610/2025-47). Encaminhamento ao Setor de Contratações para consolidação do DFD no PCA 2026 e à autoridade competente da área administrativa para indicação do Integrante Administrativo e instituição da Equipe de Planejamento da Contratação (art. 10 da IN SGD/ME nº 94/2022).",
    Num_SEI: "DFD 125/2025 (53929729) / Despacho (53930556)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-4",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2025-09-29T12:08:00-03:00",
    Descricao: "Indicação e ciência dos integrantes administrativos da Equipe de Planejamento da Contratação: Andrine Gonçalves Soares (titular) e Hilquias Rosa de Oliveira (substituto), ambos da COSCO.",
    Num_SEI: "Formulário de EPC (54264731)",
    Coordenacao: "COSCO/CGLCD/SAGE/SE/MPO"
  },
  {
    id: "histp-centreon-5",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2025-09-29T16:23:00-03:00",
    Descricao: "Designação da EPC pela Subsecretária de Administração e Gestão Estratégica: integrantes requisitantes (Monade Rassa Souza Costa / Nelson Sattler da Fonseca), técnicos (Jorge da Silva Leal / Artur Bruno da Silva Câncio) e administrativos (Andrine Gonçalves Soares / Hilquias Rosa de Oliveira), com vigência até a celebração do contrato ou emissão da nota de empenho.",
    Num_SEI: "Portaria MPO-SE-SAGE-CGLCD-COSCO/MPO nº 351 (54272934)",
    Coordenacao: "COSCO/CGLCD/SAGE/SE/MPO"
  },
  {
    id: "histp-centreon-6",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2025-09-30T10:24:00-03:00",
    Descricao: "Em resposta ao Despacho 53930556, a COSCO informa a edição da Portaria 351 e restitui o processo à COINF para providências posteriores.",
    Num_SEI: "Despacho (54291610)",
    Coordenacao: "COSCO/CGLCD/SAGE/SE/MPO"
  },
  {
    id: "histp-centreon-7",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-03-11T17:03:00-03:00",
    Descricao: "Solicitação de cotação à ITS Soluções (identificada como única representante do Centreon no Brasil) para 1 licença/subscrição Centreon Business Edition com capacidade para 1 poller, 500 hosts e 5.000 serviços/métricas, mais serviço de implementação, com vigência de 2 anos. No mesmo pedido solicitou-se documento comprobatório de exclusividade (atestado, contrato ou declaração do fabricante), registrando a intenção de contratação por inexigibilidade. A cadeia de e-mails registra as tratativas até 10/04/2026.",
    Num_SEI: "E-mail Comercial (60742509)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-8",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-03-20T09:55:00-03:00",
    Descricao: "Juntada do Certificate of Authorized Partnership emitido pela Centreon Software Systems France SAS, atestando que a ITS – The IT Solution Center é parceira oficial autorizada e a única parceira Centreon estabelecida e em operação no Brasil, documento que fundamenta a inviabilidade de competição prevista no art. 74, I, da Lei nº 14.133/2021.",
    Num_SEI: "Carta de Exclusividade (60743431)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-9",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-03-25T10:00:00-03:00",
    Descricao: "Recebimento da proposta da ITS Soluções (CNPJ 12.720.847/0001-20): licença Centreon Business Edition para até 500 hosts a R$ 161.200,00/ano, totalizando R$ 322.400,00 para 24 meses, acrescida de R$ 21.500,00 de serviço de implantação — total de R$ 343.900,00. Validade da proposta até 17/04/2026.",
    Num_SEI: "Proposta Comercial Centreon (60742645)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-10",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-05-15T14:00:00-03:00",
    Descricao: "Juntada da planilha de comparação de preços entre soluções de monitoramento de infraestrutura de TI, utilizada como memória de cálculo da análise de vantajosidade consolidada na Nota Técnica 297.",
    Num_SEI: "Planilha Comparativa – ITIM (60909529)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-11",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-07-07T15:18:00-03:00",
    Descricao: "Consolidação da pesquisa de preços da contratação direta por inexigibilidade, com fundamento no art. 23 da Lei nº 14.133/2021 e nos arts. 5º e 7º da IN SEGES/ME nº 65/2021. Documenta a exclusividade comercial do fornecedor, a metodologia adotada, o tratamento motivado do valor discrepante (outlier) e a análise de Custo Total de Propriedade em 10 anos, certificando que o valor estimado de R$ 343.900,00 é compatível com os preços de mercado.",
    Num_SEI: "Nota Técnica SEI nº 297/2026/MPO (58813652)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-12",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-06-26T16:30:00-03:00",
    Descricao: "Elaboração do ETP com descrição da necessidade, alinhamento ao PEI/Mapa Estratégico 2024-2027, levantamento e comparação de alternativas de mercado, dimensionamento da demanda (crescimento projetado de 323 para cerca de 422 hosts) e análise de TCO, concluindo pela solução Centreon Business Edition. Aprovado pelos integrantes técnicos e requisitantes e pela autoridade competente (Felipe Cesar Araujo da Silva).",
    Num_SEI: "ETP nº 17/2026 – ITIM (62022770)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF (EPC)"
  },
  {
    id: "histp-centreon-13",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-07-07T15:20:00-03:00",
    Descricao: "Elaboração do TR (contratação nº 58/2026) para contratação de solução de monitoramento de infraestrutura de TI, compreendendo licenciamento, suporte técnico oficial e serviços de implementação, com vigência de 24 meses prorrogável na forma dos arts. 106 e 107 da Lei nº 14.133/2021. Itens: subscrição + suporte (24 meses, R$ 322.400,00) e implementação (R$ 21.500,00), totalizando R$ 343.900,00. Status \"ASSINADO\" na versão 0.6.",
    Num_SEI: "TR nº 4/2026 – Compras (62259529)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF (EPC)"
  },
  {
    id: "histp-centreon-14",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-06-18T16:03:00-03:00",
    Descricao: "Identificação e tratamento de 6 riscos da fase de planejamento (R-01 a R-06), com destaque para os riscos de nível extremo: perda do prazo de contratação previsto no PCA, questionamento da justificativa de inexigibilidade pela Conjur e questionamento da vantajosidade econômica do preço estimado. Registra ações preventivas e de contingência e respectivos responsáveis. Status: concluído (planejamento).",
    Num_SEI: "Mapa de Riscos nº 6/2026 (62665422)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF (EPC)"
  },
  {
    id: "histp-centreon-15",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-07-07T18:30:00-03:00",
    Descricao: "Encaminhamento à COFAC para emissão da Certificação de Disponibilidade Orçamentária na Ação 8861, no valor de R$ 343.900,00 (R$ 182.700,00 em 2026 — ND 3.3.90.40.06 e 3.3.90.36.57 — e R$ 161.200,00 em 2027). Solicita também, após a análise de regularidade, o encaminhamento dos artefatos (NT 297, e-mail de proposta, carta de exclusividade, planilha comparativa, ETP, TR e Mapa de Riscos) para assinatura pelo Subsecretário de Tecnologia e Desenvolvimento Institucional, autoridade máxima da área de TIC, e a restituição dos autos à unidade.",
    Num_SEI: "Despacho à COFAC (62665522)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-16",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-07-15T14:00:00-03:00",
    Descricao: "Documentos gerados na COFAC ainda não assinados e com acesso restrito (não constam do PDF do processo). A certificação de disponibilidade orçamentária permanecia pendente na data do despacho seguinte.",
    Num_SEI: "Despacho / CDO (62955320 / 62955352)",
    Coordenacao: "COFAC/SETEC/SOF"
  },
  {
    id: "histp-centreon-17",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-08-11T10:14:00-03:00",
    Descricao: "Encaminhamento dos autos à CGLCD para análise antecipada dos artefatos (ETP, TR e NT 297), com vistas a dar celeridade ao processo, registrando que a instrução ainda não está integralmente concluída em razão da pendência da CDO. Informa que, após a certificação, a COINF adotará as providências remanescentes, incluindo a solicitação de renovação da proposta comercial (validade expirada) e a coleta das assinaturas do ETP e do TR.",
    Num_SEI: "Despacho à CGLCD (63445647)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF"
  },
  {
    id: "histp-centreon-18",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-08-12T08:47:00-03:00",
    Descricao: "A CGLCD encaminha o processo à COSCO para conhecimento e providências relativas à contratação direta, em conformidade com os artefatos constantes dos autos.",
    Num_SEI: "Despacho (63562265)",
    Coordenacao: "CGLCD/SAGE/SE/MPO"
  },
  {
    id: "histp-centreon-19",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-08-13T09:55:00-03:00",
    Descricao: "Ciência da designação de Flávia Oliveira Serpa Gonçalves como integrante administrativa substituta da Equipe de Planejamento da Contratação, em substituição a Hilquias Rosa de Oliveira.",
    Num_SEI: "Formulário de EPC (atualização) (63606097)",
    Coordenacao: "COSCO/CGLCD/SAGE/SE/MPO"
  },
  {
    id: "histp-centreon-20",
    Processo_SEI: "10080.000833/2025-48",
    Data: "2026-08-13T12:29:00-03:00",
    Descricao: "Nova portaria de designação da EPC, com a substituição do integrante administrativo substituto, revogando expressamente a Portaria nº 351 (54272934). Publicada no Boletim de Serviço Eletrônico de 13/08/2026.",
    Num_SEI: "Portaria MPO nº 353 (63608534)",
    Coordenacao: "COSCO/CGLCD/SAGE/SE/MPO"
  },
  {
    id: "histp-workstations-1",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-02T16:01:00-03:00",
    Descricao: "Abertura do processo para tratar da futura aquisição de estações de trabalho de alto desempenho para a Secretaria de Orçamento Federal (SOF). É registrado o e-mail de demanda encaminhado por Beatriz Leão Yamada, Coordenadora de Apoio ao Gabinete/SOF, em 07/07/2026, solicitando a aquisição de 4 (quatro) computadores de alto desempenho para a equipe de comunicação da SOF. A justificativa aponta a necessidade de equipamentos compatíveis com o uso de softwares profissionais de edição audiovisual e gráfica (Adobe Premiere Pro, Photoshop, Illustrator, InDesign e After Effects), recomendando-se processador multicore, sistema operacional de 64 bits, 32 GB ou mais de memória RAM, placa gráfica com aceleração por GPU (preferencialmente dedicada) e armazenamento em SSD de alta velocidade, com base nos requisitos técnicos divulgados pela Adobe.",
    Num_SEI: "E-mail Demanda Desktops - Comunicação SOF (62919828)",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-workstations-2",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-16T11:59:00-03:00",
    Descricao: "Registrado o Relatório de Pesquisa de Preço nº 19/2025 (Compras.gov.br), elaborado por Jorge da Silva Leal, referente a \"Estações de trabalho de alto desempenho com acelerador de IA\", nos termos do inciso IV do art. 8º do Decreto nº 10.947/2022. Foram cotados 8 preços de referência (CREA-RS, TJ-RO, Prefeitura de Nova Fátima/PR e Portal Nacional de Contratações Públicas - PNCP), resultando em preço mediano de R$ 27.880,00 por unidade e valor total estimado de R$ 55.760,00 para 2 unidades. A pesquisa destina-se a subsidiar o Plano de Contratações Anual (PCA 2026), conforme a Orientação nº 35, que disciplina o procedimento simplificado para estimativa preliminar do valor da contratação.",
    Num_SEI: "Pesquisa Simplificada - Desktops Produção Audiovisual (62921120)",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-workstations-3",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-16T12:17:00-03:00",
    Descricao: "Registrado o Documento de Formalização da Demanda (DFD) nº 68/2026, elaborado por Jorge da Silva Leal, tendo como responsável Monade Rassa Souza Costa, Coordenador da COINF/SOF. O objeto consiste na aquisição de 2 (duas) estações de trabalho de alto desempenho: uma destinada à Coordenação de Infraestrutura de Tecnologia da Informação (COINF), para atividades de administração de ambientes, virtualização, análise de desempenho e suporte a soluções corporativas; e outra destinada à Assessoria de Comunicação da Subsecretaria de Gestão Orçamentária (SEGOR), para edição e produção audiovisual com uso do Adobe Premiere. O valor unitário estimado é de R$ 40.000,00, totalizando R$ 80.000,00, com conclusão da contratação prevista para 31/05/2026. O documento classifica a demanda como contratação correlata, nos termos do art. 3º, inciso III, da IN SEGES/ME nº 58/2022, por guardar relação com futuras iniciativas de ampliação de capacidade de processamento de IA e com a contratação de outras estações de trabalho em 2027 (DFD nº 93/2026). É assinado por Felipe Cesar Araujo da Silva (autoridade competente) e Monade Rassa Souza Costa (Coordenador da COINF).",
    Num_SEI: "Documento de Formalização de Demanda 68 de 2026 (62921847)",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-workstations-4",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-22T14:48:00-03:00",
    Descricao: "Em obediência à IN SGD/ME nº 94/2022, é indicada a Equipe de Planejamento da Contratação (EPC), composta por: integrante requisitante — Monade Rassa Souza Costa (titular) e Nelson Sattler da Fonseca (substituto); e integrante técnico — Jorge da Silva Leal (titular) e Thiago Fernandes Neves (substituto), todos lotados na Coordenação de Infraestrutura de Tecnologia da Informação (COINF/CGTEC/SETEC/SOF/MPO). O documento foi assinado eletronicamente por Thiago Fernandes Neves, Jorge da Silva Leal, Nelson Sattler da Fonseca e Monade Rassa Souza Costa, que declararam ciência da designação e das competências correspondentes.",
    Num_SEI: "Formulário Indicação EPC (62974762)",
    Coordenacao: "COINF/CGTEC/SETEC/SOF/MPO"
  },
  {
    id: "histp-workstations-5",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-22T14:49:00-03:00",
    Descricao: "Despacho assinado por Monade Rassa Souza Costa, Coordenador da COINF, encaminhando o processo à Coordenação de Serviços e Contratações (COSCO), relativo à futura contratação de estações de trabalho para produção audiovisual, conforme o e-mail de demanda (62919828) e o DFD 68/2026 (62921847). Em conformidade com o art. 10, inciso III, da IN SGD/ME nº 94/2022, solicita-se à autoridade competente da área administrativa a publicação do ato de instituição da Equipe de Planejamento da Contratação, indicando o Formulário de EPC (62922081) — documento posteriormente corrigido pelo Despacho Retificativo (Registro 7).",
    Num_SEI: "Despacho (62974763)",
    Coordenacao: "MPO-SOF-COINF → MPO-SE-SAGE-CGLCD-COSCO"
  },
  {
    id: "histp-workstations-6",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-23T09:17:00-03:00",
    Descricao: "Em obediência ao art. 21, inciso III, da IN nº 5/2017, é designado o integrante administrativo da Equipe de Planejamento da Contratação para a contratação das 2 (duas) estações de trabalho de que trata o DFD 68/2026: Maria Eduarda Kanzler Caselli (titular) e Flávia Oliveira Serpa Gonçalves (substituta), ambas lotadas na COSCO/CGLCD/SAGE/SE/MPO. As integrantes declaram ciência prévia da designação e das competências previstas na legislação.",
    Num_SEI: "Formulário de Equipe de Planejamento da Contratação (63070258)",
    Coordenacao: "MPO-SE-SAGE-CGLCD-COSCO"
  },
  {
    id: "histp-workstations-7",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-22T17:21:00-03:00",
    Descricao: "Despacho de Jorge da Silva Leal retificando o Despacho 62974763 (Registro 5): onde se lia \"Formulário de EPC (62922081)\", leia-se \"Formulário Indicação EPC (62974762)\", corrigindo a referência ao documento correto de indicação da EPC.",
    Num_SEI: "Despacho Retificativo (63071705)",
    Coordenacao: "MPO-SOF-COINF → MPO-SE-SAGE-CGLCD-COSCO"
  },
  {
    id: "histp-workstations-8",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-23T09:47:00-03:00",
    Descricao: "Registrada consulta ao módulo de Formação do PCA no sistema Compras.gov.br, confirmando a contratação \"Estações de trabalho de alto desempenho\" (item 201007-54/2026) aprovada no PCA 2026, com valor de R$ 80.000,00, vinculada ao DFD 68/2026, com início previsto em 08/05/2026, conclusão em 29/05/2026 e situação \"Preparação\".",
    Num_SEI: "Consulta PCA (63080229)",
    Coordenacao: "MPO-SE-SAGE-CGLCD-COSCO"
  },
  {
    id: "histp-workstations-9",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-23T15:26:00-03:00",
    Descricao: "Despacho assinado por Alisson Rafael Rodrigues Alves, Coordenador de Serviços e Contratações, informando tratar-se de demanda de contratação de 2 (duas) estações de trabalho de alto desempenho, no valor estimado de R$ 80.000,00, conforme o DFD 68/2026 (62921847) e o Formulário Indicação EPC (62974762). Com base no Termo de Compartilhamento de Serviços MGI nº 13/2024, no âmbito do ColaboraGov, instituído pelo Decreto nº 11.837/2023, sugere-se o encaminhamento da demanda para instrução da fase de planejamento e para a condução da fase de seleção (publicação e condução do pregão eletrônico) pela Diretoria de Contratações e Unidades Descentralizadas (DCD/SSC/MGI).",
    Num_SEI: "Despacho 63091164",
    Coordenacao: "MPO-SE-SAGE-CGLCD-COSCO → MGI-DCD-CGLIC"
  },
  {
    id: "histp-workstations-10",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-24T14:51:00-03:00",
    Descricao: "Despacho assinado por Mateus Gomes dos Santos, Coordenador-Geral de Planejamento e Monitoramento de Contratações, encaminhando os autos à Coordenação de Gestão de Demandas de Contratações (CODEM) para verificação de existência de demanda similar em andamento ou, se for o caso, indicação de Ponto Focal, com vistas ao apoio à instrução processual da contratação das 2 (duas) estações de trabalho, no valor de R$ 80.000,00.",
    Num_SEI: "Despacho à CODEM (63113773)",
    Coordenacao: "MGI-DCD-CGPLAN → MGI-DCD-CGPLAN-CODEM"
  },
  {
    id: "histp-workstations-11",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-07-28T17:07:00-03:00",
    Descricao: "Despacho assinado por Mariana Almeida Machado, Coordenadora de Gestão de Demandas de Contratações, informando que, em consulta à base de Documentos de Formalização de Demanda (DFDs) do ColaboraGov referente ao exercício de 2026, foi identificada demanda congênere registrada pela Secretaria de Gestão e Inovação (SEGES), por meio do DFD nº 371/2025, que prevê a aquisição de 250 unidades de notebook de alto desempenho com docking station. Com fundamento no Decreto nº 11.837/2023, que estabelece o formato de atendimento compartilhado de demandas, os autos são encaminhados à DTI para manifestação sobre: (a) se a presente contratação será tratada como compartilhada ou exclusiva; e (b) em caso de compartilhamento, se há interesse em consulta de demanda junto aos demais órgãos do ColaboraGov.",
    Num_SEI: "Despacho (63160467)",
    Coordenacao: "MGI-DCD-CGPLAN-CODEM → MGI-DTI"
  },
  {
    id: "histp-workstations-12",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-08-12T10:16:00-03:00",
    Descricao: "Despacho assinado por Maurício Lima Ferreira, Coordenador Substituto da CPCTI/DTI/SSC/MGI, em resposta ao Despacho 63160467, informando que: (i) as demandas em questão são de competência da Diretoria de Tecnologia da Informação (DTI); (ii) os itens do DFD 68/2026 (62921847) não possuem processo de contratação formalizado ou em andamento na Coordenação de Planejamento de Contratações de Tecnologia da Informação (CPCTI); e (iii) a demanda possui caráter compartilhado. A CPCTI permanece à disposição para dar início a novo planejamento de contratação, condicionado à definição prévia das prioridades das contratações a serem realizadas no exercício de 2026.",
    Num_SEI: "Despacho (63556768)",
    Coordenacao: "MGI-DTI-CPCTI → MGI-DCD-CGPLAN-CODEM"
  },
  {
    id: "histp-workstations-13",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-08-12T16:11:00-03:00",
    Descricao: "Despacho assinado por Mariana Almeida Machado, Coordenadora de Gestão de Demandas de Contratações, registrando que, embora a DTI tenha informado o caráter compartilhado da demanda (Despacho 63556768), não há previsão para o início do planejamento compartilhado, tampouco data compatível com a necessidade de atendimento tempestivo indicada no DFD 68/2026. Diante disso, e com base no Decreto nº 12.904/2026 (estrutura regimental do MGI) e no Decreto nº 11.837/2023 (ColaboraGov), decide-se pelo prosseguimento da contratação pelo rito aplicável às Contratações Exclusivas, ficando a cargo do órgão demandante (MPO) as decisões quanto à designação da EPC, autorização de prosseguimento da licitação, homologação do resultado e assinatura do contrato. É designado como ponto focal o servidor Guilherme Souto da Cunha Araújo, para auxiliar na elaboração dos artefatos de contratação. A decisão não afasta a possibilidade de futura avaliação quanto à conveniência de contratação compartilhada.",
    Num_SEI: "Despacho (63588706)",
    Coordenacao: "MGI-DCD-CGPLAN-CODEM → MPO-SOF-COINF"
  },
  {
    id: "histp-workstations-14",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-08-12T17:59:00-03:00",
    Descricao: "Despacho assinado por Jorge da Silva Leal, Analista de Planejamento e Orçamento, encaminhando os autos à Coordenação de Serviços e Contratações (COSCO) para ciência do Despacho 63588706 — que definiu o prosseguimento da contratação pelo rito das Contratações Exclusivas — e para as providências necessárias à designação da Equipe de Planejamento da Contratação (EPC), conforme o Formulário Indicação EPC (62974762) e o Formulário de Equipe de Planejamento da Contratação (63070258). Solicita-se o retorno dos autos a essa unidade após a designação da EPC, para continuidade da instrução e prosseguimento da contratação. O processo foi recebido na unidade MPO-SE-SAGE-CGLCD-COSCO em 13/08/2026, às 09:24, encontrando-se nessa unidade para as providências solicitadas.",
    Num_SEI: "Despacho (63595086)",
    Coordenacao: "MPO-SOF-COINF → MPO-SE-SAGE-CGLCD-COSCO"
  },
  {
    id: "histp-workstations-15",
    Processo_SEI: "10080.001061/2026-42",
    Data: "2026-08-14T10:00:00-03:00",
    Descricao: "Consta na árvore do processo o documento \"Portaria 362\" (SEI nº 63683443), o mais recente incluído nos autos. Trata-se, presumivelmente, do ato formal de designação/instituição da Equipe de Planejamento da Contratação (EPC), em atendimento ao solicitado no Despacho 63595086 (Registro 14) e ao rito de instituição de EPC previsto no art. 10, III, da IN SGD/ME nº 94/2022. O conteúdo integral deste documento não estava disponível para leitura no material fornecido, razão pela qual esta descrição deve ser confirmada diretamente no processo SEI.",
    Num_SEI: "Portaria 362 (63683443)",
    Coordenacao: "MPO-SE-SAGE-CGLCD-COSCO"
  },
  {
    id: "histp-sh-5",
    Processo_SEI: "10080.001331/2025-34",
    Data: "2025-09-16T03:00:00Z",
    Descricao: "Publicação da Portaria 308 - Instituição da Equipe de Planejamento da Contratação (EPC)",
    Num_SEI: "53719543",
    Coordenacao: "MPO-SE-SAGE-CGLCD-COSCO"
  },
  {
    id: "histp-sh-6",
    Processo_SEI: "12804.100169/2023-97",
    Data: "2025-10-28T03:00:00Z",
    Descricao: "Evento de Suspensão com publicação prevista para 28/10/2025. Motivo: Necessidade de ajustes no Termo de Referência e Minuta de Contrato. As licitantes deverão tomar conhecimento dos novos artefatos",
    Num_SEI: "55053901",
    Coordenacao: "MGI-DCD-CGLIC-COACS"
  },
  {
    id: "histp-sh-7",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2024-09-24T03:00:00Z",
    Descricao: "Instituição da Equipe de Planejamento da Contratação",
    Num_SEI: "45210137",
    Coordenacao: "MGI-DCD-CGLIC-COACS"
  },
  {
    id: "histp-sh-8",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-06-13T03:00:00Z",
    Descricao: "Solicitação de inclusão da contratação no PCA 2025",
    Num_SEI: "51495423",
    Coordenacao: "MGI-DTI-CPCTI"
  },
  {
    id: "histp-sh-9",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-07-17T03:00:00Z",
    Descricao: "Despacho de Aprovação do ETP",
    Num_SEI: "51541201",
    Coordenacao: "MGI-DTI-CPCTI"
  },
  {
    id: "histp-sh-10",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-07-16T03:00:00Z",
    Descricao: "Relatório de Pesquisa de Preços",
    Num_SEI: "51541644",
    Coordenacao: "MGI-DTI-CPCTI"
  },
  {
    id: "histp-sh-11",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-07-17T03:00:00Z",
    Descricao: "Despacho de Aprovação do TR",
    Num_SEI: "51541909",
    Coordenacao: "MGI-DTI-CPCTI"
  },
  {
    id: "histp-sh-12",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-07-17T03:00:00Z",
    Descricao: "Despacho de Aprovação do Mapa de Gerenciamento de Riscos",
    Num_SEI: "51541355",
    Coordenacao: "MGI-DTI-CPCTI"
  },
  {
    id: "histp-sh-13",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-07-17T03:00:00Z",
    Descricao: "Termo de Responsabilidade - Alterações no modelo de TR",
    Num_SEI: "52348189",
    Coordenacao: "MGI-DTI-CPCTI"
  },
  {
    id: "histp-sh-14",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-07-17T03:00:00Z",
    Descricao: "Solicitação de CDO à DTI-DIMOR, no valor de R$ 2.590.410,60 ",
    Num_SEI: "52348266",
    Coordenacao: "MGI-DTI-CPCTI"
  },
  {
    id: "histp-sh-15",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-08-15T03:00:00Z",
    Descricao: "Despacho de Aprovação do TR",
    Num_SEI: "52905722",
    Coordenacao: "MGI-DTI-CPCTI"
  },
  {
    id: "histp-sh-16",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-08-20T03:00:00Z",
    Descricao: "Emissão da Certificação de Disponibilidade Orçamentária no valor de R$ 2.590.410,60 ",
    Num_SEI: "53173728",
    Coordenacao: "MGI-DTI-DIMOR"
  },
  {
    id: "histp-sh-17",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-10-28T03:00:00Z",
    Descricao: "Termo de Responsabilidade - Alterações no modelo de TR",
    Num_SEI: "55067302",
    Coordenacao: "MGI-DTI-CPCTI"
  },
  {
    id: "histp-sh-18",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-10-20T03:00:00Z",
    Descricao: "Parecer Jurídico solicitando ajuste no TR em relação aos critérios de julgamento e a forma de apresentação dos preços e orientando que as justificativas sejam consolidadas no documento final",
    Num_SEI: "54899472",
    Coordenacao: "MGI-CONJUR "
  },
  {
    id: "histp-sh-19",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-10-28T03:00:00Z",
    Descricao: "Nota Técnica nº48461 para atendimento ao Parecer Jurídico",
    Num_SEI: "54932683",
    Coordenacao: "MGI-DTI-CPCTI"
  },
  {
    id: "histp-sh-20",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-10-31T03:00:00Z",
    Descricao: "Minuta de Contrato de TIC - Serviços",
    Num_SEI: "54980969",
    Coordenacao: "MGI-DAL-CGCAF-COCAT"
  },
  {
    id: "histp-sh-21",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-10-30T03:00:00Z",
    Descricao: "Solicitação de cadatro da licitação por itens (14 itens), para serem agrupados, facilitando a gestão contratual",
    Num_SEI: "55132930",
    Coordenacao: "MGI-DAL-CGCAF-DICET"
  },
  {
    id: "histp-sh-22",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-10-30T03:00:00Z",
    Descricao: "Despacho à COACS para continuidade da instrução processual",
    Num_SEI: "55141834",
    Coordenacao: "MGI-DCD-CGLIC"
  },
  {
    id: "histp-sh-23",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-11-13T03:00:00Z",
    Descricao: "Despacho da COACS à DTI solicitando manifestação sobre a ausência de fatores locacionais na precificação dos serviços de manutenção de TIC, especialmente para equipamentos fora de Brasília, e a avaliação da necessidade de novo levantamento de mercado ou confirmação da vantajosidade do modelo atual",
    Num_SEI: "55561710",
    Coordenacao: "MGI-DCD-CGLIC-COACS"
  },
  {
    id: "histp-sh-24",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-11-14T03:00:00Z",
    Descricao: "Nota técnica da MGI-DTI-CPCTI à COACS esclarecendo que o risco locacional apontado no despacho foi previsto e tratado no Mapa de Riscos, demonstrando que a pesquisa de preços considerou a realidade de atendimento nacional e reafirmando a vantajosidade do modelo de agrupamento por fabricante. Conclui pela desnecessidade de novo levantamento de mercado e pela manutenção do modelo adotado",
    Num_SEI: "55578341",
    Coordenacao: "MGI-DTI-CPCTI"
  },
  {
    id: "histp-sh-25",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-11-15T03:00:00Z",
    Descricao: "Inclusão do Termo de Referência (versão 1.1) do portal de compras no processo",
    Num_SEI: "55594871",
    Coordenacao: "MGI-DTI-CPCTI"
  },
  {
    id: "histp-sh-26",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-11-15T03:00:00Z",
    Descricao: "Despacho da DTI à COACS encaminhando o processo para prosseguimento da contratação, informando que a Nota Técnica solicitada foi elaborada, o Termo de Referência foi ajustado para atender às demandas da COACS — incluindo a readequação da tabela do item 1.1 conforme limitações do editor do compras.gov — e que todas as dúvidas e ajustes foram sanados",
    Num_SEI: "55594837",
    Coordenacao: "MGI-DTI-CPCTI"
  },
  {
    id: "histp-sh-27",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-11-19T03:00:00Z",
    Descricao: "Despacho à DTI e à CPCTI alertando que o Termo de Referência nº 245/2025 – V1.1 ainda não foi assinado no Compras.gov, etapa indispensável para sua posterior publicação no PNCP, esclarecendo que essa assinatura é distinta da aprovação no SEI e solicitando a adoção das providências necessárias",
    Num_SEI: "55707983",
    Coordenacao: "MGI-DCD-CGLIC-COACS"
  },
  {
    id: "histp-sh-28",
    Processo_SEI: "12804.100169/2023-97",
    Data: "2025-10-28T03:00:00Z",
    Descricao: "Suspensão do Pregão para ajustes no Termo de Referência",
    Num_SEI: "55053901",
    Coordenacao: "MGI-DCD-CGLIC-COACS"
  },
  {
    id: "histp-sh-29",
    Processo_SEI: "12804.100169/2023-97",
    Data: "2025-11-12T03:00:00Z",
    Descricao: "Inclusão de regra de prorrogação automática para serviços de instalação",
    Num_SEI: "",
    Coordenacao: ""
  },
  {
    id: "histp-sh-30",
    Processo_SEI: "12804.100169/2023-97",
    Data: "2025-11-18T03:00:00Z",
    Descricao: "Nova Minuta de Ata de Registro de Preços",
    Num_SEI: "55604888",
    Coordenacao: "MGI-DAL-CGCAF-COCAT"
  },
  {
    id: "histp-sh-31",
    Processo_SEI: "12804.100169/2023-97",
    Data: "2025-11-18T03:00:00Z",
    Descricao: "Nova Minuta de Contrato - Equipamentos",
    Num_SEI: "55609254",
    Coordenacao: "MGI-DAL-CGCAF-COCAT"
  },
  {
    id: "histp-sh-32",
    Processo_SEI: "12804.100169/2023-97",
    Data: "2025-11-18T03:00:00Z",
    Descricao: "Nova Minuta de Contratos - Suporte",
    Num_SEI: "55613064",
    Coordenacao: "MGI-DAL-CGCAF-COCAT"
  },
  {
    id: "histp-sh-33",
    Processo_SEI: "12804.100169/2023-97",
    Data: "2025-11-19T03:00:00Z",
    Descricao: "Despacho de encaminhamento à COACS após as alterações realizadas",
    Num_SEI: "55679588",
    Coordenacao: "MGI-DCD-CGLIC"
  },
  {
    id: "histp-sh-34",
    Processo_SEI: "12804.100169/2023-97",
    Data: "2025-11-19T03:00:00Z",
    Descricao: "Despacho da COACS à DTI solicitando assinatura do Termo de Referência no sistema Compras.Gov",
    Num_SEI: "55705490",
    Coordenacao: "MGI-DCD-CGLIC-COACS"
  },
  {
    id: "histp-sh-35",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2024-10-04T03:00:00Z",
    Descricao: "Termo de Abertura do processo",
    Num_SEI: "45482152",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-36",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2024-10-23T03:00:00Z",
    Descricao: "Documento de Formalização da Demanda",
    Num_SEI: "45705223",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-37",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2024-11-18T03:00:00Z",
    Descricao: "Instituição da Equipe de Planejamento da Contratação",
    Num_SEI: "45962433",
    Coordenacao: "MPO-SE-SAGE-CGLCD-COSCO"
  },
  {
    id: "histp-sh-38",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-06-13T03:00:00Z",
    Descricao: "1ª planilha de Estimativa de Demanda e Preço",
    Num_SEI: "51710567",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-39",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-06-30T03:00:00Z",
    Descricao: "1ª versão do ETP 01/2024",
    Num_SEI: "51850431",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-40",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-06-30T03:00:00Z",
    Descricao: "1ª versão do Mapa de Gerenciamento de Riscos",
    Num_SEI: "51850504",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-41",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-06-30T03:00:00Z",
    Descricao: "1ª versão do Apêndice I - Especificações Técnicas",
    Num_SEI: "51850606",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-42",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-06-30T03:00:00Z",
    Descricao: "1 ª versão do Termo de Referência",
    Num_SEI: "51850634",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-43",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-07-04T03:00:00Z",
    Descricao: "1ª versão do Termo de Responsabilidade sobre alterações ao modelo de TR",
    Num_SEI: "51850678",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-44",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-07-11T03:00:00Z",
    Descricao: "1º Despacho de Aprovação do ETP",
    Num_SEI: "51851183",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-45",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-07-11T03:00:00Z",
    Descricao: "1º Despacho de Aprovação do TR",
    Num_SEI: "51851973",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-46",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-07-01T03:00:00Z",
    Descricao: "Despacho de Solicitação de CDO",
    Num_SEI: "51852250",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-47",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-07-01T03:00:00Z",
    Descricao: "Despacho da COINF-SOF para a DCD/SSC/MGI informando o envio dos artefatos de planejamento da contratação de solução de backup da SOF/MPO e solicitando que a DCD finalize a fase de planejamento (minutas e parecer jurídico) e conduza o pregão eletrônico. Registra que a demanda não está na lista da DTI no ColaboraGov e requer tratamento exclusivo, mantendo que as demais contratações de 2025 seguem com a DTI",
    Num_SEI: "51854176",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-48",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-07-14T03:00:00Z",
    Descricao: "Despacho da MGI-DCD-CGLIC - Coordenação-Geral de Licitações à À Coordenação-Geral de Contratos e Aquisições de Tecnologia da Informação do MGI informando sobre os documentos contidos no processo e solicitando a análise dos autos e da pesquisa de preços, em especial",
    Num_SEI: "52238955",
    Coordenacao: "MGI-DCD-CGLIC"
  },
  {
    id: "histp-sh-49",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-08-01T03:00:00Z",
    Descricao: "Despacho da MGI-DTI-CPCTI à MGI-DCD-CGLIC, informando que a contratação de solução de backup atende demanda da SOF/MPO e que, embora haja encaminhamento para análise de preços, trata-se de processo conduzido pelo próprio MPO, não caracterizando aquisição do MGI nem compra compartilhada. Ressalta que a análise mencionada é competência da equipe de planejamento da contratação. Assim, o processo é devolvido para as providências cabíveis",
    Num_SEI: "52716197",
    Coordenacao: "MGI-DTI-CPCTI"
  },
  {
    id: "histp-sh-50",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-08-21T03:00:00Z",
    Descricao: "Despacho da MGI-DCD-CGLIC-COACS que encaminha o processo à Coordenação Geral de Contratações, Atas e Fiscalização Administrativa para análise e produção da minuta de contrato",
    Num_SEI: "53153108",
    Coordenacao: "MGI-DCD-CGLIC-COACS"
  },
  {
    id: "histp-sh-51",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-08-26T03:00:00Z",
    Descricao: "Minuta de Contrato elaborada pela MGI-DAL-CGCAF-COCAT",
    Num_SEI: "53222613",
    Coordenacao: "MGI-DAL-CGCAF-COCAT"
  },
  {
    id: "histp-sh-52",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-08-25T03:00:00Z",
    Descricao: "Despacho da MGI-DAL-CGCAF-COCAT solicitando à DIPEN e à DICET do MGI a análise da adequação da Minuta de Contrato aos artefatos da contratação e às minutas padrões da AGU e a nálise da adequação das Infrações e Sanções Administrativas considerando o objeto da Contratação e a proporcionalidade e/ou dosimetria prevista no instrumento, respectivamente",
    Num_SEI: "53284108",
    Coordenacao: "MGI-DAL-CGCAF-COCAT"
  },
  {
    id: "histp-sh-53",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-08-25T03:00:00Z",
    Descricao: "Despacho da MGI-DAL-CGCAF-DIPEN à Coordenação de Contratações e Atas, apontando que, ao analisar o item 6.28 do TR e a Cláusula Décima Primeira da minuta contratual, identificou-se possível inconsistência na dosimetria das multas: a infração menos gravosa pode gerar multa de até 25% do valor contratual, enquanto a mais gravosa prevê apenas 5%. Recomenda-se ajustar essa proporcionalidade e encaminha-se o processo para ciência e providências",
    Num_SEI: "53297619",
    Coordenacao: "MGI-DAL-CGCAF-DIPEN"
  },
  {
    id: "histp-sh-54",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-08-26T03:00:00Z",
    Descricao: "Despacho da MGI-DAL-CGCAF-DICET à COCAT manifestando-se pelo prosseguimento do processo, mantendo-se a minuta de contrato nos termos apresentados",
    Num_SEI: "53322464",
    Coordenacao: "MGI-DAL-CGCAF-DICET"
  },
  {
    id: "histp-sh-55",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-08-26T03:00:00Z",
    Descricao: "Despacho da MGI-DAL-CGCAF-COCAT à CGLIC informando que foi elaborada a minuta de contrato com base no modelo da AGU e nas diretrizes do IPP-TIC, encaminhando o processo de volta com apontamentos sobre a cláusula de sanções. Indica inconsistência na dosimetria prevista no item 6.28 do TR e na cláusula contratual correspondente, pois a infração menos gravosa pode gerar multa muito maior que a prevista para a infração mais gravosa. Recomenda ajustar a proporcionalidade e registrar o risco no mapa da contratação",
    Num_SEI: "53334984",
    Coordenacao: "MGI-DAL-CGCAF-COCAT"
  },
  {
    id: "histp-sh-56",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-09-17T03:00:00Z",
    Descricao: "Despacho da MGI-DCD-CGLIC-COACS à SOF solicitando ajustes como retirada de referência a lote, indicação do subitem do ETP que fundamenta a vedação a consórcios, informação sobre aplicação ou não de margem de preferência e enquadramento no item 8.13 da minuta de edital, além de revisão dos percentuais de multa. Requereu também confirmações para futura Lista de Verificação, validação da pesquisa de preços, inclusão da certificação orçamentária e atendimento à recomendação da CGCAF",
    Num_SEI: "53804760",
    Coordenacao: "MGI-DCD-CGLIC-COACS"
  },
  {
    id: "histp-sh-57",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-09-23T03:00:00Z",
    Descricao: "Nova versão da Planilha de Estimativa de Demanda e de Preços",
    Num_SEI: "54161430",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-58",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-09-23T03:00:00Z",
    Descricao: "Nova versão do Relatório de Pesquisa de Preços",
    Num_SEI: "54161538",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-59",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-09-24T03:00:00Z",
    Descricao: "Versão 2 do Apêndice I do TR - Especificações Técnicas",
    Num_SEI: "54161856",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-60",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-09-24T03:00:00Z",
    Descricao: "Nova versão do Termo de Referência",
    Num_SEI: "54161951",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-61",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-10-22T03:00:00Z",
    Descricao: "Novo Despacho de Aprovação do TR",
    Num_SEI: "54162560",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-62",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-10-21T03:00:00Z",
    Descricao: "Despacho de solicitação de CDO à COFAC-SOF",
    Num_SEI: "54162982",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-63",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-10-21T03:00:00Z",
    Descricao: "Nota Técnica da COINF em resposta ao Despacho nº 53804760, apresentando os ajustes necessários para seguir com a contratação da solução de backup: retirada da referência a “lote”, justificativa para orçamento global, fundamentação da vedação a consórcios, esclarecimento de que margens de preferência e o item 8.13 do edital não se aplicam, correção da dosimetria das sanções, atualização da pesquisa de preços e indicação de que a CDO será providenciada, retornando o processo para continuidade",
    Num_SEI: "54164562",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-64",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-10-21T03:00:00Z",
    Descricao: "Despacho da COINF encaminha a documentação atualizada da contratação de backup, ajustada conforme o Despacho 53804760, e direciona a COFAC para emissão da CDO, a CGLCD para análise e aprovação do TR e a COACS/DCD/SSC/MGI para prosseguir com a instrução conforme a Nota Técnica 1352, incluindo atualização da data-base do orçamento e avanço para a fase de seleção",
    Num_SEI: "54259106",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-65",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-10-31T03:00:00Z",
    Descricao: "Despacho da COFAC-SOF à COIF-SOF solicitando esclarecimentos para emissão do CDO da contratação de backup. Pede definição clara sobre a classificação da despesa (perpétuo ou subscrição), verificação de qual modalidade foi considerada na pesquisa de preços e esclarecimento sobre a periodicidade da despesa em razão da execução por ordens de serviço em mais de um exercício",
    Num_SEI: "55185105",
    Coordenacao: "MPO-SOF-COFAC"
  },
  {
    id: "histp-sh-66",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-11-13T03:00:00Z",
    Descricao: "Nova versão do Termo de Referência, retirando as menções à licença perpétua",
    Num_SEI: "55541511",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-67",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-11-13T03:00:00Z",
    Descricao: "Nova versão do Apêndice I do TR, retirando as menções à licença perpétua",
    Num_SEI: "55541675",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-68",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2025-11-21T03:00:00Z",
    Descricao: "Novo Despacho da COINF-SOF à COFAC-SOF informou que a solução provavelmente seria contratada por subscrição, que a pesquisa de preços havia sido baseada nesse modelo e que a execução ocorreria por ordens de serviço concluídas. Também registrou que o TR e o apêndice técnico tinham sido ajustados para ampliar a competitividade e garantir conformidade. Por fim, encaminhou a documentação atualizada à COFAC para continuidade da emissão do CDO",
    Num_SEI: "55573080",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-69",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-11-27T03:00:00Z",
    Descricao: "Nota Técnica de saneamento do processo em atendimento ao Parecer Jurídico, consolidando as justificativas das áreas técnicas – incluindo a defesa do agrupamento por fabricante e a inaplicabilidade da exclusividade para ME/EPP devido ao valor global plurianual – e encaminhando os autos para a autorização de abertura da licitação.",
    Num_SEI: "55343176",
    Coordenacao: "MGI-DCD-CGLIC-COACS"
  },
  {
    id: "histp-sh-70",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-12-01T03:00:00Z",
    Descricao: "Despacho de Designação do Pregoeiro e Equipe de Apoio",
    Num_SEI: "55909523",
    Coordenacao: "MGI-DCD-CGLIC-COACS"
  },
  {
    id: "histp-sh-71",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-12-02T03:00:00Z",
    Descricao: "Publicação do Edital no PNCP",
    Num_SEI: "56001534",
    Coordenacao: "MGI-DCD-CGLIC-COACS"
  },
  {
    id: "histp-sh-72",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-12-02T03:00:00Z",
    Descricao: "Publicação do Edital no DOU",
    Num_SEI: "56001499",
    Coordenacao: "MGI-DCD-CGLIC-COACS"
  },
  {
    id: "histp-sh-73",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-12-09T03:00:00Z",
    Descricao: "Despacho de Alteração do Pregoeiro",
    Num_SEI: "56189806",
    Coordenacao: "MGI-DCD-CGLIC-COACS"
  },
  {
    id: "histp-sh-74",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-12-09T03:00:00Z",
    Descricao: "Pedido de esclarecimento de licitante referente ao Pregão Eletrônico nº 90027/2025, questionando se a atualização de firmware restringe-se aos arquivos públicos do fabricante e solicitando informações sobre o estado de funcionamento dos equipamentos e eventuais falhas pré-existentes",
    Num_SEI: "56202495",
    Coordenacao: "MGI-DCD-CGLIC-COACS"
  },
  {
    id: "histp-sh-75",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-12-09T03:00:00Z",
    Descricao: "Despacho da COACS à DTI solicitando respostas aos esclarecimentos",
    Num_SEI: "56205363",
    Coordenacao: "MGI-DCD-CGLIC-COACS"
  },
  {
    id: "histp-sh-76",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2025-12-09T03:00:00Z",
    Descricao: "Despacho da DTI com as respostas ao pedido de esclarecimento, orientando que as atualizações de firmware devem provir de canais oficiais do fabricante e esclarecendo que não há garantia de inexistência de falhas prévias nos equipamentos, ressaltando a possibilidade de vistoria técnica e a obrigatoriedade do levantamento inicial.",
    Num_SEI: "56207121",
    Coordenacao: "MGI-DTI-CPCTI"
  },
  {
    id: "histp-sh-77",
    Processo_SEI: "12600.000355/2026-66",
    Data: "",
    Descricao: "Pedido de esclarecimento de licitante questionando o estado de funcionamento dos servidores dos Grupos 1 e 2 e solicitando a relação de eventuais falhas ou peças defeituosas pré-existentes",
    Num_SEI: "56276353",
    Coordenacao: "MGI-DCD-CGLIC-COACS"
  },
  {
    id: "histp-sh-78",
    Processo_SEI: "10080.001588/2024-13",
    Data: "2026-02-05T03:00:00Z",
    Descricao: "Novo despacho à COFAC reiterando as informações do despacho anterior e solicitando novamente a emissão da CDO",
    Num_SEI: "57549062",
    Coordenacao: "MPO-SOF-COINF"
  },
  {
    id: "histp-sh-79",
    Processo_SEI: "12804.100169/2023-97",
    Data: "2026-02-06T03:00:00Z",
    Descricao: "Ata de Registro de Preço anexada ao processo",
    Num_SEI: "57626104",
    Coordenacao: "MGI-SSC-DAL"
  },
  {
    id: "histp-sh-80",
    Processo_SEI: "12804.100169/2023-97",
    Data: "2026-02-20T03:00:00Z",
    Descricao: "Realização de Descentralização Orçamentária pelo MGI",
    Num_SEI: "58082357",
    Coordenacao: "MGI-DTI-DIMOR "
  },
  {
    id: "histp-sh-81",
    Processo_SEI: "12804.100169/2023-97",
    Data: "2026-02-23T03:00:00Z",
    Descricao: "Emissão da Nota de Crédito para a emissão de Nota de Empenho de Despesas para assinatura do contrato",
    Num_SEI: "58147939",
    Coordenacao: "MGI-DFC-CGORC-CODEO"
  },
  {
    id: "histp-sh-82",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-01-29T03:00:00Z",
    Descricao: "Ofício à BRINFOR com orientações para assinatura do contrato, apresentação de garantia e cadastro no SEI",
    Num_SEI: "57377551",
    Coordenacao: ""
  },
  {
    id: "histp-sh-83",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-01-29T03:00:00Z",
    Descricao: "Ofício à CELERIT com orientações para assinatura do contrato, apresentação de garantia e cadastro no SEI",
    Num_SEI: "57379057",
    Coordenacao: ""
  },
  {
    id: "histp-sh-84",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-01-29T03:00:00Z",
    Descricao: "Despacho à DTI solicitando detalhamento orçamentário por órgão para emissão de CDO/NE",
    Num_SEI: "57379557",
    Coordenacao: ""
  },
  {
    id: "histp-sh-85",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-01-30T03:00:00Z",
    Descricao: "Despacho da DTI informando centralização dos custos na própria DTI, dispensando detalhamento por órgão",
    Num_SEI: "57428383",
    Coordenacao: ""
  },
  {
    id: "histp-sh-86",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-02-03T03:00:00Z",
    Descricao: "Certificação de Disponibilidade Orçamentária de R$ 1.326.360,00 para o Grupo 1 e o item 14 (5 anos)",
    Num_SEI: "57494417",
    Coordenacao: ""
  },
  {
    id: "histp-sh-87",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-02-03T03:00:00Z",
    Descricao: "Certificação de Disponibilidade Orçamentária de R$ 327.000,00 para o Grupo 2 (5 anos)",
    Num_SEI: "57513790",
    Coordenacao: ""
  },
  {
    id: "histp-sh-88",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-02-05T03:00:00Z",
    Descricao: "Descentralização orçamentária de R$ 243.166,00 para emissão de NE à BRINFOR (Grupo 1 e item 14)",
    Num_SEI: "57532401",
    Coordenacao: ""
  },
  {
    id: "histp-sh-89",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-02-05T03:00:00Z",
    Descricao: "Descentralização orçamentária de R$ 59.950,00 para emissão de NE à CELERIT (Grupo 2)",
    Num_SEI: "57553304",
    Coordenacao: ""
  },
  {
    id: "histp-sh-90",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-02-11T03:00:00Z",
    Descricao: "Emissão da Nota de Empenho 2026NE000500 (estimativa R$ 59.950,00) em favor da CELERIT – Grupo 2",
    Num_SEI: "57791171",
    Coordenacao: "DOFC/CGEOF/CEORC"
  },
  {
    id: "histp-sh-91",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-02-11T03:00:00Z",
    Descricao: "Emissão da Nota de Empenho 2026NE000504 (estimativa R$ 243.166,00) em favor da BRINFOR – Grupo 1 e item 14",
    Num_SEI: "57792376",
    Coordenacao: "DOFC/CGEOF/CEORC"
  },
  {
    id: "histp-sh-92",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-02-19T03:00:00Z",
    Descricao: "Despacho comunicando a emissão das NEs 2026NE000500 (CELERIT) e 2026NE000504 (BRINFOR) e a devida cobertura orçamentária",
    Num_SEI: "57863589",
    Coordenacao: "DOFC/CGEOF/CEORC"
  },
  {
    id: "histp-sh-93",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-02-20T03:00:00Z",
    Descricao: "Despacho informando a abertura de processos específicos para os Termos de Contrato (BRINFOR – G1 e item 14; CELERIT – G2)",
    Num_SEI: "58063801",
    Coordenacao: ""
  },
  {
    id: "histp-sh-94",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-02-20T03:00:00Z",
    Descricao: "Despacho que ratifica a reserva de dotação orçamentária com base nas CDOs e descentralizações e referencia as NEs emitidas",
    Num_SEI: "57863967",
    Coordenacao: ""
  },
  {
    id: "histp-sh-95",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-01-16T03:00:00Z",
    Descricao: "Nota Técnica com análise do julgamento e habilitação do PE 90027/2025 e encaminhamento para adjudicação e homologação",
    Num_SEI: "56907059",
    Coordenacao: "MGI-DCD-CGLIC-COACS"
  },
  {
    id: "histp-sh-96",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-01-26T03:00:00Z",
    Descricao: " Despacho decisório que adjudica e homologa o PE 90027/2025 às empresas BRINFOR (Grupo 1 e item 14) e CELERIT (Grupo 2)",
    Num_SEI: "57038075",
    Coordenacao: "MGI-SSC-DCD"
  },
  {
    id: "histp-sh-97",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-01-29T03:00:00Z",
    Descricao: "E-mail à CELERIT encaminhando o Ofício 10178 e solicitando resposta em 5 dias úteis",
    Num_SEI: "57399346",
    Coordenacao: "MGI-DAL-CGCAF"
  },
  {
    id: "histp-sh-98",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-01-29T03:00:00Z",
    Descricao: "E-mail à BRINFOR encaminhando o Ofício 10148 e solicitando resposta em 5 dias úteis",
    Num_SEI: "57399321",
    Coordenacao: "MGI-DAL-CGCAF"
  },
  {
    id: "histp-sh-99",
    Processo_SEI: "12804.100169/2023-97",
    Data: "2026-03-10T03:00:00Z",
    Descricao: "Assinatura do Contrato e início da vigência",
    Num_SEI: "58669385",
    Coordenacao: "MGI-SSC-DAL"
  },
  {
    id: "histp-sh-100",
    Processo_SEI: "12600.000355/2026-66",
    Data: "2026-03-25T03:00:00Z",
    Descricao: "Assinatura do Contrato 05/2026 e início da sua vigência",
    Num_SEI: "58009030",
    Coordenacao: "MGI-SSC-DAL"
  }
];

export const INITIAL_LOGIN_LOGS: LoginLog[] = [
  {
    id: "log-101",
    userId: "user-1",
    userName: "Artur Câncio",
    userEmail: "arturcancio@gmail.com",
    userRole: "GECTI",
    timestamp: "12/08/2026 15:45:10",
    status: "Sucesso",
    ipSimulated: "189.12.44.102",
    userAgent: "Chrome / Web Browser"
  }
];


