import Peer, {DataConnection} from "peerjs";
import { MlKem768} from "crystals-kyber-js";

import {KeyExchangeInterface, KeyExchange} from './KeyExchange'

// 1. Generate ECDH key pair
let ecdhKeyPair: CryptoKeyPair;
let peerECDHPublicKey: CryptoKey;
let ecdhSharedSecret: ArrayBuffer;
crypto.subtle.generateKey(
    {
        name: 'ECDH',
        namedCurve: 'P-256',
    },
    true,
    ['deriveBits']
).then((keyPair: CryptoKeyPair) => {ecdhKeyPair = keyPair;});

// 2. Generate ML-KEM key pair
const mlkem = new MlKem768();
let mlkemPublicKey: Uint8Array, mlkemPrivateKey: Uint8Array;
let peermlkemPublicKey: Uint8Array;
let mlkemSharedKey: Uint8Array;
mlkem.generateKeyPair().then(keyPair => {mlkemPublicKey = keyPair[0]; mlkemPrivateKey = keyPair[1];});

let combinedSecret: Uint8Array;
let hkdfKey: CryptoKey;
let sessionKey: CryptoKey;

let log : HTMLTextAreaElement = document.getElementById("messagelog") as HTMLTextAreaElement;
let userName : string = `user${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}u`

let peer: Peer;
let conn: DataConnection;
let ready: boolean = false;
resetPeer(userName);

function resetPeer(_username: string) {

    if (peer && peer.open)
        peer.disconnect();

    if (conn && conn.open)
        conn.close();

    peer = new Peer(_username);
    (document.getElementById("username") as HTMLInputElement).value = _username;

    peer.on('open', (id) => {
        userName = id;
        logMessage("Your username is '" + userName + "'");
    })

    peer.on('connection', (socket) => {
        conn = socket;
        logMessage("Got connection from from " + socket.peer);
        conn.on('open', openHandler)
        conn.on('data', ecdhCryptoHandler)
        conn.on('error', (err) => {
            console.error(err);
        })
        //console.log(conn);


        ready = true;
    })
}

async function ecdhCryptoHandler(d: unknown) {
    //console.log("ECDH CryptoHandler");
    let data = JSON.parse(d as string) as KeyExchangeInterface;
    const rawecdh = atob(data.ecdh as string);
    const ecdhKeyBytes = new Uint8Array(rawecdh.length);
    for (let i = 0; i < rawecdh.length; i++) {
        ecdhKeyBytes[i] = rawecdh.charCodeAt(i);
    }
    peerECDHPublicKey = await crypto.subtle.importKey('raw', ecdhKeyBytes, {name: 'ECDH', namedCurve: 'P-256'}, true, []);

    const rawmlkem = atob(data.mlkem as string);
    peermlkemPublicKey = new Uint8Array(rawmlkem.length)
    for (let i = 0; i < rawmlkem.length; i++) {
        peermlkemPublicKey[i] = rawmlkem.charCodeAt(i);
    }

    if (data.initiator) {
        conn.on('data', mlkemHandler);
        //console.log("Got from initiator", peermlkemPublicKey, peerECDHPublicKey)
        const exportedKey = await crypto.subtle.exportKey('raw', ecdhKeyPair.publicKey);
        const keybase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
        ecdhSharedSecret = await crypto.subtle.deriveBits({name: 'ECDH', public: peerECDHPublicKey}, ecdhKeyPair.privateKey, 256);
        conn.send(JSON.stringify(new KeyExchange(false, btoa(String.fromCharCode(...mlkemPublicKey)), keybase64)));
    }


    if (!data.initiator) {
        ecdhSharedSecret = await crypto.subtle.deriveBits({name: 'ECDH', public: peerECDHPublicKey}, ecdhKeyPair.privateKey, 256);
        const [ciphertext, mlkemSharedSecret] = await mlkem.encap(peermlkemPublicKey);
        conn.send(btoa(String.fromCharCode(...ciphertext)));

        mlkemSharedKey = mlkemSharedSecret;

        await combineSecrets();

        conn.on('data', dataHandler)
    }

    conn.removeListener('data', ecdhCryptoHandler);
}

async function mlkemHandler(d: unknown) {
    //console.log("mlkem Handler")
    let rawdata = atob(d as string);
    let data = new Uint8Array(rawdata.length);
    for (let i = 0; i < rawdata.length; i++) {
        data[i] = rawdata.charCodeAt(i);
    }

    mlkemSharedKey = await mlkem.decap(data, mlkemPrivateKey);

    await combineSecrets();

    conn.on('data', dataHandler);
    conn.removeListener('data', mlkemHandler);

}

async function combineSecrets() {
    combinedSecret = new Uint8Array([
        ...new Uint8Array(ecdhSharedSecret),
        ...mlkemSharedKey,
    ]);

    hkdfKey = await crypto.subtle.importKey(
        'raw',
        combinedSecret,
        'HKDF',
        false,
        ['deriveKey']
    );

    sessionKey = await crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new Uint8Array(16), // Use a secure random salt
            info: new Uint8Array(0),
        },
        hkdfKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function dataHandler(d : unknown) {
    let data = JSON.parse(d as string)

    //console.log(data)
    const ciphertext = new Uint8Array(data.ciphertext).buffer;
    const iv = new Uint8Array(data.iv);

    let message = await decryptMessage(sessionKey, ciphertext, iv)

    logMessage(message, data.username);
}

async function openHandler() {
    logMessage("Connected to Peer");
    const exportedKey = await crypto.subtle.exportKey('raw', ecdhKeyPair.publicKey);
    const keybase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
    conn.send(JSON.stringify(new KeyExchange(true, btoa(String.fromCharCode(...mlkemPublicKey)), keybase64)));
    //console.log("Sending keys...", mlkemPublicKey, exportedKey);
}

// Converts a string to an ArrayBuffer
function encodeString(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}

// Converts an ArrayBuffer back to a string
function decodeString(buffer: ArrayBuffer): string {
    return new TextDecoder().decode(buffer);
}

// Generate a random IV (initialization vector)
function generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
}

async function encryptMessage(sessionKey: CryptoKey, message: string): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
    const iv = generateIV();
    const encoded = encodeString(message);

    const ciphertext = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv,
        },
        sessionKey,
        encoded
    );

    return { ciphertext, iv };
}

async function decryptMessage(sessionKey: CryptoKey, ciphertext: ArrayBuffer, iv: Uint8Array): Promise<string> {
    const decrypted = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv,
        },
        sessionKey,
        ciphertext
    );

    return decodeString(decrypted);
}

function logMessage(message:string, from : string = "system") {
    log.textContent += `<${from}>: ${message}\n`;
    log.scrollTop = log.scrollHeight;
}

function clearLog() {
    log.textContent = "";
}

function changeUsername() {
    let newUsername = (document.getElementById("username") as HTMLInputElement).value;
    if (newUsername.length <= 0 || newUsername == "system" || newUsername == "System") {
        logMessage("That username is invalid.")
    }

    userName = newUsername;
    resetPeer(userName);
}

async function connectTo() {
    let ip = prompt("Enter peer id") as string;

    conn = peer.connect(ip);

    conn.on('open', () => {
        ready = true;
        logMessage("Connected to " + ip);
    })
    conn.on('data', ecdhCryptoHandler);
    conn.on('error', (err) => {
        console.error(err);
    })
}

async function sendMessage() {
    let textBox = document.getElementById("text") as HTMLInputElement;

    let message = textBox.value;
    let { ciphertext, iv } = await encryptMessage(sessionKey, message);

    if (!conn || !conn.open) {
        //console.log("Connection is not open. Something went wrong.", conn)
        return;
    }

    if (ready) {
        //console.log(JSON.stringify({ username: userName, message: message}))
        conn.send(JSON.stringify({ username: userName, ciphertext: Array.from(new Uint8Array(ciphertext)), iv: Array.from(iv)}));
        logMessage(message, userName);
    }
    textBox.value = "";
}

document.getElementById("changeuser")?.addEventListener("click", changeUsername);
document.getElementById("clearmessages")?.addEventListener("click", clearLog);
document.getElementById("connect")?.addEventListener("click", connectTo);
document.getElementById("sendmessage")?.addEventListener("click", sendMessage);
document.getElementById("username")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        changeUsername();
    }
})
document.getElementById("text")?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
        await sendMessage();
    }
})


logMessage("System start!");
logMessage("Please, establish a connection before sending messages");