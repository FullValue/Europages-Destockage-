// Base de départ de Compack : les lots Deal Stock (data/seed-lots.js) + quelques données de démo.
// buildSeed() est utilisé par le serveur quand la base est vide. En ligne de commande :
//   node seed.js            crée data/db.json (sans écraser une base existante)
//   node seed.js --force    écrase data/db.json
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const DB_FILE = path.join(__dirname, "data", "db.json");

function buildSeed() {
  const ctx = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "data", "seed-lots.js"), "utf8") + ";this.CATS=CATS;this.LOTS=LOTS;", ctx);
  const { CATS, LOTS } = ctx;
  const hash = pw => { const salt = crypto.randomBytes(16).toString("hex"); return salt + ":" + crypto.scryptSync(pw, salt, 32).toString("hex"); };
  const r2 = n => Math.round(n * 100) / 100;
  // Mot de passe admin : variable ADMIN_PASSWORD, sinon un mot de passe aléatoire affiché une seule fois
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
  if (!process.env.ADMIN_PASSWORD) console.log(`Mot de passe admin généré : ${ADMIN_PASSWORD}  (notez-le, il ne sera plus affiché)`);
  const retail = v => Math.max(2.99, Math.ceil(v) - 0.01);
  const iso = daysAgo => new Date(Date.now() - daysAgo * 864e5 - Math.random() * 6 * 36e5).toISOString();

  const products = LOTS.map((l, i) => {
    const sold = l.tag === "Vendu";
    const unit = l.u || (l.price && l.qty ? l.price / l.qty : null);
    const stock = sold ? 0 : l.qty || 40;
    const pubUnit = !l.pub || (!l.qty && l.price && l.pub > l.price) ? null : r2(l.qty ? l.pub / l.qty : l.pub); // valeur publique unitaire
    const marketPrice = pubUnit ? retail(pubUnit * 0.65) : unit ? retail(unit * 2.8) : null;
    const QTY = /\d[\d\s\u202f]*\s*(pièces|paires|sets|packs|box|références|modèles)|LOT DIVISIBLE|NEUF|neuves/i;
    const retailName = l.t.replace(/^Lot (de )?/i, "").split(" – ").filter((seg, k) => k === 0 || !QTY.test(seg)).join(" – ").replace(/^\d+\s+/, "").replace(/^./, c => c.toUpperCase());
    return {
      id: "P-" + String(i + 1).padStart(4, "0"), sku: l.ref, name: l.t.replace(/^Lot (de )?/i, "").replace(/^./, c => c.toUpperCase()),
      cat: l.cat, sub: l.sub, desc: l.desc, cond: l.cond, unitLabel: l.ul || "pièce", images: l.imgs,
      stock, cost: unit ? r2(unit * 0.6) : null, publicValue: pubUnit, alertThreshold: null, location: "Showroom Argenteuil (95)",
      destock: { active: true, ref: l.ref, title: l.t, lotQty: l.qty || null, lotPrice: l.price || null, status: sold ? "vendu" : l.price ? "disponible" : "sur_demande", tag: l.tag === "Nouveau" ? "Nouveau" : "", note: l.note || "", extra: l.ex || [] },
      market: { active: !sold && !!marketPrice && i % 3 !== 2, title: retailName, price: marketPrice, compareAt: pubUnit && pubUnit > marketPrice ? pubUnit : null, featured: i < 8 },
      createdAt: iso(60 - i * 0.5), updatedAt: iso(1),
    };
  });

  const db = {
    counters: { products: products.length, requests: 0, orders: 0, customers: 0, messages: 0, movements: 0 },
    settings: {
      adminUser: process.env.ADMIN_USER || "admin", adminPassword: hash(ADMIN_PASSWORD), shippingFee: 5.9, freeShippingFrom: 60, vatRate: 0.2, lowStockDefault: 10,
      company: { name: "Compack", email: "contact@compackeurodestockage.fr", phone: "", address: "Argenteuil (95)", siret: "" },
    },
    categories: CATS, products, requests: [], orders: [], customers: [], messages: [], movements: [],
  };
  const id = (p, c) => p + String(++db.counters[c]).padStart(4, "0");
  products.forEach(p => p.stock && db.movements.push({ id: id("MV-", "movements"), productId: p.id, sku: p.sku, name: p.name, delta: p.stock, stockAfter: p.stock, reason: "Stock initial (import Deal Stock)", ref: "", at: p.createdAt }));

  /* ---- données de démo (supprimables depuis Paramètres) ---- */
  const demoCust = [
    ["pro", "Karim B.", "Bazar du Centre (démo)", "demo.bazar@example.com", "Lyon", "69003"],
    ["pro", "Sophie L.", "Export Afrique Négoce (démo)", "demo.export@example.com", "Marseille", "13002"],
    ["pro", "Thomas R.", "Solderie Nord (démo)", "demo.solderie@example.com", "Lille", "59000"],
    ["particulier", "Julie Martin (démo)", "", "demo.julie@example.com", "Paris", "75011"],
    ["particulier", "Nicolas Petit (démo)", "", "demo.nicolas@example.com", "Nantes", "44000"],
    ["particulier", "Amina Diallo (démo)", "", "demo.amina@example.com", "Argenteuil", "95100"],
  ].map(([type, name, company, email, city, zip], k) => ({ id: id("CL-", "customers"), type, sites: [type === "pro" ? "destock" : "market"], name, company, email, phone: "06 00 00 00 0" + k, siret: "", address: (k + 3) + " rue de la Démo", city, zip, notes: "", tags: [], demo: true, createdAt: iso(30 - k) }));
  db.customers = demoCust.slice().reverse();

  const avail = products.filter(p => p.stock > 0 && p.destock.lotPrice);
  const reqStatuses = ["nouvelle", "nouvelle", "en_cours", "devis_envoye", "refusee"];
  reqStatuses.forEach((st, k) => {
    const c = demoCust[k % 3], p = avail[k * 3];
    db.requests.push({ id: id("DV-", "requests"), customerId: c.id, customerName: c.company, email: c.email, phone: c.phone, items: [{ productId: p.id, ref: p.destock.ref, name: p.destock.title, lots: 1, lotQty: p.destock.lotQty, lotPrice: p.destock.lotPrice }], message: "Bonjour, ce lot est-il toujours disponible ? Livraison possible ? (démo)", status: st, quoteAmount: st === "devis_envoye" ? p.destock.lotPrice : null, notes: "", orderId: null, history: [{ at: iso(6 - k), status: "nouvelle", by: "client" }], demo: true, createdAt: iso(6 - k) });
  });
  db.requests.reverse();

  const mk = products.filter(p => p.market.active && p.stock > 5);
  const ordStatuses = [["livree", "payee"], ["expediee", "payee"], ["preparation", "payee"], ["confirmee", "payee"], ["en_attente", "en_attente"], ["livree", "payee"], ["confirmee", "payee"]];
  ordStatuses.forEach(([st, pay], k) => {
    const c = demoCust[3 + (k % 3)];
    const items = [mk[k], mk[k + 5]].map((p, j) => { const q = j + 1; return { productId: p.id, sku: p.sku, name: p.name, qty: q, units: q, unitPriceTTC: p.market.price, lineTTC: r2(p.market.price * q), lineHT: r2(p.market.price * q / 1.2) }; });
    const ttc = items.reduce((s, i) => s + i.lineTTC, 0), ship = ttc >= 60 ? 0 : 5.9, at = iso(12 - k * 1.6);
    items.forEach(i => { const p = products.find(x => x.id === i.productId); p.stock = Math.max(0, p.stock - i.units); db.movements.push({ id: id("MV-", "movements"), productId: p.id, sku: p.sku, name: p.name, delta: -i.units, stockAfter: p.stock, reason: "Commande détail", ref: "", demo: true, at }); });
    db.orders.push({ id: id("CMD-", "orders"), site: "market", customerId: c.id, customerName: c.name, email: c.email, items, shipping: ship, totalHT: r2((ttc + ship) / 1.2), totalTTC: r2(ttc + ship), status: st, payment: "carte", paymentStatus: pay, requestId: null, tracking: ["expediee", "livree"].includes(st) ? "6A1234567890" + k : "", notes: "", shippingAddress: `${c.address}, ${c.zip}, ${c.city}`, history: [{ at, status: st, by: "démo" }], demo: true, createdAt: at });
  });
  const wp = avail[1];
  {
    const c = demoCust[0], at = iso(9), units = wp.destock.lotQty;
    wp.stock = Math.max(0, wp.stock - units);
    db.movements.push({ id: id("MV-", "movements"), productId: wp.id, sku: wp.sku, name: wp.name, delta: -units, stockAfter: wp.stock, reason: "Commande gros", ref: "", demo: true, at });
    db.orders.push({ id: id("CMD-", "orders"), site: "destock", customerId: c.id, customerName: c.company, email: c.email, items: [{ productId: wp.id, sku: wp.sku, name: wp.destock.title, qty: 1, units, unitPriceHT: wp.destock.lotPrice, lineHT: wp.destock.lotPrice }], shipping: 0, totalHT: wp.destock.lotPrice, totalTTC: r2(wp.destock.lotPrice * 1.2), status: "livree", payment: "virement", paymentStatus: "payee", requestId: null, tracking: "", notes: "Retrait showroom", shippingAddress: `${c.address}, ${c.zip}, ${c.city}`, history: [{ at, status: "livree", by: "démo" }], demo: true, createdAt: at });
  }
  db.orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  db.movements.sort((a, b) => b.at.localeCompare(a.at));
  db.messages.push(
    { id: id("MSG-", "messages"), site: "destock", type: "sell", name: "Paul (démo)", company: "Usine Textile Démo", email: "demo.usine@example.com", phone: "", subject: "Proposition de stock", body: "3 palettes de t-shirts coton, 4 800 pièces, tailles S à XXL. (démo)", fields: { cat: "Textile & mode", qte: "4 800 pièces", prix: "1,20 € / pièce" }, status: "nouveau", demo: true, createdAt: iso(2) },
    { id: id("MSG-", "messages"), site: "market", type: "contact", name: "Julie Martin (démo)", company: "", email: "demo.julie@example.com", phone: "", subject: "Suivi de ma commande", body: "Bonjour, quand ma commande sera-t-elle expédiée ? (démo)", fields: {}, status: "nouveau", demo: true, createdAt: iso(1) },
  );
  db.messages.reverse();
  return db;
}

module.exports = { buildSeed };

if (require.main === module) {
  if (fs.existsSync(DB_FILE) && !process.argv.includes("--force")) {
    console.log("data/db.json existe déjà. Relancez avec --force pour l'écraser.");
    process.exit(0);
  }
  const db = buildSeed();
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 1));
  console.log(`Base créée : ${db.products.length} produits, ${db.orders.length} commandes, ${db.requests.length} demandes (démo incluse).`);
  if (process.env.ADMIN_PASSWORD) console.log("Mot de passe admin : celui de ADMIN_PASSWORD.");
}
