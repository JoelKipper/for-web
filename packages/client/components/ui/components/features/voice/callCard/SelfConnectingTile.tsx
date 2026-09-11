import { useClient } from "@revolt/client";
import { userInformation } from "@revolt/markdown/users";
import { Avatar } from "@revolt/ui/components/design";
import { OverflowingText } from "@revolt/ui/components/utils";

import { AvatarOnly, Overlay, OverlayInner, tile } from "./ParticipantTile";

/**
 * Placeholder tile standing in for the local user while a call is still
 * connecting - LiveKit only assigns the local participant a real identity
 * once the connection completes, so the normal per-participant tile can't
 * resolve "you" until then. Shown so the call looks already joined from the
 * moment you click, instead of an empty grid until the handshake finishes.
 */
export function SelfConnectingTile() {
  const client = useClient();
  const info = () => userInformation(client()?.user);

  return (
    <div class={tile({ video: false }) + " vc_tile"}>
      <AvatarOnly>
        <Avatar
          src={info().avatar}
          fallback={info().username}
          size={48}
          interactive={false}
        />
      </AvatarOnly>
      <Overlay showOnHover={false}>
        <OverlayInner>
          <OverflowingText>{info().username}</OverflowingText>
        </OverlayInner>
      </Overlay>
    </div>
  );
}
