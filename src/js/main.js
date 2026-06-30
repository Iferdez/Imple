import { loadClients, saveClients, loadUsers, loadActivities, addActivity } from './data.js';
import { login, logout, applySession, getCurrentUser, getVisibleClients } from './auth.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderTable, populateUsersDropdowns } from './ui/clients.js';
import { renderKanban } from './ui/kanban.js';
import { renderTeam } from './ui/team.js';
import { openDetail } from './ui/detail.js';
import { renderNotifications } from './ui/notifications.js';
import { renderCalendar } from './ui/calendario.js';
import { renderSeguimiento } from './ui/seguimiento.js';
import { renderPublicGanttPage } from './ui/gantt.js';
import './ui/export.js';
import { renderMiDia } from './ui/midia.js';
import { renderTareas } from './ui/tareas.js';
window.renderMiDia = renderMiDia;
window.renderTareas = renderTareas;

// --- SPA Router ---
export function showPage(page) {
  // Clear any active client detail view state
  if (window.activeClientId) {
    window.activeClientId = null;
  }

  // Clear selections when navigating pages to keep states consistent
  if (window.clearSelection) {
    window.clearSelection();
  }

  // Hide all pages, show target
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) targetPage.classList.add('active');

  // Update sidebar active state
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
  const activeNav = document.getElementById(`nav-${page}`);
  if (activeNav) activeNav.classList.add('active');

  // Trigger render only for the visible page (performance)
  if (page === 'dashboard') {
    renderDashboard();
  } else if (page === 'clientes') {
    renderTable();
  } else if (page === 'seguimiento') {
    renderSeguimiento();
  } else if (page === 'calendario') {
    renderCalendar();
  } else if (page === 'kanban') {
    renderKanban();
  } else if (page === 'equipo') {
    renderTeam();
  } else if (page === 'notificaciones') {
    renderNotifications();
  } else if (page === 'midia') {
    renderMiDia();
  } else if (page === 'tareas') {
    renderTareas();
  }

  // Always update notification counts when navigating
  if (typeof updateNotifications === 'function') {
    updateNotifications();
  }

  window.scrollTo(0, 0);
}

// Bind to window to allow inline html onclick handlers
window.showPage = showPage;

// Trigger renders across all views (useful after updates)
export function renderAll() {
  renderDashboard();
  renderTable();
  renderSeguimiento();
  renderCalendar();
  renderKanban();
  renderTeam();
  
  const pageTareas = document.getElementById('page-tareas');
  if (pageTareas && pageTareas.classList.contains('active')) renderTareas();

  const pageMidia = document.getElementById('page-midia');
  if (pageMidia && pageMidia.classList.contains('active')) renderMiDia();

  const pageNotif = document.getElementById('page-notificaciones');
  if (pageNotif && pageNotif.classList.contains('active')) {
    renderNotifications();
  }
  
  if (typeof window.refreshActiveClientDetail === 'function') {
    window.refreshActiveClientDetail();
  }
  
  if (typeof updateNotifications === 'function') {
    updateNotifications();
  }
}

window.renderAll = renderAll;

// --- Authentication UI Actions ---
export async function doLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  
  if (!user) {
    errEl.textContent = 'Por favor, ingresa tu usuario y contraseña.';
    errEl.classList.add('show');
    return;
  }
  
  const result = await login(user, pass);
  if (!result.success) {
    errEl.textContent = result.message;
    errEl.classList.add('show');
    return;
  }
  
  errEl.classList.remove('show');
  document.getElementById('login-pass').value = ''; // clear password input
  
  // Apply session UI updates
  applySession();
  
  // Refresh and show dashboard
  renderAll();
  showPage('dashboard');
}

window.doLogin = doLogin;

export function doLogout() {
  logout();
  if (window.clearSelection) {
    window.clearSelection();
  }
  // Show login screen
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-pass').value = '';
  document.getElementById('login-user').value = '';
  
  // Reset filters
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  const filterEstado = document.getElementById('filter-estado');
  if (filterEstado) filterEstado.value = '';
  const filterTipo = document.getElementById('filter-tipo');
  if (filterTipo) filterTipo.value = '';
  const filterAsignado = document.getElementById('filter-asignado');
  if (filterAsignado) {
    filterAsignado.value = '';
    filterAsignado.disabled = false;
    filterAsignado.style.opacity = '';
  }
  
  // Reset SPA pages route to dashboard
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-dashboard').classList.add('active');
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('nav-dashboard').classList.add('active');
}

window.doLogout = doLogout;

export function onLoginUserChange() {
  document.getElementById('login-error').classList.remove('show');
}

window.onLoginUserChange = onLoginUserChange;

export function toggleLoginPassword() {
  const passInput = document.getElementById('login-pass');
  const icon = document.getElementById('toggle-pw-icon');
  if (passInput && icon) {
    if (passInput.type === 'password') {
      passInput.type = 'text';
      icon.className = 'fa-solid fa-eye-slash';
    } else {
      passInput.type = 'password';
      icon.className = 'fa-solid fa-eye';
    }
  }
}

window.toggleLoginPassword = toggleLoginPassword;

// --- Add Client Modal Actions ---
export function openAddModal() {
  const modal = document.getElementById('add-modal');
  if (modal) {
    modal.classList.add('open');
    const nameInput = document.getElementById('new-nombre');
    if (nameInput) nameInput.focus();
  }
}

window.openAddModal = openAddModal;

export function closeAddModal() {
  const modal = document.getElementById('add-modal');
  if (modal) modal.classList.remove('open');
  const form = document.getElementById('new-client-form');
  if (form) form.reset();
}

window.closeAddModal = closeAddModal;

export function saveNewClient() {
  const nombreInput = document.getElementById('new-nombre');
  const nombre = nombreInput ? nombreInput.value.trim() : '';
  if (!nombre) {
    alert('Ingresa el nombre del cliente');
    if (nombreInput) nombreInput.focus();
    return false;
  }

  const clients = loadClients();
  const newId = clients.length > 0 ? Math.max(...clients.map(c => c.id)) + 1 : 1;
  
  const newClient = {
    id: newId,
    nombre: nombre.toUpperCase(),
    tipo: document.getElementById('new-tipo').value,
    asignado: document.getElementById('new-asignado').value,
    asignadoSecundario: document.getElementById('new-asignado-secundario').value,
    estado: document.getElementById('new-estado').value,
    arranque: document.getElementById('new-arranque').value,
    notas: document.getElementById('new-notas').value,
    notasInternas: '',
    particularidades: '',
    contactoPrincipal: { nombre: '', cargo: '', telefono: '', email: '' },
    contactoEncargado: { nombre: '', cargo: '', telefono: '', email: '' },
    historialEstados: [],
    tasks: [],
  };

  clients.push(newClient);
  saveClients(clients);
  
  const curUser = getCurrentUser();
  if (curUser) {
    addActivity(curUser.username, newClient.id, newClient.nombre, 'client_create', 'Creado como nuevo cliente en el sistema');
  }
  
  renderAll();
  closeAddModal();
  return false;
}

window.saveNewClient = saveNewClient;

// --- Initialize App ---
document.addEventListener('DOMContentLoaded', () => {
  if (renderPublicGanttPage()) {
    return;
  }

  // 1. Populate filters & modals selects
  populateUsersDropdowns();

  // 2. Verify if there is an active session
  const isSessionActive = applySession();
  
  if (isSessionActive) {
    renderAll();
    showPage('dashboard');
  }
});

function updateNotifications() {
  const user = getCurrentUser();
  if (!user) {
    const badge = document.getElementById('dashboard-notif-badge');
    if (badge) badge.style.display = 'none';
    const bellBadge = document.getElementById('notif-bell-badge');
    if (bellBadge) bellBadge.style.display = 'none';
    const container = document.getElementById('toast-container');
    if (container) container.innerHTML = '';
    return;
  }

  const isLeader = user.role === 'lider';
  const badge = document.getElementById('dashboard-notif-badge');
  const container = document.getElementById('toast-container');

  // 1. Leader-only: Dashboard Pending Arranque Badge (No Toasts)
  if (badge) {
    if (!isLeader) {
      badge.style.display = 'none';
      if (container) container.innerHTML = '';
    } else {
      const clients = loadClients();
      const pending = clients.filter(c => c.pendingArranque);

      if (pending.length > 0) {
        badge.textContent = pending.length;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
      // Toasts are removed, clear container
      if (container) container.innerHTML = '';
    }
  }

  // 2. Unread bell badge count (All users, for visible clients activity)
  const bellBadge = document.getElementById('notif-bell-badge');
  if (bellBadge) {
    // If the active page is already 'notificaciones', keep badge hidden and update timestamp
    const pageNotif = document.getElementById('page-notificaciones');
    if (pageNotif && pageNotif.classList.contains('active')) {
      const lastReadKey = `crm_last_read_notifs_${user.username.toLowerCase()}`;
      localStorage.setItem(lastReadKey, new Date().toISOString());
      bellBadge.style.display = 'none';
      return;
    }

    const clients = loadClients();
    const visible = getVisibleClients(clients);
    const visibleIds = visible.map(c => c.id);
    
    const activities = loadActivities();
    const lastReadKey = `crm_last_read_notifs_${user.username.toLowerCase()}`;
    const lastReadStr = localStorage.getItem(lastReadKey);
    const lastReadDate = lastReadStr ? new Date(lastReadStr) : new Date(0);

    const unread = activities.filter(act => {
      const isOtherUser = act.userId.toLowerCase() !== user.username.toLowerCase();
      const isVisibleClient = visibleIds.includes(act.clientId);
      const isNew = new Date(act.timestamp) > lastReadDate;
      return isOtherUser && isVisibleClient && isNew;
    });

    if (unread.length > 0) {
      bellBadge.textContent = unread.length;
      bellBadge.style.display = 'inline-block';
    } else {
      bellBadge.style.display = 'none';
    }
  }
}

// Sync state across multiple tabs/windows in real time
window.addEventListener('storage', (e) => {
  if (e.key === 'crm_clients' || e.key === 'crm_users' || e.key === 'crm_activities_sync' || e.key === 'crm_acciones_sync') {
    renderAll();
  }
});

// Beautiful Transient Emergent Notification System
export function showEmergentNotification(message, type = 'success') {
  let container = document.getElementById('emergente-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'emergente-container';
    container.style.position = 'fixed';
    container.style.top = '24px';
    container.style.right = '24px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);
  }

  const notif = document.createElement('div');
  notif.className = `emergente-toast emergente-${type}`;
  notif.style.pointerEvents = 'auto';
  notif.style.background = 'rgba(30, 41, 59, 0.9)';
  notif.style.backdropFilter = 'blur(12px)';
  notif.style.border = '1px solid rgba(255, 255, 255, 0.1)';
  
  if (type === 'success') {
    notif.style.borderLeft = '4px solid #10b981'; // green-500
  } else if (type === 'warning') {
    notif.style.borderLeft = '4px solid #f59e0b'; // amber-500
  } else {
    notif.style.borderLeft = '4px solid #ef4444'; // red-500
  }
  
  notif.style.color = '#fff';
  notif.style.padding = '14px 20px';
  notif.style.borderRadius = '8px';
  notif.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.3)';
  notif.style.display = 'flex';
  notif.style.alignItems = 'center';
  notif.style.gap = '12px';
  notif.style.minWidth = '280px';
  notif.style.transform = 'translateX(120%)';
  notif.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease';
  notif.style.opacity = '0';

  const iconHtml = type === 'success' 
    ? '<i class="fa-solid fa-circle-check" style="color: #10b981; font-size: 18px;"></i>'
    : type === 'warning'
      ? '<i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b; font-size: 18px;"></i>'
      : '<i class="fa-solid fa-circle-xmark" style="color: #ef4444; font-size: 18px;"></i>';

  notif.innerHTML = `
    ${iconHtml}
    <div style="font-size: 13px; font-weight: 500; font-family: inherit;">${message}</div>
  `;

  container.appendChild(notif);

  // Force reflow
  notif.offsetHeight;

  // Slide in
  notif.style.transform = 'translateX(0)';
  notif.style.opacity = '1';

  // Automatically fade out and remove
  setTimeout(() => {
    notif.style.transform = 'translateX(120%)';
    notif.style.opacity = '0';
    setTimeout(() => {
      notif.remove();
    }, 300);
  }, 3500);
}
window.showEmergentNotification = showEmergentNotification;
