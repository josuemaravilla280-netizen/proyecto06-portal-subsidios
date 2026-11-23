const express = require('express');
const { permitir } = require('../middleware/auth');
// get/setData.mjs es ESM: se carga con import() dinámico.
const getDB = () => import('../data/getData.mjs');
const setDB = () => import('../data/setData.mjs');
const router = express.Router();
const operador = permitir('admin', 'operador');
const crypto = require('crypto');
const path = require('node:path');
const fs = require('fs/promises');

const usuarioDe = (req) => req.usuario ?? req.user ?? req.session?.usuario ?? null;

// solo el staff ve los beneficiarios, un beneficiario puede solo verse a si mismo
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
    const t = String(txt || '').trim().toUpperCase().replace(/-/g, '');
    return { documento: t, isDui: /^\d{9}$/.test(t) };
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
    const { listarBeneficiarios } = await getDB();
    res.json({ ok: true, datos: await listarBeneficiarios() });
}));

// Perfil
router.get('/:id', ...conAcceso, idValido, a(async (req, res) => {
    const { obtenerBeneficiario } = await getDB();
    const dato = await obtenerBeneficiario(req.params.id);
    if (!dato) return noEncontrado(res);
    res.json({ ok: true, dato });
}));

// Programas en que está registrado
router.get('/:id/programas', ...conAcceso, idValido, a(async (req, res) => {
    const { obtenerBeneficiario, programasDeBeneficiario } = await getDB();
    if (!(await obtenerBeneficiario(req.params.id))) return noEncontrado(res);
    res.json({ ok: true, datos: await programasDeBeneficiario(req.params.id) });
}));

// Registrar en otro programa (solo personal; la solicitud del beneficiario aún no está implementada)
router.post('/:id/programas', operador, idValido, a(async (req, res) => {
    const programaId = Number(req.body.programa_id);
    if (!Number.isInteger(programaId) || programaId < 1)
        return res.status(400).json({ ok: false, mensaje: 'Programa no válido.' });
    const { crearInscripcion } = await setDB();
    try {
        const r = await crearInscripcion(req.params.id, programaId, { estado: 'aprovada' }); // registro directo del personal
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
    const { retirarInscripcion } = await setDB();
    const r = await retirarInscripcion(req.params.id, programaId, quien);
    if (r.noEncontrado) return res.status(404).json({ ok: false, mensaje: 'Inscripción no encontrada.' });
    if (r.yaEstaba) return res.status(409).json({ ok: false, mensaje: 'La inscripción ya fue retirada.' });
    res.json({ ok: true, mensaje: 'Inscripción retirada.' });
}));

// Inactivar cuenta: no borra al beneficiario, cambia el estado de su cuenta a 'inactivada'.
router.delete('/:id', operador, idValido, a(async (req, res) => {
    const { inactivarCuenta } = await setDB();
    const r = await inactivarCuenta(req.params.id);
    if (r.noEncontrado) return noEncontrado(res);
    if (r.yaEstaba) return res.status(409).json({ ok: false, mensaje: 'La cuenta ya está inactivada.' });
    res.json({ ok: true, mensaje: 'Cuenta inactivada.' });
}));
router.patch('/:id/reactivar', operador, idValido, a(async (req, res) => {
    const { reactivarCuenta } = await setDB();
    const r = await reactivarCuenta(req.params.id);
    if (r.estadoFaltante) return res.status(500).json({ ok: false, mensaje: `Falta el estado "${r.estadoFaltante}" en el catálogo.` });
    if (r.noEncontrado) return noEncontrado(res);
    if (r.yaEstaba) return res.status(409).json({ ok: false, mensaje: 'La cuenta ya está activa.' });
    res.json({ ok: true, mensaje: 'Cuenta reactivada.' });
}));

// Documentos subidos
router.get('/:id/documentos', ...conAcceso, idValido, a(async (req, res) => {
    const { beneficiarioDocuments } = await getDB();
    const datos = await beneficiarioDocuments(req.params.id);
    if (!datos) return noEncontrado(res);
    res.json({ ok: true, datos: beneficiarioDocumentList(datos) });
}));

// Registrar beneficiario
router.post('/', operador, a(async (req, res) => {
    const d = limpiar(req.body);
    const error = validar(d, true);
    if (error) return res.status(400).json({ ok: false, mensaje: error });
    const { crearBeneficiario } = await setDB();
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
    const { actualizarBeneficiario } = await setDB();
    const r = await actualizarBeneficiario(req.params.id, d);
    if (r.noEncontrado) return noEncontrado(res);
    if (r.departamentoInvalido) return res.status(400).json({ ok: false, mensaje: 'Departamento no válido.' });
    if (r.municipioInvalido) return res.status(400).json({ ok: false, mensaje: 'El municipio no pertenece al departamento seleccionado.' });
    if (r.documentoDistinto) return res.status(400).json({ ok: false, mensaje: 'El DUI o pasaporte no se puede modificar.' });
    res.json({ ok: true, dato: { id: r.id }, mensaje: 'Información actualizada.' });
}));

// En cuentas_beneficiarios_ed.datos.documentos: { "acta de nacimiento": "enlace/al/archivo" }.
const TIPOS_ARCHIVO = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf' };
const MIME_POR_EXTENSION = { png: 'image/png', jpg: 'image/jpeg', pdf: 'application/pdf' };
const CARPETA_DOCS = path.join(process.cwd(), 'uploads', 'documentos');
const decodificar = (v) => { try { return decodeURIComponent(String(v ?? '')); } catch { return ''; } };
const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// { "nombre documento": "/ruta/nombre_documento.png" } -> [{ tipo, url, nombre_archivo }]
const beneficiarioDocumentList = (documentos) =>
    Object.entries(documentos).map(([clave, url]) => ({
        tipo: capitalizar(clave),
        url,
        nombre_archivo: String(url).split('/').filter(Boolean).pop() || '',
    }));

// El cuerpo es el archivo; el tipo de documento y el nombre van en cabeceras.
// El archivo se guarda como uploads/documentos/<cuenta>/<tipo-en-minusculas>.<ext>.
router.post('/:id/documentos', ...conAcceso, idValido,
    express.raw({ type: Object.keys(TIPOS_ARCHIVO), limit: '8mb' }),
    a(async (req, res) => {
        const mime = String(req.headers['content-type'] || '').split(';')[0].trim();
        const tipo = decodificar(req.headers['x-tipo-documento']).trim();
        if (!TIPOS_ARCHIVO[mime] || !Buffer.isBuffer(req.body) || !req.body.length)
            return res.status(400).json({ ok: false, mensaje: 'Suba una imagen PNG o JPG, o un PDF (máximo 8 MB).' });

        const { normalizarTexto } = await getDB();
        const { agregarDocumentoCuenta } = await setDB();
        const nombreBase = normalizarTexto(tipo).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
        if (!tipo || tipo.length > 100 || !nombreBase) return res.status(400).json({ ok: false, mensaje: 'Falta el tipo de documento.' });

        // req.params.id ya se validó como UUID: es seguro usarlo como nombre de carpeta.
        const archivo = `${nombreBase}.${TIPOS_ARCHIVO[mime]}`;
        const absoluta = path.join(CARPETA_DOCS, req.params.id, archivo);
        await fs.mkdir(path.dirname(absoluta), { recursive: true });
        try {
            await fs.writeFile(absoluta, req.body, { flag: 'wx' }); // no sobrescribe un archivo existente
        } catch (e) {
            if (e.code === 'EEXIST') return res.status(409).json({ ok: false, mensaje: 'Ya existe un documento de ese tipo.' });
            throw e;
        }

        const enlace = `/api/beneficiarios/${req.params.id}/documentos/${archivo}`;
        const r = await agregarDocumentoCuenta(req.params.id, tipo, enlace);
        if (r.noEncontrado || r.duplicado) {
            await fs.unlink(absoluta).catch(() => { });
            return r.noEncontrado
                ? noEncontrado(res)
                : res.status(409).json({ ok: false, mensaje: 'Ya existe un documento de ese tipo.' });
        }
        res.status(201).json({
            ok: true,
            dato: { tipo: capitalizar(r.clave), url: enlace, nombre_archivo: archivo },
            mensaje: 'Documento subido.',
        });
    }));

// Ver un documento subido por el sistema (solo personal o el propio beneficiario).
router.get('/:id/documentos/:archivo', ...conAcceso, idValido, (req, res) => {
    const extension = (req.params.archivo.match(/^[a-z0-9-]+\.(png|jpg|pdf)$/) || [])[1];
    if (!extension) return res.status(404).json({ ok: false, mensaje: 'Documento no encontrado.' });
    res.set('X-Content-Type-Options', 'nosniff');
    res.type(MIME_POR_EXTENSION[extension]).sendFile(
        path.join(CARPETA_DOCS, req.params.id, req.params.archivo),
        (err) => { if (err && !res.headersSent) res.status(404).json({ ok: false, mensaje: 'Documento no encontrado.' }); }
    );
});

/* ---------- Solicitud de inscripción ---------- */
// Devuelve el primer error de las respuestas respecto a los requisitos del programa, o null.
function errorSolicitud(requisitos, respuestas, tiposSubidos, normalizar) {
    for (const r of requisitos) {
        if (r.tipo === 'cuenta') continue; // se toma de la cuenta
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

router.post('/:id/programas/:programaId/solicitud', ...conAcceso, idValido, a(async (req, res) => {
    const programaId = Number(req.params.programaId);
    if (!Number.isInteger(programaId) || programaId < 1) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });

    const { obtenerPrograma, beneficiarioDocuments, normalizarTexto } = await getDB();
    const { crearInscripcion } = await setDB();
    const programa = await obtenerPrograma(programaId);
    if (!programa) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
    const documentos = await beneficiarioDocuments(req.params.id);
    if (!documentos) return noEncontrado(res);

    const respuestas = req.body?.respuestas && typeof req.body.respuestas === 'object' ? req.body.respuestas : {};
    const error = errorSolicitud(programa.requisitos || [], respuestas, Object.keys(documentos), normalizarTexto);
    if (error) return res.status(400).json({ ok: false, mensaje: error });

    // Solo se guardan las respuestas a requisitos del programa.
    const guardadas = {};
    for (const r of programa.requisitos || []) {
        if (['cuenta', 'archivo'].includes(r.tipo)) continue;
        const v = String(respuestas[r.nombre] ?? '').trim();
        if (v) guardadas[r.nombre] = v;
    }

    try {
        const resultado = await crearInscripcion(req.params.id, programaId, {
            requisitos: { respuestas: guardadas, datos_cuenta: datosCuenta },
        });
        // Columna inscripciones_ed.requisitos: lo que rellenó y la lista de datos de su cuenta que se le pidieron.
        const datosCuenta = (programa.requisitos || []).filter((r) => r.tipo === 'cuenta').map((r) => r.campo);
        if (resultado.programaNoExiste) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
        if (resultado.programaCancelado) return res.status(409).json({ ok: false, mensaje: 'El programa está cancelado.' });
        if (!resultado.creada) return res.status(409).json({ ok: false, mensaje: 'Ya está registrado en ese programa.' });
        res.status(201).json({ ok: true, mensaje: 'Solicitud de inscripción enviada.' });
    } catch (e) {
        if (e.code === '23503') return noEncontrado(res);
        throw e;
    }
}));

module.exports = router;