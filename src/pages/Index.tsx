import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Stethoscope, Shield, Zap, User, LogOut, ChevronRight, History as HistoryIcon } from 'lucide-react';
import { useAuth } from "@/hooks/useAuth";
import DiagnosticForm from "@/components/DiagnosticForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ParticleBackground } from "@/components/ParticleBackground";

const Index = () => {
  const heroRef = useRef<HTMLDivElement | null>(null);
  const { user, signOut, loading } = useAuth();

  useEffect(() => {
    // SEO tags
    document.title = "AI Vehicle Diagnostic | Fault & Fix Suggestions";
    const desc = "Describe car issues and get likely faults with actionable fixes — instantly.";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", desc);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", "AI Vehicle Diagnostic");
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", desc);

    // Canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", window.location.origin + "/");

    // JSON-LD
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "AI Vehicle Diagnostic",
      applicationCategory: "Automotive",
      operatingSystem: "Web",
      description: desc,
      offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
    });
    document.head.appendChild(ld);
    return () => {
      document.head.removeChild(ld);
    };
  }, []);

  const onHeroMouseMove = (e: React.MouseEvent) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    heroRef.current.style.setProperty("--spot-x", `${x}%`);
    heroRef.current.style.setProperty("--spot-y", `${y}%`);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen relative">
      {/* Particle Background */}
      <ParticleBackground className="opacity-60" particleCount={80} />
      
      <header className="container mx-auto px-4 py-6 animate-fade-in relative z-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2 animate-slide-in-left">
            <div className="h-8 w-8 rounded-md bg-gradient-primary animate-gradient-slow shadow-glow hover-scale" aria-hidden />
            <span className="text-lg font-semibold">AutoSense AI</span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap animate-slide-in-right">
            <ThemeToggle />
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground animate-scale-in animate-delay-100">
                  <User className="h-4 w-4" />
                  <span className="truncate max-w-32 md:max-w-none">{user.email}</span>
                </div>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="gap-2 hover-lift animate-scale-in animate-delay-200"
                >
                  <a href="/history">
                    <HistoryIcon className="h-4 w-4" />
                    History
                  </a>
                </Button>
                <Button variant="outline" onClick={handleSignOut} size="sm" className="sm:size-default hover-lift animate-scale-in animate-delay-300">
                  <LogOut className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </>
            ) : (
              <Button asChild variant="hero" size="sm" className="sm:size-lg hover-lift hover-glow animate-scale-in">
                <a href="/auth" aria-label="Sign in">Sign in</a>
              </Button>
            )}
            
            {user && (
              <Button asChild variant="secondary" size="sm" className="sm:size-lg hover-lift animate-scale-in animate-delay-400">
                <a href="#diagnose" aria-label="Start diagnosis">Start diagnosis</a>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section ref={heroRef} onMouseMove={onHeroMouseMove} className="bg-spotlight bg-particles overflow-hidden">
          <div className="container mx-auto px-4 py-16 md:py-24 text-center">
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold tracking-tight animate-slide-up">
              AI Vehicle Diagnostic
            </h1>
            <p className="mt-4 text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4 animate-fade-in animate-delay-200">
              Describe your car's symptoms and get likely faults with step‑by‑step fixes. No hardware, no hassle.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 animate-scale-in animate-delay-400">
              <Button variant="hero" size="lg" asChild className="w-full sm:w-auto hover-lift hover-glow shadow-intense">
                <a href="#diagnose"><Stethoscope className="mr-2" /> Diagnose my car</a>
              </Button>
              <Button variant="secondary" size="lg" asChild className="w-full sm:w-auto hover-lift">
                <a href="#how-it-works"><Zap className="mr-2" /> How it works</a>
              </Button>
            </div>

            <div className="mt-12 px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="hover-lift hover-glow glass-enhanced border-0 shadow-soft animate-slide-in-left animate-delay-100">
                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start gap-4">
                  <div className="p-2 rounded-full bg-brand/10 animate-pulse-slow">
                    <Stethoscope className="h-5 w-5 flex-shrink-0 text-primary" />
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="font-semibold">Text-based diagnosis</p>
                    <p className="text-sm text-muted-foreground">Type symptoms; get likely fault and actions.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover-lift hover-glow glass-enhanced border-0 shadow-soft animate-slide-up animate-delay-200">
                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start gap-4">
                  <div className="p-2 rounded-full bg-brand/10 animate-pulse-slow">
                    <Zap className="h-5 w-5 flex-shrink-0 text-primary" />
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="font-semibold">Confidence scoring</p>
                    <p className="text-sm text-muted-foreground">See confidence and other possibilities.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover-lift hover-glow glass-enhanced border-0 shadow-soft sm:col-span-2 lg:col-span-1 animate-slide-in-right animate-delay-300">
                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start gap-4">
                  <div className="p-2 rounded-full bg-brand/10 animate-pulse-slow">
                    <Shield className="h-5 w-5 flex-shrink-0 text-primary" />
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="font-semibold">Safety first</p>
                    <p className="text-sm text-muted-foreground">Clear guidance when to stop and seek help.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Diagnostic form */}
        <section className="py-12 md:py-16" id="how-it-works">
          <div className="container mx-auto px-4">
            <DiagnosticForm />
          </div>
        </section>
      </main>

      <footer className="py-10 px-4 text-center text-xs sm:text-sm text-muted-foreground">
        <div className="container mx-auto">
          © {new Date().getFullYear()} AutoSense AI • For guidance only, not a replacement for professional inspection.
        </div>
      </footer>
    </div>
  );
};

export default Index;