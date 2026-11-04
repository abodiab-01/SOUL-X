-- ==============================================================================
-- Soul-X Complete Database Schema & Realtime Setup
-- Execute this entire script once in Supabase SQL Editor:
-- Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create Profiles Table (Supports both App direct registrations and Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT,
  avatar_url TEXT,
  birth_date DATE,
  gender TEXT CHECK (gender IN ('male', 'female')),
  country TEXT,
  bio TEXT DEFAULT '',
  wallet_balance INTEGER DEFAULT 0,
  coins_balance INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist if table was partially created previously
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coins_balance INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_balance INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_profiles_display_id ON public.profiles(display_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_name ON public.profiles(name);

-- 3. Automatic Profile Creation Trigger on Supabase Auth SignUp
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  generated_display_id TEXT;
  user_full_name TEXT;
BEGIN
  -- Generate unique Soul-X Display ID
  generated_display_id := 'S-' || LPAD(FLOOR(random() * 10000)::TEXT, 4, '0') || 'V' || LPAD(FLOOR(random() * 100)::TEXT, 2, '0') || '-X' || LPAD(FLOOR(random() * 1000)::TEXT, 3, '0');
  
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (
    id,
    display_id,
    email,
    name,
    avatar_url,
    birth_date,
    gender,
    country,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    generated_display_id,
    NEW.email,
    user_full_name,
    NEW.raw_user_meta_data->>'photo_url',
    (NEW.raw_user_meta_data->>'birth_date')::DATE,
    NEW.raw_user_meta_data->>'gender',
    NEW.raw_user_meta_data->>'country',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Create Conversations & Participants
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_user ON public.conversation_participants(user_id);

-- 5. Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- 6. Create Friend Requests Table
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sender_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON public.friend_requests(sender_id);

-- 7. Create Friends Table
CREATE TABLE IF NOT EXISTS public.friends (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, friend_id)
);

-- 8. Create Agents Table
CREATE TABLE IF NOT EXISTS public.agents (
  id TEXT PRIMARY KEY,
  grid_code TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT,
  tagline_ar TEXT,
  tagline_en TEXT,
  country TEXT NOT NULL,
  flag TEXT DEFAULT '🌐',
  balance NUMERIC DEFAULT 0,
  category TEXT CHECK (category IN ('recharge', 'withdraw', 'both')) DEFAULT 'both',
  methods JSONB DEFAULT '[]'::jsonb,
  response_time_ar TEXT,
  response_time_en TEXT,
  rating NUMERIC DEFAULT 4.95,
  completed_orders INTEGER DEFAULT 0,
  whatsapp TEXT DEFAULT '',
  telegram TEXT DEFAULT '',
  is_online BOOLEAN DEFAULT true,
  min_amount NUMERIC DEFAULT 100,
  max_amount NUMERIC DEFAULT 2000000,
  rate_note_ar TEXT DEFAULT '',
  rate_note_en TEXT DEFAULT '',
  status TEXT CHECK (status IN ('active', 'suspended')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agents_grid_code ON public.agents(grid_code);
CREATE INDEX IF NOT EXISTS idx_agents_email ON public.agents(email);
CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents(status);

-- 9. Create Agency Withdrawals Table
CREATE TABLE IF NOT EXISTS public.agency_withdrawals (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  agent_name TEXT,
  grid_code TEXT,
  amount NUMERIC NOT NULL,
  fee NUMERIC DEFAULT 0,
  net_credited NUMERIC DEFAULT 0,
  method TEXT,
  account_details TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  user_id TEXT,
  user_display_id TEXT,
  user_name TEXT,
  type TEXT DEFAULT 'incoming_user_withdrawal',
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Create Agency Transactions Table
CREATE TABLE IF NOT EXISTS public.agency_transactions (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  grid_code TEXT,
  target_user_id TEXT,
  target_user_display_id TEXT,
  target_user_name TEXT,
  amount NUMERIC NOT NULL,
  gross_amount NUMERIC,
  fee_amount NUMERIC,
  fee_percentage NUMERIC,
  payout_method TEXT,
  account_details TEXT,
  type TEXT DEFAULT 'recharge',
  timestamp TIMESTAMPTZ DEFAULT now(),
  previous_balance NUMERIC,
  new_balance NUMERIC
);

-- 11. Create Tombstones Table (Preserves deletions across deployments)
CREATE TABLE IF NOT EXISTS public.tombstones (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_tombstones_type_id ON public.tombstones(entity_type, entity_id);

-- 12. Storage Bucket Setup: Ensure 'soul-x' Bucket Exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('soul-x', 'soul-x', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 13. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tombstones ENABLE ROW LEVEL SECURITY;

-- 14. Standard Permissive RLS Policies (Allows Soul-X Server & Client full authorized access)
DO $$
BEGIN
  -- Profiles
  DROP POLICY IF EXISTS "Public profiles read" ON public.profiles;
  CREATE POLICY "Public profiles read" ON public.profiles FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Public profiles manage" ON public.profiles;
  CREATE POLICY "Public profiles manage" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

  -- Conversations
  DROP POLICY IF EXISTS "Conversations access" ON public.conversations;
  CREATE POLICY "Conversations access" ON public.conversations FOR ALL USING (true) WITH CHECK (true);

  -- Conversation Participants
  DROP POLICY IF EXISTS "Participants access" ON public.conversation_participants;
  CREATE POLICY "Participants access" ON public.conversation_participants FOR ALL USING (true) WITH CHECK (true);

  -- Messages
  DROP POLICY IF EXISTS "Messages access" ON public.messages;
  CREATE POLICY "Messages access" ON public.messages FOR ALL USING (true) WITH CHECK (true);

  -- Friend Requests
  DROP POLICY IF EXISTS "Friend requests access" ON public.friend_requests;
  CREATE POLICY "Friend requests access" ON public.friend_requests FOR ALL USING (true) WITH CHECK (true);

  -- Friends
  DROP POLICY IF EXISTS "Friends access" ON public.friends;
  CREATE POLICY "Friends access" ON public.friends FOR ALL USING (true) WITH CHECK (true);

  -- Agents
  DROP POLICY IF EXISTS "Agents access" ON public.agents;
  CREATE POLICY "Agents access" ON public.agents FOR ALL USING (true) WITH CHECK (true);

  -- Agency Withdrawals
  DROP POLICY IF EXISTS "Withdrawals access" ON public.agency_withdrawals;
  CREATE POLICY "Withdrawals access" ON public.agency_withdrawals FOR ALL USING (true) WITH CHECK (true);

  -- Agency Transactions
  DROP POLICY IF EXISTS "Transactions access" ON public.agency_transactions;
  CREATE POLICY "Transactions access" ON public.agency_transactions FOR ALL USING (true) WITH CHECK (true);

  -- Tombstones
  DROP POLICY IF EXISTS "Tombstones access" ON public.tombstones;
  CREATE POLICY "Tombstones access" ON public.tombstones FOR ALL USING (true) WITH CHECK (true);
END $$;

-- 15. Enable Realtime Replication for messages and friends
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agents;
