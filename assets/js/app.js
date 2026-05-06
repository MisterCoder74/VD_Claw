document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const apiKeyInput = document.getElementById('apiKey');
    const saveKeyBtn = document.getElementById('saveKeyBtn');
    const resultSection = document.getElementById('resultSection');
    const usageInfo = document.getElementById('usageInfo');
    const outputJson = document.getElementById('outputJson');
    const htmlTable = document.getElementById('htmlTable');
    const htmlReport = document.getElementById('htmlReport');
    const mdReport = document.getElementById('mdReport');
    
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loaderText');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');

    let currentResultData = null;

    // Tab Logic (Main)
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
    const resTabBtns = document.querySelectorAll('.res-tab-btn');
    const resTabContents = document.querySelectorAll('.res-tab-content');

    resTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-res-tab');
            resTabBtns.forEach(b => b.classList.remove('active'));
            resTabContents.forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(`${tabId}-res-content`).classList.remove('hidden');
        });
    });

    // Load/Save API Key
    const savedKey = sessionStorage.getItem('openai_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        saveKeyBtn.textContent = 'Key Saved';
        saveKeyBtn.classList.add('btn-success');
    }

    saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            sessionStorage.setItem('openai_api_key', key);
            saveKeyBtn.textContent = 'Key Saved';
            setTimeout(() => saveKeyBtn.textContent = 'Save Key', 2000);
        }
    });

    // Run Claw Functions
    async function runClaw(mode, payload) {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) return showError('Please enter your OpenAI API Key.');

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
            showError('Communication error: ' + error.message);
        } finally {
            hideLoader();
        }
    }

    // Handlers
    document.getElementById('clawBtn').addEventListener('click', () => {
        const url = document.getElementById('targetUrl').value.trim();
        const prompt = document.getElementById('prompt').value.trim();
        if (!url || !prompt) return showError('URL and Prompt are required.');
        runClaw('standard', { url, prompt });
    });

    document.getElementById('compareBtn').addEventListener('click', () => {
        const urlInputs = document.querySelectorAll('.compare-url');
        const urls = Array.from(urlInputs).map(i => i.value.trim()).filter(u => u !== "");
        if (urls.length < 2) return showError('At least 2 URLs are required for comparison.');
        runClaw('cro', { urls });
    });

    document.getElementById('enhancedBtn').addEventListener('click', () => {
        const url = document.getElementById('enhancedUrl').value.trim();
        const prompt = document.getElementById('enhancedPrompt').value.trim();
        if (!url) return showError('Target URL is required.');
        runClaw('enhanced', { url, prompt });
    });

    document.getElementById('localBtn').addEventListener('click', () => {
        const fileInput = document.getElementById('localFile');
        const prompt = document.getElementById('localPrompt').value.trim();
        
        if (!fileInput.files.length) return showError('Please select a file to analyze.');
        if (!prompt) return showError('Please provide instructions for the analysis.');

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = async (e) => {
            const fileContent = e.target.result;
            runClaw('local', { 
                fileContent, 
                fileName: file.name, 
                prompt 
            });
        };

        reader.onerror = () => showError('Failed to read local file.');
        reader.readAsText(file);
    });

    document.getElementById('leadgenBtn').addEventListener('click', () => {
        const url = document.getElementById('leadgenUrl').value.trim();
        const service = document.getElementById('leadgenService').value.trim();
        if (!url) return showError('Prospect URL is required.');
        runClaw('leadgen', { url, service });
    });

    function displayResult(result) {
        currentResultData = result.data;
        resultSection.classList.remove('hidden');
        
        if (result.usage) {
            usageInfo.textContent = `Neural Tokens: ${result.usage.total_tokens} (P: ${result.usage.prompt_tokens}, C: ${result.usage.completion_tokens})`;
        }

        const data = result.data;
        outputJson.textContent = JSON.stringify(data.json_data, null, 2);
        htmlTable.innerHTML = data.html_table || '<p class="text-muted">No visual table generated for this mode.</p>';
        htmlReport.innerHTML = data.html_report || '<p class="text-muted">No HTML report generated.</p>';
        
        if (data.md_report) {
            mdReport.innerHTML = marked.parse(data.md_report);
        } else {
            mdReport.innerHTML = '<p class="text-muted">No Markdown report generated.</p>';
        }

        // Auto-switch to best tab
        if (data.html_report) resTabBtns[2].click();
        else if (data.html_table) resTabBtns[1].click();
        else resTabBtns[0].click();

        window.scrollTo({ top: resultSection.offsetTop - 50, behavior: 'smooth' });
    }

    // Export Functions
    function downloadFile(content, fileName, contentType) {
        const a = document.createElement("a");
        const file = new Blob([content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    document.getElementById('exportJson').addEventListener('click', () => {
        if (!currentResultData) return;
        downloadFile(JSON.stringify(currentResultData.json_data, null, 2), 'vd-claw-export.json', 'application/json');
    });

    document.getElementById('exportMd').addEventListener('click', () => {
        if (!currentResultData || !currentResultData.md_report) return;
        downloadFile(currentResultData.md_report, 'vd-claw-report.md', 'text/markdown');
    });

    document.getElementById('exportHtml').addEventListener('click', () => {
        if (!currentResultData || (!currentResultData.html_report && !currentResultData.html_table)) return;
        // Wrap HTML report in a full document structure for download
        let combinedHtml = currentResultData.html_report || '';
        if (currentResultData.html_table) {
            combinedHtml = `<h2>Data Table</h2>${currentResultData.html_table}<hr>${combinedHtml}`;
        }
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>VD Claw Report</title><style>body{font-family:sans-serif;line-height:1.6;padding:2rem;max-width:900px;margin:0 auto;}table{width:100%;border-collapse:collapse;margin:1rem 0;}th,td{border:1px solid #ddd;padding:12px;text-align:left;}th{background:#f8f9fa;font-weight:bold;}</style></head><body>${combinedHtml}</body></html>`;
        downloadFile(fullHtml, 'vd-claw-report.html', 'text/html');
    });

    document.getElementById('copyJsonBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(outputJson.textContent).then(() => {
            const btn = document.getElementById('copyJsonBtn');
            btn.innerHTML = '<i class="fas fa-check"></i> Copied';
            setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i> Copy', 2000);
        });
    });

    // Helpers
    function showLoader(mode) {
        loader.classList.remove('hidden');
        const texts = {
            'standard': 'Initiating Neural Scan...',
            'cro': 'Comparing Multiple Entities...',
            'enhanced': 'Deep Extraction in Progress...',
            'local': 'Analyzing Local Neural Pattern...',
            'leadgen': 'Analyzing Prospect & Crafting Pitch...'
        };
        loaderText.textContent = texts[mode] || 'Processing...';
        document.querySelectorAll('.run-btn').forEach(btn => btn.disabled = true);
    }

    function hideLoader() {
        loader.classList.add('hidden');
        document.querySelectorAll('.run-btn').forEach(btn => btn.disabled = false);
    }

    function showError(msg) {
        errorText.textContent = msg;
        errorMessage.classList.remove('hidden');
        window.scrollTo({ top: errorMessage.offsetTop - 50, behavior: 'smooth' });
    }

    function hideError() {
        errorMessage.classList.add('hidden');
    }
});
