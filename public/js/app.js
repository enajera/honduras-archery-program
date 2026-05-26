// ── Auth guard ────────────────────────────────────────────────────────────────
Auth.require();

// Show user name and admin link once page loads
window.addEventListener('DOMContentLoaded', () => {
  const u = Auth.getUser();
  if (u) {
    document.getElementById('header-user').textContent = u.nombre || u.email;
    if (u.rol === 'admin') {
      document.getElementById('admin-link').style.display = 'inline-flex';
    }
  }
});

// ── Utilities ────────────────────────────────────────────────────────────────
function showTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  renderTab(id);
}

function toast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type === 'error' ? ' error' : '');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function toggleDetail(id) {
  const box = document.getElementById(id);
  const vis = box.classList.contains('visible');
  document.querySelectorAll('.detail-box').forEach(b => b.classList.remove('visible'));
  if (!vis) box.classList.add('visible');
}

function fileIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase();
  const map = { pdf: '📄', docx: '📝', doc: '📝', xlsx: '📊', xls: '📊', pptx: '📊', ppt: '📊', png: '🖼️', jpg: '🖼️', jpeg: '🖼️' };
  return map[ext] || '📎';
}

function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

// Build an authenticated URL for file downloads (token in query param)
function uploadUrl(filename) {
  return `/uploads/${encodeURIComponent(filename)}?token=${encodeURIComponent(Auth.getToken())}`;
}

const tipoClass = { basico: 'tag-basico', intermedio: 'tag-intermedio', avanzado: 'tag-avanzado', elite: 'tag-elite' };
const colorClass = { verde: 'verde', azul: 'azul', naranja: 'naranja', morado: 'morado', rojo: 'rojo', cyan: 'cyan' };

// ── Cache / loading state ─────────────────────────────────────────────────────
const loaded = {};

function renderTab(id) {
  if (loaded[id]) return;
  loaded[id] = true;
  const renders = {
    iniciacion: renderIniciacion,
    ruta: renderRuta,
    niveles: renderNiveles,
    reglas: renderReglas,
    documentos: renderDocumentos,
    micro: renderMicro,
    macro: renderMacro,
  };
  if (renders[id]) renders[id]();
}

// ── Iniciación ────────────────────────────────────────────────────────────────
async function renderIniciacion() {
  const data = await Auth.get('/api/sesiones');
  const el = document.getElementById('iniciacion-content');
  const dg = data.descripcion_general;

  let html = `
  <div class="card" style="border-color:var(--verde-c);margin-bottom:20px;">
    <h3 style="color:#a5d6a7;">📌 Descripción General</h3>
    <p style="font-size:0.9rem;color:var(--text2);line-height:1.6;">
      Duración: <strong>${dg.duracion_sesiones} sesiones / ${dg.horas_totales} horas totales</strong><br>
      Modalidad: ${dg.modalidad}<br>
      Captación: <strong>${dg.captacion}</strong>
    </p>
  </div>
  <div class="sessions-grid">`;

  const colors = { 1: '#4caf50', 2: '#2196f3', 3: '#ff9800', 4: '#e91e63' };
  data.sesiones.forEach(s => {
    html += `<div class="session-card" style="border-color:${colors[s.numero]};">
      <div class="session-label" style="color:${colors[s.numero]};">Sesión ${s.numero}</div>
      <h3>${s.titulo}</h3>
      <ul>${s.contenidos.map(c => `<li>${c}</li>`).join('')}</ul>
    </div>`;
  });
  html += `</div>`;

  html += `<p class="section-title" style="margin-top:24px;">Módulo Básico — Contenido</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
    <div class="card" style="border-color:var(--azul-c);">
      <h3 style="color:var(--azul-c);">📦 Materiales</h3>
      <ul style="list-style:none;">${data.materiales.map(m => `<li style="padding:4px 0;font-size:0.87rem;color:var(--text2);border-bottom:1px solid var(--border);">• ${m}</li>`).join('')}</ul>
    </div>
    <div class="card" style="border-color:var(--verde-c);">
      <h3 style="color:#a5d6a7;">📚 Temas Básicos</h3>
      <ul style="list-style:none;">${data.temas_basicos.map(t => `<li style="padding:4px 0;font-size:0.87rem;color:var(--text2);border-bottom:1px solid var(--border);">• ${t}</li>`).join('')}</ul>
    </div>
  </div>
  <div class="nota" style="margin-top:20px;">
    <span style="font-size:1.2rem;flex-shrink:0;">🏹</span>
    <div><strong>Arcos de iniciación:</strong> ${data.arcos_iniciacion.map(a => `<strong>${a.nombre}</strong> — ${a.descripcion}`).join(' / ')}</div>
  </div>`;

  el.innerHTML = html;
}

// ── Ruta de Progresión ────────────────────────────────────────────────────────
async function renderRuta() {
  const niveles = await Auth.get('/api/niveles');
  const el = document.getElementById('ruta-content');

  const byId = {};
  niveles.forEach(n => byId[n.id] = n);

  function detailBox(n) {
    if (!n) return '';
    const eq = n.equipo_recomendado && n.equipo_recomendado.length ? `<li>Equipo: ${n.equipo_recomendado.join(', ')}</li>` : '';
    const pct = n.porcentaje ? `<li>Mínimo: ${n.porcentaje}% (${n.puntaje_requerido}/${n.puntaje_total} pts)</li>` : '';
    const ev = n.evaluaciones ? `<li>Evaluaciones: ${n.evaluaciones}</li>` : '';
    const h = n.horas ? `<li>Horas: ~${n.horas}h</li>` : '';
    const fch = n.flechas ? `<li>Flechas: ${n.flechas} por evaluación</li>` : '';
    const nota = n.notas ? `<li>${n.notas}</li>` : '';
    return `<div class="detail-box" id="detail-${n.id}">
      <h4>${n.nombre}</h4>
      <ul>${h}${fch}${pct}${ev}${eq}${nota}</ul>
    </div>`;
  }

  function node(n, cls) {
    const sub = n.distancia && n.distancia !== 'Corta' ? `${n.distancia} · ${n.flechas ? n.flechas + ' flechas' : ''} · ${n.porcentaje ? n.porcentaje + '%' : ''}` : (n.horas ? `~${n.horas}h` : '');
    return `<div class="flow-node ${cls}" onclick="toggleDetail('detail-${n.id}')">
      ${n.nombre}<div class="node-sub">${sub}</div>
    </div>${detailBox(n)}`;
  }

  const ints = ['intermedio1','intermedio2','intermedio3'].map(id => byId[id]);
  const advs = ['avanzado1','avanzado2','avanzado3'].map(id => byId[id]);
  const elite = byId['atleta_ab'];

  let compBranch = ints.map(n => `${node(n,'n-intermedio')}<div class="flow-arrow"></div>`).join('') +
    advs.map(n => `${node(n,'n-avanzado')}<div class="flow-arrow"></div>`).join('') +
    `<div class="flow-node n-elite" onclick="toggleDetail('detail-atleta_ab')">
      🥇 ${elite.nombre}<div class="node-sub">Pre-selección Nacional</div>
    </div>${detailBox(elite)}`;

  let html = `<div class="flow-outer"><div class="flow-wrap">
    ${node(byId['basico1'],'n-inicio')}<div class="flow-arrow"></div>
    ${node(byId['basico1'],'n-basico')}<div class="flow-arrow"></div>
    ${node(byId['basico2'],'n-basico')}<div class="flow-arrow" style="height:18px;"></div>

    <div style="display:flex;align-items:center;width:100%;justify-content:center;">
      <div class="hline"></div><div style="width:2px;height:28px;background:var(--border2);"></div><div class="hline"></div>
    </div>

    <div class="flow-split">
      <div class="flow-branch">
        <div class="flow-node n-recreativo" onclick="toggleDetail('detail-rec')">
          🎯 Recreativo<div class="node-sub">Disfrute · Tiro 3D</div>
        </div>
        <div class="detail-box" id="detail-rec">
          <h4>Ruta Recreativa</h4>
          <ul><li>Tiro con Arco 3D</li><li>Torneos informales</li><li>Arcos: Genesis, Take Downs, Madera, Propio</li></ul>
        </div>
        <div class="flow-arrow"></div>
        <div class="flow-node n-end">🏁 END<div class="node-sub">Arquero activo recreativo</div></div>
      </div>
      <div class="flow-branch">${compBranch}</div>
    </div>
  </div></div>`;

  html += `<div class="pendiente">⚠️ <strong>Pendiente de votación:</strong> Porcentajes en niveles Avanzados (80–85%) se someterán a revisión — posiblemente subir a 90%.</div>`;
  el.innerHTML = html;
}

// ── Niveles ───────────────────────────────────────────────────────────────────
async function renderNiveles() {
  const niveles = await Auth.get('/api/niveles');
  const el = document.getElementById('niveles-content');

  let rows = niveles.map(n => {
    const tag = `<span class="nivel-tag ${tipoClass[n.tipo] || 'tag-basico'}">${n.nombre}</span>`;
    const pct = n.porcentaje ? `${n.porcentaje}%${n.pendiente_votacion ? ' ⚠️' : ''}` : '—';
    const pts = n.puntaje_requerido ? `${n.puntaje_requerido} / ${n.puntaje_total}` : '—';
    return `<tr>
      <td>${tag}</td>
      <td>${n.distancia || '—'}</td>
      <td>${n.diana || '—'}</td>
      <td>${n.flechas || '—'}</td>
      <td>${pct}</td>
      <td>${pts}</td>
      <td>${n.evaluaciones || '—'}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
  <div style="overflow-x:auto;">
  <table>
    <thead><tr>
      <th>Nivel</th><th>Distancia</th><th>Diana</th><th>Flechas</th>
      <th>% Mínimo</th><th>Pts requeridos</th><th>Evaluaciones</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  </div>
  <div class="nota" style="margin-top:20px;">
    <span style="font-size:1.1rem;flex-shrink:0;">⚠️</span>
    <div>Puntuación máxima: 10 pts/flecha (720 pts para 72 flechas). Los porcentajes marcados con ⚠️ están pendientes de votación en la federación.</div>
  </div>
  <div class="nota" style="margin-top:10px;border-color:var(--azul-c);background:var(--bg4);color:#90caf9;">
    <span style="font-size:1.1rem;flex-shrink:0;">🎯</span>
    <div><strong>Ruta Recreativa:</strong> Tiro 3D, Table Downs, arcos de madera, arcos propios. Sin evaluaciones formales.</div>
  </div>`;
}

// ── Reglas ────────────────────────────────────────────────────────────────────
async function renderReglas() {
  const data = await Auth.get('/api/reglas');
  const el = document.getElementById('reglas-content');

  let html = `<p style="font-size:0.84rem;color:var(--text2);margin-bottom:20px;">
    Fuente: <strong>${data.fuente}</strong> · Actualizado: ${data.ultima_actualizacion}
  </p>`;

  data.secciones.forEach(s => {
    html += `<div class="regla-seccion">
      <h3>${s.icono} ${s.titulo}</h3>
      <ol>${s.reglas.map(r => `<li>${r}</li>`).join('')}</ol>
    </div>`;
  });

  el.innerHTML = html;
}

// ── Documentos ────────────────────────────────────────────────────────────────
async function renderDocumentos() {
  const docs = await Auth.get('/api/documentos');
  const el = document.getElementById('documentos-content');
  el.innerHTML = buildDocsHTML(docs);
}

function buildDocsHTML(docs) {
  if (!docs || !docs.length) {
    return `<div class="docs-grid"><div class="doc-empty">
      <p style="font-size:2rem;margin-bottom:10px;">📭</p>
      <p>No hay documentos aún.</p>
      <p style="margin-top:6px;">Ve a <a href="admin.html" style="color:var(--azul-c);">Administración</a> para subir archivos.</p>
    </div></div>`;
  }

  const cats = [...new Set(docs.map(d => d.categoria))];
  let html = '';
  cats.forEach(cat => {
    const catDocs = docs.filter(d => d.categoria === cat);
    html += `<p style="font-size:0.9rem;font-weight:700;color:var(--azul-c);margin:20px 0 10px;border-bottom:1px solid var(--border);padding-bottom:6px;">${cat}</p>
    <div class="docs-grid">`;
    catDocs.forEach(d => {
      html += `<div class="doc-card">
        <div class="doc-icon">${fileIcon(d.filename)}</div>
        <div class="doc-name">${d.nombre}</div>
        <span class="doc-cat">${d.categoria}</span>
        ${d.nivel ? `<span class="chip" style="font-size:0.72rem;">${d.nivel}</span>` : ''}
        ${d.descripcion ? `<div class="doc-desc">${d.descripcion}</div>` : ''}
        <div class="doc-meta">${d.fecha} · ${fmtBytes(d.size)}</div>
        <div class="doc-actions">
          <a href="${uploadUrl(d.filename)}" target="_blank" class="btn btn-primary" style="font-size:0.78rem;padding:6px 12px;">👁️ Abrir</a>
        </div>
      </div>`;
    });
    html += `</div>`;
  });
  return html;
}

// ── MICRO ─────────────────────────────────────────────────────────────────────
async function renderMicro() {
  const data = await Auth.get('/api/micro');
  const el = document.getElementById('micro-content');

  let html = `<div class="mm-grid">`;
  data.categorias.forEach(c => {
    html += `<div class="mm-card ${colorClass[c.color] || 'azul'}">
      <h4>${c.icono} ${c.titulo}</h4>
      <ul>${c.items.map(i => `<li>${i}</li>`).join('')}</ul>
    </div>`;
  });
  html += `</div>`;
  el.innerHTML = html;
}

// ── MACRO ─────────────────────────────────────────────────────────────────────
async function renderMacro() {
  const data = await Auth.get('/api/macro');
  const el = document.getElementById('macro-content');

  let html = `<div class="mm-grid">`;
  data.pilares.forEach(p => {
    const muns = p.municipios ? `<div style="margin-top:8px;">${p.municipios.map(m => `<span class="chip">${m}</span>`).join('')}</div>` : '';
    html += `<div class="mm-card ${colorClass[p.color] || 'azul'}">
      <h4>${p.icono} ${p.titulo}</h4>
      <ul>${p.items.map(i => `<li>${i}</li>`).join('')}</ul>
      ${muns}
      ${p.nota ? `<p style="font-size:0.78rem;color:var(--text3);margin-top:8px;">${p.nota}</p>` : ''}
    </div>`;
  });
  html += `</div>`;

  if (data.notas && data.notas.length) {
    html += data.notas.map(n => `<div class="nota" style="margin-top:16px;"><span style="font-size:1.1rem;">📍</span><div>${n}</div></div>`).join('');
  }
  el.innerHTML = html;
}

// ── Init ──────────────────────────────────────────────────────────────────────
renderTab('iniciacion');
