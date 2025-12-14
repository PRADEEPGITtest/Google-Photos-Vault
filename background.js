// Background Service Worker

const INACTIVITY_LIMIT_MINUTES = 5;
const ALARM_NAME = 'inactivity_check';

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['settings'], (result) => {
        if (!result.settings) {
            chrome.storage.local.set({
                settings: {
                    enabled: true,
                    inactivityTimeout: 15, // minutes
                    biometricsEnabled: false // default off until configured
                }
            });
        }
    });
    // Initialize session state in storage
    chrome.storage.local.set({
        sessionState: {
            isUnlocked: false,
            lastActivity: Date.now()
        }
    });
});

// Start an alarm to check inactivity every minute
chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        checkInactivity();
    }
});

function checkInactivity() {
    chrome.storage.local.get(['sessionState', 'settings'], (data) => {
        const state = data.sessionState || { isUnlocked: false, lastActivity: Date.now() };
        if (!state.isUnlocked) return; // Already locked

        const timeoutMinutes = data.settings?.inactivityTimeout || 15;
        const now = Date.now();

        // Debug log
        console.log(`Checking inactivity: Now=${now}, Last=${state.lastActivity}, Diff=${(now - state.lastActivity) / 1000 / 60}m, Limit=${timeoutMinutes}m`);

        if (now - state.lastActivity > timeoutMinutes * 60 * 1000) {
            console.log("Timeout reached. Locking session.");
            state.isUnlocked = false;
            chrome.storage.local.set({ sessionState: state }); // Save locked state

            // Broadcast lock to all tabs
            chrome.tabs.query({ url: '*://photos.google.com/*' }, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { type: 'STATE_CHANGED', isUnlocked: false });
                });
            });
        }
    });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'CHECK_LOCK_STATUS') {
        // Redundant now, but kept for compatibility. Using storage is better.
        chrome.storage.local.get(['sessionState'], (data) => {
            sendResponse({ isUnlocked: data.sessionState?.isUnlocked || false });
        });
        return true;
    }

    if (request.type === 'UNLOCK_SUCCESS') {
        const newState = { isUnlocked: true, lastActivity: Date.now() };
        chrome.storage.local.set({ sessionState: newState });

        // Broadcast to all tabs to unlock immediately
        chrome.tabs.query({ url: '*://photos.google.com/*' }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { type: 'STATE_CHANGED', isUnlocked: true });
            });
        });
        sendResponse({ success: true });
    }

    if (request.type === 'LOCK_SESSION') {
        chrome.storage.local.set({ sessionState: { isUnlocked: false, lastActivity: Date.now() } });
        // Broadcast lock to all tabs
        chrome.tabs.query({ url: '*://photos.google.com/*' }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { type: 'STATE_CHANGED', isUnlocked: false });
            });
        });
        sendResponse({ success: true });
    }

    if (request.type === 'RESET_AUTHORIZED') {
        chrome.tabs.query({ url: '*://photos.google.com/*' }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { type: 'RESET_AUTHORIZED' });
            });
        });
        sendResponse({ success: true });
    }

    if (request.type === 'HEARTBEAT') {
        // Only update if currently unlocked to prevent zombie updates
        chrome.storage.local.get(['sessionState'], (data) => {
            if (data.sessionState && data.sessionState.isUnlocked) {
                chrome.storage.local.set({
                    sessionState: { ...data.sessionState, lastActivity: Date.now() }
                });
            }
        });
    }
});
