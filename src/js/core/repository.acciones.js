// ============================================================
// core/repository.acciones.js
// Acceso a las "acciones diarias" registradas en Mi Día y en
// la ficha de cliente. Se cap a 1000 registros más recientes
// para no inflar localStorage indefinidamente.
// ============================================================

import { readJSON, writeJSONAndSync } from './storage.js';

const KEY = 'crm_acciones';
const MAX_ACCIONES = 1000;

export function loadAcciones() {
  return readJSON(KEY, []);
}

export function saveAcciones(acciones) {
  writeJSONAndSync(KEY, acciones);
}

/**
 * Crea y persiste una nueva acción diaria.
 * @param {string} userId       quién la registró
 * @param {number} clientId     cliente al que pertenece
 * @param {string} clientNombre nombre del cliente (denormalizado para listados rápidos)
 * @param {string} tipo         uno de los TIPOS_ACCION (ver domain/constants.js)
 * @param {string} descripcion  texto libre de qué se hizo
 * @returns {object} la acción recién creada
 */
export function addAccion(userId, clientId, clientNombre, tipo, descripcion) {
  const acciones = loadAcciones();
  const nueva = {
    id: Date.now() + Math.random(),
    timestamp: new Date().toISOString(),
    userId,
    clientId,
    clientNombre,
    tipo,
    descripcion
  };
  acciones.unshift(nueva);
  saveAcciones(acciones.slice(0, MAX_ACCIONES));
  return nueva;
}

export function deleteAccion(id) {
  const acciones = loadAcciones();
  saveAcciones(acciones.filter(a => a.id !== id));
}
