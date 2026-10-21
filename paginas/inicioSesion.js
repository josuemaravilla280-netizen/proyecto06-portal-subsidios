document.addEventListener("DOMContentLoaded", () => {

    /// OBTENER ELEMENTOS HTML ATRAVEZ DE DOM
    const btnTogglePassword = document.getElementById("btnTogglePassword");
const campoMostrar = document.getElementById("password");

    const formularioInicio = document.getElementById("inicioForm");
    const campoIdentificador = document.getElementById("identificador");
    const campoPassword = document.getElementById("password");
    const contenedorMensaje = document.getElementById("mensaje-respuesta");
      ///HACEMOS QUE EL USUARIO NO PUEDA ESCRIBIR LETRAS U OTROS CARECTERES QUE NO SEA -. 
    campoIdentificador.addEventListener("input", (evento) => {
        let valor = evento.target.value;

        // ELIMINA CUALQUIER CARACTER QUE NO SEA UN NUMERO O UN GUION(-)
        valor = valor.replace(/[^0-9-]/g, "");

        // LIMITA LA LONGITUD MAXIMA A 10 CARACTERES (ej: 01234567-8)
        if (valor.length > 10) {
            valor = valor.slice(0, 10);
        }

        // DEVUELVE EL VALOR LIMPIO AL INPUT 
        evento.target.value = valor;
    });


/// VALIDACIÓN EN TIEMPO REAL PARA LA CONTRASEÑA (Sin espacios en blanco)

    campoPassword.addEventListener("input", (evento) => {
        // Elimina automáticamente cualquier espacio en blanco que el usuario intente escribir
        evento.target.value = evento.target.value.replace(/\s/g, "");
    });
    
    // --- LÓGICA PARA MOSTRAR / OCULTAR CONTRASEÑA ---

if (btnTogglePassword && campoMostrar) {
    btnTogglePassword.addEventListener("click", () => {
        // Verifica si el tipo actual es 'password'
        const esPassword = campoMostrar.type === "password";
        
        // Si es 'password' lo cambia a 'text' (muestra), si no, lo regresa a 'password' (oculta)
        campoMostrar.type = esPassword ? "text" : "password";
        
        // Cambia el icono del botón dinámicamente
        btnTogglePassword.textContent = esPassword ? "🙈" : "👁️";
    });
}
    /// ESCUCHAR EVENTOS 
    formularioInicio.addEventListener("submit", (evento) => {
        /// EVITA QUE LA PAGINA SE RECARGUE AUTOMATICAMENTE DESPUES DE ENVIAR EL FORMULARIO 
        evento.preventDefault();
       /// LIMPIAMOS EL CONTENEDOR DE MENSAJES
        if (contenedorMensaje) {
            contenedorMensaje.textContent = "";
            contenedorMensaje.className = "mensaje";
        }
        /// LEER EL TEXTO INGRESADO Y ELIMINAMOS LOS ESPACION EN BLANCO
        const identificador = campoIdentificador.value.trim();
        const password = campoPassword.value.trim();
         //// VALIDAMOS QUE LOS CAMPOS TENGAN INFORMACION
        if (!identificador || !password) {
            mostrarMensaje("Por favor, completa todos los campos requeridos.", "error");
            return;
        }

        // NUEVA VALIDACIÓN: MINIMO 8 CARAECTERES PARA LA CONTRASEÑA
        if (password.length < 8) {
            mostrarMensaje("La contraseña debe tener al menos 8 caracteres.", "error");
            return;
        }

        // SIMULACIÓN LOCAL PARA EL SPRINT 1 ---
        mostrarMensaje("¡Inicio de sesión exitoso!", "exito");

        // Guardar datos de prueba en el navegador
        localStorage.setItem("tokenAcceso", "token-de-prueba-12345");
        localStorage.setItem("rolUsuario", "ADMINISTRADOR");

        // REDIRIGIR AL FORMULARIO  DE RESGISTRO DESPUES DE  1.5 SEGUNDOS
        setTimeout(() => {
            window.location.href = "registro.html"; 
        }, 1500);
    });

    function mostrarMensaje(texto, tipo) {
        if (!contenedorMensaje) return;

        contenedorMensaje.textContent = texto;
        
        if (tipo === "exito") {
            contenedorMensaje.style.color = "#22c55e"; // Verde para éxito
        } else {
            contenedorMensaje.style.color = "#ef4444"; // Rojo para error
        }
    }
});