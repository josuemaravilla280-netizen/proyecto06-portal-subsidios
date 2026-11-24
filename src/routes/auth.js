const express = require('express');
const bcrypt = require('bcrypt');
const { usuarios } = require('../data/memoria');
const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const identificador = String(req.body.identificador || '').trim();
    const password = String(req.body.password || '');
    if (!identificador || !password) return res.status(400).json({ ok: false, mensaje: 'Escriba su DUI o pasaporte y contraseña.' });
    const usuario = usuarios.find(u => u.identificador === identificador);
    if (!usuario || !(await bcrypt.compare(password, usuario.passwordHash))) return res.status(401).json({ ok: false, mensaje: 'Credenciales incorrectas.' });
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.usuario = { id: usuario.id, nombre: usuario.nombre, identificador: usuario.identificador, rol: usuario.rol };
      res.json({ ok: true, usuario: req.session.usuario, mensaje: 'Sesión iniciada correctamente.' });
    });
  } catch (error) { next(error); }
});
router.get('/me', (req, res) => {
  if (!req.session.usuario) return res.status(401).json({ ok: false, mensaje: 'No hay una sesión activa.' });
  res.json({ ok: true, usuario: req.session.usuario });
});
router.post('/logout', (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('sid', { httpOnly: true, sameSite: 'lax' });
    res.json({ ok: true, mensaje: 'Sesión cerrada.' });
  });
});
module.exports = router;
