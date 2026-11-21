# Polaris Hotel — all-in-one image (game server + Octane client + nginx + assets)
#
#   Build:  docker build -t polaris-hotel .
#   Run:    docker run -d -p 8080:8080 -e APP_DOMAIN=hotel.example.com polaris-hotel
#
#   Everything is served from the container itself — no CDN, no external repos:
#     /opt/dist          Octane client (built from source, stage 1)
#     /opt/polaris.jar   Polaris emulator (built from source, stage 2)
#     /opt/assets        full game asset pack (furni, clothes, pets, c_images, gamedata, icons, sounds)
#     /opt/badgeparts    group badge parts (imager)
#     /opt/templates     runtime config templates ({{DOMAIN}} placeholders)
#     /data              writable runtime volume (config.ini, generated configs, imager output, backups)

# ---------- Stage 1: build the Octane client ----------
FROM node:22-bookworm AS client-build

WORKDIR /build

# Octane-Renderer must sit next to Octane (tsconfig paths resolve ../Octane-Renderer)
COPY Octane-Renderer/ /build/Octane-Renderer/
COPY Octane/ /build/Octane/

RUN cd /build/Octane-Renderer && corepack enable && yarn install --immutable
RUN cd /build/Octane && corepack enable && yarn install --immutable \
    && OCTANE_JSON_MODE=jsonc yarn build

# ---------- Stage 2: build the Polaris emulator ----------
FROM eclipse-temurin:25-jdk-noble AS jar-build

WORKDIR /build/Emulator
COPY Emulator/ /build/Emulator/

# unzip is required by the maven wrapper: without it the wrapper rewrites the
# distributionUrl to .tar.gz and the distributionSha256Sum validation fails
RUN apt-get update && apt-get install -y --no-install-recommends unzip && rm -rf /var/lib/apt/lists/*

ENV MAVEN_OPTS="-Xmx1536m"
RUN ./mvnw -B -q clean package -DskipTests -Dspotless.check.skip=true

# ---------- Stage 3: runtime ----------
FROM eclipse-temurin:25-jre-noble AS runtime

# nginx (static + proxy) and mariadb-dump (fail-closed backup before migrations)
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx mariadb-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=client-build /build/Octane/dist/ /opt/dist/
COPY --from=jar-build /build/Emulator/target/*-jar-with-dependencies.jar /opt/polaris.jar

COPY assets/ /opt/assets/
# badgeparts on both paths: the DB settings table seeds imager.location.badgeparts
# as /var/www/gamedata/badgeparts (migration base_database), which overrides config.ini
COPY Assets/badgeparts/ /opt/badgeparts/
COPY Assets/badgeparts/ /var/www/gamedata/badgeparts/
COPY Assets/badgeparts/ /opt/assets/gamedata/badgeparts/
COPY docker/templates/ /opt/templates/

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /data

# /data holds everything the runtime writes: config.ini, generated client configs,
# imager output (badges/camera/thumbnails), DB backups, logs.
VOLUME /data

EXPOSE 8080

ENV PORT=8080 \
    APP_DOMAIN=localhost \
    DB_HOST=polaris-db \
    DB_PORT=3306 \
    DB_NAME=polaris \
    DB_USER=polaris \
    JAVA_XMX=3072m

ENTRYPOINT ["/entrypoint.sh"]
