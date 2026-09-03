/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Copy, 
  ChevronDown, 
  Check, 
  FileText, 
  TrendingUp, 
  ArrowRightLeft, 
  Layers, 
  Info,
  Calendar,
  X
} from 'lucide-react';
import { DescentralizacaoItem, NotaEmpenhoItem } from '../types';
import { formatCurrency, parseMonetaryValue } from '../utils';
import { CurrencyInput } from './CurrencyInput';

export interface AvailableEmpenho {
  numero: string;
  sei?: string;
  valor?: number;
}

interface DescentralizacaoManagerProps {
  descentralizacoes: DescentralizacaoItem[];
  onChange: (items: DescentralizacaoItem[]) => void;
  availableEmpenhos: AvailableEmpenho[];
  onAddEmpenho?: (empenho: AvailableEmpenho) => void;
  valorOS?: number;
  readOnly?: boolean;
}

export const DescentralizacaoManager: React.FC<DescentralizacaoManagerProps> = ({
  descentralizacoes,
  onChange,
  availableEmpenhos,
  onAddEmpenho,
  valorOS = 0,
  readOnly = false
}) => {
  // Dropdown open state for each item by index or ID
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [newEmpenhoNumero, setNewEmpenhoNumero] = useState<string>('');
  const [newEmpenhoSei, setNewEmpenhoSei] = useState<string>('');
  const [newEmpenhoValor, setNewEmpenhoValor] = useState<number>(0);
  const [showAddEmpenhoForm, setShowAddEmpenhoForm] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
        setShowAddEmpenhoForm(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ensure at least one item if list is completely empty
  const items: DescentralizacaoItem[] = descentralizacoes && descentralizacoes.length > 0 
    ? descentralizacoes 
    : [{
        id: `desc-${Date.now()}-1`,
        processoSei: '',
        valor: 0,
        descricao: '',
        data: '',
        empenhosNumeros: []
      }];

  const handleUpdateItem = (id: string, updates: Partial<DescentralizacaoItem>) => {
    if (readOnly) return;
    const updated = items.map(item => item.id === id ? { ...item, ...updates } : item);
    onChange(updated);
  };

  const handleAddItem = () => {
    if (readOnly) return;
    const newItem: DescentralizacaoItem = {
      id: `desc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      processoSei: '',
      valor: 0,
      descricao: '',
      data: new Date().toISOString().split('T')[0],
      empenhosNumeros: []
    };
    onChange([...items, newItem]);
  };

  const handleDuplicateItem = (sourceItem: DescentralizacaoItem) => {
    if (readOnly) return;
    const duplicated: DescentralizacaoItem = {
      id: `desc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      processoSei: sourceItem.processoSei || '',
      valor: sourceItem.valor || 0,
      descricao: sourceItem.descricao ? `${sourceItem.descricao} (Nova Parcela)` : '',
      data: new Date().toISOString().split('T')[0],
      empenhosNumeros: sourceItem.empenhosNumeros ? [...sourceItem.empenhosNumeros] : []
    };
    onChange([...items, duplicated]);
  };

  const handleRemoveItem = (id: string) => {
    if (readOnly) return;
    if (items.length === 1) {
      // Clear the single item instead of removing
      onChange([{
        id: `desc-${Date.now()}-1`,
        processoSei: '',
        valor: 0,
        descricao: '',
        data: '',
        empenhosNumeros: []
      }]);
      return;
    }
    onChange(items.filter(item => item.id !== id));
  };

  const toggleEmpenhoLink = (itemId: string, empenhoNumero: string) => {
    if (readOnly) return;
    const targetItem = items.find(i => i.id === itemId);
    if (!targetItem) return;

    const currentLinks = targetItem.empenhosNumeros || [];
    const exists = currentLinks.includes(empenhoNumero);
    const updatedLinks = exists 
      ? currentLinks.filter(num => num !== empenhoNumero)
      : [...currentLinks, empenhoNumero];

    handleUpdateItem(itemId, { empenhosNumeros: updatedLinks });
  };

  const handleCreateAndLinkEmpenho = (itemId: string) => {
    const trimmedNum = newEmpenhoNumero.trim();
    if (!trimmedNum) return;

    const newEmp: AvailableEmpenho = {
      numero: trimmedNum,
      sei: newEmpenhoSei.trim() || undefined,
      valor: newEmpenhoValor > 0 ? newEmpenhoValor : undefined
    };

    if (onAddEmpenho) {
      onAddEmpenho(newEmp);
    }

    // Link it immediately
    const targetItem = items.find(i => i.id === itemId);
    if (targetItem) {
      const currentLinks = targetItem.empenhosNumeros || [];
      if (!currentLinks.includes(trimmedNum)) {
        handleUpdateItem(itemId, { empenhosNumeros: [...currentLinks, trimmedNum] });
      }
    }

    setNewEmpenhoNumero('');
    setNewEmpenhoSei('');
    setNewEmpenhoValor(0);
    setShowAddEmpenhoForm(false);
  };

  const totalDescentralizado = items.reduce((sum, item) => sum + (item.valor || 0), 0);
  const percentualOS = valorOS > 0 ? Math.min(100, (totalDescentralizado / valorOS) * 100) : 0;
  const saldoPendente = Math.max(0, valorOS - totalDescentralizado);

  return (
    <div className="space-y-4">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container/60 border border-outline-variant/50 rounded-xl p-3.5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wide">
                Repasses & Parcelas de Descentralização ({items.length})
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-sky-500/10 text-sky-300 border border-sky-500/30">
                MPO ➜ MGI
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Total acumulado: <strong className="font-mono text-sky-400 font-bold">{formatCurrency(totalDescentralizado)}</strong>
              {valorOS > 0 && (
                <span className="ml-1.5 text-on-surface-variant font-mono">
                  ({percentualOS.toFixed(1)}% do valor da OS)
                </span>
              )}
            </p>
          </div>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold shadow transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              + Adicionar Descentralização / Parcela
            </button>
          </div>
        )}
      </div>

      {/* List of Descentralização Cards */}
      <div className="space-y-3.5">
        {items.map((item, index) => {
          const linkedEmpenhos = item.empenhosNumeros || [];
          const isDropdownOpen = openDropdownId === item.id;

          return (
            <div 
              key={item.id} 
              className="bg-surface-container-low border border-outline-variant rounded-xl p-4 space-y-3 transition-all hover:border-sky-500/40 relative shadow-sm"
            >
              {/* Item Header */}
              <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-sky-500/20 text-sky-300 text-[11px] font-bold font-mono">
                    {index + 1}
                  </span>
                  <h6 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                    Descentralização #{index + 1}
                  </h6>
                  {item.valor > 0 && (
                    <span className="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                      {formatCurrency(item.valor)}
                    </span>
                  )}
                  {linkedEmpenhos.length > 0 && (
                    <span className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-mono hidden sm:inline-flex items-center gap-1">
                      <FileText className="w-3 h-3 text-amber-400" />
                      {linkedEmpenhos.length} Empenho(s) Vinculado(s)
                    </span>
                  )}
                </div>

                {!readOnly && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDuplicateItem(item)}
                      className="p-1.5 text-on-surface-variant hover:text-sky-300 hover:bg-sky-500/10 rounded transition-colors cursor-pointer"
                      title="Duplicar esta descentralização (Nova Parcela)"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1.5 text-on-surface-variant hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                      title="Remover esta descentralização"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 font-sans">
                {/* Field 1: Nº SEI Processo */}
                <div className="md:col-span-4">
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1 font-mono">
                    Nº SEI do Processo de Descentralização
                  </label>
                  <input
                    type="text"
                    disabled={readOnly}
                    placeholder="Ex: 10180.100452/2026-11"
                    value={item.processoSei || ''}
                    onChange={(e) => handleUpdateItem(item.id, { processoSei: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-sky-400 font-mono disabled:opacity-50"
                  />
                </div>

                {/* Field 2: Valor Descentralizado */}
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1 font-sans">
                    Valor Descentralizado / Repassado (R$)
                  </label>
                  <CurrencyInput
                    disabled={readOnly}
                    placeholder="0,00"
                    className="text-sky-300 font-semibold"
                    value={item.valor || 0}
                    onChange={(val) => handleUpdateItem(item.id, { valor: val })}
                  />
                </div>

                {/* Field 3: Data da Descentralização */}
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1 font-mono">
                    Data do Repasse
                  </label>
                  <input
                    type="date"
                    disabled={readOnly}
                    value={item.data || ''}
                    onChange={(e) => handleUpdateItem(item.id, { data: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant rounded px-2 py-1.5 text-xs text-on-surface focus:outline-none focus:border-sky-400 font-mono disabled:opacity-50"
                  />
                </div>

                {/* Field 4: Dropdown Menu para Vincular Empenho(s) */}
                <div className="md:col-span-3 relative" ref={isDropdownOpen ? dropdownRef : undefined}>
                  <label className="block text-[10px] font-semibold text-amber-300/90 uppercase mb-1 flex items-center justify-between">
                    <span>Empenho(s) Vinculado(s)</span>
                    <span className="text-[9px] text-on-surface-variant font-mono lowercase">mgi / gestor</span>
                  </label>

                  {/* Trigger Button */}
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => {
                      setOpenDropdownId(isDropdownOpen ? null : item.id);
                      setShowAddEmpenhoForm(false);
                    }}
                    className="w-full min-h-[33px] bg-surface-container border border-outline-variant hover:border-amber-400/50 rounded px-2.5 py-1.5 text-xs text-left flex items-center justify-between gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex-1 flex flex-wrap gap-1 items-center overflow-hidden">
                      {linkedEmpenhos.length === 0 ? (
                        <span className="text-on-surface-variant/70 italic text-[11px]">
                          Vincular a Empenho(s)...
                        </span>
                      ) : (
                        linkedEmpenhos.map(num => (
                          <span
                            key={num}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold text-[10px]"
                          >
                            {num}
                            {!readOnly && (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleEmpenhoLink(item.id, num);
                                }}
                                className="hover:text-rose-300 ml-0.5 cursor-pointer"
                              >
                                ×
                              </span>
                            )}
                          </span>
                        ))
                      )}
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-on-surface-variant shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180 text-amber-400' : ''}`} />
                  </button>

                  {/* Dropdown Floating Menu */}
                  {isDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-surface-container-high border border-outline shadow-2xl rounded-xl p-3 z-50 space-y-2.5 min-w-[280px] animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between pb-1.5 border-b border-outline-variant">
                        <span className="text-[11px] uppercase font-bold text-on-surface">
                          Selecionar Empenho(s) da SOF / MGI
                        </span>
                        <button
                          type="button"
                          onClick={() => setOpenDropdownId(null)}
                          className="text-on-surface-variant hover:text-on-surface p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* List of Available Empenhos */}
                      <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                        {availableEmpenhos.length === 0 ? (
                          <div className="p-2 text-center text-on-surface-variant text-[11px] italic">
                            Nenhum empenho cadastrado previamente. Digite o número abaixo para cadastrar e vincular.
                          </div>
                        ) : (
                          availableEmpenhos.map(emp => {
                            const isSelected = linkedEmpenhos.includes(emp.numero);
                            return (
                              <button
                                key={emp.numero}
                                type="button"
                                onClick={() => toggleEmpenhoLink(item.id, emp.numero)}
                                className={`w-full text-left p-2 rounded-lg text-xs font-sans transition-all flex items-start gap-2 cursor-pointer border ${
                                  isSelected 
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-200' 
                                    : 'hover:bg-surface-container border-transparent text-on-surface'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 transition-colors ${
                                  isSelected ? 'bg-amber-500 border-amber-400 text-black' : 'border-outline-variant bg-surface'
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-mono font-bold flex items-center justify-between gap-1">
                                    <span className="truncate">{emp.numero}</span>
                                    {emp.valor && emp.valor > 0 && (
                                      <span className="text-[10px] text-amber-300 font-normal shrink-0">
                                        {formatCurrency(emp.valor)}
                                      </span>
                                    )}
                                  </div>
                                  {emp.sei && (
                                    <div className="text-[10px] text-on-surface-variant font-mono truncate">
                                      SEI: {emp.sei}
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>

                      {/* Quick Add Custom Empenho Inline */}
                      <div className="pt-2 border-t border-outline-variant/60">
                        {!showAddEmpenhoForm ? (
                          <button
                            type="button"
                            onClick={() => setShowAddEmpenhoForm(true)}
                            className="w-full py-1.5 px-2 bg-surface hover:bg-surface-container text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            + Cadastrar / Vincular Outro Empenho
                          </button>
                        ) : (
                          <div className="space-y-2 bg-surface p-2 rounded-lg border border-amber-500/40">
                            <span className="text-[10px] uppercase font-bold text-amber-300 block">
                              Novo Empenho (NE)
                            </span>
                            <input
                              type="text"
                              placeholder="Ex: 2026NE000145"
                              value={newEmpenhoNumero}
                              onChange={(e) => setNewEmpenhoNumero(e.target.value)}
                              className="w-full bg-surface-container border border-outline rounded px-2 py-1 text-xs font-mono text-on-surface focus:outline-none focus:border-amber-400"
                            />
                            <div className="grid grid-cols-2 gap-1.5">
                              <input
                                type="text"
                                placeholder="Nº SEI (opcional)"
                                value={newEmpenhoSei}
                                onChange={(e) => setNewEmpenhoSei(e.target.value)}
                                className="w-full bg-surface-container border border-outline rounded px-2 py-1 text-[11px] font-mono text-on-surface"
                              />
                              <CurrencyInput
                                placeholder="Valor R$ (opc.)"
                                className="text-[11px]"
                                value={newEmpenhoValor}
                                onChange={(val) => setNewEmpenhoValor(val)}
                              />
                            </div>
                            <div className="flex justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => setShowAddEmpenhoForm(false)}
                                className="px-2 py-1 text-[10px] text-on-surface-variant hover:text-on-surface rounded cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCreateAndLinkEmpenho(item.id)}
                                className="px-2.5 py-1 text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-black rounded shadow cursor-pointer"
                              >
                                Adicionar e Vincular
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Field 5: Descrição / Memorial de Cálculo */}
                <div className="md:col-span-12">
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase mb-1 font-sans">
                    Descrição / Memorial de Cálculo da Parcela
                  </label>
                  <textarea
                    disabled={readOnly}
                    placeholder="Descrever a parcela orçamentária (ex: Parcela referente à execução do mês 01/2026), nota de descentralização fiscal do MPO..."
                    value={item.descricao || ''}
                    onChange={(e) => handleUpdateItem(item.id, { descricao: e.target.value })}
                    rows={2}
                    className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-sky-400 resize-none font-sans disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div className="p-3 bg-surface-container-low border border-outline-variant/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <Info className="w-4 h-4 text-sky-400 shrink-0" />
          <span>
            {items.length === 1 
              ? '1 descentralização orçamentária cadastrada.' 
              : `${items.length} descentralizações orçamentárias cadastradas para esta Ordem de Serviço.`}
          </span>
        </div>

        <div className="flex items-center gap-4 ml-auto">
          {valorOS > 0 && saldoPendente > 0 && (
            <div className="text-[11px] text-amber-300 font-mono">
              Saldo Restante a Descentralizar: <strong>{formatCurrency(saldoPendente)}</strong>
            </div>
          )}
          <div className="font-mono text-xs">
            <span className="text-on-surface-variant uppercase text-[10px] font-bold mr-1.5">Total Repassado:</span>
            <strong className="text-sm font-bold text-sky-400">{formatCurrency(totalDescentralizado)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
