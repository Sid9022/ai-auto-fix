import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { description, modelEndpoint } = await req.json();
    
    console.log('Received diagnosis request:', { description, modelEndpoint });

    let predictedFaultPart = '';
    let confidence = 0;

    // Step 1: Call user's trained model to predict fault part
    if (modelEndpoint) {
      try {
        console.log('Calling user model at:', modelEndpoint);
        const modelResponse = await fetch(modelEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            text: description,
            description: description 
          }),
        });

        if (modelResponse.ok) {
          const modelResult = await modelResponse.json();
          console.log('Model response:', modelResult);
          
          // Adjust these field names based on your model's response format
          predictedFaultPart = modelResult.prediction || modelResult.fault_part || modelResult.result;
          confidence = modelResult.confidence || 0.85;
        } else {
          console.error('Model API error:', await modelResponse.text());
          throw new Error('Failed to get prediction from model');
        }
      } catch (error) {
        console.error('Error calling user model:', error);
        // Fallback to a basic prediction if model fails
        predictedFaultPart = 'Engine System';
        confidence = 0.50;
      }
    } else {
      // Fallback when no model endpoint provided
      predictedFaultPart = 'Engine System';
      confidence = 0.50;
    }

    // Step 2: Use Gemini to generate detailed solution
    console.log('Generating solution with Gemini for fault part:', predictedFaultPart);
    
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an expert automotive technician. A vehicle diagnostic system has identified "${predictedFaultPart}" as the likely faulty component based on these symptoms: "${description}".

Please provide:
1. A detailed explanation of why this fault occurs
2. Step-by-step troubleshooting instructions
3. Recommended repair actions
4. Prevention tips

Keep the response practical and helpful for both mechanics and car owners.`
          }]
        }]
      }),
    });

    let solution = '';
    let explanation = '';

    if (geminiResponse.ok) {
      const geminiResult = await geminiResponse.json();
      console.log('Gemini response received');
      
      const generatedText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Split the response into explanation and solution
      const lines = generatedText.split('\n');
      explanation = lines.slice(0, 3).join(' ');
      solution = generatedText;
      
    } else {
      console.error('Gemini API error:', await geminiResponse.text());
      explanation = `The ${predictedFaultPart} may be malfunctioning based on the described symptoms.`;
      solution = 'Please consult a qualified mechanic for proper diagnosis and repair.';
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
        actions: [solution]
      },
      alternatives: [] // Could be enhanced to provide alternative possibilities
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