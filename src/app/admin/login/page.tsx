import { connection } from "next/server";
import { adminEmailRequired } from "@/server/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  await connection(); // lee ADMIN_EMAIL al pedir la página, no al compilar
  return <LoginForm withEmail={adminEmailRequired()} />;
}
