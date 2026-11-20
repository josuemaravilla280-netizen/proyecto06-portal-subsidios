// Uso: programa.html?id=123
const ID = new URLSearchParams(location.search).get('id');
const API = `/api/programas/${encodeURIComponent(ID)}`;
const NS = 'http://www.w3.org/2000/svg';
// en este element salen los errores
const p_mensaje = $('mensaje');

let usuario = null; // sesión actual (/api/auth/me)
let programa = null; // datos cargados del programa

// El servidor responde { ok, datos } o { ok, dato } y, en error, { ok:false, mensaje }.
async function pedir(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.mensaje || `Error ${r.status}`);
    return j.datos ?? j.dato ?? j;
}

async function cargarUsuario() {
    try {
        const r = await pedir('/api/auth/me');
        if (r.usuario) {
            usuario = r.usuario;
            $('datosUsuario').textContent = `${r.usuario.nombre} · Rol: ${r.usuario.rol}`;
        }
    } catch { /* sin sesión: las demás solicitudes mostrarán el error */ }
}

/* Programa: { nombre, tipo, entrega, descripcion, cupos_maximos, entidad_nombre, estado, periodicidad,fecha_inicio, fecha_final, documentos, zonas_nombres, datos (jsonb) } */
async function cargarInfo() {
    const p = await pedir(API);
    programa = p;
    $('tNombre').textContent = p.nombre ?? 'Programa';
    $('iTipo').textContent = p.tipo ?? '';
    $('iEntrega').textContent = p.entrega ?? '';
    $('iDescripcion').textContent = p.descripcion ?? '';
    $('iCupos').textContent = formatear(p.cupos_maximos);
    $('iEntidad').textContent = formatear(p.entidad_nombre);
    $('iEstado').textContent = formatear(p.estado);
    $('iPeriodicidad').textContent = formatear(p.periodicidad);
    $('iInicio').textContent = formatear(p.fecha_inicio);
    $('iFin').textContent = formatear(p.fecha_final);
    $('iZonas').textContent = formatear(p.zonas_nombres);
    $('iRequisitos').textContent = formatear(p.requisitos);
    // 'cupos' ya se muestra arriba como cupos máximos.
    llenarLista($('iExtras'), aplanar(p.datos, ['cupos']));
    document.title = `${p.nombre} - Portal de Subsidios`;
}

function punto(cx, cy, r, ang) {
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
}

function pastel(titulo, datos) {
    datos.forEach((d) => { d.valor = Number(d.valor) || 0; });
    const total = datos.reduce((s, d) => s + d.valor, 0);
    const cont = document.createElement('div');
    cont.className = 'grafico';
    const h = document.createElement('h3');
    h.textContent = titulo;
    cont.appendChild(h);

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    const cx = 100, cy = 100, r = 90;
    let ini = -Math.PI / 2;

    datos.forEach((d) => {
        if (!d.valor || !total) return;
        const frac = d.valor / total;
        const fin = ini + frac * 2 * Math.PI;
        let forma;
        if (frac >= 0.9999) {
            forma = document.createElementNS(NS, 'circle');
            forma.setAttribute('cx', cx); forma.setAttribute('cy', cy); forma.setAttribute('r', r);
        } else {
            const [x1, y1] = punto(cx, cy, r, ini);
            const [x2, y2] = punto(cx, cy, r, fin);
            forma = document.createElementNS(NS, 'path');
            forma.setAttribute('d', `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${x2},${y2} Z`);
        }
        forma.setAttribute('fill', d.color);
        forma.setAttribute('stroke', '#303a4c');
        forma.setAttribute('stroke-width', '2');
        svg.appendChild(forma);

        const [tx, ty] = frac >= 0.9999 ? [cx, cy] : punto(cx, cy, r * 0.62, (ini + fin) / 2);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', tx); t.setAttribute('y', ty);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('dominant-baseline', 'middle');
        t.textContent = `${Math.round(frac * 100)}%`;
        svg.appendChild(t);
        ini = fin;
    });

    if (!total) {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
        c.setAttribute('fill', '#667184');
        svg.appendChild(c);
    }
    cont.appendChild(svg);

    const ley = document.createElement('ul');
    ley.className = 'leyenda';
    datos.forEach((d) => {
        const li = document.createElement('li');
        const i = document.createElement('i');
        i.style.background = d.color;
        li.append(i, `${d.etiqueta}: ${d.valor}`);
        ley.appendChild(li);
    });
    cont.appendChild(ley);
    return cont;
}

/* Estadísticas: { enviados, recibidos, pendientes, cupos_ocupados, cupos_disponibles } */
async function cargarGraficos() {
    const e = await pedir(`${API}/estadisticas`);
    const g = $('graficos');
    g.replaceChildren(
        pastel('Estado de entregas', [
            { etiqueta: 'Enviados', valor: e.enviados, color: '#2477f3' },
            { etiqueta: 'Recibidos', valor: e.recibidos, color: '#1c9a5f' },
            { etiqueta: 'Pendientes de envío', valor: e.pendientes, color: '#c98a1b' },
        ]),
        pastel('Cupos', [
            { etiqueta: 'Ocupados', valor: e.cupos_ocupados, color: '#8b5cf6' },
            { etiqueta: 'Disponibles', valor: e.cupos_disponibles, color: '#3b4f6c' },
        ])
    );
}

/* ---------- Edición (solo administrador) ---------- */
async function abrirEdicion() {
    if (!programa) return;
    try {
        await cargarCatalogos();
    } catch (e) { return mensaje(p_mensaje,e.message); }

    const d = {
        id: ID,
        nombre: programa.nombre,
        entidad: programa.entidad,
        tipo_id: programa.tipo_id,
        estado_id: programa.estado_id,
        estado: programa.estado,
        descripcion: programa.descripcion,
        cantidad: programa.cantidad,
        unidad: programa.unidad,
        cupos: programa.cupos_maximos,
        monto: programa.monto,
        claveCorrelativa: programa.clave_correlativa,
        composicion: programa.composicion,
        fechaInicio: programa.fecha_inicio,
        fechaCierre: programa.fecha_final,
        periodo: programa.periodo,
        periodicidad_id: programa.periodicidad_id,
        zonas: programa.zonas,
        requisitos: programa.requisitos,
    };

    const panel = $('panelEdicion');
    panel.innerHTML = `<h2>Editar programa</h2>${formPrograma(d)}`;
    panel.classList.remove('oculto');
    $('formPrograma').addEventListener('submit', guardarPrograma);
    $('cancelarPrograma').addEventListener('click', cerrarEdicion);
    panel.scrollIntoView({ behavior: 'smooth' });
}

function cerrarEdicion() {
    const panel = $('panelEdicion');
    panel.classList.add('oculto');
    panel.replaceChildren();
}

async function guardarPrograma(e) {
    e.preventDefault();
    try {
        const r = await enviarJSON(API, 'PUT', valoresPrograma(e.currentTarget));
        cerrarEdicion();
        await Promise.all([cargarInfo(), cargarGraficos()]);
        mensaje(p_mensaje,r.mensaje || 'Programa actualizado.', 'exito');
    } catch (err) { mensaje(p_mensaje,err.message); }
}

$('btnEditar').onclick = abrirEdicion;

// El formulario vive en su propia página: inscribirse_en.html?id=<programa>
function abrirInscripcion() {
    window.open(`../inscribirse_en.html?id=${encodeURIComponent(ID)}`, '_blank');
}
$('btnInscribirme').onclick = abrirInscripcion;

$('btnCerrar').onclick = () => window.close();

if (!ID) {
    mensaje(p_mensaje,'Falta el ID del programa.');
} else {
    (async () => {
        await cargarUsuario(); // el rol define si se muestra Editar
        if (usuario?.rol === 'admin') $('btnEditar').classList.remove('oculto');
        if (usuario?.rol === 'beneficiario') $('btnInscribirme').classList.remove('oculto');
        await Promise.all([cargarInfo(), cargarGraficos()]);
    })().catch((e) => mensaje(p_mensaje,e.message));
}