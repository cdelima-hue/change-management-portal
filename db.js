const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Inicialização do Schema da Base de Dados
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Países
    await client.query(`
      CREATE TABLE IF NOT EXISTS countries (
        key VARCHAR(50) PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        horas_disponibles INT NOT NULL,
        color VARCHAR(20) NOT NULL,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Business Services
    await client.query(`
      CREATE TABLE IF NOT EXISTS business_services (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        pais VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Produtos
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Utilizadores
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        pais VARCHAR(100),
        business_services TEXT[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Changes (Solicitações)
    await client.query(`
      CREATE TABLE IF NOT EXISTS changes (
        id SERIAL PRIMARY KEY,
        change_num VARCHAR(50) UNIQUE NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        pais VARCHAR(100) NOT NULL,
        business_service VARCHAR(100) NOT NULL,
        solicitante VARCHAR(100) NOT NULL,
        fase VARCHAR(50) NOT NULL DEFAULT '1. ABERTURA',
        producto VARCHAR(100),
        tipo_cambio VARCHAR(100),
        horas_estimadas NUMERIC(5,2) DEFAULT 0,
        horas_aprobadas NUMERIC(5,2) DEFAULT 0,
        descripcion TEXT,
        pasos_implementacion JSONB,
        entendimiento_tecnico TEXT,
        plan_rollback TEXT,
        aprobador VARCHAR(100),
        aprobador_email VARCHAR(100),
        estado_aprobacion VARCHAR(50) DEFAULT 'Pendiente',
        cronograma_fases JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Auditoria
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        usuario VARCHAR(150) NOT NULL,
        change_num VARCHAR(50) DEFAULT '-',
        campo VARCHAR(100) NOT NULL,
        valor_anterior TEXT DEFAULT '(vacío)',
        valor_nuevo TEXT DEFAULT '(vacío)',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Definições Globais
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT');
    console.log('[DB] Tablas verificadas exitosamente en PostgreSQL.');
    await seedInitialDataPostgres();
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[DB] Error inicializando base de datos:', e);
    throw e;
  } finally {
    client.release();
  }
}

// SEEDING DE DADOS INICIAIS (SEM CHANGES DE TESTE)
async function seedInitialDataPostgres() {
  // 1. Countries
  const cCount = await pool.query('SELECT COUNT(*) FROM countries');
  if (parseInt(cCount.rows[0].count) === 0) {
    console.log('[DB] Sembrando países iniciales...');
    const paises = [
      { key: 'Brasil', nombre: 'Brasil', horas: 160, color: '#059669' },
      { key: 'México', nombre: 'México', horas: 120, color: '#2563eb' },
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
    console.log('[DB] Sembrando Business Services iniciales...');
    const bss = [
      { nombre: 'Data Lake Brasil', pais: 'Brasil' },
      { nombre: 'E-Commerce & Sales Brasil', pais: 'Brasil' },
      { nombre: 'Supply Chain Brasil', pais: 'Brasil' },
      { nombre: 'Finance Brasil', pais: 'Brasil' },
      { nombre: 'Customer Experience Brasil', pais: 'Brasil' },
      { nombre: 'Data Lake México', pais: 'México' },
      { nombre: 'Customer Experience México', pais: 'México' },
      { nombre: 'Supply Chain México', pais: 'México' },
      { nombre: 'Sales México', pais: 'México' },
      { nombre: 'Finance México', pais: 'México' },
      { nombre: 'Data Lake Argentina', pais: 'Argentina' },
      { nombre: 'Commercial Argentina', pais: 'Argentina' },
      { nombre: 'Finance Argentina', pais: 'Argentina' },
      { nombre: 'Supply Chain Argentina', pais: 'Argentina' }
    ];
    for (const bs of bss) {
      await pool.query('INSERT INTO business_services (nombre, pais) VALUES ($1, $2)', [bs.nombre, bs.pais]);
    }
  }

  // 3. Produtos
  const pCount = await pool.query('SELECT COUNT(*) FROM products');
  if (parseInt(pCount.rows[0].count) === 0) {
    console.log('[DB] Sembrando Productos iniciales...');
    const prods = ['SAP S/4HANA', 'Power BI Dashboard', 'Salesforce CRM', 'Data Factory Pipeline', 'Celonis Process Mining'];
    for (const prod of prods) {
      await pool.query('INSERT INTO products (nombre) VALUES ($1)', [prod]);
    }
  }

  // 4. Utilizadores
  const uCount = await pool.query('SELECT COUNT(*) FROM users');
  if (parseInt(uCount.rows[0].count) === 0) {
    console.log('[DB] Sembrando Usuarios iniciales...');
    const users = [
      {
        username: 'admin',
        password_hash: '$2a$10$wTf/8CInB74o6yV.gT1.5eJzX/vQZ82N6A9JgK3oK9N9/7kY2bU2a', // Nestle2026!
        nombre: 'Claudio Lima',
        role: 'Admin Global',
        pais: null,
        bs: []
      },
      {
        username: 'jsilva',
        password_hash: '$2a$10$wTf/8CInB74o6yV.gT1.5eJzX/vQZ82N6A9JgK3oK9N9/7kY2bU2a',
        nombre: 'João Silva',
        role: 'Admin BS',
        pais: 'Brasil',
        bs: ['Data Lake Brasil', 'Supply Chain Brasil']
      },
      {
        username: 'cmendoza',
        password_hash: '$2a$10$wTf/8CInB74o6yV.gT1.5eJzX/vQZ82N6A9JgK3oK9N9/7kY2bU2a',
        nombre: 'Carlos Mendoza',
        role: 'Editor',
        pais: 'México',
        bs: ['Data Lake México', 'Sales México']
      }
    ];
    for (const u of users) {
      await pool.query(
        'INSERT INTO users (username, password_hash, nombre, role, pais, business_services) VALUES ($1, $2, $3, $4, $5, $6)',
        [u.username, u.password_hash, u.nombre, u.role, u.pais, u.bs]
      );
    }
  }
}

module.exports = {
  pool,
  initDb,
  initDatabase: initDb
};
