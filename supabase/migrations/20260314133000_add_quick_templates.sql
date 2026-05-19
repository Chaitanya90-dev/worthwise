CREATE TABLE IF NOT EXISTS quick_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('expense', 'income')),
  amount NUMERIC(12, 2),
  merchant TEXT,
  notes TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, name, transaction_type)
);

ALTER TABLE quick_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Quick templates are user-owned" ON quick_templates;
CREATE POLICY "Quick templates are user-owned" ON quick_templates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS prevent_readonly_writes_quick_templates ON quick_templates;
CREATE TRIGGER prevent_readonly_writes_quick_templates
  BEFORE INSERT OR UPDATE OR DELETE ON quick_templates
  FOR EACH ROW EXECUTE FUNCTION prevent_readonly_writes();
