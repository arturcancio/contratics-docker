/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Planejamento, TarefaPlanejamento, User, BpmnLane, StatusTarefa } from '../types';
import { 
  Workflow, 
  Plus, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Play, 
  Layers, 
  Edit3, 
  Trash2, 
  Check, 
  ArrowRight, 
  X, 
  FileText, 
  ShieldAlert, 
  Sliders, 
  Sparkles,
  HelpCircle,
  Calendar,
  UserCheck
} from 'lucide-react';

// Raias de responsabilidade padrão da contratação pública de TIC federal
export const DEFAULT_BPMN_LANES: BpmnLane[] = [
  { id: 'lane-demandante', nome: 'Área Demandante / Requisitante', cor: '#0ea5e9', ordem: 1 },
  { id: 'lane-gecti', nome: 'Equipe de Planejamento da Contratação (GECTI)', cor: '#10b981', ordem: 2 },
  { id: 'lane-conjur', nome: 'Assessoria Jurídica (CONJUR / AGU)', cor: '#8b5cf6', ordem: 3 },
  { id: 'lane-compras', nome: 'Área de Compras e Licitações (CGLIC / DLS)', cor: '#f59e0b', ordem: 4 },
  { id: 'lane-autoridade', nome: 'Autoridade Competente / Ordenador', cor: '#ec4899', ordem: 5 },
];

interface BpmnFlowBoardProps {
  planejamento: Planejamento;
  tarefas: TarefaPlanejamento[];
  currentUser: User;
  onAddTarefa: (newTarefa: TarefaPlanejamento) => void;
  onUpdateTarefa: (updatedTarefa: TarefaPlanejamento) => void;
  onDeleteTarefa: (id: string) => void;
  onUpdatePlanejamento?: (updated: Planejamento) => void;
}

export default function BpmnFlowBoard({
  planejamento,
  tarefas,
  currentUser,
  onAddTarefa,
  onUpdateTarefa,
  onDeleteTarefa,
  onUpdatePlanejamento,
}: BpmnFlowBoardProps) {
  // Raias de responsabilidade (customizadas do planejamento ou padrão)
  const lanes: BpmnLane[] = useMemo(() => {
    if (planejamento.bpmnLanes && planejamento.bpmnLanes.length > 0) {
      return [...planejamento.bpmnLanes].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    }
    return DEFAULT_BPMN_LANES;
  }, [planejamento.bpmnLanes]);

  // Tarefas pertencentes a este processo de planejamento
  const planTarefas = useMemo(() => {
    return tarefas.filter(t => t.ProcessoPlanejamento === planejamento.SEI_Processo);
  }, [tarefas, planejamento.SEI_Processo]);

  // Modais
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isLaneModalOpen, setIsLaneModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TarefaPlanejamento | null>(null);
  const [editingLane, setEditingLane] = useState<BpmnLane | null>(null);

  // Estados dos formulários
  const [taskNome, setTaskNome] = useState('');
  const [taskPrazo, setTaskPrazo] = useState(5);
  const [taskArea, setTaskArea] = useState(lanes[0]?.nome || 'Equipe de Planejamento da Contratação (GECTI)');
  const [taskStatus, setTaskStatus] = useState<StatusTarefa>('Pendente');
  const [taskDescricao, setTaskDescricao] = useState('');

  const [laneNome, setLaneNome] = useState('');
  const [laneCor, setLaneCor] = useState('#10b981');

  // Filtro
  const [filterStatus, setFilterStatus] = useState<'all' | 'atrasadas' | 'em_andamento' | 'concluidas'>('all');

  // Helper para cálculo de tempo e SLA de atraso
  const getTaskSla = (task: TarefaPlanejamento) => {
    const start = new Date(task.Inicio);
    const now = new Date();
    const diffTime = Math.max(0, now.getTime() - start.getTime());
    const diasDecorridos = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const prazo = task.Prazo_Dias || 1;
    const isConcluida = task.Status_Tarefa === 'Concluído';
    const isAtrasada = !isConcluida && diasDecorridos > prazo;
    const diasExcedidos = isAtrasada ? diasDecorridos - prazo : 0;
    const diasRestantes = !isConcluida && !isAtrasada ? prazo - diasDecorridos : 0;

    return {
      diasDecorridos,
      prazo,
      isConcluida,
      isAtrasada,
      diasExcedidos,
      diasRestantes,
    };
  };

  // Métricas do fluxo
  const stats = useMemo(() => {
    let total = planTarefas.length;
    let concluidas = 0;
    let atrasadas = 0;
    let emAndamento = 0;

    for (const t of planTarefas) {
      const sla = getTaskSla(t);
      if (sla.isConcluida) concluidas++;
      else {
        emAndamento++;
        if (sla.isAtrasada) atrasadas++;
      }
    }

    return { total, concluidas, atrasadas, emAndamento };
  }, [planTarefas]);

  // Tarefas filtradas
  const filteredTarefas = useMemo(() => {
    return planTarefas.filter(t => {
      const sla = getTaskSla(t);
      if (filterStatus === 'atrasadas') return sla.isAtrasada;
      if (filterStatus === 'em_andamento') return !sla.isConcluida;
      if (filterStatus === 'concluidas') return sla.isConcluida;
      return true;
    });
  }, [planTarefas, filterStatus]);

  // Abertura do modal para criar ou editar tarefa
  const handleOpenTaskModal = (task?: TarefaPlanejamento, defaultArea?: string) => {
    if (task) {
      setEditingTask(task);
      setTaskNome(task.Tarefa);
      setTaskPrazo(task.Prazo_Dias || 5);
      setTaskArea(task.areaResponsavel || defaultArea || lanes[0]?.nome || '');
      setTaskStatus(task.Status_Tarefa);
      setTaskDescricao(task.descricao || '');
    } else {
      setEditingTask(null);
      setTaskNome('');
      setTaskPrazo(5);
      setTaskArea(defaultArea || lanes[0]?.nome || '');
      setTaskStatus('Pendente');
      setTaskDescricao('');
    }
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskNome.trim()) return;

    if (editingTask) {
      const updated: TarefaPlanejamento = {
        ...editingTask,
        Tarefa: taskNome.trim(),
        Prazo_Dias: Number(taskPrazo) || 1,
        areaResponsavel: taskArea,
        Status_Tarefa: taskStatus,
        descricao: taskDescricao.trim(),
        MovidoPor: currentUser.name,
        MovidoEm: new Date().toISOString(),
      };
      onUpdateTarefa(updated);
    } else {
      const newTask: TarefaPlanejamento = {
        id: `tar-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ProcessoPlanejamento: planejamento.SEI_Processo,
        Tarefa: taskNome.trim(),
        Inicio: new Date().toISOString(),
        Prazo_Dias: Number(taskPrazo) || 1,
        Status_Tarefa: taskStatus,
        areaResponsavel: taskArea,
        descricao: taskDescricao.trim(),
        MovidoPor: currentUser.name,
        MovidoEm: new Date().toISOString(),
        subTarefas: [],
      };
      onAddTarefa(newTask);
    }

    setIsTaskModalOpen(false);
  };

  // Abertura do modal para criar ou editar raia
  const handleOpenLaneModal = (lane?: BpmnLane) => {
    if (lane) {
      setEditingLane(lane);
      setLaneNome(lane.nome);
      setLaneCor(lane.cor || '#10b981');
    } else {
      setEditingLane(null);
      setLaneNome('');
      setLaneCor('#0ea5e9');
    }
    setIsLaneModalOpen(true);
  };

  const handleSaveLane = (e: React.FormEvent) => {
    e.preventDefault();
    if (!laneNome.trim()) return;

    let updatedLanes: BpmnLane[];
    if (editingLane) {
      // Renomear e atualizar
      const oldNome = editingLane.nome;
      const newNome = laneNome.trim();
      updatedLanes = lanes.map(l => l.id === editingLane.id ? { ...l, nome: newNome, cor: laneCor } : l);

      // Se renomeou o nome da raia, atualiza também as tarefas que apontavam para ela
      if (oldNome !== newNome) {
        planTarefas.forEach(t => {
          if (t.areaResponsavel === oldNome) {
            onUpdateTarefa({ ...t, areaResponsavel: newNome });
          }
        });
      }
    } else {
      // Adicionar nova raia
      const newLane: BpmnLane = {
        id: `lane-${Date.now()}`,
        nome: laneNome.trim(),
        cor: laneCor,
        ordem: lanes.length + 1,
      };
      updatedLanes = [...lanes, newLane];
    }

    if (onUpdatePlanejamento) {
      onUpdatePlanejamento({
        ...planejamento,
        bpmnLanes: updatedLanes,
      });
    }

    setIsLaneModalOpen(false);
  };

  const handleDeleteLane = (laneId: string, laneNome: string) => {
    if (!confirm(`Deseja realmente remover a raia "${laneNome}"?`)) return;
    const updatedLanes = lanes.filter(l => l.id !== laneId);
    if (onUpdatePlanejamento) {
      onUpdatePlanejamento({
        ...planejamento,
        bpmnLanes: updatedLanes,
      });
    }
  };

  // Carregador do Fluxo BPMN Padrão de TIC da SOF
  const handleLoadDefaultBpmnFlow = () => {
    if (planTarefas.length > 0 && !confirm('Este planejamento já possui tarefas. Deseja carregar o fluxo padrão BPMN complementar?')) {
      return;
    }

    const defaultFlowTasks: { tarefa: string; area: string; prazo: number; status: StatusTarefa; desc: string }[] = [
      { tarefa: 'Documento de Oficialização da Demanda (DOD / DFD)', area: 'Área Demandante / Requisitante', prazo: 5, status: 'Concluído', desc: 'Formalização e abertura da demanda pelo setor solicitante com justificativa técnica.' },
      { tarefa: 'Estudos Técnicos Preliminares da Contratação (ETP)', area: 'Equipe de Planejamento da Contratação (GECTI)', prazo: 15, status: 'Em Elaboração', desc: 'Levantamento de necessidades, análise de mercado e soluções técnicas viáveis.' },
      { tarefa: 'Mapeamento e Gerenciamento de Riscos (MR)', area: 'Equipe de Planejamento da Contratação (GECTI)', prazo: 7, status: 'Pendente', desc: 'Identificação de riscos operacionais, contratuais e medidas de contingência.' },
      { tarefa: 'Termo de Referência (TR) e Pesquisa de Preços', area: 'Equipe de Planejamento da Contratação (GECTI)', prazo: 12, status: 'Pendente', desc: 'Consolidação das regras de execução, SLA, penalidades e cesta de preços.' },
      { tarefa: 'Emissão de Parecer Jurídico Institucional', area: 'Assessoria Jurídica (CONJUR / AGU)', prazo: 15, status: 'Pendente', desc: 'Análise de legalidade das minutas do edital, termo de referência e contrato.' },
      { tarefa: 'Saneamento e Adequação às Recomendações Jurídicas', area: 'Equipe de Planejamento da Contratação (GECTI)', prazo: 5, status: 'Pendente', desc: 'Ajuste final das peças instrutórias conforme recomendações do parecer.' },
      { tarefa: 'Publicação do Edital e Condução da Licitação', area: 'Área de Compras e Licitações (CGLIC / DLS)', prazo: 20, status: 'Pendente', desc: 'Abertura da sessão pública, análise de propostas, habilitação e julgamento.' },
      { tarefa: 'Homologação e Assinatura do Contrato de TIC', area: 'Autoridade Competente / Ordenador', prazo: 8, status: 'Pendente', desc: 'Assinatura formal do termo de contrato, empenho dos recursos e publicação no PNCP.' },
    ];

    defaultFlowTasks.forEach((dt, idx) => {
      const nova: TarefaPlanejamento = {
        id: `tar-bpmn-${Date.now()}-${idx}`,
        ProcessoPlanejamento: planejamento.SEI_Processo,
        Tarefa: dt.tarefa,
        Inicio: new Date(Date.now() - (defaultFlowTasks.length - idx) * 86400000).toISOString(),
        Prazo_Dias: dt.prazo,
        Status_Tarefa: dt.status,
        areaResponsavel: dt.area,
        descricao: dt.desc,
        MovidoPor: currentUser.name,
        MovidoEm: new Date().toISOString(),
        subTarefas: [],
      };
      onAddTarefa(nova);
    });
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 md:p-6 shadow-sm space-y-5" data-tour="bpmn-flow-board">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-outline-variant/40">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary shrink-0">
            <Workflow className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-on-surface tracking-tight">
                Fluxo BPMN Interativo do Planejamento
              </h3>
              <span className="text-[9px] font-mono font-bold bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-full">
                BPMN 2.0
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Macroprocesso modelado em raias de responsabilidade (swimlanes), com controle de prazos (SLA) e alerta automático de tarefas em atraso.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleOpenLaneModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline-variant hover:border-primary/50 text-xs font-semibold text-on-surface rounded-lg transition-all cursor-pointer shadow-sm hover:bg-surface-container-high"
            title="Adicionar nova raia de responsabilidade ao processo"
          >
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span>+ Nova Raia (Área)</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenTaskModal()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold rounded-lg transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nova Tarefa BPMN</span>
          </button>

          {planTarefas.length === 0 && (
            <button
              type="button"
              onClick={handleLoadDefaultBpmnFlow}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-bold text-emerald-300 rounded-lg transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Carregar Fluxo Oficial TIC</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics & Filter Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            filterStatus === 'all'
              ? 'bg-surface-container-high border-primary/50 ring-1 ring-primary/40'
              : 'bg-surface-container-lowest/60 border-outline-variant/40 hover:bg-surface-container-high/30'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-on-surface-variant">Total no Fluxo</div>
          <div className="text-xl font-extrabold text-on-surface font-mono mt-0.5">{stats.total}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('em_andamento')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            filterStatus === 'em_andamento'
              ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30'
              : 'bg-surface-container-lowest/60 border-outline-variant/40 hover:bg-surface-container-high/30'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-amber-300">Em Andamento</div>
          <div className="text-xl font-extrabold text-amber-300 font-mono mt-0.5">{stats.emAndamento}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('atrasadas')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            filterStatus === 'atrasadas'
              ? 'bg-rose-500/15 border-rose-500/50 ring-1 ring-rose-500/40'
              : stats.atrasadas > 0
                ? 'bg-rose-500/5 border-rose-500/30 animate-pulse'
                : 'bg-surface-container-lowest/60 border-outline-variant/40 hover:bg-surface-container-high/30'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-rose-300 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Em Atraso (SLA)
          </div>
          <div className={`text-xl font-extrabold font-mono mt-0.5 ${stats.atrasadas > 0 ? 'text-rose-400' : 'text-on-surface-variant'}`}>
            {stats.atrasadas}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('concluidas')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            filterStatus === 'concluidas'
              ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30'
              : 'bg-surface-container-lowest/60 border-outline-variant/40 hover:bg-surface-container-high/30'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-emerald-300">Concluídas</div>
          <div className="text-xl font-extrabold text-emerald-400 font-mono mt-0.5">{stats.concluidas}</div>
        </button>
      </div>

      {/* BPMN Canvas Container (Pool com Raias / Swimlanes) */}
      <div className="bg-surface-container-lowest border-2 border-outline-variant rounded-xl overflow-x-auto custom-scrollbar shadow-inner">
        <div className="min-w-[960px] divide-y divide-outline-variant/40">
          {/* BPMN Pool Header */}
          <div className="bg-surface-container-high/80 px-4 py-2.5 flex items-center justify-between border-b border-outline-variant text-xs font-bold text-on-surface">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <span>Pool de Instrução Processual: <span className="font-mono text-primary font-extrabold">{planejamento.SEI_Processo}</span></span>
            </div>
            <span className="text-[11px] font-normal text-on-surface-variant italic">
              {lanes.length} {lanes.length === 1 ? 'raia de responsabilidade' : 'raias de responsabilidade'} cadastradas
            </span>
          </div>

          {/* Start Event Banner */}
          <div className="px-5 py-3 bg-surface-container-low/40 flex items-center gap-3 border-b border-outline-variant/30">
            {/* BPMN Start Event Symbol: Círculo verde fino */}
            <div className="w-8 h-8 rounded-full border-2 border-emerald-400 bg-emerald-500/10 flex items-center justify-center shrink-0 shadow-sm" title="Start Event (BPMN)">
              <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400 ml-0.5" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-emerald-400 uppercase tracking-wide text-[10px] font-mono">Evento Inicial (Start Event)</span>
              <p className="text-on-surface font-semibold text-xs leading-none mt-0.5">Demanda de TIC Oficializada e Autuada no SEI</p>
            </div>
            <ArrowRight className="w-4 h-4 text-outline-variant ml-2 shrink-0" />
            <span className="text-[11px] text-on-surface-variant italic">Início da instrução e encaminhamento para as raias executoras</span>
          </div>

          {/* Swimlanes Render */}
          {lanes.map((lane, laneIdx) => {
            const laneTasks = filteredTarefas.filter(t => {
              if (t.areaResponsavel) {
                return t.areaResponsavel.toLowerCase() === lane.nome.toLowerCase();
              }
              // Fallback para tarefas antigas sem raia: joga na primeira raia
              return laneIdx === 1;
            });

            return (
              <div key={lane.id} className="flex flex-row min-h-[140px] hover:bg-surface-container/10 transition-colors group">
                {/* Lane Header (Raia / Divisão Lateral) */}
                <div 
                  className="w-48 sm:w-56 p-3 border-r border-outline-variant/50 bg-surface-container-low/80 flex flex-col justify-between shrink-0 select-none relative"
                  style={{ borderLeft: `5px solid ${lane.cor || '#10b981'}` }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-on-surface-variant/70">
                        Raia {laneIdx + 1}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenLaneModal(lane)}
                          className="p-1 hover:bg-surface-container text-on-surface-variant hover:text-on-surface rounded cursor-pointer"
                          title="Editar nome ou cor da raia"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        {lanes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteLane(lane.id, lane.nome)}
                            className="p-1 hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400 rounded cursor-pointer"
                            title="Remover esta raia"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <h5 className="text-xs font-bold text-on-surface mt-1 leading-snug break-words" title={lane.nome}>
                      {lane.nome}
                    </h5>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[10px] text-on-surface-variant/60 border-t border-outline-variant/20">
                    <span>{laneTasks.length} {laneTasks.length === 1 ? 'tarefa' : 'tarefas'}</span>
                    <button
                      type="button"
                      onClick={() => handleOpenTaskModal(undefined, lane.nome)}
                      className="text-primary hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                      title={`Adicionar tarefa diretamente na raia ${lane.nome}`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>

                {/* Lane Content / Task Sequence in this Swimlane */}
                <div className="flex-1 p-3 flex items-center gap-3 overflow-x-auto custom-scrollbar bg-surface-container-lowest/50">
                  {laneTasks.length === 0 ? (
                    <div className="h-full w-full flex items-center justify-center border border-dashed border-outline-variant/40 rounded-xl p-4 text-center">
                      <span className="text-xs text-on-surface-variant/40 italic">
                        Nenhuma tarefa pendente atribuída a esta raia no momento.
                      </span>
                    </div>
                  ) : (
                    laneTasks.map((task, tIdx) => {
                      const sla = getTaskSla(task);

                      return (
                        <React.Fragment key={task.id}>
                          {/* BPMN Task Card (Retângulo arredondado padrão BPMN 2.0) */}
                          <div
                            className={`w-64 p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 relative shrink-0 shadow-sm ${
                              sla.isAtrasada
                                ? 'bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/40 shadow-rose-500/10'
                                : sla.isConcluida
                                  ? 'bg-emerald-500/5 border-emerald-500/40 hover:border-emerald-500/60'
                                  : 'bg-surface-container-high border-outline-variant hover:border-primary/50'
                            }`}
                          >
                            {/* Card Top: SLA & Status */}
                            <div className="flex items-center justify-between gap-1.5">
                              {/* Status Badge */}
                              <span
                                className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                                  sla.isConcluida
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : task.Status_Tarefa === 'Em Elaboração'
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                      : task.Status_Tarefa === 'Aguardando Assinatura'
                                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                        : 'bg-surface-container text-on-surface-variant border-outline-variant'
                                }`}
                              >
                                {task.Status_Tarefa}
                              </span>

                              {/* Overdue Warning Badge */}
                              {sla.isAtrasada && (
                                <span className="text-[9px] font-mono font-extrabold bg-rose-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse shadow-sm">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  ATRASO: +{sla.diasExcedidos}d
                                </span>
                              )}

                              {!sla.isAtrasada && !sla.isConcluida && (
                                <span className="text-[9px] font-mono text-emerald-400 font-semibold">
                                  {sla.diasRestantes}d restantes
                                </span>
                              )}
                            </div>

                            {/* Task Name */}
                            <div>
                              <h6 className="text-xs font-bold text-on-surface leading-snug line-clamp-2" title={task.Tarefa}>
                                {task.Tarefa}
                              </h6>
                              {task.descricao && (
                                <p className="text-[11px] text-on-surface-variant mt-1 line-clamp-1 italic">
                                  {task.descricao}
                                </p>
                              )}
                            </div>

                            {/* Time & SLA Controls */}
                            <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between text-[10.5px]">
                              <div className="flex items-center gap-1 text-on-surface-variant font-mono">
                                <Clock className="w-3 h-3 text-primary shrink-0" />
                                <span>Prazo: <strong>{sla.prazo}d</strong></span>
                                <span className="opacity-40">|</span>
                                <span>{sla.diasDecorridos}d dec.</span>
                              </div>

                              {/* Card Actions */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenTaskModal(task, lane.nome)}
                                  className="p-1 hover:bg-surface-container text-on-surface-variant hover:text-primary rounded cursor-pointer transition-colors"
                                  title="Editar tarefa e prazos"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteTarefa(task.id)}
                                  className="p-1 hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400 rounded cursor-pointer transition-colors"
                                  title="Excluir tarefa"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* BPMN Sequence Arrow between tasks */}
                          {tIdx < laneTasks.length - 1 && (
                            <ArrowRight className="w-4 h-4 text-outline-variant shrink-0" />
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

          {/* Decision Gateway & End Event Section */}
          <div className="px-5 py-4 bg-surface-container-low/60 flex flex-wrap items-center justify-between gap-4">
            {/* BPMN Gateway Symbol: Losango com 'X' */}
            <div className="flex items-center gap-3">
              <div 
                className="w-8 h-8 rotate-45 border-2 border-amber-400 bg-amber-500/10 flex items-center justify-center shrink-0 shadow-sm"
                title="Exclusive Gateway (BPMN 2.0)"
              >
                <span className="-rotate-45 font-bold text-amber-400 text-xs font-mono">X</span>
              </div>
              <div className="text-xs">
                <span className="font-bold text-amber-400 uppercase tracking-wide text-[10px] font-mono">Gateway Decisório</span>
                <p className="text-on-surface font-semibold text-xs leading-none mt-0.5">Parecer da CONJUR Homologado & Certame Adjudicado</p>
              </div>
            </div>

            {/* BPMN End Event Symbol: Círculo com borda dupla */}
            <div className="flex items-center gap-3">
              <ArrowRight className="w-4 h-4 text-outline-variant shrink-0" />
              <div className="w-8 h-8 rounded-full border-4 border-emerald-400 bg-emerald-500/20 flex items-center justify-center shrink-0 shadow-sm" title="End Event (BPMN)">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-emerald-400 uppercase tracking-wide text-[10px] font-mono">Evento Final (End Event)</span>
                <p className="text-on-surface font-semibold text-xs leading-none mt-0.5">Contrato Assinado e Publicado no PNCP</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Criação / Edição de Tarefa BPMN */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-surface-container border border-outline-variant w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-surface-container-high px-6 py-4 border-b border-outline-variant flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-on-surface">
                  {editingTask ? 'Editar Tarefa BPMN' : 'Nova Tarefa no Fluxo BPMN'}
                </h4>
              </div>
              <button 
                type="button" 
                onClick={() => setIsTaskModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Nome da Tarefa / Atividade <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Elaboração do Termo de Referência"
                  value={taskNome}
                  onChange={(e) => setTaskNome(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Raia (Área Responsável) <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={taskArea}
                    onChange={(e) => setTaskArea(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    {lanes.map(l => (
                      <option key={l.id} value={l.nome}>
                        {l.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Prazo Estipulado (SLA em Dias) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={1}
                      max={365}
                      value={taskPrazo}
                      onChange={(e) => setTaskPrazo(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant font-mono">
                      dias
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Fase / Status Atual
                </label>
                <select
                  value={taskStatus}
                  onChange={(e) => setTaskStatus(e.target.value as StatusTarefa)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Em Elaboração">Em Elaboração</option>
                  <option value="Aguardando Assinatura">Aguardando Assinatura</option>
                  <option value="Concluído">Concluído</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Memorial / Descrição dos Entregáveis
                </label>
                <textarea
                  rows={2}
                  placeholder="Orientações normativas, número do documento SEI ou artefatos vinculados..."
                  value={taskDescricao}
                  onChange={(e) => setTaskDescricao(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 border border-outline-variant hover:bg-surface-container text-xs font-semibold text-on-surface rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-xs font-bold text-on-primary rounded-xl cursor-pointer shadow-sm"
                >
                  {editingTask ? 'Salvar Alterações' : 'Adicionar ao Fluxo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição de Raia (Área Responsável) */}
      {isLaneModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-surface-container border border-outline-variant w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-surface-container-high px-6 py-4 border-b border-outline-variant flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-on-surface">
                  {editingLane ? 'Editar Raia de Responsabilidade' : 'Nova Raia (Área Responsável)'}
                </h4>
              </div>
              <button 
                type="button" 
                onClick={() => setIsLaneModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLane} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Nome da Área / Departamento <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Auditoria Interna / CGLIC"
                  value={laneNome}
                  onChange={(e) => setLaneNome(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Cor de Identificação da Raia
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={laneCor}
                    onChange={(e) => setLaneCor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border border-outline-variant bg-transparent p-0.5"
                  />
                  <div className="flex flex-wrap gap-2">
                    {['#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1'].map(color => (
                      <button
                        type="button"
                        key={color}
                        onClick={() => setLaneCor(color)}
                        className={`w-6 h-6 rounded-full border transition-transform ${
                          laneCor === color ? 'scale-110 ring-2 ring-primary border-white' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLaneModalOpen(false)}
                  className="px-4 py-2 border border-outline-variant hover:bg-surface-container text-xs font-semibold text-on-surface rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-xs font-bold text-on-primary rounded-xl cursor-pointer shadow-sm"
                >
                  {editingLane ? 'Salvar Raia' : 'Criar Nova Raia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
