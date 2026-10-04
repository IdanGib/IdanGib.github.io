import assert from "node:assert/strict";
import test from "node:test";
import { VoiceController } from "./audio.ts";

class FakeAudio {
  preload = ""; src = ""; currentTime = 0; paused = true;
  onended: (() => void) | null = null;
  playResult: Promise<void> = Promise.resolve();
  pause(): void { this.paused = true; }
  play(): Promise<void> { this.paused = false; return this.playResult; }
}

test("an interrupted item is never classified as a greeting", async () => {
  const audio = new FakeAudio();
  const voice = new VoiceController(audio as unknown as HTMLAudioElement);
  let release!: () => void;
  audio.playResult = new Promise<void>((resolve) => { release = resolve; });
  const item = voice.play("item", "child/bag/day", "item.m4a");
  voice.stop();
  release();
  assert.equal(await item, false);
  assert.equal(voice.hasWelcomed("child/bag/day"), false);
});

test("welcome bookkeeping is namespaced and completion has priority", async () => {
  const audio = new FakeAudio();
  const voice = new VoiceController(audio as unknown as HTMLAudioElement);
  assert.equal(await voice.play("welcome", "one/a/0", "welcome.m4a"), true);
  assert.equal(voice.hasWelcomed("one/a/0"), true);
  assert.equal(voice.hasWelcomed("two/b/0"), false);
  let release!: () => void;
  audio.playResult = new Promise<void>((resolve) => { release = resolve; });
  const completion = voice.play("completion", "one/a/0", "done.m4a");
  assert.equal(await voice.play("item", "one/a/0", "item.m4a"), false);
  release();
  assert.equal(await completion, true);
});
