import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { WORKFLOW_ORDER_CON_FACTURA, WORKFLOW_ORDER_SIN_FACTURA, AREA_ICONS, AVAILABLE_AREAS } from '../utils/constants';
import { formatCurrency, getTipoPagoStr } from '../utils/formatters';

const AREAS = [
  { value: '', label: 'Todas' },
  ...AVAILABLE_AREAS,
];

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'ABIERTA', label: 'Abierta' },
  { value: 'EN_PROCESO', label: 'En Proceso' },
  { value: 'COMPLETADA', label: 'Completada' },
  { value: 'CANCELADA', label: 'Cancelada' },
];

export default function PaymentsListPage({ user }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [paymentsDetail, setPaymentsDetail] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 0 });
  const [filters, setFilters] = useState({
    estado_general: searchParams.get('estado') || '',
    area: searchParams.get('area') || '',
    search: '',
    searchField: '',
  });
  // Debounce ref: avoids stale-closure bug where clearFilters() llamaba loadPayments()
  // con los filtros anteriores antes de que setFilters() aplicara el nuevo estado.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const loadPaymentsWithFilters = useCallback(async (currentFilters, page, perPage) => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = { page, per_page: perPage };
      if (currentFilters.estado_general) params.estado_general = currentFilters.estado_general;
      if (currentFilters.area) params.area = currentFilters.area;

      const response = await api.getPayments(params);
      const items = Array.isArray(response) ? response : (response.items || []);
      const meta = !Array.isArray(response) ? response : { total: items.length, page: 1, per_page: items.length, pages: 1 };

      setPayments(items);
      setPagination(prev => ({
        ...prev,
        total: meta.total || items.length,
        pages: meta.pages || 1,
        page: meta.page || 1,
      }));

      // workflow_states ya vienen en la respuesta paginada — sin requests extra
      const detailMap = {};
      items.forEach(p => { detailMap[p.id] = p; });
      setPaymentsDetail(detailMap);
    } catch (err) {
      console.error('Error loading payments:', err);
      setLoadError('Error cargando los pagos. Intente recargar la página.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPaymentsWithFilters(filters, pagination.page, pagination.per_page);
  }, [filters.estado_general, filters.area, pagination.page]);

  // Alias para compatibilidad con usos existentes en el mismo componente
  const loadPayments = () =>
    loadPaymentsWithFilters(filtersRef.current, pagination.page, pagination.per_page);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!filters.search) {
      loadPayments();
      return;
    }
    try {
      const results = await api.search(filters.search, filters.searchField || undefined);
      setPayments(results);

      const detailMap = {};
      results.forEach(p => { detailMap[p.id] = p; });
      setPaymentsDetail(detailMap);
    } catch (err) {
      console.error('Error buscando:', err);
      setLoadError('Error en la búsqueda. Intente de nuevo.');
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
    const newParams = new URLSearchParams();
    if (newFilters.estado_general) newParams.set('estado', newFilters.estado_general);
    if (newFilters.area) newParams.set('area', newFilters.area);
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const clearFilters = () => {
    const cleared = { estado_general: '', area: '', search: '', searchField: '' };
    setFilters(cleared);
    setPagination(prev => ({ ...prev, page: 1 }));
    setSearchParams(new URLSearchParams());
    // Usar los filtros limpios directamente — evita leer state stale del closure anterior
    loadPaymentsWithFilters(cleared, 1, pagination.per_page);
  };

  // Get the FIRST pending area respecting the configured flow order
  const getPendingArea = (payment) => {
    const detail = paymentsDetail[payment.id];
    if (!detail || !detail.workflow_states) return null;
    const order = getWorkflowOrderForPayment(payment);
    // Walk the flow order and return the first area that is still PENDIENTE
    for (const area of order) {
      const state = detail.workflow_states.find(s => s.area === area);
      if (state && state.estado === 'PENDIENTE') return area;
    }
    return null;
  };

  const getAreaLabel = (area) => {
    const found = AREAS.find(a => a.value === area);
    return found ? found.label : area;
  };

  // Get workflow order for a payment - always based on payment.tipo_pago from the list response
  const getWorkflowOrderForPayment = (payment) => {
    const tipoStr = getTipoPagoStr(payment.tipo_pago);
    return tipoStr === 'SIN_FACTURA'
      ? WORKFLOW_ORDER_SIN_FACTURA
      : WORKFLOW_ORDER_CON_FACTURA;
  };

  // Get mini workflow display for a payment
  const getWorkflowMiniDisplay = (payment) => {
    const order = getWorkflowOrderForPayment(payment);
    const detail = paymentsDetail[payment.id];
    if (!detail || !detail.workflow_states) {
      // If no detail, show all as PENDIENTE in correct order
      return order.map(area => ({
        area,
        estado: 'PENDIENTE',
        icon: AREA_ICONS[area] || '•'
      }));
    }
    return order.map(area => {
      const state = detail.workflow_states.find(s => s.area === area);
      return {
        area,
        estado: state?.estado || 'PENDIENTE',
        icon: AREA_ICONS[area] || '•'
      };
    });
  };

  if (loading) {
    return <div className="text-center">Cargando...</div>;
  }

  return (
    <div>
      {loadError && (
        <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
          ⚠️ {loadError}
        </div>
      )}
      <div className="flex justify-between items-center mb-3">
        <h1>Peticiones de Pago</h1>
        {user?.role === 'admin' || user?.role === 'demandante' ? (
          <Link to="/payments/new" className="btn btn-primary">+ Nueva Petición</Link>
        ) : null}
      </div>

      <div className="card">
        <form onSubmit={handleSearch} className="search-bar">
          <input
            type="text"
            className="form-input"
            placeholder="Buscar..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
          <select
            className="form-select"
            style={{ width: 'auto' }}
            value={filters.searchField}
            onChange={(e) => setFilters(prev => ({ ...prev, searchField: e.target.value }))}
          >
            <option value="">Todos los campos</option>
            <option value="numero_peticion">Número de petición</option>
            <option value="propuesta_gasto">Propuesta de gasto</option>
            <option value="orden_pago">Orden de pago</option>
            <option value="numero_factura">Número de factura</option>
            <option value="n_documento_contable">Nº Documento contable</option>
          </select>
          <button type="submit" className="btn btn-primary">Buscar</button>
          <button type="button" className="btn btn-secondary" onClick={clearFilters}>Limpiar</button>
        </form>

        {/* Filter by status */}
        <div className="filters">
          <span className="filter-label">Estado:</span>
          {ESTADOS.map(estado => (
            <button
              key={estado.value}
              className={`filter-btn ${filters.estado_general === estado.value ? 'active' : ''}`}
              onClick={() => handleFilterChange('estado_general', estado.value)}
            >
              {estado.label}
            </button>
          ))}
        </div>

        {/* Filter by area */}
        <div className="filters">
          <span className="filter-label">Área:</span>
          {AREAS.map(area => (
            <button
              key={area.value}
              className={`filter-btn ${filters.area === area.value ? 'active' : ''}`}
              onClick={() => handleFilterChange('area', area.value)}
            >
              {area.label}
            </button>
          ))}
        </div>

        {filters.area && filters.area !== '' && (
          <div className="filter-info" style={{ padding: '0.5rem', background: 'var(--warning)', color: 'white', borderRadius: '4px', marginBottom: '1rem' }}>
            <strong>☁️ Mostrando peticiones pendientes de trámites en: {getAreaLabel(filters.area)}</strong>
          </div>
        )}

        {payments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p>No hay peticiones que coincidan con los filtros</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Propuesta de Gasto</th>
                  <th>OP</th>
                  <th>Tipo</th>
                  <th>Flujo</th>
                  <th>Siguiente Acción</th>
                  <th>Monto</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(payment => {
                  const pendingArea = getPendingArea(payment);
                  return (
                    <tr key={payment.id}>
                      <td><Link to={`/payments/${payment.id}`} style={{ color: '#fbbf24', fontWeight: 'bold' }}>{payment.numero_peticion}</Link></td>
                      <td title={String(payment.propuesta_gasto)}>
                        {String(payment.propuesta_gasto).length > 40
                          ? String(payment.propuesta_gasto).substring(0, 40) + '...'
                          : payment.propuesta_gasto}
                      </td>
                      <td>{payment.orden_pago || '-'}</td>
                      <td>
                        <span className={`badge ${getTipoPagoStr(payment.tipo_pago) === 'CON_FACTURA' ? 'badge-abierta' : 'badge-en_proceso'}`}>
                          {getTipoPagoStr(payment.tipo_pago) === 'CON_FACTURA' ? 'Con Factura' : 'Sin Factura'}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const workflow = getWorkflowMiniDisplay(payment);
                          if (!workflow) return '-';
                          return (
                            <div style={{ display: 'flex', gap: '2px', fontSize: '0.65rem', alignItems: 'center' }}>
                              {workflow.map((w, i) => (
                                <React.Fragment key={w.area}>
                                  <span
                                    title={`${w.area}: ${w.estado}`}
                                    style={{
                                      padding: '1px 3px',
                                      borderRadius: '2px',
                                      background: w.estado === 'APROBADO' ? 'var(--success)' : w.estado === 'EN_PROCESO' ? 'var(--warning)' : '#ccc',
                                      color: w.estado === 'APROBADO' || w.estado === 'EN_PROCESO' ? 'white' : 'var(--text)',
                                      fontWeight: w.estado !== 'PENDIENTE' ? 'bold' : 'normal',
                                    }}
                                  >
                                    {w.icon}
                                  </span>
                                  {i < workflow.length - 1 && <span style={{ color: '#999' }}>→</span>}
                                </React.Fragment>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td>
                        {payment.estado_general === 'CANCELADA' ? (
                          <span className="badge badge-cancelada">Cancelada</span>
                        ) : payment.estado_general === 'COMPLETADA' ? (
                          <span className="badge badge-completada">Completado</span>
                        ) : pendingArea ? (
                          <span className="badge badge-en_proceso">{getAreaLabel(pendingArea)}</span>
                        ) : (
                          <span className="badge badge-completada">Completado</span>
                        )}
                      </td>
                      <td>{formatCurrency(payment.monto_total, payment.divisa)}</td>
                      <td>
                        <Link to={`/payments/${payment.id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                          Ver
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {pagination.pages > 1 && (
              <div className="pagination">
                <span className="pagination-info">
                  Mostrando {(pagination.page - 1) * pagination.per_page + 1} - {Math.min(pagination.page * pagination.per_page, pagination.total)} de {pagination.total} peticiones
                </span>
                <div className="pagination-buttons">
                  <button
                    className="btn btn-secondary"
                    onClick={() => handlePageChange(1)}
                    disabled={pagination.page === 1}
                  >
                    ««
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    «
                  </button>
                  <span className="pagination-current">
                    Página {pagination.page} de {pagination.pages}
                  </span>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                  >
                    »
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handlePageChange(pagination.pages)}
                    disabled={pagination.page === pagination.pages}
                  >
                    »»
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
