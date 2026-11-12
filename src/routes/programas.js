const express = require('express');
const { permitir } = require('../middleware/auth');
const router = express.Router();
const admin = permitir('admin');

// getData.mjs es ESM: se carga con import() dinámico.
const db = () => import('../data/getData.mjs');

// Captura errores async; 23503 = referencia inexistente, 22xxx = dato mal formado.
const a = (fn) => (req, res) =>
    fn(req, res).catch((e) => {
        if (e.code === '23503') return res.status(400).json({ ok: false, mensaje: 'Alguno de los valores seleccionados no es válido.' });
        if (e.code === '22007' || e.code === '22008' || e.code === '22P02') return res.status(400).json({ ok: false, mensaje: 'Alguno de los datos tiene un formato no válido.' });
        console.error(e);
        res.status(500).json({ ok: false, mensaje: 'Error del servidor.' });
    });


const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function limpiar(body) {
    const t = (v) => String(v ?? '').trim();
    const n = (v) => (v === '' || v == null ? NaN : Number(v));
    return {
        nombre: t(body.nombre),
        entidad: n(body.entidad),                // id de empresas_ed
        tipo: n(body.tipo),                      // id de tipos_beneficios_ec
        estado: n(body.estado),                  // id de estados_programa_ec
        periodicidad: n(body.periodicidad),      // id de perioricidad_ec
        descripcion: t(body.descripcion),
        cantidad: n(body.cantidad),
        unidad: t(body.unidad),
        cupos: n(body.cupos),
        monto: body.monto === '' || body.monto == null ? 0 : Number(body.monto),
        clave: t(body.claveCorrelativa),
        composicion: t(body.composicion),
        periodo: t(body.periodo),                // Período de asignación
        documentos: t(body.documentos),          // documentos_registro_requiere
        criterios: Array.isArray(body.criterios) ? body.criterios.map(String) : [],
        fechaInicio: t(body.fechaInicio),
        fechaCierre: t(body.fechaCierre),
        zonas: Array.isArray(body.zonas) ? [...new Set(body.zonas.map(Number))] : [], // ids de departamentos_ec
    };
}

function validar(d) {
    const textos = ['nombre',
        'descripcion',
        'unidad',
        'composicion',
        'periodo',
        'documentos',
        'fechaInicio',
        'fechaCierre'];
    if (textos.some((c) => !d[c]) || [d.entidad, d.tipo, d.estado, d.periodicidad].some((v) => !Number.isInteger(v)) || !d.zonas.length)
        return 'Complete todos los campos obligatorios.';
    if (d.zonas.some((z) => !Number.isInteger(z) || z < 1)) return 'Las zonas habilitadas no son válidas.';
    if (
        !Number.isInteger(d.cantidad) ||
        d.cantidad < 1 ||
        !Number.isInteger(d.cupos) ||
        d.cupos < 1
    ) {
        return 'Cantidad y cupos deben ser números enteros mayores que cero.';
    }
    if (!Number.isFinite(d.monto) || d.monto < 0) {
        return 'El monto debe ser cero o un número positivo.';
    }
    if (!FECHA.test(d.fechaInicio) || !FECHA.test(d.fechaCierre)) {
        return 'Las fechas no son válidas.';
    }
    if (d.fechaCierre < d.fechaInicio) {
        return 'La fecha de cierre no puede ser anterior a la fecha de inicio.';
    }

    return null;
}

const idValido = (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
    req.programaId = id;
    next();
};

// Lista (nombres para la página de listado)
router.get('/', admin, a(async (_req, res) => {
    const { listarProgramas } = await db();
    res.json({ ok: true, datos: await listarProgramas() });
}));

// Información del programa
router.get('/:id', admin, idValido, a(async (req, res) => {
    const { obtenerPrograma } = await db();
    const dato = await obtenerPrograma(req.programaId);
    if (!dato) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
    res.json({ ok: true, dato });
}));

// Datos de los gráficos de pastel
router.get('/:id/estadisticas', admin, idValido, a(async (req, res) => {
    const { estadisticasPrograma } = await db();
    const dato = await estadisticasPrograma(req.programaId);
    if (!dato) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
    res.json({ ok: true, dato });
}));

// Crear programa
router.post('/', admin, a(async (req, res) => {
    const d = limpiar(req.body);
    const error = validar(d);
    if (error) return res.status(400).json({ ok: false, mensaje: error });
    const { crearPrograma } = await db();
    const r = await crearPrograma(d);
    if (r.claveDuplicada) return res.status(409).json({ ok: false, mensaje: 'La clave correlativa ya existe.' });
    res.status(201).json({ ok: true, dato: { id: r.id }, mensaje: 'Programa creado correctamente.' });
}));

// Actualizar programa
router.put('/:id', admin, idValido, a(async (req, res) => {
    const d = limpiar(req.body);
    const error = validar(d);
    if (error) return res.status(400).json({ ok: false, mensaje: error });
    const { actualizarPrograma } = await db();
    const r = await actualizarPrograma(req.programaId, d);
    if (r.noEncontrado) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
    if (r.claveDuplicada) return res.status(409).json({ ok: false, mensaje: 'La clave correlativa ya existe.' });
    res.json({
        ok: true,
        dato: { id: r.id },
        mensaje: 'Programa actualizado.'
    });
}));

// Eliminar programa
router.delete('/:id', admin, idValido, a(async (req, res) => {
    const { eliminarPrograma } = await db();
    const r = await eliminarPrograma(req.programaId);
    if (r.noEncontrado) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
    if (r.conInscritos) return res.status(409).json({ ok: false, mensaje: 'El programa tiene beneficiarios inscritos.' });
    res.json({
         ok: true,
         mensaje: 'Programa eliminado.'
        });
}));

module.exports = router;