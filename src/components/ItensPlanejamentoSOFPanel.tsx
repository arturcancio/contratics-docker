import React, { useState, useMemo } from 'react';
import { ItemPlanejamentoSOF, Planejamento, User } from '../types';
import { formatCurrency, parseMonetaryValue, sortAndGroupItems } from '../utils';
import { Plus, Edit, Trash2, X, AlertCircle, AlertOctagon } from 'lucide-react';
import { CopyButton } from './CopyButton';
import { CurrencyInput } from './CurrencyInput';

interface ItensPlanejamentoSOFPanelProps {
  planejamento: Planejamento;
  itensPlanejamentoSOF: ItemPlanejamentoSOF[];
  currentUser: User;
  onAddItem: (item: ItemPlanejamentoSOF) => void;
  onEditItem: (item: ItemPlanejamentoSOF) => void;
  onDeleteItem: (id: string) => void;
}

export default function ItensPlanejamentoSOFPanel({
  planejamento,
  itensPlanejamentoSOF,
  currentUser,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: ItensPlanejamentoSOFPanelProps) {
  const [isOpenFormModal, setIsOpenFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ItemPlanejamentoSOF | null>(null);

  const [formData, setFormData] = useState({
    Numero_Item: '',
    Grupo_Lote: '',
    Descricao_Item: '',
    Unidade_Medida: '',
    Quantidade: 1,
    Valor_Unitario: 0,
    Status_Item: 'Ativo' as 'Ativo' | 'Cancelado',
    Natureza_Despesa: 'Custeio' as 'Custeio' | 'Investimento',
    Natureza_Objeto: 'Serviço' as 'Bem' | 'Serviço',
    GND: '3 - Custeio' as '3 - Custeio' | '4 - Investimento',
  });

  const groupedItems = useMemo(() => {
    const rawItems = (itensPlanejamentoSOF || []).filter(i => i.Processo_SEI === planejamento.SEI_Processo);
    return sortAndGroupItems(rawItems);
  }, [itensPlanejamentoSOF, planejamento.SEI_Processo]);

  const activeItems = useMemo(() => {
    return groupedItems.map(g => g.item);
  }, [groupedItems]);

  const totalCalculated = activeItems
    .filter(i => i.Status_Item === 'Ativo')
    .reduce((sum, current) => sum + current.Quantidade * current.Valor_Unitario, 0);

  const totalCusteio = activeItems
    .filter(i => i.Status_Item === 'Ativo' && (i.GND === '3 - Custeio' || i.Natureza_Despesa === 'Custeio' || !i.Natureza_Despesa))
    .reduce((sum, current) => sum + current.Quantidade * current.Valor_Unitario, 0);

  const totalInvestimento = activeItems
    .filter(i => i.Status_Item === 'Ativo' && (i.GND === '4 - Investimento' || i.Natureza_Despesa === 'Investimento'))
    .reduce((sum, current) => sum + current.Quantidade * current.Valor_Unitario, 0);

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setCurrentItemId(null);
    setFormData({
      Numero_Item: (activeItems.length + 1).toString().padStart(2, '0'),
      Grupo_Lote: 'Lote 1',
      Descricao_Item: '',
      Unidade_Medida: 'Unidade',
      Quantidade: 1,
      Valor_Unitario: 0,
      Status_Item: 'Ativo',
      Natureza_Despesa: 'Custeio',
      Natureza_Objeto: 'Serviço',
      GND: '3 - Custeio',
    });
    setIsOpenFormModal(true);
  };

  const handleOpenEditModal = (item: ItemPlanejamentoSOF) => {
    setIsEditing(true);
    setCurrentItemId(item.id);
    setFormData({
      Numero_Item: item.Numero_Item,
      Grupo_Lote: item.Grupo_Lote || '',
      Descricao_Item: item.Descricao_Item,
      Unidade_Medida: item.Unidade_Medida,
      Quantidade: item.Quantidade,
      Valor_Unitario: item.Valor_Unitario,
      Status_Item: item.Status_Item,
      Natureza_Despesa: item.Natureza_Despesa || 'Custeio',
      Natureza_Objeto: item.Natureza_Objeto || 'Serviço',
      GND: item.GND || (item.Natureza_Despesa === 'Investimento' ? '4 - Investimento' : '3 - Custeio'),
    });
    setIsOpenFormModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.Numero_Item || !formData.Descricao_Item || formData.Valor_Unitario < 0) {
      alert('Por favor, preencha todos os campos obrigatórios corretamente.');
      return;
    }

    if (isEditing && currentItemId) {
      const updated: ItemPlanejamentoSOF = {
        id: currentItemId,
        Processo_SEI: planejamento.SEI_Processo,
        Numero_Item: formData.Numero_Item,
        Grupo_Lote: formData.Grupo_Lote,
        Descricao_Item: formData.Descricao_Item,
        Unidade_Medida: formData.Unidade_Medida,
        Quantidade: Number(formData.Quantidade),
        Valor_Unitario: Number(formData.Valor_Unitario),
        Status_Item: formData.Status_Item,
        Natureza_Despesa: formData.GND === '4 - Investimento' ? 'Investimento' : 'Custeio',
        Natureza_Objeto: formData.Natureza_Objeto,
        GND: formData.GND,
      };
      onEditItem(updated);
    } else {
      const created: ItemPlanejamentoSOF = {
        id: `plan-sof-${Date.now()}`,
        Processo_SEI: planejamento.SEI_Processo,
        Numero_Item: formData.Numero_Item,
        Grupo_Lote: formData.Grupo_Lote,
        Descricao_Item: formData.Descricao_Item,
        Unidade_Medida: formData.Unidade_Medida,
        Quantidade: Number(formData.Quantidade),
        Valor_Unitario: Number(formData.Valor_Unitario),
        Status_Item: 'Ativo',
        Natureza_Despesa: formData.GND === '4 - Investimento' ? 'Investimento' : 'Custeio',
        Natureza_Objeto: formData.Natureza_Objeto,
        GND: formData.GND,
      };
      onAddItem(created);
    }
    setIsOpenFormModal(false);
  };

  const handleDeleteConfirmClick = () => {
    if (itemToDelete) {
      onDeleteItem(itemToDelete.id);
      setItemToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-on-surface">Detalhamento Físico-Financeiro dos Itens (SOF)</h4>
            {planejamento.SEI_Processo && (
              <div className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded text-xs font-mono">
                <span className="text-primary font-bold">{planejamento.SEI_Processo}</span>
                <CopyButton text={planejamento.SEI_Processo} label="Processo SEI" />
              </div>
            )}
          </div>
          <p className="text-[10px] text-on-surface-variant leading-relaxed">
            Cadastre os itens da SOF estimados neste planejamento para comparar com os valores adjudicados finais após a licitação.
          </p>
        </div>
        {currentUser.role !== 'Visualizador' ? (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-xs text-primary rounded-lg transition-all cursor-pointer font-semibold shrink-0"
          >
            <Plus className="w-4 h-4" />
            Adicionar Item SOF
          </button>
        ) : (
          <div className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg font-semibold shrink-0">
            ⚠️ Modo Leitura (Altere o perfil para "Artur Câncio" no topo para cadastrar ou editar)
          </div>
        )}
      </div>

      {/* Summary Box */}
      <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans">
        <div className="space-y-1">
          <span className="text-[10px] text-primary uppercase font-bold tracking-wider block">CONTA SOMA DOS ITENS SOF CADASTRADOS</span>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {activeItems.length > 0 ? (
              <span>
                Soma ativa dos itens cadastrados: <strong className="text-primary font-mono text-sm">{formatCurrency(totalCalculated)}</strong>.
                <span className="block mt-1 text-[11px] text-on-surface-variant">
                  Detalhamento por Natureza: <strong className="text-blue-500 font-mono">Custeio: {formatCurrency(totalCusteio)}</strong> | <strong className="text-purple-500 font-mono font-bold">Investimento: {formatCurrency(totalInvestimento)}</strong>
                </span>
              </span>
            ) : (
              <span>Nenhum item SOF cadastrado ainda. O sistema utilizará a Estimativa Bruta de Custo do Processo: <strong className="text-on-surface font-mono text-sm">{formatCurrency(planejamento.Estimativa_Custo || 0)}</strong>.</span>
            )}
          </p>
        </div>
        <div className="shrink-0 bg-surface-container border border-outline-variant/30 rounded-lg p-2.5 text-center min-w-[120px]">
          <span className="text-[9px] text-on-surface-variant block select-none uppercase font-bold">Valor Consolidado</span>
          <span className="text-sm font-mono font-bold text-primary">{formatCurrency(activeItems.length > 0 ? totalCalculated : (planejamento.Estimativa_Custo || 0))}</span>
        </div>
      </div>

      {/* Table/List */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        {activeItems.length === 0 ? (
          <div className="p-10 text-center text-xs text-on-surface-variant italic">
            Nenhum item SOF orçado ou cadastrado para este planejamento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant">
                  <th className="px-4 py-2.5 text-center text-[10px] border-r border-outline-variant/20 font-semibold uppercase tracking-wider">Grupo</th>
                  <th className="px-4 py-2.5 font-mono text-[10px]">Item</th>
                  <th className="px-4 py-2.5 text-[10px]">Descrição Físico-Financeira Estimada</th>
                  <th className="px-4 py-2.5 text-[10px]">Unidade</th>
                  <th className="px-4 py-2.5 text-right text-[10px]">Qtd</th>
                  <th className="px-4 py-2.5 text-right text-[10px]">Vlr Est. Unitário</th>
                  <th className="px-4 py-2.5 text-right text-[10px]">Valor Est. Total</th>
                  <th className="px-4 py-2.5 text-center text-[10px]">Objeto</th>
                  <th className="px-4 py-2.5 text-center text-[10px]">Grupo (GND)</th>
                  <th className="px-4 py-2.5 text-center text-[10px]">Situação</th>
                  {currentUser.role !== 'Visualizador' && <th className="px-4 py-2.5 text-right text-[10px]">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {groupedItems.map(row => {
                  const item = row.item;
                  return (
                    <tr key={item.id} className="hover:bg-surface-container/10 transition-colors">
                      {row.isFirstInGroup && (
                        <td 
                          rowSpan={row.groupRowCount} 
                          className="px-4 py-3 text-center font-bold text-on-surface bg-surface-container-low/40 border-r border-outline-variant/20 align-middle select-none"
                        >
                          <span className="inline-block px-2.5 py-1 rounded-md bg-surface-container-highest/80 border border-outline-variant/50 text-primary font-mono text-[11px] font-bold shadow-xs">
                            {row.groupLabel}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono font-bold text-on-surface">{item.Numero_Item}</td>
                      <td className="px-4 py-3 font-medium text-on-surface">{item.Descricao_Item}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{item.Unidade_Medida}</td>
                      <td className="px-4 py-3 text-right font-mono font-medium">{item.Quantidade}</td>
                      <td className="px-4 py-3 text-right font-mono font-medium">{formatCurrency(item.Valor_Unitario)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                        {formatCurrency(item.Quantidade * item.Valor_Unitario)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-1.5 py-0.25 rounded text-[9px] font-bold uppercase ${
                          item.Natureza_Objeto === 'Bem'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                        }`}>
                          {item.Natureza_Objeto || 'Serviço'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            const newGND = item.GND === '4 - Investimento' ? '3 - Custeio' : '4 - Investimento';
                            onEditItem({ ...item, GND: newGND, Natureza_Despesa: newGND === '4 - Investimento' ? 'Investimento' : 'Custeio' });
                          }}
                          className={`inline-block px-1.5 py-0.25 rounded text-[9px] font-bold uppercase transition-all duration-150 cursor-pointer active:scale-95 ${
                            item.GND === '4 - Investimento' || item.Natureza_Despesa === 'Investimento'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/35 hover:border-purple-500/50'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/35 hover:border-blue-500/50'
                          }`}
                          title="Clique para alternar rapidamente entre Custeio e Investimento"
                        >
                          {item.GND || (item.Natureza_Despesa === 'Investimento' ? '4 - Investimento' : '3 - Custeio')}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            const newStatus = item.Status_Item === 'Ativo' ? 'Cancelado' : 'Ativo';
                            onEditItem({ ...item, Status_Item: newStatus });
                          }}
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold transition-all duration-150 cursor-pointer active:scale-95 ${
                            item.Status_Item === 'Ativo'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 hover:bg-emerald-500/20 hover:border-emerald-500/40'
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/25 hover:bg-rose-500/20 hover:border-rose-500/40 font-semibold line-through'
                          }`}
                          title="Clique para alternar rapidamente a situação do item"
                        >
                          {item.Status_Item}
                        </button>
                      </td>
                      {currentUser.role !== 'Visualizador' && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                              title="Editar Item"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setItemToDelete(item)}
                              className="p-1 text-on-surface-variant hover:text-rose-500 transition-colors cursor-pointer"
                              title="Excluir Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog Form */}
      {isOpenFormModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-low border border-outline shadow-2xl rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-surface-container border-b border-outline-variant px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-on-surface uppercase tracking-wide">
                {isEditing ? 'Editar Item SOF de Planejamento' : 'Novo Item SOF de Planejamento'}
              </h3>
              <button
                onClick={() => setIsOpenFormModal(false)}
                className="p-1 rounded-full hover:bg-outline-variant/30 text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Número do Item *</label>
                  <input
                    type="text"
                    required
                    value={formData.Numero_Item}
                    onChange={e => setFormData({ ...formData, Numero_Item: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary font-mono text-center animate-pulse"
                    placeholder="Ex: 01"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Grupo / Lote</label>
                  <input
                    type="text"
                    value={formData.Grupo_Lote}
                    onChange={e => setFormData({ ...formData, Grupo_Lote: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Ex: Lote 1"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Descrição Detalhada do Item *</label>
                <textarea
                  required
                  rows={3}
                  value={formData.Descricao_Item}
                  onChange={e => setFormData({ ...formData, Descricao_Item: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  placeholder="Ex: Licença anual para uso do Banco de Dados..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Unidade de Medida *</label>
                  <input
                    type="text"
                    required
                    value={formData.Unidade_Medida}
                    onChange={e => setFormData({ ...formData, Unidade_Medida: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Ex: Licença / Ano"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Natureza do Objeto *</label>
                  <select
                    value={formData.Natureza_Objeto}
                    onChange={e => setFormData({ ...formData, Natureza_Objeto: e.target.value as any })}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                  >
                    <option value="Serviço">Serviço</option>
                    <option value="Bem">Bem</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Grupo de Natureza (GND) *</label>
                  <select
                    value={formData.GND}
                    onChange={e => setFormData({ ...formData, GND: e.target.value as any, Natureza_Despesa: e.target.value === '4 - Investimento' ? 'Investimento' : 'Custeio' })}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                  >
                    <option value="3 - Custeio">3 - Custeio</option>
                    <option value="4 - Investimento">4 - Investimento</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Situação *</label>
                  <select
                    value={formData.Status_Item}
                    onChange={e => setFormData({ ...formData, Status_Item: e.target.value as any })}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                  >
                    <option value="Ativo" className="text-emerald-500 font-bold">Ativo</option>
                    <option value="Cancelado" className="text-rose-500 font-bold">Cancelado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Quantidade *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.Quantidade}
                    onChange={e => setFormData({ ...formData, Quantidade: Math.max(1, parseInt(e.target.value) || 0) })}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary font-mono text-right"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Valor Est. Unitário *</label>
                  <CurrencyInput
                    required
                    placeholder="0,00"
                    showPreview={false}
                    value={formData.Valor_Unitario}
                    onChange={val => setFormData({ ...formData, Valor_Unitario: Math.max(0, val) })}
                  />
                </div>
              </div>

              {/* Subtotal Preview */}
              <div className="p-3 bg-surface-container rounded-lg flex justify-between items-center border border-outline-variant/35 text-[11px]">
                <span className="font-semibold text-on-surface-variant uppercase">Subtotal do Item:</span>
                <span className="font-mono font-extrabold text-primary text-sm">
                  {formatCurrency(formData.Quantidade * formData.Valor_Unitario)}
                </span>
              </div>

              <div className="pt-2 border-t border-outline-variant/30 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsOpenFormModal(false)}
                  className="px-4 py-2 border border-outline rounded-lg text-xs hover:bg-surface-container hover:text-on-surface transition-all cursor-pointer font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-primary/30 rounded-lg text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-all cursor-pointer font-bold"
                >
                  Confirmar Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for delete */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-surface-container border border-outline-variant w-full max-w-md rounded-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="bg-rose-500/10 px-5 py-4 border-b border-rose-500/20 flex items-center gap-3">
              <AlertOctagon className="w-5 h-5 text-rose-500 shrink-0" />
              <span className="font-bold text-rose-500 font-sans text-sm">Excluir Item do Planejamento</span>
            </div>
            
            <div className="p-5 space-y-4 font-sans text-xs">
              <p className="text-on-surface leading-relaxed text-left">
                Tem certeza de que deseja excluir o Item <strong className="font-mono">{itemToDelete.Numero_Item}</strong> (&quot;{itemToDelete.Descricao_Item}&quot;)? Esse item faz parte do planejamento físico-financeiro orçamentário.
              </p>
              
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="px-4 py-2 font-semibold rounded-lg bg-surface-container-high border border-outline-variant hover:bg-surface-container-highest text-on-surface transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirmClick}
                  className="px-4 py-2 font-bold rounded-lg bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/10 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
