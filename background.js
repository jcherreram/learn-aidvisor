// Storage Constants
const ASSESSMENT_KEY = 'learning_assessment_data';
const FRAGMENT_TEXT_KEY = 'current_fragment_text';
const ANSWERS_KEY = 'user_familiarity_answers';
const SIMPLIFIED_TEXT_KEY = 'simplified_text';
const COMPREHENSION_TEST_KEY = 'comprehension_test';
const COMPREHENSION_RESULTS_KEY = 'comprehension_test_results';
const GLOSSARY_KEY = 'glossary_data';

// ==========================================================
// 1. SUPPORT AND UTILITY FUNCTIONS
// ==========================================================

async function updateBadge(text, color) {
    await chrome.action.setBadgeText({ text: text });
    await chrome.action.setBadgeBackgroundColor({ color: color });
}

function getSelectionTextOnly() {
    return window.getSelection().toString();
}

async function getSelectedTextContent() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: getSelectionTextOnly
    });
    
    const selectedText = results[0].result;
    
    if (!selectedText || selectedText.length < 20) {
        throw new Error("No text is selected or the selection is too short.");
    }
    return selectedText;
}

async function runWithTimeout(task, timeoutMs) {
    let timeout;
    const timeoutPromise = new Promise((_, reject) => {
        timeout = setTimeout(() => {
            reject(new Error("TASK_TIMEOUT: The Gemini Nano task exceeded the time limit."));
        }, timeoutMs);
    });
    
    return Promise.race([task(), timeoutPromise]).finally(() => {
        clearTimeout(timeout);
    });
}

// ==========================================================
// 2. LEARNING ADVISOR LOGIC (GEMINI NANO)
// ==========================================================

async function generateAssessment() {
    if (typeof LanguageModel === 'undefined' || await LanguageModel.availability() === 'unavailable') {
        const errorMsg = "Gemini Nano is not available for Assessment.";
        await chrome.storage.local.set({ 'status': 'error', [ASSESSMENT_KEY]: { error_message: errorMsg } });
        await updateBadge('ERR', '#F44336'); 
        chrome.runtime.sendMessage({ action: "taskCompleted" });
        return;
    }

    await chrome.storage.local.set({ 'status': 'running' });
    await updateBadge('RUN', '#FFC100');

    let session = null;
    try {
        const selectedText = await getSelectedTextContent();
        await chrome.storage.local.set({ [FRAGMENT_TEXT_KEY]: selectedText });
        
        session = await LanguageModel.create();

        const prompt = `Analyze the following text fragment. Your task is to generate a single evaluation for this fragment:
        
        1. Assign a unique numeric identifier ('paragraph_id').
        2. Identify two important keywords or concepts.
        3. For each concept, generate a YES/NO question (Familiarity Test).
        4. Calculate the **Static Attentional Effort (NEA Estático)** on a scale of 0 to 100.
        5. **Calculate the Density Score (PD Score)**: The score that contributes to the Static NEA due ONLY to conceptual density and jargon (max 100).

        Return the response strictly in JSON format, with no additional text, following this structure:
        {
          "assessment": [
            {
              "paragraph_id": 1, 
              "nea_estatico": 75,
              "pd_score": 40,
              "questions": [
                {"concept": "Keyword 1.1", "text": "Have you heard of [Keyword 1.1] before?"},
                {"concept": "Keyword 1.2", "text": "Do you feel you know the meaning of [Keyword 1.2]?"}
              ]
            }
          ]
        }
        
        Text to analyze:\n\n${selectedText}`;
        
        const task = async () => {
            let resultString = await session.prompt(prompt);
            let assessmentData;
            try {
                const cleanedString = resultString.trim().replace(/^```json|```$/g, '').trim();
                assessmentData = JSON.parse(cleanedString);
            } catch (jsonError) {
                throw new Error(`JSON_PARSE_ERROR`);
            }
            return assessmentData;
        };

        const assessmentData = await runWithTimeout(task, 45000);
        await chrome.storage.local.set({ 'status': 'finished', [ASSESSMENT_KEY]: assessmentData });
        await updateBadge('QST', '#FFC100');

    } catch (error) {
        const errorMessage = error.message || "Unknown error.";
        await chrome.storage.local.set({ 'status': 'error', [ASSESSMENT_KEY]: { error_message: `Critical failure: ${errorMessage}` } });
        await updateBadge('ERR', '#F44336');
    } finally {
        if (session) session.destroy();
        chrome.runtime.sendMessage({ action: "taskCompleted" });
    }
}

async function simplifyText() {
    if (typeof Rewriter === 'undefined') {
        const errorMsg = "The Rewriter API is not available.";
        await chrome.storage.local.set({ 'status': 'error', [ASSESSMENT_KEY]: { error_message: errorMsg } });
        chrome.runtime.sendMessage({ action: "taskCompleted" });
        return;
    }

    await chrome.storage.local.set({ 'status': 'simplifying' });

    try {
        const result = await chrome.storage.local.get(FRAGMENT_TEXT_KEY);
        const originalText = result[FRAGMENT_TEXT_KEY];
        if (!originalText) throw new Error("Could not find the original text to simplify.");

        const contextPrompt = `You are an expert in cognitive psychology and text editing. Your task is to rewrite the following text to reduce the reader's attentional effort by applying Gestalt's "Unit Formation" principles:

1.  **Proximity:** Break down complex ideas into shorter sentences and smaller paragraphs.
2.  **Similarity:** If there's a list, use bullet points.
3.  **Structure:** Use **bold text** to highlight key concepts.

**IMPORTANT:** Return only the simplified text. Do not include an introduction, notes, or justifications.`;

        const rewriter = await Rewriter.create({ sharedContext: contextPrompt });
        const stream = await rewriter.rewrite(originalText, { length: 'same' });
        
        let simplifiedText = '';
        for await (const chunk of stream) {
            simplifiedText += chunk;
        }

        await chrome.storage.local.set({
            [SIMPLIFIED_TEXT_KEY]: simplifiedText,
            'status': 'simplified'
        });

    } catch (error) {
        await chrome.storage.local.set({ 'status': 'error', [ASSESSMENT_KEY]: { error_message: error.message } });
    } finally {
        chrome.runtime.sendMessage({ action: "taskCompleted" });
    }
}

async function generateComprehensionTest() {
    if (typeof LanguageModel === 'undefined' || await LanguageModel.availability() === 'unavailable') {
        const errorMsg = "Gemini Nano not available for Comprehension Test.";
        await chrome.storage.local.set({ 'status': 'error', [ASSESSMENT_KEY]: { error_message: errorMsg } });
        chrome.runtime.sendMessage({ action: "taskCompleted" });
        return;
    }

    await chrome.storage.local.set({ 'status': 'generating_comprehension' });

    let session = null;
    try {
        const result = await chrome.storage.local.get(FRAGMENT_TEXT_KEY);
        const originalText = result[FRAGMENT_TEXT_KEY];
        if (!originalText) throw new Error("Could not find the original text for the test.");
        
        session = await LanguageModel.create();
        
        const prompt = `Analyze the following text and identify 2-3 key concepts. For each concept, create a question that validates comprehension (not just familiarity) and provide a concise answer.

        Return the response strictly in JSON format, with no additional text, following this structure:
        {
          "comprehension_test": [
            { "question": "What is the main purpose of 'Unit Formation'?", "answer": "To organize a stream of stimuli into discrete, cognitively manageable groups." },
            { "question": "According to Gestalt, which principle makes a title or a box stand out in a text?", "answer": "The principle of Structure or 'figure-ground', which segregates the unit from the rest." }
          ]
        }

        Text to analyze:
        ---
        ${originalText}
        ---
        `;
        
        const resultString = await session.prompt(prompt);
        const cleanedString = resultString.trim().replace(/^```json|```$/g, '').trim();
        const testData = JSON.parse(cleanedString);

        await chrome.storage.local.set({
            [COMPREHENSION_TEST_KEY]: testData,
            'status': 'comprehension_test_ready'
        });

    } catch (error) {
        await chrome.storage.local.set({ 'status': 'error', [ASSESSMENT_KEY]: { error_message: error.message } });
    } finally {
        if (session) session.destroy();
        chrome.runtime.sendMessage({ action: "taskCompleted" });
    }
}

async function extractConceptsFromQuestions(questions) {
    if (!questions || questions.length === 0) {
        return [];
    }
    
    let session = null;
    try {
        session = await LanguageModel.create();
        const prompt = `For each of the following questions, identify and return only the single most important keyword or concept. Separate each concept with a comma. Do not add numbers, explanations, or any other text.
        
        Questions:
        ${questions.join('\n')}
        
        Example Output:
        Concept One, Concept Two, Concept Three`;

        const resultString = await session.prompt(prompt);
        return resultString.split(',').map(concept => concept.trim()).filter(Boolean);

    } catch (error) {
        return [];
    } finally {
        if (session) session.destroy();
    }
}

async function generateGlossary() {
    if (typeof Writer === 'undefined' || typeof LanguageModel === 'undefined' || await LanguageModel.availability() === 'unavailable') {
        const errorMsg = "An AI API is not available for the Glossary.";
        await chrome.storage.local.set({ 'status': 'error', [ASSESSMENT_KEY]: { error_message: errorMsg } });
        chrome.runtime.sendMessage({ action: "taskCompleted" });
        return;
    }

    await chrome.storage.local.set({ 'status': 'generating_glossary' });

    try {
        const result = await chrome.storage.local.get([
            ASSESSMENT_KEY, 
            FRAGMENT_TEXT_KEY, 
            ANSWERS_KEY,
            COMPREHENSION_TEST_KEY,
            COMPREHENSION_RESULTS_KEY
        ]);
        
        const {
            [ASSESSMENT_KEY]: assessmentData,
            [FRAGMENT_TEXT_KEY]: originalText,
            [ANSWERS_KEY]: familiarityAnswers,
            [COMPREHENSION_TEST_KEY]: comprehensionTest,
            [COMPREHENSION_RESULTS_KEY]: comprehensionResults
        } = result;

        if (!assessmentData || !familiarityAnswers || !originalText) {
            throw new Error("Missing base data for glossary generation.");
        }

        const familiarityConcepts = assessmentData.assessment[0].questions
            .filter((q, index) => familiarityAnswers[`q_1_${index}`] === 'no')
            .map(q => q.concept);

        let comprehensionConcepts = [];
        if (comprehensionTest && comprehensionResults) {
            const hardQuestions = comprehensionTest.comprehension_test
                .filter((item, index) => comprehensionResults[index] >= 50)
                .map(item => item.question);
            
            if (hardQuestions.length > 0) {
                comprehensionConcepts = await extractConceptsFromQuestions(hardQuestions);
            }
        }

        const allConcepts = [...new Set([...familiarityConcepts, ...comprehensionConcepts])];
        
        if (allConcepts.length === 0) {
            await chrome.storage.local.set({
                [GLOSSARY_KEY]: "You performed well on all tests! No specific concepts to review in the glossary.",
                'status': 'study_guide_ready'
            });
            return;
        }
        
        const writer = await Writer.create({ sharedContext: originalText });
        const conceptsString = allConcepts.join(', ');
        const requestContext = `Create a concise glossary for the provided terms. The user is a beginner in this subject. Format each entry on a new line like this, without any introduction:
**Term:** Definition`;

        const stream = await writer.write(conceptsString, { context: requestContext });
        
        let glossaryText = '';
        for await (const chunk of stream) { glossaryText += chunk; }

        await chrome.storage.local.set({
            [GLOSSARY_KEY]: glossaryText,
            'status': 'study_guide_ready'
        });

    } catch (error) {
        await chrome.storage.local.set({ 'status': 'error', [ASSESSMENT_KEY]: { error_message: error.message } });
    } finally {
        chrome.runtime.sendMessage({ action: "taskCompleted" });
    }
}

// ==========================================================
// 3. MAIN SERVICE WORKER LISTENER
// ==========================================================

chrome.runtime.onInstalled.addListener(() => {
    chrome.action.setBadgeText({ text: '' }); 
    chrome.storage.local.clear();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    sendResponse({ status: 'alive' });
    return true;
  }
  
  if (request.action === "generateAssessment") {
    generateAssessment();
    sendResponse({ status: 'started' });
    return true; 
  }
  
  if (request.action === "simplifyText") {
    simplifyText();
    sendResponse({ status: 'simplification_started' });
    return true; 
  }
  
  if (request.action === "generateComprehensionTest") {
    generateComprehensionTest();
    sendResponse({ status: 'comprehension_generation_started' });
    return true;
  }
  
  if (request.action === "generateGlossary") {
    generateGlossary();
    sendResponse({ status: 'glossary_generation_started' });
    return true;
  }
  
  if (request.action === "updateBadge") {
    updateBadge(request.text, request.color);
    sendResponse({ status: 'updated' });
    return true;
  }
  
  if (request.action === "resetBadge") {
     chrome.action.setBadgeText({ text: '' });
     sendResponse({ status: 'reset' });
     return true;
  }
});