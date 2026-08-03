const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db.js');
const { logAction } = require('../services/journal.service');

async function login(req, res) {
  const { email, motDePasse } = req.body;
  if (!email || !motDePasse) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM utilisateurs WHERE email_pro = ? AND statut = 'actif'`,
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(motDePasse, user.mot_de_passe);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, nom: user.nom, prenom: user.prenom },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    await logAction(null, user.id, 'Connexion', `Connexion réussie (${user.email_pro})`);

    res.json({
      token,
      user: { id: user.id, nom: user.nom, prenom: user.prenom, role: user.role },
    });
  } catch (err) {
    console.error('Erreur login :', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
}

module.exports = { login };
