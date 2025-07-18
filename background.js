// Global variables to keep track of the original tab and the popup window
let originalTabId = null;
let popupWindowId = null;

// --- Listener for opening the popup from the content script ---
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {

    let {workflowEnabled} = await chrome.storage.local.get("workflowEnabled");
    if (message.action === "openPopupWithText" && workflowEnabled ) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                originalTabId = tabs[0].id;
                const textToEdit = message.textToEdit || "";
                const popupUrl = 'popup.html?text=' + encodeURIComponent(textToEdit);

                if (popupWindowId) {
                    chrome.windows.update(popupWindowId, { focused: true });
                } else {
                    chrome.windows.create({
                        url: popupUrl,
                        type: 'popup',
                        width: 400,
                        height: 300,
                        focused: true
                    }, (win) => {
                        popupWindowId = win.id;
                    });
                }
            }
        });
    }
    // No specific handling for "ping" messages needed here, they are just received on the port
    // and inherently keep the service worker active by being port activity.
});


// --- Listener for when a Chrome window is removed (e.g., closed by the user) ---
chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId === popupWindowId) {
        popupWindowId = null;
        console.log("Background: Popup window closed, popupWindowId reset.");
        // originalTabId can remain if it's needed for other operations
    }
});


// --- Long-Lived Connection Listener ---
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "popup_channel") {
        console.log("Background: Popup connected via 'popup_channel'. Service Worker active due to connection.");

        port.onMessage.addListener((message) => {
            if (message.action === "textFromPopup" && originalTabId) {
                console.log("Background: Received text via port:", message.text);
                chrome.tabs.sendMessage(originalTabId, { action: "insertText", text: message.text })
                    .then(() => {
                        console.log("Background: Text successfully sent to content script.");
                    })
                    .catch(error => {
                        console.log("Background: Error sending text to content script:", error);
                    });
            } else if (message.action === "keepAlive") {
                // Simply receiving this message keeps the port active and thus the Service Worker active.
                // You can add a console.log here if you want to see the pings.
                // console.log("Background: Received keepAlive ping from popup.");
            }
        });

        port.onDisconnect.addListener(() => {
            console.log("Background: Popup disconnected from 'popup_channel'. Service Worker might become inactive soon if no other events/connections.");
            if (popupWindowId !== null) {
                popupWindowId = null; // Ensure popupWindowId is reset on disconnect
            }
        });
    }
});



const ICONS = {
  on: {
    "32": "dice_normal.ico"
  },
  off: {
    "32": "dice_disabled.ico"
  }
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ workflowEnabled: true });
  chrome.action.setIcon({ path: ICONS.on });
});

chrome.action.onClicked.addListener(async (tab) => {
  const { workflowEnabled } = await chrome.storage.local.get("workflowEnabled");
  const newState = !workflowEnabled;

  // Save new state
  await chrome.storage.local.set({ workflowEnabled: newState });

  chrome.action.setIcon({ path: newState ? ICONS.on : ICONS.off });
});
