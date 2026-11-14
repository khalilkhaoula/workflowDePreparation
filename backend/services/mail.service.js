const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function envoyerIdentifiants(email, prenom, tempPassword) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Forges de Bazas', email: process.env.MAIL_FROM_EMAIL },
      to: [{ email }],
      subject: 'Votre compte Forges de Bazas',
      htmlContent: `
        <p>Bonjour ${prenom},</p>
        <p>Un compte a été créé pour vous sur la plateforme de préparation d'engins.</p>
        <p><strong>Mot de passe temporaire :</strong> ${tempPassword}</p>
        <p>Connectez-vous puis changez-le immédiatement depuis "Mon compte" → "Sécurité".</p>
      `,
    }),
  });
  if (!res.ok) throw new Error(`Envoi email échoué (${res.status}) : ${await res.text()}`);
}

module.exports = { envoyerIdentifiants };
