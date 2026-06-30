import { loadClients } from '../data.js';
import { getVisibleClients } from '../auth.js';
import { daysRemaining, formatDateAR } from '../utils.js';

export function exportToCSV() {
  const allClients = loadClients();
  const vc = getVisibleClients(allClients);

  const headers = [
    'Nombre', 'Tipo', 'Asignado', 'Secundario',
    'Estado', 'Fecha Arranque', 'Días Restantes',
    'Tareas Totales', 'Tareas Resueltas', '% Progreso',
    'Notas', 'En Soporte'
  ];

  const rows = vc.map(c => {
    const tasks = c.tasks || [];
    const total = tasks.length;
    const resueltas = tasks.filter(t => t.status === 'Resuelto').length;
    const pct = total > 0 ? Math.round((resueltas / total) * 100) : 0;
    const diasRestantes = daysRemaining(c.arranque) ?? '';
    const fechaStr = c.arranque ? formatDateAR(c.arranque) : '';

    return [
      c.nombre || '',
      c.tipo || '',
      c.asignado || '',
      c.asignadoSecundario || '',
      c.estado || '',
      fechaStr,
      diasRestantes,
      total,
      resueltas,
      `${pct}%`,
      (c.notas || '').replace(/,/g, ';'),
      c.soporte ? 'Sí' : 'No'
    ];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(val => `"${val}"`).join(','))
    .join('\n');

  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const now = new Date();
  const dateTag = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  link.href = url;
  link.download = `implementaciones_${dateTag}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  if (window.showEmergentNotification) {
    window.showEmergentNotification(`Exportado: ${vc.length} implementaciones a CSV.`);
  }
}

window.exportToCSV = exportToCSV;
