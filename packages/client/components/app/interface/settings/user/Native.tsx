import { Show, createSignal, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useState } from "@revolt/state";
import { CategoryButton, Checkbox, Column } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

declare type DesktopConfig = {
  firstLaunch: boolean;
  customFrame: boolean;
  minimiseToTray: boolean;
  startMinimisedToTray: boolean;
  spellchecker: boolean;
  hardwareAcceleration: boolean;
  discordRpc: boolean;
  windowState: {
    isMaximised: boolean;
  };
};

declare global {
  interface Window {
    native: {
      versions: {
        node(): string;
        chrome(): string;
        electron(): string;
        desktop(): string;
      };
      minimise(): void;
      maximise(): void;
      close(): void;
      onceScreenPicker(
        onScreenPick: (
          sources: {
            idx: number;
            name: string;
            isFullScreen: boolean;
            image?: string;
          }[],
        ) => void,
      ): void;
      screenPickerCallback(
        idx: number,
        audio: boolean,
        trackActiveWindow?: boolean,
      ): void;
      isWayland?(): boolean;

      /**
       * Get the name of the application currently focused on the desktop,
       * for use as an automatic "Playing X" status. Not implemented by
       * every build of the desktop app — always feature-detect before use.
       */
      getActiveWindow?(): Promise<string | undefined>;

      /**
       * Opt into "track active window" screen sharing: after picking this
       * mode in the screen share picker, the desktop app should call the
       * provided callback with a new `desktopCapturer` source id every
       * time the focused window changes, so we can swap the live screen
       * share track to follow it. Not implemented by every build of the
       * desktop app — always feature-detect before use.
       */
      onActiveWindowTrackSwitch?(
        callback: (sourceId: string) => void,
      ): () => void;

      /**
       * Fired when the app is brought back via the stoat:// deep link used
       * to return here after finishing Spotify OAuth in the system
       * browser (see Account.tsx's connectSpotify). Not implemented by
       * every build of the desktop app - always feature-detect before use.
       */
      onSpotifyConnected?(callback: () => void): () => void;
    };

    desktopConfig: {
      get(): DesktopConfig;
      set(config: Partial<DesktopConfig>): void;
      getAutostart(): Promise<boolean>;
      setAutostart(value: boolean): Promise<boolean>;
    };
  }
}

/**
 * Desktop Configuration Page
 */
export default function Native() {
  const { t } = useLingui();
  const { settings } = useState();
  const [autostart, setAutostart] = createSignal(false);
  const [config, setConfig] = createSignal(window.desktopConfig.get());

  function set(config: Partial<DesktopConfig>) {
    window.desktopConfig.set(config);
    setConfig((conf) => ({ ...conf, ...config }));
  }

  onMount(async () => {
    const value = await window.desktopConfig.getAutostart();
    setAutostart(value);
  });

  async function toggleAutostart() {
    const newValue = !autostart();
    const savedValue = await window.desktopConfig.setAutostart(newValue);
    setAutostart(savedValue);
  }

  const toggles: Partial<Record<keyof DesktopConfig, () => void>> = {
    minimiseToTray: () => set({ minimiseToTray: !config().minimiseToTray }),
    startMinimisedToTray: () =>
      set({ startMinimisedToTray: !config().startMinimisedToTray }),
    customFrame: () => set({ customFrame: !config().customFrame }),
    discordRpc: () => set({ discordRpc: !config().discordRpc }),
    spellchecker: () => set({ spellchecker: !config().spellchecker }),
    hardwareAcceleration: () =>
      set({ hardwareAcceleration: !config().hardwareAcceleration }),
  };

  function CheckboxButton<K extends keyof Omit<DesktopConfig, "windowState">>(
    key: K,
    icon: string,
    label: string,
    description: string,
  ) {
    return (
      <CategoryButton
        action={<Checkbox checked={config()[key]} />}
        onClick={toggles[key]}
        icon={<Symbol>{icon}</Symbol>}
        description={description}
      >
        {label}
      </CategoryButton>
    );
  }

  return (
    <Column gap="lg">
      <CategoryButton.Group>
        <CategoryButton
          action={<Checkbox checked={autostart()} />}
          onClick={toggleAutostart}
          icon={<Symbol>exit_to_app</Symbol>}
          description={
            <Trans>Launch Stoat when you log into your computer.</Trans>
          }
        >
          <Trans>Start with Computer</Trans>
        </CategoryButton>
        {autostart() &&
          CheckboxButton(
            "startMinimisedToTray",
            "minimize",
            t`Start Minimised to Tray`,
            t`Stoat will start in the system tray.`,
          )}
        {CheckboxButton(
          "minimiseToTray",
          "cancel_presentation",
          t`Minimise to Tray`,
          t`Instead of closing, Stoat will hide in your tray.`,
        )}
        {CheckboxButton(
          "customFrame",
          "web_asset",
          t`Custom window frame`,
          t`Let Stoat use its own custom titlebar.`,
        )}
      </CategoryButton.Group>

      <CategoryButton.Group>
        <Show when={window.native?.getActiveWindow}>
          <CategoryButton
            action={
              <Checkbox
                checked={settings.getValue("desktop:activity_status")}
              />
            }
            onClick={() =>
              settings.setValue(
                "desktop:activity_status",
                !settings.getValue("desktop:activity_status"),
              )
            }
            icon={<Symbol>sports_esports</Symbol>}
            description={
              <Trans>
                Automatically show the app you're currently using as your
                status.
              </Trans>
            }
          >
            <Trans>Show Current Activity</Trans>
          </CategoryButton>
        </Show>
        {CheckboxButton(
          "discordRpc",
          "groups_2",
          t`Discord RPC`,
          t`Rep Stoat using Discord rich presence.`,
        )}
        {CheckboxButton(
          "spellchecker",
          "spellcheck",
          t`Spellchecker`,
          t`Show corrections and suggestions as you type.`,
        )}
        {CheckboxButton(
          "hardwareAcceleration",
          "speed",
          t`Hardware Acceleration`,
          t`Use the graphics card to improve performance.`,
        )}
      </CategoryButton.Group>

      <CategoryButton.Group>
        <CategoryButton
          icon={<Symbol>desktop_windows</Symbol>}
          description={
            <>
              <Trans>Version:</Trans> {window.native.versions.desktop()}
            </>
          }
        >
          <Trans>Stoat for Desktop</Trans>
        </CategoryButton>
      </CategoryButton.Group>
    </Column>
  );
}
