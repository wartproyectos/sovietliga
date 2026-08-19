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
      <div className="sv-panel p-8 mx-3 sm:mx-4">
        <p className="font-bold text-[var(--sv-primary)] mb-2 uppercase tracking-[0.08em]">
          No se pudieron cargar los datos
        </p>
        <p className="text-sm text-[var(--sv-on-surface)]">{error}</p>
        <p className="mt-3 text-xs text-[var(--sv-on-surface-muted)] uppercase tracking-[0.06em]">
          Si el problema persiste, contacta al administrador.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="sv-panel p-10 text-left text-[var(--sv-on-surface-muted)] mx-3 sm:mx-4">
        <div className="text-3xl mb-3">★</div>
        {loadingMessage}
      </div>
    );
  }

  return null;
}
