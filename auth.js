// Servico de Autenticacao Nativo e Permissao Admin Global
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
    
    // Ocultar login e mostrar a aplicacao principal
    const loginDiv = document.getElementById('loginContainer');
    const appDiv = document.getElementById('appContainer');
    
    if (loginDiv) loginDiv.style.display = 'none';
    if (appDiv) {
      appDiv.classList.remove('hidden');
      appDiv.style.display = 'block';
    }

    // Dispara o evento de carregamento da DOM para o app.js renderizar a interface
    document.dispatchEvent(new Event('DOMContentLoaded'));
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

// Garante a visibilidade e sessao ao carregar a pagina
document.addEventListener('DOMContentLoaded', () => {
  authService.inicializar();
  const loginDiv = document.getElementById('loginContainer');
  const appDiv = document.getElementById('appContainer');
  if (localStorage.getItem('isLoggedIn') === 'true') {
    if (loginDiv) loginDiv.style.display = 'none';
    if (appDiv) {
      appDiv.classList.remove('hidden');
      appDiv.style.display = 'block';
    }
  }
});
