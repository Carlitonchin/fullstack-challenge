# Task 14 - API contract and documentation alignment

## Contexto

Hoy existe una desalineacion entre el contrato publicado en el `README` y el contrato implementado en los controllers.

Evidencia observada:

- `README.md` documenta:
  - `POST /games/bet`
  - `POST /games/bet/cashout`
- `services/games/src/presentation/controllers/games.controller.ts` expone:
  - `POST /games/bets`
  - `POST /games/bets/cashout`

Esto genera una ambiguedad importante para quien prueba la entrega o construye clientes adicionales.

## Objetivo

Definir un contrato REST oficial y dejar alineados codigo, README, Swagger y cliente frontend.

## Alcance

Incluido:

- Tomar una decision explicita sobre la ruta oficial.
- Revisar impacto en frontend y documentacion.
- Corregir las desalineaciones actuales.
- Verificar Swagger.

No incluido:

- Rediseñar toda la API.
- Cambios arbitrarios de naming fuera del alcance del mismatch detectado.

## Dependencias

- Esta tarea debe resolverse antes de cerrar:
  - Task 13
  - Task 15
  - Task 18

## Archivos a revisar primero

- `README.md`
- `services/games/src/presentation/controllers/games.controller.ts`
- `frontend/src/lib/api/client.ts`
- `services/games/src/main.ts`

## Decision principal

Hay que elegir una de estas dos salidas:

1. Mantener el contrato implementado (`/games/bets`, `/games/bets/cashout`) y actualizar la documentacion.
2. Cambiar el controller para ajustarlo al README (`/games/bet`, `/games/bet/cashout`) y actualizar el cliente.

La recomendacion es priorizar consistencia y semantica REST. Si `bets` es el recurso, plural suele ser mas coherente. Pero la decision debe quedar explicitada y sustentada.

## Pasos detallados

1. Confirmar cual es el contrato que ya consume el frontend.
   - Revisar `frontend/src/lib/api/client.ts`.
   - Verificar que use las mismas rutas que el backend.

2. Elegir el contrato oficial.
   - Dejar constancia de por que.
   - Evitar mantener dos variantes en paralelo salvo que haya una razon fuerte.

3. Alinear el backend si hace falta.
   - Revisar decorators de Nest.
   - Revisar descripciones de Swagger.

4. Alinear el frontend si hace falta.
   - Cliente HTTP.
   - Cualquier helper o test que referencie rutas viejas.

5. Alinear el README.
   - Seccion de API REST.
   - Cualquier ejemplo de requests.

6. Verificar la documentacion generada.
   - Revisar `/docs` de `games`.
   - Confirmar que las rutas visibles coinciden con lo documentado en texto.

## Criterios de aceptacion

- Existe una sola version oficial del contrato REST para apuesta y cashout.
- Frontend, controllers y README coinciden.
- Swagger expone las mismas rutas.
- Los tests y ejemplos usan el mismo contrato.

## Riesgos y decisiones

- Cambiar rutas puede romper clientes existentes; si se decide cambiar codigo, hacerlo en un solo corte coherente.
- No dejar aliases silenciosos si despues no van a mantenerse.

## Validacion sugerida

- Revisar `games` Swagger en `/docs`
- Probar manualmente apuesta y cashout con las rutas finales
- Ejecutar los tests o smoke tests que dependan de esas rutas
