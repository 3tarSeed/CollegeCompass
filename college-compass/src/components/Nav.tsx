"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";
import {
  Bookmark,
  Sparkles,
  CalendarClock,
  ClipboardList,
  GitCompareArrows,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PiggyBank,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { useApp } from "@/store/AppProvider";
import { BrandMark } from "./ui";

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/find", label: "Find Colleges", icon: Search },
  { href: "/my-colleges", label: "My Colleges", icon: Bookmark },
  { href: "/advisor", label: "AI Advisor", icon: Sparkles },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/applications", label: "Applications", icon: ClipboardList },
  { href: "/deadlines", label: "Deadlines", icon: CalendarClock },
  { href: "/financial-aid", label: "Financial Aid", icon: PiggyBank },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function Nav() {
  const pathname = usePathname();
  const { guestMode, supabaseAvailable, userEmail, signOut, compareIds } = useApp();
  const [open, setOpen] = useState(false);

  const linkCls = (href: string) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active ? "bg-white/10 text-white" : "text-blue-100/80 hover:bg-white/5 hover:text-white"
    }`;
  };

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className={linkCls(href)} onClick={() => setOpen(false)}>
          <Icon size={17} aria-hidden />
          {label}
          {href === "/compare" && compareIds.length > 0 && (
            <span className="ml-auto rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
              {compareIds.length}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );

  const account = guestMode ? (
    <Link href="/login" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-blue-100/80 hover:bg-white/5 hover:text-white">
      <LogIn size={16} aria-hidden /> Sign in
    </Link>
  ) : (
    <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-blue-100/80 hover:bg-white/5 hover:text-white">
      <LogOut size={16} aria-hidden />
      <span className="truncate">Sign out ({userEmail})</span>
    </button>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-navy px-4 py-3 text-white lg:hidden">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold">
          <BrandMark size={18} /> College Compass
        </Link>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="rounded-lg p-2 hover:bg-white/10"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-30 bg-navy pt-16 lg:hidden">
          <div className="px-4">{nav}<div className="mt-4 border-t border-white/10 pt-3">{account}</div></div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-navy px-4 py-6 lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 font-display text-xl font-semibold text-white">
          <BrandMark /> College Compass
        </Link>
        {nav}
        <div className="mt-auto border-t border-white/10 pt-3">
          {guestMode && (
            <p className="mb-2 rounded-lg bg-amber-400/15 px-3 py-2 text-[11px] leading-snug text-amber-200">
              {supabaseAvailable
                ? "Guest — changes stay in this browser. Sign in to sync them to your account."
                : "Accounts are unavailable right now — changes stay in this browser."}
            </p>
          )}
          {account}
        </div>
      </aside>
    </>
  );
}
