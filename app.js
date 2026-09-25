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
  e.preventDefault();
  const userInp = document.getElementById('inpLoginUser')?.value?.trim();
  const passInp = document.getElementById('inpLoginPass')?.value;
  const alerta = document.getElementById('alertaErrorLogin');
  const txtError = document.getElementById('txtErrorLogin');

  if (!userInp || !passInp) return;

  const res = await authService.login(userInp, passInp);

  if (!res.exito) {
    if (alerta && txtError) {
      txtError.textContent = res.mensaje;
      alerta.classList.remove('hidden');
    }
    registrarAudit('SEGURIDAD', 'LOGIN_FALLIDO', userInp, '(bloqueado)');
    return;
  }

  if (alerta) alerta.classList.add('hidden');

  if (res.requiereCambioPassword) {
    document.getElementById('inpPrimerAccesoUserId').value = res.usuarioId;
    document.getElementById('inpPrimerAccesoActual').value = passInp;
    document.getElementById('modalPrimerAcceso')?.classList.remove('hidden');
    return;
  }

  registrarAudit('SEGURIDAD', 'LOGIN_EXITOSO', res.usuario.usuario, `Rol: ${res.usuario.rol}`);
  mostrarToast(t('toast.sesion_iniciada'), 'success');
  await cargarDatos();
  mostrarAppPrincipal();
}

async function handleCambioPasswordPrimerAcceso(e) {
  e.preventDefault();
  const userId = document.getElementById('inpPrimerAccesoUserId')?.value;
  const actual = document.getElementById('inpPrimerAccesoActual')?.value;
  const nueva = document.getElementById('inpPrimerAccesoNueva')?.value;
  const conf = document.getElementById('inpPrimerAccesoConf')?.value;
  const alerta = document.getElementById('alertaErrorPrimerAcceso');

  if (nueva !== conf) {
    if (alerta) { alerta.textContent = 'Las contraseñas no coinciden.'; alerta.classList.remove('hidden'); }
    return;
  }

  const res = await authService.cambiarPassword(userId, actual, nueva, true);
  if (!res.exito) {
    if (alerta) { alerta.textContent = res.mensaje; alerta.classList.remove('hidden'); }
    return;
  }

  document.getElementById('modalPrimerAcceso')?.classList.add('hidden');
  mostrarToast('Contraseña actualizada correctamente ✅', 'success');
  mostrarAppPrincipal();
}

function autocompletarLogin(user, pass) {
  const u = document.getElementById('inpLoginUser');
  const p = document.getElementById('inpLoginPass');
  if (u) u.value = user;
  if (p) p.value = pass;
  document.getElementById('alertaErrorLogin')?.classList.add('hidden');
}

function togglePasswordVisibility(inputId, iconId) {
  const inp = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
  } else {
    inp.type = 'password';
    if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
  }
}

function abrirModalOlvidoPassword() {
  document.getElementById('modalOlvidoPassword')?.classList.remove('hidden');
}
function fecharModalOlvidoPassword() {
  document.getElementById('modalOlvidoPassword')?.classList.add('hidden');
}

function solicitarCerrarSesion() {
  document.getElementById('modalLogoutConfirm')?.classList.remove('hidden');
}
function fecharModalLogoutConfirm() {
  document.getElementById('modalLogoutConfirm')?.classList.add('hidden');
}
function ejecutarCerrarSesion() {
  fecharModalLogoutConfirm();
  const u = authService.obtenerUsuarioActual().usuario || 'Usuario';
  registrarAudit('SEGURIDAD', 'LOGOUT', u, '(sesión terminada)');
  authService.cerrarSesionSinConfirmar();
  mostrarToast(t('toast.sesion_cerrada'), 'info');
  mostrarPantallaLogin();
}

function toggleDropdown(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('hidden');
}
window.addEventListener('click', e => {
  if (!e.target.closest('#dropdownUsuarioMenu') && !e.target.closest('button[onclick*="dropdownUsuarioMenu"]')) {
    document.getElementById('dropdownUsuarioMenu')?.classList.add('hidden');
  }
  if (!e.target.closest('#dropdownIdioma') && !e.target.closest('#btnSelectorIdioma')) {
    document.getElementById('dropdownIdioma')?.classList.add('hidden');
  }
});

function actualizarHeaderUsuario() {
  const u = authService.obtenerUsuarioActual();
  const nombreCompleto = `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.usuario || 'Usuario';
  const iniciales = (u.nombre ? u.nombre[0] : 'U') + (u.apellido ? u.apellido[0] : '');

  setText('txtHeaderNombreUsuario', nombreCompleto);
  setText('txtMenuDropdownNombre', nombreCompleto);
  setText('txtMenuDropdownEmail', u.email || '—');
  setText('avatarHeaderUsuario', iniciales.toUpperCase());
  setText('avatarModalPerfil', iniciales.toUpperCase());

  const badgeHeader = document.getElementById('badgeHeaderRolUsuario');
  if (badgeHeader) {
    if (u.rol === 'Administrador') {
      badgeHeader.textContent = 'Admin Global';
      badgeHeader.className = 'badge-role-admin px-1.5 py-0.2 rounded text-[9px] font-bold';
    } else if (u.rol === 'Administrador_BS') {
      badgeHeader.textContent = 'Admin BS';
      badgeHeader.className = 'badge-role-admin-bs px-1.5 py-0.2 rounded text-[9px] font-bold';
    } else if (u.rol === 'Edición') {
      badgeHeader.textContent = 'Edición';
      badgeHeader.className = 'badge-role-edit px-1.5 py-0.2 rounded text-[9px] font-bold';
    } else {
      badgeHeader.textContent = 'Lectura';
      badgeHeader.className = 'badge-role-read px-1.5 py-0.2 rounded text-[9px] font-bold';
    }
  }

  const bsHeader = document.getElementById('badgeUserBSHeader');
  if (bsHeader) {
    const list = u.businessServices || [];
    if (list.includes('*')) {
      bsHeader.innerHTML = `<span class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[9px] font-bold">🌐 Todos los Business Services</span>`;
    } else {
      bsHeader.innerHTML = list.slice(0, 3).map(bs => `<span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[9px] font-semibold truncate max-w-[180px]">${bs}</span>`).join('') + (list.length > 3 ? `<span class="text-[9px] text-slate-400">+${list.length-3}</span>` : '');
    }
  }
}

function aplicarPermisosUI() {
  const editAllowed = authService.puedeEditar();
  const esAdmin = authService.esAdminBS();

  const btnNueva = document.getElementById('btnNuevaChangeHeader');
  if (btnNueva) {
    btnNueva.classList.toggle('opacity-40', !editAllowed);
    btnNueva.classList.toggle('cursor-not-allowed', !editAllowed);
    if (editAllowed) btnNueva.removeAttribute('disabled');
    else btnNueva.setAttribute('disabled', 'true');
  }

  const btnExcel = document.getElementById('btnCargarExcelHeader');
  if (btnExcel) {
    btnExcel.classList.toggle('opacity-40', !editAllowed);
    btnExcel.classList.toggle('cursor-not-allowed', !editAllowed);
    if (editAllowed) btnExcel.removeAttribute('disabled');
    else btnExcel.setAttribute('disabled', 'true');
  }

  const tabUsuarios = document.querySelector('button[data-view="usuarios"]');
  const tabBranding = document.querySelector('button[data-view="branding"]');
  if (tabUsuarios) tabUsuarios.classList.toggle('opacity-50', !esAdmin);
  if (tabBranding) tabBranding.classList.toggle('opacity-50', !authService.esAdminGlobal());
}

// ============================================================
// AUDIT LOG
// ============================================================
async function registrarAudit(changeNum, campo, valorAnterior, valorNuevo, usuario) {
  if (String(valorAnterior) === String(valorNuevo)) return;
  const u = usuario || authService.obtenerUsuarioActual().nombre || 'Sistema';
  const entry = {
    timestamp: new Date().toISOString(),
    usuario: u,
    changeNum: changeNum || '—',
    campo,
    valorAnterior: String(valorAnterior || '(vacío)'),
    valorNuevo: String(valorNuevo || '(vacío)')
  };
  auditLog.unshift(entry);
  if (auditLog.length > 500) auditLog = auditLog.slice(0, 500);

  try {
    if (typeof apiClient !== 'undefined') await apiClient.createAuditLog(entry);
  } catch (_) {}
}

function registrarAuditCambios(changeNum, datosAnteriores, datosNuevos, camposAuditar) {
  camposAuditar.forEach(campo => {
    const prev = datosAnteriores[campo];
    const curr = datosNuevos[campo];
    if (String(prev||'') !== String(curr||'')) {
      registrarAudit(changeNum, campo, prev, curr);
    }
  });
}

// ============================================================
// POBLAR SELECTS DE PAÍSES, BUSINESS SERVICES Y PRODUCTOS
// ============================================================
function poblarFiltroPaises() {
  const sel = document.getElementById('filtroPais');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = `<option value="todos">${t('filtro.todos_paises')}</option>`;
  obtenerPaisesActivos().forEach(p => {
    sel.innerHTML += `<option value="${p.key}">${p.nombre}</option>`;
  });
  if (prev) sel.value = prev;
}

function poblarSelectPaisFormulario() {
  const sel = document.getElementById('inpPais');
  const selRapidoBS = document.getElementById('inpRapidoBSPais');
  const selRapidoProd = document.getElementById('inpRapidoProductoPais');

  const paises = obtenerPaisesActivos();
  const optionsHtml = paises.map(p => `<option value="${p.key}">${p.nombre}</option>`).join('');

  if (sel) sel.innerHTML = optionsHtml;
  if (selRapidoBS) selRapidoBS.innerHTML = `<option value="Global">Global</option>` + optionsHtml;
  if (selRapidoProd) selRapidoProd.innerHTML = `<option value="">Todos los países</option>` + optionsHtml;
}

function poblarSelectBSFormulario() {
  const sel = document.getElementById('inpBusinessService');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '';
  const todos = appState.businessServices;

  todos.forEach(item => {
    if (authService.esAdminGlobal() || authService.tieneAccesoBusinessService(item.nombre, item.pais)) {
      sel.innerHTML += `<option value="${item.nombre}">[${item.pais}] ${item.nombre}</option>`;
    }
  });
  if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
}

function poblarSelectProductosFormulario(paisSeleccionado = '') {
  const sel = document.getElementById('inpProduto');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '';

  let prods = appState.products;
  if (paisSeleccionado && paisSeleccionado !== 'todos') {
    prods = prods.filter(p => !p.pais || p.pais === paisSeleccionado || p.pais === 'Global');
  }

  if (prods.length === 0) {
    prods = appState.products;
  }

  prods.forEach(p => {
    sel.innerHTML += `<option value="${p.nombre}">${p.nombre} ${p.pais ? `(${p.pais})` : ''}</option>`;
  });
  if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
}

function filtrarProductosPorPaisFormulario(pais) {
  poblarSelectProductosFormulario(pais);
}

// ============================================================
// ADMINISTRACIÓN EN VIVO: BUSINESS SERVICES (MODAL & CRUD)
// ============================================================
function abrirModalCrearRapidoBS() {
  document.getElementById('inpRapidoBSNombre').value = '';
  poblarSelectPaisFormulario();
  document.getElementById('modalCrearRapidoBS')?.classList.remove('hidden');
}

function fecharModalCrearRapidoBS() {
  document.getElementById('modalCrearRapidoBS')?.classList.add('hidden');
}

async function handleCrearRapidoBSSubmit(e) {
  if (e) e.preventDefault();
  const nombre = document.getElementById('inpRapidoBSNombre')?.value?.trim();
  const pais = document.getElementById('inpRapidoBSPais')?.value || 'Global';

  if (!nombre) {
    mostrarToast('Ingresa el nombre del Business Service', 'error');
    return;
  }

  try {
    if (typeof apiClient !== 'undefined' && apiClient.createBusinessService) {
      await apiClient.createBusinessService({ nombre, pais });
    }
  } catch (err) {
    console.warn('API no disponible, guardando localmente:', err);
  }

  if (!Array.isArray(appState.businessServices)) appState.businessServices = [];
  appState.businessServices.push({ id: Date.now(), nombre, pais });

  fecharModalCrearRapidoBS();
  poblarSelectBSFormulario();

  const sel = document.getElementById('inpBusinessService');
  if (sel) sel.value = nombre;

  mostrarToast(`Business Service "${nombre}" guardado con éxito ✅`, 'success');
}

function abrirModalAdminBS() {
  renderizarTablaAdminBS();
  document.getElementById('modalAdminBS')?.classList.remove('hidden');
}

function fecharModalAdminBS() {
  document.getElementById('modalAdminBS')?.classList.add('hidden');
}

function renderizarTablaAdminBS(filtro = '') {
  const tbody = document.getElementById('tbodyAdminBS');
  if (!tbody) return;
  tbody.innerHTML = '';
  const clean = filtro.toLowerCase().trim();

  const filtrados = appState.businessServices.filter(s =>
    !clean || s.nombre.toLowerCase().includes(clean) || (s.pais && s.pais.toLowerCase().includes(clean))
  );

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-400">No se encontraron Business Services.</td></tr>`;
    return;
  }

  filtrados.forEach(s => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 border-b border-slate-100 text-xs';
    tr.innerHTML = `
      <td class="p-2 font-bold text-slate-800">${s.nombre}</td>
      <td class="p-2 text-slate-600"><span class="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">${s.pais || 'Global'}</span></td>
      <td class="p-2 text-center">
        <button onclick="handleEliminarBS('${s.id}')" class="p-1 text-rose-600 hover:bg-rose-50 rounded" title="Eliminar (con validación de uso)">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function handleEliminarBS(id) {
  const s = appState.businessServices.find(x => String(x.id) === String(id));
  const nombre = s ? s.nombre : 'este Business Service';

  if (!confirm(`¿Eliminar el Business Service "${nombre}" de la base de datos?`)) return;

  try {
    if (typeof apiClient !== 'undefined') await apiClient.deleteBusinessService(id);
  } catch (err) {}

  appState.businessServices = appState.businessServices.filter(x => String(x.id) !== String(id));
  mostrarToast(`Business Service eliminado con éxito`, 'warning');
  renderizarTablaAdminBS();
  poblarSelectBSFormulario();
}

// ============================================================
// ADMINISTRACIÓN EN VIVO: PAÍSES (MODAL & CRUD)
// ============================================================
function abrirModalCrearRapidoPais() {
  document.getElementById('inpRapidoPaisNombre').value = '';
  document.getElementById('modalCrearRapidoPais')?.classList.remove('hidden');
}

function fecharModalCrearRapidoPais() {
  document.getElementById('modalCrearRapidoPais')?.classList.add('hidden');
}

async function handleCrearRapidoPaisSubmit(e) {
  if (e) e.preventDefault();
  const nombre = document.getElementById('inpRapidoPaisNombre')?.value?.trim();
  const horas = parseInt(document.getElementById('inpRapidoPaisHoras')?.value) || 100;
  const color = document.getElementById('inpRapidoPaisColor')?.value || '#059669';

  if (!nombre) return;

  const ok = await agregarPais(nombre, horas, color);
  mostrarToast(`País "${nombre}" guardado en base de datos ✅`, 'success');
  fecharModalCrearRapidoPais();
  poblarFiltroPaises();
  poblarSelectPaisFormulario();
  renderizarTodo();
  const sel = document.getElementById('inpPais');
  if (sel) sel.value = nombre;
}

function abrirModalAdminPaises() {
  renderizarTablaAdminPaises();
  document.getElementById('modalAdminPaises')?.classList.remove('hidden');
}

function fecharModalAdminPaises() {
  document.getElementById('modalAdminPaises')?.classList.add('hidden');
}

function renderizarTablaAdminPaises() {
  const tbody = document.getElementById('tbodyAdminPaises');
  if (!tbody) return;
  tbody.innerHTML = '';

  const paises = obtenerTodosPaises();
  paises.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 border-b border-slate-100 text-xs';
    tr.innerHTML = `
      <td class="p-2 font-bold text-slate-800 flex items-center gap-2">
        <span class="w-3 h-3 rounded-full" style="background:${p.color}"></span>
        ${p.nombre}
      </td>
      <td class="p-2 text-center font-bold">${p.horasDisponibles} h</td>
      <td class="p-2 text-center">
        <button onclick="handleEliminarPais('${p.key}')" class="p-1 text-rose-600 hover:bg-rose-50 rounded" title="Eliminar (con validación de uso)">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function handleEliminarPais(key) {
  if (!confirm(`¿Eliminar el país "${key}" de la base de datos?`)) return;
  
  if (typeof eliminarPais === 'function') {
    await eliminarPais(key);
  }

  mostrarToast(`País ${key} eliminado con éxito`, 'warning');
  poblarFiltroPaises();
  poblarSelectPaisFormulario();
  renderizarTablaAdminPaises();
  renderizarConfigPaises();
  renderizarTodo();
}

// ============================================================
// ADMINISTRACIÓN EN VIVO: PRODUCTOS (MODAL & CRUD)
// ============================================================
function abrirModalCrearRapidoProducto() {
  document.getElementById('inpRapidoProductoNombre').value = '';
  poblarSelectPaisFormulario();
  document.getElementById('modalCrearRapidoProducto')?.classList.remove('hidden');
}

function fecharModalCrearRapidoProducto() {
  document.getElementById('modalCrearRapidoProducto')?.classList.add('hidden');
}

async function handleCrearRapidoProductoSubmit(e) {
  if (e) e.preventDefault();
  const nombre = document.getElementById('inpRapidoProductoNombre')?.value?.trim();
  const pais = document.getElementById('inpRapidoProductoPais')?.value || '';

  if (!nombre) return;

  try {
    if (typeof apiClient !== 'undefined') await apiClient.createProduct({ nombre, pais });
  } catch (err) {}

  if (!Array.isArray(appState.products)) appState.products = [];
  appState.products.push({ id: Date.now(), nombre, pais });

  fecharModalCrearRapidoProducto();
  poblarSelectProductosFormulario();
  const sel = document.getElementById('inpProduto');
  if (sel) sel.value = nombre;
  mostrarToast(`Producto "${nombre}" guardado con éxito ✅`, 'success');
}

function abrirModalAdminProductos() {
  renderizarTablaAdminProductos();
  document.getElementById('modalAdminProductos')?.classList.remove('hidden');
}

function fecharModalAdminProductos() {
  document.getElementById('modalAdminProductos')?.classList.add('hidden');
}

function renderizarTablaAdminProductos(filtro = '') {
  const tbody = document.getElementById('tbodyAdminProductos');
  if (!tbody) return;
  tbody.innerHTML = '';
  const clean = filtro.toLowerCase().trim();

  const filtrados = appState.products.filter(p =>
    !clean || p.nombre.toLowerCase().includes(clean) || (p.pais && p.pais.toLowerCase().includes(clean))
  );

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-400">No se encontraron productos.</td></tr>`;
    return;
  }

  filtrados.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 border-b border-slate-100 text-xs';
    tr.innerHTML = `
      <td class="p-2 font-bold text-slate-800">${p.nombre}</td>
      <td class="p-2 text-slate-600"><span class="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">${p.pais || 'Global'}</span></td>
      <td class="p-2 text-center">
        <button onclick="handleEliminarProducto('${p.id}')" class="p-1 text-rose-600 hover:bg-rose-50 rounded" title="Eliminar (con validación de uso)">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function handleEliminarProducto(id) {
  if (!confirm(`¿Eliminar este producto de la base de datos?`)) return;

  try {
    if (typeof apiClient !== 'undefined') await apiClient.deleteProduct(id);
  } catch (err) {}

  appState.products = appState.products.filter(x => String(x.id) !== String(id));
  mostrarToast(`Producto eliminado con éxito`, 'warning');
  renderizarTablaAdminProductos();
  poblarSelectProductosFormulario();
}

async function recargarCatalogosCompletos() {
  if (typeof apiClient !== 'undefined') {
    const [resBS, resProds] = await Promise.allSettled([
      apiClient.getBusinessServices(),
      apiClient.getProducts()
    ]);
    if (resBS.status === 'fulfilled' && resBS.value.success) appState.businessServices = resBS.value.data;
    if (resProds.status === 'fulfilled' && resProds.value.success) appState.products = resProds.value.data;
  }
}

// ============================================================
// FILTRADO CON SEGURIDAD EN CAPA LÓGICA
// ============================================================
function obtenerChangesFiltradas() {
  const changesSeguras = authService.filtrarChangesPorSeguridad(appState.changes);

  return changesSeguras.filter(ch => {
    if (appState.mesActivo) {
      const m = ch.mesAno || (ch.d1 ? ch.d1.substring(0,7) : '');
      if (m && m !== appState.mesActivo) return false;
    }
    if (appState.filtroTexto) {
      const q = appState.filtroTexto.toLowerCase();
      if (!['numeroChange','ritm','solicitante','businessService','producto','descripcion','engenheiro','pais']
        .some(k => (ch[k]||'').toLowerCase().includes(q))) return false;
    }
    if (appState.filtroSolicitante!=='todos' && ch.solicitante!==appState.filtroSolicitante) return false;
    if (appState.filtroBusinessService!=='todos' && ch.businessService!==appState.filtroBusinessService) return false;
    if (appState.filtroProducto!=='todos' && ch.producto!==appState.filtroProducto) return false;
    if (appState.filtroPais!=='todos' && ch.pais!==appState.filtroPais) return false;
    if (appState.filtroStatus!=='todos' && ch.statusAprovacao!==appState.filtroStatus) return false;
    return true;
  });
}

// ============================================================
// RENDERIZADO PRINCIPAL
// ============================================================
function renderizarTodo() {
  actualizarSelectoresFiltros();
  actualizarIndicadores();
  const v = appState.vistaActiva;
  if (v==='kanban') renderizarKanban();
  else if (v==='fases') renderizarMatriz();
  else if (v==='dashboard') renderizarDashboard();
  else if (v==='reportes' && typeof reportsManager !== 'undefined') reportsManager.renderizar();
  else if (v==='tabla') renderizarTabla();
  else if (v==='historial') renderizarHistorial();
  else if (v==='config') renderizarConfigPaises();
  else if (v==='usuarios') renderizarUsuarios();
  else if (v==='branding') renderizarBranding();
}

function renderizarTodoSilencioso() {
  actualizarIndicadores();
  const v = appState.vistaActiva;
  if (v==='kanban') renderizarKanban();
  else if (v==='fases') renderizarMatriz();
  else if (v==='tabla') renderizarTabla();
}

function actualizarSelectoresFiltros() {
  const base = authService.filtrarChangesPorSeguridad(appState.changes);
  const uniq = arr => [...new Set(arr.filter(Boolean))].sort();
  const fill = (id, opts, phKey) => {
    const s = document.getElementById(id); if (!s) return;
    const prev = s.value;
    s.innerHTML = `<option value="todos">${t(phKey)}</option>`;
    opts.forEach(o => { s.innerHTML += `<option value="${o}">${o}</option>`; });
    if (opts.includes(prev)) s.value = prev;
  };
  fill('filtroSolicitante', uniq(base.map(c=>c.solicitante)), 'filtro.todos_solicitantes');
  fill('filtroBusinessService', uniq(base.map(c=>c.businessService)), 'filtro.todos_services');
  fill('filtroProducto', uniq(base.map(c=>c.producto)), 'filtro.todos_productos');
}

// ============================================================
// INDICADORES DE CAPACIDAD
// ============================================================
function actualizarIndicadores() {
  const pais = appState.filtroPais;
  const cfg = obtenerConfigPais(pais);
  const filtradas = obtenerChangesFiltradas();
  let horasUsadas=0, horasCompr=0, sobreLim=0, proy=0;
  const porProd = {};

  filtradas.forEach(ch => {
    const hA = parseFloat(ch.horasAprovadas||0);
    const hE = parseFloat(ch.horasEstimadas||0);
    horasUsadas += hA;
    horasCompr += hE;
    if (hE > REGLA_MAX_HORAS_CHANGE) { sobreLim++; proy++; }
    const prod = ch.producto||'Sin asignar';
    porProd[prod] = (porProd[prod]||0) + hA;
  });

  const horasDisp = cfg.horasDisponibles;
  const horasRest = Math.max(0, horasDisp - horasUsadas);
  const pct = horasDisp>0 ? Math.min(100, Math.round(horasUsadas/horasDisp*100)) : 0;
  const prom = filtradas.length>0 ? (horasUsadas/filtradas.length).toFixed(1) : 0;
  const sobre = horasUsadas > horasDisp;

  setText('txtHorasDisponibles', `${horasDisp} h`);
  setText('txtHorasConsumidas', `${horasUsadas.toFixed(1)} h`);
  setText('txtHorasResta', `${horasRest.toFixed(1)} h`);
  setText('txtPctUso', `${pct}%`);
  setText('txtHorasComprometidas', `${horasCompr.toFixed(1)} h`);
  setText('txtTotalChanges', `${filtradas.length}`);
  setText('txtPromedioPorChange', `${prom} h`);
  setText('txtSobreLimite', `${sobreLim}`);
  setText('txtCountSmall', `${filtradas.length-proy} ${t('kpi.mejoras')}`);
  setText('txtMaxHorasPais', `Máx. ${REGLA_MAX_HORAS_CHANGE}h por change`);
  setText('txtCapacidadPais', `${cfg.nombre}: ${horasDisp}h/mes`);

  const alEl = document.getElementById('alertaSobrecapacidad');
  if (alEl) {
    if (sobre) { alEl.classList.remove('hidden'); setText('txtExcesoHoras', `${(horasUsadas-horasDisp).toFixed(1)}h`); }
    else alEl.classList.add('hidden');
  }

  if (charts.gauge) {
    charts.gauge.data.datasets[0].data = [Math.min(horasUsadas,horasDisp), horasRest];
    charts.gauge.data.datasets[0].backgroundColor = [sobre?'#ef4444':'#2563eb', '#e2e8f0'];
    charts.gauge.update('none');
  }

  const cp = document.getElementById('containerProductos');
  if (cp) {
    cp.innerHTML = '';
    const sorted = Object.keys(porProd).sort((a,b)=>porProd[b]-porProd[a]);
    if (!sorted.length) cp.innerHTML = '<p class="text-xs text-slate-400 py-3 text-center">Sin datos.</p>';
    else sorted.forEach(prod => {
      const h = porProd[prod], pc = Math.min(100, Math.round(h/horasDisp*100));
      cp.innerHTML += `<div class="py-1 px-1.5 rounded-lg bg-slate-50 border border-slate-100">
        <div class="flex justify-between text-[11px] font-semibold mb-0.5">
          <span class="text-slate-700 truncate max-w-[140px]"><i class="fa-solid fa-cube text-slate-400 mr-1 text-[9px]"></i>${prod}</span>
          <span class="text-slate-800 font-bold">${h.toFixed(1)}h <span class="text-[9px] text-slate-400">(${pc}%)</span></span>
        </div>
        <div class="w-full bg-slate-200 h-1 rounded-full"><div class="bg-blue-600 h-full rounded-full" style="width:${pc}%"></div></div>
      </div>`;
    });
  }
}

function setText(id,v) { const el=document.getElementById(id); if(el) el.textContent=v; }

// ============================================================
// KANBAN CON SLA Y CONTROL DE TIEMPO
// ============================================================
function renderizarKanban() {
  FASES.forEach(f => {
    const col = document.getElementById(`col-${f.key}`); if(col) col.innerHTML='';
    const b = document.getElementById(`badge-${f.key}`); if(b) b.textContent='0';
  });
  const filtradas = obtenerChangesFiltradas();
  const cnt = {}; FASES.forEach(f=>{cnt[f.key]=0;});
  const editAllowed = authService.puedeEditar();

  filtradas.forEach(ch => {
    let fk = normalizarFaseKey(ch.faseAtual);
    cnt[fk]=(cnt[fk]||0)+1;
    const col = document.getElementById(`col-${fk}`);
    if (!col) return;
    const h = parseFloat(ch.horasEstimadas||0);
    const esP = h > REGLA_MAX_HORAS_CHANGE;
    const idStr = String(ch.id||ch.spId);
    const fIdx = FASES.findIndex(f=>f.key===fk);

    const metricas = typeof obtenerMetricasSLA === 'function' ? obtenerMetricasSLA(ch) : {};

    const card = document.createElement('div');
    card.className = `kanban-card ${esP?'card-accent-excede':'card-accent-small'} ${!editAllowed?'readonly-card':''}`;
    card.draggable = editAllowed;
    card.dataset.id = idStr;

    let actionButtonsHtml = '';
    if (editAllowed) {
      actionButtonsHtml = `
        <div class="flex items-center gap-1">
          ${fIdx>0?`<button type="button" data-act="prev" data-id="${idStr}" class="w-4 h-4 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-[8px]" title="Mover a fase anterior"><i class="fa-solid fa-chevron-left"></i></button>`:''}
          <button type="button" data-act="open" data-id="${idStr}" class="text-blue-600 font-semibold hover:underline text-[10px]">Editar</button>
          ${fIdx<FASES.length-1?`<button type="button" data-act="next" data-id="${idStr}" class="w-4 h-4 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center text-[8px]" title="Mover a siguiente fase"><i class="fa-solid fa-chevron-right"></i></button>`:''}
        </div>`;
    } else {
      actionButtonsHtml = `
        <div class="flex items-center gap-1">
          <button type="button" data-act="open" data-id="${idStr}" class="text-slate-600 font-semibold hover:underline text-[10px]"><i class="fa-solid fa-eye mr-0.5"></i>Ver</button>
        </div>`;
    }

    card.innerHTML = `
      <div class="flex items-center justify-between gap-1 mb-1">
        <span class="font-bold text-xs text-blue-700 font-mono">${ch.numeroChange||'SIN-ID'}</span>
        <span class="text-[9px] font-bold px-1.5 rounded ${esP?'bg-rose-100 text-rose-800':'bg-emerald-100 text-emerald-800'}">${h}h${esP?' ⚠️':''}</span>
      </div>
      <p class="text-[11px] font-medium text-slate-800 line-clamp-2 leading-snug mb-1">${ch.descripcion||'Sin descripción'}</p>
      
      <div class="flex flex-col gap-1 my-1.5 pt-1 border-t border-slate-100">
        <div class="flex items-center justify-between">
          ${typeof generarBadgeSLAHTML === 'function' ? generarBadgeSLAHTML(metricas) : ''}
        </div>
        <div>
          ${typeof generarBadgeEtapaHTML === 'function' ? generarBadgeEtapaHTML(metricas) : ''}
        </div>
      </div>

      <div class="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
        <span class="truncate max-w-[80px]" title="${ch.solicitante||''}"><i class="fa-solid fa-user text-[9px] text-slate-400 mr-0.5"></i>${ch.solicitante||'N/A'}</span>
        ${actionButtonsHtml}
      </div>`;

    card.addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      if (!btn) { if (!dragActive) abrirModalEdicion(idStr); return; }
      e.stopPropagation();
      const a=btn.dataset.act, bid=btn.dataset.id;
      if (a==='open') abrirModalEdicion(bid);
      else if (a==='prev') moverFaseRelativa(bid,-1);
      else if (a==='next') moverFaseRelativa(bid,1);
    });

    if (editAllowed) {
      card.addEventListener('dragstart', e => {
        draggedId=idStr; dragActive=true; card.classList.add('dragging');
        e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',idStr);
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.kanban-col').forEach(c=>c.classList.remove('drag-over'));
        setTimeout(()=>{dragActive=false;draggedId=null;},100);
      });
    }

    col.appendChild(card);
  });

  FASES.forEach(f => { const b=document.getElementById(`badge-${f.key}`); if(b) b.textContent=cnt[f.key]||0; });
  if (editAllowed) configurarDropZones();
}

function configurarDropZones() {
  FASES.forEach(f => {
    const w = document.getElementById(`kanban-col-${f.key}`);
    if (!w) return;
    w.ondragenter = e => { e.preventDefault(); if (authService.puedeEditar()) w.classList.add('drag-over'); };
    w.ondragleave = e => { if (!w.contains(e.relatedTarget)) w.classList.remove('drag-over'); };
    w.ondragover = e => { e.preventDefault(); if (authService.puedeEditar()) e.dataTransfer.dropEffect='move'; };
    w.ondrop = async e => {
      e.preventDefault(); w.classList.remove('drag-over');
      if (!authService.puedeEditar()) { mostrarToast(t('toast.acceso_denegado'), 'warning'); return; }
      const id = e.dataTransfer.getData('text/plain')||draggedId;
      if (id) await moverChangeDeFase(id, f.key);
    };
  });
}

async function moverChangeDeFase(changeId, nuevaFase) {
  if (!authService.puedeEditar()) {
    mostrarToast(t('toast.acceso_denegado'), 'warning');
    return;
  }
  nuevaFase = normalizarFaseKey(nuevaFase);
  const ch = appState.changes.find(c=>String(c.id||c.spId)===String(changeId));
  if (!ch || ch.faseAtual===nuevaFase) return;

  if (!authService.tieneAccesoBusinessService(ch.businessService, ch.pais)) {
    mostrarToast('No tienes autorización para modificar Changes de este Business Service.', 'error');
    registrarAudit('SEGURIDAD', 'BLOQUEO_ACCESO', ch.numeroChange, ch.businessService);
    return;
  }

  const anterior = ch.faseAtual;
  const user = authService.obtenerUsuarioActual().nombre || 'Usuario';

  if (!ch.historialFases) ch.historialFases=[];
  ch.historialFases.push({de:anterior,a:nuevaFase,fecha:new Date().toISOString().split('T')[0],usuario:user});

  ch.faseAtual = nuevaFase;
  ch.ultimaModificacao = new Date().toISOString();
  ch.modificadoPor = user;
  localStorage.setItem('nestle_changes_v4', JSON.stringify(appState.changes));
  const fo = FASES_KEY_MAP[nuevaFase];
  if (fo && !ch[fo.dKey]) ch[fo.dKey] = new Date().toISOString().split('T')[0];

  if (nuevaFase === 'Concluida' && !ch.fechaCierre) {
    ch.fechaCierre = new Date().toISOString().split('T')[0];
  }

  try {
    if (typeof apiClient !== 'undefined') await apiClient.updateChange(ch.id, ch);
    registrarAudit(ch.numeroChange, 'CAMBIO_ETAPA', FASES_KEY_MAP[anterior]?.defaultLabel||anterior, FASES_KEY_MAP[nuevaFase]?.defaultLabel||nuevaFase, user);
    mostrarToast(`${ch.numeroChange} → "${t(fo?.labelKey || nuevaFase)}"`, 'success');
  } catch (err) {
    console.error('[Update Change]', err);
  }

  if (appState.vistaActiva==='kanban') renderizarKanban();
  else if (appState.vistaActiva==='fases') renderizarMatriz();
  else if (appState.vistaActiva==='reportes' && typeof reportsManager !== 'undefined') reportsManager.renderizar();
  actualizarIndicadores();
}

async function moverFaseRelativa(id, delta) {
  if (!authService.puedeEditar()) {
    mostrarToast(t('toast.acceso_denegado'), 'warning');
    return;
  }
  const ch = appState.changes.find(c=>String(c.id||c.spId)===String(id));
  if (!ch) return;
  const idx = FASES.findIndex(f=>f.key===ch.faseAtual);
  const ni = idx+delta;
  if (ni>=0 && ni<FASES.length) await moverChangeDeFase(id, FASES[ni].key);
}

function normalizarFaseKey(raw) {
  if (!raw) return 'Abertura';
  if (FASES_KEY_MAP[raw]) return raw;
  if (FASES_LEGACY_MAP[raw]) return FASES_LEGACY_MAP[raw];
  return 'Abertura';
}

// ============================================================
// MATRIZ DE FASES
// ============================================================
function renderizarMatriz() {
  const tbody = document.getElementById('tbodyFases'); if (!tbody) return;
  tbody.innerHTML='';
  const filtradas = obtenerChangesFiltradas();
  if (!filtradas.length) { tbody.innerHTML=`<tr><td colspan="11" class="p-8 text-center text-slate-400">Sin datos.</td></tr>`; return; }
  const editAllowed = authService.puedeEditar();

  filtradas.forEach(ch => {
    const tr = document.createElement('tr');
    tr.className='hover:bg-slate-50 border-b border-slate-100';
    let fTds='';
    FASES.forEach(f => {
      const dv=ch[f.dKey]||'';
      const esCurr = ch.faseAtual===f.key;
      let icon;
      if (dv) icon=`<div class="phase-checkpoint completed" title="Completado: ${dv}"><i class="fa-solid fa-check"></i></div><span class="text-[9px] text-slate-500 font-mono mt-0.5">${dv.substring(5)}</span>`;
      else if (esCurr) icon=`<div class="phase-checkpoint current" title="Fase Actual"><i class="fa-solid fa-spinner fa-spin"></i></div><span class="text-[9px] text-blue-600 font-bold mt-0.5">Actual</span>`;
      else icon=`<div class="phase-checkpoint pending" title="Pendiente"><i class="fa-regular fa-circle"></i></div><span class="text-[9px] text-slate-400 mt-0.5">—</span>`;
      
      const cursorClass = editAllowed ? 'cursor-pointer hover:opacity-80' : 'cursor-default';
      const clickHandler = editAllowed ? `onclick="accionCheckpoint('${ch.id||ch.spId}','${f.dKey}','${f.key}')"` : `onclick="mostrarToast('${t('toast.acceso_denegado')}','warning')"`;
      fTds+=`<td class="p-2 text-center"><div class="flex flex-col items-center ${cursorClass}" ${clickHandler}>${icon}</div></td>`;
    });
    tr.innerHTML=`<td class="p-2.5"><a href="javascript:void(0)" onclick="abrirModalEdicion('${ch.id||ch.spId}')" class="font-bold text-blue-700 font-mono hover:underline text-xs">${ch.numeroChange}</a><span class="block text-[10px] text-slate-400">${ch.pais||''}</span></td>
      <td class="p-2.5"><span class="block font-semibold text-xs">${ch.solicitante||'—'}</span><span class="text-[10px] text-blue-600 truncate block max-w-[130px]">${ch.businessService||'—'}</span></td>
      <td class="p-2.5"><span class="block font-medium text-xs truncate max-w-[120px]">${ch.producto||'—'}</span></td>${fTds}`;
    tbody.appendChild(tr);
  });
}

async function accionCheckpoint(chId, dKey, faseKey) {
  if (!authService.puedeEditar()) {
    mostrarToast(t('toast.acceso_denegado'), 'warning');
    return;
  }
  const ch = appState.changes.find(c=>String(c.id||c.spId)===String(chId));
  if (!ch) return;
  const user = authService.obtenerUsuarioActual().nombre || 'Usuario';

  if (ch[dKey]) {
    ch[dKey]=''; ch.ultimaModificacao=new Date().toISOString(); ch.modificadoPor=user;
    try { if (typeof apiClient !== 'undefined') await apiClient.updateChange(ch.id, ch); } catch (_) {}
    registrarAudit(ch.numeroChange, dKey, ch[dKey], '(removido)', user);
    renderizarMatriz(); actualizarIndicadores();
  } else {
    ch[dKey]=new Date().toISOString().split('T')[0];
    await moverChangeDeFase(chId, faseKey);
    if (appState.vistaActiva==='fases') renderizarMatriz();
  }
}

// ============================================================
// DASHBOARD
// ============================================================
function inicializarGraficoGauge() {
  const ctx = document.getElementById('gaugeCapacidade');
  if (!ctx) return;
  charts.gauge = new Chart(ctx.getContext('2d'), {
    type:'doughnut', data:{datasets:[{data:[0,160],backgroundColor:['#2563eb','#e2e8f0'],borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,rotation:-90,circumference:180,cutout:'76%',plugins:{tooltip:{enabled:false}}}
  });
}

function renderizarDashboard() {
  const filtradas = obtenerChangesFiltradas();
  const pais = appState.filtroPais;

  const porProd = {};
  filtradas.forEach(c => {
    const prod = c.producto||'Sin asignar';
    porProd[prod] = (porProd[prod]||0) + parseFloat(c.horasAprovadas||c.horasEstimadas||0);
  });
  const ctxP = document.getElementById('chartProductosDash');
  if (ctxP) {
    if (charts.prodDash) charts.prodDash.destroy();
    const paisLabel = pais==='todos' ? t('filtro.todos_paises') : obtenerConfigPais(pais).nombre;
    charts.prodDash = new Chart(ctxP.getContext('2d'), {
      type:'bar',
      data:{labels:Object.keys(porProd),datasets:[{label:`Horas (${paisLabel})`,data:Object.values(porProd),backgroundColor:'#3b82f6',borderRadius:6}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{font:{size:10}}}},scales:{y:{beginAtZero:true}}}
    });
  }

  const porFase = {}; FASES.forEach(f=>{porFase[t(f.labelKey)] = 0;});
  filtradas.forEach(c => { const fo=FASES_KEY_MAP[c.faseAtual]; porFase[t(fo?fo.labelKey:'fase.1_abertura')]=(porFase[t(fo?fo.labelKey:'fase.1_abertura')]||0)+1; });
  const ctxF = document.getElementById('chartFasesDash');
  if (ctxF) {
    if (charts.fasesDash) charts.fasesDash.destroy();
    charts.fasesDash = new Chart(ctxF.getContext('2d'), {
      type:'doughnut',
      data:{labels:Object.keys(porFase),datasets:[{data:Object.values(porFase),backgroundColor:FASES.map(f=>f.color)}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:{size:10}}}}}
    });
  }

  renderizarComparativoYAcumulado();
}

function renderizarComparativoYAcumulado() {
  const pais = appState.filtroPais;
  const mesAct = appState.mesActivo;
  const mesAnt = obtenerMesAnteriorKey(mesAct);

  const snapAnt = obtenerSnapshotMes(mesAnt, pais);
  const snapAct = obtenerSnapshotMes(mesAct, pais);

  setText('lblMesActual', formatMes(mesAct));
  setText('lblMesAnterior', formatMes(mesAnt));

  renderGrafComp('chartMesAnterior', charts.mesAnterior, snapAnt, formatMes(mesAnt), pais, c => { charts.mesAnterior = c; });
  renderGrafComp('chartMesActual', charts.mesActual, snapAct, formatMes(mesAct), pais, c => { charts.mesActual = c; });

  let totalHorasAcumuladas = 0;
  let totalChangesAcumuladas = 0;
  let totalCapacidadAcumulada = 0;
  const mesesRegistrados = Object.keys(historialMensual);

  if (mesesRegistrados.length > 0) {
    mesesRegistrados.forEach(mKey => {
      const snap = obtenerSnapshotMes(mKey, pais);
      if (snap) {
        totalHorasAcumuladas += (snap.horasUsadas || 0);
        totalChangesAcumuladas += (snap.totalChanges || 0);
        totalCapacidadAcumulada += (snap.horasDisponibles || 0);
      }
    });
  } else {
    const chs = pais === 'todos' ? authService.filtrarChangesPorSeguridad(appState.changes) : authService.filtrarChangesPorSeguridad(appState.changes).filter(c => c.pais === pais);
    totalHorasAcumuladas = chs.reduce((s, c) => s + parseFloat(c.horasAprovadas || c.horasEstimadas || 0), 0);
    totalChangesAcumuladas = chs.length;
    const cfg = obtenerConfigPais(pais);
    totalCapacidadAcumulada = cfg.horasDisponibles;
  }

  const numMeses = Math.max(1, mesesRegistrados.length);
  const promedioMensualAcum = (totalHorasAcumuladas / numMeses).toFixed(1);
  const pctAcumulado = totalCapacidadAcumulada > 0 ? Math.round((totalHorasAcumuladas / totalCapacidadAcumulada) * 100) : 0;

  setText('txtAcumuladoHorasTotales', `${totalHorasAcumuladas.toFixed(1)} h`);
  setText('txtAcumuladoTotalChanges', `${totalChangesAcumuladas}`);
  setText('txtAcumuladoPromedioMensual', `${promedioMensualAcum} h/mes`);
  setText('txtAcumuladoPctUso', `${pctAcumulado}%`);
  setText('txtAcumuladoCapacidadTotal', `${totalCapacidadAcumulada} h`);

  const ctxAcum = document.getElementById('chartAcumuladoTotal');
  if (ctxAcum) {
    if (charts.acumuladoTotal) charts.acumuladoTotal.destroy();
    charts.acumuladoTotal = new Chart(ctxAcum.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Capacidad Total Acumulada', 'Horas Totales Utilizadas', 'Horas Remanentes'],
        datasets: [{
          label: `Acumulado (${numMeses} períodos) - ${pctAcumulado}% Consumido`,
          data: [totalCapacidadAcumulada, totalHorasAcumuladas, Math.max(0, totalCapacidadAcumulada - totalHorasAcumuladas)],
          backgroundColor: ['#93c5fd', '#2563eb', '#86efac'],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { font: { size: 10 } } },
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y} h` } }
        },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Horas' } } }
      }
    });
  }
}

function renderGrafComp(canvasId, exist, snap, label, pais, cb) {
  const ctx=document.getElementById(canvasId); if(!ctx) return;
  if(exist) exist.destroy();
  const cfg=obtenerConfigPais(pais);
  const u=snap?snap.horasUsadas:0, d=snap?snap.horasDisponibles:cfg.horasDisponibles, r=Math.max(0,d-u);
  const pct=d>0?Math.round(u/d*100):0;
  cb(new Chart(ctx.getContext('2d'),{
    type:'bar',data:{labels:['Disponibles','Utilizadas','Restantes'],datasets:[{label:`${label} (${pct}%)`,data:[d,u,r],backgroundColor:['#bfdbfe','#2563eb','#bbf7d0'],borderRadius:8}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{font:{size:10}}}},scales:{y:{beginAtZero:true}}}
  }));
}

function obtenerSnapshotMes(mesKey, paisKey) {
  const s = historialMensual[mesKey];
  if (!s) return null;
  if (paisKey && paisKey !== 'todos') return s[paisKey] || null;
  const vals = Object.values(s);
  return {
    horasDisponibles: vals.reduce((a,v) => a+(v.horasDisponibles||0), 0),
    horasUsadas: vals.reduce((a,v) => a+(v.horasUsadas||0), 0),
    totalChanges: vals.reduce((a,v) => a+(v.totalChanges||0), 0),
  };
}

function obtenerMesAnteriorKey(m) {
  const [a, mm] = m.split('-').map(Number);
  return mm===1 ? `${a-1}-12` : `${a}-${String(mm-1).padStart(2,'0')}`;
}

function formatMes(m) {
  if(!m) return '—';
  const [a,mm]=m.split('-'); const n=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${n[parseInt(mm)-1]} ${a}`;
}

// ============================================================
// TABLA BACKLOG
// ============================================================
function renderizarTabla() {
  const tbody=document.getElementById('tbodyBacklog'); if(!tbody) return;
  tbody.innerHTML='';
  const filtradas=obtenerChangesFiltradas();
  if(!filtradas.length){tbody.innerHTML=`<tr><td colspan="12" class="p-8 text-center text-slate-400">Sin registros.</td></tr>`;return;}
  const editAllowed = authService.puedeEditar();

  filtradas.forEach(ch=>{
    const h=parseFloat(ch.horasEstimadas||0), esP=h>REGLA_MAX_HORAS_CHANGE, fo=FASES_KEY_MAP[ch.faseAtual], cid=String(ch.id||ch.spId);
    const metricas = typeof obtenerMetricasSLA === 'function' ? obtenerMetricasSLA(ch) : {};
    const tr=document.createElement('tr'); tr.className='hover:bg-slate-50 border-b border-slate-100 text-xs';
    
    let actionsHtml = '';
    if (editAllowed) {
      actionsHtml = `
        <button onclick="abrirModalEdicion('${cid}')" class="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Editar"><i class="fa-solid fa-pen text-[11px]"></i></button>
        <button onclick="eliminarChange('${cid}')" class="p-1 text-rose-600 hover:bg-rose-100 rounded" title="Eliminar"><i class="fa-solid fa-trash text-[11px]"></i></button>`;
    } else {
      actionsHtml = `
        <button onclick="abrirModalEdicion('${cid}')" class="p-1 text-slate-600 hover:bg-slate-100 rounded" title="Ver detalles"><i class="fa-solid fa-eye text-[11px]"></i></button>`;
    }

    tr.innerHTML=`<td class="p-2.5 font-bold text-blue-700 font-mono">${ch.numeroChange}</td>
      <td class="p-2.5">${ch.pais||'—'}</td>
      <td class="p-2.5 font-medium">${ch.solicitante||'—'}</td>
      <td class="p-2.5 text-slate-600 truncate max-w-[130px]" title="${ch.businessService}">${ch.businessService||'—'}</td>
      <td class="p-2.5 font-semibold">${ch.producto||'—'}</td>
      <td class="p-2.5 text-slate-600 max-w-xs truncate">${ch.descripcion||'—'}</td>
      <td class="p-2.5 text-center">${typeof generarBadgeSLAHTML === 'function' ? generarBadgeSLAHTML(metricas) : ''}</td>
      <td class="p-2.5 text-center font-bold">${h}h</td>
      <td class="p-2.5 text-center"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${esP?'bg-rose-100 text-rose-800':'bg-emerald-100 text-emerald-800'}">${esP?'Proyecto':'Mejora'}</span></td>
      <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold">${t(fo?.labelKey || ch.faseAtual)}</span></td>
      <td class="p-2.5 text-center"><span class="px-1.5 py-0.5 rounded ${ch.statusAprovacao==='Aprovado'?'bg-emerald-100 text-emerald-800':ch.statusAprovacao==='Rejeitado'?'bg-rose-100 text-rose-800':'bg-amber-100 text-amber-800'} font-semibold text-[10px]">${ch.statusAprovacao||'Pendente'}</span></td>
      <td class="p-2.5 text-center"><div class="flex items-center justify-center gap-1.5">${actionsHtml}</div></td>`;
    tbody.appendChild(tr);
  });
}

// ============================================================
// HISTORIAL / AUDIT LOG
// ============================================================
function renderizarHistorial() {
  const tbody=document.getElementById('tbodyHistorial'); if(!tbody) return;
  tbody.innerHTML='';
  if (!auditLog.length) { tbody.innerHTML=`<tr><td colspan="6" class="p-8 text-center text-slate-400">Sin registros de auditoría.</td></tr>`; return; }
  auditLog.forEach(log => {
    const tr=document.createElement('tr'); tr.className='border-b border-slate-100 text-xs hover:bg-slate-50';
    const ts = new Date(log.timestamp);
    const fecha = ts.toLocaleDateString('es',{day:'2-digit',month:'short',year:'numeric'});
    const hora = ts.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    tr.innerHTML=`<td class="p-2 font-mono text-slate-500 whitespace-nowrap">${fecha} ${hora}</td>
      <td class="p-2 font-semibold text-slate-700">${log.usuario}</td>
      <td class="p-2 font-bold text-blue-700 font-mono">${log.changeNum}</td>
      <td class="p-2 font-medium text-slate-800">${log.campo}</td>
      <td class="p-2 text-rose-600 line-through">${log.valorAnterior}</td>
      <td class="p-2 text-emerald-700 font-semibold">${log.valorNuevo}</td>`;
    tbody.appendChild(tr);
  });
}

// ============================================================
// GESTIÓN DE USUARIOS
// ============================================================
function renderizarUsuarios() {
  const tbody = document.getElementById('tbodyUsuarios');
  if (!tbody) return;
  tbody.innerHTML = '';

  const admin = authService.esAdminBS();
  const alertEl = document.getElementById('alertaPermisoUsuarios');
  const cardCrear = document.getElementById('cardCrearUsuarioAdmin');

  if (alertEl) {
    if (!admin) {
      alertEl.classList.remove('hidden');
      alertEl.innerHTML = `<i class="fa-solid fa-lock text-amber-600 mr-1.5"></i> ${t('toast.solo_admin')}`;
    } else {
      alertEl.classList.add('hidden');
    }
  }

  if (cardCrear) {
    cardCrear.classList.toggle('hidden', !admin);
  }

  authService.usuarios.forEach(u => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-100 text-xs hover:bg-slate-50';
    
    let roleBadgeClass = 'badge-role-read';
    if (u.rol === 'Administrador') roleBadgeClass = 'badge-role-admin';
    else if (u.rol === 'Administrador_BS') roleBadgeClass = 'badge-role-admin-bs';
    else if (u.rol === 'Edición') roleBadgeClass = 'badge-role-edit';

    let roleControlHtml = '';
    if (authService.esAdminGlobal()) {
      roleControlHtml = `
        <select onchange="handleCambiarRolUsuario('${u.id}', this.value)" class="p-1 border border-slate-300 rounded font-semibold text-xs bg-white">
          <option value="Administrador" ${u.rol==='Administrador'?'selected':''}>🛡️ Admin Global</option>
          <option value="Administrador_BS" ${u.rol==='Administrador_BS'?'selected':''}>🏢 Admin BS</option>
          <option value="Edición" ${u.rol==='Edición'?'selected':''}>✏️ Edición</option>
          <option value="Lectura" ${u.rol==='Lectura'?'selected':''}>👁️ Lectura</option>
        </select>`;
    } else {
      roleControlHtml = `<span class="${roleBadgeClass} px-2 py-0.5 rounded text-[10px] font-bold">${u.rol}</span>`;
    }

    let deleteBtnHtml = '';
    if (authService.esAdminGlobal() && authService.usuarios.length > 1) {
      deleteBtnHtml = `<button onclick="handleEliminarUsuario('${u.id}')" class="p-1 text-rose-500 hover:bg-rose-50 rounded" title="Eliminar usuario"><i class="fa-solid fa-trash-can text-[11px]"></i></button>`;
    }

    const flags = { es: '🇪🇸 ES', pt: '🇧🇷 PT', en: '🇺🇸 EN' };

    const bsList = u.businessServices || [];
    let bsHtml = '';
    if (bsList.includes('*')) {
      bsHtml = `<span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">🌐 Todos los Business Services</span>`;
    } else {
      bsHtml = `<div class="flex flex-wrap gap-1">${bsList.map(b => `<span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">${b}</span>`).join('')}</div>`;
    }

    tr.innerHTML = `
      <td class="p-2.5 font-mono font-bold text-slate-700">${u.usuario}</td>
      <td class="p-2.5 font-bold text-slate-800">${u.nombre} ${u.apellido || ''} ${u.id === authService.obtenerUsuarioActual().id ? '<span class="ml-1 px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded text-[9px]">Tú</span>' : ''}</td>
      <td class="p-2.5 text-slate-600">${u.email}</td>
      <td class="p-2.5 text-center">${roleControlHtml}</td>
      <td class="p-2.5">${bsHtml}</td>
      <td class="p-2.5 text-center font-semibold">${flags[u.idioma || 'es']}</td>
      <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded ${u.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'} text-[10px] font-bold">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td class="p-2.5 text-center">${deleteBtnHtml}</td>`;
    tbody.appendChild(tr);
  });
}

function renderizarSelectorBSUsuario(filtroTexto = '') {
  const container = document.getElementById('containerCheckboxesBS');
  if (!container) return;
  container.innerHTML = '';

  const clean = filtroTexto.toLowerCase().trim();
  const servicios = appState.businessServices;

  const filtrados = servicios.filter(s =>
    !clean || s.nombre.toLowerCase().includes(clean) || (s.pais && s.pais.toLowerCase().includes(clean))
  );

  filtrados.forEach(s => {
    const isChecked = bsSeleccionadosNuevoUsuario.includes(s.nombre) || bsSeleccionadosNuevoUsuario.includes('*');
    container.innerHTML += `
      <label class="flex items-center gap-2 p-1.5 rounded-lg border border-slate-200 hover:bg-blue-50/60 cursor-pointer text-xs">
        <input type="checkbox" value="${s.nombre}" ${isChecked ? 'checked' : ''} onchange="toggleBSSeleccionadoNuevoUsuario(this.value, this.checked)" class="rounded text-blue-600 focus:ring-0">
        <span class="truncate font-medium text-slate-800"><b class="text-blue-600 font-bold">[${s.pais || 'Global'}]</b> ${s.nombre}</span>
      </label>
    `;
  });

  actualizarTagsBSSeleccionados();
}

function filtrarListaBSUsuario(val) {
  renderizarSelectorBSUsuario(val);
}

function toggleBSSeleccionadoNuevoUsuario(bsNombre, isChecked) {
  if (isChecked) {
    if (!bsSeleccionadosNuevoUsuario.includes(bsNombre)) bsSeleccionadosNuevoUsuario.push(bsNombre);
  } else {
    bsSeleccionadosNuevoUsuario = bsSeleccionadosNuevoUsuario.filter(x => x !== bsNombre && x !== '*');
  }
  actualizarTagsBSSeleccionados();
}

function seleccionarTodosBS(seleccionar) {
  if (seleccionar) {
    bsSeleccionadosNuevoUsuario = appState.businessServices.map(x => x.nombre);
  } else {
    bsSeleccionadosNuevoUsuario = [];
  }
  renderizarSelectorBSUsuario();
}

function actualizarTagsBSSeleccionados() {
  const container = document.getElementById('containerTagsBSSeleccionados');
  if (!container) return;
  container.innerHTML = '';

  if (bsSeleccionadosNuevoUsuario.includes('*')) {
    container.innerHTML = `<span class="px-2 py-0.5 bg-blue-600 text-white rounded-md text-[10px] font-bold">🌐 Todos los Business Services seleccionados</span>`;
    return;
  }

  if (bsSeleccionadosNuevoUsuario.length === 0) {
    container.innerHTML = `<span class="text-[11px] text-slate-400 italic">Ningún Business Service seleccionado.</span>`;
    return;
  }

  bsSeleccionadosNuevoUsuario.forEach(bs => {
    container.innerHTML += `
      <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-md text-[10px] font-semibold">
        ${bs}
        <button type="button" onclick="toggleBSSeleccionadoNuevoUsuario('${bs}', false); renderizarSelectorBSUsuario();" class="hover:text-rose-600 text-slate-400">
          <i class="fa-solid fa-xmark text-[9px]"></i>
        </button>
      </span>
    `;
  });
}

async function handleCrearUsuarioSubmit(e) {
  e.preventDefault();
  if (!authService.esAdminBS()) {
    mostrarToast(t('toast.solo_admin'), 'warning');
    return;
  }

  const nombre = document.getElementById('inpNuevoNombre')?.value?.trim();
  const apellido = document.getElementById('inpNuevoApellido')?.value?.trim();
  const usuario = document.getElementById('inpNuevoUsuarioId')?.value?.trim();
  const email = document.getElementById('inpNuevoEmail')?.value?.trim();
  const pass = document.getElementById('inpNuevoPass')?.value;
  const passConf = document.getElementById('inpNuevoPassConf')?.value;
  const rol = document.getElementById('inpNuevoRol')?.value || 'Edición';
  const idioma = document.getElementById('inpNuevoIdioma')?.value || 'es';

  if (pass !== passConf) {
    mostrarToast('Las contraseñas no coinciden.', 'error');
    return;
  }

  if (pass.length < 8) {
    mostrarToast('La contraseña debe tener al menos 8 caracteres.', 'error');
    return;
  }

  if (rol !== 'Administrador' && bsSeleccionadosNuevoUsuario.length === 0) {
    mostrarToast('Debes seleccionar al menos un Business Service autorizado para este usuario.', 'error');
    return;
  }

  const businessServices = rol === 'Administrador' ? ['*'] : [...bsSeleccionadosNuevoUsuario];

  const res = await authService.crearUsuario({
    nombre, apellido, usuario, email, password: pass, rol, businessServices, idioma, activo: true
  });

  if (!res.exito) {
    mostrarToast(res.mensaje, 'error');
    return;
  }

  registrarAudit('USUARIOS', 'CREACIÓN_USUARIO', '(nuevo)', `${usuario} [${rol}] BS: ${businessServices.join(', ')}`);
  renderizarUsuarios();
  bsSeleccionadosNuevoUsuario = [];
  renderizarSelectorBSUsuario();
  e.target.reset();
  mostrarToast(`Usuario "${usuario}" registrado con éxito en base de datos ✅`, 'success');
}

async function handleCambiarRolUsuario(userId, nuevoRol) {
  if (!authService.esAdminGlobal()) {
    mostrarToast(t('toast.solo_admin'), 'warning');
    return;
  }
  const res = await authService.actualizarUsuario(userId, { rol: nuevoRol });
  if (res.exito) {
    registrarAudit('USUARIOS', `CAMBIO_ROL (${res.usuario.usuario})`, '—', nuevoRol);
    renderizarUsuarios();
    actualizarHeaderUsuario();
    aplicarPermisosUI();
    mostrarToast(`Rol actualizado a "${nuevoRol}"`, 'success');
  }
}

async function handleEliminarUsuario(userId) {
  if (!authService.esAdminGlobal()) {
    mostrarToast(t('toast.solo_admin'), 'warning');
    return;
  }
  const u = authService.usuarios.find(x => x.id === userId);
  if (!u) return;
  if (!confirm(`¿Estás seguro de eliminar permanentemente al usuario "${u.usuario}" de la base de datos?`)) return;

  const res = await authService.eliminarUsuario(userId);
  if (!res.exito) {
    mostrarToast(res.mensaje, 'error');
    return;
  }
  registrarAudit('USUARIOS', 'ELIMINACIÓN_USUARIO', u.usuario, '(eliminado)');
  renderizarUsuarios();
  mostrarToast(`Usuario "${u.usuario}" eliminado.`, 'warning');
}

// ============================================================
// PERFIL DE USUARIO
// ============================================================
function abrirModalPerfil() {
  const u = authService.obtenerUsuarioActual();
  document.getElementById('inpPerfilNombre').value = u.nombre || '';
  document.getElementById('inpPerfilApellido').value = u.apellido || '';
  document.getElementById('inpPerfilUsuario').value = u.usuario || '';
  document.getElementById('inpPerfilEmail').value = u.email || '';
  document.getElementById('inpPerfilIdioma').value = u.idioma || 'es';
  document.getElementById('badgeModalPerfilRol').textContent = u.rol || 'Lectura';
  document.getElementById('modalPerfil')?.classList.remove('hidden');
}

function fecharModalPerfil() {
  document.getElementById('modalPerfil')?.classList.add('hidden');
}

async function handleGuardarPerfilSubmit(e) {
  e.preventDefault();
  const u = authService.obtenerUsuarioActual();
  const nombre = document.getElementById('inpPerfilNombre')?.value?.trim();
  const apellido = document.getElementById('inpPerfilApellido')?.value?.trim();
  const idioma = document.getElementById('inpPerfilIdioma')?.value || 'es';

  const res = await authService.actualizarUsuario(u.id, { nombre, apellido, idioma });
  if (res.exito) {
    if (idioma !== idiomaActual && typeof cambiarIdiomaApp === 'function') {
      cambiarIdiomaApp(idioma);
    }
    actualizarHeaderUsuario();
    fecharModalPerfil();
    mostrarToast(t('toast.cambio_guardado'), 'success');
  }
}

function abrirModalCambiarPasswordVoluntario() {
  document.getElementById('alertaErrorPassVoluntario')?.classList.add('hidden');
  document.getElementById('inpVoluntarioActual').value = '';
  document.getElementById('inpVoluntarioNueva').value = '';
  document.getElementById('inpVoluntarioConf').value = '';
  document.getElementById('modalCambiarPassVoluntario')?.classList.remove('hidden');
}
function fecharModalCambiarPassVoluntario() {
  document.getElementById('modalCambiarPassVoluntario')?.classList.add('hidden');
}

async function handleCambiarPassVoluntarioSubmit(e) {
  e.preventDefault();
  const u = authService.obtenerUsuarioActual();
  const actual = document.getElementById('inpVoluntarioActual')?.value;
  const nueva = document.getElementById('inpVoluntarioNueva')?.value;
  const conf = document.getElementById('inpVoluntarioConf')?.value;
  const alerta = document.getElementById('alertaErrorPassVoluntario');

  if (nueva !== conf) {
    if (alerta) { alerta.textContent = 'Las contraseñas no coinciden.'; alerta.classList.remove('hidden'); }
    return;
  }

  const res = await authService.cambiarPassword(u.id, actual, nueva, false);
  if (!res.exito) {
    if (alerta) { alerta.textContent = res.mensaje; alerta.classList.remove('hidden'); }
    return;
  }

  fecharModalCambiarPassVoluntario();
  mostrarToast('Contraseña actualizada con éxito ✅', 'success');
}

// ============================================================
// BRANDING / LOGO CORPORATIVO
// ============================================================
let logoTempBase64 = null;

function renderizarBranding() {
  if (typeof brandingService !== 'undefined') brandingService.aplicarLogoEnDOM();
}

async function handleLogoFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    logoTempBase64 = await brandingService.procesarArchivoLogo(file);
    const container = document.getElementById('containerPreviewLogo');
    if (container) {
      container.innerHTML = `<img src="${logoTempBase64}" alt="Preview Logo" class="max-h-12 max-w-[180px] object-contain mx-auto" />`;
    }
    const btn = document.getElementById('btnAplicarLogo');
    if (btn) btn.disabled = false;
  } catch (err) {
    mostrarToast(err.message, 'error');
  }
}

async function aplicarNuevoLogo() {
  if (!authService.esAdminGlobal()) {
    mostrarToast(t('toast.solo_admin'), 'warning');
    return;
  }
  if (!logoTempBase64) return;
  await brandingService.guardarLogo(logoTempBase64);
  logoTempBase64 = null;
  const btn = document.getElementById('btnAplicarLogo');
  if (btn) btn.disabled = true;
  mostrarToast('Logo corporativo guardado en base de datos ✅', 'success');
}

async function restablecerLogoDefault() {
  if (!authService.esAdminGlobal()) {
    mostrarToast(t('toast.solo_admin'), 'warning');
    return;
  }
  await brandingService.restablecerLogoDefault();
  logoTempBase64 = null;
  const container = document.getElementById('containerPreviewLogo');
  if (container) {
    container.innerHTML = `<div class="app-branding-logo-container flex items-center justify-center"></div>`;
    brandingService.aplicarLogoEnDOM();
  }
  const btn = document.getElementById('btnAplicarLogo');
  if (btn) btn.disabled = true;
  mostrarToast('Logo predeterminado restablecido.', 'info');
}

// ============================================================
// CONFIGURACIÓN DE PAÍSES (UI)
// ============================================================
function renderizarConfigPaises() {
  const tbody=document.getElementById('tbodyConfigPaises'); if(!tbody) return;
  tbody.innerHTML='';
  const admin = authService.esAdminGlobal();
  const paises=obtenerTodosPaises();

  paises.forEach(p => {
    const tr=document.createElement('tr'); tr.className='border-b border-slate-100 text-xs hover:bg-slate-50';
    let horasInputHtml = '';
    let toggleActiveHtml = '';
    let deleteBtnHtml = '';

    if (admin) {
      horasInputHtml = `<input type="number" value="${p.horasDisponibles}" min="10" step="10"
        class="w-20 p-1 border border-slate-300 rounded text-center font-bold text-xs"
        onchange="onCambiarHorasPais('${p.key}',this.value)">`;
      toggleActiveHtml = `<label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" ${p.activo?'checked':''} class="sr-only peer" onchange="onTogglePaisActivo('${p.key}',this.checked)">
        <div class="w-9 h-5 bg-slate-300 peer-checked:bg-emerald-500 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
      </label>`;
      deleteBtnHtml = `<button onclick="onEliminarPais('${p.key}')" class="p-1 text-rose-500 hover:bg-rose-50 rounded" title="Eliminar país"><i class="fa-solid fa-trash-can text-[11px]"></i></button>`;
    } else {
      horasInputHtml = `<span class="font-bold text-xs">${p.horasDisponibles} h</span>`;
      toggleActiveHtml = `<span class="text-[10px] font-bold ${p.activo?'text-emerald-700':'text-slate-400'}">${p.activo?'Activo':'Inactivo'}</span>`;
    }

    tr.innerHTML=`<td class="p-2.5"><div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full" style="background:${p.color}"></span>
        <span class="font-bold text-slate-800">${p.nombre}</span></div></td>
      <td class="p-2.5 text-center">${horasInputHtml}</td>
      <td class="p-2.5 text-center font-bold text-slate-600">${REGLA_MAX_HORAS_CHANGE}h (global)</td>
      <td class="p-2.5 text-center">${toggleActiveHtml}</td>
      <td class="p-2.5 text-center">${deleteBtnHtml}</td>`;
    tbody.appendChild(tr);
  });
}

async function onCambiarHorasPais(key, val) {
  if (!authService.esAdminGlobal()) { mostrarToast(t('toast.solo_admin'), 'warning'); return; }
  await actualizarPais(key, parseInt(val));
  registrarAudit('CONFIG', `horasDisponibles (${key})`, '—', val);
  poblarFiltroPaises(); poblarSelectPaisFormulario();
  actualizarIndicadores();
  mostrarToast(`Horas de ${key} actualizadas a ${val}h en base de datos`, 'success');
}

async function onTogglePaisActivo(key, activo) {
  if (!authService.esAdminGlobal()) { mostrarToast(t('toast.solo_admin'), 'warning'); return; }
  await actualizarPais(key, undefined, undefined, activo);
  registrarAudit('CONFIG', `activo (${key})`, '—', activo?'Sí':'No');
  poblarFiltroPaises(); poblarSelectPaisFormulario();
  mostrarToast(`${key} ${activo?'activado':'desactivado'}`, 'info');
}

async function onEliminarPais(key) {
  if (!authService.esAdminGlobal()) { mostrarToast(t('toast.solo_admin'), 'warning'); return; }
  await handleEliminarPais(key);
  renderizarConfigPaises();
  poblarFiltroPaises();
  poblarSelectPaisFormulario();
}
async function onAgregarPais() {
  if (!authService.esAdminGlobal()) { mostrarToast(t('toast.solo_admin'), 'warning'); return; }
  const nombre = document.getElementById('inpNuevoPaisNombre')?.value?.trim();
  const horas = parseInt(document.getElementById('inpNuevoPaisHoras')?.value) || 100;
  const color = document.getElementById('inpNuevoPaisColor')?.value || '#64748b';
  if (!nombre) { mostrarToast('Ingresa el nombre del país','error'); return; }
  const ok = await agregarPais(nombre, horas, color);
  if (ok) {
    registrarAudit('CONFIG', 'agregarPais', '(nuevo)', `${nombre} (${horas}h)`);
    poblarFiltroPaises(); poblarSelectPaisFormulario();
    renderizarConfigPaises();
    document.getElementById('inpNuevoPaisNombre').value='';
    document.getElementById('inpNuevoPaisHoras').value='100';
    mostrarToast(`País "${nombre}" guardado en base de datos ✅`, 'success');
  } else {
    mostrarToast('Error al agregar país','error');
  }
}

// ============================================================
// FORMULARIO "+ CHANGE"
// ============================================================
function abrirModalNuevaChange() {
  if (!authService.puedeEditar()) {
    mostrarToast(t('toast.acceso_denegado'), 'warning');
    return;
  }
  document.getElementById('modalTitulo').textContent = t('form.titulo_nuevo');
  document.getElementById('modalSubtitulo').textContent = t('form.subtitulo_obligatorios');
  document.getElementById('formChange').reset();
  document.getElementById('spItemId').value = '';
  document.getElementById('d1').value = new Date().toISOString().split('T')[0];
  document.getElementById('inpPais').value = 'Brasil';
  document.getElementById('badgeModalSLA').classList.add('hidden');

  poblarSelectBSFormulario();
  poblarSelectProductosFormulario('Brasil');
  habilitarCamposFormulario(true);
  document.getElementById('btnGuardarModalChange').classList.remove('hidden');

  cargarPasosEnFormulario([]);
  actualizarBadgeModal();
  document.getElementById('modalChange').classList.remove('hidden');
}

function abrirModalEdicion(idOrSpId) {
  const ch = appState.changes.find(c => String(c.id||c.spId) === String(idOrSpId));
  if (!ch) return;

  if (!authService.tieneAccesoBusinessService(ch.businessService, ch.pais)) {
    mostrarToast('Acceso denegado: no tienes autorización para ver Changes de este Business Service.', 'error');
    registrarAudit('SEGURIDAD', 'INTENTO_ACCESO_NO_AUTORIZADO', ch.numeroChange, ch.businessService);
    return;
  }

  const editable = authService.puedeEditar();
  document.getElementById('modalTitulo').textContent = editable ? `${t('form.titulo_editar')}: ${ch.numeroChange}` : `${t('form.titulo_consulta')}: ${ch.numeroChange}`;
  document.getElementById('modalSubtitulo').textContent = editable ? 'Todos los campos están habilitados para edición' : 'Modo de solo lectura activo para este perfil';
  document.getElementById('spItemId').value = String(ch.id||ch.spId);

  const metricas = typeof obtenerMetricasSLA === 'function' ? obtenerMetricasSLA(ch) : {};
  const badgeSLAEl = document.getElementById('badgeModalSLA');
  if (badgeSLAEl) {
    badgeSLAEl.innerHTML = typeof generarBadgeSLAHTML === 'function' ? generarBadgeSLAHTML(metricas) : '';
    badgeSLAEl.classList.remove('hidden');
  }

  poblarSelectBSFormulario();
  poblarSelectProductosFormulario(ch.pais || 'Brasil');

  const sv = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };

  sv('inpSolicitante', ch.solicitante);
  sv('inpChange', ch.numeroChange);
  sv('inpBusinessService', ch.businessService);
  sv('inpDescricao', ch.descripcion);
  sv('inpEngenheiro', ch.engenheiro);

  sv('inpPais', ch.pais || 'Brasil');
  sv('inpRitm', ch.ritm);
  sv('inpProduto', ch.producto);
  sv('inpHorasEst', ch.horasEstimadas);
  sv('inpHorasApr', ch.horasAprovadas);
  sv('inpAnalise', ch.analise);
  sv('inpRollback', ch.rollback);
  sv('inpAprovadorNome', ch.aprovadorNome);
  sv('inpAprovadorEmail', ch.aprovadorEmail);
  sv('inpStatusAprov', ch.statusAprovacao);

  sv('d1', ch.d1); sv('d2', ch.d2); sv('d3', ch.d3); sv('d4', ch.d4);
  sv('d5', ch.d5); sv('d6', ch.d6); sv('d7', ch.d7); sv('d8', ch.d8);

  habilitarCamposFormulario(editable);

  const btnGuardar = document.getElementById('btnGuardarModalChange');
  if (btnGuardar) {
    if (editable) btnGuardar.classList.remove('hidden');
    else btnGuardar.classList.add('hidden');
  }

  cargarPasosEnFormulario(ch.pasosImplementacion || []);
  actualizarBadgeModal();
  document.getElementById('modalChange').classList.remove('hidden');
}

function habilitarCamposFormulario(habilitar) {
  const form = document.getElementById('formChange');
  if (!form) return;
  const inputs = form.querySelectorAll('input, select, textarea');
  inputs.forEach(el => {
    if (el.id === 'spItemId') return;
    if (habilitar) {
      el.removeAttribute('disabled');
      el.removeAttribute('readonly');
      el.classList.remove('bg-slate-100', 'text-slate-500');
    } else {
      el.setAttribute('disabled', 'true');
      el.classList.add('bg-slate-100', 'text-slate-500');
    }
  });

  const btnAddPaso = document.getElementById('btnAgregarPasoModal');
  if (btnAddPaso) {
    if (habilitar) btnAddPaso.classList.remove('hidden');
    else btnAddPaso.classList.add('hidden');
  }
}

function fecharModal() { document.getElementById('modalChange').classList.add('hidden'); }

function actualizarBadgeModal() {
  const h=parseFloat(document.getElementById('inpHorasEst')?.value||0);
  const badge=document.getElementById('badgeClassificacaoModal'); if(!badge) return;
  if (h<=REGLA_MAX_HORAS_CHANGE) {
    badge.textContent=`✅ MEJORA (${h}h ≤ ${REGLA_MAX_HORAS_CHANGE}h)`;
    badge.className='inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300';
  } else {
    badge.textContent=`⚠️ PROYECTO (${h}h > ${REGLA_MAX_HORAS_CHANGE}h — fuera de alcance)`;
    badge.className='inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300';
  }
}

async function salvarFormularioChange(event) {
  event.preventDefault();
  if (!authService.puedeEditar()) {
    mostrarToast(t('toast.acceso_denegado'), 'warning');
    return;
  }

  const id=document.getElementById('spItemId').value;
  const isUpdate=id!=='';
  const gv=elId=>{const el=document.getElementById(elId);return el?el.value.trim():'';};

  const solicitante = gv('inpSolicitante');
  const numeroChange = gv('inpChange');
  const businessService = gv('inpBusinessService');
  const shortDescription = gv('inpDescricao');
  const assignedTo = gv('inpEngenheiro');
  const pais = gv('inpPais') || 'Brasil';

  if (!solicitante || !numeroChange || !businessService || !shortDescription || !assignedTo) {
    mostrarToast('Por favor completa los 5 campos obligatorios: Solicitante, Number, Business Service, Short Description y Assigned To', 'error');
    return;
  }

  if (!authService.tieneAccesoBusinessService(businessService, pais)) {
    mostrarToast('No tienes autorización para crear o modificar Changes en este Business Service.', 'error');
    registrarAudit('SEGURIDAD', 'BLOQUEO_GUARDADO_BS', numeroChange, businessService);
    return;
  }

  const horasEst=parseFloat(gv('inpHorasEst'))||0;
  const horasApr=parseFloat(gv('inpHorasApr'))||0;
  const tipo=clasificarChange(horasEst);
  const pasos=obtenerPasosDesdeFormulario();
  const d1v=gv('d1');
  const user = authService.obtenerUsuarioActual().nombre || 'Usuario';

  const data={
    numeroChange,
    ritm: gv('inpRitm'),
    solicitante,
    pais,
    businessService,
    business_service: businessService,
    producto: gv('inpProduto') || 'General',
    descripcion: shortDescription,
    titulo: shortDescription,
    title: shortDescription,
    engenheiro: assignedTo,
    horasEstimadas: horasEst,
    horasAprovadas: horasApr,
    tipoChange: tipo,
    pasosImplementacion: pasos,
    analise: gv('inpAnalise'),
    rollback: gv('inpRollback'),
    aprovadorNome: gv('inpAprovadorNome'),
    aprovadorEmail: gv('inpAprovadorEmail'),
    statusAprovacao: gv('inpStatusAprov'),
    d1: d1v, d2: gv('d2'), d3: gv('d3'), d4: gv('d4'),
    d5: gv('d5'), d6: gv('d6'), d7: gv('d7'), d8: gv('d8'),
    ultimaModificacao: new Date().toISOString(),
    modificadoPor: user,
    mesAno: d1v ? d1v.substring(0,7) : appState.mesActivo,
  };
  data.faseAtual = determinarFasePorFechas(data);
  if (data.faseAtual === 'Concluida' && !data.fechaCierre) {
    data.fechaCierre = data.d8 || new Date().toISOString().split('T')[0];
  }

  const camposAudit=['numeroChange','solicitante','pais','businessService','producto','descripcion','engenheiro','horasEstimadas','horasAprovadas','statusAprovacao','faseAtual'];

  try {
    if (isUpdate) {
      const idx=appState.changes.findIndex(c=>String(c.id||c.spId)===String(id));
      if(idx!==-1){
        const prev=appState.changes[idx];
        registrarAuditCambios(data.numeroChange, prev, data, camposAudit);
        data.historialFases=prev.historialFases||[];
        data.teamsLink=prev.teamsLink||'';
        data.fechaCreacion=prev.fechaCreacion||d1v;
        data.id=prev.id;
        if (typeof apiClient !== 'undefined') await apiClient.updateChange(prev.id, data);
        appState.changes[idx]={...prev,...data};
        localStorage.setItem('nestle_changes_v4', JSON.stringify(appState.changes));
        mostrarToast(`Change ${data.numeroChange} actualizada en base de datos ✅`,'success');
      }
    } else {
      data.id=`CHG-${Date.now()}`;
      data.historialFases=[{de:'',a:data.faseAtual,fecha:new Date().toISOString().split('T')[0],usuario:user}];
      data.fechaCreacion=d1v||new Date().toISOString().split('T')[0];
      data.fechaCierre='';
      data.teamsLink=generarEnlaceTeams(data);
      if (typeof apiClient !== 'undefined') {
        const res = await apiClient.createChange(data);
        if (res && res.id) data.id = res.id;
      }
      appState.changes.unshift(data);
      localStorage.setItem('nestle_changes_v4', JSON.stringify(appState.changes));
      mostrarToast(`Change ${data.numeroChange} creada y guardada en base de datos ✅`,'success');
    }
  } catch (err) {
    console.error('[Save Change Error]', err);
    mostrarToast(err.message || 'Error al persistir Change', 'error');
  }

  fecharModal();
  renderizarTodo();
}

function determinarFasePorFechas(d) {
  if(d.d8) return 'Concluida'; if(d.d7) return 'Execucao'; if(d.d6) return 'Aprovacao';
  if(d.d5) return 'Apresentacao'; if(d.d4) return 'Comite'; if(d.d3) return 'Analise';
  if(d.d2) return 'Reuniao'; return 'Abertura';
}

function generarEnlaceTeams(ch) {
  const t=encodeURIComponent(`${ch.numeroChange} – ${(ch.descripcion||'').substring(0,50)} – ${ch.pais||''}`);
  return `https://teams.microsoft.com/l/chat/0/0?topicName=${t}`;
}

// ============================================================
// PASOS DE IMPLEMENTACIÓN
// ============================================================
function agregarFilaPaso(fase='',accion='',horas=0,fecha='') {
  const tbody=document.getElementById('tbodyPasosImplementacion'); if(!tbody) return;
  const tr=document.createElement('tr'); tr.className='border-b border-slate-100 hover:bg-slate-50';
  const opts=OPCIONES_PASOS.map(o=>`<option value="${o}" ${o===fase?'selected':''}>${o}</option>`).join('');
  const editAllowed = authService.puedeEditar();

  tr.innerHTML=`<td class="p-1.5"><select class="paso-fase-sel w-full py-1 px-1 border border-slate-200 rounded-lg text-[11px]" ${!editAllowed?'disabled':''}>${opts}</select></td>
    <td class="p-1.5"><input type="text" class="paso-accion-inp w-full py-1 px-1 border border-slate-200 rounded-lg text-[11px]" placeholder="Tarea..." value="${accion}" ${!editAllowed?'readonly':''}></td>
    <td class="p-1.5 text-center"><input type="number" class="paso-horas-inp w-14 py-1 px-1 border border-slate-200 rounded-lg text-[11px] text-center font-bold" min="0" step="0.5" value="${horas}" ${!editAllowed?'readonly':''} oninput="recalcularHorasDesdePasos()"></td>
    <td class="p-1.5"><input type="date" class="paso-fecha-inp w-full py-1 px-1 border border-slate-200 rounded-lg text-[11px]" value="${fecha}" ${!editAllowed?'readonly':''}></td>
    <td class="p-1.5 text-center">${editAllowed?`<button type="button" onclick="this.closest('tr').remove();recalcularHorasDesdePasos()" class="p-1 text-rose-500 hover:bg-rose-50 rounded text-[10px]"><i class="fa-solid fa-trash-can"></i></button>`:''}</td>`;
  tbody.appendChild(tr);
  recalcularHorasDesdePasos();
}

function recalcularHorasDesdePasos() {
  const t=[...document.querySelectorAll('.paso-horas-inp')].reduce((s,el)=>s+parseFloat(el.value||0),0);
  if(t>0){const inp=document.getElementById('inpHorasEst');if(inp){inp.value=t;actualizarBadgeModal();}}
}

function obtenerPasosDesdeFormulario() {
  return [...document.querySelectorAll('#tbodyPasosImplementacion tr')].map(tr=>({
    fase:tr.querySelector('.paso-fase-sel')?.value||'', accion:tr.querySelector('.paso-accion-inp')?.value||'',
    horas:parseFloat(tr.querySelector('.paso-horas-inp')?.value||0), fechaTentativa:tr.querySelector('.paso-fecha-inp')?.value||''
  })).filter(p=>p.accion||p.horas>0);
}

function cargarPasosEnFormulario(pasos) {
  const tbody=document.getElementById('tbodyPasosImplementacion'); if(!tbody) return;
  tbody.innerHTML='';
  if(Array.isArray(pasos)&&pasos.length>0) pasos.forEach(p=>agregarFilaPaso(p.fase,p.accion,p.horas,p.fechaTentativa));
  else { agregarFilaPaso('1. Análisis Técnico & Requerimientos','Levantamiento inicial',2,''); agregarFilaPaso('3. Desarrollo Backend / APIs','Implementación',8,''); agregarFilaPaso('6. Pruebas QA & Regresión','Pruebas',4,''); }
}

// ============================================================
// EXCEL IMPORT / EXPORT
// ============================================================
let excelParsedRows=[];

function abrirModalUploadExcel() {
  if (!authService.puedeEditar()) {
    mostrarToast(t('toast.acceso_denegado'), 'warning');
    return;
  }
  excelParsedRows=[];
  const inp=document.getElementById('inputExcelFile'); if(inp) inp.value='';
  document.getElementById('previewUploadContainer')?.classList.add('hidden');
  const btn=document.getElementById('btnConfirmarImportacion'); if(btn) btn.disabled=true;
  document.getElementById('modalUploadExcel')?.classList.remove('hidden');
}
function fecharModalUploadExcel() { document.getElementById('modalUploadExcel')?.classList.add('hidden'); }
function handleExcelFileSelect(e) { const f=e.target.files[0]; if(f) procesarArchivoExcel(f); }

function procesarArchivoExcel(file) {
  const r=new FileReader();
  r.onload=e=>{
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
      if(!rows.length){mostrarToast('Archivo vacío','error');return;}
      excelParsedRows=rows.map((r,i)=>mapearFila(r,i));
      mostrarPreview(excelParsedRows);
    }catch(err){mostrarToast('Error: '+err.message,'error');}
  };
  r.readAsArrayBuffer(file);
}

function mapearFila(row,idx) {
  const fv=(...keys)=>{for(const k of Object.keys(row)){const n=k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');if(keys.some(c=>n.includes(c)))return row[k];}return '';};
  const hE=parseFloat(fv('horas estimadas','horas est','horas')||0);
  const pais=fv('pais','country')||'Brasil';
  return {
    id:`CHG-IMP-${Date.now()}-${idx}`,spId:Date.now()+idx,
    numeroChange:String(fv('change','numero','chg','titulo')||`CHG-IMP-${String(idx+1).padStart(3,'0')}`).trim(),
    ritm:String(fv('ritm','requerimiento')||'').trim(),
    solicitante:String(fv('solicitante','requester')||'Sin solicitante').trim(), pais,
    businessService:String(fv('business service','servicio')||'E-Commerce & Sales Brasil').trim(),
    producto:String(fv('producto','product')||'General').trim(),
    descripcion:String(fv('descripcion','description','resumen','short description')||'Sin descripción').trim(),
    engenheiro:String(fv('ingeniero','engineer','responsable','assigned to')||'').trim(),
    horasEstimadas:hE, horasAprovadas:parseFloat(fv('horas aprov')||hE),
    tipoChange:clasificarChange(hE),
    faseAtual:normalizarFaseKey(String(fv('fase','status','estado')||'Abertura')),
    statusAprovacao:String(fv('aprobacion','aprovacao')||'Pendente'),
    analise:'',rollback:'',pasosImplementacion:[],aprovadorNome:'',aprovadorEmail:'',
    d1:new Date().toISOString().split('T')[0],d2:'',d3:'',d4:'',d5:'',d6:'',d7:'',d8:'',
    mesAno:appState.mesActivo, teamsLink:'',
    historialFases:[{de:'',a:'Abertura',fecha:new Date().toISOString().split('T')[0],usuario:'Importación'}],
    fechaCreacion:new Date().toISOString().split('T')[0],fechaCierre:'',
    ultimaModificacao:new Date().toISOString(),modificadoPor:authService.obtenerUsuarioActual().nombre
  };
}

function mostrarPreview(items) {
  const tbody=document.getElementById('tbodyPreviewExcel'); if(!tbody) return;
  tbody.innerHTML='';
  items.slice(0,8).forEach(it=>{
    const tr=document.createElement('tr'); tr.className='border-b border-slate-100 text-xs';
    tr.innerHTML=`<td class="p-1.5 font-bold">${it.numeroChange}</td><td class="p-1.5">${it.solicitante}</td><td class="p-1.5">${it.pais}</td><td class="p-1.5">${it.producto}</td><td class="p-1.5 text-center font-bold">${it.horasEstimadas}h</td>`;
    tbody.appendChild(tr);
  });
  setText('txtTotalImportar',`${items.length} registros`);
  document.getElementById('previewUploadContainer')?.classList.remove('hidden');
  const btn=document.getElementById('btnConfirmarImportacion'); if(btn) btn.disabled=false;
}

async function ejecutarImportacionExcel() {
  if (!authService.puedeEditar()) {
    mostrarToast(t('toast.acceso_denegado'), 'warning');
    return;
  }
  if(!excelParsedRows.length) return;

  mostrarToast('Importando registros a la base de datos...', 'info');
  for (const ch of excelParsedRows) {
    try { if (typeof apiClient !== 'undefined') await apiClient.createChange(ch); } catch (_) {}
  }

  await cargarDatos();
  fecharModalUploadExcel();
  renderizarTodo();
  mostrarToast(`${excelParsedRows.length} changes importadas a base de datos ✅`,'success');
}

function descargarPlantillaExcel() {
  const h=[['Número Change','RITM','Solicitante','País','Business Service','Producto','Short Description','Assigned To','Horas Estimadas','Horas Aprobadas','Fase Actual','Status Aprobación']];
  const ej=[['CHG0099100','RITM0155001','Andrés Delgado','Brasil','E-Commerce & Sales Brasil','Nescafé','Optimización checkout B2B','Carlos Mendoza',15,15,'Abertura','Pendente']];
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([...h,...ej]),'Plantilla');
  XLSX.writeFile(wb,'Plantilla_Changes.xlsx');
}

function exportarExcel() {
  const f=obtenerChangesFiltradas();
  const ws=[['Change','RITM','Solicitante','País','Business Service','Producto','Short Description','Assigned To','Horas Est.','Horas Apr.','Tipo','Fase','Status','Abertura','Reunião','Análise','Comitê','Apresentação','Aprovação','Execução','Conclusão']];
  f.forEach(c=>{const fo=FASES_KEY_MAP[c.faseAtual]; ws.push([c.numeroChange,c.ritm,c.solicitante,c.pais,c.businessService,c.producto,c.descripcion,c.engenheiro,c.horasEstimadas,c.horasAprovadas,c.tipoChange,t(fo?.labelKey||c.faseAtual),c.statusAprovacao,c.d1||'',c.d2||'',c.d3||'',c.d4||'',c.d5||'',c.d6||'',c.d7||'',c.d8||'']);});
  const wb=XLSX.utils.book_new(); const s=XLSX.utils.aoa_to_sheet(ws); s['!cols']=ws[0].map(()=>({wch:18}));
  XLSX.utils.book_append_sheet(wb,s,'Changes');
  XLSX.writeFile(wb,`Changes_${appState.filtroPais}_${appState.mesActivo}.xlsx`);
  mostrarToast('Excel descargado ✅','success');
}

// ============================================================
// ELIMINAR / EVENTOS
// ============================================================
async function eliminarChange(id) {
  if (!authService.puedeEditar()) {
    mostrarToast(t('toast.acceso_denegado'), 'warning');
    return;
  }
  if(!confirm('¿Eliminar esta Change permanentemente de la base de datos?')) return;
  const idx=appState.changes.findIndex(c=>String(c.id||c.spId)===String(id));
  if(idx!==-1){
    const ch=appState.changes[idx];
    if (!authService.tieneAccesoBusinessService(ch.businessService, ch.pais)) {
      mostrarToast('No tienes autorización para eliminar Changes de este Business Service.', 'error');
      return;
    }
    try {
      if (typeof apiClient !== 'undefined') await apiClient.deleteChange(ch.id);
      appState.changes.splice(idx,1);
      renderizarTodo();
      mostrarToast(`${ch.numeroChange} eliminada de base de datos`,'warning');
    } catch (err) {
      mostrarToast(err.message || 'Error al eliminar', 'error');
    }
  }
}

function configurarEventos() {
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click',()=>cambiarVista(btn.dataset.view));
  });
  const bind=(id,ev,fn)=>{const el=document.getElementById(id);if(el)el.addEventListener(ev,fn);};
  bind('inpBuscar','input',e=>{appState.filtroTexto=e.target.value;renderizarTodo();});
  bind('filtroSolicitante','change',e=>{appState.filtroSolicitante=e.target.value;renderizarTodo();});
  bind('filtroBusinessService','change',e=>{appState.filtroBusinessService=e.target.value;renderizarTodo();});
  bind('filtroProducto','change',e=>{appState.filtroProducto=e.target.value;renderizarTodo();});
  bind('filtroPais','change',e=>{appState.filtroPais=e.target.value;renderizarTodo();});
  bind('filtroStatus','change',e=>{appState.filtroStatus=e.target.value;renderizarTodo();});
  bind('selectorMes','change',e=>{appState.mesActivo=e.target.value;renderizarTodo();});
  bind('inpHorasEst','input',actualizarBadgeModal);

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      fecharModal();
      fecharModalPerfil();
      fecharModalUploadExcel();
      fecharModalOlvidoPassword();
      fecharModalLogoutConfirm();
      fecharModalCambiarPassVoluntario();
      fecharModalCrearRapidoBS();
      fecharModalAdminBS();
      fecharModalCrearRapidoPais();
      fecharModalAdminPaises();
      fecharModalCrearRapidoProducto();
      fecharModalAdminProductos();
    }
  });

  const dz=document.getElementById('uploadDropzone');
  if(dz){
    ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();if(authService.puedeEditar())dz.classList.add('drag-active');}));
    ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag-active');}));
    dz.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)procesarArchivoExcel(f);});
  }
}

function cambiarVista(vista) {
  if ((vista === 'usuarios' || vista === 'branding') && !authService.esAdminBS()) {
    mostrarToast(t('toast.solo_admin'), 'warning');
    return;
  }

  appState.vistaActiva = vista;

  // Esconde todas as seções e views
  document.querySelectorAll('.secao-view, .tab-content').forEach(el => el.classList.add('hidden'));

  // Exibe a seção clicada
  const elAtivo = document.getElementById(`view-${vista}`) || document.getElementById(`secao${vista.charAt(0).toUpperCase() + vista.slice(1)}`);
  if (elAtivo) {
    elAtivo.classList.remove('hidden');
  }

  // Destaca o botão ativo na barra superior
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const act = btn.dataset.view === vista;
    btn.className = `tab-btn py-1.5 px-3 font-${act ? 'bold text-blue-600 border-b-2 border-blue-600' : 'semibold text-slate-500 hover:text-slate-700 border-b-2 border-transparent'} text-xs flex items-center gap-1.5`;
  });

  // Carrega e renderiza as listas de Business Services e Produtos
  if (vista === 'bs' || vista === 'productos') {
    if (typeof renderizarListasBSYProductos === 'function') {
      renderizarListasBSYProductos();
    }
  }
}

function setIndicadorSync(st) {
  const el=document.getElementById('indicadorSync'); if(!el) return;
  const h=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  if(st==='live'){el.className='status-pill-live px-2 rounded-full text-[10px] font-semibold flex items-center gap-1';el.innerHTML=`<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span><i class="fa-solid fa-database text-emerald-600"></i> Online (${h})`;}
  else if(st==='syncing'){el.className='status-pill-syncing px-2 rounded-full text-[10px] font-semibold flex items-center gap-1';el.innerHTML=`<i class="fa-solid fa-rotate fa-spin text-blue-600"></i> Guardando...`;}
  else{el.className='status-pill-offline px-2 rounded-full text-[10px] font-semibold flex items-center gap-1';el.innerHTML=`<i class="fa-solid fa-circle-exclamation text-amber-600"></i> Local / Offline`;}
}

function mostrarToast(msg,tipo='info') {
  const c=document.getElementById('toast-container'); if(!c) return;
  const t=document.createElement('div');
  const icons={success:'fa-check-circle text-emerald-500',warning:'fa-triangle-exclamation text-amber-500',error:'fa-circle-xmark text-rose-500',info:'fa-info-circle text-blue-500'};
  t.className=`toast toast-${tipo}`;
  t.innerHTML=`<i class="fa-solid ${icons[tipo]||icons.info} text-base shrink-0"></i><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(()=>{t.style.cssText='opacity:0;transform:translateY(10px);transition:all .3s';setTimeout(()=>t.remove(),300);},4000);
}
// ==========================================
// GESTÃO DE BUSINESS SERVICES E PRODUCTOS (INCLUIR / EDITAR / EXCLUIR)
// ==========================================

// 1. Renderizar listas nas abas
function renderizarListasBSYProductos() {
  const contBS = document.getElementById('contenedorTabBS');
  const contProd = document.getElementById('contenedorTabProductos');
  const selBS = document.getElementById('selTabBSParaProducto');

  // Renderizar Business Services
  if (contBS && typeof BUSINESS_SERVICES !== 'undefined') {
    contBS.innerHTML = BUSINESS_SERVICES.map(bs => `
      <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
        <span class="text-xs font-bold text-slate-700">${bs}</span>
        <div class="flex gap-1">
          <button onclick="editarBS('${bs}')" class="p-1 text-slate-400 hover:text-blue-600 text-xs"><i class="fa-solid fa-pen"></i></button>
          <button onclick="eliminarBS('${bs}')" class="p-1 text-slate-400 hover:text-rose-600 text-xs"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  // Preencher Select de BS na aba de Produtos
  if (selBS && typeof BUSINESS_SERVICES !== 'undefined') {
    selBS.innerHTML = '<option value="">Selecciona Business Service...</option>' + 
      BUSINESS_SERVICES.map(bs => `<option value="${bs}">${bs}</option>`).join('');
  }

  // Renderizar Produtos
  if (contProd && typeof PRODUCTOS_POR_BS !== 'undefined') {
    let html = '';
    Object.keys(PRODUCTOS_POR_BS).forEach(bs => {
      PRODUCTOS_POR_BS[bs].forEach(prod => {
        html += `
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
            <div>
              <span class="block text-xs font-bold text-slate-700">${prod}</span>
              <span class="block text-[10px] text-slate-400">BS: ${bs}</span>
            </div>
            <div class="flex gap-1">
              <button onclick="eliminarProducto('${bs}', '${prod}')" class="p-1 text-slate-400 hover:text-rose-600 text-xs"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        `;
      });
    });
    contProd.innerHTML = html || '<p class="text-xs text-slate-400">Nenhum produto cadastrado.</p>';
  }
}
// Função para adicionar novo Business Service na aba
async function agregarBSDesdeTab() {
  const inp = document.getElementById('inpTabNuevoBS');
  const nome = inp ? inp.value.trim() : '';
  if (!nome) {
    if (typeof mostrarToast === 'function') mostrarToast('Digite o nome do Business Service', 'warning');
    else alert('Digite o nome do Business Service');
    return;
  }

  if (typeof BUSINESS_SERVICES === 'undefined' || !Array.isArray(BUSINESS_SERVICES)) {
    const bsSaved = localStorage.getItem('nestle_bs_v4');
    window.BUSINESS_SERVICES = bsSaved ? JSON.parse(bsSaved) : ["Finance", "Supply Chain", "HR", "IT", "Sales & Marketing"];
  }

  if (!BUSINESS_SERVICES.includes(nome)) {
    BUSINESS_SERVICES.push(nome);
    localStorage.setItem('nestle_bs_v4', JSON.stringify(BUSINESS_SERVICES));
    inp.value = '';
    if (typeof renderizarListasBSYProductos === 'function') renderizarListasBSYProductos();
    if (typeof poblarSelects === 'function') poblarSelects();
    if (typeof mostrarToast === 'function') mostrarToast(`Business Service "${nome}" adicionado!`, 'success');
  } else {
    if (typeof mostrarToast === 'function') mostrarToast('Este Business Service já existe.', 'warning');
  }
}
// Função para Editar nome do Business Service
async function editarBS(nomeAntigo) {
  const novoNome = prompt('Editar Business Service:', nomeAntigo);
  if (!novoNome || novoNome.trim() === '' || novoNome.trim() === nomeAntigo) return;

  const idx = BUSINESS_SERVICES.indexOf(nomeAntigo);
  if (idx !== -1) {
    BUSINESS_SERVICES[idx] = novoNome.trim();
    localStorage.setItem('nestle_bs_v4', JSON.stringify(BUSINESS_SERVICES));
    if (typeof renderizarListasBSYProductos === 'function') renderizarListasBSYProductos();
    if (typeof poblarSelects === 'function') poblarSelects();
    if (typeof mostrarToast === 'function') mostrarToast('Business Service atualizado!', 'success');
  }
}

// Função para Eliminar Business Service
async function eliminarBS(nome) {
  if (!confirm(`Deseja realmente eliminar o Business Service "${nome}"?`)) return;

  const idx = BUSINESS_SERVICES.indexOf(nome);
  if (idx !== -1) {
    BUSINESS_SERVICES.splice(idx, 1);
    localStorage.setItem('nestle_bs_v4', JSON.stringify(BUSINESS_SERVICES));
    if (typeof renderizarListasBSYProductos === 'function') renderizarListasBSYProductos();
    if (typeof poblarSelects === 'function') poblarSelects();
    if (typeof mostrarToast === 'function') mostrarToast(`"${nome}" eliminado com sucesso!`, 'warning');
  }
}
// Função para Adicionar Novo Produto na aba
async function agregarProductoDesdeTab() {
  const inpProd = document.getElementById('inpTabNuevoProducto');
  const prod = inpProd ? inpProd.value.trim() : '';

  if (!prod) {
    if (typeof mostrarToast === 'function') mostrarToast('Digite o nome do Produto', 'warning');
    else alert('Digite o nome do Produto');
    return;
  }

  // Garante inicialização da lista de produtos se não existir
  if (typeof PRODUCTOS_LISTA === 'undefined' || !Array.isArray(PRODUCTOS_LISTA)) {
    const prodSaved = localStorage.getItem('nestle_productos_v4');
    window.PRODUCTOS_LISTA = prodSaved ? JSON.parse(prodSaved) : ["Accounts Payable", "Logistics", "Payroll", "Software Support"];
  }

  if (!PRODUCTOS_LISTA.includes(prod)) {
    PRODUCTOS_LISTA.push(prod);
    localStorage.setItem('nestle_productos_v4', JSON.stringify(PRODUCTOS_LISTA));
    inpProd.value = '';
    if (typeof renderizarListasBSYProductos === 'function') renderizarListasBSYProductos();
    if (typeof poblarSelects === 'function') poblarSelects();
    if (typeof mostrarToast === 'function') mostrarToast(`Produto "${prod}" adicionado!`, 'success');
  } else {
    if (typeof mostrarToast === 'function') mostrarToast('Este produto já existe.', 'warning');
  }
}

// Função para Eliminar Produto
async function eliminarProducto(prod) {
  if (!confirm(`Deseja realmente eliminar o produto "${prod}"?`)) return;

  if (typeof PRODUCTOS_LISTA !== 'undefined' && Array.isArray(PRODUCTOS_LISTA)) {
    window.PRODUCTOS_LISTA = PRODUCTOS_LISTA.filter(p => p !== prod);
    localStorage.setItem('nestle_productos_v4', JSON.stringify(PRODUCTOS_LISTA));
    if (typeof renderizarListasBSYProductos === 'function') renderizarListasBSYProductos();
    if (typeof poblarSelects === 'function') poblarSelects();
    if (typeof mostrarToast === 'function') mostrarToast(`Produto "${prod}" eliminado!`, 'warning');
  }
}
// Função para Adicionar Novo Produto (Independente)
async function agregarProductoDesdeTab() {
  const inpProd = document.getElementById('inpTabNuevoProducto');
  const prod = inpProd ? inpProd.value.trim() : '';

  if (!prod) {
    if (typeof mostrarToast === 'function') mostrarToast('Digite o nome do Produto', 'warning');
    else alert('Digite o nome do Produto');
    return;
  }

  if (typeof PRODUCTOS_LISTA === 'undefined' || !Array.isArray(PRODUCTOS_LISTA)) {
    const prodSaved = localStorage.getItem('nestle_productos_v4');
    window.PRODUCTOS_LISTA = prodSaved ? JSON.parse(prodSaved) : ["Accounts Payable", "Logistics", "Payroll", "Software Support"];
  }

  if (!PRODUCTOS_LISTA.includes(prod)) {
    PRODUCTOS_LISTA.push(prod);
    localStorage.setItem('nestle_productos_v4', JSON.stringify(PRODUCTOS_LISTA));
    inpProd.value = '';
    if (typeof renderizarListasBSYProductos === 'function') renderizarListasBSYProductos();
    if (typeof poblarSelects === 'function') poblarSelects();
    if (typeof mostrarToast === 'function') mostrarToast(`Produto "${prod}" adicionado!`, 'success');
  } else {
    if (typeof mostrarToast === 'function') mostrarToast('Este produto já existe.', 'warning');
  }
}

// Função para Eliminar Produto
async function eliminarProducto(prod) {
  if (!confirm(`Deseja realmente eliminar o produto "${prod}"?`)) return;

  if (typeof PRODUCTOS_LISTA !== 'undefined' && Array.isArray(PRODUCTOS_LISTA)) {
    window.PRODUCTOS_LISTA = PRODUCTOS_LISTA.filter(p => p !== prod);
    localStorage.setItem('nestle_productos_v4', JSON.stringify(PRODUCTOS_LISTA));
    if (typeof renderizarListasBSYProductos === 'function') renderizarListasBSYProductos();
    if (typeof poblarSelects === 'function') poblarSelects();
    if (typeof mostrarToast === 'function') mostrarToast(`Produto "${prod}" eliminado!`, 'warning');
  }
}
// Sobrescreve a renderização para exibir os produtos da lista simples
function renderizarListasBSYProductos() {
  // Renderiza Business Services
  const contBS = document.getElementById('contenedorTabBS');
  if (contBS && typeof BUSINESS_SERVICES !== 'undefined') {
    contBS.innerHTML = BUSINESS_SERVICES.map(bs => `
      <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center shadow-sm">
        <span class="text-xs font-bold text-slate-700">${bs}</span>
        <div class="flex gap-1">
          <button type="button" onclick="editarBS('${bs}')" class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs transition-all"><i class="fa-solid fa-pen"></i></button>
          <button type="button" onclick="eliminarBS('${bs}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs transition-all"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  // Renderiza Produtos
  const contProd = document.getElementById('contenedorTabProductos');
  if (contProd) {
    if (typeof PRODUCTOS_LISTA === 'undefined' || !Array.isArray(PRODUCTOS_LISTA)) {
      const prodSaved = localStorage.getItem('nestle_productos_v4');
      window.PRODUCTOS_LISTA = prodSaved ? JSON.parse(prodSaved) : ["Accounts Payable", "Logistics", "Payroll", "Software Support"];
    }

    if (PRODUCTOS_LISTA.length === 0) {
      contProd.innerHTML = '<p class="text-xs text-slate-400 col-span-3">Nenhum produto cadastrado.</p>';
    } else {
      contProd.innerHTML = PRODUCTOS_LISTA.map(prod => `
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center shadow-sm">
          <span class="text-xs font-bold text-slate-700">${prod}</span>
          <button type="button" onclick="eliminarProducto('${prod}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs transition-all" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </div>
      `).join('');
    }
  }
}
// Garantir que os Business Services salvos sejam carregados ao iniciar a página
(function inicializarBSPersistente() {
  const bsSalvos = localStorage.getItem('nestle_bs_v4');
  if (bsSalvos) {
    try {
      window.BUSINESS_SERVICES = JSON.parse(bsSalvos);
    } catch(e) {
      console.error("Erro ao carregar Business Services do localStorage", e);
    }
  }
})();
// ==========================================
// MÓDULO DE PAÍSES (PERSISTENTE - CRUD)
// ==========================================

// Inicializar Países do localStorage
(function inicializarPaisesPersistentes() {
  const paisesSalvos = localStorage.getItem('nestle_paises_v4');
  if (paisesSalvos) {
    try {
      window.PAISES_CONFIG = JSON.parse(paisesSalvos);
    } catch(e) {
      console.error("Erro ao carregar Países", e);
    }
  } else if (typeof PAISES_CONFIG === 'undefined' || !Array.isArray(PAISES_CONFIG)) {
    window.PAISES_CONFIG = [
      { id: '1', nombre: 'Perú', horas: 100, maxChange: 30, color: '#0891b2', activo: true },
      { id: '2', nombre: 'Ecuador', horas: 120, maxChange: 30, color: '#059669', activo: true }
    ];
  }
})();

// Função para Renderizar a Tabela de Países
function renderizarTablaPaises() {
  const tbody = document.getElementById('tbodyConfigPaises');
  if (!tbody) return;

  if (!Array.isArray(PAISES_CONFIG) || PAISES_CONFIG.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-3 text-center text-slate-400">Nenhum país cadastrado.</td></tr>';
    return;
  }

  tbody.innerHTML = PAISES_CONFIG.map(p => `
    <tr>
      <td class="p-2.5 font-bold text-slate-700">${p.nombre}</td>
      <td class="p-2.5 text-center">
        <input type="number" value="${p.horas}" onchange="modificarHorasPais('${p.id}', this.value)" class="w-20 text-center p-1 border border-slate-300 rounded font-bold text-xs">
      </td>
      <td class="p-2.5 text-center font-semibold text-slate-500">${p.maxChange || 30}h</td>
      <td class="p-2.5 text-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${p.activo !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}">
          ${p.activo !== false ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td class="p-2.5 text-center">
        <button type="button" onclick="eliminarPais('${p.id}')" class="p-1 text-slate-400 hover:text-rose-600 transition-all" title="Eliminar País">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// Função para Agregar Novo País
async function onAgregarPais() {
  const inpNombre = document.getElementById('inpNuevoPaisNombre');
  const inpHoras = document.getElementById('inpNuevoPaisHoras');
  const inpColor = document.getElementById('inpNuevoPaisColor');

  const nombre = inpNombre ? inpNombre.value.trim() : '';
  const horas = inpHoras ? parseInt(inpHoras.value) : 100;
  const color = inpColor ? inpColor.value : '#0891b2';

  if (!nombre) {
    if (typeof mostrarToast === 'function') mostrarToast('Digite o nome do país', 'warning');
    else alert('Digite o nome do país');
    return;
  }

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

  if (inpNombre) inpNombre.value = '';
  renderizarTablaPaises();
  if (typeof poblarSelects === 'function') poblarSelects();
  if (typeof mostrarToast === 'function') mostrarToast(`País "${nombre}" adicionado!`, 'success');
}

// Alias de suporte para o botão caso chame agregarNuevoPais
function agregarNuevoPais() { onAgregarPais(); }

// Função para Modificar Horas do País
function modificarHorasPais(id, novasHoras) {
  const pais = PAISES_CONFIG.find(p => p.id === id);
  if (pais) {
    pais.horas = parseInt(novasHoras) || 0;
    localStorage.setItem('nestle_paises_v4', JSON.stringify(PAISES_CONFIG));
    if (typeof mostrarToast === 'function') mostrarToast('Horas atualizadas!', 'success');
  }
}

// Função para Eliminar País
function eliminarPais(id) {
  const pais = PAISES_CONFIG.find(p => p.id === id);
  const nombre = pais ? pais.nombre : '';
  if (!confirm(`Deseja realmente eliminar o país "${nombre}"?`)) return;

  PAISES_CONFIG = PAISES_CONFIG.filter(p => p.id !== id);
  localStorage.setItem('nestle_paises_v4', JSON.stringify(PAISES_CONFIG));
  renderizarTablaPaises();
  if (typeof poblarSelects === 'function') poblarSelects();
  if (typeof mostrarToast === 'function') mostrarToast(`País removido!`, 'warning');
}
// Garantir que a renderização dos países atualizada seja chamada ao abrir a aba e no carregamento
(function conectarRenderizadorPaises() {
  const originalCambiarVista = window.cambiarVista;
  window.cambiarVista = function(vista) {
    if (typeof originalCambiarVista === 'function') {
      originalCambiarVista(vista);
    }
    if (vista === 'config') {
      renderizarTablaPaises();
    }
  };

  // Carrega a tabela na inicialização imediata
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderizarTablaPaises);
  } else {
    renderizarTablaPaises();
  }
})();
// ==========================================
// PREENCHIMENTO DINÂMICO DO SELECT DE BUSINESS SERVICE NO MODAL
// ==========================================

// Função para atualizar o dropdown de Business Services no modal de Nova Change
function actualizarSelectBSModal() {
  const selectBS = document.querySelector('select[name="business_service"]') || document.getElementById('selBusinessService') || document.querySelector('select:has(option[value="Finance"])');

  // Recupera do localStorage ou da variável global
  const listaBS = (typeof BUSINESS_SERVICES !== 'undefined' && Array.isArray(BUSINESS_SERVICES)) 
    ? BUSINESS_SERVICES 
    : JSON.parse(localStorage.getItem('nestle_bs_v4')) || ["Finance", "Supply Chain", "HR", "IT", "Sales & Marketing"];

  // Localiza todos os selects de Business Service dentro de modais
  const todosSelectsBS = document.querySelectorAll('select');
  todosSelectsBS.forEach(sel => {
    // Verifica se é o select de Business Service pelo contexto de opções ou ID
    if (sel.id.toLowerCase().includes('bs') || sel.name === 'business_service' || Array.from(sel.options).some(opt => opt.value === 'Finance' || opt.text === 'Finance')) {
      const valorAtual = sel.value;
      sel.innerHTML = '<option value="">Selecciona Business Service...</option>' + 
        listaBS.map(bs => `<option value="${bs}">${bs}</option>`).join('');
      if (valorAtual && listaBS.includes(valorAtual)) {
        sel.value = valorAtual;
      }
    }
  });
}

// Conecta o preenchimento ao abrir o modal de Nova Change
(function conectarModalBS() {
  const originalAbrirModal = window.abrirModalNuevoChange || window.abrirModalChange;
  if (typeof originalAbrirModal === 'function') {
    window.abrirModalNuevoChange = function() {
      originalAbrirModal();
      actualizarSelectBSModal();
    };
  }

  // Intercepta qualquer clique em botões de "+ Change" ou no atalho "+ Nuevo" de BS
  document.addEventListener('click', function(e) {
    // Se clicar no atalho + Nuevo de Business Service
    if (e.target && (e.target.innerText === '+ Nuevo' || e.target.textContent.includes('+ Nuevo'))) {
      const containerBS = e.target.closest('div');
      if (containerBS && containerBS.innerText.includes('Business Service')) {
        e.preventDefault();
        // Se estiver num modal, fecha o modal primeiro se existir
        const modal = e.target.closest('.modal, [id*="modal"]');
        if (modal) modal.classList.add('hidden');
        // Redireciona para a aba de Business Services
        if (typeof cambiarVista === 'function') cambiarVista('bs');
      }
    }

    // Se abrir o modal de nova change, atualiza as opções
    const btnChange = e.target.closest('#btnNuevaChange, [onclick*="abrirModal"]');
    if (btnChange) {
      setTimeout(actualizarSelectBSModal, 100);
    }
  });
})();
// ==========================================
// SINCRONIZAÇÃO DO MODAL POP-UP DE NUEVO BUSINESS SERVICE
// ==========================================

// Função para preencher todos os selects de Business Service da tela e do modal
function poblarSelectsBSGlobal() {
  const listaBS = (typeof BUSINESS_SERVICES !== 'undefined' && Array.isArray(BUSINESS_SERVICES)) 
    ? BUSINESS_SERVICES 
    : JSON.parse(localStorage.getItem('nestle_bs_v4')) || ["Finance", "Supply Chain", "HR", "IT", "Sales & Marketing"];

  // Procura todos os dropdowns de Business Service no formulário e no popup
  document.querySelectorAll('select').forEach(sel => {
    const isSelectBS = sel.id.toLowerCase().includes('bs') || 
                       sel.name === 'business_service' || 
                       sel.previousElementSibling?.textContent.includes('Business Service') ||
                       Array.from(sel.options).some(opt => opt.value === 'Finance' || opt.text === 'Finance');

    if (isSelectBS) {
      const valorAtual = sel.value;
      sel.innerHTML = '<option value="">Selecciona Business Service...</option>' + 
        listaBS.map(bs => `<option value="${bs}">${bs}</option>`).join('');
      if (valorAtual && listaBS.includes(valorAtual)) {
        sel.value = valorAtual;
      }
    }
  });
}

// Intercepta a abertura do modal e o clique no botão "Guardar en Base de Datos" do pop-up
document.addEventListener('click', function(e) {
  // Quando clica no botão "Guardar en Base de Datos" do pop-up de Novo Business Service
  const btnGuardarPopUp = e.target.closest('button');
  if (btnGuardarPopUp && (btnGuardarPopUp.textContent.includes('Guardar en Base de Datos') || btnGuardarPopUp.textContent.includes('Guardar'))) {
    const modalPopUp = btnGuardarPopUp.closest('.modal, [id*="modal"], div[class*="fixed"]');
    if (modalPopUp && modalPopUp.textContent.includes('Nuevo Business Service')) {
      const inputNome = modalPopUp.querySelector('input[type="text"]');
      const nomeNovo = inputNome ? inputNome.value.trim() : '';

      if (nomeNovo) {
        if (typeof BUSINESS_SERVICES === 'undefined' || !Array.isArray(BUSINESS_SERVICES)) {
          window.BUSINESS_SERVICES = JSON.parse(localStorage.getItem('nestle_bs_v4')) || ["Finance", "Supply Chain", "HR", "IT", "Sales & Marketing"];
        }

        if (!BUSINESS_SERVICES.includes(nomeNovo)) {
          BUSINESS_SERVICES.push(nomeNovo);
          localStorage.setItem('nestle_bs_v4', JSON.stringify(BUSINESS_SERVICES));
          
          // Atualiza as listas na aba administrativa e nos formulários
          if (typeof renderizarListasBSYProductos === 'function') renderizarListasBSYProductos();
          poblarSelectsBSGlobal();

          // Limpa o input e fecha o pop-up
          inputNome.value = '';
          modalPopUp.classList.add('hidden');
          if (typeof mostrarToast === 'function') mostrarToast(`Business Service "${nomeNovo}" guardado!`, 'success');
        }
      }
    }
  }

  // Se abrir o modal de Nova Change, recarrega as opções do select
  if (e.target.closest('#btnNuevaChange, [onclick*="abrirModal"]')) {
    setTimeout(poblarSelectsBSGlobal, 150);
  }
});

// Atualiza os selects ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(poblarSelectsBSGlobal, 500);
});
// ==========================================
// SINCRONIZAÇÃO DO CAMPO & POP-UP DE PRODUCTO
// ==========================================

// Função para preencher os dropdowns de Produto com a lista independente
function poblarSelectsProductosGlobal() {
  const listaProd = (typeof PRODUCTOS_LISTA !== 'undefined' && Array.isArray(PRODUCTOS_LISTA)) 
    ? PRODUCTOS_LISTA 
    : JSON.parse(localStorage.getItem('nestle_productos_v4')) || ["Accounts Payable", "Logistics", "Payroll", "Software Support"];

  document.querySelectorAll('select').forEach(sel => {
    const isSelectProd = sel.id.toLowerCase().includes('producto') || 
                        sel.name === 'producto' || 
                        sel.previousElementSibling?.textContent.includes('Producto') ||
                        Array.from(sel.options).some(opt => opt.value === 'Logistics' || opt.text === 'Logistics');

    if (isSelectProd) {
      const valorAtual = sel.value;
      sel.innerHTML = '<option value="">Selecciona Producto...</option>' + 
        listaProd.map(prod => `<option value="${prod}">${prod}</option>`).join('');
      if (valorAtual && listaProd.includes(valorAtual)) {
        sel.value = valorAtual;
      }
    }
  });
}

// Intercepta a abertura e o salvamento pelo pop-up "Nuevo Producto"
document.addEventListener('click', function(e) {
  const btnGuardarPopUp = e.target.closest('button');
  if (btnGuardarPopUp && (btnGuardarPopUp.textContent.includes('Guardar en Base de Datos') || btnGuardarPopUp.textContent.includes('Guardar'))) {
    const modalPopUp = btnGuardarPopUp.closest('.modal, [id*="modal"], div[class*="fixed"]');
    if (modalPopUp && (modalPopUp.textContent.includes('Nuevo Producto') || modalPopUp.textContent.includes('Producto / Línea'))) {
      const inputNome = modalPopUp.querySelector('input[type="text"]');
      const nomeNovo = inputNome ? inputNome.value.trim() : '';

      if (nomeNovo) {
        if (typeof PRODUCTOS_LISTA === 'undefined' || !Array.isArray(PRODUCTOS_LISTA)) {
          window.PRODUCTOS_LISTA = JSON.parse(localStorage.getItem('nestle_productos_v4')) || ["Accounts Payable", "Logistics", "Payroll", "Software Support"];
        }

        if (!PRODUCTOS_LISTA.includes(nomeNovo)) {
          PRODUCTOS_LISTA.push(nomeNovo);
          localStorage.setItem('nestle_productos_v4', JSON.stringify(PRODUCTOS_LISTA));
          
          if (typeof renderizarListasBSYProductos === 'function') renderizarListasBSYProductos();
          poblarSelectsProductosGlobal();

          inputNome.value = '';
          modalPopUp.classList.add('hidden');
          if (typeof mostrarToast === 'function') mostrarToast(`Produto "${nomeNovo}" guardado!`, 'success');
        }
      }
    }
  }

  if (e.target.closest('#btnNuevaChange, [onclick*="abrirModal"]')) {
    setTimeout(poblarSelectsProductosGlobal, 150);
  }
});

// Atualiza os selects ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(poblarSelectsProductosGlobal, 500);
});
// ==========================================
// SINCRONIZAÇÃO DO CAMPO & POP-UP DE PAÍS / MERCADO
// ==========================================

// Função para preencher os dropdowns de País com a lista dinâmica
function poblarSelectsPaisesGlobal() {
  const listaPaises = (typeof PAISES_CONFIG !== 'undefined' && Array.isArray(PAISES_CONFIG)) 
    ? PAISES_CONFIG 
    : JSON.parse(localStorage.getItem('nestle_paises_v4')) || [
        { id: '1', nombre: 'Perú', horas: 100, maxChange: 30, color: '#0891b2', activo: true },
        { id: '2', nombre: 'Ecuador', horas: 120, maxChange: 30, color: '#059669', activo: true }
      ];

  document.querySelectorAll('select').forEach(sel => {
    const isSelectPais = sel.id.toLowerCase().includes('pais') || 
                         sel.name === 'pais' || 
                         sel.previousElementSibling?.textContent.includes('País') ||
                         Array.from(sel.options).some(opt => opt.value === 'Perú' || opt.text === 'Perú' || opt.value === 'Brasil');

    if (isSelectPais) {
      const valorAtual = sel.value;
      sel.innerHTML = '<option value="">Selecciona País...</option>' + 
        listaPaises.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');
      if (valorAtual && listaPaises.some(p => p.nombre === valorAtual)) {
        sel.value = valorAtual;
      }
    }
  });
}

// Intercepta a abertura e o salvamento pelo pop-up "Nuevo País"
document.addEventListener('click', function(e) {
  const btnGuardarPopUp = e.target.closest('button');
  if (btnGuardarPopUp && (btnGuardarPopUp.textContent.includes('Guardar en Base de Datos') || btnGuardarPopUp.textContent.includes('Guardar'))) {
    const modalPopUp = btnGuardarPopUp.closest('.modal, [id*="modal"], div[class*="fixed"]');
    if (modalPopUp && (modalPopUp.textContent.includes('Nuevo País') || modalPopUp.textContent.includes('País / Mercado'))) {
      const inputNome = modalPopUp.querySelector('input[type="text"]');
      const inputHoras = modalPopUp.querySelector('input[type="number"]');
      const nomeNovo = inputNome ? inputNome.value.trim() : '';
      const horasNovas = inputHoras ? parseInt(inputHoras.value) : 100;

      if (nomeNovo) {
        if (typeof PAISES_CONFIG === 'undefined' || !Array.isArray(PAISES_CONFIG)) {
          window.PAISES_CONFIG = JSON.parse(localStorage.getItem('nestle_paises_v4')) || [];
        }

        if (!PAISES_CONFIG.some(p => p.nombre.toLowerCase() === nomeNovo.toLowerCase())) {
          const novoPais = {
            id: Date.now().toString(),
            nombre: nomeNovo,
            horas: horasNovas || 100,
            maxChange: 30,
            color: '#0891b2',
            activo: true
          };

          PAISES_CONFIG.push(novoPais);
          localStorage.setItem('nestle_paises_v4', JSON.stringify(PAISES_CONFIG));
          
          if (typeof renderizarTablaPaises === 'function') renderizarTablaPaises();
          poblarSelectsPaisesGlobal();

          inputNome.value = '';
          modalPopUp.classList.add('hidden');
          if (typeof mostrarToast === 'function') mostrarToast(`País "${nomeNovo}" guardado!`, 'success');
        }
      }
    }
  }

  if (e.target.closest('#btnNuevaChange, [onclick*="abrirModal"]')) {
    setTimeout(poblarSelectsPaisesGlobal, 150);
  }
});

// Atualiza os selects ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(poblarSelectsPaisesGlobal, 500);
});
// ==========================================
// MELHORIAS VISUAIS DO MODAL DE NUEVA CHANGE (CSS DINÂMICO)
// ==========================================
(function aplicarEstilosVisualesModal() {
  const css = `
    /* Melhora o layout dos campos 5, País e Produto */
    .grid-campos-chave {
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      gap: 0.75rem !important;
      align-items: start !important;
    }
    
    /* Estilização dos badges de + Nuevo */
    button:has(i.fa-plus), span:contains("+ Nuevo") {
      font-size: 10px !important;
      font-weight: 700 !important;
      padding: 2px 6px !important;
      border-radius: 6px !important;
      transition: all 0.2s ease !important;
    }

    /* Melhora visual dos Selects e Inputs do Modal */
    #modalNuevoChange select, #modalNuevoChange input, #modalNuevoChange textarea {
      border-color: #cbd5e1 !important;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
      transition: all 0.2s ease-in-out !important;
    }

    #modalNuevoChange select:focus, #modalNuevoChange input:focus, #modalNuevoChange textarea:focus {
      border-color: #2563eb !important;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15) !important;
      outline: none !important;
    }
  `;

  const styleTag = document.createElement('style');
  styleTag.type = 'text/css';
  styleTag.appendChild(document.createTextNode(css));
  document.head.appendChild(styleTag);
})();
