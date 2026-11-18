// Uso: beneficiario.html?id=<uuid de cuentas_beneficiarios_ed>
const ID = new URLSearchParams(location.search).get('id');
const API = `/api/beneficiarios/${encodeURIComponent(ID)}`;
// en este element salen los errores
const p_mensaje = $('mensaje');


let usuario = null; // sesión actual (/api/auth/me)
let perfil = null;  // datos cargados del beneficiario
const esStaff = () => ['admin', 'operador'].includes(usuario?.rol);

// Estados de inscripción que indican quién la retiró (no se borra ningún registro).
const RETIROS = {
    retirarB: 'Retirado por el beneficiario',
    retirarS: 'Retirado por el personal',
};


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
        else mensaje(p_mensaje ,'Enlace no válido.');
    } catch {
        mensaje(p_mensaje ,'Enlace no válido.');
    }
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

/* Perfil: { nombre, departamento, municipio, direccion, edad, numero_documento, numero_pasaporte, imagen_documento, fecha_nacimiento, estado_cuenta, datos (jsonb de la cuenta) } */
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
    perfil = p;
    $('pNombre').textContent = p.nombre ?? '';
    $('pUbicacion').textContent = [p.departamento, p.municipio].filter(Boolean).join(' / ');
    $('pDireccion').textContent = p.direccion ?? '';
    $('pEdad').textContent = p.edad ?? '';
    $('pDocumento').textContent = p.numero_documento ?? '';
    $('pPasaporte').textContent = p.numero_pasaporte ?? '';
    $('pNacimiento').textContent = formatear(p.fecha_nacimiento);
    $('pTelefono').textContent = formatear(p.telefono);
    $('pCorreo').textContent = formatear(p.correo);
    $('pEstadoCuenta').textContent = formatear(p.estado_cuenta);
    // Lo ya mostrado en otras partes de la página no se repite.
    llenarLista($('pExtras'), aplanar(p.datos, ['municipio', 'direccion', 'imagen_documento', 'documentos']));
    document.title = `${p.nombre} - Portal de Subsidios`;
    $('btnInactivar').classList.toggle('oculto', !(esStaff() && p.estado_cuenta !== 'inactivada'));

    const img = $('imgDocumento');
    if (p.imagen_documento) {
        img.onerror = sinImagen;
        img.src = p.imagen_documento;
    } else {
        sinImagen();
    }
}

/* Programas: [{ id, nombre, estado, entrega: { estado: recibido|no_recibido|no_enviado, cantidad, retraso } | null, fecha_solicitud, estado_inscripcion, datos (jsonb de la inscripción) }] */
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
        const retiro = RETIROS[p.estado_inscripcion];
        if (retiro) {
            td.textContent = retiro; // inscripción ya retirada: se conserva con su estado
        } else if (puedeEditar()) { // personal, o el beneficiario en su propio perfil
            const b = document.createElement('button');
            b.className = 'btn';
            b.textContent = 'Retirar';
            b.onclick = async () => {
                if (!confirm(`¿Retirar la inscripción en "${p.nombre}"?`)) return;
                try {
                    const r = await pedir(`${API}/programas/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
                    await cargarProgramas();
                    mensaje(p_mensaje ,r.mensaje || 'Inscripción retirada.', 'exito');
                } catch (e) { mensaje(p_mensaje ,e.message); }
            };
            td.appendChild(b);
        }
        tr.appendChild(td);
        tbody.appendChild(tr);

        // Parte desplegable: el resto de los datos de inscripciones_ed.
        const trDet = document.createElement('tr');
        const tdDet = document.createElement('td');
        tdDet.colSpan = 4;
        const det = document.createElement('details');
        const sum = document.createElement('summary');
        sum.textContent = `Datos de la inscripción en "${p.nombre}"`;
        const ul = document.createElement('ul');
        ul.className = 'datos-lista';
        llenarLista(ul, [
            ['Fecha de solicitud', formatear(p.fecha_solicitud)],
            ['Estado de la inscripción', formatear(RETIROS[p.estado_inscripcion] ?? p.estado_inscripcion)],
            ...aplanar(p.datos, ['entrega.estado', 'entrega.cantidad']),
        ]);
        det.append(sum, ul);
        tdDet.appendChild(det);
        trDet.appendChild(tdDet);
        tbody.appendChild(trDet);
    });
    if (!esStaff()) return; // solo el personal registra en programas

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
    btn.onclick = () => mostrarSelector(td, programas.filter((p) => !RETIROS[p.estado_inscripcion]));
    td.appendChild(btn);
    tr.appendChild(td);
    tbody.appendChild(tr);
}

/* GET /api/programas -> [{ id, nombre, ... }] */
async function mostrarSelector(td, actuales) {
    try {
        const todos = await pedir('/api/programas');
        const ids = new Set(actuales.map((p) => String(p.id)));
        const disponibles = todos.filter((p) => !ids.has(String(p.id)) && p.estado !== 'cancelado_incompletado');
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
            } catch (e) { mensaje(p_mensaje ,e.message); }
        };
        td.append(sel, ok);
    } catch (e) { mensaje(p_mensaje ,e.message); }
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

/* ---------- Edición ---------- */
// Personal: cualquier beneficiario. Beneficiario: solo el suyo (si /me informa el id se compara;
// si no, lo decide el servidor con 403).
function puedeEditar() {
    if (!usuario) return false;
    if (esStaff()) return true;
    return usuario.rol === 'beneficiario' && (usuario.id === undefined || String(usuario.id) === ID);
}

async function abrirEdicion() {
    if (!perfil) return;
    try {
        await cargarCatalogos();
    } catch (e) { return mensaje(p_mensaje ,e.message); }

    const d = {
        id: ID,
        nombre: perfil.nombres,
        apellido: perfil.apellido,
        documento_unico: perfil.documento_unico,
        nacimiento: perfil.fecha_nacimiento,
        telefono: perfil.telefono,
        correo: perfil.correo,
        departamento_id: perfil.departamento_id,
        municipio: perfil.municipio,
        direccion: perfil.direccion,
    };

    const panel = $('panelEdicion');
    panel.innerHTML = `<h2>Editar beneficiario</h2>${formBeneficiario(d)}`;
    panel.classList.remove('oculto');
    $('formBeneficiario').addEventListener('submit', guardarBeneficiario);
    $('cancelarBeneficiario').addEventListener('click', cerrarEdicion);
    panel.scrollIntoView({ behavior: 'smooth' });
}

function cerrarEdicion() {
    const panel = $('panelEdicion');
    panel.classList.add('oculto');
    panel.replaceChildren();
}

async function guardarBeneficiario(e) {
    e.preventDefault();
    try {
        const r = await enviarJSON(API, 'PUT', valoresFormulario(e.currentTarget));
        cerrarEdicion();
        await cargarPerfil();
        mensaje(p_mensaje ,r.mensaje || 'Información actualizada.', 'exito');
    } catch (err) { mensaje(p_mensaje ,err.message); }
}

$('btnEditar').onclick = abrirEdicion;

// No se elimina la cuenta: su estado pasa a 'inactivada'.
$('btnInactivar').onclick = async () => {
    if (!confirm('¿Inactivar la cuenta de este beneficiario?')) return;
    try {
        const r = await pedir(API, { method: 'DELETE' });
        await cargarPerfil();
        mensaje(p_mensaje ,r.mensaje || 'Cuenta inactivada.', 'exito');
    } catch (e) { mensaje(p_mensaje ,e.message); }
};
$('btnCerrar').onclick = () => window.close();

if (!ID) {
    mensaje(p_mensaje ,'Falta el ID del beneficiario.');
} else {
    (async () => {
        await cargarUsuario(); // el rol define qué botones se muestran
        if (puedeEditar()) $('btnEditar').classList.remove('oculto');
        await Promise.all([cargarPerfil(), cargarProgramas(), cargarDocumentos()]);
    })().catch((e) => mensaje(p_mensaje ,e.message));
}