const form = document.getElementById("cosechaForm");
const mensaje = document.getElementById("mensaje");
const botonCancelar = document.getElementById("cancelar");
const botonCerrar = document.getElementById("cerrar");

function mostrarMensaje(texto, tipo = "success") {
  mensaje.textContent = texto;
  mensaje.className = `message show ${tipo}`;
}

function obtenerDatos() {
  const datos = Object.fromEntries(new FormData(form).entries());

  datos.criterios = Array.from(
    form.querySelectorAll('input[name="criterios"]:checked')
  ).map((checkbox) => checkbox.value);

  return datos;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) return;

  const inicio = document.getElementById("fechaInicio").value;
  const cierre = document.getElementById("fechaCierre").value;

  if (cierre < inicio) {
    mostrarMensaje(
      "La fecha de cierre no puede ser anterior a la fecha de inicio.",
      "error"
    );
    return;
  }

  const botonGuardar = form.querySelector('[type="submit"]');
  botonGuardar.disabled = true;
  botonGuardar.textContent = "Guardando...";

  try {
    const respuesta = await fetch("/api/cosecha", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obtenerDatos())
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(resultado.error || "No se pudieron guardar los cambios.");
    }

    mostrarMensaje(resultado.mensaje || "Cambios guardados correctamente.");
  } catch (error) {
    mostrarMensaje(
      error.message || "Error al conectar con el servidor.",
      "error"
    );
  } finally {
    botonGuardar.disabled = false;
    botonGuardar.textContent = "Guardar cambios";
  }
});

botonCancelar.addEventListener("click", () => {
  if (confirm("¿Deseas descartar los cambios realizados?")) {
    form.reset();
    mostrarMensaje("Se restauraron los valores iniciales del formulario.");
  }
});

botonCerrar.addEventListener("click", async () => {
  if (!confirm("¿Deseas cerrar el programa Cosecha Activa?")) return;

  try {
    const respuesta = await fetch("/api/cosecha/cerrar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" }
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(resultado.error || "No se pudo cerrar el programa.");
    }

    document.getElementById("estado").value = "Cerrado";
    document.querySelector(".status").textContent = "Cerrado";
    mostrarMensaje(resultado.mensaje || "Programa cerrado correctamente.");
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
});