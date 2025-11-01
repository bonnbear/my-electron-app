const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SCRYPT_OPTIONS = {
    N: 16384, // CPU/memory cost factor
    r: 8,     // Block size factor
    p: 1      // Parallelization factor
};

/**
 * Hashes a password using scrypt.
 * @param {string} password The password to hash.
 * @returns {Promise<string>} A promise that resolves with the hashed password (including salt).
 */
function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
        crypto.scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (err, derivedKey) => {
            if (err) reject(err);
            resolve(`${salt}:${derivedKey.toString('hex')}`);
        });
    });
}

/**
 * Verifies a password against a hash.
 * @param {string} password The password to verify.
 * @param {string} hash The hash to verify against.
 * @returns {Promise<boolean>} A promise that resolves with true if the password is correct, false otherwise.
 */
function verifyPassword(password, hash) {
    return new Promise((resolve, reject) => {
        const [salt, key] = hash.split(':');
        if (!salt || !key) {
            return reject(new Error('Invalid hash format. Expected "salt:key"'));
        }
        const keyBuffer = Buffer.from(key, 'hex');
        crypto.scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (err, derivedKey) => {
            if (err) reject(err);
            resolve(crypto.timingSafeEqual(keyBuffer, derivedKey));
        });
    });
}

/**
 * Derives a key from a password and salt.
 * @param {string} password The password.
 * @param {Buffer} salt The salt.
 * @returns {Buffer} The derived key.
 */
function deriveKey(password, salt) {
    return crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
}

/**
 * Encrypts data using a password.
 * @param {string} data The data to encrypt (should be a string).
 * @param {string} password The password to use for encryption.
 * @returns {string} The encrypted data, encoded as a hex string.
 */
function encryptData(data, password) {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = deriveKey(password, salt);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    // The final encrypted string contains salt, iv, tag, and the encrypted data
    return Buffer.concat([salt, iv, tag, encrypted]).toString('hex');
}

/**
 * Decrypts data using a password.
 * @param {string} encryptedData The encrypted data, encoded as a hex string.
 * @param {string} password The password to use for decryption.
 * @returns {string} The decrypted data.
 */
function decryptData(encryptedData, password) {
    try {
        const dataBuffer = Buffer.from(encryptedData, 'hex');
        const salt = dataBuffer.slice(0, SALT_LENGTH);
        const iv = dataBuffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const tag = dataBuffer.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
        const encrypted = dataBuffer.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

        const key = deriveKey(password, salt);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        const decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
        return decrypted;
    } catch (error) {
        // If decryption fails, it's likely due to a wrong password.
        console.error("Decryption failed. This might be due to an incorrect password or corrupted data.", error);
        throw new Error('DECRYPTION_FAILED');
    }
}

module.exports = {
    hashPassword,
    verifyPassword,
    encryptData,
    decryptData
};