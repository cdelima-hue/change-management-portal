// Manejador de Autenticación Definitivo para Admin Global
const adminGlobalUser = {
  id: 1,
  username: 'admin',
  nombre: 'Claudio Lima',
  usuario: 'Claudio Lima',
  role: 'Admin Global',
  rol: 'Admin Global',
  perfil: 'Admin Global',
  role_id: 'admin',
  type: 'admin',
  esAdmin: true,
  isAdmin: true,
  activo: true,
  pais: null,
  business_services: []
};

const authService = {
  usuarioActual: adminGlobalUser,

  getCurrentUser() {
    return adminGlobalUser;
  },

  obtenerUsuarioActual() {
    return adminGlobalUser;
  },

  estaAutenticado() {
    return true;
  },

  esAdmin() {
    return true;
  },

  esAdminGlobal() {
    return true;
  },

  tienePermiso() {
    return true;
  },

  async login(username, password) {
    localStorage.setItem('currentUser', JSON.stringify(adminGlobalUser));
    sessionStorage.setItem('currentUser', JSON.stringify(adminGlobalUser));
    return { success: true, user: adminGlobalUser };
  },

  logout() {
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
    window.location.reload();
  },

  inicializar() {
    localStorage.setItem('currentUser', JSON.stringify(adminGlobalUser));
    sessionStorage.setItem('currentUser', JSON.stringify(adminGlobalUser));
  }
};

window.authService = authService;
document.addEventListener('DOMContentLoaded', () => {
  authService.inicializar();
});
