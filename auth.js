// Servicio de Autenticación Completo para Admin Global
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

  puedeEditar() {
    return true;
  },

  puedeCrear() {
    return true;
  },

  puedeEliminar() {
    return true;
  },

  puedeAprobar() {
    return true;
  },

  tienePermiso() {
    return true;
  },

  login() {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('currentUser', JSON.stringify(adminGlobalUser));
    sessionStorage.setItem('currentUser', JSON.stringify(adminGlobalUser));
    
    const loginDiv = document.getElementById('loginContainer');
    const appDiv = document.getElementById('appContainer');
    
    if (loginDiv) loginDiv.style.display = 'none';
    if (appDiv) {
      appDiv.classList.remove('hidden');
      appDiv.style.display = 'block';
    }

    if (typeof window.mostrarAppPrincipal === 'function') {
      window.mostrarAppPrincipal();
    } else if (typeof window.inicializarApp === 'function') {
      window.inicializarApp();
    } else {
      window.location.reload();
    }
    return { success: true, user: adminGlobalUser };
  },

  logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = window.location.pathname;
  },

  inicializar() {
    localStorage.setItem('currentUser', JSON.stringify(adminGlobalUser));
    localStorage.setItem('isLoggedIn', 'true');
  }
};

window.authService = authService;

document.addEventListener('DOMContentLoaded', () => {
  authService.inicializar();
});
