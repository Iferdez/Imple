import { loadClients, saveClients, loadUsers, addActivity, recordStateChange } from '../data.js';
import { getVisibleClients, getCurrentUser } from '../auth.js';
import { daysRemaining, shortName, daysBadge, avatarClass, AVATAR_HEX_PALETTE } from '../utils.js';

export function renderKanban() {
  const allClients = loadClients();
  const vc = getVisibleClients(allClients);
  const user = getCurrentUser();
  const isLeader = user && (user.role === 'lider');

  const mode = window.kanbanGroupBy || 'estado';

  // Sync active toggle button classes
  const btnEstado = document.getElementById('kanban-toggle-estado');
  const btnAsignado = document.getElementById('kanban-toggle-asignado');
  if (btnEstado && btnAsignado) {
    if (mode === 'estado') {
      btnEstado.classList.add('btn-primary', 'active');
      btnEstado.classList.remove('btn-secondary');
      btnAsignado.classList.add('btn-secondary');
      btnAsignado.classList.remove('btn-primary', 'active');
    } else {
      btnAsignado.classList.add('btn-primary', 'active');
      btnAsignado.classList.remove('btn-secondary');
      btnEstado.classList.add('btn-secondary');
      btnEstado.classList.remove('btn-primary', 'active');
    }
  }

  let cols = [];

  if (mode === 'estado') {
    cols = [
      { key: 'Solicitar Info', label: 'Solicitar Info', color: '#78450a', bg: '#fef3c7' },
      { key: 'Armado de Base', label: 'Armado de Base', color: '#4c1d95', bg: '#ede9fe' },
      { key: 'Instalacion',   label: 'Instalación',    color: '#374151', bg: '#e5e5e5' },
      { key: 'Capacitacion',  label: 'Capacitación',   color: '#1e3a8a', bg: '#dbeafe' },
      { key: 'Iniciado',      label: 'Iniciado',       color: '#0d5e37', bg: '#d4f0e3' },
    ];
  } else {
    // Solo columnas de los implementadores visibles para el usuario actual
    // (si es líder: los de su equipo; si es implementador: nadie más que
    // los que también ve en sus clientes). Antes se listaban TODOS los
    // implementadores del sistema, lo que enterraba las cards del propio
    // equipo entre muchas columnas vacías de otros equipos.
    const visibleUsernames = new Set();
    vc.forEach(c => {
      if (c.asignado) visibleUsernames.add(c.asignado);
      if (c.asignadoSecundario) visibleUsernames.add(c.asignadoSecundario);
    });

    const allImplementers = loadUsers().filter(u => u.role !== 'lider');
    const implementers = isLeader
      ? allImplementers.filter(u => visibleUsernames.has(u.username))
      : allImplementers.filter(u => u.username === user.username);

    cols = implementers.map(u => {
      const palette = AVATAR_HEX_PALETTE[avatarClass(u.username)] || AVATAR_HEX_PALETTE['av-default'];
      return {
        key: u.username,
        label: u.displayName || u.username,
        color: palette.color,
        bg: palette.bg
      };
    });

    // Ordenar alfabéticamente por label para que sea predecible
    cols.sort((a, b) => a.label.localeCompare(b.label));

    cols.push({
      key: 'UNASSIGNED',
      label: 'Sin Asignar',
      color: '#475569',
      bg: '#f1f5f9'
    });
  }

  const board = document.getElementById('kanban-board');
  if (!board) return;

  board.innerHTML = cols.map(col => {
    let items = [];
    if (mode === 'estado') {
      items = vc.filter(c => c.estado === col.key);
    } else {
      if (col.key === 'UNASSIGNED') {
        items = vc.filter(c => !c.asignado);
      } else {
        items = vc.filter(c => c.asignado === col.key);
      }
    }
    
    const cardsHtml = items.map(c => {
      const days = daysRemaining(c.arranque);
      const isDraggable = isLeader ? 'draggable="true"' : '';
      
      let metaBadgeHtml = '';
      if (mode === 'estado') {
        metaBadgeHtml += c.tipo ? `<span class="badge badge-gray" style="font-size: 10px; padding: 2px 6px;">${c.tipo}</span>` : '';
        if (c.estado === 'Iniciado' && c.soporte) {
          metaBadgeHtml += `<span class="badge badge-blue" style="font-size: 10px; padding: 2px 6px;"><i class="fa-solid fa-headset" style="margin-right: 4px;"></i>Soporte</span>`;
        }
        metaBadgeHtml += c.asignado ? `<span style="display: inline-flex; align-items: center; gap: 4px;" title="Responsable Principal"><i class="fa-solid fa-user" style="font-size: 9px;"></i>${c.asignado}</span>` : '';
        metaBadgeHtml += c.asignadoSecundario ? `<span style="display: inline-flex; align-items: center; gap: 4px; color: var(--text-secondary);" title="Responsable Secundario"><i class="fa-solid fa-user-group" style="font-size: 9px;"></i>${c.asignadoSecundario}</span>` : '';
      } else {
        metaBadgeHtml += c.tipo ? `<span class="badge badge-gray" style="font-size: 10px; padding: 2px 6px;">${c.tipo}</span>` : '';
        const stateLabel = c.estado || 'Sin Estado';
        metaBadgeHtml += `<span class="badge badge-gray" style="font-size: 10px; padding: 2px 6px;">${stateLabel}</span>`;
        if (c.estado === 'Iniciado' && c.soporte) {
          metaBadgeHtml += `<span class="badge badge-blue" style="font-size: 10px; padding: 2px 6px;"><i class="fa-solid fa-headset" style="margin-right: 4px;"></i>Soporte</span>`;
        }
        metaBadgeHtml += c.asignadoSecundario ? `<span style="display: inline-flex; align-items: center; gap: 4px; color: var(--text-secondary);" title="Responsable Secundario"><i class="fa-solid fa-user-group" style="font-size: 9px;"></i>${c.asignadoSecundario}</span>` : '';
      }

      return `
        <div class="kanban-card" ${isDraggable} data-id="${c.id}" onclick="window.openDetail(${c.id})">
          <div class="kanban-card-name">${shortName(c.nombre)}</div>
          <div class="kanban-card-meta">
            ${metaBadgeHtml}
          </div>
          ${c.arranque ? `<div style="margin-top: 10px; display: flex; justify-content: flex-end;">${daysBadge(days)}</div>` : ''}
        </div>
      `;
    }).join('');

    const emptyHtml = items.length === 0
      ? `<div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 32px 0; font-style: italic;">
          <i class="fa-solid fa-box-open" style="font-size: 18px; display: block; margin-bottom: 6px; opacity: 0.4;"></i>
          Vacío
         </div>`
      : '';

    return `
      <div class="kanban-col" data-colkey="${col.key}">
        <div class="kanban-header" style="background: ${col.bg}; color: ${col.color}">
          <span>${col.label}</span>
          <span class="count-badge">${items.length}</span>
        </div>
        <div class="kanban-body">
          ${cardsHtml}
          ${emptyHtml}
        </div>
      </div>
    `;
  }).join('');

  if (isLeader) {
    setupDragAndDrop();
  }
}

function setupDragAndDrop() {
  const cards = document.querySelectorAll('.kanban-card');
  const columns = document.querySelectorAll('.kanban-col');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', card.getAttribute('data-id'));
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  });

  columns.forEach(col => {
    const body = col.querySelector('.kanban-body');
    const colKey = col.getAttribute('data-colkey');

    body.addEventListener('dragover', (e) => {
      e.preventDefault();
      body.classList.add('drag-over');
    });

    body.addEventListener('dragleave', () => {
      body.classList.remove('drag-over');
    });

    body.addEventListener('drop', (e) => {
      e.preventDefault();
      body.classList.remove('drag-over');
      
      const clientIdStr = e.dataTransfer.getData('text/plain');
      const clientId = parseInt(clientIdStr, 10);
      if (isNaN(clientId)) return;

      const allClients = loadClients();
      const client = allClients.find(c => c.id === clientId);
      
      if (client) {
        const mode = window.kanbanGroupBy || 'estado';
        const curUser = getCurrentUser();
        
        if (mode === 'estado') {
          if (client.estado !== colKey) {
            recordStateChange(client, colKey, curUser ? curUser.username : '');
            client.estado = colKey;
            if (colKey !== 'Iniciado') {
              client.soporte = false;
            } else if (client.soporte === undefined) {
              client.soporte = false;
            }
            saveClients(allClients);
            
            if (curUser) {
              addActivity(curUser.username, client.id, client.nombre, 'client_edit', `Cambió el estado a "${colKey || 'Sin estado'}" vía Kanban`);
            }

            renderKanban();
            if (window.renderAll) {
              window.renderAll();
            }
          }
        } else {
          const newAssignee = colKey === 'UNASSIGNED' ? '' : colKey;
          if (client.asignado !== newAssignee) {
            client.asignado = newAssignee;
            saveClients(allClients);
            
            if (curUser) {
              addActivity(curUser.username, client.id, client.nombre, 'client_edit', `Reasignó el responsable principal a "${newAssignee || 'Sin asignar'}" vía Kanban`);
            }

            renderKanban();
            if (window.renderAll) {
              window.renderAll();
            }
          }
        }
      }
    });
  });
}

// Global state and actions for Kanban
window.kanbanGroupBy = 'estado';

window.setKanbanGroupBy = function(mode) {
  window.kanbanGroupBy = mode;
  renderKanban();
};
