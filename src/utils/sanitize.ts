import sanitizeHtml from "sanitize-html";

/** Strip every HTML tag. React still escapes on render; this is defense in depth. */
export function sanitizeText(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  }).trim();
}

const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

export function sanitizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!SAFE_PROTOCOLS.has(parsed.protocol)) {
    throw new Error("URL protocol must be http or https");
  }
  return parsed.toString();
}

/** Accept only real YouTube watch / share / embed URLs and return the 11-char id. */
export function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "");
  let id = "";

  if (host === "youtu.be") {
    id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (parsed.pathname === "/watch") {
      id = parsed.searchParams.get("v") ?? "";
    } else if (parsed.pathname.startsWith("/embed/") || parsed.pathname.startsWith("/shorts/")) {
      id = parsed.pathname.split("/").filter(Boolean)[1] ?? "";
    }
  } else {
    return null;
  }

  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

export function toYoutubeEmbedUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const id = extractYoutubeId(trimmed);
  if (!id) {
    throw new Error("youtube_url must be a valid YouTube link");
  }
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeEmbedSrc(youtubeUrl: string): string | null {
  const id = extractYoutubeId(youtubeUrl);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}
