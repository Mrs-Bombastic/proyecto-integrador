-- CreateEnum
CREATE TYPE "MotivoDesercion" AS ENUM ('ECONOMICO', 'ACADEMICO', 'LABORAL', 'SALUD', 'FAMILIAR', 'PERSONAL', 'CAMBIO_PROGRAMA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoDesercion" AS ENUM ('RADICADA', 'EN_REVISION', 'RETENIDO', 'CONFIRMADA');

-- CreateTable
CREATE TABLE "solicitud_desercion" (
    "id" TEXT NOT NULL,
    "motivo" "MotivoDesercion" NOT NULL,
    "detalle" TEXT NOT NULL,
    "nivelRiesgo" "NivelRiesgo",
    "puntajeRiesgo" DECIMAL(5,2),
    "estado" "EstadoDesercion" NOT NULL DEFAULT 'RADICADA',
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaResolucion" TIMESTAMP(3),
    "respuesta" TEXT,
    "destinatarios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "correoEnviado" BOOLEAN NOT NULL DEFAULT false,
    "estudianteId" TEXT NOT NULL,
    "resueltaPorId" TEXT,

    CONSTRAINT "solicitud_desercion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitud_desercion_estudianteId_idx" ON "solicitud_desercion"("estudianteId");

-- CreateIndex
CREATE INDEX "solicitud_desercion_estado_fechaSolicitud_idx" ON "solicitud_desercion"("estado", "fechaSolicitud");

-- AddForeignKey
ALTER TABLE "solicitud_desercion" ADD CONSTRAINT "solicitud_desercion_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_desercion" ADD CONSTRAINT "solicitud_desercion_resueltaPorId_fkey" FOREIGN KEY ("resueltaPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
