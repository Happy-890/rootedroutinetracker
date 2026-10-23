CREATE TABLE public.push_signing_config (id boolean PRIMARY KEY DEFAULT true, public_key text NOT NULL, encrypted_private_key text NOT NULL, iv text NOT NULL);
GRANT ALL ON public.push_signing_config TO service_role;
ALTER TABLE public.push_signing_config ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.push_signing_config IS 'Server-only VAPID key pair; private key encrypted with application secret. No client access.';