/** Tipos compartidos con la API. Reflejan las respuestas del backend. */

export type Rol = 'ESTUDIANTE' | 'DOCENTE' | 'COORDINADOR' | 'ADMINISTRADOR';

export type NivelRiesgo = 'NORMAL' | 'MEDIO' | 'ALTO';

export type Semaforo = 'VERDE' | 'AMARILLO' | 'ROJO';

export type EstadoAlerta = 'NUEVA' | 'EN_PROCESO' | 'GESTIONADA' | 'DESCARTADA';

export type Indicador = 'PROMEDIO' | 'ASISTENCIA' | 'PARTICIPACION' | 'ENTREGAS';

export interface Usuario {
  id: string;
  nombres: string;
  apellidos: string;
  email: string;
  rol: Rol;
  permisos: string[];
  perfilId?: string;
}

export interface RespuestaLogin {
  accessToken: string;
  usuario: Usuario;
}

export interface DetalleIndicador {
  indicador: Indicador;
  valor: number;
  semaforo: Semaforo;
  puntos: number;
  peso: number;
  umbralIncumplido: number | null;
}

export interface ResultadoRiesgo {
  puntaje: number;
  nivel: NivelRiesgo;
  detalle: DetalleIndicador[];
  criticos: Indicador[];
  elevadoPorReglaCritica: boolean;
}

export interface ValoresIndicadores {
  PROMEDIO: number;
  ASISTENCIA: number;
  PARTICIPACION: number;
  ENTREGAS: number;
}

export interface EstudianteRiesgo {
  estudianteId: string;
  codigoEstudiante: string;
  nombre: string;
  programaId: string;
  programaNombre: string;
  cohorte: string;
  semestre: number;
  valores: ValoresIndicadores;
  resultado: ResultadoRiesgo;
  alertasAbiertas: number;
}

export interface SnapshotIndicador {
  id: string;
  periodo: string;
  promedio: string;
  porcentajeAsistencia: string;
  participacionSemanal: string;
  entregasVencidas: number;
  puntajeRiesgo: string;
  nivelRiesgo: NivelRiesgo;
  calculadoEn: string;
}

export interface Seguimiento {
  id: string;
  accion: string;
  descripcion: string;
  fecha: string;
  usuario?: { nombres: string; apellidos: string };
}

export interface Alerta {
  id: string;
  tipoAlerta: Indicador | 'GLOBAL';
  nivelRiesgo: NivelRiesgo;
  puntajeRiesgo: string;
  valorObservado: string;
  umbralSuperado: string;
  mensaje: string;
  estado: EstadoAlerta;
  fechaGeneracion: string;
  fechaGestion: string | null;
  estudiante?: {
    id: string;
    codigoEstudiante: string;
    usuario: { nombres: string; apellidos: string; email: string };
    programa: { id: string; nombre: string };
  };
  curso?: { id: string; nombre: string } | null;
  gestionadaPor?: { nombres: string; apellidos: string } | null;
  seguimientos?: Seguimiento[];
  _count?: { seguimientos: number };
}

export interface CalificacionCorte {
  corte: number;
  nota: number;
  porcentaje: number;
  descripcion: string | null;
  fechaRegistro: string;
}

export interface SesionAsistencia {
  fecha: string;
  estado: 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO' | 'TARDE';
  minutosConectado: number;
}

/** Desglose academico de un curso del estudiante (RF02 y RF03). */
export interface CursoEstudiante {
  cursoId: string;
  codigo: string;
  nombre: string;
  periodo: string;
  creditos: number;
  docente: string | null;
  calificaciones: CalificacionCorte[];
  promedio: number;
  notaMinima: number | null;
  asistencia: {
    porcentaje: number;
    presentes: number;
    tarde: number;
    ausentes: number;
    justificadas: number;
    totalSesiones: number;
    sesiones: SesionAsistencia[];
  };
  participaciones: number;
  entregas: {
    total: number;
    vencidas: number;
    detalle: {
      titulo: string;
      fechaLimite: string;
      fechaEntrega: string | null;
      estado: string;
    }[];
  };
}

export interface DetalleEstudiante extends EstudianteRiesgo {
  historial: SnapshotIndicador[];
  alertas: Alerta[];
  cursos: CursoEstudiante[];
}

export interface Cohorte {
  cohorte: string;
  estudiantes: number;
}

export interface RolSistema {
  id: number;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
  _count: { usuarios: number };
}

export interface UsuarioAdmin {
  id: string;
  nombres: string;
  apellidos: string;
  email: string;
  activo: boolean;
  ultimoAcceso: string | null;
  bloqueadoHasta: string | null;
  creadoEn: string;
  rol: { id: number; nombre: string; descripcion: string | null };
  estudiante: { id: string; codigoEstudiante: string } | null;
  docente: { id: string; codigoDocente: string } | null;
}

export interface RegistroAuditoria {
  id: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  detalle: string | null;
  ip: string | null;
  fecha: string;
  usuario: { nombres: string; apellidos: string; email: string } | null;
}

export interface Observacion {
  id: string;
  contenido: string;
  fecha: string;
  archivoUrl: string | null;
  docente: {
    codigoDocente?: string;
    usuario: { nombres: string; apellidos: string };
  };
  curso?: { id: string; nombre: string } | null;
}

export interface ResumenAlertas {
  nuevas: number;
  enProceso: number;
  gestionadas: number;
  descartadas: number;
  total: number;
  altasSinCerrar: number;
}

export interface ResumenRiesgo {
  totalEstudiantes: number;
  normal: number;
  medio: number;
  alto: number;
  alertasAbiertas: number;
}

export interface Programa {
  id: string;
  codigo: string;
  nombre: string;
}

export interface Curso {
  id: string;
  codigo: string;
  nombre: string;
  periodo: string;
  programaId: string;
}

export interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fechaEnvio: string;
  alerta?: { id: string; nivelRiesgo: NivelRiesgo; estado: EstadoAlerta } | null;
}

export interface Umbral {
  id: number;
  indicador: Indicador;
  descripcion: string;
  umbralVerde: string;
  umbralAmarillo: string;
  mayorEsMejor: boolean;
  peso: string;
  activo: boolean;
  actualizadoEn: string;
  actualizadoPor?: { nombres: string; apellidos: string } | null;
}

/** Etiquetas en espanol para mostrar en la interfaz. */
export const ETIQUETA_INDICADOR: Record<Indicador, string> = {
  PROMEDIO: 'Promedio',
  ASISTENCIA: 'Asistencia',
  PARTICIPACION: 'Participación',
  ENTREGAS: 'Entregas vencidas',
};

export const ETIQUETA_NIVEL: Record<NivelRiesgo, string> = {
  NORMAL: 'Normal',
  MEDIO: 'Riesgo medio',
  ALTO: 'Riesgo alto',
};

export const ETIQUETA_ESTADO: Record<EstadoAlerta, string> = {
  NUEVA: 'Nueva',
  EN_PROCESO: 'En proceso',
  GESTIONADA: 'Gestionada',
  DESCARTADA: 'Descartada',
};
