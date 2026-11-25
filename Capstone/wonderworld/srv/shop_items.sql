USE wonderworld;
SET NAMES utf8mb4;

DROP TABLE IF EXISTS shop_items;

CREATE TABLE shop_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  price INT NOT NULL,
  CONSTRAINT chk_shop_item_price CHECK (price > 0),
  UNIQUE (shop_id, name),
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
) DEFAULT CHARSET = utf8mb4;

INSERT INTO shops (name, description, price_range, open_time, close_time, img)
SELECT 'Splash Zone Store', 'Everything for the water park: swimwear, goggles, towels, floats and waterproof pouches.', '₹199 – ₹1,299', '10:00', '19:00', 'https://images.unsplash.com/photo-1739295194212-0602c4d1e797?auto=format&fit=crop&w=900&q=80'
WHERE NOT EXISTS (SELECT 1 FROM shops WHERE name = 'Splash Zone Store');

SET @souvenirs = (SELECT id FROM shops WHERE name = 'WonderWorld Souvenirs' LIMIT 1);
SET @toys = (SELECT id FROM shops WHERE name = 'Toy Town' LIMIT 1);
SET @photo = (SELECT id FROM shops WHERE name = 'Ride Photo Studio' LIMIT 1);
SET @splash = (SELECT id FROM shops WHERE name = 'Splash Zone Store' LIMIT 1);

UPDATE shops SET description = 'Soft toys, ride models, RC cars and party balloons for kids.' WHERE id = @toys;

INSERT INTO shop_items (shop_id, name, price) VALUES
(@souvenirs, 'Fridge Magnet', 99), (@souvenirs, 'Keychain', 129), (@souvenirs, 'Postcard Set (6 pcs)', 149), (@souvenirs, 'Coffee Mug', 299),
(@souvenirs, 'Steel Water Bottle', 349), (@souvenirs, 'Tote Bag', 349), (@souvenirs, 'WonderWorld Cap', 399), (@souvenirs, 'Photo Frame', 399),
(@souvenirs, 'Kids T-shirt', 449), (@souvenirs, 'Snow Globe', 499), (@souvenirs, 'Adult T-shirt', 599), (@souvenirs, 'Mascot Soft Toy', 699),
(@souvenirs, 'Hoodie', 1299), (@souvenirs, 'Souvenir Gift Hamper', 1499),
(@toys, 'Helium Balloon', 149), (@toys, 'Bubble Wand', 149), (@toys, 'Glow Stick Pack', 199), (@toys, 'Kite', 199),
(@toys, 'Light-up Spinner', 249), (@toys, 'Jigsaw Puzzle', 299), (@toys, 'Small Teddy Bear', 349), (@toys, 'Magic Trick Kit', 599),
(@toys, 'Roller Coaster Model', 699), (@toys, 'Board Game', 799), (@toys, 'Building Blocks Set', 899), (@toys, 'Giant Teddy Bear', 1299),
(@toys, 'Remote Control Car', 1499), (@toys, 'Mini Camera Drone', 2499),
(@photo, 'Digital Photo (1 ride)', 199), (@photo, 'Instant Polaroid', 199), (@photo, 'Photo Fridge Magnet', 199), (@photo, 'Printed Photo 6x4', 249),
(@photo, 'Photo Keychain', 249), (@photo, 'Ride Video Clip', 299), (@photo, 'Printed Photo 8x10', 349), (@photo, 'Photo Coaster Set', 349),
(@photo, 'Photo Mug', 399), (@photo, 'Wooden Photo Frame', 449), (@photo, 'Photo Calendar', 499), (@photo, 'Photo Cushion', 549),
(@photo, 'Photo T-shirt', 599), (@photo, 'All-Day Digital Photo Pass', 699),
(@splash, 'Swimming Cap', 199), (@splash, 'Waterproof Phone Pouch', 249), (@splash, 'Arm Floaties (Kids)', 249), (@splash, 'Swimming Goggles', 299),
(@splash, 'Flip-Flops', 299), (@splash, 'Water Gun', 299), (@splash, 'Sunscreen SPF 50', 349), (@splash, 'Swim Ring', 349),
(@splash, 'Quick-Dry Towel', 449), (@splash, 'Dry Bag', 499), (@splash, 'Kids Swimsuit', 499), (@splash, 'Swim Shorts', 599),
(@splash, 'Adult Swimsuit', 799), (@splash, 'Kids Life Jacket', 1299);