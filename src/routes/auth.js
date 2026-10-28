const express = require('express');
const { beneficiarios, nuevoIdBeneficiario } = require('../data/memoria');
const { permitir } = require('../middleware/auth');
const router = express.Router();
const operador = permitir('administrador', 'operador');
function limpiar(body) {
  return {
    nombre: String(body.nombre || '').trim(),
    apellido: String(body.apellido || '').trim(),
    identificador: String(body.identificador || '').trim(),
    telefono: String(body.telefono || '').trim(),
    correo: String(body.correo || '').trim(),
    direccion: String(body.direccion || '').trim(),
    municipio: String(body.municipio || '').trim(),
    departamento: String(body.departamento || '').trim()
  };
}
function validar(d) {
  if (!d.nombre || !d.apellido || !d.identificador || !d.telefono || !d.direccion || !d.municipio || !d.departamento) return 'Complete todos los campos obligatorios.';
  if (d.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo)) return 'El correo electrónico no tiene un formato válido.';
  return null;
}
router.get('/', operador, (req, res) => res.json({ ok: true, datos: beneficiarios }));
router.post('/', operador, (req, res) => {
  const datos = limpiar(req.body); const error = validar(datos);
  if (error) return res.status(400).json({ ok: false, mensaje: error });
  if (beneficiarios.some(b => b.identificador.toLowerCase() === datos.identificador.toLowerCase())) return res.status(409).json({ ok: false, mensaje: 'Ya existe un beneficiario con ese DUI o pasaporte.' });
  const nuevo = { id: nuevoIdBeneficiario(), ...datos, creadoEn: new Date().toISOString() };
  beneficiarios.push(nuevo); res.status(201).json({ ok: true, dato: nuevo, mensaje: 'Beneficiario registrado.' });
});
router.put('/:id', operador, (req, res) => {
  const id = Number(req.params.id); const actual = beneficiarios.find(b => b.id === id);
  if (!actual) return res.status(404).json({ ok: false, mensaje: 'Beneficiario no encontrado.' });
  const datos = limpiar(req.body); const error = validar(datos);
  if (error) return res.status(400).json({ ok: false, mensaje: error });
  if (beneficiarios.some(b => b.id !== id && b.identificador.toLowerCase() === datos.identificador.toLowerCase())) return res.status(409).json({ ok: false, mensaje: 'Ese documento ya pertenece a otro beneficiario.' });
  Object.assign(actual, datos, { actualizadoEn: new Date().toISOString() });
  res.json({ ok: true, dato: actual, mensaje: 'Información actualizada.' });
});
module.exports = router;