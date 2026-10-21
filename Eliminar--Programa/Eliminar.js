document.addEventListener('DOMContentLoaded', () => {
    // Referencias a los elementos del DOM
    const inputConfirmacion = document.getElementById('entrada-confirmacion');
    const botonEliminar = document.getElementById('boton-eliminar');
    const tarjetaConfirmar = document.querySelector('.tarjeta-confirmar');
    const idProgramaObjetivo = 'PRO-GAS-03'; // ID esperado para confirmar

    // 1. Habilitar o deshabilitar el botón de eliminar según el texto ingresado
    if (inputConfirmacion && botonEliminar) {
        inputConfirmacion.addEventListener('input', (e) => {
            const textoIngresado = e.target.value.trim();
            
            if (textoIngresado === idProgramaObjetivo) {
                botonEliminar.removeAttribute('disabled');
            } else {
                botonEliminar.setAttribute('disabled', 'true');
            }
        });

        // 2. Acción al hacer clic en el botón de eliminar (Muestra el mensaje DENTRO de la página)
        botonEliminar.addEventListener('click', () => {
            if (!botonEliminar.hasAttribute('disabled')) {
                // Seleccionamos la tarjeta de confirmación y cambiamos su contenido interno
                if (tarjetaConfirmar) {
                    tarjetaConfirmar.innerHTML = `
                        <h2>Eliminación completada</h2>
                        <p class="alerta-subtitulo">El registro ha sido procesado</p>
                        
                        <div class="alerta-exito" style="margin-top: 20px; display: flex; gap: 12px; align-items: start;">
                            <i class="fa-solid fa-circle-check" style="font-size: 20px; color: var(--color-exito, #10b981); margin-top: 2px;"></i>
                            <div>
                                <strong>Programa eliminado con éxito</strong>
                                <p style="margin-top: 4px; font-size: 14px;">El programa <strong>Gas Rural (${idProgramaObjetivo})</strong> ha sido eliminado definitivamente de la base de datos de Raíz Cooperativa. La acción fue registrada en auditoría.</p>
                            </div>
                        </div>

                        <div style="margin-top: 24px;">
                            <a href="#" class="boton-buscar" style="display: inline-block; text-align: center; text-decoration: none; width: 100%;">
                                <i class="fa-solid fa-arrow-left"></i> Volver al listado de programas
                            </a>
                        </div>
                    `;
                }
            }
        });
    }

    // 3. Simulación de búsqueda superior
    const botonBuscar = document.querySelector('.boton-buscar');
    const inputIdPrograma = document.getElementById('id-programa');

    if (botonBuscar && inputIdPrograma) {
        botonBuscar.addEventListener('click', () => {
            const idBuscado = inputIdPrograma.value.trim();
            if (idBuscado) {
                console.log(`Buscando programa con ID: ${idBuscado}`);
            } else {
                // Mensaje interno o validación si se desea
                console.warn('Ingresa un ID válido');
            }
        });
    }
});