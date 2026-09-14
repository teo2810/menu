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

  var ICONS = {
    primo: '<svg viewBox="0 0 32 32"><ellipse cx="16" cy="24" rx="12" ry="3.2" fill="#d9d0c4"/><path d="M5 22c1.2-4 5-6.5 11-6.5S25.8 18 27 22c-1.4 2.6-5.8 4-11 4S6.4 24.6 5 22z" fill="#f2c56b"/><path d="M10 20c1.4.8 2.6-.2 3.6-1.2.8 1.4 2.2 2 3.4.4.8 1.3 2.3 1.6 3.4.1 1 .9 2.4.6 3.2-.6" fill="none" stroke="#e39b2d" stroke-width="1.5" stroke-linecap="round"/><circle cx="16" cy="17.2" r="3.1" fill="#e85d4c"/><path d="M14.4 15.2c.6-1.4 2.6-1.6 3.3-.2" fill="#3fa36a"/><path d="M13.2 8.2c.1 1.6-.4 2.6-1.2 3.4M16 7.4c0 1.8-.2 2.8 0 3.8M18.8 8.2c-.1 1.6.3 2.6 1.1 3.4" fill="none" stroke="#6b5344" stroke-width="1.3" stroke-linecap="round"/></svg>',
    secondo: '<svg viewBox="0 0 32 32"><path d="M9.2 22.4c-1.8 2.6-.6 6.2 2.6 7.2 3.4 1 6.4-1.4 6.2-4.4L16 12.6c-2.2 2.4-5.2 6.6-6.8 9.8z" fill="#f3d7b3"/><path d="M16.2 12.4c.2 3.4 2.2 7.8 4.2 10.6 1.8 2.6 5.8 2.6 7.2-.2 1.4-2.8-1-6.8-4.4-10.2-2.2-2.2-5.2-3.8-7-4.4z" fill="#e8a15a"/><path d="M20.4 16.2c1.4 2.2 3 4.6 3.8 6.2" fill="none" stroke="#c47a32" stroke-width="1.1" stroke-linecap="round"/><path d="M11.6 10.2c-1.8-1-3.4.2-3.2 2.2.2 1.8 1.4 2.6 3 2.2 1.2 1.6 3.2 1.2 4.2-.4.8-1.4.2-3.2-1.4-3.8-.4-1.4-1.8-1.6-2.6-.2z" fill="#f6eee3"/><circle cx="10.4" cy="12.2" r=".7" fill="#d7c4b0"/></svg>',
    contorno: '<svg viewBox="0 0 32 32"><path d="M18.6 6.2c1.8-.4 3.6.6 4.4 2.2.6 1.2.2 2.4-.8 3.2-1.4-.2-2.8-.8-3.8-1.8-.4-1.4.2-2.8.2-3.6z" fill="#3fa36a"/><path d="M18.2 8.6c-1 .8-2.2 1.4-3.4 1.6" fill="none" stroke="#2c7a4d" stroke-width="1.1" stroke-linecap="round"/><path d="M8.2 24.8c1.8-6.6 5.4-12.2 10.4-16.2 1.2 2.2 1.6 4.8.4 7.2-2.2 4.4-6.2 8-10.8 9z" fill="#f08a2a"/><path d="M10.4 23.2c2.2-3.6 4.8-7 7.6-9.8" fill="none" stroke="#d56b14" stroke-width="1.2" stroke-linecap="round"/><path d="M12.6 20.6c1.8-2.8 3.8-5.4 6-7.6" fill="none" stroke="#ffd19a" stroke-width=".9" stroke-linecap="round"/></svg>',
    frutta: '<svg viewBox="0 0 32 32"><path d="M16.4 8.4c.2-1.8 1.2-3.2 2.8-4 0 1.8-.2 3.2-1 4.2" fill="none" stroke="#5b4030" stroke-width="1.5" stroke-linecap="round"/><path d="M17.6 7.2c1.6-.8 3.8-.4 4.8 1.2-1.6.8-3.4.6-4.8-.2z" fill="#3fa36a"/><path d="M9.2 13.6c-1.2 5.6.6 11.6 6.2 13.2 5.8 1.6 10.8-2.4 11.4-8.2.6-5.2-2.6-8.6-6.8-9.2-1.6-.2-2.6.2-3.6.8-1-.8-2.2-1.2-3.8-1-2.6.4-4.4 1.8-3.4 4.4z" fill="#e85d4c"/><path d="M14.8 12.4c-1.6 2.2-2 5.2-1.2 8" fill="none" stroke="#c43b36" stroke-width="1.1" stroke-linecap="round"/></svg>',
    merenda: '<svg viewBox="0 0 32 32"><path d="M7.2 14.8c-.4 6.2 3.2 12.6 9.2 13.2 6.2.6 10.4-5.2 10.2-11.2C26.4 10.4 21.6 6 16.2 6.4 11.2 6.8 7.6 9.8 7.2 14.8z" fill="#e2a24a"/><circle cx="12.2" cy="13.2" r="1.5" fill="#6b3f24"/><circle cx="18.8" cy="11.6" r="1.7" fill="#6b3f24"/><circle cx="16.2" cy="17.6" r="1.6" fill="#6b3f24"/><circle cx="21.4" cy="17.2" r="1.3" fill="#6b3f24"/><circle cx="12.8" cy="19.8" r="1.2" fill="#6b3f24"/><path d="M24.6 9.2c1.4-1.6 3.4-1.2 4.2.4.4.8.2 1.6-.4 2.2-.8.2-1.8 0-2.6-.4-.2-.8-.8-1.6-1.2-2.2z" fill="#e2a24a"/><circle cx="26.6" cy="10.2" r=".7" fill="#6b3f24"/></svg>'
  };
