# Refatoração para TypeScript — Documento de Contexto e Arquitetura

> Status: **planejamento** (não implementado). Este documento descreve o estado atual,
> a arquitetura-alvo e o plano de migração. Serve de referência para a implementação futura.

---

## 1. Objetivo

1. Migrar toda a API de JavaScript (CommonJS + JSDoc) para **TypeScript**.
2. Adotar padrões de design mais avançados e uma arquitetura **escalável** que facilite
   adicionar novos módulos/funcionalidades no futuro.
3. **Absorver os 3 módulos na API core.** Acabar com os subsistemas em portas separadas.
   Shorten, Financial e Finder passam a fazer parte do **mesmo servidor** da core, num
   **único processo e uma única porta**, separados apenas por **prefixo de endpoint**:
   `/shorten/...`, `/financial/...`, `/finder/...`. Não existe mais `bootstrapServers()`
   nem `SHORTEN_PORT`/`FINANCIAL_PORT`/`PRODUCT_FINDER_PORT`.
4. **Sem impacto em funcionalidade.** Nada de comportamento muda. Parte dos módulos já
   compartilha o **mesmo banco de dados** — a consolidação num único app é natural, só
   remove a duplicação de infra (Express/CORS/parsers) que existia por porta.
5. **Minimizar impacto nos consumidores.** Como as portas dedicadas deixam de existir, os
   consumidores precisam repontar `host:porta` para a porta da core (inevitável ao remover
   as portas). Para que **só a porta mude e não os caminhos**, os paths são preservados via
   aliases durante a transição (seção 5).

---

## 2. Estado atual (baseline)

### 2.1 Topologia de execução

`src/index.js` sobe o servidor principal na `API_PORT` e, dentro do `listen`, chama
`bootstrapServers()` (`src/config/servers.js`), que **sobe 3 servidores Express extras**,
cada um em sua própria porta:

| Módulo         | Porta (env)            | Auth                          | Paths (raiz, sem prefixo)        |
|----------------|------------------------|-------------------------------|----------------------------------|
| Core / principal | `API_PORT`           | `sessionOrJwt` (jose JWT)     | `/check/auth`, articles, storage/files |
| *(alvo)* Core    | porta única          | `sessionOrJwt`                | **só** `/check/auth` — resto vira módulo `storage` |
| Shorten        | `SHORTEN_PORT`         | `sessionOrJwt`                | `/shorten`, `/:code`, `/user/urls` |
| Financial      | `FINANCIAL_PORT`       | `sessionOrJwt` + feature flags | `/months`, `/months/:k/budgets` … |
| Finder         | `PRODUCT_FINDER_PORT`  | `apiKeyValidator` (API key)   | `/establishments`, `/products/...` |

> **Ponto crítico:** hoje cada módulo usa **paths de raiz** na sua própria porta.
> Ex.: o finder responde `GET /establishments` na `PRODUCT_FINDER_PORT`. Ao consolidar
> numa única porta sob `/finder/establishments`, o caminho muda para o consumidor.
> A estratégia de compatibilidade (seção 5) precisa cobrir isso.

### 2.2 Inventário de endpoints (atual)

**Core (API_PORT)**
- `GET /check/auth`
- Articles: `POST /article/create`, `GET /list/articles/:tagId`, `GET /list-all/articles`,
  `GET /list-all/tags`, `PUT /article/update/:id`, `DELETE /article/delete/:id`,
  `DELETE /tag/delete/:id`
- Storage: `POST /storage/upload/:folderId`, `DELETE /storage/delete/:id/folder/:folderId`,
  `POST /storage/delete/bulk`, `POST /storage/folders/create`,
  `DELETE /storage/folders/delete/:id`, `GET /proxy`, `GET /storage/folders`,
  `GET /storage/files`

**Shorten (SHORTEN_PORT)**
- `POST /shorten`, `GET /:code` (redirect), `GET /user/urls`, `DELETE /user/url/:code`

**Financial (FINANCIAL_PORT)** — todas com `requireFeature(...)` + `checkRateLimit(...)`
- Months, Budgets, Investments, Goals, Subscriptions (CRUD sob `/months/...`)
- Reorder de categorias/bills, `/health`, `/check/auth`, `/features`, `/identity`

**Finder (PRODUCT_FINDER_PORT)** — todas com `apiKeyValidator`
- Establishments CRUD, Products CRUD, `GET /products/categories`, `GET /geocode/reverse`
- Já possui rotas legadas com prefixo `/finder/...` (compat interna existente)

### 2.3 Componentes transversais atuais
- **Auth** (`src/middleware/authentication.js`): classe `AuthService`, valida JWT via `jose`
  (JWKS remoto), popula `req.user`/`req.auth`. Métodos: `sessionOrJwt`, `loggedOrNot`,
  `check`, `hasPermissions(perms)`.
- **Feature flags** (`src/middleware/featureFlags.js` + `src/config/featureFlags.js`):
  `requireFeature`, `checkRateLimit` (usa Redis), `loadUserFeatures`, `getRateLimitStatus`.
- **Database** (`src/database/index.js`): `DatabaseInstance`, Sequelize + MySQL,
  auto-load de models em `src/database/models/*.js`, associações via `options.associate`.
- **Services**: `logs.service`, `rateLimit.service`, `request.service`, `aws/s3`.
- **Realtime**: `socket.io` acoplado no servidor principal (`app.set('io', io)`).

### 2.4 Dores do modelo atual
- 4 apps Express duplicando setup (cors, bodyParser, cookieParser, logs) em `servers.js`.
- Módulos em portas distintas → mais superfície de deploy/infra, CORS repetido.
- JS + JSDoc → sem segurança de tipos real, refactors arriscados.
- Models carregados por `fs.readdirSync` sem tipagem forte.
- `resetSync`/`synchronize` com `alter:true`/`force:true` perigosos (ver seção 7).

---

## 3. Arquitetura-alvo

### 3.1 Princípios
- **Único processo, única porta, um app.** Os 3 módulos são montados como partes da core,
  não como servidores independentes. `bootstrapServers()` e as portas por módulo somem.
- **Banco compartilhado.** Todos os módulos usam a mesma instância Sequelize (`AppDeps.db`).
  Nada de conexão por módulo; a consolidação não muda queries nem models.
- **Modular por feature (feature-based / vertical slices).** Cada módulo é autocontido:
  rotas, controller, service, DTO, tipos. Adicionar módulo = adicionar uma pasta + registrar.
- **Camadas dentro do módulo:** `route → controller → service → repository/model`.
  Controller fino (HTTP), regra de negócio no service, acesso a dados no repository.
- **Injeção de dependência leve** (container simples ou composição manual) para desacoplar
  service de infra (db, redis, s3) e facilitar testes.
- **Tipos compartilhados** em `src/shared` (contratos, erros, tipos de `req` aumentado).

### 3.2 Estrutura de pastas proposta

```
src/
  main.ts                     # bootstrap: cria app, monta módulos, sobe UMA porta
  app.ts                      # createApp(): middlewares globais + module registry
  config/
    env.ts                    # validação de env (zod) tipada
    database.ts               # conexão Sequelize tipada
    redis.ts
    cors.ts
  core/
    http/
      httpError.ts            # classe de erro HTTP + catálogo
      errorHandler.ts         # middleware central de erro
      asyncHandler.ts         # wrapper p/ controllers async
    server/
      moduleRegistry.ts       # registra módulos por prefixo
    types/
      express.d.ts            # augment de Request (user, auth, features...)
  shared/
    middleware/
      auth.middleware.ts      # sessionOrJwt, loggedOrNot, hasPermissions
      featureFlags.middleware.ts
      apiKey.middleware.ts
      logs.middleware.ts
    services/
      logger.service.ts
      s3.service.ts
    dtos/                     # DTO base / helpers de serialização
  database/
    index.ts
    models/                   # models Sequelize tipados
    enums/
  modules/
    shorten/
      shorten.module.ts       # define prefixo '/shorten' + registra rotas
      shorten.routes.ts
      shorten.controller.ts
      shorten.service.ts
      shorten.dto.ts
      shorten.types.ts
    financial/
      financial.module.ts     # prefixo '/financial'
      ... (routes/controller/service/dto por sub-recurso: months, budgets, goals...)
    finder/
      finder.module.ts        # prefixo '/finder'
      ...
    storage/                  # prefixo '/storage' — ABSORVE articles + storage/files
      storage.module.ts
      articles/               # articles.routes/controller/service/dto
      files/                  # upload, folders, proxy (ex-storage.controller)
  index.ts (compat)           # opcional durante transição
```

> **Core não é módulo de negócio.** A pasta `core/` guarda só infra (http, server,
> registry, tipos). A **única responsabilidade de domínio da core** é a **checagem de
> autenticação** (`GET /check/auth`, já existente via `AuthService.check`). Todo o resto
> — articles, storage/files, shorten, financial, finder — é **módulo próprio**.

### 3.3 Padrão de módulo (contrato)

Cada módulo exporta um descritor:

```ts
export interface AppModule {
  prefix: string;                 // ex.: '/financial'
  register(router: Router, deps: AppDeps): void;
  legacyPrefixes?: string[];      // ex.: [''] para compat na raiz (ver seção 5)
}
```

`moduleRegistry` monta cada módulo em `app.use(prefix, router)` e, se `legacyPrefixes`
existir, também monta os aliases para não quebrar consumidores.

### 3.4 Padrões de design aplicados
- **Repository pattern** — isola Sequelize dos services (troca de ORM/testes mais fáceis).
- **Service layer** — regra de negócio pura, sem `req`/`res`.
- **DTO + serialização** — entrada validada (zod), saída serializada (já iniciado em
  `financial/dtos/month.dto.js`).
- **Middleware factory** — `requireFeature`, `checkRateLimit`, `hasPermissions` mantidos
  como fábricas tipadas.
- **Result/Error central** — `HttpError` + `errorHandler`, controllers sem try/catch repetido
  (via `asyncHandler`).
- **Dependency container** — `AppDeps { db, redis, s3, logger, config }` injetado nos módulos.

---

## 4. Mapa de endpoints alvo (com prefixos)

| Atual (porta + path)                    | Alvo (porta única + prefixo)          |
|-----------------------------------------|---------------------------------------|
| `SHORTEN_PORT` `POST /shorten`          | `POST /shorten/shorten` *(ver nota)*  |
| `SHORTEN_PORT` `GET /:code`             | `GET /shorten/:code`                  |
| `SHORTEN_PORT` `GET /user/urls`         | `GET /shorten/user/urls`              |
| `FINANCIAL_PORT` `/months...`           | `/financial/months...`                |
| `FINANCIAL_PORT` `/health` `/features`  | `/financial/health` `/financial/features` |
| `PRODUCT_FINDER_PORT` `/establishments` | `/finder/establishments`              |
| `PRODUCT_FINDER_PORT` `/products/...`   | `/finder/products/...`                |
| `API_PORT` `/article/...` `/list-all/...` | `/storage/article/...` *(módulo storage)* |
| `API_PORT` `/storage/...` `/proxy`      | `/storage/...` *(já casa com o prefixo)* |
| `API_PORT` `/check/auth`                | **core** — permanece na raiz          |

> **Módulo `storage`.** Articles + storage/files deixam a core e viram um módulo próprio
> sob prefixo `/storage`. As rotas de articles (`/article/...`, `/list/articles/:tagId`,
> `/list-all/...`) e de storage (`/storage/upload`, `/storage/folders`, `/proxy`) passam a
> ser canônicas sob `/storage/...`, mantendo os paths atuais como aliases legados na raiz
> (seção 5). A core fica só com `GET /check/auth`.

> **Nota shorten:** o endpoint de criação hoje é `POST /shorten`. Com o prefixo vira
> `POST /shorten/shorten`. Decidir na implementação se o novo nome canônico é
> `POST /shorten` (o prefixo já denota criação) ou `POST /shorten/urls`. Registrar a
> escolha aqui antes de codar. O redirect `GET /:code` **precisa** de cuidado especial:
> mover para `/shorten/:code` evita colisão com o catch-all da raiz.

---

## 5. Estratégia de compatibilidade (sem impacto)

Decisão: **tudo passa a rodar na porta da core, sem portas por módulo.** Como as portas
dedicadas deixam de existir, todo consumidor precisa repontar `host:porta` para a core.
Isso é inevitável ao remover as portas — não há como manter uma porta que não existe mais.

O que **pode** ser garantido: que só a porta mude, **não os caminhos**. Cada módulo é
montado no app único em **dois pontos** durante a transição:
- **Prefixo novo (canônico):** `/shorten/...`, `/financial/...`, `/finder/...`.
- **Alias legado (mesmo path de antes):** via `legacyPrefixes` no descritor do módulo, os
  paths originais respondem na porta da core exatamente como respondiam na porta dedicada.

Assim, um consumidor do finder que fazia `GET http://host:PRODUCT_FINDER_PORT/establishments`
passa a fazer `GET http://host:API_PORT/establishments` (alias) — só a porta mudou — e migra
para `GET http://host:API_PORT/finder/establishments` quando puder.

**Risco de colisão na raiz.** Montar aliases legados na raiz do app único pode colidir entre
módulos e com a core. Casos a resolver:
- **Shorten `GET /:code` (catch-all):** não pode ficar na raiz do app único (engole qualquer
  path). O alias legado dele deve ser registrado **por último** e/ou restrito por padrão de
  código (ex.: regex no param). Preferir já migrar o redirect para `/shorten/:code`.
- **`/check/auth`, `/health`, `/features`:** existem em mais de um módulo/core — na raiz
  precisam de dono único. Definir que a versão raiz pertence à core; as demais só sob prefixo.

**Deprecation.** Cada rota-alias legada emite header/log `Deprecation` para medir tráfego
residual. Remover aliases após confirmar uso zero (passo 8 do plano).

---

## 6. Stack e tooling da migração

- **TypeScript** já é dependência. Adicionar `tsconfig.json` (`strict: true`, paths).
- **Build/run:** `tsx`/`ts-node-dev` em dev; `tsc` (ou `tsup`/`esbuild`) para build.
  Atualizar scripts `dev`/`start`/`build` (hoje usam `node src/index.js`).
- **Validação de env:** `zod` em `config/env.ts` (falha rápida se faltar var).
- **Validação de entrada:** `zod` nos DTOs.
- **Sequelize + TS:** usar `sequelize` com `InferAttributes`/`InferCreationAttributes`
  ou `sequelize-typescript` (decidir; manter `sequelize` puro reduz mudança).
- **Lint:** migrar ESLint para `@typescript-eslint`.
- **Testes:** já há mocha; avaliar manter mocha ou migrar p/ vitest (afinidade TS).

---

## 7. Riscos e pontos de atenção

- **`database/index.js` usa `sync({ alter: true })` e `resetSync` com `force: true`.**
  Migração é oportunidade de trocar por **migrations** (umzug/sequelize-cli) e remover
  `force:true` de produção. `PRE_SYNC_DATABASE=true` é setado em `index.js` — revisar.
- **socket.io** está acoplado ao app principal — manter no `main.ts`, expor via DI.
- **`checkRateLimit`** faz monkey-patch de `res.json/res.send` — reescrever como
  middleware de pós-resposta (`res.on('finish')`) mais seguro em TS.
- **CORS** hoje duplicado em `index.js` e `servers.js` — centralizar em `config/cors.ts`.
- **Redirect catch-all `GET /:code`** do shorten é a maior fonte de colisão de rotas.
- **Auth divergente por módulo:** finder usa API key, demais usam JWT. Manter separado.

---

## 8. Plano de migração (incremental, sem big-bang)

1. **Infra TS:** `tsconfig`, scripts, ESLint TS, `config/env.ts` tipado. App ainda JS-interop.
2. **Core compartilhado:** `httpError`, `errorHandler`, `asyncHandler`, `express.d.ts`,
   DI `AppDeps`, `moduleRegistry`.
3. **Database em TS:** conexão + 1 model piloto tipado; resto incremental.
4. **Migrar 1 módulo piloto** (sugestão: **shorten**, menor) para o novo padrão, montado
   por prefixo `/shorten`, com compat.
5. **Financial** e **Finder** para o padrão modular + prefixos.
6. **Core (articles/storage/auth-check)** para TS mantendo paths de raiz.
7. **Consolidar no app único:** remover `bootstrapServers()` e as envs de porta por módulo;
   montar os 3 módulos por prefixo + aliases legados de path (seção 5) na porta da core.
8. **Remover aliases legados** após confirmar tráfego zero (via header/log de deprecation).
9. **Trocar `sync/alter/force` por migrations.**

Cada passo deve manter a suíte de testes verde e a API antiga respondendo.

---

## 9. Decisões pendentes (preencher antes de implementar)

- [ ] Nome canônico do `POST /shorten` sob prefixo (`/shorten` vs `/shorten/urls`).
- [ ] Ordem de registro dos aliases legados p/ evitar colisão (shorten `/:code` por último).
- [ ] Dono único dos paths raiz compartilhados (`/check/auth`, `/health`, `/features`).
- [ ] `sequelize` puro tipado vs `sequelize-typescript`.
- [ ] Manter mocha ou migrar para vitest.
- [ ] Prazo/critério de depreciação das portas antigas.
- [ ] Adotar migrations agora ou em fase posterior.
```
