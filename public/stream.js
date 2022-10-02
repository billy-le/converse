"use strict";

async function getScreenCastMedia() {
  if ("mediaDevices" in window.navigator && "getDisplayMedia" in window.navigator.mediaDevices) {
    const screenCaptureStream = await window.navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: 60
      },
      audio: false
    });

    return screenCaptureStream;
  }
}

export { getScreenCastMedia };
