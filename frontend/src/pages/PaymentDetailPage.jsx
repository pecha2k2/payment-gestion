import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

const AREAS_ORDER_CON_FACTURA = ['demandante', 'validadora', 'aprobadora', 'contabilidad', 'pagadora', 'sap'];
const AREAS_ORDER_SIN_FACTURA = ['demandante', 'aprobadora', 'pagadora', 'validadora', 'contabilidad', 'sap'];

const WORKFLOW_ORDER_CON_FACTURA = ['demandante', 'validadora', 'aprobadora', 'contabilidad', 'pagadora', 'sap'];
const WORKFLOW_ORDER_SIN_FACTURA = ['demandante', 'aprobadora', 'pagadora', 'validadora', 'contabilidad', 'sap'];

const AREAS_DISPLAY = {
  demandante: 'Demandante',
  validadora: 'Validadora',
  aprobadora: 'Aprobadora',
  contabilidad: 'Contabilidad',
  pagadora: 'Pagadora',
  sap: 'SAP',
};

// Format number with Spanish thousands separator
const formatCurrency = (value, divisa = 'EUR') => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(num) + ' ' + divisa;
};

const AREA_ICONS = {
  demandante: '📝',
  validadora: '✅',
  aprobadora: '👍',
  contabilidad: '📊',
  pagadora: '💰',
  sap: '☁️',
};

const AREA_ACTIONS = {
  demandante: 'Cerrar',
  validadora: 'Validar',
  aprobadora: 'Autorizar',
  contabilidad: 'Contabilizar',
  pagadora: 'Pagar',
  sap: 'Subir a SAP',
};

// Areas each role can access
const AREAS_BY_ROLE = {
  admin: ['demandante', 'validadora', 'aprobadora', 'contabilidad', 'pagadora', 'sap'],
  demandante: ['demandante'],
  validador: ['validadora'],
  aprobador: ['aprobadora'],
  contador: ['contabilidad', 'sap'],  // Contador can do contabilidad and SAP
  pagador: ['pagadora'],
  sap: ['sap'],
};

// Helper to extract string value from enum
const getTipoPagoStr = (tipo) => {
  if (!tipo) return 'CON_FACTURA';
  if (typeof tipo === 'string') return tipo;
  return tipo.value || tipo;
};

const getWorkflowDisplayEstado = (estado) => {
  switch (estado) {
    case 'PENDIENTE': return 'Pendiente';
    case 'EN_PROCESO': return 'Terminado';
    case 'APROBADO': return 'Aprobado';
    case 'RECHAZADO': return 'Rechazado';
    case 'REVERSADO': return 'Reversado';
    default: return estado;
  }
};

const formatDate = (dateStr, showTime = true) => {
    if (!dateStr) return '-';
    if (typeof dateStr !== 'string') return String(dateStr);
    
    // ISO format: 2026-03-31T00:00:00 -> 31/03/2026 00:00:00
    if (dateStr.includes('T')) {
      const [datePart, timePart] = dateStr.split('T');
      const dateParts = datePart.split('-');
      if (dateParts.length === 3) {
        const dateFormatted = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        if (!showTime) return dateFormatted;
        const time = timePart ? timePart.split('.')[0] : '00:00:00';
        return `${dateFormatted} ${time}`;
      }
    }
    
    // dd/mm/yyyy or similar
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2].split(' ')[0]}`;
      }
    }
    
    return dateStr;
  };

export default function PaymentDetailPage({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(null);
  const [workflowStates, setWorkflowStates] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentAttachment, setCommentAttachment] = useState(null);
  const [commentArea, setCommentArea] = useState(null);
  const [addingComment, setAddingComment] = useState(false);
  const [actionModal, setActionModal] = useState(null);
  const [actionComment, setActionComment] = useState('');
  const [actionDocuments, setActionDocuments] = useState([]);
  const [uploadingActionDoc, setUploadingActionDoc] = useState(false);
  const [editingPayment, setEditingPayment] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [commentDoc, setCommentDoc] = useState(null);
  const [actionDragOver, setActionDragOver] = useState(false);
  const [docUploadModal, setDocUploadModal] = useState(false);
  const [pendingDocs, setPendingDocs] = useState([]);
  const [pendingDragOver, setPendingDragOver] = useState(false);
  const [uploadingPending, setUploadingPending] = useState(false);

  useEffect(() => {
    loadPayment();
  }, [id]);

  const loadPayment = async () => {
    try {
      const data = await api.getPayment(id);
      setPayment(data);
      setWorkflowStates(data.workflow_states || []);
      setComments(data.comments || []);
    } catch (err) {
      console.error('Error loading payment:', err);
      alert('Error cargando la petición');
      navigate('/payments');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    setPendingDocs(files);
    setDocUploadModal(true);
  };

  const uploadPendingDocs = async () => {
    if (pendingDocs.length === 0) return;
    setUploadingPending(true);
    try {
      for (const file of pendingDocs) {
        await api.uploadDocument(id, file, 'peticion', '');
      }
      setPendingDocs([]);
      setDocUploadModal(false);
      loadPayment();
      alert('Documento(s) subido(s) correctamente');
    } catch (err) {
      console.error('Error uploading:', err);
      alert('Error subiendo el documento');
    } finally {
      setUploadingPending(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setPendingDocs(files);
      setDocUploadModal(true);
    }
  };

  const handleAdvance = async () => {
    if (!actionComment.trim()) {
      alert('Debes escribir un comentario para avanzar el workflow');
      return;
    }
    try {
      let comentario = actionComment;
      // Include document filenames in comment if attached
      if (actionDocuments.length > 0) {
        const tipos = ['peticion', 'presupuesto', 'factura', 'documento_contable', 'otro'];
        for (const doc of actionDocuments) {
          await api.uploadDocument(id, doc, 'otro', '');
        }
        const names = actionDocuments.map(d => d.name).join(', ');
        comentario = `${comentario}\n[Adjuntos: ${names}]`;
      }
      await api.advanceWorkflow(id, actionModal.area, comentario);
      setActionModal(null);
      setActionComment('');
      setActionDocuments([]);
      loadPayment();
    } catch (err) {
      console.error('Error advancing:', err);
      alert('Error avanzando el workflow');
    }
  };

  const handleReverse = async () => {
    if (!actionComment.trim()) {
      alert('Debes escribir un motivo para revertir');
      return;
    }
    try {
      await api.reverseWorkflow(id, actionModal.area, actionComment);
      setActionModal(null);
      setActionComment('');
      loadPayment();
    } catch (err) {
      console.error('Error reversing:', err);
      alert('Error revirtiendo el workflow');
    }
  };

  const handleAddComment = async (area) => {
    if (!newComment.trim() || !area) {
      alert('Debes escribir un comentario');
      return;
    }
    setAddingComment(true);
    try {
      let commentContent = newComment;
      // Include document filename in comment if attached
      if (commentDoc) {
        commentContent = `${commentContent}\n[Adjunto: ${commentDoc.name}]`;
      }
      await api.addComment(id, area, commentContent);
      setNewComment('');
      setCommentArea(null);
      setCommentDoc(null);
      loadPayment();
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Error añadiendo comentario');
    } finally {
      setAddingComment(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!confirm('¿Eliminar este documento?')) return;
    try {
      await api.deleteDocument(docId);
      loadPayment();
    } catch (err) {
      console.error('Error deleting:', err);
      alert('Error eliminando documento');
    }
  };

  const handleDownloadDocument = async (docId, docName) => {
    try {
      const url = await api.downloadDocument(docId);
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = docName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Error downloading:', err);
      alert('Error descargando documento');
    }
  };

  const handleCancel = async () => {
    if (!confirm('¿Cancelar esta petición? Esta acción no se puede deshacer.')) return;
    try {
      await api.cancelPayment(id);
      navigate('/payments');
    } catch (err) {
      console.error('Error canceling:', err);
      alert('Error cancelando la petición');
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Eliminar esta petición definitivamente? Esta acción no se puede deshacer.')) return;
    try {
      await api.deletePayment(id);
      navigate('/payments');
    } catch (err) {
      console.error('Error deleting:', err);
      alert('Error eliminando la petición');
    }
  };

  const handleEditPayment = () => {
    const getMedioPagoValue = (value) => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      return value.value || '';
    };
    const formatDateForInput = (dateStr) => {
      if (!dateStr) return '';
      if (typeof dateStr === 'string') {
        if (dateStr.includes('T')) {
          const parts = dateStr.split('T')[0].split('-');
          if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        }
        if (dateStr.includes('/')) {
          return dateStr;
        }
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}/${d.getFullYear()}`;
      }
      return '';
    };
    setEditForm({
      propuesta_gasto: payment.propuesta_gasto || '',
      orden_pago: payment.orden_pago || '',
      numero_factura: payment.numero_factura || '',
      n_documento_contable: payment.n_documento_contable || '',
      fecha_pago: formatDateForInput(payment.fecha_pago),
      tipo_pago: payment.tipo_pago || 'CON_FACTURA',
      monto_total: payment.monto_total || '',
      divisa: payment.divisa || 'EUR',
      banco: payment.banco || '',
      medio_pago: getMedioPagoValue(payment.medio_pago),
      descripcion: payment.descripcion || '',
    });
    setEditingPayment(true);
  };

  const handleSaveEdit = async () => {
    try {
      const updateData = { ...editForm };
      // Convert fields to proper types
      if (updateData.propuesta_gasto) {
        updateData.propuesta_gasto = parseInt(updateData.propuesta_gasto);
      }
      if (updateData.monto_total) {
        updateData.monto_total = parseFloat(updateData.monto_total);
      }
      // Convert medio_pago to proper value
      if (updateData.medio_pago === '' || updateData.medio_pago === null) {
        updateData.medio_pago = null;
      }
      console.log('Updating payment with data:', updateData);
      await api.updatePayment(id, updateData);
      setEditingPayment(false);
      loadPayment();
      alert('Petición actualizada correctamente');
    } catch (err) {
      console.error('Error updating:', err);
      alert('Error actualizando la petición: ' + (err.message || JSON.stringify(err)));
    }
  };

  const handleCancelEdit = () => {
    setEditingPayment(false);
    setEditForm({});
  };

  const isPdf = (mimeType) => {
    return mimeType && mimeType.includes('pdf');
  };

  const getMedioPagoDisplay = (medio) => {
    if (!medio) return '-';
    const medioStr = typeof medio === 'string' ? medio : medio?.value || medio;
    const medios = {
      'TRANSFERENCIA': 'Transferencia',
      'TARJETA': 'Tarjeta',
    };
    return medios[medioStr] || medioStr;
  };

  // Get the correct areas order based on payment type
  const getAreasOrder = () => {
    const tipoStr = getTipoPagoStr(payment?.tipo_pago);
    return tipoStr === 'SIN_FACTURA' ? AREAS_ORDER_SIN_FACTURA : AREAS_ORDER_CON_FACTURA;
  };

  // Group comments by area
  const getCommentsByArea = () => {
    const grouped = {};
    const order = getAreasOrder();
    order.forEach(area => {
      grouped[area] = comments.filter(c => c.area === area);
    });
    return grouped;
  };

  if (loading) {
    return <div className="text-center">Cargando...</div>;
  }

  if (!payment) {
    return <div className="text-center">Petición no encontrada</div>;
  }

  // Sort workflow states by the correct order based on payment tipo
  const getWorkflowOrder = () => {
    const tipoStr = getTipoPagoStr(payment?.tipo_pago);
    return tipoStr === 'SIN_FACTURA' ? WORKFLOW_ORDER_SIN_FACTURA : WORKFLOW_ORDER_CON_FACTURA;
  };

  const sortedWorkflowStates = [...workflowStates].sort((a, b) => {
    const order = getWorkflowOrder();
    return order.indexOf(a.area) - order.indexOf(b.area);
  });

  const commentsByArea = getCommentsByArea();

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div>
          <Link to="/payments" className="btn btn-secondary">← Volver</Link>
        </div>
        <h1 style={{ color: '#fbbf24' }}>{payment.numero_peticion}</h1>
        <div className="flex gap-1">
          {(() => {
            if (payment.estado_general === 'CANCELADA') {
              return (
                <span className="badge badge-cancelada" style={{ alignSelf: 'center' }}>
                  CANCELADA
                </span>
              );
            }
            if (payment.estado_general === 'COMPLETADA') {
              return (
                <span className="badge badge-completada" style={{ alignSelf: 'center' }}>
                  COMPLETADA
                </span>
              );
            }
            const nextPending = sortedWorkflowStates.find(s => s.estado === 'PENDIENTE');
            if (nextPending) {
              return (
                <span className="badge badge-en_proceso" style={{ alignSelf: 'center' }}>
                  Fase: {AREAS_DISPLAY[nextPending.area]}
                </span>
              );
            }
            return (
              <span className={`badge badge-${payment.estado_general.toLowerCase()}`} style={{ alignSelf: 'center' }}>
                {payment.estado_general}
              </span>
            );
          })()}
          {payment.estado_general !== 'CANCELADA' && payment.estado_general !== 'COMPLETADA' && (
            <button className="btn btn-danger" onClick={handleCancel}>
              Cancelar
            </button>
          )}
          <button className="btn btn-danger" onClick={handleDelete}>
            Eliminar
          </button>
        </div>
      </div>

      <div className="three-column-layout">
        {/* Column 1: Información de la Petición */}
        <div className="info-column">
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <h3 className="card-title">Información de la Petición</h3>
              {!editingPayment && payment.estado_general !== 'COMPLETADA' && payment.estado_general !== 'CANCELADA' && (
                <button className="btn btn-secondary" onClick={handleEditPayment}>Editar</button>
              )}
            </div>
            {!editingPayment && (
              <div className="payment-info-grid">
                <div className="payment-info-item">
                  <div className="payment-info-label">Código Propuesta de Gasto</div>
                  <div className="payment-info-value">{payment.propuesta_gasto || '-'}</div>
                </div>
                <div className="payment-info-item">
                  <div className="payment-info-label">Orden de Pago</div>
                  <div className="payment-info-value">{payment.orden_pago || '-'}</div>
                </div>
                <div className="payment-info-item">
                  <div className="payment-info-label">Nº Documento Contable</div>
                  <div className="payment-info-value">{payment.n_documento_contable || '-'}</div>
                </div>
                <div className="payment-info-item">
                  <div className="payment-info-label">Número de Factura</div>
                  <div className="payment-info-value">{payment.numero_factura || '-'}</div>
                </div>
                <div className="payment-info-item">
                  <div className="payment-info-label">Tipo de Pago</div>
                  <div className="payment-info-value">{getTipoPagoStr(payment.tipo_pago) === 'SIN_FACTURA' ? 'Sin Factura' : 'Con Factura'}</div>
                </div>
                <div className="payment-info-item highlight">
                  <div className="payment-info-label">Fecha de Pago</div>
                  <div className="payment-info-value">{formatDate(payment.fecha_pago, false)}</div>
                </div>
                <div className="payment-info-item">
                  <div className="payment-info-label">Banco</div>
                  <div className="payment-info-value">{payment.banco || '-'}</div>
                </div>
                <div className="payment-info-item">
                  <div className="payment-info-label">Medio de Pago</div>
                  <div className="payment-info-value">{getMedioPagoDisplay(payment.medio_pago) || '-'}</div>
                </div>
                <div className="payment-info-item highlight">
                  <div className="payment-info-label">Monto Total</div>
                  <div className="payment-info-value" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                    {formatCurrency(payment.monto_total, payment.divisa)}
                  </div>
                </div>
                <div className="payment-info-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="payment-info-label">Descripción del Gasto</div>
                  <div className="payment-info-value">{payment.descripcion || '-'}</div>
                </div>
              </div>
            )}
            {editingPayment ? (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Código Propuesta de Gasto</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.propuesta_gasto}
                    onChange={(e) => setEditForm({...editForm, propuesta_gasto: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Orden de Pago</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.orden_pago}
                    onChange={(e) => setEditForm({...editForm, orden_pago: e.target.value})}
                  />
                </div>
              </div>
            ) : null}
            {editingPayment ? (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Número de Factura</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.numero_factura}
                    onChange={(e) => setEditForm({...editForm, numero_factura: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nº Documento Contable</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.n_documento_contable}
                    onChange={(e) => setEditForm({...editForm, n_documento_contable: e.target.value})}
                  />
                </div>
              </div>
            ) : null}
            {editingPayment ? (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tipo de Pago</label>
                  <select
                    className="form-select"
                    value={editForm.tipo_pago}
                    onChange={(e) => setEditForm({...editForm, tipo_pago: e.target.value})}
                  >
                    <option value="CON_FACTURA">Con Factura</option>
                    <option value="SIN_FACTURA">Sin Factura</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de Pago (dd/mm/yyyy)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="dd/mm/yyyy"
                    value={editForm.fecha_pago}
                    onChange={(e) => setEditForm({...editForm, fecha_pago: e.target.value})}
                  />
                </div>
              </div>
            ) : null}
            {editingPayment ? (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Banco</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.banco}
                    onChange={(e) => setEditForm({...editForm, banco: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Medio de Pago</label>
                  <select
                    className="form-select"
                    value={editForm.medio_pago}
                    onChange={(e) => setEditForm({...editForm, medio_pago: e.target.value})}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="TARJETA">Tarjeta</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Monto Total</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={editForm.monto_total}
                    onChange={(e) => setEditForm({...editForm, monto_total: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Divisa</label>
                  <select
                    className="form-select"
                    value={editForm.divisa}
                    onChange={(e) => setEditForm({...editForm, divisa: e.target.value})}
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CHF">CHF (Fr)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="CNY">CNY (¥)</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Banco</label>
                  <p>{payment.banco || '-'}</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Medio de Pago</label>
                  <p>{getMedioPagoDisplay(payment.medio_pago)}</p>
                </div>
              </div>
            )}
            {editingPayment && (
              <div className="form-row">
                <div className="form-group" style={{ width: '100%' }}>
                  <label className="form-label">Descripción del Gasto</label>
                  <textarea
                    className="form-textarea"
                    value={editForm.descripcion}
                    onChange={(e) => setEditForm({...editForm, descripcion: e.target.value})}
                  />
                </div>
              </div>
            )}
            {editingPayment && (
              <div className="flex gap-1 mt-3">
                <button className="btn btn-primary" onClick={handleSaveEdit}>Guardar</button>
                <button className="btn btn-warning" onClick={handleCancelEdit}>Cancelar</button>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Workflow */}
        <div className="workflow-column">
          <div className="card">
            <h3 className="card-title">Workflow</h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              {getTipoPagoStr(payment?.tipo_pago) === 'SIN_FACTURA' ? 'Flujo sin factura' : 'Flujo con factura'}
            </div>
            <div className="workflow-timeline">
              {sortedWorkflowStates.map((state, index) => {
                const areaComments = commentsByArea[state.area] || [];
                const hasActed = state.estado !== 'PENDIENTE' || areaComments.length > 0;
                const canReverse = hasActed && state.estado !== 'RECHAZADO';
                // Check if current user can act on this area
                const userRole = user?.role;
                const userAreas = AREAS_BY_ROLE[userRole] || [];
                const canAct = userAreas.includes(state.area);
                return (
                  <React.Fragment key={state.area}>
                    <div className={`workflow-step ${state.estado.toLowerCase()}`}>
                      <div className="workflow-step-header">
                        <div className="workflow-step-icon">{AREA_ICONS[state.area]}</div>
                        <div className="workflow-step-info">
                          <div className="workflow-step-name">{AREAS_DISPLAY[state.area]}</div>
                          <div className="workflow-step-status">{getWorkflowDisplayEstado(state.estado)}</div>
                        </div>
                        <div className="flex gap-1 items-center">
                          {payment.estado_general !== 'CANCELADA' && payment.estado_general !== 'COMPLETADA' && canAct && state.estado !== 'APROBADO' && state.estado !== 'RECHAZADO' && (
                            <button
                              className="btn btn-success"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => setActionModal({ type: 'advance', area: state.area })}
                            >
                              {AREA_ACTIONS[state.area] || 'Avanzar'}
                            </button>
                          )}
                          {payment.estado_general !== 'CANCELADA' && payment.estado_general !== 'COMPLETADA' && canReverse && canAct && (
                            <button
                              className="btn btn-danger"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => setActionModal({ type: 'reverse', area: state.area })}
                              title="Revertir"
                            >
                              ↩
                            </button>
                          )}
                          {hasActed && (
                            <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '1rem' }} title="Completado">✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {index < sortedWorkflowStates.length - 1 && (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem', padding: '2px 0' }}>
                        ↓
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Column 3: Comentarios */}
        <div className="comments-column">
          <div className="card">
            <h3 className="card-title">Comentarios</h3>

            <div className="comments-list">
              {getAreasOrder().map(area => {
                const areaComments = commentsByArea[area] || [];
                if (areaComments.length === 0) return null;
                return (
                  <div key={area} className="comment-area-section">
                    <div className="comment-area-title">
                      {AREA_ICONS[area]} {AREAS_DISPLAY[area]}
                    </div>
                    {areaComments.map((comment) => (
                      <div key={comment.id} className="comment">
                        <div className="comment-header">
                          <span className="comment-author">
                            {comment.usuario?.nombre || comment.usuario?.username || 'Usuario'}
                            {comment.usuario?.email && <span style={{ fontWeight: 'normal', fontSize: '0.8em', marginLeft: '0.5em' }}>({comment.usuario.email})</span>}
                          </span>
                          <span className="comment-date">{formatDate(comment.created_at)}</span>
                        </div>
                        <div className="comment-content">
                          {comment.contenido.split('\n').map((line, i, arr) => (
                            <React.Fragment key={i}>
                              {line}
                              {i < arr.length - 1 && <br />}
                            </React.Fragment>
                          ))}
                        </div>
                        {comment.documentos && comment.documentos.length > 0 && (
                          <div className="comment-attachments mt-1">
                            <strong style={{ fontSize: '0.75rem' }}>Documentos adjuntos:</strong>
                            {comment.documentos.map(doc => (
                              <div key={doc.id} style={{ marginTop: '2px' }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => handleDownloadDocument(doc.id, doc.nombre_original)}>
                                  📎 {doc.nombre_original}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
              {comments.length === 0 && (
                <div className="empty-state">
                  <p>No hay comentarios</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Documents section - outside 3-column layout */}
      <div className="card mt-3">
        <div className="card-header">
          <h3 className="card-title">Documentos</h3>
          <div className="flex gap-1">
            <button
              className="btn btn-secondary"
              onClick={async () => {
                try {
                  const token = localStorage.getItem('access_token');
                  const url = api.downloadAllDocuments(id);
                  const response = await fetch(url, {
                    headers: {
                      'Authorization': `Bearer ${token}`
                    }
                  });
                  if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.detail || 'Error al descargar ZIP');
                  }
                  const blob = await response.blob();
                  const blobUrl = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = blobUrl;
                  link.download = `documentos_${payment.numero_peticion}.zip`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(blobUrl);
                } catch (err) {
                  console.error('Error descargando ZIP:', err);
                  alert(err.message || 'Error al descargar el archivo ZIP');
                }
              }}
            >
              📦 Descargar todos
            </button>
            <button className="btn btn-primary" onClick={() => setDocUploadModal(true)}>
              + Subir Documentos
            </button>
          </div>
        </div>
        {payment.documents && payment.documents.length > 0 ? (
          <div>
            {payment.documents.map((doc) => (
              <div key={doc.id} className="document-item">
                <div className="document-icon">📄</div>
                <div className="document-info">
                  <div className="document-name">{doc.nombre_original}</div>
                  <div className="document-meta">
                    Tipo: {doc.tipo} | Tamaño: {(doc.tamano_bytes / 1024).toFixed(1)} KB | {formatDate(doc.uploaded_at)}
                    {doc.n_documento_contable && ` | NDoc: ${doc.n_documento_contable}`}
                  </div>
                </div>
                <div className="document-actions">
                  {isPdf(doc.mime_type) && (
                    <button
                      className="btn btn-primary"
                      onClick={async () => {
                        try {
                          const url = await api.viewDocument(doc.id);
                          window.open(url, '_blank', 'noopener,noreferrer');
                        } catch (err) {
                          console.error('Error obteniendo token de documento:', err);
                          alert('Error abriendo el documento. Intentá de nuevo.');
                        }
                      }}
                    >
                      Ver
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={() => handleDownloadDocument(doc.id, doc.nombre_original)}>
                    Descargar
                  </button>
                  {user?.role === 'admin' && (
                      <button className="btn btn-danger" onClick={() => handleDeleteDocument(doc.id)}>Eliminar</button>
                    )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No hay documentos</p>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {actionModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">
                {actionModal.type === 'advance' ? AREA_ACTIONS[actionModal.area] : 'Revertir'} - {AREAS_DISPLAY[actionModal.area]}
              </h3>
              <button className="modal-close" onClick={() => setActionModal(null)}>×</button>
            </div>
            {actionModal.type === 'advance' && (
              <div className="form-group">
                <div
                  className={`upload-zone ${actionDragOver ? 'dragover' : ''}`}
                  onClick={() => document.getElementById('action-file-input')?.click()}
                  onDragOver={(e) => { e.preventDefault(); setActionDragOver(true); }}
                  onDragLeave={() => setActionDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActionDragOver(false);
                    const files = Array.from(e.dataTransfer.files);
                    if (files.length > 0) setActionDocuments(prev => [...prev, ...files]);
                  }}
                  style={{ padding: '1rem', fontSize: '0.875rem' }}
                >
                  <p>Arrastra archivos aquí o haz clic para seleccionar</p>
                </div>
                <input
                  id="action-file-input"
                  type="file"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files);
                    if (files.length > 0) setActionDocuments(prev => [...prev, ...files]);
                  }}
                  style={{ display: 'none' }}
                />
                {actionDocuments.length > 0 && (
                  <div className="mt-2">
                    {actionDocuments.map((doc, idx) => (
                      <div key={idx} className="flex gap-1 items-center mb-1">
                        <span className="text-muted" style={{ flex: 1 }}>📎 {doc.name}</span>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => setActionDocuments(prev => prev.filter((_, i) => i !== idx))}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">
                {actionModal.type === 'reverse' ? 'Motivo de reversión (obligatorio):' : 'Comentario (opcional):'}
              </label>
              <textarea
                className="form-textarea"
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                placeholder={actionModal.type === 'reverse' ? 'Escribe el motivo...' : 'Comentario...'}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setActionModal(null); setActionDocuments([]); }}>Cancelar</button>
              <button
                className={`btn ${actionModal.type === 'advance' ? 'btn-success' : 'btn-danger'}`}
                onClick={actionModal.type === 'advance' ? handleAdvance : handleReverse}
              >
                {actionModal.type === 'advance' ? AREA_ACTIONS[actionModal.area] || 'Confirmar' : 'Revertir'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Document Upload Modal */}
      {docUploadModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Subir Documentos</h3>
              <button className="modal-close" onClick={() => { setDocUploadModal(false); setPendingDocs([]); }}>×</button>
            </div>
            <div className="form-group">
              <div
                className={`upload-zone ${pendingDragOver ? 'dragover' : ''}`}
                onClick={() => document.getElementById('pending-doc-input')?.click()}
                onDragOver={(e) => { e.preventDefault(); setPendingDragOver(true); }}
                onDragLeave={() => setPendingDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPendingDragOver(false);
                  const files = Array.from(e.dataTransfer.files);
                  if (files.length > 0) setPendingDocs(prev => [...prev, ...files]);
                }}
                style={{ padding: '1rem', fontSize: '0.875rem' }}
              >
                <p>Arrastra archivos aquí o haz clic para seleccionar</p>
              </div>
              <input
                id="pending-doc-input"
                type="file"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files);
                  if (files.length > 0) setPendingDocs(prev => [...prev, ...files]);
                }}
                style={{ display: 'none' }}
              />
              {pendingDocs.length > 0 && (
                <div className="mt-2">
                  {pendingDocs.map((doc, idx) => (
                    <div key={idx} className="flex gap-1 items-center mb-1">
                      <span className="text-muted" style={{ flex: 1 }}>📎 {doc.name}</span>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => setPendingDocs(prev => prev.filter((_, i) => i !== idx))}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setDocUploadModal(false); setPendingDocs([]); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={uploadPendingDocs} disabled={uploadingPending || pendingDocs.length === 0}>
                {uploadingPending ? 'Subiendo...' : `Subir ${pendingDocs.length} archivo(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
