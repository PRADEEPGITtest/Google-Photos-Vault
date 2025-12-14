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
});

// State management for "unlocked" session
// Note: In MV3 Service Workers, global variables can be reset. 
// Ideally we use storage.session (if available) or rely on client messaging.
// For security, 'unlocked' state should be kept as ephemeral as possible.
let sessionState = {
    isUnlocked: false,
    lastActivity: Date.now()
};

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'CHECK_LOCK_STATUS') {
        const now = Date.now();
        // Check timeout
        chrome.storage.local.get(['settings'], (data) => {
            const timeoutMinutes = data.settings?.inactivityTimeout || 15;
            if (now - sessionState.lastActivity > timeoutMinutes * 60 * 1000) {
                sessionState.isUnlocked = false;
            }
            sendResponse({ isUnlocked: sessionState.isUnlocked });
        });
        return true; // async response
    }

    if (request.type === 'UNLOCK_SUCCESS') {
        sessionState.isUnlocked = true;
        sessionState.lastActivity = Date.now();

        // Broadcast to all tabs to unlock immediately
        chrome.tabs.query({ url: '*://photos.google.com/*' }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { type: 'STATE_CHANGED', isUnlocked: true });
            });
        });

        sendResponse({ success: true });
    }

    if (request.type === 'LOCK_SESSION') {
        sessionState.isUnlocked = false;
        // Broadcast lock to all tabs
        chrome.tabs.query({ url: '*://photos.google.com/*' }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { type: 'STATE_CHANGED', isUnlocked: false });
            });
        });
        sendResponse({ success: true });
    }

    if (request.type === 'RESET_AUTHORIZED') {
        // Broadcast reset permission to all tabs
        chrome.tabs.query({ url: '*://photos.google.com/*' }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { type: 'RESET_AUTHORIZED' });
            });
        });
        sendResponse({ success: true });
    }

    if (request.type === 'HEARTBEAT') {
        sessionState.lastActivity = Date.now();
    }
});
