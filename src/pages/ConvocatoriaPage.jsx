import { useEffect, useMemo, useRef, useState } from 'react';
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
import { cargarJornadaDelPartido, guardarConvocatoria } from '../lib/convocatoriaGuardada';
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

const porNombreEs = (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });

/** Ficha mínima para quien no está en la clasificación (invitados, sobre todo). */
const fichaSinEstadisticas = (id, nombre, tipo) => ({
  id,
  nombre,
  invitado: tipo === 'invitado',
  reservas: 0,
  pj: 0,
  jugoJornadaAnterior: false,
  ultimaReservaJornada: 0,
  porcentaje: 0,
  pos_principal: null,
  pos_secundaria: null,
});

// ------ Borrador del modo edición -----------------------------------------
//
// { asignados: Map<jugador_id, 'a'|'b'|'res'>, nuevos: [{ clave, destino }] }
//
// Cada fila se identifica con una clave de texto: `j-<id>` para jugadores que
// ya existen y `n-<clave>` para cada "Invitado" añadido, que aún no tiene
// jugador asignado (se le da uno al guardar). Quitar a alguien lo borra del
// borrador; sólo vuelve con "Añadir jugador".

function destinoEnBorrador(borrador, clave) {
  if (clave.startsWith('j-')) return borrador.asignados.get(Number(clave.slice(2))) ?? null;
  return borrador.nuevos.find((n) => `n-${n.clave}` === clave)?.destino ?? null;
}

function conDestino(borrador, clave, destino) {
  if (clave.startsWith('j-')) {
    return { ...borrador, asignados: new Map(borrador.asignados).set(Number(clave.slice(2)), destino) };
  }
  return {
    ...borrador,
    nuevos: borrador.nuevos.map((n) => (`n-${n.clave}` === clave ? { ...n, destino } : n)),
  };
}

function sinJugador(borrador, clave) {
  if (clave.startsWith('j-')) {
    const asignados = new Map(borrador.asignados);
    asignados.delete(Number(clave.slice(2)));
    return { ...borrador, asignados };
  }
  return { ...borrador, nuevos: borrador.nuevos.filter((n) => `n-${n.clave}` !== clave) };
}

// Rojo primero, igual que en el resto de la página.
const DESTINOS = [
  { id: 'b', corto: 'R', largo: 'Rojo', activo: 'bg-[var(--sv-primary)] text-white' },
  { id: 'a', corto: 'N', largo: 'Negro', activo: 'bg-[var(--sv-on-surface)] text-white' },
  { id: 'res', corto: 'Res', largo: 'Reserva', activo: 'bg-amber-500 text-white' },
];

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
      className={`flex items-center gap-3 px-4 py-2.5 border-b sv-ghost-line last:border-b-0 transition-opacity select-none ${fondo} ${efectos}`}
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
      {controles ??
        (jugador.invitado ? (
          <span className="font-[Oswald] text-[10px] text-amber-600 uppercase tracking-[0.1em] shrink-0">
            Invitado
          </span>
        ) : (
          <span className="font-[Oswald] text-[10px] text-[var(--sv-on-surface-muted)] uppercase tracking-[0.05em] shrink-0 text-right">
            {jugador.reservas} res · {jugador.pj} pj
            <br />
            {jugador.jugoJornadaAnterior ? 'jugó la última' : 'no jugó la última'}
          </span>
        ))}
    </div>
  );
}

/** Selector Rojo / Negro / Reserva de una fila en modo edición, y la ✕ para quitarla. */
function ControlesEdicion({ nombre, destino, onMover, onQuitar }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <div className="flex border-2 border-[var(--sv-on-surface)]">
        {DESTINOS.map((d) => {
          const activo = destino === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => !activo && onMover(d.id)}
              aria-pressed={activo}
              aria-label={`Mover a ${nombre} a ${d.largo}`}
              title={d.largo}
              className={`px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] font-[Oswald] transition-colors ${
                activo ? d.activo : 'bg-white text-[var(--sv-on-surface)] hover:bg-[var(--sv-surface-low)]'
              }`}
            >
              {d.corto}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onQuitar}
        aria-label={`Quitar a ${nombre} de la convocatoria`}
        title="Quitar de la convocatoria"
        className="w-8 h-8 flex items-center justify-center text-[var(--sv-on-surface-muted)] hover:text-[var(--sv-primary)] transition-colors"
      >
        <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M4 4l12 12M16 4L4 16" />
        </svg>
      </button>
    </div>
  );
}

/** Un equipo (o las reservas) dentro del modo edición. */
function SeccionEdicion({
  titulo,
  emoji,
  cabeceraBg,
  items,
  alineadorId,
  construirArrastreProps,
  arrastrandoNombre,
  objetivoNombre,
  onMover,
  onQuitar,
}) {
  return (
    <div className="border-t-2 border-[var(--sv-on-surface)]">
      <div className={`px-4 py-2.5 flex items-center justify-between gap-3 ${cabeceraBg}`}>
        <h4 className="font-[Oswald] text-[13px] font-bold uppercase tracking-[0.1em] flex items-center gap-2">
          {emoji && <span className="text-base">{emoji}</span>} {titulo}
        </h4>
        <span className="font-[Oswald] text-[11px] font-bold tracking-[0.08em] tabular-nums">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-3 bg-white font-[Oswald] text-xs text-[var(--sv-on-surface-muted)] uppercase tracking-[0.08em]">
          Sin jugadores
        </p>
      ) : (
        items.map((it, i) => (
          <FilaJugador
            key={it.clave}
            jugador={it.ficha}
            indice={i + 1}
            tono={it.destino === 'res' ? 'reserva' : 'titular'}
            esAlineador={it.ficha.id != null && it.ficha.id === alineadorId}
            arrastreProps={construirArrastreProps(it.clave)}
            arrastrando={arrastrandoNombre === it.clave}
            objetivoSoltar={objetivoNombre === it.clave}
            controles={
              <ControlesEdicion
                nombre={it.ficha.nombre}
                destino={it.destino}
                onMover={(d) => onMover(it.clave, d)}
                onQuitar={() => onQuitar(it.clave)}
              />
            }
          />
        ))
      )}
    </div>
  );
}

/** Selector de destino (Rojo / Negro / Reserva) para quien se añade. */
function SelectorDestino({ valor, onCambio }) {
  return (
    <div className="flex border-2 border-[var(--sv-on-surface)]">
      {DESTINOS.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => onCambio(d.id)}
          aria-pressed={valor === d.id}
          className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] font-[Oswald] transition-colors ${
            valor === d.id ? d.activo : 'bg-white text-[var(--sv-on-surface)] hover:bg-[var(--sv-surface-low)]'
          }`}
        >
          {d.largo}
        </button>
      ))}
    </div>
  );
}

/**
 * "Añadir jugador": los jugadores de la clasificación que no están en la
 * convocatoria (incluidos los que se quitaron) y, arriba del todo, "Invitado",
 * que se puede añadir tantas veces como haga falta.
 */
function AnadirJugador({ disponibles, destinoInicial, onAnadir, onAnadirInvitado }) {
  const [abierto, setAbierto] = useState(false);
  const [destino, setDestino] = useState(destinoInicial);

  const abrir = () => {
    setDestino(destinoInicial);
    setAbierto(true);
  };

  const filaBase =
    'w-full flex items-center justify-between gap-2 px-3 py-2.5 border-b sv-ghost-line last:border-b-0 text-left text-[13px] hover:bg-[var(--sv-surface-low)] transition-colors';

  return (
    <div className="border-t-2 border-[var(--sv-on-surface)] bg-[var(--sv-surface)] p-4 flex flex-col gap-3">
      {!abierto ? (
        <button
          type="button"
          onClick={abrir}
          className="border-2 border-[var(--sv-on-surface)] py-2 text-[12px] font-bold uppercase tracking-[0.09em] font-[Oswald] hover:bg-[var(--sv-surface-low)]"
        >
          + Añadir jugador
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-[Oswald] text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--sv-on-surface-muted)]">
            Añadir jugador
          </p>
          <div className="flex items-center gap-2">
            <span className="font-[Oswald] text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--sv-on-surface-muted)]">
              A:
            </span>
            <SelectorDestino valor={destino} onCambio={setDestino} />
          </div>

          <div className="max-h-56 overflow-y-auto border-2 border-[var(--sv-on-surface)] bg-white">
            {/* Invitado no se agota: el selector sigue abierto para añadir varios. */}
            <button type="button" onClick={() => onAnadirInvitado(destino)} className={filaBase}>
              <span className="font-bold uppercase truncate text-amber-600">+ Invitado</span>
              <span className="text-[10px] uppercase text-[var(--sv-on-surface-muted)] font-[Oswald] tracking-[0.06em] shrink-0">
                se puede repetir
              </span>
            </button>
            {disponibles.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => {
                  onAnadir(j.id, destino);
                  setAbierto(false);
                }}
                className={filaBase}
              >
                <span className="font-bold uppercase truncate">{j.nombre}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="self-end font-[Oswald] text-[11px] uppercase tracking-[0.09em] text-[var(--sv-on-surface-muted)] hover:text-[var(--sv-on-surface)]"
          >
            Cerrar
          </button>
        </div>
      )}
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
}) {
  const media = jugadores.reduce((s, p) => s + p.porcentaje, 0) / (jugadores.length || 1);
  return (
    <div className="border-t-2 border-[var(--sv-on-surface)] first:border-t-0">
      <div className={`px-4 py-2.5 flex items-center justify-between gap-3 ${cabeceraBg}`}>
        <h4 className="font-[Oswald] text-[13px] font-bold uppercase tracking-[0.1em] flex items-center gap-2">
          <span className="text-base">{emoji}</span> {titulo}
        </h4>
        <span className="font-[Oswald] text-[10px] font-bold tracking-[0.08em] tabular-nums">
          Media {Math.round(media)}% V
        </span>
      </div>
      {jugadores.map((j, i) => (
        <FilaJugador
          key={j.nombre}
          jugador={j}
          indice={i + 1}
          tono="titular"
          esAlineador={alineador?.nombre === j.nombre}
          arrastreProps={construirArrastreProps ? construirArrastreProps(j.nombre) : null}
          arrastrando={arrastrandoNombre === j.nombre}
          objetivoSoltar={objetivoNombre === j.nombre}
        />
      ))}
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
    proximoPartido,
    ventana,
  } = useDisponibilidad();

  const [verDetalle, setVerDetalle] = useState(false);
  const [editorAbierto, setEditorAbierto] = useState(false);
  const [comoFuncionaAbierto, setComoFuncionaAbierto] = useState(false);
  const [vistaConvocatoria, setVistaConvocatoria] = useState('convocados'); // 'convocados' | 'equipos'
  // Reajustes manuales del reparto: { [nombre]: 'a' | 'b' }. Sólo contiene las
  // desviaciones respecto a lo que sugirió balancearEquipos.
  const [equipoOverride, setEquipoOverride] = useState({});
  const [arrastrandoNombre, setArrastrandoNombre] = useState(null);
  const [objetivoNombre, setObjetivoNombre] = useState(null);

  // Lo que ya hay en BD para la fecha del partido: { numero, guardada }
  // (ver cargarJornadaDelPartido). undefined = cargando.
  const [enBd, setEnBd] = useState(undefined);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState('');
  const claveNuevoRef = useRef(0);

  const temporadaId = activa?.id ?? null;
  const fechaPartidoIso = proximoPartido ? toIsoDay(proximoPartido.fecha) : null;

  useEffect(() => {
    if (!temporadaId || !fechaPartidoIso) {
      setEnBd({ numero: null, guardada: null });
      return;
    }
    let cancelado = false;
    cargarJornadaDelPartido(temporadaId, fechaPartidoIso)
      .then((r) => !cancelado && setEnBd(r))
      .catch((err) => {
        // Si falla, la página sigue funcionando con la convocatoria calculada.
        console.error(err);
        if (!cancelado) setEnBd({ numero: null, guardada: null });
      });
    return () => { cancelado = true; };
  }, [temporadaId, fechaPartidoIso]);

  // Convocatoria guardada por el admin, o null (se calcula desde el formulario).
  const guardada = enBd?.guardada ?? null;

  // El número va por jornadas jugadas, no por calendario (hay semanas sin
  // partido): el de BD si este partido ya existe, y si no, el siguiente a la
  // última jugada — la que enseña el header.
  const jornada = useMemo(() => {
    if (!proximoPartido || enBd === undefined) return null;
    return { fecha: proximoPartido.fecha, numero: enBd.numero ?? (ultimaJornada ?? 0) + 1 };
  }, [proximoPartido, enBd, ultimaJornada]);
  const jornadaNumero = jornada?.numero ?? null;

  const loading = clasifLoading || dispLoading || enBd === undefined;
  const error = clasifError || dispError;

  // Ficha de cada jugador por id: estadísticas de la clasificación si las
  // tiene, y si no (invitados) una ficha vacía con su nombre.
  const fichasPorId = useMemo(() => {
    const m = new Map();
    for (const f of guardada?.filas ?? []) {
      m.set(f.jugador_id, fichaSinEstadisticas(f.jugador_id, f.nombre, f.tipo));
    }
    for (const p of clasificacion) m.set(p.id, derivarEstadisticas(p, ultimaJornada ?? 0));
    return m;
  }, [guardada, clasificacion, ultimaJornada]);

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

    const grupos = {
      convocables: convocables.map((p) => p.nombre),
      voluntariosReserva: voluntariosReserva.map((p) => p.nombre),
      noConvocables,
      sinRespuesta,
    };

    // Con una convocatoria guardada manda lo guardado, tenga 12 o no.
    if (guardada) {
      const negro = [];
      const rojo = [];
      const reservas = [];
      for (const f of guardada.filas) {
        const ficha = fichasPorId.get(f.jugador_id) ?? fichaSinEstadisticas(f.jugador_id, f.nombre, f.tipo);
        if (f.rol === 'reserva') reservas.push(ficha);
        else if (f.equipo === 'b') rojo.push(ficha);
        else negro.push(ficha);
      }
      const titulares = [...rojo, ...negro];
      return {
        grupos,
        convocatoria: {
          titulares,
          reservas,
          invitadosNecesarios: Math.max(0, PLAZAS_CONVOCATORIA - titulares.length),
        },
        equipos: { equipo1: negro, equipo2: rojo },
        alineador:
          titulares.find((p) => p.id === guardada.alineadorId) ??
          designarAlineador(titulares, jornada.numero),
      };
    }

    const convocatoria = generarConvocatoria({
      convocables,
      voluntariosReserva,
      invitados: invitados.length,
      semilla: jornada.numero,
    });

    return {
      grupos,
      convocatoria,
      // Devuelve null si no hay 12 exactos: sin plantilla completa no hay reparto.
      equipos: balancearEquipos(convocatoria.titulares),
      // Determinista por número de jornada — no cambia al refrescar.
      alineador: designarAlineador(convocatoria.titulares, jornada.numero),
    };
  }, [clasificacion, respuestas, invitados, jornada, ultimaJornada, guardada, fichasPorId]);

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
  }, [equipos]);

  // Reparto final que se pinta y se comparte: la sugerencia del algoritmo con
  // los intercambios manuales aplicados encima.
  const equiposDisplay = useMemo(() => {
    if (!equipos) return null;
    if (Object.keys(equipoOverride).length === 0) return equipos;
    const equipo1 = [];
    const equipo2 = [];
    for (const p of equipos.equipo1) {
      ((equipoOverride[p.nombre] ?? 'a') === 'a' ? equipo1 : equipo2).push(p);
    }
    for (const p of equipos.equipo2) {
      ((equipoOverride[p.nombre] ?? 'b') === 'a' ? equipo1 : equipo2).push(p);
    }
    return { equipo1, equipo2 };
  }, [equipos, equipoOverride]);

  // Precarga para el editor de registro: usa el reparto tal y como está en
  // pantalla, con los intercambios manuales aplicados. Así, si el usuario
  // movió jugadores antes de "Registrar resultado", el editor se abre con la
  // misma composición que estaban mirando.
  const precargaEditor = useMemo(() => {
    if (!equiposDisplay || !convocatoria) return null;
    return {
      titulares: [
        ...equiposDisplay.equipo1.map((p) => ({ jugador_id: p.id, equipo: 'a' })),
        ...equiposDisplay.equipo2.map((p) => ({ jugador_id: p.id, equipo: 'b' })),
      ],
      reservas: convocatoria.reservas.map((p) => p.id).filter((id) => id != null),
      alineadorId: alineador?.id ?? null,
    };
  }, [equiposDisplay, convocatoria, alineador]);

  // Qué equipo tiene ahora mismo un jugador — usado por los handlers de arrastre
  // para saber si el drop cruza de equipo o no.
  const equipoActualDe = (nombre) => {
    if (equipoOverride[nombre]) return equipoOverride[nombre];
    if (!equipos) return null;
    return equipos.equipo1.some((p) => p.nombre === nombre) ? 'a' : 'b';
  };

  const intercambiar = (nombreA, nombreB) => {
    if (!equipos || nombreA === nombreB) return;
    const teamA = equipoActualDe(nombreA);
    const teamB = equipoActualDe(nombreB);
    if (!teamA || !teamB || teamA === teamB) return;
    setEquipoOverride((prev) => ({ ...prev, [nombreA]: teamB, [nombreB]: teamA }));
  };

  // Arrastrar una fila sobre otra de distinto grupo las intercambia. El mismo
  // mecanismo sirve fuera de edición (entre equipos, por nombre) y dentro
  // (entre equipos y reservas, por clave del borrador).
  const crearArrastre = (grupoDe, intercambiarPar) => (clave) => ({
    draggable: true,
    onDragStart: (e) => {
      setArrastrandoNombre(clave);
      e.dataTransfer.setData('text/plain', clave);
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragEnd: () => {
      setArrastrandoNombre(null);
      setObjetivoNombre(null);
    },
    onDragOver: (e) => {
      if (!arrastrandoNombre || arrastrandoNombre === clave) return;
      if (grupoDe(arrastrandoNombre) === grupoDe(clave)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (objetivoNombre !== clave) setObjetivoNombre(clave);
    },
    onDragLeave: () => {
      if (objetivoNombre === clave) setObjetivoNombre(null);
    },
    onDrop: (e) => {
      e.preventDefault();
      const origen = e.dataTransfer.getData('text/plain') || arrastrandoNombre;
      intercambiarPar(origen, clave);
      setArrastrandoNombre(null);
      setObjetivoNombre(null);
    },
  });

  const construirArrastreProps = crearArrastre(equipoActualDe, intercambiar);

  // ------ Modo edición ("Editar combo") ------------------------------------

  const empezarEdicion = () => {
    const asignados = new Map();
    if (equiposDisplay) {
      for (const p of equiposDisplay.equipo2) asignados.set(p.id, 'b');
      for (const p of equiposDisplay.equipo1) asignados.set(p.id, 'a');
    } else {
      // Sin reparto (no hay 12): se alternan para que el admin parta de algo.
      convocatoria.titulares.forEach((p, i) => asignados.set(p.id, i % 2 === 0 ? 'b' : 'a'));
    }
    for (const p of convocatoria.reservas) asignados.set(p.id, 'res');
    setBorrador({ asignados, nuevos: [] });
    setErrorEdicion('');
    setEditando(true);
  };

  const cancelarEdicion = () => {
    setEditando(false);
    setBorrador(null);
    setErrorEdicion('');
  };

  const listasBorrador = useMemo(() => {
    if (!borrador) return null;
    const listas = { b: [], a: [], res: [] };
    for (const [id, destino] of borrador.asignados) {
      const ficha = fichasPorId.get(id);
      if (ficha) listas[destino].push({ clave: `j-${id}`, destino, ficha });
    }
    for (const n of borrador.nuevos) {
      listas[n.destino].push({
        clave: `n-${n.clave}`,
        destino: n.destino,
        ficha: fichaSinEstadisticas(null, 'Invitado', 'invitado'),
      });
    }
    return listas;
  }, [borrador, fichasPorId]);

  // Se mantiene el alineador mientras siga de titular; si se le quita o pasa a
  // reserva, se designa otro entre los titulares que quedan.
  const alineadorBorrador = useMemo(() => {
    if (!listasBorrador) return null;
    const titulares = [...listasBorrador.b, ...listasBorrador.a]
      .map((it) => it.ficha)
      .filter((f) => f.id != null);
    return (
      titulares.find((f) => f.id === alineador?.id) ??
      designarAlineador(titulares, jornadaNumero ?? 0)
    );
  }, [listasBorrador, alineador, jornadaNumero]);

  // Sólo los jugadores de la clasificación; los invitados entran como "Invitado".
  const disponiblesParaAnadir = useMemo(() => {
    if (!borrador) return [];
    return clasificacion.filter((p) => !borrador.asignados.has(p.id)).sort(porNombreEs);
  }, [clasificacion, borrador]);

  const moverEnBorrador = (clave, destino) => setBorrador((b) => conDestino(b, clave, destino));
  const quitarDeBorrador = (clave) => setBorrador((b) => sinJugador(b, clave));
  const anadirABorrador = (id, destino) =>
    setBorrador((b) => ({ ...b, asignados: new Map(b.asignados).set(id, destino) }));
  const anadirInvitado = (destino) => {
    claveNuevoRef.current += 1;
    const clave = claveNuevoRef.current;
    setBorrador((b) => ({ ...b, nuevos: [...b.nuevos, { clave, destino }] }));
  };
  const intercambiarEnBorrador = (claveA, claveB) =>
    setBorrador((b) => {
      const dA = destinoEnBorrador(b, claveA);
      const dB = destinoEnBorrador(b, claveB);
      if (!dA || !dB || dA === dB) return b;
      return conDestino(conDestino(b, claveA, dB), claveB, dA);
    });

  const construirArrastreEdicion = crearArrastre(
    (clave) => (borrador ? destinoEnBorrador(borrador, clave) : null),
    intercambiarEnBorrador,
  );

  // El equipo con menos gente es el destino por defecto al añadir.
  const destinoSugerido =
    listasBorrador && listasBorrador.a.length < listasBorrador.b.length ? 'a' : 'b';

  const guardarCombo = async () => {
    if (!borrador || !activa || !jornada) return;
    try {
      setGuardando(true);
      setErrorEdicion('');
      const titulares = [];
      const reservas = [];
      for (const [id, destino] of borrador.asignados) {
        if (destino === 'res') reservas.push(id);
        else titulares.push({ jugador_id: id, equipo: destino });
      }
      await guardarConvocatoria({
        temporadaId: activa.id,
        jornadaNumero: jornada.numero,
        jornadaFechaIso: toIsoDay(jornada.fecha),
        titulares,
        reservas,
        invitadosNuevos: borrador.nuevos.map((n) => n.destino),
        alineadorId: alineadorBorrador?.id ?? null,
      });
      setEnBd(await cargarJornadaDelPartido(activa.id, toIsoDay(jornada.fecha)));
      setEditando(false);
      setBorrador(null);
      setVistaConvocatoria('equipos');
    } catch (e) {
      setErrorEdicion(e.message || 'No se pudo guardar la convocatoria');
    } finally {
      setGuardando(false);
    }
  };

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
    Boolean(guardada) ||
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
              equipoNegro: equiposDisplay.equipo1.map((p) => p.nombre),
              equipoRojo: equiposDisplay.equipo2.map((p) => p.nombre),
            }
          : {
              convocados: convocatoria.titulares.map((p) => p.nombre),
            }),
        reservas: convocatoria.reservas.map((p) => p.nombre),
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
      ) : editando && listasBorrador ? (
        /* Modo edición: equipos y reservas con controles por fila, añadir
           jugadores y Cancelar / Guardar. Nada se escribe hasta Guardar. */
        <section className="border-2 border-[var(--sv-on-surface)]">
          <div className="px-4 py-3 bg-[var(--sv-on-surface)] text-[var(--sv-surface)] flex items-center justify-between gap-3">
            <h3 className="font-[Oswald] text-sm font-bold uppercase tracking-[0.1em]">Editando combo</h3>
            <span className="font-[Oswald] text-[11px] font-bold tracking-[0.08em] tabular-nums">
              {listasBorrador.b.length + listasBorrador.a.length}/{PLAZAS_CONVOCATORIA} titulares
            </span>
          </div>
          <p className="px-4 py-2.5 bg-white text-[12px] text-[var(--sv-on-surface-soft)]">
            Usa R / N / Res para mover a cada jugador, o arrástralo sobre otro para intercambiarlos.
            La ✕ lo quita de la convocatoria.
          </p>
          <SeccionEdicion
            titulo="Equipo Rojo"
            emoji="🌹"
            cabeceraBg="bg-[var(--sv-primary)] text-white"
            items={listasBorrador.b}
            alineadorId={alineadorBorrador?.id}
            construirArrastreProps={construirArrastreEdicion}
            arrastrandoNombre={arrastrandoNombre}
            objetivoNombre={objetivoNombre}
            onMover={moverEnBorrador}
            onQuitar={quitarDeBorrador}
          />
          <SeccionEdicion
            titulo="Equipo Negro"
            emoji="🕷"
            cabeceraBg="bg-[var(--sv-on-surface)] text-white"
            items={listasBorrador.a}
            alineadorId={alineadorBorrador?.id}
            construirArrastreProps={construirArrastreEdicion}
            arrastrandoNombre={arrastrandoNombre}
            objetivoNombre={objetivoNombre}
            onMover={moverEnBorrador}
            onQuitar={quitarDeBorrador}
          />
          <SeccionEdicion
            titulo="Reservas"
            cabeceraBg="bg-amber-500 text-white"
            items={listasBorrador.res}
            alineadorId={null}
            construirArrastreProps={construirArrastreEdicion}
            arrastrandoNombre={arrastrandoNombre}
            objetivoNombre={objetivoNombre}
            onMover={moverEnBorrador}
            onQuitar={quitarDeBorrador}
          />
          <AnadirJugador
            disponibles={disponiblesParaAnadir}
            destinoInicial={destinoSugerido}
            onAnadir={anadirABorrador}
            onAnadirInvitado={anadirInvitado}
          />
          {errorEdicion && (
            <p
              role="alert"
              className="px-4 py-3 border-t-2 border-[var(--sv-on-surface)] bg-white text-[12px] font-bold text-[var(--sv-primary)] uppercase tracking-[0.06em]"
            >
              {errorEdicion}
            </p>
          )}
          <div className="p-4 border-t-2 border-[var(--sv-on-surface)] bg-[var(--sv-surface)] flex gap-2">
            <button
              type="button"
              onClick={cancelarEdicion}
              disabled={guardando}
              className="flex-1 border-2 border-[var(--sv-on-surface)] px-4 py-3 text-[13px] font-bold uppercase tracking-[0.09em] font-[Oswald] hover:bg-[var(--sv-surface-low)] disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardarCombo}
              disabled={guardando}
              className="sv-cta flex-1 text-[13px] py-3 disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </section>
      ) : (
        <>
          {(guardada || autenticado) && (
            <div className="-mb-3 flex items-center justify-between gap-3">
              <span className="font-[Oswald] text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--sv-on-surface-muted)]">
                {guardada ? 'Combo ajustado por el admin' : ''}
              </span>
              {autenticado && (
                <button
                  type="button"
                  onClick={empezarEdicion}
                  className="shrink-0 px-3 py-1.5 border-2 border-[var(--sv-primary)] font-[Oswald] text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--sv-primary)] hover:bg-[var(--sv-primary)] hover:text-white transition-colors"
                >
                  Editar combo
                </button>
              )}
            </div>
          )}

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
                  titulo="Equipo Rojo"
                  emoji="🌹"
                  jugadores={equiposDisplay.equipo2}
                  alineador={alineador}
                  cabeceraBg="bg-[var(--sv-primary)] text-white"
                  construirArrastreProps={construirArrastreProps}
                  arrastrandoNombre={arrastrandoNombre}
                  objetivoNombre={objetivoNombre}
                />
                <SubEquipo
                  titulo="Equipo Negro"
                  emoji="🕷"
                  jugadores={equiposDisplay.equipo1}
                  alineador={alineador}
                  cabeceraBg="bg-[var(--sv-on-surface)] text-white"
                  construirArrastreProps={construirArrastreProps}
                  arrastrandoNombre={arrastrandoNombre}
                  objetivoNombre={objetivoNombre}
                />
              </>
            )}
          </section>

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
