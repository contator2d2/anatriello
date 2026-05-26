-- Create app_logs table
CREATE TABLE public.app_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}'::jsonb,
    user_id UUID,
    user_email TEXT,
    page_url TEXT,
    device_info JSONB DEFAULT '{}'::jsonb,
    stack_trace TEXT
);

-- Grant permissions
GRANT SELECT, INSERT ON public.app_logs TO authenticated;
GRANT ALL ON public.app_logs TO service_role;

-- Enable RLS
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can insert their own logs" 
ON public.app_logs 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_app_logs_level ON public.app_logs (level);
CREATE INDEX idx_app_logs_created_at ON public.app_logs (created_at);
CREATE INDEX idx_app_logs_user_id ON public.app_logs (user_id);
