import React, { useState, useEffect } from 'react';
import { api } from '../api';

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'demandante', label: 'Demandante' },
  { value: 'validador', label: 'Validador' },
  { value: 'aprobador', label: 'Aprobador' },
  { value: 'contador', label: 'Contador' },
  { value: 'pagador', label: 'Pagador' },
  { value: 'sap', label: 'SAP' },
];

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    role: 'demandante',
    area: '',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Error loading users:', err);
      setLoadError('Error cargando los usuarios. Intente recargar la página.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to extract string value from enum
  const getRoleValue = (value) => {
    if (!value) return 'demandante';
    if (typeof value === 'string') return value;
    return value.value || 'demandante';
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        password: '',
        name: user.name,
        email: user.email,
        role: getRoleValue(user.role),
        area: user.area || '',
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        name: '',
        email: '',
        role: 'demandante',
        area: '',
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, formData);
      } else {
        await api.createUser(formData);
      }
      setShowModal(false);
      loadUsers();
    } catch (err) {
      console.error('Error saving user:', err);
      alert('Error guardando usuario: ' + err.message);
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('¿Eliminar este usuario definitivamente? Esta acción no se puede deshacer.')) return;
    try {
      await api.deleteUser(userId);
      loadUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Error eliminando usuario');
    }
  };

  const handleReactivate = async (userId) => {
    if (!confirm('¿Reactivar este usuario?')) return;
    try {
      await api.reactivateUser(userId);
      loadUsers();
    } catch (err) {
      alert('Error reactivando usuario: ' + err.message);
    }
  };

  // Filtered users for local search
  const filteredUsers = users.filter(u =>
    !searchQuery ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <h1>Gestión de Usuarios</h1>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          + Nuevo Usuario
        </button>
      </div>

      <div className="card">
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Buscar por usuario, nombre o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ maxWidth: '300px' }}
          />
        </div>
        {filteredUsers.length === 0 ? (
          <div className="empty-state">
            <p>{users.length === 0 ? 'No hay usuarios creados' : 'No hay usuarios que coincidan con la búsqueda'}</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Área</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className="badge badge-abierta">
                        {ROLES.find(r => r.value === user.role)?.label || user.role}
                      </span>
                    </td>
                    <td>{user.area || '-'}</td>
                    <td>
                      <span className={`badge ${user.active ? 'badge-completada' : 'badge-cancelada'}`}>
                        {user.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', marginRight: '0.5rem' }}
                        onClick={() => handleOpenModal(user)}
                      >
                        Editar
                      </button>
                      {user.active && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => handleDelete(user.id)}
                        >
                          Eliminar
                        </button>
                      )}
                      {!user.active && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => handleReactivate(user.id)}
                        >
                          Reactivar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Usuario *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  required
                  disabled={editingUser}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{editingUser ? 'Nueva Contraseña (dejar en blanco para no cambiar)' : 'Contraseña *'}</label>
                <input
                  type="password"
                  className="form-input"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  required={!editingUser}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Rol *</label>
                  <select
                    className="form-select"
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  >
                    {ROLES.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Área</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.area}
                    onChange={(e) => setFormData(prev => ({ ...prev, area: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingUser ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
