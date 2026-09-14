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
  function toast(msg){ var el = document.getElementById("toast"); if (!el) return; el.textContent = msg; el.classList.add("show"); setTimeout(function(){ el.classList.remove("show"); }, 2000); }
  function goTab(name){ if (window.setTab) window.setTab(name); }

  function renderHeader(){
    var pick = document.getElementById("menuPick");
    if (!pick) return;
    if (!state.menus.length) { pick.innerHTML = "<option>Aggiungi un menu</option>"; pick.disabled = true; document.getElementById("periodPill").textContent = "Vuoto"; return; }
    pick.disabled = false;
    pick.innerHTML = state.menus.map(function(item){ return "<option value="+JSON.stringify(item.id)+(item.id===state.activeId?" selected":"")+">"+esc(item.name)+"</option>"; }).join("");
    var m = currentMenu();
    document.getElementById("periodPill").textContent = (m && (m.period || m.name)) || "Senza periodo";
  }
  function mealHtml(d, weekIdx, dayId){
    var rows = [["Primo",d.primo],["Secondo",d.secondo],["Contorno",d.contorno],["Frutta",d.frutta],["Merenda",d.merenda]].filter(function(x){ return x[1]; });
    var body = rows.length ? rows.map(function(x){ return "<div class=course><div><div class=label>"+x[0]+"</div><div class=dish>"+esc(x[1])+"</div></div></div>"; }).join("") : "<p class=status>Giorno vuoto. Tocca Correggi.</p>";
    return "<article class=meal-card><h2>"+DAYS.find(function(x){return x.id===dayId;}).label+" <button class=edit-btn data-edit="+weekIdx+":"+dayId+">Correggi</button></h2>"+body+"</article>";
  }
  function renderOggi(){
    var box = document.getElementById("screen-oggi");
    var m = currentMenu();
    if (!m) return;
    var now = new Date();
    var map = {1:"lunedi",2:"martedi",3:"mercoledi",4:"giovedi",5:"venerdi"};
    var dayId = map[now.getDay()];
    var week = Math.min(3, Math.floor((now.getDate()-1)/7));
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
      var name = ((el && el.value.trim()) || prompt("Nome del menu") || "Nuovo menu").trim();
      var created = makeMenu({ name:name });
      state.menus.push(created); state.activeId = created.id; saveLibrary();
      toast("Creato: "+created.name); goTab("settimane"); renderAll();
    };
  }
  function renderInfo(){
    var box = document.getElementById("screen-info");
    if (!state.menus.length) { box.innerHTML = "<div class=note>Ancora nessun menu. Vai su Importa.</div>"; return; }
    box.innerHTML = "<h3 style='font-family:Fraunces,serif'>I tuoi menu</h3>"+state.menus.map(function(item){
      return "<div class=allergen-row style='justify-content:space-between'><b>"+esc(item.name)+"</b><span><button class=edit-btn data-use="+item.id+">Apri</button> <button class=edit-btn data-del="+item.id+">Elimina</button></span></div>";
    }).join("");
  }
  function bind(){
    document.querySelectorAll("[data-edit]").forEach(function(b){ b.onclick = function(){ openEdit(b.getAttribute("data-edit")); }; });
    document.querySelectorAll("[data-week]").forEach(function(b){ b.onclick = function(){ state.week=+b.getAttribute("data-week"); renderSettimane(); bind(); }; });
    document.querySelectorAll("[data-day]").forEach(function(b){ b.onclick = function(){ state.day=b.getAttribute("data-day"); renderSettimane(); bind(); }; });
    document.querySelectorAll("[data-use]").forEach(function(b){ b.onclick = function(){ state.activeId=b.getAttribute("data-use"); saveLibrary(); renderAll(); }; });
    document.querySelectorAll("[data-del]").forEach(function(b){ b.onclick = function(){ if(!confirm("Eliminare?"))return; state.menus=state.menus.filter(function(x){return x.id!==b.getAttribute("data-del");}); state.activeId=state.menus[0]&&state.menus[0].id; saveLibrary(); renderAll(); }; });
    var pick = document.getElementById("menuPick");
    if (pick) pick.onchange = function(){ if(pick.value){ state.activeId=pick.value; saveLibrary(); renderAll(); } };
    wireImport();
  }
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
      '<button class="btn btn-ghost btn-wide" id="btnBlank">Crea menu vuoto da compilare</button>';
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
        document.getElementById("preview").innerHTML='<img alt="Anteprima" src="'+c.toDataURL("image/jpeg",0.9)+'">';
        if(text.replace(/\s+/g,"").length<50) text=await runOcr(c.toDataURL("image/jpeg",0.92));
      } else {
        setStatus("Preparo la foto...",10);
        var url=URL.createObjectURL(file);
        document.getElementById("preview").innerHTML='<img alt="Anteprima" src="'+url+'">';
        text=await runOcr(url);
      }
      showReview(text);
    }catch(err){ setStatus("Errore: "+err.message); showReview(""); }
  }
  async function runOcr(url){
    setStatus("Carico riconoscimento...",15);
    if(!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    if(!tessWorker) tessWorker=await Tesseract.createWorker("ita",1,{logger:function(m){ if(m.status==="recognizing text") setStatus("Riconoscimento... "+Math.round((m.progress||0)*100)+"%",20+(m.progress||0)*70); }});
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
  function parseMenuText(text){
    var weeks=[{name:"Prima settimana",days:emptyDays()},{name:"Seconda settimana",days:emptyDays()},{name:"Terza settimana",days:emptyDays()},{name:"Quarta settimana",days:emptyDays()}];
    var weekIdx=0, dayId="lunedi";
    String(text||"").split(/\n+/).forEach(function(line){
      line=line.trim(); if(!line) return;
      var low=line.toLowerCase();
      if(/1\s*settimana|prima settimana/.test(low)) weekIdx=0;
      if(/2\s*settimana|second/.test(low)) weekIdx=1;
      if(/3\s*settimana|terza settimana/.test(low)) weekIdx=2;
      if(/4\s*settimana|quarta settimana/.test(low)) weekIdx=3;
      if(/luned/.test(low)) dayId="lunedi";
      if(/marted/.test(low)) dayId="martedi";
      if(/mercoled/.test(low)) dayId="mercoledi";
      if(/gioved/.test(low)) dayId="giovedi";
      if(/venerd/.test(low)) dayId="venerdi";
      var slot=weeks[weekIdx].days[dayId]; if(!slot) return;
      var dish=line.replace(/luned[i]|marted[i]|mercoled[i]|gioved[i]|venerd[i]|primo|secondo|contorno|frutta|merenda/ig," ").replace(/\s+/g," ").trim();
      if(!dish||dish.length<3||/settimana|allergen|menu/i.test(dish)) return;
      if(!slot.primo) slot.primo=dish; else if(!slot.secondo) slot.secondo=dish; else if(!slot.contorno) slot.contorno=dish; else if(!slot.frutta) slot.frutta=dish; else if(!slot.merenda) slot.merenda=dish;
    });
    return weeks;
  }
  function showReview(text){
    window.__parsedWeeks=parseMenuText(text);
    document.getElementById("importWork").innerHTML +=
      '<div class="meal-card"><h2>Testo riconosciuto</h2><p class="status">Correggi se serve, poi salva.</p>'+
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
  if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(function(){});
  renderAll();
})();
