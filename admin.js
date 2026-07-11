document.addEventListener("DOMContentLoaded", () => {
    // Auth Views wrappers
    const loginWrapper = document.getElementById("admin-login-wrapper");
    const consoleWrapper = document.getElementById("admin-console-wrapper");

    // Login Form Elements
    const loginForm = document.getElementById("admin-login-form");
    const usernameInput = document.getElementById("admin-username");
    const passwordInput = document.getElementById("admin-password");
    const loginStatus = document.getElementById("admin-login-status");

    // Sidebar navigation Elements
    const sidebarTabBtns = document.querySelectorAll(".sidebar-tab-btn");
    const viewPanels = document.querySelectorAll(".admin-view-panel");
    const viewportTitle = document.getElementById("viewport-title");
    const viewportSubtitle = document.getElementById("viewport-subtitle");
    const logoutBtn = document.getElementById("admin-logout-btn");

    // Config Tab Inputs
    const cfgDomain = document.getElementById("cfg-domain");
    const cfgAnimedekhoDomain = document.getElementById("cfg-animedekho-domain");
    const cfgOmdb = document.getElementById("cfg-omdb");
    const cfgAppname = document.getElementById("cfg-appname");
    const cfgDefaultserver = document.getElementById("cfg-defaultserver");
    const saveConfigBtn = document.getElementById("save-config-btn");
    const configStatus = document.getElementById("setting-status");

    // Tools Tab Buttons & Status
    const refreshCacheBtn = document.getElementById("refresh-cache-btn");
    const cacheToolStatus = document.getElementById("cache-tool-status");
    const rebuildJsBtn = document.getElementById("btn-rebuild-js");
    const rebuildToolStatus = document.getElementById("rebuild-tool-status");

    // Logs Tab Elements
    const refreshLogsBtn = document.getElementById("btn-refresh-logs");
    const logsConsole = document.getElementById("admin-logs-console");
    const logsAutoScroll = document.getElementById("logs-auto-scroll");

    let statsInterval = null;
    let logsInterval = null;
    let visitorsInterval = null;

    const PANEL_METADATA = {
        config: { title: "Config Settings", subtitle: "Manage scraping endpoints, base metadata servers, and keys" },
        stats: { title: "Server Telemetry", subtitle: "Monitor machine specs, active PID, RAM allocation, and variables" },
        visitors: { title: "Live Visitors Activity", subtitle: "Monitor active viewers, device profiles, playback nodes, and adblockers" },
        logs: { title: "Real-time Logs", subtitle: "Stream syslogs directly from the Python running thread" },
        tools: { title: "System Tools", subtitle: "Trigger system cache invalidation and JavaScript minification" }
    };

    // Helper functions
    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    async function checkAuth() {
        try {
            const res = await fetch("/api/admin/status");
            const data = await res.json();
            return data.authenticated;
        } catch (_) {
            return false;
        }
    }

    async function initializeConsole() {
        const authenticated = await checkAuth();
        if (authenticated) {
            loginWrapper.classList.add("hidden");
            consoleWrapper.classList.remove("hidden");
            switchTab("config");
        } else {
            consoleWrapper.classList.add("hidden");
            loginWrapper.classList.remove("hidden");
            loginForm.reset();
            loginStatus.textContent = "";
            loginStatus.className = "setting-status";
            stopPolling();
        }
    }

    function stopPolling() {
        if (statsInterval) { clearInterval(statsInterval); statsInterval = null; }
        if (logsInterval) { clearInterval(logsInterval); logsInterval = null; }
        if (visitorsInterval) { clearInterval(visitorsInterval); visitorsInterval = null; }
    }

    // Switch Tabs
    function switchTab(tabName) {
        stopPolling();

        // Update headers
        const meta = PANEL_METADATA[tabName];
        if (meta) {
            viewportTitle.textContent = meta.title;
            viewportSubtitle.textContent = meta.subtitle;
        }

        // Active Buttons
        sidebarTabBtns.forEach(btn => {
            if (btn.getAttribute("data-tab") === tabName) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });

        // Active Panels
        viewPanels.forEach(panel => {
            if (panel.id === `panel-${tabName}`) {
                panel.classList.add("active");
            } else {
                panel.classList.remove("active");
            }
        });

        // Fetch contents
        if (tabName === "config") {
            loadConfig();
        } else if (tabName === "stats") {
            loadStats();
            statsInterval = setInterval(loadStats, 3000);
        } else if (tabName === "visitors") {
            loadVisitors();
            visitorsInterval = setInterval(loadVisitors, 2500);
        } else if (tabName === "logs") {
            loadLogs();
            logsInterval = setInterval(loadLogs, 2500);
        }
    }

    // Load configurations
    async function loadConfig() {
        try {
            const res = await fetch("/api/config");
            if (!res.ok) throw new Error("Unauthorized");
            const cfg = await res.json();
            cfgDomain.value = cfg.source_domain || "";
            cfgAnimedekhoDomain.value = cfg.animedekho_domain || "";
            cfgOmdb.value = cfg.omdb_api_key || "";
            cfgAppname.value = cfg.app_name || "";
            if (cfgDefaultserver) {
                cfgDefaultserver.value = cfg.default_server || "";
            }
        } catch (_) {}
    }

    // Load Telemetry Stats
    async function loadStats() {
        try {
            const res = await fetch("/api/admin/stats");
            if (!res.ok) return;
            const stats = await res.json();

            document.getElementById("stat-uptime").textContent = stats.uptime;
            document.getElementById("stat-python").textContent = stats.python_version;
            document.getElementById("stat-pid").textContent = stats.pid;
            document.getElementById("stat-cores").textContent = stats.cpu_count;
            document.getElementById("stat-memory").textContent = `${stats.memory.process} (App) / ${stats.memory.total} (Total)`;
            document.getElementById("stat-os").textContent = stats.platform;
            document.getElementById("stat-total-visitors").textContent = stats.total_visitors || 0;

            // Security warning
            const warningBanner = document.getElementById("stats-warning-banner");
            if (stats.is_default_admin) {
                warningBanner.classList.remove("hidden");
            } else {
                warningBanner.classList.add("hidden");
            }

            // Env Vars Table
            const tbody = document.getElementById("env-vars-body");
            tbody.innerHTML = "";
            for (const [k, v] of Object.entries(stats.env_vars)) {
                const tr = document.createElement("tr");
                const tdKey = document.createElement("td");
                tdKey.textContent = k;
                const tdVal = document.createElement("td");
                tdVal.textContent = v;
                tr.appendChild(tdKey);
                tr.appendChild(tdVal);
                tbody.appendChild(tr);
            }
        } catch (_) {}
    }

    // Load Logs
    async function loadLogs() {
        try {
            const res = await fetch("/api/admin/logs");
            if (!res.ok) return;
            const logs = await res.json();
            
            logsConsole.innerHTML = logs.map(line => {
                let colorClass = "log-info";
                if (line.includes("[-]")) colorClass = "log-error";
                else if (line.includes("[*]")) colorClass = "log-accent";
                else if (line.includes("[+]")) colorClass = "log-success";
                return `<div class="${colorClass}">${escapeHtml(line)}</div>`;
            }).join("");

            if (logsAutoScroll.checked) {
                logsConsole.scrollTop = logsConsole.scrollHeight;
            }
        } catch (_) {}
    }

    function parseUserAgent(ua) {
        let os = "Unknown OS";
        if (ua.includes("Windows")) os = "Windows";
        else if (ua.includes("Macintosh")) os = "macOS";
        else if (ua.includes("iPhone")) os = "iOS (iPhone)";
        else if (ua.includes("iPad")) os = "iOS (iPad)";
        else if (ua.includes("Android")) os = "Android";
        else if (ua.includes("Linux")) os = "Linux";

        let browser = "Unknown Browser";
        if (ua.includes("Chrome") && !ua.includes("Chromium") && !ua.includes("Edg")) browser = "Chrome";
        else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
        else if (ua.includes("Firefox")) browser = "Firefox";
        else if (ua.includes("Edg")) browser = "Edge";
        
        return `${browser} on ${os}`;
    }

    async function loadVisitors() {
        try {
            const res = await fetch("/api/admin/active_sessions");
            if (!res.ok) return;
            const sessions = await res.json();
            
            document.getElementById("live-visitor-count").textContent = sessions.length;
            const tbody = document.getElementById("visitors-list-body");
            
            if (sessions.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                            No active streams detected. Watching feeds in pipeline...
                        </td>
                    </tr>`;
                return;
            }

            tbody.innerHTML = sessions.map(s => {
                const device = parseUserAgent(s.user_agent);
                const titleStr = s.season && s.episode 
                    ? `${s.title} (S${s.season}E${s.episode})`
                    : s.title;
                    
                const nodeStr = s.server_name
                    ? `${s.server_name} [${s.server_type}]`
                    : "Auto / Loading";

                const adblockHtml = s.adblocker
                    ? `<span style="background:rgba(255, 68, 68, 0.1); border:1px solid rgba(255, 68, 68, 0.25); color:#ff4444; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:600;">🛡️ Blocked</span>`
                    : `<span style="background:rgba(0, 255, 136, 0.1); border:1px solid rgba(0, 255, 136, 0.25); color:#00ff88; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:600;">🔓 Disabled</span>`;

                const activeStr = s.active_seconds_ago === 0
                    ? "Active now"
                    : `${s.active_seconds_ago}s ago`;

                return `
                    <tr>
                        <td><strong>${s.ip}</strong></td>
                        <td style="color: var(--text-muted); font-size: 0.72rem;">${device}</td>
                        <td><span style="color:#00ffcc; font-weight:500;">${titleStr}</span></td>
                        <td><span style="font-family:'Orbitron', sans-serif; font-size:0.7rem;">${nodeStr}</span></td>
                        <td>${adblockHtml}</td>
                        <td>
                            <div style="display:flex; align-items:center; gap:10px; justify-content:space-between;">
                                <span style="color:#00d2ff;">● ${activeStr}</span>
                                <button class="btn-logs-action" style="background:rgba(255, 68, 68, 0.12); border-color:rgba(255, 68, 68, 0.25); color:#ff4444; padding:3px 8px; font-size:0.65rem; line-height:1;" onclick="banUserIp('${s.ip}')">🚫 Ban</button>
                            </div>
                        </td>
                    </tr>`;
            }).join("");
        } catch (_) {}

        // Load and render banned IPs table
        try {
            const resBanned = await fetch("/api/admin/banned_ips");
            if (!resBanned.ok) return;
            const bannedIps = await resBanned.json();
            const bannedBody = document.getElementById("banned-list-body");
            
            if (bannedIps.length === 0) {
                bannedBody.innerHTML = `
                    <tr>
                        <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
                            No IP addresses are currently blacklisted. Firewall is clear.
                        </td>
                    </tr>`;
                return;
            }

            bannedBody.innerHTML = bannedIps.map(ip => {
                return `
                    <tr>
                        <td><strong style="color:#ff4444;">${ip}</strong></td>
                        <td><span style="color:var(--text-muted); font-size:0.72rem;">Blocked by Administrator Protocol</span></td>
                        <td>
                            <button class="btn-logs-action" style="background:rgba(0, 255, 136, 0.1); border-color:rgba(0, 255, 136, 0.25); color:#00ff88; padding:4px 10px; font-size:0.65rem;" onclick="unbanUserIp('${ip}')">🔓 Unban IP</button>
                        </td>
                    </tr>`;
            }).join("");
        } catch (_) {}
    }

    // Tab clicks event bindings
    sidebarTabBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            const tabName = e.currentTarget.getAttribute("data-tab");
            switchTab(tabName);
        });
    });

    // Login Form Submit Listener
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        loginStatus.textContent = "Connecting to pipeline...";
        loginStatus.className = "setting-status";

        try {
            const res = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            if (res.ok) {
                loginStatus.textContent = "✅ Connected successfully! Access Granted.";
                loginStatus.className = "setting-status ok";
                setTimeout(() => { initializeConsole(); }, 1000);
            } else {
                loginStatus.textContent = "❌ Rejected: Invalid credentials.";
                loginStatus.className = "setting-status err";
            }
        } catch (err) {
            loginStatus.textContent = `❌ Pipeline error: ${err.message}`;
            loginStatus.className = "setting-status err";
        }
    });

    // Save Config click Listener
    saveConfigBtn.addEventListener("click", async () => {
        const domain = cfgDomain.value.trim().replace(/\/$/, "");
        const adDomain = cfgAnimedekhoDomain.value.trim().replace(/\/$/, "");
        
        if (!domain.startsWith("http") || (adDomain && !adDomain.startsWith("http"))) {
            configStatus.textContent = "⚠ Enter a valid URL (https://...)";
            configStatus.className = "setting-status err";
            return;
        }

        saveConfigBtn.textContent = "Updating config...";
        configStatus.textContent = "";

        try {
            const res = await fetch("/api/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    source_domain: domain,
                    animedekho_domain: adDomain,
                    omdb_api_key: cfgOmdb.value.trim(),
                    app_name: cfgAppname.value.trim() || "NEUROTIX",
                    default_server: cfgDefaultserver ? cfgDefaultserver.value : ""
                })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            configStatus.textContent = "✅ Configuration updated successfully!";
            configStatus.className = "setting-status ok";
        } catch (err) {
            configStatus.textContent = `❌ Update failed: ${err.message}`;
            configStatus.className = "setting-status err";
        } finally {
            saveConfigBtn.textContent = "Save changes & Reload";
        }
    });

    // Refresh logs button Click Bind
    refreshLogsBtn.addEventListener("click", loadLogs);

    // Logout Click Bind
    logoutBtn.addEventListener("click", async () => {
        try {
            await fetch("/api/admin/logout", { method: "POST" });
            initializeConsole();
        } catch (_) {}
    });

    // Cache Purge Button click Bind
    refreshCacheBtn.addEventListener("click", async () => {
        refreshCacheBtn.disabled = true;
        refreshCacheBtn.textContent = "Clearing cache...";
        cacheToolStatus.textContent = "";
        try {
            const res = await fetch("/api/refresh");
            if (res.ok) {
                cacheToolStatus.textContent = "✅ Cache successfully purged!";
                cacheToolStatus.className = "tool-status ok";
            } else {
                cacheToolStatus.textContent = "❌ Purge failed on server.";
                cacheToolStatus.className = "tool-status err";
            }
        } catch (_) {
            cacheToolStatus.textContent = "❌ Execution failed.";
            cacheToolStatus.className = "tool-status err";
        } finally {
            refreshCacheBtn.disabled = false;
            refreshCacheBtn.textContent = "Clear Cache Buffer";
        }
    });

    // Rebuild Obfuscated Javascript Compiler Bind
    rebuildJsBtn.addEventListener("click", async () => {
        rebuildJsBtn.disabled = true;
        rebuildJsBtn.textContent = "Rebuilding...";
        rebuildToolStatus.textContent = "";
        rebuildToolStatus.className = "tool-status";
        
        try {
            const res = await fetch("/api/admin/rebuild_js", { method: "POST" });
            const data = await res.json();
            if (res.ok && data.ok) {
                rebuildToolStatus.textContent = "✅ JS built and obfuscated successfully!";
                rebuildToolStatus.className = "tool-status ok";
            } else {
                rebuildToolStatus.textContent = `❌ Compiler error: ${data.detail || "Obfuscation failed"}`;
                rebuildToolStatus.className = "tool-status err";
            }
        } catch (err) {
            rebuildToolStatus.textContent = `❌ Run failed: ${err.message}`;
            rebuildToolStatus.className = "tool-status err";
        } finally {
            rebuildJsBtn.disabled = false;
            rebuildJsBtn.textContent = "⚡ Run Compiler";
        }
    });

    // banUserIp and unbanUserIp helpers exposed on window context for template triggers
    async function banUserIp(ip) {
        if (!ip) return;
        if (!confirm(`Are you sure you want to block IP: ${ip}?`)) return;
        
        try {
            const res = await fetch("/api/admin/ban", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ip })
            });
            if (res.ok) {
                loadVisitors();
            } else {
                const data = await res.json();
                alert(`Error: ${data.detail || "Failed to ban IP"}`);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    }

    async function unbanUserIp(ip) {
        if (!ip) return;
        if (!confirm(`Are you sure you want to unblock IP: ${ip}?`)) return;
        
        try {
            const res = await fetch("/api/admin/unban", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ip })
            });
            if (res.ok) {
                loadVisitors();
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    }

    window.banUserIp = banUserIp;
    window.unbanUserIp = unbanUserIp;

    // Manual ban button binding
    const manualBanBtn = document.getElementById("btn-manual-ban");
    const manualBanInput = document.getElementById("ban-input-ip");
    if (manualBanBtn && manualBanInput) {
        manualBanBtn.addEventListener("click", () => {
            const ip = manualBanInput.value.trim();
            if (!ip) return;
            banUserIp(ip);
            manualBanInput.value = "";
        });
    }

    // Init Page Auth
    initializeConsole();
});
