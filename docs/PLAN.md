# Plan de desarrollo — Dashboard de Seguimiento Académico y Alertas Tempranas

**Equipo:** Andrés Jaramillo · Karen Vergara · Eulices Morales
**Curso:** Proyecto Integrado I — PREICA2602B010236
**Entrega final:** 20/09/2026

---

## 1. Decisiones de arquitectura tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Backend | NestJS 12 + TypeScript | Arquitectura modular por diseño, satisface RNF08 |
| ORM | Prisma + PostgreSQL | `schema.prisma` es traducción literal del MER; migraciones versionadas |
| Frontend | Angular 22 + TailwindCSS | SPA con rutas protegidas por rol; Tailwind acelera los prototipos ya diseñados |
| Gráficas | Chart.js | Notas por curso y evolución de indicadores |
| Base de datos local | Docker (`docker-compose.yml`) | No exige instalar PostgreSQL en cada máquina del equipo |
| Autenticación | JWT + bcrypt | RF01 con roles y guards por endpoint |
| Origen de datos | Semilla + importación CSV | **Decisión de alcance:** no se integra con un LMS real en esta fase |

## 2. Decisiones de alcance que corrigen el documento de análisis

1. **Roles con acceso al sistema:** estudiante, docente, coordinador y administrador.
   Bienestar Universitario, Dirección de Programa y Registro y Control son
   *stakeholders receptores*: reciben reportes y notificaciones, sin usuario.
2. **Matriz de riesgo:** definida en `docs/matriz-riesgo.md`. Era el vacío más
   grave del documento anterior.
3. **RF13 (nuevo):** escalamiento automático a Bienestar cuando una alerta de
   nivel ALTO lleva más de 5 días hábiles sin gestión.
4. **RNF de seguridad ampliados:** política de contraseñas, bloqueo por intentos
   fallidos, expiración de sesión, registro de auditoría.
5. **Integración con LMS:** se especifica la interfaz de importación, no se
   implementa la conexión en vivo. Se documenta como límite del MVP.
6. **Las observaciones docentes son de uso interno.** El estudiante no las ve
   desde su panel. Son notas de acompañamiento entre docentes y coordinación,
   y exponerlas cambiaría lo que un docente se atreve a escribir. El documento
   original no lo definía; esta es la decisión adoptada.
7. **El correo se simula si no hay SMTP configurado.** El mensaje se registra
   en el log en lugar de fallar, para que el equipo pueda desarrollar y
   sustentar sin credenciales de correo.

## 3. Cronograma corregido

El cronograma original tenía integración y pruebas empezando el mismo día que
el desarrollo, e implementación terminando antes que el frontend. Secuencia
corregida:

| Fase | Días | Fechas | Entregable |
|---|---|---|---|
| 1. Fundación ✅ | 1–3 | 08–10 sep | Esquema, migraciones, autenticación con roles, datos semilla |
| 2. Motor de riesgo ✅ | 4–5 | 11–12 sep | Cálculo de indicadores, matriz, generación de alertas + pruebas |
| 3. Dashboards ✅ | 6–8 | 13–15 sep | Paneles de estudiante, docente y coordinador con semáforo y filtros |
| 4. Complementos ✅ | 9–10 | 16–17 sep | Observaciones, historial, notificaciones, exportación PDF/Excel |
| 5. Integración y despliegue | 11 | 18 sep | Pruebas end-to-end, correcciones, despliegue con HTTPS |
| 6. Documentación y sustentación | 12 | 19–20 sep | README, manual de usuario, documento corregido, demo ensayada |

## 4. Trazabilidad requisito → implementación

| RF | Descripción | Dónde se implementa |
|---|---|---|
| RF01 | Autenticación y roles | `backend/src/auth`, tabla `rol`, guards |
| RF02 | Calificaciones por curso/corte/periodo | `desglosePorCurso` + tabla y gráfica en la ficha |
| RF03 | Asistencia y su histórico | `desglosePorCurso` + historial sesión por sesión |
| RF04 | Participación en foros | modelo `Participacion`, módulo `indicadores` |
| RF05 | Alertas automáticas por umbrales | `backend/src/riesgo` + `configuracion_umbral` |
| RF06 | Observaciones cualitativas | `backend/src/observaciones` + ficha del estudiante |
| RF07 | Exportación PDF y Excel | `backend/src/reportes` (pdfmake, exceljs) |
| RF08 | Filtros por programa/curso/cohorte/periodo | query params + catalogos de cohortes y periodos |
| RF09 | Notificaciones correo y plataforma | `Notificacion` + `backend/src/correo` |
| RF10 | Panel individual del estudiante | ruta `/mi-progreso` |
| RF11 | Panel consolidado del coordinador | ruta `/coordinacion` |
| RF12 | Historial de alertas y seguimientos | `IndicadorEstudiante`, `Seguimiento` |
| RF13 | Escalamiento a Bienestar | `riesgo.service.escalarABienestar` + `correo` |
| CU · Gestionar usuarios y roles | Alta, rol, estado, contraseña y auditoría | `backend/src/usuarios`, ruta `/usuarios` |

## 5. Reparto sugerido

- **Backend / motor de riesgo:** modelos, servicio de cálculo, alertas, pruebas
- **Frontend / dashboards:** componentes, gráficas, filtros, semáforo, responsive
- **Datos, reportes y documentación:** semilla, exportación, manual, sustentación

Trabajar con ramas por funcionalidad. El historial de commits también es
evidencia evaluable.

## 6. Riesgos del desarrollo (distintos a los del documento)

| Riesgo | Mitigación |
|---|---|
| El stack elegido (Nest + Angular) cuesta ~3 días más que un monolito | Alcance recortado: sin app móvil, sin integración LMS en vivo |
| Docker no disponible en alguna máquina del equipo | `DATABASE_URL` apunta a cualquier PostgreSQL; se puede usar uno en la nube gratuito |
| Frontend inconcluso el día de la entrega | Fase 3 antes que fase 4: es preferible entregar dashboards sin exportación que al revés |
