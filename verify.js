// Verify identity via WebAuthn

const statusDiv = document.getElementById('status');
const verifyBtn = document.getElementById('verify-btn');

async function authenticate() {
    try {
        // We use 'create' (Registration) as a way to force the OS to ask for PIN/Password.
        // We don't save the key; we just use the successful creation as proof of identity.

        const publicKey = {
            challenge: new Uint8Array(32),
            rp: { name: "Google Photos Vault" },
            user: {
                id: new Uint8Array(16),
                name: "verification@vault",
                displayName: "Device Owner"
            },
            pubKeyCredParams: [
                { type: "public-key", alg: -7 },   // ES256
                { type: "public-key", alg: -257 }  // RS256 (Windows Hello default)
            ],
            authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "required" // Forces PIN/Password/Biometric
            },
            timeout: 60000,
            attestation: "none"
        };

        // Trigger OS prompt (Touch ID / Face ID / Windows Hello PIN)
        await navigator.credentials.create({ publicKey });

        // Success
        statusDiv.textContent = "Verified!";
        statusDiv.style.color = "#81c995";
        verifyBtn.style.display = 'none';

        // Check reason
        const urlParams = new URLSearchParams(window.location.search);
        const reason = urlParams.get('reason');

        if (reason === 'reset') {
            chrome.runtime.sendMessage({ type: 'RESET_AUTHORIZED' }, () => {
                setTimeout(() => window.close(), 1000);
            });
        } else {
            chrome.runtime.sendMessage({ type: 'UNLOCK_SUCCESS' }, () => {
                setTimeout(() => window.close(), 1000);
            });
        }

    } catch (e) {
        console.error(e);
        statusDiv.textContent = "Verification failed.";
        statusDiv.style.color = "#f28b82";
    }
}

// Attach to button (Required for user gesture policy in some contexts)
verifyBtn.addEventListener('click', authenticate);

// Optional: Try auto-start if possible, but don't rely on it
// authenticate(); 
