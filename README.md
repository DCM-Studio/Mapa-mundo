# Mapa Mundo

Web app estatica para visualizar datos meteorologicos historicos diarios sobre un mapa mundial.

## Estado actual

Primera version funcional para `dcm.cl/Mapa-mundo`.

Incluye:

- Login visual con usuario `admin-mapa`.
- Selector de fecha desde `1981-01-01`.
- Capas seleccionables de temperatura promedio, humedad promedio, presion atmosferica y fase lunar.
- Colores configurables por variable.
- Mapa mundial con ciudades principales distribuidas globalmente.
- Carga de datos diarios desde NASA POWER Daily API.
- Limpieza del mapa.
- Exportacion de imagen PNG del mapa visible.
- Exportacion CSV de los datos cargados.

## Fuente de datos

La meteorologia se obtiene desde NASA POWER Daily API, usando estos parametros:

| Dato | Parametro NASA POWER | Unidad |
| --- | --- | --- |
| Temperatura promedio | `T2M` | C |
| Humedad promedio | `RH2M` | % |
| Presion atmosferica | `PS` | kPa |

NASA POWER Daily API entrega datos diarios desde `1981-01-01` hasta fechas cercanas al presente. Para fechas muy recientes puede haber rezago de disponibilidad.

La fase lunar se calcula localmente con una formula astronomica basada en ciclo sinodico lunar. No viene desde NASA POWER.

## Limites conocidos

- La app es estatica. El login incluido en frontend sirve como barrera de uso, pero no es seguridad real porque las credenciales quedan en el codigo descargable.
- Para seguridad real en `dcm.cl/Mapa-mundo`, proteger la carpeta del hosting con `.htpasswd`, Cloudflare Access, un panel del hosting o un backend.
- NASA POWER entrega datos por coordenada. Cargar literalmente todas las ciudades del mundo desde el navegador produciria miles de solicitudes y podria ser bloqueado. Esta version usa una lista curada de ciudades principales.
- La presion `PS` corresponde a presion de superficie del punto, no presion reducida al nivel del mar.

## Despliegue

Subir estos archivos a la carpeta del hosting:

```text
dcm.cl/Mapa-mundo/
  index.html
  assets/
    app.js
    styles.css
```

No requiere build ni servidor Node.

## Proximo paso recomendado

Si se necesita cubrir muchas mas ciudades, crear un pequeno backend/cache que consulte NASA POWER una sola vez por ciudad y fecha, guarde resultados, y entregue a la web un JSON consolidado. Eso permite escalar sin saturar la API publica.
