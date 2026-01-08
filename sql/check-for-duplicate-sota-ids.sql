SELECT
    sotaid,
    COUNT(*) as count,
    GROUP_CONCAT(CONCAT(wotaid, ': ', name) SEPARATOR ' | ') as summits
FROM summits
WHERE sotaid = 53
GROUP BY sotaid
HAVING COUNT(*) > 1;
