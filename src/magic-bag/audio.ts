export type VoiceKind = "welcome" | "item" | "completion";

/** Owns the one shared media element; higher priority prompts supersede lower ones. */
export class VoiceController {
  private generation = 0;
  private active: { kind: VoiceKind; key: string; generation: number } | null = null;
  private welcomed = new Set<string>();
  private readonly player: HTMLAudioElement;
  constructor(player: HTMLAudioElement) { this.player = player; player.preload = "auto"; }
  stop(): void { this.generation += 1; this.player.pause(); this.player.currentTime = 0; this.active = null; }
  hasWelcomed(key: string): boolean { return this.welcomed.has(key); }
  async play(kind: VoiceKind, key: string, url: string): Promise<boolean> {
    if (!url || (kind === "welcome" && this.welcomed.has(key))) return false;
    const priority = { welcome: 0, item: 1, completion: 2 } as const;
    if (this.active && priority[kind] < priority[this.active.kind]) return false;
    const generation = ++this.generation;
    this.player.pause();
    this.player.src = url;
    this.player.currentTime = 0;
    this.active = { kind, key, generation };
    try {
      await this.player.play();
      if (generation !== this.generation) return false;
      // Mark only a welcome that actually started; an interrupted item can never
      // be mistaken for the greeting just because both use the same element.
      if (kind === "welcome") this.welcomed.add(key);
      this.player.onended = () => { if (this.active?.generation === generation) this.active = null; };
      return true;
    } catch {
      if (this.active?.generation === generation) this.active = null;
      return false;
    }
  }
}
