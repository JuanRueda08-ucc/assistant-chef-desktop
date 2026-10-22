// Envío de los códigos de las cuentas (decisión 0016). En desarrollo, sin SMTP, el código se
// escribe en la consola del backend; para registrar a otras personas hace falta SMTP real.

import nodemailer from 'nodemailer'

export type TipoCodigo = 'sign-in' | 'email-verification' | 'forget-password' | 'change-email'

export interface Correo {
  readonly modo: 'smtp' | 'consola'
  enviarCodigo(destino: string, codigo: string, tipo: TipoCodigo): Promise<void>
}

const ASUNTOS: Record<TipoCodigo, string> = {
  'email-verification': 'Confirma tu correo en Chef digital',
  'forget-password': 'Cambia tu contraseña de Chef digital',
  'sign-in': 'Tu código para entrar en Chef digital',
  'change-email': 'Confirma tu nuevo correo en Chef digital'
}

function texto(codigo: string, tipo: TipoCodigo): string {
  const para =
    tipo === 'forget-password' ? 'cambiar tu contraseña' : 'confirmar tu correo en Chef digital'
  return `Tu código para ${para} es ${codigo}.\nCaduca en 10 minutos. Si no lo pediste, ignora este mensaje.`
}

/**
 * SMTP si están SMTP_HOST y SMTP_FROM; si no, consola. En producción (NODE_ENV=production) la
 * consola no está permitida: los códigos no deben quedar en los registros del servidor.
 */
export function correoDesdeEntorno(env: NodeJS.ProcessEnv): Correo {
  if (env.SMTP_HOST && env.SMTP_FROM) {
    const transporte = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT) || 587,
      secure: env.SMTP_SECURE === 'true',
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } : undefined
    })
    return {
      modo: 'smtp',
      async enviarCodigo(destino, codigo, tipo) {
        await transporte.sendMail({
          from: env.SMTP_FROM,
          to: destino,
          subject: ASUNTOS[tipo],
          text: texto(codigo, tipo)
        })
      }
    }
  }
  if (env.NODE_ENV === 'production')
    throw new Error('Configura SMTP_HOST y SMTP_FROM para enviar los códigos de las cuentas.')
  return {
    modo: 'consola',
    async enviarCodigo(destino, codigo, tipo) {
      console.info(`[correo de desarrollo] ${ASUNTOS[tipo]} → ${destino}: ${codigo}`)
    }
  }
}
