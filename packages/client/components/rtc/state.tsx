import {
  Accessor,
  batch,
  createContext,
  createEffect,
  createSignal,
  JSX,
  Setter,
  useContext,
} from "solid-js";
import {
  RoomContext,
  TrackReferenceOrPlaceholder,
  useTracks,
} from "solid-livekit-components";

import {
  LocalTrackPublication,
  Room,
  ScreenShareCaptureOptions,
  ScreenSharePresets,
  Track,
  VideoEncoding,
  VideoPreset,
  VideoPresets,
} from "livekit-client";
import { Channel } from "stoat.js";

import { SoundController, useSound } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { ModalController, useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import {
  NoiseSuppresionState,
  ScreenShareQualityName,
  Voice as VoiceSettings,
} from "@revolt/state/stores/Voice";
import { VoiceCallCardContext } from "@revolt/ui/components/features/voice/callCard/VoiceCallCard";

import { Device, useDevice } from "@revolt/common";
import { InRoom } from "./components/InRoom";
import { RoomAudioManager } from "./components/RoomAudioManager";
import { VoiceProcessor } from "./VoiceProcessor";

type State =
  | "READY"
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING";

export type VoiceLayout = "fullscreen" | "expanded" | "collapsed" | undefined;

type ScreenShareQuality = Required<
  Pick<ScreenShareCaptureOptions, "contentHint" | "resolution">
> & {
  name: ScreenShareQualityName;
  fullName: string;
  encoding: VideoEncoding;
};

class Voice {
  #settings: VoiceSettings;

  channel: Accessor<Channel | undefined>;
  #setChannel: Setter<Channel | undefined>;

  room: Accessor<Room | undefined>;
  #setRoom: Setter<Room | undefined>;

  vidTracks: Accessor<TrackReferenceOrPlaceholder[]>;

  state: Accessor<State>;
  #setState: Setter<State>;

  deafen: Accessor<boolean>;
  microphone: Accessor<boolean>;

  video: Accessor<boolean>;
  #setVideo: Setter<boolean>;

  screenshare: Accessor<boolean>;
  #setScreenshare: Setter<boolean>;

  layout: Accessor<VoiceLayout>;
  #setLayout: Setter<VoiceLayout>;

  focusId: Accessor<string | undefined>;
  #setFocus: Setter<string | undefined>;

  showBar: Accessor<boolean>;
  #setShowBar: Setter<boolean>;

  private sound: SoundController;
  private device: Device;

  private openModal;
  private config;
  private limits;
  private screenShareTracks: Set<string>;
  private voiceProcessor?: VoiceProcessor;
  private stopTrackingActiveWindow?: () => void;

  /**
   * Bumped by every connect()/disconnect() call. An in-flight connect()
   * checks this after each await and abandons the connection if it no
   * longer matches - otherwise a disconnect() (or a newer connect()) that
   * happens mid-handshake can leave the LiveKit session alive on the
   * server while the UI already thinks the call was left.
   */
  #connectionGeneration = 0;

  constructor(
    voiceSettings: VoiceSettings,
    modals: ModalController,
    sound: SoundController,
    device: Device,
  ) {
    this.#settings = voiceSettings;
    this.sound = sound;
    this.device = device;

    const [channel, setChannel] = createSignal<Channel>();
    this.channel = channel;
    this.#setChannel = setChannel;

    const [room, setRoom] = createSignal<Room>();
    this.room = room;
    this.#setRoom = setRoom;

    this.vidTracks = () => [];

    const [state, setState] = createSignal<State>("READY");
    this.state = state;
    this.#setState = setState;

    this.deafen = () => voiceSettings.deafen;
    this.microphone = () => voiceSettings.micOn && !voiceSettings.deafen;

    const [video, setVideo] = createSignal(false);
    this.video = video;
    this.#setVideo = setVideo;

    const [screenshare, setScreenshare] = createSignal(false);
    this.screenshare = screenshare;
    this.#setScreenshare = setScreenshare;

    const [layout, setLayout] = createSignal<VoiceLayout>();
    this.layout = layout;
    this.#setLayout = setLayout;

    const [focus, setFocus] = createSignal<string>();
    this.focusId = focus;
    this.#setFocus = setFocus;

    const [showBar, setShowBar] = createSignal(true);
    this.showBar = showBar;
    this.#setShowBar = setShowBar;

    const inst = useInstance();
    this.config = inst.config;
    this.limits = inst.limits;
    this.openModal = modals.openModal;

    this.screenShareTracks = new Set();

    // Setup settings listeners
    this.settingsListeners();
  }

  // Dynamically set echo cancellation and gain control when the settings are changed
  // These functions are needed to maintain reactivity. Don't ask me why but if you make them not functions it breaks.
  private settingsListeners() {
    const getSettings = () => this.#settings;

    const setEchoCancellation = (echoCancellation: boolean) => {
      const track = this.getMicrophoneTrack()?.audioTrack;
      if (track) {
        track.constraints.echoCancellation = echoCancellation;
      }
    };

    const setAutoGainControl = (autoGainControl: boolean) => {
      const track = this.getMicrophoneTrack()?.audioTrack;
      if (track) {
        track.constraints.autoGainControl = autoGainControl;
      }
    };

    const setNoiseSuppression = (noiseSuppression: NoiseSuppresionState) => {
      const track = this.getMicrophoneTrack()?.audioTrack;
      if (track) {
        if (noiseSuppression === "browser") {
          track.constraints.noiseSuppression = true;
          //@ts-expect-error voiceIsolation is not yet standard, but it supported by livekit and most chromium based browsers, including electron.
          track.constraints.voiceIsolation = true;
        } else {
          track.constraints.noiseSuppression = false;
          //@ts-expect-error voiceIsolation is not yet standard, but it supported by livekit and most chromium based browsers, including electron.
          track.constraints.voiceIsolation = false;
        }
      }
    };

    const restartTrack = () => {
      const track = this.getMicrophoneTrack()?.audioTrack;
      if (track) {
        track.restartTrack();
      }
    };

    createEffect(() => {
      setEchoCancellation(getSettings().echoCancellation ?? true);
      setAutoGainControl(getSettings().autoGainControl ?? true);
      setNoiseSuppression(getSettings().noiseSupression ?? "browser");
      restartTrack();
    });

    // Re-push the screen share encoding whenever the bitrate override
    // changes, so dragging the settings slider takes effect immediately
    // instead of only on the next time screen share is (re)started.
    createEffect(() => {
      // Reading this establishes the reactive dependency that makes the
      // effect re-run when the slider moves - getEnabledScreenShareQualities()
      // reads it too (via withBitrateOverride) to build the new encoding.
      const maxBitrate = getSettings().screenShareMaxBitrate;
      void maxBitrate;

      const videoTrack = this.room()?.localParticipant.getTrackPublication(
        Track.Source.ScreenShare,
      )?.videoTrack;
      if (!videoTrack) return;

      const qualities = this.getEnabledScreenShareQualities();
      const quality =
        qualities[getSettings().screenShareQuality || "low"] ?? qualities.low!;

      // applyScreenShareConstraints() alone isn't enough: livekit-client's
      // refreshSenderEncodings() only re-pushes encoding params to the
      // RTCRtpSender when the *resolution* changed since last time - a
      // bitrate-only change is silently dropped. Keep the constraints call
      // for resolution/contentHint, but push the new maxBitrate to the
      // sender directly so it actually takes effect.
      videoTrack.applyScreenShareConstraints(
        {
          resolution: quality.resolution,
          contentHint: quality.contentHint,
        },
        quality.encoding,
      );
      this.pushSenderMaxBitrate(videoTrack, quality.encoding.maxBitrate);
    });
  }

  /**
   * Directly sets maxBitrate on every active encoding of a video track's
   * RTCRtpSender. Bypasses livekit-client's refreshSenderEncodings(), which
   * skips the update entirely when the track's resolution hasn't changed -
   * see the comment at its call site above.
   */
  private async pushSenderMaxBitrate(
    videoTrack: { sender?: RTCRtpSender },
    maxBitrate: number | undefined,
  ) {
    const sender = videoTrack.sender;
    if (!sender || maxBitrate === undefined) return;

    const params = sender.getParameters();
    if (!params.encodings?.length) return;

    let changed = false;
    for (const encoding of params.encodings) {
      if (encoding.active === false) continue;
      if (encoding.maxBitrate !== maxBitrate) {
        encoding.maxBitrate = maxBitrate;
        changed = true;
      }
    }
    if (!changed) return;

    try {
      await sender.setParameters(params);
    } catch (e) {
      this.onErr(e);
    }
  }

  async connect(channel: Channel, auth?: { url: string; token: string }) {
    this.disconnect();

    const generation = ++this.#connectionGeneration;
    const stillCurrent = () => generation === this.#connectionGeneration;

    this.device.setWakeLocked();

    const room = new Room({
      audioCaptureDefaults: {
        deviceId: this.#settings.preferredAudioInputDevice,
        echoCancellation: this.#settings.echoCancellation,
        noiseSuppression: this.#settings.noiseSupression === "browser",
        autoGainControl: this.#settings.autoGainControl,
        voiceIsolation: this.#settings.noiseSupression === "browser",
      },
      audioOutput: {
        deviceId: this.#settings.preferredAudioOutputDevice,
      },
      videoCaptureDefaults: {
        // TODO: Support higher resolutions based on limits
        resolution: VideoPresets.h720.resolution,
        deviceId: this.#settings.preferredVideoDevice,
      },
      publishDefaults: {
        videoEncoding: VideoPresets.h720.encoding,
        screenShareEncoding: ScreenSharePresets.h720fps30.encoding,
      },
      // Lets LiveKit pause simulcast layers nobody is actually subscribed
      // to instead of encoding them continuously - frees up encoder CPU
      // that otherwise competes with the layer people actually watch.
      dynacast: true,
    });

    this.vidTracks = useTracks(
      [
        { source: Track.Source.Camera, withPlaceholder: true },
        { source: Track.Source.ScreenShare, withPlaceholder: false },
      ],
      { room, onlySubscribed: false },
    );

    batch(() => {
      this.#setRoom(room);
      this.#setChannel(channel);
      this.#setState("CONNECTING");
      this.#setVideo(false);
      this.#setScreenshare(false);
    });

    room.addListener("connected", () => {
      this.#setState("CONNECTED");
      if (this.speakingPermission)
        room.localParticipant
          .setMicrophoneEnabled(this.#settings.micOn)
          .then((track) => {
            this.#settings.micOn = track != null;
          });
      for (const p of room.remoteParticipants.values()) {
        const screenShareTrack = p.getTrackPublication(
          Track.Source.ScreenShare,
        );
        if (screenShareTrack) {
          this.screenShareTracks.add(screenShareTrack.trackSid);
        }
      }
      this.sound.playSound("userJoinVoice");
    });

    room.addListener("disconnected", () => this.#setState("DISCONNECTED"));

    room.addListener("localTrackPublished", (pub) => {
      if (pub.audioTrack && pub.audioTrack.source === Track.Source.Microphone) {
        if (!pub.audioTrack.getProcessor()) {
          pub.audioTrack?.setProcessor(
            (this.voiceProcessor = new VoiceProcessor(this.#settings)),
          );
        }
      }
    });

    room.addListener("participantConnected", () => {
      this.sound.playSound("userJoinVoice");
    });

    room.addListener("participantDisconnected", () => {
      this.sound.playSound("userLeaveVoice");
    });

    room.addListener("trackPublished", (pub) => {
      if (pub.source === Track.Source.ScreenShare) {
        pub.once("subscribed", (track) => {
          // Play the sound once playback starts, which might be quite a bit after subscription
          // as it starts paused for the screen share settings modal.
          track.once("videoPlaybackStarted", () => {
            this.sound.playSound("streamStart");
            if (track.sid) {
              this.screenShareTracks.add(track.sid);
            }
          });
        });
      }
    });

    room.addListener("trackUnpublished", (unpub) => {
      if (this.screenShareTracks.has(unpub.trackSid)) {
        this.sound.playSound("streamEnd");
        this.screenShareTracks.delete(unpub.trackSid);
      }
    });

    // Pick the closest LiveKit node by latency - skip the race entirely
    // when there's only one node (e.g. every self-hosted instance), since
    // there's nothing to choose between and the probe is pure added delay.
    const nodes = this.config.features.livekit.nodes;
    const selected =
      nodes.length === 1
        ? nodes[0].name
        : await Promise.any(
            nodes.map(async (node) => {
              return fetch(node.public_url.replace("wss", "https")).then(() => {
                return node.name;
              });
            }),
          );

    if (!stillCurrent()) return this.abandon(room);

    if (!auth) {
      auth = await channel.joinCall(selected);
    }

    if (!stillCurrent()) return this.abandon(room);

    await room.connect(auth.url, auth.token, {
      autoSubscribe: false,
    });

    if (!stillCurrent()) return this.abandon(room);
  }

  /**
   * Tear down a room that finished connecting after the call was already
   * left (or superseded by a newer connect()) - see #connectionGeneration.
   */
  private abandon(room: Room) {
    room.removeAllListeners();
    room.disconnect();
  }

  disconnect() {
    this.#connectionGeneration++;
    this.device.releaseWakeLock();
    try {
      const room = this.room();
      if (!room) return;

      room.removeAllListeners();
      room.disconnect();

      batch(() => {
        this.#setState("READY");
        this.#setRoom();
        this.#setChannel();
        this.#setLayout();
        this.vidTracks = () => [];
      });

      this.screenShareTracks = new Set();

      this.sound.playSound("userSelfLeaveVoice");
    } catch (e) {
      this.onErr(e);
    }
  }

  /**
   * Toggle deafen. Works both while connected to a call (live-updates the
   * room) and outside of one (just flips the setting for the next call),
   * same as toggling mute below.
   */
  async toggleDeafen(fromMute?: boolean) {
    try {
      const room = this.room();
      if (room) {
        await room.localParticipant.setMicrophoneEnabled(
          (this.#settings.micOn || !!fromMute) &&
            !room.localParticipant.isMicrophoneEnabled,
        );
      }

      this.#settings.deafen = !this.#settings.deafen;
      if (fromMute && room) {
        this.#settings.micOn = room.localParticipant.isMicrophoneEnabled;
      }
      if (this.#settings.deafen) {
        this.sound.playSound("deafen");
      } else {
        this.sound.playSound("undeafen");
      }
    } catch (e) {
      this.onErr(e);
    }
  }

  async toggleMute() {
    if (this.#settings.deafen) {
      this.toggleDeafen(true);
      return;
    }
    try {
      const room = this.room();
      if (room) {
        await room.localParticipant.setMicrophoneEnabled(
          !room.localParticipant.isMicrophoneEnabled,
        );
        this.#settings.micOn = room.localParticipant.isMicrophoneEnabled;
      } else {
        this.#settings.micOn = !this.#settings.micOn;
      }

      if (this.#settings.micOn) {
        this.sound.playSound("unmute");
      } else {
        this.sound.playSound("mute");
      }
    } catch (e) {
      this.onErr(e);
    }
  }

  async toggleCamera() {
    try {
      const room = this.room();
      if (!room) throw "invalid state";
      await room.localParticipant.setCameraEnabled(
        !room.localParticipant.isCameraEnabled,
      );

      this.#setVideo(room.localParticipant.isCameraEnabled);
    } catch (e) {
      this.onErr(e);
    }
  }

  /**
   * Apply the user's custom screen share bitrate override (settings) on top
   * of a preset's encoding, if one is set. 0/unset means "auto" - keep the
   * preset's own bitrate.
   */
  private withBitrateOverride(encoding: VideoEncoding): VideoEncoding {
    const custom = this.#settings.screenShareMaxBitrate;
    if (!custom) return encoding;
    return { ...encoding, maxBitrate: custom };
  }

  /**
   * Get the enabled screen share qualities. "low" will always be enabled.
   * Each screen share quality is checked against the limit if the limit is available on the client.
   *
   * TODO: Translate the fullNames here, I can't figure out how to do it.
   *
   * @param name The name of the screen share quality to get
   * @returns A partial record of ScreenShareQualityName to ScreenShareQuality. Will always contain "low" quality.
   */
  getEnabledScreenShareQualities(): Partial<
    Record<ScreenShareQualityName, ScreenShareQuality>
  > {
    // Always enable low
    const qualities: Partial<
      Record<ScreenShareQualityName, ScreenShareQuality>
    > = {
      low: {
        name: "low",
        resolution: ScreenSharePresets.h720fps30.resolution,
        fullName: `720p 30FPS`,
        contentHint: "motion",
        encoding: this.withBitrateOverride(
          ScreenSharePresets.h720fps30.encoding,
        ),
      },
    };

    const limit = this.limits().video_resolution;

    // TODO: Add more resolutions to stream from if they're enabled. May tie into premium users in the future?
    if (
      (limit[0] === 0 || limit[0] >= 1920) &&
      (limit[1] === 0 || limit[1] >= 1080)
    ) {
      // LiveKit's built-in h1080fps30 preset caps out at 5Mbps, which looks
      // soft for detailed/high-motion content - bump it a bit for a sharper
      // "high" option, and add a 60fps variant for smoother motion (games).
      const high1080p30 = new VideoPreset(1920, 1080, 8_000_000, 30, "medium");
      const high1080p60 = new VideoPreset(1920, 1080, 10_000_000, 60, "medium");

      qualities.high = {
        name: "high",
        resolution: high1080p30.resolution,
        fullName: `1080p 30FPS`,
        contentHint: "motion",
        encoding: this.withBitrateOverride(high1080p30.encoding),
      };
      qualities.high60 = {
        name: "high60",
        resolution: high1080p60.resolution,
        fullName: `1080p 60FPS`,
        contentHint: "motion",
        encoding: this.withBitrateOverride(high1080p60.encoding),
      };
      const originalResolution = ScreenSharePresets.original.resolution;
      originalResolution.frameRate = 5;
      originalResolution.aspectRatio = 0;

      const limit = this.limits().video_resolution;
      originalResolution.width = limit[0];
      originalResolution.height = limit[1];
      // If both resolutions are limited, set aspect ratio
      if (originalResolution.height !== 0 && originalResolution.width !== 0) {
        originalResolution.aspectRatio =
          originalResolution.width / originalResolution.height;
      }

      qualities.text = {
        name: "text",
        resolution: originalResolution,
        fullName: `Source 5FPS`,
        contentHint: "text",
        encoding: ScreenSharePresets.original.encoding,
      };
    }

    return qualities;
  }

  async toggleScreenshare() {
    const room = this.room();
    if (!room) throw "invalid state";

    if (this.screenshare()) {
      this.stopTrackingActiveWindow?.();
      this.stopTrackingActiveWindow = undefined;

      await room.localParticipant.setScreenShareEnabled(false);

      this.#setScreenshare(room.localParticipant.isScreenShareEnabled);

      this.sound.playSound("streamEnd");
    } else {
      const qualities = this.getEnabledScreenShareQualities();
      let screenPickerQualityName: ScreenShareQualityName | undefined;
      let screenPickerAudio: boolean | undefined;
      let screenPickerTrackActiveWindow = false;

      // Register the modal on screen picker handler if it exists
      if (window.native && window.native.onceScreenPicker) {
        window.native.onceScreenPicker((sources) => {
          this.openModal({
            type: "screen_share_picker",
            canTrackActiveWindow: !!window.native?.onActiveWindowTrackSwitch,
            onCancel: () => {
              window.native.screenPickerCallback(-1, false);
            },
            callback: (
              idx: number,
              qualityName: ScreenShareQualityName,
              audio: boolean,
              trackActiveWindow?: boolean,
            ) => {
              window.native.screenPickerCallback(idx, audio, trackActiveWindow);
              screenPickerQualityName = qualityName;
              screenPickerAudio = audio;
              screenPickerTrackActiveWindow = !!trackActiveWindow;
            },
            sources: sources,
            qualities: Object.keys(qualities).map((k) => {
              const v = qualities[k as ScreenShareQualityName]!;
              return { name: k, fullName: v.fullName };
            }),
          });
        });
      }

      try {
        const chosenQuality =
          this.getEnabledScreenShareQualities()[
            this.#settings.screenShareQuality || "low"
          ];
        const localTrack = await room.localParticipant.setScreenShareEnabled(
          true,
          {
            resolution: chosenQuality?.resolution,
            audio: {
              autoGainControl: false,
              echoCancellation: false,
              noiseSuppression: false,
              voiceIsolation: false,
              restrictOwnAudio: true,
            },
          },
          {
            screenShareEncoding: chosenQuality?.encoding,
            // Simulcast makes the encoder continuously produce an extra
            // lower-res layer alongside the real one - pure encoder CPU
            // overhead screen share to a small self-hosted instance
            // doesn't need. Simulcast is fixed at publish time (can't be
            // changed by the quality-switch codepath below), so set it here.
            //
            // We previously also forced videoCodec: "h264" here, on the
            // assumption that it'd be hardware-accelerated where VP8 (the
            // room-wide default) is software-only. In practice this isn't
            // reliable - confirmed via the OS's GPU video-encode engine
            // sitting at 0% during an active H.264 screen share, meaning
            // Chromium fell back to a software x264 encoder anyway. A
            // software encoder that then also competes with a CPU/GPU-
            // heavy foreground app (e.g. a game) for the same core budget
            // is worse than VP8, not better, so stick with the room's
            // default codec here instead of forcing one.
            simulcast: false,
          },
        );

        const screenAudioTrack = room.localParticipant.getTrackPublication(
          Track.Source.ScreenShareAudio,
        );

        this.#setScreenshare(room.localParticipant.isScreenShareEnabled);

        if (localTrack) {
          // If the user opted into following the focused window, hand the
          // desktop app a callback: every time it tells us the focused
          // window changed, grab a fresh capture for that window and swap
          // it into the already-published screen share track in place.
          if (
            screenPickerTrackActiveWindow &&
            window.native?.onActiveWindowTrackSwitch
          ) {
            this.stopTrackingActiveWindow =
              window.native.onActiveWindowTrackSwitch(async (sourceId) => {
                try {
                  const stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                      mandatory: {
                        chromeMediaSource: "desktop",
                        chromeMediaSourceId: sourceId,
                      },
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } as any,
                  });

                  const [newTrack] = stream.getVideoTracks();
                  if (newTrack && localTrack.videoTrack) {
                    await localTrack.videoTrack.replaceTrack(newTrack);
                  }
                } catch (e) {
                  this.onErr(e);
                }
              });
          }

          // This event is only fired if the screen share is ended by closing the window being streamed.
          // This catches the ending and disables screen sharing on our side. If this weren't here,
          // livekit would still share stream audio after closing the window being streamed.
          localTrack.on("ended", () => {
            this.toggleScreenshare();
            const oldAudioTrack = room.localParticipant.getTrackPublication(
              Track.Source.ScreenShareAudio,
            );
            if (oldAudioTrack && oldAudioTrack.track) {
              room.localParticipant.unpublishTrack(oldAudioTrack.track);
            }
          });

          const callback = async (
            qualityName: ScreenShareQualityName,
            audio: boolean,
          ) => {
            const quality = qualities[qualityName] || qualities.low!;

            if (localTrack.videoTrack) {
              await localTrack.videoTrack.applyScreenShareConstraints(
                {
                  resolution: {
                    frameRate: quality.resolution.frameRate,
                    width: quality.resolution.width,
                    height: quality.resolution.height,
                  },
                  contentHint: quality.contentHint,
                },
                quality.encoding,
              );
              // LiveKit defaults every screen-share track's encoder to
              // "maintain-resolution" regardless of the chosen preset, so
              // under CPU/bandwidth pressure it drops frames before ever
              // dropping resolution - silently capping the actual framerate
              // of "high60" well below the requested 60fps. Match the
              // encoder's priority to what the contentHint already implies:
              // "motion" presets (low/high/high60) want smooth motion, only
              // "text" genuinely wants to keep resolution over framerate.
              await localTrack.videoTrack.setDegradationPreference(
                quality.contentHint === "motion"
                  ? "maintain-framerate"
                  : "maintain-resolution",
              );
              if (!audio && screenAudioTrack?.track) {
                room.localParticipant.unpublishTrack(screenAudioTrack.track);
              }
              this.sound.playSound("streamStart");
            }
          };

          if (screenPickerQualityName) {
            callback(
              screenPickerQualityName || "low",
              screenPickerAudio || false,
            );
          } else if (this.#settings.screenShareQualityAsk) {
            if (Object.keys(qualities).length > 1) {
              localTrack.pauseUpstream();
              screenAudioTrack?.pauseUpstream();
              this.openModal({
                onCancel: async () => {
                  await room.localParticipant.setScreenShareEnabled(false);
                  this.#setScreenshare(
                    room.localParticipant.isScreenShareEnabled,
                  );
                },
                type: "screen_share_settings",
                trackReference: {
                  participant: room.localParticipant,
                  publication: localTrack,
                  source: Track.Source.ScreenShare,
                },
                qualities: Object.keys(qualities).map((k) => {
                  const v = qualities[k as ScreenShareQualityName]!;
                  return { name: k, fullName: v.fullName };
                }),
                audio: !!screenAudioTrack,
                callback: async (qualityName, audio) => {
                  callback(qualityName, audio);
                  localTrack.resumeUpstream();
                  if (audio) {
                    screenAudioTrack?.resumeUpstream();
                  }
                },
              });
            } else {
              callback(
                this.#settings.screenShareQuality || "low",
                this.#settings.screenShareAudio,
              );
            }
          }
        }
      } catch (e) {
        this.onErr(e);
      }
    }
  }

  resetLayout() {
    this.#setLayout();
  }

  toggleLayout(type: VoiceLayout) {
    this.#setLayout((l) => (l === type ? undefined : type));
  }

  trackId(t: TrackReferenceOrPlaceholder) {
    return `${t.source}_${t.participant.sid}`;
  }

  toggleFocus(t?: TrackReferenceOrPlaceholder) {
    const id = t ? this.trackId(t) : undefined;
    this.#setFocus(
      this.focusId() === id || this.vidTracks().length < 2 ? undefined : id,
    );
  }

  isFocus(t: TrackReferenceOrPlaceholder) {
    return this.trackId(t) === this.focusId();
  }

  focusTrack() {
    const id = this.focusId();
    return id
      ? this.vidTracks().find((t) => this.trackId(t) === id)
      : undefined;
  }

  toggleShowBar() {
    this.#setShowBar((s) => !s);
  }

  getConnectedUser(userId: string) {
    return this.room()?.getParticipantByIdentity(userId);
  }

  showCard(channel: Channel) {
    return (
      channel.isVoice &&
      (this.channel()?.id === channel.id ||
        channel.type === "TextChannel" ||
        !!channel.voiceParticipants.size)
    );
  }

  getMicrophoneTrack(): LocalTrackPublication | undefined {
    const track = this.room()?.localParticipant.getTrackPublication(
      Track.Source.Microphone,
    );
    return track;
  }

  get listenPermission() {
    return !!this.channel()?.havePermission("Listen");
  }

  get speakingPermission() {
    return !!this.channel()?.havePermission("Speak");
  }

  private onErr(e: unknown) {
    if ((e as Error).name !== "NotAllowedError")
      this.openModal({ type: "error2", error: e });
  }
}

const voiceContext = createContext<Voice>(null as unknown as Voice);

/**
 * Mount global voice context and room audio manager
 */
export function VoiceContext(props: { children: JSX.Element }) {
  const state = useState();
  const modals = useModals();
  const sound = useSound();
  const device = useDevice();
  const voice = new Voice(state.voice, modals, sound, device);

  return (
    <voiceContext.Provider value={voice}>
      <RoomContext.Provider value={voice.room}>
        <VoiceCallCardContext>{props.children}</VoiceCallCardContext>
        <InRoom>
          <RoomAudioManager />
        </InRoom>
      </RoomContext.Provider>
    </voiceContext.Provider>
  );
}

export const useVoice = () => useContext(voiceContext);
