-- Insert all official Brihaspathi Technologies Limited branches
INSERT INTO branches (branch_name, location, branch_phone, branch_manager) VALUES
('Hyderabad (Headquarters)', 'Shangrila Plaza, Banjara Hills, Hyderabad, Telangana 500034', NULL, NULL),
('Visakhapatnam', 'Visakhapatnam, Andhra Pradesh', NULL, NULL),
('Vijayawada', 'Vijayawada, Andhra Pradesh', NULL, NULL),
('Kurnool', 'Kurnool, Andhra Pradesh', NULL, NULL),
('Bengaluru', 'Bengaluru, Karnataka', NULL, NULL),
('Mumbai', 'CBD Belapur, Navi Mumbai, Maharashtra', NULL, NULL),
('Kolkata', 'Jawaharlal Nehru Road, West Bengal', NULL, NULL),
('Patna', 'Patna, Bihar', NULL, NULL),
('Guwahati', 'Guwahati, Assam', NULL, NULL),
('Bhopal', 'Rohit Nagar, Bawadiya Kala, Madhya Pradesh', NULL, NULL),
('Chennai', 'Chennai, Tamil Nadu', NULL, NULL),
('Shimla', 'Shimla, Himachal Pradesh', NULL, NULL),
('Chandigarh', 'Chandigarh', NULL, NULL),
('Delhi', 'Delhi', NULL, NULL),
('Lucknow', 'Lucknow, Uttar Pradesh', NULL, NULL)
ON CONFLICT (branch_name) DO NOTHING;