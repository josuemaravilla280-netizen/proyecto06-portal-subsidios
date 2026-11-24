import sql from './db.mjs';
import { ESTADOS, listaEstados } from './estados.mjs';
// Y que las de datos de beneficiarios y su inscripcion necesiten comprobar si la session es de la cuenta que se solicita o del staff
// Lo demas como los datos de los programas deben se publicas, sin necesitar autenticacion.
// A lo mucho podrian poner que las de programas de empresas necesiten que sea una cuenta de la empresa

function retraso(desde) {
    if (!desde) return '';
    const dias = Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 864e5));
    if (dias < 30) return `${dias} ${dias === 1 ? 'día' : 'días'}`;
    const meses = Math.floor(dias / 30);
    return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}


/*login, [{ id, passwordHash }]: una fila por cada cuenta*/
export function searchByDoc(documento) {
    return sql`
    SELECT id,contraseña_hash AS "passwordHash", 0    AS rol
      FROM cuentas_beneficiarios_ed
     WHERE persona_documento = ${documento}
    UNION ALL
    SELECT id, contraseña_hash, rol
      FROM cuentas_staff_ed
     WHERE persona_documento = ${documento}
  `;
}

// tabla, columna y pk son constantes de este archivo, nunca datos del usuario.
async function getAtributo(tabla, columna, pk, valor) {
    const [fila] = await sql`SELECT ${sql(columna)} AS valor FROM ${sql(tabla)} WHERE ${sql(pk)} = ${valor}`;
    return fila ? fila.valor : null;
}
 
async function getAtributoFecha(tabla, columna, pk, valor) {
    const [fila] = await sql`SELECT to_char(${sql(columna)}, 'YYYY-MM-DD') AS valor FROM ${sql(tabla)} WHERE ${sql(pk)} = ${valor}`;
    return fila ? fila.valor : null;
}

/* ---------- personas_ed (PK: documento_unico) ---------- */
export const personaIsDui = (documento) => getAtributo('personas_ed', 'is_dui', 'documento_unico', documento);
export async function personaNombre(documento) {
    const [fila] = await sql`SELECT apellido || ' ' || nombre AS valor FROM personas_ed WHERE documento_unico = ${documento}`;
    return fila ? fila.valor : null;
}
export const personaDepartamentoResidencia = (documento) => getAtributo('personas_ed', 'departamento_residencia', 'documento_unico', documento);
export const personaMunicipioResidencia = (documento) => getAtributo('personas_ed', 'municipio_residencia', 'documento_unico', documento);
export const personaDireccion = (documento) => getAtributo('personas_ed', 'direccion', 'documento_unico', documento);
export const personaNacimiento = (documento) => getAtributoFecha('personas_ed', 'nacimiento', 'documento_unico', documento);

/* ---------- cuentas_beneficiarios_ed (PK: id) ---------- */
export const beneficiarioPersonaDocumento = (id) => getAtributo('cuentas_beneficiarios_ed', 'persona_documento', 'id', id);
export const beneficiarioContrasenaHash = (id) => getAtributo('cuentas_beneficiarios_ed', 'contraseña_hash', 'id', id);
export const beneficiarioTelefono = (id) => getAtributo('cuentas_beneficiarios_ed', 'telefono', 'id', id);
export const beneficiarioEmail = (id) => getAtributo('cuentas_beneficiarios_ed', 'email', 'id', id);
export const beneficiarioEstado = (id) => getAtributo('cuentas_beneficiarios_ed', 'estado', 'id', id);
export const beneficiarioDatos = (id) => getAtributo('cuentas_beneficiarios_ed', 'datos', 'id', id);

/* ---------- cuentas_staff_ed (PK: id) ---------- */
export const staffPersonaDocumento = (id) => getAtributo('cuentas_staff_ed', 'persona_documento', 'id', id);
export const staffContrasenaHash = (id) => getAtributo('cuentas_staff_ed', 'contraseña_hash', 'id', id);
export const staffTelefono = (id) => getAtributo('cuentas_staff_ed', 'telefono', 'id', id);
export const staffEmail = (id) => getAtributo('cuentas_staff_ed', 'email', 'id', id);
export const staffRol = (id) => getAtributo('cuentas_staff_ed', 'rol', 'id', id);
export const staffEmpresa = (id) => getAtributo('cuentas_staff_ed', 'empresa', 'id', id);
export const staffEstado = (id) => getAtributo('cuentas_staff_ed', 'estado', 'id', id);
/* ---------- roles_ec (PK: id) ---------- */
export const rolNombre = (id) => getAtributo('roles_ec', 'name', 'id', id);

/* ---------- programas_ed (PK: id) ---------- */
export const programaNombre = (id) => getAtributo('programas_ed', 'nombre', 'id', id);
export const programaEntidadResponsable = (id) => getAtributo('programas_ed', 'entidad_responsable', 'id', id);
export const programaEstado = (id) => getAtributo('programas_ed', 'estado', 'id', id);
export const programaTipoBeneficio = (id) => getAtributo('programas_ed', 'tipo_beneficio', 'id', id);
export const programaDescripcionBeneficio = (id) => getAtributo('programas_ed', 'descripcion_beneficio', 'id', id);
export const programaFechaInicio = (id) => getAtributoFecha('programas_ed', 'fecha_inicio', 'id', id);
export const programaFechaFinal = (id) => getAtributoFecha('programas_ed', 'fecha_final', 'id', id);
export const programaPerioricidad = (id) => getAtributo('programas_ed', 'perioricidad', 'id', id);
export const programaRequisitos = (id) => getAtributo('programas_ed', 'requisitos', 'id', id);
export const programaDatos = (id) => getAtributo('programas_ed', 'datos', 'id', id);

/* ---------- inscripciones_ed (PK: usuario_id + programa_id) ----------*/
export function listarInscripciones() {
    return sql`
        SELECT i.usuario_id                           AS beneficiario_id,
               c.persona_documento                    AS documento_unico,
               concat_ws(' ', pe.nombre, pe.apellido) AS beneficiario_nombre,
               i.programa_id,
               p.nombre                               AS programa_nombre,
               p.entidad_responsable                  AS entidad,
               e.nombre                               AS entidad_nombre,
               i.estado,
               i.fecha_solicitud,
               i.requisitos                           AS inscripcion_requisitos,
               p.requisitos                           AS programa_requisitos
        FROM inscripciones_ed i
        JOIN cuentas_beneficiarios_ed c ON c.id = i.usuario_id
        JOIN personas_ed pe             ON pe.documento_unico = c.persona_documento
        JOIN programas_ed p             ON p.id = i.programa_id
        JOIN empresas_ed e              ON e.id = p.entidad_responsable
        ORDER BY fecha_solicitud
    `;
}

// Todo menos los jsonb: { usuario_id, programa_id, fecha_solicitud, estado }
export async function inscripcion(usuarioId, programaId) {
    const [fila] = await sql`
    SELECT usuario_id, programa_id, to_char(fecha_solicitud, 'YYYY-MM-DD') AS fecha_solicitud, estado
    FROM inscripciones_ed
    WHERE usuario_id = ${usuarioId} AND programa_id = ${programaId}`;
    return fila ?? null;
}
export async function inscripcionDatos(usuarioId, programaId) {
    const [fila] = await sql`
    SELECT datos FROM inscripciones_ed
    WHERE usuario_id = ${usuarioId} AND programa_id = ${programaId}`;
    return fila ? fila.datos : null;
}
export async function inscripcionRequisitos(usuarioId, programaId) {
    const [fila] = await sql`
    SELECT requisitos FROM inscripciones_ed
    WHERE usuario_id = ${usuarioId} AND programa_id = ${programaId}`;
    return fila ? fila.datos : null;
}



export function listarBeneficiarios() {
    return sql`
    SELECT c.id,
           p.documento_unico            AS documento_unico,
           p.nombre,
           p.apellido,
           p.municipio_residencia       AS municipio_id,
           c.estado
    FROM cuentas_beneficiarios_ed c
    JOIN personas_ed p      ON p.documento_unico = c.persona_documento
    ORDER BY p.apellido, p.nombre`;
}

export async function obtenerBeneficiario(id) {
    const [fila] = await sql`
    SELECT c.id,
           p.nombre || ' ' || p.apellido                         AS nombre,
           d.name                                                AS departamento,
           m.name                                                AS municipio,
           p.direccion                                           AS direccion,
           EXTRACT(YEAR FROM age(p.nacimiento))::int             AS edad,
           CASE WHEN p.is_dui THEN p.documento_unico END         AS numero_documento,
           CASE WHEN NOT p.is_dui THEN p.documento_unico END     AS numero_pasaporte,
           c.datos->>'imagen_documento'                          AS imagen_documento,
           p.nombre                                              AS nombres,
           p.apellido                                            AS apellido,
           p.documento_unico                                     AS documento_unico,
           p.departamento_residencia                             AS departamento_id,
           p.municipio_residencia                                AS municipio_id,
           c.telefono                                            AS telefono,
           c.email                                               AS correo,
           to_char(p.nacimiento, 'YYYY-MM-DD')                   AS fecha_nacimiento,
           ec.name                                               AS estado_cuenta,
           c.datos                                               AS datos
    FROM cuentas_beneficiarios_ed c
    JOIN personas_ed p      ON p.documento_unico = c.persona_documento
    JOIN departamentos_ec d ON d.id = p.departamento_residencia
    JOIN estados_cuentas_empresas_ec ec ON ec.id = c.estado
    JOIN municipios_ec m ON m.id = p.municipio_residencia
    WHERE c.id = ${id}`;
    return fila ?? null;
}

// entrega en inscripciones_ed.datos:
// { "entrega": { "estado": "recibido|no_recibido|no_enviado", "cantidad": 2, "desde": "2026-09-01" } }
// inscripciones_ed.requisitos: { respuestas: { requisito: valor }, datos_cuenta: [getAtributos de la cuenta que se pidieron] }
export async function programasDeBeneficiario(id) {
    const filas = await sql`
    SELECT pr.id,
           pr.nombre,
           lower(ep.name)      AS estado,
           i.datos->'entrega'    AS entrega,
           to_char(i.fecha_solicitud, 'YYYY-MM-DD') AS fecha_solicitud,
           ei.name             AS estado_inscripcion,
           i.datos             AS datos,
           i.requisitos        AS requisitos
    FROM inscripciones_ed i
    JOIN programas_ed pr        ON pr.id = i.programa_id
    JOIN estados_programa_ec ep ON ep.id = pr.estado
    JOIN estados_incripciones_ec ei ON ei.id = i.estado
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
        fecha_solicitud: f.fecha_solicitud,
        estado_inscripcion: f.estado_inscripcion,
        datos: f.datos,
        requisitos: f.requisitos,
    }));
}

// cuentas_beneficiarios_ed.datos.documentos = { "acta de nacimiento": "enlace/al/archivo", ... }
// Devuelve ese objeto ({} si no hay documentos) o null si la cuenta no existe.
export async function beneficiarioDocuments(id) {
    const [fila] = await sql`
    SELECT datos->'documentos' AS documentos
    FROM cuentas_beneficiarios_ed WHERE id = ${id}`;
    if (!fila) return null;
    const d = fila.documentos;
    if (Array.isArray(d)) return Object.fromEntries(d.map((x) => [x.tipo, x.url])); // formato anterior
    return d && typeof d === 'object' ? d : {};
}

/* ---------- Programas ---------- */
// programas_ed.datos: { cantidad, unidad, cupos, monto, clave_correlativa, composicion, periodo }
const ENTREGA = sql`concat_ws(' · ',
  nullif(trim(concat_ws(' ', pr.datos->>'cantidad', pr.datos->>'unidad')), ''),
  nullif(pr.datos->>'composicion', ''))`;

export function listarProgramas() {
    return sql`
    SELECT id,
           entidad_responsable AS entidad,
           nombre,
           tipo_beneficio      AS tipo,
           estado
    FROM programas_ed
    ORDER BY id DESC`;
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
           to_char(pr.fecha_inicio, 'YYYY-MM-DD')     AS fecha_inicio,
           to_char(pr.fecha_final, 'YYYY-MM-DD')      AS fecha_final,
           em.nombre                                  AS entidad_nombre,
           ep.name                                    AS estado,
           pe.name                                    AS periodicidad,
           pr.datos                                   AS datos,
           (pr.datos->>'cantidad')::int               AS cantidad,
           pr.datos->>'unidad'                        AS unidad,
           (pr.datos->>'monto')::float8               AS monto,
           pr.datos->>'clave_correlativa'             AS clave_correlativa,
           pr.datos->>'composicion'                   AS composicion,
           pr.datos->>'periodo'                       AS periodo,
           COALESCE(pr.requisitos, '[]'::jsonb) AS requisitos,
           COALESCE((SELECT array_agg(z.departamento_id ORDER BY z.departamento_id)
                     FROM programas_departamentos_ep z
                     WHERE z.programa_id = pr.id), '{}') AS zonas,
           COALESCE((SELECT array_agg(dz.name ORDER BY dz.name)
                     FROM programas_departamentos_ep z2
                     JOIN departamentos_ec dz ON dz.id = z2.departamento_id
                     WHERE z2.programa_id = pr.id), '{}') AS zonas_nombres
    FROM programas_ed pr
    JOIN tipos_beneficios_ec tb ON tb.id = pr.tipo_beneficio
    JOIN empresas_ed em         ON em.id = pr.entidad_responsable
    JOIN estados_programa_ec ep ON ep.id = pr.estado
    JOIN perioricidad_ec pe     ON pe.id = pr.perioricidad
    WHERE pr.id = ${id}`;
    return fila ?? null;
}

// Las inscripciones retiradas (retirarS, retirarB) no ocupan cupo ni cuentan.
export async function estadisticasPrograma(id) {
    const [prog] = await sql`
    SELECT (datos->>'cupos')::int AS cupos FROM programas_ed WHERE id = ${id}`;
    if (!prog) return null;
    const [e] = await sql`
    SELECT count(*) FILTER (WHERE datos->'entrega'->>'estado' = 'no_recibido')::int AS enviados,
           count(*) FILTER (WHERE datos->'entrega'->>'estado' = 'recibido')::int    AS recibidos,
           count(*) FILTER (WHERE datos->'entrega'->>'estado' = 'no_enviado')::int  AS pendientes,
           count(*)::int                                                            AS cupos_ocupados
    FROM inscripciones_ed
    WHERE programa_id = ${id}
      AND estado NOT IN (${ESTADOS.inscripcion.retirarS}, ${ESTADOS.inscripcion.retirarB})`;
    return { ...e, cupos_disponibles: Math.max((prog.cupos ?? 0) - e.cupos_ocupados, 0) };
}

/* ---------- Catálogos ---------- */
// Los estados de cuenta e inscripción salen del diccionario (data/estados.mjs); el resto, de la base de datos.
export async function obtenerCatalogos() {
    const [departamentos, municipios, entidades, tipos, estados, periodicidades] = await Promise.all([
        sql`SELECT id, name FROM departamentos_ec ORDER BY id`,
        sql`SELECT id, departamento AS departamento_id, name FROM municipios_ec ORDER BY id`,
        sql`SELECT id, nombre AS name FROM empresas_ed ORDER BY id`,
        sql`SELECT id, name FROM tipos_beneficios_ec ORDER BY id`,
        sql`SELECT id, name FROM estados_programa_ec ORDER BY id`,
        sql`SELECT id, name FROM perioricidad_ec ORDER BY id`,
    ]);
    return {
        departamentos, municipios, entidades, tipos, estados, periodicidades,
        estados_cuenta: listaEstados('cuenta'),
        estados_inscripciones: listaEstados('inscripcion'),
    };
}