# Workflow del proyecto

## Principios

- GitHub es la fuente de verdad.
- Evitar reescrituras grandes sin necesidad.
- Mantener cambios pequenos, verificables y reversibles.
- Documentar decisiones tecnicas que afecten datos, seguridad o despliegue.
- No prometer datos "oficiales" si la fuente no los entrega para ese caso.

## Version inicial

Decision aprobada por implementacion inicial:

- App estatica para compatibilidad con hosting en carpeta `dcm.cl/Mapa-mundo`.
- Datos meteorologicos desde NASA POWER Daily API.
- Mapa SVG con base Natural Earth/world-atlas para exportacion PNG confiable.
- Lista curada de ciudades principales para evitar miles de llamadas desde el navegador.
- Login visual en frontend, documentado como no seguro para uso sensible.

## Decision posterior

- La exportacion historica M7+ se genera en PHP dentro de `api/` y guarda CSV persistentes en `exports/`, para que el proceso pueda continuar aunque el navegador se cierre o se cierre sesion.

## Antes de modificar

1. Revisar `README.md`.
2. Revisar este archivo.
3. Confirmar si el cambio afecta fuente de datos, login, despliegue o cobertura de ciudades.
4. Probar al menos:
   - carga del mapa,
   - aplicacion de una fecha historica,
   - exportacion CSV,
   - exportacion PNG,
   - logout/login.

## Backlog

- Reemplazar login frontend por proteccion real de carpeta o backend.
- Agregar backend/cache para muchas mas ciudades.
- Permitir importar un CSV propio de ciudades.
- Agregar leyendas numericas min/max por variable.
- Agregar busqueda de ciudad y filtros por region.
