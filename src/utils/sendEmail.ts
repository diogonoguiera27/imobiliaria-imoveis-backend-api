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
  
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === "true", 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  
  const fromAddress =
    process.env.EMAIL_FROM || `"Imobiliária App" <${process.env.EMAIL_USER}>`;

  
  await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
  });
}
