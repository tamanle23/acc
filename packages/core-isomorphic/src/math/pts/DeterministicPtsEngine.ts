import {
  Pt,
  Group,
  Line,
  Curve,
  Polygon,
  Circle,
  Delaunay,
  Bound,
  Color,
  Const,
  Create,
  Geom,
  Mat,
  Num,
  Path,
} from 'pts';

// Export pure mathematical classes and types
export {
  Pt,
  Group,
  Line,
  Curve,
  Polygon,
  Circle,
  Delaunay,
  Bound,
  Color,
  Const,
  Create,
  Geom,
  Mat,
  Num,
  Path,
};

/**
 * Pure Voronoi wrapper derived mathematically from Delaunay triangulation
 */
export class Voronoi {
  public static from(pts: Pt[] | Group): Group[] {
    const d = Delaunay.from(pts);
    d.delaunay();
    return d.voronoi();
  }
}

/**
 * Explicit forbidden space runtimes to enforce zero-DOM, zero-rAF, deterministic rendering.
 */
export class CanvasSpace {
  constructor() {
    throw new Error(
      'CanvasSpace is strictly forbidden in @acc/core-isomorphic/math/pts. Use DeterministicPtsForm or UniversalCanvasProvider instead.'
    );
  }
}

export class DOMSpace {
  constructor() {
    throw new Error(
      'DOMSpace is strictly forbidden in @acc/core-isomorphic/math/pts. Use headless isomorphic mathematical abstractions instead.'
    );
  }
}
