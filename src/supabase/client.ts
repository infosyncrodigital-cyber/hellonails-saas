import { createClient } from '@supabase/supabase-js'

// Vite expone las variables de entorno en import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Verificación de seguridad para que no te vuelvas loco si falla
if (!supabaseUrl || !supabaseKey) {
  throw new Error('❌ Faltan las variables de entorno. Revisa tu archivo .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseKey)