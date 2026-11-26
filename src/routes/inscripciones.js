const express = require('express');
const { permitir } = require('../middleware/auth');
// get/setData.mjs es ESM: se carga con import() dinámico.
const getDB = () => import('../data/getData.mjs');
const setDB = () => import('../data/setData.mjs');
const router = express.Router();
const operador = permitir('admin', 'operador');

const usuarioDe = (req) => req.usuario ?? req.user ?? req.session?.usuario ?? null;

const conAcceso = [
    permitir('admin', 'operador', 'beneficiario'),
    (req, res, next) => {
        const u = usuarioDe(req);
        if (u && ['admin', 'operador'].includes(u.rol)) return next();
        if (u && u.rol === 'beneficiario' && String(u.id) === req.params.id) return next();
        res.status(403).json({ ok: false, mensaje: 'No tiene permiso para ver inscripciones de este beneficiario.' });
    },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idValido = (req, res, next) => UUID.test(req.params.id) ? next() : res.status(404).json({ ok: false, mensaje: 'Beneficiario no encontrado.' });
const idProgramaValido = (id) => (!Number.isInteger(id) || id <= 0);

const a = (fn) => (req, res) =>
    fn(req, res).catch((e) => {
        if (e.code === '23505') return res.status(409).json({ ok: false, mensaje: 'Ya existe un registro con ese correo, teléfono o documento.' });
        if (e.code === '23503') return res.status(400).json({ ok: false, mensaje: 'Alguno de los valores seleccionados no es válido.' });
        if (e.code === '22007' || e.code === '22008' || e.code === '22P02') return res.status(400).json({ ok: false, mensaje: 'Alguno de los datos tiene un formato no válido.' });
        console.error(e);
        res.status(500).json({ ok: false, mensaje: 'Error del servidor.' });
    });

const noEncontrado = (res) => res.status(404).json({ ok: false, mensaje: 'Beneficiario no encontrado.' });

// Lista (nombres para la página de listado)
router.get('/', operador, a(async (_req, res) => {
    const { listarInscripciones } = await getDB();
    res.json({ ok: true, datos: await listarInscripciones() });
}));

// Programas en que un beneficiario está registrado
router.get('/:id', ...conAcceso, idValido, a(async (req, res) => {
    const beneficiarioId = req.params.id;
    const { obtenerBeneficiario, programasDeBeneficiario } = await getDB();
    if (!(await obtenerBeneficiario(beneficiarioId))) return noEncontrado(res);
    res.json({ ok: true, datos: await programasDeBeneficiario(beneficiarioId) });
}));

router.post('/:id/:programaId', ...conAcceso, idValido, a(async (req, res) => {
    const programaId = Number(req.params.programaId);
    const beneficiarioId = req.params.id;
    if (!Number.isInteger(programaId) || programaId < 1)
        return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });

    const esPersonal = ['admin', 'operador'].includes(usuarioDe(req)?.rol);
    const { obtenerPrograma, beneficiarioDocuments, normalizarTexto } = await getDB();
    const { crearInscripcion } = await setDB();

    // Personal: registro directo (aprovada). Beneficiario: solicitud (enespera) con requisitos.
    if (esPersonal) {
        try {
            const r = await crearInscripcion(beneficiarioId, programaId, { estado: 'aprovada' });
            if (r.programaNoExiste) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
            if (r.programaCancelado) return res.status(409).json({ ok: false, mensaje: 'El programa está cancelado.' });
            if (!r.creada) return res.status(409).json({ ok: false, mensaje: 'Ya está registrado en ese programa.' });
            return res.status(201).json({ ok: true, mensaje: 'Beneficiario registrado en el programa.' });
        } catch (e) {
            if (e.code === '23503') return res.status(404).json({ ok: false, mensaje: 'Beneficiario no encontrado.' });
            throw e;
        }
    }

    const programa = await obtenerPrograma(programaId);
    if (!programa) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
    const documentos = await beneficiarioDocuments(beneficiarioId);
    if (!documentos) return noEncontrado(res);

    const respuestas = req.body?.respuestas && typeof req.body.respuestas === 'object' ? req.body.respuestas : {};
    const error = errorSolicitud(programa.requisitos || [], respuestas, Object.keys(documentos), normalizarTexto);
    if (error) return res.status(400).json({ ok: false, mensaje: error });

    const guardadas = {};
    for (const r of programa.requisitos || []) {
        if (['cuenta', 'archivo'].includes(r.tipo)) continue;
        const v = String(respuestas[r.nombre] ?? '').trim();
        if (v) guardadas[r.nombre] = v;
    }
    const datosCuenta = (programa.requisitos || []).filter((r) => r.tipo === 'cuenta').map((r) => r.campo);

    try {
        const resultado = await crearInscripcion(beneficiarioId, programaId, {
            requisitos: { respuestas: guardadas, datos_cuenta: datosCuenta },
        });
        if (resultado.programaNoExiste) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
        if (resultado.programaCancelado) return res.status(409).json({ ok: false, mensaje: 'El programa está cancelado.' });
        if (!resultado.creada) return res.status(409).json({ ok: false, mensaje: 'Ya está registrado en ese programa.' });
        return res.status(201).json({ ok: true, mensaje: 'Solicitud de inscripción enviada.' });
    } catch (e) {
        if (e.code === '23503') return noEncontrado(res);
        throw e;
    }
}));

// Aprobar o denegar una solicitud en espera. El motivo se guarda en datos.decision.
const APROBADA = 3, DENEGADA = 2;
const DECISIONES = [DENEGADA, APROBADA];
router.put('/:id/:programaId', operador, idValido, a(async (req, res) => {
    const programaId = Number(req.params.programaId);
    const beneficiarioId = req.params.id;
    if (!Number.isInteger(programaId) || programaId < 1)
        return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
 
    const estado = Number(req.body?.estado);
    if (!DECISIONES.includes(estado))
        return res.status(400).json({ ok: false, mensaje: 'Estado no válido.' });
 
    const motivo = String(req.body?.motivo ?? '').trim();
    if (motivo.length > 500)
        return res.status(400).json({ ok: false, mensaje: 'El motivo es demasiado largo.' });
 
    const { resolverInscripcion } = await setDB();
    const r = await resolverInscripcion(beneficiarioId, programaId, estado, motivo || null);
    if (r.noEncontrado) return res.status(404).json({ ok: false, mensaje: 'Inscripción no encontrada.' });
    if (r.yaResuelta) return res.status(409).json({ ok: false, mensaje: 'La inscripción ya no está en espera.' });
    res.json({ ok: true, mensaje: estado === APROBADA ? 'Inscripción aprobada.' : 'Inscripción denegada.' });
}));

// Retirar de un programa: no borra la inscripción, cambia su estado.
// 'retirarB' si lo hace el propio beneficiario, 'retirarS' si lo hace el personal.
router.delete('/:id/:programaId', ...conAcceso, idValido, a(async (req, res) => {
    const programaId = Number(req.params.programaId);
    const beneficiarioId = req.params.id;
    if (!Number.isInteger(programaId)) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
    const quien = usuarioDe(req)?.rol === 'beneficiario' ? 'retirarB' : 'retirarS';
    const { retirarInscripcion } = await setDB();
    const r = await retirarInscripcion(beneficiarioId, programaId, quien);
    if (r.noEncontrado) return res.status(404).json({ ok: false, mensaje: 'Inscripción no encontrada.' });
    if (r.yaEstaba) return res.status(409).json({ ok: false, mensaje: 'La inscripción ya fue retirada.' });
    res.json({ ok: true, mensaje: 'Inscripción retirada.' });
}));

function errorSolicitud(requisitos, respuestas, tiposSubidos, normalizar) {
    for (const r of requisitos) {
        if (r.tipo === 'cuenta') continue;
        if (r.tipo === 'archivo') {
            const subido = tiposSubidos.some((t) => normalizar(t) === normalizar(r.nombre));
            if (r.obligatorio && !subido) return `Falta subir el documento: ${r.nombre}.`;
            continue;
        }
        const v = String(respuestas[r.nombre] ?? '').trim();
        if (!v) { if (r.obligatorio) return `Falta completar: ${r.nombre}.`; continue; }
        if (v.length > 500) return `La respuesta de "${r.nombre}" es demasiado larga.`;
        if (r.tipo === 'numero' && !Number.isFinite(Number(v))) return `"${r.nombre}" debe ser un número.`;
        if (r.tipo === 'fecha' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return `"${r.nombre}" debe ser una fecha válida.`;
        if (r.tipo === 'booleano' && !['Sí', 'No'].includes(v)) return `"${r.nombre}" debe ser Sí o No.`;
        if (r.tipo === 'seleccion' && !(r.opciones || []).includes(v)) return `"${r.nombre}" tiene una opción no válida.`;
    }
    return null;
}

module.exports = router;