diff --git a/server.cjs b/server.cjs
index 536a14366184b44d7ad1fe8c58023e698ee551bc..19a0480873be40e96b9f1101babaa15844c7751c 100644
--- a/server.cjs
+++ b/server.cjs
@@ -1,38 +1,40 @@
 // server.cjs
 // -------------------------------------------------------------
 // Backend Express + SQLite (sqlite3 async, compatível com bolt.new)
 // Funcionalidades: Reservas, Portaria, Trocas, Mural, TI, Gamificação
 // -------------------------------------------------------------
 const express = require('express');
 const cors = require('cors');
 const morgan = require('morgan');
 const fs = require('fs');
 const path = require('path');
 const sqlite3 = require('sqlite3').verbose();
 const ExcelJS = require('exceljs');
 const PDFDocument = require('pdfkit');
+const { format, parseISO } = require('date-fns');
+const { ptBR } = require('date-fns/locale');
 
 const app = express();
 const PORT = process.env.PORT || 5173; // backend em 3000 (Vite fica em 5173)
 
 // -------------------------------------------------------------
 // Infra básica
 // -------------------------------------------------------------
 app.use(cors());
 app.use(express.json({ limit: '2mb' }));
 app.use(morgan('dev'));
 
 // -------------------------------------------------------------
 // Banco de dados (cria pasta e arquivo se não existirem)
 // -------------------------------------------------------------
 const dataDir = path.join(__dirname, 'data');
 if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
 const dbPath = path.join(dataDir, 'database.sqlite');
 const db = new sqlite3.Database(dbPath, (err) => {
   if (err) console.error('Erro ao abrir o banco:', err.message);
   else console.log('Banco conectado:', dbPath);
 });
 
 // IDs dos calendários do Google para cada sala
 const roomCalendars = {
   aquario: 'sala.aquario@group.calendar.google.com',
diff --git a/server.cjs b/server.cjs
index 536a14366184b44d7ad1fe8c58023e698ee551bc..19a0480873be40e96b9f1101babaa15844c7751c 100644
--- a/server.cjs
+++ b/server.cjs
@@ -74,55 +76,56 @@ function createSchema() {
     db.run(`CREATE TABLE IF NOT EXISTS reservas_salas (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       sala TEXT NOT NULL,
       title TEXT NOT NULL,
       start DATETIME NOT NULL,
       end DATETIME NOT NULL,
       created_by_email TEXT NOT NULL,
       created_by_name TEXT NOT NULL,
       google_event_id TEXT,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     )`);
     db.run(`CREATE TABLE IF NOT EXISTS agendamentos_portaria (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       visitante TEXT NOT NULL,
       documento TEXT,
       empresa TEXT,
       motivo TEXT,
       start DATETIME NOT NULL,
       end DATETIME NOT NULL,
       created_by_email TEXT NOT NULL,
       created_by_name TEXT NOT NULL,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     )`);
     db.run(`CREATE TABLE IF NOT EXISTS trocas_proteina (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
-      data_ref DATE NOT NULL,
+      data DATE NOT NULL,
+      dia TEXT NOT NULL,
       proteina_original TEXT NOT NULL,
       proteina_nova TEXT NOT NULL,
-      usuario_email TEXT NOT NULL,
-      usuario_nome TEXT NOT NULL,
+      email TEXT NOT NULL,
+      nome TEXT NOT NULL,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     )`);
     db.run(`CREATE TABLE IF NOT EXISTS mural_comentarios (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       post_id INTEGER NOT NULL,
       usuario_email TEXT NOT NULL,
       usuario_nome TEXT NOT NULL,
       conteudo TEXT NOT NULL,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     )`);
     db.run(`CREATE TABLE IF NOT EXISTS mural_reacoes (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       post_id INTEGER NOT NULL,
       usuario_email TEXT NOT NULL,
       usuario_nome TEXT NOT NULL,
       tipo TEXT NOT NULL,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       UNIQUE(post_id, usuario_email, tipo)
     )`);
     db.run(`CREATE TABLE IF NOT EXISTS solicitacoes_ti (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       usuario_email TEXT NOT NULL,
       usuario_nome TEXT NOT NULL,
       equipamento TEXT NOT NULL,
       descricao TEXT,
diff --git a/server.cjs b/server.cjs
index 536a14366184b44d7ad1fe8c58023e698ee551bc..19a0480873be40e96b9f1101babaa15844c7751c 100644
--- a/server.cjs
+++ b/server.cjs
@@ -419,162 +422,170 @@ app.post('/api/agendamentos-portaria', async (req, res) => {
     await registrarPontos({ email: req.user.email, nome: req.user.name, acao: 'portaria', pontos: 10, refTable: 'agendamentos_portaria', refId: info.lastID });
     res.json({ ok: true, id: info.lastID });
   } catch (e) {
     console.error('POST /api/agendamentos-portaria', e);
     res.status(500).json({ ok: false, error: 'Erro ao salvar agendamento' });
   }
 });
 
 app.get('/api/agendamentos-portaria', async (_req, res) => {
   try {
     const rows = await all(
       `SELECT id, visitante, documento, empresa, motivo, start, end, created_by_name, created_by_email, created_at
        FROM agendamentos_portaria ORDER BY start ASC`
     );
     res.json(rows);
   } catch (e) {
     res.status(500).json({ ok: false, error: e.message });
   }
 });
 
 // -------------------------------------------------------------
 // Trocas de Proteína (+5) + Exportações
 // -------------------------------------------------------------
 app.post('/api/trocas-proteina', async (req, res) => {
   try {
-    const { data_ref, proteina_original, proteina_nova } = req.body;
-    if (!data_ref || !proteina_original || !proteina_nova) {
-      return res.status(400).json({ ok: false, error: 'Campos: data_ref, proteina_original, proteina_nova' });
+    const { data, proteina_original, proteina_nova } = req.body;
+    if (!data || !proteina_original || !proteina_nova) {
+      return res.status(400).json({ ok: false, error: 'Campos: data, proteina_original, proteina_nova' });
+    }
+    const exists = await get(
+      `SELECT id FROM trocas_proteina WHERE email = ? AND date(data) = date(?)`,
+      [req.user.email, data]
+    );
+    if (exists) {
+      return res.status(400).json({ ok: false, error: 'Troca já registrada para esta data' });
     }
+    const dia = format(parseISO(data), 'EEEE', { locale: ptBR });
     const info = await run(
-      `INSERT INTO trocas_proteina (data_ref, proteina_original, proteina_nova, usuario_email, usuario_nome)
-       VALUES (?, ?, ?, ?, ?)`,
-      [data_ref, proteina_original, proteina_nova, req.user.email, req.user.name]
+      `INSERT INTO trocas_proteina (data, dia, proteina_original, proteina_nova, email, nome)
+       VALUES (?, ?, ?, ?, ?, ?)`,
+      [data, dia, proteina_original, proteina_nova, req.user.email, req.user.name]
     );
     await registrarPontos({ email: req.user.email, nome: req.user.name, acao: 'troca_proteina', pontos: 5, refTable: 'trocas_proteina', refId: info.lastID });
     res.json({ ok: true, id: info.lastID });
   } catch (e) {
     console.error('POST /api/trocas-proteina', e);
     res.status(500).json({ ok: false, error: 'Erro ao salvar troca de proteína' });
   }
 });
 
 app.get('/api/trocas-proteina', async (req, res) => {
   try {
     const { from, to } = req.query;
-    let sql = `SELECT * FROM trocas_proteina`;
-    const params = [];
+    let sql = `SELECT * FROM trocas_proteina WHERE email = ?`;
+    const params = [req.user.email];
     if (from && to) {
-      sql += ` WHERE date(data_ref) BETWEEN date(?) AND date(?)`;
+      sql += ` AND date(data) BETWEEN date(?) AND date(?)`;
       params.push(from, to);
     }
-    sql += ` ORDER BY date(data_ref) ASC, usuario_nome ASC`;
+    sql += ` ORDER BY date(data) ASC`;
     const rows = await all(sql, params);
     res.json(rows);
   } catch (e) {
     res.status(500).json({ ok: false, error: e.message });
   }
 });
 
 app.get('/admin/exportar-trocas', async (req, res) => {
   try {
     if (!['TI', 'RH'].includes(req.user.sector)) {
       return res.status(403).json({ ok: false, error: 'Sem permissão' });
     }
 
     const { formato = 'xlsx', from, to, q } = req.query;
     let sql =
-      `SELECT usuario_nome, usuario_email, data_ref, proteina_original, proteina_nova, created_at FROM trocas_proteina`;
+      `SELECT nome, email, data, proteina_original, proteina_nova, created_at FROM trocas_proteina`;
     const params = [];
     const conds = [];
 
     if (from && to) {
-      conds.push(`date(data_ref) BETWEEN date(?) AND date(?)`);
+      conds.push(`date(data) BETWEEN date(?) AND date(?)`);
       params.push(from, to);
     }
     if (q) {
-      conds.push(`(LOWER(usuario_nome) LIKE LOWER(?) OR LOWER(usuario_email) LIKE LOWER(?))`);
+      conds.push(`(LOWER(nome) LIKE LOWER(?) OR LOWER(email) LIKE LOWER(?))`);
       params.push(`%${q}%`, `%${q}%`);
     }
     if (conds.length) sql += ` WHERE ` + conds.join(' AND ');
-    sql += ` ORDER BY date(data_ref) ASC, usuario_nome ASC`;
+    sql += ` ORDER BY date(data) ASC, nome ASC`;
     const rows = await all(sql, params);
 
     const cols = [
       'Nome do usuário',
       'E-mail',
       'Dia da troca',
       'Proteína original',
       'Nova proteína',
       'Data da solicitação',
     ];
 
     switch (String(formato).toLowerCase()) {
       case 'csv': {
         let csv = cols.join(';') + '\n';
         rows.forEach(r => {
           csv +=
             [
-              r.usuario_nome,
-              r.usuario_email,
-              r.data_ref,
+              r.nome,
+              r.email,
+              r.data,
               r.proteina_original,
               r.proteina_nova,
               r.created_at,
             ].join(';') + '\n';
         });
         res.setHeader('Content-Type', 'text/csv');
         res.setHeader('Content-Disposition', `attachment; filename="trocas_proteina.csv"`);
         return res.send(csv);
       }
       case 'pdf': {
         res.setHeader('Content-Type', 'application/pdf');
         res.setHeader('Content-Disposition', `attachment; filename="trocas_proteina.pdf"`);
         const doc = new PDFDocument({ margin: 36 });
         doc.pipe(res);
         doc.fontSize(16).text('Relatório - Trocas de Proteína', { align: 'center' });
         doc.moveDown();
         rows.forEach(r => {
           doc
             .fontSize(11)
             .text(
-              `${r.usuario_nome} <${r.usuario_email}> | Dia: ${r.data_ref} | ${r.proteina_original} -> ${r.proteina_nova} | Solicitação: ${r.created_at}`
+              `${r.nome} <${r.email}> | Dia: ${r.data} | ${r.proteina_original} -> ${r.proteina_nova} | Solicitação: ${r.created_at}`
             );
           doc.moveDown(0.2);
         });
         doc.end();
         return;
       }
       default: {
         const wb = new ExcelJS.Workbook();
         const ws = wb.addWorksheet('Trocas de Proteína');
         ws.addRow(cols);
         rows.forEach(r =>
           ws.addRow([
-            r.usuario_nome,
-            r.usuario_email,
-            r.data_ref,
+            r.nome,
+            r.email,
+            r.data,
             r.proteina_original,
             r.proteina_nova,
             r.created_at,
           ])
         );
         res.setHeader(
           'Content-Type',
           'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
         );
         res.setHeader(
           'Content-Disposition',
           `attachment; filename="trocas_proteina.xlsx"`
         );
         await wb.xlsx.write(res);
         return res.end();
       }
     }
   } catch (e) {
     console.error('GET /admin/exportar-trocas', e);
     res.status(500).json({ ok: false, error: 'Erro ao gerar arquivo' });
   }
 });
 
 // -------------------------------------------------------------
 // Mural: Comentários (+5) e Reações/curtidas (+5)
