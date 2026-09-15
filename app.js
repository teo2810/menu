(function () {
  var DAYS = [
    { id:"lunedi", short:"LUN", label:"Lunedi" },
    { id:"martedi", short:"MAR", label:"Martedi" },
    { id:"mercoledi", short:"MER", label:"Mercoledi" },
    { id:"giovedi", short:"GIO", label:"Giovedi" },
    { id:"venerdi", short:"VEN", label:"Venerdi" }
  ];
  var STORE = "menu-library-v3";
  function meal(){ return {primo:"",primoA:"",secondo:"",secondoA:"",contorno:"",frutta:"",merenda:"",merendaA:""}; }
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
      ["contorno","Contorno",d.contorno,d.contornoA],
      ["frutta","Frutta",d.frutta,d.fruttaA],
      ["merenda","Merenda",d.merenda,d.merendaA]
    ].filter(function(x){ return x[2]; });
    var body = rows.length ? rows.map(function(x){
      return "<div class=course><div class='ico svg-"+x[0]+"'>"+ICONS[x[0]]+"</div><div class=course-body><div class=label>"+x[1]+"</div><div class=dish>"+esc(x[2])+"</div><div class=hint>Tocca per gli allergeni</div></div>"+allergenBox(x[3])+"</div>";
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
    box.innerHTML = "<div class=week-tabs>"+tabs+"</div><div class=day-rail>"+chips+"</div>"+mealHtml(m.weeks[state.week].days[state.day],state.week,state.day);
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
      var name = ((el && el.value.trim()) || "Nuovo menu").trim();
      var created = makeMenu({ name:name });
      state.menus.push(created); state.activeId = created.id; saveLibrary();
      toast("Creato: "+created.name); goTab("settimane"); renderAll();
    };
    var jsonBtn = document.getElementById("btnJsonFile");
    var jsonFile = document.getElementById("fileJson");
    if (jsonBtn && jsonFile) jsonBtn.onclick = function(){ jsonFile.click(); };
    if (jsonFile) jsonFile.onchange = function(e){ handleJsonFile(e.target.files[0]); };
    var jsonApply = document.getElementById("applyJsonPaste");
    if (jsonApply) jsonApply.onclick = function(){ applyJsonText(document.getElementById("jsonPaste").value); };
    var copyBtn = document.getElementById("copyPrompt");
    if (copyBtn) copyBtn.onclick = function(){ copyPromptText(); };
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
          return "<div class=allergen-row style='justify-content:space-between'><b>"+esc(item.name)+"</b><span><button class=edit-btn data-use="+item.id+">Apri</button> <button class='edit-btn btn-del' data-del="+item.id+">Elimina</button></span></div>";
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
  var AI_PROMPT = "Analizza la foto di questo menu scolastico/mensa e rispondi SOLO con un oggetto JSON valido (niente testo attorno, niente markdown, niente backtick), con esattamente questa struttura:\n" +
    "{\n" +
    '  "name": "Nome del menu",\n' +
    '  "period": "",\n' +
    '  "weeks": [\n' +
    '    {"name":"Prima settimana","days":{\n' +
    '      "lunedi":{"primo":"","primoA":"","secondo":"","secondoA":"","contorno":"","frutta":"","merenda":"","merendaA":""},\n' +
    '      "martedi":{"primo":"","primoA":"","secondo":"","secondoA":"","contorno":"","frutta":"","merenda":"","merendaA":""},\n' +
    '      "mercoledi":{"primo":"","primoA":"","secondo":"","secondoA":"","contorno":"","frutta":"","merenda":"","merendaA":""},\n' +
    '      "giovedi":{"primo":"","primoA":"","secondo":"","secondoA":"","contorno":"","frutta":"","merenda":"","merendaA":""},\n' +
    '      "venerdi":{"primo":"","primoA":"","secondo":"","secondoA":"","contorno":"","frutta":"","merenda":"","merendaA":""}\n' +
    '    }},\n' +
    '    {"name":"Seconda settimana","days":{ ...stessi 5 giorni e stessi campi... }},\n' +
    '    {"name":"Terza settimana","days":{ ...stessi 5 giorni e stessi campi... }},\n' +
    '    {"name":"Quarta settimana","days":{ ...stessi 5 giorni e stessi campi... }}\n' +
    "  ]\n" +
    "}\n" +
    "Regole: metti sempre tutte e 4 le settimane e tutti i 5 giorni (lunedi-venerdi), anche se restano vuoti. I campi primoA, secondoA, merendaA contengono solo i numeri degli allergeni separati da virgola (es. \"1,3,7\"), vuoti se non indicati sul menu. Non inventare piatti: se un giorno o una settimana non si legge, lascia i campi vuoti. Rispondi solo con il JSON, nessun commento prima o dopo.";
  function renderImporta(){
    var box = document.getElementById("screen-importa");
    if (!box) return;
    box.innerHTML =
      '<div class="drop"><h3>Nuovo menu</h3><p>Dai un nome, poi fotografa o allega il foglio.</p>' +
      '<div class="field" style="text-align:left"><label>Nome menu</label><input id="imp-name" placeholder="es. Scuola X"></div>' +
      '<div class="actions"><button class="btn btn-primary" id="btnFoto">Scatta foto</button><button class="btn btn-ghost" id="btnFile">Allega file</button></div>' +
      '<input id="fileCam" type="file" accept="image/*" capture="environment" hidden>' +
      '<input id="fileAny" type="file" accept="image/*,application/pdf" hidden></div>' +
      '<div id="importWork"></div>' +
      '<button class="btn btn-ghost btn-wide" id="btnBlank">Crea menu vuoto da compilare</button>' +
      '<div class="meal-card" style="margin-top:14px">' +
        '<h2>Importa da JSON</h2>' +
        '<p class="status">Hai gia un JSON pronto? Caricalo qui.</p>' +
        '<button class="btn btn-ghost btn-wide" id="btnJsonFile">Carica file .json</button>' +
        '<input id="fileJson" type="file" accept=".json,application/json" hidden>' +
        '<div class="field"><label>Oppure incolla il JSON</label><textarea id="jsonPaste" placeholder="{ ... }"></textarea></div>' +
        '<button class="btn btn-primary btn-wide" id="applyJsonPaste">Importa JSON incollato</button>' +
      '</div>' +
      '<div class="meal-card" style="margin-top:14px">' +
        '<h2>Riconoscimento debole? Usa un AI</h2>' +
        '<p class="status">Se qui il testo non viene letto bene, apri un\'app AI che legge le immagini (es. Claude, ChatGPT, Gemini), incolla questo prompt insieme alla foto del menu, poi copia la risposta JSON e importala qui sopra.</p>' +
        '<div class="field"><label>Prompt da copiare</label><textarea id="promptBox" readonly>'+esc(AI_PROMPT)+'</textarea></div>' +
        '<button class="btn btn-ghost btn-wide" id="copyPrompt">Copia prompt</button>' +
      '</div>';
  }
  function renderAll(){ renderHeader(); renderOggi(); renderSettimane(); renderImporta(); renderInfo(); bind(); }
  function openEdit(key){
    var m = currentMenu(); if(!m) return;
    var p = key.split(":"); var w=+p[0], d=p[1];
    var mealObj = m.weeks[w].days[d];
    state.edit = {w:w,d:d};
    document.getElementById("editMeta").textContent = m.name+" "+m.weeks[w].name+" "+d;
    ["primo","primoA","secondo","secondoA","contorno","frutta","merenda","merendaA"].forEach(function(k){ document.getElementById("f-"+k).value = mealObj[k]||""; });
    document.getElementById("editModal").classList.add("open");
  }
  document.getElementById("closeEdit").onclick = function(){ document.getElementById("editModal").classList.remove("open"); };
  document.getElementById("saveEdit").onclick = function(){
    if(!state.edit||!currentMenu()) return;
    var mealObj = currentMenu().weeks[state.edit.w].days[state.edit.d];
    ["primo","primoA","secondo","secondoA","contorno","frutta","merenda","merendaA"].forEach(function(k){ mealObj[k]=document.getElementById("f-"+k).value.trim(); });
    saveLibrary(); document.getElementById("editModal").classList.remove("open"); toast("Giorno aggiornato"); renderAll();
  };
  document.getElementById("periodPill").onclick = function(){ goTab("info"); };

  function loadScript(src){ return new Promise(function(res,rej){ var s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=function(){rej(new Error("script"));}; document.head.appendChild(s); }); }
  function setStatus(msg,pct){ var bar=document.getElementById("bar"); var st=document.getElementById("ocrStatus"); if(st) st.textContent=msg; if(bar&&pct!=null) bar.style.width=Math.max(0,Math.min(100,pct))+"%"; }
  var tessWorker=null;

  // Migliora il contrasto dell'immagine prima di darla all'OCR: aiuta molto su foto scattate col telefono.
  function preprocessImage(url){
    return new Promise(function(resolve){
      var img = new Image();
      img.onload = function(){
        try{
          var maxDim = 2200;
          var scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
          var w = Math.max(1, Math.round(img.naturalWidth * scale));
          var h = Math.max(1, Math.round(img.naturalHeight * scale));
          var c = document.createElement("canvas"); c.width = w; c.height = h;
          var ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          var data = ctx.getImageData(0, 0, w, h);
          var d = data.data, min = 255, max = 0, i;
          for (i = 0; i < d.length; i += 4) {
            var g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            d[i] = d[i + 1] = d[i + 2] = g;
            if (g < min) min = g;
            if (g > max) max = g;
          }
          var range = Math.max(1, max - min);
          for (i = 0; i < d.length; i += 4) {
            var v = (d[i] - min) * 255 / range;
            d[i] = d[i + 1] = d[i + 2] = v;
          }
          ctx.putImageData(data, 0, 0);
          resolve(c.toDataURL("image/jpeg", 0.95));
        }catch(e){ resolve(url); }
      };
      img.onerror = function(){ resolve(url); };
      img.src = url;
    });
  }

  async function handleFile(file){
    if(!file) return;
    var work=document.getElementById("importWork");
    work.innerHTML='<div class="meal-card"><div class="status">Preparazione...</div><div class="preview-wrap" id="preview"></div><div class="progress"><i id="bar"></i></div><div class="status" id="ocrStatus">Attendi</div></div>';
    try{
      var text="";
      if(file.type==="application/pdf"||/\.pdf$/i.test(file.name||"")){
        setStatus("Leggo PDF...",10);
        if(!window.pdfjsLib){ await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"); window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; }
        var pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
        var page=await pdf.getPage(1);
        var content=await page.getTextContent();
        text=content.items.map(function(it){return it.str;}).join(" ");
        var vp=page.getViewport({scale:2});
        var c=document.createElement("canvas"); c.width=vp.width; c.height=vp.height;
        await page.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;
        var pdfDataUrl=c.toDataURL("image/jpeg",0.9);
        document.getElementById("preview").innerHTML='<img alt="Anteprima" src="'+pdfDataUrl+'">';
        if(text.replace(/\s+/g,"").length<50){
          setStatus("Testo scarso, provo il riconoscimento immagine...",30);
          var pre=await preprocessImage(pdfDataUrl);
          text=await runOcr(pre);
        }
      } else {
        setStatus("Preparo la foto...",10);
        var url=URL.createObjectURL(file);
        document.getElementById("preview").innerHTML='<img alt="Anteprima" src="'+url+'">';
        setStatus("Miglioro il contrasto...",15);
        var preImg=await preprocessImage(url);
        text=await runOcr(preImg);
      }
      showReview(text);
    }catch(err){ setStatus("Errore: "+err.message); showReview(""); }
  }
  async function runOcr(url){
    setStatus("Carico riconoscimento...",20);
    if(!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    if(!tessWorker) tessWorker=await Tesseract.createWorker("ita",1,{logger:function(m){ if(m.status==="recognizing text") setStatus("Riconoscimento... "+Math.round((m.progress||0)*100)+"%",25+(m.progress||0)*70); }});
    await tessWorker.setParameters({tessedit_pageseg_mode:"6",preserve_interword_spaces:"1",user_defined_dpi:"300"});
    var first=await tessWorker.recognize(url);
    var text=(first.data&&first.data.text)||"";
    if(text.replace(/\s+/g,"").length<30){
      await tessWorker.setParameters({tessedit_pageseg_mode:"11"});
      var second=await tessWorker.recognize(url);
      var t2=(second.data&&second.data.text)||"";
      if(t2.length>text.length) text=t2;
    }
    return text;
  }

  // Estrae eventuali numeri di allergeni tra parentesi o dopo "all./allergeni" da un pezzo di testo.
  function extractAllergens(dish){
    var m = dish.match(/\(([\d\s,\/;]{1,24})\)/) || dish.match(/all(?:ergeni)?\.?\s*[:\-]?\s*([\d][\d\s,\/;]{0,20})\s*$/i);
    if(!m) return { dish: dish.trim(), allergens: "" };
    var nums = m[1].replace(/[^\d,]/g,",").split(",").map(function(x){return x.trim();}).filter(Boolean);
    var allergens = nums.join(",");
    var cleanDish = (dish.slice(0,m.index) + dish.slice(m.index+m[0].length)).replace(/\s+/g," ").trim();
    return { dish: cleanDish, allergens: allergens };
  }

  var DAY_RE = /luned[i\u00ec]|marted[i\u00ec]|mercoled[i\u00ec]|gioved[i\u00ec]|venerd[i\u00ec]/ig;
  var LABELS = [
    { key:"primo", re:/\bprimo(?:\s*piatto)?\b\s*[:\-]?\s*/i, allergenKey:"primoA" },
    { key:"secondo", re:/\bsecondo(?:\s*piatto)?\b\s*[:\-]?\s*/i, allergenKey:"secondoA" },
    { key:"contorno", re:/\bcontorno\b\s*[:\-]?\s*/i, allergenKey:null },
    { key:"frutta", re:/\bfrutta\b\s*[:\-]?\s*/i, allergenKey:null },
    { key:"merenda", re:/\bmerenda\b\s*[:\-]?\s*/i, allergenKey:"merendaA" }
  ];

  function parseMenuText(text){
    var weeks=[{name:"Prima settimana",days:emptyDays()},{name:"Seconda settimana",days:emptyDays()},{name:"Terza settimana",days:emptyDays()},{name:"Quarta settimana",days:emptyDays()}];
    var weekIdx=0, dayId="lunedi";
    String(text||"").split(/\n+/).forEach(function(line){
      line=line.trim(); if(!line) return;
      var low=line.toLowerCase();
      if(/(?:^|[^a-z])(?:1|i|prima)\s*settimana/.test(low) || /settimana\s*(?:1|i)(?:[^a-z]|$)/.test(low)) weekIdx=0;
      if(/(?:^|[^a-z])(?:2|ii|seconda)\s*settimana/.test(low) || /settimana\s*(?:2|ii)(?:[^a-z]|$)/.test(low)) weekIdx=1;
      if(/(?:^|[^a-z])(?:3|iii|terza)\s*settimana/.test(low) || /settimana\s*(?:3|iii)(?:[^a-z]|$)/.test(low)) weekIdx=2;
      if(/(?:^|[^a-z])(?:4|iv|quarta)\s*settimana/.test(low) || /settimana\s*(?:4|iv)(?:[^a-z]|$)/.test(low)) weekIdx=3;
      if(/luned/.test(low)) dayId="lunedi";
      if(/marted/.test(low)) dayId="martedi";
      if(/mercoled/.test(low)) dayId="mercoledi";
      if(/gioved/.test(low)) dayId="giovedi";
      if(/venerd/.test(low)) dayId="venerdi";
      var slot=weeks[weekIdx].days[dayId]; if(!slot) return;
      var stripped=line.replace(DAY_RE," ").replace(/\s+/g," ").trim();
      if(!stripped||/^settimana/i.test(stripped)||/^\d+\s*settimana/i.test(stripped)) return;

      var matchedLabel=null;
      for (var i=0;i<LABELS.length;i++){
        if (LABELS[i].re.test(stripped)) { matchedLabel = LABELS[i]; break; }
      }
      if (matchedLabel){
        var rest=stripped.replace(matchedLabel.re,"").trim();
        var extracted=extractAllergens(rest);
        if (extracted.dish.length>=2 && !/^menu$/i.test(extracted.dish)){
          slot[matchedLabel.key]=extracted.dish;
          if (matchedLabel.allergenKey && extracted.allergens) slot[matchedLabel.allergenKey]=extracted.allergens;
        }
        return;
      }

      // Nessuna etichetta trovata: ripulisci e usa il vecchio comportamento (riempi il primo slot libero, in ordine).
      var dish=stripped.replace(/\bprimo(?:\s*piatto)?\b|\bsecondo(?:\s*piatto)?\b|\bcontorno\b|\bfrutta\b|\bmerenda\b/ig," ").replace(/\s+/g," ").trim();
      if(!dish||dish.length<3||/settimana|allergen|^menu$/i.test(dish)) return;
      var ex=extractAllergens(dish);
      dish=ex.dish;
      if(!dish||dish.length<3) return;
      if(!slot.primo){ slot.primo=dish; if(ex.allergens) slot.primoA=ex.allergens; }
      else if(!slot.secondo){ slot.secondo=dish; if(ex.allergens) slot.secondoA=ex.allergens; }
      else if(!slot.contorno) slot.contorno=dish;
      else if(!slot.frutta) slot.frutta=dish;
      else if(!slot.merenda){ slot.merenda=dish; if(ex.allergens) slot.merendaA=ex.allergens; }
    });
    return weeks;
  }
  function showReview(text){
    window.__parsedWeeks=parseMenuText(text);
    document.getElementById("importWork").innerHTML +=
      '<div class="meal-card"><h2>Testo riconosciuto</h2><p class="status">Correggi se serve, poi salva. Se il risultato non ti convince, prova il box "Importa da JSON" qui sotto.</p>'+
      '<div class="field"><label>Nome menu</label><input id="imp-title-name" value="'+esc((document.getElementById("imp-name")&&document.getElementById("imp-name").value)||"Nuovo menu")+'"></div>'+
      '<div class="field"><label>Testo grezzo</label><textarea id="imp-raw">'+esc(text)+"</textarea></div>"+
      '<button class="btn btn-ghost btn-wide" id="reparse">Ri-analizza</button>'+
      '<button class="btn btn-primary btn-wide" id="applyParse">Salva come nuovo menu</button></div>';
    document.getElementById("reparse").onclick=function(){ window.__parsedWeeks=parseMenuText(document.getElementById("imp-raw").value); toast("Aggiornato"); };
    document.getElementById("applyParse").onclick=function(){
      var name=(document.getElementById("imp-title-name").value||"Nuovo menu").trim();
      var created=makeMenu({name:name,weeks:window.__parsedWeeks});
      state.menus.push(created); state.activeId=created.id; saveLibrary();
      toast("Nuovo menu: "+name); goTab("settimane"); renderAll();
    };
  }

  // --- Import da JSON precompilato (manuale o generato con un'altra AI) ---
  function normalizeMealShape(sd){
    sd = sd || {};
    return {
      primo:String(sd.primo||"").trim(), primoA:String(sd.primoA||"").trim(),
      secondo:String(sd.secondo||"").trim(), secondoA:String(sd.secondoA||"").trim(),
      contorno:String(sd.contorno||"").trim(), frutta:String(sd.frutta||"").trim(),
      merenda:String(sd.merenda||"").trim(), merendaA:String(sd.merendaA||"").trim()
    };
  }
  function validateAndNormalizeMenuJson(obj){
    if(!obj || typeof obj!=="object") throw new Error("il file non contiene un oggetto JSON");
    var name=(obj.name||"Nuovo menu").toString().trim() || "Nuovo menu";
    var period=(obj.period||"").toString().trim();
    var srcWeeks=Array.isArray(obj.weeks)?obj.weeks:[];
    var weekNames=["Prima settimana","Seconda settimana","Terza settimana","Quarta settimana"];
    var weeks=weekNames.map(function(wn,i){
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
    if(nameInput && nameInput.value.trim()) norm.name=nameInput.value.trim();
    var created=makeMenu(norm);
    state.menus.push(created); state.activeId=created.id; saveLibrary();
    toast("Menu importato da JSON: "+created.name); goTab("settimane"); renderAll();
  }
  function applyJsonText(raw){
    try{
      var obj=JSON.parse(raw);
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
    if(!box) return;
    var done=function(){ toast("Prompt copiato"); };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(box.value).then(done).catch(function(){ fallbackCopy(box); });
    } else {
      fallbackCopy(box);
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
