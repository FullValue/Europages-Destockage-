// Paiements Compack.
// - Mollie : paiement par carte (CB, Visa, Mastercard, Apple Pay…) sur Market, et liens de paiement
//   créés depuis le back-office pour n'importe quelle commande (Destock compris).
//   Variable : MOLLIE_API_KEY (test_… pour les essais, live_… pour encaisser réellement).
// - Qonto : rapprochement automatique des virements reçus sur le compte Qonto avec les commandes
//   « virement » en attente (la référence du virement doit contenir le n° de commande, ex. CMD-0012).
//   Variables : QONTO_LOGIN (identifiant de l'organisation) et QONTO_SECRET_KEY ; QONTO_IBAN (facultatif)
//   pour choisir le compte surveillé, sinon le compte principal.
// Les clés ne sont jamais écrites dans le code ni renvoyées au navigateur.

const MOLLIE = "https://api.mollie.com/v2";
const QONTO = "https://thirdparty.qonto.com/v2";

const mollieOn = () => !!process.env.MOLLIE_API_KEY;
const mollieTest = () => String(process.env.MOLLIE_API_KEY || "").startsWith("test_");
const qontoOn = () => !!(process.env.QONTO_LOGIN && process.env.QONTO_SECRET_KEY);

async function call(url, opt, who) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { ...opt, signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(`${who} : ${j.detail || j.message || j.errors?.[0]?.detail || "erreur " + r.status}`), { status: 502 });
    return j;
  } catch (e) {
    if (e.name === "AbortError") throw Object.assign(new Error(`${who} ne répond pas`), { status: 504 });
    throw e.status ? e : Object.assign(new Error(`${who} injoignable`), { status: 502 });
  } finally { clearTimeout(t); }
}

/* ---------- Mollie ---------- */
const mollie = (path, body) => call(MOLLIE + path, {
  method: body ? "POST" : "GET",
  headers: { Authorization: "Bearer " + process.env.MOLLIE_API_KEY, ...(body ? { "Content-Type": "application/json" } : {}) },
  body: body ? JSON.stringify(body) : undefined,
}, "Mollie");

/** Crée un paiement Mollie pour la commande. kind : "checkout" (paiement Market) ou "link" (lien envoyé par l'admin). */
async function createMolliePayment(o, { kind, redirectUrl, webhookUrl }) {
  const p = await mollie("/payments", {
    amount: { currency: "EUR", value: o.totalTTC.toFixed(2) },
    description: `Commande ${o.id} — Compack ${o.site === "destock" ? "Destock" : "Market"}`,
    redirectUrl, ...(webhookUrl ? { webhookUrl } : {}),
    locale: "fr_FR", metadata: { orderId: o.id },
  });
  o.mollie = { id: p.id, kind, status: p.status, checkoutUrl: p._links?.checkout?.href || null, mode: p.mode, createdAt: new Date().toISOString() };
  return o.mollie;
}
const getMolliePayment = id => mollie("/payments/" + encodeURIComponent(id));

/* ---------- Qonto ---------- */
const qonto = path => call(QONTO + path, { headers: { Authorization: `${process.env.QONTO_LOGIN}:${process.env.QONTO_SECRET_KEY}`, Accept: "application/json" } }, "Qonto");

async function qontoAccount() {
  const { organization } = await qonto("/organization");
  const accounts = organization?.bank_accounts || [];
  const want = String(process.env.QONTO_IBAN || "").replace(/\s/g, "").toUpperCase();
  const acc = (want && accounts.find(a => a.iban === want)) || accounts.find(a => a.main) || accounts[0];
  if (!acc) throw Object.assign(new Error("Qonto : aucun compte bancaire trouvé"), { status: 502 });
  return acc;
}

/** Virements reçus (crédits validés) depuis `since` sur le compte surveillé. */
async function qontoCredits(acc, since) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const q = new URLSearchParams({ bank_account_id: acc.id, side: "credit", "status[]": "completed", settled_at_from: since.toISOString(), per_page: "100", current_page: String(page) });
    const r = await qonto("/transactions?" + q);
    out.push(...(r.transactions || []));
    if (!r.meta?.next_page) break;
  }
  return out;
}

module.exports = { mollieOn, mollieTest, qontoOn, createMolliePayment, getMolliePayment, qontoAccount, qontoCredits };
