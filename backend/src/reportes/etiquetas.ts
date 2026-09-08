import type { Indicador } from '../riesgo/matriz-riesgo.js';

/** Nombres legibles de los indicadores para los reportes exportables. */
export const ETIQUETA_INDICADOR: Record<Indicador, string> = {
  PROMEDIO: 'Promedio acumulado',
  ASISTENCIA: 'Asistencia a sesiones',
  PARTICIPACION: 'Participación semanal',
  ENTREGAS: 'Entregas vencidas',
};
