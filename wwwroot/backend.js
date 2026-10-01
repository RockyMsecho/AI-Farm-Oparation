/* ============================================================
   Backend integration.

   Backend integration:
     - Session / sign out
     - Farm, Users, Reports and Shifts
     - Crop Lifecycle, Livestock, Inventory and Tasks
     - Greenhouses and Growing Zones
   The operations modules below load from and save to SQL Server through the
   ASP.NET Core API. The existing render functions are reused so the UI stays
   consistent while the browser arrays act only as a view cache.
   ============================================================ */

const API_BASE_URL = window.location.hostname === "localhost"
    ? window.location.origin
    : "https://localhost:5226";

// Keep all frontend API traffic in one place. If the backend port changes,
// update this value only.
const API_ORIGIN = API_BASE_URL.replace(/\/$/, "");


/* ---------- authenticated fetch ---------- */

async function authFetch(path, options = {}) {
    const token = localStorage.getItem("token");

    const response = await fetch(`${API_ORIGIN}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...(options.headers || {})
        }
    });

    if (response.status === 401) {
        // Token missing, expired, or rejected - there's no refresh-token
        // flow built, so the only correct move is to sign the person out
        // cleanly rather than show a dashboard that can't load anything.
        localStorage.clear();
        window.location.replace("./auth.html");
        throw new Error("Session expired");
    }

    return response;
}

async function readJson(response) {
    try { return await response.json(); } catch { return {}; }
}

function explainConnectionError(error, action = "complete this action") {
    console.error(`${action} failed:`, error);
    if (window.location.protocol === "file:") {
        return `Open https://localhost:5226/auth.html first, then use the dashboard from there.`;
    }
    if (error?.name === "TypeError" || error?.message?.toLowerCase().includes("failed to fetch")) {
        return `Secure API connection failed at ${API_ORIGIN}. Run TRUST-HTTPS-CERTIFICATE.ps1 and make sure the backend is running.`;
    }
    return `Couldn’t ${action}: ${error?.message || "unknown error"}`;
}


/* ---------- toast notifications ----------
   Replaces alert() for the errors/success messages scattered through Users,
   Reports and Shifts below. A blocking browser alert() stops the whole page
   until dismissed and looks nothing like the rest of the dashboard; this
   just drops a small card into the corner and lets it fade on its own. */

function showToast(message, kind = "error") {
    const stack = document.getElementById("toast-stack");
    if (!stack) { console.log(`[toast:${kind}]`, message); return; }

    const toast = document.createElement("div");
    toast.className = `toast ${kind}`;
    toast.textContent = message;
    stack.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("fade-out");
        toast.addEventListener("animationend", () => toast.remove());
    }, 4500);
}


/* ---------- session / sign out ---------- */

function renderSessionStatus() {
    const statusEl = document.getElementById("user-status");
    const textEl = document.getElementById("user-status-text");

    const username = localStorage.getItem("username");
    const role = localStorage.getItem("role");

    if (username) {
        statusEl.classList.add("signed-in");
        textEl.textContent = `${username} · ${role || ""}`;
    }
}

document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.clear();
    window.location.replace("./auth.html");
});


/* ---------- farm (read-only) ---------- */

async function loadFarm() {
    try {
        const response = await authFetch("/api/Farm/my-farm");
        const data = await readJson(response);

        if (!response.ok) {
            console.error("Could not load farm:", data.message || response.status);
            return;
        }

        FARMS.length = 0;
        FARMS.push({
            id: String(data.id),
            name: data.farmName,
            location: data.farmLocation,
            size: `${data.farmArea} ${data.areaUnit}`
        });

        renderFarmSelect();
        renderFarmsTable();
        renderOverviewStats();

        // Only ever one farm per account right now - the select exists for
        // when/if that changes, but there's nothing to choose between yet.
        const farmSelect = document.getElementById("farm-select");
        if (farmSelect) farmSelect.disabled = true;

        // Show the actual farm name prominently, right under the product
        // brand at the top of the sidebar - not just tucked into the
        // select. This is the answer to "which farm am I in?"
        const brandSub = document.querySelector(".brand-sub");
        if (brandSub) brandSub.textContent = data.farmName;

        const settingsFarm = document.getElementById("settings-farm");
        if (settingsFarm) settingsFarm.textContent = `${data.farmName} — ${data.farmLocation}`;

    } catch (error) {
        if (error.message !== "Session expired") {
            console.error("Farm request failed:", error);
        }
    }
}


/* ---------- settings: account details ---------- */

function renderAccountSettings() {
    const nameEl = document.getElementById("settings-name");
    const emailEl = document.getElementById("settings-email");
    const roleEl = document.getElementById("settings-role");
    if (!nameEl) return;

    nameEl.textContent = localStorage.getItem("username") || "—";
    emailEl.textContent = localStorage.getItem("email") || "—";
    roleEl.textContent = localStorage.getItem("role") || "—";
    // settings-farm is filled in by loadFarm() once the farm request returns
}


/* ---------- settings: change password (PUT /api/Auth/change-password) ---------- */

function initChangePassword() {
    const form = document.getElementById("change-password-form");
    if (!form) return;

    const banner = document.getElementById("password-banner");

    function showPasswordBanner(message, kind) {
        banner.textContent = message;
        banner.className = `hint visible ${kind}`;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const currentPassword = document.getElementById("current-password").value;
        const newPassword = document.getElementById("new-password").value;
        const confirmNewPassword = document.getElementById("confirm-new-password").value;

        if (newPassword !== confirmNewPassword) {
            showPasswordBanner("New passwords do not match.", "error");
            return;
        }

        const submitButton = form.querySelector("button[type=submit]");
        submitButton.disabled = true;

        try {
            const response = await authFetch("/api/Auth/change-password", {
                method: "PUT",
                body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword })
            });

            const data = await readJson(response);

            if (!response.ok) {
                showPasswordBanner(data.message || "Could not update password.", "error");
                return;
            }

            form.reset();
            showPasswordBanner(data.message || "Password updated.", "success");

        } catch (error) {
            if (error.message !== "Session expired") {
                console.error("Change password request failed:", error);
                showPasswordBanner("Couldn't reach the server.", "error");
            }
        } finally {
            submitButton.disabled = false;
        }
    });
}


/* ---------- settings: preferences (local only, not sent anywhere) ---------- */

function initPreferences() {
    const compactToggle = document.getElementById("pref-compact-tables");
    const lowStockToggle = document.getElementById("pref-low-stock-alerts");
    if (!compactToggle) return;

    compactToggle.checked = localStorage.getItem("pref-compact-tables") === "true";
    document.body.classList.toggle("compact-tables", compactToggle.checked);

    lowStockToggle.checked = localStorage.getItem("pref-low-stock-alerts") !== "false"; // default on

    compactToggle.addEventListener("change", () => {
        localStorage.setItem("pref-compact-tables", String(compactToggle.checked));
        document.body.classList.toggle("compact-tables", compactToggle.checked);
    });

    lowStockToggle.addEventListener("change", () => {
        localStorage.setItem("pref-low-stock-alerts", String(lowStockToggle.checked));
        renderOverviewStats();
    });
}


/* ---------- team / users ---------- */

function mapUserToTeamRow(u) {
    return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        status: u.isActive ? "Active" : "Inactive"
    };
}

async function loadTeam() {
    const role = localStorage.getItem("role");
    const canManageUsers = role === "Owner" || role === "Manager";

    if (!canManageUsers) {
        // Worker/Agronomist/Technician accounts don't have the users.view
        // permission - the backend would return 403 for this request. No
        // point making it and confusing the console; show why instead.
        const tbody = document.querySelector("#team-table tbody");
        tbody.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted);">Only Owners and Managers can view and manage users.</td></tr>`;
        document.getElementById("team-form").style.display = "none";
        renderOverviewSnapshot();
        return;
    }

    try {
        const response = await authFetch("/api/User");
        const data = await readJson(response);

        if (!response.ok) {
            console.error("Could not load users:", data.message || response.status);
            return;
        }

        TEAM.length = 0;
        data.forEach(u => TEAM.push(mapUserToTeamRow(u)));

        renderTeamTable();
        renderOverviewStats();
        renderOverviewSnapshot();

    } catch (error) {
        if (error.message !== "Session expired") {
            console.error("User list request failed:", error);
        }
    }
}

function initTeamForm() {
    const searchInput = document.getElementById("team-search");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            TEAM_SEARCH = searchInput.value.trim();
            renderTeamTable();
        });
    }

    document.getElementById("team-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        const fullName = document.getElementById("team-name").value.trim();
        const email = document.getElementById("team-email").value.trim();
        const mobile = document.getElementById("team-mobile").value.trim();
        const role = document.getElementById("team-role").value;
        const password = document.getElementById("team-password").value;

        if (!role) {
            showToast("Select a role for the new user.");
            return;
        }

        try {
            const response = await authFetch("/api/User", {
                method: "POST",
                body: JSON.stringify({
                    fullName, email, mobile, role,
                    password, confirmPassword: password
                })
            });

            const data = await readJson(response);

            if (!response.ok) {
                const validationText = data.errors ? Object.values(data.errors).flat().join(" ") : null;
                showToast(data.message || validationText || "Could not add user.");
                return;
            }

            document.getElementById("team-form").reset();
            await loadTeam();
            showToast("User added.", "success");

        } catch (error) {
            if (error.message !== "Session expired") {
                console.error("Create user request failed:", error);
                showToast(explainConnectionError(error, "add the user"));
            }
        }
    });
}

function initTeamRowActions() {
    document.getElementById("team-table").addEventListener("change", async (event) => {
        const select = event.target.closest("[data-role-select]");
        if (!select) return;

        const userId = select.dataset.id;
        const previousRole = select.dataset.currentRole;
        const newRole = select.value;

        try {
            const response = await authFetch(`/api/User/${userId}/role`, {
                method: "PUT",
                body: JSON.stringify({ role: newRole })
            });

            const data = await readJson(response);

            if (!response.ok) {
                showToast(data.message || "Could not update role.");
                select.value = previousRole; // revert the dropdown
                return;
            }

            await loadTeam();
            showToast("Role updated.", "success");

        } catch (error) {
            if (error.message !== "Session expired") {
                console.error("Role update failed:", error);
                select.value = previousRole;
            }
        }
    });

    document.getElementById("team-table").addEventListener("click", async (event) => {
        const button = event.target.closest("[data-toggle-status]");
        if (!button) return;

        const userId = button.dataset.id;
        const isCurrentlyActive = button.dataset.active === "true";

        try {
            const response = await authFetch(`/api/User/${userId}/status`, {
                method: "PUT",
                body: JSON.stringify({ isActive: !isCurrentlyActive })
            });

            const data = await readJson(response);

            if (!response.ok) {
                showToast(data.message || "Could not update status.");
                return;
            }

            await loadTeam();
            showToast("Status updated.", "success");

        } catch (error) {
            if (error.message !== "Session expired") {
                console.error("Status update failed:", error);
            }
        }
    });
}


/* ---------- farm structure: greenhouses & zones ---------- */

let GREENHOUSES = [];
let ZONES = [];

function canManageFarmStructure() {
    const role = localStorage.getItem("role");
    return role === "Owner" || role === "Manager";
}

function renderGreenhouses() {
    const tbody = document.querySelector("#greenhouse-table tbody");
    const zoneSelect = document.getElementById("zone-greenhouse");
    if (!tbody) return;

    if (!GREENHOUSES.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-row">No greenhouses have been added yet.</td></tr>`;
    } else {
        tbody.innerHTML = GREENHOUSES.map(g => `
            <tr>
                <td>${escapeHtml(g.greenhouseName)}</td>
                <td>${escapeHtml(g.greenhouseType)}</td>
                <td>${g.area} ${escapeHtml(g.areaUnit || "m²")}</td>
                <td>${escapeHtml(g.location)}</td>
                <td>${g.zoneCount ?? ZONES.filter(z => z.greenhouseId === g.id).length}</td>
                <td><span class="badge role">${escapeHtml(g.status || "Active")}</span></td>
            </tr>
        `).join("");
    }

    if (zoneSelect) {
        zoneSelect.innerHTML = `<option value="">Select greenhouse</option>` + GREENHOUSES.map(g =>
            `<option value="${g.id}">${escapeHtml(g.greenhouseName)}</option>`
        ).join("");
    }
}

function renderZones() {
    const tbody = document.querySelector("#zone-table tbody");
    if (!tbody) return;

    if (!ZONES.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-row">No zones have been added yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = ZONES.map(z => {
        const greenhouse = GREENHOUSES.find(g => g.id === z.greenhouseId);
        return `
            <tr>
                <td>${escapeHtml(z.zoneName)}</td>
                <td>${escapeHtml(z.zoneType || "—")}</td>
                <td>${z.area} ${escapeHtml(z.areaUnit || "m²")}</td>
                <td>${escapeHtml(greenhouse?.greenhouseName || `#${z.greenhouseId}`)}</td>
                <td><span class="badge role">${escapeHtml(z.status || "active")}</span></td>
                <td>${z.id}</td>
            </tr>
        `;
    }).join("");
}

async function loadFarmStructure() {
    try {
        const [greenhouseResponse, zoneResponse] = await Promise.all([
            authFetch("/api/Greenhouse"),
            authFetch("/api/Zone")
        ]);

        const greenhouseData = await readJson(greenhouseResponse);
        const zoneData = await readJson(zoneResponse);

        if (!greenhouseResponse.ok) {
            throw new Error(greenhouseData.message || `Greenhouse request failed (${greenhouseResponse.status})`);
        }
        if (!zoneResponse.ok) {
            throw new Error(zoneData.message || `Zone request failed (${zoneResponse.status})`);
        }

        GREENHOUSES = Array.isArray(greenhouseData) ? greenhouseData : [];
        ZONES = Array.isArray(zoneData) ? zoneData : [];
        renderGreenhouses();
        renderZones();

        const manage = canManageFarmStructure();
        const greenhouseForm = document.getElementById("greenhouse-form");
        const zoneForm = document.getElementById("zone-form");
        if (greenhouseForm) greenhouseForm.style.display = manage ? "" : "none";
        if (zoneForm) zoneForm.style.display = manage ? "" : "none";

    } catch (error) {
        if (error.message !== "Session expired") {
            console.error("Farm structure request failed:", error);
            const tbody = document.querySelector("#greenhouse-table tbody");
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Could not load farm structure. ${escapeHtml(error.message)}</td></tr>`;
        }
    }
}

function initFarmStructureForms() {
    const greenhouseForm = document.getElementById("greenhouse-form");
    const zoneForm = document.getElementById("zone-form");
    if (!greenhouseForm || !zoneForm) return;

    greenhouseForm.addEventListener("submit", async event => {
        event.preventDefault();
        const button = greenhouseForm.querySelector("button[type=submit]");
        button.disabled = true;
        try {
            const response = await authFetch("/api/Greenhouse", {
                method: "POST",
                body: JSON.stringify({
                    greenhouseName: document.getElementById("greenhouse-name").value.trim(),
                    greenhouseType: document.getElementById("greenhouse-type").value.trim(),
                    area: Number(document.getElementById("greenhouse-area").value),
                    location: document.getElementById("greenhouse-location").value.trim(),
                    farmId: Number(localStorage.getItem("farmId") || 0)
                })
            });
            const data = await readJson(response);
            if (!response.ok) {
                showToast(data.message || `Could not create greenhouse (${response.status}).`);
                return;
            }
            greenhouseForm.reset();
            showToast(data.message || "Greenhouse created successfully.", "success");
            await loadFarmStructure();
        } catch (error) {
            if (error.message !== "Session expired") showToast(explainConnectionError(error, "create the greenhouse"));
        } finally { button.disabled = false; }
    });

    zoneForm.addEventListener("submit", async event => {
        event.preventDefault();
        const button = zoneForm.querySelector("button[type=submit]");
        button.disabled = true;
        try {
            const response = await authFetch("/api/Zone", {
                method: "POST",
                body: JSON.stringify({
                    zoneName: document.getElementById("zone-name").value.trim(),
                    zoneType: document.getElementById("zone-type").value.trim(),
                    area: Number(document.getElementById("zone-area").value),
                    areaUnit: "m²",
                    status: "active",
                    greenhouseId: Number(document.getElementById("zone-greenhouse").value)
                })
            });
            const data = await readJson(response);
            if (!response.ok) {
                showToast(data.message || `Could not create zone (${response.status}).`);
                return;
            }
            zoneForm.reset();
            showToast(data.message || "Zone created successfully.", "success");
            await loadFarmStructure();
        } catch (error) {
            if (error.message !== "Session expired") showToast(explainConnectionError(error, "create the zone"));
        } finally { button.disabled = false; }
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* ---------- shift clock in/out ----------
   The backend has fully implemented this (Step 5: POST
   /api/shifts/clock-in, /clock-out, GET /api/shifts/current) but nothing in
   the dashboard used it before now. Available to every role - everyone who
   logs work needs a shift, not just field staff. */

let currentShiftState = { isClockedIn: false, clockInUtc: null };

function renderShiftWidget() {
    const dot = document.getElementById("shift-dot");
    const text = document.getElementById("shift-status-text");
    const button = document.getElementById("shift-clock-btn");

    button.disabled = false;

    if (currentShiftState.isClockedIn) {
        dot.classList.add("on");
        const since = new Date(currentShiftState.clockInUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        text.textContent = `Clocked in since ${since}`;
        button.textContent = "Clock Out";
        button.classList.add("is-clocked-in");
    } else {
        dot.classList.remove("on");
        text.textContent = "Not clocked in";
        button.textContent = "Clock In";
        button.classList.remove("is-clocked-in");
    }
}

async function loadShiftStatus() {
    try {
        const response = await authFetch("/api/Shifts/current");
        const data = await readJson(response);

        if (!response.ok) {
            console.error("Could not load shift status:", data.message || response.status);
            return;
        }

        currentShiftState = { isClockedIn: data.isClockedIn, clockInUtc: data.clockInUtc };
        renderShiftWidget();

    } catch (error) {
        if (error.message !== "Session expired") {
            console.error("Shift status request failed:", error);
        }
    }
}

document.getElementById("shift-clock-btn").addEventListener("click", async () => {
    const button = document.getElementById("shift-clock-btn");
    const endpoint = currentShiftState.isClockedIn ? "/api/Shifts/clock-out" : "/api/Shifts/clock-in";

    button.disabled = true;

    try {
        const response = await authFetch(endpoint, { method: "POST", body: JSON.stringify({}) });
        const data = await readJson(response);

        if (!response.ok) {
            showToast(data.message || "Could not update your shift.");
            button.disabled = false;
            return;
        }

        await loadShiftStatus();

    } catch (error) {
        if (error.message !== "Session expired") {
            console.error("Clock in/out request failed:", error);
            button.disabled = false;
        }
    }
});


/* ---------- role / permission management ----------
   The authorization layer already reads RolePermissions into JWT claims.
   This UI is the missing management layer: Owner can inspect the matrix and
   replace the permission set for a non-Owner role. The API remains the final
   authority; hiding this card is only a convenience. */

let RBAC_ROLES = [];
let RBAC_PERMISSIONS = [];
let RBAC_SELECTED_ROLE = null;

function permissionGroupName(permissionName) {
    const resource = String(permissionName || "").split(".")[0] || "other";
    return resource.charAt(0).toUpperCase() + resource.slice(1);
}

function renderRolePermissionEditor() {
    const select = document.getElementById("permission-role-select");
    const editor = document.getElementById("role-permissions-editor");
    const list = document.getElementById("role-permissions-list");
    const status = document.getElementById("role-permissions-status");
    if (!select || !editor || !list) return;

    if (!RBAC_SELECTED_ROLE) {
        editor.hidden = true;
        return;
    }

    editor.hidden = false;
    status.textContent = RBAC_SELECTED_ROLE.name === "Owner"
        ? "Owner always has full access."
        : `${RBAC_SELECTED_ROLE.permissions.length} permission(s) currently assigned.`;

    if (RBAC_SELECTED_ROLE.name === "Owner") {
        list.innerHTML = `<div class="card"><p class="hint">The Owner role is protected and always receives every permission.</p></div>`;
        document.getElementById("save-role-permissions-btn").disabled = true;
        return;
    }

    document.getElementById("save-role-permissions-btn").disabled = false;

    const selected = new Set(RBAC_SELECTED_ROLE.permissions);
    const groups = {};
    RBAC_PERMISSIONS.forEach(permission => {
        const group = permissionGroupName(permission.name);
        (groups[group] ||= []).push(permission);
    });

    list.innerHTML = Object.entries(groups).map(([group, permissions]) => `
        <div class="permission-group">
            <h3>${escapeHtml(group)}</h3>
            ${permissions.map(permission => `
                <label class="permission-item">
                    <input type="checkbox" data-rbac-permission="${escapeHtml(permission.name)}" ${selected.has(permission.name) ? "checked" : ""}>
                    <span>
                        <span class="permission-name">${escapeHtml(permission.name)}</span>
                        ${permission.description ? `<span class="permission-description">${escapeHtml(permission.description)}</span>` : ""}
                    </span>
                </label>
            `).join("")}
        </div>
    `).join("");
}

async function loadRolePermissions() {
    const card = document.getElementById("role-permissions-card");
    if (!card) return;

    if (currentUserRole() !== "Owner") {
        card.hidden = true;
        return;
    }

    card.hidden = false;
    try {
        const [rolesResponse, permissionsResponse] = await Promise.all([
            authFetch("/api/Roles"),
            authFetch("/api/Roles/permissions")
        ]);
        const rolesData = await readJson(rolesResponse);
        const permissionsData = await readJson(permissionsResponse);

        if (!rolesResponse.ok) throw new Error(rolesData.message || `Could not load roles (${rolesResponse.status}).`);
        if (!permissionsResponse.ok) throw new Error(permissionsData.message || `Could not load permissions (${permissionsResponse.status}).`);

        RBAC_ROLES = rolesData;
        RBAC_PERMISSIONS = permissionsData;

        const select = document.getElementById("permission-role-select");
        select.innerHTML = `<option value="">Select role</option>` + RBAC_ROLES.map(role =>
            `<option value="${role.id}">${escapeHtml(role.name)}</option>`
        ).join("");

        RBAC_SELECTED_ROLE = null;
        renderRolePermissionEditor();
    } catch (error) {
        if (error.message !== "Session expired") {
            card.hidden = true;
            showToast(explainConnectionError(error, "load role permissions"));
        }
    }
}

function initRolePermissionManagement() {
    const select = document.getElementById("permission-role-select");
    const loadButton = document.getElementById("load-role-permissions-btn");
    const saveButton = document.getElementById("save-role-permissions-btn");
    if (!select || !loadButton || !saveButton) return;

    select.addEventListener("change", () => {
        RBAC_SELECTED_ROLE = RBAC_ROLES.find(role => String(role.id) === String(select.value)) || null;
        renderRolePermissionEditor();
    });

    loadButton.addEventListener("click", () => {
        RBAC_SELECTED_ROLE = RBAC_ROLES.find(role => String(role.id) === String(select.value)) || null;
        renderRolePermissionEditor();
    });

    saveButton.addEventListener("click", async () => {
        if (!RBAC_SELECTED_ROLE || RBAC_SELECTED_ROLE.name === "Owner") return;

        const permissions = [...document.querySelectorAll("[data-rbac-permission]:checked")]
            .map(input => input.getAttribute("data-rbac-permission"));

        saveButton.disabled = true;
        try {
            const response = await authFetch(`/api/Roles/${RBAC_SELECTED_ROLE.id}/permissions`, {
                method: "PUT",
                body: JSON.stringify({ permissions })
            });
            const data = await readJson(response);

            if (!response.ok) {
                showToast(data.message || `Could not update permissions (${response.status}).`);
                return;
            }

            RBAC_SELECTED_ROLE.permissions = data.permissions || permissions;
            renderRolePermissionEditor();
            showToast(`${data.message || "Permissions updated."} Users with this role must sign in again for the new permission claims to load.`, "success");
        } catch (error) {
            if (error.message !== "Session expired") showToast(explainConnectionError(error, "update role permissions"));
        } finally {
            saveButton.disabled = false;
        }
    });
}

/* ---------- field reports (real backend data) ----------
   Workers/Technicians submit a report. Manager/Owner/Agronomist see every
   report on the farm and can attach a recommendation. Owner/Manager approve
   it. This is now enforced by ReportsController on the backend, not just by
   what this file chooses to render - a Worker who edited this file directly
   still can't reach another user's reports, because GET /api/reports
   requires the reports.view permission Worker accounts don't have. */

let FIELD_REPORTS = [];

function currentUserRole() {
    return localStorage.getItem("role") || "";
}

function canReviewReports() {
    return ["Owner", "Manager", "Agronomist"].includes(currentUserRole());
}

function canApproveReports() {
    return ["Owner", "Manager"].includes(currentUserRole());
}

function canCreateReports() {
    return ["Worker", "Technician"].includes(currentUserRole());
}


/* ---------- role gating on the local-demo tabs ----------
   Fields, Assets, Crop Lifecycle, Livestock, Inventory and Tasks have no
   backend yet (see docs/DASHBOARD-CONNECTION.md), so there is nothing for a
   permission policy to enforce server-side the way Reports, Users, Zones
   and Farm are enforced. This is UI-only: it hides "add" forms from roles
   that shouldn't normally use them, matching the same hierarchy as the
   connected tabs, but a Worker who edits this file directly and re-submits
   the form would still succeed, because there's no ReportsController-style
   backend check behind it. Real enforcement for these tabs would mean
   building the same permission-policy pattern used for Reports - worth
   doing before this goes near real users, not before then.

   Agronomist gets the crop-specific forms (variety/planting/treatment) in
   addition to view access, since crop decisions are their job. Everything
   else structural (fields, assets, livestock, purchase orders, tasks) is
   Owner/Manager only, same as Zones and Users already are for real. */

const DEMO_TAB_FORM_RULES = {
    "field-form": ["Owner", "Manager"],
    "asset-form": ["Owner", "Manager"],
    "variety-form": ["Owner", "Manager", "Agronomist"],
    "planting-form": ["Owner", "Manager", "Agronomist"],
    "treatment-form": ["Owner", "Manager", "Agronomist"],
    "health-obs-form": ["Owner", "Manager", "Agronomist"],
    "harvest-form": ["Owner", "Manager", "Agronomist"],
    "livestock-form": ["Owner", "Manager"],
    "livestock-health-form": ["Owner", "Manager"],
    "breeding-form": ["Owner", "Manager"],
    "vax-form": ["Owner", "Manager"],
    "livestock-log-form": ["Owner", "Manager"],
    "production-form": ["Owner", "Manager"],
    "stock-form": ["Owner", "Manager"],
    "stock-usage-form": ["Owner", "Manager"],
    "supplier-form": ["Owner", "Manager"],
    "po-form": ["Owner", "Manager"],
    "cost-form": ["Owner", "Manager"],
    "full-task-form": ["Owner", "Manager"]
};

function applyDemoTabRoleGating() {
    const role = currentUserRole();

    Object.entries(DEMO_TAB_FORM_RULES).forEach(([formId, allowedRoles]) => {
        const form = document.getElementById(formId);
        if (!form || allowedRoles.includes(role)) return;

        const notice = document.createElement("p");
        notice.className = "hint";
        notice.style.marginTop = "0.6rem";
        notice.textContent = `View only for your role. ${allowedRoles.join(" / ")} can add here.`;
        form.replaceWith(notice);
    });
}

async function loadFieldReports() {
    const isReviewer = canReviewReports();
    const endpoint = isReviewer ? "/api/Reports" : "/api/Reports/mine";

    try {
        const response = await authFetch(endpoint);
        const data = await readJson(response);

        if (!response.ok) {
            console.error("Could not load reports:", data.message || response.status);
            return;
        }

        FIELD_REPORTS = data;
        renderFieldReports();
        renderOverviewSnapshot();

    } catch (error) {
        if (error.message !== "Session expired") {
            console.error("Reports request failed:", error);
        }
    }
}

let reportsSearchTerm = "";

function renderFieldReports() {
    const tbody = document.querySelector("#field-reports-table tbody");
    const hint = document.getElementById("field-reports-hint");
    const form = document.getElementById("field-report-form");

    const isReviewer = canReviewReports();
    const username = localStorage.getItem("username");

    // Workers/Technicians only see their own submissions; reviewers see all.
    let visible = isReviewer
        ? FIELD_REPORTS
        : FIELD_REPORTS.filter(r => r.submittedBy === username);

    if (reportsSearchTerm) {
        const q = reportsSearchTerm.toLowerCase();
        visible = visible.filter(r =>
            r.submittedBy.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q) ||
            r.summary.toLowerCase().includes(q) ||
            r.status.toLowerCase().includes(q)
        );
    }

    hint.textContent = isReviewer
        ? "Showing every report submitted across the farm"
        : "Showing only the reports you've submitted";

    form.style.display = isReviewer ? "none" : "flex";

    // Nav badge: reviewers see reports with no recommendation yet, OR a
    // rejected one waiting on a fresh recommendation (their job either
    // way); approvers see reports pending their decision. "How many of
    // these need me, right now" - always computed off the FULL set, not
    // the filtered/searched view, so the badge doesn't change just because
    // someone typed in the search box.
    const badge = document.getElementById("reports-badge");
    let actionable = 0;
    if (canApproveReports()) {
        actionable = FIELD_REPORTS.filter(r => r.status === "Pending approval").length;
    } else if (canReviewReports()) {
        actionable = FIELD_REPORTS.filter(r => !r.recommendation || r.status === "Rejected").length;
    }
    if (badge) {
        badge.textContent = actionable;
        badge.style.display = actionable > 0 ? "inline-flex" : "none";
    }

    if (!visible.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted);">${reportsSearchTerm ? "No reports match your search." : "No reports yet."}</td></tr>`;
        return;
    }

    tbody.innerHTML = visible.slice().reverse().map(r => {
        const statusBadge = r.status === "Approved"
            ? `<span class="badge status-approved">Approved</span>`
            : r.status === "Rejected"
                ? `<span class="badge status-rejected">Rejected</span>`
                : r.status === "Pending approval"
                    ? `<span class="badge status-pending">Pending approval</span>`
                    : `<span class="badge status-none">No recommendation yet</span>`;

        // A rejected report still shows its (rejected) recommendation text
        // as a record of what was turned down, but a reviewer needs to be
        // able to submit a fresh one - same as if there were none at all.
        const needsRecommendation = !r.recommendation || r.status === "Rejected";

        let actionCell = "";
        if (isReviewer && needsRecommendation) {
            actionCell = `<button type="button" class="chip-x" data-add-recommendation data-id="${r.id}" title="Add recommendation">+ Recommend</button>`;
        } else if (canApproveReports() && r.status === "Pending approval") {
            actionCell = `
                <button type="button" class="chip-x" data-approve-report data-id="${r.id}" title="Approve">✓ Approve</button>
                <button type="button" class="chip-x" data-reject-report data-id="${r.id}" title="Reject" style="margin-left:0.3rem;">✗ Reject</button>
            `;
        }

        return `
            <tr data-id="${r.id}">
                <td>${r.submittedBy} <span class="badge role" style="margin-left:4px;">${r.submittedByRole}</span></td>
                <td>[${r.category}] ${r.summary}</td>
                <td>${r.recommendation || "—"}</td>
                <td>${statusBadge}</td>
                <td>${actionCell}</td>
            </tr>
        `;
    }).join("");
}

function initFieldReports() {
    document.getElementById("field-report-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        const category = document.getElementById("field-report-category").value;
        const summary = document.getElementById("field-report-summary").value.trim();
        if (!summary) return;

        const submitButton = event.target.querySelector("button[type=submit]");
        submitButton.disabled = true;

        try {
            const response = await authFetch("/api/Reports", {
                method: "POST",
                body: JSON.stringify({ category, summary })
            });
            const data = await readJson(response);

            if (!response.ok) {
                showToast(data.message || "Could not submit the report.");
                return;
            }

            event.target.reset();
            await loadFieldReports();
            showToast("Report submitted.", "success");

        } catch (error) {
            if (error.message !== "Session expired") {
                console.error("Report submission failed:", error);
                showToast(explainConnectionError(error, "submit the report"));
            }
        } finally {
            submitButton.disabled = false;
        }
    });

    document.getElementById("field-reports-table").addEventListener("click", async (event) => {
        const recommendBtn = event.target.closest("[data-add-recommendation]");
        if (recommendBtn) {
            const text = prompt("Recommendation for this report:");
            if (!text || !text.trim()) return;

            try {
                const response = await authFetch(`/api/Reports/${recommendBtn.dataset.id}/recommendation`, {
                    method: "POST",
                    body: JSON.stringify({ text: text.trim() })
                });
                const data = await readJson(response);

                if (!response.ok) {
                    showToast(data.message || "Could not add the recommendation.");
                    return;
                }

                await loadFieldReports();
                showToast("Recommendation added.", "success");

            } catch (error) {
                if (error.message !== "Session expired") {
                    console.error("Add recommendation failed:", error);
                }
            }
            return;
        }

        const approveBtn = event.target.closest("[data-approve-report]");
        if (approveBtn) {
            try {
                const response = await authFetch(`/api/Reports/${approveBtn.dataset.id}/approve`, {
                    method: "PUT",
                    body: JSON.stringify({})
                });
                const data = await readJson(response);

                if (!response.ok) {
                    showToast(data.message || "Could not approve the report.");
                    return;
                }

                await loadFieldReports();
                showToast("Report approved.", "success");

            } catch (error) {
                if (error.message !== "Session expired") {
                    console.error("Approve report failed:", error);
                }
            }
            return;
        }

        const rejectBtn = event.target.closest("[data-reject-report]");
        if (rejectBtn) {
            try {
                const response = await authFetch(`/api/Reports/${rejectBtn.dataset.id}/reject`, {
                    method: "PUT",
                    body: JSON.stringify({})
                });
                const data = await readJson(response);

                if (!response.ok) {
                    showToast(data.message || "Could not reject the report.");
                    return;
                }

                await loadFieldReports();
                showToast("Report rejected - it's back with the reviewer for a fresh recommendation.", "success");

            } catch (error) {
                if (error.message !== "Session expired") {
                    console.error("Reject report failed:", error);
                }
            }
        }
    });

    const searchInput = document.getElementById("reports-search");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            reportsSearchTerm = searchInput.value.trim();
            renderFieldReports();
        });
    }
}


/* ---------- shift / attendance report (real backend data) ---------- */

function formatShiftTime(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

let TEAM_SHIFTS = [];
let MY_SHIFTS = [];

async function loadShiftReport() {
    const canViewTeam = ["Owner", "Manager"].includes(currentUserRole());

    try {
        const myResponse = await authFetch("/api/Shifts/history");
        const myShifts = await readJson(myResponse);

        if (!myResponse.ok) {
            console.error("Could not load shift history:", myShifts.message || myResponse.status);
            return;
        }

        MY_SHIFTS = myShifts;

        const myTbody = document.querySelector("#my-shifts-table tbody");
        myTbody.innerHTML = myShifts.length
            ? myShifts.map(s => `
                <tr>
                    <td>${formatShiftTime(s.clockInUtc)}</td>
                    <td>${s.isOpen ? "Still clocked in" : formatShiftTime(s.clockOutUtc)}</td>
                    <td>${s.isOpen ? "—" : Math.round((new Date(s.clockOutUtc) - new Date(s.clockInUtc)) / 36e5 * 100) / 100}</td>
                </tr>
              `).join("")
            : `<tr><td colspan="3" style="color:var(--text-muted);">No shifts recorded yet.</td></tr>`;

        let statsSource = myShifts;

        if (canViewTeam) {
            const teamResponse = await authFetch("/api/Shifts/team");
            const teamShifts = await readJson(teamResponse);

            if (teamResponse.ok) {
                document.getElementById("team-shifts-section").style.display = "";
                const teamTbody = document.querySelector("#team-shifts-table tbody");
                teamTbody.innerHTML = teamShifts.length
                    ? teamShifts.map(s => `
                        <tr>
                            <td>${s.userName}</td>
                            <td>${formatShiftTime(s.clockInUtc)}</td>
                            <td>${s.isOpen ? "Still clocked in" : formatShiftTime(s.clockOutUtc)}</td>
                            <td>${s.hoursWorked ?? "—"}</td>
                        </tr>
                      `).join("")
                    : `<tr><td colspan="4" style="color:var(--text-muted);">No shifts recorded yet.</td></tr>`;

                statsSource = teamShifts.map(s => ({
                    clockInUtc: s.clockInUtc, clockOutUtc: s.clockOutUtc, isOpen: s.isOpen
                }));

                TEAM_SHIFTS = teamShifts;
            }
        }

        // Calculations: total hours across the relevant shift set, how many
        // are currently open, and the total count on record.
        const totalHours = statsSource.reduce((sum, s) => {
            if (s.isOpen || !s.clockOutUtc) return sum;
            return sum + (new Date(s.clockOutUtc) - new Date(s.clockInUtc)) / 36e5;
        }, 0);

        document.getElementById("shift-stat-total-hours").textContent = Math.round(totalHours * 100) / 100;
        document.getElementById("shift-stat-open-count").textContent = statsSource.filter(s => s.isOpen).length;
        document.getElementById("shift-stat-shift-count").textContent = statsSource.length;

        renderOverviewSnapshot();

    } catch (error) {
        if (error.message !== "Session expired") {
            console.error("Shift report request failed:", error);
        }
    }
}


/* ---------- CSV export for the shift/attendance tables ----------
   Pure client-side - the data is already loaded (MY_SHIFTS / TEAM_SHIFTS),
   so this just reshapes it and triggers a browser download. No backend
   endpoint needed for this one. */

function downloadCsv(filename, rows) {
    const csv = rows.map(row =>
        row.map(cell => {
            const value = String(cell ?? "");
            // Quote any cell containing a comma, quote, or newline, and
            // escape internal quotes by doubling them - standard CSV rules.
            return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        }).join(",")
    ).join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function hoursBetween(clockInUtc, clockOutUtc) {
    if (!clockOutUtc) return "";
    return Math.round((new Date(clockOutUtc) - new Date(clockInUtc)) / 36e5 * 100) / 100;
}

function initShiftExports() {
    const myBtn = document.getElementById("export-my-shifts-csv");
    const teamBtn = document.getElementById("export-team-shifts-csv");

    if (myBtn) {
        myBtn.addEventListener("click", () => {
            if (!MY_SHIFTS.length) {
                showToast("No shifts to export yet.");
                return;
            }
            const rows = [["Clock in", "Clock out", "Hours"]];
            MY_SHIFTS.forEach(s => rows.push([
                s.clockInUtc, s.isOpen ? "Still clocked in" : s.clockOutUtc,
                s.isOpen ? "" : hoursBetween(s.clockInUtc, s.clockOutUtc)
            ]));
            downloadCsv(`my-shifts-${new Date().toISOString().slice(0, 10)}.csv`, rows);
            showToast("CSV downloaded.", "success");
        });
    }

    if (teamBtn) {
        teamBtn.addEventListener("click", () => {
            if (!TEAM_SHIFTS.length) {
                showToast("No shifts to export yet.");
                return;
            }
            const rows = [["User", "Clock in", "Clock out", "Hours"]];
            TEAM_SHIFTS.forEach(s => rows.push([
                s.userName, s.clockInUtc, s.isOpen ? "Still clocked in" : s.clockOutUtc,
                s.isOpen ? "" : (s.hoursWorked ?? hoursBetween(s.clockInUtc, s.clockOutUtc))
            ]));
            downloadCsv(`team-shifts-${new Date().toISOString().slice(0, 10)}.csv`, rows);
            showToast("CSV downloaded.", "success");
        });
    }
}


/* ---------- overview snapshot (real, calculated, role-adaptive) ----------
   Reuses TEAM, TEAM_SHIFTS, FIELD_REPORTS and currentShiftState - all
   already fetched by the functions above - rather than making its own
   requests. Called after each of those finishes loading, so whichever
   arrives last is the one that leaves the snapshot correct. */

function renderOverviewSnapshot() {
    const grid = document.getElementById("snapshot-grid");
    const role = currentUserRole();
    const cards = [];

    // Same fix as renderFieldReports()'s badge count: a Rejected report
    // still has recommendation text sitting on it (kept as a record of what
    // was turned down), so "no recommendation" alone would miss it. This
    // was inconsistent with the Reports tab's own badge until now - both
    // read off the same definition.
    const needsRecommendation = r => !r.recommendation || r.status === "Rejected";

    if (role === "Owner" || role === "Manager") {
        const clockedInNow = TEAM_SHIFTS.filter(s => s.isOpen).length;
        const pendingApprovals = FIELD_REPORTS.filter(r => r.status === "Pending approval").length;
        const awaitingRecommendation = FIELD_REPORTS.filter(needsRecommendation).length;

        cards.push(
            { label: "Team members", value: TEAM.length, sub: `${TEAM.filter(t => t.isActive).length} active`, cls: "" },
            { label: "Clocked in now", value: clockedInNow, sub: "across the whole farm", cls: "" },
            { label: "Reports awaiting recommendation", value: awaitingRecommendation, sub: "no recommendation yet", cls: awaitingRecommendation ? "warn" : "" },
            { label: "Pending your approval", value: pendingApprovals, sub: "recommended, not yet approved", cls: pendingApprovals ? "warn" : "" }
        );
    } else if (role === "Agronomist") {
        const awaitingRecommendation = FIELD_REPORTS.filter(needsRecommendation).length;

        cards.push(
            { label: "Reports to review", value: FIELD_REPORTS.length, sub: "visible to your role", cls: "" },
            { label: "Awaiting your recommendation", value: awaitingRecommendation, sub: "no recommendation added yet", cls: awaitingRecommendation ? "warn" : "" },
            { label: "Your shift", value: currentShiftState.isClockedIn ? "Clocked in" : "Clocked out", sub: currentShiftState.isClockedIn ? "since " + new Date(currentShiftState.clockInUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "", cls: "" }
        );
    } else {
        // Worker / Technician
        const approved = FIELD_REPORTS.filter(r => r.status === "Approved").length;

        cards.push(
            { label: "Reports you've submitted", value: FIELD_REPORTS.length, sub: `${approved} approved`, cls: "" },
            { label: "Your shift", value: currentShiftState.isClockedIn ? "Clocked in" : "Clocked out", sub: currentShiftState.isClockedIn ? "since " + new Date(currentShiftState.clockInUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "", cls: currentShiftState.isClockedIn ? "" : "warn" }
        );
    }

    grid.innerHTML = cards.map(c => `
        <div class="stat-card ${c.cls}">
            <div class="stat-label">${c.label}</div>
            <div class="stat-value">${c.value}</div>
            <div class="stat-sub">${c.sub}</div>
        </div>
    `).join("");

    renderNeedsAttentionList(role, needsRecommendation);
}


/* ---------- "Needs your attention" - a visible list, not just a count ----------
   The snapshot cards above tell a reviewer/approver *how many* reports need
   them; this shows *which ones*, right on Overview, without a click into
   Reports first. Worker/Technician don't get this - they're not reviewing
   anything, just submitting. */

function renderNeedsAttentionList(role, needsRecommendation) {
    const card = document.getElementById("needs-attention-card");
    const list = document.getElementById("needs-attention-list");
    if (!card || !list) return;

    const isApprover = role === "Owner" || role === "Manager";
    const isReviewer = role === "Agronomist" || isApprover;

    if (!isReviewer) {
        card.style.display = "none";
        return;
    }

    let items = [];
    if (isApprover) {
        items = FIELD_REPORTS
            .filter(r => r.status === "Pending approval")
            .map(r => ({ ...r, actionLabel: "Approve or reject" }));
    }
    items = items.concat(
        FIELD_REPORTS
            .filter(needsRecommendation)
            .map(r => ({ ...r, actionLabel: "Add recommendation" }))
    );

    if (!items.length) {
        card.style.display = "none";
        return;
    }

    card.style.display = "";
    list.innerHTML = items.slice(0, 5).map(r => `
        <li>
            <span>[${r.category}] ${r.summary}</span>
            <span class="hint">${r.submittedBy} · ${r.actionLabel}</span>
        </li>
    `).join("");
}


/* ---------- boot ---------- */

document.addEventListener("DOMContentLoaded", () => {
    renderSessionStatus();
    renderAccountSettings();
    initChangePassword();
    initPreferences();
    applyDemoTabRoleGating();
    loadFarm();
    loadFarmStructure();
    loadTeam();
    loadShiftStatus();
    loadShiftReport();
    initTeamForm();
    initTeamRowActions();
    initFarmStructureForms();
    initFieldReports();
    loadFieldReports();
    initShiftExports();
});

/* ============================================================
   REAL OPERATIONS MODULES
   Crop Lifecycle, Livestock, Inventory and Tasks are now persisted through
   the backend. The existing arrays are only a browser-side view cache.
   ============================================================ */

function opDate(value){ return value ? String(value).slice(0,10) : ""; }
function opTime(value){
    if (!value) return "";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString([], {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
}
function replaceArray(target, rows){ target.splice(0, target.length, ...(Array.isArray(rows) ? rows : [])); }
async function opRequest(path, options = {}) {
    const response = await authFetch(`/api/Operations${path}`, options);
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || data.title || `Request failed (${response.status})`);
    return data;
}
async function opPost(path, body){
    return opRequest(path, {method:"POST", body:JSON.stringify(body)});
}
async function opDelete(path){ return opRequest(path, {method:"DELETE"}); }
async function opPut(path, body){ return opRequest(path, {method:"PUT", body:JSON.stringify(body)}); }

function renderBreedingLog(){
    const el = document.getElementById("breeding-log");
    if (!el) return;
    if (!BREEDING.length){ el.innerHTML = `<li><span style="color:var(--text-muted);">No breeding records yet.</span></li>`; return; }
    el.innerHTML = BREEDING.map(x => `
        <li data-id="${x.id}">
            <span><strong>${x.batch}</strong> — ${x.event}${x.notes ? ` — ${x.notes}` : ""}</span>
            <span class="log-time">${x.date} <button class="chip-x" data-remove-breeding title="Remove">×</button></span>
        </li>`).join("");
}
function renderTaskHistory(){
    const el=document.getElementById("task-history");
    if(!el) return;
    if(!TASK_HISTORY.length){ el.innerHTML=`<li><span style="color:var(--text-muted);">No task history yet.</span></li>`; return; }
    el.innerHTML=TASK_HISTORY.slice(0,30).map(h=>`<li><span>${h.action} — status: ${h.status} <span style="color:var(--text-muted);">— ${h.changedBy}</span></span><span class="log-time">${opTime(h.createdAt)}</span></li>`).join("");
}

function renderUsageLog(){
    const el = document.getElementById("stock-usage-log");
    if (!el) return;
    if (!INVENTORY_USAGE.length){ el.innerHTML = `<li><span style="color:var(--text-muted);">No stock usage recorded yet.</span></li>`; return; }
    el.innerHTML = INVENTORY_USAGE.slice(0,20).map(x => `
        <li data-id="${x.id}">
            <span><strong>${x.item}</strong> — ${x.quantity} ${x.unit} used for ${x.usedFor} <span style="color:var(--text-muted);">— ${x.who}</span></span>
            <span class="log-time">${opTime(x.createdAt)}</span>
        </li>`).join("");
}

let INVENTORY_USAGE = [];

async function loadCropOperations(){
    try {
        const data = await opRequest("/crops");
        replaceArray(CROP_VARIETIES, (data.varieties||[]).map(x=>({id:x.id,crop:x.crop,variety:x.variety,notes:x.notes})));
        replaceArray(PLANTING, (data.plantings||[]).map(x=>({id:x.id,crop:x.crop,field:x.field,planted:opDate(x.planted),harvest:opDate(x.expectedHarvest),stage:x.stage,status:x.status})));
        replaceArray(TREATMENTS, (data.activities||[]).map(x=>({id:x.id,type:x.type,text:x.text,who:x.who,time:opTime(x.createdAt)})));
        replaceArray(HEALTH_OBS, (data.observations||[]).map(x=>({id:x.id,field:x.field,text:x.text,severity:x.severity,who:x.who,time:opTime(x.createdAt)})));
        replaceArray(HARVESTS, (data.harvests||[]).map(x=>({id:x.id,crop:x.crop,field:x.field,date:opDate(x.date),qty:x.quantity,unit:x.unit})));
        renderVarietyTable(); renderStageBoard(); renderPlantingTable();
        renderLogList("treatment-log", TREATMENTS, "data-remove-treatment", "type");
        renderHealthObsLog(); renderHarvestTable(); renderOverviewStats();
    } catch(error) {
        if(error.message !== "Session expired") console.error("Crop operations load failed:", error);
    }
}

async function loadLivestockOperations(){
    try {
        const data = await opRequest("/livestock");
        replaceArray(LIVESTOCK,(data.batches||[]).map(x=>({id:x.id,name:x.name,size:x.size,purpose:x.purpose,stage:x.stage,status:x.status})));
        replaceArray(LIVESTOCK_HEALTH,(data.health||[]).map(x=>({id:x.id,batch:x.batch,text:x.text,who:x.who,time:opTime(x.createdAt)})));
        replaceArray(VAX,(data.vaccinations||[]).map(x=>({id:x.id,batch:x.batch,vaccine:x.vaccine,due:opDate(x.due),status:x.status})));
        replaceArray(LIVESTOCK_LOG,(data.logs||[]).map(x=>({id:x.id,text:x.text,who:x.who,time:opTime(x.createdAt),type:x.type})));
        replaceArray(PRODUCTION,(data.production||[]).map(x=>({id:x.id,batch:x.batch,metric:x.metric,value:x.value,date:opDate(x.date)})));
        replaceArray(BREEDING,(data.breeding||[]).map(x=>({id:x.id,batch:x.batch,event:x.event,date:opDate(x.date),notes:x.notes})));
        renderLivestockGrid(); renderLogList("livestock-health-log", LIVESTOCK_HEALTH, "data-remove-livestock-health");
        renderVaxTable(); renderLogList("livestock-log", LIVESTOCK_LOG, "data-remove-livestock-log");
        renderProductionTable(); renderBreedingLog(); renderOverviewStats();
    } catch(error) {
        if(error.message !== "Session expired") console.error("Livestock operations load failed:", error);
    }
}

async function loadInventoryOperations(){
    try {
        const data = await opRequest("/inventory");
        replaceArray(STOCK,(data.items||[]).map(x=>({id:x.id,item:x.item,cat:x.category,qty:Number(x.quantity),unit:x.unit,reorder:Number(x.reorder)})));
        INVENTORY_USAGE = (data.usage||[]);
        replaceArray(SUPPLIERS,(data.suppliers||[]).map(x=>({id:x.id,name:x.name,contact:x.contact,category:x.category})));
        replaceArray(PO_LOG,(data.purchases||[]).map(x=>({id:x.id,type:x.type,text:x.text,who:x.who,time:opTime(x.createdAt),status:x.status})));
        replaceArray(COSTS,(data.costs||[]).map(x=>({id:x.id,date:opDate(x.date),category:x.category,desc:x.description,amount:Number(x.amount)})));
        renderStockTable(); renderSuppliersTable(); renderPoLog(); renderPendingApprovals(); renderSupplierStatus();
        populateCostMonthFilter(); renderFinanceGrid(); renderCostTable(); renderUsageLog(); renderOverviewStats();
    } catch(error) {
        if(error.message !== "Session expired") console.error("Inventory operations load failed:", error);
    }
}

async function loadTaskOperations(){
    try {
        const data = await opRequest("/tasks");
        replaceArray(TASKS,(data.tasks||[]).map(x=>({id:x.id,title:x.title,link:x.link,assignee:x.assignee,priority:x.priority,deadline:opDate(x.deadline),status:x.status})));
        replaceArray(TASK_HISTORY,(data.history||[]).map(x=>({id:x.id,farmTaskId:x.farmTaskId,action:x.action,status:x.status,changedBy:x.changedBy,createdAt:x.createdAt})));
        renderTaskTable(); renderTasksToday(); renderTaskHistory(); renderOverviewStats(); renderActivityFeed();
    } catch(error) {
        if(error.message !== "Session expired") console.error("Task operations load failed:", error);
    }
}

async function loadAllOperations(){
    await Promise.all([loadCropOperations(),loadLivestockOperations(),loadInventoryOperations(),loadTaskOperations()]);
    // Keep the Overview performance charts in sync with the latest operation data.
    if (typeof renderPerformanceCharts === "function") renderPerformanceCharts();
}

function formBody(id){
    const form=document.getElementById(id); return form ? new FormData(form) : null;
}
function stringField(form,id){ return form.querySelector(`#${id}`)?.value.trim() || ""; }

function initRealOperationForms(){
    document.addEventListener("submit", async event => {
        const form=event.target;
        const id=form?.id;
        const handlers={
            "variety-form": async()=>{await opPost("/crops/varieties",{crop:stringField(form,"var-crop"),variety:stringField(form,"var-name"),notes:stringField(form,"var-notes")});},
            "planting-form": async()=>{await opPost("/crops/plantings",{crop:stringField(form,"pl-crop"),field:stringField(form,"pl-field"),planted:form.querySelector("#pl-planted").value,expectedHarvest:form.querySelector("#pl-harvest").value,stage:"Germination"});},
            "treatment-form": async()=>{await opPost("/crops/activities",{type:form.querySelector("#treatment-type").value,text:stringField(form,"treatment-text"),who:stringField(form,"treatment-who")});},
            "health-obs-form": async()=>{await opPost("/crops/observations",{field:stringField(form,"obs-field"),severity:form.querySelector("#obs-severity").value,text:stringField(form,"obs-text"),who:stringField(form,"obs-who")});},
            "harvest-form": async()=>{await opPost("/crops/harvests",{crop:stringField(form,"hv-crop"),field:stringField(form,"hv-field"),date:form.querySelector("#hv-date").value,quantity:Number(form.querySelector("#hv-qty").value),unit:stringField(form,"hv-unit")});},
            "livestock-form": async()=>{await opPost("/livestock/batches",{name:stringField(form,"ls-name"),size:stringField(form,"ls-size"),purpose:stringField(form,"ls-purpose"),stage:stringField(form,"ls-stage")});},
            "livestock-health-form": async()=>{await opPost("/livestock/health",{batch:stringField(form,"lh-batch"),text:stringField(form,"lh-text"),who:stringField(form,"lh-who")});},
            "breeding-form": async()=>{await opPost("/livestock/breeding",{batch:stringField(form,"br-batch"),event:form.querySelector("#br-event").value,date:form.querySelector("#br-date").value,notes:stringField(form,"br-notes")});},
            "vax-form": async()=>{await opPost("/livestock/vaccinations",{batch:stringField(form,"vax-batch"),vaccine:stringField(form,"vax-vaccine"),due:form.querySelector("#vax-due").value});},
            "livestock-log-form": async()=>{await opPost("/livestock/logs",{type:"Feed / mortality",text:stringField(form,"ls-log-text"),who:stringField(form,"ls-log-who")});},
            "production-form": async()=>{await opPost("/livestock/production",{batch:stringField(form,"prod-batch"),metric:stringField(form,"prod-metric"),value:stringField(form,"prod-value"),date:form.querySelector("#prod-date").value});},
            "stock-form": async()=>{await opPost("/inventory/items",{item:stringField(form,"stock-item"),category:stringField(form,"stock-cat"),quantity:Number(form.querySelector("#stock-qty").value),unit:stringField(form,"stock-unit"),reorder:Number(form.querySelector("#stock-reorder").value)});},
            "stock-usage-form": async()=>{await opPost("/inventory/usage",{item:stringField(form,"usage-item"),quantity:Number(form.querySelector("#usage-qty").value),unit:stringField(form,"usage-unit"),usedFor:stringField(form,"usage-for"),who:stringField(form,"usage-who")});},
            "supplier-form": async()=>{await opPost("/inventory/suppliers",{name:stringField(form,"sup-name"),contact:stringField(form,"sup-contact"),category:stringField(form,"sup-cat")});},
            "po-form": async()=>{await opPost("/inventory/purchases",{type:form.querySelector("#po-type").value,text:stringField(form,"po-text"),who:stringField(form,"po-who")});},
            "cost-form": async()=>{await opPost("/inventory/costs",{date:form.querySelector("#cost-date").value,category:form.querySelector("#cost-category").value,description:stringField(form,"cost-desc"),amount:Number(form.querySelector("#cost-amount").value)});},
            "full-task-form": async()=>{await opPost("/tasks",{title:stringField(form,"ft-title"),link:stringField(form,"ft-link"),assignee:stringField(form,"ft-assignee"),priority:form.querySelector("#ft-priority").value,deadline:form.querySelector("#ft-deadline").value});}
        };
        if(!handlers[id]) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const button=form.querySelector("button[type=submit]"); if(button) button.disabled=true;
        try { await handlers[id](); form.reset(); await loadAllOperations(); showToast("Saved successfully.","success"); }
        catch(error){ if(error.message!=="Session expired") showToast(explainConnectionError(error,"save this record")); }
        finally { if(button) button.disabled=false; }
    }, true);

    document.addEventListener("click", async event => {
        const removeMap={
            "data-remove-variety":"/crops/varieties/",
            "data-remove-planting":"/crops/plantings/",
            "data-remove-treatment":"/crops/activities/",
            "data-remove-obs":"/crops/observations/",
            "data-remove-harvest":"/crops/harvests/",
            "data-remove-livestock":"/livestock/batches/",
            "data-remove-livestock-health":"/livestock/health/",
            "data-remove-breeding":"/livestock/breeding/",
            "data-remove-vax":"/livestock/vaccinations/",
            "data-remove-livestock-log":"/livestock/logs/",
            "data-remove-production":"/livestock/production/",
            "data-remove-stock":"/inventory/items/",
            "data-remove-supplier":"/inventory/suppliers/",
            "data-remove-po":"/inventory/purchases/",
            "data-remove-task":"/tasks/"
        };
        for(const [attr,path] of Object.entries(removeMap)){
            const btn=event.target.closest(`[${attr}]`); if(!btn) continue;
            const row=btn.closest("[data-id]"); if(!row) return;
            event.preventDefault(); event.stopImmediatePropagation();
            try { await opDelete(path+encodeURIComponent(row.dataset.id)); await loadAllOperations(); showToast("Record removed.","success"); }
            catch(error){ if(error.message!=="Session expired") showToast(explainConnectionError(error,"remove this record")); }
            return;
        }

        const cycle=event.target.closest("[data-cycle-status]");
        if(cycle){
            const row=cycle.closest("[data-id]"); if(!row) return;
            const id=String(row.dataset.id);
            let path=null; let current=null;
            if(PLANTING.some(x=>String(x.id)===id)){ path=`/crops/plantings/${id}/stage`; current=PLANTING.find(x=>String(x.id)===id); }
            else if(LIVESTOCK.some(x=>String(x.id)===id)){ path=`/livestock/batches/${id}/status`; current=LIVESTOCK.find(x=>String(x.id)===id); }
            else if(VAX.some(x=>String(x.id)===id)){ path=`/livestock/vaccinations/${id}/status`; current=VAX.find(x=>String(x.id)===id); }
            if(path && current){
                event.preventDefault(); event.stopImmediatePropagation();
                const next=current.status==="Scheduled"?"Due":nextStatus(current.status);
                try { await opPut(path,{status:next}); await loadAllOperations(); showToast("Status updated.","success"); }
                catch(error){ if(error.message!=="Session expired") showToast(explainConnectionError(error,"update the status")); }
                return;
            }
        }

        const qty=event.target.closest("[data-qty-delta]");
        if(qty){
            const row=qty.closest("[data-id]"); if(!row) return;
            event.preventDefault(); event.stopImmediatePropagation();
            const stock=STOCK.find(x=>String(x.id)===String(row.dataset.id));
            if(!stock) return;
            const step=stock.qty>=100?10:(stock.qty>=20?5:1);
            try { await opPut(`/inventory/items/${row.dataset.id}/quantity`,{delta:Number(qty.dataset.qtyDelta)*step}); await loadInventoryOperations(); showToast("Stock updated.","success"); }
            catch(error){ if(error.message!=="Session expired") showToast(explainConnectionError(error,"update stock")); }
            return;
        }

        const quick=event.target.closest("[data-quick-complete]");
        if(quick){
            const row=quick.closest("[data-id]"); if(!row) return;
            event.preventDefault(); event.stopImmediatePropagation();
            try { await opPut(`/tasks/${row.dataset.id}/status`,{status:"Completed"}); await loadTaskOperations(); showToast("Task completed.","success"); }
            catch(error){ if(error.message!=="Session expired") showToast(explainConnectionError(error,"complete the task")); }
            return;
        }
    }, true);

    document.addEventListener("change", async event => {
        const stage=event.target.closest("[data-advance-stage]");
        if(stage){
            const row=stage.closest("[data-id]"); if(!row) return;
            event.preventDefault(); event.stopImmediatePropagation();
            try { await opPut(`/crops/plantings/${row.dataset.id}/stage`,{stage:stage.value}); await loadCropOperations(); showToast("Growth stage updated.","success"); }
            catch(error){ if(error.message!=="Session expired") showToast(explainConnectionError(error,"update the growth stage")); }
            return;
        }
        const task=event.target.closest("[data-task-status]");
        if(task){
            const row=task.closest("[data-id]"); if(!row) return;
            event.preventDefault(); event.stopImmediatePropagation();
            try { await opPut(`/tasks/${row.dataset.id}/status`,{status:task.value}); await loadTaskOperations(); showToast("Task status updated.","success"); }
            catch(error){ if(error.message!=="Session expired") showToast(explainConnectionError(error,"update the task")); }
            return;
        }
        const cycle=event.target.closest("[data-cycle-status]");
        if(cycle){
            const row=cycle.closest("[data-id]"); if(!row) return;
            const id=String(row.dataset.id);
            if(PLANTING.some(x=>String(x.id)===id)){
                const p=PLANTING.find(x=>String(x.id)===id); const next=nextStatus(p.status);
                event.preventDefault(); event.stopImmediatePropagation();
                try { await opPut(`/crops/plantings/${id}/stage`,{status:next}); await loadCropOperations(); }
                catch(error){ if(error.message!=="Session expired") showToast(explainConnectionError(error,"update the crop status")); }
            } else if(LIVESTOCK.some(x=>String(x.id)===id)){
                const l=LIVESTOCK.find(x=>String(x.id)===id); const next=nextStatus(l.status);
                event.preventDefault(); event.stopImmediatePropagation();
                try { await opPut(`/livestock/batches/${id}/status`,{status:next}); await loadLivestockOperations(); }
                catch(error){ if(error.message!=="Session expired") showToast(explainConnectionError(error,"update livestock status")); }
            } else if(VAX.some(x=>String(x.id)===id)){
                const v=VAX.find(x=>String(x.id)===id); const next=v.status==="Scheduled"?"Due":"Scheduled";
                event.preventDefault(); event.stopImmediatePropagation();
                try { await opPut(`/livestock/vaccinations/${id}/status`,{status:next}); await loadLivestockOperations(); }
                catch(error){ if(error.message!=="Session expired") showToast(explainConnectionError(error,"update vaccination status")); }
            }
        }
    }, true);
}

document.addEventListener("DOMContentLoaded", () => {
    initRealOperationForms();
    loadAllOperations();
});

initRolePermissionManagement();
loadRolePermissions();
