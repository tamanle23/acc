import { ITransitionStrategy, XFadeTransition, GlitchDissolveTransition } from './ITransitionStrategy';

export class TransitionFactory {
  private static transitions: Map<string, ITransitionStrategy> = new Map([
    ['fade', new XFadeTransition('fade')],
    ['wipeleft', new XFadeTransition('wipeleft')],
    ['wiperight', new XFadeTransition('wiperight')],
    ['dissolve', new XFadeTransition('dissolve')],
    ['glitch_dissolve', new GlitchDissolveTransition()],
  ]);

  public static getTransition(type: string): ITransitionStrategy {
    const found = this.transitions.get(type);
    if (!found) {
      return this.transitions.get('fade')!;
    }
    return found;
  }

  public static registerTransition(transition: ITransitionStrategy): void {
    this.transitions.set(transition.id, transition);
  }
}
