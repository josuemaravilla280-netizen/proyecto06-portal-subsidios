// Uso: inscribirse_en.html?id=<id del programa>
// Pide el programa, la cuenta del beneficiario y sus documentos, y arma el formulario de inscripción.
const ID = new URLSearchParams(location.search).get('id');
const $ = (id) => document.getElementById(id);

let usuario = null;
// Lo que se está llenando: lo usan la subida de documentos y la validación del envío.
let inscripcion = { programa: null, cuenta: null, documentos: [] };

function aviso(texto, tipo = 'error') {
    mensaje($('mensaje'), texto, tipo);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// El servidor responde { ok, datos } o { ok, dato } y, en error, { ok:false, mensaje }.
async function pedir(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.mensaje || `Error ${r.status}`);
    return j.datos ?? j.dato ?? j;
}

/* ---------- Utilidades ---------- */
const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const urlSegura = (u) => (/^(https?:\/\/|\/(?!\/))/.test(String(u || '')) ? String(u) : '');
const esImagen = (d) => /\.(png|jpe?g|gif|webp)$/i.test(d.nombre_archivo || '') || /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(d.url || '');

// De dónde se toma cada dato de la cuenta (cuenta = respuesta de GET /api/beneficiarios/:id).
const VALOR_CUENTA = {
    identificacion: (c) => {
        const nombre = `${c.nombres ?? ''} ${c.apellido ?? ''}`.trim();
        const documento = c.numero_documento ? `DUI ${c.numero_documento}`
            : c.numero_pasaporte ? `Pasaporte ${c.numero_pasaporte}` : '';
        return [nombre, documento].filter(Boolean).join(' · ');
    },
    nacimiento: (c) => c.fecha_nacimiento,
    telefono: (c) => c.telefono,
    correo: (c) => c.correo,
    departamento: (c) => c.departamento,
    municipio: (c) => c.municipio,
    direccion: (c) => c.direccion,
};

const requisitosDe = (tipo) => (inscripcion.programa.requisitos || []).filter((r) => r.tipo === tipo);
const documentoDe = (requisito) =>
    inscripcion.documentos.find((d) => normalizar(d.tipo) === normalizar(requisito.nombre));

/* ---------- Piezas del formulario ---------- */
// Campo para un requisito (texto, número, fecha, selección o sí/no).
function campoRequisito(r, i) {
    const id = `requisito_${i}`;
    const requerido = r.obligatorio ? 'required' : '';
    let control;
    if (r.tipo === 'booleano' || r.tipo === 'seleccion') {
        const lista = r.tipo === 'booleano' ? ['Sí', 'No'] : (r.opciones || []);
        control = `<select id="${id}" name="${id}" ${requerido}>${opciones(lista.map((x) => [x, x]))}</select>`;
    } else {
        const tipo = { texto: 'text', numero: 'number', fecha: 'date' }[r.tipo] || 'text';
        control = `<input id="${id}" name="${id}" type="${tipo}" ${requerido}>`;
    }
    return `
    <div class="field">
      <label for="${id}">${escapar(r.nombre)}${r.obligatorio ? ' *' : ''}</label>
      ${control}
    </div>
  `;
}

// Filas de la tabla de documentos: los que ya tiene subidos y, si falta alguno, la opción de subirlo.
function htmlFilasDocumentos() {
    return requisitosDe('archivo').map((r) => {
        const doc = documentoDe(r);
        const nombre = `${escapar(r.nombre)}${r.obligatorio ? ' *' : ''}`;
        if (doc) {
            return `
        <tr>
          <td>${nombre}</td>
          <td>Subido${doc.nombre_archivo ? ` (${escapar(doc.nombre_archivo)})` : ''}</td>
          <td><button type="button" class="btn ver-documento" data-url="${escapar(urlSegura(doc.url))}">Ver</button></td>
        </tr>`;
        }
        return `
        <tr>
          <td>${nombre}</td>
          <td>No tiene este documento subido. Súbalo para continuar.</td>
          <td>
            <input type="file" accept="image/png,image/jpeg,application/pdf">
            <button type="button" class="btn subir-documento" data-tipo="${escapar(r.nombre)}">Subir</button>
          </td>
        </tr>`;
    }).join('');
}

// Imágenes de los documentos ya subidos (van al final de la página).
function htmlImagenesDocumentos() {
    const subidos = requisitosDe('archivo').map(documentoDe).filter(Boolean);
    if (!subidos.length) return '';
    return `
    <h3>Documentos adjuntos</h3>
    <div style="display:grid;gap:16px">
      ${subidos.map((d) => {
        const url = urlSegura(d.url);
        if (!url) return '';
        return esImagen(d)
            ? `<figure>
                 <img src="${escapar(url)}" alt="${escapar(d.tipo)}" style="max-width:100%;border:1px solid #667184;border-radius:8px;background:#1a2332">
                 <figcaption style="margin-top:6px;font-size:0.8rem;color:#94a3b8">${escapar(d.tipo)}</figcaption>
               </figure>`
            : `<p>${escapar(d.tipo)}: <a href="${escapar(url)}" target="_blank" rel="noopener" style="color:#9fc3ff">Abrir ${escapar(d.nombre_archivo || 'archivo')}</a></p>`;
    }).join('')}
    </div>
  `;
}

function refrescarDocumentos() {
    $('filasDocumentos').innerHTML = htmlFilasDocumentos();
    $('imagenesInscripcion').innerHTML = htmlImagenesDocumentos();
}

/* ---------- Formulario ---------- */
// programa: { id, nombre, requisitos }  |  cuenta: GET /api/beneficiarios/:id
// documentos: GET /api/beneficiarios/:id/documentos
function formInscripcion(programa, cuenta, documentos = []) {
    inscripcion = { programa, cuenta, documentos: [...documentos] };
    const requisitos = programa.requisitos || [];
    const deCuenta = requisitosDe('cuenta');
    const aIngresar = requisitos.map((r, i) => [r, i]).filter(([r]) => !['cuenta', 'archivo'].includes(r.tipo));
    const hayArchivos = requisitosDe('archivo').length > 0;

    return `
    <form id="formInscripcion">

      ${requisitos.length ? '' : '<p class="estado-vacio">Este programa no tiene requisitos específicos configurados.</p>'}

      ${deCuenta.length ? `
        <section class="section">
          <h3>Datos tomados de su cuenta</h3>
          <div class="tabla-contenedor">
            <table>
              <thead><tr><th>Dato</th><th>Valor</th></tr></thead>
              <tbody>
                ${deCuenta.map((r) => `
                  <tr>
                    <td>${escapar(CAMPOS_CUENTA[r.campo] || r.nombre)}</td>
                    <td>${escapar(VALOR_CUENTA[r.campo]?.(cuenta) || 'Sin dato')}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <p class="notice">Si algún dato es incorrecto, actualícelo en su perfil antes de enviar.</p>
        </section>` : ''}

      ${aIngresar.length ? `
        <section class="section">
          <h3>Datos que debe ingresar</h3>
          <div class="form-grid">${aIngresar.map(([r, i]) => campoRequisito(r, i)).join('')}</div>
        </section>` : ''}

      ${hayArchivos ? `
        <section class="section">
          <h3>Documentos</h3>
          <div class="tabla-contenedor">
            <table>
              <thead><tr><th>Documento</th><th>Estado</th><th>Acción</th></tr></thead>
              <tbody id="filasDocumentos">${htmlFilasDocumentos()}</tbody>
            </table>
          </div>
        </section>` : ''}

      <div class="actions">
        <button type="submit" class="btn-primario">Enviar solicitud</button>
        <button type="button" class="btn" id="cancelarInscripcion">Cancelar</button>
      </div>

      ${hayArchivos ? `<section class="section" id="imagenesInscripcion">${htmlImagenesDocumentos()}</section>` : ''}
    </form>
  `;
}

// Respuestas del beneficiario listas para enviar. Lanza un Error si falta un documento obligatorio.
function valoresInscripcion(form) {
    const respuestas = {};
    (inscripcion.programa.requisitos || []).forEach((r, i) => {
        if (r.tipo === 'cuenta') return;
        if (r.tipo === 'archivo') {
            if (r.obligatorio && !documentoDe(r)) throw new Error(`Falta subir el documento: ${r.nombre}.`);
            return;
        }
        const valor = (form.elements[`requisito_${i}`]?.value ?? '').trim();
        if (valor) respuestas[r.nombre] = valor;
    });
    return { respuestas };
}

/* ---------- Acciones ---------- */
// Ver y subir documentos.
async function accionDocumento(e) {
    const boton = e.target.closest('.ver-documento, .subir-documento');
    if (!boton) return;

    if (boton.classList.contains('ver-documento')) {
        if (boton.dataset.url) window.open(boton.dataset.url, '_blank', 'noopener');
        return;
    }

    const archivo = boton.closest('tr').querySelector('input[type="file"]').files[0];
    if (!archivo) return aviso('Seleccione un archivo para subir.');

    try {
        // El cuerpo es el archivo; el tipo de documento y el nombre van en cabeceras.
        const r = await fetch(`/api/beneficiarios/${encodeURIComponent(inscripcion.cuenta.id)}/documentos`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': archivo.type,
                'X-Tipo-Documento': encodeURIComponent(boton.dataset.tipo),
                'X-Nombre-Archivo': encodeURIComponent(archivo.name),
            },
            body: archivo,
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.mensaje || `Error ${r.status}`);
        inscripcion.documentos.push(j.dato);
        refrescarDocumentos();
        aviso(j.mensaje || 'Documento subido.', 'exito');
    } catch (err) {
        aviso(err.message);
    }
}

async function enviarSolicitud(e) {
    e.preventDefault();
    try {
        const cuerpo = valoresInscripcion(e.currentTarget);
        const r = await enviarJSON(
            `/api/inscripciones/${encodeURIComponent(usuario.id)}/${encodeURIComponent(ID)}`,
            'POST',
            cuerpo
        );
        $('contenido').innerHTML = `
          <h2>Solicitud enviada</h2>
          <p>Su solicitud de inscripción en "${escapar(inscripcion.programa.nombre)}" quedó en espera de revisión.</p>`;
        aviso(r.mensaje || 'Solicitud enviada.', 'exito');
    } catch (err) {
        aviso(err.message);
    }
}

/* ---------- Inicio ---------- */
async function iniciar() {
    const sesion = await pedir('/api/auth/me');
    usuario = sesion.usuario;
    if (!usuario) throw new Error('Inicie sesión para inscribirse.');
    $('datosUsuario').textContent = `${usuario.nombre} · Rol: ${usuario.rol}`;
    if (usuario.rol !== 'beneficiario') throw new Error('Solo un beneficiario puede solicitar su inscripción.');
    if (!usuario.id) throw new Error('No se pudo identificar su cuenta.');

    const base = `/api/beneficiarios/${encodeURIComponent(usuario.id)}`;
    const [programa, cuenta, documentos] = await Promise.all([
        pedir(`/api/programas/${encodeURIComponent(ID)}`),
        pedir(base),
        pedir(`${base}/documentos`),
    ]);

    $('tPrograma').textContent = `Inscribirse en ${programa.nombre}`;
    document.title = `Inscribirse en ${programa.nombre} - Portal de Subsidios`;
    if (programa.estado === 'cancelado_incompletado') throw new Error('El programa está cancelado.');

    const contenido = $('contenido');
    contenido.innerHTML = formInscripcion(programa, cuenta, documentos);
    $('formInscripcion').addEventListener('submit', enviarSolicitud);
    $('cancelarInscripcion').addEventListener('click', () => window.close());
    contenido.addEventListener('click', accionDocumento);
}

$('btnCerrar').onclick = () => window.close();

if (!ID) {
    aviso('Falta el ID del programa.');
    $('contenido').replaceChildren();
} else {
    iniciar().catch((e) => {
        $('contenido').replaceChildren();
        aviso(e.message);
    });
}
