// Uso: programa.html?id=123
const ID = new URLSearchParams(location.search).get('id');
const API = `/api/programas/${encodeURIComponent(ID)}`;
const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';

function aviso(texto) {
  const m = $('mensaje');
  m.textContent = texto;
  m.className = 'mensaje visible error';
}

async function pedir(url) {
  const r = await fetch(url, { credentials: 'same-origin' });
  if (!r.ok) throw new Error(`Error ${r.status}`);
  return r.json();
}

/* Programa: { nombre, tipo, entrega, descripcion, cupos_maximos } */
async function cargarInfo() {
  const p = await pedir(API);
  $('tNombre').textContent = p.nombre ?? 'Programa';
  $('iTipo').textContent = p.tipo ?? '';
  $('iEntrega').textContent = p.entrega ?? '';
  $('iDescripcion').textContent = p.descripcion ?? '';
  $('iCupos').textContent = p.cupos_maximos ?? '';
  document.title = `${p.nombre} - Portal de Subsidios`;
}

function punto(cx, cy, r, ang) {
  return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
}

function pastel(titulo, datos) {
  const total = datos.reduce((s, d) => s + d.valor, 0);
  const cont = document.createElement('div');
  cont.className = 'grafico';
  const h = document.createElement('h3');
  h.textContent = titulo;
  cont.appendChild(h);

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  const cx = 100, cy = 100, r = 90;
  let ini = -Math.PI / 2;

  datos.forEach((d) => {
    if (!d.valor || !total) return;
    const frac = d.valor / total;
    const fin = ini + frac * 2 * Math.PI;
    let forma;
    if (frac >= 0.9999) {
      forma = document.createElementNS(NS, 'circle');
      forma.setAttribute('cx', cx); forma.setAttribute('cy', cy); forma.setAttribute('r', r);
    } else {
      const [x1, y1] = punto(cx, cy, r, ini);
      const [x2, y2] = punto(cx, cy, r, fin);
      forma = document.createElementNS(NS, 'path');
      forma.setAttribute('d', `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${x2},${y2} Z`);
    }
    forma.setAttribute('fill', d.color);
    forma.setAttribute('stroke', '#303a4c');
    forma.setAttribute('stroke-width', '2');
    svg.appendChild(forma);

    const [tx, ty] = frac >= 0.9999 ? [cx, cy] : punto(cx, cy, r * 0.62, (ini + fin) / 2);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', tx); t.setAttribute('y', ty);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'middle');
    t.textContent = `${Math.round(frac * 100)}%`;
    svg.appendChild(t);
    ini = fin;
  });

  if (!total) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
    c.setAttribute('fill', '#667184');
    svg.appendChild(c);
  }
  cont.appendChild(svg);

  const ley = document.createElement('ul');
  ley.className = 'leyenda';
  datos.forEach((d) => {
    const li = document.createElement('li');
    const i = document.createElement('i');
    i.style.background = d.color;
    li.append(i, `${d.etiqueta}: ${d.valor}`);
    ley.appendChild(li);
  });
  cont.appendChild(ley);
  return cont;
}

/* Estadísticas: { enviados, recibidos, pendientes, cupos_ocupados, cupos_disponibles } */
async function cargarGraficos() {
  const e = await pedir(`${API}/estadisticas`);
  const g = $('graficos');
  g.replaceChildren(
    pastel('Estado de entregas', [
      { etiqueta: 'Enviados', valor: e.enviados, color: '#2477f3' },
      { etiqueta: 'Recibidos', valor: e.recibidos, color: '#1c9a5f' },
      { etiqueta: 'Pendientes de envío', valor: e.pendientes, color: '#c98a1b' },
    ]),
    pastel('Cupos', [
      { etiqueta: 'Ocupados', valor: e.cupos_ocupados, color: '#8b5cf6' },
      { etiqueta: 'Disponibles', valor: e.cupos_disponibles, color: '#3b4f6c' },
    ])
  );
}

$('btnCerrar').onclick = () => window.close();

if (!ID) {
  aviso('Falta el ID del programa.');
} else {
  Promise.all([cargarInfo(), cargarGraficos()]).catch((e) => aviso(e.message));
}
