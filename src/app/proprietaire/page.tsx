import { redirect } from "next/navigation";

// Ancienne page de login propriétaire : la connexion est unifiée sur /login
// (email & mot de passe pour la caisse comme pour le propriétaire). La route
// est conservée pour les liens/bookmarks existants.
export default function OwnerLoginRedirect() {
  redirect("/login");
}
