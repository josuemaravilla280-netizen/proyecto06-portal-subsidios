const express = require('express');
const { permitir } = require('../middleware/auth');
const router = express.Router();
const operador = permitir('admin', 'operador');

// getData.mjs es ESM: se carga con import() dinámico.
const db = () => import('../data/getData.mjs');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idValido = (req, res, next) =>
  UUID.test(req.params.id) ? next() : res.status(404).json({ ok: false, mensaje: 'Beneficiario no encontrado.' });

// Captura errores async; 23503 = referencia inexistente, 22xxx = dato mal formado.
const a = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
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
router.get('/:id', operador, idValido, a(async (req, res) => {
  const { obtenerBeneficiario } = await db();
  const dato = await obtenerBeneficiario(req.params.id);
  if (!dato) return noEncontrado(res);
  res.json({ ok: true, dato });
}));

// Programas en que está registrado
router.get('/:id/programas', operador, idValido, a(async (req, res) => {
  const { obtenerBeneficiario, programasDeBeneficiario } = await db();
  if (!(await obtenerBeneficiario(req.params.id))) return noEncontrado(res);
  res.json({ ok: true, datos: await programasDeBeneficiario(req.params.id) });
}));

// Registrar en otro programa
router.post('/:id/programas', operador, idValido, a(async (req, res) => {
  const programaId = Number(req.body.programa_id);
  if (!Number.isInteger(programaId) || programaId < 1)
    return res.status(400).json({ ok: false, mensaje: 'Programa no válido.' });
  const { crearInscripcion } = await db();
  try {
    const creada = await crearInscripcion(req.params.id, programaId);
    if (!creada) return res.status(409).json({ ok: false, mensaje: 'Ya está registrado en ese programa.' });
    res.status(201).json({ ok: true, mensaje: 'Beneficiario registrado en el programa.' });
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ ok: false, mensaje: 'Beneficiario o programa no encontrado.' });
    throw e;
  }
}));

// Sacar de un programa
router.delete('/:id/programas/:programaId', operador, idValido, a(async (req, res) => {
  const programaId = Number(req.params.programaId);
  if (!Number.isInteger(programaId)) return res.status(404).json({ ok: false, mensaje: 'Programa no encontrado.' });
  const { eliminarInscripcion } = await db();
  if (!(await eliminarInscripcion(req.params.id, programaId)))
    return res.status(404).json({ ok: false, mensaje: 'Inscripción no encontrada.' });
  res.json({ ok: true, mensaje: 'Beneficiario retirado del programa.' });
}));

// Documentos subidos
router.get('/:id/documentos', operador, idValido, a(async (req, res) => {
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
  if (r.duplicado) return res.status(409).json({ ok: false, mensaje: 'Ya existe un beneficiario con ese DUI o pasaporte.' });
  res.status(201).json({ ok: true, dato: { id: r.id }, mensaje: 'Beneficiario registrado.' });
}));

// Actualizar beneficiario
router.put('/:id', operador, idValido, a(async (req, res) => {
  const d = limpiar(req.body);
  const error = validar(d, false);
  if (error) return res.status(400).json({ ok: false, mensaje: error });
  const { actualizarBeneficiario } = await db();
  const r = await actualizarBeneficiario(req.params.id, d);
  if (r.noEncontrado) return noEncontrado(res);
  if (r.departamentoInvalido) return res.status(400).json({ ok: false, mensaje: 'Departamento no válido.' });
  if (r.documentoDistinto) return res.status(400).json({ ok: false, mensaje: 'El DUI o pasaporte no se puede modificar.' });
  res.json({ ok: true, dato: { id: r.id }, mensaje: 'Información actualizada.' });
}));

module.exports = router;