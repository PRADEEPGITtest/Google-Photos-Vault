// Content Script

// immediately stop the rest of the page from loading visually if possible, 
// though document_start runs before DOM is fully parsed.
// We'll inject a style to hide the body body until unlocked.

const protectPage = () => {
    const style = document.createElement('style');
    style.id = 'gp-vault-protection';
    style.textContent = `
        html, body {
            overflow: hidden !important;
            height: 100% !important;
        }
        /* 
           Using display: none breaks Google Photos' grid layout calculations.
           Instead, we use opacity: 0 and pointer-events: none on the body.
           The lock screen is appended to documentElement (html), so it stays visible.
        */
        body {
            opacity: 0 !important;
            pointer-events: none !important;
            filter: blur(20px) !important;
        }
        #gp-vault-root {
            display: block !important;
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 2147483647; /* Max Z-Index */
            background: #000;
            pointer-events: auto !important; /* Ensure interactions work */
        }
    `;
    document.documentElement.appendChild(style);
};

// Only run on top window frame generally, but manifest says all_frames: true to catch iframes if needed.
// Usually main app is top frame.
let heartbeatInterval;

if (window === top) {
    protectPage();

    // STRICT MODE: Always lock on reload/navigation
    // We removed the check with background. The user must authenticate every time the page loads.
    showLockScreen();

    // Activity tracking for inactivity timeout
    const sendHeartbeat = () => {
        chrome.runtime.sendMessage({ type: 'HEARTBEAT' });
    };

    // Throttle heartbeat to once per minute max
    let lastHeartbeat = Date.now();
    const headersActivity = () => {
        const now = Date.now();
        if (now - lastHeartbeat > 60000) {
            sendHeartbeat();
            lastHeartbeat = now;
        }
    };

    window.addEventListener('mousemove', headersActivity);
    window.addEventListener('keydown', headersActivity);
    window.addEventListener('scroll', headersActivity);
}

function unlockPage() {
    const style = document.getElementById('gp-vault-protection');
    if (style) style.remove();
    const root = document.getElementById('gp-vault-root');
    if (root) root.remove();
}

function showLockScreen() {
    // Container for Shadow DOM
    const host = document.createElement('div');
    host.id = 'gp-vault-root';
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    // We will inject the UI HTML and CSS here
    // For now, simple structure
    const container = document.createElement('div');
    container.innerHTML = `
        <style>
            :host {
                font-family: 'Google Sans', Roboto, Arial, sans-serif;
            }
            .lock-overlay {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                height: 100%;
                width: 100%;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(10px);
                color: white;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .lock-card {
                background: rgba(255, 255, 255, 0.1);
                padding: 40px;
                border-radius: 24px;
                box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
                border: 1px solid rgba(255, 255, 255, 0.18);
                text-align: center;
                width: 320px;
                animation: fadeIn 0.4s ease-out;
            }
            h1 { margin-bottom: 24px; font-weight: 400; }
            .input-wrapper {
                position: relative;
                width: 100%;
                margin-bottom: 16px;
            }
            input {
                width: 100%;
                padding: 12px;
                padding-right: 40px; /* Space for eye icon */
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                background: rgba(0, 0, 0, 0.2);
                color: white;
                font-size: 16px;
                box-sizing: border-box; 
            }
            .toggle-password {
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                cursor: pointer;
                background: none;
                border: none;
                padding: 0;
                color: rgba(255, 255, 255, 0.6);
                width: auto; /* Override default button width */
            }
            .toggle-password:hover {
                color: white;
                background: none;
            }
            button {
                width: 100%;
                padding: 12px;
                border-radius: 8px;
                border: none;
                background: #8ab4f8;
                color: #202124;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.2s;
            }
            button:hover {
                background: #aecbfa;
            }
            .biometric-btn {
                background: transparent;
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: #e8eaed;
                margin-top: 12px;
            }
            .biometric-btn:hover {
                background: rgba(255, 255, 255, 0.05);
            }
            .error {
                color: #f28b82;
                font-size: 14px;
                margin-top: 12px;
                display: none;
            }
            .link-btn {
                background: none !important;
                border: none;
                color: #8ab4f8;
                text-decoration: underline;
                cursor: pointer;
                margin-top: 16px;
                font-size: 14px;
                display: block;
                width: 100%;
                outline: none; /* Remove focus ring */
            }
            .link-btn:hover {
                background: none !important;
                text-decoration: none;
            }
            .link-btn:focus {
                outline: none;
            }
            .hidden { display: none !important; }
        </style>
        <div class="lock-overlay">
            <!-- LOCK SCREEN -->
            <div class="lock-card" id="lock-view">
                <h1>Photos Locked</h1>
                <div class="input-wrapper">
                    <input type="password" id="password" placeholder="Enter Password" />
                    <button id="toggle-pwd-btn" class="toggle-password" type="button">👁️</button>
                </div>
                <button id="unlock-btn">Unlock</button>
                <button id="forgot-btn" class="link-btn">Forgot Password?</button>
                <div id="error-msg" class="error">Incorrect password</div>
            </div>

            <!-- RESET PASSWORD SCREEN (Hidden initially) -->
            <div class="lock-card hidden" id="reset-view">
                <h1>Reset Password</h1>
                <p style="font-size:13px; color:#ccc; margin-bottom:16px;">Identity Verified. Set your new password.</p>
                <div class="input-wrapper">
                    <input type="password" id="new-pwd" placeholder="New Password" />
                    <button id="toggle-new-pwd-btn" class="toggle-password" type="button">👁️</button>
                </div>
                <button id="save-new-pwd-btn">Save & Unlock</button>
                <div id="reset-error-msg" class="error"></div>
            </div>
        </div>
    `;
    shadow.appendChild(container);

    const unlockBtn = shadow.getElementById('unlock-btn');
    const passwordInput = shadow.getElementById('password');
    const errorMsg = shadow.getElementById('error-msg');

    const attemptUnlock = () => {
        const pwd = passwordInput.value;
        chrome.storage.local.get(['userPassword'], (result) => {
            // First time setup check happens elsewhere, but fallback is safe here
            if (!result.userPassword) {
                errorMsg.textContent = "Please set a password first.";
                errorMsg.style.display = 'block';
                return;
            }

            if (pwd === result.userPassword) {
                chrome.runtime.sendMessage({ type: 'UNLOCK_SUCCESS' }, () => {
                    unlockPage();
                });
            } else {
                errorMsg.textContent = "Incorrect password";
                errorMsg.style.display = 'block';
                passwordInput.value = '';
            }
        });
    };

    // INITIALIZATION: Check if password exists. If not, show "Create Password" view.
    chrome.storage.local.get(['userPassword', 'settings'], (res) => {
        const lockView = shadow.getElementById('lock-view');
        const resetView = shadow.getElementById('reset-view');

        // Logic 1: First Run (No Password Set) -> Show Reset View tailored for creation
        if (!res.userPassword) {
            lockView.classList.add('hidden');
            resetView.classList.remove('hidden');
            shadow.querySelector('#reset-view h1').textContent = "Welcome! Create Password";
            shadow.querySelector('#reset-view p').textContent = "Set a secure password to protect your Photos.";
            return; // Stop processing other logic
        }

        // Logic 2: Normal Lock Screen
        // Add Biometric Button if enabled
        if (res.settings && res.settings.biometricsEnabled) {
            const bioBtn = document.createElement('button');
            bioBtn.className = 'biometric-btn';
            bioBtn.textContent = 'Unlock with Biometrics';
            bioBtn.onclick = () => {
                const width = 500; const height = 600;
                const left = (screen.width / 2) - (width / 2); const top = (screen.height / 2) - (height / 2);
                window.open(chrome.runtime.getURL('verify.html'), 'VaultVerify', `width=${width},height=${height},top=${top},left=${left}`);
            };
            const errorMsg = shadow.getElementById('error-msg');
            lockView.insertBefore(bioBtn, errorMsg);
        }
    });

    // Forgot Password Handler
    const forgotBtn = shadow.getElementById('forgot-btn');
    forgotBtn.onclick = () => {
        // We use the same biometric verify flow, but with a different 'reason'
        const width = 500; const height = 600;
        const left = (screen.width / 2) - (width / 2); const top = (screen.height / 2) - (height / 2);
        window.open(chrome.runtime.getURL('verify.html?reason=reset'), 'VaultReset', `width=${width},height=${height},top=${top},left=${left}`);
    };

    // Reset Password Handler
    const saveNewPwdBtn = shadow.getElementById('save-new-pwd-btn');
    saveNewPwdBtn.onclick = () => {
        const newPwd = shadow.getElementById('new-pwd').value;

        // Strength Check (Reuse logic or simplify)
        const errors = [];
        if (newPwd.length < 8) errors.push("8+ chars");
        if (!/[A-Z]/.test(newPwd)) errors.push("Uppercase");
        if (!/[a-z]/.test(newPwd)) errors.push("Lowercase");
        if (!/[0-9]/.test(newPwd)) errors.push("Number");
        if (!/[^A-Za-z0-9]/.test(newPwd)) errors.push("Symbol");

        const resetErrorMsg = shadow.getElementById('reset-error-msg');
        if (errors.length > 0) {
            resetErrorMsg.textContent = "Weak: " + errors.join(', ');
            resetErrorMsg.style.display = 'block';
            return;
        }

        // Save
        chrome.storage.local.set({ userPassword: newPwd }, () => {
            // Unlock immediately
            chrome.runtime.sendMessage({ type: 'UNLOCK_SUCCESS' }, () => {
                unlockPage();
            });
        });
    };

    unlockBtn.addEventListener('click', attemptUnlock);
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') attemptUnlock();
    });

    // Toggle Password Visibility
    const toggleBtn = shadow.getElementById('toggle-pwd-btn');
    toggleBtn.addEventListener('click', () => {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleBtn.textContent = '🙈'; // Hide icon
        } else {
            passwordInput.type = 'password';
            toggleBtn.textContent = '👁️'; // Show icon
        }
    });

    // Toggle New Password Visibility (Reset Screen)
    const newPwdInput = shadow.getElementById('new-pwd');
    const toggleNewBtn = shadow.getElementById('toggle-new-pwd-btn');
    toggleNewBtn.addEventListener('click', () => {
        if (newPwdInput.type === 'password') {
            newPwdInput.type = 'text';
            toggleNewBtn.textContent = '🙈';
        } else {
            newPwdInput.type = 'password';
            toggleNewBtn.textContent = '👁️';
        }
    });
}

// Listen for broadcast from background (e.g. biometric success or re-lock)
chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'STATE_CHANGED') {
        if (request.isUnlocked) {
            unlockPage();
        } else {
            // Re-lock logic...
            const root = document.getElementById('gp-vault-root');
            if (!root) {
                if (!document.getElementById('gp-vault-protection')) protectPage();
                showLockScreen();
            }
        }
    }

    // Handle Reset Authorization
    if (request.type === 'RESET_AUTHORIZED') {
        const root = document.getElementById('gp-vault-root');
        if (root && root.shadowRoot) {
            const lockView = root.shadowRoot.getElementById('lock-view');
            const resetView = root.shadowRoot.getElementById('reset-view');
            if (lockView && resetView) {
                lockView.classList.add('hidden');
                resetView.classList.remove('hidden');
            }
        }
    }
});
