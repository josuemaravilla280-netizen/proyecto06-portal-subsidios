// Esto es en parte para evitar el XSS, que metan HTML que conecten a scripsts cuando se muestre
// el texto a un operador o admin
// Pero creo que tambien para la SQLi sirve.
// no
// Estuve buscando y parece que aunque parezca lo contrario, la etiqueta `sql` parametriza las cosas
// para que lo que tu pones como query sea el codigo sql y lo que pones en `${}` como un texto que no sera tomado como codigo
// https://github.com/neondatabase/website/blob/da9fc3877216556e45f85be29b35addeb020132c/content/blog/posts/sql-template-tags.md
function escapar(valor = '') {
    return String(valor).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[c]);
}

function mensaje(elemento, texto, tipo = 'error') {
    elemento.textContent = texto; // recibe el elemento html que debe mostrar el mensaje
    elemento.className = `mensaje visible ${tipo}`;  //y le asigna un texto 
}

let catalogos = { departamentos: [], municipios: [], entidades: [], tipos: [], estados: [], periodicidades: [] };

async function cargarCatalogos() {
    const r = await fetch('/api/catalogos', { credentials: 'same-origin' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.mensaje || `Error ${r.status}`);
    catalogos = j.dato;
}
cargarCatalogos();

// [{id, nombre}] -> [[valor, texto]] para opciones()
const deCatalogo = (lista) => lista.map((x) => [String(x.id), x.name]);
const getCatalogoName = (lista, id) => lista.find(o => o.id === id)?.name;;
