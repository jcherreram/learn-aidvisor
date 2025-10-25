Of course. Here is a complete README.md file for your "Learn AIdvisor" project, ready for your GitHub repository.

***

# Learn AIdvisor 🧠

Learn AIdvisor is a Chrome extension that acts as a personal learning assistant. By leveraging the on-device power of Google's Gemini Nano, it analyzes selected text to calculate the reader's required **Attentional Effort (NEA)**, simplifies complex content, and generates personalized comprehension tests and study guides to make online learning more effective and efficient.

!([https://i.imgur.com/gO0a9kS.png](https://i.imgur.com/gO0a9kS.png))

---

## Core Features

* **Attentional Effort Calculation**: Analyzes any selected text to determine its cognitive load, classifying it as LOW, MEDIUM, or HIGH effort.
* **Personalized Familiarity Assessment**: Asks targeted yes/no questions to adjust the effort score based on the user's prior knowledge.
* **AI-Powered Text Simplification**: Rewrites complex or dense text into a more digestible format using Gestalt principles of unit formation.
* **Interactive Comprehension Tests**: Generates flashcard-style questions to test understanding of the core concepts.
* **Dynamic Study Guide**: Creates a final, personalized glossary focusing only on the concepts the user found challenging.

---

## How It Works: The Workflow

1.  **Select Text**: Highlight a piece of text (at least 20 characters) on any webpage.

2.  **Familiarity Assessment**: Answer a few simple yes/no questions about key concepts found in the text.

3.  **Get Your Effort Level**: The extension displays the final Attentional Effort Level.

4.  **Use Learning Tools**: Based on the result, you can simplify the text or generate a comprehension test.

5.  **Take the Test**: Answer the generated questions and rate how difficult it was to recall each answer.

6.  **Generate Study Guide**: After the test, create your personalized study guide.

7.  **Review the Glossary**: The final view provides a focused glossary of the concepts you struggled with, helping you study more effectively.

---

## Technology Stack

This extension is built with modern web technologies and harnesses the power of on-device AI through the Gemini Nano APIs available in Google Chrome.

* **Core**: HTML5, CSS3, JavaScript (ES6+)
* **Browser APIs**: Chrome Extension Manifest V3, `chrome.storage`, `chrome.scripting`
* **AI Engine**: Google Gemini Nano
    * **`LanguageModel` (Prompt API)**: Used for complex, instruction-based tasks like generating the initial JSON assessment and the comprehension test questions.
    * **`Rewriter API`**: Used for the text simplification feature, guided by a custom prompt based on Gestalt principles.
    * **`Writer API`**: Used for focused, context-aware content generation, specifically for creating the personalized glossary in the Study Guide.

---

## Installation

To install and test this extension locally:

1.  Download or clone this repository to your local machine.
2.  Open Google Chrome and navigate to `chrome://extensions`.
3.  Enable **"Developer mode"** using the toggle switch in the top-right corner.
4.  Click the **"Load unpacked"** button.
5.  Select the directory where you cloned the repository.
6.  The Learn AIdvisor icon will appear in your Chrome toolbar.

---

## License

This project is licensed under the Apache License. See the [LICENSE](LICENSE) file for details.