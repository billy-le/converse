import { stunServers } from "./stun-servers.js";

export class Peer {
  #connection;
  #target;
  #onIceCandidate;

  constructor({ target, onIceCandidate }) {
    this.#connection = new RTCPeerConnection({
      iceServers: [
        {
          urls: stunServers,
        },
      ],
    });
    this.#target = target;
    this.#onIceCandidate = onIceCandidate;

    this.#connection.addEventListener("connectionstatechange", (event) => {});

    this.#connection.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        this.#onIceCandidate({ candidate: event.candidate });
      }
    });

    this.#connection.addEventListener("icecandidateerror", (event) => {});

    this.#connection.addEventListener("iceconnectionstatechange", (event) => {});

    this.#connection.addEventListener("icegatheringstatechange", (event) => {});

    this.#connection.addEventListener("negotiationneeded", async (event) => {
      if (event.target.localDescription) {
        const offer = await this.call();
        const event = new CustomEvent("negotiation:offer", {
          detail: {
            offer,
          },
        });
        window.dispatchEvent(event);
      }
    });

    this.#connection.addEventListener("signalingstatechange", (event) => {});

    this.#connection.addEventListener("track", (event) => {
      const remoteStream = new MediaStream();
      event.streams.forEach((stream) => {
        stream.getTracks().forEach((track) => {
          remoteStream.addTrack(track);
          if (track.kind.includes("video")) {
            const event = new CustomEvent("stream:add-video", {
              detail: {
                track,
                target: this.#target,
                remoteStream,
              },
            });

            window.dispatchEvent(event);
          }
        });

        stream.addEventListener("removetrack", (event) => {
          remoteStream.getTracks().forEach((track) => {
            if (track.id === event.track.id) {
              const event = new CustomEvent("stream:remove-video", {
                detail: {
                  track,
                },
              });

              window.dispatchEvent(event);
            }
          });
        });
      });
    });
  }

  async call() {
    const offer = await this.#connection.createOffer;
    await this.#connection.setLocalDescription(offer);

    return this.#connection.localDescription;
  }

  async answer(sdp) {
    await this.#connection.setRemoteDescription(sdp);

    if (!this.#connection.currentLocalDescription) {
      const answer = await this.#connection.createAnswer();
      await this.#connection.setLocalDescription(answer);
      return this.#connection.localDescription;
    } else {
      return null;
    }
  }

  addTrack(track, ...streams) {
      this.#connection.addTrack(track, ...streams);
  }

  removeTrack(track) {
    this.#connection.removeTrack(track);
  }

  getSenders() {
    const senders = this.#connection.getSenders();
    return senders;
  }

  async addIceCandidate(candidate) {
    await this.#connection.addIceCandidate(candidate);
  }

  close() {
    this.#connection.close();
  }
}
