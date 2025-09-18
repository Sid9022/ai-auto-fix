-- Create diagnostic_history table
CREATE TABLE public.diagnostic_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Input data
  description TEXT NOT NULL,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  
  -- Diagnosis results
  predicted_fault TEXT NOT NULL,
  confidence DECIMAL(5,2) NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  explanation TEXT NOT NULL,
  recommended_actions TEXT[],
  
  -- Alternative diagnoses (JSON)
  alternatives JSONB DEFAULT '[]'::jsonb,
  
  -- PDF content if generated
  pdf_content TEXT,
  
  -- Metadata
  model_used TEXT DEFAULT 'huggingface',
  analysis_duration INTEGER,
  
  -- Auto-cleanup fields
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  is_favorite BOOLEAN NOT NULL DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE public.diagnostic_history ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own history" 
ON public.diagnostic_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own history" 
ON public.diagnostic_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own history" 
ON public.diagnostic_history 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own history" 
ON public.diagnostic_history 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_diagnostic_history_user_id ON public.diagnostic_history(user_id);
CREATE INDEX idx_diagnostic_history_created_at ON public.diagnostic_history(created_at DESC);
CREATE INDEX idx_diagnostic_history_expires_at ON public.diagnostic_history(expires_at) WHERE is_favorite = false;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_diagnostic_history_updated_at
BEFORE UPDATE ON public.diagnostic_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to cleanup expired history
CREATE OR REPLACE FUNCTION public.cleanup_expired_history()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.diagnostic_history 
  WHERE expires_at < now() 
    AND is_favorite = false;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;