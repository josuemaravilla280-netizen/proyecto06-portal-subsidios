// Uso: beneficiario.html?id=123
const ID = new URLSearchParams(location.search).get('id');
const API = `/api/beneficiarios/${encodeURIComponent(ID)}`;
const $ = (id) => document.getElementById(id);

function aviso(texto, tipo = 'error') {
  const m = $('mensaje');
  m.textContent = texto;
  m.className = `mensaje visible ${tipo}`;
}

async function pedir(url, opciones) {
  const r = await fetch(url, { credentials: 'same-origin', ...opciones });
  if (!r.ok) throw new Error(`Error ${r.status}`);
  return r.status === 204 ? null : r.json();
}

function celda(tr, texto, clase) {
  const td = document.createElement('td');
  td.textContent = texto;
  if (clase) td.className = clase;
  tr.appendChild(td);
  return td;
}

/* Perfil: { nombre, departamento, municipio, direccion, edad, numero_documento, numero_pasaporte, imagen_documento } */
async function cargarPerfil() {
  const p = await pedir(API);
  $('pNombre').textContent = p.nombre ?? '';
  $('pUbicacion').textContent = [p.departamento, p.municipio].filter(Boolean).join(' / ');
  $('pDireccion').textContent = p.direccion ?? '';
  $('pEdad').textContent = p.edad ?? '';
  $('pDocumento').textContent = p.numero_documento ?? '';
  $('pPasaporte').textContent = p.numero_pasaporte ?? '';
  $('imgDocumento').src = p.imagen_documento || `${API}/imagen-documento`;
  document.title = `${p.nombre} - Portal de Subsidios`;
}

/* Programas: [{ id, nombre, estado: activo|finalizado|cancelado,
   entrega: { estado: recibido|no_recibido|no_enviado, cantidad, retraso } }] */
function textoEntrega(e) {
  if (!e) return '';
  if (e.estado === 'recibido') return 'último paquete recibido';
  const n = e.cantidad ?? 1;
  const uno = n === 1;
  const motivo = e.estado === 'no_enviado' ? 'enviado' : 'recibido';
  return `${n} ${uno ? 'paquete no ha' : 'paquetes no han'} sido ${motivo}${uno ? '' : 's'} en ${e.retraso}`;
}

async function cargarProgramas() {
  const programas = await pedir(`${API}/programas`);
  const tbody = $('tbodyProgramas');
  tbody.replaceChildren();

  programas.forEach((p) => {
    const tr = document.createElement('tr');
    celda(tr, p.nombre);
    celda(tr, p.estado, `estado-${p.estado}`);
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

/* GET /api/programas -> [{ id, nombre }] */
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
          headers: { 'Content-Type': 'application/json' },
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
  docs.forEach((d) => {
    const li = document.createElement('li');
    const info = document.createElement('div');
    info.textContent = d.tipo;
    const small = document.createElement('small');
    small.textContent = d.nombre_archivo ?? '';
    info.appendChild(small);
    const ver = document.createElement('button');
    ver.className = 'btn';
    ver.textContent = 'Ver';
    ver.onclick = () => window.open(d.url, '_blank', 'noopener');
    li.append(info, ver);
    ul.appendChild(li);
  });
}

$('btnCerrar').onclick = () => window.close();

if (!ID) {
  aviso('Falta el ID del beneficiario.');
} else {
  Promise.all([cargarPerfil(), cargarProgramas(), cargarDocumentos()]).catch((e) => aviso(e.message));
}
