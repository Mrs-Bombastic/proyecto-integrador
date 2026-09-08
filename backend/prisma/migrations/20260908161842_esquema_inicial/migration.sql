-- CreateEnum
CREATE TYPE "EstadoEstudiante" AS ENUM ('ACTIVO', 'RETIRADO', 'GRADUADO');

-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('PRESENTE', 'AUSENTE', 'JUSTIFICADO', 'TARDE');

-- CreateEnum
CREATE TYPE "TipoParticipacion" AS ENUM ('FORO', 'MENSAJE', 'RECURSO', 'ACTIVIDAD');

-- CreateEnum
CREATE TYPE "EstadoEntrega" AS ENUM ('PENDIENTE', 'ENTREGADA', 'ENTREGADA_TARDE', 'VENCIDA');

-- CreateEnum
CREATE TYPE "NivelRiesgo" AS ENUM ('NORMAL', 'MEDIO', 'ALTO');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('PROMEDIO', 'ASISTENCIA', 'PARTICIPACION', 'ENTREGAS', 'GLOBAL');

-- CreateEnum
CREATE TYPE "EstadoAlerta" AS ENUM ('NUEVA', 'EN_PROCESO', 'GESTIONADA', 'DESCARTADA');

-- CreateEnum
CREATE TYPE "CanalNotificacion" AS ENUM ('PLATAFORMA', 'CORREO');

-- CreateTable
CREATE TABLE "rol" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "permisos" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcceso" TIMESTAMP(3),
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "rolId" INTEGER NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programa" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "facultad" TEXT NOT NULL,
    "modalidad" TEXT NOT NULL DEFAULT 'VIRTUAL',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "coordinadorId" TEXT,

    CONSTRAINT "programa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curso" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creditos" INTEGER NOT NULL DEFAULT 3,
    "periodo" TEXT NOT NULL,
    "programaId" TEXT NOT NULL,
    "docenteId" TEXT,

    CONSTRAINT "curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estudiante" (
    "id" TEXT NOT NULL,
    "codigoEstudiante" TEXT NOT NULL,
    "semestre" INTEGER NOT NULL DEFAULT 1,
    "fechaIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoEstudiante" NOT NULL DEFAULT 'ACTIVO',
    "usuarioId" TEXT NOT NULL,
    "programaId" TEXT NOT NULL,

    CONSTRAINT "estudiante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docente" (
    "id" TEXT NOT NULL,
    "codigoDocente" TEXT NOT NULL,
    "departamento" TEXT,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "docente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscripcion" (
    "id" TEXT NOT NULL,
    "fechaInscripcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estudianteId" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,

    CONSTRAINT "inscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calificacion" (
    "id" TEXT NOT NULL,
    "corte" INTEGER NOT NULL,
    "nota" DECIMAL(3,2) NOT NULL,
    "porcentaje" INTEGER NOT NULL DEFAULT 100,
    "descripcion" TEXT,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inscripcionId" TEXT NOT NULL,

    CONSTRAINT "calificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asistencia" (
    "id" TEXT NOT NULL,
    "fechaSesion" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoAsistencia" NOT NULL DEFAULT 'PRESENTE',
    "minutosConectado" INTEGER NOT NULL DEFAULT 0,
    "inscripcionId" TEXT NOT NULL,

    CONSTRAINT "asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participacion" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoParticipacion" NOT NULL DEFAULT 'FORO',
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "detalle" TEXT,
    "inscripcionId" TEXT NOT NULL,

    CONSTRAINT "participacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entrega" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "fechaLimite" TIMESTAMP(3) NOT NULL,
    "fechaEntrega" TIMESTAMP(3),
    "estado" "EstadoEntrega" NOT NULL DEFAULT 'PENDIENTE',
    "inscripcionId" TEXT NOT NULL,

    CONSTRAINT "entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_umbral" (
    "id" SERIAL NOT NULL,
    "indicador" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "umbralVerde" DECIMAL(6,2) NOT NULL,
    "umbralAmarillo" DECIMAL(6,2) NOT NULL,
    "mayorEsMejor" BOOLEAN NOT NULL DEFAULT true,
    "peso" DECIMAL(3,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "actualizadoPorId" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_umbral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicador_estudiante" (
    "id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "promedio" DECIMAL(3,2) NOT NULL,
    "porcentajeAsistencia" DECIMAL(5,2) NOT NULL,
    "participacionSemanal" DECIMAL(5,2) NOT NULL,
    "entregasVencidas" INTEGER NOT NULL DEFAULT 0,
    "puntajeRiesgo" DECIMAL(5,2) NOT NULL,
    "nivelRiesgo" "NivelRiesgo" NOT NULL DEFAULT 'NORMAL',
    "calculadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estudianteId" TEXT NOT NULL,

    CONSTRAINT "indicador_estudiante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerta" (
    "id" TEXT NOT NULL,
    "tipoAlerta" "TipoAlerta" NOT NULL,
    "nivelRiesgo" "NivelRiesgo" NOT NULL,
    "puntajeRiesgo" DECIMAL(5,2) NOT NULL,
    "valorObservado" DECIMAL(6,2) NOT NULL,
    "umbralSuperado" DECIMAL(6,2) NOT NULL,
    "mensaje" TEXT NOT NULL,
    "estado" "EstadoAlerta" NOT NULL DEFAULT 'NUEVA',
    "fechaGeneracion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaGestion" TIMESTAMP(3),
    "estudianteId" TEXT NOT NULL,
    "cursoId" TEXT,
    "gestionadaPorId" TEXT,

    CONSTRAINT "alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seguimiento" (
    "id" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alertaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "seguimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observacion" (
    "id" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivoUrl" TEXT,
    "estudianteId" TEXT NOT NULL,
    "docenteId" TEXT NOT NULL,
    "cursoId" TEXT,

    CONSTRAINT "observacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacion" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "canal" "CanalNotificacion" NOT NULL DEFAULT 'PLATAFORMA',
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "fechaEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "alertaId" TEXT,

    CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "detalle" TEXT,
    "ip" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rol_nombre_key" ON "rol"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_rolId_idx" ON "usuario"("rolId");

-- CreateIndex
CREATE UNIQUE INDEX "programa_codigo_key" ON "programa"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "curso_codigo_key" ON "curso"("codigo");

-- CreateIndex
CREATE INDEX "curso_programaId_idx" ON "curso"("programaId");

-- CreateIndex
CREATE INDEX "curso_docenteId_idx" ON "curso"("docenteId");

-- CreateIndex
CREATE UNIQUE INDEX "estudiante_codigoEstudiante_key" ON "estudiante"("codigoEstudiante");

-- CreateIndex
CREATE UNIQUE INDEX "estudiante_usuarioId_key" ON "estudiante"("usuarioId");

-- CreateIndex
CREATE INDEX "estudiante_programaId_idx" ON "estudiante"("programaId");

-- CreateIndex
CREATE UNIQUE INDEX "docente_codigoDocente_key" ON "docente"("codigoDocente");

-- CreateIndex
CREATE UNIQUE INDEX "docente_usuarioId_key" ON "docente"("usuarioId");

-- CreateIndex
CREATE INDEX "inscripcion_cursoId_idx" ON "inscripcion"("cursoId");

-- CreateIndex
CREATE UNIQUE INDEX "inscripcion_estudianteId_cursoId_key" ON "inscripcion"("estudianteId", "cursoId");

-- CreateIndex
CREATE INDEX "calificacion_inscripcionId_idx" ON "calificacion"("inscripcionId");

-- CreateIndex
CREATE INDEX "asistencia_inscripcionId_idx" ON "asistencia"("inscripcionId");

-- CreateIndex
CREATE INDEX "participacion_inscripcionId_idx" ON "participacion"("inscripcionId");

-- CreateIndex
CREATE INDEX "entrega_inscripcionId_idx" ON "entrega"("inscripcionId");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_umbral_indicador_key" ON "configuracion_umbral"("indicador");

-- CreateIndex
CREATE INDEX "indicador_estudiante_estudianteId_calculadoEn_idx" ON "indicador_estudiante"("estudianteId", "calculadoEn");

-- CreateIndex
CREATE INDEX "indicador_estudiante_nivelRiesgo_idx" ON "indicador_estudiante"("nivelRiesgo");

-- CreateIndex
CREATE INDEX "alerta_estudianteId_idx" ON "alerta"("estudianteId");

-- CreateIndex
CREATE INDEX "alerta_estado_nivelRiesgo_idx" ON "alerta"("estado", "nivelRiesgo");

-- CreateIndex
CREATE INDEX "seguimiento_alertaId_idx" ON "seguimiento"("alertaId");

-- CreateIndex
CREATE INDEX "observacion_estudianteId_idx" ON "observacion"("estudianteId");

-- CreateIndex
CREATE INDEX "notificacion_usuarioId_leida_idx" ON "notificacion"("usuarioId", "leida");

-- CreateIndex
CREATE INDEX "auditoria_fecha_idx" ON "auditoria"("fecha");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programa" ADD CONSTRAINT "programa_coordinadorId_fkey" FOREIGN KEY ("coordinadorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso" ADD CONSTRAINT "curso_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "programa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso" ADD CONSTRAINT "curso_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "docente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudiante" ADD CONSTRAINT "estudiante_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudiante" ADD CONSTRAINT "estudiante_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "programa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docente" ADD CONSTRAINT "docente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificacion" ADD CONSTRAINT "calificacion_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia" ADD CONSTRAINT "asistencia_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacion" ADD CONSTRAINT "participacion_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion_umbral" ADD CONSTRAINT "configuracion_umbral_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicador_estudiante" ADD CONSTRAINT "indicador_estudiante_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "curso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_gestionadaPorId_fkey" FOREIGN KEY ("gestionadaPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento" ADD CONSTRAINT "seguimiento_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "alerta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento" ADD CONSTRAINT "seguimiento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observacion" ADD CONSTRAINT "observacion_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observacion" ADD CONSTRAINT "observacion_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "docente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observacion" ADD CONSTRAINT "observacion_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "curso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "alerta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
