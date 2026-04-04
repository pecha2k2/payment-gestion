// Shared formatting utilities
import { ALLOWED_FILE_EXTENSIONS, MAX_FILE_SIZE_MB, MAX_FILE_SIZE_BYTES } from './constants';

/**
 * Format a number as currency with Spanish locale.
 */
export const formatCurrency = (value, divisa = 'EUR') => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(num) + ' ' + divisa;
};

/**
 * Parse tipo_pago from API response (handles string or enum object).
 */
export const getTipoPagoStr = (tipoPago) => {
  if (!tipoPago) return 'CON_FACTURA';
  if (typeof tipoPago === 'string') return tipoPago;
  return tipoPago.value || 'CON_FACTURA';
};

/**
 * Get workflow order array for a payment based on tipo_pago.
 */
export const getWorkflowOrder = (tipoPago) => {
  const tipo = getTipoPagoStr(tipoPago);
  return tipo === 'SIN_FACTURA'
    ? ['demandante', 'aprobadora', 'pagadora', 'validadora', 'contabilidad', 'sap']
    : ['demandante', 'validadora', 'aprobadora', 'contabilidad', 'pagadora', 'sap'];
};

/**
 * Format a date string to DD/MM/YYYY or DD/MM/YYYY HH:MM:SS.
 * Uses string parsing to avoid timezone conversion by the JS Date object.
 *
 * @param {string} dateStr  - ISO 8601 or YYYY-MM-DD string from the API
 * @param {boolean} showTime - include HH:MM:SS suffix (default: true)
 */
export const formatDate = (dateStr, showTime = true) => {
  if (!dateStr) return '-';
  try {
    // ISO 8601: 2026-04-01T10:00:00 or 2026-04-01T10:00:00Z or with +offset
    if (typeof dateStr === 'string' && dateStr.includes('T')) {
      const [datePart, timePart] = dateStr.split('T');
      const [y, m, d] = datePart.split('-');
      const formatted = `${d}/${m}/${y}`;
      if (!showTime) return formatted;
      // Strip timezone suffix and sub-seconds
      const time = timePart ? timePart.replace(/([+-]\d{2}:\d{2}|Z)$/, '').split('.')[0] : '00:00:00';
      return `${formatted} ${time}`;
    }
    // Plain date: YYYY-MM-DD
    if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    }
    // Already formatted or unknown — return as-is
    return String(dateStr);
  } catch {
    return String(dateStr);
  }
};

/**
 * Validate a File object before upload.
 * Returns { valid: boolean, error: string | null }.
 * Constraints must match backend ALLOWED_EXTENSIONS and MAX_FILE_SIZE in payments.py.
 */
export const validateFile = (file) => {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Tipo de archivo no permitido: ${ext}. Permitidos: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`,
    };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `El archivo excede el límite de ${MAX_FILE_SIZE_MB} MB` };
  }
  return { valid: true, error: null };
};
