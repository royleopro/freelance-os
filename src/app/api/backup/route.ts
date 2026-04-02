import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TABLES = [
  "projets",
  "sessions_heures",
  "transactions_ca",
  "devis",
  "objectifs",
  "parametres",
] as const;

const README = `FREELANCE OS — Sauvegarde
=========================

Ce fichier contient l'export complet de votre base de donnees Freelance OS.

Structure :
- meta : informations sur l'export (date, version, nombre de lignes par table)
- projets : liste des projets (id, nom, client, statut, type, tjm, dates...)
- sessions_heures : sessions de travail (projet_id, date, duree, etiquette, facturable)
- transactions_ca : paiements et CA (projet_id, montant, date, statut, libelle)
- devis : devis par projet (projet_id, libelle, montant_total, statut)
- objectifs : objectifs mensuels CA (annee, mois, ca_cible, tjm_cible, jours_cibles)
- parametres : parametres cle/valeur (taux_urssaf, taux_impots, solde_compte_pro...)

Reimportation :
1. Ouvrir le Supabase SQL Editor
2. Pour chaque table, inserer les lignes avec INSERT INTO ... VALUES (...)
3. Ou utiliser la fonctionnalite d'import CSV de Supabase apres conversion
4. Attention aux contraintes de cle etrangere : importer projets en premier,
   puis devis, puis transactions_ca et sessions_heures
`;

export async function GET() {
  try {
    const supabase = await createClient();

    const results = await Promise.all(
      TABLES.map(async (table) => {
        const all: Record<string, unknown>[] = [];
        const PAGE_SIZE = 1000;
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .range(from, from + PAGE_SIZE - 1);
          if (error) throw new Error(`Erreur sur ${table}: ${error.message}`);
          all.push(...(data ?? []));
          hasMore = (data?.length ?? 0) === PAGE_SIZE;
          from += PAGE_SIZE;
        }
        return [table, all] as const;
      })
    );

    const counts: Record<string, number> = {};
    const data: Record<string, unknown> = {};
    for (const [table, rows] of results) {
      data[table] = rows;
      counts[table] = rows.length;
    }

    const backup = {
      readme: README,
      meta: {
        export_date: new Date().toISOString(),
        app_version: "0.1.0",
        tables: counts,
        total_rows: Object.values(counts).reduce((s, n) => s + n, 0),
      },
      ...data,
    };

    const date = new Date().toISOString().split("T")[0];
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="freelance-os-backup-${date}.json"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
