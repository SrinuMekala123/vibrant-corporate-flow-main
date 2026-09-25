-- Add signature_data column to installations table
ALTER TABLE installations 
ADD COLUMN IF NOT EXISTS signature_data TEXT;

-- Add evidence_photos column if it doesn't exist
ALTER TABLE installations 
ADD COLUMN IF NOT EXISTS evidence_photos JSONB DEFAULT '[]'::jsonb;

-- Add equipment_model column if it doesn't exist
ALTER TABLE installations 
ADD COLUMN IF NOT EXISTS equipment_model TEXT;

-- Add testing_results column if it doesn't exist  
ALTER TABLE installations 
ADD COLUMN IF NOT EXISTS testing_results TEXT;

COMMENT ON COLUMN installations.signature_data IS 'Base64 encoded customer signature image';
COMMENT ON COLUMN installations.evidence_photos IS 'Array of photo URLs from installation';
COMMENT ON COLUMN installations.equipment_model IS 'Equipment model/make installed';
COMMENT ON COLUMN installations.testing_results IS 'Testing and calibration results';