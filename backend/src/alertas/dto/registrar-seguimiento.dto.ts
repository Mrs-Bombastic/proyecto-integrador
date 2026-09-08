import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Acciones tipificadas de acompanamiento sobre una alerta. */
export const ACCIONES_SEGUIMIENTO = [
  'CONTACTO',
  'TUTORIA',
  'REMISION_BIENESTAR',
  'CIERRE',
  'OTRO',
] as const;

export const ESTADOS_GESTIONABLES = [
  'EN_PROCESO',
  'GESTIONADA',
  'DESCARTADA',
] as const;

export class RegistrarSeguimientoDto {
  @ApiProperty({ enum: ACCIONES_SEGUIMIENTO, example: 'CONTACTO' })
  @IsIn(ACCIONES_SEGUIMIENTO, {
    message: `La accion debe ser una de: ${ACCIONES_SEGUIMIENTO.join(', ')}`,
  })
  accion: (typeof ACCIONES_SEGUIMIENTO)[number];

  @ApiProperty({ example: 'Se contacto al estudiante por telefono; reporta dificultades de conectividad.' })
  @IsString()
  @MinLength(10, { message: 'Describa la accion realizada con al menos 10 caracteres' })
  @MaxLength(1000)
  descripcion: string;

  @ApiPropertyOptional({
    enum: ESTADOS_GESTIONABLES,
    description: 'Estado al que pasa la alerta. Si se omite, queda EN_PROCESO.',
  })
  @IsOptional()
  @IsIn(ESTADOS_GESTIONABLES)
  nuevoEstado?: (typeof ESTADOS_GESTIONABLES)[number];
}
