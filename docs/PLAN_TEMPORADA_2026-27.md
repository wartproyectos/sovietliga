# PLAN DE ACCIÓN — LIGA SOVIET 2026/27

> Documento de trabajo. Define el alcance, la arquitectura y las fases para convertir
> el portal de una app de **solo lectura** a una app de **gestión** de la liga.

---

## 1. DECISIONES TOMADAS

| Tema | Decisión |
|------|----------|
| **WhatsApp** | Semiautomático: la app calcula la convocatoria y genera el mensaje formateado; el admin lo pega en el grupo con un botón (copiar / enlace `wa.me`). Sin bot, sin VPS, sin riesgo de baneo. |
| **Disponibilidad** | Página en la app. Se elimina Google Forms y el Sheet intermedio de respuestas. |
| **Marcador** | Solo marcador de equipo (ej. `Negro 45 – Rojo 38`). Sin estadística individual. |
| **Diseño** | Evolucionar la identidad actual (constructivista rojo/crema, Space Grotesk). Sin rediseño desde cero. |
| **Invitados** | Juegan y afectan al resultado, pero **no aparecen en la clasificación**. Se marcan con un flag en BD. |
| **Convocatorias incompletas** | Si hay menos de 12 disponibles, la convocatoria se genera igual. Los huecos se cubren por fuera (amigos, externos). |
| **Edición retroactiva** | Los equipos y el resultado de jornadas pasadas **deben poder editarse** para cuadrar lo previsto con lo que realmente pasó. |
| **Histórico anterior a 25/26** | Descartado. No se migra nada previo a la temporada 2025/26. |
| **Multi-temporada** | Aplazado. Se reduce a un **selector de temporada en la pestaña Clasificación**. No se construye hasta que el sistema esté en marcha. |

### Consecuencias de estas decisiones

- **No hace falta ningún servidor permanente.** Todo funciona con SPA en Vercel + Supabase.
- **Coste: 0 €/mes** (tier gratuito de Supabase sobra para 20 jugadores y ~40 jornadas/año).
- Google Forms desaparece del flujo. El Sheet actual queda solo como origen de la migración histórica.

---

## 2. ARQUITECTURA OBJETIVO

```
┌─────────────────┐        ┌──────────────────────────┐
│  React SPA      │◄──────►│  Supabase                │
│  (Vercel)       │        │  · Postgres              │
│                 │        │  · Auth (magic link)     │
│  Público:       │        │  · RLS por rol           │
│   Clasificación │        │  · REST autogenerada     │
│   Historial     │        └──────────────────────────┘
│  Privado:                            ▲
│   Disponibilidad│                    │ migración única
│   Convocatoria  │        ┌───────────┴──────────────┐
│   Admin/Result. │        │  Google Sheet 2025/26    │
└─────────────────┘        │  (histórico, read-only)  │
                           └──────────────────────────┘
```

**Stack:** React 19 + Vite 7 + Tailwind 4 (actual, sin cambios) + `@supabase/supabase-js`.

**Por qué Supabase:** Postgres relacional (encaja con temporadas/jornadas/partidos), auth
incluida (necesaria para roles), API REST autogenerada (no hay que escribir backend),
Row Level Security (los permisos viven en la BD, no en el cliente).

---

## 3. MODELO DE DATOS

```sql
temporadas
  id, nombre ('2026/27'), fecha_inicio, fecha_fin, activa

jugadores
  id, nombre, alias, pos_principal (1-5), pos_secundaria (1-5),
  rating, activo, rol ('admin' | 'jugador'), auth_user_id,
  tipo ('habitual' | 'invitado')   ← los invitados no entran en la clasificación

jornadas
  id, temporada_id, numero, fecha, alineador_id,
  estado ('borrador' | 'abierta' | 'convocada' | 'jugada')

disponibilidad                      PK (jornada_id, jugador_id)
  jornada_id, jugador_id, disponible, respondido_at

convocatorias                       PK (jornada_id, jugador_id)
  jornada_id, jugador_id, rol ('titular' | 'reserva')

partidos
  id, jornada_id, puntos_a, puntos_b

alineaciones                        PK (partido_id, jugador_id)
  partido_id, jugador_id, equipo ('a' | 'b')
```

### Convocatoria ≠ Alineación

Son dos tablas distintas a propósito, porque representan cosas distintas:

| Tabla | Significa | Alimenta |
|-------|-----------|----------|
| `convocatorias` | **Lo previsto** — quién fue titular y quién reserva el domingo | Contador de reservas, criterios de selección |
| `alineaciones` | **Lo que pasó** — quién jugó de verdad y en qué equipo | PJ, Victorias, %V |

Hoy el Excel funde ambas en una sola celda (`1` **o** `R`). Separarlas es lo que permite
editar una jornada pasada sin corromper el histórico.

**Definición de "descansó"** (para el criterio 1 de selección):

> Fue convocado como `reserva` **Y** no aparece en `alineaciones` de esa jornada.

Es autocorrectivo: si un reserva acabó jugando y editas el partido para incluirlo, su
contador de reservas baja solo. Coincide con la práctica actual del Excel.

### Nota clave sobre la migración

PJ, Victorias, %V y Reservas **no se guardan** — se calculan con una vista SQL.
Esa vista puede devolver exactamente la misma forma que hoy consume la UI:

```
{ nombre, pj, v, porcentaje, reservas, jornadaParticipacion[], jornadaVictorias[] }
```

Es decir: **la Fase 1 sustituye `useSheetData` y nada más**. `ClasificacionTable`,
`PlayerModal` e `HistorialPage` siguen funcionando sin tocarlos.

Dos consecuencias que resuelven problemas actuales:

- **Editar una jornada pasada recalcula toda la clasificación sola.** No hay agregados
  guardados que invalidar ni cuadres manuales.
- **`EXCLUDED_PLAYERS` desaparece.** La lista hardcodeada de `src/constants.js`
  (`'Amigos'`, `'Amigo 1'`, `'Nuevo 1'`…) son invitados y filas placeholder tapadas a
  mano en el código. Con `tipo = 'invitado'` en BD se gestionan desde la web, sin
  tocar código ni desplegar.

---

## 4. FASES

### Fase 0 — Limpieza previa ✅ COMPLETADA

- ✅ `npm run lint` arreglado (el `override` de `ajv` a v8 rompía `@eslint/eslintrc`).
  Resultado: 0 errores, 0 warnings
- ✅ `npm audit`: 13 vulnerabilidades → 0 (todas en dependencias de desarrollo)
- ✅ Estado `error` propagado a Historial y Equipos vía `components/PageState.jsx`
  (antes se quedaban en "Cargando..." eterno si fallaba el fetch)
- ✅ Corregido `"Juan y  ganaron"` → `"Ganó Juan"` / `"Ganaron Juan y N más"`
- ✅ `PLAYER_POSITIONS` extraído a `src/data/posiciones.js` (estaba duplicado en
  `PlayerModal.jsx` y `EquiposPage.jsx`). De paso desapareció el warning de
  `react-hooks/exhaustive-deps` en `EquiposPage`
- ✅ Umbral de 10 PJ → `MIN_PARTIDOS_CLASIFICACION` en `constants.js` (estaba
  hardcodeado en 4 sitios)
- ✅ Código muerto borrado: `App.css`, `jugadoresData.js`, `assets/react.svg`,
  `public/vite.svg`, `src/soviet-basket-logo.jpg`, `detectJornadaFromTable()`,
  y el array `assignmentBySlotIdx` del backtracking (se escribía y nunca se leía)
- ✅ `index.html`: favicon real, título "Liga Soviet", `lang="es"`, meta description,
  `theme-color` y `viewport-fit=cover`
- ✅ `safe-area-inset-bottom` en la bottom nav

**Verificado en navegador con datos reales** (jornada 43): clasificación, historial y
generador de equipos funcionando; el generador produce encaje posicional 1-1 perfecto
y 52% vs 52% de balance en 16 ms.

### Fase 1 — Capa de datos ⭐ *bloquea todo lo demás*

- Proyecto Supabase + esquema completo + vistas de clasificación
- Script de migración del Sheet 2025/26 → BD (temporada archivada)
- Sustituir `useSheetData` por lectura de Supabase

**Criterio de aceptación:** la clasificación calculada desde la BD debe coincidir
jugador a jugador con la que hoy sale del Sheet (43 jornadas, 20 jugadores). Ese
diff es la única prueba real de que el esquema y las vistas son correctos — y es
la razón por la que 2025/26 se migra aunque su selector de temporada esté aplazado.

### Fase 2 — Auth y panel de administración

- Login con magic link; roles `admin` / `jugador`; RLS
- Panel admin: crear jornada, registrar marcador y equipos
- **Editor de jornada** (pantalla clave — es la que sustituye al Excel):
  - Ajustar quién jugó realmente y en qué equipo
  - Añadir invitados sobre la marcha (`tipo = 'invitado'`)
  - Corregir marcador y resultado
  - Funciona igual sobre jornadas pasadas que sobre la última
- **A partir de aquí desaparece la edición manual del Excel**

### Fase 3 — Convocatoria automática

- Página de disponibilidad para jugadores (abre viernes, cierra domingo)
- Algoritmo de selección con los 3 criterios jerárquicos:
  1. Menos veces reserva → prioridad para quedarse fuera
  2. (empate) jugó la semana pasada → más probable reserva
  3. (empate) más partidos jugados en total → reserva
- Previsualización editable (12 titulares + reservas) antes de confirmar
- **Caso "faltan jugadores"**: si hay menos de 12 disponibles, se convoca a todos como
  titulares (sin reservas) y la app avisa de cuántos faltan. El mensaje de WhatsApp
  lo incluye para que el grupo busque externos.
- Generación del mensaje de WhatsApp + botón copiar / `wa.me`

### Fase 4 — Perfiles y equipos equilibrados

- Rating por jugador (propuesta: Elo autoactualizado con cada resultado, sembrado desde el %V actual)
- Balanceador que combine posición + rating + clasificación
- Flujo del alineador de la semana

### Fase 5 — Marcador y estadísticas

- Registro de marcador por partido
- Stats derivadas: diferencia media, rachas, partidos más ajustados
- Gráficos con Recharts (instalado desde el inicio y nunca usado)

### Fase 6 — Pasada de diseño

- Pulido visual, responsive y accesibilidad

### Aplazado (retomar más adelante)

- **Selector de temporada** en la pestaña Clasificación. Los datos ya estarán en BD
  desde la Fase 1, así que es solo UI: un desplegable que cambia el `temporada_id`
  de la consulta.
- Récords históricos / all-time.

> ⚠️ Aunque la UI se aplace, el esquema **mantiene `temporadas` y `temporada_id`
> desde el día 1**. Añadir la tabla ahora cuesta cero; añadirla después obliga a
> migrar todas las filas existentes y a reescribir las vistas de clasificación.

---

## 5. CORTE MÍNIMO PARA EL ARRANQUE DE TEMPORADA

Si la temporada arranca en septiembre, lo imprescindible para el día 1 es:

**Fases 0 → 1 → 2 → 3.**

Con eso ya tienes: convocatoria automática, registro de resultados sin Excel y web
actualizada sola. Las fases 4, 5 y 6 pueden entrar con la liga ya en marcha, porque
ninguna bloquea el flujo semanal.

---

## 6. PENDIENTE DE CONFIRMAR

### Resueltas

| Pregunta | Respuesta |
|----------|-----------|
| Invitados ocasionales | No cuentan para la clasificación → flag `tipo` en `jugadores` |
| Menos de 12 disponibles | Se convoca igual; los huecos se cubren por fuera. Debe poder editarse el partido a posteriori |
| Histórico anterior a 25/26 | Descartado |
| Multi-temporada | Aplazado a un selector en Clasificación; el esquema lo soporta desde el día 1 |

### Abiertas

| # | Pregunta | Bloquea |
|---|----------|---------|
| 1 | ¿Fecha de arranque de la temporada 2026/27? | Secuenciación |
| 2 | ¿Tienes el email de los 20 jugadores? (magic link lo necesita). Si no, alternativa: enlace personal con token, sin login | Fase 2 |
| 3 | Rating: ¿Elo automático o valoración manual 1-5 que tú controlas? | Fase 4 |

---

*Creado: 11 de agosto de 2026*
