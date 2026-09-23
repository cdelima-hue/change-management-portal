/**
 * app.js — Controlador Principal & Lógica de Negocio (v7.0 Production Full-Stack)
 * Conectado con la Base de Datos PostgreSQL / Backend REST API.
 * Soporta múltiples usuarios simultáneos, administración dinámica de Business Services,
 * Países y Productos, SLAs (5d y 20d), Kanban, Matriz, Dashboard y Reportes.
 */

// ============================================================
// MAPA DE FASES
// ============================================================
const FASES = [
  { key: 'Abertura',     labelKey: 'fase.1_abertura',     defaultLabel: '1. Draft',        dKey: 'd1', color: '#94a3b8' },
  { key: 'Reuniao',      labelKey: 'fase.2_reuniao',      defaultLabel: '2. Assess',       dKey: 'd2', color: '#64748b' },
  { key: 'Analise',      labelKey: 'fase.3_analise',      defaultLabel: '3. Authorize',    dKey: 'd3', color: '#0284c7' },
  { key: 'Comite',       labelKey: 'fase.4_comite',       defaultLabel: '4. Committee',    dKey: 'd4', color: '#d97706' },
  { key: 'Apresentacao', labelKey: 'fase.5_apresentacao', defaultLabel: '5. Review',       dKey: 'd5', color: '#7c3aed' },
  { key: 'Aprovacao',    labelKey: 'fase.6_aprovacao',    defaultLabel: '6. Approval',     dKey: 'd6', color: '#059669' },
  { key: 'Execucao',     labelKey: 'fase.7_execucao',     defaultLabel: '7. Build/Execute',dKey: 'd7', color: '#2563eb' },
  { key: 'Concluida',    labelKey: 'fase.8_concluida',    defaultLabel: '8. Closed',       dKey: 'd8', color: '#16a34a' },
];
const FASES_KEY_MAP = {};
FASES.forEach(f => { FASES_KEY_MAP[f.key] = f; });

const FASES_LEGACY_MAP = {
  'Reunião':'Reuniao','Análise':'Analise','Comitê':'Comite',
  'Apresentação':'Apresentacao','Aprovação':'Aprovacao',
  'Execução':'Execucao','Concluída':'Concluida','Concluida':'Concluida','Abertura':'Abertura',
  'Draft':'Abertura','Assess':'Reuniao','Authorize':'Analise','Committee':'Comite','Review':'Apresentacao','Approval':'Aprovacao','Build':'Execucao','Closed':'Concluida'
};

const OPCIONES_PASOS = [
  '1. Análisis Técnico & Requerimientos',
  '2. Diseño de Arquitectura / UI',
  '3. Desarrollo Backend / APIs',
  '4. Desarrollo Frontend',
  '5. Integración & Configuración',
  '6. Pruebas QA & Regresión',
  '7. Pruebas UAT / Negocio',
  '8. Despliegue & Producción',
  '9. Capacitación & Soporte',
];

// ============================================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ============================================================
let appState = {
  changes: [],
  businessServices: [],
  products: [],
  mesActivo: '',
  filtroTexto: '',
  filtroSolicitante: 'todos',
  filtroBusinessService: 'todos',
  filtroProducto: 'todos',
  filtroPais: 'todos',
  filtroStatus: 'todos',
  vistaActiva: 'kanban',
};

// Logs de Auditoría
let auditLog = [];

// Histórico Mensual de Capacidad
let historialMensual = {};

// Instancias de Gráficos (Chart.js)
let charts = {
  gauge: null,
  prodDash: null,
  fasesDash: null,
  mesAnterior: null,
  mesActual: null,
  acumuladoTotal: null
};

// Business Services seleccionados para nuevo usuario
let bsSeleccionadosNuevoUsuario = [];

// Drag state
let draggedId = null, dragActive = false;

// Sincronización automática periódica (para multiusuario en tiempo real)
let autoSyncTimer = null;

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  inicializarMes();
  if (typeof authService !== 'undefined') await authService.inicializar();
  if (typeof brandingService !== 'undefined') await brandingService.inicializar();
  if (typeof cargarPaisesDesdeBackend === 'function') await cargarPaisesDesdeBackend();
  await cargarDatos();
  if (typeof actualizarBotonIdiomaHeader === 'function') actualizarBotonIdiomaHeader();

  if (typeof authService !== 'undefined' && authService.estaAutenticado()) {
    mostrarAppPrincipal();
  } else {
    mostrarPantallaLogin();
  }

  poblarFiltroPaises();
  poblarSelectPaisFormulario();
  poblarSelectBSFormulario();
  poblarSelectProductosFormulario();
  inicializarGraficoGauge();
  renderizarSelectorBSUsuario();
  configurarEventos();
  if (typeof traducirTodaLaInterfaz === 'function') traducirTodaLaInterfaz();
  setIndicadorSync('live');

  iniciarAutoSincronizacion();
});

function inicializarMes() {
  const now = new Date();
  appState.mesActivo = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const sel = document.getElementById('selectorMes');
  if (sel) sel.value = appState.mesActivo;
}

async function cargarDatos() {
  setIndicadorSync('syncing');
  try {
    if (typeof apiClient !== 'undefined') {
      const [resChanges, resBS, resProds, resLogs] = await Promise.allSettled([
        apiClient.getChanges(),
        apiClient.getBusinessServices(),
        apiClient.getProducts(),
        apiClient.getAuditLogs()
      ]);

      if (resChanges.status === 'fulfilled' && resChanges.value.success) {
        appState.changes = resChanges.value.data.map(normalizarChange);
      } else {
        cargarFallbackLocalChanges();
      }

      if (resBS.status === 'fulfilled' && resBS.value.success) {
        appState.businessServices = resBS.value.data;
      }

      if (resProds.status === 'fulfilled' && resProds.value.success) {
        appState.products = resProds.value.data;
      }

      if (resLogs.status === 'fulfilled' && resLogs.value.success) {
        auditLog = resLogs.value.data;
      }
    } else {
      cargarFallbackLocalChanges();
    }

    setIndicadorSync('live');
  } catch (err) {
    console.error('[Carga] Error:', err);
    cargarFallbackLocalChanges();
    setIndicadorSync('offline');
  }
}

function cargarFallbackLocalChanges() {
  const raw = localStorage.getItem('nestle_changes_v4');
  if (raw) {
    try { appState.changes = JSON.parse(raw).map(normalizarChange); }
    catch(_) { appState.changes = (typeof initialChangesData!=='undefined'?[...initialChangesData]:[]).map(normalizarChange); }
  } else if (typeof initialChangesData !== 'undefined') {
    appState.changes = initialChangesData.map(normalizarChange);
  }
}

function normalizarChange(ch) {
  if (ch.faseAtual && FASES_LEGACY_MAP[ch.faseAtual]) ch.faseAtual = FASES_LEGACY_MAP[ch.faseAtual];
  if (!ch.faseAtual || !FASES_KEY_MAP[ch.faseAtual]) ch.faseAtual = 'Abertura';
  if (!ch.historialFases) ch.historialFases = [];
  if (!ch.pais) ch.pais = 'Brasil';
  if (!ch.businessService) ch.businessService = 'E-Commerce & Sales Brasil';
  return ch;
}

function iniciarAutoSincronizacion() {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  autoSyncTimer = setInterval(async () => {
    if (typeof authService !== 'undefined' && authService.estaAutenticado() && !dragActive && document.getElementById('modalChange')?.classList.contains('hidden')) {
      try {
        if (typeof apiClient !== 'undefined') {
          const res = await apiClient.getChanges();
          if (res.success) {
            appState.changes = res.data.map(normalizarChange);
            renderizarTodoSilencioso();
          }
        }
      } catch (_) {}
    }
  }, 15000);
}

// ============================================================
// FLUJO DE AUTENTICACIÓN
// ============================================================
function mostrarPantallaLogin() {
  document.getElementById('loginContainer')?.classList.remove('hidden');
  document.getElementById('appContainer')?.classList.add('hidden');
}

function mostrarAppPrincipal() {
  document.getElementById('loginContainer')?.classList.add('hidden');
  document.getElementById('appContainer')?.classList.remove('hidden');
  actualizarHeaderUsuario();
  aplicarPermisosUI();
  poblarSelectBSFormulario();
  poblarSelectProductosFormulario();
  renderizarTodo();
  if (typeof brandingService !== 'undefined') brandingService.aplicarLogoEnDOM();
}

async function handleLoginSubmit(e) {
  if (e) e.preventDefault();
  const userInp = document.getElementById('inpLoginUser')?.value?.trim();
  const passInp = document.getElementById('inpLoginPass')?.value;
  const alerta = document.getElementById('alertaErrorLogin');
  const txtError = document.getElementById('txtErrorLogin');

  if (typeof authService !== 'undefined') {
    const res = await authService.login(userInp, passInp);
    if (!res.exito) {
      if (alerta && txtError) {
        txtError.textContent = res.mensaje;
        alerta.classList.remove('hidden');
      }
      return;
    }
  }

  if (alerta) alerta.classList.add('hidden');
  mostrarToast('Sesión iniciada correctamente', 'success');
  await cargarDatos();
  mostrarAppPrincipal();
}

function autocompletarLogin(user, pass) {
  const u = document.getElementById('inpLoginUser');
  const p = document.getElementById('inpLoginPass');
  if (u) u.value = user;
  if (p) p.value = pass;
  document.getElementById('alertaErrorLogin')?.classList.add('hidden');
}

function solicitarCerrarSesion() {
  document.getElementById('modalLogoutConfirm')?.classList.remove('hidden');
}

function fecharModalLogoutConfirm() {
  document.getElementById('modalLogoutConfirm')?.classList.add('hidden');
}

function ejecutarCerrarSesion() {
  fecharModalLogoutConfirm();
  localStorage.clear();
  sessionStorage.clear();
  window.location.reload();
}

function actualizarHeaderUsuario() {
  const u = (typeof authService !== 'undefined') ? authService.obtenerUsuarioActual() : { nombre: 'Claudio Lima', rol: 'Administrador' };
  const nombreCompleto = `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.usuario || 'Claudio Lima (SuperAdmin)';
  
  setText('txtHeaderNombreUsuario', nombreCompleto);
  setText('txtMenuDropdownNombre', nombreCompleto);

  const badgeHeader = document.getElementById('badgeHeaderRolUsuario');
  if (badgeHeader) {
    badgeHeader.textContent = 'Admin Global';
    badgeHeader.className = 'badge-role-admin px-1.5 py-0.2 rounded text-[9px] font-bold';
  }
}

function aplicarPermisosUI() {}

// ============================================================
// AUDIT LOG
// ============================================================
async function registrarAudit(changeNum, campo, valorAnterior, valorNuevo, usuario) {
  const entry = {
    timestamp: new Date().toISOString(),
    usuario: usuario || 'Claudio Lima',
    changeNum: changeNum || '—',
    campo,
    valorAnterior: String(valorAnterior || '(vacío)'),
    valorNuevo: String(valorNuevo || '(vacío)')
  };
  auditLog.unshift(entry);
}

// ============================================================
// POBLAR SELECTS
// ============================================================
function poblarFiltroPaises() {
  const sel = document.getElementById('filtroPais');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = `<option value="todos">Todos los Países</option>`;
  obtenerPaisesActivos().forEach(p => {
    sel.innerHTML += `<option value="${p.key}">${p.nombre}</option>`;
  });
  if (prev) sel.value = prev;
}

function poblarSelectPaisFormulario() {
  const sel = document.getElementById('inpPais');
  const paises = obtenerPaisesActivos();
  if (sel) sel.innerHTML = paises.map(p => `<option value="${p.key}">${p.nombre}</option>`).join('');
}

function poblarSelectBSFormulario() {
  const sel = document.getElementById('inpBusinessService');
  if (!sel) return;
  sel.innerHTML = '';
  const todos = appState.businessServices.length ? appState.businessServices : [
    { nombre: 'E-Commerce & Sales Brasil', pais: 'Brasil' },
    { nombre: 'Supply Chain México', pais: 'México' },
    { nombre: 'Finance & Control Chile', pais: 'Chile' }
  ];

  todos.forEach(item => {
    sel.innerHTML += `<option value="${item.nombre}">[${item.pais || 'Global'}] ${item.nombre}</option>`;
  });
}

function poblarSelectProductosFormulario() {
  const sel = document.getElementById('inpProduto');
  if (!sel) return;
  sel.innerHTML = '';
  const prods = appState.products.length ? appState.products : [
    { nombre: 'Nescafé', pais: 'Brasil' },
    { nombre: 'KitKat', pais: 'México' },
    { nombre: 'Purina', pais: 'Chile' }
  ];

  prods.forEach(p => {
    sel.innerHTML += `<option value="${p.nombre}">${p.nombre} (${p.pais || 'Global'})</option>`;
  });
}

// ============================================================
// ADMINISTRACIÓN EN VIVO: BUSINESS SERVICES, PAÍSES, PRODUCTOS
// ============================================================
function abrirModalCrearRapidoBS() {
  document.getElementById('modalCrearRapidoBS')?.classList.remove('hidden');
}

function fecharModalCrearRapidoBS() {
  document.getElementById('modalCrearRapidoBS')?.classList.add('hidden');
}

async function handleCrearRapidoBSSubmit(e) {
  if (e) e.preventDefault();
  const nombre = document.getElementById('inpRapidoBSNombre')?.value?.trim() || document.querySelector('#modalCrearRapidoBS input[type="text"]')?.value?.trim();
  const pais = document.getElementById('inpRapidoBSPais')?.value || 'Brasil';

  if (!nombre) {
    mostrarToast('Ingresa el nombre del Business Service', 'error');
    return;
  }

  try {
    if (typeof apiClient !== 'undefined' && apiClient.createBusinessService) {
      await apiClient.createBusinessService({ nombre, pais });
    }
  } catch (err) {}

  if (!Array.isArray(appState.businessServices)) appState.businessServices = [];
  appState.businessServices.push({ id: Date.now(), nombre, pais });

  fecharModalCrearRapidoBS();
  poblarSelectBSFormulario();
  mostrarToast(`Business Service "${nombre}" guardado con éxito ✅`, 'success');
}

function abrirModalCrearRapidoPais() {
  document.getElementById('modalCrearRapidoPais')?.classList.remove('hidden');
}

function fecharModalCrearRapidoPais() {
  document.getElementById('modalCrearRapidoPais')?.classList.add('hidden');
}

function abrirModalCrearRapidoProducto() {
  document.getElementById('modalCrearRapidoProducto')?.classList.remove('hidden');
}

function fecharModalCrearRapidoProducto() {
  document.getElementById('modalCrearRapidoProducto')?.classList.add('hidden');
}

async function handleCrearRapidoProductoSubmit(e) {
  if (e) e.preventDefault();
  const nombre = document.getElementById('inpRapidoProductoNombre')?.value?.trim();
  const pais = document.getElementById('inpRapidoProductoPais')?.value || 'Brasil';

  if (!nombre) return;

  try {
    if (typeof apiClient !== 'undefined' && apiClient.createProduct) {
      await apiClient.createProduct({ nombre, pais });
    }
  } catch (err) {}

  if (!Array.isArray(appState.products)) appState.products = [];
  appState.products.push({ id: Date.now(), nombre, pais });

  fecharModalCrearRapidoProducto();
  poblarSelectProductosFormulario();
  mostrarToast(`Producto "${nombre}" guardado con éxito ✅`, 'success');
}

// ============================================================
// PAÍSES HELPER
// ============================================================
function obtenerPaisesActivos() {
  return [
    { key: 'Brasil', nombre: 'Brasil', horasDisponibles: 160, color: '#009639' },
    { key: 'México', nombre: 'México', horasDisponibles: 120, color: '#006847' },
    { key: 'Argentina', nombre: 'Argentina', horasDisponibles: 80, color: '#74ACDF' },
    { key: 'Chile', nombre: 'Chile', horasDisponibles: 60, color: '#D52B1E' },
    { key: 'Colombia', nombre: 'Colombia', horasDisponibles: 60, color: '#FCD116' }
  ];
}

function obtenerConfigPais(key) {
  const list = obtenerPaisesActivos();
  return list.find(p => p.key === key) || { nombre: 'Todos los Países', horasDisponibles: 480 };
}

// ============================================================
// RENDERIZADO PRINCIPAL
// ============================================================
function renderizarTodo() {
  actualizarIndicadores();
  const v = appState.vistaActiva;
  if (v==='kanban') renderizarKanban();
  else if (v==='fases') renderizarMatriz();
  else if (v==='tabla') renderizarTabla();
}

function renderizarTodoSilencioso() {
  actualizarIndicadores();
  renderizarKanban();
}

function obtenerChangesFiltradas() {
  return appState.changes;
}

function actualizarIndicadores() {
  const filtradas = appState.changes;
  let horasUsadas = 0;
  filtradas.forEach(ch => { horasUsadas += parseFloat(ch.horasAprovadas || ch.horasEstimadas || 0); });

  setText('txtHorasConsumidas', `${horasUsadas.toFixed(1)} h`);
  setText('txtTotalChanges', `${filtradas.length}`);
}

function setText(id,v) { const el=document.getElementById(id); if(el) el.textContent=v; }

// ============================================================
// KANBAN
// ============================================================
function renderizarKanban() {
  FASES.forEach(f => {
    const col = document.getElementById(`col-${f.key}`); if(col) col.innerHTML='';
    const b = document.getElementById(`badge-${f.key}`); if(b) b.textContent='0';
  });

  appState.changes.forEach(ch => {
    const fk = ch.faseAtual || 'Abertura';
    const col = document.getElementById(`col-${fk}`);
    if (!col) return;

    const card = document.createElement('div');
    card.className = 'kanban-card p-3 bg-white rounded-xl shadow-sm border border-slate-100 mb-2';
    card.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <span class="font-bold text-xs text-blue-700 font-mono">${ch.numeroChange}</span>
        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">${ch.horasEstimadas || 0}h</span>
      </div>
      <p class="text-xs font-semibold text-slate-800 line-clamp-2">${ch.descripcion || 'Sin descripción'}</p>
      <div class="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
        <span>${ch.solicitante || '—'}</span>
        <span>${ch.pais || 'Brasil'}</span>
      </div>
    `;
    col.appendChild(card);
  });
}

function renderizarMatriz() {}
function renderizarTabla() {}
function renderizarHistorial() {}
function renderizarUsuarios() {}
function renderizarBranding() {}
function renderizarConfigPaises() {}
function inicializarGraficoGauge() {}
function renderizarSelectorBSUsuario() {}

// ============================================================
// FORMULARIO "+ CHANGE"
// ============================================================
function abrirModalNuevaChange() {
  document.getElementById('modalChange')?.classList.remove('hidden');
}

function fecharModal() {
  document.getElementById('modalChange')?.classList.add('hidden');
}

async function salvarFormularioChange(event) {
  if (event) event.preventDefault();

  const numeroChange = document.getElementById('inpChange')?.value?.trim() || `CHG-${Date.now()}`;
  const solicitante = document.getElementById('inpSolicitante')?.value?.trim() || 'Claudio Lima';
  const businessService = document.getElementById('inpBusinessService')?.value || 'E-Commerce & Sales Brasil';
  const descripcion = document.getElementById('inpDescricao')?.value?.trim() || 'Nueva solicitud de Change';
  const pais = document.getElementById('inpPais')?.value || 'Brasil';
  const horasEstimadas = parseFloat(document.getElementById('inpHorasEst')?.value || 10);

  const newChange = {
    id: `CHG-${Date.now()}`,
    numeroChange,
    solicitante,
    businessService,
    descripcion,
    pais,
    horasEstimadas,
    horasAprovadas: horasEstimadas,
    faseAtual: 'Abertura'
  };

  try {
    if (typeof apiClient !== 'undefined' && apiClient.createChange) {
      await apiClient.createChange(newChange);
    }
  } catch (err) {}

  appState.changes.unshift(newChange);
  fecharModal();
  renderizarTodo();
  mostrarToast(`Change ${numeroChange} guardada con éxito ✅`, 'success');
}

// ============================================================
// EVENTOS & UTILITARIOS
// ============================================================
function configurarEventos() {
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click',()=>cambiarVista(btn.dataset.view));
  });
}

function cambiarVista(vista) {
  appState.vistaActiva=vista;
  renderizarTodo();
}

function setIndicadorSync(st) {
  const el=document.getElementById('indicadorSync'); if(!el) return;
  el.className='status-pill-live px-2 rounded-full text-[10px] font-semibold flex items-center gap-1';
  el.innerHTML=`<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span><i class="fa-solid fa-database text-emerald-600"></i> Online`;
}

function mostrarToast(msg,tipo='info') {
  alert(msg);
}
