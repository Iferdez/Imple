// ============================================================
// auth.js
// Maneja la sesión del usuario actual (login/logout, quién está
// logueado) y la aplica visualmente a la pantalla. Las reglas de
// QUIÉN puede ver/editar QUÉ viven en domain/permissions.js —
// este archivo solo las usa, no las define.
// ============================================================

import { loadUsers, saveUsers } from './core/repository.users.js';
import { isHashed, hashPassword } from './core/crypto.js';
import { filterVisibleClients, canManageUser, isLider } from './domain/permissions.js';

let currentUser = null;

// ── Sesión ───────────────────────────────────────────────────────

export function getCurrentUser() {
  if (currentUser) return currentUser;
  try {
    const saved = sessionStorage.getItem('crm_session');
    if (saved) {
      currentUser = JSON.parse(saved);
      return currentUser;
    }
  } catch (e) {
    currentUser = null;
  }
  return null;
}

export function setCurrentUser(user) {
  currentUser = user;
  if (user) sessionStorage.setItem('crm_session', JSON.stringify(user));
  else sessionStorage.removeItem('crm_session');
}

/**
 * Intenta loguear con usuario/contraseña.
 * Soporta contraseñas legacy en texto plano: si el login es
 * exitoso con una contraseña sin hashear, la actualiza al hash
 * automáticamente (auto-upgrade transparente para el usuario).
 */
export async function login(username, password) {
  const users = loadUsers();
  const found = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!found) return { success: false, message: 'Usuario no registrado.' };

  let match;
  if (isHashed(found.password)) {
    match = (await hashPassword(password)) === found.password;
  } else {
    match = found.password === password;
    if (match) {
      found.password = await hashPassword(password); // auto-upgrade
      saveUsers(users);
    }
  }
  if (!match) return { success: false, message: 'Contraseña incorrecta.' };

  const session = {
    username: found.username,
    displayName: found.displayName || found.username,
    role: found.role,
    lideres: found.lideres || []
  };
  setCurrentUser(session);
  return { success: true, user: session };
}

export function logout() {
  setCurrentUser(null);
  sessionStorage.removeItem('crm_notified_requests');
}

// ── Permisos (delegados a domain/permissions.js) ───────────────────
// Se re-exportan acá para que el resto del código pueda seguir
// importando `getVisibleClients` / `canManageUser` desde auth.js,
// que es donde naturalmente se los busca al hablar de "qué puede
// ver/hacer el usuario logueado".

export { isLider, canManageUser };

/**
 * Filtra un array de clientes a los visibles para el usuario
 * actualmente logueado.
 */
export function getVisibleClients(clients) {
  const user = getCurrentUser();
  if (!user) return [];
  const users = loadUsers();
  return filterVisibleClients(user, clients, users);
}

// ── Aplicación de sesión al DOM ─────────────────────────────────────

/**
 * Sincroniza la pantalla con el estado de sesión actual:
 * muestra/oculta el login, pinta el avatar y nombre del usuario,
 * y ajusta qué elementos "leader-only" son visibles.
 * Devuelve true si hay sesión activa, false si hay que mostrar login.
 */
export function applySession() {
  const user = getCurrentUser();
  const loginScreen = document.getElementById('login-screen');

  if (user) {
    // Validar que el usuario todavía existe y está al día con la DB
    const users = loadUsers();
    const dbUser = users.find(u => u.username.toLowerCase() === user.username.toLowerCase());
    if (!dbUser) {
      setCurrentUser(null);
      location.reload();
      return false;
    }
    if (dbUser.role !== user.role) {
      user.role = dbUser.role;
      setCurrentUser(user);
    }
    if (dbUser.displayName !== user.displayName) {
      user.displayName = dbUser.displayName;
      setCurrentUser(user);
    }
  }

  if (!user) {
    loginScreen.classList.remove('hidden');
    document.body.classList.remove('role-lider', 'role-implementador');
    return false;
  }

  loginScreen.classList.add('hidden');
  document.body.classList.remove('role-lider', 'role-implementador');
  document.body.classList.add(`role-${user.role}`);

  paintUserBadge(user);
  toggleLeaderOnlyElements(user);
  syncAsignadoFilter(user);

  return true;
}

function paintUserBadge(user) {
  const avatarEl = document.getElementById('user-avatar');
  const nameLabel = document.getElementById('user-name-label');
  const roleLabel = document.getElementById('user-role-label');

  const initials = (user.displayName || user.username).slice(0, 2).toUpperCase();
  avatarEl.textContent = initials;
  nameLabel.textContent = user.displayName || user.username;
  roleLabel.textContent = isLider(user) ? 'Líder' : 'Implementador';
}

function toggleLeaderOnlyElements(user) {
  document.querySelectorAll('.leader-only').forEach(el => {
    el.style.display = isLider(user) ? '' : 'none';
  });
}

function syncAsignadoFilter(user) {
  const filterAsignadoEl = document.getElementById('filter-asignado');
  if (!filterAsignadoEl) return;

  if (!isLider(user)) {
    filterAsignadoEl.value = user.username;
    filterAsignadoEl.disabled = true;
    filterAsignadoEl.style.opacity = '0.6';
  } else {
    if (filterAsignadoEl.disabled) filterAsignadoEl.value = '';
    filterAsignadoEl.disabled = false;
    filterAsignadoEl.style.opacity = '';
  }
}
