import OBR from "@owlbear-rodeo/sdk";
import type { Metadata } from "@owlbear-rodeo/sdk";
import { applyBackgroundEffect, removeBackgroundEffect } from "./effect";
import {
  parseRoomBackgroundSettings,
  type RoomBackgroundSettings,
} from "./settings";

let unsubscribeSceneReady: (() => void) | null = null;
let unsubscribeRoomMetadata: (() => void) | null = null;
let currentSettings: RoomBackgroundSettings | null = null;
let metadataLoaded = false;
let metadataRevision = 0;
let synchronizationQueue: Promise<void> = Promise.resolve();

async function synchronizeBackground(): Promise<void> {
  if (!metadataLoaded || !(await OBR.scene.isReady())) {
    return;
  }

  if (currentSettings?.enabled) {
    await applyBackgroundEffect(currentSettings.color);
  } else {
    await removeBackgroundEffect();
  }
}

function scheduleSynchronization(): void {
  synchronizationQueue = synchronizationQueue
    .then(synchronizeBackground, synchronizeBackground)
    .catch(reportError);
}

function settingsAreEqual(
  left: RoomBackgroundSettings | null,
  right: RoomBackgroundSettings | null,
): boolean {
  return left?.enabled === right?.enabled && left?.color === right?.color;
}

function receiveRoomMetadata(metadata: Metadata): void {
  const nextSettings = parseRoomBackgroundSettings(metadata);
  const changed =
    !metadataLoaded || !settingsAreEqual(currentSettings, nextSettings);

  currentSettings = nextSettings;
  metadataLoaded = true;
  if (changed) {
    scheduleSynchronization();
  }
}

async function reportError(error: unknown): Promise<void> {
  const detail = error instanceof Error ? error.message : String(error);
  try {
    await OBR.notification.show(`Scene Background: ${detail}`, "ERROR");
  } catch {
    // The host may already be unavailable while the background iframe unloads.
  }
}

async function startBackgroundLifecycle(): Promise<void> {
  stopBackgroundLifecycle();

  const initialMetadataRevision = metadataRevision;
  unsubscribeRoomMetadata = OBR.room.onMetadataChange((metadata) => {
    metadataRevision += 1;
    receiveRoomMetadata(metadata);
  });

  unsubscribeSceneReady?.();
  unsubscribeSceneReady = OBR.scene.onReadyChange((ready) => {
    if (ready) {
      scheduleSynchronization();
    }
  });

  const metadata = await OBR.room.getMetadata();
  if (metadataRevision === initialMetadataRevision) {
    receiveRoomMetadata(metadata);
  }
}

function stopBackgroundLifecycle(): void {
  unsubscribeSceneReady?.();
  unsubscribeSceneReady = null;
  unsubscribeRoomMetadata?.();
  unsubscribeRoomMetadata = null;
}

OBR.onReady(() => {
  void startBackgroundLifecycle().catch(reportError);
});

window.addEventListener("pagehide", stopBackgroundLifecycle, { once: true });

if (import.meta.hot) {
  import.meta.hot.dispose(stopBackgroundLifecycle);
}
