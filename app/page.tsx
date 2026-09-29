import { configured, supabase } from "@/lib/supabase/server";
import { AuthScreen } from "@/components/auth-screen";
import { Notebook } from "@/components/notebook";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!configured()) return <AuthScreen configured={false} />;
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return <AuthScreen configured />;
  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (!profile || profile.state !== "active")
    return (
      <AuthScreen
        configured
        message="This account is unavailable or scheduled for deletion."
      />
    );
  return <Notebook email={user.email || ""} initialProfile={profile} />;
}
