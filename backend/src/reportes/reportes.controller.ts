import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles, UsuarioActual } from '../auth/decoradores.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { ReportesService, type ArchivoGenerado } from './reportes.service.js';

@ApiTags('Reportes')
@ApiBearerAuth()
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('estudiantes.xlsx')
  @Roles('DOCENTE', 'COORDINADOR', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'RF07 - Listado de estudiantes en Excel' })
  @ApiQuery({ name: 'programaId', required: false })
  @ApiQuery({ name: 'cursoId', required: false })
  @ApiQuery({ name: 'nivelRiesgo', required: false })
  async estudiantesExcel(
    @Res() res: Response,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('programaId') programaId?: string,
    @Query('cursoId') cursoId?: string,
    @Query('nivelRiesgo') nivelRiesgo?: string,
    @Query('busqueda') busqueda?: string,
  ): Promise<void> {
    this.responder(
      res,
      await this.reportes.estudiantesExcel(usuario, {
        programaId,
        cursoId,
        nivelRiesgo,
        busqueda,
      }),
    );
  }

  @Get('estudiantes.pdf')
  @Roles('DOCENTE', 'COORDINADOR', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'RF07 - Listado de estudiantes en PDF' })
  async estudiantesPdf(
    @Res() res: Response,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('programaId') programaId?: string,
    @Query('cursoId') cursoId?: string,
    @Query('nivelRiesgo') nivelRiesgo?: string,
    @Query('busqueda') busqueda?: string,
  ): Promise<void> {
    this.responder(
      res,
      await this.reportes.estudiantesPdf(usuario, {
        programaId,
        cursoId,
        nivelRiesgo,
        busqueda,
      }),
    );
  }

  @Get('alertas.xlsx')
  @Roles('DOCENTE', 'COORDINADOR', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'RF07 - Alertas y su gestion en Excel' })
  async alertasExcel(
    @Res() res: Response,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('estado') estado?: string,
    @Query('nivelRiesgo') nivelRiesgo?: string,
    @Query('programaId') programaId?: string,
  ): Promise<void> {
    this.responder(
      res,
      await this.reportes.alertasExcel(usuario, {
        estado,
        nivelRiesgo,
        programaId,
      }),
    );
  }

  @Get('estudiante/:id.pdf')
  @ApiOperation({
    summary: 'RF07 - Ficha individual de seguimiento en PDF',
  })
  async estudiantePdf(
    @Param('id') id: string,
    @Res() res: Response,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    this.responder(res, await this.reportes.estudiantePdf(id, usuario));
  }

  /**
   * Escribe el archivo en la respuesta. `Content-Disposition` con `attachment`
   * hace que el navegador lo descargue con el nombre indicado en lugar de
   * intentar mostrarlo.
   */
  private responder(res: Response, archivo: ArchivoGenerado): void {
    res.setHeader('Content-Type', archivo.tipoMime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${archivo.nombre}"`,
    );
    res.setHeader('Content-Length', archivo.contenido.length);
    res.end(archivo.contenido);
  }
}
