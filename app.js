const { createClient } = window.supabase;
const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

let state = { fluid:[], visits:[], blood:[], settings:null };
let charts = {};
const today = () => new Date().toISOString().slice(0,10);
const fmtDate = d => d ? new Date(d+"T00:00:00").toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"}) : "—";
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const num = v => v==null || v==="" ? null : Number(v);
function qs(id){return document.getElementById(id)}

async function init(){
  qs("fluidDate").value=today(); qs("fluidTime").value=new Date().toTimeString().slice(0,5);
  const {data:{session}}=await sb.auth.getSession();
  if(session) showApp(); else showLogin();
  sb.auth.onAuthStateChange((_e,s)=>s?showApp():showLogin());
}
function showLogin(){qs("login").classList.remove("hidden");qs("main").classList.add("hidden");qs("nav").classList.add("hidden");qs("logoutBtn").classList.add("hidden")}
async function showApp(){qs("login").classList.add("hidden");qs("main").classList.remove("hidden");qs("nav").classList.remove("hidden");qs("logoutBtn").classList.remove("hidden");await loadAll();renderAll()}

async function loadAll(){
  const [f,v,b,s]=await Promise.all([
    sb.from("fluid_records").select("*").order("record_date",{ascending:false}).order("created_at",{ascending:false}),
    sb.from("vet_visits").select("*").order("visit_date",{ascending:false}),
    sb.from("blood_tests").select("*").order("test_date",{ascending:false}),
    sb.from("app_settings").select("*").eq("id",1).maybeSingle()
  ]);
  if(f.error||v.error||b.error||s.error) throw new Error((f.error||v.error||b.error||s.error).message);
  state={fluid:f.data||[],visits:v.data||[],blood:b.data||[],settings:s.data||{}};
}
function latest(arr,dateKey){return arr.slice().sort((a,b)=>String(b[dateKey]).localeCompare(String(a[dateKey])));}
function previous(arr,dateKey){const a=latest(arr,dateKey);return a[1]||null}
function diff(a,b){return a==null||b==null?null:a-b}
function renderAll(){renderHome();renderFluid();renderHospital();renderHistory();renderCharts()}
function renderHome(){
  const f=state.fluid.find(x=>x.record_date===today());
  qs("todayFluid").textContent=f?f.amount_ml:"—";
  qs("todayStatus").textContent=f?"Recorded":"Not recorded";
  qs("todayBy").textContent=f?`Performed by ${f.performed_by}${f.performed_time?" at "+f.performed_time:""}`:"";
  qs("todayBtn").textContent=f?"Edit today's fluid":"Record today's fluid";
  const vs=latest(state.visits,"visit_date"), bs=latest(state.blood,"test_date");
  const lv=vs[0],pv=vs[1],lb=bs[0],pb=bs[1];
  qs("latestWeight").textContent=lv?.weight_kg??"—";qs("prevWeight").textContent=pv?.weight_kg??"—";
  qs("latestCrea").textContent=lb?.crea??"—";qs("prevCrea").textContent=pb?.crea??"—";
  qs("latestBun").textContent=lb?.bun??"—";qs("prevBun").textContent=pb?.bun??"—";
  qs("nextVisit").textContent=fmtDate(state.settings?.next_vet_date);qs("nextBlood").textContent=fmtDate(state.settings?.next_blood_date);
  const notices=[];
  if(lv&&pv&&Math.abs(diff(num(lv.weight_kg),num(pv.weight_kg)))>=num(state.settings?.weight_change_threshold??.2)) notices.push("Weight changed from the previous record.");
  if(lb&&pb&&Math.abs(diff(num(lb.crea),num(pb.crea)))>=num(state.settings?.crea_change_threshold??.5)) notices.push("CREA changed from the previous record.");
  if(lb&&pb&&Math.abs(diff(num(lb.bun),num(pb.bun)))>=num(state.settings?.bun_change_threshold??10)) notices.push("BUN changed from the previous record.");
  const recent=latest(state.fluid,"record_date").slice(0,7).map(x=>num(x.amount_ml)).filter(x=>x!=null);
  if(recent.length>=3){const avg=recent.reduce((a,b)=>a+b,0)/recent.length;if(f&&Math.abs(num(f.amount_ml)-avg)>=num(state.settings?.fluid_change_threshold??30)) notices.push("Today's fluid amount differs from the recent average.");}
  qs("changeBanner").innerHTML=notices.length?`<strong>Changes to note</strong><br>${notices.map(esc).join("<br>")}`:"";
  qs("changeBanner").classList.toggle("hidden",!notices.length);
}
function recordHtml(type,x,dateKey,details){
  return `<div class="record"><div class="record-head"><div><div class="record-title">${esc(details)}</div><div class="record-meta">${fmtDate(x[dateKey])} · entered by ${esc(x.performed_by||x.entered_by||"user")}</div></div></div>${x.note?`<div class="record-note">${esc(x.note)}</div>`:""}<div class="record-actions"><button class="secondary" onclick="editRecord('${type}','${x.id}')">Edit</button><button class="secondary" onclick="deleteRecord('${type}','${x.id}')">Delete</button></div></div>`;
}
function renderFluid(){qs("fluidList").innerHTML=state.fluid.slice(0,20).map(x=>recordHtml("fluid",x,"record_date",`${x.amount_ml} ml${x.performed_time?" · "+x.performed_time:""}`)).join("")||'<div class="muted">No fluid records yet.</div>'}

function renderHospital(){
  const visits = latest(state.visits, "visit_date");
  const bloodTests = latest(state.blood, "test_date");

  const visitHtml = visits.map(x =>
    recordHtml(
      "visit",
      x,
      "visit_date",
      `Weight: ${x.weight_kg ?? "—"} kg`
    )
  ).join("");

  const bloodHtml = bloodTests.map(x =>
    recordHtml(
      "blood",
      x,
      "test_date",
      `Blood test · CREA ${x.crea ?? "—"} · BUN ${x.bun ?? "—"}`
    )
  ).join("");

  qs("hospitalList").innerHTML = `
    <h3 style="margin:16px 0 10px">Vet visits</h3>
    ${visitHtml || '<div class="muted">No vet visits yet.</div>'}

    <h3 style="margin:24px 0 10px">Blood tests</h3>
    ${bloodHtml || '<div class="muted">No blood tests yet.</div>'}
  `;

  qs("scheduleVisit").value = state.settings?.next_vet_date || "";
  qs("scheduleBlood").value = state.settings?.next_blood_date || "";
}

function renderHistory(){
  const dates=[...new Set([...state.fluid.map(x=>x.record_date),...state.visits.map(x=>x.visit_date),...state.blood.map(x=>x.test_date)])].sort().reverse();
  qs("historyList").innerHTML=dates.map(d=>{
    const f=state.fluid.find(x=>x.record_date===d),v=state.visits.find(x=>x.visit_date===d),b=state.blood.find(x=>x.test_date===d);
    return `<div class="record"><div class="record-head"><div class="record-title">${fmtDate(d)}</div></div>${f?`<div>${f.amount_ml} ml fluid</div>`:""}${v?`<div>Weight: ${v.weight_kg??"—"} kg</div>`:""}${b?`<div>CREA: ${b.crea??"—"} · BUN: ${b.bun??"—"}</div>`:""}${(f?.note||v?.note||b?.note)?`<div class="record-note">${esc(f?.note||v?.note||b?.note)}</div>`:""}<div class="record-meta">Input history is retained in each individual record.</div></div>`;
  }).join("")||'<div class="muted">No records yet.</div>';
}
function filtered(arr,dateKey,months){if(months==="all")return arr;const cutoff=new Date();cutoff.setMonth(cutoff.getMonth()-Number(months));return arr.filter(x=>new Date(x[dateKey])>=cutoff)}
function makeChart(id,label,arr,dateKey,valueKey,months){
  if(charts[id])charts[id].destroy();
  const data=filtered(latest(arr,dateKey),dateKey,months).reverse();
  charts[id]=new Chart(qs(id),{type:"line",data:{labels:data.map(x=>fmtDate(x[dateKey])),datasets:[{label,data:data.map(x=>x[valueKey]),tension:.25,spanGaps:true}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:false}}}});
}
function renderCharts(months=document.querySelector(".range-tabs .selected")?.dataset.range||"all"){
  makeChart("weightChart","Weight",state.visits,"visit_date","weight_kg",months);
  makeChart("creaChart","CREA",state.blood,"test_date","crea",months);
  makeChart("bunChart","BUN",state.blood,"test_date","bun",months);
  makeChart("fluidChart","Fluid",state.fluid,"record_date","amount_ml",months);
}
function go(page){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));qs("page-"+page).classList.add("active");document.querySelectorAll(".bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));window.scrollTo(0,0)}
async function save(table,id,payload){
  const user=(await sb.auth.getUser()).data.user;
  payload.created_by=user.id;
  const q=id?sb.from(table).update(payload).eq("id",id):sb.from(table).insert(payload);
  const {error}=await q;if(error)throw error;await loadAll();renderAll();
}
window.editRecord=async(type,id)=>{
  const map={fluid:[state.fluid,"fluidForm"],visit:[state.visits,"visitForm"],blood:[state.blood,"bloodForm"]};const [arr]=map[type];const x=arr.find(r=>r.id===id);if(!x)return;
  if(type==="fluid"){qs("visitId").value="";qs("fluidDate").value=x.record_date;qs("fluidAmount").value=x.amount_ml;qs("fluidTime").value=x.performed_time||"";qs("fluidBy").value=x.performed_by;qs("fluidNote").value=x.note||"";qs("fluidForm").dataset.id=id;go("today")}
  if(type==="visit"){qs("visitId").value=id;qs("visitDate").value=x.visit_date;qs("visitWeight").value=x.weight_kg??"";qs("visitNote").value=x.note||"";go("hospital")}
  if(type==="blood"){qs("bloodId").value=id;qs("bloodDate").value=x.test_date;qs("bloodCrea").value=x.crea??"";qs("bloodBun").value=x.bun??"";qs("bloodNote").value=x.note||"";go("hospital")}
};
window.deleteRecord=async(type,id)=>{
  if(!confirm("Delete this record?"))return;const table={fluid:"fluid_records",visit:"vet_visits",blood:"blood_tests"}[type];const {error}=await sb.from(table).delete().eq("id",id);if(error)alert(error.message);else{await loadAll();renderAll()}
};

qs("loginForm").onsubmit=async e=>{e.preventDefault();qs("loginError").textContent="";const {error}=await sb.auth.signInWithPassword({email:qs("email").value,password:qs("password").value});if(error)qs("loginError").textContent=error.message};
qs("logoutBtn").onclick=()=>sb.auth.signOut();
qs("todayBtn").onclick=()=>{const f=state.fluid.find(x=>x.record_date===today());if(f)editRecord("fluid",f.id);else go("today")};
qs("fluidForm").onsubmit=async e=>{e.preventDefault();try{await save("fluid_records",e.target.dataset.id||null,{record_date:qs("fluidDate").value,amount_ml:num(qs("fluidAmount").value),performed_time:qs("fluidTime").value||null,performed_by:qs("fluidBy").value,note:qs("fluidNote").value||null});e.target.reset();qs("fluidDate").value=today();qs("fluidTime").value=new Date().toTimeString().slice(0,5);delete e.target.dataset.id;go("home")}catch(err){alert(err.message)}};
qs("visitForm").onsubmit=async e=>{e.preventDefault();try{await save("vet_visits",qs("visitId").value||null,{visit_date:qs("visitDate").value,weight_kg:num(qs("visitWeight").value),note:qs("visitNote").value||null});e.target.reset();qs("visitId").value="";go("hospital")}catch(err){alert(err.message)}};
qs("bloodForm").onsubmit=async e=>{e.preventDefault();try{await save("blood_tests",qs("bloodId").value||null,{test_date:qs("bloodDate").value,crea:num(qs("bloodCrea").value),bun:num(qs("bloodBun").value),note:qs("bloodNote").value||null});e.target.reset();qs("bloodId").value="";go("hospital")}catch(err){alert(err.message)}};
qs("fluidCancel").onclick=()=>go("home");qs("visitCancel").onclick=()=>{qs("visitForm").reset();qs("visitId").value="";go("hospital")};qs("bloodCancel").onclick=()=>{qs("bloodForm").reset();qs("bloodId").value="";go("hospital")};
qs("saveSchedule").onclick=async()=>{const {data:{user}}=await sb.auth.getUser();const {error}=await sb.from("app_settings").upsert({id:1,next_vet_date:qs("scheduleVisit").value||null,next_blood_date:qs("scheduleBlood").value||null,updated_by:user.id,updated_at:new Date().toISOString()});if(error)alert(error.message);else{await loadAll();renderAll()}};
document.querySelectorAll(".bottom-nav button,[data-page]").forEach(b=>b.onclick=()=>go(b.dataset.page));
document.querySelectorAll(".range-tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".range-tabs button").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");renderCharts(b.dataset.range)});
qs("exportCsv").onclick=()=>{
  const rows=[["date","fluid_ml","fluid_time","fluid_by","weight_kg","crea","bun","note"]];
  const dates=[...new Set([...state.fluid.map(x=>x.record_date),...state.visits.map(x=>x.visit_date),...state.blood.map(x=>x.test_date)])].sort().reverse();
  dates.forEach(d=>{const f=state.fluid.find(x=>x.record_date===d),v=state.visits.find(x=>x.visit_date===d),b=state.blood.find(x=>x.test_date===d);rows.push([d,f?.amount_ml??"",f?.performed_time??"",f?.performed_by??"",v?.weight_kg??"",b?.crea??"",b?.bun??"",f?.note||v?.note||b?.note||""])});
  const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv"}));a.download="luffy-health-backup.csv";a.click();
};

// CSV import for historical vet visits and blood tests only.
let pendingCsvImport = [];

function parseCsvText(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else {
      if (ch === '"' && field === "") quoted = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch !== "\r") field += ch;
    }
  }
  row.push(field);
  if (row.some(v => String(v ?? "").trim() !== "")) rows.push(row);
  return rows;
}

function csvCell(v) {
  return '"' + String(v ?? "").replace(/"/g, '""') + '"';
}

function downloadCsvTemplate() {
  const rows = [
    ["date", "weight_kg", "crea", "bun", "note"],
    ["2025-10-30", "3.85", "", "", "Historical vet visit"],
    ["2025-11-06", "3.9", "3.0", "49", "Confirm CREA/BUN before import"]
  ];
  const csv = rows.map(r => r.map(csvCell).join(",")).join("\r\n");
  const blobUrl = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = blobUrl; a.download = "luffy-health-import-template.csv"; a.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

function validateCsvImport(text) {
  const rows = parseCsvText(text);
  if (rows.length < 2) throw new Error("CSV has no data rows.");
  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/^\ufeff/, ""));
  const required = ["date", "weight_kg", "crea", "bun", "note"];
  const missing = required.filter(h => !headers.includes(h));
  if (missing.length) throw new Error("Missing columns: " + missing.join(", ") + ". Please use the template.");
  const ix = Object.fromEntries(required.map(h => [h, headers.indexOf(h)]));
  const parsed = [], errors = [];
  rows.slice(1).forEach((r, i) => {
    if (!r.some(v => String(v ?? "").trim() !== "")) return;
    const line = i + 2;
    const date = (r[ix.date] || "").trim();
    const weightRaw = (r[ix.weight_kg] || "").trim();
    const creaRaw = (r[ix.crea] || "").trim();
    const bunRaw = (r[ix.bun] || "").trim();
    const note = (r[ix.note] || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
      errors.push(`Line ${line}: date must be YYYY-MM-DD.`); return;
    }
    const numeric = v => v === "" ? null : Number(v);
    const weight = numeric(weightRaw), crea = numeric(creaRaw), bun = numeric(bunRaw);
    if ((weightRaw && (!Number.isFinite(weight) || weight < 0)) ||
        (creaRaw && (!Number.isFinite(crea) || crea < 0)) ||
        (bunRaw && (!Number.isFinite(bun) || bun < 0))) {
      errors.push(`Line ${line}: weight/CREA/BUN must be non-negative numbers or blank.`); return;
    }
    if (weight === null && crea === null && bun === null && !note) {
      errors.push(`Line ${line}: no record values.`); return;
    }
    parsed.push({ date, weight, crea, bun, note, line });
  });
  if (errors.length) throw new Error(errors.join("\n"));
  return parsed;
}

function renderCsvPreview(records) {
  if (!records.length) { qs("importPreview").innerHTML = ""; return; }
  const rows = records.map(r =>
    `<tr><td>${esc(r.date)}</td><td>${r.weight ?? "—"}</td><td>${r.crea ?? "—"}</td><td>${r.bun ?? "—"}</td><td>${esc(r.note || "—")}</td></tr>`
  ).join("");
  qs("importPreview").innerHTML = `<p><strong>${records.length} rows ready to review</strong></p>
    <div style="overflow-x:auto"><table class="import-preview-table">
    <thead><tr><th>Date</th><th>Weight kg</th><th>CREA</th><th>BUN</th><th>Note</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
    <p class="muted">Rows with weight create vet visits. Rows with CREA and/or BUN create blood tests. Existing records on the same date are skipped per table.</p>`;
}

async function importCsvRecords() {
  const status = qs("importStatus"), button = qs("importCsvSubmit");
  if (!pendingCsvImport.length) return;
  button.disabled = true;
  status.textContent = "Importing records…";
  try {
    const { data: { user }, error: userError } = await sb.auth.getUser();
    if (userError || !user) throw new Error("Please sign in again before importing.");
    const visitDates = new Set(state.visits.map(v => v.visit_date));
    const bloodDates = new Set(state.blood.map(b => b.test_date));
    const visits = [], blood = [], skipped = [];
    for (const r of pendingCsvImport) {
      if (r.weight !== null) {
        if (visitDates.has(r.date)) skipped.push("visit " + r.date);
        else { visits.push({ visit_date: r.date, weight_kg: r.weight, note: r.note || null, created_by: user.id }); visitDates.add(r.date); }
      }
      if (r.crea !== null || r.bun !== null) {
        if (bloodDates.has(r.date)) skipped.push("blood test " + r.date);
        else { blood.push({ test_date: r.date, crea: r.crea, bun: r.bun, note: r.note || null, created_by: user.id }); bloodDates.add(r.date); }
      }
    }
    if (!visits.length && !blood.length) {
      status.textContent = "Nothing new to import. Existing records for these dates were skipped.";
      return;
    }
    if (visits.length) {
      const { error } = await sb.from("vet_visits").insert(visits);
      if (error) throw error;
    }
    if (blood.length) {
      const { error } = await sb.from("blood_tests").insert(blood);
      if (error) throw error;
    }
    await loadAll(); renderAll();
    status.textContent = `Import complete: ${visits.length} vet visits and ${blood.length} blood tests added.` +
      (skipped.length ? ` Skipped existing records: ${skipped.length}.` : "");
    pendingCsvImport = []; qs("importPreview").innerHTML = ""; qs("importCsvFile").value = "";
  } catch (err) {
    status.textContent = "Import failed: " + (err?.message || String(err));
  } finally {
    button.disabled = pendingCsvImport.length === 0;
  }
}

function setupCsvImport() {
  const fileInput = qs("importCsvFile"), templateButton = qs("downloadImportTemplate"), importButton = qs("importCsvSubmit");
  if (!fileInput || !templateButton || !importButton) return;
  templateButton.onclick = downloadCsvTemplate;
  fileInput.onchange = async () => {
    pendingCsvImport = []; importButton.disabled = true;
    qs("importPreview").innerHTML = ""; qs("importStatus").textContent = "";
    const file = fileInput.files?.[0]; if (!file) return;
    try {
      pendingCsvImport = validateCsvImport(await file.text());
      renderCsvPreview(pendingCsvImport);
      qs("importStatus").textContent = "Review the preview carefully before importing.";
      importButton.disabled = pendingCsvImport.length === 0;
    } catch (err) {
      qs("importStatus").textContent = "CSV could not be read: " + (err?.message || String(err));
    }
  };
  importButton.onclick = importCsvRecords;
}
setupCsvImport();

init().catch(e=>{qs("loginError").textContent=e.message});
