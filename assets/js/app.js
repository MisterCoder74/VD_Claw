document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const apiKeyInput = document.getElementById('apiKey');
    const saveKeyBtn = document.getElementById('saveKeyBtn');
    const resultSection = document.getElementById('resultSection');
    const usageInfo = document.getElementById('usageInfo');
    const output = document.getElementById('output');
    const standardOutput = document.getElementById('standardOutput');
    const copyBtn = document.getElementById('copyBtn');
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loaderText');
    const errorMessage = document.getElementById('errorMessage');
    const enhancedResults = document.getElementById('enhancedResults');
    const standardResults = document.getElementById('standardResults');
    const htmlTableContainer = document.getElementById('htmlTable');
    const textReportContainer = document.getElementById('textReport');

    // Tab Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));
            
            btn.classList.add('active');
            document.getElementById(tabId).classList.remove('hidden');
            resultSection.classList.add('hidden');
        });
    });

    // Result Tab Logic
    const resultTabBtns = document.querySelectorAll('.result-tab-btn');
    const resultTabContents = document.querySelectorAll('.result-tab-content');

    resultTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-result-tab');
            
            resultTabBtns.forEach(b => b.classList.remove('active'));
            resultTabContents.forEach(c => c.classList.add('hidden'));
            
            btn.classList.add('active');
            document.getElementById(`${tabId}-result`).classList.remove('hidden');
        });
    });

    // Load API Key from sessionStorage
    const savedKey = sessionStorage.getItem('openai_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        saveKeyBtn.textContent = 'Key Saved!';
        saveKeyBtn.style.backgroundColor = 'var(--success-color)';
    }

    // Save API Key
    saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            sessionStorage.setItem('openai_api_key', key);
            saveKeyBtn.textContent = 'Key Saved!';
            saveKeyBtn.style.backgroundColor = 'var(--success-color)';
            setTimeout(() => {
                saveKeyBtn.textContent = 'Save Key';
                saveKeyBtn.style.backgroundColor = 'var(--primary-color)';
            }, 2000);
        }
    });

    // Run Claw Functions
    async function runClaw(mode, payload) {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            showError('Please enter your OpenAI API Key first.');
            return;
        }

        hideError();
        showLoader(mode);
        resultSection.classList.add('hidden');

        try {
            const response = await fetch('api/claw.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode, apiKey, ...payload })
            });

            const result = await response.json();

            if (result.success) {
                displayResult(result);
            } else {
                showError(result.error || 'An unexpected error occurred.');
            }
        } catch (error) {
            showError('Failed to communicate with the server: ' + error.message);
        } finally {
            hideLoader();
        }
    }

    // Standard Mode
    document.getElementById('clawBtn').addEventListener('click', () => {
        const url = document.getElementById('targetUrl').value.trim();
        const prompt = document.getElementById('prompt').value.trim();
        if (!url || !prompt) return showError('URL and Prompt are required.');
        runClaw('standard', { url, prompt });
    });

    // Comparison Mode
    document.getElementById('compareBtn').addEventListener('click', () => {
        const urlInputs = document.querySelectorAll('.compare-url');
        const urls = Array.from(urlInputs).map(i => i.value.trim()).filter(u => u !== "");
        if (urls.length < 2) return showError('At least 2 URLs are required for comparison.');
        runClaw('cro', { urls });
    });

    // Enhanced Mode
    document.getElementById('enhancedBtn').addEventListener('click', () => {
        const url = document.getElementById('enhancedUrl').value.trim();
        const prompt = document.getElementById('enhancedPrompt').value.trim();
        if (!url) return showError('Target URL is required.');
        runClaw('enhanced', { url, prompt });
    });

    function displayResult(result) {
        resultSection.classList.remove('hidden');
        
        if (result.usage) {
            usageInfo.textContent = `Tokens used: ${result.usage.total_tokens} (Prompt: ${result.usage.prompt_tokens}, Completion: ${result.usage.completion_tokens})`;
        }

        if (result.mode === 'enhanced') {
            enhancedResults.classList.remove('hidden');
            standardResults.classList.add('hidden');
            
            output.textContent = JSON.stringify(result.data.json_data, null, 2);
            htmlTableContainer.innerHTML = result.data.html_table || '<p>No table generated.</p>';
            textReportContainer.textContent = result.data.text_report || 'No report generated.';
            
            // Default to JSON tab
            resultTabBtns[0].click();
        } else {
            enhancedResults.classList.add('hidden');
            standardResults.classList.remove('hidden');
            standardOutput.textContent = JSON.stringify(result.data, null, 2);
        }
    }

    function showLoader(mode) {
        loader.classList.remove('hidden');
        if (mode === 'cro') loaderText.textContent = "Comparing multiple pages... this may take a minute.";
        else if (mode === 'enhanced') loaderText.textContent = "Extracting and analyzing... please wait.";
        else loaderText.textContent = "Clawing data... please wait.";
        
        document.querySelectorAll('.run-btn').forEach(btn => btn.disabled = true);
    }

    function hideLoader() {
        loader.classList.add('hidden');
        document.querySelectorAll('.run-btn').forEach(btn => btn.disabled = false);
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
        window.scrollTo({ top: errorMessage.offsetTop, behavior: 'smooth' });
    }

    function hideError() {
        errorMessage.classList.add('hidden');
        errorMessage.textContent = '';
    }

    // Copy to clipboard
    copyBtn.addEventListener('click', () => {
        const text = standardResults.classList.contains('hidden') ? output.textContent : standardOutput.textContent;
        navigator.clipboard.writeText(text).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => copyBtn.textContent = originalText, 2000);
        });
    });
});
