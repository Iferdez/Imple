import { loadClients, saveClients, addActivity, recordStateChange } from '../data.js';
import { getCurrentUser } from '../auth.js';
import { daysRemaining } from '../utils.js';
import { ESTADOS_CLIENTE } from '../domain/constants.js';

export function renderSeguimiento() {
  const container = document.getElementById('seguimiento-list-container');
  const statsContainer = document.getElementById('seguimiento-stats-banner');
  if (!container || !statsContainer) return; // not on page or element not loaded yet

  const clients = loadClients();
  // Filter active clients: must have a state and not be completed and sent to support
  // Active states: any state in our funnel. We exclude support-completed clients.
  const activeClients = clients.filter(c => c.estado && !(c.estado === 'Iniciado' && c.soporte));

  // --- Calculate Metrics ---
  const totalCount = activeClients.length;
  let progressSum = 0;
  let criticalCount = 0;

  activeClients.forEach(c => {
    const tasks = c.tasks || [];
    const totalTasks = tasks.length;
    const resolvedTasks = tasks.filter(t => t.status === 'Resuelto').length;
    const progress = totalTasks > 0 ? (resolvedTasks / totalTasks) * 100 : 0;
    progressSum += progress;

    // Critical conditions
    const days = daysRemaining(c.arranque);
    if (days !== null) {
      if (days < 0 && c.estado !== 'Iniciado') {
        criticalCount++; // Overdue startup and not finished
      } else if (days >= 0 && days <= 7 && progress < 50) {
        criticalCount++; // Startup is soon, but progress is low
      }
    }
  });

  const avgProgress = totalCount > 0 ? Math.round(progressSum / totalCount) : 0;

  // Render Stats Banner
  statsContainer.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon-wrapper bg-primary-light">
        <i class="fa-solid fa-list-check color-primary"></i>
      </div>
      <div class="stat-info">
        <span class="stat-num">${totalCount}</span>
        <span class="stat-lbl">Proyectos Activos</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrapper bg-green-light">
        <i class="fa-solid fa-chart-line color-green"></i>
      </div>
      <div class="stat-info">
        <span class="stat-num">${avgProgress}%</span>
        <span class="stat-lbl">Progreso Promedio</span>
      </div>
    </div>
    <div class="stat-card ${criticalCount > 0 ? 'stat-critical-alert' : ''}">
      <div class="stat-icon-wrapper bg-red-light">
        <i class="fa-solid fa-triangle-exclamation color-red"></i>
      </div>
      <div class="stat-info">
        <span class="stat-num">${criticalCount}</span>
        <span class="stat-lbl">Implementaciones Críticas</span>
      </div>
    </div>
  `;

  // Render Clients Cards List
  if (totalCount === 0) {
    container.innerHTML = `
      <div class="card-wrap" style="padding: 48px; text-align: center; color: var(--text-muted);">
        <i class="fa-solid fa-clipboard-check" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px;"></i>
        <p style="font-size: 15px; font-weight: 500;">No hay implementaciones activas en este momento.</p>
        <p style="font-size: 13px; margin-top: 4px;">Todos los clientes están finalizados (Soporte) o sin estado asignado.</p>
      </div>
    `;
    return;
  }

  // Funnel states list for stepper
  const STAGES = ESTADOS_CLIENTE;
  const STAGES_PRETTY = {
    'Solicitar Info': 'Solicitar Info',
    'Armado de Base': 'Armado de Base',
    'Instalacion': 'Instalación',
    'Capacitacion': 'Capacitación',
    'Iniciado': 'Iniciado'
  };

  container.innerHTML = activeClients.map(c => {
    const tasks = c.tasks || [];
    const totalTasks = tasks.length;
    const resolvedTasks = tasks.filter(t => t.status === 'Resuelto').length;
    const progress = totalTasks > 0 ? Math.round((resolvedTasks / totalTasks) * 100) : 0;
    const days = daysRemaining(c.arranque);

    // Calculate critical alerts
    let isCritical = false;
    let criticalReason = '';
    let arranqueClass = 'neutral';
    let arranqueText = 'Sin fecha';

    if (c.arranque) {
      const parts = c.arranque.split('-');
      if (parts.length === 3) {
        arranqueText = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

    if (days !== null) {
      if (days < 0 && c.estado !== 'Iniciado') {
        isCritical = true;
        criticalReason = 'Arranque Vencido';
        arranqueClass = 'critical-overdue';
      } else if (days >= 0 && days <= 7) {
        if (progress < 50) {
          isCritical = true;
          criticalReason = 'Riesgo: Avance < 50%';
        }
        arranqueClass = 'critical-soon';
      } else {
        arranqueClass = 'on-track';
      }
    }

    // Current stage index in funnel
    const currentStageIdx = STAGES.indexOf(c.estado);

    // Stepper HTML builder
    const stepperHtml = STAGES.map((stage, idx) => {
      let stepClass = '';
      if (idx < currentStageIdx) stepClass = 'completed';
      else if (idx === currentStageIdx) stepClass = 'active';
      
      const lineHtml = idx < STAGES.length - 1 
        ? `<div class="step-line ${idx < currentStageIdx ? 'completed' : ''}"></div>`
        : '';

      return `
        <div class="step-wrapper">
          <div class="step ${stepClass}" title="Etapa: ${STAGES_PRETTY[stage]}">
            <span class="step-dot"></span>
            <span class="step-label">${STAGES_PRETTY[stage]}</span>
          </div>
        </div>
        ${lineHtml}
      `;
    }).join('');

    // Avatar initials for Assignee
    const assigneeInitial = c.asignado ? c.asignado.charAt(0).toUpperCase() : '?';
    const secInitial = c.asignadoSecundario ? c.asignadoSecundario.charAt(0).toUpperCase() : null;

    return `
      <div class="client-progress-card">
        ${isCritical ? `
          <span class="critical-badge">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>${criticalReason}</span>
          </span>
        ` : ''}

        <div class="progress-card-header">
          <div class="client-info-wrap">
            <h3 class="client-name-link" onclick="window.openDetail(${c.id})">${c.nombre}</h3>
            <div class="client-badges">
              ${c.tipo ? `<span class="badge badge-gray">${c.tipo}</span>` : ''}
              ${c.soporte ? `<span class="badge badge-blue"><i class="fa-solid fa-headset"></i> Soporte</span>` : ''}
            </div>
          </div>

          <div class="assignee-avatar-wrapper">
            <div style="display:flex; align-items:center; gap:6px;">
              <div class="assignee-avatar" title="Responsable Principal: ${c.asignado || 'Sin Asignar'}">${assigneeInitial}</div>
              ${c.asignadoSecundario ? `<div class="assignee-avatar" style="width:28px;height:28px;font-size:11px;opacity:0.75;border:2px dashed var(--border);" title="Responsable Secundario: ${c.asignadoSecundario}">${secInitial}</div>` : ''}
            </div>
            <div class="assignee-name">
              ${c.asignado || '<span style="color: var(--text-muted);">Sin Asignar</span>'}
              ${c.asignadoSecundario ? `<span style="font-size:10px;color:var(--text-muted);display:block;">+ ${c.asignadoSecundario}</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Funnel Stepper -->
        <div class="stepper-outer">
          <div class="stepper-container">
            ${stepperHtml}
          </div>
        </div>

        <!-- Task Progress Bar -->
        <div class="progress-bar-section">
          <div class="progress-bar-label-row">
            <span class="progress-bar-title">Progreso de Tareas de Implementación</span>
            <span class="progress-bar-percent">${progress}%</span>
          </div>
          <div class="progress-bar-wrapper">
            <div class="progress-bar-outer">
              <div class="progress-bar-inner" style="width: ${progress}%"></div>
            </div>
          </div>
        </div>

        <!-- Stats details row -->
        <div class="progress-stats-row">
          <div class="stat-detail-item">
            <i class="fa-solid fa-list-check icon-muted"></i>
            <span><b>${resolvedTasks}</b> de <b>${totalTasks}</b> tareas completadas (${totalTasks - resolvedTasks} pendientes)</span>
          </div>
          <div class="stat-detail-item">
            <i class="fa-solid fa-calendar icon-muted"></i>
            <span>Arranque: <span class="arranque-badge ${arranqueClass}">${arranqueText} ${days !== null ? `(${days >= 0 ? `quedan ${days} días` : `vencido hace ${Math.abs(days)} días`})` : ''}</span></span>
          </div>
        </div>

        <!-- Fast actions footer -->
        <div class="progress-card-footer">
          <div class="fast-action-group">
            <label class="fast-label">Mover etapa:</label>
            <div class="select-wrapper select-xs">
              <select class="fast-stage-select" onchange="window.fastChangeStage(${c.id}, this.value)">
                ${STAGES.map(s => `
                  <option value="${s}" ${c.estado === s ? 'selected' : ''}>${STAGES_PRETTY[s]}</option>
                `).join('')}
              </select>
              <i class="fa-solid fa-chevron-down select-arrow"></i>
            </div>
          </div>

          <div class="footer-buttons">
            <button class="btn btn-secondary btn-sm" onclick="window.openDetail(${c.id})" style="display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-folder-open"></i>
              <span>Ver Ficha</span>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.fastGoToKanban()" style="display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-sliders"></i>
              <span>Ir al Kanban</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.renderSeguimiento = renderSeguimiento;

window.fastChangeStage = function(clientId, newStage) {
  const clients = loadClients();
  const c = clients.find(x => x.id === clientId);
  if (!c) return;

  const oldStage = c.estado;
  const curUser = getCurrentUser();
  recordStateChange(c, newStage, curUser ? curUser.username : '');
  c.estado = newStage;
  if (newStage !== 'Iniciado') {
    c.soporte = false;
  }

  saveClients(clients);
  if (curUser && oldStage !== newStage) {
    addActivity(curUser.username, c.id, c.nombre, 'client_edit', `Movió la etapa de implementación a "${newStage}" desde Seguimiento`);
  }

  // Refresh page and all other states
  renderSeguimiento();
  if (window.renderAll) {
    window.renderAll();
  }

  if (window.showEmergentNotification) {
    window.showEmergentNotification(`Etapa de ${c.nombre} cambiada a "${newStage}" con éxito.`);
  }
};

window.fastGoToKanban = function() {
  if (window.showPage) {
    window.showPage('kanban');
  }
};
