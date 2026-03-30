# CONTEXTO COMPLETO: PROYECTO LIGA SOVIET 🏀⭐

> **Uso**: Importa este único archivo en Claude para continuar el desarrollo de la aplicación. Contiene las especificaciones originales + el estado actual de implementación.

---

## 1. ¿QUÉ ES ESTE PROYECTO?

La **Liga Soviet** es una liga de baloncesto amateur entre ~20 amigos. Se reúnen semanalmente para jugar partidos 5 vs 5. Necesitan una **aplicación web** para visualizar estadísticas y generar equipos equilibrados automáticamente.

### Stack tecnológico (ya configurado)
- **Framework**: React 19 + Vite 7
- **Estilos**: TailwindCSS 4
- **Gráficos**: Recharts 3
- **Routing**: react-router-dom 7
- **Datos**: Google Sheets (vía API pública `gviz/tq`)
- **Hosting**: pendiente (Netlify / Vercel / GitHub Pages)

---

## 2. REGLAS DE LA LIGA

### Formato de partidos
- ~20 jugadores totales (con invitados ocasionales)
- Partidos **5 vs 5** con 1 cambio → 12 jugadores convocados por jornada
- Los ~8 restantes descansan o quedan como **Reservas**

### Proceso semanal
1. **Viernes**: Encuesta Google Forms en WhatsApp
2. Jugadores confirman disponibilidad
3. Se seleccionan 12 jugadores con los criterios siguientes:
4. Los 12 se dividen en 2 equipos de 6 (actualmente manual)

### Criterios de selección de Reservas (jerárquicos)
Cuando hay más de 12 disponibles, se eligen quién es **Reserva** así:

| Prioridad | Criterio |
|-----------|---------|
| 1ª | Menor número de veces como Reserva anterior |
| 2ª | (empate) → jugó la semana pasada → tiene más probabilidad de descansar |
| 3ª | (empate) → más partidos jugados en total → es reserva |

---

## 3. ESTRUCTURA DE DATOS EN GOOGLE SHEETS

**Google Sheet ID**: `1e4IhsnbuPXW_1ia9jKqw2ORRQERLdkAk3rMlG3PLJPM`

Hay **un único archivo** con **dos tablas** en la misma hoja:

### TABLA 1 - PARTICIPACIÓN (filas 1–31)

| Col | Contenido |
|-----|-----------|
| A | (vacía / índice) |
| B | Nombre del jugador |
| C | Total partidos jugados (suma) |
| D | Total veces como reserva (suma) |
| E en adelante | Una columna por jornada (hasta 40): `1` = jugó, `R` o celda roja = Reserva, vacío = no disponible |

### TABLA 2 - VICTORIAS (filas 34–63)

| Col | Contenido |
|-----|-----------|
| A | (vacía) |
| B | Nombre del jugador (mismo orden que Tabla 1) |
| C | Total de victorias (suma) |
| D | % de victorias (calculado) |
| E en adelante | Una columna por jornada: `1` = victoria, `0.5` = empate, `0` o vacío = derrota/no jugó |

### Rangos usados en la app
```
PARTICIPACION_RANGE = 'A1:AR31'
VICTORIAS_RANGE     = 'A34:AR63'
```

### Método de acceso (sin API key)
```
https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:json&range={RANGE}
```
La respuesta viene envuelta en `google.visualization.Query.setResponse(...)` y hay que extraer el JSON interno con regex antes de parsearlo.

### Jugadores excluidos (cuentas de prueba / nombres placeholder)
```js
const EXCLUDED_PLAYERS = new Set([
  'Edu', 'Patrikov', 'Josechenko', 'Marc', 'Manos',
  'Nuevo 1', 'Nuevo 2', 'Nuevo 3', 'Amigos',
]);
```

---

## 4. ESTADO ACTUAL DE LA IMPLEMENTACIÓN

### ✅ Completado

#### Infraestructura
- Proyecto React + Vite inicializado (`c:\Repos\liga-soviet`)
- TailwindCSS 4, Recharts y react-router-dom instalados
- `index.html` raíz configurado

#### Conexión con Google Sheets (`src/App.jsx`)
- Función `parseGvizResponse()`: parsea la respuesta `gviz/tq` de Google
- Función `buildStatsFromParticipation()`: extrae PJ y Reservas de la Tabla 1
- Función `buildClasificacionFromTable()`: construye el ranking desde la Tabla 2
- `detectJornadaFromTable()`: detecta la última jornada con datos
- Fetch paralelo de ambas tablas con `Promise.all`
- Merge de datos: combina victorias + participación por nombre de jugador
- Filtrado de jugadores excluidos

#### UI actual (`src/App.jsx`)
- **Header**: Logo "🏀 Liga Soviet" con fondo rojo `#DC143C` + número de jornada actual
- **Tabla de clasificación** con columnas: `#`, Jugador, PJ, V, %V, Res.
  - Ordenable por cualquier columna (toggle asc/desc)
  - Jugadores clicables → modal con detalle
- **Modal de jugador**: muestra PJ, V, %V, Reservas en cuadrícula
  - Cierra con Escape o clic en backdrop
  - Bloquea scroll del body mientras está abierto
- **Estado de carga** y **mensaje de error** (con instrucciones para hacer el Sheet público)
- Estilos: paleta `stone` + acento `[#DC143C]` (rojo) + `amber-50` (amarillo suave)

### ⏳ Pendiente (por implementar)

| Funcionalidad | Descripción |
|---------------|-------------|
| **Navegación / Routing** | Múltiples vistas (react-router-dom ya instalado, no configurado) |
| **Dashboard principal** | Cards con estadísticas globales de la liga |
| **Historial de Jornadas** | Ver jornada a jornada quién jugó, resultado, reservas |
| **Vista de jugador expandida** | Gráfico de evolución por jornada con Recharts |
| **Generador de Equipos** ⭐ | Algoritmo para dividir 12 jugadores en 2 equipos de 6 equilibrados |
| **Gráficos** | Recharts instalado pero sin usar todavía |
| **Diseño responsive** | Optimizar layout en móvil |
| **Gestión de convocatorias** | Opcional: aplicar criterios de selección automáticamente |

---

## 5. FUNCIONALIDAD CLAVE: GENERADOR DE EQUIPOS ⭐

Este es el componente más importante aún por construir.

### Inputs
- Lista de 12 jugadores convocados para la jornada
- Datos históricos de cada jugador (victorias, PJ, reservas, etc.)

### Criterios de equilibrio (pendiente definir con el usuario)
- Nivel de juego / skill (¿hay datos de esto?)
- Balance de victorias/derrotas históricas
- Posiciones (base, alero, pívot) — ¿hay datos de esto?
- Otros criterios personalizados

### Output esperado
- **Equipo 1**: 6 jugadores
- **Equipo 2**: 6 jugadores
- Justificación del balanceo

> ⚠️ **Pendiente**: Preguntar al usuario si tiene datos de nivel/posición por jugador y cuál debe ser el peso de cada criterio.

---

## 6. DISEÑO VISUAL

- **Colores principales**: Rojo `#DC143C` (crimson) + Amarillo/Ámbar
- **Tema**: Deportivo, moderno, tipo "analytics dashboard"
- **Tipografía**: Sistema (actualmente sin fuente web explícita)
- **Componentes**: Tailwind utility classes + acento rojo soviético

---

## 7. ARQUITECTURA DE ARCHIVOS (actual)

```
liga-soviet/
├── src/
│   ├── App.jsx          ← Lógica principal + UI (actualmente todo en 1 archivo, 441 líneas)
│   ├── App.css
│   ├── main.jsx         ← Entry point React
│   └── index.css
├── docs/
│   ├── CONTEXT_PARA_CLAUDE.md   ← Este archivo
│   ├── PROYECTO_LIGA_SOVIET.md  ← Especificaciones originales detalladas
│   ├── liga-soviet.html         ← Prototipo HTML standalone (referencia visual)
│   └── estructura_google_sheets.png
├── public/
├── index.html
├── package.json
└── vite.config.js
```

---

## 8. LO QUE NECESITO QUE HAGAS

### Preguntas previas que debes hacerme antes de empezar
1. **Generador de equipos**: ¿Hay datos de nivel/skill por jugador en el Sheet? ¿Hay posiciones definidas?
2. **Routing**: ¿Cómo quiero estructurar la navegación? (Header con pestañas, sidebar, etc.)
3. **Prioridad**: ¿Qué funcionalidad implementamos primero?

### Tareas pendientes principales (en orden sugerido)

#### Fase A – Refactorización y routing
1. Separar `App.jsx` en componentes: `hooks/useSheetData.js`, `components/ClasificacionTable.jsx`, etc.
2. Configurar react-router-dom con rutas: `/`, `/historial`, `/equipos`, `/jugador/:nombre`

#### Fase B – Nuevas vistas
1. **Dashboard** (`/`): cards con totales (jornadas jugadas, jugador con más victorias, etc.)
2. **Historial** (`/historial`): tabla o timeline por jornada
3. **Vista de jugador** (`/jugador/:nombre`): Recharts de evolución en el tiempo

#### Fase C – Generador de equipos (`/equipos`)
1. Input: seleccionar 12 jugadores de la lista
2. Algoritmo de balanceo
3. Output visual de los 2 equipos + justificación

#### Fase D – Polish
1. Fuente web (ej. Inter de Google Fonts)
2. Diseño responsive mobile-first
3. Animaciones / transiciones suaves

---

## 9. INSTRUCCIONES PARA CLAUDE

1. **Lee este documento completo** antes de hacer cualquier cosa
2. **Hazme preguntas de clarificación** antes de codificar (especialmente sobre el generador de equipos)
3. **Trabaja fase por fase**, confirmando cada fase antes de pasar a la siguiente
4. **No rompas lo que ya funciona**: la conexión con Google Sheets y la tabla de clasificación ya funcionan correctamente
5. **Código limpio**: separa responsabilidades en componentes/hooks cuando el archivo sea grande
6. El proyecto usa **TailwindCSS v4** (importado vía `@tailwindcss/vite`), no v3 — ten esto en cuenta para la sintaxis
7. El Google Sheet es **público** (acceso de lectura sin auth), no uses OAuth ni API keys

---

*Documento generado: 24 de Marzo de 2026*  
*Estado de la app: Clasificación funcional con datos reales de Google Sheets*
