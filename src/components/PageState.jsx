import { IconoEstrella } from './IconoEstrella';

/**
 * Estado compartido de carga / error para las páginas.
 *
 * Uso — comprobar las condiciones antes de renderizarlo:
 *
 *   if (loading || error) return <PageState loading={loading} error={error} />;
 *
 * (Ojo: `const x = <PageState ... />` siempre es truthy aunque el componente
 * devuelva null, porque un elemento JSX es un objeto.)
 */
export function PageState({ loading, error, loadingMessage = 'Cargando datos...' }) {
  if (error) {
    return (
      <div className="mx-4 border-2 border-[var(--sv-on-surface)] bg-white p-6">
        <p className="font-[Oswald] font-bold text-[var(--sv-primary)] mb-2 uppercase tracking-[0.09em]">
          No se pudieron cargar los datos
        </p>
        <p className="text-sm text-[var(--sv-on-surface)]">{error}</p>
        <p className="mt-3 text-xs text-[var(--sv-on-surface-muted)] uppercase tracking-[0.06em] font-[Oswald]">
          Si el problema persiste, contacta al administrador.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-4 border-2 border-[var(--sv-on-surface)] bg-white p-8 text-left text-[var(--sv-on-surface-muted)] flex items-center gap-3">
        <IconoEstrella className="w-6 h-6 text-[var(--sv-primary)] shrink-0" />
        <span className="font-[Oswald] uppercase tracking-[0.09em] text-sm font-semibold">
          {loadingMessage}
        </span>
      </div>
    );
  }

  return null;
}
