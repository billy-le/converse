// polyfill https://github.com/webrtc/adapter
import "./adapter.mjs";
import { stream } from "/media.js";
import { stunServers } from "./stun-servers.js";
import { io } from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js";
import dateFnsFormat from "https://cdn.jsdelivr.net/npm/date-fns@2.29.2/esm/format/index.js";
const socket = io("/");

const USER_ID = Math.floor(Math.random() * (100_000 - 1) + 0);
const SOCKET_MESSAGE = "message";

let peerConnection = null;

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

socket.on(SOCKET_MESSAGE, async (data) => {
  try {
    const { type } = data;
    switch (type) {
      case "chat-message":
        createMessage(data.msg);
        break;
      case "join-room":
        createMessage(`user ${data.userId} has joined the chat room`);
        if (!peerConnection) throw Error("no peer connection");

        peerConnection.addEventListener("negotiationneeded", async (event) => {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          socket.emit(SOCKET_MESSAGE, { type: "offer-sdp", roomId: ROOM_ID, offer });
        });

        peerConnection.addEventListener("icecandidate", (event) => {
          if (event.candidate) {
            socket.emit(SOCKET_MESSAGE, { type: "ice-candidate", roomId: ROOM_ID, candidate: event.candidate });
          }
        });

        peerConnection.addEventListener("track", (event) => {
          event.streams[0].getTracks().forEach((track) => {
            const remoteStream = new MediaStream();

            remoteStream.addTrack(track);

            const video = document.createElement("video");
            video.srcObject = remoteStream;
            video.style.height = "90px";
            video.style.width = "160px";
            video.style.objectFit = "contain";
            video.style.position = "absolute";
            video.style.top = "0";
            video.style.left = "0";
            video.setAttribute("data-user-video", data.userId);

            const videoContainer = document.querySelector(".main");
            if (videoContainer) {
              videoContainer.appendChild(video);
            }
          });
        });

        break;
      case "leave-room":
        createMessage(`user ${data.userId} has left the chat room`);
        const userVideo = document.querySelector(`[data-user-video=${data.userId}]`);
        if (userVideo) {
          userVideo.remove();
        }
        break;
      case "offer-sdp":
        if (!peerConnection) throw Error("no peer connection");
        await peerConnection.setRemoteDescription(data.offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit(SOCKET_MESSAGE, { type: "answer-sdp", roomId: ROOM_ID, answer });
        break;
      case "answer-sdp":
        if (!peerConnection) throw Error("no peer connection");
        await peerConnection.setRemoteDescription(data.answer);
        break;
      case "ice-candidate":
        if (!peerConnection) throw Error("no peer connection");
        peerConnection.addIceCandidate(data.candidate);
        break;
    }
  } catch (err) {
    console.log(err);
  }
});

window.addEventListener("beforeunload", () => {
  const socket = io();
  socket.emit(SOCKET_MESSAGE, { type: "leave-room", roomId: ROOM_ID, userId: USER_ID });
  peerConnection.close();
});

const init = async () => {
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

  socket.emit(SOCKET_MESSAGE, { type: "join-room", roomId: ROOM_ID, userId: USER_ID });
};

const form = document.querySelector("#form");
const message = document.querySelector("#message");
const messages = document.querySelector("#messages");

if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (message?.value) {
      socket.emit(SOCKET_MESSAGE, { type: "chat-message", roomId: ROOM_ID, msg: message.value });
      message.value = "";
    }
  });
}

init();
