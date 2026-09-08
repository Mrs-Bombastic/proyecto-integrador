import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service.js';
import { Publico } from './auth/decoradores.js';

@ApiTags('Sistema')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Publico()
  @Get('salud')
  @ApiOperation({ summary: 'Verifica que la API y la base de datos responden' })
  salud() {
    return this.appService.salud();
  }
}
