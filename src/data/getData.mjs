// data/getData.js
// db.mjs es ESM (exporta el cliente postgres.js) y este archivo es CommonJS,
// por eso se usa import() dinámico.
// let sqlPromise;
import sql from './db.mjs';

// function getSql() {
//   if (!sqlPromise) {
//     sqlPromise = import('../db.mjs').then(mod => mod.default);
//   }
//   return sqlPromise;
// }
// console.log(await sql`SELECT * FROM personas_ed`);

// Devuelve todas las cuentas (beneficiario y/o staff) asociadas al documento.
// Los valores interpolados en la plantilla se envían como parámetros, no como texto.
export async function searchByDoc(documento) {
  // const sql = await getSql();
  return sql`
    SELECT cb.id,
           p.documento_unico AS identificador,
           p.nombre,
           'beneficiario'    AS rol,
           cb.contraseña_hash  AS "passwordHash"
      FROM cuentas_beneficiarios_ed cb
      JOIN personas_ed p ON p.documento_unico = cb.persona_documento
     WHERE p.documento_unico = ${documento}
    UNION ALL
    SELECT cs.id,
           p.documento_unico,
           p.nombre,
           r.name,
           cs.contraseña_hash
      FROM cuentas_staff_ed cs
      JOIN personas_ed p ON p.documento_unico = cs.persona_documento
      JOIN roles_ec r    ON r.id = cs.rol
     WHERE p.documento_unico = ${documento}
  `;
}
