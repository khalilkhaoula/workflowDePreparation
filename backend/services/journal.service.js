const pool = require('../config/db');

async function logAction(connection, utilisateurId, action, detail = null) {
  const conn = connection || pool;
  await conn.query(
    `INSERT INTO journal_activite (utilisateur_id, action, detail) VALUES (?, ?, ?)`,
    [utilisateurId, action, detail]
  );
}

module.exports = { logAction };
