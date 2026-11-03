import { Suspense } from "react";
import { Verify } from "./verify";
export const metadata = { title: "Verify email" };
export default function Page() { return <Suspense><Verify /></Suspense>; }
