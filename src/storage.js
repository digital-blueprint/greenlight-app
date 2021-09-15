import {generateKey, encrypt, decrypt} from "./crypto.js";

/**
 * @param {string} publicId 
 */
export async function clear(publicId) {
    localStorage.removeItem("dbp-gp-" + publicId);
    localStorage.removeItem("dbp-gp-salt-" + publicId);
    localStorage.removeItem("dbp-gp-iv-" + publicId);
    localStorage.removeItem("dbp-gp-maxTime-" + publicId);
}

/**
 * @param {string} payload 
 * @param {string} publicId 
 * @param {string} privateId 
 * @param {number} [expiresAt]
 */
export async function save(payload, publicId, privateId, expiresAt=undefined) {
    let key, salt, cipher, iv;

    [key, salt] = await generateKey(privateId);
    [cipher, iv] = await encrypt(key, payload);

    localStorage.setItem("dbp-gp-" + publicId, cipher);
    localStorage.setItem("dbp-gp-salt-" + publicId, salt);
    localStorage.setItem("dbp-gp-iv-" + publicId, iv);
    if (expiresAt) {
        localStorage.setItem("dbp-gp-maxTime-" + publicId, expiresAt);
    }
}

/**
 * @param {string} publicId 
 * @param {string} privateId 
 * @param {number} [currentTime]
 * @returns {null|string}
 */
export async function fetch(publicId, privateId, currentTime=undefined) {
    if (localStorage.length <= 0)
        return null;

    let key, salt, cipher, iv, maxTime;
    cipher = localStorage.getItem("dbp-gp-" + publicId);
    salt = localStorage.getItem("dbp-gp-salt-" + publicId);
    iv = localStorage.getItem("dbp-gp-iv-" + publicId);
    maxTime = localStorage.getItem("dbp-gp-maxTime-" + publicId);

    if (currentTime === undefined) {
        currentTime = Date.now();
    }

    if (maxTime) {
        if (currentTime - maxTime >= 0) {
            await clear(publicId);
            return null;
        }
    }

    if (!cipher || !iv || !salt) {
        await clear(publicId);
        return null;
    }

    let salt_binary_string =  window.atob(salt);
    let salt_bytes = new Uint8Array( salt_binary_string.length );
    for (let i = 0; i < salt_binary_string.length; i++) {
        salt_bytes[i] = salt_binary_string.charCodeAt(i);
    }

    let iv_binary_string =  window.atob(iv);
    let iv_bytes = new Uint8Array( iv_binary_string.length );
    for (let i = 0; i < iv_binary_string.length; i++) {
        iv_bytes[i] = iv_binary_string.charCodeAt(i);
    }

    [key, salt] = await generateKey(privateId, salt_bytes);

    try {
        return await decrypt(cipher, key, iv_bytes);
    } catch(error) {
        console.error("Decryption error");
        return null;
    }
}