(function () {
  var ALLERGENI = {1:"Glutine",2:"Crostacei",3:"Uova",4:"Pesce",5:"Arachidi",6:"Soia",7:"Latte e derivati",8:"Frutta a guscio",9:"Sedano",10:"Senape",11:"Sesamo",12:"Anidride solforosa / solfiti",13:"Lupini",14:"Molluschi",15:"Pomodoro",16:"Lievito / pinoli"};
  var DAYS = [
    { id:"lunedi", short:"LUN", label:"Lunedi" },
    { id:"martedi", short:"MAR", label:"Martedi" },
    { id:"mercoledi", short:"MER", label:"Mercoledi" },
    { id:"giovedi", short:"GIO", label:"Giovedi" },
    { id:"venerdi", short:"VEN", label:"Venerdi" }
  ];
  var JS_DAY_TO_MENU = {1:"lunedi",2:"martedi",3:"mercoledi",4:"giovedi",5:"venerdi"};
  var STORE = "menu-library-v3";
  var ICO = {
    primo:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 11h16v2H4v-2zm2 4h12v6H6v-6zM7 4h2v6H7V4zm4 0h2v6h-2V4zm4 0h2v6h-2V4z"/></svg>',
    secondo:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3c4 0 8 3 8 8 0 5-8 10-8 10S4 16 4 11c0-5 4-8 8-8zm0 3a5 5 0 00-5 5c0 2.6 3.2 5.6 5 7.1 1.8-1.5 5-4.5 5-7.1a5 5 0 00-5-5z"/></svg>',
    contorno:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 4c4.4 0 8 2.2 8 5s-3.6 5-8 5-8-2.2-8-5 3.6-5 8-5zm-7 9.4C6.7 15 9.2 16 12 16s5.3-1 7-2.6V20H5v-6.6z"/></svg>',
    frutta:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 7c2.8 1.2 4 3.8 4 6.5C20 17.5 16.4 21 12 21S4 17.5 4 13.5C4 9.6 7 7 10.5 7c.8 0 1.5.1 2.2.4C13.2 5.6 14.4 4 16.5 3 16.2 4.6 16.1 5.8 16 7z"/></svg>',
    merenda:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 8h14l-1.2 11.2A2 2 0 0115.8 21H8.2a2 2 0 01-2-1.8L5 8zm3-3h8l1 3H7l1-3z"/></svg>'
  };
  function meal(){ return {primo:"",primoA:"",secondo:"",secondoA:"",contorno:"",frutta:"",merenda:"",merendaA:""}; }
  function emptyDays(){ var o={}; DAYS.forEach(function(d){ o[d.id]=meal(); }); return o; }
  function makeMenu(p){
    p = p || {};
    return { id: p.id || ("menu-" + Date.now()), name: p.name || "Nuovo menu", title: p.title || "", period: p.period || "", notes: p.notes || [], weeks: p.weeks || [
      { name:"Prima settimana", days:emptyDays() },
      { name:"Seconda settimana", days:emptyDays() },
      { name:"Terza settimana", days:emptyDays() },
      { name:"Quarta settimana", days:emptyDays() }
    ]};
  }
  function loadLibrary(){
    try { var raw = localStorage.getItem(STORE); if (raw) { var data = JSON.parse(raw); if (data && Array.isArray(data.menus)) return data; } } catch (e) {}
    return { menus:[], activeId:null };
  }
  function saveLibrary(){ localStorage.setItem(STORE, JSON.stringify({ menus:state.menus, activeId:state.activeId })); }
  var lib = loadLibrary();
  var state = { menus:lib.menus, activeId:lib.activeId, tab:"oggi", week:0, day:"lunedi", edit:null };
  function currentMenu(){ if (!state.menus.length) return null; return state.menus.find(function(m){ return m.id === state.activeId; }) || state.menus[0]; }
  function escapeHtml(s){
    return String(s || "").replace(/&/g,"&").replace(/</g,"<").replace(/>/g,">").replace(/"/g,""").replace(/'/g,"&#39;");
  }
  function codes(str){ if (!str) return []; return String(str).split(/[^0-9]+/).map(Number).filter(function(n){ return n && ALLERGENI[n]; }); }
  function tagsHtml(str){ return codes(str).map(function(n){ return '<span class="tag">' + n + " " + ALLERGENI[n] + "</span>"; }).join(""); }
  function toast(msg){ var el = document.getElementById("toast"); if (!el) return; el.textContent = msg; el.classList.add("show"); setTimeout(function(){ el.classList.remove("show"); }, 2200); }
  function emptyState(msg){ return '<div class="meal-card empty"><h2>Nessun menu</h2><p class="status">' + msg + '</p><button class="btn btn-primary btn-wide" id="goImport">Importa il primo menu</button></div>'; }
  function course(kind, label, dish, all){
    if (!dish) return "";
    return '<div class="course"><div class="ico svg-' + kind + '">' + ICO[kind] + '</div><div><div class="label">' + label + '</div><div class="dish">' + escapeHtml(dish) + '</div><div class="tags">' + tagsHtml(all) + "</div></div></div>";
  }
  function todayInfo(){
    var now = new Date();
    return { now:now, dayId: JS_DAY_TO_MENU[now.getDay()] || null, week: Math.min(3, Math.floor((now.getDate() - 1) / 7)), weekend: !JS_DAY_TO_MENU[now.getDay()] };
  }
  function renderHeader(){
    var m = currentMenu();
    var pick = document.getElementById("menuPick");
    if (!pick) return;
    if (!state.menus.length) { pick.innerHTML = '<option value="">Aggiungi un menu</option>'; pick.disabled = true; document.getElementById("periodPill").textContent = "Vuoto"; return; }
    pick.disabled = false;
    pick.innerHTML = state.menus.map(function(item){ return '<option value="' + escapeHtml(item.id) + '"' + (item.id===state.activeId ? " selected" : "") + ">" + escapeHtml(item.name) + "</option>"; }).join("");
    document.getElementById("periodPill").textContent = m.period || m.title || "Senza periodo";
  }
  function renderMealCard(weekIdx, dayId, withEdit){
    var m = currentMenu();
    if (!m) return emptyState("Importa una foto o un file per partire.");
    var week = m.weeks[weekIdx];
    if (!week) return '<div class="meal-card"><p>Nessuna settimana.</p></div>';
    var d = week.days[dayId];
    var dayLabel = DAYS.find(function(x){ return x.id === dayId; }).label;
    if (!d) return '<div class="meal-card"><p>Nessun pasto.</p></div>';
    var edit = withEdit ? ' <button class="edit-btn" data-edit="' + weekIdx + ":" + dayId + '">Correggi</button>' : "";
    var body = course("primo","Primo",d.primo,d.primoA) + course("secondo","Secondo",d.secondo,d.secondoA) + course("contorno","Contorno",d.contorno,"") + course("frutta","Frutta",d.frutta,"") + course("merenda","Merenda",d.merenda,d.merendaA);
    return '<article class="meal-card"><h2>' + dayLabel + edit + "</h2>" + (body || '<p class="status">Giorno vuoto. Tocca Correggi per compilare.</p>') + "</article>";
  }
  function renderOggi(){
    var m = currentMenu();
    var box = document.getElementById("screen-oggi");
    if (!m) { box.innerHTML = emptyState("Il primo menu che importi apparira qui."); return; }
    var t = todayInfo();
    var nice = t.now.toLocaleDateString("it-IT", { weekday:"long", day:"numeric", month:"long" });
    var weekName = (m.weeks[t.week] && m.weeks[t.week].name) || "";
    var body = t.weekend ? '<div class="meal-card"><p>Oggi non c e mensa. Apri Settimane per vedere i giorni.</p></div>' : renderMealCard(t.week, t.dayId, true);
    box.innerHTML = '<div class="hero-today"><div class="kicker">' + escapeHtml(m.name) + "</div><h2>" + nice + "</h2><p>" + escapeHtml(m.title || weekName) + " · " + escapeHtml(m.period || "") + "</p></div>" + body;
  }
  function renderSettimane(){
    var m = currentMenu();
    var box = document.getElementById("screen-settimane");
    if (!m) { box.innerHTML = emptyState("Aggiungi un menu per sfogliare le settimane."); return; }
    var tabs = m.weeks.map(function(w,i){ return '<button class="week-tab' + (i===state.week?" on":"") + '" data-week="' + i + '">' + escapeHtml(w.name.replace(" settimana","")) + "</button>"; }).join("");
    var chips = DAYS.map(function(d){ return '<button class="day-chip' + (d.id===state.day?" on":"") + '" data-day="' + d.id + '"><small>' + d.short + "</small><b>" + d.label.slice(0,3) + "</b></button>"; }).join("");
    box.innerHTML = '<div class="week-tabs">' + tabs + '</div><div class="day-rail">' + chips + "</div>" + renderMealCard(state.week, state.day, true);
  }
  function renderImporta(){
    document.getElementById("screen-importa").innerHTML =
      '<div class="drop"><h3>Nuovo menu</h3><p>Dai un nome, poi fotografa o allega il foglio.</p>' +
      '<div class="field" style="text-align:left"><label>Nome menu</label><input id="imp-name" placeholder="es. Scuola X · Settembre" /></div>' +
      '<div class="actions"><button class="btn btn-primary" id="btnFoto">Scatta foto</button><button class="btn btn-ghost" id="btnFile">Allega file</button></div>' +
      '<input id="fileCam" type="file" accept="image/*" capture="environment" hidden />' +
      '<input id="fileAny" type="file" accept="image/*,application/pdf" hidden /></div>' +
      '<div id="importWork"></div>' +
      '<button class="btn btn-ghost btn-wide" id="btnBlank">Crea menu vuoto da compilare</button>' +
      '<div class="note">Il riconoscimento puo sbagliare. Controlla sempre prima di salvare.</div>';
  }
  function renderInfo(){
    var list = state.menus.length
      ? state.menus.map(function(item){
          return '<div class="allergen-row" style="justify-content:space-between"><div><b>' + escapeHtml(item.name) + '</b><div class="status">' + escapeHtml(item.period || "") + '</div></div><div style="display:flex;gap:6px"><button class="edit-btn" data-use="' + item.id + '">' + (item.id===state.activeId?"Attivo":"Apri") + '</button><button class="edit-btn" data-ren="' + item.id + '">Nome</button>' + (state.menus.length>1 ? '<button class="edit-btn" data-del="' + item.id + '">Elimina</button>' : "") + "</div></div>";
        }).join("")
      : '<div class="note">Ancora nessun menu. Vai su Importa.</div>';
    document.getElementById("screen-info").innerHTML =
      '<h3 style="font-family:Fraunces,serif;margin:8px 0">I tuoi menu</h3><div class="allergen-list">' + list + "</div>" +
      "<h3 style=\"font-family:Fraunces,serif\">Allergeni</h3><div class=\"allergen-list\">" + Object.keys(ALLERGENI).map(function(n){ return '<div class="allergen-row"><div class="allergen-num">' + n + "</div><div><b>" + ALLERGENI[n] + "</b></div></div>"; }).join("") + "</div>";
  }
  function bindStatic(){
    document.querySelectorAll("[data-edit]").forEach(function(btn){ btn.onclick = function(){ openEdit(btn.dataset.edit); }; });
    document.querySelectorAll("[data-week]").forEach(function(btn){ btn.onclick = function(){ state.week = +btn.dataset.week; renderSettimane(); bindStatic(); }; });
    document.querySelectorAll("[data-day]").forEach(function(btn){ btn.onclick = function(){ state.day = btn.dataset.day; renderSettimane(); bindStatic(); }; });
    document.querySelectorAll("[data-use]").forEach(function(btn){ btn.onclick = function(){ state.activeId = btn.dataset.use; saveLibrary(); toast("Menu attivo"); renderAll(); }; });
    document.querySelectorAll("[data-ren]").forEach(function(btn){ btn.onclick = function(){ var item = state.menus.find(function(x){ return x.id === btn.dataset.ren; }); var name = prompt("Nome del menu", item.name); if (!name) return; item.name = name.trim(); saveLibrary(); renderAll(); }; });
    document.querySelectorAll("[data-del]").forEach(function(btn){ btn.onclick = function(){ if (!confirm("Eliminare questo menu?")) return; state.menus = state.menus.filter(function(x){ return x.id !== btn.dataset.del; }); state.activeId = state.menus[0] ? state.menus[0].id : null; saveLibrary(); toast("Menu eliminato"); renderAll(); }; });
    var go = document.getElementById("goImport"); if (go) go.onclick = function(){ goTab("importa"); };
    var foto = document.getElementById("btnFoto"); var file = document.getElementById("btnFile");
    if (foto) foto.onclick = function(){ document.getElementById("fileCam").click(); };
    if (file) file.onclick = function(){ document.getElementById("fileAny").click(); };
    var cam = document.getElementById("fileCam"); var any = document.getElementById("fileAny");
    if (cam) cam.onchange = function(e){ handleFile(e.target.files[0]); };
    if (any) any.onchange = function(e){ handleFile(e.target.files[0]); };
    var blank = document.getElementById("btnBlank");
    if (blank) blank.onclick = function(){
      var el = document.getElementById("imp-name");
      var name = ((el && el.value.trim()) || prompt("Nome del menu") || "Nuovo menu").trim();
      var created = makeMenu({ name:name });
      state.menus.push(created); state.activeId = created.id; saveLibrary();
      toast("Creato: " + created.name); goTab("settimane"); renderAll();
    };
    var pick = document.getElementById("menuPick");
    if (pick) pick.onchange = function(){ if (!pick.value) return; state.activeId = pick.value; saveLibrary(); renderAll(); };
  }
  function renderAll(){ renderHeader(); renderOggi(); renderSettimane(); renderImporta(); renderInfo(); bindStatic(); }
  function openEdit(key){
    var m = currentMenu(); if (!m) return;
    var parts = key.split(":"); var w = +parts[0], d = parts[1];
    var mealObj = m.weeks[w].days[d];
    state.edit = { w:w, d:d };
    document.getElementById("editMeta").textContent = m.name + " · " + m.weeks[w].name + " · " + DAYS.find(function(x){ return x.id === d; }).label;
    ["primo","primoA","secondo","secondoA","contorno","frutta","merenda","merendaA"].forEach(function(k){ document.getElementById("f-" + k).value = mealObj[k] || ""; });
    document.getElementById("editModal").classList.add("open");
  }
  document.getElementById("closeEdit").onclick = function(){ document.getElementById("editModal").classList.remove("open"); };
  document.getElementById("saveEdit").onclick = function(){
    if (!state.edit || !currentMenu()) return;
    var mealObj = currentMenu().weeks[state.edit.w].days[state.edit.d];
    ["primo","primoA","secondo","secondoA","contorno","frutta","merenda","merendaA"].forEach(function(k){ mealObj[k] = document.getElementById("f-" + k).value.trim(); });
    saveLibrary(); document.getElementById("editModal").classList.remove("open"); toast("Giorno aggiornato"); renderAll();
  };
  function goTab(name){
    state.tab = name;
    if (typeof window.setTab === "function") window.setTab(name);
    else {
      document.querySelectorAll(".screen").forEach(function(s){ s.classList.toggle("active", s.id === "screen-" + name); });
      var tabList = document.getElementById("tabList");
      Array.prototype.forEach.call(tabList.children, function(li){ li.classList.toggle("on", li.dataset.tab === name); });
    }
  }
  document.getElementById("periodPill").addEventListener("click", function(){ goTab("info"); });
  function loadScript(src){ return new Promise(function(res, rej){ var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function(){ rej(new Error("no script")); }; document.head.appendChild(s); }); }
  function setStatus(msg, pct){ var bar = document.getElementById("bar"); var st = document.getElementById("ocrStatus"); if (st) st.textContent = msg; if (bar && pct != null) bar.style.width = Math.max(0, Math.min(100, pct)) + "%"; }
  var tessWorker = null;
  async function handleFile(file){
    if (!file) return;
    var work = document.getElementById("importWork");
    work.innerHTML = '<div class="meal-card"><div class="status">Preparazione file...</div><div class="preview-wrap" id="preview"></div><div class="progress"><i id="bar"></i></div><div class="status" id="ocrStatus">Attendi</div></div>';
    try {
      var text = "";
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")) {
        setStatus("Leggo il PDF...", 8);
        if (!window.pdfjsLib) {
          await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }
        var pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        var page = await pdf.getPage(1);
        var content = await page.getTextContent();
        text = content.items.map(function(it){ return it.str; }).join(" ");
        var viewport = page.getViewport({ scale: 2.2 });
        var canvas = document.createElement("canvas"); canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;
        document.getElementById("preview").innerHTML = '<img alt="Anteprima" src="' + canvas.toDataURL("image/jpeg", 0.9) + '" />';
        if (text.replace(/\s+/g, "").length < 50) text = await runOcr(canvas.toDataURL("image/jpeg", 0.92));
      } else {
        setStatus("Preparo la foto...", 10);
        var url = URL.createObjectURL(file);
        document.getElementById("preview").innerHTML = '<img alt="Anteprima" src="' + url + '" />';
        text = await runOcr(url);
      }
      showReview(text);
    } catch (err) { setStatus("Errore: " + err.message); showReview(""); }
  }
  async function runOcr(url){
    setStatus("Carico il riconoscimento...", 15);
    if (!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    if (!tessWorker) {
      tessWorker = await Tesseract.createWorker("ita", 1, {
        logger: function(m){ if (m.status === "recognizing text") setStatus("Riconoscimento... " + Math.round((m.progress || 0) * 100) + "%", 20 + (m.progress || 0) * 70); }
      });
    }
    await tessWorker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1", user_defined_dpi: "300" });
    var first = await tessWorker.recognize(url, {}, { text:true, blocks:true });
    var text = (first.data && first.data.text) || "";
    var words = (first.data && first.data.words) || [];
    if (words.length > 8) {
      var lines = {};
      words.forEach(function(w){
        if (!w.text || (w.confidence || 0) < 30) return;
        var y = Math.round(((w.bbox && w.bbox.y0) || 0) / 18);
        lines[y] = (lines[y] ? lines[y] + " " : "") + w.text;
      });
      var rebuilt = Object.keys(lines).sort(function(a,b){ return a-b; }).map(function(k){ return lines[k]; }).join("\n");
      if (rebuilt.length > text.length) text = rebuilt;
    }
    if (text.replace(/\s+/g, "").length < 30) {
      await tessWorker.setParameters({ tessedit_pageseg_mode: "11" });
      var second = await tessWorker.recognize(url);
      var t2 = (second.data && second.data.text) || "";
      if (t2.length > text.length) text = t2;
    }
    return text;
  }
  function parseMenuText(text){
    var weeks = [{ name:"Prima settimana", days:emptyDays() },{ name:"Seconda settimana", days:emptyDays() },{ name:"Terza settimana", days:emptyDays() },{ name:"Quarta settimana", days:emptyDays() }];
    var weekIdx = 0, dayId = "lunedi";
    String(text || "").split(/\n+/).forEach(function(line){
      line = line.trim(); if (!line) return;
      var low = line.toLowerCase();
      if (/prima settimana|1\s*[.a°]?\s*settimana/.test(low)) weekIdx = 0;
      if (/second[ao] settimana|2\s*[.a°]?\s*settimana/.test(low)) weekIdx = 1;
      if (/terza settimana|3\s*[.a°]?\s*settimana/.test(low)) weekIdx = 2;
      if (/quarta settimana|4\s*[.a°]?\s*settimana/.test(low)) weekIdx = 3;
      if (/luned/.test(low)) dayId = "lunedi";
      if (/marted/.test(low)) dayId = "martedi";
      if (/mercoled/.test(low)) dayId = "mercoledi";
      if (/gioved/.test(low)) dayId = "giovedi";
      if (/venerd/.test(low)) dayId = "venerdi";
      var slot = weeks[weekIdx].days[dayId]; if (!slot) return;
      var dish = line.replace(/luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|primo|secondo|contorno|frutta|merenda/ig, " ").replace(/\s+/g, " ").trim();
      if (!dish || dish.length < 3) return;
      if (/settimana|allergen|menu/i.test(dish)) return;
      if (/pasta|risotto|pizza|minestr|pastina|primo/.test(low) && !slot.primo) slot.primo = dish;
      else if (/pollo|pesce|secondo|frittata|tacchino/.test(low) && !slot.secondo) slot.secondo = dish;
      else if (/contorno|insalat|verdura|patate/.test(low) && !slot.contorno) slot.contorno = dish;
      else if (/frutta|mela|pera/.test(low) && !slot.frutta) slot.frutta = dish;
      else if (!slot.primo) slot.primo = dish;
      else if (!slot.secondo) slot.secondo = dish;
      else if (!slot.contorno) slot.contorno = dish;
      else if (!slot.frutta) slot.frutta = dish;
      else if (!slot.merenda) slot.merenda = dish;
    });
    return weeks;
  }
  function showReview(text){
    window.__parsedWeeks = parseMenuText(text);
    document.getElementById("importWork").innerHTML +=
      '<div class="meal-card"><h2>Testo riconosciuto</h2><p class="status">Correggi il testo (un piatto per riga, con il giorno davanti) e ri-analizza.</p>' +
      '<div class="field"><label>Nome menu</label><input id="imp-title-name" value="' + escapeHtml((document.getElementById("imp-name") && document.getElementById("imp-name").value) || "Nuovo menu") + '" /></div>' +
      '<div class="field"><label>Testo grezzo</label><textarea id="imp-raw">' + escapeHtml(text) + "</textarea></div>" +
      '<button class="btn btn-ghost btn-wide" id="reparse">Ri-analizza</button>' +
      '<button class="btn btn-primary btn-wide" id="applyParse">Salva come nuovo menu</button></div><div id="parsePreview"></div>';
    drawPreview();
    document.getElementById("reparse").onclick = function(){ window.__parsedWeeks = parseMenuText(document.getElementById("imp-raw").value); drawPreview(); toast("Struttura aggiornata"); };
    document.getElementById("applyParse").onclick = function(){
      var name = (document.getElementById("imp-title-name").value || "Nuovo menu").trim();
      var created = makeMenu({ name:name, weeks:window.__parsedWeeks });
      state.menus.push(created); state.activeId = created.id; saveLibrary();
      toast("Nuovo menu: " + name); goTab("settimane"); renderAll();
    };
  }
  function drawPreview(){
    var el = document.getElementById("parsePreview"); if (!el || !window.__parsedWeeks) return;
    el.innerHTML = window.__parsedWeeks.map(function(w){
      return '<div class="meal-card"><h2>' + w.name + "</h2>" + DAYS.map(function(d){
        var mealObj = w.days[d.id];
        return "<p><b>" + d.label + "</b> — " + escapeHtml(mealObj.primo || "...") + " / " + escapeHtml(mealObj.secondo || "...") + "</p>";
      }).join("") + "</div>";
    }).join("");
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(function(){});
  renderAll();
})();
