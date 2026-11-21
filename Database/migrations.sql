-- Migrations incrementais: roda em todo boot (idempotente), antes do "skip".
-- Isso mantém bancos já existentes em dia sem reimportar o schema.
CREATE TABLE IF NOT EXISTS `room_voice_zones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `room_id` int(11) NOT NULL,
  `name` varchar(64) NOT NULL DEFAULT 'Zona',
  `x` int(11) NOT NULL DEFAULT 0,
  `y` int(11) NOT NULL DEFAULT 0,
  `width` int(11) NOT NULL DEFAULT 1,
  `height` int(11) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `room_id` (`room_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

CREATE TABLE IF NOT EXISTS `room_voice_zone_settings` (
  `room_id` int(11) NOT NULL,
  `same_factor` int(11) NOT NULL DEFAULT 100,
  `other_factor` int(11) NOT NULL DEFAULT 10,
  `outside_factor` int(11) NOT NULL DEFAULT 35,
  `video_global` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`room_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- Bancos criados antes do video_global: adiciona a coluna (idempotente).
ALTER TABLE `room_voice_zone_settings`
  ADD COLUMN IF NOT EXISTS `video_global` tinyint(1) NOT NULL DEFAULT 0;

-- Escritorio virtual: desliga o kick automatico por inatividade
-- (hotel.rooms.auto.idle=1 no banco default expulsa nao-donos em ~4min parados;
-- ciclo roda 2x/seg: kick em IDLE_CYCLES_KICK=480 ciclos = 4 min).
-- Salas podem reativar por conta propria (idle_autokick_enabled / idle_sleep_enabled).
UPDATE `emulator_settings` SET `value` = '0' WHERE `key` = 'hotel.rooms.auto.idle';
