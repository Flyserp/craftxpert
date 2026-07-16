-- AC Service subcategories
UPDATE public.service_subcategories SET icon = 'Snowflake' WHERE icon = '❄️' AND name = 'AC Repair';
UPDATE public.service_subcategories SET icon = 'Wind' WHERE icon = '🌬️' AND name = 'Duct Cleaning';
UPDATE public.service_subcategories SET icon = 'Flame' WHERE icon = '🔥' AND name = 'Heating Repair';
UPDATE public.service_subcategories SET icon = 'ThermometerSun' WHERE icon = '🌡️' AND name = 'Thermostat Install';

-- Appliance Repair subcategories
UPDATE public.service_subcategories SET icon = 'UtensilsCrossed' WHERE icon = '🍽️' AND name = 'Dishwasher Repair';
UPDATE public.service_subcategories SET icon = 'Flame' WHERE icon = '🔥' AND name = 'Oven & Stove Repair';
UPDATE public.service_subcategories SET icon = 'Refrigerator' WHERE icon = '❄️' AND name = 'Refrigerator Repair';
UPDATE public.service_subcategories SET icon = 'WashingMachine' WHERE icon = '👕' AND name = 'Washer & Dryer Repair';

-- Carpentry subcategories
UPDATE public.service_subcategories SET icon = 'Armchair' WHERE icon = '🪑' AND name = 'Custom Furniture';
UPDATE public.service_subcategories SET icon = 'Hammer' WHERE icon = '🏗️' AND name = 'Deck Building';
UPDATE public.service_subcategories SET icon = 'DoorOpen' WHERE icon = '🚪' AND name = 'Door & Window';
UPDATE public.service_subcategories SET icon = 'Ruler' WHERE icon = '📐' AND name = 'Trim & Molding';

-- Cleaning subcategories
UPDATE public.service_subcategories SET icon = 'Brush' WHERE icon = '🧹' AND name = 'Carpet Cleaning';
UPDATE public.service_subcategories SET icon = 'Sparkles' WHERE icon = '🧽' AND name = 'Deep Cleaning';
UPDATE public.service_subcategories SET icon = 'CookingPot' WHERE icon = '🍳' AND name = 'Kitchen Cleaning';
UPDATE public.service_subcategories SET icon = 'Blinds' WHERE icon = '🪟' AND name = 'Window Cleaning';

-- Electrical subcategories
UPDATE public.service_subcategories SET icon = 'Lightbulb' WHERE icon = '💡' AND name = 'Lighting Install';
UPDATE public.service_subcategories SET icon = 'Plug' WHERE icon = '🔌' AND name = 'Outlet & Switch';
UPDATE public.service_subcategories SET icon = 'Zap' WHERE icon = '⚡' AND name = 'Panel Upgrade';
UPDATE public.service_subcategories SET icon = 'CircuitBoard' WHERE icon = '🔗' AND name = 'Wiring & Rewiring';

-- Moving subcategories
UPDATE public.service_subcategories SET icon = 'Home' WHERE icon = '🏘️' AND name = 'Local Moving';
UPDATE public.service_subcategories SET icon = 'Truck' WHERE icon = '🚚' AND name = 'Long Distance';
UPDATE public.service_subcategories SET icon = 'PackageOpen' WHERE icon = '📦' AND name = 'Packing Service';
UPDATE public.service_subcategories SET icon = 'Warehouse' WHERE icon = '🏬' AND name = 'Storage';

-- Painting subcategories
UPDATE public.service_subcategories SET icon = 'Paintbrush' WHERE icon = '🗄️' AND name = 'Cabinet Refinish';
UPDATE public.service_subcategories SET icon = 'PaintBucket' WHERE icon = '🏠' AND name = 'Exterior Painting';
UPDATE public.service_subcategories SET icon = 'Palette' WHERE icon = '🖌️' AND name = 'Interior Painting';
UPDATE public.service_subcategories SET icon = 'Ratio' WHERE icon = '🎭' AND name = 'Wallpaper';

-- Plumbing subcategories
UPDATE public.service_subcategories SET icon = 'Heater' WHERE icon = '🔥' AND name = 'Water Heater';
UPDATE public.service_subcategories SET icon = 'Droplet' WHERE icon = '🚰' AND name = 'Drain Cleaning';
UPDATE public.service_subcategories SET icon = 'Wrench' WHERE icon = '🔧' AND name = 'Leak Repair';
UPDATE public.service_subcategories SET icon = 'Pipette' WHERE icon = '🔩' AND name = 'Pipe Installation';

-- Also fix Pest Control "MousePointer" to a better icon
UPDATE public.service_subcategories SET icon = 'PawPrint' WHERE icon = 'MousePointer' AND name = 'Rodent Control';