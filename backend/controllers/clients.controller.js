const pool = require('../config/db');

async function list(req, res) {
  const [rows] = await pool.query(`SELECT * FROM clients ORDER BY nom`);
  res.json(rows);
}

async function create(req, res) {
  const { nom, contact } = req.body;
  if (!nom) return res.status(400).json({ error: 'Nom du client requis.' });

  const [result] = await pool.query(`INSERT INTO clients (nom, contact) VALUES (?, ?)`, [nom, contact]);
  res.status(201).json({ id: result.insertId, nom, contact });
}

module.exports = { list, create };
