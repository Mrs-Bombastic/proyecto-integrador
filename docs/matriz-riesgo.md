# Matriz de riesgo académico

> Documento de especificación que complementa el RF05 del documento de análisis.
> El análisis del entregable anterior identificó que el sistema mencionaba
> umbrales de ejemplo (asistencia < 70 %, promedio < 3.0) pero no definía cómo
> se combinan para determinar el nivel de riesgo de un estudiante. Esta es esa
> definición, y es la que implementa el motor de riesgo del backend.

## 1. Indicadores y cortes

| Indicador | Verde (0 pts) | Amarillo (50 pts) | Rojo (100 pts) | Peso |
|---|---|---|---|---|
| Promedio acumulado | ≥ 3.5 | 3.0 – 3.49 | < 3.0 | 40 % |
| Porcentaje de asistencia | ≥ 85 % | 70 – 84 % | < 70 % | 30 % |
| Participación (interacciones/semana) | ≥ 3 | 1 – 2 | < 1 | 20 % |
| Entregas vencidas (últimas 4 semanas) | 0 | 1 – 2 | ≥ 3 | 10 % |

Los cortes **no están fijos en el código**: viven en la tabla
`configuracion_umbral` y el administrador los modifica desde la interfaz
(caso de uso 5). El motor los lee en cada cálculo.

Para el indicador de entregas vencidas, `mayorEsMejor = false`: valores más
altos son peores, y la comparación se invierte.

## 1.1 Cómo se calcula cada indicador

| Indicador | Cálculo |
|---|---|
| Promedio acumulado | Promedio de todas las calificaciones del estudiante en el periodo, sobre todos sus cursos |
| Porcentaje de asistencia | `(presentes + tardes) / (total de sesiones − justificadas) × 100` |
| Participación | `total de interacciones / (semanas transcurridas × número de cursos)` |
| Entregas vencidas | Entregas en estado `VENCIDA` cuya fecha límite cae en las últimas 4 semanas |

Sobre la asistencia: **las inasistencias justificadas se excluyen del
denominador en lugar de contarse como ausencia.** Penalizarlas castigaría a un
estudiante que reportó su situación a tiempo, que es justamente el
comportamiento que la institución quiere fomentar. Un estudiante con 10
sesiones, 6 presentes, 2 ausencias y 2 justificadas obtiene 75 % y no 60 %.

La ventana de 4 semanas del indicador de entregas es deliberada: lo que importa
para una alerta temprana es el rezago reciente, no un incumplimiento del inicio
del semestre que el estudiante ya remontó.

## 2. Puntaje global

```
puntajeRiesgo = Σ (puntos_indicador × peso_indicador)
```

Resultado entre 0 y 100, donde 0 es un estudiante sin ninguna señal de riesgo.

| Puntaje | Nivel | Color en el dashboard |
|---|---|---|
| 0 – 33 | NORMAL | Verde |
| 34 – 66 | MEDIO | Amarillo |
| 67 – 100 | ALTO | Rojo |

## 3. Regla de anulación

Un promedio ponderado puede ocultar una señal grave. Por eso:

> Si **promedio** o **asistencia** caen en rojo, el nivel de riesgo del
> estudiante es como mínimo **MEDIO**, aunque el puntaje calculado dé NORMAL.

Ejemplo: un estudiante con promedio 2.8 (rojo, 100 pts × 0.40 = 40) pero
asistencia 95 %, participación alta y cero entregas vencidas obtiene un puntaje
de 40 → MEDIO. Sin la regla ya daba MEDIO; la regla importa en casos con
ponderaciones ajustadas por el administrador.

## 4. Generación de alertas

En cada ejecución del motor, por estudiante:

1. Se calcula el snapshot de indicadores y se guarda en `indicador_estudiante`
   (permite responder el dashboard sin recalcular — RNF02 — y conservar la
   evolución histórica — RF12).
2. Si el nivel resultante es MEDIO o ALTO y **no existe** ya una alerta abierta
   (`NUEVA` o `EN_PROCESO`) del mismo tipo para ese estudiante, se crea una
   alerta nueva. Esto evita duplicados en ejecuciones sucesivas.
3. Si el nivel resultante es NORMAL y existían alertas abiertas de tipo GLOBAL,
   se cierran automáticamente con estado `GESTIONADA` y un seguimiento de
   sistema que registra la recuperación.
4. Cada alerta creada se notifica en plataforma y por correo a las tres partes
   que pueden actuar sobre ella (RF09):
   - los **docentes** de los cursos en que el estudiante está inscrito —cada uno
     recibe además el nombre de sus propios cursos con ese estudiante—, porque
     son quienes intervienen sobre la nota y la entrega concretas;
   - la **coordinación** del programa, que hace el seguimiento del caso;
   - el **propio estudiante**, con un texto sin puntajes ni umbrales que le
     indica qué indicador recuperar y le recuerda que puede pedir
     acompañamiento. Una alerta temprana que no llega a quien debe reaccionar no
     es temprana, es solo un registro.

   Si no hay proveedor de correo configurado, el aviso queda en plataforma y el
   mensaje completo se escribe en el log. Un recálculo despacha como máximo 60
   correos para no agotar la cuota del proveedor gratuito.

## 5. Ciclo de vida de una alerta

```
NUEVA ──► EN_PROCESO ──► GESTIONADA
  │                          ▲
  └────────► DESCARTADA      │
                             │
        (recuperación automática del estudiante)
```

Cada transición exige registrar un `Seguimiento` con la acción realizada
(CONTACTO, TUTORIA, REMISION_BIENESTAR, CIERRE, OTRO) y una descripción. Así la
alerta deja de ser un semáforo y se convierte en un caso trazable.

## 6. Escalamiento a Bienestar Universitario

Requisito nuevo respecto del documento original, donde este flujo se mencionaba
sin especificarse:

> Una alerta de nivel **ALTO** que permanezca en estado `NUEVA` durante más de
> **5 días hábiles** se escala automáticamente: se notifica a Bienestar
> Universitario por correo con los datos de contacto del estudiante y el
> historial de indicadores, y la alerta queda marcada como escalada.

Bienestar no tiene usuario en el sistema; es un destinatario de notificaciones.
Esta decisión resuelve la ambigüedad de roles que señaló el análisis.

## 7. Frecuencia de cálculo

- Ejecución programada diaria (tarea nocturna).
- Ejecución manual bajo demanda por el administrador o el coordinador.
- Recálculo del estudiante afectado al registrarse una calificación,
  asistencia, participación o entrega.

## 8. Relación con el retiro declarado por el estudiante (RF14)

La deserción es el desenlace que la matriz de riesgo intenta evitar, así que los
dos flujos se conectan en tres puntos:

1. **El aviso al estudiante ofrece la salida documentada.** El mensaje de alerta
   le indica que, si su situación le impide continuar, lo cuente por la opción
   *Retiro del programa* antes de decidir. Un estudiante que abandona sin avisar
   no deja ningún dato con el que intervenir; uno que declara el motivo, sí.
2. **La solicitud congela el riesgo del momento.** `SolicitudDesercion` guarda
   `nivelRiesgo` y `puntajeRiesgo` tal como estaban al radicarla. Eso permite
   evaluar después la pregunta que valida todo el sistema: ¿el motor alcanzó a
   alertar antes de que el estudiante desistiera, y alguien gestionó esa alerta?
3. **Confirmar el retiro cierra las alertas abiertas.** Al pasar el estudiante a
   `RETIRADO`, sus alertas `NUEVA` y `EN_PROCESO` pasan a `DESCARTADA`. De lo
   contrario quedarían como casos abiertos inatendibles en el panel del
   coordinador y seguirían disparando el escalamiento a Bienestar del RF13 sobre
   alguien que ya no está matriculado.

Los estados de la solicitud son `RADICADA` → `EN_REVISION` → `RETENIDO` o
`CONFIRMADA`. `RETENIDO` es el resultado que persigue el sistema: el estudiante
declaró su intención de irse, alguien intervino y se queda.
