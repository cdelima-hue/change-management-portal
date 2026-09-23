// Servico de Autenticacao com Perfil de Administrador Global NATIVO
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
  getCurrentUser() {
    return adminGlobalUser;
  },

  obtenerUsuarioActual() {
    return adminGlobalUser;
  },

  estaAutenticado() {
    return localStorage.getItem('isLoggedIn') === 'true';
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
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('currentUser', JSON.stringify(adminGlobalUser));
    return { success: true, user: adminGlobalUser };
  },

  logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUser');
    window.location.reload();
  },

  inicializar() {
    if (!localStorage.getItem('currentUser')) {
      localStorage.setItem('currentUser', JSON.stringify(adminGlobalUser));
    }
  }
};

window.authService = authService;
document.addEventListener('DOMContentLoaded', () => {
  authService.inicializar();
});
