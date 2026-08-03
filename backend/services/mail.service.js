const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function envoyerIdentifiants(email, prenom, tempPassword) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Votre compte Forges de Bazas',
    html: `
      <p>Bonjour ${prenom},</p>
      <p>Un compte a été créé pour vous sur la plateforme de préparation d'engins.</p>
      <p><strong>Mot de passe temporaire :</strong> ${tempPassword}</p>
      <p>Connectez-vous puis changez-le immédiatement depuis "Mon compte" → "Sécurité".</p>
    `,
  });
}

module.exports = { envoyerIdentifiants };
