// ============================================================
// ui/detail/timeline.js
// Línea de tiempo unificada de la implementación de un cliente.
// Combina tres fuentes de eventos en orden cronológico descendente:
//   1. Cambios de etapa (historialEstados)
//   2. Acciones diarias registradas en "Mi Día" (acciones)
//   3. Tareas del equipo completadas (crm_tareas)
//
// Proporciona una vista completa de "qué pasó" durante la
// implementación, tanto para el líder como para el implementador.
// ============================================================

import { loadAcciones } from '../../data.js';
import { loadTareas } from '../../data.js';
import { formatDateAR } from '../../utils.js';
import { getTipoAccion } from '../../domain/constants.js';

// Agrupa eventos por fecha para mostrarlos en secciones del día
function groupByDate(events) {
  const groups = {};
  events.forEach(ev => {
    const dateStr = ev.timestamp.split('T')[0];
    if (!groups[dateStr]) groups[dateStr] = [];
    groups[dateStr].push(ev);
  });
  return groups;
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const todayStr = new Date().toISOString().split('T')[0];
  const yStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === todayStr) return 'Hoy';
  if (dateStr === yStr) return 'Ayer';
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// ── Event renderers ───────────────────────────────────────────────

function renderStateChangeEvent(ev) {
  const iconColor = '#8b5cf6';
  return `<div class="tl-event tl-event-state">
    <div class="tl-icon" style="background:${iconColor}22;color:${iconColor};">
      <i class="fa-solid fa-arrow-right-arrow-left"></i>
    </div>
    <div class="tl-body">
      <div class="tl-title">
        Cambio de etapa:
        ${ev.estadoAnterior
          ? `<span class="tl-tag tl-tag-muted">${ev.estadoAnterior || 'Sin estado'}</span>
             <i class="fa-solid fa-arrow-right" style="font-size:9px;opacity:.5;"></i>`
          : ''}
        <span class="tl-tag" style="background:${iconColor}22;color:${iconColor};border-color:${iconColor}44;">${ev.estadoNuevo}</span>
      </div>
      <div class="tl-meta">
        <span>${ev.usuario || '—'}</span>
        <span>${formatTime(ev.timestamp)}</span>
      </div>
    </div>
  </div>`;
}

function renderAccionEvent(ev) {
  const t = getTipoAccion(ev.tipo);
  return `<div class="tl-event tl-event-accion">
    <div class="tl-icon" style="background:${t.color}22;color:${t.color};">
      <i class="fa-solid ${t.icon}"></i>
    </div>
    <div class="tl-body">
      <div class="tl-title">${ev.descripcion}</div>
      <div class="tl-meta">
        <span class="tl-tag" style="background:${t.color}22;color:${t.color};border-color:${t.color}44;font-size:9px;">
          ${t.label}
        </span>
        <span>${ev.userId}</span>
        <span>${formatTime(ev.timestamp)}</span>
      </div>
    </div>
  </div>`;
}

function renderTareaEvent(ev) {
  const iconColor = '#10b981';
  return `<div class="tl-event tl-event-tarea">
    <div class="tl-icon" style="background:${iconColor}22;color:${iconColor};">
      <i class="fa-solid fa-circle-check"></i>
    </div>
    <div class="tl-body">
      <div class="tl-title">
        Tarea completada: <strong>${ev.titulo}</strong>
      </div>
      <div class="tl-meta">
        <span>${ev.asignado}</span>
        <span>${formatTime(ev.timestamp)}</span>
      </div>
    </div>
  </div>`;
}

function renderCreacionEvent(ev) {
  const iconColor = '#3b82f6';
  return `<div class="tl-event tl-event-creacion">
    <div class="tl-icon" style="background:${iconColor}22;color:${iconColor};">
      <i class="fa-solid fa-flag"></i>
    </div>
    <div class="tl-body">
      <div class="tl-title">Cliente registrado en el sistema</div>
      <div class="tl-meta">
        <span>${formatTime(ev.timestamp)}</span>
      </div>
    </div>
  </div>`;
}

// ── Main export ───────────────────────────────────────────────────

export function renderTimeline(client, currentUser) {
  const isLeader = currentUser && currentUser.role === 'lider';
  const allAcciones = loadAcciones();
  const allTareas   = loadTareas();

  // 1. Cambios de estado
  const stateEvents = (client.historialEstados || []).map(h => ({
    kind: 'state',
    timestamp: h.fecha,
    ...h
  }));

  // 2. Acciones del día para este cliente
  const accionEvents = allAcciones
    .filter(a => a.clientId === client.id)
    .map(a => ({ kind: 'accion', timestamp: a.timestamp, ...a }));

  // 3. Tareas completadas de este cliente
  const tareaEvents = allTareas
    .filter(t => t.clienteId === client.id && t.estado === 'completada')
    .map(t => ({ kind: 'tarea', timestamp: t.actualizadoEn, ...t }));

  // 4. Evento de creación del cliente (fecha arranque como proxy)
  const creacionEvents = client.arranque ? [{
    kind: 'creacion',
    timestamp: client.arranque + 'T00:00:00.000Z'
  }] : [];

  // Unificar y ordenar descendente
  const all = [...stateEvents, ...accionEvents, ...tareaEvents, ...creacionEvents]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (all.length === 0) {
    return `<div class="tl-empty">
      <i class="fa-solid fa-clock-rotate-left" style="font-size:28px;opacity:.2;display:block;margin-bottom:12px;"></i>
      <p>Todavía no hay actividad registrada para este cliente.</p>
      <p style="font-size:11px;opacity:.7;">Las acciones del día, cambios de etapa y tareas completadas aparecerán acá.</p>
    </div>`;
  }

  // Estadísticas rápidas
  const totalAcciones = accionEvents.length;
  const totalEstados  = stateEvents.length;
  const totalTareas   = tareaEvents.length;

  const statsHTML = `<div class="tl-stats">
    <span class="tl-stat"><i class="fa-solid fa-bolt"></i> ${totalAcciones} acción${totalAcciones !== 1 ? 'es' : ''}</span>
    <span class="tl-stat"><i class="fa-solid fa-arrow-right-arrow-left"></i> ${totalEstados} cambio${totalEstados !== 1 ? 's' : ''} de etapa</span>
    <span class="tl-stat"><i class="fa-solid fa-circle-check"></i> ${totalTareas} tarea${totalTareas !== 1 ? 's' : ''} completada${totalTareas !== 1 ? 's' : ''}</span>
  </div>`;

  // Agrupar por fecha
  const groups = groupByDate(all);
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  const eventsHTML = sortedDates.map(dateStr => {
    const dayEvents = groups[dateStr];
    const eventsHtml = dayEvents.map(ev => {
      if (ev.kind === 'state')    return renderStateChangeEvent(ev);
      if (ev.kind === 'accion')   return renderAccionEvent(ev);
      if (ev.kind === 'tarea')    return renderTareaEvent(ev);
      if (ev.kind === 'creacion') return renderCreacionEvent(ev);
      return '';
    }).join('');

    return `<div class="tl-day-group">
      <div class="tl-day-label">${formatDateLabel(dateStr)}</div>
      <div class="tl-day-events">${eventsHtml}</div>
    </div>`;
  }).join('');

  return `${statsHTML}<div class="tl-feed">${eventsHTML}</div>`;
}
