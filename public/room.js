"use strict";

window.addEventListener("DOMContentLoaded", async () => {
  const SocketIO = await import("https://cdn.socket.io/4.4.1/socket.io.esm.min.js");
  const socket = SocketIO.io();
  const USER_ID = Math.floor(Math.random() * (100_000 - 1) + 0);
  const ROOM_MESSAGE = "room";
  let peerConnections = new Map();

  window.addEventListener("message:send", (e) => {
    socket.emit(ROOM_MESSAGE, { type: "chat-message", roomId: ROOM_ID, userId: USER_ID, msg: e.detail.message });
    e.detail.clear();
  });

  window.addEventListener("stream:join", () => {
    socket.emit(ROOM_MESSAGE, { type: "join-stream", roomId: ROOM_ID, userId: USER_ID });
  });

  window.addEventListener("stream:stop", () => {
    socket.emit(ROOM_MESSAGE, { type: "leave-stream", roomId: ROOM_ID, userId: USER_ID });
  });

  window.addEventListener("stream:remove-track", (event) => {
    const {
      detail: { trackId },
    } = event;

    peerConnections.forEach((peer) => {
      const senders = peer.getSenders();
      const sender = senders.find((sender) => sender.track?.id === trackId);
      if (sender) {
        peer.removeTrack(sender);
      }
    });
  });

  window.addEventListener("stream:add-screen-cast", (event) => {
    const {
      detail: { track, screenCast },
    } = event;

    peerConnections.forEach((peer) => {
      peer.addTrack(track, screenCast);
    });
  });

  window.addEventListener("negotiation:offer", (event) => {
    const { offer } = event.detail;
    if (offer) {
      socket.emit(ROOM_MESSAGE, { type: "offer-sdp", roomId: ROOM_ID, userId: USER_ID, offer });
    }
  });

  function dispatchMessageReceive(data) {
    const event = new CustomEvent("message:receive", { detail: data });
    window.dispatchEvent(event);
  }

  function dispatchMessageStreamers(data) {
    const event = new CustomEvent("message:streamers", {
      detail: data,
    });
    window.dispatchEvent(event);
  }

  socket.on(ROOM_MESSAGE, async (data) => {
    try {
      const { type } = data;
      switch (type) {
        case "chat-message": {
          dispatchMessageReceive({ ...data, isCurrentUser: data.userId === USER_ID });
          break;
        }
        case "join-room": {
          dispatchMessageReceive({
            msg:
              data.userId === USER_ID
                ? `Welcome to Room "${ROOM_ID}". You are designated as User ${USER_ID}.`
                : `User ${data.userId} has joined.`,
          });
          break;
        }
        case "current-streamers": {
          const { streamers } = data;
          if (streamers?.length && data.userId === USER_ID) {
            const users = streamers.map((userId) => `User ${userId}`).join(", ");
            dispatchMessageReceive({
              msg: `${users} ${streamers.length > 1 ? "are" : "is"} currently streaming.`,
            });
            dispatchMessageStreamers({
              streamers,
              isStreaming: streamers.includes(USER_ID),
            });
          }
          break;
        }
        case "join-stream": {
          dispatchMessageReceive({
            msg: data.userId === USER_ID ? `You have joined the stream.` : `User ${data.userId} joined the stream.`,
          });
          break;
        }
        case "user-streamer": {
          const { streamers } = data;
          if (streamers?.includes(USER_ID) && !peerConnections.has(data.userId)) {
            const peer = await import("./peer.js").then(
              ({ Peer }) =>
                new Peer({
                  target: data.userId,
                  onIceCandidate: (event) => {
                    socket.emit(ROOM_MESSAGE, {
                      type: "ice-candidate",
                      roomId: ROOM_ID,
                      userId: USER_ID,
                      candidate: event.candidate,
                      target: data.userId,
                    });
                  },
                })
            );

            const localStream = document.querySelector("#local-stream");
            localStream.srcObject.getTracks().forEach((track) => {
              peer.addTrack(track, localStream.srcObject);
            });

            peerConnections.set(data.userId, peer);

            await peer.call().then((offer) => {
              if (offer) {
                socket.emit(ROOM_MESSAGE, { type: "offer-sdp", roomId: ROOM_ID, userId: USER_ID, offer });
              }
            });
          }

          dispatchMessageStreamers({
            streamers,
            isStreaming: streamers.includes(USER_ID),
          });
          break;
        }
        case "leave-stream": {
          dispatchMessageReceive({
            msg: data.userId === USER_ID ? "You have left the stream" : `User ${data.userId} has left the stream.`,
          });

          if (data.userId !== USER_ID) {
            const peer = peerConnections.get(data.userId);
            if(peer) {
              peer.close();
            }
            peerConnections.delete(data.userId);
            const event = new CustomEvent("stream:disconnect", {
              detail: {
                target: data.userId,
              },
            });
            window.dispatchEvent(event);
          } else {
            peerConnections.forEach((peer) => {
              peer.close();
            });
            peerConnections = new Map();
          }

          dispatchMessageStreamers({
            streamers: data.streamers,
            isStreaming: data.streamers.includes(USER_ID),
          });
          break;
        }
        case "leave-room": {
          dispatchMessageReceive({
            msg: `User ${data.userId} has left.`,
          });

          const peer = peerConnections.get(data.userId);

          if (peer) {
            peer.close();
            const event = new CustomEvent("stream:disconnect", {
              detail: {
                target: data.userId,
              },
            });
            window.dispatchEvent(event);
          }

          peerConnections.delete(data.userId);

          dispatchMessageStreamers({
            streamers: data.streamers,
            isStreaming: data.streamers.includes(USER_ID),
          });
          break;
        }
        case "offer-sdp": {
          const { streamers } = data;
          if (streamers.includes(USER_ID)) {
            let peer = peerConnections.get(data.userId);
            if (!peer) {
              peer = await import("./peer.js").then(
                ({ Peer }) =>
                  new Peer({
                    target: data.userId,
                    onIceCandidate: (event) => {
                      socket.emit(ROOM_MESSAGE, {
                        type: "ice-candidate",
                        roomId: ROOM_ID,
                        userId: USER_ID,
                        candidate: event.candidate,
                        target: data.userId,
                      });
                    },
                  })
              );

              const localStream = document.querySelector("#local-stream");
              localStream.srcObject.getTracks().forEach((track) => {
                peer.addTrack(track, localStream.srcObject);
              });

              peerConnections.set(data.userId, peer);
            }

            await peer.answer(data.offer).then((offer) => {
              if (offer) {
                socket.emit(ROOM_MESSAGE, {
                  type: "answer-sdp",
                  roomId: ROOM_ID,
                  userId: USER_ID,
                  answer: offer,
                  target: data.userId,
                });
              }
            });
          }
          break;
        }
        case "answer-sdp": {
          const { streamers } = data;
          if (streamers.includes(USER_ID) && USER_ID === data.target) {
            const peer = peerConnections.get(data.userId);
            if (peer) {
              await peer.answer(data.answer);
            }
          }
          break;
        }
        case "ice-candidate":
          {
            const { streamers } = data;
            if (streamers.includes(USER_ID) && USER_ID === data.target) {
              const peer = peerConnections.get(data.userId);
              if (peer) {
                peer.addIceCandidate(data.candidate);
              }
            }
          }
          break;
      }
    } catch (err) {
      console.log(err);
    }
  });

  socket.emit(ROOM_MESSAGE, { type: "join-room", roomId: ROOM_ID, userId: USER_ID });
});
