import { loadClients, saveClients, addActivity } from '../data.js';
import { getVisibleClients, getCurrentUser } from '../auth.js';
import { daysRemaining, shortName, estadoBadge, daysBadge, formatDateAR } from '../utils.js';

export function renderDashboard() {
  const allClients = loadClients();
  let vc = getVisibleClients(allClients);
  
  const showSupport = localStorage.getItem('crm_show_support') === 'true';
  const checkbox = document.getElementById('show-support-checkbox');
  if (checkbox) {
    checkbox.checked = showSupport;
  }

  // Filter out clients that have transitioned to support if showSupport is false
  if (!showSupport) {
    vc = vc.filter(c => !(c.estado === 'Iniciado' && c.soporte));
  }
  
  renderMetrics(vc);
  renderPendingAuthorizations(allClients);
  renderIniciados(vc);
  renderProceso(vc);
  renderEstadoBars(vc);
}

function renderMetrics(vc) {
  const total = vc.length;
  const activos = vc.filter(c => ['Iniciado', 'Capacitacion', 'Armado de Base', 'Instalacion'].includes(c.estado)).length;
  const atrasados = vc.filter(c => {
    if (c.estado === 'Iniciado') return false;
    const d = daysRemaining(c.arranque);
    return d !== null && d < 0;
  }).length;
  const sinEstado = vc.filter(c => !c.estado).length;

  const container = document.getElementById('metrics-cards');
  if (!container) return;

  container.innerHTML = `
    <div class="metric-card primary">
      <div class="metric-label">Total Clientes</div>
      <div class="metric-value">${total}</div>
      <div class="metric-sub">En cartera general</div>
    </div>
    <div class="metric-card success">
      <div class="metric-label">En Implementación</div>
      <div class="metric-value" style="color: var(--green-text)">${activos}</div>
      <div class="metric-sub">Procesos activos</div>
    </div>
    <div class="metric-card danger">
      <div class="metric-label">Alertas de Atraso</div>
      <div class="metric-value" style="color: var(--red-text)">${atrasados}</div>
      <div class="metric-sub">Arranque superado</div>
    </div>
    <div class="metric-card warning">
      <div class="metric-label">Sin Estado Activo</div>
      <div class="metric-value" style="color: var(--yellow-text)">${sinEstado}</div>
      <div class="metric-sub">Requieren revisión</div>
    </div>
  `;
}

/**
 * HTML de la celda "responsable" (principal + secundario si lo hay)
 * usada en las tablas de Iniciados y En Proceso del dashboard.
 */
function assigneeCellHtml(client) {
  let text = client.asignado || '';
  if (client.asignadoSecundario) {
    text = text ? `${text} + ${client.asignadoSecundario}` : client.asignadoSecundario;
  }
  return text
    ? `<span class="notes-sub"><i class="fa-solid fa-user" style="font-size: 10px; margin-right: 4px;"></i>${text}</span>`
    : `<span class="notes-sub" style="font-style: italic; color: var(--text-muted);"><i class="fa-solid fa-user-slash" style="font-size: 10px; margin-right: 4px;"></i>Sin asignar</span>`;
}

function iniciadoBadge(days) {
  if (days === null) return '<span class="days-badge days-none">—</span>';
  if (days < 0) {
    const elapsed = Math.abs(days);
    return `<span class="days-badge days-ok"><i class="fa-solid fa-circle-check" style="font-size:10px"></i> Hace ${elapsed}d</span>`;
  } else if (days > 0) {
    return `<span class="days-badge days-warn"><i class="fa-solid fa-calendar" style="font-size:10px"></i> En ${days}d</span>`;
  } else {
    return `<span class="days-badge days-ok"><i class="fa-solid fa-play" style="font-size:10px"></i> Hoy</span>`;
  }
}

function renderIniciados(vc) {
  const iniciados = vc
    .filter(c => c.estado === 'Iniciado')
    .sort((a, b) => {
      const dA = daysRemaining(a.arranque);
      const dB = daysRemaining(b.arranque);
      if (dA === null && dB === null) return 0;
      if (dA === null) return 1;
      if (dB === null) return -1;
      return dB - dA; // Most recent starts (least negative/most positive daysRemaining) first
    });

  const tbody = document.getElementById('iniciados-list');
  if (!tbody) return;

  if (iniciados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 24px;">
          <i class="fa-solid fa-circle-info" style="color: var(--text-muted); font-size: 20px; display: block; margin-bottom: 8px; opacity: 0.5;"></i>
          No hay clientes iniciados aún.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = iniciados.map(c => {
    const days = daysRemaining(c.arranque);
    const assigneeHtml = assigneeCellHtml(c);

    return `
      <tr onclick="window.openDetail(${c.id})" style="cursor: pointer;">
        <td>
          <div class="client-name-cell">
            <span class="name">${shortName(c.nombre)}</span>
            ${assigneeHtml}
          </div>
        </td>
        <td>${estadoBadge(c.estado)}</td>
        <td class="text-right">${iniciadoBadge(days)}</td>
      </tr>
    `;
  }).join('');
}

function renderProceso(vc) {
  const proceso = vc
    .filter(c => c.estado !== 'Iniciado')
    .sort((a, b) => {
      const dA = daysRemaining(a.arranque);
      const dB = daysRemaining(b.arranque);
      if (dA === null && dB === null) return 0;
      if (dA === null) return 1;
      if (dB === null) return -1;
      return dA - dB; // Most negative (most delayed) first
    });

  const tbody = document.getElementById('proceso-list');
  if (!tbody) return;

  if (proceso.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 24px;">
          <i class="fa-solid fa-circle-check" style="color: var(--green-text); font-size: 20px; display: block; margin-bottom: 8px;"></i>
          No hay implementaciones en proceso o pendientes.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = proceso.map(c => {
    const days = daysRemaining(c.arranque);
    const assigneeHtml = assigneeCellHtml(c);

    return `
      <tr onclick="window.openDetail(${c.id})" style="cursor: pointer;">
        <td>
          <div class="client-name-cell">
            <span class="name">${shortName(c.nombre)}</span>
            ${assigneeHtml}
          </div>
        </td>
        <td>${estadoBadge(c.estado)}</td>
        <td class="text-right">${daysBadge(days)}</td>
      </tr>
    `;
  }).join('');
}

function renderEstadoBars(vc) {
  const estados = ['Solicitar Info', 'Armado de Base', 'Instalacion', 'Capacitacion', 'Iniciado', ''];
  const labels = {
    'Solicitar Info': 'Solicitar Info',
    'Armado de Base': 'Armado de Base',
    'Instalacion': 'Instalación',
    'Capacitacion': 'Capacitación',
    'Iniciado': 'Iniciado',
    '': 'Sin Estado'
  };
  
  const colors = {
    'Solicitar Info': 'var(--yellow-text)',
    'Armado de Base': 'var(--purple-text)',
    'Instalacion': 'var(--text-secondary)',
    'Capacitacion': 'var(--blue-text)',
    'Iniciado': 'var(--green-text)',
    '': 'var(--text-muted)'
  };
  
  const bgColors = {
    'Solicitar Info': 'var(--yellow-border)',
    'Armado de Base': 'var(--purple-border)',
    'Instalacion': 'var(--gray-border)',
    'Capacitacion': 'var(--blue-border)',
    'Iniciado': 'var(--green-border)',
    '': 'var(--border)'
  };

  const counts = {};
  estados.forEach(e => counts[e] = 0);
  
  vc.forEach(c => {
    const est = c.estado || '';
    if (est in counts) {
      counts[est]++;
    } else {
      counts['']++;
    }
  });

  const max = Math.max(...Object.values(counts));
  const container = document.getElementById('estado-bars');
  if (!container) return;

  container.innerHTML = estados.map(e => {
    const cnt = counts[e];
    const percentage = max ? Math.round((cnt / max) * 100) : 0;
    const barColor = colors[e] || 'var(--primary)';
    const bgColor = bgColors[e] || 'var(--gray-bg)';
    
    return `
      <div class="status-bar-item">
        <div class="status-bar-info">
          <span class="status-bar-name">${labels[e]}</span>
          <span class="status-bar-count">${cnt}</span>
        </div>
        <div class="status-bar-track" style="background-color: var(--gray-bg)">
          <div class="status-bar-fill" style="width: ${percentage}%; background-color: ${barColor}"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderPendingAuthorizations(allClients) {
  const container = document.getElementById('pending-authorizations-section');
  if (!container) return;

  const user = getCurrentUser();
  const isLeader = user && (user.role === 'lider');

  if (!isLeader) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  const pendingClients = allClients.filter(c => c.pendingArranque);

  if (pendingClients.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  
  const itemsHtml = pendingClients.map(c => {
    const pendingDateStr = formatDateAR(c.pendingArranque);
    const originalDateStr = c.arranque ? formatDateAR(c.arranque) : 'sin fecha';

    return `
      <div class="pending-auth-item">
        <div>
          <span class="pending-auth-client" onclick="window.openDetail(${c.id})">${c.nombre}</span>
          <span class="pending-auth-date-change">
            Solicita cambiar arranque de <span>${originalDateStr}</span> a <span>${pendingDateStr}</span>
          </span>
        </div>
        <div class="pending-auth-actions">
          <button class="btn btn-approve btn-xs" onclick="window.resolveDashboardPendingArranque(${c.id}, true)">
            <i class="fa-solid fa-check" style="margin-right: 4px;"></i> Autorizar
          </button>
          <button class="btn btn-reject btn-xs" onclick="window.resolveDashboardPendingArranque(${c.id}, false)">
            <i class="fa-solid fa-xmark"></i> Rechazar
          </button>
        </div>
      </div>
    `;
  }).join('');

    container.innerHTML = `
      <div class="pending-auth-banner">
        <div class="pending-auth-header">
          <i class="fa-solid fa-bell-concierge"></i>
          <span>Solicitudes de Cambio de Fecha de Arranque (${pendingClients.length})</span>
        </div>
        <div class="pending-auth-list">
          ${itemsHtml}
        </div>
      </div>
    `;
}

window.toggleShowSupport = function(checked) {
  localStorage.setItem('crm_show_support', checked);
  renderDashboard();
};
