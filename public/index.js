// polyfill https://github.com/webrtc/adapter
import "./adapter.mjs";
import { stream } from "/media.js";
import { stunServers } from "./stun-servers.js";
import { io } from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js";
import dateFnsFormat from "https://cdn.jsdelivr.net/npm/date-fns@2.29.2/esm/format/index.js";
const socket = io();

const USER_ID = Math.floor(Math.random() * (100_000 - 1) + 0);
const SOCKET_MESSAGE = "message";

let peerConnection = null;

const form = document.querySelector("#form");
const message = document.querySelector("#message");
const messages = document.querySelector("#messages");
const localStreamVideo = document.querySelector("#local-stream");
const remoteStreamVideo = document.querySelector("#remote-stream");
const buttonMic = document.querySelector("#mic");
const buttonCamera = document.querySelector("#camera");
const buttonHangup = document.querySelector("#hangup");

if (buttonMic) {
  buttonMic.addEventListener("click", () => {
    buttonMic.classList.toggle("active");
  });
}

if (buttonCamera) {
  buttonCamera.addEventListener("click", () => {
    buttonCamera.classList.toggle("active");
  });
}

if (buttonHangup) {
  buttonHangup.addEventListener("click", () => {
    buttonHangup.classList.add("active");
    buttonHangup.setAttribute("disabled", "true");
  });
}

if (remoteStreamVideo) {
  remoteStreamVideo.addEventListener("loadedmetadata", () => {
    remoteStreamVideo.play();
    remoteStreamVideo.classList.toggle("active");

    if (localStreamVideo) {
      localStreamVideo.classList.toggle("active");
    }
  });
}

function createMessage(message) {
  const li = document.createElement("li");
  const dateSpan = document.createElement("span");
  dateSpan.style.marginRight = "4px";
  const messageSpan = document.createElement("span");
  const currentTime = dateFnsFormat(new Date(), "hh:mm a");
  const toHTML = document.createElement("span");
  toHTML.innerHTML = message;

  dateSpan.textContent = currentTime + ":";
  messageSpan.textContent = toHTML.textContent;
  li.appendChild(dateSpan);
  li.appendChild(messageSpan);
  if (messages) {
    messages.appendChild(li);
  }
}

const createPeerConnection = () => {
  peerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: stunServers,
      },
    ],
  });

  if (stream) {
    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });
  }

  const remoteStream = new MediaStream();

  peerConnection.addEventListener("track", (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
    if (remoteStreamVideo) {
      remoteStreamVideo.srcObject = remoteStream;
    }
  });

  peerConnection.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      socket.emit(SOCKET_MESSAGE, { type: "ice-candidate", roomId: ROOM_ID, candidate: event.candidate });
    }
  });
};

const createOffer = async () => {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit(SOCKET_MESSAGE, { type: "offer-sdp", roomId: ROOM_ID, userId: USER_ID, offer });
};

const receiveOffer = async (offer) => {
  await peerConnection.setRemoteDescription(offer);
};

const createAnswer = async () => {
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit(SOCKET_MESSAGE, { type: "answer-sdp", roomId: ROOM_ID, userId: USER_ID, answer });
};

const receiveAnswer = async (answer) => {
  await peerConnection.setRemoteDescription(answer);
};

const addIceCandidate = async (candidate) => {
  peerConnection.addIceCandidate(candidate);
};

socket.on(SOCKET_MESSAGE, async (data) => {
  try {
    const { type } = data;
    switch (type) {
      case "chat-message":
        createMessage(data.msg);
        break;
      case "join-room":
        createMessage(`User ${data.userId} has joined.`);
        await createPeerConnection();
        await createOffer();
        break;
      case "leave-room":
        createMessage(`User ${data.userId} has left.`);
        if (remoteStreamVideo) {
          remoteStreamVideo.classList.toggle("active");
        }
        if (localStreamVideo) {
          localStreamVideo.classList.toggle("active");
        }
        peerConnection.close();
        break;
      case "offer-sdp":
        await createPeerConnection();
        await receiveOffer(data.offer);
        await createAnswer();
        break;
      case "answer-sdp":
        await receiveAnswer(data.answer);
        break;
      case "ice-candidate":
        await addIceCandidate(data.candidate);
        break;
    }
  } catch (err) {
    console.log(err);
  }
});

if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (message?.value) {
      socket.emit(SOCKET_MESSAGE, { type: "chat-message", roomId: ROOM_ID, msg: message.value });
      message.value = "";
    }
  });
}

const init = () => {
  socket.emit(SOCKET_MESSAGE, { type: "join-room", roomId: ROOM_ID, userId: USER_ID });
};

init();
