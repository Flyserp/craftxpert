import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { WorkflowStep } from "@/components/workflow/WorkflowTracker";

export type WorkflowRole = "provider" | "customer" | "employer" | "admin" | "moderator";

interface WorkflowState {
  loading: boolean;
  role: WorkflowRole | null;
  steps: WorkflowStep[];
  title: string;
}

/**
 * Computes the user's workflow stage from existing platform data.
 * Steps are checked sequentially — earlier steps gate later ones so the UI
 * enforces the correct order.
 */
export function useUserWorkflow(): WorkflowState {
  const { user, profile, roles } = useAuth();
  const [state, setState] = useState<WorkflowState>({
    loading: true,
    role: null,
    steps: [],
    title: "Workflow",
  });

  useEffect(() => {
    if (!user) {
      setState({ loading: false, role: null, steps: [], title: "Workflow" });
      return;
    }

    const role: WorkflowRole = roles.includes("admin")
      ? "admin"
      : roles.includes("moderator")
      ? "moderator"
      : roles.includes("provider")
      ? "provider"
      : roles.includes("employer")
      ? "employer"
      : "customer";

    (async () => {
      if (role === "provider") {
        const [verif, sub, proposals, bookings, reviews] = await Promise.all([
          supabase.from("vendor_verifications").select("status").eq("vendor_id", user.id).maybeSingle(),
          supabase.from("provider_subscriptions").select("status,current_period_end").eq("provider_id", user.id).eq("status", "active").maybeSingle(),
          supabase.from("task_proposals").select("id,status").eq("vendor_id", user.id),
          supabase.from("bookings").select("id,status").eq("vendor_id", user.id),
          supabase.from("reviews").select("id").eq("vendor_id", user.id).limit(1),
        ]);

        const hired = (proposals.data || []).some((p) => p.status === "accepted")
          || (bookings.data || []).some((b) => ["confirmed", "in_progress", "completed"].includes(b.status));
        const completed = (bookings.data || []).some((b) => b.status === "completed");
        const subActive = !!sub.data && new Date(sub.data.current_period_end) > new Date();
        const verified = verif.data?.status === "approved";
        const profileDone = !!profile?.profile_completed;

        setState({
          loading: false,
          role,
          title: "Service Provider Workflow",
          steps: [
            { key: "register", label: "Register", description: "Account created.", done: true },
            { key: "profile", label: "Complete Profile", description: "Add photo, skills, bio, and pricing.", done: profileDone, href: "/provider-profile", cta: "Complete profile" },
            { key: "subscribe", label: "Subscribe", description: "Pick a plan to unlock applying to jobs.", done: subActive, href: "/provider-subscription", cta: "Choose plan" },
            { key: "verify", label: "Verify Identity", description: "Upload ID and proofs for the verified badge.", done: verified, href: "/provider-verification", cta: "Start verification" },
            { key: "browse", label: "Browse Jobs", description: "Discover jobs that match your skills.", done: (proposals.data || []).length > 0, href: "/provider-tasks", cta: "Browse jobs" },
            { key: "apply", label: "Apply", description: "Send proposals to open jobs.", done: (proposals.data || []).length > 0, href: "/provider-tasks", cta: "Apply now" },
            { key: "hired", label: "Get Hired", description: "Your proposal is accepted.", done: hired },
            { key: "complete", label: "Complete Work", description: "Mark the job as completed.", done: completed, href: "/provider-bookings", cta: "View jobs" },
            { key: "review", label: "Receive Review", description: "Customers rate your work.", done: (reviews.data || []).length > 0, href: "/provider-reviews", cta: "View reviews" },
          ],
        });
        return;
      }

      if (role === "customer") {
        const [bookings, messages, reviews] = await Promise.all([
          supabase.from("bookings").select("id,status").eq("customer_id", user.id),
          supabase.from("messages").select("id").eq("sender_id", user.id).limit(1),
          supabase.from("reviews").select("id").eq("customer_id", user.id).limit(1),
        ]);
        const browsed = (bookings.data || []).length > 0 || (messages.data || []).length > 0;
        const hired = (bookings.data || []).length > 0;
        const chatted = (messages.data || []).length > 0;
        const completed = (bookings.data || []).some((b) => b.status === "completed");
        const reviewed = (reviews.data || []).length > 0;

        setState({
          loading: false,
          role,
          title: "Customer Workflow",
          steps: [
            { key: "register", label: "Register", description: "Account created.", done: true },
            { key: "browse", label: "Browse Providers", description: "Discover trusted local providers.", done: browsed, href: "/providers", cta: "Browse providers" },
            { key: "hire", label: "Hire a Provider", description: "Book a service to get started.", done: hired, href: "/providers", cta: "Hire now" },
            { key: "chat", label: "Chat", description: "Coordinate the job in real-time chat.", done: chatted, href: "/chat", cta: "Open chat" },
            { key: "complete", label: "Complete Job", description: "Mark your booking complete when finished.", done: completed, href: "/my-bookings", cta: "My bookings" },
            { key: "review", label: "Leave a Review", description: "Share your experience.", done: reviewed, href: "/my-reviews", cta: "Write a review" },
          ],
        });
        return;
      }

      if (role === "employer") {
        const [verif, tasks, payments] = await Promise.all([
          supabase.from("vendor_verifications").select("status").eq("vendor_id", user.id).maybeSingle(),
          supabase.from("tasks").select("id,status").eq("customer_id", user.id),
          supabase.from("task_payments").select("id,status").eq("employer_id", user.id).limit(1),
        ]);
        const verified = verif.data?.status === "approved";
        const paid = (payments.data || []).some((p) => p.status === "completed" || p.status === "paid");
        const published = (tasks.data || []).some((t) => ["published", "open", "applied", "shortlisted", "accepted", "in_progress", "completed"].includes(t.status));
        const hired = (tasks.data || []).some((t) => ["accepted", "in_progress", "completed"].includes(t.status));
        const completed = (tasks.data || []).some((t) => t.status === "completed");

        setState({
          loading: false,
          role,
          title: "Employer Workflow",
          steps: [
            { key: "register", label: "Register", description: "Account created.", done: true },
            { key: "verify", label: "Verify Company", description: "Upload company registration documents.", done: verified, href: "/employer-profile", cta: "Verify company" },
            { key: "pay", label: "Pay Job Fee", description: "Pay-per-post unlocks publishing.", done: paid, href: "/employer-post-job", cta: "Pay & post" },
            { key: "publish", label: "Publish Job", description: "Make the job visible to providers.", done: published, href: "/employer-post-job", cta: "Publish job" },
            { key: "review", label: "Review Applications", description: "Shortlist and compare candidates.", done: hired, href: "/employer-jobs", cta: "View applicants" },
            { key: "hire", label: "Hire", description: "Accept a proposal to start the contract.", done: hired, href: "/employer-jobs", cta: "Manage jobs" },
            { key: "complete", label: "Complete Contract", description: "Close out the job when delivered.", done: completed, href: "/employer-jobs", cta: "Mark complete" },
          ],
        });
        return;
      }

      if (role === "moderator") {
        const [pendingVerif, openReports, disputes] = await Promise.all([
          supabase.from("vendor_verifications").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("content_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
          supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
        ]);
        setState({
          loading: false,
          role,
          title: "Moderator Workflow",
          steps: [
            { key: "inbox", label: "My Inbox", description: "Claim items assigned to you and clear the queue.", done: true, href: "/moderator/inbox", cta: "Open inbox" },
            { key: "reports", label: "Content Reports", description: `${openReports.count ?? 0} open reports.`, done: (openReports.count ?? 0) === 0, href: "/moderator/reports", cta: "Review reports" },
            { key: "verifications", label: "Verifications", description: `${pendingVerif.count ?? 0} pending review.`, done: (pendingVerif.count ?? 0) === 0, href: "/moderator/verifications", cta: "Review queue" },
            { key: "disputes", label: "Disputes", description: `${disputes.count ?? 0} open disputes.`, done: (disputes.count ?? 0) === 0, href: "/moderator/disputes", cta: "Open disputes" },
          ],
        });
        return;
      }

      // Admin (super admin)
      const [users, pendingVerif, openReports, payments] = await Promise.all([
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
        supabase.from("vendor_verifications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("content_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("payment_transactions").select("id", { count: "exact", head: true }),
      ]);

      setState({
        loading: false,
        role,
        title: "Super Admin Workflow",
        steps: [
          { key: "users", label: "Manage Users", description: `${users.count ?? 0} accounts on the platform.`, done: true, href: "/admin/users", cta: "Open users" },
          { key: "verifications", label: "Approve Verifications", description: `${pendingVerif.count ?? 0} pending review.`, done: (pendingVerif.count ?? 0) === 0, href: "/admin/verifications", cta: "Review queue" },
          { key: "moderation", label: "Moderate Content", description: `${openReports.count ?? 0} open reports.`, done: (openReports.count ?? 0) === 0, href: "/admin/moderation", cta: "Open moderation" },
          { key: "payments", label: "Manage Payments", description: `${payments.count ?? 0} transactions tracked.`, done: true, href: "/admin/payments", cta: "Open payments" },
          { key: "analytics", label: "Analytics", description: "Track growth and revenue.", done: true, href: "/admin/analytics", cta: "View analytics" },
        ],
      });
    })();
  }, [user, profile?.profile_completed, roles.join(",")]);

  return state;
}