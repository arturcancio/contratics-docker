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
  HistoricoContratual,
  Pagamento,
  SeiSyncSnapshot,
  User,
} from '../types';
import {
  RawSeiProcessScrapeResult,
  UnitLaneMappingRule,
  DEFAULT_SEI_UNIT_LANE_RULES,
  normalizeSeiProtocol,
} from '../services/seiSyncService';
import {
  Workflow,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Download,
  Layers,
  Link2,
  X,
  Play,
  Clock,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  Radio,
  MapPin,
  Upload,
  ExternalLink,
  History,
  DollarSign,
} from 'lucide-react';

interface SeiSyncStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  planejamentos: Planejamento[];
  tarefas: TarefaPlanejamento[];
  historicoPlanejamentos: HistoricoPlanejamento[];
  contratos: Contrato[];
  historicosContratuais: HistoricoContratual[];
  pagamentos: Pagamento[];
  snapshots: SeiSyncSnapshot[];
  currentUser: User;
  extensionConnected: boolean;
  scanProgress: {
    active: boolean;
    current: number;
    total: number;
    currentProtocol?: string;
    message?: string;
  };
  onTriggerExtensionScan: (selectedProtocols?: string[]) => void;
  onApplyBatchScrapeResults: (
    results: RawSeiProcessScrapeResult[],
    source: 'extension_batch' | 'extension_single' | 'manual_backup',
    customRules: UnitLaneMappingRule[]
  ) => Promise<void>;
  onCreateManualSnapshot: (description: string) => Promise<void>;
  onRestoreSnapshot: (snapshot: SeiSyncSnapshot) => Promise<void>;
  onDeleteSnapshot: (snapshotId: string) => Promise<void>;
  onLinkRelatedProcessToContract?: (
    contratoId: string,
    protocoloRelacionado: string,
    categoria: 'pagamento' | 'aditivo' | 'apostilamento' | 'descentralizacao' | 'empenho' | 'os' | 'outro',
    descricao?: string
  ) => Promise<void>;
}

export default function SeiSyncStudioModal({
  isOpen,
  onClose,
  planejamentos,
  contratos,
  snapshots,
  extensionConnected,
  scanProgress,
  onTriggerExtensionScan,
  onApplyBatchScrapeResults,
  onCreateManualSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onLinkRelatedProcessToContract,
}: SeiSyncStudioModalProps) {
  const [activeTab, setActiveTab] = useState<'scanner' | 'studio_rules' | 'related' | 'snapshots' | 'install'>('scanner');

  // Regras do Estúdio de Fluxo (Unidades SEI -> Raias BPMN)
  const [rules, setRules] = useState<UnitLaneMappingRule[]>(() => {
    try {
      const saved = localStorage.getItem('contratics_sei_studio_lane_rules');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_SEI_UNIT_LANE_RULES;
  });

  useEffect(() => {
    try {
      localStorage.setItem('contratics_sei_studio_lane_rules', JSON.stringify(rules));
    } catch (e) {
      // ignore
    }
  }, [rules]);

  // Seleção de processos para a Varredura Geral
  const allMonitoredProcesses = useMemo(() => {
    const list: Array<{
      protocolo: string;
      tipoRegistro: 'Planejamento' | 'Contrato';
      identificacao: string;
      objeto: string;
      lastSyncAt?: string;
      unidadeAtual?: string;
      etapasCount?: number;
      relacionadosCount?: number;
    }> = [];

    for (const p of planejamentos) {
      if (!p.SEI_Processo || p.isBudgetOnlyItem) continue;
      list.push({
        protocolo: p.SEI_Processo.trim(),
        tipoRegistro: 'Planejamento',
        identificacao: p.DFD_PNCP ? `DFD ${p.DFD_PNCP}` : p.Tipo_Processo || 'Planejamento',
        objeto: p.Objeto,
        lastSyncAt: p.seiSyncMetadata?.lastSyncAt,
        unidadeAtual: p.seiSyncMetadata?.unidadeAtual,
        etapasCount: p.seiSyncMetadata?.etapasMapeadasCount,
        relacionadosCount: p.seiSyncMetadata?.processosRelacionados?.length || 0,
      });
    }

    for (const c of contratos) {
      if (!c.SEI_Processo) continue;
      list.push({
        protocolo: c.SEI_Processo.trim(),
        tipoRegistro: 'Contrato',
        identificacao: `Contrato ${c.Num_Contrato}`,
        objeto: c.Objeto,
        lastSyncAt: c.seiSyncMetadata?.lastSyncAt,
        unidadeAtual: c.seiSyncMetadata?.unidadeAtual,
        relacionadosCount: c.seiSyncMetadata?.processosRelacionados?.length || 0,
      });
    }

    return list;
  }, [planejamentos, contratos]);

  const [selectedProtocols, setSelectedProtocols] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && selectedProtocols.length === 0 && allMonitoredProcesses.length > 0) {
      setSelectedProtocols(allMonitoredProcesses.map(p => p.protocolo));
    }
  }, [isOpen, allMonitoredProcesses.length]);

  // Estado para importação de arquivo JSON de varredura (caso a extensão tenha exportado ou operado em lote offline)
  const [jsonInputText, setJsonInputText] = useState('');
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [manualBackupNote, setManualBackupNote] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Nova regra de Raia
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleLaneNome, setNewRuleLaneNome] = useState('');
  const [newRuleCor, setNewRuleCor] = useState('#0ea5e9');

  // Todos os processos relacionados detectados em Contratos e Planejamentos
  const allDetectedRelated = useMemo(() => {
    const items: Array<{
      parentType: 'Contrato' | 'Planejamento';
      parentId: string;
      parentLabel: string;
      parentProtocolo: string;
      relProtocolo: string;
      relTipo: string;
      categoria: 'pagamento' | 'aditivo' | 'apostilamento' | 'descentralizacao' | 'empenho' | 'os' | 'outro';
      descricao?: string;
      ultimoAndamento?: string;
      dataUltimoAndamento?: string;
    }> = [];

    for (const c of contratos) {
      for (const rel of c.seiSyncMetadata?.processosRelacionados || []) {
        items.push({
          parentType: 'Contrato',
          parentId: c.id,
          parentLabel: `Contrato ${c.Num_Contrato}`,
          parentProtocolo: c.SEI_Processo,
          relProtocolo: rel.protocolo,
          relTipo: rel.tipo,
          categoria: rel.categoria,
          descricao: rel.descricao,
          ultimoAndamento: rel.ultimoAndamento,
          dataUltimoAndamento: rel.dataUltimoAndamento,
        });
      }
    }

    for (const p of planejamentos) {
      for (const rel of p.seiSyncMetadata?.processosRelacionados || []) {
        items.push({
          parentType: 'Planejamento',
          parentId: p.id,
          parentLabel: `Planejamento ${p.SEI_Processo}`,
          parentProtocolo: p.SEI_Processo,
          relProtocolo: rel.protocolo,
          relTipo: rel.tipo,
          categoria: rel.categoria,
          descricao: rel.descricao,
          ultimoAndamento: rel.ultimoAndamento,
          dataUltimoAndamento: rel.dataUltimoAndamento,
        });
      }
    }

    return items;
  }, [contratos, planejamentos]);

  if (!isOpen) return null;

  const toggleProtocol = (proto: string) => {
    setSelectedProtocols(prev =>
      prev.includes(proto) ? prev.filter(p => p !== proto) : [...prev, proto]
    );
  };

  const handleSelectAll = () => {
    if (selectedProtocols.length === allMonitoredProcesses.length) {
      setSelectedProtocols([]);
    } else {
      setSelectedProtocols(allMonitoredProcesses.map(p => p.protocolo));
    }
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRulePattern.trim() || !newRuleLaneNome.trim()) return;
    const nextRule: UnitLaneMappingRule = {
      pattern: newRulePattern.trim().toUpperCase(),
      laneId: `lane-custom-${Date.now()}`,
      laneNome: newRuleLaneNome.trim(),
      cor: newRuleCor,
      ordem: rules.length + 1,
    };
    setRules([...rules, nextRule]);
    setNewRulePattern('');
    setNewRuleLaneNome('');
  };

  const handleRemoveRule = (laneId: string) => {
    setRules(rules.filter(r => r.laneId !== laneId));
  };

  const handleResetDefaultRules = () => {
    setRules(DEFAULT_SEI_UNIT_LANE_RULES);
  };

  const handleImportJsonBatch = async () => {
    if (!jsonInputText.trim()) return;
    try {
      const parsed = JSON.parse(jsonInputText);
      const list: RawSeiProcessScrapeResult[] = Array.isArray(parsed)
        ? parsed
        : parsed.results && Array.isArray(parsed.results)
          ? parsed.results
          : [parsed];

      if (list.length === 0 || !list[0].protocolo) {
        setStatusBanner({
          type: 'error',
          text: 'O pacote JSON informado não contém resultados válidos de leitura do SEI.',
        });
        return;
      }

      await onApplyBatchScrapeResults(list, 'extension_batch', rules);
      setJsonInputText('');
      setShowJsonImport(false);
      setStatusBanner({
        type: 'success',
        text: `Sincronização concluída com sucesso! ${list.length} processo(s) atualizado(s) e ponto de restauração criado automaticamente.`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: `Erro ao processar o pacote JSON do SEI: ${err?.message || 'Formato inválido'}`,
      });
    }
  };

  const handleRestoreClick = async (snap: SeiSyncSnapshot) => {
    if (
      !confirm(
        `Deseja restaurar todos os processos (Planejamentos, Fluxos BPMN, Tarefas, Contratos e Pagamentos) para o estado exato de "${snap.description}" (${new Date(snap.createdAt).toLocaleString('pt-BR')})?`
      )
    ) {
      return;
    }
    setRestoringId(snap.id);
    try {
      await onRestoreSnapshot(snap);
      setStatusBanner({
        type: 'success',
        text: `Dados restaurados com sucesso para o ponto de restauração de ${new Date(snap.createdAt).toLocaleString('pt-BR')}!`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: `Falha ao restaurar snapshot: ${err?.message || 'Erro desconhecido'}`,
      });
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 z-50 animate-in fade-in duration-150">
      <div className="bg-surface-container border border-outline-variant w-full max-w-6xl max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Modal Header */}
        <div className="bg-surface-container-high px-6 py-4 border-b border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Workflow className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base md:text-lg font-extrabold text-on-surface tracking-tight">
                  Contratics SEI Studio — Varredura Geral & Espelhamento BPMN 2.0
                </h3>
                <span
                  className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border ${
                    extensionConnected
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      extensionConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                    }`}
                  />
                  {extensionConnected ? 'Extensão Chrome Conectada' : 'Aguardando Extensão Chrome'}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Lê os processos monitorados diretamente do SEI, mapeia raias e setas no BPMN 2.0, vincula processos associados e cria ponto de restauração automático.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {snapshots.length > 0 && (
              <button
                type="button"
                onClick={() => handleRestoreClick(snapshots[0])}
                disabled={Boolean(restoringId)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-xl cursor-pointer transition-all"
                title="Desfazer a última sincronização e voltar imediatamente aos dados anteriores"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reverter Última Leitura</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-surface-container-low px-6 py-2.5 border-b border-outline-variant flex items-center gap-2 overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('scanner')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'scanner'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>1. Varredura Geral ({allMonitoredProcesses.length} Processos)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('studio_rules')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'studio_rules'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2. Estúdio de Fluxo (Raias SEI → BPMN)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('related')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'related'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>3. Processos Associados ({allDetectedRelated.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('snapshots')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'snapshots'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>4. Pontos de Restauração / Voltar Dados ({snapshots.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('install')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'install'
                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>5. Instalar Extensão Chrome</span>
          </button>
        </div>

        {/* Status Banner */}
        {statusBanner && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl border flex items-center justify-between text-xs font-medium ${
              statusBanner.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : statusBanner.type === 'error'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  : 'bg-sky-500/15 border-sky-500/40 text-sky-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusBanner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="p-1 hover:bg-black/20 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Active Scan Progress Bar */}
        {scanProgress.active && (
          <div className="mx-6 mt-4 bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-primary">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Varredura Geral em Andamento no SEI (Gravando em Tempo Real)... {scanProgress.currentProtocol && `(${scanProgress.currentProtocol})`}
              </span>
              <span className="font-mono">
                {scanProgress.current} / {scanProgress.total}
              </span>
            </div>
            <div className="w-full h-2.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${scanProgress.total > 0 ? Math.min(100, Math.round((scanProgress.current / scanProgress.total) * 100)) : 20}%`,
                }}
              />
            </div>
            {scanProgress.message && (
              <p className="text-[11px] text-on-surface-variant font-mono">{scanProgress.message}</p>
            )}
          </div>
        )}

        {/* Completed Scan Result Banner */}
        {!scanProgress.active && scanProgress.message && !statusBanner && (
          <div
            className={`mx-6 mt-4 p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
              scanProgress.message.includes('⚠️')
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {scanProgress.message.includes('⚠️') ? (
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              )}
              <span>{scanProgress.message}</span>
            </div>
          </div>
        )}

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* TAB 1: VARREDURA GERAL */}
          {activeTab === 'scanner' && (
            <div className="space-y-4">
              <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-bold text-on-surface">
                      Proteção Anti-Erros Ativa (Snapshot Automático Antes da Escrita)
                    </h4>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    Antes de gravar qualquer dado lido do SEI no Contratics, o sistema salva automaticamente uma cópia integral do estado anterior na aba <strong>"Pontos de Restauração"</strong>. Se algo não sair como esperado, você restaura tudo com 1 clique.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowJsonImport(!showJsonImport)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-container-high border border-outline-variant hover:border-primary text-xs font-semibold text-on-surface rounded-xl cursor-pointer transition-all"
                  >
                    <Upload className="w-3.5 h-3.5 text-primary" />
                    <span>Importar Lote JSON da Extensão</span>
                  </button>

                  <button
                    type="button"
                    disabled={selectedProtocols.length === 0 || scanProgress.active}
                    onClick={() => onTriggerExtensionScan(selectedProtocols)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-extrabold rounded-xl cursor-pointer shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>
                      Iniciar Varredura Geral no SEI ({selectedProtocols.length} selecionados)
                    </span>
                  </button>
                </div>
              </div>

              {showJsonImport && (
                <div className="bg-surface-container-low border border-primary/40 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-on-surface">
                      Colar ou Importar Pacote JSON Gerado pela Extensão Contratics SEI Studio
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowJsonImport(false)}
                      className="text-xs text-on-surface-variant hover:text-on-surface"
                    >
                      Fechar
                    </button>
                  </div>
                  <textarea
                    rows={5}
                    value={jsonInputText}
                    onChange={e => setJsonInputText(e.target.value)}
                    placeholder='Cole aqui o JSON exportado pela extensão no SEI (ex: [{"protocolo": "...", "unidadesAbertas": ["GECTI"], "andamentos": [...], "documentos": [...]}])'
                    className="w-full bg-surface-container border border-outline-variant rounded-xl p-3 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleImportJsonBatch}
                      className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Processar Lote & Atualizar BPMN (Com Backup Automático)
                    </button>
                  </div>
                </div>
              )}

              {/* Tabela de Processos Monitorados no Contratics */}
              <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-surface-container-high border-b border-outline-variant flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        allMonitoredProcesses.length > 0 &&
                        selectedProtocols.length === allMonitoredProcesses.length
                      }
                      onChange={handleSelectAll}
                      className="rounded border-outline-variant cursor-pointer"
                    />
                    <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                      Processos Reais Monitorados no Contratics ({allMonitoredProcesses.length})
                    </span>
                  </div>
                  <span className="text-[11px] text-on-surface-variant font-mono">
                    {selectedProtocols.length} marcado(s) para varredura
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[380px] custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant text-[10px] font-bold text-on-surface-variant uppercase bg-surface-container">
                        <th className="py-2.5 px-3 w-10">Sel.</th>
                        <th className="py-2.5 px-3">Protocolo SEI</th>
                        <th className="py-2.5 px-3">Módulo / Identificação</th>
                        <th className="py-2.5 px-3">Objeto</th>
                        <th className="py-2.5 px-3">Posição Atual no SEI</th>
                        <th className="py-2.5 px-3">Fluxo / Associados</th>
                        <th className="py-2.5 px-3">Última Leitura</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/50 text-xs">
                      {allMonitoredProcesses.map(proc => {
                        const isChecked = selectedProtocols.includes(proc.protocolo);
                        return (
                          <tr
                            key={`${proc.tipoRegistro}-${proc.protocolo}`}
                            onClick={() => toggleProtocol(proc.protocolo)}
                            className={`hover:bg-surface-container-high/60 cursor-pointer transition-colors ${
                              isChecked ? 'bg-primary/[0.03]' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleProtocol(proc.protocolo)}
                                className="rounded border-outline-variant cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-on-surface whitespace-nowrap">
                              {proc.protocolo}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  proc.tipoRegistro === 'Planejamento'
                                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                                    : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                                }`}
                              >
                                {proc.tipoRegistro}: {proc.identificacao}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-on-surface-variant max-w-xs truncate" title={proc.objeto}>
                              {proc.objeto}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {proc.unidadeAtual ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10.5px] font-mono font-bold">
                                  <MapPin className="w-3 h-3" />
                                  {proc.unidadeAtual}
                                </span>
                              ) : (
                                <span className="text-on-surface-variant/60 text-[11px] italic">
                                  Ainda não lido
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                              {proc.tipoRegistro === 'Planejamento' && proc.etapasCount ? (
                                <span className="text-sky-400 mr-2">{proc.etapasCount} etapas BPMN</span>
                              ) : null}
                              {proc.relacionadosCount ? (
                                <span className="text-amber-400">{proc.relacionadosCount} relac.</span>
                              ) : (
                                <span className="text-on-surface-variant/50">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-on-surface-variant">
                              {proc.lastSyncAt
                                ? new Date(proc.lastSyncAt).toLocaleString('pt-BR')
                                : 'Pendente'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ESTÚDIO DE FLUXO (MAPEAMENTO UNIDADES SEI -> RAIAS BPMN) */}
          {activeTab === 'studio_rules' && (
            <div className="space-y-4">
              <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Regras do Estúdio de Fluxo SEI → Raias do BPMN 2.0 Oficial
                  </h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Define como as siglas de unidades lidas do histórico do SEI (ex: <code className="font-mono">SOF/GECTI</code>, <code className="font-mono">MPO-CONJUR</code>, <code className="font-mono">MGI-CGLIC</code>) são agrupadas nas Raias (Swimlanes) do seu diagrama BPMN. Unidades que não coincidirem com nenhuma regra ganham automaticamente uma raia própria com a sigla da unidade.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetDefaultRules}
                  className="px-3 py-1.5 bg-surface-container-high border border-outline-variant hover:border-primary text-xs font-semibold text-on-surface rounded-xl cursor-pointer shrink-0"
                >
                  Restaurar Padrão SOF/MPO/MGI
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rules.map((rule, idx) => (
                  <div
                    key={rule.laneId}
                    className="bg-surface-container-low border border-outline-variant rounded-xl p-3.5 flex items-center justify-between gap-3"
                    style={{ borderLeft: `5px solid ${rule.cor}` }}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-surface-container-high px-1.5 py-0.5 rounded text-on-surface-variant">
                          Raia #{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-on-surface truncate">
                          {rule.laneNome}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-on-surface-variant truncate" title={rule.pattern}>
                        Siglas SEI: <span className="text-primary">{rule.pattern}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveRule(rule.laneId)}
                      className="p-1.5 text-rose-400 hover:bg-rose-500/15 rounded-lg cursor-pointer shrink-0"
                      title="Remover regra"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Adicionar nova regra de mapeamento */}
              <form
                onSubmit={handleAddRule}
                className="bg-surface-container-low border border-outline-variant rounded-xl p-4 space-y-3"
              >
                <h5 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                  + Adicionar Mapeamento de Unidade SEI para Raia BPMN
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">
                      Siglas no SEI (separadas por |)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: SPOA|COF|DIORC"
                      value={newRulePattern}
                      onChange={e => setNewRulePattern(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant rounded-xl px-3 py-2 text-xs font-mono text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">
                      Nome da Raia no BPMN
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Coordenação Orçamentária (COF)"
                      value={newRuleLaneNome}
                      onChange={e => setNewRuleLaneNome(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">
                        Cor da Raia
                      </label>
                      <input
                        type="color"
                        value={newRuleCor}
                        onChange={e => setNewRuleCor(e.target.value)}
                        className="w-full h-9 rounded-xl cursor-pointer bg-surface-container border border-outline-variant p-1"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl cursor-pointer h-9"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: PROCESSOS ASSOCIADOS / RELACIONADOS */}
          {activeTab === 'related' && (
            <div className="space-y-4">
              <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4">
                <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary" />
                  Processos Associados / Relacionados Detectados no SEI
                </h4>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  A extensão identifica automaticamente os <strong>Processos Relacionados</strong> na árvore do SEI (como processos de Pagamento/Faturamento mensal, Ordens de Serviço, Empenhos, Descentralizações e Termos Aditivos) e permite vinculá-los diretamente aos contratos no Contratics.
                </p>
              </div>

              {allDetectedRelated.length === 0 ? (
                <div className="bg-surface-container-low border border-dashed border-outline-variant rounded-xl p-8 text-center space-y-2">
                  <Link2 className="w-8 h-8 text-on-surface-variant mx-auto opacity-50" />
                  <p className="text-sm font-bold text-on-surface">
                    Nenhum processo relacionado sincronizado ainda
                  </p>
                  <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                    Execute a Varredura Geral no SEI para capturar automaticamente os processos associados aos seus Contratos e Planejamentos.
                  </p>
                </div>
              ) : (
                <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant text-[10px] font-bold text-on-surface-variant uppercase bg-surface-container">
                        <th className="py-2.5 px-3">Processo Principal</th>
                        <th className="py-2.5 px-3">Processo Associado (SEI)</th>
                        <th className="py-2.5 px-3">Classificação Automática</th>
                        <th className="py-2.5 px-3">Tipo / Especificação no SEI</th>
                        <th className="py-2.5 px-3 text-right">Ação Rápida no Contratics</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/50 text-xs">
                      {allDetectedRelated.map((item, i) => (
                        <tr key={`${item.parentId}-${item.relProtocolo}-${i}`} className="hover:bg-surface-container-high/50">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-on-surface">{item.parentLabel}</div>
                            <div className="text-[10.5px] font-mono text-on-surface-variant">{item.parentProtocolo}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-primary whitespace-nowrap">
                            {item.relProtocolo}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                item.categoria === 'pagamento'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : item.categoria === 'aditivo' || item.categoria === 'apostilamento'
                                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                    : item.categoria === 'descentralizacao' || item.categoria === 'empenho'
                                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                                      : 'bg-surface-container-high text-on-surface-variant border border-outline-variant'
                              }`}
                            >
                              {item.categoria}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-on-surface-variant">
                            <div>{item.relTipo}</div>
                            {item.ultimoAndamento && (
                              <div className="text-[10px] font-mono text-on-surface-variant/80">
                                {item.ultimoAndamento}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {item.parentType === 'Contrato' && onLinkRelatedProcessToContract && (
                              <button
                                type="button"
                                onClick={() =>
                                  onLinkRelatedProcessToContract(
                                    item.parentId,
                                    item.relProtocolo,
                                    item.categoria,
                                    item.relTipo
                                  )
                                }
                                className="px-3 py-1 bg-primary/15 hover:bg-primary/25 border border-primary/40 text-primary text-[11px] font-bold rounded-lg cursor-pointer"
                              >
                                + Vincular ao Contrato ({item.categoria === 'pagamento' ? 'Pagamento/OS' : 'Histórico'})
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PONTOS DE RESTAURAÇÃO / VOLTAR AOS DADOS ANTERIORES (ROLLBACK) */}
          {activeTab === 'snapshots' && (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Pontos de Restauração (Voltar aos Dados Anteriores com 1 Clique)
                  </h4>
                  <p className="text-xs text-on-surface-variant">
                    Toda vez que a extensão realiza uma escrita no Contratics, um snapshot completo dos dados anteriores (Planejamentos, Raias/Fluxos BPMN, Tarefas, Contratos e Pagamentos) é salvo aqui. Você também pode criar um ponto de restauração manual a qualquer momento.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="text"
                    placeholder="Descrição opcional do backup..."
                    value={manualBackupNote}
                    onChange={e => setManualBackupNote(e.target.value)}
                    className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await onCreateManualSnapshot(
                        manualBackupNote.trim() || 'Ponto de Restauração Manual antes de alterações'
                      );
                      setManualBackupNote('');
                      setStatusBanner({
                        type: 'success',
                        text: 'Ponto de restauração manual criado com sucesso!',
                      });
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    + Criar Ponto Agora
                  </button>
                </div>
              </div>

              {snapshots.length === 0 ? (
                <div className="bg-surface-container-low border border-dashed border-outline-variant rounded-xl p-8 text-center space-y-2">
                  <History className="w-8 h-8 text-on-surface-variant mx-auto opacity-50" />
                  <p className="text-sm font-bold text-on-surface">
                    Nenhum ponto de restauração registrado ainda
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    Assim que você iniciar uma Varredura Geral ou clicar em "+ Criar Ponto Agora", o backup aparecerá aqui.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {snapshots.map((snap, idx) => (
                    <div
                      key={snap.id}
                      className={`bg-surface-container-low border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        idx === 0 ? 'border-amber-500/50 bg-amber-500/[0.03]' : 'border-outline-variant'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {idx === 0 && (
                            <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[9.5px] font-extrabold uppercase">
                              Mais Recente
                            </span>
                          )}
                          <span className="text-xs font-bold text-on-surface">{snap.description}</span>
                          <span className="text-[11px] font-mono text-on-surface-variant">
                            • {new Date(snap.createdAt).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <div className="text-[11px] text-on-surface-variant flex items-center gap-3 flex-wrap font-mono">
                          <span>
                            Planejamentos salvos: <strong>{snap.previousState.planejamentos.length}</strong>
                          </span>
                          <span>
                            Tarefas BPMN: <strong>{snap.previousState.tarefas.length}</strong>
                          </span>
                          <span>
                            Contratos: <strong>{snap.previousState.contratos.length}</strong>
                          </span>
                          {snap.processesUpdated && snap.processesUpdated.length > 0 && (
                            <span className="text-primary">
                              Processos afetados na leitura: {snap.processesUpdated.length}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={restoringId === snap.id}
                          onClick={() => handleRestoreClick(snap)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-xl cursor-pointer shadow-sm transition-all"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>
                            {restoringId === snap.id ? 'Restaurando...' : 'Restaurar Este Estado'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSnapshot(snap.id)}
                          className="p-2 text-rose-400 hover:bg-rose-500/15 rounded-xl cursor-pointer"
                          title="Excluir este ponto de restauração"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: INSTALAÇÃO DA EXTENSÃO CHROME */}
          {activeTab === 'install' && (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <h4 className="text-base font-extrabold text-emerald-400 flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    Extensão Oficial do Chrome: Contratics SEI Studio (Inspirada no SEI Pro)
                  </h4>
                  <p className="text-xs text-on-surface leading-relaxed max-w-3xl">
                    A extensão roda diretamente no seu Google Chrome aproveitando sua sessão autenticada no SEI (sem precisar de burocracia de API). Ela varre todos os processos cadastrados no Contratics em segundo plano, lê a árvore de documentos, os processos relacionados e o histórico completo de tramitação, e injeta diretamente no Fluxo BPMN 2.0 Oficial do Contratics.
                  </p>
                </div>

                <a
                  href="/contratics-sei-extension.zip"
                  download="contratics-sei-extension.zip"
                  className="flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-emerald-500/20 shrink-0 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Extensão (.ZIP)</span>
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary font-mono font-bold text-xs flex items-center justify-center">
                    1
                  </div>
                  <h5 className="text-xs font-bold text-on-surface">
                    Extraia o Arquivo ou Use a Pasta do Projeto
                  </h5>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Baixe o arquivo <code className="font-mono text-primary">contratics-sei-extension.zip</code> no botão acima e extraia em uma pasta (ou utilize diretamente a pasta <code className="font-mono text-primary">contratics-sei-extension</code> na raiz do projeto).
                  </p>
                </div>

                <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary font-mono font-bold text-xs flex items-center justify-center">
                    2
                  </div>
                  <h5 className="text-xs font-bold text-on-surface">
                    Carregue em chrome://extensions
                  </h5>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    No Google Chrome, acesse <code className="font-mono text-primary">chrome://extensions</code>, ative a chave <strong>"Modo do desenvolvedor"</strong> no canto superior direito e clique em <strong>"Carregar sem compactação"</strong> selecionando a pasta da extensão.
                  </p>
                </div>

                <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary font-mono font-bold text-xs flex items-center justify-center">
                    3
                  </div>
                  <h5 className="text-xs font-bold text-on-surface">
                    Abra o SEI e Dispare a Varredura Geral
                  </h5>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Mantenha uma aba do SEI aberta e logada no navegador. Aqui no Contratics (ou pelo ícone da extensão no SEI), clique em <strong>"Iniciar Varredura Geral no SEI"</strong> para atualizar todos os fluxos BPMN e contratos de uma só vez!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
