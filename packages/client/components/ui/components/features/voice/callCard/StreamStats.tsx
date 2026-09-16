import { Show, createSignal, onCleanup } from "solid-js";

import type { VideoReceiverStats, VideoSenderStats } from "livekit-client";
import { styled } from "styled-system/jsx";

import { TrackReferenceOrPlaceholder } from "solid-livekit-components";

import { IconButton } from "@revolt/ui/components/design";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

const POLL_INTERVAL_MS = 2000;

type Row = { label: string; value: string };

/**
 * bytesSent/bytesReceived delta between two samples, converted to kbps.
 * Returns undefined for the first sample (nothing to diff against).
 */
function bitrateKbps(
  currentBytes: number | undefined,
  currentTimestamp: number,
  prevBytes: number | undefined,
  prevTimestamp: number | undefined,
): number | undefined {
  if (
    currentBytes === undefined ||
    prevBytes === undefined ||
    prevTimestamp === undefined
  )
    return undefined;
  const seconds = (currentTimestamp - prevTimestamp) / 1000;
  if (seconds <= 0) return undefined;
  return Math.round(((currentBytes - prevBytes) * 8) / seconds / 1000);
}

function msRow(label: string, seconds: number | undefined): Row | undefined {
  if (seconds === undefined) return undefined;
  return { label, value: `${Math.round(seconds * 1000)}ms` };
}

/**
 * Builds display rows for a local (outgoing) screen share track, i.e. what
 * you're actually sending, as opposed to what LiveKit was asked to send.
 */
function senderRows(
  current: VideoSenderStats,
  prev: VideoSenderStats | undefined,
): Row[] {
  const rows: Row[] = [
    {
      label: "Resolution",
      value: `${current.frameWidth ?? "?"}x${current.frameHeight ?? "?"}`,
    },
    { label: "FPS", value: `${Math.round(current.framesPerSecond ?? 0)}` },
  ];

  const actual = bitrateKbps(
    current.bytesSent,
    current.timestamp,
    prev?.bytesSent,
    prev?.timestamp,
  );
  rows.push({
    label: "Bitrate",
    value: `${actual ?? "?"} / ${Math.round((current.targetBitrate ?? 0) / 1000)} kbps`,
  });

  rows.push({
    label: "Limited by",
    value: current.qualityLimitationReason ?? "none",
  });

  if (current.packetsLost !== undefined) {
    rows.push({ label: "Packets lost", value: `${current.packetsLost}` });
  }

  const rtt = msRow("RTT", current.roundTripTime);
  if (rtt) rows.push(rtt);

  const jitter = msRow("Jitter", current.jitter);
  if (jitter) rows.push(jitter);

  return rows;
}

/**
 * Builds display rows for a remote (incoming) screen share track, i.e. what
 * you're actually receiving - useful to check whether choppiness is on the
 * sender's end or your own decode/network path.
 */
function receiverRows(
  current: VideoReceiverStats,
  prev: VideoReceiverStats | undefined,
): Row[] {
  const rows: Row[] = [];

  if (current.frameWidth && current.frameHeight) {
    rows.push({
      label: "Resolution",
      value: `${current.frameWidth}x${current.frameHeight}`,
    });
  }

  const actual = bitrateKbps(
    current.bytesReceived,
    current.timestamp,
    prev?.bytesReceived,
    prev?.timestamp,
  );
  if (actual !== undefined) {
    rows.push({ label: "Bitrate", value: `${actual} kbps` });
  }

  rows.push({
    label: "Frames decoded/dropped",
    value: `${current.framesDecoded} / ${current.framesDropped}`,
  });

  if (current.packetsLost !== undefined) {
    rows.push({ label: "Packets lost", value: `${current.packetsLost}` });
  }

  const jitter = msRow("Jitter", current.jitter);
  if (jitter) rows.push(jitter);

  const bufferDelay = msRow("Jitter buffer", current.jitterBufferDelay);
  if (bufferDelay) rows.push(bufferDelay);

  if (current.decoderImplementation) {
    rows.push({ label: "Decoder", value: current.decoderImplementation });
  }

  return rows;
}

/**
 * Live connection-stats overlay for a screen share tile - toggleable via a
 * small info button, polls livekit-client's own sender/receiver stats every
 * few seconds so quality issues (CPU vs bandwidth vs network loss) can be
 * diagnosed without needing chrome://webrtc-internals.
 */
export function StreamStats(props: { track: TrackReferenceOrPlaceholder }) {
  const [open, setOpen] = createSignal(false);
  const [rows, setRows] = createSignal<Row[]>([]);

  let timer: ReturnType<typeof setInterval> | undefined;
  let prevSender: VideoSenderStats | undefined;
  let prevReceiver: VideoReceiverStats | undefined;

  async function poll() {
    const videoTrack = props.track.publication?.videoTrack;
    if (!videoTrack) return;

    if ("getSenderStats" in videoTrack) {
      const [current] = await videoTrack.getSenderStats();
      if (current) {
        setRows(senderRows(current, prevSender));
        prevSender = current;
      }
    } else if ("getReceiverStats" in videoTrack) {
      const current = await videoTrack.getReceiverStats();
      if (current) {
        setRows(receiverRows(current, prevReceiver));
        prevReceiver = current;
      }
    }
  }

  function toggle() {
    const next = !open();
    setOpen(next);

    if (next) {
      prevSender = undefined;
      prevReceiver = undefined;
      poll();
      timer = setInterval(poll, POLL_INTERVAL_MS);
    } else if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  }

  onCleanup(() => {
    if (timer) clearInterval(timer);
  });

  return (
    <>
      <ToggleCorner>
        <IconButton
          size="xs"
          variant={open() ? "tonal" : "standard"}
          onPress={toggle}
          use:floating={{
            tooltip: { placement: "bottom", content: "Connection stats" },
          }}
        >
          <Symbol>monitoring</Symbol>
        </IconButton>
      </ToggleCorner>
      <Show when={open()}>
        <Panel>
          <Show
            when={rows().length}
            fallback={<PanelRow>Waiting for stats…</PanelRow>}
          >
            {rows().map((row) => (
              <PanelRow>
                <span>{row.label}</span>
                <span>{row.value}</span>
              </PanelRow>
            ))}
          </Show>
        </Panel>
      </Show>
    </>
  );
}

const ToggleCorner = styled("div", {
  base: {
    gridArea: "1/1",
    display: "flex",
    alignItems: "start",
    justifyContent: "end",
    padding: "var(--gap-md) var(--gap-lg)",
    opacity: 0,
    transition: "var(--transitions-fast) all",
    transitionTimingFunction: "ease",

    _groupHover: {
      opacity: 1,
    },
  },
});

const Panel = styled("div", {
  base: {
    gridArea: "1/1",
    justifySelf: "end",
    alignSelf: "start",
    margin: "calc(var(--gap-md) + 40px) var(--gap-lg) var(--gap-md)",

    display: "flex",
    flexDirection: "column",
    gap: "2px",

    padding: "var(--gap-sm) var(--gap-md)",
    borderRadius: "var(--borderRadius-md)",
    background: "color-mix(in srgb, 80% black, transparent)",
    color: "white",

    fontFamily: "monospace",
    fontSize: "0.75rem",
    whiteSpace: "nowrap",
    pointerEvents: "none",
  },
});

const PanelRow = styled("div", {
  base: {
    display: "flex",
    justifyContent: "space-between",
    gap: "var(--gap-md)",
  },
});
