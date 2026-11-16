// Formularios de edición usados por los dashboards (beneficiario y programa).
// Se carga antes del script de cada dashboard.

// Evita que los valores ingresados se interpreten como HTML.
function escapar(valor = '') {
  return String(valor).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

const valoresFormulario = (form) => Object.fromEntries(new FormData(form).entries());

/* ---------- Catálogos (GET /api/catalogos) ---------- */
let catalogos = { departamentos: [], entidades: [], tipos: [], estados: [], periodicidades: [] };

async function cargarCatalogos() {
  const r = await fetch('/api/catalogos', { credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.mensaje || `Error ${r.status}`);
  catalogos = j.dato;
}

// [{id, nombre}] -> [[valor, texto]] para opciones()
const deCatalogo = (lista) => lista.map((x) => [String(x.id), x.nombre]);

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

function opciones(lista, seleccionado = '') {
  return `
    <option value="">Seleccione...</option>
    ${lista.map(([valor, texto]) => `
      <option value="${escapar(valor)}" ${seleccionado === valor ? 'selected' : ''}>${escapar(texto)}</option>
    `).join('')}
  `;
}

/* ---------- Beneficiario ----------
   d: { id, nombre, apellido, documento_unico, nacimiento, telefono, correo,
        departamento_id, municipio, direccion } */
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
          <input id="municipio" name="municipio" value="${escapar(d.municipio || '')}" required>
        </div>

        <div class="field">
          <label for="direccion">Dirección de residencia *</label>
          <input id="direccion" name="direccion" value="${escapar(d.direccion || '')}" required>
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
        zonas [ids], criterios [], documentos } */
function formPrograma(d = {}) {
  const unidades = ['Paquete / kit', 'Unidad', 'Saco', 'Litro', 'Libras', 'Metros'];
  const zonas = (d.zonas || []).map(Number);
  const criterios = d.criterios || ['unidad', 'residencia', 'declaracion', 'consentimiento'];
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

        ${campo('Clave correlativa', 'claveCorrelativa', d.claveCorrelativa, 'text', 'Se genera automáticamente', 'readonly')}

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
            <label for="zonas">Zonas habilitadas * (Ctrl+clic para varias)</label>
            <select id="zonas" name="zonas" multiple required size="7">
              ${catalogos.departamentos.map((x) => `
                <option value="${x.id}" ${zonas.includes(Number(x.id)) ? 'selected' : ''}>${escapar(x.nombre)}</option>
              `).join('')}
            </select>
          </div>

        </div>
      </section>

      <section class="section">
        <h3>Criterios de elegibilidad</h3>

        ${[
          ['unidad', 'Unidad productiva registrada y validada'],
          ['residencia', 'Residencia o actividad en una zona habilitada'],
          ['declaracion', 'Declaración de pequeña producción documentada'],
          ['consentimiento', 'Consentimiento para tratamiento de datos vigente'],
        ].map(([valor, texto]) => `
          <label class="check">
            <input type="checkbox" name="criterios" value="${valor}" ${criterios.includes(valor) ? 'checked' : ''}>
            <span>${texto}</span>
          </label>
        `).join('')}

        <div class="field">
          <label for="documentos">Documentos requeridos *</label>
          <textarea id="documentos" name="documentos" required placeholder="Documentos necesarios">${escapar(d.documentos || '')}</textarea>
        </div>
      </section>

      <div class="actions">
        <button type="submit" class="btn-primario">${d.id ? 'Guardar cambios' : 'Crear programa'}</button>
        <button type="button" class="btn" id="cancelarPrograma">Cancelar</button>
      </div>

    </form>
  `;
}

// Valores de un formulario de programa listos para enviar (zonas y criterios como arreglos).
function valoresPrograma(form) {
  const datos = valoresFormulario(form);
  datos.zonas = Array.from(form.elements.zonas.selectedOptions, (o) => o.value);
  datos.criterios = [...form.querySelectorAll('input[name="criterios"]:checked')].map((c) => c.value);
  return datos;
}