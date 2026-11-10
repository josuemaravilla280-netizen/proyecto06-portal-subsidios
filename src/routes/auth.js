import express from 'express';
import bcrypt from 'bcrypt';
import { searchByDoc } from '../data/getData.mjs';
const router = express.Router();



router.post('/login', async (req, res, next) => {
  try {
        const identificador = String(req.body.identificador || '').trim().toUpperCase();
        const password = String(req.body.password || '');
        if (!identificador || !password) return res.status(400).json({ ok: false, mensaje: 'Escriba su DUI o pasaporte y contraseña.' });
        const HASH_FALSO = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO5kqzOZ5kqzOZ5kqzOZ5kqzOZ5kqzOZ6';
        const cuentas = await searchByDoc(identificador);
        let usuario = null;
        for (const cuenta of cuentas) {
        if (cuenta.passwordHash && await bcrypt.compare(password, cuenta.passwordHash)) {
            usuario = cuenta;
            break;
        }
        }
        if (!usuario) return res.status(401).json({ ok: false, mensaje: 'Credenciales incorrectas.' });

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

export default router;