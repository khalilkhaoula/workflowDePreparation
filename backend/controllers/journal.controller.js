const pool = require('../config/db');

async function list(req, res) {
  const [rows] = await pool.query(
    `SELECT j.id, j.action, j.detail, j.date_creation,
            u.nom, u.prenom
     FROM journal_activite j
     JOIN utilisateurs u ON u.id = j.utilisateur_id
     ORDER BY j.date_creation DESC
     LIMIT 200`
  );
  res.json(rows);
}

module.exports = { list };
