import { useEffect, useMemo, useState } from 'react';
import { useDisponibilidad } from '../hooks/useDisponibilidad';
import { useTemporada } from '../contexts/TemporadaContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { PageState } from '../components/PageState';
import { IconoEstrella } from '../components/IconoEstrella';
import { EditorJornadaModal } from '../components/EditorJornadaModal';
import { PLAZAS_CONVOCATORIA, NOMBRES_CONVOCABLES_POR_DEFECTO } from '../constants';
import { derivarEstadisticas, designarAlineador, generarConvocatoria } from '../lib/convocatoria';
import { balancearEquipos } from '../lib/equipos';
import { construirMensajeWhatsapp } from '../lib/mensajeWhatsapp';
import { BotonWhatsapp } from '../components/BotonWhatsapp';
import { ComoFuncionaModal } from '../components/ComoFuncionaModal';

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
function FilaJugador({
  jugador,
  indice,
  tono,
  esAlineador = false,
  arrastreProps = null,
  arrastrando = false,
  objetivoSoltar = false,
  controles = null,
}) {
  const fondo = tono === 'titular' ? 'bg-white' : 'bg-[var(--sv-surface-low)]';
  const efectos = arrastrando
    ? 'opacity-40 cursor-grabbing'
    : objetivoSoltar
      ? 'ring-2 ring-inset ring-[var(--sv-slate)] bg-[color:rgb(74_106_125/0.12)]'
      : arrastreProps
        ? 'cursor-grab'
        : '';
  return (
    <div
      {...(arrastreProps ?? {})}
      className={`flex items-center gap-2 px-4 py-2.5 border-b sv-ghost-line last:border-b-0 transition-opacity select-none ${fondo} ${efectos}`}
    >
      <span className="font-[Oswald] text-sm font-bold text-[var(--sv-primary)] w-6 shrink-0 tabular-nums">
        {String(indice).padStart(2, '0')}
      </span>
      <span className="font-bold uppercase text-[13px] text-[var(--sv-on-surface)] flex-1 min-w-0 truncate">
        {esAlineador && (
          <IconoEstrella
            className="inline-block w-3.5 h-3.5 mr-1.5 -mt-0.5 align-middle text-[var(--sv-primary)] shrink-0"
            aria-label="Alineador de la jornada"
          />
        )}
        {jugador.nombre}
        {esAlineador ? (
          <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--sv-primary)] font-[Oswald]">
            Alineador
          </span>
        ) : null}
      </span>
      {controles ?? (
        <span className="font-[Oswald] text-[10px] text-[var(--sv-on-surface-muted)] uppercase tracking-[0.05em] shrink-0 text-right">
          {jugador.reservas} res · {jugador.pj} pj
          <br />
          {jugador.jugoJornadaAnterior ? 'jugó la última' : 'no jugó la última'}
        </span>
      )}
    </div>
  );
}

/** Panel colapsable para añadir al reparto un habitual que quedó fuera. */
function PanelAnadir({
  abierto,
  destino,
  onDestino,
  onAbrir,
  onCerrar,
  disponibles,
  onElegir,
}) {
  return (
    <div className="border-t-2 border-[var(--sv-on-surface)] bg-[var(--sv-surface-low)] p-3 flex flex-col gap-2">
      {!abierto ? (
        <button
          type="button"
          onClick={onAbrir}
          className="w-full border-2 border-dashed border-[var(--sv-on-surface-muted)] py-2 text-[12px] font-bold uppercase tracking-[0.09em] font-[Oswald] text-[var(--sv-on-surface)] hover:bg-white transition-colors"
        >
          + Añadir jugador al reparto
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em]">
              <span className="text-[var(--sv-on-surface-muted)] font-[Oswald]">En:</span>
              <div className="flex border-2 border-[var(--sv-on-surface)] overflow-hidden">
                {['a', 'b', 'res'].map((eq) => {
                  const activo = destino === eq;
                  return (
                    <button
                      key={eq}
                      type="button"
                      onClick={() => onDestino(eq)}
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
                      {eq === 'a' ? 'Negro' : eq === 'b' ? 'Rojo' : 'Reserva'}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              className="text-[11px] uppercase tracking-[0.09em] text-[var(--sv-on-surface-muted)] hover:text-[var(--sv-on-surface)] font-[Oswald]"
            >
              Cerrar
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto border-2 border-[var(--sv-on-surface)] bg-white">
            {disponibles.length === 0 ? (
              <p className="p-3 text-xs italic text-[var(--sv-on-surface-muted)]">
                No quedan jugadores fuera del reparto.
              </p>
            ) : (
              disponibles.map((j) => (
                <button
                  key={j.id ?? j.nombre}
                  type="button"
                  onClick={() => onElegir(j)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-[var(--sv-surface-low)] transition-colors border-b sv-ghost-line last:border-b-0"
                >
                  <span className="font-bold uppercase truncate">{j.nombre}</span>
                  <span className="text-[10px] uppercase text-[var(--sv-on-surface-muted)] font-[Oswald] tracking-[0.06em] shrink-0 tabular-nums">
                    {j.pj ?? 0} pj · {Math.round(Number(j.porcentaje ?? 0))}% V
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Toggle N/R/Res + botón X para el modo admin del reparto. */
function ControlesFila({ actual, onMover, onQuitar, nombre }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="flex border-2 border-[var(--sv-on-surface)] overflow-hidden shrink-0">
        {['a', 'b', 'res'].map((eq) => {
          const activo = actual === eq;
          return (
            <button
              key={eq}
              type="button"
              onClick={() => onMover(eq)}
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
              aria-label={`Mover ${nombre} a ${eq === 'a' ? 'Equipo Negro' : eq === 'b' ? 'Equipo Rojo' : 'Reserva'}`}
            >
              {eq === 'a' ? 'N' : eq === 'b' ? 'R' : 'Res'}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onQuitar}
        aria-label={`Sacar a ${nombre} de la jornada`}
        title="Sacar de la jornada"
        className="w-7 h-7 flex items-center justify-center text-[var(--sv-on-surface-muted)] hover:text-[var(--sv-primary)] transition-colors"
      >
        <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M4 4l12 12M16 4L4 16" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Cabecera con dos pestañas: la vista plana de convocados y el reparto
 * sugerido en equipos. La segunda queda deshabilitada si aún no hay 12
 * titulares (no hay reparto que enseñar).
 */
function TabsConvocatoria({ vista, onCambio, equiposDisponibles, totalConvocados }) {
  const tabs = [
    { id: 'convocados', label: 'Convocados', extra: `${totalConvocados}/12` },
    { id: 'equipos', label: 'Equipos sugeridos', extra: null },
  ];
  return (
    <div role="tablist" className="flex">
      {tabs.map((t) => {
        const activa = vista === t.id;
        const bloqueada = t.id === 'equipos' && !equiposDisponibles;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activa}
            disabled={bloqueada}
            onClick={() => !bloqueada && onCambio(t.id)}
            title={bloqueada ? 'Necesitas 12 convocados para repartir los equipos' : ''}
            className={`flex-1 px-3 py-3 flex items-center justify-center gap-2 font-[Oswald] text-[11px] font-bold uppercase tracking-[0.1em] border-0 transition-colors ${
              activa
                ? 'bg-[var(--sv-primary)] text-white'
                : bloqueada
                  ? 'bg-[var(--sv-surface)] text-[var(--sv-on-surface-muted)] cursor-not-allowed'
                  : 'bg-[var(--sv-surface)] text-[var(--sv-on-surface)] hover:bg-[var(--sv-surface-low)]'
            }`}
          >
            <span>{t.label}</span>
            {t.extra && (
              <span
                className={`font-[Oswald] text-[10px] font-bold tracking-[0.06em] ${
                  activa ? 'text-white/85' : 'text-[var(--sv-on-surface-muted)]'
                }`}
              >
                {t.extra}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Sub-bloque de un equipo dentro de la sección de convocatoria: cabecera
 * coloreada (negro o rojo) y filas de jugadores. Sin borde propio — vive
 * dentro del border-2 del contenedor y añade un separador arriba para
 * distinguirlo del contenido anterior.
 */
function SubEquipo({
  titulo,
  emoji,
  jugadores,
  alineador,
  cabeceraBg,
  construirArrastreProps = null,
  arrastrandoNombre = null,
  objetivoNombre = null,
  equipoId,
  admin = false,
  onMover = null,
  onQuitar = null,
}) {
  const media = jugadores.reduce((s, p) => s + p.porcentaje, 0) / (jugadores.length || 1);
  return (
    <div className="border-t-2 border-[var(--sv-on-surface)] first:border-t-0">
      <div className={`px-4 py-2.5 flex items-center justify-between gap-3 ${cabeceraBg}`}>
        <h4 className="font-[Oswald] text-[13px] font-bold uppercase tracking-[0.1em] flex items-center gap-2">
          <span className="text-base">{emoji}</span> {titulo}
        </h4>
        <span className="font-[Oswald] text-[10px] font-bold tracking-[0.08em] tabular-nums">
          Media {Math.round(media)}% V · {jugadores.length}
        </span>
      </div>
      {jugadores.length === 0 ? (
        <p className="px-4 py-3 text-xs italic text-[var(--sv-on-surface-muted)] bg-white">
          Sin jugadores
        </p>
      ) : (
        jugadores.map((j, i) => (
          <FilaJugador
            key={j.nombre}
            jugador={j}
            indice={i + 1}
            tono="titular"
            esAlineador={alineador?.nombre === j.nombre}
            arrastreProps={construirArrastreProps ? construirArrastreProps(j.nombre) : null}
            arrastrando={arrastrandoNombre === j.nombre}
            objetivoSoltar={objetivoNombre === j.nombre}
            controles={
              admin && onMover && onQuitar ? (
                <ControlesFila
                  actual={equipoId}
                  nombre={j.nombre}
                  onMover={(dest) => onMover(j.nombre, dest)}
                  onQuitar={() => onQuitar(j.nombre)}
                />
              ) : null
            }
          />
        ))
      )}
    </div>
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
  const [comoFuncionaAbierto, setComoFuncionaAbierto] = useState(false);
  const [vistaConvocatoria, setVistaConvocatoria] = useState('convocados'); // 'convocados' | 'equipos'
  // Reajustes manuales sobre el reparto y las reservas sugeridos.
  // { [nombre]: 'a' | 'b' | 'res' | 'fuera' }
  // 'fuera' saca al jugador del reparto por completo.
  const [equipoOverride, setEquipoOverride] = useState({});
  // Jugadores añadidos manualmente que NO estaban en la convocatoria original.
  // Cada uno lleva { nombre, id, porcentaje, ..., destino: 'a' | 'b' | 'res' }.
  const [agregados, setAgregados] = useState([]);
  const [arrastrandoNombre, setArrastrandoNombre] = useState(null);
  const [objetivoNombre, setObjetivoNombre] = useState(null);
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [pickerDestino, setPickerDestino] = useState('a');

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

    const esConvocablePorDefecto = (nombre) =>
      NOMBRES_CONVOCABLES_POR_DEFECTO.some(
        (n) => n.localeCompare(nombre ?? '', 'es', { sensitivity: 'base' }) === 0,
      );

    for (const player of porNombre) {
      // Si el jugador está en la lista de convocables por defecto y no ha
      // respondido, sintetizamos una respuesta implícita "Convocable" para
      // que la respuesta explícita — cuando llegue — siga mandando.
      const resp =
        respuestas.get(player.nombre) ??
        (esConvocablePorDefecto(player.nombre) ? { disponibilidad: 'Convocable' } : null);
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

  // Si la vista de equipos deja de estar disponible (por bajar de 12 titulares),
  // volvemos automáticamente a la de convocados para no dejar el toggle en un
  // estado sin contenido.
  useEffect(() => {
    if (!equipos && vistaConvocatoria === 'equipos') {
      setVistaConvocatoria('convocados');
    }
  }, [equipos, vistaConvocatoria]);

  // Cambia la convocatoria (nueva jornada, respuestas actualizadas): los
  // reajustes manuales anteriores dejan de tener sentido, hay que descartarlos.
  useEffect(() => {
    setEquipoOverride({});
    setAgregados([]);
  }, [equipos, convocatoria]);

  // Reparto final que se pinta y se comparte: la sugerencia del algoritmo con
  // los intercambios manuales aplicados encima, más los jugadores añadidos.
  const reparto = useMemo(() => {
    const equipo1 = [];
    const equipo2 = [];
    const reservas = [];

    const put = (p, destino) => {
      if (destino === 'a') equipo1.push(p);
      else if (destino === 'b') equipo2.push(p);
      else if (destino === 'res') reservas.push(p);
      // 'fuera' → no se pinta
    };

    if (equipos) {
      for (const p of equipos.equipo1) put(p, equipoOverride[p.nombre] ?? 'a');
      for (const p of equipos.equipo2) put(p, equipoOverride[p.nombre] ?? 'b');
    }
    if (convocatoria) {
      for (const p of convocatoria.reservas) put(p, equipoOverride[p.nombre] ?? 'res');
    }
    for (const p of agregados) put(p, p.destino);

    return { equipo1, equipo2, reservas };
  }, [equipos, convocatoria, equipoOverride, agregados]);

  // Vista "Equipos sugeridos": el memo unificado dividido en dos listas de
  // titulares. Sigue existiendo aunque el reparto pierda o gane jugadores.
  const equiposDisplay = useMemo(
    () => (equipos ? { equipo1: reparto.equipo1, equipo2: reparto.equipo2 } : null),
    [equipos, reparto],
  );

  // Precarga para el editor de registro: usa el reparto tal y como está en
  // pantalla, con los intercambios manuales aplicados. Así, si el usuario
  // movió jugadores antes de "Registrar resultado", el editor se abre con la
  // misma composición que estaban mirando.
  const precargaEditor = useMemo(() => {
    if (!convocatoria) return null;
    return {
      titulares: [
        ...reparto.equipo1
          .filter((p) => p.id != null)
          .map((p) => ({ jugador_id: p.id, equipo: 'a' })),
        ...reparto.equipo2
          .filter((p) => p.id != null)
          .map((p) => ({ jugador_id: p.id, equipo: 'b' })),
      ],
      reservas: reparto.reservas.map((p) => p.id).filter((id) => id != null),
      alineadorId: alineador?.id ?? null,
    };
  }, [reparto, convocatoria, alineador]);

  // Habituales que aún no están en el reparto — candidatos del picker "Añadir
  // jugador". Ordenados alfabéticamente para escaneo rápido.
  const disponiblesParaAnadir = useMemo(() => {
    const usados = new Set([
      ...reparto.equipo1.map((p) => p.nombre),
      ...reparto.equipo2.map((p) => p.nombre),
      ...reparto.reservas.map((p) => p.nombre),
    ]);
    return (clasificacion ?? [])
      .filter((p) => !usados.has(p.nombre))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }, [clasificacion, reparto]);

  // Qué equipo tiene ahora mismo un jugador — usado por los handlers de arrastre
  // para saber si el drop cruza de equipo o no. Cubre también los agregados.
  const equipoActualDe = (nombre) => {
    if (reparto.equipo1.some((p) => p.nombre === nombre)) return 'a';
    if (reparto.equipo2.some((p) => p.nombre === nombre)) return 'b';
    if (reparto.reservas.some((p) => p.nombre === nombre)) return 'res';
    return null;
  };

  const intercambiar = (nombreA, nombreB) => {
    if (!equipos || nombreA === nombreB) return;
    const teamA = equipoActualDe(nombreA);
    const teamB = equipoActualDe(nombreB);
    if (!teamA || !teamB || teamA === teamB) return;
    if (teamA !== 'a' && teamA !== 'b') return;
    if (teamB !== 'a' && teamB !== 'b') return;
    moverJugador(nombreA, teamB);
    moverJugador(nombreB, teamA);
  };

  // Mueve o expulsa a un jugador del reparto. Distingue si venía de la
  // propuesta original (override) o de los agregados manuales.
  const moverJugador = (nombre, destino) => {
    const enAgregados = agregados.some((p) => p.nombre === nombre);
    if (enAgregados) {
      if (destino === 'fuera') {
        setAgregados((prev) => prev.filter((p) => p.nombre !== nombre));
      } else {
        setAgregados((prev) =>
          prev.map((p) => (p.nombre === nombre ? { ...p, destino } : p)),
        );
      }
      return;
    }
    setEquipoOverride((prev) => ({ ...prev, [nombre]: destino }));
  };

  const quitarJugador = (nombre) => moverJugador(nombre, 'fuera');

  const anadirDelPicker = (playerFull) => {
    if (!playerFull) return;
    const stats = derivarEstadisticas(playerFull, ultimaJornada ?? 0);
    setAgregados((prev) => [...prev, { ...stats, destino: pickerDestino }]);
    setPickerAbierto(false);
  };

  const construirArrastreProps = (nombre) => ({
    draggable: true,
    onDragStart: (e) => {
      setArrastrandoNombre(nombre);
      e.dataTransfer.setData('text/plain', nombre);
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragEnd: () => {
      setArrastrandoNombre(null);
      setObjetivoNombre(null);
    },
    onDragOver: (e) => {
      if (!arrastrandoNombre || arrastrandoNombre === nombre) return;
      if (equipoActualDe(arrastrandoNombre) === equipoActualDe(nombre)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (objetivoNombre !== nombre) setObjetivoNombre(nombre);
    },
    onDragLeave: () => {
      if (objetivoNombre === nombre) setObjetivoNombre(null);
    },
    onDrop: (e) => {
      e.preventDefault();
      const origen = e.dataTransfer.getData('text/plain') || arrastrandoNombre;
      intercambiar(origen, nombre);
      setArrastrandoNombre(null);
      setObjetivoNombre(null);
    },
  });

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

  // La convocatoria solo se publica desde el domingo 12:00 (cierre de la
  // ventana de respuestas) hasta el martes 23:59:59 (día siguiente al partido).
  // Fuera de esa franja se oculta para que los jugadores no reaccionen a un
  // cálculo aún incompleto y provoquen conflictos.
  const publicacionFin = new Date(jornada.fecha);
  publicacionFin.setDate(publicacionFin.getDate() + 1);
  publicacionFin.setHours(23, 59, 59, 999);
  const convocatoriaPublicada = now >= ventana.fin && now <= publicacionFin;

  // El mensaje sigue a la vista activa: si estás mirando los equipos ya
  // repartidos, se comparte ese formato; si no, la lista plana de convocados.
  // Reservas y alineador se incluyen siempre.
  const enVistaEquipos = vistaConvocatoria === 'equipos' && Boolean(equiposDisplay);
  const mensaje = convocatoria
    ? construirMensajeWhatsapp({
        temporada: activa?.nombre,
        numeroJornada: jornada.numero,
        fecha: jornada.fecha,
        alineador: alineador?.nombre ?? null,
        ...(enVistaEquipos
          ? {
              equipoNegro: reparto.equipo1.map((p) => p.nombre),
              equipoRojo: reparto.equipo2.map((p) => p.nombre),
            }
          : {
              convocados: convocatoria.titulares.map((p) => p.nombre),
            }),
        reservas: reparto.reservas.map((p) => p.nombre),
      })
    : '';

  return (
    <div className="flex flex-col gap-6 px-4">
      {/* Cabecera. */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-[32px] sm:text-[36px] leading-none font-bold text-[var(--sv-on-surface)]">
            Convocatoria
          </h2>
          <button
            type="button"
            onClick={() => setComoFuncionaAbierto(true)}
            className="shrink-0 mt-1 inline-flex items-center gap-2 px-3 py-1.5 border-2 border-[var(--sv-on-surface)] font-[Oswald] text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--sv-on-surface)] hover:bg-[var(--sv-on-surface)] hover:text-[var(--sv-surface)] transition-colors"
          >
            <span
              aria-hidden
              className="w-4 h-4 border-2 border-current inline-flex items-center justify-center text-[10px] font-bold leading-none"
            >
              ?
            </span>
            <span className="hidden sm:inline">Cómo funciona</span>
            <span className="sm:hidden">Ayuda</span>
          </button>
        </div>
        <p className="mt-3 font-[Oswald] text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sv-on-surface-muted)]">
          {activa?.nombre ? `Temporada ${activa.nombre} · ` : ''}
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
      ) : !convocatoriaPublicada ? (
        <div className="bg-white border-2 border-dashed border-[var(--sv-on-surface-muted)] p-5 italic text-[13px] text-[var(--sv-on-surface-soft)]">
          La convocatoria se publica el domingo a las 12:00, cuando cierra la ventana de
          respuestas, y se mantiene visible hasta el martes por la noche.
        </div>
      ) : (
        <>
          {/* Convocatoria con dos vistas: lista plana de convocados, o el
              reparto sugerido en equipos. La pestaña de equipos se deshabilita
              cuando no hay 12 titulares exactos (no se puede repartir). */}
          <section className="border-2 border-[var(--sv-on-surface)]">
            <TabsConvocatoria
              vista={vistaConvocatoria}
              onCambio={setVistaConvocatoria}
              equiposDisponibles={Boolean(equipos)}
              totalConvocados={convocatoria.titulares.length}
            />

            {vistaConvocatoria === 'convocados' || !equipos ? (
              <>
                {convocatoria.titulares.map((j, i) => (
                  <FilaJugador
                    key={j.nombre}
                    jugador={j}
                    indice={i + 1}
                    tono="titular"
                    esAlineador={alineador?.nombre === j.nombre}
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
              </>
            ) : (
              <>
                <SubEquipo
                  titulo="Equipo Negro"
                  emoji="🕷"
                  jugadores={equiposDisplay.equipo1}
                  alineador={alineador}
                  cabeceraBg="bg-[var(--sv-on-surface)] text-white"
                  construirArrastreProps={autenticado ? null : construirArrastreProps}
                  arrastrandoNombre={arrastrandoNombre}
                  objetivoNombre={objetivoNombre}
                  equipoId="a"
                  admin={autenticado}
                  onMover={moverJugador}
                  onQuitar={quitarJugador}
                />
                <SubEquipo
                  titulo="Equipo Rojo"
                  emoji="🌹"
                  jugadores={equiposDisplay.equipo2}
                  alineador={alineador}
                  cabeceraBg="bg-[var(--sv-primary)] text-white"
                  construirArrastreProps={autenticado ? null : construirArrastreProps}
                  arrastrandoNombre={arrastrandoNombre}
                  objetivoNombre={objetivoNombre}
                  equipoId="b"
                  admin={autenticado}
                  onMover={moverJugador}
                  onQuitar={quitarJugador}
                />
                {autenticado && (
                  <PanelAnadir
                    abierto={pickerAbierto}
                    destino={pickerDestino}
                    onDestino={setPickerDestino}
                    onAbrir={() => setPickerAbierto(true)}
                    onCerrar={() => setPickerAbierto(false)}
                    disponibles={disponiblesParaAnadir}
                    onElegir={anadirDelPicker}
                  />
                )}
              </>
            )}
          </section>

          {/* Reservas. */}
          <section className="border-2 border-[var(--sv-on-surface)]">
            <div className="px-4 py-3 bg-amber-500 text-white flex items-center justify-between gap-3">
              <h3 className="font-[Oswald] text-sm font-bold uppercase tracking-[0.1em]">Reservas</h3>
              <span className="font-[Oswald] text-[11px] font-bold tracking-[0.08em]">
                {reparto.reservas.length}
              </span>
            </div>
            {reparto.reservas.length > 0 ? (
              reparto.reservas.map((j, i) => (
                <FilaJugador
                  key={j.nombre}
                  jugador={j}
                  indice={i + 1}
                  tono="reserva"
                  controles={
                    autenticado && vistaConvocatoria === 'equipos' ? (
                      <ControlesFila
                        actual="res"
                        nombre={j.nombre}
                        onMover={(dest) => moverJugador(j.nombre, dest)}
                        onQuitar={() => quitarJugador(j.nombre)}
                      />
                    ) : null
                  }
                />
              ))
            ) : (
              <p className="px-4 py-4 font-[Oswald] text-xs text-[var(--sv-on-surface-muted)] uppercase tracking-[0.08em]">
                Ninguna
              </p>
            )}
          </section>

          <BotonWhatsapp
            mensaje={mensaje}
            deshabilitado={convocatoria.titulares.length === 0}
            motivo="Aún no hay ningún convocado que compartir."
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

      <ComoFuncionaModal
        abierto={comoFuncionaAbierto}
        onCerrar={() => setComoFuncionaAbierto(false)}
      />
    </div>
  );
}
