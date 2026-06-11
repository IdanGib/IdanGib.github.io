import type { ReactNode } from "react";

export interface AppDefinition {
  /** Label shown under the icon. Keep it short — one word fits best. */
  name: string;
  /** Destination, usually a standalone page under public/. */
  href: string;
  /** CSS background for the icon tile. */
  gradient: string;
  /** Icon artwork, sized to a 40×40 viewBox. */
  icon: ReactNode;
}

export const apps: AppDefinition[] = [
  {
    name: "Training",
    href: "/training-tracker-app.html",
    gradient: "linear-gradient(145deg, #c6f73f, #7e9a2a)",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="18" width="6" height="4" rx="2" fill="#0e0f0d" />
        <rect x="30" y="18" width="6" height="4" rx="2" fill="#0e0f0d" />
        <rect x="9" y="14" width="22" height="12" rx="6" fill="#0e0f0d" />
        <rect x="12" y="17" width="4" height="6" rx="1" fill="#c6f73f" />
        <rect x="18" y="17" width="4" height="6" rx="1" fill="#c6f73f" />
        <rect x="24" y="17" width="4" height="6" rx="1" fill="#c6f73f" />
      </svg>
    ),
  },
];
