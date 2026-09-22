const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Inicializar base de dados
db.initDb().catch(console.error);

// Função para manejar o login
const handleLogin = async (req, res) => {
  const { username } = req.body || {};
  try {
    const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username || 'admin']);
    
    const user = rows.length > 0 ? rows[0] : {
      id: 1,
      username: username || 'admin',
      nombre: 'Claudio Lima',
      role: 'Admin Global',
      pais: null,
      business_services: []
    };

    res.json({
      success: true,
      token: 'token-demo-production-2026',
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre || 'Claudio Lima',
        role: user.role || 'Admin Global',
        pais: user.pais,
        business_services: user.business_services || []
      }
    });
  } catch (err) {
    console.error('Error en el login:', err);
    res.json({
      success: true,
      token: 'token-demo-fallback',
      user: { id: 1, username: 'admin', nombre: 'Claudio Lima', role: 'Admin Global' }
    });
  }
};

// Rotas de Login
app.post('/api/login', handleLogin);
app.post('/api/auth/login', handleLogin);
app.post('/login', handleLogin);

// Rotas de Países
app.get('/api/countries', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM countries ORDER BY nombre ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/countries', async (req, res) => {
  const { key, nombre, horas_disponibles, color } = req.body;
  try {
    await db.query(
      'INSERT INTO countries (key, nombre, horas_disponibles, color, activo) VALUES ($1, $2, $3, $4, true)',
      [key || nombre, nombre, horas_disponibles || 100, color || '#2563eb']
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/countries/:key', async (req, res) => {
  try {
    await db.query('DELETE FROM countries WHERE key = $1', [req.params.key]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rotas de Business Services
app.get('/api/business-services', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM business_services ORDER BY nombre ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/business-services', async (req, res) => {
  const { nombre, pais } = req.body;
  try {
    const { rows } = await db.query(
      'INSERT INTO business_services (nombre, pais) VALUES ($1, $2) RETURNING *',
      [nombre, pais]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/business-services/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM business_services WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rotas de Produtos
app.get('/api/products', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM products ORDER BY nombre ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  const { nombre } = req.body;
  try {
    const { rows } = await db.query(
      'INSERT INTO products (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rotas de Changes
app.get('/api/changes', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM changes ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/changes', async (req, res) => {
  try {
    const c = req.body;
    const { rows } = await db.query(
      `INSERT INTO changes (change_num, titulo, pais, business_service, solicitante, fase, producto, tipo_cambio, horas_estimadas, horas_aprobadas, descripcion, pasos_implementacion, entendimiento_tecnico, plan_rollback, aprobador, aprobador_email, estado_aprobacion, cronograma_fases)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
      [
        c.change_num || `CHG-${Date.now()}`,
        c.titulo,
        c.pais,
        c.business_service,
        c.solicitante,
        c.fase || '1. ABERTURA',
        c.producto,
        c.tipo_cambio,
        c.horas_estimadas || 0,
        c.horas_aprobadas || 0,
        c.descripcion,
        JSON.stringify(c.pasos_implementacion || []),
        c.entendimiento_tecnico,
        c.plan_rollback,
        c.aprobador,
        c.aprobador_email,
        c.estado_aprobacion || 'Pendiente',
        JSON.stringify(c.cronograma_fases || {})
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/changes/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM changes WHERE id = $1 OR change_num = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor a rodar na porta ${PORT}`);
});
