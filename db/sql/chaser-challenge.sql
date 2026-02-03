SELECT
    wkdby,
    CONCAT(a.activatedby, '-', a.wotaid, '-', DATE(a.date), '-', a.band, '-', a.mode)
FROM chaser_log c
         INNER JOIN activator_log a ON
    c.stncall = a.callused
        AND c.wotaid = a.wotaid
        AND c.wkdby = a.stncall
        AND DATE(c.date) = DATE(a.date)
WHERE a.year = 2026
  AND a.band IN ('2m', '70cm')
  AND a.mode IN ('CW', 'SSB')