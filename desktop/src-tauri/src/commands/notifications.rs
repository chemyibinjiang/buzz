//! Native desktop-notification helpers.
//!
//! `tauri-plugin-notification` posts a notification by calling `notify_rust`'s
//! `show()` and then immediately dropping the returned `NotificationHandle`.
//! That handle owns the D-Bus connection used to post the notification, and on
//! GNOME 46+ (Ubuntu 24.04+, Fedora 41+) tearing that connection down dismisses
//! the notification the instant it appears — so notifications never show.
//! See tauri-apps/plugins-workspace#2566 and hoodie/notify-rust#218.
//!
//! We side-step the plugin on Linux and Windows by posting the notification
//! from a dedicated thread that holds the native notification handle until the
//! notification is closed. The same wait surfaces the default click action,
//! which we forward to the frontend so it can focus the window and route to the
//! notification target. On Windows this also avoids the plugin's fire-and-forget
//! path, which discarded native toast errors and could leave Buzz absent from
//! the system notification application list.

pub(crate) const NATIVE_NOTIFICATION_ACTIVATED_EVENT: &str = "native-notification-activated";

/// Show a desktop notification natively.
///
/// Linux uses the connection-preserving D-Bus path described above. Windows
/// posts against Buzz's stable AppUserModelID. macOS uses one
/// application-lifetime `UNUserNotificationCenterDelegate`; it does not
/// allocate a listener or waiter for each notification.
#[tauri::command]
pub async fn show_native_notification(
    app: tauri::AppHandle,
    title: String,
    body: Option<String>,
    target: Option<serde_json::Value>,
) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        linux::show(app, title, body, target);
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        let _ = app;
        crate::macos_notifications::show(title, body, target).await
    }

    #[cfg(target_os = "windows")]
    {
        windows::show(app, title, body, target).await
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        let _ = (&app, &title, &body, &target);
        Err("show_native_notification is not supported on this platform".to_string())
    }
}

/// Ensures installed Windows builds have the stable identity required by the
/// toast platform. The NSIS hook writes the same values during installation;
/// doing it again at startup repairs upgrades from older installers without
/// requiring users to uninstall first.
#[cfg(target_os = "windows")]
pub fn initialize_windows_notification_identity(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    use windows_registry::CURRENT_USER;

    let identifier = &app.config().identifier;
    let display_name = app.config().product_name.as_deref().unwrap_or("Buzz");
    let icon_uri = app
        .path()
        .resource_dir()
        .ok()
        .map(|resource_dir| resource_dir.join("icons").join("icon.ico"))
        .filter(|path| path.is_file())
        .or_else(|| std::env::current_exe().ok())
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_default();

    let key = CURRENT_USER
        .create(format!(r"Software\Classes\AppUserModelId\{identifier}"))
        .map_err(|error| error.to_string())?;
    key.set_string("DisplayName", display_name)
        .map_err(|error| error.to_string())?;
    key.set_string("IconBackgroundColor", "0")
        .map_err(|error| error.to_string())?;
    if !icon_uri.is_empty() {
        key.set_string("IconUri", &icon_uri)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "windows")]
mod windows {
    use super::NATIVE_NOTIFICATION_ACTIVATED_EVENT;
    use tauri::Emitter;

    pub async fn show(
        app: tauri::AppHandle,
        title: String,
        body: Option<String>,
        target: Option<serde_json::Value>,
    ) -> Result<(), String> {
        let identifier = app.config().identifier.clone();
        let display_name = app
            .config()
            .product_name
            .clone()
            .unwrap_or_else(|| "Buzz".to_string());

        let (posted_tx, posted_rx) = tokio::sync::oneshot::channel();
        std::thread::Builder::new()
            .name("buzz-windows-notification".to_string())
            .spawn(move || {
                let mut builder = notify_rust::Notification::new();
                builder
                    .summary(&title)
                    .appname(&display_name)
                    .app_id(&identifier);
                if let Some(body) = body.as_deref() {
                    builder.body(body);
                }
                builder.auto_icon();
                builder.action("default", "Open");

                let handle = match builder.show() {
                    Ok(handle) => {
                        let _ = posted_tx.send(Ok(()));
                        handle
                    }
                    Err(error) => {
                        let message = error.to_string();
                        let _ = posted_tx.send(Err(message.clone()));
                        eprintln!("buzz-desktop: failed to post Windows notification: {message}");
                        return;
                    }
                };

                handle.wait_for_action(|action| {
                    if action == "default" {
                        let _ = app.emit(NATIVE_NOTIFICATION_ACTIVATED_EVENT, target);
                    }
                });
            })
            .map_err(|error| error.to_string())?;

        posted_rx
            .await
            .map_err(|_| "Windows notification worker exited before posting".to_string())?
    }
}

#[cfg(target_os = "linux")]
mod linux {
    use super::NATIVE_NOTIFICATION_ACTIVATED_EVENT;
    use tauri::Emitter;

    pub fn show(
        app: tauri::AppHandle,
        title: String,
        body: Option<String>,
        target: Option<serde_json::Value>,
    ) {
        // notify_rust's `show()` blocks on D-Bus and the returned handle must
        // outlive the notification, so this runs on its own thread rather than
        // the async runtime.
        std::thread::spawn(move || {
            let mut builder = notify_rust::Notification::new();
            builder.summary(&title);
            if let Some(body) = body.as_deref() {
                builder.body(body);
            }
            if let Some(name) = app.config().product_name.clone() {
                builder.appname(&name);
            }
            // Tie the notification to the installed desktop entry so GNOME shows
            // the app's name and icon and groups our notifications together.
            builder.hint(notify_rust::Hint::DesktopEntry(
                app.config().identifier.clone(),
            ));
            builder.auto_icon();
            // Match the silent posting used on other platforms; the app does its
            // own unread cues and a per-message sound would be noisy.
            builder.hint(notify_rust::Hint::SuppressSound(true));
            // Declaring a default action makes the whole notification clickable.
            builder.action("default", "Open");

            let handle = match builder.show() {
                Ok(handle) => handle,
                Err(error) => {
                    eprintln!("buzz-desktop: failed to post native notification: {error}");
                    return;
                }
            };

            // Block until the notification is actioned or closed. Holding the
            // handle keeps its D-Bus connection alive, which is what stops
            // GNOME 46+ from dismissing the notification immediately. The wait
            // also returns when the notification expires or is dismissed, so
            // the thread does not leak.
            handle.wait_for_action(|action| {
                if action != "default" {
                    return;
                }

                // The frontend focuses the window on activation (the same path
                // every other platform uses), so we only forward the target.
                let _ = app.emit(NATIVE_NOTIFICATION_ACTIVATED_EVENT, target);
            });
        });
    }
}
