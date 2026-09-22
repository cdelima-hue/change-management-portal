const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Inicializa a Base de Dados
db.initDb().catch(console.error);

// ==========================================
// ROTAS DE PAÍSES
// ==========================================
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

// ==========================================
// ROTAS DE BUSINESS SERVICES
// ==========================================
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

// ==========================================
// ROTAS DE PRODUTOS
// ==========================================
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

// Rota principal SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`[DB] Tablas verificadas exitosamente en PostgreSQL.`);
  console.log(`===========================================`);
  console.log(`🚀 Change Management Portal Enterprise v7.0 (Production)`);
  console.log(`📡 Servidor escuchando en: http://localhost:${PORT}`);
});
