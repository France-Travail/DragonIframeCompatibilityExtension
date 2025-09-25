let activeInput = null;
let isRichTextEditor = false;
const allowedTextareaIds = ["creer_entretien_synthese_entretien"];

// Function to convert HTML to plain text with line breaks
function htmlToPlainText(html) {
  if (!html) return '';
  
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Replace common HTML elements with line breaks
  const elementsToReplace = ['div', 'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'];
  elementsToReplace.forEach(tag => {
    const elements = tempDiv.querySelectorAll(tag);
    elements.forEach(el => {
      if (tag === 'br') {
        el.replaceWith('\n');
      } else {
        el.insertAdjacentText('afterend', '\n');
      }
    });
  });
  
  // Get text content and clean up multiple line breaks
  return tempDiv.textContent
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple line breaks with double
    .trim();
}

// Function to convert plain text back to HTML
function plainTextToHtmlWithIds(text) {
  const lines = text.split('\n');
  const html = [];

  if (lines.length === 0) return '';

  // bonj is always the first line
  html.push(`<p id="bonj">${lines[0] || '<br>'}</p>`);

  // contenu is always the second line
  html.push(`<p id="contenu">${lines[1] || '<br>'}</p>`);

  // middle lines (unnamed)
  for (let i = 2; i < lines.length - 1; i++) {
    html.push(`<p>${lines[i] || '<br>'}</p>`);
  }

  // last line is always fpol
  if (lines.length > 2) {
    const lastLine = lines[lines.length - 1];
    html.push(`<p id="fpol">${lastLine || '<br>'}</p>`);
  } else {
    // If there's no 3rd line or more, still add empty fpol
    html.push('<p id="fpol"><br></p>');
  }

  return html.join('');
}

function updateMessageStructure(inputText, editor) {
  if (!editor) return;

  // Keep references to the known elements
  const bonj = editor.querySelector('#bonj');
  const contenu = editor.querySelector('#contenu');
  const fpol = editor.querySelector('#fpol');

  if (!bonj || !contenu || !fpol) {
    console.error('Required elements not found: bonj, contenu, fpol');
    return;
  }

  // Remove all siblings except bonj, contenu, and fpol
  Array.from(editor.children).forEach(child => {
    if (child !== bonj && child !== contenu && child !== fpol) {
      editor.removeChild(child);
    }
  });

  // Clear previous content
  bonj.innerText = '';
  fpol.innerText = '';

  // Clear all children inside contenu
  while (contenu.firstChild) {
    contenu.removeChild(contenu.firstChild);
  }

  // Split the input text into lines, removing empty ones
  const lines = inputText.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length === 0) {
    return; // Nothing to do
  }

  // First line → bonj
  bonj.innerText = lines[0];

  // Last line → fpol (only if > 1 line)
  fpol.innerText = lines.length > 1 ? lines[lines.length - 1] : '';

  // Middle lines → contenu
  const middleLines = lines.slice(1, lines.length - 1);
  for (const line of middleLines) {
    const p = document.createElement('p');
    p.textContent = line;
    contenu.appendChild(p);
  }

  // Dispatch input event for reactive frameworks
  const event = new Event('input', { bubbles: true });
  editor.dispatchEvent(event);
}


// Function to find rich text editor content element
function findRichTextContent(container) {
  return container.querySelector('[contenteditable="true"].e-content.e-lib.e-keyboard');
}

document.addEventListener("click", (event) => {
  // First check if click is within a rich text editor
  const richTextContainer = event.target.closest('.ejs-richtexteditor, .e-richtexteditor');
  
  if (richTextContainer) {
    // Handle rich text editor
    const contentElement = findRichTextContent(richTextContainer);
    if (contentElement) {
      activeInput = contentElement;
      isRichTextEditor = true;
      
      // Convert HTML content to plain text with line breaks
      const htmlContent = contentElement.innerHTML || '';
      const plainText = htmlToPlainText(htmlContent);
      
      console.log("Rich text editor detected:", activeInput);
      console.log("Original HTML:", htmlContent);
      console.log("Converted to plain text:", plainText);
      
      chrome.runtime.sendMessage({ action: "openPopupWithText", textToEdit: plainText });
      return;
    }
  }

  // Your original working code for regular inputs
  if ((event.target.tagName === "INPUT" && !["button", "checkbox", "color", "date", "datetime-local", "email", "file", "hidden", "image", "month", "number", "radio", "range", "reset", "submit", "time", "url", "week"].includes(event.target.type)) 
    || event.target.tagName === "TEXTAREA" 
    || event.target.classList.contains("ft-search-application-input")) {

    //if (!allowedTextareaIds.includes(event.target.id)) return; // à décommenter pour que la boite de saisie s'ouvre uniquement sur des ID spécifiques

    activeInput = event.target;
    isRichTextEditor = false;
    const selectedText = activeInput.value; // Get the current value of the input

    console.log("Click sensed active input is: " + activeInput);

    chrome.runtime.sendMessage({ action: "openPopupWithText", textToEdit: selectedText });
  }
}, true);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("We received the message " + message.text + " and active input is: " + activeInput);

  if (message.action === "insertText" && activeInput) {
    if (isRichTextEditor) {
      // Handle rich text editor
      activeInput.focus(); // This might be crucial!
      
      // Convert plain text back to HTML and set it
      updateMessageStructure(message.text,activeInput)
      
      console.log("Plain text received:", message.text);
      console.log("Converted to HTML:", htmlContent);
      
      // Trigger events to notify the rich text editor
      const event = new Event("input", { bubbles: true });
      activeInput.dispatchEvent(event);
      
      console.log("✅ Text inserted into rich text editor");
    } else {
      // Your original working code for regular inputs
      activeInput.focus(); // This might be crucial!
      //simulateHumanTyping(activeInput,message.text);

      //activeInput.value = message.text; // Replace the entire content with the edited text
      setNativeValue(activeInput, message.text);

      
      // const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      //               setter.call(activeInput,message.text);
      
      
      
      const event = new Event("input", { bubbles: true });
     
      activeInput.dispatchEvent(event);


      //  const keydownEvent = new KeyboardEvent('keydown', {
      //       key: char,
      //       code: `Key${char.toUpperCase()}`,
      //       keyCode: char.charCodeAt(0),
      //       which: char.charCodeAt(0),
      //       bubbles: true,
      //       cancelable: true
      //   });
      //activeInput.f_setValue(message.text);

      console.log("✅ Text inserted from popup");
    }
    
    activeInput = null; // Clear the reference
  } else {
    console.log("Failed not a active input in this iframe " + activeInput);
  }
});


function setNativeValue(el, value) {
    if (!el) return;

    // Grab the right prototype for the element (input, textarea, etc.)
    const prototype = Object.getPrototypeOf(el);
    const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (valueSetter) {
        valueSetter.call(el, value);
    } else {
        // Fallback if for some reason no setter is found
        el.value = value;
    }

    // Dispatch events so frameworks (React, Angular, Vue, etc.) update their state
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
}


// Add this function at the top of your content script
async function simulateHumanTyping(input, text) {
    // Step 1: Focus the input (this will trigger the framework's focus handler)
    input.focus();
    
    // Step 2: Wait for the framework to do its focus reset
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Step 3: Select all existing text (like a human would do)
    input.setSelectionRange(0, input.value.length);
    
    // Step 4: Simulate typing to replace the selected text
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        // Simulate the complete key sequence
        const keydownEvent = new KeyboardEvent('keydown', {
            key: char,
            code: `Key${char.toUpperCase()}`,
            keyCode: char.charCodeAt(0),
            which: char.charCodeAt(0),
            bubbles: true,
            cancelable: true
        });
        
        const keypressEvent = new KeyboardEvent('keypress', {
            key: char,
            code: `Key${char.toUpperCase()}`,
            keyCode: char.charCodeAt(0),
            which: char.charCodeAt(0),
            bubbles: true,
            cancelable: true
        });
        
        // Dispatch keydown and keypress
        input.dispatchEvent(keydownEvent);
        input.dispatchEvent(keypressEvent);
        
        // Update the value (this simulates what the browser does)
        if (i === 0) {
            // First character replaces selection
            input.value = char;
        } else {
            // Subsequent characters are appended
            input.value += char;
        }
        
        // Dispatch input event (modern way)
        const inputEvent = new InputEvent('input', {
            inputType: 'insertText',
            data: char,
            bubbles: true,
            cancelable: true
        });
        input.dispatchEvent(inputEvent);
        
        // Dispatch keyup
        const keyupEvent = new KeyboardEvent('keyup', {
            key: char,
            code: `Key${char.toUpperCase()}`,
            keyCode: char.charCodeAt(0),
            which: char.charCodeAt(0),
            bubbles: true,
            cancelable: true
        });
        input.dispatchEvent(keyupEvent);
        
        // Small delay between keystrokes (like human typing)
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    
    // Step 5: Simulate Tab or Enter to trigger the framework's validation
    const enterEvent = new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
    });
    input.dispatchEvent(enterEvent);
    
    // Step 6: Trigger change event (when user leaves the field)
    const changeEvent = new Event('change', {
        bubbles: true,
        cancelable: true
    });
    input.dispatchEvent(changeEvent);
    
    console.log('✅ Human typing simulation complete');
}
