import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TacheAvecProjet, SousTache } from "@/lib/types";

export function useTaches(projetId?: string) {
  const [taches, setTaches] = useState<TacheAvecProjet[]>([]);
  const [sousOuTaches, setSousOuTaches] = useState<Record<string, SousTache[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchTaches = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("taches")
        .select("*, projets:projet_id(nom, type)")
        .order("ordre", { ascending: true });

      if (projetId) {
        query = query.eq("projet_id", projetId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setTaches(data || []);

      // Fetch sous-tâches
      if (data && data.length > 0) {
        const tacheIds = data.map((t) => t.id);
        const { data: sousData, error: sousError } = await supabase
          .from("sous_taches")
          .select("*")
          .in("tache_id", tacheIds)
          .order("ordre", { ascending: true });

        if (sousError) throw sousError;

        const grouped: Record<string, SousTache[]> = {};
        (sousData || []).forEach((sous) => {
          if (!grouped[sous.tache_id]) {
            grouped[sous.tache_id] = [];
          }
          grouped[sous.tache_id].push(sous);
        });
        setSousOuTaches(grouped);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }, [projetId, supabase]);

  useEffect(() => {
    fetchTaches();
  }, [fetchTaches]);

  const createTache = useCallback(
    async (tache: Omit<TacheAvecProjet, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("taches")
        .insert([tache])
        .select()
        .single();

      if (error) throw error;
      setTaches((prev) => [...prev, data]);
      return data;
    },
    [supabase]
  );

  const updateTache = useCallback(
    async (id: string, updates: Partial<TacheAvecProjet>) => {
      const { data, error } = await supabase
        .from("taches")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      setTaches((prev) => prev.map((t) => (t.id === id ? data : t)));
      return data;
    },
    [supabase]
  );

  const deleteTache = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("taches").delete().eq("id", id);
      if (error) throw error;
      setTaches((prev) => prev.filter((t) => t.id !== id));
      setSousOuTaches((prev) => {
        const newOuTaches = { ...prev };
        delete newOuTaches[id];
        return newOuTaches;
      });
    },
    [supabase]
  );

  return {
    taches,
    sousOuTaches,
    loading,
    error,
    createTache,
    updateTache,
    deleteTache,
    refetch: fetchTaches,
  };
}

export function useSousTaches(tacheId: string) {
  const [sousOuTaches, setSousOuTaches] = useState<SousTache[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchSousOuTaches = async () => {
      const { data } = await supabase
        .from("sous_taches")
        .select("*")
        .eq("tache_id", tacheId)
        .order("ordre", { ascending: true });

      setSousOuTaches(data || []);
      setLoading(false);
    };

    fetchSousOuTaches();
  }, [tacheId, supabase]);

  const createSousTache = useCallback(
    async (titre: string) => {
      const maxOrdre =
        sousOuTaches.length > 0 ? Math.max(...sousOuTaches.map((s) => s.ordre)) : -1;

      const { data, error } = await supabase
        .from("sous_taches")
        .insert([
          {
            tache_id: tacheId,
            titre,
            terminee: false,
            ordre: maxOrdre + 1,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      setSousOuTaches((prev) => [...prev, data]);
      return data;
    },
    [tacheId, sousOuTaches, supabase]
  );

  const updateSousTache = useCallback(
    async (id: string, updates: Partial<SousTache>) => {
      const { data, error } = await supabase
        .from("sous_taches")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      setSousOuTaches((prev) => prev.map((s) => (s.id === id ? data : s)));
      return data;
    },
    [supabase]
  );

  const deleteSousTache = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("sous_taches").delete().eq("id", id);
      if (error) throw error;
      setSousOuTaches((prev) => prev.filter((s) => s.id !== id));
    },
    [supabase]
  );

  return {
    sousOuTaches,
    loading,
    createSousTache,
    updateSousTache,
    deleteSousTache,
  };
}
