import sql from './db.mjs';
import { ESTADOS, estadoPrograma } from './estados.mjs';
// Escritura (INSERT y UPDATE). Los SELECT están en getData.mjs.
// Los ids de los estados vienen de data/estados.mjs: se ponen directamente en la consulta.
export const normalizarTexto = (s) =>
    String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();


/* ---------- Cambios de estado (no se elimina ningún registro) ---------- */
export function inactivarCuenta(id) {
    return sql.begin(async (tx) => {
        const [c] = await tx`SELECT estado FROM cuentas_beneficiarios_ed WHERE id = ${id} FOR UPDATE`;
        if (!c) return { noEncontrado: true };
        if (c.estado === ESTADOS.cuenta.inactivada) return { yaEstaba: true };
        await tx`UPDATE cuentas_beneficiarios_ed SET estado = ${ESTADOS.cuenta.inactivada} WHERE id = ${id}`;
        return { ok: true };
    });
}

export function reactivarCuenta(id) {
    return sql.begin(async (tx) => {
        const [c] = await tx`SELECT estado FROM cuentas_beneficiarios_ed WHERE id = ${id} FOR UPDATE`;
        if (!c) return { noEncontrado: true };
        if (c.estado === ESTADOS.cuenta.activa) return { yaEstaba: true };
        await tx`UPDATE cuentas_beneficiarios_ed SET estado = ${ESTADOS.cuenta.activa} WHERE id = ${id}`;
        return { ok: true };
    });
}

export function cancelarPrograma(id) {
    const cancelado = estadoPrograma('cancelado_incompletado');
    return sql.begin(async (tx) => {
        const [p] = await tx`SELECT estado FROM programas_ed WHERE id = ${id} FOR UPDATE`;
        if (!p) return { noEncontrado: true };
        if (p.estado === cancelado) return { yaEstaba: true };
        await tx`UPDATE programas_ed SET estado = ${cancelado} WHERE id = ${id}`;
        return { ok: true };
    });
}

export function reactivarPrograma(id) {
    const activo = estadoPrograma('activo');
    return sql.begin(async (tx) => {
        const [p] = await tx`SELECT estado FROM programas_ed WHERE id = ${id} FOR UPDATE`;
        if (!p) return { noEncontrado: true };
        if (p.estado === activo) return { yaEstaba: true };
        await tx`UPDATE programas_ed SET estado = ${activo} WHERE id = ${id}`;
        return { ok: true };
    });
}

// quien: 'retirarB' (la retira el beneficiario) o 'retirarS' (la retira el personal)
export function retirarInscripcion(id, programaId, quien) {
    const retiros = { retirarB: ESTADOS.inscripcion.retirarB, retirarS: ESTADOS.inscripcion.retirarS };
    if (!(quien in retiros)) throw new Error(`"${quien}" no es un estado de retiro`);
    const nuevo = retiros[quien];
    const otro = quien === 'retirarB' ? retiros.retirarS : retiros.retirarB;

    return sql.begin(async (tx) => {
        const [i] = await tx`
      SELECT estado FROM inscripciones_ed
      WHERE usuario_id = ${id} AND programa_id = ${programaId} FOR UPDATE`;
        if (!i) return { noEncontrado: true };
        if (i.estado === nuevo || i.estado === otro) return { yaEstaba: true }; // ya retirada: no se reescribe quién la retiró
        await tx`
      UPDATE inscripciones_ed SET estado = ${nuevo}
      WHERE usuario_id = ${id} AND programa_id = ${programaId}`;
        return { ok: true };
    });
}

/* ---------- Inscripciones ---------- */
// estado: 'enespera' (solicita el beneficiario) o 'aprovada' (registra el personal).
// requisitos: { respuestas, datos_cuenta } -> columna inscripciones_ed.requisitos
//   (campos de requisitos que el beneficiario rellenó y lista de datos de su cuenta que se le pidieron).
// Si había una inscripción retirada en ese programa, la reactiva (la clave primaria no permite una segunda fila)
// y reinicia la entrega.
// Devuelve { creada } | { programaNoExiste } | { programaCancelado }.
export function crearInscripcion(id, programaId, { requisitos = null, estado = 'enespera' } = {}) {
    const estadoId = ESTADOS.inscripcion[estado];
    if (estadoId == null) throw new Error(`"${estado}" no es un estado de inscripción`);
    const cancelado = estadoPrograma('cancelado_incompletado');

    return sql.begin(async (tx) => {
        const [pr] = await tx`SELECT estado FROM programas_ed WHERE id = ${programaId}`;
        if (!pr) return { programaNoExiste: true };
        if (pr.estado === cancelado) return { programaCancelado: true };

        const filas = await tx`
      INSERT INTO inscripciones_ed (usuario_id, programa_id, fecha_solicitud, estado, requisitos, datos)
      VALUES (
        ${id}, ${programaId}, CURRENT_DATE, ${estadoId},
        ${requisitos === null ? null : tx.json(requisitos)}::jsonb,
        ${tx.json({ entrega: { estado: 'no_enviado', cantidad: 0 } })}::jsonb
      )
      ON CONFLICT (usuario_id, programa_id) DO UPDATE
        SET estado = EXCLUDED.estado,
            fecha_solicitud = EXCLUDED.fecha_solicitud,
            requisitos = EXCLUDED.requisitos,
            datos = COALESCE(inscripciones_ed.datos, '{}'::jsonb) || EXCLUDED.datos
        WHERE inscripciones_ed.estado IN (${ESTADOS.inscripcion.retirarS}, ${ESTADOS.inscripcion.retirarB})
      RETURNING programa_id`;
        return { creada: filas.length > 0 };
    });
}

/* ---------- Beneficiarios ---------- */
// d: { documento, isDui, nombre, apellido, nacimiento, telefono, email, departamento (id o nombre), municipio, direccion }

// Acepta el id (lo que envía el select cargado desde la DB) o el nombre.
async function buscarDepartamento(tx, valor) {
    const v = String(valor ?? '').trim();
    const [dep] = /^\d+$/.test(v)
        ? await tx`SELECT id FROM departamentos_ec WHERE id = ${Number(v)}`
        : await tx`SELECT id FROM departamentos_ec WHERE lower(name) = lower(${v})`;
    return dep ?? null;
}

// El municipio debe existir y pertenecer al departamento elegido.
async function buscarMunicipio(tx, valor, departamentoId) {
    const [mun] = await tx`
    SELECT id FROM municipios_ec
    WHERE id = ${Number(valor)} AND departamento = ${departamentoId}`;
    return mun ?? null;
}

export function crearBeneficiario(d) {
    return sql.begin(async (tx) => {
        const [existe] = await tx`
      SELECT 1 FROM cuentas_beneficiarios_ed WHERE persona_documento = ${d.documento}`;
        if (existe) return { duplicado: true };

        const dep = await buscarDepartamento(tx, d.departamento);
        if (!dep) return { departamentoInvalido: true };
        const mun = await buscarMunicipio(tx, d.municipio, dep.id);
        if (!mun) return { municipioInvalido: true };

        await tx`
      INSERT INTO personas_ed (documento_unico, is_dui, nombre, apellido, departamento_residencia, municipio_residencia, direccion, nacimiento)
      VALUES (${d.documento}, ${d.isDui}, ${d.nombre}, ${d.apellido}, ${dep.id}, ${mun.id},${d.direccion}, ${d.nacimiento})
      ON CONFLICT (documento_unico) DO NOTHING`;

        const [c] = await tx`
      INSERT INTO cuentas_beneficiarios_ed (persona_documento, estado, telefono, email, datos)
      VALUES (
        ${d.documento},
        ${ESTADOS.cuenta.activa},
        ${d.telefono},
        ${d.email || null},
        '{}'::jsonb
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

        const dep = await buscarDepartamento(tx, d.departamento);
        if (!dep) return { departamentoInvalido: true };
        const mun = await buscarMunicipio(tx, d.municipio, dep.id);
        if (!mun) return { municipioInvalido: true };

        await tx`
      UPDATE personas_ed
      SET nombre = ${d.nombre},
          apellido = ${d.apellido},
          departamento_residencia = ${dep.id},
          municipio_residencia = ${mun.id},
          direccion = ${d.direccion},
          nacimiento = COALESCE(${d.nacimiento ?? null}::date, nacimiento)
      WHERE documento_unico = ${c.persona_documento}`;

        await tx`
      UPDATE cuentas_beneficiarios_ed
      SET telefono = ${d.telefono},
          email = ${d.email || null}
      WHERE id = ${id}`;
        return { id };
    });
}

/* Documentos de la cuenta: cuentas_beneficiarios_ed.datos.documentos = { "tipo en minúsculas": "enlace" }
   Devuelve { ok, clave } | { noEncontrado } | { duplicado }. */
export function agregarDocumentoCuenta(id, tipo, enlace) {
    return sql.begin(async (tx) => {
        const [c] = await tx`
      SELECT datos->'documentos' AS documentos
      FROM cuentas_beneficiarios_ed WHERE id = ${id} FOR UPDATE`;
        if (!c) return { noEncontrado: true };

        const actuales = c.documentos && !Array.isArray(c.documentos) ? c.documentos : {};
        if (Object.keys(actuales).some((k) => normalizarTexto(k) === normalizarTexto(tipo))) return { duplicado: true };

        const clave = String(tipo).trim().toLowerCase();
        await tx`
      UPDATE cuentas_beneficiarios_ed
      SET datos = jsonb_set(COALESCE(datos, '{}'::jsonb), '{documentos}', ${tx.json({ ...actuales, [clave]: enlace })}::jsonb)
      WHERE id = ${id}`;
        return { ok: true, clave };
    });
}

/* ---------- Programas ---------- */
// d: { nombre, entidad, tipo, estado, periodicidad (ids), descripcion, fechaInicio, fechaCierre,
//      zonas [ids de departamento], cantidad, unidad, cupos, monto, clave, composicion,
//      periodo, requisitos [{ nombre, tipo, obligatorio, opciones?, campo? }] -> columna programas_ed.requisitos (JSONB) }

const datosPrograma = (d) => ({
    cantidad: d.cantidad,
    unidad: d.unidad,
    cupos: d.cupos,
    monto: d.monto,
    composicion: d.composicion,
    periodo: d.periodo,
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
         fecha_inicio, fecha_final, perioricidad, requisitos, datos)
      VALUES
        (${d.nombre}, ${d.entidad}, ${d.estado}, ${d.tipo}, ${d.descripcion},
         ${d.fechaInicio}, ${d.fechaCierre}, ${d.periodicidad}, ${tx.json(d.requisitos)}::jsonb,
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
          requisitos = ${tx.json(d.requisitos)}::jsonb,
          datos = COALESCE(datos, '{}'::jsonb)
                  || ${tx.json({ ...datosPrograma(d), clave_correlativa: clave })}::jsonb
      WHERE id = ${id}`;
        // este delete no me parece muy bien realmente, tengo que ver eso luego
        await tx`DELETE FROM programas_departamentos_ep WHERE programa_id = ${id}`;
        await insertarZonas(tx, id, d.zonas);
        return { id };
    });
}