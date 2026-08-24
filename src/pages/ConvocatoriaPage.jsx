import { useMemo, useState } from 'react';
import { useDisponibilidad } from '../hooks/useDisponibilidad';
import { useTemporada } from '../contexts/TemporadaContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { PageState } from '../components/PageState';
import { IconoEstrella } from '../components/IconoEstrella';
import { EditorJornadaModal } from '../components/EditorJornadaModal';
import { PLAZAS_CONVOCATORIA } from '../constants';
import { derivarEstadisticas, designarAlineador, generarConvocatoria } from '../lib/convocatoria';
import { balancearEquipos } from '../lib/equipos';
import { construirMensajeWhatsapp } from '../lib/mensajeWhatsapp';
import { BotonWhatsapp } from '../components/BotonWhatsapp';
import { posLabel } from '../data/posiciones';

/** Fecha local a YYYY-MM-DD, evitando el desfase que introduce toISOString(). */
function toIsoDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const formatFecha = (d) =>
  d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const formatCorto = (d) =>
  `${d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} ` +
  d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

// ------ Iconos de chip (20x20 con glifo blanco dentro) --------------------

function ChipIcono({ color, children }) {
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 shrink-0"
      style={{ backgroundColor: color }}
    >
      {children}
    </span>
  );
}

const IcoCheck = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="3" aria-hidden>
    <path d="M4 12l5 5L20 6" />
  </svg>
);
const IcoRefresh = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="2.5" aria-hidden>
    <path d="M4 12a8 8 0 0114-5.3M20 5v5h-5M20 12a8 8 0 01-14 5.3M4 19v-5h5" />
  </svg>
);
const IcoCruz = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="3" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const IcoReloj = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="2.5" aria-hidden>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </svg>
);

// ------ Piezas visuales ---------------------------------------------------

function TagNombre({ nombre, tono = 'ghost' }) {
  const styles = {
    win: 'bg-[var(--sv-primary)] text-white border-2 border-[var(--sv-primary)]',
    warm: 'bg-amber-500 text-white border-2 border-amber-500',
    ghost: 'bg-transparent text-[var(--sv-on-surface)] border-2 border-[var(--sv-on-surface)]',
    muted: 'bg-transparent text-[var(--sv-on-surface-muted)] border-2 border-dashed border-[var(--sv-on-surface-muted)]',
  };
  return (
    <span
      className={`inline-flex items-center px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.02em] ${styles[tono]}`}
    >
      {nombre}
    </span>
  );
}

function GrupoRespuestas({ titulo, extra, color, icono: Icono, nombres, tono, borderTop = false }) {
  return (
    <div className={`px-4 py-4 ${borderTop ? 'border-t border-[color:rgb(22_20_18/0.15)]' : ''}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <ChipIcono color={color}>
          <Icono />
        </ChipIcono>
        <span className="text-[13px] font-bold uppercase tracking-[0.02em] text-[var(--sv-on-surface)]">
          {titulo} ({nombres.length}){extra ? <span className="font-normal normal-case ml-1 text-[var(--sv-on-surface-muted)]">{extra}</span> : null}
        </span>
      </div>
      {nombres.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pl-7">
          {nombres.map((n) => (
            <TagNombre key={n} nombre={n} tono={tono} />
          ))}
        </div>
      ) : (
        <p className="pl-7 text-[13px] italic text-[var(--sv-on-surface-muted)]">Ninguno</p>
      )}
    </div>
  );
}

/** Fila de jugador dentro de la convocatoria. */
function FilaJugador({ jugador, indice, tono, etiqueta }) {
  const fondo = tono === 'titular' ? 'bg-white' : 'bg-[var(--sv-surface-low)]';
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-b sv-ghost-line last:border-b-0 ${fondo}`}>
      <span className="font-[Oswald] text-sm font-bold text-[var(--sv-primary)] w-6 shrink-0 tabular-nums">
        {String(indice).padStart(2, '0')}
      </span>
      <span className="font-bold uppercase text-[13px] text-[var(--sv-on-surface)] flex-1 min-w-0 truncate">
        {jugador.nombre}
        {etiqueta ? (
          <span className="ml-2 text-[10px] font-normal normal-case text-amber-600">{etiqueta}</span>
        ) : null}
      </span>
      <span className="font-[Oswald] text-[10px] text-[var(--sv-on-surface-muted)] uppercase tracking-[0.05em] shrink-0 text-right">
        {jugador.reservas} res · {jugador.pj} pj
        <br />
        {jugador.jugoJornadaAnterior ? 'jugó la última' : 'no jugó la última'}
      </span>
    </div>
  );
}

/** Fila dentro de un equipo. */
function FilaEquipo({ jugador, indice, esCambio }) {
  const pos = jugador.pos_principal;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b sv-ghost-line last:border-b-0 bg-white">
      <span className="font-[Oswald] text-[10px] font-bold text-[var(--sv-on-surface-muted)] w-14 shrink-0 uppercase tracking-[0.06em]">
        {esCambio ? 'Cambio' : String(indice).padStart(2, '0')}
      </span>
      <span className="font-bold uppercase text-[13px] text-[var(--sv-on-surface)] flex-1 min-w-0 truncate">
        {jugador.nombre}
      </span>
      <span className="font-[Oswald] text-[10px] text-[var(--sv-on-surface-muted)] uppercase tracking-[0.05em] shrink-0 text-right">
        {pos ? `${posLabel(pos)} (${pos})` : 'sin posición'} · {Math.round(jugador.porcentaje)}% V
      </span>
    </div>
  );
}

function TarjetaEquipo({ titulo, emoji, jugadores, cabecera }) {
  const media = jugadores.reduce((s, p) => s + p.porcentaje, 0) / (jugadores.length || 1);
  return (
    <section className="border-2 border-[var(--sv-on-surface)]">
      <div className={`px-4 py-3 flex items-center justify-between gap-3 ${cabecera}`}>
        <h3 className="font-[Oswald] text-sm font-bold uppercase tracking-[0.1em] flex items-center gap-2">
          <span className="text-base">{emoji}</span> {titulo}
        </h3>
        <span className="font-[Oswald] text-[11px] font-bold tracking-[0.08em]">
          Media {Math.round(media)}% V
        </span>
      </div>
      {jugadores.map((j, i) => (
        <FilaEquipo key={j.nombre} jugador={j} indice={i + 1} esCambio={i === jugadores.length - 1} />
      ))}
    </section>
  );
}

// ------ Página ------------------------------------------------------------

export function ConvocatoriaPage({ clasificacion, loading: clasifLoading, error: clasifError, ultimaJornada, onCambio }) {
  const { activa } = useTemporada();
  const { autenticado } = useAdminAuth();
  const {
    respuestas,
    invitados,
    loading: dispLoading,
    error: dispError,
    jornada,
    ventana,
  } = useDisponibilidad();

  const [verDetalle, setVerDetalle] = useState(false);
  const [editorAbierto, setEditorAbierto] = useState(false);

  const loading = clasifLoading || dispLoading;
  const error = clasifError || dispError;

  const { grupos, convocatoria, equipos, alineador } = useMemo(() => {
    if (!clasificacion.length || !respuestas || !jornada)
      return { grupos: null, convocatoria: null, equipos: null, alineador: null };

    const convocables = [];
    const voluntariosReserva = [];
    const noConvocables = [];
    const sinRespuesta = [];

    const porNombre = [...clasificacion].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
    );

    for (const player of porNombre) {
      const resp = respuestas.get(player.nombre);
      const stats = derivarEstadisticas(player, ultimaJornada ?? 0);

      if (!resp) sinRespuesta.push(player.nombre);
      else if (resp.disponibilidad === 'Convocable') convocables.push(stats);
      else if (resp.disponibilidad === 'Reserva') voluntariosReserva.push(stats);
      else noConvocables.push(player.nombre);
    }

    const convocatoria = generarConvocatoria({
      convocables,
      voluntariosReserva,
      invitados: invitados.length,
      semilla: jornada.numero,
    });

    return {
      grupos: {
        convocables: convocables.map((p) => p.nombre),
        voluntariosReserva: voluntariosReserva.map((p) => p.nombre),
        noConvocables,
        sinRespuesta,
      },
      convocatoria,
      // Devuelve null si no hay 12 exactos: sin plantilla completa no hay reparto.
      equipos: balancearEquipos(convocatoria.titulares),
      // Determinista por número de jornada — no cambia al refrescar.
      alineador: designarAlineador(convocatoria.titulares, jornada.numero),
    };
  }, [clasificacion, respuestas, invitados, jornada, ultimaJornada]);

  // Precarga para el editor de registro: reparte los 12 titulares por equipo
  // según el balanceador y marca los reservas como tal. Sólo se usa si la
  // jornada aún no tiene datos guardados; una vez registrada, el editor lee
  // el estado real desde BD y esto se ignora.
  const precargaEditor = useMemo(() => {
    if (!equipos || !convocatoria) return null;
    return {
      titulares: [
        ...equipos.equipo1.map((p) => ({ jugador_id: p.id, equipo: 'a' })),
        ...equipos.equipo2.map((p) => ({ jugador_id: p.id, equipo: 'b' })),
      ],
      reservas: convocatoria.reservas.map((p) => p.id).filter((id) => id != null),
      alineadorId: alineador?.id ?? null,
    };
  }, [equipos, convocatoria, alineador]);

  if (loading || error) {
    return <PageState loading={loading} error={error} loadingMessage="Cargando convocatoria…" />;
  }

  if (!jornada || !ventana) {
    return (
      <div className="mx-4 border-2 border-[var(--sv-on-surface)] bg-white p-6 text-sm text-[var(--sv-on-surface-muted)] uppercase tracking-[0.08em] font-[Oswald]">
        La temporada activa aún no tiene fecha de arranque. Configúrala en Supabase para poder
        preparar convocatorias.
      </div>
    );
  }

  const now = new Date();
  let estadoVentana;
  let estadoBg;
  if (now < ventana.inicio) {
    estadoVentana = 'Próximamente';
    estadoBg = 'bg-[var(--sv-on-surface-muted)]';
  } else if (now <= ventana.fin) {
    estadoVentana = 'Abierta';
    estadoBg = 'bg-[var(--sv-verde)]';
  } else {
    estadoVentana = 'Cerrada';
    estadoBg = 'bg-[var(--sv-primary)]';
  }

  const hayRespuestas =
    (grupos?.convocables.length ?? 0) +
      (grupos?.voluntariosReserva.length ?? 0) +
      (grupos?.noConvocables.length ?? 0) >
    0;

  const promocionados = new Set((convocatoria?.promocionados ?? []).map((p) => p.nombre));

  const mensaje = equipos
    ? construirMensajeWhatsapp({
        temporada: activa?.nombre,
        numeroJornada: jornada.numero,
        fecha: jornada.fecha,
        alineador: alineador?.nombre ?? null,
        equipoNegro: equipos.equipo1.map((p) => p.nombre),
        equipoRojo: equipos.equipo2.map((p) => p.nombre),
        reservas: convocatoria.reservas.map((p) => p.nombre),
      })
    : '';

  return (
    <div className="flex flex-col gap-6 px-4">
      {/* Cabecera. */}
      <div>
        <div className="flex items-center gap-3">
          <IconoEstrella className="w-6 h-6 text-[var(--sv-primary)] shrink-0" />
          <h2 className="text-[32px] sm:text-[36px] leading-none font-bold text-[var(--sv-on-surface)]">
            Convocatoria
          </h2>
        </div>
        <p className="mt-3 font-[Oswald] text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sv-on-surface-muted)]">
          Jornada {jornada.numero} — {formatFecha(jornada.fecha)}
        </p>
      </div>

      {/* Ventana de respuesta. */}
      <div>
        <div className="bg-[var(--sv-on-surface)] px-4 py-3 flex items-center justify-between gap-3">
          <span className="font-[Oswald] text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--sv-surface)]">
            Ventana de respuesta
          </span>
          <span
            className={`${estadoBg} font-[Oswald] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white`}
          >
            {estadoVentana}
          </span>
        </div>
        <div className="bg-white border-2 border-t-0 border-[var(--sv-on-surface)] px-4 py-3 font-semibold text-[13px] text-[var(--sv-on-surface)]">
          {formatCorto(ventana.inicio)} — {formatCorto(ventana.fin)}
        </div>
      </div>

      {!hayRespuestas ? (
        <div className="bg-white border-2 border-dashed border-[var(--sv-on-surface-muted)] p-5 italic text-[13px] text-[var(--sv-on-surface-soft)]">
          Todavía no hay respuestas en esta ventana. La convocatoria se genera sola en cuanto
          empiecen a llegar.
        </div>
      ) : (
        <>
          {/* Alineador designado — determinista por número de jornada. */}
          {alineador && (
            <div className="border-2 border-[var(--sv-on-surface)]">
              <div className="bg-[var(--sv-on-surface)] px-4 py-2 flex items-center gap-2">
                <IconoEstrella className="w-4 h-4 text-[var(--sv-primary)] shrink-0" />
                <span className="font-[Oswald] text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--sv-surface)]">
                  Alineador de la jornada
                </span>
              </div>
              <p className="px-4 py-3 bg-white font-bold uppercase text-[15px] text-[var(--sv-on-surface)] tracking-[0.02em]">
                {alineador.nombre}
              </p>
            </div>
          )}

          {/* Equipos — con 12 exactos; si no, lista plana. */}
          {equipos ? (
            <>
              <TarjetaEquipo
                titulo="Equipo Negro"
                emoji="🕷"
                jugadores={equipos.equipo1}
                cabecera="bg-[var(--sv-on-surface)] text-white"
              />
              <TarjetaEquipo
                titulo="Equipo Rojo"
                emoji="🌹"
                jugadores={equipos.equipo2}
                cabecera="bg-[var(--sv-primary)] text-white"
              />
            </>
          ) : (
            <section className="border-2 border-[var(--sv-on-surface)]">
              <div className="px-4 py-3 bg-[var(--sv-on-surface)] text-[var(--sv-surface)] flex items-center justify-between gap-3">
                <h3 className="font-[Oswald] text-sm font-bold uppercase tracking-[0.1em]">Convocados</h3>
                <span className="font-[Oswald] text-[11px] font-bold tracking-[0.08em]">
                  {convocatoria.titulares.length}/{PLAZAS_CONVOCATORIA}
                </span>
              </div>
              {convocatoria.titulares.map((j, i) => (
                <FilaJugador
                  key={j.nombre}
                  jugador={j}
                  indice={i + 1}
                  tono="titular"
                  etiqueta={promocionados.has(j.nombre) ? 'subió desde reserva' : null}
                />
              ))}
              {convocatoria.invitadosNecesarios > 0 && (
                <div className="px-4 py-3 bg-[color:rgb(196_18_48/0.08)] text-xs uppercase tracking-[0.06em] text-[var(--sv-primary)] font-[Oswald] font-bold">
                  Faltan {convocatoria.invitadosNecesarios} jugadores ·{' '}
                  {invitados.length > 0
                    ? `${invitados.length} invitado(s) apuntado(s)`
                    : 'hay que buscar amigos'}
                </div>
              )}
            </section>
          )}

          {/* Reservas. */}
          <section className="border-2 border-[var(--sv-on-surface)]">
            <div className="px-4 py-3 bg-amber-500 text-white flex items-center justify-between gap-3">
              <h3 className="font-[Oswald] text-sm font-bold uppercase tracking-[0.1em]">Reservas</h3>
              <span className="font-[Oswald] text-[11px] font-bold tracking-[0.08em]">
                {convocatoria.reservas.length}
              </span>
            </div>
            {convocatoria.reservas.length > 0 ? (
              convocatoria.reservas.map((j, i) => (
                <FilaJugador key={j.nombre} jugador={j} indice={i + 1} tono="reserva" />
              ))
            ) : (
              <p className="px-4 py-4 font-[Oswald] text-xs text-[var(--sv-on-surface-muted)] uppercase tracking-[0.08em]">
                Ninguna
              </p>
            )}
          </section>

          <BotonWhatsapp
            mensaje={mensaje}
            deshabilitado={!equipos}
            motivo={`Hacen falta ${PLAZAS_CONVOCATORIA} convocados para repartir los equipos (hay ${convocatoria.titulares.length})`}
          />

          {autenticado && (
            <button
              type="button"
              onClick={() => setEditorAbierto(true)}
              className="sv-cta w-full py-4 text-[14px]"
            >
              Registrar resultado del partido
            </button>
          )}
        </>
      )}

      {/* Detalle de respuestas. */}
      <section>
        <button
          type="button"
          onClick={() => setVerDetalle((v) => !v)}
          aria-expanded={verDetalle}
          aria-controls="detalle-respuestas"
          className="w-full bg-[var(--sv-on-surface)] px-4 py-3 flex items-center justify-between gap-3 text-left hover:brightness-110 transition"
        >
          <span className="font-[Oswald] text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--sv-surface)]">
            Respuestas del formulario
          </span>
          <span
            aria-hidden
            className={`text-[var(--sv-surface)] transition-transform text-sm ${verDetalle ? 'rotate-180' : ''}`}
          >
            ▼
          </span>
        </button>
        {verDetalle && grupos && (
          <div id="detalle-respuestas" className="bg-white border-2 border-t-0 border-[var(--sv-on-surface)]">
            <GrupoRespuestas
              titulo="Convocables"
              color="var(--sv-verde)"
              icono={IcoCheck}
              nombres={grupos.convocables}
              tono="win"
            />
            <GrupoRespuestas
              titulo="Se ofrecen de reserva"
              color="var(--sv-azul)"
              icono={IcoRefresh}
              nombres={grupos.voluntariosReserva}
              tono="warm"
              borderTop
            />
            <GrupoRespuestas
              titulo="No convocables"
              color="var(--sv-primary)"
              icono={IcoCruz}
              nombres={grupos.noConvocables}
              tono="ghost"
              borderTop
            />
            <GrupoRespuestas
              titulo="Sin respuesta"
              extra="— cuentan como no convocables"
              color="var(--sv-on-surface-muted)"
              icono={IcoReloj}
              nombres={grupos.sinRespuesta}
              tono="ghost"
              borderTop
            />
            {invitados.length > 0 && (
              <GrupoRespuestas
                titulo="Invitados apuntados"
                color="var(--sv-verde)"
                icono={IcoCheck}
                nombres={invitados.map((_, i) => `Invitado ${i + 1}`)}
                tono="win"
                borderTop
              />
            )}
          </div>
        )}
      </section>

      {editorAbierto && activa && jornada && (
        <EditorJornadaModal
          jornadaNumero={jornada.numero}
          temporadaId={activa.id}
          jornadaFechaIso={toIsoDay(jornada.fecha)}
          precarga={precargaEditor}
          onCerrar={() => setEditorAbierto(false)}
          onGuardado={() => { setEditorAbierto(false); onCambio?.(); }}
        />
      )}
    </div>
  );
}
