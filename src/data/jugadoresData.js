/**
 * Datos estáticos de los jugadores: nivel (1–5) y posición.
 * Edita este archivo para actualizar los valores.
 *
 * nivel:    1 = principiante · 3 = intermedio · 5 = experto
 * posicion: 'base' | 'alero' | 'pivot'
 */
export const JUGADORES_DATA = {
  // Ejemplo — reemplaza con los nombres reales y sus valores:
  'Nombre1':  { nivel: 4, posicion: 'base'  },
  'Nombre2':  { nivel: 3, posicion: 'alero' },
  'Nombre3':  { nivel: 5, posicion: 'pivot' },
  'Nombre4':  { nivel: 2, posicion: 'base'  },
  'Nombre5':  { nivel: 4, posicion: 'alero' },
  'Nombre6':  { nivel: 3, posicion: 'pivot' },
  'Nombre7':  { nivel: 3, posicion: 'base'  },
  'Nombre8':  { nivel: 4, posicion: 'alero' },
  'Nombre9':  { nivel: 2, posicion: 'pivot' },
  'Nombre10': { nivel: 5, posicion: 'base'  },
  'Nombre11': { nivel: 3, posicion: 'alero' },
  'Nombre12': { nivel: 4, posicion: 'pivot' },
};

/** Devuelve los datos de un jugador o valores por defecto si no existe. */
export function getJugadorData(nombre) {
  return JUGADORES_DATA[nombre] ?? { nivel: 3, posicion: 'alero' };
}
