// App-owned view appended to Expo's generated TodoHome.swift by config plugin.
import UIKit

private struct TodoWidgetRow: Identifiable {
  let id: String
  let title: String
  let classification: String
  let category: Int
  let due: String
  let dueAt: Date?

  init?(_ value: [String: Any]) {
    guard let id = value["id"] as? String, let title = value["title"] as? String,
      let classification = value["classification"] as? String else { return nil }
    self.id = id
    self.title = title
    self.classification = classification
    self.category = value["category"] as? Int ?? 3
    self.due = value["due"] as? String ?? "期限なし"
    if let iso = value["dueAt"] as? String {
      let formatter = ISO8601DateFormatter()
      formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
      self.dueAt = formatter.date(from: iso)
    } else { self.dueAt = nil }
  }

  // Calendar labels are calculated at render time, including after midnight.
  var deadlineLabel: String {
    guard let date = dueAt else { return "期限なし" }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "ja_JP")
    formatter.dateFormat = Calendar.current.isDateInToday(date) ? "今日 HH:mm" : "M/d HH:mm"
    return formatter.string(from: date)
  }
}

private struct TodoAdaptiveHome: View {
  let props: [String: Any]
  @Environment(\.colorScheme) private var systemScheme

  var body: some View {
    let preference = props["theme"] as? String ?? "light"
    let scheme: ColorScheme = preference == "system" ? systemScheme : preference == "dark" ? .dark : .light
    TodoAdaptiveHomeContent(props: props).environment(\.colorScheme, scheme)
  }
}

private struct TodoAdaptiveHomeContent: View {
  let props: [String: Any]
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.sizeCategory) private var sizeCategory
  @Environment(\.widgetFamily) private var family

  private var rows: [TodoWidgetRow] {
    (props["rows"] as? [[String: Any]] ?? []).compactMap(TodoWidgetRow.init)
  }
  private var total: Int { props["total"] as? Int ?? rows.count }
  private var accent: Color { colorScheme == .dark ? Color(red: 0.77, green: 0.96, blue: 0.39) : Color(red: 0.25, green: 0.43, blue: 0.04) }

  // These very same UIFont instances are used for measurement and rendering.
  // A two-line title is readable without letting one long task consume a card.
  private func scaledFont(_ size: CGFloat, weight: UIFont.Weight, style: UIFont.TextStyle) -> UIFont {
    UIFontMetrics(forTextStyle: style).scaledFont(for: .systemFont(ofSize: size, weight: weight), compatibleWith: UITraitCollection(preferredContentSizeCategory: uiSizeCategory))
  }
  private var uiSizeCategory: UIContentSizeCategory {
    switch sizeCategory {
    case .extraSmall: return .extraSmall
    case .small: return .small
    case .medium: return .medium
    case .large: return .large
    case .extraLarge: return .extraLarge
    case .extraExtraLarge: return .extraExtraLarge
    case .extraExtraExtraLarge: return .extraExtraExtraLarge
    case .accessibilityMedium: return .accessibilityMedium
    case .accessibilityLarge: return .accessibilityLarge
    case .accessibilityExtraLarge: return .accessibilityExtraLarge
    case .accessibilityExtraExtraLarge: return .accessibilityExtraExtraLarge
    case .accessibilityExtraExtraExtraLarge: return .accessibilityExtraExtraExtraLarge
    @unknown default: return .large
    }
  }

  private func titleHeight(_ title: String, width: CGFloat, font: UIFont) -> CGFloat {
    let bounds = (title as NSString).boundingRect(with: CGSize(width: max(1, width), height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin, .usesFontLeading], attributes: [.font: font], context: nil)
    return min(ceil(font.lineHeight * 2), max(ceil(font.lineHeight), ceil(bounds.height)))
  }

  var body: some View {
    GeometryReader { geometry in
      let titleFont = scaledFont(14, weight: .semibold, style: .body)
      let metaFont = scaledFont(10, weight: .medium, style: .caption2)
      let headingFont = scaledFont(15, weight: .bold, style: .headline)
      let footerFont = scaledFont(11, weight: .semibold, style: .caption1)
      let headingHeight = ceil(headingFont.lineHeight)
      let footerHeight = ceil(footerFont.lineHeight)
      let textWidth = max(1, geometry.size.width - 10)
      let heights = rows.map { titleHeight($0.title, width: textWidth, font: titleFont) + 3 + ceil(metaFont.lineHeight) }
      let count = TodoWidgetCapacity.count(heights: heights, available: geometry.size.height - headingHeight - 9, footer: footerHeight, total: total)

      VStack(alignment: .leading, spacing: 9) {
        HStack(alignment: .firstTextBaseline) {
          Text("Todo").foregroundStyle(accent)
          Spacer(minLength: 2)
          Text("\(total)件").monospacedDigit()
        }
        .font(Font(headingFont))
        .lineLimit(1)
        .frame(height: headingHeight)

        if total == 0 {
          Text("大切なことを、ひとつ。\nタップしてタスクを追加")
            .font(Font(titleFont)).foregroundStyle(.secondary).lineLimit(4)
        } else {
          VStack(alignment: .leading, spacing: 7) {
            ForEach(Array(rows.prefix(count).enumerated()), id: \.element.id) { index, row in
              if family == .systemSmall {
                taskRow(row, titleFont: titleFont, metaFont: metaFont, width: textWidth, height: heights[index])
              } else {
                Link(destination: URL(string: "todo-performance:///task?id=\(row.id.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? row.id)")!) {
                  taskRow(row, titleFont: titleFont, metaFont: metaFont, width: textWidth, height: heights[index])
                }.buttonStyle(.plain)
              }
            }
            if total > count {
              Text("ほかにあと\(total - count)件")
                .font(Font(footerFont)).foregroundStyle(.secondary).lineLimit(1)
                .frame(height: footerHeight, alignment: .leading)
                .accessibilityLabel("ほかにあと\(total - count)件の未完了タスク")
            }
          }
        }
      }
      .frame(width: geometry.size.width, height: geometry.size.height, alignment: .topLeading)
      .clipped()
    }
    .widgetURL(URL(string: "todo-performance:///"))
    .modifier(TodoWidgetBackground())
  }

  private func taskRow(_ row: TodoWidgetRow, titleFont: UIFont, metaFont: UIFont, width: CGFloat, height: CGFloat) -> some View {
    HStack(alignment: .top, spacing: 6) {
      RoundedRectangle(cornerRadius: 2).fill(row.category == 0 ? Color(red: 0.8, green: 0.27, blue: 0.23) : accent)
        .frame(width: 4, height: height)
      VStack(alignment: .leading, spacing: 3) {
        Text(row.title).font(Font(titleFont)).foregroundStyle(.primary)
          .lineLimit(2).multilineTextAlignment(.leading)
          .frame(width: width, height: height - 3 - ceil(metaFont.lineHeight), alignment: .topLeading)
        Text("\(row.classification) · \(row.deadlineLabel)")
          .font(Font(metaFont)).foregroundStyle(.secondary).lineLimit(1)
          .frame(height: ceil(metaFont.lineHeight), alignment: .leading)
      }
    }
    .frame(height: height, alignment: .topLeading)
    .accessibilityElement(children: .combine)
  }
}

private struct TodoWidgetBackground: ViewModifier {
  @Environment(\.colorScheme) private var scheme
  func body(content: Content) -> some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(scheme == .dark ? Color(red: 0.098, green: 0.106, blue: 0.094) : Color(red: 0.969, green: 0.961, blue: 0.937), for: .widget)
    } else {
      content.background(scheme == .dark ? Color(red: 0.098, green: 0.106, blue: 0.094) : Color(red: 0.969, green: 0.961, blue: 0.937))
    }
  }
}
