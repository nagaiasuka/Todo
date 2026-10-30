import Foundation

func count(_ heights: [CGFloat], _ available: CGFloat, _ footer: CGFloat = 12) -> Int {
  TodoWidgetCapacity.count(heights: heights, available: available, footer: footer, total: heights.count)
}
assert(count([], 150) == 0)
assert(count([30], 30) == 1)
assert(count([30, 30], 48) == 0) // footer must also fit
assert(count([30, 30], 49) == 1)
assert(count([30, 30], 67) == 2) // last row replaces footer
assert(count([30, 55, 30, 55], 140) == 2)
assert(count([30, 55, 30, 55], 210) == 4)
assert(count([70, 70, 70], 150, 24) == 1) // larger fonts, less capacity
// All candidate prefixes are compared with an exhaustive independent oracle.
for available in stride(from: CGFloat(0), through: 420, by: 1) {
  for heights: [CGFloat] in [[25, 45, 25, 45, 45], [40, 40], [55], []] {
    let valid = (0...heights.count).filter { n in
      let rowsHeight = heights.prefix(n).reduce(CGFloat(0), +) + CGFloat(max(0,n - 1)) * 7
      let footerHeight: CGFloat = n < heights.count ? 12 + (n > 0 ? 7 : 0) : 0
      return rowsHeight + footerHeight <= available
    }
    let expected = valid.max() ?? 0
    let actual = count(heights, available)
    assert(actual == expected, "Wrong prefix: \(actual) vs \(expected), height \(available)")
    assert(heights.count - actual >= 0)
  }
}
print("PASS: adaptive capacity, variable row heights, footer reservation, final-row fit, large fonts, 1,684 prefix comparisons")
