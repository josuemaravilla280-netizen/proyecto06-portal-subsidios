const express = require('express');
const { permitir } = require('../middleware/auth');
// get/setData.mjs es ESM: se carga con import() dinámico.
const getDB = () => import('../data/getData.mjs'); 
const setDB = () => import('../data/setData.mjs');
const router = express.Router();
const admin = permitir('admin');
// Este const comentado era antes para que se admitieran GET de cualquier cuenta,
// pero por ahora solo estaban en donde no quiero que se requiera cuenta
// const lectura = permitir('admin', 'operador', 'beneficiario');

// Captura errores async; 23503 = referencia inexistente, 22xxx = dato mal formado.
const a = (fn) => (req, res) =>
    fn(req, res).catch((e) => {
        if (e.code === '23503') return res.status(400).json({ ok: false, mensaje: 'Alguno de los valores seleccionados no es válido.' });
        if (e.code === '22007' || e.code === '22008' || e.code === '22P02') return res.status(400).json({ ok: false, mensaje: 'Alguno de los datos tiene un formato no válido.' });
        console.error(e);
        res.status(500).json({ ok: false, mensaje: 'Error del servidor.' });
    });


const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const TIPOS_REQUISITO = ['texto', 'numero', 'fecha', 'seleccion', 'booleano', 'archivo', 'cuenta'];
const CAMPOS_CUENTA = ['identificacion', 'nacimiento', 'telefono', 'correo', 'departamento', 'municipio', 'direccion'];

// Requisitos de inscripción: se guardan en programas_ed.requisitos.
function limpiarRequisitos(lista) {
    if (!Array.isArray(lista)) return [];
    return lista.slice(0, 30).map((r) => {
        const tipo = String(r?.tipo ?? '');
        const requisito = {
            nombre: String(r?.nombre ?? '').trim().slice(0, 120),
            tipo,
            obligatorio: r?.obligatorio !== false,
        };
        if (tipo === 'seleccion') {
            requisito.opciones = Array.isArray(r.opciones)
                ? r.opciones.map((o) => String(o).trim().slice(0, 100)).filter(Boolean).slice(0, 30)
                : [];
        }
        if (tipo === 'cuenta') requisito.campo = String(r.campo ?? '');
        return requisito;
    });
}

function errorRequisitos(requisitos) {
    for (const r of requisitos) {
        if (!TIPOS_REQUISITO.includes(r.tipo)) return 'Un requisito tiene un tipo no válido.';
        if (!r.nombre) return 'Todos los requisitos deben tener nombre.';
        if (r.tipo === 'seleccion' && r.opciones.length < 2) return `El requisito "${r.nombre}" necesita al menos dos opciones.`;
        if (r.tipo === 'cuenta' && !CAMPOS_CUENTA.includes(r.campo)) return 'Un requisito toma un dato de la cuenta no válido.';
    }
    const nombres = requisitos.map((r) => r.nombre.toLowerCase());
    if (new Set(nombres).size !== nombres.length) return 'Hay requisitos con el mismo nombre.';
    return null;
}

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
        requisitos: limpiarRequisitos(body.requisitos),
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
    return errorRequisitos(d.requisitos);
}

const idValido = (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
    req.programaId = id;
    next();
};

// Lista (nombres para la página de listado)
// no necesita autenticacion.
router.get('/', a(async (_req, res) => {
    const { listarProgramas } = await getDB();
    res.json({ ok: true, datos: await listarProgramas() });
}));

// Información del programa
router.get('/:id', idValido, a(async (req, res) => {
    const { obtenerPrograma } = await getDB();
    const dato = await obtenerPrograma(req.programaId);
    if (!dato) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
    res.json({ ok: true, dato });
}));

// Datos de los gráficos de pastel
router.get('/:id/estadisticas', idValido, a(async (req, res) => {
    const { estadisticasPrograma } = await getDB();
    const dato = await estadisticasPrograma(req.programaId);
    if (!dato) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
    res.json({ ok: true, dato });
}));

// Crear programa
router.post('/', admin, a(async (req, res) => {
    const d = limpiar(req.body);
    const error = validar(d);
    if (error) return res.status(400).json({ ok: false, mensaje: error });
    const { crearPrograma } = await setDB();
    const r = await crearPrograma(d);
    if (r.claveDuplicada) return res.status(409).json({ ok: false, mensaje: 'La clave correlativa ya existe.' });
    res.status(201).json({ ok: true, dato: { id: r.id }, mensaje: 'Programa creado correctamente.' });
}));

// Actualizar programa
router.put('/:id', admin, idValido, a(async (req, res) => {
    const d = limpiar(req.body);
    const error = validar(d);
    if (error) return res.status(400).json({ ok: false, mensaje: error });
    const { actualizarPrograma } = await setDB();
    const r = await actualizarPrograma(req.programaId, d);
    if (r.noEncontrado) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
    if (r.claveDuplicada) return res.status(409).json({ ok: false, mensaje: 'La clave correlativa ya existe.' });
    res.json({
        ok: true,
        dato: { id: r.id },
        mensaje: 'Programa actualizado.'
    });
}));

router.delete('/:id', admin, idValido, a(async (req, res) => {
    const { cancelarPrograma } = await setDB();
    const r = await cancelarPrograma(req.programaId);
    if (r.noEncontrado) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
    if (r.yaEstaba) return res.status(409).json({ ok: false, mensaje: 'El programa ya está cancelado.' });
    res.json({ ok: true, mensaje: 'Programa cancelado.' });
}));
router.patch('/:id/reactivar', admin, idValido, a(async (req, res) => {
    const { reactivarPrograma } = await setDB();
    const r = await reactivarPrograma(req.programaId);
    if (r.noEncontrado) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
    if (r.yaEstaba) return res.status(409).json({ ok: false, mensaje: 'El programa ya está activo.' });
    res.json({ ok: true, mensaje: 'Programa reactivado.' });
}));

module.exports = router;