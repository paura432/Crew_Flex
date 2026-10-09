import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Sign in</h1>
      <p className="mb-6 text-muted">Access your Crew Flex workspace.</p>
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <p className="mt-6 text-sm text-muted">
        No account?{" "}
        <Link href="/register" className="font-semibold text-blue hover:underline">
          Create one
        </Link>
      </p>
    </>
  );
}
