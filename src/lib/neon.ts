/**
 * Neon PostgreSQL Database Client & Types for Soul-X
 * Official integration for Neon serverless PostgreSQL (https://neon.tech)
 */

export interface NeonConfig {
  configured: boolean;
  databaseUrl: string;
  host?: string;
  database?: string;
  user?: string;
  ssl: boolean;
}

export interface NeonStatus {
  connected: boolean;
  version?: string;
  latencyMs?: number;
  tables?: {
    profiles: boolean;
    agents: boolean;
    friends: boolean;
    friend_requests: boolean;
    conversations: boolean;
    conversation_participants: boolean;
    messages: boolean;
    agency_withdrawals: boolean;
    agency_transactions: boolean;
    tombstones: boolean;
  };
  counts?: {
    profiles: number;
    agents: number;
    friends: number;
    friend_requests: number;
    conversations: number;
    messages: number;
    agency_withdrawals: number;
  };
  error?: string;
  host?: string;
  database?: string;
}

/**
 * Fetch current Neon configuration from backend
 */
export async function getNeonConfig(): Promise<NeonConfig> {
  try {
    const res = await fetch('/api/neon/config');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return {
      configured: false,
      databaseUrl: '',
      ssl: true,
    };
  }
}

/**
 * Test Neon live connection
 */
export async function testNeonConnection(databaseUrl?: string): Promise<NeonStatus> {
  try {
    const res = await fetch('/api/neon/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ databaseUrl }),
    });
    return await res.json();
  } catch (err: any) {
    return {
      connected: false,
      error: err?.message || 'Connection test failed',
    };
  }
}

/**
 * Save Neon connection string to server configuration
 */
export async function saveNeonConfig(databaseUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/neon/save-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ databaseUrl }),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to save Neon configuration',
    };
  }
}

/**
 * Execute automatic schema migration on Neon
 */
export async function runNeonMigration(): Promise<{ success: boolean; message: string; tablesCreated?: string[] }> {
  try {
    const res = await fetch('/api/neon/migrate', {
      method: 'POST',
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Migration request failed',
    };
  }
}

/**
 * Trigger bidirectional data synchronization with Neon
 */
export async function syncDataWithNeon(): Promise<{ success: boolean; message: string; counts?: any }> {
  try {
    const res = await fetch('/api/neon/sync', {
      method: 'POST',
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Sync request failed',
    };
  }
}
