/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { TarefaPlanejamento, Planejamento, StatusTarefa, ProcessTemplate, User, SubTarefa, ItemPlanejamentoSOF } from '../types';
import { DEFAULT_PROCESS_TEMPLATES } from '../initialData';
import { Play, Check, ChevronRight, ChevronLeft, Plus, Clock, UserCheck, Trash2, Edit2, Settings, X, PlusCircle, Search, AlertCircle, ListTodo, Workflow, ArrowRight } from 'lucide-react';

interface KanbanBoardProps {
  planejamento: Planejamento;
  allPlanejamentos?: Planejamento[];
  itensPlanejamentoSOF?: ItemPlanejamentoSOF[];
  tarefas: TarefaPlanejamento[];
  currentUser: User;
  onAddTarefa: (newTarefa: TarefaPlanejamento) => void;
  onUpdateTarefa: (updatedTarefa: TarefaPlanejamento) => void;
  onDeleteTarefa: (id: string) => void;
  templates: ProcessTemplate[];
  onUpdateTemplates: (updatedTemplates: ProcessTemplate[]) => void;
  onSelectPlanejamento?: (id: string) => void;
  hideGlobalPhaseSelector?: boolean;
}

export default function KanbanBoard({
  planejamento,
  allPlanejamentos,
  itensPlanejamentoSOF = [],
  tarefas,
  currentUser,
  onAddTarefa,
  onUpdateTarefa,
  onDeleteTarefa,
  templates,
  onUpdateTemplates,
  onSelectPlanejamento,
  hideGlobalPhaseSelector = false,
}: KanbanBoardProps) {
  const [draggedOverCol, setDraggedOverCol] = useState<StatusTarefa | null>(null);
  const [kanbanSearch, setKanbanSearch] = useState('');
  const [activeFlowStep, setActiveFlowStep] = useState(0);

  const bpmnSteps = [
    { title: 'Estudos Técnicos (ETP)', status: 'Em Elaboração' },
    { title: 'Termo de Referência (TR)', status: 'Em Elaboração' },
    { title: 'Análise CONJUR (Parecer)', status: 'Seleção Fornecedor' },
    { title: 'Sessão Pública (Pregão)', status: 'Seleção Fornecedor' },
    { title: 'Contratação Concluída', status: 'Gerou Contrato' }
  ];

  // Filter tasks belonging only to this planning process and matching search terms
  const processTarefas = tarefas.filter(t => {
    const isThisPlan = t.ProcessoPlanejamento === planejamento.SEI_Processo;
    const matchesSearch = t.Tarefa.toLowerCase().includes(kanbanSearch.toLowerCase());
    return isThisPlan && matchesSearch;
  });

  const columns: { id: StatusTarefa; title: string; color: string; border: string; bg: string }[] = [
    { id: 'Pendente', title: 'Pendentes', color: 'text-on-surface-variant', border: 'border-outline-variant/50', bg: 'bg-surface-container/30' },
    { id: 'Em Elaboração', title: 'Em Elaboração', color: 'text-tertiary', border: 'border-tertiary/20', bg: 'bg-tertiary-container/10' },
    { id: 'Aguardando Assinatura', title: 'Aguardando Assinatura', color: 'text-blue-300', border: 'border-blue-400/20', bg: 'bg-blue-400/5' },
    { id: 'Concluído', title: 'Concluídas', color: 'text-green-300', border: 'border-green-400/20', bg: 'bg-green-400/5' },
  ];

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  
  // Detailed / Edit task state
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<TarefaPlanejamento | null>(null);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskPrazo, setEditTaskPrazo] = useState(10);
  const [editTaskStatus, setEditTaskStatus] = useState<StatusTarefa>('Pendente');

  // Custom Task input
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPrazo, setNewTaskPrazo] = useState(10);

  // Template Manager Edit local status
  const [localTemplates, setLocalTemplates] = useState<ProcessTemplate[]>([]);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newStepName, setNewStepName] = useState('');
  const [newStepPrazo, setNewStepPrazo] = useState(10);

  useEffect(() => {
    setLocalTemplates(JSON.parse(JSON.stringify(templates)));
  }, [templates, isTemplateManagerOpen]);

  // Handle task template pre-population
  const handlePrepopulateFromTemplate = (templateType: string) => {
    if (currentUser.role === 'Visualizador') {
      alert('Seu perfil de "Visualizador" não permite esta ação corporativa.');
      return;
    }

    const template = templates.find(t => t.tipo === templateType);
    if (!template) return;

    if (processTarefas.length > 0) {
      const confirmReplace = window.confirm(
        `Este planejamento já possui ${processTarefas.length} tarefas. Deseja adicionar as tarefas padrão do modelo "${templateType}"? (Isso não apagará as criadas manualmente)`
      );
      if (!confirmReplace) return;
    }

    // Generate tasks from template steps
    template.tasks.forEach((step, i) => {
      const parsedSubtasks = step.subtasks?.map((st, subIdx) => ({
        id: `sub-temp-${Date.now()}-${i}-${subIdx}-${Math.random().toString(36).substr(2, 4)}`,
        titulo: st,
        concluida: false
      })) || [];

      const newTar: TarefaPlanejamento = {
        id: `tar-temp-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        ProcessoPlanejamento: planejamento.SEI_Processo,
        Tarefa: step.tarefa,
        Inicio: new Date().toISOString(),
        Prazo_Dias: step.prazo_dias,
        Status_Tarefa: 'Pendente',
        MovidoPor: currentUser.name,
        MovidoEm: new Date().toISOString(),
        DuracaoColunas: { 'Pendente': 0, 'Em Elaboração': 0, 'Aguardando Assinatura': 0, 'Concluído': 0 },
        subTarefas: parsedSubtasks
      };
      onAddTarefa(newTar);
    });
  };

  // Move task to columns
  const handleMoveTask = (task: TarefaPlanejamento, targetCol: StatusTarefa) => {
    if (currentUser.role === 'Visualizador') {
      alert('Seu perfil de "Visualizador" não possui privilégios de movimentar tarefas.');
      return;
    }

    const originalCol = task.Status_Tarefa;
    if (originalCol === targetCol) return;

    // Calculate simulated duration in original column (e.g., adding some random realistic seconds for demonstration)
    const elapsedSeconds = Math.floor(Math.random() * 86400) + 3600; // random 1h to 25h duration in seconds representation
    const currentDurations = task.DuracaoColunas ? { ...task.DuracaoColunas } : { Pendente: 0, 'Em Elaboração': 0, 'Aguardando Assinatura': 0, Concluído: 0 };
    currentDurations[originalCol] = (currentDurations[originalCol] || 0) + elapsedSeconds;

    const updated: TarefaPlanejamento = {
      ...task,
      Status_Tarefa: targetCol,
      MovidoPor: currentUser.name,
      MovidoEm: new Date().toISOString(),
      DuracaoColunas: currentDurations
    };

    onUpdateTarefa(updated);
  };

  // Trigger Detailed/Edit Modal opening
  const handleOpenTaskDetail = (task: TarefaPlanejamento) => {
    setSelectedTaskDetail(task);
    setEditTaskTitle(task.Tarefa);
    setEditTaskPrazo(task.Prazo_Dias);
    setEditTaskStatus(task.Status_Tarefa);
    setNewSubTaskTitle('');
  };

  const handleSaveTaskDetailEdits = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTaskDetail) return;
    if (currentUser.role === 'Visualizador' || currentUser.role === 'Auditor') {
      return;
    }

    // Update fields
    const updated: TarefaPlanejamento = {
      ...selectedTaskDetail,
      Tarefa: editTaskTitle,
      Prazo_Dias: editTaskPrazo,
      Status_Tarefa: editTaskStatus,
      MovidoPor: currentUser.name,
      MovidoEm: new Date().toISOString()
    };

    onUpdateTarefa(updated);
    setSelectedTaskDetail(null);
  };

  const handleToggleSubTarefa = (taskId: string, subId: string) => {
    const taskToUpdate = tarefas.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    const currentSubList = taskToUpdate.subTarefas || [];
    const updatedSubList = currentSubList.map(st => 
      st.id === subId ? { ...st, concluida: !st.concluida } : st
    );

    // If all subtasks are checked (at least 1 subtask must exist), move to Concluído
    const allDone = updatedSubList.length > 0 && updatedSubList.every(st => st.concluida);
    const nextStatus = allDone ? ('Concluído' as StatusTarefa) : taskToUpdate.Status_Tarefa;

    const updatedTask: TarefaPlanejamento = {
      ...taskToUpdate,
      subTarefas: updatedSubList,
      Status_Tarefa: nextStatus,
      MovidoPor: currentUser.name,
      MovidoEm: new Date().toISOString()
    };

    onUpdateTarefa(updatedTask);
    setSelectedTaskDetail(updatedTask);
    setEditTaskStatus(nextStatus); // keep selects in sync
  };

  const handleAddSubTarefa = (taskId: string, titleStr: string) => {
    const taskToUpdate = tarefas.find(t => t.id === taskId);
    if (!taskToUpdate || !titleStr.trim()) return;

    if (currentUser.role === 'Visualizador' || currentUser.role === 'Auditor') {
      return;
    }

    const currentSubList = taskToUpdate.subTarefas || [];
    const nextSub: SubTarefa = {
      id: `sub-${Date.now()}`,
      titulo: titleStr.trim(),
      concluida: false
    };

    const updatedSubList = [...currentSubList, nextSub];
    const updatedTask: TarefaPlanejamento = {
      ...taskToUpdate,
      subTarefas: updatedSubList
    };

    onUpdateTarefa(updatedTask);
    setSelectedTaskDetail(updatedTask);
    setNewSubTaskTitle('');
  };

  const handleDeleteSubTarefa = (taskId: string, subId: string) => {
    const taskToUpdate = tarefas.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    if (currentUser.role === 'Visualizador' || currentUser.role === 'Auditor') {
      return;
    }

    const currentSubList = taskToUpdate.subTarefas || [];
    const updatedSubList = currentSubList.filter(st => st.id !== subId);

    // Re-verify if remaining subtasks are all completed
    const allDone = updatedSubList.length > 0 && updatedSubList.every(st => st.concluida);
    const nextStatus = allDone ? ('Concluído' as StatusTarefa) : taskToUpdate.Status_Tarefa;

    const updatedTask: TarefaPlanejamento = {
      ...taskToUpdate,
      subTarefas: updatedSubList,
      Status_Tarefa: nextStatus
    };

    onUpdateTarefa(updatedTask);
    setSelectedTaskDetail(updatedTask);
    setEditTaskStatus(nextStatus);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) return;

    const newTar: TarefaPlanejamento = {
      id: `tar-manual-${Date.now()}`,
      ProcessoPlanejamento: planejamento.SEI_Processo,
      Tarefa: newTaskTitle,
      Inicio: new Date().toISOString(),
      Prazo_Dias: newTaskPrazo,
      Status_Tarefa: 'Pendente',
      MovidoPor: currentUser.name,
      MovidoEm: new Date().toISOString(),
      DuracaoColunas: { Pendente: 0, 'Em Elaboração': 0, 'Aguardando Assinatura': 0, Concluído: 0 }
    };

    onAddTarefa(newTar);
    setIsTaskModalOpen(false);
    setNewTaskTitle('');
    setNewTaskPrazo(10);
  };

  // Template Manager: Add new flow template
  const handleAddTemplate = () => {
    if (!newTemplateName) return;
    if (localTemplates.some(t => t.tipo.toLowerCase() === newTemplateName.toLowerCase())) {
      alert('Já existe um fluxo com este nome.');
      return;
    }
    const updated = [...localTemplates, { tipo: newTemplateName, tasks: [] }];
    setLocalTemplates(updated);
    setSelectedTemplateIndex(updated.length - 1);
    setNewTemplateName('');
  };

  // Template Manager: Remove flow template
  const handleRemoveTemplate = (index: number) => {
    if (localTemplates.length <= 1) {
      alert('Você deve manter pelo menos um fluxo de planejamento cadastrado.');
      return;
    }
    const updated = localTemplates.filter((_, i) => i !== index);
    setLocalTemplates(updated);
    setSelectedTemplateIndex(0);
  };

  // Template Manager: Add task step
  const handleAddStepToTemplate = () => {
    if (!newStepName) return;
    const updated = [...localTemplates];
    updated[selectedTemplateIndex].tasks.push({
      tarefa: newStepName,
      prazo_dias: newStepPrazo
    });
    setLocalTemplates(updated);
    setNewStepName('');
    setNewStepPrazo(10);
  };

  // Template Manager: Remove task step
  const handleRemoveStepFromTemplate = (stepIndex: number) => {
    const updated = [...localTemplates];
    updated[selectedTemplateIndex].tasks = updated[selectedTemplateIndex].tasks.filter((_, i) => i !== stepIndex);
    setLocalTemplates(updated);
  };

  // Save templates edits to storage/state
  const handleSaveTemplates = () => {
    onUpdateTemplates(localTemplates);
    setIsTemplateManagerOpen(false);
  };

  return (
    <div className="space-y-6" id="kanban-component" data-tour="kanban-header">
      {/* Fluxo BPM de Contratações de TIC (visível apenas na visão global de fases) */}
      {!hideGlobalPhaseSelector && (
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 md:p-6 shadow-sm space-y-5" data-tour="kanban-pipeline">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary shrink-0">
              <Workflow className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface tracking-tight">Fluxo BPM de Contratações de TIC</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Macroprocesso de contratação de soluções de TIC baseado nas diretrizes federais</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-on-surface-variant font-bold uppercase tracking-wider bg-surface-container border border-outline-variant/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Macroprocesso Interativo
            </span>
          </div>
        </div>

        {/* Stepper Chevron Row */}
        <div className="w-full flex flex-row items-center justify-start xl:justify-between gap-3 py-3 px-4 bg-surface-container-lowest border border-outline-variant/50 rounded-xl select-none overflow-x-auto custom-scrollbar">
          {bpmnSteps.map((step, idx) => {
            const plansList = allPlanejamentos || [planejamento];
            const runningInThisStep = plansList.filter(
              p => p.Status_Planejamento === step.status && p.Status_Planejamento !== 'Arquivado'
            );
            
            const isSelected = activeFlowStep === idx;
            const isComplete = idx < activeFlowStep;
            const isUpcoming = idx > activeFlowStep;

            return (
              <React.Fragment key={idx}>
                <button
                  type="button"
                  onClick={() => setActiveFlowStep(idx)}
                  className={`flex flex-1 min-w-[200px] items-center gap-3 p-3 rounded-lg text-left transition-all duration-150 relative shrink-0 focus:outline-none cursor-pointer group
                    ${isSelected 
                      ? 'bg-primary/10 border border-primary/40 shadow-sm' 
                      : 'border border-transparent hover:bg-surface-container-high/40'
                    }`}
                >
                  {/* Step Indicator Orb */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center border font-mono text-xs font-bold transition-all shrink-0
                      ${isComplete ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : ''}
                      ${isSelected ? 'bg-primary border-primary text-on-primary font-extrabold shadow-sm animate-pulse' : ''}
                      ${isUpcoming ? 'bg-surface-container-low border-outline-variant text-on-surface-variant/40' : ''}
                    `}
                  >
                    {isComplete ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                  </div>

                  {/* Step Metadata */}
                  <div className="min-w-0 leading-tight flex-1">
                    <div className="text-[8px] uppercase font-bold tracking-widest text-on-surface-variant/50">
                      Etapa {idx + 1}
                    </div>
                    <div
                      className={`text-xs font-bold truncate transition-all mt-0.5
                        ${isSelected ? 'text-primary' : 'text-on-surface'}
                        ${isUpcoming ? 'opacity-55' : ''}
                      `}
                    >
                      {step.title.split(' (')[0]}
                    </div>
                    <span className="text-[10px] text-on-surface-variant/70 italic font-medium block">
                      {step.title.includes('(') ? `(${step.title.split(' (')[1]}` : ''}
                    </span>
                  </div>

                  {/* Micro Active Count Badge */}
                  {runningInThisStep.length > 0 && (
                    <span className="shrink-0 text-[10px] font-mono font-extrabold bg-teal-500/10 text-teal-300 border border-teal-500/20 px-1.5 py-0.5 rounded-full select-none" title={`${runningInThisStep.length} processos nesta fase`}>
                      {runningInThisStep.length}
                    </span>
                  )}
                </button>

                {idx < bpmnSteps.length - 1 && (
                  <ArrowRight
                    className={`w-4 h-4 shrink-0 transition-all
                      ${isComplete ? 'text-emerald-500 opacity-90' : 'text-on-surface-variant/20'}
                    `}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Active Flow Step Focus Panel */}
        <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-4 md:p-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-outline-variant/20">
            <div>
              <span className="text-[9px] uppercase font-bold text-primary tracking-widest block font-mono">Detalhamento da Fase Selecionada</span>
              <h5 className="text-sm font-bold text-on-surface mt-0.5">
                Etapa {activeFlowStep + 1}: {bpmnSteps[activeFlowStep].title}
              </h5>
            </div>
            
            {(() => {
              const plansList = allPlanejamentos || [planejamento];
              const runningInThisStep = plansList.filter(
                p => p.Status_Planejamento === bpmnSteps[activeFlowStep].status && p.Status_Planejamento !== 'Arquivado'
              );
              return (
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  runningInThisStep.length > 0
                    ? 'bg-primary/15 border-primary/30 text-primary'
                    : 'bg-surface-container-low border-outline-variant/20 text-on-surface-variant/60'
                }`}>
                  {runningInThisStep.length} {runningInThisStep.length === 1 ? 'Processo Ativo' : 'Processos Ativos'}
                </span>
              );
            })()}
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed">
            {activeFlowStep === 0 && "Subfase preliminar do planejamento da contratação. Envolve o levantamento de necessidades dos setores demandantes, definição detalhada do plano de trabalho, levantamento das alternativas de soluções disponíveis no mercado nacional e a mensuração de viabilidade técnica e financeira."}
            {activeFlowStep === 1 && "Fase onde os requisitos da contratação e as condições comerciais são consolidados em um documento balizador. Define detalhadamente o objeto, obrigações bilaterais, níveis de serviço (SLA), prazos, sanções administrativas, metodologia de fiscalização e estimativas de precificação."}
            {activeFlowStep === 2 && "Etapa de validação e controle normativo. O processo é encaminhado para instrução jurídica onde o assessor jurídico examina a aderência legal, emite considerações vinculantes no parecer técnico-jurídico institucional e valida termos de segurança contratual."}
            {activeFlowStep === 3 && "Sessão competitiva de licitação (Pregão Eletrônico). O certame é conduzido publicamente, colhendo ofertas competitivas de fornecedores homologados para garantir a obtenção da proposta orçamentária mais vantajosa para a administração."}
            {activeFlowStep === 4 && "Conclusão e formalização legal do macroprocesso de TIC. Envolve a assinatura formal, empenho dos recursos iniciais, designação formal dos gestores/fiscais responsáveis e a transição definitiva para a fase de Gestão de Contratos ativa."}
          </p>

          <div className="space-y-2 pt-3 border-t border-outline-variant/20">
            <h6 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Processos no Macrofluxo BPM:</h6>
            {(() => {
              const plansList = allPlanejamentos || [planejamento];
              const runningInThisStep = plansList.filter(
                p => p.Status_Planejamento === bpmnSteps[activeFlowStep].status && p.Status_Planejamento !== 'Arquivado'
              );

              if (runningInThisStep.length === 0) {
                return (
                  <div className="text-center py-6 bg-surface-container-low/40 border border-dashed border-outline-variant/60 rounded-xl">
                    <p className="text-xs text-on-surface-variant/50 italic font-medium">Nenhum processo de contratação em andamento nesta fase no momento.</p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {runningInThisStep.map(p => {
                    const isSelectedProcess = p.SEI_Processo === planejamento.SEI_Processo;
                    return (
                      <div
                        key={p.id}
                        className={`bg-surface-container-low border rounded-xl p-3.5 transition-all flex flex-col justify-between gap-2.5 group ${
                          isSelectedProcess
                            ? 'border-primary ring-1 ring-primary/40 bg-primary/5'
                            : 'border-outline-variant/50 hover:border-primary/40'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded leading-none">
                              {p.SEI_Processo}
                            </span>
                            {isSelectedProcess && (
                              <span className="text-[9px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded font-bold leading-none">
                                Selecionado
                              </span>
                            )}
                          </div>
                          <h5 className="text-xs font-bold text-on-surface mt-2 leading-snug line-clamp-2" title={p.Objeto}>
                            {p.Objeto}
                          </h5>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-outline-variant/10 text-[10px]">
                          <span className="text-on-surface-variant font-mono font-bold">
                            {(() => {
                              const planItems = (itensPlanejamentoSOF || []).filter(i => i.Processo_SEI === p.SEI_Processo && i.Status_Item === 'Ativo');
                              const cost = planItems.length > 0
                                ? planItems.reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0)
                                : (p.Estimativa_Custo || 0);
                              return `R$ ${cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                            })()}
                          </span>
                          
                          {onSelectPlanejamento && (
                            <button
                              type="button"
                              onClick={() => onSelectPlanejamento(p.id)}
                              className="text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <span>{isSelectedProcess ? 'Visualizando' : 'Exibir Kanban'}</span>
                              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    )}

      {/* Kanban header bar */}
      <div className="bg-surface-container border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col gap-3.5" data-tour="kanban-actions">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-primary" />
            Fluxo de Trabalho Kanban
          </h4>
          <p className="text-[11.5px] text-on-surface-variant leading-relaxed">
            Acompanhe a instrução processual do Planejamento de TIC. Arraste as tarefas entre as colunas para atualizar as fases.
          </p>
        </div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2.5 border-t border-outline-variant/30">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            {/* Quick task Search field */}
            <div className="relative w-full sm:w-60 shrink-0">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/70">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="Buscar tarefa no quadro..."
                value={kanbanSearch}
                onChange={(e) => setKanbanSearch(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary font-medium"
              />
            </div>

            {/* Autopopulate Quick Loaders */}
            <div className="bg-surface-container-low border border-outline-variant/60 rounded-lg p-2 flex items-center gap-2 flex-grow min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant/80 shrink-0">
                Modelo:
              </span>
              <div className="flex flex-wrap gap-1.5 min-w-0">
                {templates.map(t => (
                  <button
                    key={t.tipo}
                    onClick={() => handlePrepopulateFromTemplate(t.tipo)}
                    disabled={currentUser.role === 'Visualizador' || currentUser.role === 'Auditor'}
                    className="px-2.5 py-1 text-[10px] bg-primary/10 border border-primary/25 text-primary rounded hover:bg-primary/25 transition-colors font-semibold cursor-pointer disabled:opacity-40 truncate"
                  >
                    {t.tipo}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 self-start sm:self-end lg:self-auto shrink-0">
            <button
              onClick={() => setIsTemplateManagerOpen(true)}
              className="px-3 py-1.5 text-[10.5px] bg-surface-container-high border border-outline-variant text-on-surface-variant hover:text-on-surface rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer font-bold"
              title="Gerenciar e cadastrar modelos de processos e fluxos"
            >
              <Settings className="w-3.5 h-3.5 text-primary" />
              Fluxos
            </button>
            <button
              onClick={() => setIsTaskModalOpen(true)}
              disabled={currentUser.role === 'Visualizador' || currentUser.role === 'Auditor'}
              className="px-3 py-1.5 text-[10.5px] bg-primary text-on-primary rounded-lg hover:brightness-110 flex items-center gap-1 transition-all active:scale-95 cursor-pointer font-bold disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Tarefa
            </button>
          </div>
        </div>
      </div>

      {/* Grid columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="kanban-board">
        {columns.map(col => {
          const colTasks = processTarefas.filter(t => t.Status_Tarefa === col.id);
          
          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                if (currentUser.role !== 'Visualizador' && currentUser.role !== 'Auditor') {
                  setDraggedOverCol(col.id);
                }
              }}
              onDragLeave={() => {
                setDraggedOverCol(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDraggedOverCol(null);
                if (currentUser.role === 'Visualizador' || currentUser.role === 'Auditor') return;
                
                const taskId = e.dataTransfer.getData('text/plain');
                if (taskId) {
                  const taskToMove = processTarefas.find(t => t.id === taskId);
                  if (taskToMove) {
                    handleMoveTask(taskToMove, col.id);
                  }
                }
              }}
              className={`flex flex-col h-[500px] rounded-xl border p-4 transition-all duration-200 ${
                draggedOverCol === col.id 
                  ? 'border-primary bg-primary/5 ring-4 ring-primary/10 scale-[1.01]' 
                  : `border-dashed ${col.border} ${col.bg}`
              }`}
            >
              {/* Header column */}
              <div className="flex justify-between items-center mb-3">
                <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${col.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full bg-current`} />
                  {col.title}
                </span>
                <span className="bg-surface-container-high text-on-surface-variant text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-outline-variant/45">
                  {colTasks.length}
                </span>
              </div>

              {/* Tasks list inside column */}
              <div className="flex-1 space-y-3 overflow-y-auto min-h-0 pr-1 custom-scrollbar">
                {colTasks.length === 0 ? (
                  <div className="h-full border border-dashed border-outline-variant/10 rounded-lg flex flex-col items-center justify-center p-4">
                    <p className="text-[10px] text-on-surface-variant/40 text-center italic">
                      {draggedOverCol === col.id ? "Solte para mover aqui!" : "Arraste tarefas ou selecione um modelo"}
                    </p>
                  </div>
                ) : (
                  colTasks.map(task => {
                    // Quick stats/telemetry indicators
                    const totalSecOnRecord = Object.values(task.DuracaoColunas || {}).reduce((s, a) => s + a, 0);
                    const formattedDur = totalSecOnRecord > 0 
                      ? `${Math.ceil(totalSecOnRecord / 3600)}h logs`
                      : 'Em progresso';
                    
                    const isDraggable = currentUser.role !== 'Visualizador' && currentUser.role !== 'Auditor';

                     return (
                      <div
                        key={task.id}
                        draggable={isDraggable}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', task.id);
                        }}
                        onClick={() => handleOpenTaskDetail(task)}
                        className={`bg-surface-container-low border border-outline-variant/60 rounded-lg p-3 hover:border-primary/50 hover:bg-surface-container-high hover:shadow transition-all group shadow-sm flex flex-col justify-between cursor-pointer ${
                          isDraggable ? 'active:cursor-grabbing' : ''
                        }`}
                      >
                        <div className="space-y-2">
                          <p className="text-xs text-on-surface font-semibold leading-relaxed">{task.Tarefa}</p>
                          <div className="flex flex-wrap gap-1.5 items-center font-sans">
                            <span className="text-[9px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded font-mono border border-outline-variant/30">
                              Prazo: {task.Prazo_Dias} d
                            </span>
                            {task.MovidoPor && (
                              <span className="text-[8px] text-primary bg-primary/5 border border-primary/20 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold font-sans">
                                <UserCheck className="w-2.5 h-2.5" />
                                {task.MovidoPor.split(' ')[0]}
                              </span>
                            )}
                          </div>

                          {/* Progress bar for checklist subtasks or planning phase */}
                          {(() => {
                            const subTotal = task.subTarefas?.length || 0;
                            const subDone = task.subTarefas?.filter(s => s.concluida).length || 0;
                            const pctCompleto = subTotal > 0 ? Math.round((subDone / subTotal) * 100) : 0;
                            
                            // If no subtasks, determine progress based on Column status
                            const useColumnProgress = subTotal === 0;
                            let colProgress = 15;
                            let progressLabel = "Fluxo: Pendente (15%)";
                            let barColor = "bg-slate-400";
                            
                            if (task.Status_Tarefa === 'Em Elaboração') {
                              colProgress = 45;
                              progressLabel = "Fluxo: Elaboração (45%)";
                              barColor = "bg-tertiary";
                            } else if (task.Status_Tarefa === 'Aguardando Assinatura') {
                              colProgress = 75;
                              progressLabel = "Fluxo: Assinatura (75%)";
                              barColor = "bg-blue-400";
                            } else if (task.Status_Tarefa === 'Concluído') {
                              colProgress = 100;
                              progressLabel = "Fluxo: Concluído (100%)";
                              barColor = "bg-emerald-500";
                            }

                            const finalPct = useColumnProgress ? colProgress : pctCompleto;
                            const finalLabel = useColumnProgress ? progressLabel : `Subatividades: ${pctCompleto}%`;
                            const finalBarColor = useColumnProgress ? barColor : "bg-emerald-500";

                            return (
                              <div className="w-full pt-1.5 mt-1 space-y-1">
                                <div className="flex justify-between items-center text-[8.5px] font-bold text-on-surface-variant/85 font-sans">
                                  <span>{finalLabel}</span>
                                  {!useColumnProgress && <span>{subDone}/{subTotal}</span>}
                                </div>
                                <div className="w-full bg-outline-variant/20 h-1 rounded-full overflow-hidden">
                                  <div 
                                    className={`${finalBarColor} h-full rounded-full transition-all duration-300`}
                                    style={{ width: `${finalPct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Telemetry tracker & controls info */}
                        <div className="border-t border-outline-variant/20 mt-3 pt-2 flex items-center justify-between">
                          <span className="text-[8px] text-on-surface-variant/60 font-mono flex items-center gap-0.5">
                            <Clock className="w-2 h-2 text-primary/60" />
                            {formattedDur}
                          </span>

                          {/* Quick Nav arrows */}
                          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenTaskDetail(task);
                              }}
                              className="p-1 text-on-surface-variant/50 hover:text-primary hover:bg-primary/10 rounded transition-colors cursor-pointer"
                              title="Ver subatividades & Checklist"
                            >
                              <ListTodo className="w-3 h-3" />
                            </button>
                            {currentUser.role !== 'Visualizador' && currentUser.role !== 'Auditor' && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteTarefa(task.id);
                                  }}
                                  className="p-1 hover:text-rose-400 text-on-surface-variant/50 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                                  title="Excluir tarefa"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                                {col.id !== 'Pendente' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const prevIdx = columns.findIndex(c => c.id === col.id) - 1;
                                      handleMoveTask(task, columns[prevIdx].id);
                                    }}
                                    className="p-1 hover:text-primary hover:bg-primary/10 rounded cursor-pointer"
                                    title="Mover para esquerda"
                                  >
                                    <ChevronLeft className="w-3 h-3" />
                                  </button>
                                )}
                                {col.id !== 'Concluído' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const nextIdx = columns.findIndex(c => c.id === col.id) + 1;
                                      handleMoveTask(task, columns[nextIdx].id);
                                    }}
                                    className="p-1 hover:text-primary hover:bg-primary/10 rounded text-primary cursor-pointer"
                                    title="Mover para direita"
                                  >
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual Task Creator Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-surface-container border border-outline-variant w-full max-w-md max-h-full sm:max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-xl">
            <div className="bg-surface-container-high px-5 py-3 border-b border-outline-variant flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-on-surface">Adicionar Nova Atividade Manual</span>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleCreateTask} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Título da Atividade</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Obter certidão conjunta de débitos"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Prazo de Resolução (Em dias)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={newTaskPrazo}
                  onChange={e => setNewTaskPrazo(parseInt(e.target.value) || 10)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-3 py-1.5 text-xs border border-outline-variant rounded text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={currentUser.role === 'Visualizador'}
                  className="px-4 py-1.5 text-xs bg-primary text-on-primary font-semibold rounded cursor-pointer hover:brightness-110 disabled:opacity-50"
                >
                  Criar Atividade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Manager Configuration Modal */}
      {isTemplateManagerOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-surface-container border border-outline-variant w-full max-w-2xl max-h-full sm:max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-2xl">
            <div className="bg-surface-container-high px-6 py-4 border-b border-outline-variant flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-on-surface">Gerenciador de Modelos de Processo (BPMN / Kanban)</h3>
              </div>
              <button onClick={() => setIsTemplateManagerOpen(false)} className="text-on-surface-variant hover:text-on-surface p-1 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-5 overflow-y-auto md:overflow-hidden h-auto md:h-[400px] flex-1 min-h-0">
              {/* Left Column: Template flow list */}
              <div className="md:col-span-5 flex flex-col border-r border-outline-variant/40 pr-4 space-y-4 h-full overflow-y-auto">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Selecione o Fluxo</span>
                  <div className="space-y-1.5">
                    {localTemplates.map((t, index) => (
                      <div
                        key={t.tipo}
                        onClick={() => setSelectedTemplateIndex(index)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer border flex justify-between items-center transition-all ${
                          selectedTemplateIndex === index
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-surface-container-low border-outline-variant hover:bg-surface-container-low/70 text-on-surface-variant'
                        }`}
                      >
                        <span className="truncate">{t.tipo}</span>
                        <Trash2
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveTemplate(index);
                          }}
                          className="w-3.5 h-3.5 text-on-surface-variant hover:text-rose-400 shrink-0 select-all cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-outline-variant/35 pt-3 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Criar Novo Tipo de Fluxo</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: Pregão SRP..."
                      value={newTemplateName}
                      onChange={e => setNewTemplateName(e.target.value)}
                      className="flex-1 bg-surface-container-low border border-outline-variant rounded px-2.5 py-1 text-xs text-on-surface focus:outline-none focus:border-primary"
                    />
                    <button
                      onClick={handleAddTemplate}
                      className="p-1 px-2.5 bg-primary text-on-primary rounded text-xs hover:brightness-110 cursor-pointer"
                    >
                      Criar
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Template Steps list */}
              <div className="md:col-span-7 flex flex-col space-y-3 h-full overflow-hidden">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant">Atividades Inclusas no Modelo</span>
                  <span className="text-[10px] bg-surface-container-high px-2 py-0.5 rounded text-on-surface">
                    {localTemplates[selectedTemplateIndex]?.tasks.length || 0} passos
                  </span>
                </div>

                {/* Steps List */}
                <div className="flex-1 overflow-y-auto border border-outline-variant/40 rounded-lg p-2.5 space-y-1.5 bg-surface-container-lowest custom-scrollbar">
                  {localTemplates[selectedTemplateIndex]?.tasks.length === 0 ? (
                    <p className="text-xs text-on-surface-variant/40 italic py-10 text-center">Nenhuma atividade cadastrada neste fluxo de processo.</p>
                  ) : (
                    localTemplates[selectedTemplateIndex]?.tasks.map((step, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-surface-container-low/55 border border-outline-variant/30 rounded p-1.5 px-2.5 text-xs text-on-surface">
                        <span className="truncate flex-1 pr-2">{idx + 1}. {step.tarefa}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-on-surface-variant font-mono bg-surface-container-high px-1.5 py-0.25 rounded">{step.prazo_dias}d</span>
                          <X
                            onClick={() => handleRemoveStepFromTemplate(idx)}
                            className="w-3.5 h-3.5 text-on-surface-variant hover:text-rose-400 cursor-pointer"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Dynamic step creator */}
                <div className="bg-surface-container-high/40 p-3 rounded-lg border border-outline-variant/40 space-y-2.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nova tarefa padrão de fluxo..."
                      value={newStepName}
                      onChange={e => setNewStepName(e.target.value)}
                      className="flex-1 bg-surface-container-low border border-outline-variant rounded px-2.5 py-1 text-xs text-on-surface focus:outline-none focus:border-primary"
                    />
                    <input
                      type="number"
                      placeholder="Dias"
                      value={newStepPrazo}
                      onChange={e => setNewStepPrazo(parseInt(e.target.value) || 1)}
                      className="w-16 bg-surface-container-low border border-outline-variant rounded px-2.5 py-1 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                  <button
                    onClick={handleAddStepToTemplate}
                    className="w-full py-1 bg-primary/20 text-primary border border-primary/30 text-xs font-semibold rounded hover:bg-primary/25 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Adicionar Atividade ao Modelo
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-outline-variant bg-surface-container-high/20 shrink-0">
              <button
                type="button"
                onClick={() => setIsTemplateManagerOpen(false)}
                className="px-4 py-2 border border-outline-variant rounded text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Inviabilizar
              </button>
              <button
                onClick={handleSaveTemplates}
                className="px-5 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:brightness-110 shadow justify-center cursor-pointer"
              >
                Salvar Alterações de Fluxo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Task Checklist & Info Modal */}
      {selectedTaskDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-surface-container border border-outline-variant w-full max-w-lg rounded-xl overflow-hidden shadow-xl flex flex-col max-h-full sm:max-h-[90vh]">
            
            {/* Header */}
            <div className="bg-surface-container-high px-5 py-3 border-b border-outline-variant flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-on-surface flex items-center gap-1.5 font-display">
                <ListTodo className="w-4 h-4 text-primary" />
                Dossiê da Atividade & Subtarefas
              </span>
              <button 
                onClick={() => setSelectedTaskDetail(null)} 
                className="text-on-surface-variant hover:text-on-surface p-1 hover:bg-outline-variant/10 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-sans">
              
              {/* Task general forms */}
              <div className="space-y-3 p-3.5 bg-surface-container-low border border-outline-variant/50 rounded-xl">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Dados Gerais da Atividade</span>
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">Título</label>
                  <input
                    type="text"
                    disabled={currentUser.role === 'Visualizador' || currentUser.role === 'Auditor'}
                    value={editTaskTitle}
                    onChange={e => setEditTaskTitle(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">Prazo de Resolução</label>
                    <input
                      type="number"
                      disabled={currentUser.role === 'Visualizador' || currentUser.role === 'Auditor'}
                      value={editTaskPrazo}
                      onChange={e => setEditTaskPrazo(parseInt(e.target.value) || 10)}
                      className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">Status da coluna</label>
                    <select
                      disabled={currentUser.role === 'Visualizador' || currentUser.role === 'Auditor'}
                      value={editTaskStatus}
                      onChange={e => setEditTaskStatus(e.target.value as StatusTarefa)}
                      className="w-full bg-surface-container border border-outline-variant rounded px-2 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary disabled:opacity-50"
                    >
                      <option value="Pendente font-sans">Pendente</option>
                      <option value="Em Elaboração font-sans">Em Elaboração</option>
                      <option value="Aguardando Assinatura font-sans">Aguardando Assinatura</option>
                      <option value="Concluído font-sans">Concluída</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Subtasks checklist area */}
              <div className="space-y-3.5">
                <div className="flex justify-between items-center font-sans">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Checklist de Subtarefas ({selectedTaskDetail.subTarefas?.filter(s => s.concluida).length || 0}/{(selectedTaskDetail.subTarefas || []).length})
                  </span>
                </div>

                {/* Subtask additions box */}
                {currentUser.role !== 'Visualizador' && currentUser.role !== 'Auditor' && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: Obter assinatura do Secretário..."
                      value={newSubTaskTitle}
                      onChange={e => setNewSubTaskTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSubTarefa(selectedTaskDetail.id, newSubTaskTitle);
                        }
                      }}
                      className="flex-1 bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddSubTarefa(selectedTaskDetail.id, newSubTaskTitle)}
                      className="px-3 bg-primary text-on-primary rounded text-xs hover:brightness-110 flex items-center justify-center cursor-pointer font-bold shrink-0 font-sans"
                    >
                      + Subatividades
                    </button>
                  </div>
                )}

                {/* List of subtasks */}
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1 font-sans">
                  {(selectedTaskDetail.subTarefas || []).length === 0 ? (
                    <div className="border border-dashed border-outline-variant/40 rounded-xl p-5 text-center text-xs text-on-surface-variant/40 italic">
                      Esta atividade não possui nenhuma subtarefa cadastrada. Insira subtarefas no checklist para monitorar o andamento.
                    </div>
                  ) : (
                    (selectedTaskDetail.subTarefas || []).map(st => (
                      <div 
                        key={st.id} 
                        className={`flex justify-between items-center p-2.5 rounded-lg border text-xs transition-all ${
                          st.concluida 
                            ? 'bg-emerald-500/5 border-emerald-500/10 text-on-surface-variant line-through opacity-75' 
                            : 'bg-surface-container-low border-outline-variant/40 text-on-surface hover:bg-surface-container-high'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleSubTarefa(selectedTaskDetail.id, st.id)}
                          className="flex items-center gap-2.5 text-left flex-1 font-semibold select-none cursor-pointer text-sans"
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            st.concluida 
                              ? 'bg-emerald-500 border-emerald-500 text-on-primary' 
                              : 'border-outline-variant'
                          }`}>
                            {st.concluida && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </span>
                          <span className="truncate pr-2 font-semibold">{st.titulo}</span>
                        </button>

                        {currentUser.role !== 'Visualizador' && currentUser.role !== 'Auditor' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSubTarefa(selectedTaskDetail.id, st.id)}
                            className="p-1 hover:text-rose-400 text-on-surface-variant hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                            title="Remover subtarefa"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-surface-container-high/90 p-4 border-t border-outline-variant flex justify-between items-center shrink-0 font-sans">
              <div>
                <p className="text-[10px] text-on-surface-variant font-mono">
                  Duração total: {(() => {
                    const durations = selectedTaskDetail?.DuracaoColunas;
                    if (!durations) return 'Em andamento';
                    const values = Object.values(durations) as number[];
                    const totalSec = values.reduce((sum, val) => sum + (val || 0), 0);
                    return totalSec > 0 ? `${Math.ceil(totalSec / 3600)}h logs` : 'Em andamento';
                  })()}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTaskDetail(null)}
                  className="px-3 py-1.5 border border-outline-variant rounded text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  Fechar
                </button>
                {currentUser.role !== 'Visualizador' && currentUser.role !== 'Auditor' && (
                  <button
                    type="button"
                    onClick={() => handleSaveTaskDetailEdits()}
                    className="px-4 py-1.5 bg-primary text-on-primary font-semibold rounded text-xs hover:brightness-110 shadow cursor-pointer text-center"
                  >
                    Salvar Dados
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
