// polyfill https://github.com/webrtc/adapter
import "./adapter.mjs";
import { io } from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js";
import dateFnsFormat from "https://cdn.jsdelivr.net/npm/date-fns@2.29.2/esm/format/index.js";

let localStream;
// let remoteStreams = [];
const socket = io('/');
socket.emit('join-room', ROOM_ID, 10)

// const configuration = {
//   iceServers: [
//     {
//       urls: ["stun:stun.l.google.com:19302"], // Google's public STUN server
//     },
//   ],
// };
// let peerConnection = new RTCPeerConnection(configuration);
if ("mediaDevices" in navigator) {
  const init = async () => {

    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localStream.active) {
      const video = document.querySelector("#local-stream");
      video.srcObject = localStream;
      video.play();

      // createOffer()
    }

    const form = document.querySelector("#form");
    const message = document.querySelector("#message");

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (message?.value) {
          socket.emit("chat-message", message.value);
          message.value = "";
        }
      });
    }
  };

  // const createOffer = async () => {
  //   const offer = await peerConnection.createOffer();
  //   await peerConnection.setLocalDescription(offer);
  // };

  // const createAnswer = async () => {
  //   const answer = await peerConnection.createAnswer({ localStream });
  //   await peerConnection.setRemoteDescription(answer);
  // };

  init();
} else {
  alert("Error. WebRTC is not supported!");
}

const messages = document.querySelector("#messages");

function createMessage(message) {
  const li = document.createElement("li");
  const dateSpan = document.createElement("span");
  dateSpan.style.marginRight = "4px";
  const messageSpan = document.createElement("span");
  const currentTime = dateFnsFormat(new Date(), "hh:mm a");

  dateSpan.textContent = currentTime + ":";
  messageSpan.textContent = message;
  li.appendChild(dateSpan);
  li.appendChild(messageSpan);
  if (messages) {
    messages.appendChild(li);
  }
}

socket.on("chat-message", (message) => {
  createMessage(message);
});

socket.on('user-connected', (user) => {
  createMessage(`user ${user} has joined the chat room`)
})

socket.on('user-disconnected', (user) => {
  createMessage(`user ${user} has left the chat room`)
})

window.addEventListener('beforeunload', () => {
  const socket = io();
  socket.emit('leave-room', ROOM_ID, 10)
})
