# Polaris Hotel — Deploy no EasyPanel

Arquitetura: **um serviço MariaDB + um serviço app (imagem all-in-one)**. O app
contém o emulador Java (jar built do source), o cliente Octane (built do source),
o nginx e o pacote completo de assets. Tudo roda no navegador pelo domínio do painel.

## 1. MariaDB (serviço separado)

EasyPanel → Projeto `server` → **+ Service → MariaDB**

- Name: `escritorio-habbo-db`
- Image: `mariadb:11`
- Database: `polaris`
- Username: `polaris`
- Password: gerada no painel

## 2. App (all-in-one)

**+ Service → App** com:

- Name: `escritorio-habbo`
- Source: GitHub → `AndrewIBRI/Polaris-Emulator`, branch `main`
- Build: `dockerfile` → `Dockerfile`
- Deploy → Port: `8080`
- Domains: `server-escritorio-habbo.00behz.easypanel.host` (https)
- Volumes: volume nomeado montado em `/data` (config gerada, imager output, backups)
- Environment:

| Var | Valor |
|---|---|
| `APP_DOMAIN` | `server-escritorio-habbo.00behz.easypanel.host` |
| `APP_SCHEME` | `https` |
| `DB_HOST` | `escritorio-habbo-db` |
| `DB_PORT` | `3306` |
| `DB_NAME` | `polaris` |
| `DB_USER` | `polaris` |
| `DB_PASSWORD` | a mesma do serviço MariaDB |
| `JAVA_XMX` | `3072m` |

> ⚠️ Não setar `DB_HOSTNAME` — o Polaris ignora o config.ini inteiro se essa env
> existir. O config.ini é gerado pelo entrypoint a partir das envs acima.

## 3. O que o container serve

| Rota | Origem |
|---|---|
| `/` | cliente Octane (dist/ built do source) |
| `/configuration/` | configs geradas no boot (socket/api/assets com o domínio real) |
| `/assets/` | pack de assets (furni, clothes, pets, c_images, gamedata, icons, sons) |
| `/imager/` | output do imager (badges de grupo, câmera) — volume `/data` |
| `/ws` | WebSocket do jogo (proxy → 2096 interno) |
| `/api/` | HTTP API do emulador (login, registro, badges) (proxy → 2096) |

## 4. Ordem de deploy

1. Criar o MariaDB primeiro (o app conecta nele no boot).
2. Criar o app → EasyPanel faz o build Docker (client + jar + assets, ~15-20 min na 1ª vez).
3. O emulador cria o schema no banco automaticamente no 1º boot (222 migrations Flyway).
4. Abrir o domínio do painel → tela de login do Octane → criar conta em `/api/auth/register`.

## 5. Deploy local / teste

```bash
docker build -t polaris-hotel .
docker run -d --name polaris-db -e MARIADB_ROOT_PASSWORD=... mariadb:11
docker run -d --name polaris-hotel -p 8080:8080 \
  -e APP_DOMAIN=localhost -e APP_SCHEME=http \
  -e DB_HOST=polaris-db -e DB_PASSWORD=... \
  --link polaris-db polaris-hotel
```

## 6. Modificar o código

- **Emulador (Java)**: `Emulator/src/main/java/polaris/` — protocolo em
  `messages/incoming|outgoing`, migrations em `src/main/resources/db/migration`.
- **Cliente (React/TS)**: `Octane/src/` + `Octane-Renderer/packages/` — o build
  Docker recompila tudo a cada deploy.
- **Assets**: `assets/` (furni/clothes/pets → `assets/bundled/`, JSONs de gamedata
  → `assets/gamedata/`, imagens de UI → `assets/c_images/`).
