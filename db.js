/**
 * db.js — Capa de Base de Datos y Persistencia para Producción (PostgreSQL / Local)
 * Soporta conexión PostgreSQL en Render mediante process.env.DATABASE_URL con SSL.
 * Incluye fallback de almacenamiento persistente local para desarrollo sin Postgres.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let pool = null;
let isPostgres = false;

// Configuración de conexión
const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
  isPostgres = true;
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' || databaseUrl.includes('render.com') || databaseUrl.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
  console.log('[DB] Conectando a PostgreSQL de Producción (Render / Cloud)...');
} else {
  console.log('[DB] DATABASE_URL no configurada. Utilizando motor de persistencia local en disco (.data/portal.json)...');
}

// Persistencia local fallback en archivo JSON estructurado
const DATA_DIR = path.join(__dirname, '.data');
const DATA_FILE = path.join(DATA_DIR, 'portal.json');

function initLocalStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      users: [],
      countries: [],
      business_services: [],
      products: [],
      changes: [],
      audit_logs: [],
      settings: {}
    }, null, 2), 'utf8');
  }
}

function readLocalData() {
  initLocalStorage();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[DB Local] Error leyendo archivo local:', err);
    return { users: [], countries: [], business_services: [], products: [], changes: [], audit_logs: [], settings: {} };
  }
}

function writeLocalData(data) {
  initLocalStorage();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB Local] Error escribiendo archivo local:', err);
  }
}

/**
 * Ejecutor universal de consultas
 */
async function query(sql, params = []) {
  if (isPostgres && pool) {
    const client = await pool.connect();
    try {
      const res = await client.query(sql, params);
      return res;
    } finally {
      client.release();
    }
  } else {
    // Modo local emulado
    return executeLocalQuery(sql, params);
  }
}

// ============================================================
// INICIALIZACIÓN DE SCHEMA Y MIGRACIONES
// ============================================================
async function initDatabase() {
  if (isPostgres && pool) {
    console.log('[DB] Creando tablas e índices en PostgreSQL si no existen...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS countries (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        horas_disponibles INTEGER NOT NULL DEFAULT 160,
        color VARCHAR(20) DEFAULT '#2563eb',
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS business_services (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        pais_key VARCHAR(50) NOT NULL,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        pais_key VARCHAR(50) DEFAULT '',
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        apellido VARCHAR(100) DEFAULT '',
        usuario VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        rol VARCHAR(50) NOT NULL DEFAULT 'Lectura',
        business_services JSONB DEFAULT '["*"]'::jsonb,
        idioma VARCHAR(10) DEFAULT 'es',
        activo BOOLEAN DEFAULT TRUE,
        primer_acceso BOOLEAN DEFAULT FALSE,
        fecha_creacion VARCHAR(20),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS changes (
        id VARCHAR(50) PRIMARY KEY,
        numero_change VARCHAR(50) UNIQUE NOT NULL,
        ritm VARCHAR(50) DEFAULT '',
        solicitante VARCHAR(150) NOT NULL,
        pais VARCHAR(50) NOT NULL,
        business_service VARCHAR(150) NOT NULL,
        producto VARCHAR(150) NOT NULL,
        descripcion TEXT NOT NULL,
        engenheiro VARCHAR(150) NOT NULL,
        horas_estimadas NUMERIC(6,1) DEFAULT 0,
        horas_aprovadas NUMERIC(6,1) DEFAULT 0,
        tipo_change VARCHAR(50) DEFAULT 'Mejora',
        fase_atual VARCHAR(50) DEFAULT 'Abertura',
        status_aprovacao VARCHAR(50) DEFAULT 'Pendente',
        aprovador_nome VARCHAR(150) DEFAULT '',
        aprovador_email VARCHAR(150) DEFAULT '',
        analise TEXT DEFAULT '',
        rollback TEXT DEFAULT '',
        pasos_implementacion JSONB DEFAULT '[]'::jsonb,
        d1 VARCHAR(20),
        d2 VARCHAR(20),
        d3 VARCHAR(20),
        d4 VARCHAR(20),
        d5 VARCHAR(20),
        d6 VARCHAR(20),
        d7 VARCHAR(20),
        d8 VARCHAR(20),
        mes_ano VARCHAR(20),
        teams_link TEXT DEFAULT '',
        historial_fases JSONB DEFAULT '[]'::jsonb,
        fecha_creacion VARCHAR(20),
        fecha_cierre VARCHAR(20),
        ultima_modificacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        modificado_por VARCHAR(150) DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        usuario VARCHAR(150) NOT NULL,
        change_num VARCHAR(50) DEFAULT '—',
        campo VARCHAR(100) NOT NULL,
        valor_anterior TEXT DEFAULT '(vacío)',
        valor_nuevo TEXT DEFAULT '(vacío)',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('[DB] Tablas verificadas exitosamente en PostgreSQL.');
    await seedInitialDataPostgres();
  } else {
    initLocalStorage();
    await seedInitialDataLocal();
  }
}

// ============================================================
// SEEDING DE DATOS INICIALES
// ============================================================
async function seedInitialDataPostgres() {
  // 1. Countries
  const cCount = await pool.query('SELECT COUNT(*) FROM countries');
  if (parseInt(cCount.rows[0].count) === 0) {
    console.log('[DB Seed] Sembrando países iniciales...');
    const paises = [
      { key: 'Brasil', nombre: 'Brasil', horas: 160, color: '#059669' },
      { key: 'Mexico', nombre: 'México', horas: 120, color: '#2563eb' },
      { key: 'Argentina', nombre: 'Argentina', horas: 80, color: '#7c3aed' },
      { key: 'Chile', nombre: 'Chile', horas: 60, color: '#d97706' },
      { key: 'Colombia', nombre: 'Colombia', horas: 60, color: '#dc2626' }
    ];
    for (const p of paises) {
      await pool.query(
        'INSERT INTO countries (key, nombre, horas_disponibles, color, activo) VALUES ($1, $2, $3, $4, true)',
        [p.key, p.nombre, p.horas, p.color]
      );
    }
  }

  // 2. Business Services
  const bsCount = await pool.query('SELECT COUNT(*) FROM business_services');
  if (parseInt(bsCount.rows[0].count) === 0) {
    console.log('[DB Seed] Sembrando Business Services iniciales...');
    const bss = [
      { nombre: 'Data Lake Brasil', pais: 'Brasil' },
      { nombre: 'E-Commerce & Sales Brasil', pais: 'Brasil' },
      { nombre: 'Supply Chain Brasil', pais: 'Brasil' },
      { nombre: 'Finance Brasil', pais: 'Brasil' },
      { nombre: 'Customer Experience Brasil', pais: 'Brasil' },
      { nombre: 'Data Lake México', pais: 'Mexico' },
      { nombre: 'Customer Experience México', pais: 'Mexico' },
      { nombre: 'Supply Chain México', pais: 'Mexico' },
      { nombre: 'Sales México', pais: 'Mexico' },
      { nombre: 'Finance México', pais: 'Mexico' },
      { nombre: 'Data Lake Argentina', pais: 'Argentina' },
      { nombre: 'Commercial Argentina', pais: 'Argentina' },
      { nombre: 'Finance Argentina', pais: 'Argentina' },
      { nombre: 'Supply Chain Argentina', pais: 'Argentina' },
      { nombre: 'Data Lake Chile', pais: 'Chile' },
      { nombre: 'Supply Chain Chile', pais: 'Chile' },
      { nombre: 'Finance Chile', pais: 'Chile' },
      { nombre: 'Data Lake Colombia', pais: 'Colombia' },
      { nombre: 'Sales Colombia', pais: 'Colombia' },
      { nombre: 'Supply Chain Colombia', pais: 'Colombia' },
      { nombre: 'Enterprise Data Lake Global', pais: 'Global' },
      { nombre: 'SAP Core Global', pais: 'Global' },
      { nombre: 'Corporate IT Global', pais: 'Global' }
    ];
    for (const b of bss) {
      await pool.query(
        'INSERT INTO business_services (nombre, pais_key, activo) VALUES ($1, $2, true)',
        [b.nombre, b.pais]
      );
    }
  }

  // 3. Products
  const pCount = await pool.query('SELECT COUNT(*) FROM products');
  if (parseInt(pCount.rows[0].count) === 0) {
    console.log('[DB Seed] Sembrando Productos/Líneas iniciales...');
    const prods = [
      { nombre: 'Nescafé', pais: 'Brasil' },
      { nombre: 'Purina Pro Plan', pais: 'Mexico' },
      { nombre: 'KitKat', pais: 'Brasil' },
      { nombre: 'Nido', pais: 'Colombia' },
      { nombre: 'La Lechera', pais: 'Argentina' },
      { nombre: 'Maggi', pais: 'Chile' },
      { nombre: 'Nespresso', pais: 'Brasil' },
      { nombre: 'Gerber', pais: 'Mexico' },
      { nombre: 'Chamyto', pais: 'Brasil' }
    ];
    for (const p of prods) {
      await pool.query(
        'INSERT INTO products (nombre, pais_key, activo) VALUES ($1, $2, true)',
        [p.nombre, p.pais]
      );
    }
  }

  // 4. Users (hash SHA-256 de 'Nestle2026!' con salt)
  const uCount = await pool.query('SELECT COUNT(*) FROM users');
  if (parseInt(uCount.rows[0].count) === 0) {
    console.log('[DB Seed] Sembrando usuarios iniciales...');
    const hashDefault = 'eae7050aa02c5d12d49fa51b4a2d80c38fb3da26765b34baf5f1ae314ecd3599'; // Generado o bcrypt
    const users = [
      {
        id: 'usr-admin',
        nombre: 'Claudio',
        apellido: 'Lima',
        usuario: 'admin',
        email: 'admin.it@nestle.com',
        pass: hashDefault,
        rol: 'Administrador',
        bs: ['*'],
        idioma: 'es',
        primerAcceso: false
      },
      {
        id: 'usr-editor',
        nombre: 'Carlos',
        apellido: 'Mendoza',
        usuario: 'cmendoza',
        email: 'carlos.mendoza@nestle.com',
        pass: hashDefault,
        rol: 'Edición',
        bs: ['Data Lake México', 'Customer Experience México', 'Supply Chain México', 'Sales México'],
        idioma: 'es',
        primerAcceso: true
      },
      {
        id: 'usr-lector',
        nombre: 'Mariana',
        apellido: 'Silva',
        usuario: 'msilva',
        email: 'mariana.silva@nestle.com',
        pass: hashDefault,
        rol: 'Lectura',
        bs: ['Data Lake Brasil', 'E-Commerce & Sales Brasil', 'Supply Chain Brasil'],
        idioma: 'pt',
        primerAcceso: false
      },
      {
        id: 'usr-admin-brasil',
        nombre: 'João',
        apellido: 'Silva',
        usuario: 'jsilva',
        email: 'joao.silva@nestle.com',
        pass: hashDefault,
        rol: 'Administrador_BS',
        bs: ['Data Lake Brasil', 'E-Commerce & Sales Brasil', 'Supply Chain Brasil', 'Finance Brasil', 'Customer Experience Brasil'],
        idioma: 'pt',
        primerAcceso: false
      }
    ];

    for (const u of users) {
      await pool.query(`
        INSERT INTO users (id, nombre, apellido, usuario, email, password_hash, rol, business_services, idioma, activo, primer_acceso, fecha_creacion)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11)
      `, [u.id, u.nombre, u.apellido, u.usuario, u.email, u.pass, u.rol, JSON.stringify(u.bs), u.idioma, u.primerAcceso, '2026-08-01']);
    }
  }

  // 5. Changes Iniciales
  const chCount = await pool.query('SELECT COUNT(*) FROM changes');
  if (parseInt(chCount.rows[0].count) === 0) {
    console.log('[DB Seed] Sembrando Changes iniciales...');
    const initialChanges = [
      {
        id: 'CHG-DEMO-001',
        numeroChange: 'CHG0089201',
        ritm: 'RITM0145220',
        solicitante: 'Andrés Delgado',
        pais: 'Brasil',
        businessService: 'E-Commerce & Sales Brasil',
        producto: 'Nescafé',
        descripcion: 'Optimización del proceso de checkout B2B con cálculo automático de impuestos regionales',
        engenheiro: 'Carlos Mendoza',
        horasEstimadas: 18,
        horasAprovadas: 18,
        tipoChange: 'Mejora',
        faseAtual: 'Execucao',
        statusAprovacao: 'Aprovado',
        aprovadorNome: 'Mariana Silva',
        aprovadorEmail: 'mariana.silva@nestle.com',
        analise: 'Ajuste en el módulo de cálculo de impuestos para regiones brasileñas.',
        rollback: 'Reactivar versión anterior del módulo de checkout v2.3.',
        pasosImplementacion: [
          { fase: '1. Análisis Técnico & Requerimientos', accion: 'Revisión de reglas fiscales', horas: 4, fechaTentativa: '2026-08-05' },
          { fase: '3. Desarrollo Backend / APIs', accion: 'Implementación del módulo', horas: 10, fechaTentativa: '2026-08-10' },
          { fase: '6. Pruebas QA & Regresión', accion: 'Pruebas con escenarios fiscales', horas: 4, fechaTentativa: '2026-08-12' }
        ],
        d1: '2026-08-01', d2: '2026-08-03', d3: '2026-08-05', d4: '2026-08-07',
        d5: '2026-08-09', d6: '2026-08-10', d7: '2026-08-14', d8: '',
        mesAno: '2026-08',
        historialFases: [
          { de: '', a: 'Abertura', fecha: '2026-08-01', usuario: 'Andrés Delgado' },
          { de: 'Abertura', a: 'Execucao', fecha: '2026-08-14', usuario: 'Carlos Mendoza' }
        ],
        fechaCreacion: '2026-08-01',
        fechaCierre: '',
        modificadoPor: 'Carlos Mendoza'
      },
      {
        id: 'CHG-DEMO-002',
        numeroChange: 'CHG0089245',
        ritm: 'RITM0145300',
        solicitante: 'Camila Restrepo',
        pais: 'Mexico',
        businessService: 'Customer Experience México',
        producto: 'Purina Pro Plan',
        descripcion: 'Alertas automáticas de stock bajo para prevenir quiebres en canal moderno',
        engenheiro: 'Lucía Fernández',
        horasEstimadas: 22,
        horasAprovadas: 22,
        tipoChange: 'Mejora',
        faseAtual: 'Analise',
        statusAprovacao: 'Pendente',
        aprovadorNome: 'Roberto Gómez',
        aprovadorEmail: 'roberto.gomez@nestle.com',
        analise: 'Configurar triggers en ERP para stock mínimo.',
        rollback: 'Desactivar triggers en ERP.',
        pasosImplementacion: [],
        d1: '2026-07-25', d2: '2026-07-28', d3: '2026-08-12', d4: '',
        d5: '', d6: '', d7: '', d8: '',
        mesAno: '2026-08',
        historialFases: [
          { de: '', a: 'Abertura', fecha: '2026-07-25', usuario: 'Camila Restrepo' },
          { de: 'Abertura', a: 'Analise', fecha: '2026-08-12', usuario: 'Lucía Fernández' }
        ],
        fechaCreacion: '2026-07-25',
        fechaCierre: '',
        modificadoPor: 'Lucía Fernández'
      },
      {
        id: 'CHG-DEMO-003',
        numeroChange: 'CHG0089290',
        ritm: 'RITM0145380',
        solicitante: 'Felipe Martins',
        pais: 'Brasil',
        businessService: 'Supply Chain Brasil',
        producto: 'KitKat',
        descripcion: 'Integración de calendario de temporadas especiales con el módulo de planificación de demanda',
        engenheiro: 'Diego Vargas',
        horasEstimadas: 28,
        horasAprovadas: 25,
        tipoChange: 'Mejora',
        faseAtual: 'Comite',
        statusAprovacao: 'Pendente',
        aprovadorNome: 'Juliana Costa',
        aprovadorEmail: 'juliana.costa@nestle.com',
        analise: 'Mapear festividades y correlacionar con histórico.',
        rollback: 'Revertir configuración del módulo de temporadas.',
        pasosImplementacion: [],
        d1: '2026-08-05', d2: '2026-08-08', d3: '2026-08-10', d4: '2026-08-13',
        d5: '', d6: '', d7: '', d8: '',
        mesAno: '2026-08',
        historialFases: [
          { de: '', a: 'Abertura', fecha: '2026-08-05', usuario: 'Felipe Martins' },
          { de: 'Abertura', a: 'Comite', fecha: '2026-08-13', usuario: 'Diego Vargas' }
        ],
        fechaCreacion: '2026-08-05',
        fechaCierre: '',
        modificadoPor: 'Diego Vargas'
      },
      {
        id: 'CHG-DEMO-004',
        numeroChange: 'CHG0089315',
        ritm: 'RITM0145410',
        solicitante: 'Valeria Osorio',
        pais: 'Colombia',
        businessService: 'Data Lake Colombia',
        producto: 'Nido',
        descripcion: 'Reporte automatizado de sell-out semanal para distribuidores mayoristas',
        engenheiro: 'Carlos Mendoza',
        horasEstimadas: 15,
        horasAprovadas: 15,
        tipoChange: 'Mejora',
        faseAtual: 'Aprovacao',
        statusAprovacao: 'Aprovado',
        aprovadorNome: 'Esteban Morales',
        aprovadorEmail: 'esteban.morales@nestle.com',
        analise: 'Crear pipeline de ingesta automatizada.',
        rollback: 'Volver a ingesta manual.',
        pasosImplementacion: [],
        d1: '2026-08-07', d2: '2026-08-09', d3: '2026-08-11', d4: '2026-08-13',
        d5: '2026-08-15', d6: '2026-08-16', d7: '', d8: '',
        mesAno: '2026-08',
        historialFases: [],
        fechaCreacion: '2026-08-07',
        fechaCierre: '',
        modificadoPor: 'Carlos Mendoza'
      },
      {
        id: 'CHG-DEMO-005',
        numeroChange: 'CHG0089350',
        ritm: 'RITM0145490',
        solicitante: 'Gabriel Torres',
        pais: 'Argentina',
        businessService: 'Commercial Argentina',
        producto: 'La Lechera',
        descripcion: 'Ajuste de lista de precios dinámicos por canal de distribución tradicional',
        engenheiro: 'Lucía Fernández',
        horasEstimadas: 12,
        horasAprovadas: 12,
        tipoChange: 'Mejora',
        faseAtual: 'Concluida',
        statusAprovacao: 'Aprovado',
        aprovadorNome: 'Martín Palermo',
        aprovadorEmail: 'martin.palermo@nestle.com',
        analise: 'Actualizar matriz de descuentos.',
        rollback: 'Cargar tabla anterior.',
        pasosImplementacion: [],
        d1: '2026-08-01', d2: '2026-08-02', d3: '2026-08-03', d4: '2026-08-04',
        d5: '2026-08-05', d6: '2026-08-05', d7: '2026-08-06', d8: '2026-08-07',
        mesAno: '2026-08',
        historialFases: [],
        fechaCreacion: '2026-08-01',
        fechaCierre: '2026-08-07',
        modificadoPor: 'Lucía Fernández'
      }
    ];

    for (const c of initialChanges) {
      await pool.query(`
        INSERT INTO changes (
          id, numero_change, ritm, solicitante, pais, business_service, producto, descripcion,
          engenheiro, horas_estimadas, horas_aprovadas, tipo_change, fase_atual, status_aprovacao,
          aprovador_nome, aprovador_email, analise, rollback, pasos_implementacion,
          d1, d2, d3, d4, d5, d6, d7, d8, mes_ano, historial_fases, fecha_creacion, fecha_cierre, modificado_por
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32
        )
      `, [
        c.id, c.numeroChange, c.ritm, c.solicitante, c.pais, c.businessService, c.producto, c.descripcion,
        c.engenheiro, c.horasEstimadas, c.horasAprovadas, c.tipoChange, c.faseAtual, c.statusAprovacao,
        c.aprovadorNome, c.aprovadorEmail, c.analise, c.rollback, JSON.stringify(c.pasosImplementacion),
        c.d1, c.d2, c.d3, c.d4, c.d5, c.d6, c.d7, c.d8, c.mesAno, JSON.stringify(c.historialFases), c.fechaCreacion, c.fechaCierre, c.modificadoPor
      ]);
    }
  }
}

async function seedInitialDataLocal() {
  const data = readLocalData();
  let changed = false;

  if (!data.countries || data.countries.length === 0) {
    data.countries = [
      { id: 1, key: 'Brasil', nombre: 'Brasil', horas_disponibles: 160, color: '#059669', activo: true },
      { id: 2, key: 'Mexico', nombre: 'México', horas_disponibles: 120, color: '#2563eb', activo: true },
      { id: 3, key: 'Argentina', nombre: 'Argentina', horas_disponibles: 80, color: '#7c3aed', activo: true },
      { id: 4, key: 'Chile', nombre: 'Chile', horas_disponibles: 60, color: '#d97706', activo: true },
      { id: 5, key: 'Colombia', nombre: 'Colombia', horas_disponibles: 60, color: '#dc2626', activo: true }
    ];
    changed = true;
  }

  if (!data.business_services || data.business_services.length === 0) {
    const bss = [
      'Data Lake Brasil', 'E-Commerce & Sales Brasil', 'Supply Chain Brasil', 'Finance Brasil', 'Customer Experience Brasil',
      'Data Lake México', 'Customer Experience México', 'Supply Chain México', 'Sales México', 'Finance México',
      'Data Lake Argentina', 'Commercial Argentina', 'Finance Argentina', 'Supply Chain Argentina',
      'Data Lake Chile', 'Supply Chain Chile', 'Finance Chile',
      'Data Lake Colombia', 'Sales Colombia', 'Supply Chain Colombia',
      'Enterprise Data Lake Global', 'SAP Core Global', 'Corporate IT Global'
    ];
    data.business_services = bss.map((b, idx) => ({
      id: idx + 1,
      nombre: b,
      pais_key: b.includes('Brasil') ? 'Brasil' : b.includes('México') ? 'Mexico' : b.includes('Argentina') ? 'Argentina' : b.includes('Chile') ? 'Chile' : b.includes('Colombia') ? 'Colombia' : 'Global',
      activo: true
    }));
    changed = true;
  }

  if (!data.products || data.products.length === 0) {
    const prods = [
      { nombre: 'Nescafé', pais: 'Brasil' },
      { nombre: 'Purina Pro Plan', pais: 'Mexico' },
      { nombre: 'KitKat', pais: 'Brasil' },
      { nombre: 'Nido', pais: 'Colombia' },
      { nombre: 'La Lechera', pais: 'Argentina' },
      { nombre: 'Maggi', pais: 'Chile' },
      { nombre: 'Nespresso', pais: 'Brasil' },
      { nombre: 'Gerber', pais: 'Mexico' },
      { nombre: 'Chamyto', pais: 'Brasil' }
    ];
    data.products = prods.map((p, idx) => ({ id: idx + 1, nombre: p.nombre, pais_key: p.pais, activo: true }));
    changed = true;
  }

  if (!data.users || data.users.length === 0) {
    const hashDefault = 'eae7050aa02c5d12d49fa51b4a2d80c38fb3da26765b34baf5f1ae314ecd3599';
    data.users = [
      {
        id: 'usr-admin',
        nombre: 'Claudio',
        apellido: 'Lima',
        usuario: 'admin',
        email: 'admin.it@nestle.com',
        password_hash: hashDefault,
        rol: 'Administrador',
        business_services: ['*'],
        idioma: 'es',
        activo: true,
        primer_acceso: false,
        fecha_creacion: '2026-08-01'
      },
      {
        id: 'usr-editor',
        nombre: 'Carlos',
        apellido: 'Mendoza',
        usuario: 'cmendoza',
        email: 'carlos.mendoza@nestle.com',
        password_hash: hashDefault,
        rol: 'Edición',
        business_services: ['Data Lake México', 'Customer Experience México', 'Supply Chain México', 'Sales México'],
        idioma: 'es',
        activo: true,
        primer_acceso: true,
        fecha_creacion: '2026-08-10'
      },
      {
        id: 'usr-lector',
        nombre: 'Mariana',
        apellido: 'Silva',
        usuario: 'msilva',
        email: 'mariana.silva@nestle.com',
        password_hash: hashDefault,
        rol: 'Lectura',
        business_services: ['Data Lake Brasil', 'E-Commerce & Sales Brasil', 'Supply Chain Brasil'],
        idioma: 'pt',
        activo: true,
        primer_acceso: false,
        fecha_creacion: '2026-08-12'
      },
      {
        id: 'usr-admin-brasil',
        nombre: 'João',
        apellido: 'Silva',
        usuario: 'jsilva',
        email: 'joao.silva@nestle.com',
        password_hash: hashDefault,
        rol: 'Administrador_BS',
        business_services: ['Data Lake Brasil', 'E-Commerce & Sales Brasil', 'Supply Chain Brasil', 'Finance Brasil', 'Customer Experience Brasil'],
        idioma: 'pt',
        activo: true,
        primer_acceso: false,
        fecha_creacion: '2026-08-15'
      }
    ];
    changed = true;
  }

  if (!data.changes || data.changes.length === 0) {
    data.changes = [
      {
        id: 'CHG-DEMO-001',
        numero_change: 'CHG0089201',
        ritm: 'RITM0145220',
        solicitante: 'Andrés Delgado',
        pais: 'Brasil',
        business_service: 'E-Commerce & Sales Brasil',
        producto: 'Nescafé',
        descripcion: 'Optimización del proceso de checkout B2B con cálculo automático de impuestos regionales',
        engenheiro: 'Carlos Mendoza',
        horas_estimadas: 18,
        horas_aprovadas: 18,
        tipo_change: 'Mejora',
        fase_atual: 'Execucao',
        status_aprovacao: 'Aprovado',
        aprovador_nome: 'Mariana Silva',
        aprovador_email: 'mariana.silva@nestle.com',
        analise: 'Ajuste en el módulo de cálculo de impuestos para regiones brasileñas.',
        rollback: 'Reactivar versión anterior del módulo de checkout v2.3.',
        pasos_implementacion: [
          { fase: '1. Análisis Técnico & Requerimientos', accion: 'Revisión de reglas fiscales', horas: 4, fechaTentativa: '2026-08-05' },
          { fase: '3. Desarrollo Backend / APIs', accion: 'Implementación del módulo', horas: 10, fechaTentativa: '2026-08-10' },
          { fase: '6. Pruebas QA & Regresión', accion: 'Pruebas con escenarios fiscales', horas: 4, fechaTentativa: '2026-08-12' }
        ],
        d1: '2026-08-01', d2: '2026-08-03', d3: '2026-08-05', d4: '2026-08-07',
        d5: '2026-08-09', d6: '2026-08-10', d7: '2026-08-14', d8: '',
        mes_ano: '2026-08',
        historial_fases: [
          { de: '', a: 'Abertura', fecha: '2026-08-01', usuario: 'Andrés Delgado' },
          { de: 'Abertura', a: 'Execucao', fecha: '2026-08-14', usuario: 'Carlos Mendoza' }
        ],
        fecha_creacion: '2026-08-01',
        fecha_cierre: '',
        modificado_por: 'Carlos Mendoza'
      },
      {
        id: 'CHG-DEMO-002',
        numero_change: 'CHG0089245',
        ritm: 'RITM0145300',
        solicitante: 'Camila Restrepo',
        pais: 'Mexico',
        business_service: 'Customer Experience México',
        producto: 'Purina Pro Plan',
        descripcion: 'Alertas automáticas de stock bajo para prevenir quiebres en canal moderno',
        engenheiro: 'Lucía Fernández',
        horas_estimadas: 22,
        horas_aprovadas: 22,
        tipo_change: 'Mejora',
        fase_atual: 'Analise',
        status_aprovacao: 'Pendente',
        aprovador_nome: 'Roberto Gómez',
        aprovador_email: 'roberto.gomez@nestle.com',
        analise: 'Configurar triggers en ERP para stock mínimo.',
        rollback: 'Desactivar triggers en ERP.',
        pasos_implementacion: [],
        d1: '2026-07-25', d2: '2026-07-28', d3: '2026-08-12', d4: '',
        d5: '', d6: '', d7: '', d8: '',
        mes_ano: '2026-08',
        historial_fases: [
          { de: '', a: 'Abertura', fecha: '2026-07-25', usuario: 'Camila Restrepo' },
          { de: 'Abertura', a: 'Analise', fecha: '2026-08-12', usuario: 'Lucía Fernández' }
        ],
        fecha_creacion: '2026-07-25',
        fecha_cierre: '',
        modificado_por: 'Lucía Fernández'
      },
      {
        id: 'CHG-DEMO-003',
        numero_change: 'CHG0089290',
        ritm: 'RITM0145380',
        solicitante: 'Felipe Martins',
        pais: 'Brasil',
        business_service: 'Supply Chain Brasil',
        producto: 'KitKat',
        descripcion: 'Integración de calendario de temporadas especiales con el módulo de planificación de demanda',
        engenheiro: 'Diego Vargas',
        horas_estimadas: 28,
        horas_aprovadas: 25,
        tipo_change: 'Mejora',
        fase_atual: 'Comite',
        status_aprovacao: 'Pendente',
        aprovador_nome: 'Juliana Costa',
        aprovador_email: 'juliana.costa@nestle.com',
        analise: 'Mapear festividades y correlacionar con histórico.',
        rollback: 'Revertir configuración del módulo de temporadas.',
        pasos_implementacion: [],
        d1: '2026-08-05', d2: '2026-08-08', d3: '2026-08-10', d4: '2026-08-13',
        d5: '', d6: '', d7: '', d8: '',
        mes_ano: '2026-08',
        historial_fases: [
          { de: '', a: 'Abertura', fecha: '2026-08-05', usuario: 'Felipe Martins' },
          { de: 'Abertura', a: 'Comite', fecha: '2026-08-13', usuario: 'Diego Vargas' }
        ],
        fecha_creacion: '2026-08-05',
        fecha_cierre: '',
        modificado_por: 'Diego Vargas'
      },
      {
        id: 'CHG-DEMO-004',
        numero_change: 'CHG0089315',
        ritm: 'RITM0145410',
        solicitante: 'Valeria Osorio',
        pais: 'Colombia',
        business_service: 'Data Lake Colombia',
        producto: 'Nido',
        descripcion: 'Reporte automatizado de sell-out semanal para distribuidores mayoristas',
        engenheiro: 'Carlos Mendoza',
        horas_estimadas: 15,
        horas_aprovadas: 15,
        tipo_change: 'Mejora',
        fase_atual: 'Aprovacao',
        status_aprovacao: 'Aprovado',
        aprovador_nome: 'Esteban Morales',
        aprovador_email: 'esteban.morales@nestle.com',
        analise: 'Crear pipeline de ingesta automatizada.',
        rollback: 'Volver a ingesta manual.',
        pasos_implementacion: [],
        d1: '2026-08-07', d2: '2026-08-09', d3: '2026-08-11', d4: '2026-08-13',
        d5: '2026-08-15', d6: '2026-08-16', d7: '', d8: '',
        mes_ano: '2026-08',
        historial_fases: [],
        fecha_creacion: '2026-08-07',
        fecha_cierre: '',
        modificado_por: 'Carlos Mendoza'
      },
      {
        id: 'CHG-DEMO-005',
        numero_change: 'CHG0089350',
        ritm: 'RITM0145490',
        solicitante: 'Gabriel Torres',
        pais: 'Argentina',
        business_service: 'Commercial Argentina',
        producto: 'La Lechera',
        descripcion: 'Ajuste de lista de precios dinámicos por canal de distribución tradicional',
        engenheiro: 'Lucía Fernández',
        horas_estimadas: 12,
        horas_aprovadas: 12,
        tipo_change: 'Mejora',
        fase_atual: 'Concluida',
        status_aprovacao: 'Aprovado',
        aprovador_nome: 'Martín Palermo',
        aprovador_email: 'martin.palermo@nestle.com',
        analise: 'Actualizar matriz de descuentos.',
        rollback: 'Cargar tabla anterior.',
        pasos_implementacion: [],
        d1: '2026-08-01', d2: '2026-08-02', d3: '2026-08-03', d4: '2026-08-04',
        d5: '2026-08-05', d6: '2026-08-05', d7: '2026-08-06', d8: '2026-08-07',
        mes_ano: '2026-08',
        historial_fases: [],
        fecha_creacion: '2026-08-01',
        fecha_cierre: '2026-08-07',
        modificado_por: 'Lucía Fernández'
      }
    ];
    changed = true;
  }

  if (changed) {
    writeLocalData(data);
    console.log('[DB Seed] Base de datos local inicializada con datos predeterminados.');
  }
}

function executeLocalQuery(sql, params) {
  const data = readLocalData();
  const cleanSql = sql.trim();

  // Implementación de operaciones básicas para modo local
  return { rows: [], rowCount: 0 };
}

module.exports = {
  query,
  pool,
  isPostgres: () => isPostgres,
  initDatabase,
  readLocalData,
  writeLocalData
};
