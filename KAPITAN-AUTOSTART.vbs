' ── Codex-Fleet / KAPITAN-PLANETA — cichy autostart przy logowaniu ──
' Uruchamia relay + agent VIVO + staly tunel ngrok, bez widocznych okien.
Set sh = CreateObject("WScript.Shell")
agentDir = "C:\Users\anoni\Downloads\KapitanPlaneta\agent"
sh.CurrentDirectory = agentDir

' 1) Relay + UI (port 8765)
sh.Run "cmd /c node """ & agentDir & "\server.js""", 0, False

' 2) Agent VIVO (CPU/RAM tej maszyny)
WScript.Sleep 2500
sh.Run "cmd /c python """ & agentDir & "\agent.py"" --node VIVO --server ws://localhost:8765", 0, False

' 3) Staly tunel ngrok -> publiczny adres
sh.Run "cmd /c ""C:\Users\anoni\ngrok\ngrok.exe"" http --url=https://renewable-declared-reversion.ngrok-free.dev 8765", 0, False
