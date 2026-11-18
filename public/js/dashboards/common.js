const $ = (id) => document.getElementById(id);

// ---- jsonb -> lista de [etiqueta, texto] ----
const humanizar = (k) => {
    const s = String(k).replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
};

function formatear(v) {
    if (v === null || v === undefined || v === '') return 'Sin dato';
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    if (Array.isArray(v)) {
        return v.length ? v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ') : 'Sin dato';
    }
    return String(v);
}

// Aplana un objeto jsonb; `omitir` lleva rutas como 'entrega.estado'.
function aplanar(obj, omitir = [], ruta = '', etiquetaPadre = '') {
    const filas = [];
    Object.entries(obj ?? {}).forEach(([k, v]) => {
        const r = ruta ? `${ruta}.${k}` : k;
        if (omitir.includes(r)) return;
        const etiqueta = etiquetaPadre ? `${etiquetaPadre} · ${humanizar(k)}` : humanizar(k);
        if (v && typeof v === 'object' && !Array.isArray(v)) filas.push(...aplanar(v, omitir, r, etiqueta));
        else filas.push([etiqueta, formatear(v)]);
    });
    return filas;
}

function llenarLista(ul, filas) {
    ul.replaceChildren();
    if (!filas.length) {
        const li = document.createElement('li');
        li.textContent = 'No hay datos adicionales.';
        ul.appendChild(li);
        return;
    }
    filas.forEach(([etiqueta, valor]) => {
        const li = document.createElement('li');
        const s = document.createElement('span');
        s.textContent = etiqueta;
        const b = document.createElement('b');
        b.textContent = valor;
        li.append(s, b);
        ul.appendChild(li);
    });
}