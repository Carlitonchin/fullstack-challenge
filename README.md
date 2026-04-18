# Fullstack Challenge
## Carlos Alejandro Arrieta Montes de Oca

O foco deste documento é detalhar a implementação, quais invariantes foram protegidos, como os fluxos críticos foram modelados e quais trade-offs foram aceitos para manter o sistema coerente.

## Resumo

O projeto está organizado em dois serviços NestJS (`games` e `wallets`), um frontend React + Vite, RabbitMQ para comunicação assíncrona, PostgreSQL para persistência, Kong como entrada HTTP e Keycloak para autenticação OIDC. Isso por si só não diferencia a solução. O que diferencia é a modelagem interna:

- a carteira foi implementada em modo ledger-first, com replay ordenado por sequência e proteção de saldo negativo no domínio e no banco
- as apostas não nascem como aceitas; elas passam por um estado `PENDING` até o contexto monetário confirmar o débito
- a rodada nasce em `WAITING_FOR_FIRST_BET` e só vira pública de fato quando chega o primeiro débito confirmado
- o provably fair foi tratado como estratégia versionada e persistida, não como cálculo solto em controller
- o frontend não inventa estado do jogo; ele reconcilia snapshot autoritativo do servidor com eventos incrementais e uma curva pública para interpolação visual
- o outbox foi extraído para pacote compartilhado e opera com semântica explícita para `PENDING`, `PROCESSING`, `PUBLISHED`, `FAILED` e `UNROUTABLE`

## O Que Está Entregue

- autenticação via Keycloak com authorization code flow + PKCE no frontend
- validação de JWT nos dois serviços backend
- criação e consulta de carteira do usuário autenticado
- bootstrap automático de carteira de demonstração com saldo inicial de `BRL 100,00`
- criação, aceitação assíncrona, rejeição, cashout, perda e liquidação de apostas
- round engine com criação automática de rodadas, fechamento de janela, início, crash e settlement
- comunicação assíncrona entre `games` e `wallets` via RabbitMQ
- outbox persistido nos dois serviços
- histórico de rodadas e histórico do jogador
- painel de transparência com commitment, fórmula, passos de verificação e prova da rodada anterior
- atualização em tempo real por Socket.IO
- Swagger nos dois backends
- suíte unitária para domínio, query layer, timing, outbox e contrato de mensageria
- suíte end-to-end via Docker para o fluxo sistêmico do backend

Stack adotada:

- Runtime: Bun
- Backend: NestJS + TypeScript + MikroORM
- Frontend: React 19 + Vite + TanStack Query + Socket.IO client
- Banco: PostgreSQL
- Broker: RabbitMQ
- Gateway: Kong declarativo
- Identidade: Keycloak

## Decisões Centrais Desta Implementação

### 1. Carteira modelada como ledger, não como saldo mutável

O serviço `wallets` não trata o saldo como campo persistido e atualizado diretamente. O aggregate `Wallet` é reidratado a partir da lista ordenada de operações persistidas em `wallet_operations`, cada uma com `ledger_sequence`, `operation_id`, `amount_cents` e `operation_type`.

Essa escolha melhora três pontos ao mesmo tempo:

- o histórico monetário deixa de ser apêndice e vira fonte primária do estado
- idempotência fica acoplada ao lugar certo, por meio de `operation_id`
- replay e auditoria ficam triviais, porque o saldo é derivado do fluxo real de créditos e débitos

A proteção contra saldo negativo não ficou só no domínio. Ela foi reforçada no banco por uma trigger `prevent_negative_wallet_balance()` que trava a wallet em `FOR UPDATE`, soma o ledger corrente e rejeita qualquer insert que levaria o saldo abaixo de zero.

### 2. Aposta com estado intermediário explícito

Uma aposta não nasce em `ACCEPTED`. Ela nasce em `PENDING`.

Isso é importante porque o request HTTP não representa débito concluído; representa intenção de apostar. O fluxo econômico só se completa quando `wallets` consome `bet.debit.requested` e devolve `bet.debit.succeeded` ou `bet.debit.failed`.

Esse estado intermediário evita duas distorções clássicas:

- `games` assumir saldo que não controla
- o backend “mentir” para o cliente dizendo que a aposta já entrou na rodada antes da confirmação monetária

Os estados atuais de `Bet` são:

- `PENDING`
- `ACCEPTED`
- `CASHED_OUT`
- `LOST`
- `SETTLED`
- `REJECTED`

### 3. Rodada ancorada no primeiro débito confirmado

A modelagem de `Round` não abre a rodada imediatamente. Ela nasce em `WAITING_FOR_FIRST_BET`.

Somente quando chega o primeiro `bet.debit.succeeded` o aggregate executa `openBettingFromFirstAcceptedBet`, calcula o schedule real e publica a rodada como aberta. Isso produz um comportamento menos “arcade”, porém mais honesto com o fluxo distribuído: a rodada efetiva só passa a existir publicamente quando há pelo menos uma aposta economicamente válida.

Os estados atuais de `Round` são:

- `WAITING_FOR_FIRST_BET`
- `BETTING_OPEN`
- `BETTING_CLOSED`
- `IN_PROGRESS`
- `CRASHED`
- `ERROR`
- `SETTLED`

### 4. Timing da rodada definido por estratégia e curva pública

O comportamento temporal da rodada foi extraído para `LogarithmicRoundTimingStrategy`.

Decisões relevantes aqui:

- janela de aposta: `10s`
- delay entre fechamento e início: `5s`
- reveal após o crash: `2s`
- duração do voo derivada do `crashPoint` por escala logarítmica
- duração clampada entre `250ms` e `20s`

Além disso, o backend publica uma `curve` pública com `baseMultiplier`, `growthRate`, `precisionDigits`, `kind` e `version`. O frontend usa exatamente essa curva para interpolar o multiplicador em tela sem inventar uma física paralela à do servidor.

#### O papel do `RoundEngineWorker`

O `RoundEngineWorker` é a peça que transforma esse timing abstrato em transições reais e persistidas. Em outras palavras: a estratégia define o schedule, mas é o worker que reconcilia o relógio atual com o estado da rodada e decide quando efetivamente fechar apostas, iniciar o voo, registrar o crash, liquidar perdas e abrir caminho para a próxima rodada.

Internamente, o worker segue um ciclo bem definido:

- inicia automaticamente no bootstrap do módulo
- mantém um único timer em memória por instância
- ao acordar, executa `reconcile(now)` dentro de uma transação
- tenta adquirir um `pg_try_advisory_xact_lock` para impedir que duas instâncias avancem a mesma rodada ao mesmo tempo
- carrega a rodada atual e executa um loop de reconciliação com múltiplos passos, permitindo “alcançar” o schedule se mais de uma transição já venceu
- persiste mudanças de `Round` e `Bet` junto com seus eventos de outbox no mesmo contexto transacional
- só depois do commit publica snapshot, histórico e notificações privadas relevantes

O ponto mais importante aqui é que o worker não é um cron cego nem um loop que “empurra estado” para frente sem olhar consistência. Cada transição continua passando pelos métodos do aggregate `Round`, com checagem de invariantes, e cada mutação relevante gera eventos persistidos antes de qualquer publicação em tempo real.

### 5. Provably fair tratado como domínio versionado

O provably fair foi implementado via strategy pattern, com definição persistida em banco. A estratégia atual é `casino-crash-v1`.

Ela publica:

- `serverSeedHash` antes da rodada
- `nonce`
- nome e descrição da estratégia
- algoritmo de hash e de outcome
- regra de instant bust
- fórmula de verificação
- passos textuais de verificação

Depois da rodada, o `serverSeed` é revelado e a API permite recomputar o `crashPoint`. Essa definição não fica enterrada em controller nem em utilitário anônimo. Ela existe como conceito de domínio e pode evoluir por versionamento.

### 6. Outbox compartilhado e contratos explícitos de money flow

O projeto extraiu a infraestrutura de mensageria para `packages/messaging`. Esse pacote concentra:

- contratos de eventos
- envelope padronizado com `correlationId`, `causationId` e `idempotencyKey`
- repositório de outbox PostgreSQL
- dispatcher com claim em lote, lock timeout e backoff
- publisher AMQP

O ganho aqui não é “ter um pacote compartilhado”. O ganho é evitar divergência de envelope, status de outbox e semântica de retry entre os serviços.

### 7. Concorrência protegida no domínio e no banco

O projeto não depende só de botão desabilitado no frontend.

Ele combina:

- versionamento otimista em aggregates (`version`)
- `update ... where version = ?` em `RoundRepository` e `BetRepository`
- índice único parcial para uma única aposta ativa por jogador e rodada
- índice único parcial para uma única rodada ativa
- `operation_id` único para deduplicação financeira
- replay ordenado por `ledger_sequence`
- advisory lock no `RoundEngineWorker` para evitar dupla execução do scheduler

Esse conjunto é o que torna o fluxo defensável em cenário de redelivery, requisição duplicada ou disputa de atualização.

### 8. Tempo real público e privado separados

O WebSocket não virou um canal genérico de mutação. Ele ficou restrito à projeção do estado.

Há duas linhas de publicação:

- broadcast público de `game.snapshot`, `bet.updated` e `history.updated`
- notificações privadas por player room, como `wallet.balance-updated` e `player.bet.updated`

O detalhe importante é que saldo do jogador não é “rebuscado” a cada evento. `games` consome eventos de wallet, projeta a atualização privada e a entrega somente ao room do jogador autenticado.

### 9. Frontend orientado a snapshot autoritativo

O frontend foi implementado com React + Vite, TanStack Query e Socket.IO.

As decisões mais relevantes nessa camada foram:

- usar o snapshot do servidor como verdade autoritativa
- reconciliar eventos incrementais sobre esse snapshot, e não manter uma máquina de estados paralela
- interpolar multiplicador apenas quando a rodada está em `IN_PROGRESS`
- reutilizar a `curve` publicada pelo backend para manter a animação consistente com o schedule real
- usar refresh de token e reautenticação automática também nas tentativas de reconexão do WebSocket

## Fluxos Críticos

### Criação de carteira

1. O usuário autentica via Keycloak.
2. O frontend chama `POST /wallets`.
3. `wallets` cria a wallet com saldo zero no aggregate.
4. A mesma operação aplica um `ACCOUNT_FUNDING` inicial de `10_000` centavos.
5. O serviço persiste a wallet, persiste a operação e emite eventos no outbox.

### Aposta

1. O frontend envia `POST /games/bet`.
2. `games` valida o valor, identifica o usuário pelo JWT e localiza a rodada ativa.
3. O aggregate `Bet` nasce em `PENDING`.
4. `games` persiste a bet e grava `bet.debit.requested` no outbox com `idempotencyKey`.
5. `wallets` consome a mensagem, verifica duplicidade por `operation_id` e tenta registrar `BET_STAKE_LOCK`.
6. Em sucesso, publica `bet.debit.succeeded`.
7. `games` aceita a bet e, se for a primeira confirmação da rodada, abre a janela pública de apostas.
8. Em falha, `games` rejeita a bet com motivo explícito.

### Cashout

1. O frontend envia `POST /games/bet/cashout`.
2. `games` calcula o multiplicador com base no timing oficial da rodada.
3. A bet vai para `CASHED_OUT` e `games` grava `cashout.credit.requested`.
4. `wallets` registra `BET_PAYOUT` usando o `operation_id` determinístico do cashout.
5. Quando chega `cashout.credit.succeeded`, `games` liquida a bet em `SETTLED`.

### Falhas operacionais

Os caminhos de falha foram explicitados no modelo:

- se o débito falha, a bet vai para `REJECTED`
- se o débito chega tarde, `games` rejeita a bet e emite `bet.refund.requested`
- se refund falha, a rodada entra em `ERROR`
- se payout falha, a rodada entra em `ERROR`

O estado `ERROR` não esconde inconsistência. Ele torna a anomalia visível e impede o sistema de continuar como se nada tivesse acontecido.

## Invariantes Reforçados em Código e Banco

| Regra | Como foi protegida |
| --- | --- |
| Um jogador só pode ter uma wallet | `wallets_player_id_unique` |
| Uma operação monetária não pode ser aplicada duas vezes | `wallet_operations_operation_id_unique` + `hasOperation()` |
| O ledger precisa ser ordenável e íntegro | `ledger_sequence` identity + `unique` + `check (ledger_sequence > 0)` |
| Nenhuma operação pode ter valor zero | `check (amount_cents <> 0)` |
| O saldo nunca pode ficar negativo | `WalletBalance.subtract()` + trigger `prevent_negative_wallet_balance()` |
| Só pode haver uma rodada ativa | índice parcial `rounds_single_active_round_unique` |
| Só pode haver uma aposta ativa por jogador na rodada | índice parcial `bets_round_id_player_id_active_unique` |
| Atualizações concorrentes não podem sobrescrever estado silenciosamente | optimistic locking por `version` em `Round` e `Bet` |
| Mensagens do outbox não podem conflitar por idempotência | `event_type + idempotency_key` único no outbox |

## Provably Fair e Transparência

A verificação foi desenhada para ser consumível por jogador e por reviewer técnico.

Dados publicados antes da revelação:

- `serverSeedHash`
- `nonce`
- definição da estratégia
- fórmula
- passos de verificação

Dados revelados depois do término:

- `serverSeed`
- `crashPoint`
- `crashMultiplier`

A API também inclui `previousRoundProof` no snapshot corrente. Isso foi uma boa decisão de produto porque transforma a transparência em parte da UX do jogo, e não apenas em endpoint histórico raramente acessado.

## Tempo Real e Sincronização do Cliente

O modelo de tempo real foi desenhado com separação clara entre comando e projeção:

- comandos continuam em REST
- WebSocket só envia atualizações do servidor para o cliente
- o handshake do socket exige token válido
- o cliente entra em rooms privados por `playerId`
- o estado público da rodada é entregue por `game.snapshot`

Na prática, isso deixa o frontend livre para ser visualmente fluido sem assumir papel autoritativo. Ele pode interpolar o multiplicador e desenhar o gráfico, mas continua preso ao schedule, ao estado e aos timestamps emitidos pelo backend.

## Segurança e Identidade

Os dois serviços usam guardas JWT do Keycloak. O `playerId` e o `preferred_username` vêm do token; não são aceitos do corpo da requisição.

No frontend, o fluxo de autenticação cobre:

- redirecionamento para o Keycloak
- troca do authorization code por tokens
- persistência da sessão local
- tentativa automática de refresh em `401`
- atualização do token antes da reconexão do Socket.IO

## Operação Local

Pré-requisitos:

- Bun 1.x
- Docker + Docker Compose

Subir a stack:

```bash
bun install
bun run docker:up
```

Serviços:

- Frontend: `http://localhost:3000`
- Kong: `http://localhost:8000`
- Games: `http://localhost:4001`
- Wallets: `http://localhost:4002`
- Keycloak: `http://localhost:8080`
- RabbitMQ UI: `http://localhost:15672`

Swagger:

- Games: `http://localhost:4001/docs`
- Wallets: `http://localhost:4002/docs`

Credenciais locais:

- Admin Keycloak: `admin / admin`
- Realm: `crash-game`
- Client ID: `crash-game-client`
- Usuário de demonstração: `player / player123`

Encerrar:

```bash
bun run docker:down
```

Limpeza completa:

```bash
bun run docker:prune
```

## Variáveis de Ambiente

O compose já sobe a stack com defaults suficientes para desenvolvimento local. O principal contrato de ambiente mutável está no frontend:

- `VITE_API_BASE_URL`
- `VITE_KEYCLOAK_BASE_URL`
- `VITE_KEYCLOAK_REALM`
- `VITE_KEYCLOAK_CLIENT_ID`
- `VITE_KEYCLOAK_REDIRECT_URI`

Arquivo base:

- `frontend/.env.example`

## Validação

Comandos usuais:

```bash
cd services/games && bun test tests/unit
cd services/wallets && bun test tests/unit
cd packages/messaging && bun test tests/unit
cd frontend && bun run build
bun run test:e2e
```

Cobertura mais relevante hoje:

- lifecycle de `Round`
- lifecycle de `Bet`
- lifecycle de `Wallet`
- timing e curva pública de rodada
- provably fair
- mapeamento de eventos para outbox
- contrato compartilhado de mensageria
- fluxo sistêmico Docker-backed do backend

## Trade-offs e Backlog Técnico

- o scheduler de rodada roda dentro de `games`; para a escala atual isso simplifica operação, mas um processo dedicado pode fazer sentido se a plataforma crescer
- `ERROR` é um bom estado de contenção, porém ainda não existe uma trilha administrativa completa para reconciliação manual
