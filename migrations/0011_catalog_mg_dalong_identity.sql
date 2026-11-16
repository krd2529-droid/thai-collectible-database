UPDATE catalog_items
SET id = 'm217',
    sort_order = 217,
    payload_json = json_set(
      payload_json,
      '$.id', 'm217',
      '$.sku', '',
      '$.mgNumber', 217,
      '$.sortOrder', 217,
      '$.dalongPageUrl', 'https://www.dalong.net/reviews/mg/m217/m217_i_e.htm'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'mg-001'
  AND name LIKE '%Eclipse Gundam%'
  AND NOT EXISTS (SELECT 1 FROM catalog_items WHERE id = 'm217');
