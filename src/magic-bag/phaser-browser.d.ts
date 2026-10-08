/** Narrow declarations for the APIs used from the vendored Phaser 4.2.1 browser bundle. */
declare namespace Phaser {
  const AUTO: number;
  namespace Scale { const FIT: number; const NO_CENTER: number; }
  namespace Math {
    function Between(min: number, max: number): number;
    function FloatBetween(min: number, max: number): number;
  }
  namespace Utils.Array { function GetRandom<T>(items: T[]): T; }
  interface EventEmitter {
    on(event: string, callback: (...args: never[]) => void, context?: object): void;
    once(event: string, callback: (...args: never[]) => void, context?: object): void;
    off(event: string, callback: (...args: never[]) => void, context?: object): void;
  }
  namespace GameObjects {
    class Image extends GameObject { setTexture(key: string, frame?: string): this; }
    class GameObject {
      x: number; y: number; alpha: number; angle: number; scaleX: number; scaleY: number;
      setOrigin(x: number, y?: number): this; setAlpha(value: number): this;
      setScale(x: number, y?: number): this; setAngle(value: number): this;
      setPosition(x: number, y: number): this; setVisible(value: boolean): this;
      setDepth(value: number): this; setInteractive(config?: object): this;
      disableInteractive(): this; destroy(): void;
      on(event: string, callback: () => void): this;
    }
    class Text extends GameObject {
      setText(value: string): this; setColor(value: string): this;
      setFontSize(value: number | string): this; setFontStyle(value: string): this;
    }
    class Container extends GameObject { add(children: GameObject | GameObject[]): this; }
    class Graphics extends GameObject {
      clear(): this; fillStyle(color: number, alpha?: number): this; lineStyle(width: number, color: number, alpha?: number): this;
      fillRect(x: number, y: number, width: number, height: number): this; fillCircle(x: number, y: number, radius: number): this;
      fillEllipse(x: number, y: number, width: number, height: number): this; fillRoundedRect(x: number, y: number, width: number, height: number, radius: number): this;
      strokeRoundedRect(x: number, y: number, width: number, height: number, radius: number): this;
      beginPath(): this; arc(x: number, y: number, radius: number, start: number, end: number): this; strokePath(): this;
    }
  }
  interface AddManager {
    image(x: number, y: number, key: string, frame?: string): GameObjects.Image;
    text(x: number, y: number, value: string, style?: object): GameObjects.Text;
    graphics(): GameObjects.Graphics; container(x: number, y: number): GameObjects.Container;
    rectangle(x: number, y: number, width: number, height: number, color?: number, alpha?: number): GameObjects.GameObject;
    circle(x: number, y: number, radius: number, color?: number): GameObjects.GameObject;
  }
  interface TweenManager { add(config: Record<string, unknown>): void; killTweensOf(target: object): void; }
  interface TimeManager { delayedCall(delay: number, callback: () => void): void; }
  interface SceneController { restart(data?: object): void; isActive(): boolean; }
  class Scene {
    constructor(key: string);
    add: AddManager; tweens: TweenManager; time: TimeManager; events: EventEmitter;
    load: { image(key: string, url: string): void };
    textures: {
      exists(key: string): boolean;
      addImage(key: string, source: HTMLImageElement): void;
      get(key: string): { has(frame: string): boolean; add(name: string, sourceIndex: number, x: number, y: number, width: number, height: number): void };
    };
    scale: EventEmitter; scene: SceneController; game: Game;
    cameras: { main: { setZoom(value: number): this["cameras"]["main"]; centerOn(x: number, y: number): this["cameras"]["main"]; setBackgroundColor(color: string): void } };
    children: { bringToTop(value: GameObjects.GameObject): void };
  }
  class Game {
    constructor(config: Record<string, unknown>);
    canvas: HTMLCanvasElement;
    scene: { getScene(key: string): Scene };
    scale: { setGameSize(width: number, height: number): void };
    destroy(removeCanvas?: boolean): void;
  }
}

interface ImportMetaEnv { readonly BASE_URL: string; }
interface ImportMeta { readonly env: ImportMetaEnv; }

interface ModelContextTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: Record<string, boolean>;
  execute(input?: unknown): unknown;
}
interface Document {
  modelContext?: {
    registerTool(tool: ModelContextTool, options: { signal: AbortSignal }): unknown;
  };
}
interface Window { magicBagGame?: Phaser.Game; }
