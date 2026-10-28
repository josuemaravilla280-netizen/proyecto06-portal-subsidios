# Proyecto06 — Portal de Subsidios (Sprint 1)

## Alcance
Incluye HU01–HU08: inicio de sesión, roles y permisos, registro/validación/actualización de beneficiarios y crear/editar/eliminar programas. No utiliza PostgreSQL ni otra base de datos. Los registros se guardan temporalmente en memoria y se pierden al reiniciar el servidor.

## Requisitos
- Node.js LTS instalado
- Git instalado (opcional para ejecutar, necesario para publicar en GitHub)

## Instalación en Windows / PowerShell
1. Copiar la URL de GitHub, abrir una nueva terminal, colocar el comando git - clone y pegar la URL.
2. En Terminal > Nueva terminal, ejecute `npm install`.
3. Ejecute `npm run dev`.
4. Abra `http://localhost:3000`.

## Instalación en linux
1. Copiar la URL de GitHub, abrir una nueva terminal, colocar el comando git - clone y pegar la URL.
2. En Terminal > Nueva terminal, ejecute `npm install`.
3. ejecute `npm install-scripts approve bcrypt@5.1.1`
4. Ejecute `npm run dev`.
5. Abra `http://localhost:3000`.

## Cuentas de demostración
Las cuentas se crean automáticamente al iniciar el servidor. Use el identificador indicado y la contraseña temporal:
- Administrador: DUI/pasaporte `00000000-0`, contraseña `Blancag`
- Operador: DUI/pasaporte `11111111-1`, contraseña `ZuleymaM`
- Beneficiario: DUI/pasaporte `22222222-2`, contraseña `BeneficiarioKelvin`

Cambie estas credenciales si va a compartir el entorno. Son cuentas únicamente para pruebas locales.

## Ramas
- `main`: versión estable
- `develop`: integración del Sprint
- `feature/HU01-login`, `feature/HU02-roles-permisos`, `feature/HU03-registrar-beneficiario`, `feature/HU04-validar-documento`, `feature/HU05-actualizar-beneficiario`, `feature/HU06-crear-programa`, `feature/HU07-editar-programa`, `feature/HU08-eliminar-programa
OBSERVACIÓN: La división de las ramas se trabajará hasta el sprint 2 y 3.

Cada historia se trabaja en su rama y se integra a `develop` mediante Pull Request revisado.