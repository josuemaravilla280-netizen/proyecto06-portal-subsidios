const express = require('express');
const { permitir } = require('../middleware/auth');
// getData.mjs es ESM: se carga con import() dinámico.
const db = () => import('../data/getData.mjs');
const router = express.Router();
const operador = permitir('admin', 'operador');

const usuarioDe = (req) => req.usuario ?? req.user ?? req.session?.usuario ?? null;

const conAcceso = [
    permitir('admin', 'operador', 'beneficiario'),
    (req, res, next) => {
        const u = usuarioDe(req);
        if (u && ['admin', 'operador'].includes(u.rol)) return next();
        if (u && u.rol === 'beneficiario' && String(u.id) === req.params.id) return next();
        res.status(403).json({ ok: false, mensaje: 'No tiene permiso para este beneficiario.' });
    },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idValido = (req, res, next) =>
    UUID.test(req.params.id) ? next() : res.status(404).json({ ok: false, mensaje: 'Beneficiario no encontrado.' });

// Captura errores async; 23503 = referencia inexistente, 22xxx = dato mal formado.
const a = (fn) => (req, res) =>
    fn(req, res).catch((e) => {
        if (e.code === '23505') return res.status(409).json({ ok: false, mensaje: 'Ya existe un registro con ese correo, teléfono o documento.' });
        if (e.code === '23503') return res.status(400).json({ ok: false, mensaje: 'Alguno de los valores seleccionados no es válido.' });
        if (e.code === '22007' || e.code === '22008' || e.code === '22P02') return res.status(400).json({ ok: false, mensaje: 'Alguno de los datos tiene un formato no válido.' });
        console.error(e);
        res.status(500).json({ ok: false, mensaje: 'Error del servidor.' });
    });


// "01234567-8" => DUI; cualquier otro valor => pasaporte. Se guarda sin guion.
function documentoDe(txt) {
    const t = String(txt || '').trim().toUpperCase();
    return { documento: t.replace(/-/g, ''), isDui: /^\d{8}-?\d$/.test(t) };
}

function limpiar(b) {
    const t = (v) => String(v ?? '').trim();
    return {
        ...documentoDe(b.documento_unico ?? b.documento),
        nombre: t(b.nombre),
        apellido: t(b.apellido),
        nacimiento: t(b.nacimiento),
        telefono: t(b.telefono),
        email: t(b.correo ?? b.email),
        departamento: t(b.departamento), // nombre, como en departamentos_ec
        municipio: t(b.municipio),
        direccion: t(b.direccion),
    };
}

function validar(d, nacimientoObligatorio) {
    if (!d.nombre || !d.apellido || !d.documento || !d.telefono || !d.municipio || !d.departamento || !d.direccion)
        return 'Complete todos los campos obligatorios.';
    if (!/^\d+$/.test(d.municipio)) return 'El municipio no es válido.';
    if (d.direccion.length > 250) return 'La dirección no puede superar los 250 caracteres.';
    if (!/^[A-Z0-9]{1,9}$/.test(d.documento)) return 'El DUI o pasaporte no tiene un formato válido.';
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return 'El correo electrónico no tiene un formato válido.';
    if (nacimientoObligatorio && !d.nacimiento) return 'Falta la fecha de nacimiento.';
    if (d.nacimiento && (!/^\d{4}-\d{2}-\d{2}$/.test(d.nacimiento) || d.nacimiento > new Date().toISOString().slice(0, 10)))
        return 'La fecha de nacimiento no es válida.';
    return null;
}

const noEncontrado = (res) => res.status(404).json({ ok: false, mensaje: 'Beneficiario no encontrado.' });

// Lista (nombres para la página de listado)
router.get('/', operador, a(async (_req, res) => {
    const { listarBeneficiarios } = await db();
    res.json({ ok: true, datos: await listarBeneficiarios() });
}));

// Perfil
router.get('/:id', ...conAcceso, idValido, a(async (req, res) => {
    const { obtenerBeneficiario } = await db();
    const dato = await obtenerBeneficiario(req.params.id);
    if (!dato) return noEncontrado(res);
    res.json({ ok: true, dato });
}));

// Programas en que está registrado
router.get('/:id/programas', ...conAcceso, idValido, a(async (req, res) => {
    const { obtenerBeneficiario, programasDeBeneficiario } = await db();
    if (!(await obtenerBeneficiario(req.params.id))) return noEncontrado(res);
    res.json({ ok: true, datos: await programasDeBeneficiario(req.params.id) });
}));

// Registrar en otro programa (solo personal; la solicitud del beneficiario aún no está implementada)
router.post('/:id/programas', operador, idValido, a(async (req, res) => {
    const programaId = Number(req.body.programa_id);
    if (!Number.isInteger(programaId) || programaId < 1)
        return res.status(400).json({ ok: false, mensaje: 'Programa no válido.' });
    const { crearInscripcion } = await db();
    try {
        const r = await crearInscripcion(req.params.id, programaId);
        if (r.programaNoExiste) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
        if (r.programaCancelado) return res.status(409).json({ ok: false, mensaje: 'El programa está cancelado.' });
        if (!r.creada) return res.status(409).json({ ok: false, mensaje: 'Ya está registrado en ese programa.' });
        res.status(201).json({ ok: true, mensaje: 'Beneficiario registrado en el programa.' });
    } catch (e) {
        if (e.code === '23503') return res.status(404).json({ ok: false, mensaje: 'Beneficiario no encontrado.' });
        throw e;
    }
}));

// Retirar de un programa: no borra la inscripción, cambia su estado.
// 'retirarB' si lo hace el propio beneficiario, 'retirarS' si lo hace el personal.
router.delete('/:id/programas/:programaId', ...conAcceso, idValido, a(async (req, res) => {
    const programaId = Number(req.params.programaId);
    if (!Number.isInteger(programaId)) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
    const quien = usuarioDe(req)?.rol === 'beneficiario' ? 'retirarB' : 'retirarS';
    const { retirarInscripcion } = await db();
    const r = await retirarInscripcion(req.params.id, programaId, quien);
    if (r.estadoFaltante) return res.status(500).json({ ok: false, mensaje: `Falta el estado "${r.estadoFaltante}" en el catálogo.` });
    if (r.noEncontrado) return res.status(404).json({ ok: false, mensaje: 'Inscripción no encontrada.' });
    if (r.yaEstaba) return res.status(409).json({ ok: false, mensaje: 'La inscripción ya fue retirada.' });
    res.json({ ok: true, mensaje: 'Inscripción retirada.' });
}));

// Inactivar cuenta: no borra al beneficiario, cambia el estado de su cuenta a 'inactivada'.
router.delete('/:id', operador, idValido, a(async (req, res) => {
    const { inactivarCuenta } = await db();
    const r = await inactivarCuenta(req.params.id);
    if (r.estadoFaltante) return res.status(500).json({ ok: false, mensaje: `Falta el estado "${r.estadoFaltante}" en el catálogo.` });
    if (r.noEncontrado) return noEncontrado(res);
    if (r.yaEstaba) return res.status(409).json({ ok: false, mensaje: 'La cuenta ya está inactivada.' });
    res.json({ ok: true, mensaje: 'Cuenta inactivada.' });
}));

// Documentos subidos
router.get('/:id/documentos', ...conAcceso, idValido, a(async (req, res) => {
    const { documentosDeBeneficiario } = await db();
    const datos = await documentosDeBeneficiario(req.params.id);
    if (!datos) return noEncontrado(res);
    res.json({ ok: true, datos });
}));

// Registrar beneficiario
router.post('/', operador, a(async (req, res) => {
    const d = limpiar(req.body);
    const error = validar(d, true);
    if (error) return res.status(400).json({ ok: false, mensaje: error });
    const { crearBeneficiario } = await db();
    const r = await crearBeneficiario(d);
    if (r.departamentoInvalido) return res.status(400).json({ ok: false, mensaje: 'Departamento no válido.' });
    if (r.municipioInvalido) return res.status(400).json({ ok: false, mensaje: 'El municipio no pertenece al departamento seleccionado.' });
    if (r.duplicado) return res.status(409).json({ ok: false, mensaje: 'Ya existe un beneficiario con ese DUI o pasaporte.' });
    res.status(201).json({ ok: true, dato: { id: r.id }, mensaje: 'Beneficiario registrado.' });
}));

// Actualizar beneficiario
router.put('/:id', ...conAcceso, idValido, a(async (req, res) => {
    const d = limpiar(req.body);
    const error = validar(d, false);
    if (error) return res.status(400).json({ ok: false, mensaje: error });
    const { actualizarBeneficiario } = await db();
    const r = await actualizarBeneficiario(req.params.id, d);
    if (r.noEncontrado) return noEncontrado(res);
    if (r.departamentoInvalido) return res.status(400).json({ ok: false, mensaje: 'Departamento no válido.' });
    if (r.municipioInvalido) return res.status(400).json({ ok: false, mensaje: 'El municipio no pertenece al departamento seleccionado.' });
    if (r.documentoDistinto) return res.status(400).json({ ok: false, mensaje: 'El DUI o pasaporte no se puede modificar.' });
    res.json({ ok: true, dato: { id: r.id }, mensaje: 'Información actualizada.' });
}));

module.exports = router;