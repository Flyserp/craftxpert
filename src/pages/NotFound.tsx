import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Search } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { Heading } from "@/components/ui/app";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <>
      <SEOHead title="Page Not Found" description="The page you're looking for doesn't exist." />
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center px-6 max-w-md">
          {/* Large decorative 404 */}
          <div className="relative mb-8">
            <span className="text-[10rem] sm:text-[12rem] font-black leading-none text-primary/[0.06] select-none block">
              404
            </span>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-sm bg-primary/10 flex items-center justify-center">
                <Search className="w-9 h-9 text-primary" />
              </div>
            </div>
          </div>

          <Heading level={1}  className="mb-3">
            Page not found
          </Heading>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            The page you're looking for doesn't exist or has been moved. Let's get you back on track.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" className="gap-2" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4" /> Go Back
            </Button>
            <Button asChild className="gap-2">
              <Link to="/"><Home className="w-4 h-4" /> Back to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotFound;
