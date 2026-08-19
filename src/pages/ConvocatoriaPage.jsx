import { useMemo } from 'react';
import { useDisponibilidad } from '../hooks/useDisponibilidad';
import { PageState } from '../components/PageState';

const formatFecha = (d) =>
  d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const formatCorto = (d) =>
  d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) +
  ' ' +
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
        {extra ? <span className="font-normal ml-1">{extra}</span> : null}
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

export function ConvocatoriaPage({ clasificacion, loading: clasifLoading, error: clasifError }) {
  const { respuestas, invitados, loading: dispLoading, error: dispError, jornada, ventana } =
    useDisponibilidad();

  const loading = clasifLoading || dispLoading;
  const error = clasifError || dispError;

  const grupos = useMemo(() => {
    if (!clasificacion.length || !respuestas) return null;

    const convocables = [];
    const reservas = [];
    const noConvocables = [];
    const sinRespuesta = [];

    for (const player of [...clasificacion].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
    )) {
      const resp = respuestas.get(player.nombre);
      if (!resp) {
        sinRespuesta.push(player.nombre);
      } else if (resp.disponibilidad === 'Convocable') {
        convocables.push(player.nombre);
      } else if (resp.disponibilidad === 'Reserva') {
        reservas.push(player.nombre);
      } else {
        noConvocables.push(player.nombre);
      }
    }

    return { convocables, reservas, noConvocables, sinRespuesta };
  }, [clasificacion, respuestas]);

  if (loading || error) {
    return <PageState loading={loading} error={error} loadingMessage="Cargando convocatoria..." />;
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

  const totalDisponibles = (grupos?.convocables.length ?? 0) + (grupos?.reservas.length ?? 0) + invitados.length;

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

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-2">
        <div className="sv-panel p-4 text-center">
          <p className="text-3xl font-bold text-emerald-700">{grupos?.convocables.length ?? 0}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--sv-on-surface-muted)] mt-1">
            Convocables
          </p>
        </div>
        <div className="sv-panel p-4 text-center">
          <p className="text-3xl font-bold text-amber-500">{grupos?.reservas.length ?? 0}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--sv-on-surface-muted)] mt-1">
            Reservas
          </p>
        </div>
        <div className="sv-panel p-4 text-center">
          <p className="text-3xl font-bold text-[var(--sv-on-surface-muted)]">
            {(grupos?.noConvocables.length ?? 0) + (grupos?.sinRespuesta.length ?? 0)}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--sv-on-surface-muted)] mt-1">
            No disponibles
          </p>
        </div>
      </div>

      {/* Detalle por grupo */}
      {grupos && (
        <div className="sv-panel p-5 flex flex-col gap-5">
          <Grupo titulo="Convocables" icono="✅" jugadores={grupos.convocables} variant="convocable" />
          <Grupo titulo="Reservas" icono="🔄" jugadores={grupos.reservas} variant="reserva" />
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
              titulo="Invitados disponibles"
              icono="👋"
              jugadores={invitados.map((_, i) => `Invitado ${i + 1}`)}
              variant="convocable"
            />
          )}
        </div>
      )}

      {/* Nota de disponibles totales */}
      <div className="bg-[var(--sv-surface-dim)] p-5 flex items-start gap-3">
        <span className="text-lg text-[var(--sv-primary)]">★</span>
        <div>
          <h4 className="text-sm font-bold text-[var(--sv-on-surface)] leading-none mb-2 uppercase tracking-[0.08em]">
            {totalDisponibles} jugadores disponibles en total
          </h4>
          <p className="text-xs text-[var(--sv-on-surface)] leading-relaxed uppercase tracking-[0.04em]">
            Se necesitan <b>12 jugadores</b> para formar los equipos.
            {totalDisponibles >= 12
              ? ' Hay suficientes jugadores para la jornada.'
              : ` Faltan ${12 - totalDisponibles} jugadores. Busca invitados o espera más respuestas.`}
          </p>
        </div>
      </div>
    </div>
  );
}
