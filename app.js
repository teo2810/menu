(function () {
  const ALLERGENI = {1:"Glutine",2:"Crostacei",3:"Uova",4:"Pesce",5:"Arachidi",6:"Soia",7:"Latte e derivati",8:"Frutta a guscio",9:"Sedano",10:"Senape",11:"Sesamo",12:"Anidride solforosa / solfiti",13:"Lupini",14:"Molluschi",15:"Pomodoro",16:"Lievito / pinoli"};
  const DAYS = [
    { id:"lunedi", short:"LUN", label:"Lunedi" },
    { id:"martedi", short:"MAR", label:"Martedi" },
    { id:"mercoledi", short:"MER", label:"Mercoledi" },
    { id:"giovedi", short:"GIO", label:"Giovedi" },
    { id:"venerdi", short:"VEN", label:"Venerdi" }
  ];
  const JS_DAY_TO_MENU = {1:"lunedi",2:"martedi",3:"mercoledi",4:"giovedi",5:"venerdi"};
  const STORE = "menu-library-v3";
  function meal(){ return {primo:"",primoA:"",secondo:"",secondoA:"",contorno:"",frutta:"",merenda:"",merendaA:""}; }
  function emptyDays(){ const o={}; DAYS.forEach(function(d){ o[d.id]=meal(); }); return o; }
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
    try { const raw = localStorage.getItem(STORE); if (raw) { const data = JSON.parse(raw); if (data && Array.isArray(data.menus)) return data; } } catch (e) {}
    return { menus:[], activeId:null };
  }
  function saveLibrary(){ localStorage.setItem(STORE, JSON.stringify({ menus:state.menus, activeId:state.activeId })); }
  const lib = loadLibrary();
  const state = { menus:lib.menus, activeId:lib.activeId, tab:"oggi", week:0, day:"lunedi", edit:null };
  function currentMenu(){ if (!state.menus.length) return null; return state.menus.find(function(m){ return m.id === state.activeId; }) || state.menus[0]; }
  function escapeHtml(s){ return String(s || "").replace(/[&<>"']/g, function(c){ return ({ "&":"&", "<":"<", ">":">", "\"":""", "'":"&#39;" })[c]; }); }
  function emptyState(msg){ return '<div class="meal-card empty"><h2>Nessun menu</h2><p class="status">' + msg + '</p><button class="btn btn-primary btn-wide" id="goImport">Importa il primo menu</button></div>'; }
  function toast(msg){ const el = document.getElementById("toast"); el.textContent = msg; el.classList.add("show"); setTimeout(function(){ el.classList.remove("show"); }, 2200); }
  function renderHeader(){
    const m = currentMenu();
    const pick = document.getElementById("menuPick");
    if (!state.menus.length) { pick.innerHTML = '<option value="">Aggiungi un menu</option>'; pick.disabled = true; document.getElementById("periodPill").textContent = "Vuoto"; return; }
    pick.disabled = false;
    pick.innerHTML = state.menus.map(function(item){ return '<option value="' + escapeHtml(item.id) + '"' + (item.id===state.activeId ? " selected" : "") + ">" + escapeHtml(item.name) + "</option>"; }).join("");
    document.getElementById("periodPill").textContent = (m && (m.period || m.title)) || "Senza periodo";
  }
  function renderOggi(){
    const box = document.getElementById("screen-oggi");
    if (!currentMenu()) { box.innerHTML = emptyState("Il primo menu che importi apparira qui."); return; }
    box.innerHTML = emptyState("Apri Settimane o Importa.");
  }
  function renderSettimane(){
    document.getElementById("screen-settimane").innerHTML = currentMenu() ? '<div class="note">Menu caricato. Usa Correggi dopo l import.</div>' : emptyState("Aggiungi un menu per sfogliare le settimane.");
  }
  function renderImporta(){
    document.getElementById("screen-importa").innerHTML =
      '<div class="drop"><h3>Nuovo menu</h3><p>Dai un nome, poi fotografa o allega il foglio. Se il riconoscimento sbaglia, correggi il testo.</p>' +
      '<div class="field" style="text-align:left"><label>Nome menu</label><input id="imp-name" placeholder="es. Scuola X · Settembre" /></div>' +
      '<div class="actions"><button class="btn btn-primary" id="btnFoto">Scatta foto</button><button class="btn btn-ghost" id="btnFile">Allega file</button></div>' +
      '<input id="fileCam" type="file" accept="image/*" capture="environment" hidden />' +
      '<input id="fileAny" type="file" accept="image/*,application/pdf" hidden /></div>' +
      '<div id="importWork"></div>' +
      '<button class="btn btn-ghost btn-wide" id="btnBlank">Crea menu vuoto da compilare</button>' +
      '<div class="note">Dopo la foto puoi sempre correggere a mano ogni giorno.</div>';
  }
  function renderInfo(){
    document.getElementById("screen-info").innerHTML = '<h3 style="font-family:Fraunces,serif">I tuoi menu</h3><div class="note">Ancora nessun menu. Vai su Importa.</div>';
  }
  function bindStatic(){
    const go = document.getElementById("goImport"); if (go) go.onclick = function(){ setTab("importa"); };
    const foto = document.getElementById("btnFoto"); const file = document.getElementById("btnFile");
    if (foto) foto.onclick = function(){ document.getElementById("fileCam").click(); };
    if (file) file.onclick = function(){ document.getElementById("fileAny").click(); };
    const cam = document.getElementById("fileCam"); const any = document.getElementById("fileAny");
    if (cam) cam.onchange = function(e){ handleFile(e.target.files[0]); };
    if (any) any.onchange = function(e){ handleFile(e.target.files[0]); };
    const blank = document.getElementById("btnBlank");
    if (blank) blank.onclick = function(){
      const el = document.getElementById("imp-name");
      const name = ((el && el.value.trim()) || prompt("Nome del menu") || "Nuovo menu").trim();
      const created = makeMenu({ name:name });
      state.menus.push(created); state.activeId = created.id; saveLibrary();
      toast("Creato: " + created.name); setTab("settimane"); renderAll();
    };
  }
  function renderAll(){ renderHeader(); renderOggi(); renderSettimane(); renderImporta(); renderInfo(); bindStatic(); }
  const tabList = document.getElementById("tabList");
  function placeBlob(){
    const on = tabList.querySelector("li.on");
    const blob = document.getElementById("tabBlob");
    const stage = document.getElementById("tabStage");
    if (!on || !blob || !stage) return;
    const s = stage.getBoundingClientRect();
    const r = on.getBoundingClientRect();
    const x = (r.left + r.width / 2) - s.left;
    blob.style.left = Math.max(29, Math.min(s.width - 29, x)) + "px";
  }
  function setTab(name){
    state.tab = name;
    document.querySelectorAll(".screen").forEach(function(s){ s.classList.toggle("active", s.id === "screen-" + name); });
    Array.prototype.forEach.call(tabList.children, function(li){ li.classList.toggle("on", li.dataset.tab === name); });
    requestAnimationFrame(placeBlob);
  }
  tabList.querySelectorAll("a").forEach(function(a){
    a.addEventListener("click", function(e){ e.preventDefault(); setTab(a.parentElement.dataset.tab); });
  });
  addEventListener("resize", placeBlob);
  setTimeout(function(){ setTab("oggi"); }, 40);
  document.getElementById("periodPill").addEventListener("click", function(){ setTab("info"); });
  function loadScript(src){ return new Promise(function(res, rej){ const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function(){ rej(new Error("no " + src)); }; document.head.appendChild(s); }); }
  function setStatus(msg, pct){ const bar = document.getElementById("bar"); const st = document.getElementById("ocrStatus"); if (st) st.textContent = msg; if (bar && pct != null) bar.style.width = Math.max(0, Math.min(100, pct)) + "%"; }
  let tessWorker = null;
  async function handleFile(file){
    if (!file) return;
    const work = document.getElementById("importWork");
    work.innerHTML = '<div class="meal-card"><div class="status">Preparazione...</div><div class="preview-wrap" id="preview"></div><div class="progress"><i id="bar"></i></div><div class="status" id="ocrStatus">Attendi</div></div>';
    try {
      let text = "";
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")) {
        setStatus("Leggo PDF...", 10);
        if (!window.pdfjsLib) {
          await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }
        const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        const page = await pdf.getPage(1);
        const content = await page.getTextContent();
        text = content.items.map(function(it){ return it.str; }).join(" ");
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas"); canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;
        document.getElementById("preview").innerHTML = '<img alt="Anteprima" src="' + canvas.toDataURL("image/jpeg", 0.9) + '" />';
        if (text.replace(/\s+/g, "").length < 40) text = await runOcr(canvas.toDataURL("image/jpeg", 0.92));
      } else {
        setStatus("Preparo la foto...", 12);
        const url = URL.createObjectURL(file);
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
    const first = await tessWorker.recognize(url, {}, { text:true, blocks:true });
    let text = (first.data && first.data.text) || "";
    const words = (first.data && first.data.words) || [];
    if (words.length > 8) {
      const lines = {};
      words.forEach(function(w){
        if (!w.text || (w.confidence || 0) < 30) return;
        const y = Math.round((w.bbox && w.bbox.y0 || 0) / 18);
        lines[y] = (lines[y] ? lines[y] + " " : "") + w.text;
      });
      const rebuilt = Object.keys(lines).sort(function(a,b){ return a-b; }).map(function(k){ return lines[k]; }).join("\n");
      if (rebuilt.length > text.length) text = rebuilt;
    }
    if (text.replace(/\s+/g, "").length < 30) {
      await tessWorker.setParameters({ tessedit_pageseg_mode: "11" });
      const second = await tessWorker.recognize(url);
      const t2 = (second.data && second.data.text) || "";
      if (t2.length > text.length) text = t2;
    }
    return text;
  }
  function parseMenuText(text){
    const weeks = [{ name:"Prima settimana", days:emptyDays() },{ name:"Seconda settimana", days:emptyDays() },{ name:"Terza settimana", days:emptyDays() },{ name:"Quarta settimana", days:emptyDays() }];
    let weekIdx = 0, dayId = "lunedi";
    String(text || "").split(/\n+/).forEach(function(line){
      line = line.trim(); if (!line) return;
      const low = line.toLowerCase();
      if (/1\s*[.a°]?\s*settimana|prima settimana/.test(low)) weekIdx = 0;
      if (/2\s*[.a°]?\s*settimana|second/.test(low)) weekIdx = 1;
      if (/3\s*[.a°]?\s*settimana|terza settimana/.test(low)) weekIdx = 2;
      if (/4\s*[.a°]?\s*settimana|quarta settimana/.test(low)) weekIdx = 3;
      if (/luned/.test(low)) dayId = "lunedi";
      if (/marted/.test(low)) dayId = "martedi";
      if (/mercoled/.test(low)) dayId = "mercoledi";
      if (/gioved/.test(low)) dayId = "giovedi";
      if (/venerd/.test(low)) dayId = "venerdi";
      const slot = weeks[weekIdx].days[dayId];
      if (!slot) return;
      const dish = line.replace(/luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|primo|secondo|contorno|frutta|merenda/ig, " ").replace(/\s+/g, " ").trim();
      if (!dish || dish.length < 3) return;
      if (/settimana|allergen|menu/i.test(dish)) return;
      if (/pasta|risotto|pizza|minestr|pastina|primo/.test(low) || !slot.primo) { if (!slot.primo) slot.primo = dish; }
      else if (/pollo|pesce|secondo|frittata|tacchino/.test(low) || !slot.secondo) { if (!slot.secondo) slot.secondo = dish; }
      else if (/contorno|insalat|verdura|patate/.test(low) || !slot.contorno) { if (!slot.contorno) slot.contorno = dish; }
      else if (/frutta|mela|pera/.test(low) || !slot.frutta) { if (!slot.frutta) slot.frutta = dish; }
      else if (!slot.merenda) slot.merenda = dish;
    });
    return weeks;
  }
  function showReview(text){
    window.__parsedWeeks = parseMenuText(text);
    document.getElementById("importWork").innerHTML +=
      '<div class="meal-card"><h2>Testo riconosciuto</h2>' +
      '<p class="status">Correggi il testo (un piatto per riga, con il giorno davanti) e ri-analizza.</p>' +
      '<div class="field"><label>Nome menu</label><input id="imp-title-name" value="' + escapeHtml((document.getElementById("imp-name") && document.getElementById("imp-name").value) || "Nuovo menu") + '" /></div>' +
      '<div class="field"><label>Testo grezzo</label><textarea id="imp-raw">' + escapeHtml(text) + '</textarea></div>' +
      '<button class="btn btn-ghost btn-wide" id="reparse">Ri-analizza</button>' +
      '<button class="btn btn-primary btn-wide" id="applyParse">Salva come nuovo menu</button></div><div id="parsePreview"></div>';
    drawPreview();
    document.getElementById("reparse").onclick = function(){ window.__parsedWeeks = parseMenuText(document.getElementById("imp-raw").value); drawPreview(); toast("Struttura aggiornata"); };
    document.getElementById("applyParse").onclick = function(){
      const name = (document.getElementById("imp-title-name").value || "Nuovo menu").trim();
      const created = makeMenu({ name:name, weeks:window.__parsedWeeks });
      state.menus.push(created); state.activeId = created.id; saveLibrary();
      toast("Nuovo menu: " + name); setTab("settimane"); renderAll();
    };
  }
  function drawPreview(){
    const el = document.getElementById("parsePreview"); if (!el || !window.__parsedWeeks) return;
    el.innerHTML = window.__parsedWeeks.map(function(w){
      return '<div class="meal-card"><h2>' + w.name + '</h2>' + DAYS.map(function(d){
        const m = w.days[d.id]; return '<p><b>' + d.label + '</b> — ' + escapeHtml(m.primo || "...") + ' / ' + escapeHtml(m.secondo || "...") + '</p>';
      }).join("") + '</div>';
    }).join("");
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(function(){});
  renderAll();
})();
