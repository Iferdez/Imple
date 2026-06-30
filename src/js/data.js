// ============================================================
// data.js — capa de compatibilidad
// ============================================================
// Este archivo ya NO contiene lógica propia. Es un "barrel"
// que re-exporta todo desde su nueva ubicación en core/ y
// domain/, para que el resto del código (módulos de ui/) no
// tenga que cambiar sus imports.
//
// Mapa de dónde vive cada cosa ahora:
//   - hashPassword, checkPassword, isHashed   → core/crypto.js
//   - loadUsers, saveUsers                    → core/repository.users.js
//   - loadClients, saveClients,
//     recordStateChange                       → core/repository.clients.js
//   - loadAcciones, saveAcciones, addAccion,
//     deleteAccion                            → core/repository.acciones.js
//   - loadActivities, saveActivities,
//     addActivity                             → core/repository.activities.js
//   - TIPOS_ACCION, getTipoAccion             → domain/constants.js
//   - getLideresOf, getImplementadoresOf,
//     getVisibleClientIds                     → domain/permissions.js
//   - INITIAL_CLIENTS, INITIAL_USERS          → domain/seed-data.js
//
// Si estás escribiendo código nuevo, importá directo desde el
// módulo correspondiente de arriba en vez de desde acá.
// ============================================================

export { hashPassword, checkPassword, isHashed } from './core/crypto.js';

export { loadUsers, saveUsers } from './core/repository.users.js';

export { loadClients, saveClients, recordStateChange } from './core/repository.clients.js';

export { loadAcciones, saveAcciones, addAccion, deleteAccion } from './core/repository.acciones.js';

export { loadActivities, saveActivities, addActivity } from './core/repository.activities.js';

export { TIPOS_ACCION, getTipoAccion } from './domain/constants.js';

export { getLideresOf, getImplementadoresOf, getVisibleClientIds } from './domain/permissions.js';

export { INITIAL_CLIENTS, INITIAL_USERS } from './domain/seed-data.js';

export { loadTareas, saveTareas, addTarea, updateTarea, deleteTarea } from './core/repository.tareas.js';
