const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/db');
const { logAction } = require('../services/journal.service');

function generateTempPassword() {
  return crypto.randomBytes(6).toString('base64').replace(/[+/=]/g, '').slice(0, 10);
}

// TODO (email) : brancher un vrai envoi (Nodemailer/SendGrid/SES) au lieu du console.log.
const { envoyerIdentifiants } = require('../services/mail.service');

async function list(req, res) {
  const { role } = req.query;
  const params = [];
  let where = '';
  if (role) { where = 'WHERE role = ?'; params.push(role); }
  const [rows] = await pool.query(`SELECT id, nom, prenom, email_pro, role, statut FROM utilisateurs ${where} ORDER BY nom`, params);
  res.json(rows);
}
async function listTechniciens(req, res) {
  const [rows] = await pool.query(
    `SELECT id, nom, prenom FROM utilisateurs WHERE role = 'technicien' AND statut = 'actif' ORDER BY nom`
  );
  res.json(rows);
}

module.exports = { list, create, setStatut, changerMotDePasse, listTechniciens };
async function create(req, res) {
  const { nom, prenom, emailPro, role } = req.body;
  if (!nom || !prenom || !emailPro || !role) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  }

  try {
    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);

    const [result] = await pool.query(
      `INSERT INTO utilisateurs (nom, prenom, email_pro, mot_de_passe, role, statut)
       VALUES (?, ?, ?, ?, ?, 'actif')`,
      [nom, prenom, emailPro, hash, role]
    );

    await envoyerIdentifiants(emailPro, prenom, tempPassword);
    await logAction(null, req.user.id, 'Compte créé', `Compte créé pour ${prenom} ${nom} (${role})`);

    res.status(201).json({ id: result.insertId, nom, prenom, emailPro, role, statut: 'actif' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
}

async function setStatut(req, res) {
  const { id } = req.params;
  const { statut } = req.body;

  if (!['actif', 'inactif'].includes(statut)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }

  try {
    await pool.query(`UPDATE utilisateurs SET statut = ? WHERE id = ?`, [statut, id]);
    await logAction(
      null,
      req.user.id,
      statut === 'actif' ? 'Compte réactivé' : 'Compte désactivé',
      `Compte #${id}`
    );
    res.json({ id: Number(id), statut });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
}

async function changerMotDePasse(req, res) {
  const { ancienMotDePasse, nouveauMotDePasse } = req.body;
  if (!ancienMotDePasse || !nouveauMotDePasse) {
    return res.status(400).json({ error: 'Champs requis manquants.' });
  }
  if (nouveauMotDePasse.length < 8) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 8 caractères.' });
  }

  const [rows] = await pool.query(`SELECT mot_de_passe FROM utilisateurs WHERE id = ?`, [req.user.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  const valid = await bcrypt.compare(ancienMotDePasse, rows[0].mot_de_passe);
  if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });

  const hash = await bcrypt.hash(nouveauMotDePasse, 10);
  await pool.query(`UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?`, [hash, req.user.id]);
  await logAction(null, req.user.id, 'Mot de passe modifié', '');

  res.json({ ok: true });
}

async function moi(req, res) {
  const [rows] = await pool.query(
    `SELECT id, nom, prenom, email_pro, role, date_creation FROM utilisateurs WHERE id = ?`,
    [req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  res.json(rows[0]);
}

async function modifierProfil(req, res) {
  const { nom, prenom, emailPro } = req.body;
  if (!nom || !prenom || !emailPro) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  }
  try {
    await pool.query(
      `UPDATE utilisateurs SET nom = ?, prenom = ?, email_pro = ? WHERE id = ?`,
      [nom, prenom, emailPro, req.user.id]
    );
    await logAction(null, req.user.id, 'Profil modifié', '');
    res.json({ id: req.user.id, nom, prenom, emailPro });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
}

module.exports = { list, create, setStatut, changerMotDePasse, listTechniciens, moi, modifierProfil };
