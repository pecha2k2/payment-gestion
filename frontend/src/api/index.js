const API_BASE = '/api';

// C-02: Token stored in memory only — NOT in localStorage.
// localStorage is accessible via XSS; memory-only storage eliminates that attack surface.
// Trade-off: the session does NOT persist across page refreshes (user must log in again).
// This is intentional — see REQ-JWT-MEMORY spec.
let accessToken = null;

export function setToken(token) {
  accessToken = token;
}

export function getToken() {
  return accessToken;
}

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    setToken(null);
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }

  return response.json();
}

// Auth
export const api = {
  login: (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    return fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    }).then(async (r) => {
      const data = await r.json().catch(() => ({ detail: 'Error de autenticación' }));
      if (!r.ok) throw new Error(data.detail || 'Error de autenticación');
      return data;
    });
  },
  logout: () => {
    setToken(null);
  },
  getMe: () => request('/auth/me'),

  // Payments
  getPaymentStats: () => request('/payments/stats'),
  getPayments: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/payments${query ? '?' + query : ''}`);
  },
  getPayment: (id) => request(`/payments/${id}`),
  createPayment: (data) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),
  updatePayment: (id, data) => request(`/payments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePayment: (id) => request(`/payments/${id}`, { method: 'DELETE' }),
  cancelPayment: (id) => request(`/payments/${id}/cancel`, { method: 'POST' }),

  // Documents
  uploadDocument: (paymentId, file, tipo, nDocumentoContable) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tipo', tipo);
    if (nDocumentoContable) {
      formData.append('n_documento_contable', nDocumentoContable);
    }
    return fetch(`${API_BASE}/payments/${paymentId}/documents`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: formData,
    }).then(async (r) => {
      const data = await r.json().catch(() => ({ detail: 'Error al subir documento' }));
      if (!r.ok) throw new Error(data.detail || 'Error al subir documento');
      return data;
    });
  },
  uploadDocumentWithComment: (paymentId, commentId, file, tipo, nDocumentoContable) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tipo', tipo);
    if (nDocumentoContable) {
      formData.append('n_documento_contable', nDocumentoContable);
    }
    formData.append('comment_id', commentId);
    return fetch(`${API_BASE}/payments/${paymentId}/documents`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: formData,
    }).then(async (r) => {
      const data = await r.json().catch(() => ({ detail: 'Error al subir documento' }));
      if (!r.ok) throw new Error(data.detail || 'Error al subir documento');
      return data;
    });
  },
  requestDocumentToken: (id) => request(`/documents/${id}/request-token`, { method: 'POST' }),
  downloadDocument: async (id) => {
    const { token } = await api.requestDocumentToken(id);
    return `${API_BASE}/documents/public/${id}/download?token=${token}`;
  },
  viewDocument: async (id) => {
    const { token } = await api.requestDocumentToken(id);
    return `${API_BASE}/documents/public/${id}/view?token=${token}`;
  },
  deleteDocument: (id) => request(`/documents/${id}`, { method: 'DELETE' }),
  downloadAllDocuments: async (paymentId) => {
    // C-05: Request an ephemeral token for the ZIP download (same pattern as downloadDocument).
    // Previously returned a plain URL without auth, making the endpoint publicly accessible.
    const { token } = await request(`/documents/payment/${paymentId}/request-zip-token`, { method: 'POST' });
    return `${API_BASE}/documents/payment/${paymentId}/download-all?token=${token}`;
  },

  // Workflow
  advanceWorkflow: (paymentId, area, comentario) =>
    request(`/payments/${paymentId}/workflow/${area}/advance`, {
      method: 'POST',
      body: JSON.stringify({ comentario }),
    }),
  reverseWorkflow: (paymentId, area, comentario) =>
    request(`/payments/${paymentId}/workflow/${area}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ comentario }),
    }),
  addComment: (paymentId, area, contenido) =>
    request(`/payments/${paymentId}/workflow/${area}/comment`, {
      method: 'POST',
      body: JSON.stringify({ contenido }),
    }),

  // Incidences
  getMyPendingIncidences: () => request('/incidences/my-pending'),
  getIncidencesByUser: (userId) => request(`/incidences/by-user/${userId}`),
  getIncidencesByArea: (area) => request(`/incidences/by-area/${area}`),
  getIncidencesSummary: () => request('/incidences/summary'),

  // Workflow Configs
  getWorkflowConfigs: () => request('/workflow-configs'),
  createWorkflowConfig: (data) => request('/workflow-configs', { method: 'POST', body: JSON.stringify(data) }),
  updateWorkflowConfig: (id, data) => request(`/workflow-configs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Users
  getUsers: () => request('/users'),
  createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  // Search
  search: (q, field) => {
    const params = new URLSearchParams({ q });
    if (field) params.append('field', field);
    return request(`/search?${params.toString()}`);
  },
};

export default api;
