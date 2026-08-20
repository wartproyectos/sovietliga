import { PLAZAS_CONVOCATORIA } from '../constants.js';

/**
 * Reglas de convocatoria de la Liga Soviet.
 *
 * Se convocan 12 titulares. Quien sobra pasa a reserva: sigue disponible por si
 * falla alguien a última hora, y la convocatoria se corrige DESPUÉS del partido
 * con lo que pasó de verdad.
 *
 * Cuando hay más convocables que plazas, las normas se aplican en cascada — cada
 * una sólo desempata lo que la anterior dejó igualado:
 *
 *   1. Más jornadas de reserva → juega.   (que todos descansen lo mismo)
 *   2. No jugó la jornada anterior → juega. (no encadenar dos sin jugar)
 *   3. Más partidos jugados → juega.       (premiar la constancia)
 *   4. Fue reserva más recientemente → juega.
 *   5. Azar.
 *
 * Todos los contadores son de la temporada en curso: en la jornada 1 están a
 * cero y la decisión cae íntegra en la norma 5.
 */

// ---------------------------------------------------------------------------
// Decisiones de interpretación de las normas.
// Están aquí arriba y aisladas porque son criterio de liga, no técnica: si el
// grupo cambia de opinión, se cambia el valor y no hay que tocar nada más.
// ---------------------------------------------------------------------------

/**
 * Si no se llega a 12 convocables, ¿se sube a titular a quien se marcó
 * "Reserva" antes de buscar amigos?
 *
 * true → sí. Son jugadores de la liga y están disponibles; llamar a alguien de
 * fuera mientras uno de los nuestros se queda en el banquillo no tiene sentido,
 * y además los invitados no puntúan para la clasificación.
 */
export const PROMOCIONAR_VOLUNTARIOS = true;

// ---------------------------------------------------------------------------
// Normas 1 a 4
// ---------------------------------------------------------------------------

const NORMAS = [
  {
    id: 1,
    // Cuenta cualquier jornada de reserva. Ofrecerse voluntario desde el
    // formulario y quedarse fuera al aplicar las normas son la misma reserva a
    // efectos del registro de convocatoria, así que suman igual.
    nombre: 'Jornadas como reserva',
    describe: (p) => `${p.reservas} reservas`,
    valor: (p) => p.reservas,
    orden: 'desc',
  },
  {
    id: 2,
    nombre: 'Jugó la jornada anterior',
    describe: (p) => (p.jugoJornadaAnterior ? 'jugó la anterior' : 'no jugó la anterior'),
    valor: (p) => (p.jugoJornadaAnterior ? 1 : 0),
    orden: 'asc',
  },
  {
    id: 3,
    nombre: 'Partidos jugados',
    describe: (p) => `${p.pj} partidos`,
    valor: (p) => p.pj,
    orden: 'desc',
  },
  {
    id: 4,
    nombre: 'Última vez de reserva',
    describe: (p) =>
      p.ultimaReservaJornada ? `reserva en J${p.ultimaReservaJornada}` : 'nunca fue reserva',
    valor: (p) => p.ultimaReservaJornada,
    orden: 'desc',
  },
];

const NORMA_AZAR = { id: 5, nombre: 'Azar', describe: () => 'sorteo' };

/**
 * Norma 5. Aleatorio pero estable: la misma jornada siempre da el mismo sorteo,
 * así la convocatoria no se baraja sola cada vez que se repinta la pantalla.
 *
 * La semilla entra en el estado inicial del FNV-1a, no concatenada al nombre:
 * puesta al final sólo afectaría a los últimos pasos del hash y el orden entre
 * jugadores saldría casi idéntico jornada tras jornada. El avalanche final
 * descorrelaciona nombres que comparten prefijo.
 */
function azar(nombre, semilla) {
  let h = (2166136261 ^ Math.imul(semilla + 1, 2654435761)) >>> 0;
  for (let i = 0; i < nombre.length; i++) {
    h ^= nombre.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/**
 * Elige el alineador entre los titulares. Determinista por (semilla, nombre):
 * la misma jornada siempre designa a la misma persona, así no cambia al
 * refrescar la pantalla. Usa el mismo hash que la norma 5 para reutilizar
 * el avalanche final y evitar sesgos por prefijos comunes.
 *
 * Devuelve el jugador entero, o null si la lista viene vacía.
 */
export function designarAlineador(titulares, semilla) {
  if (!titulares || titulares.length === 0) return null;
  let elegido = titulares[0];
  let mejor = azar(elegido.nombre, semilla);
  for (let i = 1; i < titulares.length; i++) {
    const v = azar(titulares[i].nombre, semilla);
    if (v < mejor) {
      mejor = v;
      elegido = titulares[i];
    }
  }
  return elegido;
}

/** Ordena de más a menos prioridad para jugar. */
export function ordenarPorPrioridad(jugadores, semilla) {
  return [...jugadores].sort((a, b) => {
    for (const norma of NORMAS) {
      const va = norma.valor(a);
      const vb = norma.valor(b);
      if (va !== vb) return norma.orden === 'desc' ? vb - va : va - vb;
    }
    return azar(a.nombre, semilla) - azar(b.nombre, semilla);
  });
}

/** Primera norma en la que dos jugadores difieren — la que decide entre ellos. */
export function normaQueDecide(a, b) {
  for (const norma of NORMAS) {
    if (norma.valor(a) !== norma.valor(b)) return norma;
  }
  return NORMA_AZAR;
}

// ---------------------------------------------------------------------------
// Datos de entrada
// ---------------------------------------------------------------------------

/**
 * Traduce una fila de la clasificación a lo que necesitan las normas.
 *
 * `ultimaJornada` es el número de la última jornada con datos, no el de la
 * convocatoria que se está generando: la numeración puede tener huecos (en
 * 2025/26 no existe la jornada 3) y "la anterior" es la última que se jugó.
 */
export function derivarEstadisticas(player, ultimaJornada) {
  const participacion = player.jornadaParticipacion ?? [];

  let ultimaReservaJornada = 0;
  for (let i = 0; i < participacion.length; i++) {
    if (participacion[i] === 'R') ultimaReservaJornada = i + 1;
  }

  return {
    id: player.id ?? null,
    nombre: player.nombre,
    reservas: player.reservas ?? 0,
    pj: player.pj ?? 0,
    jugoJornadaAnterior: ultimaJornada > 0 && participacion[ultimaJornada - 1] === 1,
    ultimaReservaJornada,
    // Los arrastra el reparto en equipos, que ocurre después de las normas.
    pos_principal: player.pos_principal ?? null,
    pos_secundaria: player.pos_secundaria ?? null,
    porcentaje: Number(player.porcentaje ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Convocatoria
// ---------------------------------------------------------------------------

/**
 * @param {Object}   params
 * @param {Array}    params.convocables         Jugadores que dijeron "Convocable".
 * @param {Array}    params.voluntariosReserva  Jugadores que dijeron "Reserva".
 * @param {number}   params.invitados           Amigos disponibles esta jornada.
 * @param {number}   params.semilla             Número de jornada (norma 5).
 */
export function generarConvocatoria({
  convocables = [],
  voluntariosReserva = [],
  invitados = 0,
  semilla = 0,
} = {}) {
  const ordenados = ordenarPorPrioridad(convocables, semilla);
  const voluntarios = ordenarPorPrioridad(voluntariosReserva, semilla);

  // Sobran convocables: las normas deciden quién se queda fuera.
  if (ordenados.length >= PLAZAS_CONVOCATORIA) {
    const titulares = ordenados.slice(0, PLAZAS_CONVOCATORIA);
    const excluidos = ordenados.slice(PLAZAS_CONVOCATORIA);

    return {
      titulares,
      reservas: [...excluidos, ...voluntarios],
      promocionados: [],
      invitadosNecesarios: 0,
      invitadosQueFaltan: 0,
      // Qué norma separó al último titular del primer reserva.
      corte:
        excluidos.length > 0
          ? {
              norma: normaQueDecide(titulares[PLAZAS_CONVOCATORIA - 1], excluidos[0]),
              dentro: titulares[PLAZAS_CONVOCATORIA - 1],
              fuera: excluidos[0],
            }
          : null,
    };
  }

  // Faltan convocables: primero se sube a los voluntarios, y sólo después se
  // recurre a gente de fuera.
  const huecos = PLAZAS_CONVOCATORIA - ordenados.length;
  const promocionados = PROMOCIONAR_VOLUNTARIOS ? voluntarios.slice(0, huecos) : [];
  const titulares = [...ordenados, ...promocionados];
  const invitadosNecesarios = PLAZAS_CONVOCATORIA - titulares.length;

  return {
    titulares,
    reservas: voluntarios.slice(promocionados.length),
    promocionados,
    invitadosNecesarios,
    invitadosQueFaltan: Math.max(0, invitadosNecesarios - invitados),
    corte: null,
  };
}
