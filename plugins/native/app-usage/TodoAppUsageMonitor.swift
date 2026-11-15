#if !targetEnvironment(simulator)
import DeviceActivity
import Foundation
import UserNotifications

final class TodoAppUsageMonitor: DeviceActivityMonitor {
  override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
    super.eventDidReachThreshold(event, activity: activity)
    let prefix = "todo.app-usage."
    guard activity.rawValue.hasPrefix(prefix), event.rawValue.hasPrefix("usage-"),
          let minutes = Int(event.rawValue.dropFirst("usage-".count)),
          minutes > 0, minutes.isMultiple(of: 5) else { return }

    let taskId = String(activity.rawValue.dropFirst(prefix.count))
    let group = "group.com.nagaiasuka.todo"
    guard let title = UserDefaults(suiteName: group)?.dictionary(forKey: "todo.usage.titles")?[taskId] as? String else { return }
    if let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group),
       let files = try? FileManager.default.contentsOfDirectory(at: container.appendingPathComponent("TodoWidgetActions"), includingPropertiesForKeys: nil),
       files.contains(where: { file in
         guard let data = try? Data(contentsOf: file),
               let action = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return false }
         return action["taskId"] as? String == taskId
       }) { return }
    let day = Calendar.current.startOfDay(for: Date()).timeIntervalSince1970
    let identifier = "todo.app-usage.\(Int(day)).\(taskId).\(minutes)"
    let defaults = UserDefaults.standard
    var notified = defaults.stringArray(forKey: "usage-notified") ?? []
    let dayPrefix = "todo.app-usage.\(Int(day))."
    notified = notified.filter { $0.hasPrefix(dayPrefix) }
    guard !notified.contains(identifier) else { return }
    notified.append(identifier)
    defaults.set(notified, forKey: "usage-notified")

    let content = UNMutableNotificationContent()
    content.title = title
    content.body = "選んだアプリの今日の利用時間が合計\(minutes)分です。タスクに戻りましょう。"
    content.sound = .default
    UNUserNotificationCenter.current().add(UNNotificationRequest(
      identifier: identifier, content: content, trigger: nil
    ))
  }
}
#else
import Foundation

final class TodoAppUsageMonitor: NSObject {}
#endif
