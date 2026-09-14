(function () {
  const ALLERGENI = {1:"Glutine",2:"Crostacei",3:"Uova",4:"Pesce",5:"Arachidi",6:"Soia",7:"Latte e derivati",8:"Frutta a guscio",9:"Sedano",10:"Senape",11:"Sesamo",12:"Anidride solforosa / solfiti",13:"Lupini",14:"Molluschi",15:"Pomodoro",16:"Lievito / pinoli"};
  const DAYS = [
    { id:"lunedi", short:"LUN", label:"Lunedì" },
    { id:"martedi", short:"MAR", label:"Martedì" },
    { id:"mercoledi", short:"MER", label:"Mercoledì" },
    { id:"giovedi", short:"GIO", label:"Giovedì" },
    { id:"venerdi", short:"VEN", label:"Venerdì" }
  ];
  const JS_DAY_TO_MENU = {1:"lunedi",2:"martedi",3:"mercoledi",4:"giovedi",5:"venerdi"};
  const STORE = "menu-library-v3";
  const ICO = {
    primo:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 11h16v2H4v-2zm2 4h12v6H6v-6zM7 4h2v6H7V4zm4 0h2v6h-2V4zm4 0h2v6h-2V4z"/></svg>',
    secondo:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3c4 0 8 3 8 8 0 5-8 10-8 10S4 16 4 11c0-5 4-8 8-8zm0 3a5 5 0 00-5 5c0 2.6 3.2 5.6 5 7.1 1.8-1.5 5-4.5 5-7.1a5 5 0 00-5-5z"/></svg>',
    contorno:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 4c4.4 0 8 2.2 8 5s-3.6 5-8 5-8-2.2-8-5 3.6-5 8-5zm-7 9.4C6.7 15 9.2 16 12 16s5.3-1 7-2.6V20H5v-6.6z"/></svg>',
    frutta:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 7c2.8 1.2 4 3.8 4 6.5C20 17.5 16.4 21 12 21S4 17.5 4 13.5C4 9.6 7 7 10.5 7c.8 0 1.5.1 2.2.4C13.2 5.6 14.4 4 16.5 3 16.2 4.6 16.1 5.8 16 7z"/></svg>',
    merenda:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 8h14l-1.2 11.2A2 2 0 0115.8 21H8.2a2 2 0 01-2-1.8L5 8zm3-3h8l1 3H7l1-3z"/></svg>'
  };

  function meal(a,b,c,d,e,f,g,h){ return {primo:a||"",primoA:b||"",secondo:c||"",secondoA:d||"",contorno:e||"",frutta:f||"",merenda:g||"",merendaA:h||""}; }
  function emptyDays(){ const o={}; DAYS.forEach(d => o[d.id]=meal()); return o; }
  function makeMenu(p){
    p = p || {};
    return {
      id: p.id || ("menu-" + Date.now()),
      name: p.name || "Nuovo menu",
      title: p.title || "",
      period: p.period || "",
      notes: p.notes || [],
      weeks: p.weeks || [
        { name:"Prima settimana", days:emptyDays() },
        { name:"Seconda settimana", days:emptyDays() },
        { name:"Terza settimana", days:emptyDays() },
        { name:"Quarta settimana", days:emptyDays() }
      ]
    };
  }
  function loadLibrary(){
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.menus)) return data;
      }
    } catch (e) {}
    return { menus:[], activeId:null };
  }
  function saveLibrary(){
    localStorage.setItem(STORE, JSON.stringify({ menus:state.menus, activeId:state.activeId }));
  }
  const lib = loadLibrary();
  const state = { menus:lib.menus, activeId:lib.activeId, tab:"oggi", week:0, day:"lunedi", edit:null };

  function currentMenu(){
    if (!state.menus.length) return null;
    return state.menus.find(m => m.id === state.activeId) || state.menus[0];
  }
  function codes(str){
    if (!str) return [];
    return String(str).split(/[^0-9]+/).map(Number).filter(n => n && ALLERGENI[n]);
  }
  function escapeHtml(s){
    return String(s || "").replace(/[&<>"']/g, function(c){
      return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c];
    });
  }
  function tagsHtml(str){
    return codes(str).map(n => '<span class="tag">' + n + " " + ALLERGENI[n] + "</span>").join("");
  }
  function todayInfo(){
    const now = new Date();
    const dayId = JS_DAY_TO_MENU[now.getDay()] || null;
    const week = Math.min(3, Math.floor((now.getDate() - 1) / 7));
    return { now:now, dayId:dayId, week:week, weekend:!dayId };
  }
  function course(kind, label, dish, all){
    if (!dish) return "";
    return '<div class="course"><div class="ico">' + ICO[kind] + '</div><div><div class="label">' + label + '</div><div class="dish">' + escapeHtml(dish) + '</div><div class="tags">' + tagsHtml(all) + "</div></div></div>";
  }
  function emptyState(msg){
    return '<div class="meal-card empty"><h2>Nessun menu</h2><p class="status">' + msg + '</p><button class="btn btn-primary btn-wide" id="goImport">Importa il primo menu</button></div>';
  }
  function toast(msg){
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(function(){ el.classList.remove("show"); }, 2200);
  }

  function renderHeader(){
    const m = currentMenu();
    const pick = document.getElementById("menuPick");
    if (!state.menus.length) {
      pick.innerHTML = '<option value="">Aggiungi un menu</option>';
      pick.disabled = true;
      document.getElementById("periodPill").textContent = "Vuoto";
      return;
    }
    pick.disabled = false;
    pick.innerHTML = state.menus.map(function(item){
      return '<option value="' + escapeHtml(item.id) + '"' + (item.id===state.activeId ? " selected" : "") + ">" + escapeHtml(item.name) + "</option>";
    }).join("");
    document.getElementById("periodPill").textContent = m.period || m.title || "Senza periodo";
  }

  function renderMealCard(weekIdx, dayId, withEdit){
    const m = currentMenu();
    if (!m) return emptyState("Importa una foto o un file per partire.");
    const week = m.weeks[weekIdx];
    if (!week) return '<div class="meal-card"><p>Nessuna settimana.</p></div>';
    const d = week.days[dayId];
    const dayLabel = DAYS.find(x => x.id === dayId).label;
    if (!d) return '<div class="meal-card"><p>Nessun pasto per questo giorno.</p></div>';
    const edit = withEdit ? ' <button class="edit-btn" data-edit="' + weekIdx + ":" + dayId + '">Correggi</button>' : "";
    const body = course("primo","Primo",d.primo,d.primoA) + course("secondo","Secondo",d.secondo,d.secondoA) + course("contorno","Contorno",d.contorno,"") + course("frutta","Frutta",d.frutta,"") + course("merenda","Merenda",d.merenda,d.merendaA);
    return '<article class="meal-card"><h2>' + dayLabel + edit + "</h2>" + (body || '<p class="status">Giorno vuoto. Tocca Correggi per compilare.</p>') + "</article>";
  }

  function renderOggi(){
    const m = currentMenu();
    const box = document.getElementById("screen-oggi");
    if (!m) { box.innerHTML = emptyState("Il primo menu che importi apparira qui."); return; }
    const t = todayInfo();
    const nice = t.now.toLocaleDateString("it-IT", { weekday:"long", day:"numeric", month:"long" });
    const weekName = (m.weeks[t.week] && m.weeks[t.week].name) || "";
    const body = t.weekend
      ? '<div class="meal-card"><p>Oggi non c\'e mensa. Apri Settimane per vedere i giorni.</p></div>'
      : renderMealCard(t.week, t.dayId, true);
    const notes = (m.notes||[]).map(function(n){ return '<div class="note">' + escapeHtml(n) + "</div>"; }).join("");
    box.innerHTML = '<div class="hero-today"><div class="kicker">' + escapeHtml(m.name) + "</div><h2>" + nice + "</h2><p>" + escapeHtml(m.title || weekName) + " · " + escapeHtml(m.period || "") + "</p></div>" + body + notes;
  }

  function renderSettimane(){
    const m = currentMenu();
    const box = document.getElementById("screen-settimane");
    if (!m) { box.innerHTML = emptyState("Aggiungi un menu per sfogliare le settimane."); return; }
    const tabs = m.weeks.map(function(w,i){
      return '<button class="week-tab' + (i===state.week?" on":"") + '" data-week="' + i + '">' + escapeHtml(w.name.replace(" settimana","")) + "</button>";
    }).join("");
    const chips = DAYS.map(function(d){
      return '<button class="day-chip' + (d.id===state.day?" on":"") + '" data-day="' + d.id + '"><small>' + d.short + "</small><b>" + d.label.slice(0,3) + "</b></button>";
    }).join("");
    box.innerHTML = '<div class="week-tabs">' + tabs + '</div><div class="day-rail">' + chips + "</div>" + renderMealCard(state.week, state.day, true);
  }

  function renderImporta(){
    document.getElementById("screen-importa").innerHTML =
      '<div class="drop">' +
      '<svg viewBox="0 0 24 24" width="36" height="36" fill="#e85d4c"><path d="M9 3l2-2h2l2 2h4v18H5V3h4zm3 5a5 5 0 100 10 5 5 0 000-10z"/></svg>' +
      "<h3>Nuovo menu</h3>" +
      "<p>Dai un nome (scuola, stagione o tipo), poi fotografa o allega il foglio.</p>" +
      '<div class="field" style="text-align:left"><label>Nome menu</label><input id="imp-name" placeholder="es. Scuola X · Settembre" /></div>' +
      '<div class="actions"><button class="btn btn-primary" id="btnFoto">Scatta foto</button><button class="btn btn-ghost" id="btnFile">Allega file</button></div>' +
      '<input id="fileCam" type="file" accept="image/*" capture="environment" hidden />' +
      '<input id="fileAny" type="file" accept="image/*,application/pdf" hidden />' +
      "</div><div id=\"importWork\"></div>" +
      '<button class="btn btn-ghost btn-wide" id="btnBlank">Crea menu vuoto da compilare</button>' +
      '<div class="note">Il riconoscimento puo sbagliare. Controlla sempre prima di salvare.</div>';
  }

  function renderInfo(){
    const m = currentMenu();
    const list = state.menus.length
      ? state.menus.map(function(item){
          return '<div class="allergen-row" style="justify-content:space-between"><div><b>' + escapeHtml(item.name) + '</b><div class="status">' + escapeHtml(item.period || item.title || "") + '</div></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="edit-btn" data-use="' + item.id + '">' + (item.id===state.activeId?"Attivo":"Apri") + '</button><button class="edit-btn" data-ren="' + item.id + '">Nome</button>' + (state.menus.length>1 ? '<button class="edit-btn" data-del="' + item.id + '">Elimina</button>' : "") + "</div></div>";
        }).join("")
      : '<div class="note">Ancora nessun menu. Vai su Importa.</div>';
    document.getElementById("screen-info").innerHTML =
      '<h3 style="font-family:Fraunces,serif;margin:8px 0">I tuoi menu</h3>' +
      '<p class="status">Ogni voce e un menu a se. Cambia anche dal nome in alto.</p>' +
      '<div class="allergen-list">' + list + "</div>" +
      (m ? '<div class="meal-card" style="margin-top:14px"><h2>Menu attivo</h2><p class="dish">' + escapeHtml(m.name) + '</p><p class="status">' + escapeHtml(m.title || "") + " " + escapeHtml(m.period || "") + "</p></div>" : "") +
      '<h3 style="font-family:Fraunces,serif">Allergeni</h3>' +
      '<div class="allergen-list">' + Object.keys(ALLERGENI).map(function(n){
        return '<div class="allergen-row"><div class="allergen-num">' + n + "</div><div><b>" + ALLERGENI[n] + "</b></div></div>";
      }).join("") + "</div>";
  }

  function bindStatic(){
    document.querySelectorAll("[data-edit]").forEach(function(btn){ btn.onclick = function(){ openEdit(btn.dataset.edit); }; });
    document.querySelectorAll("[data-week]").forEach(function(btn){ btn.onclick = function(){ state.week = +btn.dataset.week; renderSettimane(); bindStatic(); }; });
    document.querySelectorAll("[data-day]").forEach(function(btn){ btn.onclick = function(){ state.day = btn.dataset.day; renderSettimane(); bindStatic(); }; });
    document.querySelectorAll("[data-use]").forEach(function(btn){ btn.onclick = function(){ state.activeId = btn.dataset.use; saveLibrary(); toast("Menu attivo: " + currentMenu().name); renderAll(); }; });
    document.querySelectorAll("[data-ren]").forEach(function(btn){ btn.onclick = function(){
      const item = state.menus.find(function(x){ return x.id === btn.dataset.ren; });
      const name = prompt("Nome del menu", item.name);
      if (!name) return;
      item.name = name.trim(); saveLibrary(); renderAll();
    }; });
    document.querySelectorAll("[data-del]").forEach(function(btn){ btn.onclick = function(){
      if (!confirm("Eliminare questo menu?")) return;
      state.menus = state.menus.filter(function(x){ return x.id !== btn.dataset.del; });
      state.activeId = state.menus[0] ? state.menus[0].id : null;
      saveLibrary(); toast("Menu eliminato"); renderAll();
    }; });
    const go = document.getElementById("goImport");
    if (go) go.onclick = function(){ setTab("importa"); };
    const foto = document.getElementById("btnFoto");
    const file = document.getElementById("btnFile");
    if (foto) foto.onclick = function(){ document.getElementById("fileCam").click(); };
    if (file) file.onclick = function(){ document.getElementById("fileAny").click(); };
    const cam = document.getElementById("fileCam");
    const any = document.getElementById("fileAny");
    if (cam) cam.onchange = function(e){ handleFile(e.target.files[0]); };
    if (any) any.onchange = function(e){ handleFile(e.target.files[0]); };
    const blank = document.getElementById("btnBlank");
    if (blank) blank.onclick = function(){
      const el = document.getElementById("imp-name");
      const name = ((el && el.value.trim()) || prompt("Nome del menu") || "Nuovo menu").trim();
      const created = makeMenu({ name:name });
      state.menus.push(created);
      state.activeId = created.id;
      saveLibrary();
      toast("Creato: " + created.name);
      setTab("settimane");
      renderAll();
    };
    const pick = document.getElementById("menuPick");
    if (pick) pick.onchange = function(){
      if (!pick.value) return;
      state.activeId = pick.value;
      saveLibrary();
      toast(currentMenu().name);
      renderAll();
    };
  }

  function renderAll(){
    renderHeader(); renderOggi(); renderSettimane(); renderImporta(); renderInfo(); bindStatic();
  }

  function openEdit(key){
    const m = currentMenu();
    if (!m) return;
    const parts = key.split(":");
    const w = +parts[0], d = parts[1];
    const mealObj = m.weeks[w].days[d];
    state.edit = { w:w, d:d };
    document.getElementById("editMeta").textContent = m.name + " · " + m.weeks[w].name + " · " + DAYS.find(x => x.id === d).label;
    ["primo","primoA","secondo","secondoA","contorno","frutta","merenda","merendaA"].forEach(function(k){
      document.getElementById("f-" + k).value = mealObj[k] || "";
    });
    document.getElementById("editModal").classList.add("open");
  }

  document.getElementById("closeEdit").onclick = function(){ document.getElementById("editModal").classList.remove("open"); };
  document.getElementById("saveEdit").onclick = function(){
    if (!state.edit || !currentMenu()) return;
    const mealObj = currentMenu().weeks[state.edit.w].days[state.edit.d];
    ["primo","primoA","secondo","secondoA","contorno","frutta","merenda","merendaA"].forEach(function(k){
      mealObj[k] = document.getElementById("f-" + k).value.trim();
    });
    saveLibrary();
    document.getElementById("editModal").classList.remove("open");
    toast("Giorno aggiornato");
    renderAll();
  };

  const tabList = document.getElementById("tabList");
  function setTab(name){
    state.tab = name;
    document.querySelectorAll(".screen").forEach(function(s){ s.classList.toggle("active", s.id === "screen-" + name); });
    Array.prototype.forEach.call(tabList.children, function(li){ li.classList.toggle("on", li.dataset.tab === name); });
    const on = tabList.querySelector("li.on");
    if (!on) return;
    const rect = tabList.getBoundingClientRect();
    const r = on.getBoundingClientRect();
    tabList.style.setProperty("--x", (((r.left + r.width / 2) - rect.left) / rect.width * 100) + "%");
  }
  tabList.querySelectorAll("a").forEach(function(a){
    a.addEventListener("click", function(e){ e.preventDefault(); setTab(a.parentElement.dataset.tab); });
  });
  addEventListener("resize", function(){ setTab(state.tab); });
  setTimeout(function(){ setTab("oggi"); }, 40);
  document.getElementById("periodPill").addEventListener("click", function(){ setTab("info"); });

  let tessWorker = null;
  function loadScript(src){
    return new Promise(function(res, rej){
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = function(){ rej(new Error("Impossibile caricare " + src)); };
      document.head.appendChild(s);
    });
  }
  async function handleFile(file){
    if (!file) return;
    const work = document.getElementById("importWork");
    work.innerHTML = '<div class="meal-card"><div class="status">Preparazione file...</div><div class="preview-wrap" id="preview"></div><div class="progress"><i id="bar"></i></div><div class="status" id="ocrStatus">Attendi</div></div>';
    try {
      const imageUrl = file.type === "application/pdf" ? await pdfFirstPage(file) : URL.createObjectURL(file);
      document.getElementById("preview").innerHTML = '<img alt="Anteprima menu" src="' + imageUrl + '" />';
      showReview(await runOcr(imageUrl));
    } catch (err) {
      document.getElementById("ocrStatus").textContent = "Errore: " + err.message;
      showReview("");
    }
  }
  async function pdfFirstPage(file){
    if (!window.pdfjsLib) {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;
    return canvas.toDataURL("image/jpeg", 0.85);
  }
  async function runOcr(url){
    document.getElementById("ocrStatus").textContent = "Carico il riconoscimento...";
    if (!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    if (!tessWorker) {
      tessWorker = await Tesseract.createWorker("ita", 1, {
        logger: function(m){
          const bar = document.getElementById("bar");
          const st = document.getElementById("ocrStatus");
          if (!bar || !st) return;
          if (m.status === "recognizing text") {
            bar.style.width = Math.round((m.progress || 0) * 100) + "%";
            st.textContent = "Riconoscimento... " + Math.round((m.progress || 0) * 100) + "%";
          } else st.textContent = m.status || "Elaborazione";
        }
      });
    }
    return (await tessWorker.recognize(url)).data.text || "";
  }
  function cleanLine(s){
    return s.replace(/\s+/g, " ").replace(/\b\d{1,2}([-–]\d{1,2})+\b/g, "").trim();
  }
  function parseMenuText(text){
    const weeks = [
      { name:"Prima settimana", days:emptyDays() },
      { name:"Seconda settimana", days:emptyDays() },
      { name:"Terza settimana", days:emptyDays() },
      { name:"Quarta settimana", days:emptyDays() }
    ];
    let weekIdx = 0, dayId = "lunedi";
    const dayMap = { lunedi:"lunedi", "lunedi":"lunedi", martedi:"martedi", mercoledi:"mercoledi", giovedi:"giovedi", venerdi:"venerdi" };
    String(text || "").split(/\n+/).map(function(l){ return l.trim(); }).filter(Boolean).forEach(function(line){
      const low = line.toLowerCase();
      if (/prima settimana/.test(low)) weekIdx = 0;
      if (/second[ao] settimana/.test(low)) weekIdx = 1;
      if (/terza settimana/.test(low)) weekIdx = 2;
      if (/quarta settimana/.test(low)) weekIdx = 3;
      ["lunedi","lunedì","martedi","martedì","mercoledi","mercoledì","giovedi","giovedì","venerdi","venerdì"].forEach(function(k){
        const key = k.replace("ì","i");
        if (low === k || low.startsWith(k + " ")) dayId = key;
      });
      const slot = weeks[weekIdx].days[dayId];
      if (!slot) return;
      if (/merenda/.test(low)) slot.merenda = cleanLine(line.replace(/merenda:?/i, ""));
      else if (!slot.primo) slot.primo = cleanLine(line);
      else if (!slot.secondo) slot.secondo = cleanLine(line);
      else if (!slot.contorno) slot.contorno = cleanLine(line);
      else if (!slot.frutta) slot.frutta = cleanLine(line);
    });
    return weeks;
  }
  function proposedName(){
    const el = document.getElementById("imp-name");
    return (el && el.value.trim()) || "Nuovo menu";
  }
  function guessPeriod(text){
    const m = String(text||"").match(/dal\s*(\d{1,2}\/\d{1,2})\s*al\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
    return m ? m[1] + " – " + m[2] : "";
  }
  function drawParsePreview(weeks){
    const el = document.getElementById("parsePreview");
    if (!el) return;
    el.innerHTML = weeks.map(function(w){
      return '<div class="meal-card"><h2>' + w.name + "</h2>" + DAYS.map(function(d){
        const mealObj = w.days[d.id];
        return "<p><b>" + d.label + "</b> — " + escapeHtml(mealObj.primo || "...") + " / " + escapeHtml(mealObj.secondo || "...") + "</p>";
      }).join("") + "</div>";
    }).join("");
  }
  function showReview(text){
    window.__parsedWeeks = parseMenuText(text);
    document.getElementById("importWork").innerHTML +=
      '<div class="meal-card"><h2>Testo riconosciuto</h2>' +
      '<p class="status">Correggi se il riconoscimento ha sbagliato, poi salva come nuovo menu.</p>' +
      '<div class="field"><label>Nome menu</label><input id="imp-title-name" value="' + escapeHtml(proposedName()) + '" /></div>' +
      '<div class="field"><label>Periodo / stagione</label><input id="imp-period" value="' + escapeHtml(guessPeriod(text)) + '" /></div>' +
      '<div class="field"><label>Testo grezzo</label><textarea id="imp-raw">' + escapeHtml(text) + "</textarea></div>" +
      '<button class="btn btn-ghost btn-wide" id="reparse">Ri-analizza il testo corretto</button>' +
      '<button class="btn btn-primary btn-wide" id="applyParse">Salva come nuovo menu</button>' +
      (currentMenu() ? '<button class="btn btn-ghost btn-wide" id="replaceParse">Sostituisci il menu attivo</button>' : "") +
      '</div><div id="parsePreview"></div>';
    drawParsePreview(window.__parsedWeeks);
    document.getElementById("reparse").onclick = function(){
      window.__parsedWeeks = parseMenuText(document.getElementById("imp-raw").value);
      drawParsePreview(window.__parsedWeeks);
      toast("Struttura aggiornata dal testo");
    };
    document.getElementById("applyParse").onclick = function(){ saveParsed(false); };
    const rp = document.getElementById("replaceParse");
    if (rp) rp.onclick = function(){ saveParsed(true); };
  }
  function saveParsed(replace){
    const name = (document.getElementById("imp-title-name").value || proposedName()).trim();
    const period = document.getElementById("imp-period").value.trim();
    if (replace && currentMenu()) {
      const m = currentMenu();
      m.name = name; m.period = period; m.weeks = window.__parsedWeeks;
    } else {
      const created = makeMenu({ name:name, period:period, weeks:window.__parsedWeeks });
      state.menus.push(created);
      state.activeId = created.id;
    }
    saveLibrary();
    toast(replace ? "Menu aggiornato" : "Nuovo menu: " + name);
    setTab("settimane");
    renderAll();
  }

  let touchX = null;
  document.getElementById("screen-settimane").addEventListener("touchstart", function(e){ touchX = e.changedTouches[0].clientX; }, { passive:true });
  document.getElementById("screen-settimane").addEventListener("touchend", function(e){
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    const idx = DAYS.findIndex(function(d){ return d.id === state.day; });
    if (dx < -50 && idx < DAYS.length - 1) { state.day = DAYS[idx + 1].id; renderSettimane(); bindStatic(); }
    if (dx > 50 && idx > 0) { state.day = DAYS[idx - 1].id; renderSettimane(); bindStatic(); }
  }, { passive:true });

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(function(){});
  renderAll();
})();
