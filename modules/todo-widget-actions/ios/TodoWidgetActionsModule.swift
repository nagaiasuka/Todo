import ExpoModulesCore

public final class TodoWidgetActionsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TodoWidgetActions")
    Function("readActions") { () throws -> String in
      let data = try JSONEncoder().encode(TodoWidgetActionStore.read())
      return String(decoding: data, as: UTF8.self)
    }
    Function("acknowledgeActions") { (ids: [String], completedTaskIds: [String]) throws in
      try TodoWidgetActionStore.acknowledge(ids, completedTaskIds: completedTaskIds)
    }
  }
}
