-- ==============================================================================
-- Soul-X Migration: Supabase Database, Auth, Storage (soul-x bucket) & RLS Policies
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  birth_date DATE,
  gender TEXT CHECK (gender IN ('male', 'female')),
  bio TEXT DEFAULT '',
  wallet_balance INTEGER DEFAULT 1250,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast search by ID, email, or name
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
  -- Generate a unique 9-digit display ID
  generated_display_id := FLOOR(100000000 + random() * 900000000)::TEXT;
  
  -- Extract user name from raw user meta data or email prefix
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
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    generated_display_id,
    NEW.email,
    user_full_name,
    NEW.raw_user_meta_data->>'photo_url',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Create Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create Conversation Participants Table
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_user ON public.conversation_participants(user_id);

-- 6. Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- 7. Create Friend Requests Table
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

-- 8. Create Friends Table
CREATE TABLE IF NOT EXISTS public.friends (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, friend_id)
);

-- 9. Storage Setup: Ensure 'soul-x' Bucket Exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('soul-x', 'soul-x', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- 10.1 Profiles Policies
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- 10.2 Conversations & Participants Policies
CREATE POLICY "Participants can view their conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view participants in their conversations"
  ON public.conversation_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join or add participants to their conversations"
  ON public.conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can leave conversations"
  ON public.conversation_participants FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 10.3 Messages Policies
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their conversations"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own messages"
  ON public.messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

-- 10.4 Friend Requests Policies
CREATE POLICY "Users can view their received or sent friend requests"
  ON public.friend_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send friend requests"
  ON public.friend_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update received friend requests"
  ON public.friend_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id)
  WITH CHECK (auth.uid() = receiver_id OR auth.uid() = sender_id);

CREATE POLICY "Users can delete their friend requests"
  ON public.friend_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 10.5 Friends Policies
CREATE POLICY "Users can view their friends"
  ON public.friends FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert their friendships"
  ON public.friends FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their friendships"
  ON public.friends FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ==============================================================================
-- 11. STORAGE RLS POLICIES FOR 'soul-x' BUCKET
-- Strictly enforce user isolation: A user CANNOT update, overwrite or delete another user's avatar.
-- ==============================================================================
CREATE POLICY "Public Access for Soul-X Avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'soul-x');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'soul-x' AND
    (
      auth.uid() = owner OR
      name LIKE 'avatars/' || auth.uid()::text || '-%' OR
      name LIKE 'avatars/' || auth.uid()::text || '/%'
    )
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'soul-x' AND
    (
      auth.uid() = owner OR
      name LIKE 'avatars/' || auth.uid()::text || '-%' OR
      name LIKE 'avatars/' || auth.uid()::text || '/%'
    )
  )
  WITH CHECK (
    bucket_id = 'soul-x' AND
    (
      auth.uid() = owner OR
      name LIKE 'avatars/' || auth.uid()::text || '-%' OR
      name LIKE 'avatars/' || auth.uid()::text || '/%'
    )
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'soul-x' AND
    (
      auth.uid() = owner OR
      name LIKE 'avatars/' || auth.uid()::text || '-%' OR
      name LIKE 'avatars/' || auth.uid()::text || '/%'
    )
  );

-- ==============================================================================
-- 12. AGENTS, AGENCY WITHDRAWALS, TRANSACTIONS & TOMBSTONES
-- Ensures full persistence of admin panel modifications across all deployments
-- ==============================================================================

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

CREATE TABLE IF NOT EXISTS public.tombstones (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id)
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tombstones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public agents are viewable by anyone"
  ON public.agents FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage agents"
  ON public.agents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Agency withdrawals readable by authenticated"
  ON public.agency_withdrawals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Agency withdrawals insertable by authenticated"
  ON public.agency_withdrawals FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Agency withdrawals updatable by authenticated"
  ON public.agency_withdrawals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Agency transactions readable by authenticated"
  ON public.agency_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Agency transactions insertable by authenticated"
  ON public.agency_transactions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Tombstones readable by anyone"
  ON public.tombstones FOR SELECT USING (true);

CREATE POLICY "Tombstones insertable by authenticated"
  ON public.tombstones FOR INSERT TO authenticated WITH CHECK (true);

