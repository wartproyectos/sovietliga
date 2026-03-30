# PROYECTO: LIGA SOVIET - Aplicación Web de Gestión de Liga de Baloncesto Amateur

## CONTEXTO DEL PROYECTO

La "Liga Soviet" es una liga de baloncesto amateur entre amigos. Cada semana se reúnen para jugar partidos y necesitan una aplicación web para gestionar convocatorias, registrar resultados y generar estadísticas.

---

## CARACTERÍSTICAS DE LA LIGA

### Jugadores y Formato
- **Total de jugadores**: ~20 jugadores habituales (pueden unirse invitados ocasionales)
- **Formato de partidos**: 5 vs 5 con 1 cambio
- **Jugadores por convocatoria**: 12 jugadores (2 equipos de 6 personas)
- **Jugadores que descansan**: ~8 jugadores por semana (de los 20 totales)

### Proceso Semanal Actual

1. **Viernes**: Se comparte encuesta de Google Forms en WhatsApp
2. **Jugadores responden**: Indican nombre y disponibilidad
3. **Selección de 12 jugadores**: Basada en criterios específicos (ver sección siguiente)
4. **Gestión de Reservas**:
   - Si hay más de 12 disponibles → los no seleccionados quedan como "Reservas" (por si alguien falla)
   - Los reservas se registran en esa jornada como "Reserva"
5. **Formación de equipos**: Los 12 seleccionados se dividen manualmente en 2 equipos equilibrados de 6

---

## CRITERIOS DE SELECCIÓN (JERÁRQUICOS)

Para decidir quién es **RESERVA** cuando hay más de 12 convocables:

### Prioridad 1: Haber sido reserva menos veces
- Quien ha sido reserva menos veces tiene prioridad para quedarse fuera

### Prioridad 2: Haber jugado la semana pasada
- Si hay empate, quien jugó la semana anterior tiene más probabilidad de ser reserva (rotación)

### Prioridad 3: Llevar más partidos jugados
- Si sigue habiendo empate, quien lleva más partidos jugados en total es reserva

**Nota**: Estos criterios se aplican en cascada (jerárquicos). Se mira el primero, si hay empate se va al segundo, y así sucesivamente.

---

## ESTRUCTURA DE DATOS ACTUAL (GOOGLE SHEETS)

Los datos están almacenados en **Google Sheets** en dos archivos:

### Archivo 1: Convocatorias
- Almacena las respuestas del Google Forms
- Registra quién se apunta cada semana

### Archivo 2: Resultados y Estadísticas
**Todo en una misma hoja con dos tablas:**

#### TABLA 1 - PARTICIPACIÓN (Filas 1-31)
Estructura:
- **Columna A**: Nombre del jugador
- **Columna B**: "Jornada" (header)
- **Columna C**: Total de partidos jugados (suma)
- **Columna D**: Total de veces como reserva (suma)
- **Columnas E en adelante (5-44)**: Una columna por jornada (Jornada 1, 2, 3... hasta 40)
  - `1` = El jugador jugó
  - `R` o celda roja = El jugador fue reserva
  - Vacío = No estaba disponible/convocado

#### TABLA 2 - VICTORIAS (Filas 34-63)
Estructura:
- **Columna A**: Nombre del jugador (mismo orden que Tabla 1)
- **Columna B**: Total de victorias (suma)
- **Columna C**: Porcentaje de victorias (calculado)
- **Columnas D en adelante**: Una columna por jornada
  - `1` = Victoria
  - `0.5` = Empate (sistema propio de la liga, aunque en baloncesto no existen empates normalmente)
  - `0` o vacío = Derrota o no jugó

**Nota importante**: Las celdas rojas en la Tabla 1 significan "Reserva" (igual que "R").

---

## FUNCIONALIDADES REQUERIDAS DE LA APLICACIÓN WEB

### Requisitos Técnicos
- **Framework**: React (sugerido)
- **Fuente de datos**: Google Sheets (mantener los datos allí, visualizar en la web)
- **Tecnologías**: Sin preferencia específica del usuario (nivel intermedio de programación)

### Funcionalidades Principales

#### 1. **Visualización de Datos**
- Conectar con Google Sheets y mostrar datos en tiempo real
- Dashboard principal con estadísticas generales

#### 2. **Estadísticas de Jugadores**
Mostrar por cada jugador:
- Total de partidos jugados
- Total de victorias
- Porcentaje de victorias
- Veces como reserva
- Historial por jornada

#### 3. **Rankings**
- Ranking de jugadores por victorias
- Ranking por partidos jugados
- Ranking por porcentaje de victorias
- Jugadores que más han descansado (reservas)

#### 4. **Generador Automático de Equipos** ⭐ FUNCIONALIDAD CLAVE
**Objetivo**: Automatizar y optimizar la formación de 2 equipos equilibrados

**Inputs necesarios**:
- Lista de 12 jugadores convocados para esa semana
- Datos históricos de cada jugador (nivel, posición, victorias, etc.)

**Criterios de equilibrio** (por definir con el usuario):
- Nivel de juego / skill de cada jugador
- Posiciones (base, alero, pívot, etc.)
- Balanceo de victorias/derrotas previas
- Otros criterios personalizados

**Output**:
- Equipo 1: 6 jugadores
- Equipo 2: 6 jugadores
- Lo más equilibrados posible

#### 5. **Historial de Jornadas**
- Ver resultados de cada jornada pasada
- Quién jugó en cada equipo
- Resultado del partido
- Quiénes fueron reserva

#### 6. **(Opcional) Gestión de Convocatorias**
- Posibilidad de marcar convocables para la próxima jornada
- Aplicar automáticamente los criterios de selección de reservas
- Generar lista de 12 jugadores + reservas

---

## ARQUITECTURA PROPUESTA

### Opción Recomendada: Conectar con Google Sheets API

**Ventajas**:
- Mantiene los datos centralizados en Google Sheets
- No requiere base de datos adicional
- Fácil de actualizar manualmente si es necesario
- Los usuarios pueden seguir usando Google Forms

**Pasos técnicos**:
1. Habilitar Google Sheets API
2. Crear credenciales de API (API Key o OAuth)
3. Configurar acceso público al documento o autenticación
4. Usar biblioteca como `gapi` o `googleapis` para leer datos
5. Parsear y transformar datos en formato útil para la app
6. Mostrar en componentes React

### Stack Tecnológico Sugerido
- **Frontend**: React (con hooks)
- **Estilos**: TailwindCSS (para diseño rápido y moderno)
- **Gráficos/Visualización**: Recharts o Chart.js
- **Google Sheets**: API de Google Sheets
- **Hosting**: Netlify, Vercel o GitHub Pages (despliegue gratuito)

---

## INFORMACIÓN ADICIONAL

### Enlace al Google Sheet
El usuario tiene el enlace al documento de Google Sheets con los datos reales.
**PENDIENTE**: Compartir el enlace y configurar permisos de acceso.

### Diseño Visual
- **Temática sugerida**: Colores rojo y amarillo ("Soviet")
- **Estilo**: Moderno, deportivo, fácil de naviar
- Dashboard tipo "analytics" con cards y gráficos

### Futuras Funcionalidades (opcional)
- Sistema de notificaciones para convocatorias
- Integración con WhatsApp
- Modo móvil optimizado
- Exportar estadísticas a PDF
- Comparador de jugadores head-to-head

---

## PRÓXIMOS PASOS PARA IMPLEMENTAR

### Fase 1: Setup y Conexión
1. Configurar proyecto React
2. Conectar con Google Sheets API
3. Leer y parsear datos de ambas tablas
4. Crear modelo de datos en la app

### Fase 2: Visualización Básica
1. Dashboard principal con estadísticas generales
2. Tabla de ranking de jugadores
3. Vista de historial de jornadas

### Fase 3: Generador de Equipos
1. Definir algoritmo de balanceo
2. Interfaz para seleccionar 12 jugadores
3. Generar equipos equilibrados
4. Mostrar resultado con justificación

### Fase 4: Refinamiento
1. Mejorar diseño visual
2. Añadir gráficos y visualizaciones
3. Optimizar para móviles
4. Testing y ajustes

---

## PREGUNTAS PENDIENTES PARA EL USUARIO

1. **Generador de equipos**: ¿Qué criterios adicionales se deben considerar para equilibrar los equipos? (nivel de habilidad, posiciones, etc.)
2. **Enlace de Google Sheets**: Compartir el enlace del documento para configurar la conexión
3. **Permisos**: ¿Hacer el documento público para lectura o configurar autenticación?
4. **Funcionalidades prioritarias**: ¿Cuál es el orden de prioridad de las funcionalidades? (estadísticas, generador de equipos, historial, etc.)
5. **Hosting**: ¿Dónde quieren alojar la aplicación? (Netlify, Vercel, servidor propio, etc.)

---

## NOTAS TÉCNICAS IMPORTANTES

### Parseo de Google Sheets
- Las tablas están en la misma hoja, separadas verticalmente
- Tabla 1: Filas 1-31 (Participación)
- Tabla 2: Filas 34-63 (Victorias)
- Mismo orden de jugadores en ambas tablas
- Necesario mapear correctamente filas y columnas

### Manejo de Datos Especiales
- `R` y celdas rojas = Reserva
- `1` = Jugó o Victoria
- `0.5` = Empate
- Vacío = No disponible o Derrota

### Optimización
- Cachear datos de Google Sheets (no hacer peticiones constantes)
- Calcular estadísticas derivadas en el frontend
- Usar React.memo para optimizar re-renderizados

---

## ESTADO ACTUAL DEL PROYECTO

- ✅ Especificaciones definidas
- ✅ Estructura de datos documentada
- ✅ Criterios de selección establecidos
- ✅ Archivo HTML base creado (versión 1 básica)
- ⏳ Pendiente: Conectar con Google Sheets
- ⏳ Pendiente: Implementar funcionalidades principales
- ⏳ Pendiente: Definir algoritmo de generador de equipos

---

**VERSIÓN**: 1.0  
**FECHA**: 18 de Febrero de 2026  
**PREPARADO PARA**: Claude Code - Desarrollo Completo
