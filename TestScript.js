const crypto = require('crypto');

/**
 * Encrypts a message using AES-256-GCM with a password
 * @param {string} message - The message to encrypt
 * @param {string} password - The password to use for encryption
 * @returns {object} - Object containing encrypted data and metadata
 */
function encryptMessage(message, password) {
    try {
        // Generate a random salt for key derivation
        const salt = crypto.randomBytes(32);
        
        // Generate a random initialization vector
        const iv = crypto.randomBytes(16);
        
        // Derive a key from the password using scrypt
        const key = crypto.scryptSync(password, salt, 32);
        
        // Create cipher
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        
        // Encrypt the message
        let encrypted = cipher.update(message, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Get the authentication tag
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted: encrypted,
            salt: salt.toString('hex'),
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            algorithm: 'aes-256-gcm'
        };
    } catch (error) {
        throw new Error(`Encryption failed: ${error.message}`);
    }
}

/**
 * Decrypts a message using AES-256-GCM with a password
 * @param {object} encryptedData - Object containing encrypted data and metadata
 * @param {string} password - The password to use for decryption
 * @returns {string} - The decrypted message
 */
function decryptMessage(encryptedData, password) {
    try {
        // Convert hex strings back to buffers
        const salt = Buffer.from(encryptedData.salt, 'hex');
        const iv = Buffer.from(encryptedData.iv, 'hex');
        const authTag = Buffer.from(encryptedData.authTag, 'hex');
        
        // Derive the same key from the password and salt
        const key = crypto.scryptSync(password, salt, 32);
        
        // Create decipher
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        
        // Decrypt the message
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        throw new Error(`Decryption failed: ${error.message}`);
    }
}

/**
 * Interactive function to encrypt a custom message
 */
function interactiveEncrypt() {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Enter the message to encrypt: ', (message) => {
        rl.question('Enter the password: ', (password) => {
            try {
                console.log('\n🔒 Encrypting message...');
                const encryptedData = encryptMessage(message, password);
                
                console.log('✅ Encryption successful!');
                console.log('Encrypted data:', JSON.stringify(encryptedData, null, 2));
                
                // Save to file option
                rl.question('\nSave encrypted data to file? (y/n): ', (save) => {
                    if (save.toLowerCase() === 'y') {
                        const fs = require('fs');
                        const filename = `encrypted_${Date.now()}.json`;
                        fs.writeFileSync(filename, JSON.stringify(encryptedData, null, 2));
                        console.log(`💾 Encrypted data saved to ${filename}`);
                    }
                    rl.close();
                });
            } catch (error) {
                console.error('❌ Error:', error.message);
                rl.close();
            }
        });
    });
}

/**
 * Interactive function to decrypt a message
 */
function interactiveDecrypt() {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Enter the encrypted data (JSON string): ', (encryptedString) => {
        rl.question('Enter the password: ', (password) => {
            try {
                const encryptedData = JSON.parse(encryptedString);
                
                console.log('\n🔓 Decrypting message...');
                const decryptedMessage = decryptMessage(encryptedData, password);
                
                console.log('✅ Decryption successful!');
                console.log('Decrypted message:', decryptedMessage);
            } catch (error) {
                console.error('❌ Error:', error.message);
            }
            rl.close();
        });
    });
}

/**
 * Main function to demonstrate encryption and decryption
 */
function main() {
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
        switch (args[0]) {
            case 'encrypt':
                interactiveEncrypt();
                return;
            case 'decrypt':
                interactiveDecrypt();
                return;
            case 'help':
                console.log(`
Usage:
  node index.js           - Run demo
  node index.js encrypt   - Interactive encryption
  node index.js decrypt   - Interactive decryption
  node index.js help      - Show this help
                `);
                return;
        }
    }
    

    console.log("\n💡 Try running:");
    console.log("  node index.js encrypt   - to encrypt your own message");
    console.log("  node index.js decrypt   - to decrypt a message");
    console.log("  node index.js help      - for more options");

}

// Export functions for use in other modules
module.exports = {
    encryptMessage,
    decryptMessage
};

// Run the demo if this file is executed directly
if (require.main === module) {
    main();
}