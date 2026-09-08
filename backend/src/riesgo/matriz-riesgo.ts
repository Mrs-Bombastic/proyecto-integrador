/**
 * Matriz de riesgo academico — logica pura, sin acceso a base de datos.
 *
 * Esta separacion es deliberada: el corazon del sistema es esta regla de
 * negocio, y aislarla permite probarla exhaustivamente sin levantar la base de
 * datos ni la aplicacion. El servicio que la usa solo aporta los datos.
 *
 * La especificacion completa esta en docs/matriz-riesgo.md.
 */

/** Indicadores que componen el puntaje de riesgo. */
export const INDICADORES = [
  'PROMEDIO',
  'ASISTENCIA',
  'PARTICIPACION',
  'ENTREGAS',
] as const;

export type Indicador = (typeof INDICADORES)[number];

export type Semaforo = 'VERDE' | 'AMARILLO' | 'ROJO';

export type NivelRiesgo = 'NORMAL' | 'MEDIO' | 'ALTO';

/** Puntos que aporta cada color antes de ponderar. */
export const PUNTOS: Record<Semaforo, number> = {
  VERDE: 0,
  AMARILLO: 50,
  ROJO: 100,
};

/** Cortes del puntaje global (0-100) que definen el nivel de riesgo. */
export const CORTE_MEDIO = 34;
export const CORTE_ALTO = 67;

/**
 * Indicadores cuyo estado en rojo fuerza un nivel minimo de riesgo MEDIO,
 * aunque el puntaje ponderado quede por debajo del corte. Un promedio o una
 * asistencia criticos no deben quedar ocultos por el peso de los demas
 * indicadores.
 */
export const INDICADORES_CRITICOS: Indicador[] = ['PROMEDIO', 'ASISTENCIA'];

/** Umbral configurable de un indicador, tal como se guarda en base de datos. */
export interface Umbral {
  indicador: Indicador;
  umbralVerde: number;
  umbralAmarillo: number;
  /** true si valores mayores son mejores (promedio); false si son peores (entregas vencidas). */
  mayorEsMejor: boolean;
  /** Peso relativo del indicador. Se normaliza si el conjunto no suma 1. */
  peso: number;
}

/** Valores observados de un estudiante. */
export type ValoresIndicadores = Record<Indicador, number>;

export interface DetalleIndicador {
  indicador: Indicador;
  valor: number;
  semaforo: Semaforo;
  puntos: number;
  peso: number;
  /** Umbral que el valor no alcanzo; util para explicar la alerta. */
  umbralIncumplido: number | null;
}

export interface ResultadoRiesgo {
  puntaje: number;
  nivel: NivelRiesgo;
  detalle: DetalleIndicador[];
  /** Indicadores en rojo, de mayor a menor peso. */
  criticos: Indicador[];
  /** true si el nivel se elevo por la regla de anulacion y no por el puntaje. */
  elevadoPorReglaCritica: boolean;
}

/**
 * Clasifica un valor contra su umbral.
 *
 * Para indicadores donde mayor es mejor, el valor debe alcanzar `umbralVerde`
 * para ser verde y `umbralAmarillo` para ser amarillo. Para indicadores donde
 * menor es mejor (entregas vencidas), la comparacion se invierte.
 */
export function clasificarIndicador(valor: number, umbral: Umbral): Semaforo {
  if (umbral.mayorEsMejor) {
    if (valor >= umbral.umbralVerde) return 'VERDE';
    if (valor >= umbral.umbralAmarillo) return 'AMARILLO';
    return 'ROJO';
  }

  if (valor <= umbral.umbralVerde) return 'VERDE';
  if (valor <= umbral.umbralAmarillo) return 'AMARILLO';
  return 'ROJO';
}

/** Traduce un puntaje global (0-100) al nivel de riesgo correspondiente. */
export function nivelDesdePuntaje(puntaje: number): NivelRiesgo {
  if (puntaje >= CORTE_ALTO) return 'ALTO';
  if (puntaje >= CORTE_MEDIO) return 'MEDIO';
  return 'NORMAL';
}

/** Orden de severidad, para comparar niveles. */
const SEVERIDAD: Record<NivelRiesgo, number> = { NORMAL: 0, MEDIO: 1, ALTO: 2 };

/**
 * Calcula el puntaje ponderado de riesgo y el nivel resultante.
 *
 * Los pesos se normalizan sobre la suma de los umbrales recibidos, de modo que
 * el puntaje sigue estando entre 0 y 100 aunque el administrador configure
 * pesos que no sumen exactamente 1 o desactive un indicador.
 */
export function calcularRiesgo(
  valores: ValoresIndicadores,
  umbrales: Umbral[],
): ResultadoRiesgo {
  if (umbrales.length === 0) {
    throw new Error(
      'No hay umbrales configurados: no es posible evaluar el riesgo',
    );
  }

  const sumaPesos = umbrales.reduce((total, u) => total + u.peso, 0);
  if (sumaPesos <= 0) {
    throw new Error('La suma de los pesos de los umbrales debe ser mayor que cero');
  }

  const detalle: DetalleIndicador[] = umbrales.map((umbral) => {
    const valor = valores[umbral.indicador] ?? 0;
    const semaforo = clasificarIndicador(valor, umbral);
    return {
      indicador: umbral.indicador,
      valor,
      semaforo,
      puntos: PUNTOS[semaforo],
      peso: umbral.peso / sumaPesos,
      umbralIncumplido:
        semaforo === 'VERDE'
          ? null
          : semaforo === 'AMARILLO'
            ? umbral.umbralVerde
            : umbral.umbralAmarillo,
    };
  });

  // El puntaje se calcula con los pesos exactos; el peso que se reporta se
  // redondea despues para que la interfaz no muestre ruido de punto flotante.
  const puntaje = redondear(
    detalle.reduce((total, d) => total + d.puntos * d.peso, 0),
  );

  for (const d of detalle) {
    d.peso = redondear(d.peso, 4);
  }

  const nivelPorPuntaje = nivelDesdePuntaje(puntaje);

  const criticos = detalle
    .filter((d) => d.semaforo === 'ROJO')
    .sort((a, b) => b.peso - a.peso)
    .map((d) => d.indicador);

  // Regla de anulacion: un indicador critico en rojo nunca deja al estudiante
  // en estado normal.
  const hayCriticoEnRojo = criticos.some((indicador) =>
    INDICADORES_CRITICOS.includes(indicador),
  );
  const nivel =
    hayCriticoEnRojo && SEVERIDAD[nivelPorPuntaje] < SEVERIDAD.MEDIO
      ? 'MEDIO'
      : nivelPorPuntaje;

  return {
    puntaje,
    nivel,
    detalle,
    criticos,
    elevadoPorReglaCritica: nivel !== nivelPorPuntaje,
  };
}

/**
 * Tipo de alerta que corresponde a un resultado: el indicador critico de mayor
 * peso, o GLOBAL cuando hay mas de uno en rojo o cuando ninguno lo esta pero el
 * puntaje acumulado ya supera el corte.
 */
export function tipoAlertaPara(
  resultado: ResultadoRiesgo,
): Indicador | 'GLOBAL' {
  if (resultado.criticos.length === 1) return resultado.criticos[0];
  return 'GLOBAL';
}

/** Redacta el mensaje que vera el coordinador en la alerta. */
export function mensajeAlerta(
  nombreEstudiante: string,
  resultado: ResultadoRiesgo,
): string {
  const descripciones: Record<Indicador, (valor: number) => string> = {
    PROMEDIO: (v) => `promedio de ${v.toFixed(2)}`,
    ASISTENCIA: (v) => `asistencia del ${v.toFixed(0)} %`,
    PARTICIPACION: (v) => `${v.toFixed(1)} interacciones por semana`,
    ENTREGAS: (v) => `${v.toFixed(0)} entrega(s) vencida(s)`,
  };

  const motivos = resultado.detalle
    .filter((d) => d.semaforo !== 'VERDE')
    .sort((a, b) => b.puntos * b.peso - a.puntos * a.peso)
    .map((d) => descripciones[d.indicador](d.valor));

  const detalleTexto =
    motivos.length > 0 ? ` Motivos: ${motivos.join(', ')}.` : '';

  return (
    `${nombreEstudiante} presenta riesgo ${resultado.nivel.toLowerCase()} ` +
    `(puntaje ${resultado.puntaje}).${detalleTexto}`
  );
}

function redondear(valor: number, decimales = 2): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}
