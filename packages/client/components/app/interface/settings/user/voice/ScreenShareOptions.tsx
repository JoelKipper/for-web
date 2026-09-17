import { Trans } from "@lingui/solid/macro";

import { useVoice } from "@revolt/rtc";
import { useState } from "@revolt/state";
import {
  SCREEN_SHARE_BITRATE_MAX,
  SCREEN_SHARE_BITRATE_MIN,
  ScreenShareQualityName,
} from "@revolt/state/stores/Voice";
import {
  CategoryButton,
  CategorySelectOption,
  Checkbox,
  Column,
  Slider,
  Text,
} from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

export function ScreenShareOptions() {
  const { voice } = useState();
  const voiceContext = useVoice();

  const qualities = voiceContext.getEnabledScreenShareQualities();

  return (
    <Column>
      <Text class="title">
        <Trans>Screen Share Settings</Trans>
      </Text>
      <CategoryButton.Group>
        <CategoryButton.Select
          icon={<Symbol>screen_share</Symbol>}
          title={<Trans>Select screen share quality</Trans>}
          options={
            Object.fromEntries(
              Object.keys(qualities).map((name) => [
                name,
                {
                  title: qualities[name as ScreenShareQualityName]!.fullName,
                },
              ]),
            ) as { [key in ScreenShareQualityName]: CategorySelectOption }
          }
          value={voice.screenShareQuality}
          onUpdate={(ns) => (voice.screenShareQuality = ns)}
        />
        <CategoryButton
          icon="blank"
          action={<Checkbox checked={voice.screenShareQualityAsk} />}
          onClick={() =>
            (voice.screenShareQualityAsk = !voice.screenShareQualityAsk)
          }
        >
          <Trans>Always Ask for Screen Share Quality</Trans>
        </CategoryButton>
      </CategoryButton.Group>
      <BitrateSlider />
    </Column>
  );
}

/**
 * Lets the user cap the screen share bitrate below the selected quality's
 * default, e.g. to fit their actual upload bandwidth. 0 (the leftmost
 * position) means "auto" - use the quality preset's own bitrate.
 */
function BitrateSlider() {
  const { voice } = useState();

  return (
    <Column>
      <Text class="label">
        <Trans>Screen Share Max Bitrate</Trans>
      </Text>
      <Slider
        min={0}
        max={SCREEN_SHARE_BITRATE_MAX}
        step={SCREEN_SHARE_BITRATE_MIN}
        value={voice.screenShareMaxBitrate}
        onInput={(event) =>
          (voice.screenShareMaxBitrate = event.currentTarget.value)
        }
        labelFormatter={(label) =>
          label < SCREEN_SHARE_BITRATE_MIN
            ? "Auto"
            : `${(label / 1_000_000).toFixed(1)} Mbps`
        }
      />
    </Column>
  );
}
