const FECHA = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

// "lunes, 7 de septiembre" → "lunes 7 de septiembre".
const formatFecha = (d) => FECHA.format(d).replace(',', '');

/**
 * "2026/27" → "26/27".  Abrevia los años a dos dígitos porque así se usa el
 * grupo de WhatsApp. Deja intacto cualquier formato que no coincida.
 */
export function abreviarTemporada(nombre) {
  const m = String(nombre ?? '').match(/^(\d{2})(\d{2})\/(\d{2})$/);
  return m ? `${m[2]}/${m[3]}` : String(nombre ?? '');
}

/**
 * Texto de la convocatoria para pegar en el grupo de WhatsApp.
 *
 * Recibe nombres ya resueltos, no objetos de jugador: así el formato del
 * mensaje no depende de cómo se calculen los equipos.
 */
export function construirMensajeWhatsapp({
  temporada,
  numeroJornada,
  fecha,
  alineador = null,
  equipoNegro = [],
  equipoRojo = [],
  reservas = [],
}) {
  const bloque = (titulo, nombres) => [titulo, ...(nombres.length ? nombres : ['—'])].join('\n');

  const partes = [
    `Convo Soviet ${abreviarTemporada(temporada)}: Jornada ${numeroJornada} - ${formatFecha(fecha)}`,
  ];
  if (alineador) partes.push('', `📋 Alineador: ${alineador}`);
  partes.push(
    '',
    bloque('🕷Equipo Negro', equipoNegro),
    '',
    bloque('🌹Equipo Rojo', equipoRojo),
    '',
    bloque('🪑Reservas', reservas),
  );
  return partes.join('\n');
}
