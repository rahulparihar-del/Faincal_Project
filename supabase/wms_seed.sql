-- WMS Seed Data for KiddieKa WMS with strictly valid hex-only UUID strings

-- 1. Fabrics
INSERT INTO wms_fabrics (id, name, code) VALUES
  ('47101831-29cf-41ee-85db-111111111111', 'Cotton', 'COT'),
  ('47101831-29cf-41ee-85db-222222222222', 'Polyester', 'PLY')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- 2. Categories
INSERT INTO wms_categories (id, name, code, sort_order) VALUES
  ('ca711111-1111-1111-1111-111111111111', 'Cotton Jabla',                  'CJ',  1),
  ('ca722222-2222-2222-2222-222222222222', 'Cotton Co-ord Set',              'CCS', 2),
  ('ca733333-3333-3333-3333-333333333333', 'Polyester Co-ord Set',           'PCS', 3),
  ('ca744444-4444-4444-4444-444444444444', 'Cotton Night Suit Half Sleeve',  'CNH', 4),
  ('ca755555-5555-5555-5555-555555555555', 'Cotton Night Suit Full Sleeve',  'CNF', 5),
  ('ca766666-6666-6666-6666-666666666666', 'Cotton Frock',                   'CF',  6),
  ('ca777777-7777-7777-7777-777777777777', 'Cotton Hooded Towel',            'CHT', 7),
  ('ca788888-8888-8888-8888-888888888888', 'Cotton Swaddle',                 'CS',  8),
  ('ca799999-9999-9999-9999-999999999999', 'Wipes Cotton Rumal',             'WCR', 9),
  ('ca700000-0000-0000-0000-000000000000', 'Track Pant',                     'TP',  10)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- 3. Sizes per category
-- Cotton Jabla: 0-3M, 3-6M, 6-9M, 9-12M
INSERT INTO wms_sizes (id, category_id, label, code, sort_order) VALUES
  ('50c822e1-7ca0-4a81-9b11-111111111111', 'ca711111-1111-1111-1111-111111111111', '0-3M',  '03M', 1),
  ('50c822e1-7ca0-4a81-9b11-222222222222', 'ca711111-1111-1111-1111-111111111111', '3-6M',  '36M', 2),
  ('50c822e1-7ca0-4a81-9b11-333333333333', 'ca711111-1111-1111-1111-111111111111', '6-9M',  '69M', 3),
  ('50c822e1-7ca0-4a81-9b11-444444444444', 'ca711111-1111-1111-1111-111111111111', '9-12M', '912M', 4)
ON CONFLICT (category_id, code) DO NOTHING;

-- Cotton Co-ord Set: 0-3M, 3-6M, 6-9M, 9-12M, 12-18M, 18-24M
INSERT INTO wms_sizes (id, category_id, label, code, sort_order) VALUES
  ('50c822e2-7ca0-4a81-9b22-111111111111', 'ca722222-2222-2222-2222-222222222222', '0-3M',   '03M',   1),
  ('50c822e2-7ca0-4a81-9b22-222222222222', 'ca722222-2222-2222-2222-222222222222', '3-6M',   '36M',   2),
  ('50c822e2-7ca0-4a81-9b22-333333333333', 'ca722222-2222-2222-2222-222222222222', '6-9M',   '69M',   3),
  ('50c822e2-7ca0-4a81-9b22-444444444444', 'ca722222-2222-2222-2222-222222222222', '9-12M',  '912M',  4),
  ('50c822e2-7ca0-4a81-9b22-555555555555', 'ca722222-2222-2222-2222-222222222222', '12-18M', '1218M', 5),
  ('50c822e2-7ca0-4a81-9b22-666666666666', 'ca722222-2222-2222-2222-222222222222', '18-24M', '1824M', 6)
ON CONFLICT (category_id, code) DO NOTHING;

-- Polyester Co-ord Set: 1Y, 2Y, 3Y, 4Y, 5Y
INSERT INTO wms_sizes (id, category_id, label, code, sort_order) VALUES
  ('50c822e3-7ca0-4a81-9b33-111111111111', 'ca733333-3333-3333-3333-333333333333', '1Y', '1Y', 1),
  ('50c822e3-7ca0-4a81-9b33-222222222222', 'ca733333-3333-3333-3333-333333333333', '2Y', '2Y', 2),
  ('50c822e3-7ca0-4a81-9b33-333333333333', 'ca733333-3333-3333-3333-333333333333', '3Y', '3Y', 3),
  ('50c822e3-7ca0-4a81-9b33-444444444444', 'ca733333-3333-3333-3333-333333333333', '4Y', '4Y', 4),
  ('50c822e3-7ca0-4a81-9b33-555555555555', 'ca733333-3333-3333-3333-333333333333', '5Y', '5Y', 5)
ON CONFLICT (category_id, code) DO NOTHING;

-- Cotton Night Suit Half Sleeve: 0-3M, 3-6M, 6-9M, 6-12M, 12-18M, 18-24M
INSERT INTO wms_sizes (id, category_id, label, code, sort_order) VALUES
  ('50c822e4-7ca0-4a81-9b44-111111111111', 'ca744444-4444-4444-4444-444444444444', '0-3M',   '03M',   1),
  ('50c822e4-7ca0-4a81-9b44-222222222222', 'ca744444-4444-4444-4444-444444444444', '3-6M',   '36M',   2),
  ('50c822e4-7ca0-4a81-9b44-333333333333', 'ca744444-4444-4444-4444-444444444444', '6-9M',   '69M',   3),
  ('50c822e4-7ca0-4a81-9b44-444444444444', 'ca744444-4444-4444-4444-444444444444', '6-12M',  '612M',  4),
  ('50c822e4-7ca0-4a81-9b44-555555555555', 'ca744444-4444-4444-4444-444444444444', '12-18M', '1218M', 5),
  ('50c822e4-7ca0-4a81-9b44-666666666666', 'ca744444-4444-4444-4444-444444444444', '18-24M', '1824M', 6)
ON CONFLICT (category_id, code) DO NOTHING;

-- Cotton Night Suit Full Sleeve: 0-3M, 3-6M, 6-9M, 6-12M, 12-18M, 18-24M
INSERT INTO wms_sizes (id, category_id, label, code, sort_order) VALUES
  ('50c822e5-7ca0-4a81-9b55-111111111111', 'ca755555-5555-5555-5555-555555555555', '0-3M',   '03M',   1),
  ('50c822e5-7ca0-4a81-9b55-222222222222', 'ca755555-5555-5555-5555-555555555555', '3-6M',   '36M',   2),
  ('50c822e5-7ca0-4a81-9b55-333333333333', 'ca755555-5555-5555-5555-555555555555', '6-9M',   '69M',   3),
  ('50c822e5-7ca0-4a81-9b55-444444444444', 'ca755555-5555-5555-5555-555555555555', '6-12M',  '612M',  4),
  ('50c822e5-7ca0-4a81-9b55-555555555555', 'ca755555-5555-5555-5555-555555555555', '12-18M', '1218M', 5),
  ('50c822e5-7ca0-4a81-9b55-666666666666', 'ca755555-5555-5555-5555-555555555555', '18-24M', '1824M', 6)
ON CONFLICT (category_id, code) DO NOTHING;

-- Cotton Frock: 0-3M, 3-6M, 6-12M
INSERT INTO wms_sizes (id, category_id, label, code, sort_order) VALUES
  ('50c822e6-7ca0-4a81-9b66-111111111111', 'ca766666-6666-6666-6666-666666666666', '0-3M',  '03M',  1),
  ('50c822e6-7ca0-4a81-9b66-222222222222', 'ca766666-6666-6666-6666-666666666666', '3-6M',  '36M',  2),
  ('50c822e6-7ca0-4a81-9b66-333333333333', 'ca766666-6666-6666-6666-666666666666', '6-12M', '612M', 3)
ON CONFLICT (category_id, code) DO NOTHING;

-- Cotton Hooded Towel: Free Size
INSERT INTO wms_sizes (id, category_id, label, code, sort_order) VALUES
  ('50c822e7-7ca0-4a81-9b77-111111111111', 'ca777777-7777-7777-7777-777777777777', 'Free Size', 'FS', 1)
ON CONFLICT (category_id, code) DO NOTHING;

-- Cotton Swaddle: Free Size
INSERT INTO wms_sizes (id, category_id, label, code, sort_order) VALUES
  ('50c822e8-7ca0-4a81-9b88-111111111111', 'ca788888-8888-8888-8888-888888888888', 'Free Size', 'FS', 1)
ON CONFLICT (category_id, code) DO NOTHING;

-- Wipes Cotton Rumal: Free Size
INSERT INTO wms_sizes (id, category_id, label, code, sort_order) VALUES
  ('50c822e9-7ca0-4a81-9b99-111111111111', 'ca799999-9999-9999-9999-999999999999', 'Free Size', 'FS', 1)
ON CONFLICT (category_id, code) DO NOTHING;

-- Track Pant: 3Y, 4Y, 5Y, 6Y, 7Y, 8Y
INSERT INTO wms_sizes (id, category_id, label, code, sort_order) VALUES
  ('50c822e0-7ca0-4a81-9b00-111111111111', 'ca700000-0000-0000-0000-000000000000', '3Y', '3Y', 1),
  ('50c822e0-7ca0-4a81-9b00-222222222222', 'ca700000-0000-0000-0000-000000000000', '4Y', '4Y', 2),
  ('50c822e0-7ca0-4a81-9b00-333333333333', 'ca700000-0000-0000-0000-000000000000', '5Y', '5Y', 3),
  ('50c822e0-7ca0-4a81-9b00-444444444444', 'ca700000-0000-0000-0000-000000000000', '6Y', '6Y', 4),
  ('50c822e0-7ca0-4a81-9b00-555555555555', 'ca700000-0000-0000-0000-000000000000', '7Y', '7Y', 5),
  ('50c822e0-7ca0-4a81-9b00-666666666666', 'ca700000-0000-0000-0000-000000000000', '8Y', '8Y', 6)
ON CONFLICT (category_id, code) DO NOTHING;

-- 4. Marketplace Channels
INSERT INTO wms_marketplace_channels (id, name, code) VALUES
  ('e1a1795c-9c7f-47bf-8f5b-111111111111', 'Amazon', 'AMZ'),
  ('e1a1795c-9c7f-47bf-8f5b-222222222222', 'Flipkart', 'FLK'),
  ('e1a1795c-9c7f-47bf-8f5b-333333333333', 'Meesho', 'MSH'),
  ('e1a1795c-9c7f-47bf-8f5b-444444444444', 'Website', 'WEB'),
  ('e1a1795c-9c7f-47bf-8f5b-555555555555', 'Offline', 'OFF')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- 5. Default Warehouse
INSERT INTO wms_warehouses (id, name, code, city, is_active, is_default) VALUES
  ('c385a86a-84fb-4b5f-a78b-111111111111', 'Main Warehouse', 'WH-01', 'Mumbai', true, true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_default = EXCLUDED.is_default;

-- 6. Barcode Templates
INSERT INTO wms_barcode_templates (id, name, width_mm, height_mm, is_default, fields) VALUES
  ('b09919f2-2b62-43bb-a579-111111111111', '50×25mm Standard', 50, 25, true, '[{"field":"product_name","show":true},{"field":"sku","show":true},{"field":"size","show":true},{"field":"mrp","show":true},{"field":"barcode","show":true}]'),
  ('b09919f2-2b62-43bb-a579-222222222222', '75×50mm Label', 75, 50, false, '[{"field":"product_name","show":true},{"field":"sku","show":true},{"field":"size","show":true},{"field":"color","show":true},{"field":"mrp","show":true},{"field":"barcode","show":true}]'),
  ('b09919f2-2b62-43bb-a579-333333333333', '100×50mm Large', 100, 50, false, '[{"field":"brand","show":true},{"field":"product_name","show":true},{"field":"sku","show":true},{"field":"size","show":true},{"field":"color","show":true},{"field":"mrp","show":true},{"field":"hsn","show":true},{"field":"barcode","show":true}]')
ON CONFLICT (name) DO UPDATE SET width_mm = EXCLUDED.width_mm, height_mm = EXCLUDED.height_mm, fields = EXCLUDED.fields;

-- 7. Colors
INSERT INTO wms_colors (id, name, hex_code) VALUES
  ('c1010101-1111-1111-1111-111111111111', 'White', '#FFFFFF'),
  ('c1010101-2222-2222-2222-222222222222', 'Mint Green', '#98FF98'),
  ('c1010101-3333-3333-3333-333333333333', 'Yellow', '#FFFF00'),
  ('c1010101-4444-4444-4444-444444444444', 'Pink', '#FFC0CB'),
  ('c1010101-5555-5555-5555-555555555555', 'Blue', '#4169E1'),
  ('c1010101-6666-6666-6666-666666666666', 'Red', '#DC143C'),
  ('c1010101-7777-7777-7777-777777777777', 'Orange', '#FF8C00'),
  ('c1010101-8888-8888-8888-888888888888', 'Purple', '#9370DB'),
  ('c1010101-9999-9999-9999-999999999999', 'Grey', '#808080'),
  ('c1010101-0000-0000-0000-000000000000', 'Multicolor', '#000000')
ON CONFLICT (name) DO UPDATE SET hex_code = EXCLUDED.hex_code;
