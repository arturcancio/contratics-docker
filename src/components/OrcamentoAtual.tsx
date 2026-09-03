import React, { useState, useEffect } from 'react';
import { DFD, Contrato, Fornecedor, PeriodicidadePagamento, StatusDFD, ItemContratoSOF, ItemPlanejamentoSOF, SIOPData8861, SIOPHistory8861, User, Planejamento } from '../types';
import { CopyButton, CopyableText } from './CopyButton';
import { 
  formatCurrency, 
  formatDate, 
  getFractionalMonths,
  getVigenciaFinalInicial,
  getVigenciaFinal,
  getProrrogavelAte,
  getStatusContrato,
  parseMonetaryValue
} from '../utils';
import { CurrencyInput } from './CurrencyInput';
import { 
  Download, 
  FileText, 
  TrendingUp, 
  Layers, 
  Briefcase, 
  Handshake,
  DollarSign, 
  ChevronUp, 
  ChevronDown,
  Info,
  X,
  ArrowLeft,
  AlertTriangle,
  Shuffle,
  CheckCircle,
  Calendar,
  CalendarRange,
  UserCheck,
  History,
  PenSquare,
  Clock,
  FileSpreadsheet,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Check,
  RotateCcw,
  Pencil
} from 'lucide-react';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  deleteDoc, 
  getDocs, 
  db, 
  handleFirestoreError, 
  OperationType 
} from '../supabase';

// Helper to calculate the simulated end date of a contract when renewed ONE time
const getSimulatedContractEndDate = (c: Contrato, currentEndDate: Date): Date => {
  const initialMonths = Number(c.Vigencia_Inicial_Meses) || 12;
  let renewalStep = 12; // Default 12 months (de 12 em 12)
  if (initialMonths < 12) {
    renewalStep = initialMonths; // e.g. 6 months, 3 months
  } else if (initialMonths % 12 === 0) {
    renewalStep = 12; // Standard continuous contract with 12, 24, 36, etc. months initial
  } else {
    renewalStep = 12; // Fallback
  }

  const simulatedDate = new Date(currentEndDate);
  simulatedDate.setUTCMonth(simulatedDate.getUTCMonth() + renewalStep);

  const maxAllowed = Number(c.Tempo_Possivel_Prorrogacao_Meses) || 60;
  const ceilingDate = new Date(c.Vigencia_Inicio);
  ceilingDate.setUTCMonth(ceilingDate.getUTCMonth() + maxAllowed);

  if (simulatedDate > ceilingDate) {
    return ceilingDate;
  }
  return simulatedDate;
};

interface OrcamentoAtualProps {
  dfds: DFD[];
  contratos: Contrato[];
  fornecedores: Fornecedor[];
  aditivos: any[];
  apostilamentos: any[];
  pagamentos: any[];
  itensSOF: any[];
  itensPlanejamentoSOF?: ItemPlanejamentoSOF[];
  currentYear: number;
  selectedYear: string;
  onYearChange?: (year: string) => void;
  theme: 'light' | 'dark';
  currentLocalTime?: string;
  siopRecords?: SIOPData8861[];
  siopHistory?: SIOPHistory8861[];
  currentUser?: User;
  planejamentos?: Planejamento[];
}

export default function OrcamentoAtual({
  dfds,
  contratos,
  fornecedores,
  aditivos,
  apostilamentos,
  pagamentos,
  itensSOF,
  itensPlanejamentoSOF = [],
  currentYear,
  selectedYear,
  onYearChange,
  theme,
  currentLocalTime = new Date().toISOString(),
  siopRecords = [],
  siopHistory = [],
  currentUser,
  planejamentos = []
}: OrcamentoAtualProps) {
  const [dfdSortKey, setDfdSortKey] = useState<keyof DFD | 'valor_anualizado'>('Num_DFD');
  const [dfdSortDir, setDfdSortDir] = useState<'asc' | 'desc'>('asc');
  
  const [planSortKey, setPlanSortKey] = useState<string>('Num_DFD');
  const [planSortDir, setPlanSortDir] = useState<'asc' | 'desc'>('asc');
  
  const [contractSortKey, setContractSortKey] = useState<keyof Contrato | 'valor_anual_sof'>('Num_Contrato');
  const [contractSortDir, setContractSortDir] = useState<'asc' | 'desc'>('asc');

  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [viewingPdfFilename, setViewingPdfFilename] = useState<string | null>(null);
  const [viewingPdfObj, setViewingPdfObj] = useState<DFD | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // States for SIOP Manual Input and History snapshotting
  const [isEditSiopModalOpen, setIsEditSiopModalOpen] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [formDotacaoInicial, setFormDotacaoInicial] = useState('0');
  const [formDotacaoAtual, setFormDotacaoAtual] = useState('0');
  const [formEmpenhado, setFormEmpenhado] = useState('0');
  const [formLiquidado, setFormLiquidado] = useState('0');
  const [formPago, setFormPago] = useState('0');

  // Segregated States for Custeio (GND 3)
  const [formDotacaoInicialCusteio, setFormDotacaoInicialCusteio] = useState('0');
  const [formDotacaoAtualCusteio, setFormDotacaoAtualCusteio] = useState('0');
  const [formEmpenhadoCusteio, setFormEmpenhadoCusteio] = useState('0');
  const [formLiquidadoCusteio, setFormLiquidadoCusteio] = useState('0');
  const [formPagoCusteio, setFormPagoCusteio] = useState('0');

  // Segregated States for Investimento (GND 4)
  const [formDotacaoInicialInvestimento, setFormDotacaoInicialInvestimento] = useState('0');
  const [formDotacaoAtualInvestimento, setFormDotacaoAtualInvestimento] = useState('0');
  const [formEmpenhadoInvestimento, setFormEmpenhadoInvestimento] = useState('0');
  const [formLiquidadoInvestimento, setFormLiquidadoInvestimento] = useState('0');
  const [formPagoInvestimento, setFormPagoInvestimento] = useState('0');

  const [isSavingSiop, setIsSavingSiop] = useState(false);
  const [simulateRenewals, setSimulateRenewals] = useState<boolean>(false);

  // States for inline editing of DFD / Planejamento values directly in the budget
  const [editingDfdId, setEditingDfdId] = useState<string | null>(null);
  const [editingDfdValue, setEditingDfdValue] = useState<string>('');
  
  // States for importing DFDs from other years
  const [isImportDfdModalOpen, setIsImportDfdModalOpen] = useState(false);
  const [importDfdSearchTerm, setImportDfdSearchTerm] = useState('');
  const [importModalTab, setImportModalTab] = useState<'dfd' | 'planejamento'>('dfd');

  // States for adding custom budget items directly on this screen
  const [isAddCustomDfdModalOpen, setIsAddCustomDfdModalOpen] = useState(false);
  const [isAddCustomPlanModalOpen, setIsAddCustomPlanModalOpen] = useState(false);

  // Custom simulated base date per planning process (persisted in localStorage)
  const [simulatedPlanningDates, setSimulatedPlanningDates] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('contratics_simulated_planning_dates');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleUpdatePlanningSimDate = (planId: string, newDateStr: string) => {
    setSimulatedPlanningDates(prev => {
      const updated = { ...prev, [planId]: newDateStr };
      localStorage.setItem('contratics_simulated_planning_dates', JSON.stringify(updated));
      return updated;
    });
  };

  const handleResetPlanningSimDate = (planId: string) => {
    setSimulatedPlanningDates(prev => {
      const updated = { ...prev };
      delete updated[planId];
      localStorage.setItem('contratics_simulated_planning_dates', JSON.stringify(updated));
      return updated;
    });
  };

  // Form states for custom DFD
  const [customDfdNum, setCustomDfdNum] = useState('');
  const [customDfdObjeto, setCustomDfdObjeto] = useState('');
  const [customDfdPeriodicidade, setCustomDfdPeriodicidade] = useState<'Mensal' | 'Anual' | 'Total'>('Mensal');
  const [customDfdData, setCustomDfdData] = useState('');
  const [customDfdValor, setCustomDfdValor] = useState('');
  const [customDfdGND, setCustomDfdGND] = useState<'3 - Custeio' | '4 - Investimento'>('3 - Custeio');

  // Form states for custom Planejamento
  const [customPlanSei, setCustomPlanSei] = useState('');
  const [customPlanDfdNum, setCustomPlanDfdNum] = useState('');
  const [customPlanObjeto, setCustomPlanObjeto] = useState('');
  const [customPlanEstimativa, setCustomPlanEstimativa] = useState('');
  const [customPlanGND, setCustomPlanGND] = useState<'3 - Custeio' | '4 - Investimento'>('3 - Custeio');
  const [customPlanData, setCustomPlanData] = useState('');
  const [customPlanTipo, setCustomPlanTipo] = useState('Pregão SOF');

  // Helper to dynamically calculate planning cost based on active SOF planning items
  const getPlanningCusto = (p: Planejamento) => {
    const items = (itensPlanejamentoSOF || []).filter(i => i.Processo_SEI === p.SEI_Processo && i.Status_Item === 'Ativo');
    if (items.length > 0) {
      return items.reduce((acc, current) => acc + (current.Quantidade * current.Valor_Unitario), 0);
    }
    return p.Estimativa_Custo || 0;
  };

  const handleAddCustomDFDSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDfdObjeto.trim()) {
      alert('Por favor, preencha o objeto de TIC.');
      return;
    }
    const valNum = parseFloat(customDfdValor.replace(/\./g, '').replace(',', '.')) || 0;
    if (valNum <= 0) {
      alert('Por favor, insira um valor estimado maior que zero.');
      return;
    }
    const targetYear = selectedYear === 'Todos' ? String(currentYear) : selectedYear;
    const dateToUse = customDfdData || `${targetYear}-01-01`;

    try {
      const id = 'custom_dfd_' + Math.random().toString(36).substring(2, 11);
      const docRef = doc(db, 'dfds', id);
      const dfdData = {
        id,
        Num_DFD: customDfdNum.trim() || `DFD-PLOA-${targetYear}-${Math.floor(Math.random() * 900) + 100}`,
        Ano_PCA: targetYear,
        Descricao_Objeto: customDfdObjeto.trim(),
        Valor_Estimado: valNum,
        Status_DFD: 'Não iniciado',
        UASG: '925001',
        Data_conclusao_estimada: dateToUse,
        Periodicidade_Pagamento: customDfdPeriodicidade,
        Valor_Anual_Proporcional: customDfdPeriodicidade === 'Total' ? valNum : (valNum / 12),
        Contabilizar_Orcamento: true,
        updatedAt: new Date().toISOString(),
        Valor_Custeio: customDfdGND === '3 - Custeio' ? valNum : 0,
        Valor_Investimento: customDfdGND === '4 - Investimento' ? valNum : 0,
        isBudgetOnlyItem: true,
        Orcamento_Exercicios: [targetYear]
      };
      await setDoc(docRef, dfdData);
      
      // Reset form and close
      setCustomDfdNum('');
      setCustomDfdObjeto('');
      setCustomDfdPeriodicidade('Mensal');
      setCustomDfdData('');
      setCustomDfdValor('');
      setCustomDfdGND('3 - Custeio');
      setIsAddCustomDfdModalOpen(false);
    } catch (err) {
      console.error('Erro ao adicionar DFD customizado:', err);
    }
  };

  const handleAddCustomPlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPlanObjeto.trim()) {
      alert('Por favor, preencha o objeto de TIC.');
      return;
    }
    const valNum = parseFloat(customPlanEstimativa.replace(/\./g, '').replace(',', '.')) || 0;
    if (valNum <= 0) {
      alert('Por favor, insira uma estimativa de custo maior que zero.');
      return;
    }
    const targetYear = selectedYear === 'Todos' ? String(currentYear) : selectedYear;
    const dateToUse = customPlanData || `${targetYear}-01-01`;

    try {
      const id = 'custom_plan_' + Math.random().toString(36).substring(2, 11);
      const docRef = doc(db, 'planejamentos', id);
      const planData = {
        id,
        DFD_PNCP: customPlanDfdNum.trim() || `DFD-PLOA-${targetYear}-${Math.floor(Math.random() * 900) + 100}`,
        Data_Inicio_Processo_SEI: new Date().toISOString().split('T')[0],
        Objeto: customPlanObjeto.trim(),
        SEI_Processo: customPlanSei.trim() || `SEI-PLOA-${targetYear}-${Math.floor(Math.random() * 900) + 100}`,
        Portaria_Equipe_PC_Numero: '-',
        Portaria_Equipe_PC_SEI: '-',
        Int_Requisitante: 'GECTI',
        Int_Requisitante_Subst: '-',
        Int_Tecnico: '-',
        Int_Tecnico_Subst: '-',
        Int_Administrativo: '-',
        Int_Administrativo_Subst: '-',
        Estimativa_Custo: valNum,
        Status_Planejamento: 'Em Elaboração',
        Data_Sessao_Publica: dateToUse,
        Link_Sessao: '',
        PCA: 'MPO',
        Ano_PCA_Vinculado: targetYear,
        Tipo_Processo: customPlanTipo,
        Acao_Orcamentaria: '8861',
        Plano_Orcamentario: '0000',
        GND: customPlanGND,
        Natureza_Objeto: customPlanGND === '4 - Investimento' ? 'Bem' : 'Serviço',
        Contabilizar_Orcamento: true,
        updatedAt: new Date().toISOString(),
        isBudgetOnlyItem: true,
        Orcamento_Exercicios: [targetYear]
      };
      await setDoc(docRef, planData);

      // Reset form and close
      setCustomPlanSei('');
      setCustomPlanDfdNum('');
      setCustomPlanObjeto('');
      setCustomPlanEstimativa('');
      setCustomPlanGND('3 - Custeio');
      setCustomPlanData('');
      setCustomPlanTipo('Pregão SOF');
      setIsAddCustomPlanModalOpen(false);
    } catch (err) {
      console.error('Erro ao adicionar Planejamento customizado:', err);
    }
  };

  const handleToggleContabilizar = async (d: any) => {
    try {
      const yearStr = String(targetYearInt);
      let currentMap: Record<string, boolean> = {};
      if (d.isPlanejamentoProcess) {
        const id = d.id.replace('plan_', '');
        const orig = planejamentos.find(p => p.id === id);
        currentMap = orig?.Contabilizar_Orcamento_Anual || {};
      } else {
        const orig = dfds.find(o => o.id === d.id);
        currentMap = orig?.Contabilizar_Orcamento_Anual || {};
      }

      const currentVal = currentMap[yearStr] !== undefined
        ? currentMap[yearStr]
        : (d.Contabilizar_Orcamento !== false);

      const newValue = !currentVal;
      const updatedMap = {
        ...currentMap,
        [yearStr]: newValue
      };

      if (d.isPlanejamentoProcess) {
        const id = d.id.replace('plan_', '');
        const docRef = doc(db, 'planejamentos', id);
        await setDoc(docRef, { Contabilizar_Orcamento_Anual: updatedMap }, { merge: true });
      } else {
        const docRef = doc(db, 'dfds', d.id);
        await setDoc(docRef, { Contabilizar_Orcamento_Anual: updatedMap }, { merge: true });
      }
    } catch (err) {
      console.error('Erro ao alternar contabilização:', err);
    }
  };

  const handleSaveCustomValue = async (d: any) => {
    try {
      // Handle PT-BR decimal representation, converting dots to empty and comma to dot
      const parsed = editingDfdValue.replace(/\./g, '').replace(',', '.');
      const val = parseFloat(parsed);
      if (isNaN(val)) {
        alert('Por favor, insira um valor válido.');
        return;
      }
      
      const yearStr = String(targetYearInt);
      let currentMap: Record<string, number | null> = {};
      let originalVal = d.Valor_Estimado;

      if (d.isPlanejamentoProcess) {
        const id = d.id.replace('plan_', '');
        const orig = planejamentos.find(p => p.id === id);
        currentMap = orig?.Valor_Customizado_Anual || {};
        originalVal = orig ? getPlanningCusto(orig) : d.Valor_Estimado;
      } else {
        const orig = dfds.find(o => o.id === d.id);
        currentMap = orig?.Valor_Customizado_Anual || {};
        originalVal = orig?.Valor_Estimado || d.Valor_Estimado;
      }

      const newValue = val === originalVal ? null : val;
      const updatedMap = {
        ...currentMap,
        [yearStr]: newValue
      };

      if (d.isPlanejamentoProcess) {
        const id = d.id.replace('plan_', '');
        const docRef = doc(db, 'planejamentos', id);
        await setDoc(docRef, { Valor_Customizado_Anual: updatedMap }, { merge: true });
      } else {
        const docRef = doc(db, 'dfds', d.id);
        await setDoc(docRef, { Valor_Customizado_Anual: updatedMap }, { merge: true });
      }
      setEditingDfdId(null);
    } catch (err) {
      console.error('Erro ao salvar valor customizado:', err);
    }
  };

  const handleRestoreOriginalValue = async (d: any) => {
    try {
      const yearStr = String(targetYearInt);
      let currentMap: Record<string, number | null> = {};

      if (d.isPlanejamentoProcess) {
        const id = d.id.replace('plan_', '');
        const orig = planejamentos.find(p => p.id === id);
        currentMap = orig?.Valor_Customizado_Anual || {};
      } else {
        const orig = dfds.find(o => o.id === d.id);
        currentMap = orig?.Valor_Customizado_Anual || {};
      }

      const updatedMap = { ...currentMap };
      delete updatedMap[yearStr];

      if (d.isPlanejamentoProcess) {
        const id = d.id.replace('plan_', '');
        const docRef = doc(db, 'planejamentos', id);
        await setDoc(docRef, { Valor_Customizado_Anual: updatedMap }, { merge: true });
      } else {
        const docRef = doc(db, 'dfds', d.id);
        await setDoc(docRef, { Valor_Customizado_Anual: updatedMap }, { merge: true });
      }
    } catch (err) {
      console.error('Erro ao restaurar valor original:', err);
    }
  };

  const handleToggleImportDfd = async (dfdItem: DFD) => {
    try {
      const yearStr = String(targetYearInt);
      const currentExercises = dfdItem.Orcamento_Exercicios || [];
      let updatedExercises: string[];
      if (currentExercises.includes(yearStr)) {
        updatedExercises = currentExercises.filter(y => y !== yearStr);
      } else {
        updatedExercises = [...currentExercises, yearStr];
      }
      
      const docRef = doc(db, 'dfds', dfdItem.id);
      await setDoc(docRef, { Orcamento_Exercicios: updatedExercises }, { merge: true });
    } catch (err) {
      console.error('Erro ao importar/remover DFD do exercício:', err);
    }
  };

  const handleToggleImportPlanejamento = async (planItem: Planejamento) => {
    try {
      const yearStr = String(targetYearInt);
      const currentExercises = planItem.Orcamento_Exercicios || [];
      let updatedExercises: string[];
      if (currentExercises.includes(yearStr)) {
        updatedExercises = currentExercises.filter(y => y !== yearStr);
      } else {
        updatedExercises = [...currentExercises, yearStr];
      }
      
      const docRef = doc(db, 'planejamentos', planItem.id);
      await setDoc(docRef, { Orcamento_Exercicios: updatedExercises }, { merge: true });
    } catch (err) {
      console.error('Erro ao importar/remover Planejamento do exercício:', err);
    }
  };

  // Spreadsheet Projection States
  const [isSpreadsheetOpen, setIsSpreadsheetOpen] = useState(false);
  const [spreadsheetUnidade, setSpreadsheetUnidade] = useState('Secretaria de Orçamento Federal');
  const [spreadsheetAcao, setSpreadsheetAcao] = useState('8861');
  const [spreadsheetPO, setSpreadsheetPO] = useState('01');
  const [spreadsheetItems, setSpreadsheetItems] = useState<any[]>([]);
  const [isLoadingSpreadsheet, setIsLoadingSpreadsheet] = useState(false);
  const [isSavingSpreadsheet, setIsSavingSpreadsheet] = useState(false);

  useEffect(() => {
    if (isSpreadsheetOpen) {
      initSpreadsheet();
    }
  }, [simulateRenewals]);

  useEffect(() => {
    if (viewingPdfObj?.Anexo_PDF) {
      const link = viewingPdfObj.Anexo_PDF;
      if (link.startsWith('data:')) {
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

  const [formSiopYear, setFormSiopYear] = useState<string>('2026');

  const loadSiopFieldsForYear = (year: string) => {
    const docId = year === '2026' ? '8861_2026' : `8861_${year}`;
    let record = siopRecords.find(r => r.id === docId);
    
    // Fallback for 2026 to '8861' if 8861_2026 is missing
    if (!record && year === '2026') {
      record = siopRecords.find(r => r.id === '8861');
    }
    
    const sortedHistoryList = siopHistory && siopHistory.length > 0
      ? [...siopHistory].filter(h => h.id === docId || h.id === `8861_${year}` || (year === '2026' && (h.id === '8861' || h.id === '8861_2026'))).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      : [];
    const latestManualHistory = sortedHistoryList[0];

    const savedFallback = localStorage.getItem(`contratics_siop_${docId}_fallback`) || (year === '2026' ? localStorage.getItem(`contratics_siop_8861_fallback`) : null);
    const fallbackObj = savedFallback ? JSON.parse(savedFallback) : null;

    const baseRec = record || latestManualHistory || fallbackObj || {
      dotacaoInicial: 0,
      dotacaoAtual: 0,
      empenhado: 0,
      liquidado: 0,
      pago: 0,
      dotacaoInicialCusteio: 0,
      dotacaoAtualCusteio: 0,
      empenhadoCusteio: 0,
      liquidadoCusteio: 0,
      pagoCusteio: 0,
      dotacaoInicialInvestimento: 0,
      dotacaoAtualInvestimento: 0,
      empenhadoInvestimento: 0,
      liquidadoInvestimento: 0,
      pagoInvestimento: 0
    };

    const dbRec = {
      ...baseRec,
      dotacaoInicialCusteio: baseRec.dotacaoInicialCusteio !== undefined && baseRec.dotacaoInicialCusteio !== null ? baseRec.dotacaoInicialCusteio : (latestManualHistory?.dotacaoInicialCusteio ?? fallbackObj?.dotacaoInicialCusteio ?? undefined),
      dotacaoAtualCusteio: baseRec.dotacaoAtualCusteio !== undefined && baseRec.dotacaoAtualCusteio !== null ? baseRec.dotacaoAtualCusteio : (latestManualHistory?.dotacaoAtualCusteio ?? fallbackObj?.dotacaoAtualCusteio ?? undefined),
      empenhadoCusteio: baseRec.empenhadoCusteio !== undefined && baseRec.empenhadoCusteio !== null ? baseRec.empenhadoCusteio : (latestManualHistory?.empenhadoCusteio ?? fallbackObj?.empenhadoCusteio ?? undefined),
      liquidadoCusteio: baseRec.liquidadoCusteio !== undefined && baseRec.liquidadoCusteio !== null ? baseRec.liquidadoCusteio : (latestManualHistory?.liquidadoCusteio ?? fallbackObj?.liquidadoCusteio ?? undefined),
      pagoCusteio: baseRec.pagoCusteio !== undefined && baseRec.pagoCusteio !== null ? baseRec.pagoCusteio : (latestManualHistory?.pagoCusteio ?? fallbackObj?.pagoCusteio ?? undefined),
      
      dotacaoInicialInvestimento: baseRec.dotacaoInicialInvestimento !== undefined && baseRec.dotacaoInicialInvestimento !== null ? baseRec.dotacaoInicialInvestimento : (latestManualHistory?.dotacaoInicialInvestimento ?? fallbackObj?.dotacaoInicialInvestimento ?? undefined),
      dotacaoAtualInvestimento: baseRec.dotacaoAtualInvestimento !== undefined && baseRec.dotacaoAtualInvestimento !== null ? baseRec.dotacaoAtualInvestimento : (latestManualHistory?.dotacaoAtualInvestimento ?? fallbackObj?.dotacaoAtualInvestimento ?? undefined),
      empenhadoInvestimento: baseRec.empenhadoInvestimento !== undefined && baseRec.empenhadoInvestimento !== null ? baseRec.empenhadoInvestimento : (latestManualHistory?.empenhadoInvestimento ?? fallbackObj?.empenhadoInvestimento ?? undefined),
      liquidadoInvestimento: baseRec.liquidadoInvestimento !== undefined && baseRec.liquidadoInvestimento !== null ? baseRec.liquidadoInvestimento : (latestManualHistory?.liquidadoInvestimento ?? fallbackObj?.liquidadoInvestimento ?? undefined),
      pagoInvestimento: baseRec.pagoInvestimento !== undefined && baseRec.pagoInvestimento !== null ? baseRec.pagoInvestimento : (latestManualHistory?.pagoInvestimento ?? fallbackObj?.pagoInvestimento ?? undefined),
    };

    // If segregated fields exist, compute the totals dynamically so they are always in perfect sync
    if (dbRec.dotacaoInicialCusteio !== undefined || dbRec.dotacaoInicialInvestimento !== undefined) {
      dbRec.dotacaoInicial = (dbRec.dotacaoInicialCusteio || 0) + (dbRec.dotacaoInicialInvestimento || 0);
      dbRec.dotacaoAtual = (dbRec.dotacaoAtualCusteio || 0) + (dbRec.dotacaoAtualInvestimento || 0);
      dbRec.empenhado = (dbRec.empenhadoCusteio || 0) + (dbRec.empenhadoInvestimento || 0);
      dbRec.liquidado = (dbRec.liquidadoCusteio || 0) + (dbRec.liquidadoInvestimento || 0);
      dbRec.pago = (dbRec.pagoCusteio || 0) + (dbRec.pagoInvestimento || 0);
    }

    setFormDotacaoInicial(String(dbRec.dotacaoInicial || 0));
    setFormDotacaoAtual(String(dbRec.dotacaoAtual || 0));
    setFormEmpenhado(String(dbRec.empenhado || 0));
    setFormLiquidado(String(dbRec.liquidado || 0));
    setFormPago(String(dbRec.pago || 0));

    const iniCusteio = (dbRec.dotacaoInicialCusteio !== undefined && dbRec.dotacaoInicialCusteio !== null) ? dbRec.dotacaoInicialCusteio : (dbRec.dotacaoInicial || 0);
    const atuCusteio = (dbRec.dotacaoAtualCusteio !== undefined && dbRec.dotacaoAtualCusteio !== null) ? dbRec.dotacaoAtualCusteio : (dbRec.dotacaoAtual || 0);
    const empCusteio = (dbRec.empenhadoCusteio !== undefined && dbRec.empenhadoCusteio !== null) ? dbRec.empenhadoCusteio : (dbRec.empenhado || 0);
    const liqCusteio = (dbRec.liquidadoCusteio !== undefined && dbRec.liquidadoCusteio !== null) ? dbRec.liquidadoCusteio : (dbRec.liquidado || 0);
    const pagCusteio = (dbRec.pagoCusteio !== undefined && dbRec.pagoCusteio !== null) ? dbRec.pagoCusteio : (dbRec.pago || 0);

    const iniInvest = (dbRec.dotacaoInicialInvestimento !== undefined && dbRec.dotacaoInicialInvestimento !== null) ? dbRec.dotacaoInicialInvestimento : 0;
    const atuInvest = (dbRec.dotacaoAtualInvestimento !== undefined && dbRec.dotacaoAtualInvestimento !== null) ? dbRec.dotacaoAtualInvestimento : 0;
    const empInvest = (dbRec.empenhadoInvestimento !== undefined && dbRec.empenhadoInvestimento !== null) ? dbRec.empenhadoInvestimento : 0;
    const liqInvest = (dbRec.liquidadoInvestimento !== undefined && dbRec.liquidadoInvestimento !== null) ? dbRec.liquidadoInvestimento : 0;
    const pagInvest = (dbRec.pagoInvestimento !== undefined && dbRec.pagoInvestimento !== null) ? dbRec.pagoInvestimento : 0;

    setFormDotacaoInicialCusteio(String(iniCusteio));
    setFormDotacaoAtualCusteio(String(atuCusteio));
    setFormEmpenhadoCusteio(String(empCusteio));
    setFormLiquidadoCusteio(String(liqCusteio));
    setFormPagoCusteio(String(pagCusteio));

    setFormDotacaoInicialInvestimento(String(iniInvest));
    setFormDotacaoAtualInvestimento(String(atuInvest));
    setFormEmpenhadoInvestimento(String(empInvest));
    setFormLiquidadoInvestimento(String(liqInvest));
    setFormPagoInvestimento(String(pagInvest));
  };

  const openEditSiopModal = () => {
    const initYear = selectedYear === 'Todos' ? '2026' : selectedYear;
    setFormSiopYear(initYear);
    loadSiopFieldsForYear(initYear);
    setIsEditSiopModalOpen(true);
  };

  const handleResetSiopData = async () => {
    if (!window.confirm('Tem certeza que deseja apagar todos os registros do SIOP (Ação 8861) e o histórico de auditoria do banco de dados? Esta ação irá zerar todas as informações e o histórico de auditoria.')) {
      return;
    }
    
    setIsSavingSiop(true);
    try {
      // 1. Delete /siopData documents
      await deleteDoc(doc(db, 'siopData', '8861'));
      await deleteDoc(doc(db, 'siopData', '8861_2026'));
      await deleteDoc(doc(db, 'siopData', '8861_2024'));
      await deleteDoc(doc(db, 'siopData', '8861_2025'));
      await deleteDoc(doc(db, 'siopData', '8861_2027'));
      await deleteDoc(doc(db, 'siopData', '8861_2028'));
      
      // 2. Fetch and delete all/most documents in /siopHistory
      const querySnapshot = await getDocs(collection(db, 'siopHistory'));
      const deletePromises = querySnapshot.docs.map(async (docSnapshot) => {
        await deleteDoc(doc(db, 'siopHistory', docSnapshot.id));
      });
      await Promise.all(deletePromises);
      
      // Reset form states to zero
      setFormDotacaoInicial('0');
      setFormDotacaoAtual('0');
      setFormEmpenhado('0');
      setFormLiquidado('0');
      setFormPago('0');

      setFormDotacaoInicialCusteio('0');
      setFormDotacaoAtualCusteio('0');
      setFormEmpenhadoCusteio('0');
      setFormLiquidadoCusteio('0');
      setFormPagoCusteio('0');

      setFormDotacaoInicialInvestimento('0');
      setFormDotacaoAtualInvestimento('0');
      setFormEmpenhadoInvestimento('0');
      setFormLiquidadoInvestimento('0');
      setFormPagoInvestimento('0');
      
      alert('Dados e histórico limpos do banco de dados com sucesso!');
    } catch (err) {
      console.error('Erro ao limpar dados do SIOP:', err);
      alert('Erro ao limpar os dados do SIOP.');
    } finally {
      setIsSavingSiop(false);
    }
  };

  const handleSaveSiopData = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSiop(true);
    
    const dIniCusteio = Number(formDotacaoInicialCusteio) || 0;
    const dIniInvest = Number(formDotacaoInicialInvestimento) || 0;
    const dAtuCusteio = Number(formDotacaoAtualCusteio) || 0;
    const dAtuInvest = Number(formDotacaoAtualInvestimento) || 0;
    const empCusteio = Number(formEmpenhadoCusteio) || 0;
    const empInvest = Number(formEmpenhadoInvestimento) || 0;
    const liqCusteio = Number(formLiquidadoCusteio) || 0;
    const liqInvest = Number(formLiquidadoInvestimento) || 0;
    const pagCusteio = Number(formPagoCusteio) || 0;
    const pagInvest = Number(formPagoInvestimento) || 0;

    const parsedFields = {
      dotacaoInicial: dIniCusteio + dIniInvest,
      dotacaoAtual: dAtuCusteio + dAtuInvest,
      empenhado: empCusteio + empInvest,
      liquidado: liqCusteio + liqInvest,
      pago: pagCusteio + pagInvest,
      
      dotacaoInicialCusteio: dIniCusteio,
      dotacaoAtualCusteio: dAtuCusteio,
      empenhadoCusteio: empCusteio,
      liquidadoCusteio: liqCusteio,
      pagoCusteio: pagCusteio,
      
      dotacaoInicialInvestimento: dIniInvest,
      dotacaoAtualInvestimento: dAtuInvest,
      empenhadoInvestimento: empInvest,
      liquidadoInvestimento: liqInvest,
      pagoInvestimento: pagInvest,
    };
    
    const timestamp = new Date().toISOString();
    const docId = formSiopYear === '2026' ? '8861' : `8861_${formSiopYear}`;
    
    try {
      // Save local storage fallback cache
      localStorage.setItem(`contratics_siop_${docId}_fallback`, JSON.stringify({
        ...parsedFields,
        updatedAt: timestamp,
        manualUpdatedAt: timestamp
      }));

      // 1. Update /siopData/docId
      await setDoc(doc(db, 'siopData', docId), {
        id: docId,
        year: formSiopYear,
        ...parsedFields,
        updatedAt: timestamp,
        manualUpdatedAt: timestamp
      });

      // Dual save for 2026 so our yearly queries are uniform
      if (formSiopYear === '2026') {
        await setDoc(doc(db, 'siopData', '8861_2026'), {
          id: '8861_2026',
          year: '2026',
          ...parsedFields,
          updatedAt: timestamp,
          manualUpdatedAt: timestamp
        });
      }
      
      // 2. Add history snapshot
      await addDoc(collection(db, 'siopHistory'), {
        id: docId,
        year: formSiopYear,
        ...parsedFields,
        updatedAt: timestamp,
        updatedBy: currentUser?.id || 'anonymous',
        updatedByName: currentUser?.name || 'Gestor Contratics'
      });
      
      setIsEditSiopModalOpen(false);
    } catch (err) {
      console.error('Erro ao salvar dados do SIOP:', err);
    } finally {
      setIsSavingSiop(false);
    }
  };

  const targetYearInt = selectedYear === 'Todos' ? currentYear : parseInt(selectedYear, 10);

  // Helper: DFD annualized calculation
  const getDfdAnnualizedValue = (dfd: DFD, year: number): number => {
    const yearStr = String(year);
    const isContabilizado = dfd.Contabilizar_Orcamento_Anual?.[yearStr] !== undefined
      ? dfd.Contabilizar_Orcamento_Anual[yearStr]
      : (dfd.Contabilizar_Orcamento !== false);

    if (isContabilizado === false) return 0;
    
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

    const baseValue = dfd.Valor_Customizado_Anual?.[yearStr] !== undefined && dfd.Valor_Customizado_Anual?.[yearStr] !== null
      ? dfd.Valor_Customizado_Anual[yearStr]!
      : (dfd.Valor_Customizado !== undefined && dfd.Valor_Customizado !== null ? dfd.Valor_Customizado : dfd.Valor_Estimado);

    if (!conclDate || isNaN(conclDate.getTime())) return baseValue;

    const conclYear = conclDate.getUTCFullYear();
    
    // 1. If target simulation year is before conclusion year, there is no impact yet
    if (conclYear > year) {
      return 0;
    }

    // 2. One-off/Pontual Acquisition or Direct Contract (Inexigibilidade / Dispensa / Compra pontual)
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
      return conclYear === year ? baseValue : 0;
    }

    // 3. Continuous Service/Subscription ('Mensal' or 'Anual' like a backup solution)
    if (conclYear < year) {
      // In subsequent years, continuous services impact the full year (12 months)
      return baseValue;
    } else {
      // conclYear === year (the year it is concluded/started)
      // Proportional impact from conclusion date until Dec 31
      const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
      const activeMonths = getFractionalMonths(conclDate, yearEnd);
      return baseValue * (activeMonths / 12);
    }
  };

  // Helper to determine the effective simulation start date for a planning process
  const getEffectivePlanningStartDate = (p: Planejamento, targetYear: number): {
    date: Date;
    dateStr: string;
    isOverridden: boolean;
    isTodayDefault: boolean;
    isSessionDate: boolean;
  } => {
    const pKey = p.id || p.SEI_Processo;
    const customSimDate = simulatedPlanningDates[pKey] || (p as any).Data_Sessao_Simulada;
    
    if (customSimDate) {
      const d = new Date(customSimDate.includes('T') ? customSimDate : `${customSimDate}T00:00:00Z`);
      if (!isNaN(d.getTime())) {
        return {
          date: d,
          dateStr: customSimDate.split('T')[0],
          isOverridden: true,
          isTodayDefault: false,
          isSessionDate: false
        };
      }
    }

    // If Data_Sessao_Publica exists and is valid
    if (p.Data_Sessao_Publica && p.Data_Sessao_Publica.trim() !== '') {
      const raw = p.Data_Sessao_Publica.split('T')[0];
      const d = new Date(`${raw}T00:00:00Z`);
      if (!isNaN(d.getTime())) {
        return {
          date: d,
          dateStr: raw,
          isOverridden: false,
          isTodayDefault: false,
          isSessionDate: true
        };
      }
    }

    // If no Data_Sessao_Publica (process still in planning phase):
    // If target year is the current year: default to TODAY (data da simulação)
    const now = new Date(currentLocalTime);
    const nowYear = now.getUTCFullYear();
    
    if (targetYear === nowYear) {
      const todayStr = now.toISOString().split('T')[0];
      return {
        date: now,
        dateStr: todayStr,
        isOverridden: false,
        isTodayDefault: true,
        isSessionDate: false
      };
    } else {
      // Future or past year default to Jan 1st of that target year
      const defaultDateStr = `${targetYear}-01-01`;
      return {
        date: new Date(Date.UTC(targetYear, 0, 1)),
        dateStr: defaultDateStr,
        isOverridden: false,
        isTodayDefault: false,
        isSessionDate: false
      };
    }
  };

  // Helper: Planejamento (Licitação em Andamento) annualized calculation
  const getPlanejamentoAnnualizedValue = (p: Planejamento, year: number, overrideCost?: number): {
    value: number;
    monthsRemaining: number;
    activeMonthsDesc: string;
    startDateStr: string;
    isOverridden: boolean;
    isTodayDefault: boolean;
    isSessionDate: boolean;
    isOneOff: boolean;
    baseCost: number;
  } => {
    const { date: estStartDate, dateStr: startDateStr, isOverridden, isTodayDefault, isSessionDate } = getEffectivePlanningStartDate(p, year);

    const yearStr = String(year);
    const customValueAnual = p.Valor_Customizado_Anual?.[yearStr];
    const baseCost = customValueAnual !== undefined && customValueAnual !== null
      ? customValueAnual
      : (p.Valor_Customizado !== undefined && p.Valor_Customizado !== null ? p.Valor_Customizado : (overrideCost !== undefined ? overrideCost : getPlanningCusto(p)));

    // Check if direct contracting or one-off
    const isContratacaoDireta = 
      p.Tipo_Processo?.toLowerCase().includes('inexigibilidade') ||
      p.Tipo_Processo?.toLowerCase().includes('dispensa') ||
      p.Tipo_Processo?.toLowerCase().includes('direta') ||
      (p as any).Modalidade_Contratacao?.toLowerCase().includes('inexigibilidade') ||
      (p as any).Modalidade_Contratacao?.toLowerCase().includes('dispensa') ||
      (p as any).Modalidade_Contratacao?.toLowerCase().includes('direta');

    const isOneOff = isContratacaoDireta ||
                     p.GND === '4 - Investimento' || 
                     p.Natureza_Objeto === 'Bem' ||
                     p.Periodicidade_Pagamento === 'Total' ||
                     p.Objeto?.toLowerCase().includes('aquisição') || 
                     p.Objeto?.toLowerCase().includes('compra') ||
                     p.Objeto?.toLowerCase().includes('inscrição') ||
                     p.Objeto?.toLowerCase().includes('treinamento') ||
                     p.Objeto?.toLowerCase().includes('capacitação') ||
                     p.Objeto?.toLowerCase().includes('evento') ||
                     p.Objeto?.toLowerCase().includes('conferência') ||
                     p.Objeto?.toLowerCase().includes('kubecon');

    if (!estStartDate || isNaN(estStartDate.getTime())) {
      return {
        value: baseCost,
        monthsRemaining: 12,
        activeMonthsDesc: '12 meses',
        startDateStr,
        isOverridden,
        isTodayDefault,
        isSessionDate,
        isOneOff,
        baseCost
      };
    }

    const startYear = estStartDate.getUTCFullYear();
    
    // 1. If target simulation year is before estimated start year, no impact yet
    if (startYear > year) {
      return {
        value: 0,
        monthsRemaining: 0,
        activeMonthsDesc: `Início previsto em ${startYear} (Sem impacto em ${year})`,
        startDateStr,
        isOverridden,
        isTodayDefault,
        isSessionDate,
        isOneOff,
        baseCost
      };
    }

    if (isOneOff) {
      // Direct acquisitions / one-off purchases must use the full estimated cost in the start year
      const val = startYear === year ? baseCost : 0;
      return {
        value: val,
        monthsRemaining: 12,
        activeMonthsDesc: isContratacaoDireta ? 'Contratação Direta (Valor Integral)' : 'Aquisição Pontual / Investimento',
        startDateStr,
        isOverridden,
        isTodayDefault,
        isSessionDate,
        isOneOff,
        baseCost
      };
    } else {
      // Continuous service (like licenses, support, outsourcing)
      if (startYear < year) {
        // In subsequent years, continuous services impact the full year (12 months)
        return {
          value: baseCost,
          monthsRemaining: 12,
          activeMonthsDesc: '12 meses (Ano integral)',
          startDateStr,
          isOverridden,
          isTodayDefault,
          isSessionDate,
          isOneOff,
          baseCost
        };
      } else {
        // startYear === year (the year it starts)
        // Proportional impact from start date until Dec 31 of that year
        const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
        const activeMonths = getFractionalMonths(estStartDate, yearEnd);
        const roundedMonths = Math.max(0.1, Math.min(12, activeMonths));
        const val = baseCost * (roundedMonths / 12);
        
        let label = '';
        if (isOverridden) {
          label = `Data ajustada: ${formatDate(startDateStr)} (${roundedMonths.toFixed(1)} meses no ano)`;
        } else if (isTodayDefault) {
          label = `Simulação a partir de hoje: ${formatDate(startDateStr)} (${roundedMonths.toFixed(1)} meses no ano)`;
        } else if (isSessionDate) {
          label = `Sessão pública: ${formatDate(startDateStr)} (${roundedMonths.toFixed(1)} meses no ano)`;
        } else {
          label = `${roundedMonths.toFixed(1)} meses no exercício (a partir de ${formatDate(startDateStr)})`;
        }

        return {
          value: val,
          monthsRemaining: roundedMonths,
          activeMonthsDesc: label,
          startDateStr,
          isOverridden,
          isTodayDefault,
          isSessionDate,
          isOneOff,
          baseCost
        };
      }
    }
  };

  const checkIfContractCanBeRenewed = (c: Contrato): boolean => {
    // 1. Check if contract was made by direct contracting (Inexigibilidade / Dispensa)
    const modalidadeStr = (c.Modalidade_Contratacao || (c as any).Modalidade || (c as any).Tipo_Processo || (c as any).Forma_Contratacao || '').toLowerCase();
    const isDirectContract = 
      modalidadeStr.includes('inexigibilidade') ||
      modalidadeStr.includes('dispensa') ||
      modalidadeStr.includes('direta');

    // 2. Check if one-off purchase, single training event, or total payment frequency
    const isOneOffOrNonRenewable = 
      isDirectContract ||
      c.Periodicidade_Pagamento === 'Total' ||
      (c as any).Prorrogavel === false ||
      c.Objeto?.toLowerCase().includes('capacitação') ||
      c.Objeto?.toLowerCase().includes('treinamento') ||
      c.Objeto?.toLowerCase().includes('inscrição') ||
      c.Objeto?.toLowerCase().includes('certbr') ||
      c.Objeto?.toLowerCase().includes('aquisição') ||
      c.Objeto?.toLowerCase().includes('compra');

    if (isOneOffOrNonRenewable) {
      return false;
    }

    const prorrogaMeses = (aditivos || [])
      .filter(ad => (ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
      .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
    const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(c.Numero_Renovacoes) || 0);

    const initialMonths = Number(c.Vigencia_Inicial_Meses) || 12;
    const currentTotalDuration = initialMonths + totalRenovacaoMeses;
    const maxAllowed = Number(c.Tempo_Possivel_Prorrogacao_Meses) || 60;
    
    // If max allowable duration is less than or equal to initial duration, renewal is not possible
    if (maxAllowed <= initialMonths) {
      return false;
    }

    const cannotBeRenewed = currentTotalDuration >= maxAllowed;

    let endVal = new Date(c.Vigencia_Inicio);
    endVal.setUTCMonth(endVal.getUTCMonth() + currentTotalDuration);

    const isExpired = endVal < new Date(currentLocalTime) || c.Status_Contrato?.toLowerCase() === 'encerrado';
    return !cannotBeRenewed && !isExpired;
  };

  // Helper: Contract SOF value calculation (replicated from main system to keep standalone and accurate)
  const getContractSOFValueForYearLocal = (c: Contrato, year: number): number => {
    const isSimMode = simulateRenewals;

    const prorrogaMeses = (aditivos || [])
      .filter(ad => (ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
      .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
    const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(c.Numero_Renovacoes) || 0);

    let endVal = new Date(c.Vigencia_Inicio);
    endVal.setUTCMonth(endVal.getUTCMonth() + (Number(c.Vigencia_Inicial_Meses) || 12) + totalRenovacaoMeses);

    const canBeRenewed = checkIfContractCanBeRenewed(c);
    if (isSimMode && canBeRenewed) {
      endVal = getSimulatedContractEndDate(c, endVal);
    }

    const isActuallyClosed = c.Status_Contrato?.toLowerCase() === 'encerrado';
    if (isActuallyClosed && (!isSimMode || endVal < new Date(Date.UTC(year, 0, 1)))) {
      return 0;
    }

    const startVal = new Date(c.Vigencia_Inicio);
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    if (startVal > yearEnd || endVal < yearStart) {
      return 0;
    }

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

    let baseValue = 0;
    let source: 'items' | 'dfd' | 'fallback' | 'dfd_duplicate' = 'fallback';

    if (hasSOFItems) {
      baseValue = activeItems.reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
      source = 'items';
    } else {
      const linkedDfd = dfds.find(d => d.id === c.DFD_Vinculado || d.Num_DFD === c.DFD_Vinculado);
      if (linkedDfd) {
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

        sharingContracts.sort((a, b) => a.id.localeCompare(b.id));
        const isFirst = sharingContracts.length > 0 && sharingContracts[0].id === c.id;

        if (isFirst) {
          const finalMonths = Number(c.Vigencia_Inicial_Meses) || 60;
          baseValue = ((linkedDfd.Valor_Estimado || 0) / finalMonths) * 12;
          source = 'dfd';
        } else {
          return 0; // duplicate
        }
      } else {
        baseValue = c.Valor_Anual_SOF || 0;
        source = 'fallback';
      }
    }

    const periodicidade = c.Periodicidade_Pagamento || 'Mensal';

    if (periodicidade === 'Mensal' || periodicidade === 'Anual') {
      let baseMonthly = 0;
      if (periodicidade === 'Mensal') {
        if (source === 'items') {
          baseMonthly = baseValue / (Number(c.Vigencia_Inicial_Meses) || 12);
        } else {
          baseMonthly = baseValue / 12;
        }
      } else { // Anual
        if (source === 'items') {
          baseMonthly = ((baseValue / (Number(c.Vigencia_Inicial_Meses) || 12)) * 12) / 12;
        } else {
          baseMonthly = baseValue / 12;
        }
      }

      // Check for Index adjustments under simulation mode
      let reajusteRate = 0;
      if (isSimMode && c.Indice_Reajuste && c.Indice_Reajuste !== 'Sem Reajuste' && c.Indice_Reajuste !== 'Não se aplica') {
        const matched = c.Indice_Reajuste.match(/([\d.,]+)\s*%/);
        if (matched) {
          reajusteRate = parseFloat(matched[1].replace(',', '.')) / 100;
        } else if (['ICTI', 'IPCA', 'IGP-M', 'IGPM'].includes(c.Indice_Reajuste.toUpperCase())) {
          reajusteRate = 0.045; // Default 4.5% standard simulation index rate
        }
      }

      const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      let rMonthIdx = -1;
      if (c.Mes_Reajuste) {
        rMonthIdx = months.indexOf(c.Mes_Reajuste);
      } else if (c.Vigencia_Inicio) {
        rMonthIdx = new Date(c.Vigencia_Inicio).getUTCMonth();
      }

      let calculatedYearTotal = 0;
      for (let m = 0; m < 12; m++) {
        const mStart = new Date(Date.UTC(year, m, 1));
        const mEnd = new Date(Date.UTC(year, m + 1, 0, 23, 59, 59));

        if (calcStart <= mEnd && calcEnd >= mStart) {
          const activeS = calcStart > mStart ? calcStart : mStart;
          const activeE = calcEnd < mEnd ? calcEnd : mEnd;
          const activeFraction = getFractionalMonths(activeS, activeE);

          let rate = 1;
          if (isSimMode && reajusteRate > 0 && rMonthIdx !== -1 && m >= rMonthIdx) {
            rate = 1 + reajusteRate;
          }

          calculatedYearTotal += baseMonthly * activeFraction * rate;
        }
      }
      return calculatedYearTotal;
    } else { // Total
      const contractPayments = (pagamentos || []).filter(p => (p.Num_Contrato === c.id || p.Num_Contrato === c.Num_Contrato) && p.Status === 'Pago');
      let paymentYear = startVal.getUTCFullYear();
      if (contractPayments.length > 0) {
        const sortedPayments = [...contractPayments].sort((a, b) => new Date(a.Data).getTime() - new Date(b.Data).getTime());
        paymentYear = sortedPayments[0].Ano_Orcamento || new Date(sortedPayments[0].Data).getUTCFullYear();
      }
      if (year === paymentYear) {
        return baseValue;
      }
      return 0;
    }
  };

  // Process and Filter DFDs
  const baseProcessedDFDs = dfds
    .filter(d => {
      // Filter by selected year or imported years
      if (selectedYear !== 'Todos') {
        const isOriginalYear = d.Ano_PCA === selectedYear;
        const isImportedYear = d.Orcamento_Exercicios?.includes(selectedYear);
        if (!isOriginalYear && !isImportedYear) return false;
      }
      // Trás apenas Iniciado e Não iniciado
      const isCorrectStatus = d.Status_DFD === 'Iniciado' || d.Status_DFD === 'Não iniciado';
      if (!isCorrectStatus) return false;
      return true;
    })
    .map(d => {
      let custSum = d.Valor_Custeio || 0;
      let invSum = d.Valor_Investimento || 0;
      
      const linkedPlan = d.Planejamento_Vinculado ? (planejamentos || []).find(p => p.SEI_Processo === d.Planejamento_Vinculado) : null;
      if (linkedPlan) {
        const planItems = (itensPlanejamentoSOF || []).filter(i => i.Processo_SEI === linkedPlan.SEI_Processo && i.Status_Item === 'Ativo');
        if (planItems.length > 0) {
          custSum = planItems.filter(i => !i.Natureza_Despesa || i.Natureza_Despesa === 'Custeio' || i.GND === '3 - Custeio').reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
          invSum = planItems.filter(i => i.Natureza_Despesa === 'Investimento' || i.GND === '4 - Investimento').reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
        }
      }

      // Read year-specific properties
      const yearStr = String(targetYearInt);
      const isContabilizado = d.Contabilizar_Orcamento_Anual?.[yearStr] !== undefined
        ? d.Contabilizar_Orcamento_Anual[yearStr]
        : (d.Contabilizar_Orcamento !== false);

      const customValue = d.Valor_Customizado_Anual?.[yearStr] !== undefined
        ? d.Valor_Customizado_Anual[yearStr]
        : (d.Valor_Customizado !== undefined && d.Valor_Customizado !== null ? d.Valor_Customizado : null);

      return {
        ...d,
        Contabilizar_Orcamento: isContabilizado,
        Valor_Customizado: customValue,
        Valor_Custeio: custSum,
        Valor_Investimento: invSum,
        valor_anualizado: getDfdAnnualizedValue(d, targetYearInt),
        isPlanejamentoProcess: false,
        isBudgetOnlyItem: d.isBudgetOnlyItem,
        observacoes_planejamento: d.isBudgetOnlyItem ? 'Adicionado por decisão da chefia' : (d.Ano_PCA !== selectedYear ? `Importado do PCA ${d.Ano_PCA}` : "DFD Ativo (A Planejar)")
      };
    });

  // Process and Filter Planejamentos (Licitações em Andamento ou Planejadas)
  // Only included when simulateRenewals is active, and only showing 'Serviço' nature processes (continuous service), unless explicitly imported.
  const processedPlanejamentos = (planejamentos || [])
        .filter(p => {
          // If explicitly imported to this target year, we bypass standard restrictions
          const isImported = p.Orcamento_Exercicios?.includes(selectedYear);
          if (isImported) return true;

          if (p.isBudgetOnlyItem) return true;

          if (!simulateRenewals) return false;

          // Continuous services only
          const isServico = p.Natureza_Objeto !== 'Bem';
          if (!isServico) return false;

          // Filter only in-progress planning processes
          const inProgress = p.Status_Planejamento === 'Em Elaboração' || p.Status_Planejamento === 'Seleção Fornecedor';
          if (!inProgress) return false;

          // To avoid double-counting, check if there's already an active DFD in baseProcessedDFDs that matches this Planejamento
          const isAlreadyCoveredByDFD = baseProcessedDFDs.some(d => 
            d.Contabilizar_Orcamento !== false && (
              (d.Planejamento_Vinculado && d.Planejamento_Vinculado === p.SEI_Processo) ||
              (d.Num_DFD && d.Num_DFD === p.DFD_PNCP)
            )
          );
          if (isAlreadyCoveredByDFD) return false;

          return true;
        })
    .map(p => {
      const planItems = (itensPlanejamentoSOF || []).filter(i => i.Processo_SEI === p.SEI_Processo && i.Status_Item === 'Ativo');
      let custSum = 0;
      let invSum = 0;
      if (planItems.length > 0) {
        custSum = planItems.filter(i => !i.Natureza_Despesa || i.Natureza_Despesa === 'Custeio' || i.GND === '3 - Custeio').reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
        invSum = planItems.filter(i => i.Natureza_Despesa === 'Investimento' || i.GND === '4 - Investimento').reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
      } else {
        custSum = p.GND === '3 - Custeio' || !p.GND ? p.Estimativa_Custo : 0;
        invSum = p.GND === '4 - Investimento' ? p.Estimativa_Custo : 0;
      }

      const totalVal = planItems.length > 0 ? (custSum + invSum) : p.Estimativa_Custo;
      const planCalc = getPlanejamentoAnnualizedValue(p, targetYearInt, totalVal);
      const annualizedValue = planCalc.value;

      const isContratacaoDireta = 
        p.Tipo_Processo?.toLowerCase().includes('inexigibilidade') ||
        p.Tipo_Processo?.toLowerCase().includes('dispensa') ||
        p.Tipo_Processo?.toLowerCase().includes('direta') ||
        (p as any).Modalidade_Contratacao?.toLowerCase().includes('inexigibilidade') ||
        (p as any).Modalidade_Contratacao?.toLowerCase().includes('dispensa') ||
        (p as any).Modalidade_Contratacao?.toLowerCase().includes('direta');

      const isOneOff = isContratacaoDireta ||
                       p.GND === '4 - Investimento' || 
                       p.Natureza_Objeto === 'Bem' ||
                       p.Periodicidade_Pagamento === 'Total' ||
                       p.Objeto?.toLowerCase().includes('aquisição') || 
                       p.Objeto?.toLowerCase().includes('compra') ||
                       p.Objeto?.toLowerCase().includes('inscrição') ||
                       p.Objeto?.toLowerCase().includes('treinamento') ||
                       p.Objeto?.toLowerCase().includes('capacitação') ||
                       p.Objeto?.toLowerCase().includes('evento') ||
                       p.Objeto?.toLowerCase().includes('conferência') ||
                       p.Objeto?.toLowerCase().includes('kubecon');

      let obs = '';
      if (p.Orcamento_Exercicios?.includes(selectedYear)) {
        obs = `Importado do Planejamento Original (${p.Ano_PCA_Vinculado || '2026'})`;
      } else if (isContratacaoDireta) {
        obs = `Contratação Direta (Valor Integral Estimado)`;
      } else if (isOneOff) {
        obs = `Aquisição Pontual / Investimento (Valor Integral)`;
      } else {
        obs = planCalc.activeMonthsDesc;
      }

      const yearStr = String(targetYearInt);
      const isContabilizado = p.Contabilizar_Orcamento_Anual?.[yearStr] !== undefined
        ? p.Contabilizar_Orcamento_Anual[yearStr]
        : (p.Contabilizar_Orcamento !== false);

      const customValue = p.Valor_Customizado_Anual?.[yearStr] !== undefined
        ? p.Valor_Customizado_Anual[yearStr]
        : (p.Valor_Customizado !== undefined && p.Valor_Customizado !== null ? p.Valor_Customizado : null);

      const planKey = p.id || p.SEI_Processo;

      const mockDfd: any = {
        id: `plan_${planKey}`,
        planejamento_id: planKey,
        Num_DFD: p.SEI_Processo || 'Sem Processo',
        Ano_PCA: p.Ano_PCA_Vinculado || '2026',
        Descricao_Objeto: p.Objeto,
        Valor_Estimado: totalVal,
        Status_DFD: 'Iniciado',
        UASG: '925001',
        Planejamento_Vinculado: p.SEI_Processo,
        Data_conclusao_estimada: planCalc.startDateStr,
        data_inicio_efetiva: planCalc.startDateStr,
        isOverriddenDate: planCalc.isOverridden,
        isTodayDefaultDate: planCalc.isTodayDefault,
        isSessionDate: planCalc.isSessionDate,
        monthsRemaining: planCalc.monthsRemaining,
        Periodicidade_Pagamento: isOneOff || invSum > custSum ? 'Total' : 'Mensal',
        Valor_Anual_Proporcional: annualizedValue,
        Contabilizar_Orcamento: isContabilizado,
        updatedAt: p.updatedAt,
        Valor_Custeio: custSum,
        Valor_Investimento: invSum,
        valor_anualizado: isContabilizado === false ? 0 : annualizedValue,
        Valor_Customizado: customValue,
        isPlanejamentoProcess: true,
        isBudgetOnlyItem: p.isBudgetOnlyItem,
        observacoes_planejamento: p.isBudgetOnlyItem ? 'Adicionado por decisão da chefia' : obs,
        calculo_detalhado: isOneOff 
          ? 'Valor integral no exercício de início' 
          : (planCalc.monthsRemaining >= 12 
              ? 'Exercício integral (12 meses)' 
              : `R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × ${planCalc.monthsRemaining.toFixed(1)} / 12 meses`)
      };
      return mockDfd;
    })
    .filter(mockDfd => {
      // Keep if it has financial impact in this year OR if the user selected 'Todos' OR if explicitly imported
      if (selectedYear === 'Todos') return true;
      const idRaw = mockDfd.id.replace('plan_', '');
      const pOrig = planejamentos?.find(p => p.id === idRaw);
      if (pOrig?.Orcamento_Exercicios?.includes(selectedYear)) return true;

      // Or if the start year or Ano_PCA matches the selectedYear
      const estStartYear = mockDfd.Data_conclusao_estimada ? new Date(mockDfd.Data_conclusao_estimada).getUTCFullYear() : 2026;
      return (mockDfd.Contabilizar_Orcamento === false) || mockDfd.valor_anualizado > 0 || String(estStartYear) === selectedYear || mockDfd.Ano_PCA === selectedYear;
    });

  // Combined DFDs + Planejamentos for unified lookups if needed
  const processedDFDs = [
    ...baseProcessedDFDs,
    ...processedPlanejamentos
  ];

  // Soma DFDs Anualizada: strictly DFDs from PCA
  const sumAnnualizedDFDs = baseProcessedDFDs
    .filter(d => d.Contabilizar_Orcamento !== false)
    .reduce((acc, curr) => acc + curr.valor_anualizado, 0);

  // Soma Planejamentos Anualizada: strictly in-progress planning processes from SEI
  const sumAnnualizedPlanejamentos = processedPlanejamentos
    .filter(p => p.Contabilizar_Orcamento !== false)
    .reduce((acc, curr) => acc + curr.valor_anualizado, 0);

  // Process and Filter Contracts
  // Find valid contracts with computed value > 0 that aren't closed
  const processedContracts = contratos
    .filter(c => {
      const isSimMode = simulateRenewals;

      const prorrogaMeses = (aditivos || [])
        .filter(ad => (ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
        .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
      const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(c.Numero_Renovacoes) || 0);

      let endVal = new Date(c.Vigencia_Inicio);
      endVal.setUTCMonth(endVal.getUTCMonth() + (Number(c.Vigencia_Inicial_Meses) || 12) + totalRenovacaoMeses);

      if (isSimMode) {
        const canBeRenewed = checkIfContractCanBeRenewed(c);
        if (canBeRenewed) {
          endVal = getSimulatedContractEndDate(c, endVal);
        }
      }

      const isActuallyClosed = c.Status_Contrato?.toLowerCase() === 'encerrado';
      if (isActuallyClosed && (!isSimMode || endVal < new Date(Date.UTC(targetYearInt, 0, 1)))) {
        return false;
      }

      const val = getContractSOFValueForYearLocal(c, targetYearInt);
      return val > 0;
    })
    .map(c => ({
      ...c,
      valor_anual_sof: getContractSOFValueForYearLocal(c, targetYearInt)
    }));

  const sumAnnualizedContracts = processedContracts.reduce((acc, curr) => acc + curr.valor_anual_sof, 0);

  // Valor Anual Geral SOF = Contratos + DFDs (PCA) + Planejamentos (Licitações)
  const valorAnualGeralSOF = sumAnnualizedContracts + sumAnnualizedDFDs + sumAnnualizedPlanejamentos;

  // Calculate the Custeio and Investimento totals for DFDs (PCA only)
  let sumAnnualizedDFDsCusteio = 0;
  let sumAnnualizedDFDsInvestimento = 0;

  baseProcessedDFDs.filter(d => d.Contabilizar_Orcamento !== false).forEach(d => {
    const totalProp = (d.Valor_Custeio || 0) + (d.Valor_Investimento || 0);
    if (totalProp <= 0) {
      sumAnnualizedDFDsCusteio += d.valor_anualizado;
    } else {
      const custeioRatio = (d.Valor_Custeio || 0) / totalProp;
      const investimentoRatio = (d.Valor_Investimento || 0) / totalProp;
      sumAnnualizedDFDsCusteio += d.valor_anualizado * custeioRatio;
      sumAnnualizedDFDsInvestimento += d.valor_anualizado * investimentoRatio;
    }
  });

  // Calculate the Custeio and Investimento totals for Planejamentos (SEI)
  let sumAnnualizedPlansCusteio = 0;
  let sumAnnualizedPlansInvestimento = 0;

  processedPlanejamentos.filter(p => p.Contabilizar_Orcamento !== false).forEach(p => {
    const totalProp = (p.Valor_Custeio || 0) + (p.Valor_Investimento || 0);
    if (totalProp <= 0) {
      sumAnnualizedPlansCusteio += p.valor_anualizado;
    } else {
      const custeioRatio = (p.Valor_Custeio || 0) / totalProp;
      const investimentoRatio = (p.Valor_Investimento || 0) / totalProp;
      sumAnnualizedPlansCusteio += p.valor_anualizado * custeioRatio;
      sumAnnualizedPlansInvestimento += p.valor_anualizado * investimentoRatio;
    }
  });

  let sumAnnualizedContractsCusteio = 0;
  let sumAnnualizedContractsInvestimento = 0;

  processedContracts.forEach(c => {
    const val = c.valor_anual_sof;
    const activeItems = (itensSOF || []).filter(i => 
      (i.Num_Contrato === c.id || i.Num_Contrato === c.Num_Contrato) && 
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
      if (totalItemSum <= 0) {
        sumAnnualizedContractsCusteio += val;
      } else {
        sumAnnualizedContractsCusteio += val * (itemCusteioSum / totalItemSum);
        sumAnnualizedContractsInvestimento += val * (itemInvestimentoSum / totalItemSum);
      }
    } else {
      // Look up linked DFD ratio
      const linkedDfd = dfds.find(d => d.id === c.DFD_Vinculado || d.Num_DFD === c.DFD_Vinculado);
      if (linkedDfd) {
        const totalProp = (linkedDfd.Valor_Custeio || 0) + (linkedDfd.Valor_Investimento || 0);
        if (totalProp <= 0) {
          sumAnnualizedContractsCusteio += val;
        } else {
          sumAnnualizedContractsCusteio += val * ((linkedDfd.Valor_Custeio || 0) / totalProp);
          sumAnnualizedContractsInvestimento += val * ((linkedDfd.Valor_Investimento || 0) / totalProp);
        }
      } else {
        sumAnnualizedContractsCusteio += val;
      }
    }
  });

  const totalCusteioGeral = sumAnnualizedDFDsCusteio + sumAnnualizedPlansCusteio + sumAnnualizedContractsCusteio;
  const totalInvestimentoGeral = sumAnnualizedDFDsInvestimento + sumAnnualizedPlansInvestimento + sumAnnualizedContractsInvestimento;

  // Sorting handlers
  const handleSortDfd = (key: keyof DFD | 'valor_anualizado') => {
    if (dfdSortKey === key) {
      setDfdSortDir(dfdSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setDfdSortKey(key);
      setDfdSortDir('asc');
    }
  };

  const handleSortPlan = (key: string) => {
    if (planSortKey === key) {
      setPlanSortDir(planSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setPlanSortKey(key);
      setPlanSortDir('asc');
    }
  };

  const handleSortContract = (key: keyof Contrato | 'valor_anual_sof') => {
    if (contractSortKey === key) {
      setContractSortDir(contractSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setContractSortKey(key);
      setContractSortDir('asc');
    }
  };

  // Sort processed items
  const sortedDFDs = [...baseProcessedDFDs].sort((a, b) => {
    let valA = a[dfdSortKey as keyof typeof a] ?? '';
    let valB = b[dfdSortKey as keyof typeof b] ?? '';

    if (typeof valA === 'string' && typeof valB === 'string') {
      return dfdSortDir === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    } else {
      const numA = Number(valA);
      const numB = Number(valB);
      return dfdSortDir === 'asc' ? numA - numB : numB - numA;
    }
  });

  const sortedPlanejamentos = [...processedPlanejamentos].sort((a, b) => {
    let valA = a[planSortKey as keyof typeof a] ?? '';
    let valB = b[planSortKey as keyof typeof b] ?? '';

    let res = 0;
    if (typeof valA === 'string' && typeof valB === 'string') {
      res = planSortDir === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    } else {
      const numA = Number(valA);
      const numB = Number(valB);
      res = planSortDir === 'asc' ? numA - numB : numB - numA;
    }

    if (res !== 0) return res;
    return (a.id || '').localeCompare(b.id || '');
  });

  const subtotalDFDsOnly = baseProcessedDFDs
    .filter(d => d.Contabilizar_Orcamento !== false)
    .reduce((acc, curr) => acc + curr.valor_anualizado, 0);

  const subtotalPlanejamentosOnly = processedPlanejamentos
    .filter(p => p.Contabilizar_Orcamento !== false)
    .reduce((acc, curr) => acc + curr.valor_anualizado, 0);

  const sortedContracts = [...processedContracts].sort((a, b) => {
    let valA = a[contractSortKey as keyof typeof a] ?? '';
    let valB = b[contractSortKey as keyof typeof b] ?? '';

    if (typeof valA === 'string' && typeof valB === 'string') {
      return contractSortDir === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    } else {
      const numA = Number(valA);
      const numB = Number(valB);
      return contractSortDir === 'asc' ? numA - numB : numB - numA;
    }
  });

  // --- SPREADSHEET PROJECTION METHODS ---

  const initSpreadsheet = async () => {
    setIsLoadingSpreadsheet(true);
    setIsSpreadsheetOpen(true);
    let loadedItems: any[] = [];
    try {
      const docRef = doc(db, 'projectionSpreadsheets', `projection_${selectedYear}`);
      const snap = await getDoc(docRef);
      
      if (snap.exists()) {
        const data = snap.data();
        if (data.unidade) setSpreadsheetUnidade(data.unidade);
        if (data.acao) setSpreadsheetAcao(data.acao);
        if (data.po) setSpreadsheetPO(data.po);
        if (data.items && Array.isArray(data.items)) {
          loadedItems = data.items;
        }
      }
    } catch (err) {
      console.error("Erro ao buscar dados do Firestore, usando local:", err);
    }

    if (loadedItems.length === 0) {
      // Fallback to local storage
      const saved = localStorage.getItem(`contratics_projection_${selectedYear}`);
      if (saved) {
        loadedItems = JSON.parse(saved);
      }
    }

    const targetYearInt = Number(selectedYear === 'Todos' ? currentYear : selectedYear) || 2026;

    if (loadedItems.length > 0) {
      // Automatically synchronize loaded items with simulateRenewals state & processed contracts/DFDs
      const activeContractIds = new Set(processedContracts.map(c => String(c.id)));
      const activeDfdIds = new Set(processedDFDs.map(d => String(d.id)));

      const updatedItems: any[] = [];
      const matchedContractIds = new Set<string>();
      const matchedDfdIds = new Set<string>();

      loadedItems.forEach(item => {
        let matched = false;

        // Try to match as a Contract
        let isContract = false;
        let cId = '';
        
        if (item.id && item.id.startsWith('c_')) {
          isContract = true;
          const match = item.id.match(/^c_(.+)_(\d+)$/);
          cId = match ? match[1] : item.id.split('_')[1];
        } else if (item.tipoDemanda === 'Contrato Vigente/TED' || (item.numContrato && item.numContrato !== '-')) {
          isContract = true;
          const found = processedContracts.find(contract => contract.Num_Contrato === item.numContrato || String(contract.id) === item.numContrato);
          if (found) {
            cId = String(found.id);
          }
        }

        if (isContract && cId) {
          const c = processedContracts.find(contract => String(contract.id) === cId);
          if (c) {
            const fornObj = fornecedores.find(f => f.id === c.Fornecedor);
            const fornName = fornObj ? fornObj.Nome_Fornecedor : c.Fornecedor || '';

            // Calculate simulated vigenciaFim
            const prorrogaMeses = (aditivos || [])
              .filter(ad => (ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
              .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
            const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(c.Numero_Renovacoes) || 0);

            let endVal = new Date(c.Vigencia_Inicio);
            endVal.setUTCMonth(endVal.getUTCMonth() + (Number(c.Vigencia_Inicial_Meses) || 12) + totalRenovacaoMeses);

            const canBeRenewed = checkIfContractCanBeRenewed(c);
            let finalEndDate: Date;
            if (simulateRenewals && canBeRenewed) {
              finalEndDate = getSimulatedContractEndDate(c, endVal);
            } else {
              finalEndDate = c.Vigencia_Final ? new Date(c.Vigencia_Final) : endVal;
            }
            const vigFim = finalEndDate.toISOString().split('T')[0];

            // Re-calculate simulated SOF value
            const simulatedVal = getContractSOFValueForYearLocal(c, targetYearInt);

            updatedItems.push({
              ...item,
              id: item.id || `c_${c.id}_${item.item || '1'}`,
              vigenciaFim: vigFim,
              gastoEstimado: simulatedVal,
              valorGlobal: c.Valor_Atualizado || c.Valor_Contrato || 0,
              empresaContratada: fornName,
              objetoResumido: c.Objeto || '',
              tipoDemanda: 'Contrato Vigente/TED',
              observacao: item.observacao || (c as any).Observacao || (c as any).Observacoes || 'Contrato Vigente'
            });
            matchedContractIds.add(cId);
            matched = true;
          }
        }

        // Try to match as a DFD (if not matched as contract)
        if (!matched) {
          let isDfd = false;
          let dId = '';

          if (item.id && item.id.startsWith('dfd_')) {
            isDfd = true;
            const match = item.id.match(/^dfd_(.+)_(\d+)$/);
            dId = match ? match[1] : item.id.split('_')[1];
          } else if (item.tipoDemanda === 'Nova Contratação/Novo TED' || (item.processoSei && item.processoSei !== '-')) {
            isDfd = true;
            const found = processedDFDs.find(dfd => dfd.Planejamento_Vinculado === item.processoSei || dfd.Descricao_Objeto === item.objetoResumido);
            if (found) {
              dId = String(found.id);
            }
          }

          if (isDfd && dId) {
            const d = processedDFDs.find(dfd => String(dfd.id) === dId);
            if (d) {
              matchedDfdIds.add(dId);
              matched = true;
              if (d.Contabilizar_Orcamento !== false) {
                const baseGlobalValue = d.Valor_Customizado !== undefined && d.Valor_Customizado !== null ? d.Valor_Customizado : (d.Valor_Estimado || 0);
                const simulatedVal = d.valor_anualizado || 0;
                updatedItems.push({
                  ...item,
                  id: item.id || `dfd_${d.id}_${item.item || '1'}`,
                  gastoEstimado: simulatedVal,
                  valorGlobal: baseGlobalValue,
                  objetoResumido: d.Descricao_Objeto || '',
                  tipoDemanda: 'Nova Contratação/Novo TED',
                  observacao: item.observacao || (d as any).observacoes_planejamento || 'Nova Contratação/TED'
                });
              }
            }
          }
        }

        // If not matched, keep as is
        if (!matched) {
          updatedItems.push(item);
        }
      });

      // Now add any NEW active contracts that weren't in loadedItems
      let counter = Math.max(...updatedItems.map(item => parseInt(item.item) || 1), loadedItems.length) + 1;
      
      processedContracts.forEach(c => {
        if (!matchedContractIds.has(String(c.id))) {
          const fornObj = fornecedores.find(f => f.id === c.Fornecedor);
          const fornName = fornObj ? fornObj.Nome_Fornecedor : c.Fornecedor || '';
          
          const activeItems = (itensSOF || []).filter(i => 
            (i.Num_Contrato === c.id || i.Num_Contrato === c.Num_Contrato) && 
            i.Status_Item === 'Ativo'
          );
          const hasInvestimento = activeItems.some(i => i.Natureza_Despesa === 'Investimento');
          const gnd = hasInvestimento ? '4 - Investimento' : '3 - Custeio';

          const prorrogaMeses = (aditivos || [])
            .filter(ad => (ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
            .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
          const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(c.Numero_Renovacoes) || 0);

          let endVal = new Date(c.Vigencia_Inicio);
          endVal.setUTCMonth(endVal.getUTCMonth() + (Number(c.Vigencia_Inicial_Meses) || 12) + totalRenovacaoMeses);

          const canBeRenewed = checkIfContractCanBeRenewed(c);
          let finalEndDate: Date;
          if (simulateRenewals && canBeRenewed) {
            finalEndDate = getSimulatedContractEndDate(c, endVal);
          } else {
            finalEndDate = c.Vigencia_Final ? new Date(c.Vigencia_Final) : endVal;
          }
          const vigFim = finalEndDate.toISOString().split('T')[0];
          const simulatedVal = getContractSOFValueForYearLocal(c, targetYearInt);

          updatedItems.push({
            id: `c_${c.id}_${counter}`,
            item: String(counter++).padStart(2, '0'),
            tipoDemanda: 'Contrato Vigente/TED',
            processoSei: c.SEI_Processo || '',
            numContrato: c.Num_Contrato || '',
            objetoResumido: c.Objeto || '',
            empresaContratada: fornName,
            vigenciaInicio: c.Vigencia_Inicio ? c.Vigencia_Inicio.split('T')[0] : '',
            vigenciaFim: vigFim,
            gnd: gnd,
            valorGlobal: c.Valor_Atualizado || c.Valor_Contrato || 0,
            mesReajuste: c.Mes_Reajuste || '',
            indiceReajuste: c.Indice_Reajuste || 'Sem Reajuste',
            gastoEstimado: simulatedVal,
            observacao: (c as any).Observacao || (c as any).Observacoes || 'Contrato Vigente'
          });
        }
      });

      // Add any NEW DFDs that weren't in loadedItems
      processedDFDs.forEach(d => {
        if (d.Contabilizar_Orcamento === false) return; // Skip deactivated DFDs
        if (!matchedDfdIds.has(String(d.id))) {
          const isInvest = d.Valor_Investimento > 0 && d.Valor_Custeio === 0;
          const gnd = isInvest ? '4 - Investimento' : '3 - Custeio';
          const vInicio = d.Data_conclusao_estimada ? d.Data_conclusao_estimada.split('T')[0] : '';
          const vFim = d.Periodicidade_Pagamento === 'Total' ? vInicio : '';

          const baseGlobalValue = d.Valor_Customizado !== undefined && d.Valor_Customizado !== null ? d.Valor_Customizado : (d.Valor_Estimado || 0);

          updatedItems.push({
            id: `dfd_${d.id}_${counter}`,
            item: String(counter++).padStart(2, '0'),
            tipoDemanda: 'Nova Contratação/Novo TED',
            processoSei: d.Planejamento_Vinculado || '',
            numContrato: '-',
            objetoResumido: d.Descricao_Objeto || '',
            empresaContratada: (d as any).isPlanejamentoProcess ? 'Licitação em Andamento' : 'Nova Contratação (A Planejar)',
            vigenciaInicio: vInicio,
            vigenciaFim: vFim,
            gnd: gnd,
            valorGlobal: baseGlobalValue,
            mesReajuste: '',
            indiceReajuste: 'Sem Reajuste',
            gastoEstimado: d.valor_anualizado || 0,
            observacao: (d as any).observacoes_planejamento || 'Nova Contratação/TED'
          });
        }
      });

      // Sort: Contracts first, then everything else (DFDs and manually entered items)
      const sortedAndNumbered = updatedItems
        .sort((a, b) => {
          const idA = String(a.id || '');
          const idB = String(b.id || '');
          const typeA = String(a.tipoDemanda || '').toLowerCase();
          const typeB = String(b.tipoDemanda || '').toLowerCase();
          
          const isContA = idA.startsWith('c_') || typeA.includes('contrato');
          const isContB = idB.startsWith('c_') || typeB.includes('contrato');
          
          if (isContA && !isContB) return -1;
          if (!isContA && isContB) return 1;
          return 0;
        })
        .map((item, idx) => ({
          ...item,
          item: String(idx + 1).padStart(2, '0')
        }));

      setSpreadsheetItems(sortedAndNumbered);
      localStorage.setItem(`contratics_projection_${selectedYear}`, JSON.stringify(sortedAndNumbered));
      setIsLoadingSpreadsheet(false);
      return;
    }

    // Generate initial items from active contracts and DFDs if no saved sheet exists
    const items: any[] = [];
    let counter = 1;

    processedContracts.forEach((c) => {
      const fornObj = fornecedores.find(f => f.id === c.Fornecedor);
      const fornName = fornObj ? fornObj.Nome_Fornecedor : c.Fornecedor || '';
      
      const activeItems = (itensSOF || []).filter(i => 
        (i.Num_Contrato === c.id || i.Num_Contrato === c.Num_Contrato) && 
        i.Status_Item === 'Ativo'
      );
      const hasInvestimento = activeItems.some(i => i.Natureza_Despesa === 'Investimento');
      const gnd = hasInvestimento ? '4 - Investimento' : '3 - Custeio';

      // Calculate simulated vigenciaFim
      const prorrogaMeses = (aditivos || [])
        .filter(ad => (ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
        .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
      const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(c.Numero_Renovacoes) || 0);

      let endVal = new Date(c.Vigencia_Inicio);
      endVal.setUTCMonth(endVal.getUTCMonth() + (Number(c.Vigencia_Inicial_Meses) || 12) + totalRenovacaoMeses);

      const canBeRenewed = checkIfContractCanBeRenewed(c);
      let finalEndDate: Date;
      if (simulateRenewals && canBeRenewed) {
        finalEndDate = getSimulatedContractEndDate(c, endVal);
      } else {
        finalEndDate = c.Vigencia_Final ? new Date(c.Vigencia_Final) : endVal;
      }
      const vigFim = finalEndDate.toISOString().split('T')[0];
      const simulatedVal = getContractSOFValueForYearLocal(c, targetYearInt);

      items.push({
        id: `c_${c.id}_${counter}`,
        item: String(counter++).padStart(2, '0'),
        tipoDemanda: 'Contrato Vigente/TED',
        processoSei: c.SEI_Processo || '',
        numContrato: c.Num_Contrato || '',
        objetoResumido: c.Objeto || '',
        empresaContratada: fornName,
        vigenciaInicio: c.Vigencia_Inicio ? c.Vigencia_Inicio.split('T')[0] : '',
        vigenciaFim: vigFim,
        gnd: gnd,
        valorGlobal: c.Valor_Atualizado || c.Valor_Contrato || 0,
        mesReajuste: c.Mes_Reajuste || '',
        indiceReajuste: c.Indice_Reajuste || 'Sem Reajuste',
        gastoEstimado: simulatedVal,
        observacao: (c as any).Observacao || (c as any).Observacoes || 'Contrato Vigente'
      });
    });

    processedDFDs.forEach((d) => {
      if (d.Contabilizar_Orcamento === false) return; // Skip deactivated DFDs
      const isInvest = d.Valor_Investimento > 0 && d.Valor_Custeio === 0;
      const gnd = isInvest ? '4 - Investimento' : '3 - Custeio';
      const vInicio = d.Data_conclusao_estimada ? d.Data_conclusao_estimada.split('T')[0] : '';
      const vFim = d.Periodicidade_Pagamento === 'Total' ? vInicio : '';

      const baseGlobalValue = d.Valor_Customizado !== undefined && d.Valor_Customizado !== null ? d.Valor_Customizado : (d.Valor_Estimado || 0);

      items.push({
        id: `dfd_${d.id}_${counter}`,
        item: String(counter++).padStart(2, '0'),
        tipoDemanda: 'Nova Contratação/Novo TED',
        processoSei: d.Planejamento_Vinculado || '',
        numContrato: '-',
        objetoResumido: d.Descricao_Objeto || '',
        empresaContratada: (d as any).isPlanejamentoProcess ? 'Licitação em Andamento' : 'Nova Contratação (A Planejar)',
        vigenciaInicio: vInicio,
        vigenciaFim: vFim,
        gnd: gnd,
        valorGlobal: baseGlobalValue,
        mesReajuste: '',
        indiceReajuste: 'Sem Reajuste',
        gastoEstimado: d.valor_anualizado || 0,
        observacao: (d as any).observacoes_planejamento || 'Nova Contratação/TED'
      });
    });

    processedPlanejamentos.forEach((p) => {
      if (p.Contabilizar_Orcamento === false) return; // Skip deactivated planning
      const isInvest = p.Natureza_Despesa === 'Investimento' || (p.Valor_Investimento > 0 && p.Valor_Custeio === 0);
      const gnd = isInvest ? '4 - Investimento' : '3 - Custeio';
      const vInicio = p.data_inicio_efetiva || (p.Data_conclusao_estimada ? p.Data_conclusao_estimada.split('T')[0] : '');
      const vFim = p.Periodicidade_Pagamento === 'Total' ? vInicio : '';

      const baseGlobalValue = p.Valor_Customizado !== undefined && p.Valor_Customizado !== null ? p.Valor_Customizado : (p.Valor_Estimado || 0);

      items.push({
        id: `plan_${p.id || p.SEI_Processo}_${counter}`,
        item: String(counter++).padStart(2, '0'),
        tipoDemanda: 'Processo de Planejamento/Licitação',
        processoSei: p.SEI_Processo || p.Num_DFD || '',
        numContrato: '-',
        objetoResumido: p.Objeto || p.Descricao_Objeto || '',
        empresaContratada: 'Licitação em Andamento (A Definir)',
        vigenciaInicio: vInicio,
        vigenciaFim: vFim,
        gnd: gnd,
        valorGlobal: baseGlobalValue,
        mesReajuste: '',
        indiceReajuste: 'Sem Reajuste',
        gastoEstimado: p.valor_anualizado || 0,
        observacao: p.observacoes_planejamento || 'Processo de Planejamento SEI'
      });
    });

    // Sort: Contracts first, then everything else (DFDs and manually entered items)
    const sortedAndNumbered = items
      .sort((a, b) => {
        const idA = String(a.id || '');
        const idB = String(b.id || '');
        const typeA = String(a.tipoDemanda || '').toLowerCase();
        const typeB = String(b.tipoDemanda || '').toLowerCase();
        
        const isContA = idA.startsWith('c_') || typeA.includes('contrato');
        const isContB = idB.startsWith('c_') || typeB.includes('contrato');
        
        if (isContA && !isContB) return -1;
        if (!isContA && isContB) return 1;
        return 0;
      })
      .map((item, idx) => ({
        ...item,
        item: String(idx + 1).padStart(2, '0')
      }));

    setSpreadsheetItems(sortedAndNumbered);
    localStorage.setItem(`contratics_projection_${selectedYear}`, JSON.stringify(sortedAndNumbered));
    setIsLoadingSpreadsheet(false);
  };

  const updateSpreadsheetItem = (id: string, field: string, value: any) => {
    setSpreadsheetItems(prev => {
      const updated = prev.map(item => {
        if (item.id !== id) return item;

        const newItem = { ...item, [field]: value };

        // Real-time calculation of Gasto Estimado when key parameters change
        if (['tipoDemanda', 'vigenciaInicio', 'vigenciaFim', 'valorGlobal', 'mesReajuste', 'indiceReajuste'].includes(field)) {
          let reajusteRate = 0;
          if (newItem.indiceReajuste && newItem.indiceReajuste !== 'Sem Reajuste') {
            const matched = newItem.indiceReajuste.match(/([\d.,]+)\s*%/);
            if (matched) {
              reajusteRate = parseFloat(matched[1].replace(',', '.')) / 100;
            } else {
              const parsedNum = parseFloat(newItem.indiceReajuste.replace(/[^\d.,]/g, '').replace(',', '.'));
              if (!isNaN(parsedNum)) {
                reajusteRate = parsedNum / 100;
              }
            }
          }

          const year = Number(selectedYear === 'Todos' ? currentYear : selectedYear) || 2026;
          let baseAnnual = newItem.valorGlobal;

          if (newItem.tipoDemanda === 'Contrato Vigente/TED') {
            const cId = newItem.id.split('_')[1];
            const orig = contratos.find(c => c.id === cId || c.Num_Contrato === newItem.numContrato);
            if (orig) {
              baseAnnual = getContractSOFValueForYearLocal(orig, year);
            } else {
              if (newItem.vigenciaInicio && newItem.vigenciaFim) {
                const sDate = new Date(newItem.vigenciaInicio);
                const eDate = new Date(newItem.vigenciaFim);
                const yearStart = new Date(Date.UTC(year, 0, 1));
                const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
                
                if (sDate <= yearEnd && eDate >= yearStart) {
                  const activeStart = sDate > yearStart ? sDate : yearStart;
                  const activeEnd = eDate < yearEnd ? eDate : yearEnd;
                  const activeMonths = Math.max(0, (activeEnd.getUTCFullYear() - activeStart.getUTCFullYear()) * 12 + (activeEnd.getUTCMonth() - activeStart.getUTCMonth()) + 1);
                  baseAnnual = (newItem.valorGlobal / 12) * activeMonths;
                } else {
                  baseAnnual = 0;
                }
              }
            }
          } else {
            if (newItem.vigenciaInicio && newItem.vigenciaFim) {
              const sDate = new Date(newItem.vigenciaInicio);
              const eDate = new Date(newItem.vigenciaFim);
              const yearStart = new Date(Date.UTC(year, 0, 1));
              const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
              
              if (sDate <= yearEnd && eDate >= yearStart) {
                if (newItem.vigenciaInicio === newItem.vigenciaFim) {
                  // One-off/Pontual Acquisition (e.g., buying computers)
                  baseAnnual = sDate.getUTCFullYear() === year ? newItem.valorGlobal : 0;
                } else {
                  // Continuous service/subscription with a defined range
                  const activeStart = sDate > yearStart ? sDate : yearStart;
                  const activeEnd = eDate < yearEnd ? eDate : yearEnd;
                  const activeMonths = Math.max(0, (activeEnd.getUTCFullYear() - activeStart.getUTCFullYear()) * 12 + (activeEnd.getUTCMonth() - activeStart.getUTCMonth()) + 1);
                  baseAnnual = (newItem.valorGlobal / 12) * activeMonths;
                }
              } else {
                baseAnnual = 0;
              }
            } else if (newItem.vigenciaInicio) {
              // Indefinite continuous service (no end date)
              const sDate = new Date(newItem.vigenciaInicio);
              const yearStart = new Date(Date.UTC(year, 0, 1));
              const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
              
              if (sDate <= yearEnd) {
                const activeStart = sDate > yearStart ? sDate : yearStart;
                const activeMonths = 12 - activeStart.getUTCMonth();
                baseAnnual = (newItem.valorGlobal / 12) * activeMonths;
              } else {
                baseAnnual = 0;
              }
            }
          }

          if (reajusteRate > 0 && newItem.mesReajuste) {
            const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            const rMonthIdx = months.indexOf(newItem.mesReajuste);
            if (rMonthIdx !== -1) {
              let startMonth = 0;
              let endMonth = 11;
              if (newItem.vigenciaInicio) {
                const sDate = new Date(newItem.vigenciaInicio);
                if (sDate.getUTCFullYear() === year) startMonth = sDate.getUTCMonth();
              }
              if (newItem.vigenciaFim) {
                const eDate = new Date(newItem.vigenciaFim);
                if (eDate.getUTCFullYear() === year) endMonth = eDate.getUTCMonth();
              }
              const activeCount = Math.max(0, endMonth - startMonth + 1);
              if (activeCount > 0) {
                const baseMonthly = baseAnnual / activeCount;
                let adjustedTotal = 0;
                for (let m = startMonth; m <= endMonth; m++) {
                  if (m >= rMonthIdx) {
                    adjustedTotal += baseMonthly * (1 + reajusteRate);
                  } else {
                    adjustedTotal += baseMonthly;
                  }
                }
                newItem.gastoEstimado = adjustedTotal;
              } else {
                newItem.gastoEstimado = baseAnnual;
              }
            } else {
              newItem.gastoEstimado = baseAnnual;
            }
          } else {
            newItem.gastoEstimado = baseAnnual;
          }
        }

        return newItem;
      });

      localStorage.setItem(`contratics_projection_${selectedYear}`, JSON.stringify(updated));
      return updated;
    });
  };

  const addSpreadsheetRow = () => {
    setSpreadsheetItems(prev => {
      const nextNum = prev.length + 1;
      const newItem = {
        id: `manual_${Date.now()}`,
        item: String(nextNum).padStart(2, '0'),
        tipoDemanda: 'Nova Contratação/Novo TED',
        processoSei: '',
        numContrato: '',
        objetoResumido: 'Nova Demanda Planejada',
        empresaContratada: '',
        vigenciaInicio: '',
        vigenciaFim: '',
        gnd: '3 - Custeio',
        valorGlobal: 0,
        mesReajuste: '',
        indiceReajuste: 'Sem Reajuste',
        gastoEstimado: 0,
        observacao: 'Nova Demanda Planejada',
        isManual: true
      };
      const updated = [...prev, newItem];
      localStorage.setItem(`contratics_projection_${selectedYear}`, JSON.stringify(updated));
      return updated;
    });
  };

  const deleteSpreadsheetRow = (id: string) => {
    setSpreadsheetItems(prev => {
      const filtered = prev.filter(item => item.id !== id);
      const updated = filtered.map((item, idx) => ({
        ...item,
        item: String(idx + 1).padStart(2, '0')
      }));
      localStorage.setItem(`contratics_projection_${selectedYear}`, JSON.stringify(updated));
      return updated;
    });
  };

  const saveSpreadsheetToFirestore = async () => {
    setIsSavingSpreadsheet(true);
    try {
      await setDoc(doc(db, 'projectionSpreadsheets', `projection_${selectedYear}`), {
        unidade: spreadsheetUnidade,
        acao: spreadsheetAcao,
        po: spreadsheetPO,
        year: selectedYear,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.name || currentUser?.email || 'Usuário',
        items: spreadsheetItems
      });
      alert("Planilha salva com sucesso no Firestore (Durable Cloud Storage)!");
    } catch (err: any) {
      console.error(err);
      alert("Erro ao salvar planilha no Firestore: " + err.message);
    } finally {
      setIsSavingSpreadsheet(false);
    }
  };

  const resetSpreadsheet = () => {
    if (window.confirm("Deseja realmente redefinir todos os valores da planilha para os dados oficiais de contratos e DFDs do sistema? Todas as alterações manuais serão perdidas.")) {
      localStorage.removeItem(`contratics_projection_${selectedYear}`);
      
      const items: any[] = [];
      let counter = 1;

      processedContracts.forEach((c) => {
        const fornObj = fornecedores.find(f => f.id === c.Fornecedor);
        const fornName = fornObj ? fornObj.Nome_Fornecedor : c.Fornecedor || '';
        
        const activeItems = (itensSOF || []).filter(i => 
          (i.Num_Contrato === c.id || i.Num_Contrato === c.Num_Contrato) && 
          i.Status_Item === 'Ativo'
        );
        const hasInvestimento = activeItems.some(i => i.Natureza_Despesa === 'Investimento');
        const gnd = hasInvestimento ? '4 - Investimento' : '3 - Custeio';

        // Calculate simulated vigenciaFim
        const prorrogaMeses = (aditivos || [])
          .filter(ad => (ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
          .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
        const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(c.Numero_Renovacoes) || 0);

        let endVal = new Date(c.Vigencia_Inicio);
        endVal.setUTCMonth(endVal.getUTCMonth() + (Number(c.Vigencia_Inicial_Meses) || 12) + totalRenovacaoMeses);

        const canBeRenewed = checkIfContractCanBeRenewed(c);
        let finalEndDate: Date;
        if (simulateRenewals && canBeRenewed) {
          finalEndDate = getSimulatedContractEndDate(c, endVal);
        } else {
          finalEndDate = c.Vigencia_Final ? new Date(c.Vigencia_Final) : endVal;
        }
        const vigFim = finalEndDate.toISOString().split('T')[0];

        items.push({
          id: `c_${c.id}_${counter}`,
          item: String(counter++).padStart(2, '0'),
          tipoDemanda: 'Contrato Vigente/TED',
          processoSei: c.SEI_Processo || '',
          numContrato: c.Num_Contrato || '',
          objetoResumido: c.Objeto || '',
          empresaContratada: fornName,
          vigenciaInicio: c.Vigencia_Inicio ? c.Vigencia_Inicio.split('T')[0] : '',
          vigenciaFim: vigFim,
          gnd: gnd,
          valorGlobal: c.Valor_Atualizado || c.Valor_Contrato || 0,
          mesReajuste: c.Mes_Reajuste || '',
          indiceReajuste: c.Indice_Reajuste || 'Sem Reajuste',
          gastoEstimado: c.valor_anual_sof || 0
        });
      });

      processedDFDs.forEach((d) => {
        if (d.Contabilizar_Orcamento === false) return; // Skip deactivated DFDs
        const isInvest = d.Valor_Investimento > 0 && d.Valor_Custeio === 0;
        const gnd = isInvest ? '4 - Investimento' : '3 - Custeio';
        const vInicio = d.Data_conclusao_estimada ? d.Data_conclusao_estimada.split('T')[0] : '';
        const vFim = d.Periodicidade_Pagamento === 'Total' ? vInicio : '';

        const baseGlobalValue = d.Valor_Customizado !== undefined && d.Valor_Customizado !== null ? d.Valor_Customizado : (d.Valor_Estimado || 0);

        items.push({
          id: `dfd_${d.id}_${counter}`,
          item: String(counter++).padStart(2, '0'),
          tipoDemanda: 'Nova Contratação/Novo TED',
          processoSei: d.Planejamento_Vinculado || '',
          numContrato: '-',
          objetoResumido: d.Descricao_Objeto || '',
          empresaContratada: 'Nova Contratação (A Planejar)',
          vigenciaInicio: vInicio,
          vigenciaFim: vFim,
          gnd: gnd,
          valorGlobal: baseGlobalValue,
          mesReajuste: '',
          indiceReajuste: 'Sem Reajuste',
          gastoEstimado: d.valor_anualizado || 0,
          observacao: (d as any).observacoes_planejamento || 'Nova Contratação/TED'
        });
      });

      processedPlanejamentos.forEach((p) => {
        if (p.Contabilizar_Orcamento === false) return; // Skip deactivated planning
        const isInvest = p.Natureza_Despesa === 'Investimento' || (p.Valor_Investimento > 0 && p.Valor_Custeio === 0);
        const gnd = isInvest ? '4 - Investimento' : '3 - Custeio';
        const vInicio = p.data_inicio_efetiva || (p.Data_conclusao_estimada ? p.Data_conclusao_estimada.split('T')[0] : '');
        const vFim = p.Periodicidade_Pagamento === 'Total' ? vInicio : '';

        const baseGlobalValue = p.Valor_Customizado !== undefined && p.Valor_Customizado !== null ? p.Valor_Customizado : (p.Valor_Estimado || 0);

        items.push({
          id: `plan_${p.id || p.SEI_Processo}_${counter}`,
          item: String(counter++).padStart(2, '0'),
          tipoDemanda: 'Processo de Planejamento/Licitação',
          processoSei: p.SEI_Processo || p.Num_DFD || '',
          numContrato: '-',
          objetoResumido: p.Objeto || p.Descricao_Objeto || '',
          empresaContratada: 'Licitação em Andamento (A Definir)',
          vigenciaInicio: vInicio,
          vigenciaFim: vFim,
          gnd: gnd,
          valorGlobal: baseGlobalValue,
          mesReajuste: '',
          indiceReajuste: 'Sem Reajuste',
          gastoEstimado: p.valor_anualizado || 0,
          observacao: p.observacoes_planejamento || 'Processo de Planejamento SEI'
        });
      });

      setSpreadsheetItems(items);
      localStorage.setItem(`contratics_projection_${selectedYear}`, JSON.stringify(items));
    }
  };

  const exportSpreadsheetToCSV = () => {
    const yearLabel = selectedYear === 'Todos' ? currentYear : selectedYear;
    
    const formatDateExcel = (dateStr: string) => {
      if (!dateStr || dateStr === '-' || dateStr === '—') return '-';
      const formatted = formatDate(dateStr);
      return formatted === '—' ? '-' : formatted;
    };
    
    // Sums
    const totalGlobal = spreadsheetItems.reduce((acc, curr) => acc + (Number(curr.valorGlobal) || 0), 0);
    const totalEstimado = spreadsheetItems.reduce((acc, curr) => acc + (Number(curr.gastoEstimado) || 0), 0);

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Levantamento Projecao</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #000000;
          }
          table {
            border-collapse: collapse;
          }
          td, th {
            border: 0.5pt solid #8faadc;
            padding: 8px 10px;
            font-size: 10pt;
            vertical-align: middle;
          }
          .title-cell {
            background-color: #1f4e78;
            color: #ffffff;
            font-weight: bold;
            font-size: 13pt;
            text-align: center;
            height: 40px;
            border: 0.5pt solid #1f4e78;
          }
          .meta-label {
            background-color: #d9e1f2;
            color: #1f4e78;
            font-weight: bold;
            font-size: 10pt;
            text-align: left;
            border: 0.5pt solid #8faadc;
          }
          .meta-value {
            background-color: #d9e1f2;
            color: #000000;
            font-weight: 500;
            font-size: 10pt;
            text-align: left;
            border: 0.5pt solid #8faadc;
          }
          .header-cell {
            background-color: #2f5597;
            color: #ffffff;
            font-weight: bold;
            font-size: 10pt;
            text-align: center;
            height: 35px;
            border: 0.5pt solid #1f4e78;
          }
          .row-even {
            background-color: #f2f2f2;
          }
          .row-odd {
            background-color: #ffffff;
          }
          .text-center {
            text-align: center;
          }
          .text-right {
            text-align: right;
          }
          .text-left {
            text-align: left;
          }
          .total-label {
            background-color: #d9d9d9;
            color: #000000;
            font-weight: bold;
            font-size: 10pt;
            text-align: right;
            border: 1pt solid #7f7f7f;
          }
          .total-val-global {
            background-color: #d9d9d9;
            color: #000000;
            font-weight: bold;
            font-size: 10pt;
            text-align: right;
            border: 1pt solid #7f7f7f;
          }
          .total-val-estimado {
            background-color: #e2efda;
            color: #375623;
            font-weight: bold;
            font-size: 10pt;
            text-align: right;
            border: 1pt solid #375623;
          }
        </style>
      </head>
      <body>
        <table>
          <!-- Merged Title Block -->
          <tr>
            <td colspan="14" class="title-cell">
              LEVANTAMENTO DOS CONTRATOS VIGENTES E PROJEÇÃO DE CONTRATAÇÕES PARA ${yearLabel}
            </td>
          </tr>
          
          <!-- Spacers & Metadata -->
          <tr style="height: 15px;"><td colspan="14" style="border: none;"></td></tr>
          
          <tr>
            <td colspan="2" class="meta-label">Unidade Responsável:</td>
            <td colspan="12" class="meta-value">${spreadsheetUnidade}</td>
          </tr>
          <tr>
            <td colspan="2" class="meta-label">Ação Orçamentária:</td>
            <td colspan="12" class="meta-value">${spreadsheetAcao} - Sustentação da TI do Planejamento Nacional e do Orçamento Federal</td>
          </tr>
          <tr>
            <td colspan="2" class="meta-label">Plano Orçamentário (PO):</td>
            <td colspan="12" class="meta-value">${spreadsheetPO}</td>
          </tr>
          
          <tr style="height: 15px;"><td colspan="14" style="border: none;"></td></tr>
          
          <!-- Table Headers -->
          <tr>
            <th class="header-cell" style="width: 40px;">Item</th>
            <th class="header-cell" style="width: 150px;">Tipo da Demanda</th>
            <th class="header-cell" style="width: 120px;">Processo SEI</th>
            <th class="header-cell" style="width: 110px;">Nº do Contrato</th>
            <th class="header-cell" style="width: 250px;">Objeto Resumido</th>
            <th class="header-cell" style="width: 200px;">Empresa Contratada</th>
            <th class="header-cell" style="width: 100px;">Data Vigência Início</th>
            <th class="header-cell" style="width: 100px;">Data Vigência Fim</th>
            <th class="header-cell" style="width: 90px;">GND</th>
            <th class="header-cell" style="width: 120px;">Valor Global</th>
            <th class="header-cell" style="width: 110px;">Mês do Reajuste</th>
            <th class="header-cell" style="width: 150px;">Índice/Motivo do Reajuste</th>
            <th class="header-cell" style="width: 200px;">Observações</th>
            <th class="header-cell" style="width: 140px;">Gasto Estimado (${yearLabel})</th>
          </tr>
          
          <!-- Table Body Rows -->
          ${spreadsheetItems.map((item, index) => {
            const rowClass = index % 2 === 0 ? 'row-even' : 'row-odd';
            const escapedObjeto = (item.objetoResumido || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const escapedEmpresa = (item.empresaContratada || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const escapedObservacao = (item.observacao || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            return `
              <tr class="${rowClass}">
                <td class="text-center" style="mso-number-format:'\\@';">${item.item}</td>
                <td>${item.tipoDemanda || ''}</td>
                <td class="text-center" style="mso-number-format:'\\@';">${item.processoSei || '-'}</td>
                <td class="text-center" style="mso-number-format:'\\@';">${item.numContrato || '-'}</td>
                <td>${escapedObjeto}</td>
                <td>${escapedEmpresa}</td>
                <td class="text-center" style="mso-number-format:'dd\\/mm\\/yyyy';">${formatDateExcel(item.vigenciaInicio)}</td>
                <td class="text-center" style="mso-number-format:'dd\\/mm\\/yyyy';">${formatDateExcel(item.vigenciaFim)}</td>
                <td class="text-center">${item.gnd || ''}</td>
                <td class="text-right" style="mso-number-format:'\\R\\$\\ #\\,##0\\.00';">${(Number(item.valorGlobal) || 0).toFixed(2).replace('.', ',')}</td>
                <td class="text-center">${item.mesReajuste || '-'}</td>
                <td>${item.indiceReajuste || '-'}</td>
                <td>${escapedObservacao || '-'}</td>
                <td class="text-right" style="mso-number-format:'\\R\\$\\ #\\,##0\\.00'; font-weight: bold; color: #1f4e78;">${(Number(item.gastoEstimado) || 0).toFixed(2).replace('.', ',')}</td>
              </tr>
            `;
          }).join('')}
          
          <!-- Table Footer / Totals Row -->
          <tr>
            <td colspan="9" class="total-label">TOTAL GERAL:</td>
            <td class="total-val-global" style="mso-number-format:'\\R\\$\\ #\\,##0\\.00';">${(Number(totalGlobal) || 0).toFixed(2).replace('.', ',')}</td>
            <td colspan="3" class="total-label" style="background-color: #d9d9d9;"></td>
            <td class="total-val-estimado" style="mso-number-format:'\\R\\$\\ #\\,##0\\.00';">${(Number(totalEstimado) || 0).toFixed(2).replace('.', ',')}</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Download file with .xls extension
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Levantamento_Contratos_Projecao_${yearLabel}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- END SPREADSHEET PROJECTION METHODS ---

  const sortedSiopHistory = [...siopHistory].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  // Export PDF layout generator
  const exportToPDF = () => {
    const targetYear = selectedYear === 'Todos' ? '2026' : selectedYear;
    const docId = targetYear === '2026' ? '8861_2026' : `8861_${targetYear}`;
    
    // 1. Try finding in database records
    let foundRecord = siopRecords.find(r => r.id === docId);
    if (!foundRecord && targetYear === '2026') {
      foundRecord = siopRecords.find(r => r.id === '8861');
    }
    
    // 2. Try finding in history for this year/docId
    const filteredHistory = siopHistory && siopHistory.length > 0
      ? [...siopHistory].filter(h => h.id === docId || h.id === `8861_${targetYear}` || (targetYear === '2026' && (h.id === '8861' || h.id === '8861_2026'))).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      : [];
    const latestHistoryForYear = filteredHistory[0];
    
    // 3. Try finding in local storage fallback
    const savedFallback = localStorage.getItem(`contratics_siop_${docId}_fallback`) || (targetYear === '2026' ? localStorage.getItem(`contratics_siop_8861_fallback`) : null);
    const fallbackObj = savedFallback ? JSON.parse(savedFallback) : null;
    
    const baseRecord = foundRecord || latestHistoryForYear || fallbackObj || {
      id: docId,
      dotacaoInicial: 0,
      dotacaoAtual: 0,
      empenhado: 0,
      liquidado: 0,
      pago: 0,
      updatedAt: '',
      dotacaoInicialCusteio: 0,
      dotacaoAtualCusteio: 0,
      empenhadoCusteio: 0,
      liquidadoCusteio: 0,
      pagoCusteio: 0,
      dotacaoInicialInvestimento: 0,
      dotacaoAtualInvestimento: 0,
      empenhadoInvestimento: 0,
      liquidadoInvestimento: 0,
      pagoInvestimento: 0
    };

    const record = {
      ...baseRecord,
      dotacaoInicialCusteio: baseRecord.dotacaoInicialCusteio !== undefined && baseRecord.dotacaoInicialCusteio !== null ? baseRecord.dotacaoInicialCusteio : (latestHistoryForYear?.dotacaoInicialCusteio ?? fallbackObj?.dotacaoInicialCusteio ?? undefined),
      dotacaoAtualCusteio: baseRecord.dotacaoAtualCusteio !== undefined && baseRecord.dotacaoAtualCusteio !== null ? baseRecord.dotacaoAtualCusteio : (latestHistoryForYear?.dotacaoAtualCusteio ?? fallbackObj?.dotacaoAtualCusteio ?? undefined),
      empenhadoCusteio: baseRecord.empenhadoCusteio !== undefined && baseRecord.empenhadoCusteio !== null ? baseRecord.empenhadoCusteio : (latestHistoryForYear?.empenhadoCusteio ?? fallbackObj?.empenhadoCusteio ?? undefined),
      liquidadoCusteio: baseRecord.liquidadoCusteio !== undefined && baseRecord.liquidadoCusteio !== null ? baseRecord.liquidadoCusteio : (latestHistoryForYear?.liquidadoCusteio ?? fallbackObj?.liquidadoCusteio ?? undefined),
      pagoCusteio: baseRecord.pagoCusteio !== undefined && baseRecord.pagoCusteio !== null ? baseRecord.pagoCusteio : (latestHistoryForYear?.pagoCusteio ?? fallbackObj?.pagoCusteio ?? undefined),
      
      dotacaoInicialInvestimento: baseRecord.dotacaoInicialInvestimento !== undefined && baseRecord.dotacaoInicialInvestimento !== null ? baseRecord.dotacaoInicialInvestimento : (latestHistoryForYear?.dotacaoInicialInvestimento ?? fallbackObj?.dotacaoInicialInvestimento ?? undefined),
      dotacaoAtualInvestimento: baseRecord.dotacaoAtualInvestimento !== undefined && baseRecord.dotacaoAtualInvestimento !== null ? baseRecord.dotacaoAtualInvestimento : (latestHistoryForYear?.dotacaoAtualInvestimento ?? fallbackObj?.dotacaoAtualInvestimento ?? undefined),
      empenhadoInvestimento: baseRecord.empenhadoInvestimento !== undefined && baseRecord.empenhadoInvestimento !== null ? baseRecord.empenhadoInvestimento : (latestHistoryForYear?.empenhadoInvestimento ?? fallbackObj?.empenhadoInvestimento ?? undefined),
      liquidadoInvestimento: baseRecord.liquidadoInvestimento !== undefined && baseRecord.liquidadoInvestimento !== null ? baseRecord.liquidadoInvestimento : (latestHistoryForYear?.liquidadoInvestimento ?? fallbackObj?.liquidadoInvestimento ?? undefined),
      pagoInvestimento: baseRecord.pagoInvestimento !== undefined && baseRecord.pagoInvestimento !== null ? baseRecord.pagoInvestimento : (latestHistoryForYear?.pagoInvestimento ?? fallbackObj?.pagoInvestimento ?? undefined),
    };

    // If segregated fields exist, compute the totals dynamically so they are always in perfect sync
    if (record.dotacaoInicialCusteio !== undefined || record.dotacaoInicialInvestimento !== undefined) {
      record.dotacaoInicial = (record.dotacaoInicialCusteio || 0) + (record.dotacaoInicialInvestimento || 0);
      record.dotacaoAtual = (record.dotacaoAtualCusteio || 0) + (record.dotacaoAtualInvestimento || 0);
      record.empenhado = (record.empenhadoCusteio || 0) + (record.empenhadoInvestimento || 0);
      record.liquidado = (record.liquidadoCusteio || 0) + (record.liquidadoInvestimento || 0);
      record.pago = (record.pagoCusteio || 0) + (record.pagoInvestimento || 0);
    }

    // Calculate last manual insertion from the actual audit logs (history) for this year
    const lastManualTime = latestHistoryForYear?.updatedAt || record.manualUpdatedAt || null;
    const lastManualTimeStr = lastManualTime 
      ? `${new Date(lastManualTime).toLocaleDateString('pt-BR')} às ${new Date(lastManualTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}h` 
      : 'Nenhum registro de inserção manual';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ação 8861 - Consolidação de Orçamento Anualizado</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
            
            body {
              font-family: 'Inter', sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 30px;
              line-height: 1.4;
              font-size: 11px;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
            }
            .logo-cell {
              width: 220px;
              vertical-align: middle;
            }
            .title-cell {
              vertical-align: middle;
              text-align: right;
            }
            .sub-title {
              font-size: 10px;
              color: #64748b;
              font-weight: 500;
              margin-top: 2px;
            }
            .action-info {
              background-color: #f8fafc;
              border-left: 3px solid #0f766e;
              padding: 10px 14px;
              margin-bottom: 20px;
              border-radius: 0 4px 4px 0;
            }
            .action-title {
              font-size: 11px;
              font-weight: 800;
              color: #0f766e;
              margin: 0 0 3px 0;
              text-transform: uppercase;
            }
            .action-desc {
              font-size: 10px;
              color: #334155;
              margin: 0;
              font-weight: 500;
            }
            .summary-title {
              font-size: 10px;
              font-weight: 800;
              color: #475569;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin: 20px 0 8px 0;
            }
            .summary-grid {
              display: table;
              width: 100%;
              margin-bottom: 25px;
              border-spacing: 12px 0px;
            }
            .summary-card {
              display: table-cell;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 12px 16px;
              width: 33.33%;
              vertical-align: top;
            }
            .summary-card.highlight {
              background-color: #f0fdf4;
              border-color: #bbf7d0;
            }
            .card-label {
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              color: #475569;
              letter-spacing: 0.05em;
              margin-bottom: 5px;
            }
            .card-value {
              font-family: 'JetBrains Mono', monospace;
              font-size: 16px;
              font-weight: 700;
              color: #0f172a;
            }
            .card-value.green {
              color: #15803d;
            }
            .section-title {
              font-size: 13px;
              font-weight: 800;
              color: #0f172a;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 6px;
              margin: 25px 0 12px 0;
              text-transform: uppercase;
              letter-spacing: 0.02em;
            }
            table.data-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            table.data-table th {
              background-color: #f1f5f9;
              font-size: 8px;
              font-weight: 800;
              color: #475569;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              padding: 8px 10px;
              text-align: left;
              border-bottom: 1px solid #cbd5e1;
            }
            table.data-table td {
              padding: 7px 10px;
              border-bottom: 1px solid #e2e8f0;
              vertical-align: top;
              font-size: 10px;
            }
            .font-mono {
              font-family: 'JetBrains Mono', monospace;
              font-weight: 600;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .footer {
              margin-top: 40px;
              font-size: 8px;
              color: #94a3b8;
              text-align: center;
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
            }
            .status-tag {
              display: inline-block;
              font-size: 8px;
              font-weight: 700;
              padding: 1px 4px;
              border-radius: 4px;
              text-transform: uppercase;
            }
            .status-tag.iniciado { background-color: #e0f2fe; color: #0369a1; }
            .status-tag.nao-iniciado { background-color: #f1f5f9; color: #475569; }
            .status-tag.vigente { background-color: #ccfbf1; color: #0f766e; }
            .status-tag.vencer { background-color: #fef3c7; color: #b45309; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td class="logo-cell">
                <img src="/sof-logo.png" style="height: 48px; width: auto;" alt="SOF Logo" onerror="this.style.display='none'; document.getElementById('alt-logo-text').style.display='block';"/>
                <div id="alt-logo-text" style="display:none; font-weight:900; font-size:18px; color:#1e293b; letter-spacing:1px;">CONTRATICS <span style="color:#0f766e;">| SOF</span></div>
              </td>
              <td class="title-cell">
                <div style="font-size: 15px; font-weight: 800; color: #0f172a; text-transform: uppercase;">Ação 8861: Orçamento Atual</div>
                <div class="sub-title">Exercício Correspondente: ${selectedYear === 'Todos' ? currentYear : selectedYear} &bull; Gerado em: ${new Date().toLocaleDateString('pt-BR')}</div>
              </td>
            </tr>
          </table>

          <div class="action-info">
            <h4 class="action-title">Ação Orçamentária 8861</h4>
            <p class="action-desc">Sustentação da Tecnologia da Informação do Sistema de Planejamento Nacional e do Orçamento Federal</p>
          </div>

          <div class="summary-title">Demonstrativo Interno Contratics</div>
          <div class="summary-grid">
            <div class="summary-card" style="width: ${sumAnnualizedPlanejamentos > 0 ? '25%' : '33.33%'};">
              <div class="card-label">Soma Contratos Vigentes</div>
              <div class="card-value">R$ ${sumAnnualizedContracts.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="summary-card" style="width: ${sumAnnualizedPlanejamentos > 0 ? '25%' : '33.33%'};">
              <div class="card-label">Soma DFDs (PCA)</div>
              <div class="card-value">R$ ${sumAnnualizedDFDs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            ${sumAnnualizedPlanejamentos > 0 ? `
            <div class="summary-card" style="width: 25%; background-color: #fffbeb; border-color: #fde68a;">
              <div class="card-label" style="color: #b45309;">Processos em Planejamento</div>
              <div class="card-value" style="color: #b45309;">R$ ${sumAnnualizedPlanejamentos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            ` : ''}
            <div class="summary-card highlight" style="width: ${sumAnnualizedPlanejamentos > 0 ? '25%' : '33.33%'};">
              <div class="card-label" style="color: #15803d;">Orçamento Anual Geral SOF</div>
              <div class="card-value green">R$ ${valorAnualGeralSOF.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div class="section-title">Informações Adicionais do Painel Oficial SIOP</div>
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; margin-bottom: 25px;">
            <div style="font-size: 11px; font-weight: bold; color: #0f172a; margin-bottom: 12px; display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
              <span>Mapeamento dos Dados de Monitoramento no Painel de Orçamento Federal</span>
              <span style="color: #64748b; font-size: 10px; font-weight: normal;">
                Última Inserção Manual: ${lastManualTimeStr}
              </span>
            </div>
            
            <!-- Tabela Detalhada SIOP - Custeio vs. Investimento no PDF -->
            <table class="data-table" style="margin-top: 5px; margin-bottom: 15px; width: 100%; font-size: 10px;">
              <thead>
                <tr style="background-color: #f1f5f9;">
                  <th style="padding: 6px 10px;">Grupo de Despesa (Ação 8861)</th>
                  <th class="text-right font-mono" style="padding: 6px 10px; font-size: 8px;">Dotação Inicial</th>
                  <th class="text-right font-mono" style="padding: 6px 10px; font-size: 8px;">Dotação Atual</th>
                  <th class="text-right font-mono" style="padding: 6px 10px; font-size: 8px;">Empenhado</th>
                  <th class="text-right font-mono" style="padding: 6px 10px; font-size: 8px;">Liquidado</th>
                  <th class="text-right font-mono" style="padding: 6px 10px; font-size: 8px;">Pago</th>
                </tr>
              </thead>
              <tbody>
                <tr style="background-color: rgba(15, 118, 110, 0.04); font-weight: bold;">
                  <td style="color: #0f766e; text-transform: uppercase; font-size: 9px; padding: 6px 10px;">Total Geral da Ação</td>
                  <td class="text-right font-mono" style="padding: 6px 10px; font-weight: bold;">R$ ${record.dotacaoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="text-right font-mono" style="padding: 6px 10px; font-weight: bold; color: #0f766e;">R$ ${record.dotacaoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="text-right font-mono" style="padding: 6px 10px; font-weight: bold; color: #0d9488;">R$ ${record.empenhado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="text-right font-mono" style="padding: 6px 10px; font-weight: bold; color: #b45309;">R$ ${record.liquidado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="text-right font-mono" style="padding: 6px 10px; font-weight: bold; color: #be123c;">R$ ${record.pago.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 10px;">3 - Outras Despesas Correntes (Custeio)</td>
                  <td class="text-right font-mono" style="padding: 6px 10px;">R$ ${(record.dotacaoInicialCusteio !== undefined && record.dotacaoInicialCusteio !== null ? record.dotacaoInicialCusteio : (record.dotacaoInicial || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="text-right font-mono" style="padding: 6px 10px;">R$ ${(record.dotacaoAtualCusteio !== undefined && record.dotacaoAtualCusteio !== null ? record.dotacaoAtualCusteio : (record.dotacaoAtual || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="text-right font-mono" style="padding: 6px 10px;">R$ ${(record.empenhadoCusteio !== undefined && record.empenhadoCusteio !== null ? record.empenhadoCusteio : (record.empenhado || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="text-right font-mono" style="padding: 6px 10px;">R$ ${(record.liquidadoCusteio !== undefined && record.liquidadoCusteio !== null ? record.liquidadoCusteio : (record.liquidado || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="text-right font-mono" style="padding: 6px 10px;">R$ ${(record.pagoCusteio !== undefined && record.pagoCusteio !== null ? record.pagoCusteio : (record.pago || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 10px;">4 - Investimentos (Investimento)</td>
                  <td class="text-right font-mono" style="padding: 6px 10px;">R$ ${(record.dotacaoInicialInvestimento !== undefined && record.dotacaoInicialInvestimento !== null ? record.dotacaoInicialInvestimento : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="text-right font-mono" style="padding: 6px 10px;">R$ ${(record.dotacaoAtualInvestimento !== undefined && record.dotacaoAtualInvestimento !== null ? record.dotacaoAtualInvestimento : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="text-right font-mono" style="padding: 6px 10px;">R$ ${(record.empenhadoInvestimento !== undefined && record.empenhadoInvestimento !== null ? record.empenhadoInvestimento : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="text-right font-mono" style="padding: 6px 10px;">R$ ${(record.liquidadoInvestimento !== undefined && record.liquidadoInvestimento !== null ? record.liquidadoInvestimento : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="text-right font-mono" style="padding: 6px 10px;">R$ ${(record.pagoInvestimento !== undefined && record.pagoInvestimento !== null ? record.pagoInvestimento : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
            
            <div style="background-color: #f0fdfa; border-left: 3px solid #0d9488; padding: 8px 12px; font-size: 9.5px; color: #0f766e; border-radius: 0 4px 4px 0;">
              <strong>Comparador Contratics vs SIOP Oficial:</strong> O valor total anual planejado no Contratics é de <strong>R$ ${valorAnualGeralSOF.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>. No Painel do SIOP Oficial (Ação 8861), o saldo atual da ação é de <strong>R$ ${record.dotacaoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.
              ${valorAnualGeralSOF > record.dotacaoAtual ? `
                <span style="color: #be123c; font-weight: bold; display: block; margin-top: 4px;">Atenção: A soma dos contratos internos supera a dotação oficial do SIOP!</span>
              ` : `
                <span style="color: #15803d; font-weight: bold; display: block; margin-top: 4px;">A dotação oficial está adequada e com margem segura em relação aos repasses previstos!</span>
              `}
            </div>
          </div>

          <div class="section-title">1. Documentos de Formalização da Demanda (DFDs do PCA) Anualizados</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 12%">Nº DFD</th>
                <th style="width: 48%">Objeto da Contratação</th>
                <th style="width: 15%">Periodicidade</th>
                <th style="width: 15%" class="text-right">Valor Estimado</th>
                <th style="width: 10%" class="text-right">Valor Anualizado</th>
              </tr>
            </thead>
            <tbody>
              ${sortedDFDs.length === 0 ? `
                <tr><td colspan="5" style="text-align:center; color:#94a3b8; font-style:italic;">Nenhum DFD ativo para este exercício.</td></tr>
              ` : sortedDFDs.map(d => {
                const isDeactivated = d.Contabilizar_Orcamento === false;
                const valorExibido = d.Valor_Customizado !== undefined && d.Valor_Customizado !== null ? d.Valor_Customizado : d.Valor_Estimado;
                return `
                <tr style="${isDeactivated ? 'opacity: 0.55; text-decoration: line-through; background-color: #f8fafc;' : ''}">
                  <td class="font-mono"><strong>${d.Num_DFD}</strong></td>
                  <td>${d.Descricao_Objeto}${isDeactivated ? ' (DESATIVADO)' : ''}${d.Valor_Customizado !== undefined && d.Valor_Customizado !== null ? ' (Valor Ajustado)' : ''}</td>
                  <td>${d.Periodicidade_Pagamento}</td>
                  <td class="font-mono text-right">R$ ${valorExibido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="font-mono text-right" style="color: ${isDeactivated ? '#64748b' : '#0d9488'}; font-weight:700;">R$ ${d.valor_anualizado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              `}).join('')}
            </tbody>
          </table>

          ${sortedPlanejamentos.length > 0 ? `
          <div class="section-title">2. Processos de Planejamento (Licitações em Andamento / SEI)</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 13%">Nº Processo SEI</th>
                <th style="width: 35%">Objeto da Contratação</th>
                <th style="width: 14%">Início</th>
                <th style="width: 14%">Situação / Memória</th>
                <th style="width: 12%" class="text-right">Valor Estimado</th>
                <th style="width: 12%" class="text-right">Valor Anualizado</th>
              </tr>
            </thead>
            <tbody>
              ${sortedPlanejamentos.map(p => {
                const isDeactivated = p.Contabilizar_Orcamento === false;
                const valorExibido = p.Valor_Customizado !== undefined && p.Valor_Customizado !== null ? p.Valor_Customizado : p.Valor_Estimado;
                const dateLabel = p.data_inicio_efetiva ? formatDate(p.data_inicio_efetiva) : '—';
                const tag = p.isOverriddenDate ? ' (Data Ajustada)' : (p.isTodayDefaultDate ? ' (Simulado Hoje)' : '');
                return `
                <tr style="${isDeactivated ? 'opacity: 0.55; text-decoration: line-through; background-color: #f8fafc;' : ''}">
                  <td class="font-mono"><strong>${p.Num_DFD}</strong></td>
                  <td>${p.Descricao_Objeto}${isDeactivated ? ' (DESATIVADO)' : ''}</td>
                  <td class="font-mono">${dateLabel}<span style="font-size: 8px; color: #b45309;">${tag}</span></td>
                  <td>
                    <span style="font-size: 8.5px; font-weight: 600; color: #b45309;">${p.observacoes_planejamento || 'Planejamento SEI'}</span>
                    ${p.calculo_detalhado && !isDeactivated ? `<br/><span style="font-size: 8px; color: #64748b;">${p.calculo_detalhado}</span>` : ''}
                  </td>
                  <td class="font-mono text-right">R$ ${valorExibido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="font-mono text-right" style="color: ${isDeactivated ? '#64748b' : '#b45309'}; font-weight:700;">R$ ${p.valor_anualizado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              `}).join('')}
            </tbody>
          </table>
          ` : ''}

          <div class="section-title">${sortedPlanejamentos.length > 0 ? '3' : '2'}. Contratos Vigentes Relevantes e Modalidades de Execução</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 14%">Nº Contrato</th>
                <th style="width: 16%">Modalidade</th>
                <th style="width: 22%">Fornecedor</th>
                <th style="width: 33%">Objeto Regulamentar</th>
                <th style="width: 15%" class="text-right">Valor Anual SOF</th>
              </tr>
            </thead>
            <tbody>
              ${sortedContracts.length === 0 ? `
                <tr><td colspan="5" style="text-align:center; color:#94a3b8; font-style:italic;">Nenhum contrato ativo para este exercício.</td></tr>
              ` : sortedContracts.map(c => {
                const fornObj = fornecedores.find(f => f.id === c.Fornecedor);
                const fornName = fornObj ? fornObj.Nome_Fornecedor : c.Fornecedor;
                return `
                  <tr>
                    <td class="font-mono"><strong>${c.Num_Contrato}</strong></td>
                    <td>
                      <span style="display:inline-block; font-size:8.5px; font-weight:700; padding:2px 5px; border-radius:3px; color:${c.Modalidade_Contratacao === 'Pregão Colaboragov' ? '#0369a1' : '#0f766e'}; background-color:${c.Modalidade_Contratacao === 'Pregão Colaboragov' ? '#e0f2fe' : '#f0fdf4'};">
                        ${c.Modalidade_Contratacao || 'Pregão SOF'}
                      </span>
                    </td>
                    <td><strong>${fornName}</strong></td>
                    <td>${c.Objeto}</td>
                    <td class="font-mono text-right" style="color: #0284c7; font-weight:700;">R$ ${c.valor_anual_sof.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            CONTRATICS &bull; Sistema Integrado de Gestão Orçamentária e de Contratos &bull; Secretaria de Orçamento Federal
          </div>
        </body>
      </html>
    `;

    // Create a print iframe
    let iframe = document.getElementById('print-iframe-orcamento') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe-orcamento';
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

  return (
    <div className="w-full max-w-none mx-auto space-y-6 animate-in fade-in duration-150" data-tour="orcamento-header">
      
      {/* Visual Header card */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between p-6 bg-surface border border-outline rounded-2xl gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-on-surface-variant font-mono">SOF • Exercício: {selectedYear === 'Todos' ? currentYear : selectedYear}</span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-on-surface flex items-center gap-2 flex-wrap">
              <span>Orçamento Atual</span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded font-sans uppercase">
                Ação 8861
              </span>
            </h1>
            <p className="text-xs text-on-surface-variant/80 mt-0.5 max-w-2xl">
              Consolidação de valores a serem desembolsados para o pagamento de contratos vigentes e de DFDs planejados para o exercício.
            </p>
          </div>
        </div>
        
        {/* Actions panel */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-start xl:justify-end shrink-0 mt-3 xl:mt-0">
          {onYearChange && (
            <div className="flex items-center gap-2 bg-surface-container border border-outline rounded-xl px-3 py-2 h-[38px] min-w-[155px]">
              <CalendarRange className="w-3.5 h-3.5 text-primary shrink-0" />
              <select
                value={selectedYear}
                onChange={(e) => onYearChange(e.target.value)}
                className="bg-transparent text-primary text-xs font-bold font-sans cursor-pointer focus:outline-none outline-none font-mono border-0 p-0"
              >
                <option value="2024" className="bg-surface text-on-surface">2024 (Histórico)</option>
                <option value="2025" className="bg-surface text-on-surface">2025 (Transição)</option>
                <option value="2026" className="bg-surface text-on-surface">2026 (Corrente)</option>
                <option value="2027" className="bg-surface text-on-surface">2027 (Planejado)</option>
                <option value="2028" className="bg-surface text-on-surface">2028 (Futuro)</option>
              </select>
            </div>
          )}

          {/* Simulation Toggle */}
          <button
            type="button"
            onClick={() => setSimulateRenewals(!simulateRenewals)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-xl h-[38px] text-xs font-bold transition-all cursor-pointer ${
              simulateRenewals
                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/35 shadow-xs'
                : 'bg-surface-container border-outline text-on-surface-variant hover:text-on-surface'
            }`}
            title="Simula a renovação automática de contratos vigentes que possuem possibilidade de prorrogação futura"
          >
            <Shuffle className={`w-3.5 h-3.5 ${simulateRenewals ? 'animate-pulse text-purple-500' : ''}`} />
            <span>Simular Prorrogações</span>
            <span className={`w-1.5 h-1.5 rounded-full ${simulateRenewals ? 'bg-purple-500' : 'bg-outline-variant'}`} />
          </button>
          
          <button 
            onClick={initSpreadsheet}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl h-[38px] transition-all cursor-pointer shadow-sm shadow-emerald-600/20"
            title="Abre a planilha interativa de levantamento e projeção para o ano alvo conforme as diretrizes e modelos oficiais."
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Gerar Planilha de Projeção</span>
          </button>
          
          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold rounded-xl h-[38px] transition-all cursor-pointer shadow-sm shadow-primary/20"
          >
            <Download className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* Ação Orçamentária info alert */}
      <div className="flex gap-3.5 p-4 rounded-xl border border-teal-400/80 dark:border-teal-500/30 bg-teal-100/70 dark:bg-surface-container-low items-start shadow-xs">
        <Info className="w-5 h-5 mt-0.5 shrink-0 text-teal-800 dark:text-teal-400" />
        <div className="text-xs space-y-1">
          <p className="font-extrabold uppercase tracking-wider text-[10px] text-teal-950 dark:text-teal-300">
            Ação Orçamentária 8861
          </p>
          <p className="font-bold text-sm text-slate-950 dark:text-on-surface leading-snug">
            Sustentação da Tecnologia da Informação do Sistema de Planejamento Nacional e do Orçamento Federal
          </p>
          <p className="text-xs text-slate-900 dark:text-on-surface-variant font-medium leading-relaxed pt-0.5">
            Esta ação consolida os recursos previstos para o ano corrente. Os valores dos DFDs (<span className="font-bold text-slate-950 dark:text-on-surface">"Não iniciado"</span> e <span className="font-bold text-slate-950 dark:text-on-surface">"Iniciado"</span> com status de orçamento ativo) são anualizados proporcionalmente da data de conclusão estimada até 31 de dezembro. Contratos vigentes que requerem desembolso no exercício também são listados com seu correspondente <span className="font-bold text-slate-950 dark:text-on-surface">"Valor Anual SOF"</span>.
          </p>
        </div>
      </div>

      {/* SIOP Live Integration Board - Manually updated */}
      {(() => {
        const targetYear = selectedYear === 'Todos' ? '2026' : selectedYear;
        const docId = targetYear === '2026' ? '8861_2026' : `8861_${targetYear}`;
        
        // 1. Try finding in database records
        let foundRecord = siopRecords.find(r => r.id === docId);
        if (!foundRecord && targetYear === '2026') {
          foundRecord = siopRecords.find(r => r.id === '8861');
        }
        
        // 2. Try finding in history for this year/docId
        const filteredHistory = siopHistory && siopHistory.length > 0
          ? [...siopHistory].filter(h => h.id === docId || h.id === `8861_${targetYear}` || (targetYear === '2026' && (h.id === '8861' || h.id === '8861_2026'))).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          : [];
        const latestHistoryForYear = filteredHistory[0];
        
        // 3. Try finding in local storage fallback
        const savedFallback = localStorage.getItem(`contratics_siop_${docId}_fallback`) || (targetYear === '2026' ? localStorage.getItem(`contratics_siop_8861_fallback`) : null);
        const fallbackObj = savedFallback ? JSON.parse(savedFallback) : null;
        
        const baseRecord = foundRecord || latestHistoryForYear || fallbackObj || {
          id: docId,
          dotacaoInicial: 0,
          dotacaoAtual: 0,
          empenhado: 0,
          liquidado: 0,
          pago: 0,
          updatedAt: '',
          dotacaoInicialCusteio: 0,
          dotacaoAtualCusteio: 0,
          empenhadoCusteio: 0,
          liquidadoCusteio: 0,
          pagoCusteio: 0,
          dotacaoInicialInvestimento: 0,
          dotacaoAtualInvestimento: 0,
          empenhadoInvestimento: 0,
          liquidadoInvestimento: 0,
          pagoInvestimento: 0
        };

        const record = {
          ...baseRecord,
          dotacaoInicialCusteio: baseRecord.dotacaoInicialCusteio !== undefined && baseRecord.dotacaoInicialCusteio !== null ? baseRecord.dotacaoInicialCusteio : (latestHistoryForYear?.dotacaoInicialCusteio ?? fallbackObj?.dotacaoInicialCusteio ?? undefined),
          dotacaoAtualCusteio: baseRecord.dotacaoAtualCusteio !== undefined && baseRecord.dotacaoAtualCusteio !== null ? baseRecord.dotacaoAtualCusteio : (latestHistoryForYear?.dotacaoAtualCusteio ?? fallbackObj?.dotacaoAtualCusteio ?? undefined),
          empenhadoCusteio: baseRecord.empenhadoCusteio !== undefined && baseRecord.empenhadoCusteio !== null ? baseRecord.empenhadoCusteio : (latestHistoryForYear?.empenhadoCusteio ?? fallbackObj?.empenhadoCusteio ?? undefined),
          liquidadoCusteio: baseRecord.liquidadoCusteio !== undefined && baseRecord.liquidadoCusteio !== null ? baseRecord.liquidadoCusteio : (latestHistoryForYear?.liquidadoCusteio ?? fallbackObj?.liquidadoCusteio ?? undefined),
          pagoCusteio: baseRecord.pagoCusteio !== undefined && baseRecord.pagoCusteio !== null ? baseRecord.pagoCusteio : (latestHistoryForYear?.pagoCusteio ?? fallbackObj?.pagoCusteio ?? undefined),
          
          dotacaoInicialInvestimento: baseRecord.dotacaoInicialInvestimento !== undefined && baseRecord.dotacaoInicialInvestimento !== null ? baseRecord.dotacaoInicialInvestimento : (latestHistoryForYear?.dotacaoInicialInvestimento ?? fallbackObj?.dotacaoInicialInvestimento ?? undefined),
          dotacaoAtualInvestimento: baseRecord.dotacaoAtualInvestimento !== undefined && baseRecord.dotacaoAtualInvestimento !== null ? baseRecord.dotacaoAtualInvestimento : (latestHistoryForYear?.dotacaoAtualInvestimento ?? fallbackObj?.dotacaoAtualInvestimento ?? undefined),
          empenhadoInvestimento: baseRecord.empenhadoInvestimento !== undefined && baseRecord.empenhadoInvestimento !== null ? baseRecord.empenhadoInvestimento : (latestHistoryForYear?.empenhadoInvestimento ?? fallbackObj?.empenhadoInvestimento ?? undefined),
          liquidadoInvestimento: baseRecord.liquidadoInvestimento !== undefined && baseRecord.liquidadoInvestimento !== null ? baseRecord.liquidadoInvestimento : (latestHistoryForYear?.liquidadoInvestimento ?? fallbackObj?.liquidadoInvestimento ?? undefined),
          pagoInvestimento: baseRecord.pagoInvestimento !== undefined && baseRecord.pagoInvestimento !== null ? baseRecord.pagoInvestimento : (latestHistoryForYear?.pagoInvestimento ?? fallbackObj?.pagoInvestimento ?? undefined),
        };

        // If segregated fields exist, compute the totals dynamically so they are always in perfect sync
        if (record.dotacaoInicialCusteio !== undefined || record.dotacaoInicialInvestimento !== undefined) {
          record.dotacaoInicial = (record.dotacaoInicialCusteio || 0) + (record.dotacaoInicialInvestimento || 0);
          record.dotacaoAtual = (record.dotacaoAtualCusteio || 0) + (record.dotacaoAtualInvestimento || 0);
          record.empenhado = (record.empenhadoCusteio || 0) + (record.empenhadoInvestimento || 0);
          record.liquidado = (record.liquidadoCusteio || 0) + (record.liquidadoInvestimento || 0);
          record.pago = (record.pagoCusteio || 0) + (record.pagoInvestimento || 0);
        }

        const lastManualTime = latestHistoryForYear?.updatedAt || record.manualUpdatedAt || null;

        return (
          <div className="p-6 bg-surface border border-outline rounded-2xl relative overflow-hidden shadow-sm">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-outline/50 pb-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-on-surface">Informações do Painel do Orçamento Federal - Ação 8861</h3>
                  <p className="text-xs text-on-surface-variant/80">Monitoramento manual da Ação 8861 ligada ao MPO</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 self-stretch lg:self-auto text-xs justify-end font-sans">
                <span className="text-on-surface-variant/80">
                  Última Inserção Manual: {lastManualTime ? (
                    <strong className="text-on-surface font-mono">{formatDate(lastManualTime)} às {new Date(lastManualTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}h</strong>
                  ) : (
                    <span className="text-on-surface-variant/50 font-bold italic">Nenhuma inserção registrada</span>
                  )}
                </span>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-outline bg-surface hover:bg-surface-container/50 transition-colors"
                  >
                    <History className="w-3.5 h-3.5 text-on-surface-variant" />
                    {isHistoryExpanded ? 'Ocultar Histórico' : 'Ver Histórico'}
                  </button>
                  <button 
                    onClick={openEditSiopModal}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-primary text-on-primary hover:opacity-90 transition-opacity shadow-sm"
                  >
                    <PenSquare className="w-3.5 h-3.5" />
                    Atualizar Valores (SIOP)
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-5">
              <div className="space-y-1 bg-surface-container/30 border border-outline/30 p-3.5 rounded-xl overflow-hidden min-w-0" title={formatCurrency(record.dotacaoInicial)}>
                <span className="text-[9px] uppercase font-bold text-on-surface-variant/80 block truncate">Dotação Inicial</span>
                <span className="text-base sm:text-lg lg:text-sm xl:text-base font-black font-mono text-on-surface block truncate">
                  {formatCurrency(record.dotacaoInicial)}
                </span>
                <span className="text-[9px] text-on-surface-variant block truncate">Lei Orçamentária (LOA)</span>
              </div>

              <div className="space-y-1 bg-surface-container/30 border border-outline/30 p-3.5 rounded-xl overflow-hidden min-w-0" title={formatCurrency(record.dotacaoAtual)}>
                <span className="text-[9px] uppercase font-bold text-on-surface-variant/80 block truncate">Dotação Atualizada</span>
                <span className="text-base sm:text-lg lg:text-sm xl:text-base font-black font-mono text-primary block truncate">
                  {formatCurrency(record.dotacaoAtual)}
                </span>
                <span className="text-[9px] text-on-surface-variant block truncate">Dotação + Créditos Adicionais</span>
              </div>

              <div className="space-y-1 bg-surface-container/30 border border-outline/30 p-3.5 rounded-xl overflow-hidden min-w-0" title={formatCurrency(record.empenhado)}>
                <span className="text-[9px] uppercase font-bold text-on-surface-variant/80 block truncate">Valor Empenhado</span>
                <span className="text-base sm:text-lg lg:text-sm xl:text-base font-black font-mono text-teal-600 dark:text-teal-400 block truncate">
                  {formatCurrency(record.empenhado)}
                </span>
                <span className="text-[9px] text-on-surface-variant block truncate">Reserva oficial efetuada</span>
              </div>

              <div className="space-y-1 bg-surface-container/30 border border-outline/30 p-3.5 rounded-xl overflow-hidden min-w-0" title={formatCurrency(record.liquidado)}>
                <span className="text-[9px] uppercase font-bold text-on-surface-variant/80 block truncate">Valor Liquidado</span>
                <span className="text-base sm:text-lg lg:text-sm xl:text-base font-black font-mono text-amber-600 dark:text-amber-400 block truncate">
                  {formatCurrency(record.liquidado)}
                </span>
                <span className="text-[9px] text-on-surface-variant block truncate">Serviços atestados</span>
              </div>

              <div className="space-y-1 col-span-1 sm:col-span-2 lg:col-span-1 bg-surface-container/30 border border-outline/30 p-3.5 rounded-xl overflow-hidden min-w-0" title={formatCurrency(record.pago)}>
                <span className="text-[9px] uppercase font-bold text-on-surface-variant/80 block truncate">Valor Pago</span>
                <span className="text-base sm:text-lg lg:text-sm xl:text-base font-black font-mono text-rose-500 block truncate">
                  {formatCurrency(record.pago)}
                </span>
                <span className="text-[9px] text-on-surface-variant block truncate">Desembolso financeiro final</span>
              </div>
            </div>

            {/* Tabela Detalhada SIOP - Custeio vs. Investimento */}
            <div className="mt-5 overflow-x-auto rounded-xl border border-outline/30 bg-surface-container/10">
              <table className="w-full min-w-[750px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-teal-500/5 text-on-surface-variant font-bold border-b border-outline/30">
                    <th className="px-4 py-2.5 font-sans">Grupo de Despesa (Ação 8861)</th>
                    <th className="px-4 py-2.5 text-right font-mono">Dotação Inicial</th>
                    <th className="px-4 py-2.5 text-right font-mono">Dotação Atual</th>
                    <th className="px-4 py-2.5 text-right font-mono">Empenhado</th>
                    <th className="px-4 py-2.5 text-right font-mono">Liquidado</th>
                    <th className="px-4 py-2.5 text-right font-mono">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/10">
                  {/* Linha de Total consolidado */}
                  <tr className="bg-teal-500/[0.02] font-black hover:bg-teal-500/[0.04] transition-colors">
                    <td className="px-4 py-2.5 text-primary flex items-center gap-1.5 font-sans uppercase text-[10px]">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      Total Geral da Ação
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-on-surface">{formatCurrency(record.dotacaoInicial)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-primary">{formatCurrency(record.dotacaoAtual)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-teal-600 dark:text-teal-400">{formatCurrency(record.empenhado)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-amber-600 dark:text-amber-400">{formatCurrency(record.liquidado)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-rose-500">{formatCurrency(record.pago)}</td>
                  </tr>

                  {/* Linha Custeio */}
                  <tr className="hover:bg-surface-container/20 transition-colors font-medium">
                    <td className="px-4 py-2.5 text-on-surface-variant font-sans flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      3 - Outras Despesas Correntes (Custeio)
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-on-surface-variant">
                      {formatCurrency(record.dotacaoInicialCusteio !== undefined && record.dotacaoInicialCusteio !== null ? record.dotacaoInicialCusteio : (record.dotacaoInicial || 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-on-surface-variant">
                      {formatCurrency(record.dotacaoAtualCusteio !== undefined && record.dotacaoAtualCusteio !== null ? record.dotacaoAtualCusteio : (record.dotacaoAtual || 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-on-surface-variant">
                      {formatCurrency(record.empenhadoCusteio !== undefined && record.empenhadoCusteio !== null ? record.empenhadoCusteio : (record.empenhado || 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-on-surface-variant">
                      {formatCurrency(record.liquidadoCusteio !== undefined && record.liquidadoCusteio !== null ? record.liquidadoCusteio : (record.liquidado || 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-on-surface-variant">
                      {formatCurrency(record.pagoCusteio !== undefined && record.pagoCusteio !== null ? record.pagoCusteio : (record.pago || 0))}
                    </td>
                  </tr>

                  {/* Linha Investimento */}
                  <tr className="hover:bg-surface-container/20 transition-colors font-medium">
                    <td className="px-4 py-2.5 text-on-surface-variant font-sans flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      4 - Investimentos (Investimento)
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-on-surface-variant">
                      {formatCurrency(record.dotacaoInicialInvestimento !== undefined && record.dotacaoInicialInvestimento !== null ? record.dotacaoInicialInvestimento : 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-on-surface-variant">
                      {formatCurrency(record.dotacaoAtualInvestimento !== undefined && record.dotacaoAtualInvestimento !== null ? record.dotacaoAtualInvestimento : 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-on-surface-variant">
                      {formatCurrency(record.empenhadoInvestimento !== undefined && record.empenhadoInvestimento !== null ? record.empenhadoInvestimento : 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-on-surface-variant">
                      {formatCurrency(record.liquidadoInvestimento !== undefined && record.liquidadoInvestimento !== null ? record.liquidadoInvestimento : 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-on-surface-variant">
                      {formatCurrency(record.pagoInvestimento !== undefined && record.pagoInvestimento !== null ? record.pagoInvestimento : 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 bg-teal-500/[0.02] border border-teal-500/10 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 text-xs text-on-surface-variant">
              <p className="leading-normal">
                💡 <strong>Comparador Contratics vs SIOP Oficial:</strong> O valor total anual planejado no Contratics é de <strong className="text-on-surface font-extrabold">{formatCurrency(valorAnualGeralSOF)}</strong>. No Painel do SIOP Oficial, o saldo atual da ação é de <strong className="text-teal-600 dark:text-teal-400 font-extrabold">{formatCurrency(record.dotacaoAtual)}</strong>. {valorAnualGeralSOF > record.dotacaoAtual && <span className="text-rose-500 font-semibold block sm:inline">Atenção: A soma dos contratos internos supera a dotação oficial do SIOP!</span>}
              </p>
            </div>

            {/* Collapsible History Section */}
            {isHistoryExpanded && (
              <div className="mt-5 border-t border-outline/50 pt-4 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    Histórico de Alterações e Contingenciamentos
                  </h4>
                  <span className="text-[10px] text-on-surface-variant font-mono bg-surface-container/50 px-2 py-0.5 rounded border border-outline/30">
                    {siopHistory.length} registros
                  </span>
                </div>

                {siopHistory.length === 0 ? (
                  <p className="text-[11px] text-on-surface-variant/70 italic text-center py-4 bg-surface-container/10 rounded-xl border border-outline/25">
                    Nenhuma alteração registrada ainda. Os novos envios manuais serão listados aqui como registros de auditoria.
                  </p>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-outline/30 bg-surface-container/15 scrollbar-thin">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-surface-container/40 text-on-surface-variant border-b border-outline/30 font-bold">
                          <th className="p-2.5">Data/Hora</th>
                          <th className="p-2.5 text-right">Dotação Inicial</th>
                          <th className="p-2.5 text-right">Dotação Atualizada</th>
                          <th className="p-2.5 text-right">Empenhado</th>
                          <th className="p-2.5 text-right">Liquidado</th>
                          <th className="p-2.5 text-right">Pago</th>
                          <th className="p-2.5">Atualizado por</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono text-on-surface-second divide-y divide-outline/10">
                        {sortedSiopHistory.map((h, idx) => (
                          <tr key={`${h.id}_${h.updatedAt || ''}_${idx}`} className="hover:bg-surface-container/10 transition-colors">
                            <td className="p-2.5 text-on-surface-variant/80 font-sans">
                              {formatDate(h.updatedAt)} {new Date(h.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}h
                            </td>
                            <td className="p-2.5 text-right font-bold text-on-surface-variant">{formatCurrency(h.dotacaoInicial)}</td>
                            <td className="p-2.5 text-right font-bold text-primary">{formatCurrency(h.dotacaoAtual)}</td>
                            <td className="p-2.5 text-right font-bold text-teal-600 dark:text-teal-400">{formatCurrency(h.empenhado)}</td>
                            <td className="p-2.5 text-right font-bold text-amber-600 dark:text-amber-400">{formatCurrency(h.liquidado)}</td>
                            <td className="p-2.5 text-right font-bold text-rose-500">{formatCurrency(h.pago)}</td>
                            <td className="p-2.5 text-on-surface-variant/80 font-sans truncate max-w-[120px]" title={h.updatedByName}>
                              {h.updatedByName || 'Gestor Contratics'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Edit Modal / Dialog Box */}
            {isEditSiopModalOpen && (() => {
              const computedTotalDotacaoInicial = (Number(formDotacaoInicialCusteio) || 0) + (Number(formDotacaoInicialInvestimento) || 0);
              const computedTotalDotacaoAtual = (Number(formDotacaoAtualCusteio) || 0) + (Number(formDotacaoAtualInvestimento) || 0);
              const computedTotalEmpenhado = (Number(formEmpenhadoCusteio) || 0) + (Number(formEmpenhadoInvestimento) || 0);
              const computedTotalLiquidado = (Number(formLiquidadoCusteio) || 0) + (Number(formLiquidadoInvestimento) || 0);
              const computedTotalPago = (Number(formPagoCusteio) || 0) + (Number(formPagoInvestimento) || 0);

              return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in">
                  <div className="bg-surface border border-outline w-full max-w-4xl mx-4 p-6 rounded-2xl shadow-xl flex flex-col max-h-[95vh]">
                    
                    <div className="flex items-center justify-between border-b border-outline/50 pb-3 mb-4">
                      <h3 className="text-sm font-extrabold text-on-surface uppercase tracking-wide flex items-center gap-2">
                        <PenSquare className="w-4 h-4 text-primary" />
                        Atualizar Valores da Ação 8861 (SIOP Oficial)
                      </h3>
                      <button 
                        onClick={() => setIsEditSiopModalOpen(false)}
                        className="p-1 rounded-lg hover:bg-surface-container select-none text-on-surface-variant animate-none"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveSiopData} className="space-y-4 overflow-y-auto pr-1 flex-1">
                      <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <label className="block text-xs font-bold text-on-surface uppercase tracking-wide">
                            Exercício / Ano do Orçamento
                          </label>
                          <p className="text-[10px] text-on-surface-variant leading-none">
                            Selecione o exercício orçamentário que deseja consultar ou atualizar os valores do SIOP.
                          </p>
                        </div>
                        <select
                          value={formSiopYear}
                          onChange={e => {
                            const selectedY = e.target.value;
                            setFormSiopYear(selectedY);
                            loadSiopFieldsForYear(selectedY);
                          }}
                          className="bg-surface-container border border-outline rounded px-3 py-1.5 text-xs font-bold text-primary focus:outline-none focus:border-primary min-w-[160px] font-mono cursor-pointer"
                        >
                          <option value="2024">2024 (Histórico)</option>
                          <option value="2025">2025 (Transição)</option>
                          <option value="2026">2026 (Corrente)</option>
                          <option value="2027">2027 (Planejado)</option>
                          <option value="2028">2028 (Futuro)</option>
                        </select>
                      </div>

                      <p className="text-xs text-on-surface-variant leading-relaxed animate-none">
                        Insira os dados segregados obtidos diretamente do Painel do Orçamento Federal (SIOP). Os totais gerais serão calculados de forma automática para garantir consistência. Cada envio cria um registro indelével no histórico para auditoria.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        {/* Custeio Column */}
                        <div className="space-y-4 p-4 rounded-xl border border-blue-500/10 bg-blue-500/[0.01]">
                          <h4 className="text-xs font-extrabold text-blue-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-blue-500/10 pb-1.5">
                            <span className="w-1.5 h-3 bg-blue-500 rounded-full" />
                            3 - Outras Despesas Correntes (Custeio)
                          </h4>
                          
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-on-surface-variant/90 tracking-wide">
                                Dotação Inicial
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant/60 font-mono">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full pl-9 pr-3 py-1.5 border rounded-lg border-outline bg-surface text-on-surface text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  value={formDotacaoInicialCusteio}
                                  onChange={e => setFormDotacaoInicialCusteio(e.target.value)}
                                  required
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-on-surface-variant/90 tracking-wide">
                                Dotação Atualizada
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant/60 font-mono">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full pl-9 pr-3 py-1.5 border rounded-lg border-outline bg-surface text-on-surface text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  value={formDotacaoAtualCusteio}
                                  onChange={e => setFormDotacaoAtualCusteio(e.target.value)}
                                  required
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-on-surface-variant/90 tracking-wide">
                                Valor Empenhado
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant/60 font-mono">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full pl-9 pr-3 py-1.5 border rounded-lg border-outline bg-surface text-on-surface text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  value={formEmpenhadoCusteio}
                                  onChange={e => setFormEmpenhadoCusteio(e.target.value)}
                                  required
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-on-surface-variant/90 tracking-wide">
                                Valor Liquidado
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant/60 font-mono">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full pl-9 pr-3 py-1.5 border rounded-lg border-outline bg-surface text-on-surface text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  value={formLiquidadoCusteio}
                                  onChange={e => setFormLiquidadoCusteio(e.target.value)}
                                  required
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-on-surface-variant/90 tracking-wide">
                                Valor Pago
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant/60 font-mono">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full pl-9 pr-3 py-1.5 border rounded-lg border-outline bg-surface text-on-surface text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  value={formPagoCusteio}
                                  onChange={e => setFormPagoCusteio(e.target.value)}
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Investimento Column */}
                        <div className="space-y-4 p-4 rounded-xl border border-purple-500/10 bg-purple-500/[0.01]">
                          <h4 className="text-xs font-extrabold text-purple-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-purple-500/10 pb-1.5">
                            <span className="w-1.5 h-3 bg-purple-500 rounded-full" />
                            4 - Investimentos (Investimento)
                          </h4>
                          
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-on-surface-variant/90 tracking-wide">
                                Dotação Inicial
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant/60 font-mono">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full pl-9 pr-3 py-1.5 border rounded-lg border-outline bg-surface text-on-surface text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  value={formDotacaoInicialInvestimento}
                                  onChange={e => setFormDotacaoInicialInvestimento(e.target.value)}
                                  required
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-on-surface-variant/90 tracking-wide">
                                Dotação Atualizada
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant/60 font-mono">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full pl-9 pr-3 py-1.5 border rounded-lg border-outline bg-surface text-on-surface text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  value={formDotacaoAtualInvestimento}
                                  onChange={e => setFormDotacaoAtualInvestimento(e.target.value)}
                                  required
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-on-surface-variant/90 tracking-wide">
                                Valor Empenhado
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant/60 font-mono">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full pl-9 pr-3 py-1.5 border rounded-lg border-outline bg-surface text-on-surface text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  value={formEmpenhadoInvestimento}
                                  onChange={e => setFormEmpenhadoInvestimento(e.target.value)}
                                  required
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-on-surface-variant/90 tracking-wide">
                                Valor Liquidado
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant/60 font-mono">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full pl-9 pr-3 py-1.5 border rounded-lg border-outline bg-surface text-on-surface text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  value={formLiquidadoInvestimento}
                                  onChange={e => setFormLiquidadoInvestimento(e.target.value)}
                                  required
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-on-surface-variant/90 tracking-wide">
                                Valor Pago
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant/60 font-mono">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full pl-9 pr-3 py-1.5 border rounded-lg border-outline bg-surface text-on-surface text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  value={formPagoInvestimento}
                                  onChange={e => setFormPagoInvestimento(e.target.value)}
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Computed Totals Preview Table */}
                      <div className="p-4 bg-surface-container/40 rounded-xl border border-outline/30 space-y-2 mt-4">
                        <div className="flex items-center gap-1.5 border-b border-outline/30 pb-2 mb-2">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Visualização do Total Consolidado (Custeio + Investimento)</h4>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                          <div className="bg-surface-container-low border border-outline/25 p-2 rounded-lg">
                            <span className="text-[9px] uppercase font-bold text-on-surface-variant/80 block">Dotação Inicial</span>
                            <span className="text-xs font-bold font-mono text-on-surface">{formatCurrency(computedTotalDotacaoInicial)}</span>
                          </div>
                          <div className="bg-surface-container-low border border-outline/25 p-2 rounded-lg">
                            <span className="text-[9px] uppercase font-bold text-on-surface-variant/80 block">Dotação Atualizada</span>
                            <span className="text-xs font-bold font-mono text-primary">{formatCurrency(computedTotalDotacaoAtual)}</span>
                          </div>
                          <div className="bg-surface-container-low border border-outline/25 p-2 rounded-lg">
                            <span className="text-[9px] uppercase font-bold text-on-surface-variant/80 block">Valor Empenhado</span>
                            <span className="text-xs font-bold font-mono text-teal-600 dark:text-teal-400">{formatCurrency(computedTotalEmpenhado)}</span>
                          </div>
                          <div className="bg-surface-container-low border border-outline/25 p-2 rounded-lg">
                            <span className="text-[9px] uppercase font-bold text-on-surface-variant/80 block">Valor Liquidado</span>
                            <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">{formatCurrency(computedTotalLiquidado)}</span>
                          </div>
                          <div className="bg-surface-container-low border border-outline/25 p-2 rounded-lg col-span-2 sm:col-span-1">
                            <span className="text-[9px] uppercase font-bold text-on-surface-variant/80 block">Valor Pago</span>
                            <span className="text-xs font-bold font-mono text-rose-500">{formatCurrency(computedTotalPago)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-outline/50 pt-3 mt-4">
                        {siopRecords.length > 0 || siopHistory.length > 0 ? (
                          <button
                            type="button"
                            onClick={handleResetSiopData}
                            className="px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/10 rounded-xl transition-all self-start sm:self-auto"
                            disabled={isSavingSiop}
                          >
                            Zerar Dados Existentes
                          </button>
                        ) : (
                          <div />
                        )}
                        
                        <div className="flex items-center justify-end gap-2 text-right">
                          <button
                            type="button"
                            onClick={() => setIsEditSiopModalOpen(false)}
                            className="px-4 py-2 text-xs font-bold rounded-xl border border-outline hover:bg-surface-container"
                            disabled={isSavingSiop}
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-on-primary hover:opacity-95 flex items-center gap-1.5"
                            disabled={isSavingSiop}
                          >
                            {isSavingSiop ? 'Salvando...' : 'Salvar Informações'}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Dynamic KPI summary row */}
      <div className={`grid grid-cols-1 ${sumAnnualizedPlanejamentos > 0 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'} gap-4 sm:gap-6`}>
        
        {/* KPI Panel 1: Soma Contratos Vigentes */}
        <div className="flex items-center justify-between p-6 bg-surface border border-outline rounded-2xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-24 w-24 bg-primary/5 rounded-bl-full group-hover:bg-primary/10 transition-colors duration-300 pointer-events-none" />
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">Total Anualizado Contratos</span>
            <span className="text-2xl font-black text-on-surface font-mono tracking-tight block">
              {formatCurrency(sumAnnualizedContracts)}
            </span>
            <span className="text-[10px] text-on-surface-variant block">
              Contratos vigentes com desembolso ativo ({processedContracts.length} ativos)
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 select-none">
            <Handshake className="w-5 h-5" />
          </div>
        </div>

        {/* KPI Panel 2: Soma DFDs Anualizada (PCA) */}
        <div className="flex items-center justify-between p-6 bg-surface border border-outline rounded-2xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-24 w-24 bg-teal-500/5 rounded-bl-full group-hover:bg-teal-500/10 transition-colors duration-300 pointer-events-none" />
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-teal-950 dark:text-teal-400 uppercase tracking-wider block">Soma DFDs Anualizada (PCA)</span>
            <span className="text-2xl font-black text-on-surface font-mono tracking-tight block">
              {formatCurrency(sumAnnualizedDFDs)}
            </span>
            <span className="text-[10px] text-on-surface-variant block">
              Demandas ativas originadas do PCA ({baseProcessedDFDs.filter(d => d.Contabilizar_Orcamento !== false).length} itens)
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-700 dark:text-teal-400 shrink-0 select-none">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        {/* KPI Panel 3: Processos em Planejamento (SEI) - Visible when there are planning processes */}
        {sumAnnualizedPlanejamentos > 0 && (
          <div className="flex items-center justify-between p-6 bg-surface border border-amber-500/30 dark:border-amber-500/20 bg-amber-500/[0.02] rounded-2xl relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-24 w-24 bg-amber-500/5 rounded-bl-full group-hover:bg-amber-500/10 transition-colors duration-300 pointer-events-none" />
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-amber-950 dark:text-amber-400 uppercase tracking-wider block">Processos em Planejamento</span>
              <span className="text-2xl font-black text-amber-900 dark:text-amber-400 font-mono tracking-tight block">
                {formatCurrency(sumAnnualizedPlanejamentos)}
              </span>
              <span className="text-[10px] text-on-surface-variant block">
                Licitações e contratações em andamento ({processedPlanejamentos.filter(p => p.Contabilizar_Orcamento !== false).length} processos)
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0 select-none">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        )}

        {/* KPI Panel 4: Valor Anual Geral SOF */}
        <div className="flex items-center justify-between p-6 bg-surface border-2 border-emerald-500/40 dark:border-emerald-500/20 bg-emerald-500/[0.03] rounded-2xl relative overflow-hidden group shadow-xs">
          <div className="absolute right-0 top-0 h-24 w-24 bg-emerald-500/5 rounded-bl-full group-hover:bg-emerald-500/10 transition-colors duration-300 pointer-events-none" />
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-emerald-950 dark:text-emerald-400 uppercase tracking-widest block">Valor Anual Geral SOF</span>
            <span className="text-3xl font-black text-emerald-900 dark:text-emerald-400 font-mono tracking-tight block">
              {formatCurrency(valorAnualGeralSOF)}
            </span>
            <span className="text-[10px] text-on-surface-variant block">
              Total consolidado: Contratos + DFDs{sumAnnualizedPlanejamentos > 0 ? ' + Planejamentos' : ''} em {selectedYear === 'Todos' ? currentYear : selectedYear}
            </span>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-emerald-800 dark:text-emerald-400 shrink-0 select-none font-bold">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Natureza de Despesa Segregation Panel */}
      <div className="p-6 bg-surface border border-outline rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-4 bg-teal-500 rounded-full" />
          <h3 className="font-extrabold text-xs uppercase tracking-wider text-on-surface">Segregação por Natureza de Despesa (Custeio vs. Investimento)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl border border-blue-500/20 bg-blue-500/[0.02] space-y-3 hover:bg-blue-500/[0.04] transition-all duration-150">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <span className="text-[10px] font-bold text-blue-900 dark:text-blue-400 uppercase tracking-wider block">Custeio (Despesas Correntes)</span>
                <span className="text-lg sm:text-xl lg:text-2xl font-black font-mono text-slate-950 dark:text-on-surface block leading-tight truncate" title={formatCurrency(totalCusteioGeral)}>
                  {formatCurrency(totalCusteioGeral)}
                </span>
              </div>
              <span className="text-[11px] sm:text-xs font-bold font-mono bg-blue-100 dark:bg-blue-500/15 text-blue-900 dark:text-blue-400 px-2.5 py-1 rounded-xl shrink-0">
                {valorAnualGeralSOF > 0 ? ((totalCusteioGeral / valorAnualGeralSOF) * 100).toFixed(1) : '0.0'}%
              </span>
            </div>
            <div className="text-[11px] text-on-surface-variant space-y-1.5 pt-1">
              <div className="flex justify-between">
                <span>Planejado via DFDs (PCA):</span>
                <span className="font-mono font-bold text-slate-900 dark:text-on-surface">{formatCurrency(sumAnnualizedDFDsCusteio)}</span>
              </div>
              {sumAnnualizedPlansCusteio > 0 && (
                <div className="flex justify-between text-amber-800 dark:text-amber-400">
                  <span>Processos em Planejamento (SEI):</span>
                  <span className="font-mono font-bold">{formatCurrency(sumAnnualizedPlansCusteio)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Contratos Vigentes:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-on-surface">{formatCurrency(sumAnnualizedContractsCusteio)}</span>
              </div>
            </div>
            {/* Simple progress bar */}
            <div className="w-full bg-blue-500/10 rounded-full h-1.5 overflow-hidden">
              <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${valorAnualGeralSOF > 0 ? (totalCusteioGeral / valorAnualGeralSOF) * 100 : 0}%` }} />
            </div>
          </div>

          <div className="p-5 rounded-xl border border-purple-500/20 bg-purple-500/[0.02] space-y-3 hover:bg-purple-500/[0.04] transition-all duration-150">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <span className="text-[10px] font-bold text-purple-900 dark:text-purple-400 uppercase tracking-wider block">Investimento (Despesas de Capital)</span>
                <span className="text-lg sm:text-xl lg:text-2xl font-black font-mono text-slate-950 dark:text-on-surface block leading-tight truncate" title={formatCurrency(totalInvestimentoGeral)}>
                  {formatCurrency(totalInvestimentoGeral)}
                </span>
              </div>
              <span className="text-[11px] sm:text-xs font-bold font-mono bg-purple-100 dark:bg-purple-500/15 text-purple-900 dark:text-purple-400 px-2.5 py-1 rounded-xl shrink-0">
                {valorAnualGeralSOF > 0 ? ((totalInvestimentoGeral / valorAnualGeralSOF) * 100).toFixed(1) : '0.0'}%
              </span>
            </div>
            <div className="text-[11px] text-on-surface-variant space-y-1.5 pt-1">
              <div className="flex justify-between">
                <span>Planejado via DFDs (PCA):</span>
                <span className="font-mono font-bold text-slate-900 dark:text-on-surface">{formatCurrency(sumAnnualizedDFDsInvestimento)}</span>
              </div>
              {sumAnnualizedPlansInvestimento > 0 && (
                <div className="flex justify-between text-amber-800 dark:text-amber-400">
                  <span>Processos em Planejamento (SEI):</span>
                  <span className="font-mono font-bold">{formatCurrency(sumAnnualizedPlansInvestimento)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Contratos Vigentes:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-on-surface">{formatCurrency(sumAnnualizedContractsInvestimento)}</span>
              </div>
            </div>
            {/* Simple progress bar */}
            <div className="w-full bg-purple-500/10 rounded-full h-1.5 overflow-hidden">
              <div className="bg-purple-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${valorAnualGeralSOF > 0 ? (totalInvestimentoGeral / valorAnualGeralSOF) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* DFDs Table Panel */}
      <div className="bg-surface border border-outline rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-outline flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-container-low/30">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 bg-teal-500 rounded-full" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-on-surface">1. Planejamento de Demandas (DFDs)</h3>
          </div>
          <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end">
            {selectedYear !== 'Todos' && (
              <>
                <button
                  type="button"
                  onClick={() => setIsAddCustomDfdModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-teal-700 hover:text-white dark:text-teal-400 dark:hover:text-black border border-teal-600/30 hover:bg-teal-600 hover:border-teal-600 rounded-lg transition-all duration-150 cursor-pointer"
                  title="Adicionar novo item de demanda diretamente para o orçamento deste ano"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Item PLOA</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportModalTab('dfd');
                    setIsImportDfdModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-teal-700 hover:text-white dark:text-teal-400 dark:hover:text-black border border-teal-600/30 hover:bg-teal-600 hover:border-teal-600 rounded-lg transition-all duration-150 cursor-pointer"
                  title="Importar DFDs de outros exercícios para o orçamento deste ano"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Importar DFDs</span>
                </button>
              </>
            )}
            <span className="text-[10px] bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2.5 py-1.5 rounded-lg font-bold font-mono">
              Subtotal: {formatCurrency(subtotalDFDsOnly)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50 border-b border-outline">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-center w-16">
                  Ativo
                </th>
                <th onClick={() => handleSortDfd('Num_DFD')} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:text-primary transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Nº DFD</span>
                    {dfdSortKey === 'Num_DFD' && (
                      dfdSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSortDfd('Descricao_Objeto')} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:text-primary transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Objeto de TIC</span>
                    {dfdSortKey === 'Descricao_Objeto' && (
                      dfdSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSortDfd('Periodicidade_Pagamento')} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:text-primary transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Frequência Pagamento</span>
                    {dfdSortKey === 'Periodicidade_Pagamento' && (
                      dfdSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSortDfd('Data_conclusao_estimada' as any)} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:text-primary transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Início / Conclusão Estimada</span>
                    {dfdSortKey === 'Data_conclusao_estimada' && (
                      dfdSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSortDfd('Valor_Estimado')} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-right cursor-pointer hover:text-primary transition-colors">
                  <div className="flex items-center gap-1 justify-end">
                    <span>Valor Estimado</span>
                    {dfdSortKey === 'Valor_Estimado' && (
                      dfdSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSortDfd('valor_anualizado')} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 text-right cursor-pointer hover:text-primary transition-colors">
                  <div className="flex items-center gap-1 justify-end">
                    <span>Valor Anualizado</span>
                    {dfdSortKey === 'valor_anualizado' && (
                      dfdSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Observações / Situação
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/50">
              {sortedDFDs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-xs text-on-surface-variant/70 italic font-medium">
                    Nenhum DFD ativo com status "Não iniciado" ou "Iniciado" para o exercício de {selectedYear}.
                  </td>
                </tr>
              ) : (
                sortedDFDs.map(d => (
                  <tr key={d.id} className={`hover:bg-surface-container-low/40 transition-colors group ${d.Contabilizar_Orcamento === false ? 'bg-surface-container-low/10' : ''}`}>
                    <td className="px-5 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={d.Contabilizar_Orcamento !== false}
                        onChange={() => handleToggleContabilizar(d)}
                        className="rounded border-outline text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                        title={d.Contabilizar_Orcamento !== false ? "Clique para desativar este item do orçamento" : "Clique para ativar este item no orçamento"}
                      />
                    </td>
                    <td className={`px-5 py-3.5 text-xs font-bold font-mono ${d.Contabilizar_Orcamento === false ? 'text-on-surface-variant/50 line-through' : 'text-on-surface'}`}>
                      <div className="flex items-center gap-1 font-mono">
                        <button
                          type="button"
                          onClick={() => {
                            setViewingPdfFilename(d.Anexo_PDF_Nome || 'Documento_DFD_Anexo.pdf');
                            setViewingPdfObj(d);
                          }}
                          className={`text-primary hover:underline hover:text-primary-hover focus:outline-none text-left font-bold ${d.Contabilizar_Orcamento === false ? 'text-primary/50' : ''}`}
                          title="Clique para visualizar o PDF do DFD"
                        >
                          {d.Num_DFD}
                        </button>
                        <CopyButton text={d.Num_DFD} label="Número DFD" />
                      </div>
                    </td>
                    <td className={`px-5 py-3.5 text-xs font-medium max-w-[320px] truncate ${d.Contabilizar_Orcamento === false ? 'text-on-surface-variant/40 line-through' : 'text-on-surface'}`} title={d.Descricao_Objeto}>
                      {d.Descricao_Objeto}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-on-surface-variant">
                      <span className={`px-2 py-0.5 rounded-md border border-outline-variant text-[10px] font-semibold ${d.Contabilizar_Orcamento === false ? 'bg-surface-container-low/30 text-on-surface-variant/40' : 'bg-surface-container-low text-on-surface'}`}>
                        {d.Periodicidade_Pagamento}
                      </span>
                    </td>
                    <td className={`px-5 py-3.5 text-xs font-mono ${d.Contabilizar_Orcamento === false ? 'text-on-surface-variant/40 line-through' : 'text-on-surface'}`}>
                      {formatDate(d.Data_conclusao_estimada)}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono">
                      {editingDfdId === d.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="text"
                            value={editingDfdValue}
                            onChange={(e) => setEditingDfdValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveCustomValue(d);
                              if (e.key === 'Escape') setEditingDfdId(null);
                            }}
                            className="w-28 px-1.5 py-1 text-xs border border-outline rounded bg-surface text-right font-mono focus:outline-none focus:border-primary"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveCustomValue(d)}
                            className="p-1 hover:bg-success/15 rounded"
                            title="Salvar"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          </button>
                          <button
                            onClick={() => setEditingDfdId(null)}
                            className="p-1 hover:bg-error/15 rounded"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2 group/value">
                          <div className="text-right">
                            {d.Valor_Customizado !== undefined && d.Valor_Customizado !== null ? (
                              <>
                                <div className="font-extrabold text-amber-600 dark:text-amber-400" title="Valor reduzido/alterado para orçamento atual">
                                  {formatCurrency(d.Valor_Customizado)}
                                </div>
                                <div className="text-[10px] text-on-surface-variant/60 line-through" title="Valor original do DFD/PCA">
                                  {formatCurrency(d.Valor_Estimado)}
                                </div>
                              </>
                            ) : (
                              <div className={`font-semibold ${d.Contabilizar_Orcamento === false ? 'text-on-surface-variant/40 line-through' : 'text-on-surface'}`}>
                                {formatCurrency(d.Valor_Estimado)}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/value:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingDfdId(d.id);
                                setEditingDfdValue(
                                  d.Valor_Customizado !== undefined && d.Valor_Customizado !== null
                                    ? String(d.Valor_Customizado)
                                    : String(d.Valor_Estimado)
                                );
                              }}
                              className="p-1 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded transition-colors"
                              title="Alterar valor para o orçamento"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>

                            {d.isBudgetOnlyItem && (
                              <button
                                onClick={async () => {
                                  if (confirm("Tem certeza que deseja excluir este item adicionado?")) {
                                    try {
                                      await deleteDoc(doc(db, 'dfds', d.id));
                                    } catch (err) {
                                      console.error("Erro ao excluir DFD customizado:", err);
                                    }
                                  }
                                }}
                                className="p-1 text-on-surface-variant hover:text-error hover:bg-error/10 rounded transition-colors cursor-pointer"
                                title="Excluir item adicionado"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            )}
                            
                            {d.Valor_Customizado !== undefined && d.Valor_Customizado !== null && (
                              <button
                                onClick={() => handleRestoreOriginalValue(d)}
                                className="p-1 text-on-surface-variant hover:text-amber-600 hover:bg-amber-500/10 rounded transition-colors"
                                title="Restaurar para o valor original do DFD"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className={`px-5 py-3.5 text-xs font-extrabold font-mono text-right bg-teal-500/[0.01] ${d.Contabilizar_Orcamento === false ? 'text-on-surface-variant/40 line-through' : 'text-teal-600 dark:text-teal-400'}`}>
                      {formatCurrency(d.valor_anualizado)}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium">
                      {d.Contabilizar_Orcamento === false ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold text-[10px]">
                          Desativado do Orçamento
                        </span>
                      ) : (
                        <span className="text-on-surface-variant/70 text-[11px] italic">
                          {d.observacoes_planejamento || 'DFD Ativo (A Planejar)'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Planejamentos (Licitações em Andamento) Table Panel */}
      <div className="bg-surface border border-outline rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-outline flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-container-low/30">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-on-surface">2. Processos de Planejamento (Licitações em Andamento)</h3>
          </div>
          <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end">
            {selectedYear !== 'Todos' && (
              <>
                <button
                  type="button"
                  onClick={() => setIsAddCustomPlanModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-amber-700 hover:text-white dark:text-amber-400 dark:hover:text-black border border-amber-600/30 hover:bg-amber-600 hover:border-amber-600 rounded-lg transition-all duration-150 cursor-pointer"
                  title="Adicionar novo processo de planejamento diretamente para o orçamento deste ano"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Item PLOA</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportModalTab('planejamento');
                    setIsImportDfdModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-amber-700 hover:text-white dark:text-amber-400 dark:hover:text-black border border-amber-600/30 hover:bg-amber-600 hover:border-amber-600 rounded-lg transition-all duration-150 cursor-pointer"
                  title="Importar processos de planejamento de outros exercícios para o orçamento deste ano"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Importar Processos</span>
                </button>
              </>
            )}
            <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1.5 rounded-lg font-bold font-mono">
              Subtotal: {formatCurrency(subtotalPlanejamentosOnly)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50 border-b border-outline">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-center w-16">
                  Ativo
                </th>
                <th onClick={() => handleSortPlan('Num_DFD')} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:text-primary transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Nº Processo SEI</span>
                    {planSortKey === 'Num_DFD' && (
                      planSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSortPlan('Descricao_Objeto')} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:text-primary transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Objeto de TIC</span>
                    {planSortKey === 'Descricao_Objeto' && (
                      planSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSortPlan('Periodicidade_Pagamento')} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:text-primary transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Frequência Pagamento</span>
                    {planSortKey === 'Periodicidade_Pagamento' && (
                      planSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSortPlan('Data_conclusao_estimada' as any)} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:text-primary transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Início</span>
                    {planSortKey === 'Data_conclusao_estimada' && (
                      planSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSortPlan('Valor_Estimado')} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-right cursor-pointer hover:text-primary transition-colors">
                  <div className="flex items-center gap-1 justify-end">
                    <span>Valor Estimado</span>
                    {planSortKey === 'Valor_Estimado' && (
                      planSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSortPlan('valor_anualizado')} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 text-right cursor-pointer hover:text-primary transition-colors">
                  <div className="flex items-center gap-1 justify-end">
                    <span>Valor Anualizado</span>
                    {planSortKey === 'valor_anualizado' && (
                      planSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Observações / Situação
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/50">
              {sortedPlanejamentos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-xs text-on-surface-variant/70 italic font-medium">
                    Nenhum processo de planejamento ativo para o exercício de {selectedYear}.
                  </td>
                </tr>
              ) : (
                sortedPlanejamentos.map(d => (
                  <tr key={d.id} className={`hover:bg-surface-container-low/40 transition-colors group ${d.Contabilizar_Orcamento === false ? 'bg-surface-container-low/10' : ''}`}>
                    <td className="px-5 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={d.Contabilizar_Orcamento !== false}
                        onChange={() => handleToggleContabilizar(d)}
                        className="rounded border-outline text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                        title={d.Contabilizar_Orcamento !== false ? "Clique para desativar este item do orçamento" : "Clique para ativar este item no orçamento"}
                      />
                    </td>
                    <td className={`px-5 py-3.5 text-xs font-bold font-mono ${d.Contabilizar_Orcamento === false ? 'text-on-surface-variant/50 line-through' : 'text-on-surface'}`}>
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                          {d.Num_DFD}
                        </span>
                        <CopyButton text={d.Num_DFD} label="Número DFD/SEI" />
                      </div>
                    </td>
                    <td className={`px-5 py-3.5 text-xs font-medium max-w-[320px] truncate ${d.Contabilizar_Orcamento === false ? 'text-on-surface-variant/40 line-through' : 'text-on-surface'}`} title={d.Descricao_Objeto}>
                      {d.Descricao_Objeto}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-on-surface-variant">
                      <span className={`px-2 py-0.5 rounded-md border border-outline-variant text-[10px] font-semibold ${d.Contabilizar_Orcamento === false ? 'bg-surface-container-low/30 text-on-surface-variant/40' : 'bg-surface-container-low text-on-surface'}`}>
                        {d.Periodicidade_Pagamento}
                      </span>
                    </td>
                    <td className={`px-5 py-3.5 text-xs font-mono ${d.Contabilizar_Orcamento === false ? 'text-on-surface-variant/40 line-through' : 'text-on-surface'}`}>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={d.data_inicio_efetiva || ''}
                            onChange={(e) => handleUpdatePlanningSimDate(d.planejamento_id, e.target.value)}
                            className="px-2 py-1 text-xs border border-outline rounded bg-surface font-mono text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-36 shadow-sm"
                            title="Altere a data estimada de início para recalcular o desembolso proporcional no exercício"
                          />
                          {d.isOverriddenDate && (
                            <button
                              type="button"
                              onClick={() => handleResetPlanningSimDate(d.planejamento_id)}
                              className="p-1 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 rounded transition-colors"
                              title="Restaurar data padrão da simulação"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {d.isOverriddenDate ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20">
                              Data Personalizada
                            </span>
                          ) : d.isTodayDefaultDate ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" title="Processo sem data de início fixada: considerando a data de hoje para a simulação">
                              Hoje (Simulado)
                            </span>
                          ) : d.isSessionDate ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                              Data Cadastrada
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono">
                      {editingDfdId === d.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="text"
                            value={editingDfdValue}
                            onChange={(e) => setEditingDfdValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveCustomValue(d);
                              if (e.key === 'Escape') setEditingDfdId(null);
                            }}
                            className="w-28 px-1.5 py-1 text-xs border border-outline rounded bg-surface text-right font-mono focus:outline-none focus:border-primary"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveCustomValue(d)}
                            className="p-1 hover:bg-success/15 rounded"
                            title="Salvar"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          </button>
                          <button
                            onClick={() => setEditingDfdId(null)}
                            className="p-1 hover:bg-error/15 rounded"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2 group/value">
                          <div className="text-right">
                            {d.Valor_Customizado !== undefined && d.Valor_Customizado !== null ? (
                              <>
                                <div className="font-extrabold text-amber-600 dark:text-amber-400" title="Valor reduzido/alterado para orçamento atual">
                                  {formatCurrency(d.Valor_Customizado)}
                                </div>
                                <div className="text-[10px] text-on-surface-variant/60 line-through" title="Valor original do PCA">
                                  {formatCurrency(d.Valor_Estimado)}
                                </div>
                              </>
                            ) : (
                              <div className={`font-semibold ${d.Contabilizar_Orcamento === false ? 'text-on-surface-variant/40 line-through' : 'text-on-surface'}`}>
                                {formatCurrency(d.Valor_Estimado)}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/value:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingDfdId(d.id);
                                setEditingDfdValue(
                                  d.Valor_Customizado !== undefined && d.Valor_Customizado !== null
                                    ? String(d.Valor_Customizado)
                                    : String(d.Valor_Estimado)
                                );
                              }}
                              className="p-1 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded transition-colors"
                              title="Alterar valor para o orçamento"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>

                            {d.isBudgetOnlyItem && (
                              <button
                                onClick={async () => {
                                  if (confirm("Tem certeza que deseja excluir este processo de planejamento adicionado?")) {
                                    try {
                                      await deleteDoc(doc(db, 'planejamentos', d.id.replace('plan_', '')));
                                    } catch (err) {
                                      console.error("Erro ao excluir Planejamento customizado:", err);
                                    }
                                  }
                                }}
                                className="p-1 text-on-surface-variant hover:text-error hover:bg-error/10 rounded transition-colors cursor-pointer"
                                title="Excluir item adicionado"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            )}
                            
                            {d.Valor_Customizado !== undefined && d.Valor_Customizado !== null && (
                              <button
                                onClick={() => handleRestoreOriginalValue(d)}
                                className="p-1 text-on-surface-variant hover:text-amber-600 hover:bg-amber-500/10 rounded transition-colors"
                                title="Restaurar para o valor original"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className={`px-5 py-3.5 text-xs font-mono text-right bg-amber-500/[0.01]`}>
                      <div className={`font-extrabold ${d.Contabilizar_Orcamento === false ? 'text-on-surface-variant/40 line-through' : 'text-amber-600 dark:text-amber-400'}`}>
                        {formatCurrency(d.valor_anualizado)}
                      </div>
                      {d.calculo_detalhado && d.Contabilizar_Orcamento !== false && (
                        <div className="text-[9.5px] text-on-surface-variant/75 font-normal mt-0.5" title="Memória de cálculo proporcional">
                          {d.calculo_detalhado}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium">
                      {d.Contabilizar_Orcamento === false ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold text-[10px]">
                          Desativado do Orçamento
                        </span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-[10px] w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            {d.observacoes_planejamento}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contracts Table Panel */}
      <div className="bg-surface border border-outline rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-outline flex items-center justify-between bg-surface-container-low/30">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 bg-primary rounded-full" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-on-surface">3. Contratos Vigentes e Ativos (Desembolso no Exercício)</h3>
          </div>
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold font-mono">
            Subtotal: {formatCurrency(sumAnnualizedContracts)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50 border-b border-outline">
                <th onClick={() => handleSortContract('Num_Contrato')} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:text-primary transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Nº Contrato</span>
                    {contractSortKey === 'Num_Contrato' && (
                      contractSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSortContract('Fornecedor')} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:text-primary transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Empresa / Fornecedor</span>
                    {contractSortKey === 'Fornecedor' && (
                      contractSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSortContract('Objeto')} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:text-primary transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Objeto Regulamentar</span>
                    {contractSortKey === 'Objeto' && (
                      contractSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSortContract('Status_Contrato' as any)} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-center cursor-pointer hover:text-primary transition-colors">
                  <div className="flex items-center gap-1 justify-center">
                    <span>Status</span>
                    {contractSortKey === 'Status_Contrato' && (
                      contractSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSortContract('valor_anual_sof')} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-primary text-right cursor-pointer hover:text-primary transition-colors">
                  <div className="flex items-center gap-1 justify-end">
                    <span>Valor Anual SOF</span>
                    {contractSortKey === 'valor_anual_sof' && (
                      contractSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/50">
              {sortedContracts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-xs text-on-surface-variant/70 italic font-medium">
                    Nenhum contrato ativo requerendo desembolsos para o exercício de {selectedYear}.
                  </td>
                </tr>
              ) : (
                sortedContracts.map(c => {
                  const fornObj = fornecedores.find(f => f.id === c.Fornecedor);
                  const fornName = fornObj ? fornObj.Nome_Fornecedor : c.Fornecedor;
                  
                  // Calculate daysLeft for status and expiration
                  const daysLeft = c.Vigencia_Final 
                    ? Math.ceil((new Date(c.Vigencia_Final).getTime() - new Date(currentLocalTime).getTime()) / (1000 * 60 * 60 * 24)) 
                    : 0;

                  const prorrogaMeses = (aditivos || [])
                    .filter(ad => (ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
                    .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
                  const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(c.Numero_Renovacoes) || 0);

                  const actualEndVal = new Date(c.Vigencia_Inicio);
                  actualEndVal.setUTCMonth(actualEndVal.getUTCMonth() + (Number(c.Vigencia_Inicial_Meses) || 12) + totalRenovacaoMeses);
                  
                  const canBeRenewed = checkIfContractCanBeRenewed(c);
                  const isExtendedBySim = simulateRenewals && canBeRenewed;
                  
                  const displayEndVal = isExtendedBySim ? getSimulatedContractEndDate(c, actualEndVal) : (c.Vigencia_Final ? new Date(c.Vigencia_Final) : actualEndVal);

                  return (
                    <tr key={c.id} className="hover:bg-surface-container-low/40 transition-colors group">
                      <td className="px-5 py-3.5 text-xs font-bold text-on-surface font-mono">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedContractId(c.id)}
                            className="text-primary hover:underline hover:text-primary-hover font-bold text-left focus:outline-none"
                            title="Clique para ver o detalhamento do contrato"
                          >
                            {c.Num_Contrato}
                          </button>
                          <CopyButton text={c.Num_Contrato} label="Contrato" />
                        </div>
                        {c.SEI_Processo && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] text-on-surface-variant font-normal">{c.SEI_Processo}</span>
                            <CopyButton text={c.SEI_Processo} label="Processo SEI" />
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-on-surface font-extrabold">
                        {fornName}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-on-surface font-medium max-w-[340px]">
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => setSelectedContractId(c.id)}
                            className="text-left font-medium hover:text-primary hover:underline focus:outline-none truncate max-w-full block text-xs"
                            title={c.Objeto}
                          >
                            {c.Objeto}
                          </button>
                          <div className="text-[10px] text-on-surface-variant/70 mt-0.5 font-normal">
                            Início: {formatDate(c.Vigencia_Inicio)} | Frequência: {c.Periodicidade_Pagamento}
                          </div>
                          {isExtendedBySim && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/25 text-purple-600 dark:text-purple-400 font-bold text-[8px] tracking-wide uppercase">
                                🔄 Prorrogação Simulada (Prorrogável)
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {isExtendedBySim ? (
                            <span className="inline-flex px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold text-[9px]">
                              Simulado
                            </span>
                          ) : c.Status_Contrato === 'A Vencer' ? (
                            <div className="flex flex-col items-center gap-0.5 animate-in fade-in" title={`Contrato ativo expirando em ${daysLeft} dias.`}>
                              <span className="inline-flex px-2 py-0.5 rounded bg-amber-400/10 border border-amber-500/20 text-amber-300 font-bold text-[9px] animate-pulse">
                                A Vencer
                              </span>
                              <span className="text-[9px] text-amber-500 font-bold whitespace-nowrap leading-none">
                                ({daysLeft} d restantes)
                              </span>
                            </div>
                          ) : c.Status_Contrato === 'Vigente' ? (
                            <span className="inline-flex px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 text-teal-300 font-bold text-[9px]">
                              Vigente
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded bg-surface-container border border-outline-variant text-on-surface-variant font-bold text-[9px]">
                              {c.Status_Contrato || 'Encerrado'}
                            </span>
                          )}
                          
                          {/* Expiration Date observation below the status */}
                          {displayEndVal && (
                            <span className={`text-[9px] italic whitespace-nowrap mt-0.5 block leading-none ${isExtendedBySim ? 'text-purple-500 font-semibold' : 'text-on-surface-variant/70'}`}>
                              Vence: {formatDate(displayEndVal.toISOString())}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-extrabold text-primary font-mono text-right bg-primary/[0.01]">
                        {formatCurrency(c.valor_anual_sof)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Powerpuff visual representation of total sum action 8861 */}
      <div className="flex flex-col md:flex-row p-6 bg-surface-container-low border border-outline rounded-3xl justify-between items-center gap-6">
        <div className="space-y-1">
          <p className="text-[10px] font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase">Sustentação do Planejamento Nacional</p>
          <h4 className="text-base font-extrabold text-on-surface">Consolidação e Integridade Fidedigna de Desembolso</h4>
          <p className="text-xs text-on-surface-variant">
            Esta tela reflete o valor total anual exigido pela Secretaria de Orçamento Federal (SOF) para manter os serviços de tecnologia da informação em pleno funcionamento.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Valor Anual Geral SOF</span>
          <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatCurrency(valorAnualGeralSOF)}
          </span>
        </div>
      </div>

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
                  className="px-3 py-1.5 bg-surface-container border border-outline hover:bg-surface text-[11px] font-bold text-on-surface rounded flex items-center gap-1 cursor-pointer transition-all hover:scale-102 active:scale-95 text-xs text-on-surface hover:text-primary transition-colors hover:border-primary shrink-0"
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
                <div className="bg-white text-gray-900 w-full max-w-2xl p-8 md:p-12 shadow-xl rounded-sm min-h-[750px] flex flex-col justify-between select-text" id="pdf-doc-panel">
                  {/* Document Header block */}
                  <div className="border-b border-gray-200 pb-6 shrink-0 flex items-center justify-between gap-4">
                    <div className="text-left font-serif space-y-1 bg-transparent text-gray-900">
                      <h2 className="text-xs font-bold text-gray-700 tracking-wide uppercase font-sans">Secretaria de Orçamento Federal</h2>
                      <p className="text-[10px] text-gray-500 font-sans">Ministério do Planejamento e Orçamento (MPO)</p>
                      <p className="text-[9px] text-gray-400 font-sans font-medium">SOF — TIC / GECTI — Diretoria de Tecnologia</p>
                    </div>
                    <div className="text-right font-serif space-y-0.5 text-gray-900 bg-transparent">
                      <h3 className="text-xs font-black text-gray-900 uppercase font-sans tracking-wider">
                        Ministério do Planejamento
                      </h3>
                      <p className="text-[9px] text-gray-500 font-sans font-serif">Esplanada dos Ministérios, Bloco K — Brasília, DF</p>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="text-center space-y-1 my-6 text-gray-900 bg-transparent">
                    <strong className="text-[11px] uppercase tracking-wider font-sans text-teal-600 block">
                      Documento de Formalização da Demanda (DFD)
                    </strong>
                    <h1 className="text-base font-extrabold text-gray-950 tracking-tight font-sans">
                      DFD Nº {viewingPdfObj.Num_DFD}
                    </h1>
                    <span className="text-[10px] font-sans text-gray-500 font-mono block">Ano do PCA de Alinhamento: {viewingPdfObj.Ano_PCA}</span>
                  </div>

                  {/* Metadata Table */}
                  <div className="my-6 border border-gray-300 rounded font-sans text-[10px] text-gray-700 divide-y divide-gray-200 overflow-hidden bg-gray-50/50">
                    <div className="grid grid-cols-3 divide-x divide-gray-200 bg-gray-100/50 p-2 font-medium">
                      <div>UASG Demandante:</div>
                      <div className="col-span-2 text-gray-950 font-semibold">{viewingPdfObj.UASG}</div>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-gray-200 p-2">
                      <div>Localização Estimada:</div>
                      <div className="col-span-2 text-gray-950 font-semibold font-sans">SOF (TIC / GECTI)</div>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-gray-200 bg-gray-100/50 p-2 border-t border-gray-200">
                      <div>Periodicidade:</div>
                      <div className="col-span-2 text-gray-950 font-semibold font-sans font-medium">{viewingPdfObj.Periodicidade_Pagamento}</div>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-gray-200 p-2 border-t border-gray-200">
                      <div>Valor Global Estimado:</div>
                      <div className="col-span-2 text-teal-700 font-semibold font-mono font-bold">{formatCurrency(viewingPdfObj.Valor_Estimado)}</div>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-gray-200 bg-gray-100/50 p-2 border-t border-gray-200">
                      <div>Valor Proporcional Anual:</div>
                      <div className="col-span-2 text-gray-950 font-semibold font-mono font-bold">{formatCurrency(viewingPdfObj.valor_anualizado)}</div>
                    </div>
                  </div>

                  {/* Body Clauses */}
                  <div className="space-y-6 text-xs text-gray-850 leading-relaxed text-justify mt-8">
                    <p>
                      <strong>1. Objeto da Contratação:</strong>
                      <br />
                      Fica formalizada a contratação de solução de Tecnologia da Informação descrita como: 
                      <span className="italic block pl-4 border-l-2 border-teal-600 my-2 text-gray-950 font-sans font-medium bg-gray-50/50 py-1 rounded">
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

      {/* Contract Detailed View Modal */}
      {selectedContractId && (
        (() => {
          const selectedContract = processedContracts.find(c => c.id === selectedContractId);
          if (!selectedContract) return null;
          
          const fornObj = fornecedores.find(f => f.id === selectedContract.Fornecedor);
          const fornName = fornObj ? fornObj.Nome_Fornecedor : selectedContract.Fornecedor;
          
          // Filter related items in this contract
          const selectedContractItens = (itensSOF || [])
            .filter(item => item.Num_Contrato === selectedContract.id || item.Num_Contrato === selectedContract.Num_Contrato)
            .sort((a, b) => {
              const itemDiff = a.Numero_Item.localeCompare(b.Numero_Item, undefined, { numeric: true, sensitivity: 'base' });
              if (itemDiff !== 0) return itemDiff;
              return (a.Grupo_Lote || '').localeCompare(b.Grupo_Lote || '', undefined, { numeric: true, sensitivity: 'base' });
            });

          return (
            <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-40 animate-in face-in duration-200">
              <div className="bg-surface border border-outline w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
                
                {/* Modal Header */}
                <div className="bg-surface-container px-6 py-4 border-b border-outline flex justify-between items-center shrink-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="font-extrabold text-on-surface text-base">Ficha Detalhada do Contrato</span>
                    <div className="flex gap-1.5 flex-wrap">
                      <span className="text-[10px] bg-surface-container-high border border-outline font-bold text-on-surface px-2 py-0.5 rounded font-mono leading-none">
                        SEI: {selectedContract.SEI_Processo}
                      </span>
                      <span className="text-[9px] bg-primary/20 border border-primary/40 font-mono font-bold text-primary px-2 py-0.5 rounded leading-none">
                        Ref: {selectedContract.Num_Contrato}
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={() => setSelectedContractId(null)} 
                    className="text-on-surface-variant hover:text-on-surface p-1.5 hover:bg-surface-container-high rounded-full transition-colors cursor-pointer"
                    aria-label="Fechar Detalhes"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Content - Scrollable */}
                <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1 bg-surface-container-low/20">
                  
                  {/* Retornar block */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container border border-outline p-4 rounded-xl">
                    <button
                      onClick={() => setSelectedContractId(null)}
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline hover:text-primary-hover font-medium font-sans"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Retornar para Orçamento Consolidado
                    </button>
                    <span className="text-xs font-mono font-bold text-on-surface-variant">
                      Dotação da Ação 8861
                    </span>
                  </div>

                  {/* Info bento grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Left pane: Identity and Fiscal Team (7 cols) */}
                    <div className="lg:col-span-7 bg-surface border border-outline rounded-xl p-6 space-y-4 shadow-sm">
                      <div>
                        <span className="text-[9px] bg-teal-500/10 border border-teal-500/30 text-teal-600 dark:text-teal-400 px-2.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">CONTRATO INSTITUCIONAL DE TIC</span>
                        <h3 className="text-base font-extrabold text-on-surface mt-2 leading-snug">{selectedContract.Objeto}</h3>
                        <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                          Fornecedor: <strong className="text-on-surface font-extrabold">{fornName}</strong>
                        </p>
                      </div>

                      {/* Fiscal members board */}
                      <div className="border-t border-outline/40 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1.5">
                          <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Gestão e Fiscalização Técnica</p>
                          <p className="text-on-surface leading-tight"><span className="text-on-surface-variant font-medium">Gestor Titular:</span> {selectedContract.Gestor_Contrato || 'Não indicado'}</p>
                          <p className="text-on-surface leading-tight"><span className="text-on-surface-variant font-medium">Gestor Substituto:</span> {selectedContract.Gestor_Substituto || 'Não indicado'}</p>
                          <p className="text-on-surface leading-tight"><span className="text-on-surface-variant font-medium">Fiscal Técnico:</span> {selectedContract.Fiscal_Tecnico || 'Não indicado'}</p>
                          <p className="text-on-surface leading-tight"><span className="text-on-surface-variant font-medium">Fiscal Técnico Subs:</span> {selectedContract.Fiscal_Tecnico_Substituto || 'Não indicado'}</p>
                        </div>
                        <div className="space-y-1.5 border-l border-outline/20 pl-4">
                          <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Fiscalização Administrativa</p>
                          <p className="text-on-surface leading-tight"><span className="text-on-surface-variant font-medium">Fiscal Adm:</span> {selectedContract.Fiscal_Administrativo || 'Não indicado'}</p>
                          <p className="text-on-surface leading-tight"><span className="text-on-surface-variant font-medium">Fiscal Adm Subs:</span> {selectedContract.Fiscal_Administrativo_Substituto || 'Não indicado'}</p>
                          <p className="text-on-surface leading-tight"><span className="text-on-surface-variant font-medium">Fiscal Requisitante:</span> {selectedContract.Fiscal_Requisitante || 'Não indicado'}</p>
                          <p className="text-on-surface leading-tight"><span className="text-on-surface-variant font-medium">Preposto:</span> {selectedContract.Preposto || 'Não indicado'}</p>
                          {selectedContract.EmailPreposto && (
                            <p className="text-on-surface"><span className="text-on-surface-variant font-medium">Preposto Email:</span> <a href={`mailto:${selectedContract.EmailPreposto}`} className="text-primary hover:underline font-mono text-[10px]">{selectedContract.EmailPreposto}</a></p>
                          )}
                        </div>
                      </div>

                      {/* General metadata indicators */}
                      <div className="border-t border-outline/30 pt-3 flex flex-wrap gap-4 text-xs text-on-surface-variant/80">
                        <p>Portaria Fiscalização: <strong>{selectedContract.Portaria_Fiscalizacao_Numero || '—'} ({selectedContract.Portaria_Fiscalizacao_SEI || '—'})</strong></p>
                        <p>Frequência Pagamento: <strong>{selectedContract.Periodicidade_Pagamento}</strong></p>
                        <p>Modalidade: <strong className="text-primary">{selectedContract.Modalidade_Contratacao || 'Pregão SOF'}</strong></p>
                      </div>
                    </div>

                    {/* Right pane: Operational and Financial metrics (5 cols) */}
                    <div className="lg:col-span-5 bg-surface border border-outline rounded-xl p-6 flex flex-col justify-between space-y-6 shadow-sm">
                      <div className="space-y-4">
                        
                        {/* Values details */}
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5 text-primary" />
                            Valor Financeiro do Contrato
                          </span>
                          <span className="text-xl font-bold font-mono text-on-surface block leading-tight">
                            {formatCurrency(selectedContract.Valor_Atualizado || selectedContract.Valor_Contrato)}
                          </span>
                          <span className="text-[10px] text-on-surface-variant/70 block">Valor Inicial Contratado: {formatCurrency(selectedContract.Valor_Contrato || 0)}</span>
                        </div>

                        {/* Annual SOF calculated values */}
                        <div className="space-y-1 pt-3 border-t border-outline/30">
                          <span className="text-[10px] uppercase font-bold text-teal-600 dark:text-teal-400 tracking-wider flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Valor Anual de Referência Ação 8861
                          </span>
                          <span className="text-lg font-bold font-mono text-teal-600 dark:text-teal-400 block leading-tight">
                            {formatCurrency(selectedContract.valor_anual_sof)}
                          </span>
                          <p className="text-[10px] text-on-surface-variant/75 leading-tight">
                            Este é o encargo anualizado proporcional imputável ao exercício financeiro corrente com base nas vigências vigentes.
                          </p>
                        </div>
                      </div>

                      {/* Core limits and vigência dates */}
                      <div className="border-t border-outline/30 pt-4 space-y-1.5 text-xs">
                        <span className="text-[10px] uppercase font-extrabold text-on-surface-variant tracking-widest block mb-1">Prazos e Validades</span>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-on-surface-variant font-medium">Início de Vigência:</span>
                          <span className="font-mono font-semibold text-teal-600 dark:text-teal-400">{formatDate(selectedContract.Vigencia_Inicio)}</span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-on-surface-variant font-medium">Vencimento Fim Inicial:</span>
                          <span className="font-mono font-semibold">
                            {formatDate(getVigenciaFinalInicial(selectedContract.Vigencia_Inicio, selectedContract.Vigencia_Inicial_Meses))}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-on-surface-variant font-medium">Vencimento Com Aditivos:</span>
                          <span className="font-mono font-semibold text-primary font-bold">
                            {selectedContract.Vigencia_Final ? formatDate(selectedContract.Vigencia_Final.toISOString()) : formatDate(getVigenciaFinal(selectedContract.Vigencia_Inicio, selectedContract.Vigencia_Inicial_Meses, selectedContract.Numero_Renovacoes).toISOString())}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-rose-500/80">
                          <span>Prorrogável Teto Máximo:</span>
                          <span className="font-mono font-semibold">
                            {formatDate(getProrrogavelAte(selectedContract.Vigencia_Inicio, selectedContract.Tempo_Possivel_Prorrogacao_Meses || 60))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items List detail table */}
                  <div className="bg-surface border border-outline rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-3 border-b border-outline bg-surface-container/50 flex justify-between items-center">
                      <span className="font-extrabold text-xs text-on-surface uppercase tracking-wider">Itens Registrados no SOF para este Contrato</span>
                      <span className="text-[10px] bg-primary/10 text-primary px-2.5 py-0.5 rounded font-bold font-mono">
                        {selectedContractItens.length} itens ativos
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[800px] text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-surface-container-low/50 border-b border-outline">
                            <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Seq.</th>
                            <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Lote/Subitem</th>
                            <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Descrição Solução</th>
                            <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Und. Medida</th>
                            <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-right">Qtd.</th>
                            <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-right">Preço Unitário</th>
                            <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-right">Soma Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline/30">
                          {selectedContractItens.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="text-center py-8 text-on-surface-variant italic font-medium">
                                Nenhum subitem ativo registrado no SOF com controle de subplanilhas de custos.
                              </td>
                            </tr>
                          ) : (
                            selectedContractItens.map((i, index) => (
                              <tr key={i.id || index} className="hover:bg-surface-container-low/30 transition-colors">
                                <td className="px-4 py-2.5 font-bold font-mono text-on-surface-variant">
                                  {i.Numero_Item || index + 1}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-on-surface-variant">
                                  {i.Grupo_Lote || 'Único'}
                                </td>
                                <td className="px-4 py-2.5 text-on-surface font-medium max-w-[280px] break-words">
                                  {i.Descricao_Item}
                                </td>
                                <td className="px-4 py-2.5 text-on-surface-variant">
                                  {i.Unidade_Medida || 'Serviço'}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono font-medium text-on-surface-variant">
                                  {i.Quantidade}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono text-on-surface-variant font-bold">
                                  {formatCurrency(i.Valor_Unitario)}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono font-extrabold text-teal-600 dark:text-teal-400">
                                  {formatCurrency(i.Quantidade * i.Valor_Unitario)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* INTERACTIVE SPREADSHEET PROJECTION MODAL */}
      {isSpreadsheetOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/85 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-in fade-in zoom-in duration-200">
          <div className="bg-surface border border-outline rounded-3xl shadow-2xl w-full max-w-[98%] h-[92vh] flex flex-col overflow-hidden relative" id="projection-spreadsheet-container">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-outline bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-mono">
                    Planilha de Trabalho
                  </span>
                  <span className="text-xs text-on-surface-variant font-mono">
                    Ação: {spreadsheetAcao} | Exercício: {selectedYear === 'Todos' ? currentYear : selectedYear}
                  </span>
                </div>
                <h2 className="text-lg font-black tracking-tight text-on-surface uppercase">
                  Levantamento de Contratos Vigentes e Projeção {selectedYear === 'Todos' ? currentYear : selectedYear}
                </h2>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={resetSpreadsheet}
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Redefine a planilha para os dados originais dos contratos e DFDs do sistema"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Redefinir Dados</span>
                </button>

                <button
                  onClick={addSpreadsheetRow}
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/25 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Insere uma nova linha para planejar uma futura demanda"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Demanda</span>
                </button>

                <button
                  onClick={exportSpreadsheetToCSV}
                  type="button"
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm shadow-emerald-600/15"
                  title="Exporta a planilha atualizada para um arquivo Excel (CSV)"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportar para Excel</span>
                </button>

                <button
                  onClick={() => setIsSpreadsheetOpen(false)}
                  type="button"
                  className="p-1.5 bg-surface-container border border-outline rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all cursor-pointer"
                  title="Fechar Planilha"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Metadata Bar */}
            <div className="px-5 py-3 border-b border-outline bg-surface-container/30 flex flex-wrap items-center gap-6 shrink-0 text-xs font-medium">
              <div className="flex items-center gap-2">
                <span className="text-on-surface-variant font-semibold">Unidade Responsável:</span>
                <input
                  type="text"
                  value={spreadsheetUnidade}
                  onChange={(e) => setSpreadsheetUnidade(e.target.value)}
                  className="bg-surface-container border border-outline rounded-lg px-2.5 py-1 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-[240px] font-semibold text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-on-surface-variant font-semibold">Ação Orçamentária:</span>
                <input
                  type="text"
                  value={spreadsheetAcao}
                  onChange={(e) => setSpreadsheetAcao(e.target.value)}
                  className="bg-surface-container border border-outline rounded-lg px-2.5 py-1 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-[80px] font-semibold text-xs text-center"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-on-surface-variant font-semibold">Plano Orçamentário (PO):</span>
                <input
                  type="text"
                  value={spreadsheetPO}
                  onChange={(e) => setSpreadsheetPO(e.target.value)}
                  className="bg-surface-container border border-outline rounded-lg px-2.5 py-1 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-[60px] font-semibold text-xs text-center"
                />
              </div>
            </div>

            {/* Spreadsheet Grid Panel */}
            <div className="flex-1 overflow-auto p-4 bg-slate-950/40">
              {isLoadingSpreadsheet ? (
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                  <span className="text-xs text-on-surface-variant font-bold uppercase tracking-wider animate-pulse">
                    Carregando dados da planilha...
                  </span>
                </div>
              ) : spreadsheetItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
                  <FileSpreadsheet className="w-12 h-12 text-on-surface-variant/40" />
                  <div>
                    <h3 className="font-extrabold text-on-surface text-sm">Nenhum contrato ou DFD encontrado</h3>
                    <p className="text-xs text-on-surface-variant/80 mt-1">
                      Não há itens ativos para o exercício de {selectedYear}. Adicione novas demandas ou redefina os dados.
                    </p>
                  </div>
                  <button
                    onClick={addSpreadsheetRow}
                    className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl hover:bg-primary/90 transition-all cursor-pointer"
                  >
                    Adicionar Primeiro Item
                  </button>
                </div>
              ) : (
                <div className="min-w-[1550px]">
                  <table className="w-full text-left border-collapse table-fixed select-none">
                    <thead>
                      <tr className="bg-surface-container-low border border-outline text-[10px] font-bold uppercase text-on-surface-variant tracking-wider">
                        <th className="w-[45px] p-2 text-center border-r border-outline">Item</th>
                        <th className="w-[170px] p-2 border-r border-outline">Tipo da Demanda</th>
                        <th className="w-[140px] p-2 border-r border-outline">Processo SEI</th>
                        <th className="w-[110px] p-2 border-r border-outline">Nº Contrato</th>
                        <th className="w-[240px] p-2 border-r border-outline">Objeto Resumido</th>
                        <th className="w-[160px] p-2 border-r border-outline">Empresa Contratada</th>
                        <th className="w-[105px] p-2 border-r border-outline text-center">Vigência Início</th>
                        <th className="w-[105px] p-2 border-r border-outline text-center">Vigência Fim</th>
                        <th className="w-[110px] p-2 border-r border-outline">GND</th>
                        <th className="w-[125px] p-2 border-r border-outline text-right">Valor Global</th>
                        <th className="w-[130px] p-2 border-r border-outline text-center">Mês do Reajuste</th>
                        <th className="w-[145px] p-2 border-r border-outline text-center">Índice Reajuste</th>
                        <th className="w-[180px] p-2 border-r border-outline text-center">Observações</th>
                        <th className="w-[145px] p-2 border-r border-outline text-right text-emerald-600 dark:text-emerald-400">Gasto Estimado</th>
                        <th className="w-[45px] p-2 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline/40">
                      {spreadsheetItems.map((item) => (
                        <tr 
                          key={item.id} 
                          className="bg-surface border border-outline/30 hover:bg-surface-container-low/40 focus-within:bg-surface-container transition-all"
                        >
                          {/* Item number */}
                          <td className="p-1 border-r border-outline/30 text-center font-mono font-bold text-xs text-on-surface-variant/70 bg-surface-container-low/20">
                            {item.item}
                          </td>

                          {/* Tipo Demanda */}
                          <td className="p-1 border-r border-outline/30">
                            <select
                              value={item.tipoDemanda}
                              onChange={(e) => updateSpreadsheetItem(item.id, 'tipoDemanda', e.target.value)}
                              className="w-full bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary rounded-lg px-2 py-1 font-bold text-[11px] text-on-surface cursor-pointer"
                            >
                              <option value="Contrato Vigente/TED" className="bg-surface text-on-surface">Contrato Vigente/TED</option>
                              <option value="Nova Contratação/Novo TED" className="bg-surface text-on-surface">Nova Contratação/Novo TED</option>
                            </select>
                          </td>

                          {/* Processo SEI */}
                          <td className="p-1 border-r border-outline/30">
                            <input
                              type="text"
                              value={item.processoSei || ''}
                              onChange={(e) => updateSpreadsheetItem(item.id, 'processoSei', e.target.value)}
                              placeholder="00000.00000/0000"
                              className="w-full bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary rounded-lg px-2 py-1 font-mono text-xs text-on-surface"
                            />
                          </td>

                          {/* Nº Contrato */}
                          <td className="p-1 border-r border-outline/30">
                            <input
                              type="text"
                              value={item.numContrato || ''}
                              onChange={(e) => updateSpreadsheetItem(item.id, 'numContrato', e.target.value)}
                              placeholder="Ex: 12/2025"
                              className="w-full bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary rounded-lg px-2 py-1 font-mono text-xs text-on-surface font-semibold"
                            />
                          </td>

                          {/* Objeto Resumido */}
                          <td className="p-1 border-r border-outline/30">
                            <input
                              type="text"
                              value={item.objetoResumido || ''}
                              onChange={(e) => updateSpreadsheetItem(item.id, 'objetoResumido', e.target.value)}
                              className="w-full bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary rounded-lg px-2 py-1 text-xs text-on-surface font-medium truncate"
                              title={item.objetoResumido}
                            />
                          </td>

                          {/* Empresa Contratada */}
                          <td className="p-1 border-r border-outline/30">
                            <input
                              type="text"
                              value={item.empresaContratada || ''}
                              onChange={(e) => updateSpreadsheetItem(item.id, 'empresaContratada', e.target.value)}
                              className="w-full bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary rounded-lg px-2 py-1 text-xs text-on-surface"
                            />
                          </td>

                          {/* Vigencia Inicio */}
                          <td className="p-1 border-r border-outline/30 text-center">
                            <input
                              type="date"
                              value={item.vigenciaInicio || ''}
                              onChange={(e) => updateSpreadsheetItem(item.id, 'vigenciaInicio', e.target.value)}
                              className="w-full bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary rounded-lg px-1.5 py-1 font-mono text-xs text-on-surface text-center"
                            />
                          </td>

                          {/* Vigencia Fim */}
                          <td className="p-1 border-r border-outline/30 text-center">
                            <input
                              type="date"
                              value={item.vigenciaFim || ''}
                              onChange={(e) => updateSpreadsheetItem(item.id, 'vigenciaFim', e.target.value)}
                              className="w-full bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary rounded-lg px-1.5 py-1 font-mono text-xs text-on-surface text-center"
                            />
                          </td>

                          {/* GND */}
                          <td className="p-1 border-r border-outline/30">
                            <select
                              value={item.gnd}
                              onChange={(e) => updateSpreadsheetItem(item.id, 'gnd', e.target.value)}
                              className="w-full bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary rounded-lg px-2 py-1 font-mono text-[11px] text-on-surface cursor-pointer"
                            >
                              <option value="3 - Custeio" className="bg-surface text-on-surface">3 - Custeio</option>
                              <option value="4 - Investimento" className="bg-surface text-on-surface">4 - Investimento</option>
                            </select>
                          </td>

                          {/* Valor Global */}
                          <td className="p-1 border-r border-outline/30">
                            <div className="relative flex items-center bg-transparent focus-within:ring-1 focus-within:ring-primary rounded-lg">
                              <span className="absolute left-1.5 text-on-surface-variant/60 text-xs select-none">R$</span>
                              <input
                                type="number"
                                value={item.valorGlobal || 0}
                                onChange={(e) => updateSpreadsheetItem(item.id, 'valorGlobal', Number(e.target.value))}
                                className="w-full bg-transparent border-0 outline-none pl-7 pr-2 py-1 text-right font-mono text-xs font-bold text-on-surface"
                              />
                            </div>
                          </td>

                          {/* Mes do Reajuste */}
                          <td className="p-1 border-r border-outline/30">
                            <select
                              value={item.mesReajuste || ''}
                              onChange={(e) => updateSpreadsheetItem(item.id, 'mesReajuste', e.target.value)}
                              className="w-full bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary rounded-lg px-2 py-1 font-sans text-xs text-on-surface cursor-pointer"
                            >
                              <option value="" className="bg-surface text-on-surface">-</option>
                              {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map(m => (
                                <option key={m} value={m} className="bg-surface text-on-surface">{m}</option>
                              ))}
                            </select>
                          </td>

                          {/* Indice Reajuste */}
                          <td className="p-1 border-r border-outline/30">
                            <input
                              type="text"
                              value={item.indiceReajuste || ''}
                              onChange={(e) => updateSpreadsheetItem(item.id, 'indiceReajuste', e.target.value)}
                              placeholder="Ex: IPCA 4.5%"
                              className="w-full bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary rounded-lg px-2 py-1 text-center font-bold text-xs text-on-surface"
                            />
                          </td>

                          {/* Observações */}
                          <td className="p-1 border-r border-outline/30">
                            <input
                              type="text"
                              value={item.observacao || ''}
                              onChange={(e) => updateSpreadsheetItem(item.id, 'observacao', e.target.value)}
                              placeholder="Observações / situação"
                              className="w-full bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary rounded-lg px-2 py-1 text-xs text-on-surface font-medium"
                            />
                          </td>

                          {/* Gasto Total Estimado */}
                          <td className="p-1 border-r border-outline/30 text-right font-mono font-extrabold text-xs text-teal-600 dark:text-teal-400 bg-teal-500/[0.02]">
                            {formatCurrency(item.gastoEstimado || 0)}
                          </td>

                          {/* Action Delete */}
                          <td className="p-1 text-center">
                            <button
                              onClick={() => deleteSpreadsheetRow(item.id)}
                              type="button"
                              className="p-1 text-rose-500 hover:text-white hover:bg-rose-600/20 rounded-lg transition-colors cursor-pointer"
                              title="Remover este item da planilha"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer / Totals Summary */}
            {spreadsheetItems.length > 0 && (
              <div className="p-5 border-t border-outline bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-6 shrink-0">
                <div className="flex flex-wrap items-center gap-6">
                  {/* Total Custeio */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Total Custeio (GND 3)</span>
                    <span className="text-base font-black text-on-surface font-mono">
                      {formatCurrency(
                        spreadsheetItems
                          .filter(item => item.gnd === '3 - Custeio')
                          .reduce((acc, curr) => acc + (Number(curr.gastoEstimado) || 0), 0)
                      )}
                    </span>
                  </div>

                  {/* Total Investimento */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Total Investimento (GND 4)</span>
                    <span className="text-base font-black text-on-surface font-mono">
                      {formatCurrency(
                        spreadsheetItems
                          .filter(item => item.gnd === '4 - Investimento')
                          .reduce((acc, curr) => acc + (Number(curr.gastoEstimado) || 0), 0)
                      )}
                    </span>
                  </div>

                  {/* Global value */}
                  <div className="space-y-0.5 border-l border-outline pl-6">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Valor Global Total</span>
                    <span className="text-base font-black text-on-surface-variant font-mono">
                      {formatCurrency(
                        spreadsheetItems.reduce((acc, curr) => acc + (Number(curr.valorGlobal) || 0), 0)
                      )}
                    </span>
                  </div>
                </div>

                {/* Main Projections Sum KPI */}
                <div className="flex items-center gap-4 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.01] border-2 border-emerald-500/20 rounded-2xl px-5 py-3">
                  <div className="space-y-0.5 text-right">
                    <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">Gasto Total Estimado ({selectedYear})</span>
                    <span className="text-xl font-black text-teal-600 dark:text-teal-400 font-mono tracking-tight block">
                      {formatCurrency(
                        spreadsheetItems.reduce((acc, curr) => acc + (Number(curr.gastoEstimado) || 0), 0)
                      )}
                    </span>
                  </div>
                  <FileSpreadsheet className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0 select-none opacity-80" />
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Import DFDs from Other Years Modal */}
      {isImportDfdModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface border border-outline rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-outline flex items-center justify-between bg-surface-container-low/50">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <div>
                  <h3 className="font-extrabold text-sm text-on-surface uppercase tracking-wider">
                    Importar Demandas e Processos de Outros Exercícios
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Selecione DFDs ou Processos de Planejamento de outros anos para replicá-los ou incluí-los no orçamento do exercício de <strong className="text-teal-600 dark:text-teal-400">{selectedYear}</strong>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportDfdModalOpen(false)}
                className="p-1.5 hover:bg-outline-variant/30 rounded-lg transition-colors text-on-surface-variant cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs Navigation */}
            <div className="flex border-b border-outline bg-surface-container-low/10 px-6">
              <button
                type="button"
                onClick={() => setImportModalTab('dfd')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  importModalTab === 'dfd'
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                1. Demandas Planejadas (DFDs)
              </button>
              <button
                type="button"
                onClick={() => setImportModalTab('planejamento')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  importModalTab === 'planejamento'
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                2. Processos de Planejamento (Licitações)
              </button>
            </div>

            {/* Filter Bar */}
            <div className="px-6 py-3 border-b border-outline bg-surface-container-low/20 flex gap-4">
              <input
                type="text"
                placeholder={
                  importModalTab === 'dfd'
                    ? "Buscar por Nº DFD, objeto ou ano do PCA..."
                    : "Buscar por Processo SEI, objeto ou ano planejado..."
                }
                value={importDfdSearchTerm}
                onChange={(e) => setImportDfdSearchTerm(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-outline rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            {/* Informational Governance Notice */}
            <div className="mx-6 mt-4 p-3 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 rounded-xl text-[11px] flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Regra de Planejamento:</span> Só é permitida a importação de demandas (DFDs) e processos de planejamento originados em <strong>exercícios anteriores</strong> ao ano selecionado de <strong className="font-extrabold">{selectedYear}</strong>. Planejamentos de anos futuros não são exibidos para preservar a integridade cronológica das contratações.
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {importModalTab === 'dfd' ? (
                (() => {
                  const availableDfdList = dfds.filter(d => {
                    const dfdYearNum = parseInt(d.Ano_PCA || '0', 10);
                    const selectedYearNum = parseInt(selectedYear || '0', 10);
                    if (dfdYearNum >= selectedYearNum) return false;
                    const isCorrectStatus = d.Status_DFD === 'Iniciado' || d.Status_DFD === 'Não iniciado';
                    if (!isCorrectStatus) return false;

                    if (importDfdSearchTerm.trim() !== '') {
                      const term = importDfdSearchTerm.toLowerCase();
                      const numMatch = (d.Num_DFD || '').toLowerCase().includes(term);
                      const objMatch = (d.Descricao_Objeto || '').toLowerCase().includes(term);
                      const yearMatch = (d.Ano_PCA || '').toLowerCase().includes(term);
                      if (!numMatch && !objMatch && !yearMatch) return false;
                    }
                    return true;
                  });

                  if (availableDfdList.length === 0) {
                    return (
                      <div className="text-center py-10 text-xs text-on-surface-variant/70 italic">
                        Nenhum DFD elegível de outro ano encontrado para importação.
                      </div>
                    );
                  }

                  return (
                    <div className="border border-outline rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-surface-container-low border-b border-outline">
                            <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-center w-16">
                              Importar
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant w-28">
                              Ano PCA Original
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant w-28">
                              Nº DFD
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                              Objeto
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-right w-36">
                              Valor Estimado
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline/50 bg-surface">
                          {availableDfdList.map(item => {
                            const isImported = item.Orcamento_Exercicios?.includes(selectedYear) || false;
                            return (
                              <tr
                                key={item.id}
                                className={`hover:bg-surface-container-low/40 transition-colors ${isImported ? 'bg-teal-500/[0.02]' : ''}`}
                              >
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isImported}
                                    onChange={() => handleToggleImportDfd(item)}
                                    className="rounded border-outline text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-3 text-xs font-bold text-on-surface-variant">
                                  PCA {item.Ano_PCA}
                                </td>
                                <td className="px-4 py-3 text-xs font-mono font-bold text-on-surface">
                                  {item.Num_DFD}
                                </td>
                                <td className="px-4 py-3 text-xs text-on-surface-variant" title={item.Descricao_Objeto}>
                                  <div className="line-clamp-2">{item.Descricao_Objeto}</div>
                                </td>
                                <td className="px-4 py-3 text-xs font-mono text-right text-on-surface font-semibold">
                                  {formatCurrency(item.Valor_Estimado)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              ) : (
                (() => {
                  const availablePlanList = (planejamentos || []).filter(p => {
                    const origYear = p.Ano_PCA_Vinculado || '2026';
                    const planYearNum = parseInt(origYear, 10);
                    const selectedYearNum = parseInt(selectedYear || '0', 10);
                    if (planYearNum >= selectedYearNum) return false;
                    
                    const inProgress = p.Status_Planejamento === 'Em Elaboração' || p.Status_Planejamento === 'Seleção Fornecedor';
                    if (!inProgress) return false;

                    if (importDfdSearchTerm.trim() !== '') {
                      const term = importDfdSearchTerm.toLowerCase();
                      const seiMatch = (p.SEI_Processo || '').toLowerCase().includes(term);
                      const objMatch = (p.Objeto || '').toLowerCase().includes(term);
                      const yearMatch = origYear.toLowerCase().includes(term);
                      if (!seiMatch && !objMatch && !yearMatch) return false;
                    }
                    return true;
                  });

                  if (availablePlanList.length === 0) {
                    return (
                      <div className="text-center py-10 text-xs text-on-surface-variant/70 italic">
                        Nenhum processo de planejamento elegível de outro ano encontrado para importação.
                      </div>
                    );
                  }

                  return (
                    <div className="border border-outline rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-surface-container-low border-b border-outline">
                            <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-center w-16">
                              Importar
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant w-28">
                              Ano Origem
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant w-36">
                              Processo SEI
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                              Objeto
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-right w-36">
                              Custo Estimativo
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline/50 bg-surface">
                          {availablePlanList.map(item => {
                            const isImported = item.Orcamento_Exercicios?.includes(selectedYear) || false;
                            return (
                              <tr
                                key={item.id}
                                className={`hover:bg-surface-container-low/40 transition-colors ${isImported ? 'bg-teal-500/[0.02]' : ''}`}
                              >
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isImported}
                                    onChange={() => handleToggleImportPlanejamento(item)}
                                    className="rounded border-outline text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-3 text-xs font-bold text-on-surface-variant">
                                  {item.Ano_PCA_Vinculado || '2026'}
                                </td>
                                <td className="px-4 py-3 text-xs font-mono font-bold text-on-surface">
                                  {item.SEI_Processo}
                                </td>
                                <td className="px-4 py-3 text-xs text-on-surface-variant" title={item.Objeto}>
                                  <div className="line-clamp-2">{item.Objeto}</div>
                                </td>
                                <td className="px-4 py-3 text-xs font-mono text-right text-on-surface font-semibold text-primary">
                                  {formatCurrency(getPlanningCusto(item))}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-outline bg-surface-container-low/50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsImportDfdModalOpen(false)}
                className="px-4 py-2 text-xs font-bold bg-primary text-on-primary hover:bg-primary-hover rounded-xl transition-all duration-150 shadow-xs cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Adicionar DFD Customizado */}
      {isAddCustomDfdModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface border border-outline rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-outline flex items-center justify-between bg-surface-container-low/50">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <div>
                  <h3 className="font-extrabold text-sm text-on-surface uppercase tracking-wider">
                    Adicionar Item ao Planejamento (DFDs)
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Inserir diretamente no orçamento de <strong>{selectedYear}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCustomDfdModalOpen(false)}
                className="p-1.5 hover:bg-outline-variant/30 rounded-lg transition-colors text-on-surface-variant cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddCustomDFDSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                    Identificador / Número do DFD (Opcional)
                  </label>
                  <input
                    type="text"
                    value={customDfdNum}
                    onChange={(e) => setCustomDfdNum(e.target.value)}
                    placeholder="Ex: DFD-PLOA-2027-04"
                    className="w-full px-3 py-2 text-xs border border-outline rounded bg-surface text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                    Objeto de TIC <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={customDfdObjeto}
                    onChange={(e) => setCustomDfdObjeto(e.target.value)}
                    placeholder="Descreva o objeto ou a contratação de TIC..."
                    className="w-full px-3 py-2 text-xs border border-outline rounded bg-surface text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                      Grupo de Despesa (GND) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={customDfdGND}
                      onChange={(e: any) => setCustomDfdGND(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-outline rounded bg-surface text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="3 - Custeio">Custeio (GND 3)</option>
                      <option value="4 - Investimento">Investimento (GND 4)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                      Periodicidade <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={customDfdPeriodicidade}
                      onChange={(e: any) => setCustomDfdPeriodicidade(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-outline rounded bg-surface text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="Mensal">Mensal (Anualizado)</option>
                      <option value="Anual">Anual</option>
                      <option value="Total">Total (Único)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                      Valor Estimado (R$) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customDfdValor}
                      onChange={(e) => {
                        // Allow only currency formatting or numbers
                        let val = e.target.value.replace(/\D/g, '');
                        if (val) {
                          const valInt = parseInt(val, 10);
                          const formatted = (valInt / 100).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          });
                          setCustomDfdValor(formatted);
                        } else {
                          setCustomDfdValor('');
                        }
                      }}
                      placeholder="0,00"
                      className="w-full px-3 py-2 text-xs border border-outline rounded bg-surface text-on-surface focus:outline-none focus:border-primary font-mono text-right font-bold text-teal-600 dark:text-teal-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                      Data Conclusão Estimada
                    </label>
                    <input
                      type="date"
                      value={customDfdData}
                      onChange={(e) => setCustomDfdData(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-outline rounded bg-surface text-on-surface focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-outline bg-surface-container-low/50 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustomDfdModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold border border-outline hover:bg-outline-variant/30 text-on-surface rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  Adicionar ao Orçamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adicionar Processo de Planejamento Customizado */}
      {isAddCustomPlanModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface border border-outline rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-outline flex items-center justify-between bg-surface-container-low/50">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <h3 className="font-extrabold text-sm text-on-surface uppercase tracking-wider">
                    Adicionar Processo de Planejamento (Licitação)
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Inserir diretamente no orçamento de <strong>{selectedYear}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCustomPlanModalOpen(false)}
                className="p-1.5 hover:bg-outline-variant/30 rounded-lg transition-colors text-on-surface-variant cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddCustomPlanSubmit}>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                      Processo SEI (Opcional)
                    </label>
                    <input
                      type="text"
                      value={customPlanSei}
                      onChange={(e) => setCustomPlanSei(e.target.value)}
                      placeholder="Ex: 12100.100024/2026-90"
                      className="w-full px-3 py-2 text-xs border border-outline rounded bg-surface text-on-surface focus:outline-none focus:border-primary font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                      DFD / PNCP Vinculado (Opcional)
                    </label>
                    <input
                      type="text"
                      value={customPlanDfdNum}
                      onChange={(e) => setCustomPlanDfdNum(e.target.value)}
                      placeholder="Ex: DFD-PLOA-2027-02"
                      className="w-full px-3 py-2 text-xs border border-outline rounded bg-surface text-on-surface focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                    Objeto de TIC <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={customPlanObjeto}
                    onChange={(e) => setCustomPlanObjeto(e.target.value)}
                    placeholder="Descreva o objeto ou contratação planejada..."
                    className="w-full px-3 py-2 text-xs border border-outline rounded bg-surface text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                      Grupo de Despesa (GND) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={customPlanGND}
                      onChange={(e: any) => setCustomPlanGND(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-outline rounded bg-surface text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="3 - Custeio">Custeio (GND 3)</option>
                      <option value="4 - Investimento">Investimento (GND 4)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                      Tipo de Processo <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={customPlanTipo}
                      onChange={(e) => setCustomPlanTipo(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-outline rounded bg-surface text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="Pregão SOF">Pregão SOF</option>
                      <option value="Dispensa de Licitação">Dispensa de Licitação</option>
                      <option value="Inexigibilidade">Inexigibilidade</option>
                      <option value="Adesão à ARP">Adesão à ARP</option>
                      <option value="Concorrência">Concorrência</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                      Estimativa de Custo (R$) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customPlanEstimativa}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val) {
                          const valInt = parseInt(val, 10);
                          const formatted = (valInt / 100).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          });
                          setCustomPlanEstimativa(formatted);
                        } else {
                          setCustomPlanEstimativa('');
                        }
                      }}
                      placeholder="0,00"
                      className="w-full px-3 py-2 text-xs border border-outline rounded bg-surface text-on-surface focus:outline-none focus:border-primary font-mono text-right font-bold text-amber-600 dark:text-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                      Data de Início Estimada
                    </label>
                    <input
                      type="date"
                      value={customPlanData}
                      onChange={(e) => setCustomPlanData(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-outline rounded bg-surface text-on-surface focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-outline bg-surface-container-low/50 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustomPlanModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold border border-outline hover:bg-outline-variant/30 text-on-surface rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  Adicionar ao Orçamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
