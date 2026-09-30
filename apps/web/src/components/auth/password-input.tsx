"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-context";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type">;

export default function PasswordInput({
  disabled,
  ...props
}: PasswordInputProps) {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        className="pr-12"
        disabled={disabled}
        type={isVisible ? "text" : "password"}
        {...props}
      />
      <button
        aria-label={isVisible ? t("auth.hidePassword") : t("auth.showPassword")}
        className="absolute right-1.5 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        disabled={disabled}
        onClick={() => setIsVisible((visible) => !visible)}
        type="button"
      >
        {isVisible ? (
          <EyeOff aria-hidden="true" className="size-[1.05rem]" />
        ) : (
          <Eye aria-hidden="true" className="size-[1.05rem]" />
        )}
      </button>
    </div>
  );
}
