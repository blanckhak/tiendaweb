import { Suspense } from "react";
import { connection } from "next/server";
import { adminEmailRequired } from "@/server/auth";
import { LoginForm } from "./login-form";

/** Lee ADMIN_EMAIL al pedir la página, no al compilar. */
async function Form() {
  await connection();
  return <LoginForm withEmail={adminEmailRequired()} />;
}

export default function LoginPage() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
