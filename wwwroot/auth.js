/* =====================================
   API BASE URL - keep in sync with your
   backend's HTTPS port (launchSettings.json)
===================================== */

const API_BASE_URL = window.location.hostname === "localhost"
    ? window.location.origin
    : "https://localhost:5226";


/* =====================================
   TABS
===================================== */

const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

function activateTab(which) {
    const isLogin = which === "login";

    tabLogin.classList.toggle("active", isLogin);
    tabRegister.classList.toggle("active", !isLogin);
    tabLogin.setAttribute("aria-selected", String(isLogin));
    tabRegister.setAttribute("aria-selected", String(!isLogin));

    loginForm.classList.toggle("active", isLogin);
    registerForm.classList.toggle("active", !isLogin);

    clearBanner();
}

tabLogin.addEventListener("click", () => activateTab("login"));
tabRegister.addEventListener("click", () => activateTab("register"));


/* =====================================
   SHOW / HIDE PASSWORD
===================================== */

document.querySelectorAll(".auth-peek").forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.target);
        if (!input) return;
        input.type = input.type === "password" ? "text" : "password";
    });
});


/* =====================================
   BANNER
===================================== */

const banner = document.getElementById("banner");

function showBanner(message, kind) {
    banner.textContent = message;
    banner.className = `auth-banner is-visible is-${kind}`;
}

function clearBanner() {
    banner.className = "auth-banner";
    banner.textContent = "";
}

function setLoading(button, isLoading) {
    button.disabled = isLoading;
    button.classList.toggle("is-loading", isLoading);
}


async function apiJson(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    let data = {};
    try { data = await response.json(); } catch { /* empty response */ }
    return { response, data };
}

function connectionMessage(error) {
    console.error("API connection failed:", error);
    if (window.location.protocol === "file:") {
        return "Open the login page from https://localhost:5226/auth.html while the backend is running. This keeps the frontend and API on the same HTTPS origin.";
    }
    return `Secure API connection failed. Confirm the backend is running at ${API_BASE_URL}, then run TRUST-HTTPS-CERTIFICATE.ps1 if the browser does not trust the development certificate.`;
}

/* =====================================
   LOGIN
   One endpoint, no "log in as" choice - the
   backend looks up the account's actual role
   and returns permission claims accordingly.
===================================== */

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearBanner();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const rememberMe = document.getElementById("rememberMe").checked;

    const submitButton = document.getElementById("loginSubmit");
    setLoading(submitButton, true);

    try {
        const { response, data } = await apiJson("/api/Auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const validationText = data.errors ? Object.values(data.errors).flat().join(" ") : null;
            showBanner(data.message || validationText || `Sign in failed (status ${response.status}).`, "error");
            return;
        }

        if (!data.token) {
            showBanner("Signed in, but no token was returned by the server.", "error");
            return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("rememberMe", String(rememberMe));
        if (data.userId !== undefined) localStorage.setItem("userId", data.userId);
        if (data.username) localStorage.setItem("username", data.username);
        localStorage.setItem("email", data.email || email);
        if (data.role) localStorage.setItem("role", data.role);
        if (data.farmId !== undefined && data.farmId !== null) {
            localStorage.setItem("farmId", data.farmId);
        }

        window.location.assign("./index.html");

    } catch (error) {
        console.error("Login request failed:", error);
        showBanner(
            connectionMessage(error),
            "error"
        );
    } finally {
        setLoading(submitButton, false);
    }
});


/* =====================================
   REGISTER
===================================== */

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearBanner();

    const fullName = document.getElementById("regFullName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const mobile = document.getElementById("regMobile").value.trim();
    const password = document.getElementById("regPassword").value;
    const confirmPassword = document.getElementById("regConfirmPassword").value;
    const farmName = document.getElementById("regFarmName").value.trim();
    const farmLocation = document.getElementById("regFarmLocation").value.trim();
    const farmType = document.getElementById("regFarmType").value;
    const farmArea = document.getElementById("regFarmArea").value;
    const areaUnit = document.getElementById("regAreaUnit").value;
    const primaryCrop = document.getElementById("regPrimaryCrop").value.trim();

    if (password !== confirmPassword) {
        showBanner("Passwords do not match.", "error");
        return;
    }

    if (password.length < 8) {
        showBanner("Password must be at least 8 characters.", "error");
        return;
    }

    if (!Number(farmArea) || Number(farmArea) <= 0) {
        showBanner("Farm area must be greater than 0.", "error");
        return;
    }

    // RegisterDto fields exactly. `role` is sent as "Owner" for compatibility
    // with either backend version - the fixed backend ignores it and always
    // creates an Owner regardless.
    const payload = {
        fullName, email, mobile, password, confirmPassword,
        role: "Owner",
        farmName, farmLocation, farmType,
        farmArea: Number(farmArea), areaUnit, primaryCrop
    };

    const submitButton = document.getElementById("registerSubmit");
    setLoading(submitButton, true);

    try {
        const { response, data } = await apiJson("/api/Auth/register", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const validationText = data.errors ? Object.values(data.errors).flat().join(" ") : null;
            showBanner(data.message || validationText || `Registration failed (status ${response.status}).`, "error");
            return;
        }

        registerForm.reset();
        activateTab("login");
        document.getElementById("loginEmail").value = email;
        showBanner(`Account created for ${data.farmName || "your farm"}. Sign in below to continue.`, "success");

    } catch (error) {
        console.error("Registration request failed:", error);
        showBanner(
            connectionMessage(error),
            "error"
        );
    } finally {
        setLoading(submitButton, false);
    }
});


/* =====================================
   FORGOT PASSWORD (stub)
===================================== */

document.getElementById("forgotPassword").addEventListener("click", (event) => {
    event.preventDefault();
    alert("Forgot password isn't built yet - see docs for what's still outstanding.");
});


/* =====================================
   ALREADY SIGNED IN? SKIP STRAIGHT TO
   THE DASHBOARD
===================================== */

if (localStorage.getItem("token")) {
    window.location.assign("./index.html");
}
