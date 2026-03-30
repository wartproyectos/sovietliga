import { Outlet, NavLink, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/',         label: 'Liga',     icon: '🏆' },
  { to: '/historial',label: 'Historial',icon: '📅' },
  { to: '/equipos',  label: 'Equipos',  icon: '⚡' },
];

export function Layout({ jornada }) {
  return (
    <div className="min-h-screen bg-stone-100 flex flex-col">
      {/* Header */}
      <header className="bg-[#DC143C] text-white shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span aria-hidden>🏀</span>
              Liga Soviet
            </h1>
            <p className="text-xs text-red-200 mt-0.5">
              {jornada ? `Jornada ${jornada}` : 'Cargando...'}
            </p>
          </div>
          {/* Estrella soviética decorativa */}
          <span className="text-3xl opacity-20 select-none" aria-hidden>★</span>
        </div>
      </header>

      {/* Contenido principal — padding-bottom para no tapar con la bottom nav */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
        <div className="max-w-2xl mx-auto flex">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 py-3 text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-[#DC143C]'
                    : 'text-stone-400 hover:text-stone-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`text-xl leading-none transition-transform ${isActive ? 'scale-110' : ''}`}
                    aria-hidden
                  >
                    {icon}
                  </span>
                  <span>{label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 h-0.5 w-8 bg-[#DC143C] rounded-t-full" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
