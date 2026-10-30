import Foundation

enum TodoWidgetCapacity {
  static func count(heights: [CGFloat], available: CGFloat, footer: CGFloat, total: Int, spacing: CGFloat = 7) -> Int {
    var used: CGFloat = 0
    var result = 0
    for index in heights.indices {
      used += heights[index] + (index == 0 ? 0 : spacing)
      let remaining = total > index + 1 ? footer + spacing : 0
      if used + remaining <= available { result = index + 1 }
      // A final row might fit only because the overflow footer disappears.
      if used > available { break }
    }
    return result
  }
}
