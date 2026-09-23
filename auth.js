// Servicio de Autenticación compatible con app.js y rol Admin Global
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
    
    // Ocultar pantalla de login y mostrar app principal
    const loginDiv = document.getElementById('loginContainer');
    const appDiv = document.getElementById('appContainer');
    if (loginDiv) loginDiv.classList.add('hidden');
    if (appDiv) appDiv.classList.remove('hidden');

    if (window.app && typeof window.app.inicializar === 'function') {
      window.app.inicializar();
    } else {
      window.location.reload();
    }
    return { success: true, user: adminGlobalUser };
  },

  logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUser');
    window.location.reload();
  },

  inicializar() {
    localStorage.setItem('currentUser', JSON.stringify(adminGlobalUser));
  }
};

window.authService = authService;
document.addEventListener('DOMContentLoaded', () => {
  authService.inicializar();
});
