# Task 15 - Rewrite root README as delivery documentation

## Contexto

El `README.md` actual sigue funcionando como enunciado del challenge, no como documentacion de la solucion entregada.

Problemas actuales:

- Sigue diciendo que el frontend esta "a implementar".
- Describe `tests/e2e` como espacios vacios listos para usar, cuando la entrega final deberia documentar lo que realmente existe.
- No explica decisiones de arquitectura, trade-offs, ownership de cada servicio, manejo del flujo monetario, compensaciones, ni como verificar el provably fair en esta implementacion concreta.
- No sirve bien para una defensa tecnica en entrevista.

## Objetivo

Transformar el `README.md` raiz en un documento de entrega real, orientado a reviewer tecnico, con setup, arquitectura implementada, decisiones, limitaciones y comandos de validacion.

## Alcance

Incluido:

- Reescritura del README principal.
- Documentar la solucion actual, no el challenge generico.
- Incluir arquitectura, flujos, setup, pruebas y decisiones.

No incluido:

- Documentacion ultra extensa tipo ADR por separado, salvo que se decida agregarla como apoyo.

## Dependencias

- Idealmente cerrar antes:
  - Task 12
  - Task 13
  - Task 14
  - Task 17

## Secciones que el nuevo README debe tener

1. Resumen del proyecto.
   - Que implementa.
   - Que servicios existen.
   - Como se comunican.

2. Arquitectura real.
   - `games` como autoridad de ronda.
   - `wallets` como autoridad monetaria.
   - RabbitMQ y outbox.
   - Kong.
   - Keycloak.
   - Frontend.

3. Ownership por bounded context.
   - Que posee `games`.
   - Que posee `wallets`.
   - Que nunca debe poseer cada uno.

4. Flujo principal de dinero.
   - Bet request.
   - Debit async.
   - Confirmacion o rechazo.
   - Cashout request.
   - Credit async.
   - Consideraciones de idempotencia.

5. Provably fair.
   - Que datos se publican antes de la ronda.
   - Que datos se revelan despues.
   - Como verificar una ronda historica.

6. Setup local.
   - `bun install`
   - `bun run docker:up`
   - URLs importantes.
   - Usuario de prueba.

7. Variables de entorno.
   - Servicios backend.
   - Frontend.

8. Comandos de validacion.
   - Unit tests.
   - E2E.
   - Build frontend.
   - Docker up/down.

9. Trade-offs y limitaciones conocidas.
   - Lo que se resolvio.
   - Lo que quedo intencionalmente fuera.
   - Riesgos si aplica.

## Pasos detallados

1. Hacer inventario de lo realmente implementado.
   - No copiar el texto del challenge.
   - Documentar solo lo que el repo ya soporta.

2. Corregir afirmaciones que hoy son falsas.
   - Frontend "a implementar".
   - Endpoints desalineados.
   - Cualquier comando que no represente el estado real.

3. Incorporar decisiones de arquitectura defendibles.
   - Por que REST para acciones del jugador.
   - Por que WebSocket solo para push.
   - Por que `wallets` es la fuente de verdad del saldo.
   - Por que money flow es async.

4. Documentar flujos operativos.
   - Crear wallet.
   - Apostar.
   - Cashout.
   - Verificacion provably fair.

5. Documentar testing y validacion.
   - Que cubren los unit tests.
   - Que cubren los E2E.
   - Como correrlos.

6. Dejar el README orientado a reviewer.
   - Facil de escanear.
   - Basado en hechos verificables del repo.

## Criterios de aceptacion

- El README raiz describe la solucion actual y no el challenge generico.
- El setup y los comandos son ejecutables y coherentes.
- Las rutas y capacidades documentadas coinciden con el codigo.
- El documento ayuda a defender el proyecto en revision tecnica.

## Riesgos y decisiones

- No mezclar "objetivo del challenge" con "estado actual del repo". Si se conserva una seccion del enunciado, debe estar claramente separada.
- No prometer features que no pasen por codigo o validacion real.

## Validacion sugerida

- Relectura completa del README contra el repo
- Probar cada comando documentado
- Revisar consistencia con Swagger, Docker y tests
