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

interface QontoInvoice {
  id: string;
  invoice_number: string;
  total_amount_cents: number;
  currency: string;
  status: string; // draft | unpaid | paid | cancelled
  paid_at: string | null;
  created_at: string;
}

async function qontoFetch(url: string, login: string, secretKey: string) {
  const res = await fetch(url, {
    headers: { Authorization: `${login}:${secretKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Qonto API ${res.status}: ${text}`);
  }
  return res.json();
}

export async function POST() {
  try {
    const supabase = await createClient();

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

    // ========== 1. TRANSACTIONS ==========
    const allTransactions: QontoTransaction[] = [];
    let currentPage = 1;
    let totalPages = 1;

    while (currentPage <= totalPages) {
      const url = `https://thirdparty.qonto.com/v2/transactions?iban=${iban}&side=credit&status=completed&per_page=100&current_page=${currentPage}`;
      const data: QontoResponse = await qontoFetch(url, login, secretKey);
      allTransactions.push(...data.transactions);
      if (data.meta) {
        totalPages = data.meta.total_pages;
        currentPage = data.meta.next_page ?? totalPages + 1;
      } else {
        break;
      }
    }

    const { data: existingTxRows } = await supabase
      .from("transactions_ca")
      .select("qonto_id, montant, statut, id")
      .not("qonto_id", "is", null);

    const existingTxQontoIds = new Set(
      (existingTxRows ?? []).map((r: { qonto_id: string }) => r.qonto_id)
    );

    let txImported = 0;
    let txUpdated = 0;
    let txSkipped = 0;

    for (const tx of allTransactions) {
      const qontoId = tx.transaction_id;
      const montant = tx.amount_cents / 100;
      const datePaiement = tx.settled_at ? tx.settled_at.split("T")[0] : null;
      const libelle = tx.label || "";

      if (existingTxQontoIds.has(qontoId)) {
        txSkipped++;
        continue;
      }

      const { data: matchingSigne } = await supabase
        .from("transactions_ca")
        .select("id")
        .eq("montant", montant)
        .eq("statut", "signe")
        .is("qonto_id", null)
        .limit(1);

      if (matchingSigne && matchingSigne.length > 0) {
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
        txUpdated++;
      } else {
        await supabase.from("transactions_ca").insert({
          montant,
          statut: "paye",
          source: "qonto",
          qonto_id: qontoId,
          libelle,
          date: datePaiement ?? new Date().toISOString().split("T")[0],
          date_paiement: datePaiement,
        });
        txImported++;
      }
    }

    // ========== 2. FACTURES (client_invoices) ==========
    let facturesImported = 0;
    let facturesUpdated = 0;
    let facturesError: string | null = null;

    try {
      console.log("[qonto/sync] Fetching client_invoices...");
      const invoicesData = await qontoFetch(
        "https://thirdparty.qonto.com/v2/client_invoices?per_page=100",
        login,
        secretKey
      );
      console.log("[qonto/sync] client_invoices count:", (invoicesData.client_invoices ?? []).length);
      const invoices: QontoInvoice[] = invoicesData.client_invoices ?? [];

      const { data: existingFactureRows } = await supabase
        .from("transactions_ca")
        .select("qonto_id, statut, id")
        .eq("source", "qonto_invoice")
        .not("qonto_id", "is", null);

      const existingFactureMap = new Map(
        (existingFactureRows ?? []).map((r: { qonto_id: string; statut: string; id: string }) => [r.qonto_id, r])
      );

      for (const inv of invoices) {
        if (inv.status !== "unpaid" && inv.status !== "paid") continue;

        const statut = inv.status === "paid" ? "paye" : "en_attente";
        const datePaiement = inv.status === "paid" && inv.paid_at
          ? inv.paid_at.split("T")[0]
          : null;
        const existing = existingFactureMap.get(inv.id);

        if (existing) {
          if (existing.statut !== statut) {
            await supabase
              .from("transactions_ca")
              .update({ statut, date_paiement: datePaiement })
              .eq("id", existing.id);
            facturesUpdated++;
          }
        } else {
          await supabase.from("transactions_ca").insert({
            qonto_id: inv.id,
            libelle: inv.invoice_number || `Facture Qonto`,
            montant: inv.total_amount_cents / 100,
            statut,
            source: "qonto_invoice",
            date: inv.created_at ? inv.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
            date_paiement: datePaiement,
          });
          facturesImported++;
        }
      }
    } catch (err) {
      facturesError = err instanceof Error ? err.message : String(err);
      console.error("[qonto/sync] Factures sync error:", facturesError);
    }

    // Save sync result
    const result = {
      transactions: { imported: txImported, updated: txUpdated, skipped: txSkipped, total: allTransactions.length },
      factures: { imported: facturesImported, updated: facturesUpdated, error: facturesError },
    };

    await supabase.from("parametres").upsert({
      cle: "qonto_last_sync",
      valeur: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await supabase.from("parametres").upsert({
      cle: "qonto_last_sync_result",
      valeur: JSON.stringify(result),
      updated_at: new Date().toISOString(),
    });

    return Response.json({ success: true, ...result });
  } catch (err) {
    console.error("Qonto sync error:", err);
    return Response.json(
      { error: "Erreur interne lors de la synchronisation." },
      { status: 500 }
    );
  }
}
