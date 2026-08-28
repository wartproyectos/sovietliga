import { useEffect, useState, useMemo } from 'react';
import { FORM_RESPONSES_SHEET_ID } from '../constants';
import { useTemporada } from '../contexts/TemporadaContext';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { inQ = true; continue; }
    if (ch === ',') { row.push(cell); cell = ''; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    if (ch === '\r') continue;
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

function parseTimestamp(str) {
  const [datePart, timePart] = (str ?? '').trim().split(' ');
  if (!datePart || !timePart) return null;
  const [day, month, year] = datePart.split('/').map(Number);
  const [hours, minutes, seconds] = timePart.split(':').map(Number);
  if ([day, month, year, hours, minutes, seconds].some((n) => !Number.isFinite(n))) return null;
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

/**
 * Fecha del próximo partido y su número dentro de la temporada.
 * `inicio` es un `Date` con el lunes de la jornada 1.
 */
export function getProximaJornada(inicio) {
  const now = new Date();

  if (now < inicio) {
    return { numero: 1, fecha: new Date(inicio) };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const msPerWeek = 7 * msPerDay;
  const weekNumber = Math.floor((now - inicio) / msPerWeek);
  const thisMonday = new Date(inicio.getTime() + weekNumber * msPerWeek);

  // Si ya pasó el martes, la siguiente jornada es la de la semana que viene.
  if (now >= new Date(thisMonday.getTime() + msPerDay)) {
    return { numero: weekNumber + 2, fecha: new Date(thisMonday.getTime() + msPerWeek) };
  }

  return { numero: weekNumber + 1, fecha: thisMonday };
}

export function getVentana(fechaPartido) {
  const friday = new Date(fechaPartido);
  friday.setDate(fechaPartido.getDate() - 3);
  friday.setHours(0, 0, 0, 0);

  const sunday = new Date(fechaPartido);
  sunday.setDate(fechaPartido.getDate() - 1);
  sunday.setHours(12, 0, 0, 0);

  return { inicio: friday, fin: sunday };
}

/**
 * `fecha_inicio` viene como 'YYYY-MM-DD' (columna date de Postgres). El
 * constructor de Date con guiones lo interpreta como UTC; construir por partes
 * evita el desfase de hora local.
 */
function fechaInicioLocal(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function useDisponibilidad() {
  const { activa } = useTemporada();
  const [respuestas, setRespuestas] = useState(null);
  const [invitados, setInvitados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { jornada, ventana } = useMemo(() => {
    const inicio = fechaInicioLocal(activa?.fecha_inicio);
    if (!inicio) return { jornada: null, ventana: null };
    const j = getProximaJornada(inicio);
    return { jornada: j, ventana: getVentana(j.fecha) };
  }, [activa]);

  useEffect(() => {
    if (!ventana) return;

    async function fetchData() {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${FORM_RESPONSES_SHEET_ID}/export?format=csv`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Error al leer respuestas: HTTP ${res.status}`);
        const text = await res.text();
        const rows = parseCsv(text);

        const data = rows
          .slice(1)
          .map((row) => ({
            timestamp: parseTimestamp(row[0]),
            nombre: (row[1] ?? '').trim(),
            disponibilidad: (row[2] ?? '').trim(),
          }))
          .filter((r) => r.timestamp && r.nombre && r.disponibilidad);

        const enVentana = data.filter(
          (r) => r.timestamp >= ventana.inicio && r.timestamp <= ventana.fin,
        );

        // Si un jugador manda varias respuestas en la misma ventana (típico:
        // se equivocó y volvió a enviar), sólo cuenta la de timestamp más
        // reciente. Los invitados ("Otro") no se colapsan: cada uno es una
        // persona distinta.
        const porJugador = new Map();
        const invitadosList = [];

        for (const r of enVentana) {
          if (r.nombre === 'Otro') {
            invitadosList.push(r);
          } else {
            const existing = porJugador.get(r.nombre);
            if (!existing || r.timestamp > existing.timestamp) {
              porJugador.set(r.nombre, r);
            }
          }
        }

        setRespuestas(porJugador);
        setInvitados(invitadosList.filter((r) => r.disponibilidad === 'Convocable'));
      } catch (err) {
        console.error(err);
        setError(err.message || 'Error al cargar disponibilidad');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [ventana]);

  return { respuestas, invitados, loading, error, jornada, ventana };
}
