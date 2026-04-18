# Task 12 - Frontend containerization and Docker Compose integration

## Contexto

El repositorio ya tiene frontend real, pero la infraestructura todavia lo trata como placeholder.

Evidencia observada:

- `docker-compose.yml` tiene el bloque `frontend` comentado.
- No existe `frontend/Dockerfile`.
- El `README` afirma que `bun run docker:up` debe levantar todo, incluyendo frontend.
- Hoy esa promesa no se cumple de forma literal.

## Objetivo

Integrar el frontend al flujo oficial de Docker para que `bun run docker:up` levante la aplicacion web sin pasos manuales y quede accesible en `http://localhost:3000`.

## Alcance

Incluido:

- Crear `frontend/Dockerfile`.
- Definir el runtime correcto para servir la aplicacion.
- Conectar el frontend al gateway por variables de entorno o defaults coherentes.
- Descomentar o agregar el servicio `frontend` en `docker-compose.yml`.
- Asegurar dependencias correctas con `kong`.

No incluido:

- Cambios grandes de arquitectura del frontend.
- Despliegue cloud.

## Dependencias

- Recomendado completar antes la Task 11.
- Debe completarse antes de la Task 18.
- Afecta la documentacion de Tasks 15 y 16.

## Archivos a revisar primero

- `docker-compose.yml`
- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/src/lib/api/client.ts`
- `frontend/src/lib/auth.ts`
- `docker/kong/kong.yml`

## Decisiones que hay que tomar

1. Como servir el frontend en Docker.
   - Opcion A: build estatico y servir con un servidor HTTP liviano.
   - Opcion B: usar `vite preview`.
   - Opcion recomendada: imagen reproducible de produccion, no modo dev.

2. Como inyectar configuracion.
   - `VITE_API_BASE_URL`
   - `VITE_KEYCLOAK_BASE_URL`
   - `VITE_KEYCLOAK_REALM`
   - `VITE_KEYCLOAK_CLIENT_ID`
   - `VITE_KEYCLOAK_REDIRECT_URI`

3. Como garantizar que el callback de Keycloak siga funcionando cuando la app corre en `localhost:3000`.

## Pasos detallados

1. Diseñar el `frontend/Dockerfile`.
   - Elegir build multi-stage.
   - Instalar dependencias del workspace de forma compatible con Bun.
   - Ejecutar el build de frontend dentro de la imagen.
   - Servir el artefacto generado en el puerto esperado.

2. Definir el contrato de variables de entorno del frontend.
   - Revisar defaults actuales en:
     - `frontend/src/lib/api/client.ts`
     - `frontend/src/lib/auth.ts`
   - Decidir si los defaults alcanzan para Docker o si conviene explicitar variables en Compose.

3. Agregar el servicio `frontend` en `docker-compose.yml`.
   - Publicar `3000:3000`.
   - Declarar `depends_on` al menos sobre `kong`.
   - Si el frontend necesita esperar al gateway, evaluar healthcheck o retry tolerante en cliente.

4. Verificar compatibilidad con OIDC.
   - Confirmar que el redirect URI usado por la UI coincide con el cliente de Keycloak.
   - Si hace falta ajustar el realm export, hacerlo de forma automatica, no manual.

5. Validar conectividad real.
   - Frontend -> Kong en `http://localhost:8000`
   - Frontend -> Keycloak en `http://localhost:8080`
   - WebSocket via path `/games/socket.io`

6. Documentar el comportamiento final.
   - El README principal debe explicar que `bun run docker:up` ya incluye la UI.
   - El README del frontend debe dejar de ser template.

## Criterios de aceptacion

- Existe `frontend/Dockerfile`.
- `docker-compose.yml` contiene un servicio `frontend` activo.
- `bun run docker:up` levanta frontend junto con infra y servicios backend.
- La UI queda disponible en `http://localhost:3000`.
- La UI puede autenticarse y hablar con el backend via Kong en el entorno Docker/local esperado.

## Riesgos y decisiones

- Si se usa `vite preview`, documentar el trade-off y validar que sea suficiente para la entrega.
- Si el flujo de Keycloak rompe por redirect URIs, ese ajuste es parte de esta tarea y no debe dejarse "manual".
- No introducir un flujo donde el frontend apunte directo a los microservicios si la entrada oficial debe ser Kong.

## Validacion sugerida

- `bun run docker:up`
- Abrir `http://localhost:3000`
- Login con Keycloak
- Verificar requests HTTP a `localhost:8000`
- Verificar conexion WebSocket al namespace/path esperado
