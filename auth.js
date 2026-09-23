const authService = {
  getCurrentUser() {
    return {
      id: 1,
      username: 'admin',
      nombre: 'Claudio Lima',
      usuario: 'Claudio Lima',
      role: 'Admin Global',
      rol: 'Admin Global',
      perfil: 'Admin Global',
      esAdmin: true,
      isAdmin: true,
      activo: true,
      pais: null,
      business_services: []
    };
  },

  async login(username, password) {
    const user = this.getCurrentUser();
    localStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    return { success: true, user };
  },

  logout() {
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
    window.location.reload();
  },

  inicializar() {
    const user = this.getCurrentUser();
    localStorage.setItem('currentUser', JSON.stringify(user));
  }
};

window.authService = authService;
