// ============================================================
// core/repository.clients.js
// Acceso a la "tabla" de clientes/implementaciones en
// localStorage. Incluye migración de campos agregados en
// versiones recientes del modelo.
// ============================================================

import { readJSON, writeJSON } from './storage.js';
import { INITIAL_CLIENTS } from '../domain/seed-data.js';

const KEY = 'crm_clients';

function emptyContact() {
  return { nombre: '', cargo: '', telefono: '', email: '' };
}

/**
 * Agrega campos que no existían en versiones anteriores del
 * modelo, mutando el cliente. Devuelve true si cambió algo.
 */
function migrateClient(c) {
  let changed = false;

  if (c.notasInternas === undefined)      { c.notasInternas = ''; changed = true; }
  if (c.particularidades === undefined)   { c.particularidades = ''; changed = true; }
  if (!Array.isArray(c.historialEstados)) { c.historialEstados = []; changed = true; }
  if (!Array.isArray(c.tasks))            { c.tasks = []; changed = true; }
  if (c.contactoPrincipal === undefined)  { c.contactoPrincipal = emptyContact(); changed = true; }
  if (c.contactoEncargado === undefined)  { c.contactoEncargado = emptyContact(); changed = true; }

  return changed;
}

/**
 * Carga todos los clientes, aplicando migraciones si hace falta.
 * Si no hay nada en localStorage todavía, siembra con INITIAL_CLIENTS.
 */
export function loadClients() {
  let clients = readJSON(KEY, null);

  if (!clients) {
    clients = JSON.parse(JSON.stringify(INITIAL_CLIENTS));
    writeJSON(KEY, clients);
    return clients;
  }

  let migrated = false;
  clients.forEach(c => {
    if (migrateClient(c)) migrated = true;
  });

  if (migrated) writeJSON(KEY, clients);
  return clients;
}

export function saveClients(clients) {
  writeJSON(KEY, clients);
}

/**
 * Registra un cambio de estado en el historial del cliente.
 * No persiste por sí sola — quien llama es responsable de
 * hacer saveClients() después.
 */
export function recordStateChange(client, newEstado, username) {
  if (!Array.isArray(client.historialEstados)) client.historialEstados = [];
  if (client.estado === newEstado) return; // sin cambio real, no registrar

  client.historialEstados.push({
    estadoAnterior: client.estado || '',
    estadoNuevo: newEstado,
    fecha: new Date().toISOString(),
    usuario: username || ''
  });
}
