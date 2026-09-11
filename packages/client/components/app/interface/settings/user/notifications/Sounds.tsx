import { Trans, useLingui } from "@lingui/solid/macro";
import { For, Show, createSignal } from "solid-js";
import { styled } from "styled-system/jsx";

import { useSound } from "@revolt/client";
import { ToggleableSound, useState } from "@revolt/state";
import {
  Button,
  Checkbox,
  IconButton,
  Slider,
  Text,
  iconSize,
} from "@revolt/ui";

import MdCall from "@material-design-icons/svg/outlined/call.svg?component-solid";
import MdChat from "@material-design-icons/svg/outlined/chat.svg?component-solid";
import MdHeadset from "@material-design-icons/svg/outlined/headset.svg?component-solid";
import MdHeadsetOff from "@material-design-icons/svg/outlined/headset_off.svg?component-solid";
import MdLogin from "@material-design-icons/svg/outlined/login.svg?component-solid";
import MdLogout from "@material-design-icons/svg/outlined/logout.svg?component-solid";
import MdMic from "@material-design-icons/svg/outlined/mic.svg?component-solid";
import MdMicOff from "@material-design-icons/svg/outlined/mic_off.svg?component-solid";
import MdScreenShare from "@material-design-icons/svg/outlined/screen_share.svg?component-solid";
import MdStopScreenShare from "@material-design-icons/svg/outlined/stop_screen_share.svg?component-solid";
import MdVolumeUp from "@material-design-icons/svg/outlined/volume_up.svg?component-solid";

/**
 * Icon for a given sound
 */
function SoundIcon(props: { soundKey: ToggleableSound }) {
  switch (props.soundKey) {
    case "message":
      return <MdChat {...iconSize(18)} />;
    case "ringtoneIncoming":
      return <MdCall {...iconSize(18)} />;
    case "mute":
      return <MdMicOff {...iconSize(18)} />;
    case "unmute":
      return <MdMic {...iconSize(18)} />;
    case "deafen":
      return <MdHeadsetOff {...iconSize(18)} />;
    case "undeafen":
      return <MdHeadset {...iconSize(18)} />;
    case "userJoinVoice":
      return <MdLogin {...iconSize(18)} />;
    case "userLeaveVoice":
    case "userSelfLeaveVoice":
      return <MdLogout {...iconSize(18)} />;
    case "streamStart":
      return <MdScreenShare {...iconSize(18)} />;
    case "streamEnd":
      return <MdStopScreenShare {...iconSize(18)} />;
    default:
      return null;
  }
}

/**
 * List of individually configurable sounds, in display order
 */
const SOUND_KEYS: ToggleableSound[] = [
  "message",
  "ringtoneIncoming",
  "mute",
  "unmute",
  "deafen",
  "undeafen",
  "userJoinVoice",
  "userLeaveVoice",
  "userSelfLeaveVoice",
  "streamStart",
  "streamEnd",
];

/**
 * Translated label for a given sound
 */
function SoundLabel(props: { soundKey: ToggleableSound }) {
  switch (props.soundKey) {
    case "message":
      return <Trans>Message Received</Trans>;
    case "ringtoneIncoming":
      return <Trans>Incoming Call</Trans>;
    case "mute":
      return <Trans>Mute</Trans>;
    case "unmute":
      return <Trans>Unmute</Trans>;
    case "deafen":
      return <Trans>Deafen</Trans>;
    case "undeafen":
      return <Trans>Undeafen</Trans>;
    case "userJoinVoice":
      return <Trans>User Joined Call</Trans>;
    case "userLeaveVoice":
      return <Trans>User Left Call</Trans>;
    case "userSelfLeaveVoice":
      return <Trans>You Left Call</Trans>;
    case "streamStart":
      return <Trans>Stream Start</Trans>;
    case "streamEnd":
      return <Trans>Stream End</Trans>;
    default:
      return null;
  }
}

export default function Sounds() {
  const { settings, sounds } = useState();
  const soundController = useSound();
  const { t } = useLingui();

  const playSoundString = t`Play sound`;

  const [volume, setVolume] = createSignal(sounds.getVolume());

  function onVolumeInput(event: { currentTarget: { value: number } }) {
    setVolume(event.currentTarget.value);
    sounds.setVolume(event.currentTarget.value);
  }

  // Preview a representative sound once the user releases the master slider
  function onVolumeChange(event: { currentTarget: { value: number } }) {
    onVolumeInput(event);
    soundController.playSound("message", true);
  }

  return (
    <Show when={settings.desktopNotificationsState !== "unsupported"}>
      <Wrapper>
        <Text class="title">
          <Trans>Sounds</Trans>
        </Text>
        <VolumeControl>
          <Text class="label">
            <Trans>Sound Volume</Trans>
          </Text>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={volume()}
            onInput={onVolumeInput}
            onChange={onVolumeChange}
            labelFormatter={(v) => `${Math.round(v * 100)}%`}
          />
        </VolumeControl>
        <SoundList>
          <For each={SOUND_KEYS}>
            {(key) => (
              <SoundEntry soundKey={key} playSoundString={playSoundString} />
            )}
          </For>
        </SoundList>
        <ResetRow>
          <Button variant="text" onPress={() => sounds.resetSoundVolumes()}>
            <Trans>Reset sound volumes to 100%</Trans>
          </Button>
        </ResetRow>
      </Wrapper>
    </Show>
  );
}

/**
 * A single sound's toggle, test button and volume slider, all within one box
 */
function SoundEntry(props: {
  soundKey: ToggleableSound;
  playSoundString: string;
}) {
  const { sounds } = useState();
  const soundController = useSound();

  function onSoundVolumeInput(event: { currentTarget: { value: number } }) {
    sounds.setSoundVolume(props.soundKey, event.currentTarget.value);
  }

  // Preview the sound once the user releases the slider
  function onSoundVolumeChange(event: { currentTarget: { value: number } }) {
    onSoundVolumeInput(event);
    soundController.playSound(props.soundKey, true);
  }

  return (
    <SoundBox>
      <TopRow>
        <IconWrapper>
          <SoundIcon soundKey={props.soundKey} />
        </IconWrapper>
        <Label>
          <SoundLabel soundKey={props.soundKey} />
        </Label>
        <Checkbox
          checked={sounds.enabled(props.soundKey)}
          onChange={() => sounds.toggle(props.soundKey)}
        />
        <IconButton
          onPress={() => soundController.playSound(props.soundKey, true)}
          use:floating={{
            tooltip: {
              placement: "top",
              content: props.playSoundString,
            },
          }}
        >
          <MdVolumeUp {...iconSize(18)} />
        </IconButton>
      </TopRow>
      <SliderRow>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={sounds.getSoundVolume(props.soundKey)}
          onInput={onSoundVolumeInput}
          onChange={onSoundVolumeChange}
          labelFormatter={(v) => `${Math.round(v * 100)}%`}
        />
      </SliderRow>
    </SoundBox>
  );
}

const Wrapper = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-md)",
  },
});

/**
 * Global sound volume control
 */
const VolumeControl = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-sm)",

    padding: "16px",
    borderRadius: "var(--borderRadius-md)",
    background: "var(--md-sys-color-surface-container-low)",
  },
});

const SoundList = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-xs)",
  },
});

/**
 * Box for a single sound: toggle row + volume slider together, same
 * neutral surface tone as the rest of the settings list.
 */
const SoundBox = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-sm)",

    padding: "14px 16px",
    borderRadius: "var(--borderRadius-md)",

    background: "var(--md-sys-color-surface-container-low)",
    color: "var(--md-sys-color-on-surface)",
    boxShadow: "0 0 0 1px var(--md-sys-color-outline-variant)",

    transition: "background-color 0.15s ease, box-shadow 0.15s ease",

    "&:hover": {
      background: "var(--md-sys-color-surface-container)",
      boxShadow:
        "0 4px 12px -6px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--md-sys-color-outline-variant)",
    },
  },
});

const TopRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
});

const IconWrapper = styled("div", {
  base: {
    flexShrink: 0,
    width: "36px",
    height: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    borderRadius: "var(--borderRadius-full)",
    background: "var(--md-sys-color-surface-container-high)",
    fill: "var(--md-sys-color-on-surface)",
  },
});

const Label = styled("div", {
  base: {
    flexGrow: 1,
    fontWeight: 500,
    fontSize: "14px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
});

const SliderRow = styled("div", {
  base: {
    padding: "0 48px",
  },
});

const ResetRow = styled("div", {
  base: {
    display: "flex",
    justifyContent: "center",
  },
});
