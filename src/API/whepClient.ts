export type WhepSession = {
  pc: RTCPeerConnection;
  close: () => void;
};

function absolutizeLocation(whepUrl: string, loc: string) {
  try {
    // If Location is relative, make it absolute.
    if (loc.startsWith("http://") || loc.startsWith("https://")) return loc;
    const u = new URL(whepUrl);
    return new URL(loc, u.origin).toString();
  } catch {
    return loc;
  }
}

function waitIceGatheringComplete(pc: RTCPeerConnection, signal?: AbortSignal) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const onStateChange = () => {
      if (pc.iceGatheringState === "complete") {
        cleanup();
        resolve();
      }
    };
    const cleanup = () => {
      try {
        pc.removeEventListener("icegatheringstatechange", onStateChange);
      } catch {}
      try {
        signal?.removeEventListener("abort", onAbort);
      } catch {}
    };

    pc.addEventListener("icegatheringstatechange", onStateChange);
    signal?.addEventListener("abort", onAbort);
  });
}

/**
 * Minimal WHEP playback implementation:
 * - create recvonly offer
 * - wait ICE gathering complete (non-trickle)
 * - POST offer SDP to WHEP endpoint
 * - set answer SDP
 * - attach remote stream to a video element
 */
export async function startWhepPlayback(opts: {
  whepUrl: string;
  videoEl: HTMLVideoElement;
  signal?: AbortSignal;
}): Promise<WhepSession> {
  const { whepUrl, videoEl, signal } = opts;

  const pc = new RTCPeerConnection({
    iceServers: [],
  });

  // Receive both tracks if available.
  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });

  pc.ontrack = (ev) => {
    const stream = ev.streams?.[0];
    if (!stream) return;
    videoEl.srcObject = stream;
    // Autoplay can be blocked in some browsers unless muted.
    videoEl.play().catch(() => {});
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitIceGatheringComplete(pc, signal);

  const sdpOffer = pc.localDescription?.sdp;
  if (!sdpOffer) throw new Error("Failed to create local SDP offer");

  const res = await fetch(whepUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/sdp",
      Accept: "application/sdp",
    },
    body: sdpOffer,
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    pc.close();
    throw new Error(`WHEP POST failed: HTTP ${res.status} ${res.statusText} ${body}`);
  }

  const answerSdp = await res.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

  const loc = res.headers.get("location");
  const sessionUrl = loc ? absolutizeLocation(whepUrl, loc) : null;

  const close = () => {
    try {
      pc.ontrack = null;
    } catch {}
    try {
      pc.close();
    } catch {}
    if (sessionUrl) {
      // Best effort cleanup.
      fetch(sessionUrl, { method: "DELETE" }).catch(() => {});
    }
  };

  return { pc, close };
}
