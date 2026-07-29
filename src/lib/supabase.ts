import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as any).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || 'https://xyzcompany.supabase.co';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || 'public-anon-key-placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function consultarCardsJiraEdgeFunction() {
  try {
    const response = await fetch('/api/jira/consultar-cards-jira');
    if (response.ok) {
      const json = await response.json();
      return json.cards || json.data || [];
    }
    console.warn('Proxy local retornou status não OK ao consultar Jira:', response.statusText);
    return [];
  } catch (err) {
    console.error('Erro ao consultar cards do Jira via proxy local:', err);
    return [];
  }
}
