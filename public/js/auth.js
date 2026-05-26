// ── Auth utilities ────────────────────────────────────────────────────────────
const Auth = {
  getToken()  { return sessionStorage.getItem('fehtarco_token'); },
  getUser()   { try { return JSON.parse(sessionStorage.getItem('fehtarco_user')); } catch { return null; } },
  isAdmin()   { const u = this.getUser(); return u && u.rol === 'admin'; },
  isLoggedIn(){ return !!this.getToken(); },

  save(token, user) {
    sessionStorage.setItem('fehtarco_token', token);
    sessionStorage.setItem('fehtarco_user', JSON.stringify(user));
  },
  logout() {
    sessionStorage.removeItem('fehtarco_token');
    sessionStorage.removeItem('fehtarco_user');
    window.location.href = '/login.html';
  },

  // Redirect to login if not authenticated
  require() {
    if (!this.isLoggedIn()) { window.location.href = '/login.html'; return false; }
    return true;
  },
  // Redirect to index if already logged in
  requireGuest() {
    if (this.isLoggedIn()) { window.location.href = '/index.html'; }
  },

  // Fetch wrapper with auth header
  async fetch(url, options = {}) {
    const token = this.getToken();
    const headers = { ...(options.headers || {}) };
    // Don't force Content-Type for FormData (browser sets it with boundary automatically)
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) { this.logout(); return null; }
    return res;
  },

  async get(url)       { const res = await this.fetch(url); return res ? res.json() : null; },
  async put(url, body) { return this.fetch(url, { method: 'PUT', body: JSON.stringify(body) }); },
  async del(url)       { return this.fetch(url, { method: 'DELETE' }); },

  // Render user info in header
  renderUser(containerId) {
    const user = this.getUser();
    const el = document.getElementById(containerId);
    if (!el || !user) return;
    el.innerHTML = `
      <span style="color:#90a4ae;font-size:0.82rem;">👤 ${user.nombre}</span>
      <button onclick="Auth.logout()" class="btn btn-outline" style="font-size:0.78rem;padding:5px 12px;">Salir</button>
    `;
  }
};
