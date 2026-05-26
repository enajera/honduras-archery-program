const express = require('express');
const multer  = require('multer');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const app    = express();
const PORT   = process.env.PORT || 3001;
const SECRET = process.env.JWT_SECRET || 'fehtarco2026_secret_key_xyz';

// ── Modo de almacenamiento (auto-detect) ──────────────────────────────────────
const USE_PG   = !!process.env.POSTGRES_URL;
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

let sql, blobPut, blobDel;
if (USE_PG)   ({ sql }                      = require('@vercel/postgres'));
if (USE_BLOB) ({ put: blobPut, del: blobDel } = require('@vercel/blob'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── JSON helpers (modo local) ─────────────────────────────────────────────────
const dataDir = path.join(__dirname, 'data');
function readJSON(file) {
  const p = path.join(dataDir, file);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJSON(file, data) {
  fs.writeFileSync(path.join(dataDir, file), JSON.stringify(data, null, 2), 'utf8');
}

// ── DB helpers (modo Vercel Postgres) ─────────────────────────────────────────
async function dbGetSetting(key) {
  const { rows } = await sql`SELECT value FROM settings WHERE key = ${key}`;
  return rows[0]?.value ?? null;
}
async function dbSetSetting(key, value) {
  const v = JSON.stringify(value);
  await sql`INSERT INTO settings(key,value) VALUES(${key},${v}::jsonb)
            ON CONFLICT(key) DO UPDATE SET value = ${v}::jsonb`;
}

// ── Capa de datos unificada ───────────────────────────────────────────────────
const store = {
  // USERS
  async getUsers() {
    if (USE_PG) {
      const { rows } = await sql`SELECT id,nombre,email,rol,activo,creado FROM users ORDER BY id`;
      return rows;
    }
    return (readJSON('users.json') || []).map(u => ({ ...u, password: undefined }));
  },
  async findUser(email) {
    if (USE_PG) {
      const { rows } = await sql`SELECT * FROM users WHERE lower(email)=lower(${email}) AND activo=true`;
      return rows[0] || null;
    }
    return (readJSON('users.json') || []).find(u => u.email.toLowerCase() === email.toLowerCase() && u.activo) || null;
  },
  async getUserById(id) {
    if (USE_PG) {
      const { rows } = await sql`SELECT * FROM users WHERE id=${id}`;
      return rows[0] || null;
    }
    return (readJSON('users.json') || []).find(u => u.id == id) || null;
  },
  async createUser(nombre, email, password, rol) {
    const hash   = bcrypt.hashSync(password, 10);
    const creado = new Date().toISOString().split('T')[0];
    if (USE_PG) {
      const { rows } = await sql`
        INSERT INTO users(nombre,email,password,rol,activo,creado)
        VALUES(${nombre},${email},${hash},${rol||'miembro'},true,${creado})
        RETURNING id,nombre,email,rol,activo,creado`;
      return rows[0];
    }
    const users = readJSON('users.json') || [];
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) throw { code: '23505' };
    const u = { id: Date.now(), nombre, email, password: hash, rol: rol||'miembro', activo: true, creado };
    users.push(u);
    writeJSON('users.json', users);
    return { ...u, password: undefined };
  },
  async updateUser(id, fields) {
    const { nombre, email, rol, activo, password } = fields;
    if (USE_PG) {
      if (nombre   !== undefined) await sql`UPDATE users SET nombre=${nombre}   WHERE id=${id}`;
      if (email    !== undefined) await sql`UPDATE users SET email=${email}     WHERE id=${id}`;
      if (rol      !== undefined) await sql`UPDATE users SET rol=${rol}         WHERE id=${id}`;
      if (activo   !== undefined) await sql`UPDATE users SET activo=${activo}   WHERE id=${id}`;
      if (password)               await sql`UPDATE users SET password=${bcrypt.hashSync(password,10)} WHERE id=${id}`;
      return;
    }
    const users = readJSON('users.json') || [];
    const idx = users.findIndex(u => u.id == id);
    if (idx === -1) return;
    if (nombre   !== undefined) users[idx].nombre   = nombre;
    if (email    !== undefined) users[idx].email    = email;
    if (rol      !== undefined) users[idx].rol      = rol;
    if (activo   !== undefined) users[idx].activo   = activo;
    if (password)               users[idx].password = bcrypt.hashSync(password, 10);
    writeJSON('users.json', users);
  },
  async deleteUser(id) {
    if (USE_PG) { await sql`DELETE FROM users WHERE id=${id}`; return; }
    writeJSON('users.json', (readJSON('users.json') || []).filter(u => u.id != id));
  },
  // SETTINGS
  async getSetting(key) {
    if (USE_PG) return dbGetSetting(key);
    return readJSON(key + '.json');
  },
  async setSetting(key, value) {
    if (USE_PG) return dbSetSetting(key, value);
    writeJSON(key + '.json', value);
  },
  // DOCUMENTOS
  async getDocs() {
    if (USE_PG) {
      const { rows } = await sql`SELECT * FROM documentos ORDER BY id DESC`;
      return rows;
    }
    return readJSON('documentos.json') || [];
  },
  async getDoc(id) {
    if (USE_PG) {
      const { rows } = await sql`SELECT * FROM documentos WHERE id=${id}`;
      return rows[0] || null;
    }
    return (readJSON('documentos.json') || []).find(d => d.id == id) || null;
  },
  async addDoc(doc) {
    if (USE_PG) {
      await sql`INSERT INTO documentos(id,nombre,categoria,descripcion,filename,originalname,size,fecha,nivel,subidopor,blob_url)
                VALUES(${doc.id},${doc.nombre},${doc.categoria},${doc.descripcion},${doc.filename},
                       ${doc.originalname},${doc.size},${doc.fecha},${doc.nivel},${doc.subidoPor},${doc.blob_url||null})`;
      return;
    }
    const docs = readJSON('documentos.json') || [];
    docs.push(doc);
    writeJSON('documentos.json', docs);
  },
  async deleteDoc(id) {
    if (USE_PG) { await sql`DELETE FROM documentos WHERE id=${id}`; return; }
    writeJSON('documentos.json', (readJSON('documentos.json') || []).filter(d => d.id != id));
  },
};

// ── DB INIT (solo en producción) ──────────────────────────────────────────────
async function initDB() {
  if (!USE_PG) return;
  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, nombre TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, rol TEXT DEFAULT 'miembro', activo BOOLEAN DEFAULT true, creado TEXT)`;
  await sql`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS documentos (
    id BIGINT PRIMARY KEY, nombre TEXT, categoria TEXT, descripcion TEXT,
    filename TEXT, originalname TEXT, size BIGINT, fecha TEXT, nivel TEXT,
    subidopor TEXT, blob_url TEXT)`;
}

// ── Auth Middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  const raw = (header && header.startsWith('Bearer ') ? header.slice(7) : null) || req.query.token;
  if (!raw) return res.status(401).json({ error: 'No autorizado' });
  try { req.user = jwt.verify(raw, SECRET); next(); }
  catch { return res.status(401).json({ error: 'Token invalido o expirado' }); }
}
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Se requiere rol de administrador' });
    next();
  });
}

// ── Multer (memoria en Blob, disco en local) ──────────────────────────────────
const storage = USE_BLOB
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        const dest = path.join(__dirname, 'uploads');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
      },
      filename: (req, file, cb) => {
        cb(null, Date.now() + '_' + file.originalname.replace(/[<>:"/\\|?*]/g, '_'));
      }
    });
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf','.docx','.xlsx','.pptx','.ppt','.doc','.png','.jpg','.jpeg','.mp4'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  }
});

// ── Servir uploads locales (solo dev) ─────────────────────────────────────────
app.get('/uploads/:filename', requireAuth, (req, res) => {
  const fp = path.join(__dirname, 'uploads', req.params.filename);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Archivo no encontrado' });
  res.sendFile(fp);
});

// ── AUTH ROUTES ───────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contrasena requeridos' });
    const user = await store.findUser(email);
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    const token = jwt.sign(
      { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
      SECRET, { expiresIn: '8h' }
    );
    res.json({ token, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Error del servidor' }); }
});

app.get('/api/me', requireAuth, (req, res) => res.json(req.user));

// ── USUARIOS ──────────────────────────────────────────────────────────────────
app.get('/api/usuarios', requireAdmin, async (req, res) => {
  try { res.json(await store.getUsers()); } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/usuarios', requireAdmin, async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Faltan campos requeridos' });
    const user = await store.createUser(nombre, email, password, rol);
    res.json({ ok: true, user });
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'El email ya existe' });
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/usuarios/:id', requireAdmin, async (req, res) => {
  try { await store.updateUser(req.params.id, req.body); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/usuarios/:id', requireAdmin, async (req, res) => {
  if (req.user.id == req.params.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  try { await store.deleteUser(req.params.id); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/mi-password', requireAuth, async (req, res) => {
  try {
    const { actual, nueva } = req.body;
    if (!actual || !nueva) return res.status(400).json({ error: 'Faltan campos' });
    const user = await store.getUserById(req.user.id);
    if (!user || !bcrypt.compareSync(actual, user.password))
      return res.status(401).json({ error: 'Contrasena actual incorrecta' });
    await store.updateUser(req.user.id, { password: nueva });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DATA (niveles, sesiones, micro, macro, reglas) ────────────────────────────
['niveles','sesiones','micro','macro','reglas'].forEach(key => {
  app.get(`/api/${key}`,  requireAuth,  async (req, res) => {
    try { res.json(await store.getSetting(key)); } catch(e) { res.status(500).json({ error: e.message }); }
  });
  app.put(`/api/${key}`,  requireAdmin, async (req, res) => {
    try { await store.setSetting(key, req.body); res.json({ ok: true }); }
    catch(e) { res.status(500).json({ error: e.message }); }
  });
});
app.get('/api/wa1',          requireAuth, async (req, res) => {
  try { res.json(await store.getSetting('wa1'));          } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/equipamiento', requireAuth, async (req, res) => {
  try { res.json(await store.getSetting('equipamiento')); } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DOCUMENTOS ────────────────────────────────────────────────────────────────
app.get('/api/documentos', requireAuth, async (req, res) => {
  try { res.json(await store.getDocs()); } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/documentos', requireAdmin, upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibio archivo' });
    const safe = req.file.originalname.replace(/[<>:"/\\|?*]/g, '_');
    let filename, blobUrl = null;
    if (USE_BLOB) {
      filename = `${Date.now()}_${safe}`;
      const blob = await blobPut(filename, req.file.buffer, {
        access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN
      });
      blobUrl = blob.url;
    } else {
      filename = req.file.filename;
    }
    const doc = {
      id: Date.now(),
      nombre: req.body.nombre || req.file.originalname,
      categoria: req.body.categoria || 'General',
      descripcion: req.body.descripcion || '',
      filename,
      originalname: req.file.originalname,
      size: req.file.size,
      fecha: new Date().toISOString().split('T')[0],
      nivel: req.body.nivel || '',
      subidoPor: req.user.nombre,
      blob_url: blobUrl,
    };
    await store.addDoc(doc);
    res.json({ ok: true, doc });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

app.delete('/api/documentos/:id', requireAdmin, async (req, res) => {
  try {
    const doc = await store.getDoc(req.params.id);
    if (doc) {
      if (USE_BLOB && doc.blob_url) {
        try { await blobDel(doc.blob_url, { token: process.env.BLOB_READ_WRITE_TOKEN }); } catch {}
      } else if (!USE_BLOB && doc.filename) {
        const fp = path.join(__dirname, 'uploads', doc.filename);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
    }
    await store.deleteDoc(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── START ─────────────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🏹  Honduras Archery Program`);
    console.log(`✅  http://localhost:${PORT}`);
    console.log(`💾  Storage: ${USE_PG   ? 'Vercel Postgres' : 'JSON local'}`);
    console.log(`📦  Files:   ${USE_BLOB ? 'Vercel Blob'     : 'Local uploads'}\n`);
  });
}).catch(err => { console.error('Error iniciando:', err); process.exit(1); });
