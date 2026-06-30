// ============================================================
// core/crypto.js
// Hash de contraseñas (SHA-256 + salt) vía Web Crypto API.
// ============================================================

const SALT = 'crm_salt_2026';

/**
 * Genera el hash SHA-256 de una contraseña (con salt fijo de la app).
 * @param {string} plain
 * @returns {Promise<string>} hash hexadecimal de 64 caracteres
 */
export async function hashPassword(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain + SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compara una contraseña en texto plano contra un hash guardado.
 */
export async function checkPassword(plain, hashed) {
  return (await hashPassword(plain)) === hashed;
}

/**
 * Heurística: ¿este string ya es un hash SHA-256 (64 hex)?
 * Se usa para detectar contraseñas legacy en texto plano y
 * auto-actualizarlas al hashear en el primer login exitoso.
 */
export function isHashed(str) {
  return /^[0-9a-f]{64}$/.test(str);
}
