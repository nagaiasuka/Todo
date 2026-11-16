import ExpoModulesCore
import UserNotifications

#if !targetEnvironment(simulator)
import DeviceActivity
import FamilyControls
import SwiftUI
import UIKit
#endif

public final class TodoAppUsageModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TodoAppUsage")

    #if targetEnvironment(simulator)
    Constant("isSimulator") { true }
    #else
    AsyncFunction("configure") { (selection: String, interval: Int) async throws -> [String: Any]? in
      guard #available(iOS 17.4, *) else {
        throw UsageError("アプリ選択画面を開けませんでした。")
      }
      return try await self.configureUsagePicker(selection: selection, interval: interval)
    }

    AsyncFunction("sync") { (json: String) async throws in
      if #available(iOS 17.4, *) { try await UsageMonitoring.sync(json) }
    }
    #endif
  }

  #if !targetEnvironment(simulator)
  @available(iOS 17.4, *)
  @MainActor
  private func configureUsagePicker(selection: String, interval: Int) async throws -> [String: Any]? {
    // Expo resolves the presenter using MainActor.assumeIsolated.
    guard let presenter = appContext?.utilities?.currentViewController() else {
      throw UsageError("アプリ選択画面を開けませんでした。")
    }
    return try await UsageMonitoring.configure(from: presenter, selection: selection, interval: interval)
  }
  #endif
}

#if !targetEnvironment(simulator)
private struct UsageError: LocalizedError {
  let message: String
  init(_ message: String) { self.message = message }
  var errorDescription: String? { message }
}

private enum UsageMonitoring {
  static let prefix = "todo.app-usage."
  static let intervals = [5, 10, 15, 30, 60]
  static let group = "group.com.nagaiasuka.todo"

  struct Rule: Codable, Equatable {
    let id: String
    let title: String
    let selection: String
    let interval: Int
  }

  @available(iOS 17.4, *)
  @MainActor static func configure(from presenter: UIViewController, selection: String, interval: Int) async throws -> [String: Any]? {
    do {
      try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
    } catch {
      throw UsageError("スクリーンタイムへのアクセスを許可してください。")
    }
    let previous = Data(base64Encoded: selection).flatMap {
      try? JSONDecoder().decode(FamilyActivitySelection.self, from: $0)
    } ?? FamilyActivitySelection()
    let chosen: (selection: FamilyActivitySelection, interval: Int)? = await withCheckedContinuation { continuation in
      let picker = UsagePicker(selection: previous, interval: interval) { choice in
        presenter.dismiss(animated: true) { continuation.resume(returning: choice) }
      }
      let controller = UIHostingController(rootView: picker)
      controller.isModalInPresentation = true
      presenter.present(controller, animated: true)
    }
    guard let chosen else { return nil }
    let notifications = UNUserNotificationCenter.current()
    guard try await notifications.requestAuthorization(options: [.alert, .sound]) else {
      throw UsageError("iPhoneの設定でTodoの通知を許可してください。")
    }
    let data = try JSONEncoder().encode(chosen.selection)
    return ["selection": data.base64EncodedString(), "interval": chosen.interval,
            "count": chosen.selection.usageTargetCount]
  }

  @available(iOS 17.4, *)
  @MainActor static func sync(_ json: String) throws {
    let rules = try JSONDecoder().decode([Rule].self, from: Data(json.utf8))
    guard let defaults = UserDefaults(suiteName: group) else { return }
    let center = DeviceActivityCenter()
    let names = Set(rules.map { DeviceActivityName(prefix + $0.id) })
    let removed = center.activities.filter {
      ($0.rawValue == "todo.app-usage" || $0.rawValue.hasPrefix(prefix)) && !names.contains($0)
    }
    if !removed.isEmpty { center.stopMonitoring(removed) }
    defaults.set(Dictionary(uniqueKeysWithValues: rules.map { ($0.id, $0.title) }), forKey: "todo.usage.titles")
    let previous = UserDefaults.standard.data(forKey: "todo.usage.rules")
      .flatMap { try? JSONDecoder().decode([Rule].self, from: $0) } ?? []
    let schedule = DeviceActivitySchedule(
      intervalStart: DateComponents(hour: 0),
      intervalEnd: DateComponents(hour: 23, minute: 59, second: 59),
      repeats: true
    )
    for rule in rules {
      let name = DeviceActivityName(prefix + rule.id)
      if center.activities.contains(name), previous.contains(where: {
        $0.id == rule.id && $0.selection == rule.selection && $0.interval == rule.interval
      }) { continue }
      guard intervals.contains(rule.interval), let data = Data(base64Encoded: rule.selection) else {
        throw UsageError("利用時間通知の設定を読み込めませんでした。")
      }
      let selection = try JSONDecoder().decode(FamilyActivitySelection.self, from: data)
      guard selection.usageTargetCount > 0 else { continue }
      let events = Dictionary(uniqueKeysWithValues: stride(from: rule.interval, through: 1500, by: rule.interval).map { minutes in
        (DeviceActivityEvent.Name("usage-\(minutes)"), DeviceActivityEvent(
          applications: selection.applicationTokens, categories: selection.categoryTokens,
          webDomains: selection.webDomainTokens, threshold: DateComponents(hour: minutes / 60, minute: minutes % 60),
          includesPastActivity: true
        ))
      })
      try center.startMonitoring(name, during: schedule, events: events)
    }
    UserDefaults.standard.set(Data(json.utf8), forKey: "todo.usage.rules")
  }
}

private extension FamilyActivitySelection {
  var usageTargetCount: Int {
    applicationTokens.count + categoryTokens.count + webDomainTokens.count
  }
}

private struct UsagePicker: View {
  @State var selection: FamilyActivitySelection
  @State var interval: Int
  let finish: ((FamilyActivitySelection, Int)?) -> Void

  var body: some View {
    NavigationStack {
      VStack {
        Picker("通知間隔", selection: $interval) {
          ForEach(UsageMonitoring.intervals, id: \.self) { minutes in
            Text(minutes == 60 ? "1時間ごと" : "\(minutes)分ごと").tag(minutes)
          }
        }
        .padding(.horizontal)
        Text("アプリやカテゴリを複数選べます。カテゴリを選ぶと、そのカテゴリ全体が対象になります。")
          .font(.footnote)
          .padding(.horizontal)
        FamilyActivityPicker(selection: $selection)
      }
        .navigationTitle("対象アプリ")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) { Button("キャンセル") { finish(nil) } }
          ToolbarItem(placement: .confirmationAction) {
            Button("保存") { finish((selection, interval)) }
              .disabled(selection.usageTargetCount == 0)
          }
        }
    }
  }
}
#endif
