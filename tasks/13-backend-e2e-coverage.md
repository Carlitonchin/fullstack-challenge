# Task 13 - Mandatory end-to-end coverage

## Contexto

El backend tiene buena cobertura unitaria en dominio y servicios, pero los tests E2E obligatorios del challenge no existen todavia.

Evidencia observada:

- `services/games/tests/e2e/` contiene solo `.gitkeep`.
- `services/wallets/tests/e2e/` contiene solo `.gitkeep`.
- El `README` exige E2E para:
  - bet -> round progresses -> cashout -> wallet updated
  - bet -> crash -> loss recorded
  - validation failures
- Los criterios eliminatorios del challenge incluyen "Tests existen (unitarios + E2E)".

## Objetivo

Agregar cobertura E2E real sobre los flujos obligatorios, probando HTTP, autenticacion y el comportamiento asincrono entre `games` y `wallets`.

## Alcance

Incluido:

- Diseñar estrategia E2E reproducible.
- Crear tests que cubran los escenarios minimos exigidos.
- Validar el flujo asincrono entre servicios.
- Cubrir autenticacion real o una estrategia de token valida y defendible.

No incluido:

- Playwright.
- Cobertura E2E exhaustiva de UI.
- Casos bonus no pedidos por el challenge.

## Dependencias

- Conviene cerrar antes:
  - Task 14 si cambia el contrato REST oficial.
  - Task 17 si la estrategia del wallet preconfigurado afecta el setup de pruebas.
- Puede depender de Docker o de un test harness local, pero debe quedar claro y documentado.

## Archivos a revisar primero

- `services/games/package.json`
- `services/wallets/package.json`
- `services/games/src/presentation/controllers/games.controller.ts`
- `services/wallets/src/presentation/controllers/wallets.controller.ts`
- `packages/messaging/src/contracts/money-flow.ts`
- `docker-compose.yml`
- `docker/keycloak/realm-export.json`

## Escenarios minimos a cubrir

1. Happy path de cashout.
   - Jugador autenticado.
   - Wallet disponible y con saldo.
   - Apuesta aceptada.
   - La ronda progresa.
   - Cashout exitoso.
   - Balance final actualizado.

2. Happy path de perdida.
   - Jugador autenticado.
   - Apuesta aceptada.
   - La ronda crashea antes del cashout.
   - La apuesta queda perdida.
   - El wallet no recibe payout indebido.

3. Fallos de validacion.
   - Saldo insuficiente.
   - Doble apuesta en la misma ronda.
   - Apuesta fuera de ventana.

## Decisiones tecnicas que hay que tomar

1. Donde viven los tests E2E.
   - Opcion A: concentrarlos en `services/games/tests/e2e` porque el flujo parte del API de `games`.
   - Opcion B: repartirlos por bounded context.
   - Opcion recomendada: un punto principal de E2E del sistema, bien documentado.

2. Como autenticar.
   - Token real emitido por Keycloak del stack local.
   - O un helper que obtenga token automaticamente para el usuario `player`.
   - Evitar mocks de auth si la meta es defender el flujo completo.

3. Como esperar consistencia eventual.
   - Polling sobre endpoints hasta estado terminal.
   - Timeouts claros.
   - Retries finitos.
   - No usar sleeps arbitrarios como unica estrategia.

4. Como controlar el estado inicial.
   - Crear wallet si no existe.
   - O depender de bootstrap fijo si Task 17 lo resuelve.
   - Limpiar o aislar datos entre corridas para no romper idempotencia.

## Pasos detallados

1. Diseñar el harness de prueba.
   - Definir si se ejecuta contra stack Docker levantado.
   - Definir base URL oficial: Kong.
   - Definir helper para login y obtencion de token.

2. Crear helpers de E2E.
   - Login Keycloak.
   - Requests autenticadas.
   - Polling de ronda actual y estado de apuestas.
   - Lectura de wallet.

3. Implementar el caso happy path de cashout.
   - Preparar usuario.
   - Asegurar wallet y saldo.
   - Esperar ventana valida para apostar.
   - Apostar.
   - Esperar inicio de ronda.
   - Ejecutar cashout.
   - Confirmar estado final de bet y wallet.

4. Implementar el caso de perdida por crash.
   - Apostar.
   - No ejecutar cashout.
   - Esperar crash/settlement.
   - Confirmar estado perdido y ausencia de payout.

5. Implementar los casos de validacion requeridos.
   - Saldo insuficiente.
   - Doble apuesta.
   - Apuesta tardia.

6. Hacer los tests repetibles.
   - Evitar depender de orden previo de corridas.
   - Evitar colisiones de datos si se reusa el mismo usuario.
   - Documentar tiempos esperados y limites.

7. Integrar comando de ejecucion claro.
   - Puede mantenerse `bun test tests/e2e`.
   - Si requiere stack previa, el README debe dejarlo explicito.

## Criterios de aceptacion

- Existen tests E2E reales en al menos uno de los directorios `tests/e2e`.
- Cubren todos los escenarios obligatorios del README.
- Pasan de forma repetible con una estrategia de espera razonable.
- Usan el sistema real y prueban el flujo asincrono entre `games` y `wallets`.
- El setup y ejecucion quedan documentados.

## Riesgos y decisiones

- El motor de rondas es temporal y asincrono; no escribir tests fragiles basados solo en sleeps.
- Si la ronda usa tiempos largos, evaluar test fixtures o configuracion controlada para reducir tiempo de corrida sin falsear el comportamiento de negocio.
- Si hace falta un seed deterministico o configuracion de tiempos para E2E, documentarlo como decision consciente y defendible.

## Validacion sugerida

- `bun run docker:up`
- `cd services/games && bun test tests/e2e`
- Confirmar que al menos un caso toca de forma observable a `wallets`
