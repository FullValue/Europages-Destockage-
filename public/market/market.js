/* Compack Market — boutique détail (données : /api/public/market/*) */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const grp = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const eur = n => { const [i, d] = (+n).toFixed(2).split("."); return grp(i) + "," + d + " €"; };
const pct = p => p.compareAt && p.compareAt > p.price ? Math.round((1 - p.price / p.compareAt) * 100) : 0;
const Q = new URLSearchParams(location.search);
const cart = {
  get() { try { return JSON.parse(localStorage.getItem("cm_cart") || "[]"); } catch { return []; } },
  set(v) { try { localStorage.setItem("cm_cart", JSON.stringify(v)); } catch {} badge(); },
  add(id, qty = 1) { const c = cart.get(), it = c.find(x => x.id === id); it ? (it.qty += qty) : c.push({ id, qty }); cart.set(c); },
  count() { return cart.get().reduce((s, i) => s + i.qty, 0); },
};
let PRODUCTS = [], SETTINGS = { shippingFee: 5.9, freeShippingFrom: 60, categories: {} };
const api = async (url, opt) => {
  try { const r = await fetch(url, opt); const j = await r.json(); return r.ok ? j : { error: j.error || "Erreur" }; }
  catch { return { error: "Serveur injoignable, réessayez." }; }
};
function toast(html) {
  let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.append(t); }
  t.innerHTML = html; t.classList.add("show"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2600);
}
function badge() { const b = $("#cc"); if (b) b.textContent = cart.count(); }
function addToCart(id, qty = 1) {
  const p = PRODUCTS.find(x => x.id === id); if (!p) return;
  const inCart = cart.get().find(x => x.id === id)?.qty || 0;
  if (inCart + qty > p.stock) return toast(`Plus que ${p.stock} en stock`);
  cart.add(id, qty); toast(`Ajouté au panier · <a href="panier.html">Voir le panier</a>`);
}
document.addEventListener("click", e => { const b = e.target.closest("[data-add]"); if (b) { e.preventDefault(); addToCart(b.dataset.add); } });

function layout() {
  const cats = Object.entries(SETTINGS.categories);
  const cur = Q.get("cat");
  $("#header").outerHTML = `
  <div class="promo">Livraison offerte dès <b>${eur(SETTINGS.freeShippingFrom)}</b> · Petits prix toute l'année sur des produits neufs</div>
  <header class="top"><div class="container hrow">
    <a class="logo" href="index.html"><i>C</i>Compack<span>Market</span></a>
    <form class="msearch" action="boutique.html" role="search"><input name="q" type="search" value="${esc(Q.get("q") || "")}" placeholder="Rechercher un produit…" aria-label="Rechercher"><button>OK</button></form>
    <nav class="hact"><a href="boutique.html" class="hide-s">Boutique</a><a href="suivi.html" class="hide-s">Suivi de commande</a><a href="contact.html" class="hide-s">Aide</a>
    <a class="cartbtn" href="panier.html" aria-label="Panier">🛒 <b id="cc">${cart.count()}</b></a></nav>
  </div>
  <nav class="catnav" aria-label="Catégories"><div class="container"><a href="boutique.html" class="${!cur && document.body.dataset.page === "shop" ? "on" : ""}">Tout</a>${cats.map(([k, c]) => `<a href="boutique.html?cat=${k}" class="${cur === k ? "on" : ""}">${c.icon} ${esc(c.name)}</a>`).join("")}</div></nav></header>`;
  $("#footer").outerHTML = `
  <footer class="mfoot"><div class="container cols">
    <div><a class="logo" href="index.html" style="color:#fff"><i>C</i>Compack<span style="color:#5eead4">Market</span></a><p>Des produits neufs issus de fins de séries et de surstocks, à prix cassés.</p></div>
    <div><h4>Boutique</h4>${cats.slice(0, 5).map(([k, c]) => `<a href="boutique.html?cat=${k}">${esc(c.name)}</a>`).join("")}</div>
    <div><h4>Aide</h4><a href="suivi.html">Suivre ma commande</a><a href="contact.html">Nous contacter</a><a href="cgv.html">CGV &amp; livraison</a></div>
    <div><h4>Professionnels</h4><a href="/destock/">Compack Destock — achat en gros</a><a href="/destock/vendre.html">Vendre votre stock</a><a href="/admin/">Espace admin</a></div>
  </div><div class="copy">© 2026 Compack Market · Paiement sécurisé · Retours sous 14 jours</div></footer>`;
}

const card = p => {
  const d = pct(p);
  return `<article class="pcard">
  <a class="pimg" href="produit.html?id=${p.id}">${d ? `<span class="disc">-${d}%</span>` : ""}${p.stock > 0 && p.stock <= 5 ? `<span class="low">Plus que ${p.stock}</span>` : ""}${pic(p, esc(p.name), 'loading="lazy"')}</a>
  <div class="pbody"><small>${esc(p.sub)}</small><h3><a href="produit.html?id=${p.id}">${esc(p.name)}</a></h3>
  <div class="prow"><div><span class="price">${eur(p.price)}</span>${d ? `<span class="was">${eur(p.compareAt)}</span>` : ""}</div>
  ${p.stock > 0 ? `<button class="addbtn" data-add="${p.id}" aria-label="Ajouter ${esc(p.name)} au panier">+</button>` : `<small style="color:var(--red)">Épuisé</small>`}</div></div></article>`;
};

// Photo du produit, ou icône de sa catégorie quand aucune photo n'a été ajoutée
const pic = (p, alt = "", attrs = "") => p.images[0] ? `<img src="${p.images[0]}" alt="${alt}" ${attrs}>` : `<span class="nopic" role="img" aria-label="${alt}">${SETTINGS.categories[p.cat]?.icon || "📦"}</span>`;

/* ---------- pages ---------- */
function home() {
  const feat = PRODUCTS.filter(p => p.featured && p.stock > 0);
  const deals = [...PRODUCTS].filter(p => p.stock > 0).sort((a, b) => pct(b) - pct(a)).slice(0, 8);
  const hero = feat.find(p => p.images[0]) || PRODUCTS.find(p => p.images[0]);
  if (hero) $("#heroart").innerHTML = `<img src="${hero.images[0]}" alt="">`;
  $("#cats").innerHTML = Object.entries(SETTINGS.categories).filter(([k]) => PRODUCTS.some(p => p.cat === k)).map(([k, c]) => `<a href="boutique.html?cat=${k}"><i>${c.icon}</i>${esc(c.name)}</a>`).join("");
  $("#deals").innerHTML = deals.map(card).join("");
  $("#feat").innerHTML = (feat.length ? feat : PRODUCTS).slice(0, 8).map(card).join("");
  $("#free").textContent = eur(SETTINGS.freeShippingFrom);
}

function shop() {
  const st = { cat: Q.get("cat") || "", q: Q.get("q") || "", max: "", promo: Q.get("promo") === "1", instock: true, sort: "pop" };
  const F = $("#side");
  F.innerHTML = `<div class="grp"><h3>Catégorie</h3><label><input type="radio" name="cat" value="" ${!st.cat ? "checked" : ""}> Toutes</label>${Object.entries(SETTINGS.categories).filter(([k]) => PRODUCTS.some(p => p.cat === k)).map(([k, c]) => `<label><input type="radio" name="cat" value="${k}" ${st.cat === k ? "checked" : ""}> ${esc(c.name)}</label>`).join("")}</div>
    <div class="grp"><h3>Prix maximum</h3><input type="number" name="max" min="0" placeholder="ex. 30 €"></div>
    <div class="grp"><h3>Options</h3><label><input type="checkbox" name="promo" ${st.promo ? "checked" : ""}> En promotion</label><label><input type="checkbox" name="instock" checked> En stock uniquement</label></div>`;
  const draw = () => {
    const q = st.q.toLowerCase();
    const r = PRODUCTS.filter(p => (!st.cat || p.cat === st.cat) && (!q || (p.name + p.sub + p.desc).toLowerCase().includes(q)) && (st.max === "" || p.price <= +st.max) && (!st.promo || pct(p) > 0) && (!st.instock || p.stock > 0))
      .sort({ pop: (a, b) => (b.featured - a.featured) || pct(b) - pct(a), pa: (a, b) => a.price - b.price, pd: (a, b) => b.price - a.price, disc: (a, b) => pct(b) - pct(a) }[st.sort]);
    $("#title").textContent = st.cat ? SETTINGS.categories[st.cat]?.name : st.q ? `Résultats pour « ${st.q} »` : "Toute la boutique";
    $("#count").textContent = `${r.length} produit${r.length > 1 ? "s" : ""}`;
    $("#grid").innerHTML = r.length ? r.map(card).join("") : `<div class="empty" style="grid-column:1/-1">Aucun produit ne correspond à votre recherche.</div>`;
  };
  F.addEventListener("input", e => { const t = e.target; if (t.name === "cat") st.cat = t.value; if (t.name === "max") st.max = t.value; if (t.name === "promo") st.promo = t.checked; if (t.name === "instock") st.instock = t.checked; draw(); });
  $("#sort").onchange = e => { st.sort = e.target.value; draw(); };
  $("#ftoggle").onclick = () => F.classList.toggle("open");
  draw();
}

async function product() {
  const p = PRODUCTS.find(x => x.id === Q.get("id"));
  const box = $("#pdp");
  if (!p) { box.innerHTML = `<div class="empty" style="grid-column:1/-1"><h2>Produit introuvable</h2><a class="btn brand" href="boutique.html">Retour à la boutique</a></div>`; return; }
  document.title = `${p.name} — Compack Market`;
  const cat = SETTINGS.categories[p.cat];
  $("#crumb").innerHTML = `<a href="index.html">Accueil</a> › <a href="boutique.html?cat=${p.cat}">${esc(cat?.name || p.sub)}</a> › ${esc(p.name)}`;
  const d = pct(p);
  const stock = p.stock <= 0 ? `<span class="dot out"></span>Épuisé` : p.stock <= 5 ? `<span class="dot warn"></span>Plus que ${p.stock} en stock` : `<span class="dot"></span>En stock, expédié sous 48 h`;
  box.innerHTML = `
  <div class="gallery"><div class="big">${pic(p, esc(p.name), 'id="bigimg"')}</div>
    ${p.images.length > 1 ? `<div class="thumbs">${p.images.map((s, k) => `<button class="${k ? "" : "on"}" data-k="${k}" aria-label="Image ${k + 1}"><img src="${s}" alt=""></button>`).join("")}</div>` : ""}</div>
  <div class="pinfo">
    <small style="color:var(--brand-d);font-weight:700;text-transform:uppercase;letter-spacing:.5px">${esc(p.sub)}</small>
    <h1>${esc(p.name)}</h1>
    <div><span class="price">${eur(p.price)}</span>${d ? `<span class="was" style="font-size:18px">${eur(p.compareAt)}</span> <span class="disc" style="position:static;margin-left:8px">-${d}%</span>` : ""}</div>
    <small style="color:var(--muted)">Prix TTC · ${esc(p.cond)} · Réf. ${esc(p.sku)}</small>
    <div class="stockline">${stock}</div>
    <div class="buyrow"><div class="qty"><button type="button" id="minus" aria-label="Moins">−</button><input id="q" value="1" inputmode="numeric" aria-label="Quantité"><button type="button" id="plus" aria-label="Plus">+</button></div>
    <button class="btn brand" id="addp" ${p.stock <= 0 ? "disabled" : ""}>Ajouter au panier</button></div>
    <button class="btn sun block" id="buynow" ${p.stock <= 0 ? "disabled" : ""}>Acheter maintenant</button>
    <div class="reass" style="margin-top:18px"><div>🚚 <span>Livraison ${eur(SETTINGS.shippingFee)}, <b>offerte dès ${eur(SETTINGS.freeShippingFrom)}</b></span></div><div>↩️ <span>Retours gratuits sous 14 jours</span></div><div>🔒 <span>Paiement sécurisé</span></div></div>
  </div>`;
  $("#desc").innerHTML = `<h2>Description</h2><p>${esc(p.desc)}</p>`;
  const q = $("#q"), clamp = v => Math.max(1, Math.min(p.stock || 1, parseInt(v) || 1));
  $("#minus").onclick = () => q.value = clamp(+q.value - 1);
  $("#plus").onclick = () => q.value = clamp(+q.value + 1);
  q.onchange = () => q.value = clamp(q.value);
  $("#addp").onclick = () => addToCart(p.id, clamp(q.value));
  $("#buynow").onclick = () => { addToCart(p.id, clamp(q.value)); location.href = "commande.html"; };
  box.querySelectorAll(".thumbs button").forEach(b => b.onclick = () => { $("#bigimg").src = p.images[+b.dataset.k]; box.querySelectorAll(".thumbs button").forEach(x => x.classList.toggle("on", x === b)); });
  $("#related").innerHTML = PRODUCTS.filter(x => x.cat === p.cat && x.id !== p.id && x.stock > 0).concat(PRODUCTS.filter(x => x.cat !== p.cat && x.stock > 0)).slice(0, 4).map(card).join("");
}

function lines() {
  return cart.get().map(i => ({ ...i, p: PRODUCTS.find(x => x.id === i.id) })).filter(i => i.p);
}
function totals(ls) {
  const sub = ls.reduce((s, i) => s + i.p.price * i.qty, 0);
  const ship = !ls.length || sub >= SETTINGS.freeShippingFrom ? 0 : SETTINGS.shippingFee;
  return { sub, ship, tot: sub + ship };
}
function summary(ls, withBtn) {
  const t = totals(ls), left = SETTINGS.freeShippingFrom - t.sub;
  return `<h2>Récapitulatif</h2>
  ${ls.length ? `<div class="freebar">${left > 0 ? `Plus que <b>${eur(left)}</b> pour la livraison offerte` : `🎉 Livraison offerte !`}<i><b style="width:${Math.min(100, t.sub / SETTINGS.freeShippingFrom * 100)}%"></b></i></div>` : ""}
  <div class="sumrow"><span>Sous-total</span><span>${eur(t.sub)}</span></div>
  <div class="sumrow"><span>Livraison</span><span>${t.ship ? eur(t.ship) : "Offerte"}</span></div>
  <div class="sumrow tot"><span>Total TTC</span><span>${eur(t.tot)}</span></div>
  ${withBtn ? `<a class="btn brand block" style="margin-top:16px" href="commande.html" ${ls.length ? "" : "disabled"}>Passer commande</a><a class="btn line block" style="margin-top:8px" href="boutique.html">Continuer mes achats</a>` : ""}`;
}

function cartPage() {
  const draw = () => {
    const ls = lines();
    // ajuste les quantités au stock réel
    let fixed = false; ls.forEach(i => { if (i.qty > i.p.stock) { i.qty = i.p.stock; fixed = true; } });
    if (fixed) cart.set(ls.filter(i => i.qty > 0).map(({ id, qty }) => ({ id, qty })));
    $("#lines").innerHTML = ls.length ? ls.filter(i => i.qty > 0).map(i => `<div class="line">${pic(i.p)}
      <div><h3><a href="produit.html?id=${i.id}">${esc(i.p.name)}</a></h3><small style="color:var(--muted)">${eur(i.p.price)} l'unité</small><br>
      <div class="qty" style="margin-top:8px"><button data-d="-1" data-id="${i.id}" aria-label="Moins">−</button><input value="${i.qty}" readonly aria-label="Quantité"><button data-d="1" data-id="${i.id}" aria-label="Plus">+</button></div>
      <button class="rm" data-rm="${i.id}">Retirer</button></div><b>${eur(i.p.price * i.qty)}</b></div>`).join("")
      : `<div class="empty" style="padding:30px">Votre panier est vide.<br><a class="btn brand" style="margin-top:14px" href="boutique.html">Découvrir la boutique</a></div>`;
    $("#sum").innerHTML = summary(ls, true);
  };
  $("#lines").onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    let c = cart.get();
    if (b.dataset.rm) c = c.filter(x => x.id !== b.dataset.rm);
    if (b.dataset.d) { const it = c.find(x => x.id === b.dataset.id), p = PRODUCTS.find(x => x.id === b.dataset.id); it.qty = Math.max(1, Math.min(p.stock, it.qty + +b.dataset.d)); }
    cart.set(c); draw();
  };
  draw();
}

function checkout() {
  const ls = lines();
  if (!ls.length) { $("#co").innerHTML = `<div class="empty" style="grid-column:1/-1">Votre panier est vide. <a href="boutique.html">Retour à la boutique</a></div>`; return; }
  $("#sum").innerHTML = summary(ls, false) + `<div style="margin-top:14px">${ls.map(i => `<div class="sumrow" style="font-size:13px;color:var(--muted)"><span>${i.qty} × ${esc(i.p.name)}</span><span>${eur(i.p.price * i.qty)}</span></div>`).join("")}</div>`;
  const f = $("#cof");
  f.onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const btn = $("#pay"); btn.disabled = true; btn.textContent = "Traitement…";
    const r = await api("/api/public/market/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer: { name: d.name, email: d.email, phone: d.phone, address: d.address, zip: d.zip, city: d.city }, payment: d.payment, notes: d.notes, items: cart.get() }) });
    btn.disabled = false; btn.textContent = "Valider la commande";
    if (r.error) { $("#err").innerHTML = `<div class="msg err">${esc(r.error)}</div>`; return; }
    cart.set([]);
    location.href = `confirmation.html?id=${encodeURIComponent(r.id)}&email=${encodeURIComponent(d.email)}`;
  };
}

const STEPS = [["en_attente", "Reçue"], ["confirmee", "Confirmée"], ["preparation", "En préparation"], ["expediee", "Expédiée"], ["livree", "Livrée"]];
function orderView(o) {
  const idx = STEPS.findIndex(s => s[0] === o.status);
  const pay = { carte: "Carte bancaire", virement: "Virement bancaire", retrait: "Paiement au retrait" }[o.payment] || o.payment;
  return `${o.status === "annulee" ? `<div class="msg err">Cette commande a été annulée.</div>` : `<div class="timeline">${STEPS.map((s, k) => `<span class="${k <= idx ? "on" : ""}">${s[1]}</span>`).join("")}</div>`}
  <div class="panel" style="text-align:left">${o.items.map(i => `<div class="sumrow"><span>${i.qty} × ${esc(i.name)}</span><span>${eur(i.lineTTC)}</span></div>`).join("")}
  <div class="sumrow"><span>Livraison</span><span>${o.shipping ? eur(o.shipping) : "Offerte"}</span></div><div class="sumrow tot"><span>Total TTC</span><span>${eur(o.totalTTC)}</span></div>
  <p style="font-size:14px;color:var(--muted);margin:12px 0 0">Paiement : ${pay} — ${o.paymentStatus === "payee" ? "reçu ✔" : "en attente"}${o.tracking ? `<br>N° de suivi : <b>${esc(o.tracking)}</b>` : ""}</p>
  ${o.payment === "virement" && o.paymentStatus !== "payee" ? `<div class="msg ok">Merci d'effectuer votre virement en indiquant la référence <b>${o.id}</b>. La commande sera préparée dès réception.</div>` : ""}</div>`;
}
async function confirmation() {
  const o = await api(`/api/public/market/orders/${encodeURIComponent(Q.get("id"))}?email=${encodeURIComponent(Q.get("email") || "")}`);
  $("#conf").innerHTML = o.error ? `<div class="msg err">${esc(o.error)}</div>` : `<div class="big">🎉</div><h1>Merci pour votre commande !</h1><p>Votre commande <b>${o.id}</b> est enregistrée. Conservez ce numéro : il vous permet de <a href="suivi.html">suivre votre commande</a> avec votre e-mail.</p>${orderView(o)}<a class="btn brand" style="margin-top:20px" href="boutique.html">Continuer mes achats</a>`;
}
function track() {
  const f = $("#trackf");
  f.onsubmit = async e => {
    e.preventDefault();
    const o = await api(`/api/public/market/orders/${encodeURIComponent(f.id.value.trim().toUpperCase())}?email=${encodeURIComponent(f.email.value.trim())}`);
    $("#tres").innerHTML = o.error ? `<div class="msg err">Aucune commande trouvée avec ces informations.</div>` : `<h2>Commande ${o.id}</h2><p style="color:var(--muted)">Passée le ${new Date(o.createdAt).toLocaleDateString("fr-FR")}</p>${orderView(o)}`;
  };
}
function contact() {
  const f = $("#contactf");
  f.onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const r = await api("/api/public/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...d, site: "market", type: "contact" }) });
    $("#flash").innerHTML = r.error ? `<div class="msg err">${esc(r.error)}</div>` : `<div class="msg ok"><b>Message envoyé.</b> Notre service client vous répond sous 24 h ouvrées.</div>`;
    if (!r.error) f.reset();
  };
}

(async () => {
  const [p, s] = await Promise.all([api("/api/public/market/products"), api("/api/public/settings")]);
  if (!p.error) PRODUCTS = p;
  if (!s.error) SETTINGS = s;
  layout();
  ({ home, shop, product, cart: cartPage, checkout, confirmation, track, contact }[document.body.dataset.page] || (() => {}))();
})();
