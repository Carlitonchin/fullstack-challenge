# Frontend

Cliente React + Vite do crash game. Ele é responsável pelo fluxo de login OIDC, pelas chamadas REST autenticadas via Kong e pela tela do jogo em tempo real sincronizada por WebSocket.

## Responsabilidades

- Iniciar o fluxo OIDC authorization code com PKCE no Keycloak.
- Consumir as APIs públicas e autenticadas por meio do Kong.
- Abrir a conexão Socket.IO para receber eventos de atualização do servidor.
- Renderizar rodada ao vivo, carteira, apostas, histórico e dados de verificação.

As ações do jogador continuam em REST. O frontend não envia aposta nem cash out por WebSocket.

## Comandos

A partir de [`frontend/package.json`](/Users/carlos/Documents/projects/fullstack-challenge/frontend/package.json):

```bash
bun install
bun run dev
bun run build
```

- `bun run dev` inicia o servidor Vite em modo de desenvolvimento.
- `bun run build` executa `tsc -b && vite build`.

## Contrato de Ambiente

Crie um arquivo local de ambiente a partir de [`frontend/.env.example`](/Users/carlos/Documents/projects/fullstack-challenge/frontend/.env.example).

```bash
cp frontend/.env.example frontend/.env.local
```

Variáveis suportadas:

| Variável | Obrigatória | Default local | Default no build Docker | Finalidade |
| --- | --- | --- | --- | --- |
| `VITE_API_BASE_URL` | sim | `http://localhost:8000` | `http://localhost:8000` | URL base usada tanto no REST quanto no host do Socket.IO. |
| `VITE_KEYCLOAK_BASE_URL` | sim | `http://localhost:8080` | `http://localhost:8080` | URL base do servidor Keycloak. |
| `VITE_KEYCLOAK_REALM` | sim | `crash-game` | `crash-game` | Realm importado usado pela aplicação. |
| `VITE_KEYCLOAK_CLIENT_ID` | sim | `crash-game-client` | `crash-game-client` | Cliente OIDC público configurado com PKCE. |
| `VITE_KEYCLOAK_REDIRECT_URI` | sim | `http://localhost:5173/auth/callback` | `http://localhost:3000/auth/callback` | URL de callback do frontend registrada no Keycloak. |

Notas:

- Fora do Docker, o Vite roda em `http://localhost:5173` por padrão, então o redirect URI deve apontar para essa origem.
- Dentro do stack Docker, o bundle de produção é servido em `http://localhost:3000`, então o redirect URI deve usar essa origem.
- Esses valores são lidos em build time pelo Vite. Na imagem Docker, eles são embutidos via build args em [`frontend/Dockerfile`](/Users/carlos/Documents/projects/fullstack-challenge/frontend/Dockerfile).

## Contrato de Rede

O frontend deve conversar com a plataforma através do Kong, e não diretamente com os microserviços.

- URL base HTTP: `VITE_API_BASE_URL`, default `http://localhost:8000`
- Rotas REST usadas pela UI:
  - `/games/rounds/current`
  - `/games/rounds/history`
  - `/games/rounds/:roundId/verify`
  - `/games/bets/me`
  - `/games/bet`
  - `/games/bet/cashout`
  - `/wallets`
  - `/wallets/me`
- Endpoint WebSocket: `ws(s)://<VITE_API_BASE_URL>/games/socket.io`

O cliente usa `socket.io-client` com:

- host: `VITE_API_BASE_URL`
- path: `/games/socket.io`
- transporte: apenas websocket
- auth: bearer token enviado no handshake do Socket.IO

## Fluxo de Autenticação

A implementação de autenticação está em [`frontend/src/lib/auth.ts`](/Users/carlos/Documents/projects/fullstack-challenge/frontend/src/lib/auth.ts).

Resumo do fluxo:

1. A página de login redireciona o navegador para o Keycloak usando authorization code flow com PKCE.
2. O Keycloak retorna para `/auth/callback`.
3. O frontend troca o authorization code por tokens.
4. Os tokens são armazenados no `localStorage` do navegador.
5. Requisições REST autenticadas enviam `Authorization: Bearer <access token>`.
6. Se uma requisição retornar `401`, o frontend tenta um refresh uma vez e redireciona para login se o refresh falhar.
7. A conexão WebSocket também atualiza o token antes das tentativas de reconexão.

A identidade do usuário autenticado vem das claims do access token, não de input do formulário.

## Execução Fora do Docker

Use este modo quando quiser iterar rápido no frontend e manter backend e infraestrutura em containers.

1. Suba a infraestrutura e os serviços backend:

```bash
bun run docker:up
```

2. Em outro terminal, crie o arquivo local de ambiente mantendo o redirect URI na origem do Vite:

```bash
cp frontend/.env.example frontend/.env.local
```

3. Inicie o frontend:

```bash
cd frontend
bun install
bun run dev
```

4. Abra `http://localhost:5173`.

Para este modo funcionar, o cliente do Keycloak precisa aceitar `http://localhost:5173/auth/callback` como redirect URI válido.

## Execução no Stack Docker Completo

`bun run docker:up` também faz build e sobe o container do frontend definido em [`docker-compose.yml`](/Users/carlos/Documents/projects/fullstack-challenge/docker-compose.yml).

Nesse modo:

- a aplicação é servida em `http://localhost:3000`
- o Kong continua em `http://localhost:8000`
- o Keycloak continua em `http://localhost:8080`
- a imagem é construída com `VITE_KEYCLOAK_REDIRECT_URI=http://localhost:3000/auth/callback`

Se você alterar qualquer variável Vite usada no Docker, precisa reconstruir a imagem para incorporar os novos valores ao bundle.

## Troubleshooting

Redirect URI inválida:

- Verifique se `VITE_KEYCLOAK_REDIRECT_URI` corresponde à origem real do frontend.
- Verifique se a mesma callback URL está permitida na configuração do cliente no Keycloak.

Token expirado ou loop de redirecionamento para login:

- A aplicação tenta renovar os tokens automaticamente, mas uma falha no refresh limpa a sessão local.
- Limpe o armazenamento do navegador para a origem da app e inicie o login novamente.

Kong indisponível ou falha nas requisições da API:

- Confirme que `VITE_API_BASE_URL` aponta para o Kong, e não diretamente para `games` ou `wallets`.
- Verifique se o Kong está saudável em `http://localhost:8000`.

WebSocket desconectado:

- O cliente conecta em `/games/socket.io` usando a mesma base de API.
- Uma API base incorreta, token expirado ou rota indisponível no Kong interrompe a atualização em tempo real.
