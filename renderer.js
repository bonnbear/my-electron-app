// renderer.js
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const selectDirBtn = document.getElementById('select-dir-btn');
    const storagePathInput = document.getElementById('storage-path');
    const dataForm = document.getElementById('data-form');
    const nameInput = document.getElementById('name');
    const accountInput = document.getElementById('account');
    const passwordInput = document.getElementById('password');
    const dataList = document.getElementById('data-list');
    const importJsonBtn = document.getElementById('import-json-btn');
    const importCsvBtn = document.getElementById('import-csv-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const searchInput = document.getElementById('search-input');
    const imageSection = document.getElementById('image-section');
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxClose = document.getElementById('lightbox-close');
    const imageContainer = document.getElementById('image-container');
    const imagePlaceholder = document.getElementById('image-placeholder');
    const entryImage = document.getElementById('entry-image');
    const importImageBtn = document.getElementById('import-image-btn');
    const deleteImageBtn = document.getElementById('delete-image-btn');
    const detailsModal = document.getElementById('details-modal');
    const closeDetailsBtn = document.getElementById('close-details-btn');
    const detailsName = document.getElementById('details-name');
    const detailsAccount = document.getElementById('details-account');
    const detailsPassword = document.getElementById('details-password');
    const detailsImage = document.getElementById('details-image');
    const copyPasswordBtn = document.getElementById('copy-password-btn');
    const settingsBtn = document.getElementById('settings-btn');
   const settingsModal = document.getElementById('settings-modal');
   const closeSettingsBtn = document.getElementById('close-settings-btn');
   const setPasswordBtn = document.getElementById('set-password-btn');
   const removePasswordBtn = document.getElementById('remove-password-btn');
   const masterPasswordModal = document.getElementById('master-password-modal');
   const masterPasswordForm = document.getElementById('master-password-form');
   const masterPasswordInput = document.getElementById('master-password-input');
   const masterPasswordError = document.getElementById('master-password-error');
   const masterPasswordTitle = document.getElementById('master-password-title');
   const confirmPasswordGroup = document.getElementById('confirm-password-group');
   const masterPasswordConfirm = document.getElementById('master-password-confirm');
   const masterPasswordSubmit = document.getElementById('master-password-submit');

    // App State
    let data = [];
    let storagePath = localStorage.getItem('storagePath') || null;
    let selectedItemId = null;
    let masterPassword = null;
    let passwordPromptCallback = null;

    // --- Functions ---

    // Render data list to the UI
    function renderDataList() {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredData = data.filter(item =>
            item.name.toLowerCase().includes(searchTerm) ||
            item.account.toLowerCase().includes(searchTerm)
        );

        dataList.innerHTML = ''; // Clear
        if (filteredData.length === 0) {
            dataList.innerHTML = '<p>找不到符合條件的資料。</p>';
            return;
        }
        filteredData.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'data-item';
            itemDiv.dataset.id = item.id;
            itemDiv.innerHTML = `
                <h3>${item.name}</h3>
                <p>帳號: ${item.account}</p>
                <div class="item-buttons">
                    <button class="view-details-btn">查看詳情</button>
                    <button class="edit-btn">編輯</button>
                </div>
            `;
            // Handle clicks on the main item area for selection
            itemDiv.addEventListener('click', (e) => {
                // Prevent buttons from triggering the main item click
                if (e.target.tagName === 'BUTTON') return;

                selectedItemId = item.id;
                renderDataList(); // Re-render to show selection
                displayImage(item.image);
            });

            // Add event listeners for new buttons
            const viewDetailsBtn = itemDiv.querySelector('.view-details-btn');
            viewDetailsBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent parent click event
                showDetails(item);
            });

            const editBtn = itemDiv.querySelector('.edit-btn');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent parent click event
                populateFormForEdit(item);
            });

            if (item.id === selectedItemId) {
                itemDiv.classList.add('selected');
            }
            dataList.appendChild(itemDiv);
        });
    }

    // Display image in the image section
    function displayImage(imagePath) {
        imageSection.classList.remove('hidden');
        if (imagePath) {
            const imageName = imagePath.split(/[\\/]/).pop();
            entryImage.src = `safe-file://${storagePath}/images/${imageName}`;
            entryImage.classList.remove('hidden');
            imagePlaceholder.classList.add('hidden');
        } else {
            entryImage.classList.add('hidden');
            imagePlaceholder.classList.remove('hidden');
        }
    }

    // Load data from file
   async function loadData() {
       if (!storagePath) {
           storagePathInput.value = '';
           return;
       }
       storagePathInput.value = storagePath;
       await window.electronAPI.setStoragePath(storagePath); // Sync path with main process

       const hasPassword = await window.electronAPI.checkPassword();
       if (hasPassword) {
           promptForPassword('請輸入主密碼以解鎖', async (password) => {
               const result = await window.electronAPI.getData(password);
               if (result.success) {
                   masterPassword = password;
                   data = result.data;
                   renderDataList();
                   masterPasswordModal.classList.add('hidden');
               } else {
                   masterPasswordError.textContent = result.error || '密碼錯誤';
               }
           });
       } else {
           const result = await window.electronAPI.getData(null);
           if (result.success) {
               data = result.data;
               renderDataList();
           } else {
               alert(`讀取資料失敗: ${result.error}`);
           }
       }
   }

    // Save data to file
   async function saveData() {
       if (!storagePath) {
           alert('請先選擇儲存目錄！');
           return;
       }
       const result = await window.electronAPI.saveData(masterPassword, data);
       if (!result.success) {
           alert(`儲存資料失敗: ${result.error}`);
       }
   }

    // Show all details of an item in the modal
    function showDetails(item) {
        detailsName.textContent = `名稱: ${item.name}`;
        detailsAccount.textContent = `帳號: ${item.account}`;
        detailsPassword.textContent = `密碼: ${item.password}`;

        // Store the raw password in a data attribute for the copy button
        copyPasswordBtn.dataset.password = item.password;

        if (item.image) {
            const imageName = item.image.split(/[\\/]/).pop();
            detailsImage.src = `safe-file://${storagePath}/images/${imageName}`;
            detailsImage.style.display = 'block';
        } else {
            detailsImage.src = '';
            detailsImage.style.display = 'none';
        }

        detailsModal.classList.remove('hidden');
    }

    // Populate the form with item data for editing
    function populateFormForEdit(item) {
        document.getElementById('entry-id').value = item.id;
        nameInput.value = item.name;
        accountInput.value = item.account;
        passwordInput.value = item.password;
        document.getElementById('form-title').textContent = '編輯資料';
        document.getElementById('save-btn').textContent = '更新資料';
    }


   function promptForPassword(title, callback) {
       masterPasswordTitle.textContent = title;
       masterPasswordError.textContent = '';
       masterPasswordInput.value = '';
       masterPasswordConfirm.value = '';
       confirmPasswordGroup.style.display = 'none';
       masterPasswordModal.classList.remove('hidden');
       passwordPromptCallback = callback;
   }

    // --- Event Listeners ---

    // Select storage directory
   selectDirBtn.addEventListener('click', async () => {
       const newPath = await window.electronAPI.selectDirectory();
       if (newPath) {
           storagePath = newPath;
           storagePathInput.value = storagePath;
           localStorage.setItem('storagePath', storagePath);
           data = [];
           masterPassword = null;
           renderDataList();
           await loadData();
       }
   });

    // Handle form submission
    dataForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const entryId = document.getElementById('entry-id').value;
        const name = nameInput.value;
        const account = accountInput.value;
        const password = passwordInput.value;

        if (entryId) {
            // Update existing entry
            const existingEntry = data.find(item => item.id === entryId);
            if (existingEntry) {
                existingEntry.name = name;
                existingEntry.account = account;
                existingEntry.password = password;
            }
        } else {
            // Add new entry
            const newEntry = {
                id: Date.now().toString(),
                name: name,
                account: account,
                password: password, // Note: In a real app, encrypt this!
                image: null
            };
            data.push(newEntry);
        }

        await saveData();
        renderDataList(); // Re-render the list
        clearForm();
    });

    // Import JSON
    importJsonBtn.addEventListener('click', async () => {
        const importedData = await window.electronAPI.importJson();
        if (importedData && Array.isArray(importedData)) {
            // Simple merge: append new data, could be improved with conflict resolution
            data = [...data, ...importedData];
            await saveData();
            renderDataList(); // Re-render the list
            alert('JSON 檔案匯入成功！');
        } else if (importedData && importedData.error) {
            alert(`匯入失敗: ${importedData.error}`);
        }
    });

    // Import CSV
    importCsvBtn.addEventListener('click', async () => {
        const importedData = await window.electronAPI.importCsv();
        if (importedData && Array.isArray(importedData)) {
            // Add a unique ID to each imported row
            const newData = importedData.map(item => ({
                ...item,
                id: Date.now().toString() + Math.random().toString(36).substring(2, 9)
            }));
            data = [...data, ...newData];
            await saveData();
            renderDataList(); // Re-render the list
            alert('CSV 檔案匯入成功！');
        } else if (importedData && importedData.error) {
            alert(`匯入失敗: ${importedData.error}`);
        }
    });

    // Import Image from file
    importImageBtn.addEventListener('click', async () => {
        if (!selectedItemId) {
            alert('請先選擇一筆資料！');
            return;
        }
        const newImagePath = await window.electronAPI.importImage();
        if (newImagePath && !newImagePath.error) {
            const selectedItem = data.find(item => item.id === selectedItemId);
            selectedItem.image = newImagePath;
            await saveData();
            displayImage(newImagePath);
        } else if (newImagePath && newImagePath.error) {
            alert(`圖片匯入失敗: ${newImagePath.error}`);
        }
    });

    // Paste Image from clipboard
    imageContainer.addEventListener('paste', async (event) => {
        event.preventDefault();
        if (!selectedItemId) {
            alert('請先選擇一筆資料！');
            return;
        }
        const newImagePath = await window.electronAPI.pasteImage();
        if (newImagePath && !newImagePath.error) {
            const selectedItem = data.find(item => item.id === selectedItemId);
            selectedItem.image = newImagePath;
            await saveData();
            displayImage(newImagePath);
        } else if (newImagePath && newImagePath.error) {
            alert(`貼上圖片失敗: ${newImagePath.error}`);
        } else {
            alert('剪貼簿中沒有圖片。');
        }
    });

    // Delete selected item
    deleteBtn.addEventListener('click', async () => {
        if (!selectedItemId) {
            alert('請先選擇要刪除的資料！');
            return;
        }

        if (confirm('確定要刪除這筆資料嗎？')) {
            data = data.filter(item => item.id !== selectedItemId);
            selectedItemId = null;
            imageSection.classList.add('hidden');
            await saveData();
            renderDataList(); // Re-render the list
        }
    });

    // Search functionality
    searchInput.addEventListener('input', renderDataList);

    // Close details modal
    closeDetailsBtn.addEventListener('click', () => {
        detailsModal.classList.add('hidden');
    });

    // Copy password to clipboard
    copyPasswordBtn.addEventListener('click', () => {
        const password = copyPasswordBtn.dataset.password;
        if (password) {
            navigator.clipboard.writeText(password).then(() => {
                alert('密碼已複製到剪貼簿！');
            }).catch(err => {
                console.error('Could not copy text: ', err);
                alert('複製失敗！');
            });
        }
    });

    // Lightbox functionality
    entryImage.addEventListener('click', () => {
        if (entryImage.src && entryImage.src.startsWith('safe-file://')) {
            // Ensure the lightbox also uses the correct file protocol
            lightboxImage.src = entryImage.src;
            lightbox.classList.remove('hidden');
        }
    });

    // Close lightbox when clicking the X button
    lightboxClose.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling
        lightbox.classList.add('hidden');
    });

    // Close lightbox when clicking on the background
    lightbox.addEventListener('click', () => {
        lightbox.classList.add('hidden');
    });

    // Prevent closing when clicking on the image itself
    lightboxImage.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Add click-to-zoom functionality to the details modal image
    detailsImage.addEventListener('click', () => {
        if (detailsImage.src && detailsImage.style.display !== 'none') {
            lightboxImage.src = detailsImage.src;
            lightbox.classList.remove('hidden');
        }
    });

    // --- Settings Modal ---
   settingsBtn.addEventListener('click', () => {
       settingsModal.classList.remove('hidden');
   });

   closeSettingsBtn.addEventListener('click', () => {
       settingsModal.classList.add('hidden');
   });

   setPasswordBtn.addEventListener('click', () => {
       settingsModal.classList.add('hidden');
       promptForPassword('設定新的主密碼', async (newPassword) => {
           if (newPassword !== masterPasswordConfirm.value) {
               masterPasswordError.textContent = 'Passwords do not match.';
               return;
           }
           const result = await window.electronAPI.setPassword(newPassword);
           if (result.success) {
               masterPassword = newPassword;
               masterPasswordModal.classList.add('hidden');
               alert('主密碼已設定！');
           } else {
               masterPasswordError.textContent = result.error;
           }
       });
       confirmPasswordGroup.style.display = 'block';
   });

   removePasswordBtn.addEventListener('click', () => {
       settingsModal.classList.add('hidden');
       promptForPassword('請輸入主密碼以移除', async (password) => {
           const result = await window.electronAPI.removePassword(password);
           if (result.success) {
               masterPassword = null;
               masterPasswordModal.classList.add('hidden');
               alert('主密碼已移除！');
           } else {
               masterPasswordError.textContent = result.error;
           }
       });
   });

   masterPasswordForm.addEventListener('submit', (e) => {
       e.preventDefault();
       if (passwordPromptCallback) {
           passwordPromptCallback(masterPasswordInput.value);
       }
   });

    // --- Initialization ---

    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearForm);
    }

    function clearForm() {
        dataForm.reset();
        document.getElementById('entry-id').value = '';
        document.getElementById('form-title').textContent = '新增資料';
        document.getElementById('save-btn').textContent = '儲存資料';
    }

    loadData();
});