import React from 'react';
import { AREAS_DISPLAY, AREA_ICONS, AREA_ACTIONS } from '../utils/constants';

function getWorkflowDisplayEstado(estado) {
  switch (estado) {
    case 'PENDIENTE': return 'Pendiente';
    case 'EN_PROCESO': return 'Terminado';
    case 'APROBADO': return 'Aprobado';
    case 'RECHAZADO': return 'Rechazado';
    case 'REVERSADO': return 'Reversado';
    default: return estado;
  }
}

/**
 * WorkflowPanel — renders the ordered list of workflow steps with
 * advance/reverse actions. Stateless: all state lives in PaymentDetailPage.
 *
 * Props:
 *   payment           - full payment object
 *   workflowStates    - array of WorkflowState objects
 *   commentsByArea    - { [area]: Comment[] }
 *   areasOrder        - ordered area name array for this payment type
 *   user              - current logged-in user
 *   onOpenAction      - (type: 'advance'|'reverse', area: string) => void
 *   tipoPagoLabel     - human-readable tipo pago string
 */
export default function WorkflowPanel({
  payment,
  workflowStates,
  commentsByArea,
  areasOrder,
  user,
  onOpenAction,
  tipoPagoLabel,
}) {
  const sortedStates = [...workflowStates].sort(
    (a, b) => areasOrder.indexOf(a.area) - areasOrder.indexOf(b.area)
  );

  const isLocked =
    payment.estado_general === 'CANCELADA' ||
    payment.estado_general === 'COMPLETADA';

  return (
    <div className="card">
      <h3 className="card-title">Workflow</h3>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
        {tipoPagoLabel}
      </div>
      <div className="workflow-timeline">
        {sortedStates.map((state, index) => {
          const areaComments = commentsByArea[state.area] || [];
          const hasActed = state.estado !== 'PENDIENTE' || areaComments.length > 0;
          const canReverse = hasActed && state.estado !== 'RECHAZADO';
          const userAreas = user?.accessible_areas || [];
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
                    {!isLocked && canAct && state.estado !== 'APROBADO' && state.estado !== 'RECHAZADO' && (
                      <button
                        className="btn btn-success"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => onOpenAction('advance', state.area)}
                      >
                        {AREA_ACTIONS[state.area] || 'Avanzar'}
                      </button>
                    )}
                    {!isLocked && canReverse && canAct && (
                      <button
                        className="btn btn-danger"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => onOpenAction('reverse', state.area)}
                        title="Revertir"
                      >
                        ↩
                      </button>
                    )}
                    {hasActed && (
                      <span
                        style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '1rem' }}
                        title="Completado"
                      >
                        ✓
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {index < sortedStates.length - 1 && (
                <div
                  style={{
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.7rem',
                    padding: '2px 0',
                  }}
                >
                  ↓
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
