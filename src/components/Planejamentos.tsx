/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Planejamento, 
  TarefaPlanejamento, 
  HistoricoPlanejamento, 
  Contrato, 
  StatusPlanejamento, 
  PCAType, 
  User, 
  ProcessTemplate,
  DFD,
  ItemPlanejamentoSOF
} from '../types';
import { formatCurrency, formatDate, formatDateTime, isModifiedRecently, parseMonetaryValue } from '../utils';
import KanbanBoard from './KanbanBoard';
import BpmnFlowBoard from './BpmnFlowBoard';
import ItensPlanejamentoSOFPanel from './ItensPlanejamentoSOFPanel';
import { CurrencyInput } from './CurrencyInput';
import { ReUIBadge, ReUIStepper } from './ReUI';
import { CopyButton, CopyableText } from './CopyButton';
import { 
  Plus, 
  Layers, 
  Calendar, 
  Eye, 
  Edit, 
  Trash2, 
  ArrowLeft, 
  Link2, 
  PlusCircle, 
  X, 
  UserCheck, 
  Clock, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Download,
  Shuffle,
  FileText,
  TrendingUp,
  ShieldAlert,
  Wallet,
  ListTodo,
  Users,
  ShieldCheck,
  FileCheck,
  User as UserIcon,
  DollarSign,
  CheckCircle,
  FileSignature,
  HelpCircle
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';

interface PlanejamentosProps {
  planejamentos: Planejamento[];
  tarefas: TarefaPlanejamento[];
  historicos: HistoricoPlanejamento[];
  contratos: Contrato[];
  currentUser: User;
  currentLocalTime: string;
  onAddPlanejamento: (newPlan: Planejamento) => void;
  onEditPlanejamento: (updatedPlan: Planejamento) => void;
  onDeletePlanejamento: (id: string) => void;
  onAddTarefa: (newTarefa: TarefaPlanejamento) => void;
  onUpdateTarefa: (updatedTarefa: TarefaPlanejamento) => void;
  onDeleteTarefa: (id: string) => void;
  onAddHistoricoPlan: (newHist: HistoricoPlanejamento) => void;
  onUpdateHistoricoPlan: (updatedHist: HistoricoPlanejamento) => void;
  onDeleteHistoricoPlan: (id: string) => void;
  templates: ProcessTemplate[];
  onUpdateTemplates: (updatedTemplates: ProcessTemplate[]) => void;
  onNavigateToContract: (numContrato: string) => void;
  dfds?: DFD[];
  onViewLineage?: (id: string, type: 'dfd' | 'planejamento' | 'contrato') => void;
  itensPlanejamentoSOF?: ItemPlanejamentoSOF[];
  onAddItemPlanejamentoSOF?: (newItem: ItemPlanejamentoSOF) => void;
  onEditItemPlanejamentoSOF?: (updatedItem: ItemPlanejamentoSOF) => void;
  onDeleteItemPlanejamentoSOF?: (id: string) => void;
  onStartTour?: (tourId: string) => void;
  completedTours?: string[];
  initialSelectedPlanId?: string | null;
}

export default function Planejamentos({
  planejamentos,
  tarefas,
  historicos,
  contratos,
  currentUser,
  currentLocalTime,
  onAddPlanejamento,
  onEditPlanejamento,
  onDeletePlanejamento,
  onAddTarefa,
  onUpdateTarefa,
  onDeleteTarefa,
  onAddHistoricoPlan,
  onUpdateHistoricoPlan,
  onDeleteHistoricoPlan,
  templates,
  onUpdateTemplates,
  onNavigateToContract,
  dfds = [],
  onViewLineage,
  itensPlanejamentoSOF = [],
  onAddItemPlanejamentoSOF = () => {},
  onEditItemPlanejamentoSOF = () => {},
  onDeleteItemPlanejamentoSOF = () => {},
  onStartTour,
  completedTours = [],
  initialSelectedPlanId = null
}: PlanejamentosProps) {
  // Navigation / Detailing States
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(initialSelectedPlanId);

  useEffect(() => {
    if (initialSelectedPlanId) {
      setSelectedPlanId(initialSelectedPlanId);
    }
  }, [initialSelectedPlanId]);
  
  // Dynamic calculation helper for Estimativa de Custo
  const getPlanningCusto = (p: Planejamento) => {
    const items = (itensPlanejamentoSOF || []).filter(i => i.Processo_SEI === p.SEI_Processo && i.Status_Item === 'Ativo');
    if (items.length > 0) {
      return items.reduce((acc, current) => acc + (current.Quantidade * current.Valor_Unitario), 0);
    }
    return p.Estimativa_Custo || 0;
  };

  const getPlanningCusteioInvestimento = (p: Planejamento) => {
    const val = getPlanningCusto(p);
    const activeItems = (itensPlanejamentoSOF || []).filter(i => 
      i.Processo_SEI === p.SEI_Processo && 
      i.Status_Item === 'Ativo'
    );
    
    if (activeItems.length > 0) {
      const itemCusteioSum = activeItems
        .filter(i => !i.Natureza_Despesa || i.Natureza_Despesa === 'Custeio')
        .reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
      const itemInvestimentoSum = activeItems
        .filter(i => i.Natureza_Despesa === 'Investimento')
        .reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
      
      const totalItemSum = itemCusteioSum + itemInvestimentoSum;
      if (totalItemSum > 0) {
        return { 
          custeio: val * (itemCusteioSum / totalItemSum), 
          investimento: val * (itemInvestimentoSum / totalItemSum) 
        };
      }
    }

    // Look up linked DFD ratio
    const linkedDfd = dfds.find(d => d.id === p.DFD_PNCP || d.Num_DFD === p.DFD_PNCP);
    if (linkedDfd) {
      const totalProp = (linkedDfd.Valor_Custeio || 0) + (linkedDfd.Valor_Investimento || 0);
      if (totalProp > 0) {
        return { 
          custeio: val * ((linkedDfd.Valor_Custeio || 0) / totalProp), 
          investimento: val * ((linkedDfd.Valor_Investimento || 0) / totalProp) 
        };
      }
    }

    // Fallback: check GND or Natureza do Objeto specified on the process
    const isInvestimento = p.GND?.includes('4') || p.GND?.toLowerCase().includes('investimento') || (p.Natureza_Objeto as string) === 'Equipamento';
    if (isInvestimento) {
      return { custeio: 0, investimento: val };
    }
    return { custeio: val, investimento: 0 };
  };
  const [activeSubTab, setActiveSubTab] = useState<'historico' | 'tarefas' | 'itens-sof'>('historico');

  // Form Modals
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isHistModalOpen, setIsHistModalOpen] = useState(false);
  const [planFormMode, setPlanFormMode] = useState<'create' | 'edit'>('create');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusPlanejamento[]>(['Seleção Fornecedor', 'Em Elaboração', 'Gerou Contrato']);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Sorting configurations
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortKey, sortDirection]);

  // Local Form structures
  const [planFormData, setPlanFormData] = useState<Partial<Planejamento>>({
    DFD_PNCP: '',
    Data_Inicio_Processo_SEI: '',
    Objeto: '',
    SEI_Processo: '',
    Portaria_Equipe_PC_Numero: '',
    Portaria_Equipe_PC_SEI: '',
    Int_Requisitante: '',
    Int_Requisitante_Subst: '',
    Int_Tecnico: '',
    Int_Tecnico_Subst: '',
    Int_Administrativo: '',
    Int_Administrativo_Subst: '',
    Estimativa_Custo: 0,
    Status_Planejamento: 'Em Elaboração',
    Contrato_Originado: '',
    Data_Sessao_Publica: '',
    Link_Sessao: '',
    PCA: 'MPO',
    Ano_PCA_Vinculado: new Date(currentLocalTime).getFullYear().toString(),
    Tipo_Processo: 'Pregão SOF',
    Natureza_Objeto: 'Serviço',
    GND: '3 - Custeio',
  });

  const [histFormData, setHistFormData] = useState<Partial<HistoricoPlanejamento>>({
    Data: '',
    Descricao: '',
    Num_SEI: '',
    Coordenacao: 'GECTI / SOF',
  });
  const [editingHistId, setEditingHistId] = useState<string | null>(null);

  // Custom delete confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'planejamento' | 'historico' | null;
    id: string;
    extraName?: string;
  }>({
    isOpen: false,
    type: null,
    id: '',
  });

  // Status handlers
  const handleStatusCheck = (status: StatusPlanejamento) => {
    if (statusFilter.includes(status)) {
      setStatusFilter(statusFilter.filter(s => s !== status));
    } else {
      setStatusFilter([...statusFilter, status]);
    }
  };

  const clearFilters = () => {
    setStatusFilter(['Seleção Fornecedor', 'Em Elaboração', 'Gerou Contrato']);
    setSearchQuery('');
  };

  // Status priority hierarchy: 1. Seleção Fornecedor -> 2. Em Elaboração -> 3. Gerou Contrato -> 4. Arquivado
  const STATUS_PRIORITY_ORDER: Record<string, number> = {
    'Seleção Fornecedor': 1,
    'Em Elaboração': 2,
    'Gerou Contrato': 3,
    'Arquivado': 4,
  };

  // Helper to extract insertion timestamp for chronological ordering
  const getPlanningInsertionTimestamp = (p: Planejamento): number => {
    if (p.Data_Inicio_Processo_SEI) {
      const t = new Date(p.Data_Inicio_Processo_SEI).getTime();
      if (!isNaN(t)) return t;
    }
    if (p.id && p.id.startsWith('plan-')) {
      const num = Number(p.id.replace('plan-', ''));
      if (!isNaN(num)) return num;
    }
    if (p.updatedAt) {
      const t = new Date(p.updatedAt).getTime();
      if (!isNaN(t)) return t;
    }
    const idx = planejamentos.indexOf(p);
    return idx !== -1 ? idx : 0;
  };

  // Filter planning
  const filteredPlans = planejamentos.filter(p => {
    const matchesStatus = statusFilter.includes(p.Status_Planejamento);
    const matchesSearch = searchQuery === '' || 
      p.SEI_Processo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.Objeto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.Tipo_Processo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.Int_Requisitante.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Computations for Processes "Em Elaboração" Risk & Financial Forecast
  const emElaboracaoPlans = planejamentos.filter(p => p.Status_Planejamento === 'Em Elaboração');
  const totalCusteioEmElaboracao = emElaboracaoPlans.reduce((acc, p) => acc + getPlanningCusteioInvestimento(p).custeio, 0);
  const totalInvestimentoEmElaboracao = emElaboracaoPlans.reduce((acc, p) => acc + getPlanningCusteioInvestimento(p).investimento, 0);
  const totalGeralEmElaboracao = totalCusteioEmElaboracao + totalInvestimentoEmElaboracao;

  const pctCusteioEmElaboracao = totalGeralEmElaboracao > 0 ? (totalCusteioEmElaboracao / totalGeralEmElaboracao) * 100 : 0;
  const pctInvestimentoEmElaboracao = totalGeralEmElaboracao > 0 ? (totalInvestimentoEmElaboracao / totalGeralEmElaboracao) * 100 : 0;

  const chartDataEmElaboracao = [
    { name: 'Custeio (GND 3)', value: totalCusteioEmElaboracao, color: '#14b8a6' },
    { name: 'Investimento (GND 4)', value: totalInvestimentoEmElaboracao, color: '#a855f7' }
  ];

  const sortedPlans = useMemo(() => {
    return [...filteredPlans].sort((a, b) => {
      if (!sortKey) {
        // Ordenação Padrão:
        // 1º Status na ordem: "Seleção Fornecedor" -> "Em Elaboração" -> "Gerou Contrato" -> "Arquivado"
        const priorityA = STATUS_PRIORITY_ORDER[a.Status_Planejamento] || 99;
        const priorityB = STATUS_PRIORITY_ORDER[b.Status_Planejamento] || 99;
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        // 2º Ordenar por data de inserção
        const timeA = getPlanningInsertionTimestamp(a);
        const timeB = getPlanningInsertionTimestamp(b);
        if (timeA !== timeB) {
          return timeA - timeB;
        }

        // 3º Desempate estável
        const idxA = planejamentos.indexOf(a);
        const idxB = planejamentos.indexOf(b);
        return idxA - idxB;
      }

      if (sortKey === 'Status_Planejamento') {
        const priorityA = STATUS_PRIORITY_ORDER[a.Status_Planejamento] || 99;
        const priorityB = STATUS_PRIORITY_ORDER[b.Status_Planejamento] || 99;
        if (priorityA !== priorityB) {
          return sortDirection === 'asc' ? priorityA - priorityB : priorityB - priorityA;
        }
        const timeA = getPlanningInsertionTimestamp(a);
        const timeB = getPlanningInsertionTimestamp(b);
        return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }

      let valA: any;
      let valB: any;

      if (sortKey === 'Estimativa_Custo') {
        valA = getPlanningCusto(a);
        valB = getPlanningCusto(b);
      } else {
        valA = a[sortKey as keyof Planejamento];
        valB = b[sortKey as keyof Planejamento];
      }

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB, 'pt-BR', { numeric: true }) 
          : valB.localeCompare(valA, 'pt-BR', { numeric: true });
      }
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        return sortDirection === 'asc' 
          ? (valA === valB ? 0 : valA ? -1 : 1)
          : (valA === valB ? 0 : valA ? 1 : -1);
      }

      const strA = String(valA);
      const strB = String(valB);
      return sortDirection === 'asc' 
        ? strA.localeCompare(strB, 'pt-BR', { numeric: true }) 
        : strB.localeCompare(strA, 'pt-BR', { numeric: true });
    });
  }, [filteredPlans, sortKey, sortDirection, planejamentos]);

  const totalPlans = filteredPlans.length;
  const totalPlanPages = Math.ceil(totalPlans / rowsPerPage);
  const paginatedPlans = sortedPlans.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const pageNumbers = [];
  for (let i = 1; i <= totalPlanPages; i++) {
    pageNumbers.push(i);
  }

  const exportPlanejamentosToPDF = () => {
    const totalEstimadoCusto = filteredPlans.reduce((acc, current) => acc + getPlanningCusto(current), 0);

    const SOF_LOGO_SVG = `
      <svg width="220" height="70" viewBox="0 0 240 80" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
        <!-- Official Government Globe Icon -->
        <g transform="translate(10, 10)">
          <!-- Blue background globe sphere -->
          <circle cx="30" cy="30" r="28" fill="#1E3A8A" />
          
          <!-- Curved meridians for globe effect -->
          <path d="M 30,2 A 28,28 0 0,0 30,58 Z" stroke="#3B82F6" stroke-width="1.5" stroke-dasharray="2,2" opacity="0.6"/>
          <path d="M 12,12 A 28,28 0 0,0 48,12" stroke="#3B82F6" stroke-width="1" opacity="0.4"/>
          <path d="M 4,22 A 28,28 0 0,0 56,22" stroke="#3B82F6" stroke-width="1.5" opacity="0.5"/>
          <path d="M 2,30 A 28,28 0 0,0 58,30" stroke="#3B82F6" stroke-width="1.5" opacity="0.5"/>
          <path d="M 4,38 A 28,28 0 0,0 56,38" stroke="#3B82F6" stroke-width="1.5" opacity="0.5"/>
          <path d="M 12,48 A 28,28 0 0,0 48,48" stroke="#3B82F6" stroke-width="1" opacity="0.4"/>

          <!-- Stylized Brazil Green/Yellow Ribbon sweep -->
          <path d="M 2,36 C 15,36 28,24 58,24 C 54,36 30,48 2,36 Z" fill="#22C55E" opacity="0.85" />
          <path d="M 2,33 C 15,33 28,21 58,21 C 56,25 35,37 2,33 Z" fill="#EAB308" />

          <!-- Elegant white federal star representing federal capital -->
          <polygon points="30,14 31.8,18 36,18 32.5,21.2 33.8,25.2 30,22.8 26.2,25.2 27.5,21.2 24,18 28.2,18" fill="#FFFFFF" />
        </g>
        
        <!-- Text Logo on Right -->
        <text x="80" y="44" font-family="'Inter', -apple-system, sans-serif" font-weight="800" font-size="34" fill="#1F2937" letter-spacing="-1">SOF</text>
        <text x="80" y="58" font-family="'Inter', -apple-system, sans-serif" font-weight="500" font-size="11" fill="#4B5563">Secretaria de</text>
        <text x="80" y="70" font-family="'Inter', -apple-system, sans-serif" font-weight="700" font-size="11" fill="#1E3A8A">Orçamento Federal</text>
      </svg>
    `;

    const htmlContent = `
      <html>
        <head>
          <title>Relatório de Planejamento de Contratações</title>
          <style>
            body {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              color: #0f172a;
              padding: 40px;
              margin: 0;
              background-color: #ffffff;
            }
            .header {
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header-top {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 20px;
            }
            .title-section {
              display: flex;
              align-items: center;
              gap: 20px;
            }
            .logo-placeholder {
              flex-shrink: 0;
            }
            .title {
              font-size: 24px;
              font-weight: 700;
              color: #0f172a;
              margin: 0;
            }
            .subtitle {
              font-size: 14px;
              color: #64748b;
              margin: 4px 0 0 0;
            }
            .meta-info {
              font-size: 11px;
              color: #64748b;
              text-align: right;
              line-height: 1.5;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-bottom: 30px;
            }
            .stat-card {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 16px;
            }
            .stat-label {
              font-size: 11px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .stat-value {
              font-size: 18px;
              font-weight: 700;
              color: #0f172a;
              margin-top: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            tr {
              page-break-inside: avoid;
            }
            th {
              background-color: #f1f5f9;
              color: #475569;
              font-weight: 600;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 10px 12px;
              border-bottom: 2px solid #cbd5e1;
              text-align: left;
            }
            td {
              padding: 10px 12px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 12px;
              color: #334155;
              vertical-align: top;
            }
            .font-mono {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            }
            .text-right {
              text-align: right;
            }
            .status {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 10px;
              font-weight: 600;
              text-align: center;
            }
            .status-elaboracao {
              background-color: #fef3c7;
              color: #d97706;
            }
            .status-selecao {
              background-color: #e0f2fe;
              color: #0369a1;
            }
            .status-contrato {
              background-color: #d1fae5;
              color: #065f46;
            }
            @media print {
              body {
                padding: 20px;
              }
              @page {
                size: A4 landscape;
                margin: 1.2cm;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <div class="title-section">
                <div class="logo-placeholder">
                  <img src="${window.location.origin}/sof-logo.png" id="sof-image-logo" style="height: 54px; width: auto; display: none;" onload="this.style.display='block'; document.getElementById('sof-svg-logo').style.display='none';" onerror="this.style.display='none'; document.getElementById('sof-svg-logo').style.display='block';" />
                  <div id="sof-svg-logo">
                    ${SOF_LOGO_SVG}
                  </div>
                </div>
                <div>
                  <h1 class="title">CONTRATICS - PLANEJAMENTOS</h1>
                  <h2 class="subtitle">Relatório dos Processos de Instrução e Planejamento de TIC</h2>
                </div>
              </div>
              <div class="meta-info">
                <div><strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}</div>
                <div><strong>Filtros:</strong> Busca: "${searchQuery || 'Todos'}" | Status: ${statusFilter.join(', ')}</div>
              </div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Processos Filtrados</div>
              <div class="stat-value">${filteredPlans.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Custo Estimado Consolidado</div>
              <div class="stat-value font-mono">R$ ${totalEstimadoCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label font-sans">Setor Responsável</div>
              <div class="stat-value">CSTI / GECTI</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 15%">Processo SEI</th>
                <th style="width: 32%">Objeto / Requisitante</th>
                <th style="width: 15%">Modalidade / DFD PCA</th>
                <th style="width: 13%">Data de Início</th>
                <th style="width: 15%" class="text-right font-mono">Custo Estimado (R$)</th>
                <th style="width: 10%">Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredPlans.map(plan => `
                <tr>
                  <td class="font-mono" style="font-weight: 700; color: #1e40af;">${plan.SEI_Processo}</td>
                  <td>
                    <div style="font-weight: 600;">${plan.Objeto}</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 3px;">
                      Requisitante: ${plan.Int_Requisitante || 'N/A'}${plan.Int_Requisitante_Subst ? ` (Subst: ${plan.Int_Requisitante_Subst})` : ''} 
                    </div>
                  </td>
                  <td>
                    <div><strong>${plan.Tipo_Processo}</strong> <span style="background-color: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; font-size: 9px; padding: 1px 4px; border-radius: 4px; margin-left: 4px; font-weight: 500;">${plan.Natureza_Objeto || 'Serviço'}</span></div>
                    ${plan.DFD_PNCP ? `<div style="font-size: 10px; color: #0284c7; font-weight: 500; font-family: monospace; margin-top: 2px;">DFD PCA: ${plan.DFD_PNCP}</div>` : ''}
                  </td>
                  <td class="font-mono">
                    ${plan.Data_Inicio_Processo_SEI ? new Date(plan.Data_Inicio_Processo_SEI).toLocaleDateString('pt-BR') : 'N/A'}
                  </td>
                  <td class="font-mono text-right" style="font-weight: 600; color: #0f766e;">
                    R$ ${getPlanningCusto(plan).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td>
                    <span class="status ${
                      plan.Status_Planejamento === 'Em Elaboração' ? 'status-elaboracao' : 
                      plan.Status_Planejamento === 'Seleção Fornecedor' ? 'status-selecao' : 'status-contrato'
                    }">${plan.Status_Planejamento || 'Em Elaboração'}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }
    
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 500);
    }
  };

  // Selected Plan Data
  const selectedPlan = planejamentos.find(p => p.id === selectedPlanId);
  const selectedPlanHistoricos = selectedPlan 
    ? [...historicos.filter(h => h.Processo_SEI === selectedPlan.SEI_Processo)].sort(
        (a, b) => new Date(b.Data).getTime() - new Date(a.Data).getTime()
      )
    : [];

  const handlePlanFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setPlanFormData(prev => {
      const updated = { ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value };
      
      // Automatic rule: if contract origin is set, flip Status to "Gerou Contrato" automatically
      if (name === 'Contrato_Originado') {
        if (value && value !== '') {
          updated.Status_Planejamento = 'Gerou Contrato';
        } else {
          updated.Status_Planejamento = 'Seleção Fornecedor';
        }
      }
      return updated;
    });
  };

  const handleCreateOrEditPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role === 'Visualizador') {
      alert('Seu perfil de "Visualizador" não permite cadastrar ou alterar planejamentos.');
      return;
    }

    const cleanCost = typeof planFormData.Estimativa_Custo === 'number' 
      ? planFormData.Estimativa_Custo 
      : parseMonetaryValue(planFormData.Estimativa_Custo);

    if (!planFormData.SEI_Processo || !planFormData.Objeto || cleanCost < 0) {
      alert('Por favor preencha os campos obrigatórios (Nº SEI, Objeto de Contratação, Custo).');
      return;
    }

    if (planFormMode === 'create') {
      const isDuplicated = planejamentos.some(p => p.SEI_Processo === planFormData.SEI_Processo);
      if (isDuplicated) {
        alert('Já existe um processo cadastrado com este Número SEI.');
        return;
      }

      const newPlan: Planejamento = {
        id: `plan-${Date.now()}`,
        DFD_PNCP: planFormData.DFD_PNCP || 'Mapeamento Manual',
        Data_Inicio_Processo_SEI: planFormData.Data_Inicio_Processo_SEI || new Date(currentLocalTime).toISOString(),
        Objeto: planFormData.Objeto!,
        SEI_Processo: planFormData.SEI_Processo!,
        Portaria_Equipe_PC_Numero: planFormData.Portaria_Equipe_PC_Numero || 'Em Definição',
        Portaria_Equipe_PC_SEI: planFormData.Portaria_Equipe_PC_SEI || 'Instrução Inicial',
        Int_Requisitante: planFormData.Int_Requisitante || '',
        Int_Requisitante_Subst: planFormData.Int_Requisitante_Subst || '',
        Int_Tecnico: planFormData.Int_Tecnico || '',
        Int_Tecnico_Subst: planFormData.Int_Tecnico_Subst || '',
        Int_Administrativo: planFormData.Int_Administrativo || '',
        Int_Administrativo_Subst: planFormData.Int_Administrativo_Subst || '',
        Estimativa_Custo: cleanCost,
        Status_Planejamento: (planFormData.Contrato_Originado ? 'Gerou Contrato' : planFormData.Status_Planejamento) as StatusPlanejamento,
        Contrato_Originado: planFormData.Contrato_Originado || undefined,
        Data_Sessao_Publica: planFormData.Data_Sessao_Publica || '',
        Link_Sessao: planFormData.Link_Sessao || '',
        PCA: planFormData.PCA as PCAType,
        Ano_PCA_Vinculado: planFormData.Ano_PCA_Vinculado || new Date(currentLocalTime).getFullYear().toString(),
        Tipo_Processo: planFormData.Tipo_Processo || 'Pregão SOF',
        Natureza_Objeto: planFormData.Natureza_Objeto || 'Serviço',
        GND: planFormData.GND || '3 - Custeio',
        updatedAt: new Date(currentLocalTime).toISOString(),
      };
      onAddPlanejamento(newPlan);
    } else {
      // Edit
      const originalPlan = planejamentos.find(p => p.id === planFormData.id);
      const updatedPlan: Planejamento = {
        ...(originalPlan || {}),
        ...planFormData,
        Estimativa_Custo: cleanCost,
        Status_Planejamento: (planFormData.Contrato_Originado ? 'Gerou Contrato' : planFormData.Status_Planejamento) as StatusPlanejamento,
        updatedAt: new Date(currentLocalTime).toISOString(),
      } as Planejamento;
      onEditPlanejamento(updatedPlan);

      // Sincronizar itens vinculados no SOF caso existam
      const targetSEI = originalPlan ? originalPlan.SEI_Processo : updatedPlan.SEI_Processo;
      const allPlanItems = (itensPlanejamentoSOF || []).filter(
        i => i.Processo_SEI === targetSEI
      );
      const activePlanItems = allPlanItems.filter(i => i.Status_Item === 'Ativo');

      if (activePlanItems.length === 1 && onEditItemPlanejamentoSOF) {
        const singleItem = activePlanItems[0];
        const newUnitValue = singleItem.Quantidade > 0 ? (cleanCost / singleItem.Quantidade) : cleanCost;
        onEditItemPlanejamentoSOF({
          ...singleItem,
          Processo_SEI: updatedPlan.SEI_Processo,
          Valor_Unitario: newUnitValue,
        });
      } else if (activePlanItems.length > 1 && onEditItemPlanejamentoSOF) {
        const currentSum = activePlanItems.reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
        if (currentSum > 0) {
          const ratio = cleanCost / currentSum;
          activePlanItems.forEach(item => {
            onEditItemPlanejamentoSOF({
              ...item,
              Processo_SEI: updatedPlan.SEI_Processo,
              Valor_Unitario: item.Valor_Unitario * ratio,
            });
          });
        } else {
          const share = cleanCost / activePlanItems.length;
          activePlanItems.forEach(item => {
            const qty = item.Quantidade > 0 ? item.Quantidade : 1;
            onEditItemPlanejamentoSOF({
              ...item,
              Processo_SEI: updatedPlan.SEI_Processo,
              Valor_Unitario: share / qty,
            });
          });
        }
      }

      // If SEI changed, also update inactive items SEI
      if (originalPlan && originalPlan.SEI_Processo !== updatedPlan.SEI_Processo && onEditItemPlanejamentoSOF) {
        const inactiveItems = allPlanItems.filter(i => i.Status_Item !== 'Ativo');
        inactiveItems.forEach(item => {
          onEditItemPlanejamentoSOF({
            ...item,
            Processo_SEI: updatedPlan.SEI_Processo,
          });
        });
      }
    }

    setIsPlanModalOpen(false);
  };

  const handleStartEditPlan = (plan: Planejamento) => {
    setPlanFormMode('edit');
    const effectiveCost = getPlanningCusto(plan);
    setPlanFormData({
      ...plan,
      Estimativa_Custo: effectiveCost,
    });
    setIsPlanModalOpen(true);
  };

  const handleDeletePlan = (planId: string, planName: string) => {
    if (currentUser.role === 'Visualizador') {
      alert('Operação negada: Fiscais visualizadores não podem apagar processos de contratação.');
      return;
    }

    setDeleteConfirm({
      isOpen: true,
      type: 'planejamento',
      id: planId,
      extraName: planName,
    });
  };

  const handleExecuteDelete = () => {
    const { type, id } = deleteConfirm;
    if (type === 'planejamento') {
      onDeletePlanejamento(id);
      if (selectedPlanId === id) setSelectedPlanId(null);
    } else if (type === 'historico') {
      onDeleteHistoricoPlan(id);
    }
    setDeleteConfirm({ isOpen: false, type: null, id: '' });
  };

  // History Actions inside Detailing screen
  const handleOpenNewHistModal = () => {
    setEditingHistId(null);
    setHistFormData({
      Data: new Date(currentLocalTime).toISOString().slice(0, 16),
      Descricao: '',
      Num_SEI: '',
      Coordenacao: 'GECTI / SOF',
    });
    setIsHistModalOpen(true);
  };

  const handleOpenEditHistModal = (hist: HistoricoPlanejamento) => {
    setEditingHistId(hist.id);
    setHistFormData({
      ...hist,
      Data: hist.Data.slice(0, 16)
    });
    setIsHistModalOpen(true);
  };

  const handleSaveHist = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role === 'Visualizador') {
      alert('Operação negada para visualizadores.');
      return;
    }

    if (!selectedPlan) return;

    if (editingHistId) {
      // update
      const updatedHist: HistoricoPlanejamento = {
        id: editingHistId,
        Processo_SEI: selectedPlan.SEI_Processo,
        Data: new Date(histFormData.Data!).toISOString(),
        Descricao: histFormData.Descricao!,
        Num_SEI: histFormData.Num_SEI || 'Fase de Saneamento',
        Coordenacao: histFormData.Coordenacao!,
      };
      onUpdateHistoricoPlan(updatedHist);
    } else {
      // create
      const newHist: HistoricoPlanejamento = {
        id: `histp-${Date.now()}`,
        Processo_SEI: selectedPlan.SEI_Processo,
        Data: new Date(histFormData.Data! || currentLocalTime).toISOString(),
        Descricao: histFormData.Descricao!,
        Num_SEI: histFormData.Num_SEI || 'Instrução SEI',
        Coordenacao: histFormData.Coordenacao!,
      };
      onAddHistoricoPlan(newHist);
    }

    setIsHistModalOpen(false);
  };

  const handleDeleteHist = (id: string) => {
    if (currentUser.role === 'Visualizador') return;
    setDeleteConfirm({
      isOpen: true,
      type: 'historico',
      id: id,
    });
  };

  return (
    <div className="space-y-6" id="planejamentos-section" data-tour="plan-header">
      {/* If detailed flow is NOT selected, show list screen */}
      {!selectedPlanId ? (
        <>
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <nav className="flex items-center gap-2 text-on-surface-variant mb-1 text-xs uppercase tracking-wider">
                <span>Instrução Processual</span>
                <span>&gt;</span>
                <span className="text-primary font-medium">Processos SEI</span>
              </nav>
              <h2 className="text-2xl font-bold text-on-surface tracking-tight">Planejamento de Contratações</h2>
              <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                Processos de planejamento de contratações abertas no SEI, considerando os processos próprios (SOF) e os processos do ColaboraGov
              </p>
            </div>
            
            <div className="flex items-center gap-2.5">
              <button
                onClick={exportPlanejamentosToPDF}
                className="flex items-center gap-2 px-3 py-2 border border-outline-variant/60 rounded-lg text-xs bg-surface-container hover:text-primary transition-all cursor-pointer font-semibold"
              >
                <Download className="w-4 h-4 text-primary" />
                Exportar PDF
              </button>
              <button
                onClick={() => {
                  setPlanFormMode('create');
                  setPlanFormData({
                    DFD_PNCP: '',
                    Data_Inicio_Processo_SEI: new Date(currentLocalTime).toISOString().split('T')[0],
                    Objeto: '',
                    SEI_Processo: '',
                    Portaria_Equipe_PC_Numero: '',
                    Portaria_Equipe_PC_SEI: '',
                    Int_Requisitante: '',
                    Int_Requisitante_Subst: '',
                    Int_Tecnico: '',
                    Int_Tecnico_Subst: '',
                    Int_Administrativo: '',
                    Int_Administrativo_Subst: '',
                    Estimativa_Custo: 0,
                    Status_Planejamento: 'Em Elaboração',
                    Contrato_Originado: '',
                    Data_Sessao_Publica: '',
                    Link_Sessao: '',
                    PCA: 'MPO',
                    Ano_PCA_Vinculado: new Date(currentLocalTime).getFullYear().toString(),
                    Tipo_Processo: 'Pregão SOF',
                    Natureza_Objeto: 'Serviço',
                    GND: '3 - Custeio',
                  });
                  setIsPlanModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 border border-primary/30 rounded-lg text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-all cursor-pointer font-medium"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Processo SEI
              </button>
            </div>
          </div>

          {/* Card de Análise de Risco & Previsão de Investimentos/Custeio (Processos "Em Elaboração") */}
          <div className="bg-surface-container-low border border-outline-variant/80 rounded-2xl p-5 md:p-6 shadow-sm space-y-5">
            {/* Top Bar of Risk Card */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-outline-variant/40 pb-4">
              <div className="flex items-start md:items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5 md:mt-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-on-surface tracking-tight">
                      Previsão Orçamentária & Gráfico de Risco — Processos "Em Elaboração"
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                      {emElaboracaoPlans.length} {emElaboracaoPlans.length === 1 ? 'Processo em Instrução' : 'Processos em Instrução'}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                    Acompanhamento do volume de recursos em Custeio (GND 3) e Investimento (GND 4) das contratações em planejamento no momento.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start lg:self-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant/50 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                  Ação 8861 SIOP / SOF
                </span>
              </div>
            </div>

            {/* Content Grid: Stats Cards & Donut Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              
              {/* Stat Cards Column (8 cols) */}
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* Total geral card */}
                <div className="bg-surface-container/70 border border-outline-variant/60 rounded-xl p-4 space-y-2 relative overflow-hidden group hover:border-amber-500/40 transition-all">
                  <div className="flex items-center justify-between text-on-surface-variant">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total em Elaboração</span>
                    <Wallet className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-lg md:text-xl font-extrabold text-on-surface font-mono tracking-tight">
                    R$ {formatCurrency(totalGeralEmElaboracao)}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 font-medium pt-1 border-t border-outline-variant/30">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Demandas Ativas em Planejamento</span>
                  </div>
                </div>

                {/* Total Custeio (GND 3) card */}
                <div className="bg-teal-500/5 border border-teal-500/20 rounded-xl p-4 space-y-2 relative overflow-hidden group hover:border-teal-500/40 transition-all">
                  <div className="flex items-center justify-between text-teal-300">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Custeio (GND 3)</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-500/20 border border-teal-500/30 text-teal-300 font-bold">
                      {pctCusteioEmElaboracao.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-lg md:text-xl font-extrabold text-teal-300 font-mono tracking-tight">
                    R$ {formatCurrency(totalCusteioEmElaboracao)}
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-teal-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, pctCusteioEmElaboracao))}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-teal-200/70 truncate">
                    Serviços contínuos e suporte técnico
                  </p>
                </div>

                {/* Total Investimento (GND 4) card */}
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 space-y-2 relative overflow-hidden group hover:border-purple-500/40 transition-all">
                  <div className="flex items-center justify-between text-purple-300">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Investimento (GND 4)</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold">
                      {pctInvestimentoEmElaboracao.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-lg md:text-xl font-extrabold text-purple-300 font-mono tracking-tight">
                    R$ {formatCurrency(totalInvestimentoEmElaboracao)}
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-purple-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, pctInvestimentoEmElaboracao))}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-purple-200/70 truncate">
                    Bens, software e infraestrutura
                  </p>
                </div>

              </div>

              {/* Donut Chart Column (4 cols) */}
              <div className="lg:col-span-4 bg-surface-container/50 border border-outline-variant/50 rounded-xl p-4 flex flex-col sm:flex-row lg:flex-col items-center justify-between gap-3">
                <div className="w-full h-[130px] flex items-center justify-center relative">
                  {totalGeralEmElaboracao > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartDataEmElaboracao}
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={55}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {chartDataEmElaboracao.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(value: number) => [`R$ ${formatCurrency(value)}`, 'Valor']}
                          contentStyle={{ 
                            backgroundColor: '#0f172a', 
                            borderColor: '#334155', 
                            borderRadius: '8px',
                            color: '#f8fafc',
                            fontSize: '11px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center text-xs text-on-surface-variant italic">
                      Nenhum valor estimado para os processos em elaboração.
                    </div>
                  )}

                  {/* Centered Donut Summary overlay */}
                  {totalGeralEmElaboracao > 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">Custeio / Inv</span>
                      <span className="text-[11px] font-bold text-amber-400 font-mono">
                        {pctCusteioEmElaboracao.toFixed(0)}% / {pctInvestimentoEmElaboracao.toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Donut Legend */}
                <div className="w-full space-y-1.5 text-xs border-t sm:border-t-0 sm:border-l lg:border-l-0 lg:border-t border-outline-variant/40 pt-2 sm:pt-0 sm:pl-3 lg:pl-0 lg:pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-teal-300 font-medium text-[11px]">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
                      <span>Custeio (GND 3):</span>
                    </div>
                    <span className="font-mono font-bold text-on-surface text-[11px]">R$ {formatCurrency(totalCusteioEmElaboracao)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-purple-300 font-medium text-[11px]">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
                      <span>Investimento (GND 4):</span>
                    </div>
                    <span className="font-mono font-bold text-on-surface text-[11px]">R$ {formatCurrency(totalInvestimentoEmElaboracao)}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Risk Alert / Recommendation Bar */}
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-on-surface">
                  <strong className="text-amber-300">Base para Planejamento Orçamentário:</strong> As contratações em elaboração demandam um total de <strong className="text-amber-300">R$ {formatCurrency(totalGeralEmElaboracao)}</strong> (<strong className="text-teal-300">R$ {formatCurrency(totalCusteioEmElaboracao)}</strong> em Custeio e <strong className="text-purple-300">R$ {formatCurrency(totalInvestimentoEmElaboracao)}</strong> em Investimento).
                </span>
              </div>
              <button
                onClick={() => setStatusFilter(['Em Elaboração'])}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1"
              >
                Filtrar Tabela por "Em Elaboração"
              </button>
            </div>
          </div>

          {/* Filtering bar */}
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 flex flex-col md:flex-row items-stretch md:items-center gap-5" data-tour="plan-stages">
            <div className="flex-1 space-y-2">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Busca por Processo/Requisitante/Tipo</label>
              <input
                type="text"
                placeholder="Ex Nome, SEI ou Modalidade..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>

            <div className="flex-1 space-y-2">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Filtrar por Status</label>
              <div className="flex flex-wrap gap-4 items-center h-8">
                {(['Seleção Fornecedor', 'Em Elaboração', 'Gerou Contrato', 'Arquivado'] as StatusPlanejamento[]).map(st => (
                  <label key={st} className="flex items-center gap-2 cursor-pointer text-xs text-on-surface hover:text-primary transition-colors">
                    <input
                      type="checkbox"
                      checked={statusFilter.includes(st)}
                      onChange={() => handleStatusCheck(st)}
                      className="w-3.5 h-3.5 rounded border-outline-variant bg-transparent text-primary focus:ring-primary/20 font-sans"
                    />
                    <span>{st}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="px-4 py-1.5 text-xs text-primary hover:underline hover:bg-primary/5 border border-transparent hover:border-primary/20 rounded-lg transition-colors cursor-pointer"
              >
                Limpar
              </button>
            </div>
          </div>

          {/* Plan list view */}
          <div className="overflow-x-auto font-sans">
            <table className="w-full min-w-[1000px] text-left border-separate border-spacing-y-2">
              <thead>
                <tr className="text-on-surface-variant">
                  <th 
                    className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => handleSort('SEI_Processo')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Processo SEI</span>
                      {sortKey === 'SEI_Processo' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => handleSort('Tipo_Processo')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Modalidade</span>
                      {sortKey === 'Tipo_Processo' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => handleSort('Objeto')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Objeto do Planejamento</span>
                      {sortKey === 'Objeto' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => handleSort('Estimativa_Custo')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Custo Estimativo</span>
                      {sortKey === 'Estimativa_Custo' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => handleSort('Int_Requisitante')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Requisitante</span>
                      {sortKey === 'Int_Requisitante' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => handleSort('Status_Planejamento')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Status</span>
                      {sortKey === 'Status_Planejamento' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => handleSort('Contrato_Originado')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Contrato Originado</span>
                      {sortKey === 'Contrato_Originado' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-right select-none">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPlans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-xs text-on-surface-variant bg-surface-container-low/50 rounded-xl border border-outline-variant/30 font-medium italic">
                      Nenhum processo de planejamento correspondente no SharePoint.
                    </td>
                  </tr>
                ) : (
                  paginatedPlans.map((plan, idx) => {
                    const isRecent = isModifiedRecently(plan.updatedAt, currentLocalTime);
                    const cellBgClass = idx % 2 === 0
                      ? 'bg-surface-container-low/75 border-outline-variant/20'
                      : 'bg-surface-container/30 border-outline-variant/20';
                    
                    return (
                      <tr key={plan.id} className="group transition-all duration-150">
                        <td className={`px-5 py-4 ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                          <div className="flex items-center gap-1.5 focus-within:ring-1">
                            {isRecent && (
                              <span className="bg-primary/25 border border-primary/40 text-primary text-[9px] font-bold px-1.5 py-0.25 rounded-md animate-pulse shrink-0">
                                ALTERADO
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedPlanId(plan.id)}
                              className="font-mono font-bold text-xs text-primary hover:underline focus:outline-none text-left cursor-pointer"
                              title="Clique para detalhar o processo"
                            >
                              {plan.SEI_Processo}
                            </button>
                            <CopyButton text={plan.SEI_Processo} label="Processo SEI" />
                          </div>
                        </td>
                        <td className={`px-5 py-4 text-xs font-semibold text-on-surface-variant ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                          {plan.Tipo_Processo}
                        </td>
                        <td className={`px-5 py-4 text-xs text-on-surface max-w-sm ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`} title={plan.Objeto}>
                          <button
                            type="button"
                            onClick={() => setSelectedPlanId(plan.id)}
                            className="hover:underline hover:text-primary focus:outline-none text-left truncate w-full cursor-pointer font-medium"
                            title="Clique para detalhar o processo"
                          >
                            {plan.Objeto}
                          </button>
                        </td>
                        <td className={`px-5 py-4 text-xs font-mono font-bold text-primary ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                          {formatCurrency(getPlanningCusto(plan))}
                        </td>
                        <td className={`px-5 py-4 text-xs text-on-surface-variant ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                          {plan.Int_Requisitante}
                        </td>
                        <td className={`px-5 py-4 text-center ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                          {plan.Status_Planejamento === 'Em Elaboração' ? (
                            <ReUIBadge variant="warning">{plan.Status_Planejamento}</ReUIBadge>
                          ) : plan.Status_Planejamento === 'Seleção Fornecedor' ? (
                            <ReUIBadge variant="ongoing">{plan.Status_Planejamento}</ReUIBadge>
                          ) : plan.Status_Planejamento === 'Gerou Contrato' ? (
                            <ReUIBadge variant="success">{plan.Status_Planejamento}</ReUIBadge>
                          ) : (
                            <ReUIBadge variant="neutral">{plan.Status_Planejamento}</ReUIBadge>
                          )}
                        </td>
                        <td className={`px-5 py-4 text-center text-xs ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                          {plan.Contrato_Originado ? (
                            <div className="inline-flex items-center justify-center gap-1 mx-auto">
                              <button
                                onClick={() => {
                                  onNavigateToContract(plan.Contrato_Originado!);
                                }}
                                className="inline-flex items-center gap-1 text-primary hover:underline font-mono text-[11px] font-semibold cursor-pointer"
                              >
                                <Link2 className="w-3 h-3 text-primary" />
                                {contratos.find(c => c.id === plan.Contrato_Originado || c.Num_Contrato === plan.Contrato_Originado)?.Num_Contrato || 'Contrato'}
                              </button>
                              <CopyButton 
                                text={contratos.find(c => c.id === plan.Contrato_Originado || c.Num_Contrato === plan.Contrato_Originado)?.Num_Contrato || plan.Contrato_Originado} 
                                label="Número Contrato" 
                              />
                            </div>
                          ) : (
                            <span className="text-[11px] text-on-surface-variant/55 italic">—</span>
                          )}
                        </td>
                        <td className={`px-5 py-4 text-right ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                          <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => onViewLineage && onViewLineage(plan.id, 'planejamento')}
                              className="p-1 px-2.5 rounded bg-primary/5 hover:bg-primary/15 border border-outline text-primary text-[10px] font-semibold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                              title="Histórico e Rastreabilidade Completa do Processo"
                            >
                              <Shuffle className="w-3 h-3 text-primary animate-pulse" />
                              Percurso
                            </button>

                            <button
                              onClick={() => setSelectedPlanId(plan.id)}
                              className="p-1 px-2.5 rounded bg-primary/15 border border-primary/20 text-primary hover:bg-primary/25 text-[10px] font-semibold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                              title="Detalhar histórico e tarefas"
                            >
                              <Eye className="w-3 h-3" />
                              Detalhar
                            </button>
                            
                            <button
                              onClick={() => handleStartEditPlan(plan)}
                              className="p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                              title="Editar dados"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            
                            <button
                              onClick={() => handleDeletePlan(plan.id, plan.SEI_Processo)}
                              className="p-1 text-on-surface-variant hover:text-rose-400 transition-colors cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPlans > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-3 px-5 py-3.5 bg-surface-container-low/40 rounded-xl border border-outline-variant/30 font-sans select-none">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Linhas por página:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-surface-container border border-outline-variant/50 text-[11px] text-on-surface font-bold rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-[11px] font-bold text-on-surface-variant font-mono">
                  {(currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, totalPlans)} de {totalPlans}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded-lg border border-outline-variant/50 bg-surface-container/30 text-on-surface hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Página Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {pageNumbers.map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center border font-mono transition-all cursor-pointer
                        ${currentPage === pageNum
                          ? 'bg-primary border-primary text-on-primary shadow-sm'
                          : 'border-outline-variant/40 hover:bg-surface-container-high/40 hover:border-outline-variant text-[10px] text-on-surface-variant'
                        }`}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPlanPages))}
                    disabled={currentPage === totalPlanPages || totalPlanPages === 0}
                    className="p-1 rounded-lg border border-outline-variant/50 bg-surface-container/30 text-on-surface hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Próxima Página"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Detailed View of selected process */
        <div className="space-y-6">
          {/* Back Navigation Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container border border-outline-variant p-3 sm:p-4 rounded-xl" data-tour="plan-detail-header">
            <button
              onClick={() => setSelectedPlanId(null)}
              className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-all cursor-pointer font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para Lista de Processos</span>
            </button>

            <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
              {selectedPlan && (
                <>
                  <button
                    onClick={() => onViewLineage && onViewLineage(selectedPlan.id, 'planejamento')}
                    className="inline-flex items-center gap-1.25 text-[10px] bg-primary text-on-primary font-bold px-2.5 py-1.5 rounded-lg shadow-sm hover:bg-opacity-90 cursor-pointer focus:outline-none transition-all active:scale-95"
                  >
                    <Shuffle className="w-3 h-3 text-on-primary shrink-0 animate-pulse" />
                    <span>Rastreabilidade Completa</span>
                  </button>
                  {onStartTour && (
                    <button
                      type="button"
                      onClick={() => onStartTour('planejamento_details')}
                      className="inline-flex items-center gap-1.25 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-400 text-[10px] font-bold px-2.5 py-1.5 rounded-lg font-sans shadow-sm transition-all active:scale-95 cursor-pointer focus:outline-none"
                      title="Iniciar tutorial guiado explicativo desta tela"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Tutorial</span>
                    </button>
                  )}
                </>
              )}
              <span className="text-xs bg-surface-container-high border border-outline-variant text-[11px] font-bold text-on-surface px-2.5 py-1 rounded font-mono truncate max-w-full">
                Processo: {selectedPlan?.SEI_Processo}
              </span>
              <span className="text-xs bg-primary/20 border border-primary/40 text-[10px] font-mono font-bold text-primary px-2.5 py-1 rounded truncate max-w-full">
                Layout: {selectedPlan?.Tipo_Processo}
              </span>
            </div>
          </div>

          {/* ReUI Stepper for Process Flow */}
          {selectedPlan && (
            <div className="bg-surface border border-outline p-5 rounded-2xl relative overflow-hidden shadow-sm" data-tour="plan-detail-stepper">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl pointer-events-none"></div>
              <div className="text-[9px] uppercase font-bold tracking-widest text-on-surface-variant mb-2.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                Etapa de Instrução do Planejamento
              </div>
              <ReUIStepper
                steps={[
                  {
                    label: 'Instrução do Planejamento',
                    description: 'Estudo Técnico, DFD & Equipe',
                    status: selectedPlan.Status_Planejamento === 'Em Elaboração' ? 'active' : 'complete'
                  },
                  {
                    label: 'Fase de Seleção',
                    description: 'Licitação e Saneamento',
                    status: selectedPlan.Status_Planejamento === 'Seleção Fornecedor' ? 'active' : (selectedPlan.Status_Planejamento === 'Gerou Contrato' ? 'complete' : 'upcoming')
                  },
                  {
                    label: 'Contratação Concluída',
                    description: 'Assinatura do Contrato',
                    status: selectedPlan.Status_Planejamento === 'Gerou Contrato' ? 'active' : 'upcoming'
                  }
                ]}
              />
            </div>
          )}

          {/* Complete Planning Sheet Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" data-tour="plan-detail-specs">
            {/* Objeto and detailed members (Left Column - 7 cols) */}
            <div className="lg:col-span-7 bg-surface-container-low border border-outline-variant rounded-xl p-5 sm:p-6 space-y-5 flex flex-col justify-between">
              <div className="space-y-3">
                {/* Status and Category Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] bg-primary/15 border border-primary/30 text-primary px-2.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                    PLANEJAMENTO DA CONTRATAÇÃO
                  </span>
                  <span className="text-[10px] bg-surface-container-highest border border-outline-variant text-on-surface font-semibold px-2.5 py-0.5 rounded">
                    Layout: <strong className="text-primary">{selectedPlan?.Tipo_Processo || 'Pregão SOF'}</strong>
                  </span>
                  <span className="text-[10px] bg-surface-container-highest border border-outline-variant text-on-surface font-semibold px-2.5 py-0.5 rounded">
                    PCA: <strong className="text-on-surface">{selectedPlan?.PCA || 'MPO'} ({selectedPlan?.Ano_PCA_Vinculado})</strong>
                  </span>
                  {selectedPlan?.Contrato_Originado && (
                    <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold px-2.5 py-0.5 rounded font-mono">
                      Contrato: {selectedPlan.Contrato_Originado}
                    </span>
                  )}
                  {selectedPlan?.Portaria_Equipe_PC_Numero || selectedPlan?.Portaria_Equipe_PC_SEI ? (
                    <span className="text-[10px] bg-surface-container-highest border border-outline-variant text-on-surface font-semibold px-2.5 py-0.5 rounded font-mono">
                      Portaria: {selectedPlan.Portaria_Equipe_PC_Numero || `SEI ${selectedPlan.Portaria_Equipe_PC_SEI}`}
                    </span>
                  ) : null}
                </div>

                {/* Objeto */}
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-on-surface leading-snug">
                    {selectedPlan?.Objeto}
                  </h3>
                </div>

                {/* Portaria de Formalização da EPC Banner */}
                <div className="bg-surface-container/60 border border-outline-variant/30 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0">
                      <FileSignature className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider block">Portaria de Formalização da Equipe (EPC)</span>
                      <p className="text-xs sm:text-sm font-bold text-primary truncate">
                        {selectedPlan?.Portaria_Equipe_PC_Numero || 'Portaria da EPC em definição'}
                      </p>
                    </div>
                  </div>
                  {selectedPlan?.Portaria_Equipe_PC_SEI && (
                    <span className="text-[10px] font-mono bg-surface-container-highest border border-outline-variant/40 text-on-surface-variant px-2.5 py-1 rounded font-semibold self-start sm:self-center shrink-0">
                      SEI: {selectedPlan.Portaria_Equipe_PC_SEI}
                    </span>
                  )}
                </div>
              </div>

              {/* Equipe de Planejamento da Contratação (EPC) */}
              <div className="border-t border-outline-variant/30 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 font-display">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    Integrantes da Equipe de Planejamento (EPC)
                  </span>
                  <span className="text-[10px] text-on-surface-variant">Papéis e Responsabilidades</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Integrante Requisitante */}
                  <div className="bg-surface-container/70 border border-outline-variant/30 rounded-lg p-3 space-y-2.5">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-outline-variant/20">
                      <UserIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Integrante Requisitante</span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] uppercase font-semibold text-on-surface-variant">Titular</span>
                          <span className="text-[8px] bg-amber-500/10 text-amber-400 font-bold px-1.5 py-0.2 rounded font-mono">REQUISITANTE</span>
                        </div>
                        <p className={`font-semibold truncate ${selectedPlan?.Int_Requisitante ? 'text-on-surface' : 'text-on-surface-variant/60 italic'}`} title={selectedPlan?.Int_Requisitante}>
                          {selectedPlan?.Int_Requisitante || 'Não indicado'}
                        </p>
                      </div>
                      <div className="pt-1 border-t border-outline-variant/15">
                        <span className="text-[9px] uppercase font-semibold text-on-surface-variant block">Substituto</span>
                        <p className={`font-medium truncate ${selectedPlan?.Int_Requisitante_Subst ? 'text-on-surface/90' : 'text-on-surface-variant/60 italic'}`} title={selectedPlan?.Int_Requisitante_Subst}>
                          {selectedPlan?.Int_Requisitante_Subst || 'Não indicado'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Integrante Técnico */}
                  <div className="bg-surface-container/70 border border-outline-variant/30 rounded-lg p-3 space-y-2.5">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-outline-variant/20">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Integrante Técnico</span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] uppercase font-semibold text-on-surface-variant">Titular</span>
                          <span className="text-[8px] bg-blue-500/10 text-blue-400 font-bold px-1.5 py-0.2 rounded font-mono">TÉCNICO</span>
                        </div>
                        <p className={`font-semibold truncate ${selectedPlan?.Int_Tecnico ? 'text-on-surface' : 'text-on-surface-variant/60 italic'}`} title={selectedPlan?.Int_Tecnico}>
                          {selectedPlan?.Int_Tecnico || 'Não indicado'}
                        </p>
                      </div>
                      <div className="pt-1 border-t border-outline-variant/15">
                        <span className="text-[9px] uppercase font-semibold text-on-surface-variant block">Substituto</span>
                        <p className={`font-medium truncate ${selectedPlan?.Int_Tecnico_Subst ? 'text-on-surface/90' : 'text-on-surface-variant/60 italic'}`} title={selectedPlan?.Int_Tecnico_Subst}>
                          {selectedPlan?.Int_Tecnico_Subst || 'Não indicado'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Integrante Administrativo */}
                  <div className="bg-surface-container/70 border border-outline-variant/30 rounded-lg p-3 space-y-2.5">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-outline-variant/20">
                      <FileCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span className="text-[10px] uppercase font-bold text-teal-400 tracking-wider">Integrante Administrativo</span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] uppercase font-semibold text-on-surface-variant">Titular</span>
                          <span className="text-[8px] bg-teal-500/10 text-teal-400 font-bold px-1.5 py-0.2 rounded font-mono">ADMIN</span>
                        </div>
                        <p className={`font-semibold truncate ${selectedPlan?.Int_Administrativo ? 'text-on-surface' : 'text-on-surface-variant/60 italic'}`} title={selectedPlan?.Int_Administrativo}>
                          {selectedPlan?.Int_Administrativo || 'Não indicado'}
                        </p>
                      </div>
                      <div className="pt-1 border-t border-outline-variant/15">
                        <span className="text-[9px] uppercase font-semibold text-on-surface-variant block">Substituto</span>
                        <p className={`font-medium truncate ${selectedPlan?.Int_Administrativo_Subst ? 'text-on-surface/90' : 'text-on-surface-variant/60 italic'}`} title={selectedPlan?.Int_Administrativo_Subst}>
                          {selectedPlan?.Int_Administrativo_Subst || 'Não indicado'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Calculations and Specifications right panel (5 cols) */}
            <div className="lg:col-span-5 bg-surface-container-low border border-outline-variant p-5 sm:p-6 rounded-xl flex flex-col justify-between space-y-4" data-tour="plan-detail-metrics">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
                  <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 font-display">
                    <DollarSign className="w-3.5 h-3.5 text-primary" />
                    Estimativas e Parâmetros
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-mono">PCA {selectedPlan?.Ano_PCA_Vinculado}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Estimativa de Custo SOF */}
                  <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/30 min-w-0 flex flex-col justify-between sm:col-span-2">
                    <div className="min-w-0">
                      <span className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider flex items-center gap-1 truncate">
                        <TrendingUp className="w-3 h-3 text-primary shrink-0" />
                        Estimativa de Custo SOF
                      </span>
                      <span className="text-xl sm:text-2xl font-bold font-mono text-primary block mt-1 leading-tight truncate" title={formatCurrency(selectedPlan ? getPlanningCusto(selectedPlan) : 0)}>
                        {formatCurrency(selectedPlan ? getPlanningCusto(selectedPlan) : 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 text-[8.5px] text-on-surface-variant mt-1.5 pt-1.5 border-t border-outline-variant/20 min-w-0">
                      <span className="truncate">Origem PCA: DFD {selectedPlan?.DFD_PNCP} ({selectedPlan?.Ano_PCA_Vinculado})</span>
                      <span className="font-mono font-bold text-on-surface shrink-0">
                        {selectedPlan?.Natureza_Objeto || 'Serviço'} &bull; {selectedPlan?.GND || '3 - Custeio'}
                      </span>
                    </div>
                  </div>

                  {/* Sessão Pública e Registro */}
                  <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/30 min-w-0 flex flex-col justify-between sm:col-span-2">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider flex items-center gap-1 truncate">
                        <Calendar className="w-3 h-3 text-primary shrink-0" />
                        Sessão Pública e Registro
                      </span>
                      <div className="mt-1.5">
                        {selectedPlan?.Data_Sessao_Publica ? (
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-on-surface flex items-center gap-1.5 font-mono">
                              {(() => {
                                const d = new Date(selectedPlan.Data_Sessao_Publica);
                                if (isNaN(d.getTime())) return 'Data Inválida';
                                return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
                              })()}
                            </p>
                            {selectedPlan.Link_Sessao && (
                              <a
                                href={selectedPlan.Link_Sessao}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary text-[10px] hover:underline flex items-center gap-1 font-medium pt-0.5"
                              >
                                Acessar link externo da sessão
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-on-surface-variant italic">Data da Sessão não agendada</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Segregação de Despesas: Custeio vs Investimento do Planejamento */}
          {selectedPlan && (() => {
            const { custeio, investimento } = getPlanningCusteioInvestimento(selectedPlan);
            const total = custeio + investimento;
            const custeioPercent = total > 0 ? ((custeio / total) * 100).toFixed(0) : '0';
            const investimentoPercent = total > 0 ? ((investimento / total) * 100).toFixed(0) : '0';

            return (
              <div className="bg-surface-container-low border border-outline-variant p-5 rounded-xl space-y-4 mt-4" data-tour="plan-detail-segregacao">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h4 className="text-xs uppercase font-extrabold text-on-surface tracking-wider font-display">
                    Segregação de Despesas: Custeio vs Investimento do Planejamento
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-4 h-32 relative flex items-center justify-center bg-surface-container/30 rounded-xl border border-outline-variant/10 p-2">
                    {total === 0 ? (
                      <span className="text-[10px] text-on-surface-variant italic">Sem valores cadastrados.</span>
                    ) : (
                      <div className="w-full h-full relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Custeio (GND 3)', value: custeio },
                                { name: 'Investimento (GND 4)', value: investimento }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={45}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              <Cell key="custeio" fill="#3b82f6" />
                              <Cell key="investimento" fill="#10b981" />
                            </Pie>
                            <RechartsTooltip
                              formatter={(value: any) => [formatCurrency(Number(value)), '']}
                              contentStyle={{ 
                                backgroundColor: '#090d16', 
                                borderColor: '#334155', 
                                borderRadius: '8px',
                                color: '#f8fafc',
                                fontSize: '11px'
                              }}
                              itemStyle={{ color: '#ffffff', padding: '0px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute flex flex-col items-center justify-center pointer-events-none mt-0.5">
                          <span className="text-[7px] uppercase font-bold text-on-surface-variant/80 tracking-wider">Custeio</span>
                          <strong className="text-[11px] font-bold text-blue-400 font-mono">
                            {custeioPercent}%
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/20 flex flex-col justify-between h-20">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-blue-400">Custeio (GND 3)</span>
                        <strong className="text-sm font-bold font-mono text-on-surface block mt-1">{formatCurrency(custeio)}</strong>
                      </div>
                      <span className="text-[9px] text-on-surface-variant">Representa {custeioPercent}% do valor total</span>
                    </div>

                    <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/20 flex flex-col justify-between h-20">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-emerald-400">Investimento (GND 4)</span>
                        <strong className="text-sm font-bold font-mono text-on-surface block mt-1">{formatCurrency(investimento)}</strong>
                      </div>
                      <span className="text-[9px] text-on-surface-variant">Representa {investimentoPercent}% do valor total</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Sub-navigation Tabs: History vs Kanban */}
          <div className="flex border-b border-outline-variant gap-1 overflow-x-auto" data-tour="plan-detail-tabs">
            <button
              onClick={() => setActiveSubTab('historico')}
              data-tour="plan-tab-historico"
              className={`px-6 py-3 cursor-pointer text-xs font-bold transition-all relative ${
                activeSubTab === 'historico'
                  ? 'text-primary bg-primary/5'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Aba Histórico Processual
              {activeSubTab === 'historico' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded" />}
            </button>
            <button
              onClick={() => setActiveSubTab('tarefas')}
              data-tour="plan-tab-tarefas"
              className={`px-6 py-3 cursor-pointer text-xs font-bold transition-all relative inline-flex items-center gap-2 ${
                activeSubTab === 'tarefas'
                  ? 'text-primary bg-primary/5'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <ListTodo className="w-4 h-4 shrink-0" />
              Aba de Tarefas (Quadro Kanban)
              {activeSubTab === 'tarefas' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded" />}
            </button>
            <button
              onClick={() => setActiveSubTab('itens-sof')}
              data-tour="plan-tab-itens-sof"
              className={`px-6 py-3 cursor-pointer text-xs font-bold transition-all relative ${
                activeSubTab === 'itens-sof'
                  ? 'text-primary bg-primary/5'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Itens da SOF Orçados
              {activeSubTab === 'itens-sof' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded" />}
            </button>
          </div>

          {/* Tab body contents */}
          {activeSubTab === 'historico' ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-semibold text-on-surface">Histórico de Ocorrências da Instrução</h4>
                  <p className="text-[10px] text-on-surface-variant">Lançamentos de pareceres jurídicos, saneamentos, publicações de editais no SEI.</p>
                </div>
                <button
                  onClick={handleOpenNewHistModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-xs text-primary rounded-lg transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Novo Histórico SEI
                </button>
              </div>

              {/* History list */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden divide-y divide-outline-variant/30">
                {selectedPlanHistoricos.length === 0 ? (
                  <div className="p-10 text-center text-xs text-on-surface-variant italic">Nenhum evento registrado no histórico para este planejamento.</div>
                ) : (
                  selectedPlanHistoricos.map(h => (
                    <div key={h.id} className="p-4 flex flex-col md:flex-row hover:bg-surface-container/20 transition-colors gap-3 justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-on-surface font-mono">{formatDateTime(h.Data)}</span>
                          <span className="text-[10px] bg-surface-container border border-outline-variant/40 px-2 py-0.25 text-on-surface-variant rounded">Coord: {h.Coordenacao}</span>
                        </div>
                        <p className="text-xs text-on-surface mt-1 leading-relaxed">{h.Descricao}</p>
                      </div>
                      
                      <div className="flex items-center gap-4 shrink-0 justify-end">
                        <span className="text-xs font-mono bg-primary/10 text-primary border border-primary/30 rounded px-2.5 py-0.5">
                          {h.Num_SEI}
                        </span>
                        
                        <div className="flex items-center gap-1 opacity-70 hover:opacity-100">
                          <button
                            onClick={() => handleOpenEditHistModal(h)}
                            className="p-1 text-on-surface-variant hover:text-primary"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteHist(h.id)}
                            className="p-1 text-on-surface-variant hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : activeSubTab === 'tarefas' ? (
            /* Fluxo BPMN Interativo do Processo + Quadro Kanban */
            <div className="space-y-6">
              <BpmnFlowBoard
                planejamento={selectedPlan!}
                tarefas={tarefas}
                currentUser={currentUser}
                onAddTarefa={onAddTarefa}
                onUpdateTarefa={onUpdateTarefa}
                onDeleteTarefa={onDeleteTarefa}
                onUpdatePlanejamento={onEditPlanejamento}
              />
              <KanbanBoard
                planejamento={selectedPlan!}
                allPlanejamentos={planejamentos}
                itensPlanejamentoSOF={itensPlanejamentoSOF}
                tarefas={tarefas}
                currentUser={currentUser}
                onAddTarefa={onAddTarefa}
                onUpdateTarefa={onUpdateTarefa}
                onDeleteTarefa={onDeleteTarefa}
                templates={templates}
                onUpdateTemplates={onUpdateTemplates}
                onSelectPlanejamento={(id) => setSelectedPlanId(id)}
                hideGlobalPhaseSelector={true}
              />
            </div>
          ) : (
            <ItensPlanejamentoSOFPanel
              planejamento={selectedPlan!}
              itensPlanejamentoSOF={itensPlanejamentoSOF}
              currentUser={currentUser}
              onAddItem={onAddItemPlanejamentoSOF}
              onEditItem={onEditItemPlanejamentoSOF}
              onDeleteItem={onDeleteItemPlanejamentoSOF}
            />
          )}
        </div>
      )}

      {/* Plan Registration/Edit Modal Popup */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface-container border border-outline-variant w-full max-w-2xl max-h-full sm:max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-surface-container-high px-6 py-4 border-b border-outline-variant flex justify-between items-center shrink-0">
              <span className="font-bold text-on-surface">
                {planFormMode === 'create' ? 'Cadastrar Novo Processo de Planejamento' : 'Editar Dados do Planejamento'}
              </span>
              <button onClick={() => setIsPlanModalOpen(false)} className="text-on-surface-variant hover:text-on-surface p-1 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrEditPlan} className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Nº Processo SEI <span className="text-rose-400">*</span></label>
                  <input
                    type="text"
                    name="SEI_Processo"
                    required
                    disabled={planFormMode === 'edit'}
                    placeholder="Ex: 23000.XXXXXX/YYYY-ZZ"
                    value={planFormData.SEI_Processo}
                    onChange={handlePlanFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary disabled:opacity-50 font-mono"
                  />
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Tipo de Processo (Layout/Fluxo)</label>
                  <select
                    name="Tipo_Processo"
                    value={planFormData.Tipo_Processo}
                    onChange={handlePlanFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="Pregão SOF">Pregão SOF</option>
                    <option value="Contratação Direta - Inexigibilidade">Contratação Direta - Inexigibilidade</option>
                    <option value="Contratação Direta - Dispensa">Contratação Direta - Dispensa</option>
                    <option value="Pregão do ColaboraGov">Pregão do ColaboraGov</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-outline-variant/20 pt-3">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Natureza do Objeto</label>
                  <select
                    name="Natureza_Objeto"
                    value={planFormData.Natureza_Objeto || 'Serviço'}
                    onChange={handlePlanFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="Serviço">Serviço (Contínuo)</option>
                    <option value="Bem">Bem (Material/Consumo/Permanente)</option>
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Grupo de Natureza (GND)</label>
                  <select
                    name="GND"
                    value={planFormData.GND || '3 - Custeio'}
                    onChange={handlePlanFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="3 - Custeio">3 - Custeio</option>
                    <option value="4 - Investimento">4 - Investimento</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-semibold text-on-surface-variant uppercase">Objeto de Contratação <span className="text-rose-400">*</span></label>
                <textarea
                  name="Objeto"
                  required
                  rows={2}
                  placeholder="Ex: Solução continuada de suporte cloud..."
                  value={planFormData.Objeto}
                  onChange={handlePlanFormChange}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-on-surface-variant uppercase">Custo Estimativo Total <span className="text-rose-400">*</span></label>
                    {planFormData.SEI_Processo && (itensPlanejamentoSOF || []).some(i => i.Processo_SEI === planFormData.SEI_Processo && i.Status_Item === 'Ativo') && (
                      <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Itens vinculados
                      </span>
                    )}
                  </div>
                  <CurrencyInput
                    id="planejamento-custo-estimativo"
                    name="Estimativa_Custo"
                    required
                    placeholder="0,00"
                    showPreview={true}
                    value={planFormData.Estimativa_Custo}
                    onChange={(val) => setPlanFormData(prev => ({ ...prev, Estimativa_Custo: val }))}
                  />
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Código DFD Originador (PCA)</label>
                  <div className="flex flex-col gap-1.5">
                    <input
                      type="text"
                      name="DFD_PNCP"
                      placeholder="Ex: DFD-025/2024"
                      value={planFormData.DFD_PNCP || ''}
                      onChange={handlePlanFormChange}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono animate-in"
                    />
                    {dfds && dfds.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-on-surface-variant/70 whitespace-nowrap">Ou selecione cadastrado:</span>
                        <select
                          className="bg-surface-container border border-outline-variant rounded px-2 py-0.5 text-[9px] text-primary focus:outline-none max-w-[170px] truncate"
                          value={dfds.some(d => d.Num_DFD === planFormData.DFD_PNCP) ? planFormData.DFD_PNCP : ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              setPlanFormData(prev => ({
                                ...prev,
                                DFD_PNCP: e.target.value
                              }));
                              const selectedDfd = dfds.find(d => d.Num_DFD === e.target.value);
                              if (selectedDfd && selectedDfd.Ano_PCA) {
                                setPlanFormData(prev => ({
                                  ...prev,
                                  Ano_PCA_Vinculado: selectedDfd.Ano_PCA
                                }));
                              }
                            }
                          }}
                        >
                          <option value="">-- Manual/Externo --</option>
                          {dfds.map(d => (
                            <option key={d.id} value={d.Num_DFD}>
                              {d.Num_DFD} ({d.Descricao_Objeto ? d.Descricao_Objeto.substring(0, 20) + '...' : ''})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-outline-variant/35 pt-3">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Portaria EPC (Número)</label>
                  <input
                    type="text"
                    name="Portaria_Equipe_PC_Numero"
                    placeholder="Portaria GECTI Nº XX/YYYY"
                    value={planFormData.Portaria_Equipe_PC_Numero}
                    onChange={handlePlanFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Documento SEI da Portaria</label>
                  <input
                    type="text"
                    name="Portaria_Equipe_PC_SEI"
                    placeholder="SEI-XXXXXXX"
                    value={planFormData.Portaria_Equipe_PC_SEI}
                    onChange={handlePlanFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-outline-variant/35 pt-3">
                <div className="space-y-1.5 col-span-3 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase text-[10px]">Fiscal Requisitante</label>
                  <input
                    type="text"
                    name="Int_Requisitante"
                    placeholder="Nome titular"
                    value={planFormData.Int_Requisitante}
                    onChange={handlePlanFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    name="Int_Requisitante_Subst"
                    placeholder="Substituto"
                    value={planFormData.Int_Requisitante_Subst}
                    onChange={handlePlanFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary text-[11px]"
                  />
                </div>

                <div className="space-y-1.5 col-span-3 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase text-[10px]">Fiscal Técnico</label>
                  <input
                    type="text"
                    name="Int_Tecnico"
                    placeholder="Nome titular"
                    value={planFormData.Int_Tecnico}
                    onChange={handlePlanFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    name="Int_Tecnico_Subst"
                    placeholder="Substituto"
                    value={planFormData.Int_Tecnico_Subst}
                    onChange={handlePlanFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary text-[11px]"
                  />
                </div>

                <div className="space-y-1.5 col-span-3 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase text-[10px]">Fiscal Adm</label>
                  <input
                    type="text"
                    name="Int_Administrativo"
                    placeholder="Nome titular"
                    value={planFormData.Int_Administrativo}
                    onChange={handlePlanFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    name="Int_Administrativo_Subst"
                    placeholder="Substituto"
                    value={planFormData.Int_Administrativo_Subst}
                    onChange={handlePlanFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-outline-variant/35 pt-3">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Agendar Sessão Pública</label>
                  <input
                    type="datetime-local"
                    name="Data_Sessao_Publica"
                    value={planFormData.Data_Sessao_Publica}
                    onChange={handlePlanFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Link de Sessão Ativa</label>
                  <input
                    type="url"
                    name="Link_Sessao"
                    placeholder="https://comprasnet.gov.br/..."
                    value={planFormData.Link_Sessao}
                    onChange={handlePlanFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-outline-variant/30">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Status Instrução</label>
                  <select
                    name="Status_Planejamento"
                    value={planFormData.Status_Planejamento}
                    onChange={handlePlanFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="Em Elaboração">Em Elaboração</option>
                    <option value="Seleção Fornecedor">Seleção Fornecedor</option>
                    <option value="Gerou Contrato">Gerou Contrato</option>
                    <option value="Arquivado">Arquivado</option>
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Vincular Contrato Concluído</label>
                  <select
                    name="Contrato_Originado"
                    value={planFormData.Contrato_Originado || ''}
                    onChange={handlePlanFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono font-bold"
                  >
                    <option value="">-- Sem contrato vinculado --</option>
                    {contratos.map(c => (
                      <option key={c.id} value={c.id}>{c.Num_Contrato} - {c.Objeto.substring(0, 30)}...</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-primary block leading-none pl-1 mt-1">Ao vincular, o status altera-se automaticamente para <em>&quot;Gerou Contrato&quot;</em>!</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant bg-surface-container-high/20 -mx-6 -mb-6 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2 border border-outline-variant rounded text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer animate-out"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={currentUser.role === 'Visualizador'}
                  className="px-5 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:opacity-90 shadow-lg shadow-primary/10 transition-all cursor-pointer disabled:opacity-50"
                >
                  Salvar Mudanças
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History additions Popup/Modal */}
      {isHistModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface-container border border-outline-variant w-full max-w-md max-h-full sm:max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-xl animate-in zoom-in-95 duration-100">
            <div className="bg-surface-container-high px-5 py-3 border-b border-outline-variant flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-on-surface">{editingHistId ? 'Editar Marcador de Histórico' : 'Novo Lançamento de Histórico'}</span>
              <button onClick={() => setIsHistModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSaveHist} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Data e Hora do Evento</label>
                <input
                  type="datetime-local"
                  required
                  name="Data"
                  value={histFormData.Data}
                  onChange={e => setHistFormData({ ...histFormData, Data: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Documento de Referência (SEI)</label>
                <input
                  type="text"
                  placeholder="Ex: Parecer CONJUR 312/2024"
                  name="Num_SEI"
                  value={histFormData.Num_SEI}
                  onChange={e => setHistFormData({ ...histFormData, Num_SEI: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Coordenação / Setor Responsável</label>
                <input
                  type="text"
                  required
                  name="Coordenacao"
                  value={histFormData.Coordenacao}
                  onChange={e => setHistFormData({ ...histFormData, Coordenacao: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Breve Descrição do Avanço Processual</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Registre o teor e objetivo deste encaminhamento processual..."
                  name="Descricao"
                  value={histFormData.Descricao}
                  onChange={e => setHistFormData({ ...histFormData, Descricao: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsHistModalOpen(false)}
                  className="px-3 py-1.5 text-xs border border-outline-variant rounded text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={currentUser.role === 'Visualizador'}
                  className="px-4 py-1.5 text-xs bg-primary text-on-primary font-semibold rounded cursor-pointer hover:brightness-110"
                >
                  Gravar Histórico
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exclusão Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-100 font-sans">
          <div className="bg-surface-container border border-outline-variant w-full max-w-md rounded-xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-bold text-on-surface font-sans">
                {deleteConfirm.type === 'planejamento' ? 'Excluir Planejamento TIC' : 'Excluir Histórico Processual'}
              </h4>
            </div>
            
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {deleteConfirm.type === 'planejamento' ? (
                <>
                  Você tem certeza absoluta de que deseja excluir o Planejamento SEI 
                  <strong className="text-on-surface font-mono mx-1 font-semibold">{deleteConfirm.extraName}</strong>?
                  Esta ação apagará também todas as tarefas e históricos vinculados no sistema.
                </>
              ) : (
                <>
                  Deseja realmente remover permanentemente este registro de histórico processual? Esta ação não poderá ser desfeita.
                </>
              )}
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm({ isOpen: false, type: null, id: '' })}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-surface-container-high border border-outline-variant hover:bg-surface-container-highest text-on-surface transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-rose-500 hover:bg-rose-600 text-white shadow-lg active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 animate-in"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
