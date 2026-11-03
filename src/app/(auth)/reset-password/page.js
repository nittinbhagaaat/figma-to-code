import { Suspense } from "react";
import { ResetForm } from "./reset-form";
export const metadata = { title: "Choose a new password" };
export default function Page() { return <Suspense><ResetForm /></Suspense>; }
