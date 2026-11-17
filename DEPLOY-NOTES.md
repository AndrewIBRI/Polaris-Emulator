# BLUEPRINT DEPLOY — Polaris-Emulator no EasyPanel (app único Docker)

> Repo: `https://github.com/AndrewIBRI/Polaris-Emulator` (fork público de `duckietm/Polaris-Emulator`, branch `main`)
> HEAD clonado: `9d9d7533c10a…` — **v4.2.133** (2026-11-13) · Tamanho do clone: **316 MB**
> Objetivo: hotel Habbo 100% standalone (sem CDN/repo externo em runtime), cliente no navegador, código modificável.
> **Correção importante ao briefing:** o repo **NÃO** tem Dockerfile na raiz, **NÃO** tem compose, e o cliente Octane **NÃO** está dentro deste repo — é um projeto separado (`duckietm/Octane` + `duckietm/Octane-Renderer`). O repo Polaris traz só o emulador Java + migrations (schema completo) + assets suplementares pequenos (`Assets/badgeparts`, `Assets/images`). O blueprint abaixo resolve tudo isso num único app EasyPanel.

---

## 0. Arquitetura recomendada (single app EasyPanel)

```text
Navegador ──HTTPS──> EasyPanel (Traefik, TLS) ──> container único (app Polaris)
                                                   ├── nginx :8080
                                                   │    ├── /            → dist/ do cliente Octane (estático)
                                                   │    ├── /gamedata/   → árvore de assets de jogo (estático)
                                                   │    ├── /ws e /api/* → proxy → 127.0.0.1:2096 (Polaris)
                                                   ├── java -jar Polaris.jar (WORKDIR /app/data)
                                                   │    ├── :2096 ws.port  → WebSocket + HTTP /api/* (o porta-cliente)
                                                   │    ├── :3000 game.port→ TCP cru legado (não usado pelo Octane)
                                                   │    └── :3001 rcon.port→ TCP localhost (administração)
                                                   └── mariadb-dump (cliente p/ backups de migração)
App MariaDB do EasyPanel (mariadb:11.4) <──TCP 3306── db.hostname=polaris-db
```

- O TLS termina no proxy do EasyPanel; dentro do container é HTTP/WS puro (não precisa de `ssl/cert.pem`).
- O Octane se conecta por **WebSocket** (`socket.url`) e às **APIs HTTP** (`/api/auth/*`) no mesmo listener 2096. Não há CMS obrigatório: o cliente Octane tem tela de registro própria (`/api/auth/register`).

---

## 1. BUILD do jar do emulador

Fonte da verdade: `.github/workflows/build-release.yml` e `.github/workflows/ci.yml`.

| Item | Valor |
|---|---|
| Wrapper Maven | **Sim** — `Emulator/mvnw` (não precisa instalar Maven) |
| JDK exigido | **JDK 25** (Temurin). CI usa `temurin` 25; `maven.compiler.release=25`, suporte até JDK 26 (`[25,27)`) |
| Comando exato | `cd Emulator && ./mvnw -B clean package` |
| Comando do release (CI) | `cd Emulator && ./mvnw -B clean verify` (inclui testes; timeout CI: 45 min) |
| Comando rápido p/ imagem | `cd Emulator && ./mvnw -B clean package -DskipTests` |
| Artefato de saída | `Emulator/target/Polaris-4.2.133-jar-with-dependencies.jar` (shade plugin, mainClass `polaris.Emulator`) — **~50 MB** |
| Versão do jar | vem do `pom.xml` (`<version>4.2.133</version>`); o CI do release bumpa patch a cada merge |
| Tempo estimado | 1ª build baixa deps (~200 MB Maven Central): **8–15 min**; builds seguintes: **2–5 min**; `clean verify` completo (testes): 20–45 min |
| Alternativa sem build | jar pré-compilado nas releases upstream: `https://github.com/duckietm/Polaris-Emulator/releases` → `Polaris-4.2.133-jar-with-dependencies.jar` (49,9 MB + `.sha256`) |

No Dockerfile multi-stage (item 7), o build do jar roda no stage `eclipse-temurin:25-jdk` com `./mvnw -B clean package -DskipTests`.

---

## 2. RUNTIME — `config.ini` completo

O jar resolve `config.ini` **relativo ao diretório de trabalho** (`ConfigurationManager("config.ini")`, `PolarisBootstrap`). Regra de ouro: `WORKDIR /app/data` e `config.ini` dentro do volume montado lá.

> **Gotcha crítico:** se a env `DB_HOSTNAME` estiver setada, o emulador **ignora o config.ini inteiramente** no bootstrap (modo env-only), e as chaves `ws.*`/`login.*` **não têm alias de env** → o listener WebSocket não sobe. **Use config.ini montado; não sete `DB_HOSTNAME`.**

`config.ini` mínimo obrigatório (todos os campos necessários; tudo o que não estiver aqui mantém default):

```ini
# ================== BANCO ==================
db.hostname=polaris-db            # nome do serviço MariaDB do EasyPanel
db.port=3306
db.database=polaris
db.username=polaris
db.password=TROQUE_POR_UMA_SENHA_FORTE
db.params=
# Cria/atualiza o schema automaticamente no primeiro boot (Flyway, 222 migrations)
db.migrate.on_startup=true
# Backup fail-closed ANTES de aplicar migrações pendentes (exige mariadb-dump!)
db.migrations.backup.enabled=true
db.migrations.backup.directory=backups/database   # relativo ao CWD → /app/data/backups/database
db.migrations.backup.keep=7
db.migrations.backup.timeout_seconds=900
db.migrations.backup.executable=mariadb-dump      # o container precisa do pacote mariadb-client
db.pool.minsize=25
db.pool.maxsize=100
db.pool.connection_timeout_ms=10000
db.pool.idle_timeout_ms=600000
db.pool.max_lifetime_ms=1800000
db.pool.validation_timeout_ms=10000
db.pool.leak_detection_ms=20000

# ================== GAME (TCP cru legado) ==================
game.host=0.0.0.0
game.port=3000

# ================== RCON (administração; só localhost) ==================
rcon.host=127.0.0.1
rcon.port=3001
rcon.allowed=127.0.0.1;::1

# ================== CMS HTTP API (opcional; desligado) ==================
cms.api.enabled=false
cms.api.allowed=127.0.0.1;::1

# ================== WEBSOCKET + HTTP API (O PORTA-CLIENTE) ==================
ws.enabled=true                   # default é false — SEM ISTO O CLIENTE NÃO CONECTA
ws.host=0.0.0.0
ws.port=2096
ws.whitelist=SEUDOMINIO.com       # Origin do browser (hostname, sem https://, sem www.); vírgula p/ vários
ws.ip.header=X-Forwarded-For      # IP real do jogador atrás do proxy nginx
ws.ip.header.trusted=127.0.0.1    # o nginx do MESMO container é o proxy confiável
ws.http.read_timeout_sec=30
ws.http.connections.per_ip=32

# ================== LOGIN / API do cliente ==================
login.remember.enabled=true
login.remember.duration.days=30
login.remember.cookie.name=octane_remember
login.remember.cookie.samesite=Strict   # cliente e API no MESMO domínio → Strict funciona
login.remember.cookie.secure=true       # ok: TLS termina no proxy do EasyPanel
login.sso.ticket.ttl.seconds=60
login.news.limit=5

# ================== NITRO SECURE (modo "plain" — desligado) ==================
nitro.secure.assets.enabled=false
nitro.secure.api.enabled=false
nitro.secure.api.required=false
nitro.secure.master_key=change-me-to-a-long-random-secret

# ================== PERFORMANCE ==================
runtime.operational.profile=custom
http.blocking.pool.size=8
db.slow_query.enabled=true
db.slow_query.threshold_ms=250
```

Outros arquivos/estados de config em runtime:

- **`emulator_settings` (tabela do banco)**: camada que **sobrepõe** config.ini após o boot (lida a cada reload). Chaves presentes no banco (ex.: `crypto.ws.enabled='0'`, `hotel.first_login.setup.enabled='1'`) vencem o arquivo. Mudanças de runtime (housekeeping) caem aqui.
- **`wired_emulator_settings`** (tabela): config de wireds.
- **`ssl/` (pasta ao lado do CWD)**: `ssl/cert.pem` + `ssl/privkey.pem` habilitam WSS nativo no 2096 — **desnecessário** atrás do proxy do EasyPanel.
- **`backups/database/`**: dumps do mariadb-dump gerados antes de cada migração (retém 7).
- **`logging/`**: logs de pacotes (se debug ligado).

---

## 3. CLIENTE — Octane (repo separado, precisa de build)

**Não está no repo Polaris.** É `duckietm/Octane` (React 19 + Vite 8 + TypeScript + Zustand/Tailwind) e `duckietm/Octane-Renderer` (PixiJS 8, desenha salas/avatares/móveis e fala o protocolo WebSocket) — o renderer é resolvido como **pasta irmã** (`../Octane-Renderer`) e é embutido no build do Octane. Não há releases binários no GitHub → **build obrigatório**.

### Como construir

```bash
git clone https://github.com/duckietm/Octane-Renderer.git
git clone https://github.com/duckietm/Octane.git
cd Octane
corepack enable                                     # Yarn 4 está pinado no package.json
yarn install                                        # (o renderer precisa de yarn install também)
cp public/configuration/renderer-config.example public/configuration/renderer-config.json
cp public/configuration/ui-config.example          public/configuration/ui-config.json
cp public/configuration/client-mode.example         public/configuration/client-mode.json
yarn build                                          # → dist/  (vite build + minify-dist.mjs)
```

- **Node >= 22.12** (`.nvmrc: 22`), Yarn 4 via corepack.
- Alternativa: `./install.sh` (roda `node install.mjs`) — clona o renderer, instala deps, copia os `.example`, pede as URLs, opcionalmente liga secure mode e patcheia o `config.ini`, e faz o build. Para CI: `node install.mjs --non-interactive --socket-url=... --api-url=... ...`.
- Saída: **`dist/`** — pasta estática pronta (index.html + JS/JSX + assets de UI).

### Como o cliente descobre o servidor

Por **arquivos de configuração estáticos** (não é query param, nem auto-detecção):

| Arquivo | Chaves que apontam para o servidor |
|---|---|
| `public/configuration/renderer-config.json` | `socket.url` (WebSocket do jogo, ex.: `wss://SEUDOMINIO.com/ws`), `api.url` (`https://SEUDOMINIO.com`), `asset.url` (`https://SEUDOMINIO.com/gamedata`), `image.library.url` (`…/gamedata/c_images/`), `hof.furni.url` (`https://SEUDOMINIO.com`), `furnidata.url`, `avatar.asset.url`, `furni.asset.url`, `pet.asset.url`, `badge.asset.url`, `sounds.url`… |
| `public/configuration/ui-config.json` | `camera.url`, `thumbnails.url`, `url.prefix`, `habbopages.url` |
| `public/configuration/client-mode.json` | `secureAssetsEnabled:false`, `secureApiEnabled:false`, `apiBaseUrl`, `plainConfigBaseUrl`, `plainGamedataBaseUrl` |

A conexão do jogo é **WebSocket puro** (upgrade no listener 2096, que aceita upgrade em **qualquer path** — `websocketPath("/")`, `checkStartsWith(true)`; subprotocol `WsSessionCrypto`). O mesmo listener 2096 serve o HTTP da API antes do upgrade (`/api/auth/*`, `/api/badges/*`, `/api/cms/*`, `/api/public/*`, `/api/health`, `/api/maintenance`, `/nitro-sec/*`).

Valores para o deploy EasyPanel (aplicar nos `.json` antes do `yarn build`):

```jsonc
// renderer-config.json (apenas as chaves relevantes)
"socket.url": "wss://SEUDOMINIO.com/ws",
"api.url": "https://SEUDOMINIO.com",
"asset.url": "https://SEUDOMINIO.com/gamedata",
"image.library.url": "https://SEUDOMINIO.com/gamedata/c_images/",
"hof.furni.url": "https://SEUDOMINIO.com",
"habbopages.url": "/gamedata/habbopages/"
// client-mode.json
"secureAssetsEnabled": false, "secureApiEnabled": false
```

---

## 4. ASSETS — o que existe no repo e o que falta

| Local | Conteúdo | Tamanho |
|---|---|---|
| `Assets/badgeparts/` | PNGs de peças de emblema (badgepart_*.png) — para `badge.asset.grouparts.url` | ~1 MB |
| `Assets/images/` | UI: reception, navigator, wallet, rules, events, furniextras, loading_icon, big_arrow… | ~4,4 MB |
| `Database/Default Database/CleanDB.sql` | dump legado de 5,5 MB (alternativa de import manual) | 5,5 MB |
| `Octane/public/` (repo do cliente) | favicon/PWA, `habbicons/`, `habbopages/`, `sounds/`, `text_translate/`, `configuration/*` | ~5 MB |

**O que NÃO está em nenhum dos dois repos** (necessário em runtime): os **assets de jogo** — `FurnitureData.json`, `FigureData/FigureMap/EffectMap/ProductData/HabboAvatarActions/ExternalTexts`, bundles de móveis/roupas/pets (`.hab` ou `.nitro`), `c_images/`, `hof_furni/` + ícones, sons. São ~2–5 GB se baixados do CDN oficial do Habbo.

Pipeline de obtenção (uma única vez, na fase de setup — depois é tudo local):

1. Ferramenta oficial do ecossistema: **Confurter** (`duckietm/all-in-1-converter`) — "download Habbo's official CDN assets: badges, clothes, effects, furnidata, furniture SWF, icons, MP3, productdata, quest images, reception art, texts, variables", converte SWF→Nitro/HAB e gera os SQL de `items_base`/`catalog_items`. **Atenção:** o link do README (`github.com/duckietm/all-in-1-converter`) retornou 404 na API em 2026-11-17 — verifique no Discord do projeto. Alternativas: `sphynxkitten/nitro-assets` (pack pronto) ou `billsonnn/nitro-converter` (gera `.nitro`).
2. Montar a árvore em `/app/data/gamedata/` conforme os paths do `renderer-config.json`:
   ```
   /app/data/gamedata/
   ├── config/         FurnitureData.json, ProductData.json, FigureData.json,
   │                   FigureMap.json, EffectMap.json, HabboAvatarActions.json,
   │                   ExternalTexts.json, UITexts.jsonc
   ├── furniture/      <classname>.hab  (ou .nitro — a extensão decide o loader)
   ├── clothes/        <libname>.hab
   ├── pets/           <libname>.hab
   ├── bundled/generic/, room/
   ├── c_images/       (inclui album1584/, badgeparts/ ← copie Assets/badgeparts aqui)
   ├── icons/          <classname>_icon.png  (icons/ do hof_furni)
   ├── sounds/         *.mp3
   ├── habbopages/     (do Octane/public/habbopages)
   └── habbicons/      (do Octane/public/habbicons)
   ```
3. Copiar `Assets/badgeparts` → `gamedata/c_images/badgeparts/` e `Assets/images` → `gamedata/c_images/` (para o loading/reception da UI).
4. Importar o catálogo: o **schema vem completo das migrations** (catálogo já populado — 96 INSERTs na base). Se você importar novos móveis via Confurter, aplique os SQL gerados e rode `:update_items` / `updatecatalog` (ou RCON `updateitems`).

**URLs externas em runtime: NENHUMA.** Os `.example` do Octane apontam para `localhost` como placeholder — todos os paths são relativos ao `asset.url`/`api.url` que apontam para o próprio domínio. Só há rede externa em *build* (Maven Central, npm/Yarn, git clone dos repos) e em *setup* (CDN do Habbo via Confurter). Nada é baixado depois que o container sobe.

---

## 5. PORTAS

| Porta | Serviço | Bind | Exposição no EasyPanel |
|---|---|---|---|
| **2096** (`ws.port`) | **WebSocket do jogo + HTTP /api/*** (auth, badges, cms, wired, health) | `0.0.0.0` | **NÃO exponha diretamente** — o nginx interno (8080) faz proxy; o público é o domínio do painel (HTTP/HTTPS) |
| 8080 | nginx (estático cliente + proxy p/ 2096) | `0.0.0.0` | **Porta HTTP do app no EasyPanel** (o proxy do painel termina o TLS) |
| 3000 (`game.port`) | TCP cru legado do jogo (protocolo frame antigo; Octane não usa) | `0.0.0.0` | Não expor |
| 3001 (`rcon.port`) | RCON JSON por TCP | `127.0.0.1` | Não expor |
| 3306 | MariaDB (app separado do EasyPanel) | `0.0.0.0` na rede interna do painel | Não expor à internet |

---

## 6. BANCO — MariaDB

| Item | Valor |
|---|---|
| Versão | CI valida contra **MariaDB 10.11, 11.4 e 12.3** → usar **`mariadb:11.4`** no serviço MariaDB do EasyPanel |
| Connector | MariaDB JDBC 3.5.11 + HikariCP 7.1.0 |
| Schema | **Auto-criado no primeiro boot** — Flyway, `Emulator/src/main/resources/db/migration/` (222 arquivos, base `V20260518000000__base_database.sql` ~30k linhas + `polaris_tables.sql` etc.). **Não precisa importar dump.** |
| Seed | Migrations semeiam: usuário `Systemaccount`, catálogo (96 INSERTs: catalog_pages, items_base, catalog_items, permissions…), `room_templates` (salas iniciais do registro), `emulator_api`, `emulator_settings`… |
| Migração incremental | `db.migrate.on_startup=true` aplica pendências a cada boot; backup fail-closed via `mariadb-dump` **antes** (por isso o container precisa do `mariadb-client`) |
| Comandos de manutenção | `java -jar Polaris.jar --migrations-only` / `--migrations=validate` / `--migrations=repair` (aplicar sem subir o hotel / relatório / realinhar histórico) |
| Import legado | `Database/Default Database/CleanDB.sql` é a alternativa manual; um DB Arcturus 3.5.5 existente é adotado e atualizado automaticamente |
| Criar no MariaDB | `CREATE DATABASE polaris CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'polaris'@'%' IDENTIFIED BY '…'; GRANT ALL ON polaris.* TO 'polaris'@'%';` (ou usar os envs do serviço MariaDB do EasyPanel) |

---

## 7. DOCKER — o que o repo tem e o que precisa ser criado

O repo **não tem Dockerfile, nem docker-compose, nem scripts/docker**. O que existe: `scripts/build-latest.sh`/`.ps1` (build local do jar) e `scripts/upstream-sync/` (sincronização com upstream). Blueprint abaixo cria o app único. Arquivos sugeridos (no servidor de build do EasyPanel, fora do repo):

**Dockerfile (multi-stage):**

```dockerfile
# ---- Stage 1: build do jar ----
FROM eclipse-temurin:25-jdk AS build-java
WORKDIR /src
RUN git clone --depth 1 https://github.com/AndrewIBRI/Polaris-Emulator.git .
WORKDIR /src/Emulator
RUN ./mvnw -B clean package -DskipTests

# ---- Stage 2: build do cliente Octane ----
FROM node:22 AS build-web
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /web
RUN git clone --depth 1 https://github.com/duckietm/Octane-Renderer.git \
 && git clone --depth 1 https://github.com/duckietm/Octane.git
WORKDIR /web/Octane
RUN yarn install \
 && cp public/configuration/renderer-config.example public/configuration/renderer-config.json \
 && cp public/configuration/ui-config.example public/configuration/ui-config.json \
 && cp public/configuration/client-mode.example public/configuration/client-mode.json \
 && node -e "const fs=require('fs');const d='SEUDOMINIO.com';\
let r=fs.readFileSync('public/configuration/renderer-config.json','utf8')\
.replace(/\"socket\.url\":\s*\"[^\"]*\"/,'\"socket.url\": \"wss://'+d+'/ws\"')\
.replace(/\"api\.url\":\s*\"[^\"]*\"/,'\"api.url\": \"https://'+d+'\"')\
.replace(/\"asset\.url\":\s*\"[^\"]*\"/,'\"asset.url\": \"https://'+d+'/gamedata\"')\
.replace(/\"image\.library\.url\":\s*\"[^\"]*\"/,'\"image.library.url\": \"https://'+d+'/gamedata/c_images/\"')\
.replace(/\"hof\.furni\.url\":\s*\"[^\"]*\"/,'\"hof.furni.url\": \"https://'+d+'\"');\
fs.writeFileSync('public/configuration/renderer-config.json',r);\
let u=fs.readFileSync('public/configuration/ui-config.json','utf8')\
.replace(/\"habbopages\.url\":\s*\"[^\"]*\"/,'\"habbopages.url\": \"/gamedata/habbopages/\"');\
fs.writeFileSync('public/configuration/ui-config.json',u);\
let c=fs.readFileSync('public/configuration/client-mode.json','utf8')\
.replace(/\"secureAssetsEnabled\":\s*true/,'\"secureAssetsEnabled\": false')\
.replace(/\"secureApiEnabled\":\s*true/,'\"secureApiEnabled\": false');\
fs.writeFileSync('public/configuration/client-mode.json',c);" \
 && yarn build

# ---- Stage 3: runtime ----
FROM eclipse-temurin:25-jre
RUN apt-get update && apt-get install -y --no-install-recommends nginx mariadb-client curl && rm -rf /var/lib/apt/lists/*
COPY --from=build-java /src/Emulator/target/Polaris-*-jar-with-dependencies.jar /app/Polaris.jar
COPY --from=build-web /web/Octane/dist /var/www/octane
COPY nginx.conf /etc/nginx/sites-available/default
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENV JAVA_OPTS="-Xms512m -Xmx2048m -Dfile.encoding=UTF8"
EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
```

**nginx.conf** (proxy interno):

```nginx
server {
  listen 8080;
  server_name _;
  root /var/www/octane;
  index index.html;

  location / { try_files $uri $uri/ /index.html; }

  location /gamedata/ {
    alias /app/data/gamedata/;
    add_header Access-Control-Allow-Origin *;
    add_header Cache-Control "public, max-age=3600";
  }

  location /ws {
    proxy_pass http://127.0.0.1:2096;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:2096;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

**entrypoint.sh:**

```bash
#!/bin/bash
set -e
mkdir -p /app/data/backups/database
[ -f /app/data/config.ini ] || { echo "ERRO: monte /app/data/config.ini primeiro"; exit 1; }
# Padroniza os assets: badgeparts e imagens do repo → c_images
[ -d /app/data/gamedata/c_images/badgeparts ] || mkdir -p /app/data/gamedata/c_images/badgeparts
cd /app/data
nginx
exec java $JAVA_OPTS -jar /app/Polaris.jar
```

**Montagem no EasyPanel (app único):**
- Build: Dockerfile acima (ou push num repo seu).
- **Volume** `polaris-data` → `/app/data` (contém `config.ini`, `gamedata/`, `backups/`, `ssl/` opcional).
- **Porta HTTP do app:** `8080` (o EasyPanel publica no domínio com TLS).
- **Env do app:** `JAVA_OPTS=-Xms512m -Xmx2048m` (não sete `DB_HOSTNAME`!).
- **Serviço MariaDB separado:** tipo MariaDB, imagem `mariadb:11.4`, volume próprio, nome interno `polaris-db` (usar `db.hostname=polaris-db`).
- Healthcheck: `curl -f http://127.0.0.1:2096/api/health`.

**Ordem de boot:** MariaDB sobe primeiro (o EasyPanel cria os containers; se o emulador subir antes do banco, o pool tenta reconectar — HikariCP + `db.migrate.on_startup` retentam, mas idealmente aguardar o banco saudável).

---

## 8. DEPENDÊNCIAS EXTERNAS (URLs buscadas em runtime)

**Nenhuma em runtime** — o pacote é autocontido depois do setup:

- Build-time: Maven Central (deps do jar), npm/Yarn registry (deps do Octane), GitHub (clone dos 3 repos).
- Setup-time (uma vez): CDN oficial do Habbo via Confurter (badges, clothes, furnidata, furniture SWF, icons, MP3, productdata, texts, variables) OU pack pronto (`sphynxkitten/nitro-assets`).
- O `renderer-config.example` tem todos os paths como placeholders `localhost` — nada aponta para CDN de terceiros.
- Discorção de atualização de assets futuros: o pipeline do repo (`docs/FURNI_IMPORT_PIPELINE.md`) assume a árvore `Nitro-Files` local; `scripts/verify-furni-import.sh` valida consistência DB↔assets.

---

## 9. MODIFICABILIDADE (onde ficam as features)

| Camada | Local | Notas |
|---|---|---|
| Servidor Java | `Emulator/src/main/java/polaris/` | `hotel/` (salas, móveis, catálogo, comandos, wireds, bots, jogos/snowwar), `messages/incoming|outgoing/` (protocolo por evento), `networking/gameserver/` (Netty: GameServer, WebSocket listener, handlers HTTP), `core/config/` (ConfigRegistry — todas as chaves e alias de env), `database/` (repositórios + Flyway), `plugin/` (API de plugins) |
| Protocolo | `Emulator/src/main/java/polaris/messages/` | `Incoming.java`/`Outgoing.java` registram os IDs; pacotes custom do Octane (ex.: `9496 FirstLoginSetupComposer`) também vivem aqui |
| Migrations | `Emulator/src/main/resources/db/migration/*.sql` | fonte da verdade do schema; adicionar novas = `V<timestamp>__<nome>.sql` |
| Plugins | `Emulator/plugins/` (gitignored) | jars de plugin compatíveis com Arcturus Morningstar 3.5.5 carregam sem mudança (bridge reescreve `com.eu.habbo` → `polaris.*`); guia: `docs/plugin-author-guide.md` |
| CLI/ferramentas | `polaris.tools.*` | ex.: `FurniConsistencyCli` (auditoria DB↔assets) |
| **Cliente Octane** | **repo separado** `duckietm/Octane` (`src/` React/TS) + `duckietm/Octane-Renderer` (`src/`, `packages/`, `protocol/`) | código-fonte completo, licença GPL-3.0; build Vite → `dist/`; modificável e re-buildável |
| Config de runtime | `config.ini` + tabelas `emulator_settings`/`wired_emulator_settings` | referência completa: `docs/configuration-reference.md` e `docs/emulator_settings_reference.md` |

---

## 10. RECURSOS (RAM/disco) do container

| Recurso | Mínimo | Recomendado |
|---|---|---|
| RAM do app | 2 GB (JVM `-Xmx1024m` + nginx) | **4 GB** (JVM `-Xmx2048m`…`-Xmx3072m`; o `Example_Start` usa `-Xmx4096m`; pool Hikari mínimo 25 conexões) |
| RAM do MariaDB | 512 MB | 1 GB |
| Disco do app | 4 GB (jar 50 MB + dist ~20 MB + assets essenciais) | **8–10 GB** (assets completos 2–5 GB + backups de migração + logs) |
| Disco do MariaDB | 2 GB | 4 GB (catálogo completo + rooms) |
| CPU | 2 vCPU | 4 vCPU (packet handlers = `max(16, 2×cores)`) |

---

## Checklist final de deploy (resumo operacional)

1. Serviço MariaDB `polaris-db` (mariadb:11.4) no EasyPanel; criar DB/user (ou usar os padrões).
2. Gerar os 3 arquivos (Dockerfile, nginx.conf, entrypoint.sh) com o domínio real no lugar de `SEUDOMINIO.com`.
3. Build do app (multi-stage: jar + cliente Octane).
4. Volume `/app/data` com: `config.ini` (item 2, com `ws.enabled=true`, `ws.whitelist=<domínio>`, creds do banco) e a árvore `gamedata/` (item 4).
5. Porta HTTP do app = 8080; dominio do painel com TLS.
6. Primeiro boot: Flyway cria/semeia o schema (log "Migration -> completed"); login no cliente; criar conta pelo registro do próprio Octane (`/api/auth/register`).
7. Manutenção: `--migrations-only`, `--migrations=validate`, `:update_items` via RCON/HTTP (rcon em 127.0.0.1:3001).

**Riscos conhecidos:** (a) esquecer `ws.enabled=true` → cliente não conecta; (b) esquecer `mariadb-client` no container → startup para no backup de migração (fail-closed); (c) setar `DB_HOSTNAME` → config.ini ignorado e `ws.*` sem efeito; (d) `ws.whitelist` sem o domínio → upgrade WebSocket rejeitado (403 "Origin forbidden"); (e) assets de jogo ausentes → cliente abre mas salas/móveis não renderizam; (f) o Confurter referenciado no README está com link quebrado (404) — obtê-lo via Discord do projeto ou usar pack alternativo.
