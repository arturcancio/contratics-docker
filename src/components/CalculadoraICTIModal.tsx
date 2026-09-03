import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, 
  X, 
  Building2, 
  Calendar, 
  DollarSign, 
  Copy, 
  Check, 
  FileText, 
  RefreshCw, 
  Search, 
  ArrowRight, 
  Info, 
  TrendingUp, 
  ExternalLink,
  ChevronRight,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  History
} from 'lucide-react';
import { Contrato, Fornecedor, TermoAditivo, TermoApostilamento } from '../types';
import { parseMonetaryValue } from '../utils';
import { CurrencyInput } from './CurrencyInput';
import { getIctiSeriesBundle, IctiRecord } from '../services/ipeadataService';

interface CalculadoraICTIModalProps {
  isOpen: boolean;
  onClose: () => void;
  contratos: Contrato[];
  fornecedores?: Fornecedor[];
  aditivos?: TermoAditivo[];
  apostilamentos?: TermoApostilamento[];
  initialContratoId?: string;
}

export interface ReajusteHistoricoItem {
  id: string;
  type: 'Apostilamento' | 'Aditivo';
  tipoNome: string;
  dateStr: string;
  month: number;
  year: number;
  porcentagem: number;
  valorAjuste: number;
  valorFinal: number;
  sei: string;
  observacoes: string;
}

interface IctiValRecord {
  date: string; // ISO date string e.g. "2025-05-01T00:00:00"
  value: number; // Value e.g. 207.59 or 4.45
  yearMonth: string; // "2025-05"
}

// Monthly names in Portuguese
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Helper to resolve clean supplier name and omit internal raw IDs like forn-1780248...
export const getCleanFornecedorNome = (fornecedorField?: string, fornecedoresList: Fornecedor[] = []): string => {
  if (!fornecedorField || typeof fornecedorField !== 'string') return '';
  const trimmed = fornecedorField.trim();
  if (!trimmed) return '';

  // 1. Try finding by ID in fornecedores list
  const foundById = fornecedoresList.find(f => f.id === trimmed);
  if (foundById && foundById.Nome_Fornecedor) {
    return foundById.Nome_Fornecedor.trim();
  }

  // 2. Try finding by CNPJ or exact name match
  const foundByNameOrCnpj = fornecedoresList.find(
    f => f.CNPJ === trimmed || f.Nome_Fornecedor?.toLowerCase() === trimmed.toLowerCase()
  );
  if (foundByNameOrCnpj && foundByNameOrCnpj.Nome_Fornecedor) {
    return foundByNameOrCnpj.Nome_Fornecedor.trim();
  }

  // 3. Filter out raw internal ID strings like "forn-1780248767052" or "forn-1"
  if (/^forn[-_]?\d+/i.test(trimmed) || /^forn[-_]/i.test(trimmed)) {
    return '';
  }

  return trimmed;
};

// Robust date parsing helper for contract dates (ISO, YYYY-MM-DD, DD/MM/YYYY, etc.)
export const parseContractDate = (dateStr?: string | null): { month: number; year: number } | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // DD/MM/YYYY or DD/MM/YY format
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length >= 3) {
      const month = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      if (!isNaN(month) && month >= 1 && month <= 12 && !isNaN(year) && year >= 2000 && year <= 2035) {
        return { month, year };
      }
    }
  }

  // YYYY-MM-DD or YYYY-MM... format
  const matchIso = trimmed.match(/^(\d{4})[-/](\d{1,2})/);
  if (matchIso) {
    const year = parseInt(matchIso[1], 10);
    const month = parseInt(matchIso[2], 10);
    if (!isNaN(month) && month >= 1 && month <= 12 && !isNaN(year) && year >= 2000 && year <= 2035) {
      return { month, year };
    }
  }

  // Fallback to Date object parsing
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      if (month >= 1 && month <= 12 && year >= 2000) {
        return { month, year };
      }
    }
  } catch {
    // ignore
  }

  return null;
};

// Intelligently determine the true base date of a contract (Priority: Data_Orcamento_Estimado)
export const getContratoBaseDate = (contrato?: Contrato | null): { month: number; year: number } | null => {
  if (!contrato) return null;

  // 1. Data do Orçamento Estimado is the definitive base date for ICTI reajustes!
  const budgetParsed = parseContractDate(contrato.Data_Orcamento_Estimado);
  if (budgetParsed) {
    return budgetParsed;
  }

  // 2. Fallback to Vigencia_Inicio if budget date is not provided
  const vigenciaParsed = parseContractDate(contrato.Vigencia_Inicio);
  if (vigenciaParsed) {
    return vigenciaParsed;
  }

  if (contrato.Num_Contrato) {
    const matchYear = contrato.Num_Contrato.match(/\b(20\d{2})\b/);
    if (matchYear) {
      const year = parseInt(matchYear[1], 10);
      return { month: 1, year };
    }
  }

  return null;
};

// Extract all registered reajuste events (apostilamentos / aditivos) for a contract
export const getContratoReajustesHistorico = (
  contrato?: Contrato | null,
  aditivos: TermoAditivo[] = [],
  apostilamentos: TermoApostilamento[] = []
): ReajusteHistoricoItem[] => {
  if (!contrato) return [];

  const items: ReajusteHistoricoItem[] = [];

  // 1. Apostilamentos
  const cApostilamentos = apostilamentos.filter(
    ap => ap.Num_Contrato === contrato.id || ap.Num_Contrato === contrato.Num_Contrato
  );
  cApostilamentos.forEach(ap => {
    const isReajuste = ap.Tipo_Apostilamento === 'Reajuste' || (ap.Porcentagem_Reajuste && ap.Porcentagem_Reajuste > 0) || (ap.Valor_do_Ajuste && ap.Valor_do_Ajuste > 0);
    if (isReajuste) {
      const parsed = parseContractDate(ap.Data_Apostilamento);
      if (parsed) {
        items.push({
          id: ap.id,
          type: 'Apostilamento',
          tipoNome: 'Termo de Apostilamento (Reajuste)',
          dateStr: ap.Data_Apostilamento,
          month: parsed.month,
          year: parsed.year,
          porcentagem: ap.Porcentagem_Reajuste || 0,
          valorAjuste: ap.Valor_do_Ajuste || 0,
          valorFinal: ap.Valor_Final_Apos_Ajuste || 0,
          sei: ap.Documento_SEI || '',
          observacoes: ap.Observacoes || ''
        });
      }
    }
  });

  // 2. Aditivos (e.g., Reequilíbrio Econômico-Financeiro or Reajuste)
  const cAditivos = aditivos.filter(
    ad => ad.Num_Contrato === contrato.id || ad.Num_Contrato === contrato.Num_Contrato
  );
  cAditivos.forEach(ad => {
    const isReajusteOrReequilibrio = 
      ad.Tipo_Aditivo === 'Reequilíbrio Econômico_Financeiro' || 
      (ad.Tipo_Operacao && ad.Tipo_Operacao.toLowerCase().includes('reajuste')) ||
      (ad.Observacoes && ad.Observacoes.toLowerCase().includes('reajuste'));

    if (isReajusteOrReequilibrio) {
      const parsed = parseContractDate(ad.Data_Aditivo);
      if (parsed) {
        items.push({
          id: ad.id,
          type: 'Aditivo',
          tipoNome: `Termo Aditivo (${ad.Tipo_Aditivo})`,
          dateStr: ad.Data_Aditivo,
          month: parsed.month,
          year: parsed.year,
          porcentagem: ad.Porcentagem_Aditivo || 0,
          valorAjuste: ad.Valor_Aditivado || 0,
          valorFinal: ad.Valor_Final_Apos_Ajuste || 0,
          sei: ad.Documento_SEI || '',
          observacoes: ad.Observacoes || ''
        });
      }
    }
  });

  return items.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
};

export const formatDisplayDate = (dateStr?: string | null): string => {
  if (!dateStr) return 'Não cadastrada';
  const parsed = parseContractDate(dateStr);
  if (parsed) {
    return `${MONTH_NAMES[parsed.month - 1]} / ${parsed.year}`;
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    }
  } catch {
    // ignore
  }
  return dateStr;
};

export const CalculadoraICTIModal: React.FC<CalculadoraICTIModalProps> = ({
  isOpen,
  onClose,
  contratos,
  fornecedores = [],
  aditivos = [],
  apostilamentos = [],
  initialContratoId
}) => {
  // Mode: 'contrato' | 'manual'
  const [mode, setMode] = useState<'contrato' | 'manual'>('contrato');
  const [selectedContratoId, setSelectedContratoId] = useState<string>(initialContratoId || '');
  const [searchTerm, setSearchTerm] = useState('');

  // Form inputs
  const [valorBaseInput, setValorBaseInput] = useState<string>('1000000');
  const [mesInicial, setMesInicial] = useState<number>(5); // 1-12 (e.g., 5 = Maio)
  const [anoInicial, setAnoInicial] = useState<number>(2025);
  const [mesReajuste, setMesReajuste] = useState<number>(5); // 1-12
  const [anoReajuste, setAnoReajuste] = useState<number>(2026);

  // ICTI Series Data State
  const [loading, setLoading] = useState<boolean>(false);
  const [ictiIndexSeries, setIctiIndexSeries] = useState<IctiValRecord[]>([]); // DIMAC_ICTI3 (index 100)
  const [icti12mSeries, setIcti12mSeries] = useState<IctiValRecord[]>([]); // DIMAC_ICTI1 (12M %)
  const [ictiMensalSeries, setIctiMensalSeries] = useState<IctiValRecord[]>([]); // DIMAC_ICTI2 (monthly %)

  // Copy success indicator
  const [copied, setCopied] = useState<boolean>(false);

  // Contracts eligible for ICTI (excluding Total/One-time payment and closed contracts)
  const eligibleContratos = useMemo(() => {
    return (contratos || []).filter(c => c.Periodicidade_Pagamento !== 'Total' && c.Status_Contrato?.toLowerCase() !== 'encerrado');
  }, [contratos]);

  // Set initial contract if provided when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialContratoId) {
        const found = eligibleContratos.find(c => c.id === initialContratoId || c.Num_Contrato === initialContratoId);
        if (found) {
          setSelectedContratoId(found.id);
          setMode('contrato');
        } else if (eligibleContratos.length > 0) {
          setSelectedContratoId(eligibleContratos[0].id);
          setMode('contrato');
        } else {
          setMode('manual');
        }
      } else if (eligibleContratos.length > 0 && (!selectedContratoId || !eligibleContratos.some(c => c.id === selectedContratoId))) {
        setSelectedContratoId(eligibleContratos[0].id);
        setMode('contrato');
      }
    }
  }, [isOpen, initialContratoId, eligibleContratos, selectedContratoId]);

  // Fetch ICTI series from Ipeadata service
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchAllIctiSeries = async () => {
      setLoading(true);
      try {
        const bundle = await getIctiSeriesBundle();
        if (isMounted) {
          setIctiIndexSeries(bundle.seriesIndex);
          setIcti12mSeries(bundle.series12m);
          setIctiMensalSeries(bundle.seriesMensal);
        }
      } catch (err) {
        console.warn("Aviso ao carregar séries do ICTI:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAllIctiSeries();
  }, [isOpen]);

  // When selected contract changes, populate fields
  const selectedContrato = useMemo(() => {
    return eligibleContratos.find(c => c.id === selectedContratoId) || null;
  }, [eligibleContratos, selectedContratoId]);

  // Extract registered reajuste history for the selected contract from aditivos & apostilamentos
  const reajustesHistorico = useMemo(() => {
    return getContratoReajustesHistorico(selectedContrato, aditivos, apostilamentos);
  }, [selectedContrato, aditivos, apostilamentos]);

  // Original base date from contract's estimated budget
  const contratoOriginalBaseDate = useMemo(() => {
    return getContratoBaseDate(selectedContrato);
  }, [selectedContrato]);

  useEffect(() => {
    if (mode === 'contrato' && selectedContrato) {
      const baseDate = getContratoBaseDate(selectedContrato);
      const reajustes = getContratoReajustesHistorico(selectedContrato, aditivos, apostilamentos);

      if (reajustes.length > 0) {
        // Contract has registered reajustes in contract alterations!
        // Automatically set Data-Base to the month and year of the LATEST reajuste
        const ultimoReajuste = reajustes[reajustes.length - 1];
        // Preserve the base month from estimated budget if available
        const preservedMonth = baseDate?.month || ultimoReajuste.month;
        setMesInicial(preservedMonth);
        setAnoInicial(ultimoReajuste.year);

        // Target reajuste date is 1 year after the last reajuste
        setMesReajuste(preservedMonth);
        setAnoReajuste(ultimoReajuste.year + 1);

        // Value base defaults to the contract value after the last reajuste or selectedContrato.Valor_Atualizado
        const val = ultimoReajuste.valorFinal || selectedContrato.Valor_Atualizado || selectedContrato.Valor_Contrato || 0;
        setValorBaseInput(val.toString());
      } else {
        // Fallback to estimated budget / initial vigencia date
        const val = selectedContrato.Valor_Atualizado || selectedContrato.Valor_Contrato || 0;
        setValorBaseInput(val.toString());

        if (baseDate) {
          setMesInicial(baseDate.month);
          setAnoInicial(baseDate.year);

          setMesReajuste(baseDate.month);
          setAnoReajuste(baseDate.year + 1);
        }
      }
    }
  }, [mode, selectedContrato, aditivos, apostilamentos]);

  // Filter contracts for search dropdown (excluding Total payment contracts)
  const filteredContratos = useMemo(() => {
    if (!searchTerm.trim()) return eligibleContratos;
    const term = searchTerm.toLowerCase();
    return eligibleContratos.filter(c => {
      const fornName = getCleanFornecedorNome(c.Fornecedor, fornecedores).toLowerCase();
      return (
        c.Num_Contrato.toLowerCase().includes(term) ||
        c.Objeto.toLowerCase().includes(term) ||
        fornName.includes(term) ||
        (c.SEI_Processo && c.SEI_Processo.toLowerCase().includes(term))
      );
    });
  }, [eligibleContratos, fornecedores, searchTerm]);

  // Year choices (2013 - 2027)
  const yearsList = useMemo(() => {
    const list = [];
    for (let y = 2013; y <= 2027; y++) list.push(y);
    return list;
  }, []);

  // Format Helper
  const ymStartStr = `${anoInicial}-${mesInicial.toString().padStart(2, '0')}`;
  const ymEndStr = `${anoReajuste}-${mesReajuste.toString().padStart(2, '0')}`;

  // Find start and end ICTI index records
  const calculationResult = useMemo(() => {
    if (ictiIndexSeries.length === 0) {
      return null;
    }

    // Latest available published month in index series
    const latestPublishedRec = ictiIndexSeries[ictiIndexSeries.length - 1];

    // Find start record
    let startRec = ictiIndexSeries.find(r => r.yearMonth === ymStartStr);
    let startNotice = '';
    if (!startRec) {
      // If requested start date is before series available, pick earliest
      const earliestRec = ictiIndexSeries[0];
      if (ymStartStr < earliestRec.yearMonth) {
        startRec = earliestRec;
        startNotice = `Data base anterior ao início da série do IPEA (${earliestRec.yearMonth}).`;
      } else {
        startRec = latestPublishedRec;
      }
    }

    // Find end record
    let endRec = ictiIndexSeries.find(r => r.yearMonth === ymEndStr);
    let isFutureMonth = false;
    let endNotice = '';

    if (!endRec) {
      if (ymEndStr > latestPublishedRec.yearMonth) {
        endRec = latestPublishedRec;
        isFutureMonth = true;
        endNotice = `O ICTI para ${MONTH_NAMES[mesReajuste - 1]}/${anoReajuste} ainda não foi divulgado pelo Ipea. Foi utilizado o último índice divulgado (${MONTH_NAMES[parseInt(latestPublishedRec.yearMonth.substring(5,7)) - 1]}/${latestPublishedRec.yearMonth.substring(0,4)}).`;
      } else {
        endRec = latestPublishedRec;
      }
    }

    const valBase = parseMonetaryValue(valorBaseInput);

    let variacaoPct = 0;
    if (startRec && endRec && startRec.value > 0) {
      variacaoPct = ((endRec.value / startRec.value) - 1) * 100;
    }

    const valorAumento = valBase * (variacaoPct / 100);
    const valorReajustado = valBase + valorAumento;

    // Monthly breakdown list between start and end date
    const monthlyBreakdown: { yearMonth: string; label: string; monthlyRate: number; indexVal: number }[] = [];
    const inBetweenSeries = ictiIndexSeries.filter(r => r.yearMonth >= ymStartStr && r.yearMonth <= ymEndStr);
    
    inBetweenSeries.forEach(r => {
      const [y, m] = r.yearMonth.split('-');
      const mNum = parseInt(m, 10);
      const label = `${MONTH_NAMES[mNum - 1]}/${y}`;
      const mRateRec = ictiMensalSeries.find(mr => mr.yearMonth === r.yearMonth);
      monthlyBreakdown.push({
        yearMonth: r.yearMonth,
        label,
        monthlyRate: mRateRec ? mRateRec.value : 0,
        indexVal: r.value
      });
    });

    // Retroactive calculations
    const today = new Date();
    const currentYearMonthVal = today.getFullYear() * 12 + (today.getMonth() + 1);
    const reajusteTargetVal = anoReajuste * 12 + mesReajuste;
    const mesesRetroativos = Math.max(0, currentYearMonthVal - reajusteTargetVal);
    const diferencaMensal = valorAumento / 12;
    const totalRetroativoAcumulado = diferencaMensal * mesesRetroativos;

    return {
      valBase,
      startRec,
      endRec,
      variacaoPct,
      valorAumento,
      valorReajustado,
      isFutureMonth,
      endNotice,
      startNotice,
      latestPublishedRec,
      monthlyBreakdown,
      mesesRetroativos,
      diferencaMensal,
      totalRetroativoAcumulado
    };
  }, [ictiIndexSeries, ictiMensalSeries, ymStartStr, ymEndStr, valorBaseInput, mesReajuste, anoReajuste]);

  // Format Currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Copy Memory to SEI Clipboard
  const handleCopyMemory = () => {
    if (!calculationResult) return;

    const fornClean = selectedContrato ? getCleanFornecedorNome(selectedContrato.Fornecedor, fornecedores) : '';
    const contratoInfo = selectedContrato 
      ? `Contrato: ${selectedContrato.Num_Contrato} - ${selectedContrato.Objeto}\nFornecedor: ${fornClean || selectedContrato.Fornecedor}\nProcesso SEI: ${selectedContrato.SEI_Processo || 'N/A'}\nData do Orçamento Estimado (Data-Base): ${formatDisplayDate(selectedContrato.Data_Orcamento_Estimado || selectedContrato.Vigencia_Inicio)}\n`
      : 'Modo: Entrada Manual\n';

    const retroText = calculationResult.mesesRetroativos > 0
      ? `\nDEMONSTRATIVO DE EFEITOS FINANCEIROS RETROATIVOS:
• Marco Temporal de Exigibilidade: ${MONTH_NAMES[mesReajuste - 1]}/${anoReajuste} (aniversário da data-base do orçamento)
• Acréscimo Mensal Reajustado: ${formatCurrency(calculationResult.diferencaMensal)} / mês
• Meses Retroativos Decorridos: ${calculationResult.mesesRetroativos} meses
• Montante Retroativo Devido: ${formatCurrency(calculationResult.totalRetroativoAcumulado)}
* Nota: A cobrança do reajuste é devida a contar da data-base de aniversário do orçamento estimado (${MONTH_NAMES[mesReajuste - 1]}/${anoReajuste}), independentemente da data de celebração do termo de apostilamento.\n`
      : '';

    const text = `MEMÓRIA DE CÁLCULO DE REAJUSTE CONTRATUAL - ICTI
--------------------------------------------------------------------------------
${contratoInfo}Índice Utilizado: ICTI (Índice de Custos de Tecnologia da Informação - Ipea)
Data-Base (Orçamento Estimado): ${MONTH_NAMES[mesInicial - 1]}/${anoInicial} (Índice Base = ${calculationResult.startRec?.value.toFixed(2)})
Mês de Reajuste (Aplicação): ${MONTH_NAMES[mesReajuste - 1]}/${anoReajuste} (Índice Reajuste = ${calculationResult.endRec?.value.toFixed(2)})

FÓRMULA APLICADA:
Variação Acumulada (%) = ((Índice Reajuste / Índice Base) - 1) × 100
Fator de Reajuste: ${((calculationResult.endRec?.value || 1) / (calculationResult.startRec?.value || 1)).toFixed(6)}

RESUMO DOS VALORES CALCULADOS:
• Valor Inicial / Base do Contrato: ${formatCurrency(calculationResult.valBase)}
• Variação Acumulada do ICTI no Período: ${calculationResult.variacaoPct.toFixed(4)}%
• Valor do Reajuste Anual (Diferença Financeira): ${formatCurrency(calculationResult.valorAumento)}
• NOVO VALOR DO CONTRATO REAJUSTADO: ${formatCurrency(calculationResult.valorReajustado)}${retroText}
Data do Cálculo: ${new Date().toLocaleDateString('pt-BR')}
Fundamento Legal: Art. 92, V da Lei 14.133/2021, Decreto Federal nº 9.507/2018 e jurisprudência do TCU (Acórdão 1.827/2008-Plenário)
Fonte dos Dados: Ipeadata (API Oficial)
Gerado por ContratICS / Sistema de Gestão de Contratações de TIC - SOF/MPO`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-surface border border-outline rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-on-surface my-auto" data-tour="icti-modal-content">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 dark:bg-gradient-to-br dark:from-amber-500/20 dark:to-amber-600/10 border border-amber-400 dark:border-amber-500/30 text-amber-900 dark:text-amber-400 rounded-xl shadow-sm">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-display text-on-surface">Calculadora do ICTI</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-500/15 text-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 rounded-md uppercase tracking-wider font-mono">
                  Ipeadata Oficial
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">Reajuste contratual monetário pelo Índice de Custos de Tecnologia da Informação</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scrollable Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1">
          
          {/* Mode Switcher Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1.5 bg-surface-container-low border border-outline-variant/40 rounded-2xl">
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <button
                onClick={() => setMode('contrato')}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  mode === 'contrato' 
                    ? 'bg-amber-500 text-slate-950 shadow-md' 
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Selecionar Contrato Cadastrado</span>
              </button>

              <button
                onClick={() => setMode('manual')}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  mode === 'manual' 
                    ? 'bg-amber-500 text-slate-950 shadow-md' 
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <Calculator className="w-4 h-4" />
                <span>Entrada Manual de Dados</span>
              </button>
            </div>

            <a
              href="https://calculadoraicti.com.br/"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-amber-900 dark:text-amber-400 hover:text-amber-950 dark:hover:text-amber-300 font-bold flex items-center gap-1 px-3 py-1.5 self-end sm:self-auto hover:underline"
            >
              <span>Referência Web</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Section 1: Mode specific configuration */}
          {mode === 'contrato' ? (
            <div className="bg-surface-container border border-outline-variant/60 rounded-2xl p-4 sm:p-5 space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-400 block">
                1. Selecione o Contrato
              </label>

              {/* Searchable Select for Contracts */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar contrato por número, fornecedor, objeto ou processo SEI..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/60 rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface focus:outline-none focus:border-amber-500/70"
                  />
                </div>

                <select
                  value={selectedContratoId}
                  onChange={(e) => setSelectedContratoId(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2.5 text-xs text-on-surface focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="">-- Selecione um contrato cadastrado ({contratos.length} disponíveis) --</option>
                  {filteredContratos.map(c => {
                    const fornName = getCleanFornecedorNome(c.Fornecedor, fornecedores);
                    const objetoSub = c.Objeto ? (c.Objeto.length > 55 ? c.Objeto.substring(0, 55) + '...' : c.Objeto) : '';
                    const numDisplay = c.Num_Contrato.startsWith('Contrato') ? c.Num_Contrato : `Contrato ${c.Num_Contrato}`;
                    
                    const label = fornName 
                      ? `${numDisplay} — ${fornName} (${objetoSub})`
                      : `${numDisplay} (${objetoSub})`;

                    return (
                      <option key={c.id} value={c.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Display card for selected contract */}
              {selectedContrato ? (
                <div className="bg-surface-container-low border border-amber-500/30 rounded-xl p-4 space-y-3 relative overflow-hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-950 dark:text-amber-400 tracking-wider block">
                        Contrato Selecionado
                      </span>
                      <strong className="text-sm font-bold text-on-surface flex items-center gap-2 flex-wrap font-mono mt-0.5">
                        <span>{selectedContrato.Num_Contrato.startsWith('Contrato') ? selectedContrato.Num_Contrato : `Contrato Nº ${selectedContrato.Num_Contrato}`}</span>
                        {getCleanFornecedorNome(selectedContrato.Fornecedor, fornecedores) && (
                          <span className="text-xs font-sans font-semibold text-amber-950 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20 px-2 py-0.5 rounded-md">
                            {getCleanFornecedorNome(selectedContrato.Fornecedor, fornecedores)}
                          </span>
                        )}
                      </strong>
                      <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                        {selectedContrato.Objeto}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Valor Atual</span>
                      <strong className="text-sm font-black font-mono text-amber-950 dark:text-amber-400 block">
                        {formatCurrency(selectedContrato.Valor_Atualizado || selectedContrato.Valor_Contrato || 0)}
                      </strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-2 border-t border-outline-variant/30">
                    <div>
                      <span className="text-on-surface-variant block text-[10px]">Data Orçamento Estimado (Data-Base):</span>
                      <strong className="text-amber-950 dark:text-amber-300 font-mono font-bold">
                        {formatDisplayDate(
                          selectedContrato.Data_Orcamento_Estimado || (
                            getContratoBaseDate(selectedContrato)
                              ? `${getContratoBaseDate(selectedContrato)?.year}-${getContratoBaseDate(selectedContrato)?.month.toString().padStart(2, '0')}-01`
                              : selectedContrato.Vigencia_Inicio
                          )
                        )}
                      </strong>
                    </div>

                    <div>
                      <span className="text-on-surface-variant block text-[10px]">Início da Vigência / Assinatura:</span>
                      <span className="text-on-surface font-mono font-medium">
                        {formatDisplayDate(selectedContrato.Vigencia_Inicio) || 'Não informado'}
                      </span>
                    </div>

                    <div>
                      <span className="text-on-surface-variant block text-[10px]">Processo SEI / Índice:</span>
                      <strong className="text-on-surface font-mono">{selectedContrato.SEI_Processo || 'N/A'}</strong>
                      <span className="text-amber-950 dark:text-amber-300 font-bold ml-1.5">({selectedContrato.Indice_Reajuste || 'ICTI'})</span>
                    </div>
                  </div>

                  {/* Legal Base Rule Information Card */}
                  <div className="bg-amber-100/90 dark:bg-surface-container-low/90 border border-amber-400/80 dark:border-outline-variant/50 rounded-xl p-3.5 text-xs space-y-2 text-slate-900 dark:text-on-surface-variant shadow-xs">
                    <div className="flex items-center gap-1.5 text-amber-950 dark:text-amber-300 font-extrabold text-[11px]">
                      <Info className="w-4 h-4 text-amber-800 dark:text-amber-400 shrink-0" />
                      <span>Regra de Contagem da Data-Base (Orçamento Estimado):</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-900 dark:text-on-surface-variant font-medium">
                      Conforme o <strong className="font-bold text-slate-950 dark:text-on-surface">Art. 92, V da Lei 14.133/2021</strong>, o <strong className="font-bold text-slate-950 dark:text-on-surface">Decreto Federal nº 9.507/2018</strong> e a jurisprudência consolidada do TCU, o marco inicial do interregno de 1 (um) ano para fins de reajuste é <strong className="font-bold text-slate-950 dark:text-on-surface">exclusivamente a data do Orçamento Estimado</strong> da contratação, e não a data posterior de assinatura do contrato.
                    </p>
                    <p className="text-[11px] font-bold text-amber-950 dark:text-amber-200 italic bg-amber-200/90 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-400 dark:border-amber-500/30 leading-snug">
                      Mesmo que o processo ou apostilamento seja formalizado com atraso, a cobrança produz efeitos financeiros retroativos desde a data de aniversário da data-base do orçamento.
                    </p>
                  </div>

                  {/* Fast Annual Cycle Selectors */}
                  {contratoOriginalBaseDate && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] uppercase font-bold text-amber-950 dark:text-amber-300 tracking-wide flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-amber-800 dark:text-amber-400" />
                          Ciclos Anuais a partir do Orçamento ({MONTH_NAMES[contratoOriginalBaseDate.month - 1]}/{contratoOriginalBaseDate.year})
                        </span>
                        <span className="text-[9.5px] text-on-surface-variant">
                          Selecione o período do reajuste
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map((cycle) => {
                          const cStartYear = contratoOriginalBaseDate.year + (cycle - 1);
                          const cEndYear = contratoOriginalBaseDate.year + cycle;
                          const cMonth = contratoOriginalBaseDate.month;
                          const isSelected = mesInicial === cMonth && anoInicial === cStartYear && mesReajuste === cMonth && anoReajuste === cEndYear;

                          return (
                            <button
                              key={cycle}
                              type="button"
                              onClick={() => {
                                setMesInicial(cMonth);
                                setAnoInicial(cStartYear);
                                setMesReajuste(cMonth);
                                setAnoReajuste(cEndYear);
                              }}
                              className={`p-2 rounded-xl border text-left text-xs transition-all ${
                                isSelected
                                  ? 'bg-amber-200/90 border-amber-500 text-amber-950 ring-1 ring-amber-500 dark:bg-amber-500/20 dark:border-amber-500/80 dark:text-amber-300 dark:ring-amber-500/40 shadow-sm font-medium'
                                  : 'bg-white dark:bg-surface-container-low border-slate-300 dark:border-outline-variant/40 text-slate-800 dark:text-on-surface-variant hover:border-amber-400 hover:text-on-surface'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] font-bold">
                                <span>{cycle}º Reajuste (+{cycle * 12}m)</span>
                                {isSelected && <span className="text-amber-950 dark:text-amber-300 font-extrabold">✓ Ativo</span>}
                              </div>
                              <div className="font-mono font-semibold text-[11px] text-slate-950 dark:text-on-surface mt-0.5">
                                {MONTH_NAMES[cMonth - 1]}/{cStartYear} ➔ {MONTH_NAMES[cMonth - 1]}/{cEndYear}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Registered Reajustes / Alterations History Box */}
                  {reajustesHistorico.length > 0 && (
                    <div className="bg-amber-100/70 dark:bg-amber-500/10 border border-amber-400/80 dark:border-amber-500/35 rounded-xl p-3.5 space-y-3 mt-3 shadow-xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <History className="w-4 h-4 text-amber-800 dark:text-amber-400" />
                          <span className="text-xs font-bold text-amber-950 dark:text-amber-300 uppercase tracking-wide">
                            Reajustes Anteriores Registrados ({reajustesHistorico.length})
                          </span>
                        </div>
                        <span className="text-[10px] bg-amber-200 dark:bg-amber-500/20 text-amber-950 dark:text-amber-200 border border-amber-400 dark:border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                          Histórico de Alterações
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-900 dark:text-on-surface-variant leading-relaxed font-medium">
                        Este contrato já possui reajustes aplicados no sistema. A calculadora preserva a data-base de aniversário anual e atualiza a base para o próximo ciclo de cobrança.
                      </p>

                      <div className="space-y-2 pt-1">
                        {reajustesHistorico.map((rj, idx) => {
                          const isSelected = mesInicial === rj.month && anoInicial === rj.year;
                          return (
                            <div 
                              key={rj.id || idx}
                              className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                                isSelected 
                                  ? 'bg-amber-200/90 border-amber-500 text-slate-950 ring-1 ring-amber-500 dark:bg-amber-500/20 dark:border-amber-500/60 dark:text-on-surface dark:ring-amber-500/40 font-medium' 
                                  : 'bg-white dark:bg-surface-container-low border-outline-variant/40 text-on-surface-variant hover:bg-slate-50'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2 font-semibold flex-wrap">
                                  <span className="text-amber-950 dark:text-amber-300 font-mono font-bold">
                                    {MONTH_NAMES[rj.month - 1]} / {rj.year}
                                  </span>
                                  <span className="text-[10px] text-slate-700 dark:text-on-surface-variant font-medium">({rj.tipoNome})</span>
                                  {rj.sei && (
                                    <span className="text-[10px] font-mono text-slate-800 dark:text-on-surface-variant bg-slate-100 dark:bg-surface-container px-1.5 py-0.5 rounded border border-slate-300 dark:border-outline-variant/40">
                                      SEI: {rj.sei}
                                    </span>
                                  )}
                                </div>
                                {rj.observacoes && (
                                  <p className="text-[10.5px] text-slate-700 dark:text-on-surface-variant line-clamp-1 italic">{rj.observacoes}</p>
                                )}
                              </div>

                              <div className="flex items-center gap-3 shrink-0 ml-2">
                                <div className="text-right hidden sm:block">
                                  {rj.porcentagem > 0 && <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-400 block">+{rj.porcentagem}%</span>}
                                  {rj.valorFinal > 0 && <span className="text-[10.5px] font-mono font-bold text-slate-950 dark:text-on-surface block">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rj.valorFinal)}</span>}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMesInicial(rj.month);
                                    setAnoInicial(rj.year);
                                    setMesReajuste(contratoOriginalBaseDate?.month || rj.month);
                                    setAnoReajuste(rj.year + 1);
                                    if (rj.valorFinal > 0) setValorBaseInput(rj.valorFinal.toString());
                                  }}
                                  className={`px-2.5 py-1 text-[10.5px] font-bold rounded-md transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-amber-500 text-slate-950 shadow'
                                      : 'bg-white dark:bg-surface-container border border-slate-300 dark:border-outline-variant text-slate-900 dark:text-on-surface hover:border-amber-500/60'
                                  }`}
                                >
                                  {isSelected ? '✓ Data-Base Ativa' : 'Usar como Data-Base'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {contratoOriginalBaseDate && (
                        <div className="flex items-center justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              const orig = contratoOriginalBaseDate;
                              setMesInicial(orig.month);
                              setAnoInicial(orig.year);
                              setMesReajuste(orig.month);
                              setAnoReajuste(orig.year + 1);
                              setValorBaseInput((selectedContrato.Valor_Atualizado || selectedContrato.Valor_Contrato || 0).toString());
                            }}
                            className="text-[10.5px] text-amber-950 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 font-bold underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Restaurar para Data-Base Original ({formatDisplayDate(selectedContrato.Data_Orcamento_Estimado || selectedContrato.Vigencia_Inicio)})</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-surface-container-low border border-dashed border-outline-variant/60 rounded-xl text-center text-xs text-on-surface-variant">
                  Selecione um contrato acima para carregar automaticamente o valor base e a data do orçamento estimado.
                </div>
              )}
            </div>
          ) : null}

          {/* Section 2: Values & Date Settings */}
          <div className="bg-surface-container border border-outline-variant/60 rounded-2xl p-4 sm:p-5 space-y-5">
            <label className="text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-400 block">
              {mode === 'contrato' ? '2. Parâmetros do Cálculo' : '1. Digite os Parâmetros do Reajuste'}
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Input Valor Base */}
              <div className="space-y-1.5 sm:col-span-1">
                <label className="text-[11px] font-bold text-on-surface flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-amber-800 dark:text-amber-400" />
                  <span>Valor Base do Contrato (R$)</span>
                </label>
                <CurrencyInput
                  value={parseMonetaryValue(valorBaseInput)}
                  onChange={(val) => setValorBaseInput(val.toString())}
                  placeholder="0,00"
                  className="rounded-xl border-outline-variant text-xs font-mono font-bold"
                />
                <span className="text-[9.5px] text-on-surface-variant block">
                  Valor acumulado do contrato no início da vigência ou último reajuste
                </span>
              </div>

              {/* Input Mês/Ano Inicial (Data Base) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-on-surface flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-800 dark:text-amber-400" />
                    <span>Mês/Ano Inicial (Data-Base)</span>
                  </label>
                  {mode === 'contrato' && selectedContrato && (
                    reajustesHistorico.some(r => r.month === mesInicial && r.year === anoInicial) ? (
                      <span className="text-[9.5px] font-bold text-amber-950 dark:text-amber-300 bg-amber-200 dark:bg-amber-500/15 border border-amber-400 dark:border-amber-500/30 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        <History className="w-3 h-3 text-amber-800 dark:text-amber-400" />
                        Último Reajuste
                      </span>
                    ) : (selectedContrato.Data_Orcamento_Estimado || selectedContrato.Vigencia_Inicio) ? (
                      <span className="text-[9.5px] font-bold text-emerald-900 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-400/80 dark:border-emerald-500/25 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                        Orçamento Estimado
                      </span>
                    ) : null
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={mesInicial}
                    onChange={(e) => setMesInicial(Number(e.target.value))}
                    className="bg-surface-container-low border border-outline-variant rounded-xl px-2.5 py-2 text-xs text-on-surface font-medium focus:outline-none focus:border-amber-500"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={idx} value={idx + 1}>{m}</option>
                    ))}
                  </select>

                  <select
                    value={anoInicial}
                    onChange={(e) => setAnoInicial(Number(e.target.value))}
                    className="bg-surface-container-low border border-outline-variant rounded-xl px-2.5 py-2 text-xs text-on-surface font-mono font-bold focus:outline-none focus:border-amber-500"
                  >
                    {yearsList.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <span className="text-[9.5px] text-on-surface-variant block">
                  Mês do Orçamento Estimado / Proposta
                </span>
              </div>

              {/* Input Mês/Ano Reajuste (Alvo) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-on-surface flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-800 dark:text-amber-400" />
                    <span>Mês/Ano do Reajuste</span>
                  </label>
                  <button
                    onClick={() => {
                      setMesReajuste(mesInicial);
                      setAnoReajuste(anoInicial + 1);
                    }}
                    className="text-[10px] text-amber-950 dark:text-amber-300 hover:underline font-bold bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-500/30"
                    title="Ajustar para 12 meses após a data inicial"
                  >
                    +12 Meses
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={mesReajuste}
                    onChange={(e) => setMesReajuste(Number(e.target.value))}
                    className="bg-surface-container-low border border-outline-variant rounded-xl px-2.5 py-2 text-xs text-on-surface font-medium focus:outline-none focus:border-amber-500"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={idx} value={idx + 1}>{m}</option>
                    ))}
                  </select>

                  <select
                    value={anoReajuste}
                    onChange={(e) => setAnoReajuste(Number(e.target.value))}
                    className="bg-surface-container-low border border-outline-variant rounded-xl px-2.5 py-2 text-xs text-on-surface font-mono font-bold focus:outline-none focus:border-amber-500"
                  >
                    {yearsList.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <span className="text-[9.5px] text-on-surface-variant block">
                  Mês/Ano de aplicação do reajuste
                </span>
              </div>

            </div>
          </div>

          {/* Section 3: Calculation Results Banner & Highlights */}
          {loading ? (
            <div className="p-8 bg-surface-container border border-outline-variant/60 rounded-2xl text-center space-y-3">
              <RefreshCw className="w-6 h-6 text-amber-400 animate-spin mx-auto" />
              <p className="text-xs text-on-surface-variant">Obtendo dados atualizados da série histórica do ICTI no Ipeadata...</p>
            </div>
          ) : calculationResult ? (
            <div className="space-y-4">
              
              {/* Notice Banner if future month or fallback */}
              {calculationResult.isFutureMonth && (
                <div className="bg-amber-50/90 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 p-3.5 rounded-2xl text-xs text-amber-950 dark:text-amber-300 flex items-start gap-2.5 shadow-xs">
                  <Info className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-medium">
                    <strong className="text-amber-900 dark:text-amber-200">Aviso de Divulgação:</strong> {calculationResult.endNotice}
                  </div>
                </div>
              )}

              {/* 3 Prominent KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* KPI 1: Percentual Acumulado */}
                <div className="bg-amber-100/90 dark:bg-gradient-to-br dark:from-amber-500/15 dark:via-amber-500/5 dark:to-transparent border border-amber-400 dark:border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-amber-950 dark:text-amber-400 tracking-wider block">
                    Variação do ICTI Acumulada
                  </span>
                  <div className="my-2">
                    <strong className="text-2xl sm:text-3xl font-black font-mono text-amber-900 dark:text-amber-400 block tracking-tight">
                      {calculationResult.variacaoPct >= 0 ? '+' : ''}{calculationResult.variacaoPct.toFixed(2)}%
                    </strong>
                    <span className="text-[10px] text-amber-950/80 dark:text-on-surface-variant block mt-0.5 font-mono font-medium">
                      Exact: {calculationResult.variacaoPct.toFixed(4)}%
                    </span>
                  </div>
                  <span className="text-[9.5px] text-amber-950/90 dark:text-on-surface-variant border-t border-amber-300 dark:border-amber-500/20 pt-2 block font-medium">
                    Variação entre {MONTH_NAMES[mesInicial - 1]}/{anoInicial} e {MONTH_NAMES[mesReajuste - 1]}/{anoReajuste}
                  </span>
                </div>

                {/* KPI 2: Valor do Aumento */}
                <div className="bg-emerald-100/80 dark:bg-surface-container border border-emerald-400 dark:border-outline-variant/60 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-emerald-950 dark:text-emerald-400 tracking-wider block">
                    Valor do Reajuste Anual
                  </span>
                  <div className="my-2">
                    <strong className="text-xl sm:text-2xl font-black font-mono text-emerald-900 dark:text-emerald-400 block tracking-tight">
                      {formatCurrency(calculationResult.valorAumento)}
                    </strong>
                    <span className="text-[10px] text-emerald-900 dark:text-emerald-400 font-bold block mt-0.5 font-mono">
                      +{formatCurrency(calculationResult.diferencaMensal)} / mês
                    </span>
                  </div>
                  <span className="text-[9.5px] text-emerald-950/90 dark:text-on-surface-variant border-t border-emerald-300 dark:border-outline-variant/20 pt-2 block font-medium">
                    Aumento anual adicionado ao contrato
                  </span>
                </div>

                {/* KPI 3: Novo Valor Reajustado */}
                <div className="bg-slate-100 dark:bg-surface-container border border-slate-300 dark:border-outline-variant/60 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-800 dark:text-on-surface-variant tracking-wider block">
                    Novo Valor Anual Reajustado
                  </span>
                  <div className="my-2">
                    <strong className="text-xl sm:text-2xl font-black font-mono text-slate-950 dark:text-on-surface block tracking-tight">
                      {formatCurrency(calculationResult.valorReajustado)}
                    </strong>
                    <span className="text-[10px] text-slate-700 dark:text-on-surface-variant block mt-0.5 font-mono font-medium">
                      {formatCurrency(calculationResult.valorReajustado / 12)} / mês
                    </span>
                  </div>
                  <span className="text-[9.5px] text-slate-700 dark:text-on-surface-variant border-t border-slate-300 dark:border-outline-variant/20 pt-2 block font-medium">
                    Novo valor global a vigorar
                  </span>
                </div>

              </div>

              {/* Retroactivity Card if anniversary date is in the past */}
              {calculationResult.mesesRetroativos > 0 && (
                <div className="bg-amber-100/80 dark:bg-gradient-to-r dark:from-amber-500/10 dark:via-surface-container dark:to-surface-container border border-amber-400/80 dark:border-amber-500/40 rounded-2xl p-4 sm:p-4.5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-amber-800 dark:text-amber-400" />
                      <h4 className="text-xs font-bold text-amber-950 dark:text-amber-300 uppercase tracking-wide">
                        Efeitos Financeiros Retroativos Calculados ({calculationResult.mesesRetroativos} meses decorridos)
                      </h4>
                    </div>
                    <span className="text-[10px] bg-amber-200 dark:bg-amber-500/20 text-amber-950 dark:text-amber-300 border border-amber-400 dark:border-amber-500/40 px-2.5 py-1 rounded-full font-bold">
                      Exigibilidade a partir de {MONTH_NAMES[mesReajuste - 1]}/{anoReajuste}
                    </span>
                  </div>

                  <p className="text-xs text-slate-900 dark:text-on-surface-variant leading-relaxed font-medium">
                    Como a data-base de aniversário anual do reajuste ocorreu em <strong className="text-slate-950 dark:text-on-surface">{MONTH_NAMES[mesReajuste - 1]}/{anoReajuste}</strong>, a contratada faz jus à cobrança da diferença retroativa sobre as notas fiscais e medições emitidas a partir deste marco, independentemente de quando o termo de apostilamento foi emitido.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="bg-white dark:bg-surface border border-emerald-400/80 dark:border-outline-variant/30 rounded-xl p-3 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-slate-700 dark:text-on-surface-variant block">Diferença Mensal:</span>
                      <strong className="text-sm font-mono font-bold text-emerald-900 dark:text-emerald-400 block mt-0.5">
                        +{formatCurrency(calculationResult.diferencaMensal)}
                      </strong>
                    </div>

                    <div className="bg-white dark:bg-surface border border-amber-400/80 dark:border-outline-variant/30 rounded-xl p-3 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-slate-700 dark:text-on-surface-variant block">Parcelas Retroativas:</span>
                      <strong className="text-sm font-mono font-bold text-amber-900 dark:text-amber-300 block mt-0.5">
                        {calculationResult.mesesRetroativos} meses
                      </strong>
                    </div>

                    <div className="bg-amber-200/80 dark:bg-amber-500/5 border border-amber-400 dark:border-amber-500/40 rounded-xl p-3 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-amber-950 dark:text-amber-400 block">Total Retroativo Devido:</span>
                      <strong className="text-sm sm:text-base font-mono font-black text-amber-950 dark:text-amber-400 block mt-0.5">
                        {formatCurrency(calculationResult.totalRetroativoAcumulado)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Step-by-Step Mathematical Memory Panel */}
              <div className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-on-surface font-display">
                      Memória de Cálculo Detalhada (Demonstrativo)
                    </h4>
                  </div>

                  <button
                    onClick={handleCopyMemory}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-950" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copiado para o SEI!' : 'Copiar Texto para SEI'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  
                  {/* Left Column: Index Numbers */}
                  <div className="bg-surface border border-outline-variant/50 rounded-xl p-3.5 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-amber-900 dark:text-amber-400 font-sans block">
                      1. Índices do Ipeadata Utilizados
                    </span>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-on-surface-variant font-sans">Índice Base ({MONTH_NAMES[mesInicial - 1]}/{anoInicial}):</span>
                        <strong className="text-slate-900 dark:text-on-surface font-bold">{calculationResult.startRec?.value.toFixed(2) || '—'}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-on-surface-variant font-sans">Índice Reajuste ({MONTH_NAMES[mesReajuste - 1]}/{anoReajuste}):</span>
                        <strong className="text-slate-900 dark:text-on-surface font-bold">{calculationResult.endRec?.value.toFixed(2) || '—'}</strong>
                      </div>
                      <div className="flex justify-between items-center pt-1.5 border-t border-outline-variant/30">
                        <span className="text-slate-600 dark:text-on-surface-variant font-sans">Fator de Variação (I_fim / I_ini):</span>
                        <strong className="text-amber-800 dark:text-amber-400 font-bold">
                          {((calculationResult.endRec?.value || 1) / (calculationResult.startRec?.value || 1)).toFixed(6)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Values Equation */}
                  <div className="bg-surface border border-outline-variant/50 rounded-xl p-3.5 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-400 font-sans block">
                      2. Aplicação da Fórmula
                    </span>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-on-surface-variant font-sans">Valor Base:</span>
                        <strong className="text-slate-900 dark:text-on-surface font-bold">{formatCurrency(calculationResult.valBase)}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-on-surface-variant font-sans">Aumento Acumulado (+):</span>
                        <strong className="text-emerald-800 dark:text-emerald-400 font-bold">+{formatCurrency(calculationResult.valorAumento)}</strong>
                      </div>
                      <div className="flex justify-between items-center pt-1.5 border-t border-outline-variant/30">
                        <span className="text-slate-700 dark:text-on-surface-variant font-sans font-bold">Valor Final Reajustado:</span>
                        <strong className="text-amber-800 dark:text-amber-400 font-bold">{formatCurrency(calculationResult.valorReajustado)}</strong>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Monthly breakdown table within period */}
                {calculationResult.monthlyBreakdown.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                      Evolução Mensal do ICTI no Período ({calculationResult.monthlyBreakdown.length} meses)
                    </span>
                    <div className="overflow-hidden rounded-xl border border-outline-variant/40 bg-surface">
                      <div className="max-h-40 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-[11px] font-mono">
                          <thead>
                            <tr className="bg-surface-container/90 border-b border-outline-variant/30 text-[9.5px] uppercase font-bold text-on-surface-variant font-sans">
                              <th className="px-3.5 py-2">Mês/Ano</th>
                              <th className="px-3.5 py-2 text-right">Variação Mensal (% a.m.)</th>
                              <th className="px-3.5 py-2 text-right">Número Índice (Ipeadata)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/20">
                            {calculationResult.monthlyBreakdown.map((m, idx) => (
                              <tr key={idx} className="hover:bg-surface-container-low transition-colors">
                                <td className="px-3.5 py-1.5 text-on-surface font-sans font-medium">{m.label}</td>
                                <td className={`px-3.5 py-1.5 text-right font-bold ${m.monthlyRate >= 0 ? 'text-amber-900 dark:text-amber-400' : 'text-emerald-900 dark:text-emerald-400'}`}>
                                  {m.monthlyRate >= 0 ? '+' : ''}{m.monthlyRate.toFixed(2)}%
                                </td>
                                <td className="px-3.5 py-1.5 text-right text-on-surface">{m.indexVal.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

              </div>

            </div>
          ) : null}

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-outline-variant/30 bg-surface-container/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Fórmula e série alinhadas às diretrizes do Decreto 9.507/2018 e Ipea.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={handleCopyMemory}
              disabled={!calculationResult}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copiado para o SEI!' : 'Copiar Memória de Cálculo'}</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold rounded-xl text-xs transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
