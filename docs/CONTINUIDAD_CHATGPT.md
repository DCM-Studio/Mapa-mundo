# Continuidad de trabajo ChatGPT

Este documento complementa `docs/WORKFLOW.md` y debe revisarse al iniciar una nueva conversacion de ChatGPT sobre este proyecto.

## Reglas obligatorias

- No alterar nada ya aprobado si no tiene relacion directa con el pedido actual.
- Mantener cambios pequenos, puntuales, reversibles y verificables.
- GitHub es la fuente de verdad. Trabajar sobre la rama `codex/mapa-mundo-webapp`, salvo instruccion explicita distinta.
- Antes de cambiar codigo, revisar `README.md`, `docs/WORKFLOW.md` y este archivo.
- No reescribir la app completa ni reemplazar la arquitectura por una nueva sin aprobacion explicita.
- No eliminar archivos, funciones o hotfixes existentes salvo que el pedido lo requiera claramente y se explique el motivo.
- Si hay que corregir algo, identificar primero el archivo y la causa probable; luego aplicar el cambio minimo.
- Cuando se entregue un comando de instalacion, incluir backup previo y verificacion `curl -I` del archivo afectado.

## Hosting Bluehost

- El sitio publico correcto es `https://dcm.cl/Mapa-mundo/`.
- La carpeta real de despliegue en Bluehost es:

```bash
~/public_html/website_0503344a/Mapa-mundo
```

- No trabajar fuera de esa carpeta para este proyecto.
- No usar `~/public_html/Mapa-mundo` como destino final; esa ruta no corresponde al document root real de `dcm.cl`.
- No tocar otros sitios, carpetas `website_*`, WordPress, `.htaccess` global ni configuraciones fuera de `Mapa-mundo`, salvo instruccion explicita del usuario.

## Patron de instalacion en Termius

Usar este patron, cambiando `NOMBRE_CAMBIO` y el archivo verificado:

```bash
cd ~/public_html/website_0503344a/Mapa-mundo

TS=$(date +%Y%m%d_%H%M%S)
mkdir -p ~/backups-mapa-mundo
tar -czf ~/backups-mapa-mundo/Mapa-mundo-before-NOMBRE_CAMBIO-$TS.tar.gz . 2>/dev/null || true

curl -L -o /tmp/mapa-mundo-NOMBRE_CAMBIO.zip https://github.com/DCM-Studio/Mapa-mundo/archive/refs/heads/codex/mapa-mundo-webapp.zip
rm -rf /tmp/mapa-mundo-NOMBRE_CAMBIO
unzip -q /tmp/mapa-mundo-NOMBRE_CAMBIO.zip -d /tmp/mapa-mundo-NOMBRE_CAMBIO

cp -R /tmp/mapa-mundo-NOMBRE_CAMBIO/Mapa-mundo-codex-mapa-mundo-webapp/* .

find . -type d -exec chmod 755 {} \;
find . -type f -exec chmod 644 {} \;

rm -rf /tmp/mapa-mundo-NOMBRE_CAMBIO /tmp/mapa-mundo-NOMBRE_CAMBIO.zip

curl -I https://dcm.cl/Mapa-mundo/RUTA_DEL_ARCHIVO_AFECTADO
```

Luego sugerir abrir con cache limpio usando un parametro `?v=...`.

## Estado funcional que no debe romperse

- Login/logout existente.
- Mapa base y opcion mostrar/ocultar mapa base.
- Capas meteorologicas: temperatura, presion, humedad y luna.
- Colores por variable y fases lunares.
- Mostrar/ocultar texto por item.
- Placas tectonicas y filtro de ciudades cercanas a limites de placas.
- Terremotos USGS por fecha seleccionada, magnitud minima, color por intensidad y texto opcional.
- Lista desplegable de terremotos M7+ desde 1900.
- Exportacion CSV diaria extendida.
- Exportacion CSV historica M7+ con columnas de terremoto, magnitud, ciudad, clima, luna y cercania/distancia a placas.

## Dinamica de respuesta

- Responder en espanol, directo y pragmatico.
- Si el usuario reporta una falla, pedir o usar evidencia concreta: comando, captura, archivo descargado, `curl -I`, consola o contenido del CSV.
- Si se modifica GitHub, informar exactamente archivo cambiado y dar comando de instalacion.
- Si el problema puede ser cache del navegador, indicar URL con version `?v=...`.
- No asumir que una instalacion quedo aplicada: pedir/verificar `content-length`, `last-modified` o comportamiento visible.