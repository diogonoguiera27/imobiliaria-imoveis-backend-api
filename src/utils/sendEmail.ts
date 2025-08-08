import nodemailer from "nodemailer";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  // Cria o transporte SMTP com base nas variáveis do .env
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === "true", // true = porta 465, false = 587/STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Usa o remetente configurado no .env, se existir, senão usa o EMAIL_USER
  const fromAddress =
    process.env.EMAIL_FROM || `"Imobiliária App" <${process.env.EMAIL_USER}>`;

  // Envia o e-mail
  await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
  });
}
