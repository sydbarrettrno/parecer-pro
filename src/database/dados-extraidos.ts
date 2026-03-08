import { supabase } from "@/integrations/supabase/client";

export async function fetchDadosExtraidos(processoId: string, onlyVisible = false) {
  let query = supabase
    .from("dados_extraidos")
    .select("*")
    .eq("processo_id", processoId);
  if (onlyVisible) {
    query = query.eq("oculto", false);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updateDadoExtraido(id: string, updates: Record<string, unknown>) {
  const { error } = await supabase
    .from("dados_extraidos")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}
