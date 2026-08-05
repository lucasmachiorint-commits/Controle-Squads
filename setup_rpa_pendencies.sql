-- ==========================================================================
-- Migration: Tabela rpa_pendencies (Gestão de Pendências de Robôs em Produção)
-- Projeto: Controle de Squads (Supabase)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.rpa_pendencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  robo_name TEXT NOT NULL,                  -- Nome do Robô (ex: Robô de Conciliação, Extratos, etc.)
  title TEXT NOT NULL,                      -- Descrição resumida do problema / ocorrência
  responsible TEXT NOT NULL,                -- 'Redesign', 'Caio (Interno)', 'Ambos'
  status TEXT DEFAULT 'ABERTO',             -- 'ABERTO', 'EM_ANALISE', 'AGUARDANDO_PARCEIRO', 'RESOLVIDO'
  severity TEXT DEFAULT 'MEDIA',            -- 'BAIXA', 'MEDIA', 'ALTA', 'CRITICA'
  history_notes JSONB DEFAULT '[]'::jsonb,  -- Histórico de cobranças [{ date, author, text }]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.rpa_pendencies ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
DROP POLICY IF EXISTS "Acesso total para autenticados" ON public.rpa_pendencies;
CREATE POLICY "Acesso total para autenticados" ON public.rpa_pendencies FOR ALL USING (true);

-- Trigger para atualização automática de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_rpa_pendencies_updated_at ON public.rpa_pendencies;
CREATE TRIGGER tr_rpa_pendencies_updated_at
  BEFORE UPDATE ON public.rpa_pendencies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Comentários descritivos
COMMENT ON TABLE public.rpa_pendencies IS 'Pendências e incidentes de robôs em produção cobrados do parceiro (Redesign) e focal interno (Caio)';
