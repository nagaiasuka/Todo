/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Run the actual Expo widget renderer without React Native or a simulator.
const root = path.resolve(__dirname, '../..');
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(root, 'node_modules/expo-widgets/bundle/build/ExpoWidgets.bundle'), 'utf8'), context);
context.exports = {};
context.require = name => {
  if (name === '@expo/ui/swift-ui' || name === '@expo/ui/swift-ui/modifiers') return context;
  if (name === 'react/jsx-runtime') return { jsx: context.jsx, jsxs: context.jsxs, Fragment: context.Fragment };
  if (name === 'expo-widgets') return { createWidget: (_name, layout) => layout };
  throw new Error(`Unexpected dependency in lock widget: ${name}`);
};
const source = fs.readFileSync(path.join(root, 'src/widgets/TodoLock.tsx'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
vm.runInContext(compiled, context);
context.__expoWidgetLayout = context.exports.default;

function render(props, family) {
  return JSON.parse(JSON.stringify(context.__expoWidgetRender(props, {
    widgetFamily: family, colorScheme: 'dark', widgetRenderingMode: 'vibrant',
  })));
}
function texts(node) {
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(texts);
  return node && typeof node === 'object' ? [...texts(node.props?.text), ...texts(node.props?.children)] : [];
}
module.exports = { render, texts };
