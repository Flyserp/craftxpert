import { useState, useEffect } from"react";
import BookingSuccess from"@/components/booking/BookingSuccess";
import SmartProviderMatch from"@/components/booking/SmartProviderMatch";
import PaymentStep from"@/components/booking/PaymentStep";
import type { AppliedCouponData, TaxData } from"@/components/booking/PaymentStep";
import { getDepositPercentage, calcDeposit, DEFAULT_DEPOSIT_PERCENTAGE } from"@/lib/depositRate";
import { useNavigate, useSearchParams } from"react-router-dom";
import { useAuth } from"@/contexts/AuthContext";
import { supabase } from"@/integrations/supabase/client";
import { createNotification } from"@/lib/notifications";
import UnifiedHeader from"@/components/header/UnifiedHeader";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Calendar } from"@/components/ui/calendar";
import { toast } from"sonner";
import { format } from"date-fns";
import { cn } from"@/lib/utils";
import { usePagination } from"@/hooks/usePagination";
import NumberedPagination from"@/components/common/NumberedPagination";
import {
 ArrowLeft, ArrowRight, Check, Clock, MapPin, Star,
 User, CreditCard, CalendarDays, Briefcase, FileText, BadgeCheck,
} from"lucide-react";
import { Heading } from "@/components/ui/app";

/* ─── Types ─── */
interface ServiceCategory { id: string; name: string; icon: string | null; }
interface ProviderService {
 id: string; vendor_id: string; category_id: string; title: string;
 description: string | null; price_min: number | null; price_max: number | null; price_type: string; is_active: boolean;
}
interface VendorWithProfile {
 vendor_id: string; display_name: string | null; address: string | null;
 bio: string | null; avatar_url?: string | null; services: ProviderService[];
}
interface AvailabilitySlot { day_of_week: number; start_time: string; end_time: string; }

const STEPS = [
 { id: 1, label:"Provider", icon: User },
 { id: 2, label:"Date", icon: CalendarDays },
 { id: 3, label:"Time", icon: Clock },
 { id: 4, label:"Details", icon: FileText },
 { id: 5, label:"Pay", icon: CreditCard },
 { id: 6, label:"Done", icon: Check },
];

const BookService = () => {
 const { user } = useAuth();
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();
 const [step, setStep] = useState(1);

 // Data
 const [categories, setCategories] = useState<ServiceCategory[]>([]);
 const [vendors, setVendors] = useState<VendorWithProfile[]>([]);
 const [vendorSlots, setVendorSlots] = useState<AvailabilitySlot[]>([]);
 const [blockedDates, setBlockedDates] = useState<string[]>([]);
 const [bookedSlotsByDate, setBookedSlotsByDate] = useState<Record<string, Set<string>>>({});
 const [loading, setLoading] = useState(false);
 const [submitting, setSubmitting] = useState(false);

 // Selections
 const [selectedCategory, setSelectedCategory] = useState("");
 const [selectedDate, setSelectedDate] = useState<Date | undefined>();
 const [selectedTime, setSelectedTime] = useState("");
 const [selectedVendor, setSelectedVendor] = useState<VendorWithProfile | null>(null);
 const [selectedService, setSelectedService] = useState<ProviderService | null>(null);
 const [notes, setNotes] = useState("");
 const [customerAddress, setCustomerAddress] = useState("");
 const [paymentType, setPaymentType] = useState<"full" |"deposit">("full");
 const [bookingId, setBookingId] = useState<string | null>(null);
 const [appliedCoupon, setAppliedCoupon] = useState<AppliedCouponData | null>(null);
  const [taxData, setTaxData] = useState<TaxData>({ taxAmount: 0, taxRate: 0 });
 const [depositPct, setDepositPct] = useState<number>(DEFAULT_DEPOSIT_PERCENTAGE);

 // Resolve deposit percentage (category override or platform default)
 useEffect(() => {
   let cancelled = false;
   getDepositPercentage(selectedCategory || null).then((pct) => {
     if (!cancelled) setDepositPct(pct);
   });
   return () => { cancelled = true; };
 }, [selectedCategory]);

 // Load categories on mount + handle URL params
 useEffect(() => {
 supabase.from("service_categories").select("*").order("name").then(({ data }) => {
 if (data) setCategories(data);
 });
 const catParam = searchParams.get("category");
 const serviceParam = searchParams.get("service");
 // If a specific service is provided, derive category from it (overrides catParam)
 if (serviceParam) {
 supabase
 .from("vendor_services")
 .select("category_id")
 .eq("id", serviceParam)
 .maybeSingle()
 .then(({ data }) => {
 if (data?.category_id) setSelectedCategory(data.category_id);
 });
 } else if (catParam) {
 setSelectedCategory(catParam);
 }
 }, []);

 // Pre-select vendor (and specific service) from URL params once vendors load
 useEffect(() => {
 const providerParam = searchParams.get("provider");
 const serviceParam = searchParams.get("service");
 if (!providerParam || vendors.length === 0 || selectedVendor) return;

 const found = vendors.find((v) => v.vendor_id === providerParam);
 if (!found) return;

 setSelectedVendor(found);
 const preSelected = serviceParam
 ? found.services.find((s) => s.id === serviceParam) || found.services[0]
 : found.services[0];
 setSelectedService(preSelected || null);

 // Optional date/time prefill from query params (e.g., from provider profile sidebar)
 const dateParam = searchParams.get("date");
 const timeParam = searchParams.get("time");
 if (dateParam) {
 const d = new Date(`${dateParam}T00:00:00`);
 if (!isNaN(d.getTime())) setSelectedDate(d);
 }
 if (timeParam) setSelectedTime(timeParam);

 // Auto-advance past the Provider step when both vendor & service are pre-chosen
 if (preSelected) {
 // If full date+time is also prefilled, jump straight to confirmation
 if (dateParam && timeParam) setStep((s) => (s < 4 ? 4 : s));
 else if (dateParam) setStep((s) => (s < 3 ? 3 : s));
 else setStep((s) => (s === 1 ? 2 : s));
 }
 }, [vendors]);

 // When category selected, find vendors
 useEffect(() => {
 if (!selectedCategory) return;
 setLoading(true);
 setVendors([]);
 setSelectedVendor(null);
 setSelectedService(null);

 const fetchVendors = async () => {
 const { data: services } = await supabase
 .from("vendor_services")
 .select("*")
 .eq("category_id", selectedCategory)
 .eq("is_active", true);

 if (!services || services.length === 0) { setVendors([]); setLoading(false); return; }

 const providerIds = [...new Set(services.map((s) => s.vendor_id))];
 const { data: profiles } = await supabase
 .from("profiles")
 .select("user_id, display_name, address, bio, avatar_url")
 .in("user_id", providerIds);

 const vendorMap: Record<string, VendorWithProfile> = {};
 for (const p of profiles || []) {
 vendorMap[p.user_id] = {
 vendor_id: p.user_id, display_name: p.display_name,
 address: p.address, bio: p.bio, avatar_url: p.avatar_url,
 services: services.filter((s) => s.vendor_id === p.user_id),
 };
 }
 setVendors(Object.values(vendorMap));
 setLoading(false);
 };
 fetchVendors();
 }, [selectedCategory]);

 // Load availability + already-booked slots for selected vendor
 useEffect(() => {
 if (!selectedVendor) return;
 const fetchAvailability = async () => {
 const todayStr = format(new Date(),"yyyy-MM-dd");
 const [slotsRes, blockedRes, bookingsRes] = await Promise.all([
 supabase.from("vendor_availability").select("vendor_id, day_of_week, start_time, end_time")
 .eq("vendor_id", selectedVendor.vendor_id).eq("is_available", true),
 supabase.from("vendor_blocked_dates").select("vendor_id, blocked_date")
 .eq("vendor_id", selectedVendor.vendor_id),
 supabase.from("bookings").select("booking_date, start_time, status")
 .eq("vendor_id", selectedVendor.vendor_id)
 .gte("booking_date", todayStr)
 .neq("status","cancelled"),
 ]);
 if (slotsRes.data) setVendorSlots(slotsRes.data);
 if (blockedRes.data) setBlockedDates(blockedRes.data.map((d) => d.blocked_date));
 const map: Record<string, Set<string>> = {};
 (bookingsRes.data || []).forEach((b: any) => {
 const hh = (b.start_time as string).slice(0, 5);
 if (!map[b.booking_date]) map[b.booking_date] = new Set();
 map[b.booking_date].add(hh);
 });
 setBookedSlotsByDate(map);
 };
 fetchAvailability();
 }, [selectedVendor]);

 const availableDays = vendorSlots.map((s) => s.day_of_week);

 // All hourly slots the vendor *could* offer on a weekday (de-duped).
 const potentialSlotsForDay = (weekday: number) => {
 const out = new Set<string>();
 vendorSlots
 .filter((s) => s.day_of_week === weekday)
 .forEach((s) => {
 let [h, m] = s.start_time.split(":").map(Number);
 const [endH] = s.end_time.split(":").map(Number);
 while (h < endH) {
 out.add(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
 h += 1;
 }
 });
 return Array.from(out).sort();
 };

 const isDateFullyBooked = (date: Date) => {
 const potential = potentialSlotsForDay(date.getDay());
 if (potential.length === 0) return false;
 const taken = bookedSlotsByDate[format(date,"yyyy-MM-dd")];
 if (!taken) return false;
 return potential.every((t) => taken.has(t));
 };

 const isDateDisabled = (date: Date) => {
 if (date < new Date(new Date().toDateString())) return true;
 if (!availableDays.includes(date.getDay())) return true;
 if (blockedDates.includes(format(date,"yyyy-MM-dd"))) return true;
 if (isDateFullyBooked(date)) return true;
 return false;
 };

 const timeSlots = selectedDate
 ? potentialSlotsForDay(selectedDate.getDay()).filter((t) => {
 const taken = bookedSlotsByDate[format(selectedDate,"yyyy-MM-dd")];
 return !taken || !taken.has(t);
 })
 : [];

 const depositAmount = selectedService?.price_min ? calcDeposit(selectedService.price_min, depositPct) : null;
 const totalAmount = selectedService?.price_min || null;
 const payableAmount = paymentType ==="deposit" ? depositAmount : totalAmount;

 const handleSubmit = async () => {
 if (!user || !selectedVendor || !selectedService || !selectedDate || !selectedTime) return;
 setSubmitting(true);

 const [startH] = selectedTime.split(":").map(Number);
 const endTime =`${String(startH + 1).padStart(2,"0")}:00`;

 const subtotal = selectedService.price_min;
 const discountAmt = appliedCoupon?.discountAmount || 0;
 const priceAfterDiscount = subtotal ? Math.round((subtotal - discountAmt) * 100) / 100 : null;
 const finalPrice = priceAfterDiscount != null ? Math.round((priceAfterDiscount + taxData.taxAmount) * 100) / 100 : null;

 const { data, error } = await supabase.from("bookings").insert({
 customer_id: user.id,
 vendor_id: selectedVendor.vendor_id,
 service_id: selectedService.id,
 booking_date: format(selectedDate,"yyyy-MM-dd"),
 start_time: selectedTime,
 end_time: endTime,
 notes: notes.trim() || null,
 subtotal: subtotal,
 total_price: finalPrice,
 coupon_code: appliedCoupon?.code || null,
 discount_amount: discountAmt,
 tax_amount: taxData.taxAmount,
 tax_rate: taxData.taxRate,
 status:"pending",
 payment_status: paymentType ==="deposit" ?"deposit_paid" :"paid",
 }).select("id").single();

 setSubmitting(false);
 if (error) {
 toast.error("Failed to create booking. Please try again.");
 return;
 }

 setBookingId(data.id);

 // Notifications
 await Promise.all([
 createNotification({
 userId: selectedVendor.vendor_id,
 type:"booking_created",
 title:"New Booking Request",
 message:`${user.user_metadata?.display_name ||"A customer"} booked ${selectedService.title} on ${format(selectedDate,"MMM d, yyyy")} at ${selectedTime}.`,
 metadata: { service_id: selectedService.id },
 }),
 createNotification({
 userId: user.id,
 type:"booking_created",
 title:"Booking Confirmed!",
 message:`Your booking for ${selectedService.title} on ${format(selectedDate,"MMM d, yyyy")} has been submitted.`,
 metadata: { service_id: selectedService.id },
 }),
 // Render and send the saved booking_confirmation email template.
 supabase.functions.invoke("send-booking-email", {
 body: {
 templateKey:"booking_confirmation",
 recipientUserId: user.id,
 variables: {
 customer_name: user.user_metadata?.display_name ||"there",
 provider_name: selectedVendor.display_name ||"your provider",
 service_name: selectedService.title,
 booking_date: format(selectedDate,"MMM d, yyyy"),
 booking_time: selectedTime,
 booking_id: data.id,
 total_price: finalPrice != null ?`$${finalPrice.toFixed(2)}` :"",
 },
 },
 }).catch((e) => console.warn("Booking email send failed:", e)),
 ]);

 setStep(6);
 };

 const canProceed = () => {
 if (step === 1) return !!selectedCategory && !!selectedVendor && !!selectedService;
 if (step === 2) return !!selectedDate;
 if (step === 3) return !!selectedTime;
 if (step === 4) return true;
 return true;
 };

 const categoryName = categories.find((c) => c.id === selectedCategory)?.name;
 const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(vendors, 8);

 return (
 <div className="min-h-screen bg-muted/30">
 <UnifiedHeader />
 <main className="pb-16">
 <div className="container-app max-w-3xl">

 {/* Header */}
 {step < 6 && (
 <div className="mb-8 animate-reveal">
 <Heading level={1}  className="mb-1">Book a Service</Heading>
 <p className="text-body">Find the right professional and schedule your appointment.</p>
 </div>
 )}

 {/* Step indicator */}
 {step < 6 && (
 <div className="flex items-center gap-0.5 mb-8 overflow-x-auto pb-1 scrollbar-hide animate-reveal-delay-1">
 {STEPS.slice(0, 5).map((s, i) => (
 <div key={s.id} className="flex items-center">
 <button
 onClick={() => s.id < step && setStep(s.id)}
 disabled={s.id > step}
 className={cn(
"flex items-center gap-1.5 py-2 px-2.5 rounded-sm text-fs-xs font-medium transition-all duration-200 whitespace-nowrap",
 step === s.id
 ?"bg-primary text-primary-foreground"
 : s.id < step
 ?"bg-secondary text-secondary-foreground hover:bg-secondary/70 cursor-pointer"
 :"bg-muted text-muted-foreground cursor-not-allowed"
 )}
 >
 <s.icon className="w-3.5 h-3.5 shrink-0" />
 <span className="hidden sm:inline">{s.label}</span>
 </button>
 {i < 4 && (
 <div className={cn("w-3 h-px mx-0.5 shrink-0", s.id < step ?"bg-primary/40" :"bg-border")} />
 )}
 </div>
 ))}
 </div>
 )}

 {/* ─── Step 1: Choose Provider ─── */}
 {step === 1 && (
 <div className="animate-reveal-delay-2 space-y-6">
 <div>
 <Heading level={2}  className="mb-1">What do you need help with?</Heading>
 <p className="text-fs-sm text-muted-foreground mb-4">Select a category, then pick your professional.</p>

 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
 {categories.map((cat) => (
 <button
 key={cat.id}
 onClick={() => { setSelectedCategory(cat.id); setSelectedVendor(null); setSelectedService(null); }}
 className={cn(
"p-4 rounded-sm border text-left transition-all duration-200 active:scale-[0.97]",
 selectedCategory === cat.id
 ?"border-primary bg-primary/5"
 :"border-border/60 bg-card hover:border-primary/30"
 )}
 >
 <p className="text-fs-sm font-semibold text-heading">{cat.name}</p>
 </button>
 ))}
 </div>

 {/* Location input */}
 <div className="mb-6">
 <label className="flex items-center gap-1.5 text-fs-sm font-medium text-heading mb-2">
 <MapPin className="w-4 h-4 text-muted-foreground" />
 Your location <span className="text-fs-xs font-normal text-muted-foreground">(optional)</span>
 </label>
 <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value.slice(0, 200))}
 placeholder="e.g. 123 Main St, Austin, TX" maxLength={200} className="max-w-md" />
 </div>
 </div>

 {/* AI Smart Match */}
 {selectedCategory && (
 <div className="mb-4">
 <SmartProviderMatch
 categoryId={selectedCategory}
 customerAddress={customerAddress || undefined}
 onSelectVendor={(matched) => {
 const existing = vendors.find((v) => v.vendor_id === matched.vendor_id);
 if (existing) { setSelectedVendor(existing); setSelectedService(existing.services[0] || null); }
 else {
 const asVendor: VendorWithProfile = {
 vendor_id: matched.vendor_id, display_name: matched.display_name,
 address: matched.address, bio: matched.bio,
 services: matched.services.map((s) => ({ ...s, category_id: selectedCategory, description: null, is_active: true })),
 };
 setSelectedVendor(asVendor);
 setSelectedService(asVendor.services[0] || null);
 }
 }}
 />
 </div>
 )}

 {/* Vendor list */}
 {loading ? (
 <div className="space-y-3">
 {[1, 2].map((i) => <div key={i} className="h-32 bg-muted rounded-sm animate-pulse" />)}
 </div>
 ) : vendors.length === 0 && selectedCategory ? (
 <div className="text-center py-12 text-fs-sm text-muted-foreground">No providers found for this category.</div>
 ) : vendors.length > 0 ? (
 <div className="space-y-3">
 <p className="text-fs-xs font-medium text-muted-foreground">Or browse all providers:</p>
 {pageItems.map((v) => (
 <div key={v.vendor_id}>
 <button
 onClick={() => { setSelectedVendor(v); setSelectedService(v.services[0] || null); }}
 className={cn(
"w-full text-left p-5 rounded-sm border transition-all duration-200 active:scale-[0.99]",
 selectedVendor?.vendor_id === v.vendor_id
 ?"border-primary bg-primary/5"
 :"border-border/60 bg-card hover:border-primary/30"
 )}
 >
 <div className="flex items-start gap-4">
 <div className="w-12 h-12 rounded-sm bg-primary/10 overflow-hidden flex items-center justify-center text-fs-sm font-bold text-primary shrink-0">
 {v.avatar_url ? (
 <img src={v.avatar_url} alt="" className="w-full h-full object-cover" />
 ) : (
 (v.display_name ||"V").slice(0, 2).toUpperCase()
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1.5 mb-0.5">
 <p className="text-fs-sm font-semibold text-heading">{v.display_name ||"Provider"}</p>
 <BadgeCheck className="w-3.5 h-3.5 text-primary shrink-0" />
 </div>
 {v.address && (
 <p className="text-fs-xs text-muted-foreground flex items-center gap-1">
 <MapPin className="w-3 h-3" /> {v.address}
 </p>
 )}
 {v.bio && <p className="text-fs-xs text-body mt-1 line-clamp-2">{v.bio}</p>}
 <div className="flex flex-wrap gap-1.5 mt-2">
 {v.services.map((s) => (
 <span key={s.id} className="text-[10px] font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
 {s.title}{s.price_min ?` · $${s.price_min}` :""}{s.price_type ==="hourly" ?"/hr" :""}
 </span>
 ))}
 </div>
 </div>
 </div>
 </button>

 {/* Service picker */}
 {selectedVendor?.vendor_id === v.vendor_id && v.services.length > 1 && (
 <div className="mt-2 ml-16 space-y-1.5">
 <p className="text-fs-xs font-medium text-heading">Select service:</p>
 {v.services.map((s) => (
 <button key={s.id} onClick={() => setSelectedService(s)}
 className={cn("w-full text-left py-2 px-3 rounded-lg text-fs-sm transition-all duration-200",
 selectedService?.id === s.id ?"bg-primary/10 text-primary font-medium" :"bg-muted/50 text-body hover:bg-muted"
 )}>
 {s.title}
 {s.price_min && <span className="text-fs-xs text-muted-foreground ml-2">${s.price_min}{s.price_max ?`–$${s.price_max}` :""} / {s.price_type}</span>}
 </button>
 ))}
 </div>
 )}
 </div>
 ))}
 <NumberedPagination
 currentPage={page}
 totalPages={totalPages}
 totalItems={totalItems}
 pageSize={pageSize}
 onPageChange={setPage}
 onPageSizeChange={setPageSize}
 />
 </div>
 ) : null}
 </div>
 )}

 {/* ─── Step 2: Pick Date ─── */}
 {step === 2 && (
 <div className="animate-reveal-delay-2 space-y-4">
 <Heading level={2}  className="mb-1">Pick a date</Heading>
 <p className="text-fs-sm text-muted-foreground mb-2">
 Showing availability for <span className="font-medium text-heading">{selectedVendor?.display_name}</span>
 </p>

 {vendorSlots.length === 0 ? (
 <div className="text-center py-12">
 <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
 <p className="text-fs-sm text-muted-foreground">This professional hasn't set their availability yet.</p>
 <p className="text-fs-xs text-muted-foreground mt-1">You can still proceed — they'll confirm the booking.</p>
 <Button variant="outline" className="mt-4" onClick={() => { setSelectedDate(new Date()); setStep(3); }}>
 Skip — choose any date
 </Button>
 </div>
 ) : (
 <Calendar
 mode="single"
 selected={selectedDate}
 onSelect={(d) => { setSelectedDate(d); setSelectedTime(""); }}
 disabled={isDateDisabled}
 className={cn("p-3 pointer-events-auto rounded-sm border border-border bg-card mx-auto")}
 />
 )}
 </div>
 )}

 {/* ─── Step 3: Pick Time Slot ─── */}
 {step === 3 && (
 <div className="animate-reveal-delay-2 space-y-4">
 <Heading level={2}  className="mb-1">Pick a time slot</Heading>
 <p className="text-fs-sm text-muted-foreground">
 {selectedDate ?`Available times on ${format(selectedDate,"EEEE, MMMM d, yyyy")}` :"Select a time"}
 </p>

 {timeSlots.length > 0 ? (
 <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
 {timeSlots.map((t) => (
 <button key={t} onClick={() => setSelectedTime(t)}
 className={cn(
"py-3 px-3 rounded-sm text-fs-sm font-medium transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5",
 selectedTime === t
 ?"bg-primary text-primary-foreground"
 :"bg-secondary text-secondary-foreground hover:bg-secondary/70"
 )}>
 <Clock className="w-3.5 h-3.5" /> {t}
 </button>
 ))}
 </div>
 ) : (
 <p className="text-fs-sm text-muted-foreground py-8 text-center">No time slots available for this date.</p>
 )}
 </div>
 )}

 {/* ─── Step 4: Confirm Details ─── */}
 {step === 4 && (
 <div className="animate-reveal-delay-2 space-y-4">
 <Heading level={2}  className="mb-4">Confirm booking details</Heading>

 <div className="bg-card rounded-sm border border-border divide-y divide-border/40">
 <div className="p-5 flex items-center gap-4">
 <div className="w-12 h-12 rounded-sm bg-primary/10 overflow-hidden flex items-center justify-center text-fs-sm font-bold text-primary shrink-0">
 {selectedVendor?.avatar_url ? (
 <img src={selectedVendor.avatar_url} alt="" className="w-full h-full object-cover" />
 ) : (
 (selectedVendor?.display_name ||"V").slice(0, 2).toUpperCase()
 )}
 </div>
 <div>
 <p className="text-fs-sm font-semibold text-heading flex items-center gap-1.5">
 {selectedVendor?.display_name}
 <BadgeCheck className="w-3.5 h-3.5 text-primary" />
 </p>
 {selectedVendor?.address && (
 <p className="text-fs-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> {selectedVendor.address}</p>
 )}
 </div>
 </div>

 <div className="p-5 grid sm:grid-cols-2 gap-4">
 <div>
 <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Service</p>
 <p className="text-fs-sm font-semibold text-heading">{selectedService?.title}</p>
 <p className="text-fs-xs text-muted-foreground">{categoryName}</p>
 </div>
 <div>
 <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Date & Time</p>
 <p className="text-fs-sm font-semibold text-heading">
 {selectedDate && format(selectedDate,"EEE, MMM d, yyyy")}
 </p>
 <p className="text-fs-xs text-muted-foreground">{selectedTime} — {selectedTime ?`${String(Number(selectedTime.split(":")[0]) + 1).padStart(2,"0")}:00` :""} (1 hour)</p>
 </div>
 </div>

 <div className="p-5">
 <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Price</p>
 <p className="text-fs-lg font-bold text-heading tabular-nums">
 {selectedService?.price_min
 ?`$${selectedService.price_min}${selectedService.price_max ?`–$${selectedService.price_max}` :""}`
 :"Quote on arrival"}
 </p>
 <p className="text-fs-xs text-muted-foreground capitalize">{selectedService?.price_type}</p>
 </div>

 <div className="p-5">
 <label className="flex items-center gap-1.5 text-fs-xs font-medium text-heading mb-1.5">
 <FileText className="w-3 h-3" /> Notes for the professional (optional)
 </label>
 <textarea
 value={notes} onChange={(e) => setNotes(e.target.value)}
 placeholder="Describe the issue, access instructions, etc."
 rows={3}
 className="w-full px-3 py-2 rounded-sm border border-input bg-background text-fs-sm transition-shadow resize-none"
 />
 </div>
 </div>
 </div>
 )}

 {/* ─── Step 5: Pay ─── */}
 {step === 5 && (
 <div className="animate-reveal-delay-2 space-y-4">
 <Heading level={2}  className="mb-4">Payment</Heading>

 {/* Deposit / Full toggle */}
 {totalAmount && totalAmount > 0 && (
 <div className="bg-card rounded-sm border border-border p-5 mb-4">
 <p className="text-fs-xs font-semibold text-heading uppercase tracking-wider mb-3">Payment Option</p>
 <div className="grid grid-cols-2 gap-3">
 <button
 onClick={() => setPaymentType("full")}
 className={cn(
"p-4 rounded-sm border-2 text-left transition-all duration-200",
 paymentType ==="full"
 ?"border-primary bg-primary/5"
 :"border-border/60 bg-card hover:border-primary/30"
 )}
 >
 <p className="text-fs-sm font-semibold text-heading mb-0.5">Pay Full Amount</p>
 <p className="text-fs-lg font-bold text-heading tabular-nums">${totalAmount}</p>
 <p className="text-[10px] text-muted-foreground mt-1">Pay everything upfront</p>
 </button>
 <button
 onClick={() => setPaymentType("deposit")}
 className={cn(
"p-4 rounded-sm border-2 text-left transition-all duration-200",
 paymentType ==="deposit"
 ?"border-primary bg-primary/5"
 :"border-border/60 bg-card hover:border-primary/30"
 )}
 >
 <p className="text-fs-sm font-semibold text-heading mb-0.5">Pay Deposit ({depositPct}%)</p>
 <p className="text-fs-lg font-bold text-heading tabular-nums">${depositAmount}</p>
 <p className="text-[10px] text-muted-foreground mt-1">Pay remainder after service</p>
 </button>
 </div>
 </div>
 )}

 <PaymentStep
 totalPrice={payableAmount}
 categoryId={selectedCategory || null}
 onPaymentComplete={handleSubmit}
 onSkipPayment={handleSubmit}
 onCouponChange={setAppliedCoupon}
 onTaxCalculated={setTaxData}
 />
 </div>
 )}

 {step === 6 && (
 <BookingSuccess
 bookingId={bookingId}
 vendor={selectedVendor}
 service={selectedService}
 date={selectedDate}
 startTime={selectedTime}
 payable={payableAmount}
 paymentType={paymentType}
 appliedCoupon={appliedCoupon}
 notes={notes}
 customerAddress={customerAddress}
 onDashboard={() => navigate("/client-dashboard")}
 onMessage={() => navigate(`/chat?with=${selectedVendor?.vendor_id}`)}
 onBrowse={() => navigate("/browse")}
 />
 )}

 {/* Navigation */}
 {step >= 1 && step <= 4 && (
 <div className="flex items-center justify-between mt-8">
 <Button variant="ghost" onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)} className="gap-1.5">
 <ArrowLeft className="w-4 h-4" /> Back
 </Button>
 <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="gap-1.5">
 {step === 4 ?"Proceed to Payment" :"Next"} <ArrowRight className="w-4 h-4" />
 </Button>
 </div>
 )}

 {step === 5 && (
 <div className="mt-6">
 <Button variant="ghost" onClick={() => setStep(4)} className="gap-1.5">
 <ArrowLeft className="w-4 h-4" /> Back to Details
 </Button>
 </div>
 )}
 </div>
 </main>
 </div>
 );
};

export default BookService;
