/**
 * 2D Voronoi Cell Fracturing Engine with Glue Constraints
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface VoronoiCell {
  id: number;
  seed: Point2D;
  center: Point2D;
  points: Point2D[];
  active: boolean;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  mass: number;
}

export interface ConstraintLink {
  cellA: number;
  cellB: number;
  strength: number;
  broken: boolean;
}

export class VoronoiFracture {
  private width: number;
  private height: number;
  private cells: VoronoiCell[] = [];
  private links: ConstraintLink[] = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  generateCells(seedCount: number, impactPoint?: Point2D, biasFactor: number = 0.5): VoronoiCell[] {
    this.cells = [];
    const seeds: Point2D[] = [];

    for (let i = 0; i < seedCount; i++) {
      let x = Math.random() * this.width;
      let y = Math.random() * this.height;

      if (impactPoint) {
        const r = Math.random();
        if (r < biasFactor) {
          x = impactPoint.x + (Math.random() - 0.5) * (this.width * 0.3);
          y = impactPoint.y + (Math.random() - 0.5) * (this.height * 0.3);
        }
      }

      seeds.push({
        x: Math.max(0, Math.min(this.width, x)),
        y: Math.max(0, Math.min(this.height, y))
      });
    }

    // Build approximate Voronoi cells and compute cell boundary polygon points
    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i];
      const points: Point2D[] = [];
      const numVertices = 6;
      const radius = 30 + Math.random() * 20;

      for (let v = 0; v < numVertices; v++) {
        const angle = (v / numVertices) * Math.PI * 2;
        points.push({
          x: seed.x + Math.cos(angle) * radius,
          y: seed.y + Math.sin(angle) * radius
        });
      }

      this.cells.push({
        id: i,
        seed,
        center: { ...seed },
        points,
        active: false,
        vx: 0,
        vy: 0,
        rotation: 0,
        vRot: 0,
        mass: 1.0
      });
    }

    this.buildConstraintLinks(200);
    return this.cells;
  }

  private buildConstraintLinks(maxDistance: number): void {
    this.links = [];
    for (let i = 0; i < this.cells.length; i++) {
      for (let j = i + 1; j < this.cells.length; j++) {
        const dx = this.cells[i].seed.x - this.cells[j].seed.x;
        const dy = this.cells[i].seed.y - this.cells[j].seed.y;
        const dist = Math.hypot(dx, dy);

        if (dist < maxDistance) {
          this.links.push({
            cellA: i,
            cellB: j,
            strength: 500 / Math.max(1, dist),
            broken: false
          });
        }
      }
    }
  }

  triggerImpact(impactPoint: Point2D, force: number): void {
    for (const link of this.links) {
      if (link.broken) continue;
      const cellA = this.cells[link.cellA];
      const distToImpact = Math.hypot(cellA.seed.x - impactPoint.x, cellA.seed.y - impactPoint.y);
      const appliedForce = force / Math.max(1, distToImpact);

      if (appliedForce > link.strength) {
        link.broken = true;
        cellA.active = true;
        const dirX = (cellA.seed.x - impactPoint.x) / Math.max(1, distToImpact);
        const dirY = (cellA.seed.y - impactPoint.y) / Math.max(1, distToImpact);
        cellA.vx += dirX * appliedForce * 0.5;
        cellA.vy += dirY * appliedForce * 0.5;
        cellA.vRot += (Math.random() - 0.5) * 5;
      }
    }
  }

  update(dt: number, gravity: number = 300): void {
    for (const cell of this.cells) {
      if (!cell.active) continue;
      cell.vy += gravity * dt;
      cell.center.x += cell.vx * dt;
      cell.center.y += cell.vy * dt;
      cell.rotation += cell.vRot * dt;
    }
  }

  getCells(): VoronoiCell[] {
    return this.cells;
  }
}
