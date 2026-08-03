
const pool = require('../config/db');

async function stats(req, res) {
  const [[enAttente]] = await pool.query(`SELECT COUNT(*) AS n FROM demandes WHERE statut = 'envoyee'`);
  const [[enCours]]   = await pool.query(`SELECT COUNT(*) AS n FROM demandes WHERE statut = 'en_cours'`);
  const [[terminees]] = await pool.query(`SELECT COUNT(*) AS n FROM demandes WHERE statut = 'terminee'`);
  const [[enRetard]]  = await pool.query(
    `SELECT COUNT(*) AS n FROM demandes
     WHERE statut != 'terminee' AND date_fin_prevue IS NOT NULL AND date_fin_prevue < CURDATE()`
  );

  const [[livraison]] = await pool.query(
    `SELECT
       COUNT(*) AS totalAvecLivraison,
       SUM(CASE WHEN date_livraison < CURDATE() THEN 1 ELSE 0 END) AS enRetardLivraison
     FROM demandes
     WHERE statut != 'terminee' AND date_livraison IS NOT NULL`
  );
  const totalAvecLivraison = Number(livraison.totalAvecLivraison) || 0;
  const enRetardLivraison  = Number(livraison.enRetardLivraison) || 0;
  const aTempsLivraison    = totalAvecLivraison - enRetardLivraison;
  const tauxRespectDelais  = totalAvecLivraison > 0
    ? Math.round((aTempsLivraison / totalAvecLivraison) * 100)
    : null;

  const maintenant = new Date();
  const debutSemaineCourante = new Date(maintenant);
  const jourSemaine = (debutSemaineCourante.getDay() + 6) % 7;
  debutSemaineCourante.setDate(debutSemaineCourante.getDate() - jourSemaine);
  debutSemaineCourante.setHours(0, 0, 0, 0);

  const bornesSemaines = [];
  for (let i = 0; i < 4; i++) {
    const debut = new Date(debutSemaineCourante);
    debut.setDate(debut.getDate() - (3 - i) * 7);
    const fin = new Date(debut);
    fin.setDate(fin.getDate() + 6);
    fin.setHours(23, 59, 59, 999);
    bornesSemaines.push({ debut, fin });
  }

  const [terminéesRecentes] = await pool.query(
    `SELECT date_terminee, nombre_engins FROM demandes
     WHERE statut = 'terminee' AND date_terminee >= ?`,
    [bornesSemaines[0].debut]
  );

  const semaines = [0, 0, 0, 0];
  for (const d of terminéesRecentes) {
    const dateTerm = new Date(d.date_terminee);
    const index = bornesSemaines.findIndex(b => dateTerm >= b.debut && dateTerm <= b.fin);
    if (index !== -1) semaines[index] += Number(d.nombre_engins) || 1;
  }

  const formatCourt = (d) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  console.log({
    tauxRespectDelais,
    retardLivraison: {
        enRetard: enRetardLivraison,
        aTemps: aTempsLivraison,
        total: totalAvecLivraison
    }
});
  res.json({
    kpi: { enAttente: enAttente.n, enCours: enCours.n, terminees: terminees.n, enRetard: enRetard.n },
    parSemaine: semaines.map((v, i) => ({
      label: `${formatCourt(bornesSemaines[i].debut)} – ${formatCourt(bornesSemaines[i].fin)}`,
      valeur: v,
    })),
    tauxRespectDelais,
    retardLivraison: { enRetard: enRetardLivraison, aTemps: aTempsLivraison, total: totalAvecLivraison },
  });
}

module.exports = { stats };