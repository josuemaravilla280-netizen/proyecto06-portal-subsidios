// IDs de los catálogos de estados (ver estados.json). Se ponen directamente en las consultas:
// no hace falta buscarlos por nombre en la base de datos.
export const ESTADOS = {
    // estados_cuentas_empresas_ec
    cuenta: { activa: 1, inactivada: 2, eliminada: 3 },

    // estados_incripciones_ec
    inscripcion: { enespera: 1, denegada: 2, aprovada: 3, retirarS: 4, retirarB: 5 },

    // estados_programa_ec
    // FALTA: la sección "estados_programa_ec" de estados.json trae los mismos estados que las inscripciones
    // (parece un error al pegar). Completar con los ids reales de estos dos estados:
    programa: { activo: null, cancelado_incompletado: null },
};

// Id de un estado de programa. Falla con un mensaje claro mientras el id no esté completado arriba.
export function estadoPrograma(nombre) {
    const id = ESTADOS.programa[nombre];
    if (id == null) throw new Error(`Falta el id del estado de programa "${nombre}" en data/estados.mjs`);
    return id;
}

// [{ id, nombre }] de un diccionario (para enviarlo al cliente junto con los demás catálogos).
export const listaEstados = (catalogo) =>
    Object.entries(ESTADOS[catalogo]).map(([nombre, id]) => ({ id, nombre }));