const { buildDemandeHtml } = require('../templates/demande.pdf.template');

async function exportDemandePdf(req, res) {
  const demande = req.body;
  if (!demande || !demande.reference) {
    return res.status(400).json({ error: 'Données de demande manquantes (reference requise).' });
  }

  const html = buildDemandeHtml(demande).replace(
    '</body>',
    '<script>window.addEventListener("load", () => setTimeout(() => window.print(), 300));</script></body>'
  );
  res.type('html').send(html);
}

module.exports = { exportDemandePdf };