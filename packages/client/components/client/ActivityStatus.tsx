import { createEffect, onCleanup } from "solid-js";

import { useLingui } from "@lingui/solid/macro";

import { useState } from "@revolt/state";

import { useUser } from ".";

/**
 * How often to poll the desktop app for the currently focused window.
 */
const POLL_INTERVAL_MS = 15_000;

/**
 * Automatically reflects the currently focused desktop application as the
 * user's custom status, if the desktop app exposes `getActiveWindow` and
 * the user has opted in.
 *
 * No-ops entirely on web, or on desktop builds that don't yet implement
 * `getActiveWindow` — always feature-detect rather than assume support.
 */
export function ActivityStatusWorker() {
  const { settings } = useState();
  const user = useUser();
  const { t } = useLingui();

  let interval: ReturnType<typeof setInterval> | undefined;
  let lastReportedApp: string | undefined;

  async function poll() {
    const self = user();
    if (!self || !window.native?.getActiveWindow) return;

    const app = await window.native.getActiveWindow();
    if (app === lastReportedApp) return;
    lastReportedApp = app;

    await self.edit({
      status: {
        ...self.status,
        text: app ? t`Playing ${app}` : undefined,
      },
    });
  }

  createEffect(() => {
    const enabled =
      !!window.native?.getActiveWindow &&
      settings.getValue("desktop:activity_status");

    if (enabled && !interval) {
      poll();
      interval = setInterval(poll, POLL_INTERVAL_MS);
    } else if (!enabled && interval) {
      clearInterval(interval);
      interval = undefined;
    }
  });

  onCleanup(() => {
    if (interval) clearInterval(interval);
  });

  return null;
}
