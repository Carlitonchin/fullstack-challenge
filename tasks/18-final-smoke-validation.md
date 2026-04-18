# Task 18 - Final smoke validation and release checklist

## Contexto

Despues de cerrar build, Docker, E2E y documentacion, sigue faltando una validacion final tipo entrega. Esta tarea existe para evitar que el proyecto quede "casi listo" pero con inconsistencias entre repo, comandos y experiencia real.

## Objetivo

Ejecutar una pasada final de verificacion integral para confirmar que la entrega cumple los criterios principales del challenge y que la documentacion coincide con el comportamiento real del sistema.

## Alcance

Incluido:

- Validacion de build.
- Validacion de stack Docker.
- Validacion funcional minima.
- Validacion de tests.
- Validacion de documentacion.

No incluido:

- Nuevas features.
- Refactors grandes que surjan tarde salvo bug critico.

## Dependencias

- Esta tarea debe ejecutarse al final, despues de:
  - Task 11
  - Task 12
  - Task 13
  - Task 14
  - Task 15
  - Task 16
  - Task 17

## Checklist de validacion

### 1. Build y calidad minima

- `cd frontend && bun run build`
- `cd services/games && bun test tests/unit`
- `cd services/wallets && bun test tests/unit`
- E2E donde corresponda

### 2. Stack completo

- `bun run docker:up`
- Confirmar salud de:
  - postgres
  - rabbitmq
  - keycloak
  - kong
  - games
  - wallets
  - frontend

### 3. Smoke funcional

- Abrir frontend en `http://localhost:3000`
- Login con usuario de prueba
- Confirmar wallet y saldo segun estrategia oficial
- Consultar ronda actual
- Apostar
- Esperar progreso de ronda
- Ejecutar cashout o dejar crash
- Verificar actualizacion de wallet y UI

### 4. Consistencia contractual

- Rutas del README
- Rutas del frontend
- Rutas reales en Swagger
- Path de WebSocket

### 5. Consistencia documental

- README raiz coherente con repo
- README del frontend coherente con runtime real
- Comandos documentados realmente ejecutables

## Pasos detallados

1. Ejecutar todos los comandos documentados en el README final.
   - No asumir que funcionan por inspeccion.
   - Confirmar que no falta ningun paso manual oculto.

2. Hacer un smoke test de la experiencia del reviewer.
   - Clonar.
   - Instalar.
   - Levantar stack.
   - Hacer login.
   - Jugar una ronda.

3. Verificar consistencia entre capas.
   - API publicada.
   - Cliente frontend.
   - Swagger.
   - README.

4. Revisar logs y estados de error.
   - Buscar fallos intermitentes de broker, auth o websocket.
   - Si aparece fragilidad, corregir antes de cerrar.

5. Registrar issues residuales.
   - Si queda alguna limitacion conocida, debe quedar documentada con honestidad.

## Criterios de aceptacion

- Los comandos principales del proyecto funcionan como se documentan.
- El stack completo puede levantarse sin pasos manuales no documentados.
- El usuario de prueba puede entrar y jugar.
- Los tests requeridos pasan.
- La documentacion refleja el comportamiento real.

## Riesgos y decisiones

- No cerrar esta tarea con validacion parcial.
- Si `docker:up` o login fallan, eso bloquea la entrega aunque el codigo parezca correcto.
- Si se detecta una diferencia entre doc y codigo, resolver la diferencia, no solo "anotarla".

## Validacion sugerida

- Corrida completa en entorno limpio
- Relectura final del README mientras se sigue el setup paso a paso
- Smoke test real de juego desde el frontend
