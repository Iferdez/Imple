import { getCurrentUser } from '../auth.js';
import { loadClients, loadAcciones, addAccion, deleteAccion, TIPOS_ACCION, getTipoAccion } from '../data.js';

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const todayStr = getTodayStr();
  const yStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === todayStr) return 'Hoy';
  if (dateStr === yStr) return 'Ayer';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// State persisted across re-renders
const state = {
  selectedTipo: 'llamada',
  pinnedClientId: null,   // "lock" a client so you can log 10 things to it fast
};

export function renderMiDia() {
  const container = document.getElementById('midia-container');
  if (!container) return;

  const user = getCurrentUser();
  if (!user) return;

  const isLeader = user.role === 'lider';
  const allClients = loadClients();
  const myClients  = isLeader
    ? allClients
    : allClients.filter(c => c.asignado === user.username || c.asignadoSecundario === user.username);

  myClients.sort((a, b) => a.nombre.localeCompare(b.nombre));

  const allAcciones = loadAcciones();
  const todayStr    = getTodayStr();
  const filterUser  = isLeader ? (window.midiaFilterUser || '') : user.username;
  const filterDate  = window.midiaFilterDate || todayStr;

  const filtered = allAcciones.filter(a => {
    const d = a.timestamp.split('T')[0];
    const userOk = filterUser ? a.userId === filterUser : true;
    return d === filterDate && userOk;
  });

  // ── Leader filter bar ──────────────────────────────────────────────
  let filterBarHTML = '';
  if (isLeader) {
    const users = JSON.parse(localStorage.getItem('crm_users') || '[]');
    const impls = users.filter(u => u.role !== 'lider');
    filterBarHTML = `
      <div class="midia-filter-bar">
        <div class="midia-filter-group">
          <i class="fa-solid fa-user"></i>
          <select class="midia-filter-select" onchange="window.setMidiaFilter('user',this.value)">
            <option value="">Todos los implementadores</option>
            ${impls.map(u => `<option value="${u.username}" ${filterUser===u.username?'selected':''}>${u.displayName||u.username}</option>`).join('')}
          </select>
        </div>
        <div class="midia-filter-group">
          <i class="fa-solid fa-calendar"></i>
          <input type="date" class="midia-filter-select" value="${filterDate}"
            onchange="window.setMidiaFilter('date',this.value)" max="${todayStr}">
        </div>
        <span class="midia-filter-count">${filtered.length} acción${filtered.length!==1?'es':''} registradas</span>
      </div>`;
  }

  // ── Quick-entry form (today only) ──────────────────────────────────
  const isToday = filterDate === todayStr;
  const showForm = isToday && (!isLeader || filterUser === user.username || !filterUser);

  const clientOptions = myClients.map(c =>
    `<option value="${c.id}" ${state.pinnedClientId===c.id?'selected':''}>${c.nombre}</option>`
  ).join('');

  const tipoButtons = TIPOS_ACCION.map(t => {
    const active = state.selectedTipo === t.value;
    return `<button type="button" class="tipo-pill${active?' active':''}"
      data-tipo="${t.value}"
      onclick="window.midiaSelectTipo('${t.value}')"
      style="${active?`background:${t.color};border-color:${t.color};color:#fff;`:`border-color:${t.color}44;color:${t.color};`}"
      title="${t.label}">
        <i class="fa-solid ${t.icon}"></i>
        <span>${t.label}</span>
    </button>`;
  }).join('');

  const pinned = state.pinnedClientId
    ? myClients.find(c => c.id === state.pinnedClientId)
    : null;

  const formHTML = showForm ? `
    <div class="midia-quickentry">
      <div class="midia-quickentry-header">
        <span class="midia-quickentry-title"><i class="fa-solid fa-bolt"></i> Carga rápida</span>
        <span class="midia-quickentry-hint">Enter para guardar · Tab para cambiar tipo</span>
      </div>

      <div class="midia-quickentry-body">

        <!-- CLIENT selector with pin -->
        <div class="midia-client-row">
          <div class="midia-client-select-wrap ${pinned?'pinned':''}">
            ${pinned
              ? `<div class="midia-pinned-badge">
                  <i class="fa-solid fa-thumbtack"></i>
                  <span>${pinned.nombre}</span>
                  <button class="midia-pin-clear" onclick="window.midiaClearPin()" title="Cambiar cliente">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>`
              : `<div class="select-wrapper" style="flex:1;">
                  <select id="midia-cliente" class="edit-select midia-client-select" onchange="window.midiaOnClientChange(this.value)">
                    <option value="">— Seleccioná el cliente —</option>
                    ${clientOptions}
                  </select>
                  <i class="fa-solid fa-chevron-down select-arrow" style="font-size:8px;"></i>
                </div>`
            }
          </div>
          ${!pinned ? `<button class="midia-pin-btn" onclick="window.midiaPinClient()" title="Fijar cliente (para cargar varias acciones seguidas)">
            <i class="fa-solid fa-thumbtack"></i> Fijar
          </button>` : ''}
        </div>

        <!-- TIPO pills -->
        <div class="midia-tipo-row">
          <span class="midia-section-label">Tipo</span>
          <div class="tipo-pill-group" id="tipo-pill-group">${tipoButtons}</div>
        </div>

        <!-- DESCRIPTION + save -->
        <div class="midia-desc-row">
          <input type="text" id="midia-desc" class="midia-desc-input"
            placeholder="¿Qué hiciste? Ej: Llamé para confirmar la fecha de arranque..."
            autocomplete="off"
            onkeydown="window.midiaDescKeydown(event)">
          <button class="btn btn-primary midia-save-btn" onclick="window.midiaGuardar()">
            <i class="fa-solid fa-check"></i>
            <span>Guardar</span>
          </button>
        </div>

        <div class="midia-keyboard-hint">
          <kbd>Enter</kbd> guardar &nbsp;·&nbsp;
          <kbd>Alt+1…6</kbd> cambiar tipo &nbsp;·&nbsp;
          <kbd>Alt+P</kbd> fijar/soltar cliente
        </div>

      </div>

      <!-- Live feed of today's entries (only what the current user logged) -->
      <div class="midia-live-feed" id="midia-live-feed">
        ${renderLiveFeed(allAcciones, user.username, allClients)}
      </div>
    </div>` : '';

  // ── Grouped acciones list (by client) ────────────────────────────
  const byClient = {};
  filtered.forEach(a => {
    if (!byClient[a.clientId]) byClient[a.clientId] = { nombre: a.clientNombre, acciones: [] };
    byClient[a.clientId].acciones.push(a);
  });

  const accionesHTML = Object.keys(byClient).length === 0
    ? `<div class="midia-empty">
        <i class="fa-solid fa-clipboard-list"></i>
        <p>${isToday ? 'Sin acciones registradas hoy.' : 'Sin acciones para esta fecha.'}</p>
      </div>`
    : Object.keys(byClient).map(clientId => {
        const g = byClient[clientId];
        const rows = g.acciones.map(a => {
          const t = getTipoAccion(a.tipo);
          const canDel = a.userId === user.username || isLeader;
          return `<div class="accion-row">
            <span class="accion-tipo-icon" style="color:${t.color};background:${t.color}18;">
              <i class="fa-solid ${t.icon}"></i>
            </span>
            <div class="accion-row-body">
              <div class="accion-desc">${a.descripcion}</div>
              <div class="accion-meta">
                <span class="accion-tipo-chip" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}44;">
                  <i class="fa-solid ${t.icon}" style="font-size:10px;"></i> ${t.label}
                </span>
                <span class="accion-time"><i class="fa-regular fa-clock" style="opacity:.5;"></i> ${formatTime(a.timestamp)}</span>
                ${isLeader ? `<span class="accion-user"><i class="fa-solid fa-user" style="opacity:.5;font-size:9px;"></i> ${a.userId}</span>` : ''}
              </div>
            </div>
            ${canDel ? `<button class="accion-delete-btn" onclick="window.midiaDeleteAccion(${a.id})" title="Eliminar"><i class="fa-solid fa-xmark"></i></button>` : ''}
          </div>`;
        }).join('');

        const cl = allClients.find(c => c.id === parseInt(clientId));
        return `<div class="accion-client-group">
          <div class="accion-client-header">
            <span class="accion-client-name" onclick="window.openDetail(${clientId})">
              <i class="fa-solid fa-building" style="opacity:.5;font-size:10px;margin-right:5px;"></i>${g.nombre}
            </span>
            ${cl?.estado ? `<span class="accion-client-estado">${cl.estado}</span>` : ''}
            <span class="accion-client-count">${g.acciones.length} acción${g.acciones.length!==1?'es':''}</span>
          </div>
          <div class="accion-rows">${rows}</div>
        </div>`;
      }).join('');

  container.innerHTML = `
    ${filterBarHTML}
    ${formHTML}
    ${!isToday || isLeader ? `
    <div class="midia-section-header">
      <span>${isLeader && filterUser ? (JSON.parse(localStorage.getItem('crm_users')||'[]').find(u=>u.username===filterUser)?.displayName||filterUser) : 'Acciones'} · ${formatDateLabel(filterDate)}</span>
    </div>` : ''}
    <div class="midia-acciones-list">${accionesHTML}</div>`;

  // Focus the description input
  if (showForm && !pinned) {
    // Don't auto-focus client selector - user might be mid-use
  } else if (showForm) {
    setTimeout(() => document.getElementById('midia-desc')?.focus(), 50);
  }
}

function renderLiveFeed(allAcciones, username, allClients) {
  const todayStr = getTodayStr();
  const mine = allAcciones.filter(a => a.userId === username && a.timestamp.split('T')[0] === todayStr);
  if (mine.length === 0) return `<div class="midia-live-empty">Nada registrado hoy todavía.</div>`;

  return mine.slice(0, 20).map(a => {
    const t = getTipoAccion(a.tipo);
    return `<div class="midia-live-row">
      <span class="midia-live-tipo" style="color:${t.color};">
        <i class="fa-solid ${t.icon}"></i>
      </span>
      <span class="midia-live-client">${a.clientNombre}</span>
      <span class="midia-live-desc">${a.descripcion}</span>
      <span class="midia-live-time">${formatTime(a.timestamp)}</span>
      <button class="midia-live-del" onclick="window.midiaDeleteAccion(${a.id})" title="Eliminar">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>`;
  }).join('');
}

// ── Global handlers ────────────────────────────────────────────────

window.midiaSelectTipo = function(tipo) {
  state.selectedTipo = tipo;
  // Update pills without full re-render
  document.querySelectorAll('.tipo-pill').forEach(btn => {
    const t = getTipoAccion(btn.dataset.tipo);
    const active = btn.dataset.tipo === tipo;
    btn.className = 'tipo-pill' + (active ? ' active' : '');
    btn.style.cssText = active
      ? `background:${t.color};border-color:${t.color};color:#fff;`
      : `border-color:${t.color}44;color:${t.color};`;
  });
  document.getElementById('midia-desc')?.focus();
};

window.midiaOnClientChange = function(val) {
  state.lastClientId = val ? parseInt(val) : null;
};

window.midiaPinClient = function() {
  const sel = document.getElementById('midia-cliente');
  if (!sel || !sel.value) {
    sel?.focus();
    sel && (sel.style.borderColor = 'var(--red-border)');
    setTimeout(() => sel && (sel.style.borderColor = ''), 1500);
    return;
  }
  state.pinnedClientId = parseInt(sel.value);
  renderMiDia();
  setTimeout(() => document.getElementById('midia-desc')?.focus(), 50);
};

window.midiaClearPin = function() {
  state.pinnedClientId = null;
  renderMiDia();
  setTimeout(() => document.getElementById('midia-cliente')?.focus(), 50);
};

window.midiaDescKeydown = function(e) {
  if (e.key === 'Enter') { e.preventDefault(); window.midiaGuardar(); }
  // Alt+1-6: switch tipo
  if (e.altKey && e.key >= '1' && e.key <= '6') {
    e.preventDefault();
    const idx = parseInt(e.key) - 1;
    if (TIPOS_ACCION[idx]) window.midiaSelectTipo(TIPOS_ACCION[idx].value);
  }
  // Alt+P: toggle pin
  if (e.altKey && (e.key === 'p' || e.key === 'P')) {
    e.preventDefault();
    if (state.pinnedClientId) window.midiaClearPin();
    else window.midiaPinClient();
  }
};

window.midiaGuardar = function() {
  const user = getCurrentUser();
  if (!user) return;

  const clientId = state.pinnedClientId
    || parseInt(document.getElementById('midia-cliente')?.value || '0');
  const descEl = document.getElementById('midia-desc');
  const desc = descEl?.value?.trim();

  if (!clientId) {
    const sel = document.getElementById('midia-cliente');
    sel?.focus();
    if (sel) { sel.style.borderColor = 'var(--red-border)'; setTimeout(() => sel.style.borderColor = '', 1500); }
    return;
  }
  if (!desc) {
    descEl?.focus();
    if (descEl) { descEl.style.borderColor = 'var(--red-border)'; setTimeout(() => descEl.style.borderColor = '', 1500); }
    return;
  }

  const clients = loadClients();
  const client  = clients.find(c => c.id === clientId);
  if (!client) return;

  addAccion(user.username, clientId, client.nombre, state.selectedTipo, desc);
  if (descEl) descEl.value = '';

  // Flash confirmation inline instead of toast (less disruptive when logging many)
  if (descEl) {
    descEl.style.borderColor = '#22c55e';
    setTimeout(() => { if (descEl) descEl.style.borderColor = ''; }, 600);
  }

  // Only refresh the live feed + acciones list, NOT the whole page
  const allAcciones = loadAcciones();
  const feedEl = document.getElementById('midia-live-feed');
  if (feedEl) feedEl.innerHTML = renderLiveFeed(allAcciones, user.username, clients);

  // Refresh the grouped list below
  const listEl = document.getElementById('midia-acciones-list');
  if (listEl) {
    const todayStr = getTodayStr();
    const filtered = allAcciones.filter(a => a.timestamp.split('T')[0] === todayStr && a.userId === user.username);
    const byClient = {};
    filtered.forEach(a => {
      if (!byClient[a.clientId]) byClient[a.clientId] = { nombre: a.clientNombre, acciones: [] };
      byClient[a.clientId].acciones.push(a);
    });
    listEl.innerHTML = Object.keys(byClient).length === 0 ? '' :
      Object.keys(byClient).map(cid => {
        const g = byClient[cid];
        const rows = g.acciones.map(a => {
          const t = getTipoAccion(a.tipo);
          return `<div class="accion-row">
            <span class="accion-tipo-icon" style="color:${t.color};background:${t.color}18;"><i class="fa-solid ${t.icon}"></i></span>
            <div class="accion-row-body">
              <div class="accion-desc">${a.descripcion}</div>
              <div class="accion-meta">
                <span class="accion-tipo-chip" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}44;"><i class="fa-solid ${t.icon}" style="font-size:10px;"></i> ${t.label}</span>
                <span class="accion-time"><i class="fa-regular fa-clock" style="opacity:.5;"></i> ${formatTime(a.timestamp)}</span>
              </div>
            </div>
            <button class="accion-delete-btn" onclick="window.midiaDeleteAccion(${a.id})" title="Eliminar"><i class="fa-solid fa-xmark"></i></button>
          </div>`;
        }).join('');
        return `<div class="accion-client-group">
          <div class="accion-client-header">
            <span class="accion-client-name" onclick="window.openDetail(${cid})">
              <i class="fa-solid fa-building" style="opacity:.5;font-size:10px;margin-right:5px;"></i>${g.nombre}
            </span>
            <span class="accion-client-count">${g.acciones.length} acción${g.acciones.length!==1?'es':''}</span>
          </div>
          <div class="accion-rows">${rows}</div>
        </div>`;
      }).join('');
  }

  descEl?.focus();
};

window.midiaDeleteAccion = function(id) {
  deleteAccion(id);
  renderMiDia();
};

window.setMidiaFilter = function(key, value) {
  if (key === 'user') window.midiaFilterUser = value;
  if (key === 'date') window.midiaFilterDate = value;
  renderMiDia();
};

export { renderMiDia as default };
