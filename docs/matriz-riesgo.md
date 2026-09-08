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
4. Cada alerta creada genera una notificación en plataforma para el coordinador
   del programa y para el docente del curso, y un correo si el canal está
   configurado (RF09).

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
