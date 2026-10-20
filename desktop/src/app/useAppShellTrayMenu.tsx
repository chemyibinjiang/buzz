import type { Channel } from "@/shared/api/types";
import { isMacPlatform, isWindowsPlatform } from "@/shared/lib/platform";

import { useTrayMenu } from "@/app/useTrayMenu";

/** Keeps the ticking native tray menu outside AppShell's render cycle. */
export function AppShellTrayMenu({
  attentionCount,
  channels,
  goChannel,
}: {
  attentionCount: number;
  channels: Channel[];
  goChannel: (channelId: string) => Promise<unknown>;
}) {
  if (!isMacPlatform() && !isWindowsPlatform()) return null;
  return (
    <NativeAppShellTrayMenu
      attentionCount={attentionCount}
      channels={channels}
      goChannel={goChannel}
    />
  );
}

function NativeAppShellTrayMenu({
  attentionCount,
  channels,
  goChannel,
}: {
  attentionCount: number;
  channels: Channel[];
  goChannel: (channelId: string) => Promise<unknown>;
}): null {
  useTrayMenu({
    attentionCount,
    channels,
    goChannel,
  });
  return null;
}
