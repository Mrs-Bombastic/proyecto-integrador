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
    correo/           RF09 - envío por Gmail, Brevo o log; resolución de destinatarios
    desercion/        RF14 - retiro declarado por el estudiante
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

Sin credenciales configuradas en el `.env`, los correos **no se envían**: se
registran en el log del servidor con su destinatario y contenido completo. Así
el equipo puede desarrollar y sustentar el proyecto sin credenciales de correo,
y el mismo código envía de verdad con solo completar las variables de entorno.

### Quién recibe qué

| Situación | Docentes del estudiante | Coordinación y directivas | Estudiante |
|---|---|---|---|
| Se genera una alerta de riesgo medio o alto (RF09) | ✅ correo + plataforma | ✅ correo + plataforma | ✅ correo + plataforma |
| Alerta alta sin gestión por 5 días hábiles (RF13) | — | ✅ Bienestar, por correo | — |
| El estudiante radica su retiro (RF14) | ✅ correo + plataforma | ✅ correo + plataforma | ✅ acuse de recibo |
| Coordinación resuelve el retiro (RF14) | — | — | ✅ correo + plataforma |

El estudiante recibe un texto distinto al interno: sin puntajes ni umbrales,
indicando qué indicador debe recuperar. Un aviso que suene a sanción consigue lo
contrario de lo que busca un sistema de alertas tempranas.

### Activar el envío real con una API gratuita

Basta configurar **una** de las dos opciones. El sistema detecta sola cuál usar
y lo informa al arrancar (`Correo saliente por…`).

**Opción A — Gmail** (500 correos/día, sin registrarse en ningún servicio nuevo):

1. En la cuenta de Google, activar la verificación en dos pasos.
2. Crear una contraseña de aplicación en <https://myaccount.google.com/apppasswords>.
3. En `backend/.env`:

```env
GMAIL_USER="cuenta.del.equipo@gmail.com"
GMAIL_APP_PASSWORD="abcd efgh ijkl mnop"
```

**Opción B — Brevo** (API HTTP, 300 correos/día; recomendada en despliegue
porque no usa puertos SMTP, que Railway y otros hosts bloquean):

1. Cuenta gratuita en <https://www.brevo.com>.
2. Verificar el correo remitente —puede ser el mismo Gmail— en *Senders*.
3. Copiar la clave de <https://app.brevo.com/settings/keys/api>.
4. En `backend/.env`:

```env
BREVO_API_KEY="xkeysib-..."
CORREO_REMITENTE="cuenta.del.equipo@gmail.com"
```

Para volver al modo simulación sin borrar las credenciales:
`CORREO_PROVEEDOR="log"`.

> Un recálculo completo puede generar alertas para decenas de estudiantes a la
> vez. El motor despacha como máximo 60 correos por ejecución y deja el resto
> solo en plataforma, para no agotar la cuota diaria del proveedor gratuito.

`BIENESTAR_EMAIL` y `DIRECTIVOS_EMAIL` (separados por coma) definen los
destinatarios que no tienen usuario en el sistema: Bienestar Universitario,
Dirección Académica y Registro y Control.

## Retiro del programa (RF14)

El estudiante puede declarar que quiere dejar el programa desde
**Retiro del programa** en su menú, eligiendo el motivo de una lista cerrada
(económico, laboral, académico, salud, familiar, personal, cambio de programa,
otro) y explicándolo por escrito.

Al enviarlo:

1. Se notifica en el acto a los docentes de sus cursos, a la coordinación del
   programa y a las directivas configuradas por correo.
2. La matrícula **no** se retira. La solicitud queda `RADICADA` y aparece en
   **Retiros** para docentes, coordinación y administración.
3. Coordinación la atiende y decide: `EN_REVISION` (toma el caso), `RETENIDO`
   (el estudiante continúa) o `CONFIRMADA` (retiro efectivo: el estudiante pasa
   a `RETIRADO` y se descartan sus alertas abiertas).
4. El estudiante recibe por correo y en plataforma la respuesta de coordinación.

La solicitud guarda el nivel de riesgo del estudiante en el momento de radicarla,
lo que permite analizar después si el sistema alcanzó a alertar antes de que
desistiera.

## Alcance de esta fase

El sistema **no se conecta a un LMS real**. Los datos académicos provienen de la
semilla y, más adelante, de importación por archivo. La interfaz de integración
queda especificada pero no implementada; es una decisión de alcance del MVP,
documentada en `docs/PLAN.md`.
