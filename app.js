// ==========================================
// ESTADO GLOBAL & INICIALIZAÇÃO
// ==========================================
window.appState = {
  vistaActiva: 'kanban'
};

// Carga Inicial de LocalStorage
window.PAISES_CONFIG = JSON.parse(localStorage.getItem('nestle_paises_v4')) || [
  { id: '1', nombre: 'Perú', horas: 100, maxChange: 30, color: '#0891b2', activo: true },
  { id: '2', nombre: 'Ecuador', horas: 120, maxChange: 30, color: '#059669', activo: true }
];

window.BUSINESS_SERVICES = JSON.parse(localStorage.getItem('nestle_bs_v4')) || ["Finance", "Supply Chain", "HR", "IT", "Sales & Marketing"];

window.PRODUCTOS_LISTA = JSON.parse(localStorage.getItem('nestle_productos_v4')) || ["Accounts Payable", "Logistics", "Payroll", "Software Support"];

// ==========================================
// TROCA DE VISTAS (NAVEGAÇÃO)
// ==========================================
function cambiarVista(vista) {
  appState.vistaActiva = vista;

  // Esconde todas as seções
  document.querySelectorAll('.secao-view').forEach(el => el.classList.add('hidden'));

  // Exibe a seção ativa
  const elAtivo = document.getElementById(`view-${vista}`);
  if (elAtivo) {
    elAtivo.classList.remove('hidden');
  }

  // Destaque visual das abas do menu
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const act = btn.dataset.view === vista;
    btn.className = `tab-btn py-2 px-3 font-${act ? 'bold text-blue-600 border-b-2 border-blue-600' : 'semibold text-slate-500 hover:text-slate-800 border-b-2 border-transparent'} text-xs flex items-center gap-1.5`;
  });

  // Renderiza dados conforme a aba aberta
  if (vista === 'config') renderizarPaises();
  if (vista === 'bs') renderizarBS();
  if (vista === 'productos') renderizarProductos();
}

// ==========================================
// MÓDULO PAÍSES (CRUD COMPLETO)
// ==========================================
function renderizarPaises() {
  const tbody = document.getElementById('tbodyConfigPaises');
  if (!tbody) return;

  tbody.innerHTML = PAISES_CONFIG.map(p => `
    <tr>
      <td class="p-2.5 font-bold text-slate-700">${p.nombre}</td>
      <td class="p-2.5 text-center">
        <input type="number" value="${p.horas}" onchange="modificarHorasPais('${p.id}', this.value)" class="w-20 text-center p-1 border border-slate-300 rounded font-bold text-xs">
      </td>
      <td class="p-2.5 text-center font-semibold text-slate-500">${p.maxChange}h</td>
      <td class="p-2.5 text-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${p.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}">
          ${p.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td class="p-2.5 text-center">
        <button onclick="eliminarPais('${p.id}')" class="p-1 text-slate-400 hover:text-rose-600 transition-all" title="Eliminar País">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function agregarNuevoPais() {
  const inpNombre = document.getElementById('inpNuevoPaisNombre');
  const inpHoras = document.getElementById('inpNuevoPaisHoras');
  const inpColor = document.getElementById('inpNuevoPaisColor');

  const nombre = inpNombre ? inpNombre.value.trim() : '';
  const horas = inpHoras ? parseInt(inpHoras.value) : 100;
  const color = inpColor ? inpColor.value : '#0891b2';

  if (!nombre) return alert('Por favor, digite o nome do país.');

  const novoPais = {
    id: Date.now().toString(),
    nombre: nombre,
    horas: horas || 100,
    maxChange: 30,
    color: color,
    activo: true
  };

  PAISES_CONFIG.push(novoPais);
  localStorage.setItem('nestle_paises_v4', JSON.stringify(PAISES_CONFIG));

  inpNombre.value = '';
  renderizarPaises();
  alert(`País "${nombre}" adicionado com sucesso!`);
}

function modificarHorasPais(id, novasHoras) {
  const pais = PAISES_CONFIG.find(p => p.id === id);
  if (pais) {
    pais.horas = parseInt(novasHoras) || 0;
    localStorage.setItem('nestle_paises_v4', JSON.stringify(PAISES_CONFIG));
    renderizarPaises();
  }
}

function eliminarPais(id) {
  if (!confirm('Deseja realmente remover este país?')) return;
  PAISES_CONFIG = PAISES_CONFIG.filter(p => p.id !== id);
  localStorage.setItem('nestle_paises_v4', JSON.stringify(PAISES_CONFIG));
  renderizarPaises();
}

// ==========================================
// MÓDULO BUSINESS SERVICES (CRUD COMPLETO)
// ==========================================
function renderizarBS() {
  const cont = document.getElementById('contenedorTabBS');
  if (!cont) return;

  if (BUSINESS_SERVICES.length === 0) {
    cont.innerHTML = '<p class="text-xs text-slate-400 col-span-3">Nenhum Business Service cadastrado.</p>';
    return;
  }

  cont.innerHTML = BUSINESS_SERVICES.map(bs => `
    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center shadow-sm">
      <span class="text-xs font-bold text-slate-700">${bs}</span>
      <div class="flex gap-1">
        <button onclick="editarBS('${bs}')" class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs" title="Editar"><i class="fa-solid fa-pen"></i></button>
        <button onclick="eliminarBS('${bs}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs" title="Excluir"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function agregarBSDesdeTab() {
  const inp = document.getElementById('inpTabNuevoBS');
  const nome = inp ? inp.value.trim() : '';
  if (!nome) return alert('Digite o nome do Business Service.');

  if (!BUSINESS_SERVICES.includes(nome)) {
    BUSINESS_SERVICES.push(nome);
    localStorage.setItem('nestle_bs_v4', JSON.stringify(BUSINESS_SERVICES));
    inp.value = '';
    renderizarBS();
  } else {
    alert('Este Business Service já existe.');
  }
}

function editarBS(nomeAntigo) {
  const novoNome = prompt('Editar Business Service:', nomeAntigo);
  if (!novoNome || novoNome.trim() === '' || novoNome.trim() === nomeAntigo) return;

  const idx = BUSINESS_SERVICES.indexOf(nomeAntigo);
  if (idx !== -1) {
    BUSINESS_SERVICES[idx] = novoNome.trim();
    localStorage.setItem('nestle_bs_v4', JSON.stringify(BUSINESS_SERVICES));
    renderizarBS();
  }
}

function eliminarBS(nome) {
  if (!confirm(`Deseja excluir "${nome}"?`)) return;
  BUSINESS_SERVICES = BUSINESS_SERVICES.filter(b => b !== nome);
  localStorage.setItem('nestle_bs_v4', JSON.stringify(BUSINESS_SERVICES));
  renderizarBS();
}

// ==========================================
// MÓDULO PRODUCTOS (INDEPENDENTE - CRUD)
// ==========================================
function renderizarProductos() {
  const cont = document.getElementById('contenedorTabProductos');
  if (!cont) return;

  if (PRODUCTOS_LISTA.length === 0) {
    cont.innerHTML = '<p class="text-xs text-slate-400 col-span-3">Nenhum produto cadastrado.</p>';
    return;
  }

  cont.innerHTML = PRODUCTOS_LISTA.map(prod => `
    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center shadow-sm">
      <span class="text-xs font-bold text-slate-700">${prod}</span>
      <button onclick="eliminarProducto('${prod}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs" title="Excluir"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join('');
}

function agregarProductoDesdeTab() {
  const inp = document.getElementById('inpTabNuevoProducto');
  const nome = inp ? inp.value.trim() : '';
  if (!nome) return alert('Digite o nome do Produto.');

  if (!PRODUCTOS_LISTA.includes(nome)) {
    PRODUCTOS_LISTA.push(nome);
    localStorage.setItem('nestle_productos_v4', JSON.stringify(PRODUCTOS_LISTA));
    inp.value = '';
    renderizarProductos();
  } else {
    alert('Este produto já existe.');
  }
}

function eliminarProducto(nome) {
  if (!confirm(`Deseja excluir o produto "${nome}"?`)) return;
  PRODUCTOS_LISTA = PRODUCTOS_LISTA.filter(p => p !== nome);
  localStorage.setItem('nestle_productos_v4', JSON.stringify(PRODUCTOS_LISTA));
  renderizarProductos();
}

// INICIALIZAÇÃO AUTOMÁTICA AO CARREGAR A PÁGINA
window.addEventListener('DOMContentLoaded', () => {
  cambiarVista('kanban');
});
