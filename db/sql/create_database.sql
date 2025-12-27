SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;


CREATE TABLE `activator_log` (
                                 `id` int NOT NULL,
                                 `activatedby` char(11) NOT NULL,
                                 `callused` varchar(8) NOT NULL,
                                 `wotaid` mediumint(3) UNSIGNED ZEROFILL NOT NULL,
                                 `date` date NOT NULL,
                                 `time` time DEFAULT NULL COMMENT 'Optional Activation Time',
                                 `year` year NOT NULL,
                                 `stncall` varchar(12) NOT NULL,
                                 `ucall` varchar(8) NOT NULL,
                                 `rpt` tinyint(1) DEFAULT NULL,
                                 `s2s` tinyint(1) DEFAULT NULL,
                                 `confirmed` tinyint(1) DEFAULT NULL,
                                 `band` varchar(8) DEFAULT NULL COMMENT 'Optional Band',
                                 `frequency` float DEFAULT NULL COMMENT 'Optional Frequency',
                                 `mode` varchar(32) DEFAULT NULL COMMENT 'Optional Mode'
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE `activator_pts` (
                                 `activator` char(11) NOT NULL,
                                 `wotaid` mediumint(3) UNSIGNED ZEROFILL NOT NULL,
                                 `year` year NOT NULL,
                                 `raa` tinyint(1) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE `alerts` (
                          `id` int NOT NULL,
                          `wotaid` mediumint(3) UNSIGNED ZEROFILL NOT NULL,
                          `datetime` datetime NOT NULL,
                          `call` varchar(12) NOT NULL,
                          `freqmode` varchar(40) NOT NULL,
                          `comment` varchar(80) DEFAULT NULL,
                          `postedby` char(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE `awards` (
                          `award` int NOT NULL,
                          `name` varchar(64) NOT NULL,
                          `callsign` varchar(16) NOT NULL,
                          `date` date NOT NULL,
                          `first_worked` varchar(16) NOT NULL,
                          `certificate_id` varchar(12) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE `award_categories` (
                                    `id` int NOT NULL,
                                    `name` varchar(24) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE `award_types` (
                               `id` int NOT NULL,
                               `category` int NOT NULL,
                               `book` int DEFAULT NULL,
                               `year` int DEFAULT NULL,
                               `name` varchar(64) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE `chaser_log` (
                              `id` int NOT NULL,
                              `wkdby` char(11) NOT NULL,
                              `ucall` varchar(8) NOT NULL,
                              `wotaid` mediumint(3) UNSIGNED ZEROFILL NOT NULL,
                              `date` date NOT NULL,
                              `time` time DEFAULT NULL COMMENT 'Optional Chase Time',
                              `year` year NOT NULL,
                              `stncall` varchar(12) NOT NULL,
                              `rpt` tinyint(1) DEFAULT NULL,
                              `points` tinyint NOT NULL,
                              `wawpoints` tinyint NOT NULL,
                              `points_yr` tinyint NOT NULL,
                              `wawpoints_yr` tinyint NOT NULL,
                              `confirmed` tinyint(1) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE `links` (
                         `id` int NOT NULL,
                         `wotaid` mediumint(3) UNSIGNED ZEROFILL NOT NULL,
                         `description` varchar(80) NOT NULL,
                         `url` varchar(240) NOT NULL,
                         `posted_by` char(11) NOT NULL,
                         `posted_date` date NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE `spots` (
                         `id` int NOT NULL,
                         `datetime` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
                         `call` varchar(12) NOT NULL,
                         `wotaid` mediumint(3) UNSIGNED ZEROFILL NOT NULL,
                         `freqmode` varchar(20) NOT NULL,
                         `comment` varchar(80) NOT NULL,
                         `spotter` char(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE `summits` (
                           `wotaid` mediumint(6) UNSIGNED ZEROFILL NOT NULL,
                           `sotaid` mediumint(6) UNSIGNED ZEROFILL DEFAULT NULL,
                           `book` char(2) NOT NULL,
                           `name` varchar(64) NOT NULL,
                           `height` int NOT NULL,
                           `reference` char(14) NOT NULL,
                           `last_act_by` char(11) DEFAULT NULL,
                           `last_act_date` date DEFAULT NULL,
                           `humpid` mediumint(6) UNSIGNED ZEROFILL DEFAULT NULL,
                           `gridid` char(6) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE `table` (
                         `year` year NOT NULL,
                         `call` char(11) NOT NULL,
                         `pbpts` smallint DEFAULT NULL,
                         `frpts` smallint DEFAULT NULL,
                         `actpts` smallint DEFAULT NULL,
                         `rac` tinyint(1) DEFAULT NULL,
                         `raa` tinyint(1) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;


ALTER TABLE `activator_log`
    ADD PRIMARY KEY (`id`),
  ADD KEY `activatedby` (`activatedby`),
  ADD KEY `wotaid` (`wotaid`),
  ADD KEY `stncall` (`stncall`),
  ADD KEY `year` (`year`),
  ADD KEY `callused` (`callused`),
  ADD KEY `date` (`date`),
  ADD KEY `ucall` (`ucall`);

ALTER TABLE `activator_pts`
    ADD PRIMARY KEY (`activator`,`wotaid`,`year`);

ALTER TABLE `alerts`
    ADD PRIMARY KEY (`id`),
  ADD KEY `datetime` (`datetime`);

ALTER TABLE `awards`
    ADD KEY `certificate_id` (`certificate_id`),
  ADD KEY `category` (`award`);

ALTER TABLE `award_categories`
    ADD PRIMARY KEY (`id`);

ALTER TABLE `award_types`
    ADD PRIMARY KEY (`id`),
  ADD KEY `category` (`category`),
  ADD KEY `category_2` (`category`);

ALTER TABLE `chaser_log`
    ADD PRIMARY KEY (`id`),
  ADD KEY `wkdby` (`wkdby`),
  ADD KEY `wotaid` (`wotaid`),
  ADD KEY `stncall` (`stncall`),
  ADD KEY `year` (`year`),
  ADD KEY `ucall` (`ucall`);

ALTER TABLE `links`
    ADD PRIMARY KEY (`id`),
  ADD KEY `posted_date` (`posted_date`),
  ADD KEY `wotaid` (`wotaid`);

ALTER TABLE `spots`
    ADD PRIMARY KEY (`id`);

ALTER TABLE `summits`
    ADD PRIMARY KEY (`wotaid`),
  ADD KEY `sotaid` (`sotaid`),
  ADD KEY `book` (`book`),
  ADD KEY `name` (`name`);

ALTER TABLE `table`
    ADD PRIMARY KEY (`year`,`call`);


ALTER TABLE `activator_log`
    MODIFY `id` int NOT NULL AUTO_INCREMENT;

ALTER TABLE `alerts`
    MODIFY `id` int NOT NULL AUTO_INCREMENT;

ALTER TABLE `chaser_log`
    MODIFY `id` int NOT NULL AUTO_INCREMENT;

ALTER TABLE `links`
    MODIFY `id` int NOT NULL AUTO_INCREMENT;

ALTER TABLE `spots`
    MODIFY `id` int NOT NULL AUTO_INCREMENT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
