import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Create account</h1>
      <p className="mb-6 text-muted">
        Your profile stays private by default. You decide what is visible and when.
      </p>
      <RegisterForm />
      <p className="mt-6 text-sm text-muted">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-blue hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
