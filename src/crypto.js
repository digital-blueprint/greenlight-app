import { CompactEncrypt } from 'jose/jwe/compact/encrypt';
import { parseJwk } from 'jose/jwk/parse';
import {encode} from 'jose/util/base64url';

/**
 * @param {string} passphraseKey 
 * @param {ArrayBuffer } [salt]
 * @returns {Array}
 */
export async function generateKey(passphraseKey, salt) {
    if (salt === undefined) {
        salt = window.crypto.getRandomValues(new Uint8Array(24));
    }

    let enc = new TextEncoder();

    let privateKey = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(passphraseKey),
        "PBKDF2",
        false,
        ["deriveBits", "deriveKey"]
    );

    let key = await window.crypto.subtle.deriveKey(
        {
            "name": "PBKDF2",
            "salt": salt,
            "iterations": 100000,
            "hash": "SHA-256"
        },
        privateKey,
        { "name": "AES-GCM", "length": 256 },
        true,
        ["encrypt", "decrypt"]
    );

    let binary = '';
    for (let i = 0; i < salt.byteLength; i++) {
        binary += String.fromCharCode(salt[i]);
    }

    let saltBase64 = window.btoa(binary);

    return [key, saltBase64];
}

/**
 * @param {CryptoKey} key 
 * @param {string} plaintext 
 * @returns {Array}
 */
export async function encrypt(key, plaintext) {
    let enc = new TextEncoder();
    let iv = window.crypto.getRandomValues(new Uint8Array(24));

    let cipher = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        key,
        enc.encode(plaintext)
    );

    let binary = '';
    let bytes = new Uint8Array(cipher);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    let cipherBase64 = window.btoa(binary);

    binary = '';
    for (let i = 0; i < iv.byteLength; i++) {
        binary += String.fromCharCode(iv[i]);
    }

    let ivBase64 = window.btoa(binary);

    return [cipherBase64, ivBase64];
}

/**
 * @param {string} ciphertext 
 * @param {CryptoKey} key 
 * @param {ArrayBuffer} iv 
 * @returns {string}
 */
export async function decrypt(ciphertext, key, iv) {
    let binary_string = window.atob(ciphertext);
    let bytes = new Uint8Array(binary_string.length);
    for (let i = 0; i < binary_string.length; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    let cipherArrayBuffer = bytes.buffer;

    let dec = new TextDecoder("utf-8");
    let plaintext = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        key,
        cipherArrayBuffer
    );

    return dec.decode(plaintext);
}

export async function securityByObscurity(token, additionalInformation) {
    const encoder = new TextEncoder();
    const key = await parseJwk({kty: 'oct', k: encode(token)}, 'PBES2-HS256+A128KW');
    const jwe = await new CompactEncrypt(encoder.encode(additionalInformation))
        .setProtectedHeader({alg: 'PBES2-HS256+A128KW', enc: 'A256GCM'})
        .encrypt(key);
    return jwe;
}
