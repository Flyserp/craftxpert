
-- Seed sample providers with services (idempotent)
DO $$
DECLARE
  v_users JSONB := '[
    {"id":"11111111-1111-4111-8111-111111111101","email":"sample.plumber@demo.taskhive.app","name":"Marcus Reid","biz":"Reid & Sons Plumbing","bio":"Licensed master plumber with 15+ years of residential and commercial experience. Emergency callouts available.","avatar":"https://i.pravatar.cc/300?img=12","cat":"a2f7b411-9163-46dd-a4f5-026e0f58f028","sub":"e7a9dbb8-f78f-4acb-a514-bcdd44d8e3a4","title":"Emergency Plumbing & Leak Repair","desc":"Fast, reliable plumbing repairs — leaks, blockages, water heaters, and full bathroom fit-outs.","pmin":65,"pmax":120,"ptype":"hourly","skills":["Leak repair","Water heaters","Bathroom fit-out","Drain cleaning"],"exp":15,"lat":40.7128,"lng":-74.0060},
    {"id":"11111111-1111-4111-8111-111111111102","email":"sample.electrician@demo.taskhive.app","name":"Priya Anand","biz":"Voltline Electrical","bio":"Certified electrician specializing in smart home wiring, EV chargers, and safety inspections.","avatar":"https://i.pravatar.cc/300?img=47","cat":"a2f7b411-9163-46dd-a4f5-026e0f58f028","sub":"6fc95a57-b219-45e4-90ab-1bcad1c493f9","title":"Certified Electrician & EV Charger Install","desc":"Panel upgrades, EV chargers, lighting, and full rewires. Licensed and insured.","pmin":80,"pmax":150,"ptype":"hourly","skills":["EV chargers","Panel upgrades","Smart home","Rewiring"],"exp":10,"lat":34.0522,"lng":-118.2437},
    {"id":"11111111-1111-4111-8111-111111111103","email":"sample.cleaner@demo.taskhive.app","name":"Elena Fischer","biz":"Sparkle Home Cleaning","bio":"Detail-obsessed cleaning team using eco-friendly products. Weekly, deep, and move-out cleans.","avatar":"https://i.pravatar.cc/300?img=45","cat":"a2f7b411-9163-46dd-a4f5-026e0f58f028","sub":"c155f44e-fc46-4ab5-aa80-585d13dbbeb1","title":"Eco-Friendly Home & Office Cleaning","desc":"Recurring, deep-clean, and move-in/move-out packages using non-toxic products.","pmin":35,"pmax":60,"ptype":"hourly","skills":["Deep cleaning","Eco-friendly","Move-out","Office"],"exp":7,"lat":41.8781,"lng":-87.6298},
    {"id":"11111111-1111-4111-8111-111111111104","email":"sample.painter@demo.taskhive.app","name":"Diego Alvarez","biz":"Alvarez Fine Painting","bio":"Interior and exterior painting with a focus on clean lines and durable finishes.","avatar":"https://i.pravatar.cc/300?img=33","cat":"a2f7b411-9163-46dd-a4f5-026e0f58f028","sub":"d3cc8cdc-c7c0-4cc3-a75d-35f7a8e2eea9","title":"Interior & Exterior House Painting","desc":"Room refresh, full-house repaint, and cabinet finishing. Premium paints included.","pmin":350,"pmax":900,"ptype":"fixed","skills":["Interior","Exterior","Cabinet finishing","Color consult"],"exp":12,"lat":29.7604,"lng":-95.3698},
    {"id":"11111111-1111-4111-8111-111111111105","email":"sample.webdev@demo.taskhive.app","name":"Kenji Tanaka","biz":"Northline Digital","bio":"Full-stack web developer building fast, accessible sites for small businesses.","avatar":"https://i.pravatar.cc/300?img=68","cat":"bf60892d-864c-4fe5-829c-322ee5e55587","sub":"e024f3a8-643e-4ffd-8bf9-c96ddb29d928","title":"Website Development & Redesign","desc":"Modern marketing sites and web apps built with React, Next.js, and Tailwind.","pmin":900,"pmax":6000,"ptype":"fixed","skills":["React","Next.js","Tailwind","SEO"],"exp":9,"lat":47.6062,"lng":-122.3321},
    {"id":"11111111-1111-4111-8111-111111111106","email":"sample.photographer@demo.taskhive.app","name":"Amelia Chen","biz":"Chen Studio","bio":"Editorial and event photographer. Weddings, portraits, and brand campaigns.","avatar":"https://i.pravatar.cc/300?img=20","cat":"7f5ea8b0-daf0-45dc-8255-68a08580270d","sub":"a6c66d0e-da9f-494c-86da-152f53d79629","title":"Event & Portrait Photography","desc":"Half-day and full-day photo coverage with edited hi-res gallery delivery.","pmin":250,"pmax":1800,"ptype":"fixed","skills":["Events","Portraits","Weddings","Product"],"exp":8,"lat":37.7749,"lng":-122.4194},
    {"id":"11111111-1111-4111-8111-111111111107","email":"sample.hairstylist@demo.taskhive.app","name":"Zara Osei","biz":"Zara Cuts","bio":"Mobile stylist for cuts, color, and special-occasion styling. Salon-quality at home.","avatar":"https://i.pravatar.cc/300?img=49","cat":"7a8006b4-94a3-4904-8226-0d41a655117c","sub":"a0043c30-2800-45f6-86d8-a1870633a310","title":"Mobile Haircut & Color","desc":"On-location cut, color, blow-dry, and event styling packages.","pmin":45,"pmax":180,"ptype":"fixed","skills":["Cuts","Color","Blow-dry","Bridal"],"exp":6,"lat":33.7490,"lng":-84.3880},
    {"id":"11111111-1111-4111-8111-111111111108","email":"sample.mover@demo.taskhive.app","name":"Rasmus Berg","biz":"Berg Moving Co.","bio":"Two-person moving crew with truck. Local moves, packing, and furniture assembly.","avatar":"https://i.pravatar.cc/300?img=15","cat":"ed530066-6b25-4cde-9883-d0fa5ae460fe","sub":"423fc149-054d-455e-b9dd-393848744c5d","title":"Local Moving & Packing Service","desc":"Two movers + truck. Careful handling, blankets, and optional packing service.","pmin":95,"pmax":140,"ptype":"hourly","skills":["Local moves","Packing","Furniture assembly","Storage"],"exp":11,"lat":39.7392,"lng":-104.9903},
    {"id":"11111111-1111-4111-8111-111111111109","email":"sample.tutor@demo.taskhive.app","name":"Hana Novak","biz":"Novak Tutoring","bio":"K-12 and college math & science tutor. In-person and online sessions.","avatar":"https://i.pravatar.cc/300?img=26","cat":"f18ec286-2fa4-4850-9afc-d267b1bd9721","sub":"5ce480d2-3102-4d91-9ba8-9b540b428e6f","title":"Math & Science Tutoring","desc":"Personalized 1-on-1 tutoring for algebra, calculus, physics, and chemistry.","pmin":40,"pmax":75,"ptype":"hourly","skills":["Algebra","Calculus","Physics","Chemistry","SAT prep"],"exp":5,"lat":42.3601,"lng":-71.0589},
    {"id":"11111111-1111-4111-8111-111111111110","email":"sample.gardener@demo.taskhive.app","name":"Owen Blake","biz":"Blake Green Gardens","bio":"Landscape gardener designing low-maintenance, seasonal outdoor spaces.","avatar":"https://i.pravatar.cc/300?img=8","cat":"a2f7b411-9163-46dd-a4f5-026e0f58f028","sub":"20a43437-f793-4778-be9f-3ad9c910f204","title":"Garden Design & Maintenance","desc":"Seasonal maintenance, planting design, hedging, and lawn care packages.","pmin":55,"pmax":95,"ptype":"hourly","skills":["Planting","Hedging","Lawn care","Design"],"exp":13,"lat":45.5152,"lng":-122.6784}
  ]'::JSONB;
  v_rec JSONB;
  v_uid UUID;
BEGIN
  FOR v_rec IN SELECT * FROM jsonb_array_elements(v_users)
  LOOP
    v_uid := (v_rec->>'id')::uuid;

    -- Create auth user if missing
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_uid, 'authenticated', 'authenticated',
      v_rec->>'email',
      crypt('DemoPass!2026', gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers', ARRAY['email']),
      jsonb_build_object('display_name', v_rec->>'name'),
      now(), now(), '', '', '', ''
    ) ON CONFLICT (id) DO NOTHING;

    -- Identity row (required for email sign-in in some setups)
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', v_rec->>'email'),
      'email', v_rec->>'email', now(), now(), now())
    ON CONFLICT (provider, provider_id) DO NOTHING;

    -- Profile
    INSERT INTO public.profiles (
      user_id, display_name, avatar_url, bio, business_name, skills,
      experience_years, category_id, status, profile_completed, latitude, longitude
    ) VALUES (
      v_uid, v_rec->>'name', v_rec->>'avatar', v_rec->>'bio',
      v_rec->>'biz',
      ARRAY(SELECT jsonb_array_elements_text(v_rec->'skills')),
      (v_rec->>'exp')::int,
      (v_rec->>'cat')::uuid, 'active', true,
      (v_rec->>'lat')::double precision, (v_rec->>'lng')::double precision
    ) ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      business_name = EXCLUDED.business_name,
      bio = EXCLUDED.bio,
      avatar_url = EXCLUDED.avatar_url,
      skills = EXCLUDED.skills,
      experience_years = EXCLUDED.experience_years,
      category_id = EXCLUDED.category_id,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      profile_completed = true;

    -- Provider role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'provider'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Vendor service
    INSERT INTO public.vendor_services (
      vendor_id, category_id, subcategory_id, title, description,
      price_min, price_max, price_type, is_active
    )
    SELECT v_uid, (v_rec->>'cat')::uuid, (v_rec->>'sub')::uuid,
           v_rec->>'title', v_rec->>'desc',
           (v_rec->>'pmin')::numeric, (v_rec->>'pmax')::numeric,
           v_rec->>'ptype', true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.vendor_services
      WHERE vendor_id = v_uid AND title = v_rec->>'title'
    );
  END LOOP;
END $$;
