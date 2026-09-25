-- Add rework and follow-up columns to installations table
ALTER TABLE installations 
ADD COLUMN IF NOT EXISTS rework_reason TEXT;

ALTER TABLE installations 
ADD COLUMN IF NOT EXISTS followup_reason TEXT;

ALTER TABLE installations 
ADD COLUMN IF NOT EXISTS followup_scheduled_date DATE;

COMMENT ON COLUMN installations.rework_reason IS 'Reason for returning installation for rework';
COMMENT ON COLUMN installations.followup_reason IS 'Reason for scheduling follow-up visit';
COMMENT ON COLUMN installations.followup_scheduled_date IS 'Date scheduled for follow-up visit';