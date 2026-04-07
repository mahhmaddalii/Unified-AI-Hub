"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SignupForm from "../../components/auth/signup-form";
import { checkActiveSession } from "../../utils/auth";

export default function SignupPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      const session = await checkActiveSession();
      if (cancelled) return;
      if (session.isAuthenticated) {
        router.replace("/chat");
      } else {
        setCheckingSession(false);
      }
    };

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checkingSession) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#ffffff] py-10 px-4">
      <div className="bg-white rounded-3xl shadow-xl p-4 sm:p-6 w-full max-w-md">
        <SignupForm />
      </div>
    </div>
  );
}
