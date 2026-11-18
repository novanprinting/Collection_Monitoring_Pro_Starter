/* Collection Monitoring Pro - starter production structure */
(() => {
  const $ = (s) => document.querySelector(s);
  const fmt = n => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n||0));
  const dateID = d => d ? new Date(d+"T00:00:00").toLocaleDateString("id-ID") : "-";
  const today = () => new Date().toLocaleDateString("en-CA");
  let db=null, session=null, profile=null, rows=[], aoList=[], activePage="dashboard";
  const toast = (m, bad=false) => { const t=$("#toast"); t.textContent=m; t.className="toast show"+(bad?" error":""); setTimeout(()=>t.className="toast",3600); };
  const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const isAdmin = () => profile?.role==="admin";
  const visibleRows = () => isAdmin()?rows:rows.filter(r=>r.ao_id===profile?.ao_id);
  const statusClass = s => ({ "Lunas":"paid","Bayar sebagian":"partial","Menunggak":"late","Jatuh tempo hari ini":"today-due","Belum jatuh tempo":"upcoming" }[s]||"");
  const derivedStatus = r => {
    if (r.payment_status==="Lunas") return "Lunas";
    if (r.payment_status==="Bayar sebagian") return "Bayar sebagian";
    if (r.due_date && r.due_date < today()) return "Menunggak";
    if (r.due_date && r.due_date === today()) return "Jatuh tempo hari ini";
    return "Belum jatuh tempo";
  };
  const configOK = () => window.CM_CONFIG && window.CM_CONFIG.SUPABASE_URL?.startsWith("https://") && window.CM_CONFIG.SUPABASE_ANON_KEY && !window.CM_CONFIG.SUPABASE_ANON_KEY.startsWith("ISI_");

  async function init(){
    $("#todayLabel").textContent = new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).toUpperCase();
    $("#connectionState").textContent = navigator.onLine ? "● Online" : "● Offline";
    window.addEventListener("online",()=>$("#connectionState").textContent="● Online");
    window.addEventListener("offline",()=>$("#connectionState").textContent="● Offline");
    window.addEventListener("online",()=>{if(session && profile) loadData();});
    if(!configOK()){ $("#loginMessage").textContent="Konfigurasi Supabase belum diisi. Ikuti README_SETUP terlebih dahulu."; return; }
    if(!window.supabase){ $("#loginMessage").textContent="Library Supabase belum termuat. Hubungkan internet lalu muat ulang."; return; }
    db=window.supabase.createClient(window.CM_CONFIG.SUPABASE_URL,window.CM_CONFIG.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data:{session:s}}=await db.auth.getSession(); session=s;
    if(session) await enterApp();
    $("#loginForm").addEventListener("submit",login);
    $("#logoutBtn").addEventListener("click",logout);
    $("#refreshBtn").addEventListener("click",loadData);
    document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
    db.auth.onAuthStateChange((_e,s)=>{session=s; if(!s) showLogin();});
  }
  async function login(e){
    e.preventDefault(); $("#loginMessage").textContent="Memeriksa akun...";
    const {data,error}=await db.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});
    if(error){$("#loginMessage").textContent="Login gagal: "+error.message;return;}
    session=data.session; await enterApp();
  }
  async function logout(){await db.auth.signOut(); session=null;profile=null;showLogin();}
  function showLogin(){$("#appView").classList.add("hidden");$("#loginView").classList.remove("hidden");}
  async function enterApp(){
    const {data:p,error}=await db.from("profiles").select("user_id,full_name,role,ao_id,active").eq("user_id",session.user.id).single();
    if(error||!p||!p.active){toast("Profil belum aktif. Hubungi admin.",true);await db.auth.signOut();return;}
    profile=p;
    $("#loginView").classList.add("hidden");$("#appView").classList.remove("hidden");
    $("#userName").textContent=p.full_name||session.user.email;$("#userRole").textContent=p.role==="admin"?"ADMIN":"AO PENAGIHAN";$("#rolePill").textContent=p.role.toUpperCase();
    document.querySelectorAll(".admin-only").forEach(el=>el.classList.toggle("hidden",!isAdmin()));
    await loadData(); showPage("dashboard");
  }
  async function loadData(){
    if(!session||!profile)return;
    const {data,error}=await db.from("customers").select("id,account_no,customer_name,ao_id,ao_team(name),installment,due_date,arrears,payment_status,collectibility,updated_at").order("customer_name");
    if(error){toast("Gagal memuat data: "+error.message,true);return;}
    rows=data||[];
    const {data:a}=await db.from("ao_team").select("id,name").eq("active",true).order("name"); aoList=a||[];
    renderAll();
  }
  function showPage(p){
    activePage=p; document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));
    $("#"+p+"Page")?.classList.remove("hidden");
    document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===p));
    $("#pageTitle").textContent=({dashboard:"Dashboard",customers:"Data Nasabah",monitoring:"Monitoring Penagihan",import:"Import Excel",reports:"Laporan",settings:"Pengaturan"})[p]||"Dashboard";
    renderAll();
  }
  function renderAll(){if(!profile)return; renderDashboard();renderCustomers();renderMonitoring();renderImport();renderReports();renderSettings();}
  function kpi(label,value,sub,accent=""){return `<div class="kpi"><div class="kpi-top"><span>${label}</span><i class="${accent}"></i></div><strong>${value}</strong><small>${sub}</small></div>`;}
  function renderDashboard(){
    const data=visibleRows(), late=data.filter(r=>derivedStatus(r)==="Menunggak"), paid=data.filter(r=>derivedStatus(r)==="Lunas"), partial=data.filter(r=>derivedStatus(r)==="Bayar sebagian"), total=late.reduce((s,r)=>s+Number(r.arrears||0),0), rate=data.length?Math.round(paid.length/data.length*100):0;
    const byAO=isAdmin()?aoList.map(a=>({name:a.name,items:data.filter(r=>r.ao_id===a.id)})):[{name:profile.full_name,items:data}];
    $("#dashboardPage").innerHTML=`<div class="welcome"><div><p class="eyebrow">RINGKASAN PORTOFOLIO</p><h3>${isAdmin()?"Selamat datang, Admin":"Selamat bekerja, "+esc(profile.full_name)}</h3><p>Berikut posisi monitoring berdasarkan data terakhir yang tersedia.</p></div><div class="date-chip">▣ ${dateID(today())}</div></div>
    <div class="kpi-grid">${kpi("Total nasabah",data.length,"Nasabah dalam cakupan Anda")}${kpi("Menunggak",late.length,"Sudah lewat jatuh tempo","red")}${kpi("Sudah lunas",paid.length,"Status pembayaran lunas","green")}${kpi("Nominal tunggakan",fmt(total),"Akumulasi nominal tercatat","gold")}</div>
    <div class="content-grid"><div class="panel"><div class="panel-head"><div><h3>Komposisi status</h3><p>Ringkasan status pembayaran terkini</p></div></div><div class="status-bars">${bar("Menunggak",late.length,data.length,"red")}${bar("Bayar sebagian",partial.length,data.length,"gold")}${bar("Lunas",paid.length,data.length,"green")}</div><div class="rate"><strong>${rate}%</strong><span>Rasio nasabah lunas dari total nasabah</span></div></div>
    <div class="panel"><div class="panel-head"><div><h3>Per AO</h3><p>${isAdmin()?"Ringkasan nasabah berdasarkan AO":"Portofolio Anda"}</p></div></div><div class="ao-list">${byAO.map(a=>`<div class="ao-row"><span>${esc(a.name)}</span><b>${a.items.filter(r=>derivedStatus(r)==="Menunggak").length} menunggak</b><small>${a.items.length} nasabah</small></div>`).join("")||'<p class="muted">Belum ada data AO.</p>'}</div></div></div>
    <div class="panel"><div class="panel-head"><div><h3>Prioritas penagihan</h3><p>Nasabah menunggak dengan nominal terbesar</p></div><button class="text-btn" data-goto="monitoring">Lihat semua →</button></div>${table(late.sort((a,b)=>Number(b.arrears)-Number(a.arrears)).slice(0,6))}</div>`;
    $("#dashboardPage").querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>showPage(b.dataset.goto));
  }
  function bar(label,n,total,color){return `<div class="bar-row"><div><span>${label}</span><b>${n}</b></div><div class="bar-track"><i class="${color}" style="width:${total?Math.max(n/total*100,n?2:0):0}%"></i></div></div>`;}
  function table(list){if(!list.length)return '<div class="empty">Belum ada data untuk ditampilkan.</div>';return `<div class="table-wrap"><table><thead><tr><th>Nasabah</th><th>No. Rekening</th><th>AO</th><th>Jatuh tempo</th><th>Tunggakan</th><th>Status</th></tr></thead><tbody>${list.map(r=>`<tr><td><b>${esc(r.customer_name)}</b><small>${esc(r.collectibility||"-")}</small></td><td>${esc(r.account_no)}</td><td>${esc(r.ao_team?.name||"-")}</td><td>${dateID(r.due_date)}</td><td class="money">${fmt(r.arrears)}</td><td><span class="status ${statusClass(derivedStatus(r))}">${derivedStatus(r)}</span></td></tr>`).join("")}</tbody></table></div>`;}
  function renderCustomers(){if(!$("#customersPage"))return;const d=visibleRows();$("#customersPage").innerHTML=`<div class="panel"><div class="panel-head"><div><h3>Database nasabah</h3><p>${d.length} data dalam cakupan akses</p></div><input id="customerSearch" class="search" placeholder="Cari nama / rekening..."></div><div id="customerTable">${table(d)}</div></div>`;$("#customerSearch")?.addEventListener("input",e=>{$("#customerTable").innerHTML=table(d.filter(r=>(r.customer_name+" "+r.account_no).toLowerCase().includes(e.target.value.toLowerCase())));});}
  function renderMonitoring(){const d=visibleRows();$("#monitoringPage").innerHTML=`<div class="filter-row"><input id="monitorSearch" class="search" placeholder="Cari nasabah / rekening..."><select id="statusFilter"><option value="">Semua status</option><option>Menunggak</option><option>Jatuh tempo hari ini</option><option>Bayar sebagian</option><option>Lunas</option><option>Belum jatuh tempo</option></select></div><div class="panel"><div class="panel-head"><div><h3>Monitoring penagihan</h3><p>Status dihitung dari tanggal jatuh tempo dan status pembayaran terakhir.</p></div><span class="count">${d.length} nasabah</span></div><div id="monitorTable">${table(d)}</div></div>`;const update=()=>{let q=$("#monitorSearch").value.toLowerCase(),s=$("#statusFilter").value;$("#monitorTable").innerHTML=table(d.filter(r=>(r.customer_name+" "+r.account_no).toLowerCase().includes(q)&&(!s||derivedStatus(r)===s)));};$("#monitorSearch").oninput=update;$("#statusFilter").onchange=update;}
  function renderImport(){if(!isAdmin())return;$("#importPage").innerHTML=`<div class="content-grid"><div class="panel"><h3>Import data Excel</h3><p class="muted">Gunakan template resmi. Format .xlsx atau .xls. Data dengan nomor rekening sama akan memperbarui data terkini.</p><div class="upload-zone"><div class="upload-icon">⇧</div><b>Pilih file Excel</b><p>Unggah file laporan penagihan</p><input id="excelFile" type="file" accept=".xlsx,.xls"></div><div class="field"><label>Tanggal snapshot laporan</label><input id="snapshotDate" type="date" value="${today()}"></div><button id="importBtn" class="primary full">Validasi & impor data</button><p id="importMessage" class="message"></p></div><div class="panel"><h3>Aturan impor</h3><ul class="rules"><li>Nomor rekening wajib dan menjadi kunci pencocokan nasabah.</li><li>Nama AO harus sudah terdaftar pada menu Pengaturan.</li><li>Status: Lunas, Bayar sebagian, atau Belum bayar.</li><li>Import menyimpan snapshot harian untuk kebutuhan laporan historis.</li><li>Periksa hasil validasi sebelum melakukan impor.</li></ul><a class="download-link" href="./template_collection.xlsx" download>↓ Unduh template Excel</a></div></div>`;$("#importBtn").onclick=importExcel;}
  async function importExcel(){
    const f=$("#excelFile").files[0], msg=$("#importMessage");if(!f){msg.textContent="Pilih file Excel terlebih dahulu.";return;}
    if(!window.XLSX){msg.textContent="Library Excel belum tersedia. Hubungkan internet dan muat ulang.";return;}
    msg.textContent="Membaca dan memvalidasi file...";
    try{
      const wb=XLSX.read(await f.arrayBuffer(),{type:"array",cellDates:true}), sheet=wb.Sheets[wb.SheetNames[0]], raw=XLSX.utils.sheet_to_json(sheet,{defval:""});
      const required=["Nama nasabah","Nomor rekening","Nama AO","Angsuran","Tanggal jatuh tempo","Jumlah tunggakan","Status pembayaran","Kolektibilitas"];
      if(!raw.length)throw new Error("File tidak memiliki baris data.");
      const missing=required.filter(k=>!(k in raw[0]));if(missing.length)throw new Error("Kolom tidak ditemukan: "+missing.join(", "));
      const norm=s=>String(s||"").trim().toLowerCase();
      const errors=[], prepared=[];
      for(let i=0;i<raw.length;i++){
        const x=raw[i], line=i+2, ao=aoList.find(a=>norm(a.name)===norm(x["Nama AO"]));
        const account=String(x["Nomor rekening"]).trim();
        if(!account||!String(x["Nama nasabah"]).trim())errors.push(`Baris ${line}: nama nasabah dan nomor rekening wajib.`);
        if(!ao)errors.push(`Baris ${line}: AO "${x["Nama AO"]}" belum terdaftar.`);
        const st=String(x["Status pembayaran"]||"Belum bayar").trim();
        const allowed=["Lunas","Bayar sebagian","Belum bayar"];
        if(!allowed.includes(st))errors.push(`Baris ${line}: status harus ${allowed.join(", ")}.`);
        const due=excelDate(x["Tanggal jatuh tempo"]);
        if(!due)errors.push(`Baris ${line}: tanggal jatuh tempo tidak valid.`);
        prepared.push({account_no:account,customer_name:String(x["Nama nasabah"]).trim(),ao_id:ao?.id,installment:num(x["Angsuran"]),due_date:due,arrears:num(x["Jumlah tunggakan"]),payment_status:st,collectibility:String(x["Kolektibilitas"]||"").trim(),snapshot_date:$("#snapshotDate").value});
      }
      if(errors.length){msg.textContent=`Ditemukan ${errors.length} kesalahan. Contoh: ${errors.slice(0,5).join(" | ")}`;return;}
      const up=prepared.map(({snapshot_date,...r})=>r);
      const {error:e1}=await db.from("customers").upsert(up,{onConflict:"account_no"});
      if(e1)throw e1;
      const snap=prepared.map(r=>({account_no:r.account_no,customer_name:r.customer_name,ao_id:r.ao_id,installment:r.installment,due_date:r.due_date,arrears:r.arrears,payment_status:r.payment_status,collectibility:r.collectibility,snapshot_date:r.snapshot_date,imported_by:session.user.id}));
      const {error:e2}=await db.from("monitoring_snapshots").upsert(snap,{onConflict:"account_no,snapshot_date"});
      if(e2)throw e2;
      msg.textContent=`Berhasil mengimpor ${prepared.length} baris dan menyimpan snapshot ${dateID($("#snapshotDate").value)}.`;toast("Import Excel berhasil.");await loadData();
    }catch(e){msg.textContent="Import gagal: "+(e.message||e);toast("Import gagal.",true);}
  }
  function num(v){if(typeof v==="number")return v;return Number(String(v||0).replace(/[^\d,-]/g,"").replace(/\./g,"").replace(",", "."))||0;}
  function excelDate(v){if(v instanceof Date&&!isNaN(v))return v.toISOString().slice(0,10);if(typeof v==="number"){const d=XLSX.SSF.parse_date_code(v);return d?`${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`:null;}const s=String(v||"").trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`:null;}
  async function renderReports(){
    const d=visibleRows();$("#reportsPage").innerHTML=`<div class="filter-row"><select id="reportPeriod"><option value="month">Bulan berjalan</option><option value="year">Tahun berjalan</option></select><button class="secondary" id="loadHistory">Muat histori snapshot</button></div><div id="reportContent" class="panel"><h3>Ringkasan periode</h3><p class="muted">Pilih periode untuk melihat posisi data saat ini. Histori snapshot harian dapat dimuat dari database.</p>${table(d)}</div>`;
    $("#loadHistory").onclick=loadHistory;
  }
  async function loadHistory(){
    const period=$("#reportPeriod").value, start=period==="year"?`${today().slice(0,4)}-01-01`:today().slice(0,7)+"-01", end=today();
    let q=db.from("monitoring_snapshots").select("snapshot_date,arrears,payment_status,account_no,customer_name,ao_id,ao_team(name)").gte("snapshot_date",start).lte("snapshot_date",end).order("snapshot_date",{ascending:false});
    const {data,error}=await q;if(error){toast(error.message,true);return;}
    const list=data||[];const groups={};list.forEach(r=>{groups[r.snapshot_date]??={count:0,late:0,total:0};groups[r.snapshot_date].count++;if(r.payment_status!=="Lunas"){groups[r.snapshot_date].late++;groups[r.snapshot_date].total+=Number(r.arrears||0);}});
    $("#reportContent").innerHTML=`<h3>Histori snapshot ${period==="year"?"tahunan":"bulanan"}</h3><p class="muted">${list.length} catatan snapshot</p><div class="table-wrap"><table><thead><tr><th>Tanggal snapshot</th><th>Jumlah nasabah</th><th>Belum lunas</th><th>Nominal tunggakan</th></tr></thead><tbody>${Object.entries(groups).map(([day,g])=>`<tr><td>${dateID(day)}</td><td>${g.count}</td><td>${g.late}</td><td class="money">${fmt(g.total)}</td></tr>`).join("")||'<tr><td colspan="4">Belum ada histori.</td></tr>'}</tbody></table></div>`;
  }
  function renderSettings(){if(!isAdmin())return;$("#settingsPage").innerHTML=`<div class="content-grid"><div class="panel"><h3>Daftar AO terdaftar</h3><p class="muted">Daftar ini dikelola di database Supabase agar nama AO pada Excel dapat dicocokkan dengan aman.</p>${aoList.map(a=>`<div class="ao-row"><span>${esc(a.name)}</span><small>Aktif</small></div>`).join("")||'<div class="empty">Belum ada AO. Tambahkan melalui SQL sesuai README_SETUP.</div>'}</div><div class="panel"><h3>Keamanan & data</h3><ul class="rules"><li>Admin mengelola data dan import Excel.</li><li>AO hanya membaca nasabah dengan AO ID yang ditetapkan.</li><li>Row Level Security wajib aktif di Supabase.</li><li>Jangan membagikan publishable key bersama password atau service role key.</li></ul><p class="notice">Aplikasi ini adalah fondasi operasional. Lakukan uji akses admin/AO dan backup sebelum memakai data produksi.</p></div></div>`;}
  init();
})();