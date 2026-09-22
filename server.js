/**
 * server.js — Servidor Express & API RESTful para Portal de Gestión de Changes
 * Preparado para Producción en Render con base de datos PostgreSQL.
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'NESTLE_CHANGE_PORTAL_JWT_SECRET_2026';
const SALT_GLOBAL = 'NESTLE_CHANGE_MGMT_V6_SALT_KEY';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname)));

// Helper para hash de contraseñas
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + SALT_GLOBAL).digest('hex');
}

// Middleware de Autenticación JWT / Header
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      req.user = null;
    } else {
      req.user = user;
    }
    next();
  });
}

app.use(authenticateToken);

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', async (req, res) => {
  try {
    const isPg = db.isPostgres();
    res.json({
      status: 'ok',
      database: isPg ? 'PostgreSQL (Cloud / Render)' : 'Local File Storage',
      version: '7.0.0-production',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// ============================================================
// 1. AUTH & USUARIOS
// ============================================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
      return res.status(400).json({ success: false, error: 'Usuario y contraseña requeridos' });
    }

    const cleanUser = usuario.trim().toLowerCase();
    const hash = hashPassword(password);
    let user = null;

    if (db.isPostgres()) {
      const result = await db.query(
        'SELECT * FROM users WHERE (LOWER(usuario) = $1 OR LOWER(email) = $1) AND activo = true',
        [cleanUser]
      );
      if (result.rows.length > 0) {
        user = result.rows[0];
      }
    } else {
      const data = db.readLocalData();
      user = data.users.find(u =>
        (u.usuario.toLowerCase() === cleanUser || u.email.toLowerCase() === cleanUser) && u.activo
      );
    }

    if (!user || user.password_hash !== hash) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    if (user.primer_acceso) {
      return res.json({
        success: true,
        requiereCambioPassword: true,
        usuarioId: user.id,
        nombreUsuario: `${user.nombre} ${user.apellido || ''}`.trim()
      });
    }

    const bsArray = typeof user.business_services === 'string' ? JSON.parse(user.business_services) : (user.business_services || ['*']);

    const tokenPayload = {
      id: user.id,
      usuario: user.usuario,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      rol: user.rol,
      businessServices: bsArray,
      idioma: user.idioma || 'es'
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      usuario: tokenPayload
    });
  } catch (err) {
    console.error('[API Auth] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { usuarioId, passwordActual, passwordNueva } = req.body;
    if (!usuarioId || !passwordActual || !passwordNueva) {
      return res.status(400).json({ success: false, error: 'Campos obligatorios incompletos' });
    }

    const hashActual = hashPassword(passwordActual);
    const hashNueva = hashPassword(passwordNueva);

    if (db.isPostgres()) {
      const result = await db.query('SELECT * FROM users WHERE id = $1', [usuarioId]);
      if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      const user = result.rows[0];
      if (user.password_hash !== hashActual) return res.status(400).json({ success: false, error: 'Contraseña actual incorrecta' });

      await db.query(
        'UPDATE users SET password_hash = $1, primer_acceso = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [hashNueva, usuarioId]
      );
    } else {
      const data = db.readLocalData();
      const user = data.users.find(u => u.id === usuarioId);
      if (!user) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      if (user.password_hash !== hashActual) return res.status(400).json({ success: false, error: 'Contraseña actual incorrecta' });

      user.password_hash = hashNueva;
      user.primer_acceso = false;
      db.writeLocalData(data);
    }

    res.json({ success: true, message: 'Contraseña actualizada con éxito' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    let users = [];
    if (db.isPostgres()) {
      const result = await db.query('SELECT id, nombre, apellido, usuario, email, rol, business_services, idioma, activo, primer_acceso, fecha_creacion FROM users ORDER BY created_at ASC');
      users = result.rows.map(u => ({
        ...u,
        businessServices: typeof u.business_services === 'string' ? JSON.parse(u.business_services) : (u.business_services || ['*'])
      }));
    } else {
      const data = db.readLocalData();
      users = data.users.map(u => ({
        id: u.id,
        nombre: u.nombre,
        apellido: u.apellido,
        usuario: u.usuario,
        email: u.email,
        rol: u.rol,
        businessServices: u.business_services || ['*'],
        idioma: u.idioma || 'es',
        activo: u.activo,
        primerAcceso: u.primer_acceso,
        fechaCreacion: u.fecha_creacion
      }));
    }
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { nombre, apellido, usuario, email, password, rol, businessServices, idioma } = req.body;
    if (!nombre || !usuario || !email || !password) {
      return res.status(400).json({ success: false, error: 'Campos requeridos incompletos' });
    }

    const cleanUser = usuario.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const id = `usr-${Date.now()}`;
    const hash = hashPassword(password);
    const bsArray = Array.isArray(businessServices) && businessServices.length > 0 ? businessServices : ['*'];
    const fecha = new Date().toISOString().split('T')[0];

    if (db.isPostgres()) {
      await db.query(`
        INSERT INTO users (id, nombre, apellido, usuario, email, password_hash, rol, business_services, idioma, activo, primer_acceso, fecha_creacion)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, true, $10)
      `, [id, nombre.trim(), (apellido || '').trim(), cleanUser, cleanEmail, hash, rol || 'Lectura', JSON.stringify(bsArray), idioma || 'es', fecha]);
    } else {
      const data = db.readLocalData();
      if (data.users.some(u => u.usuario.toLowerCase() === cleanUser || u.email.toLowerCase() === cleanEmail)) {
        return res.status(400).json({ success: false, error: 'Usuario o correo ya registrado' });
      }
      data.users.push({
        id,
        nombre: nombre.trim(),
        apellido: (apellido || '').trim(),
        usuario: cleanUser,
        email: cleanEmail,
        password_hash: hash,
        rol: rol || 'Lectura',
        business_services: bsArray,
        idioma: idioma || 'es',
        activo: true,
        primer_acceso: true,
        fecha_creacion: fecha
      });
      db.writeLocalData(data);
    }

    res.json({ success: true, message: 'Usuario registrado con éxito', id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, rol, businessServices, idioma, activo, nuevaPassword } = req.body;

    if (db.isPostgres()) {
      let queryStr = 'UPDATE users SET updated_at = CURRENT_TIMESTAMP';
      const params = [];
      let idx = 1;

      if (nombre !== undefined) { queryStr += `, nombre = $${idx++}`; params.push(nombre.trim()); }
      if (apellido !== undefined) { queryStr += `, apellido = $${idx++}`; params.push(apellido.trim()); }
      if (rol !== undefined) { queryStr += `, rol = $${idx++}`; params.push(rol); }
      if (businessServices !== undefined) { queryStr += `, business_services = $${idx++}`; params.push(JSON.stringify(businessServices)); }
      if (idioma !== undefined) { queryStr += `, idioma = $${idx++}`; params.push(idioma); }
      if (activo !== undefined) { queryStr += `, activo = $${idx++}`; params.push(activo); }
      if (nuevaPassword) { queryStr += `, password_hash = $${idx++}, primer_acceso = true`; params.push(hashPassword(nuevaPassword)); }

      queryStr += ` WHERE id = $${idx}`;
      params.push(id);
      await db.query(queryStr, params);
    } else {
      const data = db.readLocalData();
      const u = data.users.find(x => x.id === id);
      if (!u) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      if (nombre !== undefined) u.nombre = nombre.trim();
      if (apellido !== undefined) u.apellido = apellido.trim();
      if (rol !== undefined) u.rol = rol;
      if (businessServices !== undefined) u.business_services = businessServices;
      if (idioma !== undefined) u.idioma = idioma;
      if (activo !== undefined) u.activo = activo;
      if (nuevaPassword) { u.password_hash = hashPassword(nuevaPassword); u.primer_acceso = true; }
      db.writeLocalData(data);
    }

    res.json({ success: true, message: 'Usuario actualizado' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (db.isPostgres()) {
      await db.query('DELETE FROM users WHERE id = $1', [id]);
    } else {
      const data = db.readLocalData();
      data.users = data.users.filter(x => x.id !== id);
      db.writeLocalData(data);
    }
    res.json({ success: true, message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 2. PAÍSES / MERCADOS (CRUD CON VALIDACIÓN DE USO)
// ============================================================
app.get('/api/countries', async (req, res) => {
  try {
    let countries = [];
    if (db.isPostgres()) {
      const result = await db.query('SELECT * FROM countries ORDER BY nombre ASC');
      countries = result.rows.map(c => ({
        key: c.key,
        nombre: c.nombre,
        horasDisponibles: c.horas_disponibles,
        color: c.color,
        activo: c.activo
      }));
    } else {
      const data = db.readLocalData();
      countries = data.countries.map(c => ({
        key: c.key,
        nombre: c.nombre,
        horasDisponibles: c.horas_disponibles,
        color: c.color,
        activo: c.activo
      }));
    }
    res.json({ success: true, data: countries });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/countries', async (req, res) => {
  try {
    const { key, nombre, horasDisponibles, color } = req.body;
    if (!nombre) return res.status(400).json({ success: false, error: 'Nombre de país requerido' });
    const cKey = (key || nombre).trim();

    if (db.isPostgres()) {
      await db.query(
        'INSERT INTO countries (key, nombre, horas_disponibles, color, activo) VALUES ($1, $2, $3, $4, true) ON CONFLICT (key) DO UPDATE SET horas_disponibles = $3, color = $4, activo = true',
        [cKey, nombre.trim(), parseInt(horasDisponibles) || 100, color || '#2563eb']
      );
    } else {
      const data = db.readLocalData();
      const existing = data.countries.find(c => c.key.toLowerCase() === cKey.toLowerCase());
      if (existing) {
        existing.horas_disponibles = parseInt(horasDisponibles) || 100;
        existing.color = color || '#2563eb';
        existing.activo = true;
      } else {
        data.countries.push({
          id: Date.now(),
          key: cKey,
          nombre: nombre.trim(),
          horas_disponibles: parseInt(horasDisponibles) || 100,
          color: color || '#2563eb',
          activo: true
        });
      }
      db.writeLocalData(data);
    }

    res.json({ success: true, message: 'País guardado con éxito' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/countries/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { nombre, horasDisponibles, color, activo } = req.body;

    if (db.isPostgres()) {
      await db.query(`
        UPDATE countries SET
          nombre = COALESCE($1, nombre),
          horas_disponibles = COALESCE($2, horas_disponibles),
          color = COALESCE($3, color),
          activo = COALESCE($4, activo),
          updated_at = CURRENT_TIMESTAMP
        WHERE key = $5
      `, [nombre, horasDisponibles ? parseInt(horasDisponibles) : null, color, activo, key]);
    } else {
      const data = db.readLocalData();
      const c = data.countries.find(x => x.key === key);
      if (c) {
        if (nombre !== undefined) c.nombre = nombre;
        if (horasDisponibles !== undefined) c.horas_disponibles = parseInt(horasDisponibles);
        if (color !== undefined) c.color = color;
        if (activo !== undefined) c.activo = activo;
        db.writeLocalData(data);
      }
    }
    res.json({ success: true, message: 'País actualizado' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/countries/:key', async (req, res) => {
  try {
    const { key } = req.params;

    // Verificar si está en uso por Changes
    let usageCount = 0;
    if (db.isPostgres()) {
      const check = await db.query('SELECT COUNT(*) FROM changes WHERE pais = $1', [key]);
      usageCount = parseInt(check.rows[0].count);
    } else {
      const data = db.readLocalData();
      usageCount = data.changes.filter(c => c.pais === key).length;
    }

    if (usageCount > 0) {
      return res.status(409).json({
        success: false,
        error: `No se puede eliminar el país "${key}" porque está siendo utilizado por ${usageCount} Change(s) existente(s). Puedes desactivarlo en su lugar.`
      });
    }

    if (db.isPostgres()) {
      await db.query('DELETE FROM countries WHERE key = $1', [key]);
    } else {
      const data = db.readLocalData();
      data.countries = data.countries.filter(c => c.key !== key);
      db.writeLocalData(data);
    }
    res.json({ success: true, message: 'País eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 3. BUSINESS SERVICES (CRUD CON VALIDACIÓN DE USO)
// ============================================================
app.get('/api/business-services', async (req, res) => {
  try {
    let services = [];
    if (db.isPostgres()) {
      const result = await db.query('SELECT * FROM business_services WHERE activo = true ORDER BY pais_key ASC, nombre ASC');
      services = result.rows.map(s => ({ id: s.id, nombre: s.nombre, pais: s.pais_key, activo: s.activo }));
    } else {
      const data = db.readLocalData();
      services = data.business_services.filter(s => s.activo !== false).map(s => ({ id: s.id, nombre: s.nombre, pais: s.pais_key, activo: s.activo }));
    }
    res.json({ success: true, data: services });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/business-services', async (req, res) => {
  try {
    const { nombre, pais } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ success: false, error: 'El nombre del Business Service es obligatorio' });
    }

    const cleanName = nombre.trim();
    const cleanPais = (pais || 'Global').trim();

    if (db.isPostgres()) {
      const ins = await db.query(
        'INSERT INTO business_services (nombre, pais_key, activo) VALUES ($1, $2, true) RETURNING id',
        [cleanName, cleanPais]
      );
      res.json({ success: true, message: 'Business Service creado', id: ins.rows[0].id });
    } else {
      const data = db.readLocalData();
      const newId = Date.now();
      data.business_services.push({ id: newId, nombre: cleanName, pais_key: cleanPais, activo: true });
      db.writeLocalData(data);
      res.json({ success: true, message: 'Business Service creado', id: newId });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/business-services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, pais, activo } = req.body;

    if (db.isPostgres()) {
      await db.query(
        'UPDATE business_services SET nombre = COALESCE($1, nombre), pais_key = COALESCE($2, pais_key), activo = COALESCE($3, activo), updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        [nombre ? nombre.trim() : null, pais ? pais.trim() : null, activo, id]
      );
    } else {
      const data = db.readLocalData();
      const s = data.business_services.find(x => String(x.id) === String(id));
      if (s) {
        if (nombre !== undefined) s.nombre = nombre.trim();
        if (pais !== undefined) s.pais_key = pais.trim();
        if (activo !== undefined) s.activo = activo;
        db.writeLocalData(data);
      }
    }
    res.json({ success: true, message: 'Business Service actualizado' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/business-services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let bsNombre = '';

    // Obtener nombre del BS
    if (db.isPostgres()) {
      const cur = await db.query('SELECT nombre FROM business_services WHERE id = $1', [id]);
      if (cur.rows.length === 0) return res.status(404).json({ success: false, error: 'Business Service no encontrado' });
      bsNombre = cur.rows[0].nombre;
    } else {
      const data = db.readLocalData();
      const cur = data.business_services.find(x => String(x.id) === String(id));
      if (!cur) return res.status(404).json({ success: false, error: 'Business Service no encontrado' });
      bsNombre = cur.nombre;
    }

    // Verificar uso en changes
    let usageCount = 0;
    if (db.isPostgres()) {
      const check = await db.query('SELECT COUNT(*) FROM changes WHERE business_service = $1', [bsNombre]);
      usageCount = parseInt(check.rows[0].count);
    } else {
      const data = db.readLocalData();
      usageCount = data.changes.filter(c => c.business_service === bsNombre).length;
    }

    if (usageCount > 0) {
      return res.status(409).json({
        success: false,
        error: `No se puede eliminar el Business Service "${bsNombre}" porque está siendo utilizado por ${usageCount} Change(s) existente(s). Puedes desactivarlo en su lugar.`
      });
    }

    if (db.isPostgres()) {
      await db.query('DELETE FROM business_services WHERE id = $1', [id]);
    } else {
      const data = db.readLocalData();
      data.business_services = data.business_services.filter(x => String(x.id) !== String(id));
      db.writeLocalData(data);
    }

    res.json({ success: true, message: 'Business Service eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 4. PRODUCTOS / LÍNEAS (CRUD CON VALIDACIÓN DE USO)
// ============================================================
app.get('/api/products', async (req, res) => {
  try {
    let products = [];
    if (db.isPostgres()) {
      const result = await db.query('SELECT * FROM products WHERE activo = true ORDER BY nombre ASC');
      products = result.rows.map(p => ({ id: p.id, nombre: p.nombre, pais: p.pais_key, activo: p.activo }));
    } else {
      const data = db.readLocalData();
      products = data.products.filter(p => p.activo !== false).map(p => ({ id: p.id, nombre: p.nombre, pais: p.pais_key, activo: p.activo }));
    }
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { nombre, pais } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ success: false, error: 'El nombre del producto es obligatorio' });

    const cleanName = nombre.trim();
    const cleanPais = (pais || '').trim();

    if (db.isPostgres()) {
      const ins = await db.query('INSERT INTO products (nombre, pais_key, activo) VALUES ($1, $2, true) RETURNING id', [cleanName, cleanPais]);
      res.json({ success: true, message: 'Producto creado', id: ins.rows[0].id });
    } else {
      const data = db.readLocalData();
      const newId = Date.now();
      data.products.push({ id: newId, nombre: cleanName, pais_key: cleanPais, activo: true });
      db.writeLocalData(data);
      res.json({ success: true, message: 'Producto creado', id: newId });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, pais, activo } = req.body;

    if (db.isPostgres()) {
      await db.query(
        'UPDATE products SET nombre = COALESCE($1, nombre), pais_key = COALESCE($2, pais_key), activo = COALESCE($3, activo), updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        [nombre ? nombre.trim() : null, pais !== undefined ? pais.trim() : null, activo, id]
      );
    } else {
      const data = db.readLocalData();
      const p = data.products.find(x => String(x.id) === String(id));
      if (p) {
        if (nombre !== undefined) p.nombre = nombre.trim();
        if (pais !== undefined) p.pais_key = pais.trim();
        if (activo !== undefined) p.activo = activo;
        db.writeLocalData(data);
      }
    }
    res.json({ success: true, message: 'Producto actualizado' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let pNombre = '';

    if (db.isPostgres()) {
      const cur = await db.query('SELECT nombre FROM products WHERE id = $1', [id]);
      if (cur.rows.length === 0) return res.status(404).json({ success: false, error: 'Producto no encontrado' });
      pNombre = cur.rows[0].nombre;
    } else {
      const data = db.readLocalData();
      const cur = data.products.find(x => String(x.id) === String(id));
      if (!cur) return res.status(404).json({ success: false, error: 'Producto no encontrado' });
      pNombre = cur.nombre;
    }

    // Verificar uso en changes
    let usageCount = 0;
    if (db.isPostgres()) {
      const check = await db.query('SELECT COUNT(*) FROM changes WHERE producto = $1', [pNombre]);
      usageCount = parseInt(check.rows[0].count);
    } else {
      const data = db.readLocalData();
      usageCount = data.changes.filter(c => c.producto === pNombre).length;
    }

    if (usageCount > 0) {
      return res.status(409).json({
        success: false,
        error: `No se puede eliminar el producto "${pNombre}" porque está siendo utilizado por ${usageCount} Change(s) existente(s). Puedes desactivarlo en su lugar.`
      });
    }

    if (db.isPostgres()) {
      await db.query('DELETE FROM products WHERE id = $1', [id]);
    } else {
      const data = db.readLocalData();
      data.products = data.products.filter(x => String(x.id) !== String(id));
      db.writeLocalData(data);
    }

    res.json({ success: true, message: 'Producto eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 5. CHANGES (CRUD COMPLETO CON AUDITORÍA Y SLA)
// ============================================================
app.get('/api/changes', async (req, res) => {
  try {
    let changes = [];
    if (db.isPostgres()) {
      const result = await db.query('SELECT * FROM changes ORDER BY created_at DESC');
      changes = result.rows.map(mapDbChangeToApp);
    } else {
      const data = db.readLocalData();
      changes = data.changes.map(mapDbChangeToApp);
    }

    // Filtro de seguridad por Business Service para el usuario actual
    if (req.user && req.user.rol !== 'Administrador' && req.user.businessServices && !req.user.businessServices.includes('*')) {
      const allowed = req.user.businessServices.map(s => s.toLowerCase().trim());
      changes = changes.filter(ch => {
        const bs = (ch.businessService || '').toLowerCase().trim();
        return allowed.some(a => a === bs || bs.includes(a) || a.includes(bs));
      });
    }

    res.json({ success: true, data: changes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function mapDbChangeToApp(c) {
  return {
    id: c.id,
    spId: c.id,
    numeroChange: c.numero_change,
    ritm: c.ritm || '',
    solicitante: c.solicitante,
    pais: c.pais,
    businessService: c.business_service,
    producto: c.producto,
    descripcion: c.descripcion,
    engenheiro: c.engenheiro,
    horasEstimadas: parseFloat(c.horas_estimadas || 0),
    horasAprovadas: parseFloat(c.horas_aprovadas || 0),
    tipoChange: c.tipo_change || 'Mejora',
    faseAtual: c.fase_atual || 'Abertura',
    statusAprovacao: c.status_aprovacao || 'Pendente',
    aprovadorNome: c.aprovador_nome || '',
    aprovadorEmail: c.aprovador_email || '',
    analise: c.analise || '',
    rollback: c.rollback || '',
    pasosImplementacion: typeof c.pasos_implementacion === 'string' ? JSON.parse(c.pasos_implementacion) : (c.pasos_implementacion || []),
    d1: c.d1 || '',
    d2: c.d2 || '',
    d3: c.d3 || '',
    d4: c.d4 || '',
    d5: c.d5 || '',
    d6: c.d6 || '',
    d7: c.d7 || '',
    d8: c.d8 || '',
    mesAno: c.mes_ano || '',
    teamsLink: c.teams_link || '',
    historialFases: typeof c.historial_fases === 'string' ? JSON.parse(c.historial_fases) : (c.historial_fases || []),
    fechaCreacion: c.fecha_creacion || '',
    fechaCierre: c.fecha_cierre || '',
    ultimaModificacao: c.ultima_modificacao,
    modificadoPor: c.modificado_por || ''
  };
}

app.post('/api/changes', async (req, res) => {
  try {
    const d = req.body;
    if (!d.solicitante || !d.numeroChange || !d.businessService || !d.descripcion || !d.engenheiro) {
      return res.status(400).json({ success: false, error: 'Los 5 campos principales son obligatorios' });
    }

    const id = d.id || `CHG-${Date.now()}`;
    const fechaCreacion = d.fechaCreacion || d.d1 || new Date().toISOString().split('T')[0];
    const modPor = req.user ? req.user.nombre : (d.modificadoPor || 'Usuario');

    if (db.isPostgres()) {
      await db.query(`
        INSERT INTO changes (
          id, numero_change, ritm, solicitante, pais, business_service, producto, descripcion,
          engenheiro, horas_estimadas, horas_aprovadas, tipo_change, fase_atual, status_aprovacao,
          aprovador_nome, aprovador_email, analise, rollback, pasos_implementacion,
          d1, d2, d3, d4, d5, d6, d7, d8, mes_ano, teams_link, historial_fases, fecha_creacion, fecha_cierre, modificado_por
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33
        )
      `, [
        id, d.numeroChange.trim(), d.ritm || '', d.solicitante.trim(), d.pais || 'Brasil', d.businessService.trim(), d.producto || 'General', d.descripcion.trim(),
        d.engenheiro.trim(), parseFloat(d.horasEstimadas || 0), parseFloat(d.horasAprovadas || 0), d.tipoChange || 'Mejora', d.faseAtual || 'Abertura', d.statusAprovacao || 'Pendente',
        d.aprovadorNome || '', d.aprovadorEmail || '', d.analise || '', d.rollback || '', JSON.stringify(d.pasosImplementacion || []),
        d.d1 || '', d.d2 || '', d.d3 || '', d.d4 || '', d.d5 || '', d.d6 || '', d.d7 || '', d.d8 || '', d.mesAno || '', d.teamsLink || '', JSON.stringify(d.historialFases || []),
        fechaCreacion, d.fechaCierre || '', modPor
      ]);

      await db.query('INSERT INTO audit_logs (usuario, change_num, campo, valor_anterior, valor_nuevo) VALUES ($1, $2, $3, $4, $5)', [
        modPor, d.numeroChange, 'CREACIÓN', '(nueva)', `${d.pais} / ${d.businessService} / ${d.horasEstimadas}h`
      ]);
    } else {
      const data = db.readLocalData();
      data.changes.unshift({
        id,
        numero_change: d.numeroChange.trim(),
        ritm: d.ritm || '',
        solicitante: d.solicitante.trim(),
        pais: d.pais || 'Brasil',
        business_service: d.businessService.trim(),
        producto: d.producto || 'General',
        descripcion: d.descripcion.trim(),
        engenheiro: d.engenheiro.trim(),
        horas_estimadas: parseFloat(d.horasEstimadas || 0),
        horas_aprovadas: parseFloat(d.horasAprovadas || 0),
        tipo_change: d.tipoChange || 'Mejora',
        fase_atual: d.faseAtual || 'Abertura',
        status_aprovacao: d.statusAprovacao || 'Pendente',
        aprovador_nome: d.aprovadorNome || '',
        aprovador_email: d.aprovadorEmail || '',
        analise: d.analise || '',
        rollback: d.rollback || '',
        pasos_implementacion: d.pasosImplementacion || [],
        d1: d.d1 || '', d2: d.d2 || '', d3: d.d3 || '', d4: d.d4 || '',
        d5: d.d5 || '', d6: d.d6 || '', d7: d.d7 || '', d8: d.d8 || '',
        mes_ano: d.mesAno || '', teams_link: d.teamsLink || '',
        historial_fases: d.historialFases || [],
        fecha_creacion: fechaCreacion,
        fecha_cierre: d.fechaCierre || '',
        ultima_modificacao: new Date().toISOString(),
        modificado_por: modPor
      });

      data.audit_logs.unshift({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        usuario: modPor,
        change_num: d.numeroChange,
        campo: 'CREACIÓN',
        valor_anterior: '(nueva)',
        valor_nuevo: `${d.pais} / ${d.businessService} / ${d.horasEstimadas}h`
      });

      db.writeLocalData(data);
    }

    res.json({ success: true, message: 'Change guardada en base de datos', id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/changes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const d = req.body;
    const modPor = req.user ? req.user.nombre : (d.modificadoPor || 'Usuario');

    if (db.isPostgres()) {
      await db.query(`
        UPDATE changes SET
          numero_change = COALESCE($1, numero_change),
          ritm = COALESCE($2, ritm),
          solicitante = COALESCE($3, solicitante),
          pais = COALESCE($4, pais),
          business_service = COALESCE($5, business_service),
          producto = COALESCE($6, producto),
          descripcion = COALESCE($7, descripcion),
          engenheiro = COALESCE($8, engenheiro),
          horas_estimadas = COALESCE($9, horas_estimadas),
          horas_aprovadas = COALESCE($10, horas_aprovadas),
          tipo_change = COALESCE($11, tipo_change),
          fase_atual = COALESCE($12, fase_atual),
          status_aprovacao = COALESCE($13, status_aprovacao),
          aprovador_nome = COALESCE($14, aprovador_nome),
          aprovador_email = COALESCE($15, aprovador_email),
          analise = COALESCE($16, analise),
          rollback = COALESCE($17, rollback),
          pasos_implementacion = COALESCE($18, pasos_implementacion),
          d1 = COALESCE($19, d1), d2 = COALESCE($20, d2), d3 = COALESCE($21, d3), d4 = COALESCE($22, d4),
          d5 = COALESCE($23, d5), d6 = COALESCE($24, d6), d7 = COALESCE($25, d7), d8 = COALESCE($26, d8),
          mes_ano = COALESCE($27, mes_ano),
          historial_fases = COALESCE($28, historial_fases),
          fecha_cierre = COALESCE($29, fecha_cierre),
          modificado_por = $30,
          ultima_modificacao = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $31
      `, [
        d.numeroChange, d.ritm, d.solicitante, d.pais, d.businessService, d.producto, d.descripcion,
        d.engenheiro, d.horasEstimadas, d.horasAprovadas, d.tipoChange, d.faseAtual, d.statusAprovacao,
        d.aprovadorNome, d.aprovadorEmail, d.analise, d.rollback, d.pasosImplementacion ? JSON.stringify(d.pasosImplementacion) : null,
        d.d1, d.d2, d.d3, d.d4, d.d5, d.d6, d.d7, d.d8, d.mesAno, d.historialFases ? JSON.stringify(d.historialFases) : null,
        d.fechaCierre, modPor, id
      ]);
    } else {
      const data = db.readLocalData();
      const idx = data.changes.findIndex(x => x.id === id);
      if (idx !== -1) {
        data.changes[idx] = {
          ...data.changes[idx],
          ...d,
          numero_change: d.numeroChange || data.changes[idx].numero_change,
          business_service: d.businessService || data.changes[idx].business_service,
          horas_estimadas: d.horasEstimadas !== undefined ? d.horasEstimadas : data.changes[idx].horas_estimadas,
          horas_aprovadas: d.horasAprovadas !== undefined ? d.horasAprovadas : data.changes[idx].horas_aprovadas,
          fase_atual: d.faseAtual || data.changes[idx].fase_atual,
          status_aprovacao: d.statusAprovacao || data.changes[idx].status_aprovacao,
          pasos_implementacion: d.pasosImplementacion || data.changes[idx].pasos_implementacion,
          historial_fases: d.historialFases || data.changes[idx].historial_fases,
          ultima_modificacao: new Date().toISOString(),
          modificado_por: modPor
        };
        db.writeLocalData(data);
      }
    }

    res.json({ success: true, message: 'Change actualizada' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/changes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const modPor = req.user ? req.user.nombre : 'Usuario';

    if (db.isPostgres()) {
      const cur = await db.query('SELECT numero_change FROM changes WHERE id = $1', [id]);
      const chNum = cur.rows[0] ? cur.rows[0].numero_change : id;
      await db.query('DELETE FROM changes WHERE id = $1', [id]);
      await db.query('INSERT INTO audit_logs (usuario, change_num, campo, valor_anterior, valor_nuevo) VALUES ($1, $2, $3, $4, $5)', [
        modPor, chNum, 'ELIMINACIÓN', chNum, '(eliminada)'
      ]);
    } else {
      const data = db.readLocalData();
      const cur = data.changes.find(x => x.id === id);
      const chNum = cur ? cur.numero_change : id;
      data.changes = data.changes.filter(x => x.id !== id);
      data.audit_logs.unshift({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        usuario: modPor,
        change_num: chNum,
        campo: 'ELIMINACIÓN',
        valor_anterior: chNum,
        valor_nuevo: '(eliminada)'
      });
      db.writeLocalData(data);
    }

    res.json({ success: true, message: 'Change eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 6. AUDIT LOGS
// ============================================================
app.get('/api/audit-logs', async (req, res) => {
  try {
    let logs = [];
    if (db.isPostgres()) {
      const result = await db.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500');
      logs = result.rows.map(l => ({
        id: l.id,
        timestamp: l.timestamp,
        usuario: l.usuario,
        changeNum: l.change_num,
        campo: l.campo,
        valorAnterior: l.valor_anterior,
        valorNuevo: l.valor_nuevo
      }));
    } else {
      const data = db.readLocalData();
      logs = data.audit_logs.slice(0, 500).map(l => ({
        id: l.id,
        timestamp: l.timestamp,
        usuario: l.usuario,
        changeNum: l.change_num,
        campo: l.campo,
        valorAnterior: l.valor_anterior,
        valorNuevo: l.valor_nuevo
      }));
    }
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/audit-logs', async (req, res) => {
  try {
    const { usuario, changeNum, campo, valorAnterior, valorNuevo } = req.body;
    if (db.isPostgres()) {
      await db.query(
        'INSERT INTO audit_logs (usuario, change_num, campo, valor_anterior, valor_nuevo) VALUES ($1, $2, $3, $4, $5)',
        [usuario || 'Sistema', changeNum || '—', campo, String(valorAnterior || ''), String(valorNuevo || '')]
      );
    } else {
      const data = db.readLocalData();
      data.audit_logs.unshift({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        usuario: usuario || 'Sistema',
        change_num: changeNum || '—',
        campo,
        valor_anterior: String(valorAnterior || ''),
        valor_nuevo: String(valorNuevo || '')
      });
      if (data.audit_logs.length > 500) data.audit_logs = data.audit_logs.slice(0, 500);
      db.writeLocalData(data);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 7. SETTINGS / BRANDING / PRESETS
// ============================================================
app.get('/api/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    let val = null;
    if (db.isPostgres()) {
      const result = await db.query('SELECT value FROM settings WHERE key = $1', [key]);
      if (result.rows.length > 0) val = result.rows[0].value;
    } else {
      const data = db.readLocalData();
      val = data.settings[key] || null;
    }
    res.json({ success: true, data: val });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (db.isPostgres()) {
      await db.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
        [key, JSON.stringify(value)]
      );
    } else {
      const data = db.readLocalData();
      data.settings[key] = value;
      db.writeLocalData(data);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Catch-all para SPA (servir index.html para cualquier ruta de frontend)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar base de datos y servidor
db.initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Change Management Portal Enterprise v7.0 (Production)`);
      console.log(`📡 Servidor escuchando en: http://localhost:${PORT}`);
      console.log(`🗄️  Base de Datos: ${db.isPostgres() ? 'PostgreSQL (Render/Cloud)' : 'Local File Storage'}`);
      console.log(`=======================================================`);
    });
  })
  .catch(err => {
    console.error('[Fatal] Error inicializando base de datos:', err);
    process.exit(1);
  });
