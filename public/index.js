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
const buttonCopyLink = document.querySelector("#copy-link");

if (buttonMic) {
  buttonMic.addEventListener("pointerdown", () => {
    buttonMic.classList.toggle("active");
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
  });
}

if (buttonCamera) {
  buttonCamera.addEventListener("pointerdown", () => {
    buttonCamera.classList.toggle("active");
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
  });
}

if (buttonHangup) {
  buttonHangup.addEventListener("pointerdown", () => {
    buttonHangup.classList.add("active");
    buttonHangup.setAttribute("disabled", "true");
    if (remoteStreamVideo) {
      remoteStreamVideo.classList.remove("active");
      remoteStreamVideo.srcObject = null;
    }
    if (localStreamVideo) {
      localStreamVideo.classList.remove("active");
    }
    socket.emit(SOCKET_MESSAGE, { type: "leave-room", roomId: ROOM_ID, userId: USER_ID });
    peerConnection.close();
  });
}

if (buttonCopyLink) {
  buttonCopyLink.addEventListener("pointerdown", async () => {
    if (window.navigator?.clipboard) {
      await window.navigator.clipboard.writeText(window.location.href);
    }
  });
}

if (remoteStreamVideo) {
  remoteStreamVideo.addEventListener("loadedmetadata", () => {
    remoteStreamVideo.play();
    remoteStreamVideo.classList.add("active");

    if (localStreamVideo) {
      localStreamVideo.classList.add("active");
    }
  });
}

function toHTML(element) {
  const toHTML = document.createElement("span");
  toHTML.innerHTML = element;
  return toHTML.textContent;
}

function createMessage({ msg, userId }) {
  const li = document.createElement("li");

  const chatMessageContainer = document.createElement("div");
  chatMessageContainer.classList.add("chat-message");

  if (userId) {
    const isCurrentUser = userId === USER_ID;

    const messageContainer = document.createElement("div");
    messageContainer.classList.add("message-container");
    const message = document.createElement("p");
    message.classList.add("message");
    message.textContent = toHTML(msg);

    const date = document.createElement("div");
    date.classList.add("date");

    const currentTime = dateFnsFormat(new Date(), "hh:mm a");
    date.append(currentTime);

    messageContainer.append(date, message);

    const avatar = document.createElement("div");
    avatar.classList.add("avatar");

    if (isCurrentUser) {
      chatMessageContainer.classList.add("reverse");
      avatar.classList.add("current-user");
      avatar.textContent = "Me";
    } else {
      avatar.classList.add("user");
      avatar.textContent = toHTML(userId);
    }

    chatMessageContainer.append(avatar, messageContainer);
  } else {
    const systemMessage = document.createElement("p");
    systemMessage.classList.add("system-message");
    systemMessage.textContent = toHTML(msg);

    chatMessageContainer.append(systemMessage);
  }

  li.appendChild(chatMessageContainer);

  if (messages) {
    messages.appendChild(li);
    messages.scrollTo({ top: messages.scrollHeight, behavior: "smooth" });
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

  peerConnection.addEventListener("connectionstatechange", () => {
    if (peerConnection.connectionState === "connected" && buttonHangup) {
      buttonHangup.removeAttribute("disabled");
      buttonHangup.classList.remove("active");
    }
  });

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
        createMessage(data);
        break;
      case "join-room":
        createMessage({ msg: `User ${data.userId} has joined.` });
        await createPeerConnection();
        await createOffer();
        break;
      case "leave-room":
        createMessage({ msg: `User ${data.userId} has left.` });
        if (remoteStreamVideo) {
          remoteStreamVideo.classList.remove("active");
          remoteStreamVideo.srcObject = null;
        }
        if (localStreamVideo) {
          localStreamVideo.classList.remove("active");
        }
        if (buttonHangup) {
          buttonHangup.setAttribute("disabled", "true");
          buttonHangup.classList.add("active");
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
      socket.emit(SOCKET_MESSAGE, { type: "chat-message", roomId: ROOM_ID, userId: USER_ID, msg: message.value });
      message.value = "";
    }
  });
}

const init = () => {
  socket.emit(SOCKET_MESSAGE, { type: "join-room", roomId: ROOM_ID, userId: USER_ID });
};

init();
