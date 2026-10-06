-- Migration: Add rework_history and reassignment columns to complaints table
ALTER TABLE complaints 
ADD COLUMN IF NOT EXISTS rework_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS reassignment_reason TEXT,
ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMPTZ;

COMMENT ON COLUMN complaints.rework_history IS 'Stores immutable historical snapshots of each rework round (Round 1, Round 2) including technician name, PIR findings, resolution notes, evidence files, and QA rejection feedback.';

