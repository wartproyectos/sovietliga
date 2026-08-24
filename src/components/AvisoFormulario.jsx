import { FORMULARIO_URL } from '../constants';
import { useTemporada } from '../contexts/TemporadaContext';
import { useTesteo } from '../contexts/TesteoContext';
import { getProximaJornada, getVentana } from '../hooks/useDisponibilidad';

/**
 * Convierte `fecha_inicio` ('YYYY-MM-DD', columna date de Postgres) a un Date
 * en zona local. `new Date('YYYY-MM-DD')` la interpreta como UTC y desfasa la
 * hora — nos importaría en las jornadas del día siguiente al arranque.
 */
function fechaInicioLocal(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Aviso de "apúntate al formulario" que aparece sobre la clasificación.
 *
 * Sólo tiene sentido durante la ventana de respuesta (viernes 00:00 → domingo
 * 12:00 antes del partido) y sólo en la temporada activa. Poner `mostrarSiempre`
 * a `true` lo deja visible fuera de ventana para probar el diseño.
 */
export function AvisoFormulario({ mostrarSiempre = false }) {
  const { activa, esActivaSeleccionada } = useTemporada();
  const { siempreAbierta } = useTesteo();
  if (!esActivaSeleccionada) return null;

  const inicio = fechaInicioLocal(activa?.fecha_inicio);
  if (!inicio) return null;

  if (!mostrarSiempre && !siempreAbierta) {
    const jornada = getProximaJornada(inicio);
    const ventana = getVentana(jornada.fecha);
    const ahora = new Date();
    if (ahora < ventana.inicio || ahora > ventana.fin) return null;
  }

  return (
    <section className="mx-4 mb-6 flex flex-col">
      <div className="relative bg-[var(--sv-on-surface)] pl-6 pr-5 py-4">
        <div className="absolute inset-y-0 left-0 w-2 bg-[var(--sv-primary)]" />
        <p className="font-[Oswald] text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--sv-primary)]">
          ¡Camarada Soviet!
        </p>
        <p className="mt-2 text-sm text-[color:rgb(242_234_217/0.95)] leading-snug">
          Recuerda apuntarte cada jornada a través del formulario. Tienes hasta las{' '}
          <b className="text-white">12:00 del domingo</b> antes del partido para dejar tu respuesta.
        </p>
      </div>
      <a
        href={FORMULARIO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="sv-cta text-[14px] py-4 mt-[2px] w-full"
      >
        Abrir Formulario
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden>
          <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 001.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
          <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
        </svg>
      </a>
    </section>
  );
}
