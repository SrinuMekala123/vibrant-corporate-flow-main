-- Create whatsapp_logs audit table
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id TEXT,
  ticket_type TEXT DEFAULT 'complaint',
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  message_type TEXT,
  message_content TEXT,
  status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'failed', 'pending'
  error_details TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resend_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_ticket ON whatsapp_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status ON whatsapp_logs(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_sent_at ON whatsapp_logs(sent_at);

ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'whatsapp_logs' AND policyname = 'Allow all access to whatsapp_logs'
  ) THEN
    CREATE POLICY "Allow all access to whatsapp_logs" ON whatsapp_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
