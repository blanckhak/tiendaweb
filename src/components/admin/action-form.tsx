"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/admin/actions";

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  /** Pide confirmación antes de enviar (acciones que avisan al cliente o no se pueden deshacer). */
  confirm?: string;
};

/** Formulario del panel que muestra el resultado (error o "listo") de la acción del servidor. */
export function ActionForm({ action, children, className, confirm }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state?.error && <p className="mt-2 text-sm text-red-700" role="alert">{state.error}</p>}
      {state?.ok && !pending && <p className="mt-2 text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}
