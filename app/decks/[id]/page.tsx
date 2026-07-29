"use client";

import { use } from "react";
import { DeckBuilderPage } from "@/components/deck-builder/DeckBuilderPage";

export default function DeckByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DeckBuilderPage deckId={id} />;
}
