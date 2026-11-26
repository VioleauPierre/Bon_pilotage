import type { Metadata } from "next";
import { InvitationForm } from "./invitation-form";

export const metadata: Metadata = { title: "Choisir un mot de passe · ELITE GUIDAGE" };

export default function InvitationPage() {
  return <InvitationForm />;
}
