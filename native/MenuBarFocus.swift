import SwiftUI

@main
struct MenuBarFocus: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
  var body: some Scene { Settings { EmptyView() } }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
  var statusItem: NSStatusItem!
  var isOn = false { didSet { updateMenu() } }
  let focusName = "Work"

  func applicationDidFinishLaunching(_ notification: Notification) {
    statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    updateMenu()
  }

  func updateMenu() {
    let menu = NSMenu()
    statusItem.button?.title = isOn ? "WF ●" : "WF ○"
    menu.addItem(withTitle: isOn ? "Disable Work Focus" : "Enable Work Focus",
                 action: #selector(toggleFocus), keyEquivalent: "")
    menu.addItem(.separator())
    menu.addItem(withTitle: "Quit", action: #selector(quit), keyEquivalent: "q")
    statusItem.menu = menu
  }

  @objc func toggleFocus() {
    runShortcut(named: isOn ? "Disable \(focusName) Focus" : "Enable \(focusName) Focus")
    isOn.toggle()
  }

  func runShortcut(named name: String) {
    let p = Process()
    p.launchPath = "/usr/bin/shortcuts"
    p.arguments = ["run", name]
    try? p.run()
  }

  @objc func quit() { NSApp.terminate(nil) }
}
