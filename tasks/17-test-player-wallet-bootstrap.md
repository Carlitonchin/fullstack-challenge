# Task 17 - Test player wallet bootstrap strategy

## Contexto

El challenge pide un usuario de prueba preconfigurado en el IdP con saldo en la cartera. Hoy el usuario de Keycloak existe, pero la wallet con saldo inicial se crea bajo demanda a traves de `POST /wallets`.

Evidencia observada:

- El realm de Keycloak ya define al usuario `player`.
- `services/wallets/src/application/use-cases/create-my-wallet.use-case.ts` crea la wallet y le acredita un saldo inicial de `10_000` centavos.
- No hay evidencia de bootstrap automatico de la wallet para el usuario de prueba durante `docker:up`.

## Objetivo

Definir e implementar una estrategia clara para que el usuario de prueba quede realmente listo para usar en un entorno de demo o evaluacion, sin pasos manuales ambiguos.

## Alcance

Incluido:

- Elegir si la wallet de demo debe:
  - crearse automaticamente al bootstrap, o
  - crearse explicitamente como primer paso documentado del flujo.
- Alinear esa decision con README, E2E y experiencia del reviewer.

No incluido:

- Sistema general de seed de miles de wallets.
- Admin panel de bootstrap.

## Dependencias

- Afecta:
  - Task 13
  - Task 15
  - Task 18

## Opciones validas

### Opcion A - Bootstrap automatico recomendado para demo

Pros:

- Cumple mejor la expectativa del challenge.
- Reduce friccion para reviewer.
- Hace mas estable el smoke test inicial.

Contras:

- Introduce logica de seed/bootstrapping adicional.
- Hay que decidir donde vive y cuando corre.

### Opcion B - Creacion on-demand documentada

Pros:

- Mantiene el flujo de negocio mas puro.
- Menor complejidad operacional.

Contras:

- Cumple peor con la frase "usuario de prueba preconfigurado con saldo".
- El reviewer debe hacer un paso adicional antes de jugar.

## Recomendacion

Priorizar una experiencia de demo directa. Si el challenge se evalua manualmente, conviene que el usuario `player` ya tenga wallet y saldo despues de levantar el stack.

## Archivos a revisar primero

- `docker/keycloak/realm-export.json`
- `services/wallets/src/application/use-cases/create-my-wallet.use-case.ts`
- `services/wallets/src/presentation/controllers/wallets.controller.ts`
- `docker-compose.yml`
- `README.md`

## Pasos detallados

1. Tomar la decision de bootstrap.
   - Explicitar si el proyecto va a cumplir el requisito de forma automatica o documental.
   - Dejar la decision registrada en el README final.

2. Si se elige bootstrap automatico:
   - Diseñar donde corre:
     - script de inicializacion,
     - job de arranque,
     - seeding controlado,
     - hook automatizado despues de levantar servicios.
   - Garantizar idempotencia.
   - No depender de pasos manuales.
   - No romper el principio de que `wallets` sigue siendo la autoridad monetaria.

3. Si se mantiene la creacion on-demand:
   - Documentar claramente que el primer paso tras login es crear la wallet.
   - Ajustar criterios y wording del README para no afirmar algo falso.
   - Hacer visible el estado en UI para que no parezca un error.

4. Alinear testing.
   - Los E2E deben conocer la estrategia oficial.
   - No mezclar un supuesto de wallet preexistente con tests que la crean siempre desde cero sin explicarlo.

5. Verificar saldo inicial.
   - Confirmar moneda.
   - Confirmar valor inicial.
   - Confirmar visibilidad en UI y API.

## Criterios de aceptacion

- Existe una estrategia oficial y clara para el usuario de prueba y su wallet.
- Esa estrategia es consistente con lo que el README promete.
- La experiencia del reviewer no depende de pasos ocultos o ambiguos.
- El flujo elegido es idempotente y defendible.

## Riesgos y decisiones

- Si se hace bootstrap automatico, evitar crear dinero duplicado en cada arranque.
- Si se mantiene on-demand, aceptar que el wording del README debe cambiar.

## Validacion sugerida

- Levantar el stack desde cero
- Probar login con `player`
- Verificar si la wallet existe y con que saldo
- Verificar que la experiencia coincide con lo documentado
