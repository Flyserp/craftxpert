import { useState, useEffect, useRef } from"react";
import { useNavigate } from"react-router-dom";
import { useAuth } from"@/contexts/AuthContext";
import { supabase } from"@/integrations/supabase/client";
import { createNotification } from"@/lib/notifications";
import UnifiedHeader from"@/components/header/UnifiedHeader";
import PageHeroBanner from"@/components/PageHeroBanner";
import AddressAutocomplete from"@/components/AddressAutocomplete";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Calendar } from"@/components/ui/calendar";
import { toast } from"sonner";
import { format } from"date-fns";
import { cn } from"@/lib/utils";
import {
 ArrowLeft, ArrowRight, Check, Tag, FileText, Camera, CalendarDays,
 MapPin, DollarSign, ClipboardCheck, X, Upload, Clock, Loader2, Trash2, Sparkles,
} from"lucide-react";

const DRAFT_STORAGE_KEY ="post-task-draft:v1";

interface PostTaskDraft {
 step: number;
 selectedCategory: string;
 selectedSubcategory: string;
 title: string;
 description: string;
 selectedDate: string | null; // ISO date
 selectedTime: string;
 address: string;
 budgetMin: number |"";
 budgetMax: number |"";
 selectedPreset: number | null;
}

/* ─── Icon map for categories ─── */
import { getCategoryIcon } from"@/lib/categoryIcons";
import { Heading } from "@/components/ui/app";

const STEPS = [
 { id: 1, label:"Category", icon: Tag },
 { id: 2, label:"Describe", icon: FileText },
 { id: 3, label:"Photos", icon: Camera },
 { id: 4, label:"Schedule", icon: CalendarDays },
 { id: 5, label:"Address", icon: MapPin },
 { id: 6, label:"Budget", icon: DollarSign },
 { id: 7, label:"Review", icon: ClipboardCheck },
];

const TIME_OPTIONS = [
"08:00","09:00","10:00","11:00","12:00",
"13:00","14:00","15:00","16:00","17:00","18:00",
];

const BUDGET_PRESETS = [
 { label:"Under $50", min: 0, max: 50 },
 { label:"$50 – $100", min: 50, max: 100 },
 { label:"$100 – $250", min: 100, max: 250 },
 { label:"$250 – $500", min: 250, max: 500 },
 { label:"$500+", min: 500, max: 0 },
];

interface Category {
 id: string;
 name: string;
 icon: string | null;
}

interface SubCategory {
 id: string;
 name: string;
 category_id: string;
}

const PostTaskPage = () => {
 const { user } = useAuth();
 const navigate = useNavigate();
 const fileInputRef = useRef<HTMLInputElement>(null);
 const [step, setStep] = useState(1);
 const [submitting, setSubmitting] = useState(false);
 const [aiPrompt, setAiPrompt] = useState("");
 const [aiGenerating, setAiGenerating] = useState(false);
 const [aiImproving, setAiImproving] = useState(false);
 const [aiQuestions, setAiQuestions] = useState<string[]>([]);
 const [aiQuestionsLoading, setAiQuestionsLoading] = useState(false);
 const [aiQuestionsRequested, setAiQuestionsRequested] = useState(false);
 const [dismissedQuestions, setDismissedQuestions] = useState<Set<string>>(new Set());

 const handleSuggestQuestions = async () => {
 const desc = description.trim();
 if (desc.length < 10) {
 toast.error("Write at least 10 characters first.");
 return;
 }
 setAiQuestionsLoading(true);
 setAiQuestionsRequested(true);
 try {
 const categoryName = categories.find((c) => c.id === selectedCategory)?.name ?? undefined;
 const { data, error } = await supabase.functions.invoke("generate-task-description", {
 body: { mode:"suggest_questions", description: desc, title: title.trim() || undefined, category: categoryName },
 });
 if (error) throw error;
 if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
 const { questions } = (data ?? {}) as { questions?: string[] };
 if (!questions || questions.length === 0) throw new Error("AI returned no questions.");
 setAiQuestions(questions);
 setDismissedQuestions(new Set());
 } catch (e) {
 const msg = e instanceof Error ? e.message :"Failed to load suggestions.";
 toast.error(msg);
 setAiQuestions([]);
 } finally {
 setAiQuestionsLoading(false);
 }
 };

 const handleApplyQuestion = (q: string) => {
 const addition =`\n\n${q}`;
 const next = (description + addition).slice(0, 1000);
 setDescription(next);
 setDismissedQuestions((prev) => new Set(prev).add(q));
 };

 const handleDismissQuestion = (q: string) => {
 setDismissedQuestions((prev) => new Set(prev).add(q));
 };

 const handleAiImprove = async () => {
 const current = description.trim();
 if (current.length < 10) {
 toast.error("Write at least 10 characters first, then I'll polish it.");
 return;
 }
 setAiImproving(true);
 try {
 const categoryName =
 categories.find((c) => c.id === selectedCategory)?.name ?? undefined;
 const { data, error } = await supabase.functions.invoke("generate-task-description", {
 body: { mode:"improve", description: current, category: categoryName },
 });
 if (error) throw error;
 if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
 const { description: polished } = (data ?? {}) as { description?: string };
 if (!polished) throw new Error("AI returned an empty result.");
 setDescription(polished.slice(0, 1000));
 toast.success("Description polished — title left as-is.");
 } catch (e) {
 const msg = e instanceof Error ? e.message :"Failed to improve writing.";
 toast.error(msg);
 } finally {
 setAiImproving(false);
 }
 };

 const handleAiGenerate = async () => {
 const prompt = aiPrompt.trim();
 if (prompt.length < 3) {
 toast.error("Add a few words about the task first.");
 return;
 }
 setAiGenerating(true);
 // Reset fields so streaming tokens replace any prior content
 setTitle("");
 setDescription("");
 try {
 const categoryName =
 categories.find((c) => c.id === selectedCategory)?.name ?? undefined;

 const url =`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-task-description`;
 const resp = await fetch(url, {
 method:"POST",
 headers: {
"Content-Type":"application/json",
 Authorization:`Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
 },
 body: JSON.stringify({ prompt, category: categoryName }),
 });

 if (resp.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
 if (resp.status === 402) throw new Error("AI credits exhausted. Please add funds in Settings → Workspace → Usage.");
 if (!resp.ok || !resp.body) {
 // Try to parse a JSON error envelope
 try {
 const j = await resp.json();
 throw new Error((j as { error?: string })?.error ||"AI gateway error");
 } catch {
 throw new Error("AI gateway error");
 }
 }

 const reader = resp.body.getReader();
 const decoder = new TextDecoder();
 let textBuffer =""; // SSE line buffer
 let assembled =""; // full model text so far
 let mode:"pre" |"title" |"desc" ="pre";
 let titleSoFar ="";
 let descSoFar ="";
 let streamDone = false;

 const consumeAssembled = () => {
 // Walk the assembled text from where we left off, classifying each char
 // by whether we're before TITLE:, in title, or in description.
 // Simple approach: re-derive title/desc from`assembled` each tick.
 const titleIdx = assembled.indexOf("TITLE:");
 if (titleIdx === -1) return;
 const afterTitle = assembled.slice(titleIdx +"TITLE:".length);
 const descMatch = afterTitle.match(/\n\s*DESCRIPTION:/i);
 if (descMatch && descMatch.index !== undefined) {
 titleSoFar = afterTitle.slice(0, descMatch.index).trim();
 descSoFar = afterTitle
 .slice(descMatch.index + descMatch[0].length)
 .replace(/^[\s]+/,"");
 mode ="desc";
 } else {
 titleSoFar = afterTitle.trim();
 mode ="title";
 }
 // Apply, capped to field limits
 setTitle(titleSoFar.slice(0, 100));
 setDescription(descSoFar.slice(0, 1000));
 };

 while (!streamDone) {
 const { done, value } = await reader.read();
 if (done) break;
 textBuffer += decoder.decode(value, { stream: true });

 let newlineIndex: number;
 while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
 let line = textBuffer.slice(0, newlineIndex);
 textBuffer = textBuffer.slice(newlineIndex + 1);
 if (line.endsWith("\r")) line = line.slice(0, -1);
 if (line.startsWith(":") || line.trim() ==="") continue;
 if (!line.startsWith("data:")) continue;
 const jsonStr = line.slice(6).trim();
 if (jsonStr ==="[DONE]") {
 streamDone = true;
 break;
 }
 try {
 const parsed = JSON.parse(jsonStr);
 const delta = parsed?.choices?.[0]?.delta?.content as string | undefined;
 if (delta) {
 assembled += delta;
 consumeAssembled();
 }
 } catch {
 // Partial JSON split across chunks: put back and wait
 textBuffer = line +"\n" + textBuffer;
 break;
 }
 }
 }

 // Final flush
 if (textBuffer.trim()) {
 for (let raw of textBuffer.split("\n")) {
 if (!raw) continue;
 if (raw.endsWith("\r")) raw = raw.slice(0, -1);
 if (raw.startsWith(":") || raw.trim() ==="" || !raw.startsWith("data:")) continue;
 const jsonStr = raw.slice(6).trim();
 if (jsonStr ==="[DONE]") continue;
 try {
 const parsed = JSON.parse(jsonStr);
 const delta = parsed?.choices?.[0]?.delta?.content as string | undefined;
 if (delta) {
 assembled += delta;
 consumeAssembled();
 }
 } catch { /* ignore */ }
 }
 }

 if (!titleSoFar.trim() || !descSoFar.trim()) {
 throw new Error("AI returned an empty result.");
 }
 // Final trim pass
 setTitle(titleSoFar.trim().slice(0, 100));
 setDescription(descSoFar.trim().slice(0, 1000));
 toast.success("AI draft ready — feel free to tweak it.");
 } catch (e) {
 const msg = e instanceof Error ? e.message :"Failed to generate.";
 toast.error(msg);
 } finally {
 setAiGenerating(false);
 }
 };

 // Data
 const [categories, setCategories] = useState<Category[]>([]);
 const [subcategories, setSubcategories] = useState<SubCategory[]>([]);

 // Form state
 const [selectedCategory, setSelectedCategory] = useState("");
 const [selectedSubcategory, setSelectedSubcategory] = useState("");
 const [title, setTitle] = useState("");
 const [description, setDescription] = useState("");
 const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
 const [uploading, setUploading] = useState(false);
 const [selectedDate, setSelectedDate] = useState<Date | undefined>();
 const [selectedTime, setSelectedTime] = useState("");
 const [address, setAddress] = useState("");
 const [budgetMin, setBudgetMin] = useState<number |"">("");
 const [budgetMax, setBudgetMax] = useState<number |"">("");
 const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

 const [draftRestored, setDraftRestored] = useState(false);
 const hydratedRef = useRef(false);
 const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 const applyDraft = (d: Partial<PostTaskDraft>) => {
 if (typeof d.step ==="number") setStep(Math.min(Math.max(d.step, 1), 7));
 if (d.selectedCategory) setSelectedCategory(d.selectedCategory);
 if (d.selectedSubcategory) setSelectedSubcategory(d.selectedSubcategory);
 if (d.title) setTitle(d.title);
 if (d.description) setDescription(d.description);
 if (d.selectedDate) setSelectedDate(new Date(d.selectedDate));
 if (d.selectedTime) setSelectedTime(d.selectedTime);
 if (d.address) setAddress(d.address);
 if (d.budgetMin !== undefined) setBudgetMin(d.budgetMin);
 if (d.budgetMax !== undefined) setBudgetMax(d.budgetMax);
 if (d.selectedPreset !== undefined) setSelectedPreset(d.selectedPreset);
 };

 // Restore draft on mount: prefer Supabase (cross-device) when signed in, else localStorage
 useEffect(() => {
 let cancelled = false;
 (async () => {
 let restored: Partial<PostTaskDraft> | null = null;

 if (user) {
 const { data } = await supabase
 .from("task_drafts")
 .select("payload")
 .eq("user_id", user.id)
 .maybeSingle();
 if (cancelled) return;
 if (data?.payload && typeof data.payload ==="object") {
 restored = data.payload as Partial<PostTaskDraft>;
 }
 }

 if (!restored) {
 try {
 const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
 if (raw) restored = JSON.parse(raw) as Partial<PostTaskDraft>;
 } catch { /* ignore */ }
 }

 if (restored && typeof restored ==="object") {
 applyDraft(restored);
 setDraftRestored(true);
 toast.info("Draft restored", { description:"We brought back your unfinished task." });
 }

 hydratedRef.current = true;
 })();
 return () => { cancelled = true; };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [user?.id]);

 useEffect(() => {
 Promise.all([
 supabase.from("service_categories").select("id, name, icon").order("name"),
 supabase.from("service_subcategories").select("id, name, category_id").order("name"),
 ]).then(([catsRes, subsRes]) => {
 setCategories(catsRes.data || []);
 setSubcategories(subsRes.data || []);
 });
 }, []);

 // Autosave draft whenever any serializable field changes (skip until hydrated)
 useEffect(() => {
 if (!hydratedRef.current) return;
 const draft: PostTaskDraft = {
 step,
 selectedCategory,
 selectedSubcategory,
 title,
 description,
 selectedDate: selectedDate ? selectedDate.toISOString() : null,
 selectedTime,
 address,
 budgetMin,
 budgetMax,
 selectedPreset,
 };
 // local mirror (instant + works for guests)
 try {
 localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
 } catch { /* noop */ }

 // debounced cloud sync for signed-in users
 if (user) {
 if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
 saveTimerRef.current = setTimeout(() => {
 supabase
 .from("task_drafts")
 .upsert(
 [{ user_id: user.id, payload: JSON.parse(JSON.stringify(draft)) }],
 { onConflict:"user_id" },
 )
 .then(() => { /* silent */ });
 }, 600);
 }
 }, [user, step, selectedCategory, selectedSubcategory, title, description, selectedDate, selectedTime, address, budgetMin, budgetMax, selectedPreset]);

 const clearDraft = () => {
 try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* noop */ }
 if (user) {
 supabase.from("task_drafts").delete().eq("user_id", user.id).then(() => { /* silent */ });
 }
 };

 const discardDraft = () => {
 clearDraft();
 setStep(1);
 setSelectedCategory("");
 setSelectedSubcategory("");
 setTitle("");
 setDescription("");
 photos.forEach((p) => URL.revokeObjectURL(p.preview));
 setPhotos([]);
 setSelectedDate(undefined);
 setSelectedTime("");
 setAddress("");
 setBudgetMin("");
 setBudgetMax("");
 setSelectedPreset(null);
 setDraftRestored(false);
 toast.success("Draft discarded");
 };

 // Warn before leaving if there's unsaved progress (any field touched, not submitting)
 const hasUnsavedProgress =
 !submitting &&
 (
 step > 1 ||
 !!selectedCategory ||
 !!selectedSubcategory ||
 title.trim().length > 0 ||
 description.trim().length > 0 ||
 photos.length > 0 ||
 !!selectedDate ||
 !!selectedTime ||
 address.trim().length > 0 ||
 budgetMin !=="" ||
 budgetMax !=="" ||
 selectedPreset !== null
 );

 useEffect(() => {
 if (!hasUnsavedProgress) return;
 const handler = (e: BeforeUnloadEvent) => {
 e.preventDefault();
 // Required for legacy browsers; modern browsers show a generic message.
 e.returnValue ="";
 return"";
 };
 window.addEventListener("beforeunload", handler);
 return () => window.removeEventListener("beforeunload", handler);
 }, [hasUnsavedProgress]);

 const activeSubs = subcategories.filter((s) => s.category_id === selectedCategory);
 const categoryName = categories.find((c) => c.id === selectedCategory)?.name ||"";
 const subcategoryName = subcategories.find((s) => s.id === selectedSubcategory)?.name ||"";

 // Photo handling
 const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = Array.from(e.target.files || []);
 const remaining = 5 - photos.length;
 const toAdd = files.slice(0, remaining);
 const newPhotos = toAdd.map((file) => ({
 file,
 preview: URL.createObjectURL(file),
 }));
 setPhotos((prev) => [...prev, ...newPhotos]);
 if (fileInputRef.current) fileInputRef.current.value ="";
 };

 const removePhoto = (index: number) => {
 setPhotos((prev) => {
 URL.revokeObjectURL(prev[index].preview);
 return prev.filter((_, i) => i !== index);
 });
 };

 const uploadPhotos = async (): Promise<string[]> => {
 if (!user || photos.length === 0) return [];
 setUploading(true);
 const urls: string[] = [];
 for (const p of photos) {
 const ext = p.file.name.split(".").pop() ||"jpg";
 const path =`${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
 const { error } = await supabase.storage.from("task-photos").upload(path, p.file);
 if (!error) {
 const { data } = supabase.storage.from("task-photos").getPublicUrl(path);
 urls.push(data.publicUrl);
 }
 }
 setUploading(false);
 return urls;
 };

 // Validation
 const canProceed = () => {
 if (step === 1) return !!selectedCategory;
 if (step === 2) return title.trim().length >= 5 && description.trim().length >= 10;
 if (step === 3) return true; // photos optional
 if (step === 4) return !!selectedDate;
 if (step === 5) return address.trim().length >= 5;
 if (step === 6) return budgetMin !=="" && Number(budgetMin) >= 0;
 return true;
 };

 const handleSubmit = async () => {
 if (!user) return;
 setSubmitting(true);

 const photoUrls = await uploadPhotos();

 const { data: inserted, error } = await supabase
 .from("tasks")
 .insert({
 customer_id: user.id,
 category_id: selectedCategory,
 subcategory_id: selectedSubcategory || null,
 title: title.trim(),
 description: description.trim(),
 photos: photoUrls,
 preferred_date: selectedDate ? format(selectedDate,"yyyy-MM-dd") : null,
 preferred_time: selectedTime || null,
 address: address.trim(),
 budget_min: budgetMin !=="" ? Number(budgetMin) : null,
 budget_max: budgetMax !=="" ? Number(budgetMax) : null,
 status:"open",
 } as any)
 .select("id")
 .single();

 setSubmitting(false);
 if (error) {
 toast.error("Failed to post task. Please try again.");
 } else {
 clearDraft();
 await createNotification({
 userId: user.id,
 type:"task_posted",
 title:"Task Posted!",
 message:`Your task"${title.trim()}" has been posted. Professionals will be notified.`,
 });
 toast.success("Task posted — finding the best pros for you…");
 const params = new URLSearchParams({ category: selectedCategory });
 if (inserted?.id) params.set("taskId", inserted.id);
 if (address.trim()) params.set("address", address.trim());
 if (budgetMin !=="") params.set("budgetMin", String(budgetMin));
 if (budgetMax !=="") params.set("budgetMax", String(budgetMax));
 navigate(`/ai-match?${params.toString()}`);
 }
 };

 const goNext = () => { if (canProceed() && step < 7) setStep(step + 1); };
 const goBack = () => { if (step > 1) setStep(step - 1); else navigate(-1); };

 return (
 <div className="min-h-screen bg-background">
 <UnifiedHeader />
 <PageHeroBanner
 icon={ClipboardCheck}
 iconColor="text-emerald-500"
 iconBg="bg-emerald-500/10"
 gradient="from-emerald-600/20 via-emerald-500/5 to-transparent"
 title="Post a Task"
 description="Describe what you need and get matched with professionals."
 breadcrumbs={[
 { label:"Home", to:"/" },
 { label:"Post a Task" },
 ]}
 />
 <main className="pb-16">
 <div className="container-app max-w-2xl pt-8">

 {/* Draft restored banner */}
 {draftRestored && (
 <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-fs-xs animate-in fade-in-0">
 <span className="text-muted-foreground">
 <Check className="inline w-3.5 h-3.5 mr-1 text-primary" />
 Draft restored — your progress is being saved automatically.
 </span>
 <button
 onClick={discardDraft}
 className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors font-medium"
 >
 <Trash2 className="w-3.5 h-3.5" /> Discard
 </button>
 </div>
 )}

 {/* Step indicator */}
 <div className="flex items-center gap-0.5 mb-8 overflow-x-auto pb-1 scrollbar-hide animate-reveal-delay-1">
 {STEPS.map((s, i) => (
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
 <span className="sm:hidden">{s.id}</span>
 </button>
 {i < STEPS.length - 1 && (
 <div className={cn("w-3 h-px mx-0.5 shrink-0", s.id < step ?"bg-primary/40" :"bg-border")} />
 )}
 </div>
 ))}
 </div>

 {/* ─── Step 1: Category ─── */}
 {step === 1 && (
 <div className="animate-reveal-delay-2 space-y-6">
 <div>
 <Heading level={2}  className="mb-1">What do you need help with?</Heading>
 <p className="text-fs-sm text-muted-foreground mb-4">Select a service category</p>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 {categories.map((cat) => {
 const Icon = getCategoryIcon(cat.icon);
 return (
 <button
 key={cat.id}
 onClick={() => { setSelectedCategory(cat.id); setSelectedSubcategory(""); }}
 className={cn(
"flex items-center gap-3 p-4 rounded-sm border text-left transition-all duration-200 active:scale-[0.97]",
 selectedCategory === cat.id
 ?"border-primary bg-primary/5"
 :"border-border/60 bg-card hover:border-primary/30"
 )}
 >
 <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
 selectedCategory === cat.id ?"bg-primary/15" :"bg-muted"
 )}>
 <Icon className={cn("w-5 h-5", selectedCategory === cat.id ?"text-primary" :"text-muted-foreground")} />
 </div>
 <span className="text-fs-sm font-medium text-heading">{cat.name}</span>
 </button>
 );
 })}
 </div>
 </div>

 {/* Subcategory selection */}
 {activeSubs.length > 0 && (
 <div className="animate-in fade-in-0 duration-200">
 <p className="text-fs-sm font-medium text-heading mb-2">Narrow it down (optional)</p>
 <div className="flex flex-wrap gap-2">
 {activeSubs.map((sub) => (
 <button
 key={sub.id}
 onClick={() => setSelectedSubcategory(selectedSubcategory === sub.id ?"" : sub.id)}
 className={cn(
"px-3 py-1.5 rounded-full text-fs-xs font-medium border transition-all duration-200 active:scale-95",
 selectedSubcategory === sub.id
 ?"bg-accent text-foreground border-border"
 :"bg-transparent text-muted-foreground border-border/40 hover:border-border hover:text-foreground"
 )}
 >
 {sub.name}
 </button>
 ))}
 </div>
 </div>
 )}
 </div>
 )}

 {/* ─── Step 2: Describe Issue ─── */}
 {step === 2 && (
 <div className="animate-reveal-delay-2 space-y-5">
 <Heading level={2}  className="mb-1">Describe the task</Heading>
 <p className="text-fs-sm text-muted-foreground">Be specific so professionals understand what you need.</p>

 {/* AI helper */}
 <div className="rounded-sm border border-primary/20 bg-primary/5 p-3 sm:p-4 space-y-2">
 <div className="flex items-center gap-2 text-fs-xs sm:text-fs-sm font-medium text-heading">
 <Sparkles className="w-4 h-4 text-primary" />
 Let AI write it for you
 </div>
 <p className="text-fs-xs text-muted-foreground">
 Type a few words about the issue and we'll draft a polished title and description.
 </p>
 <div className="flex flex-col sm:flex-row gap-2">
 <Input
 value={aiPrompt}
 onChange={(e) => setAiPrompt(e.target.value.slice(0, 200))}
 placeholder="e.g. kitchen sink leaking under cabinet for a week"
 disabled={aiGenerating}
 onKeyDown={(e) => {
 if (e.key ==="Enter" && !e.shiftKey) {
 e.preventDefault();
 handleAiGenerate();
 }
 }}
 className="flex-1"
 />
 <Button
 type="button"
 onClick={handleAiGenerate}
 disabled={aiGenerating || aiPrompt.trim().length < 3}
 className="gap-2 sm:w-auto"
 >
 {aiGenerating ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 Generating…
 </>
 ) : (
 <>
 <Sparkles className="w-4 h-4" />
 {title || description ?"Regenerate" :"Generate"}
 </>
 )}
 </Button>
 </div>
 </div>

 <div>
 <label className="block text-fs-sm font-medium text-heading mb-1.5">Task title</label>
 <Input
 value={title}
 onChange={(e) => setTitle(e.target.value.slice(0, 100))}
 placeholder="e.g. Fix leaking kitchen faucet"
 maxLength={100}
 />
 <p className="text-[10px] text-muted-foreground mt-1 text-right tabular-nums">{title.length}/100</p>
 </div>

 <div>
 <div className="flex items-center justify-between gap-2 mb-1.5">
 <label className="block text-fs-sm font-medium text-heading">Detailed description</label>
 <button
 type="button"
 onClick={handleAiImprove}
 disabled={aiImproving || description.trim().length < 10}
 className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-fs-xs font-medium text-primary hover:bg-primary/10 disabled:text-muted-foreground disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
 title={description.trim().length < 10 ?"Write at least 10 characters first" :"Polish this description with AI (title untouched)"}
 >
 {aiImproving ? (
 <Loader2 className="w-3.5 h-3.5 animate-spin" />
 ) : (
 <Sparkles className="w-3.5 h-3.5" />
 )}
 {aiImproving ?"Improving…" :"Improve writing"}
 </button>
 </div>
 <textarea
 value={description}
 onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
 placeholder="Describe the issue in detail: what's wrong, how long it's been happening, any previous repair attempts, etc."
 rows={5}
 maxLength={1000}
 className="w-full px-3 py-2.5 rounded-sm border border-input bg-background text-fs-sm transition-shadow resize-none"
 />
 <p className="text-[10px] text-muted-foreground mt-1 text-right tabular-nums">{description.length}/1000</p>

 {/* AI suggested follow-up questions */}
 <div className="mt-3">
 {!aiQuestionsRequested && (
 <button
 type="button"
 onClick={handleSuggestQuestions}
 disabled={description.trim().length < 10 || aiQuestionsLoading}
 className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-fs-xs font-medium text-primary hover:bg-primary/10 disabled:text-muted-foreground disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
 title={description.trim().length < 10 ?"Write at least 10 characters first" :"Get 3 follow-up questions a pro might ask"}
 >
 <Sparkles className="w-3.5 h-3.5" />
 Suggest follow-up questions
 </button>
 )}

 {aiQuestionsRequested && (
 <div className="rounded-sm border border-border/60 bg-muted/30 p-3">
 <div className="flex items-center justify-between gap-2 mb-2">
 <p className="text-fs-xs font-medium text-heading flex items-center gap-1.5">
 <Sparkles className="w-3.5 h-3.5 text-primary" />
 Add more detail? A pro might ask:
 </p>
 <button
 type="button"
 onClick={handleSuggestQuestions}
 disabled={aiQuestionsLoading || description.trim().length < 10}
 className="text-[13px] font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
 >
 {aiQuestionsLoading ?"Loading…" :"Refresh"}
 </button>
 </div>

 {aiQuestionsLoading && aiQuestions.length === 0 && (
 <div className="flex items-center gap-2 text-fs-xs text-muted-foreground py-1">
 <Loader2 className="w-3.5 h-3.5 animate-spin" />
 Thinking of useful questions…
 </div>
 )}

 {aiQuestions.length > 0 && (() => {
 const visible = aiQuestions.filter((q) => !dismissedQuestions.has(q));
 if (visible.length === 0) {
 return (
 <p className="text-fs-xs text-muted-foreground py-1">
 All caught up — click Refresh for more.
 </p>
 );
 }
 return (
 <ul className="space-y-1.5">
 {visible.map((q) => (
 <li
 key={q}
 className="flex items-start justify-between gap-2 rounded-lg bg-background border border-border/60 px-2.5 py-1.5"
 >
 <button
 type="button"
 onClick={() => handleApplyQuestion(q)}
 className="flex-1 text-left text-fs-xs text-foreground hover:text-primary transition-colors"
 title="Add this question to your description"
 >
 {q}
 </button>
 <button
 type="button"
 onClick={() => handleDismissQuestion(q)}
 className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
 aria-label="Dismiss"
 >
 <X className="w-3.5 h-3.5" />
 </button>
 </li>
 ))}
 </ul>
 );
 })()}
 </div>
 )}
 </div>
 </div>
 </div>
 )}

 {/* ─── Step 3: Upload Photos ─── */}
 {step === 3 && (
 <div className="animate-reveal-delay-2 space-y-5">
 <div>
 <Heading level={2}  className="mb-1">Upload photos</Heading>
 <p className="text-fs-sm text-muted-foreground">Add up to 5 photos to help professionals understand the task (optional).</p>
 </div>

 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 multiple
 className="hidden"
 onChange={handleFileSelect}
 />

 {photos.length > 0 && (
 <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
 {photos.map((p, i) => (
 <div key={i} className="relative aspect-square rounded-sm overflow-hidden border border-border/60 group">
 <img src={p.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
 <button
 onClick={() => removePhoto(i)}
 className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-overlay text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
 >
 <X className="w-3.5 h-3.5" />
 </button>
 </div>
 ))}
 </div>
 )}

 {photos.length < 5 && (
 <button
 onClick={() => fileInputRef.current?.click()}
 className="w-full py-12 border-2 border-dashed border-border/60 rounded-sm flex flex-col items-center gap-3 hover:border-primary/40 hover:bg-primary/[0.02] transition-colors active:scale-[0.99]"
 >
 <div className="w-12 h-12 rounded-sm bg-primary/10 flex items-center justify-center">
 <Upload className="w-5 h-5 text-primary" />
 </div>
 <div className="text-center">
 <p className="text-fs-sm font-medium text-heading">Click to upload</p>
 <p className="text-fs-xs text-muted-foreground">{photos.length}/5 photos • JPG, PNG</p>
 </div>
 </button>
 )}
 </div>
 )}

 {/* ─── Step 4: Date & Time ─── */}
 {step === 4 && (
 <div className="animate-reveal-delay-2 space-y-5">
 <div>
 <Heading level={2}  className="mb-1">When do you need this done?</Heading>
 <p className="text-fs-sm text-muted-foreground">Pick your preferred date and time.</p>
 </div>

 <div className="grid md:grid-cols-2 gap-6">
 <Calendar
 mode="single"
 selected={selectedDate}
 onSelect={(d) => { setSelectedDate(d); setSelectedTime(""); }}
 disabled={(date) => date < new Date(new Date().toDateString())}
 className={cn("p-3 pointer-events-auto rounded-sm border border-border bg-card")}
 />

 <div>
 <Heading level={3}  className="mb-3">
 {selectedDate ?`Preferred time on ${format(selectedDate,"EEE, MMM d")}` :"Select a date first"}
 </Heading>
 {selectedDate && (
 <div className="grid grid-cols-3 gap-2">
 {TIME_OPTIONS.map((t) => (
 <button
 key={t}
 onClick={() => setSelectedTime(selectedTime === t ?"" : t)}
 className={cn(
"py-2.5 px-3 rounded-lg text-fs-sm font-medium transition-all duration-200 active:scale-95",
 selectedTime === t
 ?"bg-primary text-primary-foreground"
 :"bg-secondary text-secondary-foreground hover:bg-secondary/70"
 )}
 >
 <Clock className="w-3 h-3 inline mr-1.5" />
 {t}
 </button>
 ))}
 </div>
 )}
 <p className="text-[10px] text-muted-foreground mt-3">Time is optional — professionals can suggest alternatives.</p>
 </div>
 </div>
 </div>
 )}

 {/* ─── Step 5: Address ─── */}
 {step === 5 && (
 <div className="animate-reveal-delay-2 space-y-5">
 <div>
 <Heading level={2}  className="mb-1">Where is the task?</Heading>
 <p className="text-fs-sm text-muted-foreground">Enter the service address so nearby pros can find you.</p>
 </div>

 <div>
 <label className="flex items-center gap-1.5 text-fs-sm font-medium text-heading mb-1.5">
 <MapPin className="w-4 h-4 text-muted-foreground" />
 Full address
 </label>
 <AddressAutocomplete
 value={address}
 onChange={setAddress}
 placeholder="Start typing your address…"
 maxLength={300}
 />
 <p className="text-[10px] text-muted-foreground mt-2">Your exact address is only shared with the professional you hire.</p>
 </div>
 </div>
 )}

 {/* ─── Step 6: Budget ─── */}
 {step === 6 && (
 <div className="animate-reveal-delay-2 space-y-5">
 <div>
 <Heading level={2}  className="mb-1">Set your budget</Heading>
 <p className="text-fs-sm text-muted-foreground">Choose a range or enter custom amounts.</p>
 </div>

 <div className="flex flex-wrap gap-2">
 {BUDGET_PRESETS.map((p, i) => (
 <button
 key={p.label}
 onClick={() => {
 setSelectedPreset(selectedPreset === i ? null : i);
 setBudgetMin(p.min);
 setBudgetMax(p.max ||"");
 }}
 className={cn(
"px-4 py-2.5 rounded-sm border text-fs-sm font-medium transition-all duration-200 active:scale-95",
 selectedPreset === i
 ?"border-primary bg-primary/5 text-primary"
 :"border-border/60 bg-card text-body hover:border-primary/30"
 )}
 >
 {p.label}
 </button>
 ))}
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-fs-sm font-medium text-heading mb-1.5">Minimum ($)</label>
 <Input
 type="number"
 min={0}
 value={budgetMin}
 onChange={(e) => { setBudgetMin(e.target.value ? Number(e.target.value) :""); setSelectedPreset(null); }}
 placeholder="0"
 />
 </div>
 <div>
 <label className="block text-fs-sm font-medium text-heading mb-1.5">Maximum ($) <span className="text-fs-xs font-normal text-muted-foreground">(optional)</span></label>
 <Input
 type="number"
 min={0}
 value={budgetMax}
 onChange={(e) => { setBudgetMax(e.target.value ? Number(e.target.value) :""); setSelectedPreset(null); }}
 placeholder="No limit"
 />
 </div>
 </div>
 </div>
 )}

 {/* ─── Step 7: Review & Submit ─── */}
 {step === 7 && (
 <div className="animate-reveal-delay-2 space-y-5">
 <Heading level={2}  className="mb-1">Review your task</Heading>

 <div className="bg-card rounded-sm border border-border divide-y divide-border/40">
 {/* Category */}
 <div className="p-5">
 <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Category</p>
 <p className="text-fs-sm font-semibold text-heading">
 {categoryName}
 {subcategoryName && <span className="text-muted-foreground font-normal"> → {subcategoryName}</span>}
 </p>
 </div>

 {/* Description */}
 <div className="p-5">
 <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Task</p>
 <p className="text-fs-sm font-semibold text-heading mb-1">{title}</p>
 <p className="text-fs-sm text-body">{description}</p>
 </div>

 {/* Photos */}
 {photos.length > 0 && (
 <div className="p-5">
 <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Photos</p>
 <div className="flex gap-2">
 {photos.map((p, i) => (
 <img key={i} src={p.preview} alt="" className="w-14 h-14 rounded-lg object-cover border border-border/60" />
 ))}
 </div>
 </div>
 )}

 {/* Schedule */}
 <div className="p-5 grid sm:grid-cols-2 gap-4">
 <div>
 <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Date</p>
 <p className="text-fs-sm font-semibold text-heading">
 {selectedDate ? format(selectedDate,"EEE, MMM d, yyyy") :"Flexible"}
 </p>
 {selectedTime && <p className="text-fs-xs text-muted-foreground">at {selectedTime}</p>}
 </div>
 <div>
 <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Budget</p>
 <p className="text-fs-sm font-semibold text-heading">
 {budgetMin !=="" ?`$${budgetMin}` :"$0"}
 {budgetMax !=="" && Number(budgetMax) > 0 ?` – $${budgetMax}` :"+"}
 </p>
 </div>
 </div>

 {/* Address */}
 <div className="p-5">
 <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Address</p>
 <p className="text-fs-sm text-heading flex items-center gap-1.5">
 <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
 {address}
 </p>
 </div>
 </div>

 <div className="pt-2">
 <p className="text-fs-xs text-muted-foreground mb-4">
 By posting, your task will be visible to professionals in this category. You can review and accept quotes before hiring.
 </p>
 <Button
 onClick={handleSubmit}
 disabled={submitting || uploading}
 className="w-full gap-2"
 size="lg"
 >
 {submitting || uploading ? (
 <><Loader2 className="w-4 h-4 animate-spin" /> {uploading ?"Uploading photos..." :"Posting task..."}</>
 ) : (
 <><Check className="w-4 h-4" /> Post Task</>
 )}
 </Button>
 </div>
 </div>
 )}

 {/* Navigation */}
 <div className="flex items-center justify-between mt-8">
 <Button variant="ghost" onClick={goBack} className="gap-1.5">
 <ArrowLeft className="w-4 h-4" /> Back
 </Button>
 {step < 7 && (
 <Button onClick={goNext} disabled={!canProceed()} className="gap-1.5">
 Next <ArrowRight className="w-4 h-4" />
 </Button>
 )}
 </div>
 </div>
 </main>
 </div>
 );
};

export default PostTaskPage;
