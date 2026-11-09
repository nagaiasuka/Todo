// Native buttons keep the task action inside the widget, without launching Todo.
struct TodoInteractiveLock: View {
  let props: [String: Any]
  let date: Date
  @Environment(\.widgetFamily) private var family

  private var rows: [[String: Any]] { TodoInteractiveTasks.rows }
  private func deadline(_ row: [String: Any]) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return (row["dueAt"] as? String).flatMap { formatter.date(from: $0) }
  }
  private var next: [String: Any]? {
    let dated = rows.enumerated().compactMap { index, row -> (Int, Date, [String: Any])? in
      guard let date = deadline(row) else { return nil }
      return (index, date, row)
    }.sorted { $0.1 == $1.1 ? $0.0 < $1.0 : $0.1 < $1.1 }
    return dated.first?.2 ?? rows.first
  }
  private var showCount: Bool { props["today"] != nil }
  private var showNext: Bool { props["next"] != nil }
  private var today: Int { rows.filter { deadline($0).map { Calendar.current.isDate($0, inSameDayAs: date) } ?? false }.count }
  private var title: String { next?["title"] as? String ?? "タスクなし" }

  var body: some View {
    Group {
      if family == .accessoryInline {
        // WidgetKit does not support buttons in the inline family.
        if showNext { Text(showCount ? "今日 \(today)件 · \(title)" : title).lineLimit(1) }
        else { Text(showCount ? "今日 \(today)件" : "Todo").lineLimit(1) }
      } else if family == .accessoryCircular {
        ZStack {
          AccessoryWidgetBackground()
          if showCount {
            VStack(spacing: 0) {
              Text("今日").font(.system(size: 10))
              Text(today > 999 ? "999+" : String(today)).font(.system(size: 27, weight: .bold, design: .rounded)).minimumScaleFactor(0.6)
              Text("件").font(.system(size: 9))
            }.accessibilityLabel("今日が期限の未完了タスク \(today)件")
          } else if showNext { completionButton { Text(title).font(.system(size: 11, weight: .semibold)).lineLimit(2).padding(5) } }
          else { Image(systemName: "checklist") }
        }
      } else {
        HStack(spacing: 6) {
          if showCount {
            VStack(spacing: 0) {
              Text("今日").font(.system(size: 10))
              Text(today > 999 ? "999+" : String(today)).font(.system(size: 28, weight: .bold, design: .rounded)).minimumScaleFactor(0.6)
              Text("件").font(.system(size: 9))
            }.accessibilityLabel("今日が期限の未完了タスク \(today)件")
          }
          if showCount && showNext { Divider() }
          if showNext {
            completionButton {
              VStack(alignment: .leading, spacing: 2) {
                Label(next == nil ? "未完了タスク" : "タップで完了", systemImage: next == nil ? "checkmark.circle" : "circle").font(.system(size: 10))
                Text(title).font(.system(size: 14, weight: .semibold)).lineLimit(2)
                if let next, let date = deadline(next) {
                  Text(date, format: .dateTime.month().day().hour().minute()).font(.system(size: 10)).lineLimit(1)
                }
              }.frame(maxWidth: .infinity, alignment: .leading)
            }
          }
          if !showCount && !showNext { Label("Todo", systemImage: "checklist") }
        }
      }
    }
    .widgetURL(URL(string: "todo-performance:///"))
    .containerBackground(for: .widget) { Color.clear }
  }

  @ViewBuilder private func completionButton<Label: View>(@ViewBuilder label: () -> Label) -> some View {
    if let id = next?["id"] as? String {
      Button(intent: TodoCompleteTaskIntent(taskId: id), label: label)
        .buttonStyle(.plain).accessibilityLabel("\(title)を完了する")
    } else { label() }
  }
}
