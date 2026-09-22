/**
 * sla.js — Módulo de Control de Tiempo, Aging y Gestión de SLA
 * Implementa las reglas:
 * 1. Alerta de 5 días de inactividad por etapa.
 * 2. Límite máximo de 20 días de SLA total por Change.
 * 3. Cálculo de duración por cada etapa y ranking de cuellos de botella.
 */

const SLA_CONFIG = {
  SLA_MAX_DIAS_TOTAL: 20,
  DIAS_ALERTA_ETAPA: 5,
  ETAPAS_ESTANDAR: [
    { key: 'Abertura',     label: 'Draft / Abertura' },
    { key: 'Reuniao',      label: 'Assess / Reunião' },
    { key: 'Analise',      label: 'Authorize / Análise' },
    { key: 'Comite',       label: 'Comitê' },
    { key: 'Apresentacao', label: 'Apresentação' },
    { key: 'Aprovacao',    label: 'Aprovação' },
    { key: 'Execucao',     label: 'Build / Execução' },
    { key: 'Concluida',    label: 'Deploy / Concluída' }
  ]
};

/**
 * Calcula la diferencia en días enteros entre dos fechas ISO (YYYY-MM-DD).
 */
function calcularDiferenciaDias(fechaInicio, fechaFin = null) {
  if (!fechaInicio) return 0;
  const fIni = new Date(fechaInicio.includes('T') ? fechaInicio : `${fechaInicio}T00:00:00`);
  const fFin = fechaFin ? new Date(fechaFin.includes('T') ? fechaFin : `${fechaFin}T00:00:00`) : new Date();
  const diffMs = fFin.getTime() - fIni.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Obtiene las métricas completas de tiempo y SLA para una Change.
 */
function obtenerMetricasSLA(change) {
  const fechaCreacion = change.fechaCreacion || change.d1 || (change.ultimaModificacao ? change.ultimaModificacao.split('T')[0] : new Date().toISOString().split('T')[0]);
  const fechaCierre = change.fechaCierre || (change.faseAtual === 'Concluida' && change.d8 ? change.d8 : null);
  const estaCerrada = change.faseAtual === 'Concluida' || !!fechaCierre;

  // 1. Días totales abierta
  const diasAbiertaTotal = calcularDiferenciaDias(fechaCreacion, fechaCierre);

  // 2. Días en la etapa actual
  let fechaEntradaEtapa = fechaCreacion;
  if (change.historialFases && change.historialFases.length > 0) {
    const ultimoMov = change.historialFases[change.historialFases.length - 1];
    if (ultimoMov && ultimoMov.fecha) {
      fechaEntradaEtapa = ultimoMov.fecha;
    }
  } else if (change.ultimaModificacao) {
    fechaEntradaEtapa = change.ultimaModificacao.split('T')[0];
  }
  const diasEnEtapaActual = estaCerrada ? 0 : calcularDiferenciaDias(fechaEntradaEtapa);

  // 3. Evaluación de Alerta de Etapa (Regla 5 días)
  let estadoEtapa = 'normal'; // 'normal' | 'atencion' | 'alerta' | 'critico'
  let textoEtapa = `${diasEnEtapaActual} días en etapa`;
  if (!estaCerrada) {
    if (diasEnEtapaActual < 3) {
      estadoEtapa = 'normal';
      textoEtapa = `🟢 ${diasEnEtapaActual}d en fase (Normal)`;
    } else if (diasEnEtapaActual >= 3 && diasEnEtapaActual <= 4) {
      estadoEtapa = 'atencion';
      textoEtapa = `🟡 ${diasEnEtapaActual}d en fase (Atención)`;
    } else if (diasEnEtapaActual === 5) {
      estadoEtapa = 'alerta';
      textoEtapa = `🟠 5d sin avanzar (Alerta)`;
    } else {
      estadoEtapa = 'critico';
      textoEtapa = `🔴 ${diasEnEtapaActual}d sin avanzar (Crítico)`;
    }
  }

  // 4. Evaluación de SLA Total (Regla 20 días)
  let estadoSLA = 'normal'; // 'normal' | 'atencion' | 'proxima_vencer' | 'limite' | 'excedido'
  let textoSLA = '🟢 Dentro del SLA';
  let diasExcedidos = 0;

  if (diasAbiertaTotal <= 10) {
    estadoSLA = 'normal';
    textoSLA = `🟢 ${diasAbiertaTotal}d abierta (Dentro del SLA)`;
  } else if (diasAbiertaTotal >= 11 && diasAbiertaTotal <= 15) {
    estadoSLA = 'atencion';
    textoSLA = `🟡 ${diasAbiertaTotal}d abierta (Atención SLA)`;
  } else if (diasAbiertaTotal >= 16 && diasAbiertaTotal <= 19) {
    estadoSLA = 'proxima_vencer';
    textoSLA = `🟠 ${diasAbiertaTotal}d abierta (Próxima a vencer)`;
  } else if (diasAbiertaTotal === 20) {
    estadoSLA = 'limite';
    textoSLA = `🔴 20d abierta (Límite SLA alcanzado)`;
  } else {
    estadoSLA = 'excedido';
    diasExcedidos = diasAbiertaTotal - SLA_CONFIG.SLA_MAX_DIAS_TOTAL;
    textoSLA = `🚨 FUERA DEL SLA (+${diasExcedidos}d)`;
  }

  return {
    fechaCreacion,
    fechaCierre,
    estaCerrada,
    diasAbiertaTotal,
    diasEnEtapaActual,
    estadoEtapa,
    textoEtapa,
    estadoSLA,
    textoSLA,
    diasExcedidos,
    esFueraSLA: diasAbiertaTotal > SLA_CONFIG.SLA_MAX_DIAS_TOTAL
  };
}

/**
 * Genera el Badge HTML para el SLA Total con texto explicativo.
 */
function generarBadgeSLAHTML(metricas) {
  if (metricas.estadoSLA === 'excedido') {
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-xs animate-pulse" title="SLA: 20 días | Excedido por ${metricas.diasExcedidos} días">
      <i class="fa-solid fa-triangle-exclamation text-rose-600"></i> ${metricas.textoSLA}
    </span>`;
  }
  if (metricas.estadoSLA === 'proxima_vencer' || metricas.estadoSLA === 'limite') {
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300" title="Límite 20 días">
      <i class="fa-solid fa-clock text-amber-700"></i> ${metricas.textoSLA}
    </span>`;
  }
  if (metricas.estadoSLA === 'atencion') {
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-yellow-50 text-yellow-800 border border-yellow-200">
      <i class="fa-solid fa-circle-info text-yellow-600"></i> ${metricas.textoSLA}
    </span>`;
  }
  return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
    <i class="fa-solid fa-circle-check text-emerald-600"></i> ${metricas.textoSLA}
  </span>`;
}

/**
 * Genera el Badge HTML para la inactividad en la etapa actual.
 */
function generarBadgeEtapaHTML(metricas) {
  if (metricas.estaCerrada) {
    return `<span class="text-[10px] text-slate-400 font-medium"><i class="fa-solid fa-check-double text-emerald-600 mr-1"></i>Concluida</span>`;
  }
  if (metricas.estadoEtapa === 'critico') {
    return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title="Más de 5 días sin cambio de fase">
      <i class="fa-solid fa-fire text-rose-500"></i> ${metricas.textoEtapa}
    </span>`;
  }
  if (metricas.estadoEtapa === 'alerta') {
    return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
      <i class="fa-solid fa-bell text-amber-600"></i> ${metricas.textoEtapa}
    </span>`;
  }
  return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-slate-600 bg-slate-100">
    <i class="fa-solid fa-hourglass-half text-slate-400"></i> ${metricas.textoEtapa}
  </span>`;
}

/**
 * Calcula el tiempo que cada Change ha permanecido en cada etapa del flujo.
 */
function calcularTiemposPorEtapa(change) {
  const fechas = [
    { etapa: 'Abertura', fecha: change.d1 },
    { etapa: 'Reunião', fecha: change.d2 },
    { etapa: 'Análise', fecha: change.d3 },
    { etapa: 'Comitê', fecha: change.d4 },
    { etapa: 'Apresentação', fecha: change.d5 },
    { etapa: 'Aprovação', fecha: change.d6 },
    { etapa: 'Execução', fecha: change.d7 },
    { etapa: 'Concluída', fecha: change.d8 }
  ];

  const resultados = [];
  for (let i = 0; i < fechas.length; i++) {
    const fActual = fechas[i];
    if (!fActual.fecha) continue;

    let fechaSalida = null;
    for (let j = i + 1; j < fechas.length; j++) {
      if (fechas[j].fecha) {
        fechaSalida = fechas[j].fecha;
        break;
      }
    }

    const dias = calcularDiferenciaDias(fActual.fecha, fechaSalida);
    resultados.push({
      etapa: fActual.etapa,
      fechaEntrada: fActual.fecha,
      fechaSalida: fechaSalida || (change.faseAtual === fActual.etapa ? 'Actual' : '—'),
      dias: dias
    });
  }

  return resultados;
}

/**
 * Analiza una lista de changes y genera el resumen estadístico de Aging y Ranking de Cuellos de Botella.
 */
function analizarSLAChanges(changesList) {
  let totalAbiertas = 0;
  let totalCerradas = 0;
  let abiertasHoy = 0;
  let abiertasMayor5 = 0;
  let abiertasMayor10 = 0;
  let abiertasMayor15 = 0;
  let proximasSuperar20 = 0;
  let fueraSLA = 0;
  let sumaDiasAbiertas = 0;
  let maxTiempoDias = 0;

  const hoyStr = new Date().toISOString().split('T')[0];
  const duracionPorEtapa = {};
  const conteoPorEtapa = {};

  changesList.forEach(ch => {
    const m = obtenerMetricasSLA(ch);
    if (m.estaCerrada) {
      totalCerradas++;
    } else {
      totalAbiertas++;
      sumaDiasAbiertas += m.diasAbiertaTotal;
      if (m.diasAbiertaTotal > maxTiempoDias) maxTiempoDias = m.diasAbiertaTotal;
      if (m.fechaCreacion === hoyStr) abiertasHoy++;
      if (m.diasAbiertaTotal > 5) abiertasMayor5++;
      if (m.diasAbiertaTotal > 10) abiertasMayor10++;
      if (m.diasAbiertaTotal > 15) abiertasMayor15++;
      if (m.diasAbiertaTotal >= 16 && m.diasAbiertaTotal <= 20) proximasSuperar20++;
      if (m.esFueraSLA) fueraSLA++;
    }

    // Calcular duración por etapa
    const etapasCh = calcularTiemposPorEtapa(ch);
    etapasCh.forEach(ep => {
      duracionPorEtapa[ep.etapa] = (duracionPorEtapa[ep.etapa] || 0) + ep.dias;
      conteoPorEtapa[ep.etapa] = (conteoPorEtapa[ep.etapa] || 0) + 1;
    });
  });

  const totalEvaluadas = changesList.length;
  const promedioDias = totalAbiertas > 0 ? (sumaDiasAbiertas / totalAbiertas).toFixed(1) : 0;
  const pctDentroSLA = totalEvaluadas > 0 ? Math.round(((totalEvaluadas - fueraSLA) / totalEvaluadas) * 100) : 100;
  const pctFueraSLA = 100 - pctDentroSLA;

  // Ranking de etapas (de mayor a menor demora promedio)
  const rankingEtapas = Object.keys(duracionPorEtapa).map(etapa => {
    const cant = conteoPorEtapa[etapa] || 1;
    const totalD = duracionPorEtapa[etapa] || 0;
    const prom = (totalD / cant).toFixed(1);
    return { etapa, promedioDias: parseFloat(prom), totalDias: totalD, conteo: cant };
  }).sort((a, b) => b.promedioDias - a.promedioDias);

  return {
    totalEvaluadas,
    totalAbiertas,
    totalCerradas,
    abiertasHoy,
    abiertasMayor5,
    abiertasMayor10,
    abiertasMayor15,
    proximasSuperar20,
    fueraSLA,
    promedioDias,
    maxTiempoDias,
    pctDentroSLA,
    pctFueraSLA,
    rankingEtapas
  };
}
