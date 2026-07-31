import { Resend } from 'resend'

export async function sendMessageAlert({
  to,
  userName,
  contactName,
  message,
  isPriority,
}: {
  to: string
  userName: string
  contactName: string
  message: string
  isPriority: boolean
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const subject = isPriority
    ? `⚡ Mensagem prioritária de ${contactName}`
    : `Nova mensagem de ${contactName} — MeuDIA`

  await resend.emails.send({
    from: 'MeuDIA <noreply@meudia.saacs.com.br>',
    to,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
          <span style="font-size: 18px; font-weight: 700; color: #2A5F6B;">MeuDIA</span>
        </div>
        <p style="color: #374151; margin-bottom: 8px;">Olá, <strong>${userName}</strong>!</p>
        <p style="color: #374151; margin-bottom: 16px;">
          ${isPriority ? '<strong>Contato prioritário:</strong> ' : ''}<strong>${contactName}</strong> enviou uma mensagem:
        </p>
        <div style="border-left: 3px solid #2A5F6B; padding: 12px 16px; background: #f9fafb; border-radius: 0 8px 8px 0; margin-bottom: 24px; color: #374151;">
          ${message}
        </div>
        <p style="color: #9ca3af; font-size: 12px; border-top: 1px solid #f3f4f6; padding-top: 16px;">
          MeuDIA — gerenciando seu WhatsApp enquanto você foca no que importa.
        </p>
      </div>
    `,
  })
}
