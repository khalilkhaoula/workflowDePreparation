const pool = require('../config/db');
const { notifyRole } = require('../services/notification.service');
const { logAction } = require('../services/journal.service');

const ROLES_COMMERCIAL = ['responsable commercial', 'assistant commercial'];
const ROLES_TECHNIQUE  = ['responsable technique', 'assistant technique', 'technicien', 'admin'];
const ROLES_ENCADREMENT_TECHNIQUE = ROLES_TECHNIQUE.filter(r => r !== 'technicien');

async function genererReference(connection) {
  const annee = new Date().getFullYear();
  const prefix = `DEM_${annee}_`;

  const [rows] = await connection.query(
    `SELECT reference FROM demandes WHERE reference LIKE ? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [`${prefix}%`]
  );

  let prochainNumero = 1;
  if (rows.length > 0) {
    const dernierNumero = parseInt(rows[0].reference.slice(prefix.length), 10);
    if (!Number.isNaN(dernierNumero)) prochainNumero = dernierNumero + 1;
  }

  return `${prefix}${String(prochainNumero).padStart(4, '0')}`;
}

async function trouverOuCreerClient(connection, nom, contact) {
  const [existing] = await connection.query(`SELECT id FROM clients WHERE nom = ? LIMIT 1`, [nom]);
  if (existing.length > 0) {
    if (contact) await connection.query(`UPDATE clients SET contact = ? WHERE id = ?`, [contact, existing[0].id]);
    return existing[0].id;
  }
  const [result] = await connection.query(`INSERT INTO clients (nom, contact) VALUES (?, ?)`, [nom, contact || null]);
  return result.insertId;
}

async function trouverEnginParModele(connection, { modele }) {
  const [existing] = await connection.query(`SELECT id FROM engins WHERE modele = ? LIMIT 1`, [modele]);
  if (existing.length === 0) {
    const err = new Error(`Modèle "${modele}" introuvable dans le catalogue. Contactez un administrateur.`);
    err.status = 400;
    throw err;
  }
  return existing[0].id;
}

async function resoudreEnginsPhysiques(connection, { modele, numSeries = [] }) {
  const enginId = await trouverEnginParModele(connection, { modele });
  const physiqueIds = [];
  for (const numSerie of numSeries) {
    if (!numSerie) continue;
    physiqueIds.push(await trouverOuCreerEnginPhysique(connection, enginId, numSerie));
  }
  return { enginId, physiqueIds };
}

async function trouverOuCreerEnginPhysique(connection, enginId, numSerie) {
  const [existing] = await connection.query(
    `SELECT id FROM engins_physiques WHERE engin_id = ? AND numero_serie = ? LIMIT 1`,
    [enginId, numSerie]
  );
  if (existing.length > 0) return existing[0].id;

  const [result] = await connection.query(
    `INSERT INTO engins_physiques (engin_id, numero_serie) VALUES (?, ?)`,
    [enginId, numSerie]
  );
  return result.insertId;
}

async function lierEnginsADemande(connection, demandeId, physiqueIds) {
  for (const engPhysiqueId of physiqueIds) {
    await connection.query(
      `INSERT INTO demande_engins_serie (demande_id, engin_physique_id) VALUES (?, ?)`,
      [demandeId, engPhysiqueId]
    );
  }
}

async function enregistrerOptions(connection, demandeId, options = [], freeOptions = []) {
  for (const { optionId, sousOptionId } of options) {
    let temps;
    if (sousOptionId) {
      const [r] = await connection.query(`SELECT temps_main_oeuvre_h FROM sous_options WHERE id = ?`, [sousOptionId]);
      if (r.length === 0) continue;
      temps = r[0].temps_main_oeuvre_h;
    } else {
      const [r] = await connection.query(`SELECT temps_main_oeuvre_h FROM options WHERE id = ?`, [optionId]);
      if (r.length === 0) continue;
      temps = r[0].temps_main_oeuvre_h;
    }
    await connection.query(
      `INSERT INTO demande_options (demande_id, option_id, sous_option_id, temps_main_oeuvre_h)
       VALUES (?, ?, ?, ?)`,
      [demandeId, optionId, sousOptionId || null, temps]
    );
  }

  for (const nomLibre of freeOptions) {
    if (!nomLibre || !nomLibre.trim()) continue;

    const [optResult] = await connection.query(
      `INSERT INTO options (nom_option, temps_main_oeuvre_h) VALUES (?, 0)`,
      [nomLibre.trim()]
    );
    await connection.query(
      `INSERT INTO demande_options (demande_id, option_id, nom_option_libre, temps_main_oeuvre_h)
       VALUES (?, ?, ?, 0)`,
      [demandeId, optResult.insertId, nomLibre.trim()]
    );
  }
}

async function list(req, res) {
  const { statut, mine, page = 1, limit = 5 } = req.query;
  const conditions = [];
  const params = [];

  if (mine === 'true') {
    conditions.push('d.cree_par = ?');
    params.push(req.user.id);
  } else {
    conditions.push("d.statut != 'brouillon'");
  }
  if (statut) { conditions.push('d.statut = ?'); params.push(statut); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM demandes d ${where}`, params
  );

  const offset = (Number(page) - 1) * Number(limit);
  const [rows] = await pool.query(
    `SELECT d.reference, d.type_intervention, d.priorite, d.statut, d.date_livraison, e.nom AS engin_nom
     FROM demandes d
     JOIN engins e ON e.id = d.engin_id
     ${where}
     ORDER BY d.date_creation DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), offset]
  );

  res.json({ demandes: rows, total, page: Number(page), limit: Number(limit) });
}

async function getDetail(req, res) {
  const { reference } = req.params;

  const [demandeRows] = await pool.query(
    `SELECT d.id, d.reference, d.type_intervention, d.nombre_engins, d.priorite, d.statut, d.cree_par,
            d.mat, d.piping, d.date_livraison, d.lieu_livraison, d.mode_livraison, d.remarque,
            d.date_fin_prevue,
            e.id AS engin_id, e.nom AS engin_nom, e.marque, e.modele,
            c.nom AS client_nom, c.contact AS client_contact
     FROM demandes d
     JOIN engins e ON e.id = d.engin_id
     JOIN clients c ON c.id = d.client_id
     WHERE d.reference = ?`,
    [reference]
  );

  if (demandeRows.length === 0) return res.status(404).json({ error: 'Demande introuvable.' });
  const demande = demandeRows[0];

  const [optionRows] = await pool.query(
    `SELECT do.id AS demande_option_id, do.option_id, do.sous_option_id,
            do.temps_main_oeuvre_h, do.statut, do.date_planifiee, do.heure_debut, do.technicien_id,
            o.nom_option, so.nom_sous_option
     FROM demande_options do
     JOIN options o ON o.id = do.option_id
     LEFT JOIN sous_options so ON so.id = do.sous_option_id
     WHERE do.demande_id = ?`,
    [demande.id]
  );

  const [seriesRows] = await pool.query(
    `SELECT ep.numero_serie
     FROM demande_engins_serie des
     JOIN engins_physiques ep ON ep.id = des.engin_physique_id
     WHERE des.demande_id = ?`,
    [demande.id]
  );

  const estTechnique = ROLES_TECHNIQUE.includes(req.user.role);

  let piecesParOption = {};
  if (estTechnique && optionRows.length > 0) {
    const [pieceRows] = await pool.query(
      `SELECT eop.option_id, eop.sous_option_id, p.nom, eop.quantite
       FROM engin_option_piece eop
       JOIN pieces p ON p.id = eop.piece_id
       WHERE eop.engin_id = ?`,
      [demande.engin_id]
    );
    for (const p of pieceRows) {
      const key = `${p.option_id}_${p.sous_option_id || 'null'}`;
      (piecesParOption[key] ||= []).push(p.quantite > 1 ? `${p.nom} x${p.quantite}` : p.nom);
    }
  }

  const options = optionRows.map(o => {
    const label = o.nom_sous_option || o.nom_option_libre || o.nom_option;
    const base = {
      demandeOptionId: o.demande_option_id,
      optionId: o.option_id,
      sousOptionId: o.sous_option_id,
      libre: !!o.nom_option_libre,
      label,
      quantite: o.quantite,
    };
    if (!estTechnique) return base;
    const key = `${o.option_id}_${o.sous_option_id || 'null'}`;
    return {
      ...base,
      duration: o.temps_main_oeuvre_h,
      pieces: piecesParOption[key] || [],
      statut: o.statut,
      datePlanifiee: o.date_planifiee,
      heureDebut: o.heure_debut,
      dureeH: o.temps_main_oeuvre_h,
    };
  });

  res.json({
    reference: demande.reference,
    typeIntervention: demande.type_intervention,
    nombreEngins: demande.nombre_engins,
    marque: demande.marque,
    modele: demande.modele,
    mat: demande.mat,
    piping: demande.piping,
    numSeries: seriesRows.map(r => r.numero_serie),
    priorite: demande.priorite,
    statut: demande.statut,
    dateFinPrevue: demande.date_fin_prevue,
    client: demande.client_nom,
    contact: demande.client_contact,
    lieu: demande.lieu_livraison,
    dateLivraison: demande.date_livraison,
    modeLivraison: demande.mode_livraison,
    remarque: demande.remarque,
    creePar: demande.cree_par,
    options,
  });
}

async function create(req, res) {
  const {
    marque, modele, mat, piping, numSeries = [], clientNom, clientContact,
    typeIntervention, nombreEngins,
    priorite, envoyerMaintenant, dateLivraison, lieuLivraison, modeLivraison, remarque,
    options = [], freeOptions = [],
  } = req.body;

  if (!modele || !clientNom || !typeIntervention) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const reference = await genererReference(connection);
    const clientId = await trouverOuCreerClient(connection, clientNom, clientContact);
    const statutInitial = envoyerMaintenant ? 'envoyee' : 'brouillon';

const { enginId, physiqueIds } = await resoudreEnginsPhysiques(connection, { modele, numSeries });

const [result] = await connection.query(
  `INSERT INTO demandes
     (reference, client_id, engin_id, cree_par, type_intervention, nombre_engins,
      mat, piping, priorite, statut, date_livraison, lieu_livraison, mode_livraison, remarque)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [reference, clientId, enginId, req.user.id, typeIntervention, nombreEngins || physiqueIds.length || 1,
   mat || null, piping || null,
   priorite || 'normale', statutInitial, dateLivraison || null, lieuLivraison || null, modeLivraison || null, remarque || null]
);
    const demandeId = result.insertId;

    await lierEnginsADemande(connection, demandeId, physiqueIds);
    await enregistrerOptions(connection, demandeId, options, freeOptions);

    if (statutInitial === 'envoyee') {
      for (const role of ROLES_ENCADREMENT_TECHNIQUE) {
        await notifyRole(connection, role, {
  titre: 'Nouvelle demande reçue',
  message: `La demande ${reference} vient d'être envoyée par le service commercial.`,
  expediteurId: req.user.id,
  reference,
  type: 'reception',
});  }
    }
    await logAction(connection, req.user.id, 'Demande créée', `${reference} (${statutInitial})`);

    await connection.commit();
    res.status(201).json({ id: demandeId, reference, statut: statutInitial });
  } catch (err) {
  await connection.rollback();
  if (err.status === 400) return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur.' });
} finally {
    connection.release();
  }
}

async function update(req, res) {
  const { reference } = req.params;
  const {
    marque, modele, mat, piping, numSeries = [], clientNom, clientContact,
    typeIntervention, nombreEngins,
    priorite, envoyerMaintenant, dateLivraison, lieuLivraison, modeLivraison,  remarque,
    options = [], freeOptions = [],
  } = req.body;

  if (!modele || !clientNom || !typeIntervention) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(`SELECT id, cree_par, statut FROM demandes WHERE reference = ?`, [reference]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Demande introuvable.' });
    }
    const demande = rows[0];

    if (demande.statut !== 'brouillon') {
      await connection.rollback();
      return res.status(409).json({ error: 'Seule une demande en brouillon peut être modifiée.' });
    }
    if (demande.cree_par !== req.user.id) {
      await connection.rollback();
      return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres demandes.' });
    }

    const clientId = await trouverOuCreerClient(connection, clientNom, clientContact);
    const statutFinal = envoyerMaintenant ? 'envoyee' : 'brouillon';
    const { enginId, physiqueIds } = await resoudreEnginsPhysiques(connection, { marque, modele, numSeries });

    await connection.query(
      `UPDATE demandes SET client_id = ?, engin_id = ?, type_intervention = ?, nombre_engins = ?,
              mat = ?, piping = ?, priorite = ?, statut = ?, date_livraison = ?, lieu_livraison = ?,
              mode_livraison = ?,  remarque = ?
       WHERE id = ?`,
      [clientId, enginId, typeIntervention, nombreEngins || physiqueIds.length || 1,
       mat || null, piping || null,
       priorite || 'normale', statutFinal,
       dateLivraison || null, lieuLivraison || null, modeLivraison || null,  remarque || null,
       demande.id]
    );

    await connection.query(`DELETE FROM demande_engins_serie WHERE demande_id = ?`, [demande.id]);
    await lierEnginsADemande(connection, demande.id, physiqueIds);

    await connection.query(`DELETE FROM demande_options WHERE demande_id = ?`, [demande.id]);
    await enregistrerOptions(connection, demande.id, options, freeOptions);

    if (statutFinal === 'envoyee') {
      for (const role of ROLES_ENCADREMENT_TECHNIQUE) {
        await notifyRole(connection, role, {
  titre: 'Nouvelle demande reçue',
  message: `La demande ${reference} vient d'être envoyée par le service commercial.`,
  expediteurId: req.user.id,
  reference,
  type: 'reception',
}); }
    }
    await logAction(connection, req.user.id, 'Demande modifiée', `${reference} (${statutFinal})`);

    await connection.commit();
    res.json({ reference, statut: statutFinal });
  } catch (err) {
  await connection.rollback();
  if (err.status === 400) return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur.' });
} finally {
    connection.release();
  }
}

async function envoyer(req, res) {
  const { reference } = req.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(`SELECT id, cree_par, statut FROM demandes WHERE reference = ?`, [reference]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Demande introuvable.' });
    }
    if (rows[0].statut !== 'brouillon') {
      await connection.rollback();
      return res.status(409).json({ error: 'Cette demande a déjà été envoyée.' });
    }
    if (rows[0].cree_par !== req.user.id) {
      await connection.rollback();
      return res.status(403).json({ error: 'Vous ne pouvez envoyer que vos propres demandes.' });
    }

    await connection.query(`UPDATE demandes SET statut = 'envoyee' WHERE id = ?`, [rows[0].id]);
    for (const role of ROLES_ENCADREMENT_TECHNIQUE) {
      await notifyRole(connection, role, {
  titre: 'Nouvelle demande reçue',
  message: `La demande ${reference} vient d'être envoyée par le service commercial.`,
  expediteurId: req.user.id,
  reference,
  type: 'reception',
});}
    await logAction(connection, req.user.id, 'Demande envoyée', reference);

    await connection.commit();
    res.json({ reference, statut: 'envoyee' });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  } finally {
    connection.release();
  }
}

async function supprimer(req, res) {
  const { reference } = req.params;
  const [rows] = await pool.query(`SELECT id, cree_par, statut FROM demandes WHERE reference = ?`, [reference]);
  if (rows.length === 0) return res.status(404).json({ error: 'Demande introuvable.' });
  if (rows[0].statut !== 'brouillon') return res.status(409).json({ error: 'Seule une demande en brouillon peut être supprimée.' });
  if (rows[0].cree_par !== req.user.id) return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres demandes.' });

  await pool.query(`DELETE FROM demandes WHERE id = ?`, [rows[0].id]);
  res.json({ ok: true });
}
module.exports = { list, getDetail, create, update, envoyer,supprimer };
