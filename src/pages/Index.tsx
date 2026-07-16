import UnifiedHeader from"@/components/header/UnifiedHeader";
import PromoBanner from"@/components/landing/PromoBanner";
import HeroSection from"@/components/landing/HeroSection";
import StatsCounterSection from"@/components/landing/StatsCounterSection";
import HowItWorksSection from"@/components/landing/HowItWorksSection";
import FeaturesSection from"@/components/landing/FeaturesSection";
import TestimonialsSection from"@/components/landing/TestimonialsSection";
import CTASection from"@/components/landing/CTASection";
import PostServiceBanner from"@/components/landing/PostServiceBanner";
import TrustSecuritySection from"@/components/landing/TrustSecuritySection";
import FAQSection from"@/components/landing/FAQSection";
import ContactSection from"@/components/landing/ContactSection";
import Footer from"@/components/landing/Footer";
import SEOHead from"@/components/SEOHead";
import HomepageSections from"@/components/landing/HomepageSections";
import { useHomepageContent } from"@/hooks/useHomepageContent";
import { usePwaBranding } from"@/hooks/usePwaBranding";

const Index = () => {
 const { content } = useHomepageContent();
 const { siteName } = usePwaBranding();
 const brand = siteName || "TaskHive";
 return (
 <div className="min-h-screen">
 <SEOHead
 title="Home"
 description="Book trusted handyman professionals in minutes. AI-powered matching, real-time bookings for on-demand home services."
 canonical="https://taskhive.app/"
 jsonLd={{
"@context":"https://schema.org",
"@type":"WebApplication",
 name: brand,
 description:"On-Demand & Handyman Services Marketplace",
 applicationCategory:"BusinessApplication",
 operatingSystem:"Web",
 offers: {
"@type":"Offer",
 price:"0",
 priceCurrency:"USD",
 },
 }}
 />
 <UnifiedHeader />
 <PromoBanner />
 <main id="main-content" tabIndex={-1} className="">
 <HeroSection />
 <HomepageSections sections={content.sections} />
 <StatsCounterSection />
 <HowItWorksSection />
 <FeaturesSection />
 <TestimonialsSection />
 <PostServiceBanner />
 <TrustSecuritySection />
 <CTASection />
 <FAQSection />
 <ContactSection />
 </main>
 <Footer />
 </div>
 );
};

export default Index;
