import { JSX, Show } from "solid-js";
import { useMaybeRoomContext } from "solid-livekit-components";

import { useVoice } from "..";

/**
 * Render only if in a voice call (and optionally check if channelId matches)
 *
 * Like <Show /> exposes fallback prop
 */
export function InRoom(props: {
  channelId?: string;
  children: JSX.Element;
  fallback?: JSX.Element;
  /**
   * Also render while still connecting, not just once fully connected -
   * for call surfaces that want to look already-joined immediately rather
   * than waiting for the LiveKit handshake to finish.
   */
  includeConnecting?: boolean;
}) {
  const room = useMaybeRoomContext();
  const voice = useVoice();

  return (
    <Show
      when={
        room?.() &&
        (props.includeConnecting
          ? voice.state() === "CONNECTED" || voice.state() === "CONNECTING"
          : voice.state() === "CONNECTED") &&
        (!props.channelId || props.channelId === voice.channel()?.id)
      }
      fallback={props.fallback}
    >
      {props.children}
    </Show>
  );
}
