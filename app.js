/* ══════════════════════════════════════════════════════════════════════════
   NEUROTIX — God-Level Streaming Platform  •  app.js
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

/* ══════════════════════════════════════════════════════════════════════════
   SECURITY SHIELD & INSPECT PROTECTOR (GOD-LEVEL)
   ═════════════════════════════════════════════════════════════════════════ */
function initSecuritySystem() {
    // 1. Developer Bypass query parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('bypass') || urlParams.has('bypass_security')) {
        console.warn("[Security] System bypassed via developer override.");
        return;
    }

    let isBlocked = false;
    let debugInterval = null;

    // Helper: Show security alert toast
    function showSecurityToast(title, message) {
        const toastContainer = document.getElementById("security-toast-container");
        if (!toastContainer) return;

        // Limit the active toasts to prevent screen flooding
        const activeToasts = toastContainer.querySelectorAll('.security-toast');
        if (activeToasts.length >= 3) {
            activeToasts[0].remove();
        }

        const toast = document.createElement("div");
        toast.className = "security-toast";
        toast.innerHTML = `
            <span class="toast-icon">⚠️</span>
            <div class="toast-content">
                <span class="toast-title">${title}</span>
                <span class="toast-message">${message}</span>
            </div>
        `;
        toastContainer.appendChild(toast);

        // Auto fadeout after 3.5 seconds
        setTimeout(() => {
            toast.classList.add("fade-out");
            toast.addEventListener("animationend", () => {
                toast.remove();
            });
        }, 3500);
    }

    // Helper: Trigger infinite debugger halts when devtools is active
    function startDebuggerLoop() {
        if (debugInterval) clearInterval(debugInterval);
        debugInterval = setInterval(() => {
            if (isBlocked) {
                // Freezes execution in DevTools
                debugger;
            }
        }, 50);
    }

    function stopDebuggerLoop() {
        if (debugInterval) {
            clearInterval(debugInterval);
            debugInterval = null;
        }
    }

    // Helper: Trigger fullscreen blocker UI
    function activateBlocker() {
        if (isBlocked) return;
        isBlocked = true;

        const blockerEl = document.getElementById("devtools-blocker");
        if (blockerEl) {
            blockerEl.classList.remove("hidden");
        }

        // Stop all video playback and background process loads
        const video = document.getElementById("video");
        const iframe = document.getElementById("iframe-player");

        if (video) {
            try {
                video.pause();
                // Destroy video source entirely to block inspect networks from loading stream chunks
                video.removeAttribute('src');
                video.load();
            } catch (e) {}
        }

        if (iframe) {
            try {
                // Blank iframe url to stop loading embed processes
                iframe.src = "about:blank";
            } catch (e) {}
        }

        // Blur background content rows and hero
        const mainNav = document.getElementById("main-nav");
        const heroSection = document.getElementById("hero-section");
        const mainContent = document.getElementById("main-content");
        const playerModal = document.getElementById("player-modal");

        if (mainNav) mainNav.style.filter = "blur(12px)";
        if (heroSection) heroSection.style.filter = "blur(12px)";
        if (mainContent) mainContent.style.filter = "blur(12px)";
        if (playerModal) playerModal.style.filter = "blur(12px)";

        startDebuggerLoop();
    }

    function deactivateBlocker() {
        if (!isBlocked) return;
        isBlocked = false;

        const blockerEl = document.getElementById("devtools-blocker");
        if (blockerEl) {
            blockerEl.classList.add("hidden");
        }

        stopDebuggerLoop();

        // Reload the page to recover play state and clear overlays
        window.location.reload();
    }

    // ── Mouse & Key interceptors ──
    document.addEventListener("contextmenu", (e) => {
        // Prevent right clicks (Inspect element entrypoint)
        e.preventDefault();
        showSecurityToast("SECURITY PROTOCOL", "Right-click is deactivated to protect source assets.");
    });

    document.addEventListener("keydown", (e) => {
        // F12
        if (e.keyCode === 123) {
            e.preventDefault();
            showSecurityToast("SECURITY ALERT", "F12 Developer console shortcut blocked.");
            activateBlocker();
            return false;
        }
        // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (Inspect shortcuts)
        if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
            e.preventDefault();
            showSecurityToast("SECURITY ALERT", "Inspect shortcut combinations are deactivated.");
            activateBlocker();
            return false;
        }
        // Ctrl+U (View Page Source)
        if (e.ctrlKey && e.keyCode === 85) {
            e.preventDefault();
            showSecurityToast("SECURITY ALERT", "View Page Source command deactivated.");
            activateBlocker();
            return false;
        }
        // Ctrl+S (Save Page)
        if (e.ctrlKey && e.keyCode === 83) {
            e.preventDefault();
            showSecurityToast("SECURITY ALERT", "Page download is prohibited.");
            return false;
        }
    });

    // ── Anti-Tampering Shield (MutationObserver) ──
    const targetBlockerId = "devtools-blocker";
    
    const domShield = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            // 1. If someone deletes the blocker element from the DOM
            if (mutation.type === "childList") {
                const blockerExists = document.getElementById(targetBlockerId);
                if (!blockerExists && isBlocked) {
                    // Instantly trigger recovery loop / crash reload
                    window.location.reload();
                }
            }
            // 2. If someone edits styles or removes hidden class attributes
            if (mutation.type === "attributes") {
                const target = mutation.target;
                if (target.id === targetBlockerId && isBlocked) {
                    if (target.classList.contains("hidden") || target.style.display === "none" || target.style.visibility === "hidden" || target.style.opacity === "0") {
                        target.classList.remove("hidden");
                        target.style.display = "flex";
                        target.style.visibility = "visible";
                        target.style.opacity = "1";
                        window.location.reload();
                    }
                }
                
                // If they try to remove the blur filters on the page content
                if (isBlocked && (target.id === "main-nav" || target.id === "hero-section" || target.id === "main-content" || target.id === "player-modal")) {
                    if (!target.style.filter || !target.style.filter.includes("blur")) {
                        target.style.filter = "blur(12px)";
                    }
                }
            }
        }
    });

    // Observe body changes, attributes, and sub-trees
    domShield.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "disabled", "hidden"]
    });

    // ── Active Inspector Detectors ──

    // 1. Dimension Check (Detects docked devtools panels, accounting for zoom)
    function checkDimensions() {
        const threshold = 160;
        const dpr = window.devicePixelRatio || 1;
        
        // Convert inner dimensions (CSS pixels) to physical pixels
        const physicalInnerWidth = window.innerWidth * dpr;
        const physicalInnerHeight = window.innerHeight * dpr;
        
        // Width check: compares physical outer width vs physical inner viewport width
        // If DevTools is docked on the side, it reduces physicalInnerWidth significantly.
        const widthDev = (window.outerWidth - physicalInnerWidth) > threshold;
        
        // Height check: compares physical outer height vs physical inner viewport height
        // Accounts for standard browser bars (tabs, URL, bookmarks) by adding a 250px offset.
        const heightDev = (window.outerHeight - physicalInnerHeight) > (threshold + 250);
        
        return (widthDev || heightDev);
    }

    // 2. Performance Timing Blocker
    // DevTools pauses or slows evaluation of debugger loops.
    function checkTiming() {
        const start = performance.now();
        debugger;
        const end = performance.now();
        return (end - start > 100);
    }

    // 3. Console Formatting Evaluation (Getter checking)
    // Triggers when console object formats or prints logs (only runs when console is open).
    const elementCheck = new Image();
    Object.defineProperty(elementCheck, 'id', {
        get: function () {
            activateBlocker();
            throw new Error("Shield activated.");
        }
    });

    // Main scanning loop
    setInterval(() => {
        // Try console printer trigger
        try {
            console.log('%c', elementCheck);
            console.clear();
        } catch(e) {}

        // Check timing & window sizes
        if (checkDimensions() || checkTiming()) {
            activateBlocker();
        } else {
            // Recover if inspector was closed
            if (isBlocked) {
                deactivateBlocker();
            }
        }
    }, 1000);
}

/* ── Premium Vector Icons Mapping ── */
const GENRE_ICONS = {
    "action": `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>`,
    "action & adventure": `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/></svg>`,
    "adventure": `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
    "animation": `<svg viewBox="0 0 24 24"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"/><circle cx="7.5" cy="10.5" r="1.5"/><circle cx="11.5" cy="7.5" r="1.5"/><circle cx="16.5" cy="9.5" r="1.5"/><path d="M6 16c2 3.5 6 3.5 8 0"/></svg>`,
    "comedy": `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
    "crime": `<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    "documentary": `<svg viewBox="0 0 24 24"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
    "drama": `<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="M12 11.5c-1.33 0-4 .67-4 2V15h8v-1.5c0-1.33-2.67-2-4-2z"/><circle cx="9" cy="8.5" r="1.5"/><circle cx="15" cy="8.5" r="1.5"/></svg>`,
    "family": `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    "fantasy": `<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
    "history": `<svg viewBox="0 0 24 24"><path d="M5 2h14M5 22h14M19 2l-7 8-7-8M5 22l7-8 7 8"/></svg>`,
    "horror": `<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7v3a2 2 0 0 0 2 2h1v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3h1a2 2 0 0 0 2-2V9a7 7 0 0 0-7-7z"/><path d="M10 10h.01M14 10h.01"/></svg>`,
    "music": `<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    "mystery": `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    "romance": `<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    "sci-fi": `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    "sci-fi & fantasy": `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    "thriller": `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    "war": `<svg viewBox="0 0 24 24"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l-2-2M19 13l-2-2"/></svg>`,
    "war & politics": `<svg viewBox="0 0 24 24"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l-2-2M19 13l-2-2"/></svg>`,
    "western": `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9 12 2"/></svg>`,
    "kids": `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="9" r="1.5"/><circle cx="15" cy="9" r="1.5"/><path d="M12 2v2M12 20v2"/></svg>`,
    "news": `<svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M16 8h2M16 12h2M16 16h2M6 8h6v8H6z"/></svg>`,
    "reality": `<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`,
    "soap": `<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="10" r="4"/><circle cx="8" cy="17" r="5"/></svg>`,
    "talk": `<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
};

function getGenreIcon(name) {
    if (!name) return "";
    const key = name.toLowerCase().trim();
    if (GENRE_ICONS[key]) return GENRE_ICONS[key];
    return `<svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;
}

function formatRowTitleHTML(titleText) {
    if (!titleText) return "";
    const cleanTitle = titleText.replace(/^[🏆⭐📅🎬📺⚡🌸🎨🎭🧩📽️🤖🔫🔮🏰🕯️💀🎵🔍💖❤️🚀😱⚔️🤠👨‍👩‍👧👨‍👩‍👧‍👦🏠🖐️👁️📢🗣️⏳🛡️📰📺📡💥🗺️⌛🔥🗂️▶️🪐🍿🗺️😂🎭🧙👻🤠🧒📰🎞️🗣️💥🌐🇬🇧🇮🇳🇪🇸🇫🇷🇩🇪🇯🇵🇰🇷]\s*/u, '');
    const lowerTitle = cleanTitle.toLowerCase();
    let matchedIcon = "";
    if (lowerTitle.includes("action & adventure")) matchedIcon = getGenreIcon("action & adventure");
    else if (lowerTitle.includes("action")) matchedIcon = getGenreIcon("action");
    else if (lowerTitle.includes("adventure")) matchedIcon = getGenreIcon("adventure");
    else if (lowerTitle.includes("animation")) matchedIcon = getGenreIcon("animation");
    else if (lowerTitle.includes("comedy")) matchedIcon = getGenreIcon("comedy");
    else if (lowerTitle.includes("crime")) matchedIcon = getGenreIcon("crime");
    else if (lowerTitle.includes("documentary")) matchedIcon = getGenreIcon("documentary");
    else if (lowerTitle.includes("drama")) matchedIcon = getGenreIcon("drama");
    else if (lowerTitle.includes("family")) matchedIcon = getGenreIcon("family");
    else if (lowerTitle.includes("fantasy")) matchedIcon = getGenreIcon("fantasy");
    else if (lowerTitle.includes("history")) matchedIcon = getGenreIcon("history");
    else if (lowerTitle.includes("horror")) matchedIcon = getGenreIcon("horror");
    else if (lowerTitle.includes("music")) matchedIcon = getGenreIcon("music");
    else if (lowerTitle.includes("mystery")) matchedIcon = getGenreIcon("mystery");
    else if (lowerTitle.includes("romance")) matchedIcon = getGenreIcon("romance");
    else if (lowerTitle.includes("sci-fi & fantasy")) matchedIcon = getGenreIcon("sci-fi & fantasy");
    else if (lowerTitle.includes("sci-fi")) matchedIcon = getGenreIcon("sci-fi");
    else if (lowerTitle.includes("thriller")) matchedIcon = getGenreIcon("thriller");
    else if (lowerTitle.includes("war & politics")) matchedIcon = getGenreIcon("war & politics");
    else if (lowerTitle.includes("war")) matchedIcon = getGenreIcon("war");
    else if (lowerTitle.includes("western")) matchedIcon = getGenreIcon("western");
    else if (lowerTitle.includes("kids")) matchedIcon = getGenreIcon("kids");
    else if (lowerTitle.includes("news")) matchedIcon = getGenreIcon("news");
    else if (lowerTitle.includes("reality")) matchedIcon = getGenreIcon("reality");
    else if (lowerTitle.includes("soap")) matchedIcon = getGenreIcon("soap");
    else if (lowerTitle.includes("talk")) matchedIcon = getGenreIcon("talk");
    else if (lowerTitle.includes("top rated")) {
        matchedIcon = `<svg viewBox="0 0 24 24"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34M12 2a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4 4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z"/></svg>`;
    } else if (lowerTitle.includes("upcoming")) {
        matchedIcon = `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    } else if (lowerTitle.includes("latest") || lowerTitle.includes("recent") || lowerTitle.includes("fallback")) {
        matchedIcon = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    } else if (lowerTitle.includes("providers")) {
        matchedIcon = `<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>`;
    } else if (lowerTitle.includes("continue") || lowerTitle.includes("history")) {
        matchedIcon = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>`;
    } else if (lowerTitle.includes("episodes") || lowerTitle.includes("episode")) {
        matchedIcon = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>`;
    } else if (lowerTitle.includes("seasons") || lowerTitle.includes("season")) {
        matchedIcon = `<svg viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/></svg>`;
    } else if (lowerTitle.includes("popular") || lowerTitle.includes("hot")) {
        matchedIcon = `<svg viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
    } else if (lowerTitle.includes("results")) {
        matchedIcon = `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
    } else {
        matchedIcon = `<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>`;
    }
    const iconHTML = matchedIcon ? `<span class="row-title-icon">${matchedIcon}</span>` : "";
    return `${iconHTML}<span class="row-title-text">${cleanTitle}</span>`;
}

function handleCardImageError(img) {
    if (!img) return;
    img.removeAttribute("onerror"); // Prevent infinite loop
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; // Transparent 1x1 GIF
    img.classList.add("card-poster-fallback");
    
    // Find parent content-card
    const card = img.closest(".content-card");
    if (card && !card.querySelector(".card-poster-fallback-inner")) {
        const fallbackHTML = `
            <div class="card-poster-fallback-inner">
                <svg class="card-poster-fallback-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                    <line x1="7" y1="2" x2="7" y2="22"/>
                    <line x1="17" y1="2" x2="17" y2="22"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                </svg>
                <div style="font-weight: 700; opacity: 0.85; line-height: 1.2;">No Poster</div>
            </div>
        `;
        const div = document.createElement("div");
        div.innerHTML = fallbackHTML;
        card.appendChild(div.firstElementChild);
    }
}

function handleDetailsPosterError(img) {
    if (!img) return;
    img.removeAttribute("onerror"); // Prevent infinite loop
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; // Transparent 1x1 GIF
    img.classList.add("details-poster-fallback");
    
    const wrap = img.closest(".details-poster-wrap");
    if (wrap && !wrap.querySelector(".details-poster-fallback-inner")) {
        const fallbackHTML = `
            <div class="details-poster-fallback-inner">
                <svg class="details-poster-fallback-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                    <line x1="7" y1="2" x2="7" y2="22"/>
                    <line x1="17" y1="2" x2="17" y2="22"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                </svg>
                <div style="font-weight: 700; opacity: 0.85; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 8px;">No Poster</div>
            </div>
        `;
        const div = document.createElement("div");
        div.innerHTML = fallbackHTML;
        wrap.appendChild(div.firstElementChild);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    // Start security system immediately
    initSecuritySystem();

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const mainNav = document.getElementById("main-nav");
    const appNameNav = document.getElementById("app-name-nav");
    const homeLink = document.getElementById("home-link");
    const rowsContainer = document.getElementById("rows-container");
    const homepageLoader = document.getElementById("homepage-loader");
    const emptyState = document.getElementById("empty-state");

    // Hero
    const heroBg = document.getElementById("hero-bg");
    const heroTitle = document.getElementById("hero-title");
    const heroRatingVal = document.getElementById("hero-rating-val");
    const heroYear = document.getElementById("hero-year");
    const heroTypeBadge = document.getElementById("hero-type-badge");
    const heroDesc = document.getElementById("hero-desc");
    const heroPlayBtn = document.getElementById("hero-play-btn");
    const heroInfoBtn = document.getElementById("hero-info-btn");
    const heroDots = document.getElementById("hero-dots");
    const heroBadge = document.getElementById("hero-badge");

    // Search
    const searchInput = document.getElementById("search-input");

    // Settings
    const settingsBtn = document.getElementById("settings-btn");
    const settingsPanel = document.getElementById("settings-panel");
    const settingsClose = document.getElementById("settings-close");
    const modalBackdrop = document.getElementById("modal-backdrop");
    const cfgDomain = document.getElementById("cfg-domain");
    const cfgOmdb = document.getElementById("cfg-omdb");
    const cfgAppname = document.getElementById("cfg-appname");
    const cfgDefaultserver = document.getElementById("cfg-defaultserver");
    const saveConfigBtn = document.getElementById("save-config-btn");
    const refreshCacheBtn = document.getElementById("refresh-cache-btn");
    const settingStatus = document.getElementById("setting-status");

    // Player modal
    const playerModal = document.getElementById("player-modal");
    const playerCloseBtn = document.getElementById("player-close-btn");
    const playerTitle = document.getElementById("player-title");
    const playerMetaRow = document.getElementById("player-meta-row");
    const pmRating = document.getElementById("pm-rating");
    const pmYear = document.getElementById("pm-year");
    const pmRuntime = document.getElementById("pm-runtime");
    const playerPlot = document.getElementById("player-plot");
    const playerTags = document.getElementById("player-tags");
    const tvNav = document.getElementById("tv-nav");
    const seasonSelect = document.getElementById("season-select");
    const episodesGrid = document.getElementById("episodes-grid");
    const epPrevBtn = document.getElementById("ep-prev-btn");
    const epNextBtn = document.getElementById("ep-next-btn");
    const epNavInfo = document.getElementById("ep-nav-info");
    const serversGrid = document.getElementById("servers-grid");
    const serversLoading = document.getElementById("servers-loading");
    const qualityRow = document.getElementById("quality-row");
    const qualitySel = document.getElementById("quality-selector-container");
    const qualityBtn = document.getElementById("quality-btn");
    const qualityBtnText = document.getElementById("quality-btn-text");
    const qualityMenu = document.getElementById("quality-menu");
    const copyStreamBtn = document.getElementById("copy-stream-btn");
    const downloadBtn = document.getElementById("download-btn");
    const downloadBtnText = document.getElementById("download-btn-text");
    const dlWrap = document.getElementById("download-progress-wrap");
    const dlStatus = document.getElementById("download-status-text");
    const dlBar = document.getElementById("download-progress-bar");
    const omnisaveBtn = document.getElementById("omnisave-download-btn");
    const omnisaveBtnText = document.getElementById("omnisave-download-btn-text");
    const omnisaveOptions = document.getElementById("omnisave-options");
    const consoleLogs = document.getElementById("console-logs");
    let videoEl = document.getElementById("video");
    let iframeEl = document.getElementById("iframe-player");
    const spinnerWrap = document.getElementById("video-spinner-wrap");
    const spinnerText = document.getElementById("spinner-text");

    // Server Drawer (left panel) references + toggle logic
    const serverDrawer = document.getElementById("server-drawer");
    const serverDrawerToggle = document.getElementById("server-drawer-toggle");
    const openExternalBtn = document.getElementById("open-external-btn");
    const serverDrawerClose = document.getElementById("server-drawer-close");
    const serverDrawerBackdrop = document.getElementById("server-drawer-backdrop");

    function openServerDrawer() {
        if (!serverDrawer) return;
        serverDrawer.classList.remove("hidden");
        // Force reflow to allow transition to play
        void serverDrawer.offsetWidth;
        serverDrawer.classList.add("open");
        if (serverDrawerBackdrop) {
            serverDrawerBackdrop.classList.add("active");
        }
    }

    function closeServerDrawer() {
        if (!serverDrawer) return;
        serverDrawer.classList.remove("open");
        if (serverDrawerBackdrop) {
            serverDrawerBackdrop.classList.remove("active");
        }
    }

    function showServerDrawerToggle() {
        if (serverDrawerToggle) serverDrawerToggle.classList.remove("hidden");
    }

    if (serverDrawerToggle) {
        serverDrawerToggle.addEventListener("click", () => {
            if (serverDrawer && serverDrawer.classList.contains("open")) {
                closeServerDrawer();
            } else {
                openServerDrawer();
            }
        });
    }

    if (openExternalBtn) {
        openExternalBtn.addEventListener("click", () => {
            if (activeStreamUrl) {
                window.open(activeStreamUrl, '_blank');
            }
        });
    }

    if (serverDrawerClose) {
        serverDrawerClose.addEventListener("click", closeServerDrawer);
    }

    if (serverDrawerBackdrop) {
        serverDrawerBackdrop.addEventListener("click", closeServerDrawer);
    }

    // Global click listener to close the server drawer when clicking anywhere outside of it
    document.addEventListener("click", (e) => {
        if (serverDrawer && serverDrawer.classList.contains("open")) {
            // Do not close if click is on/inside the drawer itself or on the toggle button
            if (serverDrawer.contains(e.target)) return;
            if (serverDrawerToggle && serverDrawerToggle.contains(e.target)) return;
            closeServerDrawer();
        }
    });


    let preloadState = {
        seasonIdx: -1,
        episodeIdx: -1,
        streamUrl: "",
        iframeUrl: "",
        isResolved: false,
        isBuffered: false,
        srvObject: null,
        streamObject: null,
        resolvedServers: []
    };
    let preloadHlsInstance = null;
    let isPreloadTriggered = false;
    let preloadVideoEl = null;
    let autoplayNextEnabled = false;

    // Helper functions to prioritize older servers and keep recently added ones at the bottom of the list
    function isNewServer(serverId) {
        if (!serverId) return false;
        const serverLower = String(serverId).toLowerCase();
        const newServerNames = [
            "vidking", "vidlink", "vidup", "vidmov", "vidfyi", "vidrock", 
            "movies111", "hyperlink", "ultrabox", "cloudbox", "upcloud", 
            "streamvault", "mediahub", "cloudplay", "streamboxhd", "movievault", 
            "smashy", "nontongo"
        ];
        return newServerNames.some(name => serverLower.includes(name));
    }

    function compareServers(aId, aPing, bId, bPing) {
        const aIsNew = isNewServer(aId);
        const bIsNew = isNewServer(bId);
        
        if (aIsNew && !bIsNew) return 1;
        if (!aIsNew && bIsNew) return -1;
        
        const pingA = parseInt(aPing || "9999");
        const pingB = parseInt(bPing || "9999");
        return pingA - pingB;
    }

    // Custom stream context tracker
    let currentStreamImdbId = null;
    let currentStreamTmdbId = null;
    let currentStreamSeason = null;
    let currentStreamEpisode = null;
    let _iframeAutoplayTimer = null;   // setTimeout handle for iframe end-of-episode
    let _iframeAutoplayTick = null;    // setInterval handle for countdown tick
    let _iframeTimerState = {
        totalSec: 0,
        elapsedSec: 0,
        isPaused: false,
        showingCountdown: false,
        countdownSecsLeft: 10,
        nextSeasonIdx: -1,
        nextEpIdx: -1
    };

    // Dynamic initialization of background preloader components
    preloadVideoEl = document.createElement("video");
    preloadVideoEl.id = "preload-video";
    preloadVideoEl.muted = true;
    preloadVideoEl.style.display = "none";
    preloadVideoEl.crossOrigin = "anonymous";
    const videoBox = document.getElementById("player-video-box");
    if (videoBox) {
        videoBox.appendChild(preloadVideoEl);
    }

    // Preload Event Listeners
    videoEl.addEventListener("ended", () => {
        // Autoplay next episode completely removed
    });

    videoEl.addEventListener("timeupdate", () => {
        if (videoEl.currentTime > 15 && !isPreloadTriggered && seasonsData.length > 0) {
            isPreloadTriggered = true;
            triggerBackgroundPreload();
        }
    });

    // Setup Custom Embed Link button listener
    setTimeout(() => {
        const addCustomLinkBtn = document.getElementById("add-custom-link-btn");
        if (addCustomLinkBtn) {
            addCustomLinkBtn.addEventListener("click", () => {
                const name = prompt("Enter Server Name (e.g. NetMirror):", "NetMirror");
                if (!name) return;
                const url = prompt("Enter Custom Stream/Embed URL (e.g. play.php or m3u8 link):");
                if (!url || !url.startsWith("http")) {
                    alert("Please enter a valid HTTP/HTTPS URL.");
                    return;
                }
                
                saveCustomLink(currentStreamImdbId, currentStreamTmdbId, currentStreamSeason, currentStreamEpisode, name, url);
                log(`[ CUSTOM ] Saved custom link: ${name}`, "success");
                
                // Re-render immediately
                const customLinks = getCustomLinks(currentStreamImdbId, currentStreamTmdbId, currentStreamSeason, currentStreamEpisode);
                const newLinkIdx = customLinks.length - 1;
                
                const srv = {
                    server: `custom-${newLinkIdx}`,
                    name: name,
                    is_iframe: true,
                    is_custom: true,
                    embed_url: url,
                    streams: [{
                        quality: "Custom Embed",
                        language: "Multi",
                        url: url
                    }],
                    ping_ms: 10 // sort to top
                };
                
                // Hide loading spinner if visible
                serversLoading.classList.add("hidden");
                hideSpinner();
                showIdleOverlay(null);
                
                appendServerCard(srv, serversGrid.querySelectorAll(".server-item").length);
                
                // Select the newly added server
                setTimeout(() => {
                    const cards = serversGrid.querySelectorAll(".server-item");
                    // Find card that matches this url/name
                    let foundCard = null;
                    for (let card of cards) {
                        const nameEl = card.querySelector(".server-name");
                        if (nameEl && nameEl.textContent.trim() === name) {
                            foundCard = card;
                            break;
                        }
                    }
                    if (foundCard) foundCard.click();
                    else if (cards[cards.length - 1]) cards[cards.length - 1].click();
                }, 100);
            });
        }
    }, 100);

    // Details View refs
    const playerWrap = document.getElementById("player-wrap");
    const playerDetailsView = document.getElementById("player-details-view");
    const detailsBackdrop = document.getElementById("details-backdrop");
    const detailsPoster = document.getElementById("details-poster");
    const detailsBadge = document.getElementById("details-badge");
    const detailsTitle = document.getElementById("details-title");
    const detailsRatingVal = document.getElementById("details-rating-val");
    const detailsYear = document.getElementById("details-year");
    const detailsRuntime = document.getElementById("details-runtime");
    const detailsDesc = document.getElementById("details-desc");
    const detailsPlayBtn = document.getElementById("details-play-btn");
    const detailsPlayBtnText = document.getElementById("details-play-btn-text");
    const detailsLoaderMsg = document.getElementById("details-loader-msg");
    const detailsGenres = document.getElementById("details-genres");
    const detailsCastWrap = document.getElementById("details-cast-wrap");
    const detailsCastList = document.getElementById("details-cast-list");

    // Nav filter links
    const navLinks = document.querySelectorAll(".nav-link[data-filter]");

    // ── State ─────────────────────────────────────────────────────────────────
    let hlsInstance = null;
    let activeStreamUrl = "";
    let activeReferer = "";
    let activeTitle = "video";
    let isDownloading = false;
    let seasonsData = [];
    let allHomepageData = null;   // full data from /api/homepage
    let heroItems = [];
    let heroIdx = 0;
    let heroTimer = null;
    let activeFilter = "all";
    let activeImdbId = "";
    let activeItemMeta = null;    // stores current item for history saving
    let activeSeasonIdx = 0;      // currently selected season index
    let activeEpisodeIdx = 0;     // currently playing episode index within the season
    let preferredServer = null;   // { name, language, is_iframe } — remembered across episodes
    let autoSelectServer = false; // true when navigating via Prev/Next — triggers auto-pick
    let upcomingData = null;      // full data from /api/upcoming
    let globalConfig = {};        // backend configuration loaded on startup

    // ── Dynamic Favicon ────────────────────────────────────────────────────────
    // Saves the original favicon href so we can restore it later
    const _originalFaviconHref = (() => {
        const el = document.querySelector('link[rel~="icon"]');
        return el ? el.href : '/favicon.ico';
    })();

    /**
     * Converts a poster image URL to a 64×64 favicon and sets it on the tab.
     * Falls back to the original favicon if anything goes wrong.
     * @param {string} imageUrl - poster/thumbnail URL
     */
    function setDynamicFavicon(imageUrl) {
        if (!imageUrl) return;
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const SIZE = 64;
                    const canvas = document.createElement('canvas');
                    canvas.width = SIZE;
                    canvas.height = SIZE;
                    const ctx = canvas.getContext('2d');

                    // Fully circular favicon
                    const radius = SIZE / 2;
                    ctx.beginPath();
                    ctx.moveTo(radius, 0);
                    ctx.lineTo(SIZE - radius, 0);
                    ctx.quadraticCurveTo(SIZE, 0, SIZE, radius);
                    ctx.lineTo(SIZE, SIZE - radius);
                    ctx.quadraticCurveTo(SIZE, SIZE, SIZE - radius, SIZE);
                    ctx.lineTo(radius, SIZE);
                    ctx.quadraticCurveTo(0, SIZE, 0, SIZE - radius);
                    ctx.lineTo(0, radius);
                    ctx.quadraticCurveTo(0, 0, radius, 0);
                    ctx.closePath();
                    ctx.clip();

                    // Draw poster scaled to fill square (cover)
                    const aspect = img.naturalWidth / img.naturalHeight;
                    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
                    if (aspect > 1) { sw = img.naturalHeight; sx = (img.naturalWidth - sw) / 2; }
                    else           { sh = img.naturalWidth;  sy = (img.naturalHeight - sh) / 2; }
                    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SIZE, SIZE);

                    // Apply the favicon
                    _applyFaviconHref(canvas.toDataURL('image/png'));
                } catch (_) {
                    // canvas tainted (CORS) — just skip
                }
            };
            img.onerror = () => {}; // silently ignore load failures
            // Use TMDB w92 thumbnail for speed (tiny, fast)
            const thumb = imageUrl.replace('/w342/', '/w92/').replace('/w500/', '/w92/').replace('/original/', '/w92/');
            img.src = thumb;
        } catch (_) {}
    }

    function _applyFaviconHref(href) {
        // Remove ALL existing icon links — browsers cache the old one otherwise
        document.querySelectorAll('link[rel~="icon"]').forEach(el => el.remove());
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/png';
        link.href = href;
        document.head.appendChild(link);
    }

    function restoreFavicon() {
        // Add a cache-buster so the browser actually re-fetches the original icon
        const sep = _originalFaviconHref.includes('?') ? '&' : '?';
        _applyFaviconHref(_originalFaviconHref + sep + '_cb=' + Date.now());
    }
    // ──────────────────────────────────────────────────────────────────────────
    let countdownTimerInterval = null; // real-time countdown clock interval

    // Provider pagination state
    let _providerState = null;    // { id, name, page, totalPages, hasMore }

    const serverReferers = {
        0: "https://player.vidzee.wtf/",
        2: "https://multimovies.makeup/",
        3: "https://peachify.top/",
        4: "https://screenscape.me/",
        7: ""
    };

    // ── Utilities ─────────────────────────────────────────────────────────────
    function formatExactDate(dateStr) {
        if (!dateStr) return "";
        if (dateStr.includes("-")) {
            const parts = dateStr.split("-");
            if (parts.length === 3) {
                const year = parts[0];
                const monthNum = parseInt(parts[1], 10);
                const day = parseInt(parts[2], 10);
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const monthName = months[monthNum - 1] || parts[1];
                const dayStr = String(day).padStart(2, '0');
                return `${monthName} ${dayStr}, ${year}`;
            }
        }
        return dateStr;
    }

    function log(msg, type = "info") {
        const line = document.createElement("div");
        line.className = `log-line ${type}`;
        line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        consoleLogs.appendChild(line);
        consoleLogs.scrollTop = consoleLogs.scrollHeight;
    }

    let videoSpinnerInterval = null;
    const videoStatusLines = [
        "Connecting to secure stream node...",
        "Bypassing provider firewall layers...",
        "Decrypting live feed URLs...",
        "Resolving remote cloud proxy hosts...",
        "Initiating dynamic HLS handshake...",
        "Configuring adaptive bitrate streams..."
    ];

    function showSpinner(text = "Resolving stream...") {
        spinnerText.textContent = text;
        spinnerWrap.classList.remove("hidden");
        document.getElementById("video-idle-overlay").classList.add("hidden");
        
        const subtextEl = document.getElementById("video-loader-subtext");
        if (subtextEl) {
            if (videoSpinnerInterval) clearInterval(videoSpinnerInterval);
            let idx = 0;
            subtextEl.textContent = videoStatusLines[0];
            videoSpinnerInterval = setInterval(() => {
                idx = (idx + 1) % videoStatusLines.length;
                subtextEl.textContent = videoStatusLines[idx];
            }, 850);
        }
    }
    function hideSpinner() {
        spinnerWrap.classList.add("hidden");
        if (videoSpinnerInterval) {
            clearInterval(videoSpinnerInterval);
            videoSpinnerInterval = null;
        }
    }
    function showIdleOverlay(posterUrl) {
        const overlay = document.getElementById("video-idle-overlay");
        const bg = document.getElementById("idle-poster-bg");
        if (posterUrl) bg.style.backgroundImage = `url('${posterUrl}')`;
        overlay.classList.remove("hidden");
        hideSpinner();
    }
    function hideIdleOverlay() {
        document.getElementById("video-idle-overlay").classList.add("hidden");
    }

    // Scroll nav styling
    window.addEventListener("scroll", () => {
        mainNav.classList.toggle("scrolled", window.scrollY > 60);
    });

    // Scroll nav styling
    window.addEventListener("scroll", () => {
        mainNav.classList.toggle("scrolled", window.scrollY > 60);
    });

    // ── Watch Providers Metadata ──────────────────────────────────────────────
    // PROVIDER_SVGS: slug -> inline SVG, used as a graceful fallback when a TMDB
    // logo image fails to load or the server is unreachable.
    const PROVIDER_SVGS = {
        netflix: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 2v20h4V2z" fill="#B20710"/><path d="M14 2v20h4V2z" fill="#B20710"/><path d="M6 2h4l8 20h-4z" fill="#E50914"/></svg>`,
        primevideo: `<svg viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="20" dominant-baseline="middle" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-weight="900" fill="#FFFFFF" font-size="18" letter-spacing="-0.5px">prime</text><path d="M22 28 C 35 34, 65 34, 78 28" stroke="#00a8e8" stroke-width="2.5" stroke-linecap="round" fill="none" /><path d="M74 24 L 79 28 L 74 31 Z" fill="#00a8e8" /></svg>`,
        disney: `<svg viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="44%" y="22" dominant-baseline="middle" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-weight="900" fill="#FFFFFF" font-size="19" letter-spacing="-1px" font-style="italic">Disney</text><text x="76%" y="20" dominant-baseline="middle" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-weight="900" fill="#02e1fd" font-size="24">+</text><path d="M12 32 C 30 12, 70 12, 88 32" stroke="url(#disney-grad)" stroke-width="2" stroke-linecap="round" fill="none" /><defs><linearGradient id="disney-grad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#02e1fd" /><stop offset="100%" stop-color="#ae1dfd" /></linearGradient></defs></svg>`,
        hulu: `<svg viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="22" dominant-baseline="middle" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-weight="800" fill="#1ce783" font-size="28" letter-spacing="-1.5px">hulu</text></svg>`,
        appletv: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none"><path d="M20.57 17.735h-1.815l-3.34-9.203h1.633l2.02 5.987c.075.231.273.9.586 2.012l.297-.997.33-1.006 2.094-6.004H24zm-5.344-.066a5.76 5.76 0 0 1-1.55.207c-1.23 0-1.84-.693-1.84-2.087V9.646h-1.063V8.532h1.121V7.081l1.476-.602v2.062h1.707v1.113H13.38v5.805c0 .446.074.75.214.932.14.182.396.264.75.264.207 0 .495-.041.883-.115zm-7.29-5.343c.017 1.764 1.55 2.358 1.567 2.366-.017.042-.248.842-.808 1.658-.487.71-.99 1.418-1.79 1.435-.783.016-1.03-.462-1.93-.462-.89 0-1.17.445-1.913.478-.758.025-1.344-.775-1.838-1.484-.998-1.451-1.765-4.098-.734-5.88.51-.89 1.426-1.451 2.416-1.46.75-.016 1.468.512 1.93.512.461 0 1.327-.627 2.234-.536.38.016 1.452.157 2.136 1.154-.058.033-1.278.743-1.27 2.219M6.468 7.988c.404-.495.685-1.18.61-1.864-.585.025-1.294.388-1.723.883-.38.437-.71 1.138-.619 1.806.652.05 1.328-.338 1.732-.825Z" fill="#ffffff"/></svg>`,
        max: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none"><path d="M1.769 0A1.77 1.77 0 0 0 0 1.769V22.23A1.77 1.77 0 0 0 1.769 24H22.23A1.77 1.77 0 0 0 24 22.231V1.77A1.77 1.77 0 0 0 22.231 0zm12.485 3.28a4.301 4.301 0 0 1 4.3 4.302 4.301 4.301 0 0 1-1.993 3.63 6.085 6.085 0 0 1 1.054 3.422 6.085 6.085 0 0 1-6.085 6.085 6.085 6.085 0 0 1-6.085-6.085 6.085 6.085 0 0 1 4.66-5.916 4.301 4.301 0 0 1-.152-1.136 4.301 4.301 0 0 1 4.301-4.301zm0 1.849a2.453 2.453 0 0 0-2.453 2.453 2.453 2.453 0 0 0 2.453 2.453 2.453 2.453 0 0 0 2.453-2.453 2.453 2.453 0 0 0-2.453-2.453zm-2.724 5.268a4.237 4.237 0 0 0-4.237 4.237 4.237 4.237 0 0 0 4.237 4.237 4.237 4.237 0 0 0 4.237-4.237 4.237 4.237 0 0 0-4.237-4.237zm.032 2.54a1.781 1.781 0 1 1 0 3.562 1.781 1.781 0 0 1 0-3.562Z" fill="#ffffff"/></svg>`,
        paramount: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none"><path d="M16.347 21.373c.057-.084.151-.314-.025-.74l-.53-1.428c-.073-.182.084-.293.19-.173 0 0 1.004 1.157 1.264 1.64l.495.822c.425.028 1.6.06 2.732.06a3.26 3.26 0 0 1-.316-.364c-1.93-2.392-3.154-3.724-3.166-3.737-.391-.426-.572-.508-.87-.643a4.82 4.82 0 0 1-.138-.065v.364c0 .047-.057.073-.086.022l-2.846-5.001a1.598 1.598 0 0 0-.508-.587l-.277-.194-1.354 3.123c.212 0 .354.216.27.409l-1.25 2.893h1.147c.443 0 .883.087 1.294.255l.302.125s-.913 1.878-.913 2.867c0 .181.028.362.075.534h2.104l-.096-.595s1.266.294 2.502.413M12 2.437c-6.627 0-12 5.373-12 12 0 2.669.873 5.133 2.346 7.126.503-.218.783-.542.983-.791l2.234-2.858a.467.467 0 0 1 .179-.138l.336-.146 3.674-4.659.534-.417 1.094-1.524a.482.482 0 0 1 .101-.102l.478-.347a.34.34 0 0 1 .398-.004l.578.407c.308.216.557.504.726.84l2.322 4.077c.051.09.09.129.182.174.454.227.732.268 1.33.913.277.304 1.495 1.666 3.203 3.784.236.318.538.588.963.783A11.948 11.948 0 0 0 24 14.437c0-6.627-5.373-12-12-12" fill="#ffffff"/></svg>`,
        peacock: `<svg viewBox="0 0 100 45" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="28" cy="18" r="5" fill="#ffd300" /><circle cx="37" cy="12" r="5" fill="#ff7c00" /><circle cx="47" cy="10" r="5" fill="#ff002b" /><circle cx="57" cy="12" r="5" fill="#9300c7" /><circle cx="66" cy="18" r="5" fill="#0050ff" /><circle cx="72" cy="27" r="5" fill="#00e676" /><path d="M47 38 C 45 32, 51 32, 49 38 Z" fill="#FFFFFF" /><text x="50%" y="36" dominant-baseline="middle" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-weight="700" fill="#FFFFFF" font-size="9" letter-spacing="1px">PEACOCK</text></svg>`,
        crunchyroll: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none"><path d="M2.933 13.467a10.55 10.55 0 1 1 21.067-.8V12c0-6.627-5.373-12-12-12S0 5.373 0 12s5.373 12 12 12h.8a10.617 10.617 0 0 1-9.867-10.533zM19.2 14a3.85 3.85 0 0 1-1.333-7.467A7.89 7.89 0 0 0 14 5.6a8.4 8.4 0 1 0 8.4 8.4 6.492 6.492 0 0 0-.133-1.6A3.415 3.415 0 0 1 19.2 14z" fill="#ff6600"/></svg>`,
        mgm: `<svg viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="22" dominant-baseline="middle" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-weight="900" fill="#d4af37" font-size="22" letter-spacing="1px">MGM+</text></svg>`,
        fubo: `<svg viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="22" dominant-baseline="middle" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-weight="900" fill="#ff5a00" font-size="26" letter-spacing="-1px" font-style="italic">fubo</text></svg>`,
    };

    let providerList = [];  // ordered list from server: [{ id, name, slug, logo }]

    async function loadProviderLogos() {
        if (providerList && providerList.length) return providerList;
        try {
            const res = await fetch("/api/providers");
            if (res.ok) providerList = await res.json();
        } catch (_) { /* fall back to embedded SVGs below */ }
        return providerList;
    }

    function renderProvidersRow() {
        const old = document.getElementById("providers-row");
        if (old) old.remove();

        const row = document.createElement("div");
        row.className = "content-row providers-row";
        row.id = "providers-row";

        row.innerHTML = `
            <div class="row-header">
                <div class="row-title">${formatRowTitleHTML("📺 Stream Providers")}</div>
                <span class="row-see-all" id="providers-see-all-btn" role="button" tabindex="0">View All <span class="see-all-arrow">→</span></span>
            </div>
            <div class="row-track-wrap">
                <button class="row-scroll-btn left" aria-label="Scroll left">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="row-track" id="providers-track"></div>
                <button class="row-scroll-btn right" aria-label="Scroll right">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>`;

        const track = row.querySelector("#providers-track");

        // Source of truth: the dynamic list from the server. If the server is
        // unreachable, fall back to the embedded SVG fallback list so the row
        // is never empty.
        let list = providerList;
        if (!list || !list.length) {
            list = Object.entries(PROVIDER_SVGS).map(([slug, svg]) => ({
                id: "", name: slug, slug, logo: ""
            }));
        }

        list.forEach((prov) => {
            const card = document.createElement("div");
            card.className = "provider-card";
            card.dataset.provider = prov.slug;
            card.dataset.id = prov.id;
            card.dataset.name = prov.name;
            card.title = prov.name;

            // Real full-color TMDB logo if available; embedded SVG as fallback.
            // onError swaps in the embedded brand SVG so a card is never blank.
            const brandName = (prov.name || prov.slug).replace(/\s*\+$/, "");
            const fbSvg = PROVIDER_SVGS[prov.slug] || "";
            if (prov.logo) {
                card.innerHTML =
                    `<img class="provider-logo-img" src="${prov.logo}" alt="${brandName}" loading="lazy" />` +
                    (fbSvg ? `<span class="provider-fallback-svg hidden" aria-hidden="true">${fbSvg}</span>` : "") +
                    `<span class="provider-name-label">${brandName}</span>`;
                const img = card.querySelector(".provider-logo-img");
                const fb = card.querySelector(".provider-fallback-svg");
                img.addEventListener("error", () => {
                    img.classList.add("hidden");
                    if (fb) {
                        fb.classList.remove("hidden");
                        card.classList.add("fallback-active");
                    } else {
                        // No embedded SVG either — show a styled text chip
                        card.classList.add("text-fallback");
                    }
                });
            } else {
                card.classList.add("fallback-active");
                card.innerHTML =
                    (fbSvg ? `<span class="provider-fallback-svg" aria-hidden="true">${fbSvg}</span>` : "") +
                    `<span class="provider-name-label">${brandName}</span>`;
            }

            card.addEventListener("click", () => {
                filterByProvider(card.dataset.id, card.dataset.name);
            });

            track.appendChild(card);
        });

        const leftBtn = row.querySelector(".row-scroll-btn.left");
        const rightBtn = row.querySelector(".row-scroll-btn.right");
        leftBtn.addEventListener("click", () => track.scrollBy({ left: -400, behavior: "smooth" }));
        rightBtn.addEventListener("click", () => track.scrollBy({ left: 400, behavior: "smooth" }));

        row.querySelector("#providers-see-all-btn").addEventListener("click", () => {
            track.scrollTo({ left: 0, behavior: "smooth" });
        });

        rowsContainer.insertBefore(row, rowsContainer.firstChild);
    }

    async function filterByProvider(providerId, providerName) {
        homepageLoader.classList.remove("hidden");
        const loaderText = document.getElementById("homepage-loader").querySelector(".loader-text");
        const oldText = loaderText.textContent;
        loaderText.textContent = `Tuning into ${providerName}...`;
        window.scrollTo({ top: 0, behavior: "smooth" });

        try {
            const res = await fetch(`/api/provider?id=${providerId}&name=${encodeURIComponent(providerName)}&page=1`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            homepageLoader.classList.add("hidden");
            loaderText.textContent = oldText;

            // Store pagination state for "Load More"
            _providerState = {
                id: providerId,
                name: providerName,
                page: data.page || 1,
                totalPages: data.total_pages || 1,
                hasMore: data.has_more || false,
            };

            openSeeAll({
                title: data.title || `Popular on ${providerName}`,
                items: data.items || [],
                loadMore: data.has_more || false,
            });
        } catch (err) {
            homepageLoader.classList.add("hidden");
            loaderText.textContent = oldText;
            log(`[ Provider ] Filter failed: ${err.message}`, "error");
        }
    }

    async function loadMoreSeeAll() {
        if (!_seeAllPagination || !_seeAllPagination.hasMore) return;
        _seeAllPagination.page += 1;
        _seeAllPagination.hasMore = false; // prevent double-clicks

        const btn = document.getElementById("sa-load-more-btn");
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<div class="loader-spinner small" style="margin:0 auto"></div><span>Loading...</span>`;
        }

        try {
            let res, data;
            if (_seeAllPagination.type === 'genre') {
                const params = new URLSearchParams({
                    genre_id: _seeAllPagination.genre_id,
                    type: _seeAllPagination.media_type,
                    sort_by: activeGenreSort,
                    page: _seeAllPagination.page
                });
                res = await fetch(`/api/genres?${params}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                data = await res.json();

                const section = data.sections && data.sections[0];
                if (section) {
                    _seeAllPagination.hasMore = section.has_more || false;
                    _seeAllPagination.totalPages = section.total_pages || _seeAllPagination.totalPages;
                    const newItems = section.items || [];
                    appendNewSeeAllItems(newItems, btn);
                } else {
                    _seeAllPagination.hasMore = false;
                    if (btn) btn.remove();
                }
            } else {
                res = await fetch(`/api/provider?id=${_seeAllPagination.id}&name=${encodeURIComponent(_seeAllPagination.name)}&page=${_seeAllPagination.page}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                data = await res.json();

                _seeAllPagination.hasMore = data.has_more || false;
                _seeAllPagination.totalPages = data.total_pages || _seeAllPagination.totalPages;

                if (_providerState) {
                    _providerState.page = _seeAllPagination.page;
                    _providerState.hasMore = _seeAllPagination.hasMore;
                }

                const newItems = data.items || [];
                appendNewSeeAllItems(newItems, btn);
            }
        } catch (err) {
            if (_seeAllPagination) _seeAllPagination.hasMore = true; // restore
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `Load More <span class="see-all-arrow">→</span>`;
            }
            log(`[ See All ] Load more failed: ${err.message}`, "error");
        }
    }

    function appendNewSeeAllItems(newItems, btn) {
        const itemKey = it => `${it.tmdb_id || it.id || it.title}-${it.type || ''}`;
        const existingKeys = new Set(_seeAllItems.map(itemKey));
        const filteredNewItems = newItems.filter(it => {
            const key = itemKey(it);
            if (existingKeys.has(key)) return false;
            existingKeys.add(key);
            return true;
        });

        const oldLen = _seeAllItems.length;
        _seeAllItems = _seeAllItems.concat(filteredNewItems);
        seeAllCountEl.textContent = `${_seeAllItems.length} titles`;

        filteredNewItems.forEach((item, idx) => {
            const card = _seeAllView === "list"
                ? buildListCard(item, oldLen + idx)
                : buildSeeAllCard(item, oldLen + idx);
            seeAllGrid.appendChild(card);
        });

        if (_seeAllPagination && _seeAllPagination.hasMore) {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `Load More <span class="see-all-arrow">→</span>`;
            }
        } else if (btn) {
            btn.remove();
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── Page Rendering Layouts ────────────────────────────────────────────────
    async function renderPage(type) {
        rowsContainer.innerHTML = "";
        emptyState.classList.add("hidden");

        // 1. Resolve and update Hero slider items
        let resolvedHero = [];
        if (type === "all") {
            resolvedHero = allHomepageData?.featured || [];
        } else if (type === "movie") {
            const sec = allHomepageData?.sections?.find(s => s.id === "dt-popular") || allHomepageData?.sections?.find(s => s.id === "dt-movies");
            resolvedHero = sec?.items?.slice(0, 8) || [];
        } else if (type === "tv") {
            const sec = allHomepageData?.sections?.find(s => s.id === "dt-tvshows");
            resolvedHero = sec?.items?.slice(0, 8) || [];
        } else if (type === "anime") {
            const sec = allHomepageData?.sections?.find(s => s.id === "dt-anime");
            resolvedHero = sec?.items?.slice(0, 8) || [];
        } else if (type === "episode") {
            const sec = allHomepageData?.sections?.find(s => s.id === "dt-seasons") || allHomepageData?.sections?.find(s => s.id === "dt-episodes");
            resolvedHero = sec?.items?.slice(0, 8) || [];
        }

        if (resolvedHero.length) {
            resolvedHero.forEach(h => {
                if (!h.description && h.synopsis) {
                    h.description = h.synopsis;
                }
            });
            heroItems = resolvedHero;
            buildHeroDots();
            setHero(0);
            startHeroRotation();
            document.getElementById("hero-section").classList.remove("hidden");
        } else {
            // Hide hero if no items found
            document.getElementById("hero-section").classList.add("hidden");
        }

        // 2. Render Watch History & Providers (only on Home/All tab)
        if (type === "all") {
            renderHistoryRow();
            await loadProviderLogos();
            renderProvidersRow();
        }

        // 3. Resolve and render specific sections
        let targetSectionIds = [];
        if (type === "all") {
            targetSectionIds = ["dt-movies", "dt-tvshows", "dt-anime", "dt-seasons", "dt-episodes", "dt-popular"];
        } else if (type === "movie") {
            targetSectionIds = ["dt-movies", "dt-popular", "movie-top-rated", "movie-upcoming"];
        } else if (type === "tv") {
            targetSectionIds = ["dt-tvshows", "tv-top-rated", "dt-seasons", "dt-episodes"];
        } else if (type === "anime") {
            targetSectionIds = ["dt-anime", "anime-top-rated"];
        } else if (type === "episode") {
            targetSectionIds = ["dt-seasons", "dt-episodes"];
        } else if (type === "genres") {
            // Genres page is rendered separately
            renderGenresPage();
            return;
        }

        let renderedCount = 0;
        targetSectionIds.forEach(id => {
            const section = allHomepageData?.sections?.find(s => s.id === id);
            if (section && section.items && section.items.length) {
                renderRow(section);
                renderedCount++;
            }
        });

        if (renderedCount === 0) {
            emptyState.classList.remove("hidden");
        }

        // Render upcoming releases at the bottom
        await renderUpcomingSection(type);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // GENRES PAGE
    // ══════════════════════════════════════════════════════════════════════════
    let genresData = null; // cached genres list from /api/genres
    let activeGenreId = null;
    let activeGenreType = "all";  // "all", "movie", or "tv"
    let activeGenreSort = "popularity.desc";

    async function renderGenresPage() {
        document.getElementById("hero-section").classList.add("hidden");
        rowsContainer.innerHTML = "";
        emptyState.classList.add("hidden");

        // Show loading
        homepageLoader.classList.remove("hidden");

        // Load genres list if not yet cached
        if (!genresData) {
            try {
                const res = await fetch("/api/genres");
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                genresData = await res.json();
            } catch (err) {
                homepageLoader.classList.add("hidden");
                rowsContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">⚡</div><h3>Failed to load genres</h3><p>${err.message}</p></div>`;
                return;
            }
        }

        homepageLoader.classList.add("hidden");

        // Build genres UI
        const container = document.createElement("div");
        container.className = "genres-page";

        // Header
        container.innerHTML = `
            <div class="genres-header">
                <h2 class="genres-title">
                    <span class="row-title-icon" style="color:var(--red); width:20px; height:20px; display:inline-flex; vertical-align:middle; margin-right:8px;">
                        <svg viewBox="0 0 24 24"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"/><circle cx="7.5" cy="10.5" r="1.5"/><circle cx="11.5" cy="7.5" r="1.5"/><circle cx="16.5" cy="9.5" r="1.5"/><path d="M6 16c2 3.5 6 3.5 8 0"/></svg>
                    </span>
                    Browse by Genre
                </h2>
                <p class="genres-subtitle">Discover your next favourite — pick a genre to explore</p>
                <div class="genres-controls">
                    <div class="genre-type-tabs" id="genre-type-tabs">
                        <button class="genre-type-btn ${activeGenreType === 'all' ? 'active' : ''}" data-gtype="all">All</button>
                        <button class="genre-type-btn ${activeGenreType === 'movie' ? 'active' : ''}" data-gtype="movie">Movies</button>
                        <button class="genre-type-btn ${activeGenreType === 'tv' ? 'active' : ''}" data-gtype="tv">Series</button>
                        <button class="genre-type-btn ${activeGenreType === 'anime' ? 'active' : ''}" data-gtype="anime">Anime</button>
                    </div>
                    <select class="genre-sort-select" id="genre-sort-select">
                        <option value="popularity.desc" ${activeGenreSort === 'popularity.desc' ? 'selected' : ''}>Most Popular</option>
                        <option value="vote_average.desc" ${activeGenreSort === 'vote_average.desc' ? 'selected' : ''}>Top Rated</option>
                        <option value="primary_release_date.desc" ${activeGenreSort === 'primary_release_date.desc' ? 'selected' : ''}>Newest First</option>
                        <option value="revenue.desc" ${activeGenreSort === 'revenue.desc' ? 'selected' : ''}>Highest Grossing</option>
                    </select>
                </div>
            </div>
            <div class="genre-pills-section">
                <div class="genre-pills-grid" id="genre-pills-grid"></div>
            </div>
            <div class="genre-content-area" id="genre-content-area"></div>`;

        rowsContainer.appendChild(container);

        // Build genre pills
        const pillsGrid = container.querySelector("#genre-pills-grid");
        buildGenrePills(pillsGrid);

        // Wire type tabs
        container.querySelector("#genre-type-tabs").addEventListener("click", e => {
            const btn = e.target.closest(".genre-type-btn");
            if (!btn) return;
            activeGenreType = btn.dataset.gtype;
            container.querySelectorAll(".genre-type-btn").forEach(b => b.classList.toggle("active", b === btn));
            
            buildGenrePills(pillsGrid);

            const currentPills = activeGenreType === 'anime' ? (genresData.anime_genres || []) :
                                 (activeGenreType === 'movie' ? (genresData.movie_genres || []) :
                                  (activeGenreType === 'tv' ? (genresData.tv_genres || []) :
                                   [...(genresData.movie_genres || []), ...(genresData.tv_genres || [])]));
            
            if (currentPills.length) {
                const exists = currentPills.some(g => String(g.id) === String(activeGenreId));
                if (!exists) {
                    activeGenreId = String(currentPills[0].id);
                }
            }

            pillsGrid.querySelectorAll(".genre-pill").forEach(p => p.classList.toggle("active", String(p.dataset.genreId) === String(activeGenreId)));

            if (activeGenreId) loadGenreContent();
        });

        // Wire sort select
        container.querySelector("#genre-sort-select").addEventListener("change", e => {
            activeGenreSort = e.target.value;
            if (activeGenreId) loadGenreContent();
        });

        // Auto-load first genre if none selected
        if (!activeGenreId) {
            const initialList = activeGenreType === 'anime' ? (genresData.anime_genres || []) :
                                (activeGenreType === 'movie' ? (genresData.movie_genres || []) :
                                 (activeGenreType === 'tv' ? (genresData.tv_genres || []) :
                                  (genresData.movie_genres || [])));
            if (initialList.length) {
                activeGenreId = String(initialList[0].id);
                const firstPill = pillsGrid.querySelector(".genre-pill");
                if (firstPill) firstPill.classList.add("active");
                await loadGenreContent();
            }
        } else {
            // Re-select active pill
            const activePill = pillsGrid.querySelector(`[data-genre-id="${activeGenreId}"]`);
            if (activePill) activePill.classList.add("active");
            await loadGenreContent();
        }
    }

    function buildGenrePills(pillsGrid) {
        if (!genresData) return;
        pillsGrid.innerHTML = "";

        // Deduplicate genres by id
        const seen = new Set();
        const combined = [];
        let listToIterate = [];
        
        if (activeGenreType === 'anime') {
            listToIterate = genresData.anime_genres || [];
        } else if (activeGenreType === 'movie') {
            listToIterate = genresData.movie_genres || [];
        } else if (activeGenreType === 'tv') {
            listToIterate = genresData.tv_genres || [];
        } else {
            listToIterate = [...(genresData.movie_genres || []), ...(genresData.tv_genres || [])];
        }

        listToIterate.forEach(g => {
            if (!seen.has(g.id)) {
                seen.add(g.id);
                combined.push(g);
            }
        });

        combined.forEach(genre => {
            const pill = document.createElement("button");
            pill.className = "genre-pill";
            pill.dataset.genreId = String(genre.id);
            const iconSvg = getGenreIcon(genre.name);
            pill.innerHTML = `<span class="genre-pill-icon">${iconSvg}</span><span class="genre-pill-name">${genre.name}</span>`;
            if (String(genre.id) === String(activeGenreId)) pill.classList.add("active");

            pill.addEventListener("click", async () => {
                activeGenreId = String(genre.id);
                pillsGrid.querySelectorAll(".genre-pill").forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                await loadGenreContent();
            });

            pillsGrid.appendChild(pill);
        });
    }

    async function loadGenreContent() {
        const contentArea = document.getElementById("genre-content-area");
        if (!contentArea) return;

        contentArea.innerHTML = `<div class="genre-loading"><div class="loader-spinner small"></div><span>Loading genre content...</span></div>`;

        try {
            const params = new URLSearchParams({
                genre_id: activeGenreId,
                type: activeGenreType,
                sort_by: activeGenreSort
            });
            const res = await fetch(`/api/genres?${params}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            contentArea.innerHTML = "";

            const sections = data.sections || [];
            if (!sections.length) {
                contentArea.innerHTML = `<div class="genre-empty"><div class="empty-icon"><svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg></div><p>No content found for this genre.</p></div>`;
                return;
            }

            sections.forEach(section => {
                // Render into a temp container then move into contentArea
                const prevContainer = rowsContainer;
                const fakeContainer = document.createElement("div");
                // Temporarily swap rowsContainer
                const originalRows = rowsContainer;

                const row = buildGenreRow(section);
                contentArea.appendChild(row);
            });
        } catch (err) {
            contentArea.innerHTML = `<div class="genre-empty"><div class="empty-icon">⚡</div><p>Failed to load: ${err.message}</p></div>`;
        }
    }

    function buildGenreRow(section) {
        const items = section.items || [];
        const row = document.createElement("div");
        row.className = "content-row genre-result-row";

        row.innerHTML = `
            <div class="row-header">
                <div class="row-title">${formatRowTitleHTML(section.title)}</div>
                <span class="row-see-all" role="button" tabindex="0">See all <span class="see-all-arrow">→</span></span>
            </div>
            <div class="row-track-wrap">
                <button class="row-scroll-btn left" aria-label="Scroll left">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="row-track"></div>
                <button class="row-scroll-btn right" aria-label="Scroll right">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>`;

        const track = row.querySelector(".row-track");
        items.forEach(item => track.appendChild(buildCard(item)));

        const leftBtn = row.querySelector(".row-scroll-btn.left");
        const rightBtn = row.querySelector(".row-scroll-btn.right");
        leftBtn.addEventListener("click", () => track.scrollBy({ left: -600, behavior: "smooth" }));
        rightBtn.addEventListener("click", () => track.scrollBy({ left: 600, behavior: "smooth" }));

        // See All wiring
        const seeAllSpan = row.querySelector(".row-see-all");
        seeAllSpan.addEventListener("click", () => openSeeAll(section));
        seeAllSpan.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") openSeeAll(section); });

        return row;
    }

    // ── Upcoming Releases Helpers (God-Level) ─────────────────────────────────
    async function loadUpcomingData() {
        if (upcomingData) return upcomingData;
        try {
            const res = await fetch("/api/upcoming");
            if (res.ok) {
                upcomingData = await res.json();
            }
        } catch (err) {
            log(`[ Upcoming ] Fetch failed: ${err.message}`, "error");
        }
        return upcomingData;
    }

    function getUpcomingBadgeText(releaseDateStr) {
        if (!releaseDateStr) return "SOON";
        try {
            const rel = new Date(releaseDateStr + "T00:00:00");
            const today = new Date();
            rel.setHours(0,0,0,0);
            today.setHours(0,0,0,0);
            
            const diffTime = rel.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < 0) {
                return "OUT NOW";
            } else if (diffDays === 0) {
                return "TODAY";
            } else if (diffDays === 1) {
                return "TOMORROW";
            } else if (diffDays < 7) {
                return `${diffDays} DAYS`;
            } else if (diffDays < 30) {
                const weeks = Math.round(diffDays / 7);
                return `${weeks} WEEK${weeks > 1 ? 'S' : ''}`;
            } else {
                const months = Math.round(diffDays / 30);
                return `${months} MONTH${months > 1 ? 'S' : ''}`;
            }
        } catch (_) {
            return "SOON";
        }
    }

    function buildUpcomingCard(item) {
        const card = document.createElement("div");
        card.className = "content-card upcoming-card";
        
        const typeLabel = item.item_type || (item.type === "tv" ? "Series" : item.type === "anime" ? "Anime" : "Movie");
        const badgeText = getUpcomingBadgeText(item.release_date);
        
        card.innerHTML = `
            <span class="upcoming-badge">${badgeText}</span>
            <img class="card-poster" src="${item.poster}" alt="${item.title}" loading="lazy"
                 onerror="handleCardImageError(this)"/>
            <div class="card-overlay">
                <div class="upcoming-lock-overlay">
                    ⏳
                </div>
                <div class="card-title-overlay">${item.title}</div>
                <div class="card-meta-overlay">
                    <span class="card-type-tag">${typeLabel}</span>
                    <span style="font-size:0.68rem; color:var(--red-dark); font-weight:600;">${item.release_date}</span>
                </div>
            </div>
            <div class="card-strip">
                <div class="card-name">${item.title}</div>
                <div class="card-sub">
                    <span>${typeLabel}</span>
                    <span class="card-dot"></span>
                    <span style="color: var(--red-dark);">${item.release_date}</span>
                </div>
            </div>`;
            
        card.addEventListener("click", () => openPlayer(item));
        return card;
    }

    async function renderUpcomingSection(type) {
        const data = await loadUpcomingData();
        if (!data) return;
        
        const oldSection = document.getElementById("upcoming-releases-section");
        if (oldSection) oldSection.remove();
        
        if (type === "all") {
            const movies = data.movies || [];
            const tv = data.tv || [];
            const anime = data.anime || [];
            
            if (!movies.length && !tv.length && !anime.length) return;
            
            const section = document.createElement("div");
            section.className = "upcoming-section";
            section.id = "upcoming-releases-section";
            
            section.innerHTML = `
                <div class="upcoming-header-wrap">
                    <span class="upcoming-subtitle">
                        <span class="subtitle-icon" style="vertical-align:middle; display:inline-flex; width:12px; height:12px; margin-right:4px; color:var(--text-muted);">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                        </span>
                        Transmissions from the Future
                    </span>
                    <div class="row-title" style="font-size: 1.15rem; font-weight: 800;">Incoming Releases</div>
                </div>
                <div class="upcoming-tabs" id="upcoming-tabs-container">
                    <button class="upcoming-tab-btn active" data-tab="movies">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px; display:inline-block; vertical-align:middle;"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                        Movies
                    </button>
                    <button class="upcoming-tab-btn" data-tab="series">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px; display:inline-block; vertical-align:middle;"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
                        Web Series
                    </button>
                    <button class="upcoming-tab-btn" data-tab="anime">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px; display:inline-block; vertical-align:middle;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                        Anime
                    </button>
                </div>
                <div class="row-track-wrap">
                    <button class="row-scroll-btn left" aria-label="Scroll left" style="opacity: 1; pointer-events: auto;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <div class="row-track" id="upcoming-row-track"></div>
                    <button class="row-scroll-btn right" aria-label="Scroll right" style="opacity: 1; pointer-events: auto;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                </div>
            `;
            
            const track = section.querySelector("#upcoming-row-track");
            const tabsContainer = section.querySelector("#upcoming-tabs-container");
            
            function fillTrack(category) {
                track.innerHTML = "";
                let items = [];
                if (category === "movies") items = movies;
                else if (category === "series") items = tv;
                else if (category === "anime") items = anime;
                
                if (!items.length) {
                    track.innerHTML = `<div style="color: var(--text-dim); padding: 2rem 0; text-align: center; width: 100%;">No incoming releases in this category.</div>`;
                    return;
                }
                
                items.forEach(item => {
                    track.appendChild(buildUpcomingCard(item));
                });
            }
            
            tabsContainer.addEventListener("click", e => {
                const btn = e.target.closest(".upcoming-tab-btn");
                if (!btn) return;
                
                tabsContainer.querySelectorAll(".upcoming-tab-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                
                fillTrack(btn.dataset.tab);
            });
            
            const leftBtn = section.querySelector(".row-scroll-btn.left");
            const rightBtn = section.querySelector(".row-scroll-btn.right");
            leftBtn.addEventListener("click", () => track.scrollBy({ left: -600, behavior: "smooth" }));
            rightBtn.addEventListener("click", () => track.scrollBy({ left: 600, behavior: "smooth" }));
            
            fillTrack("movies");
            rowsContainer.appendChild(section);
            
        } else if (type === "movie" || type === "tv" || type === "anime") {
            let items = [];
            let rowTitle = "";
            if (type === "movie") {
                items = data.movies || [];
                rowTitle = "📅 Upcoming Movies";
            } else if (type === "tv") {
                items = data.tv || [];
                rowTitle = "📅 Upcoming Web Series";
            } else if (type === "anime") {
                items = data.anime || [];
                rowTitle = "📅 Upcoming Anime";
            }
            
            if (!items.length) return;
            
            const section = document.createElement("div");
            section.className = "content-row upcoming-row";
            section.id = "upcoming-releases-section";
            
            section.innerHTML = `
                <div class="row-header">
                    <div class="row-title">${formatRowTitleHTML(rowTitle)}</div>
                </div>
                <div class="row-track-wrap">
                    <button class="row-scroll-btn left" aria-label="Scroll left">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <div class="row-track"></div>
                    <button class="row-scroll-btn right" aria-label="Scroll right">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                </div>
            `;
            
            const track = section.querySelector(".row-track");
            items.forEach(item => {
                track.appendChild(buildUpcomingCard(item));
            });
            
            const leftBtn = section.querySelector(".row-scroll-btn.left");
            const rightBtn = section.querySelector(".row-scroll-btn.right");
            leftBtn.addEventListener("click", () => track.scrollBy({ left: -600, behavior: "smooth" }));
            rightBtn.addEventListener("click", () => track.scrollBy({ left: 600, behavior: "smooth" }));
            
            rowsContainer.appendChild(section);
        }
    }

    function startUpcomingCountdown(releaseDateStr) {
        if (countdownTimerInterval) clearInterval(countdownTimerInterval);
        
        const countdownWrap = document.getElementById("upcoming-countdown-wrap");
        if (!countdownWrap) return;
        
        if (!releaseDateStr) {
            countdownWrap.classList.add("hidden");
            return;
        }
        
        const daysEl = document.getElementById("countdown-days");
        const hoursEl = document.getElementById("countdown-hours");
        const minsEl = document.getElementById("countdown-mins");
        const secsEl = document.getElementById("countdown-secs");
        
        const targetDate = new Date(releaseDateStr + "T00:00:00");
        
        function updateClock() {
            const now = new Date();
            const timeDiff = targetDate.getTime() - now.getTime();
            
            if (timeDiff <= 0) {
                clearInterval(countdownTimerInterval);
                daysEl.textContent = "00";
                hoursEl.textContent = "00";
                minsEl.textContent = "00";
                secsEl.textContent = "00";
                return;
            }
            
            const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((timeDiff % (1000 * 60)) / 1000);
            
            daysEl.textContent = String(days).padStart(2, '0');
            hoursEl.textContent = String(hours).padStart(2, '0');
            minsEl.textContent = String(mins).padStart(2, '0');
            secsEl.textContent = String(secs).padStart(2, '0');
        }
        
        updateClock();
        countdownWrap.classList.remove("hidden");
        countdownTimerInterval = setInterval(updateClock, 1000);
    }

    // HOMEPAGE LOADING
    // ══════════════════════════════════════════════════════════════════════════
    async function loadHomepage() {
        homepageLoader.classList.remove("hidden");
        rowsContainer.innerHTML = "";
        emptyState.classList.add("hidden");

        // Fetch backend config
        try {
            const configRes = await fetch("/api/config");
            if (configRes.ok) {
                globalConfig = await configRes.json();
            }
        } catch (_) {}

        try {
            // Parallel fetch homepage and upcoming data
            const [hpRes, _] = await Promise.all([
                fetch("/api/homepage"),
                loadUpcomingData()
            ]);
            
            if (!hpRes.ok) throw new Error(`HTTP ${hpRes.status}`);
            const data = await hpRes.json();
            allHomepageData = data;

            // Update app name if changed
            if (data.app?.name) {
                appNameNav.textContent = data.app.name;
                document.title = `${data.app.name} — ${data.app.tagline || ""}`;
            }

            renderPage("all");
            homepageLoader.classList.add("hidden");
        } catch (err) {
            homepageLoader.classList.add("hidden");
            rowsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚡</div>
                    <h3>Failed to load content</h3>
                    <p>${err.message} — check the source domain in Settings.</p>
                </div>`;
        }
    }

    // ── Hero ──────────────────────────────────────────────────────────────────
    function buildHeroDots() {
        heroDots.innerHTML = "";
        heroItems.forEach((_, i) => {
            const dot = document.createElement("div");
            dot.className = "hero-dot";
            dot.addEventListener("click", () => { setHero(i); restartHeroRotation(); });
            heroDots.appendChild(dot);
        });
    }

    function setHero(idx) {
        heroIdx = idx;
        const item = heroItems[idx];
        if (!item) return;

        const bgUrl = item.backdrop || item.poster || "";
        heroBg.style.backgroundImage = `url('${bgUrl}')`;
        heroTitle.textContent = item.title || "—";
        heroRatingVal.textContent = item.rating || "—";
        heroYear.textContent = item.year || "";
        heroTypeBadge.textContent = item.type === "tv" ? "Series" : "Movie";
        heroDesc.textContent = item.description || "Click Play to start streaming.";
        heroBadge.innerHTML = item.type === "tv"
            ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px; display:inline-block; vertical-align:middle;"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg> Series'
            : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px; display:inline-block; vertical-align:middle;"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg> Movie';

        // Update dots
        heroDots.querySelectorAll(".hero-dot").forEach((d, i) => {
            d.classList.toggle("active", i === idx);
        });

        // Wire play button
        heroPlayBtn.onclick = () => openPlayer(item);
        heroInfoBtn.onclick = () => openPlayer(item);
    }

    function startHeroRotation() {
        clearInterval(heroTimer);
        heroTimer = setInterval(() => {
            const next = (heroIdx + 1) % heroItems.length;
            setHero(next);
        }, 7000);
    }
    function restartHeroRotation() { startHeroRotation(); }

    // ── Rows ──────────────────────────────────────────────────────────────────
    function renderRow(section) {
        const items = section.items || [];
        if (!items.length) return;

        const row = document.createElement("div");
        row.className = "content-row";
        row.dataset.sectionId = section.id;

        row.innerHTML = `
            <div class="row-header">
                <div class="row-title">${formatRowTitleHTML(section.title)}</div>
                <span class="row-see-all" role="button" tabindex="0">See all <span class="see-all-arrow">→</span></span>
            </div>
            <div class="row-track-wrap">
                <button class="row-scroll-btn left" aria-label="Scroll left">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="row-track"></div>
                <button class="row-scroll-btn right" aria-label="Scroll right">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>`;

        const track = row.querySelector(".row-track");
        items.forEach(item => {
            track.appendChild(buildCard(item));
        });

        // Scroll buttons
        const leftBtn = row.querySelector(".row-scroll-btn.left");
        const rightBtn = row.querySelector(".row-scroll-btn.right");
        const scrollAmt = 600;
        leftBtn.addEventListener("click", () => track.scrollBy({ left: -scrollAmt, behavior: "smooth" }));
        rightBtn.addEventListener("click", () => track.scrollBy({ left: scrollAmt, behavior: "smooth" }));

        // ── See All button ────────────────────────────────────────────────────
        const seeAllBtn = row.querySelector(".row-see-all");
        seeAllBtn.addEventListener("click", () => openSeeAll(section));
        seeAllBtn.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") openSeeAll(section); });

        rowsContainer.appendChild(row);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SEE ALL OVERLAY
    // ══════════════════════════════════════════════════════════════════════════
    const seeAllOverlay = document.getElementById("see-all-overlay");
    const seeAllBackBtn = document.getElementById("see-all-back-btn");
    const seeAllTitleEl = document.getElementById("see-all-title");
    const seeAllCountEl = document.getElementById("see-all-count");
    const seeAllGrid = document.getElementById("see-all-grid");
    const seeAllSortSel = document.getElementById("see-all-sort-select");
    const seeAllSearchInp = document.getElementById("see-all-search-input");
    const seeAllGridBtn = document.getElementById("see-all-grid-btn");
    const seeAllListBtn = document.getElementById("see-all-list-btn");

    let _seeAllItems = [];   // full item list for the open section
    let _seeAllPagination = null;
    let _seeAllView = "grid"; // "grid" | "list"
    let _seeAllFilter = "";

    function openSeeAll(section) {
        _seeAllItems = section.items || [];
        _seeAllFilter = "";
        seeAllSearchInp.value = "";
        seeAllSortSel.value = "default";
        _seeAllView = "grid";
        seeAllGrid.classList.remove("list-view");
        seeAllGridBtn.classList.add("active");
        seeAllListBtn.classList.remove("active");

        seeAllTitleEl.innerHTML = formatRowTitleHTML(section.title);
        seeAllCountEl.textContent = `${_seeAllItems.length} titles`;

        // Setup pagination state
        if (section.genre_id) {
            _seeAllPagination = {
                type: 'genre',
                genre_id: section.genre_id,
                media_type: section.media_type,
                page: section.page || 1,
                totalPages: section.total_pages || 1,
                hasMore: section.has_more || false
            };
        } else if (section.loadMore && _providerState) {
            _seeAllPagination = {
                type: 'provider',
                id: _providerState.id,
                name: _providerState.name,
                page: _providerState.page,
                totalPages: _providerState.totalPages,
                hasMore: _providerState.hasMore
            };
        } else {
            _seeAllPagination = null;
        }

        renderSeeAllGrid(!!_seeAllPagination);

        seeAllOverlay.classList.remove("hidden");
        seeAllOverlay.classList.add("open");
        document.body.style.overflow = "hidden";
        // Scroll to top
        seeAllOverlay.scrollTop = 0;
    }

    function closeSeeAll() {
        seeAllOverlay.classList.remove("open");
        seeAllOverlay.classList.add("closing");
        setTimeout(() => {
            seeAllOverlay.classList.add("hidden");
            seeAllOverlay.classList.remove("closing");
            document.body.style.overflow = "";
        }, 340);
    }

    function sortItems(items, sortVal) {
        const arr = [...items];
        switch (sortVal) {
            case "rating-desc": return arr.sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
            case "rating-asc": return arr.sort((a, b) => parseFloat(a.rating || 0) - parseFloat(b.rating || 0));
            case "year-desc": return arr.sort((a, b) => parseInt(b.year || 0) - parseInt(a.year || 0));
            case "year-asc": return arr.sort((a, b) => parseInt(a.year || 0) - parseInt(b.year || 0));
            case "title-asc": return arr.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
            case "title-desc": return arr.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
            default: return arr;
        }
    }

    function renderSeeAllGrid(showLoadMore = false) {
        const sortVal = seeAllSortSel.value;
        const query = _seeAllFilter.trim().toLowerCase();

        let items = sortItems(_seeAllItems, sortVal);
        if (query) {
            items = items.filter(it => (it.title || "").toLowerCase().includes(query));
        }

        seeAllCountEl.textContent = query
            ? `${items.length} of ${_seeAllItems.length} titles`
            : `${_seeAllItems.length} titles`;

        seeAllGrid.innerHTML = "";

        if (!items.length) {
            seeAllGrid.innerHTML = `<div class="see-all-empty">
                <div class="sa-empty-icon"><svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" fill="none" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                <p>No results for "<strong>${query}</strong>"</p>
            </div>`;
            return;
        }

        items.forEach((item, idx) => {
            const card = _seeAllView === "list"
                ? buildListCard(item, idx)
                : buildSeeAllCard(item, idx);
            seeAllGrid.appendChild(card);
        });

        // "Load More" button with pagination
        // Remove any existing button first
        const existingBtn = document.getElementById("sa-load-more-btn");
        if (existingBtn) existingBtn.remove();

        if (showLoadMore && _seeAllPagination && _seeAllPagination.hasMore && !query) {
            const loadMoreBtn = document.createElement("button");
            loadMoreBtn.id = "sa-load-more-btn";
            loadMoreBtn.className = "sa-load-more-btn";
            loadMoreBtn.innerHTML = `Load More <span class="see-all-arrow">→</span>`;
            loadMoreBtn.addEventListener("click", loadMoreSeeAll);
            seeAllGrid.parentElement.insertBefore(loadMoreBtn, seeAllGrid.nextSibling);
        }
    }

    function buildSeeAllCard(item, idx) {
        const card = document.createElement("div");
        card.className = "sa-card";
        card.style.animationDelay = `${Math.min(idx * 0.025, 0.4)}s`;

        const typeLabel = item.item_type || (item.type === "tv" ? "Series" : item.type === "anime" ? "Anime" : "Movie");
        const ratingHtml = item.rating
            ? `<span class="sa-rating"><svg width="9" height="9" viewBox="0 0 24 24" fill="#f5c518"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>${item.rating}</span>`
            : "";

        card.innerHTML = `
            <div class="sa-poster-wrap">
                <img class="sa-poster" src="${item.poster}" alt="${item.title}" loading="lazy"
                     onerror="this.parentElement.classList.add('sa-no-poster'); this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'"/>
                <div class="sa-overlay">
                    <div class="sa-play-ring">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                </div>
                <span class="sa-type-badge">${typeLabel}</span>
            </div>
            <div class="sa-info">
                <div class="sa-title">${item.title}</div>
                <div class="sa-meta">
                    ${item.year ? `<span class="sa-year">${item.year}</span>` : ""}
                    ${ratingHtml}
                </div>
            </div>`;

        card.addEventListener("click", () => { closeSeeAll(); setTimeout(() => openPlayer(item), 350); });
        return card;
    }

    function buildListCard(item, idx) {
        const card = document.createElement("div");
        card.className = "sa-list-card";
        card.style.animationDelay = `${Math.min(idx * 0.02, 0.3)}s`;

        const typeLabel = item.item_type || (item.type === "tv" ? "Series" : item.type === "anime" ? "Anime" : "Movie");
        const ratingStars = item.rating ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="#f5c518"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> ${item.rating}` : "—";

        card.innerHTML = `
            <div class="sa-list-num">${idx + 1}</div>
            <div class="sa-list-thumb-wrap">
                <img class="sa-list-thumb" src="${item.poster}" alt="${item.title}" loading="lazy"
                     onerror="this.parentElement.classList.add('sa-no-poster'); this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'"/>
                <div class="sa-list-play">▶</div>
            </div>
            <div class="sa-list-info">
                <div class="sa-list-title">${item.title}</div>
                <div class="sa-list-meta">
                    <span class="sa-list-type">${typeLabel}</span>
                    ${item.year ? `<span class="sa-list-year">${item.year}</span>` : ""}
                </div>
            </div>
            <div class="sa-list-rating">${ratingStars}</div>
            <button class="sa-list-play-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Play
            </button>`;

        card.addEventListener("click", () => { closeSeeAll(); setTimeout(() => openPlayer(item), 350); });
        return card;
    }

    // Wire controls
    seeAllBackBtn.addEventListener("click", closeSeeAll);
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && seeAllOverlay.classList.contains("open")) closeSeeAll();
    });

    seeAllSortSel.addEventListener("change", renderSeeAllGrid);

    let _seeAllSearchTimer = null;
    seeAllSearchInp.addEventListener("input", () => {
        clearTimeout(_seeAllSearchTimer);
        _seeAllFilter = seeAllSearchInp.value;
        _seeAllSearchTimer = setTimeout(renderSeeAllGrid, 200);
    });

    seeAllGridBtn.addEventListener("click", () => {
        _seeAllView = "grid";
        seeAllGrid.classList.remove("list-view");
        seeAllGridBtn.classList.add("active");
        seeAllListBtn.classList.remove("active");
        renderSeeAllGrid();
    });

    seeAllListBtn.addEventListener("click", () => {
        _seeAllView = "list";
        seeAllGrid.classList.add("list-view");
        seeAllListBtn.classList.add("active");
        seeAllGridBtn.classList.remove("active");
        renderSeeAllGrid();
    });



    function buildCard(item) {
        const card = document.createElement("div");
        card.className = "content-card";

        const typeLabel = item.item_type || (item.type === "tv" ? "Series" : item.type === "episode" ? "Episode" : item.type === "season" ? "Season" : "Movie");
        const ratingHtml = item.rating
            ? `<span class="card-rating-tag"><svg width="10" height="10" viewBox="0 0 24 24" fill="#f5c518"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>${item.rating}</span>` : "";

        card.innerHTML = `
            <img class="card-poster" src="${item.poster}" alt="${item.title}" loading="lazy"
                 onerror="handleCardImageError(this)"/>
            <div class="card-overlay">
                <div class="card-play-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </div>
                <div class="card-title-overlay">${item.title}</div>
                <div class="card-meta-overlay">
                    ${item.year ? `<span class="card-year-tag">${item.year}</span><span class="card-dot"></span>` : ""}
                    <span class="card-type-tag">${typeLabel}</span>
                    ${ratingHtml}
                </div>
            </div>
            <div class="card-strip">
                <div class="card-name">${item.title}</div>
                <div class="card-sub">
                    ${item.year ? `<span>${item.year}</span><span class="card-dot"></span>` : ""}
                    <span>${typeLabel}</span>
                </div>
            </div>`;

        card.addEventListener("click", () => openPlayer(item));
        return card;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PLAYER MODAL
    // ══════════════════════════════════════════════════════════════════════════
    async function openPlayer(item) {
        resetPreload();
        // Show modal
        playerModal.classList.remove("hidden");
        modalBackdrop.classList.remove("hidden");
        document.body.style.overflow = "hidden";
        clearHlsAndIframe();

        // Reset real-time countdown timer
        if (countdownTimerInterval) {
            clearInterval(countdownTimerInterval);
            countdownTimerInterval = null;
        }
        const countdownWrap = document.getElementById("upcoming-countdown-wrap");
        if (countdownWrap) countdownWrap.classList.add("hidden");

        // Reset or load TV series / anime state from history
        seasonsData = [];
        activeSeasonIdx = item.lastSeasonIdx !== undefined ? item.lastSeasonIdx : 0;
        activeEpisodeIdx = item.lastEpisodeIdx !== undefined ? item.lastEpisodeIdx : 0;
        preferredServer = item.lastServer || preferredServer || null;
        autoSelectServer = !!preferredServer;

        activeImdbId = item.imdb_id || "";
        activeItemMeta = item; // store for history saving

        // Change tab favicon to the poster of what's playing
        if (item.poster) setDynamicFavicon(item.poster);

        // Reset UI
        playerTitle.textContent = item.title || "Loading...";
        pmRating.textContent = "";
        const initDate = item.release_date || item.year || "";
        const initDateFmt = initDate.includes("-") ? formatExactDate(initDate) : initDate;
        pmYear.innerHTML = initDateFmt ? `📅 ${initDateFmt}` : "";
        pmRuntime.textContent = "";
        playerPlot.textContent = "";
        playerTags.innerHTML = "";
        serversGrid.innerHTML = "";
        serversLoading.classList.remove("hidden");
        serversGrid.appendChild(serversLoading);
        tvNav.classList.add("hidden");
        qualityRow.classList.add("hidden");
        dlWrap.classList.add("hidden");
        enableDownloadBtn(false);
        if (omnisaveOptions) {
            omnisaveOptions.innerHTML = "";
            omnisaveOptions.classList.add("hidden");
        }
        if (detailsCastList) detailsCastList.innerHTML = "";
        if (detailsCastWrap) detailsCastWrap.classList.add("hidden");
        if (omnisaveBtn) {
            omnisaveBtn.disabled = false;
            if (omnisaveBtnText) omnisaveBtnText.textContent = "Direct MP4 Download";
        }
        consoleLogs.innerHTML = `<div class="log-line system">[System] Opening: ${item.title}</div>`;

        // Setup details landing page view
        playerWrap.classList.add("details-active");
        playerDetailsView.classList.remove("hidden");
        hideSpinner();

        // Populate details landing page
        const isTV = item.type === "tv" || item.type === "anime";
        const posterUrl = item.poster || "";
        // For the backdrop, use the highest available resolution (replace TMDB thumbnail with w1280)
        const backdropUrl = posterUrl.replace('/w185/', '/w1280/').replace('/w92/', '/w1280/').replace('/w154/', '/w1280/').replace('/w342/', '/w1280/');
        detailsBackdrop.style.backgroundImage = backdropUrl ? `url('${backdropUrl}')` : "";
        
        // Reset details poster fallback states
        detailsPoster.classList.remove("details-poster-fallback");
        detailsPoster.setAttribute("onerror", "handleDetailsPosterError(this)");
        const oldDetailsFallback = detailsPoster.parentElement.querySelector(".details-poster-fallback-inner");
        if (oldDetailsFallback) oldDetailsFallback.remove();
        
        detailsPoster.src = posterUrl;

        // Badge row
        detailsBadge.textContent = isTV ? "Series" : item.type === "episode" ? "Episode" : "Movie";
        detailsTitle.textContent = item.title || "—";
        detailsRatingVal.textContent = item.rating || "N/A";
        detailsYear.textContent = item.year || "";
        detailsRuntime.style.display = "none"; // hidden until IMDB fills it
        detailsDesc.textContent = item.description || item.plot || "Select Play to start streaming.";
        detailsGenres.innerHTML = ""; // cleared until IMDB data arrives

        const isUpcoming = !!item.is_upcoming;

        // Smart play button label: "Play S1E1" for TV, "Play Now" for movies, "Watch Trailer" for upcoming
        detailsPlayBtnText.textContent = isUpcoming ? "Watch Trailer" : (isTV ? "Play S1E1" : "Play Now");

        // Pre-set idle poster inside player box
        document.getElementById("idle-poster-bg").style.backgroundImage = posterUrl ? `url('${posterUrl}')` : "";

        // Wire Play/Trailer button click
        detailsPlayBtn.onclick = () => {
            if (isUpcoming) {
                const searchQ = `${item.title} official trailer`;
                window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchQ)}`, '_blank');
                return;
            }
            playerWrap.classList.remove("details-active");
            playerDetailsView.classList.add("hidden");
            showSpinner("Fetching servers...");

            const resolvedId = activeImdbId || item.imdb_id || null;
            if (isTV) {
                // Play active/selected episode in grid or fallback
                const targetEpBtn = episodesGrid.querySelector(".episode-btn.active") || episodesGrid.querySelector(".episode-btn");
                if (targetEpBtn) {
                    targetEpBtn.click();
                } else {
                    loadStreams(resolvedId, null, "1", "1");
                }
            } else {
                loadStreams(resolvedId, item.url || null);
                if (activeItemMeta) saveHistory(activeItemMeta); // save history immediately for movies
            }
        };

        if (isUpcoming) {
            detailsPlayBtn.classList.remove("hidden");
            detailsLoaderMsg.classList.add("hidden");
            
            // Load IMDb metadata in background for additional description, rating etc.
            fetchAndShowImdbData(item).then(() => {
                // Keep upcoming visual controls
                detailsPlayBtnText.textContent = "Watch Trailer";
                detailsPlayBtn.onclick = () => {
                    const searchQ = `${item.title} official trailer`;
                    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchQ)}`, '_blank');
                };
                startUpcomingCountdown(item.release_date);
            });
            
            startUpcomingCountdown(item.release_date);
        } else {
            // Show loader and hide play button initially
            detailsPlayBtn.classList.add("hidden");
            detailsLoaderMsg.classList.remove("hidden");

            const promises = [];
            promises.push(fetchAndShowImdbData(item));
            if (isTV) {
                promises.push(loadTVDetails(item));
            }

            try {
                await Promise.all(promises);
            } catch (err) {
                log(`[ TV ERROR ] Details load interrupted: ${err.message}`, "error");
            } finally {
                // Once all details / episodes loaded, hide loader and show play button
                detailsLoaderMsg.classList.add("hidden");
                detailsPlayBtn.classList.remove("hidden");

                // Smart play button label update based on resolved episode metadata
                if (isTV) {
                    const activeEp = seasonsData[activeSeasonIdx]?.episodes[activeEpisodeIdx] || seasonsData[0]?.episodes[0];
                    if (activeEp) {
                        const parts = activeEp.num.split("-");
                        const seasonNum = parts[0]?.trim() || "1";
                        const epNum = parts[1]?.trim() || "1";
                        const prefix = (item.lastSeasonIdx !== undefined) ? "Resume" : "Play";
                        detailsPlayBtnText.textContent = `${prefix} S${seasonNum}E${epNum}`;
                    } else {
                        detailsPlayBtnText.textContent = "Play S1E1";
                    }
                } else {
                    const prefix = (item.lastServer) ? "Resume Playback" : "Play Now";
                    detailsPlayBtnText.textContent = prefix;
                }
            }
        }
    }

    // ── IMDB enrichment ───────────────────────────────────────────────────────
    async function fetchAndShowImdbData(item) {
        const imdbId = item.imdb_id;
        const tmdbId = item.tmdb_id;
        let url;
        const cb = Date.now();
        if (imdbId) {
            url = `/api/imdb?id=${encodeURIComponent(imdbId)}&type=${encodeURIComponent(item.type || "movie")}&cb=${cb}`;
        } else if (tmdbId) {
            url = `/api/imdb?tmdb_id=${encodeURIComponent(tmdbId)}&type=${encodeURIComponent(item.type || "movie")}&cb=${cb}`;
        } else {
            url = `/api/imdb?title=${encodeURIComponent(item.title || "")}&year=${encodeURIComponent(item.year || "")}&type=${encodeURIComponent(item.type || "movie")}&url=${encodeURIComponent(item.url || "")}&cb=${cb}`;
        }

        try {
            const res = await fetch(url);
            if (!res.ok) return;
            const d = await res.json();
            if (!d || !d.title) return;

            // Save resolved ID if returned
            if (d.imdb_id) {
                item.imdb_id = d.imdb_id;
                activeImdbId = d.imdb_id;
            }

            // Save other enriched info so we can access it for episode fallback
            item.rating = d.rating || item.rating || "";
            item.year = d.year || item.year || "";
            item.release_date = d.release_date || item.release_date || "";
            item.runtime = d.runtime || item.runtime || "";
            item.plot = d.plot || item.plot || "";
            item.description = d.plot || item.description || "";

            playerTitle.textContent = d.title || item.title;

            // Enrich details landing view
            if (d.title) detailsTitle.textContent = d.title;
            if (d.rating) {
                detailsRatingVal.textContent = d.rating;
                detailsRatingVal.parentElement.style.display = "";
            } else {
                detailsRatingVal.textContent = "N/A";
            }
            if (d.year) detailsYear.textContent = d.year;
            if (d.runtime) {
                detailsRuntime.textContent = d.runtime;
                detailsRuntime.style.display = "";
            }
            if (d.plot) detailsDesc.textContent = d.plot;

            // Ambient blurred backdrop and high-res poster from TMDB if available
            if (d.backdrop) {
                detailsBackdrop.style.backgroundImage = `url('${d.backdrop}')`;
            }
            if (d.poster) {
                // Reset details poster fallback states
                detailsPoster.classList.remove("details-poster-fallback");
                detailsPoster.setAttribute("onerror", "handleDetailsPosterError(this)");
                const oldDetailsFallback = detailsPoster.parentElement.querySelector(".details-poster-fallback-inner");
                if (oldDetailsFallback) oldDetailsFallback.remove();

                detailsPoster.src = d.poster;
            }

            // Genre pills
            if (d.genre) {
                detailsGenres.innerHTML = "";
                d.genre.split(",").slice(0, 5).forEach(g => {
                    const tag = document.createElement("span");
                    tag.className = "details-genre-tag";
                    tag.textContent = g.trim();
                    detailsGenres.appendChild(tag);
                });
            }

            if (d.rating) {
                pmRating.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="#f5c518" style="margin-right:3px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>${d.rating}/10`;
            }
            const dateStr = d.release_date || d.year || "";
            if (dateStr) {
                const displayDate = dateStr.includes("-") ? formatExactDate(dateStr) : dateStr;
                pmYear.innerHTML = `📅 ${displayDate}`;
            }
            if (d.runtime) {
                const rt = String(d.runtime).includes("min") ? d.runtime : `${d.runtime}`;
                pmRuntime.innerHTML = `⏳ ${rt}`;
            }
            if (d.plot) playerPlot.textContent = d.plot;

            // Tags
            playerTags.innerHTML = "";
            const tags = [d.genre, d.country, d.language, d.rated].filter(Boolean);
            tags.flatMap(t => t.split(",")).slice(0, 6).forEach(t => {
                const span = document.createElement("span");
                span.className = "player-tag";
                span.textContent = t.trim();
                playerTags.appendChild(span);
            });

            // Render Cast & Characters
            if (d.cast && d.cast.length > 0 && detailsCastList && detailsCastWrap) {
                detailsCastList.innerHTML = "";
                
                function getInitials(name) {
                    if (!name) return "?";
                    const parts = name.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                    }
                    return name[0] ? name[0].toUpperCase() : "?";
                }

                d.cast.forEach(actor => {
                    const card = document.createElement("div");
                    card.className = "cast-card";
                    
                    const avatarWrap = document.createElement("div");
                    avatarWrap.className = "cast-avatar-wrap";
                    
                    const hasSecondary = !!actor.actor_image;
                    
                    if (actor.profile_path) {
                        const img = document.createElement("img");
                        img.className = "cast-avatar cast-avatar-primary";
                        img.src = actor.profile_path;
                        img.alt = actor.character || actor.name;
                        img.loading = "lazy";
                        img.onerror = () => {
                            avatarWrap.innerHTML = `<div class="cast-avatar-placeholder">${getInitials(actor.name)}</div>`;
                        };
                        avatarWrap.appendChild(img);
                        
                        if (hasSecondary) {
                            avatarWrap.classList.add("has-hover-image");
                            const hoverImg = document.createElement("img");
                            hoverImg.className = "cast-avatar cast-avatar-secondary";
                            hoverImg.src = actor.actor_image;
                            hoverImg.alt = actor.name;
                            hoverImg.loading = "lazy";
                            hoverImg.onerror = () => {
                                hoverImg.remove();
                                avatarWrap.classList.remove("has-hover-image");
                            };
                            avatarWrap.appendChild(hoverImg);
                        }
                    } else {
                        avatarWrap.innerHTML = `<div class="cast-avatar-placeholder">${getInitials(actor.name)}</div>`;
                    }
                    
                    const name = document.createElement("div");
                    name.className = "cast-name";
                    name.textContent = actor.name;
                    
                    const role = document.createElement("div");
                    role.className = "cast-role";
                    role.textContent = actor.character;
                    
                    card.appendChild(avatarWrap);
                    card.appendChild(name);
                    card.appendChild(role);
                    
                    detailsCastList.appendChild(card);
                });
                detailsCastWrap.classList.remove("hidden");
            } else if (detailsCastWrap) {
                detailsCastWrap.classList.add("hidden");
            }

            // TV Show layout auto-switch if this is a series and we don't have seasons loaded yet
            const isSeries = d.type === "series" || d.type === "tv" || d.type === "show";
            if (isSeries) {
                if (d.seasons_count) {
                    detailsBadge.textContent = `${d.seasons_count} Season${d.seasons_count > 1 ? 's' : ''}`;
                } else {
                    detailsBadge.textContent = "Series";
                }
                // Avoid parallel/redundant calls if we already know this is a TV/Anime series from the card metadata
                const alreadyTV = activeItemMeta && (activeItemMeta.type === "tv" || activeItemMeta.type === "anime" || activeItemMeta.type === "series");
                if (!alreadyTV && tvNav.classList.contains("hidden")) {
                    log(`[ TV ] Auto-detecting series from IMDb/TMDB, loading seasons...`, "system");
                    await loadTVDetails({ imdb_id: item.imdb_id, url: item.url, title: d.title });
                }
            }
        } catch (_) { }
    }

    async function loadTVDetails(item) {
        log(`[ TV ] Loading seasons for: ${item.title}`, "system");
        try {
            let url = `/api/tv_details?`;
            const tmdbId = item.tmdb_id || (activeItemMeta && activeItemMeta.tmdb_id);
            const id = activeImdbId || item.imdb_id;
            const cb = Date.now();
            if (tmdbId) {
                url += `tmdb_id=${encodeURIComponent(tmdbId)}&cb=${cb}`;
            } else if (id) {
                url += `id=${encodeURIComponent(id)}&cb=${cb}`;
                if (item.url) url += `&url=${encodeURIComponent(item.url)}`;
            } else if (item.url) {
                url += `url=${encodeURIComponent(item.url)}&cb=${cb}`;
            } else {
                throw new Error("No ID, TMDB ID or URL to fetch TV series details");
            }
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            seasonsData = data.seasons || [];

            if (data.imdb_id) {
                activeImdbId = data.imdb_id;
            }

            if (!seasonsData.length) {
                showNoServers("No episodes found for this series.");
                return;
            }

            log(`[ TV ] ${seasonsData.length} seasons resolved`, "success");
            tvNav.classList.remove("hidden");

            // Populate season selector
            seasonSelect.innerHTML = "";
            seasonsData.forEach((s, i) => {
                const opt = document.createElement("option");
                opt.value = i;
                opt.textContent = s.season;
                seasonSelect.appendChild(opt);
            });

            // Set current active season selector value
            if (activeSeasonIdx < seasonsData.length && activeSeasonIdx >= 0) {
                seasonSelect.value = activeSeasonIdx;
            } else {
                activeSeasonIdx = 0;
            }

            seasonSelect.onchange = () => {
                const idx = parseInt(seasonSelect.value, 10);
                activeSeasonIdx = idx;
                activeEpisodeIdx = 0;
                renderEpisodes(idx);
            };
            renderEpisodes(activeSeasonIdx, activeEpisodeIdx);
        } catch (err) {
            log(`[ TV ERROR ] ${err.message}`, "error");
            showNoServers("Failed to load episodes.");
        }
    }

    function renderEpisodes(seasonIdx, startEpIdx = 0) {
        episodesGrid.innerHTML = "";
        activeSeasonIdx = seasonIdx;
        activeEpisodeIdx = startEpIdx;
        const s = seasonsData[seasonIdx];
        if (!s) return;
        log(`[ TV ] Rendering ${s.episodes.length} episodes for ${s.season}`, "info");

        s.episodes.forEach((ep, epIdx) => {
            const btn = document.createElement("button");
            btn.className = "episode-btn";
            btn.textContent = `Ep ${ep.num.split("-")[1]?.trim() || ep.num}`;
            btn.title = ep.name;
            btn.dataset.epIdx = epIdx;

            btn.addEventListener("click", () => {
                selectEpisode(seasonIdx, epIdx, ep);
            });

            episodesGrid.appendChild(btn);
        });

        // Auto-play the startEpIdx episode and highlight it
        const allBtns = episodesGrid.querySelectorAll(".episode-btn");
        if (startEpIdx >= allBtns.length || startEpIdx < 0) {
            startEpIdx = 0;
        }
        activeEpisodeIdx = startEpIdx;
        if (allBtns[startEpIdx]) {
            allBtns[startEpIdx].classList.add("active");
            allBtns[startEpIdx].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
        updateEpNavBar();
    }

    function updateSidebarForEpisode(ep) {
        if (!ep) return;
        
        const parts = ep.num.split("-");
        const seasonNum = parts[0]?.trim() || "1";
        const epNum = parts[1]?.trim() || "1";
        
        if (activeItemMeta) {
            playerTitle.textContent = `${activeItemMeta.title} - S${seasonNum}E${epNum}: ${ep.name}`;
        } else {
            playerTitle.textContent = `S${seasonNum}E${epNum}: ${ep.name}`;
        }
        
        if (ep.rating && parseFloat(ep.rating) > 0) {
            pmRating.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="#f5c518" style="margin-right:3px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>${ep.rating}/10`;
            pmRating.style.display = "";
        } else if (activeItemMeta && activeItemMeta.rating) {
            pmRating.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="#f5c518" style="margin-right:3px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>${activeItemMeta.rating}/10`;
            pmRating.style.display = "";
        } else {
            pmRating.textContent = "";
            pmRating.style.display = "none";
        }
        
        if (ep.air_date) {
            pmYear.innerHTML = `📅 ${formatExactDate(ep.air_date)}`;
            pmYear.style.display = "";
        } else if (activeItemMeta && (activeItemMeta.release_date || activeItemMeta.year)) {
            const dateStr = activeItemMeta.release_date || activeItemMeta.year;
            const displayDate = dateStr.includes("-") ? formatExactDate(dateStr) : dateStr;
            pmYear.innerHTML = `📅 ${displayDate}`;
            pmYear.style.display = "";
        } else {
            pmYear.textContent = "";
            pmYear.style.display = "none";
        }
        
        if (ep.runtime) {
            const rt = String(ep.runtime).includes("min") ? ep.runtime : `${ep.runtime} min`;
            pmRuntime.innerHTML = `⏳ ${rt}`;
            pmRuntime.style.display = "";
        } else if (activeItemMeta && activeItemMeta.runtime) {
            const rt = String(activeItemMeta.runtime).includes("min") ? activeItemMeta.runtime : `${activeItemMeta.runtime}`;
            pmRuntime.innerHTML = `⏳ ${rt}`;
            pmRuntime.style.display = "";
        } else {
            pmRuntime.textContent = "";
            pmRuntime.style.display = "none";
        }
        
        if (ep.plot && ep.plot.trim()) {
            playerPlot.textContent = ep.plot;
            playerPlot.style.display = "";
        } else if (activeItemMeta && (activeItemMeta.description || activeItemMeta.plot)) {
            playerPlot.textContent = activeItemMeta.description || activeItemMeta.plot;
            playerPlot.style.display = "";
        } else {
            playerPlot.textContent = "";
            playerPlot.style.display = "none";
        }
    }

    // Core: select and load a specific episode
    function selectEpisode(seasonIdx, epIdx, ep) {
        resetPreload();
        cancelIframeAutoplayTimer(); // cancel any running iframe countdown before switching
        // Deactivate details mode when a specific episode is clicked
        playerWrap.classList.remove("details-active");
        playerDetailsView.classList.add("hidden");

        activeSeasonIdx = seasonIdx;
        activeEpisodeIdx = epIdx;

        episodesGrid.querySelectorAll(".episode-btn").forEach(b => b.classList.remove("active"));
        const btn = episodesGrid.querySelector(`[data-ep-idx="${epIdx}"]`);
        if (btn) {
            btn.classList.add("active");
            btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }

        updateSidebarForEpisode(ep);

        const parts = ep.num.split("-");
        const seasonNum = parts[0]?.trim();
        const epNum = parts[1]?.trim();

        if (ep.url) {
            loadStreams(activeImdbId || null, ep.url, seasonNum, epNum);
        } else {
            loadStreams(activeImdbId || null, null, seasonNum, epNum);
        }
        updateEpNavBar();
        if (activeItemMeta) saveHistory(activeItemMeta);
    }

    // Navigate to a season+episode index — handles cross-season wrap
    function playEpisodeAt(seasonIdx, epIdx) {
        if (seasonIdx < 0 || seasonIdx >= seasonsData.length) return;
        const s = seasonsData[seasonIdx];
        if (!s || !s.episodes.length) return;
        // Clamp epIdx
        epIdx = Math.max(0, Math.min(epIdx, s.episodes.length - 1));

        // Switch season select if needed
        if (seasonIdx !== activeSeasonIdx) {
            seasonSelect.value = seasonIdx;
            renderEpisodes(seasonIdx, epIdx);
            selectEpisode(seasonIdx, epIdx, s.episodes[epIdx]);
        } else {
            selectEpisode(seasonIdx, epIdx, s.episodes[epIdx]);
        }
    }

    // Update prev/next buttons and the label
    function updateEpNavBar() {
        const s = seasonsData[activeSeasonIdx];
        if (!s) return;

        const ep = s.episodes[activeEpisodeIdx];
        const epLabel = ep ? (ep.num.split("-")[1]?.trim() || ep.num) : "?";
        const seasonLabel = s.season || `S${activeSeasonIdx + 1}`;
        epNavInfo.textContent = `${seasonLabel} · Ep ${epLabel}`;

        // Is there a previous episode?
        const hasPrev = activeEpisodeIdx > 0 || activeSeasonIdx > 0;
        // Is there a next episode?
        const hasNext = activeEpisodeIdx < s.episodes.length - 1 || activeSeasonIdx < seasonsData.length - 1;

        epPrevBtn.disabled = !hasPrev;
        epNextBtn.disabled = !hasNext;
    }

    // Wire Prev / Next buttons
    epPrevBtn.addEventListener("click", () => {
        autoSelectServer = true; // remember to re-select same server
        if (activeEpisodeIdx > 0) {
            playEpisodeAt(activeSeasonIdx, activeEpisodeIdx - 1);
        } else if (activeSeasonIdx > 0) {
            // Go to last episode of previous season
            const prevSeason = seasonsData[activeSeasonIdx - 1];
            if (prevSeason) playEpisodeAt(activeSeasonIdx - 1, prevSeason.episodes.length - 1);
        }
    });

    epNextBtn.addEventListener("click", () => {
        autoSelectServer = true; // remember to re-select same server
        const s = seasonsData[activeSeasonIdx];
        
        let targetSeasonIdx = activeSeasonIdx;
        let targetEpIdx = activeEpisodeIdx + 1;
        if (s && activeEpisodeIdx >= s.episodes.length - 1) {
            targetSeasonIdx = activeSeasonIdx + 1;
            targetEpIdx = 0;
        }

        if (preloadState.isResolved && preloadState.seasonIdx === targetSeasonIdx && preloadState.episodeIdx === targetEpIdx) {
            log(`[ PRELOAD ] Instant swap triggered via 'Next' button click!`, "success");
            swapToPreloadedEpisode();
            return;
        }

        if (s && activeEpisodeIdx < s.episodes.length - 1) {
            playEpisodeAt(activeSeasonIdx, activeEpisodeIdx + 1);
        } else if (activeSeasonIdx < seasonsData.length - 1) {
            playEpisodeAt(activeSeasonIdx + 1, 0);
        }
    });

    // ── Custom Links LocalStorage Helpers ─────────────────────────────────────
    function getCustomLinks(imdbId, tmdbId, season = null, episode = null) {
        const idKey = imdbId || tmdbId || "unknown";
        const key = `custom_links_${idKey}` + (season ? `_S${season}E${episode}` : "");
        try {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }

    function saveCustomLink(imdbId, tmdbId, season = null, episode = null, name, url) {
        const idKey = imdbId || tmdbId || "unknown";
        const key = `custom_links_${idKey}` + (season ? `_S${season}E${episode}` : "");
        try {
            const links = getCustomLinks(imdbId, tmdbId, season, episode);
            if (!links.some(l => l.url === url)) {
                links.push({ name, url, is_custom: true });
                localStorage.setItem(key, JSON.stringify(links));
            }
        } catch (e) {
            console.error("Failed to save custom link", e);
        }
    }

    function deleteCustomLink(imdbId, tmdbId, season = null, episode = null, url) {
        const idKey = imdbId || tmdbId || "unknown";
        const key = `custom_links_${idKey}` + (season ? `_S${season}E${episode}` : "");
        try {
            let links = getCustomLinks(imdbId, tmdbId, season, episode);
            links = links.filter(link => link.url !== url);
            localStorage.setItem(key, JSON.stringify(links));
        } catch (e) {
            console.error("Failed to delete custom link", e);
        }
    }

    // ── Streams ───────────────────────────────────────────────────────────────
    // Track any open EventSource so we can close it on re-navigate
    let _streamSource = null;

    async function loadStreams(imdbId, pageUrl, season = null, episode = null) {
        // Close any previous stream connection
        if (_streamSource) { _streamSource.close(); _streamSource = null; }

        showSpinner("Fetching servers...");
        serversGrid.innerHTML = "";
        serversGrid.appendChild(serversLoading);
        serversLoading.classList.remove("hidden");
        qualityRow.classList.add("hidden");

        // Reset server drawer state (will reopen when servers arrive)
        if (serverDrawer) {
            serverDrawer.classList.remove("open");
            serverDrawer.classList.add("hidden");
        }
        if (serverDrawerBackdrop) {
            serverDrawerBackdrop.classList.remove("active");
        }
        if (serverDrawerToggle) serverDrawerToggle.classList.add("hidden");

        let url;
        const tmdbId = activeItemMeta?.tmdb_id;
        if (imdbId) {
            url = `/api/fetch?stream=1&id=${encodeURIComponent(imdbId)}`;
            if (tmdbId) url += `&tmdb_id=${encodeURIComponent(tmdbId)}`;
            if (season) url += `&s=${encodeURIComponent(season)}`;
            if (episode) url += `&e=${encodeURIComponent(episode)}`;
        } else if (tmdbId) {
            url = `/api/fetch?stream=1&tmdb_id=${encodeURIComponent(tmdbId)}`;
            if (season) url += `&s=${encodeURIComponent(season)}`;
            if (episode) url += `&e=${encodeURIComponent(episode)}`;
        } else {
            url = `/api/fetch?stream=1&url=${encodeURIComponent(pageUrl)}`;
            if (season) url += `&s=${encodeURIComponent(season)}`;
            if (episode) url += `&e=${encodeURIComponent(episode)}`;
        }

        currentStreamImdbId = imdbId;
        currentStreamTmdbId = activeItemMeta?.tmdb_id || null;
        currentStreamSeason = season;
        currentStreamEpisode = episode;

        // Render stored custom links first
        const customLinks = getCustomLinks(imdbId, currentStreamTmdbId, season, episode);
        if (customLinks.length > 0) {
            serversLoading.classList.add("hidden");
            hideSpinner();
            showIdleOverlay(null);
            firstCard = false;
            // Auto-open left drawer when servers arrive
            showServerDrawerToggle();
            openServerDrawer();
            
            customLinks.forEach((link, idx) => {
                const srv = {
                    server: `custom-${idx}`,
                    name: link.name,
                    is_iframe: true,
                    is_custom: true,
                    embed_url: link.url,
                    streams: [{
                        quality: "Custom Embed",
                        language: "Multi",
                        url: link.url
                    }],
                    ping_ms: 10 // sort to top
                };
                appendServerCard(srv, totalCards);
                totalCards++;
            });
        }


        log(`[ STREAM ] Connecting to server stream...`, "system");

        let firstCard = true;
        let totalCards = 0;

        const evtSource = new EventSource(url);
        _streamSource = evtSource;

        evtSource.onmessage = (e) => {
            let srv;
            try { srv = JSON.parse(e.data); } catch (_) { return; }

            // ── Done signal ──────────────────────────────────────────────────
            if (srv.__done__) {
                evtSource.close();
                _streamSource = null;

                // Resolve imdb_id from done payload
                if (srv.imdb_id && !activeImdbId) {
                    activeImdbId = srv.imdb_id;
                    fetchAndShowImdbData({ 
                        imdb_id: srv.imdb_id, 
                        title: playerTitle.textContent,
                        type: activeItemMeta ? activeItemMeta.type : "movie"
                    });
                }

                if (totalCards === 0) {
                    showNoServers("No streams found for this title.");
                    showIdleOverlay("");
                } else {
                    hideSpinner();
                    resortServerCards();
                    log(`[ OK ] ${totalCards} server(s) loaded — sorted by speed`, "success");

                    // Autoplay fallback: if autoSelectServer is still true, auto-play the default server or first (fastest) server
                    if (autoSelectServer) {
                        autoSelectServer = false;
                        const cards = serversGrid.querySelectorAll(".server-item");
                        if (cards && cards.length > 0) {
                            let selectedCard = cards[0]; // default fallback
                            
                            if (globalConfig && globalConfig.default_server) {
                                const defSrv = globalConfig.default_server.toLowerCase();
                                for (let i = 0; i < cards.length; i++) {
                                    const srvId = (cards[i].dataset.serverId || "").toLowerCase();
                                    if (srvId === defSrv) {
                                        selectedCard = cards[i];
                                        log(`[ AUTOPLAY ] Default streaming server matched: ${cards[i].querySelector(".server-name")?.textContent || srvId}`, "success");
                                        break;
                                    }
                                }
                            }
                            
                            const nameVal = selectedCard.querySelector(".server-name")?.textContent || "Selected Server";
                            if (selectedCard === cards[0] && globalConfig && globalConfig.default_server && (cards[0].dataset.serverId || "").toLowerCase() !== globalConfig.default_server.toLowerCase()) {
                                log(`[ AUTOPLAY ] Default server "${globalConfig.default_server}" not found. Auto-selecting fastest: ${nameVal}`, "info");
                            } else {
                                log(`[ AUTOPLAY ] Auto-selecting server: ${nameVal}`, "success");
                            }
                            setTimeout(() => selectedCard.click(), 150);
                        }
                    }
                }
                return;
            }

            // ── First server arrived ─────────────────────────────────────────
            if (firstCard) {
                serversLoading.classList.add("hidden");
                hideSpinner();
                showIdleOverlay(null);
                firstCard = false;
                // Auto-open left drawer when first real server arrives
                showServerDrawerToggle();
                openServerDrawer();
            }

            // Append card immediately
            appendServerCard(srv, totalCards);
            totalCards++;
        };

        evtSource.onerror = () => {
            evtSource.close();
            _streamSource = null;
            if (firstCard) {
                serversLoading.classList.add("hidden");
                hideSpinner();
                showNoServers("Failed to connect to stream.");
                showIdleOverlay("");
            }
        };
    }

    // Append a single server card to the grid (called live as each server arrives)
    function appendServerCard(srv, idx = 0) {
        srv.streams.forEach((stream) => {
            const item = document.createElement("div");
            item.className = "server-item server-item-enter";
            item.style.animationDelay = "0ms"; // no delay for live-arriving cards
            item.dataset.ping = srv.ping_ms != null ? srv.ping_ms : "9999";
            item.dataset.serverId = srv.server;

            const langLow = (stream.language || "unknown").toLowerCase();
            const globeIcon = `<svg viewBox="0 0 24 24" class="lang-globe-icon" style="width:12px; height:12px; stroke:currentColor; fill:none; stroke-width:2.5; vertical-align:middle; margin-right:4px;"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

            const badge = srv.is_iframe ? "Embed" : `Ch ${srv.server}`;
            const pill = srv.is_iframe ? "Embed" : "HLS";

            const ping = srv.ping_ms;
            let pingHtml = "";
            if (ping != null) {
                const pingClass = ping < 400 ? "ping-fast" : ping < 900 ? "ping-mid" : "ping-slow";
                pingHtml = `<span class="ping-badge ${pingClass}">${ping}ms</span>`;
            }

            let deleteBtnHtml = "";
            if (srv.is_custom) {
                deleteBtnHtml = `<button class="btn-delete-custom" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.85rem; padding: 0.2rem 0.4rem; transition:color 0.15s; margin-right: 6px;" title="Delete custom link">✕</button>`;
            }

            item.innerHTML = `
                <div class="server-info">
                    <div class="server-title-row">
                        <span class="server-name">${srv.name}</span>
                        <span class="channel-badge">${badge}</span>
                    </div>
                    <div class="server-meta-row">
                        <span class="lang-pill">${globeIcon} ${stream.language}</span>
                        <span class="quality-badge-pill">${pill}</span>
                        ${pingHtml}
                    </div>
                </div>
                <div style="display:flex; align-items:center;">
                    ${deleteBtnHtml}
                    <button class="btn-play">▶</button>
                </div>`;

            item.addEventListener("click", () => {
                serversGrid.querySelectorAll(".server-item").forEach(el => el.classList.remove("active"));
                item.classList.add("active");
                // Remember which server the user picked
                preferredServer = {
                    name: srv.name,
                    language: stream.language,
                    is_iframe: !!srv.is_iframe
                };
                if (activeItemMeta) saveHistory(activeItemMeta);
                if (srv.is_iframe) playIframe(srv);
                else playHLS(srv, stream);
            });

            if (srv.is_custom) {
                const delBtn = item.querySelector(".btn-delete-custom");
                if (delBtn) {
                    delBtn.addEventListener("click", (evt) => {
                        evt.stopPropagation(); // Prevent play trigger
                        if (confirm(`Are you sure you want to delete "${srv.name}"?`)) {
                            deleteCustomLink(currentStreamImdbId, currentStreamTmdbId, currentStreamSeason, currentStreamEpisode, srv.embed_url);
                            item.remove();
                            log(`[ CUSTOM ] Deleted custom link: ${srv.name}`, "info");
                        }
                    });
                }
            }

            const speedLabel = ping != null ? ` [${ping}ms]` : "";
            log(`[ SERVER ] ${srv.name} [${stream.language}]${speedLabel} — ${srv.is_iframe ? "Embed" : "HLS"}`, "decrypted");
            serversGrid.appendChild(item);

            // Auto-select if this matches the preferred server from the previous episode
            if (autoSelectServer && preferredServer) {
                const nameMatch = srv.name.toLowerCase() === preferredServer.name.toLowerCase();
                const langMatch = (stream.language || "").toLowerCase() === (preferredServer.language || "").toLowerCase();
                const typeMatch = !!srv.is_iframe === preferredServer.is_iframe;
                if (nameMatch && langMatch && typeMatch) {
                    autoSelectServer = false; // matched — don't auto-click again
                    // Small delay so the card is visible before auto-clicking
                    setTimeout(() => item.click(), 120);
                }
            }
        });
    }

    // Re-sort server cards by ping when all have arrived, smooth stagger animation
    function resortServerCards() {
        const cards = [...serversGrid.querySelectorAll(".server-item")];
        if (cards.length <= 1) {
            if (cards[0]) markFastest(cards[0]);
            return;
        }

        cards.sort((a, b) => compareServers(a.dataset.serverId, a.dataset.ping, b.dataset.serverId, b.dataset.ping));

        cards.forEach((card, i) => {
            // Reset animation for re-sort reveal
            card.classList.remove("server-item-enter");
            void card.offsetWidth; // force reflow
            card.style.animationDelay = `${i * 45}ms`;
            card.classList.add("server-item-enter");
            serversGrid.appendChild(card); // re-append in sorted order
        });

        markFastest(cards[0]);
    }

    // Add ⚡ Fastest tag to the top card
    function markFastest(card) {
        if (!card) return;
        // Remove any existing fastest tags
        serversGrid.querySelectorAll(".fastest-tag").forEach(el => el.remove());
        const nameEl = card.querySelector(".server-title-row");
        if (nameEl && card.dataset.ping !== "9999") {
            const tag = document.createElement("span");
            tag.className = "fastest-tag";
            tag.textContent = "⚡ Fastest";
            nameEl.insertBefore(tag, nameEl.querySelector(".channel-badge"));
        }
    }


    function showNoServers(msg) {
        serversGrid.innerHTML = `<div class="no-servers-msg">⚠ ${msg}</div>`;
    }

    function renderServers(servers) {
        serversGrid.innerHTML = "";
        
        // Merge custom links for the currently active item/episode
        const customLinks = getCustomLinks(
            currentStreamImdbId || activeImdbId || activeItemMeta?.imdb_id,
            currentStreamTmdbId || activeItemMeta?.tmdb_id,
            currentStreamSeason || activeSeasonIdx + 1,
            currentStreamEpisode || activeEpisodeIdx + 1
        );
        
        // Create custom server items
        const customServers = customLinks.map((link, idx) => ({
            server: `custom-${idx}`,
            name: link.name,
            is_iframe: true,
            is_custom: true,
            embed_url: link.url,
            streams: [{
                quality: "Custom Embed",
                language: "Multi",
                url: link.url
            }],
            ping_ms: 10
        }));
        
        // Combine them
        const allServers = [...customServers, ...servers];
        allServers.sort((a, b) => compareServers(a.server, a.ping_ms, b.server, b.ping_ms));
        
        let cardIndex = 0;
        allServers.forEach((srv, srvIdx) => {
            srv.streams.forEach((stream) => {
                const item = document.createElement("div");
                item.className = "server-item";
                item.dataset.ping = srv.ping_ms != null ? srv.ping_ms : "9999";
                item.dataset.serverId = srv.server;
                // Staggered slide-in animation
                item.style.animationDelay = `${cardIndex * 55}ms`;
                item.classList.add("server-item-enter");

                const langLow = (stream.language || "unknown").toLowerCase();
                const globeIcon = `<svg viewBox="0 0 24 24" class="lang-globe-icon" style="width:12px; height:12px; stroke:currentColor; fill:none; stroke-width:2.5; vertical-align:middle; margin-right:4px;"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

                const badge = srv.is_iframe ? "Embed" : `Ch ${srv.server}`;
                const pill = srv.is_iframe ? "Embed" : "HLS";

                // Speed badge
                const ping = srv.ping_ms;
                let pingHtml = "";
                let fastestTag = "";
                if (cardIndex === 0 && ping != null && ping !== 10) {
                    fastestTag = `<span class="fastest-tag">⚡ Fastest</span>`;
                }
                if (ping != null && ping !== 10) {
                    const pingClass = ping < 400 ? "ping-fast" : ping < 900 ? "ping-mid" : "ping-slow";
                    pingHtml = `<span class="ping-badge ${pingClass}">${ping}ms</span>`;
                }

                let deleteBtnHtml = "";
                if (srv.is_custom) {
                    deleteBtnHtml = `<button class="btn-delete-custom" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.85rem; padding: 0.2rem 0.4rem; transition:color 0.15s; margin-right: 6px;" title="Delete custom link">✕</button>`;
                }

                item.innerHTML = `
                    <div class="server-info">
                        <div class="server-title-row">
                            <span class="server-name">${srv.name}</span>
                            ${fastestTag}
                            <span class="channel-badge">${badge}</span>
                        </div>
                        <div class="server-meta-row">
                            <span class="lang-pill">${globeIcon} ${stream.language}</span>
                            <span class="quality-badge-pill">${pill}</span>
                            ${pingHtml}
                        </div>
                    </div>
                    <div style="display:flex; align-items:center;">
                        ${deleteBtnHtml}
                        <button class="btn-play">▶</button>
                    </div>`;

                item.addEventListener("click", () => {
                    serversGrid.querySelectorAll(".server-item").forEach(el => el.classList.remove("active"));
                    item.classList.add("active");
                    // Save to watch history
                    if (activeItemMeta) saveHistory(activeItemMeta);
                    if (srv.is_iframe) playIframe(srv);
                    else playHLS(srv, stream);
                });

                if (srv.is_custom) {
                    const delBtn = item.querySelector(".btn-delete-custom");
                    if (delBtn) {
                        delBtn.addEventListener("click", (evt) => {
                            evt.stopPropagation(); // Prevent play trigger
                            if (confirm(`Are you sure you want to delete "${srv.name}"?`)) {
                                deleteCustomLink(
                                    currentStreamImdbId || activeImdbId || activeItemMeta?.imdb_id,
                                    currentStreamTmdbId || activeItemMeta?.tmdb_id,
                                    currentStreamSeason || activeSeasonIdx + 1,
                                    currentStreamEpisode || activeEpisodeIdx + 1,
                                    srv.embed_url
                                );
                                item.remove();
                                log(`[ CUSTOM ] Deleted custom link: ${srv.name}`, "info");
                            }
                        });
                    }
                }

                const speedLabel = (ping != null && ping !== 10) ? ` [${ping}ms]` : "";
                log(`[ SERVER ] ${srv.name} [${stream.language}]${speedLabel} — ${srv.is_iframe ? "Embed" : "HLS"}`, "decrypted");
                serversGrid.appendChild(item);
                cardIndex++;
            });
        });
    }

    // ── Play HLS ──────────────────────────────────────────────────────────────
    function playHLS(server, stream) {
        clearHlsAndIframe();
        hideIdleOverlay();
        videoEl.classList.remove("hidden");
        iframeEl.classList.add("hidden");
        if (openExternalBtn) openExternalBtn.classList.remove("hidden");
        showSpinner("Buffering...");

        const rawUrl = stream.url;
        const referer = serverReferers[server.server] || "";
        let proxyUrl = `/api/proxy?url=${encodeURIComponent(rawUrl)}`;
        if (referer) proxyUrl += `&referer=${encodeURIComponent(referer)}`;

        activeStreamUrl = rawUrl;
        activeReferer = referer;
        activeTitle = `${server.name} [${stream.language}]`;

        enableDownloadBtn(true);
        qualityRow.classList.remove("hidden");
        qualityMenu.innerHTML = "";
        qualityBtnText.textContent = "Quality: Auto";

        log(`[ HLS ] Connecting: ${rawUrl.slice(0, 70)}...`, "info");

        if (Hls.isSupported()) {
            hlsInstance = new Hls({ maxMaxBufferLength: 10, enableWorker: true, lowLatencyMode: true });
            hlsInstance.loadSource(proxyUrl);
            hlsInstance.attachMedia(videoEl);

            hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                hideSpinner();
                // Autoplay disabled - require user click to play

                const levels = hlsInstance.levels;
                if (levels?.length > 1) buildQualityMenu(levels);
            });

            hlsInstance.on(Hls.Events.LEVEL_SWITCHED, (_, d) => {
                const lvl = hlsInstance.levels[d.level];
                if (lvl) {
                    const res = lvl.height ? `${lvl.height}p` : "Auto";
                    log(`[ QUALITY ] Switched to ${res} (${Math.round(lvl.bitrate / 1000)}kbps)`, "info");
                    if (hlsInstance.currentLevel === -1) qualityBtnText.textContent = `Quality: Auto (${res})`;
                }
            });

            hlsInstance.on(Hls.Events.ERROR, (_, d) => {
                if (d.fatal) {
                    if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        log("[ ERR ] Network error — retrying...", "error");
                        hlsInstance.startLoad();
                    } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        log("[ ERR ] Media error — recovering...", "error");
                        hlsInstance.recoverMediaError();
                    } else {
                        log(`[ FATAL ] ${d.details}`, "error");
                        showSpinner("Playback error. Try another server.");
                    }
                }
            });
        } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
            videoEl.src = proxyUrl;
            // Autoplay disabled - require user click to play
            hideSpinner();
        } else {
            showSpinner("HLS not supported in this browser.");
        }
    }

    // ── Play Iframe ───────────────────────────────────────────────────────────
    function playIframe(server) {
        clearHlsAndIframe();
        hideIdleOverlay();
        videoEl.classList.add("hidden");
        if (openExternalBtn) openExternalBtn.classList.remove("hidden");

        // Re-create the iframe element to completely reset and clear the browser's sandbox context
        const oldIframe = document.getElementById("iframe-player");
        const parent = oldIframe.parentElement;
        const newIframe = document.createElement("iframe");
        newIframe.id = "iframe-player";
        newIframe.className = oldIframe.className;
        newIframe.frameBorder = "0";
        newIframe.setAttribute("allowfullscreen", "true");

        parent.replaceChild(newIframe, oldIframe);
        iframeEl = newIframe; // update global reference

        iframeEl.classList.remove("hidden");

        activeStreamUrl = server.embed_url;
        activeReferer = "";
        activeTitle = server.name;

        enableDownloadBtn(false);
        qualityRow.classList.add("hidden");

        log(`[ IFRAME ] Loading: ${server.name}`, "info");
        hideSpinner();

        log(`[ IFRAME ] Sandbox cleared via iframe re-creation`, "system");
        iframeEl.src = server.embed_url;

        // Autoplay next timer start completely removed
    }

    // ── Iframe Autoplay Timer ─────────────────────────────────────────────────
    function startIframeAutoplayTimer(totalSec) {
        cancelIframeAutoplayTimer();

        // Resolve next episode
        let nextSeasonIdx = activeSeasonIdx;
        let nextEpIdx = activeEpisodeIdx + 1;
        const curSeason = seasonsData[activeSeasonIdx];
        if (!curSeason || nextEpIdx >= curSeason.episodes.length) {
            if (activeSeasonIdx + 1 < seasonsData.length) {
                nextSeasonIdx = activeSeasonIdx + 1;
                nextEpIdx = 0;
            } else {
                return; // no next episode
            }
        }
        const nextEp = seasonsData[nextSeasonIdx]?.episodes[nextEpIdx];
        if (!nextEp) return;

        // Wire overlay buttons
        const overlayEl   = document.getElementById('next-ep-overlay');
        const nameEl      = document.getElementById('next-ep-name');
        const playNowBtn  = document.getElementById('next-ep-play-now');
        const cancelBtn   = document.getElementById('next-ep-cancel');

        if (nameEl) nameEl.textContent = nextEp.name || `Episode ${nextEpIdx + 1}`;

        function doAutoplay() {
            cancelIframeAutoplayTimer();
            autoSelectServer = true; // Auto-select fastest/preferred server
            playEpisodeAt(nextSeasonIdx, nextEpIdx);
        }

        if (playNowBtn) {
            playNowBtn.onclick = () => doAutoplay();
        }
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                cancelIframeAutoplayTimer();
                log('[ AUTOPLAY ] Cancelled by user', 'info');
            };
        }

        _iframeTimerState = {
            totalSec: totalSec,
            elapsedSec: 0,
            isPaused: false,
            showingCountdown: false,
            countdownSecsLeft: 10,
            nextSeasonIdx: nextSeasonIdx,
            nextEpIdx: nextEpIdx
        };

        log(`[ AUTOPLAY ] Fallback iframe timer started — next episode in ${totalSec}s (countdown at ${Math.max(0, totalSec - 10)}s)`, 'system');

        const CIRCUMFERENCE = 119.38;
        const secondsEl   = document.getElementById('next-ep-seconds');
        const ringFill    = document.getElementById('next-ep-ring-fill');

        _iframeAutoplayTick = setInterval(() => {
            if (_iframeTimerState.isPaused) return;

            _iframeTimerState.elapsedSec++;

            const countdownStartSec = Math.max(0, _iframeTimerState.totalSec - 10);

            if (_iframeTimerState.elapsedSec >= _iframeTimerState.totalSec) {
                doAutoplay();
            } else if (_iframeTimerState.elapsedSec >= countdownStartSec) {
                // Show countdown overlay
                if (!_iframeTimerState.showingCountdown) {
                    _iframeTimerState.showingCountdown = true;
                    if (overlayEl) overlayEl.classList.remove('hidden');
                }
                
                const secsLeft = _iframeTimerState.totalSec - _iframeTimerState.elapsedSec;
                _iframeTimerState.countdownSecsLeft = secsLeft;

                if (secondsEl) secondsEl.textContent = secsLeft;
                if (ringFill) {
                    const fraction = secsLeft / 10;
                    ringFill.style.strokeDashoffset = CIRCUMFERENCE * (1 - fraction);
                }
            }
        }, 1000);
    }

    function triggerIframeAutoplayImmediate() {
        if (!_iframeTimerState || _iframeTimerState.nextSeasonIdx === -1) {
            let nextSeasonIdx = activeSeasonIdx;
            let nextEpIdx = activeEpisodeIdx + 1;
            const curSeason = seasonsData[activeSeasonIdx];
            if (!curSeason || nextEpIdx >= curSeason.episodes.length) {
                if (activeSeasonIdx + 1 < seasonsData.length) {
                    nextSeasonIdx = activeSeasonIdx + 1;
                    nextEpIdx = 0;
                } else {
                    return; // no next episode
                }
            }
            _iframeTimerState.nextSeasonIdx = nextSeasonIdx;
            _iframeTimerState.nextEpIdx = nextEpIdx;
        }

        // Fast-forward countdown visually for feedback
        const overlayEl = document.getElementById('next-ep-overlay');
        if (overlayEl) {
            overlayEl.classList.remove('hidden');
        }
        const nameEl = document.getElementById('next-ep-name');
        const nextEp = seasonsData[_iframeTimerState.nextSeasonIdx]?.episodes[_iframeTimerState.nextEpIdx];
        if (nameEl && nextEp) {
            nameEl.textContent = nextEp.name || `Episode ${_iframeTimerState.nextEpIdx + 1}`;
        }

        // Trigger a quick 3-second visual countdown transition
        if (_iframeAutoplayTick) clearInterval(_iframeAutoplayTick);
        _iframeTimerState.totalSec = 3;
        _iframeTimerState.elapsedSec = 0;
        _iframeTimerState.isPaused = false;
        _iframeTimerState.showingCountdown = true;

        const CIRCUMFERENCE = 119.38;
        const secondsEl   = document.getElementById('next-ep-seconds');
        const ringFill    = document.getElementById('next-ep-ring-fill');

        if (secondsEl) secondsEl.textContent = "3";
        if (ringFill) ringFill.style.strokeDashoffset = CIRCUMFERENCE;

        log(`[ AUTOPLAY ] Immediate video end event received — auto-playing in 3s...`, 'success');

        _iframeAutoplayTick = setInterval(() => {
            _iframeTimerState.elapsedSec++;
            const secsLeft = 3 - _iframeTimerState.elapsedSec;
            if (secsLeft <= 0) {
                cancelIframeAutoplayTimer();
                autoSelectServer = true; // Auto-select fastest/preferred server
                playEpisodeAt(_iframeTimerState.nextSeasonIdx, _iframeTimerState.nextEpIdx);
            } else {
                if (secondsEl) secondsEl.textContent = secsLeft;
                if (ringFill) {
                    ringFill.style.strokeDashoffset = CIRCUMFERENCE * (1 - secsLeft / 3);
                }
            }
        }, 1000);
    }

    function cancelIframeAutoplayTimer() {
        if (_iframeAutoplayTimer) { clearTimeout(_iframeAutoplayTimer); _iframeAutoplayTimer = null; }
        if (_iframeAutoplayTick)  { clearInterval(_iframeAutoplayTick);  _iframeAutoplayTick = null; }
        _iframeTimerState = {
            totalSec: 0,
            elapsedSec: 0,
            isPaused: false,
            showingCountdown: false,
            countdownSecsLeft: 10,
            nextSeasonIdx: -1,
            nextEpIdx: -1
        };
        const overlayEl = document.getElementById('next-ep-overlay');
        if (overlayEl) overlayEl.classList.add('hidden');
    }

    // ── Quality Menu ──────────────────────────────────────────────────────────
    function buildQualityMenu(levels) {
        qualityMenu.innerHTML = "";
        const autoOpt = document.createElement("button");
        autoOpt.className = "quality-option active";
        autoOpt.textContent = "Auto";
        autoOpt.addEventListener("click", () => {
            hlsInstance.currentLevel = -1;
            setActiveQuality("-1");
            qualityBtnText.textContent = "Quality: Auto";
        });
        qualityMenu.appendChild(autoOpt);

        [...levels].reverse().forEach((lvl, ri) => {
            const realIdx = levels.length - 1 - ri;
            const opt = document.createElement("button");
            opt.className = "quality-option";
            const res = lvl.height ? `${lvl.height}p` : `${lvl.width}×${lvl.height}`;
            opt.textContent = res;
            opt.dataset.idx = realIdx;
            opt.addEventListener("click", () => {
                hlsInstance.currentLevel = realIdx;
                setActiveQuality(String(realIdx));
                qualityBtnText.textContent = `Quality: ${res}`;
                log(`[ QUALITY ] Forced to ${res}`, "success");
            });
            qualityMenu.appendChild(opt);
        });

        function setActiveQuality(idx) {
            qualityMenu.querySelectorAll(".quality-option").forEach(o => {
                o.classList.toggle("active", (o.dataset.idx ?? "-1") === idx);
            });
        }
    }

    // Quality dropdown toggle
    qualityBtn.addEventListener("click", e => {
        e.stopPropagation();
        qualitySel.classList.toggle("open");
        qualityMenu.classList.toggle("hidden");
    });
    document.addEventListener("click", () => {
        qualitySel.classList.remove("open");
        qualityMenu.classList.add("hidden");
    });


    // ── Cleanup ───────────────────────────────────────────────────────────────
    function clearHlsAndIframe() {
        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
        videoEl.src = "";
        iframeEl.src = "about:blank";
        if (openExternalBtn) openExternalBtn.classList.add("hidden");
        showSpinner("Resolving stream...");
    }

    // ── Download ──────────────────────────────────────────────────────────────
    function enableDownloadBtn(enabled) {
        const downloadSection = document.getElementById("download-section");
        if (downloadSection) downloadSection.classList.remove("hidden");
        
        const hintEl = document.getElementById("download-hint");
        
        if (enabled) {
            downloadBtn.style.display = "";
            downloadBtn.disabled = false;
            downloadBtn.classList.remove("downloading");
            downloadBtnText.textContent = "Download MP4";
            downloadBtn.title = "Download this stream as MP4";
            if (hintEl) {
                hintEl.style.display = "";
                hintEl.textContent = "Downloads the current HLS stream as MP4 file.";
            }
        } else {
            downloadBtn.disabled = true;
            downloadBtn.style.display = "none";
            if (hintEl) {
                hintEl.style.display = "none";
            }
        }
        dlWrap.classList.add("hidden");
    }

    downloadBtn.addEventListener("click", async () => {
        if (!activeStreamUrl || isDownloading || downloadBtn.disabled) return;

        isDownloading = true;
        downloadBtn.classList.add("downloading");
        downloadBtnText.textContent = "Downloading...";
        dlWrap.classList.remove("hidden");
        dlStatus.textContent = "Sending request to server...";
        dlBar.style.width = "30%";
        log(`[ DL ] Requesting native download for: ${activeTitle}`, "system");

        try {
            const params = new URLSearchParams({ url: activeStreamUrl, referer: activeReferer, title: activeTitle });
            const downloadUrl = `/api/download?${params}`;

            // Trigger browser native download (prevents js timeouts and memory issues)
            const a = document.createElement("a");
            a.href = downloadUrl;
            document.body.appendChild(a);
            a.click();
            a.remove();

            dlBar.style.width = "100%";
            dlStatus.textContent = "Download started natively in your browser!";
            log(`[ DL ] Native download started successfully`, "success");
            setTimeout(() => { dlWrap.classList.add("hidden"); dlBar.style.width = "0%"; }, 4000);
        } catch (err) {
            dlStatus.textContent = `❌ ${err.message}`;
            dlBar.style.width = "0%";
            log(`[ DL ERR ] ${err.message}`, "error");
        } finally {
            isDownloading = false;
            downloadBtn.classList.remove("downloading");
            downloadBtnText.textContent = "Download MP4";
        }
    });

    if (omnisaveBtn) {
        omnisaveBtn.addEventListener("click", async () => {
            if (!activeItemMeta || omnisaveBtn.disabled) return;

            // Toggle off if already showing
            if (!omnisaveOptions.classList.contains("hidden")) {
                omnisaveOptions.innerHTML = "";
                omnisaveOptions.classList.add("hidden");
                if (omnisaveBtnText) omnisaveBtnText.textContent = "Direct MP4 Download";
                return;
            }

            omnisaveBtn.disabled = true;
            if (omnisaveBtnText) omnisaveBtnText.textContent = "Fetching qualities...";
            omnisaveOptions.innerHTML = "";
            omnisaveOptions.classList.add("hidden");

            log(`[ OmniSave ] Resolving download options for: ${activeItemMeta.title}`, "system");

            try {
                let seasonNum = 1;
                let epNum = 1;
                const isTV = activeItemMeta.type === "tv" || activeItemMeta.type === "anime" || activeItemMeta.type === "series";

                if (isTV) {
                    const activeSeason = seasonsData[activeSeasonIdx];
                    const activeEpisode = activeSeason ? activeSeason.episodes[activeEpisodeIdx] : null;
                    if (activeEpisode) {
                        const parts = activeEpisode.num.split("-");
                        seasonNum = parseInt(parts[0]?.trim() || "1", 10);
                        epNum = parseInt(parts[1]?.trim() || "1", 10);
                    }
                }

                const itemType = activeItemMeta.type || "movie";
                const itemTitle = activeItemMeta.title;

                const params = new URLSearchParams({
                    title: itemTitle,
                    type: itemType,
                    season: seasonNum,
                    episode: epNum
                });

                const res = await fetch(`/api/omnisave_download?${params}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                if (data.error) throw new Error(data.error);

                let currentCandidates = data.candidates || null;

                if (currentCandidates && currentCandidates.length > 0) {
                    renderLanguageSelector(currentCandidates, itemTitle, itemType, seasonNum, epNum);
                } else {
                    renderDownloads(data.downloads || [], null, null, itemTitle, itemType, seasonNum, epNum);
                }

                function getLangEmoji(lang) {
                    return `<svg viewBox="0 0 24 24" class="lang-globe-icon" style="width:12px; height:12px; stroke:currentColor; fill:none; stroke-width:2.5; vertical-align:middle; margin-right:4px;"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
                }

                function renderLanguageSelector(candidates, itemTitle, itemType, seasonNum, epNum) {
                    omnisaveOptions.innerHTML = `<div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); padding-bottom: 6px;">Select Language Version</div>`;
                    
                    candidates.forEach(cand => {
                        const btn = document.createElement("button");
                        btn.className = "btn-quality omnisave-quality-btn";
                        btn.style.width = "100%";
                        btn.style.justifyContent = "center";
                        btn.style.marginTop = "4px";
                        btn.style.background = "var(--card)";
                        btn.style.borderColor = "var(--border)";
                        btn.style.transition = "all 0.3s ease";
                        
                        const emoji = getLangEmoji(cand.language);
                        btn.innerHTML = `<span class="omnisave-btn-label">${emoji} ${cand.language} (${cand.title})</span>`;
                        
                        btn.addEventListener("click", async () => {
                            omnisaveOptions.innerHTML = "";
                            const loadingDiv = document.createElement("div");
                            loadingDiv.style.textAlign = "center";
                            loadingDiv.style.padding = "15px";
                            loadingDiv.innerHTML = `
                                <div class="loader-spinner small" style="margin: 0 auto 8px;"></div>
                                <span style="font-size: 0.85rem; color: var(--text-muted);">Fetching qualities for ${cand.language}...</span>
                            `;
                            omnisaveOptions.appendChild(loadingDiv);
                            
                            try {
                                const dlParams = new URLSearchParams({
                                    title: itemTitle,
                                    type: itemType,
                                    season: seasonNum,
                                    episode: epNum,
                                    subjectId: cand.subjectId,
                                    detailPath: cand.detailPath
                                });
                                const dlRes = await fetch(`/api/omnisave_download?${dlParams}`);
                                if (!dlRes.ok) throw new Error(`HTTP ${dlRes.status}`);
                                const dlData = await dlRes.json();
                                if (dlData.error) throw new Error(dlData.error);
                                
                                renderDownloads(dlData.downloads || [], cand.subjectId, cand.detailPath, itemTitle, itemType, seasonNum, epNum);
                            } catch (err) {
                                omnisaveOptions.innerHTML = `<div style="color: var(--red); font-size: 0.85rem; text-align: center; padding: 10px; border: 1px dashed var(--red); border-radius: 6px;">Error: ${err.message}</div>`;
                            }
                        });
                        
                        omnisaveOptions.appendChild(btn);
                    });
                    omnisaveOptions.classList.remove("hidden");
                }

                function renderDownloads(downloads, selectedSubjectId, selectedDetailPath, itemTitle, itemType, seasonNum, epNum) {
                    omnisaveOptions.innerHTML = "";
                    
                    if (currentCandidates && currentCandidates.length > 0) {
                        const backBtn = document.createElement("button");
                        backBtn.className = "btn-quality";
                        backBtn.style.width = "100%";
                        backBtn.style.justifyContent = "center";
                        backBtn.style.marginBottom = "8px";
                        backBtn.style.background = "transparent";
                        backBtn.style.border = "1px dashed var(--border)";
                        backBtn.style.opacity = "0.75";
                        backBtn.innerHTML = `<span class="omnisave-btn-label">⬅ Back to Languages</span>`;
                        backBtn.addEventListener("click", () => {
                            renderLanguageSelector(currentCandidates, itemTitle, itemType, seasonNum, epNum);
                        });
                        omnisaveOptions.appendChild(backBtn);
                    }

                    if (!downloads.length) {
                        const noRes = document.createElement("div");
                        noRes.style.color = "var(--text-muted)";
                        noRes.style.fontSize = "0.85rem";
                        noRes.style.textAlign = "center";
                        noRes.style.padding = "10px";
                        noRes.style.border = "1px dashed var(--border-color)";
                        noRes.style.borderRadius = "6px";
                        noRes.textContent = "No direct MP4 files found on OmniSave.";
                        omnisaveOptions.appendChild(noRes);
                        omnisaveOptions.classList.remove("hidden");
                        log(`[ OmniSave ] No download links found`, "error");
                        return;
                    }

                    let omnisaveDownloadLocked = false;

                    downloads.forEach(dl => {
                        const btn = document.createElement("button");
                        btn.className = "btn-quality omnisave-quality-btn";
                        btn.style.width = "100%";
                        btn.style.justifyContent = "center";
                        btn.style.marginTop = "4px";
                        btn.style.background = "var(--card)";
                        btn.style.borderColor = "var(--border)";
                        btn.style.transition = "all 0.3s ease";

                        const codecStr = dl.codec ? ` [${dl.codec.toUpperCase()}]` : "";
                        const labelText = `${dl.resolution} (${dl.size})${codecStr}`;
                        btn.innerHTML = `<span class="omnisave-btn-label">${labelText}</span>`;

                        btn.addEventListener("click", () => {
                            if (omnisaveDownloadLocked) return;
                            omnisaveDownloadLocked = true;

                            const cleanTitle = (itemTitle || "video").replace(/[^a-z0-9\s\-_]/gi, "").trim().replace(/\s+/g, "_");
                            const resNum = dl.resolution.replace("p", "");

                            omnisaveOptions.querySelectorAll(".omnisave-quality-btn").forEach(b => {
                                if (b !== btn) {
                                    b.style.opacity = "0.35";
                                    b.style.pointerEvents = "none";
                                    b.style.filter = "blur(1px)";
                                }
                            });

                            btn.classList.add("omnisave-btn-loading");
                            btn.innerHTML = `
                                <span class="omnisave-orbit-ring"></span>
                                <span class="omnisave-btn-spinner"></span>
                                <span class="omnisave-btn-label-loading">Preparing ${dl.resolution}...</span>
                            `;

                            spawnOmnisaveParticles(btn);

                            const progressCard = document.createElement("div");
                            progressCard.className = "omnisave-progress-card";
                            progressCard.innerHTML = `
                                <div class="omnisave-progress-radar">
                                    <svg class="omnisave-radar-svg" viewBox="0 0 80 80">
                                        <circle cx="40" cy="40" r="34" class="radar-track"/>
                                        <circle cx="40" cy="40" r="34" class="radar-fill" id="omni-radar-fill"/>
                                        <circle cx="40" cy="40" r="22" class="radar-inner"/>
                                        <circle cx="40" cy="40" r="10" class="radar-core"/>
                                    </svg>
                                    <div class="omnisave-radar-icon">⬇</div>
                                </div>
                                <div class="omnisave-progress-info">
                                    <div class="omnisave-progress-stage" id="omni-stage-text">Searching OmniSave...</div>
                                    <div class="omnisave-stage-bar">
                                        <div class="omnisave-stage-fill" id="omni-stage-fill"></div>
                                    </div>
                                    <div class="omnisave-progress-sub" id="omni-sub-text">${dl.resolution} · ${dl.size} · MP4</div>
                                </div>
                                <div class="omnisave-lock-badge">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    PROTECTED
                                </div>
                            `;
                            omnisaveOptions.appendChild(progressCard);

                            const stages = [
                                { text: "Searching OmniSave...",   sub: "Matching title on CDN index",        pct: 15,  delay: 0    },
                                { text: "Resolving Quality...",     sub: `Selecting ${dl.resolution} source`,  pct: 38,  delay: 1800 },
                                { text: "Connecting to CDN...",     sub: "Authenticating with videodownloader", pct: 62,  delay: 3800 },
                                { text: "Launching Download...",    sub: "Streaming MP4 to your browser",       pct: 88,  delay: 6500 },
                            ];

                            const stageEl = progressCard.querySelector("#omni-stage-text");
                            const fillEl  = progressCard.querySelector("#omni-stage-fill");
                            const subEl   = progressCard.querySelector("#omni-sub-text");
                            const radarFill = progressCard.querySelector("#omni-radar-fill");
                            const circumference = 2 * Math.PI * 34;

                            if (radarFill) {
                                radarFill.style.strokeDasharray = circumference;
                                radarFill.style.strokeDashoffset = circumference;
                            }

                            const stageTimers = [];
                            stages.forEach((s, i) => {
                                const t = setTimeout(() => {
                                    if (stageEl) stageEl.textContent = s.text;
                                    if (subEl)   subEl.textContent   = s.sub;
                                    if (fillEl)  fillEl.style.width  = s.pct + "%";
                                    if (radarFill) {
                                        radarFill.style.strokeDashoffset = circumference * (1 - s.pct / 100);
                                    }
                                    log(`[ OmniSave ] ${s.text}`, "system");
                                }, s.delay);
                                stageTimers.push(t);
                            });

                            const streamParams = new URLSearchParams({
                                title: itemTitle, type: itemType,
                                season: seasonNum, episode: epNum,
                                resolution: resNum,
                                filename: `${cleanTitle}_${dl.resolution}.mp4`
                            });
                            if (selectedSubjectId) streamParams.set("subjectId", selectedSubjectId);
                            if (selectedDetailPath) streamParams.set("detailPath", selectedDetailPath);

                            const streamUrl = `/api/omnisave_stream?${streamParams}`;
                            const a = document.createElement("a");
                            a.href = streamUrl;
                            a.download = `${cleanTitle}_${dl.resolution}.mp4`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);

                            const successTimer = setTimeout(() => {
                                stageTimers.forEach(clearTimeout);
                                if (stageEl) stageEl.textContent = "Download Started!";
                                if (subEl)   subEl.textContent   = "Check your browser's download bar";
                                if (fillEl)  fillEl.style.width  = "100%";
                                if (radarFill) radarFill.style.strokeDashoffset = "0";
                                progressCard.classList.add("omnisave-success");
                                btn.classList.remove("omnisave-btn-loading");
                                btn.classList.add("omnisave-btn-success");
                                btn.innerHTML = `<span class="omnisave-btn-label">✓ ${dl.resolution} Downloading</span>`;
                                log(`[ OmniSave ] Download launched — ${dl.resolution}`, "success");
                            }, 8500);

                            setTimeout(() => {
                                clearTimeout(successTimer);
                                omnisaveDownloadLocked = false;
                                progressCard.remove();
                                btn.classList.remove("omnisave-btn-loading", "omnisave-btn-success");
                                btn.innerHTML = `<span class="omnisave-btn-label">${labelText}</span>`;
                                btn.style.opacity = "";
                                btn.style.filter = "";
                                omnisaveOptions.querySelectorAll(".omnisave-quality-btn").forEach(b => {
                                    b.style.opacity = "";
                                    b.style.pointerEvents = "";
                                    b.style.filter = "";
                                });
                            }, 14000);
                        });

                        omnisaveOptions.appendChild(btn);
                    });

                    omnisaveOptions.classList.remove("hidden");
                    log(`[ OmniSave ] ${downloads.length} quality option(s) available — click to download`, "success");
                }

            } catch (err) {
                omnisaveOptions.innerHTML = `<div style="color: var(--red); font-size: 0.85rem; text-align: center; padding: 10px; border: 1px dashed var(--red); border-radius: 6px;">Error: ${err.message}</div>`;
                omnisaveOptions.classList.remove("hidden");
                log(`[ OmniSave ERR ] ${err.message}`, "error");
            } finally {
                omnisaveBtn.disabled = false;
                if (omnisaveBtnText) omnisaveBtnText.textContent = "Direct MP4 Download";

            }
        });
    }


    // ── Copy link ─────────────────────────────────────────────────────────────
    copyStreamBtn.addEventListener("click", () => {
        if (!activeStreamUrl) return;
        navigator.clipboard.writeText(activeStreamUrl).then(() => {
            copyStreamBtn.textContent = "✓ Copied!";
            copyStreamBtn.style.color = "var(--success)";
            setTimeout(() => {
                copyStreamBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Link`;
                copyStreamBtn.style.color = "";
            }, 2000);
        });
    });

    // ── Close player ──────────────────────────────────────────────────────────
    function closePlayer() {
        resetPreload();
        // Kill any in-progress server stream
        if (_streamSource) { _streamSource.close(); _streamSource = null; }
        autoSelectServer = false; // don't carry over auto-select to next title
        clearHlsAndIframe();
        
        // Clear countdown timer
        if (countdownTimerInterval) {
            clearInterval(countdownTimerInterval);
            countdownTimerInterval = null;
        }

        // Reset server drawer
        if (serverDrawer) {
            serverDrawer.classList.remove("open");
            serverDrawer.classList.add("hidden");
        }
        if (serverDrawerBackdrop) {
            serverDrawerBackdrop.classList.remove("active");
        }
        if (serverDrawerToggle) serverDrawerToggle.classList.add("hidden");
        
        playerWrap.classList.remove("details-active");
        playerDetailsView.classList.add("hidden");
        playerModal.classList.add("hidden");
        modalBackdrop.classList.remove("hidden");
        modalBackdrop.classList.add("hidden");
        document.body.style.overflow = "";
        activeStreamUrl = ""; activeReferer = ""; activeTitle = "video";

        // Cancel any pending iframe autoplay timer
        cancelIframeAutoplayTimer();

        // Restore the original NEUROTIX favicon
        restoreFavicon();
    }

    playerCloseBtn.addEventListener("click", closePlayer);
    
    // Storyline/About Collapse Toggle Listener
    const plotWrapper = document.getElementById("player-plot-wrapper");
    const plotToggleHeader = document.getElementById("plot-toggle-header");
    const playerSidebar = document.querySelector(".player-sidebar");
    if (plotToggleHeader && plotWrapper && playerSidebar) {
        plotToggleHeader.addEventListener("click", () => {
            plotWrapper.classList.toggle("collapsed");
            playerSidebar.classList.toggle("plot-collapsed");
        });
    }

    document.addEventListener("keydown", e => { if (e.key === "Escape") { closePlayer(); closeSettings(); } });

    // ══════════════════════════════════════════════════════════════════════════
    // SEARCH
    // ══════════════════════════════════════════════════════════════════════════
    let searchTimer = null;
    searchInput.addEventListener("input", () => {
        clearTimeout(searchTimer);
        const q = searchInput.value.trim();
        if (!q) {
            renderPage(activeFilter);
            emptyState.classList.add("hidden");
            return;
        }
        searchTimer = setTimeout(() => doSearch(q), 400);
    });

    searchInput.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            clearTimeout(searchTimer);
            doSearch(searchInput.value.trim());
        }
    });

    async function doSearch(query) {
        if (!query) return;

        rowsContainer.innerHTML = "";
        homepageLoader.classList.remove("hidden");
        emptyState.classList.add("hidden");
        document.getElementById("hero-section").classList.add("hidden"); // Hide hero for search results

        // If it looks like an IMDB ID, open player directly
        if (/^tt\d{7,10}$/i.test(query)) {
            homepageLoader.classList.add("hidden");
            openPlayer({ title: query, url: null, type: "movie", imdb_id: query });
            return;
        }

        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            homepageLoader.classList.add("hidden");

            const results = data.results || [];
            if (!results.length) {
                emptyState.classList.remove("hidden");
                return;
            }

            const section = { id: "search", title: `🔍 Results for "${query}"`, items: results };
            renderRow(section);
        } catch (err) {
            homepageLoader.classList.add("hidden");
            emptyState.classList.remove("hidden");
        }
    }

    // ── Filter nav ────────────────────────────────────────────────────────────
    const loadedTabs = {
        all: true,
        movie: false,
        tv: false,
        anime: false,
        episode: true, // loaded automatically as homepage has seasons & episodes
        genres: true   // genres page loads its own data dynamically
    };

    async function ensureCategoryLoaded(type) {
        if (loadedTabs[type]) return;

        homepageLoader.classList.remove("hidden");
        rowsContainer.innerHTML = "";
        emptyState.classList.add("hidden");

        const pathName = type === "tv" ? "tv" : type;

        try {
            log(`[ Tab ] Loading sections for: ${type}...`, "system");
            const res = await fetch(`/api/${pathName}_sections`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.sections && allHomepageData) {
                // Merge new sections into allHomepageData.sections
                data.sections.forEach(newSec => {
                    const exists = allHomepageData.sections.find(s => s.id === newSec.id);
                    if (!exists) {
                        allHomepageData.sections.push(newSec);
                    }
                });
            }
            loadedTabs[type] = true;
            log(`[ Tab ] ${type} sections loaded successfully`, "success");
        } catch (err) {
            log(`[ Tab ] Failed to load ${type}: ${err.message}`, "error");
        } finally {
            homepageLoader.classList.add("hidden");
        }
    }

    navLinks.forEach(link => {
        link.addEventListener("click", async e => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");
            activeFilter = link.dataset.filter;
            searchInput.value = "";

            if (!loadedTabs[activeFilter]) {
                await ensureCategoryLoaded(activeFilter);
            }
            renderPage(activeFilter);
        });
    });

    // ── Home link ─────────────────────────────────────────────────────────────
    homeLink.addEventListener("click", e => {
        e.preventDefault();
        searchInput.value = "";
        navLinks.forEach(l => l.classList.remove("active"));
        navLinks[0].classList.add("active");
        activeFilter = "all";
        renderPage("all");
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // SETTINGS PANEL
    // ══════════════════════════════════════════════════════════════════════════
    async function openSettings() {
        settingsPanel.classList.remove("hidden");
        modalBackdrop.classList.remove("hidden");
        try {
            const res = await fetch("/api/config");
            const cfg = await res.json();
            cfgDomain.value = cfg.source_domain || "";
            document.getElementById("cfg-animedekho-domain").value = cfg.animedekho_domain || "";
            cfgOmdb.value = cfg.omdb_api_key || "";
            cfgAppname.value = cfg.app_name || "";
            if (cfgDefaultserver) {
                cfgDefaultserver.value = cfg.default_server || "";
            }
        } catch (_) { }
    }

    function closeSettings() {
        settingsPanel.classList.add("hidden");
        if (playerModal.classList.contains("hidden")) {
            modalBackdrop.classList.add("hidden");
        }
        settingStatus.textContent = "";
        settingStatus.className = "setting-status";
    }

    settingsBtn.addEventListener("click", openSettings);
    settingsClose.addEventListener("click", closeSettings);
    modalBackdrop.addEventListener("click", () => { closePlayer(); closeSettings(); });

    saveConfigBtn.addEventListener("click", async () => {
        const domain = cfgDomain.value.trim().replace(/\/$/, "");
        const adDomain = document.getElementById("cfg-animedekho-domain").value.trim().replace(/\/$/, "");
        if (!domain.startsWith("http") || (adDomain && !adDomain.startsWith("http"))) {
            settingStatus.textContent = "⚠ Enter a valid URL (https://...)";
            settingStatus.className = "setting-status err";
            return;
        }
        saveConfigBtn.textContent = "Saving...";
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
            settingStatus.textContent = "✅ Saved! Reloading homepage...";
            settingStatus.className = "setting-status ok";
            setTimeout(() => { closeSettings(); loadHomepage(); }, 1200);
        } catch (err) {
            settingStatus.textContent = `❌ ${err.message}`;
            settingStatus.className = "setting-status err";
        } finally {
            saveConfigBtn.textContent = "Save & Reload";
        }
    });

    refreshCacheBtn.addEventListener("click", async () => {
        refreshCacheBtn.textContent = "Refreshing...";
        try {
            await fetch("/api/refresh");
            settingStatus.textContent = "✅ Cache cleared! Reloading...";
            settingStatus.className = "setting-status ok";
            setTimeout(() => { closeSettings(); loadHomepage(); }, 800);
        } catch (_) {
            settingStatus.textContent = "❌ Refresh failed.";
            settingStatus.className = "setting-status err";
        } finally {
            refreshCacheBtn.textContent = "🔄 Refresh Cache";
        }
    });

    // ══════════════════════════════════════════════════════════════════════════
    // WATCH HISTORY  (localStorage key: "neurotix_history")
    // ══════════════════════════════════════════════════════════════════════════
    const HISTORY_KEY = "neurotix_history";
    const HISTORY_MAX = 30;

    function saveHistory(item) {
        let history = getHistory();
        // Remove existing entry for same imdb_id or url so it moves to front
        history = history.filter(h =>
            !(h.imdb_id && h.imdb_id === item.imdb_id) &&
            !(h.tmdb_id && h.tmdb_id === item.tmdb_id) &&
            !(h.url && h.url === item.url)
        );
        const isTV = item.type === "tv" || item.type === "anime" || item.type === "series" || item.item_type === "Series";
        history.unshift({
            imdb_id: item.imdb_id || "",
            tmdb_id: item.tmdb_id || "",
            url: item.url || "",
            title: item.title || "Unknown",
            poster: item.poster || "",
            type: item.type || "movie",
            year: item.year || "",
            rating: item.rating || "",
            watchedAt: Date.now(),
            lastSeasonIdx: isTV ? activeSeasonIdx : undefined,
            lastEpisodeIdx: isTV ? activeEpisodeIdx : undefined,
            lastServer: preferredServer || null
        });
        if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX);
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (_) { }
    }

    function getHistory() {
        try {
            return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        } catch (_) { return []; }
    }

    function clearHistory() {
        try { localStorage.removeItem(HISTORY_KEY); } catch (_) { }
    }

    function renderHistoryRow() {
        const history = getHistory();
        // Remove any old history row
        const old = document.getElementById("history-row");
        if (old) old.remove();
        if (!history.length) return;

        // Build a fake section object to reuse renderRow logic
        const section = {
            id: "history",
            title: "🕒 Continue Watching",
            items: history.map(h => ({
                imdb_id: h.imdb_id,
                tmdb_id: h.tmdb_id,
                url: h.url,
                title: h.title,
                poster: h.poster,
                type: h.type,
                year: h.year,
                rating: h.rating,
                item_type: h.type === "tv" ? "Series" : "Movie",
                lastSeasonIdx: h.lastSeasonIdx,
                lastEpisodeIdx: h.lastEpisodeIdx,
                lastServer: h.lastServer
            }))
        };

        // Build the row manually so we can inject a clear button
        const row = document.createElement("div");
        row.className = "content-row history-row";
        row.id = "history-row";

        row.innerHTML = `
            <div class="row-header">
                <div class="row-title">${formatRowTitleHTML(section.title)}</div>
                <button class="row-clear-history" id="clear-history-btn" title="Clear watch history">✕ Clear</button>
            </div>
            <div class="row-track-wrap">
                <button class="row-scroll-btn left" aria-label="Scroll left">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="row-track" id="history-track"></div>
                <button class="row-scroll-btn right" aria-label="Scroll right">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>`;

        const track = row.querySelector("#history-track");
        section.items.forEach(item => track.appendChild(buildHistoryCard(item)));

        // Scroll buttons
        const leftBtn = row.querySelector(".row-scroll-btn.left");
        const rightBtn = row.querySelector(".row-scroll-btn.right");
        leftBtn.addEventListener("click", () => track.scrollBy({ left: -600, behavior: "smooth" }));
        rightBtn.addEventListener("click", () => track.scrollBy({ left: 600, behavior: "smooth" }));

        // Clear button
        row.querySelector("#clear-history-btn").addEventListener("click", () => {
            clearHistory();
            row.remove();
        });

        // Insert before rows-container's first child
        rowsContainer.insertBefore(row, rowsContainer.firstChild);
    }

    function buildHistoryCard(item) {
        const card = document.createElement("div");
        card.className = "content-card history-card";

        const typeLabel = item.item_type || (item.type === "tv" ? "Series" : "Movie");
        const ratingHtml = item.rating
            ? `<span class="card-rating-tag"><svg width="10" height="10" viewBox="0 0 24 24" fill="#f5c518"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>${item.rating}</span>` : "";

        card.innerHTML = `
            <div class="history-badge">▶ Resume</div>
            <button class="history-remove-btn" title="Remove from history" aria-label="Remove from history">✕</button>
            <img class="card-poster" src="${item.poster}" alt="${item.title}" loading="lazy"
                 onerror="handleCardImageError(this)"/>
            <div class="card-overlay">
                <div class="card-play-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </div>
                <div class="card-title-overlay">${item.title}</div>
                <div class="card-meta-overlay">
                    ${item.year ? `<span class="card-year-tag">${item.year}</span><span class="card-dot"></span>` : ""}
                    <span class="card-type-tag">${typeLabel}</span>
                    ${ratingHtml}
                </div>
            </div>
            <div class="card-strip">
                <div class="card-name">${item.title}</div>
                <div class="card-sub">
                    ${item.year ? `<span>${item.year}</span><span class="card-dot"></span>` : ""}
                    <span>${typeLabel}</span>
                </div>
            </div>`;

        // Wire remove button click
        const removeBtn = card.querySelector(".history-remove-btn");
        removeBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // prevent opening player

            let history = getHistory();
            history = history.filter(h =>
                !(h.imdb_id && h.imdb_id === item.imdb_id) &&
                !(h.tmdb_id && h.tmdb_id === item.tmdb_id) &&
                !(h.url && h.url === item.url)
            );
            try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (_) {}

            card.style.transform = "scale(0.8)";
            card.style.opacity = "0";
            card.style.transition = "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease";

            setTimeout(() => {
                card.remove();
                const track = document.getElementById("history-track");
                if (track && !track.querySelector(".content-card")) {
                    const row = document.getElementById("history-row");
                    if (row) row.remove();
                }
            }, 250);
        });

        card.addEventListener("click", () => openPlayer(item));
        return card;
    }


    // ══════════════════════════════════════════════════════════════════════════
    // MOBILE NAVIGATION — Hamburger drawer + mobile search bar
    // ══════════════════════════════════════════════════════════════════════════
    const hamburgerBtn   = document.getElementById("hamburger-btn");
    const mobileDrawer   = document.getElementById("mobile-nav-drawer");
    const mobileOverlay  = document.getElementById("mobile-nav-overlay");
    const mobileClose    = document.getElementById("mobile-nav-close");
    const mobileNavLinks = document.querySelectorAll(".mobile-nav-link[data-filter]");

    // Mobile search
    const mobileSearchBtn   = document.getElementById("mobile-search-btn");
    const mobileSearchBar   = document.getElementById("mobile-search-bar");
    const mobileSearchInput = document.getElementById("mobile-search-input");
    const mobileSearchClose = document.getElementById("mobile-search-close");

    function openDrawer() {
        mobileDrawer.classList.add("open");
        mobileDrawer.setAttribute("aria-hidden", "false");
        mobileOverlay.classList.remove("hidden");
        hamburgerBtn.classList.add("open");
        hamburgerBtn.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
    }

    function closeDrawer() {
        mobileDrawer.classList.remove("open");
        mobileDrawer.setAttribute("aria-hidden", "true");
        mobileOverlay.classList.add("hidden");
        hamburgerBtn.classList.remove("open");
        hamburgerBtn.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
    }

    hamburgerBtn.addEventListener("click", () => {
        mobileDrawer.classList.contains("open") ? closeDrawer() : openDrawer();
    });
    mobileClose.addEventListener("click", closeDrawer);
    mobileOverlay.addEventListener("click", closeDrawer);

    // Wire mobile nav links — same logic as desktop nav links
    mobileNavLinks.forEach(link => {
        link.addEventListener("click", async e => {
            e.preventDefault();
            closeDrawer();

            // Sync desktop nav active state
            navLinks.forEach(l => l.classList.remove("active"));
            const desktopMatch = [...navLinks].find(l => l.dataset.filter === link.dataset.filter);
            if (desktopMatch) desktopMatch.classList.add("active");

            // Sync mobile nav active state
            mobileNavLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");

            activeFilter = link.dataset.filter;

            // Clear desktop search
            searchInput.value = "";
            if (mobileSearchInput) mobileSearchInput.value = "";

            if (!loadedTabs[activeFilter]) {
                await ensureCategoryLoaded(activeFilter);
            }
            renderPage(activeFilter);
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });

    // Mobile search bar toggle
    if (mobileSearchBtn) {
        mobileSearchBtn.addEventListener("click", () => {
            mobileSearchBar.classList.toggle("hidden");
            if (!mobileSearchBar.classList.contains("hidden")) {
                mobileSearchInput.focus();
            }
        });
    }

    if (mobileSearchClose) {
        mobileSearchClose.addEventListener("click", () => {
            mobileSearchBar.classList.add("hidden");
            mobileSearchInput.value = "";
            // Reset to current page
            renderPage(activeFilter);
            emptyState.classList.add("hidden");
        });
    }

    // Mirror search behaviour from desktop search to mobile search
    if (mobileSearchInput) {
        let mobileSearchTimer = null;
        mobileSearchInput.addEventListener("input", () => {
            clearTimeout(mobileSearchTimer);
            const q = mobileSearchInput.value.trim();
            if (!q) {
                renderPage(activeFilter);
                emptyState.classList.add("hidden");
                return;
            }
            mobileSearchTimer = setTimeout(() => doSearch(q), 400);
        });

        mobileSearchInput.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                clearTimeout(mobileSearchTimer);
                doSearch(mobileSearchInput.value.trim());
            }
        });
    }

    // Close drawer on ESC
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && mobileDrawer.classList.contains("open")) {
            closeDrawer();
        }
    });

    // ── Background Stream Preloader Logic (God-Level) ─────────────────────────
    let preloadEventSource = null;

    function resetPreload() {
        if (preloadHlsInstance) {
            try { preloadHlsInstance.destroy(); } catch (e) {}
            preloadHlsInstance = null;
        }
        if (preloadEventSource) {
            try { preloadEventSource.close(); } catch (e) {}
            preloadEventSource = null;
        }
        if (preloadVideoEl) {
            try {
                preloadVideoEl.pause();
                preloadVideoEl.src = "";
                preloadVideoEl.removeAttribute('src');
                preloadVideoEl.load();
            } catch (e) {}
        }
        isPreloadTriggered = false;
        preloadState = {
            seasonIdx: -1,
            episodeIdx: -1,
            streamUrl: "",
            iframeUrl: "",
            isResolved: false,
            isBuffered: false,
            srvObject: null,
            streamObject: null,
            resolvedServers: []
        };
    }

    function playNextEpisodeAutomatically() {
        log(`[ PLAYBACK ] Episode ended. Checking for next episode...`, "system");
        
        if (preloadState.isResolved && preloadState.seasonIdx !== -1) {
            log(`[ PRELOAD ] Instant swap active! Swapping to next episode.`, "success");
            swapToPreloadedEpisode();
            return;
        }

        log(`[ PRELOAD ] Next episode not preloaded yet. Loading standard way...`, "info");
        const s = seasonsData[activeSeasonIdx];
        autoSelectServer = true; // Automatically pick server for the next episode
        if (s && activeEpisodeIdx < s.episodes.length - 1) {
            playEpisodeAt(activeSeasonIdx, activeEpisodeIdx + 1);
        } else if (activeSeasonIdx < seasonsData.length - 1) {
            playEpisodeAt(activeSeasonIdx + 1, 0);
        }
    }

    async function triggerBackgroundPreload() {
        const s = seasonsData[activeSeasonIdx];
        if (!s) return;

        let nextSeasonIdx = activeSeasonIdx;
        let nextEpIdx = activeEpisodeIdx + 1;

        if (nextEpIdx >= s.episodes.length) {
            if (activeSeasonIdx + 1 < seasonsData.length) {
                nextSeasonIdx = activeSeasonIdx + 1;
                nextEpIdx = 0;
            } else {
                return; // end of series
            }
        }

        const nextEp = seasonsData[nextSeasonIdx]?.episodes[nextEpIdx];
        if (!nextEp) return;

        preloadState.seasonIdx = nextSeasonIdx;
        preloadState.episodeIdx = nextEpIdx;
        preloadState.isResolved = false;
        preloadState.isBuffered = false;

        const parts = nextEp.num.split("-");
        const seasonNum = parts[0]?.trim() || "1";
        const epNum = parts[1]?.trim() || "1";

        log(`[ PRELOAD ] Resolving next stream in background: Season ${seasonNum} Episode ${epNum}...`, "system");

        let url;
        const imdbId = activeImdbId || (activeItemMeta && activeItemMeta.imdb_id) || null;
        const tmdbId = activeItemMeta?.tmdb_id;
        
        if (imdbId) {
            url = `/api/fetch?stream=1&id=${encodeURIComponent(imdbId)}`;
            if (tmdbId) url += `&tmdb_id=${encodeURIComponent(tmdbId)}`;
            url += `&s=${encodeURIComponent(seasonNum)}&e=${encodeURIComponent(epNum)}`;
        } else if (tmdbId) {
            url = `/api/fetch?stream=1&tmdb_id=${encodeURIComponent(tmdbId)}&s=${encodeURIComponent(seasonNum)}&e=${encodeURIComponent(epNum)}`;
        } else if (nextEp.url) {
            url = `/api/fetch?stream=1&url=${encodeURIComponent(nextEp.url)}&s=${encodeURIComponent(seasonNum)}&e=${encodeURIComponent(epNum)}`;
        } else {
            return;
        }

        if (preloadEventSource) {
            preloadEventSource.close();
        }

        let servers = [];
        const evtSource = new EventSource(url);
        preloadEventSource = evtSource;

        evtSource.onmessage = (e) => {
            let srv;
            try { srv = JSON.parse(e.data); } catch (_) { return; }

            if (srv.__done__) {
                evtSource.close();
                if (preloadEventSource === evtSource) preloadEventSource = null;
                preloadState.resolvedServers = servers;
                processPreloadServers(servers);
                return;
            }

            servers.push(srv);
        };

        evtSource.onerror = () => {
            evtSource.close();
            if (preloadEventSource === evtSource) preloadEventSource = null;
            log(`[ PRELOAD ] Background stream resolution failed`, "error");
        };
    }

    function processPreloadServers(servers) {
        if (!servers.length) {
            log(`[ PRELOAD ] No stream servers found for next episode`, "error");
            return;
        }

        servers.sort((a, b) => compareServers(a.server, a.ping_ms, b.server, b.ping_ms));

        let chosenSrv = null;
        let chosenStream = null;

        if (preferredServer) {
            for (let srv of servers) {
                const nameMatch = srv.name.toLowerCase() === preferredServer.name.toLowerCase();
                const typeMatch = !!srv.is_iframe === preferredServer.is_iframe;
                if (nameMatch && typeMatch) {
                    for (let stream of srv.streams) {
                        if ((stream.language || "").toLowerCase() === (preferredServer.language || "").toLowerCase()) {
                            chosenSrv = srv;
                            chosenStream = stream;
                            break;
                        }
                    }
                }
                if (chosenSrv) break;
            }
        }

        if (!chosenSrv) {
            chosenSrv = servers[0];
            chosenStream = chosenSrv.streams[0];
        }

        if (!chosenSrv || !chosenStream) return;

        preloadState.srvObject = chosenSrv;
        preloadState.streamObject = chosenStream;

        if (chosenSrv.is_iframe) {
            preloadState.iframeUrl = chosenSrv.embed_url;
            preloadState.isResolved = true;
            log(`[ PRELOAD ] Next episode preloaded (Iframe link resolved: ${chosenSrv.name})`, "success");
        } else {
            const rawUrl = chosenStream.url;
            const referer = serverReferers[chosenSrv.server] || "";
            let proxyUrl = `/api/proxy?url=${encodeURIComponent(rawUrl)}`;
            if (referer) proxyUrl += `&referer=${encodeURIComponent(referer)}`;

            preloadState.streamUrl = proxyUrl;
            
            log(`[ PRELOAD ] Pre-buffering HLS stream on background video element...`, "system");

            if (Hls.isSupported()) {
                if (preloadHlsInstance) {
                    try { preloadHlsInstance.destroy(); } catch (e) {}
                }
                preloadHlsInstance = new Hls({ maxMaxBufferLength: 5, enableWorker: true, lowLatencyMode: true });
                preloadHlsInstance.loadSource(proxyUrl);
                preloadHlsInstance.attachMedia(preloadVideoEl);

                preloadHlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                    preloadState.isResolved = true;
                    preloadState.isBuffered = true;
                    log(`[ PRELOAD ] Next episode preloaded and buffered successfully!`, "success");
                });
            } else if (preloadVideoEl.canPlayType("application/vnd.apple.mpegurl")) {
                preloadVideoEl.src = proxyUrl;
                preloadState.isResolved = true;
                preloadState.isBuffered = true;
                log(`[ PRELOAD ] Next episode preloaded successfully (Native Safari HLS)`, "success");
            }
        }
    }

    function swapToPreloadedEpisode() {
        if (!preloadState.isResolved) return;

        const isIframe = !!preloadState.srvObject?.is_iframe;

        if (!isIframe) {
            // Swap HLS / Video elements
            hideSpinner();
            videoEl.classList.add("hidden");
            iframeEl.classList.add("hidden");

            // Swap video elements
            preloadVideoEl.id = "video";
            preloadVideoEl.className = videoEl.className;
            preloadVideoEl.style.display = "";
            preloadVideoEl.muted = false;
            preloadVideoEl.controls = true;

            videoEl.id = "preload-video";
            videoEl.style.display = "none";
            videoEl.muted = true;
            videoEl.src = "";

            const temp = videoEl;
            videoEl = preloadVideoEl;
            preloadVideoEl = temp;

            if (hlsInstance) {
                try { hlsInstance.destroy(); } catch (e) {}
            }
            hlsInstance = preloadHlsInstance;
            preloadHlsInstance = null;

            activeStreamUrl = preloadState.streamObject.url;
            activeReferer = serverReferers[preloadState.srvObject.server] || "";
            activeTitle = `${preloadState.srvObject.name} [${preloadState.streamObject.language}]`;

            enableDownloadBtn(true);
            qualityRow.classList.remove("hidden");
            qualityMenu.innerHTML = "";
            qualityBtnText.textContent = "Quality: Auto";

            videoEl.play().catch(() => log("Playback failed to resume on swap", "error"));

            if (hlsInstance) {
                hlsInstance.on(Hls.Events.LEVEL_SWITCHED, (_, d) => {
                    const lvl = hlsInstance.levels[d.level];
                    if (lvl) {
                        const res = lvl.height ? `${lvl.height}p` : "Auto";
                        log(`[ QUALITY ] Switched to ${res} (${Math.round(lvl.bitrate / 1000)}kbps)`, "info");
                        if (hlsInstance.currentLevel === -1) qualityBtnText.textContent = `Quality: Auto (${res})`;
                    }
                });

                hlsInstance.on(Hls.Events.ERROR, (_, d) => {
                    if (d.fatal) {
                        if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
                            log("[ ERR ] Network error — retrying...", "error");
                            hlsInstance.startLoad();
                        } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) {
                            log("[ ERR ] Media error — recovering...", "error");
                            hlsInstance.recoverMediaError();
                        } else {
                            log(`[ FATAL ] ${d.details}`, "error");
                            showSpinner("Playback error. Try another server.");
                        }
                    }
                });

                const levels = hlsInstance.levels;
                if (levels?.length > 1) buildQualityMenu(levels);
            }

            videoEl.classList.remove("hidden");
            log(`[ PRELOAD ] Swapped HLS stream instantly.`, "success");

        } else {
            // Swap Iframe element
            hideSpinner();
            videoEl.classList.add("hidden");
            iframeEl.classList.remove("hidden");

            iframeEl.src = preloadState.iframeUrl;
            activeStreamUrl = preloadState.iframeUrl;
            activeReferer = "";
            activeTitle = preloadState.srvObject.name;

            enableDownloadBtn(false);
            qualityRow.classList.add("hidden");

            log(`[ PRELOAD ] Swapped iframe player instantly.`, "success");
        }

        // Highlight new active server card in sidebar and render them
        renderServers(preloadState.resolvedServers);
        const nameToMatch = preloadState.srvObject.name.toLowerCase();
        const isIframeToMatch = !!preloadState.srvObject.is_iframe;
        const cards = serversGrid.querySelectorAll(".server-item");
        for (let card of cards) {
            const nameEl = card.querySelector(".server-name");
            const badgeEl = card.querySelector(".channel-badge");
            if (nameEl && badgeEl) {
                const cardName = nameEl.textContent.trim().toLowerCase();
                const cardIsIframe = badgeEl.textContent.trim().toLowerCase() === "embed";
                if (cardName === nameToMatch && cardIsIframe === isIframeToMatch) {
                    card.classList.add("active");
                    break;
                }
            }
        }

        // Update active indices
        activeSeasonIdx = preloadState.seasonIdx;
        activeEpisodeIdx = preloadState.episodeIdx;

        // Highlight episode in list
        episodesGrid.querySelectorAll(".episode-btn").forEach(b => b.classList.remove("active"));
        const btn = episodesGrid.querySelector(`[data-ep-idx="${activeEpisodeIdx}"]`);
        if (btn) {
            btn.classList.add("active");
            btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }

        updateEpNavBar();

        // Update titles and metadata
        const s = seasonsData[activeSeasonIdx];
        const ep = s ? s.episodes[activeEpisodeIdx] : null;
        if (ep) {
            updateSidebarForEpisode(ep);
        }

        if (activeItemMeta) {
            // Save to Watch History
            saveHistory(activeItemMeta);
        }

        // Reset trigger flag so the next preload can fire after 15s
        isPreloadTriggered = false;
        preloadState = {
            seasonIdx: -1,
            episodeIdx: -1,
            streamUrl: "",
            iframeUrl: "",
            isResolved: false,
            isBuffered: false,
            srvObject: null,
            streamObject: null,
            resolvedServers: []
        };
    }

    // --- Particle burst animation helper for OmniSave downloads ---
    function spawnOmnisaveParticles(btn) {
        const rect = btn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2 + window.scrollX;
        const centerY = rect.top + rect.height / 2 + window.scrollY;
        const colors = ["#00e676", "#00b0ff", "#d500f9", "#ff3d00", "#ffea00"];

        for (let i = 0; i < 20; i++) {
            const particle = document.createElement("div");
            particle.className = "omnisave-particle";
            const size = Math.floor(Math.random() * 6) + 4;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            const color = colors[Math.floor(Math.random() * colors.length)];
            particle.style.background = color;
            particle.style.boxShadow = `0 0 8px ${color}`;
            particle.style.left = `${centerX}px`;
            particle.style.top = `${centerY}px`;
            document.body.appendChild(particle);

            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 100 + 50;
            const tx = Math.cos(angle) * dist;
            const ty = Math.sin(angle) * dist;

            requestAnimationFrame(() => {
                particle.style.transform = `translate(${tx}px, ${ty}px) scale(0)`;
                particle.style.opacity = "0";
            });

            setTimeout(() => particle.remove(), 1000);
        }
    }

    // ── Iframe Intercept & Communication ──────────────────────────────────────
    window.addEventListener("message", (event) => {
        try {
            let data = event.data;
            if (typeof data === "string") {
                try { data = JSON.parse(data); } catch (_) {}
            }
            
            // Log incoming messages to the visible console logs (except spammy timeupdates/progress logs)
            let isSpam = false;
            let msgStr = typeof data === "object" ? JSON.stringify(data) : String(data);
            const lowerMsg = msgStr.toLowerCase();
            if (lowerMsg.includes("timeupdate") || lowerMsg.includes("progress") || lowerMsg.includes("\"event\":\"time\"") || lowerMsg.includes("volumechange") || lowerMsg.includes("ratechange") || lowerMsg.includes("seeking") || lowerMsg.includes("seeked") || lowerMsg.includes("buffered") || lowerMsg.includes("throttled")) {
                isSpam = true;
            }
            if (!isSpam) {
                if (msgStr.length > 80) msgStr = msgStr.slice(0, 80) + "...";
                log(`[ IframeMsg ] ${msgStr}`, "decrypted");
            }

            let isPlay = false;
            let isPause = false;
            let isEnded = false;
            let newCurrentTime = null;
            let newDuration = null;

            // Handle text signals
            if (typeof event.data === "string") {
                const lower = event.data.toLowerCase();
                if (lower === "play" || lower === "playing") isPlay = true;
                else if (lower === "pause" || lower === "paused") isPause = true;
                else if (lower === "ended" || lower === "complete") isEnded = true;
            }

            // Handle structured payloads
            if (data && typeof data === "object") {
                // Plyr player structures
                if (data.event) {
                    const ev = String(data.event).toLowerCase();
                    if (ev === "play" || ev === "playing") isPlay = true;
                    else if (ev === "pause" || ev === "paused") isPause = true;
                    else if (ev === "ended" || ev === "complete") isEnded = true;
                    else if (ev === "timeupdate") {
                        if (data.currentTime != null) newCurrentTime = parseFloat(data.currentTime);
                        if (data.duration != null) newDuration = parseFloat(data.duration);
                    }
                }
                
                // YouTube iframe API style
                if (data.event === "infoDelivery" && data.info) {
                    const state = data.info.playerState;
                    if (state === 1) isPlay = true;
                    if (state === 2) isPause = true;
                    if (state === 0) isEnded = true;
                    if (data.info.currentTime != null) newCurrentTime = parseFloat(data.info.currentTime);
                    if (data.info.duration != null) newDuration = parseFloat(data.info.duration);
                }

                // General player messages
                const status = String(data.status || data.method || data.type || "").toLowerCase();
                const value = String(data.value || data.data || "").toLowerCase();

                if (status === "play" || status === "playing" || value === "play" || value === "playing") isPlay = true;
                if (status === "pause" || status === "paused" || value === "pause" || value === "paused") isPause = true;
                if (status === "ended" || status === "complete" || value === "ended" || value === "complete") isEnded = true;
                
                if (data.plyr && data.event === "ended") isEnded = true;
                if (data.event === "complete") isEnded = true;

                if (data.currentTime != null) newCurrentTime = parseFloat(data.currentTime);
                if (data.duration != null) newDuration = parseFloat(data.duration);
                if (data.time != null) newCurrentTime = parseFloat(data.time);
            }

            // Autoplay next and countdown updates removed
        } catch (err) {
            // fail silently
        }
    });

    // ══════════════════════════════════════════════════════════════════════════
    // BOOTSTRAP
    // ══════════════════════════════════════════════════════════════════════════
    // God-Level Cyberpunk Loader Status Cycler
    (function() {
        const subtextEl = document.getElementById("cyber-loader-subtext");
        if (!homepageLoader || !subtextEl) return;
        
        let cycleInterval = null;
        const statusLines = [
            "Tuning multiverse frequencies...",
            "Decrypting secure stream nodes...",
            "Overriding proxy gateway blocks...",
            "Analyzing provider catalog databases...",
            "Synchronizing HLS bandwidth channels...",
            "Routing through secure overlay pipelines...",
            "Optimizing media rendering engine..."
        ];
        
        function startLoadingCycle() {
            if (cycleInterval) clearInterval(cycleInterval);
            let idx = 0;
            subtextEl.textContent = statusLines[0];
            cycleInterval = setInterval(() => {
                idx = (idx + 1) % statusLines.length;
                subtextEl.textContent = statusLines[idx];
            }, 800);
        }
        
        function stopLoadingCycle() {
            if (cycleInterval) {
                clearInterval(cycleInterval);
                cycleInterval = null;
            }
        }
        
        // Watch for class list changes to toggle cycler
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === "class") {
                    const isHidden = homepageLoader.classList.contains("hidden");
                    if (isHidden) {
                        stopLoadingCycle();
                    } else {
                        startLoadingCycle();
                    }
                }
            });
        });
        
        observer.observe(homepageLoader, { attributes: true });
        
        // Initial state
        if (!homepageLoader.classList.contains("hidden")) {
            startLoadingCycle();
        }
    })();

    await loadHomepage();
});
