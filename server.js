const express = require('express');
const multer  = require('multer');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const app    = express();
const PORT   = process.env.PORT || 3001;
const SECRET = process.env.JWT_SECRET || 'fehtarco2026_secret_key_cambiar_en_produccion';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helpers JSON
const dataDir = path.join(__dirname, 'data');
function readJSON(file) {
  const p = path.join(dataDir, file);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJSON(file, data) {
  fs.writeFileSync(path.join(dataDir, file), JSON.stringify(data, null, 2), 'utf8');
}

// Auth Middleware
function requireAuth(req, res, next) {
  // Accept token from Authorization header OR ?token= query param (for file downloads)
  const header = req.headers['authorization'];
  const queryToken = req.query.token;
  const raw = header && header.startsWith('Bearer ') ? header.slice(7) : queryToken;
  if (!raw) return res.status(401).json({ error: 'No autorizado' });
  try {
    const decoded = jwt.verify(raw, SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Se requiere rol de administrador' });
    }
    next();
  });
}

// AUTH ROUTES
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contrasena requeridos' });
  const users = readJSON('users.json') || [];
  const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.activo);
  if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  const token = jwt.sign(
    { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
    SECRET,
    { expiresIn: '8h' }
  );
  res.json({ token, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } });
});

app.get('/api/me', requireAuth, (req, res) => res.json(req.user));

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[<>:"/\\|?*]/g, '_');
    cb(null, Date.now() + '_' + safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf','.docx','.xlsx','.pptx','.ppt','.doc','.png','.jpg','.jpeg','.mp4'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// Serve uploaded files (auth required)
app.get('/uploads/:filename', requireAuth, (req, res) => {
  const fp = path.join(__dirname, 'uploads', req.params.filename);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Archivo no encontrado' });
  res.sendFile(fp);
});

// API: Usuarios (admin only)
app.get('/api/usuarios', requireAdmin, (req, res) => {
  const users = (readJSON('users.json') || []).map(u => ({ ...u, password: undefined }));
  res.json(users);
});

app.post('/api/usuarios', requireAdmin, (req, res) => {
  const { nombre, email, password, rol } = req.body;
  if (!nombre || !email || !password) return res.status(400).json({ error: 'Faltan campos requeridos' });
  const users = readJSON('users.json') || [];
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'El email ya existe' });
  }
  const nuevo = {
    id: Date.now(),
    nombre, email,
    password: bcrypt.hashSync(password, 10),
    rol: rol || 'miembro',
    activo: true,
    creado: new Date().toISOString().split('T')[0]
  };
  users.push(nuevo);
  writeJSON('users.json', users);
  res.json({ ok: true, user: { ...nuevo, password: undefined } });
});

app.put('/api/usuarios/:id', requireAdmin, (req, res) => {
  const users = readJSON('users.json') || [];
  const idx = users.findIndex(u => u.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado' });
  const { nombre, email, rol, activo, password } = req.body;
  if (nombre) users[idx].nombre = nombre;
  if (email)  users[idx].email  = email;
  if (rol)    users[idx].rol    = rol;
  if (activo !== undefined) users[idx].activo = activo;
  if (password) users[idx].password = bcrypt.hashSync(password, 10);
  writeJSON('users.json', users);
  res.json({ ok: true });
});

app.delete('/api/usuarios/:id', requireAdmin, (req, res) => {
  if (req.user.id == req.params.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  let users = readJSON('users.json') || [];
  users = users.filter(u => u.id != req.params.id);
  writeJSON('users.json', users);
  res.json({ ok: true });
});

// Change own password
app.put('/api/mi-password', requireAuth, (req, res) => {
  const { actual, nueva } = req.body;
  if (!actual || !nueva) return res.status(400).json({ error: 'Faltan campos' });
  const users = readJSON('users.json') || [];
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (!bcrypt.compareSync(actual, users[idx].password)) return res.status(401).json({ error: 'Contrasena actual incorrecta' });
  users[idx].password = bcrypt.hashSync(nueva, 10);
  writeJSON('users.json', users);
  res.json({ ok: true });
});

// API: Data (all require auth, PUT require admin)
app.get('/api/niveles',      requireAuth,  (req, res) => res.json(readJSON('niveles.json')));
app.put('/api/niveles',      requireAdmin, (req, res) => { writeJSON('niveles.json', req.body); res.json({ ok: true }); });

app.get('/api/sesiones',     requireAuth,  (req, res) => res.json(readJSON('sesiones.json')));
app.put('/api/sesiones',     requireAdmin, (req, res) => { writeJSON('sesiones.json', req.body); res.json({ ok: true }); });

app.get('/api/micro',        requireAuth,  (req, res) => res.json(readJSON('micro.json')));
app.put('/api/micro',        requireAdmin, (req, res) => { writeJSON('micro.json', req.body); res.json({ ok: true }); });

app.get('/api/macro',        requireAuth,  (req, res) => res.json(readJSON('macro.json')));
app.put('/api/macro',        requireAdmin, (req, res) => { writeJSON('macro.json', req.body); res.json({ ok: true }); });

app.get('/api/reglas',       requireAuth,  (req, res) => res.json(readJSON('reglas.json')));
app.put('/api/reglas',       requireAdmin, (req, res) => { writeJSON('reglas.json', req.body); res.json({ ok: true }); });

app.get('/api/wa1',          requireAuth,  (req, res) => res.json(readJSON('wa1.json')));
app.get('/api/equipamiento', requireAuth,  (req, res) => res.json(readJSON('equipamiento.json')));

// API: Documentos
app.get('/api/documentos', requireAuth, (req, res) => res.json(readJSON('documentos.json') || []));

app.post('/api/documentos', requireAdmin, upload.single('archivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibio archivo' });
  const docs = readJSON('documentos.json') || [];
  const nuevo = {
    id: Date.now(),
    nombre: req.body.nombre || req.file.originalname,
    categoria: req.body.categoria || 'General',
    descripcion: req.body.descripcion || '',
    filename: req.file.filename,
    originalname: req.file.originalname,
    size: req.file.size,
    fecha: new Date().toISOString().split('T')[0],
    nivel: req.body.nivel || '',
    subidoPor: req.user.nombre
  };
  docs.push(nuevo);
  writeJSON('documentos.json', docs);
  res.json({ ok: true, doc: nuevo });
});

app.delete('/api/documentos/:id', requireAdmin, (req, res) => {
  let docs = readJSON('documentos.json') || [];
  const doc = docs.find(d => d.id == req.params.id);
  if (doc) {
    const fp = path.join(__dirname, 'uploads', doc.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    docs = docs.filter(d => d.id != req.params.id);
    writeJSON('documentos.json', docs);
  }
  res.json({ ok: true });
});

// Start
app.listen(PORT, () => {
  console.log('\n Corriendo en http://localhost:' + PORT);
  console.log('   Login: http://localhost:' + PORT + '/login.html');
  console.log('   Admin: http://localhost:' + PORT + '/admin.html\n');
  console.log('   Usuario: elvin7n@gmail.com');
  console.log('   Password: Fehtarco2026!\n');
});
