use std::{
    fs,
    path::{Path, PathBuf},
};

#[cfg(windows)]
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use super::{atomic_write_json_restricted, buzz_managed_node_bin_path};

#[cfg(windows)]
use super::codex_desktop::{terminate_verified_windows_process, WindowsProcessInfo};

const BRIDGE_VERSION: u32 = 1;
const BRIDGE_SCRIPT: &str = include_str!("../../resources/codex_app_tools_bridge.mjs");
const BRIDGE_LAUNCHER: &str = include_str!("../../resources/launch_codex_app_tools_bridge.cmd");
#[cfg(not(windows))]
const DISABLED_TRANSPORT: &str = r#"mcp_servers.codex_app={command="",enabled=false}"#;

#[cfg(windows)]
const WINDOWS_CODEX_DESKTOP_LAUNCH_SCRIPT: &str = r#"
$ErrorActionPreference='Stop'
function Get-CodexAppToolPipes {
  @(Get-ChildItem -LiteralPath '\\.\pipe\' -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'codex-browser-use-*' } |
    ForEach-Object { [string]$_.Name })
}
$before=@{}
foreach ($name in @(Get-CodexAppToolPipes)) { $before[$name]=$true }
$env:CODEX_APP_SERVER_WS_URL=$env:BUZZ_CODEX_DESKTOP_SHARED_URL
$package=Get-AppxPackage | Where-Object { $_.Name -in @('OpenAI.Codex','OpenAI.CodexBeta') } | Sort-Object @{Expression={if ($_.Name -eq 'OpenAI.Codex') {0} else {1}};Ascending=$true},@{Expression={$_.Version};Descending=$true} | Select-Object -First 1
if (-not $package) { throw 'Codex Desktop is not installed' }
$application=@((Get-AppxPackageManifest -Package $package).Package.Applications.Application)[0]
$exe=[IO.Path]::GetFullPath((Join-Path $package.InstallLocation ([string]$application.Executable)))
$server=[IO.Path]::GetFullPath((Join-Path $package.InstallLocation 'app\resources\plugins\openai-bundled\plugins\codex-app-tools\server.mjs'))
if (-not (Test-Path -LiteralPath $server -PathType Leaf)) { throw "Codex app-tools server is missing: $server" }
$process=Start-Process -FilePath $exe -PassThru
$newPipes=@()
for ($attempt=0; $attempt -lt 100; $attempt++) {
  $newPipes=@(Get-CodexAppToolPipes | Where-Object { -not $before.ContainsKey($_) })
  if ($newPipes.Count -gt 0) { break }
  Start-Sleep -Milliseconds 100
}
$pipe=if ($newPipes.Count -eq 1) { "\\.\pipe\$($newPipes[0])" } else { $null }
[pscustomobject]@{
  process_id=[uint32]$process.Id
  parent_process_id=0
  executable_path=$exe
  command_line=''
  app_tools_pipe_path=$pipe
  app_tools_server_path=$server
} | ConvertTo-Json -Compress
"#;

#[cfg(windows)]
#[derive(Debug, Deserialize)]
struct WindowsCodexDesktopLaunch {
    #[serde(flatten)]
    process: WindowsProcessInfo,
    app_tools_pipe_path: Option<String>,
    app_tools_server_path: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum BridgeState {
    #[default]
    Offline,
    Launching,
    Ready,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
struct BridgeRegistry {
    version: u32,
    state: BridgeState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pipe_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    server_path: Option<String>,
}

impl Default for BridgeRegistry {
    fn default() -> Self {
        Self {
            version: BRIDGE_VERSION,
            state: BridgeState::Offline,
            pipe_path: None,
            server_path: None,
        }
    }
}

#[derive(Debug, Clone)]
pub(super) struct DesktopLaunchRegistration {
    registry_path: PathBuf,
    previous: BridgeRegistry,
}

fn bridge_dir_for_app_data(app_data_dir: &Path) -> PathBuf {
    let bundle_id = app_data_dir
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("buzz");
    let directory_name = format!(".{bundle_id}.shared-runtime-logs");
    app_data_dir
        .parent()
        .map(|parent| parent.join(&directory_name))
        .unwrap_or_else(|| PathBuf::from(directory_name))
        .join("support")
        .join("codex-app-tools")
}

fn bridge_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data dir: {error}"))?;
    Ok(bridge_dir_for_app_data(&app_data_dir))
}

fn registry_path(bridge_dir: &Path) -> PathBuf {
    bridge_dir.join("codex-app-tools-bridge.json")
}

fn write_if_changed(path: &Path, contents: &[u8]) -> Result<(), String> {
    if fs::read(path).ok().as_deref() == Some(contents) {
        return Ok(());
    }
    atomic_write_json_restricted(path, contents)
}

fn install_bridge(bridge_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(bridge_dir)
        .map_err(|error| format!("failed to create {}: {error}", bridge_dir.display()))?;
    write_if_changed(
        &bridge_dir.join("codex_app_tools_bridge.mjs"),
        BRIDGE_SCRIPT.as_bytes(),
    )?;
    write_if_changed(
        &bridge_dir.join("launch_codex_app_tools_bridge.cmd"),
        BRIDGE_LAUNCHER.as_bytes(),
    )?;
    let registry = registry_path(bridge_dir);
    if !registry.exists() {
        write_registry(&registry, &BridgeRegistry::default())?;
    }
    Ok(())
}

fn load_registry(path: &Path) -> Result<BridgeRegistry, String> {
    if !path.exists() {
        return Ok(BridgeRegistry::default());
    }
    let bytes =
        fs::read(path).map_err(|error| format!("failed to read {}: {error}", path.display()))?;
    serde_json::from_slice(&bytes)
        .map_err(|error| format!("failed to parse {}: {error}", path.display()))
}

fn write_registry(path: &Path, registry: &BridgeRegistry) -> Result<(), String> {
    let payload = serde_json::to_vec_pretty(registry)
        .map_err(|error| format!("failed to serialize Codex app-tools registry: {error}"))?;
    atomic_write_json_restricted(path, &payload)
}

fn toml_string(value: impl Into<String>) -> String {
    toml::Value::String(value.into()).to_string()
}

fn bridge_transport_config(bridge_dir: &Path, node_path: Option<&Path>) -> String {
    let launcher = toml_string(
        bridge_dir
            .join("launch_codex_app_tools_bridge.cmd")
            .to_string_lossy(),
    );
    let cwd = toml_string(bridge_dir.to_string_lossy());
    let env = node_path
        .filter(|path| path.is_file())
        .map(|path| {
            format!(
                "env={{CODEX_MCP_NODE_PATH={}}},",
                toml_string(path.to_string_lossy())
            )
        })
        .unwrap_or_default();

    format!(
        concat!(
            "mcp_servers.codex_app={{command=\"cmd.exe\",",
            "args=[\"/d\",\"/s\",\"/c\",\"call\",{}],",
            "cwd={},enabled=true,enabled_tools=[],",
            "default_tools_approval_mode=\"approve\",",
            "tools={{automation_update={{approval_mode=\"prompt\"}},",
            "create_thread={{approval_mode=\"prompt\"}},",
            "send_message_to_thread={{approval_mode=\"prompt\"}},",
            "fork_thread={{approval_mode=\"prompt\"}},",
            "handoff_thread={{approval_mode=\"prompt\"}}}},",
            "{}startup_timeout_sec=10,tool_timeout_sec=3600}}"
        ),
        launcher, cwd, env
    )
}

pub(super) fn shared_runtime_transport_config(app: &AppHandle) -> Result<String, String> {
    #[cfg(windows)]
    {
        let directory = bridge_dir(app)?;
        install_bridge(&directory)?;
        Ok(bridge_transport_config(
            &directory,
            buzz_managed_node_bin_path().as_deref(),
        ))
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Ok(DISABLED_TRANSPORT.to_string())
    }
}

pub(super) fn begin_desktop_launch(app: &AppHandle) -> Result<DesktopLaunchRegistration, String> {
    let directory = bridge_dir(app)?;
    install_bridge(&directory)?;
    let path = registry_path(&directory);
    let previous = load_registry(&path)?;
    write_registry(
        &path,
        &BridgeRegistry {
            version: BRIDGE_VERSION,
            state: BridgeState::Launching,
            pipe_path: None,
            server_path: None,
        },
    )?;
    Ok(DesktopLaunchRegistration {
        registry_path: path,
        previous,
    })
}

pub(super) fn complete_desktop_launch(
    registration: &DesktopLaunchRegistration,
    pipe_path: String,
    server_path: String,
) -> Result<(), String> {
    if pipe_path.trim().is_empty() || server_path.trim().is_empty() {
        return Err("Codex Desktop did not expose its app-tools bridge".to_string());
    }
    write_registry(
        &registration.registry_path,
        &BridgeRegistry {
            version: BRIDGE_VERSION,
            state: BridgeState::Ready,
            pipe_path: Some(pipe_path),
            server_path: Some(server_path),
        },
    )
}

pub(super) fn rollback_desktop_launch(
    registration: &DesktopLaunchRegistration,
) -> Result<(), String> {
    write_registry(&registration.registry_path, &registration.previous)
}

#[cfg(windows)]
pub(super) fn launch_codex_desktop(
    app: &AppHandle,
    url: &str,
) -> Result<WindowsProcessInfo, String> {
    use std::os::windows::process::CommandExt;

    let registration = begin_desktop_launch(app)?;
    let output = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            WINDOWS_CODEX_DESKTOP_LAUNCH_SCRIPT,
        ])
        .env("BUZZ_CODEX_DESKTOP_SHARED_URL", url)
        .creation_flags(0x0800_0000)
        .output();
    let output = match output {
        Ok(output) => output,
        Err(error) => {
            let _ = rollback_desktop_launch(&registration);
            return Err(format!("failed to launch Codex Desktop: {error}"));
        }
    };
    if !output.status.success() {
        let _ = rollback_desktop_launch(&registration);
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if detail.is_empty() {
            "Windows could not launch Codex Desktop".to_string()
        } else {
            detail
        });
    }
    let launched: WindowsCodexDesktopLaunch = match serde_json::from_slice(&output.stdout) {
        Ok(launched) => launched,
        Err(error) => {
            let _ = rollback_desktop_launch(&registration);
            return Err(format!(
                "could not read the launched Codex Desktop process: {error}"
            ));
        }
    };
    let bridge = launched
        .app_tools_pipe_path
        .zip(launched.app_tools_server_path);
    let Some((pipe_path, server_path)) = bridge else {
        let _ = terminate_verified_windows_process(&launched.process, true);
        let _ = rollback_desktop_launch(&registration);
        return Err(
            "Codex Desktop opened, but Buzz could not identify its app-tools pipe. The launch was closed to avoid attaching another Desktop instance."
                .to_string(),
        );
    };
    if let Err(error) = complete_desktop_launch(&registration, pipe_path, server_path) {
        let _ = terminate_verified_windows_process(&launched.process, true);
        let _ = rollback_desktop_launch(&registration);
        return Err(error);
    }
    Ok(launched.process)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bridge_install_is_stable_and_starts_offline() {
        let temp = tempfile::tempdir().unwrap();
        let directory = temp.path().join("bridge");

        install_bridge(&directory).unwrap();
        install_bridge(&directory).unwrap();

        assert_eq!(
            fs::read_to_string(directory.join("codex_app_tools_bridge.mjs")).unwrap(),
            BRIDGE_SCRIPT
        );
        assert_eq!(
            load_registry(&registry_path(&directory)).unwrap(),
            BridgeRegistry::default()
        );
    }

    #[test]
    fn bridge_registry_moves_from_launching_to_ready() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("registry.json");
        write_registry(&path, &BridgeRegistry::default()).unwrap();
        let registration = DesktopLaunchRegistration {
            registry_path: path.clone(),
            previous: load_registry(&path).unwrap(),
        };
        write_registry(
            &path,
            &BridgeRegistry {
                version: BRIDGE_VERSION,
                state: BridgeState::Launching,
                pipe_path: None,
                server_path: None,
            },
        )
        .unwrap();

        complete_desktop_launch(
            &registration,
            r"\\.\pipe\codex-browser-use-test".to_string(),
            r"C:\Codex\server.mjs".to_string(),
        )
        .unwrap();

        assert_eq!(
            load_registry(&path).unwrap(),
            BridgeRegistry {
                version: BRIDGE_VERSION,
                state: BridgeState::Ready,
                pipe_path: Some(r"\\.\pipe\codex-browser-use-test".to_string()),
                server_path: Some(r"C:\Codex\server.mjs".to_string()),
            }
        );
        rollback_desktop_launch(&registration).unwrap();
        assert_eq!(load_registry(&path).unwrap(), BridgeRegistry::default());
    }

    #[test]
    fn windows_transport_is_complete_and_defaults_to_no_tools() {
        let directory = Path::new(r"C:\Buzz Shared\codex-app-tools");
        let config = bridge_transport_config(directory, None);

        assert!(config.contains("command=\"cmd.exe\""));
        assert!(config.contains("enabled=true"));
        assert!(config.contains("enabled_tools=[]"));
        assert!(config.contains("launch_codex_app_tools_bridge.cmd"));
        assert!(config.contains("default_tools_approval_mode=\"approve\""));
        toml::from_str::<toml::Value>(&config).expect("transport must be valid TOML");
    }

    #[test]
    fn bridge_storage_survives_normal_app_data_reset() {
        let app_data = Path::new(r"C:\Users\test\AppData\Roaming\xyz.buzz");
        let bridge = bridge_dir_for_app_data(app_data);

        assert_eq!(
            bridge,
            Path::new(
                r"C:\Users\test\AppData\Roaming\.xyz.buzz.shared-runtime-logs\support\codex-app-tools"
            )
        );
        assert!(!bridge.starts_with(app_data));
    }
}
