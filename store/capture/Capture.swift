import XCTest
final class Capture: XCTestCase {
 func shot(_ name: String) { let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); a.name=name; a.lifetime = .keepAlways; add(a) }
 func testCapture() throws {
  continueAfterFailure = false
  let app = XCUIApplication(bundleIdentifier: "com.nagaiasuka.todo")
  app.activate()
  if app.buttons["Close"].waitForExistence(timeout:2) {
   app.coordinate(withNormalizedOffset: CGVector(dx:0.85,dy:0.96)).tap()
   app.buttons["Close"].tap()
  }
  app.scrollViews.firstMatch.swipeUp()
  let preset = app.buttons["期限の30分前に通知"]
  XCTAssertTrue(preset.waitForExistence(timeout:3))
  preset.tap()
  shot("reminder-clean")
  app.scrollViews.firstMatch.swipeDown()
  app.buttons["キャンセル"].tap()
  app.buttons["変更を破棄して閉じる"].tap()
  XCTAssertTrue(app.buttons["＋ タスクを追加"].waitForExistence(timeout:5))
  shot("priority-list-clean")
  XCUIDevice.shared.press(.home)
  sleep(3)
  shot("home-widget-updated")
 }
}
