import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import PageSkeleton from "@/components/PageSkeleton";
import ChatNotificationListener from "@/components/ChatNotificationListener";
import PwaBrandingApplier from "@/components/PwaBrandingApplier";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import SkipToContent from "@/components/SkipToContent";
import FontLoadGuard from "@/components/FontLoadGuard";
import { OnboardingTourProvider } from "@/components/tour/OnboardingTourProvider";
import DashboardShell from "@/components/layouts/DashboardShell";
import Index from "./pages/Index.tsx";


// Lazy-loaded pages for code splitting
const BrowseServices = lazy(() => import("./pages/BrowseServices.tsx"));
const ProviderMarketplacePage = lazy(() => import("./pages/ProviderMarketplacePage.tsx"));
const BookService = lazy(() => import("./pages/BookService.tsx"));
const ProviderProfilePage = lazy(() => import("./pages/ProviderProfilePage.tsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.tsx"));
const PaymentSettingsPage = lazy(() => import("./pages/admin/PaymentSettingsPage.tsx"));
const PlatformSettingsPage = lazy(() => import("./pages/admin/PlatformSettingsPage.tsx"));

const EarningsPage = lazy(() => import("./pages/admin/EarningsPage.tsx"));
const ClientDashboard = lazy(() => import("./pages/ClientDashboard.tsx"));
const ProviderDashboard = lazy(() => import("./pages/ProviderDashboard.tsx"));
const ProviderServicesPage = lazy(() => import("./pages/provider/ProviderServicesPage.tsx"));
const ProviderAvailabilityPage = lazy(() => import("./pages/provider/ProviderAvailabilityPage.tsx"));
const ProviderProfilePage2 = lazy(() => import("./pages/provider/ProviderProfilePage2.tsx"));
const ProviderSubscriptionPage = lazy(() => import("./pages/provider/ProviderSubscriptionPage.tsx"));
const ProviderSettingsPage = lazy(() => import("./pages/provider/ProviderSettingsPage.tsx"));
const ProviderBookingsPage = lazy(() => import("./pages/provider/ProviderBookingsPage.tsx"));
const ProviderEarningsPage = lazy(() => import("./pages/provider/ProviderEarningsPage.tsx"));
const ProviderWithdrawalsPage = lazy(() => import("./pages/provider/ProviderWithdrawalsPage.tsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.tsx"));

const SignupPage = lazy(() => import("./pages/SignupPage.tsx"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage.tsx"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage.tsx"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage.tsx"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const HelpSupportPage = lazy(() => import("./pages/HelpSupportPage.tsx"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage.tsx"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage.tsx"));
const ActivityPage = lazy(() => import("./pages/ActivityPage.tsx"));
const SavedProvidersPage = lazy(() => import("./pages/client/SavedProvidersPage.tsx"));
const WalletPage = lazy(() => import("./pages/client/WalletPage.tsx"));
const PaymentHistoryPage = lazy(() => import("./pages/client/PaymentHistoryPage.tsx"));
const RefundRequestsPage = lazy(() => import("./pages/client/RefundRequestsPage.tsx"));
const MyReviewsPage = lazy(() => import("./pages/client/MyReviewsPage.tsx"));
const PostTaskPage = lazy(() => import("./pages/PostTaskPage.tsx"));
const AIMatchPage = lazy(() => import("./pages/AIMatchPage.tsx"));
const ChatPage = lazy(() => import("./pages/ChatPage.tsx"));
const CouponsPage = lazy(() => import("./pages/admin/CouponsPage.tsx"));
const CmsPagesPage = lazy(() => import("./pages/admin/CmsPagesPage.tsx"));
const HomepageContentPage = lazy(() => import("./pages/admin/HomepageContentPage.tsx"));
const HomepageSectionsPage = lazy(() => import("./pages/admin/HomepageSectionsPage.tsx"));
const AdminEmailTemplatesPage = lazy(() => import("./pages/admin/EmailTemplatesPage.tsx"));
const AdminAdvertisementsPage = lazy(() => import("./pages/admin/AdvertisementsPage.tsx"));
const AdminBannersPage = lazy(() => import("./pages/admin/BannersPage.tsx"));
const CmsPageView = lazy(() => import("./pages/CmsPageView.tsx"));
const DisputesPage = lazy(() => import("./pages/admin/DisputesPage.tsx"));
const ModerationCenterPage = lazy(() => import("./pages/admin/ModerationCenterPage.tsx"));
const ModerationInboxPage = lazy(() => import("./pages/admin/ModerationInboxPage.tsx"));
const AdminModerationRoutingPage = lazy(() => import("./pages/admin/AdminModerationRoutingPage.tsx"));
const ModerationTemplatesPage = lazy(() => import("./pages/admin/ModerationTemplatesPage.tsx"));
const AdminRefundsPage = lazy(() => import("./pages/admin/RefundsPage.tsx"));
const AdminWithdrawalsPage = lazy(() => import("./pages/admin/WithdrawalsPage.tsx"));
const AdminUsersPage = lazy(() => import("./pages/admin/UsersPage.tsx"));
const AdminJobsPage = lazy(() => import("./pages/admin/JobsPage.tsx"));
const AdminFeaturedProvidersPage = lazy(() => import("./pages/admin/FeaturedProvidersPage.tsx"));
const AdminCommissionSettingsPage = lazy(() => import("./pages/admin/CommissionSettingsPage.tsx"));
const AdminSubscriptionsPage = lazy(() => import("./pages/admin/SubscriptionsPage.tsx"));
const AdminSponsorshipsPage = lazy(() => import("./pages/admin/SponsorshipsPage.tsx"));
const AdminSponsorshipSettingsPage = lazy(() => import("./pages/admin/SponsorshipSettingsPage.tsx"));
const AdminServicePromotionsPage = lazy(() => import("./pages/admin/ServicePromotionsPage.tsx"));
const AdminCategoriesPage = lazy(() => import("./pages/admin/CategoriesPage.tsx"));
const AdminLocationsPage = lazy(() => import("./pages/admin/LocationsPage.tsx"));
const AdminMissingCategoryIconsPage = lazy(() => import("./pages/admin/MissingCategoryIconsPage.tsx"));
const AdminTaxonomyAuditPage = lazy(() => import("./pages/admin/TaxonomyAuditPage.tsx"));
const AdminCategoryOverridesPage = lazy(() => import("./pages/admin/CategoryOverridesPage.tsx"));
const AdminAuditLogPage = lazy(() => import("./pages/admin/AuditLogPage.tsx"));
const ModerationAuditPage = lazy(() => import("./pages/admin/ModerationAuditPage.tsx"));
const AdminUnknownInviteRolesPage = lazy(() => import("./pages/admin/UnknownInviteRolesPage.tsx"));
const AdminContactMessagesPage = lazy(() => import("./pages/admin/ContactMessagesPage.tsx"));
const EmployerDashboard = lazy(() => import("./pages/employer/EmployerDashboard.tsx"));
const EmployerProfilePage = lazy(() => import("./pages/employer/EmployerProfilePage.tsx"));
const EmployerPostJobPage = lazy(() => import("./pages/employer/EmployerPostJobPage.tsx"));
const EmployerJobsPage = lazy(() => import("./pages/employer/EmployerJobsPage.tsx"));
const EmployerJobApplicantsPage = lazy(() => import("./pages/employer/EmployerJobApplicantsPage.tsx"));
const EmployerVerificationPage = lazy(() => import("./pages/employer/EmployerVerificationPage.tsx"));
const MyDisputesPage = lazy(() => import("./pages/client/MyDisputesPage.tsx"));
const ProviderLeadCreditsPage = lazy(() => import("./pages/provider/ProviderLeadCreditsPage.tsx"));
const ProviderReviewsPage = lazy(() => import("./pages/provider/ProviderReviewsPage.tsx"));
const CompleteProfilePage = lazy(() => import("./pages/CompleteProfilePage.tsx"));
const CategoryPage = lazy(() => import("./pages/CategoryPage.tsx"));
const ServiceDetailPage = lazy(() => import("./pages/ServiceDetailPage.tsx"));
const ProviderTaskFeedPage = lazy(() => import("./pages/provider/ProviderTaskFeedPage.tsx"));
const SavedJobsPage = lazy(() => import("./pages/provider/SavedJobsPage.tsx"));
const SponsorshipHistoryPage = lazy(() => import("./pages/provider/SponsorshipHistoryPage.tsx"));
const ApplicationsHistoryPage = lazy(() => import("./pages/provider/ApplicationsHistoryPage.tsx"));
const ProviderHolidaysPage = lazy(() => import("./pages/provider/ProviderHolidaysPage.tsx"));
const ProviderCustomersPage = lazy(() => import("./pages/provider/ProviderCustomersPage.tsx"));
const ProviderEnquiriesPage = lazy(() => import("./pages/provider/ProviderEnquiriesPage.tsx"));
const ProviderCouponsPage = lazy(() => import("./pages/provider/ProviderCouponsPage.tsx"));
const ProviderStaffPage = lazy(() => import("./pages/provider/ProviderStaffPage.tsx"));
const AcceptInvitePage = lazy(() => import("./pages/AcceptInvitePage.tsx"));
const BrowseTasksPage = lazy(() => import("./pages/BrowseTasksPage.tsx"));
const JobDetailPage = lazy(() => import("./pages/JobDetailPage.tsx"));
const ClientTaskDetailPage = lazy(() => import("./pages/client/ClientTaskDetailPage.tsx"));
const MyBookingsPage = lazy(() => import("./pages/client/MyBookingsPage.tsx"));
const ClientBookingDetailPage = lazy(() => import("./pages/client/ClientBookingDetailPage.tsx"));
const ClientSettingsPage = lazy(() => import("./pages/client/ClientSettingsPage.tsx"));
const ClientProfilePage = lazy(() => import("./pages/client/ClientProfilePage.tsx"));
const MyInvoicesPage = lazy(() => import("./pages/client/MyInvoicesPage.tsx"));
const StaffDashboard = lazy(() => import("./pages/StaffDashboard.tsx"));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout.tsx"));
const ModeratorLayout = lazy(() => import("./components/moderator/ModeratorLayout.tsx"));
const ModeratorDashboardPage = lazy(() => import("./pages/moderator/ModeratorDashboardPage.tsx"));
const InstallPage = lazy(() => import("./pages/InstallPage.tsx"));
const ProviderVerificationPage = lazy(() => import("./pages/provider/ProviderVerificationPage.tsx"));
const AdminVerificationsPage = lazy(() => import("./pages/admin/VerificationsPage.tsx"));
const AdminPaymentsDashboardPage = lazy(() => import("./pages/admin/PaymentsDashboardPage.tsx"));
const ProviderPaymentsPage = lazy(() => import("./pages/provider/ProviderPaymentsPage.tsx"));
const AdminNotificationPolicyPage = lazy(() => import("./pages/admin/NotificationPolicyPage.tsx"));
const AdminNotificationDeliveryLogsPage = lazy(() => import("./pages/admin/NotificationDeliveryLogsPage.tsx"));
const AdminVerificationRemindersPage = lazy(() => import("./pages/admin/VerificationRemindersPage.tsx"));
const AdminTenantPushDefaultsPage = lazy(() => import("./pages/admin/TenantPushDefaultsPage.tsx"));
const AdminBundleSizePage = lazy(() => import("./pages/admin/BundleSizePage.tsx"));
const AdminBrandingSettingsPage = lazy(() => import("./pages/admin/BrandingSettingsPage.tsx"));
const AdminBrandingVerifyPage = lazy(() => import("./pages/admin/BrandingVerifyPage.tsx"));
const AdminAnalyticsPage = lazy(() => import("./pages/admin/AnalyticsPage.tsx"));
const AdminFinancialAnalyticsPage = lazy(() => import("./pages/admin/FinancialAnalyticsPage.tsx"));
const AdminSearchRankingPage = lazy(() => import("./pages/admin/SearchRankingPage.tsx"));
const AdminExportReportsPage = lazy(() => import("./pages/admin/ExportReportsPage.tsx"));
const GlobalSearchPage = lazy(() => import("./pages/GlobalSearchPage.tsx"));
const DocsPage = lazy(() => import("./pages/DocsPage.tsx"));
const TypographyPlayground = lazy(() => import("./pages/TypographyPlayground.tsx"));
const RadiusPlayground = lazy(() => import("./pages/RadiusPlayground.tsx"));
const WorkflowPage = lazy(() => import("./pages/WorkflowPage.tsx"));

const queryClient = new QueryClient();

/**
 * Route-transition loader.
 *
 * Scoped to the content region only — we intentionally skip PageSkeleton's
 * fake HeaderBar/HeroBlock so the loader doesn't paint a full fake window
 * on every navigation. The real persistent chrome (header/sidebar) is owned
 * by each page's layout; during a lazy chunk load only the content area
 * shows the skeleton, matching the user's "affect the changing component,
 * not the full window" requirement.
 */
const PageLoader = () => (
  <PageSkeleton layout="cards" withHeader={false} count={6} className="pt-8" />
);

const App = () => {
  return (
    <>
      <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <OnboardingTourProvider>
              <SkipToContent />
              <PwaBrandingApplier />
              <FontLoadGuard />
              <PwaInstallPrompt />
              <ChatNotificationListener />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/help" element={<HelpSupportPage />} />
                  <Route path="/support" element={<HelpSupportPage />} />
                  <Route path="/features" element={<FeaturesPage />} />
                  <Route path="/browse" element={<BrowseServices />} />
                  <Route path="/search" element={<GlobalSearchPage />} />
                  <Route path="/providers" element={<ProviderMarketplacePage />} />
                  <Route path="/browse-tasks" element={<BrowseTasksPage />} />
                  <Route path="/jobs/:slug" element={<JobDetailPage />} />
                  <Route path="/category/:slug" element={<CategoryPage />} />
                  <Route path="/provider/:providerId" element={<ProviderProfilePage />} />
                  <Route path="/service/:serviceId" element={<ServiceDetailPage />} />
                  <Route path="/book" element={<ProtectedRoute requiredRole="customer"><BookService /></ProtectedRoute>} />
                  <Route path="/login" element={<LoginPage />} />

                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                  <Route path="/complete-profile" element={<CompleteProfilePage />} />

                  {/*
                    Authenticated dashboard shell.
                    Groups client/provider/employer/staff/shared authed routes
                    so header + sidebar + breadcrumb bar stay mounted across
                    internal navigations; only the <Outlet /> shows a scoped
                    skeleton during lazy chunk loads.

                    Pages excluded from the shell (below): pages that own
                    their own chrome (UnifiedHeader inside the page). Those
                    stay routed at the top level.
                  */}
                  <Route element={<DashboardShell />}>
                    {/* Client routes */}
                    <Route path="/client-dashboard" element={<ProtectedRoute requiredRole="customer"><ClientDashboard /></ProtectedRoute>} />
                    <Route path="/my-reviews" element={<ProtectedRoute requiredRole="customer"><MyReviewsPage /></ProtectedRoute>} />
                    <Route path="/my-tasks/:taskId" element={<ProtectedRoute requiredRole="customer"><ClientTaskDetailPage /></ProtectedRoute>} />
                    <Route path="/saved-providers" element={<ProtectedRoute requiredRole="customer"><SavedProvidersPage /></ProtectedRoute>} />
                    <Route path="/my-disputes" element={<ProtectedRoute requiredRole="customer"><MyDisputesPage /></ProtectedRoute>} />
                    <Route path="/my-bookings" element={<ProtectedRoute requiredRole="customer"><MyBookingsPage /></ProtectedRoute>} />
                    <Route path="/my-bookings/:bookingId" element={<ProtectedRoute requiredRole="customer"><ClientBookingDetailPage /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute requiredRole="customer"><ClientSettingsPage /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute requiredRole="customer"><ClientProfilePage /></ProtectedRoute>} />

                    {/* Provider routes */}
                    <Route path="/provider-dashboard" element={<ProtectedRoute requiredRole="provider"><ProviderDashboard /></ProtectedRoute>} />
                    <Route path="/provider-bookings" element={<ProtectedRoute requiredRole="provider"><ProviderBookingsPage /></ProtectedRoute>} />
                    <Route path="/provider-earnings" element={<ProtectedRoute requiredRole="provider"><ProviderEarningsPage /></ProtectedRoute>} />
                    <Route path="/provider-payments" element={<ProtectedRoute requiredRole="provider"><ProviderPaymentsPage /></ProtectedRoute>} />
                    <Route path="/provider-lead-credits" element={<ProtectedRoute requiredRole="provider"><ProviderLeadCreditsPage /></ProtectedRoute>} />
                    <Route path="/provider-withdrawals" element={<ProtectedRoute requiredRole="provider"><ProviderWithdrawalsPage /></ProtectedRoute>} />
                    <Route path="/provider-reviews" element={<ProtectedRoute requiredRole="provider"><ProviderReviewsPage /></ProtectedRoute>} />
                    <Route path="/provider-services" element={<ProtectedRoute requiredRole="provider"><ProviderServicesPage /></ProtectedRoute>} />
                    <Route path="/provider-availability" element={<ProtectedRoute requiredRole="provider"><ProviderAvailabilityPage /></ProtectedRoute>} />
                    <Route path="/provider-profile" element={<ProtectedRoute requiredRole="provider"><ProviderProfilePage2 /></ProtectedRoute>} />
                    <Route path="/provider-settings" element={<ProtectedRoute requiredRole="provider"><ProviderSettingsPage /></ProtectedRoute>} />
                    <Route path="/provider-tasks" element={<ProtectedRoute requiredRole="provider"><ProviderTaskFeedPage /></ProtectedRoute>} />
                    <Route path="/provider/saved-jobs" element={<ProtectedRoute requiredRole="provider"><SavedJobsPage /></ProtectedRoute>} />
                    <Route path="/provider/applications" element={<ProtectedRoute requiredRole="provider"><ApplicationsHistoryPage /></ProtectedRoute>} />
                    <Route path="/provider-holidays" element={<ProtectedRoute requiredRole="provider"><ProviderHolidaysPage /></ProtectedRoute>} />
                    <Route path="/provider-customers" element={<ProtectedRoute requiredRole="provider"><ProviderCustomersPage /></ProtectedRoute>} />
                    <Route path="/provider-enquiries" element={<ProtectedRoute requiredRole="provider"><ProviderEnquiriesPage /></ProtectedRoute>} />
                    <Route path="/provider-coupons" element={<ProtectedRoute requiredRole="provider"><ProviderCouponsPage /></ProtectedRoute>} />
                    <Route path="/provider-staff" element={<ProtectedRoute requiredRole="provider"><ProviderStaffPage /></ProtectedRoute>} />
                    <Route path="/provider-verification" element={<ProtectedRoute requiredRole="provider"><ProviderVerificationPage /></ProtectedRoute>} />
                    <Route path="/provider-subscription" element={<ProtectedRoute requiredRole="provider"><ProviderSubscriptionPage /></ProtectedRoute>} />

                    {/* Staff routes — gated via ProtectedRoute requiredRole="provider" (staff treated as provider) */}
                    <Route path="/staff-dashboard" element={<ProtectedRoute requiredRole="provider"><StaffDashboard /></ProtectedRoute>} />

                    {/* Employer routes */}
                    <Route path="/employer-dashboard" element={<ProtectedRoute requiredRole="employer"><EmployerDashboard /></ProtectedRoute>} />
                    <Route path="/employer-profile" element={<ProtectedRoute requiredRole="employer"><EmployerProfilePage /></ProtectedRoute>} />
                    <Route path="/employer-post-job" element={<ProtectedRoute requiredRole="employer"><EmployerPostJobPage /></ProtectedRoute>} />
                    <Route path="/employer-jobs" element={<ProtectedRoute requiredRole="employer"><EmployerJobsPage /></ProtectedRoute>} />
                    <Route path="/employer-jobs/:taskId/applicants" element={<ProtectedRoute requiredRole="employer"><EmployerJobApplicantsPage /></ProtectedRoute>} />
                    <Route path="/employer-verification" element={<ProtectedRoute requiredRole="employer"><EmployerVerificationPage /></ProtectedRoute>} />

                    {/* Shared authenticated (pages that use DashboardLayout) */}
                    <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                    <Route path="/workflow" element={<ProtectedRoute><WorkflowPage /></ProtectedRoute>} />
                  </Route>

                  {/* Authenticated pages that own their own chrome — kept at the top level, outside the dashboard shell. */}
                  <Route path="/wallet" element={<ProtectedRoute requiredRole="customer"><WalletPage /></ProtectedRoute>} />
                  <Route path="/payment-history" element={<ProtectedRoute requiredRole="customer"><PaymentHistoryPage /></ProtectedRoute>} />
                  <Route path="/refund-requests" element={<ProtectedRoute requiredRole="customer"><RefundRequestsPage /></ProtectedRoute>} />
                  <Route path="/post-task" element={<ProtectedRoute requiredRole="customer"><PostTaskPage /></ProtectedRoute>} />
                  <Route path="/my-invoices" element={<ProtectedRoute requiredRole="customer"><MyInvoicesPage /></ProtectedRoute>} />
                  <Route path="/provider/sponsorships" element={<ProtectedRoute requiredRole="provider"><SponsorshipHistoryPage /></ProtectedRoute>} />
                  <Route path="/accept-invite/:token" element={<AcceptInvitePage />} />
                  <Route path="/ai-match" element={<ProtectedRoute><AIMatchPage /></ProtectedRoute>} />
                  <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
                  <Route path="/chat/:conversationId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
                  <Route path="/activity" element={<ProtectedRoute><ActivityPage /></ProtectedRoute>} />

                  {/* Moderator routes — dedicated Trust & Safety workspace */}
                  <Route
                    path="/moderator"
                    element={
                      <ProtectedRoute requiredRole="moderator">
                        <ModeratorLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<ModeratorDashboardPage />} />
                    <Route path="inbox" element={<ModerationInboxPage />} />
                    <Route path="verifications" element={<AdminVerificationsPage />} />
                    <Route path="reports" element={<ModerationCenterPage />} />
                    <Route path="disputes" element={<DisputesPage />} />
                    <Route path="refunds" element={<AdminRefundsPage />} />
                    <Route path="templates" element={<ModerationTemplatesPage />} />
                    <Route path="audit" element={<AdminAuditLogPage />} />
                  </Route>

                  {/* Admin routes — nested under AdminLayout sidebar */}
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <AdminLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<AdminDashboard />} />
                    {/* Services */}
                    <Route path="categories" element={<AdminCategoriesPage />} />
                    <Route path="categories/missing-icons" element={<AdminMissingCategoryIconsPage />} />
                    <Route path="categories/audit" element={<AdminTaxonomyAuditPage />} />
                    <Route path="categories/overrides" element={<AdminCategoryOverridesPage />} />
                    <Route path="locations" element={<AdminLocationsPage />} />
                    {/* Finance & Accounts */}
                    <Route path="refunds" element={<AdminRefundsPage />} />
                    <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
                    {/* Content */}
                    <Route path="cms" element={<CmsPagesPage />} />
                    <Route path="homepage" element={<HomepageContentPage />} />
                    <Route path="homepage/sections" element={<HomepageSectionsPage />} />
                    
                    <Route path="email-templates" element={<AdminEmailTemplatesPage />} />
                    <Route path="advertisements" element={<AdminAdvertisementsPage />} />
                    <Route path="banners" element={<AdminBannersPage />} />
                    {/* Reports */}
                    <Route path="earnings" element={<EarningsPage />} />
                    {/* User Management */}
                    <Route path="users" element={<AdminUsersPage />} />
                    <Route path="verifications" element={<AdminVerificationsPage />} />
                    <Route path="jobs" element={<AdminJobsPage />} />
                    <Route path="featured-providers" element={<AdminFeaturedProvidersPage />} />
                    <Route path="commission-settings" element={<AdminCommissionSettingsPage />} />
                    <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
                    <Route path="sponsorships" element={<AdminSponsorshipsPage />} />
                    <Route path="sponsorships/settings" element={<AdminSponsorshipSettingsPage />} />
                    <Route path="service-promotions" element={<AdminServicePromotionsPage />} />
                    {/* Marketing */}
                    <Route path="coupons" element={<CouponsPage />} />
                    {/* Support */}
                    <Route path="contact-messages" element={<AdminContactMessagesPage />} />
                    <Route path="disputes" element={<DisputesPage />} />
                    <Route path="moderation" element={<ModerationCenterPage />} />
                    <Route path="inbox" element={<ModerationInboxPage />} />
                    <Route path="moderation-routing" element={<AdminModerationRoutingPage />} />
                    <Route path="response-templates" element={<ModerationTemplatesPage />} />
                    <Route path="audit" element={<AdminAuditLogPage />} />
                    <Route path="moderation-audit" element={<ModerationAuditPage />} />
                    <Route path="unknown-invite-roles" element={<AdminUnknownInviteRolesPage />} />
                    {/* Payments dashboard (Stripe/PayPal transactions + commission) */}
                    <Route path="payments" element={<AdminPaymentsDashboardPage />} />
                    <Route path="analytics" element={<AdminAnalyticsPage />} />
                    <Route path="financial-analytics" element={<AdminFinancialAnalyticsPage />} />
                    <Route path="search-ranking" element={<AdminSearchRankingPage />} />
                    <Route path="exports" element={<AdminExportReportsPage />} />
                    {/* Settings */}
                    <Route path="payment-settings" element={<PaymentSettingsPage />} />
                    <Route path="platform-settings" element={<PlatformSettingsPage />} />
                    

                    <Route path="notification-policy" element={<AdminNotificationPolicyPage />} />
                    <Route path="notification-logs" element={<AdminNotificationDeliveryLogsPage />} />
                    <Route path="verification-reminders" element={<AdminVerificationRemindersPage />} />
                    <Route path="push-defaults" element={<AdminTenantPushDefaultsPage />} />
                    <Route path="bundle-size" element={<AdminBundleSizePage />} />
                    <Route path="branding" element={<AdminBrandingSettingsPage />} />
                    <Route path="branding-verify" element={<AdminBrandingVerifyPage />} />
                  </Route>

                  <Route path="/page/:slug" element={<CmsPageView />} />
                  <Route path="/install" element={<InstallPage />} />
                  <Route path="/docs" element={<DocsPage />} />
                  <Route path="/docs/:section" element={<DocsPage />} />
                  <Route path="/typography" element={<TypographyPlayground />} />
                  <Route path="/radius" element={<RadiusPlayground />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              </OnboardingTourProvider>

            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
      </ThemeProvider>
    </>
  );
};

export default App;
