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
