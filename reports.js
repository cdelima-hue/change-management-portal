/**
 * reports.js — Módulo de Reportes Avanzados, Ejecutivos y Configurables
 * Incluye:
 * - Reporte Ejecutivo
 * - Reporte Detallado con Filtros Multidimensionales
 * - Análisis de SLA & Aging (Cuellos de Botella)
 * - Análisis de Horas y Productividad
 * - Guardado de Filtros / Favoritos
 * - Exportación a Excel, CSV y Formato Ejecutivo para PDF / Impresión
 * - Seguridad estricta por Business Service
 */

const REPORTS_CONFIG = {
  STORAGE_KEY_FAVORITES: 'nestle_report_presets_v6'
};

let reportFilters = {
  fechaInicio: '',
  fechaFin: '',
  mercado: 'todos',
  businessServices: [],
  productos: [],
  statusFase: 'todos',
  responsable: 'todos',
  rangoHoras: 'todos', // 'todos' | '0-5' | '5-10' | '10-20' | '>20'
  subVistaActiva: 'executive' // 'executive' | 'detailed' | 'sla' | 'hours'
};

let reportCharts = {
  execMercado: null,
  execMes: null,
  slaAging: null,
  slaBottlenecks: null,
  hoursMarket: null,
  hoursProduct: null
};

class ReportsManager {
  constructor() {
    this.favoritos = this.cargarFavoritos();
  }

  async cargarFavoritos() {
    try {
      const res = await apiClient.getSetting('report_presets');
      if (res && res.success && res.data) {
        this.favoritos = res.data;
        return this.favoritos;
      }
    } catch (_) {}
    try {
      this.favoritos = JSON.parse(localStorage.getItem(REPORTS_CONFIG.STORAGE_KEY_FAVORITES) || '[]');
      return this.favoritos;
    } catch (_) {
      this.favoritos = [];
      return [];
    }
  }

  async guardarFavoritos() {
    localStorage.setItem(REPORTS_CONFIG.STORAGE_KEY_FAVORITES, JSON.stringify(this.favoritos));
    try {
      await apiClient.saveSetting('report_presets', this.favoritos);
    } catch (_) {}
  }

  /**
   * Obtiene el conjunto de datos base aplicando la SEGURIDAD POR BUSINESS SERVICE.
   */
  obtenerDatosSeguros() {
    return authService.filtrarChangesPorSeguridad(appState.changes);
  }

  /**
   * Aplica los filtros configurados sobre el conjunto de datos seguro.
   */
  obtenerChangesReporte() {
    const base = this.obtenerDatosSeguros();

    return base.filter(ch => {
      // 1. Rango de Fechas
      const fCreacion = ch.fechaCreacion || ch.d1 || '';
      if (reportFilters.fechaInicio && fCreacion && fCreacion < reportFilters.fechaInicio) return false;
      if (reportFilters.fechaFin && fCreacion && fCreacion > reportFilters.fechaFin) return false;

      // 2. Mercado / País
      if (reportFilters.mercado !== 'todos' && ch.pais !== reportFilters.mercado) return false;

      // 3. Business Service (Multi-select)
      if (reportFilters.businessServices.length > 0) {
        if (!reportFilters.businessServices.includes(ch.businessService)) return false;
      }

      // 4. Productos (Multi-select)
      if (reportFilters.productos.length > 0) {
        if (!reportFilters.productos.includes(ch.producto)) return false;
      }

      // 5. Status / Fase
      if (reportFilters.statusFase !== 'todos') {
        if (ch.faseAtual !== reportFilters.statusFase && ch.statusAprovacao !== reportFilters.statusFase) return false;
      }

      // 6. Responsable / Assigned To
      if (reportFilters.responsable !== 'todos') {
        if (ch.engenheiro !== reportFilters.responsable && ch.solicitante !== reportFilters.responsable) return false;
      }

      // 7. Rango de Horas
      const h = parseFloat(ch.horasEstimadas || 0);
      if (reportFilters.rangoHoras === '0-5' && (h < 0 || h > 5)) return false;
      if (reportFilters.rangoHoras === '5-10' && (h <= 5 || h > 10)) return false;
      if (reportFilters.rangoHoras === '10-20' && (h <= 10 || h > 20)) return false;
      if (reportFilters.rangoHoras === '>20' && h <= 20) return false;

      return true;
    });
  }

  cambiarSubVista(subVista) {
    reportFilters.subVistaActiva = subVista;
    document.querySelectorAll('.report-subtab-btn').forEach(btn => {
      const act = btn.dataset.subview === subVista;
      btn.className = `report-subtab-btn py-1.5 px-3 font-${act ? 'bold text-blue-600 bg-blue-50 border-blue-600' : 'semibold text-slate-600 hover:bg-slate-100 border-transparent'} border rounded-xl text-xs flex items-center gap-1.5 transition-all`;
    });

    ['executive', 'detailed', 'sla', 'hours'].forEach(v => {
      const el = document.getElementById(`repView_${v}`);
      if (el) el.classList.toggle('hidden', v !== subVista);
    });

    this.renderizar();
  }

  renderizar() {
    const data = this.obtenerChangesReporte();
    this.poblarFiltrosUI();

    if (reportFilters.subVistaActiva === 'executive') {
      this.renderizarReporteEjecutivo(data);
    } else if (reportFilters.subVistaActiva === 'detailed') {
      this.renderizarReporteDetallado(data);
    } else if (reportFilters.subVistaActiva === 'sla') {
      this.renderizarReporteSLA(data);
    } else if (reportFilters.subVistaActiva === 'hours') {
      this.renderizarReporteHoras(data);
    }

    this.renderizarFavoritosUI();
  }

  poblarFiltrosUI() {
    const base = this.obtenerDatosSeguros();
    const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();

    // Mercados
    const selPais = document.getElementById('repFiltroMercado');
    if (selPais && selPais.children.length <= 1) {
      obtenerPaisesActivos().forEach(p => {
        selPais.innerHTML += `<option value="${p.key}">${p.nombre}</option>`;
      });
    }

    // Business Services
    const containerBS = document.getElementById('repContainerFiltroBS');
    if (containerBS && containerBS.children.length === 0) {
      const allBS = uniq(base.map(c => c.businessService));
      containerBS.innerHTML = allBS.map(bs => `
        <label class="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 hover:bg-blue-50 p-1.5 rounded-lg border border-slate-200 cursor-pointer">
          <input type="checkbox" value="${bs}" onchange="reportsManager.onToggleFiltroBS(this.value, this.checked)" class="rounded text-blue-600 focus:ring-0">
          <span class="truncate">${bs}</span>
        </label>
      `).join('');
    }

    // Productos
    const containerProd = document.getElementById('repContainerFiltroProd');
    if (containerProd && containerProd.children.length === 0) {
      const allProd = uniq(base.map(c => c.producto));
      containerProd.innerHTML = allProd.map(p => `
        <label class="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 hover:bg-blue-50 p-1.5 rounded-lg border border-slate-200 cursor-pointer">
          <input type="checkbox" value="${p}" onchange="reportsManager.onToggleFiltroProd(this.value, this.checked)" class="rounded text-blue-600 focus:ring-0">
          <span class="truncate">${p}</span>
        </label>
      `).join('');
    }

    // Responsables
    const selResp = document.getElementById('repFiltroResponsable');
    if (selResp && selResp.children.length <= 1) {
      const allEng = uniq(base.map(c => c.engenheiro));
      allEng.forEach(eng => {
        selResp.innerHTML += `<option value="${eng}">${eng}</option>`;
      });
    }
  }

  onToggleFiltroBS(bsVal, checked) {
    if (checked) {
      if (!reportFilters.businessServices.includes(bsVal)) reportFilters.businessServices.push(bsVal);
    } else {
      reportFilters.businessServices = reportFilters.businessServices.filter(x => x !== bsVal);
    }
    this.renderizar();
  }

  onToggleFiltroProd(pVal, checked) {
    if (checked) {
      if (!reportFilters.productos.includes(pVal)) reportFilters.productos.push(pVal);
    } else {
      reportFilters.productos = reportFilters.productos.filter(x => x !== pVal);
    }
    this.renderizar();
  }

  // ============================================================
  // 1. REPORTE EJECUTIVO
  // ============================================================
  renderizarReporteEjecutivo(data) {
    const totalChanges = data.length;
    const totalHoras = data.reduce((s, c) => s + parseFloat(c.horasAprovadas || c.horasEstimadas || 0), 0);
    const promHoras = totalChanges > 0 ? (totalHoras / totalChanges).toFixed(1) : 0;

    const slaInfo = analizarSLAChanges(data);

    setText('txtRepExecTotalChanges', `${totalChanges}`);
    setText('txtRepExecTotalHoras', `${totalHoras.toFixed(1)} h`);
    setText('txtRepExecPromHoras', `${promHoras} h`);
    setText('txtRepExecPromDias', `${slaInfo.promedioDias} d`);
    setText('txtRepExecSLA', `${slaInfo.pctDentroSLA}%`);
    setText('txtRepExecFueraSLA', `${slaInfo.fueraSLA}`);

    // Tabla de Performance por Mercado
    const tbody = document.getElementById('tbodyRepExecMercados');
    if (tbody) {
      tbody.innerHTML = '';
      const porMercado = {};
      data.forEach(c => {
        const pais = c.pais || 'Brasil';
        if (!porMercado[pais]) porMercado[pais] = [];
        porMercado[pais].push(c);
      });

      Object.keys(porMercado).forEach(pais => {
        const list = porMercado[pais];
        const h = list.reduce((s, c) => s + parseFloat(c.horasAprovadas || c.horasEstimadas || 0), 0);
        const sla = analizarSLAChanges(list);

        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-100 hover:bg-slate-50 text-xs cursor-pointer';
        tr.onclick = () => {
          reportFilters.mercado = pais;
          const sel = document.getElementById('repFiltroMercado');
          if (sel) sel.value = pais;
          reportsManager.cambiarSubVista('detailed');
        };

        tr.innerHTML = `
          <td class="p-2.5 font-bold text-slate-800 flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span> ${pais}
          </td>
          <td class="p-2.5 text-center font-bold">${list.length}</td>
          <td class="p-2.5 text-center font-semibold text-blue-700">${h.toFixed(1)} h</td>
          <td class="p-2.5 text-center font-mono">${sla.promedioDias} d</td>
          <td class="p-2.5 text-center">
            <span class="px-2 py-0.5 rounded-full ${sla.pctDentroSLA >= 90 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} font-bold text-[10px]">
              ${sla.pctDentroSLA}%
            </span>
          </td>
          <td class="p-2.5 text-center">
            <span class="px-2 py-0.5 rounded ${sla.fueraSLA > 0 ? 'bg-rose-100 text-rose-800 font-bold' : 'text-slate-400'} text-[10px]">
              ${sla.fueraSLA}
            </span>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Gráficos Ejecutivos
    this.renderizarGraficosEjecutivos(data);
  }

  renderizarGraficosEjecutivos(data) {
    const porMercado = {};
    data.forEach(c => {
      const p = c.pais || 'Brasil';
      porMercado[p] = (porMercado[p] || 0) + 1;
    });

    const ctxM = document.getElementById('chartRepExecMercados');
    if (ctxM) {
      if (reportCharts.execMercado) reportCharts.execMercado.destroy();
      reportCharts.execMercado = new Chart(ctxM.getContext('2d'), {
        type: 'bar',
        data: {
          labels: Object.keys(porMercado),
          datasets: [{
            label: 'Changes por Mercado',
            data: Object.values(porMercado),
            backgroundColor: '#3b82f6',
            borderRadius: 6
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
      });
    }

    const porFase = {};
    data.forEach(c => {
      porFase[c.faseAtual] = (porFase[c.faseAtual] || 0) + 1;
    });

    const ctxF = document.getElementById('chartRepExecFases');
    if (ctxF) {
      if (reportCharts.execMes) reportCharts.execMes.destroy();
      reportCharts.execMes = new Chart(ctxF.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: Object.keys(porFase),
          datasets: [{
            data: Object.values(porFase),
            backgroundColor: ['#94a3b8', '#64748b', '#0284c7', '#d97706', '#7c3aed', '#059669', '#2563eb', '#16a34a']
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 10 } } } } }
      });
    }
  }

  // ============================================================
  // 2. REPORTE DETALLADO (DRILL-DOWN Y TABLA COMPLETA)
  // ============================================================
  renderizarReporteDetallado(data) {
    const tbody = document.getElementById('tbodyRepDetallado');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="11" class="p-8 text-center text-slate-400">No se encontraron Changes con los filtros aplicados.</td></tr>`;
      return;
    }

    data.forEach(ch => {
      const metricas = obtenerMetricasSLA(ch);
      const h = parseFloat(ch.horasEstimadas || 0);
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100 text-xs hover:bg-blue-50/50 transition-colors';

      tr.innerHTML = `
        <td class="p-2.5">
          <a href="javascript:void(0)" onclick="abrirModalEdicion('${ch.id || ch.spId}')" class="font-bold text-blue-700 font-mono hover:underline">
            ${ch.numeroChange}
          </a>
        </td>
        <td class="p-2.5 font-semibold text-slate-700">${ch.pais}</td>
        <td class="p-2.5 font-medium truncate max-w-[120px]">${ch.producto}</td>
        <td class="p-2.5 text-slate-600 truncate max-w-[140px]">${ch.businessService}</td>
        <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">${ch.faseAtual}</span></td>
        <td class="p-2.5 text-center font-mono text-[11px]">${metricas.fechaCreacion}</td>
        <td class="p-2.5 text-center font-mono text-[11px]">${metricas.fechaCierre || '—'}</td>
        <td class="p-2.5 text-center font-bold font-mono">${metricas.diasAbiertaTotal} d</td>
        <td class="p-2.5 text-center">${generarBadgeSLAHTML(metricas)}</td>
        <td class="p-2.5 text-center font-bold">${h} h</td>
        <td class="p-2.5 font-medium text-slate-700">${ch.engenheiro || '—'}</td>
      `;
      tbody.appendChild(tr);
    });

    setText('txtRepDetalladoCount', `${data.length} Changes encontradas`);
  }

  // ============================================================
  // 3. REPORTE DE SLA & AGING (CUELLOS DE BOTELLA)
  // ============================================================
  renderizarReporteSLA(data) {
    const slaInfo = analizarSLAChanges(data);

    setText('txtRepSlaTotalAbiertas', `${slaInfo.totalAbiertas}`);
    setText('txtRepSlaAbiertasHoy', `${slaInfo.abiertasHoy}`);
    setText('txtRepSlaMayor5', `${slaInfo.abiertasMayor5}`);
    setText('txtRepSlaMayor10', `${slaInfo.abiertasMayor10}`);
    setText('txtRepSlaMayor15', `${slaInfo.abiertasMayor15}`);
    setText('txtRepSlaProximas20', `${slaInfo.proximasSuperar20}`);
    setText('txtRepSlaFueraSLA', `${slaInfo.fueraSLA}`);
    setText('txtRepSlaMaxDias', `${slaInfo.maxTiempoDias} d`);
    setText('txtRepSlaPromedio', `${slaInfo.promedioDias} d`);

    // Ranking de Etapas (Cuellos de Botella)
    const tbodyRanking = document.getElementById('tbodyRepRankingEtapas');
    if (tbodyRanking) {
      tbodyRanking.innerHTML = '';
      slaInfo.rankingEtapas.forEach((r, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-100 text-xs hover:bg-slate-50';
        tr.innerHTML = `
          <td class="p-2.5 text-center font-bold text-slate-500 font-mono">#${idx + 1}</td>
          <td class="p-2.5 font-bold text-slate-800">${r.etapa}</td>
          <td class="p-2.5 text-center font-black text-blue-700 font-mono text-sm">${r.promedioDias} días</td>
          <td class="p-2.5 text-center text-slate-500 font-mono">${r.totalDias} d</td>
          <td class="p-2.5 text-center">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${r.promedioDias > 5 ? 'bg-rose-100 text-rose-800' : r.promedioDias >= 3 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
              ${r.promedioDias > 5 ? '🔴 Cuello Crítico' : r.promedioDias >= 3 ? '🟡 Atención' : '🟢 Normal'}
            </span>
          </td>
        `;
        tbodyRanking.appendChild(tr);
      });
    }

    // Gráfico de Aging
    const ctxAging = document.getElementById('chartRepSlaAging');
    if (ctxAging) {
      if (reportCharts.slaAging) reportCharts.slaAging.destroy();
      reportCharts.slaAging = new Chart(ctxAging.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['< 5 días', '5-10 días', '11-15 días', '16-20 días', '> 20 días (Fuera SLA)'],
          datasets: [{
            label: 'Distribución de Changes por Días Abiertas',
            data: [
              data.filter(c => obtenerMetricasSLA(c).diasAbiertaTotal < 5).length,
              data.filter(c => { const d = obtenerMetricasSLA(c).diasAbiertaTotal; return d >= 5 && d <= 10; }).length,
              data.filter(c => { const d = obtenerMetricasSLA(c).diasAbiertaTotal; return d >= 11 && d <= 15; }).length,
              data.filter(c => { const d = obtenerMetricasSLA(c).diasAbiertaTotal; return d >= 16 && d <= 20; }).length,
              slaInfo.fueraSLA
            ],
            backgroundColor: ['#86efac', '#93c5fd', '#fde047', '#fdba74', '#f87171'],
            borderRadius: 6
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
      });
    }
  }

  // ============================================================
  // 4. REPORTE DE HORAS Y PRODUCTIVIDAD
  // ============================================================
  renderizarReporteHoras(data) {
    const totalHoras = data.reduce((s, c) => s + parseFloat(c.horasAprovadas || c.horasEstimadas || 0), 0);
    const promHoras = data.length > 0 ? (totalHoras / data.length).toFixed(1) : 0;
    const maxHoras = data.reduce((max, c) => Math.max(max, parseFloat(c.horasEstimadas || 0)), 0);
    const minHoras = data.length > 0 ? data.reduce((min, c) => Math.min(min, parseFloat(c.horasEstimadas || 0)), 999) : 0;

    setText('txtRepHoursTotal', `${totalHoras.toFixed(1)} h`);
    setText('txtRepHoursProm', `${promHoras} h`);
    setText('txtRepHoursMax', `${maxHoras} h`);
    setText('txtRepHoursMin', `${minHoras === 999 ? 0 : minHoras} h`);

    // Horas por Business Service
    const tbodyBS = document.getElementById('tbodyRepHoursBS');
    if (tbodyBS) {
      tbodyBS.innerHTML = '';
      const porBS = {};
      data.forEach(c => {
        const bs = c.businessService || 'General';
        porBS[bs] = (porBS[bs] || 0) + parseFloat(c.horasAprovadas || c.horasEstimadas || 0);
      });

      Object.keys(porBS).sort((a, b) => porBS[b] - porBS[a]).forEach(bs => {
        const h = porBS[bs];
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-100 text-xs hover:bg-slate-50';
        tr.innerHTML = `
          <td class="p-2.5 font-bold text-slate-800">${bs}</td>
          <td class="p-2.5 text-center font-black text-blue-700 font-mono">${h.toFixed(1)} h</td>
          <td class="p-2.5 text-center text-slate-500 font-mono">${totalHoras > 0 ? Math.round((h / totalHoras) * 100) : 0}%</td>
        `;
        tbodyBS.appendChild(tr);
      });
    }
  }

  // ============================================================
  // FAVORITOS / FILTROS GUARDADOS
  // ============================================================
  guardarFiltroActualComoFavorito() {
    const nombre = prompt('Ingresa un nombre para guardar esta configuración de reporte (ej: "Reporte Mensual Brasil"):');
    if (!nombre || !nombre.trim()) return;

    const nuevoFav = {
      id: `fav-${Date.now()}`,
      nombre: nombre.trim(),
      filtros: { ...reportFilters },
      fecha: new Date().toLocaleDateString()
    };

    this.favoritos.push(nuevoFav);
    this.guardarFavoritos();
    this.renderizarFavoritosUI();
    mostrarToast(`Filtro "${nombre}" guardado con éxito ⭐`, 'success');
  }

  aplicarFavorito(id) {
    const fav = this.favoritos.find(f => f.id === id);
    if (!fav) return;

    reportFilters = { ...fav.filtros };

    // Sincronizar inputs de UI
    const selM = document.getElementById('repFiltroMercado');
    if (selM) selM.value = reportFilters.mercado;
    const inpIni = document.getElementById('repFiltroFechaInicio');
    if (inpIni) inpIni.value = reportFilters.fechaInicio;
    const inpFin = document.getElementById('repFiltroFechaFin');
    if (inpFin) inpFin.value = reportFilters.fechaFin;

    this.cambiarSubVista(reportFilters.subVistaActiva || 'executive');
    mostrarToast(`Filtro favorito "${fav.nombre}" aplicado ⭐`, 'info');
  }

  eliminarFavorito(id) {
    this.favoritos = this.favoritos.filter(f => f.id !== id);
    this.guardarFavoritos();
    this.renderizarFavoritosUI();
    mostrarToast('Filtro favorito eliminado.', 'warning');
  }

  renderizarFavoritosUI() {
    const container = document.getElementById('containerRepFavoritos');
    if (!container) return;
    container.innerHTML = '';

    if (!this.favoritos.length) {
      container.innerHTML = `<span class="text-[11px] text-slate-400 italic">No tienes reportes guardados como favoritos.</span>`;
      return;
    }

    this.favoritos.forEach(f => {
      container.innerHTML += `
        <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold shadow-xs">
          <button type="button" onclick="reportsManager.aplicarFavorito('${f.id}')" class="text-blue-700 hover:underline flex items-center gap-1">
            <i class="fa-solid fa-star text-amber-400"></i> ${f.nombre}
          </button>
          <button type="button" onclick="reportsManager.eliminarFavorito('${f.id}')" class="text-slate-400 hover:text-rose-600 ml-1">
            <i class="fa-solid fa-xmark text-[10px]"></i>
          </button>
        </div>
      `;
    });
  }

  // ============================================================
  // EXPORTACIÓN A EXCEL, CSV Y PDF EJECUTIVO
  // ============================================================
  exportarExcel() {
    const data = this.obtenerChangesReporte();
    if (!data.length) { mostrarToast('No hay datos para exportar.', 'warning'); return; }

    const wsData = [
      ['Change', 'Mercado', 'Producto', 'Business Service', 'Fase Actual', 'Status', 'Fecha Creación', 'Fecha Cierre', 'Días Abiertos', 'Estado SLA', 'Horas Estimadas', 'Horas Aprobadas', 'Responsable', 'Solicitante']
    ];

    data.forEach(c => {
      const m = obtenerMetricasSLA(c);
      wsData.push([
        c.numeroChange, c.pais, c.producto, c.businessService, c.faseAtual, c.statusAprovacao,
        m.fechaCreacion, m.fechaCierre || '', m.diasAbiertaTotal, m.textoSLA,
        c.horasEstimadas, c.horasAprovadas, c.engenheiro, c.solicitante
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = wsData[0].map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte_Changes');
    XLSX.writeFile(wb, `Reporte_Changes_${new Date().toISOString().split('T')[0]}.xlsx`);

    registrarAudit('REPORTES', 'EXPORTAR_EXCEL', '—', `${data.length} registros`);
    mostrarToast('Reporte Excel descargado con éxito ✅', 'success');
  }

  exportarCSV() {
    const data = this.obtenerChangesReporte();
    if (!data.length) { mostrarToast('No hay datos para exportar.', 'warning'); return; }

    const headers = ['Change,Mercado,Producto,Business Service,Fase,Dias Abiertos,Estado SLA,Horas,Responsable'];
    const rows = data.map(c => {
      const m = obtenerMetricasSLA(c);
      return `"${c.numeroChange}","${c.pais}","${c.producto}","${c.businessService}","${c.faseAtual}",${m.diasAbiertaTotal},"${m.estadoSLA}",${c.horasEstimadas},"${c.engenheiro}"`;
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Reporte_Changes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    registrarAudit('REPORTES', 'EXPORTAR_CSV', '—', `${data.length} registros`);
    mostrarToast('Reporte CSV descargado con éxito ✅', 'success');
  }

  imprimirReporteEjecutivoPDF() {
    registrarAudit('REPORTES', 'GENERAR_PDF', '—', 'Impresión / Exportación PDF');
    window.print();
  }
}

const reportsManager = new ReportsManager();
