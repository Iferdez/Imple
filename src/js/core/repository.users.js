// ============================================================
// core/repository.users.js
// Acceso a la "tabla" de usuarios en localStorage.
// Incluye la migración automática de versiones viejas del
// modelo de datos (administrador→lider, lider string→array).
// ============================================================

import { readJSON, writeJSON } from './storage.js';
import { INITIAL_USERS } from '../domain/seed-data.js';

const KEY = 'crm_users';

/**
 * Normaliza un usuario al esquema actual, mutando el objeto.
 * Devuelve true si tuvo que cambiar algo (para saber si hay
 * que persistir la migración).
 */
function migrateUser(u) {
  let changed = false;

  // Rol legacy 'administrador' (single-admin) → 'lider'
  if (u.role === 'administrador') {
    u.role = 'lider';
    changed = true;
  }

  if (u.displayName === undefined) {
    u.displayName = u.username;
    changed = true;
  }

  // Campo legacy `lider` (string único) → `lideres` (array)
  if (u.lideres === undefined) {
    u.lideres = u.lider ? [u.lider] : [];
    delete u.lider;
    changed = true;
  } else if (!Array.isArray(u.lideres)) {
    u.lideres = u.lider ? [u.lider] : [];
    delete u.lider;
    changed = true;
  } else if ('lider' in u) {
    // lideres ya es array pero quedó el campo viejo colgado
    delete u.lider;
    changed = true;
  }

  return changed;
}

/**
 * Carga todos los usuarios, aplicando migraciones si hace falta.
 * Si no hay nada en localStorage todavía, siembra con INITIAL_USERS.
 */
export function loadUsers() {
  let users = readJSON(KEY, null);

  if (!users) {
    users = JSON.parse(JSON.stringify(INITIAL_USERS));
    writeJSON(KEY, users);
    return users;
  }

  let migrated = false;
  users.forEach(u => {
    if (migrateUser(u)) migrated = true;
  });

  // Garantía mínima: siempre debe existir al menos un líder.
  if (!users.some(u => u.role === 'lider') && users.length > 0) {
    users[0].role = 'lider';
    migrated = true;
  }

  if (migrated) writeJSON(KEY, users);
  return users;
}

export function saveUsers(users) {
  writeJSON(KEY, users);
}
