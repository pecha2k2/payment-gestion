// Shared formatting utilities

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
 * Format a date string to DD/MM/YYYY.
 * Handles ISO 8601, slash-separated, and plain date strings.
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    // Handle ISO 8601 (2026-04-01T10:00:00Z)
    if (dateStr.includes('T')) {
      const [datePart] = dateStr.split('T');
      const [y, m, d] = datePart.split('-');
      return `${d}/${m}/${y}`;
    }
    // Handle YYYY-MM-DD
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    }
    // Already formatted or unknown — return as-is
    return dateStr;
  } catch {
    return dateStr;
  }
};
