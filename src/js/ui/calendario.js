import { loadClients, saveClients, loadUsers, addActivity } from '../data.js';
import { getCurrentUser } from '../auth.js';
import { taskOccursOnDate, taskOverlapsMonth, taskStartDate, taskEndDate, taskRangeLabel, taskType, taskTypeIcon, taskTypeLabel } from '../utils.js';

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let editingTaskState = null; // Stores { clientId, taskIdx } when editing a task from calendar

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function renderCalendar() {
  const container = document.getElementById('calendar-days-grid');
  if (!container) return; // not on calendar page or element not loaded yet

  const titleEl = document.getElementById('calendar-month-year-title');
  if (titleEl) {
    titleEl.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;
  }

  // Populate filter dropdowns if not already populated, maintaining selection
  populateFilterOptions();

  // Load clients and active filters
  const clients = loadClients();
  const filterClienteId = document.getElementById('filter-calendar-cliente').value;
  const filterAsignadoVal = document.getElementById('filter-calendar-asignado').value;

  // --- Calculate counts of tasks for the current month ---
  let totalTasksThisMonth = 0;
  let pendingTasksThisMonth = 0;
  let resolvedTasksThisMonth = 0;

  clients.forEach(c => {
    const tasks = c.tasks || [];
    tasks.forEach(t => {
      if (!taskOverlapsMonth(t, currentYear, currentMonth)) return;
      // Apply current filters to the stats banner counts too
      if (filterClienteId && String(c.id) !== filterClienteId) return;
      if (filterAsignadoVal && t.asignado !== filterAsignadoVal) return;

      totalTasksThisMonth++;
      if (t.status === 'Resuelto') {
        resolvedTasksThisMonth++;
      } else if (t.status !== 'Cancelado') {
        pendingTasksThisMonth++;
      }
    });
  });

  // Inject or update stats banner
  let statsBanner = document.getElementById('calendar-stats-banner');
  if (!statsBanner) {
    statsBanner = document.createElement('div');
    statsBanner.id = 'calendar-stats-banner';
    statsBanner.className = 'calendar-stats-banner';
    const cardWrap = document.querySelector('#page-calendario .card-wrap');
    if (cardWrap) {
      cardWrap.insertBefore(statsBanner, cardWrap.firstChild);
    }
  }

  statsBanner.innerHTML = `
    <div class="stat-card">
      <span class="stat-num">${totalTasksThisMonth}</span>
      <span class="stat-lbl">Tareas este mes</span>
    </div>
    <div class="stat-card stat-pending">
      <span class="stat-num">${pendingTasksThisMonth}</span>
      <span class="stat-lbl">Pendientes / Progreso</span>
    </div>
    <div class="stat-card stat-resolved">
      <span class="stat-num">${resolvedTasksThisMonth}</span>
      <span class="stat-lbl">Resueltas</span>
    </div>
  `;

  // Clear previous grid contents
  container.innerHTML = '';

  // Calculate dates in month
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // Sunday = 0, Monday = 1...
  // Adjust so Monday = 0, Sunday = 6
  let startOffset = firstDayIndex - 1;
  if (startOffset < 0) startOffset = 6;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const cells = [];

  // 1. Previous month days (faded)
  for (let i = startOffset - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const m = currentMonth === 0 ? 11 : currentMonth - 1;
    const y = currentMonth === 0 ? currentYear - 1 : currentYear;
    cells.push({ dayNum, month: m, year: y, isCurrentMonth: false });
  }

  // 2. Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ dayNum: i, month: currentMonth, year: currentYear, isCurrentMonth: true });
  }

  // 3. Next month days (faded) to pad grid to multiples of 7
  const totalCellsNeeded = cells.length <= 35 ? 35 : 42;
  const nextDaysCount = totalCellsNeeded - cells.length;
  for (let i = 1; i <= nextDaysCount; i++) {
    const m = currentMonth === 11 ? 0 : currentMonth + 1;
    const y = currentMonth === 11 ? currentYear + 1 : currentYear;
    cells.push({ dayNum: i, month: m, year: y, isCurrentMonth: false });
  }

  // Render day cells
  cells.forEach(cell => {
    const cellEl = document.createElement('div');
    cellEl.className = 'calendar-day';
    if (!cell.isCurrentMonth) {
      cellEl.classList.add('other-month');
    }

    const dateStr = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.dayNum).padStart(2, '0')}`;
    if (dateStr === todayStr) {
      cellEl.classList.add('today');
    }

    // Header of cell (day number & quick add button)
    const headerEl = document.createElement('div');
    headerEl.className = 'day-header';
    
    const numEl = document.createElement('span');
    numEl.className = 'day-number';
    numEl.textContent = cell.dayNum;
    headerEl.appendChild(numEl);

    // Only allow adding tasks on current month cells
    if (cell.isCurrentMonth) {
      const addBtn = document.createElement('button');
      addBtn.className = 'day-add-btn';
      addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
      addBtn.title = 'Programar tarea en este día';
      addBtn.onclick = (e) => {
        e.stopPropagation();
        window.openCalendarTaskModal(dateStr);
      };
      headerEl.appendChild(addBtn);
    }
    cellEl.appendChild(headerEl);

    // List of events (client startup or client tasks)
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'day-events';

    // A. Filter & render client startups
    clients.forEach(c => {
      // Apply filters for startups
      if (filterClienteId && String(c.id) !== filterClienteId) return;
      if (filterAsignadoVal && c.asignado !== filterAsignadoVal && c.asignadoSecundario !== filterAsignadoVal) return;

      if (c.arranque === dateStr) {
        const startupEl = document.createElement('div');
        startupEl.className = 'calendar-event startup-event';
        startupEl.innerHTML = `<i class="fa-solid fa-rocket"></i> <span class="event-text"><b>${c.nombre}</b> (Arranque)</span>`;
        startupEl.title = `Fecha de Arranque Pactada: ${c.nombre}`;
        startupEl.onclick = (e) => {
          e.stopPropagation();
          window.openDetail(c.id);
        };
        eventsContainer.appendChild(startupEl);
      }
    });

    // B. Filter & render client tasks
    clients.forEach(c => {
      if (filterClienteId && String(c.id) !== filterClienteId) return;

      const tasks = c.tasks || [];
      tasks.forEach((t, taskIdx) => {
        if (taskOccursOnDate(t, dateStr)) {
          // Filter task assignee
          if (filterAsignadoVal && t.asignado !== filterAsignadoVal) return;

          const taskEl = document.createElement('div');
          
          // Map task status to css class
          let statusClass = 'status-pendiente';
          if (t.status === 'En progreso') statusClass = 'status-progreso';
          else if (t.status === 'Resuelto') statusClass = 'status-resuelto';
          else if (t.status === 'Cancelado') statusClass = 'status-cancelado';

          const type = taskType(t);
          taskEl.className = `calendar-event task-event ${statusClass} task-event-${type}`;
          
          const labelAsignado = t.asignado ? t.asignado : 'Sin asignar';
          taskEl.innerHTML = `<i class="fa-solid ${taskTypeIcon(type)}"></i> <span class="event-text"><b>${c.nombre}</b>: ${t.desc} <span class="event-assignee">(${labelAsignado})</span></span>`;
          taskEl.title = `${taskTypeLabel(type)}: ${t.desc}\nFecha tarea: ${taskRangeLabel(t)}\nAsignado: ${labelAsignado}${type === 'pedido' ? `\nSolicitado por: ${t.who || 'S/N'}` : ''}\nEstado: ${t.status || 'Pendiente'}`;
          
          // Click handler: opens Edit Task modal instead of navigating away
          taskEl.onclick = (e) => {
            e.stopPropagation();
            window.openCalendarTaskModal(null, c.id, taskIdx);
          };
          
          eventsContainer.appendChild(taskEl);
        }
      });
    });

    cellEl.appendChild(eventsContainer);
    container.appendChild(cellEl);
  });
}

function populateFilterOptions() {
  const clientSelect = document.getElementById('filter-calendar-cliente');
  const userSelect = document.getElementById('filter-calendar-asignado');
  if (!clientSelect || !userSelect) return;

  const currentClientVal = clientSelect.value;
  const currentUserVal = userSelect.value;

  // 1. Populate clients
  const clients = loadClients();
  // Sort alphabetically
  clients.sort((a, b) => a.nombre.localeCompare(b.nombre));

  clientSelect.innerHTML = '<option value="">Todos los clientes</option>';
  clients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nombre;
    if (String(c.id) === currentClientVal) opt.selected = true;
    clientSelect.appendChild(opt);
  });

  // 2. Populate assignees
  const users = loadUsers();
  users.sort((a, b) => a.username.localeCompare(b.username));

  userSelect.innerHTML = '<option value="">Todos los asignados</option>';
  users.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.username;
    opt.textContent = u.username;
    if (u.username === currentUserVal) opt.selected = true;
    userSelect.appendChild(opt);
  });
}

// Navigation functions
window.calendarPrevMonth = function() {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCalendar();
};

window.calendarNextMonth = function() {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar();
};

window.calendarToday = function() {
  const d = new Date();
  currentMonth = d.getMonth();
  currentYear = d.getFullYear();
  renderCalendar();
};

window.renderCalendar = renderCalendar;

// Modal Actions
window.openCalendarTaskModal = function(dateStr, clientId, taskIdx) {
  const modal = document.getElementById('calendar-task-modal');
  if (!modal) return;

  // Reset form
  const form = document.getElementById('calendar-task-form');
  if (form) form.reset();

  const clientModalInput = document.getElementById('cal-task-client');
  const clientSearchInput = document.getElementById('cal-task-client-search');
  const clientResults = document.getElementById('cal-task-client-results');
  if (clientModalInput) clientModalInput.value = '';
  if (clientSearchInput) {
    clientSearchInput.value = '';
    clientSearchInput.disabled = false;
  }
  if (clientResults) clientResults.innerHTML = '';

  // Populate assignee select inside modal
  const asignadoModalSelect = document.getElementById('cal-task-asignado');
  if (asignadoModalSelect) {
    const users = loadUsers();
    users.sort((a, b) => a.username.localeCompare(b.username));
    asignadoModalSelect.innerHTML = '<option value="">Sin Asignar</option>';
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.username;
      opt.textContent = u.username;
      asignadoModalSelect.appendChild(opt);
    });
  }

  const modalTitle = document.getElementById('cal-task-modal-title');
  const modalIcon = document.getElementById('cal-task-modal-icon');
  const deleteBtn = document.getElementById('cal-task-delete-btn');
  const viewClientBtn = document.getElementById('cal-task-view-client-btn');
  const submitBtn = document.getElementById('cal-task-submit-btn');

  if (clientId !== undefined && clientId !== null && taskIdx !== undefined && taskIdx !== null) {
    // Edit mode
    editingTaskState = { clientId, taskIdx };

    const clients = loadClients();
    const client = clients.find(x => x.id === clientId);
    if (!client || !client.tasks || !client.tasks[taskIdx]) return;
    const task = client.tasks[taskIdx];

    if (modalTitle) modalTitle.textContent = 'Modificar Tarea';
    if (modalIcon) modalIcon.className = 'fa-solid fa-pen-to-square';
    if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    if (viewClientBtn) viewClientBtn.style.display = 'inline-flex';
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk" style="margin-right: 4px;"></i> <span>Guardar Cambios</span>';

    // Fill form
    if (clientModalInput) clientModalInput.value = clientId;
    if (clientSearchInput) {
      clientSearchInput.value = client.nombre;
      clientSearchInput.disabled = true;
    }
    const tipoInput = document.getElementById('cal-task-tipo');
    if (tipoInput) tipoInput.value = taskType(task);
    const dateInput = document.getElementById('cal-task-date');
    if (dateInput) dateInput.value = task.date || '';
    const fechaDesdeInput = document.getElementById('cal-task-fecha-desde');
    if (fechaDesdeInput) fechaDesdeInput.value = taskStartDate(task);
    const fechaHastaInput = document.getElementById('cal-task-fecha-hasta');
    if (fechaHastaInput) fechaHastaInput.value = taskEndDate(task);
    
    document.getElementById('cal-task-desc').value = task.desc || '';
    document.getElementById('cal-task-who').value = task.who || '';
    document.getElementById('cal-task-jira').value = task.jira || '';
    document.getElementById('cal-task-asignado').value = task.asignado || '';
    document.getElementById('cal-task-status').value = task.status || 'Pendiente';
  } else {
    // Create mode
    editingTaskState = null;

    if (modalTitle) modalTitle.textContent = 'Programar Nueva Tarea';
    if (modalIcon) modalIcon.className = 'fa-solid fa-calendar-plus';
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (viewClientBtn) viewClientBtn.style.display = 'none';
    if (submitBtn) submitBtn.innerHTML = '<span>Programar Tarea</span>';

    if (clientModalInput) clientModalInput.value = '';
    if (clientSearchInput) {
      clientSearchInput.disabled = false;
      clientSearchInput.value = '';
    }
    const tipoInput = document.getElementById('cal-task-tipo');
    if (tipoInput) tipoInput.value = 'pedido';

    const dateInput = document.getElementById('cal-task-date');
    if (dateInput) {
      dateInput.value = dateStr || new Date().toISOString().split('T')[0];
    }
    const fechaDesdeInput = document.getElementById('cal-task-fecha-desde');
    if (fechaDesdeInput) fechaDesdeInput.value = dateStr || new Date().toISOString().split('T')[0];
    const fechaHastaInput = document.getElementById('cal-task-fecha-hasta');
    if (fechaHastaInput) fechaHastaInput.value = dateStr || new Date().toISOString().split('T')[0];
  }

  window.toggleCalendarTaskTypeFields();
  modal.classList.add('open');
};

window.toggleCalendarTaskTypeFields = function() {
  const type = document.getElementById('cal-task-tipo')?.value || 'pedido';
  document.querySelectorAll('#calendar-task-modal .calendar-pedido-only').forEach(el => {
    el.classList.toggle('task-fields-hidden', type !== 'pedido');
  });
  if (type !== 'pedido') {
    const whoEl = document.getElementById('cal-task-who');
    const jiraEl = document.getElementById('cal-task-jira');
    if (whoEl) whoEl.value = '';
    if (jiraEl) jiraEl.value = '';
  }
};

window.searchCalendarTaskClients = function() {
  const input = document.getElementById('cal-task-client-search');
  const hidden = document.getElementById('cal-task-client');
  const results = document.getElementById('cal-task-client-results');
  if (!input || !hidden || !results || input.disabled) return;

  hidden.value = '';
  const query = input.value.trim().toLowerCase();
  const clients = loadClients()
    .filter(c => !query || c.nombre.toLowerCase().includes(query))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .slice(0, 8);

  if (clients.length === 0) {
    results.innerHTML = '<div class="client-search-empty">Sin resultados</div>';
    results.classList.add('open');
    return;
  }

  results.innerHTML = clients.map(c => `
    <button type="button" class="client-search-option" onclick="window.selectCalendarTaskClient(${c.id})">
      <strong>${c.nombre}</strong>
      <span>${c.tipo || 'Sin tipo'}${c.asignado ? ` · ${c.asignado}` : ''}</span>
    </button>
  `).join('');
  results.classList.add('open');
};

window.selectCalendarTaskClient = function(clientId) {
  const clients = loadClients();
  const client = clients.find(c => c.id === clientId);
  if (!client) return;
  const input = document.getElementById('cal-task-client-search');
  const hidden = document.getElementById('cal-task-client');
  const results = document.getElementById('cal-task-client-results');
  if (input) input.value = client.nombre;
  if (hidden) hidden.value = client.id;
  if (results) {
    results.innerHTML = '';
    results.classList.remove('open');
  }
};

window.closeCalendarTaskModal = function() {
  const modal = document.getElementById('calendar-task-modal');
  if (modal) modal.classList.remove('open');
};

window.saveCalendarTask = function() {
  const dateVal = document.getElementById('cal-task-date').value;
  const fechaDesdeVal = document.getElementById('cal-task-fecha-desde').value;
  const fechaHastaVal = document.getElementById('cal-task-fecha-hasta').value;
  const tipoVal = document.getElementById('cal-task-tipo').value;
  const isPedido = tipoVal === 'pedido';
  const desc = document.getElementById('cal-task-desc').value.trim();
  const whoVal = isPedido ? document.getElementById('cal-task-who').value.trim() : '';
  const jiraVal = isPedido ? document.getElementById('cal-task-jira').value.trim().toUpperCase() : '';
  const asignadoVal = document.getElementById('cal-task-asignado').value;
  const statusVal = document.getElementById('cal-task-status').value;

  if (!dateVal || !fechaDesdeVal || !fechaHastaVal || !desc) {
    alert('Por favor complete los campos obligatorios (*)');
    return false;
  }

  if (fechaHastaVal < fechaDesdeVal) {
    alert('La fecha hasta no puede ser anterior a la fecha desde.');
    document.getElementById('cal-task-fecha-hasta').focus();
    return false;
  }

  const clients = loadClients();

  if (editingTaskState) {
    // Edit mode saving
    const { clientId, taskIdx } = editingTaskState;
    const c = clients.find(x => x.id === clientId);
    if (!c || !c.tasks || !c.tasks[taskIdx]) {
      alert('Error al guardar: Tarea no encontrada.');
      return false;
    }

    c.tasks[taskIdx] = {
      tipo: tipoVal,
      date: dateVal,
      fechaDesde: fechaDesdeVal,
      fechaHasta: fechaHastaVal,
      who: whoVal,
      desc,
      jira: jiraVal,
      asignado: asignadoVal,
      status: statusVal
    };

    saveClients(clients);

    const curUser = getCurrentUser();
    if (curUser) {
      addActivity(curUser.username, c.id, c.nombre, 'task_edit', `Modificó la tarea programada: "${desc}"`);
    }

    if (window.showEmergentNotification) {
      window.showEmergentNotification(`Tarea de ${c.nombre} actualizada con éxito.`);
    }
  } else {
    // Create mode saving
    let clientId = document.getElementById('cal-task-client').value;
    if (!clientId) {
      const typedClient = document.getElementById('cal-task-client-search')?.value.trim().toLowerCase() || '';
      const matches = typedClient
        ? clients.filter(c => c.nombre.toLowerCase().includes(typedClient))
        : [];
      if (matches.length === 1) {
        clientId = String(matches[0].id);
        document.getElementById('cal-task-client').value = clientId;
      }
    }
    if (!clientId) {
      alert('Seleccione un cliente');
      return false;
    }

    const c = clients.find(x => String(x.id) === clientId);
    if (!c) {
      alert('Cliente no encontrado');
      return false;
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
      addActivity(curUser.username, c.id, c.nombre, 'task_create', `Programó tarea desde calendario: "${desc}"`);
    }

    if (window.showEmergentNotification) {
      window.showEmergentNotification(`Tarea programada con éxito para ${c.nombre}.`);
    }
  }

  // Refresh views
  renderCalendar();
  if (window.renderAll) {
    window.renderAll();
  }

  // Close modal
  window.closeCalendarTaskModal();
  return false;
};

window.deleteCalendarTask = function() {
  if (!editingTaskState) return;
  if (!confirm('¿Estás seguro de que deseas eliminar esta tarea permanentemente?')) return;

  const { clientId, taskIdx } = editingTaskState;
  const clients = loadClients();
  const c = clients.find(x => x.id === clientId);
  if (!c || !c.tasks || !c.tasks[taskIdx]) return;

  const removedTask = c.tasks[taskIdx];
  c.tasks.splice(taskIdx, 1);
  saveClients(clients);

  const curUser = getCurrentUser();
  if (curUser && removedTask) {
    addActivity(curUser.username, c.id, c.nombre, 'task_delete', `Eliminó la tarea programada: "${removedTask.desc}"`);
  }

  renderCalendar();
  if (window.renderAll) {
    window.renderAll();
  }

  if (window.showEmergentNotification) {
    window.showEmergentNotification(`Tarea eliminada con éxito.`);
  }

  window.closeCalendarTaskModal();
};

window.navigateToClientFromCalendar = function() {
  if (!editingTaskState) return;
  const { clientId } = editingTaskState;
  window.closeCalendarTaskModal();
  window.openDetail(clientId);
};
