// Always use real today, never hardcoded
export function getToday() {
  return new Date();
}

export function daysRemaining(arranque) {
  if (!arranque) return null;
  const d = new Date(arranque);
  const today = getToday();
  const dateStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffTime = dateEnd - dateStart;
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function shortName(nombre) {
  if (!nombre) return '';
  return nombre.length > 32 ? nombre.slice(0, 32) + '…' : nombre;
}

export function estadoBadge(estado) {
  const map = {
    'Iniciado': 'badge-green',
    'Capacitacion': 'badge-blue',
    'Armado de Base': 'badge-purple',
    'Solicitar Info': 'badge-yellow',
    'Instalacion': 'badge-gray',
  };
  if (!estado) return '<span class="badge badge-gray"><i class="fa-solid fa-circle-question"></i> Sin estado</span>';
  
  const icons = {
    'Iniciado': '<i class="fa-solid fa-circle-check"></i>',
    'Capacitacion': '<i class="fa-solid fa-chalkboard-user"></i>',
    'Armado de Base': '<i class="fa-solid fa-database"></i>',
    'Solicitar Info': '<i class="fa-solid fa-circle-info"></i>',
    'Instalacion': '<i class="fa-solid fa-wrench"></i>',
  };
  
  const icon = icons[estado] || '<i class="fa-solid fa-play"></i>';
  const cls = map[estado] || 'badge-gray';
  
  return `<span class="badge ${cls}">${icon} ${estado}</span>`;
}

export function tipoBadge(tipo) {
  if (!tipo) return '';
  return `<span class="badge badge-gray">${tipo}</span>`;
}

// Paleta fija de colores para avatares. La asignación es
// determinística (hash del username) en vez de una lista de
// nombres hardcodeada, así cualquier usuario nuevo creado desde
// Equipo recibe automáticamente un color distintivo en vez de
// caer siempre en gris.
//
// AVATAR_HEX_PALETTE es la misma paleta en valores hex, para los
// pocos lugares (ej: encabezados de columna en Kanban) que no
// pueden usar una clase CSS y necesitan el color crudo.
export const AVATAR_HEX_PALETTE = {
  'av-blue':   { color: '#1e40af', bg: '#dbeafe' },
  'av-pink':   { color: '#9d174d', bg: '#fce7f3' },
  'av-green':  { color: '#065f46', bg: '#d1fae5' },
  'av-amber':  { color: '#92400e', bg: '#fef3c7' },
  'av-purple': { color: '#5b21b6', bg: '#ede9fe' },
  'av-red':    { color: '#991b1b', bg: '#fee2e2' },
  'av-teal':   { color: '#115e59', bg: '#ccfbf1' },
  'av-indigo': { color: '#3730a3', bg: '#e0e7ff' },
  'av-default':{ color: '#475569', bg: '#f1f5f9' },
};

const AVATAR_PALETTE = Object.keys(AVATAR_HEX_PALETTE).filter(k => k !== 'av-default');

export function avatarClass(nombre) {
  if (!nombre) return 'av-default';
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = (hash * 31 + nombre.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function avatarEl(nombre) {
  if (!nombre) return '';
  const initials = nombre.slice(0, 2).toUpperCase();
  const cls = avatarClass(nombre);
  return `<span class="avatar ${cls}" title="${nombre}">${initials}</span>`;
}

export function daysBadge(days) {
  if (days === null) return '<span class="days-badge days-none">—</span>';
  const cls = days > 14 ? 'days-ok' : days >= 0 ? 'days-warn' : 'days-late';
  const label = days >= 0 ? `+${days}d` : `${days}d`;
  const icon = days >= 0 ? '<i class="fa-solid fa-calendar-check" style="font-size:10px"></i>' : '<i class="fa-solid fa-circle-exclamation" style="font-size:10px"></i>';
  return `<span class="days-badge ${cls}">${icon} ${label}</span>`;
}

export function formatTaskDate(dateStr) {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

/**
 * Formatea una fecha YYYY-MM-DD a DD/MM/YYYY (formato argentino,
 * con año completo). Hermana de formatTaskDate, que omite el año.
 */
export function formatDateAR(dateStr) {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function taskStartDate(task) {
  return task?.fechaDesde || task?.startDate || task?.date || '';
}

export function taskEndDate(task) {
  return task?.fechaHasta || task?.endDate || taskStartDate(task);
}

export function taskRangeLabel(task) {
  const from = taskStartDate(task);
  const to = taskEndDate(task);
  if (!from && !to) return '—';
  if (!to || from === to) return formatTaskDate(from);
  return `${formatTaskDate(from)} - ${formatTaskDate(to)}`;
}

export function taskOccursOnDate(task, dateStr) {
  const from = taskStartDate(task);
  const to = taskEndDate(task);
  return Boolean(from && dateStr >= from && dateStr <= to);
}

export function taskOverlapsMonth(task, year, month) {
  const from = taskStartDate(task);
  const to = taskEndDate(task);
  if (!from) return false;
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return from <= monthEnd && to >= monthStart;
}

export function taskType(task) {
  return task?.tipo || task?.type || 'pedido';
}

export function taskTypeLabel(type) {
  const labels = {
    capacitacion: 'Capacitación',
    pedido: 'Pedido',
    configuracion: 'Configuración',
    visita: 'Visita'
  };
  return labels[type] || labels.pedido;
}

export function taskTypeIcon(type) {
  const icons = {
    capacitacion: 'fa-chalkboard-user',
    pedido: 'fa-clipboard-list',
    configuracion: 'fa-sliders',
    visita: 'fa-location-dot'
  };
  return icons[type] || icons.pedido;
}

export function taskTypeBadge(task) {
  const type = taskType(task);
  return `<span class="task-type-badge task-type-${type}"><i class="fa-solid ${taskTypeIcon(type)}"></i> ${taskTypeLabel(type)}</span>`;
}
