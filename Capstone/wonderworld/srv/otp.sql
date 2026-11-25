USE wonderworld;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS login_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(120) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts TINYINT NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_code_attempts CHECK (attempts BETWEEN 0 AND 5),
  CONSTRAINT chk_code_expiry CHECK (expires_at > created_at),
  INDEX idx_login_codes_email (email, created_at)
) DEFAULT CHARSET = utf8mb4;

DROP TRIGGER IF EXISTS trg_login_code_limit;

DELIMITER $$

CREATE TRIGGER trg_login_code_limit
BEFORE INSERT ON login_codes
FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM login_codes WHERE email = NEW.email AND created_at > NOW() - INTERVAL 60 SECOND) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Please wait 1 minute before asking for a new code.';
  END IF;
  IF (SELECT COUNT(*) FROM login_codes WHERE email = NEW.email AND created_at > NOW() - INTERVAL 1 HOUR) >= 5 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Too many codes asked for this email. Please try again after an hour.';
  END IF;
END$$

DELIMITER ;