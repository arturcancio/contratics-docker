/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Planejamento, 
  TarefaPlanejamento, 
  User as UserType, 
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
  RefreshCw,
  User,
  CornerDownLeft
} from 'lucide-react';

export const DEFAULT_BPMN_LANES: BpmnLane[] = [
  { id: 'lane-demandante', nome: 'Área Demandante', cor: '#0ea5e9', ordem: 1 },
  { id: 'lane-gecti', nome: 'Equipe de Planejamento (GECTI)', cor: '#10b981', ordem: 2 },
  { id: 'lane-conjur', nome: 'Assessoria Jurídica (CONJUR)', cor: '#8b5cf6', ordem: 3 },
  { id: 'lane-compras', nome: 'Compras e Licitações (CGLIC)', cor: '#f59e0b', ordem: 4 },
  { id: 'lane-autoridade', nome: 'Autoridade Competente', cor: '#ec4899', ordem: 5 },
];

type CanvasToolMode = 'select' | 'connect_sequence' | 'connect_association';

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
  // Eventos
  { 
    type: 'start', 
    category: 'events', 
    label: 'Início Simples', 
    desc: 'Formalização da demanda (círculo de borda fina)', 
    icon: 'play', 
    bg: 'bg-emerald-500/10', 
    border: 'border-emerald-500/40' 
  },
  { 
    type: 'start_message', 
    category: 'events', 
    label: 'Início por Mensagem / DFD', 
    desc: 'Recebimento de Ofício ou DFD', 
    icon: 'mail', 
    bg: 'bg-emerald-500/10', 
    border: 'border-emerald-500/40' 
  },
  { 
    type: 'timer', 
    category: 'events', 
    label: 'Temporizador / SLA', 
    desc: 'Prazo regulamentar (círculo duplo)', 
    icon: 'clock', 
    bg: 'bg-purple-500/10', 
    border: 'border-purple-500/40' 
  },
  { 
    type: 'end', 
    category: 'events', 
    label: 'Fim (Sucesso)', 
    desc: 'Contratação homologada (círculo de borda grossa)', 
    icon: 'check', 
    bg: 'bg-rose-500/10', 
    border: 'border-rose-500/40' 
  },
  { 
    type: 'end_terminate', 
    category: 'events', 
    label: 'Fim (Cancelamento)', 
    desc: 'Processo cancelado ou certame deserto', 
    icon: 'alert-octagon', 
    bg: 'bg-red-500/15', 
    border: 'border-red-500/60' 
  },

  // Atividades
  { 
    type: 'task_user', 
    category: 'tasks', 
    label: 'Tarefa de Usuário', 
    desc: 'Atividade manual técnica (ETP, TR, Parecer)', 
    icon: 'user', 
    bg: 'bg-sky-500/10', 
    border: 'border-sky-500/40' 
  },
  { 
    type: 'task_service', 
    category: 'tasks', 
    label: 'Tarefa de Sistema', 
    desc: 'Rotina automatizada / SEI / Compras.gov', 
    icon: 'cog', 
    bg: 'bg-teal-500/10', 
    border: 'border-teal-500/40' 
  },
  { 
    type: 'task_send', 
    category: 'tasks', 
    label: 'Tarefa de Envio', 
    desc: 'Publicação no DOU ou envio de notificação', 
    icon: 'send', 
    bg: 'bg-cyan-500/10', 
    border: 'border-cyan-500/40' 
  },
  { 
    type: 'task_subprocess', 
    category: 'tasks', 
    label: 'Subprocesso', 
    desc: 'Conjunto de atividades complementares', 
    icon: 'box', 
    bg: 'bg-blue-500/10', 
    border: 'border-blue-500/40' 
  },

  // Gateways
  { 
    type: 'gateway_exclusive', 
    category: 'gateways', 
    label: 'Gateway XOR (Exclusivo)', 
    desc: 'Decisão única alternativa (Sim / Não)', 
    icon: 'x', 
    bg: 'bg-amber-500/10', 
    border: 'border-amber-500/40' 
  },
  { 
    type: 'gateway_parallel', 
    category: 'gateways', 
    label: 'Gateway AND (Paralelo)', 
    desc: 'Execução simultânea sem condições (+)', 
    icon: 'plus', 
    bg: 'bg-indigo-500/10', 
    border: 'border-indigo-500/40' 
  },
  { 
    type: 'gateway_inclusive', 
    category: 'gateways', 
    label: 'Gateway OR (Inclusivo)', 
    desc: 'Um ou mais ramos executados (◯)', 
    icon: 'split', 
    bg: 'bg-orange-500/10', 
    border: 'border-orange-500/40' 
  },

  // Artefatos
  { 
    type: 'data_object', 
    category: 'artifacts', 
    label: 'Documento SEI', 
    desc: 'Objeto de dados ou documento oficial', 
    icon: 'file-text', 
    bg: 'bg-emerald-500/10', 
    border: 'border-emerald-500/40' 
  },
  { 
    type: 'annotation', 
    category: 'artifacts', 
    label: 'Anotação / Nota', 
    desc: 'Texto explicativo com colchete aberto', 
    icon: 'tag', 
    bg: 'bg-surface-container', 
    border: 'border-outline-variant' 
  },
];

interface BpmnFlowBoardProps {
  planejamento: Planejamento;
  tarefas: TarefaPlanejamento[];
  currentUser: UserType;
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const [svgDimensions, setSvgDimensions] = useState({ width: 1300, height: 700 });

  // Ferramenta ativa
  const [activeTool, setActiveTool] = useState<CanvasToolMode>('select');
  const [paletteTab, setPaletteTab] = useState<'all' | 'events' | 'tasks' | 'gateways' | 'artifacts'>('all');

  // Raias
  const lanes: BpmnLane[] = useMemo(() => {
    if (planejamento.bpmnLanes && planejamento.bpmnLanes.length > 0) {
      return [...planejamento.bpmnLanes].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    }
    return DEFAULT_BPMN_LANES;
  }, [planejamento.bpmnLanes]);

  // Nós BPMN adicionais
  const bpmnNodes: BpmnNode[] = useMemo(() => {
    return planejamento.bpmnNodes || [];
  }, [planejamento.bpmnNodes]);

  // Conexões
  const connections: BpmnConnection[] = useMemo(() => {
    return planejamento.bpmnConnections || [];
  }, [planejamento.bpmnConnections]);

  // Tarefas deste planejamento
  const planTarefas = useMemo(() => {
    return tarefas.filter(t => t.ProcessoPlanejamento === planejamento.SEI_Processo);
  }, [tarefas, planejamento.SEI_Processo]);

  // Modais
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isLaneModalOpen, setIsLaneModalOpen] = useState(false);
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [isConnModalOpen, setIsConnModalOpen] = useState(false);

  // Estados de edição
  const [editingTask, setEditingTask] = useState<TarefaPlanejamento | null>(null);
  const [editingLane, setEditingLane] = useState<BpmnLane | null>(null);
  const [editingNode, setEditingNode] = useState<BpmnNode | null>(null);
  const [editingConnection, setEditingConnection] = useState<BpmnConnection | null>(null);

  // Formulários
  const [taskNome, setTaskNome] = useState('');
  const [taskPrazo, setTaskPrazo] = useState(5);
  const [taskArea, setTaskArea] = useState(lanes[0]?.nome || 'Área Demandante');
  const [taskStatus, setTaskStatus] = useState<StatusTarefa>('Pendente');
  const [taskDescricao, setTaskDescricao] = useState('');

  const [laneNome, setLaneNome] = useState('');
  const [laneCor, setLaneCor] = useState('#0ea5e9');

  const [nodeLabel, setNodeLabel] = useState('');
  const [nodeDesc, setNodeDesc] = useState('');

  const [connLabel, setConnLabel] = useState('');
  const [connTipo, setConnTipo] = useState<'sequence' | 'conditional' | 'default' | 'association'>('sequence');
  const [connCor, setConnCor] = useState('#0f172a');

  // Modo de conexão ativo
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [dragOverLaneId, setDragOverLaneId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'atrasadas' | 'em_andamento' | 'concluidas'>('all');

  // Coordenadas calculadas
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number; w: number; h: number }>>({});

  // Recalcular posições relativas dos nós para traçar as setas ortogonais
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
    const timeout = setTimeout(updateNodePositions, 250);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeout);
    };
  }, [planTarefas, bpmnNodes, lanes]);

  // SLA e métricas
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

  const filteredTarefas = useMemo(() => {
    return planTarefas.filter(t => {
      const sla = getTaskSla(t);
      if (filterStatus === 'atrasadas') return sla.isAtrasada;
      if (filterStatus === 'em_andamento') return !sla.isConcluida;
      if (filterStatus === 'concluidas') return sla.isConcluida;
      return true;
    });
  }, [planTarefas, filterStatus]);

  const displayedPaletteItems = useMemo(() => {
    if (paletteTab === 'all') return PALETTE_ITEMS;
    return PALETTE_ITEMS.filter(i => i.category === paletteTab);
  }, [paletteTab]);

  // --- ROTEAMENTO ORTOGONAL (MANHATTAN) DE SETAS EM ÂNGULO RETO COM DESVIO DE OBSTÁCULOS ---
  const getOrthogonalPath = (
    p1: { x: number; y: number; w: number; h: number },
    p2: { x: number; y: number; w: number; h: number },
    conn: BpmnConnection,
    allPos: Record<string, { x: number; y: number; w: number; h: number }>
  ) => {
    // Helper para verificar se um segmento de linha cruza qualquer outro nó
    const intersectsOtherNode = (x1: number, y1: number, x2: number, y2: number) => {
      for (const [id, node] of Object.entries(allPos)) {
        if (id === conn.fromId || id === conn.toId) continue;
        const margin = 6;
        const left = node.x - node.w / 2 - margin;
        const right = node.x + node.w / 2 + margin;
        const top = node.y - node.h / 2 - margin;
        const bottom = node.y + node.h / 2 + margin;

        // Segmento vertical
        if (Math.abs(x1 - x2) < 2) {
          const segX = x1;
          const minY = Math.min(y1, y2);
          const maxY = Math.max(y1, y2);
          if (segX >= left && segX <= right && maxY > top && minY < bottom) {
            return true;
          }
        }
        // Segmento horizontal
        if (Math.abs(y1 - y2) < 2) {
          const segY = y1;
          const minX = Math.min(x1, x2);
          const maxX = Math.max(x1, x2);
          if (segY >= top && segY <= bottom && maxX > left && minX < right) {
            return true;
          }
        }
      }
      return false;
    };

    const isCrossLane = Math.abs(p1.y - p2.y) > 80;

    if (isCrossLane) {
      // --- CONEXÃO ENTRE RAIAS DIFERENTES ---
      const isGoingDown = p2.y > p1.y;

      if (isGoingDown) {
        // De cima para baixo (ex: Raia 1 -> Raia 2)
        // Corredor livre entre as duas fileiras de nós (faixa de transição entre raias)
        const p1Bottom = p1.y + p1.h / 2;
        const p2Top = p2.y - p2.h / 2;
        const corridorY = (p1Bottom + p2Top) / 2;

        const startX = p1.x;
        const startY = p1Bottom;
        const endX = p2.x;
        const endY = p2Top;

        // Se o destino está alinhado na mesma coluna X, desce em linha reta
        if (Math.abs(startX - endX) <= 6 && !intersectsOtherNode(startX, startY, endX, endY)) {
          const pathData = `M ${startX} ${startY} L ${endX} ${endY}`;
          const labelPos = { x: startX + 12, y: corridorY };
          return { pathData, labelPos, isBackward: false };
        }

        // Sai da base de A, desce até o corredor entre raias,
        // corre na horizontal pelo corredor livre (por fora de qualquer atividade)
        // e desce verticalmente no topo de B
        const pathData = `M ${startX} ${startY} L ${startX} ${corridorY} L ${endX} ${corridorY} L ${endX} ${endY}`;
        const labelPos = { x: (startX + endX) / 2, y: corridorY - 10 };
        return { pathData, labelPos, isBackward: false };
      } else {
        // De baixo para cima (ex: Raia 2 -> Raia 1)
        const p1Top = p1.y - p1.h / 2;
        const p2Bottom = p2.y + p2.h / 2;
        const corridorY = (p1Top + p2Bottom) / 2;

        const startX = p1.x;
        const startY = p1Top;
        const endX = p2.x;
        const endY = p2Bottom;

        if (Math.abs(startX - endX) <= 6 && !intersectsOtherNode(startX, startY, endX, endY)) {
          const pathData = `M ${startX} ${startY} L ${endX} ${endY}`;
          const labelPos = { x: startX + 12, y: corridorY };
          return { pathData, labelPos, isBackward: false };
        }

        const pathData = `M ${startX} ${startY} L ${startX} ${corridorY} L ${endX} ${corridorY} L ${endX} ${endY}`;
        const labelPos = { x: (startX + endX) / 2, y: corridorY - 10 };
        return { pathData, labelPos, isBackward: false };
      }
    }

    // --- CONEXÃO NA MESMA RAIA (MESMA ALTURA) ---
    const isBackward = p2.x < p1.x + p1.w / 2 + 15;

    if (isBackward) {
      // Retorno / Loop para trás (como na imagem de referência)
      // Sai da base de A, passa pelo canal inferior da raia e sobe na base de B
      const startX = p1.x;
      const startY = p1.y + p1.h / 2;
      const endX = p2.x;
      const endY = p2.y + p2.h / 2;

      const loopY = Math.max(startY, endY) + 40;
      const pathData = `M ${startX} ${startY} L ${startX} ${loopY} L ${endX} ${loopY} L ${endX} ${endY}`;
      const labelPos = { x: startX + 8, y: startY + 18 };

      return { pathData, labelPos, isBackward: true };
    } else {
      // Fluxo em frente para a direita
      const startX = p1.x + p1.w / 2;
      const startY = p1.y;
      const endX = p2.x - p2.w / 2;
      const endY = p2.y;

      if (!intersectsOtherNode(startX, startY, endX, endY) && Math.abs(startY - endY) <= 5) {
        // Linha reta horizontal direta (sem obstáculos)
        const pathData = `M ${startX} ${startY} L ${endX} ${endY}`;
        const labelPos = { x: (startX + endX) / 2, y: startY - 12 };
        return { pathData, labelPos, isBackward: false };
      } else if (!intersectsOtherNode(startX, startY, endX, endY)) {
        // Degrau ortogonal normal
        const midX = (startX + endX) / 2;
        const pathData = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
        const labelPos = { x: midX + 8, y: (startY + endY) / 2 };
        return { pathData, labelPos, isBackward: false };
      } else {
        // Há um nó intermediário no caminho horizontal! Desvia "por fora" pelo canal superior
        const bypassY = Math.min(p1.y - p1.h / 2, p2.y - p2.h / 2) - 36;
        const pathData = `M ${p1.x} ${p1.y - p1.h / 2} L ${p1.x} ${bypassY} L ${p2.x} ${bypassY} L ${p2.x} ${p2.y - p2.h / 2}`;
        const labelPos = { x: (p1.x + p2.x) / 2, y: bypassY - 8 };
        return { pathData, labelPos, isBackward: false };
      }
    }
  };

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

    // 1. Soltou da Paleta
    if (paletteType) {
      if (
        paletteType === 'task_user' || 
        paletteType === 'task_service' || 
        paletteType === 'task_send' || 
        paletteType === 'task_subprocess'
      ) {
        const defaultNames: Record<string, string> = {
          task_user: 'Executar Atividade Técnica',
          task_service: 'Rotina de Sistema / SEI',
          task_send: 'Publicação de Aviso no DOU',
          task_subprocess: 'Subprocesso Licitatório',
        };

        const novaTarefa: TarefaPlanejamento = {
          id: `tar-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          ProcessoPlanejamento: planejamento.SEI_Processo,
          Tarefa: defaultNames[paletteType] || 'Nova Atividade BPMN',
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
        const defaultLabels: Record<string, string> = {
          start: 'Demanda Autuada',
          start_message: 'Recebimento do DFD',
          timer: 'Prazo Limite / SLA',
          gateway_exclusive: 'Validação Conclusiva?',
          gateway_parallel: 'Bifurcação Paralela',
          gateway_inclusive: 'Decisão Inclusiva',
          end: 'Contratação Homologada',
          end_terminate: 'Processo Encerrado',
          data_object: 'Processo SEI / Edital',
          annotation: 'Fundamento Legal',
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

    // 2. Moveu Tarefa entre raias
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

    // 3. Moveu Nó BPMN entre raias
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

  // --- GERENCIAMENTO DE SETAS ---
  const handleConnectElement = (targetNodeId: string) => {
    if (!connectSourceId) {
      setConnectSourceId(targetNodeId);
    } else if (connectSourceId === targetNodeId) {
      setConnectSourceId(null);
    } else {
      const tipoConexao = activeTool === 'connect_association' ? 'association' : 'sequence';
      const defaultColor = '#0f172a';

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
    setConnCor(conn.cor || '#0f172a');
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

  // Carregador de fluxo canônico conforme imagem de referência (Start -> XOR -> Task -> XOR [loop "Yes"] -> Task -> End)
  const handleLoadDefaultBpmnFlow = () => {
    if (planTarefas.length > 0 && !confirm('Este planejamento já possui tarefas. Deseja carregar o fluxo padrão BPMN?')) {
      return;
    }

    const firstLaneName = lanes[0]?.nome || 'Área Demandante';
    const firstLaneId = lanes[0]?.id || 'lane-demandante';

    // Cria Nós canônicos como na imagem
    const startNode: BpmnNode = {
      id: `node-start-ref`,
      type: 'start',
      label: 'Demanda Oficializada',
      laneId: firstLaneId,
    };

    const xor1Node: BpmnNode = {
      id: `node-xor1-ref`,
      type: 'gateway_exclusive',
      label: 'Requisitos Prévios?',
      laneId: firstLaneId,
    };

    const xor2Node: BpmnNode = {
      id: `node-xor2-ref`,
      type: 'gateway_exclusive',
      label: 'Parecer Aprovado?',
      laneId: firstLaneId,
    };

    const endNode: BpmnNode = {
      id: `node-end-ref`,
      type: 'end',
      label: 'Contratação Homologada',
      laneId: firstLaneId,
    };

    // Tarefas
    const task1: TarefaPlanejamento = {
      id: `tar-ref-1`,
      ProcessoPlanejamento: planejamento.SEI_Processo,
      Tarefa: 'Elaboração do Termo de Referência',
      Inicio: new Date(Date.now() - 5 * 86400000).toISOString(),
      Prazo_Dias: 10,
      Status_Tarefa: 'Em Elaboração',
      areaResponsavel: firstLaneName,
      bpmnType: 'task',
      MovidoPor: currentUser.name,
      MovidoEm: new Date().toISOString(),
      subTarefas: [],
    };

    const task2: TarefaPlanejamento = {
      id: `tar-ref-2`,
      ProcessoPlanejamento: planejamento.SEI_Processo,
      Tarefa: 'Publicação do Edital no Compras.gov',
      Inicio: new Date().toISOString(),
      Prazo_Dias: 8,
      Status_Tarefa: 'Pendente',
      areaResponsavel: firstLaneName,
      bpmnType: 'task',
      MovidoPor: currentUser.name,
      MovidoEm: new Date().toISOString(),
      subTarefas: [],
    };

    onAddTarefa(task1);
    onAddTarefa(task2);

    // Conexões com o exato loop da imagem
    const defaultConns: BpmnConnection[] = [
      { id: 'c-1', fromId: 'node-start-ref', toId: 'node-xor1-ref', label: '', tipo: 'sequence' },
      { id: 'c-2', fromId: 'node-xor1-ref', toId: 'tar-ref-1', label: '', tipo: 'sequence' },
      { id: 'c-3', fromId: 'tar-ref-1', toId: 'node-xor2-ref', label: '', tipo: 'sequence' },
      { id: 'c-4', fromId: 'node-xor2-ref', toId: 'tar-ref-2', label: 'Sim', tipo: 'sequence' },
      { id: 'c-5', fromId: 'tar-ref-2', toId: 'node-end-ref', label: '', tipo: 'sequence' },
      { id: 'c-6-loop', fromId: 'node-xor2-ref', toId: 'node-xor1-ref', label: 'Retorno', tipo: 'sequence' },
    ];

    if (onUpdatePlanejamento) {
      onUpdatePlanejamento({
        ...planejamento,
        bpmnNodes: [startNode, xor1Node, xor2Node, endNode],
        bpmnConnections: defaultConns,
      });
    }
    setTimeout(updateNodePositions, 200);
  };

  // --- MODAL TAREFA ---
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

  // --- MODAL RAIA ---
  const handleOpenLaneModal = (lane?: BpmnLane) => {
    if (lane) {
      setEditingLane(lane);
      setLaneNome(lane.nome);
      setLaneCor(lane.cor || '#0ea5e9');
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

  // --- MODAL NÓ BPMN ---
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

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 md:p-6 shadow-sm space-y-4" data-tour="bpmn-flow-board">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-outline-variant/40">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary shrink-0">
            <Workflow className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-on-surface tracking-tight">
                Fluxo BPMN 2.0 Oficial
              </h3>
              <span className="text-[9.5px] font-mono font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 px-2 py-0.5 rounded">
                Setas Retas 90° + Formatação Canônica
              </span>
              {connectSourceId && (
                <span className="text-[10px] font-mono font-extrabold bg-amber-500 text-black px-2.5 py-0.5 rounded animate-pulse flex items-center gap-1 shadow-sm">
                  <Link2 className="w-3 h-3" />
                  Clique no elemento de destino para traçar a seta
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Notação oficial com raias verticais, tarefas retangulares, gateways e setas ortogonais em ângulos retos de 90°.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {connectSourceId && (
            <button
              type="button"
              onClick={() => setConnectSourceId(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/40 text-rose-400 text-xs font-bold rounded-lg cursor-pointer hover:bg-rose-500/20"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Cancelar Conexão</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenLaneModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline-variant hover:border-primary text-xs font-semibold text-on-surface rounded-lg transition-all cursor-pointer shadow-xs hover:bg-surface-container-high"
            title="Adicionar nova raia de departamento / área responsável"
          >
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span>+ Nova Raia</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenTaskModal()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold rounded-lg transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nova Tarefa</span>
          </button>

          {planTarefas.length === 0 && (
            <button
              type="button"
              onClick={handleLoadDefaultBpmnFlow}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-bold text-emerald-400 rounded-lg transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Carregar Fluxo Modelo</span>
            </button>
          )}
        </div>
      </div>

      {/* Toolbar de Ferramentas do Modelador */}
      <div className="bg-surface-container border border-outline-variant rounded-xl p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mr-1">
            Ferramentas:
          </span>

          <button
            type="button"
            onClick={() => { setActiveTool('select'); setConnectSourceId(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              activeTool === 'select'
                ? 'bg-primary text-on-primary border-primary shadow-xs'
                : 'bg-surface-container-low text-on-surface border-outline-variant hover:bg-surface-container-high'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Selecionar / Mover (V)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTool('connect_sequence'); setConnectSourceId(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              activeTool === 'connect_sequence'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-bold border-slate-700 shadow-xs'
                : 'bg-surface-container-low text-on-surface border-outline-variant hover:bg-surface-container-high'
            }`}
            title="Traçar Seta de Fluxo: clique na origem e no destino para criar linha reta em 90 graus"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Traçar Seta Reta (S)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTool('connect_association'); setConnectSourceId(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              activeTool === 'connect_association'
                ? 'bg-indigo-500 text-white font-bold border-indigo-400 shadow-xs'
                : 'bg-surface-container-low text-on-surface border-outline-variant hover:bg-surface-container-high'
            }`}
            title="Linha de Associação Tracejada para Anotações"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Associação Tracejada (A)</span>
          </button>
        </div>

        {/* Indicador do Modo Ativo */}
        <div className="text-[11px] text-on-surface-variant flex items-center gap-1.5 font-medium">
          {activeTool === 'select' && <span>Arraste elementos para posicionar ou clique para editar</span>}
          {activeTool === 'connect_sequence' && (
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Modo Seta Reta: clique no nó de origem e depois no destino
            </span>
          )}
          {activeTool === 'connect_association' && (
            <span className="text-indigo-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              Modo Associação: ligue notas ou artefatos
            </span>
          )}
        </div>
      </div>

      {/* Paleta BPMN 2.0 (Arraste para a Raia) */}
      <div className="bg-surface-container-high/50 border border-outline-variant/60 rounded-xl p-3 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
            <GripVertical className="w-3.5 h-3.5 text-primary" />
            Paleta de Componentes BPMN 2.0:
          </span>

          <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded-lg border border-outline-variant text-[10px]">
            <button
              type="button"
              onClick={() => setPaletteTab('all')}
              className={`px-2 py-0.5 rounded cursor-pointer font-semibold transition-all ${
                paletteTab === 'all' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Todos ({PALETTE_ITEMS.length})
            </button>
            <button
              type="button"
              onClick={() => setPaletteTab('events')}
              className={`px-2 py-0.5 rounded cursor-pointer font-semibold transition-all ${
                paletteTab === 'events' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Eventos
            </button>
            <button
              type="button"
              onClick={() => setPaletteTab('tasks')}
              className={`px-2 py-0.5 rounded cursor-pointer font-semibold transition-all ${
                paletteTab === 'tasks' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Atividades
            </button>
            <button
              type="button"
              onClick={() => setPaletteTab('gateways')}
              className={`px-2 py-0.5 rounded cursor-pointer font-semibold transition-all ${
                paletteTab === 'gateways' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Gateways
            </button>
            <button
              type="button"
              onClick={() => setPaletteTab('artifacts')}
              className={`px-2 py-0.5 rounded cursor-pointer font-semibold transition-all ${
                paletteTab === 'artifacts' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Artefatos
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {displayedPaletteItems.map(item => (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => handlePaletteDragStart(e, item.type)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-grab active:cursor-grabbing hover:scale-105 transition-all select-none shadow-2xs ${item.bg} ${item.border} text-on-surface group`}
              title={`${item.label}: ${item.desc}`}
            >
              {item.type === 'start' && <span className="w-3.5 h-3.5 rounded-full border-2 border-emerald-500 inline-block" />}
              {item.type === 'start_message' && <Mail className="w-3.5 h-3.5 text-emerald-500" />}
              {item.type === 'timer' && <Clock className="w-3.5 h-3.5 text-purple-400" />}
              {item.type === 'end' && <span className="w-3.5 h-3.5 rounded-full border-3 border-rose-500 inline-block" />}
              {item.type === 'end_terminate' && <AlertOctagon className="w-3.5 h-3.5 text-red-500" />}
              {item.type === 'task_user' && <FileText className="w-3.5 h-3.5 text-sky-400" />}
              {item.type === 'task_service' && <Cog className="w-3.5 h-3.5 text-teal-400" />}
              {item.type === 'task_send' && <Send className="w-3.5 h-3.5 text-cyan-400" />}
              {item.type === 'task_subprocess' && <FileBox className="w-3.5 h-3.5 text-blue-400" />}
              {item.type === 'gateway_exclusive' && <span className="font-bold text-amber-400 font-mono text-xs">✕</span>}
              {item.type === 'gateway_parallel' && <span className="font-bold text-indigo-400 font-mono text-xs">➕</span>}
              {item.type === 'gateway_inclusive' && <span className="font-bold text-orange-400 font-mono text-xs">◯</span>}
              {item.type === 'data_object' && <FileText className="w-3.5 h-3.5 text-emerald-400" />}
              {item.type === 'annotation' && <Tag className="w-3.5 h-3.5 text-on-surface-variant" />}

              <span className="text-[11px] font-semibold">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* BPMN Interactive Pool Canvas (Estrutura da Imagem de Referência) */}
      <div 
        ref={canvasRef}
        className="bg-white dark:bg-slate-950 border-2 border-slate-800 dark:border-slate-200 rounded-xl overflow-x-auto custom-scrollbar shadow-md relative"
      >
        {/* Camada SVG de Conectores (Setas Retas em 90 Graus) */}
        <svg 
          className="absolute inset-0 pointer-events-none z-20"
          style={{ width: '100%', height: '100%', minWidth: '1100px' }}
        >
          <defs>
            {/* Marcador de seta triangular clássica BPMN para linhas horizontais/em frente */}
            <marker
              id="bpmn-arrow-head-orthogonal"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0.5, 7 3.5, 0 6.5" fill="currentColor" />
            </marker>

            {/* Marcador para linhas que entram por baixo (apontando para cima) */}
            <marker
              id="bpmn-arrow-head-up"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0.5, 7 3.5, 0 6.5" fill="currentColor" />
            </marker>
          </defs>

          {connections.map(conn => {
            const p1 = nodePositions[conn.fromId];
            const p2 = nodePositions[conn.toId];
            if (!p1 || !p2) return null;

            const { pathData, labelPos, isBackward } = getOrthogonalPath(p1, p2, conn, nodePositions);
            const isAssociation = conn.tipo === 'association';

            return (
              <g key={conn.id} className="pointer-events-auto group text-slate-900 dark:text-slate-100">
                {/* Linha invisível larga para clique facilitado */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="16"
                  className="cursor-pointer"
                  onClick={() => handleOpenConnectionModal(conn)}
                />

                {/* Linha visível da seta (Reta ortogonal com cantos de 90 graus) */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={isAssociation ? "1.5" : "2"}
                  strokeLinejoin="miter"
                  strokeLinecap="square"
                  strokeDasharray={isAssociation ? "5,4" : undefined}
                  markerEnd={isAssociation ? undefined : 'url(#bpmn-arrow-head-orthogonal)'}
                  className="group-hover:stroke-primary transition-colors cursor-pointer"
                  onClick={() => handleOpenConnectionModal(conn)}
                />

                {/* Rótulo da Condição (ex: "Yes", "No", "Sim", "Não") como na imagem */}
                {conn.label ? (
                  <foreignObject
                    x={labelPos.x - 25}
                    y={labelPos.y - 10}
                    width="60"
                    height="24"
                    className="overflow-visible"
                  >
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleOpenConnectionModal(conn)}
                        className="bg-white/95 dark:bg-slate-900/95 border border-slate-300 dark:border-slate-700 text-[10.5px] font-semibold text-slate-900 dark:text-slate-100 px-1.5 py-0.5 rounded shadow-2xs hover:scale-105 transition-all cursor-pointer whitespace-nowrap"
                        title="Clique para editar rótulo da seta"
                      >
                        {conn.label}
                      </button>
                    </div>
                  </foreignObject>
                ) : (
                  /* Botão sutil visível no hover para permitir nomear a seta */
                  <foreignObject
                    x={labelPos.x - 14}
                    y={labelPos.y - 10}
                    width="28"
                    height="20"
                    className="overflow-visible opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenConnectionModal(conn)}
                      className="bg-white dark:bg-slate-900 border border-slate-400 text-[8px] font-mono px-1 py-0.5 rounded shadow-xs cursor-pointer text-slate-700 dark:text-slate-200 hover:bg-primary hover:text-white"
                      title="Clique para nomear esta seta (ex: Sim/Não)"
                    >
                      +
                    </button>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </svg>

        <div className="min-w-[1100px] divide-y-2 divide-slate-800 dark:divide-slate-200 relative z-10">
          {/* Swimlanes Render */}
          {lanes.map((lane, laneIdx) => {
            const laneTasks = filteredTarefas.filter(t => {
              if (t.areaResponsavel) {
                return t.areaResponsavel.toLowerCase() === lane.nome.toLowerCase();
              }
              return laneIdx === 0;
            });

            const laneAdditionalNodes = bpmnNodes.filter(n => n.laneId === lane.id);
            const isDropTarget = dragOverLaneId === lane.id;

            return (
              <div 
                key={lane.id} 
                onDragOver={(e) => handleLaneDragOver(e, lane.id)}
                onDragLeave={handleLaneDragLeave}
                onDrop={(e) => handleLaneDrop(e, lane)}
                className={`flex flex-row min-h-[290px] transition-all group ${
                  isDropTarget 
                    ? 'bg-primary/5 ring-2 ring-inset ring-primary/40' 
                    : 'bg-white dark:bg-slate-950'
                }`}
              >
                {/* Cabeçalho Vertical da Raia (Estilo "Customer" da Imagem de Referência) */}
                <div 
                  className="w-12 sm:w-14 border-r-2 border-slate-800 dark:border-slate-200 bg-slate-50 dark:bg-slate-900/80 flex flex-col justify-between items-center py-4 select-none relative shrink-0"
                  style={{ borderLeft: `5px solid ${lane.cor || '#0ea5e9'}` }}
                >
                  {/* Botões rápidos discretos no topo da faixa vertical */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-1 z-30">
                    {laneIdx > 0 && (
                      <button
                        type="button"
                        onClick={() => handleMoveLane(laneIdx, 'up')}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded cursor-pointer"
                        title="Mover raia para cima"
                      >
                        <MoveVertical className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenLaneModal(lane)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded cursor-pointer"
                      title="Editar nome da raia"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Nome da Área formatado verticalmente seguindo a linha (como "Customer") */}
                  <div className="flex-1 flex items-center justify-center my-2">
                    <span 
                      className="text-xs sm:text-sm font-bold tracking-widest text-slate-900 dark:text-slate-100 uppercase whitespace-nowrap cursor-pointer hover:text-primary transition-colors"
                      style={{
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                      }}
                      onClick={() => handleOpenLaneModal(lane)}
                      title={`Clique para editar a raia: ${lane.nome}`}
                    >
                      {lane.nome}
                    </span>
                  </div>

                  {/* Ações inferiores da raia */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-1 z-30">
                    {lanes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteLane(lane.id, lane.nome)}
                        className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-500 rounded cursor-pointer"
                        title="Remover raia"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Conteúdo da Raia / Elementos Alinhados Harmoniosamente */}
                <div className="flex-1 px-8 py-6 flex items-center gap-14 sm:gap-18 overflow-x-auto custom-scrollbar relative">
                  {laneTasks.length === 0 && laneAdditionalNodes.length === 0 ? (
                    <div className="h-full w-full flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-6 text-center">
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                        {isDropTarget 
                          ? 'Solte o elemento BPMN aqui...' 
                          : 'Arraste componentes da paleta para esta raia ou clique em "+ Nova Tarefa"'}
                      </span>
                    </div>
                  ) : (
                    <>
                      {/* Renderização dos Nós adicionais e Tarefas com notação canônica */}

                      {/* 1. Nós BPMN Adicionais (Start, Gateways, End, Anotações) */}
                      {laneAdditionalNodes.map(node => {
                        const isConnectingSource = connectSourceId === node.id;
                        const isGateway = node.type.startsWith('gateway');
                        const isStart = node.type === 'start' || node.type === 'start_message';
                        const isEnd = node.type === 'end' || node.type === 'end_terminate';
                        const isDataObject = node.type === 'data_object';
                        const isAnnotation = node.type === 'annotation';

                        return (
                          <div 
                            key={node.id} 
                            className="flex flex-col items-center justify-center shrink-0 relative py-4 group/node"
                          >
                            {/* Rótulo ACIMA no caso de Gateways (como "Scan successful?" na imagem) */}
                            {isGateway && (
                              <span className="absolute -top-3 text-[11px] font-bold text-slate-900 dark:text-slate-100 text-center leading-tight whitespace-nowrap bg-white/90 dark:bg-slate-950/90 px-1.5 py-0.5 rounded shadow-2xs z-10">
                                {node.label}
                              </span>
                            )}

                            {/* O Elemento Gráfico Central */}
                            <div
                              id={`bpmn-node-${node.id}`}
                              draggable={activeTool === 'select'}
                              onDragStart={(e) => handleNodeDragStart(e, node.id)}
                              onClick={() => {
                                if (activeTool !== 'select' || connectSourceId) {
                                  handleConnectElement(node.id);
                                }
                              }}
                              className={`transition-all select-none relative ${
                                activeTool !== 'select' ? 'cursor-pointer hover:ring-2 hover:ring-primary' : 'cursor-grab active:cursor-grabbing'
                              } ${
                                isConnectingSource ? 'ring-4 ring-amber-400 shadow-lg' : ''
                              } ${
                                isGateway
                                  ? 'w-13 h-13 rotate-45 border-2 border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-900 flex items-center justify-center shadow-xs'
                                  : isStart
                                    ? 'w-11 h-11 rounded-full border-2 border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-900 flex items-center justify-center shadow-xs'
                                    : isEnd
                                      ? 'w-11 h-11 rounded-full border-4 border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-900 flex items-center justify-center shadow-xs'
                                      : node.type === 'timer'
                                        ? 'w-11 h-11 rounded-full border-2 border-double border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-900 flex items-center justify-center shadow-xs'
                                        : isDataObject
                                          ? 'w-24 h-28 border-2 border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-900 rounded-sm flex flex-col justify-center items-center shadow-xs p-2'
                                          : 'w-32 border-l-4 border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-900 p-2 text-xs italic shadow-xs'
                              }`}
                            >
                              {/* Símbolo Interno do Nó */}
                              {isGateway && (
                                <span className="-rotate-45 text-xl font-black font-mono text-slate-900 dark:text-slate-100 select-none">
                                  {node.type === 'gateway_exclusive' ? '✕' : node.type === 'gateway_parallel' ? '➕' : '◯'}
                                </span>
                              )}
                              {isStart && node.type === 'start_message' && (
                                <Mail className="w-4 h-4 text-slate-800 dark:text-slate-200" />
                              )}
                              {node.type === 'timer' && (
                                <Clock className="w-4 h-4 text-slate-800 dark:text-slate-200" />
                              )}
                              {node.type === 'end_terminate' && (
                                <span className="w-4 h-4 rounded-full bg-slate-900 dark:bg-slate-100 inline-block" />
                              )}
                              {isDataObject && (
                                <FileText className="w-6 h-6 text-slate-800 dark:text-slate-200 mb-1" />
                              )}

                              {/* Puxador rápido de Seta na borda direita */}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleConnectElement(node.id); }}
                                className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border flex items-center justify-center transition-all z-30 cursor-pointer shadow-md ${
                                  isGateway ? '-rotate-45' : ''
                                } ${
                                  isConnectingSource 
                                    ? 'bg-amber-400 text-black border-amber-300 ring-2 ring-amber-300 animate-pulse'
                                    : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 border-slate-700 opacity-0 group-hover/node:opacity-100 hover:scale-115'
                                }`}
                                title="Traçar Seta a partir deste nó"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Rótulo ABAIXO no caso de Start, End e Artefatos (como "Notices QR code" e "Is informed") */}
                            {!isGateway && (
                              <span className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 text-center mt-2.5 leading-snug max-w-[110px] break-words">
                                {node.label}
                              </span>
                            )}

                            {/* Ações de Edição e Exclusão no hover */}
                            <div className="absolute -bottom-6 flex items-center gap-1 opacity-0 group-hover/node:opacity-100 transition-opacity bg-white/95 dark:bg-slate-900/95 border border-slate-300 dark:border-slate-700 rounded-md p-0.5 shadow-xs z-30">
                              <button
                                type="button"
                                onClick={() => handleOpenNodeModal(node)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded"
                                title="Editar elemento"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteNode(node.id)}
                                className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-500 rounded"
                                title="Excluir elemento"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* 2. Tarefas / Atividades BPMN (Formato Retangular da Imagem de Referência) */}
                      {laneTasks.map(task => {
                        const sla = getTaskSla(task);
                        const isConnectingSource = connectSourceId === task.id;

                        return (
                          <div
                            key={task.id}
                            className="flex flex-col items-center justify-center shrink-0 relative group/card py-4"
                          >
                            <div
                              id={`bpmn-node-${task.id}`}
                              draggable={activeTool === 'select'}
                              onDragStart={(e) => handleTaskDragStart(e, task.id)}
                              onClick={() => {
                                if (activeTool !== 'select' || connectSourceId) {
                                  handleConnectElement(task.id);
                                }
                              }}
                              className={`w-44 h-24 rounded-2xl border-2 border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-900 flex flex-col justify-between p-2.5 shadow-xs relative transition-all select-none ${
                                activeTool !== 'select' ? 'cursor-pointer hover:ring-2 hover:ring-primary' : 'cursor-grab active:cursor-grabbing'
                              } ${
                                isConnectingSource
                                  ? 'ring-4 ring-amber-400 shadow-lg'
                                  : sla.isAtrasada
                                    ? 'border-rose-500 ring-2 ring-rose-500/50'
                                    : 'hover:shadow-md'
                              }`}
                            >
                              {/* Top Header da Tarefa: mini ícone de tipo BPMN + alerta SLA */}
                              <div className="flex items-center justify-between">
                                <span className="text-slate-600 dark:text-slate-400" title="BPMN Activity">
                                  <User className="w-3.5 h-3.5" />
                                </span>

                                {sla.isAtrasada && (
                                  <span className="bg-rose-500 text-white text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full animate-pulse shadow-2xs">
                                    +{sla.diasExcedidos}d
                                  </span>
                                )}
                              </div>

                              {/* Texto Principal Centralizado (como "Scan QR code" e "Open product information") */}
                              <div className="flex-1 flex items-center justify-center text-center px-1">
                                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-3">
                                  {task.Tarefa}
                                </p>
                              </div>

                              {/* Rodapé discreto com Prazo e Status */}
                              <div className="flex items-center justify-between text-[9.5px] text-slate-500 dark:text-slate-400 font-mono pt-1 border-t border-slate-200 dark:border-slate-800">
                                <span className="flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  <strong>{sla.prazo}d</strong>
                                </span>
                                <span className="truncate max-w-[85px] font-sans font-medium">
                                  {task.Status_Tarefa}
                                </span>
                              </div>

                              {/* Puxador rápido de Seta na borda direita */}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleConnectElement(task.id); }}
                                className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border flex items-center justify-center transition-all z-30 cursor-pointer shadow-md ${
                                  isConnectingSource 
                                    ? 'bg-amber-400 text-black border-amber-300 ring-2 ring-amber-300 animate-pulse'
                                    : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 border-slate-700 opacity-0 group-hover/card:opacity-100 hover:scale-115'
                                }`}
                                title="Traçar Seta a partir desta Tarefa"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Ações de Edição e Exclusão no hover */}
                            <div className="absolute -bottom-6 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity bg-white/95 dark:bg-slate-900/95 border border-slate-300 dark:border-slate-700 rounded-md p-0.5 shadow-xs z-30">
                              <button
                                type="button"
                                onClick={() => handleOpenTaskModal(task, lane.nome)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded"
                                title="Editar tarefa"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteTarefa(task.id)}
                                className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-500 rounded"
                                title="Excluir tarefa"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
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
                  {editingTask ? 'Editar Atividade BPMN' : 'Nova Atividade no Fluxo BPMN'}
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
                  Nome da Atividade <span className="text-rose-400">*</span>
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
                  placeholder="Orientações normativas, número SEI ou artefatos vinculados..."
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
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-xs font-bold text-on-primary rounded-xl cursor-pointer shadow-xs"
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
                  {editingLane ? 'Editar Raia' : 'Nova Raia (Área Responsável)'}
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
                  placeholder="Ex: Customer / Área Demandante / CGLIC"
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
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-xs font-bold text-on-primary rounded-xl cursor-pointer shadow-xs"
                >
                  {editingLane ? 'Salvar Raia' : 'Criar Nova Raia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição de Elemento BPMN (Gateways, Eventos) */}
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
                  Rótulo / Pergunta (Ex: "Scan successful?") <span className="text-rose-400">*</span>
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
                  Detalhes / Regra de Decisão
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
                    className="px-5 py-2 bg-primary hover:bg-primary/90 text-xs font-bold text-on-primary rounded-xl cursor-pointer shadow-xs"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Configuração da Seta Ortogonal */}
      {isConnModalOpen && editingConnection && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-surface-container border border-outline-variant w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-surface-container-high px-6 py-4 border-b border-outline-variant flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-primary" />
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
                  Rótulo da Condição (Ex: "Yes", "No", "Sim", "Não", "Aprovado")
                </label>
                <input
                  type="text"
                  placeholder="Ex: Yes"
                  value={connLabel}
                  onChange={(e) => setConnLabel(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Estilo da Linha
                </label>
                <select
                  value={connTipo}
                  onChange={(e) => setConnTipo(e.target.value as any)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="sequence">Sequencial Padrão (Linha Sólida)</option>
                  <option value="association">Associação (Linha Tracejada)</option>
                </select>
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
                    className="px-5 py-2 bg-primary hover:bg-primary/90 text-xs font-bold text-on-primary rounded-xl cursor-pointer shadow-xs"
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
