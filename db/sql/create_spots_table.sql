
CREATE TABLE `spots` (
                         `id` int NOT NULL,
                         `datetime` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
                         `call` varchar(12) NOT NULL,
                         `wotaid` mediumint(3) UNSIGNED ZEROFILL NOT NULL,
                         `freqmode` varchar(20) NOT NULL,
                         `comment` varchar(80) NOT NULL,
                         `spotter` char(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
