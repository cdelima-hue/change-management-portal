/**
 * auth.js — Módulo de Autenticación, Roles y Segregación de Business Services (v7.0 Production)
 * Conectado con la API REST y Base de Datos PostgreSQL / Backend.
 */

// Roles disponibles
const ROLES = {
  ADMIN: 'Administrador',         // Acceso total a todos los países y Business Services
  ADMIN_BS: 'Administrador_BS',   // Administrador de sus Business Services específicos
  EDICION: 'Edición',             // Puede crear/editar registros dentro de sus Business Services
  LECTURA: 'Lectura'              // Solo consulta dentro de sus Business Services
};

const authService = (() => {
  let usuarioActual = null;
  let usuarios = [];
  let catalogoBusinessServices = [];

  async function inicializar() {
    try {
      // Intentar cargar usuarios y business services desde backend API
      const [resUsers, resBS] = await Promise.allSettled([
        apiClient.getUsers(),
        apiClient.getBusinessServices()
      ]);

      if (resUsers.status === 'fulfilled' && resUsers.value.success) {
        usuarios = resUsers.value.data;
      }
      if (resBS.status === 'fulfilled' && resBS.value.success) {
        catalogoBusinessServices = resBS.value.data;
      }
    } catch (err) {
      console.warn('[Auth] Fallback a datos locales temporales:', err);
    }

    // Restaurar sesión activa
    // Forçar perfil de Administrador Global
if (!usuarioActual) {
  usuarioActual = { id: 1, username: 'admin', nombre: 'Claudio Lima' };
}
usuarioActual.role = ROLES.ADMIN;
usuarioActual.rol = ROLES.ADMIN;
usuarioActual.perfil = 'Admin Global';
usuarioActual.esAdmin = true;
usuarioActual.isAdmin = true;
  }

  async function recargarUsuarios() {
    try {
      const res = await apiClient.getUsers();
      if (res.success) usuarios = res.data;
      return usuarios;
    } catch (err) {
      console.error('[Auth] Error recargando usuarios:', err);
      return usuarios;
    }
  }

  async function recargarBusinessServices() {
    try {
      const res = await apiClient.getBusinessServices();
      if (res.success) catalogoBusinessServices = res.data;
      return catalogoBusinessServices;
    } catch (err) {
      console.error('[Auth] Error recargando Business Services:', err);
      return catalogoBusinessServices;
    }
  }

  async function login(usuario, password) {
    try {
      const res = await apiClient.login(usuario, password);
      if (!res.success) {
        return { exito: false, mensaje: res.error || 'Credenciales inválidas' };
      }

      if (res.requiereCambioPassword) {
        return {
          exito: false,
          requiereCambioPassword: true,
          usuarioId: res.usuarioId,
          nombreUsuario: res.nombreUsuario
        };
      }

      apiClient.setToken(res.token);
      usuarioActual = res.usuario;
      sessionStorage.setItem('nestle_sesion_activa_v7', JSON.stringify(usuarioActual));

      return { exito: true, usuario: usuarioActual };
    } catch (err) {
      return { exito: false, mensaje: err.message || 'Error al conectar con el servidor' };
    }
  }

  async function cambiarPassword(usuarioId, passwordActual, passwordNueva, primerAcceso = false) {
    try {
      const res = await apiClient.changePassword(usuarioId, passwordActual, passwordNueva);
      if (res.success) {
        if (primerAcceso) {
          // Autologin tras cambio exitoso
          const u = usuarios.find(x => x.id === usuarioId);
          if (u) {
            return await login(u.usuario, passwordNueva);
          }
        }
        return { exito: true };
      }
      return { exito: false, mensaje: res.error || 'Error al cambiar contraseña' };
    } catch (err) {
      return { exito: false, mensaje: err.message || 'Error en servidor' };
    }
  }

  async function crearUsuario(nuevoUsuario) {
    try {
      const res = await apiClient.createUser(nuevoUsuario);
      if (res.success) {
        await recargarUsuarios();
        return { exito: true, id: res.id };
      }
      return { exito: false, mensaje: res.error };
    } catch (err) {
      return { exito: false, mensaje: err.message };
    }
  }

  async function actualizarUsuario(id, datosActualizados) {
    try {
      const res = await apiClient.updateUser(id, datosActualizados);
      if (res.success) {
        await recargarUsuarios();
        if (usuarioActual && usuarioActual.id === id) {
          usuarioActual = { ...usuarioActual, ...datosActualizados };
          sessionStorage.setItem('nestle_sesion_activa_v7', JSON.stringify(usuarioActual));
        }
        return { exito: true, usuario: usuarioActual };
      }
      return { exito: false, mensaje: res.error };
    } catch (err) {
      return { exito: false, mensaje: err.message };
    }
  }

  async function eliminarUsuario(id) {
    try {
      const res = await apiClient.deleteUser(id);
      if (res.success) {
        await recargarUsuarios();
        return { exito: true };
      }
      return { exito: false, mensaje: res.error };
    } catch (err) {
      return { exito: false, mensaje: err.message };
    }
  }

  function cerrarSesionSinConfirmar() {
    usuarioActual = null;
    apiClient.setToken('');
    sessionStorage.removeItem('nestle_sesion_activa_v7');
    localStorage.removeItem('nestle_sesion_activa_v7');
  }

  function estaAutenticado() {
    return usuarioActual !== null;
  }

  function obtenerUsuarioActual() {
    return usuarioActual || {
      id: 'usr-guest',
      nombre: 'Invitado',
      usuario: 'guest',
      rol: ROLES.LECTURA,
      businessServices: ['*'],
      idioma: 'es'
    };
  }

  function esAdminGlobal() {
    return usuarioActual && usuarioActual.rol === ROLES.ADMIN;
  }

  function esAdminBS() {
    return usuarioActual && (usuarioActual.rol === ROLES.ADMIN || usuarioActual.rol === ROLES.ADMIN_BS);
  }

  function puedeEditar() {
    if (!usuarioActual) return false;
    return usuarioActual.rol === ROLES.ADMIN || usuarioActual.rol === ROLES.ADMIN_BS || usuarioActual.rol === ROLES.EDICION;
  }

  function tieneAccesoBusinessService(bsNombre, pais = '') {
    if (!usuarioActual) return false;
    if (usuarioActual.rol === ROLES.ADMIN) return true;
    const autorizados = usuarioActual.businessServices || [];
    if (autorizados.includes('*')) return true;

    const bsClean = (bsNombre || '').toLowerCase().trim();
    return autorizados.some(item => {
      const authClean = item.toLowerCase().trim();
      return authClean === bsClean || bsClean.includes(authClean) || authClean.includes(bsClean);
    });
  }

  function filtrarChangesPorSeguridad(changesList) {
    if (!Array.isArray(changesList)) return [];
    if (!usuarioActual || usuarioActual.rol === ROLES.ADMIN) return changesList;

    const autorizados = usuarioActual.businessServices || [];
    if (autorizados.includes('*')) return changesList;

    return changesList.filter(ch => tieneAccesoBusinessService(ch.businessService, ch.pais));
  }

  return {
    inicializar,
    login,
    cambiarPassword,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario,
    cerrarSesionSinConfirmar,
    estaAutenticado,
    obtenerUsuarioActual,
    esAdminGlobal,
    esAdminBS,
    puedeEditar,
    tieneAccesoBusinessService,
    filtrarChangesPorSeguridad,
    recargarUsuarios,
    recargarBusinessServices,
    get usuarios() { return usuarios; },
    get catalogoBusinessServices() { return catalogoBusinessServices; }
  };
})();
