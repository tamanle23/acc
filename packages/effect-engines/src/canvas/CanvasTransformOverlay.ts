// Re-export Gizmo2DTransformation from apps/studio for backward compatibility
export {
  Gizmo2DTransformation as CanvasTransformOverlay,
  Gizmo2DTransformation,
  MagneticSnapEngine,
  type TransformHandleType,
  type BoundingBox2D,
  type SnappingGuide,
  type SnapResult,
} from '../../../../apps/studio/src/lib/gizmo';
