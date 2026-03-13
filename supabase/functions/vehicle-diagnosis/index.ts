import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

const googleApiKey = Deno.env.get('GOOGLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, generatePDFContent = false } = await req.json();
    console.log('Received diagnosis request:', { description });

    let predictedFaultPart = '';
    let confidence = 0.85;

    try {
      console.log('Connecting to Gradio model: kingkill1111/vehicle-diagnosis-ai');
      const client = await Client.connect("kingkill1111/vehicle-diagnosis-ai");
      const result = await client.predict("/predict", { description });

      if (result.data && result.data.length > 0) {
        let rawPrediction = result.data[0].toString().trim();
        const confMatch = rawPrediction.match(/confidence\s+([\d.]+)/i);
        if (confMatch && confMatch[1]) {
          confidence = parseFloat(confMatch[1]);
        }
        predictedFaultPart = rawPrediction
          .replace(/Predicted Fault Component:\s*/i, '')
          .replace(/\(confidence\s+[\d.]+\)/i, '')
          .replace(/\(\s*\)/, '')
          .trim();
      } else {
        predictedFaultPart = 'Engine System';
        confidence = 0.50;
      }
    } catch (error) {
      console.error('Error calling Gradio model:', error);
      predictedFaultPart = 'Engine System';
      confidence = 0.50;
    }

    let finalFaultPart = predictedFaultPart;
    let solution = 'Please consult a qualified mechanic for proper diagnosis and repair.';
    let explanation = `The ${finalFaultPart} has been identified as the likely faulty component.`;
    
    const isUnknownFault = predictedFaultPart.toUpperCase().includes('UNKNOWN') || 
                          predictedFaultPart.toUpperCase().includes('OTHER');

    if (googleApiKey) {
      const prompt = isUnknownFault 
        ? `Based on these vehicle symptoms: "${description}". Provide: 1) The most likely faulty component (max 5 words), 2) A two-sentence repair solution. Format: "FAULT: [component] SOLUTION: [two sentences]"`
        : `Vehicle symptoms: "${description}". Predicted fault: "${predictedFaultPart}". Provide a two-sentence repair solution for this specific fault.`;

      console.log('Getting solution from Google AI Studio Gemini API');
      
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (geminiResponse.ok) {
        const result = await geminiResponse.json();
        const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (isUnknownFault) {
          const faultMatch = generatedText.match(/FAULT:\s*([^]*?)(?=\s*SOLUTION:)/i);
          const solutionMatch = generatedText.match(/SOLUTION:\s*([^]*?)$/i);
          finalFaultPart = faultMatch ? faultMatch[1].trim() : 'Engine System';
          solution = solutionMatch ? solutionMatch[1].trim() : 'Please consult a qualified mechanic for proper diagnosis and repair.';
          explanation = `AI analysis identified the likely faulty component based on the symptoms described.`;
        } else {
          solution = generatedText.trim();
        }
      } else {
        console.error('Gemini API error:', await geminiResponse.text());
      }
    }

    let severity: 'low' | 'medium' | 'high' = 'medium';
    const highSeverityParts = ['engine', 'brake', 'transmission', 'steering'];
    const lowSeverityParts = ['air conditioning', 'radio', 'lights'];
    
    if (highSeverityParts.some(part => finalFaultPart.toLowerCase().includes(part))) {
      severity = 'high';
    } else if (lowSeverityParts.some(part => finalFaultPart.toLowerCase().includes(part))) {
      severity = 'low';
    }

    let pdfContent = null;
    if (generatePDFContent && googleApiKey) {
      try {
        const pdfPrompt = `Based on the vehicle diagnostic analysis, create a comprehensive professional diagnostic report. 
CRITICAL FORMATTING REQUIREMENTS:
- Use ONLY plain text, NO markdown formatting
- NO asterisks (**), NO hash symbols (##), NO special characters
- Use UPPERCASE for section headers
- Use simple dashes (-) for bullet points
- Keep sentences clear and professional
- Separate sections with blank lines

Create the report in this EXACT format:

EXECUTIVE SUMMARY
Primary Fault: ${finalFaultPart}
Severity Level: ${severity.toUpperCase()}
Confidence Level: ${Math.round(confidence * 100)}%
Safety Impact: Write 1-2 sentences about safety implications based on the severity level

PROBLEM DESCRIPTION  
Symptoms Reported: ${description}
Analysis Date: ${new Date().toLocaleDateString()}
Diagnostic Method: AI-Powered Analysis
Vehicle Condition: Brief assessment of current operational state

DETAILED DIAGNOSIS
Root Cause Analysis: Explain the underlying cause of the fault in 2-3 clear sentences
Technical Details: Describe how the affected system works and what specifically has failed
System Impact: Explain how this fault affects overall vehicle operation and performance
Diagnostic Confidence: Justify the confidence level with technical reasoning

RECOMMENDED SOLUTION
Immediate Actions:
- First priority action to take right now
- Second priority safety or diagnostic step
- Third action to prevent further damage

Repair Procedures:
1. First step of the repair process
2. Second step with specific details
3. Third step including any special tools needed
4. Final verification or testing step

Parts Required:
- Primary part name with estimated cost range
- Secondary components that may be needed
- Any consumables or fluids required

Professional Services: When to seek qualified mechanic assistance

SAFETY CONSIDERATIONS
Immediate Safety Warnings: Critical safety information for this specific fault
Work Safety Precautions: Safety measures for any DIY diagnostic work
Driving Restrictions: Any limitations on vehicle operation until repaired

COST ESTIMATES
Parts Cost: $XX to $XXX range based on vehicle type
Labor Time: X to X hours estimated
Labor Cost: $XX to $XXX range at standard rates
Total Estimated Cost: $XXX to $XXX complete repair cost

FOLLOW-UP RECOMMENDATIONS
Preventive Maintenance: Specific steps to prevent this issue from recurring
Warning Signs to Monitor: Early symptoms to watch for in the future
Maintenance Schedule: Recommended service intervals for related systems
When to Return for Service: Clear guidelines for follow-up inspections

Provide detailed, professional content for each section using ONLY the plain text formatting shown above. Do not use any markdown symbols or special formatting characters.`;

        const pdfResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: pdfPrompt }] }]
          })
        });

        if (pdfResponse.ok) {
          const result = await pdfResponse.json();
          const rawContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawContent && rawContent.trim().length > 100) {
            pdfContent = rawContent.trim();
          }
        }
      } catch (error) {
        console.error('Error generating PDF content:', error);
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
      pdfContent: pdfContent
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in vehicle-diagnosis function:', error);
    return new Response(JSON.stringify({ error: 'Failed to process request', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});