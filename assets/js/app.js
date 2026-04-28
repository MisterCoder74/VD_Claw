document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const saveKeyBtn = document.getElementById('saveKeyBtn');
    const targetUrlInput = document.getElementById('targetUrl');
    const promptInput = document.getElementById('prompt');
    const clawBtn = document.getElementById('clawBtn');
    const resultSection = document.getElementById('resultSection');
    const usageInfo = document.getElementById('usageInfo');
    const output = document.getElementById('output');
    const copyBtn = document.getElementById('copyBtn');
    const loader = document.getElementById('loader');
    const errorMessage = document.getElementById('errorMessage');

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

    // Run Claw
    clawBtn.addEventListener('click', async () => {
        const url = targetUrlInput.value.trim();
        const apiKey = apiKeyInput.value.trim();
        const prompt = promptInput.value.trim();

        if (!url || !apiKey || !prompt) {
            showError('Please fill in all fields (URL, API Key, and Prompt).');
            return;
        }

        hideError();
        showLoader();
        resultSection.classList.add('hidden');

        try {
            const response = await fetch('api/claw.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url, apiKey, prompt })
            });

            const result = await response.json();

            if (result.success) {
                displayResult(result);
            } else {
                showError(result.error || 'An unexpected error occurred.');
            }
        } catch (error) {
            showError('Failed to communicate with the server. ' + error.message);
        } finally {
            hideLoader();
        }
    });

    // Copy to clipboard
    copyBtn.addEventListener('click', () => {
        const text = output.textContent;
        navigator.clipboard.writeText(text).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        });
    });

    function displayResult(result) {
        resultSection.classList.remove('hidden');
        output.textContent = JSON.stringify(result.data, null, 2);
        
        if (result.usage) {
            usageInfo.textContent = `Tokens used: ${result.usage.total_tokens} (Prompt: ${result.usage.prompt_tokens}, Completion: ${result.usage.completion_tokens})`;
        }
    }

    function showLoader() {
        loader.classList.remove('hidden');
        clawBtn.disabled = true;
    }

    function hideLoader() {
        loader.classList.add('hidden');
        clawBtn.disabled = false;
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    function hideError() {
        errorMessage.classList.add('hidden');
        errorMessage.textContent = '';
    }
});
