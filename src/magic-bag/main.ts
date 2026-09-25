import "../styles.css";

interface Gift {
  id: string;
  image: string;
  name: string;
  stars: number;
}

interface Kid {
  id: string;
  image: string;
  name: string;
  stars: number;
  bag: Gift[];
}

interface Profile {
  id?: string;
  image: string;
  name: string;
}

interface State {
  gifts: Gift[];
  kids: Kid[];
  profile: Profile;
}

const STORAGE_KEY = "state";
const app = document.querySelector<HTMLElement>("#app")!;
const modal = document.querySelector<HTMLDialogElement>("#modal")!;
const modalContent = document.querySelector<HTMLElement>("#modal-content")!;

const id = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
})[char]!);

const load = (): State => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<State>;
    return {
      gifts: (saved.gifts ?? []).map((gift) => ({ ...gift, id: gift.id || id() })),
      kids: (saved.kids ?? []).map((kid) => ({ ...kid, id: kid.id || id(), bag: kid.bag ?? [] })),
      profile: saved.profile ?? { id: id(), image: "", name: "" },
    };
  } catch (error) {
    console.error("load:", error);
    return { gifts: [], kids: [], profile: { id: id(), image: "", name: "" } };
  }
};

const state = load();
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const stars = (count: number) => `<span class="inline-flex items-center gap-1 font-bold text-accent"><span aria-hidden="true">★</span>${count}</span>`;
const avatar = (image: string, name: string, classes = "size-20") => image
  ? `<img src="${escapeHtml(image)}" alt="" class="${classes} shrink-0 rounded-full object-cover ring-2 ring-primary/40">`
  : `<span class="${classes} grid shrink-0 place-items-center rounded-full bg-primary/15 text-3xl font-bold text-primary ring-2 ring-primary/40" aria-hidden="true">${escapeHtml(name.charAt(0).toUpperCase() || "?")}</span>`;

const openModal = (content: string) => {
  modalContent.innerHTML = content;
  modal.showModal();
};

const empty = (title: string, copy: string) => `<div class="hero min-h-72"><div class="hero-content text-center"><div><div class="mb-3 text-5xl" aria-hidden="true">✦</div><h2 class="text-2xl font-bold">${title}</h2><p class="mt-2 text-base-content/60">${copy}</p></div></div></div>`;

const renderHome = () => {
  const kids = [...state.kids].sort((a, b) => b.stars - a.stars);
  app.innerHTML = kids.length ? `<section><h1 class="mb-5 text-3xl font-bold">Your stars</h1><div class="grid gap-4">${kids.map((kid) => `
    <article class="card bg-base-200 shadow-lg shadow-black/10">
      <div class="card-body p-4">
        <div class="flex items-center gap-4">
          <a href="#/kid/${kid.id}" class="flex min-w-0 flex-1 items-center gap-4 rounded-xl focus-visible:outline-2 focus-visible:outline-primary">
            ${avatar(kid.image, kid.name)}
            <span class="min-w-0"><strong class="block truncate text-2xl">${escapeHtml(kid.name)}</strong>${stars(kid.stars)}</span>
          </a>
          <button class="btn btn-primary btn-circle relative text-xl" data-bag="${kid.id}" aria-label="Open ${escapeHtml(kid.name)}'s bag">▣<span class="badge badge-secondary badge-sm absolute -end-2 -top-2">${kid.bag.length}</span></button>
        </div>
      </div>
    </article>`).join("")}</div></section>` : empty("The bag is waiting", "Add a kid in Settings to start collecting stars.");

  app.querySelectorAll<HTMLButtonElement>("[data-bag]").forEach((button) => button.addEventListener("click", () => renderBag(button.dataset.bag!)));
};

const renderBag = (kidId: string) => {
  const kid = state.kids.find(({ id: current }) => current === kidId);
  if (!kid) return;
  openModal(`<h2 class="text-2xl font-bold">${escapeHtml(kid.name)}'s bag</h2><div class="mt-4 grid gap-3">${kid.bag.length ? kid.bag.map((gift, index) => `<button class="flex items-center gap-3 rounded-box bg-base-300 p-3 text-start" data-redeem="${index}">${avatar(gift.image, gift.name, "size-14")}<span class="flex-1"><strong class="block">${escapeHtml(gift.name)}</strong>${stars(gift.stars)}</span><span class="text-sm text-base-content/60">Redeem</span></button>`).join("") : `<p class="py-8 text-center text-base-content/60">No gifts yet.</p>`}</div><div class="modal-action"><form method="dialog"><button class="btn">Close</button></form></div>`);
  modalContent.querySelectorAll<HTMLButtonElement>("[data-redeem]").forEach((button) => button.addEventListener("click", () => {
    kid.bag.splice(Number(button.dataset.redeem), 1);
    save(); modal.close(); renderHome();
  }));
};

const renderKid = (kidId: string) => {
  const kid = state.kids.find(({ id: current }) => current === kidId);
  if (!kid) { location.hash = "#/"; return; }
  app.innerHTML = `<section class="flex min-h-[65svh] flex-col items-center justify-center text-center">${avatar(kid.image, kid.name, "size-48")}<h1 class="mt-6 text-4xl font-bold">${escapeHtml(kid.name)}</h1><div class="mt-2 text-2xl">${stars(kid.stars)}</div><div class="mt-10 flex w-full max-w-xs justify-around"><button class="btn btn-error btn-circle btn-lg text-3xl" data-stars="-1" aria-label="Remove one star">−</button><button class="btn btn-success btn-circle btn-lg text-3xl" data-stars="1" aria-label="Add one star">+</button></div></section>`;
  app.querySelectorAll<HTMLButtonElement>("[data-stars]").forEach((button) => button.addEventListener("click", () => {
    kid.stars += Number(button.dataset.stars); save(); renderKid(kid.id);
  }));
};

const renderStore = () => {
  app.innerHTML = `<section><h1 class="mb-5 text-3xl font-bold">Welcome!</h1>${state.gifts.length ? `<div class="grid gap-4">${state.gifts.map((gift) => `<article class="card card-side bg-base-200"><figure class="w-32 shrink-0">${gift.image ? `<img src="${escapeHtml(gift.image)}" alt="" class="h-full w-full object-cover">` : `<span class="text-5xl">◆</span>`}</figure><div class="card-body p-4"><h2 class="card-title">${escapeHtml(gift.name)}</h2>${stars(gift.stars)}<div class="card-actions mt-auto justify-end"><button class="btn btn-primary btn-sm" data-buy="${gift.id}">Buy</button></div></div></article>`).join("")}</div>` : empty("The store is empty", "Add gifts in Settings.")}</section>`;
  app.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((button) => button.addEventListener("click", () => chooseBuyer(button.dataset.buy!)));
};

const chooseBuyer = (giftId: string) => {
  const gift = state.gifts.find(({ id: current }) => current === giftId);
  if (!gift) return;
  const buyers = state.kids.filter((kid) => kid.stars >= gift.stars);
  openModal(`<h2 class="text-2xl font-bold">${buyers.length ? "Choose kid" : "No kids can buy"}</h2><div class="mt-4 grid gap-2">${buyers.map((kid) => `<button class="btn h-auto justify-start py-3" data-buyer="${kid.id}">${avatar(kid.image, kid.name, "size-10")}<span class="flex-1 text-start">${escapeHtml(kid.name)}</span>${stars(kid.stars)}</button>`).join("")}</div><div class="modal-action"><form method="dialog"><button class="btn">Close</button></form></div>`);
  modalContent.querySelectorAll<HTMLButtonElement>("[data-buyer]").forEach((button) => button.addEventListener("click", () => {
    const kid = state.kids.find(({ id: current }) => current === button.dataset.buyer)!;
    kid.bag.push({ ...gift }); kid.stars -= gift.stars; save(); modal.close(); renderStore();
  }));
};

const renderSettings = () => {
  app.innerHTML = `<section><h1 class="mb-5 text-3xl font-bold">Settings</h1><div class="grid gap-3"><article class="card bg-base-200"><div class="card-body flex-row items-center">${avatar(state.profile.image, state.profile.name, "size-14")}<div class="flex-1"><h2 class="card-title">Profile</h2><p class="text-base-content/60">${escapeHtml(state.profile.name || "No name")}</p></div><a class="btn btn-ghost btn-circle" href="#/settings/profile" aria-label="Edit profile">✎</a></div></article>${[["Kids", "kids"], ["Gifts", "gifts"]].map(([label, path]) => `<article class="card bg-base-200"><div class="card-body flex-row items-center"><h2 class="card-title flex-1">${label}</h2><a class="btn btn-ghost btn-circle" href="#/settings/${path}" aria-label="Edit ${label}">✎</a></div></article>`).join("")}</div></section>`;
};

const imageField = (name: string) => `<label class="form-control"><span class="label-text mb-2">Image</span><input name="${name}" type="file" accept="image/*" capture="environment" class="file-input file-input-bordered w-full"></label>`;
const fileToDataUrl = (file?: File) => new Promise<string>((resolve) => {
  if (!file) { resolve(""); return; }
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file);
});

const renderEditor = (type: "kids" | "gifts") => {
  const isKids = type === "kids";
  const items = isKids ? state.kids : state.gifts;
  app.innerHTML = `<section><h1 class="mb-5 text-3xl font-bold">Edit ${isKids ? "kids" : "gifts"}</h1><form id="add-form" class="card bg-base-200"><div class="card-body"><label class="form-control"><span class="label-text mb-2">Name</span><input class="input input-bordered" name="name" required></label>${isKids ? "" : `<label class="form-control"><span class="label-text mb-2">Stars</span><input class="input input-bordered" name="stars" type="number" value="0" required></label>`}${imageField("image")}<button class="btn btn-primary mt-2">Add</button></div></form><div class="mt-5 grid gap-3">${items.map((item) => `<article class="flex items-center gap-3 rounded-box bg-base-200 p-3">${avatar(item.image, item.name, "size-14")}<strong class="flex-1">${escapeHtml(item.name)}</strong>${"stars" in item ? stars(item.stars) : ""}<button class="btn btn-ghost btn-circle text-error" data-delete="${item.id}" aria-label="Delete ${escapeHtml(item.name)}">✕</button></article>`).join("")}</div></section>`;
  document.querySelector<HTMLFormElement>("#add-form")!.addEventListener("submit", async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget as HTMLFormElement); const name = String(form.get("name") ?? "").trim();
    if (!name || items.some((item) => item.name === name)) return;
    const image = await fileToDataUrl(form.get("image") as File);
    if (isKids) state.kids.push({ id: id(), image, name, stars: 0, bag: [] });
    else state.gifts.push({ id: id(), image: image || `https://picsum.photos/200?random=${Math.floor(Math.random() * 100)}`, name, stars: Number(form.get("stars")) || 0 });
    save(); renderEditor(type);
  });
  app.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach((button) => button.addEventListener("click", () => {
    const index = items.findIndex((item) => item.id === button.dataset.delete); if (index >= 0) items.splice(index, 1); save(); renderEditor(type);
  }));
};

const renderProfile = () => {
  app.innerHTML = `<section><h1 class="mb-5 text-3xl font-bold">Edit profile</h1><form id="profile-form" class="card bg-base-200"><div class="card-body">${avatar(state.profile.image, state.profile.name, "size-24 self-center")}<label class="form-control"><span class="label-text mb-2">Name</span><input class="input input-bordered" name="name" value="${escapeHtml(state.profile.name)}"></label>${imageField("image")}<button class="btn btn-primary mt-2">Save</button></div></form></section>`;
  document.querySelector<HTMLFormElement>("#profile-form")!.addEventListener("submit", async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget as HTMLFormElement); const image = await fileToDataUrl(form.get("image") as File);
    state.profile.name = String(form.get("name") ?? ""); if (image) state.profile.image = image; save(); location.hash = "#/settings";
  });
};

const route = () => {
  const path = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (!path.length) renderHome();
  else if (path[0] === "kid" && path[1]) renderKid(path[1]);
  else if (path[0] === "store") renderStore();
  else if (path[0] === "settings" && path[1] === "kids") renderEditor("kids");
  else if (path[0] === "settings" && path[1] === "gifts") renderEditor("gifts");
  else if (path[0] === "settings" && path[1] === "profile") renderProfile();
  else if (path[0] === "settings") renderSettings();
  else { location.hash = "#/"; }
};

window.addEventListener("hashchange", route);
route();
