import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use Lovable AI Gateway if available, fallback to OpenRouter
function getAIConfig() {
  if (lovableApiKey) {
    return {
      url: 'https://ai.gateway.lovable.dev/v1/chat/completions',
      key: lovableApiKey,
      model: 'google/gemini-2.0-flash-lite',
      pdfModel: 'google/gemini-2.0-flash-lite',
    };
  }
  if (openRouterApiKey) {
    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: openRouterApiKey,
      model: 'google/gemma-3-27b-it:free',
      pdfModel: 'google/gemma-2-9b-it:free',
    };
  }
  return null;
}

async function callAI(config: ReturnType<typeof getAIConfig>, messages: Array<{role: string; content: string}>, maxTokens = 1000, temperature = 0.3) {
  if (!config) return null;
  
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI API error:', response.status, errorText);
    return null;
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content?.trim() || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, generatePDFContent = false } = await req.json();
    console.log('Received diagnosis request:', { description });

    const aiConfig = getAIConfig();
    let predictedFaultPart = '';
    let confidence = 0.85;

    // Step 1: Call Gradio model to predict fault part
    try {
      console.log('Connecting to Gradio model: kingkill1111/vehicle-diagnosis-ai');
      const client = await Client.connect("kingkill1111/vehicle-diagnosis-ai");
      const result = await client.predict("/predict", { description });
      console.log('Gradio model response:', result.data);
      
      if (result.data && result.data.length > 0) {
        predictedFaultPart = result.data[0].toString().trim();
      } else {
        predictedFaultPart = 'Engine System';
        confidence = 0.50;
      }
    } catch (error) {
      console.error('Error calling Gradio model:', error);
      predictedFaultPart = 'Engine System';
      confidence = 0.50;
    }

    // Step 2: Get solution from AI
    let finalFaultPart = predictedFaultPart;
    let solution = '';
    let explanation = '';
    
    const isUnknownFault = predictedFaultPart.toUpperCase().includes('UNKNOWN') || 
                          predictedFaultPart.toUpperCase().includes('OTHER');

    if (aiConfig) {
      if (isUnknownFault) {
        console.log('Getting fault diagnosis and solution from AI for unknown fault');
        const text = await callAI(aiConfig, [{
          role: 'user',
          content: `Based on these vehicle symptoms: "${description}". Provide: 1) The most likely faulty component (max 5 words), 2) A two-sentence repair solution. Format: "FAULT: [component] SOLUTION: [two sentences]"`
        }]);

        if (text) {
          const faultMatch = text.match(/FAULT:\s*([^]*?)(?=\s*SOLUTION:)/i);
          const solutionMatch = text.match(/SOLUTION:\s*([^]*?)$/i);
          finalFaultPart = faultMatch ? faultMatch[1].trim() : 'Engine System';
          solution = solutionMatch ? solutionMatch[1].trim() : 'Please consult a qualified mechanic for proper diagnosis and repair.';
          explanation = 'AI analysis identified the likely faulty component based on the symptoms described.';
        } else {
          finalFaultPart = 'Engine System';
          solution = 'Please consult a qualified mechanic for proper diagnosis and repair.';
          explanation = 'Fallback diagnosis due to API error.';
        }
      } else {
        console.log('Getting solution from AI for fault:', predictedFaultPart);
        explanation = `The ${predictedFaultPart} has been identified as the likely faulty component.`;
        
        const text = await callAI(aiConfig, [{
          role: 'user',
          content: `Vehicle symptoms: "${description}". Predicted fault: "${predictedFaultPart}". Provide a two-sentence repair solution for this specific fault.`
        }]);

        solution = text || 'Please consult a qualified mechanic for proper diagnosis and repair.';
      }
    } else {
      finalFaultPart = isUnknownFault ? 'Engine System' : predictedFaultPart;
      explanation = `The ${finalFaultPart} has been identified as the likely faulty component.`;
      solution = 'Please consult a qualified mechanic for proper diagnosis and repair.';
    }

    // Determine severity
    let severity: 'low' | 'medium' | 'high' = 'medium';
    const highSeverityParts = ['engine', 'brake', 'transmission', 'steering'];
    const lowSeverityParts = ['air conditioning', 'radio', 'lights'];
    
    if (highSeverityParts.some(part => finalFaultPart.toLowerCase().includes(part))) {
      severity = 'high';
    } else if (lowSeverityParts.some(part => finalFaultPart.toLowerCase().includes(part))) {
      severity = 'low';
    }

    // Generate PDF content if requested
    let pdfContent = null;
    if (generatePDFContent && aiConfig) {
      try {
        const pdfPrompt = `Create a professional vehicle diagnostic report in plain text (NO markdown).

EXECUTIVE SUMMARY
Primary Fault: ${finalFaultPart}
Severity Level: ${severity.toUpperCase()}
Confidence Level: ${Math.round(confidence * 100)}%

PROBLEM DESCRIPTION
Symptoms Reported: ${description}
Analysis Date: ${new Date().toLocaleDateString()}

DETAILED DIAGNOSIS
Provide root cause analysis, technical details, and system impact.

RECOMMENDED SOLUTION
Provide immediate actions, repair procedures, and parts required.

SAFETY CONSIDERATIONS
Provide safety warnings and driving restrictions.

COST ESTIMATES
Provide parts cost, labor time, and total estimated cost ranges.

FOLLOW-UP RECOMMENDATIONS
Provide preventive maintenance and warning signs to monitor.

Use UPPERCASE for headers, dashes for bullets. No markdown symbols.`;

        const pdfText = await callAI(
          { ...aiConfig, model: aiConfig.pdfModel },
          [
            { role: 'system', content: 'You are a professional automotive diagnostic expert. Generate reports using ONLY plain text. Never use markdown.' },
            { role: 'user', content: pdfPrompt }
          ],
          2500,
          0.2
        );

        if (pdfText && pdfText.length > 100) {
          pdfContent = pdfText;
          console.log('PDF content generated, length:', pdfContent.length);
        }
      } catch (pdfError) {
        console.error('Error generating PDF content:', pdfError);
      }
    }

    const result = {
      primary: {
        fault: finalFaultPart,
        confidence: Math.round(confidence * 100) / 100,
        severity,
        explanation,
        actions: solution ? [solution] : []
      },
      alternatives: [],
      pdfContent,
    };

    console.log('Sending diagnosis result:', result);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in vehicle-diagnosis function:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process diagnosis request',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
