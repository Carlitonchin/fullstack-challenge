# Task 11 - Frontend build hardening

## Contexto

El frontend ya existe y cubre login, pantalla principal del juego, consulta HTTP y sincronizacion por WebSocket, pero en el estado actual no cierra el build de produccion.

Evidencia observada:

- `bun run build` en `frontend/` falla.
- El error reportado actualmente es un import sin uso en `frontend/src/components/game/crash-chart.tsx`:
  - `formatMultiplier, truncateHash` se importan juntos.
  - `truncateHash` no se usa.
- El `README` principal exige una entrega defendible y el frontend debe poder compilar como parte del flujo final.

## Objetivo

Dejar el frontend en un estado donde el build de produccion sea estable y repetible, sin errores de TypeScript ni residuos obvios de codigo muerto.

## Alcance

Incluido:

- Corregir el error actual de compilacion.
- Revisar si existen mas errores de `tsc -b` o del build de Vite.
- Eliminar imports sin uso, helpers muertos y pequenos residuos obvios que rompan el gate de build.
- Confirmar que el frontend sigue funcionando localmente despues del arreglo.

No incluido:

- Rediseños de UI.
- Nuevas features del juego.
- Containerizacion del frontend.

## Dependencias

- Ninguna bloqueante.
- Esta tarea debe resolverse antes de:
  - Task 12
  - Task 18

## Archivos a revisar primero

- `frontend/src/components/game/crash-chart.tsx`
- `frontend/src/pages/home.tsx`
- `frontend/src/pages/login.tsx`
- `frontend/src/lib/api/client.ts`
- `frontend/src/lib/auth.ts`
- `frontend/package.json`

## Pasos detallados

1. Reproducir el error actual.
   - Ejecutar `bun run build` dentro de `frontend/`.
   - Guardar el error exacto como punto de partida.

2. Corregir el error reportado en `crash-chart.tsx`.
   - Eliminar el import no usado si realmente no es necesario.
   - Si la intencion era mostrar el hash truncado en la UI, decidir si:
     - se restaura ese uso, o
     - se elimina el import y se deja el componente limpio.
   - No agregar logica ficticia solo para "usar" el import.

3. Repetir el build despues del primer fix.
   - Si aparece otro error, seguir iterando hasta dejar `bun run build` en verde.
   - No asumir que el problema termina en el primer archivo.

4. Hacer una pasada rapida de higiene sobre el frontend.
   - Revisar imports sin uso.
   - Revisar helpers o componentes no referenciados que rompan el typecheck.
   - Revisar warnings que puedan convertirse en problemas en el pipeline final.

5. Validar que el comportamiento visible del frontend no se rompio.
   - Levantar `bun run dev` si hace falta.
   - Verificar como minimo:
     - pagina de login,
     - carga de la home,
     - render del grafico,
     - compilacion del codigo de auth y cliente HTTP.

6. Registrar el resultado en la documentacion final.
   - El README final deberia poder afirmar que el frontend compila y con que comando se valida.

## Criterios de aceptacion

- `cd frontend && bun run build` termina con exit code 0.
- No quedan imports sin uso en el codigo tocado.
- No se introducen cambios funcionales innecesarios para ocultar el error.
- El frontend sigue renderizando sus pantallas principales.

## Riesgos y decisiones

- Si el error actual destapa otros problemas de tipado, no cerrar la tarea hasta resolver toda la cadena.
- Si aparece una decision de producto implicita, por ejemplo si debe mostrarse el hash truncado en el chart, documentar la decision y mantener coherencia con la transparencia del juego.

## Validacion sugerida

- `cd frontend && bun run build`
- `cd frontend && bun run typecheck`
- Smoke test manual rapido en login y home
