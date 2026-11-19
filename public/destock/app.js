/* Compack Destock — rendu du site gros (données servies par /api/public/destock.js) */
LOTS.forEach(l => { l.n = +l.ref.split("-")[1]; l.loc = "Argenteuil (95)"; l.liv = "Retrait showroom · livraison sur devis"; l.sold = l.tag === "Vendu"; });


const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const grp = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
const num = n => grp(String(Math.round(n)));
const eur = n => (n % 1 ? n.toFixed(2).replace(".", ",").replace(/^\d+/, grp) : grp(String(n))) + " €";
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get: () => { try { return JSON.parse(localStorage.getItem("ce_cart") || "[]"); } catch { return []; } },
  set: v => { try { localStorage.setItem("ce_cart", JSON.stringify(v)); } catch {} },
};
function toast(m) {
  let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.append(t); }
  t.textContent = m; t.classList.add("show"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2200);
}
function vis(l, label = true, k = 0) {
  const c = CATS[l.cat], src = l.imgs[k] || l.imgs[0];
  return `<div class="vis">${src ? `<img src="${src}" alt="${esc(l.t)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('i'),{textContent:'${c.icon}'}))">` : `<i>${c.icon}</i>`}${label ? `<em class="lot-ref"><span aria-hidden="true"></span>${l.ref}</em>` : ""}</div>`;
}
const priceBlock = l => l.price ? `${eur(l.price)} HT<small>${l.u ? eur(l.u) + " / " + l.ul : "prix du lot"}</small>` : `Sur demande<small>Prix communiqué sur devis</small>`;
const badge = l => l.tag === "Vendu" ? `<span class="badge dark">Vendu</span>` : l.tag ? `<span class="badge">${l.tag}</span>` : `<span class="badge ok">Disponible</span>`;

/* ---------- Layout ---------- */
function layout() {
  const page = document.body.dataset.page;
  const links = [["lots.html", "Nos lots", "lots"], ["comment-ca-marche.html", "Comment ça marche", "how"], ["vendre.html", "Vendre votre stock", "sell"], ["contact.html", "Contact", "contact"]];
  const count = store.get().length;
  $("#header").outerHTML = `
  <header class="site-header"><div class="container hbar">
    <a class="logo" href="index.html"><i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m12 3 9 5v8l-9 5-9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5"/></svg></i>COMPACK <span>DESTOCK</span></a>
    <form class="search" action="lots.html" role="search"><input name="q" type="search" placeholder="Rechercher un lot, une catégorie…" aria-label="Rechercher"><button aria-label="Lancer la recherche"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></button></form>
    <button class="burger" aria-label="Menu" aria-expanded="false">☰</button>
    <nav class="nav">${links.map(([h, t, k]) => `<a href="${h}" class="${page === k ? "on" : ""}">${t}</a>`).join("")}
      <a href="demande.html" class="cart">Ma demande <b id="cartcount">${count}</b></a></nav>
  </div></header>`;
  $("#footer").outerHTML = `
  <footer><div class="container fgrid">
    <div><a class="logo" href="index.html"><i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m12 3 9 5v8l-9 5-9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5"/></svg></i>COMPACK <span>DESTOCK</span></a><p>Grossiste en déstockage professionnel : lots, surstocks et fins de séries, prix HT transparents.</p></div>
    <div><h4>Acheter</h4><a href="lots.html">Tous les lots</a>${Object.entries(CATS).slice(0, 4).map(([k, c]) => `<a href="lots.html?cat=${k}">${c.name}</a>`).join("")}</div>
    <div><h4>Société</h4><a href="comment-ca-marche.html">Comment ça marche</a><a href="vendre.html">Vendre votre stock</a><a href="contact.html">Contact</a><a href="mentions-legales.html">Mentions légales & CGV</a></div>
    <div><h4>Contact</h4><a href="mailto:contact@compackeurodestockage.fr">contact@compackeurodestockage.fr</a><p>France · Vente réservée aux professionnels<br>Réponse sous 24 h ouvrées</p></div>
  </div><div class="copy">© 2026 Compack Destock · <a href="/market/" style="display:inline">Compack Market, notre boutique détail</a> · <a href="/admin/" style="display:inline">Espace admin</a> — Tous droits réservés.</div></footer>`;
  const b = $(".burger"); b.onclick = () => { const o = $(".nav").classList.toggle("open"); b.setAttribute("aria-expanded", o); };
}
const bump = () => { const c = $("#cartcount"); if (c) c.textContent = store.get().length; };
function addToCart(ref, qty = 1) {
  const c = store.get(), it = c.find(x => x.ref === ref);
  if (it) it.n += qty; else c.push({ ref, n: qty });
  store.set(c); bump(); toast("Lot ajouté à votre demande");
}

/* ---------- Cards ---------- */
const tile = l => `<article class="tile">${vis(l)}<div class="body">
  <div>${badge(l)}</div>
  <h3><a href="lot.html?ref=${l.ref}">${esc(l.t)}</a></h3>
  <small>${esc(l.sub)} · Réf. ${l.ref}</small>
  <div class="foot"><div class="price">${priceBlock(l)}</div>
  <a class="btn ghost block" style="margin-top:12px" href="lot.html?ref=${l.ref}">Voir le détail</a></div></div></article>`;
const row = l => `<article class="row">${vis(l)}
  <div class="main"><div>${badge(l)} <small style="color:var(--muted)">Réf. ${l.ref} · ${esc(l.sub)}</small></div>
  <h3><a href="lot.html?ref=${l.ref}">${esc(l.t)}</a></h3>
  <div class="meta">${l.qty ? `<span>📦 ${num(l.qty)} ${esc(l.ul)}${l.qty > 1 && !l.ul.endsWith("s") ? "s" : ""}</span>` : `<span>📦 ${esc(l.note)}</span>`}<span>✅ ${esc(l.cond)}</span><span>📍 ${esc(l.loc)}</span></div>
  <p>${esc(l.desc)}</p></div>
  <div class="side"><div class="price">${priceBlock(l)}</div>
  <div style="display:grid;gap:8px;min-width:0"><a class="btn primary" href="lot.html?ref=${l.ref}">Voir le lot</a>${l.sold ? "" : `<button class="btn ghost" data-add="${l.ref}">${l.price ? "Ajouter à ma demande" : "Demander le prix"}</button>`}</div></div></article>`;
document.addEventListener("click", e => { const b = e.target.closest("[data-add]"); if (b) addToCart(b.dataset.add); });

/* ---------- Pages ---------- */
function home() {
  const counts = k => LOTS.filter(l => l.cat === k).length;
  const categoryPhotos = { cuisine: "SD-080", maison: "SD-082", textile: "SD-025", mode: "SD-076", enfant: "SD-015", outillage: "SD-087", hightech: "SD-016", sport: "SD-006", autre: "SD-031" };
  // Photo de la catégorie : photo choisie pour les catégories d'origine, sinon la photo d'un lot de la catégorie
  const catPhoto = k => k === "autre" ? "assets/illustrations/logistics.jpg" : categoryPhotos[k] ? `/assets/lots/${categoryPhotos[k]}-1.jpg` : (LOTS.find(l => l.cat === k && l.imgs[0]) || { imgs: ["assets/illustrations/warehouse.jpg"] }).imgs[0];
  $("#cats").innerHTML = Object.entries(CATS).map(([k, c]) => `<a class="cat cat-${k}" href="lots.html?cat=${k}"><div class="cat-photo"><img src="${catPhoto(k)}" alt="" loading="lazy" width="240" height="240"><span class="cat-arrow" aria-hidden="true">↗</span></div><div class="cat-label"><b>${c.name}</b><small>${counts(k)} lot${counts(k) > 1 ? "s" : ""}</small></div></a>`).join("");
  $("#latest").innerHTML = [...LOTS].filter(l => !l.sold).sort((a, b) => b.n - a.n).slice(0, 6).map(tile).join("");
  $("#s-lots").textContent = LOTS.length;
  $("#s-pcs").textContent = num(LOTS.filter(l => !l.sold).reduce((s, l) => s + (l.qty || 0), 0));
}

function catalogue() {
  const P = new URLSearchParams(location.search);
  const st = { cats: new Set(P.get("cat") ? [P.get("cat")] : []), conds: new Set(), locs: new Set(), q: P.get("q") || "", min: "", max: "", sort: "new", page: 1 };
  const condOf = l => l.cond.startsWith("Neuf avec") ? "Neuf avec étiquette" : /reconditionn/i.test(l.cond) ? "Reconditionné" : "Neuf";
  const locs = [...new Set(LOTS.map(l => l.loc))].sort();
  const PER = 8;
  const facet = (name, items, key) => `<div class="fgroup"><h3>${name}</h3>${items.map(([v, label, n]) => `<label class="chk"><input type="checkbox" data-f="${key}" value="${esc(v)}" ${st[key].has(v) ? "checked" : ""}>${label}<span class="n">${n}</span></label>`).join("")}</div>`;
  function side() {
    $("#filters").innerHTML = `<h2>Filtres</h2>
      <div class="fgroup"><h3>Recherche</h3><input id="fq" type="search" placeholder="Mot-clé, référence…" value="${esc(st.q)}"></div>
      ${facet("Catégorie", Object.entries(CATS).map(([k, c]) => [k, c.name, LOTS.filter(l => l.cat === k).length]), "cats")}
      ${facet("État", ["Neuf", "Neuf avec étiquette", "Reconditionné"].map(c => [c, c, LOTS.filter(l => condOf(l) === c).length]), "conds")}
      ${facet("Disponibilité", [["dispo", "Disponibles uniquement", LOTS.filter(l => !l.sold).length]], "locs")}
      <div class="fgroup"><h3>Prix du lot (HT)</h3><div class="row2"><input id="pmin" type="number" min="0" placeholder="Min €" value="${st.min}"><input id="pmax" type="number" min="0" placeholder="Max €" value="${st.max}"></div></div>
      <button class="btn ghost block" id="reset">Réinitialiser les filtres</button>`;
  }
  function filtered() {
    const q = st.q.trim().toLowerCase();
    let r = LOTS.filter(l =>
      (!st.cats.size || st.cats.has(l.cat)) && (!st.conds.size || st.conds.has(condOf(l))) && (!st.locs.size || !l.sold) &&
      (st.min === "" || (l.price && l.price >= +st.min)) && (st.max === "" || (l.price && l.price <= +st.max)) &&
      (!q || (l.t + l.desc + l.ref + CATS[l.cat].name + l.sub).toLowerCase().includes(q)));
    const s = { new: (a, b) => b.n - a.n, pa: (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9), pd: (a, b) => (b.price ?? -1) - (a.price ?? -1), ua: (a, b) => (a.u ?? 1e9) - (b.u ?? 1e9), qd: (a, b) => (b.qty ?? -1) - (a.qty ?? -1) }[st.sort];
    return r.sort(s);
  }
  function chips() {
    const c = [...[...st.cats].map(k => ["cats", k, CATS[k].name]), ...[...st.conds].map(k => ["conds", k, k]), ...[...st.locs].map(k => ["locs", k, "Disponibles uniquement"])];
    if (st.q) c.push(["q", "", `« ${st.q} »`]);
    return c.map(([f, v, t]) => `<span class="chip">${esc(t)}<button data-rm="${f}" data-v="${esc(v)}" aria-label="Retirer">×</button></span>`).join("");
  }
  function draw() {
    const r = filtered(), pages = Math.max(1, Math.ceil(r.length / PER));
    st.page = Math.min(st.page, pages);
    $("#count").innerHTML = `<strong>${r.length} lot${r.length > 1 ? "s" : ""}</strong> <span style="color:var(--muted)">· ${num(r.reduce((s, l) => s + (l.qty || 0), 0))} pièces</span>`;
    $("#chips").innerHTML = chips();
    $("#list").innerHTML = r.length ? r.slice((st.page - 1) * PER, st.page * PER).map(row).join("") : `<div class="empty"><h3>Aucun lot ne correspond</h3><p>Modifiez vos filtres ou <a href="vendre.html">proposez-nous votre stock</a>.</p></div>`;
    $("#pager").innerHTML = pages > 1 ? Array.from({ length: pages }, (_, i) => `<button class="${i + 1 === st.page ? "on" : ""}" data-p="${i + 1}">${i + 1}</button>`).join("") : "";
    const bc = $("#bc-last"); if (bc) bc.textContent = st.cats.size === 1 ? CATS[[...st.cats][0]].name : "Tous les lots";
    $("#ftog").textContent = `Filtres${st.cats.size + st.conds.size + st.locs.size ? " (" + (st.cats.size + st.conds.size + st.locs.size) + ")" : ""}`;
  }
  side(); draw();
  const F = $("#filters");
  F.addEventListener("change", e => { const f = e.target.dataset.f; if (!f) return; e.target.checked ? st[f].add(e.target.value) : st[f].delete(e.target.value); st.page = 1; draw(); });
  F.addEventListener("input", e => { if (e.target.id === "fq") st.q = e.target.value; else if (e.target.id === "pmin") st.min = e.target.value; else if (e.target.id === "pmax") st.max = e.target.value; else return; st.page = 1; draw(); });
  F.addEventListener("click", e => { if (e.target.id === "reset") { Object.assign(st, { cats: new Set(), conds: new Set(), locs: new Set(), q: "", min: "", max: "", page: 1 }); side(); draw(); } });
  $("#sort").onchange = e => { st.sort = e.target.value; st.page = 1; draw(); };
  $("#chips").onclick = e => { const b = e.target.closest("[data-rm]"); if (!b) return; if (b.dataset.rm === "q") st.q = ""; else st[b.dataset.rm].delete(b.dataset.v); side(); draw(); };
  $("#pager").onclick = e => { const b = e.target.closest("[data-p]"); if (b) { st.page = +b.dataset.p; draw(); scrollTo({ top: 0, behavior: "smooth" }); } };
  $("#ftog").onclick = () => F.classList.toggle("open");
}

function detail() {
  const ref = new URLSearchParams(location.search).get("ref");
  const l = LOTS.find(x => x.ref === ref);
  const box = $("#detail");
  if (!l) { box.innerHTML = `<div class="empty" style="grid-column:1/-1"><h2>Lot introuvable</h2><a class="btn primary" href="lots.html">Retour au catalogue</a></div>`; return; }
  document.title = `${l.t} — Compack Destock`;
  $("#bc-cat").innerHTML = `<a href="lots.html?cat=${l.cat}">${CATS[l.cat].name}</a>`; $("#bc-last").textContent = l.ref;
  const save = l.pub && l.u ? Math.round((1 - l.u / l.pub) * 100) : 0;
  box.innerHTML = `
  <div>
    <div class="panel" style="padding:12px">${vis(l, false)}${l.imgs.length > 1 ? `<div class="thumbs">${l.imgs.map((s, k) => `<button type="button" class="th" data-k="${k}" style="border:0;padding:0;background:none;cursor:pointer">${vis(l, false, k)}</button>`).join("")}</div>` : ""}</div>
    <div class="panel" style="margin-top:20px"><h2>Description</h2><p style="margin:0;color:#334155">${esc(l.desc)}${l.ex && l.ex.length ? " " + esc(l.ex.join(" · ")) + "." : ""} Les quantités sont vérifiées avant expédition ; une liste de colisage détaillée est transmise avec le devis.</p></div>
    <div class="panel" style="margin-top:20px"><h2>Caractéristiques</h2><table class="spec">
      <tr><td>Référence</td><td><b>${l.ref}</b></td></tr><tr><td>Catégorie</td><td>${esc(l.sub)}</td></tr>
      <tr><td>Quantité</td><td>${esc(l.note || (num(l.qty) + " pièces"))}</td></tr><tr><td>État</td><td>${esc(l.cond)}</td></tr>
      <tr><td>Localisation</td><td>${esc(l.loc)}</td></tr><tr><td>Livraison</td><td>${esc(l.liv)} (sur devis)</td></tr>
      ${l.pub ? `<tr><td>Valeur publique</td><td>${eur(l.pub)}</td></tr>` : ""}</table></div>
  </div>
  <aside class="panel buy">
    ${badge(l)}${save > 0 ? `<span class="badge dark" style="margin-left:6px">-${save}% vs prix public</span>` : ""}
    <h1>${esc(l.t)}</h1><small style="color:var(--muted)">Réf. ${l.ref}</small>
    <div class="price" style="margin-top:14px;font-size:34px">${priceBlock(l)}</div>
    <div class="qtyrow"><label for="n" style="align-self:center;font-weight:700;font-size:14px">Nb. de lots</label><input id="n" type="number" min="1" max="9" value="1"></div>
    <button class="btn primary lg block" id="add" ${l.sold ? "disabled" : ""}>${l.sold ? "Lot vendu" : l.price ? "Demander ce lot" : "Demander le prix"}</button>
    <a class="btn ghost block" style="margin-top:10px" href="contact.html?ref=${l.ref}">Poser une question</a>
    <ul class="trust"><li>✔ Quantités vérifiées avant expédition</li><li>✔ Prix HT, TVA et transport indiqués sur le devis</li><li>✔ Réponse commerciale sous 24 h ouvrées</li></ul>
  </aside>`;
  document.querySelectorAll(".th").forEach(b => b.onclick = () => { const k = +b.dataset.k, main = $(".detail .panel .vis"); main.querySelector("img").src = l.imgs[k]; });
  $("#add").onclick = () => { addToCart(l.ref, Math.max(1, +$("#n").value || 1)); location.href = "demande.html"; };
  $("#similar").innerHTML = LOTS.filter(x => x.cat === l.cat && x.ref !== l.ref).concat(LOTS.filter(x => x.cat !== l.cat)).filter(x => !x.sold).slice(0, 3).map(tile).join("");
}

function demande() {
  const wrap = $("#cartlist");
  const draw = () => {
    const c = store.get().map(i => ({ ...i, l: LOTS.find(x => x.ref === i.ref) })).filter(i => i.l);
    if (!c.length) { wrap.innerHTML = `<div class="empty" style="padding:28px 0">Votre demande est vide.<br><a class="btn primary" style="margin-top:14px" href="lots.html">Parcourir les lots</a></div>`; $("#sendbtn").disabled = true; return; }
    $("#sendbtn").disabled = false;
    wrap.innerHTML = c.map(i => `<div class="cartitem">${vis(i.l, false)}<div><h4><a href="lot.html?ref=${i.ref}" style="text-decoration:none">${esc(i.l.t)}</a></h4><small>Réf. ${i.ref} · ${i.n} lot${i.n > 1 ? "s" : ""}${i.l.price ? " × " + eur(i.l.price) : ""}</small></div><div style="text-align:right"><b>${i.l.price ? eur(i.l.price * i.n) : "Sur devis"}</b><br><button class="rm" data-rm="${i.ref}">Retirer</button></div></div>`).join("") +
      `<div class="total"><span>Total estimé HT (lots chiffrés)</span><span>${eur(c.reduce((s, i) => s + (i.l.price || 0) * i.n, 0))}</span></div><p style="font-size:12px;color:var(--muted)">Hors transport et TVA — confirmés sur le devis.</p>`;
  };
  wrap.onclick = e => { const b = e.target.closest("[data-rm]"); if (b) { store.set(store.get().filter(i => i.ref !== b.dataset.rm)); bump(); draw(); } };
  $("#devis").onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    const btn = $("#sendbtn"); btn.disabled = true;
    const r = await post("/api/public/destock/requests", { customer: { name: d.nom, company: d.societe, email: d.email, phone: d.tel, siret: d.siret, address: d.adresse }, message: d.message, items: store.get() });
    btn.disabled = false;
    if (r.error) { $("#flash").innerHTML = `<div class="msg err">${esc(r.error)}</div>`; return scrollTo({ top: 0, behavior: "smooth" }); }
    store.set([]); bump(); draw(); e.target.reset();
    $("#flash").innerHTML = `<div class="msg ok"><b>Demande ${r.id} enregistrée.</b> Merci ${esc(d.nom)}, nous revenons vers vous sous 24 h ouvrées avec un devis.</div>`; scrollTo({ top: 0, behavior: "smooth" });
  };
  draw();
}

async function post(url, body) {
  try { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return await r.json(); }
  catch { return { error: "Serveur injoignable, réessayez dans un instant." }; }
}

function simpleForm(id, okMsg) {
  const f = $(id); if (!f) return;
  const ref = new URLSearchParams(location.search).get("ref"); if (ref && f.elements.sujet) f.elements.sujet.value = `Question sur le lot ${ref}`;
  f.onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const r = await post("/api/public/messages", { ...d, site: "destock", type: f.id === "sellform" ? "sell" : "contact" });
    if (r.error) { $("#flash").innerHTML = `<div class="msg err">${esc(r.error)}</div>`; return scrollTo({ top: 0, behavior: "smooth" }); }
    $("#flash").innerHTML = `<div class="msg ok">${okMsg}</div>`; f.reset(); scrollTo({ top: 0, behavior: "smooth" });
  };
}

document.addEventListener("DOMContentLoaded", () => {
  layout();
  const p = document.body.dataset.page;
  ({ home, lots: catalogue, lot: detail, cart: demande }[p] || (() => {}))();
  simpleForm("#contactform", "<b>Message envoyé.</b> Nous vous répondons sous 24 h ouvrées.");
  simpleForm("#sellform", "<b>Proposition reçue.</b> Notre équipe achat vous recontacte rapidement.");
  const hs = $("#hsearch"); if (hs) hs.onsubmit = e => { e.preventDefault(); location.href = "lots.html?q=" + encodeURIComponent(hs.q.value); };
});
