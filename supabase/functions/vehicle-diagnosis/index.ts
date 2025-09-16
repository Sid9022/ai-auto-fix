import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, generatePDFContent = false } = await req.json();
    
    console.log('Received diagnosis request:', { description });

    let predictedFaultPart = '';
    let confidence = 0.85;

    // Step 1: Call user's Gradio model to predict fault part
    try {
      console.log('Connecting to Gradio model: kingkill1111/vehicle-diagnosis-ai');
      const client = await Client.connect("kingkill1111/vehicle-diagnosis-ai");
      const result = await client.predict("/predict", { 
        description: description 
      });

      console.log('Gradio model response:', result.data);
      
      // Extract fault part from Gradio response
      if (result.data && result.data.length > 0) {
        predictedFaultPart = result.data[0].toString().trim();
      } else {
        predictedFaultPart = 'Engine System';
        confidence = 0.50;
      }
    } catch (error) {
      console.error('Error calling Gradio model:', error);
      // Fallback to a basic prediction if model fails
      predictedFaultPart = 'Engine System';
      confidence = 0.50;
    }

    // Step 2: Handle different cases based on HuggingFace output
    let finalFaultPart = predictedFaultPart;
    let solution = '';
    let explanation = '';
    
    const isUnknownFault = predictedFaultPart.toUpperCase().includes('UNKNOWN') || 
                          predictedFaultPart.toUpperCase().includes('OTHER');
    
    if (openRouterApiKey) {
      if (isUnknownFault) {
        // Case 1: UNKNOWN OR OTHER - get both fault part and solution from OpenRouter
        console.log('Getting fault diagnosis and solution from OpenRouter for unknown fault');
        
        const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemma-3-27b-it:free',
            messages: [{
              role: 'user',
              content: `Based on these vehicle symptoms: "${description}". Provide: 1) The most likely faulty component (max 5 words), 2) A two-sentence repair solution. Format: "FAULT: [component] SOLUTION: [two sentences]"`
            }]
          }),
        });

        if (openRouterResponse.ok) {
          const openRouterResult = await openRouterResponse.json();
          console.log('OpenRouter response received for unknown fault');
          
          const generatedText = openRouterResult.choices?.[0]?.message?.content || '';
          const faultMatch = generatedText.match(/FAULT:\s*([^]*?)(?=\s*SOLUTION:)/i);
          const solutionMatch = generatedText.match(/SOLUTION:\s*([^]*?)$/i);
          
          finalFaultPart = faultMatch ? faultMatch[1].trim() : 'Engine System';
          solution = solutionMatch ? solutionMatch[1].trim() : 'Please consult a qualified mechanic for proper diagnosis and repair.';
          explanation = `AI analysis identified the likely faulty component based on the symptoms described.`;
        } else {
          console.error('OpenRouter API error:', await openRouterResponse.text());
          finalFaultPart = 'Engine System';
          solution = 'Please consult a qualified mechanic for proper diagnosis and repair.';
          explanation = `Fallback diagnosis due to API error.`;
        }
      } else {
        // Case 2: Specific fault from HuggingFace - get solution from OpenRouter
        console.log('Getting solution from OpenRouter for HuggingFace fault:', predictedFaultPart);
        explanation = `The ${predictedFaultPart} has been identified as the likely faulty component.`;
        
        const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemma-3-27b-it:free',
            messages: [{
              role: 'user',
              content: `Vehicle symptoms: "${description}". Predicted fault: "${predictedFaultPart}". Provide a two-sentence repair solution for this specific fault.`
            }]
          }),
        });

        if (openRouterResponse.ok) {
          const openRouterResult = await openRouterResponse.json();
          console.log('OpenRouter response received for specific fault');
          
          const generatedText = openRouterResult.choices?.[0]?.message?.content || '';
          solution = generatedText.trim();
        } else {
          console.error('OpenRouter API error:', await openRouterResponse.text());
          solution = 'Please consult a qualified mechanic for proper diagnosis and repair.';
        }
      }
    } else {
      // Fallback if no OpenRouter API key
      finalFaultPart = isUnknownFault ? 'Engine System' : predictedFaultPart;
      explanation = `The ${finalFaultPart} has been identified as the likely faulty component.`;
      solution = 'Please consult a qualified mechanic for proper diagnosis and repair.';
    }

    // Determine severity based on fault part
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
    if (generatePDFContent && openRouterApiKey) {
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

        const pdfResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemma-2-9b-it:free',
            messages: [
              {
                role: 'system',
                content: 'You are a professional automotive diagnostic expert. Generate comprehensive diagnostic reports using ONLY plain text formatting. Never use markdown symbols like **, ##, or other special formatting characters. Use UPPERCASE for section headers and simple dashes for bullet points.'
              },
              {
                role: 'user',
                content: pdfPrompt
              }
            ],
            max_tokens: 2500,
            temperature: 0.2
          })
        });

        if (pdfResponse.ok) {
          const pdfData = await pdfResponse.json();
          const rawContent = pdfData.choices[0]?.message?.content;
          
          if (rawContent && rawContent.trim().length > 100) {
            pdfContent = rawContent.trim();
            console.log('PDF content generated successfully, length:', pdfContent.length);
          } else {
            console.error('PDF content too short or empty:', rawContent?.length || 0);
            pdfContent = null;
          }
        } else {
          const errorText = await pdfResponse.text();
          console.error('Failed to generate PDF content:', pdfResponse.status, errorText);
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
      pdfContent: pdfContent
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