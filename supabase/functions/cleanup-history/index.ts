import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KeepAliveResponse {
  message: string;
  huggingface_status: string;
  cleanup_status: string;
  deleted_count?: number;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Keep-alive and cleanup function started');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Keep Hugging Face model alive
    let huggingfaceStatus = 'success';
    try {
      console.log('Pinging Hugging Face model to keep it alive...');
      const hfResponse = await fetch('https://kingkill1111-vehicle-diagnosis-ai.hf.space/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: ['keep-alive ping']
        })
      });
      
      if (!hfResponse.ok) {
        throw new Error(`HF API returned ${hfResponse.status}`);
      }
      
      console.log('Hugging Face model pinged successfully');
    } catch (error) {
      console.error('Error pinging Hugging Face model:', error);
      huggingfaceStatus = 'error';
    }

    // 2. Cleanup expired diagnostic history
    let cleanupStatus = 'success';
    let deletedCount = 0;
    
    try {
      console.log('Running diagnostic history cleanup...');
      
      // Call the cleanup function
      const { data, error } = await supabase.rpc('cleanup_expired_history');
      
      if (error) {
        throw error;
      }
      
      deletedCount = data || 0;
      console.log(`Cleanup completed: ${deletedCount} expired records deleted`);
      
    } catch (error) {
      console.error('Error during cleanup:', error);
      cleanupStatus = 'error';
    }

    const response: KeepAliveResponse = {
      message: 'Keep-alive and cleanup completed',
      huggingface_status: huggingfaceStatus,
      cleanup_status: cleanupStatus,
      deleted_count: deletedCount
    };

    console.log('Function completed:', response);

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Function error:', error);
    
    const errorResponse: KeepAliveResponse = {
      message: 'Keep-alive function failed',
      huggingface_status: 'error',
      cleanup_status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});
