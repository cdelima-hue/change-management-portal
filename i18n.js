/**
 * i18n.js — Diccionario Centralizado de Traducciones Multidioma
 * Soporte trilingüe: 🇪🇸 Español (es) | 🇧🇷 Português (pt) | 🇺🇸 English (en)
 */

const DICCIONARIO_I18N = {
  es: {
    // Header
    'header.portal_titulo': 'Portal Gestión de Changes',
    'header.subtitulo': 'Regla global: máx. 30h por Change • Control de Roles & SLA',
    'header.online': 'En línea',
    'header.periodo': 'Periodo:',
    'header.sync': 'Sync',
    'header.excel': 'Excel',
    'header.exportar': 'Exportar',
    'header.nueva_change': '+ Change',
    'header.mi_perfil': 'Mi Perfil',
    'header.cambiar_pass': 'Cambiar Contraseña',

    // Navegación
    'nav.kanban': 'Kanban',
    'nav.matriz': 'Matriz',
    'nav.dashboard': 'Dashboard',
    'nav.reportes': 'Reportes & SLA',
    'nav.backlog': 'Backlog',
    'nav.historial': 'Historial',
    'nav.paises': 'Países',
    'nav.usuarios': 'Usuarios',
    'nav.branding': 'Logo & Marca',

    // Filtros
    'filtro.buscar': 'Buscar...',
    'filtro.todos_paises': 'Todos los Países',
    'filtro.todos_solicitantes': 'Solicitantes',
    'filtro.todos_services': 'Business Services',
    'filtro.todos_productos': 'Productos',
    'filtro.todos_estados': 'Estados',

    // Fases Kanban
    'fase.1_abertura': '1. Abertura',
    'fase.2_reuniao': '2. Reunião',
    'fase.3_analise': '3. Análise',
    'fase.4_comite': '4. Comitê',
    'fase.5_apresentacao': '5. Apresentação',
    'fase.6_aprovacao': '6. Aprovação',
    'fase.7_execucao': '7. Execução',
    'fase.8_concluida': '8. Concluída',

    // KPIs & Capacidad
    'kpi.capacidad_mes': 'Capacidad del Mes',
    'kpi.disponibles': 'Disponibles',
    'kpi.utilizadas': 'Utilizadas',
    'kpi.restantes': 'Restantes',
    'kpi.pct_uso': '% Uso',
    'kpi.comprometidas': 'Comprometidas',
    'kpi.total_changes': 'Changes',
    'kpi.promedio': 'Promedio',
    'kpi.sobre_limite': 'Sobre Límite',
    'kpi.mejoras': 'Mejoras',
    'kpi.distribucion_prod': 'Distribución por Producto',
    'kpi.sobrecapacidad_alerta': '¡Capacidad excedida! Exceso:',

    // Dashboard
    'dash.comparativo_mensual': 'Comparativo Mensual de Capacidad y Uso',
    'dash.mes_anterior': 'Mes Anterior:',
    'dash.mes_actual': 'Mes Actual:',
    'dash.acumulado_titulo': 'Acumulado Total del Período / Histórico',
    'dash.acumulado_sub': 'Consolidado acumulado de todos los períodos registrados para el mercado seleccionado.',
    'dash.horas_acumuladas': 'Horas Acumuladas',
    'dash.capacidad_acumulada': 'Capacidad Total',
    'dash.consumo_acumulado': '% Consumo Acum.',
    'dash.changes_acumuladas': 'Changes Acumuladas',
    'dash.promedio_mensual': 'Promedio Mensual',

    // Login & Auth
    'login.titulo': 'Portal de Gestión de Changes',
    'login.subtitulo': 'Inicia sesión para acceder al sistema de gestión y capacidad',
    'login.usuario': 'Usuario o Correo Electrónico',
    'login.usuario_placeholder': 'usuario@nestle.com o nombre de usuario',
    'login.password': 'Contraseña',
    'login.boton_entrar': 'Iniciar Sesión',
    'login.olvido_password': '¿Olvidaste tu contraseña?',
    'login.demo_credentials': 'Credenciales de demostración rápida:',
    'login.error_credenciales': 'Usuario o contraseña incorrectos.',
    'login.error_inactivo': 'Esta cuenta de usuario se encuentra inactiva.',
    'login.primer_acceso_titulo': 'Cambio Obligatorio de Contraseña',
    'login.primer_acceso_subtitulo': 'Por seguridad institucional, debes actualizar tu contraseña temporal antes de continuar.',
    'login.pass_actual': 'Contraseña Actual / Temporal *',
    'login.pass_nueva': 'Nueva Contraseña *',
    'login.pass_confirmar': 'Confirmar Nueva Contraseña *',
    'login.pass_requisitos': 'Mínimo 8 caracteres, al menos 1 número y 1 letra mayúscula.',
    'login.btn_guardar_pass': 'Actualizar Contraseña e Ingresar',
    'login.logout_confirm_titulo': '¿Desea realmente cerrar sesión?',
    'login.logout_confirm_desc': 'Se cerrará tu sesión activa y tendrás que volver a autenticarte.',
    'login.btn_cancelar': 'Cancelar',
    'login.btn_cerrar_sesion': 'Cerrar Sesión',

    // Usuarios & Roles
    'usr.titulo': 'Control de Usuarios y Permisos',
    'usr.subtitulo': 'Administra cuentas, contraseñas y asigna roles y Business Services autorizados.',
    'usr.nombre': 'Nombre *',
    'usr.apellido': 'Apellido *',
    'usr.usuario': 'Usuario *',
    'usr.email': 'Correo Electrónico *',
    'usr.pass_inicial': 'Contraseña Inicial *',
    'usr.pass_confirmar': 'Confirmar Contraseña *',
    'usr.rol': 'Perfil / Rol *',
    'usr.business_services': 'Business Services Autorizados *',
    'usr.idioma': 'Idioma Preferido',
    'usr.btn_crear': 'Registrar Nuevo Usuario',

    // Formulario Change
    'form.titulo_nuevo': '+ Nueva Solicitud de Change',
    'form.titulo_editar': 'Editar Change',
    'form.titulo_consulta': 'Detalles de la Change (Solo Lectura)',
    'form.subtitulo_obligatorios': 'Los 5 campos marcados con (*) son obligatorios',
    'form.btn_cerrar': 'Cerrar',

    // Reportes & SLA
    'rep.titulo': 'Módulo de Reportes & Monitoreo de SLA',
    'rep.subtitulo': 'Análisis ejecutivo, detallado y tiempos por etapa con segregación por Business Service.',
    'rep.tab_exec': 'Reporte Ejecutivo',
    'rep.tab_detailed': 'Reporte Detallado',
    'rep.tab_sla': 'Análisis de SLA & Aging',
    'rep.tab_hours': 'Análisis de Horas & Productividad',
    'rep.btn_export_excel': 'Descargar Excel',
    'rep.btn_export_csv': 'Descargar CSV',
    'rep.btn_print_pdf': 'Imprimir / PDF Ejecutivo',
    'rep.btn_guardar_filtro': 'Guardar como Favorito',

    // Toasts
    'toast.sesion_iniciada': '¡Sesión iniciada con éxito! Bienvenido',
    'toast.sesion_cerrada': 'Sesión cerrada correctamente',
    'toast.cambio_guardado': 'Cambios guardados con éxito',
    'toast.acceso_denegado': 'Acceso restringido: no tienes permisos para realizar esta acción.',
    'toast.solo_admin': 'Esta sección es exclusiva para el Administrador del sistema.'
  },

  pt: {
    // Header
    'header.portal_titulo': 'Portal Gestão de Changes',
    'header.subtitulo': 'Regra global: máx. 30h por Change • Controle de Perfis & SLA',
    'header.online': 'Online',
    'header.periodo': 'Período:',
    'header.sync': 'Sync',
    'header.excel': 'Excel',
    'header.exportar': 'Exportar',
    'header.nueva_change': '+ Change',
    'header.mi_perfil': 'Meu Perfil',
    'header.cambiar_pass': 'Alterar Senha',

    // Navegação
    'nav.kanban': 'Kanban',
    'nav.matriz': 'Matriz',
    'nav.dashboard': 'Dashboard',
    'nav.reportes': 'Relatórios & SLA',
    'nav.backlog': 'Backlog',
    'nav.historial': 'Histórico',
    'nav.paises': 'Países',
    'nav.usuarios': 'Usuários',
    'nav.branding': 'Logo & Marca',

    // Filtros
    'filtro.buscar': 'Pesquisar...',
    'filtro.todos_paises': 'Todos os Países',
    'filtro.todos_solicitantes': 'Solicitantes',
    'filtro.todos_services': 'Business Services',
    'filtro.todos_productos': 'Produtos',
    'filtro.todos_estados': 'Status',

    // Fases Kanban
    'fase.1_abertura': '1. Abertura',
    'fase.2_reuniao': '2. Reunião',
    'fase.3_analise': '3. Análise',
    'fase.4_comite': '4. Comitê',
    'fase.5_apresentacao': '5. Apresentação',
    'fase.6_aprovacao': '6. Aprovação',
    'fase.7_execucao': '7. Execução',
    'fase.8_concluida': '8. Concluída',

    // KPIs & Capacidade
    'kpi.capacidad_mes': 'Capacidade do Mês',
    'kpi.disponibles': 'Disponíveis',
    'kpi.utilizadas': 'Utilizadas',
    'kpi.restantes': 'Restantes',
    'kpi.pct_uso': '% Uso',
    'kpi.comprometidas': 'Comprometidas',
    'kpi.total_changes': 'Changes',
    'kpi.promedio': 'Média',
    'kpi.sobre_limite': 'Acima do Limite',
    'kpi.mejoras': 'Melhorias',
    'kpi.distribucion_prod': 'Distribuição por Produto',
    'kpi.sobrecapacidad_alerta': 'Capacidade excedida! Excesso:',

    // Dashboard
    'dash.comparativo_mensual': 'Comparativo Mensal de Capacidade e Uso',
    'dash.mes_anterior': 'Mês Anterior:',
    'dash.mes_actual': 'Mês Atual:',
    'dash.acumulado_titulo': 'Acumulado Total do Período / Histórico',
    'dash.acumulado_sub': 'Consolidado acumulado de todos os períodos registrados para o mercado selecionado.',
    'dash.horas_acumuladas': 'Horas Acumuladas',
    'dash.capacidad_acumulada': 'Capacidade Total',
    'dash.consumo_acumulado': '% Consumo Acum.',
    'dash.changes_acumuladas': 'Changes Acumuladas',
    'dash.promedio_mensual': 'Média Mensal',

    // Login & Auth
    'login.titulo': 'Portal de Gestão de Changes',
    'login.subtitulo': 'Inicie sessão para acessar o sistema de gestão e capacidade',
    'login.usuario': 'Usuário ou E-mail',
    'login.usuario_placeholder': 'usuario@nestle.com ou nome de usuário',
    'login.password': 'Senha',
    'login.boton_entrar': 'Iniciar Sessão',
    'login.olvido_password': 'Esqueceu sua senha?',
    'login.demo_credentials': 'Credenciais de demonstração rápida:',
    'login.error_credenciales': 'Usuário ou senha incorretos.',
    'login.error_inactivo': 'Esta conta de usuário está inativa.',
    'login.primer_acceso_titulo': 'Alteração Obrigatória de Senha',
    'login.primer_acceso_subtitulo': 'Por segurança institucional, você deve atualizar sua senha temporária antes de prosseguir.',
    'login.pass_actual': 'Senha Atual / Temporária *',
    'login.pass_nueva': 'Nova Senha *',
    'login.pass_confirmar': 'Confirmar Nova Senha *',
    'login.pass_requisitos': 'Mínimo de 8 caracteres, pelo menos 1 número e 1 letra maiúscula.',
    'login.btn_guardar_pass': 'Atualizar Senha e Entrar',
    'login.logout_confirm_titulo': 'Deseja realmente encerrar a sessão?',
    'login.logout_confirm_desc': 'Sua sessão ativa será encerrada e você precisará se autenticar novamente.',
    'login.btn_cancelar': 'Cancelar',
    'login.btn_cerrar_sesion': 'Encerrar Sessão',

    // Usuarios & Roles
    'usr.titulo': 'Controle de Usuários e Permissões',
    'usr.subtitulo': 'Gerencie contas, senhas e atribua perfis e Business Services autorizados.',
    'usr.nombre': 'Nome *',
    'usr.apellido': 'Sobrenome *',
    'usr.usuario': 'Usuário *',
    'usr.email': 'E-mail *',
    'usr.pass_inicial': 'Senha Inicial *',
    'usr.pass_confirmar': 'Confirmar Senha *',
    'usr.rol': 'Perfil / Nível de Acesso *',
    'usr.business_services': 'Business Services Autorizados *',
    'usr.idioma': 'Idioma Preferido',
    'usr.btn_crear': 'Registrar Novo Usuário',

    // Formulario Change
    'form.titulo_nuevo': '+ Nova Solicitação de Change',
    'form.titulo_editar': 'Editar Change',
    'form.titulo_consulta': 'Detalhes da Change (Somente Leitura)',
    'form.subtitulo_obligatorios': 'Os 5 campos marcados com (*) são obrigatórios',
    'form.btn_cerrar': 'Fechar',

    // Reportes & SLA
    'rep.titulo': 'Módulo de Relatórios & Monitoramento de SLA',
    'rep.subtitulo': 'Análise executiva, detalhada e tempos por etapa com segregação por Business Service.',
    'rep.tab_exec': 'Relatório Executivo',
    'rep.tab_detailed': 'Relatório Detalhado',
    'rep.tab_sla': 'Análise de SLA & Aging',
    'rep.tab_hours': 'Análise de Horas & Produtividade',
    'rep.btn_export_excel': 'Baixar Excel',
    'rep.btn_export_csv': 'Baixar CSV',
    'rep.btn_print_pdf': 'Imprimir / PDF Executivo',
    'rep.btn_guardar_filtro': 'Salvar como Favorito',

    // Toasts
    'toast.sesion_iniciada': 'Sessão iniciada com sucesso! Bem-vindo',
    'toast.sesion_cerrada': 'Sessão encerrada com sucesso',
    'toast.cambio_guardado': 'Alterações salvas com sucesso',
    'toast.acceso_denegado': 'Acesso negado: você não tem permissão para realizar esta ação.',
    'toast.solo_admin': 'Esta seção é exclusiva para o Administrador do sistema.'
  },

  en: {
    // Header
    'header.portal_titulo': 'Change Management Portal',
    'header.subtitulo': 'Global rule: max 30h per Change • Role Control & SLA Monitoring',
    'header.online': 'Online',
    'header.periodo': 'Period:',
    'header.sync': 'Sync',
    'header.excel': 'Excel',
    'header.exportar': 'Export',
    'header.nueva_change': '+ Change',
    'header.mi_perfil': 'My Profile',
    'header.cambiar_pass': 'Change Password',

    // Navigation
    'nav.kanban': 'Kanban',
    'nav.matriz': 'Matrix',
    'nav.dashboard': 'Dashboard',
    'nav.reportes': 'Reports & SLA',
    'nav.backlog': 'Backlog',
    'nav.historial': 'Audit Log',
    'nav.paises': 'Countries',
    'nav.usuarios': 'Users',
    'nav.branding': 'Logo & Brand',

    // Filters
    'filtro.buscar': 'Search...',
    'filtro.todos_paises': 'All Countries',
    'filtro.todos_solicitantes': 'Requesters',
    'filtro.todos_services': 'Business Services',
    'filtro.todos_productos': 'Products',
    'filtro.todos_estados': 'Statuses',

    // Phases Kanban
    'fase.1_abertura': '1. Draft',
    'fase.2_reuniao': '2. Assess',
    'fase.3_analise': '3. Authorize',
    'fase.4_comite': '4. Committee',
    'fase.5_apresentacao': '5. Review',
    'fase.6_aprovacao': '6. Approval',
    'fase.7_execucao': '7. Build / Execute',
    'fase.8_concluida': '8. Closed',

    // KPIs & Capacity
    'kpi.capacidad_mes': 'Monthly Capacity',
    'kpi.disponibles': 'Available',
    'kpi.utilizadas': 'Used',
    'kpi.restantes': 'Remaining',
    'kpi.pct_uso': '% Usage',
    'kpi.comprometidas': 'Committed',
    'kpi.total_changes': 'Changes',
    'kpi.promedio': 'Average',
    'kpi.sobre_limite': 'Over Limit',
    'kpi.mejoras': 'Enhancements',
    'kpi.distribucion_prod': 'Distribution by Product',
    'kpi.sobrecapacidad_alerta': 'Capacity exceeded! Overrun:',

    // Dashboard
    'dash.comparativo_mensual': 'Monthly Capacity and Usage Comparison',
    'dash.mes_anterior': 'Previous Month:',
    'dash.mes_actual': 'Current Month:',
    'dash.acumulado_titulo': 'Total Accumulated Period / Historical',
    'dash.acumulado_sub': 'Accumulated consolidate across all recorded periods for the selected market.',
    'dash.horas_acumuladas': 'Accumulated Hours',
    'dash.capacidad_acumulada': 'Total Capacity',
    'dash.consumo_acumulado': '% Acc. Consumption',
    'dash.changes_acumuladas': 'Accumulated Changes',
    'dash.promedio_mensual': 'Monthly Average',

    // Login & Auth
    'login.titulo': 'Change Management Portal',
    'login.subtitulo': 'Sign in to access change governance and capacity management',
    'login.usuario': 'Username or Email',
    'login.usuario_placeholder': 'user@nestle.com or username',
    'login.password': 'Password',
    'login.boton_entrar': 'Sign In',
    'login.olvido_password': 'Forgot your password?',
    'login.demo_credentials': 'Quick demonstration credentials:',
    'login.error_credenciales': 'Invalid username or password.',
    'login.error_inactivo': 'This user account is currently inactive.',
    'login.primer_acceso_titulo': 'Mandatory Password Change',
    'login.primer_acceso_subtitulo': 'For corporate security policies, you must update your temporary password before continuing.',
    'login.pass_actual': 'Current / Temporary Password *',
    'login.pass_nueva': 'New Password *',
    'login.pass_confirmar': 'Confirm New Password *',
    'login.pass_requisitos': 'Minimum 8 characters, at least 1 number and 1 uppercase letter.',
    'login.btn_guardar_pass': 'Update Password and Sign In',
    'login.logout_confirm_titulo': 'Do you really want to sign out?',
    'login.logout_confirm_desc': 'Your active session will be terminated and you will need to authenticate again.',
    'login.btn_cancelar': 'Cancel',
    'login.btn_cerrar_sesion': 'Sign Out',

    // Users & Roles
    'usr.titulo': 'User & Access Control',
    'usr.subtitulo': 'Manage accounts, passwords and assign authorized Business Services and roles.',
    'usr.nombre': 'First Name *',
    'usr.apellido': 'Last Name *',
    'usr.usuario': 'Username *',
    'usr.email': 'Email Address *',
    'usr.pass_inicial': 'Initial Password *',
    'usr.pass_confirmar': 'Confirm Password *',
    'usr.rol': 'Profile / Access Level *',
    'usr.business_services': 'Authorized Business Services *',
    'usr.idioma': 'Preferred Language',
    'usr.btn_crear': 'Register New User',

    // Change Form
    'form.titulo_nuevo': '+ New Change Request',
    'form.titulo_editar': 'Edit Change',
    'form.titulo_consulta': 'Change Details (Read-Only)',
    'form.subtitulo_obligatorios': 'The 5 fields marked with (*) are required',
    'form.btn_cerrar': 'Close',

    // Reports & SLA
    'rep.titulo': 'Reports & SLA Monitoring Module',
    'rep.subtitulo': 'Executive analysis, detailed query, aging and stage bottleneck monitoring.',
    'rep.tab_exec': 'Executive Report',
    'rep.tab_detailed': 'Detailed Report',
    'rep.tab_sla': 'SLA & Aging Analysis',
    'rep.tab_hours': 'Hours & Productivity',
    'rep.btn_export_excel': 'Download Excel',
    'rep.btn_export_csv': 'Download CSV',
    'rep.btn_print_pdf': 'Print / Executive PDF',
    'rep.btn_guardar_filtro': 'Save as Favorite',

    // Toasts
    'toast.sesion_iniciada': 'Signed in successfully! Welcome',
    'toast.sesion_cerrada': 'Signed out successfully',
    'toast.cambio_guardado': 'Changes saved successfully',
    'toast.acceso_denegado': 'Access denied: you do not have permission for this action.',
    'toast.solo_admin': 'This section is restricted to System Administrators.'
  }
};

let idiomaActual = localStorage.getItem('nestle_app_idioma') || 'es';

function t(clave) {
  const dict = DICCIONARIO_I18N[idiomaActual] || DICCIONARIO_I18N['es'];
  return dict[clave] || DICCIONARIO_I18N['es'][clave] || clave;
}

function cambiarIdiomaApp(nuevoIdioma) {
  if (!['es', 'pt', 'en'].includes(nuevoIdioma)) return;
  idiomaActual = nuevoIdioma;
  localStorage.setItem('nestle_app_idioma', nuevoIdioma);
  actualizarBotonIdiomaHeader();
  traducirTodaLaInterfaz();
  if (typeof renderizarTodo === 'function') {
    renderizarTodo();
  }
}

function actualizarBotonIdiomaHeader() {
  const btn = document.getElementById('btnSelectorIdioma');
  if (!btn) return;
  const labels = {
    es: '<span>🇪🇸</span> <span class="hidden sm:inline">Español</span> <i class="fa-solid fa-chevron-down text-[9px] opacity-70"></i>',
    pt: '<span>🇧🇷</span> <span class="hidden sm:inline">Português</span> <i class="fa-solid fa-chevron-down text-[9px] opacity-70"></i>',
    en: '<span>🇺🇸</span> <span class="hidden sm:inline">English</span> <i class="fa-solid fa-chevron-down text-[9px] opacity-70"></i>'
  };
  btn.innerHTML = labels[idiomaActual] || labels['es'];
}

function traducirTodaLaInterfaz() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const clave = el.getAttribute('data-i18n');
    el.textContent = t(clave);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const clave = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(clave);
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const clave = el.getAttribute('data-i18n-title');
    el.title = t(clave);
  });
}
