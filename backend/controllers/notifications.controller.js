const pool = require('../config/db');

async function list(req, res) {
  const { type, page = 1, limit = 8 } = req.query;
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(50, Math.max(1, Number(limit) || 8));
  const offset = (p - 1) * l;

  const params = [req.user.id];
  let whereType = '';
  if (type && type !== 'all') { whereType = 'AND type = ?'; params.push(type); }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM notifications WHERE destinataire_id = ? AND statut = 'non_lue' ${whereType}`,
    params
  );
  const [[{ nonLues }]] = await pool.query(
    `SELECT COUNT(*) AS nonLues FROM notifications WHERE destinataire_id = ? AND statut = 'non_lue'`,
    [req.user.id]
  );
  const [rows] = await pool.query(
    `SELECT * FROM notifications WHERE destinataire_id = ? AND statut = 'non_lue' ${whereType}
     ORDER BY date_creation DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );

  res.json({ items: rows, total, nonLues, page: p, limit: l });
}

async function marquerLue(req, res) {
  await pool.query(
    `UPDATE notifications SET statut = 'lue' WHERE id = ? AND destinataire_id = ?`,
    [req.params.id, req.user.id]
  );
  res.json({ id: Number(req.params.id), statut: 'lue' });
}

async function toutMarquerLu(req, res) {
  await pool.query(
    `UPDATE notifications SET statut = 'lue' WHERE destinataire_id = ? AND statut = 'non_lue'`,
    [req.user.id]
  );
  res.json({ ok: true });
}

module.exports = { list, marquerLue, toutMarquerLu };
