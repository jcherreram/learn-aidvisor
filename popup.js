const outputArea = document.getElementById('output-area');
const startAssessmentButton = document.getElementById('startAssessmentButton');
const ASSESSMENT_KEY = 'learning_assessment_data'; 
const ANSWERS_KEY = 'user_familiarity_answers';
const FRAGMENT_TEXT_KEY = 'current_fragment_text';
const NEA_DATA_KEY = 'last_nea_data';
const SIMPLIFIED_TEXT_KEY = 'simplified_text';
const COMPREHENSION_TEST_KEY = 'comprehension_test';
const COMPREHENSION_RESULTS_KEY = 'comprehension_test_results';
const GLOSSARY_KEY = 'glossary_data';

// --- Function to Calculate Final NEA Data ---
function calculateFinalNEAData(assessmentData, answers, fragmentText) {
    const item = assessmentData.assessment[0]; 
    const N_PREGUNTAS = 2;
    
    const neaEstatico = parseInt(item.nea_estatico) || 0;
    const puntuacionDensidadPD = parseInt(item.pd_score) || 0; 
    
    let siCount = 0;
    item.questions.forEach((q, qIndex) => {
        const answerKey = `q_1_${qIndex}`;
        if (answers[answerKey] === 'yes') {
            siCount++;
        }
    });

    const factorFamiliaridadFF = siCount / N_PREGUNTAS;
    const impactoReduccionIR = puntuacionDensidadPD * factorFamiliaridadFF;
    let neaDinamico = Math.max(0, neaEstatico - impactoReduccionIR);

    let nivel;
    if (neaDinamico >= 70) {
        nivel = 'HIGH';
    } else if (neaDinamico >= 40) {
        nivel = 'MEDIUM';
    } else {
        nivel = 'LOW';
    }
    
    return { 
        neaDinamico: Math.round(neaDinamico), 
        nivel, 
        neaEstatico, 
        puntuacionDensidadPD,
        impactoReduccionIR: Math.round(impactoReduccionIR),
        fragmentText: fragmentText
    };
}

// --- Function to Render the Simplified Text View ---
function renderSimplifiedTextView(simplifiedText) {
    const paragraphs = simplifiedText.split('\n\n').filter(p => p.trim().length > 0);
    const totalParagraphs = paragraphs.length;

    let html = `<h3>✅ Optimized Text for Easier Reading</h3>`;
    html += `<div id="deck-progress-indicator" style="text-align: right; font-size: 0.9em; color: #555; margin-bottom: 10px;"></div>`;

    html += `<div id="simplified-text-deck" class="deck-container">`;
    paragraphs.forEach((p, index) => {
        const isHidden = index > 0 ? 'hidden' : '';
        const renderedHtml = p
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/^\* (.*$)/gm, '<ul><li>$1</li></ul>')
            .replace(/<\/ul>\n<ul>/g, '');

        html += `<div class="paragraph-card ${isHidden}" id="paragraph-${index}" style="font-family: 'Georgia', serif;">${renderedHtml}</div>`;
    });
    html += `</div>`;
    
    html += `<div id="nav-container">
               <div class="nav-buttons">
                 <button id="prev-btn" disabled>Previous</button>
                 <button id="next-btn">Next</button>
               </div>
             </div>`;
             
    html += `<button id="resetButton" style="background-color: #333; margin-top: 10px;">Start New Assessment</button>`;

    outputArea.innerHTML = html;
    startAssessmentButton.style.display = 'none';

    const progressIndicator = document.getElementById('deck-progress-indicator');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const navContainer = document.getElementById('nav-container');
    let currentIndex = 0;

    function updateView() {
        progressIndicator.textContent = `Paragraph ${currentIndex + 1} of ${totalParagraphs}`;
        
        document.querySelectorAll('.paragraph-card').forEach((card, index) => {
            card.classList.toggle('hidden', index !== currentIndex);
        });

        prevBtn.disabled = currentIndex === 0;
        nextBtn.textContent = (currentIndex === totalParagraphs - 1) ? 'Finish' : 'Next';
    }

    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            updateView();
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentIndex < totalParagraphs - 1) {
            currentIndex++;
            updateView();
        } else {
            document.getElementById('simplified-text-deck').classList.add('hidden');
            progressIndicator.classList.add('hidden');
            
            navContainer.innerHTML = `<button id="comprehensionButton" style="background-color: #34a853;">Generate Comprehension Test 📝</button>`;
            
            document.getElementById('comprehensionButton').addEventListener('click', () => {
                outputArea.textContent = "Generating comprehension test...";
                chrome.runtime.sendMessage({ action: "generateComprehensionTest" });
            });
        }
    });

    updateView();
    
    document.getElementById('resetButton').addEventListener('click', () => {
        chrome.storage.local.clear();
        chrome.runtime.sendMessage({ action: "resetBadge" }); 
        loadLastAssessmentResult();
    });
}

// --- Function to Render the Comprehension Test ---
function renderComprehensionTest(testData) {
    const totalQuestions = testData.comprehension_test.length;
    let userRatings = [];

    let html = `<h3>📝 Comprehension Test</h3>`;
    html += `<div id="test-progress-indicator" style="text-align: right; font-size: 0.9em; color: #555; margin-bottom: 10px;"></div>`;
    html += `<p>Reveal the answer, then rate how easy it was to recall.</p>`;

    html += `<div id="comprehension-deck">`;
    testData.comprehension_test.forEach((item, index) => {
        const isHidden = index > 0 ? 'hidden' : '';
        const answerBlockHTML = `
            <div class="answer-container">
                <div class="answer-text"><strong>Answer:</strong> ${item.answer}</div>
                <div class="difficulty-slider-container">
                    <span>Easy</span>
                    <input type="range" min="1" max="100" value="50" class="difficulty-slider" data-card-id="${index}">
                    <span>Hard</span>
                </div>
            </div>
        `;

        html += `
            <div class="question-group comprehension-card ${isHidden}" id="card-${index}" data-card-id="${index}">
                <div class="question-text">${item.question}</div>
                <div id="reveal-container-${index}">
                     <button class="reveal-btn" data-card-id="${index}" data-answer-html="${encodeURIComponent(answerBlockHTML)}">Reveal Answer</button>
                </div>
            </div>
        `;
    });
    html += `</div>`;

    html += `<div id="test-complete-message" class="hidden" style="padding: 20px 0; text-align: center; font-size: 1.1em;">
                <p style="margin:0;">Great work! You've completed the test.</p>
             </div>`;
    
    html += `<button id="studyGuideButton" class="hidden" style="background-color: #1a73e8; margin-top: 10px;">Generate Study Guide 📊</button>`;
    html += `<button id="restartTestButton" class="hidden" style="background-color: #5cb85c; margin-top: 10px;">Restart This Test</button>`;
    html += `<button id="resetButton" style="background-color: #333; margin-top: 10px;">Start New Assessment</button>`;
    
    outputArea.innerHTML = html;
    startAssessmentButton.style.display = 'none';

    const progressIndicator = document.getElementById('test-progress-indicator');
    
    function updateProgress(currentIndex) {
        progressIndicator.textContent = `Question ${currentIndex + 1} of ${totalQuestions}`;
    }

    function showNextQuestion(currentCardId) {
        const currentCard = document.getElementById(`card-${currentCardId}`);
        const nextCardId = parseInt(currentCardId) + 1;
        const nextCard = document.getElementById(`card-${nextCardId}`);

        if (currentCard) currentCard.classList.add('hidden');

        if (nextCard) {
            nextCard.classList.remove('hidden');
            updateProgress(nextCardId);
        } else {
            document.getElementById('comprehension-deck').classList.add('hidden');
            document.getElementById('test-complete-message').classList.remove('hidden');
            document.getElementById('restartTestButton').classList.remove('hidden');
            document.getElementById('studyGuideButton').classList.remove('hidden');
            progressIndicator.classList.add('hidden');
            
            chrome.storage.local.set({ [COMPREHENSION_RESULTS_KEY]: userRatings });
        }
    }

    updateProgress(0);

    document.querySelectorAll('.reveal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cardId = btn.getAttribute('data-card-id');
            const answerHTML = decodeURIComponent(btn.getAttribute('data-answer-html'));
            
            const revealContainer = document.getElementById(`reveal-container-${cardId}`);
            revealContainer.innerHTML = answerHTML;

            const slider = revealContainer.querySelector('.difficulty-slider');
            if (slider) {
                slider.addEventListener('change', () => {
                    userRatings[parseInt(cardId)] = parseInt(slider.value);
                    setTimeout(() => {
                        showNextQuestion(cardId);
                    }, 300);
                });
            }
        });
    });

    document.getElementById('studyGuideButton').addEventListener('click', () => {
        outputArea.innerHTML = `<p>⏳ Generating your personalized study guide...</p>`;
        startAssessmentButton.style.display = 'none';
        chrome.runtime.sendMessage({ action: "generateGlossary" });
    });

    document.getElementById('restartTestButton').addEventListener('click', () => {
        renderComprehensionTest(testData);
    });

    document.getElementById('resetButton').addEventListener('click', () => {
        chrome.storage.local.clear();
        chrome.runtime.sendMessage({ action: "resetBadge" }); 
        loadLastAssessmentResult();
    });
}

// --- Function to Render the Study Guide View ---
async function renderStudyGuideView() {
    const result = await chrome.storage.local.get([GLOSSARY_KEY]);
    const glossaryData = result[GLOSSARY_KEY];

    let html = `<h3>📊 Study Guide</h3>`;
    html += `<p>Here is a glossary of the key concepts you found challenging.</p>`;

    if (glossaryData) {
        html += `<div class="question-group"><h4>Glossary of Key Concepts</h4>`;
        const formattedGlossary = glossaryData
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
        html += `<p style="font-size:0.9em; line-height:1.6;">${formattedGlossary}</p>`;
        html += `</div>`;
    }

    html += `<button id="resetButton" style="background-color: #333; margin-top: 10px;">Start New Assessment</button>`;
    outputArea.innerHTML = html;
    startAssessmentButton.style.display = 'none';

    document.getElementById('resetButton').addEventListener('click', () => {
        chrome.storage.local.clear();
        chrome.runtime.sendMessage({ action: "resetBadge" }); 
        loadLastAssessmentResult();
    });
}


// --- Function to Render the Final NEA View ---
function renderNEAViewFinal(neaData) {
    const emoticonMap = {
        'HIGH': '🤯',
        'MEDIUM': '🤔',
        'LOW': '😎'
    };

    let html = ``;
    
    html += `<div style="text-align: center; padding: 20px 0;">`;
    html += `<p style="font-size: 1.2em; margin-bottom: 10px; color: #333;">The Attentional Effort Level for this text is:</p>`;
    html += `<div style="font-size: 4.5em; margin: 15px 0;">${emoticonMap[neaData.nivel] || ''}</div>`;
    html += `</div>`;

    if (neaData.nivel === 'MEDIUM' || neaData.nivel === 'HIGH') {
        html += `<button id="simplifyButton" style="background-color: #1a73e8;">Optimize for Learning 🧠</button>`;
    } else {
        html += `<button id="comprehensionButton" style="background-color: #34a853;">Generate Comprehension Test 📝</button>`;
    }
    
    html += `<button id="resetButton" style="background-color: #333; margin-top: 10px;">Start New Assessment</button>`;
    
    outputArea.innerHTML = html;
    startAssessmentButton.style.display = 'none';
    
    const simplifyButton = document.getElementById('simplifyButton');
    if (simplifyButton) {
        simplifyButton.addEventListener('click', () => {
            outputArea.textContent = "Optimizing text for learning...";
            simplifyButton.disabled = true;
            chrome.runtime.sendMessage({ action: "simplifyText" });
        });
    }

    const comprehensionButton = document.getElementById('comprehensionButton');
    if (comprehensionButton) {
        comprehensionButton.addEventListener('click', () => {
            outputArea.textContent = "Generating comprehension test...";
            comprehensionButton.disabled = true;
            if (simplifyButton) simplifyButton.disabled = true;
            chrome.runtime.sendMessage({ action: "generateComprehensionTest" });
        });
    }

    document.getElementById('resetButton').addEventListener('click', () => {
        chrome.storage.local.clear();
        chrome.runtime.sendMessage({ action: "resetBadge" }); 
        loadLastAssessmentResult();
    });
}

// --- Function to Render the Familiarity Assessment ---
function renderAssessment(assessmentData, fragmentText) {
    let html = '<h3>✅ Familiarity Assessment Pending</h3>';
    html += '<p>Answer the questions based on the **selected text**.</p>';
    html += '<form id="familiarityForm">';
    
    const item = assessmentData.assessment[0];
    
    html += `<div class="question-group">`;
    html += `<h4>Analyzed Fragment</h4>`;
    html += `<p class="paragrah-view">"${fragmentText.substring(0, 300)}..."</p>`;
    
    item.questions.forEach((q, qIndex) => {
        const radioName = `q_1_${qIndex}`;
        html += `<div style="margin-top: 10px;">`;
        const questionText = q.text.replace(`[${q.concept}]`, q.concept).replace(`[${q.concept}]?`, q.concept + '?');
        html += `<div class="question-text">${questionText}</div>`; 
        html += `<label><input type="radio" name="${radioName}" value="yes" required> Yes</label>`;
        html += `<label><input type="radio" name="${radioName}" value="no"> No</label>`;
        html += `</div>`;
    });
    html += `</div>`;

    html += '<button type="submit" style="background-color: green;">See My Effort Level</button>';
    html += '</form>';

    outputArea.innerHTML = html;
    startAssessmentButton.style.display = 'none';

    document.getElementById('familiarityForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const answers = Object.fromEntries(formData.entries());
        
        const result = await chrome.storage.local.get([ASSESSMENT_KEY, FRAGMENT_TEXT_KEY]);
        const assessmentData = result[ASSESSMENT_KEY];
        const fragmentText = result[FRAGMENT_TEXT_KEY];

        const finalNEAData = calculateFinalNEAData(assessmentData, answers, fragmentText);
        
        await chrome.storage.local.set({ 
            'status': 'nea_calculated',
            [ANSWERS_KEY]: answers,
            [NEA_DATA_KEY]: finalNEAData 
        });
        
        chrome.runtime.sendMessage({ action: "updateBadge", text: 'OK', color: '#4CAF50' });
        
        renderNEAViewFinal(finalNEAData);
    });
}

// --- Function to Load the Last Assessment Result and State ---
async function loadLastAssessmentResult() {
    const result = await chrome.storage.local.get(['status', ASSESSMENT_KEY, FRAGMENT_TEXT_KEY, NEA_DATA_KEY, SIMPLIFIED_TEXT_KEY, COMPREHENSION_TEST_KEY]);
    const { status, [ASSESSMENT_KEY]: assessmentData, [FRAGMENT_TEXT_KEY]: fragmentText, [NEA_DATA_KEY]: lastNEAData, [SIMPLIFIED_TEXT_KEY]: simplifiedText, [COMPREHENSION_TEST_KEY]: comprehensionTest } = result;

    startAssessmentButton.disabled = false;
    startAssessmentButton.style.display = 'block';
    startAssessmentButton.textContent = 'Get Learning Insights 📑';
    
    if (status === 'running' || status === 'simplifying' || status === 'generating_comprehension' || status === 'generating_glossary') {
        let taskName = 'Generating assessment';
        if (status === 'simplifying') taskName = 'Simplifying text';
        if (status === 'generating_comprehension') taskName = 'Generating test';
        if (status === 'generating_glossary') taskName = 'Generating Study Guide';
        outputArea.textContent = `Status: ⏳ ${taskName} in the background...`;
        startAssessmentButton.disabled = true;
        startAssessmentButton.textContent = '⏳ Task in Progress...';
    } else if (status === 'study_guide_ready') {
        renderStudyGuideView();
    } else if (status === 'comprehension_test_ready' && comprehensionTest) {
        renderComprehensionTest(comprehensionTest);
    } else if (status === 'simplified' && simplifiedText) {
        renderSimplifiedTextView(simplifiedText);
    } else if (status === 'nea_calculated' && lastNEAData) {
        renderNEAViewFinal(lastNEAData);
    } else if (status === 'finished' && assessmentData) {
        renderAssessment(assessmentData, fragmentText);
        chrome.runtime.sendMessage({ action: "updateBadge", text: 'QST', color: '#FFC100' });
    } else if (status === 'error') {
        outputArea.textContent = `Status: ❌ Error. ${(assessmentData && assessmentData.error_message) || 'Unknown error.'}`;
    } else {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        const isRestricted = tab.url.startsWith("chrome://") || tab.url.startsWith("https://chrome.google.com/");

        if (isRestricted) {
            outputArea.textContent = '⛔️ This extension cannot run on Chrome system pages. Please try on a regular webpage.';
            startAssessmentButton.disabled = true;
            return;
        }

        const selectedText = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection().toString()
        });

        if (!selectedText[0].result || selectedText[0].result.length < 20) {
            outputArea.textContent = '⚠️ Please, **select a text fragment** to start the assessment.';
            startAssessmentButton.disabled = true;
        } else {
            outputArea.textContent = '✅ Text selected! Click the button to start.';
            startAssessmentButton.disabled = false; 
        }
    }
}

// --- Button and Event Listeners ---
startAssessmentButton.addEventListener('click', () => {
    outputArea.textContent = 'Status: ⏳ Generating assessment in the background...';
    startAssessmentButton.disabled = true;
    startAssessmentButton.textContent = '⏳ Assessment in Progress...';
    
    chrome.runtime.sendMessage({ action: "generateAssessment" }, (response) => {
        if (chrome.runtime.lastError || !response) {
            outputArea.textContent = "❌ ERROR: Could not start the task.";
            startAssessmentButton.disabled = false;
            startAssessmentButton.textContent = 'Get Learning Insights 📑';
            return;
        }
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "taskCompleted") {
        loadLastAssessmentResult();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('help-icon').addEventListener('click', () => {
        chrome.tabs.create({ url: 'guide.html' });
    });
    
    chrome.runtime.sendMessage({ action: "ping" }, (response) => {
        if (chrome.runtime.lastError) {
           // Silently ignore ping failure in production
        }
    });
    loadLastAssessmentResult();
});