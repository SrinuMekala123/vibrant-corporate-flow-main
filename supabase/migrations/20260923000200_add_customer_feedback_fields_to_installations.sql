-- Add customer feedback columns to installations table
ALTER TABLE installations 
ADD COLUMN IF NOT EXISTS customer_feedback_comments TEXT;

ALTER TABLE installations 
ADD COLUMN IF NOT EXISTS customer_satisfaction TEXT;

COMMENT ON COLUMN installations.customer_feedback_comments IS 'Customer feedback comments from admin verification';
COMMENT ON COLUMN installations.customer_satisfaction IS 'Customer satisfaction level from admin verification';