-- Media Plans table for storing approved media plans and generated ad copy
CREATE TABLE IF NOT EXISTS public.media_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  blueprint_id uuid REFERENCES public.blueprints(id) ON DELETE SET NULL,
  title text NOT NULL,
  output jsonb NOT NULL,
  ad_copy jsonb,
  generation_metadata jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_media_plans_user_id ON public.media_plans(user_id);
CREATE INDEX idx_media_plans_blueprint_id ON public.media_plans(blueprint_id);
CREATE INDEX idx_media_plans_created_at ON public.media_plans(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_media_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER media_plans_updated_at
  BEFORE UPDATE ON public.media_plans
  FOR EACH ROW EXECUTE FUNCTION update_media_plans_updated_at();

-- RLS
ALTER TABLE public.media_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own media plans" ON public.media_plans
  FOR SELECT TO authenticated USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can insert own media plans" ON public.media_plans
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update own media plans" ON public.media_plans
  FOR UPDATE TO authenticated USING (user_id = auth.jwt() ->> 'sub')
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can delete own media plans" ON public.media_plans
  FOR DELETE TO authenticated USING (user_id = auth.jwt() ->> 'sub');
