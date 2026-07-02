# Vectorworks Voice Commands

Vectorworks Voice Commands is a separate Studio McLeod Tools Hub module for maintaining fixed, approved voice commands for Vectorworks and other studio tools.

Version 1 maps:

Spoken phrase -> Tools Hub command lookup -> local Mac helper endpoint -> AppleScript shortcut

It deliberately does not provide open-ended AI control.

## What Version 1 Supports

- View all commands
- Add, edit, enable, disable, and delete commands
- Import and export commands as JSON or CSV
- Use browser speech recognition where supported
- Match speech by lowercased, trimmed exact phrase
- Test a command without sending a keystroke
- Send shortcut commands through AppleScript on macOS

Only `shortcut` actions can run in version 1. `macro` and `script` rows can be stored for later, but they are not executable yet.

## Command Fields

- `id`
- `enabled`
- `voicePhrase`
- `targetApp`
- `actionType`
- `key`
- `modifiers`
- `macroName`
- `notes`

Allowed modifiers are:

- `command`
- `shift`
- `option`
- `control`

Allowed target apps are:

- `Vectorworks 2026`
- `Vectorworks`
- `Vectorworks 2025`
- `Miro`
- `Chrome`
- `Finder`
- `Other`

## macOS Setup

The local helper uses `osascript` to activate the target app and send a keystroke through System Events.

macOS will probably require Accessibility permissions for the process that sends keystrokes. In local development that is usually Terminal, iTerm, VS Code, or the app running the Node server. In production-like local use it may be whichever process starts `pnpm start`.

Enable this in:

System Settings -> Privacy & Security -> Accessibility

For Vectorworks commands, the helper targets the open Vectorworks process rather than requiring an exact yearly app name. Open your installed Vectorworks version before running the command.

Vectorworks must also have matching keyboard shortcuts configured in its workspace. The Tools Hub sends the shortcut; Vectorworks decides what that shortcut does.

Number shortcuts distinguish between the main keyboard row and the numeric keypad. Enter `4` for the top-row 4 key. Enter `numpad 4`, `keypad 4`, or `numeric 4` for the numeric keypad 4 key.

## Test Mode

Keep Test mode enabled when checking a command for the first time. Test mode returns the generated AppleScript and does not send a keystroke to Vectorworks.

Turn Test mode off only when you are ready to send the shortcut to the target Mac app.

## Push-to-talk in Vectorworks

The browser Listen button is only a test surface. A web page cannot detect the left Option/Alt key while Vectorworks is the active app.

For real use, use a native Mac helper such as Hammerspoon. That helper should own the global push-to-talk key and then call the Tools Hub local endpoint with the recognised phrase.

Local helper endpoint:

```bash
curl -X POST http://localhost:8090/api/local/voice-commands/run \
  -H "Content-Type: application/json" \
  -d '{"voicePhrase":"rectangle","dryRun":false}'
```

This endpoint only accepts requests from the same Mac. It still runs fixed, enabled commands only, with exact phrase matching.

Local command list endpoint:

```bash
curl http://localhost:8090/api/local/voice-commands
```

## Hammerspoon helper

Install Hammerspoon, then paste this into `~/.hammerspoon/init.lua`.

```lua
local baseUrl = "http://localhost:8090"
local leftOptionKeyCode = 58
local listening = false
local listener = nil
local commandPhrases = {}

local function isVectorworksFrontmost()
  local app = hs.application.frontmostApplication()
  if not app then
    return false
  end
  local name = app:name() or ""
  return string.sub(name, 1, 11) == "Vectorworks"
end

local function jsonBody(value)
  return hs.json.encode(value)
end

local function runPhrase(phrase)
  hs.http.asyncPost(
    baseUrl .. "/api/local/voice-commands/run",
    jsonBody({ voicePhrase = phrase, dryRun = false }),
    { ["Content-Type"] = "application/json" },
    function(status, body)
      if status >= 200 and status < 300 then
        hs.alert.show("Voice command: " .. phrase)
      else
        hs.alert.show("Voice command failed")
        print(body)
      end
    end
  )
end

local function refreshCommands()
  hs.http.asyncGet(baseUrl .. "/api/local/voice-commands", nil, function(status, body)
    if status < 200 or status >= 300 then
    hs.alert.show("Could not load Vectorworks voice commands")
      return
    end
    local decoded = hs.json.decode(body)
    commandPhrases = {}
    for _, command in ipairs(decoded.commands or {}) do
      table.insert(commandPhrases, command.voicePhrase)
    end
    if listener and #commandPhrases > 0 then
      listener:commands(commandPhrases)
    end
  end)
end

local function ensureListener()
  if listener then
    return true
  end
  if not hs.speech or not hs.speech.listener then
    hs.alert.show("Hammerspoon speech listener is not available")
    return false
  end
  listener = hs.speech.listener.new("Vectorworks Voice Commands")
  if not listener then
    hs.alert.show("Could not create speech listener")
    return false
  end
  listener:foregroundOnly(false)
  listener:blocksOtherRecognizers(true)
  listener:setCallback(function(_, phrase)
    if phrase then
      runPhrase(string.lower(phrase))
    end
  end)
  refreshCommands()
  return true
end

local function startListening()
  if listening or not isVectorworksFrontmost() or not ensureListener() then
    return
  end
  listening = true
  hs.alert.show("Listening")
  refreshCommands()
  listener:start()
end

local function stopListening()
  if not listening then
    return
  end
  listening = false
  if listener then
    listener:stop()
  end
  hs.alert.closeAll()
end

hs.eventtap.new({ hs.eventtap.event.types.flagsChanged }, function(event)
  if event:getKeyCode() ~= leftOptionKeyCode then
    return false
  end
  local flags = event:getFlags()
  if flags.alt then
    startListening()
  else
    stopListening()
  end
  return false
end):start()

refreshCommands()
hs.alert.show("Vectorworks Voice Commands ready")
```

Then reload Hammerspoon. Open Vectorworks, hold the left Option key, say a command phrase such as `rectangle`, then release the key.

Hammerspoon will need Accessibility permissions. Depending on your macOS settings, it may also need microphone or speech-recognition permissions.

## Limitations

- Speech recognition depends on browser support for the Web Speech API.
- Browser speech recognition cannot be triggered by a key held down in Vectorworks; Hammerspoon handles that native Mac layer.
- Commands only match exact lowercased phrases in version 1.
- The server must be running on the Mac that should send the keystroke.
- `Other` is stored as a target app value, but AppleScript execution needs a real app name to activate.
- Import replaces the current command list.

## Future TODOs

- Google Sheet as shared command source
- Team permissions
- Multiple Vectorworks versions
- Keyboard Maestro integration
- Stream Deck integration
- Natural language AI interpretation
- Project-specific commands
- Command aliases
- Fuzzy matching
- Audit log of executed commands
