// esto se  carga antes del script de cada dashboard y de app.js.

const valoresFormulario = (form) => Object.fromEntries(new FormData(form).entries());

/* ---------- Envío (devuelve la respuesta completa, con `mensaje`) ---------- */
async function enviarJSON(url, metodo, cuerpo) {
    const r = await fetch(url, {
        method: metodo,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.mensaje || `Error ${r.status}`);
    return j;
}

/* ---------- Piezas de formulario ---------- */
function campo(label, name, value = '', type = 'text', placeholder = '', extra = '') {
    return `
    <div class="field">
      <label for="${name}">${label} *</label>
      <input
        id="${name}"
        name="${name}"
        type="${type}"
        value="${escapar(value ?? '')}"
        ${placeholder ? `placeholder="${escapar(placeholder)}"` : ''}
        ${extra}
        ${extra.includes('readonly') ? '' : 'required'}
      >
    </div>
  `;
}

// Genera las opciones de un elemento select.
function opciones(lista, seleccionado = '') {
    return `
    <option value="">Seleccione...</option>
    ${lista.map(([valor, texto]) => `
      <option value="${escapar(valor)}" ${seleccionado === valor ? 'selected' : ''}>${escapar(texto)}</option>
    `).join('')}
  `;
}

// <option> de los municipios del departamento elegido (ninguno si no hay departamento).
function opcionesMunicipios(departamentoId, seleccionado = '') {
    const lista = (catalogos.municipios || []).filter(
        (m) => departamentoId && String(m.departamento_id) === String(departamentoId)
    );
    return `
    <option value="">${departamentoId ? 'Seleccione...' : 'Seleccione un departamento'}</option>
    ${lista.map((m) => `
      <option value="${m.id}" ${String(seleccionado) === String(m.id) ? 'selected' : ''}>${escapar(m.nombre)}</option>
    `).join('')}
  `;
}

// cualquier formulario que tenga #departamento y #municipio, sin importar cuándo se inserte en la página.
document.addEventListener('change', (e) => {
    const departamento = e.target;
    if (departamento.id !== 'departamento' || !departamento.form) return;
    const municipio = departamento.form.elements.municipio;
    if (municipio) municipio.innerHTML = opcionesMunicipios(departamento.value);
});

/* ---------- Beneficiario ----------
   d: { id, nombre, apellido, documento_unico, nacimiento, telefono, correo,
        departamento_id, municipio_id, direccion } */
function formBeneficiario(d = {}) {
    return `
    <form id="formBeneficiario">
      <div class="form-grid">

        <div class="field">
          <label for="nombre">Nombres *</label>
          <input id="nombre" name="nombre" value="${escapar(d.nombre || '')}" required>
        </div>

        <div class="field">
          <label for="apellido">Apellidos *</label>
          <input id="apellido" name="apellido" value="${escapar(d.apellido || '')}" required>
        </div>

        <div class="field">
          <label for="documento_unico">DUI o pasaporte *</label>
          <input
            id="documento_unico"
            name="documento_unico"
            value="${escapar(d.documento_unico || '')}"
            placeholder="01234567-8"
            ${d.id ? 'readonly' : ''}
            required
          >
        </div>

        <div class="field">
          <label for="nacimiento">Fecha de nacimiento *</label>
          <input
            id="nacimiento"
            name="nacimiento"
            type="date"
            max="${new Date().toISOString().slice(0, 10)}"
            value="${escapar(String(d.nacimiento || '').slice(0, 10))}"
            required
          >
        </div>

        <div class="field">
          <label for="telefono">Teléfono *</label>
          <input id="telefono" name="telefono" type="tel" value="${escapar(d.telefono || '')}" required>
        </div>

        <div class="field">
          <label for="correo">Correo electrónico</label>
          <input id="correo" name="correo" type="email" value="${escapar(d.correo || '')}">
        </div>

        <div class="field">
          <label for="departamento">Departamento *</label>
          <select id="departamento" name="departamento" required>
            <option value="">Seleccione...</option>
            ${catalogos.departamentos.map((x) => `
              <option value="${x.id}" ${String(d.departamento_id) === String(x.id) ? 'selected' : ''}>${escapar(x.nombre)}</option>
            `).join('')}
          </select>
        </div>

        <div class="field">
          <label for="municipio">Municipio *</label>
          <select id="municipio" name="municipio" required>
            ${opcionesMunicipios(d.departamento_id, d.municipio_id)}
          </select>
        </div>

        <div class="field">
          <label for="direccion">Dirección de residencia *</label>
          <input id="direccion" name="direccion" maxlength="250" value="${escapar(d.direccion || '')}" required>
        </div>

      </div>

      <div class="actions">
        <button class="btn-primario" type="submit">
          ${d.id ? 'Guardar actualización' : 'Registrar beneficiario'}
        </button>
        <button class="btn" id="cancelarBeneficiario" type="button">Cancelar</button>
      </div>
    </form>
  `;
}

/* ---------- Programa ----------
   d: { id, nombre, entidad, tipo_id, estado_id, estado, descripcion, cantidad, unidad, cupos, monto,
        claveCorrelativa, composicion, fechaInicio, fechaCierre, periodo, periodicidad_id,
        zonas [ids], requisitos [] } */
function formPrograma(d = {}) {
    const unidades = ['Paquete / kit', 'Unidad', 'Saco', 'Litro', 'Libras', 'Metros'];
    const zonas = (d.zonas || []).map(Number);
    const fecha = (v) => String(v || '').slice(0, 10);

    return `
    <form id="formPrograma">

      <header class="form-header">
        <div>
          <h3>${d.id ? 'EDITAR PROGRAMA' : 'NUEVO BENEFICIO'}</h3>
          <p class="subtitle">
            ${d.claveCorrelativa ? escapar(d.claveCorrelativa) : 'Clave correlativa generada al guardar'}
          </p>
        </div>
        <span class="status">${escapar(d.estado || 'En revisión')}</span>
      </header>

      <div class="form-grid">

        ${campo('Nombre del programa', 'nombre', d.nombre, 'text', 'Ej. Cosecha Activa')}

        <div class="field">
          <label for="entidad">Entidad responsable *</label>
          <select id="entidad" name="entidad" required>
            ${opciones(deCatalogo(catalogos.entidades), String(d.entidad ?? ''))}
          </select>
        </div>

        <div class="field">
          <label for="tipo">Tipo de beneficio *</label>
          <select id="tipo" name="tipo" required>
            ${opciones(deCatalogo(catalogos.tipos), String(d.tipo_id ?? ''))}
          </select>
        </div>

        <div class="field">
          <label for="estado">Estado *</label>
          <select id="estado" name="estado" required>
            ${opciones(deCatalogo(catalogos.estados), String(d.estado_id ?? ''))}
          </select>
        </div>

        <div class="field full">
          <label for="descripcion">Descripción del beneficio *</label>
          <textarea id="descripcion" name="descripcion" required placeholder="Describa el beneficio">${escapar(d.descripcion || '')}</textarea>
        </div>

        ${campo('Cantidad por asignación', 'cantidad', d.cantidad, 'number', 'Cantidad', 'min="1"')}

        <div class="field">
          <label for="unidad">Unidad de entrega *</label>
          <select id="unidad" name="unidad" required>
            ${opciones(unidades.map((x) => [x, x]), d.unidad)}
          </select>
        </div>

        ${campo('Cupos del período', 'cupos', d.cupos, 'number', '250', 'min="1"')}

        ${campo('Monto por asignación (USD)', 'monto', d.monto ?? 0, 'number', '0', 'min="0" step="0.01"')}

        <!--${campo('Clave correlativa', 'claveCorrelativa', d.claveCorrelativa, 'text', 'Se genera automáticamente', 'readonly')} -->
        <p>Se generara una clave correlativa</p>

        <div class="field full">
          <label for="composicion">Composición del paquete *</label>
          <textarea id="composicion" name="composicion" required placeholder="Describa el contenido del beneficio">${escapar(d.composicion || '')}</textarea>
        </div>

      </div>

      <section class="section">
        <h3>Período y cobertura</h3>

        <div class="form-grid">

          ${campo('Fecha de inicio', 'fechaInicio', fecha(d.fechaInicio), 'date')}
          ${campo('Fecha de cierre', 'fechaCierre', fecha(d.fechaCierre), 'date')}
          ${campo('Período de asignación', 'periodo', d.periodo, 'text', 'Ej. Campaña 2026')}

          <div class="field">
            <label for="periodicidad">Periodicidad *</label>
            <select id="periodicidad" name="periodicidad" required>
              ${opciones(deCatalogo(catalogos.periodicidades), String(d.periodicidad_id ?? ''))}
            </select>
          </div>

          <div class="field full">
            <label>Zonas habilitadas *</label>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:2px 16px">
              ${catalogos.departamentos.map((x) => `
                <label class="check">
                  <input type="checkbox" name="zonas" value="${x.id}" ${zonas.includes(Number(x.id)) ? 'checked' : ''}>
                  <span>${escapar(x.nombre)}</span>
                </label>
              `).join('')}
            </div>
          </div>

        </div>
      </section>

      <section class="section">
        <h3>Requisitos de inscripción</h3>
        <p class="notice">Defina qué debe aportar el beneficiario al inscribirse en el programa.</p>

        <div id="requisitos">
          ${(d.requisitos || []).map((r) => addRequisito(r)).join('')}
        </div>

        <p id="sinRequisitos" class="estado-vacio ${(d.requisitos || []).length ? 'oculto' : ''}">
          Este programa no tiene requisitos específicos configurados.
        </p>

        <button type="button" class="btn" id="agregarRequisito">+ Agregar requisito</button>
      </section>

      <div class="actions">
        <button type="submit" class="btn-primario">${d.id ? 'Guardar cambios' : 'Crear programa'}</button>
        <button type="button" class="btn" id="cancelarPrograma">Cancelar</button>
      </div>

    </form>
  `;
}

// Valores de un formulario de programa listos para enviar (zonas y requisitos como arreglos).
function valoresPrograma(form) {
    const datos = valoresFormulario(form);
    datos.zonas = [...form.querySelectorAll('input[name="zonas"]:checked')].map((c) => c.value);
    if (!datos.zonas.length) throw new Error('Seleccione al menos una zona habilitada.');
    datos.requisitos = leerRequisitos(form);
    // Campos de los paneles de requisito: ya van dentro de `requisitos`.
    ['nombreRequisito', 'tipoRequisito', 'opcionesRequisito', 'campoCuenta', 'obligatorio']
        .forEach((k) => delete datos[k]);
    return datos;
}

/* Requisitos
   Se guardan en programas_ed.requisitos:
   [{ nombre, tipo, obligatorio, opciones?, campo? }]
   tipo: texto | numero | fecha | seleccion | booleano | archivo | cuenta
   ===================================================================== */
const TIPOS_REQUISITO = [
    ['texto', 'Texto'],
    ['numero', 'Número'],
    ['fecha', 'Fecha'],
    ['seleccion', 'Selección'],
    ['booleano', 'Sí / No'],
    ['archivo', 'Documento (archivo)'],
    ['cuenta', 'Dato de la cuenta del beneficiario'],
];

// Datos de la cuenta que un requisito puede pedir (campo -> etiqueta).
// El formulario de inscripción (inscribirse_en.js) también usa esta lista.
const CAMPOS_CUENTA = {
    identificacion: 'Nombre completo y DUI o pasaporte',
    nacimiento: 'Fecha de nacimiento',
    telefono: 'Teléfono',
    correo: 'Correo electrónico',
    departamento: 'Departamento',
    municipio: 'Municipio',
    direccion: 'Dirección de residencia',
};

let contadorRequisitos = 0;

// Panel de un requisito (vacío o con los valores de `r`).
function addRequisito(r = {}) {
    const n = ++contadorRequisitos;
    const tipo = r.tipo || 'texto';
    return `
    <div class="panel-requisito" style="border:1px solid #667184;border-radius:9px;padding:13px;margin:10px 0;background:#303a4c">
      <div class="form-grid">

        <div class="field req-nombre ${tipo === 'cuenta' ? 'oculto' : ''}">
          <label for="reqNombre${n}">Nombre del requisito *</label>
          <input
            id="reqNombre${n}"
            name="nombreRequisito"
            value="${escapar(tipo === 'cuenta' ? '' : r.nombre || '')}"
            placeholder="Ej. Número de integrantes del hogar"
            maxlength="120"
            ${tipo === 'cuenta' ? '' : 'required'}
          >
        </div>

        <div class="field">
          <label for="reqTipo${n}">Tipo de campo</label>
          <select id="reqTipo${n}" name="tipoRequisito">
            ${TIPOS_REQUISITO.map(([valor, texto]) => `
              <option value="${valor}" ${tipo === valor ? 'selected' : ''}>${texto}</option>
            `).join('')}
          </select>
        </div>

        <div class="field full req-opciones ${tipo === 'seleccion' ? '' : 'oculto'}">
          <label for="reqOpc${n}">Opciones (separadas por coma) *</label>
          <input
            id="reqOpc${n}"
            name="opcionesRequisito"
            value="${escapar((r.opciones || []).join(', '))}"
            placeholder="Ej. Propia, Alquilada, Prestada"
            ${tipo === 'seleccion' ? 'required' : ''}
          >
        </div>

        <div class="field full req-cuenta ${tipo === 'cuenta' ? '' : 'oculto'}">
          <label for="reqCampo${n}">Dato que se toma de la cuenta *</label>
          <select id="reqCampo${n}" name="campoCuenta" ${tipo === 'cuenta' ? 'required' : ''}>
            ${opciones(Object.entries(CAMPOS_CUENTA), r.campo || '')}
          </select>
        </div>

      </div>

      <div class="actions">
        <label class="check">
          <input name="obligatorio" type="checkbox" ${r.obligatorio === false ? '' : 'checked'}>
          <span>Obligatorio</span>
        </label>
        <button type="button" class="btn eliminar-requisito">Eliminar requisito</button>
      </div>
    </div>
  `;
}

// Convierte los paneles del formulario en el arreglo `requisitos`.
function leerRequisitos(form) {
    return [...form.querySelectorAll('.panel-requisito')].map((panel) => {
        const tipo = panel.querySelector('[name="tipoRequisito"]').value;
        const obligatorio = panel.querySelector('[name="obligatorio"]').checked;

        if (tipo === 'cuenta') {
            const campo = panel.querySelector('[name="campoCuenta"]').value;
            return { nombre: CAMPOS_CUENTA[campo] || '', tipo, campo, obligatorio };
        }

        const requisito = {
            nombre: panel.querySelector('[name="nombreRequisito"]').value.trim(),
            tipo,
            obligatorio,
        };
        if (tipo === 'seleccion') {
            requisito.opciones = panel.querySelector('[name="opcionesRequisito"]').value
                .split(',').map((o) => o.trim()).filter(Boolean);
        }
        return requisito;
    });
}

function actualizarSinRequisitos(form) {
    const hay = form.querySelectorAll('.panel-requisito').length > 0;
    form.querySelector('#sinRequisitos')?.classList.toggle('oculto', hay);
}

// Agregar y eliminar paneles (un solo listener: sirve para cualquier formulario de programa).
document.addEventListener('click', (e) => {
    const boton = e.target.closest('#agregarRequisito, .eliminar-requisito');
    if (!boton) return;
    const form = boton.closest('form');
    if (boton.id === 'agregarRequisito') {
        form.querySelector('#requisitos').insertAdjacentHTML('beforeend', addRequisito());
    } else {
        boton.closest('.panel-requisito').remove();
    }
    actualizarSinRequisitos(form);
});

// Al cambiar el tipo, se muestran solo los campos que ese tipo necesita.
document.addEventListener('change', (e) => {
    if (e.target.name !== 'tipoRequisito') return;
    const panel = e.target.closest('.panel-requisito');
    const tipo = e.target.value;
    const mostrar = (selector, visible) => {
        const caja = panel.querySelector(selector);
        caja.classList.toggle('oculto', !visible);
        caja.querySelector('input, select').required = visible;
    };
    mostrar('.req-nombre', tipo !== 'cuenta');
    mostrar('.req-opciones', tipo === 'seleccion');
    mostrar('.req-cuenta', tipo === 'cuenta');
});