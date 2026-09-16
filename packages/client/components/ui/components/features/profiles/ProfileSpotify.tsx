import { Show, createSignal, onCleanup, onMount } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { OverflowingText } from "@revolt/ui";
import { User } from "stoat.js";
import { styled } from "styled-system/jsx";

import { Text } from "../../design";

import { ProfileCard } from "./ProfileCard";

type SpotifyActivity = {
  type: "Spotify";
  track_name: string;
  artist_name: string;
  album_art_url: string;
  track_url: string;
  duration_ms: number;
  progress_ms: number;
  timestamp: number;
};

function formatMs(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ProfileSpotify(props: {
  user: User;
  /** Full width, height fits content (used in the floating user card) */
  fluid?: boolean;
}) {
  // The SDK's own status type doesn't declare `activity` (see
  // SpotifyActivityWorker.tsx for why - stoat-api's published types can't be
  // patched from this repo), but the server sends it and self.edit() already
  // accepts writing it, so read it back via a cast rather than a real field.
  const activity = () =>
    (props.user.status as { activity?: SpotifyActivity } | undefined)
      ?.activity;

  // Ticks once a second so the progress bar advances smoothly between the
  // ~20s polls that actually update `activity`, instead of jumping in steps.
  const [now, setNow] = createSignal(Date.now());
  let interval: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    interval = setInterval(() => setNow(Date.now()), 1000);
  });
  onCleanup(() => interval && clearInterval(interval));

  const progressMs = () => {
    const a = activity();
    if (!a) return 0;
    return Math.min(a.duration_ms, a.progress_ms + (now() - a.timestamp));
  };

  const progressPercent = () => {
    const a = activity();
    if (!a || a.duration_ms === 0) return 0;
    return (progressMs() / a.duration_ms) * 100;
  };

  return (
    <Show when={activity()}>
      {(a) => (
        <ProfileCard width={props.fluid ? "full" : 2}>
          <Text class="title" size={props.fluid ? "small" : "large"}>
            <Trans>Listening to Spotify</Trans>
          </Text>
          <Row>
            <AlbumArt src={a().album_art_url} />
            <Details>
              <TrackLink
                href={a().track_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <OverflowingText>{a().track_name}</OverflowingText>
              </TrackLink>
              <OverflowingText>
                <Artist>{a().artist_name}</Artist>
              </OverflowingText>
              <ProgressTrack>
                <ProgressFill style={{ width: `${progressPercent()}%` }} />
              </ProgressTrack>
              <TimeRow>
                <span>{formatMs(progressMs())}</span>
                <span>{formatMs(a().duration_ms)}</span>
              </TimeRow>
            </Details>
          </Row>
        </ProfileCard>
      )}
    </Show>
  );
}

const Row = styled("div", {
  base: {
    display: "flex",
    gap: "var(--gap-md)",
    alignItems: "center",
    minWidth: 0,
  },
});

const AlbumArt = styled("img", {
  base: {
    width: "56px",
    height: "56px",
    borderRadius: "var(--borderRadius-md)",
    objectFit: "cover",
    flexShrink: 0,
  },
});

const Details = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
    flexGrow: 1,
  },
});

const TrackLink = styled("a", {
  base: {
    fontWeight: 600,
    color: "var(--md-sys-color-on-surface)",
    _hover: {
      textDecoration: "underline",
    },
  },
});

const Artist = styled("span", {
  base: {
    fontSize: "0.85rem",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const ProgressTrack = styled("div", {
  base: {
    marginTop: "4px",
    height: "4px",
    borderRadius: "var(--borderRadius-circle)",
    background: "var(--md-sys-color-surface-container-highest)",
    overflow: "hidden",
  },
});

const ProgressFill = styled("div", {
  base: {
    height: "100%",
    borderRadius: "var(--borderRadius-circle)",
    background: "var(--md-sys-color-primary)",
    transition: "width 1s linear",
  },
});

const TimeRow = styled("div", {
  base: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.7rem",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});
