/* ============================================================
   Farm Management & Operations Dashboard
   ============================================================ */

let uidCounter = 1000;

// Generate a short unique ID with a given prefix
function uid(prefix){ return `${prefix}${uidCounter++}`; }

// Format the current date/time for log entries
function nowLabel(){
  return new Date().toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
}

// Get today's date as YYYY-MM-DD
function todayISO(){ return new Date().toISOString().slice(0,10); }

const STATUS_CYCLE = ["ok", "watch", "alert"];

// Cycle a status value to the next one in the sequence
function nextStatus(status){
  const i = STATUS_CYCLE.indexOf(status);
  return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
}

/* ---------- State (Track A) ----------
   All arrays below start empty — this is the live app, not a demo.
   Wire your backend in by replacing these consts with data fetched from
   your API (e.g. on init(), fetch each endpoint and populate these arrays,
   or replace the array contents in place before renderAll() runs). Each
   comment shows the object shape every render/action function expects. */

// { id, name, location, size }
const FARMS = [];

// { id, farmId, name, size, crop, stage, status: "ok"|"watch"|"alert" }
const FIELDS = [];

// { id, name, type, location, status }
const ASSETS = [];

// { id, name, role, fields, perms, status }
const TEAM = [];

/* ---------- State (Track B) ---------- */

// { id, crop, variety, notes }
const CROP_VARIETIES = [];

// { id, crop, field, planted, harvest, stage, status: "ok"|"watch"|"alert" }
const PLANTING = [];
const STAGES = ["Germination","Transplant","Vegetative","Flowering","Harvest ready"];

// { id, type, text, who, time }
const TREATMENTS = [];

// { id, field, text, severity: "ok"|"watch"|"alert", who, time }
const HEALTH_OBS = [];

// { id, crop, field, date, qty, unit }
const HARVESTS = [];

/* ---------- State (Track C) ---------- */

// { id, name, size, purpose, stage, status: "ok"|"watch"|"alert" }
const LIVESTOCK = [];

// { id, batch, text, who, time }
const LIVESTOCK_HEALTH = [];

// { id, batch, vaccine, due, status }
const VAX = [];

// { id, text, who, time }
const LIVESTOCK_LOG = [];

// { id, batch, metric, value, date }
const PRODUCTION = [];
const BREEDING = [];

/* ---------- State (Track D) ---------- */

// { id, item, cat, qty, unit, reorder }
const STOCK = [];

// { id, name, contact, category }
const SUPPLIERS = [];

// { id, type: "Request"|"Order", text, who, time, status }
const PO_LOG = [];

// { id, date, category, desc, amount } — append-only, current month only (see cost-form handler)
const COSTS = [];

// Limit the cost-entry date field to the current month
function setCostDateDefaults(){
  const dateEl = document.getElementById("cost-date");
  if (!dateEl) return;
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0,10);
  dateEl.min = firstDay;
  dateEl.max = lastDay;
  dateEl.value = todayISO();
}

/* ---------- State (Tasks) ---------- */

// { id, title, link, assignee, priority: "Low"|"Medium"|"High", deadline, status }
const TASKS = [];
const TASK_HISTORY = [];
const TASK_STATUSES = ["Pending", "In Progress", "Completed", "Cancelled"];

let offlineMode = false;
let offlineQueue = [];

/* ---------- Helpers ---------- */

// Build an on-track/watch/attention status badge
function statusBadge(status){
  const map = { ok:"On track", watch:"Watch", alert:"Attention" };
  return `<span class="badge ${status} clickable" data-cycle-status>${map[status] || status}</span>`;
}

// Build a healthy/watch/attention pill for fields and livestock
function fieldStatusPill(status){
  const map = { ok:"Healthy", watch:"Watch", alert:"Attention" };
  return `<span class="field-status ${status} clickable" data-cycle-status>${map[status] || status}</span>`;
}

// Build a task priority badge
function priorityBadge(p){
  const cls = p === "High" ? "alert" : (p === "Medium" ? "watch" : "ok");
  return `<span class="badge ${cls}">${p}</span>`;
}

/* ---------- Renderers: Farms & Fields ---------- */

// Fill the farm dropdowns used across forms
function renderFarmSelect(){
  const sel = document.getElementById("farm-select");
  sel.innerHTML = FARMS.map(f => `<option value="${f.id}">${f.name}</option>`).join("");
  const fieldFarmSel = document.getElementById("field-farm");
  if (fieldFarmSel) fieldFarmSel.innerHTML = FARMS.map(f => `<option value="${f.id}">${f.name}</option>`).join("");
}

// Draw the Farms table (read-only - one farm per account, from the backend)
function renderFarmsTable(){
  const tbody = document.querySelector("#farms-table tbody");
  if (!FARMS.length){
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--text-muted);">No farm loaded yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = FARMS.map(f => `
    <tr data-id="${f.id}">
      <td>${f.name}</td>
      <td>${f.location}</td>
      <td>${f.size}</td>
      <td></td>
    </tr>
  `).join("");
}

// Draw the Fields & Plots grid
function renderFieldGrid(){
  const el = document.getElementById("field-grid");
  if (!FIELDS.length){
    el.innerHTML = `<p class="hint">No fields or plots added yet.</p>`;
    return;
  }
  el.innerHTML = FIELDS.map(f => `
    <div class="field-tile" data-id="${f.id}">
      <div class="field-tile-head">
        <div>
          <div class="field-name">${f.name}</div>
          <div class="field-size">${f.size}</div>
        </div>
        <button class="chip-x" data-remove-field title="Remove field">×</button>
      </div>
      <div class="field-crop">${f.crop} · ${f.stage}</div>
      ${fieldStatusPill(f.status)}
    </div>
  `).join("");
}

// Draw the Assets table
function renderAssetsTable(){
  const tbody = document.querySelector("#assets-table tbody");
  if (!ASSETS.length){
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted);">No assets registered yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = ASSETS.map(a => `
    <tr data-id="${a.id}">
      <td>${a.name}</td>
      <td>${a.type}</td>
      <td>${a.location}</td>
      <td>
        <select data-asset-status>
          <option ${a.status==="Operational"?"selected":""}>Operational</option>
          <option ${a.status==="Maintenance"?"selected":""}>Maintenance</option>
          <option ${a.status==="Out of service"?"selected":""}>Out of service</option>
        </select>
      </td>
      <td><button class="chip-x" data-remove-asset title="Remove">×</button></td>
    </tr>
  `).join("");
}

// Draw the Users & Access table.
// TEAM items now come from the backend: { id, name, email, role, status,
// isActive }. Role and status controls are disabled for the signed-in
// user's own row and for the Owner row, mirroring rules UserController
// enforces server-side - the UI just avoids offering an action the backend
// would reject anyway.
//
// TEAM_SEARCH is set by backend.js's search box listener - kept as a plain
// global here (matching how TEAM itself is a plain global) rather than
// threading a parameter through, since nothing else calls this function
// with a different filter in mind.
let TEAM_SEARCH = "";

function renderTeamTable(){
  const tbody = document.querySelector("#team-table tbody");

  let rows = TEAM;
  if (TEAM_SEARCH) {
    const q = TEAM_SEARCH.toLowerCase();
    rows = TEAM.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      t.role.toLowerCase().includes(q)
    );
  }

  if (!rows.length){
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted);">${TEAM_SEARCH ? "No users match your search." : "No users added yet."}</td></tr>`;
    return;
  }

  const currentUserId = String(localStorage.getItem("userId") || "");
  const assignableRoles = ["Manager", "Worker", "Agronomist", "Technician"];

  tbody.innerHTML = rows.map(t => {
    const isSelf = String(t.id) === currentUserId;
    const isOwner = t.role === "Owner";
    const locked = isSelf || isOwner;

    const roleControl = locked
      ? `<span class="badge role">${t.role}</span>`
      : `<select data-role-select data-id="${t.id}" data-current-role="${t.role}">
           ${assignableRoles.map(r => `<option value="${r}" ${r === t.role ? "selected" : ""}>${r}</option>`).join("")}
         </select>`;

    const statusControl = locked
      ? `<span class="badge ${t.isActive ? "ok" : "alert"}">${t.status}</span>`
      : `<button type="button" class="chip-x" data-toggle-status data-id="${t.id}" data-active="${t.isActive}" title="${t.isActive ? "Deactivate" : "Activate"}">
           ${t.isActive ? "🟢" : "⚪"}
         </button>`;

    return `
      <tr data-id="${t.id}">
        <td>${t.name}</td>
        <td>${t.email}</td>
        <td>${roleControl}</td>
        <td>${statusControl}</td>
        <td></td>
      </tr>
    `;
  }).join("");
}

/* ---------- Renderers: Crop Lifecycle ---------- */

// Draw the Crop Varieties table
function renderVarietyTable(){
  const tbody = document.querySelector("#variety-table tbody");
  if (!CROP_VARIETIES.length){
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--text-muted);">No varieties registered yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = CROP_VARIETIES.map(v => `
    <tr data-id="${v.id}">
      <td>${v.crop}</td>
      <td>${v.variety}</td>
      <td>${v.notes || "—"}</td>
      <td><button class="chip-x" data-remove-variety title="Remove">×</button></td>
    </tr>
  `).join("");
}

// Draw the crop lifecycle stage board
function renderStageBoard(){
  const el = document.getElementById("stage-board");
  el.innerHTML = STAGES.map(stage => {
    const crops = PLANTING.filter(p => p.stage === stage);
    return `
      <div class="stage-col">
        <h4>${stage}</h4>
        ${crops.map(c => `<div class="stage-crop">${c.crop}<br><span style="color:var(--text-muted);font-size:0.72rem;">${c.field}</span></div>`).join("") || `<div style="font-size:0.75rem;color:var(--text-muted);">—</div>`}
      </div>
    `;
  }).join("");
}

// Draw the Plantings table
function renderPlantingTable(){
  const tbody = document.querySelector("#planting-table tbody");
  if (!PLANTING.length){
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--text-muted);">No plantings scheduled yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = PLANTING.map(p => `
    <tr data-id="${p.id}">
      <td>${p.crop}</td>
      <td>${p.field}</td>
      <td>${p.planted}</td>
      <td>${p.harvest}</td>
      <td>
        <select data-advance-stage>
          ${STAGES.map(s => `<option value="${s}" ${s === p.stage ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
      <td>${statusBadge(p.status)}</td>
      <td><button class="chip-x" data-remove-planting title="Remove">×</button></td>
    </tr>
  `).join("");
}

// Draw a simple activity log list (shared by several logs)
function renderLogList(elId, items, onRemoveAttr, typeKey){
  const el = document.getElementById(elId);
  if (!items.length){
    el.innerHTML = `<li><span style="color:var(--text-muted);">No entries yet.</span></li>`;
    return;
  }
  el.innerHTML = items.map(i => `
    <li data-id="${i.id}">
      <span>${typeKey && i[typeKey] ? `<span class="tag-inline">${i[typeKey]}</span> ` : ""}${i.text}${i.who ? ` <span style="color:var(--text-muted);">— ${i.who}</span>` : ""}</span>
      <span class="log-time">${i.time || ""} <button class="chip-x" ${onRemoveAttr} title="Remove">×</button></span>
    </li>
  `).join("");
}

// Draw the Crop Health Observations log
function renderHealthObsLog(){
  const el = document.getElementById("health-obs-log");
  if (!HEALTH_OBS.length){
    el.innerHTML = `<li><span style="color:var(--text-muted);">No observations logged.</span></li>`;
    return;
  }
  const map = { ok:"Normal", watch:"Watch", alert:"Critical" };
  el.innerHTML = HEALTH_OBS.map(o => `
    <li data-id="${o.id}">
      <span><span class="badge ${o.severity}">${map[o.severity]}</span> <strong>${o.field}</strong> — ${o.text} <span style="color:var(--text-muted);">— ${o.who}</span></span>
      <span class="log-time">${o.time} <button class="chip-x" data-remove-obs title="Remove">×</button></span>
    </li>
  `).join("");
}

// Draw the Harvests table
function renderHarvestTable(){
  const tbody = document.querySelector("#harvest-table tbody");
  if (!HARVESTS.length){
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted);">No harvests recorded yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = HARVESTS.map(h => `
    <tr data-id="${h.id}">
      <td>${h.crop}</td>
      <td>${h.field}</td>
      <td>${h.date}</td>
      <td>${h.qty} ${h.unit}</td>
      <td><button class="chip-x" data-remove-harvest title="Remove">×</button></td>
    </tr>
  `).join("");
}

/* ---------- Renderers: Livestock ---------- */

// Draw the Livestock grid
function renderLivestockGrid(){
  const el = document.getElementById("livestock-grid");
  if (!LIVESTOCK.length){
    el.innerHTML = `<p class="hint">No batches or herds registered yet.</p>`;
    return;
  }
  el.innerHTML = LIVESTOCK.map(l => `
    <div class="field-tile" data-id="${l.id}">
      <div class="field-tile-head">
        <div>
          <div class="field-name">${l.name}</div>
          <div class="field-size">${l.size}</div>
        </div>
        <button class="chip-x" data-remove-livestock title="Remove batch">×</button>
      </div>
      <div class="field-crop">${l.purpose} · ${l.stage}</div>
      ${fieldStatusPill(l.status)}
    </div>
  `).join("");
}

// Draw the Vaccinations table
function renderVaxTable(){
  const tbody = document.querySelector("#vax-table tbody");
  if (!VAX.length){
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted);">No vaccinations scheduled yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = VAX.map(v => `
    <tr data-id="${v.id}">
      <td>${v.batch}</td>
      <td>${v.vaccine}</td>
      <td>${v.due}</td>
      <td>${statusBadge(v.status)}</td>
      <td><button class="chip-x" data-remove-vax title="Remove">×</button></td>
    </tr>
  `).join("");
}

// Draw the Production Records table
function renderProductionTable(){
  const tbody = document.querySelector("#production-table tbody");
  if (!PRODUCTION.length){
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted);">No production records yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = PRODUCTION.map(p => `
    <tr data-id="${p.id}">
      <td>${p.batch}</td>
      <td>${p.metric}</td>
      <td>${p.value}</td>
      <td>${p.date}</td>
      <td><button class="chip-x" data-remove-production title="Remove">×</button></td>
    </tr>
  `).join("");
}

/* ---------- Renderers: Inventory ---------- */

// Work out a stock item's status from its quantity vs reorder level
function recomputeStockStatus(s){
  if (s.qty <= s.reorder * 0.5) return "alert";
  if (s.qty <= s.reorder) return "watch";
  return "ok";
}

// Draw the Stock/Inventory table
function renderStockTable(){
  const tbody = document.querySelector("#stock-table tbody");
  if (!STOCK.length){
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--text-muted);">No stock items added yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = STOCK.map(s => `
    <tr data-id="${s.id}">
      <td>${s.item}</td>
      <td>${s.cat}</td>
      <td>
        <span class="qty-control">
          <button class="qty-btn" data-qty-delta="-1">−</button>
          <span class="qty-value">${s.qty} ${s.unit}</span>
          <button class="qty-btn" data-qty-delta="1">+</button>
        </span>
      </td>
      <td>${s.reorder} ${s.unit}</td>
      <td>${statusBadge(recomputeStockStatus(s))}</td>
      <td><button class="chip-x" data-remove-stock title="Remove">×</button></td>
    </tr>
  `).join("");
}

// Draw the Suppliers table
function renderSuppliersTable(){
  const tbody = document.querySelector("#suppliers-table tbody");
  if (!SUPPLIERS.length){
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--text-muted);">No suppliers added yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = SUPPLIERS.map(s => `
    <tr data-id="${s.id}">
      <td>${s.name}</td>
      <td>${s.contact}</td>
      <td>${s.category}</td>
      <td><button class="chip-x" data-remove-supplier title="Remove">×</button></td>
    </tr>
  `).join("");
}

// Build a request/order status badge
function poStatusBadge(status){
  const map = { Pending:"watch", Approved:"ok", Placed:"watch", Supplied:"ok" };
  return `<span class="badge ${map[status] || "watch"}">${status}</span>`;
}

// Draw the Requests & Orders log
function renderPoLog(){
  const el = document.getElementById("po-log");
  if (!PO_LOG.length){
    el.innerHTML = `<li><span style="color:var(--text-muted);">No requests or orders yet.</span></li>`;
    return;
  }
  el.innerHTML = PO_LOG.map(p => `
    <li data-id="${p.id}">
      <span>
        <span class="tag-inline">${p.type}</span>
        ${p.text}
        <span style="color:var(--text-muted);">— ${p.who}</span>
        ${poStatusBadge(p.status)}
      </span>
      <span class="log-time">
        ${p.time}
        ${p.type === "Request" && p.status === "Pending" ? `<button class="mini-btn" data-approve-po>Approve</button>` : ""}
        ${p.type === "Order" && p.status === "Placed" ? `<button class="mini-btn" data-mark-supplied>Mark as supplied</button>` : ""}
        <button class="chip-x" data-remove-po title="Remove">×</button>
      </span>
    </li>
  `).join("");
}

// Get the YYYY-MM key for a date string
function monthKey(dateStr){ return dateStr ? dateStr.slice(0,7) : ""; }

// Format a YYYY-MM key as a readable month/year
function monthLabel(key){
  if (!key) return "";
  const [y,m] = key.split("-");
  return new Date(Number(y), Number(m)-1, 1).toLocaleDateString([], { month:"long", year:"numeric" });
}

// Fill the cost month filter dropdown with months that have records
function populateCostMonthFilter(){
  const sel = document.getElementById("cost-month-filter");
  const prev = sel.value;
  const months = Array.from(new Set(COSTS.map(c => monthKey(c.date)))).sort().reverse();
  sel.innerHTML = `<option value="all">All months</option>` +
    months.map(m => `<option value="${m}">${monthLabel(m)}</option>`).join("");
  if (months.includes(prev)) sel.value = prev;
}

// Get the month currently selected in the cost filter
function selectedCostMonth(){
  const sel = document.getElementById("cost-month-filter");
  return sel ? sel.value : "all";
}

// Get the cost records for the selected month
function costsForSelectedMonth(){
  const month = selectedCostMonth();
  return month === "all" ? COSTS.slice() : COSTS.filter(c => monthKey(c.date) === month);
}

// Draw the cost summary cards
function renderFinanceGrid(){
  const el = document.getElementById("finance-grid");
  const rows = costsForSelectedMonth();
  const byCategory = {};
  rows.forEach(c => { byCategory[c.category] = (byCategory[c.category] || 0) + c.amount; });
  const total = rows.reduce((sum,c) => sum + c.amount, 0);
  const month = selectedCostMonth();
  const label = month === "all" ? "All recorded months" : monthLabel(month);

  const cards = [{ label:`Total — ${label}`, value: total, sub:`${rows.length} entries`, main:true }]
    .concat(Object.keys(byCategory).map(cat => ({ label:cat, value:byCategory[cat], sub:"" })));

  el.innerHTML = cards.map(i => `
    <div class="stat-card${i.main ? " bad" : ""}">
      <div class="stat-label">${i.label}</div>
      <div class="stat-value">R ${i.value.toLocaleString()}</div>
      <div class="stat-sub">${i.sub}</div>
    </div>
  `).join("");
}

// Draw the Operating Costs table
function renderCostTable(){
  const tbody = document.querySelector("#cost-table tbody");
  const rows = costsForSelectedMonth().slice().sort((a,b) => b.date.localeCompare(a.date));
  if (!rows.length){
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--text-muted);">No cost records for this period.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(c => `
    <tr data-id="${c.id}">
      <td>${c.date}</td>
      <td>${c.category}</td>
      <td>${c.desc}</td>
      <td>R ${c.amount.toLocaleString()}</td>
    </tr>
  `).join("");
}

// Escape a value for safe inclusion in a CSV file
function csvEscape(val){
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Build and download a CSV file of cost records
function downloadCostsCSV(rows, filename){
  const header = ["Date","Category","Description","Amount (R)"];
  const lines = [header.join(",")].concat(
    rows.map(c => [c.date, c.category, c.desc, c.amount].map(csvEscape).join(","))
  );
  const blob = new Blob([lines.join("\n")], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------- Renderers: Tasks ---------- */

// Draw the full Tasks table
function renderTaskTable(){
  const tbody = document.querySelector("#task-table tbody");
  if (!TASKS.length){
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--text-muted);">No tasks assigned yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = TASKS.map(t => `
    <tr data-id="${t.id}">
      <td>${t.title}</td>
      <td>${t.link || "—"}</td>
      <td>${t.assignee}</td>
      <td>${priorityBadge(t.priority)}</td>
      <td>${t.deadline}</td>
      <td>
        <select data-task-status>
          ${TASK_STATUSES.map(s => `<option ${s === t.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
      <td><button class="chip-x" data-remove-task title="Remove">×</button></td>
    </tr>
  `).join("");
}

// Draw the outstanding-tasks list on the Overview tab
function renderTasksToday(){
  const el = document.getElementById("tasks-today");
  const dueToday = TASKS.filter(t => t.status !== "Completed" && t.status !== "Cancelled")
    .sort((a,b) => (a.priority === "High" ? -1 : 1));
  if (!dueToday.length){
    el.innerHTML = `<li><span style="color:var(--text-muted);">Nothing outstanding.</span></li>`;
  } else {
    el.innerHTML = dueToday.slice(0, 6).map(t => `
      <li data-id="${t.id}">
        <span class="task-dot" data-quick-complete title="Mark completed"></span>
        <div>
          <div>${t.title}</div>
          <span class="task-meta">${t.link || "General"} · ${t.priority} priority · due ${t.deadline}</span>
        </div>
      </li>
    `).join("");
  }
  document.getElementById("tasks-count").textContent = dueToday.length;
}

/* ---------- Renderers: Overview ---------- */

// { id, text, meta, level: "medium"|"high" }
const OVERVIEW_ALERTS = [];

// Draw the general notifications list on the Overview tab
function renderAlerts(){
  const el = document.getElementById("overview-alerts");
  if (!OVERVIEW_ALERTS.length){
    el.innerHTML = `<li><span style="color:var(--text-muted);">No active alerts.</span></li>`;
  } else {
    el.innerHTML = OVERVIEW_ALERTS.map(a => `
      <li data-id="${a.id}">
        <span class="alert-dot ${a.level === "high" ? "high" : ""}"></span>
        <div style="flex:1;">
          <div>${a.text}</div>
          <span class="alert-meta">${a.meta}</span>
        </div>
        <button class="chip-x" data-remove-alert title="Dismiss">×</button>
      </li>
    `).join("");
  }
  document.getElementById("alerts-count").textContent = OVERVIEW_ALERTS.length;
}

// Draw the pending-approvals list on the Overview tab
function renderPendingApprovals(){
  const el = document.getElementById("pending-approvals");
  const pending = PO_LOG.filter(p => p.type === "Request" && p.status === "Pending");
  if (!pending.length){
    el.innerHTML = `<li><span style="color:var(--text-muted);">Nothing awaiting approval.</span></li>`;
    return;
  }
  el.innerHTML = pending.map(p => `
    <li data-id="${p.id}">
      <span>${p.text} <span style="color:var(--text-muted);">— requested by ${p.who}</span></span>
      <span class="log-time">${p.time} <button class="mini-btn" data-approve-po>Approve</button></span>
    </li>
  `).join("");
}

// Draw the supplier order status list on the Overview tab
function renderSupplierStatus(){
  const el = document.getElementById("supplier-status");
  if (!el) return;
  const orders = PO_LOG.filter(p => p.type === "Order");
  if (!orders.length){
    el.innerHTML = `<li><span style="color:var(--text-muted);">No supplier orders yet.</span></li>`;
    return;
  }
  el.innerHTML = orders.map(p => `
    <li data-id="${p.id}">
      <span>${p.text} <span style="color:var(--text-muted);">— ${p.who}</span> ${poStatusBadge(p.status)}</span>
      <span class="log-time">
        ${p.time}
        ${p.status === "Placed" ? `<button class="mini-btn" data-mark-supplied>Mark as supplied</button>` : ""}
      </span>
    </li>
  `).join("");
}

/* ---------- Overview: live performance charts ---------- */

function chartEsc(value){
  return String(value ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function chartEmpty(message){
  return `<div class="chart-empty">${chartEsc(message)}</div>`;
}

function svgChartShell(width, height, body, labels = ""){
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${body}</svg>${labels}`;
}

function renderCategoryBars(targetId, rows, options = {}){
  const el = document.getElementById(targetId);
  if (!el) return;
  if (!rows.length){ el.innerHTML = chartEmpty(options.empty || "No data available yet."); return; }

  const width = 620, height = 245;
  const pad = { top: 18, right: 18, bottom: 45, left: 38 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...rows.map(r => Number(r.value) || 0));
  const step = plotW / rows.length;
  const barW = Math.min(58, step * .58);
  const tickCount = 4;
  let body = "";

  for(let i=0;i<=tickCount;i++){
    const value = max * i / tickCount;
    const y = pad.top + plotH - (value / max) * plotH;
    body += `<line class="chart-grid-line" x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width-pad.right}" y2="${y.toFixed(1)}"/>`;
    body += `<text class="chart-label" x="${pad.left-7}" y="${(y+4).toFixed(1)}" text-anchor="end">${Math.round(value)}</text>`;
  }
  body += `<line class="chart-axis" x1="${pad.left}" y1="${pad.top+plotH}" x2="${width-pad.right}" y2="${pad.top+plotH}"/>`;

  rows.forEach((r,i)=>{
    const value = Math.max(0, Number(r.value) || 0);
    const barH = value ? Math.max(2, (value/max)*plotH) : 0;
    const x = pad.left + i*step + (step-barW)/2;
    const y = pad.top + plotH - barH;
    const cls = r.className ? ` ${r.className}` : "";
    body += `<rect class="chart-bar${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="5"/>`;
    body += `<text class="chart-value" x="${(x+barW/2).toFixed(1)}" y="${Math.max(12,y-6).toFixed(1)}" text-anchor="middle">${chartEsc(value)}</text>`;
    body += `<text class="chart-label" x="${(x+barW/2).toFixed(1)}" y="${height-20}" text-anchor="middle">${chartEsc(r.label)}</text>`;
  });
  el.innerHTML = svgChartShell(width,height,body);
}

function renderInventoryChart(){
  const el = document.getElementById("chart-inventory-levels");
  if (!el) return;
  if (!STOCK.length){ el.innerHTML = chartEmpty("No inventory items recorded yet."); return; }

  const rows = STOCK.slice(0,8).map(s=>({
    label: String(s.item || "Item").length > 13 ? String(s.item).slice(0,12)+"…" : String(s.item || "Item"),
    value: Math.max(0,Number(s.qty)||0),
    reorder: Math.max(0,Number(s.reorder)||0),
    status: recomputeStockStatus(s)
  }));
  const width=620,height=245,pad={top:18,right:18,bottom:48,left:38};
  const plotW=width-pad.left-pad.right,plotH=height-pad.top-pad.bottom;
  const max=Math.max(1,...rows.flatMap(r=>[r.value,r.reorder]));
  const step=plotW/rows.length, groupW=Math.min(72,step*.68), barW=Math.max(8,(groupW-7)/2);
  let body="";
  for(let i=0;i<=4;i++){
    const value=max*i/4,y=pad.top+plotH-(value/max)*plotH;
    body+=`<line class="chart-grid-line" x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width-pad.right}" y2="${y.toFixed(1)}"/>`;
    body+=`<text class="chart-label" x="${pad.left-7}" y="${(y+4).toFixed(1)}" text-anchor="end">${Math.round(value)}</text>`;
  }
  body+=`<line class="chart-axis" x1="${pad.left}" y1="${pad.top+plotH}" x2="${width-pad.right}" y2="${pad.top+plotH}"/>`;
  rows.forEach((r,i)=>{
    const groupX=pad.left+i*step+(step-groupW)/2;
    const qtyH=(r.value/max)*plotH, reorderH=(r.reorder/max)*plotH;
    const qtyClass=r.status==="alert"?" danger":(r.status==="watch"?" warn":"");
    const qy=pad.top+plotH-qtyH, ry=pad.top+plotH-reorderH;
    body+=`<rect class="chart-bar${qtyClass}" x="${groupX.toFixed(1)}" y="${qy.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0,qtyH).toFixed(1)}" rx="4"/>`;
    body+=`<rect class="chart-reorder" x="${(groupX+barW+7).toFixed(1)}" y="${ry.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0,reorderH).toFixed(1)}" rx="4"/>`;
    body+=`<text class="chart-value" x="${(groupX+barW/2).toFixed(1)}" y="${Math.max(12,qy-5).toFixed(1)}" text-anchor="middle">${chartEsc(r.value)}</text>`;
    body+=`<text class="chart-label" x="${(groupX+groupW/2).toFixed(1)}" y="${height-20}" text-anchor="middle">${chartEsc(r.label)}</text>`;
  });
  el.innerHTML=svgChartShell(width,height,body,`<div class="chart-legend"><span class="chart-legend-item"><i class="chart-legend-dot"></i>Current stock</span><span class="chart-legend-item"><i class="chart-legend-dot reorder"></i>Reorder level</span></div>`);
}

function renderPerformanceCharts(){
  const cropCounts = STAGES.map(stage=>({label:stage === "Harvest ready" ? "Harvest" : stage.replace(" ","\n"),value:PLANTING.filter(p=>p.stage===stage).length}));
  renderCategoryBars("chart-crop-lifecycle",cropCounts,{empty:"No crop plantings recorded yet."});

  const livestockStatuses = ["ok","watch","alert"].map(status=>({
    label:status === "ok" ? "Healthy" : status === "watch" ? "Watch" : "Attention",
    value:LIVESTOCK.filter(x=>x.status===status).length,
    className:status === "alert" ? "danger" : status === "watch" ? "warn" : ""
  }));
  renderCategoryBars("chart-livestock-status",livestockStatuses,{empty:"No livestock batches recorded yet."});

  const taskCounts = TASK_STATUSES.map(status=>({label:status === "In Progress" ? "In progress" : status,value:TASKS.filter(t=>t.status===status).length}));
  renderCategoryBars("chart-task-progress",taskCounts,{empty:"No workforce tasks recorded yet."});

  renderInventoryChart();
}

// Draw the Overview summary stat cards and refresh the urgent-attention feed
function renderOverviewStats(){
  const el = document.getElementById("stat-grid");
  const alertFields = FIELDS.filter(f => f.status === "alert").length;
  const watchFields = FIELDS.filter(f => f.status === "watch").length;
  const lowStock = STOCK.filter(s => recomputeStockStatus(s) !== "ok").length;
  // Settings > Preferences > "Highlight low-stock items on the Overview tab".
  // Defaults on; only reads as "false" once the person explicitly turns it off.
  const lowStockAlertsEnabled = localStorage.getItem("pref-low-stock-alerts") !== "false";
  const stats = [
    { label:"Active farms", value:FARMS.length, sub:`${FIELDS.length} fields / plots`, cls:"" },
    { label:"Fields needing attention", value: alertFields + watchFields, sub:`${alertFields} urgent, ${watchFields} watch`, cls: alertFields ? "bad" : (watchFields ? "warn" : "") },
    { label:"Livestock batches", value:LIVESTOCK.length, sub:`${LIVESTOCK.length} active batches`, cls:"" },
    { label:"Stock items to reorder", value:lowStock, sub:"below minimum threshold", cls: (lowStock && lowStockAlertsEnabled) ? "warn" : "" },
    { label:"Open tasks", value:TASKS.filter(t=>t.status!=="Completed"&&t.status!=="Cancelled").length, sub:`${TASKS.filter(t=>t.status==="Completed").length} completed`, cls:"" },
    { label:"Team members", value:TEAM.length, sub:`${TEAM.filter(t=>t.status==="Active").length} active`, cls:"" },
  ];
  el.innerHTML = stats.map(s => `
    <div class="stat-card ${s.cls}">
      <div class="stat-label">${s.label}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-sub">${s.sub}</div>
    </div>
  `).join("");

  renderCriticalAlerts();
  renderPerformanceCharts();
}

/* ---------- Renderers: Overview — critical / emergency attention ----------
   Pulls anything flagged "alert" (or effectively overdue/critical) from every
   tab's own data, live. A record only ever needs to be updated in its own
   tab — this list rebuilds itself from that status, it isn't maintained
   separately. */

// Collect every record flagged critical/overdue across all tabs
function getCriticalItems(){
  const items = [];

  FIELDS.filter(f => f.status === "alert").forEach(f => items.push({
    tab:"farms", tabLabel:"Farms & Fields",
    text:`${f.name} — ${f.crop} (${f.stage})`,
    meta:"Field flagged critical",
  }));

  HEALTH_OBS.filter(o => o.severity === "alert").forEach(o => items.push({
    tab:"crops", tabLabel:"Crop Lifecycle",
    text:`${o.field} — ${o.text}`,
    meta:`Crop health · ${o.who} · ${o.time}`,
  }));

  LIVESTOCK.filter(l => l.status === "alert").forEach(l => items.push({
    tab:"livestock", tabLabel:"Livestock",
    text:`${l.name} — ${l.purpose} (${l.stage})`,
    meta:"Batch/herd flagged critical",
  }));

  VAX.filter(v => v.due < todayISO()).forEach(v => items.push({
    tab:"livestock", tabLabel:"Livestock",
    text:`${v.batch} — ${v.vaccine} overdue`,
    meta:`Was due ${v.due}`,
  }));

  STOCK.filter(s => recomputeStockStatus(s) === "alert").forEach(s => items.push({
    tab:"inventory", tabLabel:"Inventory & Procurement",
    text:`${s.item} critically low — ${s.qty} ${s.unit} left`,
    meta:`Reorder threshold: ${s.reorder} ${s.unit}`,
  }));

  OVERVIEW_ALERTS.filter(a => a.level === "high").forEach(a => items.push({
    tab:"overview", tabLabel:"Notifications",
    text:a.text,
    meta:a.meta,
  }));

  return items;
}

// Draw the Overview 'Needs urgent attention' feed
function renderCriticalAlerts(){
  const el = document.getElementById("critical-alerts");
  const card = document.getElementById("critical-card");
  const countEl = document.getElementById("critical-count");
  if (!el || !card) return;

  const items = getCriticalItems();
  countEl.textContent = items.length;
  card.classList.toggle("emergency", items.length > 0);

  if (!items.length){
    el.innerHTML = `<li><span style="color:var(--text-muted);">Nothing needs urgent attention right now.</span></li>`;
    return;
  }
  el.innerHTML = items.map(it => `
    <li>
      <span><span class="alert-dot high"></span> <strong>${it.text}</strong><br /><span class="alert-meta">${it.meta}</span></span>
      <span class="log-time">
        <span class="tag-inline">${it.tabLabel}</span>
        <button class="mini-btn" data-goto-tab="${it.tab}">Open tab</button>
      </span>
    </li>
  `).join("");
}

/* ---------- Renderers: Reports ---------- */

// Combine every log/record type into one activity feed
function buildActivityFeed(){
  const feed = [];
  TREATMENTS.forEach(t => feed.push({ type:"Treatment", details:`${t.type}: ${t.text}`, by:t.who, when:t.time }));
  HEALTH_OBS.forEach(o => feed.push({ type:"Health observation", details:`${o.field} — ${o.text}`, by:o.who, when:o.time }));
  HARVESTS.forEach(h => feed.push({ type:"Harvest", details:`${h.crop} (${h.field}) — ${h.qty} ${h.unit}`, by:"—", when:h.date }));
  LIVESTOCK_HEALTH.forEach(l => feed.push({ type:"Livestock health", details:`${l.batch} — ${l.text}`, by:l.who, when:l.time }));
  PRODUCTION.forEach(p => feed.push({ type:"Production", details:`${p.batch} — ${p.metric}: ${p.value}`, by:"—", when:p.date }));
  LIVESTOCK_LOG.forEach(l => feed.push({ type:"Feed/mortality", details:l.text, by:l.who, when:l.time }));
  PO_LOG.forEach(p => feed.push({ type:"Procurement", details:`${p.type}: ${p.text}`, by:p.who, when:p.time }));
  TASKS.filter(t => t.status === "Completed" || t.status === "Cancelled").forEach(t => feed.push({ type:"Task", details:`${t.title} (${t.link || "General"}) — ${t.status}`, by:t.assignee, when:t.deadline }));
  return feed;
}

// Draw the filtered Reports table
function renderReportTable(){
  const typeFilter = document.getElementById("report-type-filter").value;
  const search = document.getElementById("report-search").value.trim().toLowerCase();
  const tbody = document.querySelector("#report-table tbody");
  let feed = buildActivityFeed();
  if (typeFilter !== "all") feed = feed.filter(r => r.type === typeFilter);
  if (search) feed = feed.filter(r => (r.details + " " + r.by).toLowerCase().includes(search));

  if (!feed.length){
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--text-muted);">No matching records.</td></tr>`;
    return;
  }
  tbody.innerHTML = feed.map(r => `
    <tr>
      <td><span class="tag-inline">${r.type}</span></td>
      <td>${r.details}</td>
      <td>${r.by}</td>
      <td>${r.when}</td>
    </tr>
  `).join("");
}

/* ---------- Misc ---------- */

// Fill the field dropdown used by the quick field-log form
function populateQuickLogFieldSelect(){
  const sel = document.getElementById("ql-field");
  sel.innerHTML = FIELDS.map(f => `<option value="${f.id}">${f.name} — ${f.crop}</option>`).join("");
}

// Redraw every tab from current data (called on load and after key changes)
function renderAll(){
  renderFarmSelect();
  renderFarmsTable();
  renderFieldGrid();
  renderAssetsTable();
  renderTeamTable();
  renderVarietyTable();
  renderStageBoard();
  renderPlantingTable();
  renderLogList("treatment-log", TREATMENTS, "data-remove-treatment", "type");
  renderHealthObsLog();
  renderHarvestTable();
  renderLivestockGrid();
  renderLogList("livestock-health-log", LIVESTOCK_HEALTH, "data-remove-livestock-health");
  renderVaxTable();
  renderLogList("livestock-log", LIVESTOCK_LOG, "data-remove-livestock-log");
  renderProductionTable();
  renderStockTable();
  renderSuppliersTable();
  renderPoLog();
  populateCostMonthFilter();
  renderFinanceGrid();
  renderCostTable();
  renderTaskTable();
  renderTasksToday();
  renderAlerts();
  renderPendingApprovals();
  renderSupplierStatus();
  renderOverviewStats();
  renderReportTable();
  populateQuickLogFieldSelect();
}

/* ---------- Tabs ---------- */
// Switch the active tab and panel
function goToTab(tabName){
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tabName));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  const panel = document.getElementById(`panel-${tabName}`);
  if (panel) panel.classList.add("active");
}

// Wire up the top navigation tab buttons
function initTabs(){
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      goToTab(btn.dataset.tab);
      // Auto-close on mobile after picking a tab - without this, every
      // navigation would leave the menu open, covering the page you just
      // asked to see.
      const rail = document.getElementById("rail");
      if (rail) rail.classList.remove("nav-open");
    });
  });

  const mobileToggle = document.getElementById("mobile-nav-toggle");
  const rail = document.getElementById("rail");
  if (mobileToggle && rail) {
    mobileToggle.addEventListener("click", () => rail.classList.toggle("nav-open"));
  }
}

/* Sidebar sign-in status — currently a static placeholder ("Not signed in").
   Once the backend login is wired up, update it on successful sign-in, e.g.:
     const statusEl = document.getElementById("user-status");
     document.getElementById("user-status-text").textContent = user.name;
     statusEl.classList.add("signed-in"); */

/* ---------- Forms: add new records ---------- */
// Wire up every 'add new record' form
function initForms(){
  // The farm-form was removed from index.html - one farm per account is set
  // at registration, and there's no update-farm endpoint on the backend yet
  // (see docs/DASHBOARD-CONNECTION.md). The farms table is now populated by
  // backend.js from GET /api/Farm/my-farm instead of this local push.

  document.getElementById("field-form").addEventListener("submit", e => {
    e.preventDefault();
    FIELDS.push({
      id: uid("f"),
      farmId: document.getElementById("field-farm").value,
      name: document.getElementById("field-name").value.trim(),
      size: document.getElementById("field-size").value.trim(),
      crop: document.getElementById("field-crop").value.trim(),
      stage: document.getElementById("field-stage").value.trim(),
      status: "ok",
    });
    e.target.reset();
    renderFieldGrid(); renderOverviewStats(); populateQuickLogFieldSelect();
  });

  document.getElementById("asset-form").addEventListener("submit", e => {
    e.preventDefault();
    ASSETS.push({
      id: uid("a"),
      name: document.getElementById("asset-name").value.trim(),
      type: document.getElementById("asset-type").value,
      location: document.getElementById("asset-location").value.trim(),
      status: "Operational",
    });
    e.target.reset();
    renderAssetsTable();
  });

  // team-form submission is handled entirely by backend.js (POST
  // /api/User), since adding a user is a real backend action with fields
  // (email, mobile, password) this original handler never had. No listener
  // is attached here for team-form - see backend.js's initTeamForm().

  document.getElementById("variety-form").addEventListener("submit", e => {
    e.preventDefault();
    CROP_VARIETIES.push({
      id: uid("cv"),
      crop: document.getElementById("var-crop").value.trim(),
      variety: document.getElementById("var-name").value.trim(),
      notes: document.getElementById("var-notes").value.trim(),
    });
    e.target.reset();
    renderVarietyTable();
  });

  document.getElementById("planting-form").addEventListener("submit", e => {
    e.preventDefault();
    PLANTING.push({
      id: uid("p"),
      crop: document.getElementById("pl-crop").value.trim(),
      field: document.getElementById("pl-field").value.trim(),
      planted: document.getElementById("pl-planted").value,
      harvest: document.getElementById("pl-harvest").value,
      stage: "Germination",
      status: "ok",
    });
    e.target.reset();
    renderStageBoard(); renderPlantingTable();
  });

  document.getElementById("treatment-form").addEventListener("submit", e => {
    e.preventDefault();
    TREATMENTS.unshift({
      id: uid("tr"),
      type: document.getElementById("treatment-type").value,
      text: document.getElementById("treatment-text").value.trim(),
      who: document.getElementById("treatment-who").value.trim(),
      time: nowLabel(),
    });
    e.target.reset();
    renderLogList("treatment-log", TREATMENTS, "data-remove-treatment", "type");
  });

  document.getElementById("health-obs-form").addEventListener("submit", e => {
    e.preventDefault();
    HEALTH_OBS.unshift({
      id: uid("ho"),
      field: document.getElementById("obs-field").value.trim(),
      severity: document.getElementById("obs-severity").value,
      text: document.getElementById("obs-text").value.trim(),
      who: document.getElementById("obs-who").value.trim(),
      time: nowLabel(),
    });
    e.target.reset();
    renderHealthObsLog(); renderOverviewStats();
  });

  document.getElementById("harvest-form").addEventListener("submit", e => {
    e.preventDefault();
    HARVESTS.unshift({
      id: uid("hv"),
      crop: document.getElementById("hv-crop").value.trim(),
      field: document.getElementById("hv-field").value.trim(),
      date: document.getElementById("hv-date").value,
      qty: Number(document.getElementById("hv-qty").value),
      unit: document.getElementById("hv-unit").value.trim(),
    });
    e.target.reset();
    renderHarvestTable();
  });

  document.getElementById("livestock-form").addEventListener("submit", e => {
    e.preventDefault();
    LIVESTOCK.push({
      id: uid("l"),
      name: document.getElementById("ls-name").value.trim(),
      size: document.getElementById("ls-size").value.trim(),
      purpose: document.getElementById("ls-purpose").value.trim(),
      stage: document.getElementById("ls-stage").value.trim(),
      status: "ok",
    });
    e.target.reset();
    renderLivestockGrid(); renderOverviewStats();
  });

  document.getElementById("livestock-health-form").addEventListener("submit", e => {
    e.preventDefault();
    LIVESTOCK_HEALTH.unshift({
      id: uid("lh"),
      batch: document.getElementById("lh-batch").value.trim(),
      text: document.getElementById("lh-text").value.trim(),
      who: document.getElementById("lh-who").value.trim(),
      time: nowLabel(),
    });
    e.target.reset();
    renderLogList("livestock-health-log", LIVESTOCK_HEALTH, "data-remove-livestock-health");
  });

  document.getElementById("vax-form").addEventListener("submit", e => {
    e.preventDefault();
    VAX.push({
      id: uid("v"),
      batch: document.getElementById("vax-batch").value.trim(),
      vaccine: document.getElementById("vax-vaccine").value.trim(),
      due: document.getElementById("vax-due").value,
      status: "watch",
    });
    e.target.reset();
    renderVaxTable(); renderOverviewStats();
  });

  document.getElementById("livestock-log-form").addEventListener("submit", e => {
    e.preventDefault();
    LIVESTOCK_LOG.unshift({
      id: uid("ll"),
      text: document.getElementById("ls-log-text").value.trim(),
      who: document.getElementById("ls-log-who").value.trim(),
      time: nowLabel(),
    });
    e.target.reset();
    renderLogList("livestock-log", LIVESTOCK_LOG, "data-remove-livestock-log");
  });

  document.getElementById("production-form").addEventListener("submit", e => {
    e.preventDefault();
    PRODUCTION.unshift({
      id: uid("pr"),
      batch: document.getElementById("prod-batch").value.trim(),
      metric: document.getElementById("prod-metric").value.trim(),
      value: document.getElementById("prod-value").value.trim(),
      date: document.getElementById("prod-date").value,
    });
    e.target.reset();
    renderProductionTable();
  });

  document.getElementById("stock-form").addEventListener("submit", e => {
    e.preventDefault();
    STOCK.push({
      id: uid("s"),
      item: document.getElementById("stock-item").value.trim(),
      cat: document.getElementById("stock-cat").value.trim(),
      qty: Number(document.getElementById("stock-qty").value),
      unit: document.getElementById("stock-unit").value.trim(),
      reorder: Number(document.getElementById("stock-reorder").value),
    });
    e.target.reset();
    renderStockTable(); renderOverviewStats();
  });

  document.getElementById("supplier-form").addEventListener("submit", e => {
    e.preventDefault();
    SUPPLIERS.push({
      id: uid("sup"),
      name: document.getElementById("sup-name").value.trim(),
      contact: document.getElementById("sup-contact").value.trim(),
      category: document.getElementById("sup-cat").value.trim(),
    });
    e.target.reset();
    renderSuppliersTable();
  });

  document.getElementById("po-form").addEventListener("submit", e => {
    e.preventDefault();
    const type = document.getElementById("po-type").value;
    PO_LOG.unshift({
      id: uid("po"),
      type,
      text: document.getElementById("po-text").value.trim(),
      who: document.getElementById("po-who").value.trim(),
      time: nowLabel(),
      status: type === "Request" ? "Pending" : "Placed",
    });
    e.target.reset();
    renderPoLog(); renderPendingApprovals(); renderSupplierStatus();
  });

  document.getElementById("cost-form").addEventListener("submit", e => {
    e.preventDefault();
    const dateEl = document.getElementById("cost-date");
    if (monthKey(dateEl.value) !== monthKey(todayISO())){
      alert("You can only add costs for the current month. Earlier months are locked — use the month filter to download their records instead.");
      return;
    }
    COSTS.push({
      id: uid("cost"),
      date: dateEl.value,
      category: document.getElementById("cost-category").value,
      desc: document.getElementById("cost-desc").value.trim(),
      amount: Number(document.getElementById("cost-amount").value),
    });
    e.target.reset();
    setCostDateDefaults();
    populateCostMonthFilter(); renderFinanceGrid(); renderCostTable();
  });

  document.getElementById("cost-month-filter").addEventListener("change", () => {
    renderFinanceGrid(); renderCostTable();
  });

  document.getElementById("cost-download-month").addEventListener("click", () => {
    const rows = costsForSelectedMonth();
    const month = selectedCostMonth();
    const suffix = month === "all" ? "all-months" : month;
    if (!rows.length){ alert("No cost records for this period."); return; }
    downloadCostsCSV(rows, `operating-costs-${suffix}.csv`);
  });

  document.getElementById("cost-download-range").addEventListener("click", () => {
    const from = document.getElementById("cost-range-from").value;
    const to = document.getElementById("cost-range-to").value;
    if (!from || !to){ alert("Pick both a from and to date."); return; }
    const rows = COSTS.filter(c => c.date >= from && c.date <= to);
    if (!rows.length){ alert("No cost records in that date range."); return; }
    downloadCostsCSV(rows, `operating-costs-${from}_to_${to}.csv`);
  });

  document.getElementById("full-task-form").addEventListener("submit", e => {
    e.preventDefault();
    TASKS.unshift({
      id: uid("task"),
      title: document.getElementById("ft-title").value.trim(),
      link: document.getElementById("ft-link").value.trim(),
      assignee: document.getElementById("ft-assignee").value.trim(),
      priority: document.getElementById("ft-priority").value,
      deadline: document.getElementById("ft-deadline").value,
      status: "Pending",
    });
    e.target.reset();
    renderTaskTable(); renderTasksToday(); renderOverviewStats();
  });

  document.getElementById("report-type-filter").addEventListener("change", renderReportTable);
  document.getElementById("report-search").addEventListener("input", renderReportTable);
}

/* ---------- Delegated click/change handlers ---------- */
// Handle clicks and changes on dynamically rendered rows (event delegation)
function initActions(){
  document.addEventListener("click", e => {
    const statusEl = e.target.closest("[data-cycle-status]");
    if (statusEl){
      const row = statusEl.closest("[data-id]");
      const id = row.dataset.id;
      const record =
        FIELDS.find(f => f.id === id) ||
        LIVESTOCK.find(l => l.id === id) ||
        PLANTING.find(p => p.id === id) ||
        VAX.find(v => v.id === id);
      if (record){
        record.status = nextStatus(record.status);
        renderFieldGrid(); renderLivestockGrid(); renderPlantingTable(); renderVaxTable(); renderOverviewStats();
      }
      return;
    }

    if (e.target.closest("[data-remove-field]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const i = FIELDS.findIndex(f => f.id === id);
      if (i > -1) FIELDS.splice(i, 1);
      renderFieldGrid(); renderOverviewStats(); populateQuickLogFieldSelect();
      return;
    }
    if (e.target.closest("[data-remove-asset]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const i = ASSETS.findIndex(a => a.id === id);
      if (i > -1) ASSETS.splice(i, 1);
      renderAssetsTable();
      return;
    }
    // data-remove-team was removed along with its button: the backend has
    // no delete-user endpoint, only activate/deactivate (PUT
    // /api/User/{id}/status), which backend.js wires up separately since it
    // needs a network call, not a local array splice.
    if (e.target.closest("[data-remove-variety]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const i = CROP_VARIETIES.findIndex(v => v.id === id);
      if (i > -1) CROP_VARIETIES.splice(i, 1);
      renderVarietyTable();
      return;
    }
    if (e.target.closest("[data-remove-planting]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const i = PLANTING.findIndex(p => p.id === id);
      if (i > -1) PLANTING.splice(i, 1);
      renderStageBoard(); renderPlantingTable();
      return;
    }
    if (e.target.closest("[data-remove-treatment]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const i = TREATMENTS.findIndex(t => t.id === id);
      if (i > -1) TREATMENTS.splice(i, 1);
      renderLogList("treatment-log", TREATMENTS, "data-remove-treatment", "type");
      return;
    }
    if (e.target.closest("[data-remove-obs]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const i = HEALTH_OBS.findIndex(o => o.id === id);
      if (i > -1) HEALTH_OBS.splice(i, 1);
      renderHealthObsLog(); renderOverviewStats();
      return;
    }
    if (e.target.closest("[data-remove-harvest]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const i = HARVESTS.findIndex(h => h.id === id);
      if (i > -1) HARVESTS.splice(i, 1);
      renderHarvestTable();
      return;
    }
    if (e.target.closest("[data-remove-livestock]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const i = LIVESTOCK.findIndex(l => l.id === id);
      if (i > -1) LIVESTOCK.splice(i, 1);
      renderLivestockGrid(); renderOverviewStats();
      return;
    }
    if (e.target.closest("[data-remove-livestock-health]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const i = LIVESTOCK_HEALTH.findIndex(l => l.id === id);
      if (i > -1) LIVESTOCK_HEALTH.splice(i, 1);
      renderLogList("livestock-health-log", LIVESTOCK_HEALTH, "data-remove-livestock-health");
      return;
    }
    if (e.target.closest("[data-remove-vax]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const i = VAX.findIndex(v => v.id === id);
      if (i > -1) VAX.splice(i, 1);
      renderVaxTable(); renderOverviewStats();
      return;
    }
    if (e.target.closest("[data-remove-livestock-log]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const i = LIVESTOCK_LOG.findIndex(l => l.id === id);
      if (i > -1) LIVESTOCK_LOG.splice(i, 1);
      renderLogList("livestock-log", LIVESTOCK_LOG, "data-remove-livestock-log");
      return;
    }
    if (e.target.closest("[data-remove-production]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const i = PRODUCTION.findIndex(p => p.id === id);
      if (i > -1) PRODUCTION.splice(i, 1);
      renderProductionTable();
      return;
    }
    if (e.target.closest("[data-remove-stock]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const i = STOCK.findIndex(s => s.id === id);
      if (i > -1) STOCK.splice(i, 1);
      renderStockTable(); renderOverviewStats();
      return;
    }
    if (e.target.closest("[data-remove-supplier]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const i = SUPPLIERS.findIndex(s => s.id === id);
      if (i > -1) SUPPLIERS.splice(i, 1);
      renderSuppliersTable();
      return;
    }
    if (e.target.closest("[data-approve-po]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const p = PO_LOG.find(p => p.id === id);
      if (p) p.status = "Approved";
      renderPoLog(); renderPendingApprovals(); renderSupplierStatus();
      return;
    }
    if (e.target.closest("[data-mark-supplied]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const p = PO_LOG.find(p => p.id === id);
      if (p) p.status = "Supplied";
      renderPoLog(); renderSupplierStatus();
      return;
    }
    if (e.target.closest("[data-remove-po]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const i = PO_LOG.findIndex(p => p.id === id);
      if (i > -1) PO_LOG.splice(i, 1);
      renderPoLog(); renderPendingApprovals(); renderSupplierStatus();
      return;
    }
    if (e.target.closest("[data-remove-alert]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const i = OVERVIEW_ALERTS.findIndex(a => a.id === id);
      if (i > -1) OVERVIEW_ALERTS.splice(i, 1);
      renderAlerts();
      return;
    }
    if (e.target.closest("[data-remove-task]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const i = TASKS.findIndex(t => t.id === id);
      if (i > -1) TASKS.splice(i, 1);
      renderTaskTable(); renderTasksToday(); renderOverviewStats();
      return;
    }
    if (e.target.closest("[data-quick-complete]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const t = TASKS.find(t => t.id === id);
      if (t) t.status = "Completed";
      renderTaskTable(); renderTasksToday(); renderOverviewStats();
      return;
    }

    const gotoBtn = e.target.closest("[data-goto-tab]");
    if (gotoBtn){
      goToTab(gotoBtn.dataset.gotoTab);
      return;
    }

    const qtyBtn = e.target.closest("[data-qty-delta]");
    if (qtyBtn){
      const id = qtyBtn.closest("[data-id]").dataset.id;
      const s = STOCK.find(s => s.id === id);
      if (s){
        const delta = Number(qtyBtn.dataset.qtyDelta);
        const step = s.qty >= 100 ? 10 : (s.qty >= 20 ? 5 : 1);
        s.qty = Math.max(0, s.qty + delta * step);
      }
      renderStockTable(); renderOverviewStats();
      return;
    }
  });

  document.addEventListener("change", e => {
    if (e.target.matches("[data-advance-stage]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const p = PLANTING.find(p => p.id === id);
      if (p) p.stage = e.target.value;
      renderStageBoard();
      return;
    }
    if (e.target.matches("[data-asset-status]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const a = ASSETS.find(a => a.id === id);
      if (a) a.status = e.target.value;
      return;
    }
    if (e.target.matches("[data-task-status]")){
      const id = e.target.closest("[data-id]").dataset.id;
      const t = TASKS.find(t => t.id === id);
      if (t) t.status = e.target.value;
      renderTasksToday(); renderOverviewStats();
      return;
    }
  });
}

/* ---------- Log from the field (offline queue) ---------- */
// Wire up the offline field-log queue widget
function initOfflineDemo(){
  const toggle = document.getElementById("offline-toggle");
  const pill = document.getElementById("sync-pill");
  const syncText = document.getElementById("sync-text");
  const submit = document.getElementById("ql-submit");
  const queueEl = document.getElementById("offline-queue");

  toggle.addEventListener("click", () => {
    offlineMode = !offlineMode;
    toggle.textContent = offlineMode ? "Offline mode: On" : "Offline mode: Off";
    toggle.classList.toggle("is-offline", offlineMode);
    pill.classList.toggle("offline", offlineMode);
    syncText.textContent = offlineMode ? "Offline — queued locally" : "Synced";

    if (!offlineMode && offlineQueue.length){
      setTimeout(() => {
        offlineQueue = offlineQueue.map(item => ({ ...item, synced:true }));
        renderQueue();
      }, 900);
    }
  });

  submit.addEventListener("click", () => {
    const fieldSel = document.getElementById("ql-field");
    const noteEl = document.getElementById("ql-note");
    const note = noteEl.value.trim();
    if (!note) return;
    const fieldName = fieldSel.options[fieldSel.selectedIndex] ? fieldSel.options[fieldSel.selectedIndex].text : "Unassigned";
    const entry = {
      text: `${fieldName}: ${note}`,
      time: new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }),
      synced: !offlineMode,
    };
    offlineQueue.unshift(entry);
    noteEl.value = "";
    renderQueue();
  });

  // Draw the offline field-log queue list
  function renderQueue(){
    if (!offlineQueue.length){
      queueEl.innerHTML = `<li><span style="color:var(--text-muted);">No entries yet — try logging one above.</span></li>`;
      return;
    }
    queueEl.innerHTML = offlineQueue.map(e => `
      <li>
        <span>${e.text}</span>
        <span class="log-time">${e.synced ? "✓ synced" : "⏳ queued"} · ${e.time}</span>
      </li>
    `).join("");
  }

  renderQueue();
}

/* ---------- Init ---------- */
// App entry point — render initial state and wire up all interactivity
function init(){
  renderAll();
  setCostDateDefaults();

  initTabs();
  initForms();
  initActions();
  initOfflineDemo();
}

document.addEventListener("DOMContentLoaded", init);
