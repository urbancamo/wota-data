-- --------------------------------------------------------

--
-- Table structure for table `cms_module_feusers_users`
--

CREATE TABLE `cms_module_feusers_users` (
  `id` int NOT NULL,
  `username` varchar(80) DEFAULT NULL,
  `password` varchar(32) DEFAULT NULL,
  `createdate` datetime DEFAULT NULL,
  `expires` datetime DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

