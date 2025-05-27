import Peer, {DataConnection} from "peerjs";

let log : HTMLTextAreaElement = document.getElementById("messagelog") as HTMLTextAreaElement;
let userName : string = `user${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}u`

let peer = new Peer(userName);
let conn: DataConnection;
let ready: boolean = false;

peer.on('open', (id) => {
    userName = id;
    logMessage("Your username is '" + userName + "'");
})

peer.on('connection', (socket) => {
    conn = socket;
    logMessage("Got connection from from " + socket.peer);
    conn.on('open', openHandler)
    conn.on('data', dataHandler)
    conn.on('error', (err) => {
        console.error(err);
    })
    console.log(conn);
    ready = true;
})

function dataHandler(d : unknown) {
    let data = JSON.parse(d as string)
    logMessage(data.message, data.username);
}

function openHandler() {
    logMessage("Connected to Peer");
}

function logMessage(message:string, from : string = "system") {
    log.textContent += `<${from}>: ${message}\n`;
    log.scrollTop = log.scrollHeight;
}

function clearLog() {
    log.textContent = "";
}

function changeUsername() {
    let newUsername = "";
    do {
        newUsername = prompt("Enter your username") as string;
    } while (newUsername.length < 0 || newUsername == "system" || newUsername == "System");

    userName = newUsername;
    logMessage(`Username changed to '${newUsername}'`);
}

function connectTo() {
    let ip = prompt("Enter peer id") as string;

    conn = peer.connect(ip);

    conn.on('open', () => {
        ready = true;
        logMessage("Connected to " + ip);
    })
    conn.on('data', dataHandler)
    conn.on('error', (err) => {
        console.error(err);
    })
}
function sendMessage() {
    let message = (document.getElementById("text") as HTMLInputElement).value as string;

    if (!conn.open) {
        console.log("Connection is not open. Something went wrong.", conn)
        return;
    }

    if (ready) {
        console.log(JSON.stringify({ username: userName, message: message}))
        conn.send(JSON.stringify({ username: userName, message: message}));
        logMessage(message, userName);
    }
}

document.getElementById("changeuser")?.addEventListener("click", () => {alert("disabled")});
document.getElementById("clearmessages")?.addEventListener("click", clearLog);
document.getElementById("connect")?.addEventListener("click", connectTo);
document.getElementById("sendmessage")?.addEventListener("click", sendMessage);


logMessage("System start!");
logMessage("Please, establish a connection before sending messages");