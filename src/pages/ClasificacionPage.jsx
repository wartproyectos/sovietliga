import { ClasificacionTable } from '../components/ClasificacionTable';
import { AvisoFormulario } from '../components/AvisoFormulario';
import { PageState } from '../components/PageState';

export function ClasificacionPage({ clasificacion, loading, error, jornada }) {
  if (loading || error) {
    return <PageState loading={loading} error={error} loadingMessage="Cargando clasificación..." />;
  }

  return (
    <>
      <AvisoFormulario />
      <ClasificacionTable clasificacion={clasificacion} jornada={jornada} />
    </>
  );
}
