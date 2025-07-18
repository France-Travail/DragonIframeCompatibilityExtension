let backgroundPort = null; // Declare a global variable to hold the port connection
let pingInterval = null;   // To store the interval ID for the keep-alive pings




document.getElementById('popupTextarea').addEventListener('input', function(e) {
  const textarea = e.target;
  const value = textarea.value;
  
  if (value.length === 1 && value === value.toLowerCase()) {
    textarea.value = value.toUpperCase();
    // Move cursor to end
    textarea.setSelectionRange(1, 1);
  }
});

// Function to establish or re-establish the connection to the background script
function connectToBackground() {
  // Clear any existing port and interval before attempting to connect
  if (backgroundPort) {
    try {
      backgroundPort.disconnect(); // Explicitly disconnect if already connected
    } catch (e) {
      console.log("Popup: Error disconnecting existing port (might already be disconnected):", e);
    }
    backgroundPort = null;
  }
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }

  try {
    backgroundPort = chrome.runtime.connect({ name: "popup_channel" });
    console.log("Popup: Attempting to connect to background script.");

    backgroundPort.onMessage.addListener((msg) => {
      console.log("Popup: Message received from background via port:", msg);
    });

    backgroundPort.onDisconnect.addListener(() => {
      console.log("Popup: Background script disconnected from popup. Setting backgroundPort to null.");
      backgroundPort = null; // Clear the port reference
      clearInterval(pingInterval); // Stop sending pings
      pingInterval = null;

      // --- Auto-reconnect logic ---
      // If the popup is still open (i.e., this window hasn't closed)
      // and we expect the background to be active, try reconnecting after a short delay.
      // Check if window is still open (documentElement exists)
      if (document.documentElement) {
        console.log("Popup: Reconnecting to background script in 2 seconds...");
        setTimeout(connectToBackground, 2000); // Try to reconnect after 2 seconds
      }
    });

    // Start sending a keep-alive ping every 15 seconds
    pingInterval = setInterval(() => {
      if (backgroundPort) {
        try {
          backgroundPort.postMessage({ action: "keepAlive" });
          // console.log("Popup: Sent keepAlive ping."); // Uncomment to see pings
        } catch (e) {
          console.log("Popup: Error sending keepAlive ping, port might be invalid:", e);
          // This error might indicate the port is truly dead, trigger reconnect
          backgroundPort.onDisconnect.dispatch(); // Manually trigger disconnect logic
        }
      }
    }, 15000); // Ping every 15 seconds

  } catch (e) {
    console.log("Popup: Error connecting to background script:", e);
    backgroundPort = null;
    clearInterval(pingInterval);
    pingInterval = null;
    // If initial connection fails, try again after a delay
    setTimeout(connectToBackground, 2000);
  }
}


document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('popupTextarea');
  const doneButton = document.getElementById('doneButton');

  const urlParams = new URLSearchParams(window.location.search);
  const initialText = urlParams.get('text');
  if (initialText) {
    textarea.value = initialText;
  }

  textarea.focus();

  // --- Initial connection establishment ---
  connectToBackground();

  // --- Event listener for the "Done" button click ---
  doneButton.addEventListener('click', () => {
    const text = textarea.value;
    console.log("Popup: Done button clicked. Text to send:", text);

    if (backgroundPort) {
      try {
        backgroundPort.postMessage({ action: "textFromPopup", text: text });
        console.log("Popup: Message sent via port.");
      } catch (e) {
        console.log("Popup: Error sending message via port:", e);
        backgroundPort = null; // Clear port if sending fails
      }
    } else {
      console.log("Popup: Error: Background port is not active. Message not sent. Attempting reconnect.");
      // If port is not active here, try to reconnect
      connectToBackground();
      // You might want to display a message to the user or retry sending after reconnect
    }

    // Stop the ping interval when the popup is about to close
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }

    // Introduce a small delay before closing the popup
    setTimeout(() => {
      window.close();
    }, 300);
  });

  // Also clear the interval if the window is closed directly by the user (e.g., X button)
  window.addEventListener('beforeunload', () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
      console.log("Popup: Cleared ping interval on window unload.");
    }
    if (backgroundPort) {
      try {
        backgroundPort.disconnect(); // Explicitly disconnect
        console.log("Popup: Explicitly disconnected port on window unload.");
      } catch (e) {
        console.log("Popup: Error disconnecting port on unload:", e);
      }
    }
  });
});