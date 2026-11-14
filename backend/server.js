const app = require('./app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Forges de Bazas — backend en écoute sur http://localhost:${PORT}`);
});


const { verifierRetards } = require('./controllers/demandeOptions.controller');

setInterval(verifierRetards, 24 * 60 * 60 * 1000);

verifierRetards();
