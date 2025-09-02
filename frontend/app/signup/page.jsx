import SignupForm from "../../components/ui/signup-form";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#ffffff] py-10 px-4">
      <div className="bg-white rounded-3xl shadow-xl p-4 sm:p-6 w-full max-w-md">
        <SignupForm />
      </div>
    </div>
  );
}
