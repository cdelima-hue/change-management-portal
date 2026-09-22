/**
 * branding.js — Módulo de Gestión de Marca, Logotipo y Personalización Corporativa (v7.0 Production)
 * Conectado con la API REST y Base de Datos PostgreSQL.
 */

const brandingService = (() => {
  const SETTING_KEY = 'custom_logo';
  let logoActualBase64 = null;

  async function inicializar() {
    try {
      const res = await apiClient.getSetting(SETTING_KEY);
      if (res.success && res.data) {
        logoActualBase64 = res.data;
      }
    } catch (err) {
      // Fallback a localStorage
      logoActualBase64 = localStorage.getItem('nestle_custom_logo_v5');
    }
    aplicarLogoEnDOM();
  }

  function obtenerLogoActual() {
    return logoActualBase64;
  }

  async function guardarLogo(base64Image) {
    logoActualBase64 = base64Image;
    try {
      await apiClient.saveSetting(SETTING_KEY, base64Image);
    } catch (_) {}
    localStorage.setItem('nestle_custom_logo_v5', base64Image);
    aplicarLogoEnDOM();
  }

  async function restablecerLogoDefault() {
    logoActualBase64 = null;
    try {
      await apiClient.saveSetting(SETTING_KEY, null);
    } catch (_) {}
    localStorage.removeItem('nestle_custom_logo_v5');
    aplicarLogoEnDOM();
  }

  function aplicarLogoEnDOM() {
    const containers = document.querySelectorAll('.app-branding-logo-container');
    containers.forEach(container => {
      if (logoActualBase64) {
        container.innerHTML = `<img src="${logoActualBase64}" alt="Logo Personalizado" class="h-8 max-w-[140px] object-contain cursor-pointer transition-transform hover:scale-105" />`;
      } else {
        container.innerHTML = `
          <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <i class="fa-solid fa-code-branch text-base"></i>
          </div>
        `;
      }
    });
  }

  function procesarArchivoLogo(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No se seleccionó ningún archivo'));
        return;
      }

      const tiposValidos = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
      if (!tiposValidos.includes(file.type)) {
        reject(new Error('Formato no soportado. Usa PNG, JPG, SVG o WebP.'));
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        reject(new Error('El archivo excede el tamaño máximo permitido de 2 MB.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsDataURL(file);
    });
  }

  return {
    inicializar,
    obtenerLogoActual,
    guardarLogo,
    restablecerLogoDefault,
    aplicarLogoEnDOM,
    procesarArchivoLogo
  };
})();
