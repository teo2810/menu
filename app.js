(function () {
  var DAYS = [
    { id:"lunedi", short:"LUN", label:"Lunedi" },
    { id:"martedi", short:"MAR", label:"Martedi" },
    { id:"mercoledi", short:"MER", label:"Mercoledi" },
    { id:"giovedi", short:"GIO", label:"Giovedi" },
    { id:"venerdi", short:"VEN", label:"Venerdi" }
  ];
  var STORE = "menu-library-v3";
  var GEMINI_STORE = "menu-gemini-key-v1";
  function getGeminiKey(){
    try { return (localStorage.getItem(GEMINI_STORE) || "").trim(); } catch (e) { return ""; }
  }
  function meal(){ return {primo:"",primoA:"",secondo:"",secondoA:"",contorno:"",contornoA:"",frutta:"",fruttaA:"",merenda:"",merendaA:""}; }
  function aKeyOf(course){ return course + "A"; }
  function emptyDays(){ var o={}; DAYS.forEach(function(d){ o[d.id]=meal(); }); return o; }
  function makeMenu(p){
    p = p || {};
    return { id: p.id || ("menu-" + Date.now()), name: p.name || "Nuovo menu", period: p.period || "", weeks: p.weeks || [
      { name:"Prima settimana", days:emptyDays() },
      { name:"Seconda settimana", days:emptyDays() },
      { name:"Terza settimana", days:emptyDays() },
      { name:"Quarta settimana", days:emptyDays() }
    ]};
  }
  function loadLibrary(){
    try { var raw = localStorage.getItem(STORE); if (raw) { var data = JSON.parse(raw); if (data && data.menus) return data; } } catch (e) {}
    return { menus:[], activeId:null };
  }
  var lib = loadLibrary();
  var state = { menus:lib.menus, activeId:lib.activeId, week:0, day:"lunedi", edit:null };
  function saveLibrary(){ localStorage.setItem(STORE, JSON.stringify({ menus:state.menus, activeId:state.activeId })); }
  function currentMenu(){ return state.menus.find(function(m){ return m.id === state.activeId; }) || state.menus[0] || null; }
  function esc(s){
    return String(s || "").replace(/&/g,"&"+"amp;").replace(/</g,"&"+"lt;").replace(/>/g,"&"+"gt;").replace(/"/g,"&"+"quot;");
  }
  function toast(msg){ var el = document.getElementById("toast"); if (!el) return; el.textContent = msg; el.classList.add("show"); setTimeout(function(){ el.classList.remove("show"); }, 2200); }
  function goTab(name){ if (window.setTab) window.setTab(name); }
  function openModal(id){ var el = document.getElementById(id); if (el) el.classList.add("open"); }
  function closeModal(id){ var el = document.getElementById(id); if (el) el.classList.remove("open"); }
  var askCb = null;
  function ask(title, text, okLabel, cb){
    document.getElementById("askTitle").textContent = title;
    document.getElementById("askText").textContent = text;
    document.getElementById("askOk").textContent = okLabel || "Ok";
    askCb = cb;
    openModal("askModal");
  }
  function renderPickList(){
    var box = document.getElementById("pickList");
    if (!box) return;
    if (!state.menus.length) { box.innerHTML = "<p class=status>Nessun menu salvato.</p>"; return; }
    box.innerHTML = state.menus.map(function(item){
      var on = item.id === state.activeId ? " on" : "";
      return "<button type=button class='pick-row"+on+"' data-pick="+JSON.stringify(item.id)+"><span>"+esc(item.name)+"</span><span class=pick-dot></span></button>";
    }).join("");
    box.querySelectorAll("[data-pick]").forEach(function(b){
      b.onclick = function(){
        state.activeId = b.getAttribute("data-pick");
        saveLibrary();
        closeModal("pickModal");
        renderAll();
      };
    });
  }

  var ICONS = {
    primo:   '<img src="icons/primo.png" alt="" width="36" height="36">',
    secondo: '<img src="icons/secondo.png" alt="" width="36" height="36">',
    contorno:'<img src="icons/contorno.png" alt="" width="36" height="36">',
    frutta:  '<img src="icons/frutta.png" alt="" width="36" height="36">',
    merenda: '<img src="icons/merenda.png" alt="" width="36" height="36">'
  };
  var ALLERGENS = {
    1:"Glutine", 2:"Crostacei", 3:"Uova", 4:"Pesce", 5:"Arachidi",
    6:"Soia", 7:"Latte", 8:"Frutta a guscio", 9:"Sedano", 10:"Senape",
    11:"Sesamo", 12:"Solfiti", 13:"Lupini", 14:"Molluschi"
  };
  function parseCodes(raw){
    var seen = {};
    return String(raw || "").split(/[^0-9]+/).map(function(n){ return +n; }).filter(function(n){
      if (n < 1 || n > 14 || seen[n]) return false;
      seen[n] = 1;
      return true;
    });
  }
  function allergenBox(codes){
    var list = parseCodes(codes);
    if (!list.length) return "<div class='course-extra'><p class=status>Nessun allergene.</p></div>";
    return "<div class='course-extra'><div class=label>Allergeni</div><div class=tags>" + list.map(function(n){
      return "<span class=tag>" + n + " · " + esc(ALLERGENS[n] || "") + "</span>";
    }).join("") + "</div></div>";
  }
  function allergenChipsHtml(field, selected){
    var on = {};
    parseCodes(selected).forEach(function(n){ on[n]=1; });
    return '<div class="alg-chips" data-alg="'+field+'">'+Object.keys(ALLERGENS).map(function(n){
      return '<button type=button class="alg-chip'+(on[n]?" on":"")+'" data-n="'+n+'">'+n+" "+esc(ALLERGENS[n])+"</button>";
    }).join("")+"</div>";
  }
  function codesFromChips(wrap){
    if (!wrap) return "";
    return Array.prototype.map.call(wrap.querySelectorAll(".alg-chip.on"), function(b){ return b.getAttribute("data-n"); }).join(",");
  }
  function wireAlgChips(root){
    if (!root) return;
    root.querySelectorAll(".alg-chip").forEach(function(b){
      b.onclick = function(){
        b.classList.toggle("on");
        var wrap = b.parentNode;
        var field = wrap && wrap.getAttribute("data-alg");
        if (!field) return;
        var codes = codesFromChips(wrap);
        if (state.edit && currentMenu() && currentMenu().weeks[state.edit.w]) {
          currentMenu().weeks[state.edit.w].days[state.edit.d][field] = codes;
        }
        if (cellBarKey) {
          var p = cellBarKey.split(":");
          var menu = currentMenu();
          if (menu && menu.weeks[p[0]] && menu.weeks[p[0]].days[p[1]]) {
            menu.weeks[p[0]].days[p[1]][field] = codes;
          }
        }
      };
    });
  }

  function isoWeekNumber(d){
    var date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  }

  function renderHeader(){
    var pick = document.getElementById("menuPick");
    if (!pick) return;
    var m = currentMenu();
    if (!state.menus.length) {
      pick.textContent = "Aggiungi un menu";
      document.getElementById("periodPill").textContent = "Vuoto";
      return;
    }
    pick.textContent = m ? m.name : "Scegli menu";
    document.getElementById("periodPill").textContent = (m && (m.period || m.name)) || "Senza periodo";
  }
  function mealHtml(d, weekIdx, dayId){
    var rows = [
      ["primo","Primo",d.primo,d.primoA],
      ["secondo","Secondo",d.secondo,d.secondoA],
      ["contorno","Contorno",d.contorno,d.contornoA||""],
      ["frutta","Frutta",d.frutta,d.fruttaA||""],
      ["merenda","Merenda",d.merenda,d.merendaA]
    ].filter(function(x){ return x[2]; });
    var body = rows.length ? rows.map(function(x){
      return "<div class=course data-course="+x[0]+"><div class='ico svg-"+x[0]+"'>"+ICONS[x[0]]+"</div><div class=course-body><div class=label>"+x[1]+"</div><div class=dish>"+esc(x[2])+"</div><div class=hint>Tocca per gli allergeni</div></div>"+allergenBox(x[3])+"</div>";
    }).join("") : "<p class=status>Giorno vuoto. Tocca Correggi.</p>";
    return "<article class=meal-card><h2>"+DAYS.find(function(x){return x.id===dayId;}).label+" <button class=edit-btn data-edit="+weekIdx+":"+dayId+">Correggi</button></h2>"+body+"</article>";
  }
  function renderOggi(){
    var box = document.getElementById("screen-oggi");
    var m = currentMenu();
    if (!m) return;
    var now = new Date();
    var map = {1:"lunedi",2:"martedi",3:"mercoledi",4:"giovedi",5:"venerdi"};
    var dayId = map[now.getDay()];
    var week = (isoWeekNumber(now) - 1) % 4;
    var nice = now.toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"});
    box.innerHTML = "<div class=hero-today><div class=kicker>"+esc(m.name)+"</div><h2>"+nice+"</h2></div>"+(dayId?mealHtml(m.weeks[week].days[dayId],week,dayId):"<div class=meal-card><p>Oggi non c e mensa.</p></div>");
  }
  function renderSettimane(){
    var box = document.getElementById("screen-settimane");
    var m = currentMenu();
    if (!m) { box.innerHTML = "<div class=meal-card empty><h2>Nessun menu</h2><button class='btn btn-primary btn-wide' id=goImport>Importa il primo menu</button></div>"; return; }
    var tabs = m.weeks.map(function(w,i){ return "<button class='week-tab"+(i===state.week?" on":"")+"' data-week="+i+">"+esc(w.name.replace(" settimana",""))+"</button>"; }).join("");
    var chips = DAYS.map(function(d){ return "<button class='day-chip"+(d.id===state.day?" on":"")+"' data-day="+d.id+"><small>"+d.short+"</small><b>"+d.label.slice(0,3)+"</b></button>"; }).join("");
    var emptyWeek = !DAYS.some(function(d){
      var mealObj = m.weeks[state.week].days[d.id];
      return mealObj && (mealObj.primo || mealObj.secondo || mealObj.contorno || mealObj.frutta || mealObj.merenda);
    });
    var hint = emptyWeek
      ? '<div class="note">Menu vuoto: tocca una cella per scrivere, oppure torna a Importa per un JSON o una foto. Per cambiare menu usa il nome in alto.</div><button class="btn btn-ghost btn-wide" id="backImport">Torna a Importa</button>'
      : '<p class="status">Tocca una cella: si apre la riga sopra la tastiera.</p>';
    box.innerHTML = "<div class=week-tabs>"+tabs+"</div><div class=day-rail>"+chips+"</div>"+mealHtml(m.weeks[state.week].days[state.day],state.week,state.day)+
      '<div class="meal-card"><h2>Tabella settimana</h2>'+hint+weekGridHtml(m.weeks[state.week], state.week, true)+"</div>";
  }
  function wireImport(){
    var foto = document.getElementById("btnFoto");
    var file = document.getElementById("btnFile");
    var cam = document.getElementById("fileCam");
    var any = document.getElementById("fileAny");
    if (foto && cam) foto.onclick = function(){ cam.click(); };
    if (file && any) file.onclick = function(){ any.click(); };
    if (cam) cam.onchange = function(e){ handleFile(e.target.files[0]); };
    if (any) any.onchange = function(e){ handleFile(e.target.files[0]); };
    var blank = document.getElementById("btnBlank");
    if (blank) blank.onclick = function(){
      var el = document.getElementById("imp-name");
      var name = ((el && el.value.trim()) || "Menu vuoto").trim();
      var created = makeMenu({ name:name });
      state.menus.push(created); state.activeId = created.id; saveLibrary();
      toast("Apri la tabella e tocca le celle"); goTab("settimane"); renderAll();
    };
    var jsonBtn = document.getElementById("btnJsonFile");
    var jsonFile = document.getElementById("fileJson");
    if (jsonBtn && jsonFile) jsonBtn.onclick = function(){ jsonFile.click(); };
    if (jsonFile) jsonFile.onchange = function(e){ handleJsonFile(e.target.files[0]); };
    var jsonApply = document.getElementById("applyJsonPaste");
    if (jsonApply) jsonApply.onclick = function(){ applyJsonText(document.getElementById("jsonPaste").value); };
    var copyBtn = document.getElementById("copyPrompt");
    if (copyBtn) copyBtn.onclick = function(){ copyPromptText(); };
    var saveKey = document.getElementById("saveGeminiKey");
    if (saveKey) saveKey.onclick = function(){
      var inp = document.getElementById("geminiKey");
      var val = inp ? inp.value.trim() : "";
      try {
        if (val) localStorage.setItem(GEMINI_STORE, val);
        else localStorage.removeItem(GEMINI_STORE);
      } catch (e) {}
      toast(val ? "Chiave salvata su questo telefono" : "Chiave tolta");
      renderImporta();
      wireImport();
    };
  }
  var TINTS = [
    { id:"rosa", name:"Rosa", swatch:"#F6D4E0", theme:"#F6D4E0" },
    { id:"cielo", name:"Cielo", swatch:"#A9C4E4", theme:"#D4E4F6" },
    { id:"menta", name:"Menta", swatch:"#B5E4C8", theme:"#D4F0E4" },
    { id:"limone", name:"Limone", swatch:"#F0E6A8", theme:"#F6F0D4" },
    { id:"pesca", name:"Pesca", swatch:"#F0C8A8", theme:"#F6E0D4" },
    { id:"corallo", name:"Corallo", swatch:"#F0A8B4", theme:"#F6D4DC" }
  ];
  function currentTintId(){
    var id = "rosa";
    try { id = localStorage.getItem("menu-tint-v1") || "rosa"; } catch (e) {}
    for (var i=0;i<TINTS.length;i++) if (TINTS[i].id === id) return id;
    return "rosa";
  }
  function applyTint(id){
    var pack = null;
    for (var i=0;i<TINTS.length;i++) if (TINTS[i].id === id) pack = TINTS[i];
    if (!pack) pack = TINTS[0];
    document.documentElement.setAttribute("data-tint", pack.id);
    try { localStorage.setItem("menu-tint-v1", pack.id); } catch (e) {}
    if (window.paintStatusBar) window.paintStatusBar(pack.theme);
    var blob = document.getElementById("tabBlob");
    if (blob) blob.style.background = "var(--grad)";
    var lab = document.getElementById("tintName");
    if (lab) lab.textContent = pack.name;
    document.querySelectorAll("[data-tint-pick]").forEach(function(b){
      b.classList.toggle("on", b.getAttribute("data-tint-pick") === pack.id);
    });
  }
  function tintCardHtml(){
    var cur = currentTintId();
    var name = "Rosa";
    var dots = TINTS.map(function(t){
      if (t.id === cur) name = t.name;
      return "<button type=button class='tint-dot"+(t.id===cur?" on":"")+"' data-tint-pick="+t.id+" style='background:"+t.swatch+"' aria-label='"+t.name+"'></button>";
    }).join("");
    return "<div class='meal-card tint-card'><div class=tint-head><b>Tinta</b><span class=status id=tintName>"+name+"</span></div><div class=tint-rail>"+dots+"</div></div>";
  }
  function renderInfo(){
    var box = document.getElementById("screen-info");
    var list = state.menus.length
      ? "<h3 style='font-family:Fraunces,serif'>I tuoi menu</h3>"+state.menus.map(function(item){
          return "<div class='allergen-row menu-row'><b>"+esc(item.name)+"</b><span><button class=edit-btn data-use="+item.id+">Apri</button> <button class='edit-btn btn-del' data-del="+item.id+">Elimina</button></span></div>";
        }).join("")
      : "<div class=note>Ancora nessun menu. Vai su Importa.</div>";
    box.innerHTML = tintCardHtml() + list;
  }
  function bind(){
    document.querySelectorAll(".course").forEach(function(el){
      el.onclick = function(e){
        if (e.target.closest(".edit-btn")) return;
        el.classList.toggle("open");
      };
    });
    document.querySelectorAll("[data-edit]").forEach(function(b){ b.onclick = function(){ openEdit(b.getAttribute("data-edit")); }; });
    document.querySelectorAll("[data-week]").forEach(function(b){ b.onclick = function(){ state.week=+b.getAttribute("data-week"); renderSettimane(); bind(); }; });
    document.querySelectorAll("[data-day]").forEach(function(b){ b.onclick = function(){ state.day=b.getAttribute("data-day"); renderSettimane(); bind(); }; });
    var backImp = document.getElementById("backImport");
    if (backImp) backImp.onclick = function(){ goTab("importa"); };
    document.querySelectorAll("[data-cell]").forEach(function(btn){
      btn.onclick = function(){ openCellBar(btn.getAttribute("data-cell")); };
    });
    document.querySelectorAll("[data-tint-pick]").forEach(function(b){
      b.onclick = function(){ applyTint(b.getAttribute("data-tint-pick")); };
    });
    document.querySelectorAll("[data-use]").forEach(function(b){ b.onclick = function(){ state.activeId=b.getAttribute("data-use"); saveLibrary(); renderAll(); }; });
    document.querySelectorAll("[data-del]").forEach(function(b){
      b.onclick = function(){
        var id = b.getAttribute("data-del");
        ask("Eliminare questo menu?", "Verra rimosso solo da questo telefono.", "Elimina", function(){
          state.menus = state.menus.filter(function(x){ return x.id !== id; });
          state.activeId = state.menus[0] && state.menus[0].id;
          saveLibrary();
          renderAll();
        });
      };
    });
    var pick = document.getElementById("menuPick");
    if (pick) pick.onclick = function(){
      if (!state.menus.length) { goTab("importa"); return; }
      renderPickList();
      openModal("pickModal");
    };
    var closePick = document.getElementById("closePick");
    if (closePick) closePick.onclick = function(){ closeModal("pickModal"); };
    var pickModal = document.getElementById("pickModal");
    if (pickModal) pickModal.onclick = function(e){ if (e.target === pickModal) closeModal("pickModal"); };
    var askNo = document.getElementById("askNo");
    var askOk = document.getElementById("askOk");
    var askModal = document.getElementById("askModal");
    if (askNo) askNo.onclick = function(){ closeModal("askModal"); askCb = null; };
    if (askOk) askOk.onclick = function(){ var fn = askCb; askCb = null; closeModal("askModal"); if (fn) fn(); };
    if (askModal) askModal.onclick = function(e){ if (e.target === askModal) { closeModal("askModal"); askCb = null; } };
    wireImport();
  }
  function renderAll(){ renderHeader(); renderOggi(); renderSettimane(); renderImporta(); renderInfo(); bind(); }
  function openEdit(key){
    var m = currentMenu(); if(!m) return;
    var p = key.split(":"); var w=+p[0], d=p[1];
    var mealObj = m.weeks[w].days[d];
    state.edit = {w:w,d:d};
    var day = DAYS.find(function(x){ return x.id===d; });
    document.getElementById("editMeta").textContent = (day?day.label:d) + " · " + m.weeks[w].name;
    var courses = [["primo","Primo"],["secondo","Secondo"],["contorno","Contorno"],["frutta","Frutta"],["merenda","Merenda"]];
    document.getElementById("editBody").innerHTML = courses.map(function(c){
      return '<div class="edit-course"><label>'+c[1]+'</label><input id="f-'+c[0]+'" value="'+esc(mealObj[c[0]]||"")+'" placeholder="Piatto">' +
        '<div class="label">Allergeni</div>'+allergenChipsHtml(c[0]+"A", mealObj[c[0]+"A"]||"")+"</div>";
    }).join("");
    wireAlgChips(document.getElementById("editBody"));
    document.getElementById("editModal").classList.add("open");
  }
  document.getElementById("closeEdit").onclick = function(){ document.getElementById("editModal").classList.remove("open"); state.edit=null; };
  document.getElementById("saveEdit").onclick = function(){
    if(!state.edit||!currentMenu()) return;
    var mealObj = currentMenu().weeks[state.edit.w].days[state.edit.d];
    ["primo","secondo","contorno","frutta","merenda"].forEach(function(k){
      var el = document.getElementById("f-"+k);
      mealObj[k] = el ? el.value.trim() : "";
    });
    document.querySelectorAll("#editBody [data-alg]").forEach(function(wrap){
      mealObj[wrap.getAttribute("data-alg")] = codesFromChips(wrap);
    });
    saveLibrary(); document.getElementById("editModal").classList.remove("open"); state.edit=null; toast("Giorno aggiornato"); renderAll();
  };
  document.getElementById("periodPill").onclick = function(){ goTab("info"); };
  var cellBarKey = null;
  function closeCellBar(){
    var bar = document.getElementById("cellBar");
    if (bar) bar.classList.remove("open");
    cellBarKey = null;
  }
  function placeCellBar(){
    var bar = document.getElementById("cellBar");
    if (!bar || !bar.classList.contains("open")) return;
    var vv = window.visualViewport;
    var kb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    bar.style.bottom = kb + "px";
  }
  function openCellBar(key){
    cellBarKey = key;
    var p = String(key||"").split(":");
    var labels = { primo:"Primo", secondo:"Secondo", contorno:"Contorno", frutta:"Frutta", merenda:"Merenda" };
    var day = DAYS.find(function(d){ return d.id===p[1]; });
    var val = "";
    var menu = currentMenu();
    if (menu && menu.weeks[p[0]] && menu.weeks[p[0]].days[p[1]]) val = menu.weeks[p[0]].days[p[1]][p[2]] || "";
    if (!val && window.__importNorm && window.__importNorm.weeks[p[0]]) val = window.__importNorm.weeks[p[0]].days[p[1]][p[2]] || "";
    document.getElementById("cellBarMeta").textContent = (day ? day.label : p[1]) + " · " + (labels[p[2]] || p[2]);
    var inp = document.getElementById("cellBarInput");
    inp.value = val;
    var algBox = document.getElementById("cellBarAlg");
    var aField = aKeyOf(p[2]);
    var aVal = "";
    if (menu && menu.weeks[p[0]] && menu.weeks[p[0]].days[p[1]]) aVal = menu.weeks[p[0]].days[p[1]][aField] || "";
    algBox.innerHTML = '<div class="label">Allergeni</div>'+allergenChipsHtml(aField, aVal);
    wireAlgChips(algBox);
    document.getElementById("cellBar").classList.add("open");
    placeCellBar();
    setTimeout(function(){ inp.focus(); }, 40);
  }
  function applyCellValue(key, val, persist){
    var p = String(key||"").split(":");
    var menu = currentMenu();
    if (menu && menu.weeks[p[0]] && menu.weeks[p[0]].days[p[1]]) {
      menu.weeks[p[0]].days[p[1]][p[2]] = val;
      if (persist) saveLibrary();
    }
    if (window.__importNorm && window.__importNorm.weeks[p[0]]) {
      window.__importNorm.weeks[p[0]].days[p[1]][p[2]] = val;
    }
    var cellBtn = document.querySelector("[data-cell=\""+p[0]+":"+p[1]+":"+p[2]+"\"]");
    if (cellBtn) {
      cellBtn.textContent = val || "…";
      if (cellBtn.parentElement) cellBtn.parentElement.classList.toggle("cell-empty", !val);
    }
    var dish = document.querySelector(".course[data-course=\""+p[2]+"\"] .dish");
    if (dish && String(state.week)===String(p[0]) && state.day===p[1]) dish.textContent = val || "—";
  }
  function commitCellBar(){
    if (!cellBarKey) { closeCellBar(); return; }
    var val = document.getElementById("cellBarInput").value.trim();
    applyCellValue(cellBarKey, val, true);
    var wrap = document.querySelector("#cellBarAlg [data-alg]");
    if (wrap) {
      var p = cellBarKey.split(":");
      var menu = currentMenu();
      if (menu && menu.weeks[p[0]] && menu.weeks[p[0]].days[p[1]]) {
        menu.weeks[p[0]].days[p[1]][wrap.getAttribute("data-alg")] = codesFromChips(wrap);
        saveLibrary();
      }
    }
    closeCellBar();
    if (document.getElementById("screen-settimane") && document.getElementById("screen-settimane").classList.contains("active")) {
      renderSettimane();
      bind();
    }
  }
  document.getElementById("cellBarOk").onclick = function(){ commitCellBar(); };
  document.getElementById("cellBarClear").onclick = function(){
    document.getElementById("cellBarInput").value = "";
    if (cellBarKey) applyCellValue(cellBarKey, "", true);
    document.getElementById("cellBarInput").focus();
  };
  document.getElementById("cellBarInput").addEventListener("input", function(){
    if (cellBarKey) applyCellValue(cellBarKey, this.value, false);
  });
  document.getElementById("cellBarInput").addEventListener("keydown", function(e){
    if (e.key === "Enter") { e.preventDefault(); commitCellBar(); }
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", placeCellBar);
    window.visualViewport.addEventListener("scroll", placeCellBar);
  }
  var MEAL_KEYS = ["primo","primoA","secondo","secondoA","contorno","contornoA","frutta","fruttaA","merenda","merendaA"];
  var WEEK_NAMES = ["Prima settimana","Seconda settimana","Terza settimana","Quarta settimana"];
  var AI_PROMPT = "Analizza questa foto o PDF di menu scolastico/mensa italiano. Rispondi SOLO con un oggetto JSON valido, niente testo attorno, niente markdown, niente backtick.\n" +
    "Struttura esatta: {name, period, weeks:[{name, days:{lunedi,martedi,mercoledi,giovedi,venerdi}}]}.\n" +
    "Sempre 4 settimane (Prima, Seconda, Terza, Quarta) e 5 giorni. Ogni giorno: primo, primoA, secondo, secondoA, contorno, frutta, merenda, merendaA.\n" +
    "Se il foglio ha le settimane in colonna e i giorni in fascia, rispetta quella griglia. I numeri 1-14 UE accanto al piatto vanno in primoA/secondoA/contornoA/fruttaA/merendaA. Niente accenti nei nomi giorno. Non inventare piatti: se non si legge, lascia vuoto.";

  function renderImporta(){
    var box = document.getElementById("screen-importa");
    if (!box) return;
    box.innerHTML =
      '<div id="importa-compact">' +
      '<div class="drop" style="margin-bottom:10px"><h3>Crea menu vuoto</h3><p>Parti dalla tabella e compila a mano. In alto cambi menu o torni qui.</p>' +
      '<div class="field" style="text-align:left"><label>Nome</label><input id="imp-name" placeholder="es. Menu settembre"></div>' +
      '<button class="btn btn-primary btn-wide" id="btnBlank">Crea e apri la tabella</button></div>' +
      '<div class="meal-card"><h2>Da un AI</h2><p class="status">Copia il prompt e allegalo a foto o PDF in ChatGPT, Gemini, Copilot, Grok, Claude, Perplexity o un altra chat: vale ovunque accetti testo + file. Poi incolla qui il JSON.</p>' +
      '<div class="prompt-row"><span class="prompt-ph">Prompt 4 settimane</span><button type=button class="btn btn-ghost" id="copyPrompt">Copia</button></div>' +
      '<textarea id="promptBox" hidden>'+esc(AI_PROMPT)+"</textarea>" +
      '<div class="field"><label>JSON</label><textarea id="jsonPaste" placeholder="{ ... }"></textarea></div>' +
      '<div class="actions"><button class="btn btn-primary" id="applyJsonPaste">Importa JSON</button><button class="btn btn-ghost" id="btnJsonFile">File .json</button></div>' +
      '<input id="fileJson" type="file" accept=".json,application/json" hidden></div>' +
      '<div id="importWork"></div>' +
      '<div class="meal-card"><h2>Bozza OCR</h2><p class="status">Precompila la tabella. Controlla le celle.</p>' +
      '<div class="actions"><button class="btn btn-ghost" id="btnFoto">Foto</button><button class="btn btn-ghost" id="btnFile">PDF o foto</button></div>' +
      '<input id="fileCam" type="file" accept="image/*" capture="environment" hidden>' +
      '<input id="fileAny" type="file" accept="image/*,application/pdf" hidden></div></div>';
  }

  function loadScript(src){ return new Promise(function(res,rej){ var s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=function(){rej(new Error("script"));}; document.head.appendChild(s); }); }
  function setStatus(msg,pct){ var bar=document.getElementById("bar"); var st=document.getElementById("ocrStatus"); if(st) st.textContent=msg; if(bar&&pct!=null) bar.style.width=Math.max(0,Math.min(100,pct))+"%"; }
  var tessWorker=null;

  function dataUrlToBase64(url){
    var i = String(url||"").indexOf(",");
    return i>=0 ? url.slice(i+1) : url;
  }
  function mimeOfDataUrl(url){
    var m = String(url||"").match(/^data:([^;]+)/);
    return (m && m[1]) || "image/jpeg";
  }

  function loadImage(url){
    return new Promise(function(resolve,reject){
      var img = new Image();
      img.onload = function(){ resolve(img); };
      img.onerror = function(){ reject(new Error("Immagine non leggibile")); };
      img.src = url;
    });
  }

  function canvasToJpeg(c, q){
    try { return c.toDataURL("image/jpeg", q || 0.88); } catch(e){ return c.toDataURL("image/png"); }
  }

  async function preprocessImage(url, forApi){
    try{
      var img = await loadImage(url);
      var maxDim = forApi ? 1600 : 2200;
      var minDim = forApi ? 0 : 1400;
      var long = Math.max(img.naturalWidth, img.naturalHeight);
      var scale = 1;
      if (long > maxDim) scale = maxDim / long;
      else if (!forApi && long < minDim) scale = minDim / long;
      var w = Math.max(1, Math.round(img.naturalWidth * scale));
      var h = Math.max(1, Math.round(img.naturalHeight * scale));
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      var ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);
      if (forApi) return canvasToJpeg(c, 0.86);
      var data = ctx.getImageData(0, 0, w, h);
      var d = data.data, min = 255, max = 0, i, sum = 0, n = 0;
      for (i = 0; i < d.length; i += 4) {
        var g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = d[i + 1] = d[i + 2] = g;
        if (g < min) min = g;
        if (g > max) max = g;
        sum += g; n++;
      }
      var range = Math.max(1, max - min);
      var mean = sum / Math.max(1,n);
      var invert = mean < 88;
      for (i = 0; i < d.length; i += 4) {
        var v = (d[i] - min) * 255 / range;
        if (invert) v = 255 - v;
        if (v < 118) v = v * 0.72;
        else if (v > 170) v = 210 + (v-170)*0.35;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      ctx.putImageData(data, 0, 0);
      return canvasToJpeg(c, 0.95);
    }catch(e){ return url; }
  }

  function extractJsonObject(raw){
    var s = String(raw||"").trim();
    s = s.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
    var start = s.indexOf("{");
    var end = s.lastIndexOf("}");
    if (start<0 || end<=start) throw new Error("nessun JSON nella risposta");
    return JSON.parse(s.slice(start, end+1));
  }

  function countFilled(norm){
    var n = 0;
    (norm.weeks||[]).forEach(function(w){
      DAYS.forEach(function(d){
        var m = w.days[d.id] || {};
        MEAL_KEYS.forEach(function(k){ if (m[k]) n++; });
      });
    });
    return n;
  }

  async function callGeminiVision(dataUrl){
    var key = getGeminiKey();
    if (!key) throw new Error("niente chiave");
    var models = ["gemini-2.5-flash","gemini-2.0-flash","gemini-flash-latest","gemini-2.5-flash-lite"];
    var lastErr = "Gemini non ha risposto";
    var b64 = dataUrlToBase64(dataUrl);
    var mime = mimeOfDataUrl(dataUrl);
    if (mime === "image/jpg") mime = "image/jpeg";
    for (var i=0;i<models.length;i++){
      setStatus("AI "+models[i]+"...", 30+i*12);
      try{
        var url = "https://generativelanguage.googleapis.com/v1beta/models/"+models[i]+":generateContent?key="+encodeURIComponent(key);
        var body = {
          contents:[{ parts:[
            { inline_data:{ mime_type:mime, data:b64 } },
            { text: AI_PROMPT }
          ]}],
          generationConfig:{ temperature:0.1, responseMimeType:"application/json" }
        };
        var res = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
        var js = await res.json().catch(function(){ return {}; });
        if (!res.ok){
          lastErr = (js.error && js.error.message) || ("HTTP "+res.status);
          continue;
        }
        var text = "";
        var cands = (js.candidates||[]);
        if (cands[0] && cands[0].content && cands[0].content.parts){
          text = cands[0].content.parts.map(function(p){ return p.text||""; }).join("\n");
        }
        var obj = extractJsonObject(text);
        return validateAndNormalizeMenuJson(obj);
      }catch(err){
        lastErr = err.message || String(err);
      }
    }
    throw new Error(lastErr);
  }

  function collectWords(data){
    var out = [];
    function push(w){
      if (!w || !w.text) return;
      var t = String(w.text).trim();
      if (!t) return;
      var b = w.bbox || {};
      var conf = w.confidence == null ? 60 : w.confidence;
      if (conf < 20 && t.length < 3) return;
      out.push({ text:t, x:b.x0||0, y:b.y0||0, x1:b.x1||0, y1:b.y1||0, conf:conf });
    }
    if (data && Array.isArray(data.words)) data.words.forEach(push);
    function walk(node){
      if (!node) return;
      if (Array.isArray(node.words)) node.words.forEach(push);
      ["paragraphs","lines","blocks"].forEach(function(k){
        if (Array.isArray(node[k])) node[k].forEach(walk);
      });
    }
    if (data && data.blocks) {
      if (Array.isArray(data.blocks)) data.blocks.forEach(walk);
      else walk(data.blocks);
    }
    return out;
  }

  function detectDayToken(t){
    var low = String(t||"").toLowerCase();
    if (/luned/.test(low)) return "lunedi";
    if (/marted/.test(low)) return "martedi";
    if (/mercoled/.test(low)) return "mercoledi";
    if (/gioved/.test(low)) return "giovedi";
    if (/venerd/.test(low)) return "venerdi";
    return null;
  }
  function detectWeekIdx(t){
    var low = String(t||"").toLowerCase();
    if (/(?:1|i|prima)\s*[°oa.]?\s*settiman/.test(low) || /settiman\w*\s*(?:1|i)\b/.test(low)) return 0;
    if (/(?:2|ii|seconda)\s*[°oa.]?\s*settiman/.test(low) || /settiman\w*\s*(?:2|ii)\b/.test(low)) return 1;
    if (/(?:3|iii|terza)\s*[°oa.]?\s*settiman/.test(low) || /settiman\w*\s*(?:3|iii)\b/.test(low)) return 2;
    if (/(?:4|iv|quarta)\s*[°oa.]?\s*settiman/.test(low) || /settiman\w*\s*(?:4|iv)\b/.test(low)) return 3;
    return -1;
  }
  function detectCourse(low){
    low = String(low||"").toLowerCase();
    if (/\bmerenda\b|spuntino|yogurt|biscott|focacc|budino/.test(low) && !/\bprimo\b|\bsecondo\b/.test(low)) return "merenda";
    if (/\bfrutta\b/.test(low) && !/succo|yogurt/.test(low)) return "frutta";
    if (/\bcontorno\b|verdura|insalat|fagiolini|zucchin|carote|spinaci|patate|finocchi|bieta|piselli/.test(low) && !/pasta|risotto|pizza|crema di/.test(low)) return "contorno";
    if (/\bsecondo\b|pollo|pesce|frittata|tacchino|manzo|cotolet|filetto|prosciutto|mozzarella|hamburger|omelette|scalopp|platessa|tonno|formaggio|uova|arista|merluzzo/.test(low)) return "secondo";
    if (/\bprimo\b|pasta|risotto|pizza|crema|minestr|pastina|gnocchi|lasagn|brodo|spaghetti|penne|fusilli|orzo|farro|risoni/.test(low)) return "primo";
    return null;
  }
  function pullAllergens(s){
    var m = String(s).match(/\(([\d\s,;\/-]{1,24})\)/) || String(s).match(/\b(\d{1,2}(?:\s*[,;\/-]\s*\d{1,2}){1,6})\b/);
    if (!m) return "";
    return parseCodes(m[1]).join(",");
  }
  function cleanDish(s){
    return String(s||"")
      .replace(/\b(primo|secondo|contorno|frutta|merenda|piatto|pane)\b:?/ig," ")
      .replace(/\(([\d\s,;\/-]{1,24})\)/g," ")
      .replace(/\b\d{1,2}(?:\s*[,;\/-]\s*\d{1,2})+\b/g," ")
      .replace(/[|*•·]+/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  function weekGridHtml(weekObj, weekIdx, editable){
    var courses = [["primo","Primo"],["secondo","Secondo"],["contorno","Contorno"],["frutta","Frutta"],["merenda","Merenda"]];
    var head = "<tr><th></th>"+courses.map(function(c){ return "<th>"+c[1]+"</th>"; }).join("")+"</tr>";
    var body = DAYS.map(function(d){
      var m = (weekObj && weekObj.days && weekObj.days[d.id]) || meal();
      return "<tr><th class=day>"+d.short+"</th>"+courses.map(function(c){
        var val = m[c[0]] || "";
        var empty = val ? "" : " cell-empty";
        if (editable) return "<td class='"+empty+"'><button type=button class=cell-btn data-cell="+weekIdx+":"+d.id+":"+c[0]+">"+esc(val || "…")+"</button></td>";
        return "<td>"+esc(val || "")+"</td>";
      }).join("")+"</tr>";
    }).join("");
    return "<div class=week-grid><table>"+head+body+"</table></div>";
  }

  function isAllergenToken(t){
    return /^\d{1,2}([.,;\/-]\d{1,2}){0,6}$/.test(String(t||"").replace(/\s+/g,""));
  }
  function guessCourseLine(low){
    if (/merenda|yogurt|biscott|cracker|creaker|marmellata|cioccolat|spremute|spremuta/.test(low)) return "merenda";
    if (/^(mela|pera|pesca|banana|albicocc|prugn|anguria|melone|uva|kiwi)\b/.test(low) || /\bfrutta\b/.test(low)) return "frutta";
    if (/insalat|pomodor|carote|fagiolini|zucchine|patate|finocchi|bieta|spinaci|verdura/.test(low) && !/pasta|risotto|crema|pizza|cous/.test(low)) return "contorno";
    return detectCourse(low);
  }
  function fillSlotFromLines(slot, lines){
    var pending = [];
    lines.forEach(function(raw){
      var t = String(raw||"").trim();
      if (!t) return;
      var all = pullAllergens(t);
      if (isAllergenToken(t.replace(/\s/g,""))) {
        if (pending.length) {
          var last = pending[pending.length-1];
          last.all = last.all || parseCodes(t).join(",");
        }
        return;
      }
      var dish = cleanDish(t);
      if (!dish || dish.length<2) return;
      if (/^(luned|marted|mercoled|gioved|venerd|settiman|menu)/i.test(dish)) return;
      pending.push({ dish:dish, all:all, course:guessCourseLine(t.toLowerCase()) });
    });
    pending.forEach(function(item){
      var course = item.course;
      if (!course) {
        if (!slot.primo) course = "primo";
        else if (!slot.secondo) course = "secondo";
        else if (!slot.contorno) course = "contorno";
        else if (!slot.frutta) course = "frutta";
        else course = "merenda";
      }
      if (course==="primo"){ if(!slot.primo) slot.primo=item.dish; else slot.primo += " "+item.dish; if(item.all) slot.primoA=item.all; }
      else if (course==="secondo"){ if(!slot.secondo) slot.secondo=item.dish; else slot.secondo += " "+item.dish; if(item.all) slot.secondoA=item.all; }
      else if (course==="contorno"){ if(!slot.contorno) slot.contorno=item.dish; else slot.contorno += " "+item.dish; }
      else if (course==="frutta"){ if(!slot.frutta) slot.frutta=item.dish; }
      else if (course==="merenda"){ if(!slot.merenda) slot.merenda=item.dish.replace(/^merenda:?\s*/i,""); if(item.all) slot.merendaA=item.all; }
    });
  }

  function parseWeeksAsColumns(words){
    var weeks = WEEK_NAMES.map(function(n){ return { name:n, days:emptyDays() }; });
    var weekHits = [];
    var dayHits = [];
    (words||[]).forEach(function(w){
      var mid = (w.x+(w.x1||w.x))/2;
      var wi = detectWeekIdx(w.text);
      if (wi>=0) weekHits.push({ i:wi, x:mid, y:w.y });
      var d = detectDayToken(w.text);
      if (d && String(w.text).length<14) dayHits.push({ id:d, x:mid, y:w.y });
    });
    if (weekHits.length < 3) return null;
    var weekXs = [null,null,null,null];
    weekHits.forEach(function(h){
      weekXs[h.i] = weekXs[h.i]==null ? h.x : (weekXs[h.i]+h.x)/2;
    });
    var knownW = weekXs.filter(function(v){ return v!=null; });
    if (knownW.length < 3) return null;
    for (var i=0;i<4;i++){
      if (weekXs[i]==null){
        var prev = weekXs.slice(0,i).filter(function(v){ return v!=null; }).pop();
        var next = weekXs.slice(i+1).find(function(v){ return v!=null; });
        weekXs[i] = prev!=null && next!=null ? (prev+next)/2 : (prev!=null ? prev+120 : next-120);
      }
    }
    function weekOfX(x){
      var best=0, dist=1e9;
      for (var i=0;i<4;i++){ var d=Math.abs(x-weekXs[i]); if(d<dist){ dist=d; best=i; } }
      return best;
    }
    var bands = [];
    dayHits.forEach(function(h){
      var band = bands.find(function(b){ return Math.abs(b.y-h.y)<28; });
      if (!band){ band = { y:h.y, ids:{} }; bands.push(band); }
      band.ids[h.id] = (band.ids[h.id]||0)+1;
    });
    bands.sort(function(a,b){ return a.y-b.y; });
    bands.forEach(function(b){
      var top = "lunedi", n=0;
      Object.keys(b.ids).forEach(function(id){ if (b.ids[id]>n){ n=b.ids[id]; top=id; } });
      b.id = top;
    });
    function dayOfY(y){
      if (!bands.length) return "lunedi";
      var best = bands[0], dist = 1e9;
      bands.forEach(function(b){
        var d = y < b.y-10 ? 1e8 : Math.abs(y-b.y);
        if (d<dist){ dist=d; best=b; }
      });
      var above = bands.filter(function(b){ return b.y <= y+12; });
      if (above.length) best = above[above.length-1];
      return best.id;
    }
    var buckets = {};
    (words||[]).forEach(function(w){
      if (detectWeekIdx(w.text)>=0 && String(w.text).length<24) return;
      if (detectDayToken(w.text) && String(w.text).length<14) return;
      var mid = (w.x+(w.x1||w.x))/2;
      var key = weekOfX(mid)+":"+dayOfY(w.y);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(w);
    });
    Object.keys(buckets).forEach(function(key){
      var parts = key.split(":");
      var slot = weeks[+parts[0]].days[parts[1]];
      if (!slot) return;
      var list = buckets[key].sort(function(a,b){ return a.y-b.y || a.x-b.x; });
      var lines = [];
      list.forEach(function(w){
        var row = lines.find(function(r){ return Math.abs(r.y-w.y)<14; });
        if (!row){ row = { y:w.y, t:"" }; lines.push(row); }
        row.t += (row.t?" ":"")+w.text;
      });
      fillSlotFromLines(slot, lines.map(function(r){ return r.t; }));
    });
    return weeks;
  }

  function parseDaysAsColumns(words){
    var weeks = WEEK_NAMES.map(function(n){ return { name:n, days:emptyDays() }; });
    var dayHits = [];
    var weekHits = [];
    (words||[]).forEach(function(w){
      var d = detectDayToken(w.text);
      if (d && String(w.text).length < 14) dayHits.push({ id:d, x:(w.x+(w.x1||w.x))/2, y:w.y });
      var wi = detectWeekIdx(w.text);
      if (wi >= 0) weekHits.push({ i:wi, y:w.y });
    });
    var colXs = [null,null,null,null,null];
    dayHits.forEach(function(h){
      var idx = DAYS.findIndex(function(d){ return d.id===h.id; });
      if (idx<0) return;
      colXs[idx] = colXs[idx]==null ? h.x : (colXs[idx]+h.x)/2;
    });
    var known = colXs.filter(function(v){ return v!=null; });
    if (known.length < 3) return null;
    for (var j=0;j<5;j++){
      if (colXs[j]==null){
        var prev = colXs.slice(0,j).filter(function(v){ return v!=null; }).pop();
        var next = colXs.slice(j+1).find(function(v){ return v!=null; });
        colXs[j] = prev!=null && next!=null ? (prev+next)/2 : (prev!=null ? prev+90 : (next!=null ? next-90 : j*80));
      }
    }
    function colOf(x){
      var best=0, dist=1e9;
      for (var i=0;i<5;i++){ var d=Math.abs(x-colXs[i]); if(d<dist){ dist=d; best=i; } }
      return best;
    }
    function weekOf(y){
      var best = 0, bestY = -1;
      weekHits.forEach(function(h){ if (h.y <= y+8 && h.y >= bestY){ bestY=h.y; best=h.i; } });
      return best;
    }
    var rows = [];
    (words||[]).forEach(function(w){
      if (detectDayToken(w.text) && String(w.text).length<14) return;
      if (detectWeekIdx(w.text)>=0 && String(w.text).length<22) return;
      var row = rows.find(function(r){ return Math.abs(r.y-w.y)<16; });
      if (!row){ row = { y:w.y, week:weekOf(w.y), cells:["","","","",""] }; rows.push(row); }
      var c = colOf((w.x+(w.x1||w.x))/2);
      row.cells[c] += (row.cells[c]?" ":"")+w.text;
    });
    rows.sort(function(a,b){ return a.y-b.y; });
    DAYS.forEach(function(d, idx){
      var byWeek = [[],[],[],[]];
      rows.forEach(function(r){ if (r.cells[idx]) byWeek[r.week].push(r.cells[idx]); });
      byWeek.forEach(function(lines, wi){ fillSlotFromLines(weeks[wi].days[d.id], lines); });
    });
    return weeks;
  }

  function wordsToMenuJson(words, fallbackText, suggestedName){
    var candidates = [];
    var weekCols = parseWeeksAsColumns(words);
    if (weekCols) candidates.push(weekCols);
    var dayCols = parseDaysAsColumns(words);
    if (dayCols) candidates.push(dayCols);
    if (fallbackText) candidates.push(parseMenuText(fallbackText));
    var weeks = WEEK_NAMES.map(function(n){ return { name:n, days:emptyDays() }; });
    var best = -1;
    candidates.forEach(function(w){
      var n = countFilled({weeks:w});
      if (n > best){ best = n; weeks = w; }
    });
    var period = "";
    var blob = String(fallbackText||"");
    var pm = blob.match(/dal\s*(\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?)\s*al\s*(\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?)/i);
    if (pm) period = pm[1]+" - "+pm[2];
    else if (/estiv/i.test(blob)) period = "Estivo";
    else if (/invern/i.test(blob)) period = "Invernale";
    return { name: suggestedName || "Nuovo menu", period: period, weeks: weeks };
  }

  function parseMenuText(text){
    var weeks = WEEK_NAMES.map(function(n){ return { name:n, days:emptyDays() }; });
    var weekIdx=0, dayId="lunedi";
    String(text||"").split(/\n+/).forEach(function(line){
      line=line.trim(); if(!line) return;
      var low=line.toLowerCase();
      var wi=detectWeekIdx(low); if(wi>=0) weekIdx=wi;
      var d=detectDayToken(low); if(d) dayId=d;
      var slot=weeks[weekIdx].days[dayId]; if(!slot) return;
      var stripped=line.replace(/luned[i\u00ec]|marted[i\u00ec]|mercoled[i\u00ec]|gioved[i\u00ec]|venerd[i\u00ec]/ig," ").replace(/\s+/g," ").trim();
      if(!stripped || /^settiman/i.test(stripped)) return;
      var course=detectCourse(low);
      var dish=cleanDish(stripped);
      if(!dish || dish.length<3 || /settiman|allergen|^menu$/i.test(dish)) return;
      var all=pullAllergens(line);
      if(course==="primo"){ slot.primo=dish; if(all) slot.primoA=all; }
      else if(course==="secondo"){ slot.secondo=dish; if(all) slot.secondoA=all; }
      else if(course==="contorno") slot.contorno=dish;
      else if(course==="frutta") slot.frutta=dish;
      else if(course==="merenda"){ slot.merenda=dish; if(all) slot.merendaA=all; }
      else if(!slot.primo){ slot.primo=dish; if(all) slot.primoA=all; }
      else if(!slot.secondo){ slot.secondo=dish; if(all) slot.secondoA=all; }
      else if(!slot.contorno) slot.contorno=dish;
      else if(!slot.frutta) slot.frutta=dish;
      else if(!slot.merenda){ slot.merenda=dish; if(all) slot.merendaA=all; }
    });
    return weeks;
  }

  async function runOcr(url){
    setStatus("Carico riconoscimento...", 18);
    if(!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    if(!tessWorker) tessWorker=await Tesseract.createWorker("ita",1,{logger:function(m){ if(m.status==="recognizing text") setStatus("OCR "+Math.round((m.progress||0)*100)+"%", 22+(m.progress||0)*55); }});
    var modes=["6","4","11"];
    var best={ text:"", words:[], score:-1 };
    for (var i=0;i<modes.length;i++){
      setStatus("Passaggio OCR "+(i+1)+"/"+modes.length+"...", 20+i*18);
      await tessWorker.setParameters({ tessedit_pageseg_mode:modes[i], preserve_interword_spaces:"1", user_defined_dpi:"300" });
      var result=await tessWorker.recognize(url);
      var data=result.data||{};
      var text=data.text||"";
      var words=collectWords(data);
      var low=text.toLowerCase();
      var sc=Math.min(20, text.replace(/\s+/g,"").length/40);
      ["luned","marted","mercoled","gioved","venerd"].forEach(function(d){ if(low.indexOf(d)!==-1) sc+=8; });
      ["primo","secondo","contorno","frutta","merenda","pasta","settiman"].forEach(function(k){ if(low.indexOf(k)!==-1) sc+=3; });
      sc += Math.min(15, words.length/8);
      if (sc>best.score) best={ text:text, words:words, score:sc };
      if (sc>=46) break;
    }
    return best;
  }

  function pdfItemsToWords(items){
    return (items||[]).map(function(it){
      var tr = it.transform || [1,0,0,1,0,0];
      return { text:String(it.str||"").trim(), x:tr[4]||0, y:-(tr[5]||0), x1:(tr[4]||0)+((it.width)||0), y1:-(tr[5]||0)+10, conf:90 };
    }).filter(function(w){ return w.text; });
  }

  function proposedName(){
    var el=document.getElementById("imp-name");
    return (el && el.value.trim()) || "Nuovo menu";
  }

  async function handleFile(file){
    if(!file) return;
    var work=document.getElementById("importWork");
    work.innerHTML='<div class="meal-card"><div class="status">Preparazione...</div><div class="preview-wrap" id="preview"></div><div class="progress"><i id="bar"></i></div><div class="status" id="ocrStatus">Attendi</div></div>';
    try{
      var previewUrl="";
      var sourceUrl="";
      var pdfWords=null;
      var pdfText="";
      if(file.type==="application/pdf"||/\.pdf$/i.test(file.name||"")){
        setStatus("Leggo PDF...", 8);
        if(!window.pdfjsLib){ await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"); window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; }
        var pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
        var page=await pdf.getPage(1);
        var content=await page.getTextContent();
        pdfWords=pdfItemsToWords(content.items);
        pdfText=content.items.map(function(it){ return it.str; }).join("\n");
        var vp=page.getViewport({scale:2});
        var c=document.createElement("canvas"); c.width=vp.width; c.height=vp.height;
        await page.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;
        previewUrl=canvasToJpeg(c,0.9);
        sourceUrl=previewUrl;
        document.getElementById("preview").innerHTML='<img alt="Anteprima" src="'+previewUrl+'">';
      } else {
        sourceUrl=URL.createObjectURL(file);
        previewUrl=sourceUrl;
        document.getElementById("preview").innerHTML='<img alt="Anteprima" src="'+previewUrl+'">';
      }

      var used="ocr";
      var norm=null;
      var rawText="";
      if (!norm || countFilled(norm)<3){
        var ocrNorm=null;
        if (pdfWords && pdfText.replace(/\s+/g,"").length>=40){
          ocrNorm=wordsToMenuJson(pdfWords, pdfText, proposedName());
          rawText=pdfText;
        }
        if (!ocrNorm || countFilled(ocrNorm)<4){
          setStatus("Preparo la foto per l OCR...", 18);
          var pre=await preprocessImage(sourceUrl, false);
          var ocr=await runOcr(pre);
          rawText=(rawText?rawText+"\n":"")+(ocr.text||"");
          var fromWords=wordsToMenuJson(ocr.words, rawText, proposedName());
          if (!ocrNorm || countFilled(fromWords)>=countFilled(ocrNorm)) ocrNorm=fromWords;
        }
        if (!norm || countFilled(ocrNorm)>countFilled(norm)) { norm=ocrNorm; if(used!=="ai") used="ocr"; }
      }
      if (!norm) norm=validateAndNormalizeMenuJson({ name:proposedName(), weeks:[] });
      if (proposedName() && proposedName()!=="Nuovo menu") norm.name=proposedName();
      showReview(norm, used, rawText);
    }catch(err){
      setStatus("Errore: "+err.message);
      showReview(validateAndNormalizeMenuJson({ name:proposedName(), weeks:[] }), "ocr", "");
    }
  }

  function previewWeeksHtml(norm){
    return (norm.weeks||[]).map(function(w,i){
      return '<div class="meal-card"><h2>'+esc(w.name)+"</h2>"+weekGridHtml(w,i,true)+"</div>";
    }).join("");
  }
  function readGridIntoNorm(norm){
    document.querySelectorAll("[data-cell]").forEach(function(inp){
      var p = inp.getAttribute("data-cell").split(":");
      if (norm.weeks[p[0]] && norm.weeks[p[0]].days[p[1]]) norm.weeks[p[0]].days[p[1]][p[2]] = inp.value.trim();
    });
    return norm;
  }

  function showReview(norm, used, rawText){
    window.__importNorm = norm;
    var n = countFilled(norm);
    var src = "Bozza OCR. Controlla ogni giorno prima di salvare. Per un risultato pulito usa il JSON da AI sopra.";
    document.getElementById("importWork").innerHTML +=
      '<div class="meal-card"><h2>Anteprima struttura</h2><p class="status">'+esc(src)+" Campi pieni: "+n+". Controlla, correggi il JSON se serve, poi salva.</p>"+
      '<div class="field"><label>Nome menu</label><input id="imp-title-name" value="'+esc(norm.name||"Nuovo menu")+'"></div>'+
      '<div class="field"><label>Periodo</label><input id="imp-period" value="'+esc(norm.period||"")+'"></div>'+
      '<div class="field"><label>JSON (opzionale)</label><textarea id="imp-json" style="min-height:110px">'+esc(JSON.stringify(norm,null,2))+"</textarea></div>"+
      (rawText ? '<div class="field"><label>Testo OCR grezzo</label><textarea id="imp-raw">'+esc(rawText)+"</textarea></div>" : "")+
      '<button class="btn btn-ghost btn-wide" id="reparse">Rileggi dal JSON / testo</button>'+
      '<button class="btn btn-primary btn-wide" id="applyParse">Salva come nuovo menu</button>'+
      '<button class="btn btn-ghost btn-wide" id="copyJson">Copia JSON</button></div>'+
      '<div id="parsePreview">'+previewWeeksHtml(norm)+"</div>";
    document.getElementById("reparse").onclick=function(){
      try{
        var fromJson=document.getElementById("imp-json").value;
        var obj=JSON.parse(fromJson);
        window.__importNorm=validateAndNormalizeMenuJson(obj);
      }catch(e){
        var raw=document.getElementById("imp-raw");
        window.__importNorm=validateAndNormalizeMenuJson({ name:proposedName(), weeks:parseMenuText(raw?raw.value:"") });
      }
      document.getElementById("imp-json").value=JSON.stringify(window.__importNorm,null,2);
      document.getElementById("parsePreview").innerHTML=previewWeeksHtml(window.__importNorm);
      bind();
      toast("Struttura aggiornata");
    };
    document.getElementById("applyParse").onclick=function(){
      try{
        var base=window.__importNorm || validateAndNormalizeMenuJson(JSON.parse(document.getElementById("imp-json").value));
        base=readGridIntoNorm(base);
        var norm2=validateAndNormalizeMenuJson(base);
        norm2.name=(document.getElementById("imp-title-name").value||norm2.name).trim();
        norm2.period=(document.getElementById("imp-period").value||"").trim();
        saveImportedMenu(norm2);
      }catch(err){ toast("JSON non valido: "+err.message); }
    };
    document.getElementById("copyJson").onclick=function(){
      var box=document.getElementById("imp-json");
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(box.value).then(function(){ toast("JSON copiato"); }).catch(function(){ fallbackCopy(box); });
      else fallbackCopy(box);
    };
    bind();
  }

  function normalizeMealShape(sd){
    sd = sd || {};
    return {
      primo:String(sd.primo||"").trim(), primoA:String(sd.primoA||"").trim(),
      secondo:String(sd.secondo||"").trim(), secondoA:String(sd.secondoA||"").trim(),
      contorno:String(sd.contorno||"").trim(), contornoA:String(sd.contornoA||"").trim(),
      frutta:String(sd.frutta||"").trim(), fruttaA:String(sd.fruttaA||"").trim(),
      merenda:String(sd.merenda||"").trim(), merendaA:String(sd.merendaA||"").trim()
    };
  }
  function validateAndNormalizeMenuJson(obj){
    if(!obj || typeof obj!=="object") throw new Error("il file non contiene un oggetto JSON");
    var name=(obj.name||"Nuovo menu").toString().trim() || "Nuovo menu";
    var period=(obj.period||"").toString().trim();
    var srcWeeks=Array.isArray(obj.weeks)?obj.weeks:[];
    var weeks=WEEK_NAMES.map(function(wn,i){
      var src=srcWeeks[i]||{};
      var srcDays=(src&&src.days)||{};
      var days={};
      DAYS.forEach(function(d){ days[d.id]=normalizeMealShape(srcDays[d.id]); });
      return { name:(src.name||wn), days:days };
    });
    return { name:name, period:period, weeks:weeks };
  }
  function saveImportedMenu(norm){
    var nameInput=document.getElementById("imp-name");
    var title=document.getElementById("imp-title-name");
    if(title && title.value.trim()) norm.name=title.value.trim();
    else if(nameInput && nameInput.value.trim()) norm.name=nameInput.value.trim();
    var created=makeMenu(norm);
    state.menus.push(created); state.activeId=created.id; saveLibrary();
    toast("Menu salvato: "+created.name); goTab("settimane"); renderAll();
  }
  function applyJsonText(raw){
    try{
      var obj=extractJsonObject(raw);
      var norm=validateAndNormalizeMenuJson(obj);
      saveImportedMenu(norm);
    }catch(err){ toast("JSON non valido: "+err.message); }
  }
  function handleJsonFile(file){
    if(!file) return;
    var reader=new FileReader();
    reader.onload=function(){ applyJsonText(String(reader.result||"")); };
    reader.onerror=function(){ toast("Impossibile leggere il file"); };
    reader.readAsText(file);
  }
  function copyPromptText(){
    var box=document.getElementById("promptBox");
    var text = (box && box.value) || AI_PROMPT;
    var done=function(){ toast("Prompt copiato: incollalo in un AI con la foto"); };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(done).catch(function(){
        if (box) fallbackCopy(box); else toast("Copia non riuscita");
      });
    } else if (box) {
      fallbackCopy(box);
    } else {
      toast("Copia non riuscita");
    }
  }
  function fallbackCopy(box){
    try{ box.removeAttribute("readonly"); box.focus(); box.select(); document.execCommand("copy"); box.setAttribute("readonly","readonly"); toast("Prompt copiato"); }
    catch(e){ toast("Copia manualmente il testo"); }
  }

  if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(function(){});
  applyTint(currentTintId());
  renderAll();
})();
