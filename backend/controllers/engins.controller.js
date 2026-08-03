const pool = require('../config/db');

async function list(req, res) {
  const [rows] = await pool.query(`SELECT * FROM engins ORDER BY nom`);
  res.json(rows);
}

async function getOne(req, res) {
  const [rows] = await pool.query(`SELECT * FROM engins WHERE id = ?`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Engin introuvable.' });
  res.json(rows[0]);
}

function buildFilter(column, query, extraFilters = []) {
  const clauses = [`${column} IS NOT NULL`, `${column} != ''`];
  const params = [];
  extraFilters.forEach(f => {
    if (query[f]) { clauses.push(`${f === 'numSerie' ? 'num_serie' : f} = ?`); params.push(query[f]); }
  });
  return { where: clauses.join(' AND '), params };
}

async function marques(req, res) {
  const { where, params } = buildFilter('marque', req.query, []);
  const [rows] = await pool.query(`SELECT DISTINCT marque FROM engins WHERE ${where} ORDER BY marque`, params);
  res.json(rows.map(r => r.marque));
}

async function modeles(req, res) {
  const { where, params } = buildFilter('modele', req.query, ['marque']);
  const [rows] = await pool.query(`SELECT DISTINCT modele FROM engins WHERE ${where} ORDER BY modele`, params);
  res.json(rows.map(r => r.modele));
}

async function mats(req, res) {
  const { where, params } = buildFilter('mat', req.query, ['marque', 'modele']);
  const [rows] = await pool.query(`SELECT DISTINCT mat FROM engins WHERE ${where} ORDER BY mat`, params);
  res.json(rows.map(r => r.mat));
}

async function pipings(req, res) {
  const { where, params } = buildFilter('piping', req.query, ['marque', 'modele', 'mat']);
  const [rows] = await pool.query(`SELECT DISTINCT piping FROM engins WHERE ${where} ORDER BY piping`, params);
  res.json(rows.map(r => r.piping));
}

async function series(req, res) {
  const { where, params } = buildFilter('num_serie', req.query, ['marque', 'modele', 'mat', 'piping']);
  const [rows] = await pool.query(`SELECT DISTINCT num_serie FROM engins WHERE ${where} ORDER BY num_serie`, params);
  res.json(rows.map(r => r.num_serie));
}

async function resoudre(req, res) {
  const { numSerie } = req.query;
  if (!numSerie) return res.json({ id: null });
  const [rows] = await pool.query(`SELECT id FROM engins WHERE num_serie = ? LIMIT 1`, [numSerie]);
  res.json({ id: rows.length ? rows[0].id : null });
}

async function create(req, res) {
  const { nom, marque, modele, mat, piping, capacite, vitesse, hauteurLevage, imageUrl } = req.body;
  if (!nom) return res.status(400).json({ error: "Nom de l'engin requis." });

  const [result] = await pool.query(
    `INSERT INTO engins (nom, marque, modele, mat, piping, capacite, vitesse, hauteur_levage, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nom, marque, modele, mat, piping, capacite, vitesse, hauteurLevage, imageUrl]
  );
  res.status(201).json({ id: result.insertId, nom });
}

async function trouverOuCreerOption(connection, nom, temps) {
  const [existing] = await connection.query(`SELECT id FROM options WHERE nom_option = ? LIMIT 1`, [nom]);
  if (existing.length > 0) return existing[0].id;
  const [result] = await connection.query(
    `INSERT INTO options (nom_option, temps_main_oeuvre_h) VALUES (?, ?)`, [nom, temps || 0]
  );
  return result.insertId;
}

async function trouverOuCreerSousOption(connection, optionId, nom, temps) {
  const [existing] = await connection.query(
    `SELECT id FROM sous_options WHERE option_id = ? AND nom_sous_option = ? LIMIT 1`, [optionId, nom]
  );
  if (existing.length > 0) return existing[0].id;
  const [result] = await connection.query(
    `INSERT INTO sous_options (option_id, nom_sous_option, temps_main_oeuvre_h) VALUES (?, ?, ?)`,
    [optionId, nom, temps || 0]
  );
  return result.insertId;
}

async function trouverOuCreerPiece(connection, nom) {
  const [existing] = await connection.query(`SELECT id FROM pieces WHERE nom = ? LIMIT 1`, [nom]);
  if (existing.length > 0) return existing[0].id;
  const [result] = await connection.query(`INSERT INTO pieces (nom) VALUES (?)`, [nom]);
  return result.insertId;
}

async function marqueParModele(req, res) {
  const { modele } = req.params;
  const [rows] = await pool.query(`SELECT marque FROM engins WHERE modele = ? LIMIT 1`, [modele]);
  res.json({ marque: rows.length ? rows[0].marque : null });
}

async function create(req, res) {
  const { nom, marque, modele, capacite, vitesse, mat,  piping,hauteurLevage, imageUrl, options = [] } = req.body;
  if (!nom) return res.status(400).json({ error: "Nom de l'engin requis." });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
  `INSERT INTO engins (nom, marque, modele, mat, piping, capacite, vitesse, hauteur_levage, image_url)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [nom, marque || null, modele || null, mat || null, piping || null, capacite || null, vitesse || null, hauteurLevage || null, imageUrl || null]
);
    const enginId = result.insertId;

    for (const opt of options) {
      if (!opt.nom || !opt.nom.trim()) continue;
      const optionId = await trouverOuCreerOption(connection, opt.nom.trim(), opt.duration);
      await connection.query(`INSERT IGNORE INTO engins_option (engin_id, option_id) VALUES (?, ?)`, [enginId, optionId]);

      for (const piece of opt.pieces || []) {
        const pieceId = await trouverOuCreerPiece(connection, piece.trim());
        await connection.query(
          `INSERT INTO engin_option_piece (engin_id, option_id, sous_option_id, piece_id, quantite) VALUES (?, ?, NULL, ?, 1)`,
          [enginId, optionId, pieceId]
        );
      }

      for (const sousOpt of opt.sousOptions || []) {
        if (!sousOpt.nom || !sousOpt.nom.trim()) continue;
        const sousOptionId = await trouverOuCreerSousOption(connection, optionId, sousOpt.nom.trim(), sousOpt.duration);
        for (const piece of sousOpt.pieces || []) {
          const pieceId = await trouverOuCreerPiece(connection, piece.trim());
          await connection.query(
            `INSERT INTO engin_option_piece (engin_id, option_id, sous_option_id, piece_id, quantite) VALUES (?, ?, ?, ?, 1)`,
            [enginId, optionId, sousOptionId, pieceId]
          );
        }
      }
    }

    await connection.commit();
    res.status(201).json({ id: enginId, nom });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  } finally {
    connection.release();
  }
}

async function optionsExistantes(req, res) {
  const [rows] = await pool.query(`SELECT DISTINCT nom_option FROM options ORDER BY nom_option`);
  res.json(rows.map(r => r.nom_option));
}
async function sousOptionsExistantes(req, res) {
  const { nomOption } = req.query;
  if (!nomOption) return res.json([]);
  const [rows] = await pool.query(
    `SELECT DISTINCT so.nom_sous_option FROM sous_options so JOIN options o ON o.id = so.option_id WHERE o.nom_option = ? ORDER BY so.nom_sous_option`,
    [nomOption]
  );
  res.json(rows.map(r => r.nom_sous_option));
}
async function piecesExistantes(req, res) {
  const [rows] = await pool.query(`SELECT nom FROM pieces ORDER BY nom`);
  res.json(rows.map(r => r.nom));
}

async function catalogue(req, res) {
  const [engins] = await pool.query(`SELECT * FROM engins ORDER BY nom`);
  if (engins.length === 0) return res.json([]);
  const enginIds = engins.map(e => e.id);

  const [optionRows] = await pool.query(
    `SELECT eo.engin_id, o.id, o.nom_option, o.temps_main_oeuvre_h
     FROM engins_option eo JOIN options o ON o.id = eo.option_id
     WHERE eo.engin_id IN (?)`, [enginIds]
  );
  const optionIds = optionRows.map(o => o.id);

  const [sousRows] = optionIds.length
    ? await pool.query(`SELECT * FROM sous_options WHERE option_id IN (?)`, [optionIds])
    : [[]];

  const [pieceRows] = await pool.query(
    `SELECT eop.engin_id, eop.option_id, eop.sous_option_id, p.nom, eop.quantite
     FROM engin_option_piece eop JOIN pieces p ON p.id = eop.piece_id
     WHERE eop.engin_id IN (?)`, [enginIds]
  );
  const formatPiece = p => (p.quantite > 1 ? `${p.nom} x${p.quantite}` : p.nom);

  res.json(engins.map(e => ({
    id: e.id,
    nom: e.nom,
    marque:e.marque,
    modele: e.modele,
    imageUrl: e.image_url,
    capacite: e.capacite,
    hauteurLevage: e.hauteur_levage,
    options: optionRows.filter(o => o.engin_id === e.id).map(o => {
      const sousOptions = sousRows
        .filter(s => s.option_id === o.id)
        .map(s => ({
          nom: s.nom_sous_option,
          duration: s.temps_main_oeuvre_h,
          pieces: pieceRows
            .filter(p => p.engin_id === e.id && p.option_id === o.id && p.sous_option_id === s.id)
            .map(formatPiece),
        }));
      return {
        id: o.id,
        nom: o.nom_option,
        duration: o.temps_main_oeuvre_h,
        sousOptions,

        pieces: sousOptions.length === 0
          ? pieceRows.filter(p => p.engin_id === e.id && p.option_id === o.id && !p.sous_option_id).map(formatPiece)
          : [],
      };
    }),
  })));
}

module.exports = {
  list, getOne, marques, modeles, mats, pipings, series,
  create, catalogue, optionsExistantes, sousOptionsExistantes, piecesExistantes,marqueParModele
};
