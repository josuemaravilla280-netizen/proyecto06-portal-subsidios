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

// INICIO Y CIERRE DE SESIÓN

// Permite mostrar u ocultar la contraseña.
$('#btnTogglePassword').addEventListener('click', () => {
    const campo = $('#password');
    const mostrar = campo.type === 'password';

    campo.type = mostrar ? 'text' : 'password';
    $('#btnTogglePassword').setAttribute('aria-pressed', String(mostrar));
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
        ['programas', 'Programas', true],
        [
            'asignaciones',
            'Asignaciones',
            ['admin', 'operador'].includes(usuarioActual.rol)
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
                if (id === 'asignaciones') vistaAsignaciones();
            });

            menu.appendChild(boton);
        });

    //     if (id === 'inicio') inicio();
    //     if (id === 'beneficiarios') vistaBeneficiarios();
    //     if (id === 'programas') vistaProgramas();

    //   });

    //   menu.appendChild(boton);
    // });
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

              <td>
                ${getCatalogoName(catalogos.municipios,b.municipio_id)}
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
            <th>Entidad</th>
            <th>Programa</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th>Acciones</th>
            </tr>
        </thead>

        <tbody>
            ${r.datos.map((p) => `
            <tr>
                <td>${getCatalogoName(catalogos.entidades,p.entidad)}</td>
                <td>
                ${escapar(p.nombre)}
                <br>
                <small>${escapar(p.claveCorrelativa)}</small>
                </td>
                <td>${getCatalogoName(catalogos.tipos,p.tipo)}</td>
                <td>${getCatalogoName(catalogos.estados,p.estado)}</td>
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

// Muestra el buscador con filtros y la lista de asignaciones (solicitudes de inscripción).
async function vistaAsignaciones() {
    const filtro = (id, etiqueta, control, activo) => `
      <div class="filtro">
        <label for="${id}">${etiqueta}</label>
        ${control}
        <label><input type="checkbox" id="chk_${id}" ${activo ? 'checked' : ''}> Considerar</label>
      </div>`;
    const select = (id, lista, valor = '') =>
        `<select id="${id}">` +
        lista.map((x) => `<option value="${escapar(x.id)}" ${String(x.id) === String(valor) ? 'selected' : ''}>${escapar(x.name)}</option>`).join('') +
        `</select>`;

    let programas = [];
    try {
        programas = (await api('/api/programas')).datos;
    } catch (err) {
        mostrarMensajeVista(err.message);
    }

    vista.innerHTML = `
    <h2>Asignaciones</h2>
    <form id="formAsignaciones" style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end">
      ${filtro('fEntidad', 'Entidad responsable', select('fEntidad', catalogos.entidades), false)}
      ${filtro('fPrograma', 'Programa', select('fPrograma', programas.map((p) => ({ id: p.id, name: p.nombre }))), false)}
      ${filtro('fBeneficiario', 'Beneficiario (documento)', `<input id="fBeneficiario" type="text">`, false)}
      ${filtro('fEstado', 'Estado', select('fEstado', catalogos.estados_inscripciones, 1), true)}
      <button class="btn" type="submit">Buscar</button>
    </form>
    <div class="tabla-contenedor" id="tablaAsignaciones"></div>`;

    // Cada control se activa o inactiva según su checkbox.
    ['fEntidad', 'fPrograma', 'fBeneficiario', 'fEstado'].forEach((id) => {
        const chk = $(`#chk_${id}`);
        const ctl = $(`#${id}`);
        ctl.disabled = !chk.checked;
        chk.addEventListener('change', () => { ctl.disabled = !chk.checked; });
    });

    $('#formAsignaciones').addEventListener('submit', (e) => {
        e.preventDefault();
        cargarAsignaciones();
    });

    await cargarAsignaciones();
}

// Consulta las inscripciones y aplica los filtros activos.
async function cargarAsignaciones() {
    const cont = $('#tablaAsignaciones');
    const activo = (id) => ($(`#chk_${id}`).checked ? $(`#${id}`).value.trim() : null);
    const fEnt = activo('fEntidad');
    const fProg = activo('fPrograma');
    const fDoc = activo('fBeneficiario');
    const fEst = activo('fEstado');

    try {
        const r = await api('/api/inscripciones');
        const datos = r.datos.filter((i) =>
            (!fEnt || String(i.entidad) === fEnt) &&
            (!fProg || String(i.programa_id) === fProg) &&
            (!fDoc || String(i.documento_unico).toLowerCase().includes(fDoc.toLowerCase())) &&
            (!fEst || String(i.estado) === fEst));

        if (!datos.length) {
            cont.innerHTML = `<p class="estado-vacio">No hay asignaciones que coincidan.</p>`;
            return;
        }

        cont.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Entidad responsable</th>
            <th>Programa</th>
            <th>Beneficiario</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${datos.map((i) => `
            <tr>
              <td>${escapar(getCatalogoName(catalogos.entidades, i.entidad) ?? '')}</td>
              <td>${escapar(i.programa_nombre)}</td>
              <td>${escapar(i.documento_unico)}</td>
              <td>${escapar(getCatalogoName(catalogos.estados_inscripciones, i.estado) ?? i.estado)}</td>
              <td><button class="btn" data-programa="${escapar(i.programa_id)}" data-cuenta="${escapar(i.beneficiario_id)}">Ver</button></td>
            </tr>`).join('')}
        </tbody>
      </table>`;

        cont.querySelectorAll('[data-cuenta]').forEach((boton) => {
            boton.addEventListener('click', () => {
                window.open(
                    `/asignacion.html?programa=${encodeURIComponent(boton.dataset.programa)}&cuenta=${encodeURIComponent(boton.dataset.cuenta)}`,
                    '_blank'
                );
            });
        });
<<<<<<< HEAD
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



const soporteBtn = document.getElementById('soporteBtn');
const soportePanel = document.getElementById('soportePanel');

soporteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    soportePanel.classList.toggle('activo');
});

// Cierra el panel si el usuario hace clic fuera de él
document.addEventListener('click', (e) => {
    if (!soportePanel.contains(e.target) && e.target !== soporteBtn) {
        soportePanel.classList.remove('activo');
    }
});

=======
    } catch (err) {
        mostrarMensajeVista(err.message);
    }
}// bajo el ultimo querySelectorAll el codigo es igual a la funcion cargarProgramas asi que este comentario hacia que no se tomara como cambio en esa funcion
>>>>>>> origin/develop
