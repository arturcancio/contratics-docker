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
  ListTodo,
  Shuffle,
  Scale,
  Users,
  Lock,
  Calendar
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

  const config: Record<string, TourDefinition> = {
    main: {
      id: 'main',
      title: 'Tour Geral do Sistema CONTRATICS',
      description: `Conheça todos os módulos, regras e indicadores do CONTRATICS sob a perspectiva do seu perfil (${roleLabel}).`,
      iconName: 'Compass',
      steps: [
        {
          targetSelector: '[data-tour="brand-logo"]',
          title: 'Boas-vindas ao CONTRATICS (SOF/MPO)',
          badge: `Perfil: ${roleLabel}`,
          description: role === 'GECTI'
            ? 'Você está conectado como Administrador GECTI. Possui alçada máxima para cadastrar, aprovar e editar DFDs no PCA, gerenciar contratos e fornecedores, emitir Ordens de Serviço (OS) com múltiplas descentralizações orçamentárias (MPO ➔ MGI), formalizar aditivos e apostilamentos com o índice ICTI, acompanhar o teto da Ação 8861 no SIOP, gerenciar a escala presencial do PGD e administrar usuários e acessos institucionais.'
            : role === 'Fiscal'
            ? 'Você está conectado como Fiscal de Contrato. Sua atuação é focada na fiscalização técnica e administrativa dos contratos de TIC da SOF, emissão de Ordens de Serviço (OS), vinculação de descentralizações a notas de empenho, acompanhamento de termos de recebimento (TRP/TRD), atestes de faturas e registros de intercorrências da execução.'
            : role === 'Auditor'
            ? 'Você está conectado com o perfil Auditoria & Compliance. Seu foco é a checagem da conformidade legal perante a IN SGD/ME nº 94/2022 e Lei 14.133/2021, auditoria da matriz de rastreabilidade de ponta a ponta, fiscalização do confronto de descentralizações (MPO ➔ MGI), acompanhamento de empenhos no SIOP e conferência de reajustes pelo ICTI.'
            : 'Você está conectado como Visualizador (Modo Consulta). Navegue de forma segura por todos os módulos, DFDs, contratos, ordens de serviço, limites orçamentários e relatórios em modo exclusivo de leitura protegida.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="sidebar-nav"]',
          title: 'Menu Lateral de Navegação Adaptativa',
          badge: 'Navegação por Perfil',
          description: role === 'GECTI'
            ? 'Acesse todos os módulos do ciclo de vida: Dashboard Geral, DFDs (PCA), Orçamento Atual (Ação 8861), Planejamentos SEI, Kanban de Tarefas, Contratos Vigentes, Normativos & FAQ, Presença GECTI e Gestão de Usuários.'
            : role === 'Fiscal'
            ? 'Navegue diretamente pelos Contratos sob sua gestão, Ocorrências da Fiscalização, Ordens de Serviço, DFDs da sua área requisitante, Planejamentos SEI e acompanhe o fluxo da equipe no Kanban.'
            : role === 'Auditor'
            ? 'Navegue pela execução do Orçamento Ação 8861 no SIOP, audite os eventos e despachos dos processos no SEI, acompanhe os Contratos, aditivos, termos de recebimento e a matriz de rastreabilidade completa.'
            : 'Navegue livremente por todas as telas do sistema em modo de consulta. As ferramentas de criação, alteração ou exclusão de registros ficam desabilitadas para o seu perfil.',
          position: 'right'
        },
        {
          targetSelector: '[data-tour="header-manual"]',
          title: 'Central do Tutorial Guiado & Manuais',
          badge: 'Treinamento Sempre À Mão',
          description: `Precisa rever um fluxo ou treinar um módulo específico? Clique neste ícone a qualquer momento para abrir esta Central de Tutoriais e navegar pelos guias passo a passo adaptados ao perfil ${roleLabel}.`,
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="header-profile"]',
          title: 'Menu de Perfil Institucional & Segurança',
          badge: 'Segurança & Credenciais',
          description: `Seu usuário ativo possui o perfil "${roleLabel}". Clique neste menu no cabeçalho para visualizar seus dados institucionais, acessar a opção "Alterar Minha Senha" (com validação da senha atual e criptografia segura Bcrypt) e realizar o logout seguro da plataforma.`,
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="year-selector"]',
          title: 'Filtro de Exercício Financeiro (Ano) & UASG',
          badge: 'Filtro Global',
          description: 'Selecione o ano do exercício (2024 a 2028) no topo do Dashboard e consulte a UASG Geral 201007 (MPO/SOF). Todos os limites do SIOP, DFDs, valores anualizados dos contratos e demonstrativos de descentralização são recalculados instantaneamente para o exercício escolhido.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="dashboard-macrofluxo"]',
          title: 'Macrofluxo das 3 Etapas de Contratação GECTI',
          badge: 'Esteira de Contratação',
          description: 'Acompanhe a evolução de todos os processos em tempo real através das 3 macroetapas: Etapa 1 - Fase Interna (Planejamento da Contratação com ETP, TR, Pesquisa de Preços e Mapa de Riscos), Etapa 2 - Seleção do Fornecedor (Sessão Pública e Julgamento de Propostas) e Etapa 3 - Gestão Contratual (Execução e Fiscalização). Clique nos cards para visualizar diretamente os processos de cada fase.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="dashboard-consolidador"]',
          title: 'Consolidação Orçamentária e Financeira',
          badge: 'Destaques Orçamentários',
          description: 'Painel com os 3 grandes agregadores de recursos do exercício: 1. Total Anualizado dos Contratos Vigentes da SOF; 2. Valor Anual dos DFDs Ativos do PCA; e 3. Valor Anual Geral SOF (o somatório consolidado de Contratos Anualizados + DFDs Ativos planejados para o exercício).',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="dashboard-graficos-8861"]',
          title: 'Segregação Custeio vs Investimento & Histórico Ação 8861',
          badge: 'Ação 8861 SIOP',
          description: 'Visão analítica de equilíbrio orçamentário: gráfico de rosca demonstrando a proporção exata de Despesas Correntes/Custeio (GND 3 - sustentação contínua) versus Despesas de Capital/Investimento (GND 4 - novas soluções e ativos), além do comparativo histórico em barras ano a ano da Ação 8861.',
          position: 'top'
        },
        {
          targetSelector: '[data-tour="dashboard-icti-widget"]',
          title: 'Acompanhamento do Índice de Custos de TI (ICTI)',
          badge: 'Ipeadata Oficial',
          description: 'Série histórica oficial e auditada pelo Ipea/Ipeadata (séries DIMAC12) para fundamentar o reajuste anual de contratos de tecnologia. Apresenta a curva de variação acumulada nos últimos 12 meses e tabela com as divulgações oficiais mais recentes.',
          position: 'top'
        },
        {
          targetSelector: '[data-tour="btn-icti"]',
          title: 'Calculadora Inteligente do ICTI (Ipeadata)',
          badge: 'Ferramenta Inteligente',
          description: role === 'GECTI' || role === 'Fiscal'
            ? 'Abra a Calculadora do ICTI com consulta em tempo real à API oficial do Ipeadata. O cálculo fixa a Data-Base original na Data do Orçamento Estimado do contrato (cumprindo o Art. 92, V da Lei 14.133/2021 e jurisprudência do TCU), gerando memória detalhada e minuta formatada para o SEI.'
            : 'Simule e audite a variação acumulada do índice ICTI (Ipeadata), conferindo a aplicação da Data do Orçamento Estimado e as memórias de cálculo dos termos de apostilamento.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="dashboard-execucao-contratos"]',
          title: 'Execução Orçamentária dos Contratos (Itens SOF)',
          badge: 'Execução Financeira',
          description: 'Demonstrativo visual da execução financeira apurado estritamente sobre os itens sob responsabilidade da SOF em cada contrato: Empenhado (reserva orçamentária), Liquidado (serviços atestados) e Pago (efetivo desembolso), confrontados com a dotação SIOP.',
          position: 'top'
        },
        {
          targetSelector: '[data-tour="descentralizacao-panel"]',
          title: 'Painel de Descentralização Orçamentária (MPO ➔ MGI)',
          badge: 'Gestão de Repasses Colaboragov',
          description: 'Monitoramento exclusivo para contratos sob a modalidade Pregão Colaboragov através das três caixas analíticas: "Deveria ser Descentralizado" (total demandado nas OSs), "Total Descentralizado" (repasses formalizados ao MGI via SEI) e "Saldo não cobrado" (a diferença preservada no teto orçamentário da SOF, protegendo contra perda de recursos).',
          position: 'top'
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
          description: 'O DFD é o documento de formalização inicial que compõe o Plano de Contratações Anual (PCA). Aqui são registradas todas as demandas e necessidades de TIC da SOF para os exercícios futuros em cumprimento ao Decreto nº 10.947/2022.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="dfd-actions"]',
          title: 'Cadastro, Edição e Exportação de DFDs',
          badge: 'Ações do Perfil',
          description: role === 'GECTI'
            ? 'Como Administrador GECTI, você pode cadastrar novos DFDs, analisar/aprovar demandas de outras unidades, vincular a processos SEI e exportar o relatório oficial do PCA.'
            : role === 'Fiscal'
            ? 'Como Fiscal ou requisitante técnico, elabore propostas de DFDs para sua área de atuação. A consolidação e aprovação final no PCA cabe à GECTI.'
            : role === 'Auditor'
            ? 'Exporte relatórios em PDF e audite a conformidade do PCA com o PDTIC e a correta classificação entre Custeio (GND 3) e Investimento (GND 4).'
            : 'Consulte a listagem completa de DFDs e exporte relatórios. As ações de criação e edição ficam restritas no modo somente leitura.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="dfd-filters"]',
          title: 'Filtros Dinâmicos de Busca, Ano e Status',
          badge: 'Filtros Rápidos',
          description: 'Pesquise por termo no objeto ou UASG, selecione o ano do exercício do PCA e filtre por status do DFD (Não iniciado, Iniciado, Concluído).',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="dfd-stats"]',
          title: 'Painel de Indicadores & Segregação GND 3 vs 4',
          badge: 'Métricas Orçamentárias',
          description: 'Acompanhe em tempo real a quantidade de demandas e o montante financeiro total dos DFDs alocados em despesas de Custeio (GND 3 - sustentação, licenças continuadas) versus Investimentos (GND 4 - aquisições de ativos, novos sistemas).',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="dfd-table"]',
          title: 'Tabela de Demandas e Vinculação ao Processo SEI',
          badge: 'Fluxo Processual',
          description: role === 'GECTI'
            ? 'Gerencie o ciclo do DFD (Não iniciado, Iniciado, Concluído), confira os valores anualizados proporcionais e realize a conexão direta com o Processo de Planejamento instaurado no SEI.'
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
          description: 'Gerencie os processos instaurados no SEI em estrita observância à IN SGD/ME nº 94/2022 e Lei 14.133/2021. Acompanhe a Equipe de Planejamento da Contratação (EPC), DFDs de origem, prazos e a fase atual da instrução.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="plan-actions"]',
          title: 'Cadastro de Processo SEI & Exportação',
          badge: 'Ações do Perfil',
          description: role === 'GECTI'
            ? 'Como Administrador GECTI, cadastre novos Processos de Planejamento SEI, defina o layout/modalidade (Pregão SOF, Contratação Direta - Dispensa ou Inexigibilidade), designe os membros da EPC e exporte relatórios consolidados em PDF.'
            : role === 'Fiscal'
            ? 'Acompanhe os processos em que foi designado como integrante da EPC e exporte a relação de processos para planejamento das atividades.'
            : role === 'Auditor'
            ? 'Audite os processos instaurados, a formalização das portarias de EPC e exporte relatórios de conformidade regulatória.'
            : 'Consulte a relação de processos SEI em instrução e exporte dados em modo de leitura protegida.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="plan-risk-card"]',
          title: 'Previsão Orçamentária & Gráfico de Risco (Em Elaboração)',
          badge: 'Análise de Risco & Custo',
          description: 'Card analítico dos processos atualmente com status "Em Elaboração": totaliza os recursos previstos e apresenta o gráfico Donut de distribuição entre Custeio (GND 3) e Investimento (GND 4) para subsidiar a programação financeira da SOF.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="plan-filters"]',
          title: 'Barra de Busca Textual e Filtro por Status',
          badge: 'Filtros da Esteira',
          description: 'Pesquise por número do Processo SEI, objeto ou integrante da EPC, e filtre por estágio regulatório: Seleção Fornecedor, Em Elaboração, Gerou Contrato ou Arquivado.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="plan-table"]',
          title: 'Tabela de Processos e Acesso à Ficha Completa',
          badge: 'Processos Ativos',
          description: 'Tabela completa com número SEI, modalidade, objeto resumido, estimativa de custo e status. Clique em qualquer processo para abrir a sua Ficha Detalhada, contendo o Fluxo BPMN 2.0 e o Quadro Kanban.',
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
          description: 'Barra superior com o número do Processo SEI, layout do processo, DFD de origem no PCA, contrato originado e botões para Rastreabilidade Completa e acionamento deste Tutorial.',
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
          description: 'Navegação entre as visões integradas do processo: "Fluxo e Kanban" (diagrama BPMN 2.0 e quadro Kanban de tarefas), "Itens SOF Orçados" (reserva na Ação 8861) e "Histórico Processual" (registro cronológico de despachos SEI).',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="bpmn-flow-board"]',
          title: 'Fluxo BPMN 2.0 Oficial da Contratação',
          badge: 'Modelagem BPMN 2.0',
          description: role === 'GECTI' || role === 'Fiscal'
            ? 'Diagrama interativo em notação oficial BPMN 2.0 com raias de responsabilidade (Área Requisitante, Equipe de Planejamento, Área de TIC e Autoridade Competente), tarefas retangulares, gateways de decisão e setas ortogonais em ângulos retos de 90°. Permite adicionar novas etapas, alterar papéis, conectar passos e modelar fluxos padronizados da IN SGD/ME 94/2022.'
            : 'Diagrama visual do macroprocesso de contratação em notação oficial BPMN 2.0 com raias de responsabilidade, gateways e conexões canônicas em ângulos retos de 90° em modo de consulta protegida.',
          position: 'top'
        },
        {
          targetSelector: '[data-tour="kanban-board"]',
          title: 'Quadro Kanban de Execução de Tarefas da Equipe',
          badge: 'Quadro Kanban',
          description: role === 'GECTI' || role === 'Fiscal'
            ? 'Quadro interativo para a equipe de planejamento gerenciar as tarefas da instrução processual organizadas nas 4 colunas: "Pendentes", "Em Elaboração", "Aguardando Assinatura" e "Concluídas". Arraste os cards entre as colunas, abra para conferir os checklists de artefatos da IN SGD/ME (ETP, TR, Matriz de Riscos, Pesquisa de Preços) e registre os prazos.'
            : 'Quadro visual de acompanhamento da execução das tarefas da equipe de planejamento em modo de leitura. Clique em qualquer card para inspecionar os artefatos técnicos e prazos da instrução.',
          position: 'top'
        },
        {
          targetSelector: '[data-tour="plan-tab-itens-sof"]',
          title: 'Sub-aba: Itens da SOF Orçados (Ação 8861)',
          badge: 'Reserva Orçamentária SIOP',
          description: 'Quadro de itens do catálogo da Ação 8861 alocados a este planejamento, garantindo a reserva prévia e compatibilidade orçamentária antes do lançamento da licitação.',
          position: 'top'
        },
        {
          targetSelector: '[data-tour="plan-tab-historico"]',
          title: 'Sub-aba: Histórico Processual SEI & Auditoria',
          badge: 'Eventos SEI',
          description: 'Registro cronológico de despachos, pareceres jurídicos da CONJUR, saneamentos técnicos, aprovações de ETP/TR e publicação de editais com rastreabilidade formal do SEI.',
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
          targetSelector: '[data-tour="contract-actions"]',
          title: 'Ações: Exportar PDF, Fornecedores e Novo Contrato',
          badge: 'Ações de Gestão',
          description: role === 'GECTI'
            ? 'Exporte relatórios em PDF, gerencie a base cadastral de empresas/fornecedores e cadastre novos contratos formalizados.'
            : role === 'Fiscal'
            ? 'Exporte dados e consulte a base de fornecedores e seus respectivos prepostos designados.'
            : 'Exporte relatórios oficiais e consulte os dados cadastrais das empresas contratadas.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="contract-alerts"]',
          title: 'Painel de Alertas de Vencimento de Contratos Ativos',
          badge: 'Vigência 30/60/90/180 dias',
          description: 'Monitoramento proativo dos prazos de término de vigência dos contratos da SOF classificados por faixas de severidade (Crítico <30d, Alto Risco <60d, Alerta <90d e Preventivo <180d) com botão para iniciar prorrogações tempestivas.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="contract-alterations"]',
          title: 'Acompanhamento do ICTI & Reajustes de Contratos',
          badge: 'Reajuste pelo ICTI',
          description: 'Painel integrado à API oficial do Ipeadata com série histórica dos últimos 12 meses, curva de variação do índice e simulador para aplicação de termos de apostilamento ancorados na Data do Orçamento Estimado.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="contract-icti-btn"]',
          title: 'Calculadora Oficial do ICTI Integrada',
          badge: 'Calculadora Ipeadata',
          description: role === 'GECTI' || role === 'Fiscal'
            ? 'Abra a Calculadora ICTI diretamente deste painel para calcular memórias de reajuste e gerar textos padronizados para o processo SEI.'
            : 'Abra a Calculadora ICTI para simular e conferir os índices do Ipeadata aplicáveis aos contratos.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="contract-filters"]',
          title: 'Filtros por Termo, Processo e Vigência Ativa',
          badge: 'Filtros Dinâmicos',
          description: 'Busque rapidamente por número de contrato, processo SEI ou objeto, e filtre pelas faixas de vigência (Vigente, A Vencer, Encerrado).',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="contract-table"]',
          title: 'Tabela de Contratos Vigentes & Valores Anualizados',
          badge: 'Listagem Contratual',
          description: 'Tabela completa com número do contrato, processo SEI, fornecedor, objeto, vigências e o Valor Anualizado da SOF no exercício. Clique em qualquer contrato para acessar a Ficha Detalhada.',
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
          description: 'Apresenta a descrição formal do Objeto, dados cadastrais do fornecedor com CNPJ e contatos, e a Equipe de Fiscalização organizada por cards estruturados: Gestor (Titular/Substituto), Fiscal Técnico (Titular/Substituto), Fiscal Administrativo (Titular/Substituto), Fiscal Requisitante / Setorial (Titular/Substituto) e a Portaria formal com número SEI.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="contrato-detail-metrics"]',
          title: 'Métricas Analíticas, Prazos & Execução Orçamentária',
          badge: 'Valores & Prazos',
          description: 'Painel analítico completo: Valor Global Atualizado, Itens SOF do exercício com total anualizado e % de participação, Periodicidade de Pagamento, Saldo SOF a Executar, Datas Limites de Vigências (com destaque para a Data do Orçamento Estimado) e os gráficos de Segregação GND 3 vs GND 4 e Execução Orçamentária dos Itens SOF.',
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
            ? 'Seu espaço diário: registre intercorrências da execução, emita notificações formais ao fornecedor e anexe atestes de fatura para subsidiar o pagamento.'
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
          description: 'Acompanhe os limites orçamentários oficiais da SOF no SIOP para a Ação 8861 (Sustentação da Tecnologia da Informação do Sistema de Planejamento Nacional e do Orçamento Federal).',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="orcamento-actions"]',
          title: 'Ações Orçamentárias & Ferramentas de Projeção',
          badge: 'Ações do Orçamento',
          description: 'Simule prorrogações automáticas de contratos para exercícios futuros, gere a planilha interativa de projeção orçamentária oficial e exporte o relatório executivo em PDF.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="orcamento-siop-board"]',
          title: 'Painel de Monitoramento da Ação 8861 (SIOP)',
          badge: 'Dotação & Execução SIOP',
          description: 'Quadro com os dados oficiais do SIOP: Dotação Inicial, Dotação Atualizada, Empenhado, Liquidado e Pago, com histórico de atualizações e segregação por Custeio e Investimento.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="orcamento-kpis"]',
          title: 'KPIs Consolidados do Exercício',
          badge: 'Consolidação de Despesas',
          description: 'Cards com os somatórios das despesas de TIC: Total Anualizado dos Contratos Vigentes, Soma dos DFDs Anualizada (PCA), Processos em Planejamento (SEI) e o Valor Anual Geral SOF planejado para o exercício.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="orcamento-gnd"]',
          title: 'Segregação GND 3 (Custeio) vs GND 4 (Investimento)',
          badge: 'Equilíbrio Orçamentário',
          description: role === 'GECTI'
            ? 'Gerencie o saldo disponível, remanejamentos de dotação e limites calculados sobre os itens da SOF por Custeio (GND 3) e Investimento (GND 4).'
            : role === 'Fiscal'
            ? 'Acompanhe a disponibilidade orçamentária e a emissão de Notas de Empenho vinculadas aos itens dos seus contratos.'
            : role === 'Auditor'
            ? 'Audite a execução da Ação 8861, verificando o confronto de Notas de Empenho (NE), Liquidações (NS) e a conformidade dos limites anuais aprovados na LOA.'
            : 'Consulte os totais de dotação aprovada, empenhos emitidos e saldos orçamentários do exercício.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="orcamento-table"]',
          title: 'Tabelas Detalhadas das Linhas Orçamentárias',
          badge: 'Detalhamento Analítico',
          description: 'Tabelas analíticas completas discriminando individualmente: 1. Demandas do PCA (DFDs); 2. Processos em Planejamento (SEI); e 3. Contratos Vigentes de TIC com cálculo proporcional do exercício.',
          position: 'top'
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
          title: 'Macroprocesso e Esteira da Contratação',
          badge: 'Estágios Regulatórios',
          description: 'Visualizador interativo do fluxo composto pelas macroetapas da contratação de TIC da IN SGD/ME 94/2022: Estudos Técnicos (ETP), Termo de Referência (TR), Parecer CONJUR, Sessão Pública e Contratação Concluída.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="kanban-actions"]',
          title: 'Modelos de Fluxo, Busca e Criação de Tarefas',
          badge: 'Ações & Templates',
          description: role === 'GECTI' || role === 'Fiscal'
            ? 'Importe modelos de fluxo padronizados (DFD Comum, Licitação de TIC, Dispensa/Inexigibilidade), busque cards no quadro e cadastre novas tarefas com prazos e responsáveis.'
            : 'Consulte os modelos de fluxo e a distribuição das tarefas do processo em modo somente leitura.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="kanban-board"]',
          title: 'Quadro Kanban com Colunas de Execução',
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
          badge: 'Regra Legal de Reajuste',
          description: 'Conforme o Art. 92, V da Lei 14.133/2021, Decreto Federal nº 9.507/2018 e Acórdão 1.827/2008-TCU-Plenário, o interregno anual é ancorado exclusivamente na Data do Orçamento Estimado da contratação, gerando efeitos financeiros retroativos à data de aniversário.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="icti-calc-output"]',
          title: 'Memória de Cálculo e Minuta SEI',
          badge: 'Documentação & SEI',
          description: role === 'GECTI' || role === 'Fiscal'
            ? 'Confira o percentual acumulado, o valor do reajuste e clique no botão de copiar para transferir a memória de cálculo formatada diretamente para a minuta de Apostilamento no SEI.'
            : 'Confira a memória de cálculo do fator acumulado do ICTI, o acréscimo financeiro resultante e audite a conformidade dos parâmetros aplicados.',
          position: 'top'
        }
      ]
    },
    rastreabilidade: {
      id: 'rastreabilidade',
      title: 'Matriz de Rastreabilidade do Ciclo Contratual',
      description: `Auditoria e linhagem de ponta a ponta desde o PCA até a liquidação no SIOP para ${roleLabel}.`,
      iconName: 'Shuffle',
      steps: [
        {
          targetSelector: '[data-tour="rastreabilidade-content"]',
          title: 'Governança Integrada e Rastreabilidade Completa',
          badge: `Linhagem 360º (${roleLabel})`,
          description: 'Módulo de governança que interliga todos os elos do processo: DFD de origem (PCA), Processo SEI de Planejamento (ETP/TR), Instrumento Contratual formal, Termos Aditivos e Apostilamentos, Ordens de Serviço, Descentralizações (MPO ➔ MGI) e Execução Financeira SIOP.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="rastreabilidade-flow"]',
          title: 'Trilha Cronológica das 3 Macroetapas',
          badge: 'PCA ➔ SEI ➔ Contrato',
          description: 'Acompanhe visualmente o encadeamento das fases: Etapa Inicial (PCA e DFD cadastrado na UASG), Etapa Interna (Processo SEI com status regulatório da EPC) e Resultado (Instrumento contratual formalizado e vigente).',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="rastreabilidade-pdf"]',
          title: 'Emissão de Laudo e Relatório Oficial em PDF',
          badge: 'Relatório Oficial SOF',
          description: 'Gere instantaneamente o Relatório de Rastreabilidade Contratual formatado com layout oficial da SOF/MPO, consolidando todos os dados da contratação, histórico de OSs, repasses orçamentários e itens contratados para instrução processual no SEI ou resposta a auditorias.',
          position: 'left'
        }
      ]
    },
    presencial: {
      id: 'presencial',
      title: 'Escala Presencial GECTI (PGD)',
      description: `Gestão e consulta da agenda de trabalho presencial da equipe GECTI para ${roleLabel}.`,
      iconName: 'CalendarRange',
      steps: [
        {
          targetSelector: '[data-tour="presencial-header"]',
          title: 'Escala de Trabalho Presencial GECTI & PGD',
          badge: `Presencial GECTI (${roleLabel})`,
          description: role === 'GECTI'
            ? 'Painel de gestão da escala presencial dos servidores da Coordenação Geral de TI (GECTI). Permite planejar a escala semanal e mensal, acompanhar o cumprimento das metas do Programa de Gestão e Desempenho (PGD) e garantir cobertura no Ministério.'
            : 'Painel de consulta da agenda e presença física dos servidores da equipe GECTI no Ministério, facilitando o agendamento de reuniões presenciais, alinhamentos e despachos de processos.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="presencial-form"]',
          title: 'Agendamento de Dias Presenciais',
          badge: role === 'GECTI' ? 'Agendar Presença' : 'Formulário Restrito à GECTI',
          description: role === 'GECTI'
            ? 'Selecione o servidor da GECTI, marque a data desejada no seletor e registre a escala. O sistema atualiza o calendário e a contagem mensal de presenças automaticamente.'
            : 'O registro de novas presenças é restrito aos servidores e gestores da GECTI. Utilize o calendário ao lado para verificar a escala da equipe.',
          position: 'right'
        },
        {
          targetSelector: '[data-tour="presencial-calendar"]',
          title: 'Calendário e Histórico de Presenças do Mês',
          badge: 'Calendário & Métricas',
          description: 'Visualize a escala organizada por dias úteis, com indicadores de quantos servidores estarão presentes em cada data e total de presenças acumuladas no mês por colaborador.',
          position: 'left'
        }
      ]
    },
    normativos: {
      id: 'normativos',
      title: 'Normativos, Legislação de TIC & FAQ',
      description: `Repositório legal, modelos padronizados federais e dúvidas frequentes para ${roleLabel}.`,
      iconName: 'Scale',
      steps: [
        {
          targetSelector: '[data-tour="normativos-header"]',
          title: 'Repositório Normativo e Base de Conhecimento',
          badge: `Legislação & FAQ (${roleLabel})`,
          description: 'Acesse o acervo de legislação de contratações públicas de TIC (Lei 14.133/2021, IN SGD/ME nº 94/2022) e os modelos de contratação padronizados pelo Governo Digital (SGD/MGI).',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="normativos-tabs"]',
          title: 'Navegação por Abas: Legislação, FAQ e Calendário',
          badge: 'Seções da Base',
          description: 'Alterne entre as 3 sub-abas da base de conhecimento: "Normativos & Legislação" (dispositivos legais e modelos federais), "Perguntas Frequentes (FAQ)" (dúvidas práticas da equipe de contratações) e "Calendário de Prazos" (sessões públicas e vencimentos regulatórios).',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="normativos-content"]',
          title: 'Modelos Padronizados Federais da SGD/MGI',
          badge: 'Modelos SGD & SISP',
          description: role === 'GECTI' || role === 'Fiscal'
            ? 'Consulte os modelos oficiais da Secretaria de Governo Digital (Portaria 5.950/23 para Nuvem e Software; Portaria 2.715/23 para Estações de Trabalho). Como GECTI ou Fiscal, você também pode cadastrar novos normativos ou dúvidas no FAQ para padronizar o conhecimento da equipe.'
            : 'Consulte os modelos e diretrizes federais vigentes para apoiar suas análises e pareceres de conformidade em modo de leitura.',
          position: 'top'
        }
      ]
    }
  };

  // Se o usuário for Administrador GECTI, adicionamos o tutorial de Gestão de Usuários
  if (role === 'GECTI') {
    config.usuarios = {
      id: 'usuarios',
      title: 'Gestão de Usuários & Matriz de Direitos',
      description: 'Painel exclusivo de administração de servidores, permissões e auditoria de acessos para Administradores GECTI.',
      iconName: 'Users',
      steps: [
        {
          targetSelector: '[data-tour="usuarios-header"]',
          title: 'Painel de Gestão de Usuários Institucionais',
          badge: 'Exclusivo Administrador GECTI',
          description: 'Área restrita de governança e controle de segurança do CONTRATICS. Aqui a coordenação GECTI gerencia contas ativas, define perfis de acesso e audita os registros de autenticação de servidores.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="usuarios-matriz-btn"]',
          title: 'Matriz de Controles e Direitos de Segurança do Sistema',
          badge: 'Matriz de Permissões',
          description: 'Abre a matriz institucional completa de controles de segurança, demonstrando de forma transparente os direitos de criação, edição, exclusão e visualização de cada um dos 4 perfis (GECTI, Fiscal, Auditor, Visualizador) em todos os módulos da plataforma.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="usuarios-subtabs"]',
          title: 'Sub-abas: Diretório de Usuários vs Logs de Autenticação',
          badge: 'Gestão & Auditoria',
          description: 'Alterne entre o gerenciamento de servidores ativos (cadastro e alteração de perfis) e a auditoria em tempo real de logs de acesso ao sistema.',
          position: 'bottom'
        },
        {
          targetSelector: '[data-tour="usuarios-form"]',
          title: 'Cadastro e Reset de Senhas Provisórias',
          badge: 'Bcrypt & Senha Provisória',
          description: 'Cadastre novos servidores e defina o perfil institucional. Em caso de esquecimento de senha, o reset gera uma credencial provisória de primeiro acesso, exigindo que o próprio servidor cadastre sua senha definitiva no menu "Alterar Minha Senha". As credenciais são protegidas com hash criptográfico Bcrypt.',
          position: 'right'
        },
        {
          targetSelector: '[data-tour="usuarios-directory"]',
          title: 'Diretório de Servidores Ativos',
          badge: 'Contas & Edição',
          description: 'Audite a lista de todos os usuários cadastrados, consulte o perfil de cada um, edite permissões ou revogue acessos. O usuário raiz administrativo possui trava de proteção contra exclusão acidental.',
          position: 'left'
        },
        {
          targetSelector: '[data-tour="usuarios-logs"]',
          title: 'Auditoria de Logs de Autenticação',
          badge: 'Compliance & Auditoria de Acesso',
          description: 'Monitore todos os logins realizados no CONTRATICS com rastreio de IP, navegador, data/hora e status. Permite filtrar por perfil institucional, pesquisar por e-mail e exportar a planilha de logs para auditoria de compliance.',
          position: 'top'
        }
      ]
    };
  }

  return config;
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
    }
  }, [isOpen, tourId]);

  // Highlight element location measurement
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    const findAndMeasureTarget = () => {
      if (currentStep.targetSelector) {
        const el = document.querySelector(currentStep.targetSelector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
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
    const spaceLeft = targetRect.left;

    if (currentStep.position === 'right' && spaceRight > 420) {
      cardStyle = {
        position: 'fixed',
        top: Math.max(20, Math.min(window.innerHeight - 380, targetRect.top)),
        left: targetRect.right + 16,
        zIndex: 9999
      };
    } else if (currentStep.position === 'left' && spaceLeft > 420) {
      cardStyle = {
        position: 'fixed',
        top: Math.max(20, Math.min(window.innerHeight - 380, targetRect.top)),
        left: Math.max(16, targetRect.left - 440),
        zIndex: 9999
      };
    } else if (currentStep.position === 'top' && spaceAbove > 330) {
      cardStyle = {
        position: 'fixed',
        top: Math.max(20, targetRect.top - 330),
        left: Math.max(16, Math.min(window.innerWidth - 420, targetRect.left)),
        zIndex: 9999
      };
    } else if (spaceBelow > 320 || currentStep.position === 'bottom') {
      cardStyle = {
        position: 'fixed',
        top: Math.min(window.innerHeight - 340, Math.max(20, targetRect.bottom + 16)),
        left: Math.max(16, Math.min(window.innerWidth - 420, targetRect.left)),
        zIndex: 9999
      };
    } else {
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

  const toursList = (Object.values(toursConfig) as TourDefinition[]).filter(t => {
    // Se o tour for exclusivo de GECTI e o usuário não for GECTI, não exibe
    if (t.id === 'usuarios' && userRole !== 'GECTI') return false;
    return true;
  });

  const filteredTours = toursList.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTourIcon = (iconName: string) => {
    switch (iconName) {
      case 'Compass': return Compass;
      case 'FileText': return FileText;
      case 'Layers': return Layers;
      case 'Handshake': return Handshake;
      case 'DollarSign': return DollarSign;
      case 'ListTodo': return ListTodo;
      case 'Calculator': return Calculator;
      case 'Shuffle': return Shuffle;
      case 'CalendarRange': return CalendarRange;
      case 'Scale': return Scale;
      case 'Users': return Users;
      default: return BookOpen;
    }
  };

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
                <span>Tutorial Guiado & Central de Treinamento</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                  Interativo
                </span>
              </h3>
              <p className="text-xs text-on-surface-variant">
                Explore os tutoriais interativos passo a passo adaptados para o perfil <strong>{roleName}</strong>.
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
              <p className="text-xs text-on-surface-variant">Selecione uma ferramenta ou módulo específico para realizar o treinamento guiado.</p>
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

              const Icon = getTourIcon(t.iconName);

              return (
                <div
                  key={t.id}
                  className="bg-surface-container-low border border-outline-variant/50 hover:border-amber-500/50 rounded-xl p-4 space-y-3 transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {t.steps.length} Passos
                        </span>
                      </div>
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
              <span>Como funcionam as permissões e instruções personalizadas por perfil?</span>
            </h5>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              O sistema CONTRATICS adapta os textos de cada tutorial para o perfil conectado (<strong>{roleName}</strong>). Cada tela destaca exatamente as permissões, módulos, alçadas de ação e responsabilidades do seu perfil institucional, assegurando conformidade com as diretrizes de governança da SOF/MPO.
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
