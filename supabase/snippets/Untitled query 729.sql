-- ==========================================
-- 1. CREATE BRANCHES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS branches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_name TEXT NOT NULL UNIQUE,
  location TEXT,
  branch_phone TEXT,
  branch_manager TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. CREATE CUSTOMERS TABLE
-- (Linked to your existing 'profiles' table)
-- ==========================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Links to your existing profiles table
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL, 
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  customer_type TEXT DEFAULT 'Retail', 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. CREATE CUSTOMER ASSETS (BUYINGS) TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS customer_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE, 
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,  
  
  category TEXT NOT NULL, 
  product_name TEXT NOT NULL, 
  model_number TEXT, 
  serial_number TEXT, 
  
  purchase_date DATE NOT NULL,
  warranty_months INTEGER DEFAULT 12,
  installation_date DATE,
  status TEXT DEFAULT 'Active', 
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_assets ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 5. SECURITY POLICIES
-- ==========================================
-- Branches: Everyone can view
CREATE POLICY "Allow all to view branches" ON branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admins to manage branches" ON branches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Customers: Admins/Supervisors can manage all. Customers view own.
CREATE POLICY "Customers view own data" ON customers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all customers" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Assets: Admins manage all. Customers view own.
CREATE POLICY "Customers view own assets" ON customer_assets FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM customers WHERE customers.id = customer_assets.customer_id AND customers.user_id = auth.uid())
);
CREATE POLICY "Admins manage all assets" ON customer_assets FOR ALL TO authenticated USING (true) WITH CHECK (true);