import { stunServers } from "./stun-servers.js";

export class Peer {
  #connection;
  #target;
  #emitter;

  constructor({ target, emitter }) {
    this.#connection = new RTCPeerConnection({
      iceServers: [
        {
          urls: stunServers,
        },
      ],
    });
    this.#target = target;
    this.#emitter = emitter;

    this.#connection.addEventListener("connectionstatechange", (event) => {});

    this.#connection.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        this.#emitter.emit("peer:ice-candidate", { candidate: event.candidate, target: this.#target });
      }
    });

    this.#connection.addEventListener("icecandidateerror", (event) => {});

    this.#connection.addEventListener("iceconnectionstatechange", (event) => {});

    this.#connection.addEventListener("icegatheringstatechange", (event) => {});

    this.#connection.addEventListener("negotiationneeded", async (event) => {
      if (event.target.localDescription) {
        this.#emitter.emit("peer:negotiation", { target: this.#target });
      }
    });

    this.#connection.addEventListener("signalingstatechange", (event) => {});

    this.#connection.addEventListener("track", (event) => {
      const remoteStream = new MediaStream();

      event.streams.forEach((stream) => {
        stream.getTracks().forEach((track) => {
          remoteStream.addTrack(track);
          if (track.kind.includes("video")) {
            this.#emitter.emit("stream:add-video", {
              track,
              target: this.#target,
              remoteStream,
            });
          }
        });

        stream.addEventListener("removetrack", (event) => {
          remoteStream.getTracks().forEach((track) => {
            if (track.id === event.track.id) {
              this.#emitter.emit("stream:remove-video", { track });
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

  async answer(offer) {
    await this.#connection.setRemoteDescription(offer);

    const answer = await this.#connection.createAnswer();
    await this.#connection.setLocalDescription(answer);
    return this.#connection.localDescription;
  }

  async answerFeedback(answer) {
    await this.#connection.setRemoteDescription(answer);
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
