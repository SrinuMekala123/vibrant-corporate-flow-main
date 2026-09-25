-- Ensure Hyderabad and Secunderabad branches exist for the customer create form.
-- Keep existing "Hyderabad (Headquarters)" if already seeded; do not duplicate.

INSERT INTO branches (branch_name, location, branch_phone, branch_manager)
SELECT
  'Hyderabad (Headquarters)',
  'Shangrila Plaza, Banjara Hills, Hyderabad, Telangana 500034',
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM branches WHERE branch_name ILIKE '%hyderabad%'
);

INSERT INTO branches (branch_name, location, branch_phone, branch_manager)
SELECT
  'Secunderabad',
  'Secunderabad, Telangana',
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM branches WHERE branch_name ILIKE 'secunderabad'
);
