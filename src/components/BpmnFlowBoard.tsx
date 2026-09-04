/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Planejamento, 
  TarefaPlanejamento, 
  User, 
  BpmnLane, 
  BpmnNode, 
  BpmnConnection, 
  BpmnNodeType, 
  StatusTarefa 
} from '../types';
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
  ArrowRight, 
  X, 
  Sparkles,
  Link2,
  Unlink,
  FileText,
  Cog,
  GripVertical,
  MousePointer,
  Tag,
  Send,
  Share2,
  AlertOctagon,
  FileBox,
  Mail,
  MoveVertical,
  RefreshCw
} from 'lucide-react';

export const DEFAULT_BPMN_LANES: BpmnLane[] = [
  { id: 'lane-demandante', nome: 'Área Demandante / Requisitante', cor: '#0ea5e9', ordem: 1 },
  { id: 'lane-gecti', nome: 'Equipe de Planejamento da Contratação (GECTI)', cor: '#10b981', ordem: 2 },
  { id: 'lane-conjur', nome: 'Assessoria Jurídica (CONJUR / AGU)', cor: '#8b5cf6', ordem: 3 },
  { id: 'lane-compras', nome: 'Área de Compras e Licitações (CGLIC / DLS)', cor: '#f59e0b', ordem: 4 },
  { id: 'lane-autoridade', nome: 'Autoridade Competente / Ordenador', cor: '#ec4899', ordem: 5 },
];

// Tipos de ferramentas de interação do canvas
type CanvasToolMode = 'select' | 'connect_sequence' | 'connect_association';

// Paleta completa de componentes padrão BPMN 2.0
interface PaletteItemDef {
  type: BpmnNodeType;
  category: 'events' | 'tasks' | 'gateways' | 'artifacts';
  label: string;
  desc: string;
  icon: string;
  bg: string;
  border: string;
}

const PALETTE_ITEMS: PaletteItemDef[] = [
  // --- EVENTOS ---
  { 
    type: 'start', 
    category: 'events', 
    label: 'Início Simples', 
    desc: 'Formalização da demanda inicial', 
    icon: 'play', 
    bg: 'bg-emerald-500/15', 
    border: 'border-emerald-500/60' 
  },
  { 
    type: 'start_message', 
    category: 'events', 
    label: 'Início por Mensagem / DFD', 
    desc: 'Recebimento de Ofício ou Documento de Oficialização (DFD)', 
    icon: 'mail', 
    bg: 'bg-emerald-500/15', 
    border: 'border-emerald-500/60' 
  },
  { 
    type: 'start_timer', 
    category: 'events', 
    label: 'Início Temporal (PCA)', 
    desc: 'Início agendado no calendário do Plano de Contratações Anual', 
    icon: 'clock', 
    bg: 'bg-emerald-500/15', 
    border: 'border-emerald-500/60' 
  },
  { 
    type: 'timer', 
    category: 'events', 
    label: 'Temporizador / SLA', 
    desc: 'Contagem de prazo regulamentar / alerta temporal', 
    icon: 'clock', 
    bg: 'bg-purple-500/15', 
    border: 'border-purple-500/60' 
  },
  { 
    type: 'intermediate_message', 
    category: 'events', 
    label: 'Intermediário Mensagem', 
    desc: 'Aguardando resposta de diligência ou parecer técnico', 
    icon: 'mail', 
    bg: 'bg-sky-500/15', 
    border: 'border-sky-500/60' 
  },
  { 
    type: 'end', 
    category: 'events', 
    label: 'Fim (Sucesso)', 
    desc: 'Contratação homologada e formalizada com êxito', 
    icon: 'check', 
    bg: 'bg-rose-500/15', 
    border: 'border-rose-500/60' 
  },
  { 
    type: 'end_terminate', 
    category: 'events', 
    label: 'Fim (Cancelamento / Erro)', 
    desc: 'Revogação, anulação ou encerramento frustrado do certame', 
    icon: 'alert-octagon', 
    bg: 'bg-red-500/20', 
    border: 'border-red-500/80' 
  },

  // --- ATIVIDADES / TAREFAS ---
  { 
    type: 'task_user', 
    category: 'tasks', 
    label: 'Tarefa de Usuário', 
    desc: 'Atividade manual executada por servidor (ex: ETP, TR)', 
    icon: 'user', 
    bg: 'bg-sky-500/15', 
    border: 'border-sky-500/60' 
  },
  { 
    type: 'task_service', 
    category: 'tasks', 
    label: 'Tarefa de Sistema', 
    desc: 'Ação executada em sistema informatizado / SEI / Compras.gov', 
    icon: 'cog', 
    bg: 'bg-teal-500/15', 
    border: 'border-teal-500/60' 
  },
  { 
    type: 'task_send', 
    category: 'tasks', 
    label: 'Tarefa de Envio / DOU', 
    desc: 'Publicação de edital em diário oficial ou expedição de aviso', 
    icon: 'send', 
    bg: 'bg-cyan-500/15', 
    border: 'border-cyan-500/60' 
  },
  { 
    type: 'task_subprocess', 
    category: 'tasks', 
    label: 'Subprocesso', 
    desc: 'Conjunto detalhado de atividades complementares', 
    icon: 'box', 
    bg: 'bg-blue-500/15', 
    border: 'border-blue-500/60' 
  },

  // --- GATEWAYS (DECISÕES) ---
  { 
    type: 'gateway_exclusive', 
    category: 'gateways', 
    label: 'Gateway XOR (Exclusivo)', 
    desc: 'Bifurcação exclusiva onde apenas uma alternativa é tomada (Sim / Não)', 
    icon: 'x', 
    bg: 'bg-amber-500/15', 
    border: 'border-amber-500/60' 
  },
  { 
    type: 'gateway_parallel', 
    category: 'gateways', 
    label: 'Gateway AND (Paralelo)', 
    desc: 'Execução simultânea de múltiplos caminhos sem condições', 
    icon: 'plus', 
    bg: 'bg-indigo-500/15', 
    border: 'border-indigo-500/60' 
  },
  { 
    type: 'gateway_inclusive', 
    category: 'gateways', 
    label: 'Gateway OR (Inclusivo)', 
    desc: 'Um ou mais ramos podem ser executados com base em condições', 
    icon: 'split', 
    bg: 'bg-orange-500/15', 
    border: 'border-orange-500/60' 
  },
  { 
    type: 'gateway_event', 
    category: 'gateways', 
    label: 'Gateway Baseado em Eventos', 
    desc: 'O caminho a seguir é determinado pelo primeiro evento ocorrido', 
    icon: 'share-2', 
    bg: 'bg-violet-500/15', 
    border: 'border-violet-500/60' 
  },

  // --- ARTEFATOS / DADOS ---
  { 
    type: 'data_object', 
    category: 'artifacts', 
    label: 'Documento / Processo SEI', 
    desc: 'Artefato documental formal vinculado ao fluxo (Ex: Edital, TR)', 
    icon: 'file-text', 
    bg: 'bg-emerald-500/15', 
    border: 'border-emerald-500/60' 
  },
  { 
    type: 'annotation', 
    category: 'artifacts', 
    label: 'Anotação / Nota Técnica', 
    desc: 'Texto explicativo ou fundamento legal (Ex: Art. 18 da Lei 14.133)', 
    icon: 'tag', 
    bg: 'bg-surface-container', 
    border: 'border-outline-variant' 
  },
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
  // Container canvas ref para cálculo das linhas SVG
  const canvasRef = useRef<HTMLDivElement>(null);
  const [svgDimensions, setSvgDimensions] = useState({ width: 1200, height: 600 });

  // Modo da ferramenta ativa no canvas
  const [activeTool, setActiveTool] = useState<CanvasToolMode>('select');

  // Filtro de categoria da paleta
  const [paletteTab, setPaletteTab] = useState<'all' | 'events' | 'tasks' | 'gateways' | 'artifacts'>('all');

  // Raias de responsabilidade
  const lanes: BpmnLane[] = useMemo(() => {
    if (planejamento.bpmnLanes && planejamento.bpmnLanes.length > 0) {
      return [...planejamento.bpmnLanes].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    }
    return DEFAULT_BPMN_LANES;
  }, [planejamento.bpmnLanes]);

  // Nós BPMN adicionais (Gateways, Eventos, Anotações, Documentos)
  const bpmnNodes: BpmnNode[] = useMemo(() => {
    return planejamento.bpmnNodes || [];
  }, [planejamento.bpmnNodes]);

  // Conexões / Setas de fluxo
  const connections: BpmnConnection[] = useMemo(() => {
    return planejamento.bpmnConnections || [];
  }, [planejamento.bpmnConnections]);

  // Tarefas deste planejamento
  const planTarefas = useMemo(() => {
    return tarefas.filter(t => t.ProcessoPlanejamento === planejamento.SEI_Processo);
  }, [tarefas, planejamento.SEI_Processo]);

  // Estados de Modais
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isLaneModalOpen, setIsLaneModalOpen] = useState(false);
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [isConnModalOpen, setIsConnModalOpen] = useState(false);

  // Estados de Edição
  const [editingTask, setEditingTask] = useState<TarefaPlanejamento | null>(null);
  const [editingLane, setEditingLane] = useState<BpmnLane | null>(null);
  const [editingNode, setEditingNode] = useState<BpmnNode | null>(null);
  const [editingConnection, setEditingConnection] = useState<BpmnConnection | null>(null);

  // Estados dos formulários
  const [taskNome, setTaskNome] = useState('');
  const [taskPrazo, setTaskPrazo] = useState(5);
  const [taskArea, setTaskArea] = useState(lanes[0]?.nome || 'Equipe de Planejamento da Contratação (GECTI)');
  const [taskStatus, setTaskStatus] = useState<StatusTarefa>('Pendente');
  const [taskDescricao, setTaskDescricao] = useState('');

  const [laneNome, setLaneNome] = useState('');
  const [laneCor, setLaneCor] = useState('#10b981');

  const [nodeLabel, setNodeLabel] = useState('');
  const [nodeDesc, setNodeDesc] = useState('');

  const [connLabel, setConnLabel] = useState('');
  const [connTipo, setConnTipo] = useState<'sequence' | 'conditional' | 'default' | 'association'>('sequence');
  const [connCor, setConnCor] = useState('#38bdf8');

  // Modo de conexão ativo (origem selecionada para a seta)
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);

  // Drag and drop state
  const [dragOverLaneId, setDragOverLaneId] = useState<string | null>(null);

  // Filtro de status de execução
  const [filterStatus, setFilterStatus] = useState<'all' | 'atrasadas' | 'em_andamento' | 'concluidas'>('all');

  // Coordenadas calculadas para renderização do SVG de setas
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number; w: number; h: number }>>({});

  // Recalcular posições relativas dos nós para traçar as setas SVG
  const updateNodePositions = () => {
    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    setSvgDimensions({ width: canvasRect.width, height: canvasRect.height });

    const newPositions: Record<string, { x: number; y: number; w: number; h: number }> = {};

    // Mapear tarefas
    planTarefas.forEach(t => {
      const el = document.getElementById(`bpmn-node-${t.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        newPositions[t.id] = {
          x: rect.left - canvasRect.left + rect.width / 2,
          y: rect.top - canvasRect.top + rect.height / 2,
          w: rect.width,
          h: rect.height,
        };
      }
    });

    // Mapear nós adicionais
    bpmnNodes.forEach(n => {
      const el = document.getElementById(`bpmn-node-${n.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        newPositions[n.id] = {
          x: rect.left - canvasRect.left + rect.width / 2,
          y: rect.top - canvasRect.top + rect.height / 2,
          w: rect.width,
          h: rect.height,
        };
      }
    });

    setNodePositions(newPositions);
  };

  useEffect(() => {
    updateNodePositions();
    const handleResize = () => updateNodePositions();
    window.addEventListener('resize', handleResize);
    const timeout = setTimeout(updateNodePositions, 300);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeout);
    };
  }, [planTarefas, bpmnNodes, lanes]);

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

    return { diasDecorridos, prazo, isConcluida, isAtrasada, diasExcedidos, diasRestantes };
  };

  // Métricas de SLA
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

  // Itens da paleta filtrados por aba
  const displayedPaletteItems = useMemo(() => {
    if (paletteTab === 'all') return PALETTE_ITEMS;
    return PALETTE_ITEMS.filter(i => i.category === paletteTab);
  }, [paletteTab]);

  // --- DRAG AND DROP HANDLERS ---
  const handlePaletteDragStart = (e: React.DragEvent, type: BpmnNodeType) => {
    e.dataTransfer.setData('application/bpmn-palette-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleTaskDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('application/bpmn-task-id', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleNodeDragStart = (e: React.DragEvent, nodeId: string) => {
    e.dataTransfer.setData('application/bpmn-node-id', nodeId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleLaneDragOver = (e: React.DragEvent, laneId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (dragOverLaneId !== laneId) setDragOverLaneId(laneId);
  };

  const handleLaneDragLeave = () => {
    setDragOverLaneId(null);
  };

  const handleLaneDrop = (e: React.DragEvent, targetLane: BpmnLane) => {
    e.preventDefault();
    setDragOverLaneId(null);

    const paletteType = e.dataTransfer.getData('application/bpmn-palette-type') as BpmnNodeType;
    const draggedTaskId = e.dataTransfer.getData('application/bpmn-task-id');
    const draggedNodeId = e.dataTransfer.getData('application/bpmn-node-id');

    // 1. Soltou um componente da Paleta na Raia
    if (paletteType) {
      if (
        paletteType === 'task_user' || 
        paletteType === 'task_service' || 
        paletteType === 'task_send' || 
        paletteType === 'task_subprocess'
      ) {
        // Cria uma Tarefa associada ao Kanban e ao BPMN
        const defaultNames: Record<string, string> = {
          task_user: 'Nova Tarefa de Usuário',
          task_service: 'Rotina de Sistema / SEI',
          task_send: 'Publicação / Envio de Notificação',
          task_subprocess: 'Subprocesso Licitatório',
        };

        const novaTarefa: TarefaPlanejamento = {
          id: `tar-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          ProcessoPlanejamento: planejamento.SEI_Processo,
          Tarefa: defaultNames[paletteType] || 'Nova Tarefa BPMN',
          Inicio: new Date().toISOString(),
          Prazo_Dias: 5,
          Status_Tarefa: 'Pendente',
          areaResponsavel: targetLane.nome,
          bpmnType: 'task',
          descricao: '',
          MovidoPor: currentUser.name,
          MovidoEm: new Date().toISOString(),
          subTarefas: [],
        };
        onAddTarefa(novaTarefa);
      } else {
        // Cria um Nó BPMN adicional (Gateway, Evento, Documento SEI, Anotação)
        const defaultLabels: Record<string, string> = {
          start: 'Início do Processo',
          start_message: 'Recebimento de Ofício / DFD',
          start_timer: 'Agendamento no PCA',
          timer: 'Prazo Limite / SLA',
          intermediate_message: 'Aguardando Parecer / Diligência',
          gateway_exclusive: 'Decisão Exclusiva (XOR)',
          gateway_parallel: 'Execução Paralela (AND)',
          gateway_inclusive: 'Decisão Inclusiva (OR)',
          gateway_event: 'Decisão por Evento',
          end: 'Contratação Homologada',
          end_terminate: 'Processo Cancelado / Fracassado',
          data_object: 'Documento / Processo SEI',
          annotation: 'Anotação / Nota Técnica',
        };

        const newNode: BpmnNode = {
          id: `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          type: paletteType,
          label: defaultLabels[paletteType] || 'Elemento BPMN',
          laneId: targetLane.id,
          prazoDias: paletteType === 'timer' ? 5 : undefined,
        };

        const updatedNodes = [...bpmnNodes, newNode];
        if (onUpdatePlanejamento) {
          onUpdatePlanejamento({
            ...planejamento,
            bpmnNodes: updatedNodes,
          });
        }
      }
      setTimeout(updateNodePositions, 100);
      return;
    }

    // 2. Moveu uma Tarefa existente de uma raia para outra
    if (draggedTaskId) {
      const task = planTarefas.find(t => t.id === draggedTaskId);
      if (task && task.areaResponsavel !== targetLane.nome) {
        onUpdateTarefa({
          ...task,
          areaResponsavel: targetLane.nome,
          MovidoPor: currentUser.name,
          MovidoEm: new Date().toISOString(),
        });
        setTimeout(updateNodePositions, 100);
      }
      return;
    }

    // 3. Moveu um Nó BPMN adicional para outra raia
    if (draggedNodeId) {
      const node = bpmnNodes.find(n => n.id === draggedNodeId);
      if (node && node.laneId !== targetLane.id) {
        const updated = bpmnNodes.map(n => n.id === draggedNodeId ? { ...n, laneId: targetLane.id } : n);
        if (onUpdatePlanejamento) {
          onUpdatePlanejamento({
            ...planejamento,
            bpmnNodes: updated,
          });
        }
        setTimeout(updateNodePositions, 100);
      }
    }
  };

  // --- GERENCIAMENTO DE SETAS DE FLUXO ---
  const handleConnectElement = (targetNodeId: string) => {
    if (!connectSourceId) {
      // Primeiro clique: define origem
      setConnectSourceId(targetNodeId);
    } else if (connectSourceId === targetNodeId) {
      // Cancelar seleção se clicar no mesmo
      setConnectSourceId(null);
    } else {
      // Segundo clique: traça a conexão
      const tipoConexao = activeTool === 'connect_association' ? 'association' : 'sequence';
      const defaultColor = tipoConexao === 'association' ? '#94a3b8' : '#38bdf8';

      // Verificar se já existe conexão idêntica
      const exists = connections.some(c => c.fromId === connectSourceId && c.toId === targetNodeId);
      if (!exists) {
        const newConn: BpmnConnection = {
          id: `conn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          fromId: connectSourceId,
          toId: targetNodeId,
          label: '',
          tipo: tipoConexao,
          cor: defaultColor,
        };

        const updated = [...connections, newConn];
        if (onUpdatePlanejamento) {
          onUpdatePlanejamento({
            ...planejamento,
            bpmnConnections: updated,
          });
        }
      }

      setConnectSourceId(null);
      setTimeout(updateNodePositions, 100);
    }
  };

  const handleOpenConnectionModal = (conn: BpmnConnection) => {
    setEditingConnection(conn);
    setConnLabel(conn.label || '');
    setConnTipo(conn.tipo || 'sequence');
    setConnCor(conn.cor || '#38bdf8');
    setIsConnModalOpen(true);
  };

  const handleSaveConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConnection) return;

    const updated = connections.map(c => 
      c.id === editingConnection.id 
        ? { ...c, label: connLabel.trim(), tipo: connTipo, cor: connCor } 
        : c
    );

    if (onUpdatePlanejamento) {
      onUpdatePlanejamento({
        ...planejamento,
        bpmnConnections: updated,
      });
    }
    setIsConnModalOpen(false);
  };

  const handleInvertConnection = () => {
    if (!editingConnection) return;
    const updated = connections.map(c => 
      c.id === editingConnection.id 
        ? { ...c, fromId: c.toId, toId: c.fromId } 
        : c
    );
    if (onUpdatePlanejamento) {
      onUpdatePlanejamento({
        ...planejamento,
        bpmnConnections: updated,
      });
    }
    setIsConnModalOpen(false);
    setTimeout(updateNodePositions, 100);
  };

  const handleDeleteConnection = (connId: string) => {
    const updated = connections.filter(c => c.id !== connId);
    if (onUpdatePlanejamento) {
      onUpdatePlanejamento({
        ...planejamento,
        bpmnConnections: updated,
      });
    }
    setIsConnModalOpen(false);
    setTimeout(updateNodePositions, 100);
  };

  // Auto-conectar sequencialmente elementos sem conexões
  const handleAutoConnectFlow = () => {
    if (planTarefas.length < 2) return;
    const newConns: BpmnConnection[] = [...connections];

    for (let i = 0; i < planTarefas.length - 1; i++) {
      const from = planTarefas[i].id;
      const to = planTarefas[i + 1].id;
      if (!newConns.some(c => c.fromId === from && c.toId === to)) {
        newConns.push({
          id: `conn-auto-${Date.now()}-${i}`,
          fromId: from,
          toId: to,
          tipo: 'sequence',
          cor: '#38bdf8',
        });
      }
    }

    if (onUpdatePlanejamento) {
      onUpdatePlanejamento({
        ...planejamento,
        bpmnConnections: newConns,
      });
    }
    setTimeout(updateNodePositions, 150);
  };

  // --- MODAL DE TAREFA ---
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
      onUpdateTarefa({
        ...editingTask,
        Tarefa: taskNome.trim(),
        Prazo_Dias: Number(taskPrazo) || 1,
        areaResponsavel: taskArea,
        Status_Tarefa: taskStatus,
        descricao: taskDescricao.trim(),
        MovidoPor: currentUser.name,
        MovidoEm: new Date().toISOString(),
      });
    } else {
      onAddTarefa({
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
      });
    }

    setIsTaskModalOpen(false);
    setTimeout(updateNodePositions, 100);
  };

  // --- MODAL DE RAIA ---
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
      const oldNome = editingLane.nome;
      const newNome = laneNome.trim();
      updatedLanes = lanes.map(l => l.id === editingLane.id ? { ...l, nome: newNome, cor: laneCor } : l);

      if (oldNome !== newNome) {
        planTarefas.forEach(t => {
          if (t.areaResponsavel === oldNome) {
            onUpdateTarefa({ ...t, areaResponsavel: newNome });
          }
        });
      }
    } else {
      updatedLanes = [
        ...lanes,
        { id: `lane-${Date.now()}`, nome: laneNome.trim(), cor: laneCor, ordem: lanes.length + 1 }
      ];
    }

    if (onUpdatePlanejamento) {
      onUpdatePlanejamento({ ...planejamento, bpmnLanes: updatedLanes });
    }
    setIsLaneModalOpen(false);
    setTimeout(updateNodePositions, 100);
  };

  const handleMoveLane = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= lanes.length) return;

    const newLanes = [...lanes];
    const temp = newLanes[index];
    newLanes[index] = newLanes[targetIdx];
    newLanes[targetIdx] = temp;

    const reordered = newLanes.map((l, idx) => ({ ...l, ordem: idx + 1 }));
    if (onUpdatePlanejamento) {
      onUpdatePlanejamento({ ...planejamento, bpmnLanes: reordered });
    }
    setTimeout(updateNodePositions, 100);
  };

  const handleDeleteLane = (laneId: string, laneNome: string) => {
    if (!confirm(`Deseja realmente remover a raia "${laneNome}"?`)) return;
    const updatedLanes = lanes.filter(l => l.id !== laneId);
    if (onUpdatePlanejamento) {
      onUpdatePlanejamento({ ...planejamento, bpmnLanes: updatedLanes });
    }
    setTimeout(updateNodePositions, 100);
  };

  // --- MODAL DE NÓ ADICIONAL (GATEWAY / EVENTO / DADOS) ---
  const handleOpenNodeModal = (node: BpmnNode) => {
    setEditingNode(node);
    setNodeLabel(node.label);
    setNodeDesc(node.descricao || '');
    setIsNodeModalOpen(true);
  };

  const handleSaveNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode || !nodeLabel.trim()) return;

    const updated = bpmnNodes.map(n => 
      n.id === editingNode.id ? { ...n, label: nodeLabel.trim(), descricao: nodeDesc.trim() } : n
    );

    if (onUpdatePlanejamento) {
      onUpdatePlanejamento({ ...planejamento, bpmnNodes: updated });
    }
    setIsNodeModalOpen(false);
  };

  const handleDeleteNode = (nodeId: string) => {
    const updated = bpmnNodes.filter(n => n.id !== nodeId);
    const updatedConns = connections.filter(c => c.fromId !== nodeId && c.toId !== nodeId);
    if (onUpdatePlanejamento) {
      onUpdatePlanejamento({ ...planejamento, bpmnNodes: updated, bpmnConnections: updatedConns });
    }
    setTimeout(updateNodePositions, 100);
  };

  // Carregador de fluxo de contratações públicas de TIC (Lei 14.133/2021)
  const handleLoadDefaultBpmnFlow = () => {
    if (planTarefas.length > 0 && !confirm('Este planejamento já possui tarefas. Deseja carregar o fluxo padrão BPMN complementar?')) {
      return;
    }

    const defaultTasks = [
      { id: `tar-dfl-1`, tarefa: 'DOD / DFD Oficializado no SEI', area: 'Área Demandante / Requisitante', prazo: 5, status: 'Concluído' as StatusTarefa },
      { id: `tar-dfl-2`, tarefa: 'Estudos Técnicos Preliminares (ETP)', area: 'Equipe de Planejamento da Contratação (GECTI)', prazo: 15, status: 'Em Elaboração' as StatusTarefa },
      { id: `tar-dfl-3`, tarefa: 'Matriz de Riscos & Termo de Referência', area: 'Equipe de Planejamento da Contratação (GECTI)', prazo: 10, status: 'Pendente' as StatusTarefa },
      { id: `tar-dfl-4`, tarefa: 'Parecer Jurídico Conclusivo (AGU)', area: 'Assessoria Jurídica (CONJUR / AGU)', prazo: 15, status: 'Pendente' as StatusTarefa },
      { id: `tar-dfl-5`, tarefa: 'Sessão Pública do Pregão Eletrônico', area: 'Área de Compras e Licitações (CGLIC / DLS)', prazo: 20, status: 'Pendente' as StatusTarefa },
      { id: `tar-dfl-6`, tarefa: 'Homologação e Assinatura Contratual', area: 'Autoridade Competente / Ordenador', prazo: 8, status: 'Pendente' as StatusTarefa },
    ];

    defaultTasks.forEach((dt, idx) => {
      onAddTarefa({
        id: dt.id,
        ProcessoPlanejamento: planejamento.SEI_Processo,
        Tarefa: dt.tarefa,
        Inicio: new Date(Date.now() - (defaultTasks.length - idx) * 86400000).toISOString(),
        Prazo_Dias: dt.prazo,
        Status_Tarefa: dt.status,
        areaResponsavel: dt.area,
        bpmnType: 'task',
        MovidoPor: currentUser.name,
        MovidoEm: new Date().toISOString(),
        subTarefas: [],
      });
    });

    // Conexões canônicas com setas
    const defaultConns: BpmnConnection[] = [
      { id: 'conn-1-2', fromId: 'tar-dfl-1', toId: 'tar-dfl-2', label: 'Encaminhado', tipo: 'sequence', cor: '#38bdf8' },
      { id: 'conn-2-3', fromId: 'tar-dfl-2', toId: 'tar-dfl-3', label: 'Consolidado', tipo: 'sequence', cor: '#38bdf8' },
      { id: 'conn-3-4', fromId: 'tar-dfl-3', toId: 'tar-dfl-4', label: 'Para Análise', tipo: 'sequence', cor: '#38bdf8' },
      { id: 'conn-4-5', fromId: 'tar-dfl-4', toId: 'tar-dfl-5', label: 'Aprovado', tipo: 'sequence', cor: '#10b981' },
      { id: 'conn-5-6', fromId: 'tar-dfl-5', toId: 'tar-dfl-6', label: 'Adjudicado', tipo: 'sequence', cor: '#38bdf8' },
    ];

    if (onUpdatePlanejamento) {
      onUpdatePlanejamento({
        ...planejamento,
        bpmnConnections: defaultConns,
      });
    }
    setTimeout(updateNodePositions, 200);
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
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-on-surface tracking-tight">
                Modelador BPMN 2.0 Interativo
              </h3>
              <span className="text-[9px] font-mono font-bold bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-full">
                Drag & Drop + Setas SVG + SLA
              </span>
              {connectSourceId && (
                <span className="text-[10px] font-mono font-extrabold bg-amber-500 text-black px-2.5 py-0.5 rounded-full animate-pulse flex items-center gap-1 shadow-sm">
                  <Link2 className="w-3 h-3" />
                  Clique no elemento de destino para traçar a seta
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Arraste componentes BPMN para as raias, conecte-os com setas direcionais e gerencie prazos com alerta de SLA em tempo real.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {connectSourceId && (
            <button
              type="button"
              onClick={() => setConnectSourceId(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-bold rounded-lg cursor-pointer hover:bg-rose-500/20"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Cancelar Conexão</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenLaneModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline-variant hover:border-primary/50 text-xs font-semibold text-on-surface rounded-lg transition-all cursor-pointer shadow-sm hover:bg-surface-container-high"
            title="Adicionar nova raia de departamento / área responsável"
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
            <span>+ Nova Tarefa</span>
          </button>

          {planTarefas.length === 0 && (
            <button
              type="button"
              onClick={handleLoadDefaultBpmnFlow}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-bold text-emerald-300 rounded-lg transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Carregar Fluxo TIC</span>
            </button>
          )}
        </div>
      </div>

      {/* BPMN Canvas Modeling Toolbar (Barra de Ferramentas de Modelagem) */}
      <div className="bg-surface-container border border-outline-variant rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        {/* Modos de Ferramenta */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10.5px] font-bold text-on-surface-variant uppercase tracking-wider mr-1 flex items-center gap-1">
            <Workflow className="w-3.5 h-3.5 text-primary" />
            Ferramentas:
          </span>

          <button
            type="button"
            onClick={() => { setActiveTool('select'); setConnectSourceId(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              activeTool === 'select'
                ? 'bg-primary text-on-primary border-primary shadow-sm'
                : 'bg-surface-container-low text-on-surface border-outline-variant hover:bg-surface-container-high'
            }`}
            title="Modo Seleção: arraste elementos, selecione cards e mova entre raias"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Cursor / Selecionar (V)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTool('connect_sequence'); setConnectSourceId(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              activeTool === 'connect_sequence'
                ? 'bg-sky-500 text-slate-950 font-bold border-sky-400 shadow-sm'
                : 'bg-surface-container-low text-on-surface border-outline-variant hover:bg-surface-container-high'
            }`}
            title="Ferramenta Seta de Fluxo: clique no primeiro elemento e depois no segundo para traçar a seta direcional"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Traçar Seta de Fluxo (S)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTool('connect_association'); setConnectSourceId(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              activeTool === 'connect_association'
                ? 'bg-indigo-500 text-white font-bold border-indigo-400 shadow-sm'
                : 'bg-surface-container-low text-on-surface border-outline-variant hover:bg-surface-container-high'
            }`}
            title="Ferramenta Linha de Associação Tracejada: para ligar notas explicativas e artefatos de dados"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Linha de Associação (A)</span>
          </button>

          {planTarefas.length >= 2 && (
            <button
              type="button"
              onClick={handleAutoConnectFlow}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface bg-surface-container-low border border-outline-variant hover:bg-surface-container-high cursor-pointer transition-all"
              title="Conectar automaticamente as tarefas em sequência cronológica"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Auto-Conectar Sequência</span>
            </button>
          )}
        </div>

        {/* Dica do Modo Ativo */}
        <div className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
          {activeTool === 'select' && (
            <span>Arraste os nós entre as raias ou selecione para editar</span>
          )}
          {activeTool === 'connect_sequence' && (
            <span className="text-sky-300 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              Modo Seta: clique no nó de origem e depois no destino
            </span>
          )}
          {activeTool === 'connect_association' && (
            <span className="text-indigo-300 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              Modo Associação: clique para ligar documentos ou anotações
            </span>
          )}
        </div>
      </div>

      {/* BPMN 2.0 Palette (Paleta de Componentes Arrastáveis) */}
      <div className="bg-surface-container-high/60 border border-outline-variant/60 rounded-xl p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
            <GripVertical className="w-3.5 h-3.5 text-primary" />
            Paleta de Componentes BPMN 2.0 (Arraste para as Raias):
          </span>

          {/* Abas da Paleta */}
          <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded-lg border border-outline-variant text-[10px]">
            <button
              type="button"
              onClick={() => setPaletteTab('all')}
              className={`px-2 py-1 rounded cursor-pointer font-semibold transition-all ${
                paletteTab === 'all' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Todos ({PALETTE_ITEMS.length})
            </button>
            <button
              type="button"
              onClick={() => setPaletteTab('events')}
              className={`px-2 py-1 rounded cursor-pointer font-semibold transition-all ${
                paletteTab === 'events' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Eventos
            </button>
            <button
              type="button"
              onClick={() => setPaletteTab('tasks')}
              className={`px-2 py-1 rounded cursor-pointer font-semibold transition-all ${
                paletteTab === 'tasks' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Atividades
            </button>
            <button
              type="button"
              onClick={() => setPaletteTab('gateways')}
              className={`px-2 py-1 rounded cursor-pointer font-semibold transition-all ${
                paletteTab === 'gateways' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Gateways
            </button>
            <button
              type="button"
              onClick={() => setPaletteTab('artifacts')}
              className={`px-2 py-1 rounded cursor-pointer font-semibold transition-all ${
                paletteTab === 'artifacts' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Artefatos
            </button>
          </div>
        </div>

        {/* Grid de Componentes da Paleta */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {displayedPaletteItems.map(item => (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => handlePaletteDragStart(e, item.type)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-grab active:cursor-grabbing hover:scale-105 transition-all select-none shadow-xs ${item.bg} ${item.border} text-on-surface group`}
              title={`${item.label}: ${item.desc}`}
            >
              {/* Ícones BPMN representativos */}
              {item.type === 'start' && <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400 shrink-0" />}
              {item.type === 'start_message' && <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              {item.type === 'start_timer' && <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              {item.type === 'task_user' && <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
              {item.type === 'task_service' && <Cog className="w-3.5 h-3.5 text-teal-400 shrink-0" />}
              {item.type === 'task_send' && <Send className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
              {item.type === 'task_subprocess' && <FileBox className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
              {item.type === 'gateway_exclusive' && <span className="font-bold text-amber-400 font-mono text-xs shrink-0">✕</span>}
              {item.type === 'gateway_parallel' && <span className="font-bold text-indigo-400 font-mono text-xs shrink-0">➕</span>}
              {item.type === 'gateway_inclusive' && <span className="font-bold text-orange-400 font-mono text-xs shrink-0">◯</span>}
              {item.type === 'gateway_event' && <Share2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
              {item.type === 'timer' && <Clock className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
              {item.type === 'intermediate_message' && <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
              {item.type === 'end' && <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
              {item.type === 'end_terminate' && <AlertOctagon className="w-3.5 h-3.5 text-red-400 shrink-0" />}
              {item.type === 'data_object' && <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              {item.type === 'annotation' && <Tag className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />}

              <span className="text-[11px] font-semibold truncate max-w-[150px]">{item.label}</span>
            </div>
          ))}
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

      {/* BPMN Interactive Pool Canvas */}
      <div 
        ref={canvasRef}
        className="bg-surface-container-lowest border-2 border-outline-variant rounded-xl overflow-x-auto custom-scrollbar shadow-inner relative"
      >
        {/* Camada SVG de Conectores (Setas de Fluxo com Marcador Direcional) */}
        <svg 
          className="absolute inset-0 pointer-events-none z-20"
          style={{ width: '100%', height: '100%', minWidth: '1080px' }}
        >
          <defs>
            {/* Marcador de seta padrão sólida (Azul) */}
            <marker
              id="bpmn-arrow-head"
              markerWidth="9"
              markerHeight="9"
              refX="7"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 8 3.5, 0 7" fill="#38bdf8" />
            </marker>

            {/* Marcador de seta Esmeralda */}
            <marker
              id="bpmn-arrow-head-emerald"
              markerWidth="9"
              markerHeight="9"
              refX="7"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 8 3.5, 0 7" fill="#10b981" />
            </marker>

            {/* Marcador de seta Âmbar */}
            <marker
              id="bpmn-arrow-head-amber"
              markerWidth="9"
              markerHeight="9"
              refX="7"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 8 3.5, 0 7" fill="#f59e0b" />
            </marker>

            {/* Marcador de seta Rosa */}
            <marker
              id="bpmn-arrow-head-rose"
              markerWidth="9"
              markerHeight="9"
              refX="7"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 8 3.5, 0 7" fill="#f43f5e" />
            </marker>
          </defs>

          {connections.map(conn => {
            const p1 = nodePositions[conn.fromId];
            const p2 = nodePositions[conn.toId];
            if (!p1 || !p2) return null;

            // Ponto inicial na borda direita do nó de origem
            const startX = p1.x + p1.w / 2;
            const startY = p1.y;

            // Ponto final na borda esquerda do nó de destino
            const endX = p2.x - p2.w / 2;
            const endY = p2.y;

            // Curva suave Bézier
            const dx = Math.abs(endX - startX) * 0.5;
            const pathData = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

            const lineColor = conn.cor || '#38bdf8';
            const isAssociation = conn.tipo === 'association';
            const markerId = 
              lineColor === '#10b981' ? 'url(#bpmn-arrow-head-emerald)' :
              lineColor === '#f59e0b' ? 'url(#bpmn-arrow-head-amber)' :
              lineColor === '#f43f5e' ? 'url(#bpmn-arrow-head-rose)' :
              'url(#bpmn-arrow-head)';

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            return (
              <g key={conn.id} className="pointer-events-auto group">
                {/* Linha invisível mais larga para clique facilitado */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="14"
                  className="cursor-pointer"
                  onClick={() => handleOpenConnectionModal(conn)}
                />

                {/* Linha visível da seta com efeito hover */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={isAssociation ? "2" : "2.5"}
                  strokeDasharray={isAssociation ? "5,4" : undefined}
                  markerEnd={isAssociation ? undefined : markerId}
                  className="group-hover:stroke-white transition-colors cursor-pointer"
                  onClick={() => handleOpenConnectionModal(conn)}
                />

                {/* Rótulo / Botão de Ação no ponto médio da seta */}
                <foreignObject
                  x={midX - 50}
                  y={midY - 12}
                  width="100"
                  height="26"
                  className="overflow-visible"
                >
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => handleOpenConnectionModal(conn)}
                      className="bg-surface-container-high/95 hover:bg-surface-container border border-outline-variant hover:border-primary text-[9.5px] font-mono font-bold px-2 py-0.5 rounded shadow-sm backdrop-blur-xs truncate max-w-[95px] cursor-pointer hover:scale-105 transition-all text-on-surface"
                      style={{ borderLeftColor: lineColor, borderLeftWidth: '3px' }}
                      title={conn.label ? `Seta: ${conn.label} (clique para editar/remover)` : 'Seta de fluxo (clique para configurar)'}
                    >
                      {conn.label || 'Seta'}
                    </button>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>

        <div className="min-w-[1080px] divide-y divide-outline-variant/40 relative z-10">
          {/* Pool Header */}
          <div className="bg-surface-container-high/80 px-4 py-2.5 flex items-center justify-between border-b border-outline-variant text-xs font-bold text-on-surface">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <span>Pool de Processo BPMN: <span className="font-mono text-primary font-extrabold">{planejamento.SEI_Processo}</span></span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-normal text-on-surface-variant">
              <span>{lanes.length} raias</span>
              <span>•</span>
              <span>{connections.length} conexões com setas</span>
            </div>
          </div>

          {/* Swimlanes Render */}
          {lanes.map((lane, laneIdx) => {
            const laneTasks = filteredTarefas.filter(t => {
              if (t.areaResponsavel) {
                return t.areaResponsavel.toLowerCase() === lane.nome.toLowerCase();
              }
              return laneIdx === 1;
            });

            const laneAdditionalNodes = bpmnNodes.filter(n => n.laneId === lane.id);
            const isDropTarget = dragOverLaneId === lane.id;

            return (
              <div 
                key={lane.id} 
                onDragOver={(e) => handleLaneDragOver(e, lane.id)}
                onDragLeave={handleLaneDragLeave}
                onDrop={(e) => handleLaneDrop(e, lane)}
                className={`flex flex-row min-h-[155px] transition-all group ${
                  isDropTarget 
                    ? 'bg-primary/10 ring-2 ring-inset ring-primary/60' 
                    : 'hover:bg-surface-container/10'
                }`}
              >
                {/* Lane Header (Raia Lateral com Identificador) */}
                <div 
                  className="w-48 sm:w-56 p-3 border-r border-outline-variant/50 bg-surface-container-low/80 flex flex-col justify-between shrink-0 select-none relative"
                  style={{ borderLeft: `5px solid ${lane.cor || '#10b981'}` }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-on-surface-variant/70">
                        Raia {laneIdx + 1}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                        {laneIdx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMoveLane(laneIdx, 'up')}
                            className="p-1 hover:bg-surface-container text-on-surface-variant hover:text-on-surface rounded cursor-pointer"
                            title="Mover raia para cima"
                          >
                            <MoveVertical className="w-3 h-3" />
                          </button>
                        )}
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
                    <span>{laneTasks.length + laneAdditionalNodes.length} elementos</span>
                    <button
                      type="button"
                      onClick={() => handleOpenTaskModal(undefined, lane.nome)}
                      className="text-primary hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                      title={`Adicionar tarefa na raia ${lane.nome}`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>

                {/* Lane Content / Elementos nesta Raia */}
                <div className="flex-1 p-3 flex items-center gap-4 overflow-x-auto custom-scrollbar bg-surface-container-lowest/50 relative">
                  {laneTasks.length === 0 && laneAdditionalNodes.length === 0 ? (
                    <div className="h-full w-full flex items-center justify-center border border-dashed border-outline-variant/40 rounded-xl p-4 text-center">
                      <span className="text-xs text-on-surface-variant/40 italic">
                        {isDropTarget ? 'Solte o elemento BPMN aqui...' : 'Arraste um componente da paleta para esta raia ou adicione uma tarefa.'}
                      </span>
                    </div>
                  ) : (
                    <>
                      {/* 1. Tarefas da Raia (Atividades BPMN) */}
                      {laneTasks.map((task) => {
                        const sla = getTaskSla(task);
                        const isConnectingSource = connectSourceId === task.id;

                        return (
                          <div
                            key={task.id}
                            id={`bpmn-node-${task.id}`}
                            draggable={activeTool === 'select'}
                            onDragStart={(e) => handleTaskDragStart(e, task.id)}
                            onClick={() => {
                              if (activeTool !== 'select' || connectSourceId) {
                                handleConnectElement(task.id);
                              }
                            }}
                            className={`w-68 p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 relative shrink-0 shadow-sm select-none group/card ${
                              activeTool !== 'select' ? 'cursor-pointer hover:ring-2 hover:ring-primary' : 'cursor-grab active:cursor-grabbing'
                            } ${
                              isConnectingSource
                                ? 'ring-3 ring-amber-400 border-amber-400 bg-amber-400/15'
                                : sla.isAtrasada
                                  ? 'bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/40 shadow-rose-500/10'
                                  : sla.isConcluida
                                    ? 'bg-emerald-500/5 border-emerald-500/40 hover:border-emerald-500/60'
                                    : 'bg-surface-container-high border-outline-variant hover:border-primary/50'
                            }`}
                          >
                            {/* Conector rápido na borda direita (Puxar / Criar Seta) */}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleConnectElement(task.id); }}
                              className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border flex items-center justify-center transition-all z-30 cursor-pointer shadow-md ${
                                isConnectingSource 
                                  ? 'bg-amber-400 text-black border-amber-300 ring-2 ring-amber-300 animate-pulse'
                                  : 'bg-surface-container-highest hover:bg-sky-500 text-on-surface hover:text-white border-outline-variant hover:border-sky-400 opacity-60 group-hover/card:opacity-100 hover:scale-110'
                              }`}
                              title={isConnectingSource ? 'Ponto de conexão selecionado' : 'Traçar Seta a partir desta Tarefa'}
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>

                            {/* Card Top: Tipo BPMN + SLA + Status */}
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1">
                                <span className="p-1 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30" title="BPMN User Task">
                                  <FileText className="w-3 h-3" />
                                </span>
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
                              </div>

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

                            {/* Task Title */}
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

                              {/* Action Tools */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleConnectElement(task.id); }}
                                  className={`p-1 rounded cursor-pointer transition-colors ${
                                    isConnectingSource 
                                      ? 'bg-amber-400 text-black font-bold' 
                                      : 'hover:bg-sky-500/20 text-on-surface-variant hover:text-sky-400'
                                  }`}
                                  title={isConnectingSource ? 'Clique no nó de destino' : 'Ligar este nó com uma Seta de Fluxo'}
                                >
                                  <Link2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleOpenTaskModal(task, lane.nome); }}
                                  className="p-1 hover:bg-surface-container text-on-surface-variant hover:text-primary rounded cursor-pointer transition-colors"
                                  title="Editar tarefa"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); onDeleteTarefa(task.id); }}
                                  className="p-1 hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400 rounded cursor-pointer transition-colors"
                                  title="Excluir tarefa"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* 2. Nós Adicionais BPMN (Gateways, Eventos, Documentos SEI, Anotações) */}
                      {laneAdditionalNodes.map((node) => {
                        const isConnectingSource = connectSourceId === node.id;
                        const isGateway = node.type.startsWith('gateway');
                        const isDataObject = node.type === 'data_object';
                        const isAnnotation = node.type === 'annotation';

                        return (
                          <div
                            key={node.id}
                            id={`bpmn-node-${node.id}`}
                            draggable={activeTool === 'select'}
                            onDragStart={(e) => handleNodeDragStart(e, node.id)}
                            onClick={() => {
                              if (activeTool !== 'select' || connectSourceId) {
                                handleConnectElement(node.id);
                              }
                            }}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all relative shrink-0 shadow-sm select-none group/node ${
                              activeTool !== 'select' ? 'cursor-pointer hover:ring-2 hover:ring-primary' : 'cursor-grab active:cursor-grabbing'
                            } ${
                              isConnectingSource ? 'ring-3 ring-amber-400 border-amber-400 bg-amber-400/20' : ''
                            } ${
                              isGateway
                                ? 'w-24 h-24 rotate-45 border-amber-400 bg-amber-500/10 hover:border-amber-300 m-2'
                                : node.type === 'start' || node.type === 'start_message' || node.type === 'start_timer'
                                  ? 'w-20 h-20 rounded-full border-2 border-emerald-400 bg-emerald-500/15'
                                  : node.type === 'end'
                                    ? 'w-20 h-20 rounded-full border-4 border-rose-500 bg-rose-500/15'
                                    : node.type === 'end_terminate'
                                      ? 'w-20 h-20 rounded-full border-4 border-red-500 bg-red-500/25'
                                      : node.type === 'timer' || node.type === 'intermediate_message'
                                        ? 'w-22 h-22 rounded-full border-2 border-double border-purple-400 bg-purple-500/15'
                                        : isDataObject
                                          ? 'w-44 p-3 rounded-lg border-2 border-emerald-500/40 bg-emerald-500/5'
                                          : 'w-48 p-3 rounded-xl border-l-4 border-l-primary border-dashed border-outline-variant bg-surface-container'
                            }`}
                          >
                            {/* Conector rápido na borda direita */}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleConnectElement(node.id); }}
                              className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border flex items-center justify-center transition-all z-30 cursor-pointer shadow-md ${
                                isGateway ? '-rotate-45' : ''
                              } ${
                                isConnectingSource 
                                  ? 'bg-amber-400 text-black border-amber-300 ring-2 ring-amber-300 animate-pulse'
                                  : 'bg-surface-container-highest hover:bg-sky-500 text-on-surface hover:text-white border-outline-variant hover:border-sky-400 opacity-60 group-hover/node:opacity-100 hover:scale-110'
                              }`}
                              title={isConnectingSource ? 'Ponto selecionado' : 'Traçar Seta a partir deste nó'}
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>

                            {/* Conteúdo interno desrotacionado se for Gateway */}
                            <div className={isGateway ? '-rotate-45 flex flex-col items-center justify-center text-center' : 'flex flex-col items-center justify-center text-center'}>
                              {node.type === 'start' && <Play className="w-5 h-5 text-emerald-400 fill-emerald-400" />}
                              {node.type === 'start_message' && <Mail className="w-5 h-5 text-emerald-400" />}
                              {node.type === 'start_timer' && <Clock className="w-5 h-5 text-emerald-400" />}
                              {node.type === 'end' && <CheckCircle2 className="w-5 h-5 text-rose-400" />}
                              {node.type === 'end_terminate' && <AlertOctagon className="w-5 h-5 text-red-400" />}
                              {node.type === 'gateway_exclusive' && <span className="text-base font-extrabold text-amber-400 font-mono">✕</span>}
                              {node.type === 'gateway_parallel' && <span className="text-base font-extrabold text-indigo-400 font-mono">➕</span>}
                              {node.type === 'gateway_inclusive' && <span className="text-base font-extrabold text-orange-400 font-mono">◯</span>}
                              {node.type === 'gateway_event' && <Share2 className="w-5 h-5 text-violet-400" />}
                              {node.type === 'timer' && <Clock className="w-5 h-5 text-purple-400" />}
                              {node.type === 'intermediate_message' && <Mail className="w-5 h-5 text-sky-400" />}
                              {isDataObject && <FileText className="w-5 h-5 text-emerald-400" />}
                              {isAnnotation && <Tag className="w-4 h-4 text-on-surface-variant" />}

                              <span className="text-[10px] font-bold text-on-surface leading-tight mt-1 truncate max-w-[85px]" title={node.label}>
                                {node.label}
                              </span>

                              {/* Ações Rápidas */}
                              <div className="flex items-center gap-1 mt-1">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleConnectElement(node.id); }}
                                  className="p-1 hover:bg-sky-500/20 text-sky-400 rounded cursor-pointer"
                                  title={isConnectingSource ? 'Destino da Seta' : 'Traçar Seta'}
                                >
                                  <Link2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleOpenNodeModal(node); }}
                                  className="p-1 hover:bg-surface-container text-on-surface-variant hover:text-primary rounded cursor-pointer"
                                  title="Editar"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
                                  className="p-1 hover:bg-rose-500/20 text-rose-400 rounded cursor-pointer"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            );
          })}
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

      {/* Modal de Criação / Edição de Raia */}
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

      {/* Modal de Edição de Elemento BPMN Adicional */}
      {isNodeModalOpen && editingNode && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-surface-container border border-outline-variant w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-surface-container-high px-6 py-4 border-b border-outline-variant flex justify-between items-center">
              <h4 className="text-sm font-bold text-on-surface">
                Editar Elemento BPMN ({editingNode.type})
              </h4>
              <button 
                type="button" 
                onClick={() => setIsNodeModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNode} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Rótulo / Descrição do Nó <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nodeLabel}
                  onChange={(e) => setNodeLabel(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Detalhes / Regra de Decisão / Norma
                </label>
                <textarea
                  rows={2}
                  value={nodeDesc}
                  onChange={(e) => setNodeDesc(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => { handleDeleteNode(editingNode.id); setIsNodeModalOpen(false); }}
                  className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Excluir Nó
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNodeModalOpen(false)}
                    className="px-4 py-2 border border-outline-variant text-xs font-semibold text-on-surface rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-primary hover:bg-primary/90 text-xs font-bold text-on-primary rounded-xl cursor-pointer shadow-sm"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Completo de Edição de Seta de Conexão */}
      {isConnModalOpen && editingConnection && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-surface-container border border-outline-variant w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-surface-container-high px-6 py-4 border-b border-outline-variant flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-sky-400" />
                <h4 className="text-sm font-bold text-on-surface">
                  Configurar Seta de Fluxo
                </h4>
              </div>
              <button 
                type="button" 
                onClick={() => setIsConnModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConnection} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Rótulo / Condição da Seta (Ex: "Sim", "Não", "Aprovado", "Ressalvas")
                </label>
                <input
                  type="text"
                  placeholder="Ex: Parecer Aprovado"
                  value={connLabel}
                  onChange={(e) => setConnLabel(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Tipo de Conexão
                  </label>
                  <select
                    value={connTipo}
                    onChange={(e) => setConnTipo(e.target.value as any)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="sequence">Sequencial (Sólida)</option>
                    <option value="conditional">Condicional</option>
                    <option value="association">Associação (Tracejada)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Cor da Seta
                  </label>
                  <div className="flex items-center gap-2 pt-1">
                    {[
                      { cor: '#38bdf8', label: 'Azul' },
                      { cor: '#10b981', label: 'Verde' },
                      { cor: '#f59e0b', label: 'Âmbar' },
                      { cor: '#f43f5e', label: 'Rosa' }
                    ].map(c => (
                      <button
                        type="button"
                        key={c.cor}
                        onClick={() => setConnCor(c.cor)}
                        className={`w-7 h-7 rounded-full border transition-all cursor-pointer ${
                          connCor === c.cor ? 'scale-115 ring-2 ring-white border-white' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.cor }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-outline-variant/40 flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDeleteConnection(editingConnection.id)}
                    className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Remover Seta
                  </button>
                  <button
                    type="button"
                    onClick={handleInvertConnection}
                    className="px-3 py-1.5 bg-surface-container-low border border-outline-variant hover:bg-surface-container-high text-xs font-medium text-on-surface rounded-xl cursor-pointer"
                    title="Inverter direção da seta"
                  >
                    Inverter
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsConnModalOpen(false)}
                    className="px-4 py-2 border border-outline-variant text-xs font-semibold text-on-surface rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-primary hover:bg-primary/90 text-xs font-bold text-on-primary rounded-xl cursor-pointer shadow-sm"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
