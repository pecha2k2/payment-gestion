import React, { useState, useEffect } from 'react';
import { api } from '../api';

const AVAILABLE_AREAS = [
  { value: 'demandante', label: '📝 Demandante' },
  { value: 'validadora', label: '✅ Validadora' },
  { value: 'aprobadora', label: '👍 Aprobadora' },
  { value: 'contabilidad', label: '📊 Contabilidad' },
  { value: 'pagadora', label: '💰 Pagadora' },
  { value: 'sap', label: '☁️ SAP' },
];

const AREA_ICONS = {
  demandante: '📝',
  validadora: '✅',
  aprobadora: '👍',
  contabilidad: '📊',
  pagadora: '💰',
  sap: '☁️',
};

export default function WorkflowConfigsPage() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    es_default: false,
    flujo_json: JSON.stringify(['demandante', 'validadora', 'aprobadora', 'contabilidad', 'pagadora', 'sap'], null, 2),
    activo: true,
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const data = await api.getWorkflowConfigs();
      setConfigs(data);
    } catch (err) {
      console.error('Error loading workflow configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const parseFlujo = (flujoStr) => {
    try {
      const parsed = JSON.parse(flujoStr);
      if (!Array.isArray(parsed)) throw new Error('Must be an array');
      if (parsed.length === 0) throw new Error('Must have at least one area');
      const validAreas = Object.keys(AREA_ICONS);
      for (const area of parsed) {
        if (!validAreas.includes(area)) {
          throw new Error(`Invalid area: ${area}`);
        }
      }
      return parsed;
    } catch (e) {
      throw new Error('JSON inválido o formato incorrecto. Use: ["area1", "area2", ...]');
    }
  };

  const handleOpenModal = (config = null) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        nombre: config.nombre,
        descripcion: config.descripcion || '',
        es_default: config.es_default,
        flujo_json: typeof config.flujo_json === 'string' 
          ? JSON.stringify(JSON.parse(config.flujo_json), null, 2)
          : JSON.stringify(config.flujo_json, null, 2),
        activo: config.activo,
      });
    } else {
      setEditingConfig(null);
      setFormData({
        nombre: '',
        descripcion: '',
        es_default: false,
        flujo_json: JSON.stringify(['demandante', 'validadora', 'aprobadora', 'contabilidad', 'pagadora', 'sap'], null, 2),
        activo: true,
      });
    }
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    try {
      // Validate JSON
      const flujo = parseFlujo(formData.flujo_json);
      
      const payload = {
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        es_default: formData.es_default,
        flujo_json: JSON.stringify(flujo),
        activo: formData.activo,
      };

      if (editingConfig) {
        await api.updateWorkflowConfig(editingConfig.id, payload);
      } else {
        await api.createWorkflowConfig(payload);
      }
      setShowModal(false);
      loadConfigs();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const renderFlujoPreview = (flujoJson) => {
    try {
      const flujo = typeof flujoJson === 'string' ? JSON.parse(flujoJson) : flujoJson;
      return (
        <div className="workflow-preview">
          {flujo.map((area, i) => (
            <React.Fragment key={area}>
              <span className="workflow-preview-area">
                {AREA_ICONS[area] || '•'} {area}
              </span>
              {i < flujo.length - 1 && <span className="workflow-preview-arrow">→</span>}
            </React.Fragment>
          ))}
        </div>
      );
    } catch {
      return <span className="text-muted">Formato inválido</span>;
    }
  };

  if (loading) {
    return <div className="text-center">Cargando...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div>
          <h1>Configuración de Flujos</h1>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Definí el orden de las áreas para cada tipo de flujo de trabajo
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          + Nuevo Flujo
        </button>
      </div>

      <div className="card">
        {configs.length === 0 ? (
          <div className="empty-state">
            <p>No hay configuraciones de workflow</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Flujo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {configs.map(config => (
                  <tr key={config.id}>
                    <td>
                      <strong>{config.nombre}</strong>
                      {config.es_default && (
                        <span className="badge badge-completada" style={{ marginLeft: '0.5rem' }}>
                          Default
                        </span>
                      )}
                    </td>
                    <td>{config.descripcion || '-'}</td>
                    <td>
                      {renderFlujoPreview(config.flujo_json)}
                    </td>
                    <td>
                      <span className={`badge ${config.activo ? 'badge-completada' : 'badge-cancelada'}`}>
                        {config.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', marginRight: '0.5rem' }}
                        onClick={() => handleOpenModal(config)}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Help Card */}
      <div className="card mt-3">
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>💡 Áreas disponibles</h3>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {AVAILABLE_AREAS.map(area => (
            <span key={area.value} className="badge badge-abierta">
              {area.label}
            </span>
          ))}
        </div>
        <p className="text-muted mt-2" style={{ fontSize: '0.8rem' }}>
          El orden en que aparecen las áreas define la secuencia del flujo de trabajo.
          Los pagos nuevos usarán el flujo marcado como "Default".
        </p>
      </div>

      {/* Workflow Config Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingConfig ? 'Editar Flujo' : 'Nuevo Flujo'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Flujo con Factura"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.descripcion}
                  onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Ej: Para pagos que requieren validación de factura"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Flujo (JSON array de áreas) *</label>
                <textarea
                  className="form-input"
                  value={formData.flujo_json}
                  onChange={(e) => setFormData(prev => ({ ...prev, flujo_json: e.target.value }))}
                  style={{ fontFamily: 'monospace', minHeight: '150px' }}
                  placeholder='["demandante", "validadora", "aprobadora", "contabilidad", "pagadora", "sap"]'
                  required
                />
                <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  Usá comillas para los nombres de áreas. Ej: ["demandante", "validadora"]
                </p>
              </div>

              {formError && (
                <div style={{ color: 'var(--danger)', padding: '0.5rem', background: 'rgba(239,68,68,0.1)', borderRadius: '4px', marginBottom: '1rem' }}>
                  {formError}
                </div>
              )}

              <div className="form-group">
                <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.es_default}
                    onChange={(e) => setFormData(prev => ({ ...prev, es_default: e.target.checked }))}
                  />
                  <span>Flujo por defecto para nuevas peticiones</span>
                </label>
              </div>

              <div className="form-group">
                <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData(prev => ({ ...prev, activo: e.target.checked }))}
                  />
                  <span>Activo</span>
                </label>
              </div>

              {/* Preview */}
              <div className="form-group">
                <label className="form-label">Vista previa:</label>
                <div style={{ padding: '0.75rem', background: 'var(--gray-100)', borderRadius: '6px' }}>
                  {renderFlujoPreview(formData.flujo_json)}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingConfig ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
