# PROMPT PARA CLAUDE CODE - PROYECTO LIGA SOVIET

Hola! Necesito tu ayuda para desarrollar una aplicación web completa para gestionar una liga de baloncesto amateur llamada "Liga Soviet".

**HE ADJUNTADO UN DOCUMENTO COMPLETO** con todas las especificaciones del proyecto llamado `PROYECTO_LIGA_SOVIET.md`. Por favor, léelo completamente antes de empezar.

## CONTEXTO RÁPIDO

- Liga de baloncesto amateur entre ~20 amigos
- Partidos semanales de 5vs5, con 12 jugadores convocados por jornada
- Datos actuales en Google Sheets (2 tablas: participación y victorias)
- Necesito conectar la app con Google Sheets y visualizar datos en web
- Funcionalidad clave: **generador automático de equipos equilibrados**

## LO QUE NECESITO QUE HAGAS

### FASE 1 - Setup Inicial
1. Crear proyecto React optimizado para este caso de uso
2. Configurar estructura de carpetas profesional
3. Instalar dependencias necesarias:
   - Google Sheets API client
   - Recharts o Chart.js para gráficos
   - TailwindCSS para estilos
   - Cualquier otra librería que consideres necesaria

### FASE 2 - Conexión con Google Sheets
1. Configurar conexión con Google Sheets API
2. Crear servicio/hook para leer datos de las dos tablas
3. Parsear y transformar datos en formato útil
4. Crear modelo de datos en la aplicación

**NOTA**: Te compartiré el enlace al Google Sheet cuando me lo pidas.

### FASE 3 - Componentes Principales
1. **Dashboard**: Estadísticas generales de la liga
2. **Ranking de Jugadores**: Tabla ordenable con todas las estadísticas
3. **Historial de Jornadas**: Ver resultados pasados
4. **Generador de Equipos**: Algoritmo para crear equipos equilibrados
5. **Vista de Jugador**: Detalle individual con gráficos

### FASE 4 - Generador Automático de Equipos
Este es el componente más importante. Necesito que:
1. Reciba lista de 12 jugadores convocados
2. Aplique algoritmo de balanceo (necesitaré tu ayuda para definirlo)
3. Genere 2 equipos de 6 jugadores lo más equilibrados posible
4. Muestre justificación del balanceo

## INSTRUCCIONES ESPECIALES

1. **Lee el documento completo** `PROYECTO_LIGA_SOVIET.md` que he adjuntado antes de empezar
2. **Hazme preguntas** sobre cualquier aspecto que no esté claro
3. **Trabaja paso a paso**, explicándome cada decisión técnica
4. **Usa buenas prácticas**: código limpio, componentes reutilizables, comentarios cuando sea necesario
5. **Diseño moderno**: Usa TailwindCSS con tema rojo/amarillo (Soviet)

## INFORMACIÓN QUE TE PROPORCIONARÉ

Cuando me lo pidas, te compartiré:
- Enlace al Google Sheet real
- Captura de pantalla de la estructura de datos (ya la tengo disponible)
- Criterios específicos para el algoritmo de equipos
- Cualquier otra información que necesites

## PREGÚNTAME PRIMERO

Antes de empezar a codificar, por favor:
1. Confirma que has leído el documento completo
2. Hazme cualquier pregunta de clarificación
3. Propón la arquitectura y stack técnico que usarás
4. Sugiere un plan de trabajo por fases

Cuando estés listo, dime "He leído las especificaciones y estoy listo para empezar" y empezamos con la Fase 1.

---

**ARCHIVOS ADJUNTOS**:
- `PROYECTO_LIGA_SOVIET.md` - Especificaciones completas del proyecto
- (Opcional) Captura de pantalla de Google Sheets con estructura de datos

¡Gracias! Estoy emocionado por desarrollar esto juntos paso a paso.
