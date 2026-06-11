import type { ReactNode } from "react";

export interface AppDefinition {
  /** Label shown under the icon. Keep it short — one word fits best. */
  name: string;
  /** Destination, usually a standalone page entry. */
  href: string;
  /** Tailwind classes painting the icon tile background. */
  iconClass: string;
  /** Icon artwork, sized to a 40×40 viewBox. */
  icon: ReactNode;
}

export const apps: AppDefinition[] = [
  {
    name: "Training",
    href: "/training-tracker-app.html",
    iconClass: "bg-linear-145 from-[#c6f73f] to-[#7e9a2a]",
    icon: (
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-11 w-11"
      >
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
