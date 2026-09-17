import { createEffect, onCleanup } from "solid-js";

import { useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { useState } from "@revolt/state";

import { useUser } from ".";

/**
 * How often to poll for the currently playing Spotify track. Kept short so
 * a track change shows up close to live - Spotify's currently-playing
 * endpoint is cheap enough per-user to poll this often.
 */
const POLL_INTERVAL_MS = 3_000;

/**
 * Minimum time between self.edit() calls. Stoat's own API rate-limits
 * PATCH /users/@me to 2 requests per 10s (crates/delta/src/util/
 * ratelimits.rs, bucket "user_edit") - polling this often means a track
 * change right at a pause/resume boundary (Spotify's is_playing flaps
 * briefly there) can fire multiple edits within that window and get
 * 429'd, which was knocking the whole client into a reconnect. Detection
 * still happens every POLL_INTERVAL_MS; this only throttles how often we
 * actually act on it.
 */
const MIN_EDIT_GAP_MS = 6_000;

/**
 * Matches the `Activity` shape from stoat-api's generated schema
 * (server-side: crates/core/models/src/v0/users.rs) - defined locally since
 * this package doesn't otherwise depend on stoat-api directly.
 */
type Activity = {
  type: "Spotify";
  track_id: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  album_art_url: string;
  track_url: string;
  duration_ms: number;
  progress_ms: number;
  timestamp: number;
};

/**
 * Base path for the spotify-service, proxied same-origin through Caddy.
 */
const SPOTIFY_SERVICE_URL = "/spotify-svc";

/**
 * stoat-api's published types (which stoat.js's own DataEditUser type comes
 * from) don't declare `activity`/`StatusActivity` - that's a server-side
 * addition (crates/core/models/src/v0/users.rs) that can't be reflected in
 * the published package from this repo. The server accepts and returns the
 * field regardless (verified directly), so this narrowly widens just the
 * one call site rather than casting `self.edit` itself.
 */
function editWithActivity(
  self: { edit: (data: never) => Promise<unknown> },
  data:
    | {
        status: {
          text?: string | null;
          presence?: string | null;
          activity: Activity;
        };
      }
    | { remove: ("StatusActivity" | "StatusText")[] },
) {
  return self.edit(data as never);
}

/**
 * Automatically reflects the currently playing Spotify track as the user's
 * status activity, once they've connected Spotify and opted in. Mirrors
 * ActivityStatusWorker's shape: a headless global worker that polls on an
 * interval and only calls self.edit() when the reported activity changes.
 */
export function SpotifyActivityWorker() {
  const { settings } = useState();
  const client = useClient();
  const user = useUser();
  const { t } = useLingui();

  let interval: ReturnType<typeof setInterval> | undefined;
  let lastTrackId: string | undefined;
  let lastEditAt = 0;

  async function poll() {
    const self = user();
    if (!self) {
      console.debug("[SpotifyActivity] skipping poll: no logged-in user yet");
      return;
    }

    const [authHeader, authHeaderValue] = client()!.authenticationHeader;

    let activity: Activity | null = null;
    try {
      const res = await fetch(`${SPOTIFY_SERVICE_URL}/now-playing`, {
        headers: { [authHeader]: authHeaderValue },
      });

      if (res.status === 204) {
        activity = null;
      } else if (res.ok) {
        activity = await res.json();
      } else {
        console.debug("[SpotifyActivity] now-playing request failed", res.status);
        return;
      }
    } catch (err) {
      console.error("[SpotifyActivity] now-playing request threw", err);
      return;
    }

    const trackId = activity?.track_id;
    if (trackId === lastTrackId) {
      // Same track still playing - progress_ms/timestamp update every poll,
      // but the visible card interpolates that locally, so skip the edit.
      return;
    }

    if (Date.now() - lastEditAt < MIN_EDIT_GAP_MS) {
      // lastTrackId deliberately not updated - retry on the next poll
      // once the cooldown has passed, rather than dropping this change.
      return;
    }
    lastTrackId = trackId;
    lastEditAt = Date.now();

    try {
      if (activity) {
        await editWithActivity(self, {
          status: {
            ...self.status,
            text: t`Listening to ${activity.track_name} by ${activity.artist_name}`,
            activity,
          },
        });
      } else {
        // Mirrors ActivityStatusWorker's "Playing X" - drops whatever
        // custom status text was showing before, same trade-off that
        // worker already makes while its toggle is on.
        await editWithActivity(self, {
          remove: ["StatusActivity", "StatusText"],
        });
      }
      console.debug("[SpotifyActivity] status updated ->", trackId);
    } catch (err) {
      console.error("[SpotifyActivity] failed to update status", err);
    }
  }

  createEffect(() => {
    const enabled = settings.getValue("spotify:enabled");

    if (enabled && !interval) {
      poll();
      interval = setInterval(poll, POLL_INTERVAL_MS);
    } else if (!enabled && interval) {
      clearInterval(interval);
      interval = undefined;
    }
  });

  onCleanup(() => {
    if (interval) clearInterval(interval);
  });

  return null;
}
