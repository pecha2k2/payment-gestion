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

// Action labels per area — what the user does in each step
export const AREA_ACTIONS = {
  demandante: 'Cerrar',
  validadora: 'Validar',
  aprobadora: 'Autorizar',
  contabilidad: 'Contabilizar',
  pagadora: 'Pagar',
  sap: 'Subir a SAP',
};

export const AVAILABLE_AREAS = [
  { value: 'demandante', label: '📝 Demandante' },
  { value: 'validadora', label: '✅ Validadora' },
  { value: 'aprobadora', label: '👍 Aprobadora' },
  { value: 'contabilidad', label: '📊 Contabilidad' },
  { value: 'pagadora', label: '💰 Pagadora' },
  { value: 'sap', label: '☁️ SAP' },
];

// File upload constraints — must match backend ALLOWED_EXTENSIONS in payments.py
export const ALLOWED_FILE_EXTENSIONS = [
  '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.zip', '.msg',
];
export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
