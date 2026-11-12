// Uso: beneficiario.html?id=<uuid de cuentas_beneficiarios_ed>
const ID = new URLSearchParams(location.search).get('id');
const API = `/api/beneficiarios/${encodeURIComponent(ID)}`;
const $ = (id) => document.getElementById(id);

function aviso(texto, tipo = 'error') {
    const m = $('mensaje');
    m.textContent = texto;
    m.className = `mensaje visible ${tipo}`;
}

// El servidor responde { ok, datos } o { ok, dato } y, en error, { ok:false, mensaje }.
async function pedir(url, opciones = {}) {
    const r = await fetch(url, {
        credentials: 'same-origin',
        ...opciones,
        headers: { 'Content-Type': 'application/json', ...(opciones.headers || {}) },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.mensaje || `Error ${r.status}`);
    return j.datos ?? j.dato ?? j;
}

function celda(tr, texto, clase) {
    const td = document.createElement('td');
    td.textContent = texto;
    if (clase) td.className = clase;
    tr.appendChild(td);
    return td;
}

// "En revisión" -> "estado-en-revision"
const claseEstado = (e) =>
    'estado-' + String(e || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, '-');

function abrirSeguro(url) {
    try {
        const u = new URL(url, location.origin);
        if (u.protocol === 'http:' || u.protocol === 'https:') window.open(u.href, '_blank', 'noopener');
        else aviso('Enlace no válido.');
    } catch {
        aviso('Enlace no válido.');
    }
}

async function cargarUsuario() {
    try {
        const r = await pedir('/api/auth/me');
        if (r.usuario) $('datosUsuario').textContent = `${r.usuario.nombre} · Rol: ${r.usuario.rol}`;
    } catch { /* sin sesión: las demás solicitudes mostrarán el error */ }
}

/* Perfil: { nombre, departamento, municipio, direccion, edad,
             numero_documento, numero_pasaporte, imagen_documento } */
function sinImagen() {
    const img = $('imgDocumento');
    const ph = document.createElement('div');
    ph.className = 'perfil-img';
    ph.style.cssText = 'display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.85rem;';
    ph.textContent = 'Sin imagen del documento';
    img.replaceWith(ph);
}

async function cargarPerfil() {
    const p = await pedir(API);
    $('pNombre').textContent = p.nombre ?? '';
    $('pUbicacion').textContent = [p.departamento, p.municipio].filter(Boolean).join(' / ');
    $('pDireccion').textContent = p.direccion ?? '';
    $('pEdad').textContent = p.edad ?? '';
    $('pDocumento').textContent = p.numero_documento ?? '';
    $('pPasaporte').textContent = p.numero_pasaporte ?? '';
    document.title = `${p.nombre} - Portal de Subsidios`;

    const img = $('imgDocumento');
    if (p.imagen_documento) {
        img.onerror = sinImagen;
        img.src = p.imagen_documento;
    } else {
        sinImagen();
    }
}

/* Programas: [{ id, nombre, estado, entrega: { estado: recibido|no_recibido|no_enviado, cantidad, retraso } | null }] */
function textoEntrega(e) {
    if (!e) return 'sin registro de entregas';
    if (e.estado === 'recibido') return 'último paquete recibido';
    if (e.estado !== 'no_recibido' && e.estado !== 'no_enviado') return '';
    const motivo = e.estado === 'no_enviado' ? 'enviado' : 'recibido';
    const n = Number(e.cantidad) || 0;
    if (n < 1) return `paquete no ${motivo}`;
    const uno = n === 1;
    const base = `${n} ${uno ? 'paquete no ha' : 'paquetes no han'} sido ${motivo}${uno ? '' : 's'}`;
    return e.retraso ? `${base} en ${e.retraso}` : base;
}

async function cargarProgramas() {
    const programas = await pedir(`${API}/programas`);
    const tbody = $('tbodyProgramas');
    tbody.replaceChildren();

    programas.forEach((p) => {
        const tr = document.createElement('tr');
        celda(tr, p.nombre);
        celda(tr, p.estado, claseEstado(p.estado));
        celda(tr, textoEntrega(p.entrega));
        const td = document.createElement('td');
        const b = document.createElement('button');
        b.className = 'btn';
        b.textContent = 'Eliminar';
        b.onclick = async () => {
            if (!confirm(`¿Sacar al beneficiario de "${p.nombre}"?`)) return;
            try {
                await pedir(`${API}/programas/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
                await cargarProgramas();
            } catch (e) { aviso(e.message); }
        };
        td.appendChild(b);
        tr.appendChild(td);
        tbody.appendChild(tr);
    });

    // Última fila: registrar en otro programa
    const tr = document.createElement('tr');
    tr.className = 'fila-registrar';
    const td = document.createElement('td');
    td.colSpan = 4;
    const btn = document.createElement('button');
    btn.className = 'btn-primario';
    btn.style.width = 'auto';
    btn.style.padding = '0 16px';
    btn.textContent = 'Registrar en otro programa';
    btn.onclick = () => mostrarSelector(td, programas);
    td.appendChild(btn);
    tr.appendChild(td);
    tbody.appendChild(tr);
}

/* GET /api/programas -> [{ id, nombre, ... }] */
async function mostrarSelector(td, actuales) {
    try {
        const todos = await pedir('/api/programas');
        const ids = new Set(actuales.map((p) => String(p.id)));
        const disponibles = todos.filter((p) => !ids.has(String(p.id)));
        td.replaceChildren();
        if (!disponibles.length) { td.textContent = 'No hay más programas disponibles.'; return; }
        const sel = document.createElement('select');
        disponibles.forEach((p) => sel.add(new Option(p.nombre, p.id)));
        const ok = document.createElement('button');
        ok.className = 'btn-primario';
        ok.style.width = 'auto';
        ok.style.padding = '0 16px';
        ok.textContent = 'Registrar';
        ok.onclick = async () => {
            try {
                await pedir(`${API}/programas`, {
                    method: 'POST',
                    body: JSON.stringify({ programa_id: sel.value }),
                });
                await cargarProgramas();
            } catch (e) { aviso(e.message); }
        };
        td.append(sel, ok);
    } catch (e) { aviso(e.message); }
}

/* Documentos: [{ tipo, nombre_archivo, url }] */
async function cargarDocumentos() {
    const docs = await pedir(`${API}/documentos`);
    const ul = $('listaDocumentos');
    ul.replaceChildren();
    if (!docs.length) {
        const li = document.createElement('li');
        li.className = 'estado-vacio';
        li.textContent = 'No hay documentos subidos.';
        ul.appendChild(li);
        return;
    }
    docs.forEach((d) => {
        const li = document.createElement('li');
        const info = document.createElement('div');
        info.textContent = d.tipo ?? '';
        const small = document.createElement('small');
        small.textContent = d.nombre_archivo ?? '';
        info.appendChild(small);
        const ver = document.createElement('button');
        ver.className = 'btn';
        ver.textContent = 'Ver';
        ver.onclick = () => abrirSeguro(d.url);
        li.append(info, ver);
        ul.appendChild(li);
    });
}

$('btnCerrar').onclick = () => window.close();

if (!ID) {
    aviso('Falta el ID del beneficiario.');
} else {
    cargarUsuario();
    Promise.all([cargarPerfil(), cargarProgramas(), cargarDocumentos()]).catch((e) => aviso(e.message));
}