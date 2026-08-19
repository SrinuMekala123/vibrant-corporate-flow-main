UPDATE public.profiles 
SET role = 'admin', 
    full_name = 'admin', 
    phone = '6302665874'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@brihaspathi.com');