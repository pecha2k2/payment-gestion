import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { AREAS_DISPLAY, AREA_ICONS } from '../utils/constants';
import { formatDate } from '../utils/formatters';

/**
 * CommentImagePreview — lazily loads an image document via ephemeral token.
 */
function CommentImagePreview({ doc, onDownload }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let objectUrl;
    const loadImage = async () => {
      try {
        const { token } = await api.requestDocumentToken(doc.id);
        const response = await fetch(`/api/documents/public/${doc.id}/view?token=${token}`);
        if (!response.ok) throw new Error('Failed to load image');
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch (err) {
        console.error('Error loading image:', err);
        setError(err.message || 'Error cargando imagen');
      } finally {
        setLoading(false);
      }
    };
    loadImage();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [doc.id]);

  if (loading) return <span style={{ fontSize: '0.75rem', color: '#999' }}>Cargando imagen...</span>;
  if (error) return <span style={{ fontSize: '0.75rem', color: '#c00' }}>{error}</span>;

  return (
    <div style={{ display: 'inline-block' }}>
      <img
        src={imageUrl}
        alt={doc.nombre_original}
        style={{
          maxWidth: '200px',
          maxHeight: '200px',
          borderRadius: '4px',
          border: '1px solid #ddd',
          cursor: 'pointer',
        }}
        onClick={() => onDownload(doc.id, doc.nombre_original)}
        title="Clic para descargar"
      />
      <span style={{ fontSize: '0.7rem', color: '#666', display: 'block', marginTop: '2px' }}>
        📎 {doc.nombre_original}
      </span>
    </div>
  );
}

/**
 * CommentsPanel — grouped comments per area, stateless except for image loading.
 *
 * Props:
 *   comments        - flat Comment[] array
 *   commentsByArea  - { [area]: Comment[] }
 *   areasOrder      - ordered area name array
 *   onDownload      - (docId, docName) => void
 */
export default function CommentsPanel({ comments, commentsByArea, areasOrder, onDownload }) {
  return (
    <div className="card">
      <h3 className="card-title">Comentarios</h3>
      <div className="comments-list">
        {areasOrder.map(area => {
          const areaComments = commentsByArea[area] || [];
          if (areaComments.length === 0) return null;
          return (
            <div key={area} className="comment-area-section">
              <div className="comment-area-title">
                {AREA_ICONS[area]} {AREAS_DISPLAY[area]}
              </div>
              {areaComments.map(comment => (
                <div key={comment.id} className="comment">
                  <div className="comment-header">
                    <span className="comment-author">
                      {comment.usuario?.nombre || comment.usuario?.username || 'Usuario'}
                      {comment.usuario?.email && (
                        <span style={{ fontWeight: 'normal', fontSize: '0.8em', marginLeft: '0.5em' }}>
                          ({comment.usuario.email})
                        </span>
                      )}
                    </span>
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
                    <div className="comment-attachments mt-2">
                      <strong style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>
                        Documentos adjuntos:
                      </strong>
                      <div className="flex flex-wrap gap-2">
                        {comment.documentos.map(doc => (
                          <div key={doc.id}>
                            {doc.mime_type?.startsWith('image/') ? (
                              <CommentImagePreview doc={doc} onDownload={onDownload} />
                            ) : (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => onDownload(doc.id, doc.nombre_original)}
                              >
                                📎 {doc.nombre_original}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ textAlign: 'right', marginTop: '0.4rem' }}>
                    <span className="comment-date">{formatDate(comment.created_at)}</span>
                  </div>
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
  );
}
