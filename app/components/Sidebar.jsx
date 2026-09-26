"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { title: "HOME", items: [{ label: "Dashboard", href: "/" }] },
  {
    title: "CREATE",
    items: [
      { label: "AI Image", href: "/image" },
      { label: "AI Video", href: "/video" },
      { label: "Product Photos", href: "/product-photos" },
      { label: "AI Ads", href: "/ads" },
      { label: "AI Avatars", href: "/avatars" },
      { label: "AI Actors", href: "/actors" },
      { label: "AI Clone", href: "/clone" },
      { label: "AI Audio", href: "/audio" },
    ],
  },
  {
    title: "EDIT",
    items: [
      { label: "AI Editor", href: "/editor" },
      { label: "Image Editor", href: "/image-editor" },
      { label: "Video Tools", href: "/video-tools" },
      { label: "Captions", href: "/captions" },
    ],
  },
  {
    title: "PLAN",
    items: [
      { label: "Scene Generator", href: "/scenes" },
      { label: "Storyboard", href: "/storyboard" },
      { label: "Templates", href: "/templates" },
      { label: "Brand Kit", href: "/brand-kit" },
    ],
  },
  {
    title: "WORKSPACE",
    items: [
      { label: "Projects", href: "/projects" },
      { label: "Assets", href: "/assets" },
    ],
  },
  { title: "ACCOUNT", items: [{ label: "Billing & Wallet", href: "/settings" }] },
];

export default function Sidebar({ mobileOpen = false, onNavigate }) {
  const pathname = usePathname();
  return (
    <aside className={`side ${mobileOpen ? "mobileOpen" : ""}`}>
      <div className="brand"><div className="brandMark">✦</div><div><strong>AI Media Studio</strong><span>Creative workspace</span></div></div>
      <nav className="sidebarNav">
        {sections.map(section => (
          <div className="navSection" key={section.title}>
            <div className="navSectionTitle">{section.title}</div>
            {section.items.map(item => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return <Link key={item.href} href={item.href} className={`navItem ${active ? "active" : ""}`} onClick={onNavigate}>{item.label}</Link>;
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
