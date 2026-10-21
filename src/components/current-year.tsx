"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** El año se lee solo en el navegador para no fijarlo en el HTML pre-generado. */
export function CurrentYear() {
  const year = useSyncExternalStore(noop, () => new Date().getFullYear(), () => null);
  return <>{year}</>;
}

const today = () => new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Lima" });

/** Fecha de hoy (dd/mm/aaaa, hora de Lima), calculada en el navegador. */
export function TodayDate() {
  return <>{useSyncExternalStore(noop, today, () => "")}</>;
}
