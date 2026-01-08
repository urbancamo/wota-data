-- Check what summit has wotaid = 165
SELECT
    wotaid,
    sotaid,
    name,
    CASE
        WHEN wotaid <= 214 THEN CONCAT('LDW-', LPAD(wotaid, 3, '0'))
        ELSE CONCAT('LDO-', LPAD(wotaid - 214, 3, '0'))
    END AS wota_ref,
    CASE
        WHEN sotaid IS NOT NULL THEN CONCAT('G/LD-', LPAD(sotaid, 3, '0'))
        ELSE 'No SOTA'
    END AS sota_ref
FROM summits
WHERE wotaid = 165;
