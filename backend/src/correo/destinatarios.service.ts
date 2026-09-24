import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';

/** Persona con cuenta en el sistema a la que se puede notificar por dos vias. */
export interface DestinatarioInterno {
  usuarioId: string;
  email: string;
  nombre: string;
}

/** Docente de un curso concreto del estudiante. */
export interface DocenteDeEstudiante extends DestinatarioInterno {
  /** Cursos del estudiante que ese docente dirige. */
  cursos: string[];
}

/**
 * Directivos a los que escala la informacion academica sensible: la
 * coordinacion del programa, los administradores del sistema y las cuentas
 * institucionales que no tienen usuario (Bienestar, Registro y Control).
 */
export interface Directivos {
  internos: DestinatarioInterno[];
  /** Correos sin cuenta en el sistema, tomados de la configuracion. */
  externos: string[];
}

/**
 * Resuelve a quien hay que avisar en cada situacion.
 *
 * Vive aparte de los servicios de negocio porque tanto las alertas de riesgo
 * como las solicitudes de desercion necesitan exactamente los mismos
 * destinatarios, y duplicar esas consultas garantizaria que con el tiempo un
 * flujo notifique a alguien que el otro olvida.
 */
@Injectable()
export class DestinatariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Docentes de los cursos en los que el estudiante esta inscrito.
   *
   * Es el "profesor" que pide el requisito: no hay un docente unico por
   * estudiante, sino uno por curso, y todos deben enterarse porque cada uno
   * decide la intervencion en su asignatura.
   */
  async docentesDe(estudianteId: string): Promise<DocenteDeEstudiante[]> {
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { estudianteId, curso: { docenteId: { not: null } } },
      select: {
        curso: {
          select: {
            nombre: true,
            docente: {
              select: {
                usuario: {
                  select: {
                    id: true,
                    email: true,
                    nombres: true,
                    apellidos: true,
                    activo: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Un docente puede dictar varios cursos al mismo estudiante: se agrupa por
    // usuario para enviarle un solo correo que mencione todos sus cursos.
    const porUsuario = new Map<string, DocenteDeEstudiante>();

    for (const inscripcion of inscripciones) {
      const usuario = inscripcion.curso.docente?.usuario;
      if (!usuario || !usuario.activo) continue;

      const existente = porUsuario.get(usuario.id);
      if (existente) {
        existente.cursos.push(inscripcion.curso.nombre);
        continue;
      }

      porUsuario.set(usuario.id, {
        usuarioId: usuario.id,
        email: usuario.email,
        nombre: `${usuario.nombres} ${usuario.apellidos}`,
        cursos: [inscripcion.curso.nombre],
      });
    }

    return [...porUsuario.values()];
  }

  /** Coordinacion del programa, administradores y cuentas institucionales. */
  async directivosDe(programaId: string): Promise<Directivos> {
    const [programa, administradores] = await Promise.all([
      this.prisma.programa.findUnique({
        where: { id: programaId },
        select: {
          coordinador: {
            select: {
              id: true,
              email: true,
              nombres: true,
              apellidos: true,
              activo: true,
            },
          },
        },
      }),
      this.prisma.usuario.findMany({
        where: { activo: true, rol: { nombre: 'ADMINISTRADOR' } },
        select: { id: true, email: true, nombres: true, apellidos: true },
      }),
    ]);

    const internos: DestinatarioInterno[] = [];

    const coordinador = programa?.coordinador;
    if (coordinador?.activo) {
      internos.push({
        usuarioId: coordinador.id,
        email: coordinador.email,
        nombre: `${coordinador.nombres} ${coordinador.apellidos}`,
      });
    }

    for (const administrador of administradores) {
      if (internos.some((i) => i.usuarioId === administrador.id)) continue;
      internos.push({
        usuarioId: administrador.id,
        email: administrador.email,
        nombre: `${administrador.nombres} ${administrador.apellidos}`,
      });
    }

    return { internos, externos: this.correosInstitucionales() };
  }

  /**
   * Correos de dependencias que no tienen usuario en el sistema. Se configuran
   * por entorno porque cambian de una institucion a otra y no son datos del
   * dominio.
   */
  correosInstitucionales(): string[] {
    const configurados = [
      this.config.get<string>('DIRECTIVOS_EMAIL'),
      this.config.get<string>('BIENESTAR_EMAIL'),
    ];

    const correos = configurados
      .filter((valor): valor is string => Boolean(valor))
      .flatMap((valor) => valor.split(','))
      .map((valor) => valor.trim())
      .filter((valor) => valor.includes('@'));

    return [...new Set(correos)];
  }
}
