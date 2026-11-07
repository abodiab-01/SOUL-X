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
  balance BIGINT DEFAULT 0,
  category TEXT DEFAULT 'both',
  methods JSONB DEFAULT '[]'::jsonb,
  response_time_ar TEXT,
  response_time_en TEXT,
  rating NUMERIC(3, 2) DEFAULT 5.0,
  completed_orders INT DEFAULT 0,
  whatsapp TEXT,
  telegram TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- 8. Agency Withdrawals Table (طلبات سحب الوكالات والمستخدمين)
CREATE TABLE IF NOT EXISTS agency_withdrawals (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  grid_code TEXT NOT NULL,
  diamonds_amount BIGINT NOT NULL,
  usd_amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL,
  account_details TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  user_id TEXT,
  user_display_id TEXT,
  user_name TEXT,
  type TEXT DEFAULT 'agency_cashout',
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_agent ON agency_withdrawals(agent_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_grid ON agency_withdrawals(grid_code);

-- 9. Agency Transactions Table (حركات الشحن وسجل التحويلات)
CREATE TABLE IF NOT EXISTS agency_transactions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  grid_code TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  target_user_display_id TEXT,
  target_user_name TEXT,
  amount BIGINT NOT NULL,
  gross_amount BIGINT,
  fee_amount BIGINT,
  fee_percentage NUMERIC(5, 2),
  payout_method TEXT,
  account_details TEXT,
  type TEXT DEFAULT 'recharge',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  previous_balance BIGINT,
  new_balance BIGINT
);

CREATE INDEX IF NOT EXISTS idx_transactions_agent ON agency_transactions(agent_id);

-- 10. Tombstones Table (سجل العناصر المحذوفة لمنع استرجاعها)
CREATE TABLE IF NOT EXISTS tombstones (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  deleted_identifier TEXT NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tombstones_ident ON tombstones(deleted_identifier);
