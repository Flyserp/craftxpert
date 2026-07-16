
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $seed$
DECLARE
  v_uid uuid;
  v_email text;
  v_pass text;
  v_role app_role;
  v_display text;
  v_business text;
  v_bio text;
  v_users jsonb := '[
    {"email":"admin@demo.com","pass":"Admin123!","role":"admin","name":"Alex Admin","biz":null,"bio":"Platform administrator"},
    {"email":"provider@demo.com","pass":"Provider123!","role":"provider","name":"Pat Provider","biz":"Pat''s Home Services","bio":"Trusted local pro with 10+ years experience."},
    {"email":"customer@demo.com","pass":"Customer123!","role":"customer","name":"Casey Customer","biz":null,"bio":"Homeowner looking for reliable help."},
    {"email":"employer@demo.com","pass":"Employer123!","role":"employer","name":"Erin Employer","biz":"Erin''s Property Group","bio":"Managing rental properties."},
    {"email":"vendor2@demo.com","pass":"Demo1234!","role":"provider","name":"Maria Lopez","biz":"SparkleClean Co","bio":"Professional cleaning specialist."},
    {"email":"vendor3@demo.com","pass":"Demo1234!","role":"provider","name":"Ravi Patel","biz":"Patel Plumbing","bio":"Licensed plumber, emergency calls."},
    {"email":"vendor4@demo.com","pass":"Demo1234!","role":"provider","name":"Sofia Chen","biz":"Chen Tutoring","bio":"Math and science tutor, K-12."},
    {"email":"customer2@demo.com","pass":"Demo1234!","role":"customer","name":"Jordan Smith","biz":null,"bio":null},
    {"email":"customer3@demo.com","pass":"Demo1234!","role":"customer","name":"Taylor Reed","biz":null,"bio":null},
    {"email":"customer4@demo.com","pass":"Demo1234!","role":"customer","name":"Morgan Lee","biz":null,"bio":null}
  ]'::jsonb;
  v_item jsonb;
  v_cats text[] := ARRAY['Cleaning','Plumbing','Electrical','Handyman','Moving','Landscaping','Tutoring','Beauty'];
  v_icons text[] := ARRAY['sparkles','wrench','zap','hammer','truck','trees','graduation-cap','scissors'];
  i int;

  admin_id uuid; provider_id uuid; customer_id uuid; employer_id uuid;
  vendor2_id uuid; vendor3_id uuid; vendor4_id uuid;
  customer2_id uuid; customer3_id uuid; customer4_id uuid;

  cat_clean uuid; cat_plumb uuid; cat_elec uuid; cat_hand uuid;
  cat_move uuid;  cat_land uuid;  cat_tut uuid;  cat_beauty uuid;

  svc uuid; bkg uuid;
BEGIN
  FOR i IN 1..array_length(v_cats,1) LOOP
    INSERT INTO public.service_categories (name, icon, sort_order)
    VALUES (v_cats[i], v_icons[i], i)
    ON CONFLICT (name) DO NOTHING;
  END LOOP;

  SELECT id INTO cat_clean  FROM public.service_categories WHERE name='Cleaning';
  SELECT id INTO cat_plumb  FROM public.service_categories WHERE name='Plumbing';
  SELECT id INTO cat_elec   FROM public.service_categories WHERE name='Electrical';
  SELECT id INTO cat_hand   FROM public.service_categories WHERE name='Handyman';
  SELECT id INTO cat_move   FROM public.service_categories WHERE name='Moving';
  SELECT id INTO cat_land   FROM public.service_categories WHERE name='Landscaping';
  SELECT id INTO cat_tut    FROM public.service_categories WHERE name='Tutoring';
  SELECT id INTO cat_beauty FROM public.service_categories WHERE name='Beauty';

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_users) LOOP
    v_email   := v_item->>'email';
    v_pass    := v_item->>'pass';
    v_role    := (v_item->>'role')::app_role;
    v_display := v_item->>'name';
    v_business:= v_item->>'biz';
    v_bio     := v_item->>'bio';

    SELECT id INTO v_uid FROM auth.users WHERE email = v_email;

    IF v_uid IS NULL THEN
      v_uid := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
        crypt(v_pass, gen_salt('bf')), now(),
        jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
        jsonb_build_object('display_name', v_display),
        now(), now(),
        '', '', '', ''
      );

      INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_uid, v_uid::text,
        jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
        'email', now(), now(), now()
      );
    END IF;

    INSERT INTO public.profiles (user_id, display_name, business_name, bio, profile_completed, category_id)
    VALUES (
      v_uid, v_display, v_business, v_bio, true,
      CASE WHEN v_role = 'provider' THEN cat_clean ELSE NULL END
    )
    ON CONFLICT (user_id) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          business_name = EXCLUDED.business_name,
          bio = EXCLUDED.bio,
          profile_completed = true;

    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, v_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    IF v_email = 'admin@demo.com'    THEN admin_id    := v_uid;
    ELSIF v_email = 'provider@demo.com' THEN provider_id := v_uid;
    ELSIF v_email = 'customer@demo.com' THEN customer_id := v_uid;
    ELSIF v_email = 'employer@demo.com' THEN employer_id := v_uid;
    ELSIF v_email = 'vendor2@demo.com'  THEN vendor2_id  := v_uid;
    ELSIF v_email = 'vendor3@demo.com'  THEN vendor3_id  := v_uid;
    ELSIF v_email = 'vendor4@demo.com'  THEN vendor4_id  := v_uid;
    ELSIF v_email = 'customer2@demo.com' THEN customer2_id := v_uid;
    ELSIF v_email = 'customer3@demo.com' THEN customer3_id := v_uid;
    ELSIF v_email = 'customer4@demo.com' THEN customer4_id := v_uid;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.vendor_services WHERE title LIKE 'Demo:%') THEN
    INSERT INTO public.vendor_services (vendor_id, category_id, title, description, price_min, price_max, price_type) VALUES
      (provider_id, cat_hand,  'Demo: General Handyman Hour', 'Any small repair around the house.',        45, 65, 'hourly'),
      (provider_id, cat_elec,  'Demo: Light Fixture Install', 'Swap out or install new light fixtures.',   80,150,'fixed'),
      (provider_id, cat_plumb, 'Demo: Leaky Faucet Repair',   'Fix drips, replace washers/cartridges.',    90,140,'fixed'),
      (provider_id, cat_move,  'Demo: 2-Hour Moving Help',    'Load/unload help for local moves.',        120,180,'fixed'),
      (vendor2_id,  cat_clean, 'Demo: Standard Home Cleaning','Kitchen, baths, dust, vacuum, mop.',        35, 45,'hourly'),
      (vendor2_id,  cat_clean, 'Demo: Deep Clean Package',    'Baseboards, inside appliances, detail.',   180,260,'fixed'),
      (vendor2_id,  cat_clean, 'Demo: Move-Out Cleaning',     'Empty-home turnkey cleaning.',             220,320,'fixed'),
      (vendor3_id,  cat_plumb, 'Demo: Water Heater Service',  'Flush, inspect, replace elements.',        150,300,'fixed'),
      (vendor3_id,  cat_plumb, 'Demo: Drain Unclogging',      'Kitchen or bath drain snaking.',            95,175,'fixed'),
      (vendor3_id,  cat_plumb, 'Demo: Emergency Plumber (hr)','24/7 emergency response.',                 120,160,'hourly'),
      (vendor4_id,  cat_tut,   'Demo: Math Tutoring (hr)',    'Algebra through calculus.',                 40, 60,'hourly'),
      (vendor4_id,  cat_tut,   'Demo: Science Tutoring (hr)', 'Physics, chemistry, biology.',              40, 60,'hourly'),
      (vendor4_id,  cat_tut,   'Demo: SAT/ACT Prep Session',  'Focused test-prep coaching.',               75,110,'hourly'),
      (vendor4_id,  cat_beauty,'Demo: In-Home Haircut',       'Adult haircut at your home.',               50, 80,'fixed'),
      (vendor4_id,  cat_land,  'Demo: Lawn Mow + Edge',       'Standard yard, front and back.',            60, 90,'fixed');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.vendor_services s ON s.id = b.service_id
    WHERE s.title LIKE 'Demo:%'
  ) THEN
    SELECT id INTO svc FROM vendor_services WHERE vendor_id = provider_id AND title LIKE 'Demo:%' ORDER BY created_at LIMIT 1;
    INSERT INTO bookings (customer_id, vendor_id, service_id, booking_date, start_time, end_time, status, total_price, subtotal, payment_status)
    VALUES (customer_id, provider_id, svc, current_date - 14, '10:00', '12:00', 'completed', 120, 120, 'paid') RETURNING id INTO bkg;
    INSERT INTO reviews (booking_id, customer_id, vendor_id, rating, comment)
    VALUES (bkg, customer_id, provider_id, 5, 'Fantastic work, showed up on time.');

    SELECT id INTO svc FROM vendor_services WHERE vendor_id = vendor2_id AND title LIKE 'Demo: Deep%' LIMIT 1;
    INSERT INTO bookings (customer_id, vendor_id, service_id, booking_date, start_time, end_time, status, total_price, subtotal, payment_status)
    VALUES (customer2_id, vendor2_id, svc, current_date - 10, '09:00', '13:00', 'completed', 220, 220, 'paid') RETURNING id INTO bkg;
    INSERT INTO reviews (booking_id, customer_id, vendor_id, rating, comment)
    VALUES (bkg, customer2_id, vendor2_id, 5, 'Sparkling clean, would rebook.');

    SELECT id INTO svc FROM vendor_services WHERE vendor_id = vendor3_id AND title LIKE 'Demo: Drain%' LIMIT 1;
    INSERT INTO bookings (customer_id, vendor_id, service_id, booking_date, start_time, end_time, status, total_price, subtotal, payment_status)
    VALUES (customer3_id, vendor3_id, svc, current_date - 7, '14:00', '15:30', 'completed', 120, 120, 'paid') RETURNING id INTO bkg;
    INSERT INTO reviews (booking_id, customer_id, vendor_id, rating, comment)
    VALUES (bkg, customer3_id, vendor3_id, 4, 'Fast and professional.');

    SELECT id INTO svc FROM vendor_services WHERE vendor_id = vendor4_id AND title LIKE 'Demo: Math%' LIMIT 1;
    INSERT INTO bookings (customer_id, vendor_id, service_id, booking_date, start_time, end_time, status, total_price, subtotal, payment_status)
    VALUES (customer4_id, vendor4_id, svc, current_date - 5, '16:00', '17:00', 'completed', 50, 50, 'paid') RETURNING id INTO bkg;
    INSERT INTO reviews (booking_id, customer_id, vendor_id, rating, comment)
    VALUES (bkg, customer4_id, vendor4_id, 5, 'My daughter loved the session.');

    SELECT id INTO svc FROM vendor_services WHERE vendor_id = provider_id AND title LIKE 'Demo: Light%' LIMIT 1;
    INSERT INTO bookings (customer_id, vendor_id, service_id, booking_date, start_time, end_time, status, total_price, subtotal, payment_status)
    VALUES (customer2_id, provider_id, svc, current_date - 3, '11:00', '12:30', 'completed', 100, 100, 'paid') RETURNING id INTO bkg;
    INSERT INTO reviews (booking_id, customer_id, vendor_id, rating, comment)
    VALUES (bkg, customer2_id, provider_id, 4, 'Good job, minor delay.');

    SELECT id INTO svc FROM vendor_services WHERE vendor_id = vendor2_id AND title LIKE 'Demo: Standard%' LIMIT 1;
    INSERT INTO bookings (customer_id, vendor_id, service_id, booking_date, start_time, end_time, status, total_price, subtotal, payment_status)
    VALUES (customer_id, vendor2_id, svc, current_date + 2, '10:00', '12:00', 'confirmed', 80, 80, 'paid');

    SELECT id INTO svc FROM vendor_services WHERE vendor_id = vendor3_id AND title LIKE 'Demo: Water%' LIMIT 1;
    INSERT INTO bookings (customer_id, vendor_id, service_id, booking_date, start_time, end_time, status, total_price, subtotal, payment_status)
    VALUES (customer_id, vendor3_id, svc, current_date + 4, '09:00', '11:00', 'confirmed', 200, 200, 'unpaid');

    SELECT id INTO svc FROM vendor_services WHERE vendor_id = vendor4_id AND title LIKE 'Demo: SAT%' LIMIT 1;
    INSERT INTO bookings (customer_id, vendor_id, service_id, booking_date, start_time, end_time, status, total_price, subtotal, payment_status)
    VALUES (customer3_id, vendor4_id, svc, current_date + 6, '15:00', '16:30', 'pending', 90, 90, 'unpaid');

    SELECT id INTO svc FROM vendor_services WHERE vendor_id = provider_id AND title LIKE 'Demo: 2-Hour%' LIMIT 1;
    INSERT INTO bookings (customer_id, vendor_id, service_id, booking_date, start_time, end_time, status, total_price, subtotal, payment_status)
    VALUES (customer4_id, provider_id, svc, current_date + 9, '08:00', '10:00', 'pending', 150, 150, 'unpaid');

    SELECT id INTO svc FROM vendor_services WHERE vendor_id = vendor2_id AND title LIKE 'Demo: Move%' LIMIT 1;
    INSERT INTO bookings (customer_id, vendor_id, service_id, booking_date, start_time, end_time, status, total_price, subtotal, payment_status)
    VALUES (customer2_id, vendor2_id, svc, current_date - 1, '13:00', '17:00', 'cancelled', 260, 260, 'unpaid');
  END IF;
END
$seed$;
