import { ClasificacionTable } from '../components/ClasificacionTable';
import { PageState } from '../components/PageState';

export function ClasificacionPage({ clasificacion, loading, error, jornada }) {
  if (loading || error) {
    return <PageState loading={loading} error={error} loadingMessage="Cargando clasificación..." />;
  }

  return <ClasificacionTable clasificacion={clasificacion} jornada={jornada} />;
}
