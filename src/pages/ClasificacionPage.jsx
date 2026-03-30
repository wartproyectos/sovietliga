import { ClasificacionTable } from '../components/ClasificacionTable';

export function ClasificacionPage({ clasificacion, loading, error }) {
  if (loading) {
    return (
      <div className="sv-panel p-10 text-left text-[var(--sv-on-surface-muted)]">
        <div className="text-3xl mb-3">★</div>
        Cargando datos de Google Sheets...
      </div>
    );
  }

  if (error) {
    return (
      <div className="sv-panel p-8">
        <p className="font-bold text-[var(--sv-primary)] mb-2 uppercase tracking-[0.08em]">No se pudieron cargar los datos</p>
        <p className="text-sm text-[var(--sv-on-surface)]">{error}</p>
        <p className="mt-3 text-xs text-[var(--sv-on-surface-muted)] uppercase tracking-[0.06em]">
          Revisa que el documento esté compartido como &quot;Cualquier usuario con el enlace&quot; con permiso de lectura.
        </p>
      </div>
    );
  }

  return <ClasificacionTable clasificacion={clasificacion} />;
}
