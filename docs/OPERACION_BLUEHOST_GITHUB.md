# Operacion Bluehost + GitHub

Este documento fija la dinamica obligatoria para trabajar en `https://dcm.cl/Mapa-mundo/`.

## Objetivo

Mantener GitHub como fuente de verdad, evitar regresiones y reducir intervenciones manuales inseguras en Bluehost.

## Flujo estandar obligatorio

1. El usuario pide un ajuste o reporta una falla.
2. ChatGPT entrega un comando de auditoria completa para Termius, ejecutado solo dentro de:

```bash
~/public_html/website_0503344a/Mapa-mundo
```

3. El usuario pega el resultado de la auditoria.
4. ChatGPT analiza la evidencia y aplica el cambio en GitHub, normalmente en la rama:

```text
codex/mapa-mundo-webapp
```

5. Antes de proponer despliegue, ChatGPT debe revisar que el cambio sea pequeno, directo y sin regresiones conocidas contra:

- `README.md`
- `docs/WORKFLOW.md`
- `docs/CONTINUIDAD_CHATGPT.md`
- este documento
- archivos funcionales relacionados con el pedido

6. ChatGPT entrega un comando de Termius para instalar desde GitHub en Bluehost. Ese comando debe incluir:

- `cd ~/public_html/website_0503344a/Mapa-mundo`
- backup fechado en `~/backups-mapa-mundo`
- descarga desde GitHub de la rama validada
- copia solo dentro de `Mapa-mundo`
- permisos razonables
- verificacion HTTP o funcional de archivos afectados
- URL con `?v=$TS` si puede haber cache

7. El usuario aplica el comando, revisa visualmente y reporta resultado.
8. ChatGPT entrega una auditoria final de comparacion GitHub vs Bluehost.
9. Si hay diferencia entre GitHub y Bluehost, no aplicar nuevos cambios hasta identificar la diferencia y corregir la fuente de verdad.

## Excepcion de emergencia

Solo se permite parche directo en Bluehost cuando:

- la web publicada queda inutilizable o bloqueada,
- el usuario necesita recuperar funcionamiento inmediato,
- y se informa explicitamente que es una excepcion.

Despues de cualquier excepcion, el siguiente paso obligatorio es sincronizar el cambio en GitHub o revertirlo en Bluehost.

## Comandos: forma esperada

El usuario prefiere comandos copiables directamente en el chat. No usar ZIP como entrega manual principal.

Los comandos deben ser claros para alguien no tecnico:

- explicar que hace el comando antes de mostrarlo,
- indicar si modifica o solo audita,
- incluir rollback cuando modifica,
- evitar abreviaturas ambiguas,
- no pedir acciones visuales vagas; nombrar botones o lugares exactos.

## Sugerencia de flujo mas eficiente

Para reducir pasos manuales, se debe tender a dos comandos por ciclo:

1. `audit`: auditoria completa, sin modificar nada.
2. `deploy`: instala desde GitHub, valida y genera auditoria final.

Cuando sea posible, el comando `deploy` debe incluir tambien una comparacion final de checksums o tamanos entre el paquete GitHub descargado y la carpeta publicada.

## Regla de no regresion

No modificar ni reemplazar partes ya aprobadas si no tienen relacion directa con el pedido actual. En particular no romper:

- login/logout,
- mapa base,
- capas meteorologicas,
- fases lunares,
- placas tectonicas,
- terremotos USGS por fecha,
- selector M7+ desde 1900,
- exportacion CSV diaria,
- exportacion CSV historica M7+,
- flujo de auditoria y despliegue desde GitHub.
