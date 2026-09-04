// A partir de esta jornada, el líder de la clasificación se destaca como campeón.
export const CHAMPION_JORNADA = 42;

// Mínimo de partidos jugados para entrar en la clasificación oficial.
// Quien no llegue aparece igualmente, pero agrupado al final de la tabla.
export const MIN_PARTIDOS_CLASIFICACION = 10;

// Sheet donde el formulario de Google guarda las respuestas de disponibilidad.
export const FORM_RESPONSES_SHEET_ID = '11lTnNNPxYZqmHb1KCO9EDPG5RDXi7hfJgZxBwniSj_0';

// Formulario que rellenan los jugadores. El aviso de "apúntate" enlaza aquí.
export const FORMULARIO_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfvuvK8-3VpGMj7ZqUrUBfynLQeL_pGRKkR46BTspx8E9xEAg/viewform?usp=header';

// Jugadores que saltan a la pista cada jornada (6 por equipo).
export const PLAZAS_CONVOCATORIA = 12;

// Regla interna (no publicada en la UI): estos jugadores se consideran
// convocables por defecto cuando no hay respuesta suya en el formulario.
// Si contestan explícitamente "Reserva" o "No convocable", se respeta.
// Comparación case-insensitive con acentos plegados.
export const NOMBRES_CONVOCABLES_POR_DEFECTO = ['Ladrinskj'];
