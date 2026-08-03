const pool = require('../config/db');

async function parModele(req, res) {
  const { modele } = req.params;

  const [enginRows] = await pool.query(`SELECT id FROM engins WHERE modele = ?`, [modele]);
  if (enginRows.length === 0) return res.json([]);
  const enginIds = enginRows.map(e => e.id);

  const [rows] = await pool.query(
    `SELECT DISTINCT o.id, o.nom_option
     FROM options o
     JOIN engins_option eo ON eo.option_id = o.id
     WHERE eo.engin_id IN (?)
     ORDER BY o.nom_option`,
    [enginIds]
  );
  res.json(rows.map(r => ({ id: r.id, nom: r.nom_option })));
}

async function sousOptions(req, res) {
  const [rows] = await pool.query(
    `SELECT id, nom_sous_option FROM sous_options WHERE option_id = ? ORDER BY nom_sous_option`,
    [req.params.optionId]
  );
  res.json(rows.map(r => ({ id: r.id, nom: r.nom_sous_option })));
}
module.exports = { parModele, sousOptions };
