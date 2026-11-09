import AppIntents
import UserNotifications

enum TodoInteractiveTasks {
  static var rows: [[String: Any]] {
    let defaults = UserDefaults(suiteName: TodoWidgetActionStore.group)
    let timeline = defaults?.array(forKey: "__expo_widgets_TodoHome_timeline") as? [[String: Any]] ?? []
    let now = Date().timeIntervalSince1970 * 1000
    let entry = timeline.filter { ($0["timestamp"] as? Double ?? 0) <= now }
      .max { ($0["timestamp"] as? Double ?? 0) < ($1["timestamp"] as? Double ?? 0) }
    let props = entry?["props"] as? [String: Any]
    return filtered(props?["rows"] as? [[String: Any]] ?? [])
  }

  static func filtered(_ rows: [[String: Any]]) -> [[String: Any]] {
    let completed = Set((try? TodoWidgetActionStore.read())?.map(\.taskId) ?? [])
    return rows.filter { !completed.contains($0["id"] as? String ?? "") }
  }
}

@available(iOS 17.0, *)
struct TodoCompleteTaskIntent: AppIntent {
  static var title: LocalizedStringResource = "タスクを完了"
  static var isDiscoverable: Bool = false
  static var openAppWhenRun: Bool = false

  @Parameter(title: "タスク") var taskId: String

  init() {}
  init(taskId: String) { self.taskId = taskId }

  func perform() async throws -> some IntentResult {
    // A stale widget cannot toggle a task back to incomplete.
    guard let row = TodoInteractiveTasks.rows.first(where: { $0["id"] as? String == taskId }) else { return .result() }
    try TodoWidgetActionStore.complete(taskId)
    let center = UNUserNotificationCenter.current()
    let ids = row["notificationIds"] as? [String] ?? ["todo-reminder:" + taskId]
    center.removePendingNotificationRequests(withIdentifiers: ids)
    center.removeDeliveredNotifications(withIdentifiers: ids)
    WidgetCenter.shared.reloadAllTimelines()
    return .result()
  }
}
