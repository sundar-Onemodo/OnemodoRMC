/**
 * Fixes a known C++20 template redeclaration bug in react-native-reanimated 4.2.1
 * on Android Clang:
 *   "type constraint differs in template redeclaration"
 *   "use of undeclared identifier 'getResolvableValueContext'"
 *   "use of undeclared identifier 'config_'"
 */
const fs = require('fs');
const path = require('path');

const headerPath = path.join(
  __dirname,
  '../node_modules/react-native-reanimated/Common/cpp/reanimated/CSS/interpolation/transforms/TransformOperationInterpolator.h'
);

const cppPath = path.join(
  __dirname,
  '../node_modules/react-native-reanimated/Common/cpp/reanimated/CSS/interpolation/transforms/TransformOperationInterpolator.cpp'
);

function patch() {
  if (!fs.existsSync(headerPath) || !fs.existsSync(cppPath)) {
    console.log('[patch-reanimated] Files not found, skipping.');
    return;
  }

  let header = fs.readFileSync(headerPath, 'utf8');
  let cpp = fs.readFileSync(cppPath, 'utf8');

  let modified = false;

  // 1. Ensure includes in header
  if (!header.includes('#include <stdexcept>')) {
    header = header.replace(
      '#include <memory>',
      '#include <memory>\n#include <stdexcept>\n#include <string>\n#include <utility>'
    );
    modified = true;
  }

  // 2. Inline template methods in header
  const targetDecl = `// Specialization for resolvable operations
template <ResolvableOp TOperation>
class TransformOperationInterpolator<TOperation> : public StyleOperationInterpolator {
 public:
  TransformOperationInterpolator(
      const std::shared_ptr<TOperation> &defaultOperation,
      ResolvableValueInterpolatorConfig config);

  std::unique_ptr<StyleOperation> interpolate(
      double progress,
      const std::shared_ptr<StyleOperation> &from,
      const std::shared_ptr<StyleOperation> &to,
      const StyleOperationsInterpolationContext &context) const override;

  std::shared_ptr<StyleOperation> resolveOperation(
      const std::shared_ptr<StyleOperation> &operation,
      const StyleOperationsInterpolationContext &context) const override;

 protected:
  const ResolvableValueInterpolatorConfig config_;

  ResolvableValueInterpolationContext getResolvableValueContext(
      const StyleOperationsInterpolationContext &context) const;
};`;

  const inlineDef = `// Specialization for resolvable operations
template <ResolvableOp TOperation>
class TransformOperationInterpolator<TOperation> : public StyleOperationInterpolator {
 public:
  TransformOperationInterpolator(
      const std::shared_ptr<TOperation> &defaultOperation,
      ResolvableValueInterpolatorConfig config)
      : StyleOperationInterpolator(defaultOperation), config_(std::move(config)) {}

  std::unique_ptr<StyleOperation> interpolate(
      double progress,
      const std::shared_ptr<StyleOperation> &from,
      const std::shared_ptr<StyleOperation> &to,
      const StyleOperationsInterpolationContext &context) const override {
    const auto &fromOp = *std::static_pointer_cast<TOperation>(from);
    const auto &toOp = *std::static_pointer_cast<TOperation>(to);

    return std::make_unique<TOperation>(
        fromOp.value.interpolate(progress, toOp.value, getResolvableValueContext(context)));
  }

  std::shared_ptr<StyleOperation> resolveOperation(
      const std::shared_ptr<StyleOperation> &operation,
      const StyleOperationsInterpolationContext &context) const override {
    const auto &resolvableOp = std::static_pointer_cast<TOperation>(operation);
    const auto &resolved = resolvableOp->value.resolve(getResolvableValueContext(context));

    if (!resolved.has_value()) {
      throw std::invalid_argument(
          "[Reanimated] Cannot resolve resolvable operation: " + operation->getOperationName() +
          " for node with tag: " + std::to_string(context.node->getTag()));
    }

    return std::make_shared<TOperation>(resolved.value());
  }

 protected:
  const ResolvableValueInterpolatorConfig config_;

  ResolvableValueInterpolationContext getResolvableValueContext(
      const StyleOperationsInterpolationContext &context) const {
    return ResolvableValueInterpolationContext{
        .node = context.node,
        .fallbackInterpolateThreshold = context.fallbackInterpolateThreshold,
        .viewStylesRepository = context.viewStylesRepository,
        .relativeProperty = config_.relativeProperty,
        .relativeTo = config_.relativeTo};
  }
};`;

  if (header.includes(targetDecl)) {
    header = header.replace(targetDecl, inlineDef);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(headerPath, header, 'utf8');
    console.log('[patch-reanimated] Patched TransformOperationInterpolator.h');
  }

  // 3. Remove out-of-line methods in cpp
  const outOfLineRegex = /\/\/ Specialization for resolvable operations[\s\S]*?(?=\/\/ Rotate operations)/;
  if (outOfLineRegex.test(cpp)) {
    cpp = cpp.replace(outOfLineRegex, '');
    fs.writeFileSync(cppPath, cpp, 'utf8');
    console.log('[patch-reanimated] Patched TransformOperationInterpolator.cpp');
  }

  console.log('[patch-reanimated] Fix verified and applied successfully.');
}

patch();

