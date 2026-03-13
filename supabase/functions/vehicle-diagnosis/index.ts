import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openRouterHeaders = {
  'Authorization': `Bearer ${openRouterApiKey}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': 'https://github.com/Sid9022/ai-auto-fix',
  'X-Title': 'AI Auto Fix',
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
        let rawPrediction = result.data[0].toString().trim();
        
        // Try to extract confidence if it's in the string like "(confidence 0.45)"
        const confMatch = rawPrediction.match(/confidence\s+([\d.]+)/i);
        if (confMatch && confMatch[1]) {
          confidence = parseFloat(confMatch[1]);
        }
        
        // Clean up the predicted fault part string
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
          headers: openRouterHeaders,
          body: JSON.stringify({
            model: 'google/gemma-3-27b-it:free',
            messages: [{
              role: 'user',
              content: `Based on these vehicle symptoms: \