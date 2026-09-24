import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Estados a los que puede mover la solicitud quien la atiende.
 *
 * `RADICADA` no aparece: es el estado inicial y nadie vuelve a el, porque eso
 * borraria el rastro de que el caso ya fue tomado.
 */
export const ESTADOS_RESOLUCION = [
  'EN_REVISION',
  'RETENIDO',
  'CONFIRMADA',
] as const;

export type EstadoResolucion = (typeof ESTADOS_RESOLUCION)[number];

export class ResolverDesercionDto {
  @ApiProperty({
    enum: ESTADOS_RESOLUCION,
    description:
      'EN_REVISION: se inicia el acompanamiento. RETENIDO: el estudiante continua. CONFIRMADA: retiro efectivo, el estudiante pasa a RETIRADO.',
  })
  @IsIn(ESTADOS_RESOLUCION, {
    message: `El estado debe ser uno de: ${ESTADOS_RESOLUCION.join(', ')}`,
  })
  estado: EstadoResolucion;

  @ApiProperty({
    example:
      'Se ofreció aplazamiento de semestre y apoyo del fondo de permanencia; el estudiante acepta continuar.',
  })
  @IsString()
  @MinLength(10, {
    message: 'Describa la gestión realizada con al menos 10 caracteres',
  })
  @MaxLength(1000)
  respuesta: string;
}
