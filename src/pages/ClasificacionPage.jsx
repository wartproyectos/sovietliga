import { ClasificacionTable } from '../components/ClasificacionTable';

export function ClasificacionPage({ clasificacion, loading, error }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8 text-center text-stone-500">
        <div className="text-3xl mb-3 animate-bounce">🏀</div>
        Cargando datos de Google Sheets...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 border border-red-200">
        <p className="font-semibold text-red-700 mb-2">No se pudieron cargar los datos</p>
        <p className="text-sm text-red-600">{error}</p>
        <p className="mt-3 text-xs text-stone-400">
          Revisa que el documento esté compartido como &quot;Cualquier usuario con el enlace&quot; con permiso de lectura.
        </p>
      </div>
    );
  }

  return <ClasificacionTable clasificacion={clasificacion} />;
}
