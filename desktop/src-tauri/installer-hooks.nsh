!macro BUZZ_STOP_PROCESS image_name
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM "${image_name}"'
  Pop $0
!macroend

!macro BUZZ_STOP_RUNNING_PROCESSES
  !insertmacro BUZZ_STOP_PROCESS "buzz-desktop.exe"
  !insertmacro BUZZ_STOP_PROCESS "buzz-acp.exe"
  !insertmacro BUZZ_STOP_PROCESS "buzz-agent.exe"
  !insertmacro BUZZ_STOP_PROCESS "buzz-dev-mcp.exe"
  !insertmacro BUZZ_STOP_PROCESS "buzz.exe"
  !insertmacro BUZZ_STOP_PROCESS "git-credential-nostr.exe"
  Sleep 500
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro BUZZ_STOP_RUNNING_PROCESSES
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro BUZZ_STOP_RUNNING_PROCESSES
!macroend

; Windows toast notifications need a stable AppUserModelID registration in
; addition to the AppUserModelID stored on Tauri's Start Menu shortcut. Keeping
; the display name and icon here makes Buzz appear as its own application in
; Settings > System > Notifications instead of being absent or attributed to a
; WebView/PowerShell host.
!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\AppUserModelId\${BUNDLEID}" "DisplayName" "${PRODUCTNAME}"
  WriteRegStr SHCTX "Software\Classes\AppUserModelId\${BUNDLEID}" "IconUri" "$INSTDIR\${MAINBINARYNAME}.exe"
  WriteRegStr SHCTX "Software\Classes\AppUserModelId\${BUNDLEID}" "IconBackgroundColor" "0"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey SHCTX "Software\Classes\AppUserModelId\${BUNDLEID}"
!macroend
