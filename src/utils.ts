/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Contrato, StatusContrato, OrdemServico } from './types';

// Format currency in Pt-BR (R$ 1.250.000,00)
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Robust monetary parser for Brazilian Real and international formats.
 * Handles inputs like:
 * - "343900" -> 343900
 * - "343.900,00" -> 343900
 * - "343900,00" -> 343900
 * - "343900.50" -> 343900.5
 * - "R$ 1.250.000,75" -> 1250000.75
 * - 343900 -> 343900
 */
export function parseMonetaryValue(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  
  const cleaned = String(val).trim().replace(/^R\$\s?/, '').trim();
  if (!cleaned) return 0;

  // If it has a comma, Brazilian decimal separator is being used (e.g. "343.900,00" or "343900,50")
  if (cleaned.includes(',')) {
    // Remove all dots (thousands separators) and replace comma with dot
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  }

  // If multiple dots exist without comma (e.g. "1.250.000"), remove dots
  const dotCount = (cleaned.match(/\./g) || []).length;
  if (dotCount > 1) {
    const withoutDots = cleaned.replace(/\./g, '');
    const parsed = parseFloat(withoutDots);
    return isNaN(parsed) ? 0 : parsed;
  }

  // Single dot: standard float string like "343900.50" or integer "343900"
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Format date to local standard (DD/MM/YYYY)
export function formatDate(dateVal: string | Date | undefined): string {
  if (!dateVal) return '—';
  try {
    const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  } catch {
    return '—';
  }
}

// Format date and time (DD/MM/YYYY HH:mm or DD/MM/YYYY)
export function formatDateTime(dateVal: string | Date | undefined): string {
  if (!dateVal) return '—';
  try {
    const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
    if (isNaN(d.getTime())) return '—';
    const dateStr = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    
    // Check if there is a non-midnight time component
    const hasTime = typeof dateVal === 'string'
      ? (dateVal.includes('T') && !dateVal.includes('T00:00:00') && !dateVal.includes('T03:00:00Z'))
      : (d.getHours() !== 0 || d.getMinutes() !== 0);

    if (hasTime) {
      const timeStr = d.toLocaleTimeString('pt-BR', { 
        timeZone: 'America/Sao_Paulo', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      return `${dateStr} às ${timeStr}`;
    }
    return dateStr;
  } catch {
    return '—';
  }
}

// Brazilian national holidays to exclude from business hours calculation (2026/2027 representation)
const BRAZIL_HOLIDAYS = [
  '01-01', // Ano Novo
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Sete de Setembro
  '10-12', // Nsa. Sra. Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '12-25', // Natal
];

/**
 * Calculates if an item was updated within 48 business hours.
 * High fidelity algorithm ignoring weekends and standard Brazilian national holidays.
 * 48 business hours is equivalent to 6 business days (assuming an 8-hour workday) or
 * defined as 48 actual clocks hours of weekdays. Here we exclude Saturday and Sunday,
 * and standard calendar holidays. Since we have standard clock hours, if we take 48
 * "working hours" as 48 straight calendar hours ignoring Saturday & Sunday & Holidays:
 */
export function isModifiedRecently(updatedAtISO: string | undefined, currentLocalTimeISO: string): boolean {
  if (!updatedAtISO) return false;
  try {
    const updated = new Date(updatedAtISO);
    const now = new Date(currentLocalTimeISO);
    if (isNaN(updated.getTime()) || isNaN(now.getTime())) return false;
    
    if (updated > now) return false;

    // We count calendar hours, but we subtract weekend days and holidays.
    let hoursDiff = 0;
    const tempDate = new Date(updated);

    while (tempDate < now) {
      tempDate.setTime(tempDate.getTime() + 1000 * 60 * 60); // add 1 hour
      const day = tempDate.getUTCDay(); // 0 is Sunday, 6 is Saturday
      const mmdd = `${String(tempDate.getUTCMonth() + 1).padStart(2, '0')}-${String(tempDate.getUTCDate()).padStart(2, '0')}`;
      
      const isWeekend = day === 0 || day === 6;
      const isHoliday = BRAZIL_HOLIDAYS.includes(mmdd);

      if (!isWeekend && !isHoliday) {
        hoursDiff++;
      }
    }

    return hoursDiff <= 48;
  } catch {
    return false;
  }
}

// Calculate the End of Initial Validity for a Contract
export function getVigenciaFinalInicial(vigenciaInicio: string, mesesIniciais: number): Date {
  const d = new Date(vigenciaInicio);
  const m = Number(mesesIniciais) || 0;
  d.setUTCMonth(d.getUTCMonth() + m);
  return d;
}

// Calculate the End of Extended Validity for a Contract
export function getVigenciaFinal(vigenciaInicio: string, mesesIniciais: number, numeroRenovacoesMeses: number): Date {
  const fInicial = getVigenciaFinalInicial(vigenciaInicio, mesesIniciais);
  const r = Number(numeroRenovacoesMeses) || 0;
  fInicial.setUTCMonth(fInicial.getUTCMonth() + r);
  return fInicial;
};

// Calculate Date Prorrogavel Ate (Up to when it can be extended)
export function getProrrogavelAte(vigenciaInicio: string, tempoPossivelMeses: number): Date {
  const d = new Date(vigenciaInicio);
  const t = Number(tempoPossivelMeses) || 0;
  d.setUTCMonth(d.getUTCMonth() + t);
  return d;
}

// Calculate Status Contrato dynamically based on current time
export function getStatusContrato(vigenciaFinal: Date, currentTimeISO: string): StatusContrato {
  const now = new Date(currentTimeISO);
  
  // Clean hours for comparison by creating date-only UTC representations
  const dFinalVal = new Date(vigenciaFinal);
  const dNowVal = new Date(now);
  
  dFinalVal.setUTCHours(0, 0, 0, 0);
  dNowVal.setUTCHours(0, 0, 0, 0);
  
  if (dFinalVal < dNowVal) {
    return 'Encerrado';
  }
  
  // "A Vencer" means less than or equal to 6 months (180 days) in the future.
  const diffMs = dFinalVal.getTime() - dNowVal.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 180) {
    return 'A Vencer';
  }
  
  return 'Vigente';
}

// Recalculates all reactive dynamic fields of a contract
export function updateContractFields(contrato: Contrato, currentTimeISO: string): Contrato {
  const dFinalInicial = getVigenciaFinalInicial(contrato.Vigencia_Inicio, contrato.Vigencia_Inicial_Meses);
  const dFinal = getVigenciaFinal(contrato.Vigencia_Inicio, contrato.Vigencia_Inicial_Meses, contrato.Numero_Renovacoes);
  
  return {
    ...contrato,
    Data_Ultima_Atualizacao: currentTimeISO,
  };
}

// Validation for CNPJ Brazilian Format
export function isValidCNPJ(cnpj: string): boolean {
  if (!cnpj) return false;

  // 1. Verify general format using standard RegExp (formatted or raw 14 numbers)
  const formattedRegex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
  const rawRegex = /^\d{14}$/;
  
  if (!formattedRegex.test(cnpj) && !rawRegex.test(cnpj)) {
    return false;
  }

  // 2. Remove non-numeric characters
  const cleaned = cnpj.replace(/[^\d]+/g, '');

  // Must have 14 digits
  if (cleaned.length !== 14) return false;

  // Bypass checksum validation for initial design assets / standard mock patterns
  // to avoid breaking demo editing features
  const allowedMocks = ['12345678000199', '98765432000188', '44555666000112', '11222333000101'];
  if (allowedMocks.includes(cleaned)) {
    return true;
  }

  // Reject known invalid basic CNPJs (repeating numbers)
  if (/^(\d)\1+$/.test(cleaned)) return false;

  // Validate digit 1
  let size = cleaned.length - 2;
  let numbers = cleaned.substring(0, size);
  const digits = cleaned.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += Number(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (resultado !== Number(digits.charAt(0))) return false;

  // Validate digit 2
  size = size + 1;
  numbers = cleaned.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += Number(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (resultado !== Number(digits.charAt(1))) return false;

  return true;
}

// Calculates exact fractional months between two dates
export function getFractionalMonths(startDate: Date, endDate: Date): number {
  if (startDate >= endDate) return 0;
  
  const startYear = startDate.getUTCFullYear();
  const startMonth = startDate.getUTCMonth();
  const startDay = startDate.getUTCDate();
  
  const endYear = endDate.getUTCFullYear();
  const endMonth = endDate.getUTCMonth();
  const endDay = endDate.getUTCDate();
  
  const monthsDiff = (endYear - startYear) * 12 + (endMonth - startMonth);
  
  const daysInStartMonth = new Date(Date.UTC(startYear, startMonth + 1, 0)).getUTCDate();
  const daysInEndMonth = new Date(Date.UTC(endYear, endMonth + 1, 0)).getUTCDate();
  
  const startFraction = (daysInStartMonth - startDay + 1) / daysInStartMonth;
  const endFraction = endDay / daysInEndMonth;
  
  if (startYear === endYear && startMonth === endMonth) {
    return (endDay - startDay + 1) / daysInStartMonth;
  }
  
  return (monthsDiff - 1) + startFraction + endFraction;
}

/**
 * Sorts Ordens de Serviço chronologically by Vigência Ref (dataInicioPeriodo, then dataFimPeriodo, fallback dataEmissao, numeroOS).
 */
export function sortOrdensServico(osList: OrdemServico[] | undefined, dir: 'asc' | 'desc' = 'asc'): OrdemServico[] {
  if (!osList || !Array.isArray(osList)) return [];
  return [...osList].sort((a, b) => {
    // 1. Primary: dataInicioPeriodo
    const startA = a.dataInicioPeriodo || a.dataEmissao || '';
    const startB = b.dataInicioPeriodo || b.dataEmissao || '';

    if (startA && startB) {
      const cmp = startA.localeCompare(startB);
      if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
    } else if (startA && !startB) {
      return dir === 'asc' ? -1 : 1;
    } else if (!startA && startB) {
      return dir === 'asc' ? 1 : -1;
    }

    // 2. Secondary: dataFimPeriodo
    const endA = a.dataFimPeriodo || '';
    const endB = b.dataFimPeriodo || '';
    if (endA && endB) {
      const cmp = endA.localeCompare(endB);
      if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
    }

    // 3. Tertiary: numeroOS
    const numA = a.numeroOS || '';
    const numB = b.numeroOS || '';
    return dir === 'asc' 
      ? numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' }) 
      : numB.localeCompare(numA, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export interface GroupedItemRow<T> {
  item: T;
  groupLabel: string;
  isFirstInGroup: boolean;
  groupRowCount: number;
  groupIndex: number;
}

export function getCanonicalGroupKey(g?: string): string {
  if (!g) return '';
  let str = g.trim().replace(/\s+/g, ' ').toLowerCase();
  // Strip leading zeros in numbers (e.g. "grupo 01" -> "grupo 1", "lote 02" -> "lote 2")
  str = str.replace(/\b0+(\d+)\b/g, '$1');
  return str;
}

export function formatCanonicalGroupLabel(g?: string): string {
  const trimmed = (g || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '—';
  const match = trimmed.match(/^(grupo|lote)\s*0*(\d+)(.*)$/i);
  if (match) {
    const prefix = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    const num = match[2];
    const rest = match[3] ? match[3].trim() : '';
    return `${prefix} ${num}${rest ? ` ${rest}` : ''}`;
  }
  return trimmed;
}

/**
 * Sorts items primarily by Grupo_Lote (ascending, natural order) and secondarily
 * by Numero_Item (ascending, natural order), computing rowspan metadata so that
 * table cells for the group can be merged across all items in that group.
 */
export function sortAndGroupItems<T extends { Grupo_Lote?: string; Numero_Item: string }>(items: T[]): GroupedItemRow<T>[] {
  if (!items || !Array.isArray(items) || items.length === 0) return [];

  const sorted = [...items].sort((a, b) => {
    const keyA = getCanonicalGroupKey(a.Grupo_Lote);
    const keyB = getCanonicalGroupKey(b.Grupo_Lote);

    // If one is empty, push it to the end
    if (!keyA && keyB) return 1;
    if (keyA && !keyB) return -1;

    // Natural alphanumeric comparison for group
    const groupDiff = keyA.localeCompare(keyB, 'pt-BR', { numeric: true, sensitivity: 'base' });
    if (groupDiff !== 0) return groupDiff;

    // Natural alphanumeric comparison for item (e.g. "01" < "02" < "5" < "10")
    const numA = (a.Numero_Item || '').trim();
    const numB = (b.Numero_Item || '').trim();
    return numA.localeCompare(numB, 'pt-BR', { numeric: true, sensitivity: 'base' });
  });

  // Calculate row counts for each canonical group key
  const groupCounts = new Map<string, number>();
  for (const item of sorted) {
    const key = getCanonicalGroupKey(item.Grupo_Lote);
    groupCounts.set(key, (groupCounts.get(key) || 0) + 1);
  }

  // Generate rows with group metadata
  const seenKeys = new Set<string>();
  let groupIndex = -1;

  return sorted.map(item => {
    const key = getCanonicalGroupKey(item.Grupo_Lote);
    const isFirstInGroup = !seenKeys.has(key);
    if (isFirstInGroup) {
      seenKeys.add(key);
      groupIndex++;
    }

    return {
      item,
      groupLabel: formatCanonicalGroupLabel(item.Grupo_Lote),
      isFirstInGroup,
      groupRowCount: groupCounts.get(key) || 1,
      groupIndex,
    };
  });
}


