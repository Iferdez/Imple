// ============================================================
// domain/constants.js
// Catálogos de valores fijos del dominio (no cambian en
// tiempo de ejecución, no dependen de storage).
// ============================================================

/**
 * Tipos de acción diaria disponibles en "Mi Día" y en la
 * sección de Acciones de la ficha de cliente.
 */
export const TIPOS_ACCION = [
  { value: 'llamada',       label: 'Llamada',       icon: 'fa-phone',           color: '#3b82f6' },
  { value: 'capacitacion',  label: 'Capacitación',  icon: 'fa-chalkboard-user', color: '#8b5cf6' },
  { value: 'visita',        label: 'Visita',        icon: 'fa-location-dot',    color: '#10b981' },
  { value: 'configuracion', label: 'Configuración', icon: 'fa-sliders',         color: '#f59e0b' },
  { value: 'email',         label: 'Email',         icon: 'fa-envelope',        color: '#06b6d4' },
  { value: 'otro',          label: 'Otro',          icon: 'fa-ellipsis',        color: '#6b7280' },
];

/**
 * Busca la definición de un tipo de acción por su value.
 * Si no existe, devuelve 'otro' como fallback seguro.
 */
export function getTipoAccion(value) {
  return TIPOS_ACCION.find(t => t.value === value) || TIPOS_ACCION[TIPOS_ACCION.length - 1];
}

/**
 * Estados posibles de una implementación, en el orden del funnel.
 */
export const ESTADOS_CLIENTE = [
  'Solicitar Info',
  'Armado de Base',
  'Instalacion',
  'Capacitacion',
  'Iniciado',
];
