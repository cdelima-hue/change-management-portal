/**
 * app.js – Lógica Principal da Aplicação, Kanban, Módulos e Eventos (v7.0 Production)
 */

// Estado Global da Aplicação
window.changes = window.changes || [];
window.paises = window.paises || [
  { id: 1, nombre: 'Brasil', horas: 160, activo: true, color: '#009639' },
  { id: 2, nombre: 'México', horas: 120, activo: true, color: '#006847' },
  { id: 3, nombre: 'Argentina', horas: 80, activo: true, color: '#74ACDF' },
  { id: 4, nombre: 'Chile', horas: 60, activo: true, color: '#D52B1E' },
  { id: 5, nombre: 'Colombia', horas: 60, activo: true, color: '#FCD116' }
];

window.usuariosData = window.usuariosData || [];
window.businessServices = window.businessServices || [];

// 1. FUNÇÃO PARA ENCERRAR SESSÃO (CERRAR SESIÓN)
window.cerrarSesionApp = function() {
  localStorage.clear();
  sessionStorage.clear();
  window.location.reload();
};
window.logout = window.cerrarSesionApp;

// 2. FUNÇÃO PARA ELIMINAR PAÍS E ATUALIZAR A INTERFACE
window.eliminarPais = async function(id) {
  if (!confirm('¿Está seguro de eliminar este país?')) return;

  try {
    if (typeof apiclient !== 'undefined' && apiclient.deleteCountry) {
      await apiclient.deleteCountry(id);
    }
  } catch (err) {
    console.warn('Eliminado localmente:', err);
  }

  // Filtrar e remover da lista de países
  window.paises = window.paises.filter(p => p.id !== id && p.nombre !== id);
  
  // Re-renderizar a tabela de países e recalculadores de capacidade
  if (typeof renderizarPaises === 'function') {
    renderizarPaises();
  } else if (typeof cargarPaises === 'function') {
    cargarPaises();
  }
  
  if (typeof actualizarDashboard === 'function') {
    actualizarDashboard();
  }

  mostrarNotificacion('País eliminado correctamente', 'warning');
};

// 3. RENDERIZAR TABELA DE PAÍSES
window.renderizarPaises = function() {
  const container = document.getElementById('tablaPaisesBody') || document.querySelector('#paisesTable tbody');
  if (!container) return;

  container.innerHTML = window.paises.map(p => `
    <tr class="border-b border-slate-100 text-sm hover:bg-slate-50">
      <td class="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
        <span class="w-3 h-3 rounded-full" style="background-color: ${p.color || '#3b82f6'}"></span>
        ${p.nombre}
      </td>
      <td class="py-3 px-4">
        <input type="number" value="${p.horas}" onchange="actualizarHorasPais(${p.id}, this.value)" class="w-20 px-2 py-1 border border-slate-200 rounded text-center font-semibold">
      </td>
      <td class="py-3 px-4 text-slate-500">20h (global)</td>
      <td class="py-3 px-4">
        <input type="checkbox" ${p.activo ? 'checked' : ''} onchange="togglePaisActivo(${p.id}, this.checked)" class="toggle-checkbox">
      </td>
      <td class="py-3 px-4 text-right">
        <button onclick="eliminarPais(${p.id})" class="text-red-500 hover:text-red-700 p-1">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
};

// 4. SISTEMA DE NOTIFICAÇÕES TOAST
window.mostrarNotificacion = function(mensaje, tipo = 'info') {
  const id = 'toast-notification';
  let toast = document.getElementById(id);
  if (!toast) {
    toast = document.createElement('div');
    toast.id = id;
    toast.className = 'fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-xl text-white font-bold text-sm transition-all duration-300';
    document.body.appendChild(toast);
  }
  
  toast.style.backgroundColor = tipo === 'warning' ? '#f59e0b' : tipo === 'error' ? '#ef4444' : '#10b981';
  toast.innerText = mensaje;
  toast.style.display = 'block';

  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
};

// 5. TROCA DE ABAS E NAVEGAÇÃO
window.cambiarTab = function(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(tabId);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.remove('border-blue-600', 'text-blue-600', 'font-bold');
  });
  
  if (tabId === 'tabPaises') window.renderizarPaises();
};

// 6. CARREGAMENTO E INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
  if (typeof authService !== 'undefined') {
    authService.inicializar();
  }
  
  window.renderizarPaises();
  
  // Mapear clique no botão de Cerrar Sesión do menu dropdown
  const btnLogout = document.querySelector('[onclick*="cerrarSesion"]') || document.querySelector('#btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      window.cerrarSesionApp();
    });
  }
});
