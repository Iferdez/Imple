// ============================================================
// ui/detail/sections.js
// Generadores de HTML para los bloques "extra" de la ficha de
// cliente: contactos, acciones diarias e historial de estados.
// Cada función es pura (recibe datos, devuelve un string HTML)
// y no toca el DOM directamente — quien las llama decide dónde
// insertar el resultado.
// ============================================================

import { loadAcciones } from '../../data.js';
import { TIPOS_ACCION, getTipoAccion } from '../../domain/constants.js';

function renderContactosHero(c, isLeader) {
  const cp = c.contactoPrincipal || {};
  const ce = c.contactoEncargado || {};
  const hasCp = cp.nombre || cp.cargo || cp.telefono || cp.email;
  const hasCe = ce.nombre || ce.cargo || ce.telefono || ce.email;
  if (!hasCp && !hasCe) return '';

  function contactCard(label, icon, contact) {
    if (!contact.nombre && !contact.cargo && !contact.telefono && !contact.email) return '';
    const telHtml = contact.telefono
      ? '<a href="tel:' + contact.telefono + '" style="color:inherit;text-decoration:none;" title="Llamar">'
        + '<i class="fa-solid fa-phone" style="font-size:10px;margin-right:4px;opacity:0.6;"></i>' + contact.telefono + '</a>'
      : '';
    const emailHtml = contact.email
      ? '<a href="mailto:' + contact.email + '" style="color:inherit;text-decoration:none;" title="Enviar email">'
        + '<i class="fa-solid fa-envelope" style="font-size:10px;margin-right:4px;opacity:0.6;"></i>' + contact.email + '</a>'
      : '';
    return '<div class="contact-card">'
      + '<div class="contact-card-label"><i class="fa-solid ' + icon + '" style="margin-right:6px;font-size:10px;opacity:0.7;"></i>' + label + '</div>'
      + '<div class="contact-card-name">' + (contact.nombre || '<span style="opacity:0.4;font-style:italic;">Sin nombre</span>') + '</div>'
      + (contact.cargo ? '<div class="contact-card-meta">' + contact.cargo + '</div>' : '')
      + (telHtml ? '<div class="contact-card-meta">' + telHtml + '</div>' : '')
      + (emailHtml ? '<div class="contact-card-meta">' + emailHtml + '</div>' : '')
      + '</div>';
  }

  return '<div class="contacts-hero-row">'
    + contactCard('Contacto Principal', 'fa-user-tie', cp)
    + contactCard('Encargado', 'fa-user-gear', ce)
    + '</div>';
}

function renderAccionesCliente(clientId, clientNombre, currentUser) {
  const isLeader = currentUser && (currentUser.role === 'lider');
  const allAcciones = loadAcciones();
  const acciones = allAcciones.filter(a => a.clientId === clientId);

  // Group by date
  const byDate = {};
  acciones.forEach(a => {
    const dateStr = a.timestamp.split('T')[0];
    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push(a);
  });

  const todayStr = new Date().toISOString().split('T')[0];

  function formatDateLabel(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (dateStr === todayStr) return 'Hoy';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Ayer';
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  const tiposHTML = TIPOS_ACCION.map(t =>
    '<button type="button" class="tipo-btn tipo-btn-sm" data-tipo="' + t.value + '" '
    + 'onclick="window.selectTipoAccionDetail(\'' + t.value + '\')" title="' + t.label + '">'
    + '<i class="fa-solid ' + t.icon + '"></i>'
    + '<span>' + t.label + '</span>'
    + '</button>'
  ).join('');

  const dateKeys = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  const groupsHTML = dateKeys.length === 0
    ? '<div class="midia-empty" style="padding:20px 0;"><p style="color:var(--text-muted);font-size:13px;">Sin acciones registradas para este cliente.</p></div>'
    : dateKeys.map(dateStr => {
        const rows = byDate[dateStr].map(a => {
          const t = getTipoAccion(a.tipo);
          const canDelete = a.userId === (currentUser ? currentUser.username : '') || isLeader;
          return '<div class="accion-row" id="accion-detail-' + a.id + '">'
            + '<div class="accion-row-left">'
            + '<span class="accion-tipo-icon" style="color:' + t.color + ';background:' + t.color + '18;" title="' + t.label + '">'
            + '<i class="fa-solid ' + t.icon + '"></i></span>'
            + '<div class="accion-row-body">'
            + '<div class="accion-desc">' + a.descripcion + '</div>'
            + '<div class="accion-meta">'
            + '<span class="accion-tipo-chip" style="background:' + t.color + '22;color:' + t.color + ';border:1px solid ' + t.color + '44;">'
            + '<i class="fa-solid ' + t.icon + '" style="font-size:10px;"></i> ' + t.label + '</span>'
            + '<span class="accion-time"><i class="fa-regular fa-clock" style="opacity:0.5;"></i> ' + formatTime(a.timestamp) + '</span>'
            + (isLeader ? '<span class="accion-user"><i class="fa-solid fa-user" style="opacity:0.5;font-size:9px;"></i> ' + a.userId + '</span>' : '')
            + '</div></div></div>'
            + (canDelete ? '<button class="accion-delete-btn" onclick="window.deleteAccionDetail(' + a.id + ')" title="Eliminar"><i class="fa-solid fa-xmark"></i></button>' : '')
            + '</div>';
        }).join('');

        return '<div class="accion-date-group">'
          + '<div class="accion-date-label">' + formatDateLabel(dateStr) + '</div>'
          + rows + '</div>';
      }).join('');

  return '<div class="section-header" style="margin-top:32px;">'
    + '<div class="section-title-wrap">'
    + '<span class="section-title"><i class="fa-solid fa-bolt" style="font-size:12px;margin-right:6px;opacity:0.7;"></i>Acciones</span>'
    + '<span class="section-count">' + acciones.length + '</span>'
    + '</div>'
    + '<button class="btn btn-secondary" onclick="window.toggleAccionFormDetail()" id="btn-add-accion" style="padding:5px 12px;font-size:12px;">'
    + '<i class="fa-solid fa-plus"></i><span>Nueva acción</span></button>'
    + '</div>'
    + '<div class="accion-form-inline" id="accion-form-inline" style="display:none;">'
    + '<select id="accion-detail-tipo-hidden" style="display:none;"></select>'
    + '<div class="tipo-btn-group" id="tipo-btn-group-detail" style="margin-bottom:10px;">' + tiposHTML + '</div>'
    + '<div style="display:flex;gap:8px;align-items:center;">'
    + '<input type="text" id="accion-detail-desc" class="edit-input" placeholder="Describí la acción realizada..." style="flex:1;" data-clientid="' + clientId + '" data-clientnombre="' + encodeURIComponent(clientNombre) + '">'
    + '<button class="btn btn-primary" id="accion-detail-save-btn" data-clientid="' + clientId + '" data-clientnombre="' + encodeURIComponent(clientNombre) + '" onclick="window.guardarAccionDetailFromBtn(this)" style="white-space:nowrap;"><i class="fa-solid fa-check"></i> Guardar</button>'
    + '<button class="btn btn-secondary" onclick="window.toggleAccionFormDetail()" style="white-space:nowrap;">Cancelar</button>'
    + '</div></div>'
    + '<div class="accion-list-inline">' + groupsHTML + '</div>';
}

function renderHistorialEstados(c) {
  const historial = c.historialEstados || [];
  if (historial.length === 0) return '';
  const rows = [...historial].reverse().map(h => {
    const d = new Date(h.fecha);
    const fechaStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const anterior = h.estadoAnterior
      ? h.estadoAnterior
      : '<span style="color:var(--text-muted);font-style:italic">Sin estado</span>';
    return '<tr>'
      + '<td style="color: var(--text-secondary);">' + anterior + '</td>'
      + '<td><strong>' + (h.estadoNuevo || 'Sin estado') + '</strong></td>'
      + '<td style="font-family: var(--font-mono); font-size: 12px;">' + fechaStr + ' ' + horaStr + '</td>'
      + '<td>' + (h.usuario || '—') + '</td>'
      + '</tr>';
  }).join('');
  return '<div class="section-header" style="margin-top: 32px;">'
    + '<div class="section-title-wrap">'
    + '<span class="section-title">Historial de Etapas</span>'
    + '<span class="section-count">' + historial.length + '</span>'
    + '</div></div>'
    + '<div class="tasks-table-wrap">'
    + '<table class="tasks-table"><thead><tr>'
    + '<th>Etapa anterior</th><th>Etapa nueva</th><th>Fecha y hora</th><th>Cambio realizado por</th>'
    + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

export { renderContactosHero, renderAccionesCliente, renderHistorialEstados };
