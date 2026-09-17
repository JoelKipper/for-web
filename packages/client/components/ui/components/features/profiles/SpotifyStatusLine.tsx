import { Show } from "solid-js";

import { User } from "stoat.js";
import { styled } from "styled-system/jsx";

import { MarqueeText } from "../../utils/MarqueeText";
import { Symbol } from "../../utils/Symbol";

type SpotifyActivity = {
  type: "Spotify";
  track_name: string;
  artist_name: string;
};

/**
 * Compact "now playing" line for places that otherwise show plain status
 * text (sidebar entries, member list) - a music note plus the track and
 * artist auto-scrolling, instead of the static "Listening to X by Y" text.
 *
 * See SpotifyActivity.tsx for why `activity` is read via a cast rather
 * than a real field on the SDK's status type.
 */
export function SpotifyStatusLine(props: { user: User; class?: string }) {
  const activity = () =>
    (props.user.status as { activity?: SpotifyActivity } | undefined)
      ?.activity;

  return (
    <Show when={activity()}>
      {(a) => (
        <Row class={props.class}>
          <Symbol size={12}>music_note</Symbol>
          <MarqueeText>{`${a().track_name} — ${a().artist_name}`}</MarqueeText>
        </Row>
      )}
    </Show>
  );
}

const Row = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    minWidth: 0,
  },
});
