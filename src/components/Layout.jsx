import { Outlet, NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Clasificacion', icon: '📊' },
  { to: '/historial', label: 'Historial', icon: '🕑' },
  { to: '/equipos', label: 'Equipos', icon: '⚡' },
];

export function Layout({ jornada }) {
  return (
    <div className="min-h-screen bg-[var(--sv-surface)] flex flex-col">
      {/* Header */}
      <header className="bg-[var(--sv-surface)] text-[var(--sv-on-surface)] border-b-4 border-[var(--sv-on-surface)]">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[33px] font-bold leading-none text-[var(--sv-primary)]">
              Liga Soviet 2025/2026
            </h1>
          </div>
          <div className="bg-[var(--sv-on-surface)] text-[var(--sv-surface)] px-4 py-2 text-sm font-bold tracking-[0.15em] uppercase">
            {jornada ? `Jornada ${jornada}` : 'Cargando'}
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
          {NAV_ITEMS.map(({ to, label, icon }) => (
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
