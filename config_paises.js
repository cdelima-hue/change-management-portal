/**
 * config_paises.js — Módulo de Gestión de Países, Mercados y Capacidad (v7.0 Production)
 * Conectado con la API REST y Base de Datos PostgreSQL / Backend.
 */

const REGLA_MAX_HORAS_CHANGE = 20;

let paisesCatalogo = [
  { key: 'Brasil',    nombre: 'Brasil',    horasDisponibles: 160, color: '#059669', activo: true },
  { key: 'Mexico',    nombre: 'México',    horasDisponibles: 120, color: '#2563eb', activo: true },
  { key: 'Argentina', nombre: 'Argentina', horasDisponibles: 80,  color: '#7c3aed', activo: true },
  { key: 'Chile',     nombre: 'Chile',     horasDisponibles: 60,  color: '#d97706', activo: true },
  { key: 'Colombia',  nombre: 'Colombia',  horasDisponibles: 60,  color: '#dc2626', activo: true },
];

async function cargarPaisesDesdeBackend() {
  try {
    const res = await apiClient.getCountries();
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      paisesCatalogo = res.data;
    }
  } catch (err) {
    console.warn('[Paises] Usando catálogo predeterminado local:', err);
  }
  return paisesCatalogo;
}

function obtenerTodosPaises() {
  return paisesCatalogo;
}

function obtenerPaisesActivos() {
  return paisesCatalogo.filter(p => p.activo !== false);
}

function obtenerConfigPais(paisKey) {
  if (!paisKey || paisKey === 'todos') {
    const activos = obtenerPaisesActivos();
    const totalHoras = activos.reduce((sum, p) => sum + (p.horasDisponibles || 0), 0);
    return {
      key: 'todos',
      nombre: 'Todos los Países',
      horasDisponibles: totalHoras,
      color: '#64748b',
      activo: true,
    };
  }
  const cleanKey = paisKey.toLowerCase().trim();
  const encontrado = paisesCatalogo.find(p => p.key.toLowerCase().trim() === cleanKey || p.nombre.toLowerCase().trim() === cleanKey);
  return encontrado || {
    key: paisKey,
    nombre: paisKey,
    horasDisponibles: 160,
    color: '#64748b',
    activo: true,
  };
}

async function agregarPais(nombre, horasDisponibles = 100, color = '#2563eb') {
  const key = nombre.trim();
  try {
    const res = await apiClient.createCountry({ key, nombre: key, horasDisponibles, color });
    if (res.success) {
      await cargarPaisesDesdeBackend();
      return true;
    }
  } catch (err) {
    console.error('[Paises] Error agregando país:', err);
  }
  return false;
}

async function actualizarPais(key, horasDisponibles, color, activo) {
  try {
    const res = await apiClient.updateCountry(key, { horasDisponibles, color, activo });
    if (res.success) {
      await cargarPaisesDesdeBackend();
      return true;
    }
  } catch (err) {
    console.error('[Paises] Error actualizando país:', err);
  }
  return false;
}

async function eliminarPais(key) {
  try {
    const res = await apiClient.deleteCountry(key);
    if (res.success) {
      await cargarPaisesDesdeBackend();
      return { success: true };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
  return { success: false, error: 'Error al eliminar país' };
}

function clasificarChange(horasEstimadas) {
  const h = parseFloat(horasEstimadas) || 0;
  return h > REGLA_MAX_HORAS_CHANGE ? 'Proyecto' : 'Mejora';
}
