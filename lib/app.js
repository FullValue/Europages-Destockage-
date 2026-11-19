// Compack — API commune : Compack Destock (gros), Compack Market (détail) et back-office.
// Utilisée par server.js (local) et par api/handler.js (Vercel). Données : voir lib/store.js.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const store = require("./store.js");
const pay = require("./payments.js");

const PUB = path.join(__dirname, "..", "public");

// Base de la requête en cours (une requête à la fois par instance, voir store.withDb)
let db = null;
let dirty = false;
const save = () => { dirty = true; };

/* ---------- helpers ---------- */
const now = () => new Date().toISOString();
const round2 = n => Math.round(n * 100) / 100;
const hash = (pw, salt = crypto.randomBytes(16).toString("hex")) => salt + ":" + crypto.scryptSync(pw, salt, 32).toString("hex");
const checkPw = (pw, stored) => { const [salt, h] = stored.split(":"); return crypto.timingSafeEqual(Buffer.from(h, "hex"), crypto.scryptSync(pw, salt, 32)); };
function nextId(prefix, coll) {
  db.counters[coll] = (db.counters[coll] || 0) + 1;
  return prefix + String(db.counters[coll]).padStart(4, "0");
}
const COLLS = { products: "P-", requests: "DV-", orders: "CMD-", customers: "CL-", messages: "MSG-", movements: "MV-" };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".csv": "text/csv; charset=utf-8", ".woff2": "font/woff2", ".woff": "font/woff" };

function send(res, code, body, headers = {}) {
  const isStr = typeof body === "string" || Buffer.isBuffer(body);
  res.writeHead(code, { "Content-Type": isStr ? "text/plain; charset=utf-8" : "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(isStr ? body : JSON.stringify(body));
}
const fail = (res, code, error) => send(res, code, { error });
// Le corps est lu avant le traitement (voir handleApi) ; Vercel le fournit déjà dans req.body.
async function parseBody(req, limit = 12e6) {
  const form = /application\/x-www-form-urlencoded/.test(req.headers["content-type"] || "");
  const decode = t => form ? Object.fromEntries(new URLSearchParams(t)) : (t ? JSON.parse(t) : {});
  if (req.body !== undefined) return typeof req.body === "string" ? decode(req.body) : Buffer.isBuffer(req.body) ? decode(req.body.toString("utf8")) : (req.body || {});
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) throw Object.assign(new Error("Requête trop volumineuse"), { status: 413 }); chunks.push(c); }
  try { return decode(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("JSON invalide"), { status: 400 }); }
}
const readBody = async req => req.parsedBody;
const cookies = req => Object.fromEntries((req.headers.cookie || "").split(";").map(c => c.trim().split("=")).filter(c => c[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join("="))]));
// Session sans état serveur (compatible serverless) : cookie « expiration.signature », signé avec SESSION_SECRET
// ou, à défaut, avec l'empreinte du mot de passe (changer le mot de passe déconnecte tout le monde).
const SESSION_MS = 12 * 36e5;
const sessionKey = () => process.env.SESSION_SECRET || db.settings.adminPassword;
const sign = exp => crypto.createHmac("sha256", sessionKey()).update(String(exp)).digest("base64url");
const newSession = () => { const exp = Date.now() + SESSION_MS; return `${exp}.${sign(exp)}`; };
const isAdmin = req => {
  const [exp, sig] = String(cookies(req).csid || "").split(".");
  if (!exp || !sig || +exp < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const sameText = (a, b) => crypto.timingSafeEqual(crypto.createHash("sha256").update(a).digest(), crypto.createHash("sha256").update(b).digest());
const secureFlag = req => (req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "");
// Image locale (assets/…) ou URL complète (Vercel Blob)
const imgUrl = i => (/^https?:\/\//.test(i) ? i : "/" + i.replace(/^\//, ""));
const str = (v, max = 2000) => String(v ?? "").trim().slice(0, max);
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/* ---------- domain ---------- */
const prod = id => db.products.find(p => p.id === id);
function moveStock(p, delta, reason, ref = "") {
  p.stock = Math.max(0, (p.stock || 0) + delta);
  p.updatedAt = now();
  db.movements.unshift({ id: nextId("MV-", "movements"), productId: p.id, sku: p.sku, name: p.name, delta, stockAfter: p.stock, reason, ref, at: now() });
}
function upsertCustomer(c, type, site) {
  const email = str(c.email, 200).toLowerCase();
  let cu = db.customers.find(x => x.email === email);
  if (!cu) {
    cu = { id: nextId("CL-", "customers"), type, sites: [], name: "", company: "", email, phone: "", siret: "", address: "", city: "", zip: "", notes: "", tags: [], createdAt: now() };
    db.customers.unshift(cu);
  }
  for (const k of ["name", "company", "phone", "siret", "address", "city", "zip"]) if (c[k]) cu[k] = str(c[k], 300);
  if (type === "pro") cu.type = "pro";
  if (!cu.sites.includes(site)) cu.sites.push(site);
  cu.updatedAt = now();
  return cu;
}
const unitPriceOf = p => p.destock.lotQty ? p.destock.lotPrice / p.destock.lotQty : null;
function destockStatus(p) {
  if (p.destock.status === "vendu" || p.stock <= 0) return "Vendu";
  return p.destock.tag || "";
}
function destockJs() {
  const lots = db.products.filter(p => p.destock.active && catOn(p.cat, "destock")).map(p => {
    const onDemand = p.destock.status === "sur_demande", u = unitPriceOf(p);
    // stock commun : si des ventes détail ont entamé le lot, on propose le reliquat au prix unitaire du lot
    const partial = p.destock.lotQty && p.stock > 0 && p.stock < p.destock.lotQty && p.destock.status !== "vendu";
    return {
      ref: p.destock.ref || p.sku, cat: p.cat, sub: p.sub, t: p.destock.title || p.name,
      qty: partial ? p.stock : p.destock.lotQty || null,
      price: onDemand ? null : partial && u ? round2(u * p.stock) : p.destock.lotPrice || null,
      u: onDemand || !u ? null : round2(u),
      ul: p.unitLabel || "pièce", pub: p.publicValue || null, cond: p.cond,
      note: partial ? `Lot partiel : ${p.stock} ${p.unitLabel || "pièce"}(s) restant(es)` : p.destock.note || "",
      desc: p.desc, tag: partial && destockStatus(p) !== "Vendu" ? "Lot partiel" : destockStatus(p), ex: p.destock.extra || [], imgs: p.images.map(imgUrl),
    };
  });
  return `/* Généré par le serveur Compack — ne pas modifier */\nconst CATS = ${JSON.stringify(catsFor("destock"))};\nconst LOTS = ${JSON.stringify(lots)};\n`;
}
const marketView = p => ({
  id: p.id, sku: p.sku, name: p.market.title || p.name, cat: p.cat, sub: p.sub, desc: p.desc, cond: p.cond,
  images: p.images.map(imgUrl), price: p.market.price, compareAt: p.market.compareAt || null,
  stock: p.stock, featured: !!p.market.featured, unitLabel: p.unitLabel || "pièce",
});
// Catégories : chacune peut être affichée sur Destock, sur Market, ou sur les deux (par défaut les deux).
// Un produit dont la catégorie est masquée sur un site n'apparaît pas sur ce site.
const catOn = (k, site) => { const c = db.categories[k]; return !!c && c[site] !== false; };
const catsFor = site => Object.fromEntries(Object.entries(db.categories).filter(([k]) => catOn(k, site)).map(([k, c]) => [k, { name: c.name, icon: c.icon }]));
const slug = t => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "categorie";
function categoryList() {
  return Object.entries(db.categories).map(([key, c]) => ({
    key, name: c.name, icon: c.icon || "📦", destock: c.destock !== false, market: c.market !== false,
    products: db.products.filter(p => p.cat === key).length,
  }));
}
const marketProducts = () => db.products.filter(p => p.market.active && p.market.price > 0 && catOn(p.cat, "market"));
function publicSettings() {
  const s = db.settings;
  return { shippingFee: s.shippingFee, freeShippingFrom: s.freeShippingFrom, vatRate: s.vatRate, company: s.company, categories: catsFor("market"), cardPayment: pay.mollieOn() || !process.env.VERCEL, cardTest: !pay.mollieOn() || pay.mollieTest() };
}

function stats() {
  const day = 864e5, t = Date.now();
  const inDays = (d, n) => t - new Date(d).getTime() < n * day;
  const live = db.orders.filter(o => o.status !== "annulee");
  const sum = arr => round2(arr.reduce((s, o) => s + o.totalHT, 0));
  const series = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(t - i * day).toISOString().slice(0, 10);
    const of = live.filter(o => o.createdAt.slice(0, 10) === d);
    series.push({ d, destock: sum(of.filter(o => o.site === "destock")), market: sum(of.filter(o => o.site === "market")) });
  }
  const top = {};
  live.forEach(o => o.items.forEach(i => { top[i.productId] = (top[i.productId] || 0) + i.units; }));
  return {
    revenue30: { destock: sum(live.filter(o => o.site === "destock" && inDays(o.createdAt, 30))), market: sum(live.filter(o => o.site === "market" && inDays(o.createdAt, 30))) },
    ordersToProcess: db.orders.filter(o => ["en_attente", "confirmee", "preparation"].includes(o.status)).length,
    newRequests: db.requests.filter(r => r.status === "nouvelle").length,
    openRequests: db.requests.filter(r => !["acceptee", "refusee"].includes(r.status)).length,
    newMessages: db.messages.filter(m => m.status === "nouveau").length,
    lowStock: db.products.filter(p => (p.destock.active || p.market.active) && p.stock <= (p.alertThreshold ?? db.settings.lowStockDefault)).length,
    stockValue: round2(db.products.reduce((s, p) => s + p.stock * (p.cost || unitPriceOf(p) || 0), 0)),
    stockUnits: db.products.reduce((s, p) => s + p.stock, 0),
    customers: { pro: db.customers.filter(c => c.type === "pro").length, particulier: db.customers.filter(c => c.type === "particulier").length },
    series,
    top: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, units]) => ({ id, units, name: prod(id)?.name || id })),
  };
}

function makeOrder({ site, customer, items, shipping = 0, payment, notes = "", requestId = null, status = "en_attente" }) {
  const totalHT = round2(items.reduce((s, i) => s + i.lineHT, 0) + (site === "market" ? shipping / (1 + db.settings.vatRate) : shipping));
  const o = {
    id: nextId("CMD-", "orders"), site, customerId: customer.id, customerName: customer.company || customer.name, email: customer.email,
    items, shipping: round2(shipping), totalHT, totalTTC: round2(totalHT * (1 + db.settings.vatRate)),
    status, payment: payment || "virement", paymentStatus: "en_attente", requestId, tracking: "", notes,
    shippingAddress: [customer.address, customer.zip, customer.city].filter(Boolean).join(", "),
    history: [{ at: now(), status, by: site === "market" ? "client" : "admin" }], createdAt: now(),
  };
  items.forEach(i => { const p = prod(i.productId); if (p) moveStock(p, -i.units, `Commande ${site === "market" ? "détail" : "gros"}`, o.id); });
  db.orders.unshift(o);
  return o;
}

/* ---------- paiements ---------- */
const SITE_DOMAIN = { destock: "compack-destock.com", market: "compack-market.com" };
const reqHost = req => String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
const isLocal = req => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(reqHost(req));
const origin = req => `${isLocal(req) ? "http" : "https"}://${reqHost(req)}`;
// Page publique d'un site : sur le domaine du site en ligne, sous /destock ou /market en local
const sitePage = (req, site, page) => isLocal(req) ? `${origin(req)}/${site}/${page}` : `https://${SITE_DOMAIN[site]}/${page}`;
const returnUrl = (req, o) => sitePage(req, o.site, `${o.site === "market" ? "confirmation" : "paiement"}.html?id=${encodeURIComponent(o.id)}&email=${encodeURIComponent(o.email)}`);
// Mollie ne peut pas joindre un serveur local : pas de webhook en local, le statut est vérifié au retour du client
const webhookUrl = req => isLocal(req) ? undefined : `${origin(req)}/api/public/payments/mollie`;

function cancelOrder(o, by, reason) {
  if (o.status === "annulee") return;
  o.items.forEach(i => { const p = prod(i.productId); if (p) moveStock(p, i.units, reason, o.id); });
  o.status = "annulee"; o.history.push({ at: now(), status: "annulee", by });
}
/** Applique le statut d'un paiement Mollie à la commande. */
function applyMollie(o, p) {
  const before = JSON.stringify([o.status, o.paymentStatus, o.mollie?.status]);
  const by = "Mollie" + (p.mode === "test" ? " (test)" : "");
  o.mollie = { ...o.mollie, status: p.status };
  if (p.status === "paid" && o.paymentStatus !== "payee") {
    o.paymentStatus = "payee"; o.paidAt = p.paidAt || now();
    o.history.push({ at: now(), status: "paiement : payee", by });
    if (o.status === "en_attente") { o.status = "confirmee"; o.history.push({ at: now(), status: "confirmee", by }); }
  } else if (["canceled", "expired", "failed"].includes(p.status) && o.paymentStatus !== "payee") {
    // Paiement Market abandonné : la commande est annulée et le stock libéré. Lien admin : la commande reste ouverte.
    if (o.mollie.kind === "checkout") cancelOrder(o, by, "Paiement carte non abouti");
    else o.history.push({ at: now(), status: "lien de paiement : " + p.status, by });
  }
  return before !== JSON.stringify([o.status, o.paymentStatus, o.mollie?.status]);
}
async function syncMollie(o) {
  if (!o.mollie?.id || !pay.mollieOn() || o.paymentStatus === "payee" || ["canceled", "expired", "failed"].includes(o.mollie.status)) return false;
  return applyMollie(o, await pay.getMolliePayment(o.mollie.id));
}
const publicOrder = o => ({
  id: o.id, site: o.site, status: o.status, paymentStatus: o.paymentStatus, payment: o.payment, items: o.items, totalHT: o.totalHT, totalTTC: o.totalTTC,
  shipping: o.shipping, createdAt: o.createdAt, tracking: o.tracking,
  payUrl: o.mollie && ["open", "pending"].includes(o.mollie.status) && o.paymentStatus !== "payee" && o.status !== "annulee" ? o.mollie.checkoutUrl : null,
});

/** Rapprochement Qonto : marque payées les commandes « virement » dont le virement est arrivé. */
async function qontoReconcile(by) {
  if (!pay.qontoOn()) throw Object.assign(new Error("Qonto n'est pas configuré : ajoutez QONTO_LOGIN et QONTO_SECRET_KEY au projet Vercel"), { status: 400 });
  const acc = await pay.qontoAccount();
  // IBAN affiché aux clients pour les virements
  const c = db.settings.company || (db.settings.company = {});
  if (!c.iban && acc.iban) { c.iban = acc.iban; c.bic = c.bic || acc.bic || ""; save(); }
  const pending = db.orders.filter(o => o.payment === "virement" && o.paymentStatus === "en_attente" && o.status !== "annulee");
  const res = { account: acc.iban ? acc.iban.slice(0, 4) + " … " + acc.iban.slice(-4) : acc.id, checked: 0, matched: [], review: [] };
  if (!pending.length) return res;
  const oldest = Math.min(...pending.map(o => new Date(o.createdAt).getTime()));
  const since = new Date(Math.max(oldest - 864e5, Date.now() - 90 * 864e5));
  const credits = await pay.qontoCredits(acc, since);
  const seen = new Set(db.orders.flatMap(o => o.qontoTx || []));
  res.checked = credits.length;
  for (const t of credits) {
    const txId = t.transaction_id || t.id;
    if (!txId || seen.has(txId)) continue;
    const amount = t.amount_cents != null ? t.amount_cents / 100 : +t.amount;
    // n° de commande dans la référence ou le libellé : CMD-0012, CMD 12, cmd0012…
    const text = [t.reference, t.label, t.note].filter(Boolean).join(" ").toUpperCase().replace(/[\s._-]/g, "");
    const nums = [...text.matchAll(/CMD0*(\d+)/g)].map(m => +m[1]);
    const o = pending.find(x => nums.includes(+x.id.replace(/\D/g, "")) && x.paymentStatus === "en_attente");
    if (!o) continue;
    seen.add(txId); (o.qontoTx = o.qontoTx || []).push(txId);
    if (Math.abs(amount - o.totalTTC) <= 0.01) {
      o.paymentStatus = "payee"; o.paidAt = t.settled_at || now();
      o.history.push({ at: now(), status: "paiement : payee", by: `Qonto, virement de ${t.label || "client"} (${by})` });
      if (o.status === "en_attente") { o.status = "confirmee"; o.history.push({ at: now(), status: "confirmee", by: "Qonto" }); }
      res.matched.push({ order: o.id, amount });
    } else {
      o.history.push({ at: now(), status: `virement reçu : ${amount.toFixed(2)} € au lieu de ${o.totalTTC.toFixed(2)} €`, by: "Qonto" });
      res.review.push({ order: o.id, amount, expected: o.totalTTC });
    }
    save();
  }
  return res;
}

/* ---------- routes ---------- */
async function api(req, res, url) {
  const m = req.method, p = url.pathname;
  let seg;

  // Public
  if (m === "GET" && p === "/api/public/destock.js") return send(res, 200, destockJs(), { "Content-Type": MIME[".js"] });
  if (m === "GET" && p === "/api/public/settings") return send(res, 200, publicSettings());
  if (m === "GET" && p === "/api/public/market/products") return send(res, 200, marketProducts().map(marketView));
  if (m === "GET" && (seg = p.match(/^\/api\/public\/market\/products\/([\w-]+)$/))) {
    const pr = prod(seg[1]); if (!pr || !pr.market.active || !catOn(pr.cat, "market")) return fail(res, 404, "Produit introuvable");
    return send(res, 200, marketView(pr));
  }
  if (m === "GET" && (seg = p.match(/^\/api\/public\/market\/orders\/([\w-]+)$/))) {
    const o = db.orders.find(x => x.id === seg[1] && x.site === "market" && x.email === str(url.searchParams.get("email")).toLowerCase());
    if (!o) return fail(res, 404, "Commande introuvable");
    return send(res, 200, publicOrder(o));
  }
  if (m === "POST" && p === "/api/public/destock/requests") {
    const b = await readBody(req);
    const c = b.customer || {};
    if (!str(c.name) || !str(c.company) || !emailOk(str(c.email))) return fail(res, 400, "Nom, société et e-mail valides requis");
    const items = (b.items || []).slice(0, 50).map(i => {
      const pr = db.products.find(x => x.destock.active && (x.destock.ref || x.sku) === i.ref);
      if (!pr || pr.stock <= 0 || pr.destock.status === "vendu") return null;
      const n = Math.max(1, Math.min(99, parseInt(i.n) || 1));
      const partial = pr.destock.lotQty && pr.stock < pr.destock.lotQty;
      const lotQty = partial ? pr.stock : pr.destock.lotQty || 0;
      const lotPrice = pr.destock.status === "sur_demande" ? null : partial ? round2(unitPriceOf(pr) * pr.stock) : pr.destock.lotPrice || null;
      return { productId: pr.id, ref: pr.destock.ref, name: pr.destock.title || pr.name, lots: partial ? 1 : n, lotQty, lotPrice };
    }).filter(Boolean);
    if (!items.length) return fail(res, 400, "Les lots demandés ne sont plus disponibles");
    const cu = upsertCustomer(c, "pro", "destock");
    const r = { id: nextId("DV-", "requests"), customerId: cu.id, customerName: cu.company || cu.name, email: cu.email, phone: cu.phone, items, message: str(b.message), status: "nouvelle", quoteAmount: null, notes: "", orderId: null, history: [{ at: now(), status: "nouvelle", by: "client" }], createdAt: now() };
    db.requests.unshift(r); save();
    return send(res, 201, { id: r.id });
  }
  if (m === "POST" && p === "/api/public/market/orders") {
    const b = await readBody(req);
    const c = b.customer || {};
    if (!str(c.name) || !emailOk(str(c.email)) || !str(c.address) || !str(c.zip) || !str(c.city)) return fail(res, 400, "Nom, e-mail et adresse complète requis");
    const items = [];
    for (const i of (b.items || []).slice(0, 50)) {
      const pr = prod(i.id); const q = Math.max(1, Math.min(999, parseInt(i.qty) || 1));
      if (!pr || !pr.market.active) return fail(res, 400, `Produit indisponible : ${i.id}`);
      if (pr.stock < q) return fail(res, 409, `Stock insuffisant pour « ${pr.market.title || pr.name} » (reste ${pr.stock})`);
      const ttc = pr.market.price;
      items.push({ productId: pr.id, sku: pr.sku, name: pr.market.title || pr.name, qty: q, units: q, unitPriceTTC: ttc, lineTTC: round2(ttc * q), lineHT: round2(ttc * q / (1 + db.settings.vatRate)) });
    }
    if (!items.length) return fail(res, 400, "Panier vide");
    const sub = items.reduce((s, i) => s + i.lineTTC, 0);
    const shipping = sub >= db.settings.freeShippingFrom ? 0 : db.settings.shippingFee;
    const cu = upsertCustomer(c, "particulier", "market");
    const method = ["carte", "virement", "retrait"].includes(b.payment) ? b.payment : "carte";
    if (method === "carte" && !pay.mollieOn() && process.env.VERCEL) return fail(res, 503, "Le paiement par carte est momentanément indisponible. Choisissez le virement ou le retrait.");
    const o = makeOrder({ site: "market", customer: cu, items, shipping, payment: method, notes: str(b.notes) });
    if (method === "carte" && pay.mollieOn()) {
      // Paiement Mollie : la commande reste « en attente » jusqu'à la confirmation de Mollie (webhook ou retour du client)
      try { await pay.createMolliePayment(o, { kind: "checkout", redirectUrl: returnUrl(req, o), webhookUrl: webhookUrl(req) }); }
      catch (e) { cancelOrder(o, "système", "Paiement carte indisponible"); save(); return fail(res, 502, "Le paiement par carte n'a pas pu démarrer. Réessayez ou choisissez le virement. (" + e.message + ")"); }
      save();
      return send(res, 201, { id: o.id, totalTTC: o.totalTTC, status: o.status, paymentStatus: o.paymentStatus, checkoutUrl: o.mollie.checkoutUrl });
    }
    if (method === "carte") { o.paymentStatus = "payee"; o.status = "confirmee"; o.history.push({ at: now(), status: "confirmee", by: "paiement simulé (local, sans Mollie)" }); }
    save();
    return send(res, 201, { id: o.id, totalTTC: o.totalTTC, status: o.status, paymentStatus: o.paymentStatus });
  }
  if (m === "POST" && p === "/api/public/payments/mollie") {
    // Webhook Mollie : on ne fait pas confiance au corps, on relit le paiement chez Mollie
    const b = await readBody(req); const id = str(b.id, 64);
    const o = id && db.orders.find(x => x.mollie?.id === id);
    if (o && pay.mollieOn() && applyMollie(o, await pay.getMolliePayment(id))) save();
    return send(res, 200, "ok");
  }
  if (m === "POST" && p === "/api/public/orders/check") {
    // Retour du client après paiement : statut à jour de la commande (vérifié chez Mollie si besoin)
    const b = await readBody(req);
    const o = db.orders.find(x => x.id === str(b.id, 30).toUpperCase() && x.email === str(b.email, 200).toLowerCase());
    if (!o) return fail(res, 404, "Commande introuvable");
    if (await syncMollie(o)) save();
    return send(res, 200, publicOrder(o));
  }
  if (m === "GET" && p === "/api/cron/qonto") {
    // Tâche planifiée Vercel (vercel.json → crons), protégée par CRON_SECRET
    if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return fail(res, 401, "Non autorisé");
    if (!pay.qontoOn()) return send(res, 200, { skipped: "Qonto non configuré" });
    return send(res, 200, await qontoReconcile("automatique"));
  }
  if (m === "POST" && p === "/api/public/messages") {
    const b = await readBody(req);
    if (!emailOk(str(b.email))) return fail(res, 400, "E-mail valide requis");
    const site = b.site === "market" ? "market" : "destock";
    const type = b.type === "sell" ? "sell" : "contact";
    const msg = { id: nextId("MSG-", "messages"), site, type, name: str(b.nom || b.name, 200), company: str(b.societe, 200), email: str(b.email, 200).toLowerCase(), phone: str(b.tel, 50), subject: str(b.sujet || (type === "sell" ? "Proposition de stock" : "Contact"), 200), body: str(b.message || b.desc, 5000), fields: Object.fromEntries(["cat", "qte", "prix"].filter(k => b[k]).map(k => [k, str(b[k], 200)])), status: "nouveau", createdAt: now() };
    db.messages.unshift(msg); save();
    return send(res, 201, { id: msg.id });
  }

  // Auth
  if (m === "POST" && p === "/api/admin/login") {
    const b = await readBody(req);
    const pw = String(b.password || "");
    const user = String(b.username || "").trim().toLowerCase();
    if (user !== (process.env.ADMIN_USER || db.settings.adminUser || "admin").toLowerCase()) return fail(res, 401, "Identifiant ou mot de passe incorrect");
    // ADMIN_PASSWORD (variable d'environnement) reste toujours valable : c'est le mot de passe de secours.
    const ok = pw && (checkPw(pw, db.settings.adminPassword) || (process.env.ADMIN_PASSWORD && sameText(pw, process.env.ADMIN_PASSWORD)));
    if (!ok) return fail(res, 401, "Identifiant ou mot de passe incorrect");
    return send(res, 200, { ok: true }, { "Set-Cookie": `csid=${newSession()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${secureFlag(req)}` });
  }
  if (m === "POST" && p === "/api/admin/logout") return send(res, 200, { ok: true }, { "Set-Cookie": "csid=; Path=/; Max-Age=0" });
  if (!p.startsWith("/api/admin/")) return fail(res, 404, "Route inconnue");
  if (!isAdmin(req)) return fail(res, 401, "Non connecté");

  // Admin
  if (m === "GET" && p === "/api/admin/me") return send(res, 200, { ok: true });
  if (m === "GET" && p === "/api/admin/stats") return send(res, 200, stats());
  if (m === "GET" && p === "/api/admin/settings") { const { adminPassword, ...s } = db.settings; return send(res, 200, { ...s, adminUser: process.env.ADMIN_USER || s.adminUser || "admin", categories: db.categories }); }
  if (m === "PATCH" && p === "/api/admin/settings") {
    const b = await readBody(req);
    for (const k of ["shippingFee", "freeShippingFrom", "vatRate", "lowStockDefault"]) if (b[k] !== undefined && !isNaN(+b[k])) db.settings[k] = +b[k];
    if (b.company) db.settings.company = { ...db.settings.company, ...b.company };
    if (b.newPassword) { if (String(b.newPassword).length < 8) return fail(res, 400, "8 caractères minimum"); db.settings.adminPassword = hash(String(b.newPassword)); }
    save(); return send(res, 200, { ok: true });
  }
  if (m === "POST" && p === "/api/admin/demo/clear") {
    for (const c of ["orders", "requests", "customers", "messages"]) db[c] = db[c].filter(x => !x.demo);
    db.movements = db.movements.filter(x => !x.demo);
    save(); return send(res, 200, { ok: true });
  }
  if (m === "GET" && p === "/api/admin/categories") return send(res, 200, categoryList());
  if (m === "POST" && p === "/api/admin/categories") {
    const b = await readBody(req);
    const name = str(b.name, 80); if (!name) return fail(res, 400, "Nom de catégorie requis");
    if (Object.values(db.categories).some(c => c.name.toLowerCase() === name.toLowerCase())) return fail(res, 409, "Cette catégorie existe déjà");
    let key = slug(name), n = 2; while (db.categories[key]) key = slug(name) + "-" + n++;
    db.categories[key] = { name, icon: str(b.icon, 8) || "📦", destock: b.destock !== false, market: b.market !== false };
    save(); return send(res, 201, categoryList().find(c => c.key === key));
  }
  if (m === "POST" && p === "/api/admin/categories/order") {
    const b = await readBody(req); const keys = Array.isArray(b.keys) ? b.keys.filter(k => db.categories[k]) : [];
    if (keys.length !== Object.keys(db.categories).length) return fail(res, 400, "Liste de catégories incomplète");
    db.categories = Object.fromEntries(keys.map(k => [k, db.categories[k]]));
    save(); return send(res, 200, categoryList());
  }
  if ((seg = p.match(/^\/api\/admin\/categories\/([\w-]+)$/))) {
    const key = seg[1], c = db.categories[key]; if (!c) return fail(res, 404, "Catégorie introuvable");
    if (m === "PATCH") {
      const b = await readBody(req);
      if (b.name !== undefined) {
        const name = str(b.name, 80); if (!name) return fail(res, 400, "Nom de catégorie requis");
        if (Object.entries(db.categories).some(([k, x]) => k !== key && x.name.toLowerCase() === name.toLowerCase())) return fail(res, 409, "Cette catégorie existe déjà");
        c.name = name;
      }
      if (b.icon !== undefined) c.icon = str(b.icon, 8) || "📦";
      for (const s of ["destock", "market"]) if (typeof b[s] === "boolean") c[s] = b[s];
      save(); return send(res, 200, categoryList().find(x => x.key === key));
    }
    if (m === "DELETE") {
      if (Object.keys(db.categories).length <= 1) return fail(res, 409, "Il faut garder au moins une catégorie");
      const used = db.products.filter(x => x.cat === key);
      const to = url.searchParams.get("moveTo");
      if (used.length) {
        if (!to || to === key || !db.categories[to]) return fail(res, 409, `${used.length} produit(s) dans cette catégorie : choisissez où les déplacer`);
        used.forEach(x => { x.cat = to; x.updatedAt = now(); });
      }
      delete db.categories[key];
      save(); return send(res, 200, { ok: true, moved: used.length });
    }
  }
  if (m === "GET" && p === "/api/admin/payments/status") return send(res, 200, { mollie: pay.mollieOn(), mollieTest: pay.mollieTest(), qonto: pay.qontoOn(), cron: !!process.env.CRON_SECRET });
  if (m === "POST" && p === "/api/admin/qonto/sync") return send(res, 200, await qontoReconcile("manuel"));
  if (m === "POST" && (seg = p.match(/^\/api\/admin\/orders\/([\w-]+)\/(payment-link|payment-check)$/))) {
    const o = db.orders.find(x => x.id === seg[1]); if (!o) return fail(res, 404, "Commande introuvable");
    if (seg[2] === "payment-check") { if (await syncMollie(o)) save(); return send(res, 200, o); }
    if (!pay.mollieOn()) return fail(res, 400, "Mollie n'est pas configuré : ajoutez MOLLIE_API_KEY au projet Vercel");
    if (o.status === "annulee") return fail(res, 409, "Commande annulée");
    if (o.paymentStatus === "payee") return fail(res, 409, "Commande déjà payée");
    if (!o.totalTTC || o.totalTTC < 1) return fail(res, 400, "Montant de la commande trop faible pour un paiement en ligne");
    await pay.createMolliePayment(o, { kind: "link", redirectUrl: returnUrl(req, o), webhookUrl: webhookUrl(req) });
    o.history.push({ at: now(), status: "lien de paiement créé", by: "admin" }); save();
    return send(res, 201, o);
  }
  if (m === "POST" && p === "/api/admin/upload") {
    const b = await readBody(req);
    const mm = String(b.data || "").match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
    if (!mm) return fail(res, 400, "Image PNG, JPG ou WEBP attendue");
    const ext = mm[1] === "jpeg" ? "jpg" : mm[1];
    const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
    const data = Buffer.from(mm[2], "base64");
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // Vercel : le disque n'est pas conservé, les photos vont dans Vercel Blob
      const { put } = require("@vercel/blob");
      const blob = await put(`uploads/${name}`, data, { access: "public", contentType: `image/${ext === "jpg" ? "jpeg" : ext}` });
      return send(res, 201, { path: blob.url });
    }
    if (process.env.VERCEL) return fail(res, 500, "Stockage des photos non configuré : ajoutez Vercel Blob au projet.");
    fs.writeFileSync(path.join(PUB, "assets", "uploads", name), data);
    return send(res, 201, { path: `assets/uploads/${name}` });
  }
  if (m === "POST" && (seg = p.match(/^\/api\/admin\/products\/([\w-]+)\/stock$/))) {
    const pr = prod(seg[1]); if (!pr) return fail(res, 404, "Produit introuvable");
    const b = await readBody(req); const d = parseInt(b.delta);
    if (!d) return fail(res, 400, "Quantité non nulle requise");
    moveStock(pr, d, str(b.reason, 200) || (d > 0 ? "Entrée de stock" : "Sortie de stock"), str(b.ref, 100)); save();
    return send(res, 200, pr);
  }
  if (m === "POST" && (seg = p.match(/^\/api\/admin\/requests\/([\w-]+)\/convert$/))) {
    const r = db.requests.find(x => x.id === seg[1]); if (!r) return fail(res, 404, "Demande introuvable");
    if (r.orderId) return fail(res, 409, "Déjà convertie en commande " + r.orderId);
    const b = await readBody(req);
    const cu = db.customers.find(c => c.id === r.customerId);
    const items = r.items.map((i, k) => {
      const lotPrice = b.prices && b.prices[k] != null ? +b.prices[k] : i.lotPrice || 0;
      return { productId: i.productId, sku: prod(i.productId)?.sku, name: i.name, qty: i.lots, units: i.lots * (i.lotQty || 1), unitPriceHT: lotPrice, lineHT: round2(lotPrice * i.lots) };
    });
    for (const i of items) { const pr = prod(i.productId); if (pr && pr.stock < i.units && !b.force) return fail(res, 409, `Stock insuffisant pour ${i.name} (reste ${pr.stock}, demandé ${i.units})`); }
    const o = makeOrder({ site: "destock", customer: cu, items, shipping: +b.shipping || 0, payment: "virement", requestId: r.id, status: "confirmee" });
    r.orderId = o.id; r.status = "acceptee"; r.history.push({ at: now(), status: "acceptee", by: "admin" });
    save(); return send(res, 201, o);
  }
  if (m === "PATCH" && (seg = p.match(/^\/api\/admin\/orders\/([\w-]+)$/))) {
    const o = db.orders.find(x => x.id === seg[1]); if (!o) return fail(res, 404, "Commande introuvable");
    const b = await readBody(req);
    if (b.status && b.status !== o.status) {
      if (o.status === "annulee") return fail(res, 409, "Commande annulée : non modifiable");
      if (b.status === "annulee") o.items.forEach(i => { const pr = prod(i.productId); if (pr) moveStock(pr, i.units, "Annulation commande", o.id); });
      o.status = b.status; o.history.push({ at: now(), status: b.status, by: "admin" });
    }
    if (b.paymentStatus && b.paymentStatus !== o.paymentStatus) { o.paymentStatus = b.paymentStatus; o.history.push({ at: now(), status: "paiement : " + b.paymentStatus, by: "admin" }); }
    for (const k of ["tracking", "notes"]) if (b[k] !== undefined) o[k] = str(b[k]);
    o.updatedAt = now(); save(); return send(res, 200, o);
  }
  if (m === "PATCH" && (seg = p.match(/^\/api\/admin\/requests\/([\w-]+)$/))) {
    const r = db.requests.find(x => x.id === seg[1]); if (!r) return fail(res, 404, "Demande introuvable");
    const b = await readBody(req);
    if (b.status && b.status !== r.status) { r.status = b.status; r.history.push({ at: now(), status: b.status, by: "admin" }); }
    if (b.quoteAmount !== undefined) r.quoteAmount = b.quoteAmount === "" ? null : +b.quoteAmount;
    if (b.notes !== undefined) r.notes = str(b.notes);
    r.updatedAt = now(); save(); return send(res, 200, r);
  }
  if (m === "POST" && p === "/api/admin/orders") {
    // commande saisie manuellement (téléphone, salon…)
    const b = await readBody(req);
    const site = b.site === "market" ? "market" : "destock";
    const cu = b.customerId ? db.customers.find(c => c.id === b.customerId) : (emailOk(str(b.customer?.email)) ? upsertCustomer(b.customer, site === "destock" ? "pro" : "particulier", site) : null);
    if (!cu) return fail(res, 400, "Client requis (existant ou nouvel e-mail valide)");
    const items = [];
    for (const i of b.items || []) {
      const pr = prod(i.productId); const q = Math.max(1, parseInt(i.qty) || 1);
      if (!pr) return fail(res, 400, "Produit introuvable");
      const partial = site === "destock" && pr.destock.lotQty && pr.stock < pr.destock.lotQty; // reliquat de lot
      const units = site === "destock" ? (partial ? pr.stock : q * (pr.destock.lotQty || 1)) : q;
      if (pr.stock < units || units <= 0) return fail(res, 409, `Stock insuffisant pour ${pr.name} (reste ${pr.stock})`);
      const price = +i.price || (site === "destock" ? (partial ? round2(unitPriceOf(pr) * pr.stock) : pr.destock.lotPrice) : pr.market.price) || 0;
      const lineHT = site === "market" ? round2(price * q / (1 + db.settings.vatRate)) : round2(price * (partial ? 1 : q));
      items.push({ productId: pr.id, sku: pr.sku, name: pr.name, qty: partial ? 1 : q, units, ...(site === "market" ? { unitPriceTTC: price, lineTTC: round2(price * q) } : { unitPriceHT: price }), lineHT });
    }
    if (!items.length) return fail(res, 400, "Ajoutez au moins une ligne");
    const o = makeOrder({ site, customer: cu, items, shipping: +b.shipping || 0, payment: b.payment, notes: str(b.notes), status: "confirmee" });
    o.history[0].by = "admin"; save(); return send(res, 201, o);
  }
  if (m === "GET" && (seg = p.match(/^\/api\/admin\/export\/(\w+)\.csv$/))) {
    const rows = db[seg[1]]; if (!rows || !COLLS[seg[1]]) return fail(res, 404, "Inconnu");
    const flat = r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "object" && v !== null ? JSON.stringify(v) : v]));
    const data = rows.map(flat); const keys = [...new Set(data.flatMap(Object.keys))];
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = "﻿" + [keys.map(q).join(";"), ...data.map(r => keys.map(k => q(r[k])).join(";"))].join("\n");
    return send(res, 200, csv, { "Content-Type": MIME[".csv"], "Content-Disposition": `attachment; filename="${seg[1]}.csv"` });
  }

  // CRUD générique
  if ((seg = p.match(/^\/api\/admin\/(\w+)(?:\/([\w-]+))?$/)) && COLLS[seg[1]]) {
    const [, coll, id] = seg; const list = db[coll];
    if (m === "GET" && !id) return send(res, 200, list);
    const idx = id ? list.findIndex(x => x.id === id) : -1;
    if (id && idx < 0) return fail(res, 404, "Introuvable");
    if (m === "GET") return send(res, 200, list[idx]);
    if (m === "DELETE") {
      if (coll === "orders" && list[idx].status !== "annulee") return fail(res, 409, "Annulez la commande avant de la supprimer (le stock sera restitué)");
      list.splice(idx, 1); save(); return send(res, 200, { ok: true });
    }
    const b = await readBody(req); delete b.id;
    if (coll === "products") {
      if (b.stock !== undefined && idx >= 0 && +b.stock !== list[idx].stock) { moveStock(list[idx], +b.stock - list[idx].stock, "Correction d'inventaire"); }
      delete b.stock;
    }
    if (m === "POST" && !id) {
      const item = { ...(coll === "products" ? { images: [], stock: 0, destock: { active: false }, market: { active: false } } : {}), ...b, id: nextId(COLLS[coll], coll), createdAt: now() };
      if (coll === "products") { const s = parseInt(b.initialStock) || 0; delete item.initialStock; list.unshift(item); if (s) moveStock(item, s, "Stock initial"); }
      else list.unshift(item);
      save(); return send(res, 201, item);
    }
    if (m === "PATCH" || m === "PUT") {
      const cur = list[idx];
      for (const k of ["destock", "market", "company"]) if (b[k] && typeof b[k] === "object") b[k] = { ...cur[k], ...b[k] };
      Object.assign(cur, b, { updatedAt: now() }); save(); return send(res, 200, cur);
    }
  }
  return fail(res, 404, "Route inconnue");
}


/** Point d'entrée de l'API : charge la base, traite la requête, enregistre, puis répond. */
async function handleApi(req, res) {
  const url = new URL(req.url, "http://localhost");
  // Vercel : la réécriture /api/* → /api/handler transmet le chemin d'origine dans « path »
  if (url.pathname === "/api/handler") url.pathname = "/api/" + (url.searchParams.get("path") || "");
  const out = { code: 200, headers: {}, body: "", headersSent: false,
    writeHead(code, h) { this.code = code; Object.assign(this.headers, h); this.headersSent = true; }, end(b) { this.body = b ?? ""; } };
  try {
    if (req.method !== "GET" && req.method !== "HEAD") req.parsedBody = await parseBody(req);
    // Écriture : toute requête sauf GET/HEAD, plus la tâche planifiée Qonto (appelée en GET par Vercel)
    const write = (req.method !== "GET" && req.method !== "HEAD") || url.pathname === "/api/cron/qonto";
    await store.withDb(write, async ctx => {
      db = ctx.db; dirty = false;
      try { await api(req, out, url); } finally { ctx.dirty = dirty; db = null; }
    });
  } catch (e) {
    if (!e.status) console.error(e);
    out.headersSent = false; fail(out, e.status || 500, e.message || "Erreur serveur");
  }
  res.writeHead(out.code, out.headers);
  res.end(out.body);
}

module.exports = { handleApi, MIME, send, fail, PUB };
