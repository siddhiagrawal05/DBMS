USE wonderworld;

DROP PROCEDURE IF EXISTS add_food_payment_columns;

DELIMITER $$

CREATE PROCEDURE add_food_payment_columns()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'food_orders' AND column_name = 'payment_method') THEN
    ALTER TABLE food_orders ADD COLUMN payment_method ENUM('Counter','Online') NOT NULL DEFAULT 'Counter' AFTER total;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'food_orders' AND column_name = 'payment_id') THEN
    ALTER TABLE food_orders ADD COLUMN payment_id VARCHAR(40) NULL AFTER payment_method;
  END IF;
END$$

DELIMITER ;

CALL add_food_payment_columns();
DROP PROCEDURE add_food_payment_columns;