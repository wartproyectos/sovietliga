import { useEffect } from 'react';
import { IconoEstrella } from './IconoEstrella';
import { FORMULARIO_URL } from '../constants';

// Textos "de jugador". El algoritmo vive en `lib/convocatoria.js` con las mismas
// normas en lenguaje técnico; si cambian las reglas hay que tocar ambos sitios.

const NORMAS_TEXTO = [
  {
    titulo: 'Quien haya sido reserva más veces',
    detalle: 'Para que todos descansen aproximadamente lo mismo a lo largo de la temporada.',
  },
  {
    titulo: 'Quien no jugó la jornada anterior',
    detalle: 'Para no encadenar dos jornadas seguidas sin jugar.',
  },
  {
    titulo: 'Quien lleve más partidos jugados',
    detalle: 'Premia la constancia — el que más ha jugado en la temporada tira antes.',
  },
  {
    titulo: 'Quien fue reserva más recientemente',
    detalle: 'Prioridad para quienes llevan menos tiempo esperando su turno.',
  },
  {
    titulo: 'En caso de Empate: sorteo',
    detalle: 'Aleatorio pero estable — la misma jornada no cambia el resultado al refrescar la pantalla.',
  },
];

const OPCIONES_FORMULARIO = [
  { color: 'var(--sv-verde)', etiqueta: 'Convocable', texto: 'quiero jugar' },
  { color: 'var(--sv-azul)', etiqueta: 'Reserva', texto: 'sólo si hace falta cubrir un hueco' },
  { color: 'var(--sv-primary)', etiqueta: 'No convocable', texto: 'no puedo esta semana' },
];

function Chip({ color, children }) {
  return (
    <span
      className="inline-block px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-white"
      style={{ backgroundColor: color }}
    >
      {children}
    </span>
  );
}

function Seccion({ numero, titulo, children }) {
  return (
    <section className="border-2 border-[var(--sv-on-surface)] bg-white">
      <header className="bg-[var(--sv-on-surface)] px-4 py-2.5 flex items-center gap-2.5">
        <span className="font-[Oswald] text-[var(--sv-primary)] font-bold text-lg leading-none tabular-nums">
          {String(numero).padStart(2, '0')}
        </span>
        <h4 className="font-[Oswald] text-[13px] font-bold uppercase tracking-[0.09em] text-[var(--sv-surface)]">
          {titulo}
        </h4>
      </header>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

export function ComoFuncionaModal({ abierto, onCerrar }) {
  useEffect(() => {
    if (!abierto) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCerrar();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Cómo funciona la convocatoria"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[color:rgb(20_10_10/0.55)] backdrop-blur-[2px]"
        onClick={onCerrar}
        aria-label="Cerrar"
      />

      <div className="relative w-full max-w-lg bg-[var(--sv-surface)] shadow-[10px_10px_0_rgba(0,0,0,0.5)] my-4 sm:my-8">
        <div className="h-1.5 bg-[var(--sv-primary)]" />

        {/* Cabecera. */}
        <div className="bg-[var(--sv-on-surface)] px-5 py-5 relative">
          <button
            type="button"
            onClick={onCerrar}
            className="absolute top-4 right-4 w-7 h-7 border-2 border-[var(--sv-surface)] flex items-center justify-center text-[var(--sv-surface)] hover:bg-[color:rgb(242_234_217/0.15)] transition-colors focus:outline-none"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
              <path d="M4 4l12 12M16 4L4 16" />
            </svg>
          </button>

          <div className="flex items-center gap-2.5 pr-8">
            <IconoEstrella className="w-6 h-6 text-[var(--sv-primary)] shrink-0" />
            <h3 className="font-[Oswald] text-2xl sm:text-[26px] font-bold uppercase tracking-[0.02em] text-[var(--sv-surface)] leading-none">
              Cómo funciona
            </h3>
          </div>
          <p className="mt-2.5 pr-8 text-[13px] text-[color:rgb(242_234_217/0.85)] leading-snug">
            Cómo apuntarte a la próxima jornada y cómo se elige la convocatoria cada semana.
          </p>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Sección 1 — cómo apuntarse. */}
          <Seccion numero={1} titulo="Cómo apuntarte">
            <p className="text-[14px] text-[var(--sv-on-surface)] leading-relaxed">
              El formulario abre el <b>viernes por la mañana</b> y cierra el{' '}
              <b>domingo a las 12:00</b>, antes del partido. Puedes elegir entre tres opciones:
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {OPCIONES_FORMULARIO.map(({ color, etiqueta, texto }) => (
                <li key={etiqueta} className="flex items-center gap-2.5 text-[13px] text-[var(--sv-on-surface)]">
                  <Chip color={color}>{etiqueta}</Chip>
                  <span>{texto}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-[var(--sv-on-surface-muted)] italic leading-relaxed">
              Si no respondes antes del cierre, cuentas como no convocable esa semana.
            </p>
            <a
              href={FORMULARIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="sv-cta w-full mt-4 py-3 text-[13px] flex items-center justify-center gap-2"
            >
              Abrir Formulario
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden>
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 001.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
            </a>
          </Seccion>

          {/* Sección 2 — cómo se elige la convocatoria. */}
          <Seccion numero={2} titulo="Cómo se elige la convocatoria">
            <p className="text-[14px] text-[var(--sv-on-surface)] leading-relaxed">
              Cada jornada juegan <b>12 titulares</b>. Si hay más jugadores convocables que
              plazas, las siguientes normas deciden, en cascada, quién juega y quién queda como
              reserva:
            </p>
            <p className="mt-4 font-[Oswald] text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--sv-primary)]">
              Es convocable quien
            </p>
            <ol className="mt-2 flex flex-col gap-3">
              {NORMAS_TEXTO.map((n, i) => (
                <li key={n.titulo} className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 flex items-center justify-center bg-[var(--sv-primary)] text-white font-[Oswald] text-[12px] font-bold tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[13px] font-bold text-[var(--sv-on-surface)] uppercase tracking-[0.02em] leading-snug">
                      {n.titulo}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--sv-on-surface-muted)] leading-snug">
                      {n.detalle}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 pt-4 border-t border-[color:rgb(22_20_18/0.15)] text-[13px] text-[var(--sv-on-surface)] leading-relaxed flex flex-col gap-2">
              <p>
                <b className="uppercase tracking-[0.04em] text-[var(--sv-primary)]">Si sobran jugadores</b> — los que quedan
                fuera pasan a <b>reserva</b> por si falla alguien a última hora.
              </p>
              <p>
                <b className="uppercase tracking-[0.04em] text-[var(--sv-primary)]">Si faltan jugadores</b> — primero suben los
                que se ofrecieron como reserva; si aún faltan, se llama a invitados de fuera de la
                liga (que juegan pero no cuentan para la clasificación).
              </p>
              <p>
                <b className="uppercase tracking-[0.04em] text-[var(--sv-primary)]">Alineador</b> — de los 12 titulares se
                designa uno al azar como alineador de la semana. La designación es fija por jornada,
                así que no cambia al refrescar.
              </p>
            </div>
          </Seccion>
        </div>
      </div>
    </div>
  );
}
