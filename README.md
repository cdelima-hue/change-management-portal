# 🚀 Portal de Gestión de Changes IT Enterprise (v7.0 Production)

Sistema corporativo full-stack para la gestión, gobernanza ITIL, control de capacidad, seguimiento de SLAs y reportería ejecutiva de solicitudes de Changes y requerimientos IT multi-mercado (Brasil, México, Argentina, Chile, Colombia y Global).

---

## 🏗️ Arquitectura del Proyecto

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (SPA Web UI)                      │
│   HTML5 + TailwindCSS + FontAwesome + Chart.js + SheetJS        │
│   Kanban | Matriz | Dashboard | Reportes | Usuarios | Catálogos │
└───────────────────────────────┬─────────────────────────────────┘
                                │  REST API (JSON + Bearer JWT)
┌───────────────────────────────▼─────────────────────────────────┐
│                      BACKEND (Node.js / Express)                │
│   server.js — Autenticación, Validaciones, Control de Acceso,   │
│   Manejo de Errores, Healthcheck (/api/health) y Concurrencia   │
└───────────────────────────────┬─────────────────────────────────┘
                                │  Pool Conexión SSL
┌───────────────────────────────▼─────────────────────────────────┐
│                 BASE DE DATOS (PostgreSQL / Render)             │
│   Tablas: users, countries, business_services, products,        │
│   changes, audit_logs, settings (con migraciones automáticas)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Características Principales

1. **Gestión Totalmente Administrable de Catálogos (En Base de Datos)**:
   - **Business Services**: Crear, editar, consultar y eliminar con verificación de dependencias (no permite borrar si está en uso por Changes).
   - **Países / Mercados**: Configuración de horas de capacidad mensual y color identificador.
   - **Productos / Líneas**: Asignación por mercado con protección contra eliminación en cascada.
   - Botones rápidos **`+ Nuevo`** y **`⚙️ Administrar`** integrados directamente en el formulario de creación de Changes.
2. **Seguridad y Segregación de Datos por Business Service**:
   - Roles jerárquicos: `Administrador Global`, `Administrador de Business Service`, `Edición` y `Lectura`.
   - Filtrado en capa lógica en backend y frontend para evitar fugas de información.
3. **Control de Tiempo y Monitoreo de SLA**:
   - Alerta de inactividad de **5 días por etapa** (🟢 Normal <3d, 🟡 Atención 3-4d, 🟠 Alerta 5d, 🔴 Crítico >5d).
   - Regla de **SLA de 20 días totales** con diagnóstico visual y textual (`🚨 FUERA DEL SLA (+Xd)`).
   - Ranking interactivo de cuellos de botella por fase.
4. **Módulo Completo de Reportes Ejecutivos & SLA**:
   - 4 Sub-vistas: Reporte Ejecutivo, Detallado (Multi-filtros), SLA & Aging, y Horas & Productividad.
   - Exportación directa a **Excel (.xlsx)**, **CSV** y **PDF / Impresión Ejecutiva**.
   - Guardado de **Filtros Favoritos** en base de datos.
5. **Autenticación SHA-256 & Sesiones Seguras**:
   - Cambio obligatorio de contraseña en el primer acceso.
   - Perfil de usuario y soporte multi-idioma (Español 🇪🇸, Português 🇧🇷, English 🇺🇸).

---

## ☁️ Guía de Despliegue en Render (render.com)

La aplicación está 100% lista para ser desplegada en **Render** utilizando dos métodos:

### Opción A: Despliegue Automático con Blueprint (Recomendado ⭐)

1. Sube este repositorio a tu cuenta de **GitHub** o **GitLab**.
2. Entra a tu panel de control en [https://dashboard.render.com](https://dashboard.render.com/).
3. Haz clic en **New +** y selecciona **Blueprint**.
4. Conecta tu repositorio.
5. Render detectará automáticamente el archivo [`render.yaml`](render.yaml) y creará:
   - La base de datos PostgreSQL administrada (`nestle-changes-db`).
   - El Web Service de Node.js (`portal-gestion-changes`).
   - La vinculación automática de la variable de entorno `DATABASE_URL`.
6. Haz clic en **Apply**. En 2 a 3 minutos tu aplicación estará funcionando en producción con URL HTTPS pública.

---

### Opción B: Despliegue Manual Paso a Paso

Si prefieres crear los servicios manualmente en Render:

#### Paso 1: Crear la Base de Datos PostgreSQL
1. En Render Dashboard, haz clic en **New +** > **PostgreSQL**.
2. Configura los campos:
   - **Name**: `nestle-changes-db`
   - **Database**: `change_management_db`
   - **User**: `nestle_admin`
   - **Region**: Oregon (o la más cercana)
   - **Plan**: Free (o Starter)
3. Haz clic en **Create Database**.
4. Espera a que esté disponible y copia la **Internal Database URL** (o *External Database URL* si estás fuera de Render).

#### Paso 2: Crear el Web Service
1. En Render Dashboard, haz clic en **New +** > **Web Service**.
2. Conecta tu repositorio de GitHub.
3. Configura los siguientes parámetros:
   - **Name**: `portal-gestion-changes`
   - **Language / Environment**: `Node`
   - **Region**: Misma región de la base de datos
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (o Starter)

#### Paso 3: Configurar las Variables de Entorno en el Web Service
En la sección **Environment Variables** del Web Service, agrega:

| Variable | Valor | Descripción |
|---|---|---|
| `NODE_ENV` | `production` | Modo de ejecución optimizado |
| `DATABASE_URL` | *(Pega la Internal Database URL copiada en el Paso 1)* | Conexión con PostgreSQL |
| `JWT_SECRET` | `UnaClaveSecretaMuySegura2026!` | Llave para firma de tokens de sesión |
| `PORT` | `10000` | Puerto asignado por Render |

4. Haz clic en **Deploy Web Service**.

---

## 🔍 Verificación Post-Despliegue

1. **Health Check**: Ingresa a `https://tu-app-en-render.onrender.com/api/health`. Deberás ver:
   ```json
   {
     "status": "ok",
     "database": "PostgreSQL (Cloud / Render)",
     "version": "7.0.0-production",
     "timestamp": "2026-09-22T..."
   }
   ```
2. **Migración Automática**: El backend crea automáticamente todas las tablas, índices y datos iniciales en la primera ejecución.
3. **Acceso Inicial con Credenciales Predeterminadas**:
   - **Administrador Global**: Usuario `admin` | Contraseña `Nestle2026!`
   - **Editor México**: Usuario `cmendoza` | Contraseña `Nestle2026!`
   - **Lector Brasil**: Usuario `msilva` | Contraseña `Nestle2026!`
   - **Admin BS Brasil**: Usuario `jsilva` | Contraseña `Nestle2026!`

---

## 💻 Ejecución Local (Desarrollo)

Para ejecutar la aplicación localmente en tu equipo:

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor (utiliza base de datos local persistente .data/portal.json o PostgreSQL si configuras DATABASE_URL)
npm start
```

Abre tu navegador en: `http://localhost:3000`
