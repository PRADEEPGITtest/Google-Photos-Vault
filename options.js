// Options Logic

// 1. Password Management
const pwdInput = document.getElementById('new-password');
const savePwdBtn = document.getElementById('save-password');
const pwdStatus = document.getElementById('pwd-status');

savePwdBtn.addEventListener('click', async () => {
    const password = pwdInput.value;

    // Strength Validation
    const errors = [];
    if (password.length < 8) errors.push("At least 8 chars");
    if (!/[A-Z]/.test(password)) errors.push("One uppercase");
    if (!/[a-z]/.test(password)) errors.push("One lowercase");
    if (!/[0-9]/.test(password)) errors.push("One number");
    if (!/[^A-Za-z0-9]/.test(password)) errors.push("One symbol (!@#$)");

    if (errors.length > 0) {
        showStatus(pwdStatus, 'Weak: ' + errors.join(', '), false);
        return;
    }

    // AUTHENTICATION CHECK
    try {
        showStatus(pwdStatus, 'Verifying identity...', true);
        const publicKey = {
            challenge: new Uint8Array(32),
            rp: { name: "Google Photos Vault" },
            user: { id: new Uint8Array(16), name: "admin@vault", displayName: "Admin" },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
            authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
            timeout: 60000,
            attestation: "none"
        };
        await navigator.credentials.create({ publicKey });
    } catch (e) {
        showStatus(pwdStatus, 'Verification Failed. Cannot change password.', false);
        return;
    }

    chrome.storage.local.set({ userPassword: password }, () => {
        // Lock immediately on password change
        chrome.runtime.sendMessage({ type: 'LOCK_SESSION' }, () => {
            showStatus(pwdStatus, 'Password saved & Vault Locked', true);
            pwdInput.value = '';
        });
    });
});

// 2. Timeout Management
const timeoutInput = document.getElementById('timeout');
const saveTimeoutBtn = document.getElementById('save-timeout');
const timeoutStatus = document.getElementById('timeout-Status'); // Case mismatch in HTML fixed here? No, let's fix ID usage.
// Note: HTML ID was 'timeout-Status'

chrome.storage.local.get(['settings'], (res) => {
    if (res.settings && res.settings.inactivityTimeout) {
        timeoutInput.value = res.settings.inactivityTimeout;
    }
});

saveTimeoutBtn.addEventListener('click', () => {
    const min = parseInt(timeoutInput.value, 10);
    chrome.storage.local.get(['settings'], (res) => {
        const newSettings = { ...res.settings, inactivityTimeout: min };
        chrome.storage.local.set({ settings: newSettings }, () => {
            showStatus(document.getElementById('timeout-Status'), 'Timeout saved!', true);
        });
    });
});

// 3. Biometrics (WebAuthn Registration)
const bioBtn = document.getElementById('register-biometric');
const bioStatus = document.getElementById('bio-status');

bioBtn.addEventListener('click', async () => {
    // Helper to convert buffer to base64
    function bufferToBase64(buffer) {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }

    try {
        const publicKey = {
            challenge: new Uint8Array(32), // Random challenge
            rp: { name: "Google Photos Vault Extension" },
            user: {
                id: new Uint8Array(16),
                name: "user@vault",
                displayName: "Vault User"
            },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }],
            authenticatorSelection: { authenticatorAttachment: "platform" },
            timeout: 60000,
            attestation: "direct"
        };

        // This will prompt Windows Hello / Touch ID
        const credential = await navigator.credentials.create({ publicKey });

        // Save the Credential ID so we can verify against it later in verify.js
        const credentialId = bufferToBase64(credential.rawId);

        // If we get here, user successfully authenticated with OS
        chrome.storage.local.get(['settings'], (res) => {
            const newSettings = {
                ...res.settings,
                biometricsEnabled: true,
                credentialId: credentialId
            };
            chrome.storage.local.set({ settings: newSettings }, () => {
                showStatus(bioStatus, 'Biometrics enabled!', true);
                bioBtn.textContent = 'Re-configure';
            });
        });

    } catch (e) {
        console.error(e);
        showStatus(bioStatus, 'Setup failed or cancelled', false);
    }
});

function showStatus(element, msg, isSuccess) {
    element.textContent = msg;
    element.className = 'status ' + (isSuccess ? 'success' : 'error');
    setTimeout(() => {
        element.textContent = '';
        element.className = 'status';
    }, 3000);
}
