import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

export default function NewPaymentPage({ user }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    propuesta_gasto: '',
    orden_pago: '',
    numero_factura: '',
    n_documento_contable: '',
    fecha_pago: '',
    tipo_pago: 'CON_FACTURA',
    medio_pago: '',
    monto_total: '0.00',
    divisa: 'EUR',
    descripcion: '',
    banco: '',
  });
  const [documents, setDocuments] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    addFiles(files);
  };

  const addFiles = (files) => {
    setDocuments(prev => [...prev, ...files]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      addFiles(files);
    }
  };

  const removeDocument = (index) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.propuesta_gasto || formData.propuesta_gasto <= 0) {
      alert('El código de propuesta de gasto es obligatorio');
      return;
    }

    setSubmitting(true);
    try {
      // Prepare data with correct types
      const submitData = {
        propuesta_gasto: parseInt(formData.propuesta_gasto),
        orden_pago: formData.orden_pago || null,
        numero_factura: formData.numero_factura || null,
        n_documento_contable: formData.n_documento_contable || null,
        fecha_pago: formData.fecha_pago || null,
        tipo_pago: formData.tipo_pago,
        medio_pago: formData.medio_pago ? formData.medio_pago : null,
        monto_total: parseFloat(formData.monto_total) || 0,
        divisa: formData.divisa || 'EUR',
        descripcion: formData.descripcion || null,
        banco: formData.banco || null,
      };

      const payment = await api.createPayment(submitData);

      // Upload documents after creating the payment
      for (const file of documents) {
        try {
          await api.uploadDocument(payment.id, file, 'peticion', '');
        } catch (err) {
          console.error('Error uploading document:', file.name, err);
        }
      }

      navigate(`/payments/${payment.id}`);
    } catch (err) {
      console.error('Error creating payment:', err);
      alert('Error creando la petición: ' + (err.message || JSON.stringify(err)));
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-3">
        <Link to="/payments" className="btn btn-secondary">← Volver</Link>
      </div>

      <div className="card">
        <h2 className="card-title mb-3">Nueva Petición de Pago</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Código Propuesta de Gasto *</label>
              <input
                type="number"
                name="propuesta_gasto"
                className="form-input"
                value={formData.propuesta_gasto}
                onChange={handleChange}
                required
                min="1"
                placeholder="Código numérico"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de Pago</label>
              <select
                name="tipo_pago"
                className="form-select"
                value={formData.tipo_pago}
                onChange={handleChange}
              >
                <option value="CON_FACTURA">Con Factura</option>
                <option value="SIN_FACTURA">Sin Factura</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-row">
            <div className="form-group">
              <label className="form-label">Monto Total</label>
              <input
                type="number"
                name="monto_total"
                className="form-input"
                value={formData.monto_total}
                onChange={handleChange}
                step="0.01"
                min="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Divisa</label>
              <select
                name="divisa"
                className="form-select"
                value={formData.divisa}
                onChange={handleChange}
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
            <div className="form-group">
              <label className="form-label">Fecha de Pago Prevista (dd/mm/yyyy)</label>
              <input
                type="text"
                name="fecha_pago"
                className="form-input"
                placeholder="dd/mm/yyyy"
                value={formData.fecha_pago}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Orden de Pago</label>
              <input
                type="text"
                name="orden_pago"
                className="form-input"
                value={formData.orden_pago}
                onChange={handleChange}
                placeholder="Número de orden de pago"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Número de Factura</label>
              <input
                type="text"
                name="numero_factura"
                className="form-input"
                value={formData.numero_factura}
                onChange={handleChange}
                placeholder="Número de factura"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nº Documento Contable</label>
            <input
              type="text"
              name="n_documento_contable"
              className="form-input"
              value={formData.n_documento_contable}
              onChange={handleChange}
              placeholder="Número de documento contable"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Descripción del Gasto</label>
            <textarea
              name="descripcion"
              className="form-textarea"
              value={formData.descripcion}
              onChange={handleChange}
              placeholder="Descripción detallada del pago"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Banco del Pago</label>
            <input
              type="text"
              name="banco"
              className="form-input"
              value={formData.banco}
              onChange={handleChange}
              placeholder="Nombre del banco para el pago"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Medio de Pago</label>
            <select
              name="medio_pago"
              className="form-select"
              value={formData.medio_pago}
              onChange={handleChange}
            >
              <option value="">Seleccionar...</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="TARJETA">Tarjeta</option>
            </select>
          </div>

          {/* Document Attachments */}
          <div className="form-group">
            <label className="form-label">Anexar Documentos</label>
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <p>Haz clic o arrastra archivos aquí para adjuntar</p>
              <p className="text-muted" style={{ fontSize: '0.875rem' }}>PDF, imágenes, documentos...</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            />
            {documents.length > 0 && (
              <div className="mt-2">
                <p className="mb-1"><strong>Documentos seleccionados:</strong></p>
                {documents.map((file, index) => (
                  <div key={index} className="document-item" style={{ padding: '0.5rem' }}>
                    <span className="document-name" style={{ flex: 1 }}>{file.name}</span>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeDocument(index)}
                      style={{ padding: '0.25rem 0.5rem' }}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-1 mt-3">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creando...' : 'Crear Petición'}
            </button>
            <Link to="/payments" className="btn btn-secondary">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
