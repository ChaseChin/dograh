"use client";

import Cal from "@calcom/embed-react";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAppConfig } from "@/context/AppConfigContext";
import { useAuth } from "@/lib/auth";

import { CaptchaChallenge } from "./CaptchaChallenge";
import { FormTrustLine } from "./FormTrustLine";
import { isValidEmail } from "./isPersonalEmail";
import { HIRE_VOLUME_OPTIONS, type LeadSource } from "./leadFieldOptions";
import { LeadModalShell } from "./LeadModalShell";
import { PhoneField } from "./PhoneField";
import { submitLead } from "./submitLead";

interface HireExpertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: LeadSource;
  onOpenEnterprise: () => void;
}

export function HireExpertModal({ open, onOpenChange, source, onOpenEnterprise }: HireExpertModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();  // logged-in identity (prefills the email field)
  const { config } = useAppConfig();
  // Deployment provenance (analytics only): cloud → cloud_app, else oss_app. OSS submits the
  // lead anonymously (cloud can't verify its token), so the email field below is the identity.
  const origin = config?.deploymentMode === "cloud" ? "cloud_app" : "oss_app";
  // Logged-in user's email (Stack uses primaryEmail; local uses email) — prefilled, editable.
  const userEmail = user ? ("primaryEmail" in user ? user.primaryEmail ?? "" : user.email ?? "") : "";

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [agentGoal, setAgentGoal] = useState("");
  const [phone, setPhone] = useState("");
  const [volume, setVolume] = useState("");
  const [captchaActive, setCaptchaActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Cal.com booking link from the server's response (the server decides; the app only renders).
  const [calLink, setCalLink] = useState<string | null>(null);

  // Prefill the email from the logged-in user when the modal opens (don't clobber edits).
  useEffect(() => {
    if (open && userEmail) setEmail((e) => e || userEmail);
  }, [open, userEmail]);

  const reset = () => {
    setName(""); setCompany(""); setEmail(""); setJobTitle(""); setAgentGoal("");
    setPhone(""); setVolume(""); setCaptchaActive(false); setSubmitting(false);
    setCalLink(null);
  };

  // Required fields, independent of the anti-spam check (which is revealed only
  // after the first submit click — see handleSubmit).
  const baseValid =
    Boolean(name.trim()) &&
    Boolean(company.trim()) &&
    isValidEmail(email) &&
    Boolean(jobTitle.trim()) &&
    Boolean(agentGoal.trim()) &&
    Boolean(phone.trim()) &&
    Boolean(volume);

  const canSubmit = baseValid && !submitting;

  // Validate, then pop the anti-spam check on top of the modal.
  const handleSubmit = () => {
    if (!baseValid) {
      toast.error(t("leadForms.toasts.fillRequired"));
      return;
    }
    setCaptchaActive(true);
  };

  // Runs once the captcha popup is verified.
  const doSubmit = async () => {
    setCaptchaActive(false);
    setSubmitting(true);
    try {
      const result = await submitLead({
        kind: "hire_expert",
        source,
        origin,
        payload: { name, company, email, jobTitle, agentGoal, phone, volume },
      });
      // The server decides whether to return a booking link; if it does, show the calendar
      // inline, else the email note. The app only reads the response — no logic of its own.
      if (result?.show_calendar && result.cal_link) {
        setSubmitting(false);
        setCalLink(result.cal_link);
      } else {
        toast.success(t("leadForms.toasts.emailSent"));
        reset();
        onOpenChange(false);
      }
    } catch {
      toast.error(t("leadForms.toasts.submitFailed"));
      setSubmitting(false);
    }
  };

  // Booking state: the server returned a booking link — show the inline calendar in the modal.
  if (calLink) {
    return (
      <LeadModalShell
        open={open}
        onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}
        icon={Sparkles}
        eyebrow={t("leadForms.hire.eyebrow")}
        title={t("leadForms.hire.bookTitle")}
        description={t("leadForms.bookDescription")}
        primary={{ label: t("leadForms.done"), onClick: () => { reset(); onOpenChange(false); } }}
      >
        {/* Compact, zoomed-out calendar: render it larger, scale to 0.8, and clip the layout box left behind. */}
        <div className="overflow-hidden" style={{ height: "440px" }}>
          <Cal
            calLink={calLink}
            config={{ layout: "month_view", name, email }}
            style={{ width: "113.64%", height: "500px", overflow: "auto", transform: "scale(0.88)", transformOrigin: "top left" }}
          />
        </div>
      </LeadModalShell>
    );
  }

  return (
    <LeadModalShell
      open={open}
      onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}
      icon={Sparkles}
      eyebrow={t("leadForms.hire.eyebrow")}
      title={t("leadForms.hire.title")}
      description={t("leadForms.hire.description")}
      primary={{ label: t("leadForms.submit"), onClick: handleSubmit, disabled: !canSubmit, loading: submitting }}
      secondary={{ label: t("common.cancel"), onClick: () => onOpenChange(false), disabled: submitting }}
      helper={
        <button
          type="button"
          onClick={onOpenEnterprise}
          className="underline decoration-dashed underline-offset-4 hover:text-foreground"
        >
          {t("leadForms.hire.enterpriseHelper")}
        </button>
      }
      trustLine={<FormTrustLine />}
      overlay={captchaActive ? <CaptchaChallenge onVerified={doSubmit} onCancel={() => setCaptchaActive(false)} /> : undefined}
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hire-name">{t("leadForms.fields.name")}</Label>
            <Input id="hire-name" placeholder={t("leadForms.fields.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hire-company">{t("leadForms.fields.company")}</Label>
            <Input id="hire-company" placeholder={t("leadForms.fields.companyPlaceholder")} value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hire-email">{t("leadForms.fields.email")}</Label>
          <Input id="hire-email" type="email" placeholder={t("leadForms.fields.emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hire-title">{t("leadForms.fields.jobTitle")}</Label>
          <Input id="hire-title" placeholder={t("leadForms.fields.jobTitlePlaceholder")} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hire-goal">{t("leadForms.fields.goal")}</Label>
          <Textarea
            id="hire-goal"
            value={agentGoal}
            onChange={(e) => setAgentGoal(e.target.value)}
            placeholder={t("leadForms.fields.goalPlaceholderHire")}
            rows={3}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hire-phone">{t("leadForms.fields.phone")}</Label>
            <PhoneField id="hire-phone" value={phone} onChange={setPhone} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hire-volume">{t("leadForms.fields.volumeExpected")}</Label>
            <Select value={volume} onValueChange={setVolume}>
              <SelectTrigger id="hire-volume"><SelectValue placeholder={t("leadForms.fields.select")} /></SelectTrigger>
              <SelectContent>
                {HIRE_VOLUME_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{t(o.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

      </div>
    </LeadModalShell>
  );
}
