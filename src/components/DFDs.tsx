/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { DFD, Planejamento, Contrato, StatusDFD, PeriodicidadePagamento, TermoAditivo, TermoApostilamento, Pagamento, ItemContratoSOF } from '../types';
import { formatCurrency, formatDate, isModifiedRecently, getVigenciaFinal, getFractionalMonths, parseMonetaryValue } from '../utils';
import { FileText, Plus, Search, Calendar, Landmark, CheckSquare, Layers, Download, X, AlertCircle, Trash2, Edit, ChevronLeft, ChevronRight, Shuffle, ChevronUp, ChevronDown, TrendingUp, Eye } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { CopyButton, CopyableText } from './CopyButton';
import { CurrencyInput } from './CurrencyInput';

interface DFDsProps {
  dfds: DFD[];
  planejamentos: Planejamento[];
  contratos: Contrato[];
  itensSOF?: ItemContratoSOF[];
  userRole: 'GECTI' | 'Fiscal' | 'Auditor' | 'Visualizador';
  currentLocalTime: string;
  aditivos?: TermoAditivo[];
  apostilamentos?: TermoApostilamento[];
  pagamentos?: Pagamento[];
  onAddDFD: (newDfd: DFD) => void;
  onEditDFD: (updatedDfd: DFD) => void;
  onDeleteDFD: (dfdId: string) => void;
  onToggleBudget: (dfdId: string) => void;
  onNavigateToPlanning: (seiProcesso: string) => void;
  onViewLineage?: (id: string, type: 'dfd' | 'planejamento' | 'contrato') => void;
}

export default function DFDs({
  dfds,
  planejamentos,
  contratos,
  itensSOF = [],
  userRole,
  currentLocalTime,
  aditivos = [],
  apostilamentos = [],
  pagamentos = [],
  onAddDFD,
  onEditDFD,
  onDeleteDFD,
  onToggleBudget,
  onNavigateToPlanning,
  onViewLineage,
}: DFDsProps) {
  const currentYear = new Date(currentLocalTime).getFullYear().toString();
  
  // Filters
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [selectedStatus, setSelectedStatus] = useState<StatusDFD[]>(['Não iniciado', 'Iniciado', 'Concluído']);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedDfdId, setExpandedDfdId] = useState<string | null>(null);

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
  }, [searchQuery, selectedStatus, selectedYear, sortKey, sortDirection]);

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Partial<DFD>>({
    Num_DFD: '',
    Ano_PCA: currentYear,
    Descricao_Objeto: '',
    Valor_Estimado: 0,
    Status_DFD: 'Não iniciado',
    UASG: '201130 (MPO/SOF)',
    Data_conclusao_estimada: '',
    Periodicidade_Pagamento: 'Mensal',
    Valor_Anual_Proporcional: 0,
    Contabilizar_Orcamento: true,
    Valor_Custeio: 0,
    Valor_Investimento: 0,
  });
  const [attachedFileName, setAttachedFileName] = useState('');
  const [attachedFileData, setAttachedFileData] = useState('');
  const [viewingPdfFilename, setViewingPdfFilename] = useState<string | null>(null);
  const [viewingPdfObj, setViewingPdfObj] = useState<DFD | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (viewingPdfObj?.Anexo_PDF) {
      const link = viewingPdfObj.Anexo_PDF;
      if (link.startsWith('data:')) {
        // Convert data URL to Blob URL to avoid CSP/iframe sandbox restriction issues in previews
        const mimeMatch = link.match(/^data:([^;]+);base64,/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
        try {
          const base64Data = link.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mime });
          const activeUrl = URL.createObjectURL(blob);
          setPdfBlobUrl(activeUrl);
          return () => {
            URL.revokeObjectURL(activeUrl);
            setPdfBlobUrl(null);
          };
        } catch (e) {
          setPdfBlobUrl(link);
        }
      } else {
        setPdfBlobUrl(link);
      }
    } else {
      setPdfBlobUrl(null);
    }
  }, [viewingPdfObj]);

  const [dfdToDelete, setDfdToDelete] = useState<DFD | null>(null);
  const [editingDfd, setEditingDfd] = useState<DFD | null>(null);

  // Year choices
  const years = ['Todos', '2023', '2024', '2025', '2026', '2027'];

  // Handle filter clearing rules
  const handleClearFilters = () => {
    setSelectedYear(currentYear);
    setSelectedStatus(['Não iniciado', 'Iniciado', 'Concluído']);
    setSearchQuery('');
  };

  // Status Filter Change
  const handleStatusCheck = (status: StatusDFD) => {
    if (selectedStatus.includes(status)) {
      setSelectedStatus(selectedStatus.filter(s => s !== status));
    } else {
      setSelectedStatus([...selectedStatus, status]);
    }
  };

  // Filtered lists
  const filteredDFDs = dfds.filter(dfd => {
    const matchesYear = selectedYear === 'Todos' || dfd.Ano_PCA === selectedYear;
    const matchesStatus = selectedStatus.includes(dfd.Status_DFD);
    const matchesSearch = searchQuery === '' || 
      dfd.Num_DFD.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dfd.Descricao_Objeto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dfd.UASG.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesYear && matchesStatus && matchesSearch;
  });

  const sortedDFDs = [...filteredDFDs].sort((a, b) => {
    if (!sortKey) return 0;
    let valA = a[sortKey as keyof DFD];
    let valB = b[sortKey as keyof DFD];

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

  const totalDFDs = filteredDFDs.length;
  const totalDFDPages = Math.ceil(totalDFDs / rowsPerPage);
  const paginatedDFDs = sortedDFDs.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const dfdPageNumbers = [];
  for (let i = 1; i <= totalDFDPages; i++) {
    dfdPageNumbers.push(i);
  }

  // Calculate dynamic counts
  const totalDFDsFilteredCount = filteredDFDs.length;

  /**
   * Complex Budget Calculation logic:
   * 1. Sum up Valor_Anual_Proporcional ONLY from DFDs with status 'Iniciado' or 'Não Iniciado',
   *    provided they are checked for budget calculations (Contabilizar_Orcamento === true)
   *    and their Year matches the filtered year.
   * 2. Incorporate active (not 'Encerrado') contracts matching the year:
   *    - Path A: Add the Contract's annual value (Valor_Anual_SOF)
   *    - Path B (Backup Rule): If a contract exists but Valor_Anual_SOF is 0/empty, we track
   *      and fetch the original estimated value of its linked DFD to avoid double-counting.
   */
  // Yearly dynamic contract calculations (annualized)
  const getContractValueForYear = (c: Contrato, year: number): number => {
    const startVal = new Date(c.Vigencia_Inicio);
    
    // Calculate total renewals capped at max possible contract duration
    const prorrogaMeses = (aditivos || [])
      .filter(ad => (ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
      .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
    const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(c.Numero_Renovacoes) || 0);
    const maxPossivelRenovacoesMeses = Math.max(0, (Number(c.Tempo_Possivel_Prorrogacao_Meses) || 60) - (Number(c.Vigencia_Inicial_Meses) || 12));
    const cappedRenovacaoMeses = Math.min(totalRenovacaoMeses, maxPossivelRenovacoesMeses);

    const endVal = new Date(c.Vigencia_Inicio);
    endVal.setUTCMonth(endVal.getUTCMonth() + (Number(c.Vigencia_Inicial_Meses) || 12) + cappedRenovacaoMeses);

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    if (startVal > yearEnd || endVal < yearStart) {
      return 0;
    }

    const hasBeenRenewed = totalRenovacaoMeses > 0;
    const calcStart = startVal > yearStart ? startVal : yearStart;
    const calcEnd = hasBeenRenewed ? yearEnd : (endVal < yearEnd ? endVal : yearEnd);

    const activeFractionalMonths = getFractionalMonths(calcStart, calcEnd);

    const contractAditivos = (aditivos || []).filter(ad => ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato);
    const contractApostilamentos = (apostilamentos || []).filter(ap => ap.Num_Contrato === c.id || ap.Num_Contrato === c.Num_Contrato);

    let adjustedVal = c.Valor_Contrato;
    contractAditivos.forEach(ad => {
      if (ad.Tipo_Aditivo === 'Acréscimo') adjustedVal += ad.Valor_Aditivado;
      if (ad.Tipo_Aditivo === 'Supressão') adjustedVal -= ad.Valor_Aditivado;
    });
    contractApostilamentos.forEach(ap => {
      adjustedVal += ap.Valor_do_Ajuste;
    });

    const prazoAtualMeses = (Number(c.Vigencia_Inicial_Meses) || 12) + cappedRenovacaoMeses;
    const periodicidade = c.Periodicidade_Pagamento || 'Mensal';

    if (periodicidade === 'Mensal') {
      const monthlyRate = adjustedVal / prazoAtualMeses;
      return monthlyRate * activeFractionalMonths;
    } else if (periodicidade === 'Anual') {
      const durationYears = prazoAtualMeses / 12;
      const annualValue = adjustedVal / durationYears;
      return annualValue * (activeFractionalMonths / 12);
    } else { // Total
      // Find a payment with status 'Pago' for this contract
      const contractPayments = (pagamentos || []).filter(p => (p.Num_Contrato === c.id || p.Num_Contrato === c.Num_Contrato) && p.Status === 'Pago');
      let paymentYear = startVal.getUTCFullYear(); // fallback to Vigencia_Inicio year
      if (contractPayments.length > 0) {
        const sortedPayments = [...contractPayments].sort((a, b) => new Date(a.Data).getTime() - new Date(b.Data).getTime());
        paymentYear = sortedPayments[0].Ano_Orcamento || new Date(sortedPayments[0].Data).getUTCFullYear();
      }
      
      if (year === paymentYear) {
        return adjustedVal;
      }
      return 0;
    }
  };

  const getDfdAnnualizedValueLocal = (dfd: DFD, year: number): number => {
    if (dfd.Contabilizar_Orcamento === false) return 0;
    
    const isContratacaoDireta = 
      dfd.Descricao_Objeto?.toLowerCase().includes('inexigibilidade') ||
      dfd.Descricao_Objeto?.toLowerCase().includes('dispensa') ||
      dfd.Descricao_Objeto?.toLowerCase().includes('direta');

    const isOneOff = isContratacaoDireta ||
                     dfd.Periodicidade_Pagamento === 'Total' ||
                     (dfd.Valor_Investimento && dfd.Valor_Investimento > 0 && (!dfd.Valor_Custeio || dfd.Valor_Custeio === 0)) ||
                     dfd.Descricao_Objeto?.toLowerCase().includes('aquisição') || 
                     dfd.Descricao_Objeto?.toLowerCase().includes('compra') ||
                     dfd.Descricao_Objeto?.toLowerCase().includes('inscrição') ||
                     dfd.Descricao_Objeto?.toLowerCase().includes('treinamento') ||
                     dfd.Descricao_Objeto?.toLowerCase().includes('capacitação') ||
                     dfd.Descricao_Objeto?.toLowerCase().includes('evento') ||
                     dfd.Descricao_Objeto?.toLowerCase().includes('conferência') ||
                     dfd.Descricao_Objeto?.toLowerCase().includes('kubecon');

    if (isOneOff) {
      return dfd.Valor_Estimado;
    }
    
    let conclDate: Date | null = null;
    const rawDate = dfd.Data_conclusao_estimada;
    if (rawDate) {
      const rdAny = rawDate as any;
      if (typeof rawDate === 'object' && rawDate !== null) {
        if ('toDate' in rdAny && typeof rdAny.toDate === 'function') {
          conclDate = rdAny.toDate();
        } else if (typeof rdAny.seconds === 'number') {
          conclDate = new Date(rdAny.seconds * 1000);
        } else if (rdAny instanceof Date) {
          conclDate = rdAny;
        }
      } else if (typeof rawDate === 'string' && rawDate.trim() !== '') {
        const stripped = rawDate.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(stripped)) {
          const [yr, mo, dy] = stripped.split('-').map(Number);
          conclDate = new Date(Date.UTC(yr, mo - 1, dy));
        } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(stripped)) {
          const [dy, mo, yr] = stripped.split('/').map(Number);
          conclDate = new Date(Date.UTC(yr, mo - 1, dy));
        } else {
          conclDate = new Date(rawDate);
        }
      }
    }

    if (!conclDate || isNaN(conclDate.getTime())) return dfd.Valor_Estimado;

    const conclYear = conclDate.getUTCFullYear();
    
    if (conclYear < year) {
      return dfd.Valor_Estimado;
    } else if (conclYear === year) {
      const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
      const activeMonths = getFractionalMonths(conclDate, yearEnd);
      return dfd.Valor_Estimado * (activeMonths / 12);
    } else {
      return 0;
    }
  };

  const calculateValorGeralAnualizado = () => {
    const targetYear = selectedYear === 'Todos' ? currentYear : selectedYear;
    const targetYearNum = parseInt(targetYear, 10) || 2026;

    const relevantDFDs = dfds.filter(d => {
      if (selectedYear !== 'Todos' && d.Ano_PCA !== targetYear) {
        return false;
      }
      const isCorrectStatus = d.Status_DFD === 'Iniciado' || d.Status_DFD === 'Não iniciado';
      if (!isCorrectStatus) return false;
      return d.Contabilizar_Orcamento !== false;
    });

    return relevantDFDs.reduce((sum, d) => sum + getDfdAnnualizedValueLocal(d, targetYearNum), 0);
  };

  const calculateValorGeralSimples = () => {
    const targetYear = selectedYear === 'Todos' ? currentYear : selectedYear;

    const relevantDFDs = dfds.filter(d => {
      if (selectedYear !== 'Todos' && d.Ano_PCA !== targetYear) {
        return false;
      }
      const isCorrectStatus = d.Status_DFD === 'Iniciado' || d.Status_DFD === 'Não iniciado';
      if (!isCorrectStatus) return false;
      return d.Contabilizar_Orcamento !== false;
    });

    return relevantDFDs.reduce((sum, d) => sum + (d.Valor_Estimado || 0), 0);
  };

  const calculateValorAnualGeral = () => {
    return calculateValorGeralAnualizado();
  };

  const exportDFDsToPDF = () => {
    const totalDFDsAnualValue = filteredDFDs.reduce((sum, d) => sum + (d.Valor_Anual_Proporcional || d.Valor_Estimado || 0), 0);

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
          <title>Relatório de DFDs - PCA</title>
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
            .status-iniciado {
              background-color: #e0f2fe;
              color: #0369a1;
            }
            .status-não-iniciado {
              background-color: #f1f5f9;
              color: #475569;
            }
            .status-concluido {
              background-color: #d1fae5;
              color: #065f46;
            }
            .budget-active {
              color: #10b981;
              font-weight: 600;
            }
            .budget-ignored {
              color: #94a3b8;
              text-decoration: line-through;
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
                  <h1 class="title">CONTRATICS - PCA (DFD)</h1>
                  <h2 class="subtitle">Relatório do Plano de Contratações Anual (Demandas de TIC)</h2>
                </div>
              </div>
              <div class="meta-info">
                <div><strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}</div>
                <div><strong>Ano de PCA:</strong> ${selectedYear === 'Todos' ? 'Todos os Anos' : selectedYear}</div>
                <div><strong>Filtros:</strong> Busca: "${searchQuery || 'Todos'}" | Status: ${selectedStatus.join(', ')}</div>
              </div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Demandas Filtradas</div>
              <div class="stat-value">${filteredDFDs.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Valor Geral Consolidado (${selectedYear === 'Todos' ? currentYear : selectedYear})</div>
              <div class="stat-value font-mono">R$ ${totalDFDsAnualValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Unidade Responsável</div>
              <div class="stat-value">SOF / MPO (TIC)</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 15%">Unidade / UASG</th>
                <th style="width: 12%">Nº DFD / Ano</th>
                <th style="width: 32%">Objeto de TIC</th>
                <th style="width: 15%" class="text-right">Valor Estimado (R$)</th>
                <th style="width: 15%" class="text-right">Valor Proporcional (R$)</th>
                <th style="width: 11%"><div style="text-align: center;">Status</div></th>
              </tr>
            </thead>
            <tbody>
              ${filteredDFDs.map(dfd => {
                const isBudgetActive = dfd.Contabilizar_Orcamento !== false;
                return `
                  <tr>
                    <td>
                      <div><strong>${dfd.UASG || 'Não especificado'}</strong></div>
                    </td>
                    <td class="font-mono">
                      <div style="font-weight: 700;">${dfd.Num_DFD}</div>
                      <div style="font-size: 10px; color: #64748b;">Ano PCA: ${dfd.Ano_PCA}</div>
                    </td>
                    <td>
                      <div style="font-weight: 500;">${dfd.Descricao_Objeto}</div>
                      ${dfd.Planejamento_Vinculado ? `<span style="font-size: 10px; color: #0284c7; font-weight: 500;">Proc. Vinculado: ${dfd.Planejamento_Vinculado}</span>` : ''}
                    </td>
                    <td class="font-mono text-right">
                      R$ ${(dfd.Valor_Estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td class="font-mono text-right">
                      <div class="${isBudgetActive ? 'budget-active' : 'budget-ignored'}" style="font-weight: 700;">
                        R$ ${(dfd.Valor_Anual_Proporcional || dfd.Valor_Estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <span style="font-size: 9px; color: #64748b;">${dfd.Periodicidade_Pagamento || 'Único'}</span>
                    </td>
                    <td>
                      <div style="display: flex; justify-content: center;">
                        <span class="status ${
                          dfd.Status_DFD === 'Concluído' ? 'status-concluido' : 
                          dfd.Status_DFD === 'Iniciado' ? 'status-iniciado' : 'status-não-iniciado'
                        }">${dfd.Status_DFD || 'Não iniciado'}</span>
                      </div>
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

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let computedValue: any = value;

    if (type === 'number') {
      computedValue = parseFloat(value) || 0;
    }

    setFormData(prev => {
      const updated = { ...prev, [name]: computedValue };
      // Auto-compute proportional annual value
      if (name === 'Valor_Estimado') {
        updated.Valor_Anual_Proporcional = computedValue;
      }
      return updated;
    });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setAttachedFileName(e.dataTransfer.files[0].name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole === 'Visualizador') {
      alert('Seu perfil de "Visualizador" não permite cadastrar ou alterar registros.');
      return;
    }

    if (!formData.Num_DFD || !formData.Descricao_Objeto || formData.Valor_Estimado === undefined || formData.Valor_Estimado === null || formData.Valor_Estimado === '' || isNaN(Number(formData.Valor_Estimado))) {
      alert('Por favor preencha todos os campos obrigatórios (Nº DFD, Objeto, Valor).');
      return;
    }

    if (editingDfd) {
      const updatedDfd: DFD = {
        ...editingDfd,
        Num_DFD: formData.Num_DFD!,
        Ano_PCA: formData.Ano_PCA!,
        Descricao_Objeto: formData.Descricao_Objeto!,
        Valor_Estimado: formData.Valor_Estimado!,
        Status_DFD: formData.Status_DFD as StatusDFD,
        UASG: formData.UASG!,
        Planejamento_Vinculado: formData.Planejamento_Vinculado || undefined,
        Data_conclusao_estimada: formData.Data_conclusao_estimada || new Date(currentLocalTime).toISOString(),
        Periodicidade_Pagamento: formData.Periodicidade_Pagamento as PeriodicidadePagamento,
        Valor_Anual_Proporcional: formData.Valor_Anual_Proporcional || formData.Valor_Estimado!,
        Contabilizar_Orcamento: formData.Contabilizar_Orcamento !== false,
        Anexo_PDF: attachedFileName ? (attachedFileData || editingDfd.Anexo_PDF || 'documento_anexo.pdf') : undefined,
        Anexo_PDF_Nome: attachedFileName || undefined,
        updatedAt: new Date(currentLocalTime).toISOString(),
        Valor_Custeio: formData.Valor_Custeio !== undefined ? formData.Valor_Custeio : formData.Valor_Estimado!,
        Valor_Investimento: formData.Valor_Investimento !== undefined ? formData.Valor_Investimento : 0,
      };
      onEditDFD(updatedDfd);
    } else {
      const newDfd: DFD = {
        id: `dfd-${Date.now()}`,
        Num_DFD: formData.Num_DFD!,
        Ano_PCA: formData.Ano_PCA!,
        Descricao_Objeto: formData.Descricao_Objeto!,
        Valor_Estimado: formData.Valor_Estimado!,
        Status_DFD: formData.Status_DFD as StatusDFD,
        UASG: formData.UASG!,
        Planejamento_Vinculado: formData.Planejamento_Vinculado || undefined,
        Data_conclusao_estimada: formData.Data_conclusao_estimada || new Date(currentLocalTime).toISOString(),
        Periodicidade_Pagamento: formData.Periodicidade_Pagamento as PeriodicidadePagamento,
        Valor_Anual_Proporcional: formData.Valor_Anual_Proporcional || formData.Valor_Estimado!,
        Contabilizar_Orcamento: formData.Contabilizar_Orcamento !== false,
        Anexo_PDF: attachedFileName ? (attachedFileData || 'documento_anexo.pdf') : undefined,
        Anexo_PDF_Nome: attachedFileName || undefined,
        updatedAt: new Date(currentLocalTime).toISOString(),
        Valor_Custeio: formData.Valor_Custeio !== undefined ? formData.Valor_Custeio : formData.Valor_Estimado!,
        Valor_Investimento: formData.Valor_Investimento !== undefined ? formData.Valor_Investimento : 0,
      };
      onAddDFD(newDfd);
    }

    setIsModalOpen(false);
    setEditingDfd(null);
    // Reset form
    setFormData({
      Num_DFD: '',
      Ano_PCA: currentYear,
      Descricao_Objeto: '',
      Valor_Estimado: 0,
      Status_DFD: 'Não iniciado',
      UASG: '201130 (MPO/SOF)',
      Data_conclusao_estimada: '',
      Periodicidade_Pagamento: 'Mensal',
      Valor_Anual_Proporcional: 0,
      Contabilizar_Orcamento: true,
      Valor_Custeio: 0,
      Valor_Investimento: 0,
    });
    setAttachedFileName('');
    setAttachedFileData('');
  };

  return (
    <div className="space-y-6" id="dfds-section" data-tour="dfd-header">
      {/* Top Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <nav className="flex items-center gap-2 text-on-surface-variant mb-1 text-xs uppercase tracking-wider">
            <span>Planejamento</span>
            <span>&gt;</span>
            <span className="text-primary font-medium">PCA (DFDs)</span>
          </nav>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">Plano de Contratações Anual (PCA)</h2>
          <p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            Requisitos de acordo com o Decreto nº 10.947/2022. Demandas cadastradas no PGC
          </p>
        </div>
        
        <div className="flex items-center gap-2.5" data-tour="dfd-actions">
          <button
            onClick={exportDFDsToPDF}
            className="flex items-center gap-2 px-3 py-2 border border-outline-variant/60 rounded-lg text-xs bg-surface-container hover:text-primary transition-all cursor-pointer font-semibold"
          >
            <Download className="w-4 h-4 text-primary" />
            Exportar PDF
          </button>
          <button
            onClick={() => {
              setEditingDfd(null);
              setFormData({
                Num_DFD: '',
                Ano_PCA: currentYear,
                Descricao_Objeto: '',
                Valor_Estimado: 0,
                Status_DFD: 'Não iniciado',
                UASG: '201130 (MPO/SOF)',
                Data_conclusao_estimada: '',
                Periodicidade_Pagamento: 'Mensal',
                Valor_Anual_Proporcional: 0,
                Contabilizar_Orcamento: true,
              });
              setAttachedFileName('');
              setAttachedFileData('');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 border border-primary/30 rounded-lg text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95 cursor-pointer font-medium"
          >
            <Plus className="w-4 h-4" />
            Cadastrar DFD
          </button>
        </div>
      </div>

      {/* Filters and Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Filters Panel */}
        <div className="lg:col-span-8 bg-surface-container-low border border-outline-variant rounded-xl p-5 flex flex-col md:flex-row items-stretch md:items-center gap-5">
          <div className="flex-1 space-y-2">
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Busca por Objeto/UASG</label>
            <div className="relative">
              <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar DFD..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant rounded-lg pl-9 pr-4 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="w-full md:w-32 space-y-2">
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Ano Exercício</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface outline-none focus:ring-1 focus:ring-primary"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 space-y-2">
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Status DFD</label>
            <div className="flex flex-wrap gap-4 items-center h-8">
              {(['Não iniciado', 'Iniciado', 'Concluído'] as StatusDFD[]).map(status => (
                <label key={status} className="flex items-center gap-2 cursor-pointer text-xs text-on-surface hover:text-primary transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedStatus.includes(status)}
                    onChange={() => handleStatusCheck(status)}
                    className="w-3.5 h-3.5 rounded border-outline-variant bg-transparent text-primary focus:ring-primary/20"
                  />
                  <span>{status}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleClearFilters}
              className="w-full md:w-auto px-4 py-1.5 text-xs text-primary hover:underline hover:bg-primary/5 rounded-lg transition-colors border border-transparent hover:border-primary/20"
            >
              Limpar Filtros
            </button>
          </div>
        </div>

        {/* Dashboard Indicators */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-4" data-tour="dfd-stats">
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Demandas Filtradas</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold text-on-surface font-mono">{totalDFDsFilteredCount}</span>
              <span className="text-[10px] text-on-surface-variant">de {dfds.length} total</span>
            </div>
          </div>

          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1">
              <Landmark className="w-3 h-3 text-teal-600 dark:text-teal-400 animate-pulse" />
              Soma DFDs Anualizada
            </span>
            <div className="mt-2 z-10">
              <span className="text-lg sm:text-xl font-bold text-teal-600 dark:text-teal-400 font-mono block truncate" title="Soma dos DFDs calculada com base na proporcionalidade do exercício corrente">
                {formatCurrency(calculateValorGeralAnualizado())}
              </span>
              <span className="text-[9px] text-on-surface-variant leading-none block mt-0.5">
                Ano {selectedYear === 'Todos' ? currentYear : selectedYear} (DFDs Ativos Anualizados)
              </span>
              
              <div className="mt-3 pt-2.5 border-t border-outline-variant/50">
                <span className="text-[9px] font-bold text-on-surface-variant uppercase block">Soma Bruta Simplificada:</span>
                <span className="text-sm font-bold text-on-surface font-mono block">
                  {formatCurrency(calculateValorGeralSimples())}
                </span>
                <span className="text-[8.5px] text-on-surface-variant/70 leading-tight block mt-0.5 italic">
                  Considera apenas o somatório simples dos valores estimados dos DFDs, sem realizar o cálculo proporcional à data de conclusão estimada do ano corrente.
                </span>
              </div>
            </div>
            <div className="absolute right-[-10px] bottom-[-15px] opacity-3 text-[64px] font-bold pointer-events-none group-hover:scale-105 transition-transform duration-300">
              $
            </div>
          </div>
        </div>
      </div>

      {/* Help message regarding double budgeting */}
      <div className="bg-surface-container/60 border border-outline-variant/30 rounded-xl px-4 py-2.5 text-xs text-on-surface-variant flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-primary shrink-0" />
        <span>
          <strong>Lógica de Cálculo dos Valores dos DFDs:</strong> A <em>Soma DFDs Anualizada</em> representa o cálculo de proporcionalidade de meses restantes no ano desde a Data de Conclusão Estimada até 31 de Dezembro (com exceção para parcelas marcadas com periodicidade de pagamento "Total" que mantêm 100% do seu valor). A <em>Soma Bruta Simplificada</em> traz o somatório simples acumulado sem considerar datas estimadas de início.
        </span>
      </div>

      {/* DFD Grid/List */}
      <div className="overflow-x-auto" data-tour="dfd-table">
        <table className="w-full min-w-[1000px] text-left border-separate border-spacing-y-2">
          <thead>
            <tr className="text-on-surface-variant">
              <th 
                className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none"
                onClick={() => handleSort('UASG')}
              >
                <div className="flex items-center gap-1">
                  <span>Unidade / UASG</span>
                  {sortKey === 'UASG' && (
                    sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                  )}
                </div>
              </th>
              <th 
                className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none"
                onClick={() => handleSort('Num_DFD')}
              >
                <div className="flex items-center gap-1">
                  <span>Nº DFD / Ano</span>
                  {sortKey === 'Num_DFD' && (
                    sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                  )}
                </div>
              </th>
              <th 
                className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none"
                onClick={() => handleSort('Descricao_Objeto')}
              >
                <div className="flex items-center gap-1">
                  <span>Objeto de TIC</span>
                  {sortKey === 'Descricao_Objeto' && (
                    sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                  )}
                </div>
              </th>
              <th 
                className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none"
                onClick={() => handleSort('Valor_Estimado')}
              >
                <div className="flex items-center gap-1">
                  <span>Valor Estimado</span>
                  {sortKey === 'Valor_Estimado' && (
                    sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                  )}
                </div>
              </th>
              <th 
                className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center cursor-pointer hover:text-primary transition-colors select-none"
                onClick={() => handleSort('Status_DFD')}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Status</span>
                  {sortKey === 'Status_DFD' && (
                    sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                  )}
                </div>
              </th>
              <th 
                className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center cursor-pointer hover:text-primary transition-colors select-none"
                onClick={() => handleSort('Contabilizar_Orcamento')}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Orçamento</span>
                  {sortKey === 'Contabilizar_Orcamento' && (
                    sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                  )}
                </div>
              </th>
              <th 
                className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center cursor-pointer hover:text-primary transition-colors select-none"
                onClick={() => handleSort('Planejamento_Vinculado')}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Planejamento SEI</span>
                  {sortKey === 'Planejamento_Vinculado' && (
                    sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                  )}
                </div>
              </th>
              <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-right select-none">Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginatedDFDs.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-xs text-on-surface-variant bg-surface-container-low/50 rounded-xl border border-outline-variant/30 font-medium italic">
                  Nenhum Documento de Formalização da Demanda (DFD) encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              paginatedDFDs.map((dfd, idx) => {
                const isRecent = isModifiedRecently(dfd.updatedAt, currentLocalTime);
                const cellBgClass = idx % 2 === 0
                  ? 'bg-surface-container-low/75 border-outline-variant/20'
                  : 'bg-surface-container/30 border-outline-variant/20';

                return (
                  <React.Fragment key={dfd.id}>
                    <tr className="group transition-all duration-150">
                      <td className={`px-5 py-4 text-xs font-mono text-on-surface-variant ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                        {dfd.UASG}
                      </td>
                      <td className={`px-5 py-4 ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                        <div className="flex items-center gap-1.5 font-mono">
                          {isRecent && (
                            <span className="bg-primary/20 text-primary border border-primary/30 text-[9px] font-bold px-1 py-0.25 rounded animate-pulse shrink-0">
                              NOVO
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setViewingPdfFilename(dfd.Anexo_PDF_Nome || 'Documento_DFD_Anexo.pdf');
                              setViewingPdfObj(dfd);
                            }}
                            className="font-semibold text-xs text-primary hover:underline focus:outline-none text-left cursor-pointer"
                            title="Clique para visualizar o PDF do DFD"
                          >
                            {dfd.Num_DFD}
                          </button>
                          <CopyButton text={dfd.Num_DFD} label="Número DFD" />
                          <span className="text-[10px] text-on-surface-variant">({dfd.Ano_PCA})</span>
                        </div>
                      </td>
                      <td className={`px-5 py-4 text-xs text-on-surface max-w-sm truncate ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`} title={dfd.Descricao_Objeto}>
                        <button
                          type="button"
                          onClick={() => {
                            setViewingPdfFilename(dfd.Anexo_PDF_Nome || 'Documento_DFD_Anexo.pdf');
                            setViewingPdfObj(dfd);
                          }}
                          className="hover:underline hover:text-primary focus:outline-none text-left truncate w-full cursor-pointer"
                          title="Clique para visualizar o PDF do DFD"
                        >
                          {dfd.Descricao_Objeto}
                        </button>
                      </td>
                      <td className={`px-5 py-4 text-xs font-semibold text-on-surface font-mono ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                        <div>{formatCurrency(dfd.Valor_Estimado)}</div>
                        <div className="text-[9px] text-on-surface-variant font-normal mt-0.5 space-x-1.5 flex items-center">
                          <span className="text-blue-500 font-medium">C: {formatCurrency(dfd.Valor_Custeio !== undefined ? dfd.Valor_Custeio : dfd.Valor_Estimado)}</span>
                          <span className="text-purple-500 font-bold">I: {formatCurrency(dfd.Valor_Investimento || 0)}</span>
                        </div>
                      </td>
                      <td className={`px-5 py-4 text-center ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium leading-none ${
                          dfd.Status_DFD === 'Concluído' 
                            ? 'bg-primary/25 border border-primary/40 text-primary' 
                            : dfd.Status_DFD === 'Iniciado'
                            ? 'bg-tertiary-container/30 border border-tertiary/30 text-tertiary font-semibold'
                            : 'bg-outline-variant/40 border border-outline-variant text-on-surface-variant'
                        }`}>
                          {dfd.Status_DFD}
                        </span>
                      </td>
                      <td className={`px-5 py-4 text-center ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                        <button
                          onClick={() => onToggleBudget(dfd.id)}
                          disabled={userRole === 'Visualizador'}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium leading-none ${
                            dfd.Contabilizar_Orcamento
                              ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-300 line-through'
                          } ${userRole !== 'Visualizador' ? 'hover:brightness-125 cursor-pointer' : 'opacity-85'}`}
                          title={dfd.Contabilizar_Orcamento ? "Incluído no Orçamento Anual. Clique para remover." : "Não contabilizado. Clique para incluir."}
                        >
                          {dfd.Contabilizar_Orcamento ? 'Ativo' : 'Não contabilizado'}
                        </button>
                      </td>
                      <td className={`px-5 py-4 text-xs text-center ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                        {dfd.Planejamento_Vinculado ? (
                          <div className="inline-flex items-center justify-center gap-1 mx-auto">
                            <button
                              onClick={() => onNavigateToPlanning(dfd.Planejamento_Vinculado!)}
                              className="text-primary font-medium hover:underline inline-flex items-center justify-center gap-1 cursor-pointer font-mono text-[11px]"
                            >
                              <FileText className="w-3 h-3 shrink-0 text-primary/70" />
                              {dfd.Planejamento_Vinculado}
                            </button>
                            <CopyButton text={dfd.Planejamento_Vinculado} label="Processo SEI" />
                          </div>
                        ) : (
                          <span className="text-on-surface-variant/60 font-mono text-[11px] font-bold block text-center">---</span>
                        )}
                      </td>
                      <td className={`px-5 py-4 text-right ${cellBgClass} group-hover:bg-primary/10 first:rounded-l-xl last:rounded-r-xl border-y first:border-l last:border-r`}>
                        <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-all">
                          <button
                            type="button"
                            onClick={() => setExpandedDfdId(expandedDfdId === dfd.id ? null : dfd.id)}
                            className={`p-1 px-1.5 inline-flex items-center gap-1 text-[10px] font-bold rounded cursor-pointer transition-all active:scale-95 shrink-0 border ${
                              expandedDfdId === dfd.id
                                ? 'bg-primary/20 border-primary text-primary'
                                : 'bg-surface-container-high border-outline-variant text-on-surface-variant hover:text-on-surface'
                            }`}
                            title="Exibir detalhamento de Custeio vs Investimento"
                          >
                            <Eye className="w-3 h-3 text-primary shrink-0" />
                            <span>Detalhes</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onViewLineage && onViewLineage(dfd.id, 'dfd')}
                            className="p-1 px-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/5 hover:bg-primary/15 border border-outline rounded cursor-pointer transition-all active:scale-95 shrink-0"
                            title="Rastreabilidade e Histórico do Processo"
                          >
                            <Shuffle className="w-3 h-3 text-primary animate-pulse" />
                            <span>Percurso</span>
                          </button>

                          {dfd.Anexo_PDF ? (
                            <button
                              type="button"
                              onClick={(e) => { 
                                e.preventDefault(); 
                                setViewingPdfFilename(dfd.Anexo_PDF_Nome || 'Documento_DFD_Anexo.pdf'); 
                                setViewingPdfObj(dfd);
                              }}
                              className="p-1 px-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded border border-primary/20 cursor-pointer active:scale-95 transition-all"
                              title={`Visualizar PDF: ${dfd.Anexo_PDF_Nome || 'Documento_DFD_Anexo.pdf'}`}
                            >
                              <FileText className="w-3 text-primary shrink-0" />
                              <span>Ver PDF</span>
                            </button>
                          ) : (
                            <span className="text-on-surface-variant/40 text-[11px] mr-2">—</span>
                          )}
                          
                          <button
                            type="button"
                            disabled={userRole === 'Visualizador' || userRole === 'Auditor'}
                            onClick={() => {
                              if (userRole === 'Visualizador' || userRole === 'Auditor') {
                                alert('Seu perfil não possui permissão para editar registros.');
                                return;
                              }
                              setEditingDfd(dfd);
                              setFormData({
                                Num_DFD: dfd.Num_DFD,
                                Ano_PCA: dfd.Ano_PCA,
                                Descricao_Objeto: dfd.Descricao_Objeto,
                                Valor_Estimado: dfd.Valor_Estimado,
                                Status_DFD: dfd.Status_DFD,
                                UASG: dfd.UASG,
                                Planejamento_Vinculado: dfd.Planejamento_Vinculado || '',
                                Data_conclusao_estimada: dfd.Data_conclusao_estimada ? dfd.Data_conclusao_estimada.split('T')[0] : '',
                                Periodicidade_Pagamento: dfd.Periodicidade_Pagamento || 'Mensal',
                                Valor_Anual_Proporcional: dfd.Valor_Anual_Proporcional || dfd.Valor_Estimado,
                                Contabilizar_Orcamento: dfd.Contabilizar_Orcamento !== false,
                                Valor_Custeio: dfd.Valor_Custeio !== undefined ? dfd.Valor_Custeio : dfd.Valor_Estimado,
                                Valor_Investimento: dfd.Valor_Investimento !== undefined ? dfd.Valor_Investimento : 0,
                              });
                              setAttachedFileName(dfd.Anexo_PDF_Nome || (dfd.Anexo_PDF && !dfd.Anexo_PDF.startsWith('data:') ? dfd.Anexo_PDF : ''));
                              setAttachedFileData(dfd.Anexo_PDF && dfd.Anexo_PDF.startsWith('data:') ? dfd.Anexo_PDF : '');
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 inline-flex items-center text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
                            title="Editar DFD"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={userRole === 'Visualizador' || userRole === 'Auditor'}
                            onClick={() => {
                              if (userRole === 'Visualizador' || userRole === 'Auditor') {
                                alert('Seu perfil não possui permissão para excluir registros.');
                                return;
                              }
                              setDfdToDelete(dfd);
                            }}
                            className="p-1.5 inline-flex items-center text-on-surface-variant hover:text-rose-450 hover:bg-rose-550/10 rounded transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
                            title="Excluir DFD"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedDfdId === dfd.id && (
                      <tr>
                        <td colSpan={8} className="px-5 py-4 bg-surface-container/20 border-x border-b border-outline-variant/20">
                          <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-primary" />
                                <h4 className="text-xs uppercase font-extrabold text-on-surface tracking-wider font-display">
                                  Segregação de Despesas: DFD {dfd.Num_DFD}
                                </h4>
                              </div>
                              <span className="text-[11px] text-on-surface-variant">
                                Valor Estimado: <strong className="text-primary font-mono">{formatCurrency(dfd.Valor_Estimado)}</strong>
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                              <div className="md:col-span-4 h-32 relative flex items-center justify-center bg-surface-container/30 rounded-xl border border-outline-variant/10 p-2">
                                {(() => {
                                  const custeio = dfd.Valor_Custeio !== undefined ? dfd.Valor_Custeio : dfd.Valor_Estimado;
                                  const investimento = dfd.Valor_Investimento || 0;
                                  const total = custeio + investimento;
                                  const custeioPercent = total > 0 ? ((custeio / total) * 100).toFixed(0) : '0';
                                  const investimentoPercent = total > 0 ? ((investimento / total) * 100).toFixed(0) : '0';

                                  return total === 0 ? (
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
                                  );
                                })()}
                              </div>

                              <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                {(() => {
                                  const custeio = dfd.Valor_Custeio !== undefined ? dfd.Valor_Custeio : dfd.Valor_Estimado;
                                  const investimento = dfd.Valor_Investimento || 0;
                                  const total = custeio + investimento;
                                  const custeioPercent = total > 0 ? ((custeio / total) * 100).toFixed(0) : '0';
                                  const investimentoPercent = total > 0 ? ((investimento / total) * 100).toFixed(0) : '0';

                                  return (
                                    <>
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
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* DFD Pagination Controls */}
      {totalDFDs > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-3 px-5 py-3.5 bg-surface-container-low/40 rounded-xl border border-outline-variant/30 font-sans select-none">
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
              {(currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, totalDFDs)} de {totalDFDs}
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

              {dfdPageNumbers.map(pageNum => (
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
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalDFDPages))}
                disabled={currentPage === totalDFDPages || totalDFDPages === 0}
                className="p-1 rounded-lg border border-outline-variant/50 bg-surface-container/30 text-on-surface hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Próxima Página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DFD Registration Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface-container border border-outline-variant w-full max-w-xl max-h-full sm:max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center bg-surface-container-high px-6 py-4 border-b border-outline-variant shrink-0">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-on-surface">{editingDfd ? "Editar" : "Novo"} Documento de Formalização da Demanda (DFD)</h3>
              </div>
              <button onClick={() => { setIsModalOpen(false); setEditingDfd(null); }} className="text-on-surface-variant hover:text-on-surface p-1 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Nº do DFD <span className="text-rose-400">*</span></label>
                  <input
                    type="text"
                    name="Num_DFD"
                    required
                    placeholder="Ex: DFD-050/2024"
                    value={formData.Num_DFD}
                    onChange={handleFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Ano do PCA <span className="text-rose-400">*</span></label>
                  <select
                    name="Ano_PCA"
                    value={formData.Ano_PCA}
                    onChange={handleFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="2023">2023</option>
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-on-surface-variant uppercase">Objeto / Descrição Detalhada <span className="text-rose-400">*</span></label>
                <textarea
                  name="Descricao_Objeto"
                  required
                  rows={2}
                  placeholder="Descreva a solução de TIC requerida..."
                  value={formData.Descricao_Objeto}
                  onChange={handleFormChange}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Valor Estimado (R$) <span className="text-rose-400">*</span></label>
                  <CurrencyInput
                    name="Valor_Estimado"
                    required
                    placeholder="0,00"
                    showPreview={true}
                    value={formData.Valor_Estimado}
                    onChange={(val) => setFormData(prev => ({ ...prev, Valor_Estimado: val }))}
                  />
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">UASG Geral</label>
                  <input
                    type="text"
                    name="UASG"
                    value={formData.UASG}
                    onChange={handleFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Valor Custeio (R$)</label>
                  <CurrencyInput
                    name="Valor_Custeio"
                    placeholder="Se deixar zerado, padrão total"
                    value={formData.Valor_Custeio}
                    onChange={(val) => setFormData(prev => ({ ...prev, Valor_Custeio: val }))}
                  />
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Valor Investimento (R$)</label>
                  <CurrencyInput
                    name="Valor_Investimento"
                    placeholder="0,00"
                    value={formData.Valor_Investimento}
                    onChange={(val) => setFormData(prev => ({ ...prev, Valor_Investimento: val }))}
                  />
                </div>
              </div>

              {formData.Valor_Estimado !== (Number(formData.Valor_Custeio || 0) + Number(formData.Valor_Investimento || 0)) && (
                <p className="text-[10px] text-amber-500 italic mt-1 font-medium">
                  Nota: A soma de Custeio e Investimento ({formatCurrency(Number(formData.Valor_Custeio || 0) + Number(formData.Valor_Investimento || 0))}) difere do Valor Estimado Global ({formatCurrency(formData.Valor_Estimado || 0)}). Se deixados zerados, 100% será considerado Custeio.
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Status do DFD</label>
                  <select
                    name="Status_DFD"
                    value={formData.Status_DFD}
                    onChange={handleFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="Não iniciado">Não iniciado</option>
                    <option value="Iniciado">Iniciado</option>
                    <option value="Concluído">Concluído</option>
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Periodicidade Pagamento</label>
                  <select
                    name="Periodicidade_Pagamento"
                    value={formData.Periodicidade_Pagamento}
                    onChange={handleFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="Mensal">Mensal</option>
                    <option value="Anual">Anual</option>
                    <option value="Total">Total (Único)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Data de Conclusão Estimada</label>
                  <input
                    type="date"
                    name="Data_conclusao_estimada"
                    value={formData.Data_conclusao_estimada}
                    onChange={handleFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase">Processo SEI Vinculado (Opcional)</label>
                  <select
                    name="Planejamento_Vinculado"
                    value={formData.Planejamento_Vinculado || ''}
                    onChange={handleFormChange}
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  >
                    <option value="">-- Selecione o Processo --</option>
                    {planejamentos.map(p => (
                      <option key={p.id} value={p.SEI_Processo}>{p.SEI_Processo} - {p.Objeto.substring(0, 30)}...</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Contabilizar checkbox */}
              <div className="bg-surface-container-high/40 border border-outline-variant/60 rounded p-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="Contabilizar_Orcamento"
                  name="Contabilizar_Orcamento"
                  checked={formData.Contabilizar_Orcamento}
                  onChange={handleCheckboxChange}
                  className="w-4 h-4 rounded border-outline-variant bg-transparent text-primary focus:ring-primary/20 mt-0.5"
                />
                <div className="space-y-0.5">
                  <label htmlFor="Contabilizar_Orcamento" className="block text-xs font-semibold text-on-surface cursor-pointer select-none">
                    Contabilizar no Orçamento Anual
                  </label>
                  <p className="text-[10px] text-on-surface-variant select-none">
                    Desmarque este item caso haja contingenciamento ou cortes fiscais para retirá-lo dos cálculos provisórios automáticos sem precisar excluir o DFD.
                  </p>
                </div>
              </div>

              {/* Drag-and-drop file upload */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-on-surface-variant uppercase text-[10px]">Anexar PDF do DFD (Ofício/Estudo)</label>
                
                {/* Hidden real file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      const file = e.target.files[0];
                      setAttachedFileName(file.name);
                      const reader = new FileReader();
                      reader.onload = (onloadEvent) => {
                        if (onloadEvent.target?.result) {
                          setAttachedFileData(onloadEvent.target.result as string);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />

                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const file = e.dataTransfer.files[0];
                      setAttachedFileName(file.name);
                      const reader = new FileReader();
                      reader.onload = (onloadEvent) => {
                        if (onloadEvent.target?.result) {
                          setAttachedFileData(onloadEvent.target.result as string);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="border border-dashed border-outline-variant rounded-lg p-5 flex flex-col items-center justify-center text-center bg-surface-container-low/40 hover:bg-surface-container-low/80 cursor-pointer transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Download className="w-6 h-6 text-on-surface-variant mb-1.5" />
                  <p className="text-xs text-on-surface font-medium">Arraste ou clique para anexar um documento PDF real</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">Formatos suportados: .pdf (Máx: 10MB)</p>
                  {attachedFileName && (
                    <div className="mt-3 flex flex-col items-center gap-2">
                      <div className="bg-primary/10 border border-primary/30 text-primary text-[10px] font-semibold px-2.5 py-1 rounded flex items-center gap-1.5 animate-in fade-in">
                        <FileText className="w-3.5 h-3.5 animate-pulse shrink-0" />
                        <span className="truncate max-w-[250px]">{attachedFileName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setAttachedFileName('');
                          setAttachedFileData('');
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="Remover anexo atual"
                      >
                        <X className="w-3 h-3" />
                        <span>Remover Anexo</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              </div>

              <div className="flex justify-end gap-3 px-6 py-4 bg-surface-container-high/20 border-t border-outline-variant shrink-0">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingDfd(null); }}
                  className="px-4 py-2 border border-outline-variant rounded text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={userRole === 'Visualizador'}
                  className="px-5 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:opacity-90 hover:scale-[1.01] transition-all active:scale-95 shadow cursor-pointer disabled:opacity-50"
                >
                  Salvar DFD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Real PDF viewer simulation workspace */}
      {viewingPdfFilename && viewingPdfObj && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-surface border border-outline w-full max-w-4xl h-[90vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col font-sans">
            
            {/* Action Bar */}
            <div className="bg-surface-container px-4 sm:px-6 py-3 border-b border-outline flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center shrink-0">
              <div className="flex items-center gap-2 max-w-full">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-on-surface truncate">Visualizador de Documentos Oficiais - Contratics</h3>
                  <p className="text-[10px] text-on-surface-variant font-mono truncate">{viewingPdfFilename}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-outline-variant/20 pt-2.5 sm:pt-0 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const downloadUrl = pdfBlobUrl || (viewingPdfObj.Anexo_PDF?.startsWith('data:') ? viewingPdfObj.Anexo_PDF : null);
                    if (downloadUrl) {
                      const link = document.createElement('a');
                      link.href = downloadUrl;
                      const fileName = viewingPdfObj.Anexo_PDF_Nome || `DFD_TIC_${viewingPdfObj.Num_DFD.replace(/\//g, '_')}.pdf`;
                      const fileExt = fileName.toLowerCase().endsWith('.pdf') ? '' : '.pdf';
                      link.download = fileName + fileExt;
                      link.click();
                    } else {
                      const content = `SG-SEI! Documento Assinado - DFD ${viewingPdfObj.Num_DFD}`;
                      const blob = new Blob([content], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = viewingPdfFilename;
                      link.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  className="px-3 py-1.5 bg-surface-container border border-outline hover:bg-surface text-[11px] font-bold text-on-surface rounded flex items-center gap-1 cursor-pointer transition-all hover:scale-102 active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Documento</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setViewingPdfFilename(null);
                    setViewingPdfObj(null);
                  }}
                  className="p-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs rounded transition-colors cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Fechar</span>
                </button>
              </div>
            </div>

            {/* Document Frame */}
            {viewingPdfObj.Anexo_PDF && (viewingPdfObj.Anexo_PDF.startsWith('data:') || viewingPdfObj.Anexo_PDF.startsWith('http') || viewingPdfObj.Anexo_PDF.startsWith('blob:')) ? (
              <div className="flex-1 bg-neutral-800 p-2 overflow-hidden flex flex-col relative">
                <div className="absolute top-2 right-2 z-10 bg-black/70 px-3 py-1 rounded text-[10px] text-white">
                  <span>💡 Se o PDF do DFD não carregar ou seu navegador bloquear frames locais, clique no botão <strong>"Baixar Documento"</strong> para visualizá-lo.</span>
                </div>
                {pdfBlobUrl ? (
                  <object
                    data={pdfBlobUrl}
                    type="application/pdf"
                    className="w-full h-full rounded border border-outline-variant"
                  >
                    <iframe 
                      src={pdfBlobUrl} 
                      className="w-full h-full border-0"
                      title={`Documento DFD Oficial ${viewingPdfObj.Num_DFD}`}
                    />
                  </object>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-xs text-on-surface-variant">Gerando visualizador do PDF...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 bg-neutral-800 p-6 md:p-8 overflow-y-auto custom-scrollbar flex justify-center">
                
                {/* Simulated Paper Sheets */}
                <div className="bg-white text-gray-900 w-full max-w-2xl min-h-[1050px] rounded shadow-xl p-12 md:p-16 flex flex-col justify-between font-serif relative border border-gray-200">
                  
                  {/* Official Crest Header Placeholders */}
                  <div>
                    <div className="text-center space-y-1.5 border-b border-gray-300 pb-6 mb-8 shrink-0">
                      <div className="w-12 h-12 bg-amber-400 border border-amber-600 rounded-full mx-auto flex items-center justify-center font-bold text-white shadow-inner font-sans text-xs">
                        BR
                      </div>
                      <h2 className="text-xs font-extrabold uppercase tracking-widest text-gray-855 font-sans leading-relaxed">
                        Ministério do Planejamento e Orçamento
                      </h2>
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-600 font-sans leading-none">
                        SOF — Secretaria de Orçamento Federal
                      </h3>
                      <p className="text-[9px] text-gray-500 font-sans">Esplanada dos Ministérios, Bloco K — Brasília, DF</p>
                    </div>

                    {/* Title */}
                    <div className="text-center space-y-1 my-6">
                      <strong className="text-[11px] uppercase tracking-wider font-sans text-primary">
                        Documento de Formalização da Demanda (DFD)
                      </strong>
                      <h1 className="text-base font-extrabold text-gray-900 tracking-tight font-sans">
                        DFD Nº {viewingPdfObj.Num_DFD}
                      </h1>
                      <span className="text-[10px] font-sans text-gray-500 font-mono">Ano do PCA de Alinhamento: {viewingPdfObj.Ano_PCA}</span>
                    </div>

                    {/* Metadata Table */}
                    <div className="my-6 border border-gray-300 rounded font-sans text-[10px] text-gray-700 divide-y divide-gray-200 overflow-hidden">
                      <div className="grid grid-cols-3 divide-x divide-gray-200 bg-gray-50 p-2 font-medium">
                        <div>UASG Demandante:</div>
                        <div className="col-span-2 text-gray-900 font-semibold">{viewingPdfObj.UASG}</div>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-gray-200 p-2">
                        <div>Localização Estimada:</div>
                        <div className="col-span-2 text-gray-900 font-semibold font-sans">SOF (TIC / GECTI)</div>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-gray-200 bg-gray-50 p-2">
                        <div>Periodicidade:</div>
                        <div className="col-span-2 text-gray-900 font-semibold font-sans">{viewingPdfObj.Periodicidade_Pagamento}</div>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-gray-200 p-2">
                        <div>Valor Global Estimado:</div>
                        <div className="col-span-2 text-gray-900 font-semibold font-mono text-primary">{formatCurrency(viewingPdfObj.Valor_Estimado)}</div>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-gray-200 bg-gray-50 p-2">
                        <div>Valor Custeio:</div>
                        <div className="col-span-2 text-gray-900 font-semibold font-mono text-blue-600">{formatCurrency(viewingPdfObj.Valor_Custeio !== undefined ? viewingPdfObj.Valor_Custeio : viewingPdfObj.Valor_Estimado)}</div>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-gray-200 p-2">
                        <div>Valor Investimento:</div>
                        <div className="col-span-2 text-gray-900 font-semibold font-mono text-purple-600">{formatCurrency(viewingPdfObj.Valor_Investimento || 0)}</div>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-gray-200 bg-gray-50 p-2">
                        <div>Valor Proporcional Anual:</div>
                        <div className="col-span-2 text-gray-950 font-semibold font-mono">{formatCurrency(viewingPdfObj.Valor_Anual_Proporcional)}</div>
                      </div>
                    </div>

                    {/* Body Clauses */}
                    <div className="space-y-6 text-xs text-gray-800 leading-relaxed text-justify mt-8">
                      <p>
                        <strong>1. Objeto da Contratação:</strong>
                        <br />
                        Fica formalizada a contratação de solução de Tecnologia da Informação descrita como: 
                        <span className="italic block pl-4 border-l-2 border-primary my-2 text-gray-900 font-sans font-medium">
                          "{viewingPdfObj.Descricao_Objeto}"
                        </span>
                        para o suprimento das necessidades da Secretaria de Orçamento Federal (SOF), de acordo com as especificações aprovadas.
                      </p>

                      <p>
                        <strong>2. Justificativa e Alinhamento Estratégico de TISOF:</strong>
                        <br />
                        A contratação acima consolidada visa o pleno atendimento dos processos de conformidade sob as diretrizes públicas dos sistemas governamentais. O presente estudo preliminar demonstra viabilidade técnica, econômica e administrativa com alocação no Plano de Contratação Anual de TIC.
                      </p>

                      <p>
                        <strong>3. Critério de Aceitabilidade e Execução Financeira:</strong>
                        <br />
                        O repasse financeiro seguirá o rito contábil do orçamento aprovado, apurado com periodicidade <strong>{viewingPdfObj.Periodicidade_Pagamento}</strong> de acordo com as entregas formais de faturamento validadas pelo Fiscal do Contrato.
                      </p>
                    </div>
                  </div>

                  {/* Footer Stamp Signature */}
                  <div className="border-t border-gray-200 pt-8 mt-12 shrink-0 flex flex-col sm:flex-row justify-between items-center gap-4 text-[9px] font-sans text-gray-500">
                    <div className="space-y-0.5 text-left">
                      <p className="font-bold uppercase text-gray-700">Documento de Validação de TIC</p>
                      <p>Ministério do Planejamento e Orçamento (MPO) / SOF</p>
                      <p className="font-mono">Chave de Autenticidade SEI-TIC: DFDSTAMP-{viewingPdfObj.id.toUpperCase()}</p>
                    </div>
                    
                    {/* Digital Signature Emblem */}
                    <div className="border-2 border-dashed border-emerald-500 rounded p-2 bg-emerald-50 text-emerald-800 text-center space-y-0.5 max-w-48">
                      <p className="font-extrabold uppercase tracking-wide leading-none text-emerald-950">SG-SEI! Assinado</p>
                      <p className="font-medium text-[8px] leading-tight">Validação Digital SOF / GECTI</p>
                      <p className="font-mono text-[7px] leading-none text-emerald-600 font-semibold uppercase">Status: CONFORME</p>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Exclusão Confirmation Modal */}
      {dfdToDelete && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-surface-container border border-outline-variant w-full max-w-md rounded-xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-bold text-on-surface font-sans">Confirmar Exclusão de DFD</h4>
            </div>
            
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Você está prestes a excluir definitivamente o Documento de Formalização da Demanda 
              <strong className="text-on-surface font-mono mx-1 font-semibold">{dfdToDelete.Num_DFD}</strong>.
              Todas as informações cadastradas para esta demanda no PCA da Secretaria de Orçamento Federal serão removidas permanentemente.
            </p>

            <div className="bg-surface-container-low border border-outline-variant/50 rounded-lg p-3 space-y-1 text-xs">
              <p className="text-on-surface font-medium truncate"><strong>Objeto:</strong> {dfdToDelete.Descricao_Objeto}</p>
              <p className="text-on-surface font-medium font-mono"><strong>Valor Estimado:</strong> {formatCurrency(dfdToDelete.Valor_Estimado)}</p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDfdToDelete(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-surface-container-high border border-outline-variant hover:bg-surface-container-highest text-on-surface transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteDFD(dfdToDelete.id);
                  setDfdToDelete(null);
                }}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-rose-500 hover:bg-rose-600 text-white shadow-lg active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 font-sans"
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
