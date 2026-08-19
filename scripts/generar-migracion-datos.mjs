/**
 * Genera el SQL de migración de la temporada 2025/26 desde el Google Sheet.
 *
 *   node scripts/generar-migracion-datos.mjs
 *
 * Escribe supabase/migrations/0002_datos_2025_26.sql. No toca la base de datos:
 * el SQL se revisa y se ejecuta a mano en el SQL Editor de Supabase, de forma
 * que este script nunca necesita credenciales de escritura.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLAYER_POSITIONS } from '../src/data/posiciones.js';
import {
  GOOGLE_SHEET_ID,
  VICTORIAS_RANGE,
  PARTICIPACION_RANGE,
  EXCLUDED_PLAYERS,
} from '../src/constants.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(ROOT, 'supabase', 'migrations', '0002_datos_2025_26.sql');
const TEMPORADA = '2025/26';

// ---------------------------------------------------------------------------
// Parseo del Sheet (mismo formato que consume hoy la app)
// ---------------------------------------------------------------------------

function parseGviz(text) {
  const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\)/s);
  if (!match) throw new Error('Respuesta gviz no reconocida');
  return JSON.parse(match[1]);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else { inQuotes = false; }
      } else cell += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(cell); cell = ''; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    if (ch === '\r') continue;
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

const toNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const norm = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

async function leerSheet() {
  const gviz = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&range=`;
  const csv = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&range=`;

  const [resV, resP] = await Promise.all([
    fetch(gviz + encodeURIComponent(VICTORIAS_RANGE)),
    fetch(csv + encodeURIComponent(PARTICIPACION_RANGE)),
  ]);
  if (!resV.ok) throw new Error(`Victorias HTTP ${resV.status}`);
  if (!resP.ok) throw new Error(`Participación HTTP ${resP.status}`);

  const [textV, textP] = await Promise.all([resV.text(), resP.text()]);
  return { victorias: parseGviz(textV).table, participacion: parseCsv(textP) };
}

/** nombre normalizado -> array de victorias por jornada (1 | 0.5 | 0 | null) */
function mapaVictorias(table) {
  const map = new Map();
  for (const row of table.rows ?? []) {
    const nombre = typeof row.c?.[1]?.v === 'string' ? row.c[1].v.trim() : null;
    if (!nombre || nombre === 'Victorias') continue;
    const porJornada = (row.c.slice(5) ?? []).map((c) => {
      const v = c?.v;
      return v === null || v === undefined || v === '' ? null : toNumber(v);
    });
    // Totales que el propio Sheet declara, para verificar contra lo derivado.
    map.set(norm(nombre), { nombre, porJornada, vSheet: toNumber(row.c[2]?.v) });
  }
  return map;
}

/**
 * nombre normalizado -> array de participación por jornada (1 | 'R' | null)
 *
 * El nombre está siempre en la columna B (índice 1). No se usa heurística de
 * "primera celda que parezca un nombre": la fila 2 del Sheet es una cabecera
 * (`,,T,A,R,...`) y esa heurística la interpreta como un jugador llamado "A".
 */
function mapaParticipacion(rows) {
  const esNombre = (s) => {
    if (typeof s !== 'string') return false;
    const t = s.trim();
    if (!t || ['Jornada', 'Victorias', 'T', 'Total:'].includes(t)) return false;
    if (/^\d+(\.\d+)?$/.test(t)) return false;
    return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(t);
  };

  const map = new Map();
  for (const row of rows) {
    const values = row ?? [];
    if (!esNombre(values[1])) continue;
    const nombre = String(values[1]).trim();
    const porJornada = (values.slice(5) ?? []).map((v) => {
      if (v === null || v === undefined || v === '') return null;
      if (typeof v === 'string' && v.trim().toUpperCase() === 'R') return 'R';
      return toNumber(v);
    });
    // Columna C = total partidos jugados · Columna E = total reservas.
    map.set(norm(nombre), {
      nombre,
      porJornada,
      pjSheet: toNumber(values[2]),
      reservasSheet: toNumber(values[4]),
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Construcción del modelo
// ---------------------------------------------------------------------------

function construir(victorias, participacion) {
  // Universo de jugadores: unión de ambas tablas.
  const jugadores = new Map(); // norm -> { nombre, tipo }
  for (const [k, { nombre }] of participacion) jugadores.set(k, { nombre });
  for (const [k, { nombre }] of victorias) if (!jugadores.has(k)) jugadores.set(k, { nombre });

  for (const [k, j] of jugadores) {
    // Los antiguos EXCLUDED_PLAYERS son invitados y filas placeholder: entran
    // como 'invitado' para no perder quién estaba en pista, pero la vista de
    // clasificación los filtra.
    j.tipo = EXCLUDED_PLAYERS.has(j.nombre) ? 'invitado' : 'habitual';
    j.pos = PLAYER_POSITIONS[j.nombre] ?? null;
    jugadores.set(k, j);
  }

  const maxJornadas = Math.max(
    ...[...participacion.values()].map((p) => p.porJornada.length),
    ...[...victorias.values()].map((v) => v.porJornada.length)
  );

  const jornadas = [];
  for (let i = 0; i < maxJornadas; i++) {
    const jugaron = [];
    const reservas = [];

    for (const [k] of jugadores) {
      const part = participacion.get(k)?.porJornada[i] ?? null;
      const vic = victorias.get(k)?.porJornada[i] ?? null;
      if (part === 'R') reservas.push(k);
      else if (part === 1) jugaron.push({ key: k, vic });
    }

    if (jugaron.length === 0 && reservas.length === 0) continue;

    const hayEmpate = jugaron.some((p) => p.vic === 0.5);
    const ganadores = jugaron.filter((p) => p.vic === 1);

    let resultado = null;
    let alineaciones = [];

    if (hayEmpate) {
      // El Excel marcaba 0.5 a todos sin distinguir bandos: no se puede
      // reconstruir el reparto, así que se deja el equipo desconocido.
      resultado = 'empate';
      alineaciones = jugaron.map((p) => ({ key: p.key, equipo: null }));
    } else if (ganadores.length > 0) {
      resultado = 'a';
      alineaciones = jugaron.map((p) => ({ key: p.key, equipo: p.vic === 1 ? 'a' : 'b' }));
    } else {
      // Jugaron pero no hay dato de resultado.
      alineaciones = jugaron.map((p) => ({ key: p.key, equipo: null }));
    }

    jornadas.push({ numero: i + 1, resultado, alineaciones, reservas });
  }

  return { jugadores, jornadas };
}

// ---------------------------------------------------------------------------
// Emisión de SQL
// ---------------------------------------------------------------------------

const s = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined ? 'null' : String(v));

function generarSql({ jugadores, jornadas }) {
  const L = [];
  const totalAlineaciones = jornadas.reduce((a, j) => a + j.alineaciones.length, 0);
  const totalReservas = jornadas.reduce((a, j) => a + j.reservas.length, 0);

  L.push('-- ============================================================================');
  L.push(`-- LIGA SOVIET · Datos de la temporada ${TEMPORADA}`);
  L.push('-- ============================================================================');
  L.push('-- GENERADO AUTOMÁTICAMENTE por scripts/generar-migracion-datos.mjs');
  L.push('-- No editar a mano: regenerar el fichero.');
  L.push('--');
  L.push(`-- Jugadores: ${jugadores.size}  ·  Jornadas: ${jornadas.length}`);
  L.push(`-- Alineaciones: ${totalAlineaciones}  ·  Reservas: ${totalReservas}`);
  L.push('--');
  L.push('-- Requiere 0001_esquema_inicial.sql ejecutado antes.');
  L.push('-- Todo va en una transacción: si algo falla, no queda nada a medias.');
  L.push('-- Ejecutarlo dos veces falla por el unique de temporadas.nombre.');
  L.push('-- ============================================================================');
  L.push('');
  L.push('begin;');
  L.push('');

  L.push('-- Temporada ----------------------------------------------------------------');
  L.push(`insert into temporadas (nombre, activa) values (${s(TEMPORADA)}, false);`);
  L.push('');

  L.push('-- Jugadores ----------------------------------------------------------------');
  L.push('insert into jugadores (nombre, pos_principal, pos_secundaria, tipo) values');
  const filasJ = [...jugadores.values()].map(
    (j) => `  (${s(j.nombre)}, ${n(j.pos?.principal ?? null)}, ${n(j.pos?.secundaria ?? null)}, ${s(j.tipo)})`
  );
  L.push(filasJ.join(',\n') + ';');
  L.push('');

  L.push('-- Jornadas -----------------------------------------------------------------');
  L.push("insert into jornadas (temporada_id, numero, estado)");
  L.push(`select t.id, v.numero, 'jugada'`);
  L.push(`from temporadas t, (values`);
  L.push(jornadas.map((j) => `  (${j.numero}::smallint)`).join(',\n'));
  L.push(`) as v(numero)`);
  L.push(`where t.nombre = ${s(TEMPORADA)};`);
  L.push('');

  L.push('-- Partidos (uno por jornada; sin marcador: el Excel no lo registraba) -------');
  L.push('insert into partidos (jornada_id, resultado)');
  L.push('select jo.id, v.resultado');
  L.push('from (values');
  L.push(
    jornadas
      .map((j, i) =>
        i === 0
          ? `  (${j.numero}::smallint, ${s(j.resultado)}::text)`
          : `  (${j.numero}, ${s(j.resultado)})`
      )
      .join(',\n')
  );
  L.push(') as v(numero, resultado)');
  L.push(`join temporadas t on t.nombre = ${s(TEMPORADA)}`);
  L.push('join jornadas jo on jo.temporada_id = t.id and jo.numero = v.numero;');
  L.push('');

  L.push('-- Alineaciones: quién jugó de verdad y en qué equipo ------------------------');
  L.push('insert into alineaciones (partido_id, jugador_id, equipo)');
  L.push('select pa.id, ju.id, v.equipo');
  L.push('from (values');
  const filasA = [];
  for (const j of jornadas) {
    for (const a of j.alineaciones) {
      const nombre = jugadores.get(a.key).nombre;
      filasA.push(
        filasA.length === 0
          ? `  (${j.numero}::smallint, ${s(nombre)}::text, ${s(a.equipo)}::text)`
          : `  (${j.numero}, ${s(nombre)}, ${s(a.equipo)})`
      );
    }
  }
  L.push(filasA.join(',\n'));
  L.push(') as v(jornada, nombre, equipo)');
  L.push(`join temporadas t on t.nombre = ${s(TEMPORADA)}`);
  L.push('join jornadas jo on jo.temporada_id = t.id and jo.numero = v.jornada');
  L.push('join partidos pa on pa.jornada_id = jo.id');
  L.push('join jugadores ju on ju.nombre = v.nombre;');
  L.push('');

  L.push('-- Convocatorias: lo previsto (titulares + reservas) -------------------------');
  L.push('insert into convocatorias (jornada_id, jugador_id, rol)');
  L.push('select jo.id, ju.id, v.rol');
  L.push('from (values');
  const filasC = [];
  for (const j of jornadas) {
    for (const a of j.alineaciones) {
      const nombre = jugadores.get(a.key).nombre;
      filasC.push(
        filasC.length === 0
          ? `  (${j.numero}::smallint, ${s(nombre)}::text, 'titular'::text)`
          : `  (${j.numero}, ${s(nombre)}, 'titular')`
      );
    }
    for (const key of j.reservas) {
      const nombre = jugadores.get(key).nombre;
      filasC.push(`  (${j.numero}, ${s(nombre)}, 'reserva')`);
    }
  }
  L.push(filasC.join(',\n'));
  L.push(') as v(jornada, nombre, rol)');
  L.push(`join temporadas t on t.nombre = ${s(TEMPORADA)}`);
  L.push('join jornadas jo on jo.temporada_id = t.id and jo.numero = v.jornada');
  L.push('join jugadores ju on ju.nombre = v.nombre;');
  L.push('');
  L.push('commit;');
  L.push('');

  return L.join('\n');
}

// ---------------------------------------------------------------------------
// Verificación · lo derivado debe coincidir con los totales del propio Sheet
// ---------------------------------------------------------------------------

/** Recorre el modelo de jornadas y devuelve PJ / V / Reservas por jugador. */
function derivarDelModelo({ jugadores, jornadas }) {
  const out = new Map();
  for (const [key] of jugadores) {
    let pj = 0;
    let v = 0;
    let reservas = 0;
    for (const jo of jornadas) {
      const linea = jo.alineaciones.find((a) => a.key === key);
      if (linea) {
        pj++;
        if (jo.resultado === 'empate') v += 0.5;
        else if (jo.resultado === 'a' && linea.equipo === 'a') v += 1;
      }
      if (jo.reservas.includes(key)) reservas++;
    }
    out.set(key, { pj, v, reservas });
  }
  return out;
}

/**
 * Criterio de aceptación: el modelo de jornadas (partidos + alineaciones +
 * equipos) debe reproducir exactamente lo que dicen las celdas del Sheet.
 *
 * Se compara por dos caminos distintos: el modelo pivotado por jornada frente
 * a la lectura directa de las filas. Si el reparto de equipos, la detección de
 * empates o el descarte de jornadas vacías fuera mal, saldría aquí.
 */
function verificar(modelo, victorias, participacion) {
  const derivado = derivarDelModelo(modelo);
  const fallos = [];

  for (const [key, jug] of modelo.jugadores) {
    const p = participacion.get(key);
    const v = victorias.get(key);
    if (!p) continue;

    let pjCeldas = 0;
    let vCeldas = 0;
    let resCeldas = 0;
    p.porJornada.forEach((estado, i) => {
      if (estado === 1) {
        pjCeldas++;
        vCeldas += v?.porJornada[i] ?? 0;
      } else if (estado === 'R') {
        resCeldas++;
      }
    });

    const d = derivado.get(key);
    const diffs = [];
    if (d.pj !== pjCeldas) diffs.push(`PJ ${d.pj} vs ${pjCeldas}`);
    if (Math.abs(d.v - vCeldas) > 1e-9) diffs.push(`V ${d.v} vs ${vCeldas}`);
    if (d.reservas !== resCeldas) diffs.push(`Res ${d.reservas} vs ${resCeldas}`);
    if (diffs.length > 0) fallos.push(`  ${jug.nombre.padEnd(16)} ${diffs.join(' · ')}`);
  }

  return fallos;
}

/**
 * Compara lo derivado con los totales que el Sheet declara en sus columnas de
 * suma. NO es un fallo: las fórmulas del Excel están sin extender a la última
 * jornada, así que van por detrás. Se informa para dejar constancia de en qué
 * se va a diferenciar la web nueva de la actual.
 */
function compararConTotalesDeclarados(modelo, victorias, participacion) {
  const derivado = derivarDelModelo(modelo);
  const avisos = [];

  for (const [key, jug] of modelo.jugadores) {
    if (jug.tipo !== 'habitual') continue;
    const d = derivado.get(key);
    const pjDecl = participacion.get(key)?.pjSheet ?? null;
    const vDecl = victorias.get(key)?.vSheet ?? null;

    const diffs = [];
    if (pjDecl !== null && d.pj !== pjDecl) diffs.push(`PJ ${pjDecl} -> ${d.pj}`);
    if (vDecl !== null && Math.abs(d.v - vDecl) > 1e-9) diffs.push(`V ${vDecl} -> ${d.v}`);
    if (diffs.length > 0) avisos.push(`  ${jug.nombre.padEnd(16)} ${diffs.join(' · ')}`);
  }

  return avisos;
}

// ---------------------------------------------------------------------------

const { victorias, participacion } = await leerSheet();
const mapV = mapaVictorias(victorias);
const mapP = mapaParticipacion(participacion);
const modelo = construir(mapV, mapP);

const fallos = verificar(modelo, mapV, mapP);

mkdirSync(dirname(SALIDA), { recursive: true });
writeFileSync(SALIDA, generarSql(modelo), 'utf8');

const habituales = [...modelo.jugadores.values()].filter((j) => j.tipo === 'habitual').length;
const invitados = modelo.jugadores.size - habituales;
console.log(`Escrito ${SALIDA}`);
console.log(`  Jugadores:  ${habituales} habituales + ${invitados} invitados`);
console.log(`  Jornadas:   ${modelo.jornadas.length}`);
console.log(`  Empates:    ${modelo.jornadas.filter((j) => j.resultado === 'empate').length}`);
console.log(`  Sin result: ${modelo.jornadas.filter((j) => j.resultado === null).length}`);
console.log('');

if (fallos.length === 0) {
  console.log('VERIFICACION OK — el modelo de partidos, equipos y reservas');
  console.log('reproduce exactamente las celdas del Sheet.');
} else {
  console.log(`VERIFICACION FALLIDA — ${fallos.length} jugador(es) no cuadran:`);
  console.log(fallos.join('\n'));
  console.log('');
  console.log('NO ejecutes el SQL generado hasta resolver esto.');
  process.exitCode = 1;
}

const avisos = compararConTotalesDeclarados(modelo, mapV, mapP);
if (avisos.length > 0) {
  console.log('');
  console.log(`AVISO — ${avisos.length} jugador(es) cambian respecto a la web actual.`);
  console.log('Las fórmulas de suma del Excel no cubren la última jornada, así que');
  console.log('los totales declarados van por detrás de las celdas. La BD calcula');
  console.log('desde las celdas, que son el registro real:');
  console.log(avisos.join('\n'));
}
