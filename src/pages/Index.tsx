import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench, Gauge, Shield, Sparkles, User, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import DiagnosticForm from "@/components/DiagnosticForm";

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
    <div className="min-h-screen">
      <header className="container mx-auto py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-primary animate-gradient-slow shadow-glow" aria-hidden />
          <span className="text-lg font-semibold">AutoSense AI</span>
        </div>
        
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{user.email}</span>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
            </>
          ) : (
            <Button asChild variant="hero" size="lg">
              <a href="/auth" aria-label="Sign in">Sign in</a>
            </Button>
          )}
          
          {user && (
            <Button asChild variant="secondary" size="lg">
              <a href="#diagnose" aria-label="Start diagnosis">Start diagnosis</a>
            </Button>
          )}
        </div>
      </header>

      <main>
        {/* Hero */}
        <section ref={heroRef} onMouseMove={onHeroMouseMove} className="bg-spotlight">
          <div className="container mx-auto py-16 md:py-24 text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
              AI Vehicle Diagnostic
            </h1>
            <p className="mt-4 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Describe your car’s symptoms and get likely faults with step‑by‑step fixes. No hardware, no hassle.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Button variant="hero" size="lg" asChild>
                <a href="#diagnose"><Wrench /> Diagnose my car</a>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <a href="#how-it-works"><Sparkles /> How it works</a>
              </Button>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="hover-lift">
                <CardContent className="p-6 flex items-start gap-4">
                  <Wrench />
                  <div>
                    <p className="font-semibold">Text-based diagnosis</p>
                    <p className="text-sm text-muted-foreground">Type symptoms; get likely fault and actions.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover-lift">
                <CardContent className="p-6 flex items-start gap-4">
                  <Gauge />
                  <div>
                    <p className="font-semibold">Confidence scoring</p>
                    <p className="text-sm text-muted-foreground">See confidence and other possibilities.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover-lift">
                <CardContent className="p-6 flex items-start gap-4">
                  <Shield />
                  <div>
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
          <div className="container mx-auto">
            <DiagnosticForm />
          </div>
        </section>
      </main>

      <footer className="py-10 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} AutoSense AI • For guidance only, not a replacement for professional inspection.
      </footer>
    </div>
  );
};

export default Index;
