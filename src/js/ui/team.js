import { loadClients, loadUsers, saveUsers, hashPassword } from '../data.js';
import { getCurrentUser, setCurrentUser, canManageUser, applySession } from '../auth.js';
import { populateUsersDropdowns, renderTable } from './clients.js';
import { avatarClass, estadoBadge, shortName } from '../utils.js';
import { isOwnTeamMember } from '../domain/permissions.js';

export function renderTeam() {
  const clients   = loadClients();
  const users     = loadUsers();
  const me        = getCurrentUser();
  const container = document.getElementById('team-grid');
  if (!container) return;

  if (!me || me.role !== 'lider') {
    container.innerHTML = `<div style="padding:40px;color:var(--text-muted);text-align:center;font-size:14px;">
      <i class="fa-solid fa-lock" style="font-size:28px;margin-bottom:12px;display:block;opacity:0.3;"></i>
      Acceso restringido a líderes.
    </div>`;
    return;
  }

  const lideres = users.filter(u => u.role === 'lider');
  const impls   = users.filter(u => u.role === 'implementador');

  // ── Helpers ──────────────────────────────────────────────────────
  function clientCount(username) {
    return clients.filter(c => c.asignado === username || c.asignadoSecundario === username).length;
  }

  function clientsOf(username) {
    return clients.filter(c => c.asignado === username || c.asignadoSecundario === username);
  }

  function avatarHTML(u) {
    const initials = (u.displayName || u.username).slice(0, 2).toUpperCase();
    const cls = avatarClass(u.username);
    return `<div class="team-avatar-lg ${cls}">${initials}</div>`;
  }

  function roleBadge(u) {
    return u.role === 'lider'
      ? `<span class="badge badge-purple" style="font-size:9px;padding:2px 7px;">Líder</span>`
      : `<span class="badge badge-blue"   style="font-size:9px;padding:2px 7px;">Implementador</span>`;
  }

  function lideresTag(u) {
    if (u.role !== 'implementador' || !u.lideres?.length) return '';
    const names = u.lideres.map(lid => {
      const l = users.find(x => x.username === lid);
      return l ? (l.displayName || l.username) : lid;
    }).join(', ');
    return `<span style="font-size:10px;color:var(--text-muted);margin-top:2px;display:block;">
      <i class="fa-solid fa-sitemap" style="font-size:9px;margin-right:3px;"></i>Reporta a: ${names}
    </span>`;
  }

  function clientsList(username) {
    const mine = clientsOf(username);
    if (mine.length === 0) return `<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:14px;font-style:italic;">Sin clientes asignados</div>`;
    const rows = mine.slice(0, 6).map(c => {
      const isSec = c.asignadoSecundario === username && c.asignado !== username;
      return `<div class="team-client-item" onclick="window.openDetail(${c.id})">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${shortName(c.nombre)}${isSec ? ' <span style="opacity:0.5;font-size:9px;">(sec.)</span>' : ''}</span>
        ${estadoBadge(c.estado)}
      </div>`;
    }).join('');
    const more = mine.length > 6 ? `<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:6px;">+${mine.length - 6} más</div>` : '';
    return rows + more;
  }

  // ── Líderes checkboxes for edit panel ────────────────────────────
  function lideresCheckboxes(u) {
    return lideres.map(l => {
      const checked = Array.isArray(u.lideres) && u.lideres.includes(l.username);
      return `<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding:3px 0;">
        <input type="checkbox" class="lider-check-${u.username}" value="${l.username}" ${checked ? 'checked' : ''}
          style="width:14px;height:14px;accent-color:var(--primary);cursor:pointer;">
        ${l.displayName || l.username}
      </label>`;
    }).join('');
  }

  // ── Edit panel for implementador ─────────────────────────────────
  function editPanelImpl(u) {
    const isOwnTeam = isOwnTeamMember(me, u);
    const namePassHTML = isOwnTeam ? `
      <div class="team-edit-row">
        <div>
          <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:4px;">Nombre visible</label>
          <input type="text" class="team-edit-input" id="dname-${u.username}" value="${u.displayName || u.username}" placeholder="Nombre visible...">
        </div>
        <div>
          <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:4px;">Nueva contraseña <span style="opacity:.5;">(vacío = no cambiar)</span></label>
          <input type="password" class="team-edit-input" id="pass-${u.username}" placeholder="Nueva contraseña..." autocomplete="new-password">
        </div>
      </div>` : `<p style="font-size:11px;color:var(--text-muted);margin:0 0 4px;font-style:italic;">Nombre y contraseña solo los puede editar un líder de su equipo.</p>`;

    return `<div class="team-edit-creds">
      <div class="team-edit-title"><i class="fa-solid fa-sitemap"></i> Asignación de líderes</div>
      <div style="margin-bottom:10px;">
        <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:6px;">Reporta a (puede ser más de uno)</label>
        <div style="display:flex;flex-wrap:wrap;gap:4px 16px;">
          ${lideresCheckboxes(u)}
        </div>
      </div>
      ${namePassHTML}
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:4px;">
        <button type="button" class="team-edit-btn" onclick="window.saveUserCreds('${u.username}', false)">
          <i class="fa-solid fa-floppy-disk"></i> Guardar
        </button>
        <button type="button" class="team-promote-btn" onclick="window.promoteToLider('${u.username}')" title="Convertir en líder">
          <i class="fa-solid fa-arrow-up"></i> Promover a líder
        </button>
      </div>
    </div>`;
  }

  // ── Edit panel for lider (solo su propia contraseña) ─────────────
  function editPanelLider(u) {
    return `<div class="team-edit-creds">
      <div class="team-edit-title"><i class="fa-solid fa-lock"></i> Cambiar mi contraseña</div>
      <div class="team-edit-row single">
        <div>
          <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:4px;">Nueva contraseña</label>
          <input type="password" class="team-edit-input" id="pass-${u.username}" placeholder="Nueva contraseña..." autocomplete="new-password">
        </div>
      </div>
      <button type="button" class="team-edit-btn" onclick="window.saveUserCreds('${u.username}', true)">
        <i class="fa-solid fa-floppy-disk"></i> Guardar contraseña
      </button>
    </div>`;
  }

  // ── Card ─────────────────────────────────────────────────────────
  function card(u, editable, readonly) {
    const count = clientCount(u.username);
    const edit  = !editable ? '' : (u.role === 'lider' ? editPanelLider(u) : editPanelImpl(u));
    return `<div class="team-card${readonly ? ' team-card-readonly' : ''}">
      <div class="team-card-header">
        ${avatarHTML(u)}
        <div class="team-card-info">
          <div class="team-card-name">${u.displayName || u.username}</div>
          <div class="team-card-username">@${u.username}</div>
          <div class="team-card-badges">
            ${roleBadge(u)}
            ${lideresTag(u)}
          </div>
        </div>
        <div class="team-card-stat">
          <span class="team-stat-num">${count}</span>
          <span class="team-stat-label">cliente${count !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div class="team-clients-list">${clientsList(u.username)}</div>
      ${edit}
    </div>`;
  }

  // ── New líder form ───────────────────────────────────────────────
  const newLiderCard = `<div class="team-card team-card-new">
    <div class="team-new-form">
      <div class="team-new-form-title"><i class="fa-solid fa-crown"></i> Nuevo líder</div>
      <div class="team-edit-row">
        <div>
          <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:4px;">Usuario (login) *</label>
          <input type="text" class="team-edit-input" id="new-lider-username" placeholder="Ej: jperez">
        </div>
        <div>
          <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:4px;">Nombre visible</label>
          <input type="text" class="team-edit-input" id="new-lider-displayname" placeholder="Ej: Juan Pérez">
        </div>
      </div>
      <div class="team-edit-row single">
        <div>
          <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:4px;">Contraseña inicial *</label>
          <input type="password" class="team-edit-input" id="new-lider-password" placeholder="Contraseña..." autocomplete="new-password">
        </div>
      </div>
      <button type="button" class="team-edit-btn" onclick="window.createNewLider()">
        <i class="fa-solid fa-plus"></i> Crear líder
      </button>
    </div>
  </div>`;

  // ── New implementador form ────────────────────────────────────────
  const newLideresChecks = lideres.map(l =>
    `<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding:3px 0;">
      <input type="checkbox" class="new-lider-check" value="${l.username}" ${l.username === me.username ? 'checked' : ''}
        style="width:14px;height:14px;accent-color:var(--primary);cursor:pointer;">
      ${l.displayName || l.username}
    </label>`
  ).join('');

  const newCard = `<div class="team-card team-card-new">
    <div class="team-new-form">
      <div class="team-new-form-title"><i class="fa-solid fa-user-plus"></i> Nuevo implementador</div>
      <div class="team-edit-row">
        <div>
          <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:4px;">Usuario (login) *</label>
          <input type="text" class="team-edit-input" id="new-username" placeholder="Ej: maria">
        </div>
        <div>
          <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:4px;">Nombre visible</label>
          <input type="text" class="team-edit-input" id="new-displayname" placeholder="Ej: María González">
        </div>
      </div>
      <div class="team-edit-row single">
        <div>
          <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:4px;">Contraseña inicial *</label>
          <input type="password" class="team-edit-input" id="new-password" placeholder="Contraseña..." autocomplete="new-password">
        </div>
      </div>
      <div>
        <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:6px;">Reporta a (seleccioná uno o más)</label>
        <div style="display:flex;flex-wrap:wrap;gap:4px 16px;" id="new-lideres-checks">
          ${newLideresChecks}
        </div>
      </div>
      <button type="button" class="team-edit-btn" onclick="window.createNewUser()">
        <i class="fa-solid fa-plus"></i> Crear implementador
      </button>
    </div>
  </div>`;

  // ── Render ────────────────────────────────────────────────────────
  container.innerHTML = `
    <div class="team-section">
      <div class="team-section-label">
        <i class="fa-solid fa-crown"></i>
        Líderes
      </div>
      <div class="team-cards-grid">
        ${lideres.map(u => card(u, u.username === me.username, false)).join('')}
        ${newLiderCard}
      </div>
    </div>

    <div class="team-section">
      <div class="team-section-label">
        <i class="fa-solid fa-users"></i>
        Implementadores
        <span style="font-weight:400;opacity:0.6;">(${impls.length})</span>
      </div>
      <div class="team-cards-grid">
        ${impls.map(u => card(u, true, false)).join('')}
        ${newCard}
      </div>
    </div>
  `;
}

// ── Globals ─────────────────────────────────────────────────────────

window.saveUserCreds = async function(username, passwordOnly) {
  const users  = loadUsers();
  const me     = getCurrentUser();
  const target = users.find(u => u.username === username);
  if (!target) return;

  // Any lider can modify lider assignments on any implementador
  // Only own-team liders (or self) can change name/password
  if (!me || me.role !== 'lider') {
    window.showEmergentNotification?.('Sin permisos.', 'error');
    return;
  }
  const isOwnTeam = isOwnTeamMember(me, target);

  const newPass = document.getElementById('pass-' + username)?.value?.trim();

  if (!passwordOnly) {
    // Any lider can update lider assignments
    const checks = document.querySelectorAll(`.lider-check-${username}:checked`);
    const newLideres = Array.from(checks).map(cb => cb.value);
    if (newLideres.length === 0) {
      window.showEmergentNotification?.('Seleccioná al menos un líder.', 'error');
      return;
    }
    target.lideres = newLideres;

    // Only own-team lider can change display name
    if (isOwnTeam) {
      const newDname = document.getElementById('dname-' + username)?.value?.trim();
      if (newDname) target.displayName = newDname;
    }
  }

  if (newPass) {
    if (!isOwnTeam) {
      window.showEmergentNotification?.('Solo podés cambiar la contraseña de tu propio equipo.', 'error');
      return;
    }
    target.password = await hashPassword(newPass);
  } else if (passwordOnly) {
    window.showEmergentNotification?.('Ingresá una nueva contraseña.', 'error');
    return;
  }

  if (me.username === username) {
    setCurrentUser({ ...me, displayName: target.displayName, role: target.role });
    applySession();
  }

  saveUsers(users);
  window.showEmergentNotification?.(`Perfil de "${target.displayName || username}" guardado.`);
  renderTeam();
  window.renderAll?.();
};

window.createNewLider = async function() {
  const username    = document.getElementById('new-lider-username')?.value?.trim();
  const displayName = document.getElementById('new-lider-displayname')?.value?.trim();
  const password    = document.getElementById('new-lider-password')?.value?.trim();
  const me          = getCurrentUser();

  if (!me || me.role !== 'lider') {
    window.showEmergentNotification?.('Sin permisos.', 'error');
    return;
  }
  if (!username) { window.showEmergentNotification?.('Ingresá un nombre de usuario.', 'error'); return; }
  if (!password) { window.showEmergentNotification?.('Ingresá una contraseña inicial.', 'error'); return; }

  const users = loadUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    window.showEmergentNotification?.('Ya existe un usuario con ese nombre.', 'error'); return;
  }

  users.push({
    username,
    displayName: displayName || username,
    role: 'lider',
    password: await hashPassword(password),
    lideres: []
  });
  saveUsers(users);
  window.showEmergentNotification?.(`Líder "${displayName || username}" creado.`);
  renderTeam();
  populateUsersDropdowns();
  renderTable();
};

/**
 * Convierte un implementador en líder. Pierde el array `lideres`
 * (ya no reporta a nadie) y gana acceso completo a Equipo.
 * Cualquier líder puede hacer esta promoción — es una decisión
 * organizacional, igual que la asignación de líderes.
 */
window.promoteToLider = async function(username) {
  const me = getCurrentUser();
  if (!me || me.role !== 'lider') {
    window.showEmergentNotification?.('Sin permisos.', 'error');
    return;
  }

  const users  = loadUsers();
  const target = users.find(u => u.username === username);
  if (!target || target.role !== 'implementador') return;

  if (!confirm(`¿Convertir a "${target.displayName || username}" en líder? Dejará de reportar a otros líderes y va a poder administrar todo el equipo.`)) {
    return;
  }

  target.role = 'lider';
  target.lideres = [];
  saveUsers(users);

  window.showEmergentNotification?.(`"${target.displayName || username}" ahora es líder.`);
  renderTeam();
  window.renderAll?.();
};

window.createNewUser = async function() {
  const username    = document.getElementById('new-username')?.value?.trim();
  const displayName = document.getElementById('new-displayname')?.value?.trim();
  const password    = document.getElementById('new-password')?.value?.trim();
  const me          = getCurrentUser();

  // Read multi-lider checkboxes
  const checks = document.querySelectorAll('.new-lider-check:checked');
  const lideres = Array.from(checks).map(cb => cb.value);

  if (!username) { window.showEmergentNotification?.('Ingresá un nombre de usuario.', 'error'); return; }
  if (!password) { window.showEmergentNotification?.('Ingresá una contraseña inicial.', 'error'); return; }
  if (lideres.length === 0) { window.showEmergentNotification?.('Seleccioná al menos un líder.', 'error'); return; }

  const users = loadUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    window.showEmergentNotification?.('Ya existe un usuario con ese nombre.', 'error'); return;
  }

  users.push({
    username,
    displayName: displayName || username,
    role: 'implementador',
    password: await hashPassword(password),
    lideres
  });
  saveUsers(users);
  window.showEmergentNotification?.(`Implementador "${displayName || username}" creado.`);
  renderTeam();
  populateUsersDropdowns();
  renderTable();
};
