import { describe, expect, it } from 'vitest';
import {
  calcularRiesgo,
  clasificarIndicador,
  mensajeAlerta,
  nivelDesdePuntaje,
  tipoAlertaPara,
  type Umbral,
  type ValoresIndicadores,
} from './matriz-riesgo.js';

/** Umbrales por defecto del sistema (ver docs/matriz-riesgo.md). */
const UMBRALES: Umbral[] = [
  { indicador: 'PROMEDIO', umbralVerde: 3.5, umbralAmarillo: 3.0, mayorEsMejor: true, peso: 0.4 },
  { indicador: 'ASISTENCIA', umbralVerde: 85, umbralAmarillo: 70, mayorEsMejor: true, peso: 0.3 },
  { indicador: 'PARTICIPACION', umbralVerde: 3, umbralAmarillo: 1, mayorEsMejor: true, peso: 0.2 },
  { indicador: 'ENTREGAS', umbralVerde: 0, umbralAmarillo: 2, mayorEsMejor: false, peso: 0.1 },
];

const valores = (v: Partial<ValoresIndicadores>): ValoresIndicadores => ({
  PROMEDIO: 4.5,
  ASISTENCIA: 95,
  PARTICIPACION: 5,
  ENTREGAS: 0,
  ...v,
});

describe('clasificarIndicador', () => {
  const promedio = UMBRALES[0];
  const entregas = UMBRALES[3];

  it('clasifica en verde cuando el valor alcanza el umbral verde', () => {
    expect(clasificarIndicador(4.2, promedio)).toBe('VERDE');
    expect(clasificarIndicador(3.5, promedio)).toBe('VERDE');
  });

  it('clasifica en amarillo entre los dos umbrales', () => {
    expect(clasificarIndicador(3.49, promedio)).toBe('AMARILLO');
    expect(clasificarIndicador(3.0, promedio)).toBe('AMARILLO');
  });

  it('clasifica en rojo por debajo del umbral amarillo', () => {
    expect(clasificarIndicador(2.99, promedio)).toBe('ROJO');
  });

  it('invierte la comparacion cuando menor es mejor', () => {
    expect(clasificarIndicador(0, entregas)).toBe('VERDE');
    expect(clasificarIndicador(2, entregas)).toBe('AMARILLO');
    expect(clasificarIndicador(3, entregas)).toBe('ROJO');
  });
});

describe('nivelDesdePuntaje', () => {
  it('respeta los cortes 34 y 67', () => {
    expect(nivelDesdePuntaje(0)).toBe('NORMAL');
    expect(nivelDesdePuntaje(33.9)).toBe('NORMAL');
    expect(nivelDesdePuntaje(34)).toBe('MEDIO');
    expect(nivelDesdePuntaje(66.9)).toBe('MEDIO');
    expect(nivelDesdePuntaje(67)).toBe('ALTO');
    expect(nivelDesdePuntaje(100)).toBe('ALTO');
  });
});

describe('calcularRiesgo', () => {
  it('da puntaje 0 y nivel normal a un estudiante sin senales de riesgo', () => {
    const resultado = calcularRiesgo(valores({}), UMBRALES);

    expect(resultado.puntaje).toBe(0);
    expect(resultado.nivel).toBe('NORMAL');
    expect(resultado.criticos).toEqual([]);
  });

  it('da puntaje 100 y nivel alto cuando todos los indicadores estan en rojo', () => {
    const resultado = calcularRiesgo(
      valores({ PROMEDIO: 2.0, ASISTENCIA: 40, PARTICIPACION: 0, ENTREGAS: 6 }),
      UMBRALES,
    );

    expect(resultado.puntaje).toBe(100);
    expect(resultado.nivel).toBe('ALTO');
  });

  it('pondera cada indicador segun su peso', () => {
    // Solo asistencia en rojo: 100 puntos x peso 0.3 = 30.
    const resultado = calcularRiesgo(valores({ ASISTENCIA: 50 }), UMBRALES);

    expect(resultado.puntaje).toBe(30);
  });

  it('suma los aportes de indicadores en amarillo', () => {
    // Promedio amarillo (50 x 0.4 = 20) + participacion amarilla (50 x 0.2 = 10).
    const resultado = calcularRiesgo(
      valores({ PROMEDIO: 3.2, PARTICIPACION: 2 }),
      UMBRALES,
    );

    expect(resultado.puntaje).toBe(30);
    expect(resultado.nivel).toBe('NORMAL');
  });

  it('eleva a MEDIO por la regla de anulacion cuando un indicador critico esta en rojo', () => {
    // Asistencia en rojo aporta 30 puntos: por puntaje seria NORMAL.
    const resultado = calcularRiesgo(valores({ ASISTENCIA: 50 }), UMBRALES);

    expect(resultado.puntaje).toBeLessThan(34);
    expect(resultado.nivel).toBe('MEDIO');
    expect(resultado.elevadoPorReglaCritica).toBe(true);
    expect(resultado.criticos).toContain('ASISTENCIA');
  });

  it('no aplica la regla de anulacion a indicadores no criticos', () => {
    // Entregas en rojo aporta solo 10 puntos y no es indicador critico.
    const resultado = calcularRiesgo(valores({ ENTREGAS: 5 }), UMBRALES);

    expect(resultado.puntaje).toBe(10);
    expect(resultado.nivel).toBe('NORMAL');
    expect(resultado.elevadoPorReglaCritica).toBe(false);
  });

  it('no marca como elevado un nivel que ya venia del puntaje', () => {
    const resultado = calcularRiesgo(
      valores({ PROMEDIO: 2.5, ASISTENCIA: 60 }),
      UMBRALES,
    );

    expect(resultado.puntaje).toBe(70);
    expect(resultado.nivel).toBe('ALTO');
    expect(resultado.elevadoPorReglaCritica).toBe(false);
  });

  it('normaliza los pesos cuando no suman 1', () => {
    const umbralesDesbalanceados: Umbral[] = [
      { ...UMBRALES[0], peso: 4 },
      { ...UMBRALES[1], peso: 3 },
      { ...UMBRALES[2], peso: 2 },
      { ...UMBRALES[3], peso: 1 },
    ];

    const resultado = calcularRiesgo(
      valores({ ASISTENCIA: 50 }),
      umbralesDesbalanceados,
    );

    // 3/10 del total, igual que con pesos 0.4/0.3/0.2/0.1.
    expect(resultado.puntaje).toBe(30);
  });

  it('reporta pesos limpios, sin ruido de punto flotante', () => {
    const resultado = calcularRiesgo(valores({}), UMBRALES);

    expect(resultado.detalle.map((d) => d.peso)).toEqual([0.4, 0.3, 0.2, 0.1]);
  });

  it('funciona con un subconjunto de indicadores activos', () => {
    const soloPromedio = [UMBRALES[0]];
    const resultado = calcularRiesgo(valores({ PROMEDIO: 2.0 }), soloPromedio);

    expect(resultado.puntaje).toBe(100);
    expect(resultado.nivel).toBe('ALTO');
  });

  it('ordena los indicadores criticos por peso descendente', () => {
    const resultado = calcularRiesgo(
      valores({ ASISTENCIA: 40, PROMEDIO: 2.0, ENTREGAS: 5 }),
      UMBRALES,
    );

    expect(resultado.criticos).toEqual(['PROMEDIO', 'ASISTENCIA', 'ENTREGAS']);
  });

  it('rechaza una configuracion sin umbrales', () => {
    expect(() => calcularRiesgo(valores({}), [])).toThrow(
      /No hay umbrales configurados/,
    );
  });

  it('rechaza pesos que suman cero', () => {
    const sinPeso = UMBRALES.map((u) => ({ ...u, peso: 0 }));
    expect(() => calcularRiesgo(valores({}), sinPeso)).toThrow(/mayor que cero/);
  });

  it('reporta el umbral incumplido de cada indicador', () => {
    const resultado = calcularRiesgo(
      valores({ PROMEDIO: 3.2, ASISTENCIA: 50 }),
      UMBRALES,
    );

    const promedio = resultado.detalle.find((d) => d.indicador === 'PROMEDIO');
    const asistencia = resultado.detalle.find((d) => d.indicador === 'ASISTENCIA');
    const participacion = resultado.detalle.find(
      (d) => d.indicador === 'PARTICIPACION',
    );

    // En amarillo, el umbral que falta alcanzar es el verde.
    expect(promedio?.umbralIncumplido).toBe(3.5);
    // En rojo, el umbral que ya no se cumple es el amarillo.
    expect(asistencia?.umbralIncumplido).toBe(70);
    // En verde no hay umbral incumplido.
    expect(participacion?.umbralIncumplido).toBeNull();
  });
});

describe('tipoAlertaPara', () => {
  it('usa el indicador cuando solo uno esta en rojo', () => {
    const resultado = calcularRiesgo(valores({ ASISTENCIA: 50 }), UMBRALES);
    expect(tipoAlertaPara(resultado)).toBe('ASISTENCIA');
  });

  it('usa GLOBAL cuando hay varios indicadores en rojo', () => {
    const resultado = calcularRiesgo(
      valores({ ASISTENCIA: 50, PROMEDIO: 2.0 }),
      UMBRALES,
    );
    expect(tipoAlertaPara(resultado)).toBe('GLOBAL');
  });

  it('usa GLOBAL cuando el riesgo viene de indicadores en amarillo', () => {
    const resultado = calcularRiesgo(
      valores({ PROMEDIO: 3.2, ASISTENCIA: 75, PARTICIPACION: 2 }),
      UMBRALES,
    );
    expect(tipoAlertaPara(resultado)).toBe('GLOBAL');
  });
});

describe('mensajeAlerta', () => {
  it('explica el nivel y los motivos concretos', () => {
    const resultado = calcularRiesgo(
      valores({ PROMEDIO: 2.4, ASISTENCIA: 55 }),
      UMBRALES,
    );
    const mensaje = mensajeAlerta('Karen Vergara', resultado);

    expect(mensaje).toContain('Karen Vergara');
    expect(mensaje).toContain('riesgo alto');
    expect(mensaje).toContain('promedio de 2.40');
    expect(mensaje).toContain('asistencia del 55 %');
  });

  it('omite los motivos cuando no hay indicadores en alerta', () => {
    const resultado = calcularRiesgo(valores({}), UMBRALES);
    const mensaje = mensajeAlerta('Andres Jaramillo', resultado);

    expect(mensaje).not.toContain('Motivos');
  });
});
