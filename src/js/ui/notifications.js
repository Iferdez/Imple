import { loadActivities, saveActivities, loadClients, loadUsers } from '../data.js';
import { getCurrentUser, getVisibleClients } from '../auth.js';

export async function renderNotifications() {
  const container = document.getElementById('notificaciones-list');
  if (!container) return;

  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const allClients = loadClients();
  const visibleClients = getVisibleClients(allClients);
  const visibleClientIds = visibleClients.map(c => c.id);

  const activities = loadActivities();
  const isLeader = currentUser.role === 'lider';

  // Leader can filter by implementer; implemented via URL hash param or window var
  const filterByUser = isLeader ? (window.notifFilterUser || '') : '';

  // Filter logs:
  // 1. Made by other users (not current logged user) — leaders can see all with filter
  // 2. Belongs to clients visible to this user
  const filtered = activities.filter(act => {
    const isOtherUser = isLeader 
      ? (filterByUser ? act.userId.toLowerCase() === filterByUser.toLowerCase() : true)
      : act.userId.toLowerCase() !== currentUser.username.toLowerCase();
    const isVisibleClient = visibleClientIds.includes(act.clientId);
    return isOtherUser && isVisibleClient;
  });

  // Mark all as read when opening this panel
  const lastReadKey = `crm_last_read_notifs_${currentUser.username.toLowerCase()}`;
  localStorage.setItem(lastReadKey, new Date().toISOString());
  
  // Hide badge in sidebar since we just read them
  const bellBadge = document.getElementById('notif-bell-badge');
  if (bellBadge) {
    bellBadge.style.display = 'none';
  }

  // Render user filter for leaders
  const filterBar = document.getElementById('notif-filter-bar');
  if (filterBar && isLeader) {
    const users = loadUsers();
    const implementers = users.filter(u => u.role !== 'lider');
    filterBar.style.display = 'flex';
    filterBar.innerHTML = `
      <label style="font-size:12px;font-weight:600;color:var(--text-secondary);white-space:nowrap;">
        <i class="fa-solid fa-filter" style="margin-right:4px;"></i>Filtrar por implementador:
      </label>
      <select onchange="window.setNotifUserFilter(this.value)" style="font-size:12px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);cursor:pointer;">
        <option value="">Todos los implementadores</option>
        ${implementers.map(u => `<option value="${u.username}" ${filterByUser === u.username ? 'selected' : ''}>${u.username}</option>`).join('')}
      </select>
      <span style="font-size:11px;color:var(--text-muted);margin-left:4px;">${filtered.length} registro${filtered.length !== 1 ? 's' : ''}</span>
    `;
  } else if (filterBar) {
    filterBar.style.display = 'none';
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="activity-empty-state">
        <i class="fa-solid fa-bell-slash"></i>
        <div style="font-weight: 600; font-size: 15px; color: var(--text-primary);">No hay notificaciones nuevas</div>
        <p style="font-size: 13px; max-width: 320px; margin: 0 auto; line-height: 1.4;">
          Aquí verás los cambios realizados por otros miembros en los clientes a tu cargo.
        </p>
      </div>
    `;
    return;
  }

  const iconMap = {
    client_create: 'fa-solid fa-circle-plus',
    client_edit: 'fa-solid fa-pen-to-square',
    task_create: 'fa-solid fa-folder-plus',
    task_status: 'fa-solid fa-list-check',
    task_delete: 'fa-solid fa-trash-can',
    date_request: 'fa-solid fa-calendar-day',
    date_resolve: 'fa-solid fa-calendar-check',
    bulk_edit: 'fa-solid fa-layer-group'
  };

  container.innerHTML = filtered.map(act => {
    const iconClass = iconMap[act.actionType] || 'fa-solid fa-bell';
    const relativeTime = formatTime(act.timestamp);
    
    return `
      <div class="activity-item">
        <div class="activity-icon-wrapper activity-icon-${act.actionType}">
          <i class="${iconClass}"></i>
        </div>
        <div class="activity-details">
          <div class="activity-header">
            <span class="activity-user-action">
              Usuario <strong>${act.userId}</strong> en 
              <span class="activity-client-link" onclick="window.openDetail(${act.clientId})">${act.clientNombre}</span>
            </span>
            <span class="activity-time" title="${new Date(act.timestamp).toLocaleString()}">${relativeTime}</span>
          </div>
          <div class="activity-description">${act.description}</div>
        </div>
      </div>
    `;
  }).join('');
}

function formatTime(isoStr) {
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Hace instantes';
  if (diffMin < 60) return `Hace ${diffMin}m`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `Hace ${diffHrs}h`;
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

window.clearNotificationsHistory = function() {
  if (!confirm('¿Estás seguro de que deseas limpiar el historial de notificaciones?')) return;
  
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const allClients = loadClients();
  const visibleClients = getVisibleClients(allClients);
  const visibleClientIds = visibleClients.map(c => c.id);

  // Instead of deleting everything, we delete notifications for visible clients done by other users
  const activities = loadActivities();
  const keep = activities.filter(act => {
    const isOtherUser = act.userId.toLowerCase() !== currentUser.username.toLowerCase();
    const isVisibleClient = visibleClientIds.includes(act.clientId);
    return !(isOtherUser && isVisibleClient); // Keep anything that was NOT shown as a notification to this user
  });

  saveActivities(keep);
  
  // Trigger a sync
  localStorage.setItem('crm_activities_sync', Date.now());
  
  renderNotifications();
};

window.setNotifUserFilter = function(username) {
  window.notifFilterUser = username;
  renderNotifications();
};
