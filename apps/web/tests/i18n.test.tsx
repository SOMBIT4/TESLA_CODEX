import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import LocaleSwitcher from "@/components/layout/locale-switcher";
import { LocaleProvider, useI18n } from "@/lib/i18n/locale-context";

function TranslationProbe() {
  const { t } = useI18n();

  return (
    <div>
      <p>{t("auth.signIn")}</p>
      <p>{t("status.completed")}</p>
      <p>{t("fare.estimatedSolo")}</p>
      <p>{t("map.selectPickup")}</p>
      <p>{t("map.selectDestination")}</p>
      <p>{t("map.unavailable")}</p>
      <p>{t("map.accessibleName")}</p>
      <p>{t("map.zone.banani")}</p>
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
    expect(serverMarkup).toContain("Tap a zone to set pickup");
    expect(serverMarkup).toContain("Tap a zone to set destination");
    expect(serverMarkup).toContain("Map is unavailable");
    expect(serverMarkup).toContain("Dhaka ride zones");
    expect(serverMarkup).toContain("Banani");
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
      expect(
        screen.getByText("জোনে ট্যাপ করে পিকআপ নির্বাচন করুন"),
      ).toBeVisible();
      expect(
        screen.getByText("জোনে ট্যাপ করে গন্তব্য নির্বাচন করুন"),
      ).toBeVisible();
      expect(
        screen.getByText(
          "মানচিত্রটি পাওয়া যাচ্ছে না। তালিকা থেকে জোন বেছে নিন।",
        ),
      ).toBeVisible();
      expect(screen.getByText("ঢাকার রাইড জোনের মানচিত্র")).toBeVisible();
      expect(screen.getByText("বনানী")).toBeVisible();
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
      expect(screen.getByRole("combobox", { name: "ভাষা" })).toHaveValue("bn");
    });
  });
});
