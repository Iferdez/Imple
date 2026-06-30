import { loadClients, loadUsers, saveClients, addActivity } from '../data.js';
import { getVisibleClients, getCurrentUser } from '../auth.js';
import { daysRemaining, estadoBadge, tipoBadge, avatarEl, daysBadge, formatDateAR } from '../utils.js';
import { ESTADOS_CLIENTE } from '../domain/constants.js';

function sortIcon(col) {
  const sortCol = window.currentSortCol || 'nombre';
  const sortDir = window.currentSortDir || 'asc';
  if (sortCol === col) {
    if (sortDir === 'asc') {
      return `<i class="fa-solid fa-caret-up" style="margin-left: 6px; color: var(--primary-light);"></i>`;
    } else {
      return `<i class="fa-solid fa-caret-down" style="margin-left: 6px; color: var(--primary-light);"></i>`;
    }
  }
  return `<i class="fa-solid fa-sort" style="margin-left: 6px; opacity: 0.3; font-size: 11px;"></i>`;
}

export function renderTable() {
  const allClients = loadClients();
  const vc = getVisibleClients(allClients);
  const activeUser = getCurrentUser();
  const isLeader = activeUser && activeUser.role === 'lider';

  // Render sortable thead dynamically
  const thead = document.getElementById('clients-thead');
  if (thead) {
    thead.innerHTML = `
      <tr>
        <th class="col-checkbox leader-only" style="width: 40px; text-align: center; vertical-align: middle;">
          <input type="checkbox" id="select-all-clients" onchange="window.toggleSelectAllClients(this.checked)">
        </th>
        <th class="sortable" onclick="window.sortClients('nombre')">
          Nombre del Cliente / Notas ${sortIcon('nombre')}
        </th>
        <th class="sortable" onclick="window.sortClients('tipo')">
          Tipo de Servicio ${sortIcon('tipo')}
        </th>
        <th class="sortable" onclick="window.sortClients('asignado')">
          Responsable Asignado ${sortIcon('asignado')}
        </th>
        <th class="sortable" onclick="window.sortClients('estado')">
          Estado del Embudo ${sortIcon('estado')}
        </th>
        <th class="sortable" onclick="window.sortClients('arranque')">
          Arranque ${sortIcon('arranque')}
        </th>
        <th class="sortable text-right" onclick="window.sortClients('dias')">
          Días Restantes ${sortIcon('dias')}
        </th>
        <th class="col-actions leader-only" style="width: 90px; text-align: center; vertical-align: middle;">Acciones</th>
      </tr>
    `;
  }

  const searchEl = document.getElementById('search-input');
  const estadoEl = document.getElementById('filter-estado');
  const tipoEl = document.getElementById('filter-tipo');
  const asignadoEl = document.getElementById('filter-asignado');

  const search = (searchEl?.value || '').toLowerCase().trim();
  const estado = estadoEl?.value || '';
  const tipo = tipoEl?.value || '';
  const asignado = asignadoEl?.value || '';

  const filtered = vc.filter(c => {
    if (search && !c.nombre.toLowerCase().includes(search) && !(c.notas || '').toLowerCase().includes(search)) {
      return false;
    }
    if (estado && c.estado !== estado) return false;
    if (tipo && !(c.tipo || '').includes(tipo)) return false;
    if (asignado && !(c.asignado || '').includes(asignado) && !(c.asignadoSecundario || '').includes(asignado)) return false;
    return true;
  });

  // Apply sorting
  const sortCol = window.currentSortCol || 'nombre';
  const sortDir = window.currentSortDir || 'asc';

  filtered.sort((a, b) => {
    let valA = '';
    let valB = '';

    if (sortCol === 'nombre') {
      valA = (a.nombre || '').toLowerCase();
      valB = (b.nombre || '').toLowerCase();
    } else if (sortCol === 'tipo') {
      valA = (a.tipo || '').toLowerCase();
      valB = (b.tipo || '').toLowerCase();
    } else if (sortCol === 'asignado') {
      valA = (a.asignado || '').toLowerCase();
      valB = (b.asignado || '').toLowerCase();
    } else if (sortCol === 'estado') {
      valA = ESTADOS_CLIENTE.indexOf(a.estado) + 1;
      valB = ESTADOS_CLIENTE.indexOf(b.estado) + 1;
    } else if (sortCol === 'arranque') {
      const dateA = a.arranque ? new Date(a.arranque) : null;
      const dateB = b.arranque ? new Date(b.arranque) : null;
      if (dateA === null && dateB === null) return 0;
      if (dateA === null) return 1;
      if (dateB === null) return -1;
      valA = dateA.getTime();
      valB = dateB.getTime();
    } else if (sortCol === 'dias') {
      valA = daysRemaining(a.arranque);
      valB = daysRemaining(b.arranque);
      if (valA === null && valB === null) return 0;
      if (valA === null) return 1;
      if (valB === null) return -1;
    }

    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const tbody = document.getElementById('clients-tbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 48px;">
          <i class="fa-solid fa-folder-open" style="font-size: 32px; opacity: 0.3; display: block; margin-bottom: 12px;"></i>
          No se encontraron clientes con los filtros aplicados.
        </td>
      </tr>
    `;
    return;
  }

  const users = loadUsers();
  const implementers = users.filter(u => u.role !== 'lider');

  tbody.innerHTML = filtered.map(c => {
    const days = daysRemaining(c.arranque);
    const isSelected = window.selectedClientIds && window.selectedClientIds.includes(c.id);
    const isEditing = window.editingClientId === c.id;
    
    const dateStr = formatDateAR(c.arranque);
    
    const checkboxHtml = `
      <td class="col-checkbox leader-only" onclick="event.stopPropagation()" style="text-align: center; vertical-align: middle;">
        <input type="checkbox" class="client-select-chk" data-id="${c.id}" ${isSelected ? 'checked' : ''} onchange="window.toggleClientSelect(${c.id}, this.checked)">
      </td>
    `;

    if (isEditing) {
      return `
        <tr class="selected inline-editing-row">
          ${checkboxHtml}
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <input type="text" id="inline-nombre-${c.id}" class="inline-edit-input" value="${c.nombre}" placeholder="Nombre...">
              <input type="text" id="inline-notas-${c.id}" class="inline-edit-sub-input" value="${c.notas || ''}" placeholder="Notas/Comentario...">
            </div>
          </td>
          <td>
            <select id="inline-tipo-${c.id}" class="inline-edit-select">
              <option value="Frigo" ${c.tipo === 'Frigo' ? 'selected' : ''}>Frigo</option>
              <option value="Ciclo II" ${c.tipo === 'Ciclo II' ? 'selected' : ''}>Ciclo II</option>
              <option value="Carniceria" ${c.tipo === 'Carniceria' ? 'selected' : ''}>Carnicería</option>
              <option value="Usuario" ${c.tipo === 'Usuario' ? 'selected' : ''}>Usuario</option>
              <option value="Admin" ${c.tipo === 'Admin' ? 'selected' : ''}>Admin</option>
              <option value="Frigo + Carni" ${c.tipo === 'Frigo + Carni' ? 'selected' : ''}>Frigo + Carni</option>
              <option value="Ciclo II + Carni" ${c.tipo === 'Ciclo II + Carni' ? 'selected' : ''}>Ciclo II + Carni</option>
              <option value="Todo" ${c.tipo === 'Todo' ? 'selected' : ''}>Todo</option>
            </select>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <select id="inline-asignado-${c.id}" class="inline-edit-select" title="Responsable Principal">
                <option value="" ${!c.asignado ? 'selected' : ''}>Sin Asignar</option>
                ${implementers.map(u => `<option value="${u.username}" ${c.asignado === u.username ? 'selected' : ''}>${u.username}</option>`).join('')}
              </select>
              <select id="inline-asignado-secundario-${c.id}" class="inline-edit-select" style="font-size: 11px; padding: 4px 20px 4px 8px; margin-top: 4px;" title="Responsable Secundario">
                <option value="" ${!c.asignadoSecundario ? 'selected' : ''}>Secundario: Ninguno</option>
                ${implementers.map(u => `<option value="${u.username}" ${c.asignadoSecundario === u.username ? 'selected' : ''}>Secundario: ${u.username}</option>`).join('')}
              </select>
            </div>
          </td>
          <td>
            <select id="inline-estado-${c.id}" class="inline-edit-select">
              <option value="Solicitar Info" ${c.estado === 'Solicitar Info' ? 'selected' : ''}>Solicitar Info</option>
              <option value="Armado de Base" ${c.estado === 'Armado de Base' ? 'selected' : ''}>Armado de Base</option>
              <option value="Instalacion" ${c.estado === 'Instalacion' ? 'selected' : ''}>Instalación</option>
              <option value="Capacitacion" ${c.estado === 'Capacitacion' ? 'selected' : ''}>Capacitación</option>
              <option value="Iniciado" ${c.estado === 'Iniciado' ? 'selected' : ''}>Iniciado</option>
            </select>
          </td>
          <td>
            <input type="date" id="inline-arranque-${c.id}" class="inline-edit-date" value="${c.arranque || ''}">
          </td>
          <td class="text-right">${daysBadge(days)}</td>
          <td class="col-actions leader-only" onclick="event.stopPropagation()" style="text-align: center; vertical-align: middle; white-space: nowrap;">
            <button class="btn btn-primary btn-icon-sm" onclick="window.saveInlineEdit(${c.id})" title="Guardar cambios">
              <i class="fa-solid fa-check"></i>
            </button>
            <button class="btn btn-secondary btn-icon-sm" onclick="window.cancelInlineEdit()" title="Cancelar" style="margin-left: 4px;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </td>
        </tr>
      `;
    } else {
      const mainHtml = c.asignado
        ? `<div style="display: flex; align-items: center; gap: 8px;">
             ${avatarEl(c.asignado)}
             <span style="font-weight: 500;">${c.asignado}</span>
           </div>`
        : `<span style="color: var(--text-muted); font-style: italic;">Sin asignar</span>`;

      const secHtml = c.asignadoSecundario
        ? `<div style="display: flex; align-items: center; gap: 8px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px;">
             ${avatarEl(c.asignadoSecundario)}
             <span style="font-size: 11px; color: var(--text-secondary); font-weight: 500;">Sec: ${c.asignadoSecundario}</span>
           </div>`
        : '';

      const assigneeHtml = `<div>${mainHtml}${secHtml}</div>`;

      return `
        <tr onclick="window.openDetail(${c.id})" class="${isSelected ? 'selected' : ''}">
          ${checkboxHtml}
          <td>
            <div class="client-name-cell">
              <span class="name">${c.nombre}</span>
              ${c.notas ? `<span class="notes-sub" title="${c.notes || c.notas}"><i class="fa-solid fa-comment-dots" style="margin-right: 4px;"></i>${c.notas}</span>` : ''}
            </div>
          </td>
          <td>${tipoBadge(c.tipo)}</td>
          <td style="white-space: nowrap;">${assigneeHtml}</td>
          <td>
            ${estadoBadge(c.estado)}
            ${c.estado === 'Iniciado' && c.soporte ? `<span class="badge badge-blue" style="margin-left: 4px;"><i class="fa-solid fa-headset"></i> Soporte</span>` : ''}
          </td>
          <td style="font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary); white-space: nowrap;">${dateStr}</td>
          <td class="text-right">${daysBadge(days)}</td>
          <td class="col-actions leader-only" onclick="event.stopPropagation()" style="text-align: center; vertical-align: middle;">
            <button class="btn btn-secondary btn-icon-sm" onclick="window.startInlineEdit(${c.id})" title="Editar en línea">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
          </td>
        </tr>
      `;
    }
  }).join('');

  // Save current filtered list in window so toggleSelectAll can read it
  window.currentFilteredClientIds = filtered.map(c => c.id);
  
  // Update bulk bar UI
  updateBulkBar();
}

// Dynamically populates filters and selection dropdowns based on the users database
export function populateUsersDropdowns() {
  const users = loadUsers();
  const me = getCurrentUser();
  const implementers = users.filter(u => {
    if (u.role === 'lider') return false;
    // Líderes only see their own implementadores in dropdowns
    if (me && me.role === 'lider') return u.lider === me.username;
    return true;
  });

  // 1. Client filter bar dropdown
  const filterAsignado = document.getElementById('filter-asignado');
  if (filterAsignado) {
    const currentVal = filterAsignado.value;
    filterAsignado.innerHTML = `
      <option value="">Todos los asignados</option>
      ${implementers.map(u => `<option value="${u.username}">${u.username}</option>`).join('')}
    `;
    filterAsignado.value = currentVal;
  }

  // 2. Add client modal dropdowns
  const newAsignado = document.getElementById('new-asignado');
  if (newAsignado) {
    newAsignado.innerHTML = `
      <option value="">Sin Asignar</option>
      ${implementers.map(u => `<option value="${u.username}">${u.username}</option>`).join('')}
    `;
  }

  const newAsignadoSecundario = document.getElementById('new-asignado-secundario');
  if (newAsignadoSecundario) {
    newAsignadoSecundario.innerHTML = `
      <option value="">Ninguno</option>
      ${implementers.map(u => `<option value="${u.username}">${u.username}</option>`).join('')}
    `;
  }

  // 3. Bulk edit bar dropdowns
  const bulkAsignado = document.getElementById('bulk-asignado');
  if (bulkAsignado) {
    bulkAsignado.innerHTML = `
      <option value="">(Sin cambios)</option>
      <option value="UNASSIGN">(Desasignar)</option>
      ${implementers.map(u => `<option value="${u.username}">${u.username}</option>`).join('')}
    `;
  }

  const bulkAsignadoSecundario = document.getElementById('bulk-asignado-secundario');
  if (bulkAsignadoSecundario) {
    bulkAsignadoSecundario.innerHTML = `
      <option value="">(Sin cambios)</option>
      <option value="UNASSIGN">(Desasignar)</option>
      ${implementers.map(u => `<option value="${u.username}">${u.username}</option>`).join('')}
    `;
  }
}

// --- Bulk Selection & Edit States and Actions ---
window.selectedClientIds = window.selectedClientIds || [];
window.currentFilteredClientIds = [];

window.toggleClientSelect = function(id, checked) {
  window.selectedClientIds = window.selectedClientIds || [];
  if (checked) {
    if (!window.selectedClientIds.includes(id)) {
      window.selectedClientIds.push(id);
    }
  } else {
    window.selectedClientIds = window.selectedClientIds.filter(x => x !== id);
  }
  
  const rows = document.querySelectorAll('#clients-tbody tr');
  rows.forEach(row => {
    const chk = row.querySelector('.client-select-chk');
    if (chk && parseInt(chk.getAttribute('data-id'), 10) === id) {
      if (checked) {
        row.classList.add('selected');
      } else {
        row.classList.remove('selected');
      }
    }
  });

  updateBulkBar();
};

window.toggleSelectAllClients = function(checked) {
  window.selectedClientIds = window.selectedClientIds || [];
  const ids = window.currentFilteredClientIds || [];
  
  if (checked) {
    ids.forEach(id => {
      if (!window.selectedClientIds.includes(id)) {
        window.selectedClientIds.push(id);
      }
    });
  } else {
    window.selectedClientIds = window.selectedClientIds.filter(id => !ids.includes(id));
  }

  const rows = document.querySelectorAll('#clients-tbody tr');
  rows.forEach(row => {
    const chk = row.querySelector('.client-select-chk');
    if (chk) {
      const id = parseInt(chk.getAttribute('data-id'), 10);
      if (ids.includes(id)) {
        chk.checked = checked;
        if (checked) {
          row.classList.add('selected');
        } else {
          row.classList.remove('selected');
        }
      }
    }
  });

  updateBulkBar();
};

window.clearSelection = function() {
  window.selectedClientIds = [];
  window.editingClientId = null; // Also cancel any active inline edit
  
  const selectAllChk = document.getElementById('select-all-clients');
  if (selectAllChk) selectAllChk.checked = false;

  const checkboxes = document.querySelectorAll('.client-select-chk');
  checkboxes.forEach(chk => chk.checked = false);

  const rows = document.querySelectorAll('#clients-tbody tr');
  rows.forEach(row => row.classList.remove('selected'));

  updateBulkBar();
};

export function updateBulkBar() {
  const bar = document.getElementById('bulk-edit-bar');
  const countText = document.getElementById('bulk-count-text');
  if (!bar || !countText) return;

  const count = window.selectedClientIds ? window.selectedClientIds.length : 0;
  if (count > 0) {
    countText.textContent = `${count} seleccionado${count !== 1 ? 's' : ''}`;
    bar.classList.add('active');
  } else {
    bar.classList.remove('active');
  }

  const selectAllChk = document.getElementById('select-all-clients');
  if (selectAllChk) {
    const tableChecks = document.querySelectorAll('.client-select-chk');
    if (tableChecks.length > 0) {
      const allChecked = Array.from(tableChecks).every(chk => chk.checked);
      selectAllChk.checked = allChecked;
    } else {
      selectAllChk.checked = false;
    }
  }
}

window.applyBulkEdit = function() {
  const selectedIds = window.selectedClientIds || [];
  if (selectedIds.length === 0) {
    if (window.showEmergentNotification) {
      window.showEmergentNotification('No hay clientes seleccionados.', 'warning');
    } else {
      alert('No hay clientes seleccionados.');
    }
    return;
  }

  const bulkTipo = document.getElementById('bulk-tipo')?.value || '';
  const bulkAsignado = document.getElementById('bulk-asignado')?.value || '';
  const bulkAsignadoSec = document.getElementById('bulk-asignado-secundario')?.value || '';
  const bulkEstado = document.getElementById('bulk-estado')?.value || '';

  if (!bulkTipo && !bulkAsignado && !bulkAsignadoSec && !bulkEstado) {
    if (window.showEmergentNotification) {
      window.showEmergentNotification('Por favor selecciona al menos un campo para actualizar.', 'warning');
    } else {
      alert('Por favor selecciona al menos un campo para actualizar.');
    }
    return;
  }

  if (!confirm(`¿Aplicar los cambios a los ${selectedIds.length} clientes seleccionados?`)) {
    return;
  }

  const allClients = loadClients();
  let updatedCount = 0;

  allClients.forEach(c => {
    if (selectedIds.includes(c.id)) {
      if (bulkTipo) c.tipo = bulkTipo;
      if (bulkAsignado) {
        c.asignado = bulkAsignado === 'UNASSIGN' ? '' : bulkAsignado;
      }
      if (bulkAsignadoSec) {
        c.asignadoSecundario = bulkAsignadoSec === 'UNASSIGN' ? '' : bulkAsignadoSec;
      }
      if (bulkEstado && bulkEstado !== c.estado) {
        const curUserForHistory = getCurrentUser();
        recordStateChange(c, bulkEstado, curUserForHistory ? curUserForHistory.username : '');
        c.estado = bulkEstado;
      }
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    saveClients(allClients);
    
    const curUser = getCurrentUser();
    if (curUser) {
      selectedIds.forEach(id => {
        const c = allClients.find(x => x.id === id);
        if (c) {
          let fields = [];
          if (bulkTipo) fields.push(`tipo a "${bulkTipo}"`);
          if (bulkAsignado) fields.push(`responsable principal a "${bulkAsignado === 'UNASSIGN' ? 'Sin asignar' : bulkAsignado}"`);
          if (bulkAsignadoSec) fields.push(`responsable secundario a "${bulkAsignadoSec === 'UNASSIGN' ? 'Sin asignar' : bulkAsignadoSec}"`);
          if (bulkEstado) fields.push(`estado a "${bulkEstado}"`);
          
          addActivity(curUser.username, c.id, c.nombre, 'bulk_edit', `Realizó una edición masiva: actualizó ${fields.join(', ')}`);
        }
      });
    }

    window.clearSelection();
    renderTable();
    if (window.renderAll) {
      window.renderAll();
    }

    const tSelect = document.getElementById('bulk-tipo');
    if (tSelect) tSelect.value = '';
    const aSelect = document.getElementById('bulk-asignado');
    if (aSelect) aSelect.value = '';
    const aSecSelect = document.getElementById('bulk-asignado-secundario');
    if (aSecSelect) aSecSelect.value = '';
    const eSelect = document.getElementById('bulk-estado');
    if (eSelect) eSelect.value = '';

    if (window.showEmergentNotification) {
      window.showEmergentNotification(`Se actualizaron correctamente ${updatedCount} clientes.`);
    } else {
      alert(`Se actualizaron correctamente ${updatedCount} clientes.`);
    }
  } else {
    if (window.showEmergentNotification) {
      window.showEmergentNotification('No se pudo actualizar ningún cliente.', 'error');
    } else {
      alert('No se pudo actualizar ningún cliente.');
    }
  }
};

// --- Inline Editing State and Actions ---
window.editingClientId = null;

window.startInlineEdit = function(id) {
  window.editingClientId = id;
  renderTable();
};

window.cancelInlineEdit = function() {
  window.editingClientId = null;
  renderTable();
};

window.saveInlineEdit = function(id) {
  const nombreInput = document.getElementById(`inline-nombre-${id}`);
  const nombre = nombreInput ? nombreInput.value.trim() : '';
  if (!nombre) {
    if (window.showEmergentNotification) {
      window.showEmergentNotification('El nombre del cliente no puede estar vacío.', 'warning');
    } else {
      alert('El nombre del cliente no puede estar vacío.');
    }
    if (nombreInput) nombreInput.focus();
    return;
  }

  const notas = document.getElementById(`inline-notas-${id}`)?.value || '';
  const tipo = document.getElementById(`inline-tipo-${id}`)?.value || '';
  const asignado = document.getElementById(`inline-asignado-${id}`)?.value || '';
  const asignadoSecundario = document.getElementById(`inline-asignado-secundario-${id}`)?.value || '';
  const estado = document.getElementById(`inline-estado-${id}`)?.value || '';
  const arranque = document.getElementById(`inline-arranque-${id}`)?.value || '';

  const allClients = loadClients();
  const c = allClients.find(client => client.id === id);
  if (c) {
    c.nombre = nombre.toUpperCase();
    c.notas = notas;
    c.tipo = tipo;
    c.asignado = asignado;
    c.asignadoSecundario = asignadoSecundario;
    // Record state change before updating
    if (estado !== c.estado) {
      const curUserForHistory = getCurrentUser();
      recordStateChange(c, estado, curUserForHistory ? curUserForHistory.username : '');
    }
    c.estado = estado;
    c.arranque = arranque;

    if (c.estado !== 'Iniciado') {
      c.soporte = false;
    }

    saveClients(allClients);
    
    const curUser = getCurrentUser();
    if (curUser) {
      addActivity(curUser.username, c.id, c.nombre, 'client_edit', 'Actualizó los datos del cliente mediante edición rápida (inline)');
    }

    window.editingClientId = null;
    
    renderTable();
    if (window.renderAll) {
      window.renderAll();
    }
    
    if (window.showEmergentNotification) {
      window.showEmergentNotification(`Se realizaron los cambios en ${c.nombre} con éxito.`);
    } else {
      alert(`Se guardaron los cambios del cliente ${c.nombre} correctamente.`);
    }
  } else {
    if (window.showEmergentNotification) {
      window.showEmergentNotification('No se pudo encontrar el cliente a guardar.', 'error');
    } else {
      alert('No se pudo encontrar el cliente a guardar.');
    }
  }
};

window.renderTable = renderTable;

window.currentSortCol = 'nombre';
window.currentSortDir = 'asc';

window.sortClients = function(colName) {
  if (window.currentSortCol === colName) {
    window.currentSortDir = window.currentSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    window.currentSortCol = colName;
    window.currentSortDir = 'asc';
  }
  renderTable();
};

// Click outside to cancel inline edit
document.addEventListener('click', (e) => {
  if (window.editingClientId === null || window.editingClientId === undefined) return;
  const activeRow = document.querySelector('.inline-editing-row');
  if (activeRow && !activeRow.contains(e.target)) {
    window.cancelInlineEdit();
  }
});
