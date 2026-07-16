import {
  Droplet, Zap, Sparkles, PaintBucket, Hammer, Truck, Wrench, Wind, Lock, Leaf,
  Snowflake, Package, Bug, Home, ShieldCheck, Fence, Sofa, SprayCan, Scissors,
  Car, Dog, Baby, Dumbbell, UtensilsCrossed, Camera, Music, MonitorSmartphone,
  Shirt, FlameKindling, Waves, TreePine, Aperture, Lightbulb, Plug, CircuitBoard,
  Pipette, ShowerHead, Paintbrush, Brush, Palette, Armchair, BedDouble, DoorOpen,
  PackageOpen, TruckIcon, Boxes, HandHelping, ThermometerSun, Fan, AirVent,
  // ── New additions ──
  Wifi, Globe, Heart, Star, Sun, Moon, Cloud, CloudRain, Umbrella, Flame,
  Anchor, Compass, Map, MapPin, Navigation, Phone, Mail, MessageCircle,
  Bell, Calendar, Clock, Timer, Watch, Key, Shield, Award, Trophy,
  Gift, ShoppingCart, ShoppingBag, CreditCard, Wallet, Banknote,
  Building, Building2, Store, Warehouse, Factory, Church, School,
  Hospital, Landmark, Castle, Tent, Mountain, Trees, Flower, Flower2,
  Apple, Cherry, Grape, Citrus, Salad, Coffee, Wine, Beer, IceCreamCone,
  Plane, Ship, Bike, Bus, Train, Rocket, Sailboat,
  Tv, Radio, Headphones, Speaker, Gamepad2, Laptop, Printer, Cpu,
  HardDrive, Smartphone, Tablet, Watch as WatchIcon,
  Stethoscope, Syringe, Pill, Activity, HeartPulse, Brain, Eye,
  GraduationCap, BookOpen, Library, Pen, PenTool, Ruler, Eraser, Highlighter,
  Scissors as ScissorsIcon, Paperclip, FileText, FolderOpen,
  Hammer as HammerIcon, Axe, Shovel, Drill, Nut, Cog, Settings, SlidersHorizontal,
  Recycle, Trash2, Leaf as LeafIcon, Sprout, Vegan,
  PawPrint, Cat, Bird, Fish, Rabbit, Squirrel,
  Volleyball, Dumbbell as DumbbellIcon, Medal, Footprints,
  Bed, Bath, Lamp, Refrigerator, WashingMachine, Microwave, CookingPot,
  Heater, Blinds, Ratio,
  type LucideIcon,
} from "lucide-react";

// Helper to build entries concisely
const e = (name: string, icon: LucideIcon) => ({ name, icon });

// All icons available for category/subcategory selection (~150 icons)
export const LUCIDE_ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  // ── Home & Building ──
  e("Home", Home), e("Building", Building), e("Building2", Building2), e("Store", Store),
  e("Warehouse", Warehouse), e("Factory", Factory), e("Church", Church), e("School", School),
  e("Hospital", Hospital), e("Landmark", Landmark), e("Castle", Castle), e("Tent", Tent),
  e("DoorOpen", DoorOpen), e("Fence", Fence),

  // ── Tools & Construction ──
  e("Hammer", Hammer), e("Wrench", Wrench), e("Drill", Drill), e("Axe", Axe),
  e("Shovel", Shovel), e("Nut", Nut), e("Cog", Cog), e("Settings", Settings),
  e("SlidersHorizontal", SlidersHorizontal), e("Ruler", Ruler),

  // ── Cleaning & Maintenance ──
  e("Sparkles", Sparkles), e("SprayCan", SprayCan), e("Brush", Brush),
  e("Paintbrush", Paintbrush), e("PaintBucket", PaintBucket), e("Palette", Palette),
  e("Recycle", Recycle), e("Trash2", Trash2),

  // ── Plumbing & HVAC ──
  e("Droplet", Droplet), e("ShowerHead", ShowerHead), e("Pipette", Pipette),
  e("Waves", Waves), e("Fan", Fan), e("AirVent", AirVent), e("Wind", Wind),
  e("ThermometerSun", ThermometerSun), e("Heater", Heater), e("Snowflake", Snowflake),
  e("Blinds", Blinds),

  // ── Electrical & Tech ──
  e("Zap", Zap), e("Lightbulb", Lightbulb), e("Plug", Plug), e("CircuitBoard", CircuitBoard),
  e("Wifi", Wifi), e("Cpu", Cpu), e("HardDrive", HardDrive), e("Printer", Printer),
  e("MonitorSmartphone", MonitorSmartphone), e("Laptop", Laptop), e("Smartphone", Smartphone),
  e("Tablet", Tablet), e("Tv", Tv), e("Radio", Radio), e("Speaker", Speaker),
  e("Headphones", Headphones), e("Gamepad2", Gamepad2),

  // ── Security ──
  e("Lock", Lock), e("Key", Key), e("Shield", Shield), e("ShieldCheck", ShieldCheck),

  // ── Outdoor & Garden ──
  e("Leaf", Leaf), e("TreePine", TreePine), e("Trees", Trees), e("Sprout", Sprout),
  e("Flower", Flower), e("Flower2", Flower2), e("Mountain", Mountain),
  e("Sun", Sun), e("Moon", Moon), e("Cloud", Cloud), e("CloudRain", CloudRain),
  e("Umbrella", Umbrella), e("Flame", Flame), e("FlameKindling", FlameKindling),

  // ── Transport ──
  e("Car", Car), e("Truck", Truck), e("Bus", Bus), e("Train", Train),
  e("Bike", Bike), e("Plane", Plane), e("Ship", Ship), e("Sailboat", Sailboat),
  e("Rocket", Rocket),

  // ── Furniture & Interior ──
  e("Sofa", Sofa), e("Armchair", Armchair), e("BedDouble", BedDouble), e("Bed", Bed),
  e("Bath", Bath), e("Lamp", Lamp),

  // ── Kitchen & Appliances ──
  e("Refrigerator", Refrigerator), e("WashingMachine", WashingMachine),
  e("Microwave", Microwave), e("CookingPot", CookingPot),
  e("UtensilsCrossed", UtensilsCrossed), e("Coffee", Coffee),

  // ── Food & Drink ──
  e("Apple", Apple), e("Cherry", Cherry), e("Grape", Grape), e("Citrus", Citrus),
  e("Salad", Salad), e("Wine", Wine), e("Beer", Beer), e("IceCreamCone", IceCreamCone),

  // ── Animals ──
  e("Dog", Dog), e("Cat", Cat), e("Bird", Bird), e("Fish", Fish),
  e("Rabbit", Rabbit), e("Squirrel", Squirrel), e("PawPrint", PawPrint), e("Bug", Bug),

  // ── People & Lifestyle ──
  e("Baby", Baby), e("Dumbbell", Dumbbell), e("Volleyball", Volleyball),
  e("Medal", Medal), e("Footprints", Footprints), e("Scissors", Scissors),
  e("Shirt", Shirt),

  // ── Health & Medical ──
  e("Stethoscope", Stethoscope), e("Syringe", Syringe), e("Pill", Pill),
  e("Activity", Activity), e("HeartPulse", HeartPulse), e("Brain", Brain), e("Eye", Eye),

  // ── Education & Office ──
  e("GraduationCap", GraduationCap), e("BookOpen", BookOpen), e("Library", Library),
  e("Pen", Pen), e("PenTool", PenTool), e("Eraser", Eraser), e("Highlighter", Highlighter),
  e("Paperclip", Paperclip), e("FileText", FileText), e("FolderOpen", FolderOpen),

  // ── Communication ──
  e("Phone", Phone), e("Mail", Mail), e("MessageCircle", MessageCircle),
  e("Bell", Bell), e("Globe", Globe),

  // ── Photography & Media ──
  e("Camera", Camera), e("Aperture", Aperture), e("Music", Music),

  // ── Shopping & Finance ──
  e("ShoppingCart", ShoppingCart), e("ShoppingBag", ShoppingBag),
  e("CreditCard", CreditCard), e("Wallet", Wallet), e("Banknote", Banknote),

  // ── Rewards & Misc ──
  e("Heart", Heart), e("Star", Star), e("Award", Award), e("Trophy", Trophy),
  e("Gift", Gift), e("Calendar", Calendar), e("Clock", Clock), e("Timer", Timer),
  e("Watch", Watch), e("Compass", Compass), e("Map", Map), e("MapPin", MapPin),
  e("Navigation", Navigation), e("Anchor", Anchor), e("HandHelping", HandHelping),

  // ── Packaging ──
  e("Package", Package), e("PackageOpen", PackageOpen), e("Boxes", Boxes),
];

// Quick lookup map: icon name → LucideIcon component
export const ICON_LOOKUP: Record<string, LucideIcon> = Object.fromEntries(
  LUCIDE_ICON_OPTIONS.map((o) => [o.name, o.icon])
);

/** Get a Lucide icon component by its stored name. Falls back to Package. */
export function getCategoryIcon(iconName: string | null | undefined): LucideIcon {
  if (!iconName) return Package;
  return ICON_LOOKUP[iconName] || Package;
}

// Track which categories we've already warned about to avoid console spam.
const _warnedMissingIcons = new Set<string>();

/**
 * Returns true when a category has no usable icon configured
 * (null/empty value, or a name not present in ICON_LOOKUP).
 * Emits a one-time console.warn per category to surface data issues.
 */
export function isCategoryIconMissing(
  iconName: string | null | undefined,
  categoryLabel?: string,
): boolean {
  const missing = !iconName || !ICON_LOOKUP[iconName];
  if (missing) {
    const key = `${categoryLabel ?? "?"}::${iconName ?? "<null>"}`;
    if (!_warnedMissingIcons.has(key)) {
      _warnedMissingIcons.add(key);
      // eslint-disable-next-line no-console
      console.warn(
        `[categoryIcons] Missing icon for category "${categoryLabel ?? "(unknown)"}" (stored value: ${iconName ?? "null"}). Falling back to Package.`,
      );
    }
  }
  return missing;
}
