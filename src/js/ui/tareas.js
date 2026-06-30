// ============================================================
// ui/tareas.js
// ============================================================

import { loadClients, loadTareas, addTarea, updateTarea, deleteTarea, loadUsers } from '../data.js';
import { getCurrentUser } from '../auth.js';
import { formatDateAR } from '../utils.js';
import { filterVisibleClients } from '../domain/permissions.js';

// ── Estado de la página (persiste entre re-renders sin recargar) ──
const UI = {
  filtroAsignado: '',
  filtroEstado:   '',
  agrupacion:     'ninguna', // 'ninguna' | 'cliente' | 'implementador'
  orden:          'creadoEn', // 'creadoEn' | 'prioridad' | 'fechaLimite' | 'estado'
  seleccion:      new Set(),  // ids de tareas seleccionadas
};

// ── Helpers ───────────────────────────────────────────────────────

const PRIORIDAD_ORDER = { alta: 0, media: 1, baja: 2 };
const ESTADO_ORDER    = { pendiente: 0, en_progreso: 1, completada: 2 };

function prioridadBadge(p) {
  const map = {
    alta:  { cls: 'badge-red',    icon: 'fa-circle-exclamation', label: 'Alta'  },
    media: { cls: 'badge-yellow', icon: 'fa-circle-half-stroke', label: 'Media' },
    baja:  { cls: 'badge-gray',   icon: 'fa-circle',             label: 'Baja'  },
  };
  const d = map[p] || map.media;
  return `<span class="badge ${d.cls}"><i class="fa-solid ${d.icon}"></i> ${d.label}</span>`;
}

function isOverdue(t) {
  return t.fechaLimite && t.estado !== 'completada'
    && t.fechaLimite < new Date().toISOString().split('T')[0];
}

function sortTareas(list) {
  return [...list].sort((a, b) => {
    switch (UI.orden) {
      case 'prioridad':
        return (PRIORIDAD_ORDER[a.prioridad] ?? 1) - (PRIORIDAD_ORDER[b.prioridad] ?? 1);
      case 'fechaLimite':
        return (a.fechaLimite || 'z').localeCompare(b.fechaLimite || 'z');
      case 'estado':
        return (ESTADO_ORDER[a.estado] ?? 0) - (ESTADO_ORDER[b.estado] ?? 0);
      default: // creadoEn desc
        return b.creadoEn.localeCompare(a.creadoEn);
    }
  });
}

// ── Card individual ───────────────────────────────────────────────

function tareaCard(t, user, isLider) {
  const overdue    = isOverdue(t);
  const canComplete = (t.asignado || '').toLowerCase() === user.username.toLowerCase() || isLider;
  const selected   = UI.seleccion.has(t.id);

  const estadoSelect = canComplete
    ? `<div class="select-wrapper" style="min-width:130px;">
        <select class="edit-select tarea-estado-select" onchange="window.updateTareaEstado(${t.id},this.value)">
          <option value="pendiente"   ${t.estado==='pendiente'   ?'selected':''}>⏳ Pendiente</option>
          <option value="en_progreso" ${t.estado==='en_progreso' ?'selected':''}>🔵 En progreso</option>
          <option value="completada"  ${t.estado==='completada'  ?'selected':''}>✅ Completada</option>
        </select>
        <i class="fa-solid fa-chevron-down select-arrow" style="font-size:8px;"></i>
      </div>`
    : `<span class="badge ${t.estado==='completada'?'badge-green':t.estado==='en_progreso'?'badge-blue':'badge-yellow'}" style="font-size:11px;">
        ${t.estado==='completada'?'✅ Completada':t.estado==='en_progreso'?'🔵 En progreso':'⏳ Pendiente'}
      </span>`;

  const clienteTag = t.clienteId
    ? `<span class="tarea-cliente-link" onclick="window.openDetail(${t.clienteId})">
        <i class="fa-solid fa-building" style="opacity:.5;font-size:10px;margin-right:3px;"></i>${t.clienteNombre}
       </span>`
    : `<span style="font-size:11px;color:var(--text-muted);font-style:italic;">Sin cliente</span>`;

  return `
    <div class="tarea-card ${t.estado==='completada'?'tarea-completada':''} ${overdue?'tarea-overdue':''} ${selected?'tarea-selected':''}"
         data-id="${t.id}">
      <label class="tarea-checkbox-wrap" title="Seleccionar">
        <input type="checkbox" class="tarea-checkbox" ${selected?'checked':''}
          onchange="window.toggleTareaSelect(${t.id},this.checked)">
      </label>
      <div class="tarea-card-left">
        <div class="tarea-card-header">
          <span class="tarea-titulo ${t.estado==='completada'?'tarea-titulo-done':''}">${t.titulo}</span>
          ${prioridadBadge(t.prioridad)}
          ${overdue?`<span class="badge badge-red" style="font-size:9px;"><i class="fa-solid fa-triangle-exclamation"></i> Vencida</span>`:''}
        </div>
        ${t.descripcion?`<div class="tarea-desc">${t.descripcion}</div>`:''}
        <div class="tarea-meta">
          ${clienteTag}
          ${isLider?`<span class="tarea-asignado"><i class="fa-solid fa-user" style="opacity:.5;font-size:10px;"></i> ${t.asignado}</span>`:''}
          ${t.fechaLimite?`<span class="tarea-fecha ${overdue?'overdue':''}"><i class="fa-solid fa-calendar${overdue?'-xmark':''}"></i> ${formatDateAR(t.fechaLimite)}</span>`:''}
          <span style="color:var(--text-muted);font-size:10px;">por ${t.creadoPor}</span>
        </div>
      </div>
      <div class="tarea-card-right">
        ${estadoSelect}
        ${isLider?`<button class="accion-delete-btn" onclick="window.deleteTareaUI(${t.id})" title="Eliminar">
          <i class="fa-solid fa-trash-can"></i></button>`:''}
      </div>
    </div>`;
}

// ── Renderizado agrupado ──────────────────────────────────────────

function renderGrupo(label, icon, tareas, user, isLider, clienteId) {
  if (tareas.length === 0) return '';
  const completadas = tareas.filter(t => t.estado === 'completada').length;
  const pct = Math.round((completadas / tareas.length) * 100);
  const barColor = pct === 100 ? '#10b981' : pct >= 50 ? '#3b82f6' : '#f59e0b';

  return `
    <div class="tareas-grupo">
      <div class="tareas-grupo-header">
        <div class="tareas-grupo-info">
          <i class="fa-solid ${icon}" style="opacity:.6;font-size:11px;"></i>
          <span class="tareas-grupo-label">${label}</span>
          <span class="section-count">${tareas.length}</span>
        </div>
        <div class="tareas-grupo-progress">
          <div class="tareas-progress-bar">
            <div class="tareas-progress-fill" style="width:${pct}%;background:${barColor};"></div>
          </div>
          <span style="font-size:11px;color:var(--text-muted);min-width:32px;text-align:right;">${pct}%</span>
        </div>
        ${clienteId ? `<button class="btn btn-secondary" style="padding:4px 10px;font-size:11px;margin-left:8px;" onclick="window.openDetail(${clienteId})">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> Ficha
        </button>` : ''}
      </div>
      <div class="tareas-grupo-body">
        ${tareas.map(t => tareaCard(t, user, isLider)).join('')}
      </div>
    </div>`;
}

function renderList(tareasFiltradas, user, isLider, clients) {
  if (tareasFiltradas.length === 0) return '<div class="midia-empty"><i class="fa-solid fa-list-check" style="font-size:28px;opacity:.2;display:block;margin-bottom:10px;"></i><p>Sin tareas para los filtros seleccionados.</p></div>';

  const sorted = sortTareas(tareasFiltradas);

  if (UI.agrupacion === 'ninguna') {
    return sorted.map(t => tareaCard(t, user, isLider)).join('');
  }

  if (UI.agrupacion === 'cliente') {
    // Group: tareas sin cliente primero, luego por cliente
    const grupos = {};
    const sinCliente = [];
    sorted.forEach(t => {
      if (!t.clienteId) { sinCliente.push(t); return; }
      const key = t.clienteId;
      if (!grupos[key]) grupos[key] = { nombre: t.clienteNombre, id: t.clienteId, tareas: [] };
      grupos[key].tareas.push(t);
    });
    let html = '';
    if (sinCliente.length > 0) html += renderGrupo('Sin cliente', 'fa-ban', sinCliente, user, isLider, null);
    Object.values(grupos)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .forEach(g => { html += renderGrupo(g.nombre, 'fa-building', g.tareas, user, isLider, g.id); });
    return html;
  }

  if (UI.agrupacion === 'implementador') {
    const grupos = {};
    sorted.forEach(t => {
      const key = t.asignado || '(sin asignar)';
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(t);
    });
    return Object.entries(grupos)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, tareas]) => renderGrupo(key, 'fa-user', tareas, user, isLider, null))
      .join('');
  }

  return '';
}

// ── Render principal ──────────────────────────────────────────────

export function renderTareas() {
  const container = document.getElementById('tareas-container');
  if (!container) return;

  const user = getCurrentUser();
  if (!user) return;

  const isLider = user.role === 'lider';

  if (!isLider && UI.filtroAsignado && UI.filtroAsignado !== user.username) {
    UI.filtroAsignado = '';
  }

  const users   = loadUsers();
  const clients = loadClients();
  const tareas  = loadTareas();

  const myUN = user.username.toLowerCase();
  const misTareas = isLider
    ? tareas
    : tareas.filter(t => (t.asignado || '').toLowerCase() === myUN);

  const tareasFiltradas = misTareas.filter(t =>
    (!UI.filtroAsignado || t.asignado === UI.filtroAsignado) &&
    (!UI.filtroEstado   || t.estado   === UI.filtroEstado)
  );

  const myImpls = isLider ? users.filter(u => u.role === 'implementador') : [];
  const visibleClients = isLider ? filterVisibleClients(user, clients, users) : [];

  const total       = misTareas.length;
  const pendientes  = misTareas.filter(t => t.estado === 'pendiente').length;
  const enProgreso  = misTareas.filter(t => t.estado === 'en_progreso').length;
  const completadas = misTareas.filter(t => t.estado === 'completada').length;

  // ── Selección actual válida (puede haber filtrado tareas que ya no están) ──
  const idsVisibles = new Set(tareasFiltradas.map(t => t.id));
  UI.seleccion.forEach(id => { if (!idsVisibles.has(id)) UI.seleccion.delete(id); });
  const haySeleccion = UI.seleccion.size > 0;
  const todoSeleccionado = tareasFiltradas.length > 0 && UI.seleccion.size === tareasFiltradas.length;

  // ── Stats ──────────────────────────────────────────────────────
  const statsHTML = `
    <div class="tareas-stats">
      <div class="tarea-stat-card" onclick="window.setTareasFilter('estado','')">
        <span class="tarea-stat-num">${total}</span>
        <span class="tarea-stat-label">Total</span>
      </div>
      <div class="tarea-stat-card warn" onclick="window.setTareasFilter('estado','pendiente')">
        <span class="tarea-stat-num">${pendientes}</span>
        <span class="tarea-stat-label">Pendientes</span>
      </div>
      <div class="tarea-stat-card blue" onclick="window.setTareasFilter('estado','en_progreso')">
        <span class="tarea-stat-num">${enProgreso}</span>
        <span class="tarea-stat-label">En progreso</span>
      </div>
      <div class="tarea-stat-card green" onclick="window.setTareasFilter('estado','completada')">
        <span class="tarea-stat-num">${completadas}</span>
        <span class="tarea-stat-label">Completadas</span>
      </div>
    </div>`;

  // ── Formulario nueva tarea ─────────────────────────────────────
  const implOptions = myImpls.map(u =>
    `<option value="${u.username}">${u.displayName || u.username}</option>`).join('');
  const clientOptions = visibleClients.sort((a,b)=>a.nombre.localeCompare(b.nombre))
    .map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

  const formHTML = isLider ? `
    <div class="tareas-form-card">
      <div class="tareas-form-header" onclick="window.toggleTareasForm()">
        <span class="tareas-form-title"><i class="fa-solid fa-plus-circle"></i> Nueva tarea</span>
        <i class="fa-solid fa-chevron-down tareas-form-chevron" id="tareas-form-chevron"></i>
      </div>
      <div class="tareas-form-body" id="tareas-form-body" style="display:none;">
        <div class="tareas-form-row">
          <div class="tareas-form-group" style="flex:3;">
            <label class="tareas-form-label">Título *</label>
            <input type="text" id="tf-titulo" class="edit-input" placeholder="Describí la tarea..."
              onkeydown="if(event.key==='Enter')window.saveTareaForm()">
          </div>
          <div class="tareas-form-group">
            <label class="tareas-form-label">Asignado a *</label>
            <div class="select-wrapper"><select id="tf-asignado" class="edit-select">
              <option value="">— Implementador —</option>${implOptions}
            </select><i class="fa-solid fa-chevron-down select-arrow" style="font-size:8px;"></i></div>
          </div>
        </div>
        <div class="tareas-form-row">
          <div class="tareas-form-group">
            <label class="tareas-form-label">Tipo</label>
            <div class="select-wrapper"><select id="tf-tipo" class="edit-select" onchange="window.toggleTareaClienteField()">
              <option value="personal">Personal (sin cliente)</option>
              <option value="cliente">Ligada a un cliente</option>
            </select><i class="fa-solid fa-chevron-down select-arrow" style="font-size:8px;"></i></div>
          </div>
          <div class="tareas-form-group" id="tf-cliente-group" style="display:none;">
            <label class="tareas-form-label">Cliente</label>
            <div class="select-wrapper"><select id="tf-cliente" class="edit-select">
              <option value="">— Seleccionar —</option>${clientOptions}
            </select><i class="fa-solid fa-chevron-down select-arrow" style="font-size:8px;"></i></div>
          </div>
          <div class="tareas-form-group">
            <label class="tareas-form-label">Prioridad</label>
            <div class="select-wrapper"><select id="tf-prioridad" class="edit-select">
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="baja">Baja</option>
            </select><i class="fa-solid fa-chevron-down select-arrow" style="font-size:8px;"></i></div>
          </div>
          <div class="tareas-form-group">
            <label class="tareas-form-label">Fecha límite</label>
            <input type="date" id="tf-fecha" class="edit-input">
          </div>
        </div>
        <div class="tareas-form-row">
          <div class="tareas-form-group" style="flex:1;">
            <label class="tareas-form-label">Descripción adicional</label>
            <input type="text" id="tf-desc" class="edit-input" placeholder="Opcional — más contexto...">
          </div>
          <button class="btn btn-primary" style="align-self:flex-end;white-space:nowrap;" onclick="window.saveTareaForm()">
            <i class="fa-solid fa-check"></i> Crear tarea
          </button>
        </div>
      </div>
    </div>` : '';

  // ── Toolbar: filtros + agrupación + orden ──────────────────────
  const filterImplOptions = isLider
    ? `<option value="">Todos los implementadores</option>` + myImpls.map(u =>
        `<option value="${u.username}" ${UI.filtroAsignado===u.username?'selected':''}>${u.displayName||u.username}</option>`).join('')
    : '';

  const toolbarHTML = `
    <div class="tareas-toolbar">
      <div class="tareas-toolbar-left">
        ${isLider ? `
          <div class="tareas-filter-group">
            <i class="fa-solid fa-user" style="opacity:.6;font-size:12px;"></i>
            <select class="midia-filter-select" onchange="window.setTareasFilter('asignado',this.value)">
              ${filterImplOptions}
            </select>
          </div>` : ''}
        <div class="tareas-filter-group">
          <i class="fa-solid fa-flag" style="opacity:.6;font-size:12px;"></i>
          <select class="midia-filter-select" onchange="window.setTareasFilter('estado',this.value)">
            <option value="" ${!UI.filtroEstado?'selected':''}>Todos los estados</option>
            <option value="pendiente"   ${UI.filtroEstado==='pendiente'  ?'selected':''}>Pendiente</option>
            <option value="en_progreso" ${UI.filtroEstado==='en_progreso'?'selected':''}>En progreso</option>
            <option value="completada"  ${UI.filtroEstado==='completada' ?'selected':''}>Completada</option>
          </select>
        </div>
        <span class="midia-filter-count">${tareasFiltradas.length} tarea${tareasFiltradas.length!==1?'s':''}</span>
      </div>
      <div class="tareas-toolbar-right">
        <div class="tareas-filter-group">
          <i class="fa-solid fa-layer-group" style="opacity:.6;font-size:12px;"></i>
          <select class="midia-filter-select" onchange="window.setTareasAgrupacion(this.value)">
            <option value="ninguna"         ${UI.agrupacion==='ninguna'       ?'selected':''}>Sin agrupar</option>
            <option value="cliente"         ${UI.agrupacion==='cliente'       ?'selected':''}>Agrupar por cliente</option>
            <option value="implementador"   ${UI.agrupacion==='implementador' ?'selected':''}>Agrupar por implementador</option>
          </select>
        </div>
        <div class="tareas-filter-group">
          <i class="fa-solid fa-arrow-up-wide-short" style="opacity:.6;font-size:12px;"></i>
          <select class="midia-filter-select" onchange="window.setTareasOrden(this.value)">
            <option value="creadoEn"    ${UI.orden==='creadoEn'   ?'selected':''}>Más recientes</option>
            <option value="prioridad"   ${UI.orden==='prioridad'  ?'selected':''}>Prioridad</option>
            <option value="fechaLimite" ${UI.orden==='fechaLimite'?'selected':''}>Fecha límite</option>
            <option value="estado"      ${UI.orden==='estado'     ?'selected':''}>Estado</option>
          </select>
        </div>
      </div>
    </div>`;

  // ── Barra de acción masiva ─────────────────────────────────────
  const bulkHTML = `
    <div class="tareas-bulk-bar ${haySeleccion?'active':''}">
      <label class="tarea-checkbox-wrap" style="margin-right:4px;" title="Seleccionar todas">
        <input type="checkbox" ${todoSeleccionado?'checked':''}
          onchange="window.selectAllTareas(this.checked)">
      </label>
      <span class="tareas-bulk-count">
        ${haySeleccion ? `${UI.seleccion.size} seleccionada${UI.seleccion.size!==1?'s':''}` : 'Seleccionar todas'}
      </span>
      ${haySeleccion ? `
        <div class="tareas-bulk-actions">
          <button class="btn btn-secondary" style="padding:5px 12px;font-size:12px;" onclick="window.bulkEstado('pendiente')">
            ⏳ Pendiente
          </button>
          <button class="btn btn-secondary" style="padding:5px 12px;font-size:12px;" onclick="window.bulkEstado('en_progreso')">
            🔵 En progreso
          </button>
          <button class="btn btn-secondary" style="padding:5px 12px;font-size:12px;" onclick="window.bulkEstado('completada')">
            ✅ Completada
          </button>
          ${isLider ? `<button class="btn btn-secondary" style="padding:5px 12px;font-size:12px;color:var(--red-text);" onclick="window.bulkEliminar()">
            <i class="fa-solid fa-trash-can"></i> Eliminar
          </button>` : ''}
          <button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="window.clearSeleccion()">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>` : ''}
    </div>`;

  const listHTML = total === 0
    ? `<div class="midia-empty">
        <i class="fa-solid fa-list-check" style="font-size:32px;opacity:.2;display:block;margin-bottom:12px;"></i>
        <p>${isLider ? 'Todavía no hay tareas. Creá la primera arriba.' : 'No tenés tareas asignadas todavía.'}</p>
      </div>`
    : renderList(tareasFiltradas, user, isLider, clients);

  container.innerHTML = `
    ${statsHTML}
    ${formHTML}
    ${toolbarHTML}
    ${bulkHTML}
    <div class="tareas-list" id="tareas-list">${listHTML}</div>
  `;
}

// ── Handlers globales ─────────────────────────────────────────────

window.toggleTareasForm = function() {
  const body    = document.getElementById('tareas-form-body');
  const chevron = document.getElementById('tareas-form-chevron');
  if (!body) return;
  const open = body.style.display === 'none';
  body.style.display = open ? 'flex' : 'none';
  if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
  if (open) setTimeout(() => document.getElementById('tf-titulo')?.focus(), 50);
};

window.toggleTareaClienteField = function() {
  const tipo  = document.getElementById('tf-tipo')?.value;
  const group = document.getElementById('tf-cliente-group');
  if (group) group.style.display = tipo === 'cliente' ? 'flex' : 'none';
};

window.setTareasFilter = function(key, value) {
  if (key === 'asignado') UI.filtroAsignado = value;
  if (key === 'estado')   UI.filtroEstado   = value;
  UI.seleccion.clear();
  renderTareas();
};

window.setTareasAgrupacion = function(value) {
  UI.agrupacion = value;
  renderTareas();
};

window.setTareasOrden = function(value) {
  UI.orden = value;
  renderTareas();
};

window.toggleTareaSelect = function(id, checked) {
  if (checked) UI.seleccion.add(id);
  else         UI.seleccion.delete(id);
  // Actualizar solo la barra bulk sin re-render completo
  _refreshBulkBar();
};

window.selectAllTareas = function(checked) {
  const tareas  = loadTareas();
  const user    = getCurrentUser();
  if (!user) return;
  const isLider = user.role === 'lider';
  const myUN    = user.username.toLowerCase();
  const misTareas = isLider ? tareas : tareas.filter(t => (t.asignado||'').toLowerCase()===myUN);
  const filtradas = misTareas.filter(t =>
    (!UI.filtroAsignado || t.asignado === UI.filtroAsignado) &&
    (!UI.filtroEstado   || t.estado   === UI.filtroEstado)
  );
  if (checked) filtradas.forEach(t => UI.seleccion.add(t.id));
  else         UI.seleccion.clear();
  renderTareas();
};

window.clearSeleccion = function() {
  UI.seleccion.clear();
  renderTareas();
};

window.bulkEstado = function(nuevoEstado) {
  const ids = [...UI.seleccion];
  if (ids.length === 0) return;
  ids.forEach(id => updateTarea(id, { estado: nuevoEstado }));
  UI.seleccion.clear();
  window.showEmergentNotification?.(`${ids.length} tarea${ids.length!==1?'s':''} actualizadas a "${nuevoEstado.replace('_',' ')}".`);
  renderTareas();
};

window.bulkEliminar = function() {
  const ids = [...UI.seleccion];
  if (!confirm(`¿Eliminar ${ids.length} tarea${ids.length!==1?'s':''}? Esta acción no se puede deshacer.`)) return;
  ids.forEach(id => deleteTarea(id));
  UI.seleccion.clear();
  window.showEmergentNotification?.(`${ids.length} tarea${ids.length!==1?'s':''} eliminadas.`);
  renderTareas();
};

window.updateTareaEstado = function(id, nuevoEstado) {
  updateTarea(id, { estado: nuevoEstado });
  // Partial re-render: update just the list preserving the form state
  const tareas  = loadTareas();
  const user    = getCurrentUser();
  if (!user) return;
  const isLider = user.role === 'lider';
  const clients = loadClients();
  const myUN    = user.username.toLowerCase();
  const misTareas = isLider ? tareas : tareas.filter(t => (t.asignado||'').toLowerCase()===myUN);
  const filtradas = misTareas.filter(t =>
    (!UI.filtroAsignado || t.asignado === UI.filtroAsignado) &&
    (!UI.filtroEstado   || t.estado   === UI.filtroEstado)
  );
  const listEl = document.getElementById('tareas-list');
  if (listEl) listEl.innerHTML = renderList(filtradas, user, isLider, clients);
};

window.deleteTareaUI = function(id) {
  if (!confirm('¿Eliminar esta tarea?')) return;
  UI.seleccion.delete(id);
  deleteTarea(id);
  renderTareas();
};

window.saveTareaForm = function() {
  const titulo    = document.getElementById('tf-titulo')?.value?.trim();
  const asignado  = document.getElementById('tf-asignado')?.value;
  const tipo      = document.getElementById('tf-tipo')?.value || 'personal';
  const clienteId = tipo === 'cliente' ? parseInt(document.getElementById('tf-cliente')?.value || '0') || null : null;
  const prioridad = document.getElementById('tf-prioridad')?.value || 'media';
  const fecha     = document.getElementById('tf-fecha')?.value || null;
  const desc      = document.getElementById('tf-desc')?.value?.trim() || '';
  const user      = getCurrentUser();

  if (!titulo) {
    const el = document.getElementById('tf-titulo');
    if (el) { el.focus(); el.style.borderColor='var(--red-border)'; setTimeout(()=>el.style.borderColor='',1500); }
    return;
  }
  if (!asignado) { window.showEmergentNotification?.('Seleccioná un implementador.','error'); return; }

  const clients = loadClients();
  const cliente = clienteId ? clients.find(c => c.id === clienteId) : null;

  addTarea({ titulo, descripcion: desc, tipo, clienteId, clienteNombre: cliente?.nombre||'', asignado, creadoPor: user.username, prioridad, fechaLimite: fecha });

  ['tf-titulo','tf-desc'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('tf-asignado').value  = '';
  document.getElementById('tf-tipo').value       = 'personal';
  document.getElementById('tf-prioridad').value  = 'media';
  document.getElementById('tf-fecha').value       = '';
  const cg = document.getElementById('tf-cliente-group');
  if (cg) cg.style.display = 'none';

  window.showEmergentNotification?.('Tarea creada.');
  // Partial: only refresh list + bulk bar
  const tareas2  = loadTareas();
  const myUN     = user.username.toLowerCase();
  const misTareas2 = tareas2; // líder always
  const filtradas2 = misTareas2.filter(t =>
    (!UI.filtroAsignado || t.asignado===UI.filtroAsignado) &&
    (!UI.filtroEstado   || t.estado  ===UI.filtroEstado)
  );
  const listEl = document.getElementById('tareas-list');
  if (listEl) listEl.innerHTML = renderList(filtradas2, user, true, clients);
  setTimeout(() => document.getElementById('tf-titulo')?.focus(), 80);
};

// ── Internal helpers ──────────────────────────────────────────────

function _refreshBulkBar() {
  // Re-render just the bulk bar in place
  const bar = document.querySelector('.tareas-bulk-bar');
  if (!bar) return;
  const tareas  = loadTareas();
  const user    = getCurrentUser();
  if (!user) return;
  const isLider = user.role === 'lider';
  const myUN    = user.username.toLowerCase();
  const misTareas = isLider ? tareas : tareas.filter(t => (t.asignado||'').toLowerCase()===myUN);
  const filtradas = misTareas.filter(t =>
    (!UI.filtroAsignado || t.asignado===UI.filtroAsignado) &&
    (!UI.filtroEstado   || t.estado  ===UI.filtroEstado)
  );
  const haySeleccion = UI.seleccion.size > 0;
  const todoSel = filtradas.length > 0 && UI.seleccion.size === filtradas.length;

  bar.className = `tareas-bulk-bar ${haySeleccion ? 'active' : ''}`;
  bar.innerHTML = `
    <label class="tarea-checkbox-wrap" style="margin-right:4px;" title="Seleccionar todas">
      <input type="checkbox" ${todoSel?'checked':''} onchange="window.selectAllTareas(this.checked)">
    </label>
    <span class="tareas-bulk-count">${haySeleccion ? `${UI.seleccion.size} seleccionada${UI.seleccion.size!==1?'s':''}` : 'Seleccionar todas'}</span>
    ${haySeleccion ? `
      <div class="tareas-bulk-actions">
        <button class="btn btn-secondary" style="padding:5px 12px;font-size:12px;" onclick="window.bulkEstado('pendiente')">⏳ Pendiente</button>
        <button class="btn btn-secondary" style="padding:5px 12px;font-size:12px;" onclick="window.bulkEstado('en_progreso')">🔵 En progreso</button>
        <button class="btn btn-secondary" style="padding:5px 12px;font-size:12px;" onclick="window.bulkEstado('completada')">✅ Completada</button>
        ${isLider ? `<button class="btn btn-secondary" style="padding:5px 12px;font-size:12px;color:var(--red-text);" onclick="window.bulkEliminar()"><i class="fa-solid fa-trash-can"></i> Eliminar</button>` : ''}
        <button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="window.clearSeleccion()"><i class="fa-solid fa-xmark"></i></button>
      </div>` : ''}`;
}
