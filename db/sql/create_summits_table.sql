
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
