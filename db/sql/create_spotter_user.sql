
CREATE USER 'wotaorgu_wotadb_spotter'@'localhost' IDENTIFIED BY 'mypassword';
GRANT SELECT ON * TO 'wotaorgu_wotadb_spotter'@'localhost';
GRANT INSERT, UPDATE, DELETE ON wotaorgu_wotadb.spots TO 'wotaorgu_wotadb_spotter'@'localhost';
GRANT INSERT, UPDATE, DELETE ON wotaorgu_wotadb.alerts TO 'wotaorgu_wotadb_spotter'@'localhost';
FLUSH PRIVILEGES;
SHOW GRANTS FOR 'wotaorgu_wotadb_spotter'@'localhost';
