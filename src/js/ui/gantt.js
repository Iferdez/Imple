import { loadClients } from '../data.js';
import { formatTaskDate, taskRangeLabel, taskStartDate, taskEndDate, taskType, taskTypeIcon, taskTypeLabel } from '../utils.js';

function dateFromIso(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isoFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function daysBetween(startIso, endIso) {
  return Math.round((dateFromIso(endIso) - dateFromIso(startIso)) / (1000 * 60 * 60 * 24));
}

function clientShareUrl(clientId) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('gantt', clientId);
  return url.toString();
}

export function getClientGanttUrl(clientId) {
  return clientShareUrl(clientId);
}

export function renderClientGantt(c, options = {}) {
  const scheduledTasks = (c.tasks || [])
    .map((task, idx) => ({ task, idx, start: taskStartDate(task), end: taskEndDate(task) }))
    .filter(item => item.start);

  if (scheduledTasks.length === 0) {
    return `
      <section class="client-gantt-card ${options.public ? 'public-gantt-card' : ''}">
        <div class="section-header gantt-section-header">
          <div class="section-title-wrap">
            <span class="section-title">Gantt</span>
            <span class="section-count">0</span>
          </div>
        </div>
        <div class="gantt-empty">
          <i class="fa-solid fa-chart-gantt"></i>
          <span>Todavía no hay tareas con fecha desde y hasta.</span>
        </div>
      </section>
    `;
  }

  const starts = scheduledTasks.map(item => item.start);
  const ends = scheduledTasks.map(item => item.end || item.start);
  const minStart = starts.reduce((min, value) => value < min ? value : min, starts[0]);
  const maxEnd = ends.reduce((max, value) => value > max ? value : max, ends[0]);
  const timelineStart = isoFromDate(addDays(dateFromIso(minStart), -1));
  const timelineEnd = isoFromDate(addDays(dateFromIso(maxEnd), 1));
  const totalDays = daysBetween(timelineStart, timelineEnd) + 1;
  const days = Array.from({ length: totalDays }, (_, i) => {
    const date = addDays(dateFromIso(timelineStart), i);
    const iso = isoFromDate(date);
    return { iso, day: date.getDate(), month: date.toLocaleDateString('es-AR', { month: 'short' }) };
  });

  const sortedTasks = scheduledTasks.sort((a, b) => {
    if (a.start !== b.start) return a.start.localeCompare(b.start);
    return (a.end || a.start).localeCompare(b.end || b.start);
  });

  const dayHeaders = days.map((d, i) => `
    <div class="gantt-day ${d.iso === c.arranque ? 'gantt-day-kickoff' : ''}" style="grid-column:${i + 1}">
      <span>${d.day}</span>
      <small>${d.month}</small>
    </div>
  `).join('');

  const rows = sortedTasks.map(({ task, start, end }) => {
    const type = taskType(task);
    const barStart = daysBetween(timelineStart, start) + 1;
    const barSpan = Math.max(1, daysBetween(start, end || start) + 1);
    return `
      <div class="gantt-row">
        <div class="gantt-row-label">
          <span class="gantt-row-type task-type-${type}" title="${taskTypeLabel(type)}">
            <i class="fa-solid ${taskTypeIcon(type)}"></i>
          </span>
          <div class="gantt-row-text">
            <strong>${task.desc || 'Sin detalle'}</strong>
            <span>${taskRangeLabel(task)}${task.asignado ? ` · ${task.asignado}` : ''}</span>
          </div>
        </div>
        <div class="gantt-row-track" style="--gantt-days:${totalDays}; grid-template-columns: repeat(${totalDays}, minmax(38px, 1fr));">
          <div class="gantt-bar gantt-bar-${type}" style="grid-column:${barStart} / span ${barSpan};" title="${taskTypeLabel(type)} · ${taskRangeLabel(task)}">
            <span>${taskTypeLabel(type)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <section class="client-gantt-card ${options.public ? 'public-gantt-card' : ''}">
      <div class="section-header gantt-section-header">
        <div class="section-title-wrap">
          <span class="section-title">Gantt</span>
          <span class="section-count">${scheduledTasks.length}</span>
        </div>
        <div class="gantt-legend">
          <span><i class="legend-dot legend-pedido"></i> Pedido</span>
          <span><i class="legend-dot legend-capacitacion"></i> Capacitación</span>
          <span><i class="legend-dot legend-configuracion"></i> Configuración</span>
        </div>
      </div>
      <div class="gantt-scroll">
        <div class="gantt-header">
          <div class="gantt-label-spacer"></div>
          <div class="gantt-days" style="grid-template-columns: repeat(${totalDays}, minmax(38px, 1fr));">${dayHeaders}</div>
        </div>
        <div class="gantt-rows">${rows}</div>
      </div>
    </section>
  `;
}

export function renderPublicGanttPage() {
  const params = new URLSearchParams(window.location.search);
  const clientId = Number(params.get('gantt'));
  const page = document.getElementById('page-gantt-public');
  if (!clientId || !page) return false;

  const client = loadClients().find(c => c.id === clientId);
  document.body.classList.add('public-gantt-mode');
  document.getElementById('login-screen')?.classList.add('hidden');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  page.classList.add('active');

  if (!client) {
    page.innerHTML = `
      <div class="public-gantt-shell">
        <div class="public-gantt-header">
          <h1>Gantt no encontrado</h1>
          <p>El enlace no corresponde a un cliente disponible en este navegador.</p>
        </div>
      </div>
    `;
    return true;
  }

  const arranque = client.arranque ? formatTaskDate(client.arranque) : 'Sin fecha';
  page.innerHTML = `
    <div class="public-gantt-shell">
      <div class="public-gantt-header">
        <div>
          <span class="public-gantt-kicker">Cronograma de implementación</span>
          <h1>${client.nombre}</h1>
          <p>${client.tipo || 'Cliente'} · Arranque: ${arranque}</p>
        </div>
      </div>
      ${renderClientGantt(client, { public: true })}
    </div>
  `;
  return true;
}
