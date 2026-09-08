import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
  Alerta,
  Cohorte,
  Curso,
  Observacion,
  RegistroAuditoria,
  RolSistema,
  UsuarioAdmin,
  DetalleEstudiante,
  EstudianteRiesgo,
  Notificacion,
  Programa,
  ResumenAlertas,
  ResumenRiesgo,
  Umbral,
} from './modelos';

export type FiltrosEstudiantes = {
  programaId?: string;
  cursoId?: string;
  nivelRiesgo?: string;
  busqueda?: string;
  cohorte?: string;
  periodo?: string;
}

export type FiltrosAlertas = {
  estado?: string;
  nivelRiesgo?: string;
  programaId?: string;
  cursoId?: string;
}

/** Cliente unico de la API. Centraliza rutas y armado de parametros. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.api;

  // --------------------------- Estudiantes --------------------------------

  estudiantes(filtros: FiltrosEstudiantes = {}): Promise<EstudianteRiesgo[]> {
    return firstValueFrom(
      this.http.get<EstudianteRiesgo[]>(`${this.base}/estudiantes`, {
        params: this.parametros(filtros),
      }),
    );
  }

  estudiante(id: string): Promise<DetalleEstudiante> {
    return firstValueFrom(
      this.http.get<DetalleEstudiante>(`${this.base}/estudiantes/${id}`),
    );
  }

  // ------------------------------ Riesgo ----------------------------------

  /**
   * Las tarjetas de resumen aceptan los mismos filtros de alcance que el
   * listado (programa y curso) para que ambos numeros concuerden. El nivel de
   * riesgo se excluye a proposito: el resumen muestra la distribucion completa.
   */
  resumenRiesgo(
    filtros: Pick<FiltrosEstudiantes, 'programaId' | 'cursoId'> = {},
  ): Promise<ResumenRiesgo> {
    return firstValueFrom(
      this.http.get<ResumenRiesgo>(`${this.base}/riesgo/resumen`, {
        params: this.parametros(filtros),
      }),
    );
  }

  recalcular(): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`${this.base}/riesgo/recalcular`, {}),
    );
  }

  // ------------------------------ Alertas ---------------------------------

  alertas(filtros: FiltrosAlertas = {}): Promise<Alerta[]> {
    return firstValueFrom(
      this.http.get<Alerta[]>(`${this.base}/alertas`, {
        params: this.parametros(filtros),
      }),
    );
  }

  resumenAlertas(filtros: FiltrosAlertas = {}): Promise<ResumenAlertas> {
    return firstValueFrom(
      this.http.get<ResumenAlertas>(`${this.base}/alertas/resumen`, {
        params: this.parametros(filtros),
      }),
    );
  }

  alerta(id: string): Promise<Alerta> {
    return firstValueFrom(this.http.get<Alerta>(`${this.base}/alertas/${id}`));
  }

  registrarSeguimiento(
    id: string,
    datos: { accion: string; descripcion: string; nuevoEstado?: string },
  ): Promise<Alerta> {
    return firstValueFrom(
      this.http.post<Alerta>(`${this.base}/alertas/${id}/seguimiento`, datos),
    );
  }

  // --------------------------- Notificaciones -----------------------------

  notificaciones(soloNoLeidas = false): Promise<Notificacion[]> {
    return firstValueFrom(
      this.http.get<Notificacion[]>(`${this.base}/notificaciones`, {
        params: this.parametros({ noLeidas: soloNoLeidas ? 'true' : undefined }),
      }),
    );
  }

  marcarNotificacionLeida(id: string): Promise<Notificacion> {
    return firstValueFrom(
      this.http.patch<Notificacion>(
        `${this.base}/notificaciones/${id}/leida`,
        {},
      ),
    );
  }

  // ----------------------------- Catalogos --------------------------------

  programas(): Promise<Programa[]> {
    return firstValueFrom(
      this.http.get<Programa[]>(`${this.base}/catalogos/programas`),
    );
  }

  cohortes(programaId?: string): Promise<Cohorte[]> {
    return firstValueFrom(
      this.http.get<Cohorte[]>(`${this.base}/catalogos/cohortes`, {
        params: this.parametros({ programaId }),
      }),
    );
  }

  periodos(): Promise<string[]> {
    return firstValueFrom(
      this.http.get<string[]>(`${this.base}/catalogos/periodos`),
    );
  }

  cursos(programaId?: string): Promise<Curso[]> {
    return firstValueFrom(
      this.http.get<Curso[]>(`${this.base}/catalogos/cursos`, {
        params: this.parametros({ programaId }),
      }),
    );
  }

  // --------------------------- Observaciones ------------------------------

  observaciones(estudianteId: string): Promise<Observacion[]> {
    return firstValueFrom(
      this.http.get<Observacion[]>(
        `${this.base}/observaciones/estudiante/${estudianteId}`,
      ),
    );
  }

  crearObservacion(datos: {
    estudianteId: string;
    contenido: string;
    cursoId?: string;
  }): Promise<Observacion> {
    return firstValueFrom(
      this.http.post<Observacion>(`${this.base}/observaciones`, datos),
    );
  }

  // ------------------------------ Reportes --------------------------------

  /**
   * Descarga un reporte y lo entrega al navegador.
   *
   * No se puede usar un enlace directo porque la API exige la cabecera de
   * autorizacion: se pide el archivo por HTTP, se envuelve en un object URL
   * temporal y se dispara la descarga con el nombre que indica el servidor.
   */
  async descargarReporte(
    ruta: string,
    filtros: Record<string, string | undefined> = {},
  ): Promise<void> {
    const respuesta = await firstValueFrom(
      this.http.get(`${this.base}/reportes/${ruta}`, {
        params: this.parametros(filtros),
        observe: 'response',
        responseType: 'blob',
      }),
    );

    const contenido = respuesta.body;
    if (!contenido) throw new Error('El reporte llegó vacío');

    const disposicion = respuesta.headers.get('content-disposition') ?? '';
    const nombre =
      /filename="([^"]+)"/.exec(disposicion)?.[1] ?? ruta.replace('/', '-');

    const url = URL.createObjectURL(contenido);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    // Liberar el object URL evita retener el archivo en memoria toda la sesion.
    URL.revokeObjectURL(url);
  }

  // ------------------------------ Umbrales --------------------------------

  umbrales(): Promise<Umbral[]> {
    return firstValueFrom(this.http.get<Umbral[]>(`${this.base}/umbrales`));
  }

  actualizarUmbral(
    indicador: string,
    datos: Partial<{
      umbralVerde: number;
      umbralAmarillo: number;
      peso: number;
      activo: boolean;
    }>,
  ): Promise<Umbral> {
    return firstValueFrom(
      this.http.put<Umbral>(`${this.base}/umbrales/${indicador}`, datos),
    );
  }

  // ------------------------ Usuarios y roles ------------------------------

  usuarios(filtros: {
    rol?: string;
    busqueda?: string;
    activo?: string;
  } = {}): Promise<UsuarioAdmin[]> {
    return firstValueFrom(
      this.http.get<UsuarioAdmin[]>(`${this.base}/usuarios`, {
        params: this.parametros(filtros),
      }),
    );
  }

  rolesSistema(): Promise<RolSistema[]> {
    return firstValueFrom(
      this.http.get<RolSistema[]>(`${this.base}/usuarios/roles`),
    );
  }

  crearUsuario(datos: {
    nombres: string;
    apellidos: string;
    email: string;
    password: string;
    rolId: number;
  }): Promise<UsuarioAdmin> {
    return firstValueFrom(
      this.http.post<UsuarioAdmin>(`${this.base}/usuarios`, datos),
    );
  }

  actualizarUsuario(
    id: string,
    datos: Partial<{
      nombres: string;
      apellidos: string;
      rolId: number;
      activo: boolean;
    }>,
  ): Promise<UsuarioAdmin> {
    return firstValueFrom(
      this.http.patch<UsuarioAdmin>(`${this.base}/usuarios/${id}`, datos),
    );
  }

  restablecerPassword(id: string, password: string): Promise<{ mensaje: string }> {
    return firstValueFrom(
      this.http.patch<{ mensaje: string }>(
        `${this.base}/usuarios/${id}/password`,
        { password },
      ),
    );
  }

  auditoria(limite = 100): Promise<RegistroAuditoria[]> {
    return firstValueFrom(
      this.http.get<RegistroAuditoria[]>(`${this.base}/usuarios/auditoria`, {
        params: this.parametros({ limite: String(limite) }),
      }),
    );
  }

  /** Descarta los parametros vacios para no enviar filtros sin valor. */
  private parametros(objeto: Record<string, string | undefined>): HttpParams {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(objeto)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, valor);
      }
    }
    return params;
  }
}
