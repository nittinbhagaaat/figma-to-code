"use client";
import { use } from "react";
import { StudioApp } from "@/components/studio/studio-app";
export default function StudioPage({ params }) { const { projectId } = use(params); return <StudioApp projectId={projectId} />; }
