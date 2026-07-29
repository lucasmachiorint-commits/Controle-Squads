import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as any).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || 'https://xyzcompany.supabase.co';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || 'public-anon-key-placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function consultarCardsJiraEdgeFunction() {
  try {
    const { data, error } = await supabase.functions.invoke('consultar-cards-jira');
    if (error) {
      console.warn('Supabase functions.invoke notice:', error);
      // Fallback to local server proxy if Edge function is not provisioned or returns error
      const response = await fetch('/api/jira/consultar-cards-jira');
      if (response.ok) {
        const json = await response.json();
        return json.cards || json.data || [];
      }
      return [];
    }
    return data?.cards || data?.data || (Array.isArray(data) ? data : []);
  } catch (err) {
    console.warn('Fallback para proxy local ao chamar consultar-cards-jira:', err);
    try {
      const response = await fetch('/api/jira/consultar-cards-jira');
      if (response.ok) {
        const json = await response.json();
        return json.cards || json.data || [];
      }
    } catch (e) {
      console.error('Erro geral ao consultar cards do Jira:', e);
    }
    return [];
  }
}
