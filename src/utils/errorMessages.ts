// Classify an unknown thrown value into a user-friendly message.
// All messages are written in plain English — no raw error strings exposed.

function isNetworkLike(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    return (
      m.includes("network") ||
      m.includes("fetch") ||
      m.includes("timeout") ||
      m.includes("connect") ||
      m.includes("abort") ||
      m.includes("unreachable")
    );
  }
  return false;
}

export const ERRORS = {
  chat: {
    network:
      "Hmm… your network connection may be unstable. Please check your connection and try again.",
    generic:
      "Couldn't reach your AI coach right now. Please try again.",
  },

  voice: {
    network:
      "Hmm… your network seems unstable. You can switch to manual input to continue.",
    permission:
      "Microphone access is needed to record. Please enable it in your phone settings.",
    noAudio:
      "No audio was captured. Please tap the mic and try speaking again.",
    processing:
      "Couldn't process your voice right now. You can switch to manual input to continue.",
    generic:
      "Voice input isn't working right now. Please try manual input instead.",
  },

  save: {
    network:
      "Couldn't save — your connection seems unstable. Please check your network and try again.",
    generic:
      "Couldn't save. Please try again.",
  },

  parse: {
    network:
      "Couldn't parse your input — network seems unstable. Try again or switch to manual entry.",
    generic:
      "Couldn't understand the input. Please try again or use manual entry.",
  },
} as const;

export function chatErrorMessage(err: unknown): string {
  return isNetworkLike(err) ? ERRORS.chat.network : ERRORS.chat.generic;
}

export function voiceErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    if (m.includes("permission") || m.includes("denied")) return ERRORS.voice.permission;
    if (m.includes("no audio") || m.includes("no recording")) return ERRORS.voice.noAudio;
  }
  return isNetworkLike(err) ? ERRORS.voice.network : ERRORS.voice.processing;
}

export function saveErrorMessage(err: unknown): string {
  return isNetworkLike(err) ? ERRORS.save.network : ERRORS.save.generic;
}

export function parseErrorMessage(err: unknown): string {
  return isNetworkLike(err) ? ERRORS.parse.network : ERRORS.parse.generic;
}
