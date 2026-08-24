import { Outlet, NavLink } from 'react-router-dom';
import { useTemporada } from '../contexts/TemporadaContext';
import { SelectorTemporada } from './SelectorTemporada';
import { IconoEstrella } from './IconoEstrella';
import { AdminToggle } from './AdminToggle';

// Iconos planos monocromos — comparten viewBox 24 y `fill=currentColor` para
// heredar el color del NavLink (activo blanco / inactivo gris).

function IconoClasificacion(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M4 20V10h4v10H4zm6 0V4h4v16h-4zm6 0v-7h4v7h-4z" />
    </svg>
  );
}

function IconoHistorial(props) {
  // Registro por filas — cada fila con un marcador a la izquierda. Lee mejor a
  // 20px que el reloj-círculo anterior y encaja con la idea de "historial".
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M3 4h4v4H3V4zm6 1h12v2H9V5zM3 10h4v4H3v-4zm6 1h12v2H9v-2zM3 16h4v4H3v-4zm6 1h12v2H9v-2z" />
    </svg>
  );
}

function IconoConvocatoria(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M6 2h9l3 3v17H6V2zm2 2v2h6V4H8zm-1 6h10v2H7v-2zm0 4h10v2H7v-2zm0 4h7v2H7v-2z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { to: '/', label: 'Clasificación', Icon: IconoClasificacion },
  { to: '/historial', label: 'Historial', Icon: IconoHistorial },
  // La Convocatoria solo tiene sentido en la temporada activa: en una pasada
  // no hay próxima jornada que preparar. Se mantiene visible pero deshabilitada
  // para que la nav no cambie de forma al saltar entre temporadas.
  { to: '/convocatoria', label: 'Convocatoria', Icon: IconoConvocatoria, soloActiva: true },
  // "Crear Equipo" (/equipos) sigue existiendo como ruta, pero fuera del menú:
  // el reparto real lo hace ya la convocatoria.
];

export function Layout({ jornada }) {
  const { esActivaSeleccionada } = useTemporada();

  return (
    <div className="min-h-screen bg-[var(--sv-surface)] flex flex-col">
      {/* Header */}
      <header className="bg-[var(--sv-surface)] text-[var(--sv-on-surface)] border-b-4 border-[var(--sv-on-surface)]">
        <div className="max-w-3xl mx-auto px-5 py-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <IconoEstrella className="w-6 h-6 text-[var(--sv-primary)] shrink-0" />
            <div className="min-w-0">
              <h1 className="font-[Oswald] text-[26px] sm:text-[30px] leading-none font-bold text-[var(--sv-on-surface)] uppercase tracking-[0.02em]">
                Liga Soviet
              </h1>
              <div className="mt-1.5 text-[var(--sv-primary)]">
                <SelectorTemporada />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {jornada ? (
              <div className="sv-corner-cut bg-[var(--sv-on-surface)] text-[var(--sv-surface)] px-4 py-2.5 text-[11px] font-bold tracking-[0.14em] uppercase font-[Oswald]">
                Jornada {jornada}
              </div>
            ) : null}
            <AdminToggle />
          </div>
        </div>
      </header>
      <div className="sv-agit-strip" />

      {/* Contenido principal — padding-bottom para no tapar con la bottom nav */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-0 py-8 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      {/* Bottom Navigation — fondo negro sólido, activo rojo, inactivo gris. */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--sv-on-surface)] border-t-4 border-[var(--sv-on-surface)] pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto grid grid-cols-3">
          {NAV_ITEMS.map(({ to, label, Icon, soloActiva }) => {
            const disabled = soloActiva && !esActivaSeleccionada;
            const baseClass =
              'flex flex-col items-center justify-center gap-1.5 py-3 text-[10px] font-bold uppercase tracking-[0.08em] font-[Oswald] transition-colors';

            if (disabled) {
              return (
                <span
                  key={to}
                  aria-disabled="true"
                  title="Sólo disponible en la temporada activa"
                  className={`${baseClass} text-[#6b6461] cursor-not-allowed select-none`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{label}</span>
                </span>
              );
            }

            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `${baseClass} ${
                    isActive
                      ? 'bg-[var(--sv-primary)] text-white'
                      : 'text-[var(--sv-on-surface-muted)] hover:text-white'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
