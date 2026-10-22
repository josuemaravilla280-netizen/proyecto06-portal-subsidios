document.addEventListener("DOMContentLoaded", () => {

    /// OBTENER ELEMENTOS HTML A TRAVÉS DEL DOM
    const btnTogglePassword = document.getElementById("btnTogglePassword");
    const campoMostrar = document.getElementById("password");

    const formularioInicio = document.getElementById("inicioForm");
    const campoIdentificador = document.getElementById("identificador");
    const campoPassword = document.getElementById("password");
    const contenedorMensaje = document.getElementById("mensaje-respuesta");

    /// VALIDACIÓN EN TIEMPO REAL PARA EL DUI / IDENTIFICADOR
    campoIdentificador.addEventListener("input", (e) => {
        const valorOriginal = e.target.value;
        // Solo permite números (0-9) y guiones (-)
        let valorLimpio = valorOriginal.replace(/[^0-9-]/g, "");

        // Limita la longitud máxima a 10 caracteres (puedes ajustarlo si tu DUI usa otro formato)
        if (valorLimpio.length > 10) {
            valorLimpio = valorLimpio.slice(0, 10);
        }

        if (valorOriginal !== valorLimpio) {
            e.target.value = valorLimpio;
            mostrarMensaje("⚠️ El documento solo admite números y guion (-).", "error");
        } else {
            e.target.value = valorLimpio;
            // Si el usuario borra lo malo o escribe bien, limpiamos el mensaje de error del DUI
            if (contenedorMensaje && contenedorMensaje.textContent.includes("admite números")) {
                contenedorMensaje.textContent = "";
            }
        }
    });

    /// VALIDACIÓN EN TIEMPO REAL PARA LA CONTRASEÑA (Sin espacios en blanco)
    campoPassword.addEventListener("input", (evento) => {
        evento.target.value = evento.target.value.replace(/\s/g, "");
    });
    
    // --- LÓGICA PARA MOSTRAR / OCULTAR CONTRASEÑA ---
    if (btnTogglePassword && campoMostrar) {
        btnTogglePassword.addEventListener("click", () => {
            const esPassword = campoMostrar.type === "password";
            campoMostrar.type = esPassword ? "text" : "password";
            btnTogglePassword.textContent = esPassword ? "🙈" : "👁️";
        });
    }

    /// ESCUCHAR EVENTO DE ENVÍO DEL FORMULARIO 
    formularioInicio.addEventListener("submit", (evento) => {
        evento.preventDefault();
        
        if (contenedorMensaje) {
            contenedorMensaje.textContent = "";
            contenedorMensaje.className = "mensaje";
        }

        const identificador = campoIdentificador.value.trim();
        const password = campoPassword.value.trim();

        if (!identificador || !password) {
            mostrarMensaje("Por favor, completa todos los campos requeridos.", "error");
            return;
        }

        if (password.length < 8) {
            mostrarMensaje("La contraseña debe tener al menos 8 caracteres.", "error");
            return;
        }

        // SIMULACIÓN LOCAL PARA EL SPRINT 1 ---
        mostrarMensaje("¡Inicio de sesión exitoso!", "exito");

        localStorage.setItem("tokenAcceso", "token-de-prueba-12345");
        localStorage.setItem("rolUsuario", "ADMINISTRADOR");

        setTimeout(() => {
            window.location.href = "registro.html"; 
        }, 1500);
    });

    function mostrarMensaje(texto, tipo) {
        if (!contenedorMensaje) return;

        contenedorMensaje.textContent = texto;
        
        if (tipo === "exito") {
            contenedorMensaje.style.color = "#22c55e"; // Verde
        } else {
            contenedorMensaje.style.color = "#ef4444"; // Rojo
        }
    }
});