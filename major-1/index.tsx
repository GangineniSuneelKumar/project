import { GoogleGenAI, Chat, GenerateContentResponse, Type } from "@google/genai";

// Ensure the `marked` library is available globally
declare const marked: {
  parse(markdown: string): string;
};

const chatHistory = document.getElementById('chat-history') as HTMLElement;
const promptForm = document.getElementById('prompt-form') as HTMLFormElement;
const promptInput = document.getElementById('prompt-input') as HTMLInputElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;

// Preferences Modal Elements
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
const preferencesModal = document.getElementById('preferences-modal') as HTMLDialogElement;
const preferencesForm = document.getElementById('preferences-form') as HTMLFormElement;
const closeModalBtn = document.getElementById('close-modal-btn') as HTMLButtonElement;
const allergiesInput = document.getElementById('allergies') as HTMLInputElement;

// Clear Chat Button
const clearChatBtn = document.getElementById('clear-chat-btn') as HTMLButtonElement;

let chat: Chat;
let userPreferences: Record<string, string> = {};

/**
 * Initializes the application, loads user preferences, and sets up the chat.
 */
// FIX: Fix typo in function name. This resolves `Cannot find name 'functioninitializeApp'`.
function initializeApp() {
  if (!process.env.API_KEY) {
    appendMessage(
      'ai',
      '<strong>Error:</strong> API_KEY is not set. Please configure your environment with a valid Google Gemini API key.'
    );
    sendBtn.disabled = true;
    promptInput.disabled = true;
    return;
  }
  loadPreferences();
  resetChatSession();
  appendWelcomeMessage();
}

/**
 * Resets the AI chat session and system instruction.
 */
function resetChatSession() {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const systemInstruction = `You are an expert AI dietitian. Your goal is to provide personalized, healthy, and appealing diet plans.
- Always consider the user's profile: age, height, weight, gender, activity level, dietary restrictions, allergies, and health goals.
- Generate plans in a clear, structured Markdown table format with columns for "Meal," "Food Suggestions," and "Notes."
- The "Notes" column should include portion sizes or preparation tips.
- When asked for suggestions for a specific meal, provide three diverse and creative alternatives that fit the user's profile and the meal type (e.g., breakfast). Do not use a table format for suggestions.
- Keep your responses encouraging, concise, and focused on the diet plan. Do not add conversational filler.`;

    chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction,
      },
    });
}


/**
 * Appends the initial welcome message to the chat.
 */
function appendWelcomeMessage() {
  const welcomeText = `Hello! I'm your personal AI Diet Planner. To get started, please fill out your health profile by clicking the settings icon ⚙️ in the top right. Once that's done, ask me for a diet plan!`;
  appendMessage('ai', welcomeText);
}

/**
 * Loads user preferences from localStorage and populates the form.
 */
function loadPreferences() {
  const savedPrefs = localStorage.getItem('userDietPrefs');
  if (savedPrefs) {
    userPreferences = JSON.parse(savedPrefs);
    for (const key in userPreferences) {
      const element = preferencesForm.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (element) {
        element.value = userPreferences[key];
      }
    }
  }
}

/**
 * Saves user preferences from the form to localStorage.
 */
function savePreferences() {
  const formData = new FormData(preferencesForm);
  userPreferences = {};
  formData.forEach((value, key) => {
    // Trim whitespace from text inputs, but not other fields
    // FIX: FormData values can be File objects, but userPreferences expects strings.
    // This resolves `Type 'string | File' is not assignable to type 'string'`.
    if (typeof value === 'string') {
        userPreferences[key] = value.trim();
    }
  });
  localStorage.setItem('userDietPrefs', JSON.stringify(userPreferences));
}

/**
 * Creates a context string from the user's profile.
 */
function getUserProfileContext(): string {
    if (Object.keys(userPreferences).length === 0) {
        return "User profile is not set.";
    }
    return `Here is the user's profile:
- Age: ${userPreferences.age || 'N/A'}
- Height: ${userPreferences.height || 'N/A'} cm
- Weight: ${userPreferences.weight || 'N/A'} kg
- Gender: ${userPreferences.gender || 'N/A'}
- Activity Level: ${userPreferences['activity-level']?.replace(/_/g, ' ') || 'N/A'}
- Dietary Restrictions: ${userPreferences['dietary-restrictions'] || 'None'}
- Allergies: ${userPreferences.allergies || 'None'}
- Health Goals: ${userPreferences['health-goals'] || 'N/A'}`;
}


/**
 * Appends a message to the chat history UI.
 * @param {string} sender - 'user' or 'ai'.
 * @param {string} content - The message content (HTML).
 * @returns {HTMLElement} The created message element.
 */
function appendMessage(sender: 'user' | 'ai', content: string): HTMLElement {
  const messageWrapper = document.createElement('div');
  messageWrapper.classList.add('chat-message', `${sender}-message`);

  const contentDiv = document.createElement('div');
  contentDiv.classList.add('content');
  contentDiv.innerHTML = content;

  messageWrapper.appendChild(contentDiv);
  chatHistory.appendChild(messageWrapper);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  return messageWrapper;
}

/**
 * Renders Markdown content and injects "Suggest" buttons into tables.
 * @param {string} markdownText - The markdown text to render.
 * @returns {string} The rendered HTML.
 */
function renderMarkdown(markdownText: string): string {
    const rawHtml = marked.parse(markdownText);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawHtml;

    const tables = tempDiv.querySelectorAll('table');
    tables.forEach(table => {
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim());
        const foodSuggestionsIndex = headers.indexOf('Food Suggestions');
        const mealIndex = headers.indexOf('Meal');

        if (foodSuggestionsIndex !== -1 && mealIndex !== -1) {
            const rows = table.querySelectorAll('tr');
            rows.forEach((row, rowIndex) => {
                if (rowIndex === 0) return; // Skip header row
                const mealCell = row.children[mealIndex] as HTMLElement;
                const foodCell = row.children[foodSuggestionsIndex] as HTMLElement;
                if (mealCell && foodCell) {
                    const mealType = mealCell.textContent?.trim() || 'this meal';
                    const button = document.createElement('button');
                    button.textContent = 'Suggest';
                    button.className = 'suggest-btn';
                    button.dataset.meal = mealType;
                    // Add a space before the button if the cell has content
                    if (foodCell.innerHTML.trim().length > 0) {
                        foodCell.innerHTML += '<br><br>';
                    }
                    foodCell.appendChild(button);
                }
            });
        }
    });

    return tempDiv.innerHTML;
}


/**
 * Shows a loading indicator for the AI response.
 * @returns {HTMLElement} The loading indicator element.
 */
function showLoadingIndicator(): HTMLElement {
  return appendMessage('ai', '<div class="spinner"></div> Thinking...');
}

/**
 * Sends a message to the Gemini API and displays the response.
 * @param {string} userMessage - The message from the user.
 */
async function sendMessage(userMessage: string) {
  if (!userMessage.trim()) return;

  appendMessage('user', userMessage);
  sendBtn.disabled = true;
  promptInput.value = '';

  const loadingIndicator = showLoadingIndicator();

  try {
    const profileContext = getUserProfileContext();
    const fullPrompt = `${profileContext}\n\nUser's request: "${userMessage}"`;

    const responseStream = await chat.sendMessageStream({ message: fullPrompt });
    let fullResponseText = "";
    
    for await (const chunk of responseStream) {
        fullResponseText += chunk.text;
        loadingIndicator.querySelector('.content')!.innerHTML = renderMarkdown(fullResponseText);
    }
    // Final render after stream is complete to ensure all buttons are present
    loadingIndicator.querySelector('.content')!.innerHTML = renderMarkdown(fullResponseText);
    
  } catch (error) {
    console.error('API Error:', error);
    const contentDiv = loadingIndicator.querySelector('.content') as HTMLElement;
    if (contentDiv) {
        contentDiv.innerHTML = 'Sorry, something went wrong. Please try again.';
        contentDiv.style.color = 'var(--error-color)';
    }
  } finally {
    sendBtn.disabled = false;
    promptInput.focus();
  }
}

/**
 * Handles clicks on the "Suggest" button within a meal plan table.
 * @param {HTMLButtonElement} button - The button that was clicked.
 */
async function handleSuggestionClick(button: HTMLButtonElement) {
    const mealType = button.dataset.meal;
    const cell = button.parentElement;
    if (!mealType || !cell) return;

    button.disabled = true;
    button.innerHTML = '<div class="spinner"></div>';

    try {
        const profileContext = getUserProfileContext();
        const suggestionPrompt = `Give me three new food suggestions for ${mealType}, keeping the user's profile in mind. Respond with only a bulleted or numbered list of the new food items.`;

        // We use a non-streaming call here for a simpler update
        const response = await chat.sendMessage({ message: `${profileContext}\n\n${suggestionPrompt}` });
        const suggestionHtml = renderMarkdown(response.text);

        // Replace the cell's content with the new suggestions
        cell.innerHTML = suggestionHtml;
    } catch (error) {
        console.error('Suggestion Error:', error);
        cell.innerHTML += '<p style="color:var(--error-color)">Could not get suggestions.</p>';
        button.remove(); // Remove button on error
    }
}


/**
 * Handles clearing the chat history and resetting the session.
 */
function handleClearChat() {
    if(confirm('Are you sure you want to clear the chat history? This cannot be undone.')) {
        chatHistory.innerHTML = '';
        resetChatSession();
        appendWelcomeMessage();
    }
}


// --- Event Listeners ---

promptForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage(promptInput.value);
});

// Event delegation for suggestion buttons
chatHistory.addEventListener('click', (e) => {
    if (e.target && (e.target as HTMLElement).classList.contains('suggest-btn')) {
        handleSuggestionClick(e.target as HTMLButtonElement);
    }
});


settingsBtn.addEventListener('click', () => preferencesModal.showModal());
closeModalBtn.addEventListener('click', () => preferencesModal.close());
clearChatBtn.addEventListener('click', handleClearChat);

preferencesForm.addEventListener('submit', (e) => {
  e.preventDefault();
  savePreferences();
  preferencesModal.close();
  // Reset chat to apply new preferences
  chatHistory.innerHTML = '';
  resetChatSession();
  appendMessage('ai', 'Your preferences have been saved! Feel free to ask for a new diet plan.');
});

// Real-time input validation for allergies
allergiesInput.addEventListener('input', () => {
    // Allow only letters, spaces, and commas
    const sanitizedValue = allergiesInput.value.replace(/[^a-zA-Z\s,]/g, '');
    if (allergiesInput.value !== sanitizedValue) {
        allergiesInput.value = sanitizedValue;
    }
});

// Initialize the app on load
initializeApp();
// Add these elements to your declarations
const voiceBtn = document.getElementById('voice-btn') as HTMLButtonElement;
const languageSelect = document.getElementById('language-select') as HTMLSelectElement;

// Web Speech API initialization
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
    recognition.continuous = false;
    recognition.interimResults = false;

    voiceBtn.addEventListener('click', () => {
        recognition.lang = languageSelect.value; // Set language (en-US, ta-IN, te-IN)
        recognition.start();
        voiceBtn.classList.add('listening');
    });

    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        promptInput.value = transcript;
        voiceBtn.classList.remove('listening');
    };

    recognition.onerror = () => {
        voiceBtn.classList.remove('listening');
        alert("Voice recognition error. Please try again.");
    };

    recognition.onend = () => {
        voiceBtn.classList.remove('listening');
    };
} else {
    voiceBtn.style.display = 'none'; // Hide if browser doesn't support it
}

/**
 * Updated sendMessage to include language context
 */
async function sendMessage(text: string) {
    if (!text.trim()) return;
    
    const selectedLang = languageSelect.options[languageSelect.selectedIndex].text;
    const languageInstruction = `Please respond strictly in ${selectedLang}.`;

    appendMessage('user', text);
    promptInput.value = '';

    try {
        // You can prepend the language instruction to the user prompt or system instruction
        const result = await chat.sendMessage(`${languageInstruction}\n\nUser Question: ${text}`);
        const response = await result.response;
        appendMessage('ai', response.text());
    } catch (error) {
        console.error(error);
        appendMessage('ai', 'Error: Could not get a response.');
    }
}
