(async function () {
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const msg = $('#mensaje');
  let programaId = params.get('programa');
  let cuentaId = params.get('cuenta');

  async function api(url, opciones = {}) {
    const r = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...opciones
    });
    const j = await r.json().catch(() => ({ mensaje: 'Respuesta no válida del servidor.' }));
    if (!r.ok) throw new Error(j.mensaje || 'Ocurrió un error.');
    return j;
  }

  $('#btnCerrar').addEventListener('click', () => window.close());

  try { await cargarCatalogos(); } catch (e) { return mensaje(msg, e.message); }

  // ---- Buscador superior ----
  const opts = (lista, sel) => '<option value="">—</option>' +
    lista.map((x) => `<option value="${escapar(x.id)}" ${String(x.id) === sel ? 'selected' : ''}>${escapar(x.name)}</option>`).join('');

  let programas = [];
  try { programas = (await api('/api/programas')).datos; } catch (e) { mensaje(msg, e.message); }

  $('#fEntidad').innerHTML = opts(catalogos.entidades, params.get('entidad') || '');
  $('#fPrograma').innerHTML = opts(programas.map((p) => ({ id: p.id, name: p.nombre })), params.get('programa') || '');
  $('#fBeneficiario').value = params.get('beneficiario') || '';

  function buscar() {
    const q = new URLSearchParams();
    if ($('#fEntidad').value) q.set('entidad', $('#fEntidad').value);
    if ($('#fPrograma').value) q.set('programa', $('#fPrograma').value);
    if ($('#fBeneficiario').value.trim()) q.set('beneficiario', $('#fBeneficiario').value.trim());
    location.search = q.toString();
  }
  $('#formBuscar').addEventListener('submit', (e) => { e.preventDefault(); buscar(); });
  // Enter también dentro de los select
  $('#formBuscar').querySelectorAll('select').forEach((s) =>
    s.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } }));

  // Sin programa y cuenta en la URL: primera inscripción que coincida con los filtros
  if (!programaId || !cuentaId) {
    try {
      const lista = (await api('/api/inscripciones')).datos;
      const doc = (params.get('beneficiario') || '').toLowerCase();
      const ent = params.get('entidad');
      const prog = params.get('programa');
      const hit = lista.find((i) =>
        (!prog || String(i.programa_id) === prog) &&
        (!ent || String(i.entidad) === ent) &&
        (!doc || String(i.documento_unico).toLowerCase().includes(doc)));
      if (!hit) return mensaje(msg, 'No hay información que coincida con la búsqueda.');
      programaId = hit.programa_id;
      cuentaId = hit.beneficiario_id;
    } catch (e) { return mensaje(msg, e.message); }
  }

  // ---- Datos ----
  let programa, inscripcion;
  try {
    const rp = await api(`/api/programas/${encodeURIComponent(programaId)}`);
    programa = rp.dato ?? rp.datos;
    const ri = await api(`/api/inscripciones/${encodeURIComponent(cuentaId)}`);
    inscripcion = ri.datos.find((i) => String(i.programa_id ?? i.id) === String(programaId));
    if (!programa) return mensaje(msg, 'Programa no encontrado.');
    if (!inscripcion) return mensaje(msg, 'Inscripción no encontrada.');
  } catch (e) { return mensaje(msg, e.message); }

  $('#titulo').textContent = programa.nombre;

  // Requisitos del programa
  const reqs = programa.requisitos || [];
  $('#listaPrograma').innerHTML = reqs.length
    ? reqs.map((r) => `<li><span>${escapar(r.nombre || r.campo || '')}</span>
        <b>${escapar(r.tipo || '')}${r.obligatorio ? ' · obligatorio' : ''}${(r.opciones || []).length ? ' · ' + escapar(r.opciones.join(', ')) : ''}</b></li>`).join('')
    : '<li>No hay información sobre requisitos del programa.</li>';

  // Requisitos de la inscripción
  const ri = inscripcion.requisitos || {};
  const resp = Object.entries(ri.respuestas || {});
  const cuenta = ri.datos_cuenta || [];
  $('#listaInscripcion').innerHTML = (resp.length || cuenta.length)
    ? resp.map(([k, v]) => `<li><span>${escapar(k)}</span><b>${escapar(v)}</b></li>`).join('') +
      cuenta.map((c) => `<li><span>Dato de cuenta</span><b>${escapar(c)}</b></li>`).join('')
    : '<li>No hay información sobre requisitos de la inscripción.</li>';

  // ---- Acciones ----
  const btnA = $('#btnAprobar');
  const btnC = $('#btnCancelar');
  btnA.disabled = btnC.disabled = false;

  const url = `/api/inscripciones/${encodeURIComponent(cuentaId)}/${encodeURIComponent(programaId)}/estado`;
  async function cambiarEstado(estado, motivo = '') {
    btnA.disabled = btnC.disabled = true;
    try {
      const r = await api(url, { method: 'PUT', body: JSON.stringify({ estado, motivo }) });
      mensaje(msg, r.mensaje || 'Estado actualizado.', 'exito');
    } catch (e) {
      mensaje(msg, e.message);
      btnA.disabled = btnC.disabled = false;
    }
  }

  btnA.addEventListener('click', () => cambiarEstado('aprovada'));

  let pidiendoMotivo = false;
  btnC.addEventListener('click', () => {
    if (!pidiendoMotivo) {
      pidiendoMotivo = true;
      $('#motivo').classList.remove('oculto');
      $('#motivo').focus();
      return;
    }
    cambiarEstado('cancelada', $('#motivo').value.trim());
  });
})();