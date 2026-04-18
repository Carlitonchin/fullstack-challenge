# Task 16 - Frontend runtime documentation and env contract

## Contexto

El frontend ya tiene implementado:

- login OIDC con Keycloak,
- cliente HTTP hacia Kong,
- sincronizacion WebSocket,
- pantalla principal del juego.

Sin embargo, su documentacion esta incompleta o desactualizada.

Evidencia observada:

- `frontend/README.md` sigue siendo el template por defecto de Vite/shadcn.
- No existe `frontend/.env.example`.
- La configuracion runtime existe en codigo, pero no esta formalizada para quien tenga que correr o mantener la app.

## Objetivo

Dejar al frontend con una documentacion operativa minima y un contrato de variables de entorno explicito.

## Alcance

Incluido:

- Reemplazar el README template del frontend.
- Crear `frontend/.env.example`.
- Documentar base URLs, Keycloak, redirect URI y gateway.
- Explicar como correr el frontend fuera de Docker y dentro del stack completo.

No incluido:

- Refactors funcionales grandes.
- Cambios de producto.

## Dependencias

- Conviene hacerla despues de Task 12 para documentar el modelo Docker final.
- Aporta contexto al README raiz de Task 15.

## Archivos a revisar primero

- `frontend/README.md`
- `frontend/src/lib/auth.ts`
- `frontend/src/lib/api/client.ts`
- `frontend/package.json`
- `docker-compose.yml`

## Variables que deben quedar documentadas

Como minimo:

- `VITE_API_BASE_URL`
- `VITE_KEYCLOAK_BASE_URL`
- `VITE_KEYCLOAK_REALM`
- `VITE_KEYCLOAK_CLIENT_ID`
- `VITE_KEYCLOAK_REDIRECT_URI`

Defaults observados hoy:

- API base: `http://localhost:8000`
- Keycloak base: `http://localhost:8080`
- Realm: `crash-game`
- Client ID: `crash-game-client`
- Redirect URI: `${window.location.origin}/auth/callback`

## Pasos detallados

1. Crear `frontend/.env.example`.
   - Incluir todas las variables soportadas.
   - Usar valores de desarrollo local coherentes con Docker Compose.

2. Reescribir `frontend/README.md`.
   - Objetivo del frontend.
   - Comandos:
     - `bun install`
     - `bun run dev`
     - `bun run build`
   - Variables de entorno.
   - Flujo de autenticacion.
   - Dependencia de Kong y Keycloak.

3. Explicar el contrato de red.
   - HTTP via Kong.
   - WebSocket en `/games/socket.io`.
   - No hablar directo con microservicios salvo que se documente una excepcion clara.

4. Explicar modos de ejecucion.
   - Modo local de desarrollo.
   - Modo dentro del stack Docker.

5. Agregar notas de troubleshooting.
   - Redirect URI invalida.
   - Token expirado.
   - Kong no disponible.
   - WebSocket desconectado.

## Criterios de aceptacion

- Existe `frontend/.env.example`.
- `frontend/README.md` ya no es un template generico.
- La configuracion runtime del frontend queda clara para otro desarrollador.
- La documentacion es coherente con el codigo real.

## Riesgos y decisiones

- Si se cambia algun nombre de variable, actualizar el codigo y la documentacion en el mismo cambio.
- No confiar solo en defaults hardcodeados si eso vuelve opaco el despliegue.

## Validacion sugerida

- Correr el frontend con variables del `.env.example`
- Verificar login y carga de datos
- Revisar que alguien sin contexto pueda seguir el README del frontend
