document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const homeSection = document.getElementById('home');
    const journalAppSection = document.getElementById('journal-app-section');
    const journalEditorView = document.getElementById('journal-editor-view');
    const chapterDetailsView = document.getElementById('chapter-details-view');
    const memoryBoxSection = document.getElementById('memory-box-section');

    const mainTitle = document.getElementById('main-title'); // Main title of the app section

    const journalTitleInput = document.getElementById('journal-title');
    const journalTextInput = document.getElementById('journal-text');
    const imageInput = document.getElementById('image-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const clearImageButton = document.getElementById('clear-image-button');
    const enhanceButton = document.getElementById('enhance-button');
    const saveButton = document.getElementById('save-button');
    const clearButton = document.getElementById('clear-button');
    const enhancedTextDisplay = document.getElementById('enhanced-text-output');

    // Chapter Details View Elements
    const chapterTitleDisplay = document.getElementById('chapter-title-display');
    const chapterDateTime = document.getElementById('chapter-date-time');
    const chapterImage = document.getElementById('chapter-image');
    const chapterImageContainer = document.getElementById('chapter-image-container');
    const chapterOriginalText = document.getElementById('chapter-original-text');
    const chapterDText = document.getElementById('chapter-d-text');
    const viewSavedFileButton = document.getElementById('view-saved-file-button');
    const backToEditorButton = document.getElementById('back-to-editor-button'); // From details view

    // Memory Box Section Elements
    const showMemoriesButton = document.getElementById('show-memories-button'); // Button on intro page
    const chapterList = document.getElementById('chapter-list'); // Container for memory cards
    const noMemoriesMessage = document.getElementById('no-memories-message');
    const backToEditorFromMemoriesButton = document.getElementById('back-to-editor-from-memories-button');

    // Modal Elements
    const messageModal = document.getElementById('message-modal');
    const modalMessage = document.getElementById('modal-message');
    const modalOkButton = document.getElementById('modal-ok-button');

    let currentImageBase64 = null; // To store the base64 string of the image

    // --- View Switching Logic ---
    // This function controls which main section of the app is visible
    function showView(viewId) {
        // Always hide the initial home section once we've moved past it
        homeSection.classList.add('hidden');

        // By default, ensure both journalAppSection (editor/details) and memoryBoxSection (list of memories) are visible.
        // Their relative positioning will be handled by HTML structure and CSS (flex/grid/block).
        journalAppSection.classList.remove('hidden');
        memoryBoxSection.classList.remove('hidden');

        // Now, manage the views *within* the journalAppSection
        if (viewId === 'editor') {
            journalEditorView.classList.remove('hidden');
            chapterDetailsView.classList.add('hidden');
            mainTitle.textContent = "My Daily Journal"; // Title for the editor section
            window.scrollTo({ top: journalAppSection.offsetTop, behavior: 'smooth' }); // Scroll to the editor
        } else if (viewId === 'details') {
            journalEditorView.classList.add('hidden');
            chapterDetailsView.classList.remove('hidden');
            mainTitle.textContent = "Memory Details"; // Title for the details section
            window.scrollTo({ top: journalAppSection.offsetTop, behavior: 'smooth' }); // Scroll to details
        } else if (viewId === 'memories_only_scroll') {
            // This case is specifically for when the user clicks a button to go *directly* to memories
            // It ensures the editor/details are in their default state (editor) but prioritizes scrolling.
            journalEditorView.classList.remove('hidden'); // Ensure editor is visible above memories
            chapterDetailsView.classList.add('hidden');
            mainTitle.textContent = "My Daily Journal"; // Keep editor title
            window.scrollTo({ top: memoryBoxSection.offsetTop, behavior: 'smooth' }); // Scroll to the memories section
        }
        // If viewId is not 'editor' or 'details' (e.g., when calling fetchAndDisplayMemories),
        // we just ensure both main sections are visible and don't change the sub-view within journalAppSection.
    }

    // --- Modal Functions ---
    function showModal(message) {
        modalMessage.textContent = message;
        messageModal.classList.remove('hidden');
    }

    modalOkButton.addEventListener('click', () => {
        messageModal.classList.add('hidden');
    });

    // --- Image Handling ---
    imageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreviewContainer.classList.remove('hidden');
                clearImageButton.classList.remove('hidden');
                currentImageBase64 = e.target.result; // Store base64
            };
            reader.readAsDataURL(file);
        } else {
            imagePreview.src = '';
            imagePreviewContainer.classList.add('hidden');
            clearImageButton.classList.add('hidden');
            currentImageBase64 = null;
        }
    });

    clearImageButton.addEventListener('click', () => {
        imageInput.value = ''; // Clear the file input
        imagePreview.src = '';
        imagePreviewContainer.classList.add('hidden');
        clearImageButton.classList.add('hidden');
        currentImageBase64 = null;
    });

    // --- Journal Entry Enhancement ---
    enhanceButton.addEventListener('click', async () => {
        const journalText = journalTextInput.value.trim();
        if (!journalText) {
            showModal('Please write something in your journal before enhancing! 🤔');
            return;
        }

        enhanceButton.disabled = true;
        document.getElementById('enhance-spinner').classList.remove('hidden');
        document.getElementById('enhance-icon').classList.add('hidden');

        try {
            const response = await fetch('/enhance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ journalText: journalText }),
            });

            const data = await response.json();

            if (response.ok) {
                enhancedTextDisplay.textContent = data.enhancedText;
                showModal('Journal enhanced successfully! ✨');
            } else {
                showModal(`Error enhancing journal: ${data.error} 😔`);
            }
        } catch (error) {
            console.error('Error:', error);
            showModal('Could not connect to the AI server. Is Ollama running? 🖥️');
        } finally {
            enhanceButton.disabled = false;
            document.getElementById('enhance-spinner').classList.add('hidden');
            document.getElementById('enhance-icon').classList.remove('hidden');
        }
    });

    // --- Save Journal Entry ---
    saveButton.addEventListener('click', async () => {
        const title = journalTitleInput.value.trim();
        const originalText = journalTextInput.value.trim();
        const enhancedText = enhancedTextDisplay.textContent.trim();

        if (!title || !originalText) {
            showModal('Please provide a title and some original text for your memory. 📝');
            return;
        }

        saveButton.disabled = true;
        document.getElementById('save-spinner').classList.remove('hidden');
        document.getElementById('save-icon').classList.add('hidden');

        try {
            const response = await fetch('/save_entry', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: title,
                    originalText: originalText,
                    enhancedText: enhancedText === 'Your enhanced journal will appear here.' ? '' : enhancedText, // Don't save placeholder text
                    imageUrl: currentImageBase64 || null // Send base64 image data
                }),
            });

            const result = await response.json();

            if (response.ok) {
                showModal(result.message);
                // Clear the editor fields after successful save
                journalTitleInput.value = '';
                journalTextInput.value = '';
                enhancedTextDisplay.textContent = 'Your enhanced journal will appear here.';
                // Clear image preview
                imageInput.value = '';
                imagePreview.src = '';
                imagePreviewContainer.classList.add('hidden');
                clearImageButton.classList.add('hidden');
                currentImageBase64 = null;

                // After saving, re-fetch and display memories.
                // This will NOT hide the editor, just update the memories section below it.
                await fetchAndDisplayMemories();
                // Optionally, scroll to the memories section to show the newly added entry
                window.scrollTo({ top: memoryBoxSection.offsetTop, behavior: 'smooth' });
            } else {
                console.error('Error saving entry:', result.error);
                showModal(`Error: ${result.error}`);
            }
        } catch (error) {
            console.error('Network or other error saving entry:', error);
            showModal('Failed to save journal entry. Please check your connection and try again. 😞');
        } finally {
            saveButton.disabled = false;
            document.getElementById('save-spinner').classList.add('hidden');
            document.getElementById('save-icon').classList.remove('hidden');
        }
    });

    // --- Clear All Fields ---
    clearButton.addEventListener('click', () => {
        journalTitleInput.value = '';
        journalTextInput.value = '';
        enhancedTextDisplay.textContent = 'Your enhanced journal will appear here.';
        imageInput.value = '';
        imagePreview.src = '';
        imagePreviewContainer.classList.add('hidden');
        clearImageButton.classList.add('hidden');
        currentImageBase64 = null;
        showModal('Editor cleared! Ready for a new memory. ✍️');
    });

    // --- Fetch and Display Memories (Core function for showing saved entries) ---
    async function fetchAndDisplayMemories() {
        // We no longer call showView('memories') here, as showView now ensures both sections are visible
        chapterList.innerHTML = ''; // Clear existing memories to prevent duplicates
        noMemoriesMessage.classList.add('hidden'); // Hide "No memories" message initially

        try {
            const response = await fetch('/get_entries'); // Call your Flask backend's /get_entries
            const entries = await response.json();

            if (response.ok) {
                if (entries.length === 0) {
                    noMemoriesMessage.classList.remove('hidden'); // Show message if no entries
                } else {
                    entries.forEach(entry => {
                        const chapterItem = document.createElement('div');
                        chapterItem.classList.add('chapter-list-item'); // Apply your custom styling
                        chapterItem.dataset.id = entry._id; // Store MongoDB ID for detail view

                        // Image handling: use entry.imageUrl or a placeholder
                        const imageHtml = entry.imageUrl
                            ? `<img src="${entry.imageUrl}" alt="${entry.title}" class="chapter-image">`
                            : `<img src="https://placehold.co/400x200/e0e0e0/555555?text=No+Image" alt="No Image" class="chapter-image">`;

                        // Construct the HTML for a single memory card
                        chapterItem.innerHTML = `
                            ${imageHtml}
                            <div class="content">
                                <h3 class="title">${entry.title}</h3>
                            </div>
                            <p class="date">${entry.date} ${entry.time}</p>
                        `;
                        chapterList.appendChild(chapterItem); // Append to the #chapter-list div

                        // Add click listener to each card to show its full details
                        chapterItem.addEventListener('click', () => showChapterDetails(entry));
                    });
                }
            } else {
                console.error('Error fetching memories from server:', entries.error);
                showModal(`Error fetching memories: ${entries.error} 💔`);
            }
        } catch (error) {
            console.error('Network error during memory fetch:', error);
            showModal('Failed to load memories. Check your connection. 😔');
        }
    }

    // --- Show Chapter Details ---
    function showChapterDetails(entry) {
        showView('details'); // Switch to details view (within journalAppSection)

        chapterTitleDisplay.textContent = entry.title;
        chapterDateTime.textContent = `${entry.date} ${entry.time}`;
        chapterOriginalText.textContent = entry.originalText;
        chapterDText.textContent = entry.enhancedText || 'No AI enhancement provided.';

        if (entry.imageUrl) {
            chapterImage.src = entry.imageUrl;
            chapterImageContainer.classList.remove('hidden');
        } else {
            chapterImage.src = ''; // Clear any previous image
            chapterImageContainer.classList.add('hidden');
        }

        // Set the download link for the text file
        if (entry.fileName) {
            viewSavedFileButton.href = `/get_memory_file/${entry.fileName}`;
            viewSavedFileButton.classList.remove('hidden');
        } else {
            viewSavedFileButton.href = '#';
            viewSavedFileButton.classList.add('hidden');
        }
    }
    

    // ... (inside DOMContentLoaded listener) ...
    
    if (deleteAllMemoriesButton) {
        deleteAllMemoriesButton.addEventListener('click', async () => {
            if (!confirm("Are you sure you want to delete ALL your memories? This cannot be undone.")) {
                return; // User cancelled
            }
    
            try {
                const response = await fetch('/delete_all_entries', {
                    method: 'DELETE',
                });
                const result = await response.json();
    
                if (response.ok) {
                    showModal(result.message);
                    // After deleting, refresh the memories list (which will now be empty)
                    await fetchAndDisplayMemories();
                } else {
                    showModal(`Error deleting memories: ${result.error} 💔`);
                }
            } catch (error) {
                console.error('Network error during delete all operation:', error);
                showModal('Failed to connect to the server to delete memories. 😞');
            }
        });
    }
    // --- Event Listeners for Navigation ---

    // Scroll to Journal App Section from Intro Page (via arrow)
    document.querySelector('.scroll-down-arrow').addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default anchor link behavior
        showView('editor'); // Show the editor (and implicitly the memories section below it)
    });

    // "My Memories" button on the intro page (will now scroll to memories but keep editor visible)
    showMemoriesButton.addEventListener('click', async () => {
        await fetchAndDisplayMemories(); // Fetch and display memories
        showView('memories_only_scroll'); // Use a new state to just scroll, keeping editor visible
    });

    // "Back to Journal Editor" button from Chapter Details View (only affects journalAppSection)
    backToEditorButton.addEventListener('click', () => {
        showView('editor');
    });

    // "Back to Journal Editor" button from Memories List View (now scrolls to top, keeping both visible)
    if (backToEditorFromMemoriesButton) { // Check if element exists before adding listener
        backToEditorFromMemoriesButton.addEventListener('click', () => {
            showView('editor'); // Just sets the journalAppSection to editor view and scrolls there
        });
    }

    // --- Initial Load ---
    // Start by showing the home/intro page by default when the page loads
    // Once the user interacts (e.g., clicks the arrow), both editor and memories sections will appear.
    showView('home');

    // Pre-fill enhanced text output with placeholder
    enhancedTextDisplay.textContent = 'Your enhanced journal will appear here.';

    // *** IMPORTANT: After the initial view is set, fetch and display existing memories. ***
    // This ensures the memories section is populated as soon as the main content becomes visible.
    // We do this *outside* `showView('home')` so it doesn't try to load immediately if `home` is shown.
    // It will run as soon as DOM is ready, and then when `showView('editor')` is called,
    // both sections will already be prepared.
    fetchAndDisplayMemories();
});