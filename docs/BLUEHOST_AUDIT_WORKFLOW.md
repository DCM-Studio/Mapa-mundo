# Bluehost live audit workflow

Registro agregado el 2026-06-27 despues del hotfix aplicado en Bluehost para la exportacion historica M7+.

## Regla obligatoria

- Antes de modificar la app publicada, auditar siempre la web final en Bluehost.
- Antes de aplicar cambios, guardar backup fechado de `~/public_html/website_0503344a/Mapa-mundo`.
- Despues de aplicar cambios, auditar nuevamente la web final.
- No tocar nada fuera de `~/public_html/website_0503344a/Mapa-mundo`.
- Entregar siempre comandos de Termius copiables en el chat, no ZIP como mecanismo principal.

## Auditoria minima

La auditoria pre y post cambio debe comprobar:

- HTTP 200 de `https://dcm.cl/Mapa-mundo/`.
- Presencia de `assets/earthquake-catalog-async.js` en `index.html`.
- Referencia a `api/start-export.php` desde el flujo async.
- Escritura en `exports/jobs/`.
- Sintaxis PHP de `api/export-lib.php`, `api/start-export.php` y `api/export-status.php`.
- Estado del ultimo job mediante `api/export-status.php?latest=1`.

## Decision tecnica M7+

El boton `Exportar CSV M7+ historico` debe tener un solo dueno funcional: el flujo persistente de servidor.

Flujo esperado:

- `assets/earthquake-catalog-async.js` intercepta el boton M7+.
- `api/start-export.php` crea un job persistente.
- `api/export-worker.php` genera el CSV en segundo plano.
- `api/export-status.php` informa progreso y recupera el ultimo job con `latest=1`.
- `exports/jobs/latest-job.txt` conserva el ultimo job para poder volver despues, incluso si se cierra la pagina o la sesion visual.

## Resultado de aplicacion Bluehost

Salida reportada por Termius:

- Auditoria antes: HTTP index 200, script async presente, start-export referenciado, escritura `exports/jobs` OK, PHP sin errores.
- Backup creado: `~/backups-mapa-mundo/Mapa-mundo-before-m7-server-export-20260627_125008.tar.gz`.
- Archivos parcheados en Bluehost: `docs/WORKFLOW.md`, `api/export-lib.php`, `api/start-export.php`, `api/export-status.php`, `assets/earthquake-catalog-async.js`, `assets/earthquake-presets.js`.
- Auditoria despues: HTTP index 200, script async presente, start-export referenciado, escritura `exports/jobs` OK, PHP sin errores.

Nota: `api/export-status.php?latest=1` respondio `ID invalido` antes y despues porque aun no existia un job creado por el nuevo flujo. Despues de presionar `Exportar CSV M7+ historico`, debe crearse `exports/jobs/latest-job.txt` y ese endpoint debe devolver el ultimo trabajo.

## Proxima verificacion manual

1. Abrir `https://dcm.cl/Mapa-mundo/?v=20260627_125008`.
2. Iniciar sesion.
3. Presionar `Exportar CSV M7+ historico`.
4. Cerrar la pestana o salir de la sesion visual.
5. Volver a abrir la app.
6. Confirmar que aparece el progreso o el enlace `Descargar archivo listo`.
