// IDs de los catálogos de estados. Se ponen directamente en las consultas:
export const ESTADOS = {
    cuenta: { activa: 1, inactivada: 2, eliminada: 3 },
    inscripcion: { enespera: 1, denegada: 2, aprovada: 3, retirarS: 4, retirarB: 5 },
    programa: { activo: 1, cancelado_incompletado: 2, finalizado: 3, eliminado: 4 },
};

// Id de un estado de programa. Falla con un mensaje claro mientras el id no esté completado arriba.
export function estadoPrograma(nombre) {
    const id = ESTADOS.programa[nombre];
    if (id == null) throw new Error(`Falta el id del estado de programa "${nombre}" en data/estados.mjs`);
    return id;
}

// [{ id, nombre }] de un diccionario (para enviarlo al cliente junto con los demás catálogos).
export const listaEstados = (catalogo) =>
    Object.entries(ESTADOS[catalogo]).map(([name, id]) => ({ id, name }));