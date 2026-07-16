import { useEffect, useState } from "react";
import { Shield, KeyRound, LogOut, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function SecuritySettings() {
  const { user, signOut } = useAuth();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const [factors, setFactors] = useState<any[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [pendingFactor, setPendingFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [otp, setOtp] = useState("");

  const loadFactors = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp ?? []);
  };

  useEffect(() => { loadFactors(); }, []);

  const changePassword = async () => {
    if (newPw.length < 8) return toast.error("Password must be at least 8 characters.");
    if (newPw !== confirmPw) return toast.error("Passwords do not match.");
    if (!user?.email) return toast.error("No user email on file.");
    setSavingPw(true);
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPw,
    });
    if (reauthErr) {
      setSavingPw(false);
      return toast.error("Current password is incorrect.");
    }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSavingPw(false);
    if (error) return toast.error(error.message);
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    toast.success("Password updated.");
  };

  const logoutAllDevices = async () => {
    setSigningOutAll(true);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    setSigningOutAll(false);
    if (error) return toast.error(error.message);
    toast.success("Signed out of all devices.");
    await signOut();
  };

  const startEnroll = async () => {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setEnrolling(false);
    if (error || !data) return toast.error(error?.message ?? "Could not start 2FA enrollment.");
    setPendingFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const verifyEnroll = async () => {
    if (!pendingFactor) return;
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: pendingFactor.id });
    if (chErr || !ch) return toast.error(chErr?.message ?? "Challenge failed.");
    const { error } = await supabase.auth.mfa.verify({
      factorId: pendingFactor.id, challengeId: ch.id, code: otp,
    });
    if (error) return toast.error(error.message);
    toast.success("Two-factor authentication enabled.");
    setPendingFactor(null); setOtp("");
    loadFactors();
  };

  const removeFactor = async (id: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) return toast.error(error.message);
    toast.success("Two-factor authentication disabled.");
    loadFactors();
  };

  const verifiedFactor = factors.find((f) => f.status === "verified");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Change password</CardTitle>
          <CardDescription>Use at least 8 characters. You'll need your current password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cur">Current password</Label>
            <Input id="cur" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new">New password</Label>
            <Input id="new" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="conf">Confirm new password</Label>
            <Input id="conf" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
          </div>
          <Button onClick={changePassword} disabled={savingPw || !currentPw || !newPw}>
            {savingPw ? "Updating…" : "Update password"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LogOut className="h-5 w-5" /> Login sessions</CardTitle>
          <CardDescription>
            For security, we can't list every device — but you can sign every session out at once.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user?.email}</span>
          </div>
          <Button variant="destructive" onClick={logoutAllDevices} disabled={signingOutAll}>
            {signingOutAll ? "Signing out…" : "Log out of all devices"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Two-factor authentication</CardTitle>
          <CardDescription>Add an authenticator app (Google Authenticator, 1Password, Authy) for an extra layer of security.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {verifiedFactor ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Smartphone className="h-4 w-4" />
                <span>Authenticator app enabled</span>
                <Badge variant="secondary">Active</Badge>
              </div>
              <Button variant="outline" onClick={() => removeFactor(verifiedFactor.id)}>Disable 2FA</Button>
            </div>
          ) : pendingFactor ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Scan this QR code with your authenticator app, then enter the 6-digit code.</p>
              <img src={pendingFactor.qr} alt="2FA QR code" className="h-44 w-44 rounded-sm border" />
              <p className="text-xs font-mono break-all">Secret: {pendingFactor.secret}</p>
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="otp">6-digit code</Label>
                  <Input id="otp" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} className="w-32" />
                </div>
                <Button onClick={verifyEnroll} disabled={otp.length !== 6}>Verify & enable</Button>
                <Button variant="ghost" onClick={() => { setPendingFactor(null); setOtp(""); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button onClick={startEnroll} disabled={enrolling}>
              {enrolling ? "Preparing…" : "Enable two-factor authentication"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}