import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ActualizarUmbralDto {
  @ApiPropertyOptional({ example: 3.5, description: 'Valor a partir del cual el indicador es verde' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  umbralVerde?: number;

  @ApiPropertyOptional({ example: 3.0, description: 'Valor a partir del cual el indicador es amarillo' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  umbralAmarillo?: number;

  @ApiPropertyOptional({ example: 0.4, description: 'Peso del indicador en el puntaje global (0 a 1)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  peso?: number;

  @ApiPropertyOptional({ example: true, description: 'Si el indicador participa en el calculo' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
