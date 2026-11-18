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
  PRIMARY KEY (`room_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
