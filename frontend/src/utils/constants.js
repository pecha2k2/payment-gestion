// Shared workflow and area constants — single source of truth

export const WORKFLOW_ORDER_CON_FACTURA = ['demandante', 'validadora', 'aprobadora', 'contabilidad', 'pagadora', 'sap'];
export const WORKFLOW_ORDER_SIN_FACTURA = ['demandante', 'aprobadora', 'pagadora', 'validadora', 'contabilidad', 'sap'];

export const AREAS_DISPLAY = {
  demandante: 'Demandante',
  validadora: 'Validadora',
  aprobadora: 'Aprobadora',
  contabilidad: 'Contabilidad',
  pagadora: 'Pagadora',
  sap: 'SAP',
};

export const AREA_ICONS = {
  demandante: '📝',
  validadora: '✅',
  aprobadora: '👍',
  contabilidad: '📊',
  pagadora: '💰',
  sap: '☁️',
};

export const AVAILABLE_AREAS = [
  { value: 'demandante', label: '📝 Demandante' },
  { value: 'validadora', label: '✅ Validadora' },
  { value: 'aprobadora', label: '👍 Aprobadora' },
  { value: 'contabilidad', label: '📊 Contabilidad' },
  { value: 'pagadora', label: '💰 Pagadora' },
  { value: 'sap', label: '☁️ SAP' },
];
