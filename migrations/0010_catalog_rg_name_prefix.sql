UPDATE catalog_items
SET name = CASE
  WHEN UPPER(TRIM(name)) LIKE 'RG1/144 %' THEN 'RG 1/144 ' || TRIM(SUBSTR(TRIM(name), 9))
  WHEN UPPER(TRIM(name)) LIKE 'RG %' THEN 'RG 1/144 ' || TRIM(SUBSTR(TRIM(name), 4))
  WHEN UPPER(TRIM(name)) LIKE 'MG %' THEN 'RG 1/144 ' || TRIM(SUBSTR(TRIM(name), 4))
  ELSE 'RG 1/144 ' || TRIM(name)
END,
updated_at = CURRENT_TIMESTAMP
WHERE UPPER(COALESCE(NULLIF(line, ''), grade)) = 'RG'
  AND UPPER(TRIM(name)) NOT LIKE 'RG 1/144 %';

UPDATE catalog_items
SET payload_json = CASE
  WHEN JSON_VALID(payload_json) THEN JSON_SET(payload_json, '$.name', name)
  ELSE payload_json
END
WHERE UPPER(COALESCE(NULLIF(line, ''), grade)) = 'RG';
