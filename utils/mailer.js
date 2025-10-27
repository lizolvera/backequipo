// utils/mailer.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

let transporter;

export async function getTransporter() {
  if (transporter) return transporter;

  const { EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS } = process.env;

  transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT || 465),
    secure: (EMAIL_SECURE === "true"),
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  return transporter;
}

export async function enviarCodigoEmail({ to, codigo }) {
  const t = await getTransporter();
  await t.sendMail({
    from: `"Registro" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Código de verificación",
    text: `Tu código es: ${codigo}. Expira en 5 minutos.`,
    html: `
      <div style="font-family:system-ui;padding:16px">
        <h2>Verificación de cuenta</h2>
        <p>Tu código:</p>
        <div style="font-size:22px;font-weight:700;letter-spacing:3px">${codigo}</div>
        <p style="color:#666">Válido por 5 minutos.</p>
      </div>
    `,
  });
}
