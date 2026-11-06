const bcrypt = require('bcrypt');

// Sprint 1: datos en memoria. Se reinician cada vez que se detiene el servidor.
const usuarios = [];
const beneficiarios = [];
const programas = [];
let siguienteBeneficiarioId = 1;
let siguienteProgramaId = 1;

async function inicializarUsuariosDemo() {
  if (usuarios.length) return;
  const cuentas = [
    { id: 1, nombre: 'Administrador', identificador: '00000000-0', passwordPlano: 'Blancag', rol: 'administrador' },
    { id: 2, nombre: 'Operador', identificador: '11111111-1', passwordPlano: 'ZuleymaM', rol: 'operador' },
    { id: 3, nombre: 'Beneficiario', identificador: '22222222-2', passwordPlano: 'BeneficiarioKelvin', rol: 'beneficiario' }
  ];
  for (const cuenta of cuentas) {
    usuarios.push({ id: cuenta.id, nombre: cuenta.nombre, identificador: cuenta.identificador, passwordHash: await bcrypt.hash(cuenta.passwordPlano, 10), rol: cuenta.rol });
  }
}
function nuevoIdBeneficiario() { return siguienteBeneficiarioId++; }
function nuevoIdPrograma() { return siguienteProgramaId++; }
module.exports = { usuarios, beneficiarios, programas, inicializarUsuariosDemo, nuevoIdBeneficiario, nuevoIdPrograma };