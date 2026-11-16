-- ========================================================
-- Soul-X Neon Database Schema Migration (PostgreSQL)
-- Compatible with Neon Serverless Postgres (neon.tech)
-- ========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table (المستخدمين والحسابات)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT,
  avatar_url TEXT,
  birth_date DATE,
  gender TEXT,
  country TEXT,
  bio TEXT,
  wallet_balance BIGINT DEFAULT 0,
  coins_balance BIGINT DEFAULT 0,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_display_id ON profiles(display_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- 2. Agents Table (الوكلاء المعتمدين للشحن والسحب)
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  grid_code TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT,
  tagline_ar TEXT,
  tagline_en TEXT,
  country TEXT,
  flag TEXT,
  balance NUMERIC(18, 2) DEFAULT 0,
  category TEXT DEFAULT 'both',
  methods JSONB DEFAULT '[]'::jsonb,
  response_time_ar TEXT,
  response_time_en TEXT,
  rating NUMERIC(3, 2) DEFAULT 5.0,
  completed_orders INT DEFAULT 0,
  whatsapp TEXT,
  telegram TEXT,
  is_online BOOLEAN DEFAULT TRUE,
  min_amount NUMERIC(18, 2) DEFAULT 100,
  max_amount NUMERIC(18, 2) DEFAULT 2000000,
  rate_note_ar TEXT,
  rate_note_en TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS min_amount NUMERIC(18, 2) DEFAULT 100;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS max_amount NUMERIC(18, 2) DEFAULT 2000000;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS rate_note_ar TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS rate_note_en TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_agents_grid_code ON agents(grid_code);
CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email);

-- 3. Friends Table (علاقات الصداقة المتبادلة)
CREATE TABLE IF NOT EXISTS friends (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_friendship UNIQUE (user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);

-- 4. Friend Requests Table (طلبات الصداقة المعلقة والمقبولة)
CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_friend_request UNIQUE (sender_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);

-- 5. Conversations Table (المحادثات والدردشات)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Conversation Participants Table (أطراف المحادثة)
CREATE TABLE IF NOT EXISTS conversation_participants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_conv_part UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_parts_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_parts_conv ON conversation_participants(conversation_id);

-- 7. Messages Table (الرسائل المتبادلة والهدايا)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  text TEXT NOT NULL,
  is_gift BOOLEAN DEFAULT FALSE,
  gift_cost INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sender_name TEXT,
  gift_icon TEXT,
  gift_name TEXT
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS gift_icon TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS gift_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_duration INT;

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- 8. Agency Withdrawals Table (طلبات سحب الوكالات والمستخدمين)
CREATE TABLE IF NOT EXISTS agency_withdrawals (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  order_number TEXT,
  agent_id TEXT NOT NULL,
  agent_name TEXT,
  grid_code TEXT NOT NULL,
  diamonds_amount BIGINT DEFAULT 0,
  amount NUMERIC(18, 2) DEFAULT 0,
  fee NUMERIC(18, 2) DEFAULT 0,
  net_credited NUMERIC(18, 2) DEFAULT 0,
  usd_amount NUMERIC(12, 2) DEFAULT 0,
  net_usd_amount NUMERIC(12, 2) DEFAULT 0,
  payment_method TEXT,
  method TEXT,
  account_details TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  user_id TEXT,
  user_display_id TEXT,
  user_name TEXT,
  type TEXT DEFAULT 'agency_cashout',
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS amount NUMERIC(18, 2) DEFAULT 0;
ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS fee NUMERIC(18, 2) DEFAULT 0;
ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS net_credited NUMERIC(18, 2) DEFAULT 0;
ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS net_usd_amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS method TEXT;
ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE agency_withdrawals ALTER COLUMN diamonds_amount DROP NOT NULL;
ALTER TABLE agency_withdrawals ALTER COLUMN usd_amount DROP NOT NULL;
ALTER TABLE agency_withdrawals ALTER COLUMN payment_method DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawals_agent ON agency_withdrawals(agent_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_grid ON agency_withdrawals(grid_code);

-- 9. Agency Transactions Table (حركات الشحن وسجل التحويلات)
CREATE TABLE IF NOT EXISTS agency_transactions (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  order_number TEXT,
  agent_id TEXT NOT NULL,
  grid_code TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  target_user_display_id TEXT,
  target_user_name TEXT,
  amount NUMERIC(18, 2) NOT NULL,
  gross_amount NUMERIC(18, 2),
  fee_amount NUMERIC(18, 2),
  fee_percentage NUMERIC(5, 2),
  usd_amount NUMERIC(12, 2),
  net_usd_amount NUMERIC(12, 2),
  payout_method TEXT,
  account_details TEXT,
  type TEXT DEFAULT 'recharge',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  previous_balance NUMERIC(18, 2),
  new_balance NUMERIC(18, 2)
);

ALTER TABLE agency_transactions ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE agency_transactions ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE agency_transactions ADD COLUMN IF NOT EXISTS usd_amount NUMERIC(12, 2);
ALTER TABLE agency_transactions ADD COLUMN IF NOT EXISTS net_usd_amount NUMERIC(12, 2);

CREATE INDEX IF NOT EXISTS idx_transactions_agent ON agency_transactions(agent_id);

-- 10. Tombstones Table (سجل العناصر المحذوفة لمنع استرجاعها)
CREATE TABLE IF NOT EXISTS tombstones (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  deleted_identifier TEXT NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tombstones_ident ON tombstones(deleted_identifier);

-- 11. Feedback & User Reports Table (البلاغات والاقتراحات)
CREATE TABLE IF NOT EXISTS feedback_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_display_id TEXT,
  user_name TEXT,
  user_email TEXT,
  user_avatar TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  device_info TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  admin_notes TEXT,
  admin_reply TEXT,
  reported_user_id TEXT,
  reported_user_display_id TEXT,
  reported_user_name TEXT,
  reported_user_avatar TEXT,
  reported_user_email TEXT,
  reason TEXT,
  source TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_reports_created ON feedback_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_type ON feedback_reports(type);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_status ON feedback_reports(status);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_reported_user ON feedback_reports(reported_user_id);

-- 12. Password Reset Requests Table (طلبات استعادة كلمة المرور)
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id TEXT PRIMARY KEY,
  source TEXT DEFAULT 'telegram',
  user_id TEXT,
  user_display_id TEXT,
  user_email TEXT,
  user_name TEXT,
  telegram_user_id TEXT,
  telegram_username TEXT,
  telegram_first_name TEXT,
  telegram_last_name TEXT,
  chat_id TEXT,
  contact_note TEXT,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_password_resets_requested ON password_reset_requests(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_resets_status ON password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_reset_requests(user_email);

-- 13. Telegram Bot Referral Settings & Records
CREATE TABLE IF NOT EXISTS bot_referral_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  enabled BOOLEAN DEFAULT TRUE,
  new_user_bonus_usd NUMERIC(12, 4) DEFAULT 0.10,
  referrer_bonus_usd NUMERIC(12, 4) DEFAULT 0.50,
  coins_per_dollar BIGINT DEFAULT 25000,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_referral_users (
  telegram_user_id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  referral_code TEXT UNIQUE NOT NULL,
  balance_usd NUMERIC(14, 4) DEFAULT 0,
  total_earned_usd NUMERIC(14, 4) DEFAULT 0,
  total_transferred_usd NUMERIC(14, 4) DEFAULT 0,
  total_transferred_coins BIGINT DEFAULT 0,
  referrals_count INT DEFAULT 0,
  referred_by_telegram_id TEXT,
  referred_by_code TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_ref_users_code ON bot_referral_users(referral_code);

CREATE TABLE IF NOT EXISTS bot_referral_events (
  id TEXT PRIMARY KEY,
  referrer_telegram_id TEXT NOT NULL,
  referrer_code TEXT NOT NULL,
  new_user_telegram_id TEXT NOT NULL,
  new_user_name TEXT,
  new_user_username TEXT,
  referrer_bonus_usd NUMERIC(12, 4) DEFAULT 0.50,
  new_user_bonus_usd NUMERIC(12, 4) DEFAULT 0.10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_ref_events_created ON bot_referral_events(created_at DESC);

CREATE TABLE IF NOT EXISTS bot_referral_transfers (
  id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  telegram_name TEXT,
  telegram_username TEXT,
  target_user_id TEXT NOT NULL,
  target_display_id TEXT NOT NULL,
  target_user_name TEXT,
  amount_usd NUMERIC(14, 4) NOT NULL,
  coins_credited BIGINT NOT NULL,
  coins_per_dollar BIGINT NOT NULL,
  previous_coins_balance BIGINT DEFAULT 0,
  new_coins_balance BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_ref_transfers_created ON bot_referral_transfers(created_at DESC);

-- 14. Games Settings Table (إعدادات الألعاب ونسبة ربح Plinko و Mines و Dice و Olympus و Boxes من 0 إلى 10)
CREATE TABLE IF NOT EXISTS games_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  plinko_profit_level NUMERIC(4, 2) DEFAULT 5,
  mines_profit_level NUMERIC(4, 2) DEFAULT 5,
  dice_profit_level NUMERIC(4, 2) DEFAULT 5,
  olympus_profit_level NUMERIC(4, 2) DEFAULT 5,
  boxes_profit_level NUMERIC(4, 2) DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE games_settings ADD COLUMN IF NOT EXISTS mines_profit_level NUMERIC(4, 2) DEFAULT 5;
ALTER TABLE games_settings ADD COLUMN IF NOT EXISTS dice_profit_level NUMERIC(4, 2) DEFAULT 5;
ALTER TABLE games_settings ADD COLUMN IF NOT EXISTS olympus_profit_level NUMERIC(4, 2) DEFAULT 5;
ALTER TABLE games_settings ADD COLUMN IF NOT EXISTS boxes_profit_level NUMERIC(4, 2) DEFAULT 5;

-- 15. App Settings Table (إعدادات التطبيق وتفعيل/تعطيل المتجر والألعاب)
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  default_bio TEXT,
  default_bio_en TEXT,
  games_enabled BOOLEAN DEFAULT TRUE,
  store_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
