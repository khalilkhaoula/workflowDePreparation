const pool = require('../config/db');
const { notifyRole, notifyUser } = require('../services/notification.service');
const { logAction } = require('../services/journal.service');

const ROLES_COMMERCIAL = ['responsable commercial', 'assistant commercial'];
const ROLES_TECHNIQUE  = ['responsable technique', 'assistant technique', 'technicien'];
const ROLES_ENCADREMENT_TECHNIQUE = ROLES_TECHNIQUE.filter(r => r !== 'technicien');

async function planifier(req, res) {
  const { id } = req.params;
  const { datePlanifiee, heureDebut, estDateFin, technicienId } = req.body;

  if (!datePlanifiee || !heureDebut || !technicienId) {
    return res.status(400).json({ error: 'Date et heure de début requises.' });
  }

  const [rows] = await pool.query(
    `SELECT do.demande_id, do.temps_main_oeuvre_h, d.nombre_engins, o.nom_option, d.reference
     FROM demande_options do
     JOIN demandes d ON d.id = do.demande_id
     JOIN options o  ON o.id = do.option_id
     WHERE do.id = ?`, [id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Option introuvable.' });
  const { demande_id, temps_main_oeuvre_h, nombre_engins, nom_option, reference } = rows[0];
  const dureeH = Number(temps_main_oeuvre_h) * (Number(nombre_engins) || 1);

  await pool.query(
    `UPDATE demande_options SET technicien_id = ?, date_planifiee = ?, heure_debut = ?, temps_main_oeuvre_h = ? WHERE id = ?`,
    [technicienId , datePlanifiee, heureDebut, dureeH, id]
  );

  await pool.query(`UPDATE demandes SET statut = 'en_cours' WHERE id = ? AND statut = 'envoyee'`, [demande_id]);
  if (estDateFin) {
    await pool.query(`UPDATE demandes SET date_fin_prevue = ?, retard_notifie = FALSE WHERE id = ?`, [datePlanifiee, demande_id]);
  }

  await notifyUser(null, technicienId, {
    titre: 'Nouvelle option planifiée',
    message: `L'option "${nom_option}" de la demande ${reference} vous a été assignée le ${datePlanifiee} à ${heureDebut}.`,
    expediteurId: req.user.id,
    reference,
    type: 'planification',
});

  await logAction(null, req.user.id, 'Planning modifié', `Option #${id} planifiée le ${datePlanifiee}`);
  res.json({ id: Number(id), dureeH, heureDebut });
}

async function mesOptions(req, res) {
  const [rows] = await pool.query(
    `SELECT do.id, do.date_planifiee, do.heure_debut, do.temps_main_oeuvre_h, do.statut,
    o.nom_option, d.reference, e.nom AS engin_nom, d.priorite
     FROM demande_options do
     JOIN options o   ON o.id = do.option_id
     JOIN demandes d  ON d.id = do.demande_id
     JOIN engins e    ON e.id = d.engin_id
     WHERE do.technicien_id = ? AND do.date_planifiee <= CURDATE() AND do.statut != 'termine'
     ORDER BY do.date_planifiee DESC, do.heure_debut ASC`,
    [req.user.id]
  );
  res.json(rows);
}

async function parPeriode(req, res) {
  const { debut, fin } = req.query;

  const [taches] = await pool.query(
    `SELECT do.id, do.demande_id, do.date_planifiee, do.heure_debut, do.temps_main_oeuvre_h, do.statut,
            o.nom_option, d.reference, e.nom AS engin_nom
     FROM demande_options do
     JOIN options o   ON o.id = do.option_id
     JOIN demandes d  ON d.id = do.demande_id
     JOIN engins e    ON e.id = d.engin_id
     WHERE do.date_planifiee BETWEEN ? AND ?`,
    [debut, fin]
  );

  const [finsPrevues] = await pool.query(
    `SELECT id, reference, date_fin_prevue FROM demandes WHERE date_fin_prevue BETWEEN ? AND ?`,
    [debut, fin]
  );

  res.json({ taches, finsPrevues });
}

async function terminer(req, res) {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT do.id, do.demande_id, do.date_planifiee, o.nom_option, d.reference
       FROM demande_options do
       JOIN options o  ON o.id = do.option_id
       JOIN demandes d ON d.id = do.demande_id
       WHERE do.id = ?`,
      [id]
    );
    if (rows.length === 0) { await connection.rollback(); return res.status(404).json({ error: 'Option introuvable.' }); }
    const row = rows[0];

    await connection.query(`UPDATE demande_options SET statut = 'termine' WHERE id = ?`, [id]);

    const dateStr = row.date_planifiee ? new Date(row.date_planifiee).toISOString().slice(0, 10) : null;
    const lienPlanning = dateStr ? `planification.html?date=${dateStr}&demandeOptionId=${row.id}` : null;

    for (const role of ROLES_ENCADREMENT_TECHNIQUE) {
  await notifyRole(connection, role, {
    titre: 'Option terminée',
    message: `L'option "${row.nom_option}" de la demande ${row.reference} a été marquée comme terminée.`,
    expediteurId: req.user.id,
    reference: row.reference,
    type: 'terminaison',
    lien: lienPlanning,
  });
}


    const [restantes] = await connection.query(
      `SELECT COUNT(*) AS n FROM demande_options WHERE demande_id = ? AND statut != 'termine'`,
      [row.demande_id]
    );
    if (restantes[0].n === 0) {
      await connection.query(`UPDATE demandes SET statut = 'terminee', date_terminee = NOW() WHERE id = ?`, [row.demande_id]);
      for (const role of [...ROLES_ENCADREMENT_TECHNIQUE, ...ROLES_COMMERCIAL]) {
  await notifyRole(connection, role, {
    titre: 'Demande terminée',
    message: `Toutes les options de la demande ${row.reference} ont été réalisées.`,
    expediteurId: req.user.id,
    reference: row.reference,
    type: 'terminaison',
  });
}
    }

    await logAction(connection, req.user.id, 'Option terminée', `${row.nom_option} — ${row.reference}`);
    await connection.commit();
    res.json({ id: Number(id), statut: 'termine' });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  } finally {
    connection.release();
  }
}
async function verifierRetards() {
  const connection = await pool.getConnection();
  try {
    const [retards] = await connection.query(
      `SELECT id, reference, date_fin_prevue, date_livraison FROM demandes
       WHERE statut != 'terminee'
         AND retard_notifie = FALSE
         AND (
           (date_fin_prevue IS NOT NULL AND date_fin_prevue < CURDATE())
           OR (date_livraison IS NOT NULL AND date_livraison < CURDATE())
         )`
    );

    for (const d of retards) {
      const finDepassee = d.date_fin_prevue && new Date(d.date_fin_prevue) < new Date().setHours(0, 0, 0, 0);
      const livraisonDepassee = d.date_livraison && new Date(d.date_livraison) < new Date().setHours(0, 0, 0, 0);

      let motif;
      if (finDepassee && livraisonDepassee) motif = 'a dépassé sa date de fin prévue et sa date de livraison';
      else if (finDepassee) motif = 'a dépassé sa date de fin prévue';
      else motif = 'a dépassé sa date de livraison';

      for (const role of ROLES_ENCADREMENT_TECHNIQUE) {
        await notifyRole(connection, role, {
          titre: 'Demande en retard',
          message: `La demande ${d.reference} ${motif}.`,
          reference: d.reference,
          type: 'retard',
        });
      }
      await connection.query(`UPDATE demandes SET retard_notifie = TRUE WHERE id = ?`, [d.id]);
    }
  } catch (err) {
    console.error('Erreur verifierRetards:', err);
  } finally {
    connection.release();
  }
}

async function annulerPlanification(req, res) {
  const { id } = req.params;
  const [rows] = await pool.query(`SELECT statut FROM demande_options WHERE id = ?`, [id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Option introuvable.' });
  if (rows[0].statut === 'termine') {
    return res.status(409).json({ error: 'Impossible de retirer du planning une option déjà terminée.' });
  }
  await pool.query(
    `UPDATE demande_options SET date_planifiee = NULL, heure_debut = NULL, technicien_id = NULL WHERE id = ?`,
    [id]
  );
  res.json({ id: Number(id) });
}
module.exports = { planifier, mesOptions, parPeriode, terminer, verifierRetards , annulerPlanification};
