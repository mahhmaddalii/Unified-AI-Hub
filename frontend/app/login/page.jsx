"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginForm from '../../components/auth/login-form';
import { checkActiveSession } from "../../utils/auth";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      const session = await checkActiveSession();
      if (!cancelled && session.isAuthenticated) {
        router.replace("/chat");
      }
    };

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#ffffff] py-10 px-4">
      <div className="bg-white rounded-3xl shadow-xl p-4 sm:p-6 w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  );
}
