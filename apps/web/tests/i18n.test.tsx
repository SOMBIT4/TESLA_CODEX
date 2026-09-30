import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import LocaleSwitcher from "@/components/layout/locale-switcher";
import {
  LocaleProvider,
  useI18n,
} from "@/lib/i18n/locale-context";

function TranslationProbe() {
  const { t } = useI18n();

  return (
    <div>
      <p>{t("auth.signIn")}</p>
      <p>{t("status.completed")}</p>
      <p>{t("fare.estimatedSolo")}</p>
    </div>
  );
}

describe("localization foundation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "en";
  });

  it("renders stable English copy before reading the saved locale", () => {
    window.localStorage.setItem("locale", "bn");

    const serverMarkup = renderToString(
      <LocaleProvider>
        <TranslationProbe />
      </LocaleProvider>,
    );

    expect(serverMarkup).toContain("Sign in");
    expect(serverMarkup).toContain("Completed");
    expect(serverMarkup).toContain("Estimated solo fare");
  });

  it("switches to Bangla, persists the choice, and updates document language", async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <LocaleSwitcher />
        <TranslationProbe />
      </LocaleProvider>,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Language" }),
      "bn",
    );

    await waitFor(() => {
      expect(screen.getByText("সাইন ইন")).toBeVisible();
      expect(screen.getByText("সম্পন্ন")).toBeVisible();
      expect(screen.getByText("আনুমানিক একক ভাড়া")).toBeVisible();
      expect(document.documentElement.lang).toBe("bn");
      expect(window.localStorage.getItem("locale")).toBe("bn");
    });
  });

  it("restores a saved Bangla preference after hydration", async () => {
    window.localStorage.setItem("locale", "bn");

    render(
      <LocaleProvider>
        <LocaleSwitcher />
        <TranslationProbe />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("সাইন ইন")).toBeVisible();
      expect(screen.getByRole("combobox", { name: "ভাষা" })).toHaveValue(
        "bn",
      );
    });
  });
});
