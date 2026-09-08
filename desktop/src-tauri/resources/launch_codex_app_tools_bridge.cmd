@echo off
setlocal
set "BRIDGE=%~dp0codex_app_tools_bridge.mjs"

if defined CODEX_MCP_NODE_PATH if exist "%CODEX_MCP_NODE_PATH%" (
  "%CODEX_MCP_NODE_PATH%" "%BRIDGE%" %*
  exit /b
)

if defined APPDATA if exist "%APPDATA%\Buzz\runtimes\node" (
  for /f "delims=" %%F in ('where.exe /r "%APPDATA%\Buzz\runtimes\node" node.exe 2^>nul') do (
    "%%F" "%BRIDGE%" %*
    exit /b
  )
)

if defined LOCALAPPDATA if exist "%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node" (
  for /f "delims=" %%F in ('where.exe /r "%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node" node.exe 2^>nul') do (
    "%%F" "%BRIDGE%" %*
    exit /b
  )
)

where.exe node.exe >nul 2>nul
if not errorlevel 1 (
  node.exe "%BRIDGE%" %*
  exit /b
)

>&2 echo Buzz could not find Node.js for the Codex app-tools bridge.
exit /b 1
