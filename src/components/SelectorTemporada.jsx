import { useEffect, useRef, useState } from 'react';
import { useTemporada } from '../contexts/TemporadaContext';

function Chevron({ abierto }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`w-4 h-4 shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 011.08 1.04l-4.25 4.38a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
    </svg>
  );
}

export function SelectorTemporada() {
  const { temporadas, seleccionada, setSeleccionadaId } = useTemporada();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  // Cierra al hacer click fuera o pulsar Escape.
  useEffect(() => {
    if (!abierto) return;
    const enOff = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    };
    const enEsc = (e) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', enOff);
    document.addEventListener('keydown', enEsc);
    return () => {
      document.removeEventListener('mousedown', enOff);
      document.removeEventListener('keydown', enEsc);
    };
  }, [abierto]);

  if (!seleccionada) return null;

  // Con una sola temporada no hay nada que elegir; renderizamos texto plano.
  if (temporadas.length <= 1) {
    return <span className="font-bold">{seleccionada.nombre}</span>;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
        aria-haspopup="menu"
        aria-expanded={abierto}
      >
        <span className="font-bold">{seleccionada.nombre}</span>
        <Chevron abierto={abierto} />
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-50 min-w-[9rem] bg-[var(--sv-surface)] border-2 border-[var(--sv-on-surface)] shadow-lg"
        >
          {temporadas.map((t) => {
            const activa = t.id === seleccionada.id;
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={activa}
                onClick={() => {
                  setSeleccionadaId(t.id);
                  setAbierto(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] flex items-center justify-between gap-3 transition-colors ${
                  activa
                    ? 'bg-[var(--sv-primary)] text-white'
                    : 'text-[var(--sv-on-surface)] hover:bg-[var(--sv-surface-low)]'
                }`}
              >
                <span>{t.nombre}</span>
                {t.activa && (
                  <span
                    className={`text-[10px] tracking-[0.1em] ${activa ? 'opacity-80' : 'text-[var(--sv-on-surface-muted)]'}`}
                  >
                    activa
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
