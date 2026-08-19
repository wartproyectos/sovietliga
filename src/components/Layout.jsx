import { Outlet, NavLink } from 'react-router-dom';
import { useTemporada } from '../contexts/TemporadaContext';
import { SelectorTemporada } from './SelectorTemporada';

// Iconos planos monocromos — comparten viewBox 24 y `fill=currentColor` para
// heredar el color del NavLink (activo blanco / inactivo tinta).

function IconoClasificacion(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <rect x="3" y="14" width="4" height="7" />
      <rect x="10" y="8" width="4" height="13" />
      <rect x="17" y="3" width="4" height="18" />
    </svg>
  );
}

function IconoHistorial(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 2a7 7 0 110 14 7 7 0 010-14zm-1 3v5.586l3.293 3.293 1.414-1.414L13 12.172V8h-2z" />
    </svg>
  );
}

function IconoConvocatoria(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M9 2a2 2 0 00-2 2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2-2H9zm0 2h6v2H9V4zM7 10h10v2H7v-2zm0 4h10v2H7v-2zm0 4h6v2H7v-2z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { to: '/', label: 'Clasificación', Icon: IconoClasificacion },
  { to: '/historial', label: 'Historial', Icon: IconoHistorial },
  // La Convocatoria solo se muestra en la temporada activa: en una pasada no
  // tiene sentido preparar la próxima jornada.
  { to: '/convocatoria', label: 'Convocatoria', Icon: IconoConvocatoria, soloActiva: true },
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
          {items.map(({ to, label, Icon }) => (
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
              <Icon className="w-6 h-6" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
