CREATE DATABASE IF NOT EXISTS xiao_chu_analytics
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE xiao_chu_analytics;

CREATE TABLE IF NOT EXISTS log_pull_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  window_start DATETIME NOT NULL,
  window_end DATETIME NOT NULL,
  pulled_count INT NOT NULL DEFAULT 0,
  inserted_count INT NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'running',
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_window (window_start, window_end),
  KEY idx_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_uuid VARCHAR(128) NOT NULL,
  event_at DATETIME NOT NULL,
  server_at DATETIME NOT NULL,
  openid_hash VARCHAR(64) NOT NULL DEFAULT '',
  session_id VARCHAR(96) NOT NULL DEFAULT '',
  event_id VARCHAR(96) NOT NULL,
  scene VARCHAR(64) NOT NULL DEFAULT '',
  stage_id VARCHAR(64) NOT NULL DEFAULT '',
  client_version VARCHAR(48) NOT NULL DEFAULT '',
  platform VARCHAR(32) NOT NULL DEFAULT '',
  params_json JSON NULL,
  raw_log JSON NULL,
  pull_run_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_event_uuid (event_uuid),
  KEY idx_event_at (event_at),
  KEY idx_event_id_at (event_id, event_at),
  KEY idx_user_at (openid_hash, event_at),
  KEY idx_session_at (session_id, event_at),
  KEY idx_stage_at (stage_id, event_at),
  KEY idx_pull_run (pull_run_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS funnel_hourly_metrics (
  bucket_hour DATETIME NOT NULL,
  client_version VARCHAR(48) NOT NULL DEFAULT '',
  new_users INT NOT NULL DEFAULT 0,
  loading_ready INT NOT NULL DEFAULT 0,
  intro_finish INT NOT NULL DEFAULT 0,
  prologue_first_input INT NOT NULL DEFAULT 0,
  prologue_first_damage INT NOT NULL DEFAULT 0,
  prologue_clear INT NOT NULL DEFAULT 0,
  stage_1_1_start INT NOT NULL DEFAULT 0,
  stage_1_1_first_input INT NOT NULL DEFAULT 0,
  stage_1_1_clear INT NOT NULL DEFAULT 0,
  stage_1_2_start INT NOT NULL DEFAULT 0,
  stage_1_2_first_input INT NOT NULL DEFAULT 0,
  stage_1_2_clear INT NOT NULL DEFAULT 0,
  platform_gift_claimed INT NOT NULL DEFAULT 0,
  ad_entry_show INT NOT NULL DEFAULT 0,
  ad_click INT NOT NULL DEFAULT 0,
  ad_complete INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (bucket_hour, client_version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
