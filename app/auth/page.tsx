import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export default function AuthPage() {
  // Форма читает `next` из query (возврат по инвайт-ссылке), а useSearchParams
  // без Suspense-границы срывает пререндер этой страницы.
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  );
}
