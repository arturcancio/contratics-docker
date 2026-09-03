/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BaseDeConhecimento, FAQItem, Planejamento, Contrato, User } from '../types';
import { 
  Scale, 
  Plus, 
  HelpCircle, 
  X, 
  Search, 
  Globe, 
  Calendar, 
  ChevronRight, 
  Layers, 
  Clock, 
  Trash2, 
  ExternalLink,
  Edit2,
  Check,
  ArrowRight,
  Cloud,
  Monitor,
  Server,
  Code,
  ShieldCheck
} from 'lucide-react';

interface BaseConhecimentoProps {
  baseConhecimento: BaseDeConhecimento[];
  faqs: FAQItem[];
  planejamentos: Planejamento[];
  contratos: Contrato[];
  currentUser: User;
  currentLocalTime: string;
  onAddNormativo: (newNorm: BaseDeConhecimento) => void;
  onAddFAQ: (newFaq: FAQItem) => void;
  onDeleteFAQ: (id: string) => void;
  onNavigateToPlanning: (id: string) => void;
  onDeleteNormativo?: (id: string) => void;
  onEditNormativo?: (edited: BaseDeConhecimento) => void;
  onEditFAQ?: (edited: FAQItem) => void;
}

interface CalendarEvent {
  dateString: string; // YYYY-MM-DD
  title: string;
  type: 'sessao' | 'vencimento' | 'tarefa' | 'lancamento';
  color: string;
  details: string;
}

export default function BaseConhecimento({
  baseConhecimento,
  faqs,
  planejamentos,
  contratos,
  currentUser,
  currentLocalTime,
  onAddNormativo,
  onAddFAQ,
  onDeleteFAQ,
  onNavigateToPlanning,
  onDeleteNormativo,
  onEditNormativo,
  onEditFAQ,
}: BaseConhecimentoProps) {
  // Tabs: Normativos vs FAQ vs Calendario
  const [activeTab, setActiveTab] = useState<'normativos' | 'faq' | 'calendario'>('normativos');
  const [activeFlowStep, setActiveFlowStep] = useState(0);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isNormModalOpen, setIsNormModalOpen] = useState(false);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);

  // Edit states
  const [editingNorm, setEditingNorm] = useState<BaseDeConhecimento | null>(null);
  const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);

  // Forms
  const [newNormLegal, setNewNormLegal] = useState('');
  const [newNormDesc, setNewNormDesc] = useState('');
  const [newNormLink, setNewNormLink] = useState('');
  const [newNormCat, setNewNormCat] = useState<'Interno' | 'Geral'>('Geral');

  const [newFaqPerg, setNewFaqPerg] = useState('');
  const [newFaqResp, setNewFaqResp] = useState('');

  // Edit Trigger Helpers
  const handleStartEditNorm = (norm: BaseDeConhecimento) => {
    setEditingNorm(norm);
    setNewNormLegal(norm.Dispositivo_Legal);
    setNewNormDesc(norm.Descricao);
    setNewNormLink(norm.Acesso);
    setNewNormCat(norm.Categoria);
    setIsNormModalOpen(true);
  };

  const handleStartEditFaq = (faq: FAQItem) => {
    setEditingFaq(faq);
    setNewFaqPerg(faq.Pergunta);
    setNewFaqResp(faq.Resposta);
    setIsFaqModalOpen(true);
  };

  const handleCloseNormModal = () => {
    setIsNormModalOpen(false);
    setEditingNorm(null);
    setNewNormLegal('');
    setNewNormDesc('');
    setNewNormLink('');
    setNewNormCat('Geral');
  };

  const handleCloseFaqModal = () => {
    setIsFaqModalOpen(false);
    setEditingFaq(null);
    setNewFaqPerg('');
    setNewFaqResp('');
  };

  const parseLocalDate = (dateStr: string) => {
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
    }
    return new Date(dateStr);
  };

  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getVigenciaFinalInicial = (ini: string, m: number) => {
    const d = parseLocalDate(ini);
    d.setMonth(d.getMonth() + m);
    return d;
  };

  const getVigenciaFinal = (ini: string, m: number, r: number) => {
    const d = getVigenciaFinalInicial(ini, m);
    d.setMonth(d.getMonth() + r);
    return d;
  };

  const generateEvents = (): CalendarEvent[] => {
    const list: CalendarEvent[] = [];

    // Plan sessions
    planejamentos.forEach(p => {
      if (p.Data_Sessao_Publica) {
        const datePart = p.Data_Sessao_Publica.split('T')[0];
        list.push({
          dateString: datePart,
          title: `Sessão Pública SEI: ${p.SEI_Processo}`,
          type: 'sessao',
          color: 'bg-primary text-primary',
          details: `Licitação do objeto: ${p.Objeto}`
        });
      }
    });

    // Contract final validity dates
    contratos.forEach(c => {
      const dFinalInicial = getVigenciaFinalInicial(c.Vigencia_Inicio, c.Vigencia_Inicial_Meses);
      list.push({
        dateString: formatLocalDate(dFinalInicial),
        title: `Término Contrato: ${c.Num_Contrato}`,
        type: 'vencimento',
        color: 'bg-rose-400 text-rose-300',
        details: `Prazo Inicial de vigência expira. Objeto: ${c.Objeto}`
      });

      const dFinalAditivado = getVigenciaFinal(c.Vigencia_Inicio, c.Vigencia_Inicial_Meses, c.Numero_Renovacoes);
      if (dFinalAditivado.getTime() !== dFinalInicial.getTime()) {
        list.push({
          dateString: formatLocalDate(dFinalAditivado),
          title: `Término Renovação: ${c.Num_Contrato}`,
          type: 'vencimento',
          color: 'bg-rose-400 text-rose-300',
          details: `Vigência aditivada final do contrato. Prorrogável até o limite máximo.`
        });
      }
    });

    return list;
  };

  const events = generateEvents();

  // Calendar rendering helpers (Simple month render)
  const [currentSelectedMonth, setCurrentSelectedMonth] = useState(new Date(currentLocalTime).getUTCMonth());
  const [currentSelectedYear, setCurrentSelectedYear] = useState(new Date(currentLocalTime).getUTCFullYear());
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null);
  const [hoveredEventDetails, setHoveredEventDetails] = useState<string | null>(null);

  const monthsBr = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handlePrevMonth = () => {
    if (currentSelectedMonth === 0) {
      setCurrentSelectedMonth(11);
      setCurrentSelectedYear(currentSelectedYear - 1);
    } else {
      setCurrentSelectedMonth(currentSelectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentSelectedMonth === 11) {
      setCurrentSelectedMonth(0);
      setCurrentSelectedYear(currentSelectedYear + 1);
    } else {
      setCurrentSelectedMonth(currentSelectedMonth + 1);
    }
  };

  const daysInMonth = new Date(currentSelectedYear, currentSelectedMonth + 1, 0).getDate();
  const firstDayOfMonthIndex = new Date(currentSelectedYear, currentSelectedMonth, 1).getDay(); // Sunday is 0, etc.

  // BPMN Chevron Visualizer logic
  // Steps of standard flow process: ETP -> TR -> Parecer Juridico -> Homologação -> Contrato
  const bpmnSteps = [
    { title: 'Estudos Técnicos (ETP)', status: 'Em Elaboração' },
    { title: 'Termo de Referência (TR)', status: 'Em Elaboração' },
    { title: 'Análise CONJUR (Parecer)', status: 'Seleção Fornecedor' },
    { title: 'Sessão Pública (Pregão)', status: 'Seleção Fornecedor' },
    { title: 'Contratação Concluída', status: 'Gerou Contrato' }
  ];

  const handleSaveNorm = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role === 'Visualizador') return;
    if (!newNormLegal || !newNormDesc) return;

    if (editingNorm) {
      onEditNormativo?.({
        ...editingNorm,
        Dispositivo_Legal: newNormLegal,
        Descricao: newNormDesc,
        Acesso: newNormLink || 'https://www.planalto.gov.br',
        Categoria: newNormCat
      });
    } else {
      onAddNormativo({
        id: `base-${Date.now()}`,
        Dispositivo_Legal: newNormLegal,
        Descricao: newNormDesc,
        Acesso: newNormLink || 'https://www.planalto.gov.br',
        Categoria: newNormCat
      });
    }

    handleCloseNormModal();
  };

  const handleSaveFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role === 'Visualizador') return;
    if (!newFaqPerg || !newFaqResp) return;

    if (editingFaq) {
      onEditFAQ?.({
        ...editingFaq,
        Pergunta: newFaqPerg,
        Resposta: newFaqResp
      });
    } else {
      onAddFAQ({
        id: `faq-${Date.now()}`,
        Pergunta: newFaqPerg,
        Resposta: newFaqResp
      });
    }

    handleCloseFaqModal();
  };

  // Searching logic
  const filteredNormativos = baseConhecimento
    .filter(b => !b.Dispositivo_Legal.startsWith('Novo DFD') && !b.Dispositivo_Legal.includes('DFD'))
    .filter(b => 
      b.Dispositivo_Legal.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.Descricao.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const filteredFAQs = faqs.filter(f => 
    f.Pergunta.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.Resposta.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" id="base-knowledge-section">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <nav className="flex items-center gap-2 text-on-surface-variant mb-1 text-xs uppercase tracking-wider">
            <span>Repositório</span>
            <span>&gt;</span>
            <span className="text-primary font-medium">Normativos & FAQ</span>
          </nav>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">Normativos & FAQ</h2>
          <p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            Legislação, FAQ de dúvidas da equipe e Calendário de prazos/sessões públicas
          </p>
        </div>

        {currentUser.role !== 'Visualizador' && (
          <div className="flex gap-2">
            {activeTab === 'normativos' && (
              <button
                onClick={() => setIsNormModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 border border-primary/30 bg-primary/10 hover:bg-primary/20 text-xs text-primary rounded-lg font-semibold transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Novo Normativo
              </button>
            )}
            {activeTab === 'faq' && (
              <button
                onClick={() => setIsFaqModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 border border-primary/30 bg-primary/10 hover:bg-primary/20 text-xs text-primary rounded-lg font-semibold transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nova Dúvida FAQ
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-outline-variant gap-1 overflow-x-auto whitespace-nowrap scrollbar-none scroll-smooth shrink-0 pb-px">
        <button
          onClick={() => setActiveTab('normativos')}
          className={`px-5 py-3 cursor-pointer text-xs font-bold relative transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
            activeTab === 'normativos' ? 'text-primary bg-primary/5' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Scale className="w-4 h-4 text-primary/70 shrink-0" />
          <span>Normativos & Legislação</span>
          {activeTab === 'normativos' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded" />}
        </button>

        <button
          onClick={() => setActiveTab('faq')}
          className={`px-5 py-3 cursor-pointer text-xs font-bold relative transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
            activeTab === 'faq' ? 'text-primary bg-primary/5' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <HelpCircle className="w-4 h-4 text-primary/70 shrink-0" />
          <span>Perguntas Frequentes (FAQ)</span>
          {activeTab === 'faq' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded" />}
        </button>

        <button
          onClick={() => setActiveTab('calendario')}
          className={`px-5 py-3 cursor-pointer text-xs font-bold relative transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
            activeTab === 'calendario' ? 'text-primary bg-primary/5' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Calendar className="w-4 h-4 text-primary/70 shrink-0" />
          <span>Calendário de Prazos</span>
          {activeTab === 'calendario' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded" />}
        </button>
      </div>

      {/* Main Tab Body */}
      {activeTab === 'normativos' && (
        <div className="space-y-6">
          {/* Hero Section for SGD/MGI Models */}
          <div className="bg-gradient-to-r from-primary/10 via-surface-container-low to-surface-container border border-primary/25 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-outline-variant/30">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider">
                    SGD / MGI &bull; SISP
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-medium">Modelos Padronizados Federais</span>
                </div>
                <h3 className="text-base font-bold text-on-surface tracking-tight">Modelos Especificos de Contratação de TIC (Governo Digital)</h3>
                <p className="text-xs text-on-surface-variant max-w-3xl leading-relaxed">
                  Modelos de contratação, portarias e diretrizes estabelecidas pela Secretaria de Governo Digital (SGD/MGI) para padronizar e otimizar aquisições de soluções de TIC no âmbito do Poder Executivo Federal.
                </p>
              </div>

              <a
                href="https://www.gov.br/governodigital/pt-br/contratacoes-de-tic/legislacao"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-high text-on-primary text-xs font-bold rounded-lg transition-all shrink-0 shadow-sm hover:shadow cursor-pointer"
              >
                <Globe className="w-4 h-4" />
                <span>Portal de Legislação TIC (GOV.BR)</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>
            </div>

            {/* Model Quick Buttons Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {/* Model 1: Nuvem */}
              <a
                href="https://www.gov.br/governodigital/pt-br/contratacoes-de-tic/legislacao/modelo-de-contratacao-de-software-e-servicos-em-nuvem/vigentes/modelo-de-contratacao-de-software-e-nuvem/portaria-sgd-mgi-no-5-950-de-26-de-outubro-de-2023"
                target="_blank"
                rel="noreferrer"
                className="bg-surface-container-lowest border border-outline-variant/60 hover:border-primary/50 hover:bg-primary/5 rounded-xl p-3.5 transition-all group flex flex-col justify-between gap-3 shadow-2xs hover:shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 group-hover:scale-105 transition-transform">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-on-surface-variant/70 bg-surface-container px-1.5 py-0.5 rounded">
                      Portaria 5.950/23
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors leading-tight">
                      Computação em Nuvem & Software
                    </h4>
                    <p className="text-[11px] text-on-surface-variant mt-1 leading-snug line-clamp-2">
                      Modelo padronizado para contratação e gestão de software e serviços de nuvem (SaaS, IaaS, PaaS).
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 text-[10px] font-bold text-primary">
                  <span>Acessar Modelo Nuvem</span>
                  <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </a>

              {/* Model 2: Estações de Trabalho */}
              <a
                href="https://www.gov.br/governodigital/pt-br/contratacoes-de-tic/legislacao/modelo-de-contratacao-e-gestao-de-estacoes-de-trabalho/vigente/portaria-sgd-mgi-no-2-715-de-21-de-junho-de-2023"
                target="_blank"
                rel="noreferrer"
                className="bg-surface-container-lowest border border-outline-variant/60 hover:border-primary/50 hover:bg-primary/5 rounded-xl p-3.5 transition-all group flex flex-col justify-between gap-3 shadow-2xs hover:shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                      <Monitor className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-on-surface-variant/70 bg-surface-container px-1.5 py-0.5 rounded">
                      Portaria 2.715/23
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors leading-tight">
                      Estações de Trabalho (PCaaS)
                    </h4>
                    <p className="text-[11px] text-on-surface-variant mt-1 leading-snug line-clamp-2">
                      Modelo para contratação de microcomputadores, notebooks, virtualização e Estação de Trabalho como Serviço.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 text-[10px] font-bold text-primary">
                  <span>Acessar Estações TR</span>
                  <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </a>

              {/* Model 3: Infraestrutura & Service Desk */}
              <a
                href="https://www.gov.br/governodigital/pt-br/contratacoes-de-tic/legislacao/modelo-de-contracao-de-servicos-de-operacao-de-infraestrutura-e-de-atendimento-a-usuarios-de-tic/copy_of_portaria-sgd-mgi-no-1-070-de-1o-de-junho-de-2023"
                target="_blank"
                rel="noreferrer"
                className="bg-surface-container-lowest border border-outline-variant/60 hover:border-primary/50 hover:bg-primary/5 rounded-xl p-3.5 transition-all group flex flex-col justify-between gap-3 shadow-2xs hover:shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
                      <Server className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-on-surface-variant/70 bg-surface-container px-1.5 py-0.5 rounded">
                      Portaria 1.070/23
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors leading-tight">
                      Infraestrutura & Service Desk
                    </h4>
                    <p className="text-[11px] text-on-surface-variant mt-1 leading-snug line-clamp-2">
                      Modelo para operação de infraestrutura de TIC e atendimento continuado de suporte aos usuários.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 text-[10px] font-bold text-primary">
                  <span>Acessar Service Desk</span>
                  <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </a>

              {/* Model 4: Fábrica de Software */}
              <a
                href="https://www.gov.br/governodigital/pt-br/contratacoes-de-tic/legislacao/modelo-de-contratacao-de-servicos-de-desenvolvimento-manutencao-e-sustentacao-de-software/portaria-sgd-mgi-no-750-de-20-de-marco-de-2023"
                target="_blank"
                rel="noreferrer"
                className="bg-surface-container-lowest border border-outline-variant/60 hover:border-primary/50 hover:bg-primary/5 rounded-xl p-3.5 transition-all group flex flex-col justify-between gap-3 shadow-2xs hover:shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:scale-105 transition-transform">
                      <Code className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-on-surface-variant/70 bg-surface-container px-1.5 py-0.5 rounded">
                      Portaria 750/23
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors leading-tight">
                      Fábrica & Manutenção de Software
                    </h4>
                    <p className="text-[11px] text-on-surface-variant mt-1 leading-snug line-clamp-2">
                      Desenvolvimento, sustentação de sistemas e valoração de serviços de software.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 text-[10px] font-bold text-primary">
                  <span>Acessar Fábrica TR</span>
                  <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </a>
            </div>
          </div>

          {/* Search Box & Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="w-full sm:max-w-md">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  type="text"
                  placeholder="Buscar normativos, leis ou portarias da SGD..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant text-xs text-on-surface pl-9 pr-4 py-2 rounded-lg outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {currentUser.role === 'GECTI' && (
              <button
                type="button"
                onClick={() => {
                  setEditingNorm(null);
                  setNewNormLegal('');
                  setNewNormDesc('');
                  setNewNormLink('');
                  setNewNormCat('Geral');
                  setIsNormModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-high text-on-primary text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Regramento</span>
              </button>
            )}
          </div>

          {/* Grid of Normativos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredNormativos.map(norm => (
              <div key={norm.id} className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-5 hover:border-primary/40 hover:bg-surface-container transition-all group flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                      norm.Categoria === 'Interno'
                        ? 'bg-amber-400/10 border-amber-400/20 text-amber-300'
                        : 'bg-primary/10 border-primary/20 text-primary'
                    }`}>{norm.Categoria === 'Interno' ? 'Regulação Interna SOF' : 'Legislação Federal Geral / SGD'}</span>
                  </div>
                  <h4 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">{norm.Dispositivo_Legal}</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{norm.Descricao}</p>
                </div>

                <div className="border-t border-outline-variant/20 pt-3 mt-4 flex justify-between items-center text-xs">
                  <a
                    href={norm.Acesso}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Acessar Publicação / Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  {currentUser.role === 'GECTI' && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEditNorm(norm)}
                        className="p-1 text-on-surface-variant/55 hover:text-primary hover:bg-primary/10 rounded transition-all cursor-pointer"
                        title="Editar Regramento"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteNormativo?.(norm.id)}
                        className="p-1 text-on-surface-variant/55 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                        title="Excluir Regramento"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'calendario' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start font-sans">
          {/* Calendar Plate */}
          <div className="lg:col-span-8 bg-surface-container-low border border-outline-variant rounded-xl p-5">
            {/* Calendar controller header */}
            <div className="flex justify-between items-center mb-5 border-b border-outline-variant/30 pb-3">
              <span className="text-xs font-bold uppercase text-on-surface">Calendário Mensal de Atividades</span>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 px-3 bg-surface-container border border-outline-variant rounded hover:text-primary text-xs cursor-pointer font-bold"
                >
                  &lt;
                </button>
                <span className="text-xs font-bold text-on-surface font-sans">{monthsBr[currentSelectedMonth]} {currentSelectedYear}</span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 px-3 bg-surface-container border border-outline-variant rounded hover:text-primary text-xs cursor-pointer font-bold"
                >
                  &gt;
                </button>
              </div>
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs text-on-surface-variant font-medium">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <span key={d} className="py-1 text-[10px] uppercase font-bold text-on-surface-variant/70 tracking-wider">{d}</span>
              ))}

              {/* Blank offset indices */}
              {Array.from({ length: firstDayOfMonthIndex }).map((_, i) => (
                <div key={`offset-${i}`} className="h-14 border border-outline-variant/10 rounded-lg opacity-25" />
              ))}

              {/* Real day counts */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const formattedDateStr = `${currentSelectedYear}-${String(currentSelectedMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                
                // Get matches
                const dayEvents = events.filter(e => e.dateString === formattedDateStr);
                const isToday = new Date(currentLocalTime).toISOString().split('T')[0] === formattedDateStr;
                const isSelected = selectedDayStr === formattedDateStr;

                return (
                  <div
                    key={`day-${dayNum}`}
                    onMouseEnter={() => dayEvents.length > 0 && setHoveredEventDetails(dayEvents.map(e => `${e.title}: ${e.details}`).join('\n'))}
                    onMouseLeave={() => setHoveredEventDetails(null)}
                    onClick={() => {
                      if (dayEvents.length > 0) {
                        setSelectedDayStr(isSelected ? null : formattedDateStr);
                      } else {
                        setSelectedDayStr(null);
                      }
                    }}
                    className={`h-14 border rounded-lg p-1.5 flex flex-col justify-between items-start transition-all relative cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-primary border-primary bg-primary/10 text-on-surface shadow-sm'
                        : isToday 
                        ? 'border-primary bg-primary/5 text-primary' 
                        : dayEvents.length > 0
                        ? 'border-outline-variant hover:border-primary/40 bg-surface-container-high/40 text-on-surface'
                        : 'border-outline-variant/30 text-on-surface-variant/60'
                    }`}
                  >
                    <span className="text-[10px] font-mono leading-none font-bold text-on-surface-variant">{dayNum}</span>
                    
                    {/* Event indicators */}
                    <div className="flex flex-wrap gap-1 w-full justify-end mt-1">
                      {dayEvents.map((evt, idx) => (
                        <div
                          key={idx}
                          className={`w-1.5 h-1.5 rounded-full ${
                            evt.type === 'sessao' ? 'bg-primary' : 'bg-rose-400'
                          }`}
                          title={evt.title}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side detailing panel */}
          <div className="lg:col-span-4 bg-surface-container-low border border-outline-variant rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                {selectedDayStr ? `Filtro: Dia ${selectedDayStr.split('-').reverse().join('/')}` : 'Lista de Eventos Próximos'}
              </span>
              {selectedDayStr && (
                <button
                  type="button"
                  onClick={() => setSelectedDayStr(null)}
                  className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                >
                  Ver todos
                </button>
              )}
            </div>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 text-xs">
              {(() => {
                const filteredEvents = selectedDayStr 
                  ? events.filter(e => e.dateString === selectedDayStr)
                  : events;
                
                if (filteredEvents.length === 0) {
                  return (
                    <p className="text-xs italic text-on-surface-variant/40 text-center py-4">Nenhum evento neste dia.</p>
                  );
                }

                return filteredEvents.map((evt, idx) => (
                  <div key={idx} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 space-y-1 hover:border-primary/30 transition-all">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono font-bold text-on-surface-variant">{evt.dateString.split('-').reverse().join('/')}</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.25 rounded border ${
                        evt.type === 'sessao'
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}>{evt.type.toUpperCase()}</span>
                    </div>
                    <p className="font-semibold text-on-surface leading-tight">{evt.title}</p>
                    <p className="text-[10px] text-on-surface-variant leading-relaxed select-text">{evt.details}</p>
                  </div>
                ));
              })()}
            </div>

            {/* Hover details tooltip mock rendering */}
            {hoveredEventDetails && !selectedDayStr && (
              <div className="bg-primary/10 border border-primary/30 text-xs text-primary p-3 rounded-lg leading-relaxed animate-in fade-in">
                <strong>Marcador Selecionado:</strong>
                <p className="mt-1 font-mono text-[10px] whitespace-pre-wrap">{hoveredEventDetails}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'faq' && (
        <div className="space-y-4">
          <div className="max-w-md">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Pesquisar dúvidas no FAQ..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant text-xs text-on-surface pl-9 pr-4 py-2 rounded-lg outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-3.5">
            {filteredFAQs.map(faq => (
              <div key={faq.id} className="bg-surface-container-low border border-outline-variant rounded-xl p-5 hover:bg-surface-container transition-colors relative group">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-on-surface leading-tight font-sans pr-8">{faq.Pergunta}</h4>
                    <p className="text-xs text-on-surface-variant leading-relaxed select-text font-sans">{faq.Resposta}</p>
                  </div>
                </div>

                {/* FAQ Deletions/Edits pill (only for GECTI) */}
                {currentUser.role === 'GECTI' && (
                  <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-surface-container-high border border-outline-variant rounded-lg p-0.5 shadow-sm">
                    <button
                      type="button"
                      onClick={() => handleStartEditFaq(faq)}
                      className="p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                      title="Editar FAQ"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteFAQ(faq.id)}
                      className="p-1 text-on-surface-variant hover:text-rose-400 transition-colors cursor-pointer"
                      title="Excluir FAQ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Normativo Registration Manual Modal */}
      {isNormModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface-container border border-outline-variant w-full max-w-md max-h-full sm:max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-xl animate-in zoom-in-95 duration-100">
            <div className="bg-surface-container-high px-5 py-3 border-b border-outline-variant flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-on-surface">
                {editingNorm ? "Editar Regramento Técnico" : "Cadastrar Novo Regramento Técnico"}
              </span>
              <button onClick={handleCloseNormModal} className="text-on-surface-variant hover:text-on-surface">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNorm} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase block">Dispositivo Legal / Portaria</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Lei nº 14.133/2021"
                  value={newNormLegal}
                  onChange={e => setNewNormLegal(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase block">Tipo de Governança</label>
                <select
                  value={newNormCat}
                  onChange={e => setNewNormCat(e.target.value as any)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface"
                >
                  <option value="Geral font-sans font-sans">Instrução Geral Federal</option>
                  <option value="Interno font-sans font-sans">Regramento Interno SOF</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase block">URL da Publicação Oficial</label>
                <input
                  type="url"
                  placeholder="https://www.in.gov.br/..."
                  value={newNormLink}
                  onChange={e => setNewNormLink(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase block">Resumo do Dispositivo</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Forneça uma sinopse resumida do impacto do dispositivo..."
                  value={newNormDesc}
                  onChange={e => setNewNormDesc(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleCloseNormModal}
                  className="px-3 py-1.5 text-xs border border-outline-variant rounded text-on-surface-variant hover:bg-surface-container-high"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={currentUser.role === 'Visualizador'}
                  className="px-4 py-1.5 text-xs bg-primary text-on-primary font-semibold rounded cursor-pointer"
                >
                  {editingNorm ? "Salvar Alterações" : "Decretar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FAQ Registration modal */}
      {isFaqModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface-container border border-outline-variant w-full max-w-md max-h-full sm:max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-xl">
            <div className="bg-surface-container-high px-5 py-3 border-b border-outline-variant flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-on-surface">
                {editingFaq ? "Editar Pergunta Frequente" : "Cadastrar Pergunta Frequente"}
              </span>
              <button onClick={handleCloseFaqModal} className="text-on-surface-variant hover:text-on-surface">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFaq} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase block">Dúvida Recorrente</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Qual o rito para repactuação?"
                  value={newFaqPerg}
                  onChange={e => setNewFaqPerg(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase block">Resposta da Diretoria / Fiscalização</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Discorra a resposta conforme orientações técnicas..."
                  value={newFaqResp}
                  onChange={e => setNewFaqResp(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleCloseFaqModal}
                  className="px-3 py-1.5 text-xs border border-outline-variant rounded text-on-surface-variant hover:bg-surface-container-high"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={currentUser.role === 'Visualizador'}
                  className="px-4 py-1.5 text-xs bg-primary text-on-primary font-semibold rounded cursor-pointer hover:brightness-110"
                >
                  {editingFaq ? "Salvar FAQ" : "Registrar FAQ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
