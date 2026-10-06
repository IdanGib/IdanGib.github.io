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
    class GameObject {
      x: number; y: number; alpha: number; angle: number; scaleX: number; scaleY: number;
      width: number; height: number;
      setOrigin(x: number, y?: number): this; setAlpha(value: number): this;
      setScale(x: number, y?: number): this; setAngle(value: number): this;
      setPosition(x: number, y: number): this; setVisible(value: boolean): this;
      setDepth(value: number): this; setInteractive(config?: object): this;
      disableInteractive(): this; destroy(): void;
      on<Args extends unknown[]>(event: string, callback: (...args: Args) => void): this;
    }
    class Text extends GameObject {
      setText(value: string): this; setColor(value: string): this;
      width: number; height: number;
      setFontSize(value: number | string): this; setFontStyle(value: string): this;
    }
    class Image extends GameObject { setDisplaySize(width: number, height: number): this; }
    class Container extends GameObject { list: GameObject[]; add(children: GameObject | GameObject[]): this; }
    class Graphics extends GameObject {
      clear(): this; fillStyle(color: number, alpha?: number): this; lineStyle(width: number, color: number, alpha?: number): this;
      fillRect(x: number, y: number, width: number, height: number): this; fillCircle(x: number, y: number, radius: number): this;
      fillEllipse(x: number, y: number, width: number, height: number): this; fillRoundedRect(x: number, y: number, width: number, height: number, radius: number): this;
      strokeRoundedRect(x: number, y: number, width: number, height: number, radius: number): this;
      beginPath(): this; arc(x: number, y: number, radius: number, start: number, end: number): this; strokePath(): this;
    }
  }
  namespace Input {
    interface Pointer { event: Event; id: number; x: number; y: number; }
  }
  namespace Textures {
    interface CanvasTexture {
      context: CanvasRenderingContext2D; width: number; height: number;
      refresh(): this; setSize(width: number, height: number): this;
    }
    interface TextureManager {
      createCanvas(key: string, width: number, height: number): CanvasTexture;
      remove(key: string): void;
    }
  }
  interface AddManager {
    text(x: number, y: number, value: string, style?: object): GameObjects.Text;
    graphics(): GameObjects.Graphics; container(x: number, y: number): GameObjects.Container;
    rectangle(x: number, y: number, width: number, height: number, color?: number, alpha?: number): GameObjects.GameObject;
    circle(x: number, y: number, radius: number, color?: number): GameObjects.GameObject;
    image(x: number, y: number, key: string): GameObjects.Image;
  }
  interface TweenManager { add(config: Record<string, unknown>): void; killTweensOf(target: object): void; }
  interface TimeManager { delayedCall(delay: number, callback: () => void): void; }
  interface SceneController { restart(data?: object): void; isActive(): boolean; }
  class Scene {
    constructor(key: string | { key: string; active?: boolean });
    add: AddManager; tweens: TweenManager; time: TimeManager; events: EventEmitter;
    scale: EventEmitter; scene: SceneController; game: Game;
    textures: Textures.TextureManager;
    cameras: { main: { setZoom(value: number): this["cameras"]["main"]; centerOn(x: number, y: number): this["cameras"]["main"]; setViewport(x: number, y: number, width: number, height: number): this["cameras"]["main"]; setBackgroundColor(color: string): void } };
    children: { bringToTop(value: GameObjects.GameObject): void };
  }
  class Game {
    constructor(config: Record<string, unknown>);
    canvas: HTMLCanvasElement;
    renderer: { snapshot(callback: (image: HTMLImageElement) => void): void };
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
