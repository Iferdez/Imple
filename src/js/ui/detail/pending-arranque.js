// ============================================================
// ui/detail/pending-arranque.js
// Flujo de "solicitud de cambio de fecha de arranque": un
// implementador pide cambiar la fecha, un líder la aprueba o
// rechaza. Se puede resolver desde la ficha del cliente o
// directamente desde el Dashboard — antes esa lógica estaba
// duplicada en dos funciones casi idénticas; acá vive una sola
// vez (`resolvePendingArranque`) y ambos puntos de entrada la usan.
// ============================================================

import { loadClients, saveClients, addActivity } from '../../data.js';
import { getCurrentUser } from '../../auth.js';

function formatDateAR(isoDate) {
  const parts = (isoDate || '').split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : '—';
}

function notify(message, type) {
  if (window.showEmergentNotification) window.showEmergentNotification(message, type);
  else alert(message);
}

/**
 * Guarda una solicitud de nueva fecha de arranque sobre un cliente.
 */
export function requestArranqueChange(clientId, newDate) {
  if (!newDate) {
    notify('Por favor selecciona una fecha válida.', 'warning');
    return false;
  }

  const clients = loadClients();
  const client = clients.find(c => c.id === clientId);
  if (!client) return false;

  client.pendingArranque = newDate;
  saveClients(clients);

  const user = getCurrentUser();
  if (user) {
    addActivity(user.username, client.id, client.nombre, 'date_request',
      `Solicitó cambio de fecha de arranque a: ${formatDateAR(newDate)}`);
  }

  notify('Se realizó la solicitud de cambio de fecha.');
  window.renderAll?.();
  return true;
}

/**
 * Aprueba o rechaza la solicitud de fecha pendiente de un cliente.
 * Punto único usado tanto desde la ficha de cliente como desde
 * el Dashboard.
 */
export function resolvePendingArranque(clientId, approved) {
  const clients = loadClients();
  const client = clients.find(c => c.id === clientId);
  if (!client) return null;

  const requestedDate = client.pendingArranque;

  if (approved) {
    client.arranque = requestedDate;
    notify(`Se realizó el cambio de fecha de arranque para ${client.nombre} a ${requestedDate}.`);
  } else {
    notify(`Se rechazó la solicitud de fecha para ${client.nombre}.`, 'warning');
  }

  delete client.pendingArranque;
  saveClients(clients);

  const user = getCurrentUser();
  if (user) {
    const desc = approved
      ? `Autorizó la fecha de arranque a: ${formatDateAR(requestedDate)}`
      : `Rechazó la solicitud de fecha de arranque: ${formatDateAR(requestedDate)}`;
    addActivity(user.username, client.id, client.nombre, 'date_resolve', desc);
  }

  window.renderAll?.();
  return client;
}

/**
 * Cancela (sin resolver) una solicitud pendiente, sin registrar
 * actividad — es una corrección, no una decisión de líder.
 */
export function cancelPendingArranque(clientId) {
  const clients = loadClients();
  const client = clients.find(c => c.id === clientId);
  if (!client) return null;

  delete client.pendingArranque;
  saveClients(clients);
  window.renderAll?.();
  return client;
}

// ── Bindings globales usados desde el HTML inline ──────────────────
// La ficha de cliente trabaja siempre sobre `activeClientId` (la
// ficha actualmente abierta); el Dashboard pasa el id explícito.

export function bindArranqueGlobals(getActiveClientId, onAfterChange) {
  window.showRequestArranqueInput = function () {
    const btn = document.getElementById('btn-request-arranque');
    const wrapper = document.getElementById('request-arranque-wrapper');
    if (btn) btn.style.display = 'none';
    if (wrapper) wrapper.style.display = 'inline-flex';
  };

  window.hideRequestArranqueInput = function () {
    const btn = document.getElementById('btn-request-arranque');
    const wrapper = document.getElementById('request-arranque-wrapper');
    if (btn) btn.style.display = 'inline-flex';
    if (wrapper) wrapper.style.display = 'none';
  };

  window.submitRequestArranque = function () {
    const dateInput = document.getElementById('request-arranque-date');
    const newDate = dateInput ? dateInput.value : '';
    const clientId = getActiveClientId();
    if (!clientId) return;
    if (requestArranqueChange(clientId, newDate)) {
      onAfterChange(clientId);
    }
  };

  window.resolvePendingArranque = function (approved) {
    const clientId = getActiveClientId();
    if (!clientId) return;
    resolvePendingArranque(clientId, approved);
    onAfterChange(clientId);
  };

  window.cancelPendingArranque = function () {
    if (!confirm('¿Cancelar la solicitud de cambio de fecha?')) return;
    const clientId = getActiveClientId();
    if (!clientId) return;
    cancelPendingArranque(clientId);
    onAfterChange(clientId);
  };

  // Resolución directa desde el Dashboard (sin pasar por la ficha)
  window.resolveDashboardPendingArranque = function (clientId, approved) {
    resolvePendingArranque(clientId, approved);
  };
}
