import { Platform } from "react-native";

// Used by the Expo/iOS transport. Android DownloadManager owns its own notifications.
let setup: Promise<typeof import("expo-notifications") | null> | undefined;

function prepare() {
  setup ??= (async () => {
    if (Platform.OS === "web") return null;
    try {
      const notifications = await import("expo-notifications");
      notifications.setNotificationHandler({
        handleNotification: async (notification) => ({
          shouldShowBanner: notification.request.content.data?.phase !== "downloading",
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      if (Platform.OS === "android") {
        await notifications.setNotificationChannelAsync("downloads", {
          name: "Downloads",
          importance: notifications.AndroidImportance.LOW,
          sound: null,
        });
      }
      let permission = await notifications.getPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) {
        permission = await notifications.requestPermissionsAsync();
      }
      return permission.granted ? notifications : null;
    } catch {
      // Existing binaries without the new native module can still download files.
      return null;
    }
  })();
  return setup;
}

export async function notifyDownload(
  mediaId: number,
  fileName: string,
  phase: "downloading" | "completed" | "failed",
) {
  try {
    const notifications = await prepare();
    if (!notifications) return;
    await notifications.scheduleNotificationAsync({
      identifier: `download-${mediaId}`,
      content: {
        title: phase === "downloading" ? "Downloading media" : phase === "completed" ? "Download complete" : "Download failed",
        body: fileName,
        sound: false,
        sticky: phase === "downloading",
        autoDismiss: phase !== "downloading",
        data: { mediaId, phase },
      },
      trigger: Platform.OS === "android" ? { channelId: "downloads" } : null,
    });
  } catch {
    // Notifications are optional; a permission or OS error cannot fail a transfer.
  }
}
