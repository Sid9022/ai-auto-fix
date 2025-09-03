import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

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
    const { description } = await req.json();
    
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

    // Step 2: Generate solution with Gemini only if fault is UNKNOWN OR OTHER
    let solution = '';
    let explanation = `The ${predictedFaultPart} has been identified as the likely faulty component.`;
    
    const shouldUseFallbackSolution = predictedFaultPart.toUpperCase().includes('UNKNOWN') || 
                                     predictedFaultPart.toUpperCase().includes('OTHER');
    
    if (shouldUseFallbackSolution && geminiApiKey) {
      console.log('Generating one-liner solution with Gemini for:', predictedFaultPart);
      
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Based on these vehicle symptoms: "${description}". Provide only one short sentence with the most likely repair action needed. Keep it under 20 words.`
            }]
          }]
        }),
      });

      if (geminiResponse.ok) {
        const geminiResult = await geminiResponse.json();
        console.log('Gemini response received');
        
        const generatedText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
        solution = generatedText.trim().split('.')[0] + '.'; // Take first sentence only
        
      } else {
        console.error('Gemini API error:', await geminiResponse.text());
        solution = 'Please consult a qualified mechanic for proper diagnosis and repair.';
      }
    }

    // Determine severity based on fault part
    let severity: 'low' | 'medium' | 'high' = 'medium';
    const highSeverityParts = ['engine', 'brake', 'transmission', 'steering'];
    const lowSeverityParts = ['air conditioning', 'radio', 'lights'];
    
    if (highSeverityParts.some(part => predictedFaultPart.toLowerCase().includes(part))) {
      severity = 'high';
    } else if (lowSeverityParts.some(part => predictedFaultPart.toLowerCase().includes(part))) {
      severity = 'low';
    }

    const result = {
      primary: {
        fault: predictedFaultPart,
        confidence: Math.round(confidence * 100) / 100,
        severity,
        explanation,
        actions: solution ? [solution] : []
      },
      alternatives: []
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