import React, { useState, useEffect, useMemo } from 'react';
import {
  HelpCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  RotateCcw,
  Sparkles,
  BookOpen,
  Compass,
  CheckCircle2,
  Play,
  FileText,
  Briefcase,
  Layers,
  Calculator,
  DollarSign,
  Database,
  ArrowRight,
  Info,
  ShieldCheck,
  CalendarRange,
  Handshake,
  ListTodo
} from 'lucide-react';

export type UserRole = 'GECTI' | 'Fiscal' | 'Auditor' | 'Visualizador';

export const ROLE_LABELS: Record<UserRole, string> = {
  GECTI: 'Administrador GECTI',
  Fiscal: 'Fiscal de Contrato',
  Auditor: 'Auditoria & Compliance',
  Visualizador: 'Visualizador (Modo Consulta)'
};

export interface TourStep {
  targetSelector?: string; // CSS selector or data-tour attribute value (e.g. '[data-tour="btn-icti"]')
  title: string;
  description: string;
  badge?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export interface TourDefinition {
  id: string;
  title: string;
  description: string;
  iconName: string;
  steps: TourStep[];
}

export function getToursConfig(userRole: UserRole | string = 'GECTI'): Record<string, TourDefinition> {
  const role: UserRole = (['GECTI', 'Fiscal', 'Auditor', 'Visualizador'].includes(userRole)
    ? userRole
    : 'GECTI') as UserRole;

  const roleLabel = ROLE_LABELS[role];

  return {
    main: {
      id: 'main',
      title: 'Tour Geral do Sistema CONTRATICS',
      description: `Conheça os principais módulos e recursos do CONTRATICS sob a perspectiva do seu perfil (${roleLabel}).`,
      iconName: 'Compass',
      steps: [
        {
          targetSelector: '[data-tour="brand-logo"]',
          title: 'Boas-vindas ao CONTRATICS (SOF)',
          badge: `Perfil: ${roleLabel}`,
          description: role === 'GECTI'
            ? 'Você está conectado como Administrador GECTI. Possui alçada integral para cadastrar, aprovar e editar DFDs, gerenciar contratos e fornecedores, emitir OSs com múltiplas descentralizações orçamentárias, formalizar aditivos/apostilamentos com índice ICTI, gerenciar usuários e acompanhar o teto da Ação 8861.'
            : role === 'Fiscal'
            ? 'Você está conectado como Fiscal de Contrato. Sua atuação concentra-se na fiscalização técnica/administrativa, emissão de Ordens de Serviço (OS), vinculação de descentralizações com notas de empenho, controle de termos TRP/TRD, atestes de fatura e registros de ocorrências.'
            : role === 'Auditor'
            ? 'Você está conectado com o perfil Auditoria & Compliance. Seu foco é a checagem da conformidade legal (IN SGD/ME), auditoria da rastreabilidade da contratação, fiscalização do confronto de descentralizações orçamentárias (MPO ➔ MGI) e controle de empenhos no SIOP.'
            : 'Você está conectado como Visualizador (Modo Consulta). Navegue de forma segura por todos os módulos, DFDs, contratos, ordens de serviço, limites orçamentários e relatórios em modo de leitura protegida.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="sidebar-nav"]',
          title: 'Menu Lateral de Navegação',
          badge: 'Navegação Adaptativa',
          description: role === 'GECTI'
            ? 'Acesse todos os módulos do ciclo de vida: Dashboard Geral, DFDs (PCA), Orçamento Atual (Ação 8861), Planejamentos SEI, Kanban de Tarefas, Contratos Vigentes, Base de Conhecimento, Presença GECTI e Gestão de Usuários.'
            : role === 'Fiscal'
            ? 'Navegue diretamente pelos Contratos sob sua gestão, Ocorrências da Fiscalização, Ordens de Serviço, DFDs da sua área requisitante e acompanhe o fluxo da equipe no Kanban.'
            : role === 'Auditor'
            ? 'Navegue pela execução do Orçamento Ação 8861 no SIOP, audite os eventos e despachos dos processos no SEI, acompanhe os Contratos, aditivos e a matriz de rastreabilidade.'
            : 'Navegue livremente por todas as telas do sistema em modo de consulta. Os botões de cadastro, edição e exclusão ficam desabilitados para o seu perfil.',
          position: 'right'
        },
        {
          targetSelector: '[data-tour="year-selector"]',
          title: 'Filtro de Exercício Financeiro (Ano)',
          badge: 'Filtro Global',
          description: 'Selecione o ano do exercício (2024 a 2027) no topo do Dashboard. Todos os limites do SIOP, DFDs, valores anualizados dos contratos e demonstrativos de descentralização são recalculados instantaneamente para o exercício escolhido.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="descentralizacao-panel"]',
          title: 'Painel de Descentralização Orçamentária (MPO ➔ MGI)',
          badge: 'Gestão de Repasses',
          description: 'Monitore em tempo real o confronto orçamentário dos contratos do Pregão Colaboragov através das três caixas principais: "Deveria ser Descentralizado" (total demandado nas OSs), "Total Descentralizado" (repasses formalizados ao MGI via SEI) e "Saldo não cobrado" (a diferença preservada no teto orçamentário da SOF, protegendo contra perda de recursos).',
          position: 'top'
        },
        {
          targetSelector: '[data-tour="btn-icti"]',
          title: 'Calculadora do Índice ICTI (Ipeadata)',
          badge: 'Ferramenta Inteligente',
          description: role === 'GECTI' || role === 'Fiscal'
            ? 'Calcule o reajuste anual pelo ICTI com consulta em tempo real à API do Ipeadata. O cálculo fixa a Data-Base original a partir da Data do Orçamento Estimado do contrato, estabelecendo o ciclo estável de reajuste anual e gerando minuta formatada para o SEI.'
            : 'Simule e audite a variação acumulada do índice ICTI (Ipeadata), conferindo a aplicação da Data do Orçamento Estimado e as memórias de cálculo dos apostilamentos.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="header-profile"]',
          title: 'Alternador de Perfis e Permissões',
          badge: 'Segurança & Acesso',
          description: `Seu perfil atual é "${roleLabel}". Alterne o perfil se desejar testar como as permissões de edição, botões de ação e visualizações do sistema se adaptam dinamicamente.`,
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="header-manual"]',
          title: 'Central do Tutorial Guiado & Manuais',
          badge: 'Tutorial Sempre À Mão',
          description: `Precisa rever um passo ou consultar instruções de uma ferramenta específica? Clique neste ícone a qualquer momento para abrir a Central de Tutoriais adaptada ao perfil ${roleLabel}.`,
          position: 'bottom'
        }
      ]
    },
    dfds: {
      id: 'dfds',
      title: 'Ferramenta DFDs (Plano de Contratações Anual)',
      description: `Instruções de gestão e consulta dos Documentos de Formalização da Demanda para o perfil ${roleLabel}.`,
      iconName: 'FileText',
      steps: [
        {
          targetSelector: '[data-tour="dfd-header"]',
          title: 'Gestão de DFDs de TIC (PCA)',
          badge: `PCA & DFDs (${roleLabel})`,
          description: 'O DFD é o documento de formalização inicial que compõe o Plano de Contratações Anual (PCA). Aqui são registradas todas as demandas e necessidades de TIC da SOF para os exercícios futuros.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="dfd-stats"]',
          title: 'Segregação GND 3 (Custeio) vs GND 4 (Investimento)',
          badge: 'Métricas Orçamentárias',
          description: 'Acompanhe em tempo real o montante financeiro total dos DFDs alocados em despesas correntes/custeio (manutenção, licenças) versus investimentos (aquisições de ativos, desenvolvimento de sistemas).',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="dfd-actions"]',
          title: 'Cadastro, Edição e Exportação de DFDs',
          badge: 'Ações do Perfil',
          description: role === 'GECTI'
            ? 'Como Administrador GECTI, você pode cadastrar novos DFDs, analisar/aprovar demandas de outras unidades, vincular a processos SEI e exportar o relatório do PCA.'
            : role === 'Fiscal'
            ? 'Como Fiscal ou requisitante técnico, elabore propostas de DFDs para sua área de atuação. A consolidação e aprovação final no PCA cabe à GECTI.'
            : role === 'Auditor'
            ? 'Exporte relatórios em PDF/Excel e audite a conformidade do PCA com o PDTIC e a correta classificação entre Custeio (GND 3) e Investimento (GND 4).'
            : 'Consulte a listagem completa de DFDs e exporte relatórios. As ações de criação e edição ficam restritas no modo somente leitura.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="dfd-table"]',
          title: 'Status e Vinculação ao Processo SEI',
          badge: 'Fluxo Processual',
          description: role === 'GECTI'
            ? 'Gerencie o ciclo do DFD (Em Elaboração, Aprovado, Vinculado) e realize a conexão direta com o Processo de Planejamento instaurado no SEI.'
            : role === 'Fiscal'
            ? 'Acompanhe o trâmite da sua demanda até a aprovação e vinculação ao respectivo Processo SEI de contratação.'
            : 'Consulte o status do DFD e rastreie a qual Processo SEI a necessidade institucional foi vinculada.',
          position: 'top'
        }
      ]
    },
    planejamentos: {
      id: 'planejamentos',
      title: 'Ferramenta Planejamentos SEI',
      description: `Guia da instrução regulatória de processos de contratação de TIC da SOF para ${roleLabel}.`,
      iconName: 'Layers',
      steps: [
        {
          targetSelector: '[data-tour="plan-header"]',
          title: 'Processos de Planejamento de TIC (SEI)',
          badge: `Planejamentos SEI (${roleLabel})`,
          description: 'Gerencie os processos instaurados no SEI em observância à IN SGD/ME. Acompanhe a Equipe de Planejamento da Contratação (EPC), DFDs de origem, prazos e a fase atual da instrução.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="plan-stages"]',
          title: 'Estágios Regulatórios da IN SGD/ME',
          badge: 'Fases da Instrução',
          description: role === 'GECTI'
            ? 'Monitore e atualize a esteira de instrução: Instauração ➔ ETP (Estudo Técnico Preliminar) ➔ Mapa de Riscos ➔ TR (Termo de Referência) ➔ Parecer Jurídico ➔ Sessão Pública ➔ Contratação Concluída.'
            : role === 'Fiscal'
            ? 'Como membro da EPC, produza os artefatos técnicos (ETP, TR, Pesquisa de Preços) e acompanhe a evolução de cada etapa.'
            : role === 'Auditor'
            ? 'Fiscalize o cumprimento dos ritos da IN SGD/ME, pareceres da CONJUR, prazos de publicidade e a conformidade da instrução processual.'
            : 'Consulte a evolução das fases e o histórico processual dos planejamentos de TIC da SOF em modo somente leitura.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="plan-sof-items"]',
          title: 'Reserva e Vinculação de Itens SOF',
          badge: 'Orçamento SIOP',
          description: role === 'GECTI' || role === 'Fiscal'
            ? 'Vincule os itens orçamentários da Ação 8861 ao planejamento para assegurar a reserva e adequação orçamentária prévia ao lançamento da licitação.'
            : 'Verifique a reserva e conformidade orçamentária dos itens da Ação 8861 vinculados ao processo de contratação.',
          position: 'top'
        }
      ]
    },
    contratos: {
      id: 'contratos',
      title: 'Ferramenta Contratos & Gestão Contratual',
      description: `Painel de gestão, fiscalização e acompanhamento contratual adaptado ao perfil ${roleLabel}.`,
      iconName: 'Handshake',
      steps: [
        {
          targetSelector: '[data-tour="contract-header"]',
          title: 'Contratos Vigentes de TIC',
          badge: `Contratos (${roleLabel})`,
          description: role === 'GECTI'
            ? 'Painel central de contratos da SOF. Cadastre contratos, controle prazos de vigência e prorrogação, designe equipes de fiscalização e gerencie modalidades (Pregão SOF vs Pregão Colaboragov).'
            : role === 'Fiscal'
            ? 'Seu painel principal de fiscalização! Acompanhe vigências, portarias de fiscalização, emissão de Ordens de Serviço, atestes e prazos de reajuste pelo ICTI.'
            : role === 'Auditor'
            ? 'Audite a vigência dos instrumentos, garantias, limites de prorrogação (até 60/120 meses), regularidade fiscal dos fornecedores e nomeação formal das equipes.'
            : 'Consulte a relação completa de contratos de TIC da SOF, fornecedores, vigências, valores globais e modalidades em modo de consulta.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="contract-alterations"]',
          title: 'Aditivos, Apostilamentos & Data-Base do Orçamento',
          badge: 'Alterações Contratuais',
          description: role === 'GECTI'
            ? 'Gerencie Termos Aditivos (prorrogação de vigência e acréscimos até o limite legal de 25%) e Apostilamentos de reajuste anual pelo ICTI calculados a partir da Data do Orçamento Estimado.'
            : role === 'Fiscal'
            ? 'Acompanhe os prazos de renovação e solicite a formalização do reajuste anual pelo ICTI antes do vencimento do ciclo anual.'
            : role === 'Auditor'
            ? 'Cheque se os aditivos respeitam os tetos legais e se os apostilamentos utilizam a variação correta do ICTI sobre a data-base do orçamento original.'
            : 'Consulte o histórico de aditivos de prazo e apostilamentos de reajuste financeiro registrados no contrato.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="contract-icti-btn"]',
          title: 'Cálculo Direto do ICTI Integrado à Ficha',
          badge: 'Reajuste Automatizado',
          description: role === 'GECTI' || role === 'Fiscal'
            ? 'Abra a Calculadora ICTI diretamente da ficha do contrato. A Data do Orçamento Estimado e os valores contratuais são carregados automaticamente para fundamentar o processo de apostilamento.'
            : 'Abra a Calculadora ICTI para simular e conferir os índices do Ipeadata aplicáveis ao contrato.',
          position: 'top'
        }
      ]
    },
    orcamento: {
      id: 'orcamento',
      title: 'Ferramenta Orçamento Atual (Ação 8861)',
      description: `Acompanhamento da dotação, empenhos globais e limites orçamentários para o perfil ${roleLabel}.`,
      iconName: 'DollarSign',
      steps: [
        {
          targetSelector: '[data-tour="orcamento-header"]',
          title: 'Ação Orçamentária 8861 do SIOP',
          badge: `Orçamento SOF (${roleLabel})`,
          description: 'Acompanhe os limites orçamentários oficiais da SOF no SIOP para a Ação 8861 (Sustentação de TIC do Sistema de Planejamento e Orçamento Federal).',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="orcamento-gnd"]',
          title: 'Dotação Inicial, Atualizada e Empenhos Globais',
          badge: 'Execução Orçamentária',
          description: role === 'GECTI'
            ? 'Gerencie o saldo disponível, remanejamentos de dotação e empenhos globais calculados exclusivamente sobre os itens de responsabilidade da SOF por Custeio (GND 3) e Investimento (GND 4).'
            : role === 'Fiscal'
            ? 'Acompanhe a disponibilidade orçamentária e a emissão de Notas de Empenho vinculadas aos itens dos seus contratos.'
            : role === 'Auditor'
            ? 'Audite a execução da Ação 8861, verificando o confronto de Notas de Empenho (NE), Liquidações (NS) e a conformidade dos limites anuais aprovados na LOA.'
            : 'Consulte os totais de dotação aprovada, empenhos emitidos e saldos orçamentários do exercício.',
          position: 'bottom'
        }
      ]
    },
    kanban: {
      id: 'kanban',
      title: 'Ferramenta Kanban de Progresso',
      description: `Acompanhamento do fluxo das contratações sob a ótica do perfil ${roleLabel}.`,
      iconName: 'ListTodo',
      steps: [
        {
          targetSelector: '[data-tour="kanban-selector"]',
          title: 'Seleção do Processo de Planejamento',
          badge: `Seletor de Processos (${roleLabel})`,
          description: 'Selecione o Processo de Planejamento SEI que deseja acompanhar no Quadro Kanban. O quadro de tarefas e os indicadores de progresso da equipe se ajustam automaticamente.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="kanban-pipeline"]',
          title: 'Macroprocesso e Esteira BPMN (IN SGD/ME)',
          badge: 'Estágios Regulatórios',
          description: 'Visualizador interativo do fluxo composto pelas 5 macroetapas da contratação de TIC: Estudos Técnicos (ETP), Termo de Referência (TR), Parecer CONJUR, Sessão Pública e Contratação Concluída.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="kanban-actions"]',
          title: 'Modelos de Fluxo e Criação de Tarefas',
          badge: 'Ações & Templates',
          description: role === 'GECTI' || role === 'Fiscal'
            ? 'Importe modelos de fluxo padronizados (DFD Comum, Licitação de TIC, Dispensa/Inexigibilidade), customize templates e cadastre novas tarefas com prazos e responsáveis.'
            : 'Consulte os modelos de fluxo e a distribuição das tarefas do processo. O cadastro e movimentação de cards ficam protegidos para o seu perfil.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="kanban-board"]',
          title: 'Quadro de Colunas e Movimentação',
          badge: role === 'Visualizador' || role === 'Auditor' ? 'Modo Consulta' : 'Arrastar / Avançar',
          description: role === 'GECTI' || role === 'Fiscal'
            ? 'Gerencie os cards organizados nas colunas: "Pendentes", "Em Elaboração", "Aguardando Assinatura" e "Concluídas". Arraste os cards ou use as setas para transicionar o status.'
            : 'Quadro de tarefas exibido em modo de leitura. Clique em qualquer card para inspecionar os checklists de artefatos e prazos.',
          position: 'top'
        }
      ]
    },
    icti_calculator: {
      id: 'icti_calculator',
      title: 'Calculadora de Reajuste ICTI (Ipeadata)',
      description: `Cálculo e verificação do índice do ICTI para ${roleLabel}.`,
      iconName: 'Calculator',
      steps: [
        {
          targetSelector: '[data-tour="icti-modal-header"]',
          title: 'Calculadora de Reajuste pelo ICTI',
          badge: `Calculadora ICTI (${roleLabel})`,
          description: 'Realiza o cálculo oficial da variação percentual acumulada do ICTI obtido em tempo real na API do Ipeadata entre a data-base inicial e a data do reajuste anual.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="icti-history-box"]',
          title: 'Data-Base Ancorada na Data do Orçamento Estimado',
          badge: 'Regra de Reajuste',
          description: 'A Data-Base inicial do contrato é ancorada de forma fixa na Data do Orçamento Estimado (ex.: orçamento em maio fixa o ciclo de reajuste em maio/2026, maio/2027 etc.), garantindo o ciclo anual de reajuste mesmo com alterações posteriores.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="icti-calc-output"]',
          title: 'Memória de Cálculo e Minuta SEI',
          badge: 'Documentação & SEI',
          description: role === 'GECTI' || role === 'Fiscal'
            ? 'Confira o fator acumulado, o valor do reajuste e copie a memória de cálculo formatada em um clique para instruir a minuta de Apostilamento no SEI.'
            : 'Confira a memória de cálculo do fator acumulado do ICTI, o acréscimo financeiro resultante e audite a conformidade dos parâmetros aplicados.',
          position: 'top'
        }
      ]
    },
    contrato_details: {
      id: 'contrato_details',
      title: 'Detalhamento da Ficha do Contrato',
      description: `Tutorial da ficha detalhada, métricas analíticas e das 5 abas operacionais do contrato (${roleLabel}).`,
      iconName: 'Handshake',
      steps: [
        {
          targetSelector: '[data-tour="contrato-detail-header"]',
          title: 'Cabeçalho e Identificação do Contrato',
          badge: `Ficha Detalhada (${roleLabel})`,
          description: 'Exibe a identificação do contrato, Processo SEI, fornecedor, modalidade de contratação e botões de atalho para Rastreamento de Percurso, Exportação da Ficha em PDF e acionamento deste Tutorial.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="contrato-detail-rastrear"]',
          title: 'Rastrear Percurso (Matriz de Linhagem Completa)',
          badge: 'Linhagem & Auditoria',
          description: 'Abre a matriz de rastreabilidade completa do ciclo de vida contratual: interligando DFD de origem (PCA), Processo SEI de Planejamento, Contrato formalizado, Termos Aditivos e Apostilamentos (com ICTI), Ordens de Serviço, Descentralizações (MPO ➔ MGI) e Execução Financeira SIOP, com geração de relatório PDF oficial.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="contrato-detail-info"]',
          title: 'Objeto, Fornecedor e Equipe de Fiscalização',
          badge: 'Fiscalização Designada',
          description: 'Apresenta a descrição formal do Objeto, dados cadastrais do fornecedor, preposto formal com contatos e a Equipe de Fiscalização organizada por cards estruturados: Gestor (Titular/Substituto), Fiscal Técnico (Titular/Substituto), Fiscal Administrativo (Titular/Substituto), Fiscal Requisitante / Setorial (Titular/Substituto) e a Portaria formal com número SEI.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="contrato-detail-metrics"]',
          title: '4 Cards Analíticos & Módulos de Execução SOF',
          badge: 'Métricas & Orçamento',
          description: 'Painel analítico completo: 4 Cards principais (Valor Global Atualizado com acréscimos/reajustes; Itens SOF do exercício com total anualizado e % de participação; Periodicidade de Pagamento; e Saldo SOF a Executar com total pago) e 2 Módulos Gráficos Dedicados (Segregação GND 3 vs GND 4 em anel e Execução Orçamentária dos Itens SOF).',
          position: 'left'
        },
        {
          targetSelector: '[data-tour="contrato-detail-actions"]',
          title: 'Painel de Ações e Módulos Operacionais',
          badge: role === 'Visualizador' ? 'Ações (Modo Consulta)' : 'Módulos de Ação',
          description: role === 'GECTI'
            ? 'Módulo operacional completo: cadastre Alterações Contratuais (Aditivos/Apostilamentos com ICTI), lance Ocorrências da Fiscalização, emita Ordens de Serviço com descentralizações orçamentárias fracionadas e gerencie pagamentos no SIOP.'
            : role === 'Fiscal'
            ? 'Seu painel operacional diário! Emita Ordens de Serviço (OS), vincule descentralizações a notas de empenho, elabore termos TRP/TRD, registre glosas e lance ocorrências com anexação de atestes de fatura.'
            : role === 'Auditor'
            ? 'Inspecione os lançamentos de Ocorrências, atestes de fatura, termos aditivos, OSs emitidas, conformidade de descentralizações e notas de empenho.'
            : 'Painel de ações em modo somente leitura. Permite inspecionar todos os registros operacionais sem habilitar edições.',
          position: 'top'
        },
        {
          targetSelector: '[data-tour="contrato-detail-tabs"]',
          title: 'Sub-abas de Detalhamento do Contrato',
          badge: 'Navegação por Abas',
          description: 'Navegue pelas 5 abas operacionais do contrato: 1. Itens SOF (Catálogo da Ação 8861), 2. Histórico de Ocorrências e Atestes, 3. Aditivos & Apostilamentos, 4. Ordens de Serviço & Descentralizações (TRP/TRD), 5. Execução Financeira & Pagamentos SIOP.',
          position: 'top'
        },
        {
          targetSelector: '[data-tour="contrato-tab-itens"]',
          title: 'Aba 1: Itens do Contrato (Catálogo SOF)',
          badge: 'Itens SOF',
          description: 'Detalhamento de todos os itens de serviço e catálogo da Ação 8861 alocados ao contrato, com quantitativos contratados, valores unitários, GND (Custeio/Investimento), notas de empenho vinculadas e saldo restante.',
          position: 'top'
        },
        {
          targetSelector: '[data-tour="contrato-tab-ocorrencias"]',
          title: 'Aba 2: Ocorrências e Atestes da Fiscalização',
          badge: 'Ocorrências & Notificações',
          description: role === 'Fiscal'
            ? 'Seu espaço diário: registre intercorrências da execução, emita notificações ao fornecedor e anexe atestes de fatura.'
            : 'Registro cronológico do histórico de intercorrências, notificações, advertências, penalidades e atestes emitidos pela fiscalização do contrato.',
          position: 'top'
        },
        {
          targetSelector: '[data-tour="contrato-tab-aditivos"]',
          title: 'Aba 3: Aditivos & Apostilamentos (Reajuste ICTI)',
          badge: 'Alterações Contratuais',
          description: 'Histórico formal de Termos Aditivos (prorrogações de vigência e acréscimos até o limite legal) e Termos de Apostilamento com a memória de cálculo do índice ICTI (Ipeadata) ancorada na Data do Orçamento Estimado.',
          position: 'top'
        },
        {
          targetSelector: '[data-tour="contrato-tab-os"]',
          title: 'Aba 4: Ordens de Serviço & Descentralizações (MPO ➔ MGI)',
          badge: 'OSs & Repasses',
          description: 'Gerenciamento completo de OSs com suporte a múltiplas descentralizações orçamentárias fracionadas/mensais, seleção de Notas de Empenho (NE) vinculadas, controle de termos TRP/TRD e apuração de glosas.',
          position: 'top'
        },
        {
          targetSelector: '[data-tour="contrato-tab-pagamentos"]',
          title: 'Aba 5: Execução Financeira e Pagamentos SIOP',
          badge: 'Execução SIOP',
          description: 'Histórico de Notas de Empenho (NE), Notas de Sistema / Liquidações (NS) e Ordens Bancárias (OB) com percentuais consolidados de execução orçamentária.',
          position: 'top'
        }
      ]
    },
    planejamento_details: {
      id: 'planejamento_details',
      title: 'Detalhamento do Processo em Planejamento',
      description: `Tutorial da ficha detalhada de instrução do processo SEI para ${roleLabel}.`,
      iconName: 'Layers',
      steps: [
        {
          targetSelector: '[data-tour="plan-detail-header"]',
          title: 'Identificação e Navegação do Processo SEI',
          badge: `Navegação SEI (${roleLabel})`,
          description: 'Barra superior com o número do Processo SEI, tipo de processo/layout, DFD de origem no PCA, contrato originado e botões para Rastreabilidade Completa e acionamento deste Tutorial.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="plan-detail-stepper"]',
          title: 'Etapas do Fluxo Regulatório (IN SGD/ME)',
          badge: 'Fases da Instrução',
          description: 'Acompanhamento do progresso pelas fases regulatórias da IN SGD/ME: Fase 1 - Instrução do Planejamento (ETP/TR), Fase 2 - Seleção do Fornecedor (Sessão Pública) e Fase 3 - Contratação Concluída.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="plan-detail-specs"]',
          title: 'Equipe de Planejamento (EPC) Estruturada & Portaria',
          badge: 'Equipe EPC',
          description: 'Estrutura formal da Equipe de Planejamento da Contratação (EPC) com cards dedicados: Integrante Requisitante (Titular e Substituto), Integrante Técnico (Titular e Substituto) e Integrante Administrativo (Titular e Substituto), além do banner oficial da Portaria formal com número SEI.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="plan-detail-metrics"]',
          title: 'Painel de Estimativas e Parâmetros da SOF',
          badge: 'Estimativas & PCA',
          description: 'Estimativa de Custo SOF calculada a partir dos itens orçamentários da Ação 8861 vinculados (ou valor global previsto), DFD de origem no PCA (número e exercício), classificação de Natureza/GND e Sessão Pública / Registro com link externo.',
          position: 'left'
        },
        {
          targetSelector: '[data-tour="plan-detail-segregacao"]',
          title: 'Segregação de Custeio (GND 3) vs Investimento (GND 4)',
          badge: 'Custeio vs Investimento',
          description: 'Análise gráfica da distribuição e equilíbrio dos valores orçados entre despesas de Custeio (GND 3 - sustentação e serviços continuados) e Investimento (GND 4 - aquisições e novas soluções).',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="plan-detail-tabs"]',
          title: 'Sub-abas de Gestão do Planejamento',
          badge: 'Abas de Gestão',
          description: 'Navegação entre as 3 visões detalhadas do processo: Histórico Processual SEI, Quadro Kanban de Tarefas da Equipe e Itens da SOF Orçados (Ação 8861).',
          position: 'top'
        },
        {
          targetSelector: '[data-tour="plan-tab-historico"]',
          title: 'Aba 1: Histórico Processual SEI',
          badge: 'Eventos SEI',
          description: 'Registro cronológico dos eventos do processo SEI: despachos, pareceres jurídicos da CONJUR, aprovações de ETP/TR, publicação de edital e notas técnicas.',
          position: 'top'
        },
        {
          targetSelector: '[data-tour="plan-tab-tarefas"]',
          title: 'Aba 2: Tarefas da Equipe (Quadro Kanban)',
          badge: 'Quadro Kanban',
          description: role === 'GECTI' || role === 'Fiscal'
            ? 'Quadro interativo para a equipe de planejamento acompanhar e concluir tarefas (elaboração de artefatos da IN SGD/ME: ETP, TR, Matriz de Riscos e Pesquisa de Preços).'
            : 'Quadro informativo de tarefas da equipe de planejamento em modo de consulta.',
          position: 'top'
        },
        {
          targetSelector: '[data-tour="plan-tab-itens-sof"]',
          title: 'Aba 3: Itens da SOF Orçados (Ação 8861)',
          badge: 'Itens SIOP',
          description: 'Quadro de itens orçamentários da Ação 8861 vinculados ao processo, assegurando a reserva e conformidade orçamentária prévia à licitação.',
          position: 'top'
        }
      ]
    }
  };
}

export const TOURS_CONFIG: Record<string, TourDefinition> = getToursConfig('GECTI');


export interface GuidedTourOverlayProps {
  isOpen?: boolean;
  tourId?: string;
  userRole?: UserRole | string;
  steps?: TourStep[];
  tourTitle?: string;
  onClose: () => void;
  onComplete: (tourId: string) => void;
}

export const GuidedTourOverlay: React.FC<GuidedTourOverlayProps> = ({
  isOpen = true,
  tourId = 'main',
  userRole = 'GECTI',
  steps: customSteps,
  tourTitle: customTitle,
  onClose,
  onComplete
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const toursForRole = useMemo(() => getToursConfig(userRole), [userRole]);
  const tourDef = useMemo(() => toursForRole[tourId] || toursForRole['main'], [toursForRole, tourId]);
  const steps = customSteps || tourDef.steps;
  const tourTitle = customTitle || tourDef.title;
  const currentStep = steps[currentStepIndex] || steps[0];

  // Reset index when tourId changes or opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
      setDontShowAgain(false);
    }
  }, [isOpen, tourId]);

  // Highlight element location measurement
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    const findAndMeasureTarget = () => {
      if (currentStep.targetSelector) {
        const el = document.querySelector(currentStep.targetSelector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          const rect = el.getBoundingClientRect();
          setTargetRect(rect);
          return;
        }
      }
      setTargetRect(null);
    };

    findAndMeasureTarget();
    const interval = setInterval(findAndMeasureTarget, 300);
    window.addEventListener('resize', findAndMeasureTarget);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', findAndMeasureTarget);
    };
  }, [isOpen, currentStepIndex, currentStep]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const handleComplete = () => {
    onComplete(tourId);
    onClose();
  };

  // Compute card placement relative to highlighted rect or centered fallback
  let cardStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 9999
  };

  if (targetRect) {
    const spaceBelow = window.innerHeight - targetRect.bottom;
    const spaceAbove = targetRect.top;
    const spaceRight = window.innerWidth - targetRect.right;

    if (currentStep.position === 'right' && spaceRight > 380) {
      cardStyle = {
        position: 'fixed',
        top: Math.max(20, Math.min(window.innerHeight - 380, targetRect.top)),
        left: targetRect.right + 16,
        zIndex: 9999
      };
    } else if (spaceBelow > 320 || currentStep.position === 'bottom') {
      cardStyle = {
        position: 'fixed',
        top: Math.min(window.innerHeight - 340, targetRect.bottom + 16),
        left: Math.max(16, Math.min(window.innerWidth - 420, targetRect.left)),
        zIndex: 9999
      };
    } else if (spaceAbove > 320 || currentStep.position === 'top') {
      cardStyle = {
        position: 'fixed',
        top: Math.max(20, targetRect.top - 330),
        left: Math.max(16, Math.min(window.innerWidth - 420, targetRect.left)),
        zIndex: 9999
      };
    }
  }

  return (
    <div className="fixed inset-0 z-[9990] overflow-hidden font-sans select-none animate-in fade-in duration-200">
      {/* Darkened overlay backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] transition-all"
        onClick={handleClose}
      />

      {/* Target Element Pulsing Spotlight Glow */}
      {targetRect && (
        <div
          className="absolute border-2 border-amber-400 bg-amber-400/10 rounded-xl shadow-[0_0_30px_rgba(251,191,36,0.6)] pointer-events-none z-[9995] transition-all duration-300 animate-pulse"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12
          }}
        />
      )}

      {/* Step Card Modal */}
      <div
        style={cardStyle}
        className="w-[92vw] max-w-[440px] bg-surface border-2 border-amber-500/50 rounded-2xl shadow-2xl p-5 text-on-surface space-y-4 font-sans animate-in zoom-in-95 duration-200 z-[9999]"
      >
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-amber-400 block">
                {currentStep.badge || tourDef.title}
              </span>
              <span className="text-xs font-semibold text-on-surface-variant font-mono">
                Passo {currentStepIndex + 1} de {steps.length}
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
            title="Fechar Tutorial"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-amber-500 to-amber-300 h-full transition-all duration-300"
            style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Step Body Content */}
        <div className="space-y-2 py-1">
          <h4 className="text-base font-bold text-on-surface font-display leading-tight flex items-center gap-2">
            <span>{currentStep.title}</span>
          </h4>
          <p className="text-xs text-on-surface-variant leading-relaxed text-justify">
            {currentStep.description}
          </p>
        </div>

        {/* Action Controls */}
        <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleClose}
            className="text-xs text-on-surface-variant/80 hover:text-on-surface font-semibold px-2 py-1 hover:underline cursor-pointer"
          >
            Pular
          </button>

          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3 py-1.5 bg-surface-container-low border border-outline-variant hover:bg-surface-container text-on-surface rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs transition-all shadow-md hover:shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>{currentStepIndex === steps.length - 1 ? 'Concluir Tutorial' : 'Próximo'}</span>
              {currentStepIndex === steps.length - 1 ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ManualGuiadoHubModalProps {
  isOpen: boolean;
  userRole?: UserRole | string;
  onClose: () => void;
  completedTours: string[];
  onStartTour?: (tourId: string) => void;
  onSelectTour?: (tourId: string) => void;
  onResetTours: () => void;
}

export const ManualGuiadoHubModal: React.FC<ManualGuiadoHubModalProps> = ({
  isOpen,
  userRole = 'GECTI',
  onClose,
  completedTours,
  onStartTour,
  onSelectTour,
  onResetTours
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const toursConfig = useMemo(() => getToursConfig(userRole), [userRole]);
  const roleName = ROLE_LABELS[(['GECTI', 'Fiscal', 'Auditor', 'Visualizador'].includes(userRole) ? userRole : 'GECTI') as UserRole];

  const handleStart = (tourId: string) => {
    if (typeof onStartTour === 'function') {
      onStartTour(tourId);
    } else if (typeof onSelectTour === 'function') {
      onSelectTour(tourId);
    }
  };

  if (!isOpen) return null;

  const toursList = Object.values(toursConfig) as TourDefinition[];

  const filteredTours = toursList.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[9980] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-sans animate-in fade-in duration-200">
      <div className="bg-surface border border-outline-variant/80 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-on-surface">
        {/* Modal Header */}
        <div className="p-5 md:p-6 border-b border-outline-variant/40 bg-surface-container-low flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-xl shadow-sm">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface font-display flex items-center gap-2">
                <span>Tutorial Guiado & Central de Tutoriais</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                  Interativo
                </span>
              </h3>
              <p className="text-xs text-on-surface-variant">
                Explore os tutoriais interativos passo a passo e aprenda a utilizar cada ferramenta do CONTRATICS.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors cursor-pointer"
            title="Fechar Tutoriais"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 md:p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Active Role Tailored Banner */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-on-surface">
                Tutoriais adaptados para o seu perfil: <strong className="text-amber-300 font-bold">{roleName}</strong>
              </span>
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold shrink-0">
              Textos & Permissões Personalizados
            </span>
          </div>

          {/* Main Hero Tour Card */}
          <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/35 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Compass className="w-4 h-4" />
                <span>Tutorial Principal de Boas-Vindas</span>
              </div>
              <h4 className="text-base font-bold text-on-surface">Tour Geral do Sistema CONTRATICS</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {toursConfig['main'].description}
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                handleStart('main');
              }}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs transition-all shadow-md hover:shadow-amber-500/20 flex items-center gap-2 shrink-0 cursor-pointer active:scale-95"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Iniciar Tour Geral ({toursConfig['main'].steps.length} Passos)</span>
            </button>
          </div>

          {/* Section Title & Search */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
            <div>
              <h4 className="text-sm font-bold text-on-surface font-display">Tutoriais Específicos por Ferramenta</h4>
              <p className="text-xs text-on-surface-variant">Selecione uma ferramenta específica para realizar o treinamento passo a passo.</p>
            </div>
            <input
              type="text"
              placeholder="Buscar ferramenta ou módulo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-surface-container-low border border-outline-variant/60 rounded-xl px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-amber-500 w-full sm:w-60"
            />
          </div>

          {/* Grid of Tool Tours */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {filteredTours.map(t => {
              const isCompleted = completedTours.includes(t.id);
              const isMain = t.id === 'main';

              if (isMain) return null; // Already highlighted in banner

              return (
                <div
                  key={t.id}
                  className="bg-surface-container-low border border-outline-variant/50 hover:border-amber-500/50 rounded-xl p-4 space-y-3 transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {t.steps.length} Passos
                      </span>
                      {isCompleted ? (
                        <span className="text-[10.5px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Concluído
                        </span>
                      ) : (
                        <span className="text-[10.5px] font-bold text-on-surface-variant/70 bg-surface-container px-2 py-0.5 rounded-full">
                          Não Realizado
                        </span>
                      )}
                    </div>
                    <h5 className="text-sm font-bold text-on-surface group-hover:text-amber-400 transition-colors">
                      {t.title}
                    </h5>
                    <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                      {t.description}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      handleStart(t.id);
                    }}
                    className="w-full py-2 bg-surface-container hover:bg-amber-500/20 border border-outline-variant/60 hover:border-amber-500/50 text-on-surface hover:text-amber-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isCompleted ? 'Refazer Tutorial' : 'Iniciar Tutorial'}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Quick FAQ / Guide Info */}
          <div className="bg-surface-container-low/60 border border-outline-variant/40 rounded-xl p-4 space-y-2">
            <h5 className="text-xs font-bold text-on-surface flex items-center gap-1.5 uppercase tracking-wider text-amber-400">
              <Info className="w-4 h-4" />
              <span>Como funcionam as notificações automáticas e os textos por perfil?</span>
            </h5>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              O sistema CONTRATICS adapta os textos de cada tutorial para o perfil conectado (<strong>{roleName}</strong>). Ao trocar de perfil no menu superior, o sistema recalcula as instruções para destacar exatamente as permissões, módulos e alçadas de ação correspondentes.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-surface-container-low border-t border-outline-variant/40 flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => {
              onResetTours();
            }}
            className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1.5 hover:underline cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reiniciar Histórico de Tutoriais</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Fechar Tutoriais
          </button>
        </div>
      </div>
    </div>
  );
};

