"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const sections = [
  { title: "HOME", items: [{ label: "Dashboard", href: "/" }] },
  {
    title: "CREATE",
    items: [
      { label: "AI Video", href: "/video" },
      { label: "AI Image", href: "/image" },
      { label: "AI Audio", href: "/audio" },
    ],
  },
  {
    title: "PRODUCTION",
    items: [
      { label: "AI Editor", href: "/editor" },
      { label: "Video Tools", href: "/video-tools" },
      { label: "Captions", href: "/captions" },
      { label: "Scene Generator", href: "/scenes" },
      { label: "Storyboard", href: "/storyboard" },
    ],
  },
  {
    title: "CHANNEL",
    items: [
      { label: "Templates", href: "/templates" },
      { label: "Brand Kit", href: "/brand-kit" },
      { label: "Projects", href: "/projects" },
      { label: "Assets", href: "/assets" },
    ],
  },
  { title: "ACCOUNT", items: [{ label: "Billing & Wallet", href: "/settings" }] },
];

export default function Sidebar({ mobileOpen = false, onNavigate }) {
  const pathname = usePathname();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ams_brand") || "{}");
      const color = typeof saved.color === "string" && /^#[0-9a-f]{6}$/i.test(saved.color)
        ? saved.color
        : "#ffffff";
      document.documentElement.style.setProperty("--brand-accent", color);
    } catch {}
  }, [pathname]);

  return (
    <aside className={`side ${mobileOpen ? "mobileOpen" : ""}`}>
      <div className="brand">
        <div className="brandMark">✦</div>
        <div>
          <strong>AI Media Studio</strong>
          <span>YouTube production</span>
        </div>
      </div>
      <nav className="sidebarNav">
        {sections.map((section) => (
          <div className="navSection" key={section.title}>
            <div className="navSectionTitle">{section.title}</div>
            {section.items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`navItem ${active ? "active" : ""}`}
                  onClick={onNavigate}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
