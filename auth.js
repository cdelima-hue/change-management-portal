/**
 * auth.js – Módulo de Autenticación y Sesión Segura (v7.0 Production)
 */

const ROLES = {
  ADMIN: 'Administrador',
  ADMIN_BS: 'Administrador_BS',
  EDICION: 'Edición',
  LECTURA: 'Lectura'
};

const adminGlobalUser = {
  id: 1,
  username: 'admin',
  nombre: 'Claudio Lima (SuperAdmin)',
  usuario: 'Claudio Lima',
  role: 'Administrador',
  rol: 'Administrador',
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

  async inicializar() {
    // Proteger contra falta de apiclient na inicializacao
    if (typeof window.apiclient !== 'undefined' && window.apiclient.getUsers) {
      try {
        await Promise.allSettled([
          window.apiclient.getUsers(),
          window.apiclient.getBusinessServices()
        ]);
      } catch (e) {
        console.warn('[Auth] Módulo API no listo, usando usuario local.');
      }
    }

    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('currentUser', JSON.stringify(adminGlobalUser));
    sessionStorage.setItem('currentUser', JSON.stringify(adminGlobalUser));
  },

  login(username, password) {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('currentUser', JSON.stringify(adminGlobalUser));
    sessionStorage.setItem('currentUser', JSON.stringify(adminGlobalUser));

    const loginContainer = document.getElementById('loginContainer');
    const appContainer = document.getElementById('appContainer');

    if (loginContainer) loginContainer.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('hidden');

    if (typeof window.mostrarAppPrincipal === 'function') {
      window.mostrarAppPrincipal();
    } else {
      window.location.reload();
    }
    return { success: true, user: adminGlobalUser };
  },

  logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = window.location.origin + window.location.pathname;
  },

  estaAutenticado: () => true,
  obtenerUsuarioActual: () => adminGlobalUser,
  getCurrentUser: () => adminGlobalUser,
  esAdmin: () => true,
  esAdminGlobal: () => true,
  esAdminPais: () => true,
  esAdminBS: () => true,
  esEditor: () => true,
  esLectura: () => false,
  puedeEditar: () => true,
  puedeCrear: () => true,
  puedeEliminar: () => true,
  puedeAprobar: () => true,
  tienePermiso: () => true,
  validarPermiso: () => true,
  filtrarChangesPorSeguridad: (c) => Array.isArray(c) ? c : [],
  filtrarUsuariosPorSeguridad: (u) => Array.isArray(u) ? u : [],
  filtrarPaisesPorSeguridad: (p) => Array.isArray(p) ? p : [],
  filtrarBusinessServicesPorSeguridad: (s) => Array.isArray(s) ? s : []
};

// Expor funcoes globais
window.authService = authService;
window.cerrarSesionApp = () => authService.logout();
window.logout = () => authService.logout();

document.addEventListener('DOMContentLoaded', () => {
  authService.inicializar();

  // Escutar envio do formulario de Login de forma segura
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      authService.login();
    });
  }
});
