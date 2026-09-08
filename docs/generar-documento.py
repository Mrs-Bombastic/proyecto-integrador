"""
Genera el documento técnico del sistema en formato Word.

Se mantiene como script y no como un .docx suelto para que el documento pueda
regenerarse cuando el sistema cambie, sin volver a maquetarlo a mano.

Uso:  python docs/generar-documento.py
Salida: docs/Sistema-Dashboard-Seguimiento-Academico.docx
"""

from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

# --------------------------------------------------------------------------
# Paleta: los mismos colores del sistema, para que el documento y la
# aplicación se lean como una sola cosa.
# --------------------------------------------------------------------------
MARCA = RGBColor(0x4F, 0x46, 0xE5)
TEXTO = RGBColor(0x1E, 0x29, 0x3B)
GRIS = RGBColor(0x64, 0x74, 0x8B)
VERDE = RGBColor(0x04, 0x78, 0x57)
AMBAR = RGBColor(0xB4, 0x53, 0x09)
ROJO = RGBColor(0xB9, 0x1C, 0x1C)

FUENTE = "Segoe UI"

doc = Document()


# --------------------------------------------------------------------------
# Utilidades de formato
# --------------------------------------------------------------------------

def configurar_estilos() -> None:
    normal = doc.styles["Normal"]
    normal.font.name = FUENTE
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = TEXTO
    normal.paragraph_format.space_after = Pt(8)
    normal.paragraph_format.line_spacing = 1.15

    for nivel, tamano in ((1, 18), (2, 14), (3, 11.5)):
        estilo = doc.styles[f"Heading {nivel}"]
        estilo.font.name = FUENTE
        estilo.font.size = Pt(tamano)
        estilo.font.bold = True
        estilo.font.color.rgb = MARCA if nivel < 3 else TEXTO
        estilo.paragraph_format.space_before = Pt(18 if nivel == 1 else 12)
        estilo.paragraph_format.space_after = Pt(6)

    for nombre in ("List Bullet", "List Number"):
        estilo = doc.styles[nombre]
        estilo.font.name = FUENTE
        estilo.font.size = Pt(10.5)
        estilo.font.color.rgb = TEXTO


def margenes() -> None:
    for seccion in doc.sections:
        seccion.top_margin = Cm(2.4)
        seccion.bottom_margin = Cm(2.4)
        seccion.left_margin = Cm(2.6)
        seccion.right_margin = Cm(2.6)


def p(texto="", *, tamano=10.5, negrita=False, color=None, alineacion=None,
      espacio_antes=None, espacio_despues=None, cursiva=False):
    parrafo = doc.add_paragraph()
    if alineacion is not None:
        parrafo.alignment = alineacion
    if espacio_antes is not None:
        parrafo.paragraph_format.space_before = Pt(espacio_antes)
    if espacio_despues is not None:
        parrafo.paragraph_format.space_after = Pt(espacio_despues)
    if texto:
        run = parrafo.add_run(texto)
        run.font.name = FUENTE
        run.font.size = Pt(tamano)
        run.bold = negrita
        run.italic = cursiva
        run.font.color.rgb = color or TEXTO
    return parrafo


def vineta(texto, *, negrita_hasta=None):
    """Viñeta; `negrita_hasta` resalta el fragmento inicial indicado."""
    parrafo = doc.add_paragraph(style="List Bullet")
    if negrita_hasta:
        fuerte = parrafo.add_run(negrita_hasta)
        fuerte.bold = True
        fuerte.font.name = FUENTE
        fuerte.font.size = Pt(10.5)
        fuerte.font.color.rgb = TEXTO
    run = parrafo.add_run(texto)
    run.font.name = FUENTE
    run.font.size = Pt(10.5)
    run.font.color.rgb = TEXTO
    return parrafo


def sombrear(celda, color_hex):
    sombra = OxmlElement("w:shd")
    sombra.set(qn("w:val"), "clear")
    sombra.set(qn("w:fill"), color_hex)
    celda._tc.get_or_add_tcPr().append(sombra)


def tabla(encabezados, filas, anchos=None, colores_columna=None):
    """
    Tabla con encabezado sombreado. `colores_columna` permite colorear el
    texto de columnas concretas: {indice: {valor: RGBColor}}.
    """
    t = doc.add_table(rows=1, cols=len(encabezados))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = True

    for i, titulo in enumerate(encabezados):
        celda = t.rows[0].cells[i]
        celda.text = ""
        run = celda.paragraphs[0].add_run(titulo)
        run.bold = True
        run.font.size = Pt(9.5)
        run.font.name = FUENTE
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        sombrear(celda, "4F46E5")

    for fila in filas:
        celdas = t.add_row().cells
        for i, valor in enumerate(fila):
            celdas[i].text = ""
            run = celdas[i].paragraphs[0].add_run(str(valor))
            run.font.size = Pt(9.5)
            run.font.name = FUENTE
            color = TEXTO
            if colores_columna and i in colores_columna:
                color = colores_columna[i].get(str(valor), TEXTO)
            run.font.color.rgb = color

    if anchos:
        for fila in t.rows:
            for i, ancho in enumerate(anchos):
                fila.cells[i].width = Cm(ancho)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    return t


def codigo(lineas):
    """Bloque monoespaciado con fondo gris, para rutas y fragmentos."""
    t = doc.add_table(rows=1, cols=1)
    t.style = "Table Grid"
    celda = t.rows[0].cells[0]
    sombrear(celda, "F1F5F9")
    celda.text = ""
    for indice, linea in enumerate(lineas):
        parrafo = celda.paragraphs[0] if indice == 0 else celda.add_paragraph()
        parrafo.paragraph_format.space_after = Pt(0)
        run = parrafo.add_run(linea)
        run.font.name = "Consolas"
        run.font.size = Pt(9)
        run.font.color.rgb = TEXTO
    doc.add_paragraph().paragraph_format.space_after = Pt(4)


def titulo1(texto):
    doc.add_heading(texto, level=1)


def titulo2(texto):
    doc.add_heading(texto, level=2)


def titulo3(texto):
    doc.add_heading(texto, level=3)


def salto():
    doc.add_page_break()


def indice_automatico():
    """Campo TOC: Word lo rellena al abrir el documento y aceptar la actualización."""
    parrafo = doc.add_paragraph()
    fldChar = OxmlElement("w:fldChar")
    fldChar.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = 'TOC \\o "1-2" \\h \\z \\u'
    separador = OxmlElement("w:fldChar")
    separador.set(qn("w:fldCharType"), "separate")
    aviso = OxmlElement("w:t")
    aviso.text = "Haga clic derecho aquí y elija «Actualizar campos» para generar el índice."
    fin = OxmlElement("w:fldChar")
    fin.set(qn("w:fldCharType"), "end")
    run = parrafo.add_run()
    for elemento in (fldChar, instr, separador, aviso, fin):
        run._r.append(elemento)


def pie_de_pagina():
    """Numeración de página en el pie."""
    for seccion in doc.sections:
        parrafo = seccion.footer.paragraphs[0]
        parrafo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = parrafo.add_run()
        for tipo, texto in (("begin", None), (None, "PAGE"), ("separate", None),
                            (None, None), ("end", None)):
            if tipo:
                elemento = OxmlElement("w:fldChar")
                elemento.set(qn("w:fldCharType"), tipo)
            elif texto:
                elemento = OxmlElement("w:instrText")
                elemento.set(qn("xml:space"), "preserve")
                elemento.text = texto
            else:
                elemento = OxmlElement("w:t")
                elemento.text = "1"
            run._r.append(elemento)
        run.font.size = Pt(9)
        run.font.name = FUENTE
        run.font.color.rgb = GRIS


# ==========================================================================
# PORTADA
# ==========================================================================

configurar_estilos()
margenes()

p(espacio_antes=90)
p("INSTITUCIÓN UNIVERSITARIA DIGITAL DE ANTIOQUIA", tamano=11, negrita=True,
  color=GRIS, alineacion=WD_ALIGN_PARAGRAPH.CENTER)
p("Facultad de Ingeniería · Ingeniería de Software y Datos", tamano=10,
  color=GRIS, alineacion=WD_ALIGN_PARAGRAPH.CENTER, espacio_despues=48)

p("Dashboard de Seguimiento Académico", tamano=26, negrita=True, color=MARCA,
  alineacion=WD_ALIGN_PARAGRAPH.CENTER, espacio_despues=2)
p("y Alertas Tempranas", tamano=26, negrita=True, color=MARCA,
  alineacion=WD_ALIGN_PARAGRAPH.CENTER, espacio_despues=16)

p("Documentación técnica y funcional del sistema", tamano=12.5, color=GRIS,
  alineacion=WD_ALIGN_PARAGRAPH.CENTER, espacio_despues=64)

p("Andrés Jaramillo", tamano=11.5, negrita=True,
  alineacion=WD_ALIGN_PARAGRAPH.CENTER, espacio_despues=2)
p("Karen Vergara", tamano=11.5, negrita=True,
  alineacion=WD_ALIGN_PARAGRAPH.CENTER, espacio_despues=2)
p("Eulices Morales", tamano=11.5, negrita=True,
  alineacion=WD_ALIGN_PARAGRAPH.CENTER, espacio_despues=40)

p("Proyecto Integrado I", tamano=11, alineacion=WD_ALIGN_PARAGRAPH.CENTER,
  espacio_despues=2)
p("PREICA2602B010236", tamano=10, color=GRIS,
  alineacion=WD_ALIGN_PARAGRAPH.CENTER, espacio_despues=2)
p("Docente: José Nelson Palacio", tamano=10, color=GRIS,
  alineacion=WD_ALIGN_PARAGRAPH.CENTER, espacio_despues=40)

p("Semestre 5 · Septiembre de 2026", tamano=10, color=GRIS,
  alineacion=WD_ALIGN_PARAGRAPH.CENTER)

salto()

# ==========================================================================
# ÍNDICE
# ==========================================================================

titulo1("Contenido")
p("Este índice se genera automáticamente. Al abrir el documento, Word ofrece "
  "actualizar los campos; acepte para numerar las páginas.", tamano=9.5,
  color=GRIS, cursiva=True)
indice_automatico()

salto()

# ==========================================================================
# 1. QUÉ ES EL SISTEMA
# ==========================================================================

titulo1("1. Qué es el sistema")

p("El Dashboard de Seguimiento Académico y Alertas Tempranas es una aplicación "
  "web que reúne en un solo lugar la información académica que hoy vive "
  "dispersa entre el LMS, las hojas de cálculo de asistencia y los reportes de "
  "cada docente, y la usa para detectar a tiempo a los estudiantes que "
  "necesitan acompañamiento.")

p("El problema que resuelve no es la falta de datos: es que los datos existen "
  "pero nadie puede verlos juntos a tiempo. Un coordinador que debe abrir tres "
  "sistemas y consolidar a mano llega tarde, y en educación virtual llegar "
  "tarde suele significar que el estudiante ya canceló la asignatura.")

titulo2("1.1 Qué hace, en concreto")

vineta("de cada estudiante cuatro indicadores: promedio acumulado, porcentaje "
       "de asistencia a sesiones sincrónicas, participación semanal en foros y "
       "actividades, y entregas vencidas.", negrita_hasta="Calcula ")
vineta("esos indicadores contra umbrales configurables y asigna un nivel de "
       "riesgo: normal, medio o alto.", negrita_hasta="Evalúa ")
vineta("una alerta cuando el estudiante entra en riesgo, y la cierra sola "
       "cuando se recupera.", negrita_hasta="Genera ")
vineta("al coordinador dentro de la plataforma y por correo electrónico.",
       negrita_hasta="Notifica ")
vineta("que cada alerta se atienda registrando la acción realizada, de modo "
       "que quede constancia de qué se hizo y cuándo.", negrita_hasta="Exige ")
vineta("a Bienestar Universitario las alertas de riesgo alto que llevan más de "
       "cinco días hábiles sin gestión.", negrita_hasta="Escala ")
vineta("la información en Excel y PDF para reuniones e informes.",
       negrita_hasta="Exporta ")

titulo2("1.2 Lo que el sistema no hace")

p("Delimitar el alcance importa tanto como describir las funciones. El sistema:")

vineta("al LMS institucional: se alimenta de él, no lo sustituye.",
       negrita_hasta="No reemplaza ")
vineta("con un LMS real en esta fase. Los datos provienen de una carga inicial "
       "y, más adelante, de importación por archivo. La interfaz de "
       "integración queda especificada, no implementada.",
       negrita_hasta="No se conecta ")
vineta("módulo financiero, de pagos ni de matrícula.", negrita_hasta="No incluye ")
vineta("ninguna acción sobre el estudiante. Genera la alerta; la intervención "
       "la decide y ejecuta una persona.", negrita_hasta="No ejecuta ")
vineta("una aplicación móvil nativa. La interfaz web se adapta a pantallas "
       "pequeñas.", negrita_hasta="No incluye ")

salto()

# ==========================================================================
# 2. ARQUITECTURA
# ==========================================================================

titulo1("2. Arquitectura y tecnologías")

p("El sistema se compone de tres piezas independientes que se comunican por "
  "HTTP: una aplicación web que corre en el navegador, una API que concentra "
  "toda la lógica y las reglas de acceso, y una base de datos relacional.")

codigo([
    "  NAVEGADOR                    SERVIDOR                    DATOS",
    "  ---------                    --------                    -----",
    "                                                                ",
    "  Angular 22          HTTP     NestJS 12          SQL      PostgreSQL 16",
    "  TailwindCSS 4     ------->   Prisma 7         ------->   18 tablas",
    "  Chart.js            JWT      Motor de riesgo             ",
    "                                                                ",
    "  Rutas por rol                Guards por rol              Migraciones",
    "  Sesion en el                 Auditoria                   versionadas",
    "  navegador                    Correo (SMTP)               ",
])

p("La decisión de fondo es que la aplicación del navegador no decide nada "
  "sobre permisos: solo muestra u oculta opciones. Cada petición se vuelve a "
  "autorizar en el servidor. Si alguien manipulara el navegador para pedir un "
  "dato ajeno, la API responde 403.")

titulo2("2.1 Tecnologías empleadas")

tabla(
    ["Capa", "Tecnología", "Por qué"],
    [
        ["Backend", "NestJS 12 (TypeScript)",
         "Arquitectura modular por diseño, que es lo que pide el RNF08"],
        ["Acceso a datos", "Prisma 7 + adaptador pg",
         "El esquema es una traducción literal del modelo entidad-relación"],
        ["Base de datos", "PostgreSQL 16",
         "Relacional, con restricciones de integridad y consultas agregadas"],
        ["Frontend", "Angular 22 + TailwindCSS 4",
         "Componentes independientes, señales y rutas protegidas por rol"],
        ["Gráficas", "Chart.js",
         "Notas por curso y evolución del riesgo"],
        ["Autenticación", "JWT + bcrypt",
         "Sesión sin estado en el servidor; contraseñas nunca en claro"],
        ["Reportes", "ExcelJS y pdfmake",
         "Generación de Excel y PDF en el servidor"],
        ["Correo", "Nodemailer",
         "Envío real con SMTP; simulado en el log si no hay servidor"],
        ["Entorno local", "Docker Compose",
         "La base de datos no exige instalación en cada equipo"],
    ],
    anchos=[3.0, 4.4, 8.0],
)

titulo2("2.2 Organización del código")

codigo([
    "karen-dashboard/",
    "  backend/",
    "    prisma/",
    "      schema.prisma        modelo de datos (traduccion del MER)",
    "      seed.ts              datos de prueba deterministas",
    "      migrations/          historial versionado del esquema",
    "    src/",
    "      auth/                autenticacion, roles y guards",
    "      riesgo/              motor de calculo y matriz de riesgo",
    "      alertas/             ciclo de vida de las alertas",
    "      estudiantes/         listados y catalogos de filtros",
    "      observaciones/       observaciones cualitativas del docente",
    "      reportes/            exportacion a Excel y PDF",
    "      usuarios/            gestion de usuarios, roles y auditoria",
    "      correo/              envio de correo",
    "      prisma/              cliente de base de datos compartido",
    "  frontend/",
    "    src/app/",
    "      core/                sesion, cliente HTTP, guards, modelos",
    "      compartido/          marco de la aplicacion, semaforo, graficas",
    "      paginas/             login, panel, ficha, alertas, usuarios, umbrales",
    "  docs/                    plan, matriz de riesgo y este documento",
    "  diseno/                  propuestas visuales del acceso",
])

salto()

# ==========================================================================
# 3. MODELO DE DATOS
# ==========================================================================

titulo1("3. Modelo de datos")

p("La base de datos tiene 18 tablas. Once traducen directamente el modelo "
  "entidad-relación del documento de diseño; las siete restantes se añadieron "
  "porque el diseño las mencionaba sin definirlas o porque el funcionamiento "
  "del motor las exige.")

titulo2("3.1 Entidades del modelo original")

tabla(
    ["Entidad", "Qué guarda", "Relaciones principales"],
    [
        ["Rol", "Los cuatro roles y sus permisos", "Un rol tiene muchos usuarios"],
        ["Usuario", "Credenciales, estado y control de acceso",
         "Pertenece a un rol; puede tener ficha de estudiante o docente"],
        ["Programa", "Programa académico y su coordinador",
         "Tiene muchos cursos y muchos estudiantes"],
        ["Curso", "Asignatura de un periodo, con su docente",
         "Pertenece a un programa; lo dicta un docente"],
        ["Estudiante", "Código, semestre, cohorte y estado",
         "Pertenece a un programa; se inscribe en muchos cursos"],
        ["Docente", "Código y departamento", "Dicta muchos cursos"],
        ["Inscripción", "Vínculo entre un estudiante y un curso",
         "Tabla intermedia de la relación muchos a muchos"],
        ["Calificación", "Nota de un corte, con su peso", "Pertenece a una inscripción"],
        ["Asistencia", "Estado de una sesión sincrónica", "Pertenece a una inscripción"],
        ["Participación", "Interacción en foros y actividades", "Pertenece a una inscripción"],
        ["Alerta", "Riesgo detectado, con su motivo y estado", "Pertenece a un estudiante"],
        ["Observación", "Nota cualitativa del docente",
         "La escribe un docente sobre un estudiante"],
    ],
    anchos=[2.6, 5.6, 7.2],
)

titulo2("3.2 Entidades añadidas")

p("Estas no estaban en el modelo original, o estaban nombradas sin desarrollar. "
  "Cada una responde a un requisito concreto:")

tabla(
    ["Entidad", "Por qué existe"],
    [
        ["Entrega",
         "El indicador «entregas vencidas» de la matriz de riesgo necesita un "
         "registro de qué se debía entregar y cuándo. Sin esta tabla el "
         "indicador no tiene de dónde salir."],
        ["ConfiguracionUmbral",
         "Los umbrales de riesgo son datos, no código. El administrador los "
         "cambia desde la interfaz y el motor los lee en cada cálculo."],
        ["IndicadorEstudiante",
         "Fotografía de los indicadores en un momento dado. Permite responder "
         "el panel sin recalcular (RNF02) y conservar la evolución (RF12)."],
        ["Seguimiento",
         "Cada acción de acompañamiento sobre una alerta. Es lo que convierte "
         "un semáforo en rojo en un caso con trazabilidad."],
        ["Notificacion",
         "Los avisos en plataforma y el registro de los enviados por correo "
         "(RF09)."],
        ["Auditoria",
         "Registro de acciones sensibles: accesos, cambios de umbral, gestión "
         "de usuarios. Exigido por los requisitos de seguridad."],
    ],
    anchos=[3.6, 11.8],
)

titulo2("3.3 Relaciones que conviene entender")

vineta("La relación entre estudiante y curso es muchos a muchos, y por eso "
       "existe la tabla Inscripción. Todo lo que ocurre en un curso concreto "
       "para un estudiante concreto —notas, asistencias, participaciones, "
       "entregas— cuelga de esa inscripción, no del estudiante directamente. "
       "Así, si un estudiante cursa cinco asignaturas, sus notas nunca se "
       "mezclan entre ellas.")
vineta("Un programa tiene un coordinador, que es un usuario. De ahí sale el "
       "alcance del coordinador: ve exactamente los estudiantes de los "
       "programas que coordina.")
vineta("Un curso tiene un docente. De ahí sale el alcance del docente: ve "
       "exactamente los estudiantes inscritos en sus cursos.")

titulo2("3.4 Volumen de datos de prueba")

p("El sistema se entrega con un periodo académico completo simulado. El "
  "generador es determinista: todo el equipo obtiene los mismos datos y la "
  "demostración es reproducible.")

tabla(
    ["Tabla", "Registros", "Tabla", "Registros"],
    [
        ["Usuarios", "215", "Calificaciones", "2.226"],
        ["Estudiantes", "200", "Asistencias", "11.872"],
        ["Docentes", "10", "Participaciones", "32.848"],
        ["Programas", "4", "Entregas", "4.452"],
        ["Cursos", "17", "Alertas", "70"],
        ["Inscripciones", "742", "Notificaciones", "70"],
    ],
    anchos=[3.8, 3.0, 3.8, 3.0],
)

salto()

# ==========================================================================
# 4. ROLES
# ==========================================================================

titulo1("4. Roles y permisos")

p("El sistema tiene cuatro roles con acceso. Los demás interesados del "
  "proyecto —Bienestar Universitario, Dirección de Programa, Registro y "
  "Control Académico— no tienen usuario: reciben reportes y notificaciones. "
  "Esta decisión resuelve una ambigüedad del documento original, que los "
  "listaba como actores sin precisar si entraban al sistema.")

tabla(
    ["Rol", "Qué ve", "Qué puede hacer"],
    [
        ["Estudiante", "Únicamente su propio progreso",
         "Consultar sus indicadores, notas por curso, asistencia y sus alertas. "
         "Descargar su propia ficha en PDF"],
        ["Docente", "Los estudiantes inscritos en sus cursos",
         "Consultar indicadores, registrar observaciones cualitativas, "
         "gestionar alertas de sus cursos y exportar reportes"],
        ["Coordinador", "Los estudiantes de los programas que coordina",
         "Todo lo anterior sobre su programa, más recalcular el riesgo y "
         "gestionar todas las alertas del programa"],
        ["Administrador", "Todo el sistema",
         "Gestionar usuarios y roles, configurar los umbrales de riesgo y "
         "consultar el registro de auditoría"],
    ],
    anchos=[2.8, 4.6, 8.0],
)

p("Un detalle deliberado: las observaciones de los docentes son de uso interno. "
  "El estudiante no las ve desde su panel. Exponerlas cambiaría lo que un "
  "docente se atreve a escribir, y la utilidad de una observación depende de "
  "que sea franca.", espacio_antes=8)

salto()

# ==========================================================================
# 5. MOTOR DE RIESGO
# ==========================================================================

titulo1("5. El motor de riesgo")

p("Aunque el sistema se llame «dashboard», su pieza central no es la pantalla "
  "sino el motor que calcula el riesgo. El panel solo presenta lo que este "
  "produce.")

titulo2("5.1 Cómo se calcula cada indicador")

tabla(
    ["Indicador", "Cálculo"],
    [
        ["Promedio acumulado",
         "Promedio de todas las calificaciones del periodo, sobre todos los cursos"],
        ["Porcentaje de asistencia",
         "(presentes + tardes) ÷ (total de sesiones − justificadas) × 100"],
        ["Participación",
         "total de interacciones ÷ (semanas transcurridas × número de cursos)"],
        ["Entregas vencidas",
         "Entregas en estado vencido cuya fecha límite cae en las últimas 4 semanas"],
    ],
    anchos=[4.2, 11.2],
)

p("Dos decisiones merecen explicación:", espacio_antes=6)

vineta("se excluyen del denominador en lugar de contarse "
       "como ausencia. Penalizarlas castigaría a quien reportó su situación a "
       "tiempo, que es justo el comportamiento que la institución quiere "
       "fomentar. Un estudiante con 10 sesiones, 6 presentes, 2 ausencias y 2 "
       "justificadas obtiene 75 % y no 60 %.",
       negrita_hasta="Las inasistencias justificadas ")
vineta("mira solo las últimas cuatro semanas. "
       "Para una alerta temprana importa el rezago reciente, no un "
       "incumplimiento del inicio del semestre que el estudiante ya remontó.",
       negrita_hasta="El indicador de entregas ")

titulo2("5.2 La matriz de riesgo")

p("Cada indicador se clasifica en verde, amarillo o rojo según sus umbrales, y "
  "cada color aporta puntos que se ponderan:")

tabla(
    ["Indicador", "Verde (0 pts)", "Amarillo (50 pts)", "Rojo (100 pts)", "Peso"],
    [
        ["Promedio acumulado", "≥ 3.5", "3.0 – 3.49", "< 3.0", "40 %"],
        ["Porcentaje de asistencia", "≥ 85 %", "70 – 84 %", "< 70 %", "30 %"],
        ["Participación semanal", "≥ 3", "1 – 2", "< 1", "20 %"],
        ["Entregas vencidas", "0", "1 – 2", "≥ 3", "10 %"],
    ],
    anchos=[4.4, 2.6, 3.2, 2.8, 2.0],
)

p("El puntaje global es la suma de los puntos ponderados, entre 0 y 100:",
  espacio_antes=6)

codigo(["puntaje = Σ (puntos_indicador × peso_indicador)"])

tabla(
    ["Puntaje", "Nivel", "Color en la interfaz"],
    [
        ["0 – 33", "Normal", "Verde"],
        ["34 – 66", "Riesgo medio", "Ámbar"],
        ["67 – 100", "Riesgo alto", "Rojo"],
    ],
    anchos=[3.4, 4.0, 5.0],
    colores_columna={1: {"Normal": VERDE, "Riesgo medio": AMBAR, "Riesgo alto": ROJO}},
)

titulo3("Regla de anulación")

p("Un promedio ponderado puede esconder una señal grave. Por eso, si el "
  "promedio o la asistencia caen en rojo, el estudiante queda en riesgo medio "
  "como mínimo, aunque el puntaje calculado diera normal. Los pesos ordenan la "
  "atención; no deben silenciar una alarma.")

titulo3("Umbrales configurables")

p("Ninguno de esos valores está fijo en el código: viven en la base de datos y "
  "el administrador los modifica desde la interfaz. Al endurecer el promedio "
  "mínimo de 3.0 a 3.5 en una prueba, la clasificación pasó de 130 / 44 / 26 a "
  "101 / 47 / 52 estudiantes sin tocar una línea de código ni desplegar nada. "
  "Cada cambio queda registrado en la auditoría con el valor anterior y el nuevo.")

titulo2("5.3 Ciclo de vida de una alerta")

p("Una alerta no es un color en una tabla: es un caso que alguien abre, toma, "
  "documenta y cierra.")

codigo([
    "   NUEVA  ---->  EN_PROCESO  ---->  GESTIONADA",
    "     |                                  ^",
    "     |                                  |",
    "     +------->  DESCARTADA              |",
    "                                        |",
    "        (recuperacion automatica del estudiante)",
])

p("Cada transición exige registrar la acción realizada —contacto, tutoría, "
  "remisión a Bienestar, cierre u otra— con su descripción. El seguimiento y "
  "el cambio de estado se escriben en una transacción: una alerta marcada como "
  "gestionada sin la acción que lo justifica destruiría la trazabilidad que da "
  "sentido al módulo.")

titulo3("Sincronización sin duplicados")

p("El motor puede ejecutarse todas las noches. Para que eso no acumule basura:")

vineta("Existe una sola alerta abierta por estudiante y tipo. Si el riesgo "
       "persiste, se actualiza la existente en lugar de crear otra.")
vineta("Si el estudiante se recupera, sus alertas abiertas se cierran solas "
       "como gestionadas.")
vineta("Si cambia el tipo de alerta, las anteriores se descartan para no dejar "
       "dos alertas describiendo la misma situación.")

p("En la verificación, la segunda ejecución consecutiva sobre los mismos datos "
  "creó cero alertas nuevas, que es exactamente el comportamiento esperado.")

titulo2("5.4 Escalamiento a Bienestar Universitario")

p("Una alerta de riesgo alto que permanezca sin gestión durante más de cinco "
  "días hábiles se escala automáticamente: se envía un correo a Bienestar "
  "Universitario con los datos de contacto del estudiante y el motivo de cada "
  "alerta, y queda constancia en la auditoría.")

p("Este requisito no estaba en el documento original como requisito propio: "
  "aparecía mencionado dentro de un flujo alterno. Se formalizó porque, sin "
  "él, una alerta podía quedar abierta indefinidamente sin que nadie más se "
  "enterara.")

titulo2("5.5 Rendimiento")

p("Los cuatro indicadores de todos los estudiantes se agregan en una sola "
  "consulta SQL con subconsultas por indicador, no recorriendo registros en "
  "memoria. Con los 200 estudiantes de prueba y sus casi 52.000 registros "
  "académicos, una ejecución completa del motor —cálculo, guardado del "
  "histórico y sincronización de las 70 alertas— toma alrededor de 1,8 "
  "segundos.")

salto()

# ==========================================================================
# 6. FUNCIONALIDADES
# ==========================================================================

titulo1("6. Funcionalidades del sistema")

titulo2("6.1 Requisitos funcionales")

p("Los trece requisitos funcionales están implementados. Los doce primeros "
  "provienen de los documentos de análisis y diseño; el decimotercero se añadió "
  "al formalizar el escalamiento a Bienestar.")

tabla(
    ["Código", "Requisito", "Dónde está implementado"],
    [
        ["RF01", "Autenticación con roles diferenciados",
         "Módulo auth, guards globales, tabla de roles"],
        ["RF02", "Calificaciones por curso, corte y periodo",
         "Ficha del estudiante: tabla de cortes y gráfica por curso"],
        ["RF03", "Asistencia y su histórico",
         "Ficha del estudiante: porcentaje por curso e historial sesión a sesión"],
        ["RF04", "Participación en foros y actividades",
         "Indicador calculado por el motor y mostrado en la ficha"],
        ["RF05", "Alertas automáticas por umbrales",
         "Motor de riesgo con umbrales configurables"],
        ["RF06", "Observaciones cualitativas del docente",
         "Módulo de observaciones, sección en la ficha del estudiante"],
        ["RF07", "Exportación en PDF y Excel",
         "Módulo de reportes: listado, alertas y ficha individual"],
        ["RF08", "Filtros por programa, curso, cohorte y periodo",
         "Filtros del panel, alimentados por catálogos derivados de los datos"],
        ["RF09", "Notificaciones en plataforma y por correo",
         "Buzón en la barra superior y envío por SMTP"],
        ["RF10", "Panel individual del estudiante",
         "Ruta «Mi progreso», restringida al propio estudiante"],
        ["RF11", "Panel consolidado del coordinador",
         "Panel de estudiantes con distribución por nivel de riesgo"],
        ["RF12", "Historial de alertas, seguimientos e indicadores",
         "Histórico de indicadores y seguimiento por alerta"],
        ["RF13", "Escalamiento a Bienestar Universitario",
         "Detección y despacho por correo tras cinco días hábiles"],
    ],
    anchos=[1.8, 5.6, 8.0],
)

titulo2("6.2 Casos de uso implementados")

tabla(
    ["Caso de uso", "Actor", "Resumen"],
    [
        ["Iniciar sesión", "Todos",
         "Acceso con cuenta institucional; el sistema lleva a cada rol a su panel"],
        ["Visualizar dashboard personal", "Todos",
         "Cada rol ve un panel distinto con el alcance que le corresponde"],
        ["Gestionar alertas", "Docente, coordinador",
         "Ver la alerta, entrar al detalle, registrar la acción y cambiar el estado"],
        ["Registrar observación", "Docente",
         "Nota cualitativa sobre un estudiante de sus cursos"],
        ["Gestionar umbrales", "Administrador",
         "Cambiar los cortes y pesos de la matriz de riesgo"],
        ["Exportar reportes", "Docente, coordinador, administrador",
         "Descargar el listado o una ficha con los filtros activos en pantalla"],
        ["Gestionar usuarios y roles", "Administrador",
         "Crear cuentas administrativas, cambiar rol y estado, restablecer contraseñas"],
        ["Consultar historial", "Docente, coordinador, estudiante",
         "Evolución del riesgo, alertas anteriores y sus seguimientos"],
    ],
    anchos=[4.0, 3.6, 7.8],
)

titulo2("6.3 Pantallas de la aplicación")

titulo3("Inicio de sesión")
p("Ocupa el ancho completo en dos mitades. La izquierda presenta el propósito "
  "del sistema y la escala de riesgo antes de entrar; la derecha es el "
  "formulario. Los cuatro perfiles del sistema aparecen como botones que "
  "cargan las credenciales de prueba correspondientes.")

titulo3("Panel de estudiantes")
p("Es la pantalla de docentes y coordinadores. Encabeza con la distribución "
  "por nivel de riesgo y lista a los estudiantes ordenados por puntaje "
  "descendente: el panel abre mostrando a quien necesita atención, no a quien "
  "va bien. Cada valor que incumple su umbral se resalta en la tabla. Los "
  "filtros son programa, curso, cohorte, periodo, nivel de riesgo y búsqueda "
  "por nombre o código.")

titulo3("Ficha del estudiante")
p("Reúne todo lo que se sabe de un estudiante: los cuatro indicadores con su "
  "umbral y su peso, tres gráficas (promedio por curso, indicadores actuales y "
  "evolución del riesgo), la tabla de rendimiento curso por curso con las notas "
  "de cada corte, el historial de asistencia sesión a sesión, las alertas con "
  "su seguimiento y las observaciones docentes. Desde aquí se descarga la ficha "
  "en PDF.")

titulo3("Gestión de alertas")
p("Contadores por estado y listado filtrable. Cada alerta abierta se atiende "
  "desde un diálogo que exige la acción realizada y su descripción antes de "
  "cambiar el estado.")

titulo3("Usuarios y roles")
p("Pantalla del administrador. Muestra los cuatro roles con sus permisos y el "
  "número de cuentas, permite crear cuentas administrativas, activar o "
  "desactivar usuarios y consultar el registro de auditoría.")

titulo3("Umbrales de riesgo")
p("Los cuatro indicadores con sus cortes verde y amarillo y su peso, editables. "
  "Los cambios se aplican en el siguiente cálculo del motor.")

salto()

# ==========================================================================
# 7. SEGURIDAD
# ==========================================================================

titulo1("7. Seguridad y protección de datos")

titulo2("7.1 Lo que está implementado")

vineta("con JWT. El token lleva el identificador y el rol, "
       "y en cada petición se vuelve a consultar el usuario: una cuenta "
       "desactivada pierde el acceso de inmediato, sin esperar a que el token "
       "expire.", negrita_hasta="Autenticación ")
vineta("con bcrypt. Nunca se guardan ni se "
       "devuelven en claro.", negrita_hasta="Contraseñas cifradas ")
vineta("al menos ocho caracteres con mayúscula, "
       "minúscula y dígito, validada en el servidor.",
       negrita_hasta="Política de contraseñas: ")
vineta("tras cinco intentos fallidos la cuenta "
       "queda bloqueada quince minutos. Ambos valores son configurables.",
       negrita_hasta="Bloqueo por intentos: ")
vineta("el mensaje de credenciales inválidas "
       "es el mismo exista o no el correo, para no permitir averiguar qué "
       "cuentas existen.", negrita_hasta="Mensaje único de error: ")
vineta("cada endpoint declara qué roles lo "
       "pueden usar, y el alcance se recalcula en el servidor en cada "
       "consulta. Filtrar un listado no es control de acceso: quien conozca un "
       "identificador podría pedir el detalle directamente, así que cada "
       "consulta puntual revalida el mismo alcance.",
       negrita_hasta="Autorización por rol: ")
vineta("accesos, cambios de umbral, gestión de "
       "usuarios y escalamientos quedan registrados con su autor y su detalle.",
       negrita_hasta="Registro de auditoría: ")
vineta("el sistema impide desactivar o "
       "cambiar de rol a la última cuenta de administrador activa, y nadie "
       "puede desactivarse a sí mismo.",
       negrita_hasta="Salvaguardas de administración: ")

titulo2("7.2 Lo que queda pendiente")

p("Conviene decirlo con claridad, porque son requisitos del documento que "
  "todavía no se pueden dar por cumplidos:")

tabla(
    ["Pendiente", "Situación"],
    [
        ["Cifrado en reposo",
         "La base de datos no está cifrada. El cifrado en tránsito queda "
         "cubierto con HTTPS al desplegar, pero el RNF03 exige ambos"],
        ["Política de retención y anonimización",
         "La Ley 1581 de 2012 exige definir cuánto tiempo se conservan los "
         "datos y cómo se anonimizan. Es una decisión institucional, no técnica"],
        ["Aviso de privacidad y consentimiento",
         "No hay pantalla de aceptación del tratamiento de datos personales"],
        ["Autenticación de segundo factor",
         "Recomendable para las cuentas de administrador"],
    ],
    anchos=[4.6, 10.8],
)

salto()

# ==========================================================================
# 8. REQUISITOS NO FUNCIONALES
# ==========================================================================

titulo1("8. Estado de los requisitos no funcionales")

p("Esta tabla es deliberadamente honesta: distingue lo implementado de lo que "
  "solo puede comprobarse tras desplegar el sistema.")

tabla(
    ["Código", "Requisito", "Estado", "Observación"],
    [
        ["RNF01", "Disponibilidad del 99 %", "Pendiente",
         "Requiere despliegue y monitoreo para poder medirse"],
        ["RNF02", "Carga del panel en menos de 3 s", "Parcial",
         "El motor resuelve 200 estudiantes en 1,8 s; falta medir la pantalla "
         "en producción"],
        ["RNF03", "Cifrado en tránsito y en reposo", "Parcial",
         "En tránsito con HTTPS al desplegar; en reposo, pendiente"],
        ["RNF04", "Escalabilidad", "Cumplido",
         "Agregación en SQL con índices, no en memoria"],
        ["RNF05", "Accesibilidad (WCAG)", "Parcial",
         "Etiquetas, roles ARIA y contraste cuidado; el semáforo no depende "
         "solo del color. Falta auditoría formal"],
        ["RNF06", "Compatibilidad y diseño adaptable", "Parcial",
         "Interfaz adaptable implementada; probada en Chrome, falta verificar "
         "en otros navegadores y en un dispositivo móvil real"],
        ["RNF07", "Ley 1581 de 2012", "Parcial",
         "Auditoría, control de acceso y bloqueo implementados; faltan "
         "retención, anonimización y aviso de privacidad"],
        ["RNF08", "Código modular y documentado", "Cumplido",
         "Módulos independientes, comentarios que explican las decisiones, "
         "API documentada con Swagger"],
    ],
    anchos=[1.6, 4.4, 2.2, 7.2],
    colores_columna={2: {"Cumplido": VERDE, "Parcial": AMBAR, "Pendiente": ROJO}},
)

salto()

# ==========================================================================
# 9. LA API
# ==========================================================================

titulo1("9. La API")

p("La API expone 35 rutas agrupadas por módulo. Toda la API exige token, salvo "
  "el inicio de sesión y la comprobación de estado. La documentación "
  "interactiva se genera con Swagger y está disponible en "
  "/api/docs mientras el servidor corre.")

tabla(
    ["Grupo", "Rutas principales", "Quién puede usarlas"],
    [
        ["Autenticación", "POST /auth/login · GET /auth/perfil", "Público / autenticado"],
        ["Estudiantes", "GET /estudiantes · GET /estudiantes/:id",
         "Docente, coordinador, administrador"],
        ["Riesgo", "GET /riesgo/resumen · POST /riesgo/recalcular",
         "Coordinador, administrador"],
        ["Alertas", "GET /alertas · POST /alertas/:id/seguimiento",
         "Docente, coordinador, administrador"],
        ["Observaciones", "POST /observaciones · GET /observaciones/estudiante/:id",
         "Docente (crear), coordinador y administrador (consultar)"],
        ["Reportes", "GET /reportes/estudiantes.xlsx · .pdf · /reportes/alertas.xlsx",
         "Docente, coordinador, administrador"],
        ["Notificaciones", "GET /notificaciones · PATCH /notificaciones/:id/leida",
         "Autenticado"],
        ["Catálogos", "GET /catalogos/programas · cursos · cohortes · periodos",
         "Autenticado, con su alcance"],
        ["Umbrales", "GET /umbrales · PUT /umbrales/:indicador",
         "Consulta autenticada; modificación solo administrador"],
        ["Usuarios", "GET /usuarios · POST /usuarios · PATCH /usuarios/:id",
         "Administrador"],
    ],
    anchos=[2.8, 6.4, 6.2],
)

salto()

# ==========================================================================
# 10. INSTALACIÓN
# ==========================================================================

titulo1("10. Puesta en marcha")

titulo2("10.1 Requisitos previos")

vineta("Node.js 22 o superior")
vineta("Docker Desktop, para la base de datos")

titulo2("10.2 Instalación")

codigo([
    "# 1. Base de datos",
    "docker compose up -d",
    "",
    "# 2. Backend",
    "cd backend",
    "cp .env.example .env",
    "npm install",
    "npx prisma generate",
    "npx prisma migrate dev",
    "npx prisma db seed",
    "npm run start",
    "",
    "# 3. Frontend (en otra terminal)",
    "cd frontend",
    "npm install",
    "npm start",
])

p("La aplicación queda en http://localhost:4200 y la API en "
  "http://localhost:3000/api, con su documentación en "
  "http://localhost:3000/api/docs.")

titulo2("10.3 Usuarios de prueba")

p("La contraseña de todas las cuentas de prueba es Dashboard2026*")

tabla(
    ["Rol", "Correo", "Qué se puede ver con esta cuenta"],
    [
        ["Administrador", "admin@dashboard.edu.co",
         "Todo el sistema, usuarios y umbrales"],
        ["Coordinador", "coordinador.isd@dashboard.edu.co",
         "Los 50 estudiantes de Ingeniería de Software y Datos"],
        ["Docente", "docente1@dashboard.edu.co",
         "Los estudiantes de sus dos cursos"],
        ["Estudiante", "est0001@estudiante.edu.co", "Un perfil de desempeño alto"],
        ["Estudiante", "est0195@estudiante.edu.co", "Un perfil de riesgo alto"],
    ],
    anchos=[2.8, 5.4, 7.2],
)

titulo2("10.4 Comandos útiles")

codigo([
    "npm run db:migrate    aplica cambios del esquema",
    "npm run db:seed       recarga los datos de prueba",
    "npm run db:reset      borra, migra y siembra desde cero",
    "npm run db:studio     explorador visual de la base de datos",
    "npm test              pruebas unitarias",
    "npm run test:e2e      pruebas de integracion",
])

titulo2("10.5 Configuración del correo")

p("Sin SMTP_HOST configurado en el archivo .env, los correos no se envían: se "
  "registran en el log del servidor con su destinatario y contenido completo. "
  "Así el equipo puede desarrollar y sustentar el proyecto sin credenciales de "
  "correo, y el mismo código envía de verdad en producción con solo completar "
  "las variables de entorno. El destinatario del escalamiento a Bienestar se "
  "define en BIENESTAR_EMAIL.")

salto()

# ==========================================================================
# 11. PRUEBAS
# ==========================================================================

titulo1("11. Pruebas realizadas")

titulo2("11.1 Pruebas unitarias")

p("El motor de riesgo se implementó como funciones puras, sin dependencia de "
  "la base de datos ni del framework. Esa separación permite probar la regla "
  "de negocio de forma aislada, y es la parte del sistema que conviene poder "
  "explicar línea por línea.")

p("24 pruebas cubren: la clasificación de cada indicador contra sus umbrales, "
  "la comparación invertida para entregas vencidas, los cortes del puntaje "
  "global, la ponderación, la normalización de pesos que no suman uno, la "
  "regla de anulación por indicador crítico, la selección del tipo de alerta y "
  "la redacción del mensaje. Todas pasan.")

titulo2("11.2 Verificaciones funcionales")

tabla(
    ["Qué se probó", "Resultado"],
    [
        ["Ejecución completa del motor sobre 200 estudiantes",
         "130 normal, 44 riesgo medio, 26 riesgo alto; 70 alertas en 1,8 s"],
        ["Segunda ejecución consecutiva",
         "Cero alertas nuevas: el motor es idempotente"],
        ["Cambio de umbral desde la interfaz",
         "La clasificación pasó de 130/44/26 a 101/47/52 sin desplegar código"],
        ["Ciclo completo de una alerta",
         "Nueva → en proceso → gestionada, con seguimiento y fecha de gestión"],
        ["Escalamiento a Bienestar",
         "Tres alertas envejecidas a 8 días se detectan y el correo se compone "
         "con los datos de contacto"],
        ["Exportación",
         "PDF válido con fuentes incrustadas y tildes correctas; Excel con las "
         "50 filas del alcance del coordinador"],
        ["Filtro por cohorte",
         "Devuelve exactamente los estudiantes de la cohorte pedida"],
        ["Gestión de usuarios",
         "Correo duplicado responde 409; contraseña débil, 400; cuenta de "
         "estudiante suelta, 400"],
    ],
    anchos=[5.4, 10.0],
)

titulo2("11.3 Pruebas de control de acceso")

p("Se verificó explícitamente que el alcance no se puede eludir:")

vineta("Un estudiante recibe 403 al intentar listar estudiantes, ver alertas, "
       "consultar la ficha de otro o descargar el listado completo. Sobre su "
       "propia ficha recibe 200.")
vineta("Un coordinador recibe 403 al pedir un programa que no coordina, o la "
       "ficha de un estudiante de otro programa.")
vineta("Un docente recibe 403 al registrar una observación sobre un estudiante "
       "que no cursa con él.")
vineta("Coordinadores y docentes reciben 403 en toda la gestión de usuarios.")

titulo2("11.4 Defectos encontrados y corregidos")

p("Se documentan porque muestran que las pruebas sirvieron para algo:")

tabla(
    ["Defecto", "Causa y corrección"],
    [
        ["El token no validaba",
         "Se firmaba con el secreto por defecto y se verificaba con el del "
         "archivo de configuración, porque el módulo evaluaba las variables de "
         "entorno antes de que se cargaran. Ahora ambos leen la configuración "
         "por la misma vía"],
        ["Hueco de autorización",
         "La consulta de detalle no revalidaba el alcance por rol: un "
         "coordinador que conociera un identificador podía abrir la ficha de "
         "un estudiante de otro programa. Cada consulta puntual revalida ahora "
         "el mismo alcance que el listado"],
        ["Cifras incoherentes en el panel",
         "Las tarjetas de resumen mostraban el total de la institución mientras "
         "la tabla listaba solo el programa del coordinador"],
        ["La ficha del estudiante no cargaba",
         "Los parámetros de ruta se asignan después de construir el "
         "componente; la carga se movió a un efecto reactivo"],
    ],
    anchos=[4.4, 11.0],
)

salto()

# ==========================================================================
# 12. LO QUE FALTA
# ==========================================================================

titulo1("12. Trabajo pendiente")

p("El sistema cubre los trece requisitos funcionales y los casos de uso de los "
  "documentos de análisis y diseño. Queda por hacer:")

titulo2("12.1 Antes de un uso real")

vineta("de la base de datos, exigido por el RNF03 y por "
       "la Ley 1581.", negrita_hasta="Cifrado en reposo ")
vineta("con HTTPS, con la medición de "
       "disponibilidad y tiempo de carga que exigen los RNF01 y RNF02.",
       negrita_hasta="Despliegue en un servidor ")
vineta("con el LMS institucional. Hoy los datos "
       "provienen de la carga inicial; la interfaz de importación está "
       "especificada pero no implementada.",
       negrita_hasta="Integración real ")
vineta("y aviso de privacidad, que son "
       "decisiones institucionales.", negrita_hasta="Política de retención ")

titulo2("12.2 Mejoras razonables")

vineta("Pruebas de integración de extremo a extremo, además de las unitarias "
       "del motor.")
vineta("Auditoría de accesibilidad conforme a WCAG y pruebas en varios "
       "navegadores y en dispositivos móviles reales.")
vineta("Carga de archivos adjuntos en las observaciones: el campo existe en el "
       "modelo, falta la subida.")
vineta("Manual de usuario por rol, distinto de esta documentación técnica.")

salto()

# ==========================================================================
# 13. RESUMEN
# ==========================================================================

titulo1("13. Resumen")

tabla(
    ["Aspecto", "Estado"],
    [
        ["Requisitos funcionales", "13 de 13 implementados"],
        ["Casos de uso del diagrama", "8 de 8 implementados"],
        ["Requisitos no funcionales", "2 cumplidos, 5 parciales, 1 pendiente"],
        ["Tablas en la base de datos", "18"],
        ["Rutas de la API", "35"],
        ["Pruebas unitarias", "24, todas en verde"],
        ["Líneas de código", "Alrededor de 7.700, sin contar dependencias"],
        ["Roles con acceso", "4: estudiante, docente, coordinador, administrador"],
    ],
    anchos=[6.0, 9.4],
)

p("La conclusión honesta es que el sistema está funcionalmente completo frente "
  "a lo que especifican los documentos del proyecto, y que lo que falta para "
  "un uso institucional real no es funcionalidad sino infraestructura: "
  "desplegarlo, cifrar la base de datos, conectarlo al LMS y definir las "
  "políticas de datos personales.", espacio_antes=10)

pie_de_pagina()

salida = Path(__file__).parent / "Sistema-Dashboard-Seguimiento-Academico.docx"
doc.save(salida)
print(f"Documento generado: {salida}")
