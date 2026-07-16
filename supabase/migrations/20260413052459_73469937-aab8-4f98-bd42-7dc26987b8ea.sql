
-- Create subcategories table
CREATE TABLE public.service_subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(category_id, slug)
);

-- Enable RLS
ALTER TABLE public.service_subcategories ENABLE ROW LEVEL SECURITY;

-- Viewable by everyone
CREATE POLICY "Subcategories are viewable by everyone"
ON public.service_subcategories
FOR SELECT
TO public
USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage subcategories"
ON public.service_subcategories
FOR ALL
TO public
USING (has_role(auth.uid(), 'admin'::app_role));

-- Moderators can manage subcategories
CREATE POLICY "Moderators can manage subcategories"
ON public.service_subcategories
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));

-- Seed subcategories for each category
INSERT INTO public.service_subcategories (category_id, name, slug, icon)
SELECT c.id, sub.name, sub.slug, sub.icon
FROM public.service_categories c
CROSS JOIN LATERAL (
  VALUES
    ('Leak Repair', 'leak-repair', 'Droplets'),
    ('Pipe Installation', 'pipe-installation', 'Wrench'),
    ('Drain Cleaning', 'drain-cleaning', 'Filter'),
    ('Water Heater', 'water-heater', 'Flame')
) AS sub(name, slug, icon)
WHERE c.name = 'Plumbing';

INSERT INTO public.service_subcategories (category_id, name, slug, icon)
SELECT c.id, sub.name, sub.slug, sub.icon
FROM public.service_categories c
CROSS JOIN LATERAL (
  VALUES
    ('Wiring & Rewiring', 'wiring-rewiring', 'Cable'),
    ('Panel Upgrade', 'panel-upgrade', 'Server'),
    ('Lighting Install', 'lighting-install', 'Lightbulb'),
    ('Outlet & Switch', 'outlet-switch', 'PlugZap')
) AS sub(name, slug, icon)
WHERE c.name = 'Electrical';

INSERT INTO public.service_subcategories (category_id, name, slug, icon)
SELECT c.id, sub.name, sub.slug, sub.icon
FROM public.service_categories c
CROSS JOIN LATERAL (
  VALUES
    ('Interior Painting', 'interior-painting', 'Paintbrush'),
    ('Exterior Painting', 'exterior-painting', 'Home'),
    ('Wallpaper', 'wallpaper', 'Layers'),
    ('Cabinet Refinish', 'cabinet-refinish', 'Square')
) AS sub(name, slug, icon)
WHERE c.name = 'Painting';

INSERT INTO public.service_subcategories (category_id, name, slug, icon)
SELECT c.id, sub.name, sub.slug, sub.icon
FROM public.service_categories c
CROSS JOIN LATERAL (
  VALUES
    ('Custom Furniture', 'custom-furniture', 'Armchair'),
    ('Deck Building', 'deck-building', 'Fence'),
    ('Door & Window', 'door-window', 'DoorOpen'),
    ('Trim & Molding', 'trim-molding', 'Ruler')
) AS sub(name, slug, icon)
WHERE c.name = 'Carpentry';

INSERT INTO public.service_subcategories (category_id, name, slug, icon)
SELECT c.id, sub.name, sub.slug, sub.icon
FROM public.service_categories c
CROSS JOIN LATERAL (
  VALUES
    ('AC Repair', 'ac-repair', 'Snowflake'),
    ('Heating Repair', 'heating-repair', 'Flame'),
    ('Duct Cleaning', 'duct-cleaning', 'Wind'),
    ('Thermostat Install', 'thermostat-install', 'Thermometer')
) AS sub(name, slug, icon)
WHERE c.name = 'HVAC';

INSERT INTO public.service_subcategories (category_id, name, slug, icon)
SELECT c.id, sub.name, sub.slug, sub.icon
FROM public.service_categories c
CROSS JOIN LATERAL (
  VALUES
    ('Local Moving', 'local-moving', 'MapPin'),
    ('Long Distance', 'long-distance', 'Map'),
    ('Packing Service', 'packing-service', 'Package'),
    ('Storage', 'storage', 'Warehouse')
) AS sub(name, slug, icon)
WHERE c.name = 'Moving';

INSERT INTO public.service_subcategories (category_id, name, slug, icon)
SELECT c.id, sub.name, sub.slug, sub.icon
FROM public.service_categories c
CROSS JOIN LATERAL (
  VALUES
    ('Lock Change', 'lock-change', 'KeyRound'),
    ('Lock Rekey', 'lock-rekey', 'Key'),
    ('Emergency Unlock', 'emergency-unlock', 'ShieldAlert'),
    ('Smart Locks', 'smart-locks', 'Smartphone')
) AS sub(name, slug, icon)
WHERE c.name = 'Locksmith';

INSERT INTO public.service_subcategories (category_id, name, slug, icon)
SELECT c.id, sub.name, sub.slug, sub.icon
FROM public.service_categories c
CROSS JOIN LATERAL (
  VALUES
    ('Lawn Care', 'lawn-care', 'Scissors'),
    ('Tree Service', 'tree-service', 'TreePine'),
    ('Garden Design', 'garden-design', 'Flower2'),
    ('Irrigation', 'irrigation', 'Droplets')
) AS sub(name, slug, icon)
WHERE c.name = 'Landscaping';
