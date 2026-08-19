import { Outlet, NavLink } from 'react-router-dom';
import { useTemporada } from '../contexts/TemporadaContext';
import { SelectorTemporada } from './SelectorTemporada';

const NAV_ITEMS = [
  { to: '/', label: 'Clasificación', icon: '📊' },
  { to: '/historial', label: 'Historial', icon: '🕑' },
  // La Convocatoria solo se muestra en la temporada activa: en una pasada no
  // tiene sentido preparar la próxima jornada.
  { to: '/convocatoria', label: 'Convocatoria', icon: '📋', soloActiva: true },
  // "Crear Equipo" (/equipos) sigue existiendo como ruta, pero fuera del menú:
  // el reparto real lo hace ya la convocatoria.
];

export function Layout({ jornada }) {
  const { esActivaSeleccionada } = useTemporada();
  const items = NAV_ITEMS.filter((it) => !it.soloActiva || esActivaSeleccionada);

  return (
    <div className="min-h-screen bg-[var(--sv-surface)] flex flex-col">
      {/* Header */}
      <header className="bg-[var(--sv-surface)] text-[var(--sv-on-surface)] border-b-4 border-[var(--sv-on-surface)]">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between gap-3">
          <h1 className="text-[28px] sm:text-[33px] font-bold leading-none text-[var(--sv-primary)] flex items-center gap-2 flex-wrap">
            <span>Liga Soviet</span>
            <SelectorTemporada />
          </h1>
          <div className="bg-[var(--sv-on-surface)] text-[var(--sv-surface)] px-4 py-2 text-sm font-bold tracking-[0.15em] uppercase shrink-0">
            {jornada ? `Jornada ${jornada}` : '—'}
          </div>
        </div>
      </header>
      <div className="sv-agit-strip" />

      {/* Contenido principal — padding-bottom para no tapar con la bottom nav */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-0 py-8 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      {/* Bottom Navigation — el padding extra evita que la barra del iPhone tape los enlaces */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[color:rgb(253_250_235/0.9)] backdrop-blur-[20px] border-t-4 border-[var(--sv-on-surface)] pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto flex">
          {items.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-bold uppercase tracking-[0.12em] transition-colors ${
                  isActive
                    ? 'bg-[var(--sv-primary-strong)] text-[var(--sv-surface)]'
                    : 'text-[var(--sv-on-surface)] hover:bg-[var(--sv-surface-low)]'
                }`
              }
            >
              {() => (
                <>
                  <span className="text-xl leading-none" aria-hidden>{icon}</span>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
