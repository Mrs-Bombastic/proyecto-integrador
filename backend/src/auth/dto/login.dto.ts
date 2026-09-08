import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'coordinador.isd@dashboard.edu.co' })
  @IsEmail({}, { message: 'El correo no tiene un formato valido' })
  email: string;

  @ApiProperty({ example: 'Dashboard2026*' })
  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  password: string;
}
