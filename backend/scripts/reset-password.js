const bcrypt = require('bcryptjs');
const pool = require('../config/db');

(async () => {
  const hash = await bcrypt.hash('khaoula2005', 10);
  await pool.query(`UPDATE utilisateurs SET mot_de_passe = ? WHERE email_pro = ?`, [hash, 'khalilkhaoula1234@gmail.com']);
  console.log('Mot de passe mis à jour.');
  process.exit(0);
})();
