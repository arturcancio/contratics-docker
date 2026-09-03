/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Contrato, 
  OrdemServico,
  ItemContratoSOF, 
  TermoAditivo, 
  TermoApostilamento, 
  HistoricoContratual, 
  Pagamento, 
  Fornecedor, 
  User, 
  StatusContrato, 
  PeriodicidadePagamento,
  DFD,
  DescentralizacaoItem,
  NotaEmpenhoItem
} from '../types';
import { 
  formatCurrency, 
  formatDate, 
  isModifiedRecently, 
  getVigenciaFinalInicial, 
  getVigenciaFinal, 
  getProrrogavelAte, 
  getStatusContrato,
  isValidCNPJ,
  getFractionalMonths,
  sortOrdensServico,
  parseMonetaryValue,
  sortAndGroupItems
} from '../utils';
import { CurrencyInput } from './CurrencyInput';
import { DescentralizacaoManager, AvailableEmpenho } from './DescentralizacaoManager';
import { ReUIBadge, ReUIStepper, ReUICard, ReUIDropzone, ReUIProgress } from './ReUI';
import { CopyButton, CopyableText } from './CopyButton';
import { getIctiSeriesBundle } from '../services/ipeadataService';
import { 
  Plus, 
  Calendar, 
  UserCheck, 
  ArrowLeft, 
  X, 
  Search, 
  FileText, 
  PenTool, 
  CheckCircle, 
  DollarSign, 
  Activity, 
  AlertTriangle, 
  TrendingUp, 
  Trash2, 
  ChevronLeft,
  ChevronRight, 
  Edit, 
  Eye, 
  Briefcase,
  Download,
  Upload,
  Bell,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertCircle,
  AlertOctagon,
  Shuffle,
  Check,
  CheckCircle2,
  Info,
  Calculator,
  Building2,
  ShieldCheck,
  Users,
  User as UserIcon,
  Mail,
  FileCheck,
  Receipt,
  HelpCircle
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';

interface ContratosProps {
  contratos: Contrato[];
  dfds: DFD[];
  itensSOF: ItemContratoSOF[];
  aditivos: TermoAditivo[];
  apostilamentos: TermoApostilamento[];
  historicosContratuais: HistoricoContratual[];
  pagamentos: Pagamento[];
  fornecedores: Fornecedor[];
  currentUser: User;
  currentLocalTime: string;
  selectedYear?: string;
  onAddContrato: (newCont: Contrato) => void;
  onEditContrato: (updatedCont: Contrato) => void;
  onDeleteContrato: (id: string) => void;
  onAddItemSOF: (newItem: ItemContratoSOF) => void;
  onEditItemSOF: (updatedItem: ItemContratoSOF) => void;
  onDeleteItemSOF: (id: string) => void;
  onAddAditivo: (newAd: TermoAditivo) => void;
  onDeleteAditivo: (id: string) => void;
  onAddApostilamento: (newAp: TermoApostilamento) => void;
  onDeleteApostilamento: (id: string) => void;
  onAddHistoricoContratual: (newHist: HistoricoContratual) => void;
  onDeleteHistoricoContratual: (id: string) => void;
  onAddPagamento: (newPag: Pagamento) => void;
  onDeletePagamento: (id: string) => void;
  onAddFornecedor: (newForn: Fornecedor) => void;
  onEditFornecedor: (updatedForn: Fornecedor) => void;
  onDeleteFornecedor?: (id: string) => void;
  onViewLineage?: (id: string, type: 'dfd' | 'planejamento' | 'contrato') => void;
  onOpenIctiCalculator?: (contratoId?: string) => void;
  onStartTour?: (tourId: string) => void;
  completedTours?: string[];
  initialSelectedContractId?: string | null;
  onCloseContractDetails?: () => void;
}

export default function Contratos({
  contratos,
  dfds = [],
  itensSOF,
  aditivos,
  apostilamentos,
  historicosContratuais,
  pagamentos,
  fornecedores,
  currentUser,
  currentLocalTime,
  selectedYear = '2026',
  onAddContrato,
  onEditContrato,
  onDeleteContrato,
  onAddItemSOF,
  onEditItemSOF,
  onDeleteItemSOF,
  onAddAditivo,
  onDeleteAditivo,
  onAddApostilamento,
  onDeleteApostilamento,
  onAddHistoricoContratual,
  onDeleteHistoricoContratual,
  onAddPagamento,
  onDeletePagamento,
  onAddFornecedor,
  onEditFornecedor,
  onDeleteFornecedor,
  onViewLineage,
  onOpenIctiCalculator,
  onStartTour,
  completedTours = [],
  initialSelectedContractId = null,
  onCloseContractDetails
}: ContratosProps) {
  // Navigation / Detailing state
  const [selectedContratoId, setSelectedContratoId] = useState<string | null>(initialSelectedContractId);

  useEffect(() => {
    if (initialSelectedContractId) {
      setSelectedContratoId(initialSelectedContractId);
    }
  }, [initialSelectedContractId]);
  const [activeTab, setActiveTab] = useState<'itens' | 'historico' | 'prestacoes' | 'aditamentos' | 'ordensServico'>('itens');

  // Active OS ID selected for detail/edit
  const [activeOsId, setActiveOsId] = useState<string | null>(null);

  // New detailed/extended OS form state
  const [extendedOsForm, setExtendedOsForm] = useState({
    numeroOS: '',
    dataEmissao: '',
    valor: '',
    prazoEntrega: '',
    statusOS: 'Pendente' as 'Pendente' | 'Executada' | 'Em Execução' | 'Cancelada' | 'Empenhado' | 'Liquidado' | 'Pago',
    observacao: '',
    
    // Novo detalhamento por OS
    dataInicioPeriodo: '',
    dataFimPeriodo: '',

    // Nota de Empenho (CSC - MGI)
    numeroEmpenho: '',
    seiEmpenho: '',
    valorEmpenho: '',
    empenhos: [] as NotaEmpenhoItem[],

    // Termo de Recebimento Provisório (TRP)
    trpElaborado: false,
    trpAprovado: false,
    trpNumeroDocumento: '',
    trpSei: '',
    trpData: '',
    trpObservacao: '',

    // Termo de Recebimento Definitivo (TRD) & Glosas
    trdElaborado: false,
    trdAprovado: false,
    trdNumeroDocumento: '',
    trdSei: '',
    trdData: '',
    trdGlosa: '',
    trdObservacao: '',

    // Descentralização Orçamentária (MPO/SOF para MGI)
    descentralizacaoSei: '',
    descentralizacaoValor: '',
    descentralizacaoDescricao: '',
    descentralizacoes: [] as DescentralizacaoItem[],

    // Processo SEI específico de Pagamento
    processoSeiPagamento: ''
  });
  
  // OS (Ordem de Serviço) form state
  const [osFormData, setOsFormData] = useState({
    numeroOS: '',
    dataEmissao: '',
    valor: '',
    prazoEntrega: '',
    statusOS: 'Pendente' as 'Pendente' | 'Executada' | 'Em Execução' | 'Cancelada',
    observacao: ''
  });

  // TRP/TRD Form States
  const [trpElaborado, setTrpElaborado] = useState(false);
  const [trpAprovado, setTrpAprovado] = useState(false);
  const [trpObservacao, setTrpObservacao] = useState('');
  const [trdElaborado, setTrdElaborado] = useState(false);
  const [trdAprovado, setTrdAprovado] = useState(false);
  const [trdObservacao, setTrdObservacao] = useState('');
  const [recebimentoSaveSuccess, setRecebimentoSaveSuccess] = useState(false);

  // OS Table sorting states (Default: Vigência Ref. em ordem cronológica ascendente)
  const [osSortKey, setOsSortKey] = useState<'numeroOS' | 'vigenciaRef' | 'empenho' | 'statusRecebimento' | 'valorEmissao' | 'glosa' | 'valorLiquido' | 'descentralizacao'>('vigenciaRef');
  const [osSortDirection, setOsSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleOsSort = (key: 'numeroOS' | 'vigenciaRef' | 'empenho' | 'statusRecebimento' | 'valorEmissao' | 'glosa' | 'valorLiquido' | 'descentralizacao') => {
    if (osSortKey === key) {
      setOsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setOsSortKey(key);
      setOsSortDirection('asc');
    }
  };

  const currentContractForForms = contratos.find(c => c.id === selectedContratoId);

  useEffect(() => {
    if (currentContractForForms) {
      setTrpElaborado(!!currentContractForForms.trpElaborado);
      setTrpAprovado(!!currentContractForForms.trpAprovado);
      setTrpObservacao(currentContractForForms.trpObservacao || '');
      setTrdElaborado(!!currentContractForForms.trdElaborado);
      setTrxAprovado(!!currentContractForForms.trdAprovado);
      setTrdObservacao(currentContractForForms.trdObservacao || '');
    } else {
      setTrpElaborado(false);
      setTrpAprovado(false);
      setTrpObservacao('');
      setTrdElaborado(false);
      setTrxAprovado(false);
      setTrdObservacao('');
    }
    setRecebimentoSaveSuccess(false);
  }, [selectedContratoId, currentContractForForms?.id]);

  function setTrxAprovado(val: boolean) {
    setTrdAprovado(val);
  }

  // Modals state
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isFornecedoresOpen, setIsFornecedoresOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isOcorrenciaModalOpen, setIsOcorrenciaModalOpen] = useState(false);
  const [isAlteracaoModalOpen, setIsAlteracaoModalOpen] = useState(false);
  const [isPagamentoModalOpen, setIsPagamentoModalOpen] = useState(false);

  // Custom delete confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'contrato' | 'aditivo' | 'apostilamento' | 'pagamento' | 'ocorrencia' | 'fornecedor' | 'itemSOF';
    id: string;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'contrato',
    id: '',
    title: '',
    message: '',
  });

  const handleExecuteDelete = () => {
    const { type, id } = deleteConfirm;
    if (type === 'contrato') {
      onDeleteContrato(id);
      setSelectedContratoId(null);
    } else if (type === 'aditivo') {
      const ad = aditivos.find(a => a.id === id);
      if (ad && ad.Meses_Renovacoes > 0) {
        const contract = contratos.find(c => c.id === ad.Num_Contrato || c.Num_Contrato === ad.Num_Contrato);
        if (contract) {
          onEditContrato({
            ...contract,
            Numero_Renovacoes: Math.max(0, (contract.Numero_Renovacoes || 0) - ad.Meses_Renovacoes),
            updatedAt: new Date(currentLocalTime).toISOString()
          });
        }
      }
      onDeleteAditivo(id);
    } else if (type === 'apostilamento') {
      onDeleteApostilamento(id);
    } else if (type === 'ocorrencia') {
      onDeleteHistoricoContratual(id);
    } else if (type === 'pagamento') {
      onDeletePagamento(id);
    } else if (type === 'fornecedor') {
      if (onDeleteFornecedor) {
        onDeleteFornecedor(id);
      }
    } else if (type === 'itemSOF') {
      onDeleteItemSOF(id);
    }
    setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
  };
  
  const [contractAttachedFileName, setContractAttachedFileName] = useState('');
  const [contractAttachedFileData, setContractAttachedFileData] = useState('');
  const [editingContratoId, setEditingContratoId] = useState<string | null>(null);
  const contractFileInputRef = useRef<HTMLInputElement>(null);
  const [viewingContractPdf, setViewingContractPdf] = useState<Contrato | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let activeUrl: string | null = null;
    
    if (viewingContractPdf?.LinkContrato) {
      const link = viewingContractPdf.LinkContrato;
      if (link.startsWith('data:')) {
        try {
          const arr = link.split(',');
          // Determina o mime type; ou assume application/pdf
          const mimeMatch = arr[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const blob = new Blob([u8arr], { type: mime });
          activeUrl = URL.createObjectURL(blob);
          setPdfBlobUrl(activeUrl);
        } catch (e) {
          console.error("Erro ao gerar blob URL do anexo:", e);
          setPdfBlobUrl(null);
        }
      } else {
        setPdfBlobUrl(link);
      }
    } else {
      setPdfBlobUrl(null);
    }

    return () => {
      if (activeUrl && activeUrl.startsWith('blob:')) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [viewingContractPdf]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusContrato[]>(['Vigente', 'A Vencer']);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination states for Contracts
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Sorting configurations for Contracts
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

  // Expiration Alerts Interactive Panel states
  const [isAlertsPanelExpanded, setIsAlertsPanelExpanded] = useState(false);
  const [selectedAlertSeverity, setSelectedAlertSeverity] = useState<'todos' | 'critico' | 'altorisco' | 'alerta' | 'atencao'>('todos');

  // ICTI OData API states from Ipeadata
  const [ictiLoading, setIctiLoading] = useState(false);
  const [ictiData, setIctiData] = useState<{ date: string; value: number }[]>([]);
  const [ictiLatest, setIctiLatest] = useState<{ date: string; value: number } | null>(null);
  const [isIctiPanelExpanded, setIsIctiPanelExpanded] = useState(false);

  // ICTI Calculator states
  const [calcSelectedContratoId, setCalcSelectedContratoId] = useState<string>('');
  const [calcSelectedRate, setCalcSelectedRate] = useState<number>(0);
  const [calcProcessoSEI, setCalcProcessoSEI] = useState<string>('');

  useEffect(() => {
    let active = true;
    const fetchICTI = async () => {
      setIctiLoading(true);
      try {
        const bundle = await getIctiSeriesBundle();
        if (active) {
          setIctiData(bundle.series12m);
          setIctiLatest(bundle.latest12m);
        }
      } catch (err) {
        console.warn("Aviso ao obter ICTI:", err);
      } finally {
        if (active) setIctiLoading(false);
      }
    };
    fetchICTI();
    return () => { active = false; };
  }, []);

  const getContractExpirationDays = (c: Contrato) => {
    const prorrogaMeses = aditivos
      .filter(ad => (ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
      .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
    const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(c.Numero_Renovacoes) || 0);
    const end = getVigenciaFinal(c.Vigencia_Inicio, c.Vigencia_Inicial_Meses, totalRenovacaoMeses);
    const diffMs = end.getTime() - new Date(currentLocalTime).getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const handleProposeProrrogacao = (c: Contrato) => {
    setSelectedContratoId(c.id);
    setActiveTab('aditamentos');
    setIsAlteracaoModalOpen(true);
  };

  const exportContratosToPDF = () => {
    const totalAnualizadoValue = filteredContratos.reduce((sum, c) => {
      const sofRes = getContractSOFValueForYear(c, targetYearNum, false);
      return sum + sofRes.value;
    }, 0);

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
          <title>Relatório de Contratos de TIC</title>
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
            }
            .status-vigente {
              background-color: #e0f2fe;
              color: #0369a1;
            }
            .status-vencer {
              background-color: #fef3c7;
              color: #d97706;
            }
            .status-encerrado {
              background-color: #f1f5f9;
              color: #475569;
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
                  <h1 class="title">CONTRATICS - GECTI</h1>
                  <h2 class="subtitle">Relatório Geral dos Contratos de TIC</h2>
                </div>
              </div>
              <div class="meta-info">
                <div><strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}</div>
                <div><strong>Ano de Exercício:</strong> ${selectedYear || '2026'}</div>
                <div><strong>Filtros:</strong> Busca: "${searchQuery || 'Todos'}" | Status: ${statusFilter.join(', ')}</div>
              </div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Contratos Encontrados</div>
              <div class="stat-value">${filteredContratos.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Anualizado (${selectedYear || '2026'})</div>
              <div class="stat-value font-mono">R$ ${totalAnualizadoValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Órgão Regulador</div>
              <div class="stat-value">UASG 201130 (MPO/SOF)</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 10%">Nº Contrato</th>
                <th style="width: 10%">Processo SEI</th>
                <th style="width: 14%">Modalidade</th>
                <th style="width: 18%">Empresa / Fornecedor</th>
                <th style="width: 26%">Objeto Regulamentar</th>
                <th style="width: 12%" class="text-right font-mono">Valor Anual SOF (${selectedYear || '2026'})</th>
                <th style="width: 10%">Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredContratos.map(cont => {
                const fornObj = fornecedores.find(f => f.id === cont.Fornecedor);
                const fornName = fornObj ? fornObj.Nome_Fornecedor : (cont.Fornecedor || 'Não cadastrado');
                const sofInfo = getContractSOFValueForYear(cont, targetYearNum);
                const orcEstimadoDate = cont.Data_Orcamento_Estimado ? formatDate(cont.Data_Orcamento_Estimado) : null;
                return `
                  <tr>
                    <td class="font-mono" style="font-weight: 700;">${cont.Num_Contrato}</td>
                    <td class="font-mono">${cont.SEI_Processo}</td>
                    <td>
                      <span style="display:inline-block; font-size:8px; font-weight:700; padding:2px 5px; border-radius:4px; text-transform:uppercase; color:${cont.Modalidade_Contratacao === 'Pregão Colaboragov' ? '#0284c7' : '#0f766e'}; background-color:${cont.Modalidade_Contratacao === 'Pregão Colaboragov' ? '#f0f9ff' : '#f0fdfa'};">
                        ${cont.Modalidade_Contratacao || 'Pregão SOF'}
                      </span>
                    </td>
                    <td><strong>${fornName}</strong></td>
                    <td>
                      ${cont.Objeto}
                      <br/>
                      <span style="font-size: 9px; color: #64748b;">
                        Gestor: ${cont.Gestor_Contrato || 'N/A'} &bull; Frequência: ${cont.Periodicidade_Pagamento}
                        ${orcEstimadoDate ? ` &bull; Orç. Estimado: ${orcEstimadoDate}` : ''}
                      </span>
                    </td>
                    <td class="font-mono text-right" style="font-weight: 500;">
                      <div style="font-weight: 700; color: #0284c7;">R$ ${sofInfo.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <span style="font-size: 8.5px; color: #64748b; display: block;">Global: R$ ${cont.Valor_Contrato.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </td>
                    <td>
                      <span class="status ${
                        cont.Status_Contrato === 'Vigente' ? 'status-vigente' : 
                        cont.Status_Contrato === 'A Vencer' ? 'status-vencer' : 'status-encerrado'
                      }">${cont.Status_Contrato || 'Vigente'}</span>
                    </td>
                  </tr>
                `;
              }).join('')}
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

  const exportFichaContratoToPDF = (c: Contrato) => {
    // 1. Find supplier
    const supplier = fornecedores.find(f => f.id === c.Fornecedor);
    const supplierName = supplier?.Nome_Fornecedor || c.Fornecedor || 'Não indicado';
    const supplierCnpj = supplier?.CNPJ || 'N/A';
    const supplierEmail = supplier?.EmailContato || 'N/A';
    const supplierPhone = supplier?.TelefoneContato || 'N/A';

    // 2. Filter contract items
    const rawContractItens = itensSOF.filter(item => item.Num_Contrato === c.id || item.Num_Contrato === c.Num_Contrato);
    const contractItens = rawContractItens;
    const groupedContractItens = sortAndGroupItems(rawContractItens);

    // 3. Filter aditamentos & apostilamentos
    const contractAditivos = aditivos.filter(ad => ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato);
    const contractApostilamentos = apostilamentos.filter(ap => ap.Num_Contrato === c.id || ap.Num_Contrato === c.Num_Contrato);
    const contractPayments = pagamentos.filter(p => p.Num_Contrato === c.id || p.Num_Contrato === c.Num_Contrato);

    // 4. Budget calculations and SOF metrics (Mirroring UI)
    const annualSoFVal = calculateValorAnualItemsSOF(c.id, c.Vigencia_Inicial_Meses || 12);
    
    // Dynamically calculate final value
    let computedValorAtualizado = c.Valor_Contrato;
    contractAditivos.forEach(ad => {
      if (ad.Tipo_Aditivo === 'Acréscimo') computedValorAtualizado += ad.Valor_Aditivado;
      if (ad.Tipo_Aditivo === 'Supressão') computedValorAtualizado -= ad.Valor_Aditivado;
    });
    contractApostilamentos.forEach(ap => {
      computedValorAtualizado += ap.Valor_do_Ajuste;
    });

    const deltaValor = computedValorAtualizado - c.Valor_Contrato;
    const sofSharePercent = computedValorAtualizado > 0 ? Math.min(100, (annualSoFVal / computedValorAtualizado) * 100).toFixed(1) : '0';

    const isTotalPayment = c.Periodicidade_Pagamento === 'Total';
    const startYear = c.Vigencia_Inicio ? new Date(c.Vigencia_Inicio).getUTCFullYear() : null;
    const isSignedPriorYear = startYear ? startYear < targetYearNum : false;

    const execExerc = getContractBudgetExecution(c, targetYearNum);
    const baseSoFVal = annualSoFVal > 0 ? annualSoFVal : (computedValorAtualizado || execExerc.empenhado || 1);

    let empenhadoSoF = execExerc.empenhado;
    let liquidadoSoF = execExerc.liquidado;
    let pagoSoF = (isTotalPayment && isSignedPriorYear) ? annualSoFVal : execExerc.pago;

    if (isTotalPayment && isSignedPriorYear) {
      empenhadoSoF = annualSoFVal;
      liquidadoSoF = annualSoFVal;
      pagoSoF = annualSoFVal;
    }

    const saldoSoF = Math.max(0, baseSoFVal - pagoSoF);
    const empenhadoSoFPercent = baseSoFVal > 0 ? Math.min(100, (empenhadoSoF / baseSoFVal) * 100).toFixed(0) : '0';
    const liquidadoSoFPercent = baseSoFVal > 0 ? Math.min(100, (liquidadoSoF / baseSoFVal) * 100).toFixed(0) : '0';
    const pagoSoFPercent = baseSoFVal > 0 ? Math.min(100, (pagoSoF / baseSoFVal) * 100).toFixed(0) : '0';

    const { custeio, investimento } = getContractCusteioInvestimento(c, computedValorAtualizado);
    const totalGnd = custeio + investimento;
    const custeioPercent = totalGnd > 0 ? ((custeio / totalGnd) * 100).toFixed(0) : '0';
    const investimentoPercent = totalGnd > 0 ? ((investimento / totalGnd) * 100).toFixed(0) : '0';

    // SVG Donut Chart for GND (Custeio vs Investimento)
    const rGnd = 36;
    const circGnd = 2 * Math.PI * rGnd;
    const pCusteio = totalGnd > 0 ? custeio / totalGnd : 1;
    const dashCusteio = pCusteio * circGnd;
    const dashInvest = circGnd - dashCusteio;

    const donutGndSvg = `
      <svg width="84" height="84" viewBox="0 0 84 84" style="transform: rotate(-90deg);">
        <circle r="${rGnd}" cx="42" cy="42" fill="transparent" stroke="#f1f5f9" stroke-width="10" />
        <circle r="${rGnd}" cx="42" cy="42" fill="transparent" stroke="#10b981" stroke-width="10" 
          stroke-dasharray="${dashInvest.toFixed(1)} ${(circGnd - dashInvest).toFixed(1)}" 
          stroke-dashoffset="${(-dashCusteio).toFixed(1)}" />
        <circle r="${rGnd}" cx="42" cy="42" fill="transparent" stroke="#3b82f6" stroke-width="10" 
          stroke-dasharray="${dashCusteio.toFixed(1)} ${(circGnd - dashCusteio).toFixed(1)}" 
          stroke-dashoffset="0" />
      </svg>
    `;

    // SVG Bar Chart for SOF Budget Execution
    const maxValChart = Math.max(baseSoFVal, empenhadoSoF, liquidadoSoF, pagoSoF, 1);
    const barHeightEmp = Math.max(4, Math.round((empenhadoSoF / maxValChart) * 60));
    const barHeightLiq = Math.max(4, Math.round((liquidadoSoF / maxValChart) * 60));
    const barHeightPago = Math.max(4, Math.round((pagoSoF / maxValChart) * 60));

    const barChartSofSvg = `
      <svg width="120" height="84" viewBox="0 0 120 84">
        <!-- Empenhado Bar -->
        <rect x="15" y="${70 - barHeightEmp}" width="20" height="${barHeightEmp}" rx="3" fill="#eab308" />
        <text x="25" y="${65 - barHeightEmp}" font-size="8" font-weight="700" fill="#a16207" text-anchor="middle">${isTotalPayment && isSignedPriorYear ? '100%' : `${empenhadoSoFPercent}%`}</text>
        <text x="25" y="80" font-size="7.5" font-weight="600" fill="#64748b" text-anchor="middle">Emp</text>

        <!-- Liquidado Bar -->
        <rect x="50" y="${70 - barHeightLiq}" width="20" height="${barHeightLiq}" rx="3" fill="#3b82f6" />
        <text x="60" y="${65 - barHeightLiq}" font-size="8" font-weight="700" fill="#1d4ed8" text-anchor="middle">${isTotalPayment && isSignedPriorYear ? '100%' : `${liquidadoSoFPercent}%`}</text>
        <text x="60" y="80" font-size="7.5" font-weight="600" fill="#64748b" text-anchor="middle">Liq</text>

        <!-- Pago Bar -->
        <rect x="85" y="${70 - barHeightPago}" width="20" height="${barHeightPago}" rx="3" fill="#10b981" />
        <text x="95" y="${65 - barHeightPago}" font-size="8" font-weight="700" fill="#047857" text-anchor="middle">${isTotalPayment && isSignedPriorYear ? '100%' : `${pagoSoFPercent}%`}</text>
        <text x="95" y="80" font-size="7.5" font-weight="600" fill="#64748b" text-anchor="middle">Pago</text>
      </svg>
    `;

    const SOF_LOGO_SVG = `
      <svg width="180" height="54" viewBox="0 0 240 80" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
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
          <title>Relatório - Ficha Detalhada do Contrato ${c.Num_Contrato}</title>
          <style>
            body {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              color: #0f172a;
              padding: 24px;
              margin: 0;
              background-color: #ffffff;
            }
            .header {
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 12px;
              margin-bottom: 20px;
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
              gap: 16px;
            }
            .logo-placeholder {
              flex-shrink: 0;
            }
            .title {
              font-size: 18px;
              font-weight: 800;
              color: #0f172a;
              margin: 0;
              text-transform: uppercase;
              letter-spacing: -0.2px;
            }
            .subtitle {
              font-size: 12px;
              color: #475569;
              margin: 4px 0 0 0;
              font-weight: 500;
            }
            .meta-info {
              font-size: 11px;
              color: #64748b;
              text-align: right;
              line-height: 1.5;
            }
            .section-title {
              font-size: 12px;
              font-weight: 700;
              color: #1e3a8a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 4px;
              margin-top: 24px;
              margin-bottom: 10px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
              margin-bottom: 12px;
            }
            .info-grid-3 {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 10px;
              margin-bottom: 12px;
            }
            .info-grid-4 {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 12px;
            }
            .modules-grid-2 {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 12px;
              margin-bottom: 12px;
              page-break-inside: avoid;
            }
            .info-card {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 10px 12px;
            }
            .info-label {
              font-size: 8.5px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .info-value {
              font-size: 11px;
              font-weight: 500;
              color: #0f172a;
              margin-top: 2px;
              line-height: 1.4;
            }
            .info-value-strong {
              font-weight: 700;
              color: #1e3a8a;
            }
            .flex-container {
              display: flex;
              gap: 20px;
              align-items: flex-start;
              margin-bottom: 12px;
              page-break-inside: avoid;
            }
            .budget-execution-section {
              flex: 1;
            }
            .chart-container {
              display: flex;
              align-items: center;
              gap: 24px;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 12px 16px;
            }
            .donut-container {
              width: 100px;
              height: 100px;
              flex-shrink: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
            }
            .donut-chart {
              transform: rotate(-90deg);
            }
            .donut-center-text {
              position: absolute;
              text-align: center;
              font-size: 10px;
              font-weight: 700;
              color: #1e3a8a;
            }
            .chart-legend {
              font-size: 11px;
              color: #334155;
              width: 100%;
            }
            .legend-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 4px;
            }
            .legend-label-container {
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .legend-color {
              width: 8px;
              height: 8px;
              border-radius: 50%;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
              margin-bottom: 16px;
            }
            tr {
              page-break-inside: avoid;
            }
            th {
              background-color: #f1f5f9;
              color: #475569;
              font-weight: 700;
              font-size: 9px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 6px 8px;
              border-bottom: 2px solid #cbd5e1;
              text-align: left;
            }
            td {
              padding: 6px 8px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 10px;
              color: #334155;
              vertical-align: top;
            }
            .font-mono {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .no-data {
              font-style: italic;
              color: #64748b;
              font-size: 11px;
              padding: 8px 12px;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              text-align: center;
            }
            @media print {
              body {
                padding: 10px;
              }
              @page {
                size: A4 portrait;
                margin: 0.8cm;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <div class="title-section">
                <div class="logo-placeholder">
                  <img src="${window.location.origin}/sof-logo.png" id="sof-image-logo" style="height: 48px; width: auto; display: none;" onload="this.style.display='block'; document.getElementById('sof-svg-logo').style.display='none';" onerror="this.style.display='none'; document.getElementById('sof-svg-logo').style.display='block';" />
                  <div id="sof-svg-logo">
                    ${SOF_LOGO_SVG}
                  </div>
                </div>
                <div>
                  <h1 class="title">CONTRATICS - FICHA DE CONTRATO</h1>
                  <h2 class="subtitle">Secretaria de Orçamento Federal - SOF</h2>
                </div>
              </div>
              <div class="meta-info">
                <div><strong>Ref. Contrato:</strong> ${c.Num_Contrato}</div>
                <div><strong>Gerado em:</strong> ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</div>
                <div><strong>Status:</strong> ${c.Status_Contrato || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div class="section-title">1. Informações Gerais do Contrato</div>
          <div class="info-grid">
            <div class="info-card" style="grid-column: span 2;">
              <div class="info-label">Objeto do Contrato</div>
              <div class="info-value info-value-strong">${c.Objeto}</div>
            </div>
            <div class="info-card">
              <div class="info-label">Número do Contrato</div>
              <div class="info-value font-mono info-value-strong" style="font-size:12px;">${c.Num_Contrato}</div>
            </div>
            <div class="info-card">
              <div class="info-label">Processo SEI</div>
              <div class="info-value font-mono">${c.SEI_Processo}</div>
            </div>
            <div class="info-card">
              <div class="info-label">Empresa / Fornecedor Adjudicado</div>
              <div class="info-value info-value-strong" style="color: #0284c7;">
                ${supplierName} <br/>
                <span style="font-size: 9px; font-weight: normal; color: #64748b;">CNPJ: ${supplierCnpj} &bull; E-mail: ${supplierEmail} &bull; Tel: ${supplierPhone}</span>
              </div>
            </div>
            <div class="info-card">
              <div class="info-label">Vigência Inicial / Máxima</div>
              <div class="info-value">
                Início: <strong>${formatDate(c.Vigencia_Inicio)}</strong> a 
                Fim: <strong>${c.Vigencia_Final ? formatDate(c.Vigencia_Final) : 'N/A'}</strong> <br/>
                <span style="font-size: 9px; color: #64748b;">Prazo Inicial: ${c.Vigencia_Inicial_Meses} meses &bull; Prorrogabilidade máxima: até ${c.Tempo_Possivel_Prorrogacao_Meses} meses</span>
              </div>
            </div>
            <div class="info-card">
              <div class="info-label">Modalidade de Contratação</div>
              <div class="info-value">
                <span style="font-weight:700; color:${c.Modalidade_Contratacao === 'Pregão Colaboragov' ? '#0284c7' : '#0f766e'};">
                  ${c.Modalidade_Contratacao || 'Pregão SOF'}
                </span>
              </div>
            </div>
            <div class="info-card">
              <div class="info-label">Data do Orçamento Estimado (Data-Base Reajuste ICTI)</div>
              <div class="info-value">
                <strong>${c.Data_Orcamento_Estimado ? formatDate(c.Data_Orcamento_Estimado) : 'Não informada'}</strong>
                ${c.Data_Orcamento_Estimado ? `<span style="display:block; font-size:8.5px; color:#0f766e;">(Marco regulatório do ciclo anual de reajuste do contrato)</span>` : ''}
              </div>
            </div>
            <div class="info-card" style="grid-column: span 2;">
              <div class="info-label">Periodicidade de Pagamento / Portaria de Fiscalização</div>
              <div class="info-value">
                Frequência de Pagamento: <strong>${c.Periodicidade_Pagamento}</strong> &bull;
                Portaria: <strong>${c.Portaria_Fiscalizacao_Numero || 'Sem portaria cadastrada'}</strong> ${c.Portaria_Fiscalizacao_SEI ? `(SEI: ${c.Portaria_Fiscalizacao_SEI})` : ''}
              </div>
            </div>
          </div>

          <div class="section-title">2. Equipe de Gestão e Fiscalização</div>
          <div class="info-grid-3">
            <div class="info-card">
              <div class="info-label">Gestão Técnica do Contrato</div>
              <div class="info-value">
                Titular: <strong>${c.Gestor_Contrato || 'N/A'}</strong> <br/>
                Substituto: <strong>${c.Gestor_Substituto || 'N/A'}</strong>
              </div>
            </div>
            <div class="info-card">
              <div class="info-label">Fiscalização Técnica</div>
              <div class="info-value">
                Titular: <strong>${c.Fiscal_Tecnico || 'N/A'}</strong> <br/>
                Substituto: <strong>${c.Fiscal_Tecnico_Substituto || 'N/A'}</strong>
              </div>
            </div>
            <div class="info-card">
              <div class="info-label">Fiscalização Administrativa</div>
              <div class="info-value">
                Titular: <strong>${c.Fiscal_Administrativo || 'N/A'}</strong> <br/>
                Substituto: <strong>${c.Fiscal_Administrativo_Substituto || 'N/A'}</strong>
              </div>
            </div>
            <div class="info-card">
              <div class="info-label">Fiscalização Requisitante</div>
              <div class="info-value">
                Titular: <strong>${c.Fiscal_Requisitante || 'N/A'}</strong> <br/>
                Substituto: <strong>${c.Fiscal_Requisitante_Substituto || 'N/A'}</strong>
              </div>
            </div>
            <div class="info-card" style="grid-column: span 2;">
              <div class="info-label">Preposto Designado pela Empresa</div>
              <div class="info-value">
                Nome: <strong>${c.Preposto || 'Não indicado'}</strong> <br/>
                Contacto: <span class="font-mono" style="font-size:9.5px; color:#1e3a8a;">${c.EmailPreposto || 'Sem e-mail'}</span>
              </div>
            </div>
          </div>

          <div class="section-title">3. Detalhamento Financeiro e Orçamentário</div>
          
          <!-- Grid com os 4 Cards Analíticos -->
          <div class="info-grid-4">
            <div class="info-card">
              <div class="info-label">Valor Global Atualizado</div>
              <div class="info-value font-mono info-value-strong" style="font-size: 12px; color: #1e3a8a;">
                ${formatCurrency(computedValorAtualizado)}
              </div>
              <div style="font-size: 8px; color: #64748b; margin-top: 3px; line-height: 1.3;">
                Inicial: ${formatCurrency(c.Valor_Contrato)} ${deltaValor !== 0 ? `(${deltaValor > 0 ? '+' : ''}${formatCurrency(deltaValor)})` : ''}
              </div>
            </div>

            <div class="info-card">
              <div class="info-label">Itens SOF (${targetYearNum})</div>
              <div class="info-value font-mono info-value-strong" style="font-size: 12px; color: #0284c7;">
                ${formatCurrency(annualSoFVal)}
              </div>
              <div style="font-size: 8px; color: #64748b; margin-top: 3px; line-height: 1.3;">
                ${isTotalPayment ? 'Pagamento Total' : 'Proporcional Anualizado'} &bull; ${sofSharePercent}%
              </div>
            </div>

            <div class="info-card">
              <div class="info-label">Participação SOF</div>
              <div class="info-value font-mono info-value-strong" style="font-size: 12px; color: #475569;">
                ${sofSharePercent}% <span style="font-size: 8.5px; font-weight: normal; color: #64748b;">do total</span>
              </div>
              <div style="font-size: 8px; color: #64748b; margin-top: 3px; line-height: 1.3;">
                Periodicidade: ${c.Periodicidade_Pagamento}
              </div>
            </div>

            <div class="info-card" style="background-color: #f0fdf4; border-color: #bbf7d0;">
              <div class="info-label" style="color: #166534;">Saldo SOF a Executar</div>
              <div class="info-value font-mono info-value-strong" style="font-size: 12px; color: #15803d;">
                ${formatCurrency(saldoSoF)}
              </div>
              <div style="font-size: 8px; color: #166534; margin-top: 3px; line-height: 1.3;">
                Pago SOF: ${formatCurrency(pagoSoF)}
              </div>
            </div>
          </div>

          <!-- Grid com os 2 Módulos Analíticos (Custeio/Investimento e Execução SOF) -->
          <div class="modules-grid-2">
            <!-- Módulo 1: Custeio vs. Investimento (Itens SOF) -->
            <div class="info-card" style="display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">
                  <span style="font-size: 9px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px;">Custeio vs. Investimento (Itens SOF)</span>
                  <span style="font-size: 8px; font-weight: 600; color: #64748b;">GND 3 / GND 4</span>
                </div>
                
                <div style="display: flex; align-items: center; gap: 12px; margin-top: 4px;">
                  <div style="position: relative; width: 84px; height: 84px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    ${donutGndSvg}
                    <div style="position: absolute; text-align: center;">
                      <span style="font-size: 10px; font-weight: 800; color: #1e3a8a; display: block; line-height: 1;">${custeioPercent}%</span>
                      <span style="font-size: 6.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Custeio</span>
                    </div>
                  </div>

                  <div style="flex: 1; font-size: 9.5px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                      <div style="display: flex; align-items: center; gap: 5px;">
                        <span style="width: 7px; height: 7px; border-radius: 50%; background-color: #3b82f6; display: inline-block;"></span>
                        <span style="font-weight: 600; color: #334155;">Custeio (GND 3):</span>
                      </div>
                      <strong class="font-mono" style="color: #1d4ed8;">${formatCurrency(custeio)} <span style="font-size: 8px; color: #64748b; font-weight: normal;">(${custeioPercent}%)</span></strong>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                      <div style="display: flex; align-items: center; gap: 5px;">
                        <span style="width: 7px; height: 7px; border-radius: 50%; background-color: #10b981; display: inline-block;"></span>
                        <span style="font-weight: 600; color: #334155;">Investimento (GND 4):</span>
                      </div>
                      <strong class="font-mono" style="color: #047857;">${formatCurrency(investimento)} <span style="font-size: 8px; color: #64748b; font-weight: normal;">(${investimentoPercent}%)</span></strong>
                    </div>

                    <div style="border-top: 1px dashed #e2e8f0; padding-top: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 8.5px; color: #64748b;">
                      <span>Total dos Itens SOF:</span>
                      <strong class="font-mono" style="color: #0f172a;">${formatCurrency(totalGnd)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Módulo 2: Execução dos Itens SOF -->
            <div class="info-card" style="display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">
                  <span style="font-size: 9px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px;">Execução dos Itens SOF ${isTotalPayment ? '(Valor Total)' : `(${targetYearNum})`}</span>
                  <span style="font-size: 8px; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 1px 5px; border-radius: 4px;">Itens SOF</span>
                </div>

                <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
                  <div style="width: 120px; height: 84px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                    ${barChartSofSvg}
                  </div>

                  <div style="flex: 1; font-size: 9px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <span style="color: #a16207; font-weight: 600;">Empenhado SOF:</span>
                      <strong class="font-mono" style="color: #a16207;">${formatCurrency(empenhadoSoF)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <span style="color: #1d4ed8; font-weight: 600;">Liquidado SOF:</span>
                      <strong class="font-mono" style="color: #1d4ed8;">${formatCurrency(liquidadoSoF)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <span style="color: #047857; font-weight: 600;">Pago SOF:</span>
                      <strong class="font-mono" style="color: #047857;">${formatCurrency(pagoSoF)}</strong>
                    </div>
                    <div style="border-top: 1px solid #e2e8f0; padding-top: 4px; display: flex; justify-content: space-between; align-items: center; color: #166534; font-weight: 700;">
                      <span>Saldo SOF a Executar:</span>
                      <strong class="font-mono">${formatCurrency(saldoSoF)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="section-title">4. Itens Registrados do Contrato (SOF)</div>
          ${groupedContractItens.length === 0 ? `
            <div class="no-data">Nenhum item atrelado ao plano orçamentário SOF deste contrato.</div>
          ` : `
            <table>
              <thead>
                <tr>
                  <th width="12%">Grupo / Lote</th>
                  <th width="6%">Item</th>
                  <th>Descrição Detalhada do Item</th>
                  <th width="11%">Natureza</th>
                  <th width="8%">Status</th>
                  <th width="10%">UD. Medida</th>
                  <th width="6%" class="text-right">Qtd</th>
                  <th width="12%" class="text-right font-mono">Valor Unitário</th>
                  <th width="15%" class="text-right font-mono">Valor Total</th>
                </tr>
              </thead>
              <tbody>
                ${groupedContractItens.map(row => {
                  const item = row.item;
                  const natureText = item.Natureza_Despesa || 'Custeio';
                  const natureColor = natureText === 'Investimento' ? '#8b5cf6' : '#3b82f6';
                  const natureBg = natureText === 'Investimento' ? '#f5f3ff' : '#eff6ff';
                  const statusText = item.Status_Item || 'Ativo';
                  const statusColor = statusText === 'Cancelado' ? '#ef4444' : '#10b981';
                  const statusBg = statusText === 'Cancelado' ? '#fef2f2' : '#ecfdf5';
                  return `
                    <tr>
                      ${row.isFirstInGroup ? `
                        <td rowspan="${row.groupRowCount}" style="text-align: center; vertical-align: middle; font-weight: 700; background-color: #f8fafc; border-right: 1px solid #cbd5e1;">
                          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background-color: #e0f2fe; color: #0369a1; font-size: 9.5px; font-weight: 700;">
                            ${row.groupLabel}
                          </span>
                        </td>
                      ` : ''}
                      <td class="text-center font-mono"><strong>${item.Numero_Item}</strong></td>
                      <td>${item.Descricao_Item}</td>
                      <td>
                        <span style="display:inline-block; font-size:8px; font-weight:700; padding:2px 5px; border-radius:4px; text-transform:uppercase; color:${natureColor}; background-color:${natureBg}; border:1px solid ${natureColor}15;">
                          ${natureText}
                        </span>
                      </td>
                      <td>
                        <span style="display:inline-block; font-size:8px; font-weight:700; padding:2px 5px; border-radius:4px; text-transform:uppercase; color:${statusColor}; background-color:${statusBg}; border:1px solid ${statusColor}15;">
                          ${statusText}
                        </span>
                      </td>
                      <td>${item.Unidade_Medida}</td>
                      <td class="text-right font-mono">${item.Quantidade}</td>
                      <td class="text-right font-mono">${formatCurrency(item.Valor_Unitario)}</td>
                      <td class="text-right font-mono info-value-strong" style="${statusText === 'Cancelado' ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${formatCurrency(item.Quantidade * item.Valor_Unitario)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `}

          <div class="section-title">5. Histórico de Alterações (Aditivos e Apostilamentos)</div>
          ${(contractAditivos.length === 0 && contractApostilamentos.length === 0) ? `
            <div class="no-data">Não foram registrados Termos Aditivos ou Apostilamentos de reajuste para este contrato até o momento.</div>
          ` : `
            <table>
              <thead>
                <tr>
                  <th width="20%">Tipo de Instrumento</th>
                  <th width="12%">Data Registro</th>
                  <th width="18%">Processo SEI</th>
                  <th>Observações / Justificativa</th>
                  <th width="15%" class="text-right">Acréscimo / Prazo</th>
                </tr>
              </thead>
              <tbody>
                ${contractAditivos.map(ad => `
                  <tr>
                    <td><strong>Termo Aditivo (${ad.Tipo_Aditivo})</strong></td>
                    <td>${formatDate(ad.Data_Aditivo)}</td>
                    <td class="font-mono">${ad.Documento_SEI}</td>
                    <td>${ad.Observacoes || 'N/A'}</td>
                    <td class="text-right font-mono text-center">
                      ${ad.Meses_Renovacoes > 0 ? `<span style="color:#1e3a8a; font-weight:700;">+${ad.Meses_Renovacoes} meses</span><br/>` : ''}
                      ${ad.Valor_Aditivado > 0 ? `<strong style="color:${ad.Tipo_Aditivo === 'Supressão' ? '#ef4444' : '#10b981'}">${ad.Tipo_Aditivo === 'Supressão' ? '-' : '+'}${formatCurrency(ad.Valor_Aditivado)}</strong>` : 'N/A'}
                    </td>
                  </tr>
                `).join('')}
                ${contractApostilamentos.map(ap => `
                  <tr>
                    <td><strong>Termo de Apostilamento</strong></td>
                    <td>${formatDate(ap.Data_Apostilamento)}</td>
                    <td class="font-mono">${ap.Documento_SEI}</td>
                    <td>${ap.Observacoes || 'N/A'}</td>
                    <td class="text-right font-mono info-value-strong" style="color: #6366f1;">
                      Reajuste ${ap.Porcentagem_Reajuste}%<br/>(<strong>+${formatCurrency(ap.Valor_do_Ajuste)}</strong>)
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}

          <div class="section-title">6. Lançamentos de Notas de Empenho e Liquidação Financeira</div>
          ${contractPayments.length === 0 ? `
            <div class="no-data">Nenhum empenho ou pagamento financeiro cadastrado no cronograma deste contrato.</div>
          ` : `
            <table>
              <thead>
                <tr>
                  <th width="12%">Data Referência</th>
                  <th width="15%">Processo SEI</th>
                  <th width="15%">Status Financeiro</th>
                  <th>Histórico / Parcela / Descrição</th>
                  <th width="15%" class="text-right font-mono">Valor Lançado</th>
                </tr>
              </thead>
              <tbody>
                ${contractPayments.map(p => `
                  <tr>
                    <td>${formatDate(p.Data)}</td>
                    <td class="font-mono">${p.processoSeiPagamento || 'N/A'}</td>
                    <td>
                      <span class="status" style="
                        background-color: ${p.Status === 'Pago' ? '#e0f2fe' : p.Status === 'Liquidado' ? '#f0fdf4' : '#fef3c7'};
                        color: ${p.Status === 'Pago' ? '#0369a1' : p.Status === 'Liquidado' ? '#15803d' : '#d97706'};
                        padding: 3px 6px; border-radius: 4px; font-weight: 700; font-size: 8.5px; text-transform: uppercase;">
                        ${p.Status}
                      </span>
                    </td>
                    <td>${p.Descricao} ${p.Ano_Orcamento ? `&bull; Exercício ${p.Ano_Orcamento}` : ''}</td>
                    <td class="text-right font-mono" style="font-weight: 700; color: ${p.Status === 'Pago' ? '#0369a1' : '#334155'}">
                      ${formatCurrency(p.Valor)}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}

          <div class="section-title">7. Ordens de Serviço ${c.Modalidade_Contratacao === 'Pregão Colaboragov' ? 'e Descentralizações de Crédito (MPO ➔ MGI)' : '(Execução Orçamentária Direta SOF)'}</div>
          ${(!c.ordensServico || c.ordensServico.length === 0) ? `
            <div class="no-data">Nenhuma Ordem de Serviço registrada para este contrato.</div>
          ` : `
            <table>
              <thead>
                <tr>
                  <th width="10%">Nº OS</th>
                  <th width="10%">Emissão</th>
                  <th width="12%" class="text-right">Valor da OS</th>
                  <th width="15%">Empenho ${c.Modalidade_Contratacao === 'Pregão Colaboragov' ? '(MGI / Gerenciador)' : '(SOF)'}</th>
                  ${c.Modalidade_Contratacao === 'Pregão Colaboragov' ? `
                    <th width="28%">Descentralizações de Crédito & Empenhos Vinculados</th>
                    <th width="12%" class="text-right">Total Descentralizado</th>
                  ` : `
                    <th width="40%">Situação e Termos (TRP / TRD)</th>
                  `}
                  <th>Observações / Glosas</th>
                </tr>
              </thead>
              <tbody>
                ${c.ordensServico.map(os => {
                  const hasMultiDesc = Array.isArray(os.descentralizacoes) && os.descentralizacoes.length > 0;
                  const totalDescVal = hasMultiDesc 
                    ? os.descentralizacoes!.reduce((sum, d) => sum + (d.valor || 0), 0)
                    : (os.descentralizacaoValor || 0);

                  return `
                    <tr>
                      <td class="font-mono info-value-strong">${os.numeroOS}</td>
                      <td>${os.dataEmissao ? formatDate(os.dataEmissao) : '—'}</td>
                      <td class="text-right font-mono">${formatCurrency(os.valor || 0)}</td>
                      <td class="font-mono" style="color: #d97706;">
                        ${os.numeroEmpenho || 'Pendente'}
                        ${os.trpData ? `<br/><span style="color:#64748b; font-size:8.5px;">Data: ${formatDate(os.trpData)}</span>` : ''}
                      </td>
                      ${c.Modalidade_Contratacao === 'Pregão Colaboragov' ? `
                        <td>
                          ${hasMultiDesc ? `
                            <div style="font-size: 8.5px; space-y: 2px;">
                              ${os.descentralizacoes!.map((d, idx) => `
                                <div style="border-bottom: ${idx < os.descentralizacoes!.length - 1 ? '1px dashed #e2e8f0' : 'none'}; padding: 2px 0;">
                                  <strong style="color: #0284c7;">SEI: ${d.processoSei || 'Pendente'}</strong> (${formatCurrency(d.valor || 0)})
                                  ${d.data ? ` &bull; ${formatDate(d.data)}` : ''}
                                  <br/>
                                  <span style="color: #475569;">
                                    NE(s) Vinculada(s): <strong>${d.empenhosNumeros && d.empenhosNumeros.length > 0 ? d.empenhosNumeros.join(', ') : 'Geral / Não vinculado'}</strong>
                                  </span>
                                  ${d.descricao ? `<br/><span style="color:#64748b; font-style:italic;">${d.descricao}</span>` : ''}
                                </div>
                              `).join('')}
                            </div>
                          ` : (os.descentralizacaoSei ? `
                            <div style="font-size: 9px;">
                              <strong style="color: #0284c7;">SEI: ${os.descentralizacaoSei}</strong><br/>
                              ${os.descentralizacaoDescricao ? `<span style="color:#64748b;">${os.descentralizacaoDescricao}</span>` : ''}
                            </div>
                          ` : '<span style="color: #94a3b8; font-style: italic;">Pendente de descentralização</span>')}
                        </td>
                        <td class="text-right font-mono" style="font-weight: 700; color: ${totalDescVal > 0 ? '#0284c7' : '#94a3b8'}">
                          ${formatCurrency(totalDescVal)}
                        </td>
                      ` : `
                        <td style="font-size: 9px;">
                          <span style="color: #059669; font-weight: 700;">Execução Direta SOF</span>
                          ${os.trpElaborado ? `<br/><span style="color:#3b82f6;">TRP: Elaborado ${os.trpAprovado ? '(Aprovado)' : ''}</span>` : ''}
                          ${os.trdElaborado ? `<br/><span style="color:#10b981;">TRD: Elaborado ${os.trdAprovado ? '(Aprovado)' : ''}</span>` : ''}
                        </td>
                      `}
                      <td>
                        ${os.observacao || os.descentralizacaoDescricao || '—'}
                        ${os.trdGlosa && os.trdGlosa > 0 ? `
                          <div style="color: #ef4444; font-weight: bold; font-size: 8.5px; margin-top: 2px;">
                            Glosa Aplicada: -${formatCurrency(os.trdGlosa)} ${os.trdObservacao ? `(${os.trdObservacao})` : ''}
                          </div>
                        ` : ''}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `}
          
          <div style="margin-top: 32px; font-size: 9px; color: #64748b; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 10px; page-break-inside: avoid;">
            Fim do Relatório Oficial de Ficha Contratual &bull; Plataforma Contratics &bull; Sistema de Planejamento de Contratos de TIC (SOF)
          </div>
        </body>
      </html>
    `;

    // Trigger printing
    let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe';
      iframe.style.position = 'absolute';
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

  // Forms states
  const [contratoFormData, setContratoFormData] = useState<Partial<Contrato>>({
    Num_Contrato: '',
    Objeto: '',
    SEI_Processo: '',
    Vigencia_Inicio: '',
    Vigencia_Inicial_Meses: 12,
    Tempo_Possivel_Prorrogacao_Meses: 60,
    Numero_Renovacoes: 0,
    Valor_Contrato: 0,
    Valor_Atualizado: 0,
    Gestor_Contrato: '',
    Gestor_Substituto: '',
    Fiscal_Administrativo: '',
    Fiscal_Administrativo_Substituto: '',
    Fiscal_Tecnico: '',
    Fiscal_Tecnico_Substituto: '',
    Fiscal_Requisitante: '',
    Fiscal_Requisitante_Substituto: '',
    Preposto: '',
    EmailPreposto: '',
    Portaria_Fiscalizacao_Numero: '',
    Portaria_Fiscalizacao_SEI: '',
    Fornecedor: '',
    Periodicidade_Pagamento: 'Mensal',
    Modalidade_Contratacao: 'Pregão SOF',
  });

  const [itemFormData, setItemFormData] = useState<Partial<ItemContratoSOF>>({
    Numero_Item: '',
    Grupo_Lote: 'Lote 1',
    Descricao_Item: '',
    Unidade_Medida: 'Unidade',
    Quantidade: 1,
    Valor_Unitario: 0,
    Status_Item: 'Ativo',
  });

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemData, setEditingItemData] = useState<Partial<ItemContratoSOF> | null>(null);

  const handleStartInlineEdit = (item: ItemContratoSOF) => {
    setEditingItemId(item.id);
    setEditingItemData({ ...item });
  };

  const handleCancelInlineEdit = () => {
    setEditingItemId(null);
    setEditingItemData(null);
  };

  const handleSaveInlineItemSOF = () => {
    if (editingItemData && editingItemId) {
      onEditItemSOF(editingItemData as ItemContratoSOF);
      setEditingItemId(null);
      setEditingItemData(null);
    }
  };

  const setEditItemDataVal = (val: number) => {
    if (editingItemData) {
      setEditingItemData({ ...editingItemData, Valor_Unitario: val });
    }
  };

  const [ocorrenciaDesc, setOcorrenciaDesc] = useState('');
  const [ocorrenciaSEI, setOcorrenciaSEI] = useState('');
  const [ocorrenciaData, setOcorrenciaData] = useState('');

  const [alteracaoTipo, setAlteracaoTipo] = useState<'Aditivo' | 'Apostilamento'>('Aditivo');
  const [aditivoTipoSub, setAditivoTipoSub] = useState<'Prorrogação' | 'Acréscimo' | 'Supressão' | 'Reequilíbrio Econômico_Financeiro'>('Prorrogação');
  const [alteracaoValor, setAlteracaoValor] = useState(0);
  const [alteracaoPorcentagem, setAlteracaoPorcentagem] = useState(0);
  const [alteracaoMeses, setAlteracaoMeses] = useState(0);
  const [alteracaoSEI, setAlteracaoSEI] = useState('');
  const [alteracaoObs, setAlteracaoObs] = useState('');
  const [alteracaoData, setAlteracaoData] = useState('');
  const [alteracaoProcessoSEI, setAlteracaoProcessoSEI] = useState('');

  const [pagamentoFormData, setPagamentoFormData] = useState<Partial<Pagamento>>({
    Descricao: '',
    Data: currentLocalTime ? currentLocalTime.split('T')[0] : new Date().toISOString().split('T')[0],
    Valor: 0,
    Status: 'Pago',
    Documento_SEI: '',
    Ano_Orcamento: undefined,
    idOSVinculada: '',
    processoSeiPagamento: '',
  });

  // Inline/Quick supplier creator inside contract form
  const [isAddingSupplierInline, setIsAddingSupplierInline] = useState(false);
  const [inlineFornName, setInlineFornName] = useState('');
  const [inlineFornCNPJ, setInlineFornCNPJ] = useState('');
  const [inlineFornEmail, setInlineFornEmail] = useState('');
  const [inlineFornTelefone, setInlineFornTelefone] = useState('');

  const handleSaveSupplierInline = () => {
    if (!inlineFornName || !inlineFornCNPJ) {
      alert('Nome do Fornecedor e CNPJ são obrigatórios.');
      return;
    }
    if (!isValidCNPJ(inlineFornCNPJ)) {
      alert('CNPJ no formato inválido! Por favor, insira um CNPJ brasileiro válido (Ex: 00.000.000/0001-00).');
      return;
    }
    const newFornId = `forn-${Date.now()}`;
    onAddFornecedor({
      id: newFornId,
      Nome_Fornecedor: inlineFornName,
      CNPJ: inlineFornCNPJ,
      EmailContato: inlineFornEmail,
      TelefoneContato: inlineFornTelefone,
      Situacao: 'Ativo'
    });
    setContratoFormData(prev => ({
      ...prev,
      Fornecedor: newFornId
    }));
    setInlineFornName('');
    setInlineFornCNPJ('');
    setInlineFornEmail('');
    setInlineFornTelefone('');
    setIsAddingSupplierInline(false);
  };

  // Supplier creator structure
  const [fornFormId, setFornFormId] = useState<string | null>(null);
  const [fornName, setFornName] = useState('');
  const [fornCNPJ, setFornCNPJ] = useState('');
  const [fornEmail, setFornEmail] = useState('');
  const [fornTelefone, setFornTelefone] = useState('');

  // Handle local supplier save
  const handleSaveFornecedor = () => {
    if (!fornName || !fornCNPJ) {
      alert('Nome do Fornecedor e CNPJ são obrigatórios.');
      return;
    }
    if (!isValidCNPJ(fornCNPJ)) {
      alert('CNPJ no formato inválido! Por favor, insira um CNPJ brasileiro válido (Ex: 00.000.000/0001-00).');
      return;
    }
    if (fornFormId) {
      onEditFornecedor({
        id: fornFormId,
        Nome_Fornecedor: fornName,
        CNPJ: fornCNPJ,
        EmailContato: fornEmail,
        TelefoneContato: fornTelefone,
        Situacao: 'Ativo'
      });
      setFornFormId(null);
    } else {
      onAddFornecedor({
        id: `forn-${Date.now()}`,
        Nome_Fornecedor: fornName,
        CNPJ: fornCNPJ,
        EmailContato: fornEmail,
        TelefoneContato: fornTelefone,
        Situacao: 'Ativo'
      });
    }
    setFornName('');
    setFornCNPJ('');
    setFornEmail('');
    setFornTelefone('');
  };

  // Status switches
  const handleStatusCheck = (st: StatusContrato) => {
    if (statusFilter.includes(st)) {
      setStatusFilter(statusFilter.filter(s => s !== st));
    } else {
      setStatusFilter([...statusFilter, st]);
    }
  };

  // Recalculates formula: for Mensal/Anual -> (ValorTotalSOF / MesesVigencia) * 12; for Total -> ValorTotalSOF
  const calculateValorAnualItemsSOF = (id: string, initialMonths: number) => {
    const targetContrato = contratos.find(c => c.id === id || c.Num_Contrato === id);
    const totalSOFItemsVal = itensSOF
      .filter(i => (i.Num_Contrato === id || (targetContrato && i.Num_Contrato === targetContrato.Num_Contrato)) && i.Status_Item === 'Ativo')
      .reduce((sum, current) => sum + (current.Quantidade * current.Valor_Unitario), 0);
    
    // Contratos de Pagamento Total não são anualizados
    if (targetContrato?.Periodicidade_Pagamento === 'Total') {
      return totalSOFItemsVal;
    }
    
    const meses = initialMonths || 12;
    return (totalSOFItemsVal / meses) * 12;
  };

  const getContractCusteioInvestimento = (contract: Contrato | null, currentVal: number) => {
    if (!contract) return { custeio: 0, investimento: 0, isSOFOnly: false };
    const activeItems = (itensSOF || []).filter(i => 
      (i.Num_Contrato === contract.id || i.Num_Contrato === contract.Num_Contrato) && 
      i.Status_Item === 'Ativo'
    );
    
    if (activeItems.length > 0) {
      const itemCusteioSum = activeItems
        .filter(i => !i.Natureza_Despesa || i.Natureza_Despesa === 'Custeio')
        .reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
      const itemInvestimentoSum = activeItems
        .filter(i => i.Natureza_Despesa === 'Investimento')
        .reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
      
      return { 
        custeio: itemCusteioSum, 
        investimento: itemInvestimentoSum,
        isSOFOnly: true
      };
    } else {
      // Look up linked DFD values
      const linkedDfd = dfds.find(d => d.id === contract.DFD_Vinculado || d.Num_DFD === contract.DFD_Vinculado);
      if (linkedDfd) {
        const dCusteio = linkedDfd.Valor_Custeio || 0;
        const dInvest = linkedDfd.Valor_Investimento || 0;
        if (dCusteio > 0 || dInvest > 0) {
          return { custeio: dCusteio, investimento: dInvest, isSOFOnly: false };
        }
      }
      return { custeio: currentVal, investimento: 0, isSOFOnly: false };
    }
  };

  const getContractBudgetExecution = (contract: Contrato | null, targetYear?: number) => {
    if (!contract) return { empenhado: 0, liquidado: 0, pago: 0 };
    
    let empenhado = 0;
    let liquidado = 0;
    let pago = 0;

    const processedOsIds = new Set<string>();

    // 1. Process OS items of this contract
    if (contract.ordensServico) {
      contract.ordensServico.forEach(os => {
        processedOsIds.add(os.id);

        if (os.statusOS === 'Cancelada') return;

        let proportion = 1;
        if (targetYear !== undefined) {
          if (os.dataInicioPeriodo && os.dataFimPeriodo) {
            const start = new Date(`${os.dataInicioPeriodo}T00:00:00`);
            const end = new Date(`${os.dataFimPeriodo}T00:00:00`);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
              const yearStart = new Date(`${targetYear}-01-01T00:00:00`);
              const yearEnd = new Date(`${targetYear}-12-31T23:59:59`);

              const effectiveStart = Math.max(start.getTime(), yearStart.getTime());
              const effectiveEnd = Math.min(end.getTime(), yearEnd.getTime());

              if (effectiveEnd < effectiveStart) {
                proportion = 0;
              } else {
                const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                const overlapDays = Math.round((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24)) + 1;
                proportion = totalDays > 0 ? Math.min(1, Math.max(0, overlapDays / totalDays)) : 0;
              }
            }
          } else if (os.dataEmissao) {
            const emissaoDate = new Date(`${os.dataEmissao}T00:00:00`);
            if (!isNaN(emissaoDate.getTime())) {
              proportion = emissaoDate.getFullYear() === targetYear ? 1 : 0;
            }
          }
        }

        if (proportion <= 0) return;

        const valBase = (os.valor || 0) * proportion;
        const valGlosa = (os.trdGlosa || 0) * proportion;
        const valLiq = Math.max(0, valBase - valGlosa);
        const rawValEmp = (os.valorEmpenho !== undefined && os.valorEmpenho !== null && os.valorEmpenho > 0 ? os.valorEmpenho : (os.valor || 0)) * proportion;

        // 1. Status PAGO
        const hasPagoStatus = os.statusOS === 'Pago';
        const hasPagoPayment = pagamentos.some(p => p.idOSVinculada === os.id && p.Status === 'Pago');
        const isPaga = hasPagoStatus || hasPagoPayment;

        // 2. Status LIQUIDADO
        const hasTermosCompletos = Boolean(os.trpElaborado && os.trpAprovado && os.trdElaborado && os.trdAprovado);
        const isLiquidada = isPaga || os.statusOS === 'Liquidado' || hasTermosCompletos;

        // 3. Status EMPENHADO
        const hasNumEmpenho = Boolean(os.numeroEmpenho && os.numeroEmpenho.trim() !== '') || Boolean(os.empenhos && os.empenhos.length > 0);
        const isEmpenhada = isLiquidada || hasNumEmpenho || os.statusOS === 'Empenhado';

        if (isEmpenhada) {
          empenhado += Math.max(rawValEmp, isLiquidada ? valLiq : 0);
        }

        if (isLiquidada) {
          liquidado += valLiq;
        }

        if (isPaga) {
          pago += valLiq;
        }
      });
    }

    // 2. Process standalone manual payments for this contract
    const contractPayments = pagamentos.filter(p => p.Num_Contrato === contract.id);
    contractPayments.forEach(p => {
      if (p.idOSVinculada && processedOsIds.has(p.idOSVinculada)) return;

      let proportion = 1;
      if (targetYear !== undefined) {
        if (p.Ano_Orcamento) {
          proportion = p.Ano_Orcamento === targetYear ? 1 : 0;
        } else if (p.Data) {
          const d = new Date(`${p.Data}T00:00:00`);
          if (!isNaN(d.getTime())) {
            proportion = d.getFullYear() === targetYear ? 1 : 0;
          }
        }
      }

      if (proportion <= 0) return;

      const val = (p.Valor || 0) * proportion;

      if (p.Status === 'Empenhado') {
        empenhado += val;
      } else if (p.Status === 'Liquidado') {
        empenhado += val;
        liquidado += val;
      } else if (p.Status === 'Pago') {
        empenhado += val;
        liquidado += val;
        pago += val;
      }
    });

    return { empenhado, liquidado, pago };
  };

  const targetYearNum = parseInt(selectedYear === 'Todos' ? '2026' : selectedYear) || 2026;

  const getContractSOFValueForYear = (
    c: Contrato, 
    year: number, 
    forceUseItemsOnly: boolean = false
  ): { 
    value: number; 
    hasSOFItems: boolean; 
    source: 'items' | 'dfd' | 'fallback' | 'dfd_duplicate'; 
    dfdNum?: string; 
    duplicateMainContractNum?: string;
  } => {
    if (c.Status_Contrato?.toLowerCase() === 'encerrado') {
      return { value: 0, hasSOFItems: false, source: 'fallback' };
    }

    const startVal = new Date(c.Vigencia_Inicio);
    
    const prorrogaMeses = aditivos
      .filter(ad => (ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
      .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
    const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(c.Numero_Renovacoes) || 0);

    const endVal = new Date(c.Vigencia_Inicio);
    endVal.setUTCMonth(endVal.getUTCMonth() + (Number(c.Vigencia_Inicial_Meses) || 12) + totalRenovacaoMeses);

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    if (startVal > yearEnd || endVal < yearStart) {
      return { value: 0, hasSOFItems: false, source: 'fallback' };
    }

    // Active SOF items
    const activeItems = (itensSOF || []).filter(i => 
      (i.Num_Contrato === c.id || i.Num_Contrato === c.Num_Contrato) && 
      i.Status_Item === 'Ativo'
    );

    const hasSOFItems = activeItems.length > 0;

    const isSignedPriorYear = startVal.getUTCFullYear() < year;
    const isRestosAPagar = c.Periodicidade_Pagamento === 'Total' && isSignedPriorYear;

    const calcStart = startVal > yearStart ? startVal : yearStart;
    
    const isSimPerspective = !!(c.Perspectiva_Renovacao && hasSOFItems && !isRestosAPagar);
    const calcEnd = isSimPerspective ? yearEnd : (endVal < yearEnd ? endVal : yearEnd);

    const activeFractionalMonths = getFractionalMonths(calcStart, calcEnd);

    let baseValue = 0;
    let source: 'items' | 'dfd' | 'fallback' | 'dfd_duplicate' = 'fallback';
    let dfdNum: string | undefined = undefined;
    let duplicateMainContractNum: string | undefined = undefined;

    if (hasSOFItems) {
      baseValue = activeItems.reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
      source = 'items';
    } else {
      if (forceUseItemsOnly) {
        return { value: 0, hasSOFItems: false, source: 'fallback' };
      }
      
      // If we fall back to the DFD associated to it
      const linkedDfd = dfds.find(d => d.id === c.DFD_Vinculado || d.Num_DFD === c.DFD_Vinculado);
      if (linkedDfd) {
        dfdNum = linkedDfd.Num_DFD;

        // Detect all contracts sharing this DFD that also have NO active SOF items (so they fall back to the DFD)
        const sharingContracts = (contratos || []).filter(other => {
          if (other.Status_Contrato?.toLowerCase() === 'encerrado') return false;
          
          const otherLinkedDfd = dfds.find(d => d.id === other.DFD_Vinculado || d.Num_DFD === other.DFD_Vinculado);
          const isLinkedToSame = other.DFD_Vinculado === c.DFD_Vinculado || 
                                 (linkedDfd && (other.DFD_Vinculado === linkedDfd.id || other.DFD_Vinculado === linkedDfd.Num_DFD)) ||
                                 (otherLinkedDfd && (c.DFD_Vinculado === otherLinkedDfd.id || c.DFD_Vinculado === otherLinkedDfd.Num_DFD));
          
          if (!isLinkedToSame) return false;

          const otherHasSOFItems = (itensSOF || []).some(i => 
            (i.Num_Contrato === other.id || i.Num_Contrato === other.Num_Contrato) && 
            i.Status_Item === 'Ativo'
          );
          return !otherHasSOFItems;
        });

        // Ensure stable sorting to consistently pick the "first" contract
        sharingContracts.sort((a, b) => a.id.localeCompare(b.id));

        const isFirst = sharingContracts.length > 0 && sharingContracts[0].id === c.id;

        if (isFirst) {
          // "Como eles são contratos de 60 meses (cadastrados em cada contrato essa informação), 
          // eles devem ser divididos por 60 meses e multiplicados por 12 para trazer o valor anualizado."
          const finalMonths = Number(c.Vigencia_Inicial_Meses) || 60;
          baseValue = ((linkedDfd.Valor_Estimado || 0) / finalMonths) * 12;
          source = 'dfd';
        } else {
          // Mark as duplicate! It shouldn't pull any value.
          baseValue = 0;
          source = 'dfd_duplicate';
          duplicateMainContractNum = sharingContracts[0]?.Num_Contrato || sharingContracts[0]?.id || '';
        }

      } else {
        baseValue = c.Valor_Anual_SOF || 0;
        source = 'fallback';
      }
    }

    // Now annualize using periodicity and activeFractionalMonths (unless it is duplicate)
    if (source === 'dfd_duplicate') {
      return { value: 0, hasSOFItems, source, dfdNum, duplicateMainContractNum };
    }

    const periodicidade = c.Periodicidade_Pagamento || 'Mensal';

    if (periodicidade === 'Mensal') {
      let monthlyRate = 0;
      if (source === 'items') {
        monthlyRate = baseValue / (Number(c.Vigencia_Inicial_Meses) || 12);
      } else { // source === 'dfd' || source === 'fallback'
        monthlyRate = baseValue / 12;
      }
      const proportionalVal = monthlyRate * activeFractionalMonths;
      return { value: proportionalVal, hasSOFItems, source, dfdNum };
    } else if (periodicidade === 'Anual') {
      let annualValue = 0;
      if (source === 'items') {
        annualValue = (baseValue / (Number(c.Vigencia_Inicial_Meses) || 12)) * 12;
      } else { // source === 'dfd' || source === 'fallback'
        annualValue = baseValue;
      }
      const proportionalVal = annualValue * (activeFractionalMonths / 12);
      return { value: proportionalVal, hasSOFItems, source, dfdNum };
    } else { // Total
      // Find a payment with status 'Pago' for this contract
      const contractPayments = (pagamentos || []).filter(p => (p.Num_Contrato === c.id || p.Num_Contrato === c.Num_Contrato) && p.Status === 'Pago');
      let paymentYear = startVal.getUTCFullYear(); // fallback to Vigencia_Inicio year
      if (contractPayments.length > 0) {
        const sortedPayments = [...contractPayments].sort((a, b) => new Date(a.Data).getTime() - new Date(b.Data).getTime());
        paymentYear = sortedPayments[0].Ano_Orcamento || new Date(sortedPayments[0].Data).getUTCFullYear();
      }
      
      if (year === paymentYear) {
        return { value: baseValue, hasSOFItems, source, dfdNum };
      }
      return { value: 0, hasSOFItems, source, dfdNum };
    }
  };

  // Main lists computations
  const getComputedContrato = (c: Contrato): Contrato => {
    const dValFinalInicial = getVigenciaFinalInicial(c.Vigencia_Inicio, c.Vigencia_Inicial_Meses);
    
    // Dynamically calculate prorrogated months from aditivos
    const prorrogaMeses = aditivos
      .filter(ad => (ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
      .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
    const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(c.Numero_Renovacoes) || 0);

    const dValFinal = getVigenciaFinal(c.Vigencia_Inicio, c.Vigencia_Inicial_Meses, totalRenovacaoMeses);
    const calculatedStatus = getStatusContrato(dValFinal, currentLocalTime);

    // Sum up incremental alterations for computed updated values
    const contractAditivos = aditivos.filter(ad => ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato);
    const contractApostilamentos = apostilamentos.filter(ap => ap.Num_Contrato === c.id || ap.Num_Contrato === c.Num_Contrato);

    let currentVal = c.Valor_Contrato;
    contractAditivos.forEach(ad => {
      if (ad.Tipo_Aditivo === 'Acréscimo') currentVal += ad.Valor_Aditivado;
      if (ad.Tipo_Aditivo === 'Supressão') currentVal -= ad.Valor_Aditivado;
    });
    contractApostilamentos.forEach(ap => {
      currentVal += ap.Valor_do_Ajuste;
    });

    return {
      ...c,
      Numero_Renovacoes: totalRenovacaoMeses,
      Status_Contrato: calculatedStatus,
      Valor_Atualizado: currentVal,
      Vigencia_Final: dValFinal,
    } as any;
  };

  const processedContratos = contratos.map(getComputedContrato);

  const filteredContratos = processedContratos.filter(c => {
    const matchesStatus = statusFilter.includes(c.Status_Contrato as any);
    const matchesSearch = searchQuery === '' || 
      c.Num_Contrato.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.Objeto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.SEI_Processo.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const sortedContratos = [...filteredContratos].sort((a, b) => {
    if (!sortKey) return 0;

    if (sortKey === 'Num_Contrato') {
      const parseNum = (val: string) => {
        const match = val.match(/(\d+)\/(\d{4})/);
        if (match) {
          return { num: parseInt(match[1], 10), year: parseInt(match[2], 10) };
        }
        const singleNum = val.match(/(\d+)/);
        if (singleNum) {
          return { num: parseInt(singleNum[1], 10), year: 0 };
        }
        return { num: 0, year: 0 };
      };

      const parsedA = parseNum(String(a.Num_Contrato));
      const parsedB = parseNum(String(b.Num_Contrato));

      if (parsedA.year !== parsedB.year) {
        return sortDirection === 'asc' 
          ? parsedA.year - parsedB.year 
          : parsedB.year - parsedA.year;
      }
      if (parsedA.num !== parsedB.num) {
        return sortDirection === 'asc' 
          ? parsedA.num - parsedB.num 
          : parsedB.num - parsedA.num;
      }
      return 0;
    }

    let valA: any;
    let valB: any;

    if (sortKey === 'Fornecedor') {
      valA = fornecedores.find(f => f.id === a.Fornecedor)?.Nome_Fornecedor || a.Fornecedor || '';
      valB = fornecedores.find(f => f.id === b.Fornecedor)?.Nome_Fornecedor || b.Fornecedor || '';
    } else if (sortKey === 'Valor_Anual_SOF') {
      valA = getContractSOFValueForYear(a, targetYearNum).value;
      valB = getContractSOFValueForYear(b, targetYearNum).value;
    } else {
      valA = a[sortKey as keyof typeof a];
      valB = b[sortKey as keyof typeof b];
    }

    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    if (valA instanceof Date && valB instanceof Date) {
      return sortDirection === 'asc' 
        ? valA.getTime() - valB.getTime() 
        : valB.getTime() - valA.getTime();
    }

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

  const totalContratos = filteredContratos.length;
  const totalContratoPages = Math.ceil(totalContratos / rowsPerPage);
  const paginatedContratos = sortedContratos.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const contratoPageNumbers = [];
  for (let i = 1; i <= totalContratoPages; i++) {
    contratoPageNumbers.push(i);
  }

  const selectedContract = processedContratos.find(c => c.id === selectedContratoId);
  const selectedContractItens = selectedContract 
    ? [...itensSOF]
        .filter(i => i.Num_Contrato === selectedContract.id || i.Num_Contrato === selectedContract.Num_Contrato)
        .sort((a, b) => {
          const itemDiff = a.Numero_Item.localeCompare(b.Numero_Item, undefined, { numeric: true, sensitivity: 'base' });
          if (itemDiff !== 0) return itemDiff;
          return (a.Grupo_Lote || '').localeCompare(b.Grupo_Lote || '', undefined, { numeric: true, sensitivity: 'base' });
        })
    : [];

  const groupedContractItens = useMemo(() => {
    return sortAndGroupItems(selectedContractItens);
  }, [selectedContractItens]);

  const sortedOrdensServico = useMemo(() => {
    if (!selectedContract?.ordensServico) return [];
    return [...selectedContract.ordensServico].sort((a, b) => {
      let cmp = 0;
      if (osSortKey === 'vigenciaRef') {
        const startA = a.dataInicioPeriodo || a.dataEmissao || '';
        const startB = b.dataInicioPeriodo || b.dataEmissao || '';
        if (startA && startB) {
          cmp = startA.localeCompare(startB);
          if (cmp === 0 && a.dataFimPeriodo && b.dataFimPeriodo) {
            cmp = a.dataFimPeriodo.localeCompare(b.dataFimPeriodo);
          }
        } else if (startA && !startB) {
          cmp = -1;
        } else if (!startA && startB) {
          cmp = 1;
        } else {
          cmp = (a.numeroOS || '').localeCompare(b.numeroOS || '', undefined, { numeric: true });
        }
      } else if (osSortKey === 'numeroOS') {
        cmp = (a.numeroOS || '').localeCompare(b.numeroOS || '', undefined, { numeric: true });
      } else if (osSortKey === 'empenho') {
        cmp = (a.numeroEmpenho || '').localeCompare(b.numeroEmpenho || '');
      } else if (osSortKey === 'statusRecebimento') {
        const statusA = `${a.trpAprovado ? 2 : a.trpElaborado ? 1 : 0}-${a.trdAprovado ? 2 : a.trdElaborado ? 1 : 0}`;
        const statusB = `${b.trpAprovado ? 2 : b.trpElaborado ? 1 : 0}-${b.trdAprovado ? 2 : b.trdElaborado ? 1 : 0}`;
        cmp = statusA.localeCompare(statusB);
      } else if (osSortKey === 'valorEmissao') {
        cmp = (a.valor || 0) - (b.valor || 0);
      } else if (osSortKey === 'glosa') {
        cmp = (a.trdGlosa || 0) - (b.trdGlosa || 0);
      } else if (osSortKey === 'valorLiquido') {
        const liqA = Math.max(0, (a.valor || 0) - (a.trdGlosa || 0));
        const liqB = Math.max(0, (b.valor || 0) - (b.trdGlosa || 0));
        cmp = liqA - liqB;
      } else if (osSortKey === 'descentralizacao') {
        const valA = (a.descentralizacoes && a.descentralizacoes.length > 0)
          ? a.descentralizacoes.reduce((sum, d) => sum + (d.valor || 0), 0)
          : (a.descentralizacaoValor || 0);
        const valB = (b.descentralizacoes && b.descentralizacoes.length > 0)
          ? b.descentralizacoes.reduce((sum, d) => sum + (d.valor || 0), 0)
          : (b.descentralizacaoValor || 0);
        cmp = valA - valB;
      }

      return osSortDirection === 'asc' ? cmp : -cmp;
    });
  }, [selectedContract?.ordensServico, osSortKey, osSortDirection]);

  // Lista de todos os empenhos disponíveis no contrato e na OS atual para vinculação dinâmica
  const availableEmpenhosForContract = useMemo(() => {
    const list: AvailableEmpenho[] = [];
    const added = new Set<string>();

    const addEmp = (numero?: string, sei?: string, valor?: number) => {
      if (!numero) return;
      const cleanNum = numero.trim();
      if (!cleanNum || added.has(cleanNum)) return;
      added.add(cleanNum);
      list.push({ numero: cleanNum, sei: sei?.trim() || undefined, valor });
    };

    // 1. Empenhos cadastrados na OS atual (array)
    (extendedOsForm.empenhos || []).forEach(e => addEmp(e.numero, e.sei, e.valor));

    // 2. Empenho do campo principal da OS
    if (extendedOsForm.numeroEmpenho) {
      addEmp(
        extendedOsForm.numeroEmpenho,
        extendedOsForm.seiEmpenho,
        extendedOsForm.valorEmpenho ? parseMonetaryValue(extendedOsForm.valorEmpenho) : undefined
      );
    }

    // 3. Empenhos de todas as Ordens de Serviço do contrato selecionado
    (selectedContract?.ordensServico || []).forEach(os => {
      addEmp(os.numeroEmpenho, os.seiEmpenho, os.valorEmpenho);
      (os.empenhos || []).forEach(e => addEmp(e.numero, e.sei, e.valor));
      (os.descentralizacoes || []).forEach(d => {
        (d.empenhosNumeros || []).forEach(num => addEmp(num));
      });
    });

    return list;
  }, [
    extendedOsForm.empenhos,
    extendedOsForm.numeroEmpenho,
    extendedOsForm.seiEmpenho,
    extendedOsForm.valorEmpenho,
    selectedContract?.ordensServico
  ]);

  const getDynamicSelectedContractValorAtualizado = () => {
    if (!selectedContract) return 0;
    const contractAditivos = aditivos.filter(ad => ad.Num_Contrato === selectedContract.id || ad.Num_Contrato === selectedContract.Num_Contrato);
    const contractApostilamentos = apostilamentos.filter(ap => ap.Num_Contrato === selectedContract.id || ap.Num_Contrato === selectedContract.Num_Contrato);

    let val = selectedContract.Valor_Contrato;
    contractAditivos.forEach(ad => {
      if (ad.Tipo_Aditivo === 'Acréscimo') val += ad.Valor_Aditivado;
      if (ad.Tipo_Aditivo === 'Supressão') val -= ad.Valor_Aditivado;
    });
    contractApostilamentos.forEach(ap => {
      val += ap.Valor_do_Ajuste;
    });
    return val;
  };
  const dynamicSelectedContractValorAtualizado = getDynamicSelectedContractValorAtualizado();

  useEffect(() => {
    if (isAlteracaoModalOpen) {
      setAlteracaoData(currentLocalTime ? currentLocalTime.split('T')[0] : new Date().toISOString().split('T')[0]);
      setAlteracaoProcessoSEI(selectedContract?.SEI_Processo || '');
    } else {
      setAlteracaoData('');
      setAlteracaoProcessoSEI('');
    }
  }, [isAlteracaoModalOpen, selectedContract?.id, currentLocalTime]);

  useEffect(() => {
    if (isOcorrenciaModalOpen) {
      setOcorrenciaData(currentLocalTime ? currentLocalTime.split('T')[0] : new Date().toISOString().split('T')[0]);
    } else {
      setOcorrenciaData('');
    }
  }, [isOcorrenciaModalOpen, currentLocalTime]);



  const calcTotalItensSOFAnualizados = () => {
    return processedContratos.reduce((sum, c) => {
      const sofRes = getContractSOFValueForYear(c, targetYearNum, false); // forceUseItemsOnly = false
      return sum + sofRes.value;
    }, 0);
  };

  const handleOpenNewContractModal = () => {
    setEditingContratoId(null);
    setContractAttachedFileName('');
    setContractAttachedFileData('');
    setContratoFormData({
      Num_Contrato: '',
      Objeto: '',
      SEI_Processo: '',
      Vigencia_Inicio: '',
      Vigencia_Inicial_Meses: 12,
      Tempo_Possivel_Prorrogacao_Meses: 60,
      Numero_Renovacoes: 0,
      Valor_Contrato: 0,
      Valor_Atualizado: 0,
      Gestor_Contrato: '',
      Gestor_Substituto: '',
      Fiscal_Administrativo: '',
      Fiscal_Administrativo_Substituto: '',
      Fiscal_Tecnico: '',
      Fiscal_Tecnico_Substituto: '',
      Fiscal_Requisitante: '',
      Fiscal_Requisitante_Substituto: '',
      Preposto: '',
      EmailPreposto: '',
      Portaria_Fiscalizacao_Numero: '',
      Portaria_Fiscalizacao_SEI: '',
      Fornecedor: '',
      Periodicidade_Pagamento: 'Mensal',
      Modalidade_Contratacao: 'Pregão SOF',
      DFD_Vinculado: '',
      Indice_Reajuste: 'ICTI',
      Mes_Reajuste: '',
      Acao_Orcamentaria: '8861',
      Plano_Orcamentario: '01',
      GND: '3 - Custeio',
      Data_Orcamento_Estimado: new Date(currentLocalTime).toISOString().split('T')[0],
    });
    setIsContractModalOpen(true);
  };

  const handleStartEditContract = (c: Contrato) => {
    setEditingContratoId(c.id);
    setContractAttachedFileName(c.LinkContratoNome || (c.LinkContrato && !c.LinkContrato.startsWith('data:') && !c.LinkContrato.startsWith('http') ? c.LinkContrato : c.LinkContrato ? 'ContratoAnexo.pdf' : ''));
    setContractAttachedFileData(c.LinkContrato && (c.LinkContrato.startsWith('data:') || c.LinkContrato.startsWith('http')) ? c.LinkContrato : '');
    setContratoFormData({
      Num_Contrato: c.Num_Contrato,
      Objeto: c.Objeto,
      SEI_Processo: c.SEI_Processo,
      Vigencia_Inicio: c.Vigencia_Inicio,
      Vigencia_Inicial_Meses: c.Vigencia_Inicial_Meses,
      Tempo_Possivel_Prorrogacao_Meses: c.Tempo_Possivel_Prorrogacao_Meses,
      Numero_Renovacoes: c.Numero_Renovacoes,
      Valor_Contrato: c.Valor_Contrato,
      Valor_Atualizado: c.Valor_Atualizado,
      Gestor_Contrato: c.Gestor_Contrato || '',
      Gestor_Substituto: c.Gestor_Substituto || '',
      Fiscal_Administrativo: c.Fiscal_Administrativo || '',
      Fiscal_Administrativo_Substituto: c.Fiscal_Administrativo_Substituto || '',
      Fiscal_Tecnico: c.Fiscal_Tecnico || '',
      Fiscal_Tecnico_Substituto: c.Fiscal_Tecnico_Substituto || '',
      Fiscal_Requisitante: c.Fiscal_Requisitante || '',
      Fiscal_Requisitante_Substituto: c.Fiscal_Requisitante_Substituto || '',
      Preposto: c.Preposto || '',
      EmailPreposto: c.EmailPreposto || '',
      Portaria_Fiscalizacao_Numero: c.Portaria_Fiscalizacao_Numero || '',
      Portaria_Fiscalizacao_SEI: c.Portaria_Fiscalizacao_SEI || '',
      Fornecedor: c.Fornecedor,
      Periodicidade_Pagamento: c.Periodicidade_Pagamento || 'Mensal',
      Modalidade_Contratacao: c.Modalidade_Contratacao || 'Pregão SOF',
      DFD_Vinculado: c.DFD_Vinculado || '',
      Indice_Reajuste: c.Indice_Reajuste || 'ICTI',
      Mes_Reajuste: c.Mes_Reajuste || '',
      Acao_Orcamentaria: c.Acao_Orcamentaria || '8861',
      Plano_Orcamentario: c.Plano_Orcamentario || '01',
      GND: c.GND || '3 - Custeio',
      Data_Orcamento_Estimado: c.Data_Orcamento_Estimado ? c.Data_Orcamento_Estimado.split('T')[0] : new Date(currentLocalTime).toISOString().split('T')[0],
    });
    setIsContractModalOpen(true);
  };

  const handleContractFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setContratoFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleCreateContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role === 'Visualizador') {
      alert('Acesso Negado: Perfil de "Visualizador" não possui privilégios de salvar contratos.');
      return;
    }

    const cleanValor = typeof contratoFormData.Valor_Contrato === 'number'
      ? contratoFormData.Valor_Contrato
      : parseMonetaryValue(contratoFormData.Valor_Contrato);

    if (!contratoFormData.Num_Contrato || !contratoFormData.Objeto || !contratoFormData.Vigencia_Inicio || cleanValor < 0) {
      alert('Por favor preencha todos os campos obrigatórios (Número do Contrato, Objeto, Início da Vigência, Valor Inicial).');
      return;
    }

    const iniMeses = contratoFormData.Vigencia_Inicial_Meses || 12;
    const maxMeses = contratoFormData.Tempo_Possivel_Prorrogacao_Meses || 60;
    
    if (editingContratoId) {
      const original = contratos.find(c => c.id === editingContratoId);
      const currentRenovs = contratoFormData.Numero_Renovacoes || (original ? original.Numero_Renovacoes : 0);
      
      if (iniMeses + currentRenovs > maxMeses) {
        alert(`BLOQUEIO DE COMPATIBILIDADE: A vigência inicial (${iniMeses} meses) somada às renovações existentes (${currentRenovs} meses) não pode exceder o limite de vigência máxima do contrato de ${maxMeses} meses.`);
        return;
      }

      const updatedCont: Contrato = {
        ...(original || {}),
        id: editingContratoId,
        Num_Contrato: contratoFormData.Num_Contrato!,
        Objeto: contratoFormData.Objeto!,
        SEI_Processo: contratoFormData.SEI_Processo || 'Instrução Manual',
        Vigencia_Inicio: contratoFormData.Vigencia_Inicio!,
        Vigencia_Inicial_Meses: iniMeses,
        Tempo_Possivel_Prorrogacao_Meses: maxMeses,
        Numero_Renovacoes: currentRenovs,
        Valor_Contrato: cleanValor,
        Valor_Atualizado: cleanValor,
        Gestor_Contrato: contratoFormData.Gestor_Contrato || '',
        Gestor_Substituto: contratoFormData.Gestor_Substituto || '',
        Fiscal_Administrativo: contratoFormData.Fiscal_Administrativo || '',
        Fiscal_Administrativo_Substituto: contratoFormData.Fiscal_Administrativo_Substituto || '',
        Fiscal_Tecnico: contratoFormData.Fiscal_Tecnico || '',
        Fiscal_Tecnico_Substituto: contratoFormData.Fiscal_Tecnico_Substituto || '',
        Fiscal_Requisitante: contratoFormData.Fiscal_Requisitante || '',
        Fiscal_Requisitante_Substituto: contratoFormData.Fiscal_Requisitante_Substituto || '',
        Preposto: contratoFormData.Preposto || '',
        EmailPreposto: contratoFormData.EmailPreposto || '',
        Portaria_Fiscalizacao_Numero: contratoFormData.Portaria_Fiscalizacao_Numero || '',
        Portaria_Fiscalizacao_SEI: contratoFormData.Portaria_Fiscalizacao_SEI || '',
        LinkContrato: contractAttachedFileName ? (contractAttachedFileData || original?.LinkContrato || 'contrato_importado.pdf') : '',
        LinkContratoNome: contractAttachedFileName || '',
        Data_Orcamento_Estimado: contratoFormData.Data_Orcamento_Estimado ? new Date(contratoFormData.Data_Orcamento_Estimado + 'T12:00:00Z').toISOString() : original?.Data_Orcamento_Estimado || new Date(currentLocalTime).toISOString(),
        Fornecedor: contratoFormData.Fornecedor || fornecedores[0]?.id || 'manual',
        Periodicidade_Pagamento: (contratoFormData.Periodicidade_Pagamento as PeriodicidadePagamento) || 'Mensal',
        Modalidade_Contratacao: contratoFormData.Modalidade_Contratacao || 'Pregão SOF',
        Data_Ultima_Atualizacao: new Date(currentLocalTime).toISOString(),
        Valor_Anual_SOF: cleanValor,
        DFD_Vinculado: contratoFormData.DFD_Vinculado || '',
        Indice_Reajuste: contratoFormData.Indice_Reajuste || 'ICTI',
        Mes_Reajuste: contratoFormData.Mes_Reajuste || '',
        Acao_Orcamentaria: contratoFormData.Acao_Orcamentaria || '8861',
        Plano_Orcamentario: contratoFormData.Plano_Orcamentario || '01',
        GND: contratoFormData.GND || '3 - Custeio',
        updatedAt: new Date(currentLocalTime).toISOString(),
      } as Contrato;

      onEditContrato(updatedCont);
      alert('Contrato atualizado com sucesso!');
    } else {
      if (iniMeses > maxMeses) {
        alert(`BLOQUEIO DE COMPATIBILIDADE: A vigência inicial (${iniMeses} meses) não pode exceder o limite de vigência máxima do contrato de ${maxMeses} meses.`);
        return;
      }

      const newCont: Contrato = {
        id: `cont-${Date.now()}`,
        Num_Contrato: contratoFormData.Num_Contrato!,
        Objeto: contratoFormData.Objeto!,
        SEI_Processo: contratoFormData.SEI_Processo || 'Instrução Manual',
        Vigencia_Inicio: contratoFormData.Vigencia_Inicio!,
        Vigencia_Inicial_Meses: iniMeses,
        Tempo_Possivel_Prorrogacao_Meses: maxMeses,
        Numero_Renovacoes: 0,
        Valor_Contrato: cleanValor,
        Valor_Atualizado: cleanValor,
        Gestor_Contrato: contratoFormData.Gestor_Contrato || '',
        Gestor_Substituto: contratoFormData.Gestor_Substituto || '',
        Fiscal_Administrativo: contratoFormData.Fiscal_Administrativo || '',
        Fiscal_Administrativo_Substituto: contratoFormData.Fiscal_Administrativo_Substituto || '',
        Fiscal_Tecnico: contratoFormData.Fiscal_Tecnico || '',
        Fiscal_Tecnico_Substituto: contratoFormData.Fiscal_Tecnico_Substituto || '',
        Fiscal_Requisitante: contratoFormData.Fiscal_Requisitante || '',
        Fiscal_Requisitante_Substituto: contratoFormData.Fiscal_Requisitante_Substituto || '',
        Preposto: contratoFormData.Preposto || '',
        EmailPreposto: contratoFormData.EmailPreposto || '',
        Portaria_Fiscalizacao_Numero: contratoFormData.Portaria_Fiscalizacao_Numero || '',
        Portaria_Fiscalizacao_SEI: contratoFormData.Portaria_Fiscalizacao_SEI || '',
        LinkContrato: contractAttachedFileName ? (contractAttachedFileData || 'contrato_importado.pdf') : '',
        LinkContratoNome: contractAttachedFileName || '',
        Data_Orcamento_Estimado: contratoFormData.Data_Orcamento_Estimado ? new Date(contratoFormData.Data_Orcamento_Estimado + 'T12:00:00Z').toISOString() : new Date(currentLocalTime).toISOString(),
        Fornecedor: contratoFormData.Fornecedor || fornecedores[0]?.id || 'manual',
        Periodicidade_Pagamento: (contratoFormData.Periodicidade_Pagamento as PeriodicidadePagamento) || 'Mensal',
        Modalidade_Contratacao: contratoFormData.Modalidade_Contratacao || 'Pregão SOF',
        Data_Ultima_Atualizacao: new Date(currentLocalTime).toISOString(),
        Valor_Anual_SOF: cleanValor,
        DFD_Vinculado: contratoFormData.DFD_Vinculado || '',
        Indice_Reajuste: contratoFormData.Indice_Reajuste || 'ICTI',
        Mes_Reajuste: contratoFormData.Mes_Reajuste || '',
        Acao_Orcamentaria: contratoFormData.Acao_Orcamentaria || '8861',
        Plano_Orcamentario: contratoFormData.Plano_Orcamentario || '01',
        GND: contratoFormData.GND || '3 - Custeio',
        updatedAt: new Date(currentLocalTime).toISOString(),
      };

      onAddContrato(newCont);
      alert('Contrato cadastrado com sucesso!');
    }

    setContractAttachedFileName('');
    setContractAttachedFileData('');
    setEditingContratoId(null);
    setIsContractModalOpen(false);
  };

  const handleAddItemSOFLocal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract) return;

    const newItem: ItemContratoSOF = {
      id: `item-${Date.now()}`,
      Num_Contrato: selectedContract.id,
      Numero_Item: itemFormData.Numero_Item || '01',
      Grupo_Lote: itemFormData.Grupo_Lote || 'Lote Único',
      Descricao_Item: itemFormData.Descricao_Item!,
      Unidade_Medida: itemFormData.Unidade_Medida || 'Licença',
      Quantidade: itemFormData.Quantidade || 1,
      Valor_Unitario: itemFormData.Valor_Unitario || 0,
      Status_Item: itemFormData.Status_Item as any,
      Natureza_Despesa: itemFormData.Natureza_Despesa || 'Custeio',
    };

    onAddItemSOF(newItem);
    setIsItemModalOpen(false);
    setItemFormData({ Numero_Item: '', Grupo_Lote: 'Lote 1', Descricao_Item: '', Unidade_Medida: 'Licença', Quantidade: 1, Valor_Unitario: 0, Status_Item: 'Ativo', Natureza_Despesa: 'Custeio' });
  };

  // Add historical occurance note
  const handleAddOcorrencia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract || !ocorrenciaDesc) return;

    const isoDate = ocorrenciaData
      ? new Date(ocorrenciaData + 'T12:00:00').toISOString()
      : new Date(currentLocalTime).toISOString();

    onAddHistoricoContratual({
      id: `histc-${Date.now()}`,
      Data: isoDate,
      ContratoRelacionado: selectedContract.id,
      Descricao: ocorrenciaDesc,
      Numero_SEI: ocorrenciaSEI || 'Nota GECTI',
      Coordenacao: 'GECTI / SOF',
    });

    setOcorrenciaDesc('');
    setOcorrenciaSEI('');
    setOcorrenciaData('');
    setIsOcorrenciaModalOpen(false);
  };

  // Alterations logic rules verification
  const handleSaveAlteracao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract) return;

    const isoDate = alteracaoData
      ? new Date(alteracaoData + 'T12:00:00').toISOString()
      : new Date(currentLocalTime).toISOString();

    const finalizedProcessoSEI = alteracaoProcessoSEI || selectedContract.SEI_Processo;

    if (alteracaoTipo === 'Aditivo') {
      if (aditivoTipoSub === 'Prorrogada' || aditivoTipoSub === 'Prorrogação') {
        const currentRenovsInMonths = selectedContract.Numero_Renovacoes;
        const potentialNewTotal = currentRenovsInMonths + alteracaoMeses;

        // Validation constraint rule check: check if initial + all renewals exceed max permitted duration
        if (selectedContract.Vigencia_Inicial_Meses + potentialNewTotal > selectedContract.Tempo_Possivel_Prorrogacao_Meses) {
          alert(`MUDANÇA BLOQUEADA: A soma da vigência inicial (${selectedContract.Vigencia_Inicial_Meses} meses) com as prorrogações acumuladas (${potentialNewTotal} meses) excederia a vigência máxima permitida de ${selectedContract.Tempo_Possivel_Prorrogacao_Meses} meses para este contrato.`);
          return;
        }

        // Apply
        onAddAditivo({
          id: `ad-${Date.now()}`,
          Data_Aditivo: isoDate,
          Tipo_Aditivo: 'Prorrogação',
          Porcentagem_Aditivo: 0,
          Valor_Aditivado: 0,
          Meses_Renovacoes: alteracaoMeses,
          Documento_SEI: alteracaoSEI || 'Aditivo de Prazo',
          Observacoes: alteracaoObs || 'Aditativo para prorrogação do cronograma',
          Num_Contrato: selectedContract.id,
          Processo_SEI: finalizedProcessoSEI,
          Tipo_Operacao: 'Prorrogação de Prazo',
          Valor_Final_Apos_Ajuste: selectedContract.Valor_Atualizado
        });

        // Mutate parent renovs
        onEditContrato({
          ...selectedContract,
          Numero_Renovacoes: potentialNewTotal,
          updatedAt: new Date(currentLocalTime).toISOString()
        });

      } else {
        // Value aditivo
        onAddAditivo({
          id: `ad-${Date.now()}`,
          Data_Aditivo: isoDate,
          Tipo_Aditivo: aditivoTipoSub,
          Porcentagem_Aditivo: alteracaoPorcentagem,
          Valor_Aditivado: alteracaoValor,
          Meses_Renovacoes: 0,
          Documento_SEI: alteracaoSEI || 'Aditivo Financeiro',
          Observacoes: alteracaoObs,
          Num_Contrato: selectedContract.id,
          Processo_SEI: finalizedProcessoSEI,
          Tipo_Operacao: aditivoTipoSub === 'Acréscimo' ? 'Acréscimo de Valor' : 'Supressão de Valor',
          Valor_Final_Apos_Ajuste: aditivoTipoSub === 'Acréscimo' 
            ? selectedContract.Valor_Atualizado + alteracaoValor 
            : selectedContract.Valor_Atualizado - alteracaoValor
        });
      }
    } else {
      // Apostilamento
      onAddApostilamento({
        id: `ap-${Date.now()}`,
        Data_Apostilamento: isoDate,
        Tipo_Apostilamento: 'Reajuste',
        Porcentagem_Reajuste: alteracaoPorcentagem,
        Valor_do_Ajuste: alteracaoValor,
        Observacoes: alteracaoObs,
        Documento_SEI: alteracaoSEI || 'Apostilamento IPCA',
        Num_Contrato: selectedContract.id,
        Processo_SEI: finalizedProcessoSEI,
        Tipo_Operacao: 'Reajuste Inflacionário de Índice',
        Valor_Final_Apos_Ajuste: selectedContract.Valor_Atualizado + alteracaoValor
      });
    }

    setIsAlteracaoModalOpen(false);
    setAlteracaoValor(0);
    setAlteracaoPorcentagem(0);
    setAlteracaoMeses(0);
    setAlteracaoSEI('');
    setAlteracaoObs('');
    setAlteracaoData('');
    setAlteracaoProcessoSEI('');
  };

  // Payment register
  const handleSavePagamento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract) return;

    if (pagamentoFormData.Valor === undefined || pagamentoFormData.Valor === null || isNaN(pagamentoFormData.Valor) || pagamentoFormData.Valor < 0) {
      alert("Por favor, digite um valor maior ou igual a R$ 0,00 para poder lançar a execução/pagamento.");
      return;
    }

    const { idOSVinculada, processoSeiPagamento } = pagamentoFormData;

    Promise.resolve(onAddPagamento({
      id: `pag-${Date.now()}`,
      Num_Contrato: selectedContract.id,
      Descricao: pagamentoFormData.Descricao || 'Liquidação da Fatura',
      Data: pagamentoFormData.Data || (currentLocalTime ? currentLocalTime.split('T')[0] : new Date().toISOString().split('T')[0]),
      Valor: pagamentoFormData.Valor,
      Status: pagamentoFormData.Status as any,
      Documento_SEI: pagamentoFormData.Documento_SEI || 'Processamento Financeiro',
      Observacoes: pagamentoFormData.Observacoes,
      Ano_Orcamento: pagamentoFormData.Ano_Orcamento,
      idOSVinculada: idOSVinculada || undefined,
      processoSeiPagamento: processoSeiPagamento || undefined,
    })).then(() => {
      // Automate OS statuses & receiving documents sync when linked
      if (idOSVinculada && selectedContract.ordensServico) {
        const updatedOSList = selectedContract.ordensServico.map(os => {
          if (os.id === idOSVinculada) {
            // Determine automatic status updates requested by user
            let newStatusOS = os.statusOS;
            let finalTrdElaborado = os.trdElaborado;
            let finalTrdAprovado = os.trdAprovado;

            if (pagamentoFormData.Status === 'Empenhado') {
              newStatusOS = 'Empenhado';
            } else if (pagamentoFormData.Status === 'Liquidado') {
              newStatusOS = 'Liquidado';
              // When attesting TRP/TRD and NF for payment, mark definitive receipt as approved
              finalTrdElaborado = true;
              finalTrdAprovado = true;
            } else if (pagamentoFormData.Status === 'Pago') {
              newStatusOS = 'Pago';
              finalTrdElaborado = true;
              finalTrdAprovado = true;
            }

            return {
              ...os,
              statusOS: newStatusOS,
              trdElaborado: finalTrdElaborado,
              trdAprovado: finalTrdAprovado,
              processoSeiPagamento: processoSeiPagamento || os.processoSeiPagamento,
            };
          }
          return os;
        });

        onEditContrato({
          ...selectedContract,
          ordensServico: updatedOSList
        });
      }
    }).catch(err => {
      console.error("Erro ao salvar execução/pagamento:", err);
      alert("Erro ao salvar: Verifique se sua conexão com a Coleção Firestore está ativa e se seu usuário possui privilégios de gravação.");
    });

    setIsPagamentoModalOpen(false);
    setPagamentoFormData({
      Descricao: '',
      Data: currentLocalTime ? currentLocalTime.split('T')[0] : new Date().toISOString().split('T')[0],
      Valor: 0,
      Status: 'Pago',
      Documento_SEI: '',
      Ano_Orcamento: undefined,
      idOSVinculada: '',
      processoSeiPagamento: '',
    });
  };

  const handleDeleteContract = (id: string, name: string) => {
    if (currentUser.role === 'Visualizador') return;
    setDeleteConfirm({
      isOpen: true,
      type: 'contrato',
      id,
      title: 'Excluir Contrato de TIC?',
      message: `Tem certeza de que deseja deletar permanentemente o contrato ${name}? Todos os itens de catálogo, histórico e pagamentos vinculados a ele também serão removidos de forma irreversível.`
    });
  };

  // Analyze and compile expiration severity alerts for GECTI monitoring
  const analyzedContracts = processedContratos.map(c => {
    const daysLeft = getContractExpirationDays(c);
    let severity: 'critico' | 'altorisco' | 'alerta' | 'atencao' | 'regular' = 'regular';
    if (daysLeft <= 0 || daysLeft > 180) {
      severity = 'regular';
    } else if (daysLeft <= 30) {
      severity = 'critico';
    } else if (daysLeft <= 60) {
      severity = 'altorisco';
    } else if (daysLeft <= 90) {
      severity = 'alerta';
    } else {
      severity = 'atencao';
    }
    return { contract: c, daysLeft, severity };
  });

  const criticalAlerts = analyzedContracts.filter(item => item.severity === 'critico');
  const highRiskAlerts = analyzedContracts.filter(item => item.severity === 'altorisco');
  const warningAlerts = analyzedContracts.filter(item => item.severity === 'alerta');
  const atencaoAlerts = analyzedContracts.filter(item => item.severity === 'atencao');

  const totalExpirando180Dias = criticalAlerts.length + highRiskAlerts.length + warningAlerts.length + atencaoAlerts.length;

  const filteredAlerts = analyzedContracts.filter(item => {
    if (selectedAlertSeverity === 'critico') return item.severity === 'critico';
    if (selectedAlertSeverity === 'altorisco') return item.severity === 'altorisco';
    if (selectedAlertSeverity === 'alerta') return item.severity === 'alerta';
    if (selectedAlertSeverity === 'atencao') return item.severity === 'atencao';
    if (selectedAlertSeverity === 'todos') {
      return item.severity !== 'regular'; // non-regular alerts (within 180 days)
    }
    return false;
  });

  const getGlobalBudgetExecutionAllYears = () => {
    let empenhado = 0;
    let liquidado = 0;
    let pago = 0;

    const processedOsIds = new Set<string>();

    // 1. Process all contracts' Ordens de Serviço (all years)
    processedContratos.forEach(c => {
      if (c.ordensServico) {
        c.ordensServico.forEach(os => {
          processedOsIds.add(os.id);

          // Skip cancelled OSs
          if (os.statusOS === 'Cancelada') return;

          const valBase = os.valor || 0;
          const valGlosa = os.trdGlosa || 0;
          const valLiq = Math.max(0, valBase - valGlosa);
          const rawValEmp = os.valorEmpenho !== undefined && os.valorEmpenho !== null && os.valorEmpenho > 0 ? os.valorEmpenho : valBase;

          // 1. Status PAGO
          const hasPagoStatus = os.statusOS === 'Pago';
          const hasPagoPayment = pagamentos.some(p => p.idOSVinculada === os.id && p.Status === 'Pago');
          const isPaga = hasPagoStatus || hasPagoPayment;

          // 2. Status LIQUIDADO
          const hasTermosCompletos = Boolean(os.trpElaborado && os.trpAprovado && os.trdElaborado && os.trdAprovado);
          const isLiquidada = isPaga || os.statusOS === 'Liquidado' || hasTermosCompletos;

          // 3. Status EMPENHADO
          const hasNumEmpenho = Boolean(os.numeroEmpenho && os.numeroEmpenho.trim() !== '') || Boolean(os.empenhos && os.empenhos.length > 0);
          const isEmpenhada = isLiquidada || hasNumEmpenho || os.statusOS === 'Empenhado';

          if (isEmpenhada) {
            empenhado += Math.max(rawValEmp, isLiquidada ? valLiq : 0);
          }

          if (isLiquidada) {
            liquidado += valLiq;
          }

          if (isPaga) {
            pago += valLiq;
          }
        });
      }
    });

    // 2. Process all standalone manual payments (all years)
    pagamentos.forEach(p => {
      const contractExists = processedContratos.some(c => c.id === p.Num_Contrato || c.Num_Contrato === p.Num_Contrato);
      if (!contractExists) return;

      if (p.idOSVinculada && processedOsIds.has(p.idOSVinculada)) return;

      const val = p.Valor || 0;
      if (p.Status === 'Empenhado') {
        empenhado += val;
      } else if (p.Status === 'Liquidado') {
        empenhado += val;
        liquidado += val;
      } else if (p.Status === 'Pago') {
        empenhado += val;
        liquidado += val;
        pago += val;
      }
    });

    return { empenhado, liquidado, pago };
  };

  const allYearsExec = getGlobalBudgetExecutionAllYears();
  const totalEmpenhado = allYearsExec.empenhado;
  const totalLiquidado = allYearsExec.liquidado;
  const totalPago = allYearsExec.pago;
  
  const financialChartData = [
    { name: 'Empenhado', value: totalEmpenhado, color: '#eab308' },
    { name: 'Liquidado', value: totalLiquidado, color: '#3b82f6' },
    { name: 'Pago', value: totalPago, color: '#10b981' }
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6" id="contratos-section" data-tour="contract-header">
      {!selectedContratoId ? (
        <>
          {/* Main List Screen Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <nav className="flex items-center gap-2 text-on-surface-variant mb-1 text-xs uppercase tracking-wider">
                <span>Gestão Eletrônica</span>
                <span>&gt;</span>
                <span className="text-primary font-medium">Contratos GECTI</span>
              </nav>
              <h2 className="text-2xl font-bold text-on-surface tracking-tight">Gestão de Contratos de TIC</h2>
              <p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                Controle dos contratos de TIC
              </p>
            </div>
            
            <div className="flex gap-2.5">
              <button
                onClick={exportContratosToPDF}
                className="flex items-center gap-2 px-3 py-2 border border-outline-variant/60 rounded-lg text-xs bg-surface-container hover:text-primary transition-all cursor-pointer font-semibold"
              >
                <Download className="w-4 h-4 text-primary" />
                Exportar PDF
              </button>
              <button
                onClick={() => setIsFornecedoresOpen(true)}
                className="flex items-center gap-2 px-3 py-2 border border-outline-variant/60 rounded-lg text-xs bg-surface-container hover:text-primary transition-all cursor-pointer font-semibold"
              >
                <Briefcase className="w-4 h-4 text-primary" />
                Fornecedores
              </button>
              <button
                onClick={handleOpenNewContractModal}
                className="flex items-center gap-2 px-4 py-2 border border-primary/30 rounded-lg text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95 cursor-pointer font-medium"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Contrato
              </button>
            </div>
          </div>

          {/* Section: Prominent Expiration Alerts Dashboard Panel - Full Width and Collapsed by default */}
          <div className="bg-surface border border-outline rounded-xl p-5 shadow-sm space-y-4 border-l-4 border-l-rose-500/80 mb-6 select-none">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-outline-variant/60">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl animate-pulse shrink-0 mt-0.5 sm:mt-0">
                  <Bell className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Alertas de Vencimento</h3>
                  <p className="text-[11px] text-on-surface-variant leading-tight">Prazo de Vencimento dos contratos ativos (30, 60, 90, 180 dias).</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-outline-variant/20 pt-2 sm:pt-0">
                {totalExpirando180Dias > 0 && (
                  <span className="bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce">
                    {totalExpirando180Dias} ocorrendo em breve
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsAlertsPanelExpanded(!isAlertsPanelExpanded)}
                  className="p-1 px-2.5 hover:bg-surface-container text-xs text-primary font-bold rounded flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {isAlertsPanelExpanded ? (
                    <>
                      <span>Ocultar Painel</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Mostrar Painel</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {isAlertsPanelExpanded && (
              <div className="space-y-4 animate-in slide-in-from-top-1 duration-200">
                {/* Visual Category Selectors */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedAlertSeverity('todos')}
                    className={`border rounded-xl p-3 flex flex-col justify-between text-left cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${
                      selectedAlertSeverity === 'todos'
                        ? 'bg-primary/10 border-primary/45 shadow-sm'
                        : 'bg-surface-container-low border-outline-variant/60 hover:bg-surface-container-high/60'
                    }`}
                  >
                    <span className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider leading-none">Todos Alertas</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <strong className="text-lg font-bold font-mono text-on-surface">{totalExpirando180Dias}</strong>
                      <span className="text-[9px] text-on-surface-variant">contratos</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedAlertSeverity('atencao')}
                    className={`border rounded-xl p-3 flex flex-col justify-between text-left cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${
                      selectedAlertSeverity === 'atencao'
                        ? 'bg-blue-500/10 border-blue-500/40 shadow-sm'
                        : 'bg-surface-container-low border-outline-variant/60 hover:bg-surface-container-high/60'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-[9px] uppercase font-bold text-blue-400 tracking-wider leading-none">91d a 180d</span>
                      {atencaoAlerts.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>}
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <strong className="text-lg font-bold font-mono text-blue-400">{atencaoAlerts.length}</strong>
                      <span className="text-[9px] text-blue-400/80">planejamento</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedAlertSeverity('critico')}
                    className={`border rounded-xl p-3 flex flex-col justify-between text-left cursor-pointer transition-all hover:scale-[1.01] hover:bg-surface-container-high/60 ${
                      selectedAlertSeverity === 'critico'
                        ? 'bg-rose-500/10 border-rose-500/40'
                        : 'bg-surface-container-low border-outline-variant/60'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-[9px] uppercase font-bold text-rose-300 tracking-wider leading-none">Em até 30d</span>
                      {criticalAlerts.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>}
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <strong className="text-lg font-bold font-mono text-rose-300">{criticalAlerts.length}</strong>
                      <span className="text-[9px] text-rose-300/80">alta urgência</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedAlertSeverity('altorisco')}
                    className={`border rounded-xl p-3 flex flex-col justify-between text-left cursor-pointer transition-all hover:scale-[1.01] hover:bg-surface-container-high/60 ${
                      selectedAlertSeverity === 'altorisco'
                        ? 'bg-orange-500/10 border-orange-500/40'
                        : 'bg-surface-container-low border-outline-variant/60'
                    }`}
                  >
                    <span className="text-[9px] uppercase font-bold text-orange-300 tracking-wider leading-none">31d a 60d</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <strong className="text-lg font-bold font-mono text-orange-300">{highRiskAlerts.length}</strong>
                      <span className="text-[9px] text-orange-300/80">médio risco</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedAlertSeverity('alerta')}
                    className={`border rounded-xl p-3 flex flex-col justify-between text-left cursor-pointer transition-all hover:scale-[1.01] hover:bg-surface-container-high/60 ${
                      selectedAlertSeverity === 'alerta'
                        ? 'bg-amber-500/10 border-amber-500/40'
                        : 'bg-surface-container-low border-outline-variant/60'
                    }`}
                  >
                    <span className="text-[9px] uppercase font-bold text-amber-300 tracking-wider leading-none">61d a 90d</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <strong className="text-lg font-bold font-mono text-amber-300">{warningAlerts.length}</strong>
                      <span className="text-[9px] text-amber-300/80">preventivo</span>
                    </div>
                  </button>
                </div>

                {/* Grid list of warnings outputs */}
                <div className="pt-2">
                  {filteredAlerts.length === 0 ? (
                    <div className="p-8 text-center text-xs text-on-surface-variant/70 italic bg-surface-container-low/40 rounded-xl border border-outline-variant/20">
                      Nenhum contrato ativo se enquadra na faixa orçamentária filtrada. Estabilidade garantida pela GECTI.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredAlerts.map(({ contract, daysLeft, severity }) => {
                        const computedFim = contract.Vigencia_Final || new Date();
                        const fornObj = fornecedores.find(f => f.id === contract.Fornecedor);
                        
                        let cardStyle = '';
                        let textAlert = '';
                        let riskLabel = '';
                        let pulseDot = false;

                        if (severity === 'critico') {
                          cardStyle = 'bg-rose-500/5 border-rose-500/30 text-rose-300';
                          textAlert = `Faltam ${daysLeft} dias para vencer`;
                          riskLabel = 'CRÍTICO';
                          pulseDot = true;
                        } else if (severity === 'altorisco') {
                          cardStyle = 'bg-orange-500/5 border-orange-500/30 text-orange-300';
                          textAlert = `Faltam ${daysLeft} dias para vencer`;
                          riskLabel = 'ALTO';
                        } else if (severity === 'alerta') {
                          cardStyle = 'bg-amber-500/5 border-amber-500/30 text-amber-300';
                          textAlert = `Faltam ${daysLeft} dias para vencer`;
                          riskLabel = 'ATENÇÃO';
                        } else if (severity === 'atencao') {
                          cardStyle = 'bg-blue-500/5 border-blue-500/30 text-blue-300';
                          textAlert = `Faltam ${daysLeft} dias para vencer`;
                          riskLabel = 'PREVENTIVO';
                        }

                        return (
                          <div
                            key={contract.id}
                            className={`border rounded-xl p-3 flex flex-col justify-between hover:border-primary/40 transition-colors gap-3 ${cardStyle}`}
                          >
                            <div className="space-y-1">
                              <div className="flex justify-between items-start gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-extrabold text-xs text-on-surface leading-none">{contract.Num_Contrato}</span>
                                    {pulseDot && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>}
                                  </div>
                                  <p className="text-[10px] text-on-surface-variant font-mono leading-none">{contract.SEI_Processo}</p>
                                </div>
                                <span className="text-[10px] uppercase font-bold font-mono tracking-tight px-2 py-0.5 rounded bg-surface/50 border border-outline-variant/30">
                                  {riskLabel}
                                </span>
                              </div>
                              
                              <p className="text-xs text-on-surface font-semibold line-clamp-1 py-1" title={contract.Objeto}>
                                {contract.Objeto}
                              </p>
                              
                              <div className="flex justify-between text-[10px] text-on-surface-variant font-sans border-t border-dashed border-outline-variant/30 pt-2 mt-2">
                                <span>Fornecedor: <strong>{fornObj?.Nome_Fornecedor || 'N/A'}</strong></span>
                                <span>Vence em: <strong className="font-mono text-on-surface">{formatDate(computedFim)}</strong></span>
                              </div>
                            </div>

                            {/* Alert Action panel */}
                            <div className="flex justify-between items-center gap-2 pt-2 border-t border-outline-variant/20">
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchQuery(contract.Num_Contrato);
                                  setStatusFilter(['Vigente', 'A Vencer', 'Encerrado']);
                                }}
                                className="text-[10px] text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <span>Localizar na Tabela</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedContratoId(contract.id)}
                                  className="px-2 py-1 bg-surface-container border border-outline hover:bg-surface text-[10px] font-bold text-on-surface rounded transition-colors cursor-pointer"
                                >
                                  Ver Ficha
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleProposeProrrogacao(contract)}
                                  className="px-2 py-1 bg-primary text-on-primary hover:bg-primary/90 text-[10px] font-bold rounded flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                                >
                                  <span>Iniciar Prorrogação</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section: Prominent ICTI / Ipeadata Indices and Reajuste Calculator Panel */}
          <div className="bg-surface border border-outline rounded-xl p-5 shadow-sm space-y-4 border-l-4 border-l-amber-500 mb-6 select-none" data-tour="contract-alterations">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-outline-variant/60">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-0.5 sm:mt-0">
                  <TrendingUp className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Índice de Custos de TI (ICTI) & Reajustes</h3>
                  <p className="text-[11px] text-on-surface-variant leading-tight">
                    Integração em tempo real com a API oficial do Ipeadata para reajustes de contratos de tecnologia.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-outline-variant/20 pt-2 sm:pt-0" data-tour="contract-icti-btn">
                {onOpenIctiCalculator && (
                  <button
                    type="button"
                    onClick={() => onOpenIctiCalculator(selectedContratoId || '')}
                    className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Calculadora do ICTI</span>
                  </button>
                )}
                {ictiLatest && (
                  <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[9px] sm:text-[10px] font-bold px-2.5 py-1 rounded-full">
                    Último divulgado: {ictiLatest.value}% ({(() => {
                      try {
                        const d = new Date(ictiLatest.date);
                        return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
                      } catch { return '—'; }
                    })()})
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsIctiPanelExpanded(!isIctiPanelExpanded)}
                  className="p-1 px-2.5 hover:bg-surface-container text-xs text-primary font-bold rounded flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {isIctiPanelExpanded ? (
                    <>
                      <span>Ocultar Painel</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Mostrar Painel</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {isIctiPanelExpanded && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2 animate-in slide-in-from-top-1 duration-200">
                {/* Chart Column - Span 4 */}
                <div className="lg:col-span-4 space-y-3 border-r border-outline-variant/30 pr-0 lg:pr-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                      Gráfico de Variação (Últimos 12m)
                    </span>
                  </div>

                  {ictiLoading ? (
                    <div className="h-44 bg-surface-container-low border border-outline-variant/30 rounded-xl flex items-center justify-center text-xs text-on-surface-variant italic">
                      Carregando gráfico...
                    </div>
                  ) : (
                    <div className="h-44 bg-surface-container-low border border-outline-variant/30 p-2.5 rounded-xl">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={ictiData.slice(-12)}>
                          <defs>
                            <linearGradient id="colorIcti" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#d97706" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2c" />
                          <XAxis 
                            dataKey="date" 
                            stroke="#8c8c8c" 
                            fontSize={9}
                            tickFormatter={(str) => {
                              try {
                                const d = new Date(str);
                                return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
                              } catch { return str; }
                            }}
                          />
                          <YAxis 
                            stroke="#8c8c8c" 
                            fontSize={9} 
                            tickFormatter={(v) => `${v}%`}
                          />
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }}
                            labelStyle={{ color: '#aaa', fontSize: 10 }}
                            itemStyle={{ color: '#fbbf24', fontSize: 11 }}
                            labelFormatter={(str) => {
                              try {
                                const d = new Date(str);
                                return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
                              } catch { return str; }
                            }}
                            formatter={(value: any) => [`${value}%`, 'Variação']}
                          />
                          <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorIcti)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <span className="text-[9px] text-on-surface-variant block leading-tight">
                    * Dados do <strong>ICTI</strong> integrados em tempo real via API oficial do <strong>Ipea/Ipeadata</strong>.
                  </span>
                </div>

                {/* Table Column - Span 3 */}
                <div className="lg:col-span-3 space-y-3 border-r border-outline-variant/30 pr-0 lg:pr-4">
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                    Histórico dos Últimos 12m
                  </span>
                  
                  {ictiLoading ? (
                    <div className="h-44 bg-surface-container-low border border-outline-variant/30 rounded-xl flex items-center justify-center text-xs text-on-surface-variant italic">
                      Carregando tabela...
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-low">
                      <div className="max-h-[176px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse text-[10.5px]">
                          <thead>
                            <tr className="bg-surface-container/80 sticky top-0 border-b border-outline-variant/30 text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">
                              <th className="px-2 py-1.5">Mês Ref.</th>
                              <th className="px-2 py-1.5 text-right">Taxa (12m)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/25 font-mono">
                            {ictiData.slice(-12).reverse().map((item, idx) => {
                              try {
                                const d = new Date(item.date);
                                const mesAno = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' });
                                return (
                                  <tr key={idx} className="hover:bg-surface-container/50 transition-colors">
                                    <td className="px-2 py-1 text-on-surface font-sans capitalize">{mesAno}</td>
                                    <td className="px-2 py-1 text-right font-semibold text-amber-400">
                                      {item.value.toFixed(2)}%
                                    </td>
                                  </tr>
                                );
                              } catch {
                                return null;
                              }
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Calculator Column - Span 5 */}
                <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block mb-2">
                      Simulador & Aplicação de Reajuste
                    </span>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Selecione o Contrato para Reajustar</label>
                        <select
                          value={calcSelectedContratoId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCalcSelectedContratoId(val);
                            if (val) {
                              const found = contratos.find(c => c.id === val);
                              if (found) {
                                setCalcProcessoSEI(found.SEI_Processo || '');
                                if (ictiData.length > 0) {
                                  setCalcSelectedRate(ictiLatest ? ictiLatest.value : 4.44);
                                }
                              }
                            }
                          }}
                          className="w-full bg-surface-container-low border border-outline rounded px-2 py-1.5 text-xs text-on-surface font-semibold text-primary"
                        >
                          <option value="">-- Escolha um Contrato Ativo --</option>
                          {contratos.filter(c => c.Status_Contrato !== 'Encerrado' && c.Periodicidade_Pagamento !== 'Total').map(c => (
                            <option key={c.id} value={c.id}>
                              {c.Num_Contrato} - {c.Objeto.slice(0, 45)}...
                            </option>
                          ))}
                        </select>
                      </div>

                      {calcSelectedContratoId && (() => {
                        const contract = contratos.find(c => c.id === calcSelectedContratoId);
                        if (!contract) return null;

                        const baseVal = contract.Valor_Atualizado || contract.Valor_Contrato || 0;
                        const budgetDateStr = contract.Data_Orcamento_Estimado || contract.Vigencia_Inicio || '';
                        
                        // Calculate elapsed time
                        const baseDate = new Date(budgetDateStr);
                        const nowDate = new Date(currentLocalTime);
                        const elapsedMonths = Math.max(0, (nowDate.getFullYear() - baseDate.getFullYear()) * 12 + (nowDate.getMonth() - baseDate.getMonth()));

                        // Calculate adjustment suggestion
                        let matchingRate = ictiLatest ? ictiLatest.value : 4.44;
                        let foundMonthStr = "Último índice divulgado";
                        if (ictiData.length > 0 && budgetDateStr) {
                          const targetAdjustMonth = new Date(baseDate);
                          targetAdjustMonth.setFullYear(targetAdjustMonth.getFullYear() + 1);
                          
                          let closest = ictiData[0];
                          let minDiff = Infinity;
                          ictiData.forEach(d => {
                            const diff = Math.abs(new Date(d.date).getTime() - targetAdjustMonth.getTime());
                            if (diff < minDiff) {
                              minDiff = diff;
                              closest = d;
                            }
                          });
                          
                          if (targetAdjustMonth.getTime() > nowDate.getTime() || minDiff > 1000 * 60 * 60 * 24 * 60) {
                            closest = ictiLatest || ictiData[ictiData.length - 1];
                            foundMonthStr = `Último divulgado (Ref. ${new Date(closest.date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })})`;
                          } else {
                            foundMonthStr = `12m após orçamento (Ref. ${new Date(closest.date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })})`;
                          }
                          matchingRate = closest.value;
                        }

                        const adjustmentAmount = parseFloat((baseVal * (matchingRate / 100)).toFixed(2));
                        const finalValue = parseFloat((baseVal + adjustmentAmount).toFixed(2));

                        return (
                          <div className="bg-surface-container/60 border border-outline-variant/40 rounded-xl p-3 space-y-2.5 text-xs">
                            <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                              <div>
                                <span className="text-on-surface-variant block">Valor Atual:</span>
                                <strong className="font-mono text-on-surface">{formatCurrency(baseVal)}</strong>
                              </div>
                              <div>
                                <span className="text-on-surface-variant block">Base Orçamento:</span>
                                <strong className="font-mono text-amber-300">{formatDate(budgetDateStr)}</strong>
                              </div>
                              <div>
                                <span className="text-on-surface-variant block">Tempo Decorrido:</span>
                                <strong className="font-mono text-on-surface">{elapsedMonths} meses</strong>
                              </div>
                              <div>
                                <span className="text-on-surface-variant block">Taxa Sugerida (ICTI):</span>
                                <strong className="font-mono text-emerald-400">{matchingRate}%</strong>
                              </div>
                            </div>

                            <p className="text-[10px] text-on-surface-variant italic leading-tight border-t border-outline-variant/20 pt-1.5">
                              * Baseado em: <strong>{foundMonthStr}</strong>
                            </p>

                            <div className="border-t border-dashed border-outline-variant/40 pt-2 flex justify-between items-center">
                              <div>
                                <span className="text-[10px] text-on-surface-variant block leading-none">Acréscimo:</span>
                                <strong className="font-mono text-emerald-400 text-xs">+{formatCurrency(adjustmentAmount)}</strong>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-on-surface-variant block leading-none">Novo Valor Projetado:</span>
                                <strong className="font-mono text-primary text-sm">{formatCurrency(finalValue)}</strong>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedContratoId(contract.id);
                                setAlteracaoTipo('Apostilamento');
                                setAlteracaoData(new Date(currentLocalTime).toISOString().split('T')[0]);
                                setAlteracaoProcessoSEI(contract.SEI_Processo || '');
                                setAlteracaoPorcentagem(matchingRate);
                                setAlteracaoValor(adjustmentAmount);
                                setAlteracaoSEI(`REAJUSTE-ICTI-${new Date(currentLocalTime).getFullYear()}`);
                                setAlteracaoObs(`Reajuste monetário de ${matchingRate}% referente à variação anual do ICTI, com data base de orçamento em ${formatDate(budgetDateStr)}. Valor de reajuste calculado em ${formatCurrency(adjustmentAmount)}.`);
                                setIsAlteracaoModalOpen(true);
                              }}
                              className="w-full mt-1.5 py-1.5 bg-primary text-on-primary rounded text-xs font-bold hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <PenTool className="w-3.5 h-3.5" />
                              Aplicar Reajuste Técnico
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

            {/* Financial Execution Pie Chart Column */}
            <div className="hidden lg:col-span-5 bg-surface border border-outline rounded-xl p-5 shadow-sm flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-3 border-b border-outline-variant/60">
                  <span className="p-1 px-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold rounded-xl text-xs flex items-center justify-center">$</span>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">Execução Orçamentária Global</h3>
                    <p className="text-[11px] text-on-surface-variant leading-tight">Consolidação de empenhos e liquidações do órgão.</p>
                  </div>
                </div>

                <div className="flex flex-row items-center justify-between gap-3 mt-4">
                  {/* Left: Recharts Pie Chart */}
                  <div className="w-1/2 h-32 relative flex items-center justify-center">
                    {financialChartData.length === 0 ? (
                      <span className="text-[10px] text-on-surface-variant italic text-center">Sem lançamentos financeiros.</span>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={financialChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={28}
                            outerRadius={45}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {financialChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
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
                            itemStyle={{ color: '#f8fafc', padding: '0px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                    {financialChartData.length > 0 && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
                        <span className="text-[9px] uppercase font-bold text-on-surface-variant font-mono animate-fade-in">Pago</span>
                        <strong className="text-xs font-bold text-on-surface font-mono">
                          {totalEmpenhado > 0 ? ((totalPago / totalEmpenhado) * 100).toFixed(0) : 0}%
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Right: Detailed Value List */}
                  <div className="w-1/2 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-on-surface-variant text-[10px]">
                        <span className="w-2 h-2 rounded-full bg-[#eab308]"></span>
                        <span>Empenhado</span>
                      </div>
                      <span className="font-semibold text-on-surface font-mono text-[10px]">{formatCurrency(totalEmpenhado)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-on-surface-variant text-[10px]">
                        <span className="w-2 h-2 rounded-full bg-[#3b82f6]"></span>
                        <span>Liquidado</span>
                      </div>
                      <span className="font-semibold text-on-surface font-mono text-[10px]">{formatCurrency(totalLiquidado)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-on-surface-variant text-[10px]">
                        <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
                        <span>Pago</span>
                      </div>
                      <span className="font-semibold text-on-surface font-mono text-[10px]">{formatCurrency(totalPago)}</span>
                    </div>

                    <div className="pt-2 border-t border-outline-variant/30 flex justify-between items-center text-[10px] text-on-surface font-semibold">
                      <span>Total Executado (Base):</span>
                      <strong className="font-mono text-[10px]">{formatCurrency(totalEmpenhado)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick tip on tracking */}
              <div className="mt-2 text-[9px] text-on-surface-variant italic leading-tight">
                * Os dados representam a soma acumulada de todas as liquidações.
              </div>
            </div>

          {/* Somatório de Contratos com Itens SOF Anualizados */}
          <div className="bg-surface border-2 border-primary/20 hover:border-primary/45 rounded-2xl p-5 shadow flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="space-y-1 flex-1">
              <span className="text-[10px] uppercase font-bold text-primary flex items-center gap-1.5 tracking-wider font-sans">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-ping"></span>
                Valor Anual Consolidado (Itens SOF Cadastrados) — Ano {selectedYear || '2026'}
              </span>
              <h3 className="text-sm font-bold text-on-surface">Valores Anualizados dos Contratos com Itens de SOF do Órgão</h3>
              <p className="text-xs text-on-surface-variant max-w-3xl leading-relaxed">
                Este somatório considera apenas contratos que possuem itens da SOF cadastrados e vigentes no ano selecionado ({selectedYear || '2026'}), calculados de forma proporcional com base em suas respectivas vigências e possíveis prorrogações ativas.
              </p>
            </div>
            <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 min-w-[240px] text-center sm:text-right flex flex-col justify-center shrink-0">
              <span className="text-[9px] uppercase font-bold text-on-surface-variant font-sans tracking-widest block leading-none mb-1">Total Anualizado</span>
              <strong className="text-xl sm:text-2xl font-extrabold text-primary font-mono block">
                {formatCurrency(calcTotalItensSOFAnualizados())}
              </strong>
              <span className="text-[9px] text-on-surface-variant font-mono mt-1 block">Fórmula: Proporcional no Exercício</span>
            </div>
          </div>

          {/* Table Filters */}
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 flex flex-col md:flex-row items-stretch md:items-center gap-5">
            <div className="flex-1 space-y-2">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Filtrar por Termo / Processo / Nº Contrato</label>
              <input
                type="text"
                placeholder="Buscar contrato..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>

            <div className="flex-1 space-y-2">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Vigência Ativa</label>
              <div className="flex flex-wrap gap-4 items-center h-8">
                {(['Vigente', 'A Vencer', 'Encerrado'] as StatusContrato[]).map(st => (
                  <label key={st} className="flex items-center gap-2 cursor-pointer text-xs text-on-surface hover:text-primary transition-colors">
                    <input
                      type="checkbox"
                      checked={statusFilter.includes(st)}
                      onChange={() => handleStatusCheck(st)}
                      className="w-3.5 h-3.5 rounded border-outline-variant bg-transparent text-primary focus:ring-primary/20"
                    />
                    <span>{st}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => { setStatusFilter(['Vigente', 'A Vencer']); setSearchQuery(''); }}
                className="px-4 py-1.5 text-xs text-primary hover:underline hover:bg-primary/5 rounded-lg transition-colors border border-transparent hover:border-primary/20"
              >
                Limpar
              </button>
            </div>
          </div>

          {/* Contracts table list */}
          <div className="overflow-x-auto font-sans">
            <table className="w-full min-w-[1000px] text-left border-separate border-spacing-y-2">
              <thead>
                <tr className="text-on-surface-variant">
                  <th 
                    className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => handleSort('Num_Contrato')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Contrato / Proc SEI</span>
                      {sortKey === 'Num_Contrato' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => handleSort('Fornecedor')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Empresa / Fornecedor</span>
                      {sortKey === 'Fornecedor' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => handleSort('Objeto')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Objeto Resumido</span>
                      {sortKey === 'Objeto' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => handleSort('Vigencia_Inicio')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Início Vigência</span>
                      {sortKey === 'Vigencia_Inicio' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => handleSort('Vigencia_Final')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Vigência Fim Calculada</span>
                      {sortKey === 'Vigencia_Final' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-right cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => handleSort('Valor_Anual_SOF')}
                  >
                    <div className="flex items-center justify-end gap-1 w-full">
                      <span>Valor Anual SOF ({selectedYear})</span>
                      {sortKey === 'Valor_Anual_SOF' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => handleSort('Perspectiva_Renovacao')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Perspectiva de Renovação</span>
                      {sortKey === 'Perspectiva_Renovacao' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => handleSort('Status_Contrato')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Status</span>
                      {sortKey === 'Status_Contrato' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => handleSort('Gestor_Contrato')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Fiscais Gestores</span>
                      {sortKey === 'Gestor_Contrato' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-right select-none">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedContratos.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-xs text-on-surface-variant bg-surface-container-low/50 dark:bg-[#0c1424]/40 rounded-xl border border-outline-variant/30 font-medium italic">
                      Nenhum contrato ativo coincide com os filtros do banco de dados do SharePoint.
                    </td>
                  </tr>
                ) : (
                  paginatedContratos.map((cont, idx) => {
                    const computedFim = cont.Vigencia_Final;
                    const isRecent = isModifiedRecently(cont.updatedAt, currentLocalTime);
                    const fornObj = fornecedores.find(f => f.id === cont.Fornecedor);
                    const daysLeft = Math.ceil((computedFim.getTime() - new Date(currentLocalTime).getTime()) / (1000 * 60 * 60 * 24));
                    const cellBgClass = idx % 2 === 0
                      ? 'bg-surface-container-low/75 border-outline-variant/20'
                      : 'bg-surface-container/30 border-outline-variant/20';

                    return (
                      <tr key={cont.id} className="group transition-all duration-150">
                        <td className={`px-5 py-4 font-mono text-xs ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isRecent && (
                                <span className="bg-primary/20 text-primary border border-primary/30 text-[8px] font-bold px-1 rounded animate-pulse">
                                  REAJUSTE
                                </span>
                              )}
                              {cont.Status_Contrato === 'A Vencer' && (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" title={`A Vencer - expira em ${daysLeft} dias`} />
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedContratoId(cont.id)}
                                className="font-bold text-on-surface hover:text-primary hover:underline transition-colors text-left focus:outline-none"
                              >
                                {cont.Num_Contrato}
                              </button>
                              <CopyButton text={cont.Num_Contrato} label="Contrato" />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-on-surface-variant block">{cont.SEI_Processo}</span>
                              <CopyButton text={cont.SEI_Processo} label="Processo SEI" />
                            </div>
                            {(() => {
                              const linkedDfd = dfds.find(d => d.id === cont.DFD_Vinculado || d.Num_DFD === cont.DFD_Vinculado);
                              if (linkedDfd) {
                                return (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="inline-flex items-center gap-0.5 px-1 py-0.25 rounded text-[8px] font-mono font-bold bg-teal-400/10 border border-teal-500/25 text-teal-300">
                                      DFD {linkedDfd.Num_DFD}/{linkedDfd.Ano_PCA}
                                    </span>
                                    <CopyButton text={linkedDfd.Num_DFD} label="Número DFD" />
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </td>
                        <td className={`px-5 py-4 text-xs font-semibold text-primary ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                          {fornObj ? fornObj.Nome_Fornecedor : 'Inconsistência Fornecedor'}
                        </td>
                        <td className={`px-5 py-4 text-xs text-on-surface-variant max-w-xs truncate ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`} title={cont.Objeto}>
                          <button
                            type="button"
                            onClick={() => setSelectedContratoId(cont.id)}
                            className="text-left text-xs font-semibold text-on-surface hover:text-primary hover:underline transition-colors block w-full truncate focus:outline-none cursor-pointer"
                          >
                            {cont.Objeto}
                          </button>
                        </td>
                        <td className={`px-5 py-4 text-xs font-mono ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                          {formatDate(cont.Vigencia_Inicio)}
                        </td>
                        <td className={`px-5 py-4 text-xs font-mono font-semibold text-on-surface ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                          {formatDate(computedFim)}
                        </td>
                        <td className={`px-5 py-4 ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                          {(() => {
                            const sofInfo = getContractSOFValueForYear(cont, targetYearNum);
                            const startYear = cont.Vigencia_Inicio ? new Date(cont.Vigencia_Inicio).getUTCFullYear() : null;
                            const isSignedPriorYear = startYear ? startYear < targetYearNum : false;
                            const isZero = sofInfo.value === 0;

                            return (
                              <div className="text-right">
                                {sofInfo.source === 'items' ? (
                                  <div className="font-mono font-bold text-emerald-400">
                                    {formatCurrency(sofInfo.value)}
                                  </div>
                                ) : sofInfo.source === 'dfd' ? (
                                  <div className="font-mono" title={`Valor oriundo do DFD vinculado nº ${sofInfo.dfdNum}`}>
                                    <div className="font-bold text-primary">{formatCurrency(sofInfo.value)}</div>
                                    <span className="text-[10px] text-primary/70 font-sans italic block leading-none mt-0.5">(do DFD-{sofInfo.dfdNum} anualizado)</span>
                                  </div>
                                ) : sofInfo.source === 'dfd_duplicate' ? (
                                  <div className="text-right" title="Valor do DFD compartilhado com outro contrato para evitar duplicidade">
                                    <div className="font-mono text-on-surface-variant/50 line-through text-[11px]">{formatCurrency(0)}</div>
                                    <span className="text-[9px] text-amber-500 font-sans italic block leading-snug font-medium">Contabilizado no {sofInfo.duplicateMainContractNum || "outro contrato"}</span>
                                  </div>
                                ) : (
                                  <div className="font-mono text-on-surface-variant/60 italic" title={isZero && isSignedPriorYear && cont.Periodicidade_Pagamento === 'Total' ? "Pago com orçamento do exercício de assinatura do contrato (restos a pagar)" : "Sem itens SOF de contratação ativos"}>
                                    {formatCurrency(sofInfo.value)}
                                  </div>
                                )}
                                
                                {isZero && isSignedPriorYear && cont.Periodicidade_Pagamento === 'Total' && (
                                  <p className="text-[9px] text-amber-500/90 italic font-medium leading-tight mt-1 max-w-[170px] ml-auto text-right" title="Restos a pagar do exercício de assinatura">
                                    valores pagos com orçamento do exercício de assinatura do contrato ({startYear}) (restos a pagar)
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className={`px-5 py-4 text-center ${cellBgClass} group-hover:bg-primary/5 dark:group-hover:bg-[#1e2d4a]/25 first:rounded-l-xl last:rounded-r-xl border-y border-outline-variant/10 first:border-l last:border-r`}>
                          {(() => {
                            const sofInfo = getContractSOFValueForYear(cont, targetYearNum);
                            const activeItems = (itensSOF || []).filter(i => 
                              (i.Num_Contrato === cont.id || i.Num_Contrato === cont.Num_Contrato) && 
                              i.Status_Item === 'Ativo'
                            );
                            const hasSOFItems = activeItems.length > 0;
                            const startYear = cont.Vigencia_Inicio ? new Date(cont.Vigencia_Inicio).getUTCFullYear() : null;
                            const isSignedPriorYear = startYear ? startYear < targetYearNum : false;
                            const isRestosAPagar = cont.Periodicidade_Pagamento === 'Total' && isSignedPriorYear;
                            const computedFim = cont.Vigencia_Final;
                            const calculatedStatus = getStatusContrato(computedFim, currentLocalTime);
                            const isEncerrado = calculatedStatus?.toLowerCase() === 'encerrado' || cont.Status_Contrato?.toLowerCase() === 'encerrado';
                            
                            const isZero = sofInfo.value === 0;
                            const isDuplicate = sofInfo.source === 'dfd_duplicate';
                            const isDfdSource = sofInfo.source === 'dfd';

                            const isPagoTotal = cont.Periodicidade_Pagamento === 'Total';
                            const vencimentoNaoOcorreNoAno = computedFim ? computedFim.getUTCFullYear() !== targetYearNum : false;

                            const isEligible = hasSOFItems && !isRestosAPagar && !isEncerrado && !isZero && !isDuplicate && !isDfdSource && !isPagoTotal && !vencimentoNaoOcorreNoAno;
                            const isSim = !!cont.Perspectiva_Renovacao;

                            if (!isEligible) {
                              let tooltipMsg = "Esta opção está indisponível";
                              let reasonMsg = "Incompatível";

                              if (isPagoTotal) {
                                reasonMsg = "Pgto. Total";
                                tooltipMsg = "Contrato com periodicidade de pagamento Total (não há renovação mensal)";
                              } else if (vencimentoNaoOcorreNoAno) {
                                const yearFim = computedFim ? computedFim.getUTCFullYear() : "";
                                reasonMsg = `Vence em ${yearFim}`;
                                tooltipMsg = `O vencimento do contrato não ocorre neste exercício de ${targetYearNum} (Vence em ${yearFim})`;
                              } else if (!hasSOFItems || isDfdSource) {
                                reasonMsg = "Origem DFD";
                                tooltipMsg = "Valor oriundo de DFD fallback (sem itens SOF)";
                              } else if (isRestosAPagar) {
                                reasonMsg = "Restos a Pagar";
                                tooltipMsg = "Pago com orçamento do exercício de assinatura do contrato (restos a pagar)";
                              } else if (isEncerrado) {
                                reasonMsg = "Encerrado";
                                tooltipMsg = "Contrato encerrado";
                              } else if (isZero) {
                                reasonMsg = "Zero SOF";
                                tooltipMsg = "Valor orçamentário zerado neste exercício";
                              } else if (isDuplicate) {
                                reasonMsg = "Duplicidade";
                                tooltipMsg = "Contrato duplicado da mesma origem DFD para evitar duplicidade";
                              }

                              return (
                                <div className="flex flex-col items-center justify-center font-sans gap-0.5 max-w-[100px] mx-auto" title={tooltipMsg}>
                                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-surface-container-low text-on-surface-variant/40 border border-outline-variant/10 cursor-not-allowed text-center leading-none">
                                    N/A
                                  </span>
                                  <span className="text-[9px] text-on-surface-variant/50 text-center leading-tight break-words max-w-[90px]">
                                    {reasonMsg}
                                  </span>
                                </div>
                              );
                            }

                            const prorrogaMeses = aditivos
                              .filter(ad => (ad.Num_Contrato === cont.id || ad.Num_Contrato === cont.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
                              .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
                            const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(cont.Numero_Renovacoes) || 0);

                            const currentTotalDuration = (Number(cont.Vigencia_Inicial_Meses) || 12) + totalRenovacaoMeses;
                            const maxAllowed = Number(cont.Tempo_Possivel_Prorrogacao_Meses) || 60;
                            const cannotBeRenewed = currentTotalDuration >= maxAllowed;

                            return (
                              <button
                                type="button"
                                disabled={currentUser.role === 'Visualizador'}
                                onClick={() => {
                                  if (!isSim && cannotBeRenewed) {
                                    alert(`Não é possível prorrogar/renovar este contrato pois ele já atingiu o limite de vigência máxima permitido de ${maxAllowed} meses (Vigência atual: ${currentTotalDuration} meses).`);
                                    return;
                                  }
                                  onEditContrato({
                                    ...cont,
                                    Perspectiva_Renovacao: !isSim
                                  });
                                }}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium leading-none ${
                                  isSim
                                    ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300 line-through'
                                } ${currentUser.role !== 'Visualizador' ? 'hover:brightness-125 cursor-pointer' : 'opacity-80'}`}
                                title={isSim ? "Perspectiva de Renovação: Ativa (Considera o ano todo). Clique para alterar para NÃO." : "Perspectiva de Renovação: Não ativa (Considera valor proporcional). Clique para alterar para SIM."}
                              >
                                {isSim ? 'SIM' : 'NÃO'}
                              </button>
                            );
                          })()}
                        </td>
                        <td className={`px-5 py-4 text-center ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                          {cont.Status_Contrato === 'A Vencer' ? (
                            <div className="flex flex-col items-center gap-0.5" title={`Contrato ativo expirando em ${daysLeft} dias.`}>
                              <span className="inline-flex px-2 py-0.5 rounded bg-amber-400/10 border border-amber-500/20 text-amber-300 font-bold text-[9px] animate-pulse">
                                A Vencer
                              </span>
                              <span className="text-[9px] text-amber-500 font-bold whitespace-nowrap">
                                ({daysLeft} d restantes)
                              </span>
                            </div>
                          ) : cont.Status_Contrato === 'Vigente' ? (
                            <ReUIBadge variant="success">Vigente</ReUIBadge>
                          ) : (
                            <ReUIBadge variant="neutral">{cont.Status_Contrato || 'Encerrado'}</ReUIBadge>
                          )}
                        </td>
                        <td className={`px-5 py-4 text-xs text-on-surface-variant ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                          <div className="space-y-0.5">
                            <p className="font-semibold block leading-none">Tit: {cont.Gestor_Contrato}</p>
                            <p className="text-[10px] leading-none text-on-surface-variant/70">Subst: {cont.Gestor_Substituto || 'sem substituto'}</p>
                          </div>
                        </td>
                        <td className={`px-5 py-4 text-right ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                          <div className="flex justify-end items-center gap-1 opacity-80 group-hover:opacity-100 transition-all">
                            <button
                              type="button"
                              onClick={() => onViewLineage && onViewLineage(cont.id, 'contrato')}
                              className="p-1 px-1.5 text-[10px] font-bold bg-primary/5 hover:bg-primary/15 border border-outline text-primary rounded flex items-center gap-1 transition-all active:scale-95 cursor-pointer animate-in"
                              title="Ver Histórico e Rastreabilidade do Processo Completo"
                            >
                              <Shuffle className="w-3 h-3 text-primary animate-pulse" />
                              <span>Percurso</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedContratoId(cont.id)}
                              className="p-1 px-1.5 text-[10px] font-bold bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary rounded flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Detalhes</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEditContract(cont)}
                              className="p-1 px-1.5 text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-500 rounded flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                              title="Editar dados cadastrais do Contrato"
                            >
                              <Edit className="w-3 h-3" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteContract(cont.id, cont.Num_Contrato)}
                              className="p-1 text-on-surface-variant hover:text-rose-450 hover:bg-rose-550/10 rounded transition-colors cursor-pointer"
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

          {/* Contracts Pagination Controls */}
          {totalContratos > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-3 px-5 py-3.5 bg-surface-container-low/40 dark:bg-[#0c1424]/20 rounded-xl border border-outline-variant/30 font-sans select-none">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Linhas por página:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-surface-container border border-outline-variant/30 text-[11px] text-on-surface font-bold rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-[11px] font-bold text-on-surface-variant font-mono">
                  {(currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, totalContratos)} de {totalContratos}
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

                  {contratoPageNumbers.map(pageNum => (
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
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalContratoPages))}
                    disabled={currentPage === totalContratoPages || totalContratoPages === 0}
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
      /* Detailed View of selected contract - Full Screen directly in page */
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Detailed Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container border border-outline-variant p-3 sm:p-4 rounded-xl" data-tour="contrato-detail-header">
          <button
            onClick={() => {
              setSelectedContratoId(null);
              onCloseContractDetails?.();
            }}
            className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-all cursor-pointer font-medium self-start font-sans"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retornar para Lista de Contratos</span>
          </button>
          <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
            {selectedContract && (
              <>
                <button
                  type="button"
                  data-tour="contrato-detail-rastrear"
                  onClick={() => {
                    if (onViewLineage) {
                      onViewLineage(selectedContract.id, 'contrato');
                    }
                  }}
                  className="inline-flex items-center gap-1.25 bg-primary text-on-primary text-[10px] font-bold px-2.5 py-1.5 rounded-lg font-sans shadow transition-all hover:opacity-90 active:scale-95 cursor-pointer focus:outline-none"
                  title="Visualizar percurso completo do DFD ao Contrato, gerando relatório histórico PDF oficial"
                >
                  <Shuffle className="w-3 h-3 text-on-primary animate-pulse shrink-0" />
                  <span>Rastrear Percurso</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportFichaContratoToPDF(selectedContract)}
                  className="inline-flex items-center gap-1.25 bg-surface-container-highest border border-outline-variant hover:bg-surface-container-highest/80 text-on-surface text-[10px] font-bold px-2.5 py-1.5 rounded-lg font-sans shadow-sm transition-all active:scale-95 cursor-pointer focus:outline-none"
                  title="Exportar ficha detalhada do contrato em PDF oficial"
                >
                  <FileText className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
                  <span>Exportar PDF</span>
                </button>
                {onStartTour && (
                  <button
                    type="button"
                    onClick={() => onStartTour('contrato_details')}
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
              Processo SEI: {selectedContract?.SEI_Processo}
            </span>
            <span className="text-xs bg-primary/20 border border-primary/40 text-[10px] font-mono font-bold text-primary px-2.5 py-1 rounded truncate max-w-full">
              Ref: {selectedContract?.Num_Contrato}
            </span>
          </div>
        </div>

          {/* Complete Contract Sheet Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Objeto and detailed members (Left Column - 7 cols) */}
            <div className="lg:col-span-7 bg-surface-container-low border border-outline-variant rounded-xl p-5 sm:p-6 space-y-5 flex flex-col justify-between" data-tour="contrato-detail-info">
              <div className="space-y-3">
                {/* Status and Category Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] bg-primary/15 border border-primary/30 text-primary px-2.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                    CONTRATO INSTITUCIONAL
                  </span>
                  <span className="text-[10px] bg-surface-container-highest border border-outline-variant text-on-surface font-semibold px-2.5 py-0.5 rounded">
                    Modalidade: <strong className="text-primary">{selectedContract?.Modalidade_Contratacao || 'Pregão SOF'}</strong>
                  </span>
                  <span className="text-[10px] bg-surface-container-highest border border-outline-variant text-on-surface font-semibold px-2.5 py-0.5 rounded">
                    Pagamento: <strong className="text-on-surface">{selectedContract?.Periodicidade_Pagamento || 'Mensal'}</strong>
                  </span>
                  {selectedContract?.Portaria_Fiscalizacao_Numero || selectedContract?.Portaria_Fiscalizacao_SEI ? (
                    <span className="text-[10px] bg-surface-container-highest border border-outline-variant text-on-surface font-semibold px-2.5 py-0.5 rounded font-mono">
                      Portaria: {selectedContract.Portaria_Fiscalizacao_Numero || `SEI ${selectedContract.Portaria_Fiscalizacao_SEI}`}
                    </span>
                  ) : null}
                </div>

                {/* Objeto */}
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-on-surface leading-snug">
                    {selectedContract?.Objeto}
                  </h3>
                </div>

                {/* Fornecedor Banner */}
                <div className="bg-surface-container/60 border border-outline-variant/30 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider block">Fornecedor Contratado</span>
                      <p className="text-xs sm:text-sm font-bold text-primary truncate">
                        {fornecedores.find(f => f.id === selectedContract?.Fornecedor)?.Nome_Fornecedor || 'Fornecedor não localizado'}
                      </p>
                    </div>
                  </div>
                  {fornecedores.find(f => f.id === selectedContract?.Fornecedor)?.CNPJ && (
                    <span className="text-[10px] font-mono bg-surface-container-highest border border-outline-variant/40 text-on-surface-variant px-2.5 py-1 rounded font-semibold self-start sm:self-center shrink-0">
                      CNPJ: {fornecedores.find(f => f.id === selectedContract?.Fornecedor)?.CNPJ}
                    </span>
                  )}
                </div>
              </div>

              {/* Equipe de Gestão e Fiscalização do Contrato */}
              <div className="border-t border-outline-variant/30 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 font-display">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    Equipe de Gestão e Fiscalização
                  </span>
                  <span className="text-[10px] text-on-surface-variant">Papéis e Responsabilidades</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Gestão do Contrato */}
                  <div className="bg-surface-container/70 border border-outline-variant/30 rounded-lg p-3 space-y-2.5">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-outline-variant/20">
                      <UserCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-[10px] uppercase font-bold text-primary tracking-wider">Gestão do Contrato</span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] uppercase font-semibold text-on-surface-variant">Titular</span>
                          <span className="text-[8px] bg-primary/10 text-primary font-bold px-1.5 py-0.2 rounded font-mono">GESTOR</span>
                        </div>
                        <p className={`font-semibold truncate ${selectedContract?.Gestor_Contrato ? 'text-on-surface' : 'text-on-surface-variant/60 italic'}`}>
                          {selectedContract?.Gestor_Contrato || 'Não indicado'}
                        </p>
                      </div>
                      <div className="pt-1 border-t border-outline-variant/15">
                        <span className="text-[9px] uppercase font-semibold text-on-surface-variant block">Substituto</span>
                        <p className={`font-medium truncate ${selectedContract?.Gestor_Substituto ? 'text-on-surface/90' : 'text-on-surface-variant/60 italic'}`}>
                          {selectedContract?.Gestor_Substituto || 'Não indicado'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Fiscalização Técnica */}
                  <div className="bg-surface-container/70 border border-outline-variant/30 rounded-lg p-3 space-y-2.5">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-outline-variant/20">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Fiscalização Técnica</span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] uppercase font-semibold text-on-surface-variant">Titular</span>
                          <span className="text-[8px] bg-blue-500/10 text-blue-400 font-bold px-1.5 py-0.2 rounded font-mono">TÉCNICO</span>
                        </div>
                        <p className={`font-semibold truncate ${selectedContract?.Fiscal_Tecnico ? 'text-on-surface' : 'text-on-surface-variant/60 italic'}`}>
                          {selectedContract?.Fiscal_Tecnico || 'Não indicado'}
                        </p>
                      </div>
                      <div className="pt-1 border-t border-outline-variant/15">
                        <span className="text-[9px] uppercase font-semibold text-on-surface-variant block">Substituto</span>
                        <p className={`font-medium truncate ${selectedContract?.Fiscal_Tecnico_Substituto ? 'text-on-surface/90' : 'text-on-surface-variant/60 italic'}`}>
                          {selectedContract?.Fiscal_Tecnico_Substituto || 'Não indicado'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Fiscalização Administrativa */}
                  <div className="bg-surface-container/70 border border-outline-variant/30 rounded-lg p-3 space-y-2.5">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-outline-variant/20">
                      <FileCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span className="text-[10px] uppercase font-bold text-teal-400 tracking-wider">Fiscalização Administrativa</span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] uppercase font-semibold text-on-surface-variant">Titular</span>
                          <span className="text-[8px] bg-teal-500/10 text-teal-400 font-bold px-1.5 py-0.2 rounded font-mono">ADMIN</span>
                        </div>
                        <p className={`font-semibold truncate ${selectedContract?.Fiscal_Administrativo ? 'text-on-surface' : 'text-on-surface-variant/60 italic'}`}>
                          {selectedContract?.Fiscal_Administrativo || 'Não indicado'}
                        </p>
                      </div>
                      <div className="pt-1 border-t border-outline-variant/15">
                        <span className="text-[9px] uppercase font-semibold text-on-surface-variant block">Substituto</span>
                        <p className={`font-medium truncate ${selectedContract?.Fiscal_Administrativo_Substituto ? 'text-on-surface/90' : 'text-on-surface-variant/60 italic'}`}>
                          {selectedContract?.Fiscal_Administrativo_Substituto || 'Não indicado'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Fiscalização Requisitante */}
                  <div className="bg-surface-container/70 border border-outline-variant/30 rounded-lg p-3 space-y-2.5">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-outline-variant/20">
                      <UserIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Fiscalização Requisitante</span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] uppercase font-semibold text-on-surface-variant">Titular</span>
                          <span className="text-[8px] bg-amber-500/10 text-amber-400 font-bold px-1.5 py-0.2 rounded font-mono">REQUISITANTE</span>
                        </div>
                        <p className={`font-semibold truncate ${selectedContract?.Fiscal_Requisitante ? 'text-on-surface' : 'text-on-surface-variant/60 italic'}`}>
                          {selectedContract?.Fiscal_Requisitante || 'Não indicado'}
                        </p>
                      </div>
                      <div className="pt-1 border-t border-outline-variant/15">
                        <span className="text-[9px] uppercase font-semibold text-on-surface-variant block">Substituto</span>
                        <p className={`font-medium truncate ${selectedContract?.Fiscal_Requisitante_Substituto ? 'text-on-surface/90' : 'text-on-surface-variant/60 italic'}`}>
                          {selectedContract?.Fiscal_Requisitante_Substituto || 'Não indicado'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Preposto da Contratada (Full width on bottom) */}
                  <div className="sm:col-span-2 bg-surface-container/50 border border-outline-variant/30 rounded-lg p-2.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Briefcase className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider shrink-0">Preposto:</span>
                      <span className={`text-[11px] font-semibold truncate ${selectedContract?.Preposto ? 'text-on-surface' : 'text-on-surface-variant/60 italic'}`}>
                        {selectedContract?.Preposto || 'Não indicado'}
                      </span>
                    </div>
                    {selectedContract?.EmailPreposto && (
                      <a 
                        href={`mailto:${selectedContract.EmailPreposto}`}
                        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-mono bg-primary/10 border border-primary/20 px-2 py-0.5 rounded self-start sm:self-center"
                      >
                        <Mail className="w-3 h-3" />
                        {selectedContract.EmailPreposto}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Calculations and Vigências right panel (5 cols) */}
            <div className="lg:col-span-5 bg-surface-container-low border border-outline-variant p-5 sm:p-6 rounded-xl flex flex-col justify-between space-y-4" data-tour="contrato-detail-metrics">
              {/* Value metrics */}
              {(() => {
                const annualSoFVal = calculateValorAnualItemsSOF(selectedContract?.id || '', selectedContract?.Vigencia_Inicial_Meses || 12);
                const valorInicial = selectedContract?.Valor_Contrato || 0;
                const valorAtual = dynamicSelectedContractValorAtualizado;
                const deltaValor = valorAtual - valorInicial;
                const sofSharePercent = valorAtual > 0 ? Math.min(100, (annualSoFVal / valorAtual) * 100).toFixed(1) : '0';
                
                const isTotalPayment = selectedContract?.Periodicidade_Pagamento === 'Total';
                const startYear = selectedContract?.Vigencia_Inicio ? new Date(selectedContract.Vigencia_Inicio).getUTCFullYear() : null;
                const isSignedPriorYear = startYear ? startYear < targetYearNum : false;

                const execExerc = getContractBudgetExecution(selectedContract, targetYearNum);
                const pagoSoF = (isTotalPayment && isSignedPriorYear) ? annualSoFVal : execExerc.pago;
                const saldoSoFExec = Math.max(0, annualSoFVal - pagoSoF);

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
                      <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 font-display">
                        <DollarSign className="w-3.5 h-3.5 text-primary" />
                        Valores Contratuais
                      </span>
                      <span className="text-[10px] text-on-surface-variant font-mono">Exercício {targetYearNum}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Valor Total Atualizado */}
                      <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/30 min-w-0 flex flex-col justify-between">
                        <div className="min-w-0">
                          <span className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider flex items-center gap-1 truncate">
                            <TrendingUp className="w-3 h-3 text-primary shrink-0" />
                            Valor Global Atualizado
                          </span>
                          <span className="text-sm sm:text-base xl:text-lg font-bold font-mono text-on-surface block mt-1 leading-tight truncate" title={formatCurrency(valorAtual)}>
                            {formatCurrency(valorAtual)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1 text-[8.5px] text-on-surface-variant mt-1.5 pt-1.5 border-t border-outline-variant/20 min-w-0">
                          <span className="truncate">Inicial: {formatCurrency(valorInicial)}</span>
                          {deltaValor !== 0 && (
                            <span className={`font-mono font-bold shrink-0 ${deltaValor > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {deltaValor > 0 ? `+${formatCurrency(deltaValor)}` : formatCurrency(deltaValor)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Valor Itens SOF */}
                      <div className="bg-teal-500/10 border border-teal-500/30 p-3 rounded-lg flex flex-col justify-between min-w-0">
                        <div className="min-w-0">
                          <span className="text-[9px] uppercase font-bold text-teal-400 tracking-wider flex items-center gap-1 truncate">
                            <CheckCircle className="w-3 h-3 text-teal-400 shrink-0" />
                            {selectedContract?.Periodicidade_Pagamento === 'Total' ? 'Itens SOF (Total)' : `Itens SOF (${targetYearNum})`}
                          </span>
                          <span className="text-sm sm:text-base xl:text-lg font-bold font-mono text-teal-300 block mt-1 leading-tight truncate" title={formatCurrency(annualSoFVal)}>
                            {formatCurrency(annualSoFVal)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[8.5px] text-teal-200/80 mt-1.5 pt-1.5 border-t border-teal-500/20 min-w-0">
                          <span className="truncate">
                            {selectedContract?.Periodicidade_Pagamento === 'Total' ? 'Pagamento Total' : 'Proporcional Anualizado'}
                          </span>
                          <span className="font-mono font-bold text-teal-300 shrink-0">
                            {sofSharePercent}% do contrato
                          </span>
                        </div>
                      </div>

                      {/* Participação SOF no Contrato */}
                      <div className="bg-surface-container p-2.5 rounded-lg border border-outline-variant/30 min-w-0 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[8.5px] uppercase font-bold text-on-surface-variant tracking-wider block truncate">Participação SOF</span>
                          <strong className="text-xs sm:text-sm font-bold font-mono text-primary block truncate">{sofSharePercent}% do total</strong>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[8.5px] text-on-surface-variant block">Periodicidade</span>
                          <span className="text-[10px] font-bold text-on-surface font-mono">{selectedContract?.Periodicidade_Pagamento || 'Mensal'}</span>
                        </div>
                      </div>

                      {/* Saldo SOF a Executar */}
                      <div className="bg-surface-container p-2.5 rounded-lg border border-outline-variant/30 min-w-0 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[8.5px] uppercase font-bold text-on-surface-variant tracking-wider block truncate">Saldo SOF a Executar</span>
                          <strong className="text-xs sm:text-sm font-bold font-mono text-teal-300 block truncate" title={formatCurrency(saldoSoFExec)}>
                            {formatCurrency(saldoSoFExec)}
                          </strong>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[8.5px] text-on-surface-variant block">Pago SOF</span>
                          <span className="text-[10px] font-bold text-teal-400 font-mono">{formatCurrency(pagoSoF)}</span>
                        </div>
                      </div>
                    </div>

                    {(() => {
                      const isDfdDuplicate = selectedContract ? getContractSOFValueForYear(selectedContract, targetYearNum).source === 'dfd_duplicate' : false;
                      if (isSignedPriorYear && !isDfdDuplicate && selectedContract?.Periodicidade_Pagamento === 'Total') {
                        return (
                          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[9.5px] text-amber-300 font-medium leading-relaxed">
                            * Valores pagos com orçamento do exercício de assinatura do contrato ({startYear}) (restos a pagar).
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                );
              })()}

              {/* Critical Dates metrics / Timeline */}
              <div className="border-t border-outline-variant/30 pt-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 font-display">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    Datas Limites de Vigências
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-mono">Prazos Oficiais</span>
                </div>

                <div className="bg-surface-container/70 border border-outline-variant/30 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-[11px] pb-1.5 border-b border-outline-variant/15 text-amber-300 min-w-0">
                    <span className="font-medium flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                      Data Orçamento Estimado:
                    </span>
                    <span className="font-mono font-bold shrink-0">{formatDate(selectedContract?.Data_Orcamento_Estimado || '')}</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] pb-1.5 border-b border-outline-variant/15 min-w-0">
                    <span className="text-on-surface-variant font-medium flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                      Início da Vigência:
                    </span>
                    <span className="font-mono font-bold text-emerald-400 shrink-0">{formatDate(selectedContract?.Vigencia_Inicio || '')}</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] pb-1.5 border-b border-outline-variant/15 min-w-0">
                    <span className="text-on-surface-variant font-medium flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></span>
                      Vigência Fim Inicial ({selectedContract?.Vigencia_Inicial_Meses || 12}m):
                    </span>
                    <span className="font-mono font-bold text-on-surface shrink-0">{formatDate(getVigenciaFinalInicial(selectedContract?.Vigencia_Inicio || '', selectedContract?.Vigencia_Inicial_Meses || 12))}</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] pb-1.5 border-b border-outline-variant/15 text-teal-300 min-w-0">
                    <span className="font-medium flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0"></span>
                      Vigência Fim Aditivada:
                    </span>
                    <span className="font-mono font-bold shrink-0">{formatDate(selectedContract?.Vigencia_Final)}</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-rose-300 min-w-0">
                    <span className="font-medium flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></span>
                      Prorrogável Até (teto {selectedContract?.Tempo_Possivel_Prorrogacao_Meses || 60}m):
                    </span>
                    <span className="font-mono font-bold shrink-0">{formatDate(getProrrogavelAte(selectedContract?.Vigencia_Inicio || '', selectedContract?.Tempo_Possivel_Prorrogacao_Meses || 60))}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row: Segregação GND SOF & Execução SOF */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Custeio vs Investimento do Contrato (Itens SOF) */}
            {(() => {
              const { custeio, investimento } = getContractCusteioInvestimento(selectedContract, dynamicSelectedContractValorAtualizado);
              const total = custeio + investimento;
              const custeioPercent = total > 0 ? ((custeio / total) * 100).toFixed(0) : '0';
              const investimentoPercent = total > 0 ? ((investimento / total) * 100).toFixed(0) : '0';

              return (
                <div className="bg-surface-container-low border border-outline-variant p-5 sm:p-6 rounded-xl space-y-4 flex flex-col justify-between min-w-0">
                  <div className="flex items-center justify-between gap-2 border-b border-outline-variant/30 pb-2.5 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <TrendingUp className="w-4 h-4 text-primary shrink-0" />
                      <h4 className="text-xs uppercase font-extrabold text-on-surface tracking-wider font-display truncate">
                        Custeio vs Investimento (Itens SOF)
                      </h4>
                    </div>
                    <span className="text-[10px] text-on-surface-variant font-mono shrink-0">
                      Total: {formatCurrency(total)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                    {/* Donut Chart */}
                    <div className="sm:col-span-5 h-44 relative flex items-center justify-center bg-surface-container/30 rounded-xl border border-outline-variant/20 p-2 shrink-0">
                      {total === 0 ? (
                        <span className="text-[11px] text-on-surface-variant italic text-center p-2">Sem valores de custeio/investimento cadastrados.</span>
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
                                innerRadius={42}
                                outerRadius={62}
                                paddingAngle={4}
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
                          <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-[8px] uppercase font-bold text-on-surface-variant tracking-wider">CUSTEIO</span>
                            <strong className="text-sm sm:text-base font-bold text-blue-400 font-mono">
                              {custeioPercent}%
                            </strong>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Breakdown metrics with progress indicators */}
                    <div className="sm:col-span-7 space-y-3">
                      {/* Custeio Card */}
                      <div className="bg-surface-container/70 p-3 rounded-lg border border-outline-variant/30 space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                            <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider truncate">Custeio (GND 3)</span>
                          </div>
                          <span className="text-[11px] font-bold text-blue-400 font-mono shrink-0">{custeioPercent}%</span>
                        </div>
                        <div className="flex items-baseline justify-between min-w-0">
                          <strong className="text-sm sm:text-base font-bold font-mono text-on-surface truncate" title={formatCurrency(custeio)}>{formatCurrency(custeio)}</strong>
                        </div>
                        <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-blue-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(0, Number(custeioPercent)))}%` }}
                          />
                        </div>
                      </div>

                      {/* Investimento Card */}
                      <div className="bg-surface-container/70 p-3 rounded-lg border border-outline-variant/30 space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider truncate">Investimento (GND 4)</span>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-400 font-mono shrink-0">{investimentoPercent}%</span>
                        </div>
                        <div className="flex items-baseline justify-between min-w-0">
                          <strong className="text-sm sm:text-base font-bold font-mono text-on-surface truncate" title={formatCurrency(investimento)}>{formatCurrency(investimento)}</strong>
                        </div>
                        <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(0, Number(investimentoPercent)))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Card 2: Execução dos Itens SOF */}
            {(() => {
              const isTotalPayment = selectedContract?.Periodicidade_Pagamento === 'Total';
              const startYear = selectedContract?.Vigencia_Inicio ? new Date(selectedContract.Vigencia_Inicio).getUTCFullYear() : null;
              const isSignedPriorYear = startYear ? startYear < targetYearNum : false;

              const annualSoFVal = calculateValorAnualItemsSOF(selectedContract?.id || '', selectedContract?.Vigencia_Inicial_Meses || 12);
              const execExerc = getContractBudgetExecution(selectedContract, targetYearNum);
              const baseSoFVal = annualSoFVal > 0 ? annualSoFVal : (dynamicSelectedContractValorAtualizado || execExerc.empenhado || 1);

              let empenhadoSoF = execExerc.empenhado;
              let liquidadoSoF = execExerc.liquidado;
              let pagoSoF = execExerc.pago;
              let empenhadoSoFPercent = '0';
              let liquidadoSoFPercent = '0';
              let pagoSoFPercent = '0';

              if (isTotalPayment && isSignedPriorYear) {
                empenhadoSoF = baseSoFVal;
                liquidadoSoF = baseSoFVal;
                pagoSoF = baseSoFVal;
                empenhadoSoFPercent = '100';
                liquidadoSoFPercent = '100';
                pagoSoFPercent = '100';
              } else {
                empenhadoSoFPercent = baseSoFVal > 0 ? Math.min(100, (empenhadoSoF / baseSoFVal) * 100).toFixed(0) : '0';
                liquidadoSoFPercent = baseSoFVal > 0 ? Math.min(100, (liquidadoSoF / baseSoFVal) * 100).toFixed(0) : '0';
                pagoSoFPercent = baseSoFVal > 0 ? Math.min(100, (pagoSoF / baseSoFVal) * 100).toFixed(0) : '0';
              }

              const saldoSoF = Math.max(0, baseSoFVal - pagoSoF);

              const barChartData = [
                { name: 'Empenhado', valor: empenhadoSoF, color: '#eab308' },
                { name: 'Liquidado', valor: liquidadoSoF, color: '#3b82f6' },
                { name: 'Pago', valor: pagoSoF, color: '#10b981' }
              ];

              return (
                <div className="bg-surface-container-low border border-outline-variant p-5 sm:p-6 rounded-xl space-y-4 flex flex-col justify-between min-w-0">
                  <div className="flex items-center justify-between gap-2 border-b border-outline-variant/30 pb-2.5 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                      <h4 className="text-xs uppercase font-extrabold text-on-surface tracking-wider font-display truncate">
                        Execução Itens SOF {isTotalPayment ? '(Valor Total)' : `(${targetYearNum})`}
                      </h4>
                    </div>
                    {isTotalPayment && isSignedPriorYear ? (
                      <span className="text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold px-2 py-0.5 rounded-full shrink-0">
                        Pago em {startYear} (Restos a Pagar)
                      </span>
                    ) : (
                      <span className="text-[10px] text-on-surface-variant font-mono shrink-0">
                        Base: {formatCurrency(baseSoFVal)}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                    {/* Bar Chart Container */}
                    <div className="sm:col-span-5 h-44 relative flex items-center justify-center bg-surface-container/30 rounded-xl border border-outline-variant/20 p-2">
                      {empenhadoSoF === 0 && liquidadoSoF === 0 && pagoSoF === 0 ? (
                        <span className="text-[11px] text-on-surface-variant italic text-center p-2">Sem execução orçamentária lançada em {targetYearNum}.</span>
                      ) : (
                        <div className="w-full h-full relative flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                              <XAxis 
                                dataKey="name" 
                                stroke="#94a3b8" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false}
                              />
                              <YAxis hide domain={[0, 'auto']} />
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
                                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                              />
                              <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                                {barChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    {/* Empenhado, Liquidado, Pago Metrics */}
                    <div className="sm:col-span-7 space-y-2">
                      {/* Empenhado */}
                      <div className="bg-surface-container/70 p-2.5 px-3 rounded-lg border border-outline-variant/30 flex items-center justify-between gap-2 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0"></span>
                            <span className="text-[10px] uppercase font-bold text-yellow-500 font-sans truncate">Empenhado SOF</span>
                          </div>
                          <strong className="text-xs sm:text-sm font-bold font-mono text-on-surface block mt-0.5 truncate" title={formatCurrency(empenhadoSoF)}>{formatCurrency(empenhadoSoF)}</strong>
                        </div>
                        <span className="text-[10px] font-mono bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-bold px-2 py-0.5 rounded shrink-0">
                          {isTotalPayment && isSignedPriorYear ? '100%' : `${empenhadoSoFPercent}%`}
                        </span>
                      </div>

                      {/* Liquidado */}
                      <div className="bg-surface-container/70 p-2.5 px-3 rounded-lg border border-outline-variant/30 flex items-center justify-between gap-2 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0"></span>
                            <span className="text-[10px] uppercase font-bold text-blue-400 font-sans truncate">Liquidado SOF</span>
                          </div>
                          <strong className="text-xs sm:text-sm font-bold font-mono text-on-surface block mt-0.5 truncate" title={formatCurrency(liquidadoSoF)}>{formatCurrency(liquidadoSoF)}</strong>
                        </div>
                        <span className="text-[10px] font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded shrink-0">
                          {isTotalPayment && isSignedPriorYear ? '100%' : `${liquidadoSoFPercent}%`}
                        </span>
                      </div>

                      {/* Pago */}
                      <div className="bg-surface-container/70 p-2.5 px-3 rounded-lg border border-outline-variant/30 flex items-center justify-between gap-2 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                            <span className="text-[10px] uppercase font-bold text-emerald-400 font-sans truncate">Pago SOF</span>
                          </div>
                          <strong className="text-xs sm:text-sm font-bold font-mono text-emerald-300 block mt-0.5 truncate" title={formatCurrency(pagoSoF)}>{formatCurrency(pagoSoF)}</strong>
                        </div>
                        <span className="text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded shrink-0">
                          {isTotalPayment && isSignedPriorYear ? '100%' : `${pagoSoFPercent}%`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-outline-variant/30 pt-2 flex items-center justify-between text-[11px] min-w-0">
                    <span className="text-on-surface-variant truncate">Saldo SOF a Executar:</span>
                    <strong className="font-mono font-bold text-emerald-400 shrink-0" title={formatCurrency(saldoSoF)}>
                      {formatCurrency(saldoSoF)}
                    </strong>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Action Tools Panel (Alteração, Ocorrência, Documentos PDFs) */}
          <div className="flex flex-wrap gap-3 bg-surface-container border border-outline-variant p-4 rounded-xl items-center justify-between" data-tour="contrato-detail-actions">
            <div className="text-xs text-on-surface">
              <p className="font-semibold text-primary">Painel de Ações do Contrato</p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">Clique em um dos módulos para registrar alterações de valores, medições ou lançar pagamentos.</p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => setIsAlteracaoModalOpen(true)}
                className="px-3 py-1.5 bg-primary/10 border border-primary/30 rounded text-xs text-primary font-bold flex items-center gap-1 hover:bg-primary/20 cursor-pointer transition-all active:scale-95"
                title="Cadastrar Aditivo ou Apostilamento"
              >
                <PenTool className="w-3.5 h-3.5" />
                Alteração Contratual
              </button>

              <button
                onClick={() => setIsOcorrenciaModalOpen(true)}
                className="px-3 py-1.5 bg-surface-container-high border border-outline-variant rounded text-xs text-on-surface hover:border-primary cursor-pointer transition-all"
                title="Registrar ocorrências contratuais"
              >
                <Activity className="w-3.5 h-3.5 text-primary" />
                Registrar Ocorrência
              </button>

              <button
                onClick={() => setIsPagamentoModalOpen(true)}
                className="px-3 py-1.5 bg-teal-500/10 border border-teal-500/30 text-teal-300 rounded text-xs font-bold hover:bg-teal-500/20 cursor-pointer flex items-center gap-1 transition-all"
                title="Novo empenho, liquidação ou documento de repagamento"
              >
                <DollarSign className="w-3.5 h-3.5" />
                Lançar Execução / Pagamento
              </button>

              {selectedContract?.LinkContrato && (
                <button
                  type="button"
                  onClick={(e) => { 
                    e.preventDefault(); 
                    setViewingContractPdf(selectedContract);
                  }}
                  className="px-3 py-1.5 border border-outline-variant rounded text-xs text-on-surface-variant hover:text-on-surface flex items-center gap-1 hover:bg-surface-container-high cursor-pointer transition-all active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Visualizar Contrato PDF
                </button>
              )}
            </div>
          </div>

          {/* Sub-tab view selection for metrics details - Shortened & Merged to prevent overflow */}
          <div className="flex border-b border-outline-variant gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none" data-tour="contrato-detail-tabs">
            <button
              type="button"
              onClick={() => setActiveTab('itens')}
              data-tour="contrato-tab-itens"
              className={`px-3.5 py-3 cursor-pointer text-xs font-bold transition-all relative shrink-0 ${
                activeTab === 'itens' ? 'text-primary bg-primary/5' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Itens do Contrato
              {activeTab === 'itens' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('historico')}
              data-tour="contrato-tab-ocorrencias"
              className={`px-3.5 py-3 cursor-pointer text-xs font-bold transition-all relative shrink-0 ${
                activeTab === 'historico' ? 'text-primary bg-primary/5' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Ocorrências ({historicosContratuais.filter(h => h.ContratoRelacionado === selectedContract?.id).length})
              {activeTab === 'historico' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('aditamentos')}
              data-tour="contrato-tab-aditivos"
              className={`px-3.5 py-3 cursor-pointer text-xs font-bold transition-all relative shrink-0 ${
                activeTab === 'aditamentos' ? 'text-primary bg-primary/5' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Aditivos & Apostilamentos ({aditivos.filter(ad => ad.Num_Contrato === selectedContract?.id || ad.Num_Contrato === selectedContract?.Num_Contrato).length + apostilamentos.filter(ap => ap.Num_Contrato === selectedContract?.id || ap.Num_Contrato === selectedContract?.Num_Contrato).length})
              {activeTab === 'aditamentos' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ordensServico')}
              data-tour="contrato-tab-os"
              className={`px-3.5 py-3 cursor-pointer text-xs font-bold transition-all relative shrink-0 ${
                activeTab === 'ordensServico' ? 'text-primary bg-primary/5 font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              OS & Termos (TRP/TRD) ({selectedContract?.ordensServico?.length || 0})
              {activeTab === 'ordensServico' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('prestacoes')}
              data-tour="contrato-tab-pagamentos"
              className={`px-3.5 py-3 cursor-pointer text-xs font-bold transition-all relative shrink-0 ${
                activeTab === 'prestacoes' ? 'text-primary bg-primary/5 font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Financeiro / Pagamentos ({pagamentos.filter(p => p.Num_Contrato === selectedContract?.id).length})
              {activeTab === 'prestacoes' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded" />}
            </button>
          </div>

          {/* Interactive tabs bodies */}
          {activeTab === 'itens' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-on-surface">Detalhamento dos Itens de Catálogo pertencentes à SOF</h4>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 font-sans">Apenas itens desta portaria de despesa são contabilizados para fins orçamentários internos.</p>
                </div>
                <button
                  onClick={() => setIsItemModalOpen(true)}
                  className="flex items-center justify-center gap-1 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary text-xs rounded transition-colors font-semibold cursor-pointer w-full sm:w-auto shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Item
                </button>
              </div>

              {/* Items Table */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-x-auto text-xs">
                <table className="w-full min-w-[950px] text-left border-collapse font-sans">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
                      <th className="px-4 py-3 text-center border-r border-outline-variant/30">Grupo</th>
                      <th className="px-4 py-3 font-mono">Item</th>
                      <th className="px-4 py-3">Descrição de TIC</th>
                      <th className="px-4 py-3">Medida</th>
                      <th className="px-4 py-3 text-center">Quantidade</th>
                      <th className="px-4 py-3">Valor Unitário</th>
                      <th className="px-4 py-3 font-semibold">Valor Total do Item</th>
                      <th className="px-4 py-3 text-center">Natureza</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {groupedContractItens.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-8 text-on-surface-variant/70 italic">Nenhum item cadastrado para a SOF neste contrato. Adicione itens para recalcular as métricas financeiras.</td>
                      </tr>
                    ) : (
                      groupedContractItens.map(row => {
                        const item = row.item;
                        const isEditing = editingItemId === item.id;
                        if (isEditing && editingItemData) {
                          return (
                            <tr key={item.id} className="bg-surface-container/20 border-y border-primary/20">
                              {row.isFirstInGroup && (
                                <td 
                                  rowSpan={row.groupRowCount} 
                                  className="px-4 py-3 text-center font-bold text-on-surface bg-surface-container-low/40 border-r border-outline-variant/30 align-middle select-none"
                                >
                                  <span className="inline-block px-2.5 py-1 rounded-md bg-surface-container-highest/80 border border-outline-variant/50 text-primary font-mono text-[11px] font-bold shadow-xs">
                                    {row.groupLabel}
                                  </span>
                                </td>
                              )}
                              <td className="px-4 py-2 font-mono">
                                <input
                                  type="text"
                                  value={editingItemData.Numero_Item || ''}
                                  onChange={e => setEditingItemData({ ...editingItemData, Numero_Item: e.target.value })}
                                  className="w-12 bg-surface-container-low border border-outline-variant rounded px-1.5 py-1 text-xs text-on-surface font-bold font-mono focus:outline-none focus:border-primary"
                                  placeholder="01"
                                  title="Número do Item"
                                />
                                <input
                                  type="text"
                                  value={editingItemData.Grupo_Lote || ''}
                                  onChange={e => setEditingItemData({ ...editingItemData, Grupo_Lote: e.target.value })}
                                  className="w-full mt-1 bg-surface-container-low border border-outline-variant rounded px-1.5 py-1 text-[10px] text-on-surface-variant focus:outline-none focus:border-primary"
                                  placeholder="Grupo/Lote"
                                  title="Grupo ou Lote"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <textarea
                                  value={editingItemData.Descricao_Item || ''}
                                  onChange={e => setEditingItemData({ ...editingItemData, Descricao_Item: e.target.value })}
                                  className="w-full bg-surface-container-low border border-outline-variant rounded px-1.5 py-1 text-xs text-on-surface focus:outline-none focus:border-primary min-h-[50px]"
                                  placeholder="Descrição do Item..."
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={editingItemData.Unidade_Medida || ''}
                                  onChange={e => setEditingItemData({ ...editingItemData, Unidade_Medida: e.target.value })}
                                  className="w-16 bg-surface-container-low border border-outline-variant rounded px-1.5 py-1 text-xs text-on-surface focus:outline-none focus:border-primary"
                                  placeholder="Unidade"
                                />
                              </td>
                              <td className="px-4 py-2 text-center font-mono">
                                <input
                                  type="number"
                                  value={editingItemData.Quantidade || ''}
                                  onChange={e => setEditingItemData({ ...editingItemData, Quantidade: parseInt(e.target.value) || 0 })}
                                  className="w-14 bg-surface-container-low border border-outline-variant rounded px-1.5 py-1 text-xs text-on-surface text-center font-mono focus:outline-none focus:border-primary"
                                />
                              </td>
                              <td className="px-4 py-2 font-mono">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editingItemData.Valor_Unitario !== undefined && editingItemData.Valor_Unitario !== null ? editingItemData.Valor_Unitario : ''}
                                  onChange={e => {
                                    const parsed = parseFloat(e.target.value);
                                    setEditItemDataVal(isNaN(parsed) ? 0 : parsed);
                                  }}
                                  className="w-24 bg-surface-container-low border border-outline-variant rounded px-1.5 py-1 text-xs text-on-surface font-mono focus:outline-none focus:border-primary"
                                />
                              </td>
                              <td className="px-4 py-2 font-mono font-bold text-on-surface">
                                {formatCurrency((editingItemData.Quantidade || 0) * (editingItemData.Valor_Unitario || 0))}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <select
                                  value={editingItemData.Natureza_Despesa || 'Custeio'}
                                  onChange={e => setEditingItemData({ ...editingItemData, Natureza_Despesa: e.target.value as any })}
                                  className="bg-surface-container-low border border-outline-variant rounded px-1 py-1 text-[11px] text-on-surface focus:outline-none focus:border-primary font-bold cursor-pointer"
                                >
                                  <option value="Custeio" className="bg-surface text-on-surface">Custeio</option>
                                  <option value="Investimento" className="bg-surface text-on-surface">Investimento</option>
                                </select>
                              </td>
                              <td className="px-4 py-2 text-center">
                                <select
                                  value={editingItemData.Status_Item || 'Ativo'}
                                  onChange={e => setEditingItemData({ ...editingItemData, Status_Item: e.target.value as any })}
                                  className="bg-surface-container-low border border-outline-variant rounded px-1 py-1 text-[11px] text-on-surface focus:outline-none focus:border-primary font-bold cursor-pointer"
                                >
                                  <option value="Ativo" className="bg-surface text-on-surface">Ativo</option>
                                  <option value="Cancelado" className="bg-surface text-on-surface">Cancelado</option>
                                </select>
                              </td>
                              <td className="px-4 py-2 text-right">
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => handleSaveInlineItemSOF()}
                                    className="p-1 hover:text-green-400 text-on-surface-variant/60 cursor-pointer"
                                    title="Salvar alterações"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleCancelInlineEdit()}
                                    className="p-1 hover:text-rose-400 text-on-surface-variant/60 cursor-pointer"
                                    title="Cancelar"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={item.id} className="hover:bg-surface-container/30 transition-colors">
                            {row.isFirstInGroup && (
                              <td 
                                rowSpan={row.groupRowCount} 
                                className="px-4 py-3 text-center font-bold text-on-surface bg-surface-container-low/40 border-r border-outline-variant/30 align-middle select-none"
                              >
                                <span className="inline-block px-2.5 py-1 rounded-md bg-surface-container-highest/80 border border-outline-variant/50 text-primary font-mono text-[11px] font-bold shadow-xs">
                                  {row.groupLabel}
                                </span>
                              </td>
                            )}
                            <td className="px-4 py-3.5 font-semibold text-on-surface font-mono">
                              {item.Numero_Item}
                            </td>
                            <td className="px-4 py-3.5 text-on-surface font-medium max-w-sm truncate" title={item.Descricao_Item}>
                              {item.Descricao_Item}
                            </td>
                            <td className="px-4 py-3.5 text-on-surface-variant">
                              {item.Unidade_Medida}
                            </td>
                            <td className="px-4 py-3.5 text-center font-mono">
                              {item.Quantidade}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-on-surface-variant">
                              {formatCurrency(item.Valor_Unitario)}
                            </td>
                            <td className="px-4 py-3.5 font-mono font-bold text-on-surface">
                              {formatCurrency(item.Quantidade * item.Valor_Unitario)}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <button
                                onClick={() => {
                                  const newNatureza = item.Natureza_Despesa === 'Investimento' ? 'Custeio' : 'Investimento';
                                  onEditItemSOF({ ...item, Natureza_Despesa: newNatureza });
                                }}
                                className={`inline-flex px-1.5 py-0.25 text-[9px] rounded font-extrabold uppercase transition-all duration-150 cursor-pointer active:scale-95 ${
                                  item.Natureza_Despesa === 'Investimento'
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/35 hover:border-purple-500/50'
                                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/35 hover:border-blue-500/50'
                                }`}
                                title="Clique para alternar rapidamente entre Custeio e Investimento"
                              >
                                {item.Natureza_Despesa || 'Custeio'}
                              </button>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <button
                                onClick={() => {
                                  const newStatus = item.Status_Item === 'Ativo' ? 'Cancelado' : 'Ativo';
                                  onEditItemSOF({ ...item, Status_Item: newStatus });
                                }}
                                className={`inline-flex px-1.5 py-0.25 text-[9px] rounded font-semibold transition-all duration-150 cursor-pointer active:scale-95 ${
                                  item.Status_Item === 'Ativo'
                                    ? 'bg-green-500/10 text-green-300 border border-green-500/20 hover:bg-green-500/20 hover:border-green-500/30'
                                    : item.Status_Item === 'Cancelado'
                                    ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20 line-through hover:bg-rose-500/20 hover:border-rose-500/30'
                                    : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/30'
                                }`}
                                title="Clique para alternar rapidamente a situação"
                              >
                                {item.Status_Item}
                              </button>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex justify-end items-center gap-1.5">
                                {currentUser.role !== 'Visualizador' && (
                                  <button
                                    onClick={() => handleStartInlineEdit(item)}
                                    className="p-1 hover:text-primary text-on-surface-variant/40 transition-colors cursor-pointer"
                                    title="Editar item inline"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setDeleteConfirm({
                                      isOpen: true,
                                      type: 'itemSOF',
                                      id: item.id,
                                      title: 'Excluir Item da SOF',
                                      message: `Tem certeza de que deseja excluir o Item ${item.Numero_Item} ("${item.Descricao_Item}")? Esse desdobramento é utilizado para compor as métricas do orçamento em toda a plataforma.`,
                                    });
                                  }}
                                  className="p-1 hover:text-rose-400 text-on-surface-variant/40 transition-colors cursor-pointer"
                                  title="Remover item da SOF"
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

              {/* Proportional aggregate overview box */}
              {selectedContract && (
                <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-teal-300">Resumo de Empenhos Estimados SOF</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">Soma computada de itens ativos SOF de acordo com a vigência do contrato.</p>
                  </div>
                  <div className="flex gap-6">
                    <div>
                      <span className="text-[10px] uppercase font-mono block text-on-surface-variant">Soma Geral de Itens Ativos</span>
                      <strong className="text-sm font-mono text-on-surface">
                        {formatCurrency(selectedContractItens.filter(i => i.Status_Item === 'Ativo').reduce((sum, current) => sum + (current.Quantidade * current.Valor_Unitario), 0))}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono block text-on-surface-variant">
                        {selectedContract.Periodicidade_Pagamento === 'Total' 
                          ? 'Custo Total Contratual' 
                          : `Custo por Prazo Contratual (${selectedContract.Vigencia_Inicial_Meses} meses)`}
                      </span>
                      <strong className="text-sm font-mono text-teal-300">
                        {formatCurrency(
                          selectedContract.Periodicidade_Pagamento === 'Total'
                            ? calculateValorAnualItemsSOF(selectedContract.id, selectedContract.Vigencia_Inicial_Meses)
                            : (calculateValorAnualItemsSOF(selectedContract.id, selectedContract.Vigencia_Inicial_Meses) / 12) * selectedContract.Vigencia_Inicial_Meses
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'historico' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-semibold text-on-surface">Lançamentos de ocorrências e Gestão Contratual</h4>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Acompanhamento e notificações sobre entregas atrasadas, advertências ou garantias processadas.</p>
                </div>
              </div>

              {/* Occurences rows */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden divide-y divide-outline-variant/35">
                {historicosContratuais.filter(h => h.ContratoRelacionado === selectedContract?.id).length === 0 ? (
                  <div className="p-8 text-center text-xs text-on-surface-variant italic">Nenhuma ocorrência registrada no histórico desta fiscalização.</div>
                ) : (
                  historicosContratuais
                    .filter(h => h.ContratoRelacionado === selectedContract?.id)
                    .sort((a, b) => new Date(a.Data).getTime() - new Date(b.Data).getTime())
                    .map(h => (
                      <div key={h.id} className="p-4 flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-on-surface font-mono">{formatDate(h.Data)}</span>
                            <span className="text-[9px] bg-surface-container text-on-surface-variant px-1.5 py-0.25 rounded font-bold uppercase">{h.Coordenacao}</span>
                          </div>
                          <p className="text-xs text-on-surface leading-relaxed mt-1">{h.Descricao}</p>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/25">Doc {h.Numero_SEI}</span>
                          <button
                            onClick={() => {
                              if (currentUser.role === 'Visualizador') return;
                              setDeleteConfirm({
                                isOpen: true,
                                type: 'ocorrencia',
                                id: h.id,
                                title: 'Remover Ocorrência Contratual?',
                                message: `Tem certeza de que deseja remover esta ocorrência de ${formatDate(h.Data)} da Coordenação ${h.Coordenacao} no histórico desse contrato? Esta ação é irreversível.`
                              });
                            }}
                            className="p-1 text-on-surface-variant/40 hover:text-rose-400 cursor-pointer"
                            title="Remover ocorrência"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'aditamentos' && (
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-semibold text-on-surface">Histórico Chronológico de Alterações Contratuais (Aditivos/Apostilamentos)</h4>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Demonstração das repactuações inflacionárias e prorrogações acordadas com o fornecedor.</p>
                </div>
              </div>

              {/* Chronological visually plotted Timeline adjusted values */}
              <div className="bg-surface-container/60 border border-outline-variant rounded-xl p-5 space-y-4">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block">Linha do Tempo de Alterações Contratuais</span>
                
                {/* Timeline visual bar */}
                <div className="relative pl-6 border-l border-outline-variant space-y-4">
                  {/* Base reference index */}
                  <div className="relative">
                    <span className="absolute left-[-29px] top-1 w-2.5 h-2.5 rounded-full bg-outline border-2 border-surface shrink-0" />
                    <div className="text-xs space-y-0.5">
                      <p className="font-semibold text-on-surface">Valor Base do Contrato Assinado</p>
                      <p className="text-[10px] text-on-surface-variant">Original: {formatCurrency(selectedContract?.Valor_Contrato || 0)} &bull; {formatDate(selectedContract?.Vigencia_Inicio)}</p>
                    </div>
                  </div>

                  {/* Sequential Timeline nodes */}
                  {(() => {
                    const contractAditivos = aditivos.filter(ad => ad.Num_Contrato === selectedContract?.id || ad.Num_Contrato === selectedContract?.Num_Contrato);
                    const contractApostilamentos = apostilamentos.filter(ap => ap.Num_Contrato === selectedContract?.id || ap.Num_Contrato === selectedContract?.Num_Contrato);

                    const unifiedAlteracoes = [
                      ...contractAditivos.map(ad => ({
                        id: ad.id,
                        type: 'Aditivo' as const,
                        date: ad.Data_Aditivo,
                        record: ad
                      })),
                      ...contractApostilamentos.map(ap => ({
                        id: ap.id,
                        type: 'Apostilamento' as const,
                        date: ap.Data_Apostilamento,
                        record: ap
                      }))
                    ].sort((a, b) => {
                      const timeA = a.date ? new Date(a.date).getTime() : 0;
                      const timeB = b.date ? new Date(b.date).getTime() : 0;
                      return timeA - timeB;
                    });

                    return unifiedAlteracoes.map((item) => {
                      if (item.type === 'Aditivo') {
                        const ad = item.record as TermoAditivo;
                        const adIndex = contractAditivos.findIndex(x => x.id === ad.id);
                        return (
                          <div key={ad.id} className="relative animate-in fade-in slide-in-from-left-2 duration-150">
                            <span className="absolute left-[-29px] top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-surface shrink-0" />
                            <div className="text-xs space-y-0.5">
                              <p className="font-semibold text-primary flex items-center gap-1.5 flex-wrap">
                                Termo Aditivo Nº {adIndex + 1} &bull; {ad.Tipo_Aditivo}
                                <span className="text-[10px] text-on-surface-variant font-medium">({formatDate(ad.Data_Aditivo)})</span>
                                {ad.Processo_SEI && (
                                  <span className="text-[9px] bg-primary/10 px-1.5 py-0.5 rounded text-primary font-mono font-bold">Proc. {ad.Processo_SEI}</span>
                                )}
                                <span className="text-[9px] bg-primary/15 px-1.5 py-0.25 rounded text-primary">Doc {ad.Documento_SEI}</span>
                              </p>
                              <p className="text-on-surface-variant text-[11px] leading-relaxed italic">{ad.Observacoes}</p>
                              <div className="flex gap-4 font-mono text-[10px] text-on-surface-variant pt-1">
                                {ad.Valor_Aditivado > 0 && <span>Impacto: {formatCurrency(ad.Valor_Aditivado)}</span>}
                                {ad.Meses_Renovacoes > 0 && <span>Prorrogação: {ad.Meses_Renovacoes} meses</span>}
                                <span className="text-on-surface font-semibold">Valor Após Ajuste: {formatCurrency(ad.Valor_Final_Apos_Ajuste)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        const ap = item.record as TermoApostilamento;
                        const apIndex = contractApostilamentos.findIndex(x => x.id === ap.id);
                        return (
                          <div key={ap.id} className="relative animate-in font-sans">
                            <span className="absolute left-[-29px] top-1 w-2.5 h-2.5 rounded-full bg-tertiary border-2 border-surface shrink-0 animate-pulse" />
                            <div className="text-xs space-y-0.5">
                              <p className="font-semibold text-tertiary flex items-center gap-1.5 flex-wrap font-sans">
                                Termo de Apostilamento Nº {apIndex + 1} &bull; {ap.Tipo_Apostilamento}
                                <span className="text-[10px] text-on-surface-variant font-medium">({formatDate(ap.Data_Apostilamento)})</span>
                                {ap.Processo_SEI && (
                                  <span className="text-[9px] bg-tertiary-container/30 px-1.5 py-0.5 rounded text-tertiary font-mono font-bold">Proc. {ap.Processo_SEI}</span>
                                )}
                                <span className="text-[9px] bg-tertiary-container/30 px-1.5 rounded text-tertiary">Doc {ap.Documento_SEI}</span>
                              </p>
                              <p className="text-on-surface-variant text-[11px] leading-relaxed italic">{ap.Observacoes}</p>
                              <div className="flex gap-4 font-mono text-[10px] text-on-surface-variant pt-1">
                                <span>Reajuste Aplicado: {ap.Porcentagem_Reajuste}% ({formatCurrency(ap.Valor_do_Ajuste)})</span>
                                <span className="text-on-surface font-semibold">Valor Após Ajuste: {formatCurrency(ap.Valor_Final_Apos_Ajuste)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    });
                  })()}
                </div>
              </div>

              {/* Items alterations control tables */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden divide-y divide-outline-variant/30 text-xs text-on-surface">
                {aditivos.filter(ad => ad.Num_Contrato === selectedContract?.id || ad.Num_Contrato === selectedContract?.Num_Contrato).map(ad => (
                  <div key={ad.id} className="p-3.5 flex justify-between items-center bg-surface-container/10">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-on-surface">Termo Aditivo ({ad.Tipo_Aditivo}) &bull; SEI {ad.Documento_SEI}</p>
                      <p className="text-[11px] text-on-surface-variant">{ad.Observacoes}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 font-mono">
                      {ad.Meses_Renovacoes > 0 && <span className="text-primary font-bold">+{ad.Meses_Renovacoes} meses</span>}
                      {ad.Valor_Aditivado > 0 && <span className="font-semibold">{formatCurrency(ad.Valor_Aditivado)}</span>}
                      <button
                        onClick={() => {
                          if (currentUser.role === 'Visualizador') return;
                          setDeleteConfirm({
                            isOpen: true,
                            type: 'aditivo',
                            id: ad.id,
                            title: 'Remover Termo Aditivo?',
                            message: `Deseja realmente remover o Termo Aditivo (${ad.Tipo_Aditivo}) vinculado ao processo SEI: ${ad.Documento_SEI}? Esta ação não pode ser desfeita.`
                          });
                        }}
                        className="p-1 hover:text-rose-400 text-on-surface-variant/40 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {apostilamentos.filter(ap => ap.Num_Contrato === selectedContract?.id).map(ap => (
                  <div key={ap.id} className="p-3.5 flex justify-between items-center">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-on-surface">Apostilamento Técnico &bull; SEI {ap.Documento_SEI}</p>
                      <p className="text-[11px] text-on-surface-variant">{ap.Observacoes}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 font-mono">
                      <span className="text-tertiary">Reajuste {ap.Porcentagem_Reajuste}% (+{formatCurrency(ap.Valor_do_Ajuste)})</span>
                      <button
                        onClick={() => {
                          if (currentUser.role === 'Visualizador') return;
                          setDeleteConfirm({
                            isOpen: true,
                            type: 'apostilamento',
                            id: ap.id,
                            title: 'Remover Apostilamento Técnico?',
                            message: `Deseja realmente remover o Apostilamento Técnico vinculado ao processo SEI: ${ap.Documento_SEI}? Esta ação não pode ser desfeita.`
                          });
                        }}
                        className="p-1 hover:text-rose-405 text-on-surface-variant/40 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'prestacoes' && (
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-semibold text-on-surface">Módulo Financeiro SOF (Fluxo de Liquidação / Pagamentos)</h4>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Controle de fatura técnica unificado de faturamentos (Empenhado &gt; Liquidado &gt; Pago).</p>
                </div>
              </div>

              {/* Simple distribution bars */}
              {selectedContract && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Status counts widgets */}
                  {['Empenhado', 'Liquidado', 'Pago'].map(status => {
                    const statusPagamentos = pagamentos.filter(p => p.Num_Contrato === selectedContract.id && p.Status === status);
                    const totalVal = statusPagamentos.reduce((acc, current) => acc + current.Valor, 0);
                    
                    return (
                      <div key={status} className="bg-surface-container border border-outline-variant/65 rounded-xl p-4 flex flex-col justify-between">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${
                          status === 'Pago' ? 'text-teal-300' : status === 'Liquidado' ? 'text-blue-300' : 'text-amber-300'
                        }`}>{status}</span>
                        <div className="mt-2.5">
                          <span className="text-lg font-bold font-mono text-on-surface block">{formatCurrency(totalVal)}</span>
                          <span className="text-[9px] text-on-surface-variant block">{statusPagamentos.length} transações</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Payments log */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-x-auto text-xs">
                <table className="w-full min-w-[700px] text-left border-collapse font-sans">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
                      <th className="px-5 py-3">Documento SEI / NF</th>
                      <th className="px-5 py-3">Descrição da Ordem / Objeto</th>
                      <th className="px-5 py-3">Data Processada</th>
                      <th className="px-5 py-3 text-center">Exercício</th>
                      <th className="px-5 py-3">Valor Faturado</th>
                      <th className="px-5 py-3 text-center">Status de Liquidação</th>
                      <th className="px-5 py-3 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {pagamentos.filter(p => p.Num_Contrato === selectedContract?.id).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-on-surface-variant/70 italic">Nenhum pagamento ou empenho lançado ainda para este contrato fiscalizado.</td>
                      </tr>
                    ) : (
                      pagamentos
                        .filter(p => p.Num_Contrato === selectedContract?.id)
                        .map(p => (
                          <tr key={p.id} className="hover:bg-surface-container/35 transition-colors">
                            <td className="px-5 py-3.5 font-mono font-semibold text-on-surface">
                              <div className="font-semibold">{p.Documento_SEI}</div>
                              {p.processoSeiPagamento && (
                                <div className="text-[10px] text-emerald-400 mt-1 font-mono">
                                  SEI Pgm: {p.processoSeiPagamento}
                                </div>
                              )}
                              {p.idOSVinculada && (() => {
                                const linkedOs = selectedContract?.ordensServico?.find(os => os.id === p.idOSVinculada);
                                if (linkedOs) {
                                  return (
                                    <div className="text-[10px] text-primary mt-1 font-sans">
                                      Vinc: <span className="underline select-all">OS {linkedOs.numeroOS}</span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </td>
                            <td className="px-5 py-3.5 text-on-surface max-w-sm truncate" title={p.Descricao}>
                              {p.Descricao} <span className="text-[10px] text-on-surface-variant block select-text font-normal">{p.Observacoes || ''}</span>
                            </td>
                            <td className="px-5 py-3.5 text-on-surface-variant font-mono">
                              {formatDate(p.Data)}
                            </td>
                            <td className="px-5 py-3.5 text-center font-mono text-on-surface">
                              {p.Ano_Orcamento ? (
                                <span className="inline-flex items-center gap-1 bg-amber-500/15 border border-amber-500/25 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">
                                  {p.Ano_Orcamento} (RP)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-surface-container-highest text-on-surface-variant/80 px-2 py-0.5 rounded text-[10px]">
                                  {p.Data ? new Date(p.Data).getUTCFullYear() : '-'} (C)
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 font-mono font-bold text-on-surface">
                              {formatCurrency(p.Valor)}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold ${
                                p.Status === 'Pago'
                                  ? 'bg-teal-500/10 text-teal-300 border border-teal-500/25'
                                  : p.Status === 'Liquidado'
                                  ? 'bg-blue-400/10 text-blue-300 border border-blue-400/25 animate-pulse'
                                  : 'bg-amber-400/10 text-amber-300 border border-amber-400/25'
                              }`}>
                                {p.Status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => {
                                  if (currentUser.role === 'Visualizador') return;
                                  setDeleteConfirm({
                                    isOpen: true,
                                    type: 'pagamento',
                                    id: p.id,
                                    title: 'Remover Lançamento de Pagamento?',
                                    message: `Deseja realmente remover este lançamento de pagamento de ${formatCurrency(p.Valor)} vinculado ao documento SEI/NF ${p.Documento_SEI}? Esta ação é permanente.`
                                  });
                                }}
                                className="p-1 hover:text-rose-400 text-on-surface-variant/40 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'ordensServico' && selectedContract && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 border-b border-outline-variant pb-4">
                <div>
                  <h4 className="text-sm font-semibold text-on-surface">Ordens de Serviço (OS) & Recebimentos Integrados</h4>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 max-w-2xl font-sans">
                    Acompanhamento do ciclo de execução física e liquidação. Registre a OS, a Nota de Empenho do MGI, os Termos de Recebimento Provisório (TRP) e Definitivo (TRD) com Glosas, e a Descentralização Orçamentária do MPO para o MGI.
                  </p>
                </div>
                {activeOsId === null && (
                  <button
                    type="button"
                    disabled={currentUser.role === 'Visualizador'}
                    onClick={() => {
                      setActiveOsId('new');
                      setExtendedOsForm({
                        numeroOS: '',
                        dataEmissao: '',
                        valor: '',
                        prazoEntrega: '',
                        statusOS: 'Pendente',
                        observacao: '',
                        dataInicioPeriodo: '',
                        dataFimPeriodo: '',
                        numeroEmpenho: '',
                        seiEmpenho: '',
                        valorEmpenho: '',
                        empenhos: [],
                        trpElaborado: false,
                        trpAprovado: false,
                        trpNumeroDocumento: '',
                        trpSei: '',
                        trpData: '',
                        trpObservacao: '',
                        trdElaborado: false,
                        trdAprovado: false,
                        trdNumeroDocumento: '',
                        trdSei: '',
                        trdData: '',
                        trdGlosa: '',
                        trdObservacao: '',
                        descentralizacaoSei: '',
                        descentralizacaoValor: '',
                        descentralizacaoDescricao: '',
                        descentralizacoes: [{
                          id: `desc-${Date.now()}-1`,
                          processoSei: '',
                          valor: 0,
                          descricao: '',
                          data: new Date().toISOString().split('T')[0],
                          empenhosNumeros: []
                        }],
                        processoSeiPagamento: ''
                      });
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary text-xs rounded transition-all font-semibold hover:bg-primary/95 cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Lançar Nova OS
                  </button>
                )}
              </div>

              {activeOsId === null ? (
                /* ---------------------------------- LIST MODE ---------------------------------- */
                <div className="space-y-6">
                  {/* Table of OS */}
                  <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left text-xs font-sans border-collapse">
                        <thead>
                          <tr className="bg-surface-container-high border-b border-outline-variant text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">
                            <th 
                              onClick={() => handleOsSort('numeroOS')}
                              className="px-3 py-3 cursor-pointer hover:text-primary transition-colors select-none whitespace-nowrap"
                              title="Ordenar por Número da OS"
                            >
                              <div className="inline-flex items-center gap-1">
                                <span>Nº da OS / Status</span>
                                {osSortKey === 'numeroOS' && (
                                  osSortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                                )}
                              </div>
                            </th>
                            <th 
                              onClick={() => handleOsSort('vigenciaRef')}
                              className="px-3 py-3 cursor-pointer hover:text-primary transition-colors select-none whitespace-nowrap"
                              title="Ordenar por Vigência Ref. (Data Inicial do Período)"
                            >
                              <div className="inline-flex items-center gap-1">
                                <span className={osSortKey === 'vigenciaRef' ? 'text-primary font-extrabold' : ''}>Vigência Ref.</span>
                                {osSortKey === 'vigenciaRef' && (
                                  osSortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                                )}
                              </div>
                            </th>
                            <th 
                              onClick={() => handleOsSort('empenho')}
                              className="px-3 py-3 cursor-pointer hover:text-primary transition-colors select-none whitespace-nowrap"
                              title="Ordenar por Nota de Empenho"
                            >
                              <div className="inline-flex items-center gap-1">
                                <span>Nota de Empenho</span>
                                {osSortKey === 'empenho' && (
                                  osSortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                                )}
                              </div>
                            </th>
                            <th 
                              onClick={() => handleOsSort('statusRecebimento')}
                              className="px-3 py-3 cursor-pointer hover:text-primary transition-colors select-none whitespace-nowrap"
                              title="Ordenar por Status TRP/TRD"
                            >
                              <div className="inline-flex items-center gap-1">
                                <span>Recebimentos (TRP/TRD)</span>
                                {osSortKey === 'statusRecebimento' && (
                                  osSortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                                )}
                              </div>
                            </th>
                            <th 
                              onClick={() => handleOsSort('valorEmissao')}
                              className="px-3 py-3 text-right cursor-pointer hover:text-primary transition-colors select-none whitespace-nowrap"
                              title="Ordenar por Valor de Emissão"
                            >
                              <div className="inline-flex items-center justify-end gap-1 w-full">
                                <span>Valor Emissão</span>
                                {osSortKey === 'valorEmissao' && (
                                  osSortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                                )}
                              </div>
                            </th>
                            <th 
                              onClick={() => handleOsSort('glosa')}
                              className="px-3 py-3 text-right cursor-pointer hover:text-primary transition-colors select-none whitespace-nowrap"
                              title="Ordenar por Glosa"
                            >
                              <div className="inline-flex items-center justify-end gap-1 w-full">
                                <span>Glosa Aplicada</span>
                                {osSortKey === 'glosa' && (
                                  osSortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                                )}
                              </div>
                            </th>
                            <th 
                              onClick={() => handleOsSort('valorLiquido')}
                              className="px-3 py-3 text-right cursor-pointer hover:text-primary transition-colors select-none whitespace-nowrap"
                              title="Ordenar por Valor Líquido"
                            >
                              <div className="inline-flex items-center justify-end gap-1 w-full">
                                <span>Valor Líquido</span>
                                {osSortKey === 'valorLiquido' && (
                                  osSortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                                )}
                              </div>
                            </th>
                            <th 
                              onClick={() => handleOsSort('descentralizacao')}
                              className="px-3 py-3 text-right cursor-pointer hover:text-primary transition-colors select-none whitespace-nowrap"
                              title={selectedContract?.Modalidade_Contratacao === 'Pregão Colaboragov' ? "Ordenar por Descentralização (MPO ➔ MGI)" : "Descentralização (Inaplicável para contratos próprios da SOF)"}
                            >
                              <div className="inline-flex items-center justify-end gap-1 w-full">
                                <span>{selectedContract?.Modalidade_Contratacao === 'Pregão Colaboragov' ? 'Descentralização' : 'Descentralização (SOF)'}</span>
                                {osSortKey === 'descentralizacao' && (
                                  osSortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                                )}
                              </div>
                            </th>
                            <th className="px-3 py-3 text-center sticky right-0 bg-surface-container-high z-10 shadow-[-3px_0_6px_rgba(0,0,0,0.3)] whitespace-nowrap min-w-[90px]">
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/30 text-on-surface">
                          {(!sortedOrdensServico || sortedOrdensServico.length === 0) ? (
                            <tr>
                              <td colSpan={9} className="px-4 py-12 text-center text-on-surface-variant italic font-sans text-xs">
                                Nenhuma Ordem de Serviço (OS) ou medição cadastrada para este contrato.
                              </td>
                            </tr>
                          ) : (
                            sortedOrdensServico.map((os) => {
                              const valEmissao = os.valor || 0;
                              const valGlosa = os.trdGlosa || 0;
                              const valLiquido = Math.max(0, valEmissao - valGlosa);
                              const valDescent = os.descentralizacaoValor || 0;

                              return (
                                <tr key={os.id} className="hover:bg-surface-container-high/40 transition-colors group">
                                  <td className="px-3 py-3">
                                    <div className="flex items-center gap-1">
                                      <span className="font-mono font-bold text-primary">{os.numeroOS}</span>
                                      <CopyButton text={os.numeroOS} label="Número da OS" />
                                    </div>
                                    <div className="mt-1">
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                        os.statusOS === 'Pago' || os.statusOS === 'Executada'
                                          ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20'
                                          : os.statusOS === 'Liquidado'
                                          ? 'bg-teal-400/10 text-teal-300 border-teal-400/20'
                                          : os.statusOS === 'Empenhado' || os.statusOS === 'Em Execução'
                                          ? 'bg-blue-400/10 text-blue-300 border-blue-400/20'
                                          : os.statusOS === 'Cancelada'
                                          ? 'bg-rose-400/10 text-rose-300 border-rose-400/20'
                                          : 'bg-amber-400/10 text-amber-300 border-amber-400/20'
                                      }`}>
                                        {os.statusOS}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 whitespace-nowrap">
                                    <div className="font-mono text-on-surface-variant">
                                      {os.dataInicioPeriodo && os.dataFimPeriodo ? (
                                        <>
                                          {formatDate(os.dataInicioPeriodo)} ate<br/>
                                          {formatDate(os.dataFimPeriodo)}
                                        </>
                                      ) : (
                                        <span className="italic text-on-surface-variant/50">Não definido</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    {os.numeroEmpenho ? (
                                      <div className="font-sans">
                                        <div className="flex items-center gap-1 font-mono font-semibold text-on-surface">
                                          <span>{os.numeroEmpenho}</span>
                                          <CopyButton text={os.numeroEmpenho} label="Nota de Empenho" />
                                        </div>
                                        {os.seiEmpenho && (
                                          <div className="flex items-center gap-1 text-[9px] text-on-surface-variant font-mono">
                                            <span>SEI: {os.seiEmpenho}</span>
                                            <CopyButton text={os.seiEmpenho} label="SEI Empenho" />
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="italic text-on-surface-variant/40">-</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 space-y-1">
                                    {/* TRP Indicators */}
                                    <div className="flex items-center gap-1 text-[10px]">
                                      <span className={`font-bold px-1 rounded ${os.trpElaborado ? 'bg-indigo-400/10 text-indigo-300 border border-indigo-400/20' : 'bg-surface-container-high text-on-surface-variant'}`}>TRP</span>
                                      <span className="text-[9px]">
                                        {os.trpAprovado ? 'Aprovado' : os.trpElaborado ? 'Pendente Ateste' : 'Não iniciado'}
                                      </span>
                                    </div>
                                    {/* TRD Indicators */}
                                    <div className="flex items-center gap-1 text-[10px]">
                                      <span className={`font-bold px-1 rounded ${os.trdElaborado ? 'bg-teal-400/10 text-teal-300 border border-teal-400/20' : 'bg-surface-container-high text-on-surface-variant'}`}>TRD</span>
                                      <span className="text-[9px]">
                                        {os.trdAprovado ? 'Aprovado' : os.trdElaborado ? 'Pendente Ateste' : 'Não iniciado'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-right font-mono font-semibold text-on-surface whitespace-nowrap">
                                    {formatCurrency(valEmissao)}
                                  </td>
                                  <td className="px-3 py-3 text-right font-mono text-rose-300 whitespace-nowrap">
                                    {valGlosa > 0 ? `-${formatCurrency(valGlosa)}` : 'R$ 0,00'}
                                  </td>
                                  <td className="px-3 py-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                                    {formatCurrency(valLiquido)}
                                  </td>
                                  <td className="px-3 py-3 text-right whitespace-nowrap">
                                    {selectedContract?.Modalidade_Contratacao === 'Pregão Colaboragov' ? (
                                      valDescent > 0 ? (
                                        <div className="font-mono">
                                          <div className="font-semibold text-blue-300">{formatCurrency(valDescent)}</div>
                                          {os.descentralizacaoSei && <div className="text-[9px] text-on-surface-variant">SEI: {os.descentralizacaoSei}</div>}
                                        </div>
                                      ) : (
                                        <span className="italic text-on-surface-variant/40">-</span>
                                      )
                                    ) : (
                                      <span className="text-[10px] text-emerald-400/80 font-medium" title="Execução direta SOF: o próprio empenho formaliza a saída de recursos">
                                        N/A (SOF)
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-center sticky right-0 bg-surface-container-low group-hover:bg-surface-container transition-colors z-10 shadow-[-3px_0_6px_rgba(0,0,0,0.3)] whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveOsId(os.id);
                                          // Carrega descentralizações detalhadas ou converte formato legado
                                          let initialDescs: DescentralizacaoItem[] = [];
                                          if (os.descentralizacoes && os.descentralizacoes.length > 0) {
                                            initialDescs = os.descentralizacoes;
                                          } else if (os.descentralizacaoSei || os.descentralizacaoValor || os.descentralizacaoDescricao) {
                                            initialDescs = [{
                                              id: `desc-${Date.now()}-1`,
                                              processoSei: os.descentralizacaoSei || '',
                                              valor: os.descentralizacaoValor || 0,
                                              descricao: os.descentralizacaoDescricao || '',
                                              data: os.dataEmissao || '',
                                              empenhosNumeros: os.numeroEmpenho ? [os.numeroEmpenho] : []
                                            }];
                                          } else {
                                            initialDescs = [{
                                              id: `desc-${Date.now()}-1`,
                                              processoSei: '',
                                              valor: 0,
                                              descricao: '',
                                              data: '',
                                              empenhosNumeros: os.numeroEmpenho ? [os.numeroEmpenho] : []
                                            }];
                                          }

                                          // Carrega empenhos detalhados ou converte formato legado
                                          let initialEmps: NotaEmpenhoItem[] = [];
                                          if (os.empenhos && os.empenhos.length > 0) {
                                            initialEmps = os.empenhos;
                                          } else if (os.numeroEmpenho) {
                                            initialEmps = [{
                                              id: `ne-${Date.now()}-1`,
                                              numero: os.numeroEmpenho,
                                              sei: os.seiEmpenho || '',
                                              valor: os.valorEmpenho || 0
                                            }];
                                          }

                                          setExtendedOsForm({
                                            numeroOS: os.numeroOS || '',
                                            dataEmissao: os.dataEmissao || '',
                                            valor: os.valor ? String(os.valor) : '',
                                            prazoEntrega: os.prazoEntrega || '',
                                            statusOS: os.statusOS || 'Pendente',
                                            observacao: os.observacao || '',
                                            dataInicioPeriodo: os.dataInicioPeriodo || '',
                                            dataFimPeriodo: os.dataFimPeriodo || '',
                                            numeroEmpenho: os.numeroEmpenho || '',
                                            seiEmpenho: os.seiEmpenho || '',
                                            valorEmpenho: os.valorEmpenho ? String(os.valorEmpenho) : '',
                                            empenhos: initialEmps,
                                            trpElaborado: !!os.trpElaborado,
                                            trpAprovado: !!os.trpAprovado,
                                            trpNumeroDocumento: os.trpNumeroDocumento || '',
                                            trpSei: os.trpSei || '',
                                            trpData: os.trpData || '',
                                            trpObservacao: os.trpObservacao || '',
                                            trdElaborado: !!os.trdElaborado,
                                            trdAprovado: !!os.trdAprovado,
                                            trdNumeroDocumento: os.trdNumeroDocumento || '',
                                            trdSei: os.trdSei || '',
                                            trdData: os.trdData || '',
                                            trdGlosa: os.trdGlosa ? String(os.trdGlosa) : '',
                                            trdObservacao: os.trdObservacao || '',
                                            descentralizacaoSei: os.descentralizacaoSei || '',
                                            descentralizacaoValor: os.descentralizacaoValor ? String(os.descentralizacaoValor) : '',
                                            descentralizacaoDescricao: os.descentralizacaoDescricao || '',
                                            descentralizacoes: initialDescs,
                                            processoSeiPagamento: os.processoSeiPagamento || ''
                                          });
                                        }}
                                        className="p-1.5 text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 rounded cursor-pointer transition-colors shadow-sm"
                                        title="Editar OS"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (currentUser.role === 'Visualizador') return;
                                          if (confirm(`Tem certeza que deseja remover a OS e seus termos: ${os.numeroOS || ''}?`)) {
                                            const filtered = (selectedContract.ordensServico || []).filter(o => o.id !== os.id);
                                            onEditContrato({
                                              ...selectedContract,
                                              ordensServico: filtered
                                            });
                                          }
                                        }}
                                        disabled={currentUser.role === 'Visualizador'}
                                        className="p-1.5 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
                                        title="Excluir OS"
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
                  </div>

                  {/* Summary metric cubes */}
                  {selectedContract.ordensServico && selectedContract.ordensServico.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl flex flex-col">
                        <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Total de OS Emitido</span>
                        <strong className="mt-1 font-mono text-primary text-base">
                          {formatCurrency(selectedContract.ordensServico.reduce((sum, o) => sum + (o.valor || 0), 0))}
                        </strong>
                      </div>
                      <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl flex flex-col">
                        <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Glosas Totais Aplicadas</span>
                        <strong className="mt-1 font-mono text-rose-300 text-base">
                          {formatCurrency(selectedContract.ordensServico.reduce((sum, o) => sum + (o.trdGlosa || 0), 0))}
                        </strong>
                      </div>
                      <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl flex flex-col">
                        <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Valor Líquido Liquidado</span>
                        <strong className="mt-1 font-mono text-emerald-400 text-base">
                          {formatCurrency(selectedContract.ordensServico.reduce((sum, o) => {
                            if (o.statusOS === 'Cancelada') return sum;
                            const hasTermos = Boolean(o.trpElaborado && o.trpAprovado && o.trdElaborado && o.trdAprovado);
                            const isLiq = o.statusOS === 'Liquidado' || o.statusOS === 'Pago' || hasTermos;
                            if (!isLiq) return sum;
                            const diff = (o.valor || 0) - (o.trdGlosa || 0);
                            return sum + Math.max(0, diff);
                          }, 0))}
                        </strong>
                      </div>
                      {selectedContract?.Modalidade_Contratacao === 'Pregão Colaboragov' ? (
                        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl flex flex-col">
                          <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Total Descentrado (MPO ➜ MGI)</span>
                          <strong className="mt-1 font-mono text-sky-400 text-base">
                            {formatCurrency(selectedContract.ordensServico.reduce((sum, o) => {
                              const dVal = (o.descentralizacoes && o.descentralizacoes.length > 0)
                                ? o.descentralizacoes.reduce((s, d) => s + (d.valor || 0), 0)
                                : (o.descentralizacaoValor || 0);
                              return sum + dVal;
                            }, 0))}
                          </strong>
                        </div>
                      ) : (
                        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl flex flex-col justify-center">
                          <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Execução Orçamentária</span>
                          <span className="mt-1 text-xs font-semibold text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Direta pela SOF (Empenho Próprio)
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* ---------------------------------- EDIT / CREATE PANEL ---------------------------------- */
                <div className="space-y-6">
                  {/* Switchback Header */}
                  <div className="flex justify-between items-center bg-surface-container-low p-3 rounded-xl border border-outline-variant">
                    <button
                      type="button"
                      onClick={() => setActiveOsId(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-outline-variant rounded text-xs text-on-surface hover:bg-surface-container-high transition-colors font-semibold cursor-pointer shrink-0"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Voltar para Lista de OS
                    </button>
                    <span className="text-xs text-on-surface-variant font-mono font-bold">
                      {activeOsId === 'new' ? '✨ Nova OS / Medição' : `✏️ OS: ${extendedOsForm.numeroOS}`}
                    </span>
                  </div>

                  {/* Form fields grid nested in sections */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* CARD 1: Dados Principais da Ordem de Serviço */}
                    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 space-y-4">
                      <div className="flex items-center gap-2 border-b border-outline-variant pb-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <h5 className="text-xs font-bold uppercase text-on-surface tracking-wider">1. Dados da Ordem de Serviço (OS)</h5>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 font-sans">
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Nº da OS / Identificador <span className="text-rose-400">*</span></label>
                          <input
                            type="text"
                            placeholder="Ex: OS 12/2026"
                            value={extendedOsForm.numeroOS}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, numeroOS: e.target.value })}
                            className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Data de Emissão <span className="text-rose-400">*</span></label>
                          <input
                            type="date"
                            value={extendedOsForm.dataEmissao}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, dataEmissao: e.target.value })}
                            className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                          />
                        </div>

                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Mês/Data Início Período Ref.</label>
                          <input
                            type="date"
                            value={extendedOsForm.dataInicioPeriodo}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, dataInicioPeriodo: e.target.value })}
                            className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Mês/Data Fim Período Ref.</label>
                          <input
                            type="date"
                            value={extendedOsForm.dataFimPeriodo}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, dataFimPeriodo: e.target.value })}
                            className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                          />
                        </div>

                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Valor Contratado da OS (R$) <span className="text-rose-400">*</span></label>
                          <CurrencyInput
                            placeholder="0,00"
                            value={extendedOsForm.valor ? parseMonetaryValue(extendedOsForm.valor) : 0}
                            onChange={(val) => setExtendedOsForm({ ...extendedOsForm, valor: String(val) })}
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Prazo Real de Entrega</label>
                          <input
                            type="text"
                            placeholder="Ex: 30 dias / 2026-11-20"
                            value={extendedOsForm.prazoEntrega}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, prazoEntrega: e.target.value })}
                            className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-sans"
                          />
                        </div>

                        <div className="col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-semibold text-on-surface-variant uppercase">Status Geral de Execução</label>
                            {Boolean(extendedOsForm.trpElaborado && extendedOsForm.trpAprovado && extendedOsForm.trdElaborado && extendedOsForm.trdAprovado) && (
                              <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                                <CheckCircle2 className="w-3 h-3" /> Termos TRP/TRD 100% atestados
                              </span>
                            )}
                          </div>
                          <select
                            value={extendedOsForm.statusOS}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, statusOS: e.target.value as any })}
                            className="w-full bg-surface-container border border-outline-variant rounded px-2 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-sans"
                          >
                            <option value="Pendente">Pendente</option>
                            <option value="Em Execução">Em Execução</option>
                            <option value="Empenhado">Empenhado</option>
                            <option value="Liquidado">Liquidado</option>
                            <option value="Executada">Executada</option>
                            <option value="Pago">Pago</option>
                            <option value="Cancelada">Cancelada</option>
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Descrição / Objeto específico desta OS</label>
                          <textarea
                            placeholder="Descrever metas, equipes, escopo do período ou observações iniciais desta OS..."
                            value={extendedOsForm.observacao}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, observacao: e.target.value })}
                            rows={2}
                            className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary h-16 resize-none font-sans"
                          />
                        </div>
                      </div>
                    </div>

                    {/* CARD 2: Nota de Empenho vinculada */}
                    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 space-y-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 border-b border-outline-variant pb-2 mb-3">
                          <FileText className="w-4 h-4 text-indigo-400" />
                          <h5 className="text-xs font-bold uppercase text-on-surface tracking-wider">2. Nota de Empenho (NE)</h5>
                        </div>
                        <p className="text-[10px] text-on-surface-variant font-sans mb-4 leading-normal">
                          Geralmente emitida via recursos do Centro de Serviços Compartilhados do MGI para viabilizar as contratações do colaboragov.
                        </p>

                        <div className="space-y-3 font-sans">
                          <div>
                            <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Número do Empenho (NE)</label>
                            <input
                              type="text"
                              placeholder="Ex: 2026NE000142"
                              value={extendedOsForm.numeroEmpenho}
                              onChange={(e) => setExtendedOsForm({ ...extendedOsForm, numeroEmpenho: e.target.value })}
                              className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Número SEI do Documento de Empenho</label>
                            <input
                              type="text"
                              placeholder="Ex: 19975.000145/2026-33"
                              value={extendedOsForm.seiEmpenho}
                              onChange={(e) => setExtendedOsForm({ ...extendedOsForm, seiEmpenho: e.target.value })}
                              className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Valor Empenhado Vinculado (R$)</label>
                            <CurrencyInput
                              placeholder="0,00"
                              value={extendedOsForm.valorEmpenho ? parseMonetaryValue(extendedOsForm.valorEmpenho) : 0}
                              onChange={(val) => setExtendedOsForm({ ...extendedOsForm, valorEmpenho: String(val) })}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="text-[9px] bg-primary/5 text-primary/80 border border-primary/10 p-2.5 rounded-lg font-sans mt-3">
                        ℹ️ O valor empenhado garante o posterior ateste e liquidação orçamentação junto ao órgão centralizador de TIC.
                      </div>
                    </div>

                    {/* CARD 3: Termo de Recebimento Provisório (TRP) */}
                    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-indigo-400" />
                          <h5 className="text-xs font-bold uppercase text-on-surface tracking-wider">3. Termo de Recebimento Provisório (TRP)</h5>
                        </div>
                        <span className="p-0.5 px-2 bg-indigo-400/10 border border-indigo-400/20 rounded text-indigo-300 text-[10px] font-bold">TRP</span>
                      </div>

                      <div className="flex items-center gap-6 py-1">
                        <label className="flex items-center gap-2 text-xs font-medium text-on-surface select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={extendedOsForm.trpElaborado}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, trpElaborado: e.target.checked })}
                            className="w-4 h-4 accent-primary rounded border-outline-variant"
                          />
                          TRP Elaborado
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-on-surface select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={extendedOsForm.trpAprovado}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, trpAprovado: e.target.checked })}
                            className="w-4 h-4 accent-primary rounded border-outline-variant"
                          />
                          TRP Atestado / Homologado
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-4 font-sans">
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Identificador / Nº do TRP</label>
                          <input
                            type="text"
                            placeholder="Ex: TRP-044/2026"
                            value={extendedOsForm.trpNumeroDocumento}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, trpNumeroDocumento: e.target.value })}
                            className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Processo SEI do TRP</label>
                          <input
                            type="text"
                            placeholder="MPO nº do SEI"
                            value={extendedOsForm.trpSei}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, trpSei: e.target.value })}
                            className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Data de Emissão do TRP</label>
                          <input
                            type="date"
                            value={extendedOsForm.trpData}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, trpData: e.target.value })}
                            className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Observações, Pendências ou Ajustes do TRP</label>
                          <textarea
                            placeholder="Indicar se houve falhas de prazo, entregas parciais pendentes..."
                            value={extendedOsForm.trpObservacao}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, trpObservacao: e.target.value })}
                            rows={3}
                            className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary h-20 resize-none font-sans"
                          />
                        </div>
                      </div>
                    </div>

                    {/* CARD 4: Termo de Recebimento Definitivo (TRD) & Glosa */}
                    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-teal-400" />
                          <h5 className="text-xs font-bold uppercase text-on-surface tracking-wider">4. Termo de Recebimento Definitivo (TRD) & Glosa</h5>
                        </div>
                        <span className="p-0.5 px-2 bg-teal-400/10 border border-teal-400/20 rounded text-teal-300 text-[10px] font-bold">TRD</span>
                      </div>

                      <div className="flex items-center gap-6 py-1">
                        <label className="flex items-center gap-2 text-xs font-medium text-on-surface select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={extendedOsForm.trdElaborado}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, trdElaborado: e.target.checked })}
                            className="w-4 h-4 accent-primary rounded border-outline-variant"
                          />
                          TRD Elaborado
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-on-surface select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={extendedOsForm.trdAprovado}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, trdAprovado: e.target.checked })}
                            className="w-4 h-4 accent-primary rounded border-outline-variant"
                          />
                          TRD Atestado / Assinado
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-4 font-sans">
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Identificador / Nº do TRD</label>
                          <input
                            type="text"
                            placeholder="Ex: TRD-044/2026"
                            value={extendedOsForm.trdNumeroDocumento}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, trdNumeroDocumento: e.target.value })}
                            className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Processo SEI do TRD</label>
                          <input
                            type="text"
                            placeholder="MPO nº do SEI"
                            value={extendedOsForm.trdSei}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, trdSei: e.target.value })}
                            className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Data de Emissão do TRD</label>
                          <input
                            type="date"
                            value={extendedOsForm.trdData}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, trdData: e.target.value })}
                            className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[10px] font-bold text-rose-300 uppercase mb-1">Glosa Aplicável sobre OS (R$)</label>
                          <CurrencyInput
                            placeholder="0,00"
                            className="border-rose-400/20 text-rose-300 focus:border-rose-400"
                            value={extendedOsForm.trdGlosa ? parseMonetaryValue(extendedOsForm.trdGlosa) : 0}
                            onChange={(val) => setExtendedOsForm({ ...extendedOsForm, trdGlosa: String(val) })}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Observações Finais do TRD / Justificativa da Glosa</label>
                          <textarea
                            placeholder="Manifestação de conformidade plena para pagamento ou fundamentação descritiva da glosa aplicada..."
                            value={extendedOsForm.trdObservacao}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, trdObservacao: e.target.value })}
                            rows={3}
                            className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary h-20 resize-none font-sans"
                          />
                        </div>
                      </div>
                    </div>

                    {/* CARD 5: Descentralização Orçamentária (MPO -> MGI) */}
                    {selectedContract?.Modalidade_Contratacao === 'Pregão Colaboragov' ? (
                      <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 space-y-4 xl:col-span-2">
                        <DescentralizacaoManager
                          descentralizacoes={extendedOsForm.descentralizacoes || []}
                          onChange={(items) => setExtendedOsForm(prev => ({ ...prev, descentralizacoes: items }))}
                          availableEmpenhos={availableEmpenhosForContract}
                          onAddEmpenho={(newEmp) => {
                            setExtendedOsForm(prev => ({
                              ...prev,
                              empenhos: [...(prev.empenhos || []), {
                                id: `ne-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                                numero: newEmp.numero,
                                sei: newEmp.sei || '',
                                valor: newEmp.valor || 0
                              }],
                              numeroEmpenho: prev.numeroEmpenho || newEmp.numero,
                              seiEmpenho: prev.seiEmpenho || newEmp.sei || '',
                              valorEmpenho: prev.valorEmpenho || (newEmp.valor ? String(newEmp.valor) : '')
                            }));
                          }}
                          valorOS={parseFloat(extendedOsForm.valor) || 0}
                          readOnly={currentUser.role === 'Visualizador'}
                        />
                      </div>
                    ) : (
                      <div className="bg-surface-container-low/70 border border-outline-variant/50 rounded-xl p-5 space-y-3 xl:col-span-2">
                        <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-2">
                          <TrendingUp className="w-4 h-4 text-on-surface-variant" />
                          <h5 className="text-xs font-bold uppercase text-on-surface-variant tracking-wider">
                            5. Descentralização Orçamentária (Inaplicável para esta modalidade)
                          </h5>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20 ml-auto font-mono">
                            {selectedContract?.Modalidade_Contratacao || 'Pregão SOF'}
                          </span>
                        </div>
                        <div className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg text-slate-300 text-xs flex items-start gap-2.5">
                          <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-white">Não é necessário realizar descentralização orçamentária neste caso.</strong>
                            <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">
                              Este contrato possui a forma de contratação <strong>"{selectedContract?.Modalidade_Contratacao || 'Pregão SOF'}"</strong> (realizado e gerenciado diretamente pela SOF). A emissão da Nota de Empenho pela própria SOF já caracteriza a reserva e saída direta de recursos do orçamento institucional. A descentralização orçamentária de créditos aplica-se exclusivamente a contratos do <strong>Pregão Colaboragov</strong> gerenciados por órgãos externos (como o MGI).
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CARD 6: Processo SEI do Pagamento (Desembolso Financeiro) */}
                    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 space-y-4 xl:col-span-2">
                      <div className="flex items-center gap-2 border-b border-outline-variant pb-2">
                        <Activity className="w-4 h-4 text-emerald-300" />
                        <h5 className="text-xs font-bold uppercase text-on-surface tracking-wider">6. Processamento do Pagamento (Desembolso Financeiro)</h5>
                      </div>
                      <p className="text-[10px] text-on-surface-variant font-sans leading-normal">
                        Muitos processos dividem cada pagamento em um processo SEI específico. Indique aqui o número do Processo SEI específico de pagamento associado à execução desta OS.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
                        <div>
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1 font-mono">Processo SEI de Pagamento</label>
                          <input
                            type="text"
                            placeholder="Ex: 10180.123456/2026-77"
                            value={extendedOsForm.processoSeiPagamento}
                            onChange={(e) => setExtendedOsForm({ ...extendedOsForm, processoSeiPagamento: e.target.value })}
                            className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono text-emerald-300"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SAVING CONTROLS */}
                  <div className="flex justify-end items-center gap-3 border-t border-outline-variant/30 pt-4 pb-2">
                    <button
                      type="button"
                      onClick={() => setActiveOsId(null)}
                      className="px-4 py-2 border border-outline-variant text-[11px] font-bold rounded cursor-pointer hover:bg-surface-container transition-colors font-sans uppercase shrink-0"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={currentUser.role === 'Visualizador'}
                      onClick={() => {
                        if (currentUser.role === 'Visualizador') return;
                        if (!extendedOsForm.numeroOS) {
                          alert('Por favor, informe o Número identificador da OS.');
                          return;
                        }
                        if (!extendedOsForm.dataEmissao) {
                          alert('Por favor, informe a Data de Emissão da OS.');
                          return;
                        }
                        const numVal = parseFloat(extendedOsForm.valor);
                        if (isNaN(numVal) || numVal < 0) {
                          alert('Por favor, insira um valor numérico de emissão maior ou igual a zero.');
                          return;
                        }

                        const targetContract = contratos.find(c => c.id === selectedContratoId) || selectedContract;
                        if (!targetContract) return;

                        // Descentralizações agregadas
                        const descList = extendedOsForm.descentralizacoes || [];
                        const totalDescVal = descList.reduce((s, d) => s + (d.valor || 0), 0);
                        const allDescSei = descList.map(d => d.processoSei).filter(Boolean).join(', ');
                        const allDescDescricao = descList.map(d => d.descricao).filter(Boolean).join('; ');

                        // Build updated object using user's explicit status selection
                        const updatedOS: OrdemServico = {
                          id: activeOsId === 'new' ? `os-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` : activeOsId!,
                          numeroOS: extendedOsForm.numeroOS.trim(),
                          dataEmissao: extendedOsForm.dataEmissao,
                          valor: numVal,
                          prazoEntrega: extendedOsForm.prazoEntrega?.trim() || undefined,
                          statusOS: extendedOsForm.statusOS || 'Pendente',
                          observacao: extendedOsForm.observacao?.trim() || undefined,
                          dataInicioPeriodo: extendedOsForm.dataInicioPeriodo || undefined,
                          dataFimPeriodo: extendedOsForm.dataFimPeriodo || undefined,
                          numeroEmpenho: extendedOsForm.numeroEmpenho?.trim() || undefined,
                          seiEmpenho: extendedOsForm.seiEmpenho?.trim() || undefined,
                          valorEmpenho: extendedOsForm.valorEmpenho ? parseFloat(extendedOsForm.valorEmpenho) : undefined,
                          empenhos: extendedOsForm.empenhos && extendedOsForm.empenhos.length > 0 ? extendedOsForm.empenhos : undefined,
                          trpElaborado: Boolean(extendedOsForm.trpElaborado),
                          trpAprovado: Boolean(extendedOsForm.trpAprovado),
                          trpNumeroDocumento: extendedOsForm.trpNumeroDocumento?.trim() || undefined,
                          trpSei: extendedOsForm.trpSei?.trim() || undefined,
                          trpData: extendedOsForm.trpData || undefined,
                          trpObservacao: extendedOsForm.trpObservacao?.trim() || undefined,
                          trdElaborado: Boolean(extendedOsForm.trdElaborado),
                          trdAprovado: Boolean(extendedOsForm.trdAprovado),
                          trdNumeroDocumento: extendedOsForm.trdNumeroDocumento?.trim() || undefined,
                          trdSei: extendedOsForm.trdSei?.trim() || undefined,
                          trdData: extendedOsForm.trdData || undefined,
                          trdGlosa: extendedOsForm.trdGlosa ? parseFloat(extendedOsForm.trdGlosa) : undefined,
                          trdObservacao: extendedOsForm.trdObservacao?.trim() || undefined,
                          descentralizacaoSei: allDescSei || undefined,
                          descentralizacaoValor: totalDescVal > 0 ? totalDescVal : undefined,
                          descentralizacaoDescricao: allDescDescricao || undefined,
                          descentralizacoes: descList.length > 0 ? descList : undefined,
                          processoSeiPagamento: extendedOsForm.processoSeiPagamento?.trim() || undefined
                        };

                        let list = [...(targetContract.ordensServico || [])];
                        if (activeOsId === 'new') {
                          list.push(updatedOS);
                        } else {
                          list = list.map(o => o.id === activeOsId ? updatedOS : o);
                        }
                        list = sortOrdensServico(list, 'asc');

                        onEditContrato({
                          ...targetContract,
                          ordensServico: list
                        });

                        setActiveOsId(null);
                        setRecebimentoSaveSuccess(true);
                        setTimeout(() => setRecebimentoSaveSuccess(false), 3000);
                      }}
                      className="px-5 py-2 bg-primary text-on-primary text-[11px] font-bold rounded cursor-pointer hover:bg-primary/95 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-sans uppercase shrink-0"
                    >
                      Salvar Dados da OS & Termos
                    </button>
                  </div>
                  {currentUser.role === 'Visualizador' && (
                    <p className="text-[10px] text-right text-rose-400 font-sans">Perfil Visualizador não possui permissões de escrita.</p>
                  )}
                </div>
              )}
            </div>
          )}
      </div>
    )}

      {/* Contract Creator Modal */}
      {isContractModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface-container border border-outline-variant w-full max-w-2xl max-h-full sm:max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="bg-surface-container-high px-6 py-4 border-b border-outline-variant flex justify-between items-center shrink-0">
              <span className="font-bold text-on-surface">{editingContratoId ? "Editar" : "Cadastrar Novo"} Contrato de TIC</span>
              <button onClick={() => setIsContractModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContract} className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Nº Contrato <span className="text-rose-400">*</span></label>
                  <input
                    type="text"
                    name="Num_Contrato"
                    required
                    placeholder="Ex: CT-044/2024"
                    value={contratoFormData.Num_Contrato}
                    onChange={handleContractFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Processo SEI Originador</label>
                  <input
                    type="text"
                    name="SEI_Processo"
                    placeholder="Ex: 23000.XXXXXX/YYYY-ZZ"
                    value={contratoFormData.SEI_Processo}
                    onChange={handleContractFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5 bg-surface-container-low border border-teal-500/25 rounded-md p-2.5">
                <label className="block text-xs font-bold text-teal-400 uppercase tracking-wide">DFD Originário (Formalização da Demanda)</label>
                <select
                  name="DFD_Vinculado"
                  value={contratoFormData.DFD_Vinculado || ''}
                  onChange={handleContractFormChange}
                  className="w-full bg-surface-container-high border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-sans block"
                >
                  <option value="">-- Nenhum DFD Vinculado --</option>
                  {dfds.map(d => (
                    <option key={d.id} value={d.id}>
                      DFD {d.Num_DFD}/{d.Ano_PCA} ({d.UASG}) - {d.Descricao_Objeto.length > 55 ? d.Descricao_Objeto.substring(0, 55) + '...' : d.Descricao_Objeto} [Est: R$ {d.Valor_Estimado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}]
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-on-surface-variant block mt-0.5">Vincule este contrato ao DFD original para alinhar e deduzir automaticamente os saldos do orçamento anualizado.</span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-on-surface-variant uppercase">Objeto Técnico Contratado <span className="text-rose-400">*</span></label>
                <textarea
                  name="Objeto"
                  required
                  rows={2}
                  placeholder="Ex: Serviços continuados de infraestrutura computacional de hosting..."
                  value={contratoFormData.Objeto}
                  onChange={handleContractFormChange}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-outline-variant/30">
                <div className="space-y-1.5 col-span-1">
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase">Início Vigência <span className="text-rose-400">*</span></label>
                  <input
                    type="date"
                    name="Vigencia_Inicio"
                    required
                    value={contratoFormData.Vigencia_Inicio}
                    onChange={handleContractFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2 py-1 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                <div className="space-y-1.5 col-span-1">
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase">Orçamento Estimado <span className="text-rose-400">*</span></label>
                  <input
                    type="date"
                    name="Data_Orcamento_Estimado"
                    required
                    value={contratoFormData.Data_Orcamento_Estimado ? contratoFormData.Data_Orcamento_Estimado.slice(0, 10) : ''}
                    onChange={handleContractFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2 py-1 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                <div className="space-y-1.5 col-span-1">
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase">Prazo Inicial (Meses)</label>
                  <input
                    type="number"
                    name="Vigencia_Inicial_Meses"
                    value={contratoFormData.Vigencia_Inicial_Meses}
                    onChange={handleContractFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2 py-1 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                <div className="space-y-1.5 col-span-1">
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase">Prorrogável (Meses)</label>
                  <input
                    type="number"
                    name="Tempo_Possivel_Prorrogacao_Meses"
                    value={contratoFormData.Tempo_Possivel_Prorrogacao_Meses}
                    onChange={handleContractFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2 py-1 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-outline-variant/30">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Forma de Contratação / Modalidade</label>
                  <select
                    name="Modalidade_Contratacao"
                    value={contratoFormData.Modalidade_Contratacao || 'Pregão SOF'}
                    onChange={handleContractFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-semibold text-primary"
                  >
                    <option value="Pregão SOF">Pregão SOF</option>
                    <option value="Pregão Colaboragov">Pregão Colaboragov</option>
                    <option value="Contratação Direta por Dispensa">Contratação Direta por Dispensa</option>
                    <option value="Contratação Direta por Inexigibilidade">Contratação Direta por Inexigibilidade</option>
                    <option value="Adesão à SRP">Adesão à SRP</option>
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-semibold text-on-surface-variant uppercase">Fornecedor / Empresa</label>
                    <button
                      type="button"
                      onClick={() => setIsAddingSupplierInline(true)}
                      className="text-primary hover:underline text-[11px] font-bold flex items-center gap-0.5"
                      title="Cadastrar fornecedor rapidamente sem sair da tela"
                    >
                      <Plus className="w-3.5 h-3.5 hover:scale-110 transition-transform" /> Cadastrar Novo
                    </button>
                  </div>
                  <select
                    name="Fornecedor"
                    value={contratoFormData.Fornecedor}
                    onChange={(e) => {
                      if (e.target.value === "__new_supplier__") {
                        setIsAddingSupplierInline(true);
                      } else {
                        handleContractFormChange(e);
                      }
                    }}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-semibold text-primary"
                  >
                    <option value="">-- Selecione a contratada --</option>
                    <option value="__new_supplier__" className="text-secondary font-bold text-xs bg-surface-container-high">+ Cadastrar Novo Fornecedor...</option>
                    {fornecedores.map(f => (
                      <option key={f.id} value={f.id}>{f.Nome_Fornecedor} - {f.CNPJ}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Valor Inicial (R$) <span className="text-rose-400">*</span></label>
                  <CurrencyInput
                    name="Valor_Contrato"
                    required
                    placeholder="0,00"
                    showPreview={true}
                    value={contratoFormData.Valor_Contrato}
                    onChange={(val) => setContratoFormData(prev => ({ ...prev, Valor_Contrato: val }))}
                  />
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Periodicidade PGTO</label>
                  <select
                    name="Periodicidade_Pagamento"
                    value={contratoFormData.Periodicidade_Pagamento || 'Mensal'}
                    onChange={handleContractFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-semibold text-primary"
                  >
                    <option value="Mensal">Mensal</option>
                    <option value="Anual">Anual</option>
                    <option value="Total">Total</option>
                  </select>
                </div>
              </div>

              {/* Parâmetros Orçamentários e de Reajuste */}
              <div className="border-t border-outline-variant/30 pt-4 space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-primary">Parâmetros Orçamentários & Reajuste</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5 col-span-3 sm:col-span-1">
                    <label className="block text-xs font-semibold text-on-surface-variant uppercase text-[10px]">Ação Orçamentária</label>
                    <input
                      type="text"
                      name="Acao_Orcamentaria"
                      placeholder="Ex: 8861"
                      value={contratoFormData.Acao_Orcamentaria || '8861'}
                      onChange={handleContractFormChange}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-3 sm:col-span-1">
                    <label className="block text-xs font-semibold text-on-surface-variant uppercase text-[10px]">Plano Orçamentário (PO)</label>
                    <input
                      type="text"
                      name="Plano_Orcamentario"
                      placeholder="Ex: 01"
                      value={contratoFormData.Plano_Orcamentario || '01'}
                      onChange={handleContractFormChange}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-3 sm:col-span-1">
                    <label className="block text-xs font-semibold text-on-surface-variant uppercase text-[10px]">GND</label>
                    <select
                      name="GND"
                      value={contratoFormData.GND || '3 - Custeio'}
                      onChange={handleContractFormChange}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-semibold text-primary"
                    >
                      <option value="3 - Custeio">3 - Custeio</option>
                      <option value="4 - Investimento">4 - Investimento</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-on-surface-variant uppercase text-[10px]">Mês de Reajuste/Repactuação</label>
                    <select
                      name="Mes_Reajuste"
                      value={contratoFormData.Mes_Reajuste || ''}
                      onChange={handleContractFormChange}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="">Sem Reajuste Previsto</option>
                      <option value="Janeiro">Janeiro</option>
                      <option value="Fevereiro">Fevereiro</option>
                      <option value="Março">Março</option>
                      <option value="Abril">Abril</option>
                      <option value="Maio">Maio</option>
                      <option value="Junho">Junho</option>
                      <option value="Julho">Julho</option>
                      <option value="Agosto">Agosto</option>
                      <option value="Setembro">Setembro</option>
                      <option value="Outubro">Outubro</option>
                      <option value="Novembro">Novembro</option>
                      <option value="Dezembro">Dezembro</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-on-surface-variant uppercase text-[10px]">Índice de Reajuste / Motivo</label>
                    <select
                      name="Indice_Reajuste"
                      value={contratoFormData.Indice_Reajuste || 'ICTI'}
                      onChange={handleContractFormChange}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-semibold text-primary"
                    >
                      <option value="ICTI">ICTI (MPO)</option>
                      <option value="IPCA">IPCA</option>
                      <option value="IGP-M">IGP-M</option>
                      <option value="INPC">INPC</option>
                      <option value="Sem Reajuste">Sem Reajuste</option>
                      <option value="Repactuação Geral">Repactuação Geral</option>
                      <option value="Aumento de Demanda">Aumento de Demanda</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Equipe de Fiscalização e Gestão conforme requisitado */}
              <div className="border-t border-outline-variant/30 pt-4 space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-primary">Equipe de Gestão e Fiscalização do Contrato</h4>
                
                {/* 1. Gestores */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-on-surface-variant uppercase text-[10px]">Gestor Titular</label>
                    <input
                      type="text"
                      name="Gestor_Contrato"
                      placeholder="Nome do Gestor Titular"
                      value={contratoFormData.Gestor_Contrato}
                      onChange={handleContractFormChange}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1 text-xs text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-on-surface-variant uppercase text-[10px]">Gestor Substituto</label>
                    <input
                      type="text"
                      name="Gestor_Substituto"
                      placeholder="Nome do Gestor Substituto"
                      value={contratoFormData.Gestor_Substituto}
                      onChange={handleContractFormChange}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* 2. Fiscais Técnicos */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-on-surface-variant uppercase text-[10px]">Fiscal Técnico</label>
                    <input
                      type="text"
                      name="Fiscal_Tecnico"
                      placeholder="Nome do Fiscal Técnico Titular"
                      value={contratoFormData.Fiscal_Tecnico}
                      onChange={handleContractFormChange}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-on-surface-variant uppercase text-[10px]">Fiscal Técnico Substituto</label>
                    <input
                      type="text"
                      name="Fiscal_Tecnico_Substituto"
                      placeholder="Nome do Fiscal Técnico Substituto"
                      value={contratoFormData.Fiscal_Tecnico_Substituto || ''}
                      onChange={handleContractFormChange}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* 3. Fiscais Requisitantes */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-on-surface-variant uppercase text-[10px]">Fiscal Requisitante</label>
                    <input
                      type="text"
                      name="Fiscal_Requisitante"
                      placeholder="Nome do Fiscal Requisitante Titular"
                      value={contratoFormData.Fiscal_Requisitante || ''}
                      onChange={handleContractFormChange}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-on-surface-variant uppercase text-[10px]">Fiscal Requisitante Substituto</label>
                    <input
                      type="text"
                      name="Fiscal_Requisitante_Substituto"
                      placeholder="Nome do Fiscal Requisitante Substituto"
                      value={contratoFormData.Fiscal_Requisitante_Substituto || ''}
                      onChange={handleContractFormChange}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* 4. Fiscais Administrativos */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-on-surface-variant uppercase text-[10px]">Fiscal Administrativo</label>
                    <input
                      type="text"
                      name="Fiscal_Administrativo"
                      placeholder="Nome do Fiscal Administrativo Titular"
                      value={contratoFormData.Fiscal_Administrativo}
                      onChange={handleContractFormChange}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-on-surface-variant uppercase text-[10px]">Fiscal Administrativo Substituto</label>
                    <input
                      type="text"
                      name="Fiscal_Administrativo_Substituto"
                      placeholder="Nome do Fiscal Administrativo Substituto"
                      value={contratoFormData.Fiscal_Administrativo_Substituto || ''}
                      onChange={handleContractFormChange}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-outline-variant/30 pt-3">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Canal Preposto</label>
                  <input
                    type="text"
                    name="Preposto"
                    placeholder="Nome completo do preposto"
                    value={contratoFormData.Preposto}
                    onChange={handleContractFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase font-mono">E-mail do Preposto</label>
                  <input
                    type="email"
                    name="EmailPreposto"
                    placeholder="preposto@fornecedora.com"
                    value={contratoFormData.EmailPreposto}
                    onChange={handleContractFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Nº Portaria de Fiscalização</label>
                  <input
                    type="text"
                    name="Portaria_Fiscalizacao_Numero"
                    placeholder="Ex: Portaria SOF GECTI Nº 15/2024"
                    value={contratoFormData.Portaria_Fiscalizacao_Numero}
                    onChange={handleContractFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Doc SEI Portaria</label>
                  <input
                    type="text"
                    name="Portaria_Fiscalizacao_SEI"
                    placeholder="Ex: SEI-4882312"
                    value={contratoFormData.Portaria_Fiscalizacao_SEI}
                    onChange={handleContractFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              {/* PDF Document Upload Zone */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Enviar PDF Assinado do Contrato</label>
                
                <input
                  type="file"
                  ref={contractFileInputRef}
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      const file = e.target.files[0];
                      setContractAttachedFileName(file.name);
                      const reader = new FileReader();
                      reader.onload = (onloadEvent) => {
                        if (onloadEvent.target?.result) {
                          setContractAttachedFileData(onloadEvent.target.result as string);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const file = e.dataTransfer.files[0];
                      setContractAttachedFileName(file.name);
                      const reader = new FileReader();
                      reader.onload = (onloadEvent) => {
                        if (onloadEvent.target?.result) {
                          setContractAttachedFileData(onloadEvent.target.result as string);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  onClick={() => contractFileInputRef.current?.click()}
                  className="border border-dashed border-outline-variant rounded-lg p-5 flex flex-col items-center justify-center text-center bg-surface-container-low/40 hover:bg-surface-container-low/85 cursor-pointer transition-colors"
                >
                  <Upload className="w-5 h-5 text-on-surface-variant mb-1" />
                  <p className="text-[11px] text-on-surface font-semibold">Arraste ou clique para anexar o arquivo PDF do contrato real</p>
                  <p className="text-[9px] text-on-surface-variant/70">Arquivos válidos: .pdf (Limite de 15MB por anexo)</p>
                  {contractAttachedFileName && (
                    <div className="mt-2.5 flex items-center gap-2 max-w-full">
                      <div className="bg-primary/15 border border-primary/25 text-primary text-[10px] font-sans font-bold px-3 py-1 rounded-md flex items-center gap-1.5 animate-in fade-in truncate">
                        <FileText className="w-3.5 h-3.5 animate-pulse text-primary shrink-0" />
                        <span className="truncate max-w-[200px]">{contractAttachedFileName}</span>
                      </div>
                      
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContractAttachedFileName('');
                          setContractAttachedFileData('');
                          if (contractFileInputRef.current) {
                            contractFileInputRef.current.value = '';
                          }
                        }}
                        className="bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 p-1.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors text-[10px] font-bold shrink-0"
                        title="Excluir este anexo do contrato"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir Anexo</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant bg-surface-container-high/20 -mx-6 -mb-6 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setIsContractModalOpen(false)}
                  className="px-4 py-2 border border-outline-variant rounded text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={currentUser.role === 'Visualizador'}
                  className="px-5 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:opacity-90 shadow justify-center cursor-pointer disabled:opacity-50"
                >
                  Salvar Contrato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick/Inline Supplier registration modal */}
      {isAddingSupplierInline && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[65] animate-in fade-in duration-100">
          <div className="bg-surface-container border border-outline-variant w-full max-w-md rounded-xl overflow-hidden shadow-2xl flex flex-col p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-outline-variant/50 pb-3">
              <span className="font-bold text-sm text-on-surface">Cadastrar Novo Fornecedor</span>
              <button 
                type="button" 
                onClick={() => setIsAddingSupplierInline(false)} 
                className="text-on-surface-variant hover:text-on-surface transition-colors animate-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block font-semibold text-on-surface-variant uppercase text-[10px]">Nome Empresarial <span className="text-rose-400">*</span></label>
                <input
                  type="text"
                  placeholder="Ex: Microsoft do Brasil"
                  value={inlineFornName}
                  onChange={e => setInlineFornName(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-on-surface-variant uppercase text-[10px]">CNPJ <span className="text-rose-400">*</span></label>
                <input
                  type="text"
                  placeholder="Ex: 00.000.000/0001-00"
                  value={inlineFornCNPJ}
                  onChange={e => setInlineFornCNPJ(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-on-surface-variant uppercase text-[10px]">E-mail de Contato</label>
                <input
                  type="email"
                  placeholder="Ex: contato@empresa.com"
                  value={inlineFornEmail}
                  onChange={e => setInlineFornEmail(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-on-surface-variant uppercase text-[10px]">Telefone de Contato</label>
                <input
                  type="text"
                  placeholder="Ex: (61) 99999-9999"
                  value={inlineFornTelefone}
                  onChange={e => setInlineFornTelefone(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/30">
              <button
                type="button"
                onClick={() => setIsAddingSupplierInline(false)}
                className="px-3.5 py-1.5 border border-outline-variant rounded text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSupplierInline}
                className="px-4 py-1.5 bg-primary text-on-primary rounded text-xs font-semibold hover:brightness-110 transition-all shadow-sm"
              >
                Salvar Fornecedor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item SOF registration popup */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface-container border border-outline-variant w-full max-w-md max-h-full sm:max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-xl">
            <div className="bg-surface-container-high px-5 py-3 border-b border-outline-variant flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-on-surface">Adicionar Item de Despesa SOF</span>
              <button onClick={() => setIsItemModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddItemSOFLocal} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">ID Item / Número</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 01"
                    value={itemFormData.Numero_Item}
                    onChange={e => setItemFormData({ ...itemFormData, Numero_Item: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Lote ou Grupo</label>
                  <input
                    type="text"
                    required
                    value={itemFormData.Grupo_Lote}
                    onChange={e => setItemFormData({ ...itemFormData, Grupo_Lote: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Unidade de Medida</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Licença, Franquia mensal, etc."
                  value={itemFormData.Unidade_Medida}
                  onChange={e => setItemFormData({ ...itemFormData, Unidade_Medida: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Especificação do Item</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Insira detalhes técnicos..."
                  value={itemFormData.Descricao_Item}
                  onChange={e => setItemFormData({ ...itemFormData, Descricao_Item: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Quantidade</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={itemFormData.Quantidade}
                    onChange={e => setItemFormData({ ...itemFormData, Quantidade: parseInt(e.target.value) || 1 })}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Preço Unitário (R$)</label>
                  <CurrencyInput
                    required
                    placeholder="0,00"
                    value={itemFormData.Valor_Unitario}
                    onChange={(val) => setItemFormData({ ...itemFormData, Valor_Unitario: val })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Natureza de Despesa</label>
                <select
                  value={itemFormData.Natureza_Despesa || 'Custeio'}
                  onChange={e => setItemFormData({ ...itemFormData, Natureza_Despesa: e.target.value as any })}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="Custeio">Custeio (Despesas Correntes)</option>
                  <option value="Investimento">Investimento (Despesas de Capital)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-3 py-1.5 text-xs border border-outline-variant rounded text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={currentUser.role === 'Visualizador'}
                  className="px-4 py-1.5 text-xs bg-primary text-on-primary font-semibold rounded cursor-pointer hover:brightness-110"
                >
                  Gravar Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Occurrences registration popup */}
      {isOcorrenciaModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface-container border border-outline-variant w-full max-w-md max-h-full sm:max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-xl">
            <div className="bg-surface-container-high px-5 py-3 border-b border-outline-variant flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-on-surface">Lançar Ocorrência de Fiscalização</span>
              <button onClick={() => setIsOcorrenciaModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddOcorrencia} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Nº Documento SEI / Nota Técnica</label>
                <input
                  type="text"
                  placeholder="Ex: SEI-5991823"
                  value={ocorrenciaSEI}
                  onChange={e => setOcorrenciaSEI(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Data da Ocorrência <span className="text-primary">*</span></label>
                <input
                  type="date"
                  required
                  value={ocorrenciaData}
                  onChange={e => setOcorrenciaData(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-semibold text-primary font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Ocorrência Detalhada</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Defina o problema técnico, advertência de atraso ou trâmites de liberação de faturas..."
                  value={ocorrenciaDesc}
                  onChange={e => setOcorrenciaDesc(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOcorrenciaModalOpen(false)}
                  className="px-3 py-1.5 text-xs border border-outline-variant rounded text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={currentUser.role === 'Visualizador'}
                  className="px-4 py-1.5 text-xs bg-primary text-on-primary font-semibold rounded cursor-pointer hover:brightness-110"
                >
                  Lançar Ocorrência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alterations aditivos/apostilamentos popup */}
      {isAlteracaoModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface-container border border-outline-variant w-full max-w-md max-h-full sm:max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-xl animate-in fade-in duration-100">
            <div className="bg-surface-container-high px-5 py-3 border-b border-outline-variant flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-on-surface">Lançar Alteração de Contrato</span>
              <button onClick={() => setIsAlteracaoModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAlteracao} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Tipo de Alteração</label>
                <select
                  value={alteracaoTipo}
                  onChange={e => {
                    const type = e.target.value as 'Aditivo' | 'Apostilamento';
                    setAlteracaoTipo(type);
                    setAlteracaoPorcentagem(0);
                    setAlteracaoValor(0);
                    setAlteracaoMeses(0);
                  }}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-semibold text-primary"
                >
                  <option value="Aditivo">Termo Aditivo</option>
                  <option value="Apostilamento">Termo Apostilamento</option>
                </select>
              </div>

              {alteracaoTipo === 'Aditivo' ? (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Sub-tipo Aditivo</label>
                  <select
                    value={aditivoTipoSub}
                    onChange={e => setAditivoTipoSub(e.target.value as any)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none"
                  >
                    <option value="Prorrogação">Prorrogação de Cronograma (Meses)</option>
                    <option value="Acréscimo">Acréscimo de Valor Financeiro</option>
                    <option value="Supressão">Supressão de Valor Financeiro</option>
                    <option value="Reequilíbrio Econômico_Financeiro">Reequilíbrio Econômico Financeiro</option>
                  </select>
                </div>
              ) : (
                <p className="text-[10px] text-tertiary font-bold bg-tertiary-container/15 p-2 rounded">
                  Apostilamentos servem para reajustes monetários anuais automáticos baseados em índices oficiais (IPCA/ICTI), sem alterar as cláusulas básicas de vigência em aditivos.
                </p>
              )}

              {/* Custom Date and Processo SEI fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Data do Ajuste</label>
                  <input
                    type="date"
                    required
                    value={alteracaoData}
                    onChange={e => setAlteracaoData(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Processo SEI</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 00100.000123/2026-00"
                    value={alteracaoProcessoSEI}
                    onChange={e => setAlteracaoProcessoSEI(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface font-mono"
                  />
                </div>
              </div>

              {/* Dynamic input configurations */}
              {alteracaoTipo === 'Aditivo' && aditivoTipoSub === 'Prorrogação' ? (
                <div className="space-y-1.5 animate-in">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Adicionar Meses de Prorrogação (tempo)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={alteracaoMeses}
                    onChange={e => setAlteracaoMeses(parseInt(e.target.value) || 0)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface font-mono"
                  />
                  <span className="text-[9px] text-on-surface-variant block">O sistema validará se a prorrogação excede a tolerância máxima cadastrada.</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 animate-in">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Variação %</label>
                    <input
                      type="number"
                      step="0.01"
                      value={alteracaoPorcentagem}
                      onChange={e => {
                        const pct = parseFloat(e.target.value) || 0;
                        setAlteracaoPorcentagem(pct);
                        if (alteracaoTipo === 'Apostilamento' && selectedContract) {
                          const base = selectedContract.Valor_Atualizado;
                          const calculatedVal = parseFloat((base * (pct / 100)).toFixed(2));
                          setAlteracaoValor(calculatedVal);
                        }
                      }}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Valor Monetário R$</label>
                    <CurrencyInput
                      required
                      placeholder="0,00"
                      value={alteracaoValor}
                      disabled={alteracaoTipo === 'Apostilamento'}
                      onChange={(val) => {
                        if (alteracaoTipo !== 'Apostilamento') {
                          setAlteracaoValor(val);
                        }
                      }}
                    />
                  </div>
                  {alteracaoTipo === 'Apostilamento' && selectedContract && (
                    <div className="col-span-2">
                      <span className="text-[10px] text-tertiary block font-semibold leading-normal">
                        Calculado automaticamente: {alteracaoPorcentagem}% sobre o valor atualizado de {formatCurrency(selectedContract.Valor_Atualizado)}.
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Nº Termo / SEI Correspondente</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: SEI-4882193"
                  value={alteracaoSEI}
                  onChange={e => setAlteracaoSEI(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Justificativa / Observação do Aditamento</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Explique resumidamente a base regulatória ou causa técnica..."
                  value={alteracaoObs}
                  onChange={e => setAlteracaoObs(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAlteracaoModalOpen(false)}
                  className="px-3 py-1.5 text-xs border border-outline-variant rounded text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={currentUser.role === 'Visualizador'}
                  className="px-4 py-1.5 text-xs bg-primary text-on-primary font-semibold rounded cursor-pointer hover:brightness-110 disabled:opacity-50"
                >
                  Salvar Alteração
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Finance Lançar Pagamento modal */}
      {isPagamentoModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface-container border border-outline-variant w-full max-w-sm max-h-full sm:max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-xl animate-in shrink-0">
            <div className="bg-surface-container-high px-5 py-3 border-b border-outline-variant flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-on-surface font-sans">Lançar Ordem de Faturamento (Financeiro)</span>
              <button onClick={() => setIsPagamentoModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePagamento} className="p-5 space-y-4 overflow-y-auto flex-1">
              {selectedContract && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Vincular a uma OS / Nota de Empenho</label>
                  <select
                    value={pagamentoFormData.idOSVinculada || ''}
                    onChange={e => {
                      const osId = e.target.value;
                      const linkedOs = selectedContract.ordensServico?.find(o => o.id === osId);
                      if (linkedOs) {
                        // Dynamically pre-fill based on status selected
                        let computedVal = linkedOs.valor || 0;
                        if (pagamentoFormData.Status === 'Empenhado') {
                          computedVal = linkedOs.valorEmpenho || linkedOs.valor || 0;
                        } else {
                          // Handle Glosas
                          const valEmissao = linkedOs.valor || 0;
                          const valGlosa = linkedOs.trdGlosa || 0;
                          computedVal = Math.max(0, valEmissao - valGlosa);
                        }

                        // Formulate smart dynamic description
                        let generatedDesc = `Faturamento OS nº ${linkedOs.numeroOS}`;
                        if (linkedOs.dataInicioPeriodo && linkedOs.dataFimPeriodo) {
                          generatedDesc += ` ref ${formatDate(linkedOs.dataInicioPeriodo)} a ${formatDate(linkedOs.dataFimPeriodo)}`;
                        }

                        // Determine suggested Document SEI / NF number
                        let suggestedSei = '';
                        if (pagamentoFormData.Status === 'Empenhado') {
                          suggestedSei = linkedOs.seiEmpenho || '';
                        } else if (pagamentoFormData.Status === 'Liquidado') {
                          suggestedSei = linkedOs.trdSei || linkedOs.trpSei || '';
                        } else if (pagamentoFormData.Status === 'Pago') {
                          suggestedSei = linkedOs.processoSeiPagamento || '';
                        }

                        setPagamentoFormData({
                          ...pagamentoFormData,
                          idOSVinculada: osId,
                          Valor: computedVal,
                          Descricao: generatedDesc,
                          Documento_SEI: suggestedSei || pagamentoFormData.Documento_SEI || '',
                          processoSeiPagamento: linkedOs.processoSeiPagamento || '',
                        });
                      } else {
                        setPagamentoFormData({
                          ...pagamentoFormData,
                          idOSVinculada: '',
                        });
                      }
                    }}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none"
                  >
                    <option value="">-- Sem vínculo de OS (Lançamento Avulso) --</option>
                    {sortedOrdensServico.map(os => {
                      const vigenciaLabel = (os.dataInicioPeriodo && os.dataFimPeriodo) 
                        ? ` (Vigência: ${formatDate(os.dataInicioPeriodo)} - ${formatDate(os.dataFimPeriodo)})` 
                        : '';
                      const empenhoLabel = os.numeroEmpenho ? ` | Empenho: ${os.numeroEmpenho}` : '';
                      return (
                        <option key={os.id} value={os.id}>
                          {`OS nº ${os.numeroOS}${vigenciaLabel}: ${formatCurrency(os.valor)}${empenhoLabel}`}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Fase de Liquidação (Status)</label>
                <select
                  value={pagamentoFormData.Status}
                  onChange={e => {
                    const newStatus = e.target.value as any;
                    let nextVal = pagamentoFormData.Valor || 0;
                    let suggestSeiDoc = pagamentoFormData.Documento_SEI || '';
                    
                    if (pagamentoFormData.idOSVinculada) {
                      const linkedOs = selectedContract?.ordensServico?.find(o => o.id === pagamentoFormData.idOSVinculada);
                      if (linkedOs) {
                        if (newStatus === 'Empenhado') {
                          nextVal = linkedOs.valorEmpenho || linkedOs.valor || 0;
                          suggestSeiDoc = linkedOs.seiEmpenho || '';
                        } else {
                          const valEmissao = linkedOs.valor || 0;
                          const valGlosa = linkedOs.trdGlosa || 0;
                          nextVal = Math.max(0, valEmissao - valGlosa);
                          suggestSeiDoc = linkedOs.trdSei || linkedOs.trpSei || '';
                        }
                      }
                    }

                    setPagamentoFormData({
                      ...pagamentoFormData,
                      Status: newStatus,
                      Valor: nextVal,
                      Documento_SEI: suggestSeiDoc,
                    });
                  }}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none"
                >
                  <option value="Empenhado">1. Empenhado (Valor Reservado)</option>
                  <option value="Liquidado">2. Liquidado (Nota Faturada homologada)</option>
                  <option value="Pago">3. Pago (Liquidado e compensado)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Descrição de Lançamento</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Faturamento mensal ref Outubro/2026..."
                  value={pagamentoFormData.Descricao}
                  onChange={e => setPagamentoFormData({ ...pagamentoFormData, Descricao: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Data do Documento</label>
                  <input
                    type="date"
                    required
                    value={pagamentoFormData.Data}
                    onChange={e => setPagamentoFormData({ ...pagamentoFormData, Data: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Valor R$</label>
                  <CurrencyInput
                    required
                    placeholder="0,00"
                    showPreview={true}
                    value={pagamentoFormData.Valor}
                    onChange={(val) => setPagamentoFormData({ ...pagamentoFormData, Valor: val })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Processo SEI / Objeto NF</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: SEI-4881293 (Nota Fiscal 413)"
                  value={pagamentoFormData.Documento_SEI}
                  onChange={e => setPagamentoFormData({ ...pagamentoFormData, Documento_SEI: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Processo SEI Específico de Pagamento</label>
                <input
                  type="text"
                  placeholder="Ex: 10180.123456/2026-77 (opcional)"
                  value={pagamentoFormData.processoSeiPagamento || ''}
                  onChange={e => setPagamentoFormData({ ...pagamentoFormData, processoSeiPagamento: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface font-mono"
                />
                <p className="text-[9px] text-on-surface-variant/70 leading-normal font-sans">
                  Caso o pagamento deste lançamento possua um processo SEI de desembolso financeiro individualizado.
                </p>
              </div>

              {selectedContract && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Exercício Orçamentário / Restos a Pagar</label>
                  <select
                    value={pagamentoFormData.Ano_Orcamento || ''}
                    onChange={e => setPagamentoFormData({ ...pagamentoFormData, Ano_Orcamento: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none"
                  >
                    <option value="">Exercício Corrente ({pagamentoFormData.Data ? parseInt(pagamentoFormData.Data.split('-')[0]) : new Date().getFullYear()})</option>
                    {(() => {
                      const contractYear = parseInt(selectedContract.Vigencia_Inicio.split('-')[0]);
                      const paymentYearSelected = pagamentoFormData.Data ? parseInt(pagamentoFormData.Data.split('-')[0]) : new Date().getFullYear();
                      if (contractYear && contractYear !== paymentYearSelected) {
                        return (
                          <option value={contractYear}>Restos a Pagar - Assinatura do Contrato ({contractYear})</option>
                        );
                      }
                      return null;
                    })()}
                    <option value={(pagamentoFormData.Data ? parseInt(pagamentoFormData.Data.split('-')[0]) : new Date().getFullYear()) - 1}>
                      Restos a Pagar - Ano Anterior ({(pagamentoFormData.Data ? parseInt(pagamentoFormData.Data.split('-')[0]) : new Date().getFullYear()) - 1})
                    </option>
                  </select>
                  <p className="text-[9px] text-on-surface-variant/70 leading-normal">
                    Selecione "Restos a Pagar" para imputar este valor no ano de competência orçamentária do contrato, caso a liquidação financeira ocorra apenas no exercício posterior.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPagamentoModalOpen(false)}
                  className="px-3 py-1.5 text-xs border border-outline-variant rounded text-on-surface-variant hover:bg-surface-container-high"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={currentUser.role === 'Visualizador'}
                  className="px-4 py-1.5 text-xs bg-primary text-on-primary font-semibold rounded hover:brightness-110 disabled:opacity-50"
                >
                  Salvar Execução
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fornecedores management popup */}
      {isFornecedoresOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-surface-container border border-outline-variant w-full max-w-2xl max-h-full sm:max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-2xl">
            <div className="bg-surface-container-high px-6 py-4 border-b border-outline-variant flex justify-between items-center shrink-0">
              <span className="font-bold text-on-surface">Cadastro de Empresas e Fornecedores SOF</span>
              <button onClick={() => setIsFornecedoresOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto flex-1 min-h-0">
              {/* Form loader */}
              <div className="space-y-3 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Inserir ou Editar Empresa</span>
                  <div className="space-y-3 mt-3">
                    <input
                      type="text"
                      placeholder="Nome Empresarial (Ex: Microsoft)"
                      value={fornName}
                      onChange={e => setFornName(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1 text-xs text-on-surface"
                    />
                    <input
                      type="text"
                      placeholder="CNPJ (Ex: XX.XXX.XXX/0001-XX)"
                      value={fornCNPJ}
                      onChange={e => setFornCNPJ(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1 text-xs text-on-surface font-mono"
                    />
                    <input
                      type="email"
                      placeholder="E-mail corporativo licitações"
                      value={fornEmail}
                      onChange={e => setFornEmail(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1 text-xs text-on-surface font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Telefone principal"
                      value={fornTelefone}
                      onChange={e => setFornTelefone(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1 text-xs text-on-surface font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setFornFormId(null); setFornName(''); setFornCNPJ(''); setFornEmail(''); setFornTelefone(''); }}
                    className="flex-1 py-1 px-3 border border-outline-variant rounded text-xs text-on-surface-variant"
                  >
                    Novo
                  </button>
                  <button
                    onClick={handleSaveFornecedor}
                    disabled={currentUser.role === 'Visualizador'}
                    className="flex-1 py-1 px-3 bg-primary text-on-primary rounded text-xs font-semibold hover:brightness-110"
                  >
                    Salvar Empresa
                  </button>
                </div>
              </div>

              {/* Providers inventory list */}
              <div className="border border-outline-variant/40 rounded-xl overflow-y-auto p-3 space-y-2 bg-surface-container-lowest custom-scrollbar">
                {fornecedores.map(f => (
                  <div key={f.id} className="p-3 bg-surface-container-low/75 border border-outline-variant/30 rounded-lg text-xs space-y-1 relative group hover:border-primary/30">
                    <p className="font-bold text-on-surface">{f.Nome_Fornecedor}</p>
                    <p className="font-mono text-[10px] text-on-surface-variant">{f.CNPJ}</p>
                    <p className="text-[10px] text-on-surface-variant/80">{f.EmailContato} &bull; {f.TelefoneContato}</p>
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-surface-container-low/90 rounded px-1.5 py-0.5 shadow-sm border border-outline-variant/20">
                      <button
                        onClick={() => {
                          setFornFormId(f.id);
                          setFornName(f.Nome_Fornecedor);
                          setFornCNPJ(f.CNPJ);
                          setFornEmail(f.EmailContato);
                          setFornTelefone(f.TelefoneContato);
                        }}
                        className="p-1 hover:text-primary text-on-surface-variant transition-colors"
                        title="Editar Empresa"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteConfirm({
                            isOpen: true,
                            type: 'fornecedor',
                            id: f.id,
                            title: 'Excluir Fornecedor / Empresa',
                            message: `Tem certeza que deseja excluir o fornecedor "${f.Nome_Fornecedor}"? Essa ação apagará permanentemente o cadastro do fornecedor. Certifique-se de que nenhum contrato em andamento depende desta relação.`
                          });
                        }}
                        disabled={currentUser.role === 'Visualizador'}
                        className="p-1 hover:text-rose-500 text-on-surface-variant disabled:opacity-55 transition-colors"
                        title="Excluir Empresa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-3 border-t border-outline-variant bg-surface-container-high/20 shrink-0">
              <button
                onClick={() => setIsFornecedoresOpen(false)}
                className="px-4 py-1.5 text-xs bg-primary text-on-primary rounded font-semibold hover:brightness-110 cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Simulation of signed Contract PDF Document */}
      {viewingContractPdf && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-surface border border-outline w-full max-w-4xl h-[90vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col font-sans">
            
            {/* Modal Title Action Bar */}
            <div className="bg-surface-container px-4 sm:px-6 py-3 border-b border-outline flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center shrink-0">
              <div className="flex items-center gap-2 max-w-full">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-on-surface truncate">Visualizador de Documentos Oficiais SG-SEI! — Contratics</h3>
                  <p className="text-[10px] text-on-surface-variant font-mono truncate">{viewingContractPdf.LinkContratoNome || 'ContratoAnexo.pdf'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-outline-variant/20 pt-2.5 sm:pt-0 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const downloadUrl = pdfBlobUrl || viewingContractPdf.LinkContrato;
                    if (downloadUrl) {
                      const link = document.createElement('a');
                      link.href = downloadUrl;
                      const fileName = viewingContractPdf.LinkContratoNome || `Contrato_TIC_${viewingContractPdf.Num_Contrato.replace(/\//g, '_')}.pdf`;
                      const fileExt = fileName.toLowerCase().endsWith('.pdf') ? '' : '.pdf';
                      link.download = `${fileName}${fileExt}`;
                      link.click();
                    } else {
                      const content = `Contrato Assinado nº ${viewingContractPdf.Num_Contrato} - Objeto: ${viewingContractPdf.Objeto}`;
                      const blob = new Blob([content], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `Contrato_Assinado_TIC_${viewingContractPdf.Num_Contrato.replace(/\//g, '_')}.pdf`;
                      link.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  className="px-3 py-1.5 bg-surface-container border border-outline hover:bg-surface text-[11px] font-bold text-on-surface rounded flex items-center gap-1 cursor-pointer transition-all hover:scale-102 active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Contrato</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setViewingContractPdf(null)}
                  className="p-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs rounded transition-colors cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Fechar</span>
                </button>
              </div>
            </div>

            {/* Core Paper Workspace Frame */}
            <div className="flex-1 bg-neutral-800 p-4 md:p-6 overflow-hidden flex flex-col items-center justify-center">
              {viewingContractPdf.LinkContrato && (viewingContractPdf.LinkContrato.startsWith('data:') || viewingContractPdf.LinkContrato.startsWith('http') || viewingContractPdf.LinkContrato.startsWith('blob:')) ? (
                <div className="w-full h-full bg-surface-container rounded-lg shadow-inner overflow-hidden relative flex flex-col">
                  {/* Informative helper label */}
                  <div className="bg-surface-container-high px-4 py-2 border-b border-outline-variant text-[10px] text-on-surface-variant flex items-center justify-between shrink-0">
                    <span>💡 Se o PDF do contrato não carregar ou seu navegador bloquear frames locais, clique no botão <strong>"Baixar Contrato"</strong> para visualizá-lo.</span>
                  </div>
                  
                  <div className="flex-1 min-h-0 w-full animate-in fade-in">
                    {pdfBlobUrl ? (
                      <object
                        data={pdfBlobUrl}
                        type="application/pdf"
                        className="w-full h-full border-0 bg-white"
                      >
                        <iframe 
                          src={pdfBlobUrl} 
                          className="w-full h-full border-0 bg-white" 
                          title={`Contrato Oficial de TIC ${viewingContractPdf.Num_Contrato}`}
                        />
                      </object>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-on-surface">
                        <FileText className="w-10 h-10 text-on-surface-variant/40 animate-pulse mb-2" />
                        <span className="text-xs text-on-surface-variant">Gerando visualizador do PDF...</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="w-full h-full overflow-y-auto custom-scrollbar flex justify-center p-2">
                  {/* Vertical Paper Sheet (A4 size styled) */}
                  <div className="bg-white text-gray-950 w-full max-w-2xl min-h-[1100px] rounded shadow-xl p-12 md:p-16 flex flex-col justify-between font-serif border border-gray-200">
                    
                    <div>
                      {/* Executive Header */}
                      <div className="text-center space-y-1.5 border-b border-gray-300 pb-5 mb-6 text-[11px] font-sans">
                        <div className="w-10 h-10 bg-amber-400 border border-amber-600 rounded-full mx-auto flex items-center justify-center font-bold text-white shadow-inner text-xs mb-1">
                          BR
                        </div>
                        <strong className="text-xs uppercase tracking-wide text-gray-800 leading-none">
                          Poder Executivo Federal
                        </strong>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-655 leading-none">Ministério do Planejamento e Orçamento (MPO)</p>
                        <p className="text-[10px] text-gray-500 font-sans">Subsecretaria de Planejamento, Orçamento e Administração &bull; Coordenação de TIC</p>
                      </div>

                      {/* Title of Contract */}
                      <div className="text-center my-6">
                        <p className="text-[10px] uppercase tracking-widest text-primary font-sans font-extrabold leading-none">Termo de Contrato Administrativo</p>
                        <h1 className="text-base font-extrabold text-gray-900 tracking-tight mt-1 font-sans">
                          Contrato de TIC Nº {viewingContractPdf.Num_Contrato}
                        </h1>
                        <p className="text-[9px] text-gray-400 font-sans mt-0.5 font-mono">ID de Autenticidade: CON-{viewingContractPdf.id.toUpperCase()}</p>
                      </div>

                      {/* Operational Details Grid */}
                      <div className="my-5 border border-gray-300 rounded font-sans text-[10px] text-gray-700 divide-y divide-gray-200 overflow-hidden bg-gray-50/50">
                        <div className="grid grid-cols-4 divide-x divide-gray-200 p-2 text-gray-850">
                          <div className="font-bold text-left">Contratante:</div>
                          <div className="col-span-3 pl-2 text-left font-semibold">SOF — Secretaria de Orçamento Federal</div>
                        </div>
                        <div className="grid grid-cols-4 divide-x divide-gray-200 p-2 text-gray-850 bg-white">
                          <div className="font-bold text-left">Processo SEI:</div>
                          <div className="col-span-3 pl-2 text-left font-mono font-bold text-gray-905">{viewingContractPdf.SEI_Processo}</div>
                        </div>
                        <div className="grid grid-cols-4 divide-x divide-gray-200 p-2 text-gray-850">
                          <div className="font-bold text-left">Vigência Inicial:</div>
                          <div className="col-span-3 pl-2 text-left font-semibold">{formatDate(viewingContractPdf.Vigencia_Inicio)} a {formatDate(getVigenciaFinalInicial(viewingContractPdf.Vigencia_Inicio, viewingContractPdf.Vigencia_Inicial_Meses))} ({viewingContractPdf.Vigencia_Inicial_Meses} meses)</div>
                        </div>
                        <div className="grid grid-cols-4 divide-x divide-gray-200 p-2 text-gray-850 bg-white">
                          <div className="font-bold text-left">Valor Inicial:</div>
                          <div className="col-span-3 pl-2 text-left font-extrabold text-primary font-mono">{formatCurrency(viewingContractPdf.Valor_Contrato)}</div>
                        </div>
                        <div className="grid grid-cols-4 divide-x divide-gray-200 p-2 text-gray-850">
                          <div className="font-bold text-left">Gestor Titular:</div>
                          <div className="col-span-3 pl-2 text-left font-semibold">{viewingContractPdf.Gestor_Contrato}</div>
                        </div>
                        <div className="grid grid-cols-4 divide-x divide-gray-200 p-2 text-gray-850 bg-white">
                          <div className="font-bold text-left">Fiscal Técnico:</div>
                          <div className="col-span-3 pl-2 text-left font-semibold">{viewingContractPdf.Fiscal_Tecnico || "Não informado"}</div>
                        </div>
                        <div className="grid grid-cols-4 divide-x divide-gray-200 p-2 text-gray-850">
                          <div className="font-bold text-left">Portaria Fiscal:</div>
                          <div className="col-span-3 pl-2 text-left font-mono">{viewingContractPdf.Portaria_Fiscalizacao_Numero || "N/A"} ({viewingContractPdf.Portaria_Fiscalizacao_SEI || "N/A"})</div>
                        </div>
                      </div>

                      {/* Legal Term Clauses */}
                      <div className="space-y-4 text-xs text-gray-820 leading-relaxed text-left text-justify mt-6">
                        <p>
                          <strong>CLÁUSULA PRIMEIRA — DO OBJETO:</strong>
                          <br />
                          Constitui objeto do presente instrumento o fornecimento de solução de Tecnologia da Informação e Comunicação, especificamente: 
                          <strong className="block pl-3 border-l bg-gray-50 my-1 py-1 text-gray-905 font-sans text-left">
                            "{viewingContractPdf.Objeto}"
                          </strong>
                          conforme estipulado no Termo de Referência do edital e na proposta homologada da contratada.
                        </p>

                        <p>
                          <strong>CLÁUSULA SEGUNDA — DA VIGÊNCIA E REAJUSTE:</strong>
                          <br />
                          Este contrato tem vigência de <strong>{viewingContractPdf.Vigencia_Inicial_Meses} meses</strong> contados de seu início, podendo sofrer prorrogações sucessivas até o limite fiscal de {viewingContractPdf.Tempo_Possivel_Prorrogacao_Meses} meses por intermédio de termos aditivos de rito técnico legal.
                        </p>

                        <p>
                          <strong>CLÁUSULA TERCEIRA — DA FISCALIZAÇÃO DO INSTRUMENTO:</strong>
                          <br />
                          A execução contratual será fiscalizada em tempo real pela comissão designada na Portaria Administrativa ministerial nº {viewingContractPdf.Portaria_Fiscalizacao_Numero || "N/A"}, cabendo ao fiscal titular o ateste das notas e relatórios mensais para liberação de empenho orçamentário.
                        </p>
                      </div>
                    </div>

                    {/* Lower stamp sign columns */}
                    <div className="border-t border-gray-300 pt-6 mt-10 shrink-0 flex flex-col sm:flex-row justify-between items-center gap-4 text-[9px] font-sans text-gray-500">
                      <div className="space-y-0.5 text-left">
                        <strong className="uppercase text-gray-700">Subsecretaria de Orçamento Federal SOF</strong>
                        <p>Departamento de Administração de Contratos Públicos</p>
                        <p className="font-mono">Hash SEI-Assinatura: SEI-MPO-CONT-{viewingContractPdf.id.toUpperCase()}</p>
                      </div>
                      
                      {/* Digital seal mockup */}
                      <div className="border border-emerald-500 rounded p-1.5 px-3 bg-emerald-50 text-emerald-800 text-center space-y-0.5">
                        <strong className="font-bold block uppercase text-emerald-950 leading-none">SG-SEI! Assinado</strong>
                        <span className="font-medium text-[8px] leading-tight">Validação Ministério do Planejamento</span>
                        <span className="block font-mono text-[7px] leading-none text-emerald-600 font-semibold uppercase">INTEGRIDADE CERTIFICADA</span>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Dynamic Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-surface-container border border-outline-variant w-full max-w-md rounded-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="bg-rose-500/10 px-5 py-4 border-b border-rose-500/20 flex items-center gap-3">
              <AlertOctagon className="w-5 h-5 text-rose-500 shrink-0" />
              <span className="font-bold text-rose-500 font-sans text-sm">{deleteConfirm.title}</span>
            </div>
            
            <div className="p-5 space-y-4">
              <p className="text-xs text-on-surface leading-relaxed text-left font-sans">
                {deleteConfirm.message}
              </p>
              
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface-container-high border border-outline-variant hover:bg-surface-container-highest text-on-surface transition-all cursor-pointer font-sans"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDelete}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/10 active:scale-95 transition-all cursor-pointer font-sans flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
