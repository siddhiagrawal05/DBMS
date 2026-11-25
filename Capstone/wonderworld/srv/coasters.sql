USE wonderworld;
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS ww_prepare_coasters;

DELIMITER $$
CREATE PROCEDURE ww_prepare_coasters()
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'rides' AND constraint_name = 'fk_rides_coaster') THEN
    ALTER TABLE rides DROP FOREIGN KEY fk_rides_coaster;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'rides' AND column_name = 'coaster_id') THEN
    ALTER TABLE rides ADD COLUMN coaster_id INT NULL AFTER description;
  ELSE
    UPDATE rides SET coaster_id = NULL WHERE id > 0;
  END IF;
END$$
DELIMITER ;

CALL ww_prepare_coasters();
DROP PROCEDURE ww_prepare_coasters;

DROP PROCEDURE IF EXISTS sp_load_coasters;
DROP PROCEDURE IF EXISTS sp_top_coasters;
DROP FUNCTION IF EXISTS fn_to_feet;
DROP VIEW IF EXISTS v_coaster_summary;
DROP TABLE IF EXISTS coasters;
DROP TABLE IF EXISTS coaster_manufacturers;
DROP TABLE IF EXISTS raw_coasters;

CREATE TABLE raw_coasters (
  coaster_name VARCHAR(200),
  length_raw VARCHAR(200),
  location VARCHAR(200),
  status VARCHAR(200),
  type_raw VARCHAR(200),
  manufacturer VARCHAR(300),
  model VARCHAR(200),
  height_raw VARCHAR(200),
  year_introduced VARCHAR(10),
  latitude VARCHAR(30),
  longitude VARCHAR(30),
  type_main VARCHAR(20),
  opening_date VARCHAR(20),
  speed_mph VARCHAR(20),
  inversions VARCHAR(10),
  gforce VARCHAR(10)
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE coaster_manufacturers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE coasters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  park VARCHAR(150) NULL,
  status ENUM('Operating','Closed','Removed','Under construction','Unknown','Other') NOT NULL DEFAULT 'Unknown',
  type_main ENUM('Steel','Wood','Other') NOT NULL,
  style VARCHAR(100) NULL,
  model VARCHAR(150) NULL,
  manufacturer_id INT NULL,
  year_introduced SMALLINT NOT NULL,
  opened DATE NULL,
  speed_mph DECIMAL(5,1) NULL,
  height_ft DECIMAL(6,1) NULL,
  length_ft DECIMAL(7,1) NULL,
  inversions TINYINT NOT NULL DEFAULT 0,
  gforce DECIMAL(3,1) NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  UNIQUE KEY uq_coaster_name_year (name, year_introduced),
  CONSTRAINT chk_coaster_speed CHECK (speed_mph IS NULL OR speed_mph BETWEEN 0 AND 200),
  CONSTRAINT chk_coaster_height CHECK (height_ft IS NULL OR height_ft BETWEEN 0 AND 700),
  CONSTRAINT chk_coaster_inversions CHECK (inversions BETWEEN 0 AND 20),
  CONSTRAINT chk_coaster_gforce CHECK (gforce IS NULL OR gforce BETWEEN 0 AND 15),
  CONSTRAINT chk_coaster_year CHECK (year_introduced BETWEEN 1800 AND 2100),
  INDEX idx_coasters_speed (speed_mph),
  INDEX idx_coasters_type_year (type_main, year_introduced),
  FOREIGN KEY (manufacturer_id) REFERENCES coaster_manufacturers(id) ON DELETE SET NULL
) DEFAULT CHARSET = utf8mb4;

ALTER TABLE rides ADD CONSTRAINT fk_rides_coaster FOREIGN KEY (coaster_id) REFERENCES coasters(id) ON DELETE SET NULL;

CREATE VIEW v_coaster_summary AS
SELECT type_main,
       COUNT(*) AS coasters,
       SUM(status = 'Operating') AS operating,
       ROUND(AVG(speed_mph), 1) AS avg_speed_mph,
       MAX(speed_mph) AS top_speed_mph,
       ROUND(AVG(height_ft), 1) AS avg_height_ft,
       MAX(height_ft) AS max_height_ft,
       ROUND(AVG(inversions), 2) AS avg_inversions
FROM coasters
GROUP BY type_main;

DELIMITER $$

CREATE FUNCTION fn_to_feet(p_raw VARCHAR(200)) RETURNS DECIMAL(8,1)
DETERMINISTIC
BEGIN
  DECLARE v VARCHAR(200);
  DECLARE n VARCHAR(30);
  IF p_raw IS NULL THEN
    RETURN NULL;
  END IF;
  SET v = REPLACE(p_raw, CONVERT(UNHEX('C2A0') USING utf8mb4), ' ');
  SET n = REGEXP_SUBSTR(v, '[0-9][0-9,.]*(?=\\s*ft)');
  IF n IS NOT NULL THEN
    RETURN CAST(REPLACE(n, ',', '') AS DECIMAL(10,1));
  END IF;
  SET n = REGEXP_SUBSTR(v, '[0-9][0-9,.]*(?=\\s*m\\b)');
  IF n IS NOT NULL THEN
    RETURN ROUND(CAST(REPLACE(n, ',', '') AS DECIMAL(10,2)) * 3.28084, 1);
  END IF;
  RETURN NULL;
END$$

CREATE PROCEDURE sp_load_coasters()
BEGIN
  DECLARE v_raw INT;
  DECLARE v_ride INT;
  DECLARE v_coaster INT;
  SELECT COUNT(*) INTO v_raw FROM raw_coasters;

  INSERT IGNORE INTO coaster_manufacturers (name)
  SELECT DISTINCT LEFT(TRIM(manufacturer), 200) FROM raw_coasters WHERE manufacturer IS NOT NULL AND TRIM(manufacturer) <> '';

  INSERT IGNORE INTO coasters (name, park, status, type_main, style, model, manufacturer_id, year_introduced, opened,
                               speed_mph, height_ft, length_ft, inversions, gforce, latitude, longitude)
  SELECT REGEXP_REPLACE(LEFT(TRIM(r.coaster_name), 150), '\\s*\\(roller coaster\\)$', ''),
         NULLIF(LEFT(TRIM(r.location), 150), 'Other'),
         CASE
           WHEN r.status IS NULL THEN 'Unknown'
           WHEN r.status LIKE 'Operating%' THEN 'Operating'
           WHEN r.status LIKE 'Removed%' OR r.status LIKE '%dismantled%' OR r.status LIKE 'Demolished%' THEN 'Removed'
           WHEN r.status LIKE 'Closed%' OR r.status LIKE 'SBNO%' OR r.status LIKE 'Not Currently Operating%' OR r.status LIKE 'Discontinued%' THEN 'Closed'
           WHEN r.status LIKE 'Under construction%' THEN 'Under construction'
           ELSE 'Other'
         END,
         IF(r.type_main IN ('Steel', 'Wood'), r.type_main, 'Other'),
         NULLIF(LEFT(TRIM(r.type_raw), 100), ''),
         NULLIF(LEFT(TRIM(r.model), 150), ''),
         m.id,
         CAST(r.year_introduced AS UNSIGNED),
         IF(r.opening_date REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$', CAST(r.opening_date AS DATE), NULL),
         CAST(NULLIF(r.speed_mph, '') AS DECIMAL(5,1)),
         IF(fn_to_feet(r.height_raw) BETWEEN 1 AND 700, fn_to_feet(r.height_raw), NULL),
         IF(fn_to_feet(r.length_raw) BETWEEN 1 AND 99999, fn_to_feet(r.length_raw), NULL),
         COALESCE(CAST(NULLIF(r.inversions, '') AS UNSIGNED), 0),
         CAST(NULLIF(r.gforce, '') AS DECIMAL(3,1)),
         CAST(NULLIF(r.latitude, '') AS DECIMAL(9,6)),
         CAST(NULLIF(r.longitude, '') AS DECIMAL(9,6))
  FROM raw_coasters r
  LEFT JOIN coaster_manufacturers m ON m.name = LEFT(TRIM(r.manufacturer), 200)
  WHERE r.coaster_name IS NOT NULL AND r.year_introduced REGEXP '^[0-9]{4}$';

  SET v_ride = (SELECT id FROM rides WHERE name = 'Thunder Coaster' LIMIT 1);
  SET v_coaster = (SELECT id FROM coasters WHERE name = 'Afterburn' AND year_introduced = 1999 LIMIT 1);
  UPDATE rides SET coaster_id = v_coaster WHERE id = v_ride;

  SET v_ride = (SELECT id FROM rides WHERE name = 'Loop Fury' LIMIT 1);
  SET v_coaster = (SELECT id FROM coasters WHERE name = 'Corkscrew (Cedar Point)' AND year_introduced = 1976 LIMIT 1);
  UPDATE rides SET coaster_id = v_coaster WHERE id = v_ride;

  SET v_ride = (SELECT id FROM rides WHERE name = 'Jungle Racer' LIMIT 1);
  SET v_coaster = (SELECT id FROM coasters WHERE name = 'Lightning Racer' AND year_introduced = 2000 LIMIT 1);
  UPDATE rides SET coaster_id = v_coaster WHERE id = v_ride;

  TRUNCATE TABLE raw_coasters;
  SELECT v_raw AS raw_rows,
         (SELECT COUNT(*) FROM coasters) AS coasters_loaded,
         (SELECT COUNT(*) FROM coaster_manufacturers) AS manufacturers,
         (SELECT COUNT(*) FROM coasters WHERE height_ft IS NOT NULL) AS with_height,
         (SELECT COUNT(*) FROM rides WHERE coaster_id IS NOT NULL) AS rides_linked;
END$$

CREATE PROCEDURE sp_top_coasters(IN p_metric VARCHAR(10), IN p_limit INT)
BEGIN
  SELECT c.name, c.park, c.year_introduced, c.type_main, m.name AS manufacturer,
         c.speed_mph, c.height_ft, c.length_ft, c.inversions
  FROM coasters c
  LEFT JOIN coaster_manufacturers m ON m.id = c.manufacturer_id
  WHERE CASE p_metric
          WHEN 'height' THEN c.height_ft
          WHEN 'length' THEN c.length_ft
          WHEN 'inversions' THEN c.inversions
          ELSE c.speed_mph
        END IS NOT NULL
  ORDER BY CASE p_metric
             WHEN 'height' THEN c.height_ft
             WHEN 'length' THEN c.length_ft
             WHEN 'inversions' THEN c.inversions
             ELSE c.speed_mph
           END DESC, c.name
  LIMIT p_limit;
END$$

DELIMITER ;