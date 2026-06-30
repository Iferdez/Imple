// ============================================================
// ui/detail/checklists.js
// Catálogo de tareas estándar sugeridas por etapa del embudo, y
// la función que las carga (evitando duplicados) en un cliente.
// ============================================================

import { loadClients, saveClients, addActivity } from '../../data.js';
import { getCurrentUser } from '../../auth.js';

export const STANDARD_CHECKLISTS = {
  'Solicitar Info': [
    { desc: 'Solicitar contactos clave del frigorífico y datos fiscales', who: 'Sistema', type: 'pedido', status: 'Pendiente' },
    { desc: 'Recibir y validar catálogo de productos y lista de precios', who: 'Sistema', type: 'pedido', status: 'Pendiente' },
    { desc: 'Relevar equipamiento de hardware actual del cliente', who: 'Sistema', type: 'pedido', status: 'Pendiente' }
  ],
  'Armado de Base': [
    { desc: 'Configurar base de datos inicial en blanco e ingresar parámetros', who: 'Sistema', type: 'pedido', status: 'Pendiente' },
    { desc: 'Importar y validar catálogo de artículos, rubros e impuestos', who: 'Sistema', type: 'pedido', status: 'Pendiente' },
    { desc: 'Configurar perfiles de usuarios e implementadores en el sistema', who: 'Sistema', type: 'pedido', status: 'Pendiente' }
  ],
  'Instalacion': [
    { desc: 'Realizar la instalación del sistema en el servidor local del cliente', who: 'Sistema', type: 'pedido', status: 'Pendiente' },
    { desc: 'Configurar balanzas, impresoras térmicas y controladores fiscales', who: 'Sistema', type: 'pedido', status: 'Pendiente' },
    { desc: 'Realizar backup inicial de la instalación configurada', who: 'Sistema', type: 'pedido', status: 'Pendiente' }
  ],
  'Capacitacion': [
    { desc: 'Capacitación del personal en el módulo de ventas y facturación', who: 'Sistema', type: 'pedido', status: 'Pendiente' },
    { desc: 'Capacitación en control de stock, compras y administración', who: 'Sistema', type: 'pedido', status: 'Pendiente' },
    { desc: 'Simulación completa de jornada y arqueo de caja con cajeros', who: 'Sistema', type: 'pedido', status: 'Pendiente' }
  ],
  'Iniciado': [
    { desc: 'Acompañamiento presencial durante el primer día de facturación real', who: 'Sistema', type: 'pedido', status: 'Pendiente' },
    { desc: 'Entrega formal de manuales de usuario y accesos del sistema', who: 'Sistema', type: 'pedido', status: 'Pendiente' },
    { desc: 'Traspaso de ficha e historial del cliente al equipo de Soporte', who: 'Sistema', type: 'pedido', status: 'Pendiente' }
  ]
};

/**
 * Carga el checklist estándar de la etapa actual del cliente.
 * No duplica tareas: si una ya existe (mismo texto, sin importar
 * mayúsculas), la saltea.
 * @returns {boolean} true si se cargó algo
 */
export function loadStandardChecklistForClient(clientId) {
  const clients = loadClients();
  const client = clients.find(c => c.id === clientId);
  if (!client) return false;

  const estado = client.estado;
  if (!estado) {
    alert('El cliente no tiene un estado de embudo asignado para cargar el checklist estándar.');
    return false;
  }

  const tasksToAdd = STANDARD_CHECKLISTS[estado];
  if (!tasksToAdd) {
    alert(`No hay checklist estándar definido para la etapa: ${estado}`);
    return false;
  }

  if (!confirm(`¿Deseas cargar el checklist estándar de 3 tareas recomendadas para la etapa "${estado}" en este cliente?`)) {
    return false;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  client.tasks = client.tasks || [];

  tasksToAdd.forEach(template => {
    const alreadyExists = client.tasks.some(
      t => t.desc.trim().toLowerCase() === template.desc.trim().toLowerCase()
    );
    if (!alreadyExists) {
      client.tasks.unshift({
        date: todayStr,
        who: template.who,
        desc: template.desc,
        type: template.type,
        status: template.status,
        asignado: client.asignado || ''
      });
    }
  });

  saveClients(clients);

  const user = getCurrentUser();
  if (user) {
    addActivity(user.username, client.id, client.nombre, 'task_create',
      `Cargó el checklist estándar para la etapa: "${estado}"`);
  }

  window.showEmergentNotification?.(`Checklist de la etapa "${estado}" cargado con éxito.`);
  window.renderAll?.();
  return true;
}

/**
 * Conecta `window.loadStandardChecklist` (llamado desde el HTML
 * inline de la ficha) con la implementación de arriba.
 */
export function bindChecklistGlobals(getActiveClientId, onAfterChange) {
  window.loadStandardChecklist = function () {
    const clientId = getActiveClientId();
    if (!clientId) return;
    if (loadStandardChecklistForClient(clientId)) {
      onAfterChange(clientId);
    }
  };
}
