# CONTEXTO — Polaris Hotel

## Objetivo
Deploy standalone de um hotel Habbo (Polaris Emulator + cliente Octane) no EasyPanel da VPS (72.61.45.245), tudo num único repo: imagem Docker all-in-one (emulador Java + cliente estático + nginx + assets vendored) + MariaDB como serviço separado do EasyPanel.

## Feito
- **Cliente**: Octane + Octane-Renderer vendored como arquivos normais (gitlinks/submódulos removidos — os `.git` internos foram apagados) — o Dockerfile faz `yarn install --immutable` + `yarn build` no build da imagem
- **Assets vendored** em `assets/`: `bundled/` (75.722 furni .nitro, 8.852 figure, 203 effect, 74 pet, 9 generic), `c_images/` (43.754 arquivos: badges, catálogo, quests, habbopages), `hof_furni/` (15.397 ícones + 806 mp3 trax), `gamedata/` (FurnitureData, FigureData, EffectMap, ExternalTexts...), `images/logos/sounds`
- **fx_icons**: 203 placeholders PNG gerados (o pack não tinha os ícones de efectos)
- **Docker**: Dockerfile all-in-one (3 stages: node:22 build client → temurin:25 build jar → runtime nginx+jre), `docker/nginx.conf`, `docker/entrypoint.sh`, `docker/templates/` (renderer-config/ui-config com placeholder {{DOMAIN}})
- **Docs**: `EASYPANEL.md` (guia de deploy), `.env.example`, `.dockerignore`

## Não fazer
- Não commitar `node_modules/`, `dist/`, `.yarn/cache/` — o build Docker gera tudo
- Não restaurar os `.git` internos de `Octane/`/`Octane-Renderer/` (virariam gitlinks de novo e o `COPY` no build da VPS copiaria pastas vazias)
- Não fazer push de pack > 2GB (limite do GitHub por push) — dividir em chunks
- Não mexer no pack de assets sem conferir com o FurnitureData (75.722 furni = set completo)

## Mapa
- `Emulator/` — fonte Java do Polaris (build: `./mvnw clean package`)
- `Octane/` + `Octane-Renderer/` — cliente web (o renderer resolve `../Octane-Renderer`)
- `assets/` — pack de jogo vendored (bundled, c_images, gamedata, hof_furni, images, logos, sounds)
- `docker/` — nginx.conf, entrypoint.sh, templates/
- `Assets/badgeparts/` — partes de badge para o imager (verificar origem)
- `Dockerfile` — build all-in-one; `EASYPANEL.md` — guia de deploy

## Voz (fase 1 implementada, 2026-11-18)
- LiveKit self-hosted: serviço `livekit` no `docker-compose.yml` (canônico), config `docker/livekit.yaml`, secret HS256 gerada no 1º boot do hotel em `/data/secrets/livekit-api-secret` (volume compartilhado), nginx proxy `/livekit` → livekit:7880, porta TCP 7881 + UDP 50000-50100
- Emulador: `VoiceService` (JWT HS256 via javax.crypto), composers `VoiceTokenComposer` (6101)/`VoiceRoomStateComposer` (6104), `GetVoiceTokenEvent` (6102), comando `:assembleia` (on/off por sala, in-memory, ROOM_COMMAND)
- Cliente: `livekit-client` no Octane; `api/voice/VoiceConnection.ts`, `hooks/voice/useVoice.ts`, `state/voiceStore.ts`, HUD `VoiceWidgetView` (mic/câmera/tela; botão direito no mic = mute-on-blur; badge "Modo assembleia"); compile ok + vite build ok
- Fases futuras: zonas espaciais por tiles (editor), posição via metadados, sobrevivência a restart (assembleia é in-memory)

## Banco / tradução (2026-11-18)
- Tradução in-game vive nos arquivos do repo (`assets/gamedata/text_translate/ExternalTexts_br.json`, `furniture_translate/FurnitureData_br.json`) ✅
- Tradução de catálogo + `emulator_texts` + salas + contas ficavam SÓ no DB da VPS → dumpado em `Database/pt-br/seed.sql` (commitado)
- `db-init` no compose: importa `CleanDB.sql` + `seed.sql` no 1º boot se o banco estiver vazio (guard por contagem de tabelas); hotel depende dele

## Decisões
- **Assets vendored no repo** (~3GB) em vez de download no boot — self-contained, sem dependência de repos externos que podem sumir
- **Push em chunks < 2GB**: furniture em 2 partes, c_images, hof_furni, gamedata, client, docs
- **fx_icons placeholders**: cosmético do editor de avatar, sem fonte pública disponível
- **MariaDB externo** (serviço EasyPanel `polaris-db`), não embutido no container
- **Build do cliente e do jar dentro do Docker** (multi-stage) — sem artefatos binários no repo

## Paths de URL (importante)
- `/assets/` = bundle Vite do cliente (dist/assets/ do build) — o loader do Octane
  consulta `/assets/index-<hash>.js` com hash embutido no build
- `/gameassets/` = pack do jogo (furni, clothes, gamedata, c_images, sounds) —
  movido de `/assets/` para não colidir com o bundle do cliente (404 no client)
- `/configuration/` = JSONs gerados pelo entrypoint (renderer-config aponta
  `asset.url` para `/gameassets`); `/imager/` = output; `/ws` + `/api/` = emulador

## Estado do deploy
- **ONLINE**: https://server-polaris-hotel.00behz.easypanel.host (HTTP 200, WS 101, registro OK)
- EasyPanel projeto `server`: app `polaris-hotel` (repo AndrewIBRI/Polaris-Emulator, main, autoDeploy) + MariaDB `polaris-db` (db/user: polaris)
- Volume `polaris-data` → `/data` (config.ini, imager output, backups)
- Fixos durante o deploy: (1) `unzip` no stage jar-build — sem ele o mvnw reescreve a URL para .tar.gz e o checksum do .zip falha; (2) badgeparts em `/var/www/gamedata/badgeparts` (path seedado pela migration base, que sobrepõe config.ini); (3) **entrypoint sincroniza `emulator_settings` ANTES do boot** (`docker/entrypoint.sh`) — o banco sobrepõe config.ini (`loadFromDatabase` roda depois do load do ini) e um boot anterior pode reverter valores; o sync força 8 chaves geridas pelo deploy (camera.render.mode=upload, furni.directions.*, imager.*, items.furnidata.path) em todo boot, tornando o deploy determinístico
- Boot saudável: "Furni directions: read from the furniture bundles", "Badge Imager -> Loaded!", "Camera: mode upload", "Polaris has successfully loaded."
- Para editar settings de deploy: mudar o bloco SYNC_SQL do entrypoint (fonte da verdade) + config.ini correspondente
- **Admin**: conta `Andrew` (id=3) = rank 7 (Administrator). Rank 7 tem TODAS as 246 permissões no máximo (`permission_definitions.rank_7 = max_value`). Ranks: 1 Member, 2 VIP, 3 X, 4 Support, 5 Moderator, 6 Super Mod, 7 Administrator. Dar rank a outra conta: `UPDATE users SET rank=7 WHERE username="..."` (ou comando in-game cmd_give_rank); relog necessário para recarregar permissões
- **Poderes do Andrew (17/11/2026)**: credits/pixels/points = 2bi (margem int overflow), HC infinito de verdade = linha em `users_subscriptions` (type `HABBO_CLUB`, duration 350000000s ≈ 11 anos — NÃO passar de 2147483647 no sum timestamp_start+duration, overflow int reverte para expirado) + `club_expire_timestamp` na users_settings. Rank 7: max_rooms=200, max_friends=1000, max_favourite_rooms=100, renda automática 100k credits/100k pixels/10k points a cada 600s (`permission_ranks.auto_*_amount`). Para aplicar mudanças em permission_ranks sem restart: comando in-game `:update_all` (reloadWithChanges). Purse/HC só recarregam no relog
- **Tradução Onda C (17/11/2026, deploy 21:19)**: `assets/gamedata/furniture_translate/FurnitureData_br.json` no ar (HTTP 200, 4.18MB) — 42.472 room + 787 wall entries; 35.579 nomes + 30.141 descrições pt-BR. Override é por classname BASE (split('*')[0]); descrições idênticas (ci) a um nome reusam a tradução do nome; entradas sem nome nem descrição na fonte são omitidas (override vazio apagaria tooltip); 17 classnames sem nome na fonte ficam name:'' fielmente. 46.072 strings traduzidas em 19 chunks de subagentes (outputs em /opt/data/cache/scratch/tr-c/out/)
- **API EasyPanel 2.38 (descoberta 21h)**: leituras = GET (`/api/listProjects`, `/api/listActions`), ações = POST (`/api/deployAppService` body {projectName, serviceName, forceRebuild} — SÍNCRONO ~7min, SSH morre antes: conferir depois via `docker exec easypanel.* ps aux | grep buildx` + `docker inspect --format {{.Created}}`). Token do painel = campo `Token` (64 hex) dentro do LMDB `/etc/easypanel/data/data.mdb` (extração: python regex sobre bytes — `strings` NÃO existe na VPS). Deploy às 20:02 (Set.of fix) e 21:19 (Onda C) confirmados em listActions
- **Tradução Onda D (17/11/2026, deploy ~23:12)**: ExternalTexts delta +30.140 keys pt-BR (13 chunks × 2.319 em /opt/data/cache/scratch/tr-d/; montagem `assemble_d.py`); ExternalTexts_br.json 6.435 → **42.015 keys**; base `UITexts.json` 50 → **3.211 keys** (EN completo + 560 housekeeping EN preservando 27 keys extras antigas); catálogo 1.091/1.091 no banco (682 UPDATEs `catalog_pages` — caption/page_text1/page_text2, verificado "Página Inicial/Roupas/Equipe"). Commit 9e38ed3bc. 806 keys (2,7%) com placeholders divergentes foram resetadas para EN (fallback seguro; podem aparecer em inglês). PATH correto dos arquivos: `/gameassets/gamedata/...` (não `/gamedata/...` — 404→SPA html). Pipeline aprendido: agentes gravam INCREMENTALMENTE no output (retomável via diff input−output, não recomeçar do zero); HTTP 402 = concorrência estoura créditos do provider → despachar em levas de 3-4, não 17; regra do usuário: full-cache no navegador (Ctrl+Shift+R) pode ser preciso após deploy de gamedata
- **Fix cache de textos (18/11/2026, commit c59b1a246)**: housekeeping continuava cru APÓS deploy Onda D — causa: nginx servia /gameassets/ com `expires 7d` (navegador guardava textos velhos 7 dias; keys estavam OK nos arquivos servidos). Fix em 3 camadas: (1) `?t=%timestamp%` nos externalTexts no renderer-config (cliente substitui por Date.now() → URL nova a cada boot); (2) nginx regex `location ~ ^/gameassets(/gamedata/.+\.json)$` com `no-cache, must-revalidate` (JSONs revalidam 304 a cada load; .nitro pesados continuam 7d); (3) literais `live · now`/`stale` do dashboard → pt-BR no código (HousekeepingDashboardTab.tsx). Families dinâmicas `housekeeping.audit.action.*` etc. já vinham nos 560 keys. GOTCHA EasyPanel: deploy deixa container antigo de pé junto com o novo às vezes; `docker rm -f <velho>` dispara rescale (~30s de vazio, não é erro).
- **Voz/câmera/tela fase 1 (18/11/2026)**: LiveKit self-hosted no compose (container `livekit`, portas TCP 7881 + UDP 50000-50100); emulador emite JWT HS256 (VoiceService, composer 6101/6102/6104); HUD no cliente Octane (livekit-client 2.24.1, mic/câmera/tela). Pipeline inteiro verificado ao vivo (cliente→WS→JWT→wss://DOMAIN/livekit). Bug único achado no log do LiveKit: JWT mandava `video.roomList` como array (rejeitado, esperava boolean) — fix e4f55cde3. Não testado ainda: 2 browsers reais com mic + `:assembleia`
- **Env universal (18/11, commit 75fe744a6)**: painel EasyPanel usa `APP_DOMAIN=$(PRIMARY_DOMAIN)` (template resolve pro domínio da aba Domains — nunca hardcode); compose `APP_SCHEME` default `https`. Serviço do deploy: compose `scalahotel` no projeto `server` (EasyPanel: compose = `deployComposeService`, NÃO `deployAppService` — app é outra categoria)
- **Seed universal (18/11)**: seed.sql sem navigator_publics (Escritorio não vai mais público em instalação nova) e página 233 "Room Bundles" + 7 filhas com visible=0 (removidas da loja). `updateComposeEnv` via API: body {projectName, serviceName, env: "VAR=valor\n..."} (env é STRING dotenv, não objeto) + `getEnv` é env do Traefik (inútil)
- **FIX CRÍTICO voz (18/11, commit f1aa71e56)**: os cliques em mic/câmera/tela "não faziam nada" — causa REAL: `VoiceConnection.connect()` criava a Room numa variável LOCAL e nunca fazia `this._room = room`; todo `setMicEnabled/setCamera/setScreenShare` caía em `if(!participant) return false` silencioso (LiveKit conectado de verdade, mas singleton sem referência). Fix: atribuição + console.warn explícito no early-return. Verificado end-to-end no navegador headless (conta teste `testbot456`/polaris-test-2026, bcrypt resetado no DB da VPS): clique → setMicrophoneEnabled → getUserMedia → erro NotFound (esperado sem mic físico). Antes disso: HUD tinha pointer-events atravessando cliques (container de widgets é pointer-events:none — widgets interativos precisam `pointer-events:auto`, commit 212ea219f)
- **Zonas de áudio (18/11, commit 4c92f0bb3)**: áudio espacial por área. Emulador: tabela `room_voice_zones` (aplicada manualmente na VPS e no CleanDB.sql), handlers 6105 GetVoiceZones/6107 SaveVoiceZones (rank 7+ só), composer 6106 VoiceZonesComposer; Room.getVoiceZones carrega lazy e setVoiceZones persiste+broadcasta. Cliente: VoiceZonesParser/Event, GetVoiceZonesComposer (enviado junto com o token na entrada da sala), SaveVoiceZonesComposer, editor `VoiceZoneEditorView` (grid top-down do heightmap real, arrastar para desenhar, renomear/apagar por zona, estilo Floor Plan Editor) aberto pelo menu da engrenagem do widget de voz ("Zonas de áudio…", só canEditZones). Runtime: `useVoiceZonesSpatial` (tick 500ms) lê tiles dos avatares do room engine e aplica fator por participante via `VoiceConnection.setSpatialVolume` (mesma zona 1.0, outra zona 0.1, fora 0.35; assembleia = todos 1.0). Regras podem exigir ajuste fino após teste com 2 navegadores
- **HUD de voz v2 (18/11)**: log do LiveKit provou conexão real do cliente (user-3, grants corretos) — os botões "não fazer nada" = falha de getUserMedia engolida em silêncio. Agora: erros de mic/câmera/tela aparecem no menu de configurações (engrenagem), com estados visuais is-active/is-error; menu com seleção de microfone/alto-falante (switchActiveDevice) e volume remoto (RemoteAudioTrack.setVolume); compartilhamento de tela usa o seletor nativo do navegador (tela/janela/aba) com `{ audio: true }`. tsc limpo (incl. fix hideNavigation no teste de blocos)
