/** Extra APIs used by Monster Bag, extending the existing vendored Phaser declarations. */
declare namespace Phaser {
  namespace GameObjects {
    class Image extends GameObject {
      setTexture(key: string, frame?: string): this;
    }
    interface Graphics {
      moveTo(x: number, y: number): this;
      lineTo(x: number, y: number): this;
    }
  }
  interface AddManager {
    image(x: number, y: number, key: string, frame?: string): GameObjects.Image;
  }
  interface Scene {
    load: { image(key: string, url: string): void };
    textures: {
      exists(key: string): boolean;
      addImage(key: string, source: HTMLImageElement): void;
      get(key: string): {
        setFilter(mode: number): void;
        has(frame: string): boolean;
        add(name: string, sourceIndex: number, x: number, y: number, width: number, height: number): void;
      };
    };
  }
}

interface Window { monsterBagGame?: Phaser.Game; }
