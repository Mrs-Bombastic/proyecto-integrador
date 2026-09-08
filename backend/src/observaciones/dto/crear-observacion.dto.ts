import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CrearObservacionDto {
  @ApiProperty({ description: 'Estudiante sobre el que se registra la observacion' })
  @IsUUID()
  estudianteId: string;

  @ApiProperty({
    example: 'El estudiante ha mejorado su participacion en el foro desde la tutoria.',
  })
  @IsString()
  @MinLength(10, { message: 'La observacion debe tener al menos 10 caracteres' })
  @MaxLength(2000)
  contenido: string;

  @ApiPropertyOptional({ description: 'Curso al que corresponde la observacion' })
  @IsOptional()
  @IsUUID()
  cursoId?: string;

  @ApiPropertyOptional({
    description: 'Enlace a un documento de soporte alojado por la institucion',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  archivoUrl?: string;
}
