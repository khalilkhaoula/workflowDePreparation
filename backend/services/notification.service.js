const pool = require('../config/db');

async function notifyRole(connection, role, { titre, message, expediteurId = null, reference = null, type, lien = null }) {
  const conn = connection || pool;
  const [users] = await conn.query(
    `SELECT id FROM utilisateurs WHERE role = ? AND statut = 'actif'`,
    [role]
  );
  for (const u of users) {
    await conn.query(
      `INSERT INTO notifications (titre, message, destinataire_id, expediteur_id, statut, reference, type, lien)
       VALUES (?, ?, ?, ?, 'non_lue', ?, ?, ?)`,
      [titre, message, u.id, expediteurId, reference, type, lien]
    );
  }
}

async function notifyUser(connection, destinataireId, { titre, message, expediteurId = null, reference = null, type, lien = null }) {
  const conn = connection || pool;
  await conn.query(
    `INSERT INTO notifications (titre, message, destinataire_id, expediteur_id, statut, reference, type, lien)
     VALUES (?, ?, ?, ?, 'non_lue', ?, ?, ?)`,
    [titre, message, destinataireId, expediteurId, reference, type, lien]
  );
}

module.exports = { notifyRole, notifyUser };