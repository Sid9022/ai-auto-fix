import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Wrench, Lightbulb, Loader2, Gauge, ShieldCheck, Settings, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export type Severity = "low" | "medium" | "high";

export interface DiagnosisResult {
  fault: string;
  confidence: number; // 0..1
  severity: Severity;
  explanation: string;
  actions: string[];
}

export interface AnalysisOutput {
  primary: DiagnosisResult;
  alternatives: Array<Pick<DiagnosisResult, "fault" | "confidence" | "severity">>;
}

// Very lightweight rules-based analyzer as a stand-in for AI
function analyzeDescription(text: string): AnalysisOutput {
  const t = text.toLowerCase();
  const hits: DiagnosisResult[] = [];

  const add = (
    fault: string,
    confidence: number,
    severity: Severity,
    explanation: string,
    actions: string[]
  ) => hits.push({ fault, confidence, severity, explanation, actions });

  if (/won't start|no start|clicking|starter|crank|cranking/.test(t)) {
    add(
      "Starter motor or solenoid",
      0.78,
      "high",
      "Clicking sound but engine won't crank. Lights and electronics may work, indicating battery isn't completely dead.",
      [
        "Check battery health and terminals are tight and clean",
        "Measure voltage drop while trying to start",
        "Tap starter lightly and attempt start (temporary)",
        "Replace starter/solenoid if tests confirm failure",
      ]
    );
  }

  if (/battery|dim lights|dead|won.?t hold charge|slow crank/.test(t)) {
    add(
      "Weak or failing battery",
      0.74,
      "medium",
      "Dim lights and slow cranking. Older battery or extreme temperatures accelerate wear.",
      [
        "Inspect/clean battery terminals",
        "Test battery with multimeter (resting >12.4V)",
        "Load-test at auto parts store",
        "Replace battery if below spec",
      ]
    );
  }

  if (/alternator|charging light|battery light|whine|electrical smell/.test(t)) {
    add(
      "Alternator not charging",
      0.72,
      "high",
      "Battery light on while driving. Whining noise changes with RPM.",
      [
        "Measure voltage with engine running (13.8–14.6V typical)",
        "Inspect alternator belt tension and condition",
        "Replace alternator if output is low",
      ]
    );
  }

  if (/overheat|overheating|coolant|steam|temperature gauge/.test(t)) {
    add(
      "Cooling system issue (thermostat/radiator/fan)",
      0.76,
      "high",
      "Temperature gauge climbs, possible coolant smell. Fan may not engage at idle.",
      [
        "Stop safely; allow engine to cool",
        "Check coolant level and leaks",
        "Inspect radiator fan and thermostat",
        "Do not open hot radiator cap; seek service if persistent",
      ]
    );
  }

  if (/squeak|squeal|brake|grind|braking/.test(t)) {
    add(
      "Worn brake pads or rotor issue",
      0.69,
      "high",
      "Squeal/squeak when braking. Grinding indicates pad worn to metal.",
      [
        "Inspect pad thickness and rotor condition",
        "Avoid driving if grinding; replace pads/rotors",
        "Bleed brakes and test safely",
      ]
    );
  }

  if (/shake|vibration|highway|steering wheel/.test(t)) {
    add(
      "Wheel balance or suspension component",
      0.63,
      "medium",
      "Vibration at certain speeds or under braking. May be uneven tire wear or warped rotors.",
      [
        "Check tire pressures and wear",
        "Balance/rotate tires",
        "Inspect control arms, tie rods, bushings",
      ]
    );
  }

  if (/hesitation|misfire|rough idle|check engine|p0\d{3}/.test(t)) {
    add(
      "Ignition or fuel delivery (misfire)",
      0.7,
      "medium",
      "Rough idle, stutter on acceleration. Check engine light may flash.",
      [
        "Scan for OBD-II codes",
        "Inspect spark plugs, coils, and fuel filter",
        "Check for vacuum leaks",
      ]
    );
  }

  if (/slip|revving|transmission|hard shift|delay/.test(t)) {
    add(
      "Automatic transmission slipping or low fluid",
      0.66,
      "high",
      "Engine revs but poor acceleration. Harsh or delayed shifts.",
      [
        "Check transmission fluid level/condition (if serviceable)",
        "Address leaks; service fluid/filter",
        "Seek transmission specialist if unresolved",
      ]
    );
  }

  if (hits.length === 0) {
    add(
      "General diagnostic required",
      0.4,
      "medium",
      "No strong pattern matched your description.",
      [
        "Scan for fault codes",
        "Note when symptoms occur (cold/hot, speed, load)",
        "Provide more details such as noises, lights, and conditions",
      ]
    );
  }

  hits.sort((a, b) => b.confidence - a.confidence);
  const [primary, ...rest] = hits;
  const alternatives = rest.slice(0, 3).map((r) => ({
    fault: r.fault,
    confidence: r.confidence * 0.9,
    severity: r.severity,
  }));

  return { primary, alternatives };
}

function formatConfidence(n: number) {
  return `${Math.round(n * 100)}%`;
}

export default function DiagnosticForm() {
  const [description, setDescription] = useState("");
  const [modelEndpoint, setModelEndpoint] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisOutput | null>(null);

  const severityBadge: Record<Severity, { label: string; variant: "default" | "secondary" | "destructive" }> = useMemo(
    () => ({
      low: { label: "Low", variant: "secondary" },
      medium: { label: "Medium", variant: "default" },
      high: { label: "High", variant: "destructive" },
    }),
    []
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast({
        title: "Add a brief description",
        description: "Tell us the symptoms (sounds, lights, behavior).",
      });
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('vehicle-diagnosis', {
        body: { 
          description: description.trim(),
          modelEndpoint: modelEndpoint.trim() || undefined
        }
      });

      if (error) {
        throw error;
      }

      setResult(data);
      toast({
        title: "AI Diagnosis Complete",
        description: "Your vehicle symptoms have been analyzed successfully",
      });
    } catch (error) {
      console.error('Diagnosis error:', error);
      toast({
        title: "Analysis Error",
        description: "Using fallback analysis. Please check your model endpoint.",
        variant: "destructive"
      });
      // Fallback to local analysis
      const out = analyzeDescription(description);
      setResult(out);
    }
    
    setLoading(false);
  };

  return (
    <section id="diagnose" aria-labelledby="diagnose-title" className="container mx-auto">
      <Card className="shadow-elevated">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle id="diagnose-title" className="text-2xl">AI Vehicle Diagnosis</CardTitle>
              <CardDescription>
                Connect your trained model and get AI-powered fault detection with Gemini-generated solutions
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Model Settings
            </Button>
          </div>
          
          {showSettings && (
            <div className="mt-4 p-4 rounded-lg border bg-muted/50 space-y-3">
              <div>
                <label htmlFor="model-endpoint" className="text-sm font-medium">
                  Your Model API Endpoint (Optional)
                </label>
                <Input
                  id="model-endpoint"
                  placeholder="https://your-model-api.com/predict"
                  value={modelEndpoint}
                  onChange={(e) => setModelEndpoint(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your Google Colab model's API endpoint. Leave empty to use fallback analysis.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ExternalLink className="h-3 w-3" />
                <span>Your model should accept POST requests with {"{"}"description": "symptom text"{"}"}</span>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <label htmlFor="symptoms" className="sr-only">Problem description</label>
            <Textarea
              id="symptoms"
              placeholder="Example: Car struggles to start in the morning, battery light flickers while driving and there's a whining sound with RPM."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
            />
            <div className="flex items-center gap-3">
              <Button type="submit" variant="hero" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" /> Analyzing with AI
                  </>
                ) : (
                  <>
                    <Wrench /> Get AI Diagnosis
                  </>
                )}
              </Button>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-secondary/60">AI-Powered Analysis</Badge>
                {modelEndpoint && <Badge variant="outline">Custom Model</Badge>}
              </div>
            </div>
          </form>

          {result && (
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <article className="md:col-span-2 p-6 rounded-lg border bg-card hover-lift">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      <AlertTriangle className="text-destructive" /> Likely fault: {result.primary.fault}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">Confidence {formatConfidence(result.primary.confidence)}</p>
                  </div>
                  <Badge variant={severityBadge[result.primary.severity].variant}>
                    Severity: {severityBadge[result.primary.severity].label}
                  </Badge>
                </div>

                <div className="mt-4 text-sm leading-relaxed">
                  {result.primary.explanation}
                </div>

                <div className="mt-5">
                  <h4 className="text-base font-medium flex items-center gap-2">
                    <Lightbulb /> AI-Generated Solution
                  </h4>
                  <div className="mt-2 text-sm leading-relaxed whitespace-pre-line">
                    {result.primary.actions[0]}
                  </div>
                </div>

                <p className="mt-4 text-xs text-muted-foreground flex items-center gap-2">
                  <ShieldCheck /> AI-powered diagnosis with Gemini 1.5. Always consult a professional for safety-critical repairs.
                </p>
              </article>

              <aside aria-label="Other possibilities" className="p-6 rounded-lg border bg-card hover-lift">
                <h4 className="text-base font-semibold flex items-center gap-2"><Gauge /> Other possibilities</h4>
                <div className="mt-3 space-y-3">
                  {result.alternatives.map((alt, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{alt.fault}</p>
                        <p className="text-xs text-muted-foreground">Confidence {formatConfidence(alt.confidence)}</p>
                      </div>
                      <Badge variant={severityBadge[alt.severity].variant}>{severityBadge[alt.severity].label}</Badge>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
