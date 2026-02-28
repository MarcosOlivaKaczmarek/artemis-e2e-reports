"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto flex items-center justify-between h-14 px-4">
        <Link href="/" className="font-semibold text-lg">
          Artemis E2E Reports
        </Link>
        <div className="flex items-center gap-4">
          {status === "loading" ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : session?.user ? (
            <>
              <span className="text-sm text-muted-foreground">
                {session.user.name || session.user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                Sign out
              </Button>
            </>
          ) : status === "unauthenticated" ? (
            <Button size="sm" onClick={() => signIn("github")}>
              Sign in with GitHub
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
