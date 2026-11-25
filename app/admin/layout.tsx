import type { Metadata } from "next";
import Link from "next/link";
import "./admin.css";

export const metadata: Metadata = {
  title: "Administration · ELITE GUIDAGE",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-inner">
          <Link className="admin-brand" href="/admin" prefetch={false}>
            <span className="admin-brand-mark" aria-hidden="true">EG</span>
            ELITE GUIDAGE
          </Link>
          <Link href="/" className="admin-button" prefetch={false}>Formulaire des pilotes</Link>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
