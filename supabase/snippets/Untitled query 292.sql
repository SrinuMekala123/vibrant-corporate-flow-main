-- ==========================================
-- 1. BRANCHES POLICY (Everyone can view for dropdowns)
-- ==========================================
DROP POLICY IF EXISTS "Allow all to view branches" ON branches;
CREATE POLICY "Everyone can view branches" ON branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage branches" ON branches FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ==========================================
-- 2. CUSTOMERS POLICY (Strict Role-Based Access)
-- ==========================================
DROP POLICY IF EXISTS "Admins and Supervisors manage customers" ON customers;
DROP POLICY IF EXISTS "Technicians view customers" ON customers;
DROP POLICY IF EXISTS "Customers view own profile" ON customers;

-- Admins: Full Access (Add, Edit, Delete, View)
CREATE POLICY "Admins full access customers" ON customers FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Supervisors: Can Add, Edit, View (Cannot Delete)
CREATE POLICY "Supervisors insert/update customers" ON customers FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor'));
CREATE POLICY "Supervisors update customers" ON customers FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor'));
CREATE POLICY "Supervisors view customers" ON customers FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor'));

-- Technicians: View Only
CREATE POLICY "Technicians view customers" ON customers FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician'));

-- Customers: View ONLY their own data
CREATE POLICY "Customers view own customers" ON customers FOR SELECT TO authenticated 
USING (user_id = auth.uid());

-- ==========================================
-- 3. CUSTOMER ASSETS POLICY (Strict Role-Based Access)
-- ==========================================
DROP POLICY IF EXISTS "Admins and Supervisors manage assets" ON customer_assets;
DROP POLICY IF EXISTS "Technicians view assets" ON customer_assets;
DROP POLICY IF EXISTS "Customers view own assets" ON customer_assets;

-- Admins: Full Access
CREATE POLICY "Admins full access assets" ON customer_assets FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Supervisors: Can Add, Edit, View (Cannot Delete)
CREATE POLICY "Supervisors insert assets" ON customer_assets FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor'));
CREATE POLICY "Supervisors update assets" ON customer_assets FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor'));
CREATE POLICY "Supervisors view assets" ON customer_assets FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor'));

-- Technicians: View Only (Needed to see what equipment they are fixing)
CREATE POLICY "Technicians view assets" ON customer_assets FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician'));

-- Customers: View ONLY their own assets
CREATE POLICY "Customers view own assets" ON customer_assets FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM customers 
    WHERE customers.id = customer_assets.customer_id 
    AND customers.user_id = auth.uid()
  )
);