import Foundation

struct Msg: Decodable { let cmd: String; let focusName: String? }

func runShortcut(_ name: String) {
  let p = Process()
  p.launchPath = "/usr/bin/shortcuts"
  p.arguments = ["run", name]
  try? p.run()
  p.waitUntilExit()
}

while let line = readLine() {
  if let data = line.data(using: .utf8), let msg = try? JSONDecoder().decode(Msg.self, from: data) {
    let fn = (msg.focusName ?? "Work").trimmingCharacters(in: .whitespaces)
    if msg.cmd == "on"  { runShortcut("Enable \(fn) Focus") }
    if msg.cmd == "off" { runShortcut("Disable \(fn) Focus") }
    print(#"{"ok":true}"#)
  } else {
    print(#"{"ok":false}"#)
  }
}
