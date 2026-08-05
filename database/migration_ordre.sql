UPDATE modules_cours mc
JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY classe_id ORDER BY id) - 1 AS nouvel_ordre
  FROM modules_cours
) t ON t.id = mc.id
SET mc.ordre = t.nouvel_ordre;

UPDATE pages_cours pc
JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY module_id ORDER BY id) - 1 AS nouvel_ordre
  FROM pages_cours
) t ON t.id = pc.id
SET pc.ordre = t.nouvel_ordre;
