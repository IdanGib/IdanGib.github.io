import type { PackingItem } from "./school-data";

interface CardStyle {
  portrait: boolean;
  worldScale: number;
  resolution: number;
  ink: string;
  softInk: string;
  action: string;
  subject: string;
}

/** The original card's CSS metrics, painted into a Phaser-owned canvas texture. */
export class CanvasCard {
  readonly container: Phaser.GameObjects.Container;
  readonly hitArea: Phaser.GameObjects.GameObject;
  private readonly image: Phaser.GameObjects.Image;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private loadedImage: HTMLImageElement | null = null;
  private showContent = true;
  private focused = false;
  private disposed = false;
  private readonly key: string;

  constructor(
    scene: Phaser.Scene,
    private readonly item: PackingItem,
    private readonly style: CardStyle,
    imageUrl?: string,
  ) {
    this.key = `packing-card-${item.id}-${Math.random().toString(36).slice(2)}`;
    const width = this.width;
    const height = this.height;
    this.texture = scene.textures.createCanvas(
      this.key,
      Math.ceil((width + 32) * style.resolution),
      Math.ceil((height + 32) * style.resolution),
    );
    this.container = scene.add.container(0, 0);
    this.image = scene.add.image(0, 0, this.key)
      .setDisplaySize((width + 32) / style.worldScale, (height + 32) / style.worldScale);
    this.hitArea = scene.add.rectangle(0, 0, width / style.worldScale, height / style.worldScale, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    this.container.add([this.image, this.hitArea]);
    this.paint();
    if (imageUrl) {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (this.disposed) return;
        this.loadedImage = image;
        this.paint();
      };
      image.src = imageUrl;
    }
    scene.events.once("shutdown", () => {
      this.disposed = true;
      scene.textures.remove(this.key);
    });
  }

  get width(): number { return (this.style.portrait ? 304 : 380) * this.style.worldScale; }
  get height(): number { return 210 * this.style.worldScale; }

  setContentVisible(value: boolean): void {
    if (this.showContent === value) return;
    this.showContent = value;
    this.paint();
  }

  setFocused(value: boolean): void {
    this.focused = value;
    this.paint();
  }

  resize(worldScale: number, portrait: boolean): void {
    this.style.worldScale = worldScale;
    this.style.portrait = portrait;
    this.texture.setSize(Math.ceil((this.width + 32) * this.style.resolution), Math.ceil((this.height + 32) * this.style.resolution));
    this.image.setDisplaySize((this.width + 32) / worldScale, (this.height + 32) / worldScale);
    this.paint();
  }

  private paint(): void {
    const ctx = this.texture.context;
    const { portrait, resolution, ink, softInk } = this.style;
    const width = this.width;
    const height = this.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.texture.width, this.texture.height);
    ctx.scale(resolution, resolution);
    ctx.translate(16, 16);
    const color = `#${this.item.color.toString(16).padStart(6, "0")}`;
    const box = (x: number, y: number, w: number, h: number, radius: number, fill: string, border?: string, lineWidth = 2): void => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fillStyle = fill;
      ctx.fill();
      if (border) { ctx.strokeStyle = border; ctx.lineWidth = lineWidth; ctx.stroke(); }
    };
    box(0, 8, width, height, 28, "#513d5c0d");
    box(1, 1, width - 2, height - 2, 27, this.focused ? (ink === "#51425f" ? "#f4eaff" : "#e4f6ff") : "white", `${color}88`);
    if (!this.showContent) { this.texture.refresh(); return; }

    const padding = portrait ? 16 : 20; // Includes the original two-pixel border.
    const gap = portrait ? 12 : 16;
    const iconWidth = this.loadedImage ? 112 : portrait ? 102 : 112;
    const iconHeight = this.loadedImage ? (height - padding * 2) * 0.9 : portrait ? 132 : 142;
    const iconX = width - padding - iconWidth;
    const iconY = (height - iconHeight) / 2;
    if (this.loadedImage) {
      ctx.save();
      ctx.beginPath(); ctx.roundRect(iconX, iconY, iconWidth, iconHeight, 18); ctx.clip();
      ctx.drawImage(this.loadedImage, iconX, iconY, iconWidth, iconHeight);
      ctx.restore();
    } else {
      ctx.save(); ctx.shadowColor = "#513d5c1a"; ctx.shadowBlur = 18 * resolution; ctx.shadowOffsetY = 8 * resolution;
      box(iconX + 1, iconY + 1, iconWidth - 2, iconHeight - 2, 19, `${color}22`, `${color}88`);
      ctx.restore();
      ctx.font = "52px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = ink; ctx.fillText(this.item.icon, iconX + iconWidth / 2, iconY + iconHeight / 2 + 2);
    }
    const copyWidth = Math.max(24, width - padding * 2 - gap - iconWidth);
    const copyCenter = padding + copyWidth / 2;
    ctx.direction = "rtl";
    const wrap = (value: string, size: number, bold: boolean, maxWidth: number): string[] => {
      ctx.font = `${bold ? "bold " : ""}${size}px Arial`;
      const lines: string[] = [];
      let line = "";
      for (const word of value.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word; }
        else line = next;
      }
      if (line) lines.push(line);
      return lines;
    };
    const subjectLines = wrap(this.style.subject, 13, true, copyWidth - 20);
    const labelSize = portrait ? 19 : 22;
    const labelLines = wrap(this.item.label, labelSize, true, copyWidth);
    const actionLines = wrap(this.style.action, 13, false, copyWidth);
    const subjectHeight = subjectLines.length * 18.2 + 8;
    const labelHeight = labelLines.length * labelSize * 1.25;
    const actionHeight = actionLines.length * 18.2;
    const totalHeight = subjectHeight + 8 + labelHeight + 8 + actionHeight;
    let top = (height - totalHeight) / 2;
    ctx.font = "bold 13px Arial";
    const badgeWidth = Math.min(copyWidth, ctx.measureText(this.style.subject).width + 20);
    box(copyCenter - badgeWidth / 2, top, badgeWidth, subjectHeight, Math.min(999, subjectHeight / 2), `${color}22`);
    const write = (lines: string[], size: number, bold: boolean, colorValue: string, lineHeight: number, y: number): void => {
      ctx.font = `${bold ? "bold " : ""}${size}px Arial`;
      ctx.fillStyle = colorValue; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      lines.forEach((line, i) => {
        const metrics = ctx.measureText(line);
        const ascent = metrics.fontBoundingBoxAscent;
        const descent = metrics.fontBoundingBoxDescent;
        ctx.fillText(line, copyCenter, y + lineHeight * i + (lineHeight - ascent - descent) / 2 + ascent);
      });
    };
    write(subjectLines, 13, true, softInk, 18.2, top + 4);
    top += subjectHeight + 8;
    write(labelLines, labelSize, true, ink, labelSize * 1.25, top);
    top += labelHeight + 8;
    write(actionLines, 13, false, softInk, 18.2, top);
    this.texture.refresh();
  }
}
