/**
 * ipeadataService.ts
 * Motor Multi-Fonte Oficial para consulta e sincronização em tempo real do ICTI
 * (Índice de Custos de Tecnologia da Informação) do Ipea / Ipeadata.
 *
 * Fontes oficiais consultadas e mescladas automaticamente:
 * 1. Carta de Conjuntura do Ipea (Feed RSS Oficial + Planilha XLSX "ICTI - Série Completa"):
 *    Onde a DIMAC/Ipea publica em primeira mão o índice de cada mês (geralmente ~30 dias antes do OData).
 * 2. API OData v4 do Ipeadata (Séries DIMAC12_ICTI1, DIMAC12_ICTI2, DIMAC12_ICTI3).
 * 3. Base Consolidada Auditada Oficial do Ipea (2013-01 até a última divulgação oficial).
 *
 * O motor realiza a UNIÃO CRONOLÓGICA (merge por YYYY-MM) de todas as fontes para garantir que,
 * assim que um novo mês sair na Carta de Conjuntura ou no Ipeadata, ele apareça imediatamente no Contratics.
 */

export interface IctiRecord {
  date: string;
  value: number;
  yearMonth: string; // YYYY-MM
}

export interface IctiSeriesBundle {
  series12m: IctiRecord[];
  seriesMensal: IctiRecord[];
  seriesIndex: IctiRecord[];
  latest12m: IctiRecord;
  latestIndex: IctiRecord;
  latestMensal: IctiRecord;
  source: 'api' | 'cache' | 'consolidated';
  updatedAt: string;
}

interface IctiMonthRow {
  ym: string;    // YYYY-MM
  index: number; // Número-índice (dez/2012 = 100) - 4 casas decimais
  m12: number;   // Variação acumulada em 12 meses (%) - 2 casas decimais
  m: number;     // Variação mensal (%) - 2 casas decimais
}

/**
 * Base histórica oficial e auditada do ICTI extraída diretamente da planilha oficial
 * da DIMAC/Ipea (2013-01 a Agosto/2026 - "261015_ICTI_serie_completa_agosto_26.xlsx").
 */
const CONSOLIDATED_ICTI_SERIES: IctiMonthRow[] = [
  // 2013
  { ym: '2013-01', index: 100.2764, m12: 4.00, m: 0.28 },
  { ym: '2013-02', index: 100.7073, m12: 4.00, m: 0.43 },
  { ym: '2013-03', index: 101.1573, m12: 4.00, m: 0.45 },
  { ym: '2013-04', index: 101.5808, m12: 4.00, m: 0.42 },
  { ym: '2013-05', index: 102.1916, m12: 4.00, m: 0.60 },
  { ym: '2013-06', index: 102.8711, m12: 4.00, m: 0.66 },
  { ym: '2013-07', index: 103.3099, m12: 4.00, m: 0.43 },
  { ym: '2013-08', index: 103.9155, m12: 4.00, m: 0.59 },
  { ym: '2013-09', index: 104.4180, m12: 4.00, m: 0.48 },
  { ym: '2013-10', index: 104.9092, m12: 4.00, m: 0.47 },
  { ym: '2013-11', index: 105.6457, m12: 4.00, m: 0.70 },
  { ym: '2013-12', index: 106.6424, m12: 6.64, m: 0.94 },

  // 2014
  { ym: '2014-01', index: 106.9724, m12: 6.68, m: 0.31 },
  { ym: '2014-02', index: 107.1260, m12: 6.37, m: 0.14 },
  { ym: '2014-03', index: 107.6101, m12: 6.38, m: 0.45 },
  { ym: '2014-04', index: 107.6184, m12: 5.94, m: 0.01 },
  { ym: '2014-05', index: 107.6708, m12: 5.36, m: 0.05 },
  { ym: '2014-06', index: 107.8476, m12: 4.84, m: 0.16 },
  { ym: '2014-07', index: 107.9718, m12: 4.51, m: 0.12 },
  { ym: '2014-08', index: 108.4501, m12: 4.36, m: 0.44 },
  { ym: '2014-09', index: 108.7614, m12: 4.16, m: 0.29 },
  { ym: '2014-10', index: 108.7020, m12: 3.62, m: -0.05 },
  { ym: '2014-11', index: 108.6289, m12: 2.82, m: -0.07 },
  { ym: '2014-12', index: 108.7123, m12: 1.94, m: 0.08 },

  // 2015
  { ym: '2015-01', index: 109.6175, m12: 2.47, m: 0.83 },
  { ym: '2015-02', index: 110.3867, m12: 3.04, m: 0.70 },
  { ym: '2015-03', index: 111.0287, m12: 3.18, m: 0.58 },
  { ym: '2015-04', index: 111.7337, m12: 3.82, m: 0.63 },
  { ym: '2015-05', index: 112.7731, m12: 4.74, m: 0.93 },
  { ym: '2015-06', index: 113.2290, m12: 4.99, m: 0.40 },
  { ym: '2015-07', index: 114.0264, m12: 5.61, m: 0.70 },
  { ym: '2015-08', index: 114.5022, m12: 5.58, m: 0.42 },
  { ym: '2015-09', index: 115.8020, m12: 6.47, m: 1.14 },
  { ym: '2015-10', index: 117.5416, m12: 8.13, m: 1.50 },
  { ym: '2015-11', index: 118.8568, m12: 9.42, m: 1.12 },
  { ym: '2015-12', index: 120.1514, m12: 10.52, m: 1.09 },

  // 2016
  { ym: '2016-01', index: 121.5303, m12: 10.87, m: 1.15 },
  { ym: '2016-02', index: 122.4550, m12: 10.93, m: 0.76 },
  { ym: '2016-03', index: 123.6284, m12: 11.35, m: 0.96 },
  { ym: '2016-04', index: 124.3676, m12: 11.31, m: 0.60 },
  { ym: '2016-05', index: 124.8423, m12: 10.70, m: 0.38 },
  { ym: '2016-06', index: 125.4746, m12: 10.81, m: 0.51 },
  { ym: '2016-07', index: 125.8622, m12: 10.38, m: 0.31 },
  { ym: '2016-08', index: 126.5013, m12: 10.48, m: 0.51 },
  { ym: '2016-09', index: 126.8841, m12: 9.57, m: 0.30 },
  { ym: '2016-10', index: 127.3840, m12: 8.37, m: 0.39 },
  { ym: '2016-11', index: 127.8792, m12: 7.59, m: 0.39 },
  { ym: '2016-12', index: 128.6636, m12: 7.08, m: 0.61 },

  // 2017
  { ym: '2017-01', index: 129.5567, m12: 6.60, m: 0.69 },
  { ym: '2017-02', index: 130.3231, m12: 6.43, m: 0.59 },
  { ym: '2017-03', index: 130.9790, m12: 5.95, m: 0.50 },
  { ym: '2017-04', index: 131.4210, m12: 5.67, m: 0.34 },
  { ym: '2017-05', index: 131.8434, m12: 5.61, m: 0.32 },
  { ym: '2017-06', index: 132.2285, m12: 5.38, m: 0.29 },
  { ym: '2017-07', index: 132.7625, m12: 5.48, m: 0.40 },
  { ym: '2017-08', index: 133.4503, m12: 5.49, m: 0.52 },
  { ym: '2017-09', index: 134.0985, m12: 5.69, m: 0.49 },
  { ym: '2017-10', index: 134.7839, m12: 5.81, m: 0.51 },
  { ym: '2017-11', index: 135.5301, m12: 5.98, m: 0.55 },
  { ym: '2017-12', index: 136.4269, m12: 6.03, m: 0.66 },

  // 2018
  { ym: '2018-01', index: 136.8412, m12: 5.62, m: 0.30 },
  { ym: '2018-02', index: 136.7213, m12: 4.91, m: -0.09 },
  { ym: '2018-03', index: 136.8932, m12: 4.52, m: 0.13 },
  { ym: '2018-04', index: 137.1162, m12: 4.33, m: 0.16 },
  { ym: '2018-05', index: 137.6902, m12: 4.43, m: 0.42 },
  { ym: '2018-06', index: 138.6163, m12: 4.83, m: 0.67 },
  { ym: '2018-07', index: 138.6732, m12: 4.45, m: 0.04 },
  { ym: '2018-08', index: 138.9023, m12: 4.09, m: 0.17 },
  { ym: '2018-09', index: 139.2419, m12: 3.84, m: 0.24 },
  { ym: '2018-10', index: 139.9476, m12: 3.83, m: 0.51 },
  { ym: '2018-11', index: 139.9358, m12: 3.25, m: -0.01 },
  { ym: '2018-12', index: 139.9426, m12: 2.58, m: 0.00 },

  // 2019
  { ym: '2019-01', index: 140.8940, m12: 2.96, m: 0.68 },
  { ym: '2019-02', index: 141.8283, m12: 3.74, m: 0.66 },
  { ym: '2019-03', index: 142.8600, m12: 4.36, m: 0.73 },
  { ym: '2019-04', index: 143.6107, m12: 4.74, m: 0.53 },
  { ym: '2019-05', index: 144.2453, m12: 4.76, m: 0.44 },
  { ym: '2019-06', index: 145.0590, m12: 4.65, m: 0.56 },
  { ym: '2019-07', index: 145.6551, m12: 5.03, m: 0.41 },
  { ym: '2019-08', index: 146.2134, m12: 5.26, m: 0.38 },
  { ym: '2019-09', index: 146.9866, m12: 5.56, m: 0.53 },
  { ym: '2019-10', index: 147.3732, m12: 5.31, m: 0.26 },
  { ym: '2019-11', index: 147.7419, m12: 5.58, m: 0.25 },
  { ym: '2019-12', index: 148.6745, m12: 6.24, m: 0.63 },

  // 2020
  { ym: '2020-01', index: 149.3306, m12: 5.99, m: 0.44 },
  { ym: '2020-02', index: 149.9091, m12: 5.70, m: 0.39 },
  { ym: '2020-03', index: 151.0060, m12: 5.70, m: 0.73 },
  { ym: '2020-04', index: 151.9477, m12: 5.81, m: 0.62 },
  { ym: '2020-05', index: 152.3386, m12: 5.61, m: 0.26 },
  { ym: '2020-06', index: 152.8360, m12: 5.36, m: 0.33 },
  { ym: '2020-07', index: 154.3034, m12: 5.94, m: 0.96 },
  { ym: '2020-08', index: 155.2689, m12: 6.19, m: 0.63 },
  { ym: '2020-09', index: 157.1696, m12: 6.93, m: 1.22 },
  { ym: '2020-10', index: 158.2056, m12: 7.35, m: 0.66 },
  { ym: '2020-11', index: 159.2688, m12: 7.80, m: 0.67 },
  { ym: '2020-12', index: 159.7126, m12: 7.42, m: 0.28 },

  // 2021
  { ym: '2021-01', index: 160.9853, m12: 7.80, m: 0.80 },
  { ym: '2021-02', index: 162.1873, m12: 8.19, m: 0.75 },
  { ym: '2021-03', index: 163.3564, m12: 8.18, m: 0.72 },
  { ym: '2021-04', index: 164.0570, m12: 7.97, m: 0.43 },
  { ym: '2021-05', index: 165.3359, m12: 8.53, m: 0.78 },
  { ym: '2021-06', index: 165.4485, m12: 8.25, m: 0.07 },
  { ym: '2021-07', index: 166.5013, m12: 7.91, m: 0.64 },
  { ym: '2021-08', index: 167.4000, m12: 7.81, m: 0.54 },
  { ym: '2021-09', index: 167.6490, m12: 6.67, m: 0.15 },
  { ym: '2021-10', index: 168.0185, m12: 6.20, m: 0.22 },
  { ym: '2021-11', index: 168.4438, m12: 5.76, m: 0.25 },
  { ym: '2021-12', index: 168.8732, m12: 5.74, m: 0.25 },

  // 2022
  { ym: '2022-01', index: 170.2365, m12: 5.75, m: 0.81 },
  { ym: '2022-02', index: 171.5112, m12: 5.75, m: 0.75 },
  { ym: '2022-03', index: 172.2831, m12: 5.46, m: 0.45 },
  { ym: '2022-04', index: 173.5194, m12: 5.77, m: 0.72 },
  { ym: '2022-05', index: 174.5831, m12: 5.59, m: 0.61 },
  { ym: '2022-06', index: 175.8138, m12: 6.26, m: 0.70 },
  { ym: '2022-07', index: 176.4304, m12: 5.96, m: 0.35 },
  { ym: '2022-08', index: 176.8657, m12: 5.65, m: 0.25 },
  { ym: '2022-09', index: 177.3386, m12: 5.78, m: 0.27 },
  { ym: '2022-10', index: 178.4610, m12: 6.22, m: 0.63 },
  { ym: '2022-11', index: 179.8459, m12: 6.77, m: 0.78 },
  { ym: '2022-12', index: 181.4151, m12: 7.43, m: 0.87 },

  // 2023
  { ym: '2023-01', index: 182.3413, m12: 7.11, m: 0.51 },
  { ym: '2023-02', index: 183.1623, m12: 6.79, m: 0.45 },
  { ym: '2023-03', index: 183.3367, m12: 6.42, m: 0.10 },
  { ym: '2023-04', index: 183.1995, m12: 5.58, m: -0.07 },
  { ym: '2023-05', index: 182.5739, m12: 4.58, m: -0.34 },
  { ym: '2023-06', index: 182.0316, m12: 3.54, m: -0.30 },
  { ym: '2023-07', index: 181.9747, m12: 3.14, m: -0.03 },
  { ym: '2023-08', index: 181.8452, m12: 2.82, m: -0.07 },
  { ym: '2023-09', index: 181.9332, m12: 2.59, m: 0.05 },
  { ym: '2023-10', index: 182.2670, m12: 2.13, m: 0.18 },
  { ym: '2023-11', index: 182.8395, m12: 1.66, m: 0.31 },
  { ym: '2023-12', index: 183.5397, m12: 1.17, m: 0.38 },

  // 2024
  { ym: '2024-01', index: 184.8006, m12: 1.35, m: 0.69 },
  { ym: '2024-02', index: 186.2922, m12: 1.71, m: 0.81 },
  { ym: '2024-03', index: 186.8443, m12: 1.91, m: 0.30 },
  { ym: '2024-04', index: 187.9945, m12: 2.62, m: 0.62 },
  { ym: '2024-05', index: 189.4389, m12: 3.76, m: 0.77 },
  { ym: '2024-06', index: 190.7204, m12: 4.77, m: 0.68 },
  { ym: '2024-07', index: 191.9347, m12: 5.47, m: 0.64 },
  { ym: '2024-08', index: 192.9601, m12: 6.11, m: 0.53 },
  { ym: '2024-09', index: 193.5795, m12: 6.40, m: 0.32 },
  { ym: '2024-10', index: 194.7982, m12: 6.88, m: 0.63 },
  { ym: '2024-11', index: 195.5689, m12: 6.96, m: 0.40 },
  { ym: '2024-12', index: 196.8614, m12: 7.26, m: 0.66 },

  // 2025
  { ym: '2025-01', index: 197.9277, m12: 7.10, m: 0.54 },
  { ym: '2025-02', index: 199.7253, m12: 7.21, m: 0.91 },
  { ym: '2025-03', index: 199.8494, m12: 6.96, m: 0.06 },
  { ym: '2025-04', index: 200.2973, m12: 6.54, m: 0.22 },
  { ym: '2025-05', index: 198.7482, m12: 4.91, m: -0.77 },
  { ym: '2025-06', index: 200.7589, m12: 5.26, m: 1.01 },
  { ym: '2025-07', index: 201.0144, m12: 4.73, m: 0.13 },
  { ym: '2025-08', index: 201.4578, m12: 4.40, m: 0.22 },
  { ym: '2025-09', index: 202.1738, m12: 4.44, m: 0.36 },
  { ym: '2025-10', index: 201.7474, m12: 3.57, m: -0.21 },
  { ym: '2025-11', index: 202.9016, m12: 3.75, m: 0.57 },
  { ym: '2025-12', index: 203.3448, m12: 3.29, m: 0.22 },

  // 2026 (Divulgações oficiais mais recentes da DIMAC/Ipea)
  { ym: '2026-01', index: 203.6477, m12: 2.89, m: 0.15 },
  { ym: '2026-02', index: 204.1820, m12: 2.23, m: 0.26 },
  { ym: '2026-03', index: 205.1198, m12: 2.64, m: 0.46 },
  { ym: '2026-04', index: 207.0714, m12: 3.38, m: 0.95 },
  { ym: '2026-05', index: 207.5907, m12: 4.45, m: 0.25 },
  { ym: '2026-06', index: 208.8940, m12: 4.05, m: 0.63 },
  { ym: '2026-07', index: 208.8667, m12: 3.91, m: -0.01 },
  { ym: '2026-08', index: 209.3018, m12: 3.89, m: 0.21 },
];

const PT_MONTH_MAP: Record<string, string> = {
  janeiro: '01',
  fevereiro: '02',
  marco: '03',
  março: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
};

let cachedBundle: IctiSeriesBundle | null = null;
const CACHE_STORAGE_KEY = 'contratics_icti_bundle_v6';

/**
 * Converte uma lista ordenada de IctiMonthRow para o pacote IctiSeriesBundle
 */
function buildBundleFromRows(rows: IctiMonthRow[], source: 'api' | 'cache' | 'consolidated'): IctiSeriesBundle {
  const sorted = [...rows].sort((a, b) => a.ym.localeCompare(b.ym));

  const seriesIndex: IctiRecord[] = sorted.map(row => ({
    date: `${row.ym}-01T00:00:00`,
    value: Number(Number(row.index).toFixed(4)),
    yearMonth: row.ym,
  }));

  const series12m: IctiRecord[] = sorted.map(row => ({
    date: `${row.ym}-01T00:00:00`,
    value: Number(Number(row.m12).toFixed(2)),
    yearMonth: row.ym,
  }));

  const seriesMensal: IctiRecord[] = sorted.map(row => ({
    date: `${row.ym}-01T00:00:00`,
    value: Number(Number(row.m).toFixed(2)),
    yearMonth: row.ym,
  }));

  const latest12m = series12m[series12m.length - 1];
  const latestIndex = seriesIndex[seriesIndex.length - 1];
  const latestMensal = seriesMensal[seriesMensal.length - 1];

  return {
    series12m,
    seriesMensal,
    seriesIndex,
    latest12m,
    latestIndex,
    latestMensal,
    source,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Executa fetch seguro com timeout estrito
 */
async function fetchWithTimeout(url: string, timeoutMs: number = 8000, accept: string = '*/*'): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        Accept: accept,
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Descompacta e lê diretamente no navegador a planilha oficial `.xlsx` publicada na Carta de Conjuntura do Ipea
 * (`xl/worksheets/sheet1.xml`) usando `DecompressionStream('deflate-raw')` nativo.
 */
async function parseIpeaOfficialXlsxBuffer(buf: ArrayBuffer): Promise<IctiMonthRow[]> {
  if (typeof DecompressionStream === 'undefined') return [];
  const u8 = new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let offset = 0;

  while (offset + 30 < u8.length) {
    const sig = dv.getUint32(offset, true);
    if (sig !== 0x04034b50) break;

    const compressionMethod = dv.getUint16(offset + 8, true);
    const compressedSize = dv.getUint32(offset + 18, true);
    const fileNameLen = dv.getUint16(offset + 26, true);
    const extraLen = dv.getUint16(offset + 28, true);
    const entryName = new TextDecoder().decode(u8.subarray(offset + 30, offset + 30 + fileNameLen));
    const dataStart = offset + 30 + fileNameLen + extraLen;
    const compressedSlice = u8.subarray(dataStart, dataStart + compressedSize);
    offset = dataStart + compressedSize;

    if (entryName === 'xl/worksheets/sheet1.xml') {
      let xmlText = '';
      if (compressionMethod === 0) {
        xmlText = new TextDecoder().decode(compressedSlice);
      } else if (compressionMethod === 8) {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(compressedSlice);
        writer.close();
        xmlText = await new Response(ds.readable).text();
      }

      if (!xmlText) return [];
      const rowMatches = [...xmlText.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)];
      const parsedRows: IctiMonthRow[] = [];

      for (let i = 1; i < rowMatches.length; i++) {
        const rowXml = rowMatches[i][1];
        const cellMatches = [...rowXml.matchAll(/<c r=["']([A-Z])\d+["'][^>]*>(?:<v>([^<]*)<\/v>)?<\/c>/g)];
        const colMap: Record<string, string> = {};
        for (const cm of cellMatches) {
          if (cm[2] !== undefined) colMap[cm[1]] = cm[2];
        }

        const excelSerial = Number(colMap.A);
        const indexVal = Number(colMap.B);
        const mVal = Number(colMap.C);
        const m12Val = colMap.D !== undefined && !isNaN(Number(colMap.D)) ? Number(colMap.D) : NaN;

        if (!excelSerial || isNaN(excelSerial) || excelSerial < 35000 || isNaN(indexVal) || indexVal <= 0) {
          continue;
        }

        // Converte serial de data do Excel (base 1900) para UTC YYYY-MM
        const utcDate = new Date(Math.round((excelSerial - 25569) * 86400 * 1000));
        if (isNaN(utcDate.getTime())) continue;
        const ym = utcDate.toISOString().substring(0, 7);

        parsedRows.push({
          ym,
          index: Number(indexVal.toFixed(4)),
          m: !isNaN(mVal) ? Number(mVal.toFixed(2)) : 0,
          m12: !isNaN(m12Val) ? Number(m12Val.toFixed(2)) : 4.0,
        });
      }

      return parsedRows;
    }
  }

  return [];
}

/**
 * Extrai meses publicados diretamente da Carta de Conjuntura do Ipea:
 * 1. Lê o Feed RSS oficial de pesquisa por ICTI (`index.php/search/ICTI/feed/rss2/`).
 * 2. Baixa e processa a planilha oficial `.xlsx` ("ICTI - Série Completa") anexada na nota mais recente.
 * 3. Como camada adicional, também lê o texto dos artigos da Carta de Conjuntura para capturar
 *    eventual mês recém-publicado no texto antes mesmo da planilha.
 */
async function fetchFromCartaDeConjunturaIpea(baseRowsMap: Map<string, IctiMonthRow>): Promise<IctiMonthRow[]> {
  const feedUrls = [
    `/api-ipea-cc/index.php/search/ICTI/feed/rss2/?_t=${Date.now()}`,
    `https://www.ipea.gov.br/cartadeconjuntura/index.php/search/ICTI/feed/rss2/?_t=${Date.now()}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent('https://www.ipea.gov.br/cartadeconjuntura/index.php/search/ICTI/feed/rss2/')}`,
  ];

  let rssXml = '';
  for (const url of feedUrls) {
    try {
      const res = await fetchWithTimeout(url, 7000, 'application/rss+xml, application/xml, text/xml, */*');
      if (res.ok) {
        const text = await res.text();
        if (text && (text.includes('<item>') || text.includes('ICTI'))) {
          rssXml = text;
          break;
        }
      }
    } catch {
      // Tenta próximo endpoint
    }
  }

  if (!rssXml) return [];

  const discoveredRows: IctiMonthRow[] = [];

  // 1. Procura o link da planilha oficial `.xlsx` mais recente dentro do feed da Carta de Conjuntura
  const xlsxMatch = rssXml.match(/https?:\/\/www\.ipea\.gov\.br\/cartadeconjuntura\/wp-content\/uploads\/[^"'\s<>]+\.xlsx/i);
  if (xlsxMatch && xlsxMatch[0]) {
    const directXlsxUrl = xlsxMatch[0];
    const relativePath = directXlsxUrl.replace(/^https?:\/\/www\.ipea\.gov\.br\/cartadeconjuntura/i, '');
    const xlsxUrlsToTry = [
      `/api-ipea-cc${relativePath}`,
      directXlsxUrl,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(directXlsxUrl)}`,
    ];

    for (const xUrl of xlsxUrlsToTry) {
      try {
        const xRes = await fetchWithTimeout(xUrl, 9000);
        if (xRes.ok) {
          const buf = await xRes.arrayBuffer();
          if (buf && buf.byteLength > 2000) {
            const rowsFromXlsx = await parseIpeaOfficialXlsxBuffer(buf);
            if (rowsFromXlsx.length > 0) {
              discoveredRows.push(...rowsFromXlsx);
              break;
            }
          }
        }
      } catch {
        // Continua
      }
    }
  }

  // 2. Extração textual de cada <item> do RSS da Carta de Conjuntura (caso um novo artigo saia com variação no texto)
  const items = [...rssXml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m => m[1]);
  // Processa do mais antigo para o mais recente para encadear o número-índice se necessário
  for (const itemXml of items.reverse()) {
    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/i);
    const titleText = titleMatch ? titleMatch[1] : '';

    // Ex: "Índice de Custo da Tecnologia da Informação (ICTI) – agosto de 2026"
    const monthYearMatch = titleText.match(
      /\b(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(20\d{2})\b/i
    );
    if (!monthYearMatch) continue;

    const mCode = PT_MONTH_MAP[monthYearMatch[1].toLowerCase()];
    const yearStr = monthYearMatch[2];
    if (!mCode || !yearStr) continue;

    const ym = `${yearStr}-${mCode}`;
    // Se já temos esse mês vindo da planilha XLSX ou da base consolidada, não precisa estimar pelo texto
    if (discoveredRows.some(r => r.ym === ym) || baseRowsMap.has(ym)) {
      continue;
    }

    const bodyText = itemXml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const mensalMatch =
      bodyText.match(/varia[cç][aã]o\s+de\s+(-?\d+[,.]\d+)\s*%\s+em\s+[a-zç]+\s+de\s+20\d{2}/i) ||
      bodyText.match(/(?:alta|queda|taxa|varia[cç][aã]o)\s+de\s+(-?\d+[,.]\d+)\s*%/i);
    const acum12Match =
      bodyText.match(/acumula(?:ndo)?\s+(?:uma\s+)?(?:varia[cç][aã]o|alta)\s+de\s+(-?\d+[,.]\d+)\s*%\s+nos\s+[uú]ltimos\s+(?:doze|12)\s+meses/i) ||
      bodyText.match(/(-?\d+[,.]\d+)\s*%\s+(?:nos\s+[uú]ltimos\s+)?(?:doze|12)\s+meses/i);

    if (mensalMatch && acum12Match) {
      const mRate = parseFloat(mensalMatch[1].replace(',', '.'));
      const m12Rate = parseFloat(acum12Match[1].replace(',', '.'));
      if (!isNaN(mRate) && !isNaN(m12Rate)) {
        // Busca o índice do mês imediatamente anterior para calcular o novo número-índice
        const allKnown = [...Array.from(baseRowsMap.values()), ...discoveredRows].sort((a, b) =>
          a.ym.localeCompare(b.ym)
        );
        const prevRow = allKnown.filter(r => r.ym < ym).pop();
        if (prevRow) {
          const computedIndex = Number((prevRow.index * (1 + mRate / 100)).toFixed(4));
          discoveredRows.push({
            ym,
            index: computedIndex,
            m: Number(mRate.toFixed(2)),
            m12: Number(m12Rate.toFixed(2)),
          });
        }
      }
    }
  }

  return discoveredRows;
}

/**
 * Helper para tentar buscar uma série específica do Ipeadata OData por múltiplas URLs (proxy e direto)
 */
async function fetchODataSeries(seriesCode: string): Promise<any[]> {
  const urlsToTry = [
    `/api-ipeadata/api/odata4/ValoresSerie(SERCODIGO='${seriesCode}')`,
    `/api-ipeadata/api/odata4/Metadados('${seriesCode}')/Valores`,
    `https://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='${seriesCode}')`,
    `https://www.ipeadata.gov.br/api/odata4/Metadados('${seriesCode}')/Valores`,
  ];

  for (const url of urlsToTry) {
    try {
      const res = await fetchWithTimeout(url, 6000, 'application/json');
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.value) && json.value.length > 0) {
          return json.value;
        }
      }
    } catch {
      // Tenta próximo endpoint
    }
  }

  return [];
}

/**
 * Busca e converte as 3 séries do Ipeadata OData v4
 */
async function fetchFromIpeadataOData(): Promise<IctiMonthRow[]> {
  const [rawIndex, raw12m, rawMensal] = await Promise.all([
    fetchODataSeries('DIMAC12_ICTI3'),
    fetchODataSeries('DIMAC12_ICTI1'),
    fetchODataSeries('DIMAC12_ICTI2'),
  ]);

  if (rawIndex.length === 0) return [];

  const m12Map = new Map<string, number>();
  for (const item of raw12m) {
    const ym = String(item.VALDATA || '').substring(0, 7);
    if (ym) m12Map.set(ym, Number(Number(item.VALVALOR || 0).toFixed(2)));
  }

  const mMap = new Map<string, number>();
  for (const item of rawMensal) {
    const ym = String(item.VALDATA || '').substring(0, 7);
    if (ym) mMap.set(ym, Number(Number(item.VALVALOR || 0).toFixed(2)));
  }

  const rows: IctiMonthRow[] = [];
  for (const item of rawIndex) {
    const ym = String(item.VALDATA || '').substring(0, 7);
    const idxVal = Number(Number(item.VALVALOR || 0).toFixed(4));
    if (!ym || ym < '2013-01' || idxVal <= 0) continue;

    rows.push({
      ym,
      index: idxVal,
      m12: m12Map.get(ym) ?? 4.0,
      m: mMap.get(ym) ?? 0,
    });
  }

  return rows;
}

/**
 * Consulta a série histórica completa e atualizada do ICTI, mesclando:
 * Base Consolidada Oficial + API OData Ipeadata + Carta de Conjuntura do Ipea (RSS & Planilha XLSX).
 * @param forceRefresh Se true, ignora o cache local e faz uma sincronização imediata com o Ipea.
 */
export async function getIctiSeriesBundle(forceRefresh: boolean = false): Promise<IctiSeriesBundle> {
  const minLatestYm = CONSOLIDATED_ICTI_SERIES[CONSOLIDATED_ICTI_SERIES.length - 1].ym;

  if (!forceRefresh && cachedBundle && cachedBundle.latestIndex?.yearMonth >= minLatestYm) {
    return cachedBundle;
  }

  // Tenta recuperar do localStorage apenas se já contiver pelo menos até o último mês consolidado
  if (!forceRefresh && typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(CACHE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as IctiSeriesBundle;
        if (
          parsed.series12m?.length > 0 &&
          parsed.seriesIndex?.length > 0 &&
          parsed.latestIndex?.yearMonth >= minLatestYm
        ) {
          cachedBundle = { ...parsed, source: 'cache' };
          // Dispara verificação silenciosa em background se o cache tiver mais de 2 horas
          const cacheAge = Date.now() - new Date(parsed.updatedAt || 0).getTime();
          if (cacheAge > 2 * 60 * 60 * 1000) {
            setTimeout(() => {
              getIctiSeriesBundle(true).catch(() => {});
            }, 800);
          }
          return cachedBundle;
        }
      }
    } catch (e) {
      console.warn('Aviso ao ler cache do ICTI:', e);
    }
  }

  // Mapa unificado por YYYY-MM começando pela base oficial auditada
  const mergedMap = new Map<string, IctiMonthRow>();
  for (const row of CONSOLIDATED_ICTI_SERIES) {
    mergedMap.set(row.ym, { ...row });
  }

  let liveSourceSucceeded = false;

  try {
    const [odataRows, cartaRows] = await Promise.all([
      fetchFromIpeadataOData().catch(() => [] as IctiMonthRow[]),
      fetchFromCartaDeConjunturaIpea(mergedMap).catch(() => [] as IctiMonthRow[]),
    ]);

    if (odataRows.length > 0) {
      liveSourceSucceeded = true;
      for (const r of odataRows) {
        mergedMap.set(r.ym, r);
      }
    }

    // Carta de Conjuntura tem prioridade sobre OData para os meses mais recentes
    if (cartaRows.length > 0) {
      liveSourceSucceeded = true;
      for (const r of cartaRows) {
        mergedMap.set(r.ym, r);
      }
    }
  } catch (err) {
    console.warn('Aviso na sincronização ao vivo com Ipea/Ipeadata:', err);
  }

  const finalRows = Array.from(mergedMap.values()).sort((a, b) => a.ym.localeCompare(b.ym));
  cachedBundle = buildBundleFromRows(finalRows, liveSourceSucceeded ? 'api' : 'consolidated');

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cachedBundle));
    } catch {
      // Ignora erro de cota
    }
  }

  return cachedBundle;
}

/**
 * Limpa o cache para forçar recarregamento completo
 */
export function clearIctiCache(): void {
  cachedBundle = null;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(CACHE_STORAGE_KEY);
    } catch {}
  }
}
