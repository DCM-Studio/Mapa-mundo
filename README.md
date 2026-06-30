# Mapa Mundo

Web app estatica para visualizar datos meteorologicos historicos diarios sobre un mapa mundial.

## Estado actual

Primera version funcional para `dcm.cl/Mapa-mundo`.

Incluye:

- Login visual con usuario `admin-mapa`.
- Opcion de recordar este equipo mediante `localStorage` del navegador.
- Selector de fecha desde `1981-01-01` para meteorologia.
- Controles reorganizados en pestanas: visualizacion, filtros, secuencia y colores.
- Filtros por pais para ciudades y por pais/lugar USGS para terremotos, con opcion predeterminada `Todos los paises`.
- Secuencia automatica tipo play/pausa/detener para recorrer terremotos en orden cronologico o clima/luna dia por dia.
- Secuencia con precarga de frames: el mapa no queda en blanco entre una fecha y la siguiente.
- Barra de tiempo sobre el mapa para pausar, mover manualmente el frame y reflejar datos/colores/textos del frame seleccionado.
- Secuencia de terremotos configurable por rango de fechas, magnitud minima Mx y dias previos/posteriores.
- La secuencia muestra todas las ciudades disponibles/cargadas por la app segun el filtro de pais y los datos seleccionados.
- Capas seleccionables de temperatura promedio, humedad promedio, presion atmosferica y fase lunar.
- Colores configurables por variable.
- Mapa mundial con ciudades principales distribuidas globalmente.
- Carga de datos diarios desde NASA POWER Daily API.
- Limpieza del mapa.
- Exportacion de imagen PNG del mapa visible.
- Exportacion CSV de los datos cargados.
- Exportacion CSV historica M7+ con meteorologia NASA POWER del dia previo a cada terremoto para todas las ciudades/puntos cargados.
- Exportacion historica M7+ asincrona en servidor, con archivo persistente en `exports/`.

## Fuente de datos

La meteorologia se obtiene desde NASA POWER Daily API, usando estos parametros:

| Dato | Parametro NASA POWER | Unidad |
| --- | --- | --- |
| Temperatura promedio | `T2M` | C |
| Humedad promedio | `RH2M` | % |
| Presion atmosferica | `PS` | kPa |

NASA POWER Daily API entrega datos diarios desde `1981-01-01` hasta fechas cercanas al presente. Para fechas muy recientes puede haber rezago de disponibilidad.

La fase lunar se calcula localmente con una formula astronomica basada en ciclo sinodico lunar. No viene desde NASA POWER.

Los sismos se consultan en USGS Earthquake Catalog API. El filtro de pais de terremotos se aplica sobre el texto de ubicacion (`place`) informado por USGS, por lo que en eventos oceanicos o ubicaciones ambiguas puede no existir pais exacto.

## Limites conocidos

- La app es estatica. El login incluido en frontend sirve como barrera de uso, pero no es seguridad real porque las credenciales quedan en el codigo descargable.
- La opcion `Recordar este equipo` guarda el estado de acceso en el navegador local. No reemplaza una proteccion real de carpeta o backend.
- Para seguridad real en `dcm.cl/Mapa-mundo`, proteger la carpeta del hosting con `.htpasswd`, Cloudflare Access, un panel del hosting o un backend.
- NASA POWER entrega datos por coordenada. Cargar literalmente todas las ciudades del mundo desde el navegador produciria miles de solicitudes y podria ser bloqueado. Esta version usa una lista curada de ciudades principales y suma los epicentros USGS M7+ disponibles en el desplegable historico.
- La secuencia limita inicialmente a 200 terremotos o 365 dias para evitar cargas excesivas desde el navegador.
- La precarga de secuencia puede tardar si se elige un rango largo con meteorologia para muchas ciudades; una vez preparada, la barra de tiempo se mueve sobre frames ya cacheados en el navegador.
- La presion `PS` corresponde a presion de superficie del punto, no presion reducida al nivel del mar.

## Despliegue

Subir estos archivos a la carpeta del hosting:

```text
dcm.cl/Mapa-mundo/
  index.html
  assets/
  api/
  exports/
```

No requiere build ni servidor Node. La exportacion historica M7+ usa PHP del hosting para generar archivos persistentes en segundo plano.

## Proximo paso recomendado

Si se necesita cubrir muchas mas ciudades, crear un pequeno backend/cache que consulte NASA POWER una sola vez por ciudad y fecha, guarde resultados, y entregue a la web un JSON consolidado. Eso permite escalar sin saturar la API publica.

Para secuencias largas, el siguiente paso recomendado es mover la preparacion de frames a PHP/cache persistente, siguiendo el mismo patron de la exportacion historica M7+.
