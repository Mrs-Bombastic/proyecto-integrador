import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Motivos tipificados de desercion. Coinciden con el enum `MotivoDesercion` del
 * esquema: son una lista cerrada para que las cifras se puedan agregar y
 * comparar, no texto libre.
 */
export const MOTIVOS_DESERCION = [
  'ECONOMICO',
  'ACADEMICO',
  'LABORAL',
  'SALUD',
  'FAMILIAR',
  'PERSONAL',
  'CAMBIO_PROGRAMA',
  'OTRO',
] as const;

export type MotivoDesercionDto = (typeof MOTIVOS_DESERCION)[number];

export class CrearDesercionDto {
  @ApiProperty({ enum: MOTIVOS_DESERCION, example: 'ECONOMICO' })
  @IsIn(MOTIVOS_DESERCION, {
    message: `El motivo debe ser uno de: ${MOTIVOS_DESERCION.join(', ')}`,
  })
  motivo: MotivoDesercionDto;

  @ApiProperty({
    example:
      'Perdí el empleo con el que pagaba la matrícula y no logro sostener los horarios de las sesiones sincrónicas.',
    description:
      'Explicacion del estudiante. Es el dato que permite intervenir la desercion, por eso se exige un minimo de detalle.',
  })
  @IsString()
  @MinLength(20, {
    message: 'Explique los motivos con al menos 20 caracteres',
  })
  @MaxLength(2000)
  detalle: string;

  @ApiProperty({
    example: true,
    description:
      'Confirmacion explicita del estudiante. Evita que un clic accidental radique un retiro y notifique a docentes y directivos.',
  })
  @IsBoolean()
  @Equals(true, {
    message: 'Debe confirmar que desea radicar la solicitud de retiro',
  })
  confirmo: boolean;
}
