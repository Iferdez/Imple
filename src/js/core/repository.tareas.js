// ============================================================
// core/repository.tareas.js
// "Tareas del equipo" — tareas que un líder crea y asigna a
// un implementador. Distintas de las tasks de cliente (que
// son pedidos de implementación dentro de una ficha).
//
// Modelo de una tarea:
// {
//   id:           number (timestamp + rand, pk)
//   titulo:       string
//   descripcion:  string
//   tipo:         'cliente' | 'personal'
//   clienteId:    number | null   (solo si tipo === 'cliente')
//   clienteNombre:string          (denorm, para listados rápidos)
//   asignado:     string          (username del implementador)
//   creadoPor:    string          (username del líder)
//   prioridad:    'alta' | 'media' | 'baja'
//   estado:       'pendiente' | 'en_progreso' | 'completada'
//   fechaLimite:  string | null   (YYYY-MM-DD)
//   creadoEn:     string          (ISO timestamp)
//   actualizadoEn:string          (ISO timestamp)
// }
// ============================================================

import { readJSON, writeJSONAndSync } from './storage.js';

const KEY = 'crm_tareas';

export function loadTareas() {
  return readJSON(KEY, []);
}

export function saveTareas(tareas) {
  writeJSONAndSync(KEY, tareas);
}

export function addTarea({ titulo, descripcion, tipo, clienteId, clienteNombre, asignado, creadoPor, prioridad, fechaLimite }) {
  const tareas = loadTareas();
  const now = new Date().toISOString();
  const nueva = {
    id: Date.now() + Math.random(),
    titulo: titulo.trim(),
    descripcion: (descripcion || '').trim(),
    tipo: tipo || 'personal',
    clienteId: clienteId || null,
    clienteNombre: clienteNombre || '',
    asignado,
    creadoPor,
    prioridad: prioridad || 'media',
    estado: 'pendiente',
    fechaLimite: fechaLimite || null,
    creadoEn: now,
    actualizadoEn: now,
  };
  tareas.unshift(nueva);
  saveTareas(tareas);
  return nueva;
}

export function updateTarea(id, changes) {
  const tareas = loadTareas();
  const idx = tareas.findIndex(t => t.id === id);
  if (idx === -1) return null;
  tareas[idx] = { ...tareas[idx], ...changes, actualizadoEn: new Date().toISOString() };
  saveTareas(tareas);
  return tareas[idx];
}

export function deleteTarea(id) {
  const tareas = loadTareas();
  saveTareas(tareas.filter(t => t.id !== id));
}
