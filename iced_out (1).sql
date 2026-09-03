-- ---------------------------------------------------------------------------
-- Iced_out — regenerated from your own phpMyAdmin export.
--
-- Your data, unchanged: every table, every column, every row that was in
-- `iced_out (1).sql`. What changed is how the schema is WRITTEN.
--
-- The export phpMyAdmin gave you left the ENGINE clause off 58 of the 88
-- tables — `users` and `carts` among them — so they were created with
-- whatever your server's default storage engine happens to be. On your host
-- that is not InnoDB, and MyISAM does not support foreign keys: every one of
-- the 116 ALTER TABLE ... ADD CONSTRAINT statements at the end of the file
-- then failed, starting with
--
--     #1215 - Cannot add foreign key constraint   (fk_carts_user)
--
-- It imported on the development machine only because XAMPP defaults to
-- InnoDB, which is exactly why the fault never showed up there.
--
-- This file states ENGINE=InnoDB and the utf8mb4 charset on every table
-- explicitly, and declares each foreign key inside its CREATE TABLE rather
-- than as a trailing ALTER, so nothing depends on server defaults or on
-- statement order. View DEFINER clauses are stripped too — recreating a view
-- owned by `root` needs SUPER, which a cPanel user does not have.
--
-- HOW TO IMPORT (cPanel)
--   phpMyAdmin -> select YOUR database on the left -> Import -> this file -> Go.
--   No CREATE DATABASE and no USE, so it lands in whichever you selected.
--   Import into an EMPTY database: drop and recreate it first.
--
-- ⚠ THE PASSWORDS IN THIS FILE ARE TIED TO YOUR DEVELOPMENT .env
--   Hashes are peppered with SESSION_SECRET. These were made with the value in
--   backend/.env (3f14caf1…), not the one in live/site/.env (d441557e…). Import
--   this and nobody can sign in until you copy that development SESSION_SECRET
--   into the live .env. `live/site/database/iced_out_live.sql` has no such
--   catch — its hash matches the .env that ships beside it.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET time_zone = '+00:00';

-- Foreign key checks OFF for the whole import, restored at the end.
--
-- mysqldump writes tables alphabetically, so `carts` is created ~2,600 lines
-- before `users`, the table its foreign key points at. Every mysqldump
-- restore relies on the checks being off for that. mysqldump does emit this,
-- but inside a /*!40014 ... */ version-conditional comment, which phpMyAdmin
-- skips — and then the import dies on `carts` with
--     #1215 - Cannot add foreign key constraint
-- Stated plainly here so no importer can mistake it for a comment.
SET FOREIGN_KEY_CHECKS = 0;

-- Dropped up front, before anything is created: a previous failed import can
-- leave tables behind as MyISAM, which cannot be the target of a foreign key.
DROP VIEW IF EXISTS `v_dashboard_queues`;
DROP VIEW IF EXISTS `v_order_timeline`;
DROP VIEW IF EXISTS `v_variant_availability`;
DROP TABLE IF EXISTS `activity_feed`;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `auth_tokens`;
DROP TABLE IF EXISTS `cart_items`;
DROP TABLE IF EXISTS `carts`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `checkout_drafts`;
DROP TABLE IF EXISTS `cms_blocks`;
DROP TABLE IF EXISTS `cms_page_versions`;
DROP TABLE IF EXISTS `cms_pages`;
DROP TABLE IF EXISTS `collection_products`;
DROP TABLE IF EXISTS `collections`;
DROP TABLE IF EXISTS `contact_messages`;
DROP TABLE IF EXISTS `coupon_redemptions`;
DROP TABLE IF EXISTS `coupons`;
DROP TABLE IF EXISTS `courier_pickups`;
DROP TABLE IF EXISTS `crm_activities`;
DROP TABLE IF EXISTS `crm_companies`;
DROP TABLE IF EXISTS `crm_contacts`;
DROP TABLE IF EXISTS `crm_deals`;
DROP TABLE IF EXISTS `crm_leads`;
DROP TABLE IF EXISTS `crm_notes`;
DROP TABLE IF EXISTS `crm_pipelines`;
DROP TABLE IF EXISTS `crm_stages`;
DROP TABLE IF EXISTS `domain_events_outbox`;
DROP TABLE IF EXISTS `faqs`;
DROP TABLE IF EXISTS `home_hero_slides`;
DROP TABLE IF EXISTS `idempotency_keys`;
DROP TABLE IF EXISTS `inbox_messages`;
DROP TABLE IF EXISTS `inventory_movements`;
DROP TABLE IF EXISTS `inventory_reservations`;
DROP TABLE IF EXISTS `inventory_transfer_items`;
DROP TABLE IF EXISTS `inventory_transfers`;
DROP TABLE IF EXISTS `job_queue`;
DROP TABLE IF EXISTS `login_attempts`;
DROP TABLE IF EXISTS `material_movements`;
DROP TABLE IF EXISTS `material_purchase_items`;
DROP TABLE IF EXISTS `material_purchases`;
DROP TABLE IF EXISTS `materials`;
DROP TABLE IF EXISTS `media_assets`;
DROP TABLE IF EXISTS `ndr_cases`;
DROP TABLE IF EXISTS `notification_preferences`;
DROP TABLE IF EXISTS `ops_signals`;
DROP TABLE IF EXISTS `order_cancellation_requests`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `order_status_history`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `payment_attempts`;
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `payouts`;
DROP TABLE IF EXISTS `permissions`;
DROP TABLE IF EXISTS `product_materials`;
DROP TABLE IF EXISTS `product_price_history`;
DROP TABLE IF EXISTS `product_rating_summaries`;
DROP TABLE IF EXISTS `product_variants`;
DROP TABLE IF EXISTS `production_run_materials`;
DROP TABLE IF EXISTS `production_runs`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `refunds`;
DROP TABLE IF EXISTS `return_requests`;
DROP TABLE IF EXISTS `return_status_history`;
DROP TABLE IF EXISTS `review_moderation_history`;
DROP TABLE IF EXISTS `reviews`;
DROP TABLE IF EXISTS `role_permissions`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `schema_migrations`;
DROP TABLE IF EXISTS `search_queries`;
DROP TABLE IF EXISTS `shipment_events`;
DROP TABLE IF EXISTS `shipment_labels`;
DROP TABLE IF EXISTS `shipments`;
DROP TABLE IF EXISTS `staff_activity_logs`;
DROP TABLE IF EXISTS `stock_item_photos`;
DROP TABLE IF EXISTS `stock_items`;
DROP TABLE IF EXISTS `store_settings`;
DROP TABLE IF EXISTS `suppliers`;
DROP TABLE IF EXISTS `support_queries`;
DROP TABLE IF EXISTS `support_status_history`;
DROP TABLE IF EXISTS `trading_days`;
DROP TABLE IF EXISTS `user_addresses`;
DROP TABLE IF EXISTS `user_roles`;
DROP TABLE IF EXISTS `user_sessions`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `variant_inventory`;
DROP TABLE IF EXISTS `vouchers`;
DROP TABLE IF EXISTS `wallet_accounts`;
DROP TABLE IF EXISTS `wallet_entries`;
DROP TABLE IF EXISTS `warehouses`;
DROP TABLE IF EXISTS `webhook_inbox`;


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `activity_feed`
--

DROP TABLE IF EXISTS `activity_feed`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `activity_feed` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `source` varchar(24) NOT NULL,
  `action` varchar(40) NOT NULL,
  `title` varchar(160) NOT NULL,
  `detail` varchar(255) NOT NULL DEFAULT '',
  `actor` varchar(80) NOT NULL DEFAULT '',
  `state` varchar(40) NOT NULL DEFAULT '',
  `tone` varchar(8) NOT NULL DEFAULT 'info',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_activity_feed_created` (`id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activity_feed`
--

/*!40000 ALTER TABLE `activity_feed` DISABLE KEYS */;
/*!40000 ALTER TABLE `activity_feed` ENABLE KEYS */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `audit_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `actor_id` bigint(20) unsigned DEFAULT NULL,
  `actor_role` varchar(32) NOT NULL DEFAULT '',
  `permission_used` varchar(64) NOT NULL DEFAULT '',
  `action` varchar(160) NOT NULL DEFAULT '',
  `entity_type` varchar(60) NOT NULL DEFAULT '',
  `entity_id` varchar(64) NOT NULL DEFAULT '',
  `before_json` mediumtext DEFAULT NULL,
  `after_json` mediumtext DEFAULT NULL,
  `request_id` varchar(64) NOT NULL DEFAULT '',
  `ip` varchar(45) NOT NULL DEFAULT '',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_audit_logs_actor` (`actor_id`,`created_at`),
  KEY `ix_audit_logs_entity` (`entity_type`,`entity_id`),
  KEY `ix_audit_logs_request` (`request_id`)
) ENGINE=InnoDB AUTO_INCREMENT=229 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` (`id`, `actor_id`, `actor_role`, `permission_used`, `action`, `entity_type`, `entity_id`, `before_json`, `after_json`, `request_id`, `ip`, `created_at`) VALUES (1,1,'ADMIN','media.upload','admin.media.upload','media','med-b0d91ad898174234',NULL,NULL,'f59e5f4a-3d7e-47c8-91a0-f87b0acbdc90','127.0.0.1','2026-08-17 12:18:13.511966'),(2,1,'ADMIN','media.upload','admin.media.upload','media','med-97d6fa0ff7221968',NULL,NULL,'340a13ca-21a2-4530-ac7d-110698c97ee4','127.0.0.1','2026-08-17 12:21:50.661472'),(3,1,'ADMIN','inventory.adjust','admin.inventory.items.create','stock_item','ITM-006',NULL,NULL,'01815cd5-26c6-434e-8476-ef6333627e47','127.0.0.1','2026-08-17 12:22:04.687343'),(4,1,'ADMIN','media.upload','admin.media.upload','media','med-462903260dd58605',NULL,NULL,'7f231ff4-287c-4e97-99a0-567fafb504b2','127.0.0.1','2026-08-17 12:44:34.798348'),(5,1,'ADMIN','catalog.edit','admin.catalog.products.update','product','afterdark-hoodie','{\"id\":\"afterdark-hoodie\",\"name\":\"Afterdark Hoodie\",\"item\":\"ITM-001\",\"size\":\"M\",\"sku\":\"WSB\",\"price\":\"₹8,900\",\"status\":\"Published\",\"category\":\"Knitwear\",\"collection\":\"Drop 001\",\"image\":\"\",\"description\":\"A dense, garment-washed hoodie cut with a dropped shoulder and deliberate weight.\"}','{\"id\":\"afterdark-hoodie\",\"name\":\"Afterdark Hoodie\",\"item\":\"ITM-001\",\"size\":\"M\",\"sku\":\"WSB\",\"price\":\"₹8,900\",\"status\":\"Published\",\"category\":\"Knitwear\",\"collection\":\"Drop 001\",\"image\":\"/api/v1/media/med-462903260dd58605\",\"description\":\"A dense, garment-washed hoodie cut with a dropped shoulder and deliberate weight.\"}','e0797db2-5ad3-4120-8e22-ebd9c95ad22c','127.0.0.1','2026-08-17 12:44:54.225982'),(6,1,'ADMIN','catalog.edit','admin.catalog.products.create','product','console-test-piece',NULL,NULL,'799e3cb0-9774-44e5-9cfd-80a6c212a04d','127.0.0.1','2026-08-17 12:45:12.175692'),(7,1,'ADMIN','catalog.edit','admin.catalog.products.delete','product','console-test-piece',NULL,NULL,'e8a7aa90-9642-44d4-81eb-90d30e97e324','127.0.0.1','2026-08-17 12:45:12.446236'),(8,1,'ADMIN','inventory.adjust','admin.inventory.items.update','stock_item','ITM-006','{\"id\":\"ITM-006\",\"itemName\":\"Nightshift Overcoat\",\"category\":\"Top\",\"itemType\":\"Jacket\",\"sizes\":\"S, M, L, XL\",\"warehouse\":\"BLR-01\",\"totalUnits\":\"14\",\"reservedUnits\":\"0\",\"image\":\"/api/v1/media/med-97d6fa0ff7221968\"}','{\"id\":\"ITM-006\",\"itemName\":\"Nightshift Overcoat\",\"category\":\"Top\",\"itemType\":\"Jacket\",\"sizes\":\"S, M, L, XL\",\"warehouse\":\"BLR-01\",\"totalUnits\":\"14\",\"reservedUnits\":\"0\",\"image\":\"/api/v1/media/med-97d6fa0ff7221968\"}','23c3af06-7f40-4acf-9241-8d9c95ddf03a','127.0.0.1','2026-08-18 07:33:17.180467'),(9,1,'ADMIN','inventory.adjust','admin.inventory.items.update','stock_item','ITM-006','{\"id\":\"ITM-006\",\"itemName\":\"Nightshift Overcoat\",\"category\":\"Top\",\"itemType\":\"Jacket\",\"sizes\":\"S, M, L, XL\",\"warehouse\":\"BLR-01\",\"totalUnits\":\"14\",\"reservedUnits\":\"0\",\"image\":\"/api/v1/media/med-97d6fa0ff7221968\"}','{\"id\":\"ITM-006\",\"itemName\":\"abc\",\"category\":\"Top\",\"itemType\":\"Jacket\",\"sizes\":\"S, M, L, XL\",\"warehouse\":\"BLR-01\",\"totalUnits\":\"14\",\"reservedUnits\":\"0\",\"image\":\"/api/v1/media/med-97d6fa0ff7221968\"}','c4dbbcf7-f443-43a6-9baa-2b4cfbdf7fa1','127.0.0.1','2026-08-18 07:33:51.366073'),(10,1,'ADMIN','inventory.adjust','admin.inventory.items.create','stock_item','ITM-033',NULL,NULL,'0f1ddf09-b7e2-479f-92e1-3d77ad6179ad','127.0.0.1','2026-08-18 07:43:24.756533'),(11,1,'ADMIN','catalog.edit','admin.catalog.products.create','product','audience-test-coat',NULL,NULL,'b8a08e43-d02b-4ef6-bf66-400cae2a49cc','127.0.0.1','2026-08-18 07:43:24.938676'),(12,1,'ADMIN','inventory.adjust','admin.inventory.items.update','stock_item','ITM-033','{\"id\":\"ITM-033\",\"itemName\":\"Audience Test Coat\",\"category\":\"Top\",\"audience\":\"Women\",\"itemType\":\"Jacket\",\"sizes\":\"S, M, L\",\"warehouse\":\"BLR-01\",\"totalUnits\":\"9\",\"reservedUnits\":\"0\",\"image\":\"\"}','{\"id\":\"ITM-033\",\"itemName\":\"Renamed Coat\",\"category\":\"Top\",\"audience\":\"Men\",\"itemType\":\"Jacket\",\"sizes\":\"S, M, L\",\"warehouse\":\"BLR-01\",\"totalUnits\":\"9\",\"reservedUnits\":\"0\",\"image\":\"\"}','4b375a23-cda0-42db-bf9e-a27ae0f689d6','127.0.0.1','2026-08-18 07:43:40.498220'),(13,1,'ADMIN','catalog.edit','admin.catalog.products.delete','product','audience-test-coat',NULL,NULL,'d6b54b39-6ab9-4614-b6f0-9e0186ab60a5','127.0.0.1','2026-08-18 07:43:54.853843'),(14,1,'ADMIN','inventory.adjust','admin.inventory.items.delete','stock_item','ITM-033',NULL,NULL,'45529211-9a1a-4d12-b8bb-42c1f6e39b20','127.0.0.1','2026-08-18 07:43:55.052077'),(15,1,'ADMIN','inventory.adjust','admin.inventory.items.update','stock_item','ITM-006','{\"id\":\"ITM-006\",\"itemName\":\"Nightshift Overcoat\",\"category\":\"Top\",\"audience\":\"Men\",\"itemType\":\"Jacket\",\"sizes\":\"S, M, L, XL\",\"warehouse\":\"BLR-01\",\"totalUnits\":\"14\",\"reservedUnits\":\"0\",\"image\":\"/api/v1/media/med-97d6fa0ff7221968\"}','{\"id\":\"ITM-006\",\"itemName\":\"Nightshift Overcoat\",\"category\":\"Top\",\"audience\":\"Men\",\"itemType\":\"Jacket\",\"sizes\":\"S, M, L, XL, XXL\",\"warehouse\":\"DEL-01\",\"totalUnits\":\"14\",\"reservedUnits\":\"0\",\"image\":\"/api/v1/media/med-97d6fa0ff7221968\"}','49f78691-1359-42e0-9d10-a829c986f1ce','127.0.0.1','2026-08-19 06:19:39.833894'),(16,1,'ADMIN','inventory.adjust','admin.inventory.items.update','stock_item','ITM-006','{\"id\":\"ITM-006\",\"itemName\":\"Nightshift Overcoat\",\"category\":\"Top\",\"audience\":\"Men\",\"itemType\":\"Jacket\",\"sizes\":\"S, M, L, XL, XXL\",\"warehouse\":\"DEL-01\",\"totalUnits\":\"14\",\"reservedUnits\":\"0\",\"image\":\"/api/v1/media/med-97d6fa0ff7221968\"}','{\"id\":\"ITM-006\",\"itemName\":\"abc\",\"category\":\"Top\",\"audience\":\"Men\",\"itemType\":\"Jacket\",\"sizes\":\"S, M, L, XL, XXL\",\"warehouse\":\"DEL-01\",\"totalUnits\":\"14\",\"reservedUnits\":\"0\",\"image\":\"/api/v1/media/med-97d6fa0ff7221968\"}','4e924d06-4097-4b24-b513-0bbeb8913f6b','127.0.0.1','2026-08-19 06:19:55.605780'),(17,1,'ADMIN','catalog.edit','admin.catalog.products.create','product','abc',NULL,NULL,'3e9fc8db-336e-4d62-bb1a-160b0ee50dcc','127.0.0.1','2026-08-19 06:24:33.885174'),(18,1,'ADMIN','catalog.edit','admin.catalog.products.update','product','afterdark-hoodie','{\"id\":\"afterdark-hoodie\",\"name\":\"Afterdark Hoodie\",\"item\":\"ITM-001\",\"size\":\"M\",\"sku\":\"WSB\",\"price\":\"₹8,900\",\"status\":\"Published\",\"category\":\"Knitwear\",\"collection\":\"Drop 001\",\"image\":\"/api/v1/media/med-462903260dd58605\",\"description\":\"A dense, garment-washed hoodie cut with a dropped shoulder and deliberate weight.\"}','{\"id\":\"afterdark-hoodie\",\"name\":\"Afterdark Hoodie\",\"item\":\"ITM-001\",\"size\":\"M\",\"sku\":\"WSB\",\"price\":\"₹8,900\",\"status\":\"Draft\",\"category\":\"Knitwear\",\"collection\":\"Drop 001\",\"image\":\"/api/v1/media/med-462903260dd58605\",\"description\":\"A dense, garment-washed hoodie cut with a dropped shoulder and deliberate weight.\"}','74783fe3-b991-4edb-9f01-e71701fda657','127.0.0.1','2026-08-19 06:25:23.544032'),(19,1,'ADMIN','catalog.edit','admin.catalog.products.update','product','nightshift-overcoat','{\"id\":\"nightshift-overcoat\",\"name\":\"abc\",\"item\":\"ITM-006\",\"size\":\"L\",\"sku\":\"SLT\",\"price\":\"₹18,600\",\"status\":\"Published\",\"category\":\"Outerwear\",\"collection\":\"After Hours\",\"image\":\"/api/v1/media/med-a7ce235624eae837\",\"description\":\"A full-length overcoat with a concealed placket and a shoulder cut to carry weight.\"}','{\"id\":\"nightshift-overcoat\",\"name\":\"abc\",\"item\":\"ITM-006\",\"size\":\"L\",\"sku\":\"SLT\",\"price\":\"₹18,600\",\"status\":\"Draft\",\"category\":\"Outerwear\",\"collection\":\"After Hours\",\"image\":\"/api/v1/media/med-a7ce235624eae837\",\"description\":\"A full-length overcoat with a concealed placket and a shoulder cut to carry weight.\"}','51ea703a-9430-462b-ae31-83e33e666753','127.0.0.1','2026-08-19 06:25:34.997676'),(20,1,'ADMIN','catalog.edit','admin.catalog.products.update','product','afterdark-hoodie','{\"id\":\"afterdark-hoodie\",\"name\":\"Afterdark Hoodie\",\"item\":\"ITM-001\",\"size\":\"M\",\"sku\":\"WSB\",\"price\":\"₹8,900\",\"status\":\"Draft\",\"category\":\"Knitwear\",\"collection\":\"Drop 001\",\"image\":\"/api/v1/media/med-462903260dd58605\",\"description\":\"A dense, garment-washed hoodie cut with a dropped shoulder and deliberate weight.\"}','{\"id\":\"afterdark-hoodie\",\"name\":\"Afterdark Hoodie\",\"item\":\"ITM-001\",\"size\":\"M\",\"sku\":\"WSB\",\"price\":\"₹8,900\",\"status\":\"Published\",\"category\":\"Knitwear\",\"collection\":\"Drop 001\",\"image\":\"/api/v1/media/med-462903260dd58605\",\"description\":\"A dense, garment-washed hoodie cut with a dropped shoulder and deliberate weight.\"}','4fe8301c-fa7c-4f23-99af-b58b5122ea5b','127.0.0.1','2026-08-19 06:42:43.644925'),(21,1,'ADMIN','catalog.edit','admin.catalog.products.update','product','afterdark-hoodie','{\"id\":\"afterdark-hoodie\",\"name\":\"Afterdark Hoodie\",\"item\":\"ITM-001\",\"size\":\"M\",\"sku\":\"WSB\",\"price\":\"₹8,900\",\"status\":\"Published\",\"category\":\"Knitwear\",\"collection\":\"Drop 001\",\"image\":\"/api/v1/media/med-462903260dd58605\",\"description\":\"A dense, garment-washed hoodie cut with a dropped shoulder and deliberate weight.\"}','{\"id\":\"afterdark-hoodie\",\"name\":\"Afterdark Hoodie\",\"item\":\"ITM-001\",\"size\":\"M\",\"sku\":\"WSB\",\"price\":\"₹8,900\",\"status\":\"Draft\",\"category\":\"Knitwear\",\"collection\":\"Drop 001\",\"image\":\"/api/v1/media/med-462903260dd58605\",\"description\":\"A dense, garment-washed hoodie cut with a dropped shoulder and deliberate weight.\"}','3b832221-1a1e-45a5-8267-b91b2d3227d0','127.0.0.1','2026-08-19 06:42:43.896758'),(22,1,'ADMIN','catalog.edit','admin.catalog.products.update','product','bone-utility-overshirt','{\"id\":\"bone-utility-overshirt\",\"name\":\"Bone Utility Overshirt\",\"item\":\"ITM-002\",\"size\":\"S\",\"sku\":\"BON\",\"price\":\"₹11,400\",\"status\":\"Published\",\"category\":\"Outerwear\",\"collection\":\"Drop 001\",\"image\":\"/api/v1/media/med-cf2ef45d933f7a78\",\"description\":\"A four-pocket overshirt with a clean collar, boxy body, and hardware built to age.\"}','{\"id\":\"bone-utility-overshirt\",\"name\":\"Bone Utility Overshirt\",\"item\":\"ITM-002\",\"size\":\"S\",\"sku\":\"BON\",\"price\":\"₹11,400\",\"status\":\"Draft\",\"category\":\"Outerwear\",\"collection\":\"Drop 001\",\"image\":\"/api/v1/media/med-cf2ef45d933f7a78\",\"description\":\"A four-pocket overshirt with a clean collar, boxy body, and hardware built to age.\"}','95a44fa9-a23c-4327-894a-41b9827fed3f','127.0.0.1','2026-08-19 06:45:53.047873'),(23,1,'ADMIN','catalog.edit','admin.catalog.products.update','product','shadow-cargo-02','{\"id\":\"shadow-cargo-02\",\"name\":\"Shadow Cargo 02\",\"item\":\"ITM-003\",\"size\":\"32\",\"sku\":\"CHR\",\"price\":\"₹9,800\",\"status\":\"Published\",\"category\":\"Trousers\",\"collection\":\"Drop 001\",\"image\":\"/api/v1/media/med-f9f466d95b84b472\",\"description\":\"A wide-leg cargo balanced by articulated knees and low-profile storage.\"}','{\"id\":\"shadow-cargo-02\",\"name\":\"Shadow Cargo 02\",\"item\":\"ITM-003\",\"size\":\"32\",\"sku\":\"CHR\",\"price\":\"₹9,800\",\"status\":\"Draft\",\"category\":\"Trousers\",\"collection\":\"Drop 001\",\"image\":\"/api/v1/media/med-f9f466d95b84b472\",\"description\":\"A wide-leg cargo balanced by articulated knees and low-profile storage.\"}','4ff7ecfd-7031-4dc0-90f7-18a669521df8','127.0.0.1','2026-08-19 06:46:02.801400'),(24,1,'ADMIN','catalog.edit','admin.catalog.products.update','product','core-heavy-tee','{\"id\":\"core-heavy-tee\",\"name\":\"Core Heavy Tee\",\"item\":\"ITM-004\",\"size\":\"M\",\"sku\":\"INK\",\"price\":\"₹4,600\",\"status\":\"Published\",\"category\":\"Tops\",\"collection\":\"Core Uniform\",\"image\":\"/api/v1/media/med-a5da6a27bc466769\",\"description\":\"A compact jersey tee with a clean neck, dropped shoulder, and permanent structure.\"}','{\"id\":\"core-heavy-tee\",\"name\":\"Core Heavy Tee\",\"item\":\"ITM-004\",\"size\":\"M\",\"sku\":\"INK\",\"price\":\"₹4,600\",\"status\":\"Draft\",\"category\":\"Tops\",\"collection\":\"Core Uniform\",\"image\":\"/api/v1/media/med-a5da6a27bc466769\",\"description\":\"A compact jersey tee with a clean neck, dropped shoulder, and permanent structure.\"}','98a52ecd-e4eb-4905-8e4b-7270b4146da7','127.0.0.1','2026-08-19 06:46:59.460981'),(25,1,'ADMIN','media.upload','admin.media.upload','media','med-fb89976c3210ae89',NULL,NULL,'770631e3-7c98-4222-a8e4-df8f7ff7083a','127.0.0.1','2026-08-19 07:01:20.368420'),(26,1,'ADMIN','catalog.edit','admin.catalog.products.update','product','abc','{\"id\":\"abc\",\"name\":\"abc\",\"item\":\"ITM-006\",\"size\":\"S\",\"sku\":\"ABC\",\"price\":\"₹5,000\",\"status\":\"Published\",\"category\":\"Outerwear\",\"collection\":\"Drop 001\",\"image\":\"\"}','{\"id\":\"abc\",\"name\":\"abc\",\"item\":\"ITM-006\",\"size\":\"S\",\"sku\":\"ABC\",\"price\":\"₹5,000\",\"status\":\"Published\",\"category\":\"Outerwear\",\"collection\":\"Drop 001\",\"image\":\"\"}','95b12111-79b1-4738-b23b-24380e6d06c3','127.0.0.1','2026-08-19 07:01:21.801457'),(27,1,'ADMIN','media.upload','admin.media.upload','media','med-1558e79a53d7b5bb',NULL,NULL,'0c348f70-2f9d-4869-8afe-0c583182a226','127.0.0.1','2026-08-19 07:56:57.241458'),(28,1,'ADMIN','media.upload','admin.media.upload','media','med-12498f86d09210f7',NULL,NULL,'d33ff591-4b50-42fd-9e1b-14797b85e573','127.0.0.1','2026-08-19 07:58:11.047172'),(29,1,'ADMIN','media.upload','admin.media.upload','media','med-0353f2f4068b21aa',NULL,NULL,'d91ec173-89d4-4b6c-aab0-3d71101f342b','127.0.0.1','2026-08-19 07:58:11.265360'),(30,1,'ADMIN','media.upload','admin.media.upload','media','med-413006cd06ecf9d4',NULL,NULL,'21347839-e207-4ba3-9506-b2cd52cbd3f8','127.0.0.1','2026-08-19 07:58:12.277598'),(31,1,'ADMIN','media.upload','admin.media.upload','media','med-6643499ed4e919ba',NULL,NULL,'f2eef28e-abba-4b52-ac87-f31417296278','127.0.0.1','2026-08-19 07:58:12.545801'),(32,1,'ADMIN','inventory.adjust','admin.inventory.items.create','stock_item','ITM-034',NULL,NULL,'5d261dfa-f720-46c1-aa30-0731c2b0ca73','127.0.0.1','2026-08-19 07:59:19.585697'),(33,1,'ADMIN','catalog.edit','admin.catalog.products.update','product','demo-product','{\"id\":\"demo-product\",\"name\":\"demo product\",\"item\":\"ITM-034\",\"size\":\"30\",\"sku\":\"DMP\",\"price\":\"₹5,000\",\"status\":\"Published\",\"category\":\"Jeans\",\"collection\":\"\",\"image\":\"/api/v1/media/med-1558e79a53d7b5bb\"}','{\"id\":\"demo-product\",\"name\":\"demo product\",\"item\":\"ITM-034\",\"size\":\"30\",\"sku\":\"DMP\",\"price\":\"₹5,000\",\"status\":\"Published\",\"category\":\"Outerwear\",\"collection\":\"\",\"image\":\"/api/v1/media/med-1558e79a53d7b5bb\",\"tax\":\"Apparel · 12%\"}','c1d6019a-df3e-4a95-bb43-620f41ccbd83','127.0.0.1','2026-08-19 08:44:47.687721'),(34,1,'ADMIN','inventory.adjust','admin.inventory.items.update','stock_item','ITM-034','{\"id\":\"ITM-034\",\"itemName\":\"demo product\",\"category\":\"Bottom\",\"audience\":\"Unisex\",\"itemType\":\"Jeans\",\"sizes\":\"30, 32, 34, 36\",\"price\":\"₹5,000\",\"warehouse\":\"BLR-01\",\"totalUnits\":\"20\",\"reservedUnits\":\"0\",\"image\":\"/api/v1/media/med-1558e79a53d7b5bb\",\"images\":\"/api/v1/media/med-12498f86d09210f7, /api/v1/media/med-0353f2f4068b21aa, /api/v1/media/med-413006cd06ecf9d4, /api/v1/media/med-6643499ed4e919ba\"}','{\"id\":\"ITM-034\",\"itemName\":\"demo product\",\"category\":\"Bottom\",\"audience\":\"Unisex\",\"itemType\":\"Jeans\",\"sizes\":\"30, 32, 34, 36\",\"price\":\"₹5,000\",\"warehouse\":\"BLR-01\",\"totalUnits\":\"20\",\"reservedUnits\":\"0\",\"image\":\"/api/v1/media/med-1558e79a53d7b5bb\",\"images\":\"/api/v1/media/med-0353f2f4068b21aa, /api/v1/media/med-12498f86d09210f7, /api/v1/media/med-413006cd06ecf9d4, /api/v1/media/med-6643499ed4e919ba\"}','874aabcf-1cc7-4957-9fd3-1c1fd0cb7890','127.0.0.1','2026-08-19 08:44:47.892513'),(35,1,'ADMIN','catalog.edit','admin.catalog.products.update','product','demo-product','{\"id\":\"demo-product\",\"name\":\"demo product\",\"item\":\"ITM-034\",\"size\":\"30\",\"sku\":\"DMP\",\"price\":\"₹5,000\",\"status\":\"Published\",\"category\":\"Outerwear\",\"collection\":\"\",\"image\":\"/api/v1/media/med-1558e79a53d7b5bb\",\"tax\":\"Apparel · 12%\"}','{\"id\":\"demo-product\",\"name\":\"demo product\",\"item\":\"ITM-034\",\"size\":\"30\",\"sku\":\"DMP\",\"price\":\"₹5,000\",\"status\":\"Published\",\"category\":\"Outerwear\",\"collection\":\"\",\"image\":\"/api/v1/media/med-1558e79a53d7b5bb\",\"tax\":\"Apparel · 12%\"}','56cd6b0c-4617-41b7-a09f-9d8ad4524f16','127.0.0.1','2026-08-19 08:44:52.449309'),(36,1,'ADMIN','inventory.adjust','admin.inventory.items.update','stock_item','ITM-034','{\"id\":\"ITM-034\",\"itemName\":\"demo product\",\"category\":\"Bottom\",\"audience\":\"Unisex\",\"itemType\":\"Jeans\",\"sizes\":\"30, 32, 34, 36\",\"price\":\"₹5,000\",\"warehouse\":\"BLR-01\",\"totalUnits\":\"20\",\"reservedUnits\":\"0\",\"image\":\"/api/v1/media/med-1558e79a53d7b5bb\",\"images\":\"/api/v1/media/med-0353f2f4068b21aa, /api/v1/media/med-12498f86d09210f7, /api/v1/media/med-413006cd06ecf9d4, /api/v1/media/med-6643499ed4e919ba\"}','{\"id\":\"ITM-034\",\"itemName\":\"demo product\",\"category\":\"Bottom\",\"audience\":\"Unisex\",\"itemType\":\"Jeans\",\"sizes\":\"30, 32, 34, 36\",\"price\":\"₹5,000\",\"warehouse\":\"BLR-01\",\"totalUnits\":\"20\",\"reservedUnits\":\"0\",\"image\":\"/api/v1/media/med-1558e79a53d7b5bb\",\"images\":\"/api/v1/media/med-12498f86d09210f7, /api/v1/media/med-0353f2f4068b21aa, /api/v1/media/med-413006cd06ecf9d4, /api/v1/media/med-6643499ed4e919ba\"}','5a0ee3c9-45b5-4bcd-b2db-f1247375267c','127.0.0.1','2026-08-19 08:44:52.613419'),(37,1,'ADMIN','orders.manage','admin.orders.confirm','order','IO-2026-1049','{\"id\":\"IO-2026-1049\",\"customer\":\"Tirth\",\"items\":\"1\",\"value\":\"9800\",\"payment\":\"Pending\",\"method\":\"Cash on delivery\",\"status\":\"Placed\",\"destination\":\"surat\",\"age\":\"1 d 23 h\"}','{\"id\":\"IO-2026-1049\",\"customer\":\"Tirth\",\"items\":\"1\",\"value\":\"9800\",\"payment\":\"Pending\",\"method\":\"Cash on delivery\",\"status\":\"Confirmed\",\"destination\":\"surat\",\"age\":\"1 d 23 h\"}','9e399a17-0f22-4569-9aee-0a90695d49ba','127.0.0.1','2026-08-19 09:43:20.149047'),(38,1,'ADMIN','orders.manage','admin.orders.confirm','order','IO-2026-1050','{\"id\":\"IO-2026-1050\",\"customer\":\"Tirth\",\"items\":\"1\",\"value\":\"5000\",\"payment\":\"Pending\",\"method\":\"Cash on delivery\",\"status\":\"Placed\",\"destination\":\"surat\",\"age\":\"0 h 01 min\"}','{\"id\":\"IO-2026-1050\",\"customer\":\"Tirth\",\"items\":\"1\",\"value\":\"5000\",\"payment\":\"Pending\",\"method\":\"Cash on delivery\",\"status\":\"Confirmed\",\"destination\":\"surat\",\"age\":\"0 h 01 min\"}','3baf0dd9-6f5a-4d4d-81a9-5ab55a962ab6','127.0.0.1','2026-08-19 09:43:24.967900'),(39,1,'ADMIN','reviews.moderate','admin.reviews.approve','review','REV-2001',NULL,NULL,'69544967-4ff7-4e20-ad9b-7685d4f5a3ce','127.0.0.1','2026-08-19 11:50:04.244931'),(40,1,'ADMIN','reviews.moderate','admin.reviews.hide','review','REV-2002',NULL,NULL,'4cdaa88a-9f46-4af4-b412-94293c5117a8','127.0.0.1','2026-08-19 12:03:31.691433'),(41,1,'ADMIN','reviews.moderate','admin.reviews.publish','review','REV-2002',NULL,NULL,'121a5a3a-c164-498e-8173-893250a5b3e2','127.0.0.1','2026-08-19 12:04:21.762091'),(42,1,'ADMIN','reviews.moderate','admin.reviews.delete','review','REV-2002','{\"id\":\"REV-2002\",\"product\":\"demo product\",\"productSlug\":\"demo-product\",\"rating\":\"4\",\"customer\":\"Publish Direct\",\"headline\":\"Straight onto the page\",\"body\":\"No waiting around for a moderator.\",\"fit\":\"True to size\",\"submitted\":\"19 Aug 2026\",\"status\":\"Published\",\"origin\":\"Customer\"}',NULL,'88961b89-5f94-4286-ae92-0b893f4c8bb0','127.0.0.1','2026-08-19 12:04:26.319066'),(43,1,'ADMIN','support.tickets.manage','admin.support.resolve','support_query','IO-Q-1005',NULL,NULL,'4bd9a1ba-1aa1-4df9-a0f4-e01ece95165d','127.0.0.1','2026-08-19 14:34:48.543771'),(44,1,'ADMIN','support.tickets.manage','admin.support.resolve','support_query','IO-Q-1004',NULL,NULL,'2e4bb6a3-da78-4526-aff8-6885d2f97b94','127.0.0.1','2026-08-19 14:34:58.319822'),(45,1,'ADMIN','support.tickets.manage','admin.support.resolve','support_query','IO-Q-1006',NULL,NULL,'faedd634-d019-4d1e-8998-f36ad8fa2ad3','127.0.0.1','2026-08-20 06:08:06.901277'),(46,1,'ADMIN','media.upload','admin.media.upload','media','med-8808873320c629f9',NULL,NULL,'9c88a1bd-13b2-498a-b9d0-f664bdfc7832','127.0.0.1','2026-08-21 06:41:16.010077'),(47,1,'ADMIN','cms.manage','admin.home.hero.create','home_hero_slide','hero-3308d12afa5e',NULL,NULL,'17b4a980-0005-4964-b041-3700f469ef09','127.0.0.1','2026-08-21 06:41:41.384398'),(48,1,'ADMIN','cms.manage','admin.home.hero.update','home_hero_slide','hero-3308d12afa5e',NULL,NULL,'615b09a5-3f68-4233-a419-2507a2530248','127.0.0.1','2026-08-21 06:41:51.734222'),(49,1,'ADMIN','cms.manage','admin.home.hero.cutout','home_hero_slide','hero-3308d12afa5e',NULL,NULL,'271b6787-ea79-4c07-a360-f9a9d7a4943e','127.0.0.1','2026-08-21 06:41:51.812020'),(50,1,'ADMIN','cms.manage','admin.home.hero.reorder','home_hero_slide','hero-3308d12afa5e',NULL,NULL,'d11a3c7c-1075-4349-a66b-0431e377f7d3','127.0.0.1','2026-08-21 06:41:51.914775'),(51,1,'ADMIN','cms.manage','admin.home.hero.delete','home_hero_slide','hero-3308d12afa5e',NULL,NULL,'cbe8afdc-54ac-4fc2-8bcb-87d26e89b15f','127.0.0.1','2026-08-21 06:54:59.921625'),(52,1,'ADMIN','media.upload','admin.media.upload','media','med-0fde3680ad88f8d4',NULL,NULL,'fd30644c-f9b2-4337-859d-d0ddca3ddd2b','127.0.0.1','2026-08-21 06:59:43.055814'),(53,1,'ADMIN','cms.manage','admin.home.hero.create','home_hero_slide','hero-680f0317721e',NULL,NULL,'b52f57ec-4d4b-43dc-8dac-dc7b9eee83d8','127.0.0.1','2026-08-21 06:59:43.152521'),(54,1,'ADMIN','media.upload','admin.media.upload','media','med-17b270e1d1a07883',NULL,NULL,'fc1a1aaf-389f-4a85-9dbb-fa52a142906d','127.0.0.1','2026-08-21 06:59:44.785364'),(55,1,'ADMIN','cms.manage','admin.home.hero.create','home_hero_slide','hero-d1757c8ee335',NULL,NULL,'836cfbd0-28d7-4e15-8dac-85a79243fe26','127.0.0.1','2026-08-21 06:59:44.912762'),(56,1,'ADMIN','cms.manage','admin.home.hero.delete','home_hero_slide','hero-680f0317721e',NULL,NULL,'181232aa-2102-46fd-b8aa-276e8f3bc6bc','127.0.0.1','2026-08-21 07:01:50.628835'),(57,1,'ADMIN','cms.manage','admin.home.hero.delete','home_hero_slide','hero-d1757c8ee335',NULL,NULL,'776fcbff-bcea-4329-8b23-61aab367aa48','127.0.0.1','2026-08-21 07:01:50.711828'),(58,1,'ADMIN','cms.manage','admin.home.hero.create','home_hero_slide','hero-178370fbeba3',NULL,NULL,'6269cc07-98fe-47c4-8eeb-b477e5257dea','127.0.0.1','2026-08-21 07:30:49.372036'),(59,1,'ADMIN','cms.manage','admin.home.hero.update','home_hero_slide','hero-178370fbeba3',NULL,NULL,'afab34ff-686a-4c3e-9fee-095e966736d5','127.0.0.1','2026-08-21 07:32:45.452166'),(60,1,'ADMIN','cms.manage','admin.home.hero.update','home_hero_slide','hero-178370fbeba3',NULL,NULL,'965f8f02-63dd-4b4a-b064-a5e0d153ad51','127.0.0.1','2026-08-21 07:32:47.658068'),(61,1,'ADMIN','cms.manage','admin.home.hero.create','home_hero_slide','hero-cc6ef6337964',NULL,NULL,'7096347b-b9f4-4385-9c63-aa9251fd4f1e','127.0.0.1','2026-08-21 07:37:44.337988'),(62,1,'ADMIN','cms.manage','admin.home.hero.create','home_hero_slide','hero-b431b65179b8',NULL,NULL,'d77e662b-e5c2-40a2-a705-51186bfe892c','127.0.0.1','2026-08-21 07:38:25.133698'),(63,1,'ADMIN','cms.manage','admin.home.hero.cutout','home_hero_slide','hero-178370fbeba3',NULL,NULL,'cddd3518-0598-4bb2-915e-aaad69f635ac','127.0.0.1','2026-08-21 07:41:28.977363'),(64,1,'ADMIN','cms.manage','admin.home.hero.cutout','home_hero_slide','hero-cc6ef6337964',NULL,NULL,'80571b30-725c-4d5f-a173-05aa078a3b2f','127.0.0.1','2026-08-21 07:41:32.386584'),(65,1,'ADMIN','cms.manage','admin.home.hero.cutout','home_hero_slide','hero-b431b65179b8',NULL,NULL,'7b120682-a06f-4f4b-afe0-da8568e7e42a','127.0.0.1','2026-08-21 07:41:36.595460'),(66,1,'ADMIN','cms.manage','admin.home.hero.update','home_hero_slide','hero-cc6ef6337964',NULL,NULL,'5ecb068d-fdcc-4884-87d8-f35bcde89e3e','127.0.0.1','2026-08-21 07:43:24.715694'),(67,1,'ADMIN','cms.manage','admin.home.hero.update','home_hero_slide','hero-b431b65179b8',NULL,NULL,'b5a71ed6-09e4-4a92-a722-26db726a22b0','127.0.0.1','2026-08-21 07:43:26.665451'),(68,1,'ADMIN','cms.manage','admin.home.hero.delete','home_hero_slide','hero-178370fbeba3',NULL,NULL,'436187c4-bf44-4a81-a2dc-efffd00d3c27','127.0.0.1','2026-08-21 08:08:19.228055'),(69,1,'ADMIN','cms.manage','admin.home.hero.delete','home_hero_slide','hero-b431b65179b8',NULL,NULL,'a3e3ccb0-2042-43ba-9181-999525cf1c0c','127.0.0.1','2026-08-21 08:08:24.835251'),(70,1,'ADMIN','cms.manage','admin.home.hero.delete','home_hero_slide','hero-cc6ef6337964',NULL,NULL,'571bcd42-2fa9-46bc-b1f7-fc28a6957dd6','127.0.0.1','2026-08-21 08:08:28.179854'),(71,1,'ADMIN','media.upload','admin.media.upload','media','med-769ec38502476cf7',NULL,NULL,'d32ac1d0-1051-4b5f-a33c-8e2e82f59923','127.0.0.1','2026-08-21 08:10:12.537078'),(72,1,'ADMIN','cms.manage','admin.home.hero.create','home_hero_slide','hero-cea9c0cc4272',NULL,NULL,'7f0a79ff-56b3-4a25-93f4-b64c7c70934f','127.0.0.1','2026-08-21 08:10:24.100441'),(73,1,'ADMIN','catalog.edit','admin.catalog.products.update','product','demo-product','{\"id\":\"demo-product\",\"name\":\"demo product\",\"item\":\"ITM-034\",\"size\":\"30\",\"sku\":\"DMP\",\"price\":\"₹5,000\",\"status\":\"Published\",\"category\":\"Outerwear\",\"collection\":\"\",\"image\":\"/api/v1/media/med-1558e79a53d7b5bb\",\"tax\":\"Apparel · 12%\"}','{\"id\":\"demo-product\",\"name\":\"demo product\",\"item\":\"ITM-034\",\"size\":\"30\",\"sku\":\"DMP\",\"price\":\"₹5,000\",\"status\":\"Published\",\"category\":\"Outerwear\",\"collection\":\"\",\"image\":\"/api/v1/media/med-1558e79a53d7b5bb\",\"tax\":\"Apparel · 12%\"}','8401e9df-a1ae-4b97-a9de-95df59e5a53e','127.0.0.1','2026-08-21 08:12:42.000125'),(74,1,'ADMIN','inventory.adjust','admin.inventory.items.update','stock_item','ITM-034','{\"id\":\"ITM-034\",\"itemName\":\"demo product\",\"category\":\"Bottom\",\"audience\":\"Unisex\",\"itemType\":\"Jeans\",\"sizes\":\"30, 32, 34, 36\",\"price\":\"₹5,000\",\"warehouse\":\"BLR-01\",\"totalUnits\":\"20\",\"reservedUnits\":\"0\",\"image\":\"/api/v1/media/med-1558e79a53d7b5bb\",\"images\":\"/api/v1/media/med-12498f86d09210f7, /api/v1/media/med-0353f2f4068b21aa, /api/v1/media/med-413006cd06ecf9d4, /api/v1/media/med-6643499ed4e919ba\"}','{\"id\":\"ITM-034\",\"itemName\":\"demo product\",\"category\":\"Bottom\",\"audience\":\"Unisex\",\"itemType\":\"Jeans\",\"sizes\":\"30, 32, 34, 36\",\"price\":\"₹5,000\",\"warehouse\":\"BLR-01\",\"totalUnits\":\"20\",\"reservedUnits\":\"0\",\"image\":\"/api/v1/media/med-1558e79a53d7b5bb\",\"images\":\"\"}','5143dae6-0a7f-45a7-8758-d5d3d75418c7','127.0.0.1','2026-08-21 08:12:42.401626'),(75,1,'ADMIN','cms.manage','admin.home.hero.delete','home_hero_slide','hero-cea9c0cc4272',NULL,NULL,'627f1c59-59c4-4e57-9144-a84f76270d90','127.0.0.1','2026-08-21 08:15:10.368712'),(76,1,'ADMIN','orders.manage','admin.orders.cancel','order','IO-2026-1051','{\"id\":\"IO-2026-1051\",\"customer\":\"Tirth\",\"items\":\"1\",\"value\":\"13900\",\"payment\":\"Pending\",\"method\":\"Cash on delivery\",\"status\":\"Placed\",\"destination\":\"Surat\",\"age\":\"0 h 10 min\"}','{\"id\":\"IO-2026-1051\",\"customer\":\"Tirth\",\"items\":\"1\",\"value\":\"13900\",\"payment\":\"Pending\",\"method\":\"Cash on delivery\",\"status\":\"Cancelled\",\"destination\":\"Surat\",\"age\":\"0 h 10 min\",\"cancelledBy\":\"Store\"}','6d6350d0-8850-471b-9dfa-1bd619b14cab','127.0.0.1','2026-08-24 06:58:02.380810'),(77,1,'ADMIN','orders.manage','admin.orders.cancel','order','IO-2026-1053','{\"id\":\"IO-2026-1053\",\"customer\":\"Tirth\",\"items\":\"1\",\"value\":\"5000\",\"payment\":\"Captured\",\"method\":\"Razorpay · Card / UPI / Netbanking\",\"status\":\"Placed\",\"destination\":\"Surat\",\"age\":\"0 h 01 min\"}','{\"id\":\"IO-2026-1053\",\"customer\":\"Tirth\",\"items\":\"1\",\"value\":\"5000\",\"payment\":\"Captured\",\"method\":\"Razorpay · Card / UPI / Netbanking\",\"status\":\"Cancelled\",\"destination\":\"Surat\",\"age\":\"0 h 01 min\",\"cancelledBy\":\"Store\"}','e0f425dc-e28e-4cb5-b005-7bb3fde8bf76','127.0.0.1','2026-08-24 07:39:43.804718'),(78,1,'ADMIN','coupons.manage','admin.vouchers.create','voucher','IOV001',NULL,NULL,'2c35230b-fd7b-4a3f-8bbe-dbbc783f0c46','127.0.0.1','2026-08-25 06:46:41.505894'),(79,1,'ADMIN','coupons.manage','admin.vouchers.create','voucher','IOV001',NULL,NULL,'d8c0e0f5-3e9d-4995-9dbc-152060be4b0b','127.0.0.1','2026-08-25 06:58:30.601706'),(80,1,'ADMIN','coupons.manage','admin.vouchers.create','voucher','IOV002',NULL,NULL,'50972c42-af32-40a7-a881-b785d3155e9b','127.0.0.1','2026-08-25 07:11:35.557955'),(81,1,'ADMIN','crm.manage','admin.crm.leads.store','crm_lead','lead-0001',NULL,NULL,'56a3ba6d-6678-4574-b196-b9d1aa6b0937','127.0.0.1','2026-08-25 13:34:54.404596'),(82,1,'ADMIN','crm.manage','admin.crm.leads.update','crm_lead','lead-0001',NULL,NULL,'42d70249-acfd-4cb3-a373-f56f140a537c','127.0.0.1','2026-08-25 13:34:54.449311'),(83,1,'ADMIN','crm.manage','admin.crm.leads.convert','crm_lead','lead-0001',NULL,NULL,'342acb5b-2c9d-46f7-9cd8-3a191300e557','127.0.0.1','2026-08-25 13:34:54.499422'),(84,1,'ADMIN','crm.manage','admin.crm.notes.store','crm_note','note-00001',NULL,NULL,'2a0901e3-8529-4c52-b1ed-05b4383d4b10','127.0.0.1','2026-08-25 13:34:54.548445'),(85,1,'ADMIN','crm.manage','admin.crm.activities.store','crm_activity','act-00001',NULL,NULL,'c4fe42b3-3cda-4515-a696-afada58be0e1','127.0.0.1','2026-08-25 13:34:54.563772'),(86,1,'ADMIN','crm.manage','admin.crm.activities.complete','crm_activity','act-00001',NULL,NULL,'90f61892-ddb9-4dd5-850d-866f4668e931','127.0.0.1','2026-08-25 13:34:54.582813'),(87,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0001',NULL,NULL,'b99f7330-e082-43a3-934f-ece2deed7e72','127.0.0.1','2026-08-25 13:34:54.622906'),(88,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0001',NULL,NULL,'5131bbaa-0e5f-40e5-9949-29b077581691','127.0.0.1','2026-08-25 13:34:54.641912'),(89,1,'ADMIN','crm.manage','admin.crm.deals.destroy','crm_deal','deal-0001',NULL,NULL,'65ad0390-23c1-465e-b6f1-e61fa4ef2ae5','127.0.0.1','2026-08-25 13:34:54.694893'),(90,1,'ADMIN','crm.manage','admin.crm.contacts.destroy','crm_contact','cnt-0001',NULL,NULL,'fc3c72e0-81cf-4a9a-a069-793f1e569812','127.0.0.1','2026-08-25 13:34:54.707243'),(91,1,'ADMIN','crm.manage','admin.crm.leads.destroy','crm_lead','lead-0001',NULL,NULL,'a257bc42-c4b7-4703-b341-d94759184229','127.0.0.1','2026-08-25 13:34:54.717981'),(92,1,'ADMIN','crm.manage','admin.crm.leads.store','crm_lead','lead-0002',NULL,NULL,'d8211df1-82d8-4c03-a42b-30312d00a477','127.0.0.1','2026-08-25 13:36:07.017629'),(93,1,'ADMIN','crm.manage','admin.crm.leads.update','crm_lead','lead-0002',NULL,NULL,'8fdb612c-8458-494e-98b5-87f10f35eb8c','127.0.0.1','2026-08-25 13:36:07.042010'),(94,1,'ADMIN','crm.manage','admin.crm.leads.convert','crm_lead','lead-0002',NULL,NULL,'23001afa-324d-4664-b065-e1445b13768e','127.0.0.1','2026-08-25 13:36:07.089239'),(95,1,'ADMIN','crm.manage','admin.crm.notes.store','crm_note','note-00002',NULL,NULL,'1fd51da9-5dce-446c-ad86-97195c9207cd','127.0.0.1','2026-08-25 13:36:07.137460'),(96,1,'ADMIN','crm.manage','admin.crm.activities.store','crm_activity','act-00002',NULL,NULL,'2b5d3aac-f6ef-4b41-9f5f-871263c41178','127.0.0.1','2026-08-25 13:36:07.153841'),(97,1,'ADMIN','crm.manage','admin.crm.activities.complete','crm_activity','act-00002',NULL,NULL,'bc466f2b-b74a-4ecc-97c8-45c4a0fdd13c','127.0.0.1','2026-08-25 13:36:07.168838'),(98,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0002',NULL,NULL,'28dee9fc-9af2-4ea0-a145-7f86b08805b8','127.0.0.1','2026-08-25 13:36:07.195732'),(99,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0002',NULL,NULL,'50d159a8-842d-47e9-84d1-6dc1cb0eb81f','127.0.0.1','2026-08-25 13:36:07.208762'),(100,1,'ADMIN','crm.manage','admin.crm.deals.destroy','crm_deal','deal-0002',NULL,NULL,'d91a2a29-15f1-46dc-b1d5-f666a16e1628','127.0.0.1','2026-08-25 13:36:07.260222'),(101,1,'ADMIN','crm.manage','admin.crm.contacts.destroy','crm_contact','cnt-0002',NULL,NULL,'fc6d9e8d-97b6-44ee-aca6-66ced1e910f5','127.0.0.1','2026-08-25 13:36:07.270495'),(102,1,'ADMIN','crm.manage','admin.crm.leads.destroy','crm_lead','lead-0002',NULL,NULL,'ca7b2ea4-ba63-46dc-94a8-38213032a7d7','127.0.0.1','2026-08-25 13:36:07.279324'),(103,1,'ADMIN','crm.manage','admin.crm.notes.store','crm_note','note-00005',NULL,NULL,'b91dcbe0-7f8b-421a-acd5-f5726ab0b636','127.0.0.1','2026-08-25 14:18:18.463279'),(104,1,'ADMIN','crm.manage','admin.crm.notes.destroy','crm_note','note-00005',NULL,NULL,'330e09b7-59cf-4420-baa8-45748e714486','127.0.0.1','2026-08-25 14:18:43.471154'),(105,1,'ADMIN','crm.manage','admin.crm.leads.store','crm_lead','lead-0005',NULL,NULL,'cf79b6f6-ff3a-423c-a739-2a07898343ae','127.0.0.1','2026-08-25 14:26:43.964794'),(106,1,'ADMIN','crm.manage','admin.crm.leads.update','crm_lead','lead-0005',NULL,NULL,'2de9faa6-5096-4599-b591-2f528ff10517','127.0.0.1','2026-08-25 14:26:43.979026'),(107,1,'ADMIN','crm.manage','admin.crm.leads.convert','crm_lead','lead-0005',NULL,NULL,'41e7752f-3ab3-46e6-ae4c-8fcb142e884f','127.0.0.1','2026-08-25 14:26:44.023035'),(108,1,'ADMIN','crm.manage','admin.crm.notes.store','crm_note','note-00006',NULL,NULL,'f02466fb-ab2d-4f7c-a7a0-106a3795fdf0','127.0.0.1','2026-08-25 14:26:44.068128'),(109,1,'ADMIN','crm.manage','admin.crm.activities.store','crm_activity','act-00008',NULL,NULL,'57b27e0a-d442-45e6-a1b4-c8a46d101ffb','127.0.0.1','2026-08-25 14:26:44.085096'),(110,1,'ADMIN','crm.manage','admin.crm.activities.complete','crm_activity','act-00008',NULL,NULL,'901571c8-a102-4c49-8d7b-914b6779a138','127.0.0.1','2026-08-25 14:26:44.104168'),(111,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0005',NULL,NULL,'89eae54a-f288-498a-bbb2-5904c299575a','127.0.0.1','2026-08-25 14:26:44.135421'),(112,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0005',NULL,NULL,'1ed76dcc-d487-4758-b992-1e53503d09cb','127.0.0.1','2026-08-25 14:26:44.153147'),(113,1,'ADMIN','crm.manage','admin.crm.deals.destroy','crm_deal','deal-0005',NULL,NULL,'5995ebb3-3c3d-468f-862e-93914f4881d6','127.0.0.1','2026-08-25 14:26:44.205657'),(114,1,'ADMIN','crm.manage','admin.crm.contacts.destroy','crm_contact','cnt-0005',NULL,NULL,'90838cce-d670-48f9-8ceb-77873b6ccb94','127.0.0.1','2026-08-25 14:26:44.215115'),(115,1,'ADMIN','crm.manage','admin.crm.leads.destroy','crm_lead','lead-0005',NULL,NULL,'f31e638a-4767-487d-8a63-e0446600fcb2','127.0.0.1','2026-08-25 14:26:44.223380'),(116,1,'ADMIN','crm.manage','admin.crm.leads.store','crm_lead','lead-0006',NULL,NULL,'e1398a03-5ecf-471d-8af2-938e9663adf1','127.0.0.1','2026-08-25 14:26:51.277029'),(117,1,'ADMIN','crm.manage','admin.crm.leads.update','crm_lead','lead-0006',NULL,NULL,'c92db6c8-3972-4b96-9b2f-56958af4ec8f','127.0.0.1','2026-08-25 14:26:51.288277'),(118,1,'ADMIN','crm.manage','admin.crm.leads.convert','crm_lead','lead-0006',NULL,NULL,'2ddf086a-0605-4738-a51b-d394af419e65','127.0.0.1','2026-08-25 14:26:51.320808'),(119,1,'ADMIN','crm.manage','admin.crm.notes.store','crm_note','note-00007',NULL,NULL,'b7f26af7-7ae7-448d-9434-e97c4968f2dd','127.0.0.1','2026-08-25 14:26:51.357761'),(120,1,'ADMIN','crm.manage','admin.crm.activities.store','crm_activity','act-00009',NULL,NULL,'e2da5e77-e19c-447a-acf3-71d8e4f1f644','127.0.0.1','2026-08-25 14:26:51.376186'),(121,1,'ADMIN','crm.manage','admin.crm.activities.complete','crm_activity','act-00009',NULL,NULL,'e77b1897-644b-4d19-9bc2-3ab8d6d88482','127.0.0.1','2026-08-25 14:26:51.394855'),(122,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0006',NULL,NULL,'0410b923-e3b6-4119-a40e-d48224c25d9a','127.0.0.1','2026-08-25 14:26:51.416317'),(123,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0006',NULL,NULL,'9612d5c0-695a-485a-b17b-2fe26b118668','127.0.0.1','2026-08-25 14:26:51.428814'),(124,1,'ADMIN','crm.manage','admin.crm.deals.destroy','crm_deal','deal-0006',NULL,NULL,'9842ba89-1de0-44ef-b1b7-3f9781532a8f','127.0.0.1','2026-08-25 14:26:51.475666'),(125,1,'ADMIN','crm.manage','admin.crm.contacts.destroy','crm_contact','cnt-0006',NULL,NULL,'abf2a6ef-cf33-40ff-a2e4-f084a6cc66ea','127.0.0.1','2026-08-25 14:26:51.485970'),(126,1,'ADMIN','crm.manage','admin.crm.leads.destroy','crm_lead','lead-0006',NULL,NULL,'828b2e7b-2b40-4786-9cde-bdae7808d6c3','127.0.0.1','2026-08-25 14:26:51.494890'),(127,1,'ADMIN','crm.manage','admin.crm.leads.store','crm_lead','lead-0007',NULL,NULL,'269e728f-0600-491c-a37c-eb0c2864f358','127.0.0.1','2026-08-25 14:27:07.049309'),(128,1,'ADMIN','crm.manage','admin.crm.leads.update','crm_lead','lead-0007',NULL,NULL,'c88c2b96-cd55-4833-bdb3-3fd9431452a2','127.0.0.1','2026-08-25 14:27:07.064762'),(129,1,'ADMIN','crm.manage','admin.crm.leads.convert','crm_lead','lead-0007',NULL,NULL,'a141d601-4ff0-4343-83d9-5c07b9c5712b','127.0.0.1','2026-08-25 14:27:07.106031'),(130,1,'ADMIN','crm.manage','admin.crm.notes.store','crm_note','note-00008',NULL,NULL,'3f2d0531-ed6c-45cc-94f5-d66b7ae2ca5f','127.0.0.1','2026-08-25 14:27:07.147000'),(131,1,'ADMIN','crm.manage','admin.crm.activities.store','crm_activity','act-00010',NULL,NULL,'d1b46a7c-d793-4b61-afbb-946a07a63821','127.0.0.1','2026-08-25 14:27:07.160228'),(132,1,'ADMIN','crm.manage','admin.crm.activities.complete','crm_activity','act-00010',NULL,NULL,'be64b02f-b90d-48e9-9f83-1e1949e55a99','127.0.0.1','2026-08-25 14:27:07.174166'),(133,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0007',NULL,NULL,'6730a304-bec6-4285-9f7e-f10ccb47448c','127.0.0.1','2026-08-25 14:27:07.203521'),(134,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0007',NULL,NULL,'887fcf1c-2716-4920-ae63-4e7111b344f3','127.0.0.1','2026-08-25 14:27:07.218762'),(135,1,'ADMIN','crm.manage','admin.crm.deals.destroy','crm_deal','deal-0007',NULL,NULL,'cebfefa2-7c99-485a-b341-e3c69bc1570d','127.0.0.1','2026-08-25 14:27:07.299330'),(136,1,'ADMIN','crm.manage','admin.crm.contacts.destroy','crm_contact','cnt-0007',NULL,NULL,'e4cd82cc-e87b-40e1-b3ad-56ccbe469117','127.0.0.1','2026-08-25 14:27:07.312083'),(137,1,'ADMIN','crm.manage','admin.crm.leads.destroy','crm_lead','lead-0007',NULL,NULL,'5259e255-3642-438e-8af1-70f4bc6a9bbe','127.0.0.1','2026-08-25 14:27:07.323370'),(138,1,'ADMIN','crm.manage','admin.crm.leads.store','crm_lead','lead-0008',NULL,NULL,'1e7dfc57-314f-454c-88f0-282289932e53','127.0.0.1','2026-08-25 14:27:23.124674'),(139,1,'ADMIN','crm.manage','admin.crm.leads.update','crm_lead','lead-0008',NULL,NULL,'25e56ec6-3c81-4020-acd0-254ddeaae7b6','127.0.0.1','2026-08-25 14:27:23.140424'),(140,1,'ADMIN','crm.manage','admin.crm.leads.convert','crm_lead','lead-0008',NULL,NULL,'828222ee-c641-4ed7-800c-3d1f435c82d3','127.0.0.1','2026-08-25 14:27:23.170255'),(141,1,'ADMIN','crm.manage','admin.crm.notes.store','crm_note','note-00009',NULL,NULL,'117110c9-ad32-4dc9-a7a4-ee7c8942ceb6','127.0.0.1','2026-08-25 14:27:23.202857'),(142,1,'ADMIN','crm.manage','admin.crm.activities.store','crm_activity','act-00011',NULL,NULL,'4d27138e-90fa-4335-bb7f-9d9105874c91','127.0.0.1','2026-08-25 14:27:23.220240'),(143,1,'ADMIN','crm.manage','admin.crm.activities.complete','crm_activity','act-00011',NULL,NULL,'25766f92-f86d-446b-8e36-07e4b99418ac','127.0.0.1','2026-08-25 14:27:23.232100'),(144,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0008',NULL,NULL,'461c6e80-0132-4962-94f0-1309a2bc3789','127.0.0.1','2026-08-25 14:27:23.256562'),(145,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0008',NULL,NULL,'2d6263c6-58c2-4446-a231-a4c07b4ed7c6','127.0.0.1','2026-08-25 14:27:23.271712'),(146,1,'ADMIN','crm.manage','admin.crm.deals.destroy','crm_deal','deal-0008',NULL,NULL,'defbc24d-5311-464f-84a2-7726f1230180','127.0.0.1','2026-08-25 14:27:23.333286'),(147,1,'ADMIN','crm.manage','admin.crm.contacts.destroy','crm_contact','cnt-0008',NULL,NULL,'a81b0580-4ac1-4e31-8049-e6725096f91c','127.0.0.1','2026-08-25 14:27:23.344220'),(148,1,'ADMIN','crm.manage','admin.crm.leads.destroy','crm_lead','lead-0008',NULL,NULL,'04bb4749-95c6-4977-8889-36d33ff4cea1','127.0.0.1','2026-08-25 14:27:23.355206'),(149,1,'ADMIN','crm.manage','admin.crm.leads.store','crm_lead','lead-0009',NULL,NULL,'7b3e0b34-308e-4722-898a-e9b6b5f4b8a8','127.0.0.1','2026-08-25 15:05:28.604293'),(150,1,'ADMIN','crm.manage','admin.crm.leads.update','crm_lead','lead-0009',NULL,NULL,'ae48fb3c-5448-4183-9379-fe6ae3e73f79','127.0.0.1','2026-08-25 15:05:28.617387'),(151,1,'ADMIN','crm.manage','admin.crm.leads.convert','crm_lead','lead-0009',NULL,NULL,'4ded5709-d23c-486d-a9a3-ea8ae22b5804','127.0.0.1','2026-08-25 15:05:28.647125'),(152,1,'ADMIN','crm.manage','admin.crm.notes.store','crm_note','note-00010',NULL,NULL,'fb45a4d0-3481-41b4-9019-34a740504859','127.0.0.1','2026-08-25 15:05:28.670567'),(153,1,'ADMIN','crm.manage','admin.crm.activities.store','crm_activity','act-00012',NULL,NULL,'1fea77c9-363e-4aab-ab8f-cea59472d1a9','127.0.0.1','2026-08-25 15:05:28.683067'),(154,1,'ADMIN','crm.manage','admin.crm.activities.complete','crm_activity','act-00012',NULL,NULL,'d0aa3d1b-9544-4549-8268-750de9ca5efa','127.0.0.1','2026-08-25 15:05:28.693298'),(155,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0009',NULL,NULL,'f08d2db6-1756-476d-9006-87160a9ba8d4','127.0.0.1','2026-08-25 15:05:28.713866'),(156,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0009',NULL,NULL,'c2155143-0391-4477-91d7-76e10ffa57c8','127.0.0.1','2026-08-25 15:05:28.723514'),(157,1,'ADMIN','crm.manage','admin.crm.deals.destroy','crm_deal','deal-0009',NULL,NULL,'ba259b24-2e84-4cf4-8a3b-f09663e0a15f','127.0.0.1','2026-08-25 15:05:28.763228'),(158,1,'ADMIN','crm.manage','admin.crm.contacts.destroy','crm_contact','cnt-0009',NULL,NULL,'1b0578c6-4f36-4749-8c19-f3d09e7c5c05','127.0.0.1','2026-08-25 15:05:28.772336'),(159,1,'ADMIN','crm.manage','admin.crm.leads.destroy','crm_lead','lead-0009',NULL,NULL,'b2bb9b01-c3b9-4cdc-911d-4ceacdc8041c','127.0.0.1','2026-08-25 15:05:28.778876'),(160,1,'ADMIN','crm.manage','admin.crm.activities.complete','crm_activity','act-00003',NULL,NULL,'407cf206-4039-4e34-b4ce-aa4655b79e8d','127.0.0.1','2026-08-25 15:10:19.581372'),(161,1,'ADMIN','inventory.adjust','admin.inventory.suppliers.create','supplier','sup-01',NULL,NULL,'b89230e0-0c82-4f4e-b847-811397d0e7fa','127.0.0.1','2026-08-27 10:14:04.698959'),(162,1,'ADMIN','inventory.adjust','admin.inventory.materials.create','material','mat-0001',NULL,NULL,'9ae62cc5-98b6-44fc-b436-9de947bd1351','127.0.0.1','2026-08-27 10:14:04.771844'),(163,1,'ADMIN','inventory.adjust','admin.inventory.materials.create','material','mat-0002',NULL,NULL,'3ccfea3b-df91-4fd2-96ea-fe29364735e2','127.0.0.1','2026-08-27 10:14:04.786711'),(164,1,'ADMIN','inventory.adjust','admin.inventory.purchases.create','material_purchase','po-0001',NULL,NULL,'9b65c689-e2f2-46ca-9ca6-31faa5c826e0','127.0.0.1','2026-08-27 10:14:04.802983'),(165,1,'ADMIN','inventory.adjust','admin.inventory.purchases.lines','material_purchase','po-0001',NULL,NULL,'704aec1d-4c05-4509-aa64-7c827dad65d6','127.0.0.1','2026-08-27 10:14:04.833176'),(166,1,'ADMIN','inventory.adjust','admin.inventory.purchases.transition','material_purchase','po-0001',NULL,NULL,'a3d53d8d-6c33-4a57-8e85-2b2423795a9a','127.0.0.1','2026-08-27 10:14:04.848769'),(167,1,'ADMIN','inventory.adjust','admin.inventory.purchases.receive','material_purchase','po-0001',NULL,NULL,'47bbd1cf-18a4-437b-8e11-74fdb13a0527','127.0.0.1','2026-08-27 10:14:04.871378'),(168,1,'ADMIN','inventory.adjust','admin.inventory.purchases.receive','material_purchase','po-0001',NULL,NULL,'2927e51e-a025-48c1-8acf-eb67ca7b5b3a','127.0.0.1','2026-08-27 10:14:04.903481'),(169,1,'ADMIN','inventory.adjust','admin.inventory.recipes.update','stock_item','ITM-001',NULL,NULL,'a378b215-5935-4297-907d-b04f1241d3c5','127.0.0.1','2026-08-27 10:14:04.925159'),(170,1,'ADMIN','inventory.adjust','admin.inventory.runs.create','production_run','run-0001',NULL,NULL,'4f693079-da93-4d3f-b042-52318813745c','127.0.0.1','2026-08-27 10:14:04.945154'),(171,1,'ADMIN','inventory.adjust','admin.inventory.runs.transition','production_run','run-0001',NULL,NULL,'744c0190-aceb-4b69-b4dd-1df464923534','127.0.0.1','2026-08-27 10:14:04.966492'),(172,1,'ADMIN','inventory.adjust','admin.inventory.runs.transition','production_run','run-0001',NULL,NULL,'06916c3f-a56b-4c5e-a075-400ddd5d8515','127.0.0.1','2026-08-27 10:14:05.005337'),(173,1,'ADMIN','inventory.adjust','admin.inventory.runs.create','production_run','run-0002',NULL,NULL,'03b42771-124b-4d9a-aaf9-3d54f1e9954a','127.0.0.1','2026-08-27 10:14:05.040425'),(174,1,'ADMIN','inventory.adjust','admin.inventory.runs.delete','production_run','run-0002',NULL,NULL,'fedb89c5-9aab-474b-a171-ce617aea14fa','127.0.0.1','2026-08-27 10:14:05.058746'),(175,1,'ADMIN','inventory.adjust','admin.inventory.materials.adjust','material','mat-0001',NULL,NULL,'4e49ce87-3f09-482d-8649-d730e05165ed','127.0.0.1','2026-08-27 10:14:05.111292'),(176,1,'ADMIN','inventory.adjust','admin.inventory.runs.transition','production_run','run-0002',NULL,NULL,'52fbe909-38ad-4053-a7c2-131276c7c2e1','127.0.0.1','2026-08-27 10:30:34.100386'),(177,1,'ADMIN','crm.manage','admin.crm.leads.store','crm_lead','lead-0010',NULL,NULL,'caf5ce56-bde2-4496-92b3-8938e96991a5','127.0.0.1','2026-08-27 10:42:51.752790'),(178,1,'ADMIN','crm.manage','admin.crm.leads.update','crm_lead','lead-0010',NULL,NULL,'4411ea7b-3625-4f70-8862-b1e7b0d26b95','127.0.0.1','2026-08-27 10:42:51.760803'),(179,1,'ADMIN','crm.manage','admin.crm.leads.convert','crm_lead','lead-0010',NULL,NULL,'2f410c0a-8f80-4eed-8760-490b6c299815','127.0.0.1','2026-08-27 10:42:51.790921'),(180,1,'ADMIN','crm.manage','admin.crm.notes.store','crm_note','note-00011',NULL,NULL,'4740bb16-bb6e-4b90-ab4f-4543862ff774','127.0.0.1','2026-08-27 10:42:51.819158'),(181,1,'ADMIN','crm.manage','admin.crm.activities.store','crm_activity','act-00013',NULL,NULL,'f1a96bfc-56f2-4aa0-8927-c5ce20ec2af6','127.0.0.1','2026-08-27 10:42:51.845917'),(182,1,'ADMIN','crm.manage','admin.crm.activities.complete','crm_activity','act-00013',NULL,NULL,'fcec4a04-7110-4bb2-b3cf-a585fbaac1bf','127.0.0.1','2026-08-27 10:42:51.869040'),(183,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0010',NULL,NULL,'658fd583-ad7c-4a71-916a-a4a0e6de2761','127.0.0.1','2026-08-27 10:42:51.894299'),(184,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0010',NULL,NULL,'c558721e-0da5-4ca3-886a-5ea6a79ba158','127.0.0.1','2026-08-27 10:42:51.906807'),(185,1,'ADMIN','crm.manage','admin.crm.deals.destroy','crm_deal','deal-0010',NULL,NULL,'f2d4c6c8-5f12-4733-9a29-9e5e6b2cce44','127.0.0.1','2026-08-27 10:42:51.950743'),(186,1,'ADMIN','crm.manage','admin.crm.contacts.destroy','crm_contact','cnt-0010',NULL,NULL,'3fc9b4c9-4583-462f-b662-57cb228bf1f2','127.0.0.1','2026-08-27 10:42:51.958157'),(187,1,'ADMIN','crm.manage','admin.crm.leads.destroy','crm_lead','lead-0010',NULL,NULL,'39e2234e-472b-4edf-9487-2e792ccc32b1','127.0.0.1','2026-08-27 10:42:51.977061'),(188,1,'ADMIN','inventory.adjust','admin.inventory.suppliers.create','supplier','sup-03',NULL,NULL,'9d9e0366-902f-4cc6-a67f-f1022092d710','127.0.0.1','2026-08-27 10:42:52.424892'),(189,1,'ADMIN','inventory.adjust','admin.inventory.materials.create','material','mat-0007',NULL,NULL,'08d2fc31-aa82-4d57-a0fc-688860d74df8','127.0.0.1','2026-08-27 10:42:52.449551'),(190,1,'ADMIN','inventory.adjust','admin.inventory.materials.create','material','mat-0008',NULL,NULL,'4d0c3e22-8aa7-4531-9a41-9ad90756d53f','127.0.0.1','2026-08-27 10:42:52.463627'),(191,1,'ADMIN','inventory.adjust','admin.inventory.purchases.create','material_purchase','po-0003',NULL,NULL,'3b6717d9-6b8c-4186-ba50-1f61a601b317','127.0.0.1','2026-08-27 10:42:52.474739'),(192,1,'ADMIN','inventory.adjust','admin.inventory.purchases.lines','material_purchase','po-0003',NULL,NULL,'06c018a2-1787-4e38-9bd9-5f804947b461','127.0.0.1','2026-08-27 10:42:52.492992'),(193,1,'ADMIN','inventory.adjust','admin.inventory.purchases.transition','material_purchase','po-0003',NULL,NULL,'69315b19-e2a5-43f3-8358-b048337d82df','127.0.0.1','2026-08-27 10:42:52.502760'),(194,1,'ADMIN','inventory.adjust','admin.inventory.purchases.receive','material_purchase','po-0003',NULL,NULL,'4f9d579e-1d51-480a-8b16-4e4810c0a6e4','127.0.0.1','2026-08-27 10:42:52.521462'),(195,1,'ADMIN','inventory.adjust','admin.inventory.purchases.receive','material_purchase','po-0003',NULL,NULL,'b7bc26f0-3788-44d6-86d2-25b257020ade','127.0.0.1','2026-08-27 10:42:52.541382'),(196,1,'ADMIN','inventory.adjust','admin.inventory.recipes.update','stock_item','ITM-001',NULL,NULL,'944b3cdb-2e53-4ed3-adcc-73124a4e2735','127.0.0.1','2026-08-27 10:42:52.557991'),(197,1,'ADMIN','inventory.adjust','admin.inventory.runs.create','production_run','run-0003',NULL,NULL,'8a98dcb8-f6f9-49a6-96ff-17d1bc905bb1','127.0.0.1','2026-08-27 10:42:52.575690'),(198,1,'ADMIN','inventory.adjust','admin.inventory.runs.transition','production_run','run-0003',NULL,NULL,'93cb0275-e331-4064-9324-635f94b97f36','127.0.0.1','2026-08-27 10:42:52.589287'),(199,1,'ADMIN','inventory.adjust','admin.inventory.runs.transition','production_run','run-0003',NULL,NULL,'76ca09b5-575f-4653-9a46-0cb6ee2a81d6','127.0.0.1','2026-08-27 10:42:52.614913'),(200,1,'ADMIN','inventory.adjust','admin.inventory.runs.create','production_run','run-0004',NULL,NULL,'fcf64523-e3a1-455b-afc2-e4b3cb079510','127.0.0.1','2026-08-27 10:42:52.638057'),(201,1,'ADMIN','inventory.adjust','admin.inventory.runs.delete','production_run','run-0004',NULL,NULL,'25a30c04-c069-478d-9540-32b34316ea9c','127.0.0.1','2026-08-27 10:42:52.653564'),(202,1,'ADMIN','inventory.adjust','admin.inventory.materials.adjust','material','mat-0007',NULL,NULL,'4a8b4907-60ad-4117-b83e-ec1e318ffb40','127.0.0.1','2026-08-27 10:42:52.670635'),(203,1,'ADMIN','crm.manage','admin.crm.leads.store','crm_lead','lead-0011',NULL,NULL,'f8734e79-c0f2-4174-90e2-d2a05baefddf','127.0.0.1','2026-08-27 13:20:56.462504'),(204,1,'ADMIN','crm.manage','admin.crm.leads.update','crm_lead','lead-0011',NULL,NULL,'ae4359b8-b303-4959-b98d-4e8956d4e2c4','127.0.0.1','2026-08-27 13:20:56.474227'),(205,1,'ADMIN','crm.manage','admin.crm.leads.convert','crm_lead','lead-0011',NULL,NULL,'67e7d532-3054-4810-b480-4dbf48d0e34b','127.0.0.1','2026-08-27 13:20:56.506690'),(206,1,'ADMIN','crm.manage','admin.crm.notes.store','crm_note','note-00012',NULL,NULL,'5e62f445-1418-4acb-b2cf-2c56d99baa1b','127.0.0.1','2026-08-27 13:20:56.548829'),(207,1,'ADMIN','crm.manage','admin.crm.activities.store','crm_activity','act-00014',NULL,NULL,'c4927218-b8d4-4729-a824-67602d3283d8','127.0.0.1','2026-08-27 13:20:56.575550'),(208,1,'ADMIN','crm.manage','admin.crm.activities.complete','crm_activity','act-00014',NULL,NULL,'ed967c75-bc65-4ee6-9252-08586916b965','127.0.0.1','2026-08-27 13:20:56.593107'),(209,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0011',NULL,NULL,'b7cebc76-fac6-42b7-a302-bb402ea9aade','127.0.0.1','2026-08-27 13:20:56.628480'),(210,1,'ADMIN','crm.manage','admin.crm.deals.move','crm_deal','deal-0011',NULL,NULL,'705ce975-be21-4abb-b15b-8b996d74dc7d','127.0.0.1','2026-08-27 13:20:56.649534'),(211,1,'ADMIN','crm.manage','admin.crm.deals.destroy','crm_deal','deal-0011',NULL,NULL,'56149fc4-3ab1-4ea6-9356-48e8f27c2dfe','127.0.0.1','2026-08-27 13:20:56.722551'),(212,1,'ADMIN','crm.manage','admin.crm.contacts.destroy','crm_contact','cnt-0011',NULL,NULL,'57942380-a246-4d94-be7a-f9eed0996c6e','127.0.0.1','2026-08-27 13:20:56.737729'),(213,1,'ADMIN','crm.manage','admin.crm.leads.destroy','crm_lead','lead-0011',NULL,NULL,'bb4778aa-d416-41a7-81f5-c1c31a2f01eb','127.0.0.1','2026-08-27 13:20:56.752188'),(214,1,'ADMIN','inventory.adjust','admin.inventory.suppliers.create','supplier','sup-03',NULL,NULL,'216baf16-7d53-483c-8dab-7b503bfeca75','127.0.0.1','2026-08-27 13:20:57.132787'),(215,1,'ADMIN','inventory.adjust','admin.inventory.materials.create','material','mat-0007',NULL,NULL,'fc514204-0714-42d2-afff-87f9eba26ceb','127.0.0.1','2026-08-27 13:20:57.172610'),(216,1,'ADMIN','inventory.adjust','admin.inventory.materials.create','material','mat-0008',NULL,NULL,'18001080-e6f7-403e-8e4c-484eed2a6384','127.0.0.1','2026-08-27 13:20:57.189532'),(217,1,'ADMIN','inventory.adjust','admin.inventory.purchases.create','material_purchase','po-0003',NULL,NULL,'36fc90c3-5630-4089-a3b5-8712eb9becb2','127.0.0.1','2026-08-27 13:20:57.211657'),(218,1,'ADMIN','inventory.adjust','admin.inventory.purchases.lines','material_purchase','po-0003',NULL,NULL,'c309c5ae-7142-47fe-832e-ee37afdac31d','127.0.0.1','2026-08-27 13:20:57.248161'),(219,1,'ADMIN','inventory.adjust','admin.inventory.purchases.transition','material_purchase','po-0003',NULL,NULL,'6c932fb0-0ccd-4160-8c14-2c91182de8e8','127.0.0.1','2026-08-27 13:20:57.265134'),(220,1,'ADMIN','inventory.adjust','admin.inventory.purchases.receive','material_purchase','po-0003',NULL,NULL,'27170d1b-aea0-4647-a307-bc3f9d8c4c1f','127.0.0.1','2026-08-27 13:20:57.297496'),(221,1,'ADMIN','inventory.adjust','admin.inventory.purchases.receive','material_purchase','po-0003',NULL,NULL,'ff21fe0f-7519-449c-b657-e0d332722b44','127.0.0.1','2026-08-27 13:20:57.354387'),(222,1,'ADMIN','inventory.adjust','admin.inventory.recipes.update','stock_item','ITM-001',NULL,NULL,'195b0891-7455-460e-a4b7-bf1bb33abcbd','127.0.0.1','2026-08-27 13:20:57.380833'),(223,1,'ADMIN','inventory.adjust','admin.inventory.runs.create','production_run','run-0003',NULL,NULL,'be4f9763-f2a5-4ff5-abdb-54085574b8d0','127.0.0.1','2026-08-27 13:20:57.404956'),(224,1,'ADMIN','inventory.adjust','admin.inventory.runs.transition','production_run','run-0003',NULL,NULL,'12758bab-6a57-473a-85d8-5ed239265e03','127.0.0.1','2026-08-27 13:20:57.439696'),(225,1,'ADMIN','inventory.adjust','admin.inventory.runs.transition','production_run','run-0003',NULL,NULL,'ee7e800b-bfd6-42c7-ad52-e1db9ed6fc7a','127.0.0.1','2026-08-27 13:20:57.507022'),(226,1,'ADMIN','inventory.adjust','admin.inventory.runs.create','production_run','run-0004',NULL,NULL,'bc88aa70-9e27-4e32-9178-59aa22defed9','127.0.0.1','2026-08-27 13:20:57.561723'),(227,1,'ADMIN','inventory.adjust','admin.inventory.runs.delete','production_run','run-0004',NULL,NULL,'7b27b8bf-1492-4ffa-96e3-080951ab19ee','127.0.0.1','2026-08-27 13:20:57.596412'),(228,1,'ADMIN','inventory.adjust','admin.inventory.materials.adjust','material','mat-0007',NULL,NULL,'dfcde5e5-e3b2-4d04-abf2-3b7bb5d3353e','127.0.0.1','2026-08-27 13:20:57.626158');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;

--
-- Table structure for table `auth_tokens`
--

DROP TABLE IF EXISTS `auth_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auth_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `purpose` varchar(24) NOT NULL,
  `token_hash` binary(32) NOT NULL,
  `payload_json` text DEFAULT NULL,
  `attempts` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `expires_at` datetime(6) NOT NULL,
  `consumed_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_auth_tokens_hash` (`token_hash`),
  KEY `ix_auth_tokens_user` (`user_id`,`purpose`),
  CONSTRAINT `fk_auth_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_tokens`
--

/*!40000 ALTER TABLE `auth_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_tokens` ENABLE KEYS */;

--
-- Table structure for table `cart_items`
--

DROP TABLE IF EXISTS `cart_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cart_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `cart_id` bigint(20) unsigned NOT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `variant_size` varchar(8) NOT NULL,
  `quantity` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `price_at_add` decimal(12,2) NOT NULL DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'INR',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cart_items_line` (`cart_id`,`product_id`,`variant_size`),
  KEY `ix_cart_items_product` (`product_id`),
  CONSTRAINT `fk_cart_items_cart` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cart_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cart_items`
--

/*!40000 ALTER TABLE `cart_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `cart_items` ENABLE KEYS */;

--
-- Table structure for table `carts`
--

DROP TABLE IF EXISTS `carts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `carts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE',
  `coupon_code` varchar(40) DEFAULT NULL,
  `version` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `active_key` varchar(32) GENERATED ALWAYS AS (if(`status` = 'ACTIVE',concat('u',`user_id`),NULL)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_carts_active` (`active_key`),
  KEY `ix_carts_user` (`user_id`,`status`),
  CONSTRAINT `fk_carts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `carts`
--

/*!40000 ALTER TABLE `carts` DISABLE KEYS */;
/*!40000 ALTER TABLE `carts` ENABLE KEYS */;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `categories` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `name` varchar(80) NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_public_id` (`public_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` (`id`, `public_id`, `name`, `position`, `created_at`, `updated_at`, `deleted_at`) VALUES (1,'outerwear','Outerwear',0,'2026-08-17 09:49:53.669120','2026-08-17 09:49:53.669120',NULL),(2,'essentials','Essentials',1,'2026-08-17 09:49:53.670785','2026-08-17 12:46:38.182764','2026-08-17 12:46:38.182764'),(3,'bottoms','Bottoms',2,'2026-08-17 09:49:53.672092','2026-08-17 12:46:38.182764','2026-08-17 12:46:38.182764'),(4,'accessories','Accessories',4,'2026-08-17 09:49:53.674264','2026-08-17 12:34:17.899292',NULL),(6,'knitwear','Knitwear',1,'2026-08-17 12:34:17.898926','2026-08-17 12:34:17.898926',NULL),(7,'trousers','Trousers',2,'2026-08-17 12:34:17.899062','2026-08-17 12:34:17.899062',NULL),(8,'tops','Tops',3,'2026-08-17 12:34:17.899178','2026-08-17 12:34:17.899178',NULL);
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;

--
-- Table structure for table `checkout_drafts`
--

DROP TABLE IF EXISTS `checkout_drafts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `checkout_drafts` (
  `user_id` bigint(20) unsigned NOT NULL,
  `name` varchar(120) NOT NULL DEFAULT '',
  `email` varchar(190) NOT NULL DEFAULT '',
  `mobile` varchar(20) NOT NULL DEFAULT '',
  `address` varchar(255) NOT NULL DEFAULT '',
  `city` varchar(80) NOT NULL DEFAULT '',
  `state` varchar(80) NOT NULL DEFAULT '',
  `postal_code` varchar(10) NOT NULL DEFAULT '',
  `delivery_method` varchar(16) NOT NULL DEFAULT 'standard',
  `payment_method` varchar(16) NOT NULL DEFAULT 'cod',
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_checkout_drafts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `checkout_drafts`
--

/*!40000 ALTER TABLE `checkout_drafts` DISABLE KEYS */;
/*!40000 ALTER TABLE `checkout_drafts` ENABLE KEYS */;

--
-- Table structure for table `cms_blocks`
--

DROP TABLE IF EXISTS `cms_blocks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cms_blocks` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `page_id` bigint(20) unsigned NOT NULL,
  `public_id` varchar(40) NOT NULL,
  `type` varchar(24) NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `config_json` mediumtext DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cms_blocks_public_id` (`public_id`),
  KEY `ix_cms_blocks_page` (`page_id`,`position`),
  CONSTRAINT `fk_cms_blocks_page` FOREIGN KEY (`page_id`) REFERENCES `cms_pages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cms_blocks`
--

/*!40000 ALTER TABLE `cms_blocks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cms_blocks` ENABLE KEYS */;

--
-- Table structure for table `cms_page_versions`
--

DROP TABLE IF EXISTS `cms_page_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cms_page_versions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `page_id` bigint(20) unsigned NOT NULL,
  `version` int(10) unsigned NOT NULL DEFAULT 1,
  `body_json` mediumtext DEFAULT NULL,
  `published_at` datetime(6) DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cms_page_versions` (`page_id`,`version`),
  KEY `fk_cms_page_versions_author` (`created_by`),
  CONSTRAINT `fk_cms_page_versions_author` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cms_page_versions_page` FOREIGN KEY (`page_id`) REFERENCES `cms_pages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cms_page_versions`
--

/*!40000 ALTER TABLE `cms_page_versions` DISABLE KEYS */;
/*!40000 ALTER TABLE `cms_page_versions` ENABLE KEYS */;

--
-- Table structure for table `cms_pages`
--

DROP TABLE IF EXISTS `cms_pages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cms_pages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(80) NOT NULL,
  `title` varchar(160) NOT NULL DEFAULT '',
  `type` varchar(16) NOT NULL DEFAULT 'POLICY',
  `status` varchar(16) NOT NULL DEFAULT 'Draft',
  `current_version_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cms_pages_slug` (`slug`),
  KEY `fk_cms_pages_current_version` (`current_version_id`),
  CONSTRAINT `fk_cms_pages_current_version` FOREIGN KEY (`current_version_id`) REFERENCES `cms_page_versions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cms_pages`
--

/*!40000 ALTER TABLE `cms_pages` DISABLE KEYS */;
/*!40000 ALTER TABLE `cms_pages` ENABLE KEYS */;

--
-- Table structure for table `collection_products`
--

DROP TABLE IF EXISTS `collection_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `collection_products` (
  `collection_id` bigint(20) unsigned NOT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`collection_id`,`product_id`),
  KEY `ix_collection_products_product` (`product_id`),
  CONSTRAINT `fk_collection_products_collection` FOREIGN KEY (`collection_id`) REFERENCES `collections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_collection_products_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `collection_products`
--

/*!40000 ALTER TABLE `collection_products` DISABLE KEYS */;
INSERT INTO `collection_products` (`collection_id`, `product_id`, `position`) VALUES (1,1,0),(1,2,1),(1,3,2),(1,13,7),(1,14,8),(1,16,10),(1,17,11),(1,19,13),(1,20,14),(1,24,18),(1,32,26),(1,33,27),(1,37,31),(2,3,2),(2,5,4),(2,11,5),(2,12,6),(2,15,9),(2,23,17),(2,25,19),(2,28,22),(2,34,28),(2,35,29),(2,36,30),(3,4,3),(3,18,12),(3,21,15),(3,22,16),(3,26,20),(3,27,21),(3,29,23),(3,30,24),(3,31,25);
/*!40000 ALTER TABLE `collection_products` ENABLE KEYS */;

--
-- Table structure for table `collections`
--

DROP TABLE IF EXISTS `collections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `collections` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(80) NOT NULL,
  `name` varchar(120) NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'Draft',
  `position` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_collections_public_id` (`public_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `collections`
--

/*!40000 ALTER TABLE `collections` DISABLE KEYS */;
INSERT INTO `collections` (`id`, `public_id`, `name`, `status`, `position`, `created_at`, `updated_at`, `deleted_at`) VALUES (1,'drop-001','Drop 001','Live',0,'2026-08-17 09:49:53.666697','2026-08-17 09:49:53.666697',NULL),(2,'after-hours','After Hours','Live',1,'2026-08-17 09:49:53.667320','2026-08-17 12:34:17.897090',NULL),(3,'core-uniform','Core Uniform','Live',2,'2026-08-17 09:49:53.668447','2026-08-17 12:34:17.897979',NULL);
/*!40000 ALTER TABLE `collections` ENABLE KEYS */;

--
-- Table structure for table `contact_messages`
--

DROP TABLE IF EXISTS `contact_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `contact_messages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `email` varchar(190) NOT NULL,
  `topic` varchar(40) NOT NULL DEFAULT '',
  `message` text NOT NULL,
  `consent` tinyint(1) NOT NULL DEFAULT 0,
  `converted_query_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_contact_messages_created` (`created_at`),
  KEY `fk_contact_messages_query` (`converted_query_id`),
  CONSTRAINT `fk_contact_messages_query` FOREIGN KEY (`converted_query_id`) REFERENCES `support_queries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contact_messages`
--

/*!40000 ALTER TABLE `contact_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `contact_messages` ENABLE KEYS */;

--
-- Table structure for table `coupon_redemptions`
--

DROP TABLE IF EXISTS `coupon_redemptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `coupon_redemptions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `coupon_id` bigint(20) unsigned DEFAULT NULL,
  `voucher_id` bigint(20) unsigned DEFAULT NULL,
  `order_id` bigint(20) unsigned NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_coupon_redemptions_order` (`order_id`),
  KEY `ix_coupon_redemptions_coupon` (`coupon_id`),
  KEY `ix_coupon_redemptions_voucher` (`voucher_id`),
  CONSTRAINT `fk_coupon_redemptions_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_coupon_redemptions_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_coupon_redemptions_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coupon_redemptions`
--

/*!40000 ALTER TABLE `coupon_redemptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `coupon_redemptions` ENABLE KEYS */;

--
-- Table structure for table `coupons`
--

DROP TABLE IF EXISTS `coupons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `coupons` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(40) NOT NULL,
  `label` varchar(120) NOT NULL DEFAULT '',
  `kind` varchar(8) NOT NULL DEFAULT 'percent',
  `value` decimal(12,2) NOT NULL DEFAULT 0.00,
  `min_subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `starts_at` datetime(6) DEFAULT NULL,
  `ends_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_coupons_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coupons`
--

/*!40000 ALTER TABLE `coupons` DISABLE KEYS */;
/*!40000 ALTER TABLE `coupons` ENABLE KEYS */;

--
-- Table structure for table `courier_pickups`
--

DROP TABLE IF EXISTS `courier_pickups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `courier_pickups` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(24) NOT NULL,
  `provider` varchar(40) NOT NULL DEFAULT '',
  `parcels` int(10) unsigned NOT NULL DEFAULT 0,
  `pickup_label` varchar(60) NOT NULL DEFAULT '',
  `status` varchar(16) NOT NULL DEFAULT 'Open',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_courier_pickups_public_id` (`public_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `courier_pickups`
--

/*!40000 ALTER TABLE `courier_pickups` DISABLE KEYS */;
/*!40000 ALTER TABLE `courier_pickups` ENABLE KEYS */;

--
-- Table structure for table `crm_activities`
--

DROP TABLE IF EXISTS `crm_activities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_activities` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `type` varchar(12) NOT NULL DEFAULT 'TASK',
  `subject` varchar(190) NOT NULL,
  `body` text DEFAULT NULL,
  `subject_type` varchar(12) NOT NULL,
  `subject_id` bigint(20) unsigned NOT NULL,
  `due_at` datetime(6) DEFAULT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `outcome` varchar(190) NOT NULL DEFAULT '',
  `priority` varchar(8) NOT NULL DEFAULT 'NORMAL',
  `owner_user_id` bigint(20) unsigned DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_crm_activities_public_id` (`public_id`),
  KEY `ix_crm_activities_subject` (`subject_type`,`subject_id`,`deleted_at`),
  KEY `ix_crm_activities_due` (`owner_user_id`,`completed_at`,`due_at`),
  KEY `ix_crm_activities_open` (`completed_at`,`due_at`),
  KEY `fk_crm_activities_author` (`created_by`),
  CONSTRAINT `fk_crm_activities_author` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_crm_activities_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_activities`
--

/*!40000 ALTER TABLE `crm_activities` DISABLE KEYS */;
INSERT INTO `crm_activities` (`id`, `public_id`, `type`, `subject`, `body`, `subject_type`, `subject_id`, `due_at`, `completed_at`, `outcome`, `priority`, `owner_user_id`, `created_by`, `created_at`, `updated_at`, `deleted_at`) VALUES (1,'act-00001','EMAIL','Send the pop-up quote','','deal',1,'2020-01-01 09:00:00.000000','2026-08-25 13:34:54.573532','Quote sent.','HIGH',1,1,'2026-08-25 13:34:54.558441','2026-08-25 13:34:54.573546',NULL),(2,'act-00002','EMAIL','Send the pop-up quote','','deal',2,'2020-01-01 09:00:00.000000','2026-08-25 13:36:07.162338','Quote sent.','HIGH',1,1,'2026-08-25 13:36:07.149307','2026-08-25 13:36:07.162347',NULL),(3,'act-00003','CALL','Chase the Northside PO','','deal',3,'2026-08-24 08:11:57.543712','2026-08-25 15:10:19.570756','','HIGH',1,1,'2026-08-25 14:11:57.545278','2026-08-25 15:10:19.570764',NULL),(4,'act-00004','EMAIL','Send the Aster capsule quote','','deal',4,'2026-08-25 17:11:57.547112',NULL,'','NORMAL',1,1,'2026-08-25 14:11:57.547580','2026-08-25 14:11:57.547584',NULL),(5,'act-00005','MEETING','Kestrel sample pull-together','','deal',5,'2026-08-27 18:11:57.549021',NULL,'','NORMAL',1,1,'2026-08-25 14:11:57.549428','2026-08-25 14:11:57.549432',NULL),(6,'act-00006','CALL','Check in with Devan','','contact',6,'2026-08-30 14:11:57.550803',NULL,'','LOW',1,1,'2026-08-25 14:11:57.551199','2026-08-25 14:11:57.551202',NULL),(7,'act-00007','MEETING','Northside intro call','','deal',3,'2026-08-21 14:11:57.552496','2026-08-25 14:11:57.555339','They want AW pieces plus two carryover styles.','NORMAL',1,1,'2026-08-25 14:11:57.553102','2026-08-25 14:11:57.555348',NULL),(8,'act-00008','EMAIL','Send the pop-up quote','','deal',7,'2020-01-01 09:00:00.000000','2026-08-25 14:26:44.095121','Quote sent.','HIGH',1,1,'2026-08-25 14:26:44.078879','2026-08-25 14:26:44.095126',NULL),(9,'act-00009','EMAIL','Send the pop-up quote','','deal',8,'2020-01-01 09:00:00.000000','2026-08-25 14:26:51.390348','Quote sent.','HIGH',1,1,'2026-08-25 14:26:51.370768','2026-08-25 14:26:51.390354',NULL),(10,'act-00010','EMAIL','Send the pop-up quote','','deal',9,'2020-01-01 09:00:00.000000','2026-08-25 14:27:07.169837','Quote sent.','HIGH',1,1,'2026-08-25 14:27:07.155951','2026-08-25 14:27:07.169841',NULL),(11,'act-00011','EMAIL','Send the pop-up quote','','deal',10,'2020-01-01 09:00:00.000000','2026-08-25 14:27:23.227440','Quote sent.','HIGH',1,1,'2026-08-25 14:27:23.211679','2026-08-25 14:27:23.227445',NULL),(12,'act-00012','EMAIL','Send the pop-up quote','','deal',11,'2020-01-01 09:00:00.000000','2026-08-25 15:05:28.689866','Quote sent.','HIGH',1,1,'2026-08-25 15:05:28.679564','2026-08-25 15:05:28.689874',NULL),(13,'act-00013','EMAIL','Send the pop-up quote','','deal',12,'2020-01-01 09:00:00.000000','2026-08-27 10:42:51.855866','Quote sent.','HIGH',1,1,'2026-08-27 10:42:51.834773','2026-08-27 10:42:51.855878',NULL),(14,'act-00014','EMAIL','Send the pop-up quote','','deal',13,'2020-01-01 09:00:00.000000','2026-08-27 13:20:56.587565','Quote sent.','HIGH',1,1,'2026-08-27 13:20:56.564447','2026-08-27 13:20:56.587575',NULL);
/*!40000 ALTER TABLE `crm_activities` ENABLE KEYS */;

--
-- Table structure for table `crm_companies`
--

DROP TABLE IF EXISTS `crm_companies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_companies` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `name` varchar(160) NOT NULL,
  `name_normalized` varchar(160) NOT NULL,
  `domain` varchar(190) NOT NULL DEFAULT '',
  `industry` varchar(80) NOT NULL DEFAULT '',
  `size_band` varchar(16) NOT NULL DEFAULT '',
  `email` varchar(190) NOT NULL DEFAULT '',
  `phone` varchar(20) NOT NULL DEFAULT '',
  `website` varchar(190) NOT NULL DEFAULT '',
  `city` varchar(80) NOT NULL DEFAULT '',
  `state` varchar(80) NOT NULL DEFAULT '',
  `country` varchar(80) NOT NULL DEFAULT 'India',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE',
  `owner_user_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_crm_companies_public_id` (`public_id`),
  KEY `ix_crm_companies_name` (`name_normalized`),
  KEY `ix_crm_companies_owner` (`owner_user_id`,`deleted_at`),
  CONSTRAINT `fk_crm_companies_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_companies`
--

/*!40000 ALTER TABLE `crm_companies` DISABLE KEYS */;
INSERT INTO `crm_companies` (`id`, `public_id`, `name`, `name_normalized`, `domain`, `industry`, `size_band`, `email`, `phone`, `website`, `city`, `state`, `country`, `status`, `owner_user_id`, `created_at`, `updated_at`, `deleted_at`) VALUES (3,'co-0001','Northside Retail','northside retail','northside.example','Fashion retail','11-50','hello@northside.example','','https://northside.example','Mumbai','','India','ACTIVE',1,'2026-08-25 14:11:57.499588','2026-08-25 14:11:57.499601',NULL),(4,'co-0002','Aster & Co','aster & co','asterco.example','Concept store','1-10','hello@asterco.example','','https://asterco.example','Bengaluru','','India','ACTIVE',1,'2026-08-25 14:11:57.501517','2026-08-25 14:11:57.501522',NULL),(5,'co-0003','Kestrel Studio','kestrel studio','kestrel.example','Styling','1-10','hello@kestrel.example','','https://kestrel.example','Delhi','','India','ACTIVE',1,'2026-08-25 14:11:57.502979','2026-08-25 14:11:57.502985',NULL);
/*!40000 ALTER TABLE `crm_companies` ENABLE KEYS */;

--
-- Table structure for table `crm_contacts`
--

DROP TABLE IF EXISTS `crm_contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_contacts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `company_id` bigint(20) unsigned DEFAULT NULL,
  `first_name` varchar(80) NOT NULL,
  `last_name` varchar(80) NOT NULL DEFAULT '',
  `email` varchar(190) NOT NULL DEFAULT '',
  `email_normalized` varchar(190) NOT NULL DEFAULT '',
  `phone` varchar(20) NOT NULL DEFAULT '',
  `job_title` varchar(120) NOT NULL DEFAULT '',
  `lifecycle` varchar(16) NOT NULL DEFAULT 'LEAD',
  `source` varchar(24) NOT NULL DEFAULT 'OTHER',
  `city` varchar(80) NOT NULL DEFAULT '',
  `state` varchar(80) NOT NULL DEFAULT '',
  `country` varchar(80) NOT NULL DEFAULT 'India',
  `owner_user_id` bigint(20) unsigned DEFAULT NULL,
  `last_activity_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_crm_contacts_public_id` (`public_id`),
  KEY `ix_crm_contacts_email` (`email_normalized`),
  KEY `ix_crm_contacts_user` (`user_id`),
  KEY `ix_crm_contacts_company` (`company_id`,`deleted_at`),
  KEY `ix_crm_contacts_owner` (`owner_user_id`,`deleted_at`),
  KEY `ix_crm_contacts_lifecycle` (`lifecycle`,`deleted_at`),
  CONSTRAINT `fk_crm_contacts_company` FOREIGN KEY (`company_id`) REFERENCES `crm_companies` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_crm_contacts_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_crm_contacts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_contacts`
--

/*!40000 ALTER TABLE `crm_contacts` DISABLE KEYS */;
INSERT INTO `crm_contacts` (`id`, `public_id`, `user_id`, `company_id`, `first_name`, `last_name`, `email`, `email_normalized`, `phone`, `job_title`, `lifecycle`, `source`, `city`, `state`, `country`, `owner_user_id`, `last_activity_at`, `created_at`, `updated_at`, `deleted_at`) VALUES (3,'cnt-0001',NULL,3,'Ishaan','Verma','ishaan@northside.example','ishaan@northside.example','9876500021','Head buyer','CUSTOMER','REFERRAL','','','India',1,NULL,'2026-08-25 14:11:57.505001','2026-08-25 14:11:57.505006',NULL),(4,'cnt-0002',NULL,4,'Meera','Nair','meera@asterco.example','meera@asterco.example','9876500022','Owner','QUALIFIED','REFERRAL','','','India',1,NULL,'2026-08-25 14:11:57.506711','2026-08-25 14:11:57.506715',NULL),(5,'cnt-0003',NULL,5,'Rhea','Kapoor','rhea@kestrel.example','rhea@kestrel.example','9876500023','Stylist','LEAD','REFERRAL','','','India',1,NULL,'2026-08-25 14:11:57.510775','2026-08-25 14:11:57.510781',NULL),(6,'cnt-0004',NULL,NULL,'Devan','Rao','devan@example.com','devan@example.com','9876500024','','CUSTOMER','REFERRAL','','','India',1,NULL,'2026-08-25 14:11:57.513736','2026-08-25 14:11:57.513744',NULL),(7,'cnt-0005',NULL,NULL,'Smoke','Test Buyer','smoke-test@example.com','smoke-test@example.com','9876500011','','QUALIFIED','INSTAGRAM','','','India',1,NULL,'2026-08-25 14:26:44.015044','2026-08-25 14:26:44.213574','2026-08-25 14:26:44.213357'),(8,'cnt-0006',NULL,NULL,'Smoke','Test Buyer','smoke-test@example.com','smoke-test@example.com','9876500011','','QUALIFIED','INSTAGRAM','','','India',1,NULL,'2026-08-25 14:26:51.306440','2026-08-25 14:26:51.484145','2026-08-25 14:26:51.483751'),(9,'cnt-0007',NULL,NULL,'Smoke','Test Buyer','smoke-test@example.com','smoke-test@example.com','9876500011','','QUALIFIED','INSTAGRAM','','','India',1,NULL,'2026-08-25 14:27:07.099072','2026-08-25 14:27:07.310806','2026-08-25 14:27:07.310398'),(10,'cnt-0008',NULL,NULL,'Smoke','Test Buyer','smoke-test@example.com','smoke-test@example.com','9876500011','','QUALIFIED','INSTAGRAM','','','India',1,NULL,'2026-08-25 14:27:23.162824','2026-08-25 14:27:23.342317','2026-08-25 14:27:23.341785'),(11,'cnt-0009',NULL,NULL,'Smoke','Test Buyer','smoke-test@example.com','smoke-test@example.com','9876500011','','QUALIFIED','INSTAGRAM','','','India',1,NULL,'2026-08-25 15:05:28.640285','2026-08-25 15:05:28.770813','2026-08-25 15:05:28.770577'),(12,'cnt-0010',NULL,NULL,'Smoke','Test Buyer','smoke-test@example.com','smoke-test@example.com','9876500011','','QUALIFIED','INSTAGRAM','','','India',1,NULL,'2026-08-27 10:42:51.779806','2026-08-27 10:42:51.957187','2026-08-27 10:42:51.956976'),(13,'cnt-0011',NULL,NULL,'Smoke','Test Buyer','smoke-test@example.com','smoke-test@example.com','9876500011','','QUALIFIED','INSTAGRAM','','','India',1,NULL,'2026-08-27 13:20:56.493582','2026-08-27 13:20:56.735349','2026-08-27 13:20:56.734389');
/*!40000 ALTER TABLE `crm_contacts` ENABLE KEYS */;

--
-- Table structure for table `crm_deals`
--

DROP TABLE IF EXISTS `crm_deals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_deals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `title` varchar(190) NOT NULL,
  `pipeline_id` bigint(20) unsigned NOT NULL,
  `stage_id` bigint(20) unsigned NOT NULL,
  `contact_id` bigint(20) unsigned DEFAULT NULL,
  `company_id` bigint(20) unsigned DEFAULT NULL,
  `order_id` bigint(20) unsigned DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'INR',
  `status` varchar(8) NOT NULL DEFAULT 'OPEN',
  `probability` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `source` varchar(24) NOT NULL DEFAULT 'OTHER',
  `expected_close_on` date DEFAULT NULL,
  `closed_at` datetime(6) DEFAULT NULL,
  `lost_reason` varchar(190) NOT NULL DEFAULT '',
  `owner_user_id` bigint(20) unsigned DEFAULT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `last_activity_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_crm_deals_public_id` (`public_id`),
  KEY `ix_crm_deals_board` (`pipeline_id`,`stage_id`,`position`),
  KEY `ix_crm_deals_contact` (`contact_id`,`deleted_at`),
  KEY `ix_crm_deals_company` (`company_id`,`deleted_at`),
  KEY `ix_crm_deals_owner` (`owner_user_id`,`status`,`deleted_at`),
  KEY `ix_crm_deals_closed` (`status`,`closed_at`),
  KEY `fk_crm_deals_stage` (`stage_id`),
  KEY `fk_crm_deals_order` (`order_id`),
  CONSTRAINT `fk_crm_deals_company` FOREIGN KEY (`company_id`) REFERENCES `crm_companies` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_crm_deals_contact` FOREIGN KEY (`contact_id`) REFERENCES `crm_contacts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_crm_deals_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_crm_deals_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_crm_deals_pipeline` FOREIGN KEY (`pipeline_id`) REFERENCES `crm_pipelines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_crm_deals_stage` FOREIGN KEY (`stage_id`) REFERENCES `crm_stages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_deals`
--

/*!40000 ALTER TABLE `crm_deals` DISABLE KEYS */;
INSERT INTO `crm_deals` (`id`, `public_id`, `title`, `pipeline_id`, `stage_id`, `contact_id`, `company_id`, `order_id`, `amount`, `currency`, `status`, `probability`, `source`, `expected_close_on`, `closed_at`, `lost_reason`, `owner_user_id`, `position`, `last_activity_at`, `created_at`, `updated_at`, `deleted_at`) VALUES (3,'deal-0001','Northside AW pre-order',1,2,3,3,NULL,428000.00,'INR','OPEN',40,'REFERRAL',NULL,NULL,'',1,100,'2026-08-25 15:10:19.572349','2026-08-25 14:11:57.518557','2026-08-25 15:10:19.572562',NULL),(4,'deal-0002','Aster & Co capsule drop',1,3,4,4,NULL,186500.00,'INR','OPEN',60,'REFERRAL',NULL,NULL,'',1,100,NULL,'2026-08-25 14:11:57.523284','2026-08-25 14:11:57.523291',NULL),(5,'deal-0003','Kestrel editorial pull',1,1,5,5,NULL,62000.00,'INR','OPEN',15,'REFERRAL',NULL,NULL,'',1,100,NULL,'2026-08-25 14:11:57.525909','2026-08-25 14:11:57.525916',NULL),(6,'deal-0004','Northside repeat order',1,5,3,3,NULL,214000.00,'INR','WON',100,'REFERRAL',NULL,'2026-08-25 14:11:57.531413','',1,100,NULL,'2026-08-25 14:11:57.528459','2026-08-25 14:11:57.532118',NULL),(7,'deal-0005','Smoke Test pop-up order',1,5,7,NULL,NULL,184000.00,'INR','WON',100,'INSTAGRAM','2026-09-30','2026-08-25 14:26:44.150148','',1,100,'2026-08-25 14:26:44.097493','2026-08-25 14:26:44.019059','2026-08-25 14:26:44.204195','2026-08-25 14:26:44.204013'),(8,'deal-0006','Smoke Test pop-up order',1,5,8,NULL,NULL,184000.00,'INR','WON',100,'INSTAGRAM','2026-09-30','2026-08-25 14:26:51.425714','',1,100,'2026-08-25 14:26:51.392482','2026-08-25 14:26:51.316709','2026-08-25 14:26:51.474271','2026-08-25 14:26:51.473916'),(9,'deal-0007','Smoke Test pop-up order',1,5,9,NULL,NULL,184000.00,'INR','WON',100,'INSTAGRAM','2026-09-30','2026-08-25 14:27:07.214590','',1,100,'2026-08-25 14:27:07.171987','2026-08-25 14:27:07.102837','2026-08-25 14:27:07.297070','2026-08-25 14:27:07.296431'),(10,'deal-0008','Smoke Test pop-up order',1,5,10,NULL,NULL,184000.00,'INR','WON',100,'INSTAGRAM','2026-09-30','2026-08-25 14:27:23.267591','',1,100,'2026-08-25 14:27:23.229109','2026-08-25 14:27:23.166688','2026-08-25 14:27:23.331519','2026-08-25 14:27:23.331121'),(11,'deal-0009','Smoke Test pop-up order',1,5,11,NULL,NULL,184000.00,'INR','WON',100,'INSTAGRAM','2026-09-30','2026-08-25 15:05:28.721168','',1,100,'2026-08-25 15:05:28.691258','2026-08-25 15:05:28.643211','2026-08-25 15:05:28.761857','2026-08-25 15:05:28.761587'),(12,'deal-0010','Smoke Test pop-up order',1,5,12,NULL,NULL,184000.00,'INR','WON',100,'INSTAGRAM','2026-09-30','2026-08-27 10:42:51.904550','',1,100,'2026-08-27 10:42:51.858784','2026-08-27 10:42:51.786068','2026-08-27 10:42:51.949599','2026-08-27 10:42:51.942286'),(13,'deal-0011','Smoke Test pop-up order',1,5,13,NULL,NULL,184000.00,'INR','WON',100,'INSTAGRAM','2026-09-30','2026-08-27 13:20:56.644177','',1,100,'2026-08-27 13:20:56.590132','2026-08-27 13:20:56.500523','2026-08-27 13:20:56.720042','2026-08-27 13:20:56.719115');
/*!40000 ALTER TABLE `crm_deals` ENABLE KEYS */;

--
-- Table structure for table `crm_leads`
--

DROP TABLE IF EXISTS `crm_leads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_leads` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `name` varchar(160) NOT NULL,
  `email` varchar(190) NOT NULL DEFAULT '',
  `email_normalized` varchar(190) NOT NULL DEFAULT '',
  `phone` varchar(20) NOT NULL DEFAULT '',
  `company_name` varchar(160) NOT NULL DEFAULT '',
  `source` varchar(24) NOT NULL DEFAULT 'WEBSITE',
  `status` varchar(16) NOT NULL DEFAULT 'NEW',
  `score` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `message` text DEFAULT NULL,
  `owner_user_id` bigint(20) unsigned DEFAULT NULL,
  `converted_contact_id` bigint(20) unsigned DEFAULT NULL,
  `converted_deal_id` bigint(20) unsigned DEFAULT NULL,
  `converted_at` datetime(6) DEFAULT NULL,
  `lost_reason` varchar(190) NOT NULL DEFAULT '',
  `last_activity_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_crm_leads_public_id` (`public_id`),
  KEY `ix_crm_leads_status` (`status`,`deleted_at`),
  KEY `ix_crm_leads_owner` (`owner_user_id`,`deleted_at`),
  KEY `ix_crm_leads_email` (`email_normalized`),
  KEY `ix_crm_leads_created` (`created_at`),
  KEY `fk_crm_leads_contact` (`converted_contact_id`),
  CONSTRAINT `fk_crm_leads_contact` FOREIGN KEY (`converted_contact_id`) REFERENCES `crm_contacts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_crm_leads_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_leads`
--

/*!40000 ALTER TABLE `crm_leads` DISABLE KEYS */;
INSERT INTO `crm_leads` (`id`, `public_id`, `name`, `email`, `email_normalized`, `phone`, `company_name`, `source`, `status`, `score`, `message`, `owner_user_id`, `converted_contact_id`, `converted_deal_id`, `converted_at`, `lost_reason`, `last_activity_at`, `created_at`, `updated_at`, `deleted_at`) VALUES (3,'lead-0001','Priya Shah','priya@example.com','priya@example.com','9876500031','Loom & Ash','INSTAGRAM','NEW',65,'Saw the AW campaign, asking about wholesale terms.',NULL,NULL,NULL,NULL,'',NULL,'2026-08-25 14:11:57.534946','2026-08-25 14:11:57.534954',NULL),(4,'lead-0002','Arjun Menon','arjun@example.com','arjun@example.com','9876500032','','WEBSITE','CONTACTED',40,'Wants to know when the heavyweight hoodie restocks.',1,NULL,NULL,NULL,'',NULL,'2026-08-25 14:11:57.537254','2026-08-25 14:11:57.537262',NULL),(5,'lead-0003','Sana Qureshi','sana@example.com','sana@example.com','9876500033','The Fifth Wall','REFERRAL','QUALIFIED',80,'Referred by Aster & Co. Opening a second store in October.',1,NULL,NULL,NULL,'',NULL,'2026-08-25 14:11:57.539183','2026-08-25 14:11:57.539188',NULL),(6,'lead-0004','Vikram Iyer','vikram@example.com','vikram@example.com','','','WALK_IN','UNQUALIFIED',10,'Walked in asking about a bulk discount on one piece.',1,NULL,NULL,NULL,'',NULL,'2026-08-25 14:11:57.542038','2026-08-25 14:11:57.542045',NULL),(7,'lead-0005','Smoke Test Buyer','smoke-test@example.com','smoke-test@example.com','9876500011','Smoke Test Retail','INSTAGRAM','CONVERTED',85,'Wants 40 units of the Afterdark Hoodie for a pop-up.',1,7,7,'2026-08-25 14:26:44.020569','',NULL,'2026-08-25 14:26:43.960559','2026-08-25 14:26:44.221928','2026-08-25 14:26:44.221598'),(8,'lead-0006','Smoke Test Buyer','smoke-test@example.com','smoke-test@example.com','9876500011','Smoke Test Retail','INSTAGRAM','CONVERTED',85,'Wants 40 units of the Afterdark Hoodie for a pop-up.',1,8,8,'2026-08-25 14:26:51.318094','',NULL,'2026-08-25 14:26:51.273425','2026-08-25 14:26:51.493597','2026-08-25 14:26:51.493343'),(9,'lead-0007','Smoke Test Buyer','smoke-test@example.com','smoke-test@example.com','9876500011','Smoke Test Retail','INSTAGRAM','CONVERTED',85,'Wants 40 units of the Afterdark Hoodie for a pop-up.',1,9,9,'2026-08-25 14:27:07.103365','',NULL,'2026-08-25 14:27:07.045602','2026-08-25 14:27:07.322195','2026-08-25 14:27:07.321886'),(10,'lead-0008','Smoke Test Buyer','smoke-test@example.com','smoke-test@example.com','9876500011','Smoke Test Retail','INSTAGRAM','CONVERTED',85,'Wants 40 units of the Afterdark Hoodie for a pop-up.',1,10,10,'2026-08-25 14:27:23.167564','',NULL,'2026-08-25 14:27:23.121753','2026-08-25 14:27:23.353845','2026-08-25 14:27:23.353698'),(11,'lead-0009','Smoke Test Buyer','smoke-test@example.com','smoke-test@example.com','9876500011','Smoke Test Retail','INSTAGRAM','CONVERTED',85,'Wants 40 units of the Afterdark Hoodie for a pop-up.',1,11,11,'2026-08-25 15:05:28.644513','',NULL,'2026-08-25 15:05:28.601742','2026-08-25 15:05:28.777924','2026-08-25 15:05:28.777690'),(12,'lead-0010','Smoke Test Buyer','smoke-test@example.com','smoke-test@example.com','9876500011','Smoke Test Retail','INSTAGRAM','CONVERTED',85,'Wants 40 units of the Afterdark Hoodie for a pop-up.',1,12,12,'2026-08-27 10:42:51.787165','',NULL,'2026-08-27 10:42:51.747437','2026-08-27 10:42:51.972748','2026-08-27 10:42:51.972498'),(13,'lead-0011','Smoke Test Buyer','smoke-test@example.com','smoke-test@example.com','9876500011','Smoke Test Retail','INSTAGRAM','CONVERTED',85,'Wants 40 units of the Afterdark Hoodie for a pop-up.',1,13,13,'2026-08-27 13:20:56.503307','',NULL,'2026-08-27 13:20:56.458385','2026-08-27 13:20:56.750140','2026-08-27 13:20:56.749071');
/*!40000 ALTER TABLE `crm_leads` ENABLE KEYS */;

--
-- Table structure for table `crm_notes`
--

DROP TABLE IF EXISTS `crm_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_notes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `subject_type` varchar(12) NOT NULL,
  `subject_id` bigint(20) unsigned NOT NULL,
  `body` text NOT NULL,
  `pinned` tinyint(1) NOT NULL DEFAULT 0,
  `author_user_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_crm_notes_public_id` (`public_id`),
  KEY `ix_crm_notes_subject` (`subject_type`,`subject_id`,`pinned`,`created_at`),
  KEY `fk_crm_notes_author` (`author_user_id`),
  CONSTRAINT `fk_crm_notes_author` FOREIGN KEY (`author_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_notes`
--

/*!40000 ALTER TABLE `crm_notes` DISABLE KEYS */;
INSERT INTO `crm_notes` (`id`, `public_id`, `subject_type`, `subject_id`, `body`, `pinned`, `author_user_id`, `created_at`, `updated_at`, `deleted_at`) VALUES (1,'note-00001','contact',1,'Calls only after 6pm.',1,1,'2026-08-25 13:34:54.545189','2026-08-25 13:34:54.545204',NULL),(2,'note-00002','contact',2,'Calls only after 6pm.',1,1,'2026-08-25 13:36:07.129731','2026-08-25 13:36:07.129743',NULL),(3,'note-00003','contact',3,'Calls only after 6pm — he is on the shop floor until then.',1,1,'2026-08-25 14:11:57.557521','2026-08-25 14:11:57.557526',NULL),(4,'note-00004','deal',4,'Meera wants the capsule exclusive to her store for the first two weeks.',0,1,'2026-08-25 14:11:57.559265','2026-08-25 14:11:57.559269',NULL),(5,'note-00005','contact',3,'Wants the AW linesheet before the 12th. Confirmed on the call.',0,1,'2026-08-25 14:18:18.458598','2026-08-25 14:18:43.467799','2026-08-25 14:18:43.467218'),(6,'note-00006','contact',7,'Calls only after 6pm.',1,1,'2026-08-25 14:26:44.062256','2026-08-25 14:26:44.062261',NULL),(7,'note-00007','contact',8,'Calls only after 6pm.',1,1,'2026-08-25 14:26:51.354251','2026-08-25 14:26:51.354256',NULL),(8,'note-00008','contact',9,'Calls only after 6pm.',1,1,'2026-08-25 14:27:07.139052','2026-08-25 14:27:07.139063',NULL),(9,'note-00009','contact',10,'Calls only after 6pm.',1,1,'2026-08-25 14:27:23.200133','2026-08-25 14:27:23.200138',NULL),(10,'note-00010','contact',11,'Calls only after 6pm.',1,1,'2026-08-25 15:05:28.668013','2026-08-25 15:05:28.668020',NULL),(11,'note-00011','contact',12,'Calls only after 6pm.',1,1,'2026-08-27 10:42:51.816446','2026-08-27 10:42:51.816451',NULL),(12,'note-00012','contact',13,'Calls only after 6pm.',1,1,'2026-08-27 13:20:56.543515','2026-08-27 13:20:56.543525',NULL);
/*!40000 ALTER TABLE `crm_notes` ENABLE KEYS */;

--
-- Table structure for table `crm_pipelines`
--

DROP TABLE IF EXISTS `crm_pipelines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_pipelines` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `name` varchar(80) NOT NULL,
  `slug` varchar(80) NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `position` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_crm_pipelines_public_id` (`public_id`),
  UNIQUE KEY `uq_crm_pipelines_slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_pipelines`
--

/*!40000 ALTER TABLE `crm_pipelines` DISABLE KEYS */;
INSERT INTO `crm_pipelines` (`id`, `public_id`, `name`, `slug`, `is_default`, `position`, `created_at`, `updated_at`, `deleted_at`) VALUES (1,'pipe-01','Sales','sales',1,0,'2026-08-25 13:31:08.226037','2026-08-25 13:31:08.226037',NULL);
/*!40000 ALTER TABLE `crm_pipelines` ENABLE KEYS */;

--
-- Table structure for table `crm_stages`
--

DROP TABLE IF EXISTS `crm_stages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_stages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `pipeline_id` bigint(20) unsigned NOT NULL,
  `name` varchar(80) NOT NULL,
  `slug` varchar(80) NOT NULL,
  `kind` varchar(8) NOT NULL DEFAULT 'OPEN',
  `probability` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `position` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_crm_stages_public_id` (`public_id`),
  UNIQUE KEY `uq_crm_stages_slug_per_pipeline` (`pipeline_id`,`slug`),
  KEY `ix_crm_stages_board` (`pipeline_id`,`position`),
  CONSTRAINT `fk_crm_stages_pipeline` FOREIGN KEY (`pipeline_id`) REFERENCES `crm_pipelines` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_stages`
--

/*!40000 ALTER TABLE `crm_stages` DISABLE KEYS */;
INSERT INTO `crm_stages` (`id`, `public_id`, `pipeline_id`, `name`, `slug`, `kind`, `probability`, `position`, `created_at`, `updated_at`, `deleted_at`) VALUES (1,'stage-01',1,'New','new','OPEN',10,0,'2026-08-25 13:31:08.233111','2026-08-25 13:31:08.233111',NULL),(2,'stage-02',1,'Qualified','qualified','OPEN',30,1,'2026-08-25 13:31:08.233111','2026-08-25 13:31:08.233111',NULL),(3,'stage-03',1,'Proposal','proposal','OPEN',55,2,'2026-08-25 13:31:08.233111','2026-08-25 13:31:08.233111',NULL),(4,'stage-04',1,'Negotiation','negotiation','OPEN',75,3,'2026-08-25 13:31:08.233111','2026-08-25 13:31:08.233111',NULL),(5,'stage-05',1,'Won','won','WON',100,4,'2026-08-25 13:31:08.233111','2026-08-25 13:31:08.233111',NULL),(6,'stage-06',1,'Lost','lost','LOST',0,5,'2026-08-25 13:31:08.233111','2026-08-25 13:31:08.233111',NULL);
/*!40000 ALTER TABLE `crm_stages` ENABLE KEYS */;

--
-- Table structure for table `domain_events_outbox`
--

DROP TABLE IF EXISTS `domain_events_outbox`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `domain_events_outbox` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `event_id` char(36) NOT NULL,
  `type` varchar(80) NOT NULL,
  `payload_json` mediumtext DEFAULT NULL,
  `occurred_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `processed_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_domain_events_event_id` (`event_id`),
  KEY `ix_domain_events_pending` (`processed_at`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `domain_events_outbox`
--

/*!40000 ALTER TABLE `domain_events_outbox` DISABLE KEYS */;
/*!40000 ALTER TABLE `domain_events_outbox` ENABLE KEYS */;

--
-- Table structure for table `faqs`
--

DROP TABLE IF EXISTS `faqs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `faqs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `question` varchar(255) NOT NULL,
  `answer` text NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_faqs_active` (`is_active`,`position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `faqs`
--

/*!40000 ALTER TABLE `faqs` DISABLE KEYS */;
/*!40000 ALTER TABLE `faqs` ENABLE KEYS */;

--
-- Table structure for table `home_hero_slides`
--

DROP TABLE IF EXISTS `home_hero_slides`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `home_hero_slides` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `product_id` bigint(20) unsigned DEFAULT NULL,
  `source_kind` varchar(16) NOT NULL DEFAULT 'Upload',
  `alt` varchar(190) NOT NULL DEFAULT '',
  `source_media_id` bigint(20) unsigned DEFAULT NULL,
  `cutout_media_id` bigint(20) unsigned DEFAULT NULL,
  `cutout_state` varchar(16) NOT NULL DEFAULT 'Pending',
  `cutout_detail` varchar(255) NOT NULL DEFAULT '',
  `cutout_edge_clear` tinyint(3) unsigned NOT NULL DEFAULT 100,
  `cutout_at` datetime(6) DEFAULT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_home_hero_slides_public` (`public_id`),
  KEY `ix_home_hero_slides_running` (`is_active`,`position`,`id`),
  KEY `ix_home_hero_slides_product` (`product_id`),
  KEY `fk_home_hero_slides_source` (`source_media_id`),
  KEY `fk_home_hero_slides_cutout` (`cutout_media_id`),
  CONSTRAINT `fk_home_hero_slides_cutout` FOREIGN KEY (`cutout_media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_home_hero_slides_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_home_hero_slides_source` FOREIGN KEY (`source_media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `home_hero_slides`
--

/*!40000 ALTER TABLE `home_hero_slides` DISABLE KEYS */;
/*!40000 ALTER TABLE `home_hero_slides` ENABLE KEYS */;

--
-- Table structure for table `idempotency_keys`
--

DROP TABLE IF EXISTS `idempotency_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `idempotency_keys` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `scope` varchar(120) NOT NULL,
  `endpoint` varchar(160) NOT NULL,
  `key_hash` binary(32) NOT NULL,
  `request_hash` binary(32) NOT NULL,
  `response_status` smallint(5) unsigned NOT NULL DEFAULT 200,
  `response_body` mediumtext DEFAULT NULL,
  `expires_at` datetime(6) NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_idempotency_keys` (`scope`,`endpoint`,`key_hash`),
  KEY `ix_idempotency_keys_expiry` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `idempotency_keys`
--

/*!40000 ALTER TABLE `idempotency_keys` DISABLE KEYS */;
INSERT INTO `idempotency_keys` (`id`, `scope`, `endpoint`, `key_hash`, `request_hash`, `response_status`, `response_body`, `expires_at`, `created_at`) VALUES (1,'customer:cus-2050','POST /checkout/orders',0xDA397828C15B0AFB3EEDEC64BBA542E7FC689EF9F8D2E781B35D96081E9186BA,0xD5BCD6E90BE4A81AB0DE4C1C9FCAB54C42147057CAC1E547A941E6DD11F3E38B,201,'{\"data\":{\"id\":\"ord-local-01\",\"number\":\"IO-2026-1049\",\"date\":\"17 Aug 2026\",\"total\":\"₹9,800\",\"status\":\"Processing\",\"items\":\"Shadow Cargo 02\",\"lines\":[{\"id\":\"ord-local-01-l1\",\"name\":\"Shadow Cargo 02\",\"variant\":\"Charcoal / M\",\"quantity\":1,\"price\":\"₹9,800\",\"returnEligible\":false}],\"payment\":{\"method\":\"Cash on delivery\",\"status\":\"Due on delivery\",\"reference\":\"pay_••••2001\",\"note\":\"The courier collects it at the door\"},\"shipment\":{\"token\":\"\",\"service\":\"Standard delivery\",\"awb\":\"\",\"destination\":\"\",\"estimate\":\"\"},\"cancellationEligible\":true}}','2026-08-19 09:58:03.052090','2026-08-17 09:58:03.052099'),(2,'customer:cus-2051','POST /checkout/orders',0xF286597D7E1A43FE6AB43A2DC78E537419A89D8516EE7169C316D7133566334D,0xFF3D227061C0634BB73B4620EA87ECC7DF0AB853BBB2F83695852D6283542FC3,201,'{\"data\":{\"id\":\"ord-1001\",\"number\":\"IO-2026-1050\",\"date\":\"17 Aug 2026\",\"total\":\"₹9,800\",\"status\":\"Processing\",\"items\":\"Shadow Cargo 02\",\"lines\":[{\"id\":\"ord-1001-l1\",\"name\":\"Shadow Cargo 02\",\"variant\":\"Charcoal / M\",\"quantity\":1,\"price\":\"₹9,800\",\"returnEligible\":false}],\"payment\":{\"method\":\"Cash on delivery\",\"status\":\"Due on delivery\",\"reference\":\"pay_••••2002\",\"note\":\"The courier collects it at the door\"},\"shipment\":{\"token\":\"\",\"service\":\"Standard delivery\",\"awb\":\"\",\"destination\":\"\",\"estimate\":\"\"},\"cancellationEligible\":true}}','2026-08-19 10:08:26.867692','2026-08-17 10:08:26.867721'),(3,'customer:cus-2050','POST /checkout/orders',0xDA9C734FFC2DA3CCA7AC80BF0E184C3F0F05E3CCA3F6567E041F4064CDAB717B,0x6B7CFE53F923ABFB5B1C4953AA39ECD60DE1CD60A20CB2B0549FE5B63FD74D19,201,'{\"data\":{\"id\":\"ord-1001\",\"number\":\"IO-2026-1050\",\"date\":\"19 Aug 2026\",\"total\":\"₹5,000\",\"status\":\"Processing\",\"items\":\"demo product\",\"lines\":[{\"id\":\"ord-1001-l1\",\"name\":\"demo product\",\"variant\":\" / 32\",\"quantity\":1,\"price\":\"₹5,000\",\"returnEligible\":false}],\"payment\":{\"method\":\"Cash on delivery\",\"status\":\"Due on delivery\",\"reference\":\"pay_••••2002\",\"note\":\"The courier collects it at the door\"},\"shipment\":{\"token\":\"\",\"service\":\"Standard delivery\",\"awb\":\"\",\"destination\":\"\",\"estimate\":\"\"},\"cancellationEligible\":true}}','2026-08-21 09:41:41.072864','2026-08-19 09:41:41.072882'),(4,'customer:cus-2050','POST /checkout/orders',0x5D0677FEDBA68C8D1BE3F2BE774EB55C4053506C7E68ED6D5BD8A9D30FFEE2E9,0xF059226742FDED4997C871DA921293F05908346AD4EF705A5727A6EF977D7307,201,'{\"data\":{\"id\":\"ord-1002\",\"number\":\"IO-2026-1051\",\"date\":\"24 Aug 2026\",\"total\":\"₹13,900\",\"status\":\"Processing\",\"items\":\"Ivory Work Jacket\",\"lines\":[{\"id\":\"ord-1002-l1\",\"name\":\"Ivory Work Jacket\",\"variant\":\"Ivory / XL\",\"quantity\":1,\"price\":\"₹13,900\",\"returnEligible\":false}],\"payment\":{\"method\":\"Cash on delivery\",\"status\":\"Due on delivery\",\"reference\":\"pay_••••2003\",\"note\":\"The courier collects it at the door\"},\"shipment\":{\"token\":\"\",\"service\":\"Standard delivery\",\"awb\":\"\",\"destination\":\"\",\"estimate\":\"\"},\"cancellationEligible\":true}}','2026-08-26 06:47:20.398613','2026-08-24 06:47:20.398623'),(5,'customer:cus-2050','POST /checkout/orders',0x70B83F0CEC29D6AF3D27C410877F0C0585BE6BFE8250274C768BDBE081535FE8,0x70DF4276F3CA153AA6B4AB1240AEB435335739F16CED6E9A7C57C1117FB3EB87,201,'{\"data\":{\"id\":\"ord-1003\",\"number\":\"IO-2026-1052\",\"date\":\"24 Aug 2026\",\"total\":\"₹12,400\",\"status\":\"Payment failed\",\"items\":\"Freight Overshirt\",\"lines\":[{\"id\":\"ord-1003-l1\",\"name\":\"Freight Overshirt\",\"variant\":\"Bone / M\",\"quantity\":1,\"price\":\"₹12,400\",\"returnEligible\":false}],\"payment\":{\"method\":\"Razorpay\",\"status\":\"Failed\",\"reference\":\"pay_••••2004\",\"note\":\"Payment was closed before it completed. Nothing has been charged.\"},\"shipment\":{\"token\":\"\",\"service\":\"Standard delivery\",\"awb\":\"\",\"destination\":\"\",\"estimate\":\"\"},\"cancellationEligible\":true}}','2026-08-26 07:08:19.275060','2026-08-24 07:08:19.275072'),(6,'customer:cus-2050','POST /checkout/orders',0xFA8A21A8C9129CD8BDA8682E90FA303AFF071E335BFDB2173595DBFA850A6BE3,0x2B39D883BBECF694287FC652BFD6FA5D8B781CF13AF9C1F93A6AED0C559BAB3A,201,'{\"data\":{\"id\":\"ord-1004\",\"number\":\"IO-2026-1053\",\"date\":\"24 Aug 2026\",\"total\":\"₹5,000\",\"status\":\"Processing\",\"items\":\"demo product\",\"lines\":[{\"id\":\"ord-1004-l1\",\"name\":\"demo product\",\"variant\":\" / 32\",\"quantity\":1,\"price\":\"₹5,000\",\"returnEligible\":false}],\"payment\":{\"method\":\"Razorpay · Card / UPI / Netbanking\",\"status\":\"Captured\",\"reference\":\"pay_••••2005\",\"note\":\"Taken at checkout\"},\"shipment\":{\"token\":\"\",\"service\":\"Standard delivery\",\"awb\":\"\",\"destination\":\"\",\"estimate\":\"\"},\"cancellationEligible\":true}}','2026-08-26 07:38:07.557176','2026-08-24 07:38:07.557188'),(7,'customer:cus-2062','POST /me/wallet/redeem',0x2BB0C1C3FB71C119F9BEB023345A5052D5DF6537C8B076E81F9B50C158F3CF28,0xA4E6683F9CD0E2B9C99F39FA833E78274B542130105BDFC0C77281FDAF298B81,201,'{\"data\":{\"added\":2400,\"balance\":5301,\"entry\":{\"id\":\"wtx-000011\",\"direction\":\"credit\",\"sign\":\"+\",\"amount\":2400,\"balanceAfter\":5301,\"kind\":\"voucher\",\"reference\":\"IOV901\",\"title\":\"Voucher IOV901\",\"note\":\"Delayed delivery, on us\",\"at\":\"2026-08-24 08:24:23.755177\"}}}','2026-08-26 08:24:23.773344','2026-08-24 08:24:23.773378'),(8,'customer:cus-2050','POST /me/wallet/redeem',0x06C5325EEA8B7E947297534C88F46CDA39C92257A7604FAAFEF8D6FF6B7956F4,0x1BB7D08015CC831BA4B8E3A6DE82CD986E4EE98AD005328E7263CF1EDA6CECEE,201,'{\"data\":{\"added\":1150,\"balance\":1150,\"entry\":{\"id\":\"wtx-000012\",\"direction\":\"credit\",\"sign\":\"+\",\"amount\":1150,\"balanceAfter\":1150,\"kind\":\"voucher\",\"reference\":\"IOV001\",\"title\":\"Voucher IOV001\",\"note\":\"somthing\",\"at\":\"2026-08-25 07:00:01.047551\"}}}','2026-08-27 07:00:01.066323','2026-08-25 07:00:01.066363'),(9,'customer:cus-2050','POST /me/wallet/redeem',0x48055FCDDD2BBE479776727FA8F5B981C8B9B708B301FEE08BB4A6A115693898,0xB486CBEBA1B59AEB0D43AF60DE09B17244EA661AFF18F11A2F8950A525FA26DD,201,'{\"data\":{\"added\":2000,\"balance\":3150,\"entry\":{\"id\":\"wtx-000013\",\"direction\":\"credit\",\"sign\":\"+\",\"amount\":2000,\"balanceAfter\":3150,\"kind\":\"voucher\",\"reference\":\"IOV002\",\"title\":\"Voucher IOV002\",\"note\":\"somthing\",\"at\":\"2026-08-25 07:13:35.589334\"}}}','2026-08-27 07:13:35.611433','2026-08-25 07:13:35.611467'),(10,'customer:cus-2050','POST /checkout/orders',0x51622E704593F18B8424998C1F2DFF5AC1DED42D5B05F0CA32FEB91730E8C1F1,0x7F6147791E3833BFEB1ADDE01922D3DB4A32AC4987EA7B30A9FDA1D16B5B09F7,201,'{\"data\":{\"id\":\"ord-1005\",\"number\":\"IO-2026-1054\",\"date\":\"25 Aug 2026\",\"total\":\"₹8,600\",\"status\":\"Processing\",\"items\":\"Washed Crop Hoodie\",\"lines\":[{\"id\":\"ord-1005-l1\",\"name\":\"Washed Crop Hoodie\",\"variant\":\"Gravel / XL\",\"quantity\":1,\"price\":\"₹8,600\",\"returnEligible\":false}],\"payment\":{\"method\":\"Cash on delivery\",\"status\":\"Due on delivery\",\"reference\":\"pay_••••2006\",\"note\":\"The courier collects it at the door\"},\"shipment\":{\"token\":\"\",\"service\":\"Standard delivery\",\"awb\":\"\",\"destination\":\"\",\"estimate\":\"\"},\"cancellationEligible\":true}}','2026-08-27 07:13:59.471796','2026-08-25 07:13:59.471805'),(11,'customer:cus-2063','POST /checkout/orders',0x6E244EDF4FC034010B95E7408E9A4287B168EC6EFBB02D783A9889A60674D187,0x82FDF7B6D9FE80CFD69A30F575717C4209A324ACCF51F711F192646F734C5530,201,'{\"data\":{\"id\":\"ord-1006\",\"number\":\"IO-2026-1055\",\"date\":\"25 Aug 2026\",\"total\":\"₹8,600\",\"status\":\"Processing\",\"items\":\"Gravel Wash Hoodie\",\"lines\":[{\"id\":\"ord-1006-l1\",\"name\":\"Gravel Wash Hoodie\",\"variant\":\"Gravel / M\",\"quantity\":1,\"price\":\"₹8,600\",\"returnEligible\":false}],\"payment\":{\"method\":\"Cash on delivery\",\"status\":\"Due on delivery\",\"reference\":\"pay_••••2007\",\"note\":\"The courier collects it at the door\"},\"shipment\":{\"token\":\"\",\"service\":\"Standard delivery\",\"awb\":\"\",\"destination\":\"\",\"estimate\":\"\"},\"cancellationEligible\":true}}','2026-08-27 07:25:37.824100','2026-08-25 07:25:37.824124');
/*!40000 ALTER TABLE `idempotency_keys` ENABLE KEYS */;

--
-- Table structure for table `inbox_messages`
--

DROP TABLE IF EXISTS `inbox_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inbox_messages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `subject` varchar(160) NOT NULL,
  `preview` varchar(255) NOT NULL DEFAULT '',
  `type` varchar(16) NOT NULL DEFAULT 'Order',
  `sent_at` datetime(6) NOT NULL,
  `read_at` datetime(6) DEFAULT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inbox_messages_user_public` (`user_id`,`public_id`),
  KEY `ix_inbox_messages_user` (`user_id`,`deleted_at`,`sent_at`),
  CONSTRAINT `fk_inbox_messages_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inbox_messages`
--

/*!40000 ALTER TABLE `inbox_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `inbox_messages` ENABLE KEYS */;

--
-- Table structure for table `inventory_movements`
--

DROP TABLE IF EXISTS `inventory_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inventory_movements` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `stock_item_id` bigint(20) unsigned DEFAULT NULL,
  `variant_id` bigint(20) unsigned DEFAULT NULL,
  `type` varchar(24) NOT NULL,
  `qty` int(11) NOT NULL,
  `on_hand_after` int(11) DEFAULT NULL,
  `reserved_after` int(11) DEFAULT NULL,
  `reference_type` varchar(32) NOT NULL DEFAULT '',
  `reference_id` varchar(64) NOT NULL DEFAULT '',
  `idempotency_key` varchar(191) DEFAULT NULL,
  `actor_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inventory_movements_idem` (`idempotency_key`),
  KEY `ix_inventory_movements_item` (`stock_item_id`,`created_at`),
  KEY `ix_inventory_movements_variant` (`variant_id`,`created_at`),
  KEY `ix_inventory_movements_reference` (`reference_type`,`reference_id`),
  KEY `fk_inventory_movements_actor` (`actor_id`),
  CONSTRAINT `fk_inventory_movements_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inventory_movements_item` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inventory_movements_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_movements`
--

/*!40000 ALTER TABLE `inventory_movements` DISABLE KEYS */;
INSERT INTO `inventory_movements` (`id`, `stock_item_id`, `variant_id`, `type`, `qty`, `on_hand_after`, `reserved_after`, `reference_type`, `reference_id`, `idempotency_key`, `actor_id`, `created_at`) VALUES (1,4,13,'SALE_RESERVE',-1,6,1,'order','1',NULL,NULL,'2026-08-17 09:58:03.033945'),(3,74,152,'SALE_RESERVE',-1,5,1,'order','3',NULL,NULL,'2026-08-19 09:41:41.046102'),(4,15,60,'SALE_RESERVE',-1,3,1,'order','4',NULL,NULL,'2026-08-24 06:47:20.382032'),(5,15,60,'RESERVE_EXPIRE',1,3,0,'order','4',NULL,1,'2026-08-24 06:58:02.330289'),(6,19,74,'SALE_RESERVE',-1,4,1,'order','5',NULL,NULL,'2026-08-24 07:08:19.250884'),(7,74,152,'SALE_RESERVE',-1,5,2,'order','6',NULL,NULL,'2026-08-24 07:38:07.524522'),(8,74,152,'RESERVE_EXPIRE',1,5,1,'order','6',NULL,1,'2026-08-24 07:39:43.799483'),(9,35,137,'SALE_RESERVE',-1,58,1,'order','7',NULL,NULL,'2026-08-24 08:17:00.768055'),(10,23,93,'SALE_RESERVE',-1,8,1,'order','8',NULL,NULL,'2026-08-25 07:13:59.435680'),(11,22,87,'SALE_RESERVE',-1,9,1,'order','9',NULL,NULL,'2026-08-25 07:25:37.808374'),(13,1,NULL,'PURCHASE_IN',36,NULL,NULL,'production','run-0002',NULL,1,'2026-08-27 10:30:34.000000');
/*!40000 ALTER TABLE `inventory_movements` ENABLE KEYS */;

--
-- Table structure for table `inventory_reservations`
--

DROP TABLE IF EXISTS `inventory_reservations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inventory_reservations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) unsigned DEFAULT NULL,
  `order_item_id` bigint(20) unsigned DEFAULT NULL,
  `variant_id` bigint(20) unsigned NOT NULL,
  `qty` int(11) NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'HELD',
  `expires_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inventory_reservations_order_item` (`order_item_id`),
  KEY `ix_inventory_reservations_status` (`status`,`expires_at`),
  KEY `ix_inventory_reservations_variant` (`variant_id`),
  KEY `ix_inventory_reservations_order` (`order_id`),
  CONSTRAINT `fk_inventory_reservations_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inventory_reservations_order_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inventory_reservations_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_reservations`
--

/*!40000 ALTER TABLE `inventory_reservations` DISABLE KEYS */;
INSERT INTO `inventory_reservations` (`id`, `order_id`, `order_item_id`, `variant_id`, `qty`, `status`, `expires_at`, `created_at`, `updated_at`) VALUES (1,1,1,13,1,'HELD','2026-08-17 10:08:03.031701','2026-08-17 09:58:03.032006','2026-08-17 09:58:03.032006'),(3,3,3,152,1,'HELD','2026-08-19 09:51:41.041692','2026-08-19 09:41:41.042230','2026-08-19 09:41:41.042230'),(4,4,4,60,1,'RELEASED','2026-08-24 06:57:20.378883','2026-08-24 06:47:20.380818','2026-08-24 06:58:02.328131'),(5,5,5,74,1,'HELD','2026-08-24 07:18:19.250329','2026-08-24 07:08:19.250631','2026-08-24 07:08:19.250631'),(6,6,6,152,1,'RELEASED','2026-08-24 07:53:07.521806','2026-08-24 07:38:07.522124','2026-08-24 07:39:43.799102'),(8,8,8,93,1,'HELD','2026-08-25 07:23:59.426638','2026-08-25 07:13:59.432970','2026-08-25 07:13:59.432970');
/*!40000 ALTER TABLE `inventory_reservations` ENABLE KEYS */;

--
-- Table structure for table `inventory_transfer_items`
--

DROP TABLE IF EXISTS `inventory_transfer_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inventory_transfer_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `transfer_id` bigint(20) unsigned NOT NULL,
  `stock_item_id` bigint(20) unsigned NOT NULL,
  `qty` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `ix_transfer_items_transfer` (`transfer_id`),
  KEY `fk_transfer_items_stock_item` (`stock_item_id`),
  CONSTRAINT `fk_transfer_items_stock_item` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items` (`id`),
  CONSTRAINT `fk_transfer_items_transfer` FOREIGN KEY (`transfer_id`) REFERENCES `inventory_transfers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_transfer_items`
--

/*!40000 ALTER TABLE `inventory_transfer_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_transfer_items` ENABLE KEYS */;

--
-- Table structure for table `inventory_transfers`
--

DROP TABLE IF EXISTS `inventory_transfers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inventory_transfers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(16) NOT NULL,
  `from_warehouse_id` bigint(20) unsigned NOT NULL,
  `to_warehouse_id` bigint(20) unsigned NOT NULL,
  `units` int(10) unsigned NOT NULL DEFAULT 0,
  `dispatched_label` varchar(40) NOT NULL DEFAULT '',
  `status` varchar(16) NOT NULL DEFAULT 'Ready',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inventory_transfers_public_id` (`public_id`),
  KEY `ix_inventory_transfers_status` (`status`),
  KEY `fk_inventory_transfers_from` (`from_warehouse_id`),
  KEY `fk_inventory_transfers_to` (`to_warehouse_id`),
  CONSTRAINT `fk_inventory_transfers_from` FOREIGN KEY (`from_warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `fk_inventory_transfers_to` FOREIGN KEY (`to_warehouse_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_transfers`
--

/*!40000 ALTER TABLE `inventory_transfers` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_transfers` ENABLE KEYS */;

--
-- Table structure for table `job_queue`
--

DROP TABLE IF EXISTS `job_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `job_queue` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(32) NOT NULL DEFAULT 'default',
  `type` varchar(120) NOT NULL,
  `payload_json` mediumtext DEFAULT NULL,
  `attempts` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `run_after` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `locked_by` varchar(64) DEFAULT NULL,
  `locked_at` datetime(6) DEFAULT NULL,
  `done_at` datetime(6) DEFAULT NULL,
  `failed_at` datetime(6) DEFAULT NULL,
  `last_error` text DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_job_queue_claim` (`queue`,`done_at`,`failed_at`,`run_after`),
  KEY `ix_job_queue_locked` (`locked_by`,`locked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_queue`
--

/*!40000 ALTER TABLE `job_queue` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_queue` ENABLE KEYS */;

--
-- Table structure for table `login_attempts`
--

DROP TABLE IF EXISTS `login_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `login_attempts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `email_normalized` varchar(190) NOT NULL,
  `audience` varchar(16) NOT NULL,
  `ip` varbinary(16) DEFAULT NULL,
  `was_success` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_login_attempts_email` (`email_normalized`,`created_at`),
  KEY `ix_login_attempts_ip` (`ip`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=161 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `login_attempts`
--

/*!40000 ALTER TABLE `login_attempts` DISABLE KEYS */;
INSERT INTO `login_attempts` (`id`, `email_normalized`, `audience`, `ip`, `was_success`, `created_at`) VALUES (1,'tirth@gmail.com','customer',0x7F000001,0,'2026-08-17 09:55:19.086409'),(2,'tirth@gmail.com','customer',0x7F000001,1,'2026-08-17 09:55:56.999193'),(3,'fixcheck@example.com','customer',0x7F000001,1,'2026-08-17 10:08:26.209193'),(4,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-17 10:08:57.247746'),(5,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-17 11:45:26.617340'),(6,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-17 11:51:58.253356'),(7,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-17 12:15:38.760034'),(8,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-17 12:44:21.441632'),(9,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-18 07:05:29.894490'),(10,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-18 07:11:17.624081'),(11,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-18 07:27:40.500721'),(12,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-18 07:43:24.620747'),(13,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-18 08:24:08.028628'),(14,'abc@gmail.com','customer',0x7F000001,0,'2026-08-18 08:27:03.433201'),(15,'admin@node2begin.com','customer',0x7F000001,0,'2026-08-18 08:27:17.396618'),(16,'admin@node2begin.com','customer',0x7F000001,0,'2026-08-18 08:27:17.633190'),(17,'admin@node2begin.com','customer',0x7F000001,0,'2026-08-18 08:27:17.848693'),(18,'admin@node2begin.com','customer',0x7F000001,0,'2026-08-18 08:27:18.049647'),(19,'admin@node2begin.com','customer',0x7F000001,0,'2026-08-18 08:27:18.285738'),(20,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-19 06:19:16.215381'),(21,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-19 06:42:43.344299'),(22,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-19 07:51:21.132143'),(23,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-19 08:27:10.557543'),(24,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-19 08:28:12.117972'),(25,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-19 08:29:13.738472'),(26,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-19 08:33:04.879512'),(27,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-19 08:44:37.099521'),(28,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-19 09:21:32.926909'),(29,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-19 09:41:50.930113'),(30,'admin@iced-out.example','staff',0x7F000001,0,'2026-08-19 10:59:47.820047'),(31,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-19 11:00:31.927505'),(32,'smoke1787137277957@example.test','customer',0x7F000001,1,'2026-08-19 11:01:21.328685'),(33,'smoke1787137305245@example.test','customer',0x7F000001,1,'2026-08-19 11:01:49.001398'),(34,'dup1787137369302@example.test','customer',0x7F000001,1,'2026-08-19 11:02:52.974401'),(35,'dup1787137396110@example.test','customer',0x7F000001,1,'2026-08-19 11:03:19.905773'),(36,'bug1787138923818@example.test','customer',0x7F000001,1,'2026-08-19 11:28:47.360744'),(37,'stale1787139174751@example.test','customer',0x7F000001,1,'2026-08-19 11:33:02.423250'),(38,'race1787139225181@example.test','customer',0x7F000001,1,'2026-08-19 11:33:48.726583'),(39,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-19 11:47:12.819043'),(40,'pub1787140953547@example.test','customer',0x7F000001,1,'2026-08-19 12:02:37.239423'),(41,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-19 12:03:22.811862'),(42,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-19 12:04:13.154435'),(43,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-19 12:36:08.116176'),(44,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-19 14:34:28.823587'),(45,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-19 15:06:59.228894'),(46,'sup1787205863446@example.test','customer',0x7F000001,1,'2026-08-20 06:04:28.176185'),(47,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-20 06:05:28.701358'),(48,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-20 06:06:42.037592'),(49,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-20 06:07:55.244894'),(50,'sup1787205863446@example.test','customer',0x7F000001,1,'2026-08-20 06:11:13.083615'),(51,'sup1787205863446@example.test','customer',0x7F000001,1,'2026-08-20 06:13:54.654947'),(52,'shopper@example.com','customer',0x7F000001,0,'2026-08-21 06:15:19.157470'),(53,'shopper@example.com','customer',0x7F000001,0,'2026-08-21 06:16:30.559434'),(54,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-21 06:41:04.554716'),(55,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-21 06:53:10.151350'),(56,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-21 06:55:08.239339'),(57,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-21 07:13:04.884804'),(58,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-21 07:30:32.594015'),(59,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-21 07:37:35.954526'),(60,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-21 07:42:21.636789'),(61,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-21 08:08:11.907415'),(62,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-21 08:53:12.758504'),(63,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-24 06:57:55.899133'),(64,'shopper@example.com','customer',0x7F000001,0,'2026-08-24 07:11:05.445220'),(65,'codex-scroll-1787555481969@example.com','customer',0x7F000001,1,'2026-08-24 07:11:23.770238'),(66,'codex-scroll-1787555494376@example.com','customer',0x7F000001,1,'2026-08-24 07:11:34.717657'),(67,'codex-scroll-1787555511867@example.com','customer',0x7F000001,1,'2026-08-24 07:11:52.233144'),(68,'codex-scroll-1787555545562@example.com','customer',0x7F000001,1,'2026-08-24 07:12:25.965558'),(69,'codex-scroll-1787555586409@example.com','customer',0x7F000001,1,'2026-08-24 07:13:06.757371'),(70,'codex-scroll-1787555617854@example.com','customer',0x7F000001,1,'2026-08-24 07:13:38.214270'),(71,'codex-scroll-1787555676535@example.com','customer',0x7F000001,1,'2026-08-24 07:14:36.962675'),(72,'codex-scroll-1787555711015@example.com','customer',0x7F000001,1,'2026-08-24 07:15:11.413802'),(73,'codex-debug-1787555729797@example.com','customer',0x7F000001,1,'2026-08-24 07:15:30.152763'),(74,'codex-debug-1787555796005@example.com','customer',0x7F000001,1,'2026-08-24 07:16:36.390959'),(75,'codex-scroll-1787555817255@example.com','customer',0x7F000001,1,'2026-08-24 07:16:57.620740'),(76,'shopper@example.com','customer',0x7F000001,0,'2026-08-24 07:30:28.633800'),(77,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-24 07:39:17.786752'),(78,'wallet-preview@example.com','customer',0x7F000001,1,'2026-08-24 08:20:48.397601'),(79,'wallet-preview@example.com','customer',0x7F000001,1,'2026-08-24 08:21:48.659145'),(80,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 06:33:41.453183'),(81,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 06:41:12.210818'),(82,'tirth@gmail.com','customer',0x7F000001,0,'2026-08-25 07:14:32.426999'),(83,'kishan@gmail.com','customer',0x7F000001,1,'2026-08-25 07:15:27.674571'),(84,'leak-a@example.com','customer',0x7F000001,1,'2026-08-25 07:22:27.784211'),(85,'leak-b@example.com','customer',0x7F000001,1,'2026-08-25 07:26:36.696232'),(86,'kishan@gmail.com','customer',0x7F000001,1,'2026-08-25 09:59:52.371255'),(87,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 13:34:54.311519'),(88,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 13:36:06.939445'),(89,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 14:10:22.782504'),(90,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 14:12:33.107266'),(91,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 14:26:43.915763'),(92,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 14:26:51.210897'),(93,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 14:27:06.988867'),(94,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 14:27:23.067626'),(95,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 14:38:05.649881'),(96,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 14:46:09.659056'),(97,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 14:49:18.658650'),(98,'shopper@example.com','customer',0x7F000001,0,'2026-08-25 14:49:26.496490'),(99,'probe-audit@example.com','customer',0x7F000001,1,'2026-08-25 14:49:57.201218'),(100,'probe-audit@example.com','customer',0x7F000001,1,'2026-08-25 14:50:04.619338'),(101,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 14:51:57.078202'),(102,'probe-audit@example.com','customer',0x7F000001,1,'2026-08-25 14:56:20.857840'),(103,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 15:01:57.743046'),(104,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 15:02:42.220353'),(105,'audit-probe-bd3b465d@example.invalid','customer',0x7F000001,1,'2026-08-25 15:04:01.308784'),(106,'audit-probe-668805e2@example.invalid','customer',0x7F000001,1,'2026-08-25 15:04:22.933879'),(107,'audit-probe-2e2fbf83@example.invalid','customer',0x7F000001,1,'2026-08-25 15:04:33.757511'),(108,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 15:04:34.179877'),(109,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 15:05:28.550376'),(110,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-25 15:06:05.923150'),(111,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-27 06:12:35.875355'),(112,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-27 09:22:53.809179'),(113,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-27 09:42:07.288521'),(114,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-27 10:14:04.635730'),(115,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-27 10:29:07.222289'),(116,'audit-probe-18327c3f@example.invalid','customer',0x7F000001,1,'2026-08-27 10:31:58.907433'),(117,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-27 10:31:59.777737'),(118,'audit-probe-96315630@example.invalid','customer',0x7F000001,1,'2026-08-27 10:36:04.811035'),(119,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-27 10:36:05.679918'),(120,'audit-probe-af45189b@example.invalid','customer',0x7F000001,1,'2026-08-27 10:37:58.472272'),(121,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-27 10:37:59.329510'),(122,'audit-probe-a3ff841f@example.invalid','customer',0x7F000001,1,'2026-08-27 10:41:38.896722'),(123,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-27 10:41:39.370225'),(124,'audit-probe-a162c6b5@example.invalid','customer',0x7F000001,1,'2026-08-27 10:42:20.900692'),(125,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-27 10:42:21.366484'),(126,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-27 10:42:51.698141'),(127,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-27 10:42:52.387953'),(128,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-27 12:38:01.901687'),(129,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-27 12:50:27.410267'),(130,'audit-probe-323f8e61@example.invalid','customer',0x7F000001,1,'2026-08-27 13:19:44.557876'),(131,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-27 13:19:45.066738'),(132,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-27 13:20:56.416878'),(133,'admin@iced-out.example','staff',0x7F000001,1,'2026-08-27 13:20:57.049529'),(134,'admin@gmail.com','staff',0x7F000001,1,'2026-09-01 08:47:17.653970'),(135,'admin@iced-out.example','staff',0x7F000001,0,'2026-09-01 08:47:17.874589'),(136,'admin@gmail.com','staff',0x7F000001,1,'2026-09-01 08:50:17.178218'),(137,'audit-probe-07fe06f1@example.invalid','customer',0x7F000001,1,'2026-09-01 08:56:03.203244'),(138,'admin@gmail.com','staff',0x7F000001,1,'2026-09-01 08:56:03.692671'),(139,'admin@gmail.com','staff',0x7F000001,1,'2026-09-01 08:57:19.386471'),(140,'admin@gmail.com','staff',0x7F000001,1,'2026-09-01 09:09:38.631151'),(141,'audit-probe-49814c95@example.invalid','customer',0x7F000001,1,'2026-09-01 09:16:50.452993'),(142,'admin@gmail.com','staff',0x7F000001,1,'2026-09-01 09:16:50.947356'),(143,'audit-probe-72aa54a1@example.invalid','customer',0x7F000001,1,'2026-09-01 09:20:14.613526'),(144,'admin@gmail.com','staff',0x7F000001,1,'2026-09-01 09:20:15.051195'),(145,'audit-probe-855ff2c5@example.invalid','customer',0x7F000001,1,'2026-09-01 09:37:46.380732'),(146,'admin@gmail.com','staff',0x7F000001,1,'2026-09-01 09:37:46.835171'),(147,'admin@gmail.com','staff',0x7F000001,1,'2026-09-01 13:41:49.422140'),(148,'admin@gmail.com','staff',0x7F000001,1,'2026-09-01 13:48:58.682311'),(149,'admin@gmail.com','staff',0x7F000001,1,'2026-09-02 03:05:28.722769'),(150,'admin@gmail.com','staff',0x7F000001,1,'2026-09-02 05:50:44.001241'),(151,'admin@iced-out.example','staff',0x7F000001,0,'2026-09-02 06:14:34.476505'),(152,'admin@iced-out.example','staff',0x7F000001,0,'2026-09-02 06:15:19.082265'),(153,'admin@gmail.com','staff',0x7F000001,1,'2026-09-02 06:15:52.867389'),(154,'admin@gmail.com','staff',0x7F000001,1,'2026-09-02 06:16:40.507079'),(155,'admin@gmail.com','staff',0x7F000001,1,'2026-09-02 06:16:45.733898'),(156,'admin@gmail.com','staff',0x7F000001,1,'2026-09-02 06:16:51.008416'),(157,'admin@gmail.com','staff',0x7F000001,1,'2026-09-02 06:17:41.354459'),(158,'admin@gmail.com','staff',0x7F000001,1,'2026-09-02 06:17:48.417726'),(159,'admin@gmail.com','staff',0x7F000001,1,'2026-09-02 06:40:29.022604'),(160,'admin@gmail.com','staff',0x7F000001,1,'2026-09-02 07:30:22.319037');
/*!40000 ALTER TABLE `login_attempts` ENABLE KEYS */;

--
-- Table structure for table `material_movements`
--

DROP TABLE IF EXISTS `material_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `material_movements` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `material_id` bigint(20) unsigned DEFAULT NULL,
  `type` varchar(24) NOT NULL,
  `qty` decimal(12,3) NOT NULL,
  `on_hand_after` decimal(12,3) DEFAULT NULL,
  `reserved_after` decimal(12,3) DEFAULT NULL,
  `reference_type` varchar(32) NOT NULL DEFAULT '',
  `reference_id` varchar(64) NOT NULL DEFAULT '',
  `note` varchar(190) NOT NULL DEFAULT '',
  `actor_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_material_movements_material` (`material_id`,`created_at`),
  KEY `ix_material_movements_reference` (`reference_type`,`reference_id`),
  KEY `fk_material_movements_actor` (`actor_id`),
  CONSTRAINT `fk_material_movements_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_material_movements_material` FOREIGN KEY (`material_id`) REFERENCES `materials` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_movements`
--

/*!40000 ALTER TABLE `material_movements` DISABLE KEYS */;
INSERT INTO `material_movements` (`id`, `material_id`, `type`, `qty`, `on_hand_after`, `reserved_after`, `reference_type`, `reference_id`, `note`, `actor_id`, `created_at`) VALUES (11,3,'RECEIPT',480.000,480.000,0.000,'purchase','po-0001','',1,'2026-08-27 10:28:02.259914'),(12,4,'RECEIPT',260.000,260.000,0.000,'purchase','po-0001','',1,'2026-08-27 10:28:02.264559'),(13,5,'RECEIPT',90.000,90.000,0.000,'purchase','po-0001','',1,'2026-08-27 10:28:02.267461'),(14,6,'RECEIPT',900.000,900.000,0.000,'purchase','po-0002','',1,'2026-08-27 10:28:02.280192'),(15,7,'RECEIPT',180.000,180.000,0.000,'purchase','po-0002','',1,'2026-08-27 10:28:02.284240'),(16,8,'RECEIPT',1200.000,1200.000,0.000,'purchase','po-0002','',1,'2026-08-27 10:28:02.287500'),(17,6,'RESERVE',0.000,900.000,48.000,'production','run-0002','',1,'2026-08-27 10:28:02.351285'),(18,3,'RESERVE',0.000,480.000,100.800,'production','run-0002','',1,'2026-08-27 10:28:02.354301'),(19,8,'RESERVE',0.000,1200.000,40.000,'production','run-0002','',1,'2026-08-27 10:28:02.357458'),(20,6,'CONSUME',-43.200,856.800,4.800,'production','run-0002','',1,'2026-08-27 10:30:34.061218'),(21,6,'RELEASE',0.000,856.800,0.000,'production','run-0002','',1,'2026-08-27 10:30:34.064600'),(22,3,'CONSUME',-90.720,389.280,10.080,'production','run-0002','',1,'2026-08-27 10:30:34.071164'),(23,3,'RELEASE',0.000,389.280,0.000,'production','run-0002','',1,'2026-08-27 10:30:34.082976'),(24,8,'CONSUME',-36.000,1164.000,4.000,'production','run-0002','',1,'2026-08-27 10:30:34.085141'),(25,8,'RELEASE',0.000,1164.000,0.000,'production','run-0002','',1,'2026-08-27 10:30:34.087588');
/*!40000 ALTER TABLE `material_movements` ENABLE KEYS */;

--
-- Table structure for table `material_purchase_items`
--

DROP TABLE IF EXISTS `material_purchase_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `material_purchase_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `purchase_id` bigint(20) unsigned NOT NULL,
  `material_id` bigint(20) unsigned NOT NULL,
  `qty_ordered` decimal(12,3) NOT NULL DEFAULT 0.000,
  `qty_received` decimal(12,3) NOT NULL DEFAULT 0.000,
  `unit_cost` decimal(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_purchase_items_line` (`purchase_id`,`material_id`),
  KEY `ix_purchase_items_material` (`material_id`),
  CONSTRAINT `fk_purchase_items_material` FOREIGN KEY (`material_id`) REFERENCES `materials` (`id`),
  CONSTRAINT `fk_purchase_items_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `material_purchases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_purchase_items`
--

/*!40000 ALTER TABLE `material_purchase_items` DISABLE KEYS */;
INSERT INTO `material_purchase_items` (`id`, `purchase_id`, `material_id`, `qty_ordered`, `qty_received`, `unit_cost`) VALUES (3,2,3,480.000,480.000,640.00),(4,2,4,260.000,260.000,420.00),(5,2,5,90.000,90.000,1850.00),(6,3,6,900.000,900.000,11.00),(7,3,7,300.000,180.000,96.00),(8,3,8,1200.000,1200.000,7.00);
/*!40000 ALTER TABLE `material_purchase_items` ENABLE KEYS */;

--
-- Table structure for table `material_purchases`
--

DROP TABLE IF EXISTS `material_purchases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `material_purchases` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(16) NOT NULL,
  `supplier_id` bigint(20) unsigned NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'DRAFT',
  `ordered_on` date DEFAULT NULL,
  `expected_on` date DEFAULT NULL,
  `received_on` date DEFAULT NULL,
  `currency` char(3) NOT NULL DEFAULT 'INR',
  `notes` text DEFAULT NULL,
  `owner_user_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_material_purchases_public_id` (`public_id`),
  KEY `ix_material_purchases_supplier` (`supplier_id`,`deleted_at`),
  KEY `ix_material_purchases_status` (`status`,`deleted_at`),
  KEY `fk_material_purchases_owner` (`owner_user_id`),
  CONSTRAINT `fk_material_purchases_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_material_purchases_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_purchases`
--

/*!40000 ALTER TABLE `material_purchases` DISABLE KEYS */;
INSERT INTO `material_purchases` (`id`, `public_id`, `supplier_id`, `status`, `ordered_on`, `expected_on`, `received_on`, `currency`, `notes`, `owner_user_id`, `created_at`, `updated_at`, `deleted_at`) VALUES (2,'po-0001',2,'RECEIVED','2026-08-15','2026-09-03','2026-08-24','INR','AW cut',1,'2026-08-27 10:28:02.228887','2026-08-27 10:28:02.269033',NULL),(3,'po-0002',3,'PARTIAL','2026-08-23','2026-08-30',NULL,'INR','',1,'2026-08-27 10:28:02.270130','2026-08-27 10:28:02.289349',NULL);
/*!40000 ALTER TABLE `material_purchases` ENABLE KEYS */;

--
-- Table structure for table `materials`
--

DROP TABLE IF EXISTS `materials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `materials` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(16) NOT NULL,
  `code` varchar(40) NOT NULL DEFAULT '',
  `name` varchar(160) NOT NULL,
  `kind` varchar(16) NOT NULL DEFAULT 'FABRIC',
  `unit` varchar(8) NOT NULL DEFAULT 'M',
  `on_hand` decimal(12,3) NOT NULL DEFAULT 0.000,
  `reserved` decimal(12,3) NOT NULL DEFAULT 0.000,
  `available` decimal(12,3) GENERATED ALWAYS AS (`on_hand` - `reserved`) STORED,
  `reorder_point` decimal(12,3) NOT NULL DEFAULT 0.000,
  `unit_cost` decimal(12,2) NOT NULL DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'INR',
  `supplier_id` bigint(20) unsigned DEFAULT NULL,
  `warehouse_id` bigint(20) unsigned DEFAULT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE',
  `notes` text DEFAULT NULL,
  `version` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_materials_public_id` (`public_id`),
  KEY `ix_materials_supplier` (`supplier_id`,`deleted_at`),
  KEY `ix_materials_warehouse` (`warehouse_id`,`deleted_at`),
  KEY `ix_materials_kind` (`kind`,`deleted_at`),
  KEY `ix_materials_available` (`available`,`reorder_point`),
  CONSTRAINT `fk_materials_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_materials_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `materials`
--

/*!40000 ALTER TABLE `materials` DISABLE KEYS */;
INSERT INTO `materials` (`id`, `public_id`, `code`, `name`, `kind`, `unit`, `on_hand`, `reserved`, `available`, `reorder_point`, `unit_cost`, `currency`, `supplier_id`, `warehouse_id`, `status`, `notes`, `version`, `created_at`, `updated_at`, `deleted_at`) VALUES (3,'mat-0001','FLC-520','520 GSM brushed fleece','FABRIC','M',389.280,0.000,389.280,60.000,640.00,'INR',2,1,'ACTIVE','',4,'2026-08-27 10:28:02.208139','2026-08-27 10:30:34.082514',NULL),(4,'mat-0002','TWL-340','340 GSM cotton twill','FABRIC','M',260.000,0.000,260.000,40.000,420.00,'INR',2,1,'ACTIVE','',1,'2026-08-27 10:28:02.210887','2026-08-27 10:28:02.264123',NULL),(5,'mat-0003','WOL-740','740 GSM pressed wool','FABRIC','M',90.000,0.000,90.000,25.000,1850.00,'INR',2,1,'ACTIVE','',1,'2026-08-27 10:28:02.215831','2026-08-27 10:28:02.267003',NULL),(6,'mat-0004','CRD-4MM','4 mm flat drawcord','TRIM','M',856.800,0.000,856.800,200.000,11.00,'INR',3,1,'ACTIVE','',4,'2026-08-27 10:28:02.219237','2026-08-27 10:30:34.064039',NULL),(7,'mat-0005','ZIP-YKK','YKK #5 metal zip, 62 cm','HARDWARE','PC',180.000,0.000,180.000,80.000,96.00,'INR',3,1,'ACTIVE','',1,'2026-08-27 10:28:02.222089','2026-08-27 10:28:02.283633',NULL),(8,'mat-0006','LBL-WOV','Woven neck label','LABEL','PC',1164.000,0.000,1164.000,300.000,7.00,'INR',3,1,'ACTIVE','',4,'2026-08-27 10:28:02.224872','2026-08-27 10:30:34.087165',NULL);
/*!40000 ALTER TABLE `materials` ENABLE KEYS */;

--
-- Table structure for table `media_assets`
--

DROP TABLE IF EXISTS `media_assets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `media_assets` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `owner_type` varchar(16) NOT NULL,
  `owner_id` bigint(20) unsigned DEFAULT NULL,
  `storage_key` varchar(255) NOT NULL,
  `mime` varchar(64) NOT NULL,
  `bytes` int(10) unsigned NOT NULL DEFAULT 0,
  `width` int(10) unsigned DEFAULT NULL,
  `height` int(10) unsigned DEFAULT NULL,
  `checksum` char(64) NOT NULL DEFAULT '',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_media_public_id` (`public_id`),
  KEY `ix_media_owner` (`owner_type`,`owner_id`)
) ENGINE=InnoDB AUTO_INCREMENT=73 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `media_assets`
--

/*!40000 ALTER TABLE `media_assets` DISABLE KEYS */;
INSERT INTO `media_assets` (`id`, `public_id`, `owner_type`, `owner_id`, `storage_key`, `mime`, `bytes`, `width`, `height`, `checksum`, `created_at`, `deleted_at`) VALUES (1,'med-b0d91ad898174234','stock_item',NULL,'2026/08/d55306d996887e09f4f4d98aef04e816.png','image/png',460855,650,781,'105a5b4e56c9513c3dc3367f319add21068f053ccc54384f2e214d61fd9cb757','2026-08-17 12:18:13.502884',NULL),(2,'med-97d6fa0ff7221968','stock_item',6,'2026/08/645263f1dcabe804dc69205792da86bf.png','image/png',460855,650,781,'105a5b4e56c9513c3dc3367f319add21068f053ccc54384f2e214d61fd9cb757','2026-08-17 12:21:50.656147',NULL),(3,'med-462903260dd58605','product',38,'2026/08/67e08338ad49045039a708d1e4ab596a.webp','image/webp',247272,1536,1024,'42c32cf17c9c82edfab2b224e7c0387c2ef7f6ad48feda0f5fbc241f9d95ed08','2026-08-17 12:44:34.787875',NULL),(4,'med-da46a9e7c021ee2a','product',1,'2026/08/7472138050bbcafb4d2109e33155bcb9.webp','image/webp',12334,512,512,'5e9e1b10cbac1fa3c2675cf24a9dccc64bdb9b59398635b8dbe810a3fc0bb142','2026-08-18 07:10:37.308817',NULL),(5,'med-cf2ef45d933f7a78','product',2,'2026/08/d8b969190efe9fb0a494cfa7d0797d0b.webp','image/webp',16804,512,512,'d04a024317f716df03ba10d6a36e27ac9f870c7009dd2898604631bfefe9ee97','2026-08-18 07:10:37.434604',NULL),(6,'med-f9f466d95b84b472','product',3,'2026/08/8b872c02d7f4a76d0e1d217bed09783f.webp','image/webp',11698,512,512,'72c2a53c9e6df936a41d2a248f6dd1a970895f231182d5701e73160f51945a6f','2026-08-18 07:10:37.559862',NULL),(7,'med-a5da6a27bc466769','product',4,'2026/08/9f413e79e37122156c92c4be95633a26.webp','image/webp',6134,512,512,'b2df1c320a1b29f8a782a559d22b5256bd26cf5d15e29618a9acdadf3dbcfd49','2026-08-18 07:10:37.699919',NULL),(8,'med-2adf1e8fcf1d4698','product',5,'2026/08/cd19fcd9d4102cdec7135e65358efe66.webp','image/webp',18582,640,640,'ccda7f6d2ccc046b7c9ab6bf8ca5c5c2593ea1b1f539b0e0c3934b1e02bf543a','2026-08-18 07:10:37.884622',NULL),(9,'med-a7ce235624eae837','product',11,'2026/08/18d0f6938f0514e1ba0585d1bfab9155.webp','image/webp',29846,749,500,'72ed96d17dde15f3ef593acdf080c559d796288e4b0206e16d77eba58ac377e7','2026-08-18 07:10:38.053241',NULL),(10,'med-8eaaff2b78addacb','product',12,'2026/08/6f8eeff99b358b0c57f24c83ca6288eb.webp','image/webp',22382,749,500,'5f8da8b06d12a35bfd120b3a006c0ed949f137b21929c9cfd633a38913e6147f','2026-08-18 07:10:38.205514',NULL),(11,'med-3beee0014096b0ef','product',13,'2026/08/b27a2c0d27cb236108c24ec518067fc4.webp','image/webp',47282,640,427,'cf4c6c7cd422809c52a3f82f086cdc5d9a2033e5a9aecf5ae1f49c036908fc08','2026-08-18 07:10:38.422113',NULL),(12,'med-1b30a92717229381','product',14,'2026/08/139e0bff0a78c482f8852e70a3830191.webp','image/webp',20582,640,640,'d8d6ff39ee7bf37f5ecc2db624e770e69ce59ed3d8276f325923410317051a9c','2026-08-18 07:10:38.576130',NULL),(13,'med-26614cab45ae43c0','product',15,'2026/08/8535043654dd323eb77d9f4be406c842.webp','image/webp',46520,1024,683,'39214e2e1a784db96c4ad0c807125983b325521fde3e9f9b947b3dc0de507dc3','2026-08-18 07:10:38.834435',NULL),(14,'med-a2aff4752f67d2dd','product',16,'2026/08/da5966edbc1d3622c00ae72fe95e3d3c.webp','image/webp',20044,480,320,'d8e672b7c39794024d4b083314e1632febb0b4d53c8f1ea5d650495fe2a875c7','2026-08-18 07:10:38.958222',NULL),(15,'med-d21c3add6f29b8c2','product',17,'2026/08/9e08e4fcdb0c9e680f0711338cf3d6e4.webp','image/webp',16660,749,500,'021d6ba9ec81424e2e9d95158d04f890716bd6833f2c21d947270c05e0cea179','2026-08-18 07:10:39.114928',NULL),(16,'med-e3c1be7ab4d6cec6','product',18,'2026/08/daedabc089a64d329fb3c7f2a4b415c9.webp','image/webp',160950,1229,819,'3d888edf139950e6373594f51f8007662b335edcca4446fcd8e91ce55601e050','2026-08-18 07:10:39.526082',NULL),(17,'med-14d6989c27e654da','product',19,'2026/08/ec4695b31cb51337d2717db901be62e1.webp','image/webp',24138,749,500,'4d94b36e600d10c0a64197074253181010a2392cbe545f5e55e7451f69dce86e','2026-08-18 07:10:39.726145',NULL),(18,'med-fb46772d0a08b4dc','product',20,'2026/08/74feb76117246542ca156f0c9debe4ad.webp','image/webp',36952,991,661,'4f6a1149f8c1465ca6948a9a7026f85515a1dbeeaca4945d6dddf15ca44d7c64','2026-08-18 07:10:39.981950',NULL),(19,'med-1ba51ab7ef095eb6','product',21,'2026/08/85db540ef113d78e5bee5301919ad5dd.webp','image/webp',44472,640,427,'0c044d7ff44ba0b04b3d9c57dab1c099f3eeebd88a976c88908a76d47970ba58','2026-08-18 07:10:40.149500',NULL),(20,'med-881e8b1a16de7755','product',22,'2026/08/9b630a03c55367da69f8f1e2162a8f05.webp','image/webp',17108,640,640,'70d773430a62b7448741482e1cb0cc70d6419e960b76c4dc33c357f9d38b1200','2026-08-18 07:10:40.316786',NULL),(21,'med-93fb243c9c92ef95','product',23,'2026/08/149e19f3bd5e18bd6082332b484202ed.webp','image/webp',14220,640,640,'3893ace7e40bcc6b91c0db546fe2d3d88ec1030ce37c69889f17ab577d70824c','2026-08-18 07:10:40.456003',NULL),(22,'med-e8f97ee756fa58b6','product',24,'2026/08/a27bcfb868de00a973ba772a442b4174.webp','image/webp',11698,512,512,'72c2a53c9e6df936a41d2a248f6dd1a970895f231182d5701e73160f51945a6f','2026-08-18 07:10:40.570077',NULL),(23,'med-35a98f6ad500ae4c','product',25,'2026/08/043d75210cd3aec3be7975fe91564d01.webp','image/webp',41814,640,427,'597c67aa39c91c50394b58289a42566ef19c7896465a31c4f754fa57401ad8da','2026-08-18 07:10:40.723535',NULL),(24,'med-c5dae87d33e6dc61','product',26,'2026/08/c46ddc2b2e5106a029a50e510645b71c.webp','image/webp',18582,640,640,'ccda7f6d2ccc046b7c9ab6bf8ca5c5c2593ea1b1f539b0e0c3934b1e02bf543a','2026-08-18 07:10:40.895489',NULL),(25,'med-73e39e985c9ccfdb','product',27,'2026/08/67f930d2fead4faf7855e8e2f51ac886.webp','image/webp',11318,632,332,'f0b6f72efb77724eb848b67f258d2b0cfefcca9aa1c0a8ead00bdd44e773db1d','2026-08-18 07:10:41.019593',NULL),(26,'med-523e502f284ced8f','product',28,'2026/08/409a991ee56d71a9e0d67d68b4f5d0d2.webp','image/webp',15436,632,332,'9ff5119e00bfc32f4cf8e764c6f8948f4c4fb3a108e410f501bcd0a2942710c0','2026-08-18 07:10:41.133667',NULL),(27,'med-f6ebe66bbcf18cbb','product',29,'2026/08/b2ff2739d00460e98a63c3e7d5540ece.webp','image/webp',6134,512,512,'b2df1c320a1b29f8a782a559d22b5256bd26cf5d15e29618a9acdadf3dbcfd49','2026-08-18 07:10:41.353744',NULL),(28,'med-effc4fb523e9a403','product',30,'2026/08/baae7f5aac8709eb9ece0a8b3a2eda32.webp','image/webp',14220,640,640,'3893ace7e40bcc6b91c0db546fe2d3d88ec1030ce37c69889f17ab577d70824c','2026-08-18 07:10:41.673786',NULL),(29,'med-8aad250e11367379','product',31,'2026/08/838f7a3a93c54b2de6a3741e4aa76a98.webp','image/webp',160950,1229,819,'3d888edf139950e6373594f51f8007662b335edcca4446fcd8e91ce55601e050','2026-08-18 07:10:42.816651',NULL),(30,'med-b7e2d8d99cc6480c','product',32,'2026/08/8a7accf1c3d4153e4d194cbbe036e5e2.webp','image/webp',30726,530,353,'ae5bc6e7aa98aab66dd79b7bbe9c050764eee1551449d5ab585a58317772530a','2026-08-18 07:10:43.153966',NULL),(31,'med-05b8ebc1890b4a27','product',33,'2026/08/b1638b97765fabc42aa25f414d87395a.webp','image/webp',30726,530,353,'ae5bc6e7aa98aab66dd79b7bbe9c050764eee1551449d5ab585a58317772530a','2026-08-18 07:10:43.483067',NULL),(32,'med-61868081986da1de','product',34,'2026/08/16db90ce74ba7eb3b106df74c6da20d4.webp','image/webp',39450,452,301,'6e4105ff46e75a6b4323cb52010e5bc4b79f5c43f292cbb8054b821492e747c8','2026-08-18 07:10:43.757334',NULL),(33,'med-88c8b4455aeed464','product',35,'2026/08/5ede41e2cc01d5ec7f835e727fd75717.webp','image/webp',39450,452,301,'6e4105ff46e75a6b4323cb52010e5bc4b79f5c43f292cbb8054b821492e747c8','2026-08-18 07:10:44.033996',NULL),(34,'med-272283acc6034564','product',36,'2026/08/6841060688bb0399105a69e1c0a6e7fb.webp','image/webp',14922,495,330,'958ef795fcd3e33cb1719442f77739bee3e3dd2f89cdc765f328ad2c40efcb89','2026-08-18 07:10:44.275691',NULL),(35,'med-3dbd6918a13dc69c','product',37,'2026/08/a8188486793fedbba3c117662197c961.webp','image/webp',160950,1229,819,'3d888edf139950e6373594f51f8007662b335edcca4446fcd8e91ce55601e050','2026-08-18 07:10:45.258868',NULL),(36,'med-fb89976c3210ae89','stock_item',NULL,'2026/08/18f92d435b886b676835e18207aff857.png','image/png',460855,650,781,'105a5b4e56c9513c3dc3367f319add21068f053ccc54384f2e214d61fd9cb757','2026-08-19 07:01:20.361382',NULL),(43,'med-1558e79a53d7b5bb','stock_item',74,'2026/08/52edcabbec67fb920e8d5c7aa7d761d7.jpg','image/jpeg',5071,201,251,'3c9a25813bc8430b98ae4c4e58d12e62400e30f297ed7e70a90edcd69182d5db','2026-08-19 07:56:57.228653',NULL),(44,'med-12498f86d09210f7','stock_item',74,'2026/08/cea9a25a1f1f52c29a439b11d255f302.png','image/png',109087,1165,885,'2bd9d69f1f39d1c381a503e46ecf46b3f4903f2c2f1b1e1df29f80fec1232d29','2026-08-19 07:58:11.042579',NULL),(45,'med-0353f2f4068b21aa','stock_item',74,'2026/08/14d961a78e9ba192249635b97ae6f089.png','image/png',14239,1351,174,'79a3d65d640758ae70205ae8a0d9e82ad969221dacea01ad2d78c500eee3ce8d','2026-08-19 07:58:11.261605',NULL),(46,'med-413006cd06ecf9d4','stock_item',74,'2026/08/d9fb64dac4e7006807db8dc3e91dbdb8.png','image/png',244905,1600,900,'734ceb4aac555df261a08bd5181218047ec619f423757702b32348175afa997e','2026-08-19 07:58:12.273295',NULL),(47,'med-6643499ed4e919ba','stock_item',74,'2026/08/6eadfa60011340f9e5b0778a96b56212.png','image/png',49052,856,567,'7b198a85b48f5940b68d8b281993034cdcbe2aaa6988c8eee76b3496290042c8','2026-08-19 07:58:12.541495',NULL),(63,'med-ebdda1bb1721a837','cms',4,'2026/08/3fb4d948dae731d257db2f2d223c306b.png','image/png',38669,500,500,'435a07f6f35f5822d683cf7aebd8061a39df858579ecb3fc210554965e0ed312','2026-08-21 07:30:49.352143','2026-08-21 07:41:28.970900'),(64,'med-3b3078218aeb9e8b','cms',5,'2026/08/3a0c312cbfbe471249699e1e442ebb53.png','image/png',277826,612,408,'c60de001bdc74eb90e7c6f45c89d7aae8ccbb4b19b8162e38228b40cedc86442','2026-08-21 07:37:44.326279','2026-08-21 07:41:32.371566'),(65,'med-582a0c9b58e65f6c','cms',6,'2026/08/29f4edd227171045d6c393f197c5d5a2.png','image/png',352791,612,408,'06b7b60683839a66622424b47016bd557b217c5f4029adcda19683ea6b993055','2026-08-21 07:38:25.119644','2026-08-21 07:41:36.590936'),(66,'med-b10badbc94d9e6e8','cms',4,'2026/08/10a86a1f706a0d7bc01f3540c3fe89d7.png','image/png',38669,500,500,'435a07f6f35f5822d683cf7aebd8061a39df858579ecb3fc210554965e0ed312','2026-08-21 07:41:28.957010',NULL),(67,'med-c7ba245e52107175','cms',5,'2026/08/9a5ef9792ffae29db47216d3f54dccce.png','image/png',277826,612,408,'c60de001bdc74eb90e7c6f45c89d7aae8ccbb4b19b8162e38228b40cedc86442','2026-08-21 07:41:32.348369','2026-08-21 07:43:24.708585'),(68,'med-b7d1a7891379676d','cms',6,'2026/08/c6b10dd8b1efc3374cbc91932383c788.png','image/png',352791,612,408,'06b7b60683839a66622424b47016bd557b217c5f4029adcda19683ea6b993055','2026-08-21 07:41:36.577088','2026-08-21 07:43:26.657237'),(69,'med-a3feb1fb4acf3b87','cms',5,'2026/08/f574b76b0951baf6fa591051d6bbfd1a.png','image/png',48887,500,500,'461d3dcffb68bb73b227413c0e09f25ef3edf211b051eee60ce1fb0a9de88727','2026-08-21 07:43:24.694722',NULL),(70,'med-61a40709a39978fc','cms',6,'2026/08/d072b27a8f8b8ed04e2f388fe22b3991.png','image/png',102367,500,500,'93020e3f176591c2aeccc14b38c7858eb30cfcadb2edc8c9737b63a55e1a679b','2026-08-21 07:43:26.639489',NULL),(71,'med-769ec38502476cf7','cms',7,'2026/08/7b23efba477215ae20200eb973aa84c9.png','image/png',1207447,1254,1254,'b1b60c922d5ae7da4198cfbc86ca189cae1527641d856dae559915a43d8f49d4','2026-08-21 08:10:12.524541',NULL),(72,'med-48a36c425d91c12b','cms',7,'2026/08/e6bd72d493272c27035ea0b0c785064d.png','image/png',190739,500,500,'ece8d6b9d6803754da37e8603415e6db7d9bec49d36e29549125bdae615b3c6e','2026-08-21 08:10:24.072556',NULL);
/*!40000 ALTER TABLE `media_assets` ENABLE KEYS */;

--
-- Table structure for table `ndr_cases`
--

DROP TABLE IF EXISTS `ndr_cases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ndr_cases` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `shipment_id` bigint(20) unsigned NOT NULL,
  `reason` varchar(120) NOT NULL DEFAULT '',
  `attempts` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `status` varchar(16) NOT NULL DEFAULT 'Open',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ndr_cases_shipment` (`shipment_id`),
  CONSTRAINT `fk_ndr_cases_shipment` FOREIGN KEY (`shipment_id`) REFERENCES `shipments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ndr_cases`
--

/*!40000 ALTER TABLE `ndr_cases` DISABLE KEYS */;
/*!40000 ALTER TABLE `ndr_cases` ENABLE KEYS */;

--
-- Table structure for table `notification_preferences`
--

DROP TABLE IF EXISTS `notification_preferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notification_preferences` (
  `user_id` bigint(20) unsigned NOT NULL,
  `channel` varchar(16) NOT NULL,
  `topic` varchar(16) NOT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`user_id`,`channel`,`topic`),
  CONSTRAINT `fk_notification_preferences_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_preferences`
--

/*!40000 ALTER TABLE `notification_preferences` DISABLE KEYS */;
/*!40000 ALTER TABLE `notification_preferences` ENABLE KEYS */;

--
-- Table structure for table `ops_signals`
--

DROP TABLE IF EXISTS `ops_signals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ops_signals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `kind` varchar(16) NOT NULL,
  `tone` varchar(8) NOT NULL DEFAULT 'ink',
  `title` varchar(160) NOT NULL,
  `detail` varchar(255) NOT NULL DEFAULT '',
  `href` varchar(190) NOT NULL DEFAULT '',
  `entity_type` varchar(40) NOT NULL DEFAULT '',
  `entity_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `cleared_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_ops_signals_open` (`cleared_at`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ops_signals`
--

/*!40000 ALTER TABLE `ops_signals` DISABLE KEYS */;
/*!40000 ALTER TABLE `ops_signals` ENABLE KEYS */;

--
-- Table structure for table `order_cancellation_requests`
--

DROP TABLE IF EXISTS `order_cancellation_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_cancellation_requests` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) unsigned NOT NULL,
  `reason` varchar(120) NOT NULL,
  `note` varchar(500) NOT NULL DEFAULT '',
  `status` varchar(16) NOT NULL DEFAULT 'Received',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_order_cancellation_order` (`order_id`,`status`),
  CONSTRAINT `fk_order_cancellation_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_cancellation_requests`
--

/*!40000 ALTER TABLE `order_cancellation_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_cancellation_requests` ENABLE KEYS */;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) unsigned NOT NULL,
  `line_public_id` varchar(40) NOT NULL,
  `product_id` bigint(20) unsigned DEFAULT NULL,
  `name` varchar(160) NOT NULL,
  `variant_label` varchar(120) NOT NULL DEFAULT '',
  `size` varchar(8) NOT NULL DEFAULT '',
  `quantity` int(10) unsigned NOT NULL DEFAULT 1,
  `unit_price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `line_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'INR',
  `tax_rate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `tax_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `return_eligible` tinyint(1) NOT NULL DEFAULT 1,
  `returned_qty` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_order_items_line` (`order_id`,`line_public_id`),
  KEY `ix_order_items_product` (`product_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
INSERT INTO `order_items` (`id`, `order_id`, `line_public_id`, `product_id`, `name`, `variant_label`, `size`, `quantity`, `unit_price`, `line_total`, `currency`, `tax_rate`, `tax_amount`, `return_eligible`, `returned_qty`, `created_at`) VALUES (1,1,'ord-local-01-l1',3,'Shadow Cargo 02','Charcoal / M','M',1,9800.00,9800.00,'INR',0.00,0.00,0,0,'2026-08-17 09:58:03.022862'),(3,3,'ord-1001-l1',43,'demo product',' / 32','32',1,5000.00,5000.00,'INR',0.00,0.00,0,0,'2026-08-19 09:41:41.029991'),(4,4,'ord-1002-l1',14,'Ivory Work Jacket','Ivory / XL','XL',1,13900.00,13900.00,'INR',0.00,0.00,0,0,'2026-08-24 06:47:20.365312'),(5,5,'ord-1003-l1',18,'Freight Overshirt','Bone / M','M',1,12400.00,12400.00,'INR',0.00,0.00,0,0,'2026-08-24 07:08:19.241389'),(6,6,'ord-1004-l1',43,'demo product',' / 32','32',1,5000.00,5000.00,'INR',0.00,0.00,0,0,'2026-08-24 07:38:07.511288'),(8,8,'ord-1005-l1',22,'Washed Crop Hoodie','Gravel / XL','XL',1,8600.00,8600.00,'INR',0.00,0.00,0,0,'2026-08-25 07:13:59.417842');
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;

--
-- Table structure for table `order_status_history`
--

DROP TABLE IF EXISTS `order_status_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_status_history` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) unsigned NOT NULL,
  `seq` int(10) unsigned NOT NULL,
  `from_status` varchar(24) NOT NULL DEFAULT '',
  `to_status` varchar(24) NOT NULL,
  `actor_type` varchar(16) NOT NULL DEFAULT 'system',
  `actor_id` bigint(20) unsigned DEFAULT NULL,
  `note` varchar(255) NOT NULL DEFAULT '',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_order_status_history_seq` (`order_id`,`seq`),
  CONSTRAINT `fk_order_status_history_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_status_history`
--

/*!40000 ALTER TABLE `order_status_history` DISABLE KEYS */;
INSERT INTO `order_status_history` (`id`, `order_id`, `seq`, `from_status`, `to_status`, `actor_type`, `actor_id`, `note`, `created_at`) VALUES (1,1,1,'','Placed','customer',2,'Order placed','2026-08-17 09:58:03.037363'),(3,3,1,'','Placed','customer',2,'Order placed','2026-08-19 09:41:41.052176'),(4,1,2,'Placed','Confirmed','staff',1,'Confirmed in the console','2026-08-19 09:43:20.134811'),(5,3,2,'Placed','Confirmed','staff',1,'Confirmed in the console','2026-08-19 09:43:24.961846'),(6,4,1,'','Placed','customer',2,'Order placed','2026-08-24 06:47:20.387479'),(7,4,2,'Placed','Cancelled','staff',1,'Cancelled by store','2026-08-24 06:58:02.359473'),(8,5,1,'','Placed','customer',2,'Order placed','2026-08-24 07:08:19.251905'),(9,6,1,'','Placed','customer',2,'Order placed','2026-08-24 07:38:07.533609'),(10,6,2,'Placed','Cancelled','staff',1,'Cancelled by store','2026-08-24 07:39:43.800646'),(12,8,1,'','Placed','customer',2,'Order placed','2026-08-25 07:13:59.449966');
/*!40000 ALTER TABLE `order_status_history` ENABLE KEYS */;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `orders` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `number` varchar(40) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'Processing',
  `console_state` varchar(16) NOT NULL DEFAULT 'Placed',
  `cancelled_by` varchar(16) DEFAULT NULL,
  `contact_name` varchar(120) NOT NULL DEFAULT '',
  `contact_email` varchar(190) NOT NULL DEFAULT '',
  `contact_mobile` varchar(20) NOT NULL DEFAULT '',
  `addr_line` varchar(255) NOT NULL DEFAULT '',
  `addr_city` varchar(80) NOT NULL DEFAULT '',
  `addr_state` varchar(80) NOT NULL DEFAULT '',
  `addr_postal` varchar(10) NOT NULL DEFAULT '',
  `delivery_label` varchar(80) NOT NULL DEFAULT '',
  `delivery_estimate` varchar(40) NOT NULL DEFAULT '',
  `delivery_fee` decimal(12,2) NOT NULL DEFAULT 0.00,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `wallet_applied` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'INR',
  `coupon_code` varchar(40) DEFAULT NULL,
  `items_summary` text DEFAULT NULL,
  `cancellation_eligible` tinyint(1) NOT NULL DEFAULT 1,
  `placed_at` datetime(6) NOT NULL,
  `version` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders_public_id` (`public_id`),
  UNIQUE KEY `uq_orders_number` (`number`),
  KEY `ix_orders_user` (`user_id`,`placed_at`),
  KEY `ix_orders_status` (`status`),
  KEY `ix_orders_console_state` (`console_state`,`placed_at`),
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` (`id`, `public_id`, `number`, `user_id`, `status`, `console_state`, `cancelled_by`, `contact_name`, `contact_email`, `contact_mobile`, `addr_line`, `addr_city`, `addr_state`, `addr_postal`, `delivery_label`, `delivery_estimate`, `delivery_fee`, `subtotal`, `discount`, `wallet_applied`, `total`, `currency`, `coupon_code`, `items_summary`, `cancellation_eligible`, `placed_at`, `version`, `created_at`, `updated_at`) VALUES (1,'ord-local-01','IO-2026-1049',2,'Processing','Confirmed',NULL,'Tirth','tirth@gmail.com','9876543210','c-5-66 G.I.D.C Collony Pandesara','surat','Gujarat','394221','Standard delivery','20 Aug – 22 Aug',0.00,9800.00,0.00,0.00,9800.00,'INR',NULL,'Shadow Cargo 02',0,'2026-08-17 09:58:03.022862',1,'2026-08-17 09:58:03.022862','2026-08-19 09:43:20.130338'),(3,'ord-1001','IO-2026-1050',2,'Processing','Confirmed',NULL,'Tirth','tirth@gmail.com','9876543210','c-5-66 G.I.D.C Collony Pandesara','surat','Gujarat','394221','Standard delivery','22 Aug – 24 Aug',0.00,5000.00,0.00,0.00,5000.00,'INR',NULL,'demo product',0,'2026-08-19 09:41:41.029991',1,'2026-08-19 09:41:41.029991','2026-08-19 09:43:24.958585'),(4,'ord-1002','IO-2026-1051',2,'Cancelled','Cancelled','Store','Tirth','tirth@gmail.com','9876543210','c-5-66 G.I.D.C Collony Pandesara','Surat','Gujarat','394221','Standard delivery','27 Aug – 29 Aug',0.00,13900.00,0.00,0.00,13900.00,'INR',NULL,'Ivory Work Jacket',0,'2026-08-24 06:47:20.365312',1,'2026-08-24 06:47:20.365312','2026-08-24 06:58:02.347540'),(5,'ord-1003','IO-2026-1052',2,'Payment failed','Placed',NULL,'Tirth','tirth@gmail.com','9876543210','c-5-66 G.I.D.C Collony Pandesara','Surat','Gujarat','394221','Standard delivery','27 Aug – 29 Aug',0.00,12400.00,0.00,0.00,12400.00,'INR',NULL,'Freight Overshirt',1,'2026-08-24 07:08:19.241389',0,'2026-08-24 07:08:19.241389','2026-08-24 07:08:19.241773'),(6,'ord-1004','IO-2026-1053',2,'Cancelled','Cancelled','Store','Tirth','tirth@gmail.com','9876543210','c-5-66 G.I.D.C Collony Pandesara','Surat','Gujarat','394221','Standard delivery','27 Aug – 29 Aug',0.00,5000.00,0.00,0.00,5000.00,'INR',NULL,'demo product',0,'2026-08-24 07:38:07.511288',1,'2026-08-24 07:38:07.511288','2026-08-24 07:39:43.799839'),(8,'ord-1005','IO-2026-1054',2,'Processing','Placed',NULL,'Tirth','tirth@gmail.com','9876543210','c-5-66 G.I.D.C Collony Pandesara','Surat','Gujarat','394221','Standard delivery','28 Aug – 30 Aug',0.00,8600.00,0.00,0.00,8600.00,'INR',NULL,'Washed Crop Hoodie',1,'2026-08-25 07:13:59.417842',0,'2026-08-25 07:13:59.417842','2026-08-25 07:13:59.418626');
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;

--
-- Table structure for table `payment_attempts`
--

DROP TABLE IF EXISTS `payment_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payment_attempts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `payment_id` bigint(20) unsigned NOT NULL,
  `operation` varchar(16) NOT NULL,
  `request_json` mediumtext DEFAULT NULL,
  `response_json` mediumtext DEFAULT NULL,
  `outcome` varchar(24) NOT NULL DEFAULT '',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_payment_attempts_payment` (`payment_id`,`created_at`),
  CONSTRAINT `fk_payment_attempts_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_attempts`
--

/*!40000 ALTER TABLE `payment_attempts` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_attempts` ENABLE KEYS */;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `order_id` bigint(20) unsigned NOT NULL,
  `customer_masked` varchar(120) NOT NULL DEFAULT '',
  `gateway` varchar(24) NOT NULL DEFAULT 'Razorpay',
  `method` varchar(40) NOT NULL DEFAULT '',
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'INR',
  `status` varchar(16) NOT NULL DEFAULT 'Due',
  `note` varchar(255) NOT NULL DEFAULT '',
  `reference` varchar(120) NOT NULL DEFAULT '',
  `razorpay_order_id` varchar(120) DEFAULT NULL,
  `signature_verified` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payments_public_id` (`public_id`),
  KEY `ix_payments_order` (`order_id`),
  KEY `ix_payments_status` (`status`,`created_at`),
  KEY `ix_payments_reference` (`reference`),
  KEY `ix_payments_razorpay_order` (`razorpay_order_id`),
  CONSTRAINT `fk_payments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` (`id`, `public_id`, `order_id`, `customer_masked`, `gateway`, `method`, `amount`, `currency`, `status`, `note`, `reference`, `razorpay_order_id`, `signature_verified`, `created_at`, `updated_at`) VALUES (1,'pay_ICE2001',1,'T••••','Courier','Cash on delivery',9800.00,'INR','Due','The courier collects it at the door','Collected at delivery',NULL,0,'2026-08-17 09:58:03.043849','2026-08-17 09:58:03.044271'),(3,'pay_ICE2002',3,'T••••','Courier','Cash on delivery',5000.00,'INR','Due','The courier collects it at the door','Collected at delivery',NULL,0,'2026-08-19 09:41:41.063240','2026-08-19 09:41:41.063984'),(4,'pay_ICE2003',4,'T••••','Courier','Cash on delivery',13900.00,'INR','Due','The courier collects it at the door','Collected at delivery',NULL,0,'2026-08-24 06:47:20.392406','2026-08-24 06:47:20.392738'),(5,'pay_ICE2004',5,'T••••','Razorpay','Razorpay',12400.00,'INR','Failed','Payment was closed before it completed. Nothing has been charged.','Closed before completing',NULL,0,'2026-08-24 07:08:19.259279','2026-08-24 07:08:19.259723'),(6,'pay_ICE2005',6,'T••••','Razorpay','Razorpay · Card / UPI / Netbanking',5000.00,'INR','Captured','Taken at checkout','pay_TTWjo2YZDouiqL',NULL,0,'2026-08-24 07:38:07.549972','2026-08-24 07:38:07.550465'),(8,'pay_ICE2006',8,'T••••','Courier','Cash on delivery',8600.00,'INR','Due','The courier collects it at the door','Collected at delivery',NULL,0,'2026-08-25 07:13:59.456067','2026-08-25 07:13:59.467159');
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;

--
-- Table structure for table `payouts`
--

DROP TABLE IF EXISTS `payouts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payouts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `gateway` varchar(24) NOT NULL DEFAULT 'Razorpay',
  `period_label` varchar(60) NOT NULL DEFAULT '',
  `gross` decimal(12,2) NOT NULL DEFAULT 0.00,
  `fees` decimal(12,2) NOT NULL DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'INR',
  `status` varchar(16) NOT NULL DEFAULT 'Pending',
  `paid_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payouts_public_id` (`public_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payouts`
--

/*!40000 ALTER TABLE `payouts` DISABLE KEYS */;
/*!40000 ALTER TABLE `payouts` ENABLE KEYS */;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permissions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permissions_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` (`id`, `code`) VALUES (28,'*'),(26,'audit.view'),(7,'catalog.edit'),(8,'catalog.publish'),(6,'catalog.view'),(55,'cms.manage'),(14,'coupons.manage'),(21,'customers.manage'),(20,'customers.view'),(1,'dashboard.view'),(10,'inventory.adjust'),(11,'inventory.transfer'),(9,'inventory.view'),(27,'media.upload'),(3,'orders.manage'),(2,'orders.view'),(17,'payments.exports.create'),(16,'payments.reconcile'),(15,'payments.view'),(19,'refunds.approve'),(18,'refunds.request'),(24,'reports.operational.view'),(13,'returns.approve'),(12,'returns.view'),(22,'reviews.moderate'),(25,'settings.manage'),(5,'shipping.manage'),(4,'shipping.view'),(23,'support.tickets.manage');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;

--
-- Table structure for table `product_materials`
--

DROP TABLE IF EXISTS `product_materials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_materials` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `stock_item_id` bigint(20) unsigned NOT NULL,
  `material_id` bigint(20) unsigned NOT NULL,
  `qty_per_unit` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `wastage_pct` decimal(5,2) NOT NULL DEFAULT 0.00,
  `note` varchar(190) NOT NULL DEFAULT '',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_materials_line` (`stock_item_id`,`material_id`),
  KEY `ix_product_materials_material` (`material_id`),
  CONSTRAINT `fk_product_materials_item` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_product_materials_material` FOREIGN KEY (`material_id`) REFERENCES `materials` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_materials`
--

/*!40000 ALTER TABLE `product_materials` DISABLE KEYS */;
INSERT INTO `product_materials` (`id`, `stock_item_id`, `material_id`, `qty_per_unit`, `wastage_pct`, `note`, `created_at`, `updated_at`) VALUES (6,2,3,2.4000,5.00,'','2026-08-27 10:28:02.301289','2026-08-27 10:28:02.301302'),(7,2,6,1.2000,0.00,'','2026-08-27 10:28:02.303687','2026-08-27 10:28:02.303705'),(8,2,8,1.0000,0.00,'','2026-08-27 10:28:02.306278','2026-08-27 10:28:02.306291'),(9,3,4,1.9000,6.00,'','2026-08-27 10:28:02.308588','2026-08-27 10:28:02.308601'),(10,3,7,1.0000,0.00,'','2026-08-27 10:28:02.310482','2026-08-27 10:28:02.310494'),(11,3,8,1.0000,0.00,'','2026-08-27 10:28:02.312646','2026-08-27 10:28:02.312662'),(12,4,3,2.4000,5.00,'','2026-08-27 10:28:02.314491','2026-08-27 10:28:02.314503'),(13,4,6,1.2000,0.00,'','2026-08-27 10:28:02.316103','2026-08-27 10:28:02.316116'),(14,4,8,1.0000,0.00,'','2026-08-27 10:28:02.318074','2026-08-27 10:28:02.318085'),(15,5,4,1.9000,6.00,'','2026-08-27 10:28:02.320442','2026-08-27 10:28:02.320455'),(16,5,7,1.0000,0.00,'','2026-08-27 10:28:02.322308','2026-08-27 10:28:02.322320'),(17,5,8,1.0000,0.00,'','2026-08-27 10:28:02.324872','2026-08-27 10:28:02.324884'),(18,6,3,2.4000,5.00,'','2026-08-27 10:28:02.326609','2026-08-27 10:28:02.326629'),(19,6,6,1.2000,0.00,'','2026-08-27 10:28:02.328447','2026-08-27 10:28:02.328461'),(20,6,8,1.0000,0.00,'','2026-08-27 10:28:02.330292','2026-08-27 10:28:02.330304');
/*!40000 ALTER TABLE `product_materials` ENABLE KEYS */;

--
-- Table structure for table `product_price_history`
--

DROP TABLE IF EXISTS `product_price_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_price_history` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint(20) unsigned NOT NULL,
  `price` decimal(12,2) NOT NULL,
  `compare_at_price` decimal(12,2) DEFAULT NULL,
  `changed_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_price_history_product` (`product_id`,`created_at`),
  KEY `fk_price_history_actor` (`changed_by`),
  CONSTRAINT `fk_price_history_actor` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_price_history_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_price_history`
--

/*!40000 ALTER TABLE `product_price_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_price_history` ENABLE KEYS */;

--
-- Table structure for table `product_rating_summaries`
--

DROP TABLE IF EXISTS `product_rating_summaries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_rating_summaries` (
  `product_id` bigint(20) unsigned NOT NULL,
  `review_count` int(10) unsigned NOT NULL DEFAULT 0,
  `rating_avg` decimal(3,2) NOT NULL DEFAULT 0.00,
  `refreshed_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`product_id`),
  CONSTRAINT `fk_rating_summaries_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_rating_summaries`
--

/*!40000 ALTER TABLE `product_rating_summaries` DISABLE KEYS */;
INSERT INTO `product_rating_summaries` (`product_id`, `review_count`, `rating_avg`, `refreshed_at`) VALUES (43,1,4.00,'2026-08-19 12:36:51.075990');
/*!40000 ALTER TABLE `product_rating_summaries` ENABLE KEYS */;

--
-- Table structure for table `product_variants`
--

DROP TABLE IF EXISTS `product_variants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_variants` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `size` varchar(8) NOT NULL,
  `color` varchar(60) NOT NULL DEFAULT '',
  `color_hex` char(7) NOT NULL DEFAULT '#000000',
  `material` varchar(120) NOT NULL DEFAULT '',
  `status` varchar(16) NOT NULL DEFAULT 'Active',
  `max_per_order` tinyint(3) unsigned NOT NULL DEFAULT 3,
  `position` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  `live_key` varchar(64) GENERATED ALWAYS AS (if(`deleted_at` is null,concat(`product_id`,'|',`size`),NULL)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_variants_sku` (`public_id`),
  UNIQUE KEY `uq_variants_live_size` (`live_key`),
  KEY `fk_variants_product` (`product_id`),
  CONSTRAINT `fk_variants_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=155 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_variants`
--

/*!40000 ALTER TABLE `product_variants` DISABLE KEYS */;
INSERT INTO `product_variants` (`id`, `public_id`, `product_id`, `size`, `color`, `color_hex`, `material`, `status`, `max_per_order`, `position`, `created_at`, `updated_at`, `deleted_at`, `live_key`) VALUES (1,'ADH-WSB-XS',1,'XS','Washed black','#1b1b1b','Heavyweight cotton','Archived',3,0,'2026-08-17 09:49:53.677269','2026-08-17 12:46:38.184358','2026-08-17 12:46:38.184358',NULL),(2,'ADH-WSB-S',1,'S','Washed black','#1b1b1b','520 GSM brushed cotton fleece','Active',3,1,'2026-08-17 09:49:53.679073','2026-08-17 12:34:17.908220',NULL,'1|S'),(3,'ADH-WSB-M',1,'M','Washed black','#1b1b1b','520 GSM brushed cotton fleece','Active',3,2,'2026-08-17 09:49:53.680565','2026-08-17 12:34:17.909691',NULL,'1|M'),(4,'ADH-WSB-L',1,'L','Washed black','#1b1b1b','520 GSM brushed cotton fleece','Active',3,3,'2026-08-17 09:49:53.680994','2026-08-17 12:34:17.910147',NULL,'1|L'),(5,'ADH-WSB-XL',1,'XL','Washed black','#1b1b1b','520 GSM brushed cotton fleece','Active',3,4,'2026-08-17 09:49:53.681392','2026-08-17 12:34:17.910583',NULL,'1|XL'),(6,'BUO-BON-XS',2,'XS','Bone','#d8d0c2','Heavyweight cotton','Archived',3,0,'2026-08-17 09:49:53.686306','2026-08-17 12:46:38.184358','2026-08-17 12:46:38.184358',NULL),(7,'BUO-BON-S',2,'S','Bone','#d8d0c2','410 GSM cotton canvas','Active',3,1,'2026-08-17 09:49:53.688569','2026-08-17 12:34:17.916781',NULL,'2|S'),(8,'BUO-BON-M',2,'M','Bone','#d8d0c2','410 GSM cotton canvas','Active',3,2,'2026-08-17 09:49:53.689382','2026-08-17 12:34:17.917266',NULL,'2|M'),(9,'BUO-BON-L',2,'L','Bone','#d8d0c2','410 GSM cotton canvas','Active',3,3,'2026-08-17 09:49:53.689795','2026-08-17 12:34:17.917718',NULL,'2|L'),(10,'BUO-BON-XL',2,'XL','Bone','#d8d0c2','410 GSM cotton canvas','Out',3,4,'2026-08-17 09:49:53.690186','2026-08-17 12:34:17.918531',NULL,'2|XL'),(11,'SC2-CHR-XS',3,'XS','Charcoal','#343434','Heavyweight cotton','Archived',3,0,'2026-08-17 09:49:53.692917','2026-08-17 12:46:38.184358','2026-08-17 12:46:38.184358',NULL),(12,'SC2-CHR-S',3,'S','Charcoal','#343434','Heavyweight cotton','Archived',3,1,'2026-08-17 09:49:53.693332','2026-08-17 12:46:38.184358','2026-08-17 12:46:38.184358',NULL),(13,'SC2-CHR-M',3,'M','Charcoal','#343434','Heavyweight cotton','Archived',3,2,'2026-08-17 09:49:53.693725','2026-08-17 12:46:38.184358','2026-08-17 12:46:38.184358',NULL),(14,'SC2-CHR-L',3,'L','Charcoal','#343434','Heavyweight cotton','Archived',3,3,'2026-08-17 09:49:53.695459','2026-08-17 12:46:38.184358','2026-08-17 12:46:38.184358',NULL),(15,'SC2-CHR-XL',3,'XL','Charcoal','#343434','Heavyweight cotton','Archived',3,4,'2026-08-17 09:49:53.695895','2026-08-17 12:46:38.184358','2026-08-17 12:46:38.184358',NULL),(16,'CHT-INK-XS',4,'XS','Ink','#151515','Heavyweight cotton','Archived',3,0,'2026-08-17 09:49:53.697095','2026-08-17 12:46:38.184358','2026-08-17 12:46:38.184358',NULL),(17,'CHT-INK-S',4,'S','Ink','#151515','280 GSM compact cotton jersey','Active',3,1,'2026-08-17 09:49:53.697480','2026-08-17 12:34:17.932588',NULL,'4|S'),(18,'CHT-INK-M',4,'M','Ink','#151515','280 GSM compact cotton jersey','Active',3,2,'2026-08-17 09:49:53.697858','2026-08-17 12:34:17.933176',NULL,'4|M'),(19,'CHT-INK-L',4,'L','Ink','#151515','280 GSM compact cotton jersey','Active',3,3,'2026-08-17 09:49:53.698234','2026-08-17 12:34:17.933716',NULL,'4|L'),(20,'CHT-INK-XL',4,'XL','Ink','#151515','280 GSM compact cotton jersey','Active',3,4,'2026-08-17 09:49:53.698609','2026-08-17 12:34:17.934221',NULL,'4|XL'),(21,'MDD-IND-32',5,'32','Indigo','#232c45','14 oz rigid indigo denim','Active',3,0,'2026-08-17 09:49:53.699761','2026-08-17 12:34:17.936985',NULL,'5|32'),(22,'MDD-IND-34',5,'34','Indigo','#232c45','14 oz rigid indigo denim','Active',3,1,'2026-08-17 09:49:53.700140','2026-08-17 12:34:17.937433',NULL,'5|34'),(23,'MDD-IND-36',5,'36','Indigo','#232c45','14 oz rigid indigo denim','Active',3,2,'2026-08-17 09:49:53.700513','2026-08-17 12:34:17.937855',NULL,'5|36'),(32,'CHR-CHR-30',3,'30','Charcoal','#343434','360 GSM washed cotton twill','Active',3,0,'2026-08-17 12:34:17.920412','2026-08-17 12:34:17.920412',NULL,'3|30'),(33,'CHR-CHR-32',3,'32','Charcoal','#343434','360 GSM washed cotton twill','Active',3,1,'2026-08-17 12:34:17.922171','2026-08-17 12:34:17.922171',NULL,'3|32'),(34,'CHR-CHR-34',3,'34','Charcoal','#343434','360 GSM washed cotton twill','Active',3,2,'2026-08-17 12:34:17.922903','2026-08-17 12:34:17.922903',NULL,'3|34'),(35,'CHR-CHR-36',3,'36','Charcoal','#343434','360 GSM washed cotton twill','Active',3,3,'2026-08-17 12:34:17.929558','2026-08-17 12:34:17.929558',NULL,'3|36'),(40,'INK-INK-XXL',4,'XXL','Ink','#151515','280 GSM compact cotton jersey','Active',3,4,'2026-08-17 12:34:17.934705','2026-08-17 12:34:17.934705',NULL,'4|XXL'),(41,'IND-IND-30',5,'30','Indigo','#232c45','14 oz rigid indigo denim','Active',3,0,'2026-08-17 12:34:17.936363','2026-08-17 12:34:17.936363',NULL,'5|30'),(45,'SLT-SLT-S',11,'S','Slate','#2b2f36','740 GSM pressed wool melton','Out',3,0,'2026-08-17 12:34:17.939075','2026-08-17 12:34:17.939075',NULL,'11|S'),(46,'SLT-SLT-M',11,'M','Slate','#2b2f36','740 GSM pressed wool melton','Low',3,1,'2026-08-17 12:34:17.943733','2026-08-17 12:34:17.943733',NULL,'11|M'),(47,'SLT-SLT-L',11,'L','Slate','#2b2f36','740 GSM pressed wool melton','Low',3,2,'2026-08-17 12:34:17.945909','2026-08-17 12:34:17.945909',NULL,'11|L'),(48,'SLT-SLT-XL',11,'XL','Slate','#2b2f36','740 GSM pressed wool melton','Low',3,3,'2026-08-17 12:34:17.947576','2026-08-17 12:34:17.947576',NULL,'11|XL'),(49,'BLC-BNO-S',12,'S','Bone','#d8d0c2','520 GSM cotton canvas','Low',3,0,'2026-08-17 12:34:17.950402','2026-08-17 12:34:17.950402',NULL,'12|S'),(50,'BLC-BNO-M',12,'M','Bone','#d8d0c2','520 GSM cotton canvas','Low',3,1,'2026-08-17 12:34:17.950948','2026-08-17 12:34:17.950948',NULL,'12|M'),(51,'BLC-BNO-L',12,'L','Bone','#d8d0c2','520 GSM cotton canvas','Low',3,2,'2026-08-17 12:34:17.951877','2026-08-17 12:34:17.951877',NULL,'12|L'),(52,'BLC-BNO-XL',12,'XL','Bone','#d8d0c2','520 GSM cotton canvas','Low',3,3,'2026-08-17 12:34:17.955817','2026-08-17 12:34:17.955817',NULL,'12|XL'),(53,'BFJ-BNO-S',13,'S','Bone','#cfc6b6','450 GSM waxed cotton canvas','Out',3,0,'2026-08-17 12:34:17.957574','2026-08-17 12:34:17.957574',NULL,'13|S'),(54,'BFJ-BNO-M',13,'M','Bone','#cfc6b6','450 GSM waxed cotton canvas','Low',3,1,'2026-08-17 12:34:17.958218','2026-08-17 12:34:17.958218',NULL,'13|M'),(55,'BFJ-BNO-L',13,'L','Bone','#cfc6b6','450 GSM waxed cotton canvas','Low',3,2,'2026-08-17 12:34:17.958833','2026-08-17 12:34:17.958833',NULL,'13|L'),(56,'BFJ-BNO-XL',13,'XL','Bone','#cfc6b6','450 GSM waxed cotton canvas','Out',3,3,'2026-08-17 12:34:17.959434','2026-08-17 12:34:17.959434',NULL,'13|XL'),(57,'IWJ-IVR-S',14,'S','Ivory','#e4ddd0','430 GSM cotton canvas','Low',3,0,'2026-08-17 12:34:17.961182','2026-08-17 12:34:17.961182',NULL,'14|S'),(58,'IWJ-IVR-M',14,'M','Ivory','#e4ddd0','430 GSM cotton canvas','Low',3,1,'2026-08-17 12:34:17.963027','2026-08-17 12:34:17.963027',NULL,'14|M'),(59,'IWJ-IVR-L',14,'L','Ivory','#e4ddd0','430 GSM cotton canvas','Low',3,2,'2026-08-17 12:34:17.963679','2026-08-17 12:34:17.963679',NULL,'14|L'),(60,'IWJ-IVR-XL',14,'XL','Ivory','#e4ddd0','430 GSM cotton canvas','Low',3,3,'2026-08-17 12:34:17.964289','2026-08-17 12:34:17.964289',NULL,'14|XL'),(61,'UPS-GRP-S',15,'S','Graphite','#33383d','3-layer recycled polyester with a PFC-free membrane','Low',3,0,'2026-08-17 12:34:17.965743','2026-08-17 12:34:17.965743',NULL,'15|S'),(62,'UPS-GRP-M',15,'M','Graphite','#33383d','3-layer recycled polyester with a PFC-free membrane','Low',3,1,'2026-08-17 12:34:17.967392','2026-08-17 12:34:17.967392',NULL,'15|M'),(63,'UPS-GRP-L',15,'L','Graphite','#33383d','3-layer recycled polyester with a PFC-free membrane','Low',3,2,'2026-08-17 12:34:17.968823','2026-08-17 12:34:17.968823',NULL,'15|L'),(64,'UPS-GRP-XL',15,'XL','Graphite','#33383d','3-layer recycled polyester with a PFC-free membrane','Low',3,3,'2026-08-17 12:34:17.970766','2026-08-17 12:34:17.970766',NULL,'15|XL'),(65,'CSO-BNO-S',16,'S','Bone','#d3cabb','410 GSM cotton canvas, twice-fused collar','Low',3,0,'2026-08-17 12:34:17.974433','2026-08-17 12:34:17.974433',NULL,'16|S'),(66,'CSO-BNO-M',16,'M','Bone','#d3cabb','410 GSM cotton canvas, twice-fused collar','Low',3,1,'2026-08-17 12:34:17.975788','2026-08-17 12:34:17.975788',NULL,'16|M'),(67,'CSO-BNO-L',16,'L','Bone','#d3cabb','410 GSM cotton canvas, twice-fused collar','Low',3,2,'2026-08-17 12:34:17.978604','2026-08-17 12:34:17.978604',NULL,'16|L'),(68,'CSO-BNO-XL',16,'XL','Bone','#d3cabb','410 GSM cotton canvas, twice-fused collar','Low',3,3,'2026-08-17 12:34:17.981149','2026-08-17 12:34:17.981149',NULL,'16|XL'),(69,'CSS-CHL-S',17,'S','Chalk','#e8e3d8','160 GSM compact cotton poplin','Out',3,0,'2026-08-17 12:34:17.985930','2026-08-17 12:34:17.985930',NULL,'17|S'),(70,'CSS-CHL-M',17,'M','Chalk','#e8e3d8','160 GSM compact cotton poplin','Active',3,1,'2026-08-17 12:34:17.987608','2026-08-17 12:34:17.987608',NULL,'17|M'),(71,'CSS-CHL-L',17,'L','Chalk','#e8e3d8','160 GSM compact cotton poplin','Active',3,2,'2026-08-17 12:34:17.989408','2026-08-17 12:34:17.989408',NULL,'17|L'),(72,'CSS-CHL-XL',17,'XL','Chalk','#e8e3d8','160 GSM compact cotton poplin','Active',3,3,'2026-08-17 12:34:17.991395','2026-08-17 12:34:17.991395',NULL,'17|XL'),(73,'FRO-BNO-S',18,'S','Bone','#d8d0c2','410 GSM cotton canvas','Low',3,0,'2026-08-17 12:34:17.998097','2026-08-17 12:34:17.998097',NULL,'18|S'),(74,'FRO-BNO-M',18,'M','Bone','#d8d0c2','410 GSM cotton canvas','Low',3,1,'2026-08-17 12:34:18.000072','2026-08-17 12:34:18.000072',NULL,'18|M'),(75,'FRO-BNO-L',18,'L','Bone','#d8d0c2','410 GSM cotton canvas','Low',3,2,'2026-08-17 12:34:18.002150','2026-08-17 12:34:18.002150',NULL,'18|L'),(76,'FRO-BNO-XL',18,'XL','Bone','#d8d0c2','410 GSM cotton canvas','Low',3,3,'2026-08-17 12:34:18.004110','2026-08-17 12:34:18.004110',NULL,'18|XL'),(77,'FRO-BNO-XXL',18,'XXL','Bone','#d8d0c2','410 GSM cotton canvas','Low',3,4,'2026-08-17 12:34:18.006273','2026-08-17 12:34:18.006273',NULL,'18|XXL'),(78,'CZH-CNC-S',19,'S','Concrete','#8b8880','520 GSM brushed cotton fleece','Active',3,0,'2026-08-17 12:34:18.010634','2026-08-17 12:34:18.010634',NULL,'19|S'),(79,'CZH-CNC-M',19,'M','Concrete','#8b8880','520 GSM brushed cotton fleece','Active',3,1,'2026-08-17 12:34:18.013817','2026-08-17 12:34:18.013817',NULL,'19|M'),(80,'CZH-CNC-L',19,'L','Concrete','#8b8880','520 GSM brushed cotton fleece','Active',3,2,'2026-08-17 12:34:18.016411','2026-08-17 12:34:18.016411',NULL,'19|L'),(81,'CZH-CNC-XL',19,'XL','Concrete','#8b8880','520 GSM brushed cotton fleece','Active',3,3,'2026-08-17 12:34:18.018213','2026-08-17 12:34:18.018213',NULL,'19|XL'),(82,'SZH-ASH-S',20,'S','Ash','#9a958c','520 GSM brushed cotton fleece','Active',3,0,'2026-08-17 12:34:18.022309','2026-08-17 12:34:18.022309',NULL,'20|S'),(83,'SZH-ASH-M',20,'M','Ash','#9a958c','520 GSM brushed cotton fleece','Active',3,1,'2026-08-17 12:34:18.023879','2026-08-17 12:34:18.023879',NULL,'20|M'),(84,'SZH-ASH-L',20,'L','Ash','#9a958c','520 GSM brushed cotton fleece','Active',3,2,'2026-08-17 12:34:18.025360','2026-08-17 12:34:18.025360',NULL,'20|L'),(85,'SZH-ASH-XL',20,'XL','Ash','#9a958c','520 GSM brushed cotton fleece','Active',3,3,'2026-08-17 12:34:18.026805','2026-08-17 12:34:18.026805',NULL,'20|XL'),(86,'GWH-GRV-S',21,'S','Gravel','#6f6b64','520 GSM stone-washed cotton fleece','Active',3,0,'2026-08-17 12:34:18.032578','2026-08-17 12:34:18.032578',NULL,'21|S'),(87,'GWH-GRV-M',21,'M','Gravel','#6f6b64','520 GSM stone-washed cotton fleece','Active',3,1,'2026-08-17 12:34:18.034272','2026-08-17 12:34:18.034272',NULL,'21|M'),(88,'GWH-GRV-L',21,'L','Gravel','#6f6b64','520 GSM stone-washed cotton fleece','Active',3,2,'2026-08-17 12:34:18.036037','2026-08-17 12:34:18.036037',NULL,'21|L'),(89,'GWH-GRV-XL',21,'XL','Gravel','#6f6b64','520 GSM stone-washed cotton fleece','Active',3,3,'2026-08-17 12:34:18.037699','2026-08-17 12:34:18.037699',NULL,'21|XL'),(90,'WCH-GRV-S',22,'S','Gravel','#6f6b64','520 GSM stone-washed cotton fleece','Active',3,0,'2026-08-17 12:34:18.041430','2026-08-17 12:34:18.041430',NULL,'22|S'),(91,'WCH-GRV-M',22,'M','Gravel','#6f6b64','520 GSM stone-washed cotton fleece','Active',3,1,'2026-08-17 12:34:18.043000','2026-08-17 12:34:18.043000',NULL,'22|M'),(92,'WCH-GRV-L',22,'L','Gravel','#6f6b64','520 GSM stone-washed cotton fleece','Active',3,2,'2026-08-17 12:34:18.045903','2026-08-17 12:34:18.045903',NULL,'22|L'),(93,'WCH-GRV-XL',22,'XL','Gravel','#6f6b64','520 GSM stone-washed cotton fleece','Active',3,3,'2026-08-17 12:34:18.048258','2026-08-17 12:34:18.048258',NULL,'22|XL'),(94,'MNH-VDO-S',23,'S','Void','#101013','600 GSM loopback cotton','Active',3,0,'2026-08-17 12:34:18.052259','2026-08-17 12:34:18.052259',NULL,'23|S'),(95,'MNH-VDO-M',23,'M','Void','#101013','600 GSM loopback cotton','Active',3,1,'2026-08-17 12:34:18.053826','2026-08-17 12:34:18.053826',NULL,'23|M'),(96,'MNH-VDO-L',23,'L','Void','#101013','600 GSM loopback cotton','Active',3,2,'2026-08-17 12:34:18.055313','2026-08-17 12:34:18.055313',NULL,'23|L'),(97,'MNH-VDO-XL',23,'XL','Void','#101013','600 GSM loopback cotton','Active',3,3,'2026-08-17 12:34:18.056966','2026-08-17 12:34:18.056966',NULL,'23|XL'),(98,'MNH-VDO-XXL',23,'XXL','Void','#101013','600 GSM loopback cotton','Out',3,4,'2026-08-17 12:34:18.058551','2026-08-17 12:34:18.058551',NULL,'23|XXL'),(99,'VC2-CHR-30',24,'30','Charcoal','#343434','360 GSM washed cotton twill','Active',3,0,'2026-08-17 12:34:18.062578','2026-08-17 12:34:18.062578',NULL,'24|30'),(100,'VC2-CHR-32',24,'32','Charcoal','#343434','360 GSM washed cotton twill','Active',3,1,'2026-08-17 12:34:18.064042','2026-08-17 12:34:18.064042',NULL,'24|32'),(101,'VC2-CHR-34',24,'34','Charcoal','#343434','360 GSM washed cotton twill','Active',3,2,'2026-08-17 12:34:18.065826','2026-08-17 12:34:18.065826',NULL,'24|34'),(102,'VC2-CHR-36',24,'36','Charcoal','#343434','360 GSM washed cotton twill','Active',3,3,'2026-08-17 12:34:18.070070','2026-08-17 12:34:18.070070',NULL,'24|36'),(103,'BCP-IRN-30',25,'30','Iron','#4a4d52','400 GSM cotton twill','Active',3,0,'2026-08-17 12:34:18.075294','2026-08-17 12:34:18.075294',NULL,'25|30'),(104,'BCP-IRN-32',25,'32','Iron','#4a4d52','400 GSM cotton twill','Active',3,1,'2026-08-17 12:34:18.076909','2026-08-17 12:34:18.076909',NULL,'25|32'),(105,'BCP-IRN-34',25,'34','Iron','#4a4d52','400 GSM cotton twill','Active',3,2,'2026-08-17 12:34:18.079893','2026-08-17 12:34:18.079893',NULL,'25|34'),(106,'BCP-IRN-36',25,'36','Iron','#4a4d52','400 GSM cotton twill','Active',3,3,'2026-08-17 12:34:18.082212','2026-08-17 12:34:18.082212',NULL,'25|36'),(107,'BCP-IRN-38',25,'38','Iron','#4a4d52','400 GSM cotton twill','Out',3,4,'2026-08-17 12:34:18.083950','2026-08-17 12:34:18.083950',NULL,'25|38'),(108,'LPC-CHR-30',26,'30','Charcoal','#3a3a3a','340 GSM washed cotton twill','Active',3,0,'2026-08-17 12:34:18.087805','2026-08-17 12:34:18.087805',NULL,'26|30'),(109,'LPC-CHR-32',26,'32','Charcoal','#3a3a3a','340 GSM washed cotton twill','Active',3,1,'2026-08-17 12:34:18.089197','2026-08-17 12:34:18.089197',NULL,'26|32'),(110,'LPC-CHR-34',26,'34','Charcoal','#3a3a3a','340 GSM washed cotton twill','Active',3,2,'2026-08-17 12:34:18.090848','2026-08-17 12:34:18.090848',NULL,'26|34'),(111,'LPC-CHR-36',26,'36','Charcoal','#3a3a3a','340 GSM washed cotton twill','Active',3,3,'2026-08-17 12:34:18.092383','2026-08-17 12:34:18.092383',NULL,'26|36'),(112,'DCP-CHR-30',27,'30','Charcoal','#3a3a3a','300 GSM washed cotton twill','Active',3,0,'2026-08-17 12:34:18.097501','2026-08-17 12:34:18.097501',NULL,'27|30'),(113,'DCP-CHR-32',27,'32','Charcoal','#3a3a3a','300 GSM washed cotton twill','Active',3,1,'2026-08-17 12:34:18.099420','2026-08-17 12:34:18.099420',NULL,'27|32'),(114,'DCP-CHR-34',27,'34','Charcoal','#3a3a3a','300 GSM washed cotton twill','Active',3,2,'2026-08-17 12:34:18.101579','2026-08-17 12:34:18.101579',NULL,'27|34'),(115,'DCP-CHR-36',27,'36','Charcoal','#3a3a3a','300 GSM washed cotton twill','Active',3,3,'2026-08-17 12:34:18.103620','2026-08-17 12:34:18.103620',NULL,'27|36'),(116,'DWT-BNO-30',28,'30','Bone','#cdc4b4','Deadstock 380 GSM cotton twill','Active',3,0,'2026-08-17 12:34:18.108399','2026-08-17 12:34:18.108399',NULL,'28|30'),(117,'DWT-BNO-32',28,'32','Bone','#cdc4b4','Deadstock 380 GSM cotton twill','Active',3,1,'2026-08-17 12:34:18.110303','2026-08-17 12:34:18.110303',NULL,'28|32'),(118,'DWT-BNO-34',28,'34','Bone','#cdc4b4','Deadstock 380 GSM cotton twill','Active',3,2,'2026-08-17 12:34:18.114877','2026-08-17 12:34:18.114877',NULL,'28|34'),(119,'DWT-BNO-36',28,'36','Bone','#cdc4b4','Deadstock 380 GSM cotton twill','Out',3,3,'2026-08-17 12:34:18.117766','2026-08-17 12:34:18.117766',NULL,'28|36'),(120,'SBT-STT-S',29,'S','Static','#4f4f52','260 GSM cotton jersey','Active',3,0,'2026-08-17 12:34:18.123193','2026-08-17 12:34:18.123193',NULL,'29|S'),(121,'SBT-STT-M',29,'M','Static','#4f4f52','260 GSM cotton jersey','Active',3,1,'2026-08-17 12:34:18.125181','2026-08-17 12:34:18.125181',NULL,'29|M'),(122,'SBT-STT-L',29,'L','Static','#4f4f52','260 GSM cotton jersey','Active',3,2,'2026-08-17 12:34:18.126981','2026-08-17 12:34:18.126981',NULL,'29|L'),(123,'SBT-STT-XL',29,'XL','Static','#4f4f52','260 GSM cotton jersey','Active',3,3,'2026-08-17 12:34:18.129865','2026-08-17 12:34:18.129865',NULL,'29|XL'),(124,'SBT-STT-XXL',29,'XXL','Static','#4f4f52','260 GSM cotton jersey','Active',3,4,'2026-08-17 12:34:18.132643','2026-08-17 12:34:18.132643',NULL,'29|XXL'),(125,'SCT-STT-S',30,'S','Static','#4f4f52','260 GSM cotton jersey','Active',3,0,'2026-08-17 12:34:18.137136','2026-08-17 12:34:18.137136',NULL,'30|S'),(126,'SCT-STT-M',30,'M','Static','#4f4f52','260 GSM cotton jersey','Active',3,1,'2026-08-17 12:34:18.138854','2026-08-17 12:34:18.138854',NULL,'30|M'),(127,'SCT-STT-L',30,'L','Static','#4f4f52','260 GSM cotton jersey','Active',3,2,'2026-08-17 12:34:18.140548','2026-08-17 12:34:18.140548',NULL,'30|L'),(128,'SCT-STT-XL',30,'XL','Static','#4f4f52','260 GSM cotton jersey','Active',3,3,'2026-08-17 12:34:18.142044','2026-08-17 12:34:18.142044',NULL,'30|XL'),(129,'SCT-STT-XXL',30,'XXL','Static','#4f4f52','260 GSM cotton jersey','Active',3,4,'2026-08-17 12:34:18.143494','2026-08-17 12:34:18.143494',NULL,'30|XXL'),(130,'ULS-INK-S',31,'S','Ink','#151515','280 GSM compact cotton jersey','Active',3,0,'2026-08-17 12:34:18.149284','2026-08-17 12:34:18.149284',NULL,'31|S'),(131,'ULS-INK-M',31,'M','Ink','#151515','280 GSM compact cotton jersey','Active',3,1,'2026-08-17 12:34:18.150902','2026-08-17 12:34:18.150902',NULL,'31|M'),(132,'ULS-INK-L',31,'L','Ink','#151515','280 GSM compact cotton jersey','Active',3,2,'2026-08-17 12:34:18.152570','2026-08-17 12:34:18.152570',NULL,'31|L'),(133,'ULS-INK-XL',31,'XL','Ink','#151515','280 GSM compact cotton jersey','Active',3,3,'2026-08-17 12:34:18.154257','2026-08-17 12:34:18.154257',NULL,'31|XL'),(134,'ULS-INK-XXL',31,'XXL','Ink','#151515','280 GSM compact cotton jersey','Active',3,4,'2026-08-17 12:34:18.155838','2026-08-17 12:34:18.155838',NULL,'31|XXL'),(135,'VCP-VDO-OS',32,'OS','Void','#141416','600D canvas with anodised hardware','Active',3,0,'2026-08-17 12:34:18.159692','2026-08-17 12:34:18.159692',NULL,'32|OS'),(136,'VCL-VDO-OS',33,'OS','Void','#141416','600D canvas with anodised hardware','Active',3,0,'2026-08-17 12:34:18.164923','2026-08-17 12:34:18.164923',NULL,'33|OS'),(137,'CLS-STL-OS',34,'OS','Steel','#9ea3a8','Brushed 316L stainless steel','Active',3,0,'2026-08-17 12:34:18.168951','2026-08-17 12:34:18.168951',NULL,'34|OS'),(138,'LCB-STL-OS',35,'OS','Steel','#9ea3a8','Brushed 316L stainless steel','Active',3,0,'2026-08-17 12:34:18.172729','2026-08-17 12:34:18.172729',NULL,'35|OS'),(139,'SGB-VDO-7',36,'7','Void','#17171a','Full-grain leather on a rubber wedge, Blake stitched','Active',3,0,'2026-08-17 12:34:18.176640','2026-08-17 12:34:18.176640',NULL,'36|7'),(140,'SGB-VDO-8',36,'8','Void','#17171a','Full-grain leather on a rubber wedge, Blake stitched','Active',3,1,'2026-08-17 12:34:18.182471','2026-08-17 12:34:18.182471',NULL,'36|8'),(141,'SGB-VDO-9',36,'9','Void','#17171a','Full-grain leather on a rubber wedge, Blake stitched','Active',3,2,'2026-08-17 12:34:18.184575','2026-08-17 12:34:18.184575',NULL,'36|9'),(142,'SGB-VDO-10',36,'10','Void','#17171a','Full-grain leather on a rubber wedge, Blake stitched','Active',3,3,'2026-08-17 12:34:18.186338','2026-08-17 12:34:18.186338',NULL,'36|10'),(143,'SGB-VDO-11',36,'11','Void','#17171a','Full-grain leather on a rubber wedge, Blake stitched','Out',3,4,'2026-08-17 12:34:18.188014','2026-08-17 12:34:18.188014',NULL,'36|11'),(144,'D1F-MXD-OS',37,'OS','Mixed','#2a2a2d','See each piece','Active',3,0,'2026-08-17 12:34:18.192063','2026-08-17 12:34:18.192063',NULL,'37|OS'),(151,'DMP-GEN-30',43,'30','','#000000','','Active',3,0,'2026-08-19 07:59:19.557654','2026-08-19 07:59:19.558182',NULL,'43|30'),(152,'DMP-GEN-32',43,'32','','#000000','','Active',3,0,'2026-08-19 07:59:19.567212','2026-08-19 07:59:19.567806',NULL,'43|32'),(153,'DMP-GEN-34',43,'34','','#000000','','Active',3,0,'2026-08-19 07:59:19.570369','2026-08-19 07:59:19.570720',NULL,'43|34'),(154,'DMP-GEN-36',43,'36','','#000000','','Active',3,0,'2026-08-19 07:59:19.575973','2026-08-19 07:59:19.576460',NULL,'43|36');
/*!40000 ALTER TABLE `product_variants` ENABLE KEYS */;

--
-- Table structure for table `production_run_materials`
--

DROP TABLE IF EXISTS `production_run_materials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `production_run_materials` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `run_id` bigint(20) unsigned NOT NULL,
  `material_id` bigint(20) unsigned NOT NULL,
  `qty_per_unit` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `wastage_pct` decimal(5,2) NOT NULL DEFAULT 0.00,
  `qty_reserved` decimal(12,3) NOT NULL DEFAULT 0.000,
  `qty_consumed` decimal(12,3) NOT NULL DEFAULT 0.000,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_run_materials_line` (`run_id`,`material_id`),
  KEY `ix_run_materials_material` (`material_id`),
  CONSTRAINT `fk_run_materials_material` FOREIGN KEY (`material_id`) REFERENCES `materials` (`id`),
  CONSTRAINT `fk_run_materials_run` FOREIGN KEY (`run_id`) REFERENCES `production_runs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_run_materials`
--

/*!40000 ALTER TABLE `production_run_materials` DISABLE KEYS */;
INSERT INTO `production_run_materials` (`id`, `run_id`, `material_id`, `qty_per_unit`, `wastage_pct`, `qty_reserved`, `qty_consumed`) VALUES (5,3,3,2.4000,5.00,0.000,0.000),(6,3,8,1.0000,0.00,0.000,0.000),(7,3,6,1.2000,0.00,0.000,0.000),(8,4,3,2.4000,5.00,90.720,90.720),(9,4,8,1.0000,0.00,36.000,36.000),(10,4,6,1.2000,0.00,43.200,43.200);
/*!40000 ALTER TABLE `production_run_materials` ENABLE KEYS */;

--
-- Table structure for table `production_runs`
--

DROP TABLE IF EXISTS `production_runs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `production_runs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(16) NOT NULL,
  `stock_item_id` bigint(20) unsigned NOT NULL,
  `warehouse_id` bigint(20) unsigned DEFAULT NULL,
  `qty_planned` int(10) unsigned NOT NULL DEFAULT 0,
  `qty_produced` int(10) unsigned NOT NULL DEFAULT 0,
  `status` varchar(16) NOT NULL DEFAULT 'PLANNED',
  `started_at` datetime(6) DEFAULT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `owner_user_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_production_runs_public_id` (`public_id`),
  KEY `ix_production_runs_item` (`stock_item_id`,`deleted_at`),
  KEY `ix_production_runs_status` (`status`,`deleted_at`),
  KEY `fk_production_runs_warehouse` (`warehouse_id`),
  KEY `fk_production_runs_owner` (`owner_user_id`),
  CONSTRAINT `fk_production_runs_item` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items` (`id`),
  CONSTRAINT `fk_production_runs_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_production_runs_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_runs`
--

/*!40000 ALTER TABLE `production_runs` DISABLE KEYS */;
INSERT INTO `production_runs` (`id`, `public_id`, `stock_item_id`, `warehouse_id`, `qty_planned`, `qty_produced`, `status`, `started_at`, `completed_at`, `notes`, `owner_user_id`, `created_at`, `updated_at`, `deleted_at`) VALUES (3,'run-0001',1,1,60,0,'PLANNED',NULL,NULL,'',1,'2026-08-27 10:28:02.332706','2026-08-27 10:28:02.332718',NULL),(4,'run-0002',1,1,40,36,'DONE','2026-08-27 10:28:02.000000','2026-08-27 10:30:34.000000','',1,'2026-08-27 10:28:02.341104','2026-08-27 10:30:34.000000',NULL);
/*!40000 ALTER TABLE `production_runs` ENABLE KEYS */;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `products` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(80) NOT NULL,
  `name` varchar(160) NOT NULL,
  `category` varchar(80) NOT NULL DEFAULT '',
  `category_id` bigint(20) unsigned DEFAULT NULL,
  `item_ref` varchar(40) DEFAULT NULL,
  `sku_code` varchar(8) NOT NULL DEFAULT '',
  `listing_size` varchar(8) NOT NULL DEFAULT '',
  `description` text DEFAULT NULL,
  `story` text DEFAULT NULL,
  `fabric` varchar(255) NOT NULL DEFAULT '',
  `care` varchar(255) NOT NULL DEFAULT '',
  `price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `compare_at_price` decimal(12,2) DEFAULT NULL,
  `currency` char(3) NOT NULL DEFAULT 'INR',
  `color` varchar(60) NOT NULL DEFAULT '',
  `badge` varchar(40) DEFAULT NULL,
  `image_position` varchar(16) NOT NULL DEFAULT 'top-left',
  `image_media_id` bigint(20) unsigned DEFAULT NULL,
  `audience` varchar(16) NOT NULL DEFAULT 'unisex',
  `collection_slug` varchar(80) NOT NULL DEFAULT '',
  `is_new` tinyint(1) NOT NULL DEFAULT 0,
  `status` varchar(16) NOT NULL DEFAULT 'Draft',
  `tax_note` varchar(120) DEFAULT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_slug` (`public_id`),
  KEY `ix_products_status` (`status`,`deleted_at`),
  KEY `ix_products_audience` (`audience`),
  KEY `ix_products_collection` (`collection_slug`),
  KEY `ix_products_item_ref` (`item_ref`),
  KEY `ix_products_sku_code` (`sku_code`),
  KEY `fk_products_category` (`category_id`),
  KEY `fk_products_image` (`image_media_id`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_products_image` FOREIGN KEY (`image_media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_products_item_ref` FOREIGN KEY (`item_ref`) REFERENCES `stock_items` (`public_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` (`id`, `public_id`, `name`, `category`, `category_id`, `item_ref`, `sku_code`, `listing_size`, `description`, `story`, `fabric`, `care`, `price`, `compare_at_price`, `currency`, `color`, `badge`, `image_position`, `image_media_id`, `audience`, `collection_slug`, `is_new`, `status`, `tax_note`, `position`, `created_at`, `updated_at`, `deleted_at`) VALUES (1,'afterdark-hoodie','Afterdark Hoodie','Heavyweight fleece',6,'ITM-001','WSB','M','A dense, garment-washed hoodie cut with a dropped shoulder and deliberate weight.','Designed as the anchor of Drop 001 — quiet from a distance, exact up close.','520 GSM brushed cotton fleece','Cold wash inside out. Dry flat. Do not bleach.',8900.00,10200.00,'INR','Washed black','Bestseller','top-left',3,'unisex','drop-001',0,'Draft',NULL,0,'2026-08-17 09:49:53.674860','2026-08-19 06:42:43.893458',NULL),(2,'bone-utility-overshirt','Bone Utility Overshirt','Structured canvas',1,'ITM-002','BON','S','A four-pocket overshirt with a clean collar, boxy body, and hardware built to age.','Utility stripped back to its essential lines in the one light tone of the release.','410 GSM cotton canvas','Cold wash separately. Line dry in shade.',11400.00,NULL,'INR','Bone','New','top-right',5,'unisex','drop-001',1,'Draft',NULL,1,'2026-08-17 09:49:53.682856','2026-08-19 06:45:53.029161',NULL),(3,'shadow-cargo-02','Shadow Cargo 02','Relaxed utility',7,'ITM-003','CHR','32','A wide-leg cargo balanced by articulated knees and low-profile storage.','Volume without drag, designed for long nights and constant movement.','360 GSM washed cotton twill','Machine wash cold. Wash with similar colours.',9800.00,NULL,'INR','Charcoal','New','bottom-left',6,'unisex','drop-001',1,'Draft',NULL,2,'2026-08-17 09:49:53.690879','2026-08-19 06:46:02.795324',NULL),(4,'core-heavy-tee','Core Heavy Tee','280 GSM cotton',8,'ITM-004','INK','M','A compact jersey tee with a clean neck, dropped shoulder, and permanent structure.','The simplest piece in the uniform, rebuilt until the proportions felt inevitable.','280 GSM compact cotton jersey','Cold wash. Reshape while damp. Dry flat.',4600.00,NULL,'INR','Ink','Core','bottom-right',7,'unisex','core-uniform',0,'Draft',NULL,3,'2026-08-17 09:49:53.696441','2026-08-19 06:46:59.438563',NULL),(5,'midnight-denim','Midnight Denim','Rigid indigo denim',7,'ITM-005','IND','34','A straight-leg rigid denim that breaks in rather than wears out.','The pair the rest of the uniform was cut around.','14 oz rigid indigo denim','Wash rarely, cold, inside out.',7800.00,NULL,'INR','Indigo',NULL,'bottom-left',8,'men','after-hours',0,'Scheduled',NULL,4,'2026-08-17 09:49:53.699127','2026-08-18 07:10:37.891030',NULL),(11,'nightshift-overcoat','abc','Archive wool',1,'ITM-006','SLT','L','A full-length overcoat with a concealed placket and a shoulder cut to carry weight.','Brought back from the first archive run, in the one colour it was ever made in.','740 GSM pressed wool melton','Dry clean only. Brush along the nap.',18600.00,NULL,'INR','Slate','Archive','top-right',9,'men','after-hours',0,'Draft',NULL,5,'2026-08-17 12:34:17.938492','2026-08-19 06:25:34.982662',NULL),(12,'bone-long-coat','Bone Long Coat','Archive canvas',1,'ITM-007','BLC','M','A column coat that falls straight from the shoulder with no break at the waist.','The women\'s counterpart to the Nightshift, cut longer and left unlined.','520 GSM cotton canvas','Dry clean only.',19800.00,NULL,'INR','Bone','Archive','top-right',10,'women','after-hours',0,'Published',NULL,6,'2026-08-17 12:34:17.949747','2026-08-18 07:10:38.215500',NULL),(13,'bone-field-jacket','Bone Field Jacket','Waxed canvas',1,'ITM-008','BFJ','L','A four-pocket field jacket with a bellowed back and a collar that stands on its own.','Built to be worn wet and dried on a hook.','450 GSM waxed cotton canvas','Sponge clean. Re-wax annually. Never machine wash.',13900.00,NULL,'INR','Bone','Canvas','top-right',11,'men','drop-001',0,'Published',NULL,7,'2026-08-17 12:34:17.956870','2026-08-18 07:10:38.426584',NULL),(14,'ivory-work-jacket','Ivory Work Jacket','Chore canvas',1,'ITM-009','IWJ','M','A cropped chore jacket with three patch pockets and a squared hem.','The work jacket, re-proportioned rather than resized.','430 GSM cotton canvas','Cold wash separately. Line dry in shade.',13900.00,NULL,'INR','Ivory','Canvas','top-right',12,'women','drop-001',0,'Published',NULL,8,'2026-08-17 12:34:17.960228','2026-08-18 07:10:38.580382',NULL),(15,'underpass-shell','Underpass Shell','Technical shell',1,'ITM-010','UPS','M','A sealed-seam shell with a storm hood and pit vents, cut long over a hoodie.','For the walk home, in the weather that made the walk memorable.','3-layer recycled polyester with a PFC-free membrane','Machine wash cold on a technical cycle. No softener.',16200.00,NULL,'INR','Graphite','Technical','top-right',13,'unisex','after-hours',0,'Published',NULL,9,'2026-08-17 12:34:17.965112','2026-08-18 07:10:38.838715',NULL),(16,'collar-study-overshirt','Collar Study Overshirt','Detail canvas',1,'ITM-011','CSO','M','The overshirt with the collar taken apart and rebuilt twice as heavy.','One detail, followed all the way through the pattern.','410 GSM cotton canvas, twice-fused collar','Cold wash separately. Press the collar from the underside.',11800.00,NULL,'INR','Bone','Detail','top-right',14,'men','drop-001',0,'Published',NULL,10,'2026-08-17 12:34:17.972808','2026-08-18 07:10:38.961790',NULL),(17,'collar-study-shirt','Collar Study Shirt','Detail poplin',1,'ITM-012','CSS','M','A stand-collar shirt cut with a dropped yoke and a curved hem.','The same collar study, in a cloth that shows every stitch of it.','160 GSM compact cotton poplin','Cold wash. Iron damp.',11800.00,NULL,'INR','Chalk','Detail','top-right',15,'women','drop-001',0,'Published',NULL,11,'2026-08-17 12:34:17.984027','2026-08-18 07:10:39.118444',NULL),(18,'freight-overshirt','Freight Overshirt','Bone canvas',1,'ITM-013','FRO','L','The overshirt at its largest — two sizes of volume with the same shoulder.','Cut to go over everything else in the release at once.','410 GSM cotton canvas','Cold wash separately. Line dry in shade.',12400.00,NULL,'INR','Bone','Bone','top-right',16,'unisex','core-uniform',0,'Published',NULL,12,'2026-08-17 12:34:17.994904','2026-08-18 07:10:39.537046',NULL),(19,'concrete-zip-hood','Concrete Zip Hood','Heavyweight fleece',6,'ITM-014','CZH','L','A full-zip hood with a two-way zip and a hem that sits below the waist.','The hoodie, opened up, without losing the weight that made it one.','520 GSM brushed cotton fleece','Cold wash inside out. Dry flat.',10400.00,NULL,'INR','Concrete','Heavyweight','top-left',17,'men','drop-001',0,'Published',NULL,13,'2026-08-17 12:34:18.008903','2026-08-18 07:10:39.730568',NULL),(20,'structured-zip-hood','Structured Zip Hood','Heavyweight fleece',6,'ITM-015','SZH','M','A zip hood with a shaped side seam and a shortened body.','The same fleece, re-cut so the volume sits where it was meant to.','520 GSM brushed cotton fleece','Cold wash inside out. Dry flat.',10400.00,NULL,'INR','Ash','Heavyweight','top-left',18,'women','drop-001',0,'Published',NULL,14,'2026-08-17 12:34:18.020577','2026-08-18 07:10:39.987244',NULL),(21,'gravel-wash-hoodie','Gravel Wash Hoodie','520 GSM fleece',6,'ITM-016','GWH','M','The hoodie put through a stone wash until the fleece gave up its shine.','Worn in before it reaches you, on purpose.','520 GSM stone-washed cotton fleece','Cold wash inside out. Expect it to soften further.',8600.00,NULL,'INR','Gravel','520 GSM','top-left',19,'men','core-uniform',0,'Published',NULL,15,'2026-08-17 12:34:18.030411','2026-08-18 07:10:40.153039',NULL),(22,'washed-crop-hoodie','Washed Crop Hoodie','520 GSM fleece',6,'ITM-017','WCH','M','The washed hoodie cut to the rib, with the sleeve length kept full.','Cropped without being made smaller anywhere else.','520 GSM stone-washed cotton fleece','Cold wash inside out. Dry flat.',8600.00,NULL,'INR','Gravel','520 GSM','top-left',20,'women','core-uniform',0,'Published',NULL,16,'2026-08-17 12:34:18.039830','2026-08-18 07:10:40.322924',NULL),(23,'monolith-hood','Monolith Hood','Oversized fleece',6,'ITM-018','MNH','XL','One panel front and back, no side seam, cut two sizes past your own.','The largest thing in the release, and the simplest.','600 GSM loopback cotton','Cold wash alone. Dry flat — it will hold water.',9600.00,NULL,'INR','Void','Oversized','top-left',21,'unisex','after-hours',0,'Published',NULL,17,'2026-08-17 12:34:18.050596','2026-08-18 07:10:40.461871',NULL),(24,'volume-cargo-02','Volume Cargo 02','Wide leg utility',7,'ITM-019','VC2','30','The cargo with the leg opened up and the rise brought back to the waist.','Volume from the hip down, nothing borrowed from the menswear block.','360 GSM washed cotton twill','Machine wash cold. Hang to dry.',9800.00,NULL,'INR','Charcoal','Wide leg','bottom-left',22,'women','drop-001',0,'Published',NULL,18,'2026-08-17 12:34:18.060440','2026-08-18 07:10:40.575277',NULL),(25,'ballast-cargo-pant','Ballast Cargo Pant','Wide leg twill',7,'ITM-020','BCP','34','A weighted cargo with a straight fall and pockets set low enough to load.','Named for what it does when the pockets are full.','400 GSM cotton twill','Machine wash cold. Wash with similar colours.',9200.00,NULL,'INR','Iron','Wide leg','bottom-left',23,'men','after-hours',0,'Published',NULL,19,'2026-08-17 12:34:18.072684','2026-08-18 07:10:40.727396',NULL),(26,'low-profile-cargo','Low Profile Cargo','Relaxed twill',7,'ITM-021','LPC','32','The cargo with its pockets flattened into the leg — utility you cannot see.','For the days the cargo should not announce itself.','340 GSM washed cotton twill','Machine wash cold. Hang to dry.',8800.00,9900.00,'INR','Charcoal','Relaxed','bottom-left',24,'men','core-uniform',0,'Published',NULL,20,'2026-08-17 12:34:18.086202','2026-08-18 07:10:40.899276',NULL),(27,'drape-cargo-pant','Drape Cargo Pant','Relaxed twill',7,'ITM-022','DCP','30','A softer twill cargo that falls rather than holds its shape.','The same pattern in a cloth that moves with you instead of around you.','300 GSM washed cotton twill','Machine wash cold. Hang to dry.',8800.00,9900.00,'INR','Charcoal','Relaxed','bottom-left',25,'women','core-uniform',0,'Published',NULL,21,'2026-08-17 12:34:18.094804','2026-08-18 07:10:41.026051',NULL),(28,'deadstock-wide-trouser','Deadstock Wide Trouser','Deadstock twill',7,'ITM-023','DWT','32','A full-leg trouser cut from a mill run that will not be woven again.','One roll of cloth, and this is all of it.','Deadstock 380 GSM cotton twill','Cold wash. Hang to dry. No tumble.',9400.00,NULL,'INR','Bone','Twill','bottom-left',26,'women','after-hours',0,'Published',NULL,22,'2026-08-17 12:34:18.106344','2026-08-18 07:10:41.140608',NULL),(29,'static-boxy-tee','Static Boxy Tee','Boxy jersey',8,'ITM-024','SBT','L','A square-cut tee with the shoulder seam pushed out past the joint.','The tee as a rectangle, with nothing tapered anywhere.','260 GSM cotton jersey','Cold wash. Reshape while damp.',4400.00,NULL,'INR','Static','Boxy','bottom-right',27,'men','core-uniform',0,'Published',NULL,23,'2026-08-17 12:34:18.121114','2026-08-18 07:10:41.359029',NULL),(30,'sculpt-boxy-tee','Sculpt Boxy Tee','Boxy jersey',8,'ITM-025','SCT','M','A boxy tee with a raised neck and a hem that finishes at the hip bone.','Square through the body, exact at the two edges that show.','260 GSM cotton jersey','Cold wash. Reshape while damp.',4400.00,NULL,'INR','Static','Boxy','bottom-right',28,'women','core-uniform',0,'Published',NULL,24,'2026-08-17 12:34:18.135322','2026-08-18 07:10:41.680161',NULL),(31,'uniform-long-sleeve','Uniform Long Sleeve','Core jersey',8,'ITM-026','ULS','M','The heavy tee with the sleeve run to the wrist and a cuff that holds.','The layer the whole uniform is built on top of.','280 GSM compact cotton jersey','Cold wash. Dry flat.',5200.00,NULL,'INR','Ink','Core','bottom-right',29,'unisex','core-uniform',0,'Published',NULL,25,'2026-08-17 12:34:18.147379','2026-08-18 07:10:42.837244',NULL),(32,'vault-carry-pouch','Vault Carry Pouch','Hardware canvas',4,'ITM-027','VCP','OS','A flat pouch with a machined zip pull and a webbing loop that takes a belt.','Sized for a phone, a key and nothing you would have to explain.','600D canvas with anodised hardware','Wipe clean. Do not submerge.',3800.00,NULL,'INR','Void','Hardware','bottom-right',30,'men','drop-001',0,'Published',NULL,26,'2026-08-17 12:34:18.158056','2026-08-18 07:10:43.159831',NULL),(33,'vault-clutch','Vault Clutch','Hardware canvas',4,'ITM-028','VCL','OS','The pouch on a longer axis, with the loop replaced by a wrist strap.','The same object, carried a different way.','600D canvas with anodised hardware','Wipe clean. Do not submerge.',3800.00,NULL,'INR','Void','Hardware','bottom-right',31,'women','drop-001',0,'Published',NULL,27,'2026-08-17 12:34:18.162590','2026-08-18 07:10:43.489924',NULL),(34,'chain-link-set','Chain Link Set','Steel hardware',4,'ITM-029','CLS','OS','Three linked lengths in brushed steel, worn together or apart.','The hardware off the garments, made wearable on its own.','Brushed 316L stainless steel','Polish with a dry cloth. Remove before water.',2600.00,NULL,'INR','Steel','Metal','bottom-right',32,'men','after-hours',0,'Published',NULL,28,'2026-08-17 12:34:18.167175','2026-08-18 07:10:43.764245',NULL),(35,'link-chain-belt','Link Chain Belt','Steel hardware',4,'ITM-030','LCB','OS','The chain set run to belt length, closing on a machined hook.','Long enough to sit on the hip, heavy enough to stay there.','Brushed 316L stainless steel','Polish with a dry cloth. Remove before water.',2600.00,NULL,'INR','Steel','Metal','bottom-right',33,'women','after-hours',0,'Published',NULL,29,'2026-08-17 12:34:18.171098','2026-08-18 07:10:44.040517',NULL),(36,'signal-boot','Signal Boot','Leather footwear',4,'ITM-031','SGB','9','A six-eyelet boot on a lugged wedge, built on a wide last.','The one thing in the release designed to outlast the release.','Full-grain leather on a rubber wedge, Blake stitched','Condition twice a year. Dry away from heat.',15400.00,NULL,'INR','Void','Footwear','bottom-left',34,'unisex','after-hours',0,'Published',NULL,30,'2026-08-17 12:34:18.174877','2026-08-18 07:10:44.281328',NULL),(37,'drop-001-flat-lay','Drop 001 Flat Lay','Set of three',4,'ITM-032','D1F','OS','The hoodie, the overshirt and the cargo, boxed together at a set price.','The three anchors of Drop 001, in the arrangement they were shot in.','See each piece','See each piece',21500.00,24800.00,'INR','Mixed','Set of 3','bottom-right',35,'unisex','drop-001',0,'Published',NULL,31,'2026-08-17 12:34:18.190358','2026-08-18 07:10:45.267194',NULL),(38,'console-test-piece','Console Test Piece','Tops',8,'ITM-004','CTP','XXL','Created entirely from the console, with a category, a description and a photo.',NULL,'','',6400.00,NULL,'INR','',NULL,'top-left',3,'unisex','core-uniform',0,'Published',NULL,0,'2026-08-17 12:45:12.164353','2026-08-17 12:45:12.442911','2026-08-17 12:45:12.442642'),(39,'audience-test-coat','Renamed Coat','Outerwear',1,'ITM-033','ATC','M','',NULL,'','',12000.00,NULL,'INR','',NULL,'top-left',NULL,'men','drop-001',0,'Published',NULL,0,'2026-08-18 07:43:24.934465','2026-08-18 07:43:54.851387','2026-08-18 07:43:54.851045'),(40,'abc','abc','Outerwear',1,'ITM-006','ABC','S','',NULL,'','',5000.00,NULL,'INR','',NULL,'top-left',NULL,'men','drop-001',0,'Published',NULL,0,'2026-08-19 06:24:33.875849','2026-08-19 06:24:33.876382',NULL),(43,'demo-product','demo product','Outerwear',1,'ITM-034','DMP','30','',NULL,'','',5000.00,NULL,'INR','',NULL,'top-left',43,'unisex','',0,'Published','Apparel · 12%',0,'2026-08-19 07:59:19.551537','2026-08-21 08:12:42.366436',NULL);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;

--
-- Table structure for table `refunds`
--

DROP TABLE IF EXISTS `refunds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `refunds` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `payment_id` bigint(20) unsigned NOT NULL,
  `order_number` varchar(40) NOT NULL DEFAULT '',
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'INR',
  `reason` varchar(40) NOT NULL DEFAULT 'Goodwill',
  `status` varchar(16) NOT NULL DEFAULT 'Requested',
  `gateway_refund_id` varchar(120) DEFAULT NULL,
  `requested_by` bigint(20) unsigned DEFAULT NULL,
  `approved_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_refunds_public_id` (`public_id`),
  KEY `ix_refunds_payment` (`payment_id`),
  KEY `ix_refunds_status` (`status`),
  KEY `fk_refunds_requested_by` (`requested_by`),
  KEY `fk_refunds_approved_by` (`approved_by`),
  CONSTRAINT `fk_refunds_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_refunds_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_refunds_requested_by` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refunds`
--

/*!40000 ALTER TABLE `refunds` DISABLE KEYS */;
/*!40000 ALTER TABLE `refunds` ENABLE KEYS */;

--
-- Table structure for table `return_requests`
--

DROP TABLE IF EXISTS `return_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `return_requests` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `order_number` varchar(40) NOT NULL DEFAULT '',
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `customer_name` varchar(120) NOT NULL DEFAULT '',
  `item_label` varchar(160) NOT NULL DEFAULT '',
  `order_item_id` bigint(20) unsigned DEFAULT NULL,
  `reason` varchar(40) NOT NULL,
  `outcome` varchar(16) NOT NULL DEFAULT 'Voucher',
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'INR',
  `replacement_product_id` bigint(20) unsigned DEFAULT NULL,
  `replacement_label` varchar(160) NOT NULL DEFAULT '',
  `state` varchar(24) NOT NULL DEFAULT 'New',
  `customer_status` varchar(32) NOT NULL DEFAULT 'Pickup scheduled',
  `destination` varchar(120) NOT NULL DEFAULT '',
  `reference` varchar(60) NOT NULL DEFAULT '',
  `pickup_slot` varchar(80) NOT NULL DEFAULT '',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_return_requests_public_id` (`public_id`),
  KEY `ix_return_requests_state` (`state`),
  KEY `ix_return_requests_user` (`user_id`,`created_at`),
  KEY `ix_return_requests_order` (`order_number`),
  KEY `fk_return_requests_order_item` (`order_item_id`),
  KEY `fk_return_requests_replacement` (`replacement_product_id`),
  CONSTRAINT `fk_return_requests_order_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_return_requests_replacement` FOREIGN KEY (`replacement_product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_return_requests_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `return_requests`
--

/*!40000 ALTER TABLE `return_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `return_requests` ENABLE KEYS */;

--
-- Table structure for table `return_status_history`
--

DROP TABLE IF EXISTS `return_status_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `return_status_history` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `return_id` bigint(20) unsigned NOT NULL,
  `from_state` varchar(24) NOT NULL DEFAULT '',
  `to_state` varchar(24) NOT NULL,
  `actor_id` bigint(20) unsigned DEFAULT NULL,
  `note` varchar(255) NOT NULL DEFAULT '',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_return_status_history_return` (`return_id`,`created_at`),
  KEY `fk_return_status_history_actor` (`actor_id`),
  CONSTRAINT `fk_return_status_history_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_return_status_history_return` FOREIGN KEY (`return_id`) REFERENCES `return_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `return_status_history`
--

/*!40000 ALTER TABLE `return_status_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `return_status_history` ENABLE KEYS */;

--
-- Table structure for table `review_moderation_history`
--

DROP TABLE IF EXISTS `review_moderation_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `review_moderation_history` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `review_id` bigint(20) unsigned NOT NULL,
  `from_status` varchar(16) NOT NULL DEFAULT '',
  `to_status` varchar(16) NOT NULL,
  `actor_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_review_moderation_review` (`review_id`,`created_at`),
  KEY `fk_review_moderation_actor` (`actor_id`),
  CONSTRAINT `fk_review_moderation_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_review_moderation_review` FOREIGN KEY (`review_id`) REFERENCES `reviews` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `review_moderation_history`
--

/*!40000 ALTER TABLE `review_moderation_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `review_moderation_history` ENABLE KEYS */;

--
-- Table structure for table `reviews`
--

DROP TABLE IF EXISTS `reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `reviews` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `product_name` varchar(160) NOT NULL DEFAULT '',
  `product_id` bigint(20) unsigned DEFAULT NULL,
  `rating` tinyint(3) unsigned NOT NULL,
  `customer_name` varchar(120) NOT NULL DEFAULT '',
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `headline` varchar(160) NOT NULL DEFAULT '',
  `body` text DEFAULT NULL,
  `fit` varchar(40) DEFAULT NULL,
  `submitted_label` varchar(40) NOT NULL DEFAULT '',
  `status` varchar(16) NOT NULL DEFAULT 'Published',
  `origin` varchar(16) NOT NULL DEFAULT 'Customer',
  `order_number` varchar(40) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `order_product_key` varchar(120) GENERATED ALWAYS AS (if(`order_number` is not null and `product_id` is not null,concat(`order_number`,'#',`product_id`),NULL)) STORED,
  `customer_product_key` varchar(120) GENERATED ALWAYS AS (if(`user_id` is not null and `product_id` is not null,concat(`user_id`,'#',`product_id`),NULL)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reviews_public_id` (`public_id`),
  UNIQUE KEY `uq_reviews_order_product` (`order_product_key`),
  UNIQUE KEY `uq_reviews_customer_product` (`customer_product_key`),
  KEY `ix_reviews_status` (`status`,`created_at`),
  KEY `ix_reviews_product` (`product_id`,`status`),
  KEY `fk_reviews_user` (`user_id`),
  CONSTRAINT `fk_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reviews_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reviews`
--

/*!40000 ALTER TABLE `reviews` DISABLE KEYS */;
INSERT INTO `reviews` (`id`, `public_id`, `product_name`, `product_id`, `rating`, `customer_name`, `user_id`, `headline`, `body`, `fit`, `submitted_label`, `status`, `origin`, `order_number`, `created_at`, `updated_at`, `order_product_key`, `customer_product_key`) VALUES (36,'REV-2001','demo product',43,4,'Tirth',2,'best','fegtef asvaerg vaergfv vergaer',NULL,'19 Aug 2026','Published','Customer',NULL,'2026-08-19 12:36:51.073076','2026-08-19 12:36:51.073797',NULL,'2#43');
/*!40000 ALTER TABLE `reviews` ENABLE KEYS */;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `role_permissions` (
  `role_id` int(10) unsigned NOT NULL,
  `permission_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `ix_role_permissions_permission` (`permission_id`),
  CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--

/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES (1,28),(2,1),(2,2),(2,3),(2,4),(2,5),(2,6),(2,7),(2,8),(2,9),(2,10),(2,11),(2,12),(2,13),(2,14),(2,15),(2,16),(2,18),(2,20),(2,21),(2,22),(2,23),(2,24),(2,27),(2,55),(3,1),(3,2),(3,4),(3,12),(3,15),(3,20),(3,22),(3,23),(4,1),(4,2),(4,4),(4,5),(4,9),(4,10),(4,11),(4,12);
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `roles` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(32) NOT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` (`id`, `code`, `is_system`) VALUES (1,'ADMIN',1),(2,'MANAGER',1),(3,'SUPPORT',1),(4,'WAREHOUSE',1);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;

--
-- Table structure for table `schema_migrations`
--

DROP TABLE IF EXISTS `schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `schema_migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `filename` varchar(191) NOT NULL,
  `checksum` char(64) NOT NULL,
  `statements` int(10) unsigned NOT NULL DEFAULT 0,
  `applied_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_schema_migrations_filename` (`filename`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schema_migrations`
--

/*!40000 ALTER TABLE `schema_migrations` DISABLE KEYS */;
INSERT INTO `schema_migrations` (`id`, `filename`, `checksum`, `statements`, `applied_at`) VALUES (1,'0001_platform_identity.sql','afbd2a7ffd802fc5f0ac0c56f84430e07ecb27e871a3e2c078d6bed5fd45528e',11,'2026-08-17 09:49:51.561275'),(2,'0002_catalog.sql','5bb261f08185d986c282290c398571acc09779bed3da20b128169c625d856050',8,'2026-08-17 09:49:51.712904'),(3,'0003_inventory.sql','a09060a2cf126ab975e482bcb561d5cfc500f6baadce0e2fa85e6d81bd6d6c1c',8,'2026-08-17 09:49:51.965757'),(4,'0004_cart_coupons_vouchers.sql','16c3d1e04b08b57903bd689bff97b8b68e2a0f9cdfe7bb4820862ae38ca3a50e',6,'2026-08-17 09:49:52.104329'),(5,'0005_orders_payments.sql','96e321780b744fc9e3e7e9506a3b371dc88ba9bb230a6e8759110f713a7ea5ba',12,'2026-08-17 09:49:52.456426'),(6,'0006_shipping_tracking.sql','4791f7a80c3aaa6553dccfd06dff7cf259213fdeeb04ab0c5058d74647f54127',5,'2026-08-17 09:49:52.579816'),(7,'0007_returns_reviews_support.sql','09ddb5756cbb20390060db0760e2e4c38843e1fa8df1b0e4ebdcea7f8e2186b2',7,'2026-08-17 09:49:52.751127'),(8,'0008_cms_settings_platform.sql','472522f08112fa51e0e0fa9aefc1129e34fd72e9f7beec66145a15eade902eea',11,'2026-08-17 09:49:53.090180'),(9,'0009_analytics_dashboard.sql','7196bc239f873acf88ce2802207c8d5e5f8c9f72f119e0d9b6afbb4fe2c56f10',3,'2026-08-17 09:49:53.139381'),(10,'0010_views.sql','590bede9a4b3a60d70694066f6eb5d1810a640a7ee176efe28ebf078ebc220a8',3,'2026-08-17 09:49:53.175415'),(11,'0011_catalog_console_fields.sql','7e1ab64d473f3fde014d59e3563bbeba66c708c574f5615ccbb07b8b43311b74',2,'2026-08-17 09:49:53.259487'),(12,'0012_orders_optional_account.sql','5f2bac4ab5aaafa05d5ad499484f62bab6a16b7cb9e145d8fa1e2298ef4eb1a9',3,'2026-08-17 09:49:53.355452'),(13,'0013_vocabularies_out_of_the_schema.sql','2ab5a5d73eb51b098b0cbd6cf55c879bb66812aa14a31c991094dcb1b7c4a107',6,'2026-08-17 09:49:53.379165'),(14,'0014_item_photos.sql','69eb924f84309ac6ef7a13990f8d00b682738b24738997c80dce96c54e466707',4,'2026-08-17 09:49:53.468368'),(15,'0015_unbounded_id_pools.sql','17b0e8b7786d8779245cfc88e787e9fb31c72ad043302c5a4d43ceb3df5f946c',1,'2026-08-17 10:07:14.969620'),(16,'0016_product_photos.sql','5b2748b7cc3e1d93eacb2bdde6f1034b0d9b99f36008f2e522051de3882ad3fa',2,'2026-08-17 12:27:51.485426'),(17,'0017_accessory_category.sql','16b82c41a1006a15bc4238df066e82593c933f8d54ad87f4186ad22d9d5d26b3',1,'2026-08-17 12:34:17.537619'),(18,'0018_retire_stale_catalogue_rows.sql','0603be66600b61267572816773ef6b0b357ce75f66f6b45544aac0a2549241c2',2,'2026-08-17 12:46:38.189814'),(19,'0019_stock_item_audience.sql','7efeab447b7d7d8f365b29b0738ad363316964706abef56752448b69d6411375',3,'2026-08-18 07:40:37.125131'),(20,'0020_item_price_and_gallery.sql','8c4323c035f2bb2e853f71ee77dd3849fa34fce7ba759e54823619d8f090304c',3,'2026-08-19 07:37:58.655206'),(21,'0021_one_review_per_customer.sql','96cc5e8786d8d1506cd67511252b6c82bf20aede3e208af533ff5e8f54d0785b',2,'2026-08-19 10:45:49.139284'),(22,'0022_reviews_publish_on_arrival.sql','2eeb9f0bde4b80cc441a79d859e9bae6334a118ed57fd5a7a547dc83b53f1dc4',5,'2026-08-19 11:52:01.380259'),(23,'0023_home_hero_slides.sql','05c600d8b6bf0f7889d44db9074796ac3490d95553e4a9a5a47c57b2a73ac086',1,'2026-08-21 06:32:38.075948'),(24,'0024_hero_slides_from_products.sql','b12577f00fd5260634cb4953d3ff5075151185c727bf82bc7d18591a1bade8dc',2,'2026-08-21 07:27:14.324833'),(25,'0025_hero_cutout_edge.sql','1b9ead39d14bf52e441d0cfd6bc35242630853707d466e1379ae36afef83111e',1,'2026-08-21 07:40:43.379347'),(26,'0026_wallet.sql','179102b93abbc3e2aa21ed24e943cf1c5889d75c4d2399703688ed42dcae2c29',4,'2026-08-24 08:03:12.952902'),(27,'0027_return_status_credited.sql','cce53b34e3a6523f1d9ce14330287d2447236fbd3ac6efdfbfbaf35d3b566610',2,'2026-08-24 08:15:57.238922'),(28,'0028_crm_core.sql','0d24d252d8537578d310d1e75540cf344c970c939d5c8b1495e8df9780e5e191',10,'2026-08-25 13:31:08.243396'),(29,'0029_raw_materials.sql','74a4bbf2a79d32dd388153d2dd4664fbeb65162044cfe00fa3e177ec5dcd9263',8,'2026-08-27 10:06:10.101244');
/*!40000 ALTER TABLE `schema_migrations` ENABLE KEYS */;

--
-- Table structure for table `search_queries`
--

DROP TABLE IF EXISTS `search_queries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `search_queries` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `q` varchar(190) NOT NULL,
  `results` int(10) unsigned NOT NULL DEFAULT 0,
  `session_kind` varchar(16) NOT NULL DEFAULT 'guest',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_search_queries_q` (`q`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `search_queries`
--

/*!40000 ALTER TABLE `search_queries` DISABLE KEYS */;
/*!40000 ALTER TABLE `search_queries` ENABLE KEYS */;

--
-- Table structure for table `shipment_events`
--

DROP TABLE IF EXISTS `shipment_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `shipment_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `shipment_id` bigint(20) unsigned NOT NULL,
  `label` varchar(80) NOT NULL,
  `detail` varchar(255) NOT NULL DEFAULT '',
  `time_label` varchar(40) NOT NULL DEFAULT '',
  `is_complete` tinyint(1) NOT NULL DEFAULT 0,
  `position` int(11) NOT NULL DEFAULT 0,
  `source` varchar(16) NOT NULL DEFAULT 'internal',
  `external_ref` varchar(120) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_shipment_events_shipment` (`shipment_id`,`position`),
  CONSTRAINT `fk_shipment_events_shipment` FOREIGN KEY (`shipment_id`) REFERENCES `shipments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shipment_events`
--

/*!40000 ALTER TABLE `shipment_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `shipment_events` ENABLE KEYS */;

--
-- Table structure for table `shipment_labels`
--

DROP TABLE IF EXISTS `shipment_labels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `shipment_labels` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `shipment_id` bigint(20) unsigned NOT NULL,
  `media_id` bigint(20) unsigned DEFAULT NULL,
  `printed_count` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_shipment_labels_shipment` (`shipment_id`),
  KEY `fk_shipment_labels_media` (`media_id`),
  CONSTRAINT `fk_shipment_labels_media` FOREIGN KEY (`media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_shipment_labels_shipment` FOREIGN KEY (`shipment_id`) REFERENCES `shipments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shipment_labels`
--

/*!40000 ALTER TABLE `shipment_labels` DISABLE KEYS */;
/*!40000 ALTER TABLE `shipment_labels` ENABLE KEYS */;

--
-- Table structure for table `shipments`
--

DROP TABLE IF EXISTS `shipments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `shipments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `order_id` bigint(20) unsigned NOT NULL,
  `order_number` varchar(40) NOT NULL DEFAULT '',
  `provider` varchar(40) NOT NULL DEFAULT '',
  `awb` varchar(60) NOT NULL DEFAULT '',
  `destination` varchar(120) NOT NULL DEFAULT '',
  `dispatched_label` varchar(40) NOT NULL DEFAULT '',
  `promise_label` varchar(40) NOT NULL DEFAULT '',
  `status` varchar(16) NOT NULL DEFAULT 'Dispatched',
  `fail_reason` varchar(120) DEFAULT NULL,
  `handling` varchar(24) DEFAULT NULL,
  `tracking_token` varchar(40) NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_shipments_public_id` (`public_id`),
  UNIQUE KEY `uq_shipments_token` (`tracking_token`),
  KEY `ix_shipments_order` (`order_id`),
  KEY `ix_shipments_status` (`status`),
  CONSTRAINT `fk_shipments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shipments`
--

/*!40000 ALTER TABLE `shipments` DISABLE KEYS */;
/*!40000 ALTER TABLE `shipments` ENABLE KEYS */;

--
-- Table structure for table `staff_activity_logs`
--

DROP TABLE IF EXISTS `staff_activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `staff_activity_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `staff_user_id` bigint(20) unsigned NOT NULL,
  `action` varchar(120) NOT NULL,
  `resource` varchar(120) NOT NULL DEFAULT '',
  `result` varchar(16) NOT NULL DEFAULT 'Completed',
  `where_label` varchar(80) NOT NULL DEFAULT '',
  `request_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_staff_activity_user` (`staff_user_id`,`created_at`),
  CONSTRAINT `fk_staff_activity_user` FOREIGN KEY (`staff_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `staff_activity_logs`
--

/*!40000 ALTER TABLE `staff_activity_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `staff_activity_logs` ENABLE KEYS */;

--
-- Table structure for table `stock_item_photos`
--

DROP TABLE IF EXISTS `stock_item_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `stock_item_photos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `stock_item_id` bigint(20) unsigned NOT NULL,
  `media_id` bigint(20) unsigned NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stock_item_photos_asset` (`stock_item_id`,`media_id`),
  KEY `ix_stock_item_photos_order` (`stock_item_id`,`position`),
  KEY `fk_stock_item_photos_media` (`media_id`),
  CONSTRAINT `fk_stock_item_photos_item` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_stock_item_photos_media` FOREIGN KEY (`media_id`) REFERENCES `media_assets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_item_photos`
--

/*!40000 ALTER TABLE `stock_item_photos` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_item_photos` ENABLE KEYS */;

--
-- Table structure for table `stock_items`
--

DROP TABLE IF EXISTS `stock_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `stock_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `item_name` varchar(160) NOT NULL,
  `category` varchar(16) NOT NULL DEFAULT 'Top',
  `audience` varchar(16) NOT NULL DEFAULT 'unisex',
  `item_type` varchar(80) NOT NULL DEFAULT '',
  `sizes_csv` varchar(120) NOT NULL DEFAULT '',
  `price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `image_media_id` bigint(20) unsigned DEFAULT NULL,
  `warehouse_id` bigint(20) unsigned NOT NULL,
  `total_units` int(10) unsigned NOT NULL DEFAULT 0,
  `reserved_units` int(10) unsigned NOT NULL DEFAULT 0,
  `version` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stock_items_public_id` (`public_id`),
  KEY `ix_stock_items_warehouse` (`warehouse_id`),
  KEY `fk_stock_items_image` (`image_media_id`),
  CONSTRAINT `fk_stock_items_image` FOREIGN KEY (`image_media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_stock_items_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=75 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_items`
--

/*!40000 ALTER TABLE `stock_items` DISABLE KEYS */;
INSERT INTO `stock_items` (`id`, `public_id`, `item_name`, `category`, `audience`, `item_type`, `sizes_csv`, `price`, `image_media_id`, `warehouse_id`, `total_units`, `reserved_units`, `version`, `created_at`, `updated_at`, `deleted_at`) VALUES (1,'ITM-001','Afterdark Hoodie','Top','unisex','Hoodie','S, M, L, XL',8900.00,4,1,84,0,4,'2026-08-17 09:49:53.664246','2026-08-27 13:20:57.674464',NULL),(2,'ITM-002','Bone Utility Overshirt','Top','unisex','Overshirt','S, M, L, XL',11400.00,5,1,26,0,0,'2026-08-17 09:49:53.664422','2026-08-19 07:37:58.605443',NULL),(3,'ITM-003','Shadow Cargo 02','Bottom','unisex','Cargo','30, 32, 34, 36',9800.00,6,2,34,0,0,'2026-08-17 09:49:53.664571','2026-08-19 07:37:58.605443',NULL),(4,'ITM-004','Core Heavy Tee','Top','unisex','T-shirt','S, M, L, XL, XXL',4600.00,7,1,120,0,0,'2026-08-17 09:49:53.664710','2026-08-19 07:37:58.605443',NULL),(5,'ITM-005','Midnight Denim','Bottom','men','Jeans','30, 32, 34, 36',7800.00,8,3,22,0,0,'2026-08-17 09:49:53.664845','2026-08-19 07:37:58.605443',NULL),(6,'ITM-006','abc','Top','men','Jacket','S, M, L, XL, XXL',5000.00,2,2,14,0,4,'2026-08-17 12:22:04.672960','2026-08-19 07:37:58.605443',NULL),(13,'ITM-007','Bone Long Coat','Top','women','Jacket','S, M, L, XL',19800.00,10,1,11,0,0,'2026-08-17 12:34:17.710442','2026-08-19 07:37:58.605443',NULL),(14,'ITM-008','Bone Field Jacket','Top','men','Jacket','S, M, L, XL',13900.00,11,2,8,0,0,'2026-08-17 12:34:17.710918','2026-08-19 07:37:58.605443',NULL),(15,'ITM-009','Ivory Work Jacket','Top','women','Jacket','S, M, L, XL',13900.00,12,2,12,0,0,'2026-08-17 12:34:17.712070','2026-08-19 07:37:58.605443',NULL),(16,'ITM-010','Underpass Shell','Top','unisex','Jacket','S, M, L, XL',16200.00,13,1,19,0,0,'2026-08-17 12:34:17.712997','2026-08-19 07:37:58.605443',NULL),(17,'ITM-011','Collar Study Overshirt','Top','men','Overshirt','S, M, L, XL',11800.00,14,1,16,0,0,'2026-08-17 12:34:17.713707','2026-08-19 07:37:58.605443',NULL),(18,'ITM-012','Collar Study Shirt','Top','women','Shirt','S, M, L, XL',11800.00,15,1,15,0,0,'2026-08-17 12:34:17.714588','2026-08-19 07:37:58.605443',NULL),(19,'ITM-013','Freight Overshirt','Top','unisex','Overshirt','S, M, L, XL, XXL',12400.00,16,3,24,0,0,'2026-08-17 12:34:17.715347','2026-08-19 07:37:58.605443',NULL),(20,'ITM-014','Concrete Zip Hood','Top','men','Hoodie','S, M, L, XL',10400.00,17,1,31,0,0,'2026-08-17 12:34:17.716117','2026-08-19 07:37:58.605443',NULL),(21,'ITM-015','Structured Zip Hood','Top','women','Hoodie','S, M, L, XL',10400.00,18,1,28,0,0,'2026-08-17 12:34:17.717260','2026-08-19 07:37:58.605443',NULL),(22,'ITM-016','Gravel Wash Hoodie','Top','men','Hoodie','S, M, L, XL',8600.00,19,2,37,0,0,'2026-08-17 12:34:17.718005','2026-08-19 07:37:58.605443',NULL),(23,'ITM-017','Washed Crop Hoodie','Top','women','Hoodie','S, M, L, XL',8600.00,20,2,33,0,0,'2026-08-17 12:34:17.718436','2026-08-19 07:37:58.605443',NULL),(24,'ITM-018','Monolith Hood','Top','unisex','Hoodie','S, M, L, XL, XXL',9600.00,21,3,21,0,0,'2026-08-17 12:34:17.718786','2026-08-19 07:37:58.605443',NULL),(25,'ITM-019','Volume Cargo 02','Bottom','women','Cargo','30, 32, 34, 36',9800.00,22,2,29,0,0,'2026-08-17 12:34:17.719123','2026-08-19 07:37:58.605443',NULL),(26,'ITM-020','Ballast Cargo Pant','Bottom','men','Cargo','30, 32, 34, 36, 38',9200.00,23,2,26,0,0,'2026-08-17 12:34:17.719454','2026-08-19 07:37:58.605443',NULL),(27,'ITM-021','Low Profile Cargo','Bottom','men','Cargo','30, 32, 34, 36',8800.00,24,1,30,0,0,'2026-08-17 12:34:17.719782','2026-08-19 07:37:58.605443',NULL),(28,'ITM-022','Drape Cargo Pant','Bottom','women','Cargo','30, 32, 34, 36',8800.00,25,1,27,0,0,'2026-08-17 12:34:17.720107','2026-08-19 07:37:58.605443',NULL),(29,'ITM-023','Deadstock Wide Trouser','Bottom','women','Casual','30, 32, 34, 36',9400.00,26,3,17,0,0,'2026-08-17 12:34:17.720431','2026-08-19 07:37:58.605443',NULL),(30,'ITM-024','Static Boxy Tee','Top','men','T-shirt','S, M, L, XL, XXL',4400.00,27,1,84,0,0,'2026-08-17 12:34:17.720756','2026-08-19 07:37:58.605443',NULL),(31,'ITM-025','Sculpt Boxy Tee','Top','women','T-shirt','S, M, L, XL, XXL',4400.00,28,1,78,0,0,'2026-08-17 12:34:17.721081','2026-08-19 07:37:58.605443',NULL),(32,'ITM-026','Uniform Long Sleeve','Top','unisex','T-shirt','S, M, L, XL, XXL',5200.00,29,2,62,0,0,'2026-08-17 12:34:17.721405','2026-08-19 07:37:58.605443',NULL),(33,'ITM-027','Vault Carry Pouch','Accessory','men','Bag','OS',3800.00,30,3,45,0,0,'2026-08-17 12:34:17.721730','2026-08-19 07:37:58.605443',NULL),(34,'ITM-028','Vault Clutch','Accessory','women','Bag','OS',3800.00,31,3,41,0,0,'2026-08-17 12:34:17.722055','2026-08-19 07:37:58.605443',NULL),(35,'ITM-029','Chain Link Set','Accessory','men','Jewellery','OS',2600.00,32,1,58,0,0,'2026-08-17 12:34:17.722380','2026-08-19 07:37:58.605443',NULL),(36,'ITM-030','Link Chain Belt','Accessory','women','Jewellery','OS',2600.00,33,1,52,0,0,'2026-08-17 12:34:17.722706','2026-08-19 07:37:58.605443',NULL),(37,'ITM-031','Signal Boot','Accessory','unisex','Footwear','7, 8, 9, 10, 11',15400.00,34,2,23,0,0,'2026-08-17 12:34:17.723034','2026-08-19 07:37:58.605443',NULL),(38,'ITM-032','Drop 001 Flat Lay','Accessory','unisex','Bundle','OS',21500.00,35,1,9,0,0,'2026-08-17 12:34:17.723363','2026-08-19 07:37:58.605443',NULL),(71,'ITM-033','Renamed Coat','Top','men','Jacket','S, M, L',0.00,NULL,1,9,0,0,'2026-08-18 07:43:24.753939','2026-08-18 07:43:55.049197','2026-08-18 07:43:55.048871'),(74,'ITM-034','demo product','Bottom','unisex','Jeans','30, 32, 34, 36',5000.00,43,1,20,0,3,'2026-08-19 07:59:19.414080','2026-08-21 08:12:42.393854',NULL);
/*!40000 ALTER TABLE `stock_items` ENABLE KEYS */;

--
-- Table structure for table `store_settings`
--

DROP TABLE IF EXISTS `store_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `store_settings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `key` varchar(120) NOT NULL,
  `value_json` mediumtext DEFAULT NULL,
  `version` int(10) unsigned NOT NULL DEFAULT 1,
  `updated_by` bigint(20) unsigned DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_store_settings_key` (`key`),
  KEY `fk_store_settings_actor` (`updated_by`),
  CONSTRAINT `fk_store_settings_actor` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `store_settings`
--

/*!40000 ALTER TABLE `store_settings` DISABLE KEYS */;
INSERT INTO `store_settings` (`id`, `key`, `value_json`, `version`, `updated_by`, `updated_at`) VALUES (1,'delivery','{\"standard_fee\":199,\"express_fee\":499,\"free_over\":4999,\"standard_window\":[3,5],\"express_window\":[1,2]}',1,NULL,'2026-08-19 10:27:46.525387'),(2,'cod','{\"max\":5000,\"fee\":0,\"waive_over\":null}',1,NULL,'2026-08-17 09:49:53.495736'),(3,'inventory','{\"low_stock_at\": 4, \"reservation_ttl_prepaid\": 900, \"reservation_ttl_cod\": 600, \"max_per_order\": 3, \"categories\": [\"Top\", \"Bottom\", \"Accessory\"], \"sizes_by_category\": {\"Top\": [\"S\", \"M\", \"L\", \"XL\", \"XXL\"], \"Bottom\": [\"30\", \"32\", \"34\", \"36\", \"38\", \"40\", \"42\"], \"Accessory\": [\"OS\", \"7\", \"8\", \"9\", \"10\", \"11\", \"12\"]}, \"types_by_category\": {\"Top\": [\"T-shirt\", \"Shirt\", \"Hoodie\", \"Overshirt\", \"Jacket\"], \"Bottom\": [\"Jeans\", \"Cargo\", \"Casual\", \"Joggers\", \"Shorts\"], \"Accessory\": [\"Bag\", \"Jewellery\", \"Footwear\", \"Headwear\", \"Bundle\"]}}',2,NULL,'2026-08-17 12:34:17.532106'),(4,'shipping','{\"providers\":[\"Blue Dart\",\"Delhivery\",\"Ecom Express\"],\"fail_reasons\":[\"Nobody was home\",\"Address was wrong\",\"Customer said no\",\"Could not reach the customer\",\"Not shared yet\"],\"max_delivery_attempts\":3,\"handling_states\":[\"Needs action\",\"Sending back\",\"Back in store\"]}',1,NULL,'2026-08-17 09:49:53.497441'),(5,'returns','{\"reasons\":[\"Size / fit\",\"Changed mind\",\"Quality concern\",\"Wrong item\",\"Damaged in transit\"],\"outcomes\":[\"Voucher\",\"Exchange\"],\"window_days\":14}',1,NULL,'2026-08-17 09:49:53.497677'),(6,'payments','{\"gateways\":[\"Razorpay\",\"Stripe\",\"Cashfree\",\"On device\",\"Courier\"],\"refund_reasons\":[\"Return approved\",\"Order cancelled\",\"Payment mismatch\",\"Goodwill\"],\"methods\":[\"UPI\",\"Card\",\"Netbanking\",\"Cash on delivery\"]}',1,NULL,'2026-08-17 09:49:53.497908'),(7,'catalog','{\"product_states\":[\"Published\",\"Scheduled\",\"Draft\"],\"collection_states\":[\"Live\",\"Scheduled\",\"Draft\"],\"variant_states\":[\"Active\",\"Low\",\"Out\",\"Archived\"]}',1,NULL,'2026-08-17 09:49:53.498137'),(8,'media','{\"max_bytes_console\":8388608,\"max_bytes_customer\":5242880,\"max_bytes_staff_photo\":2097152,\"allowed_mime\":[\"image/jpeg\",\"image/png\",\"image/webp\"],\"max_edge\":1600,\"quality\":82}',1,NULL,'2026-08-17 09:49:53.498365'),(9,'security','{\"login_lockout_after\":5,\"login_lockout_window\":900,\"idempotency_ttl_hours\":48}',1,NULL,'2026-08-17 09:49:53.498688'),(10,'sessions','{\"customer_ttl\":2592000,\"staff_idle_ttl\":900}',1,NULL,'2026-08-17 09:49:53.498915'),(11,'id_pools','{\"order\": {\"prefix\": \"ord-\", \"width\": 4, \"from\": 1001}, \"tracking\": {\"prefix\": \"trk-\", \"width\": 6, \"from\": 100001}, \"payment\": {\"prefix\": \"pay_ICE\", \"width\": 4, \"from\": 2001}, \"customer\": {\"prefix\": \"cus-\", \"width\": 4, \"from\": 2050}}',2,NULL,'2026-08-17 10:07:14.960758'),(12,'id_series','{\"shipment\":{\"prefix\":\"shp-\",\"width\":0,\"from\":1051},\"pickup\":{\"prefix\":\"PICK-\",\"width\":4,\"from\":413},\"review\":{\"prefix\":\"REV-\",\"width\":0,\"from\":2001},\"support\":{\"prefix\":\"IO-Q-\",\"width\":0,\"from\":1004},\"return\":{\"prefix\":\"ret-\",\"width\":3,\"from\":1},\"refund\":{\"prefix\":\"ref_ICE\",\"width\":3,\"from\":1},\"stock_item\":{\"prefix\":\"ITM-\",\"width\":3,\"from\":1},\"transfer\":{\"prefix\":\"TRF-\",\"width\":3,\"from\":1},\"voucher\":{\"prefix\":\"IOV\",\"width\":3,\"from\":1}}',1,NULL,'2026-08-17 09:49:53.499369'),(13,'order_number','{\"prefix\":\"IO-2026-\",\"next_serial\":1049}',1,NULL,'2026-08-17 09:49:53.499598'),(14,'support','{\"topics\":[\"Delivery\",\"Return or exchange\",\"Payment or refund\",\"Product and fit\",\"Something else\"],\"no_order_label\":\"No order\",\"slas\":{\"first_response_hours\":24,\"resolution_hours\":72}}',1,NULL,'2026-08-17 09:49:53.499824'),(15,'business','{\"name\":\"Iced_out\",\"support_email\":\"help@iced-out.example\",\"gstin\":\"\",\"tax_rates\":[]}',1,NULL,'2026-08-17 09:49:53.500051');
/*!40000 ALTER TABLE `store_settings` ENABLE KEYS */;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `suppliers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(16) NOT NULL,
  `name` varchar(160) NOT NULL,
  `name_normalized` varchar(160) NOT NULL,
  `contact_name` varchar(120) NOT NULL DEFAULT '',
  `email` varchar(190) NOT NULL DEFAULT '',
  `phone` varchar(20) NOT NULL DEFAULT '',
  `city` varchar(80) NOT NULL DEFAULT '',
  `country` varchar(80) NOT NULL DEFAULT 'India',
  `lead_time_days` smallint(5) unsigned NOT NULL DEFAULT 0,
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE',
  `notes` text DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_suppliers_public_id` (`public_id`),
  KEY `ix_suppliers_name` (`name_normalized`),
  KEY `ix_suppliers_status` (`status`,`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
INSERT INTO `suppliers` (`id`, `public_id`, `name`, `name_normalized`, `contact_name`, `email`, `phone`, `city`, `country`, `lead_time_days`, `status`, `notes`, `created_at`, `updated_at`, `deleted_at`) VALUES (2,'sup-01','Kanchi Mills','kanchi mills','S. Raman','orders@kanchimills.example','','Coimbatore','India',21,'ACTIVE','','2026-08-27 10:28:02.199925','2026-08-27 10:28:02.199953',NULL),(3,'sup-02','Northline Trims','northline trims','A. Bose','hello@northlinetrims.example','','Ludhiana','India',7,'ACTIVE','','2026-08-27 10:28:02.203596','2026-08-27 10:28:02.203607',NULL);
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;

--
-- Table structure for table `support_queries`
--

DROP TABLE IF EXISTS `support_queries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `support_queries` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `customer_name` varchar(120) NOT NULL DEFAULT '',
  `email` varchar(190) NOT NULL DEFAULT '',
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `topic` varchar(40) NOT NULL,
  `order_number` varchar(40) NOT NULL DEFAULT 'No order',
  `message` text NOT NULL,
  `sent_label` varchar(60) NOT NULL DEFAULT '',
  `status` varchar(16) NOT NULL DEFAULT 'Open',
  `reply` text NOT NULL,
  `resolved_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_support_queries_public_id` (`public_id`),
  KEY `ix_support_queries_status` (`status`,`created_at`),
  KEY `ix_support_queries_user` (`user_id`),
  KEY `fk_support_queries_resolver` (`resolved_by`),
  CONSTRAINT `fk_support_queries_resolver` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_support_queries_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_queries`
--

/*!40000 ALTER TABLE `support_queries` DISABLE KEYS */;
INSERT INTO `support_queries` (`id`, `public_id`, `customer_name`, `email`, `user_id`, `topic`, `order_number`, `message`, `sent_label`, `status`, `reply`, `resolved_by`, `created_at`, `updated_at`) VALUES (1,'IO-Q-1004','Tirth','tirth@gmail.com',2,'Delivery','IO-2026-1049','kjfkjafne ve vn SKLJDFN VE KWJDN V WJHGKJERBGER KSJDBVEFBVER','17 Aug 2026 · 17:45','Resolved','adfgehtjyku.lkj,hmhn efwtrhyu 6u76y',1,'2026-08-17 12:15:27.136660','2026-08-19 14:34:58.306537'),(2,'IO-Q-1005','Tirth','tirth@gmail.com',2,'Delivery','','sfwrgtrgrdvaefvegvfrwrefbvwerfvrefvdadwrg534refcd','19 Aug 2026 · 20:04','Resolved','dfvtrb fg45g wf4c5red',1,'2026-08-19 14:34:22.568751','2026-08-19 14:34:48.517572');
/*!40000 ALTER TABLE `support_queries` ENABLE KEYS */;

--
-- Table structure for table `support_status_history`
--

DROP TABLE IF EXISTS `support_status_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `support_status_history` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `query_id` bigint(20) unsigned NOT NULL,
  `from_status` varchar(16) NOT NULL DEFAULT '',
  `to_status` varchar(16) NOT NULL,
  `actor_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `ix_support_status_history_query` (`query_id`,`created_at`),
  KEY `fk_support_status_history_actor` (`actor_id`),
  CONSTRAINT `fk_support_status_history_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_support_status_history_query` FOREIGN KEY (`query_id`) REFERENCES `support_queries` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_status_history`
--

/*!40000 ALTER TABLE `support_status_history` DISABLE KEYS */;
INSERT INTO `support_status_history` (`id`, `query_id`, `from_status`, `to_status`, `actor_id`, `created_at`) VALUES (1,2,'Open','Resolved',1,'2026-08-19 14:34:48.523391'),(2,1,'Open','Resolved',1,'2026-08-19 14:34:58.309224');
/*!40000 ALTER TABLE `support_status_history` ENABLE KEYS */;

--
-- Table structure for table `trading_days`
--

DROP TABLE IF EXISTS `trading_days`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `trading_days` (
  `day` date NOT NULL,
  `revenue` decimal(14,2) NOT NULL DEFAULT 0.00,
  `orders` int(10) unsigned NOT NULL DEFAULT 0,
  `sessions` int(10) unsigned NOT NULL DEFAULT 0,
  `returns` int(10) unsigned NOT NULL DEFAULT 0,
  `refreshed_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trading_days`
--

/*!40000 ALTER TABLE `trading_days` DISABLE KEYS */;
/*!40000 ALTER TABLE `trading_days` ENABLE KEYS */;

--
-- Table structure for table `user_addresses`
--

DROP TABLE IF EXISTS `user_addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_addresses` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `label` varchar(40) NOT NULL DEFAULT '',
  `name` varchar(120) NOT NULL,
  `street` varchar(255) NOT NULL,
  `city` varchar(80) NOT NULL,
  `state` varchar(80) NOT NULL,
  `pincode` char(6) NOT NULL,
  `phone` varchar(20) NOT NULL DEFAULT '',
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `position` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_addresses_public_id` (`public_id`),
  KEY `ix_addresses_user` (`user_id`,`deleted_at`),
  CONSTRAINT `fk_addresses_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_addresses`
--

/*!40000 ALTER TABLE `user_addresses` DISABLE KEYS */;
INSERT INTO `user_addresses` (`id`, `public_id`, `user_id`, `label`, `name`, `street`, `city`, `state`, `pincode`, `phone`, `is_default`, `position`, `created_at`, `updated_at`, `deleted_at`) VALUES (1,'addr-4a64c27ca263',2,'Home','Tirth','c-5-66 G.I.D.C Collony Pandesara','Surat','Gujarat','394221','9876543209',1,0,'2026-08-17 09:56:50.032706','2026-08-19 12:42:31.117512',NULL);
/*!40000 ALTER TABLE `user_addresses` ENABLE KEYS */;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_roles` (
  `user_id` bigint(20) unsigned NOT NULL,
  `role_id` int(10) unsigned NOT NULL,
  `granted_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`user_id`,`role_id`),
  KEY `ix_user_roles_role` (`role_id`),
  KEY `fk_user_roles_granted_by` (`granted_by`),
  CONSTRAINT `fk_user_roles_granted_by` FOREIGN KEY (`granted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` (`user_id`, `role_id`, `granted_by`, `created_at`) VALUES (1,1,NULL,'2026-08-17 09:49:53.659721');
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;

--
-- Table structure for table `user_sessions`
--

DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_sessions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `audience` varchar(16) NOT NULL,
  `token_hash` binary(32) NOT NULL,
  `ip` varbinary(16) DEFAULT NULL,
  `user_agent` varchar(255) NOT NULL DEFAULT '',
  `last_active_at` datetime(6) NOT NULL,
  `idle_expires_at` datetime(6) DEFAULT NULL,
  `absolute_expires_at` datetime(6) DEFAULT NULL,
  `revoked_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sessions_token` (`token_hash`),
  KEY `ix_sessions_user` (`user_id`,`audience`,`revoked_at`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=144 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_sessions`
--

/*!40000 ALTER TABLE `user_sessions` DISABLE KEYS */;
INSERT INTO `user_sessions` (`id`, `user_id`, `audience`, `token_hash`, `ip`, `user_agent`, `last_active_at`, `idle_expires_at`, `absolute_expires_at`, `revoked_at`, `created_at`) VALUES (1,2,'customer',0xA2E66E906B2FADD202755628D8B4250F3185CA6F688C9710631BC5EDC5B5D96F,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-17 09:55:57.002605',NULL,'2026-09-16 09:55:57.000841','2026-08-25 07:14:03.994923','2026-08-17 09:55:57.002608'),(3,1,'staff',0xF4DA67B262D3834CD6BEA543E7D91DE5AE4483BF413FEFF619D57CA8079442BC,0x7F000001,'curl/8.18.0','2026-08-17 10:08:57.827451','2026-08-17 10:23:57.827434','2026-08-17 22:08:57.264453',NULL,'2026-08-17 10:08:57.264510'),(4,1,'staff',0x64E5E11909932F9439941F70DF965AFA703A1C43850F6A99E2594F6B1E776E2E,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-17 11:48:41.292180','2026-08-17 12:03:41.292166','2026-08-17 23:45:26.625842',NULL,'2026-08-17 11:45:26.625909'),(5,1,'staff',0x907CE715B32C16AB37E383ECDADCAD85956F7364425F38AE10D6373EB18B0E41,0x7F000001,'curl/8.18.0','2026-08-17 11:51:58.723916','2026-08-17 12:06:58.723897','2026-08-17 23:51:58.282747',NULL,'2026-08-17 11:51:58.282822'),(6,1,'staff',0x44B3A7EFFFF6041E4418572E5651B6AB6D52738104D83CCA985A61CEBD7616D5,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-17 12:23:23.981113','2026-08-17 12:38:23.981099','2026-08-18 00:15:38.772318',NULL,'2026-08-17 12:15:38.772422'),(7,1,'staff',0x92BD653C91F5A1709259FC958B3D4EB3C3E502600D6482C56AC27F0AC63DC772,0x7F000001,'curl/8.18.0','2026-08-17 12:45:12.434644','2026-08-17 13:00:12.434626','2026-08-18 00:44:21.454284',NULL,'2026-08-17 12:44:21.454382'),(8,1,'staff',0x32781A39E1BB58E9E3A690D83FCD99EC7E8162B23D37D94351AC08A31FEEF831,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-18 07:11:37.674975','2026-08-18 07:26:37.674945','2026-08-18 19:05:29.918639',NULL,'2026-08-18 07:05:29.920442'),(9,1,'staff',0x25092AC74B60DA2CD7062911FD537FB7D4F41B178E74633DB259B57082718F82,0x7F000001,'curl/8.18.0','2026-08-18 07:19:26.028924','2026-08-18 07:34:26.028890','2026-08-18 19:11:17.630458',NULL,'2026-08-18 07:11:17.630589'),(10,1,'staff',0x93F2A4081189B5C89D784695F6F9F75348F566EB880FBA0A86C1CF42B98E3909,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-18 08:05:35.026675','2026-08-18 08:20:35.026637','2026-08-18 19:27:40.516373',NULL,'2026-08-18 07:27:40.516495'),(11,1,'staff',0x2A7B2536917ECC08CE170C2FC0F1A29CF2BAC6F1B725E93169CE898C40BC5A0E,0x7F000001,'curl/8.18.0','2026-08-18 07:45:18.152062','2026-08-18 08:00:18.152043','2026-08-18 19:43:24.626071',NULL,'2026-08-18 07:43:24.626122'),(12,1,'staff',0xDA33FF5FDA703AA3230E921A0CBF928856720FFF3EF61BB1B2B4B964FD3DD885,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-18 08:26:04.070571','2026-08-18 08:41:04.070514','2026-08-18 20:24:08.042992',NULL,'2026-08-18 08:24:08.043109'),(13,1,'staff',0x1B2D6F1DD69F7A12D319C86D329D95309BA6A9C3A0530575ABF796C448E33768,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-19 07:09:26.513712','2026-08-19 07:24:26.513685','2026-08-19 18:19:16.228717',NULL,'2026-08-19 06:19:16.229427'),(14,1,'staff',0xF40445D398B3DBE2CCA94A32BB82D50E5D79F2C0C7BDC9D973EE8AA58817D420,0x7F000001,'curl/8.18.0','2026-08-19 06:42:43.882193','2026-08-19 06:57:43.882178','2026-08-19 18:42:43.356355',NULL,'2026-08-19 06:42:43.356472'),(15,1,'staff',0xF5B399D2474C6116F1A481F57E8BD7819A35A1DCCFBFC33B38C31F0648534903,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-19 08:04:35.894986','2026-08-19 08:19:35.894970','2026-08-19 19:51:21.139916',NULL,'2026-08-19 07:51:21.140538'),(16,1,'staff',0x33A04DD4D359D19AEF5C44176C0BC7BB4354BAC3EFB8C63A75437F0C3009F784,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36','2026-08-19 08:27:14.932733','2026-08-19 08:42:14.932719','2026-08-19 20:27:10.564701',NULL,'2026-08-19 08:27:10.564763'),(17,1,'staff',0xD759DDDE11A0C49F93B8C35CC3DC8B2142677A156FF33903833E6983C8CB3D8D,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36','2026-08-19 08:28:16.571582','2026-08-19 08:43:16.571568','2026-08-19 20:28:12.121283',NULL,'2026-08-19 08:28:12.121351'),(18,1,'staff',0xE0DFA038FEB5048B861CDBC7F25EBC0BB667A02E3A68CC76621AB1141ED301B7,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36','2026-08-19 08:29:18.179568','2026-08-19 08:44:18.179557','2026-08-19 20:29:13.742653',NULL,'2026-08-19 08:29:13.742698'),(19,1,'staff',0x99EB0AAC6DDCC7FA9334ECBEF5A1D6C9AA7953F9C8B03F2B47C6B517B438765D,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36','2026-08-19 08:33:09.326494','2026-08-19 08:48:09.326481','2026-08-19 20:33:04.883310',NULL,'2026-08-19 08:33:04.883353'),(20,1,'staff',0xB0D57FD1F689040F8EFD7A09E74B5DF417A17D185A57E78C85F00B6BE5EC91EC,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36','2026-08-19 08:44:52.686841','2026-08-19 08:59:52.686826','2026-08-19 20:44:37.109077',NULL,'2026-08-19 08:44:37.109137'),(21,1,'staff',0x41EA6A2FDF9A6557D43CABEA2F5E936FAC67BB48FC2007F090742D3BE25513AF,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-19 09:21:34.994925','2026-08-19 09:36:34.994905','2026-08-19 21:21:32.933452',NULL,'2026-08-19 09:21:32.933537'),(22,1,'staff',0x0541090CD89F7B6BA846486DEBB59719928715C75C320428B96B65E93928159D,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-19 09:58:33.655887','2026-08-19 10:13:33.655865','2026-08-19 21:41:50.938450',NULL,'2026-08-19 09:41:50.938532'),(23,1,'staff',0xEA7D2CF616927A42E9005E1F0086C4436F268D7A71A6C192C389842E474FE2F3,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36','2026-08-19 11:00:37.420668','2026-08-19 11:15:37.420653','2026-08-19 23:00:31.931799',NULL,'2026-08-19 11:00:31.931847'),(31,1,'staff',0x24B9BF8CE2B22A514C17CB53E1D179193E0CBAA475DB36E3BD5F690FB5256C1F,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-19 11:50:04.354993','2026-08-19 12:05:04.354956','2026-08-19 23:47:12.828190',NULL,'2026-08-19 11:47:12.828303'),(33,1,'staff',0xE54C1BB765F905355AE3C62650DD0974EFDEA13A4848825AFFB4B64839B6B3E3,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36','2026-08-19 12:03:31.785923','2026-08-19 12:18:31.785905','2026-08-20 00:03:22.827813',NULL,'2026-08-19 12:03:22.827926'),(34,1,'staff',0xB4E75E86959D134E1559704B8FA2FA689BCE9A8C1409D61759BA4090346F493D,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36','2026-08-19 12:04:26.415027','2026-08-19 12:19:26.415006','2026-08-20 00:04:13.161174',NULL,'2026-08-19 12:04:13.161315'),(35,1,'staff',0x51BEC03B73664E8E642A4C8C53AB33BCA4B1FA5AFCD5E066D14CE1AF8D60CEDE,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-19 12:36:18.129300','2026-08-19 12:51:18.129278','2026-08-20 00:36:08.134913',NULL,'2026-08-19 12:36:08.134995'),(36,1,'staff',0x4378BFE965F5ED3FECF9913B60BEA4D86B8A572D36CCAAD80C9F2EB495845899,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-19 14:35:13.834333','2026-08-19 14:50:13.834301','2026-08-20 02:34:28.828312',NULL,'2026-08-19 14:34:28.828362'),(37,1,'staff',0x53DD982E0B96D0F0586165C1098A1288B0A73357579585401388EA1118E70C46,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-19 15:11:14.823371','2026-08-19 15:26:14.823347','2026-08-20 03:06:59.240452',NULL,'2026-08-19 15:06:59.240517'),(39,1,'staff',0x4A1970559765AA8ED4F0BF2E356C6E2AF572B9C49B551CD8714A2B7BF8E2FAF7,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36','2026-08-20 06:05:37.357001','2026-08-20 06:20:37.356982','2026-08-20 18:05:28.715833',NULL,'2026-08-20 06:05:28.715967'),(40,1,'staff',0x15BF387600AD745CD0FA2BCFD112D9EB6BE646117D5B2BD10F5F0AD8013D1410,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36','2026-08-20 06:06:48.369869','2026-08-20 06:21:48.369851','2026-08-20 18:06:42.049000',NULL,'2026-08-20 06:06:42.049092'),(41,1,'staff',0xF8AA4A2E39C2DD9D6D250B9B713B2E2C1F993E6D2B46CE3AD12A046A4C5FB6AC,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36','2026-08-20 06:08:07.127099','2026-08-20 06:23:07.127059','2026-08-20 18:07:55.250885',NULL,'2026-08-20 06:07:55.250946'),(44,1,'staff',0xFB8B0011E9DBEC9A959F2236F9BA888F3078B95B3F66C06E50E6E71E46FA6C28,0x7F000001,'curl/8.18.0','2026-08-21 07:01:50.697383','2026-08-21 07:16:50.697373','2026-08-21 18:41:04.564335',NULL,'2026-08-21 06:41:04.565241'),(45,1,'staff',0x799907EC722E4C41A957AE90D965614DDD4170995D0DDB73C0DD043BF0D4137C,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36','2026-08-21 06:53:11.919518','2026-08-21 07:08:11.919498','2026-08-21 18:53:10.156672',NULL,'2026-08-21 06:53:10.156748'),(46,1,'staff',0x8AA8E170A88ABD67DE5E345D819BC6364436ED627D90FE5862A15FD53B1B637C,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36','2026-08-21 06:55:09.349817','2026-08-21 07:10:09.349796','2026-08-21 18:55:08.250028',NULL,'2026-08-21 06:55:08.250155'),(47,1,'staff',0xFDDEF8966FE8346091047410B2E94FA6D5E056716832E2B7580C4D0967F076AE,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-21 07:36:21.847650','2026-08-21 07:51:21.847613','2026-08-21 19:13:04.900315',NULL,'2026-08-21 07:13:04.900396'),(48,1,'staff',0x072D8ABE2C04F005D5BF68E785725A87B0CC34241C434BCAD48249F484533D6F,0x7F000001,'curl/8.18.0','2026-08-21 07:43:24.801637','2026-08-21 07:58:24.801623','2026-08-21 19:30:32.604045',NULL,'2026-08-21 07:30:32.604161'),(49,1,'staff',0xB3F4C5582A3568E90370A62600A30E3E5A137A89B793B409F0BF8E62365E3055,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36','2026-08-21 07:37:44.447646','2026-08-21 07:52:44.447629','2026-08-21 19:37:35.958385',NULL,'2026-08-21 07:37:35.958448'),(50,1,'staff',0x88BC17EE4E57E32C4120E78B041DA68E05B9E171E4AACD0B7FCAC7DBCBA665CF,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36','2026-08-21 07:42:23.182751','2026-08-21 07:57:23.182715','2026-08-21 19:42:21.641145',NULL,'2026-08-21 07:42:21.641197'),(51,1,'staff',0xA8753BB40F57FAC01084154E970E9281DF09FA6A964CE4B1FB512DF34110CD21,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-21 08:15:10.468359','2026-08-21 08:30:10.468330','2026-08-21 20:08:11.925123',NULL,'2026-08-21 08:08:11.925210'),(52,1,'staff',0x9CC98BDF90A2A8FEDC4E14BAB78880D8819FC33C7614F5B0E6A564D1405FE3FE,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-21 09:05:46.604206','2026-08-21 09:20:46.604187','2026-08-21 20:53:12.765292','2026-08-21 09:05:46.621762','2026-08-21 08:53:12.765344'),(53,1,'staff',0x41E164701DDF6C3DD04121D1EF74420C13FE39CB2BF405C1EBA1A0D0D12AF8F8,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-24 06:58:02.742279','2026-08-24 07:13:02.742247','2026-08-24 18:57:55.912602',NULL,'2026-08-24 06:57:55.912715'),(54,16,'customer',0x695935499927886BB5FBBA59937C8F7C719FEB5419D88F0239B25C2BB490C0A8,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36','2026-08-24 07:11:23.780526',NULL,'2026-09-23 07:11:23.776931',NULL,'2026-08-24 07:11:23.780528'),(55,17,'customer',0x4D023F079D44DE63E26CF9C744DE288869D1D08C98AE1DBFBFB9FF26F26AA30E,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36','2026-08-24 07:11:34.723706',NULL,'2026-09-23 07:11:34.723015',NULL,'2026-08-24 07:11:34.723707'),(56,18,'customer',0x7F81C7DBBBF7AE226AF09F8833B42732E2F7895DB4E627D27B30A344B6A1AC6F,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36','2026-08-24 07:11:52.242967',NULL,'2026-09-23 07:11:52.239150',NULL,'2026-08-24 07:11:52.242970'),(57,19,'customer',0x85824538B5CB0AC5D6DAD7D4A254D1C08272620CAB2024165C0B5175027A0220,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36','2026-08-24 07:12:25.969747',NULL,'2026-09-23 07:12:25.969257',NULL,'2026-08-24 07:12:25.969749'),(58,20,'customer',0x10FBB662502C54B688BF6D0C523F6593D139E3A57E81B64014EF10B0E9EB250E,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36','2026-08-24 07:13:06.766706',NULL,'2026-09-23 07:13:06.764355',NULL,'2026-08-24 07:13:06.766707'),(59,21,'customer',0x7DA70CF48657E5CCC1E743626DF45B290E01ED58D8893C58F11AB44E5D7AFC17,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36','2026-08-24 07:13:38.223109',NULL,'2026-09-23 07:13:38.217457',NULL,'2026-08-24 07:13:38.223112'),(60,22,'customer',0x99716058336D1239494405A22C43C0208621738880E2E3A4D5FF03E4E6884E9B,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36','2026-08-24 07:14:36.973580',NULL,'2026-09-23 07:14:36.969815',NULL,'2026-08-24 07:14:36.973581'),(61,23,'customer',0x5D030DEFDC18875A02EEFD18EE9A2D919793574B8B80A139AA20CDD856881650,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36','2026-08-24 07:15:11.417682',NULL,'2026-09-23 07:15:11.417134',NULL,'2026-08-24 07:15:11.417683'),(62,24,'customer',0xD7BD1834F8A108B15B0BE18FC67A06C4274778A35292847B46AA63C0544BF78A,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36','2026-08-24 07:15:30.157982',NULL,'2026-09-23 07:15:30.156520',NULL,'2026-08-24 07:15:30.157986'),(63,25,'customer',0xB59B655765EDE1E95FB8269D5D58F4B07AD70F05C53B11172E4F3410B276006C,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36','2026-08-24 07:16:36.399579',NULL,'2026-09-23 07:16:36.395423',NULL,'2026-08-24 07:16:36.399581'),(64,26,'customer',0x196E790B10F18F9E2E1A47D87E9AE43F7C9E768480F2F550032A173D4C3BA7B8,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36','2026-08-24 07:16:57.626586',NULL,'2026-09-23 07:16:57.624821',NULL,'2026-08-24 07:16:57.626592'),(65,1,'staff',0x8703D350D0571ED5D253AFE87B8153A6B340936F24B18AA8B016DC3AA3231F18,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-24 07:41:45.578986','2026-08-24 07:56:45.578970','2026-08-24 19:39:17.796211',NULL,'2026-08-24 07:39:17.796265'),(68,1,'staff',0x6CED5C9414821067FAB88FCCC9C5CAF2C6E6206859256626CB4BF508DCE44211,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-25 07:13:43.859788','2026-08-25 07:28:43.859750','2026-08-25 18:33:41.472702',NULL,'2026-08-25 06:33:41.473522'),(69,1,'staff',0xAEFDBF08B35DBDDA4B54A04E5A0F82D5946F8BC3CF7B4DF9CFC2119E45BA7108,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.205 Safari/537.36','2026-08-25 06:46:41.692093','2026-08-25 07:01:41.692078','2026-08-25 18:41:12.217073',NULL,'2026-08-25 06:41:12.217134'),(70,28,'customer',0xE62BF23DCAAAB5AFF105F2BC1FDD8977559B63D2430106B923709289CE145F6A,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-25 07:15:27.677451',NULL,'2026-09-24 07:15:27.676502',NULL,'2026-08-25 07:15:27.677454'),(73,28,'customer',0x98CA6852410B50536DAACAF1A9884ECE959941695C90A320BACB041EE70E9463,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-25 09:59:52.396763',NULL,'2026-09-24 09:59:52.395894',NULL,'2026-08-25 09:59:52.396772'),(74,1,'staff',0xD7AB6682D8D90EA3D0F42F7224D9C570F5E8314A3B59B57CD2E0F65991683645,0x7F000001,'','2026-08-25 13:34:54.709967','2026-08-25 13:49:54.709944','2026-08-26 01:34:54.319020',NULL,'2026-08-25 13:34:54.319098'),(75,1,'staff',0x528DD19C1A36DD6B54858AAEC39FD4492E34BCDFB16D15D9EB5F5A7E3C90BA69,0x7F000001,'','2026-08-25 13:36:07.272883','2026-08-25 13:51:07.272872','2026-08-26 01:36:06.946455',NULL,'2026-08-25 13:36:06.946553'),(76,1,'staff',0x998E61514CC055F66AAB2604ED78CAD888AFCEF9F6833905C68D71805E322CBF,0x7F000001,'curl/8.18.0','2026-08-25 14:10:41.016395','2026-08-25 14:25:41.016377','2026-08-26 02:10:22.793077',NULL,'2026-08-25 14:10:22.793131'),(77,1,'staff',0x43CA011B23F8F261D8803E688ECAF3ECDFB0E36313A7C3AE08E4ED29F259C32D,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.205 Safari/537.36','2026-08-25 14:18:43.538478','2026-08-25 14:33:43.538464','2026-08-26 02:12:33.112614',NULL,'2026-08-25 14:12:33.112658'),(78,1,'staff',0x5E1147428D9CE0189F8BF0D4DC9FBE84F8D814BB8D96819354427ED5B571C36E,0x7F000001,'','2026-08-25 14:26:44.216908','2026-08-25 14:41:44.216897','2026-08-26 02:26:43.920624',NULL,'2026-08-25 14:26:43.920699'),(79,1,'staff',0xC0C6A646BBEC88A35E2C867EBEC352D87EAAFABF6F2E8B72C8CE5E862BE3FF03,0x7F000001,'','2026-08-25 14:26:51.488868','2026-08-25 14:41:51.488859','2026-08-26 02:26:51.218010',NULL,'2026-08-25 14:26:51.218061'),(80,1,'staff',0xCCBB36A6DCE2F4FFCE275BC106173487C2A7C1A3DF4173527C33EB8B98FA457D,0x7F000001,'','2026-08-25 14:27:07.316133','2026-08-25 14:42:07.316124','2026-08-26 02:27:06.995921',NULL,'2026-08-25 14:27:06.995976'),(81,1,'staff',0x98F1428FE38600478DD8B64C17946AFB625CD9443756B9840694D640C5F545BD,0x7F000001,'','2026-08-25 14:27:23.348475','2026-08-25 14:42:23.348462','2026-08-26 02:27:23.074018',NULL,'2026-08-25 14:27:23.074106'),(82,1,'staff',0x1688E3AE3D360B7D3AB02C3B0BCC6085E97FEB7669FBC5E21BF99983A330216F,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-25 14:39:31.843319','2026-08-25 14:54:31.843296','2026-08-26 02:38:05.655827',NULL,'2026-08-25 14:38:05.655879'),(83,1,'staff',0x9DE2C5500C3FC6E4D5F4EC1BF4B651C22E73388F33094090D8DB898572E50482,0x7F000001,'curl/8.18.0','2026-08-25 14:46:09.788788','2026-08-25 15:01:09.788760','2026-08-26 02:46:09.669489',NULL,'2026-08-25 14:46:09.669577'),(84,1,'staff',0x1020B61BBEE262AEA32A495FA525889D9F1184C84BB1CBEBA89E9111B2ADDB76,0x7F000001,'','2026-08-25 14:49:19.237589','2026-08-25 15:04:19.237565','2026-08-26 02:49:18.664464',NULL,'2026-08-25 14:49:18.664518'),(87,1,'staff',0x6D24165E1C8F35287D513FC571F19EA0D0740BCB9D4B121C34A1A9A6E90B1102,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.205 Safari/537.36','2026-08-25 14:55:30.198490','2026-08-25 15:10:30.198477','2026-08-26 02:51:57.088850',NULL,'2026-08-25 14:51:57.088894'),(89,1,'staff',0x573E5A504E570951ACE454C989FD0A004119760B11B3EFEB2D07982ADF2C9506,0x7F000001,'','2026-08-25 15:01:58.419554','2026-08-25 15:16:58.419544','2026-08-26 03:01:57.756227',NULL,'2026-08-25 15:01:57.756275'),(90,1,'staff',0xB851C6071D11B83FDB222035DD8E077449D87F2ADE2FD4B1C7F085FA1D4B596E,0x7F000001,'','2026-08-25 15:02:42.829202','2026-08-25 15:17:42.829190','2026-08-26 03:02:42.226986',NULL,'2026-08-25 15:02:42.227041'),(94,1,'staff',0x2540025E82149FC6614B1900CAA013AC6254548A1752A6BD25AA703E092B265C,0x7F000001,'','2026-08-25 15:04:34.752397','2026-08-25 15:19:34.752386','2026-08-26 03:04:34.184949',NULL,'2026-08-25 15:04:34.185015'),(95,1,'staff',0x5FFFC169C6D4462B16E939123206633294E107E58F5C35C90918FB90B253C38D,0x7F000001,'','2026-08-25 15:05:28.774146','2026-08-25 15:20:28.774134','2026-08-26 03:05:28.561554',NULL,'2026-08-25 15:05:28.561613'),(96,1,'staff',0xBFAC85B3AE159A31B1D1C95BE986D24E10F2C9C53A79D9CD967567298A1828F0,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-08-25 15:19:09.693813','2026-08-25 15:34:09.693765','2026-08-26 03:06:05.934788',NULL,'2026-08-25 15:06:05.934886'),(97,1,'staff',0x40269EB36798BAE2B31521B0CDC2FAC7B7EFA4C9AE0C97682DC79F43CEC6B9D1,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36','2026-08-27 06:13:29.203541','2026-08-27 06:28:29.203507','2026-08-27 18:12:35.894022',NULL,'2026-08-27 06:12:35.895132'),(98,1,'staff',0xD677367056E7AADDE57F09245D39EF476B1BEFC14423D26B7EF8A507801E8815,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36','2026-08-27 09:22:56.204816','2026-08-27 09:37:56.204799','2026-08-27 21:22:53.824594',NULL,'2026-08-27 09:22:53.824703'),(99,1,'staff',0x7484E36A5D8C9B05415FE5CCB7BF801473F479FA1FB4E602951C98FAC42C2AF9,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36','2026-08-27 09:42:07.305684','2026-08-27 09:57:07.305657','2026-08-27 21:42:07.299365',NULL,'2026-08-27 09:42:07.299422'),(100,1,'staff',0xD5702378DA76F90EC7493842B0CC64A2A096813520C077706C160F6286D06D3E,0x7F000001,'','2026-08-27 10:14:05.113805','2026-08-27 10:29:05.113784','2026-08-27 22:14:04.650918',NULL,'2026-08-27 10:14:04.651055'),(101,1,'staff',0xB76E24B147857F8A6D34A9133AB50C28B644F680B3AB7C7A87AFC55CC42923CD,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.205 Safari/537.36','2026-08-27 10:41:25.903282','2026-08-27 10:56:25.903248','2026-08-27 22:29:07.227937',NULL,'2026-08-27 10:29:07.227993'),(103,1,'staff',0xBD4857ECDDFF1FBA05080F51504A8B9747543EBDD480CAB61A3D94A8AA3000EB,0x7F000001,'','2026-08-27 10:32:00.942313','2026-08-27 10:47:00.942285','2026-08-27 22:31:59.790899',NULL,'2026-08-27 10:31:59.790975'),(105,1,'staff',0xEF5622FB67AB47DE748103D1E6972E6EA69A0B450AB31FB051394F82A32243ED,0x7F000001,'','2026-08-27 10:36:06.495890','2026-08-27 10:51:06.495862','2026-08-27 22:36:05.691936',NULL,'2026-08-27 10:36:05.692097'),(107,1,'staff',0x927B959E69D5FCE94AF2E9E37B990CA9D961FAB82C61546C64E0E546999F683E,0x7F000001,'','2026-08-27 10:38:00.181526','2026-08-27 10:53:00.181495','2026-08-27 22:37:59.335484',NULL,'2026-08-27 10:37:59.335598'),(109,1,'staff',0x67FE909A65F133D7E85523878385B94AF26E628189F9A5B6109E7DE9ED6E1FB2,0x7F000001,'','2026-08-27 10:41:40.120101','2026-08-27 10:56:40.120087','2026-08-27 22:41:39.381807',NULL,'2026-08-27 10:41:39.381880'),(111,1,'staff',0x11EE2A306CFCAF2123F13A90E2445575CD51A11E7A92365724D49F38C4809D7B,0x7F000001,'','2026-08-27 10:42:22.057147','2026-08-27 10:57:22.057136','2026-08-27 22:42:21.377222',NULL,'2026-08-27 10:42:21.377320'),(112,1,'staff',0xE7B2A301FA9A6AF620025E2F7B5834C9E647362E39DE9525C7A6D0FF3784A13F,0x7F000001,'','2026-08-27 10:42:51.969286','2026-08-27 10:57:51.969273','2026-08-27 22:42:51.714014',NULL,'2026-08-27 10:42:51.714085'),(113,1,'staff',0x37F5F1F90A8278E38E48B09DD11801D9F4CDBA41649B31D2F7EFE64792ABAAC1,0x7F000001,'','2026-08-27 10:42:52.672527','2026-08-27 10:57:52.672517','2026-08-27 22:42:52.399209',NULL,'2026-08-27 10:42:52.399267'),(114,1,'staff',0x32264D7921484DDF6C4DAD1A68A74FF64D60F8718041F0B4341B571C7C9C642A,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36','2026-08-27 13:06:05.696388','2026-08-27 13:21:05.696362','2026-08-28 00:38:01.910933',NULL,'2026-08-27 12:38:01.911058'),(115,1,'staff',0xF777BCDEF0EEBD3874163C25B1B7B116DE9BD3C88FBE43ADEE5A463166F49CB1,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.205 Safari/537.36','2026-08-27 13:25:46.057816','2026-08-27 13:40:46.057801','2026-08-28 00:50:27.416230',NULL,'2026-08-27 12:50:27.416310'),(117,1,'staff',0x61EFA4791120A7863DB2D48AD6A88A97565EE2BA5632EE613289158F8335DB8F,0x7F000001,'','2026-08-27 13:19:45.870518','2026-08-27 13:34:45.870498','2026-08-28 01:19:45.079082',NULL,'2026-08-27 13:19:45.079125'),(118,1,'staff',0x83071AB07BB7E46AC85F2067D9318248E959B0B3D6F5E5D5EDA3B98C97A30E1D,0x7F000001,'','2026-08-27 13:20:56.741593','2026-08-27 13:35:56.741584','2026-08-28 01:20:56.420560',NULL,'2026-08-27 13:20:56.420612'),(119,1,'staff',0x755D5D9311CBEE9AE9D50F39E9829762214FEB134B264F82404CA180AE8948E6,0x7F000001,'','2026-08-27 13:20:57.630238','2026-08-27 13:35:57.630226','2026-08-28 01:20:57.089001',NULL,'2026-08-27 13:20:57.089102'),(120,1,'staff',0x7CCB8C4C14EDA69C0565B96285744F85DADB8A1825D67987FF9AAAE5A80F7400,0x7F000001,'curl/8.18.0','2026-09-01 08:47:17.670394','2026-09-01 09:02:17.670379','2026-09-01 20:47:17.663236',NULL,'2026-09-01 08:47:17.663319'),(121,1,'staff',0x8E49DF47B3B5E71B1876AC272555A465EBFC2F8A6C02C8E1C865E131D21EC6D2,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36','2026-09-01 08:50:21.010554','2026-09-01 09:05:21.010536','2026-09-01 20:50:17.181749',NULL,'2026-09-01 08:50:17.181840'),(123,1,'staff',0x4C07A8AD4EDE84B434A7CD3B4456BE5E12C519E2525B2522ECB90B50324FE760,0x7F000001,'','2026-09-01 08:56:04.293513','2026-09-01 09:11:04.293500','2026-09-01 20:56:03.696070',NULL,'2026-09-01 08:56:03.696137'),(124,1,'staff',0xA1E8CB28091E43EDB6A2BF07D5CB4E9CF75480580F7E9178697782E2537FF1B9,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.205 Safari/537.36','2026-09-01 09:38:24.756227','2026-09-01 09:53:24.756211','2026-09-01 20:57:19.391362',NULL,'2026-09-01 08:57:19.391419'),(125,1,'staff',0xCA4E903B3CB13DAF99403797DF55B4A641187DDBB4C1F26C92A096B4F90432DB,0x7F000001,'curl/8.18.0','2026-09-01 09:16:47.441917','2026-09-01 09:31:47.441904','2026-09-01 21:09:38.643889',NULL,'2026-09-01 09:09:38.643936'),(127,1,'staff',0x16A39C14DFA27F14B0D69378FFF59E0AE1AF1F4D9C43ED3DC655085E41C51DAA,0x7F000001,'','2026-09-01 09:16:51.549576','2026-09-01 09:31:51.549561','2026-09-01 21:16:50.950834',NULL,'2026-09-01 09:16:50.950880'),(129,1,'staff',0xA6A137E7E6D4AF2960CB0E9CFDD871229B27BC0A38E505C690A7E615AF55585A,0x7F000001,'','2026-09-01 09:20:15.642652','2026-09-01 09:35:15.642640','2026-09-01 21:20:15.055700',NULL,'2026-09-01 09:20:15.055783'),(131,1,'staff',0x6B04D752F639DD26FE22A514D0977385710214642F97966F773912548CFA79C3,0x7F000001,'','2026-09-01 09:37:47.543411','2026-09-01 09:52:47.543400','2026-09-01 21:37:46.839236',NULL,'2026-09-01 09:37:46.839287'),(132,1,'staff',0x550AE388CCDC2098C701D379A03386CEC5DCB952D42CF976AD9B64BCB18A2F39,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36','2026-09-01 14:00:25.376732','2026-09-01 14:15:25.376695','2026-09-02 01:41:49.433077',NULL,'2026-09-01 13:41:49.433883'),(133,1,'staff',0x8DA1B7F178F14B4FC2D9852A1A8ECFCB1244A878F6C733F0BAC83E117BBBEDEF,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.205 Safari/537.36','2026-09-01 14:00:21.608139','2026-09-01 14:15:21.608056','2026-09-02 01:48:58.693867',NULL,'2026-09-01 13:48:58.693914'),(134,1,'staff',0xD2CB1AE6536AF3E91936C446BA4BCAE69039174F59207B3707393A9006A63B21,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36','2026-09-02 03:16:11.101785','2026-09-02 03:31:11.101741','2026-09-02 15:05:28.731114',NULL,'2026-09-02 03:05:28.731613'),(135,1,'staff',0x4BE8F2FAC71C8CFDED07BE7B4FD7E22817316BDBF6CCC8D730EC6AC0BC34F054,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36','2026-09-02 06:15:51.383351','2026-09-02 06:30:51.383325','2026-09-02 17:50:44.008192',NULL,'2026-09-02 05:50:44.009225'),(136,1,'staff',0xE136BD2555DF1DCD0399557863707D1F4CA2314C412BE6629F28F54509EB4DD5,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36','2026-09-02 06:15:59.710341','2026-09-02 06:30:59.710315','2026-09-02 18:15:52.872849',NULL,'2026-09-02 06:15:52.872909'),(137,1,'staff',0x62F4DA633655ECAFD5809F1EFF03326759EE7D1A8C97DE01EA112354E1D328DC,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36','2026-09-02 06:16:42.106036','2026-09-02 06:31:42.105998','2026-09-02 18:16:40.510991',NULL,'2026-09-02 06:16:40.511087'),(138,1,'staff',0x24BDDED5D2F2A1D35AD607436982BA4A9158F5FCD7970F3C340B4E3377D072D7,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36','2026-09-02 06:16:47.441704','2026-09-02 06:31:47.441670','2026-09-02 18:16:45.748799',NULL,'2026-09-02 06:16:45.748858'),(139,1,'staff',0x0D6F7733227D5E14E29CBB9DD7B03E2F6920504524017F8D2CA1DE27A75ED4D1,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36','2026-09-02 06:16:52.696046','2026-09-02 06:31:52.696016','2026-09-02 18:16:51.011922',NULL,'2026-09-02 06:16:51.011978'),(140,1,'staff',0xBAE291D19976B30E0B0A806B6D3818FCC38D0F318CD4DEB05D670773BE5518A7,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36','2026-09-02 06:17:44.695698','2026-09-02 06:32:44.695671','2026-09-02 18:17:41.359792',NULL,'2026-09-02 06:17:41.359853'),(141,1,'staff',0xAE28F7F7FE3B23F6193071D3C6C2973F277B7169C61550885531284FC415D99D,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36','2026-09-02 06:17:52.116841','2026-09-02 06:32:52.116812','2026-09-02 18:17:48.427621',NULL,'2026-09-02 06:17:48.427673'),(142,1,'staff',0xA60F0F9EEFBD249BAA8D8541AFC5F973D0F7D78549C6E8DAB1E8E18DC0C5709C,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36','2026-09-02 07:51:52.400946','2026-09-02 08:06:52.400927','2026-09-02 18:40:29.034900',NULL,'2026-09-02 06:40:29.034963'),(143,1,'staff',0xE50CDBE718401386C9727AC38936D427769AEC4E199C04E9219473FC2D4EE3E2,0x7F000001,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.205 Safari/537.36','2026-09-02 07:54:02.626505','2026-09-02 08:09:02.626475','2026-09-02 19:30:22.324448',NULL,'2026-09-02 07:30:22.324540');
/*!40000 ALTER TABLE `user_sessions` ENABLE KEYS */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(40) NOT NULL,
  `type` varchar(16) NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE',
  `name` varchar(120) NOT NULL,
  `email` varchar(190) NOT NULL,
  `email_normalized` varchar(190) NOT NULL,
  `phone` varchar(20) NOT NULL DEFAULT '',
  `password_hash` varchar(255) NOT NULL DEFAULT '',
  `photo_media_id` bigint(20) unsigned DEFAULT NULL,
  `last_seen_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_public_id` (`public_id`),
  UNIQUE KEY `uq_users_email_per_type` (`type`,`email_normalized`),
  KEY `ix_users_status` (`status`),
  KEY `ix_users_last_seen` (`last_seen_at`),
  KEY `fk_users_photo` (`photo_media_id`),
  CONSTRAINT `fk_users_photo` FOREIGN KEY (`photo_media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` (`id`, `public_id`, `type`, `status`, `name`, `email`, `email_normalized`, `phone`, `password_hash`, `photo_media_id`, `last_seen_at`, `created_at`, `updated_at`, `deleted_at`) VALUES (1,'stf-001','STAFF','ACTIVE','Aarav D.','admin@gmail.com','admin@gmail.com','','$argon2id$v=19$m=65536,t=4,p=1$VkZhWDBBN1VsMGdaU0Qxcw$sYF7Jh4ikPXB0XXDAq/grNsmTeo99nI0bGrsdq5Yr38',NULL,'2026-09-02 07:30:22.322035','2026-08-17 09:49:53.657839','2026-09-02 07:30:22.322742',NULL),(2,'cus-2050','CUSTOMER','ACTIVE','Tirth','tirth@gmail.com','tirth@gmail.com','9876543210','$argon2id$v=19$m=65536,t=4,p=1$VU9nRkNtY0t0bVFKYk1YNg$Npyu9g01++NT334VQlC/PDffaHaxxzhAZOu1rHNsq7s',NULL,'2026-08-17 09:55:56.996460','2026-08-17 09:55:56.996468','2026-08-17 11:45:09.096721',NULL),(16,'cus-2051','CUSTOMER','ACTIVE','Codex Scroll Test','codex-scroll-1787555481969@example.com','codex-scroll-1787555481969@example.com','','$argon2id$v=19$m=65536,t=4,p=1$dGduUGRseHdGWUVhenZqSQ$p4/6KROO6qcfUvpVb43JSuTHJd5yvKyFjGZMPBwiKhc',NULL,'2026-08-24 07:11:23.764465','2026-08-24 07:11:23.764471','2026-08-24 07:11:23.765172',NULL),(17,'cus-2052','CUSTOMER','ACTIVE','Codex Scroll Test','codex-scroll-1787555494376@example.com','codex-scroll-1787555494376@example.com','','$argon2id$v=19$m=65536,t=4,p=1$eDlqT3BCSFRTSFd3ODFETg$jEmLf7NuRHyWOeA4YsBJfZkkwQrqXeZt/XXg5wX9uOI',NULL,'2026-08-24 07:11:34.713116','2026-08-24 07:11:34.713122','2026-08-24 07:11:34.713959',NULL),(18,'cus-2053','CUSTOMER','ACTIVE','Codex Scroll Test','codex-scroll-1787555511867@example.com','codex-scroll-1787555511867@example.com','','$argon2id$v=19$m=65536,t=4,p=1$TVFkSll3ckpWOERjeXc2ag$VRh0mnaqtjPWgVB/Fj6zq7hUb9Rg3kiVXnSB9KmQn9Y',NULL,'2026-08-24 07:11:52.227446','2026-08-24 07:11:52.227453','2026-08-24 07:11:52.228130',NULL),(19,'cus-2054','CUSTOMER','ACTIVE','Codex Scroll Test','codex-scroll-1787555545562@example.com','codex-scroll-1787555545562@example.com','','$argon2id$v=19$m=65536,t=4,p=1$MTBDV0pFWTJxb3I1UVZIcg$fW5ZUTgYLtudUED85gnMCCn49Glh5y6d2v8x4vqD7ko',NULL,'2026-08-24 07:12:25.961433','2026-08-24 07:12:25.961439','2026-08-24 07:12:25.962031',NULL),(20,'cus-2055','CUSTOMER','ACTIVE','Codex Scroll Test','codex-scroll-1787555586409@example.com','codex-scroll-1787555586409@example.com','','$argon2id$v=19$m=65536,t=4,p=1$aUxFc0ZEV3Y5NmwvLzJMMA$U5f4q8oHsLFVAkfeQxrBqY3gjGQ+FzlsweX91KWMVls',NULL,'2026-08-24 07:13:06.750910','2026-08-24 07:13:06.750915','2026-08-24 07:13:06.754399',NULL),(21,'cus-2056','CUSTOMER','ACTIVE','Codex Scroll Test','codex-scroll-1787555617854@example.com','codex-scroll-1787555617854@example.com','','$argon2id$v=19$m=65536,t=4,p=1$bnFSWi5ieHlDdjFzQjZISQ$wzlsCP4dmB5irDrzBnZxaG7j/I3mNMwuORhWXWcOmYw',NULL,'2026-08-24 07:13:38.209670','2026-08-24 07:13:38.209676','2026-08-24 07:13:38.210289',NULL),(22,'cus-2057','CUSTOMER','ACTIVE','Codex Scroll Test','codex-scroll-1787555676535@example.com','codex-scroll-1787555676535@example.com','','$argon2id$v=19$m=65536,t=4,p=1$Lnl3bE9HTldRUFFuelJ6aA$KpR42ZPqSy3mF/6EflHJFlXtbBHLaowYGtmDTorTjyE',NULL,'2026-08-24 07:14:36.954206','2026-08-24 07:14:36.954219','2026-08-24 07:14:36.954837',NULL),(23,'cus-2058','CUSTOMER','ACTIVE','Codex Scroll Test','codex-scroll-1787555711015@example.com','codex-scroll-1787555711015@example.com','','$argon2id$v=19$m=65536,t=4,p=1$QzZiL2sxR21qNEwzYzNRVQ$eLlQT4onxkg5Wq3NmA5MtOsOVhQ8I8CRG6S0PGhMqP4',NULL,'2026-08-24 07:15:11.410148','2026-08-24 07:15:11.410155','2026-08-24 07:15:11.410743',NULL),(24,'cus-2059','CUSTOMER','ACTIVE','Codex Debug','codex-debug-1787555729797@example.com','codex-debug-1787555729797@example.com','','$argon2id$v=19$m=65536,t=4,p=1$dng0dmdGUllnYzVEd0xSTg$Lzn/rQgyvY4W1dcROSrINbUmYzn4g2TNGTJLKEqG28c',NULL,'2026-08-24 07:15:30.147478','2026-08-24 07:15:30.147484','2026-08-24 07:15:30.148373',NULL),(25,'cus-2060','CUSTOMER','ACTIVE','Codex Debug','codex-debug-1787555796005@example.com','codex-debug-1787555796005@example.com','','$argon2id$v=19$m=65536,t=4,p=1$dHZiaWdmSGRpR2tNQnFreA$HT3MtTYWP9Ks0w/emoK4edn2ikH4QYs1pfnKhCsMrf8',NULL,'2026-08-24 07:16:36.387043','2026-08-24 07:16:36.387049','2026-08-24 07:16:36.387525',NULL),(26,'cus-2061','CUSTOMER','ACTIVE','Codex Scroll Test','codex-scroll-1787555817255@example.com','codex-scroll-1787555817255@example.com','','$argon2id$v=19$m=65536,t=4,p=1$UWtNOVpyaUF4NVgvclVqMQ$V7trarMZ1JMgMjSGHH1e5tzPNXOo27MWjc7sbnARGE4',NULL,'2026-08-24 07:16:57.616310','2026-08-24 07:16:57.616317','2026-08-24 07:16:57.617179',NULL),(28,'cus-2062','CUSTOMER','ACTIVE','kishan','kishan@gmail.com','kishan@gmail.com','','$argon2id$v=19$m=65536,t=4,p=1$aS9OT1Z5RkJlTXRsNVJ1TA$TgSnSLlKqCb5yCgrIUmgXwsm3ezVxstWyhDRqCmmU0I',NULL,'2026-08-25 09:59:52.391743','2026-08-25 07:15:27.671327','2026-08-25 09:59:52.393399',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;

--
-- Temporary table structure for view `v_dashboard_queues`
--

DROP TABLE IF EXISTS `v_dashboard_queues`;
/*!50001 DROP VIEW IF EXISTS `v_dashboard_queues`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
CREATE OR REPLACE VIEW `v_dashboard_queues` AS SELECT
 1 AS `orders_to_confirm`,
  1 AS `payment_exceptions`,
  1 AS `ready_to_dispatch`,
  1 AS `returns_to_review`,
  1 AS `stock_at_risk`,
  1 AS `open_tickets`;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `v_order_timeline`
--

DROP TABLE IF EXISTS `v_order_timeline`;
/*!50001 DROP VIEW IF EXISTS `v_order_timeline`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
CREATE OR REPLACE VIEW `v_order_timeline` AS SELECT
 1 AS `order_id`,
  1 AS `order_number`,
  1 AS `at`,
  1 AS `label`,
  1 AS `detail`,
  1 AS `actor`;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `v_variant_availability`
--

DROP TABLE IF EXISTS `v_variant_availability`;
/*!50001 DROP VIEW IF EXISTS `v_variant_availability`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
CREATE OR REPLACE VIEW `v_variant_availability` AS SELECT
 1 AS `product_slug`,
  1 AS `sku`,
  1 AS `variant_id`,
  1 AS `size`,
  1 AS `color`,
  1 AS `color_hex`,
  1 AS `material`,
  1 AS `available`,
  1 AS `stock`;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `variant_inventory`
--

DROP TABLE IF EXISTS `variant_inventory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `variant_inventory` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `variant_id` bigint(20) unsigned NOT NULL,
  `stock_item_id` bigint(20) unsigned DEFAULT NULL,
  `on_hand` int(11) NOT NULL DEFAULT 0,
  `reserved` int(11) NOT NULL DEFAULT 0,
  `available` int(11) GENERATED ALWAYS AS (`on_hand` - `reserved`) STORED,
  `low_at` tinyint(3) unsigned NOT NULL DEFAULT 4,
  `version` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_variant_inventory_variant` (`variant_id`),
  KEY `ix_variant_inventory_stock_item` (`stock_item_id`),
  KEY `ix_variant_inventory_available` (`available`),
  CONSTRAINT `fk_variant_inventory_stock_item` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_variant_inventory_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=140 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `variant_inventory`
--

/*!40000 ALTER TABLE `variant_inventory` DISABLE KEYS */;
INSERT INTO `variant_inventory` (`id`, `variant_id`, `stock_item_id`, `on_hand`, `reserved`, `available`, `low_at`, `version`, `created_at`, `updated_at`) VALUES (1,1,1,0,0,0,4,0,'2026-08-17 09:49:53.678260','2026-08-17 09:49:53.678260'),(2,2,1,7,0,7,4,0,'2026-08-17 09:49:53.680395','2026-08-17 09:49:53.680395'),(3,3,1,6,0,6,4,0,'2026-08-17 09:49:53.680851','2026-08-17 09:49:53.680851'),(4,4,1,2,0,2,4,0,'2026-08-17 09:49:53.681257','2026-08-17 09:49:53.681257'),(5,5,1,4,0,4,4,0,'2026-08-17 09:49:53.681643','2026-08-17 09:49:53.681643'),(6,6,2,0,0,0,4,0,'2026-08-17 09:49:53.687721','2026-08-17 09:49:53.687721'),(7,7,2,7,0,7,4,0,'2026-08-17 09:49:53.689227','2026-08-17 09:49:53.689227'),(8,8,2,6,0,6,4,0,'2026-08-17 09:49:53.689657','2026-08-17 09:49:53.689657'),(9,9,2,2,0,2,4,0,'2026-08-17 09:49:53.690053','2026-08-17 09:49:53.690053'),(10,10,2,0,0,0,4,0,'2026-08-17 09:49:53.690437','2026-08-17 09:49:53.690437'),(11,11,4,8,0,8,4,0,'2026-08-17 09:49:53.693191','2026-08-17 09:49:53.693191'),(12,12,4,0,0,0,4,0,'2026-08-17 09:49:53.693591','2026-08-17 09:49:53.693591'),(13,13,4,6,2,4,4,2,'2026-08-17 09:49:53.694121','2026-08-17 10:08:26.835710'),(14,14,4,2,0,2,4,0,'2026-08-17 09:49:53.695755','2026-08-17 09:49:53.695755'),(15,15,4,4,0,4,4,0,'2026-08-17 09:49:53.696153','2026-08-17 09:49:53.696153'),(16,16,3,8,0,8,4,0,'2026-08-17 09:49:53.697347','2026-08-17 09:49:53.697347'),(17,17,3,7,0,7,4,0,'2026-08-17 09:49:53.697727','2026-08-17 09:49:53.697727'),(18,18,3,6,0,6,4,0,'2026-08-17 09:49:53.698104','2026-08-17 09:49:53.698104'),(19,19,3,2,0,2,4,0,'2026-08-17 09:49:53.698480','2026-08-17 09:49:53.698480'),(20,20,3,4,0,4,4,0,'2026-08-17 09:49:53.698854','2026-08-17 09:49:53.698854'),(21,21,5,8,0,8,4,0,'2026-08-17 09:49:53.700010','2026-08-17 09:49:53.700010'),(22,22,5,7,0,7,4,0,'2026-08-17 09:49:53.700384','2026-08-17 09:49:53.700384'),(23,23,5,6,0,6,4,0,'2026-08-17 09:49:53.700757','2026-08-17 09:49:53.700757'),(24,32,3,8,0,8,4,0,'2026-08-17 12:34:17.920917','2026-08-17 12:34:17.920917'),(25,33,3,8,0,8,4,0,'2026-08-17 12:34:17.922658','2026-08-17 12:34:17.922658'),(26,34,3,8,0,8,4,0,'2026-08-17 12:34:17.928540','2026-08-17 12:34:17.928540'),(27,35,3,8,0,8,4,0,'2026-08-17 12:34:17.930876','2026-08-17 12:34:17.930876'),(28,40,4,24,0,24,4,0,'2026-08-17 12:34:17.935141','2026-08-17 12:34:17.935141'),(29,41,5,5,0,5,4,0,'2026-08-17 12:34:17.936775','2026-08-17 12:34:17.936775'),(30,45,6,0,0,0,4,0,'2026-08-17 12:34:17.943473','2026-08-17 12:34:17.943473'),(31,46,6,4,0,4,4,0,'2026-08-17 12:34:17.944572','2026-08-17 12:34:17.944572'),(32,47,6,4,0,4,4,0,'2026-08-17 12:34:17.947070','2026-08-17 12:34:17.947070'),(33,48,6,4,0,4,4,0,'2026-08-17 12:34:17.948525','2026-08-17 12:34:17.948525'),(34,49,13,2,0,2,4,0,'2026-08-17 12:34:17.950760','2026-08-17 12:34:17.950760'),(35,50,13,2,0,2,4,0,'2026-08-17 12:34:17.951296','2026-08-17 12:34:17.951296'),(36,51,13,2,0,2,4,0,'2026-08-17 12:34:17.952279','2026-08-17 12:34:17.952279'),(37,52,13,2,0,2,4,0,'2026-08-17 12:34:17.956347','2026-08-17 12:34:17.956347'),(38,53,14,0,0,0,4,0,'2026-08-17 12:34:17.957996','2026-08-17 12:34:17.957996'),(39,54,14,4,0,4,4,0,'2026-08-17 12:34:17.958623','2026-08-17 12:34:17.958623'),(40,55,14,4,0,4,4,0,'2026-08-17 12:34:17.959221','2026-08-17 12:34:17.959221'),(41,56,14,0,0,0,4,0,'2026-08-17 12:34:17.959809','2026-08-17 12:34:17.959809'),(42,57,15,3,0,3,4,0,'2026-08-17 12:34:17.962697','2026-08-17 12:34:17.962697'),(43,58,15,3,0,3,4,0,'2026-08-17 12:34:17.963467','2026-08-17 12:34:17.963467'),(44,59,15,3,0,3,4,0,'2026-08-17 12:34:17.964079','2026-08-17 12:34:17.964079'),(45,60,15,3,0,3,4,2,'2026-08-17 12:34:17.964674','2026-08-24 06:58:02.325059'),(46,61,16,4,0,4,4,0,'2026-08-17 12:34:17.966819','2026-08-17 12:34:17.966819'),(47,62,16,4,0,4,4,0,'2026-08-17 12:34:17.968212','2026-08-17 12:34:17.968212'),(48,63,16,4,0,4,4,0,'2026-08-17 12:34:17.970266','2026-08-17 12:34:17.970266'),(49,64,16,4,0,4,4,0,'2026-08-17 12:34:17.971711','2026-08-17 12:34:17.971711'),(50,65,17,4,0,4,4,0,'2026-08-17 12:34:17.975322','2026-08-17 12:34:17.975322'),(51,66,17,4,0,4,4,0,'2026-08-17 12:34:17.976679','2026-08-17 12:34:17.976679'),(52,67,17,4,0,4,4,0,'2026-08-17 12:34:17.980371','2026-08-17 12:34:17.980371'),(53,68,17,4,0,4,4,0,'2026-08-17 12:34:17.982579','2026-08-17 12:34:17.982579'),(54,69,18,0,0,0,4,0,'2026-08-17 12:34:17.986963','2026-08-17 12:34:17.986963'),(55,70,18,5,0,5,4,0,'2026-08-17 12:34:17.988759','2026-08-17 12:34:17.988759'),(56,71,18,5,0,5,4,0,'2026-08-17 12:34:17.990742','2026-08-17 12:34:17.990742'),(57,72,18,5,0,5,4,0,'2026-08-17 12:34:17.993002','2026-08-17 12:34:17.993002'),(58,73,19,4,0,4,4,0,'2026-08-17 12:34:17.999375','2026-08-17 12:34:17.999375'),(59,74,19,4,1,3,4,1,'2026-08-17 12:34:18.001336','2026-08-24 07:08:19.249993'),(60,75,19,4,0,4,4,0,'2026-08-17 12:34:18.003482','2026-08-17 12:34:18.003482'),(61,76,19,4,0,4,4,0,'2026-08-17 12:34:18.005543','2026-08-17 12:34:18.005543'),(62,77,19,4,0,4,4,0,'2026-08-17 12:34:18.007518','2026-08-17 12:34:18.007518'),(63,78,20,7,0,7,4,0,'2026-08-17 12:34:18.012833','2026-08-17 12:34:18.012833'),(64,79,20,7,0,7,4,0,'2026-08-17 12:34:18.015732','2026-08-17 12:34:18.015732'),(65,80,20,7,0,7,4,0,'2026-08-17 12:34:18.017610','2026-08-17 12:34:18.017610'),(66,81,20,7,0,7,4,0,'2026-08-17 12:34:18.019384','2026-08-17 12:34:18.019384'),(67,82,21,7,0,7,4,0,'2026-08-17 12:34:18.023321','2026-08-17 12:34:18.023321'),(68,83,21,7,0,7,4,0,'2026-08-17 12:34:18.024827','2026-08-17 12:34:18.024827'),(69,84,21,7,0,7,4,0,'2026-08-17 12:34:18.026270','2026-08-17 12:34:18.026270'),(70,85,21,7,0,7,4,0,'2026-08-17 12:34:18.028378','2026-08-17 12:34:18.028378'),(71,86,22,9,0,9,4,0,'2026-08-17 12:34:18.033722','2026-08-17 12:34:18.033722'),(72,87,22,9,0,9,4,1,'2026-08-17 12:34:18.035450','2026-08-25 07:37:01.999080'),(73,88,22,9,0,9,4,0,'2026-08-17 12:34:18.037114','2026-08-17 12:34:18.037114'),(74,89,22,9,0,9,4,0,'2026-08-17 12:34:18.038648','2026-08-17 12:34:18.038648'),(75,90,23,8,0,8,4,0,'2026-08-17 12:34:18.042447','2026-08-17 12:34:18.042447'),(76,91,23,8,0,8,4,0,'2026-08-17 12:34:18.044285','2026-08-17 12:34:18.044285'),(77,92,23,8,0,8,4,0,'2026-08-17 12:34:18.047622','2026-08-17 12:34:18.047622'),(78,93,23,8,1,7,4,1,'2026-08-17 12:34:18.049358','2026-08-25 07:13:59.424328'),(79,94,24,5,0,5,4,0,'2026-08-17 12:34:18.053273','2026-08-17 12:34:18.053273'),(80,95,24,5,0,5,4,0,'2026-08-17 12:34:18.054773','2026-08-17 12:34:18.054773'),(81,96,24,5,0,5,4,0,'2026-08-17 12:34:18.056418','2026-08-17 12:34:18.056418'),(82,97,24,5,0,5,4,0,'2026-08-17 12:34:18.057979','2026-08-17 12:34:18.057979'),(83,98,24,0,0,0,4,0,'2026-08-17 12:34:18.059532','2026-08-17 12:34:18.059532'),(84,99,25,7,0,7,4,0,'2026-08-17 12:34:18.063542','2026-08-17 12:34:18.063542'),(85,100,25,7,0,7,4,0,'2026-08-17 12:34:18.065017','2026-08-17 12:34:18.065017'),(86,101,25,7,0,7,4,0,'2026-08-17 12:34:18.069404','2026-08-17 12:34:18.069404'),(87,102,25,7,0,7,4,0,'2026-08-17 12:34:18.071318','2026-08-17 12:34:18.071318'),(88,103,26,6,0,6,4,0,'2026-08-17 12:34:18.076337','2026-08-17 12:34:18.076337'),(89,104,26,6,0,6,4,0,'2026-08-17 12:34:18.078518','2026-08-17 12:34:18.078518'),(90,105,26,6,0,6,4,0,'2026-08-17 12:34:18.081618','2026-08-17 12:34:18.081618'),(91,106,26,6,0,6,4,0,'2026-08-17 12:34:18.083383','2026-08-17 12:34:18.083383'),(92,107,26,0,0,0,4,0,'2026-08-17 12:34:18.085054','2026-08-17 12:34:18.085054'),(93,108,27,7,0,7,4,0,'2026-08-17 12:34:18.088730','2026-08-17 12:34:18.088730'),(94,109,27,7,0,7,4,0,'2026-08-17 12:34:18.090303','2026-08-17 12:34:18.090303'),(95,110,27,7,0,7,4,0,'2026-08-17 12:34:18.091754','2026-08-17 12:34:18.091754'),(96,111,27,7,0,7,4,0,'2026-08-17 12:34:18.093450','2026-08-17 12:34:18.093450'),(97,112,28,6,0,6,4,0,'2026-08-17 12:34:18.098727','2026-08-17 12:34:18.098727'),(98,113,28,6,0,6,4,0,'2026-08-17 12:34:18.100868','2026-08-17 12:34:18.100868'),(99,114,28,6,0,6,4,0,'2026-08-17 12:34:18.102962','2026-08-17 12:34:18.102962'),(100,115,28,6,0,6,4,0,'2026-08-17 12:34:18.104992','2026-08-17 12:34:18.104992'),(101,116,29,5,0,5,4,0,'2026-08-17 12:34:18.109736','2026-08-17 12:34:18.109736'),(102,117,29,5,0,5,4,0,'2026-08-17 12:34:18.113632','2026-08-17 12:34:18.113632'),(103,118,29,5,0,5,4,0,'2026-08-17 12:34:18.116463','2026-08-17 12:34:18.116463'),(104,119,29,0,0,0,4,0,'2026-08-17 12:34:18.119463','2026-08-17 12:34:18.119463'),(105,120,30,16,0,16,4,0,'2026-08-17 12:34:18.124470','2026-08-17 12:34:18.124470'),(106,121,30,16,0,16,4,0,'2026-08-17 12:34:18.126363','2026-08-17 12:34:18.126363'),(107,122,30,16,0,16,4,0,'2026-08-17 12:34:18.128847','2026-08-17 12:34:18.128847'),(108,123,30,16,0,16,4,0,'2026-08-17 12:34:18.131838','2026-08-17 12:34:18.131838'),(109,124,30,16,0,16,4,0,'2026-08-17 12:34:18.133839','2026-08-17 12:34:18.133839'),(110,125,31,15,0,15,4,0,'2026-08-17 12:34:18.138311','2026-08-17 12:34:18.138311'),(111,126,31,15,0,15,4,0,'2026-08-17 12:34:18.139992','2026-08-17 12:34:18.139992'),(112,127,31,15,0,15,4,0,'2026-08-17 12:34:18.141492','2026-08-17 12:34:18.141492'),(113,128,31,15,0,15,4,0,'2026-08-17 12:34:18.142958','2026-08-17 12:34:18.142958'),(114,129,31,15,0,15,4,0,'2026-08-17 12:34:18.145081','2026-08-17 12:34:18.145081'),(115,130,32,12,0,12,4,0,'2026-08-17 12:34:18.150386','2026-08-17 12:34:18.150386'),(116,131,32,12,0,12,4,0,'2026-08-17 12:34:18.152049','2026-08-17 12:34:18.152049'),(117,132,32,12,0,12,4,0,'2026-08-17 12:34:18.153704','2026-08-17 12:34:18.153704'),(118,133,32,12,0,12,4,0,'2026-08-17 12:34:18.155286','2026-08-17 12:34:18.155286'),(119,134,32,12,0,12,4,0,'2026-08-17 12:34:18.156883','2026-08-17 12:34:18.156883'),(120,135,33,45,0,45,4,0,'2026-08-17 12:34:18.160672','2026-08-17 12:34:18.160672'),(121,136,34,41,0,41,4,0,'2026-08-17 12:34:18.165978','2026-08-17 12:34:18.165978'),(122,137,35,58,1,57,4,1,'2026-08-17 12:34:18.169919','2026-08-24 08:17:00.765173'),(123,138,36,52,0,52,4,0,'2026-08-17 12:34:18.173740','2026-08-17 12:34:18.173740'),(124,139,37,5,0,5,4,0,'2026-08-17 12:34:18.181489','2026-08-17 12:34:18.181489'),(125,140,37,5,0,5,4,0,'2026-08-17 12:34:18.183835','2026-08-17 12:34:18.183835'),(126,141,37,5,0,5,4,0,'2026-08-17 12:34:18.185768','2026-08-17 12:34:18.185768'),(127,142,37,5,0,5,4,0,'2026-08-17 12:34:18.187455','2026-08-17 12:34:18.187455'),(128,143,37,0,0,0,4,0,'2026-08-17 12:34:18.189148','2026-08-17 12:34:18.189148'),(129,144,38,9,0,9,4,0,'2026-08-17 12:34:18.193048','2026-08-17 12:34:18.193048'),(136,151,74,5,0,5,4,0,'2026-08-19 07:59:19.560267','2026-08-19 07:59:19.560267'),(137,152,74,5,1,4,4,3,'2026-08-19 07:59:19.569285','2026-08-24 07:39:43.798374'),(138,153,74,5,0,5,4,0,'2026-08-19 07:59:19.571488','2026-08-19 07:59:19.571488'),(139,154,74,5,0,5,4,0,'2026-08-19 07:59:19.577025','2026-08-19 07:59:19.577025');
/*!40000 ALTER TABLE `variant_inventory` ENABLE KEYS */;

--
-- Table structure for table `vouchers`
--

DROP TABLE IF EXISTS `vouchers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `vouchers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(40) NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `return_public_id` varchar(40) NOT NULL DEFAULT '',
  `reason` varchar(160) NOT NULL DEFAULT '',
  `customer_name` varchar(120) NOT NULL DEFAULT '',
  `customer_user_id` bigint(20) unsigned DEFAULT NULL,
  `issued_on` date NOT NULL,
  `expires_on` date NOT NULL,
  `claimed_on` date DEFAULT NULL,
  `claimed_order` varchar(40) DEFAULT NULL,
  `wallet_entry_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `return_key` varchar(40) GENERATED ALWAYS AS (nullif(`return_public_id`,'')) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vouchers_code` (`code`),
  UNIQUE KEY `uq_vouchers_return` (`return_key`),
  KEY `ix_vouchers_customer` (`customer_user_id`,`claimed_on`),
  KEY `fk_vouchers_wallet_entry` (`wallet_entry_id`),
  CONSTRAINT `fk_vouchers_customer` FOREIGN KEY (`customer_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_vouchers_wallet_entry` FOREIGN KEY (`wallet_entry_id`) REFERENCES `wallet_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vouchers`
--

/*!40000 ALTER TABLE `vouchers` DISABLE KEYS */;
INSERT INTO `vouchers` (`id`, `code`, `amount`, `return_public_id`, `reason`, `customer_name`, `customer_user_id`, `issued_on`, `expires_on`, `claimed_on`, `claimed_order`, `wallet_entry_id`, `created_at`, `updated_at`, `return_key`) VALUES (4,'IOV001',1150.00,'','somthing','Tirth',2,'2026-08-25','2027-08-26','2026-08-25','Wallet',12,'2026-08-25 06:58:30.595705','2026-08-25 07:00:01.053450',NULL),(5,'IOV002',2000.00,'','somthing','Tirth',2,'2026-08-25','2027-08-26','2026-08-25','Wallet',13,'2026-08-25 07:11:35.551885','2026-08-25 07:13:35.599398',NULL);
/*!40000 ALTER TABLE `vouchers` ENABLE KEYS */;

--
-- Table structure for table `wallet_accounts`
--

DROP TABLE IF EXISTS `wallet_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wallet_accounts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `balance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'INR',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wallet_accounts_user` (`user_id`),
  CONSTRAINT `fk_wallet_accounts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wallet_accounts`
--

/*!40000 ALTER TABLE `wallet_accounts` DISABLE KEYS */;
INSERT INTO `wallet_accounts` (`id`, `user_id`, `balance`, `currency`, `created_at`, `updated_at`) VALUES (15,2,3150.00,'INR','2026-08-25 07:00:01.042234','2026-08-25 07:13:35.589334');
/*!40000 ALTER TABLE `wallet_accounts` ENABLE KEYS */;

--
-- Table structure for table `wallet_entries`
--

DROP TABLE IF EXISTS `wallet_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wallet_entries` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `account_id` bigint(20) unsigned NOT NULL,
  `direction` varchar(8) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `balance_after` decimal(12,2) NOT NULL DEFAULT 0.00,
  `kind` varchar(24) NOT NULL,
  `reference` varchar(64) NOT NULL DEFAULT '',
  `note` varchar(190) NOT NULL DEFAULT '',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `idem_key` varchar(96) GENERATED ALWAYS AS (if(`reference` = '',NULL,concat(`kind`,':',`reference`))) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wallet_entries_idem` (`idem_key`),
  KEY `ix_wallet_entries_account` (`account_id`,`id`),
  CONSTRAINT `fk_wallet_entries_account` FOREIGN KEY (`account_id`) REFERENCES `wallet_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wallet_entries`
--

/*!40000 ALTER TABLE `wallet_entries` DISABLE KEYS */;
INSERT INTO `wallet_entries` (`id`, `account_id`, `direction`, `amount`, `balance_after`, `kind`, `reference`, `note`, `created_at`, `idem_key`) VALUES (12,15,'credit',1150.00,1150.00,'voucher','IOV001','somthing','2026-08-25 07:00:01.047551','voucher:IOV001'),(13,15,'credit',2000.00,3150.00,'voucher','IOV002','somthing','2026-08-25 07:13:35.589334','voucher:IOV002');
/*!40000 ALTER TABLE `wallet_entries` ENABLE KEYS */;

--
-- Table structure for table `warehouses`
--

DROP TABLE IF EXISTS `warehouses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `warehouses` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` varchar(16) NOT NULL,
  `name` varchar(120) NOT NULL,
  `available_label` varchar(40) NOT NULL DEFAULT '',
  `capacity_pct` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `cutoff` varchar(40) NOT NULL DEFAULT '',
  `status` varchar(16) NOT NULL DEFAULT 'Online',
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_warehouses_public_id` (`public_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `warehouses`
--

/*!40000 ALTER TABLE `warehouses` DISABLE KEYS */;
INSERT INTO `warehouses` (`id`, `public_id`, `name`, `available_label`, `capacity_pct`, `cutoff`, `status`, `created_at`, `updated_at`) VALUES (1,'BLR-01','Bengaluru fulfilment centre','1,248',82,'18:00 · Blue Dart','Online','2026-08-17 09:49:53.662400','2026-08-17 09:49:53.662400'),(2,'DEL-01','Delhi regional node','486',61,'17:30 · Delhivery','Online','2026-08-17 09:49:53.662745','2026-08-17 09:49:53.662745'),(3,'MUM-01','Mumbai overflow','112',24,'16:00 · Ecom Express','Draft','2026-08-17 09:49:53.662952','2026-08-17 09:49:53.662952');
/*!40000 ALTER TABLE `warehouses` ENABLE KEYS */;

--
-- Table structure for table `webhook_inbox`
--

DROP TABLE IF EXISTS `webhook_inbox`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `webhook_inbox` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `provider` varchar(40) NOT NULL,
  `event_id` varchar(190) NOT NULL,
  `signature_ok` tinyint(1) NOT NULL DEFAULT 0,
  `payload` mediumtext DEFAULT NULL,
  `processed_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_webhook_inbox_event` (`provider`,`event_id`),
  KEY `ix_webhook_inbox_unprocessed` (`processed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `webhook_inbox`
--

/*!40000 ALTER TABLE `webhook_inbox` DISABLE KEYS */;
/*!40000 ALTER TABLE `webhook_inbox` ENABLE KEYS */;

--
-- Dumping routines for database 'io_src'
--

--
-- Final view structure for view `v_dashboard_queues`
--

/*!50001 DROP VIEW IF EXISTS `v_dashboard_queues`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY INVOKER VIEW `v_dashboard_queues` AS select (select count(0) from `orders` where `orders`.`console_state` = 'Placed') AS `orders_to_confirm`,(select count(0) from `payments` where `payments`.`status` = 'Failed') AS `payment_exceptions`,(select count(0) from `orders` `o` where `o`.`console_state` = 'Confirmed' and !exists(select 1 from `shipments` `s` where `s`.`order_id` = `o`.`id` and `s`.`status` not in ('Failed','Cancelled') limit 1)) AS `ready_to_dispatch`,(select count(0) from `return_requests` where `return_requests`.`state` = 'New') AS `returns_to_review`,(select count(0) from `v_variant_availability` where `v_variant_availability`.`stock` in ('LOW_STOCK','SOLD_OUT')) AS `stock_at_risk`,(select count(0) from `support_queries` where `support_queries`.`status` = 'Open') AS `open_tickets`;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_order_timeline`
--

/*!50001 DROP VIEW IF EXISTS `v_order_timeline`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY INVOKER VIEW `v_order_timeline` AS select `o`.`id` AS `order_id`,`o`.`number` AS `order_number`,`h`.`created_at` AS `at`,`h`.`to_status` AS `label`,`h`.`note` AS `detail`,`h`.`actor_type` AS `actor` from (`orders` `o` join `order_status_history` `h` on(`h`.`order_id` = `o`.`id`)) union all select `o`.`id` AS `order_id`,`o`.`number` AS `order_number`,`e`.`created_at` AS `at`,`e`.`label` AS `label`,`e`.`detail` AS `detail`,'system' AS `actor` from ((`orders` `o` join `shipments` `s` on(`s`.`order_id` = `o`.`id`)) join `shipment_events` `e` on(`e`.`shipment_id` = `s`.`id`));
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_variant_availability`
--

/*!50001 DROP VIEW IF EXISTS `v_variant_availability`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY INVOKER VIEW `v_variant_availability` AS select `p`.`public_id` AS `product_slug`,`v`.`public_id` AS `sku`,`v`.`id` AS `variant_id`,`v`.`size` AS `size`,`v`.`color` AS `color`,`v`.`color_hex` AS `color_hex`,`v`.`material` AS `material`,coalesce(`vi`.`available`,0) AS `available`,case when coalesce(`vi`.`available`,0) <= 0 then 'SOLD_OUT' when coalesce(`vi`.`available`,0) < coalesce(`vi`.`low_at`,4) then 'LOW_STOCK' else 'IN_STOCK' end AS `stock` from ((`product_variants` `v` join `products` `p` on(`p`.`id` = `v`.`product_id`)) left join `variant_inventory` `vi` on(`vi`.`variant_id` = `v`.`id`)) where `v`.`deleted_at` is null and `p`.`deleted_at` is null;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

SET FOREIGN_KEY_CHECKS = 1;
