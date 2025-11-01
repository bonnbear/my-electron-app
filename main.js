// main.js
const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const Store = require('electron-store');
const Papa = require('papaparse');
const crypto = require('./crypto');

const store = new Store();
let storagePath; // Keep track of the storage path

// File paths
const getDataFilePath = () => storagePath ? path.join(storagePath, 'data.json') : null;
const getMetaFilePath = () => storagePath ? path.join(storagePath, 'meta.json') : null;


async function readMeta() {
    try {
        const metaFile = getMetaFilePath();
        if (!metaFile) return {};
        const data = await fs.readFile(metaFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {}; // No meta file yet
        }
        throw error;
    }
}

async function writeMeta(meta) {
    const metaFile = getMetaFilePath();
    if (metaFile) {
        await fs.writeFile(metaFile, JSON.stringify(meta, null, 2));
    }
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            // 為了安全，我們不直接允許本地檔案協定，而是使用自訂協定
            webSecurity: true 
        },
    });

    mainWindow.loadFile('index.html');

    // 無條件開啟開發者工具以便除錯
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    
    return mainWindow;
}

app.whenReady().then(() => {
    // 註冊一個自訂協定來安全地提供本地檔案
    protocol.registerFileProtocol('safe-file', (request, callback) => {
        const url = request.url.replace('safe-file://', '');
        try {
            // 解碼並標準化路徑以避免錯誤
            const decodedPath = decodeURI(url);
            const normalizedPath = path.normalize(decodedPath);
            callback({ path: normalizedPath });
        } catch (error) {
            console.error(`ERROR: 無法提供檔案: ${url}`, error);
            callback({ error: -6 }); // -6 is FILE_NOT_FOUND
        }
    });

    createWindow();

    // --- IPC Handlers ---

    // 選擇儲存目錄
    ipcMain.handle('dialog:selectDirectory', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openDirectory', 'createDirectory'],
        });
        if (!canceled && filePaths.length > 0) {
            // 在選定的目錄下建立 password 子目錄
            const baseDir = filePaths[0];
            const passwordDir = path.join(baseDir, 'password');
            try {
                await fs.mkdir(passwordDir, { recursive: true });
                storagePath = passwordDir; // Set the storage path
                return passwordDir;
            } catch (error) {
                console.error('建立 password 目錄失敗:', error);
                return storagePath || null; // Return old path on error
            }
        }
        return storagePath || null; // Return old path if cancelled
    });

    // Set storage path from renderer
    ipcMain.handle('set-storage-path', (event, path) => {
        storagePath = path;
    });

    // Check if a master password is set
    ipcMain.handle('check-password', async () => {
        if (!storagePath) return false;
        const meta = await readMeta();
        return !!meta.passwordHash;
    });

    // Set a new master password
    ipcMain.handle('set-password', async (event, password) => {
        if (!storagePath) return { success: false, error: 'Storage path not set.' };
        if (!password) return { success: false, error: 'Password cannot be empty.' };
        const meta = await readMeta();
        const dataFile = getDataFilePath();
        
        try {
            let data = [];
            try {
                const encryptedData = await fs.readFile(dataFile, 'utf8');
                if (meta.passwordHash) {
                    // Decrypt with old password if it exists
                    const oldPassword = await dialog.showInputBox({ title: 'Enter old password' });
                    if (!oldPassword) return { success: false, error: 'Password change cancelled.' };
                    data = JSON.parse(crypto.decryptData(encryptedData, oldPassword));
                } else {
                    data = JSON.parse(encryptedData); // Data was not encrypted
                }
            } catch (e) {
                // Ignore if file doesn't exist
            }

            const passwordHash = await crypto.hashPassword(password);
            const encryptedData = crypto.encryptData(JSON.stringify(data), password);
            await fs.writeFile(dataFile, encryptedData);
            await writeMeta({ passwordHash });
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Remove the master password
    ipcMain.handle('remove-password', async (event, password) => {
        if (!storagePath) return { success: false, error: 'Storage path not set.' };
        const meta = await readMeta();
        if (!meta.passwordHash) return { success: true }; // No password to remove

        const isValid = await crypto.verifyPassword(password, meta.passwordHash);
        if (!isValid) return { success: false, error: 'Incorrect password.' };

        try {
            const dataFile = getDataFilePath();
            const encryptedData = await fs.readFile(dataFile, 'utf8');
            const decryptedData = crypto.decryptData(encryptedData, password);
            
            await fs.writeFile(dataFile, decryptedData); // Save as plain text
            await writeMeta({ passwordHash: null }); // Remove hash
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Get data, decrypting if necessary
    ipcMain.handle('get-data', async (event, password) => {
        if (!storagePath) return { success: true, data: [] };
        const meta = await readMeta();
        const dataFile = getDataFilePath();

        try {
            const fileContent = await fs.readFile(dataFile, 'utf8');
            if (!meta.passwordHash) {
                return { success: true, data: JSON.parse(fileContent) };
            }

            if (!password) return { success: false, error: 'Password required.' };
            
            const isValid = await crypto.verifyPassword(password, meta.passwordHash);
            if (!isValid) return { success: false, error: 'Incorrect password.' };

            const decryptedData = crypto.decryptData(fileContent, password);
            return { success: true, data: JSON.parse(decryptedData) };
        } catch (error) {
            if (error.code === 'ENOENT') {
                return { success: true, data: [] }; // No data file yet
            }
            return { success: false, error: error.message };
        }
    });

    // Save data, encrypting if necessary
    ipcMain.handle('save-data', async (event, { password, data }) => {
        if (!storagePath) return { success: false, error: 'Storage path not set.' };
        const meta = await readMeta();
        const dataFile = getDataFilePath();

        try {
            let dataToSave = JSON.stringify(data, null, 2);
            if (meta.passwordHash) {
                if (!password) return { success: false, error: 'Password required.' };
                const isValid = await crypto.verifyPassword(password, meta.passwordHash);
                if (!isValid) return { success: false, error: 'Incorrect password.' };
                dataToSave = crypto.encryptData(dataToSave, password);
            }
            
            await fs.writeFile(dataFile, dataToSave);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // 匯入 JSON 檔案
    ipcMain.handle('import-json', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });

        if (canceled || filePaths.length === 0) {
            return null;
        }

        try {
            const data = await fs.readFile(filePaths, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // 匯入 CSV 檔案
    ipcMain.handle('import-csv', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'CSV', extensions: ['csv'] }]
        });

        if (canceled || filePaths.length === 0) {
            return null;
        }

        try {
            const csvData = await fs.readFile(filePaths, 'utf8');
            const parsed = Papa.parse(csvData, {
                header: true,
                skipEmptyLines: true
            });
            return parsed.data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // 匯入圖片
    ipcMain.handle('import-image', async () => {
        if (!storagePath) return { success: false, error: '未設定儲存路徑' };

        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] }]
        });

        if (canceled || filePaths.length === 0) {
            return null;
        }

        const sourcePath = filePaths[0];
        const fileName = path.basename(sourcePath);
        const imagesDir = path.join(storagePath, 'images');
        const destPath = path.join(imagesDir, fileName);

        try {
            await fs.mkdir(imagesDir, { recursive: true });
            await fs.copyFile(sourcePath, destPath);
            return fileName; // 只回傳檔案名稱
        } catch (error) {
            console.error('Image import failed:', error);
            return { success: false, error: error.message };
        }
    });

    // 從剪貼簿貼上圖片
    ipcMain.handle('paste-image', async () => {
        if (!storagePath) return { success: false, error: '未設定儲存路徑' };

        const { clipboard } = require('electron');
        const image = clipboard.readImage();
        if (image.isEmpty()) {
            return null;
        }

        const fileName = `paste-${Date.now()}.png`;
        const imagesDir = path.join(storagePath, 'images');
        const filePath = path.join(imagesDir, fileName);

        try {
            await fs.mkdir(imagesDir, { recursive: true });
            await fs.writeFile(filePath, image.toPNG());
            return fileName; // 只回傳檔案名稱
        } catch (error) {
            console.error('Image paste failed:', error);
            return { success: false, error: error.message };
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});