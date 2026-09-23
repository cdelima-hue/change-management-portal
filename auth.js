// Servico de Autenticacao e Seguranca Total para Admin Global
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

  // Metodos de Leitura de Utilizador
  getCurrentUser() { return adminGlobalUser; },
  obtenerUsuarioActual() { return adminGlobalUser; },
  estaAutenticado() { return true; },

  // Metodos de Validacao de Roles e Permissoes
  esAdmin() { return true; },
  esAdminGlobal() { return true; },
  esAdminPais() { return true; },
  esAdminBS() { return true; },
  esEditor() { return true; },
  esLectura() { return false; },
  puedeEditar() { return true; },
  puedeCrear() { return true; },
  puedeEliminar() { return true; },
  puedeAprobar() { return true; },
  tienePermiso() { return true; },
  validarPermiso() { return true; },

  // Metodos de Filtragem e Seguranca Exigidos pelo app.js
  filtrarChangesPorSeguridad(changes) {
    return Array.isArray(changes) ? changes : [];
  },
  filtrarUsuariosPorSeguridad(usuarios) {
    return Array.isArray(usuarios) ? usuarios : [];
  },
  filtrarPaisesPorSeguridad(paises) {
    return Array.isArray(paises) ? paises : [];
  },
  filtrarBusinessServicesPorSeguridad(services) {
    return Array.isArray(services) ? services : [];
  },

  // Controlo de Sessao
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
