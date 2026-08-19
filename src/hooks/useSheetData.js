import { useEffect, useState } from 'react';
import { GOOGLE_SHEET_ID, VICTORIAS_RANGE, PARTICIPACION_RANGE, EXCLUDED_PLAYERS } from '../constants';

// ---------------------------------------------------------------------------
// Helpers de parseo
// ---------------------------------------------------------------------------

function parseGvizResponse(text) {
  const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\)/s);
  if (!match) throw new Error('Formato de respuesta de Google Sheets no reconocido');
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
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    if (ch === '\r') continue;

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizePlayerName(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function detectLatestJornadaFromClasificacion(clasificacion) {
  if (!clasificacion || clasificacion.length === 0) return null;

  const maxLen = Math.max(
    ...clasificacion.map((p) => p.jornadaParticipacion?.length ?? 0)
  );

  let latest = null;
  for (let i = 0; i < maxLen; i++) {
    let hasData = false;
    for (const player of clasificacion) {
      const part = player.jornadaParticipacion?.[i];
      const isReserve = typeof part === 'string' && part.trim().toUpperCase() === 'R';
      if (isReserve || part === 1) {
        hasData = true;
        break;
      }
    }
    if (hasData) latest = i + 1;
  }

  return latest;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function buildClasificacionFromTable(table) {
  if (!table || !table.rows) return [];

  const result = [];

  for (const row of table.rows) {
    if (!row.c || row.c.length === 0) continue;

    const nameCell = row.c[1];
    const totalVictoriesCell = row.c[2];
    const winPctCell = row.c[3];

    const nombre = typeof nameCell?.v === 'string' ? nameCell.v.trim() : nameCell?.v;
    if (!nombre || nombre === 'Victorias') continue;
    if (EXCLUDED_PLAYERS.has(nombre)) continue;

    const totalVictorias = toNumber(totalVictoriesCell?.v) ?? 0;
    const porcentaje = toNumber(winPctCell?.v) ?? 0;

    // Datos por jornada en Victorias (columnas F en adelante = índice 5+)
    const jornadaData = (row.c.slice(5) ?? []).map((c) => {
      const v = c?.v;
      if (v === null || v === undefined || v === '') return null;
      return toNumber(v);
    });

    result.push({
      nombre,
      pj: 0,
      v: totalVictorias,
      porcentaje,
      reservas: 0,
      jornadaVictorias: jornadaData,
    });
  }

  result.sort((a, b) => {
    if (b.v !== a.v) return b.v - a.v;
    return b.porcentaje - a.porcentaje;
  });

  return result.map((row, index) => ({ ...row, pos: index + 1 }));
}

function buildStatsFromParticipationRows(rows) {
  const map = new Map();

  const isProbablyPlayerName = (s) => {
    if (typeof s !== 'string') return false;
    const trimmed = s.trim();
    if (!trimmed) return false;
    if (['Jornada', 'Victorias', 'T', 'Total:'].includes(trimmed)) return false;
    if (/^\d+(\.\d+)?$/.test(trimmed)) return false;
    return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(trimmed);
  };

  for (const row of rows) {
    const values = row ?? [];
    const nameIdx = values.findIndex(isProbablyPlayerName);
    if (nameIdx === -1) continue;

    const nombre = String(values[nameIdx]).trim();
    const partidosJugados = toNumber(values[2]) ?? 0;
    // En participación CSV, la columna E contiene el total de reservas.
    const reservas = toNumber(values[4]) ?? 0;

    // En participación, la jornada 1 está en columna F.
    const jornadaParticipacion = (values.slice(5) ?? []).map((v) => {
      if (v === null || v === undefined || v === '') return null;
      if (typeof v === 'string' && v.trim().toUpperCase() === 'R') return 'R';
      return toNumber(v);
    });

    map.set(normalizePlayerName(nombre), { partidosJugados, reservas, jornadaParticipacion });
  }

  return map;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSheetData() {
  const [clasificacion, setClasificacion] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jornada, setJornada] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError('');

        const base = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&range=`;
        const csvBase = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&range=`;
        const urlV = base + encodeURIComponent(VICTORIAS_RANGE);
        const urlP = csvBase + encodeURIComponent(PARTICIPACION_RANGE);

        const [resV, resP] = await Promise.all([fetch(urlV), fetch(urlP)]);

        if (!resV.ok) throw new Error(`Error Victorias HTTP ${resV.status}`);
        if (!resP.ok) throw new Error(`Error Participación HTTP ${resP.status}`);

        const [textV, textP] = await Promise.all([resV.text(), resP.text()]);

        const jsonV = parseGvizResponse(textV);
        const csvRowsP = parseCsv(textP);

        const statsMap = buildStatsFromParticipationRows(csvRowsP);
        const base_data = buildClasificacionFromTable(jsonV.table);

        const merged = base_data
          .filter((r) => !EXCLUDED_PLAYERS.has(r.nombre))
          .map((r) => {
            const stats = statsMap.get(normalizePlayerName(r.nombre));
            return {
              ...r,
              pj: stats?.partidosJugados ?? r.pj,
              reservas: stats?.reservas ?? r.reservas,
              jornadaParticipacion: stats?.jornadaParticipacion ?? [],
            };
          })
          .map((r, idx) => ({ ...r, pos: idx + 1 }));

        // Igual criterio que Historial: jornada más alta con participación real.
        const jornadaDetected = detectLatestJornadaFromClasificacion(merged);
        setJornada(jornadaDetected);

        setClasificacion(merged);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Error al cargar datos de Google Sheets');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { clasificacion, loading, error, jornada };
}
