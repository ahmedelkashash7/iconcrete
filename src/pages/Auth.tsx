import { BrandLockup, BrandMark } from "@/components/BrandMark";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, ArrowRight, Loader2, Mail, UserX, Phone } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const { pick, isRTL } = useI18n();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [step, setStep] = useState<{ email: string; phone: string }>({ email: "", phone: "" });
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({
        email: formData.get("email") as string,
        phone: formData.get("phone") as string,
      });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : pick("تعذر إرسال كود التحقق. حاول مرة أخرى.", "Could not send the code."),
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      console.log("signed in");
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError(
        pick(
          "كود التحقق غير صحيح. تأكد من الأرقام الستة في البريد.",
          "Incorrect code - check the six digits in your email.",
        ),
      );
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      setError(
        pick(
          `تعذر الدخول كزائر. ${error instanceof Error ? error.message : ""}`,
          `Guest sign-in failed: ${error instanceof Error ? error.message : ""}`,
        ),
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="bp-grid pointer-events-none absolute inset-0 opacity-[0.03]" />
      <header className="relative mx-auto flex h-16 w-full max-w-6xl items-center px-6">
        <button type="button" onClick={() => navigate("/")} aria-label={pick("الصفحة الرئيسية", "Home")}>
          <BrandLockup subtitle={null} />
        </button>
        <div className="ms-auto">
          <LanguageToggle />
        </div>
      </header>

      <div className="relative flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md gap-0 overflow-hidden border-border">
          {step.email === "" ? (
            <>
              <CardHeader className="gap-2 px-6 pt-7 text-center">
                <div className="flex justify-center">
                  <BrandMark className="size-14" />
                </div>
                <CardTitle className="mt-2 text-xl">
                  {pick("الدخول إلى IConcrete System", "Sign in to IConcrete")}
                </CardTitle>
                <CardDescription>
                  {pick(
                    "أدخل بريدك ورقم تليفونك - يصل كود التحقق إلى بريدك خلال لحظات",
                    "Enter your work email to sign in or create an account",
                  )}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleEmailSubmit}>
                <CardContent className="px-6 space-y-4">
                  <div className="relative flex-1">
                    <Mail className="absolute start-3 top-3 size-4 text-muted-foreground" />
                    <Input
                      name="email"
                      placeholder="name@company.com"
                      type="email"
                      className="ps-9"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="relative flex-1">
                    <Phone className="absolute start-3 top-3 size-4 text-muted-foreground" />
                    <Input
                      name="phone"
                      placeholder="01xxxxxxxxx - رقم تليفون الموظف"
                      type="tel"
                      className="ps-9"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        {pick("إرسال كود التحقق", "Send verification code")}
                        <Arrow className="size-4" />
                      </>
                    )}
                  </Button>

                  {error && (
                    <p className="mt-2 text-sm text-destructive">{error}</p>
                  )}

                  <div className="mt-5">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-card px-2 text-muted-foreground">
                          {pick("أو", "or")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={handleGuestLogin}
                    disabled={isLoading}
                  >
                    <UserX className="size-4" />
                    {pick("الدخول كزائر (استعراض سريع للموقع)", "Continue as guest (quick tour)")}
                  </Button>

                  <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">
                    {pick(
                      "الضيوف يستكشفون المؤشرات على الفريق من شاشة الفريق والصلاحيات",
                      "Guests explore the KPIs and try data entry, but",
                    )}
                  </p>
                </CardContent>
              </form>
            </>
          ) : (
            <>
              <CardHeader className="gap-2 px-6 pt-7 text-center">
                <div className="flex justify-center">
                  <BrandMark className="size-12" />
                </div>
                <CardTitle className="mt-2 text-xl">{pick("راجع بريدك", "Check your email")}</CardTitle>
                <CardDescription>
                  {pick(
                    `أرسلنا كودا مكونا من ٦ أرقام إلى ${step.email}`,
                    `We sent a 6-digit code to ${step.email}`,
                  )}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleOtpSubmit}>
                <CardContent className="px-6 pb-4">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />
                  <div className="flex justify-center" dir="ltr">
                    <InputOTP value={otp} onChange={setOtp} maxLength={6} disabled={isLoading}>
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {error && <p className="mt-2 text-center text-sm text-destructive">{error}</p>}
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    {pick("لم يصلك الكود؟", "Didn't get the code?")}{" "}
                    <Button variant="link" type="button" className="h-auto p-0" onClick={() => setStep({ email: "", phone: "" })}>
                      {pick("إعادة المحاولة", "Try again")}
                    </Button>
                  </p>
                </CardContent>
                <CardFooter className="flex-col gap-2 px-6">
                  <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {pick("جار التحقق...", "Verifying...")}
                      </>
                    ) : (
                      <>
                        {pick("تأكيد الكود", "Confirm code")}
                        <Arrow className="size-4" />
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setStep({ email: "", phone: "" })} disabled={isLoading} className="w-full">
                    {pick("استخدام بريد آخر", "Use another email")}
                  </Button>
                </CardFooter>
              </form>
            </>
          )}

          <div className="border-t bg-muted px-6 py-4 text-center text-xs">
            {pick("مؤمن بواسطة", "Secured by")}{" "}
            <a href="https://freebuff.com" target="_blank" rel="noopener noreferrer" className="underline">
              freebuff.com
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
