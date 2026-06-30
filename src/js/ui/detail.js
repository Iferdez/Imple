import { loadClients, saveClients, loadUsers, addActivity, recordStateChange, loadAcciones, addAccion, deleteAccion, loadTareas, updateTarea, deleteTarea } from '../data.js';
import { getCurrentUser } from '../auth.js';
import { daysRemaining, estadoBadge, avatarEl, daysBadge, formatTaskDate, formatDateAR, taskRangeLabel, taskType, taskTypeBadge } from '../utils.js';
import { getClientGanttUrl } from './gantt.js';
import { renderTable } from './clients.js';
import { renderContactosHero, renderAccionesCliente, renderHistorialEstados } from './detail/sections.js';
import { renderTimeline } from './detail/timeline.js';
import { bindArranqueGlobals } from './detail/pending-arranque.js';
import { bindChecklistGlobals } from './detail/checklists.js';

let activeClientId = null;

function refreshClientPage(clientId) {
  const clients = loadClients();
  const client = clients.find(c => c.id === clientId);
  if (client) renderClientPage(client);
}

// Conecta el módulo de "fecha de arranque pendiente" con el estado
// interno de esta ficha (activeClientId) y le dice cómo refrescar
// la pantalla después de aprobar/rechazar/solicitar un cambio.
bindArranqueGlobals(() => activeClientId, refreshClientPage);
bindChecklistGlobals(() => activeClientId, refreshClientPage);

export function openDetail(id) {
  activeClientId = id;
  const clients = loadClients();
  const client = clients.find(c => c.id === id);
  if (!client) return;

  // Switch to client page in SPA router
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const detailPage = document.getElementById('page-cliente');
  if (detailPage) detailPage.classList.add('active');
  
  // Deactivate navigation links
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));

  renderClientPage(client);
  window.scrollTo(0, 0);
}

// Bind to window so other views can call it
window.openDetail = openDetail;

export function refreshActiveClientDetail() {
  if (activeClientId) {
    const clients = loadClients();
    const client = clients.find(c => c.id === activeClientId);
    const detailPage = document.getElementById('page-cliente');
    if (client && detailPage && detailPage.classList.contains('active')) {
      renderClientPage(client);
    }
  }
}
window.refreshActiveClientDetail = refreshActiveClientDetail;

window.openClientGantt = function(clientId) {
  window.open(getClientGanttUrl(clientId), '_blank', 'noopener');
};

window.copyClientGanttLink = async function(clientId) {
  const url = getClientGanttUrl(clientId);
  try {
    await navigator.clipboard.writeText(url);
    if (window.showEmergentNotification) {
      window.showEmergentNotification('Link del Gantt copiado.');
    } else {
      alert('Link del Gantt copiado.');
    }
  } catch (e) {
    window.prompt('Copiar link del Gantt:', url);
  }
};

function renderClientPage(c) {
  const days = daysRemaining(c.arranque);
  const tasks = c.tasks || [];
  const user = getCurrentUser();
  const isLeader = user && (user.role === 'lider');

  // Hero status coloring configuration
  const heroEstadoMap = {
    'Iniciado':      { bg: 'var(--green-bg)', color: 'var(--green-text)', border: 'var(--green-border)' },
    'Capacitacion':  { bg: 'var(--blue-bg)', color: 'var(--blue-text)', border: 'var(--blue-border)' },
    'Armado de Base':{ bg: 'var(--purple-bg)', color: 'var(--purple-text)', border: 'var(--purple-border)' },
    'Solicitar Info':{ bg: 'var(--yellow-bg)', color: 'var(--yellow-text)', border: 'var(--yellow-border)' },
    'Instalacion':   { bg: 'var(--gray-bg)', color: 'var(--gray-text)', border: 'var(--gray-border)' },
  };
  const ec = heroEstadoMap[c.estado] || { bg: 'rgba(255,255,255,0.08)', color: 'var(--sidebar-text-active)', border: 'rgba(255,255,255,0.05)' };
  const estadoLabel = c.estado || 'Sin estado';

  let daysHtml = '—';
  let daysClass = 'none';
  if (days !== null) {
    // Clientes 'Iniciado' ya arrancaron - fecha vencida es esperada, no crítica
    const isIniciado = c.estado === 'Iniciado';
    daysClass = days > 14 ? 'ok' : days >= 0 ? 'warn' : (isIniciado ? 'warn' : 'late');
    daysHtml = days >= 0 ? `+${days}` : `${days}`;
  }

  const tasksPendientes = tasks.filter(t => t.status === 'Pendiente' || t.status === 'En progreso').length;
  const tasksTotales = tasks.length;

  const kickoffDateStr = formatDateAR(c.arranque);

  // Pending date change request controls
  let pendingAreaHtml = '';
  if (c.pendingArranque) {
    const pendingDateStr = formatDateAR(c.pendingArranque);

    if (isLeader) {
      pendingAreaHtml = `
        <div class="pending-approval-box">
          <span class="pending-label"><i class="fa-solid fa-clock"></i> Solicitado: ${pendingDateStr}</span>
          <div class="pending-actions">
            <button class="btn btn-approve btn-xs" onclick="window.resolvePendingArranque(true)">
              <i class="fa-solid fa-check" style="margin-right: 4px;"></i> Autorizar
            </button>
            <button class="btn btn-reject btn-xs" onclick="window.resolvePendingArranque(false)" title="Rechazar">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      `;
    } else {
      pendingAreaHtml = `
        <div class="pending-approval-box">
          <span class="pending-label"><i class="fa-solid fa-clock"></i> Pendiente: ${pendingDateStr}</span>
          <button class="btn btn-reject btn-xs" onclick="window.cancelPendingArranque()" style="margin-top: 4px; height: 20px; font-size: 10px; padding: 2px 6px;">
            <span>Cancelar</span>
          </button>
        </div>
      `;
    }
  } else if (!isLeader) {
    pendingAreaHtml = `
      <div style="margin-top: 6px;">
        <button class="btn btn-secondary btn-xs" onclick="window.showRequestArranqueInput()" id="btn-request-arranque" style="padding: 2px 8px; font-size: 11px;">
          <i class="fa-solid fa-calendar-plus"></i> Solicitar Cambio
        </button>
        <div id="request-arranque-wrapper" style="display: none; margin-top: 6px; align-items: center; gap: 6px;">
          <input type="date" id="request-arranque-date" class="edit-date" style="padding: 2px 6px; font-size: 12px; height: 28px; width: 130px;" value="${c.arranque || ''}">
          <button class="btn btn-primary btn-icon-sm" style="width: 28px; height: 28px; padding:0;" onclick="window.submitRequestArranque()" title="Enviar Solicitud">
            <i class="fa-solid fa-paper-plane" style="font-size: 10px;"></i>
          </button>
          <button class="btn btn-secondary btn-icon-sm" style="width: 28px; height: 28px; padding:0;" onclick="window.hideRequestArranqueInput()" title="Cancelar">
            <i class="fa-solid fa-xmark" style="font-size: 11px;"></i>
          </button>
        </div>
      </div>
    `;
  }

  // Render HERO
  const heroArea = document.getElementById('client-hero-area');
  if (heroArea) {
    heroArea.innerHTML = `
      <div class="client-hero">
        <button class="client-hero-back" onclick="window.goBackToClients()">
          <i class="fa-solid fa-arrow-left"></i>
          <span>Volver al listado de clientes</span>
        </button>
        <div class="client-hero-top">
          <div style="flex: 1;">
            <div class="client-hero-name">${c.nombre}</div>
            <div class="client-hero-meta">
              ${c.tipo ? `<span class="hero-badge">${c.tipo}</span>` : ''}
              <span class="hero-badge-estado" style="background: ${ec.bg}; color: ${ec.color}; border: 1px solid ${ec.border}">${estadoLabel}</span>
              ${c.estado === 'Iniciado' && c.soporte ? `<span class="hero-badge" style="background: var(--blue-bg); color: var(--blue-text); border: 1px solid var(--blue-border);"><i class="fa-solid fa-headset" style="margin-right: 6px; font-size: 10px;"></i>Soporte</span>` : ''}
              ${c.asignado ? `<span class="hero-badge"><i class="fa-solid fa-user" style="margin-right: 6px; font-size: 10px;"></i>Asignado: ${c.asignado}</span>` : ''}
              ${c.asignadoSecundario ? `<span class="hero-badge" style="background: rgba(99, 102, 241, 0.08); border-color: rgba(99, 102, 241, 0.2);"><i class="fa-solid fa-user-group" style="margin-right: 6px; font-size: 10px;"></i>Secundario: ${c.asignadoSecundario}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="client-hero-stats">
          <div class="hero-stat-item">
            <span class="hero-stat-label">Días Restantes</span>
            <span class="hero-stat-value ${daysClass}">${daysHtml}</span>
          </div>
          <div class="hero-stat-item" style="position: relative;">
            <span class="hero-stat-label">Fecha Arranque</span>
            <span class="hero-stat-value" style="font-size: 16px; margin-top: 4px; font-family: var(--font-mono);">${kickoffDateStr}</span>
            ${pendingAreaHtml}
          </div>
          <div class="hero-stat-item">
            <span class="hero-stat-label">Pedidos Totales</span>
            <span class="hero-stat-value">${tasksTotales}</span>
          </div>
          <div class="hero-stat-item">
            <span class="hero-stat-label">Pendientes</span>
            <span class="hero-stat-value" style="color: ${tasksPendientes > 0 ? 'var(--yellow-text)' : 'inherit'}">${tasksPendientes}</span>
          </div>
          ${c.notas ? `
            <div style="border-left: 1px solid rgba(255,255,255,0.08); padding-left: 24px; max-width: 320px;">
              <span class="hero-stat-label">Notas</span>
              <div style="font-size: 13px; color: var(--sidebar-text); margin-top: 4px; line-height: 1.4; word-break: break-word;">${c.notas}</div>
            </div>
          ` : ''}
          ${(isLeader && c.notasInternas) ? `
            <div style="border-left: 2px solid var(--yellow-border); padding-left: 24px; max-width: 320px; background: rgba(251,191,36,0.06); border-radius: 0 8px 8px 0; padding: 8px 16px;">
              <span class="hero-stat-label" style="color: var(--yellow-text);"><i class="fa-solid fa-lock" style="margin-right:4px;font-size:9px;"></i>Nota Interna</span>
              <div style="font-size: 13px; color: var(--yellow-text); margin-top: 4px; line-height: 1.4; word-break: break-word;">${c.notasInternas}</div>
            </div>
          ` : ''}
        </div>
      </div>
      ${c.particularidades ? `
        <div class="particularidades-hero-row">
          <div class="particularidades-hero-block">
            <span class="hero-stat-label"><i class="fa-solid fa-clipboard-list" style="margin-right:5px;font-size:10px;opacity:0.7;"></i>Particularidades del cliente</span>
            <div class="particularidades-hero-text">${c.particularidades}</div>
          </div>
        </div>
      ` : ''}
      ${renderContactosHero(c, isLeader)}
    `;
  }

  // Render EDIT BAR (Leader Only)
  const editBar = document.getElementById('client-edit-bar');
  if (editBar) {
    const users = loadUsers();
    const implementers = users.filter(u => u.role !== 'lider');

    editBar.innerHTML = `
      <span class="edit-bar-label leader-only">Editar Ficha:</span>
      
      <div class="select-wrapper leader-only">
        <select class="edit-select" onchange="window.editClientField('estado', this.value)" title="Cambiar Estado">
          <option value="">Sin Estado</option>
          ${['Solicitar Info', 'Armado de Base', 'Instalacion', 'Capacitacion', 'Iniciado'].map(e =>
            `<option value="${e}" ${c.estado === e ? 'selected' : ''}>${e}</option>`
          ).join('')}
        </select>
        <i class="fa-solid fa-chevron-down select-arrow" style="font-size: 8px;"></i>
      </div>
      
      ${c.estado === 'Iniciado' ? `
      <div class="select-wrapper leader-only">
        <select class="edit-select" onchange="window.editClientField('soporte', this.value === 'true')" title="¿Pasó a soporte?">
          <option value="false" ${!c.soporte ? 'selected' : ''}>En Implementación</option>
          <option value="true" ${c.soporte ? 'selected' : ''}>Pasó a Soporte</option>
        </select>
        <i class="fa-solid fa-chevron-down select-arrow" style="font-size: 8px;"></i>
      </div>
      ` : ''}
      
      <div class="select-wrapper leader-only">
        <select class="edit-select" onchange="window.editClientField('asignado', this.value)" title="Asignar Responsable Principal">
          <option value="">Sin Asignar</option>
          ${implementers.map(u => `
            <option value="${u.username}" ${c.asignado === u.username ? 'selected' : ''}>${u.username}</option>
          `).join('')}
        </select>
        <i class="fa-solid fa-chevron-down select-arrow" style="font-size: 8px;"></i>
      </div>

      <div class="select-wrapper leader-only">
        <select class="edit-select" onchange="window.editClientField('asignadoSecundario', this.value)" title="Asignar Responsable Secundario">
          <option value="">Secundario: Ninguno</option>
          ${implementers.map(u => `
            <option value="${u.username}" ${c.asignadoSecundario === u.username ? 'selected' : ''}>Secundario: ${u.username}</option>
          `).join('')}
        </select>
        <i class="fa-solid fa-chevron-down select-arrow" style="font-size: 8px;"></i>
      </div>

      <input type="date" class="edit-date leader-only" value="${c.arranque || ''}" onchange="window.editClientField('arranque', this.value)" title="Fecha arranque pactada">
      <input type="text" class="edit-input leader-only" value="${c.notas || ''}" placeholder="Notas visibles a todos..." onchange="window.editClientField('notas', this.value)" title="Notas de cliente (visibles a todos)">
      <input type="text" class="edit-input leader-only" value="${c.notasInternas || ''}" placeholder="Nota interna (solo vos)..." onchange="window.editClientField('notasInternas', this.value)" style="border-color: var(--yellow-border); background: var(--yellow-bg); color: var(--yellow-text);" title="Nota interna — solo visible para el Administrador">
      <textarea class="edit-input leader-only edit-textarea" placeholder="Particularidades del cliente..." onchange="window.editClientField('particularidades', this.value)" title="Particularidades — detalles específicos del cliente" rows="2">${c.particularidades || ''}</textarea>
      
      <div class="edit-bar-separator leader-only"></div>
      <span class="edit-bar-label leader-only" style="font-size:10px; opacity:0.7; white-space:nowrap;">Contacto Principal:</span>
      <input type="text" class="edit-input leader-only" value="${c.contactoPrincipal?.nombre || ''}" placeholder="Nombre contacto..." onchange="window.editContactField('contactoPrincipal','nombre',this.value)" style="min-width:130px;" title="Nombre del contacto principal">
      <input type="text" class="edit-input leader-only" value="${c.contactoPrincipal?.cargo || ''}" placeholder="Cargo..." onchange="window.editContactField('contactoPrincipal','cargo',this.value)" style="min-width:100px;" title="Cargo del contacto principal">
      <input type="text" class="edit-input leader-only" value="${c.contactoPrincipal?.telefono || ''}" placeholder="Teléfono..." onchange="window.editContactField('contactoPrincipal','telefono',this.value)" style="min-width:110px;" title="Teléfono del contacto principal">
      <input type="text" class="edit-input leader-only" value="${c.contactoPrincipal?.email || ''}" placeholder="Email..." onchange="window.editContactField('contactoPrincipal','email',this.value)" style="min-width:150px;" title="Email del contacto principal">
      <div class="edit-bar-separator leader-only"></div>
      <span class="edit-bar-label leader-only" style="font-size:10px; opacity:0.7; white-space:nowrap;">Encargado:</span>
      <input type="text" class="edit-input leader-only" value="${c.contactoEncargado?.nombre || ''}" placeholder="Nombre encargado..." onchange="window.editContactField('contactoEncargado','nombre',this.value)" style="min-width:130px;" title="Nombre del encargado">
      <input type="text" class="edit-input leader-only" value="${c.contactoEncargado?.cargo || ''}" placeholder="Cargo..." onchange="window.editContactField('contactoEncargado','cargo',this.value)" style="min-width:100px;" title="Cargo del encargado">
      <input type="text" class="edit-input leader-only" value="${c.contactoEncargado?.telefono || ''}" placeholder="Teléfono..." onchange="window.editContactField('contactoEncargado','telefono',this.value)" style="min-width:110px;" title="Teléfono del encargado">
      <input type="text" class="edit-input leader-only" value="${c.contactoEncargado?.email || ''}" placeholder="Email..." onchange="window.editContactField('contactoEncargado','email',this.value)" style="min-width:150px;" title="Email del encargado">
      <div class="edit-bar-separator leader-only"></div>
      <button class="btn btn-delete-client leader-only" onclick="window.confirmDeleteClient()">
        <i class="fa-solid fa-trash-can"></i>
        <span>Eliminar</span>
      </button>
      <button class="btn btn-secondary" onclick="window.openClientGantt(${c.id})" title="Abrir Gantt de solo lectura">
        <i class="fa-solid fa-chart-gantt"></i>
        <span>Ver Gantt</span>
      </button>
      <button class="btn btn-secondary" onclick="window.copyClientGanttLink(${c.id})" title="Copiar enlace para compartir">
        <i class="fa-solid fa-link"></i>
        <span>Copiar link Gantt</span>
      </button>
    `;
  }

  renderTasksTable(c);
}

function renderTareasEquipoCliente(clientId, currentUser, isLeader) {
  const tareas = loadTareas().filter(t => t.clienteId === clientId);
  if (tareas.length === 0) return '';

  const prioMap = { alta: '#ef4444', media: '#f59e0b', baja: '#6b7280' };
  const estadoMap = {
    pendiente:   { icon: 'fa-clock', label: 'Pendiente', color: '#f59e0b' },
    en_progreso: { icon: 'fa-spinner', label: 'En progreso', color: '#3b82f6' },
    completada:  { icon: 'fa-circle-check', label: 'Completada', color: '#10b981' },
  };

  const rows = tareas.map(t => {
    const prioColor = prioMap[t.prioridad] || '#6b7280';
    const est = estadoMap[t.estado] || estadoMap.pendiente;
    const canChange = t.asignado === (currentUser?.username || '') || isLeader;
    return '<tr>'
      + `<td><span style="font-weight:600;font-size:13px;">${t.titulo}</span>${t.descripcion ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${t.descripcion}</div>` : ''}</td>`
      + `<td><span style="font-size:11px;font-weight:600;color:${prioColor};">${(t.prioridad||'media').charAt(0).toUpperCase()+(t.prioridad||'media').slice(1)}</span></td>`
      + `<td>${t.asignado || '—'}</td>`
      + `<td style="font-family:var(--font-mono);font-size:11px;">${t.fechaLimite ? t.fechaLimite.split('-').reverse().join('/') : '—'}</td>`
      + `<td>${canChange
          ? `<div class="select-wrapper" style="min-width:120px;"><select class="edit-select" style="font-size:11px;padding:3px 8px;" onchange="window.updateTareaEstadoDetail(${t.id},this.value)"><option value="pendiente" ${t.estado==='pendiente'?'selected':''}>⏳ Pendiente</option><option value="en_progreso" ${t.estado==='en_progreso'?'selected':''}>🔵 En progreso</option><option value="completada" ${t.estado==='completada'?'selected':''}>✅ Completada</option></select><i class="fa-solid fa-chevron-down select-arrow" style="font-size:7px;"></i></div>`
          : `<span class="badge" style="background:${est.color}22;color:${est.color};border:1px solid ${est.color}44;"><i class="fa-solid ${est.icon}" style="font-size:9px;"></i> ${est.label}</span>`
        }</td>`
      + (isLeader ? `<td><button class="accion-delete-btn" onclick="window.deleteTareaFromDetail(${t.id})" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button></td>` : '<td></td>')
      + '</tr>';
  }).join('');

  return '<div class="section-header" style="margin-top:32px;">'
    + '<div class="section-title-wrap">'
    + '<span class="section-title"><i class="fa-solid fa-list-check" style="font-size:12px;margin-right:6px;opacity:.7;"></i>Tareas del equipo</span>'
    + `<span class="section-count">${tareas.length}</span>`
    + '</div></div>'
    + '<div class="tasks-table-wrap"><table class="tasks-table"><thead><tr>'
    + '<th>Tarea</th><th>Prioridad</th><th>Asignado</th><th>Vencimiento</th><th>Estado</th><th></th>'
    + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function renderTasksTable(c) {
  const tasks = c.tasks || [];
  const users = loadUsers();
  const _rtUser = getCurrentUser();
  const isLeader = _rtUser && (_rtUser.role === 'lider');

  const taskRows = tasks.map((t, idx) => {
    // Format date DD/MM
    let dateFormatted = '—';
    if (t.date) {
      const parts = t.date.split('-');
      if (parts.length === 3) {
        dateFormatted = `${parts[2]}/${parts[1]}`;
      }
    }

    const jiraHtml = t.jira
      ? `<span class="task-jira-link" title="Clave de ticket Jira">${t.jira}</span>`
      : `<span style="color: var(--text-muted); font-size: 12px;">—</span>`;

    const isPedido = taskType(t) === 'pedido';

    return `
      <tr>
        <td class="col-tipo">${taskTypeBadge(t)}</td>
        <td class="col-fecha">
          <span style="font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary); font-weight: 500;">${formatTaskDate(t.date)}</span>
        </td>
        <td class="col-rango">
          <span style="font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary); font-weight: 500;">${taskRangeLabel(t)}</span>
        </td>
        <td class="col-quien">
          <span style="font-weight: 500; font-size: 13px;">${isPedido ? (t.who || '<span style="color: var(--text-muted); font-style: italic;">S/N</span>') : '<span style="color: var(--text-muted);">—</span>'}</span>
        </td>
        <td class="col-detalle">
          <div class="task-desc-text">${t.desc}</div>
        </td>
        <td class="col-jira">${isPedido ? jiraHtml : '<span style="color: var(--text-muted); font-size: 12px;">—</span>'}</td>
        <td class="col-asignado">
          <div class="select-wrapper" style="width: 100%;">
            <select class="task-assignee-select" onchange="window.updateTaskAssignee(${idx}, this.value)">
              <option value="" ${!t.asignado ? 'selected' : ''}>Sin Asignar</option>
              ${users.map(u => `
                <option value="${u.username}" ${t.asignado === u.username ? 'selected' : ''}>${u.username}</option>
              `).join('')}
            </select>
            <i class="fa-solid fa-chevron-down select-arrow" style="font-size: 8px;"></i>
          </div>
        </td>
        <td class="col-estado">
          <div class="select-wrapper" style="width: 100%;">
            <select class="task-status-select" onchange="window.updateTaskStatus(${idx}, this.value)">
              <option value="" ${!t.status ? 'selected' : ''}>Sin Estado</option>
              ${['Pendiente', 'En progreso', 'Resuelto', 'Cancelado'].map(s => `
                <option value="${s}" ${t.status === s ? 'selected' : ''}>${s}</option>
              `).join('')}
            </select>
            <i class="fa-solid fa-chevron-down select-arrow" style="font-size: 8px;"></i>
          </div>
        </td>
        <td class="col-acc" style="text-align: center;">
          <button class="delete-task-btn" onclick="window.deleteTask(${idx})" title="Eliminar solicitud">
            <i class="fa-solid fa-times"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  const container = document.getElementById('client-body');
  if (!container) return;

  container.innerHTML = `
    <div class="section-header">
      <div class="section-title-wrap">
        <span class="section-title">Tareas</span>
        <span class="section-count">${tasks.length}</span>
      </div>
      <div style="display: flex; gap: 8px;">
        ${c.estado ? `
          <button class="btn btn-secondary" onclick="window.loadStandardChecklist()" id="btn-standard-checklist" title="Cargar tareas recomendadas para la etapa: ${c.estado}" style="display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-clipboard-check"></i>
            <span>Cargar Checklist ${c.estado}</span>
          </button>
        ` : ''}
        <button class="btn btn-primary" onclick="window.showAddTaskRow()" id="btn-add-task">
          <i class="fa-solid fa-plus"></i>
          <span>Nueva Tarea</span>
        </button>
      </div>
    </div>

    <div class="tasks-table-wrap">
      <table class="tasks-table">
        <thead>
          <tr>
            <th class="col-tipo">Tipo</th>
            <th class="col-fecha">Fecha pedido</th>
            <th class="col-rango">Fecha tarea</th>
            <th class="col-quien">Pedido por</th>
            <th class="col-detalle">Detalle</th>
            <th class="col-jira">Jira</th>
            <th class="col-asignado">Asignado</th>
            <th class="col-estado">Estado</th>
            <th class="col-acc"></th>
          </tr>
        </thead>
        <tbody id="tasks-tbody">
          ${taskRows}
          ${tasks.length === 0 ? `
            <tr>
              <td colspan="9" style="text-align: center; padding: 48px; color: var(--text-muted);">
                <i class="fa-solid fa-clipboard-list" style="display: block; font-size: 32px; margin-bottom: 12px; opacity: 0.3;"></i>
                Sin tareas registradas en esta implementación.<br>
                Usa el botón superior para agregar la primera solicitud de este cliente.
              </td>
            </tr>
          ` : ''}
        </tbody>
      </table>
    </div>

    ${isLeader ? renderHistorialEstados(c) : ''}
    ${renderAccionesCliente(c.id, c.nombre, _rtUser)}
    ${renderTareasEquipoCliente(c.id, _rtUser, isLeader)}

    <div class="section-header" style="margin-top:32px;">
      <div class="section-title-wrap">
        <span class="section-title"><i class="fa-solid fa-clock-rotate-left" style="font-size:12px;margin-right:6px;opacity:.7;"></i>Línea de Tiempo</span>
      </div>
    </div>
    <div style="padding-bottom:8px;">
      ${renderTimeline(c, _rtUser)}
    </div>
  `;
}

// Inline rows creation
window.showAddTaskRow = function() {
  const tbody = document.getElementById('tasks-tbody');
  if (!tbody || document.getElementById('new-task-row')) return;
  
  const btn = document.getElementById('btn-add-task');
  if (btn) btn.disabled = true;

  // Set default date to today in YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];
  const users = loadUsers();

  const tr = document.createElement('tr');
  tr.id = 'new-task-row';
  tr.className = 'add-task-row';
  tr.innerHTML = `
    <td class="col-tipo">
      <div class="select-wrapper" style="width: 100%;">
        <select class="task-type-select" id="nt-tipo" onchange="window.toggleInlineTaskTypeFields()">
          <option value="pedido" selected="">Pedido</option>
          <option value="capacitacion">Capacitación</option>
          <option value="configuracion">Configuración</option>
          <option value="visita">Visita</option>
        </select>
        <i class="fa-solid fa-chevron-down select-arrow" style="font-size: 8px;"></i>
      </div>
    </td>
    <td class="col-fecha">
      <input type="date" class="inline-input" id="nt-date" value="${todayStr}">
    </td>
    <td class="col-rango">
      <input type="date" class="inline-input" id="nt-fecha-desde" value="${todayStr}" title="Fecha desde">
      <input type="date" class="inline-input task-date-to" id="nt-fecha-hasta" value="${todayStr}" title="Fecha hasta">
    </td>
    <td class="col-quien task-pedido-only">
      <input type="text" class="inline-input" id="nt-who" placeholder="Nombre...">
    </td>
    <td class="col-detalle">
      <textarea class="inline-textarea" id="nt-desc" placeholder="Detalla la solicitud o requerimiento..."></textarea>
    </td>
    <td class="col-jira task-pedido-only">
      <input type="text" class="inline-input" id="nt-jira" placeholder="PROJ-000">
    </td>
    <td class="col-asignado">
      <div class="select-wrapper" style="width: 100%;">
        <select class="task-assignee-select" id="nt-asignado">
          <option value="">Sin Asignar</option>
          ${users.map(u => `
            <option value="${u.username}">${u.username}</option>
          `).join('')}
        </select>
        <i class="fa-solid fa-chevron-down select-arrow" style="font-size: 8px;"></i>
      </div>
    </td>
    <td class="col-estado">
      <div class="select-wrapper" style="width: 100%;">
        <select class="task-status-select" id="nt-status">
          <option value="">Sin Estado</option>
          <option value="Pendiente" selected>Pendiente</option>
          <option value="En progreso">En progreso</option>
          <option value="Resuelto">Resuelto</option>
          <option value="Cancelado">Cancelado</option>
        </select>
        <i class="fa-solid fa-chevron-down select-arrow" style="font-size: 8px;"></i>
      </div>
    </td>
    <td class="col-acc" style="text-align: center; vertical-align: middle;">
      <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
        <button class="btn btn-primary" style="padding: 4px 8px; font-size: 11px;" onclick="window.saveNewTask()" title="Guardar">
          <i class="fa-solid fa-check"></i>
        </button>
        <button class="delete-task-btn" style="width: 24px; height: 24px;" onclick="window.cancelNewTask()" title="Cancelar">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </td>
  `;
  
  tbody.insertBefore(tr, tbody.firstChild);
  window.toggleInlineTaskTypeFields();
  
  const descEl = document.getElementById('nt-desc');
  if (descEl) descEl.focus();
};

window.toggleInlineTaskTypeFields = function() {
  const type = document.getElementById('nt-tipo')?.value || 'pedido';
  document.querySelectorAll('#new-task-row .task-pedido-only').forEach(el => {
    el.classList.toggle('task-fields-hidden', type !== 'pedido');
  });
  if (type !== 'pedido') {
    const whoEl = document.getElementById('nt-who');
    const jiraEl = document.getElementById('nt-jira');
    if (whoEl) whoEl.value = '';
    if (jiraEl) jiraEl.value = '';
  }
};

window.saveNewTask = function() {
  const clients = loadClients();
  const c = clients.find(x => x.id === activeClientId);
  if (!c) return;

  const descEl = document.getElementById('nt-desc');
  const desc = descEl ? descEl.value.trim() : '';
  if (!desc) {
    if (descEl) descEl.focus();
    return;
  }

  const dateVal = document.getElementById('nt-date').value;
  const fechaDesdeVal = document.getElementById('nt-fecha-desde').value;
  const fechaHastaVal = document.getElementById('nt-fecha-hasta').value || fechaDesdeVal;
  const tipoVal = document.getElementById('nt-tipo').value;
  const isPedido = tipoVal === 'pedido';
  const whoVal = isPedido ? document.getElementById('nt-who').value.trim() : '';
  const jiraVal = isPedido ? document.getElementById('nt-jira').value.trim().toUpperCase() : '';
  const asignadoVal = document.getElementById('nt-asignado').value;
  const statusVal = document.getElementById('nt-status').value;

  if (fechaDesdeVal && fechaHastaVal && fechaHastaVal < fechaDesdeVal) {
    alert('La fecha hasta no puede ser anterior a la fecha desde.');
    document.getElementById('nt-fecha-hasta').focus();
    return;
  }

  c.tasks = c.tasks || [];
  c.tasks.unshift({
    tipo: tipoVal,
    date: dateVal,
    fechaDesde: fechaDesdeVal,
    fechaHasta: fechaHastaVal,
    who: whoVal,
    desc,
    jira: jiraVal,
    asignado: asignadoVal,
    status: statusVal
  });

  saveClients(clients);
  
  const curUser = getCurrentUser();
  if (curUser) {
    addActivity(curUser.username, c.id, c.nombre, 'task_create', `Agregó el pedido: "${desc}"`);
  }
  
  // Re-render Detail Page
  renderClientPage(c);
  
  // Refresh other view states
  if (window.renderAll) {
    window.renderAll();
  }
};

window.editContactField = function(contactKey, subField, value) {
  const clients = loadClients();
  const c = clients.find(x => x.id === activeClientId);
  if (!c) return;

  if (!c[contactKey] || typeof c[contactKey] !== 'object') {
    c[contactKey] = { nombre: '', cargo: '', telefono: '', email: '' };
  }
  c[contactKey][subField] = value;
  saveClients(clients);

  const curUser = getCurrentUser();
  if (curUser) {
    const label = contactKey === 'contactoPrincipal' ? 'contacto principal' : 'encargado';
    addActivity(curUser.username, c.id, c.nombre, 'client_edit', `Actualizó ${label}: campo "${subField}"`);
  }
  // No full re-render needed - just save, the input already shows new value
};

window.cancelNewTask = function() {
  const row = document.getElementById('new-task-row');
  if (row) row.remove();
  
  const btn = document.getElementById('btn-add-task');
  if (btn) btn.disabled = false;
};

window.updateTaskStatus = function(idx, value) {
  const clients = loadClients();
  const c = clients.find(x => x.id === activeClientId);
  if (!c) return;

  c.tasks = c.tasks || [];
  if (c.tasks[idx]) {
    const oldStatus = c.tasks[idx].status;
    c.tasks[idx].status = value;
    saveClients(clients);
    
    const curUser = getCurrentUser();
    if (curUser && oldStatus !== value) {
      addActivity(curUser.username, c.id, c.nombre, 'task_status', `Cambió el estado del pedido "${c.tasks[idx].desc}" a "${value}"`);
    }
    
    // Refresh stats & views
    renderClientPage(c);
    if (window.renderAll) {
      window.renderAll();
    }
  }
};

window.updateTaskAssignee = function(idx, value) {
  const clients = loadClients();
  const c = clients.find(x => x.id === activeClientId);
  if (!c) return;

  c.tasks = c.tasks || [];
  if (c.tasks[idx]) {
    const oldAssignee = c.tasks[idx].asignado;
    c.tasks[idx].asignado = value;
    saveClients(clients);
    
    const curUser = getCurrentUser();
    if (curUser && oldAssignee !== value) {
      addActivity(curUser.username, c.id, c.nombre, 'task_edit', `Asignó el pedido "${c.tasks[idx].desc}" a "${value || 'Sin asignar'}"`);
    }
    
    // Refresh stats & views
    renderClientPage(c);
    if (window.renderAll) {
      window.renderAll();
    }
  }
};

window.deleteTask = function(idx) {
  if (!confirm('¿Estás seguro de que deseas eliminar esta tarea permanentemente?')) return;
  
  const clients = loadClients();
  const c = clients.find(x => x.id === activeClientId);
  if (!c) return;

  c.tasks = c.tasks || [];
  const removedTask = c.tasks[idx];
  c.tasks.splice(idx, 1);
  saveClients(clients);

  const curUser = getCurrentUser();
  if (curUser && removedTask) {
    addActivity(curUser.username, c.id, c.nombre, 'task_delete', `Eliminó el pedido: "${removedTask.desc}"`);
  }

  renderClientPage(c);
  if (window.renderAll) {
    window.renderAll();
  }
};

window.editClientField = function(field, value) {
  const clients = loadClients();
  const c = clients.find(x => x.id === activeClientId);
  if (!c) return;

  const oldValue = c[field];
  c[field] = value;
  
  // If editing field is 'nombre', make sure it is saved in uppercase
  if (field === 'nombre') {
    c.nombre = value.toUpperCase();
  }

  if (field === 'estado') {
    const curUserForHistory = getCurrentUser();
    recordStateChange(c, value, curUserForHistory ? curUserForHistory.username : '');
    if (value !== 'Iniciado') c.soporte = false;
  }

  saveClients(clients);
  
  const curUser = getCurrentUser();
  if (curUser && oldValue !== value) {
    let desc = `Modificó el campo "${field}" a "${value}"`;
    if (field === 'asignado') desc = `Reasignó el responsable principal a "${value || 'Sin asignar'}"`;
    if (field === 'asignadoSecundario') desc = `Actualizó el responsable secundario a "${value || 'Sin asignar'}"`;
    if (field === 'estado') desc = `Cambió el estado del embudo a "${value || 'Sin estado'}"`;
    if (field === 'arranque') desc = `Modificó la fecha de arranque a "${value || 'Sin fecha'}"`;
    if (field === 'tipo') desc = `Actualizó el tipo de servicio a "${value || 'Sin tipo'}"`;
    if (field === 'notas') desc = `Actualizó las notas de seguimiento`;
    if (field === 'notasInternas') desc = `Actualizó la nota interna del cliente`;
    if (field === 'particularidades') desc = `Actualizó las particularidades del cliente`;
    if (field === 'contactoPrincipal') desc = `Actualizó datos del contacto principal`;
    if (field === 'contactoEncargado') desc = `Actualizó datos del encargado`;
    if (field === 'soporte') desc = value ? 'Marcó el cliente como Pasó a Soporte' : 'Marcó el cliente como En Implementación';

    addActivity(curUser.username, c.id, c.nombre, 'client_edit', desc);
  }
  
  // Re-render details with new data
  renderClientPage(c);
  
  if (window.renderAll) {
    window.renderAll();
  }
};

window.confirmDeleteClient = function() {
  const clients = loadClients();
  const c = clients.find(x => x.id === activeClientId);
  if (!c) return;

  if (!confirm(`¿Eliminar "${c.nombre}"? Esta acción no se puede deshacer y borrará todo su historial de tareas.`)) {
    return;
  }

  const updated = clients.filter(x => x.id !== activeClientId);
  saveClients(updated);
  
  if (window.renderAll) {
    window.renderAll();
  }
  
  window.goBackToClients();
};

window.goBackToClients = function() {
  activeClientId = null;
  
  // Router navigation: go back to clients page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const clientsPage = document.getElementById('page-clientes');
  if (clientsPage) clientsPage.classList.add('active');

  // Mark navigation menu item as active
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
  const clientsNavItem = document.getElementById('nav-clientes');
  if (clientsNavItem) clientsNavItem.classList.add('active');

  // Re-run table render
  renderTable();
};

// --- Acciones en ficha de cliente ---
window._selectedTipoDetail = 'llamada';

window.toggleAccionFormDetail = function() {
  const form = document.getElementById('accion-form-inline');
  if (!form) return;
  const isHidden = form.style.display === 'none';
  form.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    // Set default selected tipo
    window.selectTipoAccionDetail(window._selectedTipoDetail || 'llamada');
    setTimeout(() => {
      const inp = document.getElementById('accion-detail-desc');
      if (inp) inp.focus();
    }, 50);
  }
};

window.selectTipoAccionDetail = function(tipo) {
  window._selectedTipoDetail = tipo;
  document.querySelectorAll('#tipo-btn-group-detail .tipo-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tipo === tipo);
  });
};

window.guardarAccionDetail = function(clientId, clientNombre) {
  const descInput = document.getElementById('accion-detail-desc');
  if (!descInput) return;
  const desc = descInput.value.trim();
  if (!desc) {
    descInput.focus();
    descInput.style.borderColor = 'var(--red-border)';
    setTimeout(() => descInput.style.borderColor = '', 1500);
    return;
  }
  const curUser = getCurrentUser();
  if (!curUser) return;

  addAccion(curUser.username, clientId, clientNombre, window._selectedTipoDetail || 'llamada', desc);
  descInput.value = '';

  if (window.showEmergentNotification) window.showEmergentNotification('Acción registrada');

  // Re-render the full client page to refresh the acciones section
  const clients = loadClients();
  const c = clients.find(x => x.id === clientId);
  if (c) renderClientPage(c);

  // Also refresh Mi Día if visible
  if (typeof window.renderMiDia === 'function') window.renderMiDia();
};

window.deleteAccionDetail = function(id) {
  if (!confirm('¿Eliminar esta acción?')) return;
  deleteAccion(id);
  const clients = loadClients();
  const c = clients.find(x => x.id === activeClientId);
  if (c) renderClientPage(c);
  if (typeof window.renderMiDia === 'function') window.renderMiDia();
};

// Event delegation for accion-detail-desc Enter key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && e.target.id === 'accion-detail-desc') {
    const clientId = parseInt(e.target.dataset.clientid);
    const clientNombre = decodeURIComponent(e.target.dataset.clientnombre || '');
    window.guardarAccionDetail(clientId, clientNombre);
  }
});

window.guardarAccionDetailFromBtn = function(btn) {
  const clientId = parseInt(btn.dataset.clientid);
  const clientNombre = decodeURIComponent(btn.dataset.clientnombre || '');
  window.guardarAccionDetail(clientId, clientNombre);
};

// Actualizar estado de tarea del equipo desde la ficha del cliente
window.updateTareaEstadoDetail = function(tareaId, nuevoEstado) {
  updateTarea(tareaId, { estado: nuevoEstado });
  if (window.renderTareas) window.renderTareas();
  // Refresh the client detail to reflect new estado in tareas table
  const clients = loadClients();
  const c = clients.find(x => x.id === activeClientId);
  if (c) renderClientPage(c);
};

window.deleteTareaFromDetail = function(tareaId) {
  if (!confirm('¿Eliminar esta tarea?')) return;
  deleteTarea(tareaId);
  const clients = loadClients();
  const c = clients.find(x => x.id === activeClientId);
  if (c) renderClientPage(c);
  if (window.renderTareas) window.renderTareas();
};
