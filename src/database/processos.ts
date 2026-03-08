import { supabase } from "@/integrations/supabase/client";

export async function fetchProcesso(id: string) {
  const { data, error } = await supabase
    .from("processos")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchProcessos() {
  const { data, error } = await supabase
    .from("processos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateProcessoTitle(id: string, nome: string) {
  const { error } = await supabase
    .from("processos")
    .update({ nome_processo: nome })
    .eq("id", id);
  if (error) throw error;
}

export async function updateProcessoStatus(id: string, status: "cadastrado" | "analisando" | "revisao" | "concluido" | "erro") {
  const { error } = await supabase
    .from("processos")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function createProcesso(data: {
  nome_processo: string;
  numero_processo: string;
  orgao: string;
  secretaria: string;
  status: "cadastrado" | "analisando" | "revisao" | "concluido" | "erro";
}) {
  const { data: processo, error } = await supabase
    .from("processos")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return processo;
}
