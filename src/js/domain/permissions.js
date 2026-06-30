// ============================================================
// domain/permissions.js
// Reglas de negocio puras sobre visibilidad y permisos.
// No tocan localStorage ni el DOM — reciben los datos ya
// cargados (clients, users) y devuelven respuestas.
//
// Modelo:
//  - Un usuario es 'lider' o 'implementador'.
//  - Un implementador tiene un array `lideres` (puede reportar
//    a más de un líder a la vez).
//  - Un líder ve los clientes de TODOS sus implementadores,
//    más los que él mismo tenga asignados directamente.
// ============================================================

/**
 * Lista de usernames de implementadores que reportan a un líder dado.
 */
export function getImplementadoresOf(liderUsername, users) {
  return users
    .filter(u => u.role === 'implementador' && Array.isArray(u.lideres) && u.lideres.includes(liderUsername))
    .map(u => u.username);
}

/**
 * Array de líderes a los que reporta un implementador.
 */
export function getLideresOf(username, users) {
  const u = users.find(x => x.username === username);
  return u ? (u.lideres || []) : [];
}

/**
 * IDs de clientes visibles para un usuario dado, según su rol.
 *  - lider        → clientes de sus implementadores + propios
 *  - implementador → solo los propios (principal o secundario)
 */
export function getVisibleClientIds(currentUser, clients, users) {
  if (!currentUser) return [];

  if (currentUser.role === 'lider') {
    const myImpl = getImplementadoresOf(currentUser.username, users);
    return clients
      .filter(c =>
        myImpl.includes(c.asignado) ||
        myImpl.includes(c.asignadoSecundario) ||
        c.asignado === currentUser.username
      )
      .map(c => c.id);
  }

  if (currentUser.role === 'implementador') {
    return clients
      .filter(c => c.asignado === currentUser.username || c.asignadoSecundario === currentUser.username)
      .map(c => c.id);
  }

  return clients.map(c => c.id);
}

/**
 * Filtra el array completo de clientes a los visibles por el usuario.
 * Atajo sobre getVisibleClientIds para no tener que cruzar IDs afuera.
 */
export function filterVisibleClients(currentUser, clients, users) {
  const ids = getVisibleClientIds(currentUser, clients, users);
  return clients.filter(c => ids.includes(c.id));
}

/**
 * ¿currentUser puede administrar (editar nombre/contraseña/lideres) a targetUser?
 *
 * Reglas:
 *  - Solo los líderes administran usuarios.
 *  - Un líder siempre puede modificar su propia contraseña.
 *  - Un líder NO puede tocar el perfil de otro líder.
 *  - La asignación de líderes (`lideres[]`) de un implementador
 *    la puede tocar cualquier líder (es una decisión compartida).
 *  - El nombre visible y la contraseña de un implementador solo
 *    los puede cambiar un líder que ya esté en su `lideres[]`.
 */
export function canManageUser(currentUser, targetUser) {
  if (!currentUser || currentUser.role !== 'lider') return false;
  if (!targetUser) return true; // creando un usuario nuevo
  if (targetUser.username === currentUser.username) return true; // perfil propio
  if (targetUser.role === 'lider') return false; // no se tocan entre líderes
  return true; // cualquier líder puede tocar asignaciones de cualquier implementador
}

/**
 * ¿currentUser puede editar nombre/contraseña de targetUser
 * (más allá de la asignación de líderes)?
 * Esto es más restrictivo que canManageUser: requiere pertenencia.
 */
export function isOwnTeamMember(currentUser, targetUser) {
  if (!currentUser || !targetUser) return false;
  if (targetUser.role === 'lider') return targetUser.username === currentUser.username;
  return Array.isArray(targetUser.lideres) && targetUser.lideres.includes(currentUser.username);
}

export function isLider(user) {
  return Boolean(user && user.role === 'lider');
}

export function isImplementador(user) {
  return Boolean(user && user.role === 'implementador');
}
