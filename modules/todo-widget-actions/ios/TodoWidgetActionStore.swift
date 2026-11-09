import Foundation

struct TodoWidgetCompletion: Codable {
  let id: String
  let taskId: String
  let completedAt: String
}

// One atomic file per action avoids read/modify/write races between widgets.
// Do not store task names or notes in this journal.
enum TodoWidgetActionStore {
  static let group = "group.com.nagaiasuka.todo"

  static func directory() throws -> URL {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
      throw NSError(domain: "TodoWidgetActions", code: 1, userInfo: [NSLocalizedDescriptionKey: "共有データにアクセスできませんでした。"])
    }
    let directory = container.appendingPathComponent("TodoWidgetActions", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory
  }

  static func read() throws -> [TodoWidgetCompletion] {
    let files = try FileManager.default.contentsOfDirectory(at: directory(), includingPropertiesForKeys: nil)
    return try files.filter { $0.pathExtension == "json" }.map {
      try JSONDecoder().decode(TodoWidgetCompletion.self, from: Data(contentsOf: $0))
    }.sorted { $0.completedAt < $1.completedAt }
  }

  static func complete(_ taskId: String) throws {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let action = TodoWidgetCompletion(id: UUID().uuidString, taskId: taskId, completedAt: formatter.string(from: Date()))
    let file = try directory().appendingPathComponent(action.id + ".json")
    try JSONEncoder().encode(action).write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
  }

  static func acknowledge(_ ids: [String], completedTaskIds: [String]) throws {
    let directory = try directory()
    let completed = Set(completedTaskIds)
    // Publish the completed rows before removing the journal. A widget refresh
    // between acknowledgement and the app's next sync cannot resurrect them.
    if !completed.isEmpty, let defaults = UserDefaults(suiteName: group),
      var timeline = defaults.array(forKey: "__expo_widgets_TodoHome_timeline") as? [[String: Any]] {
      for index in timeline.indices {
        guard var props = timeline[index]["props"] as? [String: Any],
          let rows = props["rows"] as? [[String: Any]] else { continue }
        let pending = rows.filter { !completed.contains($0["id"] as? String ?? "") }
        props["rows"] = pending
        props["total"] = pending.count
        timeline[index]["props"] = props
      }
      defaults.set(timeline, forKey: "__expo_widgets_TodoHome_timeline")
    }
    for id in ids where UUID(uuidString: id) != nil {
      let file = directory.appendingPathComponent(id + ".json")
      if FileManager.default.fileExists(atPath: file.path) { try FileManager.default.removeItem(at: file) }
    }
  }
}
