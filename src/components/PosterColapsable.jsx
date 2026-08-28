import { useEffect, useState } from 'react';

/**
 * Poster de ancho completo con toggle expandir / colapsar.
 *
 * Estado inicial: colapsado (~140px), con fundido crema al fondo para señalar
 * que la imagen sigue. Al expandir se muestra completo hasta un máximo del
 * 80% del viewport para no ocupar todo el scroll en pantallas altas. El
 * estado se recuerda en localStorage por `storageKey`.
 */
export function PosterColapsable({
  src,
  alt,
  storageKey,
  alturaColapsada = 140,
  etiquetaExpandir = 'Expandir',
  etiquetaColapsar = 'Colapsar',
}) {
  const [expandido, setExpandido] = useState(() => {
    if (!storageKey) return false;
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, expandido ? '1' : '0');
    } catch { /* localStorage bloqueado, sólo vive en memoria */ }
  }, [expandido, storageKey]);

  return (
    <div className="w-full">
      <div
        className="relative overflow-hidden transition-[max-height] duration-500 ease-out"
        style={{ maxHeight: expandido ? '80vh' : `${alturaColapsada}px` }}
      >
        <img
          src={src}
          alt={alt}
          className="w-full block"
          loading="eager"
          decoding="async"
        />
        {!expandido && (
          // Fundido al color de fondo de la página para que se lea "hay más".
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--sv-surface)] to-transparent"
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        aria-expanded={expandido}
        aria-label={expandido ? etiquetaColapsar : etiquetaExpandir}
        className="w-full bg-[var(--sv-on-surface)] px-4 py-2.5 flex items-center justify-center gap-3 hover:brightness-110 transition"
      >
        <span
          aria-hidden
          className={`text-[var(--sv-surface)] transition-transform text-sm ${expandido ? 'rotate-180' : ''}`}
        >
          ▼
        </span>
      </button>
    </div>
  );
}
