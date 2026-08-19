export const GOOGLE_SHEET_ID = '1e4IhsnbuPXW_1ia9jKqw2ORRQERLdkAk3rMlG3PLJPM';

export const VICTORIAS_RANGE = 'A34:BZ63';
export const PARTICIPACION_RANGE = 'A1:BZ31';

// A partir de esta jornada, el líder de la clasificación se destaca como campeón.
export const CHAMPION_JORNADA = 42;

// Mínimo de partidos jugados para entrar en la clasificación oficial.
// Quien no llegue aparece igualmente, pero agrupado al final de la tabla.
export const MIN_PARTIDOS_CLASIFICACION = 10;

export const FORM_RESPONSES_SHEET_ID = '11lTnNNPxYZqmHb1KCO9EDPG5RDXi7hfJgZxBwniSj_0';

// Jugadores que saltan a la pista cada jornada (6 por equipo).
export const PLAZAS_CONVOCATORIA = 12;

export const TEMPORADA_2627_INICIO = new Date(2026, 8, 7);

// "26/27". Sale del año de arranque, no de la fecha del partido: una jornada de
// febrero pertenece a la temporada que empezó en septiembre del año anterior.
export const TEMPORADA_ETIQUETA =
  `${TEMPORADA_2627_INICIO.getFullYear() % 100}/${(TEMPORADA_2627_INICIO.getFullYear() + 1) % 100}`;

export const EXCLUDED_PLAYERS = new Set([
  'Edu',
  'Patrikov',
  'Josechenko',
  'Marc',
  'Manos',
  'Nuevo 1',
  'Nuevo 2',
  'Nuevo 3',
  'Amigos',
  'Toni Primo',
  'Amigo 1',
  'Amigo 2',
]);
