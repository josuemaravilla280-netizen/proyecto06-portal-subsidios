// Función para buscar elementos del HTML 
const $ = (selector) => document.querySelector(selector);

// Elementos principales de la aplicación.
const pantallaLogin = $('#pantallaLogin');
const panelApp = $('#panelApp');
const vista = $('#vista');
const mensajeLogin = $('#mensajeLogin');

// Variables que guardan el estado actual.
let usuarioActual = null;
let programaEditando = null;
let beneficiarioEditando = null;

// Departamentos disponibles para registrar beneficiarios.
const departamentos = [
  'Ahuachapán',
  'Cabañas',
  'Chalatenango',
  'Cuscatlán',
  'La Libertad',
  'La Paz',
  'La Unión',
  'Morazán',
  'San Miguel',
  'San Salvador',
  'San Vicente',
  'Santa Ana',
  'Sonsonate',
  'Usulután'
];


// Evita que los valores ingresados se interpreten como HTML.
function escapar(valor = '') {
  return String(valor).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

// Muestra un mensaje de error o de éxito.
function mensaje(elemento, texto, tipo = 'error') {
  elemento.textContent = texto;
  elemento.className = `mensaje visible ${tipo}`;
}

// Envía solicitudes al servidor y procesa las respuestas.
async function api(url, opciones = {}) {
  const respuesta = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(opciones.headers || {})
    },
    ...opciones
  });

  const datos = await respuesta.json().catch(() => ({
    ok: false,
    mensaje: 'Respuesta no válida del servidor.'
  }));

  if (!respuesta.ok) {
    throw new Error(datos.mensaje || 'Ocurrió un error.');
  }

  return datos;
}

// INICIO Y CIERRE DE SESIÓN

// Permite mostrar u ocultar la contraseña.
$('#btnTogglePassword').addEventListener('click', () => {
  const campo = $('#password');

  campo.type = campo.type === 'password' ? 'text' : 'password';
});

// Procesa el formulario de inicio de sesión.
$('#inicioForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  mensajeLogin.className = 'mensaje';

  try {
    const r = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identificador: $('#identificador').value.trim(),
        password: $('#password').value
      })
    });

    usuarioActual = r.usuario;
    mostrarAplicacion();
  } catch (err) {
    mensaje(mensajeLogin, err.message);
  }
});

// Cierra la sesión y regresa a la pantalla de inicio.
$('#btnSalir').addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', {
      method: 'POST',
      body: '{}'
    });
  } finally {
    usuarioActual = null;
    panelApp.classList.add('oculto');
    pantallaLogin.classList.remove('oculto');
    $('#inicioForm').reset();
    mensajeLogin.className = 'mensaje';
  }
});

// Muestra la aplicación después de iniciar sesión.
function mostrarAplicacion() {
  pantallaLogin.classList.add('oculto');
  panelApp.classList.remove('oculto');

  $('#datosUsuario').textContent =
    `${usuarioActual.nombre} · Rol: ${usuarioActual.rol}`;

  construirMenu();
  inicio();
}

// Crea las opciones disponibles según el rol.
function construirMenu() {
  const menu = $('#menuPrincipal');
  menu.innerHTML = '';

  const opciones = [
    ['inicio', 'Inicio', true],
    [
      'beneficiarios',
      'Beneficiarios',
      ['administrador', 'operador'].includes(usuarioActual.rol)
    ],
    [
      'programas',
      'Programas',
      usuarioActual.rol === 'administrador'
    ]
  ];

  // Crea solamente las opciones permitidas para el usuario.
  opciones
    .filter((opcion) => opcion[2])
    .forEach(([id, titulo]) => {
      const boton = document.createElement('button');

      boton.textContent = titulo;
      boton.dataset.vista = id;

      boton.addEventListener('click', () => {
        menu.querySelectorAll('button').forEach((elemento) => {
          elemento.classList.toggle('activo', elemento === boton);
        });

        if (id === 'inicio') inicio();
        if (id === 'beneficiarios') vistaBeneficiarios();
        if (id === 'programas') vistaProgramas();
      });

      menu.appendChild(boton);
    });
}

// Muestra la pantalla principal.
function inicio() {
  vista.innerHTML = `
    <h2>Bienvenido al Portal de Subsidios</h2>

    <p>
      Ha iniciado sesión correctamente.
      Las opciones disponibles dependen de su rol.
    </p>

    <p class="notice">
      Sprint 1: los registros son temporales y se perderán
      al reiniciar el servidor.
    </p>
  `;

  $('#menuPrincipal button')?.classList.add('activo');
}

// Muestra mensajes dentro de la vista actual.
function mostrarMensajeVista(texto, tipo = 'error') {
  let elemento = $('#mensajeVista');

  if (!elemento) {
    elemento = document.createElement('p');
    elemento.id = 'mensajeVista';
    elemento.className = 'mensaje';
    vista.prepend(elemento);
  }

  mensaje(elemento, texto, tipo);
}


// Muestra el formulario y la tabla de beneficiarios.
async function vistaBeneficiarios() {
  beneficiarioEditando = null;

  vista.innerHTML = `
    <h2>Registro de beneficiarios</h2>

    <p>
      HU03, HU04 y HU05 · Complete los datos personales
      para registrar o actualizar un beneficiario.
    </p>

    ${formBeneficiario()}

    <div class="tabla-contenedor" id="tablaBeneficiarios"></div>
  `;

  $('#formBeneficiario').addEventListener(
    'submit',
    guardarBeneficiario
  );

  await cargarBeneficiarios();
}

// Construye el formulario de registro o actualización.
function formBeneficiario(d = {}) {
  return `
    <form id="formBeneficiario">
      <div class="form-grid">

        <div class="field">
          <label for="nombre">Nombres *</label>
          <input
            id="nombre"
            name="nombre"
            value="${escapar(d.nombre || '')}"
            required
          >
        </div>

        <div class="field">
          <label for="apellido">Apellidos *</label>
          <input
            id="apellido"
            name="apellido"
            value="${escapar(d.apellido || '')}"
            required
          >
        </div>

        <div class="field">
          <label for="identificador">DUI o pasaporte *</label>
          <input
            id="identificador"
            name="identificador"
            value="${escapar(d.identificador || '')}"
            placeholder="01234567-8"
            required
          >
        </div>

        <div class="field">
          <label for="telefono">Teléfono *</label>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            value="${escapar(d.telefono || '')}"
            required
          >
        </div>

        <div class="field">
          <label for="correo">Correo electrónico</label>
          <input
            id="correo"
            name="correo"
            type="email"
            value="${escapar(d.correo || '')}"
          >
        </div>

        <div class="field">
          <label for="departamento">Departamento *</label>
          <select
            id="departamento"
            name="departamento"
            required
          >
            <option value="">Seleccione...</option>

            ${departamentos.map((departamento) => `
              <option
                ${d.departamento === departamento ? 'selected' : ''}
              >${departamento}</option>
            `).join('')}
          </select>
        </div>

        <div class="field">
          <label for="municipio">Municipio *</label>
          <input
            id="municipio"
            name="municipio"
            value="${escapar(d.municipio || '')}"
            required
          >
        </div>

        <div class="field">
          <label for="direccion">Dirección de residencia *</label>
          <input
            id="direccion"
            name="direccion"
            value="${escapar(d.direccion || '')}"
            required
          >
        </div>

      </div>

      <div class="actions">
        <button class="btn-primario" type="submit">
          ${d.id ? 'Guardar actualización' : 'Registrar beneficiario'}
        </button>

        <button
          class="btn"
          id="limpiarBeneficiario"
          type="button"
        >
          Limpiar formulario
        </button>
      </div>
    </form>
  `;
}

// Obtiene los valores ingresados en un formulario.
function valoresFormulario(form) {
  return Object.fromEntries(new FormData(form).entries());
}

// Registra un beneficiario o actualiza uno existente.
async function guardarBeneficiario(e) {
  e.preventDefault();

  const datos = valoresFormulario(e.currentTarget);

  try {
    const r = await api(
      beneficiarioEditando
        ? `/api/beneficiarios/${beneficiarioEditando}`
        : '/api/beneficiarios',
      {
        method: beneficiarioEditando ? 'PUT' : 'POST',
        body: JSON.stringify(datos)
      }
    );

    mostrarMensajeVista(r.mensaje, 'exito');
    beneficiarioEditando = null;

    await vistaBeneficiarios();
  } catch (err) {
    mostrarMensajeVista(err.message);
  }
}

// Consulta y muestra los beneficiarios registrados.
async function cargarBeneficiarios() {
  try {
    const r = await api('/api/beneficiarios');
    const cont = $('#tablaBeneficiarios');

    if (!r.datos.length) {
      cont.innerHTML = `
        <p class="estado-vacio">
          Todavía no hay beneficiarios registrados.
        </p>
      `;
      return;
    }

    cont.innerHTML = `
      <h3>Beneficiarios registrados</h3>

      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>DUI/Pasaporte</th>
            <th>Teléfono</th>
            <th>Ubicación</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          ${r.datos.map((b) => `
            <tr>
              <td>
                ${escapar(b.nombre)} ${escapar(b.apellido)}
              </td>

              <td>${escapar(b.identificador)}</td>
              <td>${escapar(b.telefono)}</td>

              <td>
                ${escapar(b.municipio)}, ${escapar(b.departamento)}
              </td>

              <td>
                <button
                  class="btn"
                  data-editar-beneficiario="${b.id}"
                >
                  Editar
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Asigna la acción de editar a cada botón.
    cont.querySelectorAll('[data-editar-beneficiario]')
      .forEach((boton) => {
        boton.addEventListener('click', () => {
          editarBeneficiario(
            Number(boton.dataset.editarBeneficiario)
          );
        });
      });

    // Permite limpiar el formulario.
    $('#limpiarBeneficiario').addEventListener('click', () => {
      $('#formBeneficiario').reset();
    });
  } catch (err) {
    mostrarMensajeVista(err.message);
  }
}

// Busca un beneficiario y carga sus datos para editarlos.
async function editarBeneficiario(id) {
  try {
    const r = await api('/api/beneficiarios');
    const d = r.datos.find((elemento) => elemento.id === id);

    if (!d) return;

    beneficiarioEditando = id;

    vista.innerHTML = `
      <h2>Actualizar beneficiario</h2>

      <p>HU05 · Modifique los campos necesarios.</p>

      ${formBeneficiario(d)}

      <div
        class="tabla-contenedor"
        id="tablaBeneficiarios"
      ></div>
    `;

    $('#formBeneficiario').addEventListener(
      'submit',
      guardarBeneficiario
    );

    $('#limpiarBeneficiario').addEventListener(
      'click',
      () => vistaBeneficiarios()
    );

    await cargarBeneficiarios();
  } catch (err) {
    mostrarMensajeVista(err.message);
  }
}


// Muestra el formulario y la tabla de programas.
async function vistaProgramas() {
  programaEditando = null;

  vista.innerHTML = `
    <h2>Gestión de programas de subsidios</h2>

    <p>
      HU06, HU07 y HU08 · Cree y administre los programas de ayuda.
    </p>

    ${formPrograma()}

    <div class="tabla-contenedor" id="tablaProgramas"></div>
  `;

  $('#formPrograma').addEventListener('submit', guardarPrograma);

  $('#cancelarPrograma').addEventListener('click', () => {
    programaEditando = null;
    vistaProgramas();
  });

  await cargarProgramas();
}

// Construye el formulario de creación o edición de programas.
function formPrograma(d = {}) {
  const entidades = [
    ['raiz', 'Raíz Cooperativa · EMP-02'],
    ['mag', 'Ministerio de Agricultura y Ganadería (MAG)'],
    ['integracion', 'Dirección de Integración'],
    ['fundasal', 'FUNDASAL'],
    ['fusal', 'FUSAL']
  ];

  const tipos = [
    'Insumos agrícolas',
    'Becas',
    'Apoyo para vivienda',
    'Recursos humanitarios',
    'Apoyo económico',
    'Vales de transporte',
    'Canasta básica'
  ];

  const estados = [
    'Activo',
    'En revisión',
    'Suspendido',
    'Cerrado'
  ];

  const unidades = [
    'Paquete / kit',
    'Unidad',
    'Saco',
    'Litro',
    'Libras',
    'Metros'
  ];

  const periodicidades = [
    'Una vez por campaña',
    'Mensual',
    'Trimestral',
    'Anual'
  ];

  return `
    <form id="formPrograma">

      <header class="form-header">
        <div>
          <h3>${d.id ? 'EDITAR PROGRAMA' : 'NUEVO BENEFICIO'}</h3>

          <p class="subtitle">
            ${d.claveCorrelativa
              ? escapar(d.claveCorrelativa)
              : 'Clave correlativa generada al guardar'}
          </p>
        </div>

        <span class="status">
          ${escapar(d.estado || 'En revisión')}
        </span>
      </header>

      <div class="form-grid">

        ${campo(
          'Nombre del programa',
          'nombre',
          d.nombre,
          'text',
          'Ej. Cosecha Activa'
        )}

        <div class="field">
          <label for="entidad">Entidad responsable *</label>

          <select id="entidad" name="entidad" required>
            ${opciones(entidades, d.entidad)}
          </select>
        </div>

        <div class="field">
          <label for="tipo">Tipo de beneficio *</label>

          <select id="tipo" name="tipo" required>
            ${opciones(tipos.map((x) => [x, x]), d.tipo)}
          </select>
        </div>

        <div class="field">
          <label for="estado">Estado *</label>

          <select id="estado" name="estado" required>
            ${opciones(
              estados.map((x) => [x, x]),
              d.estado || 'Activo'
            )}
          </select>
        </div>

        <div class="field full">
          <label for="descripcion">Descripción del beneficio *</label>

          <textarea
            id="descripcion"
            name="descripcion"
            required
            placeholder="Describa el beneficio"
          >${escapar(d.descripcion || '')}</textarea>
        </div>

        ${campo(
          'Cantidad por asignación',
          'cantidad',
          d.cantidad,
          'number',
          'Cantidad',
          'min="1"'
        )}

        <div class="field">
          <label for="unidad">Unidad de entrega *</label>

          <select id="unidad" name="unidad" required>
            ${opciones(unidades.map((x) => [x, x]), d.unidad)}
          </select>
        </div>

        ${campo(
          'Cupos del período',
          'cupos',
          d.cupos,
          'number',
          '250',
          'min="1"'
        )}

        ${campo(
          'Monto por asignación (USD)',
          'monto',
          d.monto ?? 0,
          'number',
          '0',
          'min="0" step="0.01"'
        )}

        ${campo(
          'Clave correlativa',
          'claveCorrelativa',
          d.claveCorrelativa,
          'text',
          'Se genera automáticamente',
          'readonly'
        )}

        <div class="field full">
          <label for="composicion">Composición del paquete *</label>

          <textarea
            id="composicion"
            name="composicion"
            required
            placeholder="Describa el contenido del beneficio"
          >${escapar(d.composicion || '')}</textarea>
        </div>

      </div>

      <section class="section">
        <h3>Período y cobertura</h3>

        <div class="form-grid">

          ${campo('Fecha de inicio', 'fechaInicio', d.fechaInicio, 'date')}

          ${campo('Fecha de cierre', 'fechaCierre', d.fechaCierre, 'date')}

          ${campo(
            'Período de asignación',
            'periodo',
            d.periodo,
            'text',
            'Ej. Campaña 2026'
          )}

          <div class="field">
            <label for="periodicidad">Periodicidad *</label>

            <select id="periodicidad" name="periodicidad" required>
              ${opciones(
                periodicidades.map((x) => [x, x]),
                d.periodicidad
              )}
            </select>
          </div>

          <div class="field full">
            <label for="zonas">Zonas habilitadas *</label>

            <select id="zonas" name="zonas" required>
              ${opciones(
                departamentos.map((x) => [x, x]),
                d.zonas
              )}
            </select>
          </div>

        </div>
      </section>

      <section class="section">
        <h3>Criterios de elegibilidad</h3>

        ${
          [
            ['unidad', 'Unidad productiva registrada y validada'],
            ['residencia', 'Residencia o actividad en una zona habilitada'],
            ['declaracion', 'Declaración de pequeña producción documentada'],
            ['consentimiento', 'Consentimiento para tratamiento de datos vigente']
          ].map(([valor, texto]) => `
            <label class="check">
              <input
                type="checkbox"
                name="criterios"
                value="${valor}"
                ${
                  (d.criterios || [
                    'unidad',
                    'residencia',
                    'declaracion',
                    'consentimiento'
                  ]).includes(valor)
                    ? 'checked'
                    : ''
                }
              >

              <span>${texto}</span>
            </label>
          `).join('')
        }

        <div class="field">
          <label for="documentos">Documentos requeridos *</label>

          <textarea
            id="documentos"
            name="documentos"
            required
            placeholder="Documentos necesarios"
          >${escapar(d.documentos || '')}</textarea>
        </div>
      </section>

      <p class="notice">
        Control de duplicados: los registros se mantienen únicamente
        durante esta ejecución del servidor. La persistencia se
        desarrollará en el Sprint 2.
      </p>

      <div class="actions">
        <button type="submit" class="btn-primario">
          ${d.id ? 'Guardar cambios' : 'Crear programa'}
        </button>

        <button type="button" class="btn" id="cancelarPrograma">
          Cancelar
        </button>
      </div>

    </form>
  `;
}

// Genera un campo de formulario reutilizable.
function campo(
  label,
  name,
  value = '',
  type = 'text',
  placeholder = '',
  extra = ''
) {
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
      <option
        value="${escapar(valor)}"
        ${seleccionado === valor ? 'selected' : ''}
      >${escapar(texto)}</option>
    `).join('')}
  `;
}

// Registra un programa nuevo o actualiza uno existente.
async function guardarPrograma(e) {
  e.preventDefault();

  const formulario = e.currentTarget;
  const datos = valoresFormulario(formulario);

  // Obtiene únicamente los criterios que están marcados.
  datos.criterios = [
    ...formulario.querySelectorAll('input[name="criterios"]:checked')
  ].map((elemento) => elemento.value);

  try {
    const r = await api(
      programaEditando
        ? `/api/programas/${programaEditando}`
        : '/api/programas',
      {
        method: programaEditando ? 'PUT' : 'POST',
        body: JSON.stringify(datos)
      }
    );

    mostrarMensajeVista(r.mensaje, 'exito');
    programaEditando = null;

    await vistaProgramas();
  } catch (err) {
    mostrarMensajeVista(err.message);
  }
}

// Consulta y muestra todos los programas registrados.
async function cargarProgramas() {
  try {
    const r = await api('/api/programas');
    const cont = $('#tablaProgramas');

    if (!r.datos.length) {
      cont.innerHTML = `
        <p class="estado-vacio">
          Todavía no hay programas creados.
        </p>
      `;
      return;
    }

    cont.innerHTML = `
      <h3>Programas registrados</h3>

      <table>
        <thead>
          <tr>
            <th>Programa</th>
            <th>Entidad</th>
            <th>Tipo</th>
            <th>Fechas</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          ${r.datos.map((p) => `
            <tr>
              <td>
                ${escapar(p.nombre)}
                <br>
                <small>${escapar(p.claveCorrelativa)}</small>
              </td>

              <td>${escapar(p.entidad)}</td>
              <td>${escapar(p.tipo)}</td>

              <td>
                ${escapar(p.fechaInicio)} – ${escapar(p.fechaCierre)}
              </td>

              <td>${escapar(p.estado)}</td>

              <td>
                <div class="acciones-fila">
                  <button
                    class="btn"
                    data-editar-programa="${p.id}"
                  >
                    Editar
                  </button>

                  <button
                    class="btn"
                    data-eliminar-programa="${p.id}"
                  >
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Asigna la acción de edición a cada programa.
    cont.querySelectorAll('[data-editar-programa]')
      .forEach((boton) => {
        boton.addEventListener('click', () => {
          editarPrograma(Number(boton.dataset.editarPrograma));
        });
      });

    // Asigna la acción de eliminación a cada programa.
    cont.querySelectorAll('[data-eliminar-programa]')
      .forEach((boton) => {
        boton.addEventListener('click', () => {
          eliminarPrograma(Number(boton.dataset.eliminarPrograma));
        });
      });
  } catch (err) {
    mostrarMensajeVista(err.message);
  }
}

// Busca un programa y carga sus datos para editarlos.
async function editarPrograma(id) {
  try {
    const r = await api('/api/programas');
    const d = r.datos.find((elemento) => elemento.id === id);

    if (!d) return;

    programaEditando = id;

    vista.innerHTML = `
      <h2>Editar programa</h2>

      <p>HU07 · Actualice la información del programa.</p>

      ${formPrograma(d)}

      <div class="tabla-contenedor" id="tablaProgramas"></div>
    `;

    $('#formPrograma').addEventListener('submit', guardarPrograma);

    $('#cancelarPrograma').addEventListener('click', () => {
      programaEditando = null;
      vistaProgramas();
    });

    await cargarProgramas();
  } catch (err) {
    mostrarMensajeVista(err.message);
  }
}

// Elimina un programa después de confirmar la acción.
async function eliminarPrograma(id) {
  if (!confirm('¿Está seguro de eliminar este programa?')) {
    return;
  }

  try {
    const r = await api(`/api/programas/${id}`, {
      method: 'DELETE'
    });

    mostrarMensajeVista(r.mensaje, 'exito');

    await cargarProgramas();
  } catch (err) {
    mostrarMensajeVista(err.message);
  }
}


// Comprueba si existe una sesión activa al cargar la página.
(async function comprobarSesion() {
  try {
    const r = await api('/api/auth/me');

    usuarioActual = r.usuario;
    mostrarAplicacion();
  } catch (_) {
    // El usuario aún no ha iniciado sesión.
  }
})();


// Muestra un aviso para las páginas que aún no están implementadas.
document.querySelectorAll('[data-static]').forEach((enlace) => {
  enlace.addEventListener('click', (e) => {
    e.preventDefault();

    alert(
      'Página informativa pendiente de elaboración; ' +
      'no forma parte de las ocho HU de este Sprint.'
    );
  });
});
