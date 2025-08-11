const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3005;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const allowed = new Set([ FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173' ]);
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowed.has(origin)),
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Erro ao abrir o banco:', err.message);
  else console.log('Banco conectado:', dbPath);
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err); else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
  });
}

(async function migrate() {
  await run(`CREATE TABLE IF NOT EXISTS reservas(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sala TEXT NOT NULL,
    data DATE NOT NULL,
    inicio TEXT NOT NULL,
    fim TEXT NOT NULL,
    assunto TEXT NOT NULL,
    user_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS portaria_agendamentos(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data DATE NOT NULL,
    hora TEXT NOT NULL,
    visitante TEXT NOT NULL,
    documento TEXT,
    observacao TEXT,
    user_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log('Migrações OK');
})();

app.get('/api/health', (_req, res) => res.json({ ok: true, message: 'Server running' }));

app.post('/api/reservas', async (req, res) => {
  try {
    const { sala, data, inicio, fim, assunto } = req.body;
    if (!sala || !data || !inicio || !fim || !assunto) {
      return res.status(400).json({ ok: false, error: 'Todos os campos são obrigatórios' });
    }
    const conflict = await get(`
      SELECT * FROM reservas
      WHERE sala = ? AND data = ?
      AND ((inicio <= ? AND fim > ?) OR (inicio < ? AND fim >= ?))
    `, [sala, data, inicio, inicio, fim, fim]);
    if (conflict) {
      return res.status(400).json({ ok: false, error: 'Conflito de horário para esta sala' });
    }
    const result = await run(
      "INSERT INTO reservas(sala, data, inicio, fim, assunto, user_id) VALUES(?, ?, ?, ?, ?, 1)",
      [sala, data, inicio, fim, assunto]
    );
    res.json({ ok: true, id: result.lastID, points: 10 });
  } catch (e) {
    console.error('Erro ao criar reserva:', e);
    res.status(500).json({ ok: false, error: 'Erro ao criar reserva' });
  }
});

app.get('/api/reservas', async (_req, res) => {
  try {
    const reservas = await all(`
      SELECT r.*, 'Usuário' as responsavel
      FROM reservas r
      ORDER BY r.data ASC, r.inicio ASC
    `);
    res.json({ ok: true, reservas });
  } catch (e) {
    console.error('Erro ao buscar reservas:', e);
    res.status(500).json({ ok: false, error: 'Erro ao buscar reservas' });
  }
});

app.post('/api/portaria/agendamentos', async (req, res) => {
  try {
    const { data, hora, visitante, documento, observacao } = req.body;
    if (!data || !hora || !visitante) {
      return res.status(400).json({ ok: false, error: 'Data, hora e visitante são obrigatórios' });
    }
    const result = await run(
      "INSERT INTO portaria_agendamentos(data, hora, visitante, documento, observacao, user_id) VALUES(?, ?, ?, ?, ?, 1)",
      [data, hora, visitante, documento || null, observacao || null]
    );
    res.json({ ok: true, id: result.lastID, points: 10 });
  } catch (e) {
    console.error('Erro ao criar agendamento:', e);
    res.status(500).json({ ok: false, error: 'Erro ao criar agendamento' });
  }
});

app.get('/api/portaria/agendamentos', async (_req, res) => {
  try {
    const agendamentos = await all(`
      SELECT p.*, 'Usuário' as responsavel
      FROM portaria_agendamentos p
      ORDER BY p.data DESC, p.hora DESC
    `);
    res.json({ ok: true, agendamentos });
  } catch (e) {
    console.error('Erro ao buscar agendamentos:', e);
    res.status(500).json({ ok: false, error: 'Erro ao buscar agendamentos' });
  }
});

app.listen(PORT, () => console.log(`API em http://127.0.0.1:${PORT}`));