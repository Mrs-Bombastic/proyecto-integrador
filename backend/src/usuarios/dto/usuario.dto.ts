import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Política de contraseñas del sistema (RNF de seguridad ampliados): al menos
 * ocho caracteres con mayúscula, minúscula y dígito. Se valida en el servidor
 * porque una comprobación solo en la interfaz no protege nada.
 */
const REGLA_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const MENSAJE_PASSWORD =
  'La contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula y número';

export class CrearUsuarioDto {
  @ApiProperty({ example: 'Karen' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombres: string;

  @ApiProperty({ example: 'Vergara' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  apellidos: string;

  @ApiProperty({ example: 'karen.vergara@dashboard.edu.co' })
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  email: string;

  @ApiProperty({ example: 'Dashboard2026*' })
  @Matches(REGLA_PASSWORD, { message: MENSAJE_PASSWORD })
  password: string;

  @ApiProperty({ description: 'Identificador del rol asignado', example: 2 })
  @IsInt()
  rolId: number;
}

export class ActualizarUsuarioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombres?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  apellidos?: string;

  @ApiPropertyOptional({ description: 'Rol asignado al usuario' })
  @IsOptional()
  @IsInt()
  rolId?: number;

  @ApiPropertyOptional({ description: 'Un usuario inactivo no puede iniciar sesión' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class RestablecerPasswordDto {
  @ApiProperty({ example: 'NuevaClave2026' })
  @Matches(REGLA_PASSWORD, { message: MENSAJE_PASSWORD })
  password: string;
}
