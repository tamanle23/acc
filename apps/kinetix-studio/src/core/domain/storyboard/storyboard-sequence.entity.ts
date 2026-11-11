// ============================================================================
// KINETIX STUDIO v6.0 - STORYBOARD SEQUENCE ENTITY (ECMA-429)
// Pure domain entity governing multi-scene non-linear narrative sequence resolution.
// ============================================================================

import type {
  StoryboardScene,
  StoryboardSequenceSpec,
  StoryboardTimeResolution,
} from '@/types/storyboard';

export class StoryboardSequence {
  public constructor(
    public readonly id: string,
    public readonly title: string,
    private readonly _scenes: StoryboardScene[],
    public readonly masterBpm = 120,
    public readonly audioTrackKey?: string
  ) {
    if (_scenes.length === 0) {
      throw new Error('StoryboardSequence requires at least one scene.');
    }
  }

  public get scenes(): readonly StoryboardScene[] {
    return this._scenes;
  }

  public get sceneCount(): number {
    return this._scenes.length;
  }

  public get totalDurationSec(): number {
    return this._scenes.reduce((acc, s) => acc + s.durationSec, 0);
  }

  /**
   * Resolves the active scene, local progress, and transition parameters for any global time coordinate.
   */
  public resolveAtGlobalTime(globalTimeSec: number): StoryboardTimeResolution {
    const totalDuration = this.totalDurationSec;
    if (totalDuration <= 0) {
      const fallback = this._scenes[0];
      return {
        currentScene: fallback,
        nextScene: null,
        sceneIndex: 0,
        localTimeSec: 0,
        localProgress: 0,
        transitionProgress: null,
        transition: null,
      };
    }

    const wrappedTime = ((globalTimeSec % totalDuration) + totalDuration) % totalDuration;
    let accumulated = 0;

    for (let i = 0; i < this._scenes.length; i++) {
      const scene = this._scenes[i];
      const sceneStart = accumulated;
      const sceneEnd = accumulated + scene.durationSec;

      if (wrappedTime >= sceneStart && (wrappedTime < sceneEnd || i === this._scenes.length - 1)) {
        const localTime = Math.min(scene.durationSec, Math.max(0, wrappedTime - sceneStart));
        const localProgress = scene.durationSec > 0 ? localTime / scene.durationSec : 0;
        const transition = scene.transitionOut ?? null;
        let transitionProgress: number | null = null;
        const nextScene =
          i < this._scenes.length - 1
            ? this._scenes[i + 1]
            : transition
            ? this._scenes[0]
            : null;

        if (transition && transition.durationSec > 0) {
          const transitionStart = scene.durationSec - transition.durationSec;
          if (localTime >= transitionStart) {
            const transTime = localTime - transitionStart;
            transitionProgress = Math.min(1, Math.max(0, transTime / transition.durationSec));
          }
        }

        return {
          currentScene: scene,
          nextScene,
          sceneIndex: i,
          localTimeSec: localTime,
          localProgress,
          transitionProgress,
          transition,
        };
      }
      accumulated = sceneEnd;
    }

    const fallback = this._scenes[0];
    return {
      currentScene: fallback,
      nextScene: null,
      sceneIndex: 0,
      localTimeSec: 0,
      localProgress: 0,
      transitionProgress: null,
      transition: null,
    };
  }

  /**
   * Adds a scene to the sequence.
   */
  public withAddedScene(scene: StoryboardScene, atIndex?: number): StoryboardSequence {
    const newScenes = [...this._scenes];
    if (typeof atIndex === 'number' && atIndex >= 0 && atIndex <= newScenes.length) {
      newScenes.splice(atIndex, 0, scene);
    } else {
      newScenes.push(scene);
    }
    return new StoryboardSequence(this.id, this.title, newScenes, this.masterBpm, this.audioTrackKey);
  }

  /**
   * Removes a scene by ID, ensuring at least one scene remains.
   */
  public withRemovedScene(sceneId: string): StoryboardSequence {
    if (this._scenes.length <= 1) return this;
    const newScenes = this._scenes.filter((s) => s.id !== sceneId);
    if (newScenes.length === this._scenes.length) return this;
    return new StoryboardSequence(this.id, this.title, newScenes, this.masterBpm, this.audioTrackKey);
  }

  /**
   * Updates an existing scene with patch properties.
   */
  public withUpdatedScene(sceneId: string, patch: Partial<StoryboardScene>): StoryboardSequence {
    const newScenes = this._scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s));
    return new StoryboardSequence(this.id, this.title, newScenes, this.masterBpm, this.audioTrackKey);
  }

  /**
   * Reorders scenes from one index to another.
   */
  public withReorderedScenes(fromIndex: number, toIndex: number): StoryboardSequence {
    if (
      fromIndex < 0 ||
      fromIndex >= this._scenes.length ||
      toIndex < 0 ||
      toIndex >= this._scenes.length ||
      fromIndex === toIndex
    ) {
      return this;
    }
    const newScenes = [...this._scenes];
    const [moved] = newScenes.splice(fromIndex, 1);
    newScenes.splice(toIndex, 0, moved);
    return new StoryboardSequence(this.id, this.title, newScenes, this.masterBpm, this.audioTrackKey);
  }

  public toSpec(): StoryboardSequenceSpec {
    return {
      id: this.id,
      title: this.title,
      scenes: this._scenes.map((s) => ({ ...s })),
      masterBpm: this.masterBpm,
      audioTrackKey: this.audioTrackKey,
    };
  }

  public static fromSpec(spec: StoryboardSequenceSpec): StoryboardSequence {
    return new StoryboardSequence(spec.id, spec.title, [...spec.scenes], spec.masterBpm, spec.audioTrackKey);
  }
}
