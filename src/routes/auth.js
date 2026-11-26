import express from 'express';
import bcrypt from 'bcrypt';
import { searchByDoc, personaNombre, beneficiarioEstado, staffEstado, staffRol, rolNombre } from '../data/getData.mjs';
import { ESTADOS } from '../data/estados.mjs';
const router = express.Router();

// Hash de una contraseña que no existe: se compara igual cuando no hay cuenta,
// para que la respuesta tarde lo mismo exista o no la cuenta.
const HASH_FALSO = '$2b$12$40PS1h9MHvLyTWtSi.Owe.rcz01W69UcIrffZAqvcM/mGMfSNBnui';

router.post('/login', async (req, res, next) => {
    try {
        const documento_unico = String(req.body.documento_unico || '').trim().toUpperCase().replace(/-/g, '');
        const password = String(req.body.password || '');
        if (!documento_unico || !password) return res.status(400).json({ ok: false, mensaje: 'Escriba su DUI o pasaporte y contraseña.' });
        const cuentas = await searchByDoc(documento_unico);
        let cuenta = null;
        for (const c of cuentas) {
            if (c.passwordHash && await bcrypt.compare(password, c.passwordHash)) {
                cuenta = c;
                break;
            }
        }
        if (!cuentas.some((c) => c.passwordHash)) await bcrypt.compare(password, HASH_FALSO);
        if (!cuenta) return res.status(401).json({ ok: false, mensaje: 'Credenciales incorrectas.' });

        // si está en cuentas_staff_ed es staff (rol de roles_ec); si no, es beneficiario.
        const rolId = await staffRol(cuenta.id);
        const isStaff = rolId !== null;
        const rol = isStaff ? await rolNombre(rolId) : 'beneficiario';
        const estado = isStaff ? await staffEstado(cuenta.id) : await beneficiarioEstado(cuenta.id);

        if (estado === ESTADOS.cuenta.inactivada) return res.status(403).json({ ok: false, mensaje: 'Esta cuenta fue desactivada.' });
        if (estado === ESTADOS.cuenta.eliminada) return res.status(403).json({ ok: false, mensaje: 'Esta cuenta fue eliminada.' });

        // Se calcula antes: dentro del callback de regenerate no se puede usar await.
        const usuario = { id: cuenta.id, nombre: await personaNombre(documento_unico), documento_unico, rol };

        // Cuando se implementen los jwt, se organizara diferente.
        req.session.regenerate(err => {
            if (err) return next(err);
            req.session.usuario = usuario;
            res.json({ ok: true, usuario, mensaje: 'Sesión iniciada correctamente.' });
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