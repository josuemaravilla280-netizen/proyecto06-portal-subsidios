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

// common.js
function escapar(valor = '') {
    return String(valor).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[c]);
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
                documento_unico: $('#documento_unico').value.trim(),
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


function addEditarButton(text, id) {
    return `
                  <button
                    class="btn"
                    data-editar-${text}="${id}"
                  >
                    ${(usuarioActual.rol == "admin") || (usuarioActual.rol == "operador" && text == "beneficiario") ? "Editar" : "ver"}
                  </button>`
}

// Muestra la aplicación después de iniciar sesión.
async function mostrarAplicacion() {
    pantallaLogin.classList.add('oculto');
    panelApp.classList.remove('oculto');

    $('#datosUsuario').textContent =
        `${usuarioActual.nombre} · Rol: ${usuarioActual.rol}`;

    construirMenu();

    try {
        await cargarCatalogos();
    } catch (err) {
        mostrarMensajeVista(err.message);
    }

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
            ['admin', 'operador'].includes(usuarioActual.rol)
        ],
        ['programas', 'Programas', true]
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
    </p>
  `;
    if (usuarioActual.rol == "beneficiario") {
        const btn = document.createElement('button');
        btn.innerText = "Ver mis datos";
        btn.className = "btn";
        btn.onclick = () => window.location.href = `/dashboards/beneficiario.html?id=${encodeURIComponent(usuarioActual.id)}`;
        vista.appendChild(btn);
    }

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
      Complete los datos personales
      para registrar o actualizar un beneficiario.
    </p>

    ${formBeneficiario()}

    <div class="tabla-contenedor" id="tablaBeneficiarios"></div>
  `;

    $('#formBeneficiario').addEventListener(
        'submit',
        guardarBeneficiario
    );
    $('#cancelarBeneficiario').addEventListener('click', () => {
        $('#formBeneficiario').reset();
    });

    await cargarBeneficiarios();
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

              <td>${escapar(b.documento_unico)}</td>
              <td>${escapar(b.telefono)}</td>

              <td>
                ${escapar(b.municipio)}, ${escapar(b.departamento)}
              </td>

              <td>
                ${usuarioActual.rol != "beneficiario" ? addEditarButton("beneficiario", b.id) : ""}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
        // Asigna la acción de editar a cada botón.
        cont.querySelectorAll('[data-editar-beneficiario]')
            .forEach((boton) => {
                boton.addEventListener('click', () => {
                    window.open(
                        `/dashboards/beneficiario.html?id=${encodeURIComponent(boton.dataset.editarBeneficiario)}`,
                        '_blank'
                    );
                });
            });
    } catch (err) {
        mostrarMensajeVista(err.message);
    }
}

// Aqui estaba la funcion `editarBeneficiario`

// Muestra el formulario y la tabla de programas.
async function vistaProgramas() {
    programaEditando = null;

    vista.innerHTML = `
    ${usuarioActual.rol == "admin" ? `    <h2>Gestión de programas de subsidios</h2>` : ``}
    ${usuarioActual.rol == "admin" ? formPrograma() : ""}

    <div class="tabla-contenedor" id="tablaProgramas"></div>
  `;

    $('#formPrograma')?.addEventListener('submit', guardarPrograma);

    $('#cancelarPrograma')?.addEventListener('click', () => {
        programaEditando = null;
        vistaProgramas();
    });

    await cargarProgramas();
}

// Registra un programa nuevo o actualiza uno existente.
async function guardarPrograma(e) {
    e.preventDefault();

    const formulario = e.currentTarget;
    const datos = valoresPrograma(formulario);

    // Obtiene únicamente los criterios que están marcados.
    datos.criterios = [
        ...formulario.querySelectorAll('input[name="criterios"]:checked')
    ].map((elemento) => elemento.value);
    datos.zonas = [...formulario.querySelectorAll('input[name="zonas"]:checked')].map((el) => el.value);

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
                  ${addEditarButton("programa", p.id)}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
        cont.querySelectorAll('[data-editar-programa]')
            .forEach((boton) => {
                boton.addEventListener('click', () => {
                    window.open(
                        `/dashboards/programa.html?id=${encodeURIComponent(boton.dataset.editarPrograma)}`,
                        '_blank'
                    );
                });
            });
    } catch (err) {
        mostrarMensajeVista(err.message);
    }
}

// Aqui estaba la funcion `editarPrograma`

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
            'Página informativa pendiente de elaboración; '
        );
    });
});