import { Redirect } from "expo-router";
import { useSession } from "@/session";

export default function Index() {
  const { ready, clinicianId } = useSession();
  if (!ready) return null;
  return <Redirect href={clinicianId ? "/(tabs)" : "/sign-in"} />;
}
