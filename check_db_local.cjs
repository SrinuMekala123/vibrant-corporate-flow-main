const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://nhqsaxrooysikwgydori.supabase.co";
const activeAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocXNheHJvb3lzaWt3Z3lkb3JpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NjY1OTYsImV4cCI6MjA5NjE0MjU5Nn0.oOrmMHf0kgyU3xHx0TN6UXRVfEoadJyeeZzgn-Crx_A";

const supabase = createClient(supabaseUrl, activeAnonKey);

async function run() {
  console.log("--- LATEST 5 NOTIFICATIONS ---");
  const { data: notifs, error: err1 } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (err1) {
    console.error('Error fetching notifications:', err1.message);
  } else {
    console.log(JSON.stringify(notifs, null, 2));
  }

  console.log("\n--- ADMIN PROFILES ---");
  const { data: admins, error: err2 } = await supabase
    .from('profiles')
    .select('id, email, role, full_name')
    .eq('role', 'admin');

  if (err2) {
    console.error('Error fetching admins:', err2.message);
  } else {
    console.log(JSON.stringify(admins, null, 2));
  }
}

run();
