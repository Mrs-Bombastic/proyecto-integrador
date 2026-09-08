# Dashboard de Seguimiento Académico y Alertas Tempranas

Sistema de información que centraliza calificaciones, asistencia y participación
de estudiantes de programas virtuales, calcula indicadores de riesgo académico y
genera alertas tempranas para docentes y coordinadores.

**Proyecto Integrado I** — PREICA2602B010236
Andrés Jaramillo · Karen Vergara · Eulices Morales
Institución Universitaria Digital de Antioquia

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | NestJS 12 (TypeScript, ESM) |
| ORM | Prisma 7 con adaptador `pg` |
| Base de datos | PostgreSQL 16 (Docker) |
| Frontend | Angular 22 + TailwindCSS 4 |
| Gráficas | Chart.js |
| Autenticación | JWT + bcrypt |
| Reportes | ExcelJS y pdfmake |
| Correo | Nodemailer (simulado sin SMTP) |

## Requisitos previos

- Node.js 22 o superior
- Docker Desktop (para la base de datos)

## Puesta en marcha

```bash
# 1. Base de datos
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

La API queda en <http://localhost:3000/api> y la documentación interactiva
(Swagger) en <http://localhost:3000/api/docs>.

```bash
# 3. Frontend (en otra terminal)
cd frontend
npm install
npm start
```

La aplicación queda en <http://localhost:4200>.

## Usuarios de prueba

Contraseña para todos: `Dashboard2026*`

| Rol | Correo |
|---|---|
| Administrador | `admin@dashboard.edu.co` |
| Coordinador | `coordinador.isd@dashboard.edu.co` |
| Docente | `docente1@dashboard.edu.co` |
| Estudiante (desempeño alto) | `est0001@estudiante.edu.co` |
| Estudiante (riesgo alto) | `est0195@estudiante.edu.co` |

Los datos semilla generan un periodo académico completo (2026-2) para 200
estudiantes en 4 programas, con una distribución de desempeño que produce los
tres niveles del semáforo. El generador es determinista: todo el equipo obtiene
exactamente los mismos datos.

## Comandos útiles

```bash
cd backend
npm run db:migrate    # aplica cambios del esquema
npm run db:seed       # recarga los datos de prueba
npm run db:reset      # borra, migra y siembra desde cero
npm run db:studio     # explorador visual de la base de datos
npm test              # pruebas unitarias
npm run test:e2e      # pruebas de integración
```

## Estructura

```
backend/
  prisma/
    schema.prisma     modelo de datos (traducción del MER)
    seed.ts           datos de prueba deterministas
  src/
    auth/             RF01 - autenticación, roles y guards
    prisma/           cliente de base de datos compartido
frontend/
  src/                aplicación Angular
docs/
  PLAN.md             plan de desarrollo y cronograma corregido
  matriz-riesgo.md    especificación del motor de riesgo (RF05)
```

## Documentación

- [Plan de desarrollo](docs/PLAN.md) — decisiones de arquitectura, cronograma
  corregido y trazabilidad de requisitos.
- [Matriz de riesgo](docs/matriz-riesgo.md) — cómo se calcula el nivel de riesgo
  de un estudiante y cómo se generan y gestionan las alertas.

## Notificaciones por correo

Sin `SMTP_HOST` configurado en el `.env`, los correos **no se envían**: se
registran en el log del servidor con su destinatario y contenido completo. Así
el equipo puede desarrollar y sustentar el proyecto sin credenciales de correo,
y el mismo código envía de verdad en producción con solo completar las
variables de entorno.

El escalamiento automático a Bienestar Universitario (RF13) usa este mismo
canal: `BIENESTAR_EMAIL` define el destinatario.

## Alcance de esta fase

El sistema **no se conecta a un LMS real**. Los datos académicos provienen de la
semilla y, más adelante, de importación por archivo. La interfaz de integración
queda especificada pero no implementada; es una decisión de alcance del MVP,
documentada en `docs/PLAN.md`.
