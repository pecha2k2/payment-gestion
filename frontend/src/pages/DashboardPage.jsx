import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

const AREAS_ORDER = ['demandante', 'validadora', 'aprobadora', 'contabilidad', 'pagadora', 'sap'];

// Helper function to determine next action - returns area and display info
const getNextActionInfo = (payment) => {
  if (payment.estado_general === 'COMPLETADA') return { type: 'completada', area: null };
  if (payment.estado_general === 'CANCELADA') return { type: 'cancelada', area: null };
  
  // Find first pending area in workflow order
  const workflowOrder = payment.tipo_pago === 'CON_FACTURA' 
    ? ['demandante', 'validadora', 'aprobadora', 'contabilidad', 'pagadora', 'sap']
    : ['demandante', 'aprobadora', 'pagadora', 'validadora', 'contabilidad', 'sap'];
  
  if (payment.workflow_states) {
    for (const area of workflowOrder) {
      const state = payment.workflow_states.find(ws => ws.area === area);
      if (state && state.estado === 'PENDIENTE') {
        return { type: 'pendiente', area };
      }
    }
  }
  
  return { type: 'en_proceso', area: null };
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

const AREAS_DISPLAY = {
  demandante: 'Demandante',
  validadora: 'Validadora',
  aprobadora: 'Aprobadora',
  contabilidad: 'Contabilidad',
  pagadora: 'Pagadora',
  sap: 'SAP',
};

const AREA_ICONS = {
  demandante: '📝',
  validadora: '✅',
  aprobadora: '👍',
  contabilidad: '📊',
  pagadora: '💰',
  sap: '☁️',
};

export default function DashboardPage({ user }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    abiertas: 0,
    enProceso: 0,
    completadas: 0,
    canceladas: 0,
  });
  const [summary, setSummary] = useState({ by_area: {}, my_pending: 0 });
  const [recentPayments, setRecentPayments] = useState([]);
  const [myIncidences, setMyIncidences] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [paymentsData, incidencesSummary, myPending] = await Promise.all([
        api.getPayments({ limit: 100 }),
        api.getIncidencesSummary(),
        api.getMyPendingIncidences()
      ]);

      // API returns {items: [...], total, page, pages} - extract items array
      const payments = paymentsData.items || paymentsData;

      setRecentPayments(payments.slice(0, 5));
      setStats({
        total: paymentsData.total || payments.length,
        abiertas: payments.filter(p => p.estado_general === 'ABIERTA').length,
        enProceso: payments.filter(p => p.estado_general === 'EN_PROCESO').length,
        completadas: payments.filter(p => p.estado_general === 'COMPLETADA').length,
        canceladas: payments.filter(p => p.estado_general === 'CANCELADA').length,
      });
      setSummary(incidencesSummary);
      setMyIncidences(myPending);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterByArea = (area) => {
    navigate(`/payments?area=${area}`);
  };

  const filterByStatus = (estado) => {
    navigate(`/payments?estado=${estado}`);
  };

  if (loading) {
    return <div className="text-center">Cargando...</div>;
  }

  // Sort areas by AREAS_ORDER
  const sortedAreas = AREAS_ORDER.map(area => ({
    area,
    count: summary.by_area[area] || 0
  }));

  return (
    <div>
      <div className="hero-gradient mb-3">
        <div className="dna-hero">
          {[...Array(6)].map((_, i) => (
            <div key={`hero-strand-${i}`} className="dna-hero-strand" />
          ))}
        </div>
        <div className="hero-content">
          <h1 className="hero-title">Gestión de Pagos</h1>
          <p className="hero-subtitle">Bienvenido, {user?.name}</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-3">
        <h1 style={{ display: 'none' }}>Dashboard</h1>
        {user?.role === 'admin' || user?.role === 'demandante' ? (
          <Link to="/payments/new" className="btn btn-primary">+ Nueva Petición</Link>
        ) : null}
      </div>

      {/* Incidencias pendientes del usuario */}
      {myIncidences.length > 0 && (
        <div className="card mb-3" style={{ borderLeft: '4px solid var(--warning)' }}>
          <h3 className="card-title" style={{ color: 'var(--warning)' }}>
            ⚠️ Mis Incidencias Pendientes ({myIncidences.length})
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Petición</th>
                  <th>Área</th>
                  <th>Estado</th>
                  <th>Monto</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {myIncidences.map((inc) => (
                  <tr key={inc.workflow_state_id}>
                    <td>
                      <Link to={`/payments/${inc.payment_request.id}`} style={{ color: '#fbbf24', fontWeight: 'bold' }}>
                        {inc.payment_request.numero_peticion}
                      </Link>
                    </td>
                    <td>{AREA_ICONS[inc.area]} {AREAS_DISPLAY[inc.area] || inc.area}</td>
                    <td><span className={`badge badge-${inc.estado.toLowerCase()}`}>{inc.estado}</span></td>
                    <td>{formatCurrency(inc.payment_request.monto_total, inc.payment_request.divisa)}</td>
                    <td>
                      <Link to={`/payments/${inc.payment_request.id}`} className="btn btn-warning btn-sm">
                        Atender
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resumen por áreas - orden correcto */}
      <div className="card mb-3">
        <h3 className="card-title">Incidencias por Área</h3>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
          {sortedAreas.map(({ area, count }) => (
            <div
              key={area}
              className="stat-card"
              style={{ cursor: 'pointer', borderLeft: count > 0 ? '3px solid var(--warning)' : 'none' }}
              onClick={() => filterByArea(area)}
              title={`Ver peticiones pendientes en ${AREAS_DISPLAY[area]}`}
            >
              <div className="stat-value" style={{ color: count > 0 ? 'var(--warning)' : 'var(--gray-400)' }}>{count}</div>
              <div className="stat-label">{AREA_ICONS[area]} {AREAS_DISPLAY[area]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Estados */}
      <div className="stats-grid">
        <div
          className="stat-card"
          style={{ cursor: 'pointer' }}
          onClick={() => filterByStatus('')}
          title="Ver todas las peticiones"
        >
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div
          className="stat-card"
          style={{ cursor: 'pointer', borderLeft: stats.abiertas > 0 ? '3px solid #2563eb' : 'none' }}
          onClick={() => filterByStatus('ABIERTA')}
          title="Ver peticiones abiertas"
        >
          <div className="stat-value" style={{ color: '#2563eb' }}>{stats.abiertas}</div>
          <div className="stat-label">Abiertas</div>
        </div>
        <div
          className="stat-card"
          style={{ cursor: 'pointer', borderLeft: stats.enProceso > 0 ? '3px solid #f59e0b' : 'none' }}
          onClick={() => filterByStatus('EN_PROCESO')}
          title="Ver peticiones en proceso"
        >
          <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.enProceso}</div>
          <div className="stat-label">En Proceso</div>
        </div>
        <div
          className="stat-card"
          style={{ cursor: 'pointer', borderLeft: stats.completadas > 0 ? '3px solid #22c55e' : 'none' }}
          onClick={() => filterByStatus('COMPLETADA')}
          title="Ver peticiones completadas"
        >
          <div className="stat-value" style={{ color: '#22c55e' }}>{stats.completadas}</div>
          <div className="stat-label">Completadas</div>
        </div>
        <div
          className="stat-card"
          style={{ cursor: 'pointer', borderLeft: stats.canceladas > 0 ? '3px solid #ef4444' : 'none' }}
          onClick={() => filterByStatus('CANCELADA')}
          title="Ver peticiones canceladas"
        >
          <div className="stat-value" style={{ color: '#ef4444' }}>{stats.canceladas}</div>
          <div className="stat-label">Canceladas</div>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header">
          <h2 className="card-title">Últimas Peticiones</h2>
          <Link to="/payments" className="btn btn-secondary">Ver todas</Link>
        </div>
        {recentPayments.length === 0 ? (
          <div className="empty-state">
            <p>No hay peticiones creadas</p>
            <Link to="/payments/new" className="btn btn-primary mt-2">Crear primera petición</Link>
          </div>
        ) : (
          <div className="table-container dashboard-table">
            <table>
              <thead>
<tr className="dashboard-table-header">
                    <th style={{ width: '12%' }}>Nº Petición</th>
                    <th style={{ width: '10%' }}>Propuesta</th>
                    <th style={{ width: '10%' }}>OP</th>
                    <th style={{ width: '12%' }}>Tipo</th>
                    <th style={{ width: '12%' }}>Estado</th>
                    <th style={{ width: '18%' }}>Siguiente acción</th>
                    <th style={{ width: '14%' }}>Monto</th>
                  </tr>
              </thead>
              <tbody>
                {recentPayments.map(payment => (
                  <tr key={payment.id}>
                    <td><Link to={`/payments/${payment.id}`} style={{ color: '#fbbf24', fontWeight: 'bold' }}>{payment.numero_peticion}</Link></td>
                    <td>{payment.propuesta_gasto}</td>
                    <td>{payment.orden_pago || '-'}</td>
                    <td><span className={`badge badge-${payment.tipo_pago === 'CON_FACTURA' ? 'abierta' : 'en_proceso'}`}>
                      {payment.tipo_pago === 'CON_FACTURA' ? 'Con Factura' : 'Sin Factura'}
                    </span></td>
                    <td><span className={`badge badge-${payment.estado_general.toLowerCase()}`}>
                      {payment.estado_general}
                    </span></td>
                    <td>
                      {(() => {
                        const nextInfo = getNextActionInfo(payment);
                        if (nextInfo.type === 'completada') {
                          return <span className="badge badge-completada">Completada</span>;
                        } else if (nextInfo.type === 'cancelada') {
                          return <span className="badge badge-cancelada">Cancelada</span>;
                        } else if (nextInfo.type === 'pendiente') {
                          const areaName = AREAS_DISPLAY[nextInfo.area];
                          const areaIcon = AREA_ICONS[nextInfo.area];
                          return <span className="badge badge-en_proceso">{areaIcon} {areaName}</span>;
                        } else {
                          return <span className="badge badge-abierta">En proceso</span>;
                        }
                      })()}
                    </td>
                    <td>{formatCurrency(payment.monto_total, payment.divisa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
