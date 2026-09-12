"use client";

import { useRouter } from "next/navigation";
import { CommandPaletteView } from "./CommandPalette.jsx";

/** Next App Router wrapper — injects router.push as navigate. */
export default function CommandPaletteNext({ open, onClose }) {
  const router = useRouter();
  const navigate = (path) => router.push(path);
  return <CommandPaletteView open={open} onClose={onClose} navigate={navigate} />;
}
