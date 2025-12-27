CREATE TABLE `alerts` (
                          `id` int NOT NULL AUTO_INCREMENT,
                          `wotaid` mediumint(3) unsigned zerofill NOT NULL,
                          `datetime` datetime NOT NULL,
                          `call` varchar(12) NOT NULL,
                          `freqmode` varchar(40) NOT NULL,
                          `comment` varchar(80) DEFAULT NULL,
                          `postedby` char(11) NOT NULL,
                          PRIMARY KEY (`id`),
                          KEY `datetime` (`datetime`)
) ENGINE=MyISAM AUTO_INCREMENT=7653 DEFAULT CHARSET=latin1