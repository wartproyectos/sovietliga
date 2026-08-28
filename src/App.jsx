import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TemporadaProvider } from './contexts/TemporadaContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { useSupabaseData } from './hooks/useSupabaseData';
import { Layout } from './components/Layout';
import { ClasificacionPage } from './pages/ClasificacionPage';
import { HistorialPage } from './pages/HistorialPage';
import { ConvocatoriaPage } from './pages/ConvocatoriaPage';
import { EquiposPage } from './pages/EquiposPage';

function AppRoutes() {
  const { clasificacion, marcadores, loading, error, jornada, refrescar } = useSupabaseData();

  return (
    <Routes>
      <Route element={<Layout jornada={jornada} />}>
        <Route
          index
          element={<ClasificacionPage clasificacion={clasificacion} loading={loading} error={error} jornada={jornada} />}
        />
        <Route
          path="historial"
          element={
            <HistorialPage
              clasificacion={clasificacion}
              marcadores={marcadores}
              loading={loading}
              error={error}
              onCambio={refrescar}
            />
          }
        />
        <Route
          path="convocatoria"
          element={
            <ConvocatoriaPage
              clasificacion={clasificacion}
              loading={loading}
              error={error}
              ultimaJornada={jornada}
              onCambio={refrescar}
            />
          }
        />
        <Route
          path="equipos"
          element={<EquiposPage clasificacion={clasificacion} loading={loading} error={error} />}
        />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <TemporadaProvider>
          <AppRoutes />
        </TemporadaProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}

export default App;
