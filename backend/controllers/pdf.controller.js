const { generateDemandePdf } = require('../services/pdf.service');

async function exportDemandePdf(req, res) {
  const demande = req.body;
  if (!demande || !demande.reference) {
    return res.status(400).json({ error: 'Données de demande manquantes (reference requise).' });
  }

  try {
    const pdfBuffer = await generateDemandePdf(demande);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${demande.reference}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Erreur génération PDF :', err);
    res.status(500).json({ error: 'Échec de la génération du PDF.' });
  }
}

module.exports = { exportDemandePdf };
