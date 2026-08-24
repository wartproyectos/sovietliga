import { useEffect, useMemo, useRef, useState } from 'react';
import { cargarEdicion, guardarEdicion } from '../lib/jornadaEditor';
import { IconoEstrella } from './IconoEstrella';

/**
 * Modal grande para editar toda la información de una jornada:
 *
 * - Marcador (puntos Negro / puntos Rojo)
 * - Composición de equipos (mover jugadores entre Negro/Rojo/Reserva o sacarlos)
 * - Añadir habituales o invitados nuevos a la jornada
 *
 * Se abre desde `HistorialPage`. Al guardar, escribe todos los cambios en
 * Supabase (ver `lib/jornadaEditor.js`) y avisa al padre con `onGuardado`.
 *
 * Convenio de equipos: 'a' = Negro, 'b' = Rojo. La UI habla en Negro/Rojo.
 */

const TEAM_LABEL = { a: 'Negro', b: 'Rojo' };

/**
 * @param {object} props
 * @param {number} props.jornadaNumero
 * @param {number} props.temporadaId
 * @param {string} [props.jornadaFechaIso] — YYYY-MM-DD; sólo se usa si hay
 *   que crear la jornada al vuelo (registro desde Convocatoria).
 * @param {object} [props.precarga] — reparto inicial que rellena el editor
 *   cuando la jornada aún no tiene datos en BD. Ignorado si la jornada ya
 *   tiene alineaciones o reservas guardadas.
 * @param {Array<{jugador_id: number, equipo: 'a'|'b'}>} props.precarga.titulares
 * @param {Array<number>} [props.precarga.reservas]
 * @param {number|null} [props.precarga.alineadorId] — jugador_id del alineador
 *   designado por el algoritmo.
 * @param {() => void} props.onCerrar
 * @param {() => void} props.onGuardado
 */
export function EditorJornadaModal({
  jornadaNumero,
  temporadaId,
  jornadaFechaIso,
  precarga,
  onCerrar,
  onGuardado,
}) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estado editable.
  const [asignados, setAsignados] = useState(new Map()); // jugadorId -> 'a'|'b'|'res'
  const [invitadosNuevos, setInvitadosNuevos] = useState([]); // { tempKey, nombre, equipo }
  const [puntosA, setPuntosA] = useState('');
  const [puntosB, setPuntosB] = useState('');
  const [alineadorId, setAlineadorId] = useState(undefined); // undefined = no tocar

  const [nuevoInvitadoAbierto, setNuevoInvitadoAbierto] = useState(false);
  const [nuevoInvitadoNombre, setNuevoInvitadoNombre] = useState('');
  const [nuevoInvitadoEquipo, setNuevoInvitadoEquipo] = useState('a');
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [pickerEquipo, setPickerEquipo] = useState('a');

  const [pending, setPending] = useState(false);
  const tempKeyRef = useRef(0);

  // Bloquear scroll de fondo mientras el modal está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [onCerrar]);

  // Carga inicial. Si la jornada no existe se crea al vuelo (necesario para
  // registrar desde Convocatoria); si viene vacía y hay `precarga`, se
  // rellena con ese reparto para que el admin no tenga que empezar de cero.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const snap = await cargarEdicion(temporadaId, jornadaNumero, jornadaFechaIso);
        if (cancelled) return;

        const vacia = snap.alineaciones.length === 0 && snap.reservas.length === 0;

        const m = new Map();
        if (vacia && precarga) {
          for (const t of precarga.titulares ?? []) m.set(t.jugador_id, t.equipo);
          for (const rid of precarga.reservas ?? []) m.set(rid, 'res');
          setAlineadorId(precarga.alineadorId ?? undefined);
        } else {
          for (const a of snap.alineaciones) {
            // Empates migrados con equipo=null: los ponemos por defecto en 'a'
            // para que el admin pueda repartirlos manualmente. Si guarda sin
            // moverlos, quedarán todos en Negro (comportamiento razonable — el
            // admin verá el problema antes de guardar).
            m.set(a.jugador_id, a.equipo ?? 'a');
          }
          for (const rid of snap.reservas) m.set(rid, 'res');
          // alineadorId queda como undefined -> no se toca al guardar
        }

        setSnapshot(snap);
        setAsignados(m);
        setPuntosA(snap.partido?.puntos_a != null ? String(snap.partido.puntos_a) : '');
        setPuntosB(snap.partido?.puntos_b != null ? String(snap.partido.puntos_b) : '');
      } catch (e) {
        if (!cancelled) setError(e.message || 'Error al cargar la jornada');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [temporadaId, jornadaNumero, jornadaFechaIso, precarga]);

  const jugadoresPorId = useMemo(() => {
    const map = new Map();
    for (const j of snapshot?.jugadores ?? []) map.set(j.id, j);
    return map;
  }, [snapshot]);

  // Alineador que se mostrará: el que se va a guardar si lo hay (precarga en
  // registros nuevos), y si no el que ya tiene la jornada en BD.
  const alineadorNombre = useMemo(() => {
    const idMostrar = alineadorId !== undefined ? alineadorId : snapshot?.jornada?.alineador_id;
    if (!idMostrar) return null;
    return jugadoresPorId.get(idMostrar)?.nombre ?? null;
  }, [alineadorId, snapshot, jugadoresPorId]);

  // Aviso bajo el marcador — refleja qué va a pasar realmente al guardar.
  // Distingue: (a) rellenaste marcador → resultado nuevo, (b) lo dejas vacío
  // pero ya hay resultado en BD → se preserva, (c) vacío sin resultado previo
  // → nadie aparecerá como ganador (típico origen de confusión).
  const avisoMarcador = useMemo(() => {
    if (loading || !snapshot) return null;

    const a = puntosA?.trim?.() ?? '';
    const b = puntosB?.trim?.() ?? '';
    const rellenoParcial = (a !== '' && b === '') || (a === '' && b !== '');
    if (rellenoParcial) {
      return { tono: 'warn', text: 'Rellena los dos marcadores o déjalos ambos vacíos.' };
    }

    const marcadorSet = a !== '' && b !== '';
    if (marcadorSet) {
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isFinite(na) || !Number.isFinite(nb) || na < 0 || nb < 0) {
        return { tono: 'warn', text: 'Los marcadores deben ser enteros positivos.' };
      }
      const ganador = na > nb ? 'Gana Negro' : nb > na ? 'Gana Rojo' : 'Empate';
      return { tono: 'ok', text: `${ganador} — el resultado se recalculará con este marcador.` };
    }

    const resultadoPrevio = snapshot.partido?.resultado ?? null;
    if (resultadoPrevio) {
      const etiqueta =
        resultadoPrevio === 'a' ? 'Negro ganó' : resultadoPrevio === 'b' ? 'Rojo ganó' : 'Empate';
      return {
        tono: 'info',
        text: `Sin marcador nuevo — se mantiene el resultado guardado (${etiqueta}).`,
      };
    }

    return {
      tono: 'warn',
      text: 'Sin marcador ni resultado previo — al guardar, nadie aparecerá como ganador.',
    };
  }, [loading, snapshot, puntosA, puntosB]);

  const listas = useMemo(() => {
    const negro = [];
    const rojo = [];
    const reserva = [];
    for (const [jid, eq] of asignados) {
      const j = jugadoresPorId.get(jid);
      if (!j) continue;
      const item = { key: `j-${jid}`, jid, nombre: j.nombre, tipo: j.tipo, esNuevo: false };
      if (eq === 'a') negro.push(item);
      else if (eq === 'b') rojo.push(item);
      else if (eq === 'res') reserva.push(item);
    }
    for (const n of invitadosNuevos) {
      const item = { key: `n-${n.tempKey}`, tempKey: n.tempKey, nombre: n.nombre, tipo: 'invitado', esNuevo: true };
      if (n.equipo === 'a') negro.push(item);
      else if (n.equipo === 'b') rojo.push(item);
      else if (n.equipo === 'res') reserva.push(item);
    }
    const sortFn = (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    negro.sort(sortFn); rojo.sort(sortFn); reserva.sort(sortFn);
    return { negro, rojo, reserva };
  }, [asignados, invitadosNuevos, jugadoresPorId]);

  const disponibles = useMemo(() => {
    const usados = new Set(asignados.keys());
    return (snapshot?.jugadores ?? [])
      .filter((j) => !usados.has(j.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }, [asignados, snapshot]);

  const cambiarEquipo = (item, nuevo) => {
    if (item.esNuevo) {
      setInvitadosNuevos((prev) => prev.map((n) => (n.tempKey === item.tempKey ? { ...n, equipo: nuevo } : n)));
    } else {
      setAsignados((prev) => {
        const next = new Map(prev);
        next.set(item.jid, nuevo);
        return next;
      });
    }
  };

  const quitar = (item) => {
    if (item.esNuevo) {
      setInvitadosNuevos((prev) => prev.filter((n) => n.tempKey !== item.tempKey));
    } else {
      setAsignados((prev) => {
        const next = new Map(prev);
        next.delete(item.jid);
        return next;
      });
    }
  };

  const anadirDelPicker = (jid) => {
    setAsignados((prev) => {
      const next = new Map(prev);
      next.set(jid, pickerEquipo);
      return next;
    });
    setPickerAbierto(false);
  };

  const anadirInvitadoNuevo = () => {
    const nombre = nuevoInvitadoNombre.trim();
    if (!nombre) return;
    tempKeyRef.current += 1;
    setInvitadosNuevos((prev) => [
      ...prev,
      { tempKey: tempKeyRef.current, nombre, equipo: nuevoInvitadoEquipo },
    ]);
    setNuevoInvitadoNombre('');
    setNuevoInvitadoAbierto(false);
  };

  const parseNum = (s) => {
    if (s == null || s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : NaN;
  };

  const guardar = async () => {
    try {
      setPending(true);
      setError('');

      const nA = parseNum(puntosA);
      const nB = parseNum(puntosB);
      if (nA !== null && Number.isNaN(nA)) throw new Error('Puntos Negro inválidos');
      if (nB !== null && Number.isNaN(nB)) throw new Error('Puntos Rojo inválidos');
      if ((nA === null) !== (nB === null)) throw new Error('Rellena ambos marcadores o déjalos vacíos');

      const titulares = [];
      for (const [jid, eq] of asignados) {
        if (eq === 'a' || eq === 'b') titulares.push({ jugador_id: jid, equipo: eq });
      }
      const reservas = [];
      for (const [jid, eq] of asignados) {
        if (eq === 'res') reservas.push(jid);
      }
      const invNuevos = invitadosNuevos.map((n) => ({ nombre: n.nombre, equipo: n.equipo }));

      await guardarEdicion({
        jornada: snapshot.jornada,
        partido: snapshot.partido,
        puntosA: nA,
        puntosB: nB,
        titulares,
        reservas,
        invitadosNuevos: invNuevos,
        alineadorId, // undefined => no toca la columna; sí toca cuando viene precarga
      });

      onGuardado?.();
    } catch (e) {
      setError(e.message || 'No se pudo guardar');
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Editar jornada ${jornadaNumero}`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-[color:rgb(20_10_10/0.55)] backdrop-blur-[2px]"
        onClick={onCerrar}
        aria-label="Cerrar"
      />

      <div className="relative w-full max-w-md bg-[var(--sv-surface)] shadow-[10px_10px_0_rgba(0,0,0,0.5)] max-h-[92vh] flex flex-col">
        <div className="h-1.5 bg-[var(--sv-primary)] shrink-0" />

        {/* Cabecera. */}
        <div className="bg-[var(--sv-on-surface)] px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <IconoEstrella className="w-5 h-5 text-[var(--sv-primary)] shrink-0" />
            <h3 className="font-[Oswald] text-xl font-bold uppercase tracking-[0.02em] text-[var(--sv-surface)] truncate">
              Editar Jornada {jornadaNumero}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="shrink-0 w-7 h-7 border-2 border-[var(--sv-surface)] flex items-center justify-center text-[var(--sv-surface)] hover:bg-[color:rgb(242_234_217/0.15)] transition-colors"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
              <path d="M4 4l12 12M16 4L4 16" />
            </svg>
          </button>
        </div>

        {/* Alineador designado — solo si hay uno. */}
        {alineadorNombre && (
          <div className="bg-[color:rgb(196_18_48/0.12)] border-b-2 border-[var(--sv-primary)] px-5 py-2 flex items-center gap-2 shrink-0">
            <span className="font-[Oswald] text-[10px] font-bold uppercase tracking-[0.11em] text-[var(--sv-primary)]">
              Alineador:
            </span>
            <span className="text-[12px] font-bold uppercase tracking-[0.02em] text-[var(--sv-on-surface)]">
              {alineadorNombre}
            </span>
          </div>
        )}

        {/* Cuerpo scrolleable. */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-6 text-sm text-[var(--sv-on-surface-muted)]">Cargando…</p>
          ) : !snapshot ? (
            <p className="p-6 text-sm text-[var(--sv-primary)]">{error || 'No se pudo cargar'}</p>
          ) : (
            <div className="p-4 flex flex-col gap-5">
              {/* Marcador. */}
              <section>
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--sv-on-surface-muted)] mb-2 font-[Oswald]">
                  Marcador
                </p>
                <div className="flex items-center justify-center gap-3">
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--sv-on-surface)] font-[Oswald]">
                      Negro
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={puntosA}
                      onChange={(e) => setPuntosA(e.target.value)}
                      className="w-full text-center border-2 border-[var(--sv-on-surface)] bg-white py-3 text-2xl font-[Oswald] font-bold focus:outline-none focus:border-[var(--sv-primary)]"
                    />
                  </div>
                  <span className="text-2xl text-[var(--sv-on-surface-muted)] font-[Oswald]">–</span>
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--sv-primary)] font-[Oswald]">
                      Rojo
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={puntosB}
                      onChange={(e) => setPuntosB(e.target.value)}
                      className="w-full text-center border-2 border-[var(--sv-primary)] bg-white py-3 text-2xl font-[Oswald] font-bold focus:outline-none"
                    />
                  </div>
                </div>
                {avisoMarcador && (
                  <p
                    aria-live="polite"
                    className={`mt-2 text-[12px] leading-snug ${
                      avisoMarcador.tono === 'ok'
                        ? 'text-[var(--sv-verde)] font-semibold'
                        : avisoMarcador.tono === 'warn'
                          ? 'text-[var(--sv-primary)] font-semibold'
                          : 'text-[var(--sv-on-surface-muted)]'
                    }`}
                  >
                    {avisoMarcador.text}
                  </p>
                )}
              </section>

              {/* Equipo Negro. */}
              <SeccionEquipo
                titulo="Equipo Negro"
                equipo="a"
                cabeceraBg="bg-[var(--sv-on-surface)] text-white"
                items={listas.negro}
                onCambiar={cambiarEquipo}
                onQuitar={quitar}
              />

              {/* Equipo Rojo. */}
              <SeccionEquipo
                titulo="Equipo Rojo"
                equipo="b"
                cabeceraBg="bg-[var(--sv-primary)] text-white"
                items={listas.rojo}
                onCambiar={cambiarEquipo}
                onQuitar={quitar}
              />

              {/* Reservas. */}
              <SeccionEquipo
                titulo="Reservas"
                equipo="res"
                cabeceraBg="bg-amber-500 text-white"
                items={listas.reserva}
                onCambiar={cambiarEquipo}
                onQuitar={quitar}
              />

              {/* Añadir jugador. */}
              <section className="border-2 border-dashed border-[var(--sv-on-surface-muted)] p-3 flex flex-col gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--sv-on-surface-muted)] font-[Oswald]">
                  Añadir a la jornada
                </p>

                {pickerAbierto ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em]">
                      <span className="text-[var(--sv-on-surface-muted)] font-[Oswald]">En:</span>
                      <SegmentEquipo valor={pickerEquipo} onChange={setPickerEquipo} incluyeReserva />
                    </div>
                    <div className="max-h-40 overflow-y-auto border sv-ghost-line">
                      {disponibles.length === 0 ? (
                        <p className="p-3 text-xs italic text-[var(--sv-on-surface-muted)]">
                          No quedan jugadores disponibles.
                        </p>
                      ) : (
                        disponibles.map((j) => (
                          <button
                            key={j.id}
                            type="button"
                            onClick={() => anadirDelPicker(j.id)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-[var(--sv-surface-low)] transition-colors"
                          >
                            <span className="font-bold uppercase truncate">{j.nombre}</span>
                            <span className="text-[10px] uppercase text-[var(--sv-on-surface-muted)] font-[Oswald] tracking-[0.06em] shrink-0">
                              {j.tipo === 'invitado' ? 'invitado' : 'habitual'}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPickerAbierto(false)}
                      className="self-end text-[11px] uppercase tracking-[0.09em] text-[var(--sv-on-surface-muted)] hover:text-[var(--sv-on-surface)] font-[Oswald]"
                    >
                      Cerrar picker
                    </button>
                  </div>
                ) : nuevoInvitadoAbierto ? (
                  <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-[0.09em] font-bold text-[var(--sv-on-surface-muted)] font-[Oswald]">
                        Nombre del invitado
                      </span>
                      <input
                        type="text"
                        value={nuevoInvitadoNombre}
                        onChange={(e) => setNuevoInvitadoNombre(e.target.value)}
                        placeholder="Ej: Amigo de Adri"
                        className="border-2 border-[var(--sv-on-surface)] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[var(--sv-primary)]"
                        autoFocus
                      />
                    </label>
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em]">
                      <span className="text-[var(--sv-on-surface-muted)] font-[Oswald]">En:</span>
                      <SegmentEquipo valor={nuevoInvitadoEquipo} onChange={setNuevoInvitadoEquipo} incluyeReserva />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setNuevoInvitadoAbierto(false); setNuevoInvitadoNombre(''); }}
                        className="flex-1 border-2 border-[var(--sv-on-surface)] px-3 py-2 text-[12px] font-bold uppercase tracking-[0.09em] font-[Oswald] hover:bg-[var(--sv-surface-low)]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={anadirInvitadoNuevo}
                        disabled={!nuevoInvitadoNombre.trim()}
                        className="sv-cta flex-1 text-[12px] py-2 disabled:opacity-60"
                      >
                        Añadir
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPickerAbierto(true)}
                      className="border-2 border-[var(--sv-on-surface)] py-2 text-[12px] font-bold uppercase tracking-[0.09em] font-[Oswald] hover:bg-[var(--sv-surface-low)]"
                    >
                      Del listado
                    </button>
                    <button
                      type="button"
                      onClick={() => setNuevoInvitadoAbierto(true)}
                      className="border-2 border-[var(--sv-primary)] text-[var(--sv-primary)] py-2 text-[12px] font-bold uppercase tracking-[0.09em] font-[Oswald] hover:bg-[var(--sv-primary)] hover:text-white transition-colors"
                    >
                      + Invitado nuevo
                    </button>
                  </div>
                )}
              </section>

              {error && (
                <p
                  role="alert"
                  className="text-[12px] font-bold text-[var(--sv-primary)] uppercase tracking-[0.06em]"
                >
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Pie con acciones. */}
        <div className="p-4 border-t-2 border-[var(--sv-on-surface)] flex gap-2 shrink-0 bg-[var(--sv-surface)]">
          <button
            type="button"
            onClick={onCerrar}
            className="flex-1 border-2 border-[var(--sv-on-surface)] px-4 py-3 text-[13px] font-bold uppercase tracking-[0.09em] font-[Oswald] hover:bg-[var(--sv-surface-low)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={pending || loading}
            className="sv-cta flex-1 text-[13px] py-3 disabled:opacity-60"
          >
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes internos.
// ---------------------------------------------------------------------------

function SeccionEquipo({ titulo, equipo, cabeceraBg, items, onCambiar, onQuitar }) {
  return (
    <section className="border-2 border-[var(--sv-on-surface)]">
      <div className={`px-3 py-2 flex items-center justify-between ${cabeceraBg}`}>
        <h4 className="font-[Oswald] text-[13px] font-bold uppercase tracking-[0.1em]">{titulo}</h4>
        <span className="font-[Oswald] text-[11px] font-bold">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-3 py-3 text-xs italic text-[var(--sv-on-surface-muted)] bg-white">Sin jugadores</p>
      ) : (
        items.map((it) => (
          <FilaEditor key={it.key} item={it} equipoActual={equipo} onCambiar={onCambiar} onQuitar={onQuitar} />
        ))
      )}
    </section>
  );
}

function FilaEditor({ item, equipoActual, onCambiar, onQuitar }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b sv-ghost-line last:border-b-0 bg-white">
      <span className="flex-1 min-w-0 font-bold uppercase text-[13px] truncate">
        {item.nombre}
        {item.tipo === 'invitado' && (
          <span className="ml-2 text-[9px] font-normal normal-case text-amber-600 uppercase tracking-[0.1em] font-[Oswald]">
            invitado{item.esNuevo ? ' (nuevo)' : ''}
          </span>
        )}
      </span>
      <SegmentMovimiento actual={equipoActual} onCambiar={(eq) => onCambiar(item, eq)} />
      <button
        type="button"
        onClick={() => onQuitar(item)}
        aria-label={`Quitar ${item.nombre}`}
        className="w-7 h-7 flex items-center justify-center text-[var(--sv-on-surface-muted)] hover:text-[var(--sv-primary)] transition-colors"
        title="Sacar de la jornada"
      >
        <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M4 4l12 12M16 4L4 16" />
        </svg>
      </button>
    </div>
  );
}

function SegmentMovimiento({ actual, onCambiar }) {
  return (
    <div className="flex border-2 border-[var(--sv-on-surface)] overflow-hidden shrink-0">
      {['a', 'b', 'res'].map((eq) => {
        const activo = actual === eq;
        return (
          <button
            key={eq}
            type="button"
            onClick={() => onCambiar(eq)}
            className={`px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] font-[Oswald] transition-colors ${
              activo
                ? eq === 'a'
                  ? 'bg-[var(--sv-on-surface)] text-white'
                  : eq === 'b'
                    ? 'bg-[var(--sv-primary)] text-white'
                    : 'bg-amber-500 text-white'
                : 'bg-white text-[var(--sv-on-surface)] hover:bg-[var(--sv-surface-low)]'
            }`}
            aria-pressed={activo}
          >
            {eq === 'a' ? 'N' : eq === 'b' ? 'R' : 'Res'}
          </button>
        );
      })}
    </div>
  );
}

function SegmentEquipo({ valor, onChange, incluyeReserva = false }) {
  const opciones = incluyeReserva ? ['a', 'b', 'res'] : ['a', 'b'];
  const label = { a: 'Negro', b: 'Rojo', res: 'Reserva' };
  return (
    <div className="flex border-2 border-[var(--sv-on-surface)] overflow-hidden">
      {opciones.map((eq) => {
        const activo = valor === eq;
        return (
          <button
            key={eq}
            type="button"
            onClick={() => onChange(eq)}
            className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] font-[Oswald] transition-colors ${
              activo
                ? eq === 'a'
                  ? 'bg-[var(--sv-on-surface)] text-white'
                  : eq === 'b'
                    ? 'bg-[var(--sv-primary)] text-white'
                    : 'bg-amber-500 text-white'
                : 'bg-white text-[var(--sv-on-surface)] hover:bg-[var(--sv-surface-low)]'
            }`}
            aria-pressed={activo}
          >
            {label[eq]}
          </button>
        );
      })}
    </div>
  );
}
