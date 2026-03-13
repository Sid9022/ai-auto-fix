import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wrench, AlertCircle, Download, Settings, AlertTriangle, Lightbulb, Gauge, ShieldCheck, ExternalLink, FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generatePDF } from '@/lib/pdfGenerator';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useHistory } from '@/hooks/useHistory';

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
  pdfContent?: string;
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

const DiagnosticForm: React.FC = () => {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [result, setResult] = useState<AnalysisOutput | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { toast } = useToast();
  const { addToHistory } = useHistory();

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
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('vehicle-diagnosis', {
        body: { 
          description: description.trim()
        }
      });

      if (error) {
        throw error;
      }

      if (data && data.primary) {
        const analysisResult: AnalysisOutput = {
          primary: data.primary,
          alternatives: data.alternatives || []
        };
        setResult(analysisResult);
        
        // Save to history
        await addToHistory({
          description,
          predicted_fault: data.primary.fault,
          confidence: data.primary.confidence,
          severity: data.primary.severity,
          explanation: data.primary.explanation,
          recommended_actions: data.primary.actions,
          alternatives: data.alternatives || [],
          pdf_content: data.pdfContent || undefined,
          model_used: 'ai-diagnosis',
          analysis_duration: Date.now() - startTime
        });
        
        toast({
          title: "Diagnosis Complete",
          description: "AI analysis completed successfully and saved to history!",
        });
      } else {
        throw new Error('Invalid response from AI diagnosis');
      }
      
    } catch (error) {
      console.error('Diagnosis error:', error);
      toast({
        title: "Analysis Error",
        description: "Using fallback analysis. Please check your model settings.",
        variant: "destructive"
      });
      // Fallback to rules-based analysis
      console.log('Using fallback rules-based analysis');
      const fallbackResult = analyzeDescription(description);
      setResult(fallbackResult);
      
      // Save fallback result to history
      await addToHistory({
        description,
        predicted_fault: fallbackResult.primary.fault,
        confidence: fallbackResult.primary.confidence,
        severity: fallbackResult.primary.severity,
        explanation: fallbackResult.primary.explanation,
        recommended_actions: fallbackResult.primary.actions,
        alternatives: fallbackResult.alternatives || [],
        model_used: 'rules-based',
        analysis_duration: Date.now() - startTime
      });
      
      toast({
        title: "Analysis Complete",
        description: "Used local analysis (AI service unavailable) and saved to history",
        variant: "default",
      });
    }
    
    setLoading(false);
  };

  const handleGeneratePDF = async () => {
    if (!result) return;

    setPdfLoading(true);
    try {
      await generatePDF({
        description,
        primaryDiagnosis: {
          fault: result.primary.fault,
          confidence: result.primary.confidence * 100,
          severity: result.primary.severity as 'low' | 'medium' | 'high',
          explanation: result.primary.explanation,
          actions: result.primary.actions
        },
        alternatives: result.alternatives || [],
        pdfContent: null
      });
      
      toast({
        title: "PDF Generated",
        description: "Diagnostic report downloaded successfully",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF report",
        variant: "destructive",
      });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <section id="diagnose" aria-labelledby="diagnose-title" className="w-full max-w-none animate-fade-in">
      <Card className="shadow-elevated hover-lift border-0 glass backdrop-blur-sm">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0 animate-slide-in-left">
              <CardTitle id="diagnose-title" className="text-xl sm:text-2xl">AI Vehicle Diagnosis</CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Connect your trained model and get AI-powered fault detection with Gemini-generated solutions
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 flex-shrink-0 hover-lift animate-slide-in-right"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Model Settings</span>
            </Button>
          </div>
          
          {showSettings && (
            <div className="mt-4 p-4 rounded-lg border bg-muted/50 space-y-3 animate-slide-up glass">
              <div className="flex items-center gap-2 text-sm text-muted-foreground animate-fade-in">
                <ExternalLink className="h-3 w-3 animate-pulse-slow" />
                <span>Connected to: kingkill1111/vehicle-diagnosis-ai (Gradio)</span>
              </div>
              <p className="text-xs text-muted-foreground animate-fade-in animate-delay-100">
                Using your trained model for fault prediction. Google Gemini AI generates solutions and handles unknown faults.
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-4 sm:p-6 animate-slide-up animate-delay-200">
          <form onSubmit={onSubmit} className="space-y-4">
            <label htmlFor="symptoms" className="sr-only">Problem description</label>
            <Textarea
              id="symptoms"
              placeholder="Example: Car struggles to start in the morning, battery light flickers while driving and there's a whining sound with RPM."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="min-h-[120px] sm:min-h-[140px] transition-all duration-300 focus:scale-[1.02] focus:shadow-glow border-0 glass"
            />
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button type="submit" variant="hero" size="lg" disabled={loading} className="w-full sm:w-auto hover-lift hover-glow shadow-intense">
                {loading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" /> Analyzing with AI
                  </>
                ) : (
                  <>
                    <Wrench className="mr-2" /> Get AI Diagnosis
                  </>
                )}
              </Button>
              {result && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleGeneratePDF}
                  disabled={pdfLoading}
                  className="w-full sm:w-auto hover-lift animate-scale-in"
                >
                  {pdfLoading ? (
                    <>
                      <Loader2 className="animate-spin mr-2" /> Generating PDF...
                    </>
                  ) : (
                    <>
                      <FileDown className="mr-2" /> Download PDF Report
                    </>
                  )}
                </Button>
              )}
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <Badge variant="secondary" className="bg-secondary/60 text-xs animate-bounce-in animate-delay-100">AI-Powered Analysis</Badge>
                <Badge variant="outline" className="text-xs animate-bounce-in animate-delay-200">HuggingFace + OpenRouter</Badge>
              </div>
            </div>
          </form>

          {result && (
            <div className="mt-8 grid gap-4 lg:gap-6 lg:grid-cols-3 animate-fade-in">
              <article className="lg:col-span-2 p-4 sm:p-6 rounded-lg glass border-0 bg-card hover-lift shadow-soft animate-slide-in-left">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-semibold flex items-center gap-2 flex-wrap animate-bounce-in">
                      <div className="p-1 rounded-full bg-destructive/10 animate-pulse-slow">
                        <AlertTriangle className="text-destructive flex-shrink-0" />
                      </div>
                      <span className="break-words">Likely fault: {result.primary.fault}</span>
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground animate-fade-in animate-delay-100">Confidence {formatConfidence(result.primary.confidence)}</p>
                  </div>
                  <Badge variant={severityBadge[result.primary.severity].variant} className="flex-shrink-0 animate-scale-in animate-delay-200">
                    Severity: {severityBadge[result.primary.severity].label}
                  </Badge>
                </div>

                <div className="mt-4 text-sm leading-relaxed">
                  {result.primary.explanation}
                </div>

                {result.primary.actions.length > 0 && (
                  <div className="mt-5">
                    <h4 className="text-base font-medium flex items-center gap-2">
                      <Lightbulb className="flex-shrink-0" /> AI-Generated Solution
                    </h4>
                    <div className="mt-2 text-sm leading-relaxed">
                      {result.primary.actions[0]}
                    </div>
                  </div>
                )}

                <p className="mt-4 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-2">
                  <ShieldCheck className="flex-shrink-0" /> 
                  <span>AI-powered diagnosis with HuggingFace + OpenRouter Gemini. Always consult a professional for safety-critical repairs.</span>
                </p>
              </article>

              <aside aria-label="Other possibilities" className="p-4 sm:p-6 rounded-lg glass border-0 bg-card hover-lift shadow-soft animate-slide-in-right">
                <h4 className="text-base font-semibold flex items-center gap-2 animate-bounce-in">
                  <div className="p-1 rounded-full bg-primary/10 animate-spin-slow">
                    <Gauge className="flex-shrink-0" />
                  </div>
                  Other possibilities
                </h4>
                <div className="mt-3 space-y-3">
                  {result.alternatives.map((alt, i) => (
                    <div key={i} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fade-in animate-delay-${(i + 1) * 100}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium break-words">{alt.fault}</p>
                        <p className="text-xs text-muted-foreground">Confidence {formatConfidence(alt.confidence)}</p>
                      </div>
                      <Badge variant={severityBadge[alt.severity].variant} className="flex-shrink-0 w-fit hover-scale">
                        {severityBadge[alt.severity].label}
                      </Badge>
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
};

export default DiagnosticForm;
