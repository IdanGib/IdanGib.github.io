// @ts-nocheck -- Phaser is provided by the vendored browser bundle.
      (async () => {
        const portraitQuery = window.matchMedia("(max-width: 760px)");
        let portrait = portraitQuery.matches;
        let W = portrait ? 420 : 1100;
        const H = 800;
        // Phaser 4 has no game-level resolution option. Render a larger surface
        // and zoom the camera so world coordinates and hit areas stay unchanged.
        // Cap supersampling to keep GPU memory reasonable on mobile devices.
        const renderScale = Math.min(
          3,
          Math.max(2, Math.ceil(window.devicePixelRatio || 1)),
        );
        let activeVoice = null;
        let hasInteracted = false;
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        const controls = document.getElementById("keyboard-controls");
        const liveStatus = document.getElementById("game-status");

        function stopVoice() {
          if (!activeVoice) return;
          activeVoice.pause();
          activeVoice.currentTime = 0;
          activeVoice = null;
        }

        // This JSON is the single source for lesson order, equipment, dismissal time and recorded voice.
        const DATA = await fetch(
          `${import.meta.env.BASE_URL}magic-school-bag/ori-data.json`,
        ).then((response) => {
          if (!response.ok)
            throw new Error("School bag data could not be loaded");
          return response.json();
        });
        const DAYS = DATA.days.map((day) => day.label);

        function dayGroups(dayIndex) {
          const groups = new Map();
          DATA.days[dayIndex].lessons.forEach((lesson, index) => {
            const group = groups.get(lesson.subjectId);
            if (group) {
              group.lessons.push(index + 1);
              group.lessonNames.push(lesson.label);
            } else {
              const subject = DATA.subjects[lesson.subjectId];
              groups.set(lesson.subjectId, {
                key: lesson.subjectId,
                subject: subject.label,
                status: subject.equipmentStatus,
                itemIds: subject.itemIds,
                lessons: [index + 1],
                lessonNames: [lesson.label],
              });
            }
          });
          return [...groups.values()];
        }

        function packingListFor(dayIndex) {
          return dayGroups(dayIndex).flatMap((group) =>
            group.itemIds.map((id) => {
              const item = DATA.items[id];
              return {
                id,
                label: item.label,
                icon: item.icon,
                imageUrl: item.imageUrl,
                audioUrl: item.audioUrl,
                color: Number.parseInt(item.color.slice(1), 16),
                groupKey: group.key,
                subject: group.subject,
                lessons: group.lessons,
                lessonNames: group.lessonNames,
              };
            }),
          );
        }

        function nextSchoolDay(date = new Date()) {
          const weekday = new Intl.DateTimeFormat("en-US", {
            timeZone: DATA.timeZone,
            weekday: "short",
          }).format(date);
          const tomorrow =
            (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
              weekday,
            ) +
              1) %
            7;
          return tomorrow === 6 ? 0 : tomorrow;
        }

        const daySelect = document.getElementById("school-day");
        const endTime = document.getElementById("end-time");
        let selectedDay = nextSchoolDay();
        let ITEMS = packingListFor(selectedDay);
        DAYS.forEach((day, index) => {
          const option = document.createElement("option");
          option.value = String(index);
          option.textContent = `יום ${day}`;
          daySelect.append(option);
        });
        daySelect.value = String(selectedDay);

        function renderDayInfo() {
          const day = DATA.days[selectedDay];
          endTime.textContent = day.endsAt ?? "לא נמסרה שעת סיום";
          endTime.setAttribute(
            "aria-label",
            day.endsAt
              ? `הלימודים מסתיימים בשעה ${day.endsAt}`
              : "שעת הסיום עדיין לא נמסרה",
          );
        }
        renderDayInfo();

        class MagicBagScene extends Phaser.Scene {
          constructor() {
            super("MagicBag");
            this.packed = 0;
            this.cards = [];
            this.finished = false;
            this.activeDragCard = null;
            this.activeDragPointerId = null;
          }

          crispText(x, y, text, style = {}) {
            // Text and emoji use their own canvas textures; supersample those too.
            return this.add.text(x, y, text, {
              ...style,
              resolution: renderScale,
            });
          }

          create(data = {}) {
            // scene.restart() reuses the same Scene instance, so reset all
            // per-run state here instead of relying only on the constructor.
            stopVoice();
            this.packed = 0;
            this.cards = [];
            this.finished = false;
            this.activeDragCard = null;
            this.activeDragPointerId = null;
            this.pendingDrag = null;
            this.returningCard = null;
            this.suppressClickUntil = 0;
            this.dragPreview = null;
            this.packingCount = 0;
            daySelect.disabled = false;

            this.cameras.main
              .setZoom(renderScale)
              .centerOn(W / 2, H / 2)
              .setBackgroundColor("#fff8fd");

            this.drawBackground();
            this.drawHeader();
            this.drawMascot();
            this.drawBag();
            this.drawProgress();
            this.drawCards();
            this.updateInstruction();
            this.setupDrag();
            this.setupKeyboardControls();
            this.updateProgress();
            this.scale.on("resize", this.positionControls, this);
            this.events.once("shutdown", () => {
              this.scale.off("resize", this.positionControls, this);
              stopVoice();
              controls.replaceChildren();
              controls.removeAttribute("role");
              controls.removeAttribute("aria-modal");
              controls.removeAttribute("aria-label");
            });
            if (data.packedIds?.length) {
              for (const card of this.cards) {
                if (!data.packedIds.includes(card.item.id)) continue;
                card.packed = true;
                card.container.setVisible(false).disableInteractive();
                card.button.hidden = true;
                this.packed++;
              }
              this.refreshDeck();
              this.updateProgress();
              this.updateInstruction();
              if (this.packed === ITEMS.length) this.finish();
            }
            document.getElementById("loading").hidden = true;
            this.game.canvas.setAttribute("aria-hidden", "true");
            requestAnimationFrame(() => this.positionControls());

            this.time.delayedCall(850, () => {
              if (hasInteracted) this.speakCurrent();
            });
          }

          drawBackground() {
            const g = this.add.graphics();
            g.fillStyle(0xfff8fd);
            g.fillRect(0, 0, W, H);

            const blobs = [
              [85, 90, 190, 0xffd9eb, 0.65],
              [1030, 75, 230, 0xded7ff, 0.58],
              [1010, 660, 250, 0xd9f8ed, 0.55],
              [70, 650, 220, 0xffefbf, 0.62],
            ];

            blobs.forEach(([x, y, r, c, a]) => {
              g.fillStyle(c, a);
              g.fillCircle(x, y, r);
            });

            for (let i = 0; i < (reducedMotion ? 0 : 42); i++) {
              const x = Phaser.Math.Between(25, W - 25);
              const y = Phaser.Math.Between(25, H - 25);
              const s = this.crispText(x, y, Math.random() > 0.5 ? "✦" : "•", {
                fontFamily: "Arial",
                fontSize: Phaser.Math.Between(10, 20),
                color: Math.random() > 0.5 ? "#e5b6d1" : "#bfb4ee",
              })
                .setOrigin(0.5)
                .setAlpha(Phaser.Math.FloatBetween(0.25, 0.65));

              this.tweens.add({
                targets: s,
                alpha: 0.1,
                scale: 1.35,
                duration: Phaser.Math.Between(1400, 2600),
                yoyo: true,
                repeat: -1,
                delay: Phaser.Math.Between(0, 900),
              });
            }

            if (!portrait) {
              this.cloud(130, 168, 0.65);
              this.cloud(960, 165, 0.52);
            }
          }

          cloud(x, y, scale) {
            const c = this.add.container(x, y);
            const g = this.add.graphics();
            g.fillStyle(0xffffff, 0.72);
            g.fillCircle(-45, 5, 34);
            g.fillCircle(-7, -15, 47);
            g.fillCircle(41, 5, 36);
            g.fillRoundedRect(-78, 0, 155, 40, 20);
            c.add(g);
            c.setScale(scale);

            this.tweens.add({
              targets: c,
              x: x + 18,
              duration: 3000,
              yoyo: true,
              repeat: -1,
              ease: "Sine.easeInOut",
            });
          }

          drawHeader() {
            this.crispText(W / 2, 42, "✨ משימת תיק הקסם ✨", {
              fontFamily: "Arial",
              fontSize: portrait ? 29 : 36,
              fontStyle: "bold",
              color: "#5f4976",
            }).setOrigin(0.5);

            this.instruction = this.crispText(W / 2, 95, "", {
              fontFamily: "Arial",
              fontSize: portrait ? 21 : 24,
              color: "#7f6d92",
              align: "center",
              wordWrap: { width: portrait ? 380 : 800 },
            }).setOrigin(0.5);

            this.updateInstruction();
          }

          drawMascot() {
            const mascotX = portrait ? 50 : W / 2 - 235;
            const mascotY = 650;
            this.mascotScale = portrait ? 0.42 : 0.8;
            this.mascot = this.add
              .container(mascotX, mascotY)
              .setScale(this.mascotScale);

            const g = this.add.graphics();
            g.fillStyle(0x7f617f, 0.12);
            g.fillEllipse(0, 79, 135, 28);

            g.fillStyle(0xffb8d7);
            g.fillCircle(0, 0, 64);
            g.fillStyle(0xffcde3);
            g.fillCircle(-30, -51, 25);
            g.fillCircle(30, -51, 25);

            g.fillStyle(0x4f405e);
            g.fillCircle(-20, -6, 6);
            g.fillCircle(20, -6, 6);

            g.lineStyle(4, 0x4f405e);
            g.beginPath();
            g.arc(0, 8, 22, 0.15, Math.PI - 0.15);
            g.strokePath();

            g.fillStyle(0xff80ae, 0.45);
            g.fillCircle(-40, 17, 11);
            g.fillCircle(40, 17, 11);

            this.mascot.add(g);

            this.tweens.add({
              targets: this.mascot,
              y: reducedMotion ? mascotY : mascotY - 10,
              angle: reducedMotion ? 0 : 2.5,
              duration: 1250,
              yoyo: true,
              repeat: -1,
              ease: "Sine.easeInOut",
            });

            this.crispText(mascotX, portrait ? 712 : 745, "זואי", {
              fontFamily: "Arial",
              fontSize: 20,
              fontStyle: "bold",
              color: "#745c87",
            }).setOrigin(0.5);
          }

          drawBag() {
            const bagX = W / 2;
            const bagY = 640;
            this.bagScale = 0.82;
            this.bag = this.add.container(bagX, bagY).setScale(this.bagScale);
            this.bagGraphics = this.add.graphics();

            const shadow = this.add.graphics();
            shadow.fillStyle(0x684c73, 0.12);
            shadow.fillEllipse(0, 146, 260, 48);

            const star = this.crispText(0, -5, "★", {
              fontFamily: "Arial",
              fontSize: 56,
              color: "#fff1a5",
            }).setOrigin(0.5);

            this.bag.add([shadow, this.bagGraphics, star]);
            this.redrawBag(false);

            this.crispText(bagX, 772, "תיק הקסם 🎒", {
              fontFamily: "Arial",
              fontSize: 21,
              fontStyle: "bold",
              color: "#7d668f",
            }).setOrigin(0.5);

            this.tweens.add({
              targets: this.bag,
              y: reducedMotion ? bagY : bagY - 10,
              duration: 1700,
              yoyo: true,
              repeat: -1,
              ease: "Sine.easeInOut",
            });
          }

          redrawBag(hovered) {
            const g = this.bagGraphics;
            g.clear();

            g.lineStyle(18, hovered ? 0xb689ff : 0xa17be7, 1);
            g.beginPath();
            g.arc(-64, 12, 83, 1.65, 4.55);
            g.strokePath();
            g.beginPath();
            g.arc(64, 12, 83, -1.4, 1.4);
            g.strokePath();

            g.fillStyle(hovered ? 0xb688ff : 0x9d73df);
            g.fillRoundedRect(-108, -120, 216, 250, 48);

            g.fillStyle(hovered ? 0xddc3ff : 0xcaa9f6);
            g.fillRoundedRect(-92, -101, 184, 211, 40);

            g.fillStyle(0x8259c2);
            g.fillRoundedRect(-78, -98, 156, 52, 25);

            g.fillStyle(0xff8ebe);
            g.fillRoundedRect(-66, 38, 132, 58, 22);

            g.lineStyle(3, 0xffbad7);
            g.strokeRoundedRect(-66, 38, 132, 58, 22);
          }

          drawProgress() {
            const spacing = portrait ? 45 : 50;
            this.progressStars = ITEMS.map((_, index) =>
              this.crispText(
                W / 2 + (index - (ITEMS.length - 1) / 2) * spacing,
                156,
                "☆",
                {
                  fontFamily: "Arial",
                  fontSize: portrait ? 39 : 42,
                  color: "#a889c5",
                },
              ).setOrigin(0.5),
            );
          }

          updateProgress() {
            this.progressStars.forEach((star, index) => {
              const filled = index < this.packed;
              star.setText(filled ? "★" : "☆");
              star.setColor(filled ? "#f0b93e" : "#a889c5");
            });
            liveStatus.textContent = `יום ${DAYS[selectedDay]}: ${this.packed} מתוך ${ITEMS.length} פריטים בתיק`;
          }

          drawCards() {
            ITEMS.forEach((item) => {
              this.cards.push({
                item,
                container: this.createCard(item),
                packed: false,
              });
            });
          }

          createCard() {
            // A hidden scene object carries drag coordinates and animation state.
            // The same full-size DOM card is visible at rest, in flight, and returning.
            return this.add.container(0, 0).setVisible(false);
          }

          setupKeyboardControls() {
            controls.replaceChildren();
            this.replayButton = null;
            const panel = document.createElement("div");
            panel.className = "packing-panel";
            panel.setAttribute("role", "region");
            panel.setAttribute(
              "aria-label",
              `ערימת הציוד ליום ${DAYS[selectedDay]}, לפי סדר השיעורים`,
            );
            this.stackPanel = panel;
            controls.append(panel);

            this.cards.forEach((card) => {
              const item = card.item;
              const button = document.createElement("button");
              button.type = "button";
              button.className = "item-button";
              const color = `#${item.color.toString(16).padStart(6, "0")}`;
              button.style.setProperty("--item-color", color);
              button.style.setProperty("--item-border", `${color}88`);
              button.style.setProperty("--item-tint", `${color}22`);
              button.setAttribute(
                "aria-label",
                `הכניסי לתיק: ${item.label}, ${item.subject}, ${this.lessonLabel(item)}`,
              );
              const subject = document.createElement("span");
              subject.className = "item-subject";
              subject.textContent = [item.subject, this.lessonLabel(item)]
                .filter(Boolean)
                .join(" · ");
              const icon = document.createElement("span");
              icon.className = "item-icon";
              icon.setAttribute("aria-hidden", "true");
              const fallbackIcon = document.createElement("span");
              fallbackIcon.textContent = item.icon;
              icon.append(fallbackIcon);
              if (item.imageUrl?.trim()) {
                const image = document.createElement("img");
                image.alt = "";
                image.decoding = "async";
                image.addEventListener("load", () => {
                  fallbackIcon.hidden = true;
                  icon.classList.add("has-image");
                }, { once: true });
                image.addEventListener("error", () => image.remove(), { once: true });
                image.src = item.imageUrl;
                icon.append(image);
              }
              const label = document.createElement("span");
              label.className = "item-label";
              label.textContent = item.label;
              const action = document.createElement("span");
              action.className = "item-action";
              action.textContent = "גררי לתיק או לחצי כאן";
              button.append(subject, icon, label, action);
              button.addEventListener("pointerdown", (event) => {
                if (
                  !this.canPack(card) ||
                  this.pendingDrag ||
                  this.activeDragCard ||
                  event.button !== 0
                )
                  return;
                this.pendingDrag = {
                  card,
                  pointerId: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                };
                button.setPointerCapture(event.pointerId);
              });
              button.addEventListener("click", (event) => {
                if (
                  !this.canPack(card) ||
                  this.activeDragCard ||
                  performance.now() < (this.suppressClickUntil || 0)
                )
                  return;
                hasInteracted = true;
                this.pack(card, () => {
                  if (event.detail === 0 && !this.finished)
                    this.cards
                      .find((entry) => !entry.packed)
                      ?.button.focus({ preventScroll: true });
                });
              });
              panel.append(button);
              card.button = button;
            });
            this.refreshDeck();
          }

          canPack(card) {
            return (
              !this.finished &&
              !this.packingCount &&
              !this.returningCard &&
              card === this.cards.find((entry) => !entry.packed)
            );
          }

          lessonLabel(item) {
            if (!item.lessons.length) return "";
            return `${item.lessons.length === 1 ? "שיעור" : "שיעורים"} ${item.lessons.join(", ")}`;
          }

          refreshDeck() {
            const remaining = this.cards.filter((card) => !card.packed);
            this.cards.forEach((card) => {
              const depth = remaining.indexOf(card);
              const visible = depth >= 0 && depth < 3;
              const front = depth === 0;
              card.button.hidden = !visible;
              card.button.disabled = !front || !this.canPack(card);
              card.button.tabIndex = front ? 0 : -1;
              card.button.setAttribute("aria-hidden", String(!front));
              card.button.setAttribute("data-deck-front", String(front));
              card.button.setAttribute("data-deck-depth", String(depth));
              card.button.style.zIndex = String(3 - depth);
              card.button.style.setProperty(
                "--deck-y",
                `${-18 * Math.max(0, depth)}px`,
              );
              card.button.style.setProperty(
                "--deck-scale",
                String(1 - 0.07 * Math.max(0, depth)),
              );
            });
          }

          positionControls() {
            const canvas = this.game.canvas.getBoundingClientRect();
            const bounds = controls.getBoundingClientRect();
            const sx = canvas.width / W;
            const sy = canvas.height / H;
            if (this.stackPanel) {
              Object.assign(this.stackPanel.style, {
                left: `${canvas.left - bounds.left + (W / 2 - (portrait ? 152 : 190)) * sx}px`,
                top: `${canvas.top - bounds.top + 240 * sy}px`,
                width: `${(portrait ? 304 : 380) * sx}px`,
                height: `${210 * sy}px`,
              });
            }
            if (this.replayButton) {
              Object.assign(this.replayButton.style, {
                left: `${canvas.left - bounds.left + (W / 2) * sx}px`,
                top: `${canvas.top - bounds.top + (H / 2 + 141) * sy}px`,
                width: `${190 * sx}px`,
                height: `${58 * sy}px`,
              });
            }
          }

          pointerPosition(event) {
            const canvas = this.game.canvas.getBoundingClientRect();
            return {
              x: ((event.clientX - canvas.left) * W) / canvas.width,
              y: ((event.clientY - canvas.top) * H) / canvas.height,
            };
          }

          prepareCard(card) {
            const bounds = card.button.getBoundingClientRect();
            const position = this.pointerPosition({
              clientX: bounds.left + bounds.width / 2,
              clientY: bounds.top + bounds.height / 2,
            });
            card.homeX = position.x;
            card.homeY = position.y;
            card.prepared = true;
            card.container
              .setPosition(position.x, position.y)
              .setScale(1)
              .setAngle(0)
              .setAlpha(1)
              .setVisible(false);
            this.children.bringToTop(card.container);
            card.button.style.visibility = "hidden";
          }

          showDragPreview(card) {
            const preview = card.button.cloneNode(true);
            preview.classList.add("drag-preview");
            preview.style.visibility = "";
            const bounds = card.button.getBoundingClientRect();
            preview.style.width = `${bounds.width}px`;
            preview.style.height = `${bounds.height}px`;
            preview.hidden = false;
            preview.setAttribute("aria-hidden", "true");
            preview.tabIndex = -1;
            preview.disabled = true;
            controls.append(preview);
            this.dragPreview = preview;
            card.container.setVisible(false);
            this.positionDragPreview(card);
          }

          positionDragPreview(card) {
            if (!this.dragPreview) return;
            const canvas = this.game.canvas.getBoundingClientRect();
            const bounds = controls.getBoundingClientRect();
            this.dragPreview.style.left = `${canvas.left - bounds.left + (card.container.x * canvas.width) / W}px`;
            this.dragPreview.style.top = `${canvas.top - bounds.top + (card.container.y * canvas.height) / H}px`;
            this.dragPreview.style.transform = `translate(-50%, -50%) scale(${card.container.scaleX}, ${card.container.scaleY}) rotate(${card.container.angle}deg)`;
            this.dragPreview.style.opacity = String(card.container.alpha);
          }

          clearDragPreview() {
            this.dragPreview?.remove();
            this.dragPreview = null;
          }

          restartGame() {
            hasInteracted = true;
            this.scene.restart({});
            this.events.once("create", () =>
              this.cards[0]?.button.focus({ preventScroll: true }),
            );
          }

          bagBounds() {
            // The backpack itself is animated, so derive the drop area from its
            // CURRENT x/y rather than from a fixed rectangle created earlier.
            return {
              left: this.bag.x - 118 * this.bagScale,
              right: this.bag.x + 118 * this.bagScale,
              top: this.bag.y - 150 * this.bagScale,
              bottom: this.bag.y + 145 * this.bagScale,
            };
          }

          isInsideBag(x, y) {
            const { left, right, top, bottom } = this.bagBounds();
            return x >= left && x <= right && y >= top && y <= bottom;
          }

          dragScaleAt(x, y) {
            const { left, right, top, bottom } = this.bagBounds();
            const dx = Math.max(left - x, 0, x - right);
            const dy = Math.max(top - y, 0, y - bottom);
            const proximity = Math.max(0, 1 - Math.hypot(dx, dy) / 180);
            const eased = proximity * proximity * (3 - 2 * proximity);
            return 1 - 0.55 * eased;
          }

          updateDraggedCard(card, pointer) {
            // Measure proximity before scaling so the effect cannot feed back
            // into itself. Scale the grab offset to keep that point under the pointer.
            const scale = this.dragScaleAt(
              pointer.x - card.dragOffsetX,
              pointer.y - card.dragOffsetY,
            );
            card.container.setScale(scale);
            card.container.x = pointer.x - card.dragOffsetX * scale;
            card.container.y = pointer.y - card.dragOffsetY * scale;
            this.positionDragPreview(card);
          }

          setupDrag() {
            const lifetime = new AbortController();
            const options = { signal: lifetime.signal };
            this.events.once("shutdown", () => lifetime.abort());
            const releaseCapture = (pending) => {
              if (pending?.card.button.hasPointerCapture(pending.pointerId))
                pending.card.button.releasePointerCapture(pending.pointerId);
            };
            const cancelDrag = () => {
              const pending = this.pendingDrag;
              const card = this.activeDragCard;
              this.pendingDrag = null;
              this.activeDragCard = null;
              this.activeDragPointerId = null;
              releaseCapture(pending);
              if (!card) return;
              this.suppressClickUntil = performance.now() + 400;
              this.redrawBag(false);
              this.bag.setScale(this.bagScale);
              this.returnHome(card);
            };
            window.addEventListener(
              "pointermove",
              (event) => {
                const pending = this.pendingDrag;
                if (
                  !pending ||
                  event.pointerId !== pending.pointerId ||
                  this.finished
                )
                  return;
                const pointer = this.pointerPosition(event);
                if (!this.activeDragCard) {
                  if (
                    Math.hypot(
                      event.clientX - pending.x,
                      event.clientY - pending.y,
                    ) < 7
                  )
                    return;
                  hasInteracted = true;
                  this.prepareCard(pending.card);
                  this.showDragPreview(pending.card);
                  this.activeDragCard = pending.card;
                  this.activeDragPointerId = event.pointerId;
                  const start = this.pointerPosition({
                    clientX: pending.x,
                    clientY: pending.y,
                  });
                  pending.card.dragOffsetX = start.x - pending.card.homeX;
                  pending.card.dragOffsetY = start.y - pending.card.homeY;
                  daySelect.disabled = true;
                }
                const card = this.activeDragCard;
                this.updateDraggedCard(card, pointer);
                const over = this.isInsideBag(pointer.x, pointer.y);
                this.redrawBag(over);
                this.bag.setScale(this.bagScale * (over ? 1.06 : 1));
              },
              options,
            );
            window.addEventListener(
              "pointerup",
              (event) => {
                const pending = this.pendingDrag;
                if (!pending || event.pointerId !== pending.pointerId) return;
                const card = this.activeDragCard;
                this.pendingDrag = null;
                this.activeDragCard = null;
                this.activeDragPointerId = null;
                releaseCapture(pending);
                if (!card) return;
                this.suppressClickUntil = performance.now() + 400;
                this.redrawBag(false);
                this.bag.setScale(this.bagScale);
                const pointer = this.pointerPosition(event);
                this.updateDraggedCard(card, pointer);
                if (this.isInsideBag(pointer.x, pointer.y)) this.pack(card);
                else this.returnHome(card);
              },
              options,
            );
            window.addEventListener("pointercancel", cancelDrag, options);
            window.addEventListener("blur", cancelDrag, options);
            controls.addEventListener(
              "lostpointercapture",
              (event) => {
                if (event.pointerId === this.pendingDrag?.pointerId)
                  cancelDrag();
              },
              options,
            );
          }

          pack(card, onComplete = () => {}) {
            if (!this.canPack(card)) return;
            this.tweens.killTweensOf(card.container);
            if (!card.prepared) this.prepareCard(card);
            if (!this.dragPreview) this.showDragPreview(card);
            card.button.hidden = true;
            card.packed = true;
            this.packingCount++;
            daySelect.disabled = true;
            this.refreshDeck();
            this.speak("כל הכבוד!");
            this.sparkles(card.container.x, card.container.y, card.item.color);

            this.tweens.add({
              targets: card.container,
              x: this.bag.x,
              y: this.bag.y,
              scale: 0.12,
              alpha: 0,
              angle: Phaser.Math.Between(-20, 20),
              duration: 480,
              ease: "Cubic.easeIn",
              onUpdate: () => this.positionDragPreview(card),
              onComplete: () => {
                this.clearDragPreview();
                card.container.setVisible(false);
                this.packed++;
                this.packingCount--;
                this.refreshDeck();
                daySelect.disabled =
                  this.packingCount > 0 ||
                  !!this.activeDragCard ||
                  this.packed === ITEMS.length;
                this.updateProgress();
                this.starPop();

                this.tweens.add({
                  targets: this.bag,
                  scaleX: this.bagScale * 1.09,
                  scaleY: this.bagScale * 0.93,
                  duration: 90,
                  yoyo: true,
                  repeat: 1,
                });

                if (this.packed === ITEMS.length) {
                  this.time.delayedCall(750, () => {
                    this.finish();
                    onComplete();
                  });
                } else {
                  this.updateInstruction();
                  this.time.delayedCall(250, () => this.speakCurrent());
                  onComplete();
                }
              },
            });
          }

          returnHome(card) {
            this.tweens.killTweensOf(card.container);
            this.returningCard = card;
            this.refreshDeck();
            this.speak("ננסה שוב");

            this.tweens.add({
              targets: card.container,
              x: card.homeX,
              y: card.homeY,
              scale: 1,
              duration: 420,
              ease: "Bounce.easeOut",
              onUpdate: () => this.positionDragPreview(card),
              onComplete: () => {
                this.clearDragPreview();
                this.returningCard = null;
                card.container.setVisible(false);
                card.button.style.visibility = "";
                card.prepared = false;
                this.refreshDeck();
                daySelect.disabled =
                  this.packingCount > 0 || !!this.activeDragCard;
              },
            });

            this.tweens.add({
              targets: card.container,
              angle: { from: -4, to: 4 },
              duration: 65,
              yoyo: true,
              repeat: 3,
              onComplete: () => card.container.setAngle(0),
            });
          }

          currentItem() {
            return this.cards.find((c) => !c.packed)?.item;
          }

          updateInstruction() {
            const item = this.currentItem();
            if (item) {
              this.instruction.setText(
                `עכשיו בתיק:   ${item.icon} ${item.label}`,
              );
            }
          }

          speakCurrent() {
            const item = this.currentItem();
            if (item) this.speak(`עכשיו נשים בתיק: ${item.label}`, item.audioUrl);
          }

          speak(text, itemAudioUrl) {
            if (!hasInteracted) return;
            const url = itemAudioUrl?.trim() || DATA.audio.textToUrl[text];
            stopVoice();
            if (typeof url !== "string" || !url.trim()) return;
            const voice = new Audio(url);
            activeVoice = voice;
            voice.addEventListener(
              "ended",
              () => {
                if (activeVoice === voice) activeVoice = null;
              },
              { once: true },
            );
            void voice.play().catch(() => {
              if (activeVoice === voice) activeVoice = null;
            });
          }

          sparkles(x, y, color) {
            for (let i = 0; i < 18; i++) {
              const p = this.add.circle(
                x,
                y,
                Phaser.Math.Between(3, 7),
                i % 3 === 0 ? 0xffd95d : color,
              );

              const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
              const d = Phaser.Math.Between(45, 120);

              this.tweens.add({
                targets: p,
                x: x + Math.cos(a) * d,
                y: y + Math.sin(a) * d,
                scale: 0,
                alpha: 0,
                duration: Phaser.Math.Between(380, 650),
                ease: "Quad.easeOut",
                onComplete: () => p.destroy(),
              });
            }
          }

          starPop() {
            const canvas = this.game.canvas.getBoundingClientRect();
            const bounds = controls.getBoundingClientRect();
            const sx = canvas.width / W;
            const sy = canvas.height / H;
            const star = document.createElement("span");
            star.className = "jumping-star";
            star.textContent = "⭐";
            star.setAttribute("aria-hidden", "true");
            star.style.left = `${canvas.left - bounds.left + this.bag.x * sx}px`;
            star.style.top = `${canvas.top - bounds.top + (this.bag.y - 155) * sy}px`;
            star.style.setProperty("--star-size", `${54 * sy}px`);
            star.style.setProperty("--star-mid", `${48 * sy}px`);
            star.style.setProperty("--star-rise", `${72 * sy}px`);
            star.addEventListener("animationend", () => star.remove(), {
              once: true,
            });
            controls.append(star);
          }

          finish() {
            this.finished = true;
            this.stackPanel.hidden = true;
            daySelect.disabled = false;
            this.instruction.setText("התיק מוכן! 🎉");
            liveStatus.textContent = "כל הכבוד! התיק מוכן!";
            this.speak(
              `כל הכבוד! סיימנו להכין את התיק ליום ${DAYS[selectedDay]}!`,
            );
            this.confetti();

            this.tweens.add({
              targets: this.mascot,
              scale: this.mascotScale * (reducedMotion ? 1 : 1.22),
              angle: { from: -7, to: 7 },
              duration: 170,
              yoyo: true,
              repeat: 5,
            });

            // Modal is built with top-level objects. In Phaser this is much more
            // reliable for pointer input than putting an interactive hit area on
            // a scaled Container.
            const cx = W / 2;
            const cy = H / 2;

            const overlay = this.add
              .rectangle(cx, cy, W, H, 0x4a3557, 0.28)
              .setDepth(100)
              .setInteractive();

            // Slightly larger modal for more breathing room,
            // with a genuinely rounded card instead of a sharp Rectangle.
            const modalCard = this.add
              .graphics()
              .setPosition(cx, cy)
              .setDepth(101);

            modalCard.fillStyle(0xffffff, 0.98);
            const modalWidth = portrait ? 374 : 550;
            modalCard.fillRoundedRect(
              -modalWidth / 2,
              -190,
              modalWidth,
              380,
              54,
            );

            modalCard.lineStyle(5, 0xffadd2, 1);
            modalCard.strokeRoundedRect(
              -modalWidth / 2,
              -190,
              modalWidth,
              380,
              54,
            );

            const crown = this.crispText(cx, cy - 120, "👑", {
              fontFamily: "Arial",
              fontSize: 74,
            })
              .setOrigin(0.5)
              .setDepth(102);

            const title = this.crispText(cx, cy - 34, "כל הכבוד", {
              fontFamily: "Arial",
              fontSize: portrait ? 34 : 40,
              fontStyle: "bold",
              color: "#72548b",
            })
              .setOrigin(0.5)
              .setDepth(102);

            const stars = this.crispText(cx, cy + 27, "⭐ ⭐ ⭐", {
              fontFamily: "Arial",
              fontSize: 38,
            })
              .setOrigin(0.5)
              .setDepth(102);

            const subtitle = this.crispText(
              cx,
              cy + 78,
              `הכול מוכן ליום ${DAYS[selectedDay]}`,
              {
                fontFamily: "Arial",
                fontSize: 21,
                color: "#927ba1",
              },
            )
              .setOrigin(0.5)
              .setDepth(102);

            // Keep the exact same rectangular interactive area and behavior,
            // but draw a much rounder pill-shaped visual button on top.
            const btnBg = this.add
              .rectangle(cx, cy + 141, 190, 58, 0x9d73df, 0)
              .setDepth(103)
              .setInteractive({ useHandCursor: true });

            const btnVisual = this.add
              .graphics()
              .setPosition(cx, cy + 141)
              .setDepth(103);

            btnVisual.fillStyle(0x9d73df, 1);
            btnVisual.fillRoundedRect(-95, -29, 190, 58, 29);

            const btnText = this.crispText(cx, cy + 141, "שחקי שוב ✨", {
              fontFamily: "Arial",
              fontSize: 20,
              fontStyle: "bold",
              color: "#ffffff",
            })
              .setOrigin(0.5)
              .setDepth(104);

            btnBg.on("pointerover", () => {
              this.tweens.add({
                targets: [btnBg, btnVisual, btnText],
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 100,
              });
            });

            btnBg.on("pointerout", () => {
              this.tweens.add({
                targets: [btnBg, btnVisual, btnText],
                scaleX: 1,
                scaleY: 1,
                duration: 100,
              });
            });

            btnBg.on("pointerdown", () => this.restartGame());
            controls.setAttribute("role", "dialog");
            controls.setAttribute("aria-modal", "true");
            controls.setAttribute(
              "aria-label",
              `כל הכבוד. הכול מוכן ליום ${DAYS[selectedDay]}`,
            );
            const replay = document.createElement("button");
            replay.type = "button";
            replay.className = "keyboard-control";
            replay.textContent = "שחקי שוב ✨";
            replay.setAttribute("aria-label", "שחקי שוב");
            replay.addEventListener("click", () => this.restartGame());
            replay.addEventListener("keydown", (event) => {
              if (event.key === "Tab") event.preventDefault();
            });
            controls.append(replay);
            this.replayButton = replay;
            this.positionControls();
            this.time.delayedCall(500, () =>
              replay.focus({ preventScroll: true }),
            );

            const modalParts = [
              modalCard,
              crown,
              title,
              stars,
              subtitle,
              btnBg,
              btnVisual,
              btnText,
            ];

            modalParts.forEach((obj) => obj.setScale(0));

            this.tweens.add({
              targets: modalParts,
              scaleX: 1,
              scaleY: 1,
              duration: 480,
              ease: "Back.easeOut",
            });

            this.tweens.add({
              targets: crown,
              angle: { from: -8, to: 8 },
              duration: 500,
              yoyo: true,
              repeat: -1,
            });
          }

          confetti() {
            if (reducedMotion) return;
            const colors = [0xff6fae, 0x9d73df, 0x55d6a8, 0xffd25e, 0x68c8ff];

            for (let i = 0; i < 100; i++) {
              const x = Phaser.Math.Between(0, W);
              const r = this.add
                .rectangle(
                  x,
                  -30,
                  Phaser.Math.Between(6, 12),
                  Phaser.Math.Between(10, 22),
                  Phaser.Utils.Array.GetRandom(colors),
                )
                .setDepth(110);

              this.tweens.add({
                targets: r,
                y: H + 70,
                x: x + Phaser.Math.Between(-110, 110),
                angle: Phaser.Math.Between(180, 760),
                duration: Phaser.Math.Between(1800, 3300),
                delay: Phaser.Math.Between(0, 900),
                ease: "Sine.easeIn",
                onComplete: () => r.destroy(),
              });
            }
          }
        }

        const game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: "game",
          width: W * renderScale,
          height: H * renderScale,
          backgroundColor: "#fff8fd",
          scene: MagicBagScene,
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.NO_CENTER,
          },
          render: { antialias: true },
        });

        daySelect.addEventListener("change", () => {
          const scene = game.scene.getScene("MagicBag");
          if (
            !scene?.scene.isActive() ||
            scene.activeDragCard ||
            scene.pendingDrag ||
            scene.packingCount ||
            scene.returningCard
          ) {
            daySelect.value = String(selectedDay);
            return;
          }
          selectedDay = Number(daySelect.value);
          ITEMS = packingListFor(selectedDay);
          renderDayInfo();
          scene.scene.restart({});
        });

        window.addEventListener("resize", () => {
          requestAnimationFrame(() => {
            const scene = game.scene.getScene("MagicBag");
            if (!scene?.scene.isActive()) return;
            if (portrait !== portraitQuery.matches) {
              const packedIds = scene.cards
                .filter((card) => card.packed)
                .map((card) => card.item.id);
              portrait = portraitQuery.matches;
              W = portrait ? 420 : 1100;
              game.scale.setGameSize(W * renderScale, H * renderScale);
              scene.scene.restart({ packedIds });
            } else {
              scene.positionControls();
            }
          });
        });

        // Use the same scene state for optional browser-agent access.
        const modelContext = document.modelContext;
        if (modelContext?.registerTool) {
          const lifecycle = new AbortController();
          window.addEventListener("pagehide", () => lifecycle.abort(), {
            once: true,
          });
          const getScene = () => {
            const scene = game.scene.getScene("MagicBag");
            if (!scene?.scene.isActive() || !scene.cards.length)
              throw new Error("The game is still loading.");
            return scene;
          };
          const readProgress = () => {
            const scene = getScene();
            return {
              day: DAYS[selectedDay],
              endsAt: DATA.days[selectedDay].endsAt,
              lessons: DATA.days[selectedDay].lessons.map(
                (lesson) => lesson.label,
              ),
              packed: scene.packed,
              total: ITEMS.length,
              finished: scene.finished,
              items: scene.cards.map((card) => ({
                id: card.item.id,
                label: card.item.label,
                subject: card.item.subject,
                lessons: card.item.lessons,
                packed: card.packed,
              })),
            };
          };
          const register = (tool) => {
            try {
              Promise.resolve(
                modelContext.registerTool(tool, { signal: lifecycle.signal }),
              ).catch(() => {});
            } catch (_) {
              /* Game play works in browsers without WebMCP. */
            }
          };
          register({
            name: "get_packing_progress",
            title: "Read school bag progress",
            description:
              "Read the items and progress in the current school bag game.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: false },
            execute: readProgress,
          });
          register({
            name: "pack_school_items",
            title: "Pack school items",
            description:
              "Pack the next items from the front of the stack in timetable order, with the same animations and completion as dragging the cards.",
            inputSchema: {
              type: "object",
              properties: {
                itemIds: {
                  type: "array",
                  minItems: 1,
                  uniqueItems: true,
                  items: { type: "string" },
                },
              },
              required: ["itemIds"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            async execute(input) {
              const ids = input?.itemIds;
              if (
                !input ||
                Object.keys(input).some((key) => key !== "itemIds") ||
                !Array.isArray(ids) ||
                !ids.length ||
                new Set(ids).size !== ids.length ||
                ids.some((id) => !ITEMS.some((item) => item.id === id))
              )
                throw new Error("Provide unique valid itemIds.");
              const scene = getScene();
              if (
                scene.finished ||
                scene.activeDragCard ||
                scene.pendingDrag ||
                scene.returningCard ||
                scene.cards.filter((card) => card.packed).length !==
                  scene.packed
              )
                throw new Error("Wait for the current action to finish.");
              const remaining = scene.cards.filter((card) => !card.packed);
              if (ids.some((id, index) => remaining[index]?.item.id !== id))
                throw new Error("Pack the front items in timetable order.");
              for (const id of ids) {
                const card = scene.cards.find((card) => card.item.id === id);
                if (!card.packed)
                  await new Promise((resolve) => scene.pack(card, resolve));
              }
              return readProgress();
            },
          });
        }
      })().catch(() => {
        document.getElementById("loading").textContent =
          "לא הצלחנו לטעון את נתוני המערכת. נסו לרענן את הדף.";
      });
