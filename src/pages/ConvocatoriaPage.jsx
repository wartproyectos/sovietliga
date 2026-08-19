import { useMemo, useState } from 'react';
import { useDisponibilidad } from '../hooks/useDisponibilidad';
import { useTemporada } from '../contexts/TemporadaContext';
import { PageState } from '../components/PageState';
import { PLAZAS_CONVOCATORIA } from '../constants';
import { derivarEstadisticas, generarConvocatoria } from '../lib/convocatoria';
import { balancearEquipos } from '../lib/equipos';
import { construirMensajeWhatsapp } from '../lib/mensajeWhatsapp';
import { BotonWhatsapp } from '../components/BotonWhatsapp';
import { posLabel } from '../data/posiciones';

const formatFecha = (d) =>
  d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const formatCorto = (d) =>
  `${d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} ` +
  d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

function Badge({ nombre, variant }) {
  const colors = {
    convocable: 'bg-emerald-700 text-white',
    reserva: 'bg-amber-500 text-white',
    no: 'bg-[var(--sv-surface-dim)] text-[var(--sv-on-surface-muted)]',
    sinRespuesta: 'bg-[var(--sv-surface)] text-[var(--sv-on-surface-muted)] border sv-ghost-line',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1.5 text-xs font-bold uppercase tracking-[0.08em] ${colors[variant]}`}
    >
      {nombre}
    </span>
  );
}

function Grupo({ titulo, icono, jugadores, variant, extra }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.11em] text-[var(--sv-on-surface-muted)] mb-2">
        {icono} {titulo} ({jugadores.length})
        {extra ? <span className="font-normal normal-case ml-1">{extra}</span> : null}
      </p>
      {jugadores.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {jugadores.map((n) => (
            <Badge key={n} nombre={n} variant={variant} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--sv-on-surface-muted)] italic">Ninguno</p>
      )}
    </div>
  );
}

/** Fila de jugador dentro de la convocatoria, con los datos que aplicaron las normas. */
function FilaJugador({ jugador, indice, tono, etiqueta }) {
  const fondo = tono === 'titular' ? 'bg-[var(--sv-surface)]' : 'bg-[var(--sv-surface-low)]';
  return (
    <div className={`flex items-center gap-3 px-3 py-2 border-b sv-ghost-line last:border-b-0 ${fondo}`}>
      <span className="text-sm font-bold text-[var(--sv-on-surface-muted)] w-6 shrink-0 tabular-nums">
        {String(indice).padStart(2, '0')}
      </span>
      <span className="font-bold uppercase text-sm text-[var(--sv-on-surface)] flex-1 min-w-0 truncate">
        {jugador.nombre}
        {etiqueta ? (
          <span className="ml-2 text-[10px] font-normal normal-case text-amber-600">{etiqueta}</span>
        ) : null}
      </span>
      <span className="text-[10px] text-[var(--sv-on-surface-muted)] uppercase tracking-tight shrink-0 text-right">
        {jugador.reservas} res · {jugador.pj} pj
        <br />
        {jugador.jugoJornadaAnterior ? 'jugó la última' : 'no jugó la última'}
      </span>
    </div>
  );
}

/** Fila dentro de un equipo: aquí lo relevante es la posición, no el historial. */
function FilaEquipo({ jugador, indice, esCambio }) {
  const pos = jugador.pos_principal;
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b sv-ghost-line last:border-b-0 bg-[var(--sv-surface)]">
      <span className="text-[10px] font-bold text-[var(--sv-on-surface-muted)] w-12 shrink-0 uppercase tracking-tight">
        {esCambio ? 'Cambio' : String(indice).padStart(2, '0')}
      </span>
      <span className="font-bold uppercase text-sm text-[var(--sv-on-surface)] flex-1 min-w-0 truncate">
        {jugador.nombre}
      </span>
      <span className="text-[10px] text-[var(--sv-on-surface-muted)] uppercase tracking-tight shrink-0 text-right">
        {pos ? `${posLabel(pos)} (${pos})` : 'sin posición'} · {Math.round(jugador.porcentaje)}% V
      </span>
    </div>
  );
}

function TarjetaEquipo({ titulo, emoji, jugadores, cabecera }) {
  const media = jugadores.reduce((s, p) => s + p.porcentaje, 0) / (jugadores.length || 1);
  return (
    <section className="sv-panel overflow-hidden">
      <div className={`px-4 py-3 flex items-center justify-between gap-3 ${cabecera}`}>
        <h3 className="text-sm font-bold uppercase tracking-[0.12em] flex items-center gap-2">
          <span className="text-base">{emoji}</span> {titulo}
        </h3>
        <span className="text-xs font-bold tracking-[0.1em]">Media {Math.round(media)}% V</span>
      </div>
      {jugadores.map((j, i) => (
        <FilaEquipo key={j.nombre} jugador={j} indice={i + 1} esCambio={i === jugadores.length - 1} />
      ))}
    </section>
  );
}

export function ConvocatoriaPage({ clasificacion, loading: clasifLoading, error: clasifError, ultimaJornada }) {
  const { activa } = useTemporada();
  const {
    respuestas,
    invitados,
    loading: dispLoading,
    error: dispError,
    jornada,
    ventana,
  } = useDisponibilidad();

  const [verDetalle, setVerDetalle] = useState(false);

  const loading = clasifLoading || dispLoading;
  const error = clasifError || dispError;

  const { grupos, convocatoria, equipos } = useMemo(() => {
    if (!clasificacion.length || !respuestas || !jornada)
      return { grupos: null, convocatoria: null, equipos: null };

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
    };
  }, [clasificacion, respuestas, invitados, jornada, ultimaJornada]);

  if (loading || error) {
    return <PageState loading={loading} error={error} loadingMessage="Cargando convocatoria..." />;
  }

  if (!jornada || !ventana) {
    return (
      <div className="sv-panel p-8 mx-4 text-sm text-[var(--sv-on-surface-muted)] uppercase tracking-[0.08em]">
        La temporada activa aún no tiene fecha de arranque. Configúrala en Supabase para poder
        preparar convocatorias.
      </div>
    );
  }

  const now = new Date();
  let estadoVentana;
  let estadoColor;
  if (now < ventana.inicio) {
    estadoVentana = 'Próximamente';
    estadoColor = 'text-[var(--sv-on-surface-muted)]';
  } else if (now <= ventana.fin) {
    estadoVentana = 'Abierta';
    estadoColor = 'text-emerald-700';
  } else {
    estadoVentana = 'Cerrada';
    estadoColor = 'text-[var(--sv-primary)]';
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
        equipoNegro: equipos.equipo1.map((p) => p.nombre),
        equipoRojo: equipos.equipo2.map((p) => p.nombre),
        reservas: convocatoria.reservas.map((p) => p.nombre),
      })
    : '';

  return (
    <div className="flex flex-col gap-6 px-4">
      {/* Cabecera */}
      <div>
        <h2 className="text-4xl font-bold text-[var(--sv-on-surface)] leading-none">Convocatoria</h2>
        <p className="text-sm text-[var(--sv-on-surface-muted)] uppercase tracking-[0.08em] mt-2">
          Jornada {jornada.numero} — {formatFecha(jornada.fecha)}
        </p>
      </div>

      {/* Ventana de respuesta */}
      <div className="sv-panel p-5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs font-bold uppercase tracking-[0.11em] text-[var(--sv-on-surface-muted)]">
            Ventana de respuesta
          </p>
          <span className={`text-xs font-bold uppercase tracking-[0.11em] ${estadoColor}`}>
            {estadoVentana}
          </span>
        </div>
        <p className="text-sm text-[var(--sv-on-surface)]">
          {formatCorto(ventana.inicio)} — {formatCorto(ventana.fin)}
        </p>
      </div>

      {!hayRespuestas ? (
        <div className="sv-panel p-8 text-[var(--sv-on-surface-muted)] uppercase tracking-[0.08em] text-sm">
          Todavía no hay respuestas en esta ventana. La convocatoria se genera sola en cuanto
          empiecen a llegar.
        </div>
      ) : (
        <>
          {/* Equipos — con 12 exactos; si no, lista plana */}
          {equipos ? (
            <>
              <TarjetaEquipo
                titulo="Equipo Negro"
                emoji="🕷"
                jugadores={equipos.equipo1}
                cabecera="bg-stone-900 text-white"
              />
              <TarjetaEquipo
                titulo="Equipo Rojo"
                emoji="🌹"
                jugadores={equipos.equipo2}
                cabecera="bg-[var(--sv-primary)] text-white"
              />
            </>
          ) : (
            <section className="sv-panel overflow-hidden">
              <div className="px-4 py-3 bg-[var(--sv-on-surface)] text-[var(--sv-surface)] flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-[0.12em]">Convocados</h3>
                <span className="text-xs font-bold tracking-[0.1em]">
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
                <div className="px-4 py-3 bg-[color:rgb(158_0_0/0.06)] text-xs uppercase tracking-[0.06em] text-[var(--sv-primary)] font-bold">
                  Faltan {convocatoria.invitadosNecesarios} jugadores ·{' '}
                  {invitados.length > 0
                    ? `${invitados.length} invitado(s) apuntado(s)`
                    : 'hay que buscar amigos'}
                </div>
              )}
            </section>
          )}

          {/* Reservas */}
          <section className="sv-panel overflow-hidden">
            <div className="px-4 py-3 bg-amber-500 text-white flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold uppercase tracking-[0.12em]">Reservas</h3>
              <span className="text-xs font-bold tracking-[0.1em]">
                {convocatoria.reservas.length}
              </span>
            </div>
            {convocatoria.reservas.length > 0 ? (
              convocatoria.reservas.map((j, i) => (
                <FilaJugador key={j.nombre} jugador={j} indice={i + 1} tono="reserva" />
              ))
            ) : (
              <p className="px-4 py-4 text-xs text-[var(--sv-on-surface-muted)] uppercase tracking-[0.08em]">
                Ninguna
              </p>
            )}
          </section>

          <BotonWhatsapp
            mensaje={mensaje}
            deshabilitado={!equipos}
            motivo={`Hacen falta ${PLAZAS_CONVOCATORIA} convocados para repartir los equipos (hay ${convocatoria.titulares.length})`}
          />
        </>
      )}

      {/* Detalle de respuestas */}
      <section className="sv-panel overflow-hidden">
        <button
          type="button"
          onClick={() => setVerDetalle((v) => !v)}
          className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-[var(--sv-surface-low)] transition-colors text-left"
        >
          <span className="text-sm font-bold uppercase tracking-[0.11em] text-[var(--sv-on-surface)]">
            Respuestas del formulario
          </span>
          <span
            className={`text-[var(--sv-on-surface-muted)] transition-transform text-sm ${verDetalle ? 'rotate-180' : ''}`}
          >
            ▼
          </span>
        </button>
        {verDetalle && grupos && (
          <div className="px-5 pb-5 pt-1 border-t sv-ghost-line flex flex-col gap-5">
            <Grupo
              titulo="Convocables"
              icono="✅"
              jugadores={grupos.convocables}
              variant="convocable"
            />
            <Grupo
              titulo="Se ofrecen de reserva"
              icono="🔄"
              jugadores={grupos.voluntariosReserva}
              variant="reserva"
            />
            <Grupo
              titulo="No convocables"
              icono="❌"
              jugadores={grupos.noConvocables}
              variant="no"
            />
            <Grupo
              titulo="Sin respuesta"
              icono="⏳"
              jugadores={grupos.sinRespuesta}
              variant="sinRespuesta"
              extra="— cuentan como no convocables"
            />
            {invitados.length > 0 && (
              <Grupo
                titulo="Invitados apuntados"
                icono="👋"
                jugadores={invitados.map((_, i) => `Invitado ${i + 1}`)}
                variant="convocable"
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
