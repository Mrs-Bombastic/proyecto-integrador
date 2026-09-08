import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export interface MensajeCorreo {
  para: string;
  asunto: string;
  cuerpo: string;
  /** Version HTML opcional; si falta se envia solo texto plano. */
  html?: string;
}

/**
 * Envio de correo (RF09).
 *
 * Si no hay servidor SMTP configurado, el mensaje se registra en el log en
 * lugar de fallar. Asi el equipo puede desarrollar y sustentar el proyecto sin
 * credenciales de correo, y el mismo codigo envia de verdad en produccion con
 * solo completar las variables de entorno.
 */
@Injectable()
export class CorreoService implements OnModuleInit {
  private readonly logger = new Logger(CorreoService.name);
  private transporte?: Transporter;
  private remitente = 'alertas@dashboard-academico.edu.co';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const host = this.config.get<string>('SMTP_HOST');
    this.remitente = this.config.get<string>('SMTP_FROM') ?? this.remitente;

    if (!host) {
      this.logger.log(
        'SMTP no configurado: los correos se registrarán en el log (modo simulación)',
      );
      return;
    }

    this.transporte = nodemailer.createTransport({
      host,
      port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
      secure: Number(this.config.get<string>('SMTP_PORT')) === 465,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASSWORD'),
      },
    });

    this.logger.log(`Correo saliente configurado contra ${host}`);
  }

  /** Indica si los correos salen de verdad o solo se registran. */
  get activo(): boolean {
    return this.transporte !== undefined;
  }

  /**
   * Envia un mensaje. Nunca lanza: una notificacion que falla no debe tumbar
   * la operacion que la origino (generar una alerta, por ejemplo).
   */
  async enviar(mensaje: MensajeCorreo): Promise<boolean> {
    if (!this.transporte) {
      this.logger.log(
        `[simulado] Para: ${mensaje.para} | Asunto: ${mensaje.asunto}\n${mensaje.cuerpo}`,
      );
      return false;
    }

    try {
      await this.transporte.sendMail({
        from: this.remitente,
        to: mensaje.para,
        subject: mensaje.asunto,
        text: mensaje.cuerpo,
        html: mensaje.html,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `No fue posible enviar el correo a ${mensaje.para}: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
      return false;
    }
  }
}
