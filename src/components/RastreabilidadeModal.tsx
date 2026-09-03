import React from 'react';
import { 
  DFD, 
  Planejamento, 
  Contrato, 
  ItemContratoSOF, 
  ItemPlanejamentoSOF,
  TermoAditivo, 
  TermoApostilamento, 
  Pagamento, 
  Fornecedor 
} from '../types';
import { formatCurrency, formatDate, sortOrdensServico, sortAndGroupItems } from '../utils';
import { 
  X, 
  Download, 
  Shuffle, 
  FileText, 
  Briefcase, 
  TrendingUp, 
  CheckCircle2, 
  ArrowRight,
  FileSpreadsheet,
  AlertTriangle,
  MapPin,
  Clock,
  DollarSign
} from 'lucide-react';

interface RastreabilidadeModalProps {
  isOpen?: boolean;
  onClose: () => void;
  itemId: string;
  itemType: 'dfd' | 'planejamento' | 'contrato';
  dfds: DFD[];
  planejamentos: Planejamento[];
  contratos: Contrato[];
  fornecedores?: Fornecedor[];
  itensSOF: ItemContratoSOF[];
  itensPlanejamentoSOF?: ItemPlanejamentoSOF[];
  aditivos: TermoAditivo[];
  apostilamentos: TermoApostilamento[];
  pagamentos: Pagamento[];
  currentLocalTime?: string;
}

export default function RastreabilidadeModal({
  isOpen = true,
  onClose,
  itemId,
  itemType,
  dfds,
  planejamentos,
  contratos,
  fornecedores = [],
  itensSOF,
  itensPlanejamentoSOF = [],
  aditivos,
  apostilamentos,
  pagamentos,
  currentLocalTime = new Date().toISOString()
}: RastreabilidadeModalProps) {
  if (!isOpen) return null;

  // Dynamic calculation helpers
  const getPlanningCusto = (p: Planejamento) => {
    const items = (itensPlanejamentoSOF || []).filter(i => i.Processo_SEI === p.SEI_Processo && i.Status_Item === 'Ativo');
    if (items.length > 0) {
      return items.reduce((acc, current) => acc + (current.Quantidade * current.Valor_Unitario), 0);
    }
    return p.Estimativa_Custo || 0;
  };

  const calculateValorAnualItemsSOF = (id: string, initialMonths: number) => {
    const targetContrato = (contratos || []).find(c => c.id === id || c.Num_Contrato === id);
    const totalSOFItemsVal = itensSOF
      .filter(i => (i.Num_Contrato === id || (targetContrato && i.Num_Contrato === targetContrato.Num_Contrato)) && i.Status_Item === 'Ativo')
      .reduce((sum, current) => sum + (current.Quantidade * current.Valor_Unitario), 0);
    
    if (targetContrato?.Periodicidade_Pagamento === 'Total') {
      return totalSOFItemsVal;
    }

    const meses = initialMonths || 12;
    return (totalSOFItemsVal / meses) * 12;
  };

  // Reconcile and resolve the full lineage
  let resolvedDfd: DFD | null = null;
  let resolvedPlan: Planejamento | null = null;
  let resolvedContrato: Contrato | null = null;

  if (itemType === 'dfd') {
    resolvedDfd = dfds.find(d => d.id === itemId) || null;
    if (resolvedDfd) {
      // Find matching planning by:
      // 1. Planejamento_Vinculado reference
      // 2. Or by comparing DFD's Num_DFD with plan's DFD_PNCP (exact comparison)
      resolvedPlan = planejamentos.find(p => 
        p.id === resolvedDfd!.Planejamento_Vinculado || 
        (p.DFD_PNCP && p.DFD_PNCP.toLowerCase().trim() === resolvedDfd!.Num_DFD.toLowerCase().trim())
      ) || null;
      
      if (resolvedPlan) {
        resolvedContrato = contratos.find(c => 
          c.id === resolvedPlan!.Contrato_Originado || 
          c.Num_Contrato === resolvedPlan!.Contrato_Originado ||
          (c.SEI_Processo && c.SEI_Processo.toLowerCase().trim() === resolvedPlan!.SEI_Processo.toLowerCase().trim())
        ) || null;
      }
    }
  } else if (itemType === 'planejamento') {
    resolvedPlan = planejamentos.find(p => p.id === itemId) || null;
    if (resolvedPlan) {
      resolvedDfd = dfds.find(d => 
        d.id === resolvedPlan!.id || // some times they match on id
        d.Planejamento_Vinculado === resolvedPlan!.id ||
        (d.Num_DFD && d.Num_DFD.toLowerCase().trim() === resolvedPlan!.DFD_PNCP.toLowerCase().trim())
      ) || null;

      resolvedContrato = contratos.find(c => 
        c.id === resolvedPlan!.Contrato_Originado || 
        c.Num_Contrato === resolvedPlan!.Contrato_Originado ||
        (c.SEI_Processo && c.SEI_Processo.toLowerCase().trim() === resolvedPlan!.SEI_Processo.toLowerCase().trim())
      ) || null;
    }
  } else if (itemType === 'contrato') {
    resolvedContrato = contratos.find(c => c.id === itemId) || null;
    if (resolvedContrato) {
      resolvedPlan = planejamentos.find(p => 
        p.Contrato_Originado === resolvedContrato!.id || 
        p.Contrato_Originado === resolvedContrato!.Num_Contrato ||
        (p.SEI_Processo && p.SEI_Processo.toLowerCase().trim() === resolvedContrato!.SEI_Processo.toLowerCase().trim())
      ) || null;

      if (resolvedPlan) {
        resolvedDfd = dfds.find(d => 
          d.id === resolvedPlan!.id || 
          d.Planejamento_Vinculado === resolvedPlan!.id ||
          (d.Num_DFD && d.Num_DFD.toLowerCase().trim() === resolvedPlan!.DFD_PNCP.toLowerCase().trim())
        ) || null;
      } else if (resolvedContrato.DFD_Vinculado) {
        resolvedDfd = dfds.find(d => d.id === resolvedContrato!.DFD_Vinculado) || null;
      }
    }
  }

  // Related data calculations
  const contractFornecedor = resolvedContrato 
    ? fornecedores.find(f => f.id === resolvedContrato!.Fornecedor) 
    : null;

  const contractItens = resolvedContrato 
    ? itensSOF.filter(i => i.Num_Contrato === resolvedContrato!.id || i.Num_Contrato === resolvedContrato!.Num_Contrato) 
    : [];

  const groupedContractItens = sortAndGroupItems(contractItens);

  const contractAditivos = resolvedContrato 
    ? aditivos.filter(a => a.Num_Contrato === resolvedContrato!.id || a.Num_Contrato === resolvedContrato!.Num_Contrato) 
    : [];

  const contractApostilamentos = resolvedContrato 
    ? apostilamentos.filter(a => a.Num_Contrato === resolvedContrato!.id || a.Num_Contrato === resolvedContrato!.Num_Contrato) 
    : [];

  const contractPagamentos = resolvedContrato 
    ? pagamentos.filter(p => p.Num_Contrato === resolvedContrato!.id || p.Num_Contrato === resolvedContrato!.Num_Contrato) 
    : [];

  const totalAditivado = contractAditivos.reduce((sum, a) => sum + (a.Valor_Aditivado || 0), 0);
  const totalApostilado = contractApostilamentos.reduce((sum, a) => sum + (a.Valor_do_Ajuste || 0), 0);
  const totalPagamentos = contractPagamentos.reduce((sum, p) => sum + (p.Valor || 0), 0);

  // Compute total OS execution if vorhanden (sorted chronologically by Vigência Ref)
  const OSList = sortOrdensServico(resolvedContrato?.ordensServico || [], 'asc');
  const totalOSValue = OSList.reduce((sum, os) => sum + (os.valor || 0), 0);
  const totalOSEmpenhado = OSList.reduce((sum, os) => sum + (os.valorEmpenho || 0), 0);
  const totalOSGlosas = OSList.reduce((sum, os) => {
    if (os.trdGlosa) {
      return sum + os.trdGlosa;
    }
    return sum;
  }, 0);

  const contractSOFItemsTotal = contractItens
    .filter(i => i.Status_Item === 'Ativo')
    .reduce((sum, i) => sum + (i.Quantidade * i.Valor_Unitario), 0);

  const planTotalBudget = resolvedPlan ? getPlanningCusto(resolvedPlan) : 0;
  // Para a disputa/economicidade SOF, priorizamos os itens SOF do contrato se existirem, caso contrário usa o valor do contrato
  const contractDisputeValue = contractSOFItemsTotal > 0 ? contractSOFItemsTotal : (resolvedContrato ? resolvedContrato.Valor_Contrato : 0);
  const diffBudget = planTotalBudget - contractDisputeValue;
  const diffPercentage = planTotalBudget > 0 ? (Math.abs(diffBudget) / planTotalBudget) * 100 : 0;

  const resolvedContractAnnualValue = resolvedContrato 
    ? (itensSOF.some(i => i.Num_Contrato === resolvedContrato!.id && i.Status_Item === 'Ativo')
      ? calculateValorAnualItemsSOF(resolvedContrato.id, resolvedContrato.Vigencia_Inicial_Meses || 12)
      : (resolvedContrato.Valor_Anual_SOF || resolvedContrato.Valor_Contrato || 0))
    : 0;

  // Dynamically compute the updated contract value based on aditivos and apostilamentos
  let computedValorAtualizado = resolvedContrato ? resolvedContrato.Valor_Contrato : 0;
  if (resolvedContrato) {
    contractAditivos.forEach(ad => {
      if (ad.Tipo_Aditivo === 'Acréscimo') computedValorAtualizado += ad.Valor_Aditivado;
      if (ad.Tipo_Aditivo === 'Supressão') computedValorAtualizado -= ad.Valor_Aditivado;
    });
    contractApostilamentos.forEach(ap => {
      computedValorAtualizado += ap.Valor_do_Ajuste;
    });
  }

  // Print to PDF function
  const handleExportPDF = () => {
    const SOF_LOGO_SVG = `
      <svg width="220" height="70" viewBox="0 0 240 80" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
        <g transform="translate(10, 10)">
          <circle cx="30" cy="30" r="28" fill="#1E3A8A" />
          <path d="M 30,2 A 28,28 0 0,0 30,58 Z" stroke="#3B82F6" stroke-width="1.5" stroke-dasharray="2,2" opacity="0.6"/>
          <path d="M 12,12 A 28,28 0 0,0 48,12" stroke="#3B82F6" stroke-width="1.5" opacity="0.4"/>
          <path d="M 4,22 A 28,28 0 0,0 56,22" stroke="#3B82F6" stroke-width="1.5" opacity="0.5"/>
          <path d="M 2,30 A 28,28 0 0,0 58,30" stroke="#3B82F6" stroke-width="1.5" opacity="0.5"/>
          <path d="M 4,38 A 28,28 0 0,0 56,38" stroke="#3B82F6" stroke-width="1.5" opacity="0.5"/>
          <path d="M 12,48 A 28,28 0 0,0 48,48" stroke="#3B82F6" stroke-width="1.5" opacity="0.4"/>
          <path d="M 2,36 C 15,36 28,24 58,24 C 54,36 30,48 2,36 Z" fill="#22C55E" opacity="0.85" />
          <path d="M 2,33 C 15,33 28,21 58,21 C 56,25 35,37 2,33 Z" fill="#EAB308" />
          <polygon points="30,14 31.8,18 36,18 32.5,21.2 33.8,25.2 30,22.8 26.2,25.2 27.5,21.2 24,18 28.2,18" fill="#FFFFFF" />
        </g>
        <text x="80" y="44" font-family="'Inter', -apple-system, sans-serif" font-weight="800" font-size="34" fill="#1F2937" letter-spacing="-1">SOF</text>
        <text x="80" y="58" font-family="'Inter', -apple-system, sans-serif" font-weight="500" font-size="11" fill="#4B5563">Secretaria de</text>
        <text x="80" y="70" font-family="'Inter', -apple-system, sans-serif" font-weight="700" font-size="11" fill="#1E3A8A">Orçamento Federal</text>
      </svg>
    `;

    const htmlContent = `
      <html>
        <head>
          <title>Rastreabilidade da Contratação - SOF</title>
          <style>
            body {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              color: #0f172a;
              padding: 40px;
              margin: 0;
              background-color: #ffffff;
              line-height: 1.4;
            }
            .header {
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 12px;
              margin-bottom: 24px;
            }
            .header-top {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .logo-sec {
              display: flex;
              align-items: center;
              gap: 15px;
            }
            .logo-placeholder {
              flex-shrink: 0;
            }
            .title {
              font-size: 20px;
              font-weight: 800;
              color: #1e293b;
              margin: 0;
            }
            .subtitle {
              font-size: 11px;
              color: #64748b;
              margin: 4px 0 0 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .meta-val {
              font-size: 11px;
              color: #64748b;
              text-align: right;
              line-height: 1.5;
            }
            .flow-indicator {
              display: flex;
              justify-content: space-between;
              background-color: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 12px 20px;
              margin-bottom: 20px;
            }
            .flow-step {
              display: flex;
              align-items: center;
              font-size: 12px;
              font-weight: 700;
              color: #0f172a;
            }
            .flow-step.active {
              color: #0284c7;
            }
            .flow-step.inactive {
              color: #94a3b8;
              font-weight: 500;
            }
            .section-title {
              font-size: 13px;
              font-weight: 800;
              text-transform: uppercase;
              background-color: #f1f5f9;
              padding: 6px 12px;
              border-left: 4px solid #0284c7;
              margin-top: 24px;
              margin-bottom: 12px;
              color: #1e293b;
            }
            .details-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 12px;
              margin-bottom: 16px;
            }
            .detail-item {
              font-size: 11px;
              background-color: #fafafa;
              border: 1px solid #f1f5f9;
              padding: 8px;
              border-radius: 6px;
            }
            .detail-label {
              font-weight: bold;
              color: #475569;
              text-transform: uppercase;
              font-size: 9px;
              margin-bottom: 3px;
            }
            .detail-value {
              font-size: 11.5px;
              color: #0f172a;
              font-weight: 500;
            }
            .font-mono {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
              font-size: 11px;
            }
            th {
              background-color: #f8fafc;
              font-weight: 700;
              text-align: left;
              padding: 6px 8px;
              border-bottom: 2px solid #cbd5e1;
              color: #475569;
              text-transform: uppercase;
              font-size: 9px;
            }
            td {
              padding: 6px 8px;
              border-bottom: 1px solid #e2e8f0;
              color: #334155;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .alert-box {
              background-color: #fef2f2;
              border: 1px solid #fee2e2;
              color: #991b1b;
              padding: 10px;
              border-radius: 6px;
              font-size: 11px;
              font-weight: 600;
              margin: 10px 0;
            }
            @media print {
              body {
                padding: 10px;
              }
              @page {
                size: A4 portrait;
                margin: 1cm;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <div class="logo-sec">
                <div class="logo-placeholder">
                  <img src="${window.location.origin}/sof-logo.png" id="sof-image-logo" style="height: 54px; width: auto; display: none;" onload="this.style.display='block'; document.getElementById('sof-svg-logo').style.display='none';" onerror="this.style.display='none'; document.getElementById('sof-svg-logo').style.display='block';" />
                  <div id="sof-svg-logo">
                    ${SOF_LOGO_SVG}
                  </div>
                </div>
                <div>
                  <h1 class="title">Roteiro de Rastreabilidade e Relatório de Ciclo</h1>
                  <h2 class="subtitle">CONTRATICS - Secretaria de Orçamento Federal (SOF)</h2>
                </div>
              </div>
              <div class="meta-val">
                <div><strong>Emissão:</strong> ${new Date(currentLocalTime).toLocaleString('pt-BR')}</div>
                <div><strong>Ambiente:</strong> Produção SOF</div>
                <div><strong>Responsável:</strong> Gestão de TI</div>
              </div>
            </div>
          </div>

          <div class="flow-indicator">
            <div class="flow-step ${resolvedDfd ? 'active' : 'inactive'}">
              ✓ 1. PCA / DFD (${resolvedDfd ? resolvedDfd.Num_DFD : 'Não Atribuído'})
            </div>
            <div style="align-self: center; color: #94a3b8;">➔</div>
            <div class="flow-step ${resolvedPlan ? 'active' : 'inactive'}">
              ${resolvedPlan ? '✓ 2. Planejamento (S.E.I.)' : '✗ 2. Planejamento'} ${resolvedPlan ? `(${resolvedPlan.SEI_Processo})` : ''}
            </div>
            <div style="align-self: center; color: #94a3b8;">➔</div>
            <div class="flow-step ${resolvedContrato ? 'active' : 'inactive'}">
              ${resolvedContrato ? '✓ 3. Contratado' : '✗ 3. Contratação'} ${resolvedContrato ? `(${resolvedContrato.Num_Contrato})` : ''}
            </div>
          </div>

          <!-- Section 1: DFD -->
          <div class="section-title">1. Documento de Formalização da Demanda (PCA)</div>
          ${resolvedDfd ? `
            <div class="details-grid">
              <div class="detail-item">
                <div class="detail-label">NÚMERO DFD / PCA</div>
                <div class="detail-value font-mono">${resolvedDfd.Num_DFD}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">ÓRGÃO / UASG</div>
                <div class="detail-value">${resolvedDfd.UASG || 'UASG 201130'}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">DESCRIÇÃO DO OBJETO ESTIMADO</div>
                <div class="detail-value">${resolvedDfd.Descricao_Objeto}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">VALOR ESTIMADO INICIAL</div>
                <div class="detail-value font-mono" style="font-weight: 700; color: #0284c7;">
                  ${formatCurrency(resolvedDfd.Valor_Estimado)}
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-label">ANO PCA EXERCÍCIO</div>
                <div class="detail-value">${resolvedDfd.Ano_PCA}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">CONTABILIZA NO PLANO ORÇAMENTÁRIO?</div>
                <div class="detail-value">${resolvedDfd.Contabilizar_Orcamento ? 'Sim - Contabilizado' : 'Não'}</div>
              </div>
            </div>
          ` : `
            <div class="alert-box">Este processo não está vinculado a um DFD cadastrado na SOF. (Cadastrado como DFD externo ou manual).</div>
          `}

          <!-- Section 2: PLANEJAMENTO SEI -->
          <div class="section-title">2. Fase Interna e Planejamento da Contratação</div>
          ${resolvedPlan ? `
            <div class="details-grid">
              <div class="detail-item">
                <div class="detail-label">PROCESSO SEI PRINCIPAL</div>
                <div class="detail-value font-mono" style="font-weight: bold; color: #0f172a;">${resolvedPlan.SEI_Processo}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">VALOR ESTIMADO NO ETAP</div>
                <div class="detail-value font-mono" style="font-weight: 700; color: #0284c7;">${formatCurrency(getPlanningCusto(resolvedPlan))}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">INTEGRANTE REQUISITANTE / COORDENAÇÃO</div>
                <div class="detail-value">
                  ${resolvedPlan.Int_Requisitante || 'N/A'} 
                  ${resolvedPlan.Int_Requisitante_Subst ? `(Subst: ${resolvedPlan.Int_Requisitante_Subst})` : ''}
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-label">EQUIPE PLANEJAMENTO (TÉCNICO / ADMIN)</div>
                <div class="detail-value" style="font-size: 10px;">
                  Téc: ${resolvedPlan.Int_Tecnico || 'Não atribuído'} ${resolvedPlan.Int_Tecnico_Subst ? `[S: ${resolvedPlan.Int_Tecnico_Subst}]` : ''} <br/>
                  Adm: ${resolvedPlan.Int_Administrativo || 'Não atribuído'} ${resolvedPlan.Int_Administrativo_Subst ? `[S: ${resolvedPlan.Int_Administrativo_Subst}]` : ''}
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-label">STATUS DO PLANEJAMENTO</div>
                <div class="detail-value" style="font-weight: 700;">${resolvedPlan.Status_Planejamento}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">LINKS E PORTARIA DA EQUIPE</div>
                <div class="detail-value">
                  ${resolvedPlan.Portaria_Equipe_PC_Numero ? `Portaria: ${resolvedPlan.Portaria_Equipe_PC_Numero}` : 'Sem Portaria Atrelada'}
                  ${resolvedPlan.Portaria_Equipe_PC_SEI ? `(SEI: ${resolvedPlan.Portaria_Equipe_PC_SEI})` : ''}
                </div>
              </div>
            </div>
          ` : `
            <div class="alert-box">Este processo não possui fase de planejamento de licitação cadastrada separadamente no Contratics.</div>
          `}

          <!-- Section 3: CONTRATO -->
          <div class="section-title">3. Gestão Contratual</div>
          ${resolvedContrato ? `
            <div class="details-grid font-sans">
              <div class="detail-item">
                <div class="detail-label">NÚMERO DO CONTRATO</div>
                <div class="detail-value font-mono" style="font-weight: 800; color: #1e3a8a;">${resolvedContrato.Num_Contrato}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">EMPRESA ADJUDICADA (FORNECEDOR)</div>
                <div class="detail-value" style="font-weight: 700; color: #0284c7;">
                  ${contractFornecedor ? contractFornecedor.Nome_Fornecedor : (resolvedContrato.Fornecedor || 'N/A')}
                  ${contractFornecedor?.CNPJ ? `(${contractFornecedor.CNPJ})` : ''}
                </div>
              </div>
              <div class="detail-item" style="grid-column: span 2;">
                <div class="detail-label">OBJETO CONTRATUAL DIPLOMADO</div>
                <div class="detail-value" style="font-size: 11px;">${resolvedContrato.Objeto}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">VALOR CONTRATO (GLOBAL)</div>
                <div class="detail-value font-mono">${formatCurrency(resolvedContrato.Valor_Contrato)}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">VALOR ATUALIZADO DO CONTRATO</div>
                <div class="detail-value font-mono" style="font-weight: 700; color: #1e3a8a;">${formatCurrency(computedValorAtualizado)}</div>
              </div>
              <div class="detail-item font-mono" style="background-color: #e6fcf5;">
                <div class="detail-label">VALOR COMPROMISSADO ANUAL SOF (2026)</div>
                <div class="detail-value font-mono" style="font-weight: 800; color: #0ca678;">${formatCurrency(resolvedContractAnnualValue)}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">VIGÊNCIA E GESTOR DO CONTRATO</div>
                <div class="detail-value">
                  Período: ${formatDate(resolvedContrato.Vigencia_Inicio)} a ${resolvedContrato.Vigencia_Final ? formatDate(resolvedContrato.Vigencia_Final) : 'Sob Demanda'} <br/>
                  Gestor Titular: ${resolvedContrato.Gestor_Contrato || 'Não designado'}
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-label">FISCALIZAÇÃO INTEGRAL</div>
                <div class="detail-value" style="font-size: 10px;">
                  Fis. Técnico: ${resolvedContrato.Fiscal_Tecnico || 'N/A'} | Fis. Adm: ${resolvedContrato.Fiscal_Administrativo || 'N/A'} <br/>
                  Portaria Fiscal: ${resolvedContrato.Portaria_Fiscalizacao_Numero || 'Sem portaria cadastrada'}
                </div>
              </div>

              ${resolvedPlan ? `
                <div class="detail-item" style="grid-column: span 2; background-color: #f0fdf4; border: 1px solid #cdf4db; padding: 10px; border-radius: 6px; margin-top: 8px;">
                  <div class="detail-label" style="height: auto; color: #15803d; font-weight: 800; font-size: 9.5px; margin-bottom: 4px;">RASTREAMENTO DA DISPUTA SOF (ECONOMICIDADE EM LICITAÇÃO)</div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 11px; flex-wrap: wrap; gap: 8px;">
                    <div>
                      <span style="color: #64748b;">Orçado Itens SOF (Processo SEI):</span> 
                      <strong class="font-mono">${formatCurrency(planTotalBudget)}</strong>
                    </div>
                    <div>
                      <span style="color: #64748b;">Adjudicado Itens SOF (Licitação):</span> 
                      <strong class="font-mono" style="color: #1e3a8a;">${formatCurrency(contractDisputeValue)}</strong>
                    </div>
                    <div style="font-weight: bold; color: #166534;">
                      <span>${diffBudget >= 0 ? 'Redução / Economia:' : 'Variação:'}</span> 
                      <span class="font-mono" style="display: inline-block; background-color: #dcfce7; padding: 2px 6px; border-radius: 4px; margin-left: 2px;">
                        ${diffBudget >= 0 ? `- ${formatCurrency(diffBudget)}` : `+ ${formatCurrency(Math.abs(diffBudget))}`} ${planTotalBudget > 0 ? `(${diffPercentage.toFixed(2)}%)` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- Execution Financial Sub-section -->
            <div class="section-title">4. Detalhes de Execução Orçamentária</div>
            
            <h4 style="font-size: 10px; text-transform: uppercase; margin: 12px 0 6px 0; color: #475569;">Itens de Contratação SOF</h4>
            ${groupedContractItens.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th style="text-align: center;">Grupo</th>
                    <th>Item</th>
                    <th>Descrição</th>
                    <th>Unidade</th>
                    <th class="text-right">Qtd</th>
                    <th class="text-right">Valor Unitário</th>
                    <th class="text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${groupedContractItens.map(row => `
                    <tr>
                      ${row.isFirstInGroup ? `<td rowspan="${row.groupRowCount}" style="text-align: center; vertical-align: middle; font-weight: bold; background: #f8fafc;">${row.groupLabel}</td>` : ''}
                      <td class="font-mono">${row.item.Numero_Item}</td>
                      <td>${row.item.Descricao_Item}</td>
                      <td>${row.item.Unidade_Medida}</td>
                      <td class="text-right font-mono">${row.item.Quantidade}</td>
                      <td class="text-right font-mono">${formatCurrency(row.item.Valor_Unitario)}</td>
                      <td class="text-right font-mono" style="font-weight:bold;">${formatCurrency(row.item.Quantidade * row.item.Valor_Unitario)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : `
              <div style="font-size: 11px; font-style: italic; color: #64748b; padding: 6px 0;">Nenhum item individual cadastrado no orçamento do Contratics para este contrato.</div>
            `}

            <h4 style="font-size: 10px; text-transform: uppercase; margin: 16px 0 6px 0; color: #475569;">Histórico de Ordens de Serviço (OS), Empenhos & Descentralizações</h4>
            ${OSList.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>Nº OS</th>
                    <th>Emissão</th>
                    <th class="text-right">Valor OS</th>
                    <th>Empenho (${resolvedContrato?.Modalidade_Contratacao === 'Pregão Colaboragov' ? 'MGI' : 'SOF'})</th>
                    ${resolvedContrato?.Modalidade_Contratacao === 'Pregão Colaboragov' ? `
                      <th>Descentralização(ões) SOF ➔ MGI</th>
                    ` : ''}
                    <th>TRP / TRD</th>
                    <th class="text-right">Glosa</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${OSList.map(os => {
                    const hasMultiDesc = Array.isArray(os.descentralizacoes) && os.descentralizacoes.length > 0;
                    return `
                      <tr>
                        <td class="font-mono" style="font-weight: 700;">${os.numeroOS}</td>
                        <td class="font-mono">${formatDate(os.dataEmissao)}</td>
                        <td class="font-mono text-right">${formatCurrency(os.valor)}</td>
                        <td class="font-mono">
                          ${os.numeroEmpenho || 'Sem nota'} <br/>
                          ${os.seiEmpenho ? `<span style="font-size:8px; color:#64748b;">${os.seiEmpenho}</span>` : ''}
                        </td>
                        ${resolvedContrato?.Modalidade_Contratacao === 'Pregão Colaboragov' ? `
                          <td style="font-size: 8.5px;">
                            ${hasMultiDesc ? `
                              ${os.descentralizacoes!.map(d => `
                                <div>
                                  <strong style="color:#0284c7;">SEI: ${d.processoSei || 'Pendente'}</strong> (${formatCurrency(d.valor || 0)})
                                  ${d.empenhosNumeros && d.empenhosNumeros.length > 0 ? `<br/><span style="color:#64748b;">NEs: ${d.empenhosNumeros.join(', ')}</span>` : ''}
                                </div>
                              `).join('')}
                            ` : (os.descentralizacaoSei ? `
                              <strong style="color:#0284c7;">SEI: ${os.descentralizacaoSei}</strong> (${formatCurrency(os.descentralizacaoValor || 0)})
                            ` : '<span style="color:#94a3b8; font-style:italic;">Não descentralizado</span>')}
                          </td>
                        ` : ''}
                        <td>
                          TRP: ${os.trpElaborado ? 'Elab ✓' : 'Não'} <br/>
                          TRD: ${os.trdElaborado ? 'Elab ✓' : 'Não'}
                        </td>
                        <td class="font-mono text-right text-red-600">${os.trdGlosa ? formatCurrency(os.trdGlosa) : '—'}</td>
                        <td><span style="font-weight:bold;">${os.statusOS}</span></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
              <div style="font-size: 10px; text-align: right; font-weight: bold; margin-top: 8px; color: #1e3a8a;">
                Total Executado OS: ${formatCurrency(totalOSValue)} | 
                Total Empenhos: ${formatCurrency(totalOSEmpenhado)} | 
                Total Glosas: ${formatCurrency(totalOSGlosas)}
              </div>
            ` : `
              <div style="font-size: 11px; font-style: italic; color: #64748b; padding: 6px 0;">Nenhuma Ordem de Serviço cadastrada e sob execução.</div>
            `}

            <h4 style="font-size: 10px; text-transform: uppercase; margin: 16px 0 6px 0; color: #475569;">Termos Aditivos e Apostilamentos</h4>
            ${(contractAditivos.length > 0 || contractApostilamentos.length > 0) ? `
              <div class="details-grid">
                <div class="detail-item" style="grid-column: span 2;">
                  <div class="detail-label">Histórico de Alterações Contratuais</div>
                  <div class="detail-value" style="font-size: 10.5px;">
                    ${contractAditivos.map(a => `• <strong>Aditivo [${a.Tipo_Aditivo}]:</strong> Aditivou ${formatCurrency(a.Valor_Aditivado)} em ${formatDate(a.Data_Aditivo)} (${a.Documento_SEI || 'SEI unlisted'})<br/>`).join('')}
                    ${contractApostilamentos.map(a => `• <strong>Apostilamento [${a.Tipo_Apostilamento}]:</strong> Reajuste de ${formatCurrency(a.Valor_do_Ajuste)} em ${formatDate(a.Data_Apostilamento)} (${a.Documento_SEI || 'SEI unlisted'})<br/>`).join('')}
                  </div>
                </div>
              </div>
            ` : `
              <div style="font-size: 11px; font-style: italic; color: #64748b; padding: 6px 0;">Nenhum Termo Aditivo ou Apostilamento formalizado para este instrumento.</div>
            `}
          ` : `
            <div class="alert-box">Este processo de contratação ainda se encontra nas etapas preliminares ou internas de instrução e licitação. O instrumento formal de Contrato ainda não foi assinado ou cadastrado.</div>
          `}
        </body>
      </html>
    `;

    // Trigger printed modal directly from hidden iframe so popup blockers aren't triggered
    let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-outline relative w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150" data-tour="rastreabilidade-content">
        
        {/* Header */}
        <div className="flex border-b border-outline-variant/60 items-center justify-between p-4 bg-surface-container-low">
          <div className="flex items-center gap-2.5">
            <Shuffle className="w-5 h-5 text-primary shrink-0" />
            <div>
              <span className="text-[9px] uppercase font-bold text-primary tracking-widest block font-mono">Governança Integrada SOF</span>
              <h3 className="text-sm font-bold text-on-surface">Roteiro e Rastreabilidade do Processo Contratual</h3>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-on-primary bg-primary rounded-lg shadow hover:bg-opacity-90 transition-all cursor-pointer focus:outline-none"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar PDF Relatório</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 px-2.5 hover:bg-surface-container rounded-lg text-on-surface-variant transition-colors border border-outline-variant/40 hover:text-on-surface cursor-pointer focus:outline-none text-xs"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar text-on-surface flex-1">
          
          {/* Main timeline tracker */}
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 select-none">
            
            <div className={`flex flex-1 items-center gap-3 p-3 rounded-lg border ${resolvedDfd ? 'bg-primary/5 border-primary/20 text-on-surface' : 'border-dashed border-outline-variant text-on-surface-variant/50'}`}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold bg-primary text-on-primary text-xs shrink-0 font-mono">1</div>
              <div className="truncate">
                <span className="text-[9px] font-mono uppercase text-on-surface-variant font-bold leading-none block">Etapa inicial: PCA</span>
                <span className="text-xs font-bold block truncate">{resolvedDfd ? resolvedDfd.Num_DFD : 'Não cadastrado'}</span>
                {resolvedDfd && <span className="text-[10px] font-mono text-primary group-hover:underline">UASG: {resolvedDfd.UASG}</span>}
              </div>
            </div>

            <ArrowRight className="hidden md:block w-4 h-4 text-outline-variant animate-pulse shrink-0" />

            <div className={`flex flex-1 items-center gap-3 p-3 rounded-lg border ${resolvedPlan ? 'bg-primary/5 border-primary/20 text-on-surface' : 'border-dashed border-outline-variant text-on-surface-variant/50'}`}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold bg-primary text-on-primary text-xs shrink-0 font-mono">2</div>
              <div className="truncate">
                <span className="text-[9px] font-mono uppercase text-on-surface-variant font-bold leading-none block">Etapa interna: SEI</span>
                <span className="text-xs font-bold block truncate">{resolvedPlan ? resolvedPlan.SEI_Processo : 'Ainda não iniciado'}</span>
                {resolvedPlan && <span className="text-[9px] uppercase font-bold text-amber-500 font-mono">{resolvedPlan.Status_Planejamento}</span>}
              </div>
            </div>

            <ArrowRight className="hidden md:block w-4 h-4 text-outline-variant shrink-0" />

            <div className={`flex flex-1 items-center gap-3 p-3 rounded-lg border ${resolvedContrato ? 'bg-primary/5 border-primary/20 text-on-surface' : 'border-dashed border-outline-variant text-on-surface-variant/50'}`}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold bg-primary text-on-primary text-xs shrink-0 font-mono">3</div>
              <div className="truncate">
                <span className="text-[9px] font-mono uppercase text-on-surface-variant font-bold leading-none block">Resultado: Instrumento</span>
                <span className="text-xs font-bold block truncate">{resolvedContrato ? resolvedContrato.Num_Contrato : 'Contrato pendente'}</span>
                {resolvedContrato && <span className="text-[9px] font-mono text-emerald-500 font-bold">{resolvedContrato.Status_Contrato}</span>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* COLUMN 1: DFD & PCA (Origem) */}
            <div className="bg-surface-container-low border border-outline-variant/40 rounded-xl p-4.5 space-y-3.5">
              <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-2">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <h4 className="text-xs font-bold text-on-surface uppercase tracking-wide">1. Origem: PCA e Planejamento Prévio (DFD)</h4>
              </div>

              {resolvedDfd ? (
                <div className="space-y-3 font-sans text-xs">
                  <div>
                    <span className="text-[10px] text-on-surface-variant block uppercase font-mono">Identificação do DFD</span>
                    <strong className="text-on-surface font-mono">{resolvedDfd.Num_DFD}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant block uppercase font-mono">Objeto Estimado</span>
                    <p className="text-on-surface font-medium leading-relaxed">{resolvedDfd.Descricao_Objeto}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-on-surface-variant block uppercase font-mono">UASG vinculada</span>
                      <span className="text-on-surface font-semibold">{resolvedDfd.UASG || '201130 (MPO)'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-on-surface-variant block uppercase font-mono">Ano da PCA</span>
                      <span className="text-on-surface font-mono font-bold">{resolvedDfd.Ano_PCA}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-outline-variant/15">
                    <div>
                      <span className="text-[10px] text-on-surface-variant block uppercase font-mono">Valor Estimado Inicial</span>
                      <span className="text-primary font-mono font-bold text-sm">{formatCurrency(resolvedDfd.Valor_Estimado)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-on-surface-variant block uppercase font-mono">Contabilizar Orçamento?</span>
                      <span className={`inline-flex px-1.5 py-0.25 text-[10px] font-mono rounded mt-0.5 font-bold ${resolvedDfd.Contabilizar_Orcamento ? 'bg-primary/10 text-primary' : 'bg-on-surface-variant/10 text-on-surface-variant'}`}>
                        {resolvedDfd.Contabilizar_Orcamento ? 'Sim - Ativo' : 'Não'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-on-surface-variant/60 font-mono italic">
                  Este processo foi cadastrado manualmente no contratics ou importado sem DFD correspondente no PCA. (Exemplo: DFD Externo / Mapeamento de Transição).
                </div>
              )}
            </div>

            {/* COLUMN 2: Planejamento Interno (Processo SEI) */}
            <div className="bg-surface-container-low border border-outline-variant/40 rounded-xl p-4.5 space-y-3.5">
              <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-2">
                <Briefcase className="w-4 h-4 text-primary shrink-0" />
                <h4 className="text-xs font-bold text-on-surface uppercase tracking-wide">2. Fase Interna e Licitação (Abertura SEI)</h4>
              </div>

              {resolvedPlan ? (
                <div className="space-y-3 font-sans text-xs">
                  <div>
                    <span className="text-[10px] text-on-surface-variant block uppercase font-mono">Nº Processo Administrativo SEI</span>
                    <strong className="text-on-surface font-mono block text-sm">{resolvedPlan.SEI_Processo}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant block uppercase font-mono">Requisitante e Equipe de Planejamento</span>
                    <p className="text-on-surface leading-tight font-medium">
                      Coordenador/Responsável: <strong className="text-primary">{resolvedPlan.Int_Requisitante}</strong> <br/>
                      {resolvedPlan.Int_Requisitante_Subst && <span className="text-[10px] text-on-surface-variant">Substituto: {resolvedPlan.Int_Requisitante_Subst}</span>}
                    </p>
                    <div className="text-[10px] text-on-surface-variant/80 space-y-0.5 mt-1 bg-surface-container/30 px-2 py-1 rounded">
                      <div>Integrante Técnico: {resolvedPlan.Int_Tecnico || 'Não atribuído'} {resolvedPlan.Int_Tecnico_Subst ? `(Sub: ${resolvedPlan.Int_Tecnico_Subst})` : ''}</div>
                      <div>Integrante Adm: {resolvedPlan.Int_Administrativo || 'Não atribuído'} {resolvedPlan.Int_Administrativo_Subst ? `(Sub: ${resolvedPlan.Int_Administrativo_Subst})` : ''}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-outline-variant/15">
                    <div>
                      <span className="text-[10px] text-on-surface-variant block uppercase font-mono">Portaria Equipe SEI</span>
                      <span className="text-on-surface text-[10.5px] font-mono leading-none block mt-0.5">
                        {resolvedPlan.Portaria_Equipe_PC_Numero ? resolvedPlan.Portaria_Equipe_PC_Numero : '—'} <br/>
                        {resolvedPlan.Portaria_Equipe_PC_SEI && <span className="text-[9px] text-on-surface-variant">SEI: {resolvedPlan.Portaria_Equipe_PC_SEI}</span>}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-on-surface-variant block uppercase font-mono">Custo Estimado ETAP</span>
                      <span className="text-primary font-mono font-bold">{formatCurrency(getPlanningCusto(resolvedPlan))}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant block uppercase font-mono">Status da Instrução</span>
                    <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded mt-0.5 bg-amber-400/10 border border-amber-500/20 text-amber-600 dark:text-amber-300 font-mono">
                      {resolvedPlan.Status_Planejamento}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-on-surface-variant/60 font-mono italic">
                  Investigando fase interna. O processo SEI de instrução de planejamento ainda não está cadastrado/importado no Contratics.
                </div>
              )}
            </div>
          </div>

          {/* ROW: CONTRATO E CERTIFICAÇÃO FINANCEIRA */}
          <div className="bg-surface-container-low border border-outline-variant/40 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-2">
              <TrendingUp className="w-5 h-5 text-primary shrink-0" />
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wide">3. Instrumento de Ajuste (Gestão de Contrato & Execução Orçamentária)</h4>
            </div>

            {resolvedContrato ? (
              <div className="space-y-4 text-xs font-sans">
                
                {/* Contract Meta Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-[10px] text-on-surface-variant block uppercase font-mono">Número do Contrato Oficial</span>
                    <strong className="text-on-surface-variant text-base block font-mono font-extrabold" style={{ color: 'var(--primary)' }}>{resolvedContrato.Num_Contrato}</strong>
                    <span className="text-[10px] text-on-surface-variant/80 font-mono block">SEI correspondente: {resolvedContrato.SEI_Processo}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant block uppercase font-mono">Fornecedor Adjudicado</span>
                    <strong className="text-on-surface block truncate text-xs">{contractFornecedor ? contractFornecedor.Nome_Fornecedor : 'Inconsistência Fornecedor'}</strong>
                    {contractFornecedor && <span className="text-[10px] text-on-surface-variant/80 font-mono block">CNPJ: {contractFornecedor.CNPJ} | Contato: {contractFornecedor.EmailContato}</span>}
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant block uppercase font-mono">Gestor Titular Designado</span>
                    <strong className="text-on-surface text-xs block">{resolvedContrato.Gestor_Contrato || 'Não designado'}</strong>
                    {resolvedContrato.Gestor_Substituto && <span className="text-[10px] text-on-surface-variant/80 block">Substituto: {resolvedContrato.Gestor_Substituto}</span>}
                  </div>
                </div>

                <div className="pt-2 border-t border-outline-variant/15">
                  <span className="text-[10px] text-on-surface-variant block uppercase font-mono">Objeto Integral Formalizado</span>
                  <p className="text-on-surface font-medium leading-relaxed mt-0.5">{resolvedContrato.Objeto}</p>
                </div>

                {/* Values & Budget */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4.5 bg-surface-container/60 rounded-xl border border-outline-variant/20">
                  <div className="space-y-0.5">
                    <span className="text-[9px] uppercase font-bold text-on-surface-variant font-mono">Valor Total Global</span>
                    <p className="text-on-surface font-bold text-sm font-mono">{formatCurrency(resolvedContrato.Valor_Contrato)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] uppercase font-bold text-on-surface-variant font-mono">Valor Atualizado</span>
                    <p className="text-on-surface font-bold text-sm font-mono">{formatCurrency(computedValorAtualizado)}</p>
                  </div>
                  <div className="space-y-0.5 bg-primary/5 px-2 py-1 rounded border border-primary/15">
                    <span className="text-[9px] uppercase font-bold text-primary font-mono block">Valor Anual SOF 2026</span>
                    <p className="text-primary font-bold text-base font-mono leading-none mt-0.5">{formatCurrency(resolvedContractAnnualValue)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] uppercase font-bold text-on-surface-variant font-mono">Frequência Pagto</span>
                    <p className="text-on-surface text-xs font-semibold">{resolvedContrato.Periodicidade_Pagamento}</p>
                  </div>
                </div>

                {/* Dispute & Budget Economicity comparison */}
                {resolvedPlan && (
                  <div className="bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all duration-200">
                    <div className="space-y-1">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-300 font-bold tracking-widest uppercase block">RASTREAMENTO DA DISPUTA SOF (ECONOMICIDADE EM LICITAÇÃO)</span>
                      <p className="text-on-surface-variant text-[11px] leading-relaxed">
                        Comparativo entre os itens SOF orçados no planejamento (Processo SEI) e os itens SOF adjudicados do contrato.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3 font-mono">
                      <div className="bg-surface-container-lowest/80 border border-outline-variant/30 rounded-lg px-3 py-1.5 min-w-[120px] text-center">
                        <span className="text-[9px] text-on-surface-variant block uppercase font-mono">Valor Orçado SOF</span>
                        <span className="text-xs font-bold text-on-surface">{formatCurrency(planTotalBudget)}</span>
                      </div>
                      <div className="bg-surface-container-lowest/80 border border-outline-variant/30 rounded-lg px-3 py-1.5 min-w-[120px] text-center">
                        <span className="text-[9px] text-on-surface-variant block uppercase font-mono">Valor Adjudicado SOF</span>
                        <span className="text-xs font-bold text-primary">{formatCurrency(contractDisputeValue)}</span>
                      </div>
                      <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-lg px-3 py-1.5 min-w-[145px] text-center">
                        <span className="text-[9px] text-emerald-700 dark:text-emerald-300 block uppercase font-mono font-bold">{diffBudget >= 0 ? 'Redução / Economia' : 'Variação'}</span>
                        <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                          {diffBudget >= 0 ? `- ${formatCurrency(diffBudget)}` : `+ ${formatCurrency(Math.abs(diffBudget))}`} {planTotalBudget > 0 ? `(${diffPercentage.toFixed(2)}%)` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-itens table detail */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Itens Detalhados do Orçamento</h5>
                    <span className="text-[10px] font-mono text-on-surface-variant">{contractItens.length} itens vinculados</span>
                  </div>
                  
                  {groupedContractItens.length > 0 ? (
                    <div className="overflow-x-auto border border-outline-variant/30 rounded-xl">
                      <table className="w-full text-left border-collapse font-sans text-xs">
                        <thead>
                          <tr className="bg-surface-container border-b border-outline-variant/40">
                            <th className="px-3 py-2 text-center text-[10px] border-r border-outline-variant/20 font-semibold uppercase tracking-wider">Grupo</th>
                            <th className="px-3 py-2 font-mono text-[10px]">Item</th>
                            <th className="px-3 py-2 text-[10px]">Descrição do Fornecimento</th>
                            <th className="px-3 py-2 text-right text-[10px]">Qtd</th>
                            <th className="px-3 py-2 text-right text-[10px]">Vlr Unitário</th>
                            <th className="px-3 py-2 text-right text-[10px]">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedContractItens.map(row => {
                            const item = row.item;
                            return (
                              <tr key={item.id} className="hover:bg-surface-container-high/20 border-b border-outline-variant/10">
                                {row.isFirstInGroup && (
                                  <td 
                                    rowSpan={row.groupRowCount} 
                                    className="px-3 py-2 text-center font-bold text-on-surface bg-surface-container-low/40 border-r border-outline-variant/20 align-middle select-none"
                                  >
                                    <span className="inline-block px-2 py-0.5 rounded bg-surface-container-highest/80 border border-outline-variant/50 text-primary font-mono text-[10px] font-bold">
                                      {row.groupLabel}
                                    </span>
                                  </td>
                                )}
                                <td className="px-3 py-2 font-mono font-semibold">{item.Numero_Item}</td>
                                <td className="px-3 py-2 font-medium">{item.Descricao_Item}</td>
                                <td className="px-3 py-2 text-right font-mono text-[11px]">{item.Quantidade}</td>
                                <td className="px-3 py-2 text-right font-mono text-[11px]">{formatCurrency(item.Valor_Unitario)}</td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-[11.5px] text-primary">{formatCurrency(item.Quantidade * item.Valor_Unitario)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-on-surface-variant font-mono italic">Nenhum sub-item orçamentário específico registrado no contratics para este contrato.</p>
                  )}
                </div>

                {/* OS and payments tracking */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Histórico de Ordens de Serviço (OS), TRP/TRD e Liquidações</h5>
                    <span className="text-[10px] font-mono text-on-surface-variant">{OSList.length} OSs emitidas</span>
                  </div>

                  {OSList.length > 0 ? (
                    <div className="overflow-x-auto border border-outline-variant/30 rounded-xl">
                      <table className="w-full text-left border-collapse font-sans text-xs">
                        <thead>
                          <tr className="bg-surface-container border-b border-outline-variant/40">
                            <th className="px-3 py-2 text-[10px]">OS Número</th>
                            <th className="px-3 py-2 text-[10px]">Vigência Ref.</th>
                            <th className="px-3 py-2 text-[10px]">Emissão</th>
                            <th className="px-3 py-2 text-right text-[10px]">Valor OS</th>
                            <th className="px-3 py-2 text-[10px]">Nota Empenho / SEI</th>
                            <th className="px-3 py-2 text-right text-[10px]">Valor Empenhado</th>
                            <th className="px-3 py-2 text-[10px]">Termos TRP / TRD</th>
                            <th className="px-3 py-2 text-right text-[10px]">Glosas Aplicadas</th>
                            <th className="px-3 py-2 text-[10px]">Situação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {OSList.map(os => (
                            <tr key={os.id} className="hover:bg-surface-container-high/20 border-b border-outline-variant/10">
                              <td className="px-3 py-2 font-mono font-bold text-primary">{os.numeroOS}</td>
                              <td className="px-3 py-2 font-mono text-[10.5px] whitespace-nowrap">
                                {os.dataInicioPeriodo && os.dataFimPeriodo ? (
                                  `${formatDate(os.dataInicioPeriodo)} a ${formatDate(os.dataFimPeriodo)}`
                                ) : (
                                  <span className="italic text-on-surface-variant/40">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono text-[10.5px]">{formatDate(os.dataEmissao)}</td>
                              <td className="px-3 py-2 text-right font-mono text-[11px] font-semibold">{formatCurrency(os.valor)}</td>
                              <td className="px-3 py-2">
                                <span className="font-mono font-semibold block">{os.numeroEmpenho || 'Sem nota'}</span>
                                {os.seiEmpenho && <span className="text-[9px] text-on-surface-variant/70 block">SEI: {os.seiEmpenho}</span>}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-[11px]">{os.valorEmpenho ? formatCurrency(os.valorEmpenho) : '—'}</td>
                              <td className="px-3 py-2 space-y-0.5 text-[10px]">
                                <div>TRP: {os.trpElaborado ? '✓ Elaborado' : '✗ Não'}</div>
                                <div>TRD: {os.trdElaborado ? '✓ Elaborado' : '✗ Não'}</div>
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-red-500 font-semibold">{os.trdGlosa ? `- ${formatCurrency(os.trdGlosa)}` : '—'}</td>
                              <td className="px-3 py-2 font-bold font-mono text-[10.5px] text-primary">{os.statusOS}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-on-surface-variant font-mono italic">Nenhuma Ordem de Serviço ou Documento de Empenho individual cadastrado.</p>
                  )}
                </div>

                {/* Alterations stats summary (Aditivos, Apostilamentos) */}
                {(contractAditivos.length > 0 || contractApostilamentos.length > 0) && (
                  <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/25 text-xs text-on-surface-variant space-y-1">
                    <h6 className="text-[10px] font-bold uppercase text-on-surface tracking-wider">Ajustes Históricos & Ampliação Financeira:</h6>
                    <div className="space-y-0.5">
                      {contractAditivos.map(a => (
                        <div key={a.id} className="flex justify-between">
                          <span>• Termo Aditivo [{a.Tipo_Aditivo}] em {formatDate(a.Data_Aditivo)} ({a.Documento_SEI})</span>
                          <strong className="font-mono text-primary">+{formatCurrency(a.Valor_Aditivado)}</strong>
                        </div>
                      ))}
                      {contractApostilamentos.map(a => (
                        <div key={a.id} className="flex justify-between">
                          <span>• Apostilamento de Reajuste [{a.Tipo_Apostilamento}] em {formatDate(a.Data_Apostilamento)} ({a.Documento_SEI})</span>
                          <strong className="font-mono text-primary">+{formatCurrency(a.Valor_do_Ajuste)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="py-8 text-center text-xs text-on-surface-variant/60 font-mono italic flex flex-col items-center justify-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <p>Instrumento de Contrato Principal ainda não assinado. O processo está em andamento na fase interna administrativa.</p>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-outline-variant/60 p-4.5 bg-surface-container-low">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-on-surface hover:bg-surface-container rounded-xl border border-outline-variant transition-all cursor-pointer focus:outline-none"
          >
            Fechar Relatório
          </button>
        </div>

      </div>
    </div>
  );
}
