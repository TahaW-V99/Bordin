import Link from "next/link";
import { BordinLogo } from "@/shared/components/bordin-logo";
import {
  PUBLIC_FOOTER_LINKS,
  PUBLIC_SITE,
  SOCIAL_LINKS,
} from "@/features/public/data/site-config";

function FooterLinkGroup({ title, links }: { title: string; links: Array<{ href: string; label: string }> }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <ul className="mt-4 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-white/55 transition-colors hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-white/8 bg-black">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-3">
              <BordinLogo size={44} className="rounded-xl" />
              <span className="text-lg font-bold text-white">{PUBLIC_SITE.name}</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-7 text-white/55">{PUBLIC_SITE.tagline}</p>
            <p className="mt-2 text-sm text-white/45">{PUBLIC_SITE.description}</p>
          </div>

          <FooterLinkGroup title="امکانات" links={[...PUBLIC_FOOTER_LINKS.product]} />
          <FooterLinkGroup title="شرکت" links={[...PUBLIC_FOOTER_LINKS.company]} />
          <FooterLinkGroup title="قوانین" links={[...PUBLIC_FOOTER_LINKS.legal]} />
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/8 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/45">{PUBLIC_SITE.copyright}</p>
          <div className="flex flex-wrap items-center gap-4">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white/55 transition-colors hover:text-bordin-orange"
                aria-label={social.label}
              >
                {social.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
