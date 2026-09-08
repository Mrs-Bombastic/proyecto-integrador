/**
 * Datos semilla del Dashboard de Seguimiento Academico.
 *
 * Genera un periodo academico completo simulado (2026-2) con una distribucion
 * de desempeno realista: la mayoria de estudiantes en estado normal, un grupo
 * en riesgo medio y un grupo pequeno en riesgo alto. Esto permite demostrar el
 * motor de alertas sin depender de una integracion con el LMS.
 *
 * El generador es determinista (semilla fija): todo el equipo obtiene
 * exactamente los mismos datos, y la demostracion es reproducible.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, EstadoAsistencia, EstadoEntrega, TipoParticipacion } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PERIODO = '2026-2';
const PASSWORD_DEMO = 'Dashboard2026*';
const SEMANAS_PERIODO = 16;
const ENTREGAS_POR_CURSO = 6;

/**
 * Cohorte de ingreso segun el semestre que cursa el estudiante: quien va en
 * septimo entro tres anios antes que quien va en primero. Sin esta coherencia
 * el filtro por cohorte del RF08 agruparia generaciones que no existen.
 */
function cohorteSegunSemestre(semestre: number): string {
  const periodosAtras = semestre - 1;
  let anio = 2026;
  let periodo = 1;
  for (let i = 0; i < periodosAtras; i++) {
    if (periodo === 1) {
      anio -= 1;
      periodo = 2;
    } else {
      periodo = 1;
    }
  }
  return `${anio}-${periodo}`;
}

// --------------------------- Aleatoriedad determinista ---------------------

/** Generador congruencial lineal: mismos datos en cada ejecucion. */
let semilla = 20260908;
function aleatorio(): number {
  semilla = (semilla * 1664525 + 1013904223) % 4294967296;
  return semilla / 4294967296;
}
function entre(min: number, max: number): number {
  return min + aleatorio() * (max - min);
}
function entero(min: number, max: number): number {
  return Math.floor(entre(min, max + 1));
}
function elegir<T>(opciones: T[]): T {
  return opciones[entero(0, opciones.length - 1)];
}

// ------------------------------- Catalogos ---------------------------------

const NOMBRES = [
  'Camila', 'Santiago', 'Valentina', 'Mateo', 'Isabella', 'Sebastian', 'Sofia',
  'Nicolas', 'Mariana', 'Samuel', 'Luciana', 'Emiliano', 'Antonella', 'Tomas',
  'Salome', 'Martin', 'Gabriela', 'Daniel', 'Manuela', 'Alejandro', 'Juliana',
  'Andres', 'Karen', 'Eulices', 'Paula', 'Felipe', 'Laura', 'Juan', 'Diana',
  'Carlos', 'Natalia', 'Esteban', 'Catalina', 'Miguel', 'Alejandra', 'Ricardo',
];

const APELLIDOS = [
  'Jaramillo', 'Vergara', 'Morales', 'Palacio', 'Restrepo', 'Gomez', 'Ospina',
  'Cardona', 'Zapata', 'Arango', 'Betancur', 'Montoya', 'Velasquez', 'Quintero',
  'Rendon', 'Hincapie', 'Alzate', 'Ramirez', 'Castano', 'Giraldo', 'Mejia',
  'Duque', 'Escobar', 'Agudelo', 'Toro', 'Salazar', 'Osorio', 'Vasquez',
];

const PROGRAMAS = [
  { codigo: 'ISD', nombre: 'Ingenieria de Software y Datos', facultad: 'Ingenieria' },
  { codigo: 'ADM', nombre: 'Administracion de Empresas', facultad: 'Ciencias Economicas' },
  { codigo: 'CON', nombre: 'Contaduria Publica', facultad: 'Ciencias Economicas' },
  { codigo: 'PSI', nombre: 'Psicologia', facultad: 'Ciencias Sociales' },
];

const CURSOS_POR_PROGRAMA: Record<string, string[]> = {
  ISD: [
    'Proyecto Integrado I', 'Bases de Datos', 'Programacion Web',
    'Ingenieria de Requisitos', 'Arquitectura de Software',
  ],
  ADM: [
    'Fundamentos de Administracion', 'Gestion del Talento Humano',
    'Finanzas Corporativas', 'Mercadeo Estrategico',
  ],
  CON: [
    'Contabilidad General', 'Costos y Presupuestos',
    'Auditoria Financiera', 'Normas Internacionales',
  ],
  PSI: [
    'Psicologia General', 'Neuropsicologia',
    'Psicologia Organizacional', 'Metodos de Investigacion',
  ],
};

/**
 * Perfiles de desempeno. La distribucion busca que el dashboard muestre los
 * tres colores del semaforo desde la primera ejecucion.
 */
const PERFILES = [
  { nombre: 'excelente', proporcion: 0.30, nota: [4.2, 5.0], asistencia: [0.92, 1.0], particip: [3, 6], vencidas: [0, 0] },
  { nombre: 'estable', proporcion: 0.35, nota: [3.5, 4.3], asistencia: [0.85, 0.96], particip: [2, 4], vencidas: [0, 1] },
  { nombre: 'medio', proporcion: 0.22, nota: [3.0, 3.6], asistencia: [0.70, 0.86], particip: [1, 2], vencidas: [1, 3] },
  { nombre: 'alto', proporcion: 0.13, nota: [1.8, 3.1], asistencia: [0.40, 0.72], particip: [0, 1], vencidas: [3, 6] },
];

function perfilPara(indice: number, total: number) {
  const posicion = indice / total;
  let acumulado = 0;
  for (const perfil of PERFILES) {
    acumulado += perfil.proporcion;
    if (posicion < acumulado) return perfil;
  }
  return PERFILES[PERFILES.length - 1];
}

// --------------------------------- Semilla ---------------------------------

async function limpiar(): Promise<void> {
  // El orden respeta las llaves foraneas.
  await prisma.auditoria.deleteMany();
  await prisma.notificacion.deleteMany();
  await prisma.seguimiento.deleteMany();
  await prisma.alerta.deleteMany();
  await prisma.observacion.deleteMany();
  await prisma.indicadorEstudiante.deleteMany();
  await prisma.entrega.deleteMany();
  await prisma.participacion.deleteMany();
  await prisma.asistencia.deleteMany();
  await prisma.calificacion.deleteMany();
  await prisma.inscripcion.deleteMany();
  await prisma.curso.deleteMany();
  await prisma.estudiante.deleteMany();
  await prisma.docente.deleteMany();
  await prisma.programa.deleteMany();
  await prisma.configuracionUmbral.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.rol.deleteMany();
}

async function main(): Promise<void> {
  console.log('Limpiando datos anteriores...');
  await limpiar();

  const hash = await bcrypt.hash(PASSWORD_DEMO, 10);

  // --- Roles (RF01) ---
  console.log('Creando roles...');
  const roles = await Promise.all(
    [
      { nombre: 'ADMINISTRADOR', descripcion: 'Configura el sistema, usuarios y umbrales', permisos: ['usuarios:gestionar', 'umbrales:gestionar', 'auditoria:consultar'] },
      { nombre: 'COORDINADOR', descripcion: 'Supervisa un programa academico y gestiona alertas', permisos: ['alertas:gestionar', 'programa:consultar', 'reportes:exportar'] },
      { nombre: 'DOCENTE', descripcion: 'Registra observaciones y consulta sus cursos', permisos: ['cursos:consultar', 'observaciones:crear', 'reportes:exportar'] },
      { nombre: 'ESTUDIANTE', descripcion: 'Consulta unicamente su propio progreso', permisos: ['progreso:consultar'] },
    ].map((rol) => prisma.rol.create({ data: rol })),
  );
  const rolPorNombre = Object.fromEntries(roles.map((r) => [r.nombre, r.id]));

  // --- Umbrales configurables (RF05, ver docs/matriz-riesgo.md) ---
  console.log('Creando umbrales de riesgo...');
  await prisma.configuracionUmbral.createMany({
    data: [
      { indicador: 'PROMEDIO', descripcion: 'Promedio academico acumulado del periodo', umbralVerde: 3.5, umbralAmarillo: 3.0, mayorEsMejor: true, peso: 0.4 },
      { indicador: 'ASISTENCIA', descripcion: 'Porcentaje de asistencia a sesiones sincronicas', umbralVerde: 85, umbralAmarillo: 70, mayorEsMejor: true, peso: 0.3 },
      { indicador: 'PARTICIPACION', descripcion: 'Interacciones promedio por semana en foros y actividades', umbralVerde: 3, umbralAmarillo: 1, mayorEsMejor: true, peso: 0.2 },
      { indicador: 'ENTREGAS', descripcion: 'Entregas vencidas en las ultimas cuatro semanas', umbralVerde: 0, umbralAmarillo: 2, mayorEsMejor: false, peso: 0.1 },
    ],
  });

  // --- Administrador ---
  console.log('Creando usuarios administrativos...');
  await prisma.usuario.create({
    data: {
      nombres: 'Jose Nelson',
      apellidos: 'Palacio',
      email: 'admin@dashboard.edu.co',
      passwordHash: hash,
      rolId: rolPorNombre.ADMINISTRADOR,
    },
  });

  // --- Programas con su coordinador ---
  const programas = [];
  for (const [indice, datos] of PROGRAMAS.entries()) {
    const coordinador = await prisma.usuario.create({
      data: {
        nombres: elegir(NOMBRES),
        apellidos: elegir(APELLIDOS),
        email: `coordinador.${datos.codigo.toLowerCase()}@dashboard.edu.co`,
        passwordHash: hash,
        rolId: rolPorNombre.COORDINADOR,
      },
    });
    const programa = await prisma.programa.create({
      data: { ...datos, coordinadorId: coordinador.id },
    });
    programas.push(programa);
    if (indice === 0) {
      console.log(`  Coordinador de prueba: ${coordinador.email}`);
    }
  }

  // --- Docentes ---
  console.log('Creando docentes...');
  const docentes = [];
  for (let i = 0; i < 10; i++) {
    const usuario = await prisma.usuario.create({
      data: {
        nombres: elegir(NOMBRES),
        apellidos: elegir(APELLIDOS),
        email: `docente${i + 1}@dashboard.edu.co`,
        passwordHash: hash,
        rolId: rolPorNombre.DOCENTE,
      },
    });
    docentes.push(
      await prisma.docente.create({
        data: {
          usuarioId: usuario.id,
          codigoDocente: `DOC${String(i + 1).padStart(3, '0')}`,
          departamento: elegir(['Ingenieria', 'Ciencias Basicas', 'Ciencias Economicas', 'Ciencias Sociales']),
        },
      }),
    );
  }

  // --- Cursos ---
  console.log('Creando cursos...');
  const cursosPorPrograma: Record<string, { id: string }[]> = {};
  for (const programa of programas) {
    const nombres = CURSOS_POR_PROGRAMA[programa.codigo];
    cursosPorPrograma[programa.id] = [];
    for (const [indice, nombre] of nombres.entries()) {
      const curso = await prisma.curso.create({
        data: {
          codigo: `${programa.codigo}-${String(indice + 1).padStart(2, '0')}`,
          nombre,
          creditos: entero(2, 4),
          periodo: PERIODO,
          programaId: programa.id,
          docenteId: elegir(docentes).id,
        },
      });
      cursosPorPrograma[programa.id].push(curso);
    }
  }

  // --- Estudiantes con su historial academico ---
  console.log('Creando estudiantes e historial academico...');
  const TOTAL_ESTUDIANTES = 200;
  const inicioPeriodo = new Date('2026-07-20T00:00:00Z');

  for (let i = 0; i < TOTAL_ESTUDIANTES; i++) {
    const perfil = perfilPara(i, TOTAL_ESTUDIANTES);
    const programa = programas[i % programas.length];
    const nombres = elegir(NOMBRES);
    const apellidos = `${elegir(APELLIDOS)} ${elegir(APELLIDOS)}`;
    const codigo = `EST${String(i + 1).padStart(4, '0')}`;

    const usuario = await prisma.usuario.create({
      data: {
        nombres,
        apellidos,
        email: `${codigo.toLowerCase()}@estudiante.edu.co`,
        passwordHash: hash,
        rolId: rolPorNombre.ESTUDIANTE,
      },
    });

    const semestre = entero(1, 10);
    const estudiante = await prisma.estudiante.create({
      data: {
        usuarioId: usuario.id,
        codigoEstudiante: codigo,
        semestre,
        cohorte: cohorteSegunSemestre(semestre),
        programaId: programa.id,
      },
    });

    // Cada estudiante cursa entre 3 y 5 materias de su programa.
    const cursosDisponibles = cursosPorPrograma[programa.id];
    const cantidadCursos = Math.min(entero(3, 5), cursosDisponibles.length);
    const cursos = cursosDisponibles.slice(0, cantidadCursos);

    for (const curso of cursos) {
      const inscripcion = await prisma.inscripcion.create({
        data: { estudianteId: estudiante.id, cursoId: curso.id },
      });

      // Calificaciones: tres cortes (RF02).
      await prisma.calificacion.createMany({
        data: [1, 2, 3].map((corte) => ({
          inscripcionId: inscripcion.id,
          corte,
          nota: Number(entre(perfil.nota[0], perfil.nota[1]).toFixed(2)),
          porcentaje: corte === 3 ? 40 : 30,
          descripcion: `Corte ${corte}`,
        })),
      });

      // Asistencia semanal (RF03).
      const tasaAsistencia = entre(perfil.asistencia[0], perfil.asistencia[1]);
      await prisma.asistencia.createMany({
        data: Array.from({ length: SEMANAS_PERIODO }, (_, semana) => {
          const asistio = aleatorio() < tasaAsistencia;
          return {
            inscripcionId: inscripcion.id,
            fechaSesion: new Date(inicioPeriodo.getTime() + semana * 7 * 86400000),
            estado: asistio
              ? aleatorio() < 0.9
                ? EstadoAsistencia.PRESENTE
                : EstadoAsistencia.TARDE
              : aleatorio() < 0.25
                ? EstadoAsistencia.JUSTIFICADO
                : EstadoAsistencia.AUSENTE,
            minutosConectado: asistio ? entero(60, 110) : 0,
          };
        }),
      });

      // Participacion en foros y actividades (RF04).
      const participaciones = [];
      for (let semana = 0; semana < SEMANAS_PERIODO; semana++) {
        const cantidad = entero(perfil.particip[0], perfil.particip[1]);
        for (let k = 0; k < cantidad; k++) {
          participaciones.push({
            inscripcionId: inscripcion.id,
            fecha: new Date(inicioPeriodo.getTime() + semana * 7 * 86400000 + k * 3600000),
            tipo: elegir([
              TipoParticipacion.FORO,
              TipoParticipacion.MENSAJE,
              TipoParticipacion.ACTIVIDAD,
              TipoParticipacion.RECURSO,
            ]),
            cantidad: 1,
          });
        }
      }
      if (participaciones.length > 0) {
        await prisma.participacion.createMany({ data: participaciones });
      }

      // Entregas semanales. Las fechas limite se distribuyen sobre las semanas
      // ya transcurridas del periodo para que el indicador "entregas vencidas
      // en las ultimas cuatro semanas" tenga datos reales que evaluar; las
      // vencidas son las mas recientes, que es como se comporta un estudiante
      // que empieza a rezagarse.
      const vencidasObjetivo = entero(perfil.vencidas[0], perfil.vencidas[1]);
      await prisma.entrega.createMany({
        data: Array.from({ length: ENTREGAS_POR_CURSO }, (_, indice) => {
          const fechaLimite = new Date(
            inicioPeriodo.getTime() + (indice + 1) * 7 * 86400000,
          );
          const vencida = indice >= ENTREGAS_POR_CURSO - vencidasObjetivo;
          return {
            inscripcionId: inscripcion.id,
            titulo: `Actividad ${indice + 1}`,
            fechaLimite,
            fechaEntrega: vencida ? null : new Date(fechaLimite.getTime() - entero(1, 72) * 3600000),
            estado: vencida ? EstadoEntrega.VENCIDA : EstadoEntrega.ENTREGADA,
          };
        }),
      });
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  ${i + 1}/${TOTAL_ESTUDIANTES} estudiantes`);
    }
  }

  console.log('\nSemilla completada.');
  console.log(`Contrasena para todos los usuarios de prueba: ${PASSWORD_DEMO}`);
  console.log('  Administrador: admin@dashboard.edu.co');
  console.log('  Coordinador:   coordinador.isd@dashboard.edu.co');
  console.log('  Docente:       docente1@dashboard.edu.co');
  console.log('  Estudiante:    est0001@estudiante.edu.co (perfil excelente)');
  console.log('  Estudiante:    est0195@estudiante.edu.co (perfil riesgo alto)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
