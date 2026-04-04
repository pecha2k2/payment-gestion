import React from 'react';
import { api } from '../api';
import { formatDate } from '../utils/formatters';
import { useToast } from './Toast';

/**
 * DocumentsPanel — list of payment documents with view/download/delete actions.
 *
 * Props:
 *   payment       - payment object (needs .id, .numero_peticion, .documents)
 *   user          - current user (role determines delete visibility)
 *   onRefresh     - () => void  called after any mutation (upload / delete)
 *   onOpenUpload  - () => void  opens the upload modal in the parent
 */
export default function DocumentsPanel({ payment, user, onRefresh, onOpenUpload }) {
  const { addToast } = useToast();

  const isPdf = (mimeType) => mimeType && mimeType.includes('pdf');

  const handleDownload = async (docId, docName) => {
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

  const handleDownloadAll = async () => {
    try {
      const url = await api.downloadAllDocuments(payment.id);
      const link = document.createElement('a');
      link.href = url;
      link.download = `documentos_${payment.numero_peticion}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error descargando ZIP:', err);
      addToast('Error al descargar los documentos', 'error');
    }
  };

  const handleViewPdf = async (docId) => {
    try {
      const url = await api.viewDocument(docId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Error obteniendo token de documento:', err);
      addToast('Error abriendo el documento. Intentá de nuevo.', 'error');
    }
  };

  const handleDelete = async (docId) => {
    // Note: confirmation is handled by the caller if needed.
    // Here we just call the API — the parent reloads via onRefresh.
    try {
      await api.deleteDocument(docId);
      onRefresh();
      addToast('Documento eliminado', 'success');
    } catch (err) {
      console.error('Error deleting:', err);
      addToast('Error eliminando documento', 'error');
    }
  };

  const docs = payment.documents || [];

  return (
    <div className="card mt-3">
      <div className="card-header">
        <h3 className="card-title">Documentos</h3>
        <div className="flex gap-1">
          <button className="btn btn-secondary" onClick={handleDownloadAll}>
            📦 Descargar todos
          </button>
          <button className="btn btn-primary" onClick={onOpenUpload}>
            + Subir Documentos
          </button>
        </div>
      </div>

      {docs.length > 0 ? (
        <div>
          {docs.map(doc => (
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
                  <button className="btn btn-primary" onClick={() => handleViewPdf(doc.id)}>
                    Ver
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => handleDownload(doc.id, doc.nombre_original)}>
                  Descargar
                </button>
                {user?.role === 'admin' && (
                  <button className="btn btn-danger" onClick={() => handleDelete(doc.id)}>
                    Eliminar
                  </button>
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
  );
}
