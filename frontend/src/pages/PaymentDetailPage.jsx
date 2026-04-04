import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { WORKFLOW_ORDER_CON_FACTURA, WORKFLOW_ORDER_SIN_FACTURA, AREAS_DISPLAY, AREA_ICONS, AREA_ACTIONS, AVAILABLE_AREAS } from '../utils/constants';
import { formatCurrency, getTipoPagoStr as getTipoPagoStrUtil, formatDate, validateFile } from '../utils/formatters';
import { useToast } from '../components/Toast';
import WorkflowPanel from '../components/WorkflowPanel';
import CommentsPanel from '../components/CommentsPanel';
import DocumentsPanel from '../components/DocumentsPanel';

// Handle clipboard paste for images — callback(file) on success, callback(null, errMsg) on error
const handleClipboardPaste = async (e, callback) => {
  e.preventDefault();
  try {
    const clipboardItems = await navigator.clipboard.read();
    const imageItems = clipboardItems.filter(item =>
      item.types.some(type => type.startsWith('image/'))
    );
    if (imageItems.length === 0) return; // No image in clipboard — silently ignore
    for (const item of imageItems) {
      const imageType = item.types.find(type => type.startsWith('image/'));
      const blob = await item.getType(imageType);
      const ext = imageType === 'image/png' ? '.png' : imageType === 'image/jpeg' ? '.jpg' : '.png';
      const file = new File([blob], `pasted-image-${Date.now()}${ext}`, { type: imageType });
      const validation = validateFile(file);
      if (validation.valid) callback(file);
      else callback(null, validation.error);
    }
  } catch (err) {
    console.error('Error reading clipboard:', err);
    callback(null, 'No se pudo acceder al portapapeles. Asegurate de dar permisos o usá el botón de selección de archivos.');
  }
};

const getTipoPagoStr = getTipoPagoStrUtil;

export default function PaymentDetailPage({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast, showConfirm } = useToast();
  const [payment, setPayment] = useState(null);
  const [workflowStates, setWorkflowStates] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newComment, setNewComment] = useState('');
  const [commentArea, setCommentArea] = useState(null);
  const [addingComment, setAddingComment] = useState(false);
  const [actionModal, setActionModal] = useState(null);
  const [actionComment, setActionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionDocuments, setActionDocuments] = useState([]);
  const [uploadingActionDoc, setUploadingActionDoc] = useState(false);
  const [editingPayment, setEditingPayment] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [actionDragOver, setActionDragOver] = useState(false);
  const [docUploadModal, setDocUploadModal] = useState(false);
  const [pendingDocs, setPendingDocs] = useState([]);
  const [pendingDragOver, setPendingDragOver] = useState(false);
  const [uploadingPending, setUploadingPending] = useState(false);
  // For the "Subir Documentos" modal: which area to register the upload under
  const [uploadArea, setUploadArea] = useState('');

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
      addToast('Error cargando la petición', 'error');
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

    // Determine the area for this upload:
    // - admin must have selected one explicitly (uploadArea)
    // - other roles use their first accessible area
    const area = uploadArea || user?.accessible_areas?.[0];
    if (!area) {
      addToast('Seleccioná un área para registrar el documento', 'warning');
      return;
    }

    setUploadingPending(true);
    try {
      // 1. Create a comment as audit trail — content is generic, the actual
      //    filenames appear as attachments linked to this comment
      const commentResult = await api.addComment(
        id,
        area,
        '📎 Documento adjunto'
      );
      const commentId = commentResult?.id;

      // 2. Upload each file linked to that comment
      for (const file of pendingDocs) {
        if (commentId) {
          await api.uploadDocumentWithComment(id, commentId, file, 'peticion', '');
        } else {
          await api.uploadDocument(id, file, 'peticion', '');
        }
      }

      setPendingDocs([]);
      setUploadArea('');
      setDocUploadModal(false);
      loadPayment();
      addToast('Documento(s) subido(s) y registrado(s) correctamente', 'success');
    } catch (err) {
      console.error('Error uploading:', err);
      addToast('Error subiendo el documento', 'error');
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
      addToast('Debes escribir un comentario para avanzar el workflow', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      let comentario = actionComment;
      // First advance workflow (creates the comment)
      const result = await api.advanceWorkflow(id, actionModal.area, comentario);
      const commentId = result?.comment_id;
      // Then upload documents linked to the comment
      if (actionDocuments.length > 0 && commentId) {
        for (const doc of actionDocuments) {
          await api.uploadDocumentWithComment(id, commentId, doc, 'otro', '');
        }
      } else if (actionDocuments.length > 0) {
        // Fallback: upload without comment_id
        for (const doc of actionDocuments) {
          await api.uploadDocument(id, doc, 'otro', '');
        }
      }
      setActionModal(null);
      setActionComment('');
      setActionDocuments([]);
      loadPayment();
      addToast('Workflow avanzado correctamente', 'success');
    } catch (err) {
      console.error('Error advancing:', err);
      addToast(err.message || 'Error avanzando el workflow', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReverse = async () => {
    if (!actionComment.trim()) {
      addToast('Debes escribir un motivo para revertir', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      await api.reverseWorkflow(id, actionModal.area, actionComment);
      setActionModal(null);
      setActionComment('');
      loadPayment();
      addToast('Workflow revertido', 'info');
    } catch (err) {
      console.error('Error reversing:', err);
      addToast(err.message || 'Error revirtiendo el workflow', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async (area) => {
    if (!newComment.trim() || !area) {
      addToast('Debes escribir un comentario', 'warning');
      return;
    }
    setAddingComment(true);
    try {
      let commentContent = newComment;
      await api.addComment(id, area, commentContent);
      setNewComment('');
      setCommentArea(null);
      setCommentDoc(null);
      loadPayment();
      addToast('Comentario añadido', 'success');
    } catch (err) {
      console.error('Error adding comment:', err);
      addToast('Error añadiendo comentario', 'error');
    } finally {
      setAddingComment(false);
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
      addToast('Error descargando documento', 'error');
    }
  };

  const handleCancel = async () => {
    const confirmed = await showConfirm('¿Cancelar esta petición? Esta acción no se puede deshacer.');
    if (!confirmed) return;
    try {
      await api.cancelPayment(id);
      navigate('/payments');
    } catch (err) {
      console.error('Error canceling:', err);
      addToast('Error cancelando la petición', 'error');
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm('¿Eliminar esta petición definitivamente? Esta acción no se puede deshacer.');
    if (!confirmed) return;
    try {
      await api.deletePayment(id);
      navigate('/payments');
    } catch (err) {
      console.error('Error deleting:', err);
      addToast('Error eliminando la petición', 'error');
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
      await api.updatePayment(id, updateData);
      setEditingPayment(false);
      loadPayment();
      addToast('Petición actualizada correctamente', 'success');
    } catch (err) {
      console.error('Error updating:', err);
      addToast('Error actualizando la petición: ' + (err.message || ''), 'error');
    }
  };

  const handleCancelEdit = () => {
    setEditingPayment(false);
    setEditForm({});
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
    return tipoStr === 'SIN_FACTURA' ? WORKFLOW_ORDER_SIN_FACTURA : WORKFLOW_ORDER_CON_FACTURA;
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
          {(user?.role === 'admin' || (payment.creadora_id === user?.id && payment.estado_general !== 'COMPLETADA' && payment.estado_general !== 'CANCELADA')) && (
            <button className="btn btn-danger" onClick={handleDelete}>
              Eliminar
            </button>
          )}
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
          <WorkflowPanel
            payment={payment}
            workflowStates={workflowStates}
            commentsByArea={commentsByArea}
            areasOrder={getAreasOrder()}
            user={user}
            onOpenAction={(type, area) => setActionModal({ type, area })}
            tipoPagoLabel={getTipoPagoStr(payment?.tipo_pago) === 'SIN_FACTURA' ? 'Flujo sin factura' : 'Flujo con factura'}
          />
        </div>

        {/* Column 3: Comentarios */}
        <div className="comments-column">
          <CommentsPanel
            comments={comments}
            commentsByArea={commentsByArea}
            areasOrder={getAreasOrder()}
            onDownload={handleDownloadDocument}
          />
        </div>
      </div>

      {/* Documents section - outside 3-column layout */}
      <DocumentsPanel
        payment={payment}
        user={user}
        onRefresh={loadPayment}
        onOpenUpload={() => setDocUploadModal(true)}
      />

      {/* Action Modal */}
      {actionModal && (
        <div 
          className="modal-overlay"
          onPaste={(e) => {
            // Global paste handler for the entire modal
            if (actionModal.type === 'advance') {
              handleClipboardPaste(e, (file, err) => {
                if (err) { addToast(err, 'error'); return; }
                if (file) setActionDocuments(prev => [...prev, file]);
              });
            }
          }}
        >
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
                    const validFiles = [];
                    for (const file of files) {
                      const validation = validateFile(file);
                      if (validation.valid) {
                        validFiles.push(file);
                      } else {
                        addToast(`${file.name}: ${validation.error}`, 'warning');
                      }
                    }
                    if (validFiles.length > 0) setActionDocuments(prev => [...prev, ...validFiles]);
                  }}
                  style={{ padding: '1rem', fontSize: '0.875rem' }}
                >
                  <p style={{ margin: '0', fontWeight: 'bold' }}>📎 Adjuntar archivos</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#666' }}>
                    Arrastra aquí o haz clic para seleccionar
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#999' }}>
                    También puedes pegar (Ctrl+V) en cualquier parte de esta ventana
                  </p>
                </div>
                <input
                  id="action-file-input"
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.msg"
                  onChange={(e) => {
                    const files = Array.from(e.target.files);
                    const validFiles = [];
                    for (const file of files) {
                      const validation = validateFile(file);
                      if (validation.valid) {
                        validFiles.push(file);
                      } else {
                        addToast(`${file.name}: ${validation.error}`, 'warning');
                      }
                    }
                    if (validFiles.length > 0) setActionDocuments(prev => [...prev, ...validFiles]);
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
              
              {/* Preview pasted images */}
              {actionDocuments.length > 0 && actionDocuments.some(doc => doc.type?.startsWith('image/')) && (
                <div className="mt-3">
                  <label className="form-label" style={{ fontSize: '0.875rem', color: '#666' }}>
                    📷 Imágenes adjuntas (aparecerán en el comentario):
                  </label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {actionDocuments.filter(doc => doc.type?.startsWith('image/')).map((doc, idx) => (
                      <div key={idx} className="relative" style={{ position: 'relative' }}>
                        <img 
                          src={URL.createObjectURL(doc)} 
                          alt={doc.name}
                          style={{ maxWidth: '120px', maxHeight: '120px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                        <button 
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setActionDocuments(prev => prev.filter((_, i) => i !== actionDocuments.indexOf(doc)))}
                          style={{ position: 'absolute', top: '-5px', right: '-5px', padding: '0 4px', fontSize: '12px' }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setActionModal(null); setActionDocuments([]); }}>Cancelar</button>
              <button
                className={`btn ${actionModal.type === 'advance' ? 'btn-success' : 'btn-danger'}`}
                onClick={actionModal.type === 'advance' ? handleAdvance : handleReverse}
                disabled={actionLoading}
              >
                {actionLoading ? 'Procesando...' : (actionModal.type === 'advance' ? AREA_ACTIONS[actionModal.area] || 'Confirmar' : 'Revertir')}
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
              <button className="modal-close" onClick={() => { setDocUploadModal(false); setPendingDocs([]); setUploadArea(''); }}>×</button>
            </div>

            {/* Área — admin elige, resto ve la suya */}
            <div className="form-group">
              <label className="form-label">Área que registra el documento</label>
              {user?.role === 'admin' ? (
                <select
                  className="form-select"
                  value={uploadArea}
                  onChange={(e) => setUploadArea(e.target.value)}
                  required
                >
                  <option value="">Seleccionar área...</option>
                  {AVAILABLE_AREAS.map(a => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              ) : (
                <div style={{ padding: '0.5rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {AREA_ICONS[user?.accessible_areas?.[0]]} {AREAS_DISPLAY[user?.accessible_areas?.[0]] || user?.accessible_areas?.[0]}
                  <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', color: 'var(--text-muted)' }}>
                    (se registrará en esta área)
                  </span>
                </div>
              )}
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
              <button className="btn btn-secondary" onClick={() => { setDocUploadModal(false); setPendingDocs([]); setUploadArea(''); }}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={uploadPendingDocs}
                disabled={uploadingPending || pendingDocs.length === 0 || (user?.role === 'admin' && !uploadArea)}
              >
                {uploadingPending ? 'Subiendo...' : `Subir ${pendingDocs.length} archivo(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
