/**
 * api.js — Cliente HTTP / REST API para comunicación Frontend <-> Backend
 * Sustituye el almacenamiento exclusivo de LocalStorage por persistencia real en base de datos.
 */

const apiClient = (() => {
  const BASE_URL = '';
  const TOKEN_KEY = 'nestle_jwt_token_v7';

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
  }

  function setToken(token) {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  async function request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error || data.message || `Error HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${options.method || 'GET'} ${endpoint}:`, err);
      throw err;
    }
  }

  return {
    setToken,
    getToken,

    // Health
    checkHealth: () => request('/api/health'),

    // Auth
    login: (usuario, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ usuario, password }) }),
    changePassword: (usuarioId, passwordActual, passwordNueva) => request('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ usuarioId, passwordActual, passwordNueva }) }),

    // Users
    getUsers: () => request('/api/users'),
    createUser: (user) => request('/api/users', { method: 'POST', body: JSON.stringify(user) }),
    updateUser: (id, user) => request(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(user) }),
    deleteUser: (id) => request(`/api/users/${id}`, { method: 'DELETE' }),

    // Countries
    getCountries: () => request('/api/countries'),
    createCountry: (country) => request('/api/countries', { method: 'POST', body: JSON.stringify(country) }),
    updateCountry: (key, country) => request(`/api/countries/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(country) }),
    deleteCountry: (key) => request(`/api/countries/${encodeURIComponent(key)}`, { method: 'DELETE' }),

    // Business Services
    getBusinessServices: () => request('/api/business-services'),
    createBusinessService: (bs) => request('/api/business-services', { method: 'POST', body: JSON.stringify(bs) }),
    updateBusinessService: (id, bs) => request(`/api/business-services/${id}`, { method: 'PUT', body: JSON.stringify(bs) }),
    deleteBusinessService: (id) => request(`/api/business-services/${id}`, { method: 'DELETE' }),

    // Products
    getProducts: () => request('/api/products'),
    createProduct: (product) => request('/api/products', { method: 'POST', body: JSON.stringify(product) }),
    updateProduct: (id, product) => request(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(product) }),
    deleteProduct: (id) => request(`/api/products/${id}`, { method: 'DELETE' }),

    // Changes
    getChanges: () => request('/api/changes'),
    createChange: (change) => request('/api/changes', { method: 'POST', body: JSON.stringify(change) }),
    updateChange: (id, change) => request(`/api/changes/${id}`, { method: 'PUT', body: JSON.stringify(change) }),
    deleteChange: (id) => request(`/api/changes/${id}`, { method: 'DELETE' }),

    // Audit Logs
    getAuditLogs: () => request('/api/audit-logs'),
    createAuditLog: (log) => request('/api/audit-logs', { method: 'POST', body: JSON.stringify(log) }),

    // Settings & Branding
    getSetting: (key) => request(`/api/settings/${encodeURIComponent(key)}`),
    saveSetting: (key, value) => request(`/api/settings/${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify({ value }) })
  };
})();
