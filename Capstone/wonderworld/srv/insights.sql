USE wonderworld;
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS sp_load_reviews;
DROP PROCEDURE IF EXISTS sp_review_trend;
DROP VIEW IF EXISTS v_benchmark_summary;
DROP TABLE IF EXISTS park_reviews;
DROP TABLE IF EXISTS review_countries;
DROP TABLE IF EXISTS benchmark_parks;
DROP TABLE IF EXISTS raw_reviews;

CREATE TABLE raw_reviews (
  review_id BIGINT,
  rating INT,
  ym VARCHAR(10),
  reviewer_location VARCHAR(100),
  review_text TEXT,
  branch VARCHAR(40)
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE benchmark_parks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(60) NOT NULL,
  city VARCHAR(60) NOT NULL,
  country VARCHAR(60) NOT NULL,
  opened SMALLINT NOT NULL
) DEFAULT CHARSET = utf8mb4;

INSERT INTO benchmark_parks (code, name, city, country, opened) VALUES
('Disneyland_California', 'Disneyland California', 'Anaheim', 'United States', 1955),
('Disneyland_Paris', 'Disneyland Paris', 'Marne-la-Vallee', 'France', 1992),
('Disneyland_HongKong', 'Hong Kong Disneyland', 'Lantau Island', 'Hong Kong', 2005);

CREATE TABLE review_countries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE park_reviews (
  id BIGINT PRIMARY KEY,
  park_id INT NOT NULL,
  country_id INT NULL,
  rating TINYINT NOT NULL,
  visit_year SMALLINT NULL,
  visit_month TINYINT NULL,
  review_text TEXT NOT NULL,
  CONSTRAINT chk_park_review_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT chk_park_review_month CHECK (visit_month IS NULL OR visit_month BETWEEN 1 AND 12),
  INDEX idx_park_reviews_park_year (park_id, visit_year),
  INDEX idx_park_reviews_rating (rating),
  FOREIGN KEY (park_id) REFERENCES benchmark_parks(id) ON DELETE CASCADE,
  FOREIGN KEY (country_id) REFERENCES review_countries(id) ON DELETE SET NULL
) DEFAULT CHARSET = utf8mb4;

CREATE VIEW v_benchmark_summary AS
SELECT p.id, p.name, p.city, p.country,
       COUNT(r.id) AS reviews,
       ROUND(AVG(r.rating), 2) AS avg_rating,
       ROUND(100 * SUM(r.rating = 5) / COUNT(r.id), 1) AS pct_five_star,
       ROUND(100 * SUM(r.rating <= 2) / COUNT(r.id), 1) AS pct_low,
       MIN(r.visit_year) AS first_year,
       MAX(r.visit_year) AS last_year
FROM benchmark_parks p
LEFT JOIN park_reviews r ON r.park_id = p.id
GROUP BY p.id, p.name, p.city, p.country;

DELIMITER $$

CREATE PROCEDURE sp_load_reviews()
BEGIN
  DECLARE v_raw INT;
  DECLARE v_loaded INT;
  SELECT COUNT(*) INTO v_raw FROM raw_reviews;

  INSERT IGNORE INTO review_countries (name)
  SELECT DISTINCT TRIM(reviewer_location) FROM raw_reviews WHERE TRIM(reviewer_location) <> '';

  INSERT IGNORE INTO park_reviews (id, park_id, country_id, rating, visit_year, visit_month, review_text)
  SELECT r.review_id, p.id, c.id, r.rating,
         IF(r.ym = 'missing', NULL, CAST(SUBSTRING_INDEX(r.ym, '-', 1) AS UNSIGNED)),
         IF(r.ym = 'missing', NULL, CAST(SUBSTRING_INDEX(r.ym, '-', -1) AS UNSIGNED)),
         TRIM(r.review_text)
  FROM raw_reviews r
  JOIN benchmark_parks p ON p.code = r.branch
  LEFT JOIN review_countries c ON c.name = TRIM(r.reviewer_location);

  SELECT COUNT(*) INTO v_loaded FROM park_reviews;
  TRUNCATE TABLE raw_reviews;

  IF EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'park_reviews' AND index_name = 'ft_park_reviews_text') THEN
    ALTER TABLE park_reviews DROP INDEX ft_park_reviews_text;
  END IF;
  ALTER TABLE park_reviews ADD FULLTEXT INDEX ft_park_reviews_text (review_text);

  SELECT v_raw AS raw_rows, v_loaded AS reviews_loaded, v_raw - v_loaded AS duplicates_skipped,
         (SELECT COUNT(*) FROM review_countries) AS countries;
END$$

CREATE PROCEDURE sp_review_trend(IN p_park INT)
BEGIN
  SELECT visit_year, COUNT(*) AS reviews, ROUND(AVG(rating), 2) AS avg_rating
  FROM park_reviews
  WHERE visit_year IS NOT NULL AND (p_park IS NULL OR park_id = p_park)
  GROUP BY visit_year
  ORDER BY visit_year;
END$$

DELIMITER ;