const express = require('express');
const router = express.Router();
 
// Siendo una onda transparente, esto como la lista de empresas que se registran no debe requerir autentificacion.
router.get('/', async (_req, res) => {
  try {
    const { obtenerCatalogos } = await import('../data/getData.mjs');
    res.json({ ok: true, dato: await obtenerCatalogos() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, mensaje: 'Error del servidor.' });
  }
});
 
module.exports = router;
