/**
 * Judge Agent — Frontend JavaScript
 * Handles form submission, API calls, and result rendering.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Element references ---
    const judgeForm = document.getElementById('judgeForm');
    const judgeBtn = document.getElementById('judgeBtn');
    const previewBtn = document.getElementById('previewBtn');
    const calibrationBtn = document.getElementById('calibrationBtn');
    const backBtn = document.getElementById('backBtn');
    const retryBtn = document.getElementById('retryBtn');
    const toggleJsonBtn = document.getElementById('toggleJson');

    const inputPanel = document.getElementById('inputPanel');
    const resultsPanel = document.getElementById('resultsPanel');
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const resultsContent = document.getElementById('resultsContent');
    const extractionPreview = document.getElementById('extractionPreview');

    const ideaText = document.getElementById('ideaText');
    const ideaWordCount = document.getElementById('ideaWordCount');
    const pptFile = document.getElementById('pptFile');
    const fileDropZone = document.getElementById('fileDropZone');
    const fileSelected = document.getElementById('fileSelected');
    const fileNameEl = document.getElementById('fileName');
    const fileRemove = document.getElementById('fileRemove');
    const enableResearch = document.getElementById('enableResearch');
    const modelSelect = document.getElementById('modelSelect');

    // --- Word counter ---
    ideaText.addEventListener('input', () => {
        const words = ideaText.value.trim().split(/\s+/).filter(w => w.length > 0);
        ideaWordCount.textContent = `${words.length} word${words.length !== 1 ? 's' : ''}`;
    });

    // --- File upload handling ---
    pptFile.addEventListener('change', () => {
        if (pptFile.files.length > 0) {
            showSelectedFile(pptFile.files[0].name);
        }
    });

    fileRemove.addEventListener('click', (e) => {
        e.stopPropagation();
        pptFile.value = '';
        fileSelected.style.display = 'none';
        document.querySelector('.file-upload-content').style.display = '';
    });

    // Drag and drop
    ['dragenter', 'dragover'].forEach(evt => {
        fileDropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            fileDropZone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        fileDropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            fileDropZone.classList.remove('dragover');
        });
    });

    fileDropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            const ext = file.name.split('.').pop().toLowerCase();
            if (['pptx', 'docx'].includes(ext)) {
                pptFile.files = files;
                showSelectedFile(file.name);
            }
        }
    });

    function showSelectedFile(name) {
        fileNameEl.textContent = name;
        fileSelected.style.display = 'flex';
        document.querySelector('.file-upload-content').style.display = 'none';
    }

    // --- Navigation ---
    function showResults() {
        inputPanel.style.display = 'none';
        resultsPanel.style.display = '';
        resultsPanel.style.animation = 'none';
        resultsPanel.offsetHeight; // Force reflow
        resultsPanel.style.animation = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showInput() {
        resultsPanel.style.display = 'none';
        inputPanel.style.display = '';
        inputPanel.style.animation = 'none';
        inputPanel.offsetHeight;
        inputPanel.style.animation = '';
    }

    function showLoading() {
        loadingState.style.display = '';
        errorState.style.display = 'none';
        resultsContent.style.display = 'none';
        extractionPreview.style.display = 'none';
    }

    function showError(message) {
        loadingState.style.display = 'none';
        errorState.style.display = '';
        resultsContent.style.display = 'none';
        extractionPreview.style.display = 'none';
        document.getElementById('errorText').textContent = message;
    }

    function showResultsContent() {
        loadingState.style.display = 'none';
        errorState.style.display = 'none';
        resultsContent.style.display = '';
        extractionPreview.style.display = 'none';
    }

    function showExtraction() {
        loadingState.style.display = 'none';
        errorState.style.display = 'none';
        resultsContent.style.display = 'none';
        extractionPreview.style.display = '';
    }

    backBtn.addEventListener('click', showInput);
    retryBtn.addEventListener('click', showInput);

    // --- Form submission: Judge ---
    judgeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitJudgment('/api/judge');
    });

    // --- Calibration test ---
    calibrationBtn.addEventListener('click', async () => {
        showResults();
        showLoading();
        document.getElementById('resultsTitle').textContent = 'Calibration Test';

        const formData = new FormData();
        formData.append('model', modelSelect.value);

        try {
            const response = await fetch('/api/test', { method: 'POST', body: formData });
            const data = await response.json();

            if (data.error) {
                showError(data.error);
                return;
            }

            renderResults(data);
            showResultsContent();
        } catch (err) {
            showError(`Network error: ${err.message}`);
        }
    });

    // --- Preview extraction ---
    previewBtn.addEventListener('click', async () => {
        showResults();
        showLoading();
        document.getElementById('resultsTitle').textContent = 'Extraction Preview';

        const formData = buildFormData();

        try {
            const response = await fetch('/api/extract', { method: 'POST', body: formData });
            const data = await response.json();

            if (data.error) {
                showError(data.error);
                return;
            }

            const meta = document.getElementById('extractionMeta');
            meta.textContent = `Sources: ${data.inputs_used.join(', ')} | ${data.word_count} words`;

            document.getElementById('extractionContent').textContent = data.extracted_text || '(No text extracted)';
            showExtraction();
        } catch (err) {
            showError(`Network error: ${err.message}`);
        }
    });

    // --- Toggle raw JSON ---
    toggleJsonBtn.addEventListener('click', () => {
        const output = document.getElementById('jsonOutput');
        const isVisible = output.style.display !== 'none';
        output.style.display = isVisible ? 'none' : '';
        toggleJsonBtn.textContent = isVisible ? 'Show Raw JSON' : 'Hide Raw JSON';
    });

    // --- Core submission logic ---
    async function submitJudgment(endpoint) {
        showResults();
        showLoading();
        document.getElementById('resultsTitle').textContent = 'Evaluation Report';

        const formData = buildFormData();

        // Validate at least one input
        if (!ideaText.value.trim() && (!pptFile.files || pptFile.files.length === 0)) {
            showError('At least one input is required: idea description or pitch deck file.');
            return;
        }

        judgeBtn.disabled = true;

        try {
            const response = await fetch(endpoint, { method: 'POST', body: formData });
            const data = await response.json();

            if (data.error) {
                showError(data.error);
                return;
            }

            renderResults(data);
            showResultsContent();
        } catch (err) {
            showError(`Network error: ${err.message}`);
        } finally {
            judgeBtn.disabled = false;
        }
    }

    function buildFormData() {
        const formData = new FormData();
        formData.append('model', modelSelect.value);
        formData.append('idea_text', ideaText.value.trim());
        formData.append('enable_research', enableResearch.checked ? 'true' : 'false');

        if (pptFile.files && pptFile.files.length > 0) {
            formData.append('ppt_file', pptFile.files[0]);
        }

        return formData;
    }

    // --- Render results ---
    function renderResults(data) {
        // Warnings
        const warningsSection = document.getElementById('warningsSection');
        const warningsList = document.getElementById('warningsList');
        if (data.warnings && data.warnings.length > 0) {
            warningsList.innerHTML = data.warnings.map(w => `<div>${w}</div>`).join('');
            warningsSection.style.display = '';
        } else {
            warningsSection.style.display = 'none';
        }

        // Calibration note
        const calibrationNote = document.getElementById('calibrationNote');
        if (data.calibration_note) {
            document.getElementById('calibrationText').textContent = data.calibration_note;
            calibrationNote.style.display = '';
        } else {
            calibrationNote.style.display = 'none';
        }

        // Inputs used
        const inputsUsed = document.getElementById('inputsUsed');
        const inputLabels = { idea: 'Idea', ppt: 'Deck', repo: 'Repo' };
        inputsUsed.innerHTML = (data.inputs_used || []).map(input =>
            `<span class="input-tag"><span class="input-tag-dot"></span>${inputLabels[input] || input}</span>`
        ).join('');

        // Scores
        const scoresGrid = document.getElementById('scoresGrid');
        const dimensionLabels = {
            idea_innovation: 'Idea / Innovation',
            technical_feasibility: 'Technical Feasibility',
            scalability: 'Scalability',
            relatability_market_fit: 'Market Fit',
            execution_clarity: 'Execution Clarity',
            presentation_clarity: 'Presentation Clarity'
        };

        const scores = data.scores || {};
        let scoreSum = 0;
        let scoreCount = 0;

        scoresGrid.innerHTML = Object.entries(dimensionLabels).map(([key, label]) => {
            const entry = scores[key] || {};
            const score = entry.score || 0;
            const justification = entry.justification || 'N/A';
            scoreSum += score;
            scoreCount++;

            const colorClass = score <= 3 ? 'score-low' :
                               score <= 5 ? 'score-mid' :
                               score <= 7 ? 'score-good' : 'score-great';

            return `
                <div class="score-card ${colorClass}">
                    <div class="score-header">
                        <span class="score-label">${label}</span>
                        <span class="score-value">${score}/10</span>
                    </div>
                    <div class="score-bar-container">
                        <div class="score-bar-fill" style="width: ${score * 10}%"></div>
                    </div>
                    <div class="score-justification">${escapeHtml(justification)}</div>
                </div>
            `;
        }).join('');

        // Animate score bars after render
        requestAnimationFrame(() => {
            document.querySelectorAll('.score-bar-fill').forEach(bar => {
                const width = bar.style.width;
                bar.style.width = '0%';
                requestAnimationFrame(() => {
                    bar.style.width = width;
                });
            });
        });

        // Average score
        const avg = scoreCount > 0 ? (scoreSum / scoreCount) : 0;
        const avgColorClass = avg <= 3 ? 'score-low' :
                              avg <= 5 ? 'score-mid' :
                              avg <= 7 ? 'score-good' : 'score-great';
        document.getElementById('averageScore').innerHTML = `
            <span class="average-label">Overall Average</span>
            <span class="average-value ${avgColorClass}">${avg.toFixed(1)}/10</span>
        `;

        // Questions
        const questionsList = document.getElementById('questionsList');
        const questions = data.questions || [];
        questionsList.innerHTML = questions.map((q, i) => {
            const diffClass = `diff-${(q.difficulty || '').replace(/\s+/g, '-')}`;
            return `
                <div class="question-card ${diffClass}">
                    <div class="question-number">Q${i + 1}</div>
                    <div class="question-body">
                        <div class="question-difficulty">${escapeHtml(q.difficulty || '')}</div>
                        <div class="question-text">${escapeHtml(q.question || '')}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Readiness summary
        document.getElementById('readinessSummary').textContent = data.readiness_summary || 'N/A';

        // Raw JSON
        document.getElementById('jsonOutput').textContent = JSON.stringify(data, null, 2);
        document.getElementById('jsonOutput').style.display = 'none';
        toggleJsonBtn.textContent = 'Show Raw JSON';
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
});
