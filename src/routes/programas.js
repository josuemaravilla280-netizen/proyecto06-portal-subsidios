const express = require('express');
const { programas, nuevoIdPrograma } = require('../data/memoria');
const { permitir } = require('../middleware/auth');

const router = express.Router();

// Permite el acceso únicamente al administrador.
const admin = permitir('administrador');

// Campos de texto que se reciben del formulario.
const camposTexto = [
  'nombre',
  'entidad',
  'tipo',
  'estado',
  'descripcion',
  'unidad',
  'claveCorrelativa',
  'composicion',
  'periodo',
  'periodicidad',
  'zonas',
  'documentos'
];

// Limpia y convierte los datos recibidos del formulario.
function limpiar(body) {
  const d = {};

  for (const campo of camposTexto) {
    d[campo] = String(body[campo] || '').trim();
  }

  // Convierte los valores numéricos.
  d.cantidad = Number(body.cantidad);
  d.cupos = Number(body.cupos);

  d.monto =
    body.monto === '' || body.monto == null
      ? 0
      : Number(body.monto);

  // Limpia las fechas.
  d.fechaInicio = String(body.fechaInicio || '').trim();
  d.fechaCierre = String(body.fechaCierre || '').trim();

  // Comprueba que los criterios sean una lista.
  d.criterios = Array.isArray(body.criterios)
    ? body.criterios.map(String)
    : [];

  return d;
}

// Comprueba que los datos del programa sean válidos.
function validar(d) {
  const requeridos = [
    'nombre',
    'entidad',
    'tipo',
    'estado',
    'descripcion',
    'unidad',
    'composicion',
    'periodo',
    'periodicidad',
    'zonas',
    'documentos',
    'fechaInicio',
    'fechaCierre'
  ];

  // Verifica que los campos obligatorios estén completos.
  if (requeridos.some((campo) => !d[campo])) {
    return 'Complete todos los campos obligatorios.';
  }

  // Verifica que la cantidad y los cupos sean enteros positivos.
  if (
    !Number.isInteger(d.cantidad) ||
    d.cantidad < 1 ||
    !Number.isInteger(d.cupos) ||
    d.cupos < 1
  ) {
    return 'Cantidad y cupos deben ser números enteros mayores que cero.';
  }

  // Verifica que el monto sea un número válido y no negativo.
  if (!Number.isFinite(d.monto) || d.monto < 0) {
    return 'El monto debe ser cero o un número positivo.';
  }

  // Verifica que la fecha de cierre no sea anterior a la de inicio.
  if (d.fechaCierre < d.fechaInicio) {
    return 'La fecha de cierre no puede ser anterior a la fecha de inicio.';
  }

  return null;
}

// GET: consulta todos los programas.
// Solo el administrador puede acceder.
router.get('/', admin, (_req, res) => {
  res.json({
    ok: true,
    datos: programas
  });
});

// POST: registra un nuevo programa.
router.post('/', admin, (req, res) => {
  const d = limpiar(req.body);
  const error = validar(d);

  // Si los datos no son válidos, devuelve un error.
  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: error
    });
  }

  // Genera el identificador del nuevo programa.
  const id = nuevoIdPrograma();

  // Usa la clave proporcionada o genera una automáticamente.
  const clave =
    d.claveCorrelativa ||
    `PRG-AGR-02-${String(id).padStart(3, '0')}`;

  // Evita que dos programas tengan la misma clave.
  if (
    programas.some(
      (programa) =>
        programa.claveCorrelativa.toLowerCase() === clave.toLowerCase()
    )
  ) {
    return res.status(409).json({
      ok: false,
      mensaje: 'La clave correlativa ya existe.'
    });
  }

  // Construye el objeto del nuevo programa.
  const nuevo = {
    id,
    ...d,
    claveCorrelativa: clave,
    creadoEn: new Date().toISOString()
  };

  // Guarda el programa en memoria.
  programas.push(nuevo);

  res.status(201).json({
    ok: true,
    dato: nuevo,
    mensaje: 'Programa creado correctamente.'
  });
});

// PUT: actualiza los datos de un programa existente.
router.put('/:id', admin, (req, res) => {
  // Busca el programa mediante su identificador.
  const actual = programas.find(
    (programa) => programa.id === Number(req.params.id)
  );

  if (!actual) {
    return res.status(404).json({
      ok: false,
      mensaje: 'Programa no encontrado.'
    });
  }

  const d = limpiar(req.body);
  const error = validar(d);

  // Comprueba que los datos actualizados sean válidos.
  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: error
    });
  }

  // Comprueba que la clave no pertenezca a otro programa.
  if (
    programas.some(
      (programa) =>
        programa.id !== actual.id &&
        programa.claveCorrelativa.toLowerCase() ===
          d.claveCorrelativa.toLowerCase()
    )
  ) {
    return res.status(409).json({
      ok: false,
      mensaje: 'La clave correlativa ya existe.'
    });
  }

  // Actualiza los datos y registra la fecha de modificación.
  Object.assign(actual, d, {
    actualizadoEn: new Date().toISOString()
  });

  res.json({
    ok: true,
    dato: actual,
    mensaje: 'Programa actualizado.'
  });
});

// DELETE: elimina un programa mediante su identificador.
router.delete('/:id', admin, (req, res) => {
  const index = programas.findIndex(
    (programa) => programa.id === Number(req.params.id)
  );

  // Comprueba que el programa exista.
  if (index === -1) {
    return res.status(404).json({
      ok: false,
      mensaje: 'Programa no encontrado.'
    });
  }

  // Elimina el programa de la lista en memoria.
  programas.splice(index, 1);

  res.json({
    ok: true,
    mensaje: 'Programa eliminado.'
  });
});

// Exporta las rutas para utilizarlas en el servidor.
module.exports = router;