"use client";

import { useRef } from "react";

import { InviteMemberForm } from "@/components/organization/InviteMemberForm";
import { SentInvitationsList, type SentInvitationsListHandle } from "@/components/organization/SentInvitationsList";

export function InvitationsPageClient() {
  const listRef = useRef<SentInvitationsListHandle>(null);

  return (
    <>
      <InviteMemberForm onInvited={() => listRef.current?.refresh()} />
      <SentInvitationsList ref={listRef} />
    </>
  );
}
