-- AlterTable
ALTER TABLE "estudiante" ADD COLUMN     "cohorte" TEXT NOT NULL DEFAULT '2026-1';

-- CreateIndex
CREATE INDEX "estudiante_cohorte_idx" ON "estudiante"("cohorte");
