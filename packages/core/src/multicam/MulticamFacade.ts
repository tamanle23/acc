import { MulticamSynchronizer, type CameraAngle, type SynchronizedAngleResult } from './MulticamSynchronizer';

export class MulticamFacade {
  public static syncAllCameraAngles(
    referenceAngle: CameraAngle,
    otherAngles: CameraAngle[]
  ): SynchronizedAngleResult[] {
    return MulticamSynchronizer.synchronizeAngles(referenceAngle, otherAngles);
  }
}
