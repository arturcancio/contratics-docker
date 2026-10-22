import ExcelJS from 'exceljs';
import { DFD } from './types';
import { calculateDfdAnnualizedDetails } from './utils';

/**
 * Fetches the SOF logo as an ArrayBuffer from /sof-logo.png
 */
export async function getSofLogoBuffer(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch('/sof-logo.png');
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (err) {
    console.warn('Não foi possível carregar a logo da SOF:', err);
    return null;
  }
}

/**
 * Helper to download an ExcelJS workbook as a native .xlsx file
 */
export async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formats a date string (YYYY-MM-DD or ISO) into DD/MM/YYYY
 */
function formatDateSimple(dateStr: string | undefined | null): string {
  if (!dateStr || dateStr === '-' || dateStr.trim() === '') return '-';
  try {
    const raw = dateStr.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-');
      return `${d}/${m}/${y}`;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      return raw;
    }
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  } catch {
    return '-';
  }
}

const borderThin = {
  top: { style: 'thin' as const, color: { argb: 'FF808080' } },
  left: { style: 'thin' as const, color: { argb: 'FF808080' } },
  bottom: { style: 'thin' as const, color: { argb: 'FF808080' } },
  right: { style: 'thin' as const, color: { argb: 'FF808080' } }
};

/**
 * Exports PCA / DFDs to native .xlsx matching the official SOF template
 */
export async function exportPCAtoExcel(params: {
  dfds: DFD[];
  targetYear: string;
  getDfdAnnualizedValue: (dfd: DFD, year: number) => number;
  seiProcessNumber?: string;
}): Promise<void> {
  const { dfds, targetYear, getDfdAnnualizedValue, seiProcessNumber } = params;
  const targetYearNum = parseInt(targetYear, 10) || 2026;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Contratics SOF';
  workbook.lastModifiedBy = 'Contratics SOF';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(`PCA ${targetYear}`, {
    views: [{ showGridLines: true }]
  });

  // Setup Column Widths
  worksheet.columns = [
    { key: 'colA', width: 2 },   // Margin
    { key: 'colB', width: 2 },   // Margin B as in official template
    { key: 'colC', width: 55 },  // Título da contratação & Logo
    { key: 'colD', width: 28 },  // Processo SEI
    { key: 'colE', width: 22 },  // VALOR TOTAL APROXIMADO DFD
    { key: 'colF', width: 20 },  // PERIODICIDADE DE PAGAMENTO
    { key: 'colG', width: 22 },  // VALOR ANUALIZADO
    { key: 'colH', width: 14 },  // Nº DFD
    { key: 'colI', width: 36 },  // OBSERVAÇÕES
  ];

  // Embed SOF Logo in top-left (Col C, Rows 1-4)
  const logoBuffer = await getSofLogoBuffer();
  if (logoBuffer) {
    try {
      const logoId = workbook.addImage({
        buffer: logoBuffer,
        extension: 'png',
      });
      worksheet.addImage(logoId, {
        tl: { col: 2, row: 0 },
        ext: { width: 135, height: 75 },
        editAs: 'oneCell',
      });
    } catch (e) {
      console.warn('Erro ao inserir logo no Excel:', e);
    }
  }

  // Header Titles (Rows 1-3)
  worksheet.mergeCells('D1:I1');
  const titleCell1 = worksheet.getCell('D1');
  titleCell1.value = `Plano de Contratações Anual - Exercício de ${targetYear}`;
  titleCell1.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
  titleCell1.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells('D2:I2');
  const titleCell2 = worksheet.getCell('D2');
  const rawSei = seiProcessNumber?.trim() || '';
  const seiTitle = rawSei
    ? (rawSei.toLowerCase().startsWith('processo') ? rawSei : `Processo ${rawSei}`)
    : `Processo 03101.000902/${targetYear}-43`;
  titleCell2.value = seiTitle;
  titleCell2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
  titleCell2.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells('D3:I3');
  const titleCell3 = worksheet.getCell('D3');
  titleCell3.value = 'UASG 201007 - Ministério do Planejamento e Orçamento';
  titleCell3.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
  titleCell3.alignment = { horizontal: 'center', vertical: 'middle' };

  // Row heights for header
  worksheet.getRow(1).height = 20;
  worksheet.getRow(2).height = 18;
  worksheet.getRow(3).height = 18;
  worksheet.getRow(4).height = 18;
  worksheet.getRow(5).height = 8;

  // Table Headers (Row 6)
  const headerRow = worksheet.getRow(6);
  headerRow.height = 28;

  const headers = [
    { col: 3, label: 'Título da contratação' },
    { col: 4, label: 'Processo de Aquisição/Contratação no SEI' },
    { col: 5, label: 'VALOR TOTAL APROXIMADO DFD' },
    { col: 6, label: 'PERIODICIDADE DE PAGAMENTO' },
    { col: 7, label: `VALOR ANUALIZADO (${targetYear})` },
    { col: 8, label: 'Nº DFD' },
    { col: 9, label: 'OBSERVAÇÕES' },
  ];

  headers.forEach(h => {
    const cell = headerRow.getCell(h.col);
    cell.value = h.label;
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF000000' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = borderThin;
  });

  let currentRowIdx = 7;
  let totalEstimado = 0;
  let totalAnualizado = 0;

  // Render DFD rows
  dfds.forEach((dfd) => {
    const row = worksheet.getRow(currentRowIdx);
    row.height = 28;

    const valEstimado = Number(dfd.Valor_Estimado) || 0;
    const isConcluido = dfd.Status_DFD === 'Concluído';
    const isDevolvido = dfd.Situacao_PNCP === 'Devolvido';
    const details = calculateDfdAnnualizedDetails(dfd, targetYearNum);
    const valAnualizado = (isConcluido || isDevolvido) ? 0 : getDfdAnnualizedValue(dfd, targetYearNum);

    const isDeactivated = dfd.Contabilizar_Orcamento === false || isDevolvido;
    if (!isDeactivated) {
      totalEstimado += valEstimado;
      if (!isConcluido) {
        totalAnualizado += valAnualizado;
      }
    }

    // Determine observation with Situacao_PNCP and calculation reason
    const sitPncp = dfd.Situacao_PNCP || 'Aguardando Análise';
    let obs: string = sitPncp;
    if (isDevolvido) {
      obs = 'Devolvido (Não contabilizado no orçamento)';
    } else if (dfd.Contabilizar_Orcamento === false) {
      obs = `${sitPncp} — Desativado do orçamento`;
    } else if (isConcluido) {
      obs = `${sitPncp} — Concluído (Contabilizado na Licitação/Contrato)`;
    } else if (dfd.isBudgetOnlyItem) {
      obs = `DFD Incluído (${details.shortReason})`;
    } else if (dfd.Ano_PCA && dfd.Ano_PCA !== targetYear) {
      obs = `Importado do PCA ${dfd.Ano_PCA} (${details.shortReason})`;
    } else {
      obs = `${sitPncp} (${details.shortReason})`;
    }

    const seiProcess = dfd.Planejamento_Vinculado && dfd.Planejamento_Vinculado !== '-'
      ? dfd.Planejamento_Vinculado
      : 'n/d';

    // Col C: Título da contratação
    const cellC = row.getCell(3);
    cellC.value = dfd.Descricao_Objeto || '';
    cellC.font = { name: 'Calibri', size: 9, strike: isDevolvido, color: { argb: isDeactivated ? 'FF888888' : 'FF000000' } };
    cellC.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    cellC.border = borderThin;

    // Col D: Processo SEI
    const cellD = row.getCell(4);
    cellD.value = seiProcess;
    cellD.font = { name: 'Calibri', size: 9, color: { argb: isDeactivated ? 'FF888888' : 'FF000000' } };
    cellD.alignment = { horizontal: 'center', vertical: 'middle' };
    cellD.border = borderThin;

    // Col E: Valor Total Estimado
    const cellE = row.getCell(5);
    cellE.value = valEstimado;
    cellE.numFmt = '"R$"\\ #,##0.00';
    cellE.font = { name: 'Calibri', size: 9, bold: true, strike: isDeactivated, color: { argb: isDeactivated ? 'FF888888' : 'FF000000' } };
    cellE.alignment = { horizontal: 'right', vertical: 'middle' };
    cellE.border = borderThin;

    // Col F: Periodicidade
    const cellF = row.getCell(6);
    cellF.value = dfd.Periodicidade_Pagamento || 'Mensal';
    cellF.font = { name: 'Calibri', size: 9, color: { argb: isDeactivated ? 'FF888888' : 'FF000000' } };
    cellF.alignment = { horizontal: 'center', vertical: 'middle' };
    cellF.border = borderThin;

    // Col G: Valor Anualizado
    const cellG = row.getCell(7);
    if (isConcluido || isDevolvido) {
      cellG.value = '-';
      cellG.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF666666' } };
      cellG.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cellG.value = isDeactivated ? 0 : valAnualizado;
      cellG.numFmt = '"R$"\\ #,##0.00';
      cellG.font = { name: 'Calibri', size: 9, bold: true, color: { argb: isDeactivated ? 'FF888888' : 'FF000000' } };
      cellG.alignment = { horizontal: 'right', vertical: 'middle' };
    }
    cellG.border = borderThin;

    // Col H: Nº DFD
    const cellH = row.getCell(8);
    cellH.value = dfd.Num_DFD || '';
    cellH.font = { name: 'Calibri', size: 9, color: { argb: isDeactivated ? 'FF888888' : 'FF000000' } };
    cellH.alignment = { horizontal: 'center', vertical: 'middle' };
    cellH.border = borderThin;

    // Col I: Observações
    const cellI = row.getCell(9);
    cellI.value = obs;
    cellI.font = { name: 'Calibri', size: 8.5, color: { argb: isDeactivated ? 'FF888888' : 'FF000000' } };
    cellI.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    cellI.border = borderThin;

    currentRowIdx++;
  });

  // Totals Row
  const totalRow = worksheet.getRow(currentRowIdx);
  totalRow.height = 26;

  // Merged Col C & D for TOTAL label
  worksheet.mergeCells(`C${currentRowIdx}:D${currentRowIdx}`);
  const totalLabelCell = totalRow.getCell(3);
  totalLabelCell.value = 'TOTAL ATIVO (EXCLUÍDOS DEVOLVIDOS)';
  totalLabelCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF000000' } };
  totalLabelCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBDD7EE' } // Soft blue
  };
  totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(3).border = borderThin;
  totalRow.getCell(4).border = borderThin;

  // Col E: Total Valor Estimado
  const totalEstimadoCell = totalRow.getCell(5);
  totalEstimadoCell.value = totalEstimado;
  totalEstimadoCell.numFmt = '"R$"\\ #,##0.00';
  totalEstimadoCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
  totalEstimadoCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFA9D08E' } // Light green
  };
  totalEstimadoCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totalEstimadoCell.border = borderThin;

  // Col F: TOTAL ANUALIZADO label
  const totalAnualLabelCell = totalRow.getCell(6);
  totalAnualLabelCell.value = 'TOTAL ANUALIZADO';
  totalAnualLabelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
  totalAnualLabelCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBDD7EE' } // Soft blue
  };
  totalAnualLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };
  totalAnualLabelCell.border = borderThin;

  // Col G: Total Valor Anualizado
  const totalAnualValCell = totalRow.getCell(7);
  totalAnualValCell.value = {
    formula: `SUM(G7:G${currentRowIdx - 1})`,
    result: totalAnualizado
  };
  totalAnualValCell.numFmt = '"R$"\\ #,##0.00';
  totalAnualValCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
  totalAnualValCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFA9D08E' } // Light green
  };
  totalAnualValCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totalAnualValCell.border = borderThin;

  // Col H & I borders
  const cellH = totalRow.getCell(8);
  cellH.border = borderThin;
  const cellI = totalRow.getCell(9);
  cellI.border = borderThin;

  // Save to file
  const filename = `PCA_DFDs_${targetYear}.xlsx`;
  await downloadWorkbook(workbook, filename);
}

/**
 * Exports Orçamento Atual Projection to native .xlsx with SOF logo and official layout
 */
export async function exportOrcamentoProjectionToExcel(params: {
  yearLabel: string;
  unidade: string;
  acao: string;
  po: string;
  items: Array<{
    item: string | number;
    tipoDemanda?: string;
    processoSei?: string;
    numContrato?: string;
    objetoResumido?: string;
    empresaContratada?: string;
    vigenciaInicio?: string;
    vigenciaFim?: string;
    gnd?: string;
    valorGlobal?: number | string;
    mesReajuste?: string;
    indiceReajuste?: string;
    observacao?: string;
    gastoEstimado?: number | string;
  }>;
}): Promise<void> {
  const { yearLabel, unidade, acao, po, items } = params;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Contratics SOF';
  workbook.lastModifiedBy = 'Contratics SOF';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(`Projeção ${yearLabel}`, {
    views: [{ showGridLines: true }]
  });

  // Setup Column Widths
  worksheet.columns = [
    { key: 'colA', width: 6 },   // Item
    { key: 'colB', width: 22 },  // Tipo da Demanda
    { key: 'colC', width: 25 },  // Processo SEI
    { key: 'colD', width: 16 },  // Nº do Contrato
    { key: 'colE', width: 44 },  // Objeto Resumido
    { key: 'colF', width: 28 },  // Empresa Contratada
    { key: 'colG', width: 15 },  // Data Vigência Início
    { key: 'colH', width: 15 },  // Data Vigência Fim
    { key: 'colI', width: 12 },  // GND
    { key: 'colJ', width: 20 },  // Valor Global
    { key: 'colK', width: 16 },  // Mês do Reajuste
    { key: 'colL', width: 20 },  // Índice/Motivo do Reajuste
    { key: 'colM', width: 28 },  // Observações
    { key: 'colN', width: 22 },  // Gasto Estimado
  ];

  // Embed SOF Logo in top-left (Col A-B, Rows 1-3)
  const logoBuffer = await getSofLogoBuffer();
  if (logoBuffer) {
    try {
      const logoId = workbook.addImage({
        buffer: logoBuffer,
        extension: 'png',
      });
      worksheet.addImage(logoId, {
        tl: { col: 0, row: 0 },
        ext: { width: 140, height: 78 },
        editAs: 'oneCell',
      });
    } catch (e) {
      console.warn('Erro ao inserir logo no Excel de Orçamento:', e);
    }
  }

  // Header Title Row (Merged C1:N1)
  worksheet.mergeCells('C1:N1');
  const titleCell = worksheet.getCell('C1');
  titleCell.value = `LEVANTAMENTO DOS CONTRATOS VIGENTES E PROJEÇÃO DE CONTRATAÇÕES PARA ${yearLabel}`;
  titleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1F4E78' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF2F2F2' }
  };
  worksheet.getRow(1).height = 24;

  // Metadata block (Rows 2-4)
  worksheet.getCell('C2').value = 'Unidade Responsável:';
  worksheet.getCell('C2').font = { name: 'Calibri', size: 10, bold: true };
  worksheet.mergeCells('D2:N2');
  worksheet.getCell('D2').value = unidade || 'GECTI - Coordenação de Tecnologia da Informação';
  worksheet.getCell('D2').font = { name: 'Calibri', size: 10 };

  worksheet.getCell('C3').value = 'Ação Orçamentária:';
  worksheet.getCell('C3').font = { name: 'Calibri', size: 10, bold: true };
  worksheet.mergeCells('D3:N3');
  worksheet.getCell('D3').value = `${acao || '8861'} - Sustentação da TI do Planejamento Nacional e do Orçamento Federal`;
  worksheet.getCell('D3').font = { name: 'Calibri', size: 10 };

  worksheet.getCell('C4').value = 'Plano Orçamentário (PO):';
  worksheet.getCell('C4').font = { name: 'Calibri', size: 10, bold: true };
  worksheet.mergeCells('D4:N4');
  worksheet.getCell('D4').value = po || '0000';
  worksheet.getCell('D4').font = { name: 'Calibri', size: 10 };

  worksheet.getRow(2).height = 18;
  worksheet.getRow(3).height = 18;
  worksheet.getRow(4).height = 18;
  worksheet.getRow(5).height = 10; // spacer

  // Table Headers (Row 6)
  const headerRow = worksheet.getRow(6);
  headerRow.height = 28;

  const tableHeaders = [
    { col: 1, label: 'Item' },
    { col: 2, label: 'Tipo da Demanda' },
    { col: 3, label: 'Processo SEI' },
    { col: 4, label: 'Nº do Contrato' },
    { col: 5, label: 'Objeto Resumido' },
    { col: 6, label: 'Empresa Contratada' },
    { col: 7, label: 'Data Vigência Início' },
    { col: 8, label: 'Data Vigência Fim' },
    { col: 9, label: 'GND' },
    { col: 10, label: 'Valor Global' },
    { col: 11, label: 'Mês do Reajuste' },
    { col: 12, label: 'Índice/Motivo do Reajuste' },
    { col: 13, label: 'Observações' },
    { col: 14, label: `Gasto Estimado (${yearLabel})` },
  ];

  tableHeaders.forEach(th => {
    const cell = headerRow.getCell(th.col);
    cell.value = th.label;
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' } // Navy blue corporate header
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = borderThin;
  });

  let currentRowIdx = 7;
  let totalGlobal = 0;
  let totalEstimado = 0;

  // Render Data Rows
  items.forEach((item, index) => {
    const row = worksheet.getRow(currentRowIdx);
    row.height = 24;

    const valGlobal = Number(item.valorGlobal) || 0;
    const gastoEst = Number(item.gastoEstimado) || 0;
    totalGlobal += valGlobal;
    totalEstimado += gastoEst;

    const isEven = index % 2 === 0;
    const rowBg = isEven ? 'FFFFFFFF' : 'FFF9FAFB';

    const rowFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: rowBg }
    };

    // Col 1: Item
    const c1 = row.getCell(1);
    c1.value = item.item;
    c1.font = { name: 'Calibri', size: 9 };
    c1.alignment = { horizontal: 'center', vertical: 'middle' };
    c1.fill = rowFill;
    c1.border = borderThin;

    // Col 2: Tipo Demanda
    const c2 = row.getCell(2);
    c2.value = item.tipoDemanda || '';
    c2.font = { name: 'Calibri', size: 9 };
    c2.alignment = { horizontal: 'left', vertical: 'middle' };
    c2.fill = rowFill;
    c2.border = borderThin;

    // Col 3: Processo SEI
    const c3 = row.getCell(3);
    c3.value = item.processoSei || '-';
    c3.font = { name: 'Calibri', size: 9 };
    c3.alignment = { horizontal: 'center', vertical: 'middle' };
    c3.fill = rowFill;
    c3.border = borderThin;

    // Col 4: Nº Contrato
    const c4 = row.getCell(4);
    c4.value = item.numContrato || '-';
    c4.font = { name: 'Calibri', size: 9 };
    c4.alignment = { horizontal: 'center', vertical: 'middle' };
    c4.fill = rowFill;
    c4.border = borderThin;

    // Col 5: Objeto Resumido
    const c5 = row.getCell(5);
    c5.value = item.objetoResumido || '';
    c5.font = { name: 'Calibri', size: 9 };
    c5.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    c5.fill = rowFill;
    c5.border = borderThin;

    // Col 6: Empresa Contratada
    const c6 = row.getCell(6);
    c6.value = item.empresaContratada || '';
    c6.font = { name: 'Calibri', size: 9 };
    c6.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    c6.fill = rowFill;
    c6.border = borderThin;

    // Col 7: Vigência Início
    const c7 = row.getCell(7);
    c7.value = formatDateSimple(item.vigenciaInicio);
    c7.font = { name: 'Calibri', size: 9 };
    c7.alignment = { horizontal: 'center', vertical: 'middle' };
    c7.fill = rowFill;
    c7.border = borderThin;

    // Col 8: Vigência Fim
    const c8 = row.getCell(8);
    c8.value = formatDateSimple(item.vigenciaFim);
    c8.font = { name: 'Calibri', size: 9 };
    c8.alignment = { horizontal: 'center', vertical: 'middle' };
    c8.fill = rowFill;
    c8.border = borderThin;

    // Col 9: GND
    const c9 = row.getCell(9);
    c9.value = item.gnd || '';
    c9.font = { name: 'Calibri', size: 9 };
    c9.alignment = { horizontal: 'center', vertical: 'middle' };
    c9.fill = rowFill;
    c9.border = borderThin;

    // Col 10: Valor Global
    const c10 = row.getCell(10);
    c10.value = valGlobal;
    c10.numFmt = '"R$"\\ #,##0.00';
    c10.font = { name: 'Calibri', size: 9 };
    c10.alignment = { horizontal: 'right', vertical: 'middle' };
    c10.fill = rowFill;
    c10.border = borderThin;

    // Col 11: Mês Reajuste
    const c11 = row.getCell(11);
    c11.value = item.mesReajuste || '-';
    c11.font = { name: 'Calibri', size: 9 };
    c11.alignment = { horizontal: 'center', vertical: 'middle' };
    c11.fill = rowFill;
    c11.border = borderThin;

    // Col 12: Índice Reajuste
    const c12 = row.getCell(12);
    c12.value = item.indiceReajuste || '-';
    c12.font = { name: 'Calibri', size: 9 };
    c12.alignment = { horizontal: 'left', vertical: 'middle' };
    c12.fill = rowFill;
    c12.border = borderThin;

    // Col 13: Observações
    const c13 = row.getCell(13);
    c13.value = item.observacao || '-';
    c13.font = { name: 'Calibri', size: 8.5 };
    c13.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    c13.fill = rowFill;
    c13.border = borderThin;

    // Col 14: Gasto Estimado
    const c14 = row.getCell(14);
    c14.value = gastoEst;
    c14.numFmt = '"R$"\\ #,##0.00';
    c14.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1F4E78' } };
    c14.alignment = { horizontal: 'right', vertical: 'middle' };
    c14.fill = rowFill;
    c14.border = borderThin;

    currentRowIdx++;
  });

  // Totals Row
  const totalRow = worksheet.getRow(currentRowIdx);
  totalRow.height = 26;

  worksheet.mergeCells(`A${currentRowIdx}:I${currentRowIdx}`);
  const totalLabelCell = totalRow.getCell(1);
  totalLabelCell.value = 'TOTAL GERAL:';
  totalLabelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
  totalLabelCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' }
  };
  totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

  for (let c = 1; c <= 9; c++) {
    totalRow.getCell(c).border = borderThin;
  }

  // Col 10: Total Valor Global
  const totalGlobalCell = totalRow.getCell(10);
  totalGlobalCell.value = {
    formula: `SUM(J7:J${currentRowIdx - 1})`,
    result: totalGlobal
  };
  totalGlobalCell.numFmt = '"R$"\\ #,##0.00';
  totalGlobalCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
  totalGlobalCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' }
  };
  totalGlobalCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totalGlobalCell.border = borderThin;

  // Col 11-13 empty spacer
  for (let c = 11; c <= 13; c++) {
    const emptyCell = totalRow.getCell(c);
    emptyCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' }
    };
    emptyCell.border = borderThin;
  }

  // Col 14: Total Gasto Estimado
  const totalEstimadoCell = totalRow.getCell(14);
  totalEstimadoCell.value = {
    formula: `SUM(N7:N${currentRowIdx - 1})`,
    result: totalEstimado
  };
  totalEstimadoCell.numFmt = '"R$"\\ #,##0.00';
  totalEstimadoCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF375623' } };
  totalEstimadoCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2EFDA' } // Light green
  };
  totalEstimadoCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totalEstimadoCell.border = borderThin;

  // Save to file
  const filename = `Levantamento_Contratos_Projecao_${yearLabel}.xlsx`;
  await downloadWorkbook(workbook, filename);
}
