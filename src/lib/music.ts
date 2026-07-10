/**
 * Turn a pasted song link into a known provider + an embeddable player URL.
 * Pure and dependency-free so it runs on the server and the client.
 */

export interface ParsedTrack {
  provider: string;
  embedUrl: string | null;
}

function youtubeId(u: URL): string | null {
  if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
  if (u.hostname.endsWith("youtube.com")) {
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const m = u.pathname.match(/^\/(embed|shorts|v)\/([^/?]+)/);
    if (m) return m[2];
  }
  return null;
}

export function parseTrackUrl(raw: string): ParsedTrack {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { provider: "other", embedUrl: null };
  }
  const host = u.hostname.replace(/^www\./, "");

  // YouTube
  const yt = youtubeId(u);
  if (yt) {
    return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/${yt}` };
  }

  // Spotify — open.spotify.com/[intl-xx/]<type>/<id>
  if (host === "open.spotify.com") {
    const m = u.pathname.match(/\/(track|album|playlist|episode|show)\/([^/?]+)/);
    if (m) {
      return {
        provider: "spotify",
        embedUrl: `https://open.spotify.com/embed/${m[1]}/${m[2]}`,
      };
    }
  }

  // Apple Music — swap host to the embed host, keep the rest.
  if (host === "music.apple.com") {
    return {
      provider: "apple",
      embedUrl: `https://embed.music.apple.com${u.pathname}${u.search}`,
    };
  }

  // SoundCloud — the widget player takes the original URL as a param.
  if (host === "soundcloud.com") {
    const encoded = encodeURIComponent(u.toString());
    return {
      provider: "soundcloud",
      embedUrl: `https://w.soundcloud.com/player/?url=${encoded}&color=%23d96f4e&auto_play=false`,
    };
  }

  return { provider: "other", embedUrl: null };
}

/** Friendly label for a provider id. */
export function providerLabel(provider: string): string {
  switch (provider) {
    case "youtube":
      return "YouTube";
    case "spotify":
      return "Spotify";
    case "apple":
      return "Apple Music";
    case "soundcloud":
      return "SoundCloud";
    default:
      return "Link";
  }
}
