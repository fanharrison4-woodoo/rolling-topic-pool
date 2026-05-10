import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/topics", label: "Topics" },
  { href: "/history", label: "History" },
];

export function SiteNav() {
  return (
    <nav className="flex flex-wrap items-center gap-3">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
