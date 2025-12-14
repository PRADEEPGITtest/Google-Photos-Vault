# Google Photos Vault Extension 🔒

A professional, high-security Chrome Extension designed to protect your privacy on `photos.google.com`.

## ✨ Features

- **Strict Lock Mode**: Immediately blocks the page content on load/reload. No sensitive data is ever flashed.
- **Zero-Config Device Authentication**: Uses your existing **Laptop Password** or **Windows Hello PIN** for account recovery. No need to remember a separate master password if you forget it.
- **Auto-Lock**: Automatically re-locks the vault after 15 minutes of inactivity (configurable).
- **Show/Hide Password**: User-friendly UI with visibility toggles.
- **Privacy First**: All data is stored locally (`chrome.storage`). No external servers, no tracking.

## 🛠️ Architecture

This extension uses a **Client-Side Only** architecture for maximum security and privacy.

- **Content Script**: Injects a Shadow DOM lock screen that overlays the entire page logic. Uses `opacity` and `filter` blurring to safely hide content without breaking Google Photos' layout engine.
- **Background Worker**: Manages session state and inactivity timers.
- **TPM/WebAuthn Integration**: Leverages `navigator.credentials.create` to offload identity verification to the Operating System's TPM (Trusted Platform Module), ensuring "Passkeys" are hardware-backed.

## 🚀 Installation

1.  Clone this repository.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer Mode** (top right toggle).
4.  Click **Load Unpacked**.
5.  Select the folder containing this repository.
6.  Go to [photos.google.com](https://photos.google.com) to see it in action!

## 📖 Usage

### First Run
1.  Upon installation, the extension detects you are a new user.
2.  You will be prompted to **Create a Vault Password**. This password is strictly for this extension.

### Forgot Password?
1.  Click **"Forgot Password?"** on the lock screen.
2.  Select **"Use Device Password"**.
3.  Authenticate using your **Windows Hello / Mac Touch ID / System PIN**.
4.  Once verified effectively by your OS, you can set a new vault password.

## 🛡️ Security Note

This extension is designed to protect against casual snooping (friends, family, coworkers). 
- **Encryption**: Passwords are stored in Chrome's encrypted local storage.
- **Bypass Protection**: The lock screen is strictly enforced on every page navigation.
- **Hardware Security**: Secondary authentication relies on the OS-level security (TPM).

## 📄 License

MIT License. Feel free to use and modify.
