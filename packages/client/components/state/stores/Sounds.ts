import { State } from "..";

import { AbstractStore } from ".";

export type TypeSounds = {
  /**
   * Play sound on deafen
   */
  deafen: boolean;

  /**
   * Play a sound on message/notification
   */
  message: boolean;

  /**
   * Play sound on mute
   */
  mute: boolean;

  /**
   * Play sound when receiving a DM call
   */
  ringtoneIncoming: boolean;

  /**
   * Play sound when dialing someone in a DM call
   */
  ringtoneOutgoing: boolean;

  /**
   * Play a sound when a stream ends
   */
  streamEnd: boolean;

  /**
   * Play a sound when a stream starts
   */
  streamStart: boolean;

  /**
   * Play a sound when a user starts viewing your stream
   */
  streamViewerJoin: boolean;

  /**
   * Play a sound when a user stops viewing your stream
   */
  streamViewerLeave: boolean;

  /**
   * Play a sound when you undeafen
   */
  undeafen: boolean;

  /**
   * Play a sound when you unmute
   */
  unmute: boolean;

  /**
   * Play a sound when a user joins your voice channel
   */
  userJoinVoice: boolean;

  /**
   * Play a sound when a user leaves your voice channel
   */
  userLeaveVoice: boolean;

  /**
   * Play a sound when you leave a voice channel yourself
   */
  userSelfLeaveVoice: boolean;

  /**
   * Play a sound when a user moves channels
   */
  userMoved: boolean;

  /**
   * Volume multiplier applied to all sound effects (0-1). 1 = normal volume.
   */
  volume: number;

  /**
   * Per-sound volume multipliers (0-1). 1 = normal volume for that sound.
   * Applied on top of the global `volume` multiplier.
   */
  soundVolumes: Record<ToggleableSound, number>;
};

/**
 * Sound settings which can be toggled on/off
 */
export type ToggleableSound = Exclude<
  keyof TypeSounds,
  "volume" | "soundVolumes"
>;

export class Sounds extends AbstractStore<"sounds", TypeSounds> {
  constructor(state: State) {
    super(state, "sounds");
  }

  hydrate(): void {}

  default(): TypeSounds {
    return {
      deafen: true,
      message: true,
      mute: true,
      ringtoneIncoming: true,
      ringtoneOutgoing: true,
      streamEnd: true,
      streamStart: true,
      streamViewerJoin: true,
      streamViewerLeave: true,
      undeafen: true,
      unmute: true,
      userJoinVoice: true,
      userLeaveVoice: true,
      userSelfLeaveVoice: true,
      userMoved: true,
      volume: 0.5,
      soundVolumes: {
        deafen: 1,
        message: 1,
        mute: 1,
        ringtoneIncoming: 1,
        ringtoneOutgoing: 1,
        streamEnd: 1,
        streamStart: 1,
        streamViewerJoin: 1,
        streamViewerLeave: 1,
        undeafen: 1,
        unmute: 1,
        userJoinVoice: 1,
        userLeaveVoice: 1,
        userSelfLeaveVoice: 1,
        userMoved: 1,
      },
    };
  }

  clean(input: Partial<TypeSounds>): TypeSounds {
    return {
      deafen: typeof input.deafen === "boolean" ? input.deafen : true,
      message: typeof input.message === "boolean" ? input.message : true,
      mute: typeof input.mute === "boolean" ? input.mute : true,
      ringtoneIncoming:
        typeof input.ringtoneIncoming === "boolean"
          ? input.ringtoneIncoming
          : true,
      ringtoneOutgoing:
        typeof input.ringtoneOutgoing === "boolean"
          ? input.ringtoneOutgoing
          : true,
      streamEnd: typeof input.streamEnd === "boolean" ? input.streamEnd : true,
      streamStart:
        typeof input.streamStart === "boolean" ? input.streamStart : true,
      streamViewerJoin:
        typeof input.streamViewerJoin === "boolean"
          ? input.streamViewerJoin
          : true,
      streamViewerLeave:
        typeof input.streamViewerLeave === "boolean"
          ? input.streamViewerLeave
          : true,
      undeafen: typeof input.undeafen === "boolean" ? input.undeafen : true,
      unmute: typeof input.unmute === "boolean" ? input.unmute : true,
      userJoinVoice:
        typeof input.userJoinVoice === "boolean" ? input.userJoinVoice : true,
      userLeaveVoice:
        typeof input.userLeaveVoice === "boolean" ? input.userLeaveVoice : true,
      userSelfLeaveVoice:
        typeof input.userSelfLeaveVoice === "boolean"
          ? input.userSelfLeaveVoice
          : true,
      userMoved: typeof input.userMoved === "boolean" ? input.userMoved : true,
      volume:
        typeof input.volume === "number"
          ? Math.min(1, Math.max(0, input.volume))
          : 0.5,
      soundVolumes: this.cleanSoundVolumes(input.soundVolumes),
    };
  }

  /**
   * Validate per-sound volume overrides, falling back to 1 (normal volume)
   * for anything missing or invalid.
   */
  private cleanSoundVolumes(
    input?: Partial<Record<ToggleableSound, number>>,
  ): Record<ToggleableSound, number> {
    const defaults = this.default().soundVolumes;
    const result = { ...defaults };

    for (const key of Object.keys(defaults) as ToggleableSound[]) {
      const value = input?.[key];
      if (typeof value === "number") {
        result[key] = Math.min(1, Math.max(0, value));
      }
    }

    return result;
  }

  enabled(t: ToggleableSound): boolean {
    return this.get()[t];
  }

  toggle(t: ToggleableSound) {
    return this.set(t, !this.enabled(t));
  }

  /**
   * Get the volume multiplier applied to all sound effects (0-1)
   */
  getVolume(): number {
    return this.get().volume;
  }

  /**
   * Set the volume multiplier applied to all sound effects (0-1)
   */
  setVolume(volume: number) {
    this.set("volume", Math.min(1, Math.max(0, volume)));
  }

  /**
   * Get the volume multiplier for a specific sound (0-1)
   */
  getSoundVolume(t: ToggleableSound): number {
    return this.get().soundVolumes[t];
  }

  /**
   * Set the volume multiplier for a specific sound (0-1)
   */
  setSoundVolume(t: ToggleableSound, volume: number) {
    this.set("soundVolumes", t, Math.min(1, Math.max(0, volume)));
  }

  /**
   * Reset every per-sound volume back to 100%. Does not affect the master
   * `volume` multiplier.
   */
  resetSoundVolumes() {
    this.set("soundVolumes", this.default().soundVolumes);
  }
}
