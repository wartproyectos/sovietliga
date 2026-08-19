import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useSupabaseData } from './hooks/useSupabaseData';
import { Layout } from './components/Layout';
import { ClasificacionPage } from './pages/ClasificacionPage';
import { HistorialPage } from './pages/HistorialPage';
import { EquiposPage } from './pages/EquiposPage';

function App() {
  const { clasificacion, loading, error, jornada } = useSupabaseData();

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout jornada={jornada} />}>
          <Route
            index
            element={<ClasificacionPage clasificacion={clasificacion} loading={loading} error={error} jornada={jornada} />}
          />
          <Route
            path="historial"
            element={<HistorialPage clasificacion={clasificacion} loading={loading} error={error} />}
          />
          <Route
            path="equipos"
            element={<EquiposPage clasificacion={clasificacion} loading={loading} error={error} />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
