import { TEMPORADA_ETIQUETA } from '../constants.js';

const FECHA = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

// "lunes, 7 de septiembre" → "lunes 7 de septiembre".
const formatFecha = (d) => FECHA.format(d).replace(',', '');

/**
 * Texto de la convocatoria para pegar en el grupo de WhatsApp.
 *
 * Recibe nombres ya resueltos, no objetos de jugador: así el formato del
 * mensaje no depende de cómo se calculen los equipos.
 */
export function construirMensajeWhatsapp({
  numeroJornada,
  fecha,
  equipoNegro = [],
  equipoRojo = [],
  reservas = [],
}) {
  const bloque = (titulo, nombres) => [titulo, ...(nombres.length ? nombres : ['—'])].join('\n');

  return [
    `Convo Soviet ${TEMPORADA_ETIQUETA}: Jornada ${numeroJornada} - ${formatFecha(fecha)}`,
    '',
    bloque('🕷Equipo Negro', equipoNegro),
    '',
    bloque('🌹Equipo Rojo', equipoRojo),
    '',
    bloque('🪑Reservas', reservas),
  ].join('\n');
}
