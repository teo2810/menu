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
  var API_BASE = "https://menu-api.teofalce.workers.dev";
  var OFFICIAL_INDEX = "./data/menus.json";
  var OFFICIAL_STORE = "menu-official-cache-v1";
  var CLOUD_KEY_STORE = "menu-cloud-key-v1";
  var CLOUD_META_STORE = "menu-cloud-meta-v1";
  var cloudRevision = 0, cloudApplying = false, cloudTimer = null, cloudBusy = false;

  function loadOfficialCache(){
    try { return JSON.parse(localStorage.getItem(OFFICIAL_STORE) || "[]"); } catch(e) { return []; }
  }
  function saveOfficialCache(items){
    try { localStorage.setItem(OFFICIAL_STORE, JSON.stringify(items || [])); } catch(e) {}
  }
  function mergeOfficialMenus(items){
    if (!Array.isArray(items)) return false;
    var changed = false;
    items.forEach(function(remote){
      if (!remote || !remote.id || !Array.isArray(remote.weeks)) return;
      remote._official = true;
      var i = state.menus.findIndex(function(x){ return x.id === remote.id; });
      if (i < 0) { state.menus.push(remote); changed = true; }
      else if (state.menus[i]._official && JSON.stringify(state.menus[i]) !== JSON.stringify(remote)) {
        state.menus[i] = remote; changed = true;
      }
    });
    if (changed) {
      if (!state.activeId && state.menus[0]) state.activeId = state.menus[0].id;
      saveLibrary();
    }
    return changed;
  }
  async function syncOfficialMenus(){
    try {
      var res = await fetch(OFFICIAL_INDEX, { cache:"no-store" });
      if (!res.ok) throw new Error("catalog");
      var catalog = await res.json();
      var entries = Array.isArray(catalog) ? catalog : (catalog.menus || []);
      var menus = await Promise.all(entries.map(async function(entry){
        if (entry && entry.weeks) return entry;
        if (!entry || !entry.file) return null;
        var r = await fetch(entry.file, { cache:"no-store" });
        return r.ok ? r.json() : null;
      }));
      menus = menus.filter(Boolean);
      saveOfficialCache(menus);
      if (mergeOfficialMenus(menus)) renderAll();
    } catch(e) {
      mergeOfficialMenus(loadOfficialCache());
    }
  }
  async function submitReport(menuId, context, message, website){
    var res = await fetch(API_BASE + "/api/reports", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({menu_id:menuId, context:context, message:message, website:website || ""})
    });
    var data = {};
    try { data = await res.json(); } catch(e) {}
    if (!res.ok || !data.ok) throw new Error(data.error || "Invio non riuscito");
    return data;
  }
  function getGeminiKey(){
    try { return (localStorage.getItem(GEMINI_STORE) || "").trim(); } catch (e) { return ""; }
  }
  var DEFAULT_SECTIONS=[{id:"primo",label:"Primo"},{id:"secondo",label:"Secondo"},{id:"contorno",label:"Contorno"},{id:"frutta",label:"Frutta"},{id:"merenda",label:"Merenda"}];
  function sectionsOf(menu){ return menu && Array.isArray(menu.sections) && menu.sections.length ? menu.sections : DEFAULT_SECTIONS; }
  function sectionId(label,i){
    var known={primo:"primo",secondo:"secondo",contorno:"contorno",frutta:"frutta",merenda:"merenda"};
    var low=String(label||"").trim().toLowerCase();
    if(known[low]) return known[low];
    var slug=low.normalize ? low.normalize("NFD").replace(/[\u0300-\u036f]/g,"") : low;
    slug=slug.replace(/[^a-z0-9]+/g,"").slice(0,24);
    return slug || ("section"+(i+1));
  }
  function meal(sections){
    var o={};
    (sections||DEFAULT_SECTIONS).forEach(function(sec){ o[sec.id]=""; o[sec.id+"A"]=""; });
    return o;
  }
  function ensureMealShape(day,sections){
    day=day||{};
    sectionsOf({sections:sections}).forEach(function(sec){
      if(day[sec.id]==null) day[sec.id]="";
      if(day[sec.id+"A"]==null) day[sec.id+"A"]="";
    });
    return day;
  }
  function aKeyOf(course){ return course + "A"; }
  function emptyDays(sections){ var o={}; DAYS.forEach(function(d){ o[d.id]=meal(sections); }); return o; }
  function makeMenu(p){
    p = p || {};
    return {
      schemaVersion: 2,
      id: p.id || ("menu-" + Date.now()),
      name: p.name || "Nuovo menu",
      type: p.type || "school",
      period: p.period || "",
      validFrom: p.validFrom || "",
      validTo: p.validTo || "",
      cycle: p.cycle || { mode:"weekly", weeks:4 },
      sections: Array.isArray(p.sections) && p.sections.length ? p.sections : DEFAULT_SECTIONS.slice(),
      weeks: p.weeks || [
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
  function saveLibrary(){
    localStorage.setItem(STORE, JSON.stringify({ menus:state.menus, activeId:state.activeId }));
    if (!cloudApplying && getCloudKey()) queueCloudSave();
  }
  function getCloudKey(){ try{return (localStorage.getItem(CLOUD_KEY_STORE)||"").trim();}catch(e){return "";} }
  function getCloudMeta(){ try{return JSON.parse(localStorage.getItem(CLOUD_META_STORE)||"null")||{};}catch(e){return {};} }
  function setCloudMeta(x){ try{localStorage.setItem(CLOUD_META_STORE,JSON.stringify(x||{}));}catch(e){} }
  async function fingerprint(obj){
    var data=new TextEncoder().encode(JSON.stringify(obj));
    var hash=await crypto.subtle.digest("SHA-256",data);
    return Array.from(new Uint8Array(hash)).map(function(b){return b.toString(16).padStart(2,"0");}).join("");
  }
  async function cloudRequest(method,payload){
    var key=getCloudKey(); if(!key) throw new Error("Chiave sync mancante");
    var opt={method:method,headers:{"X-Menu-Key":key,"Content-Type":"application/json"},cache:"no-store"};
    if(payload) opt.body=JSON.stringify(payload);
    var r=await fetch(API_BASE+"/api/library",opt), d={}; try{d=await r.json();}catch(e){}
    if(r.status===401) throw new Error("Chiave sync non valida");
    if(!r.ok) { var er=new Error(d.error||("HTTP "+r.status)); er.status=r.status; er.data=d; throw er; }
    return d;
  }
  function uniqueId(base,used){ var id=base||("menu-"+Date.now()); var n=1; while(used[id]) id=(base||"menu")+"-locale-"+(n++); used[id]=1; return id; }
  function mergeCloudPayload(local,remote){
    var out=[], used={};
    (remote.menus||[]).forEach(function(m){out.push(m);used[m.id]=1;});
    (local.menus||[]).forEach(function(m){
      var r=out.find(function(x){return x.id===m.id;});
      if(!r){out.push(m);used[m.id]=1;return;}
      if(JSON.stringify(r)===JSON.stringify(m)) return;
      var copy=JSON.parse(JSON.stringify(m)); copy.id=uniqueId(m.id,used); copy.name=(copy.name||"Menu")+" (copia locale)"; out.push(copy);
    });
    var active=local.activeId && out.some(function(m){return m.id===local.activeId;}) ? local.activeId : (remote.activeId|| (out[0]&&out[0].id)||null);
    return {kind:"menu-library",version:2,menus:out,activeId:active};
  }
  function applyCloudPayload(p){
    cloudApplying=true;
    try{ state.menus=Array.isArray(p.menus)?p.menus:[]; state.activeId=p.activeId&&state.menus.some(function(m){return m.id===p.activeId;})?p.activeId:(state.menus[0]&&state.menus[0].id)||null; saveLibrary(); }
    finally{cloudApplying=false;}
  }
  async function syncCloud(silent){
    if(cloudBusy||!getCloudKey()||!navigator.onLine) return; cloudBusy=true;
    try{
      var remote=await cloudRequest("GET"), local=libraryPayload(), meta=getCloudMeta();
      cloudRevision=remote.revision||0; var localFp=await fingerprint(local);
      if(!cloudRevision){
        var created=await cloudRequest("PUT",Object.assign({},local,{baseRevision:0})); cloudRevision=created.revision||1; setCloudMeta({revision:cloudRevision,fingerprint:localFp});
      } else if(meta.revision===cloudRevision && meta.fingerprint===localFp){
        // already aligned
      } else if(meta.revision===cloudRevision && meta.fingerprint && meta.fingerprint!==localFp){
        var pushed=await cloudRequest("PUT",Object.assign({},local,{baseRevision:cloudRevision})); cloudRevision=pushed.revision; setCloudMeta({revision:cloudRevision,fingerprint:localFp});
      } else if(meta.fingerprint===localFp){
        applyCloudPayload(remote); var rf=await fingerprint(libraryPayload()); setCloudMeta({revision:cloudRevision,fingerprint:rf}); renderAll();
      } else {
        var merged=mergeCloudPayload(local,remote); applyCloudPayload(merged); var mf=await fingerprint(libraryPayload());
        var saved=await cloudRequest("PUT",Object.assign({},libraryPayload(),{baseRevision:cloudRevision})); cloudRevision=saved.revision; setCloudMeta({revision:cloudRevision,fingerprint:mf}); renderAll();
      }
      if(!silent) toast("Menu sincronizzati");
    }catch(e){ if(!silent) toast(e.message||"Sync non riuscita"); }finally{cloudBusy=false; renderCloudStatus();}
  }
  function queueCloudSave(){ clearTimeout(cloudTimer); cloudTimer=setTimeout(function(){syncCloud(true);},900); }
  function renderCloudStatus(){ var el=document.getElementById("cloudStatus"); if(!el)return; el.textContent=!getCloudKey()?"Non attiva":(!navigator.onLine?"Offline · modifiche salvate sul dispositivo":(cloudBusy?"Sincronizzazione…":"Attiva")); }
  function cloudCardHtml(){
    var on=!!getCloudKey();
    var status=on?(navigator.onLine?"Sincronizzato":"Offline") : "Non attivo";
    return "<details class='settings-panel' "+(on?"":"open")+"><summary><span><b>Sincronizzazione</b><small id=cloudStatus>"+status+"</small></span><i></i></summary><div class=panel-body>"+
      (on?"<div class=compact-actions><button type=button class='btn btn-primary' id=cloudSync>Sincronizza ora</button><button type=button class='btn btn-ghost' id=cloudDisconnect>Disconnetti</button></div>":"<div class=field><label>Chiave privata</label><input id=cloudKey type=password autocomplete=off placeholder='Chiave di sincronizzazione'></div><button type=button class='btn btn-primary btn-wide' id=cloudConnect>Attiva sincronizzazione</button>")+"</div></details>";
  }
  function currentMenu(){ return state.menus.find(function(m){ return m.id === state.activeId; }) || state.menus[0] || null; }
  function esc(s){
    return String(s || "").replace(/&/g,"&"+"amp;").replace(/</g,"&"+"lt;").replace(/>/g,"&"+"gt;").replace(/"/g,"&"+"quot;").replace(/'/g,"&#39;");
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
      return "<button type=button class='pick-row"+on+"' data-pick=\""+esc(item.id)+"\"><span>"+esc(item.name)+"</span><span class=pick-dot></span></button>";
    }).join("");
    box.querySelectorAll("[data-pick]").forEach(function(b){
      b.onclick = function(){
        state.activeId = b.getAttribute("data-pick"); state.week=0; closeCellBar();
        saveLibrary();
        closeModal("pickModal");
        renderAll();
      };
    });
  }

  var ICON_FILES={
    primo:"primo.png",secondo:"secondo.png",contorno:"contorno.png",frutta:"frutta.png",merenda:"merenda.png",
    antipasto:"antipasto.svg",dolce:"dolce.svg",bevande:"bevande.svg",bevanda:"bevande.svg",
    insalata:"insalata.svg",pesce:"pesce.svg",formaggio:"formaggio.svg",pane:"pane.svg",
    yogurt:"yogurt.svg",acqua:"acqua.svg",succo:"succo.svg",zuppa:"zuppa.svg"
  };
  function iconForSection(sec){
    var id=String(sec&&sec.id||"").toLowerCase(), label=String(sec&&sec.label||"").toLowerCase();
    var aliases=[
      [/antipast|starter/,"antipasto"],[/dolce|dessert|torta|cake/,"dolce"],[/bev|drink/,"bevande"],
      [/insalat|verdura|salad/,"insalata"],[/pesc|fish/,"pesce"],[/formagg|cheese/,"formaggio"],
      [/pane|bread/,"pane"],[/yogurt/,"yogurt"],[/acqua|water/,"acqua"],[/succo|juice/,"succo"],[/zuppa|soup|minestra/,"zuppa"]
    ];
    var key=ICON_FILES[id]?id:"";
    if(!key) aliases.some(function(x){if(x[0].test(label)){key=x[1];return true;}return false;});
    if(key) return '<img src="icons/'+ICON_FILES[key]+'" alt="" width="36" height="36">';
    return '<span class=generic-food-icon aria-hidden=true>🍽</span>';
  }
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
        if (isOcrDraftOpen() && window.__importNorm.weeks[state.week||0]) {
          var p0 = cellBarKey ? cellBarKey.split(":") : [state.week, state.day];
          if (window.__importNorm.weeks[p0[0]] && window.__importNorm.weeks[p0[0]].days[p0[1]]) {
            window.__importNorm.weeks[p0[0]].days[p0[1]][field] = codes;
          }
        } else if (state.edit && currentMenu() && currentMenu().weeks[state.edit.w]) {
          currentMenu().weeks[state.edit.w].days[state.edit.d][field] = codes;
        } else if (cellBarKey) {
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

  function parseDateOnly(v){ if(!v) return null; var p=String(v).split("-"); if(p.length!==3) return null; return new Date(+p[0],+p[1]-1,+p[2],12,0,0); }
  function menuIsValidOn(menu,date){
    var t=new Date(date.getFullYear(),date.getMonth(),date.getDate(),12).getTime();
    var a=parseDateOnly(menu.validFrom), b=parseDateOnly(menu.validTo);
    return (!a || t>=a.getTime()) && (!b || t<=b.getTime());
  }
  function weekIndexForDate(menu,date){
    var weeks=(menu.weeks||[]).length || 1;
    if(menu.cycle && menu.cycle.mode==="single") return 0;
    var start=parseDateOnly(menu.validFrom);
    if(start){
      var delta=Math.floor((new Date(date.getFullYear(),date.getMonth(),date.getDate(),12)-start)/604800000);
      return ((delta%weeks)+weeks)%weeks;
    }
    return (isoWeekNumber(date)-1)%weeks;
  }
  function validityText(menu){
    if(menu.validFrom && menu.validTo) return "Valido "+menu.validFrom+" → "+menu.validTo;
    if(menu.validFrom) return "Valido dal "+menu.validFrom;
    if(menu.validTo) return "Valido fino al "+menu.validTo;
    return "";
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
    pick.textContent = m ? m.name+" · Cambia menu" : "Scegli menu";
    document.getElementById("periodPill").textContent = (m && (periodFromDates(m.validFrom,m.validTo) || m.period)) || "Date non impostate";
  }
  function dishFilled(m,menu){
    return !!(m && sectionsOf(menu||currentMenu()).some(function(sec){ return String(m[sec.id]||"").trim(); }));
  }
  function weekFilled(w){
    return !!(w && DAYS.some(function(d){ return dishFilled(w.days && w.days[d.id], currentMenu()); }));
  }
  function filledWeekIdx(menu){
    var out=[];
    (menu && menu.weeks || []).forEach(function(w,i){ if (w && DAYS.some(function(d){return dishFilled(w.days&&w.days[d.id],menu);})) out.push(i); });
    return out;
  }
  function mealHtml(d, weekIdx, dayId){
    var m=currentMenu();
    var rows=sectionsOf(m).map(function(sec){ return [sec.id,sec.label,d&&d[sec.id],d&&d[sec.id+"A"]]; }).filter(function(x){return x[2];});
    var body=rows.length ? rows.map(function(x){
      var sec=sectionsOf(m).find(function(q){return q.id===x[0];}) || {id:x[0],label:x[1]}; var icon=iconForSection(sec);
      return "<div class=course data-course="+x[0]+"><div class='ico svg-"+x[0]+"'>"+icon+"</div><div class=course-body><div class=label>"+esc(x[1])+"</div><div class=dish>"+esc(x[2])+"</div><div class=hint>Tocca per gli allergeni</div></div>"+allergenBox(x[3])+"</div>";
    }).join("") : "<p class=status>Giorno vuoto. Tocca Correggi.</p>";
    var day=DAYS.find(function(x){return x.id===dayId;});
    return "<article class=meal-card><h2>"+esc(day?day.label:dayId)+" <button class=edit-btn data-edit="+weekIdx+":"+dayId+">Correggi</button></h2>"+body+"</article>";
  }
  function renderOggi(){
    var box = document.getElementById("screen-oggi");
    var m = currentMenu();
    if (!m) {box.innerHTML="<div class='meal-card empty'><h2>Nessun menu</h2><button class='btn btn-primary btn-wide' id=goImport>Importa il primo menu</button></div>";return;}
    var now = new Date();
    var map = {1:"lunedi",2:"martedi",3:"mercoledi",4:"giovedi",5:"venerdi"};
    var dayId = map[now.getDay()];
    var vis = filledWeekIdx(m);
    var calculated=weekIndexForDate(m,now); var week=vis.length===1 ? vis[0] : (vis.length ? (vis.indexOf(calculated)>=0?calculated:vis[calculated%vis.length]) : calculated);
    if(m.cycle&&m.cycle.mode==="single") week=0;
    var nice = now.toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"});
    var validity=validityText(m);
    if(!menuIsValidOn(m,now)){ box.innerHTML="<div class=hero-today><div class=kicker>"+esc(m.name)+"</div><h2>"+nice+"</h2></div><div class='meal-card empty'><h2>Menu non attivo oggi</h2><p class=status>"+esc(validity||"Controlla il periodo di validità.")+"</p></div>"; return; }
    box.innerHTML = "<div class=hero-today><div class=kicker>"+esc(m.name)+(validity?" · "+esc(validity):"")+"</div><h2>"+nice+"</h2></div>"+(dayId&&m.weeks[week]?mealHtml(m.weeks[week].days[dayId],week,dayId):"<div class=meal-card><p>Nessun menu previsto oggi.</p></div>");
  }
  function renderSettimane(){
    var box = document.getElementById("screen-settimane");
    var m = currentMenu();
    if (!m) { box.innerHTML = "<div class=meal-card empty><h2>Nessun menu</h2><button class='btn btn-primary btn-wide' id=goImport>Importa il primo menu</button></div>"; return; }
    if (!m.weeks[state.week]) state.week=0;
    var vis = m.cycle&&m.cycle.mode==="single" ? [0] : m.weeks.map(function(w,i){return i;});
    if (vis.length && vis.indexOf(state.week)<0) state.week = vis[0];
    var tabs = vis.length<=1 ? "" : m.weeks.map(function(w,i){
      if (vis.length && vis.indexOf(i)<0) return "";
      return "<button class='week-tab"+(i===state.week?" on":"")+"' data-week="+i+">"+esc(w.name.replace(" settimana",""))+"</button>";
    }).join("");
    var chips = DAYS.map(function(d){ return "<button class='day-chip"+(d.id===state.day?" on":"")+"' data-day="+d.id+"><small>"+d.short+"</small><b>"+d.label.slice(0,3)+"</b></button>"; }).join("");
    var emptyWeek = !DAYS.some(function(d){
      var mealObj = m.weeks[state.week].days[d.id];
      return mealObj && sectionsOf(m).some(function(sec){ return String(mealObj[sec.id]||"").trim(); });
    });
    var hint = emptyWeek
      ? '<div class="note">Menu vuoto: tocca una cella per scrivere, oppure torna a Importa per un JSON. Per cambiare menu usa il nome in alto.</div><button class="btn btn-ghost btn-wide" id="backImport">Torna a Importa</button>'
      : '<p class="status">Tocca una cella: si apre la riga sopra la tastiera.</p>';
    box.innerHTML = (tabs?"<div class=week-tabs>"+tabs+"</div>":"")+"<div class=day-rail>"+chips+"</div>"+mealHtml(m.weeks[state.week].days[state.day],state.week,state.day)+
      '<div class="meal-card"><h2>Tabella settimana</h2>'+hint+weekGridHtml(m.weeks[state.week], state.week, true)+"</div>";
  }
  function wireImport(){
    var exportSelected=document.getElementById("exportSelected"); if(exportSelected) exportSelected.onclick=exportSelectedMenus;
    var blank = document.getElementById("btnBlank");
    if (blank) blank.onclick = function(){
      var el = document.getElementById("imp-name");
      var name = ((el && el.value.trim()) || "Menu vuoto").trim();
      var kind=(document.getElementById("imp-type")||{}).value || "school";
      var cycle=kind==="event" ? {mode:"single",weeks:1} : {mode:"weekly",weeks:4};
      var secs=kind==="event" ? [{id:"antipasto",label:"Antipasto"},{id:"primo",label:"Primo"},{id:"secondo",label:"Secondo"},{id:"dolce",label:"Dolce"},{id:"bevande",label:"Bevande"}] : DEFAULT_SECTIONS.slice();
      var created = makeMenu({ name:name, type:kind, cycle:cycle, sections:secs, weeks:kind==="event"?[{name:"Menu",days:emptyDays(secs)}]:undefined });
      state.menus.push(created); state.activeId = created.id; saveLibrary();
      toast("Apri la tabella e tocca le celle"); goTab("settimane"); renderAll();
      offerLibraryCopy();
    };
    var jsonBtn = document.getElementById("btnJsonFile");
    var jsonFile = document.getElementById("fileJson");
    if (jsonBtn && jsonFile) jsonBtn.onclick = function(){ jsonFile.click(); };
    if (jsonFile) jsonFile.onchange = function(e){ handleLibraryPick(e.target.files[0]); e.target.value = ""; };
    var jsonApply = document.getElementById("applyJsonPaste");
    if (jsonApply) jsonApply.onclick = function(){ applyJsonText(document.getElementById("jsonPaste").value); };
    var copyBtn = document.getElementById("copyPrompt");
    if (copyBtn) copyBtn.onclick = function(){ copyPromptText(); };
    document.querySelectorAll("[data-save-copy]").forEach(function(b){
      b.onclick = function(){ offerLibraryCopy(); };
    });
    document.querySelectorAll("[data-load-copy]").forEach(function(b){
      b.onclick = function(){
        var inp = document.getElementById("fileLibrary");
        if (inp) inp.click();
      };
    });
    var libFile = document.getElementById("fileLibrary");
    if (libFile) libFile.onchange = function(e){ handleLibraryPick(e.target.files[0]); e.target.value = ""; };
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

  function formatDateIT(v){
    var d=parseDateOnly(v); if(!d) return "";
    return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear();
  }
  function typeLabel(v){ return ({school:"Scuola",work:"Lavoro",event:"Evento / festa",other:"Altro"})[v]||"Altro"; }
  function periodFromDates(a,b){
    if(a&&b) return formatDateIT(a)+" – "+formatDateIT(b);
    if(a) return "Dal "+formatDateIT(a);
    if(b) return "Fino al "+formatDateIT(b);
    return "";
  }
  function activeMenuBannerHtml(){
    var m=currentMenu(); if(!m) return "";
    var dates=periodFromDates(m.validFrom,m.validTo), period=dates||(m.period||"Nessun periodo impostato");
    var sync=getCloudKey()?(navigator.onLine?"Cloud attivo":"Offline"):"Solo dispositivo";
    return "<section class='active-menu-banner'><div class=active-menu-kicker>MENU ATTIVO <span>"+esc(sync)+"</span></div><h2>"+esc(m.name)+"</h2><div class=active-menu-meta><b>"+esc(typeLabel(m.type))+"</b><span>"+esc(period)+"</span></div><button type=button class='btn btn-ghost btn-wide' id=changeActiveMenu>Cambia menu</button></section>";
  }
  function choiceHtml(name,value,items){
    return "<div class=choice-row data-choice="+name+">"+items.map(function(x){return "<button type=button class='choice-chip"+(x[0]===value?" on":"")+"' data-value='"+x[0]+"'>"+esc(x[1])+"</button>";}).join("")+"<input type=hidden id="+name+" value='"+esc(value)+"'></div>";
  }
  function periodDescription(menu){
    var text=String(menu.period||"").trim();
    var dates=periodFromDates(menu.validFrom,menu.validTo);
    return dates && text===dates ? "" : text;
  }
  function menuSettingsCardHtml(){
    var m=currentMenu(); if(!m) return "";
    var type=m.type||"school", cycle=(m.cycle&&m.cycle.mode)||"weekly";
    return "<details class='settings-panel'><summary><span><b>Impostazioni menu</b><small>"+esc(typeLabel(type))+" · "+(cycle==="weekly"?esc((m.weeks||[]).length+" settimane"):"menu singolo")+"</small></span><i></i></summary><div class=panel-body>"+
      "<div class=field><label for=menuName>Nome menu</label><input id=menuName maxlength=200 value=\""+esc(m.name)+"\"></div>"+
      "<div class=field><label>Tipo</label>"+choiceHtml("menuType",type,[["school","Scuola"],["work","Lavoro"],["event","Evento"],["other","Altro"]])+"</div>"+
      "<div class=field><label>Ciclo</label>"+choiceHtml("menuCycle",cycle,[["weekly","Settimanale"],["single","Singolo"]])+"</div>"+
      "<div class=compact-grid><div class=field><label for=menuValidFrom>Dal</label><input id=menuValidFrom type=date value='"+esc(m.validFrom||"")+"'></div><div class=field><label for=menuValidTo>Al</label><input id=menuValidTo type=date value='"+esc(m.validTo||"")+"'></div></div>"+
      "<div class=field><label>Descrizione <small>facoltativa, senza ripetere le date</small></label><input id=menuPeriod value='"+esc(periodDescription(m))+"' placeholder='Es. Menu invernale'></div>"+
      "<div class=field><label>Sezioni</label><input id=menuSections value='"+esc(sectionsOf(m).map(function(x){return x.label;}).join(", "))+"' placeholder='Primo, Secondo, Contorno'></div>"+
      "<button type=button class='btn btn-primary btn-wide' id=saveMenuSettings>Salva impostazioni</button></div></details>";
  }
  var admin={key:"",reports:[],filter:"open",offset:0,more:false,busy:false,error:"",connected:false};
  function adminCardHtml(){
    return "<details class='settings-panel' id=adminPanel><summary><span><b>Admin · Segnalazioni</b><small>Leggi, risolvi e riapri le segnalazioni</small></span><i></i></summary><div class=panel-body id=adminBody></div></details>";
  }
  async function adminRequest(method,path,body){
    var controller=new AbortController(), timer=setTimeout(function(){controller.abort();},15000);
    try{
      var r=await fetch(API_BASE+"/api/admin/reports"+path,{method:method,headers:{"X-Menu-Admin-Key":admin.key,"Content-Type":"application/json"},cache:"no-store",signal:controller.signal,body:body?JSON.stringify(body):undefined});
      var d=await r.json().catch(function(){return {};});
      if(r.status===401){admin.key="";admin.connected=false;admin.reports=[];throw new Error("Chiave Admin non valida");}
      if(r.status===404) throw new Error(method==="GET"?"Area Admin non disponibile: aggiorna il Worker Cloudflare.":"Segnalazione non trovata. Aggiorna l’elenco.");
      if(!r.ok||!d.ok) throw new Error(d.error||("Errore "+r.status));
      return d;
    }catch(e){if(e.name==="AbortError")throw new Error("Connessione scaduta. Riprova.");throw e;}
    finally{clearTimeout(timer);}
  }
  async function loadReports(reset){
    if(admin.busy)return;
    admin.busy=true;admin.error="";paintAdmin();
    var offset=reset?0:admin.offset;
    try{
      var d=await adminRequest("GET","?status="+encodeURIComponent(admin.filter)+"&offset="+offset);
      if(!Array.isArray(d.reports))throw new Error("Risposta Admin non valida");
      admin.reports=reset?d.reports:admin.reports.concat(d.reports);
      admin.offset=offset+d.reports.length;admin.more=!!d.hasMore;admin.connected=true;
    }catch(e){admin.error=e.message;}
    finally{admin.busy=false;paintAdmin();}
  }
  function paintAdmin(){
    var box=document.getElementById("adminBody");if(!box)return;
    if(!admin.connected){
      box.innerHTML="<p class=status>Usa la chiave Admin, distinta dalla chiave di sincronizzazione. Resta in memoria solo fino alla chiusura della pagina.</p><div class=field><label for=adminKey>Chiave Admin</label><input id=adminKey type=password autocomplete=off></div><button type=button class='btn btn-primary btn-wide' id=adminLogin "+(admin.busy?"disabled":"")+">"+(admin.busy?"Accesso…":"Accedi")+"</button><p class=admin-message role=status>"+esc(admin.error)+"</p>";
      document.getElementById("adminLogin").onclick=function(){var key=document.getElementById("adminKey").value.trim();if(!key){toast("Inserisci la chiave Admin");return;}admin.key=key;loadReports(true);};
      return;
    }
    box.innerHTML="<div class=field><label for=adminFilter>Mostra</label><select id=adminFilter "+(admin.busy?"disabled":"")+"><option value=open>Aperte</option><option value=resolved>Risolte</option><option value=all>Tutte</option></select></div><div class=admin-controls><button type=button class='btn btn-ghost' id=adminRefresh>Aggiorna</button><button type=button class='btn btn-ghost' id=adminLogout>Esci</button></div><p class=admin-message role=status>"+esc(admin.busy?"Caricamento…":admin.error||admin.reports.length+" segnalazioni caricate")+"</p>"+
      admin.reports.map(function(r,i){var m=state.menus.find(function(x){return x.id===r.menu_id;});return "<article class=admin-report><b>"+esc(m?m.name:r.menu_id)+"</b><br><small>#"+esc(r.id)+" · "+esc(r.created_at)+" · "+(r.status==="resolved"?"Risolta":"Aperta")+"</small><p>"+esc(r.context)+"</p><p>"+esc(r.message)+"</p><button type=button class='btn btn-ghost btn-wide' data-report-index='"+i+"' "+(admin.busy?"disabled":"")+">"+(r.status==="resolved"?"Riapri":"Segna come risolta")+"</button></article>";}).join("")+
      (!admin.reports.length&&!admin.busy&&!admin.error?"<p class=status>Nessuna segnalazione per questo filtro.</p>":"")+(admin.more?"<button type=button class='btn btn-ghost btn-wide' id=adminMore>Carica altre</button>":"");
    var filter=document.getElementById("adminFilter");filter.value=admin.filter;
    filter.onchange=function(){admin.filter=filter.value;admin.reports=[];loadReports(true);};
    document.getElementById("adminRefresh").onclick=function(){loadReports(true);};
    document.getElementById("adminLogout").disabled=admin.busy;
    document.getElementById("adminLogout").onclick=function(){admin.key="";admin.connected=false;admin.reports=[];admin.error="";paintAdmin();};
    var more=document.getElementById("adminMore");if(more){more.disabled=admin.busy;more.onclick=function(){loadReports(false);};}
    box.querySelectorAll("[data-report-index]").forEach(function(b){b.onclick=async function(){
      if(admin.busy)return;var report=admin.reports[Number(b.dataset.reportIndex)];
      admin.busy=true;admin.error="";paintAdmin();
      try{await adminRequest("PATCH","/"+encodeURIComponent(report.id),{status:report.status==="resolved"?"open":"resolved"});admin.busy=false;await loadReports(true);}
      catch(e){admin.error=e.message;admin.busy=false;paintAdmin();}
    };});
  }
  function wireAdmin(){paintAdmin();}

  function reportCardHtml(){
    var m=currentMenu(); if(!m) return "";
    return "<details class='settings-panel'><summary><span><b>Segnala un problema</b><small>Invio anonimo</small></span><i></i></summary><div class=panel-body>"+
      "<div class=field><label>Riferimento</label><input id=reportContext maxlength=500 placeholder='Es. Seconda settimana · Martedi'></div>"+
      "<div class=field><label>Problema</label><textarea class=compact-textarea id=reportMessage maxlength=1000 placeholder='Descrivi cosa non torna'></textarea></div>"+
      "<input id=reportWebsite tabindex=-1 autocomplete=off aria-hidden=true style='position:absolute;left:-9999px;width:1px;height:1px'>"+
      "<button type=button class='btn btn-primary btn-wide' id=sendReport>Invia segnalazione</button></div></details>";
  }
  function renderInfo(){
    var box=document.getElementById("screen-info");
    var list=state.menus.length ? state.menus.map(function(item){
      var active=item.id===state.activeId?" active":"";
      return "<div class='menu-manage-row"+active+"'><button type=button class='menu-select' data-use=\""+esc(item.id)+"\" aria-pressed='"+!!active+"'><b>"+esc(item.name)+"</b><small>"+(active?"Attivo":"Usa questo menu")+"</small></button><button type=button class='ico-btn danger' data-del=\""+esc(item.id)+"\" aria-label=\"Elimina "+esc(item.name)+"\"><svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' aria-hidden='true'><path d='M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13'/></svg></button></div>";
    }).join("") : "<p class=status>Ancora nessun menu.</p>";
    var dataPanel="<details class='settings-panel'><summary><span><b>Dati e backup</b><small>Esporta o ripristina i menu</small></span><i></i></summary><div class=panel-body><div class=compact-actions><button type=button class='btn btn-primary' data-save-copy>Salva copia</button><button type=button class='btn btn-ghost' data-load-copy>Carica copia</button></div>"+exportCardHtml().replace('class=\"meal-card export-card\"','class=\"embedded-export export-card\"')+"<input id='fileLibrary' type='file' accept='.json,application/json' hidden></div></details>";
    box.innerHTML="<div class='info-title'><h2>Menu e impostazioni</h2><p>Scegli il menu e personalizza l’app</p></div>"+activeMenuBannerHtml()+
      "<section class='settings-card'><div class='settings-head'><b>I tuoi menu</b><span>"+state.menus.length+"</span></div><div class=menu-manage-list>"+list+"</div></section>"+
      "<section class='settings-card settings-stack'>"+cloudCardHtml()+menuSettingsCardHtml()+dataPanel+reportCardHtml()+adminCardHtml()+"</section>"+
      "<section class='settings-card tint-compact'>"+tintCardHtml().replace("class='meal-card tint-card'","class='tint-card'")+"</section>";
  }
  function bind(){
    var change=document.getElementById("changeActiveMenu");
    if(change) change.onclick=function(){renderPickList();openModal("pickModal");};
    wireAdmin();
    var saveMenuSettings=document.getElementById("saveMenuSettings");
    if(saveMenuSettings) saveMenuSettings.onclick=function(){
      var m=currentMenu(); if(!m) return;
      var oldSections=sectionsOf(m).slice();
      var from=document.getElementById("menuValidFrom").value, to=document.getElementById("menuValidTo").value;
      if(from && to && from>to){toast("La data Al deve seguire la data Dal");return;}
      var name=document.getElementById("menuName").value.trim();
      if(!name){toast("Inserisci il nome del menu");return;}
      m.name=name;
      m.type=document.getElementById("menuType").value;
      m.validFrom=document.getElementById("menuValidFrom").value;
      m.validTo=document.getElementById("menuValidTo").value;
      var manualPeriod=document.getElementById("menuPeriod").value.trim();
      m.period=manualPeriod;
      var cm=document.getElementById("menuCycle").value;
      var labels=document.getElementById("menuSections").value.split(",").map(function(x){return x.trim();}).filter(Boolean);
      var newSections=labels.length?labels.map(function(label,i){var existing=oldSections.find(function(sec){return sec.label===label;}); return {id:existing?existing.id:sectionId(label,i),label:label};}):oldSections;
      m.sections=newSections;
      (m.weeks||[]).forEach(function(w){DAYS.forEach(function(d){w.days[d.id]=ensureMealShape(w.days[d.id],newSections);});});
      // Keep all stored weeks so switching back never discards dishes.
      while(cm==="weekly" && m.weeks.length<4) m.weeks.push({name:WEEK_NAMES[m.weeks.length]||("Settimana "+(m.weeks.length+1)),days:emptyDays(newSections)});
      m.cycle=Object.assign({},m.cycle,{mode:cm,weeks:cm==="single"?1:m.weeks.length});
      state.week=0;
      saveLibrary(); renderAll(); toast("Impostazioni salvate");
    };
    document.querySelectorAll("[data-choice]").forEach(function(row){
      row.querySelectorAll(".choice-chip").forEach(function(btn){ btn.onclick=function(){
        row.querySelectorAll(".choice-chip").forEach(function(x){x.classList.remove("on");}); btn.classList.add("on");
        var hidden=row.querySelector("input[type=hidden]"); if(hidden) hidden.value=btn.getAttribute("data-value");
      };});
    });
    var sendReport=document.getElementById("sendReport");
    if(sendReport) sendReport.onclick=async function(){
      var m=currentMenu(), contextEl=document.getElementById("reportContext"), messageEl=document.getElementById("reportMessage"), websiteEl=document.getElementById("reportWebsite");
      var message=(messageEl&&messageEl.value||"").trim(); if(!m||message.length<3){toast("Scrivi una segnalazione");return;}
      var old=sendReport.textContent; sendReport.disabled=true; sendReport.textContent="Invio...";
      try{await submitReport(m.id,(contextEl&&contextEl.value||"").trim(),message,websiteEl&&websiteEl.value||""); if(messageEl)messageEl.value=""; if(contextEl)contextEl.value=""; toast("Segnalazione inviata");}
      catch(e){toast(e.message||"Invio non riuscito");} finally{sendReport.disabled=false;sendReport.textContent=old;}
    };

    var cloudConnect=document.getElementById("cloudConnect");
    if(cloudConnect) cloudConnect.onclick=async function(){
      var inp=document.getElementById("cloudKey"), key=(inp&&inp.value||"").trim(); if(key.length<16){toast("Chiave troppo corta");return;}
      localStorage.setItem(CLOUD_KEY_STORE,key); localStorage.removeItem(CLOUD_META_STORE);
      try{await cloudRequest("GET"); await syncCloud(false); renderAll();}
      catch(e){localStorage.removeItem(CLOUD_KEY_STORE);localStorage.removeItem(CLOUD_META_STORE);toast(e.message||"Chiave non valida");renderAll();}
    };
    var cloudSync=document.getElementById("cloudSync"); if(cloudSync) cloudSync.onclick=function(){syncCloud(false);};
    var cloudDisconnect=document.getElementById("cloudDisconnect"); if(cloudDisconnect) cloudDisconnect.onclick=function(){localStorage.removeItem(CLOUD_KEY_STORE);localStorage.removeItem(CLOUD_META_STORE);cloudRevision=0;renderAll();toast("Dispositivo disconnesso");};
    renderCloudStatus();

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
    document.querySelectorAll("[data-use]").forEach(function(b){ b.onclick = function(){ state.activeId=b.getAttribute("data-use"); state.week=0; closeCellBar(); saveLibrary(); renderAll(); }; });
    document.querySelectorAll("[data-del]").forEach(function(b){
      b.onclick = function(){
        var id = b.getAttribute("data-del");
        ask("Eliminare questo menu?", getCloudKey()?"Verrà eliminato anche dalla libreria sincronizzata.":"Verrà rimosso solo da questo dispositivo.", "Elimina", function(){
          state.menus = state.menus.filter(function(x){ return x.id !== id; });
          if(state.activeId===id) state.activeId = (state.menus[0] && state.menus[0].id)||null;
          state.week=0;
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
    var courses = sectionsOf(m).map(function(sec){ return [sec.id,sec.label]; });
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
    sectionsOf(currentMenu()).map(function(sec){return sec.id;}).forEach(function(k){
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
    var labels = {}; sectionsOf(currentMenu()).forEach(function(sec){ labels[sec.id]=sec.label; });
    var day = DAYS.find(function(d){ return d.id===p[1]; });
    var val = "";
    var menu = currentMenu();
    if (isOcrDraftOpen() && window.__importNorm.weeks[p[0]]) val = window.__importNorm.weeks[p[0]].days[p[1]][p[2]] || "";
    else if (menu && menu.weeks[p[0]] && menu.weeks[p[0]].days[p[1]]) val = menu.weeks[p[0]].days[p[1]][p[2]] || "";
    if (!val && window.__importNorm && window.__importNorm.weeks[p[0]]) val = window.__importNorm.weeks[p[0]].days[p[1]][p[2]] || "";
    document.getElementById("cellBarMeta").textContent = (day ? day.label : p[1]) + " · " + (labels[p[2]] || p[2]);
    var inp = document.getElementById("cellBarInput");
    inp.value = val;
    var algBox = document.getElementById("cellBarAlg");
    var aField = aKeyOf(p[2]);
    var aVal = "";
    if (isOcrDraftOpen() && window.__importNorm.weeks[p[0]]) aVal = window.__importNorm.weeks[p[0]].days[p[1]][aField] || "";
    else if (menu && menu.weeks[p[0]] && menu.weeks[p[0]].days[p[1]]) aVal = menu.weeks[p[0]].days[p[1]][aField] || "";
    algBox.innerHTML = '<div class="label">Allergeni</div>'+allergenChipsHtml(aField, aVal);
    wireAlgChips(algBox);
    document.getElementById("cellBar").classList.add("open");
    placeCellBar();
    setTimeout(function(){ inp.focus(); }, 40);
  }
  function isOcrDraftOpen(){ return !!(window.__importNorm && document.getElementById("discardOcr")); }
  function applyCellValue(key, val, persist){
    var p = String(key||"").split(":");
    var menu = currentMenu();
    if (!isOcrDraftOpen() && menu && menu.weeks[p[0]] && menu.weeks[p[0]].days[p[1]]) {
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
      var field = wrap.getAttribute("data-alg");
      var codes = codesFromChips(wrap);
      if (isOcrDraftOpen() && window.__importNorm.weeks[p[0]]) {
        window.__importNorm.weeks[p[0]].days[p[1]][field] = codes;
      } else {
        var menu = currentMenu();
        if (menu && menu.weeks[p[0]] && menu.weeks[p[0]].days[p[1]]) {
          menu.weeks[p[0]].days[p[1]][field] = codes;
          saveLibrary();
        }
      }
    }
    closeCellBar();
    if (isOcrDraftOpen()) paintOcrDraft();
    else if (document.getElementById("screen-settimane") && document.getElementById("screen-settimane").classList.contains("active")) {
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
      '<div class="field" style="text-align:left"><label>Nome</label><input id="imp-name" placeholder="es. Menu settembre"></div><div class="field" style="text-align:left"><label>Tipo</label><select id="imp-type"><option value="school">Scuola</option><option value="work">Lavoro</option><option value="event">Evento / festa</option><option value="other">Altro</option></select></div>' +
      '<button class="btn btn-primary btn-wide" id="btnBlank">Crea e apri la tabella</button></div>' +
      '<div class="meal-card"><h2>Da un AI</h2><p class="status">Copia il prompt e allegalo a foto o PDF in una chat. Poi incolla qui il JSON, oppure carica il file.</p>' +
      '<div class="prompt-row"><span class="prompt-ph">Prompt 4 settimane</span><button type=button class="btn btn-ghost" id="copyPrompt">Copia</button></div>' +
      '<textarea id="promptBox" hidden>'+esc(AI_PROMPT)+"</textarea>" +
      '<div class="field"><label>JSON</label><textarea id="jsonPaste" placeholder="{ ... }"></textarea></div>' +
      '<div class="actions"><button class="btn btn-primary" id="applyJsonPaste">Importa JSON</button><button class="btn btn-ghost" id="btnJsonFile">File .json</button></div>' +
      '<input id="fileJson" type="file" accept=".json,application/json" hidden></div>' +
      '</div>';
  }

  function exportSelectedMenus(){
    if(!state.menus.length){toast("Nessun menu da esportare");return;}
    var chosen=Array.prototype.filter.call(document.querySelectorAll("[data-export-menu]"),function(x){return x.checked;}).map(function(x){return x.value;});
    if(!chosen.length){toast("Seleziona almeno un menu");return;}
    var menus=state.menus.filter(function(m){return chosen.indexOf(m.id)>=0;});
    var payload=menus.length===1 ? menus[0] : {kind:"menu-library",version:2,menus:menus,activeId:menus[0].id};
    var blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    var a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=menus.length===1 ? (sectionId(menus[0].name,0)||"menu")+".json" : "menu-selezionati.json";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
    toast(menus.length===1?"Menu esportato":menus.length+" menu esportati");
  }
  function exportCardHtml(){
    if(!state.menus.length) return "";
    return '<div class="meal-card export-card"><h2>Esporta</h2><p class=status>Scegli i menu da esportare.</p><div class="export-list">'+
      state.menus.map(function(m){return '<label class="export-row"><span>'+esc(m.name)+'</span><input class="app-check" type=checkbox data-export-menu value="'+esc(m.id)+'" '+(m.id===state.activeId?"checked":"")+'><i aria-hidden="true"></i></label>';}).join("")+
      '</div><button type=button class="btn btn-primary btn-wide" id=exportSelected>Esporta selezionati</button></div>';
  }

  function libraryCardHtml(withInput){
    return '<div class="meal-card"><h2>Copia che non si perde</h2><p class="status">Quello su questo telefono si cancella se pulisci la memoria del sito. Salva il file in File o iCloud e ricaricalo qui, anche da un altro dispositivo.</p>' +
      '<div class="actions"><button type=button class="btn btn-primary" data-save-copy>Salva copia</button><button type=button class="btn btn-ghost" data-load-copy>Carica copia</button></div>' +
      (withInput ? '<input id="fileLibrary" type="file" accept=".json,application/json" hidden>' : '') +
      '</div>';
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
    var courses=sectionsOf(currentMenu()).map(function(sec){return [sec.id,sec.label];});
    if(weekFilled(weekObj)) courses=courses.filter(function(c){return DAYS.some(function(d){var x=weekObj.days&&weekObj.days[d.id];return x&&String(x[c[0]]||"").trim();});});
    var head="<tr><th></th>"+courses.map(function(c){return "<th>"+esc(c[1])+"</th>";}).join("")+"</tr>";
    var body=DAYS.map(function(d){
      var x=(weekObj&&weekObj.days&&weekObj.days[d.id])||meal(sectionsOf(currentMenu()));
      return "<tr><th class=day>"+d.short+"</th>"+courses.map(function(c){
        var val=x[c[0]]||"", empty=val?"":" cell-empty";
        if(editable) return "<td class='"+empty+"'><button type=button class=cell-btn data-cell="+weekIdx+":"+d.id+":"+c[0]+">"+esc(val||"…")+"</button></td>";
        return "<td>"+esc(val||"")+"</td>";
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

  var ocrAbort=false;
  function discardOcrDraft(){
    ocrAbort=true;
    window.__importNorm=null;
    closeCellBar();
    renderImporta();
    wireImport();
    toast("Bozza chiusa, niente salvato");
  }
  async function handleFile(file){
    if(!file) return;
    ocrAbort=false;
    var startName=proposedName();
    var box=document.getElementById("screen-importa");
    box.innerHTML='<div class="meal-card"><h2>Bozza OCR <button type=button class="edit-btn" id="discardOcr">Chiudi</button></h2><p class="status">Sto leggendo il foglio. Puoi chiudere e lasciare perdere.</p><div class="preview-wrap" id="preview"></div><div class="progress"><i id="bar"></i></div><div class="status" id="ocrStatus">Preparazione...</div></div>';
    document.getElementById("discardOcr").onclick=function(){ discardOcrDraft(); };
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
      if (ocrAbort) return;
      if (!norm) norm=validateAndNormalizeMenuJson({ name:proposedName(), weeks:[] });
      if (startName && startName!=="Nuovo menu") norm.name=startName;
      showReview(norm, used, rawText);
    }catch(err){
      if (ocrAbort) return;
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
    window.__importRaw = rawText || "";
    paintOcrDraft();
  }
  function paintOcrDraft(){
    var norm = window.__importNorm;
    if (!norm) return;
    var n = countFilled(norm);
    var vis = filledWeekIdx(norm);
    if (vis.length && vis.indexOf(state.week)<0) state.week = vis[0];
    var w = state.week || 0;
    var week = norm.weeks[w] || norm.weeks[0];
    var tabs = vis.length<=1 ? "" : (norm.weeks||[]).map(function(item,i){
      if (vis.indexOf(i)<0) return "";
      return "<button class='week-tab"+(i===w?" on":"")+"' data-ocr-week="+i+">"+esc(item.name.replace(" settimana",""))+"</button>";
    }).join("");
    var box = document.getElementById("screen-importa");
    box.innerHTML =
      '<div class="meal-card"><h2>Bozza OCR <button type=button class="edit-btn" id="discardOcr">Chiudi</button></h2>' +
      '<p class="status">Non e un menu salvato. Campi pieni: '+n+'. Se il testo e illeggibile chiudi e passa da un AI.</p>' +
      '<div class="field" style="text-align:left"><label>Nome</label><input id="imp-title-name" value="'+esc(norm.name||"Bozza OCR")+'"></div>' +
      '<div class="field" style="text-align:left"><label>Periodo</label><input id="imp-period" value="'+esc(norm.period||"")+'"></div></div>' +
      (tabs?"<div class=week-tabs>"+tabs+"</div>":"") +
      "<div class=day-rail>"+DAYS.map(function(d){ return "<button class='day-chip"+(d.id===state.day?" on":"")+"' data-ocr-day="+d.id+"><small>"+d.short+"</small><b>"+d.label.slice(0,3)+"</b></button>"; }).join("")+"</div>" +
      mealHtml(week.days[state.day]||meal(), w, state.day) +
      '<div class="meal-card"><h2>Tabella settimana</h2><p class="status">Tocca una cella. Chiudi per lasciare perdere.</p>'+weekGridHtml(week,w,true)+"</div>" +
      '<button class="btn btn-primary btn-wide" id="applyParse">Salva come menu</button>' +
      '<button class="btn btn-ghost btn-wide" id="discardOcr2">Scarta la bozza</button>';
    document.getElementById("discardOcr").onclick=discardOcrDraft;
    document.getElementById("discardOcr2").onclick=discardOcrDraft;
    document.querySelectorAll("[data-ocr-week]").forEach(function(b){
      b.onclick=function(){
        pullOcrMeta();
        state.week=+b.getAttribute("data-ocr-week");
        paintOcrDraft();
      };
    });
    document.querySelectorAll("[data-ocr-day]").forEach(function(b){
      b.onclick=function(){
        pullOcrMeta();
        state.day=b.getAttribute("data-ocr-day");
        paintOcrDraft();
      };
    });
    document.getElementById("applyParse").onclick=function(){
      try{
        pullOcrMeta();
        var norm2=validateAndNormalizeMenuJson(window.__importNorm);
        window.__importNorm=null;
        saveImportedMenu(norm2);
      }catch(err){ toast("Bozza non valida: "+err.message); }
    };
    bind();
  }
  function pullOcrMeta(){
    if (!window.__importNorm) return;
    var nameEl=document.getElementById("imp-title-name");
    var perEl=document.getElementById("imp-period");
    if (nameEl) window.__importNorm.name=nameEl.value.trim()||window.__importNorm.name;
    if (perEl) window.__importNorm.period=perEl.value.trim();
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
    var sections=Array.isArray(obj.sections)&&obj.sections.length ? obj.sections.map(function(x,i){
      var label=String((x&&x.label)||("Sezione "+(i+1))).trim();
      return {id:String((x&&x.id)||sectionId(label,i)),label:label};
    }) : DEFAULT_SECTIONS.slice();
    var srcWeeks=Array.isArray(obj.weeks)?obj.weeks:[];
    var wanted=Math.max(1,srcWeeks.length||((obj.cycle&&obj.cycle.mode==="single")?1:4));
    var weeks=[];
    for(var i=0;i<wanted;i++){
      var src=srcWeeks[i]||{}, srcDays=(src&&src.days)||{}, days={};
      DAYS.forEach(function(d){
        var raw=srcDays[d.id]||{}, out=meal(sections);
        sections.forEach(function(sec){ out[sec.id]=String(raw[sec.id]||""); out[sec.id+"A"]=String(raw[sec.id+"A"]||""); });
        days[d.id]=out;
      });
      weeks.push({name:String(src.name||WEEK_NAMES[i]||("Settimana "+(i+1))),days:days});
    }
    return {schemaVersion:2,id:obj.id||"",name:name,type:String(obj.type||"school"),period:period,
      validFrom:String(obj.validFrom||""),validTo:String(obj.validTo||""),
      cycle:(obj.cycle&&typeof obj.cycle==="object")?obj.cycle:{mode:"weekly",weeks:weeks.length},
      sections:sections,weeks:weeks};
  }
  function saveImportedMenu(norm){
    var nameInput=document.getElementById("imp-name");
    var title=document.getElementById("imp-title-name");
    if(title && title.value.trim()) norm.name=title.value.trim();
    else if(nameInput && nameInput.value.trim()) norm.name=nameInput.value.trim();
    var created=makeMenu(norm);
    state.menus.push(created); state.activeId=created.id; saveLibrary();
    toast("Menu salvato: "+created.name); goTab("settimane"); renderAll();
    offerLibraryCopy();
  }
  function libraryPayload(){
    return { kind:"menu-library", version:2, menus: state.menus, activeId: state.activeId };
  }
  function libraryFile(){
    var blob = new Blob([JSON.stringify(libraryPayload(), null, 2)], { type:"application/json" });
    return new File([blob], "menu-libreria.json", { type:"application/json" });
  }
  function offerLibraryCopy(){
    if (!state.menus.length) { toast("Nessun menu da salvare"); return; }
    var file = libraryFile();
    var download = function(){
      var a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = "menu-libreria.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast("File scaricato: aprilo in File e tienilo");
    };
    if (navigator.share && navigator.canShare && navigator.canShare({ files:[file] })) {
      navigator.share({ files:[file], title:"Menu" }).then(function(){
        toast("Copia pronta: salvala in File o iCloud");
      }).catch(function(err){
        if (err && err.name === "AbortError") return;
        download();
      });
      return;
    }
    download();
  }
  function isLibraryFile(obj){
    return !!(obj && Array.isArray(obj.menus) && (obj.kind === "menu-library" || obj.version === 1 || obj.version === 2));
  }
  function applyLibraryObject(obj){
    var menus = obj.menus.map(function(m, i){
      var norm = validateAndNormalizeMenuJson(m);
      return makeMenu({
        id:m.id || ("menu-" + Date.now() + "-" + i), name:norm.name, type:norm.type, period:norm.period,
        validFrom:norm.validFrom, validTo:norm.validTo, cycle:norm.cycle, sections:norm.sections, weeks:norm.weeks
      });
    });
    state.menus = menus;
    var wanted = obj.activeId;
    state.activeId = menus.some(function(m){ return m.id === wanted; }) ? wanted : (menus[0] ? menus[0].id : null);
    saveLibrary();
    toast("Caricati " + menus.length + " menu");
    goTab("oggi");
    renderAll();
  }
  function confirmLibrary(obj){
    if (!obj.menus.length) { toast("Il file non contiene menu"); return; }
    var run = function(){ applyLibraryObject(obj); };
    if (state.menus.length) {
      ask("Sostituire i menu di questo telefono?", "Il file ne contiene " + obj.menus.length + ". Quelli solo su questo telefono vengono sostituiti.", "Carica", run);
      return;
    }
    run();
  }
  function handleLibraryPick(file){
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      try {
        var raw = String(reader.result || "");
        var obj = extractJsonObject(raw);
        if (isLibraryFile(obj)) confirmLibrary(obj);
        else applyJsonText(raw);
      } catch (err) { toast("File non valido: " + err.message); }
    };
    reader.onerror = function(){ toast("Impossibile leggere il file"); };
    reader.readAsText(file);
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

  (function installCompactMenuUi(){
    var st=document.createElement("style");
    st.textContent=`
#screen-info{padding-top:2px}.info-title{margin:0 2px 12px}.info-title h2{font-family:Fraunces,serif;font-size:1.45rem;margin:0}.info-title p{margin:2px 0 0;color:var(--muted);font-size:.78rem;font-weight:800}
.settings-card{background:#fff;border-radius:22px;box-shadow:0 8px 24px rgba(20,24,32,.10);padding:12px;margin-bottom:10px}.settings-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.settings-head b{font-family:Fraunces,serif;font-size:1rem}.settings-head span{font-size:.72rem;font-weight:800;color:var(--brand);background:var(--brand-soft);padding:3px 8px;border-radius:999px}
.menu-manage-list{display:grid;gap:6px}.menu-manage-row{display:flex;align-items:center;gap:6px;padding:4px;border-radius:15px;background:#faf8fc;border:1px solid var(--line)}.menu-manage-row.active{background:var(--brand-soft);border-color:transparent}.menu-manage-row .menu-rename{padding:7px 8px;font-size:.86rem}.menu-manage-row span{display:flex;gap:4px}.menu-manage-row .ico-btn{width:32px;height:32px;border-radius:10px}
.settings-stack{padding:0;overflow:hidden}.settings-panel{border-bottom:1px solid var(--line);background:#fff}.settings-panel:last-child{border-bottom:0}.settings-panel summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;cursor:pointer}.settings-panel summary::-webkit-details-marker{display:none}.settings-panel summary span{display:grid;gap:1px}.settings-panel summary b{font-size:.88rem}.settings-panel summary small{font-size:.68rem;color:var(--muted);font-weight:800}.settings-panel summary i{width:9px;height:9px;border-right:2px solid var(--brand);border-bottom:2px solid var(--brand);transform:rotate(45deg);transition:.2s}.settings-panel[open] summary i{transform:rotate(225deg);margin-top:6px}.panel-body{padding:0 12px 12px}.panel-body .field{margin:7px 0}.panel-body input,.panel-body select{padding:9px 11px;border-radius:13px;font-size:.82rem}.compact-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.compact-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.compact-actions .btn,.panel-body .btn{padding:10px 9px;border-radius:16px;font-size:.8rem}.compact-textarea{min-height:82px!important}
.panel-body .export-card{margin:8px 0 0;padding:8px 0 0}.panel-body .export-row{min-height:36px;padding:5px 8px;font-size:.76rem}.panel-body .export-row i{width:20px;height:20px;flex-basis:20px}.panel-body .export-card h2{font-family:Nunito,system-ui,sans-serif;font-size:.82rem}.panel-body .export-card .status{display:none}
.tint-compact{padding:11px 12px}.tint-compact .tint-card{margin:0}.tint-compact .tint-head{margin-bottom:8px}.tint-compact .tint-head b{font-family:Nunito,system-ui,sans-serif;font-size:.88rem}.tint-compact .tint-dot{height:28px}.tint-compact .tint-rail{padding:6px 8px}

.active-menu-banner{position:relative;overflow:hidden;background:var(--grad);border-radius:24px;padding:15px 16px;margin:0 0 10px;box-shadow:0 10px 26px rgba(20,24,32,.11)}
.active-menu-banner:after{content:"";position:absolute;width:120px;height:120px;border-radius:50%;right:-48px;top:-54px;background:rgba(255,255,255,.28)}
.active-menu-kicker{position:relative;z-index:1;display:flex;justify-content:space-between;gap:8px;font-size:.62rem;font-weight:900;letter-spacing:.08em;color:var(--muted)}.active-menu-kicker span{letter-spacing:0;text-transform:none;color:var(--brand)}
.active-menu-banner h2{position:relative;z-index:1;font-family:Fraunces,serif;font-size:1.28rem;margin:4px 0 6px}.active-menu-meta{position:relative;z-index:1;display:flex;gap:7px;align-items:center;flex-wrap:wrap;font-size:.72rem;font-weight:800}.active-menu-meta b{background:rgba(255,255,255,.62);padding:4px 8px;border-radius:999px}.active-menu-meta span{color:var(--muted)}
.settings-stack{background:transparent!important;box-shadow:none!important;display:grid;gap:8px}.settings-panel{border:1px solid var(--line)!important;border-radius:18px!important;overflow:hidden;box-shadow:0 5px 16px rgba(20,24,32,.07);background:#fff}.settings-panel:last-child{border-bottom:1px solid var(--line)!important}.settings-panel[open]{box-shadow:0 9px 24px rgba(20,24,32,.10)}.settings-panel[open] summary{background:var(--brand-soft)}
.choice-row{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px}.choice-chip{border:1px solid var(--line);background:#fff;color:var(--muted);border-radius:13px;padding:9px 6px;font-family:inherit;font-size:.72rem;font-weight:900}.choice-chip.on{background:var(--grad);color:var(--ink);border-color:transparent;box-shadow:0 4px 10px rgba(20,24,32,.08)}
.auto-period{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--brand-soft);border-radius:13px;padding:9px 11px;margin:4px 0 7px;font-size:.72rem}.auto-period span{color:var(--muted);font-weight:800}.auto-period b{text-align:right;font-size:.74rem}.field label small{text-transform:none;letter-spacing:0;font-weight:700}


:root,html[data-tint]{--shadow:0 8px 22px rgba(20,24,32,.10)}
.week-tab,.day-chip{box-shadow:0 7px 18px rgba(20,24,32,.11),0 2px 4px rgba(20,24,32,.05)}.week-tab.on,.day-chip.on{box-shadow:0 8px 18px rgba(20,24,32,.13)}
nav.tabbar ul{box-shadow:0 16px 36px rgba(20,24,32,.16)}nav.tabbar .blob{box-shadow:0 10px 22px rgba(20,24,32,.18),0 4px 10px rgba(20,24,32,.08),inset 0 3px 8px rgba(255,255,255,.55)}
.course.open::before{box-shadow:0 8px 18px rgba(20,24,32,.07)}.tint-dot.on{box-shadow:0 0 0 3px #fff,0 0 0 5px var(--brand),0 6px 14px rgba(20,24,32,.13)}
header.top{align-items:flex-start;padding-bottom:20px;flex-wrap:wrap}.brand-block{min-width:0;flex:1}.brand-block h1{margin-bottom:10px}.menu-pick{max-width:100%;white-space:normal;text-align:left}.pill{max-width:100%;white-space:normal;box-shadow:0 6px 16px rgba(20,24,32,.12)}
.active-menu-banner h2{margin:10px 0 14px;overflow-wrap:anywhere}.active-menu-banner .btn{position:relative;z-index:1;margin-top:14px}.active-menu-banner:after{pointer-events:none}
.menu-select{flex:1;min-width:0;text-align:left;border:0;background:transparent;color:var(--ink);font:inherit;padding:10px;cursor:pointer}.menu-select b{display:block;overflow-wrap:anywhere;font-size:.88rem}.menu-select small{display:block;color:var(--brand);font-weight:800;margin-top:3px}.menu-manage-row.active{border:2px solid var(--brand)}.menu-manage-row .ico-btn{flex-shrink:0;margin-right:6px}.menu-manage-row{background:var(--bg)}
button:focus-visible,summary:focus-visible{outline:2px solid var(--brand);outline-offset:3px}.btn:disabled{opacity:.6;cursor:wait}.tint-dot{box-shadow:inset 0 -1px 0 rgba(20,24,32,.06)}.cell-bar{box-shadow:0 -8px 24px rgba(20,24,32,.16)}
.admin-report{border:1px solid var(--line);border-radius:14px;padding:12px;margin-top:10px;overflow-wrap:anywhere}.admin-report p{white-space:pre-wrap;font-size:.85rem}.admin-report small{color:var(--muted)}.admin-controls{display:flex;gap:8px;flex-wrap:wrap}.admin-controls .btn{flex:1}.admin-message{font-size:.8rem;overflow-wrap:anywhere}
@media(max-width:360px){.compact-grid{grid-template-columns:1fr}.settings-panel summary{padding:11px 12px}.choice-row{grid-auto-flow:row;grid-template-columns:1fr 1fr}}
`;
    document.head.appendChild(st);
  })();
  if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(function(){});
  applyTint(currentTintId());
  renderAll();
  syncOfficialMenus();
  window.addEventListener("online",function(){renderCloudStatus();if(getCloudKey())syncCloud(true);});
  window.addEventListener("offline",renderCloudStatus);
  if(getCloudKey()) syncCloud(true);
})();