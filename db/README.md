# Useful Commands

## Import phpmyadmin export locally

Specify database creation in the export the first time

```bash
mysql -u root < wotaorgu_wotadb.sql
```

List local databases:

```mysql
show databases
```

Create database user
```mysql
CREATE USER 'myuser'@'localhost' IDENTIFIED BY 'mypassword';
GRANT ALL PRIVILEGES ON mydatabase.* TO 'myuser'@'localhost';
FLUSH PRIVILEGES;
```

Grant access to user from any host
```mysql
CREATE USER 'myuser'@'%' IDENTIFIED BY 'mypassword';
GRANT ALL PRIVILEGES ON mydatabase.* TO 'myuser'@'%';
FLUSH PRIVILEGES;
```

## Specifically for the 
Grant privileges required for specific access
```mysql
GRANT SELECT ON mydatabase.summits TO 'wotaorgu_wotadb_spotter'@'%';

```