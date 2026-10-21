document.addEventListener("DOMContentLoaded", () => {

    // =========================================================================
    // 1. CAPTURA DE ELEMENTOS DEL DOM (Basado en tu HTML exacto)
    // =========================================================================
    const formularioRegistro = document.getElementById("registroForm");
    const campoDui = document.getElementById("documento_identidad");
    const campoNombre = document.getElementById("nombre_completo");
    const campoCorreo = document.getElementById("correo");
    const campoTelefono = document.getElementById("telefono");
    const contenedorMensaje = document.getElementById("mensaje-respuesta");
    
    // Botón de cerrar sesión (apunta a la clase .btn-cierre de tu HTML)
    const botonCerrarSesion = document.querySelector(".btn-cierre");


    // =========================================================================
    // 2. FUNCIONALIDAD DEL BOTÓN CERRAR SESIÓN
    // =========================================================================
    if (botonCerrarSesion) {
        botonCerrarSesion.addEventListener("click", () => {
            // Limpiar datos temporales guardados de la sesión
            localStorage.removeItem("tokenAcceso");
            localStorage.removeItem("rolUsuario");

            // Mostrar mensaje breve y redirigir al inicio de sesión (ajusta 'index.html' si tu login se llama diferente)
            mostrarMensaje("Cerrando sesión...", "exito");
            setTimeout(() => {
                window.location.href = "inicio.html"; 
            }, 800);
        });
    }


    // =========================================================================
    // 3. ADVERTENCIAS Y VALIDACIONES EN TIEMPO REAL
    // =========================================================================

    // A) CAMPO NOMBRE COMPLETO: Advierte si intenta escribir números o símbolos
    campoNombre.addEventListener("input", (e) => {
        const valorOriginal = e.target.value;
        const valorLimpio = valorOriginal.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");

        if (valorOriginal !== valorLimpio) {
            e.target.value = valorLimpio;
            mostrarMensaje("⚠️ El nombre no debe contener números ni caracteres especiales.", "error");
        } else {
            limpiarMensajeSiEsError();
        }
    });

    // B) CAMPO DUI / PASAPORTE: Advierte si escribe letras o símbolos no permitidos
    campoDui.addEventListener("input", (e) => {
        const valorOriginal = e.target.value;
        let valorLimpio = valorOriginal.replace(/[^0-9-]/g, "");

        if (valorLimpio.length > 10) valorLimpio = valorLimpio.slice(0, 10);

        if (valorOriginal !== valorLimpio) {
            e.target.value = valorLimpio;
            mostrarMensaje("⚠️ El documento solo admite números y guion (-).", "error");
        } else {
            limpiarMensajeSiEsError();
        }
    });

    // C) CAMPO TELÉFONO: Advierte si escribe letras
    if (campoTelefono) {
        campoTelefono.addEventListener("input", (e) => {
            const valorOriginal = e.target.value;
            let valorLimpio = valorOriginal.replace(/[^0-9-]/g, "");

            if (valorLimpio.length > 9) valorLimpio = valorLimpio.slice(0, 9);

            if (valorOriginal !== valorLimpio) {
                e.target.value = valorLimpio;
                mostrarMensaje("⚠️ El teléfono solo admite números y guion (-).", "error");
            } else {
                limpiarMensajeSiEsError();
            }
        });
    }

    // D) CAMPO CORREO: Advierte si incluye espacios
    campoCorreo.addEventListener("input", (e) => {
        if (/\s/.test(e.target.value)) {
            e.target.value = e.target.value.replace(/\s/g, "");
            mostrarMensaje("⚠️ El correo electrónico no puede contener espacios.", "error");
        } else {
            limpiarMensajeSiEsError();
        }
    });


    // =========================================================================
    // 4. ENVÍO DEL FORMULARIO Y VALIDACIÓN FINAL
    // =========================================================================
    formularioRegistro.addEventListener("submit", (e) => {
        e.preventDefault();

        const dui = campoDui.value.trim();
        const nombre = campoNombre.value.trim();
        const correo = campoCorreo.value.trim();

        // Validación de campos obligatorios
        if (!dui || !nombre || !correo) {
            mostrarMensaje("Por favor, completa todos los campos obligatorios (*).", "error");
            return;
        }

        // Validación de formato de correo
        const formatoCorreoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formatoCorreoValido.test(correo)) {
            mostrarMensaje("Por favor, ingresa un correo electrónico válido (ejemplo@dominio.com).", "error");
            return;
        }

        // Simulación de éxito para el Sprint 1
        mostrarMensaje("¡Beneficiario registrado exitosamente!", "exito");
        formularioRegistro.reset();
    });


    // =========================================================================
    // 5. FUNCIONES AUXILIARES PARA MENSAJES
    // =========================================================================
    function mostrarMensaje(texto, tipo) {
        if (!contenedorMensaje) return;

        contenedorMensaje.textContent = texto;

        if (tipo === "exito") {
            contenedorMensaje.style.color = "#22c55e"; // Verde
        } else {
            contenedorMensaje.style.color = "#ef4444"; // Rojo
        }
    }

    function limpiarMensajeSiEsError() {
        if (contenedorMensaje && contenedorMensaje.style.color === "rgb(239, 68, 68)") {
            contenedorMensaje.textContent = "";
        }
    }

});