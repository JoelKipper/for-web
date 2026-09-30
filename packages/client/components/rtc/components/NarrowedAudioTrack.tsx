import { createEffect, createSignal, onCleanup, untrack } from "solid-js";

import type { TrackReference } from "@livekit/components-core";
import {
  ParticipantEvent,
  RemoteAudioTrack,
  RemoteParticipant,
} from "livekit-client";

import { useState } from "@revolt/state";

type Props = {
  trackRef: TrackReference;

  /**
   * Stereo width (0 = mono, 1 = untouched)
   */
  width: number;

  /**
   * Output volume, may go above 1
   */
  volume: number;
};

/**
 * Plays a remote audio track with a reduced stereo width, so voices recorded
 * on only one channel of a stereo interface aren't panned hard to one ear.
 *
 * The regular <AudioTrack> for this track must stay mounted with volume 0:
 * Chromium only feeds remote WebRTC audio into Web Audio while the track is
 * attached to a media element, and it also handles subscription / muting.
 */
export function NarrowedAudioTrack(props: Props) {
  const state = useState();

  let audioEl: HTMLAudioElement | undefined;
  const [track, setTrack] = createSignal<RemoteAudioTrack>();

  // follow (re)subscriptions of this publication
  createEffect(() => {
    const participant = props.trackRef.participant as RemoteParticipant;
    const sync = () =>
      setTrack(
        participant.trackPublications.get(props.trackRef.publication.trackSid)
          ?.track as RemoteAudioTrack | undefined,
      );

    sync();
    participant.on(ParticipantEvent.TrackSubscribed, sync);
    participant.on(ParticipantEvent.TrackUnsubscribed, sync);
    onCleanup(() => {
      participant.off(ParticipantEvent.TrackSubscribed, sync);
      participant.off(ParticipantEvent.TrackUnsubscribed, sync);
    });
  });

  let gainNode: GainNode | undefined;

  createEffect(() => {
    const mediaStreamTrack = track()?.mediaStreamTrack;
    if (!mediaStreamTrack || !audioEl) return;

    const audioContext = new AudioContext({ latencyHint: "interactive" });
    const source = audioContext.createMediaStreamSource(
      new MediaStream([mediaStreamTrack]),
    );

    // force stereo so mono tracks get upmixed to both channels
    const input = audioContext.createGain();
    input.channelCount = 2;
    input.channelCountMode = "explicit";
    input.channelInterpretation = "speakers";

    // L' = a*L + b*R, R' = b*L + a*R (mid/side with the side scaled by width)
    const width = untrack(() => props.width);
    const direct = (1 + width) / 2;
    const cross = (1 - width) / 2;

    const splitter = audioContext.createChannelSplitter(2);
    const merger = audioContext.createChannelMerger(2);
    const route = (from: number, to: number, value: number) => {
      const gain = audioContext.createGain();
      gain.gain.value = value;
      splitter.connect(gain, from);
      gain.connect(merger, 0, to);
    };

    route(0, 0, direct);
    route(1, 0, cross);
    route(0, 1, cross);
    route(1, 1, direct);

    gainNode = audioContext.createGain();
    gainNode.gain.value = untrack(() => props.volume);

    const destination = audioContext.createMediaStreamDestination();
    destination.channelCount = 2;

    source.connect(input).connect(splitter);
    merger.connect(gainNode).connect(destination);

    audioEl.srcObject = destination.stream;
    audioEl.play().catch(console.error);
    audioContext.resume().catch(console.error);

    onCleanup(() => {
      audioEl!.srcObject = null;
      source.disconnect();
      gainNode = undefined;
      audioContext.close();
    });
  });

  createEffect(() => {
    const volume = props.volume;
    if (gainNode) gainNode.gain.value = volume;
  });

  createEffect(() => {
    const sinkId = state.voice.preferredAudioOutputDevice;
    if (sinkId && audioEl && "setSinkId" in audioEl) {
      (
        audioEl as HTMLAudioElement & {
          setSinkId(id: string): Promise<void>;
        }
      )
        .setSinkId(sinkId)
        // saved output device isn't available, stay on the system default
        .catch(() => {});
    }
  });

  return <audio ref={audioEl} />;
}
