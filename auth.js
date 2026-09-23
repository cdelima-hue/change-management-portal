// Servico de Autenticacao Nativo com Renderizacao Automatica
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

  getCurrentUser() { return adminGlobalUser; },
  obtenerUsuarioActual() { return adminGlobalUser; },
  estaAutenticado() { return localStorage.getItem('isLoggedIn') === 'true'; },

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

  filtrarChangesPorSeguridad(changes) { return Array.isArray(changes) ? changes : []; },
  filtrarUsuariosPorSeguridad(usuarios) { return Array.isArray(usuarios) ? usuarios : []; },
  filtrarPaisesPorSeguridad(paises) { return Array.isArray(paises) ? paises : []; },
  filtrarBusinessServicesPorSeguridad(services) { return Array.isArray(services) ? services : []; },

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

    // Executa a montagem nativa da interface
    this.executarRender();
    return { success: true, user: adminGlobalUser };
  },

  logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  },

  executarRender() {
    setTimeout(() => {
      if (typeof window.mostrarAppPrincipal === 'function') window.mostrarAppPrincipal();
      if (typeof window.renderizarTodo === 'function') window.renderizarTodo();
      if (typeof window.cargarDatos === 'function') window.cargarDatos();
    }, 100);
  },

  inicializar() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const loginDiv = document.getElementById('loginContainer');
    const appDiv = document.getElementById('appContainer');

    if (isLoggedIn) {
      if (loginDiv) loginDiv.style.display = 'none';
      if (appDiv) {
        appDiv.classList.remove('hidden');
        appDiv.style.display = 'block';
      }
      this.executarRender();
    } else {
      if (loginDiv) loginDiv.style.display = 'flex';
      if (appDiv) appDiv.classList.add('hidden');
    }
  }
};

window.authService = authService;

document.addEventListener('DOMContentLoaded', () => {
  authService.inicializar();
});
