// ============================================================
// core/repository.activities.js
// Acceso al "log de actividad" que alimenta la página de
// Notificaciones. Distinto de `acciones`: este es un registro
// automático de cambios (editClientField, cambios de estado,
// etc.), no algo que el implementador carga a mano.
// ============================================================

import { readJSON, writeJSONAndSync } from './storage.js';

const KEY = 'crm_activities';
const MAX_ACTIVITIES = 200;

export function loadActivities() {
  return readJSON(KEY, []);
}

export function saveActivities(activities) {
  writeJSONAndSync(KEY, activities);
}

/**
 * Registra una entrada en el log de actividad.
 * @param {string} userId        quién hizo el cambio
 * @param {number} clientId      cliente afectado
 * @param {string} clientNombre  nombre del cliente (denormalizado)
 * @param {string} actionType    categoría libre (ej: 'client_edit')
 * @param {string} description   texto legible de qué pasó
 */
export function addActivity(userId, clientId, clientNombre, actionType, description) {
  const activities = loadActivities();
  const entry = {
    id: Date.now() + Math.random(),
    timestamp: new Date().toISOString(),
    userId,
    clientId,
    clientNombre,
    actionType,
    description
  };
  activities.unshift(entry);
  saveActivities(activities.slice(0, MAX_ACTIVITIES));
}
