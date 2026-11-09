Pod::Spec.new do |s|
  s.name = 'TodoWidgetActions'
  s.version = '1.0.0'
  s.summary = 'Durable widget completion actions shared with Todo.'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Asuka Nagai'
  s.homepage = 'https://github.com/nagaiasuka/Todo'
  s.platform = :ios, '16.4'
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.swift_version = '5.9'
  s.source_files = '**/*.swift'
end
