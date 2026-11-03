-- ==============================================================================
-- Soul-X Migration: Agents, Agency Withdrawals, Transactions & Tombstones
-- Persistent database storage ensuring admin modifications persist across deployments
-- ==============================================================================

-- 1. Create Agents Table
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

-- 2. Create Agency Withdrawals Table
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

CREATE INDEX IF NOT EXISTS idx_agency_withdrawals_agent ON public.agency_withdrawals(agent_id);
CREATE INDEX IF NOT EXISTS idx_agency_withdrawals_status ON public.agency_withdrawals(status);

-- 3. Create Agency Transactions Table
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

CREATE INDEX IF NOT EXISTS idx_agency_tx_agent ON public.agency_transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agency_tx_target ON public.agency_transactions(target_user_id);

-- 4. Create Tombstones Table (Preserves deletions across deployments and container rebuilds)
CREATE TABLE IF NOT EXISTS public.tombstones (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_tombstones_type_id ON public.tombstones(entity_type, entity_id);

-- 5. Row Level Security (RLS) Policies
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tombstones ENABLE ROW LEVEL SECURITY;

-- Agents Policies: Public read for active agents, full access for authenticated/admin
CREATE POLICY "Public agents are viewable by anyone"
  ON public.agents FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage agents"
  ON public.agents FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Agency Withdrawals Policies
CREATE POLICY "Agency withdrawals readable by authenticated"
  ON public.agency_withdrawals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agency withdrawals insertable by authenticated"
  ON public.agency_withdrawals FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Agency withdrawals updatable by authenticated"
  ON public.agency_withdrawals FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Agency Transactions Policies
CREATE POLICY "Agency transactions readable by authenticated"
  ON public.agency_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agency transactions insertable by authenticated"
  ON public.agency_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Tombstones Policies
CREATE POLICY "Tombstones readable by anyone"
  ON public.tombstones FOR SELECT
  USING (true);

CREATE POLICY "Tombstones insertable by authenticated"
  ON public.tombstones FOR INSERT
  TO authenticated
  WITH CHECK (true);
