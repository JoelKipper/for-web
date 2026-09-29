import { Show, createEffect, createMemo } from "solid-js";
import { AudioTrack, useTracks } from "solid-livekit-components";

import { getTrackReferenceId, isLocal } from "@livekit/components-core";
import { Key } from "@solid-primitives/keyed";
import { RemoteTrackPublication, Track } from "livekit-client";

import { useState } from "@revolt/state";

import { useVoice } from "../state";

import { NarrowedAudioTrack } from "./NarrowedAudioTrack";

/**
 * Stereo width of incoming voice (0 = mono, 1 = untouched).
 * Mics on one channel of a stereo interface would otherwise be heard
 * hard-panned; this keeps it close to mono like Discord.
 */
const VOICE_STEREO_WIDTH = 0.15;

export function RoomAudioManager() {
  const voice = useVoice();
  const state = useState();

  const tracks = useTracks(
    [
      Track.Source.Microphone,
      Track.Source.ScreenShareAudio,
      Track.Source.Unknown,
    ],
    {
      updateOnlyOn: [],
      onlySubscribed: false,
    },
  );

  const filteredTracks = createMemo(() =>
    tracks().filter(
      (track) =>
        !isLocal(track.participant) &&
        track.publication.kind === Track.Kind.Audio,
    ),
  );

  createEffect(() => {
    const tracks = filteredTracks();
    console.info("[rtc] filtered tracks", filteredTracks());
    for (const track of tracks) {
      (track.publication as RemoteTrackPublication).setSubscribed(true);
      console.info(track.publication);
    }
  });

  return (
    <div style={{ display: "none" }}>
      <Key each={filteredTracks()} by={(item) => getTrackReferenceId(item)}>
        {(track) => (
          <Show
            when={track().source === Track.Source.Microphone}
            fallback={
              <AudioTrack
                trackRef={track()}
                volume={
                  state.voice.outputVolume *
                  (track().source === Track.Source.ScreenShareAudio
                    ? state.voice.getScreenShareVolume(
                        track().participant.identity,
                      )
                    : state.voice.getUserVolume(track().participant.identity))
                }
                muted={
                  (track().source === Track.Source.ScreenShareAudio
                    ? state.voice.getScreenShareMuted(
                        track().participant.identity,
                      )
                    : state.voice.getUserMuted(track().participant.identity)) ||
                  voice.deafen()
                }
                enableBoosting
              />
            }
          >
            {/* keeps the track attached and handles muting, audio plays below */}
            <AudioTrack
              trackRef={track()}
              volume={0}
              muted={
                state.voice.getUserMuted(track().participant.identity) ||
                voice.deafen()
              }
            />
            <NarrowedAudioTrack
              trackRef={track()}
              width={VOICE_STEREO_WIDTH}
              volume={
                state.voice.outputVolume *
                state.voice.getUserVolume(track().participant.identity)
              }
            />
          </Show>
        )}
      </Key>
    </div>
  );
}
