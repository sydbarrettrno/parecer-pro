ALTER TYPE public.categoria_documento ADD VALUE IF NOT EXISTS 'DRENAGEM';
ALTER TYPE public.categoria_documento ADD VALUE IF NOT EXISTS 'CADASTRO_TOPOGRAFIA';
ALTER TYPE public.categoria_documento ADD VALUE IF NOT EXISTS 'URBANIZACAO_SINALIZACAO';

CREATE TABLE IF NOT EXISTS public.analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  escopo TEXT NOT NULL,
  score_confianca INTEGER NOT NULL,
  aprovado_minimo BOOLEAN NOT NULL DEFAULT false,
  resumo_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  arquivo_id UUID NOT NULL REFERENCES public.arquivos(id) ON DELETE CASCADE,
  nome_original TEXT NOT NULL,
  nome_normalizado TEXT NOT NULL,
  caminho_normalizado TEXT NOT NULL,
  extensao TEXT NOT NULL,
  diretorio TEXT NOT NULL DEFAULT '',
  suportado BOOLEAN NOT NULL DEFAULT true,
  avisos JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  arquivo_id UUID REFERENCES public.arquivos(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,
  valor TEXT NOT NULL,
  tipo_fonte TEXT NOT NULL,
  trecho TEXT,
  confianca TEXT NOT NULL DEFAULT 'media',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.validation_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  severidade TEXT NOT NULL,
  descricao TEXT NOT NULL,
  categoria_relacionada TEXT,
  arquivos_relacionados JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidencias JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to analysis_runs"
ON public.analysis_runs FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to document_inventory"
ON public.document_inventory FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to document_evidences"
ON public.document_evidences FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to validation_findings"
ON public.validation_findings FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_processo_id ON public.analysis_runs(processo_id);
CREATE INDEX IF NOT EXISTS idx_document_inventory_processo_id ON public.document_inventory(processo_id);
CREATE INDEX IF NOT EXISTS idx_document_evidences_processo_id ON public.document_evidences(processo_id);
CREATE INDEX IF NOT EXISTS idx_validation_findings_processo_id ON public.validation_findings(processo_id);
