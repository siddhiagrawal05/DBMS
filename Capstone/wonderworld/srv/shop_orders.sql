USE wonderworld;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS shop_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(12) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  shop_id INT NOT NULL,
  total INT NOT NULL,
  payment_method ENUM('Counter','Online') NOT NULL DEFAULT 'Counter',
  payment_id VARCHAR(40) NULL,
  status ENUM('Placed','Ready','Collected','Cancelled') NOT NULL DEFAULT 'Placed',
  note VARCHAR(150),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_shop_order_total CHECK (total > 0),
  INDEX idx_shop_orders_time (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id) REFERENCES shops(id)
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS shop_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  shop_item_id INT NULL,
  name VARCHAR(100) NOT NULL,
  price INT NOT NULL,
  qty INT NOT NULL,
  CONSTRAINT chk_shop_order_qty CHECK (qty BETWEEN 1 AND 10),
  FOREIGN KEY (order_id) REFERENCES shop_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_item_id) REFERENCES shop_items(id) ON DELETE SET NULL
) DEFAULT CHARSET = utf8mb4;