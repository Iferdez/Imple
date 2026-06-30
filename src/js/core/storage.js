// ============================================================
// core/storage.js
// Wrapper único sobre localStorage. Centraliza serialización,
// manejo de errores de parseo, y el "broadcast" de cambios
// (clave *_sync) que usan otras pestañas para refrescarse.
// ============================================================

/**
 * Lee y parsea JSON de localStorage.
 * @param {string} key
 * @param {*} fallback valor a devolver si no existe o falla el parseo
 */
export function readJSON(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[storage] Error parseando "${key}", se usa fallback.`, e);
    return fallback;
  }
}

/**
 * Serializa y guarda en localStorage.
 * @param {string} key
 * @param {*} value
 */
export function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Marca una clave como "recién sincronizada" para que otras
 * pestañas abiertas (vía evento `storage`) sepan que deben
 * refrescar sus datos.
 * @param {string} key
 */
export function touchSync(key) {
  localStorage.setItem(`${key}_sync`, String(Date.now()));
}

/**
 * Atajo: guarda y notifica sync en un solo paso.
 */
export function writeJSONAndSync(key, value) {
  writeJSON(key, value);
  touchSync(key);
}
