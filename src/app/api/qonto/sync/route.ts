import { createClient } from "@/lib/supabase/server";

interface QontoTransaction {
  transaction_id: string;
  amount_cents: number;
  currency: string;
  label: string;
  settled_at: string;
  side: string;
  status: string;
}

interface QontoResponse {
  transactions: QontoTransaction[];
  meta?: { current_page: number; total_pages: number; next_page: number | null };
}

export async function POST() {
  try {
    const supabase = await createClient();

    // Read credentials from parametres table (user-configured), fallback to env vars
    const { data: params } = await supabase.from("parametres").select("cle, valeur");
    const paramMap = new Map((params ?? []).map((p: { cle: string; valeur: string }) => [p.cle, p.valeur]));

    const login = paramMap.get("qonto_login") || process.env.QONTO_LOGIN;
    const secretKey = paramMap.get("qonto_secret_key") || process.env.QONTO_SECRET_KEY;
    const iban = paramMap.get("qonto_iban") || process.env.QONTO_IBAN;

    if (!login || !secretKey || !iban) {
      return Response.json(
        { error: "Identifiants Qonto manquants. Configurez-les dans Parametres > Qonto." },
        { status: 400 }
      );
    }

    // Fetch all credit transactions from Qonto (paginated)
    const allTransactions: QontoTransaction[] = [];
    let currentPage = 1;
    let totalPages = 1;

    while (currentPage <= totalPages) {
      const url = `https://thirdparty.qonto.com/v2/transactions?iban=${iban}&side=credit&status=completed&per_page=100&current_page=${currentPage}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `${login}:${secretKey}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        return Response.json(
          { error: `Erreur API Qonto (${res.status}): ${text}` },
          { status: 502 }
        );
      }

      const data: QontoResponse = await res.json();
      allTransactions.push(...data.transactions);

      if (data.meta) {
        totalPages = data.meta.total_pages;
        currentPage = data.meta.next_page ?? totalPages + 1;
      } else {
        break;
      }
    }

    // Get existing qonto_ids to skip duplicates
    const { data: existingRows } = await supabase
      .from("transactions_ca")
      .select("qonto_id, montant, statut, id")
      .not("qonto_id", "is", null);

    const existingQontoIds = new Set(
      (existingRows ?? []).map((r: { qonto_id: string }) => r.qonto_id)
    );

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const tx of allTransactions) {
      const qontoId = tx.transaction_id;
      const montant = tx.amount_cents / 100;
      const datePaiement = tx.settled_at ? tx.settled_at.split("T")[0] : null;
      const libelle = tx.label || "";

      // Skip if already imported
      if (existingQontoIds.has(qontoId)) {
        skipped++;
        continue;
      }

      // Check if a matching 'signe' transaction exists (same montant)
      const { data: matchingSigne } = await supabase
        .from("transactions_ca")
        .select("id")
        .eq("montant", montant)
        .eq("statut", "signe")
        .is("qonto_id", null)
        .limit(1);

      if (matchingSigne && matchingSigne.length > 0) {
        // Update existing 'signe' → 'paye' + attach qonto_id
        await supabase
          .from("transactions_ca")
          .update({
            statut: "paye",
            qonto_id: qontoId,
            date_paiement: datePaiement,
            source: "qonto",
            libelle: libelle || undefined,
          })
          .eq("id", matchingSigne[0].id);
        updated++;
      } else {
        // Insert new transaction
        await supabase.from("transactions_ca").insert({
          montant,
          statut: "paye",
          source: "qonto",
          qonto_id: qontoId,
          libelle,
          date: datePaiement ?? new Date().toISOString().split("T")[0],
          date_paiement: datePaiement,
        });
        imported++;
      }
    }

    // Save last sync timestamp
    await supabase.from("parametres").upsert({
      cle: "qonto_last_sync",
      valeur: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await supabase.from("parametres").upsert({
      cle: "qonto_last_sync_result",
      valeur: JSON.stringify({ imported, updated, skipped, total: allTransactions.length }),
      updated_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      imported,
      updated,
      skipped,
      total: allTransactions.length,
    });
  } catch (err) {
    console.error("Qonto sync error:", err);
    return Response.json(
      { error: "Erreur interne lors de la synchronisation." },
      { status: 500 }
    );
  }
}
