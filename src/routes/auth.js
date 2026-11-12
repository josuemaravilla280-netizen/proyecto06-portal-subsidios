import express from 'express';
import bcrypt from 'bcrypt';
import { searchByDoc } from '../data/getData.mjs';
const router = express.Router();



router.post('/login', async (req, res, next) => {
  try {
        const documento_unico = String(req.body.documento_unico || '').trim().toUpperCase();
        const password = String(req.body.password || '');
        if (!documento_unico || !password) return res.status(400).json({ ok: false, mensaje: 'Escriba su DUI o pasaporte y contraseña.' });
        const HASH_FALSO = '$2b$12$40PS1h9MHvLyTWtSi.Owe.rcz01W69UcIrffZAqvcM/mGMfSNBnui';
        const cuentas = await searchByDoc(documento_unico);
        let usuario = null;
        for (const cuenta of cuentas) {
        if (cuenta.passwordHash && await bcrypt.compare(password, cuenta ? cuenta.passwordHash : HASH_FALSO)) {
            usuario = cuenta;
            break;
        }
        }
        if (!usuario) return res.status(401).json({ ok: false, mensaje: 'Credenciales incorrectas.' });

        req.session.regenerate(err => {
            if (err) return next(err);
            req.session.usuario = { id: usuario.id, nombre: usuario.nombre, documento_unico: usuario.documento_unico, rol: usuario.rol };
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

export default router;