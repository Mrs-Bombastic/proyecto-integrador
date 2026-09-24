import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export interface MensajeCorreo {
  /** Uno o varios destinatarios principales. */
  para: string | string[];
  asunto: string;
  cuerpo: string;
  /** Version HTML opcional; si falta se envia solo texto plano. */
  html?: string;
  /**
   * Copia visible. Se usa para que docentes y directivos queden en el mismo
   * hilo del mensaje en lugar de recibir correos separados sin contexto.
   */
  copia?: string | string[];
}

/** Proveedores de salida soportados. `log` solo escribe en consola. */
export type ProveedorCorreo = 'smtp' | 'brevo' | 'log';

/** Endpoint del API transaccional de Brevo (plan gratuito: 300 correos/dia). */
const BREVO_API = 'https://api.brevo.com/v3/smtp/email';

const GMAIL_SMTP = 'smtp.gmail.com';

/**
 * Envio de correo (RF09, RF14).
 *
 * Soporta tres modos, resueltos automaticamente segun las variables de entorno
 * disponibles, de mayor a menor prioridad:
 *
 * 1. `brevo` — API HTTP gratuita (300 correos/dia). Solo exige `BREVO_API_KEY`
 *    y un remitente verificado, que puede ser una cuenta de Gmail. Es la opcion
 *    recomendada en despliegue porque no depende de puertos SMTP, que muchos
 *    proveedores de hosting bloquean.
 * 2. `smtp` — nodemailer contra cualquier servidor, incluido Gmail con una
 *    contrasena de aplicacion (`GMAIL_USER` + `GMAIL_APP_PASSWORD`).
 * 3. `log` — sin credenciales, el mensaje se registra completo en el log en
 *    lugar de fallar. Asi el equipo desarrolla y sustenta el proyecto sin
 *    credenciales de correo, y el mismo codigo envia de verdad en produccion
 *    con solo completar las variables de entorno.
 */
@Injectable()
export class CorreoService implements OnModuleInit {
  private readonly logger = new Logger(CorreoService.name);

  private proveedorActivo: ProveedorCorreo = 'log';
  private transporte?: Transporter;
  private claveBrevo?: string;
  private remitente = 'alertas@dashboard-academico.edu.co';
  private nombreRemitente = 'Seguimiento Académico';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.nombreRemitente =
      this.config.get<string>('CORREO_NOMBRE') ?? this.nombreRemitente;

    const forzado = this.config
      .get<string>('CORREO_PROVEEDOR')
      ?.trim()
      .toLowerCase();

    if (forzado === 'log') {
      this.anunciarSimulacion('CORREO_PROVEEDOR=log');
      return;
    }

    if (forzado !== 'smtp' && this.configurarBrevo()) return;
    if (forzado !== 'brevo' && this.configurarSmtp()) return;

    this.anunciarSimulacion('no hay proveedor de correo configurado');
  }

  /** Proveedor efectivo, para diagnostico y para la pantalla de estado. */
  get proveedor(): ProveedorCorreo {
    return this.proveedorActivo;
  }

  /** Indica si los correos salen de verdad o solo se registran. */
  get activo(): boolean {
    return this.proveedorActivo !== 'log';
  }

  /**
   * Envia un mensaje. Nunca lanza: una notificacion que falla no debe tumbar
   * la operacion que la origino (generar una alerta o radicar una desercion).
   *
   * Devuelve `true` solo si el correo salio de verdad, para que quien llama
   * pueda dejar constancia honesta de lo que ocurrio.
   */
  async enviar(mensaje: MensajeCorreo): Promise<boolean> {
    const para = this.normalizar(mensaje.para);
    const copia = this.normalizar(mensaje.copia);

    if (para.length === 0) {
      this.logger.warn(
        `Correo sin destinatarios, no se envia: ${mensaje.asunto}`,
      );
      return false;
    }

    if (this.proveedorActivo === 'log') {
      this.logger.log(
        `[simulado] Para: ${para.join(', ')}` +
          (copia.length > 0 ? ` | Copia: ${copia.join(', ')}` : '') +
          ` | Asunto: ${mensaje.asunto}\n${mensaje.cuerpo}`,
      );
      return false;
    }

    try {
      if (this.proveedorActivo === 'brevo') {
        await this.enviarPorBrevo(mensaje, para, copia);
      } else {
        await this.enviarPorSmtp(mensaje, para, copia);
      }
      this.logger.log(
        `Correo enviado a ${para.join(', ')} vía ${this.proveedorActivo}: ${mensaje.asunto}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `No fue posible enviar el correo a ${para.join(', ')}: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
      return false;
    }
  }

  // --------------------------- Configuracion ------------------------------

  /**
   * Brevo solo necesita la clave del API y un remitente verificado en su panel.
   * Ese remitente puede ser la cuenta de Gmail del equipo, que es lo que hace
   * viable usarlo sin dominio propio.
   */
  private configurarBrevo(): boolean {
    const clave = this.config.get<string>('BREVO_API_KEY')?.trim();
    if (!clave) return false;

    const remitente =
      this.config.get<string>('CORREO_REMITENTE')?.trim() ??
      this.config.get<string>('SMTP_FROM')?.trim();

    if (!remitente) {
      this.logger.warn(
        'BREVO_API_KEY está definida pero falta CORREO_REMITENTE (el correo verificado en Brevo)',
      );
      return false;
    }

    this.claveBrevo = clave;
    this.remitente = remitente;
    this.proveedorActivo = 'brevo';
    this.logger.log(`Correo saliente por el API de Brevo como ${remitente}`);
    return true;
  }

  /**
   * SMTP generico. Con `GMAIL_USER` y `GMAIL_APP_PASSWORD` se configura Gmail
   * sin repetir host ni puerto: es el camino mas corto para tener correo real
   * en desarrollo, porque no exige registrar ningun servicio adicional.
   */
  private configurarSmtp(): boolean {
    const usuarioGmail = this.config.get<string>('GMAIL_USER')?.trim();
    const claveGmail = this.config.get<string>('GMAIL_APP_PASSWORD')?.trim();
    const host = this.config.get<string>('SMTP_HOST')?.trim();

    if (usuarioGmail && claveGmail) {
      this.transporte = nodemailer.createTransport({
        host: GMAIL_SMTP,
        port: 587,
        secure: false,
        auth: { user: usuarioGmail, pass: claveGmail },
      });
      this.remitente =
        this.config.get<string>('CORREO_REMITENTE')?.trim() ?? usuarioGmail;
      this.proveedorActivo = 'smtp';
      this.logger.log(`Correo saliente por Gmail como ${this.remitente}`);
      return true;
    }

    if (!host) return false;

    const puerto = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    this.transporte = nodemailer.createTransport({
      host,
      port: puerto,
      secure: puerto === 465,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASSWORD'),
      },
    });
    this.remitente =
      this.config.get<string>('CORREO_REMITENTE')?.trim() ??
      this.config.get<string>('SMTP_FROM')?.trim() ??
      this.remitente;
    this.proveedorActivo = 'smtp';
    this.logger.log(`Correo saliente configurado contra ${host}:${puerto}`);
    return true;
  }

  private anunciarSimulacion(razon: string): void {
    this.proveedorActivo = 'log';
    this.logger.log(
      `Correo en modo simulación (${razon}): los mensajes se registrarán en el log`,
    );
  }

  // ------------------------------- Envio ----------------------------------

  private async enviarPorSmtp(
    mensaje: MensajeCorreo,
    para: string[],
    copia: string[],
  ): Promise<void> {
    await this.transporte!.sendMail({
      from: `"${this.nombreRemitente}" <${this.remitente}>`,
      to: para,
      cc: copia.length > 0 ? copia : undefined,
      subject: mensaje.asunto,
      text: mensaje.cuerpo,
      html: mensaje.html,
    });
  }

  private async enviarPorBrevo(
    mensaje: MensajeCorreo,
    para: string[],
    copia: string[],
  ): Promise<void> {
    const respuesta = await fetch(BREVO_API, {
      method: 'POST',
      headers: {
        'api-key': this.claveBrevo!,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: this.remitente, name: this.nombreRemitente },
        to: para.map((email) => ({ email })),
        ...(copia.length > 0
          ? { cc: copia.map((email) => ({ email })) }
          : {}),
        subject: mensaje.asunto,
        textContent: mensaje.cuerpo,
        ...(mensaje.html ? { htmlContent: mensaje.html } : {}),
      }),
    });

    if (!respuesta.ok) {
      // El cuerpo de error de Brevo explica el motivo real (clave invalida,
      // remitente sin verificar, cuota agotada); perderlo deja el fallo ciego.
      const detalle = await respuesta.text().catch(() => '');
      throw new Error(`Brevo respondió ${respuesta.status}: ${detalle}`);
    }
  }

  /** Acepta uno o varios correos y descarta vacios y duplicados. */
  private normalizar(valor: string | string[] | undefined): string[] {
    if (!valor) return [];
    const lista = Array.isArray(valor) ? valor : [valor];
    const limpios = lista
      .flatMap((entrada) => entrada.split(','))
      .map((entrada) => entrada.trim())
      .filter((entrada) => entrada.includes('@'));
    return [...new Set(limpios)];
  }
}
