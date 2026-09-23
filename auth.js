// Servicio de Autenticación compatible con despliegue Render
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

  login() {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('currentUser', JSON.stringify(adminGlobalUser));
    sessionStorage.setItem('currentUser', JSON.stringify(adminGlobalUser));
    
    // Ocultar formulario de login e iniciar interfaz principal
    const loginDiv = document.getElementById('loginContainer');
    const appDiv = document.getElementById('appContainer');
    
    if (loginDiv) loginDiv.classList.add('hidden');
    if (appDiv) appDiv.classList.remove('hidden');

    if (window.inicializarApp) {
      window.inicializarApp();
    } else if (window.app && typeof window.app.init === 'function') {
      window.app.init();
    } else {
      location.hash = '#dashboard';
      window.location.reload();
    }
    return { success: true, user: adminGlobalUser };
  },

  logout() {
    localStorage.clear();
    sessionStorage.clear();
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
