import sql from './db.mjs';

function retraso(desde) {
  if (!desde) return '';
  const dias = Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 864e5));
  if (dias < 30) return `${dias} ${dias === 1 ? 'día' : 'días'}`;
  const meses = Math.floor(dias / 30);
  return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}


export async function searchByDoc(documento) {
  // const sql = await getSql();
  return sql`
    SELECT cb.id,
           p.documento_unico AS identificador,
           p.nombre,
           'beneficiario'    AS rol,
           cb.contraseña_hash  AS "passwordHash"
        FROM cuentas_beneficiarios_ed cb
      JOIN personas_ed p ON p.documento_unico = cb.persona_documento
     WHERE p.documento_unico = ${documento}
    UNION ALL
    SELECT cs.id,
           p.documento_unico,
           p.nombre,
           r.name,
           cs.contraseña_hash
      FROM cuentas_staff_ed cs
      JOIN personas_ed p ON p.documento_unico = cs.persona_documento
      JOIN roles_ec r    ON r.id = cs.rol
     WHERE p.documento_unico = ${documento}
  `;
}


export function listarBeneficiarios() {
  return sql`
    SELECT c.id,
           p.documento_unico            AS documento_unico,
           p.nombre,
           p.apellido,
           p.departamento_residencia    AS departamento_id,
           d.name                     AS departamento,
           to_char(p.nacimiento, 'YYYY-MM-DD') AS nacimiento,
           c.datos->>'municipio'        AS municipio,
           c.datos->>'direccion'        AS direccion,
           c.datos->>'telefono'         AS telefono,
           c.datos->>'email'            AS correo
    FROM cuentas_beneficiarios_ed c
    JOIN personas_ed p      ON p.documento_unico = c.persona_documento
    JOIN departamentos_ec d ON d.id = p.departamento_residencia
    ORDER BY p.apellido, p.nombre`;
}

export async function obtenerBeneficiario(id) {
  const [fila] = await sql`
    SELECT c.id,
           p.nombre || ' ' || p.apellido                         AS nombre,
           d.name                                              AS departamento,
           c.datos->>'municipio'                                 AS municipio,
           c.datos->>'direccion'                                 AS direccion,
           EXTRACT(YEAR FROM age(p.nacimiento))::int             AS edad,
           CASE WHEN p.is_dui THEN p.documento_unico END         AS numero_documento,
           CASE WHEN NOT p.is_dui THEN p.documento_unico END     AS numero_pasaporte,
           c.datos->>'imagen_documento'                          AS imagen_documento
    FROM cuentas_beneficiarios_ed c
    JOIN personas_ed p      ON p.documento_unico = c.persona_documento
    JOIN departamentos_ec d ON d.id = p.departamento_residencia
    WHERE c.id = ${id}`;
  return fila ?? null;
}

// entrega en inscripciones_ed.datos:
// { "entrega": { "estado": "recibido|no_recibido|no_enviado", "cantidad": 2, "desde": "2026-09-01" } }
export async function programasDeBeneficiario(id) {
  const filas = await sql`
    SELECT pr.id,
           pr.nombre,
           lower(ep.name)      AS estado,
           i.datos->'entrega'    AS entrega
    FROM inscripciones_ed i
    JOIN programas_ed pr        ON pr.id = i.programa_id
    JOIN estados_programa_ec ep ON ep.id = pr.estado
    WHERE i.usuario_id = ${id}
    ORDER BY pr.nombre`;
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    estado: f.estado,
    entrega: f.entrega
      ? {
          estado: f.entrega.estado,
          cantidad: f.entrega.cantidad ?? 0,
          retraso: retraso(f.entrega.desde),
        }
      : null,
  }));
}

// cuentas_beneficiarios_ed.datos: { "documentos": [{ "tipo", "nombre_archivo", "url" }] }
export async function documentosDeBeneficiario(id) {
  const [fila] = await sql`
    SELECT COALESCE(datos->'documentos', '[]'::jsonb) AS documentos
    FROM cuentas_beneficiarios_ed WHERE id = ${id}`;
  return fila ? fila.documentos : null;
}

export async function eliminarInscripcion(id, programaId) {
  const filas = await sql`
    DELETE FROM inscripciones_ed
    WHERE usuario_id = ${id} AND programa_id = ${programaId}
    RETURNING programa_id`;
  return filas.length > 0;
}

// Devuelve true si se creó, false si ya estaba inscrito.
export async function crearInscripcion(id, programaId) {
  const filas = await sql`
    INSERT INTO inscripciones_ed (usuario_id, programa_id, fecha_solicitud, estado, datos)
    VALUES (
      ${id}, ${programaId}, CURRENT_DATE,
      (SELECT id FROM estados_incripciones_ec ORDER BY id LIMIT 1), -- AJUSTAR: id del estado inicial
      ${sql.json({ entrega: { estado: 'no_enviado', cantidad: 0 } })}::jsonb
    )
    ON CONFLICT (usuario_id, programa_id) DO NOTHING
    RETURNING programa_id`;
  return filas.length > 0;
}

/* ---------- Programas ---------- */
// programas_ed.datos: { cantidad, unidad, cupos, monto, clave_correlativa,
//                       composicion, periodo, periodo_asignacion }

// "2 cajas · Arroz, frijol y aceite"
const ENTREGA = sql`concat_ws(' · ',
  nullif(trim(concat_ws(' ', pr.datos->>'cantidad', pr.datos->>'unidad')), ''),
  nullif(pr.datos->>'composicion', ''))`;

export function listarProgramas() {
  return sql`
    SELECT pr.id,
           pr.nombre,
           pr.estado                    AS estado_id,
           ep.name                    AS estado,
           tb.name                    AS tipo,
           pe.name                    AS periodicidad,
           ${ENTREGA}                   AS entrega,
           pr.fecha_inicio,
           pr.fecha_final,
           (pr.datos->>'cupos')::int    AS cupos
    FROM programas_ed pr
    JOIN estados_programa_ec ep ON ep.id = pr.estado
    JOIN tipos_beneficios_ec tb ON tb.id = pr.tipo_beneficio
    JOIN perioricidad_ec pe     ON pe.id = pr.perioricidad
    ORDER BY pr.nombre`;
}

// Incluye los campos de la página (tipo, entrega, descripcion, cupos_maximos)
// y los del formulario de edición.
export async function obtenerPrograma(id) {
  const [fila] = await sql`
    SELECT pr.id,
           pr.nombre,
           tb.name                                  AS tipo,
           ${ENTREGA}                                 AS entrega,
           pr.descripcion_beneficio                   AS descripcion,
           (pr.datos->>'cupos')::int                  AS cupos_maximos,
           pr.entidad_responsable                     AS entidad,
           pr.tipo_beneficio                          AS tipo_id,
           pr.estado                                  AS estado_id,
           pr.perioricidad                            AS periodicidad_id,
           pr.fecha_inicio,
           pr.fecha_final,
           (pr.datos->>'cantidad')::int               AS cantidad,
           pr.datos->>'unidad'                        AS unidad,
           (pr.datos->>'monto')::float8               AS monto,
           pr.datos->>'clave_correlativa'             AS clave_correlativa,
           pr.datos->>'composicion'                   AS composicion,
           pr.datos->>'periodo'                       AS periodo,
           pr.datos->>'periodo_asignacion'            AS periodo_asignacion,
           COALESCE((SELECT array_agg(z.departamento_id ORDER BY z.departamento_id)
                     FROM programas_departamentos_ep z
                     WHERE z.programa_id = pr.id), '{}') AS zonas
    FROM programas_ed pr
    JOIN tipos_beneficios_ec tb ON tb.id = pr.tipo_beneficio
    WHERE pr.id = ${id}`;
  return fila ?? null;
}

export async function estadisticasPrograma(id) {
  const [prog] = await sql`
    SELECT (datos->>'cupos')::int AS cupos FROM programas_ed WHERE id = ${id}`;
  if (!prog) return null;
  const [e] = await sql`
    SELECT count(*) FILTER (WHERE datos->'entrega'->>'estado' = 'no_recibido')::int AS enviados,
           count(*) FILTER (WHERE datos->'entrega'->>'estado' = 'recibido')::int    AS recibidos,
           count(*) FILTER (WHERE datos->'entrega'->>'estado' = 'no_enviado')::int  AS pendientes,
           count(*)::int                                                            AS cupos_ocupados
    FROM inscripciones_ed WHERE programa_id = ${id}`;
  return { ...e, cupos_disponibles: Math.max((prog.cupos ?? 0) - e.cupos_ocupados, 0) };
}

/* ---------- Escritura: beneficiarios ---------- */
// d: { documento, isDui, nombre, apellido, nacimiento, telefono, email, departamento (nombre), municipio, direccion }

export function crearBeneficiario(d) {
  return sql.begin(async (tx) => {
    const [existe] = await tx`
      SELECT 1 FROM cuentas_beneficiarios_ed WHERE persona_documento = ${d.documento}`;
    if (existe) return { duplicado: true };

    const [dep] = await tx`
      SELECT id FROM departamentos_ec WHERE lower(nombre) = lower(${d.departamento})`;
    if (!dep) return { departamentoInvalido: true };

    await tx`
      INSERT INTO personas_ed (documento_unico, is_dui, nombre, apellido, departamento_residencia, nacimiento)
      VALUES (${d.documento}, ${d.isDui}, ${d.nombre}, ${d.apellido}, ${dep.id}, ${d.nacimiento})
      ON CONFLICT (documento_unico) DO NOTHING`;

    const [c] = await tx`
      INSERT INTO cuentas_beneficiarios_ed (persona_documento, estado, datos)
      VALUES (
        ${d.documento},
        (SELECT id FROM estados_cuentas_empresas_ec ORDER BY id LIMIT 1), -- AJUSTAR: id del estado inicial
        ${tx.json({ telefono: d.telefono, email: d.email, municipio: d.municipio, direccion: d.direccion })}::jsonb
      )
      RETURNING id`;
    return { id: c.id };
  });
}

// El documento no se modifica (es la clave primaria de personas_ed).
export function actualizarBeneficiario(id, d) {
  return sql.begin(async (tx) => {
    const [c] = await tx`
      SELECT persona_documento FROM cuentas_beneficiarios_ed WHERE id = ${id} FOR UPDATE`;
    if (!c) return { noEncontrado: true };
    if (d.documento !== c.persona_documento) return { documentoDistinto: true };

    const [dep] = await tx`
      SELECT id FROM departamentos_ec WHERE lower(nombre) = lower(${d.departamento})`;
    if (!dep) return { departamentoInvalido: true };

    await tx`
      UPDATE personas_ed
      SET nombre = ${d.nombre},
          apellido = ${d.apellido},
          departamento_residencia = ${dep.id},
          nacimiento = COALESCE(${d.nacimiento ?? null}::date, nacimiento)
      WHERE documento_unico = ${c.persona_documento}`;

    await tx`
      UPDATE cuentas_beneficiarios_ed
      SET datos = COALESCE(datos, '{}'::jsonb)
                  || ${tx.json({ telefono: d.telefono, email: d.email, municipio: d.municipio, direccion: d.direccion })}::jsonb
      WHERE id = ${id}`;
    return { id };
  });
}

/* ---------- Escritura: programas ---------- */
// d: { nombre, entidad, tipo, estado, periodicidad (ids), descripcion, fechaInicio, fechaCierre,
//      zonas [ids de departamento], cantidad, unidad, cupos, monto, clave, composicion,
//      periodo, periodoAsignacion }

const datosPrograma = (d) => ({
  cantidad: d.cantidad,
  unidad: d.unidad,
  cupos: d.cupos,
  monto: d.monto,
  composicion: d.composicion,
  periodo: d.periodo,
  periodo_asignacion: d.periodoAsignacion,
});

const claveAuto = (id) => `PRG-AGR-02-${String(id).padStart(3, '0')}`;

const insertarZonas = (tx, programaId, zonas) =>
  tx`INSERT INTO programas_departamentos_ep ${tx(
    zonas.map((z) => ({ departamento_id: z, programa_id: programaId }))
  )}`;

export function crearPrograma(d) {
  return sql.begin(async (tx) => {
    if (d.clave) {
      const [dup] = await tx`
        SELECT 1 FROM programas_ed WHERE lower(datos->>'clave_correlativa') = lower(${d.clave})`;
      if (dup) return { claveDuplicada: true };
    }
    const [p] = await tx`
      INSERT INTO programas_ed
        (nombre, entidad_responsable, estado, tipo_beneficio, descripcion_beneficio,
         fecha_inicio, fecha_final, perioricidad, datos)
      VALUES
        (${d.nombre}, ${d.entidad}, ${d.estado}, ${d.tipo}, ${d.descripcion},
         ${d.fechaInicio}, ${d.fechaCierre}, ${d.periodicidad},
         ${tx.json({ ...datosPrograma(d), clave_correlativa: d.clave || null })}::jsonb)
      RETURNING id`;
    if (!d.clave) {
      await tx`
        UPDATE programas_ed
        SET datos = datos || ${tx.json({ clave_correlativa: claveAuto(p.id) })}::jsonb
        WHERE id = ${p.id}`;
    }
    await insertarZonas(tx, p.id, d.zonas);
    return { id: p.id };
  });
}

export function actualizarPrograma(id, d) {
  return sql.begin(async (tx) => {
    const [actual] = await tx`SELECT datos FROM programas_ed WHERE id = ${id} FOR UPDATE`;
    if (!actual) return { noEncontrado: true };

    const clave = d.clave || actual.datos?.clave_correlativa || claveAuto(id);
    const [dup] = await tx`
      SELECT 1 FROM programas_ed
      WHERE id <> ${id} AND lower(datos->>'clave_correlativa') = lower(${clave})`;
    if (dup) return { claveDuplicada: true };

    await tx`
      UPDATE programas_ed
      SET nombre = ${d.nombre},
          entidad_responsable = ${d.entidad},
          estado = ${d.estado},
          tipo_beneficio = ${d.tipo},
          descripcion_beneficio = ${d.descripcion},
          fecha_inicio = ${d.fechaInicio},
          fecha_final = ${d.fechaCierre},
          perioricidad = ${d.periodicidad},
          datos = COALESCE(datos, '{}'::jsonb)
                  || ${tx.json({ ...datosPrograma(d), clave_correlativa: clave })}::jsonb
      WHERE id = ${id}`;

    await tx`DELETE FROM programas_departamentos_ep WHERE programa_id = ${id}`;
    await insertarZonas(tx, id, d.zonas);
    return { id };
  });
}

// No elimina programas con beneficiarios inscritos.
export function eliminarPrograma(id) {
  return sql.begin(async (tx) => {
    const [p] = await tx`SELECT id FROM programas_ed WHERE id = ${id} FOR UPDATE`;
    if (!p) return { noEncontrado: true };
    const [{ n }] = await tx`SELECT count(*)::int AS n FROM inscripciones_ed WHERE programa_id = ${id}`;
    if (n > 0) return { conInscritos: true };
    await tx`DELETE FROM programas_departamentos_ep WHERE programa_id = ${id}`;
    await tx`DELETE FROM programas_ed WHERE id = ${id}`;
    return { ok: true };
  });
}

// Todas se devuelven como { id, nombre }.
export async function obtenerCatalogos() {
  const [departamentos, entidades, tipos, estados, periodicidades] = await Promise.all([
    sql`SELECT id, name AS nombre FROM departamentos_ec ORDER BY name`,
    sql`SELECT id, nombre FROM empresas_ed ORDER BY nombre`,
    sql`SELECT id, name AS nombre FROM tipos_beneficios_ec ORDER BY id`,
    sql`SELECT id, name AS nombre FROM estados_programa_ec ORDER BY id`,
    sql`SELECT id, name AS nombre FROM perioricidad_ec ORDER BY id`,
  ]);
  return { departamentos, entidades, tipos, estados, periodicidades };
}
